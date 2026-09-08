import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc, 
  updateDoc, 
  setDoc, 
  addDoc, 
  deleteDoc,
  runTransaction,
  serverTimestamp,
  orderBy,
  onSnapshot,
  increment,
  writeBatch,
  Firestore
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import {
  computeStudentAttendanceStats,
  diffAttendanceStatuses,
  roomQueryCandidates,
  AttendanceRecordLite,
  AttendanceStatusValue,
} from '../lib/studentAttendanceStats';
import { 
  StudentSelfAssessment,
  GateAttendanceRecord,
  DetailedLeaveRequest,
  GPSCheckInLog,
  TwoQuestionScreening,
  PHQ9Screening,
  SDQAssessment,
  SubstituteAssignment,
  SubstituteApprovalStage,
  SubstituteApprovalStep,
  PostTeachingRecord,
  ParentTeacherMessage,
  ParentAppointment,
  BillingInvoice,
  ActiveLearningRecord,
  UserProfile,
  LateAttendanceRequestRecord,
  StudentPortfolioEntry,
  StudentHomeLocation,
  ElectiveActivityConfig,
  ActivityEnrollment,
  HouseConfig,
  GuidanceCounselingCase,
  InfirmaryVisit,
  ParentNotification,
  SchoolCalendarEvent
} from '../types';
import { SchoolGeofenceConfig } from '../utils/geoUtils';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

/**
 * Standardized Firestore error handler:
 * - Logs full diagnostic payload with auth info to console for authorized developers/debugger
 * - Throws sanitized, PII-free Error to caller
 */
function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
    },
    operationType,
    path
  };

  // Safe developer console output
  console.error('[Firestore Diagnostic Error]:', JSON.stringify(errInfo));

  // PII-free generic error thrown to UI components
  const sanitizedCode = error instanceof Error && (error as any).code ? (error as any).code : 'PERMISSION_OR_NETWORK_ERROR';
  throw new Error(`FIRESTORE_${sanitizedCode.toUpperCase()}: Operation '${operationType}' failed on resource.`);
}

export interface FirestoreSchedule {
  id?: string;
  dayOfWeek: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday';
  periodNumber: number;
  subjectCode: string;
  subjectType: 'MAIN' | 'ACTIVITY';
  teacherIds: string[];
  room: string;
}

export interface FirestoreAttendanceRecord {
  id: string;
  date: string; // YYYY-MM-DD
  room: string; // E.g., ม.5/8
  checkedByTeacherId: string;
  checkedByName: string;
  periodNumber: number; // 0 for Homeroom, 1-8 for classes
  checkedAt: any;
  isLocked: boolean;
  // HOMEROOM_DEFAULT = เช็คชื่อโดยครูประจำชั้นตอนเช้า (ใช้เป็นค่าเริ่มต้นของทุกคาบวันนั้น)
  // PERIOD_OVERRIDE  = ครูผู้สอนเช็ค/แก้เฉพาะคาบตัวเอง
  source?: 'HOMEROOM_DEFAULT' | 'PERIOD_OVERRIDE';
  students: {
    [studentId: string]: 'PRESENT' | 'LATE' | 'ABSENT' | 'LEAVE';
  };
}

/**
 * 1. Targeted query to fetch today's schedule for a teacher on a specific weekday
 * Uses where('teacherIds', 'array-contains', teacherId) and where('dayOfWeek', '==', dayOfWeek)
 */
export async function getTodayScheduleByTeacher(teacherId: string, dayOfWeek: string): Promise<FirestoreSchedule[]> {
  const collectionPath = 'schedules';
  try {
    const dayLower = dayOfWeek.toLowerCase().trim();
    const schedulesCol = collection(db, collectionPath);

    // Direct indexed query
    const targetQuery = query(
      schedulesCol,
      where('teacherIds', 'array-contains', teacherId),
      where('dayOfWeek', '==', dayLower)
    );

    const querySnapshot = await getDocs(targetQuery);
    const schedules: FirestoreSchedule[] = [];

    querySnapshot.forEach((docSnap) => {
      schedules.push({ id: docSnap.id, ...docSnap.data() } as FirestoreSchedule);
    });

    return schedules;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `${collectionPath}?teacherId=${teacherId}&dayOfWeek=${dayOfWeek}`);
  }
}

/**
 * เขียน attendance_records + sync ตัวเลขสรุป students/{id}.attendanceStats (derived cache) คู่กัน
 * เสมอในทรานแซกชันเดียว — attendance_records ยังเป็น source of truth เหมือนเดิม, attendanceStats
 * เป็นแค่ cache ที่คำนวณมาจากมันเพื่อให้ Parent/Student อ่านสรุปได้โดยไม่ต้องมีสิทธิ์ query
 * attendance_records ทั้งห้อง (rule ปัจจุบันให้อ่านเฉพาะ SUPER_ADMIN/EXECUTIVE/SUBJECT_TEACHER/
 * HOMEROOM_TEACHER — เอกสารไม่มี field เจ้าของระดับ document ให้ scope สิทธิ์ผู้ปกครอง/นักเรียนได้)
 *
 * ใช้ delta sync (เทียบสถานะเก่า vs ใหม่ต่อนักเรียนที่มีอยู่แล้วใน doc นี้ ไม่ใช่ +1 เดินหน้าเรื่อยๆ)
 * — รองรับกรณีแก้ไข attendance ย้อนหลัง/ครูเปลี่ยนสถานะนักเรียนคนเดิมซ้ำในคาบเดิมโดยไม่ทำให้ตัวเลข
 * สะสมเพี้ยนไปจากของจริง ถ้าตัวเลขเคยเพี้ยนไปแล้วจากบั๊ก/ข้อมูลเก่าก่อนมีฟังก์ชันนี้ ใช้
 * recomputeStudentAttendanceStats() คำนวณใหม่ทั้งหมดจาก attendance_records จริงได้เสมอ
 */
export async function writeAttendanceRecordWithStatsSync(
  recordId: string,
  students: Record<string, AttendanceStatusValue>,
  extraFields: Record<string, any>,
): Promise<void> {
  const recordRef = doc(db, 'attendance_records', recordId);
  try {
    await runTransaction(db, async (transaction) => {
      // อ่านก่อนเขียนเสมอ (ข้อกำหนดของ Firestore transaction) — ใช้หาสถานะ "เดิม" ของแต่ละคน
      const existingSnap = await transaction.get(recordRef);
      const oldStudents: Record<string, AttendanceStatusValue> =
        existingSnap.exists() ? ((existingSnap.data() as any).students || {}) : {};

      transaction.set(recordRef, {
        id: recordId,
        ...extraFields,
        students,
      }, { merge: true });

      for (const delta of diffAttendanceStatuses(oldStudents, students)) {
        const updates: Record<string, any> = { attendanceStatsUpdatedAt: serverTimestamp() };
        if (delta.oldStatus) updates[`attendanceStats.${delta.oldStatus.toLowerCase()}`] = increment(-1);
        if (delta.newStatus) updates[`attendanceStats.${delta.newStatus.toLowerCase()}`] = increment(1);
        transaction.update(doc(db, 'students', delta.studentId), updates);
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `attendance_records/${recordId}`);
  }
}

/**
 * 2. Save a daily attendance or course attendance record
 */
export async function saveAttendanceRecord(recordData: FirestoreAttendanceRecord): Promise<void> {
  const { id, students, checkedAt, ...rest } = recordData;
  await writeAttendanceRecordWithStatsSync(id, students, {
    ...rest,
    checkedAt: checkedAt || serverTimestamp(),
  });
}

/**
 * Resync ตัวเลข students/{id}.attendanceStats ให้ตรงกับ attendance_records จริงทั้งหมด — ใช้เมื่อ
 * สงสัยว่าตัวเลขเพี้ยน (เช่น ข้อมูลเก่าก่อนมี writeAttendanceRecordWithStatsSync, แก้ไข
 * attendance_records ตรงๆ ผ่านเครื่องมืออื่นนอกแอป, หรือสงสัย bug) — derived cache นี้ไม่ใช่
 * source of truth เสมอสามารถคำนวณใหม่จาก attendance_records ได้ 100% ทุกเมื่อ
 */
export async function recomputeStudentAttendanceStats(
  studentId: string,
  room: string,
): Promise<{ present: number; absent: number; late: number; leave: number }> {
  const candidates = roomQueryCandidates(room).slice(0, 30);
  if (candidates.length === 0) {
    throw new Error('recomputeStudentAttendanceStats: room ว่างเปล่า ไม่สามารถ resync ได้');
  }
  try {
    const snap = await getDocs(query(collection(db, 'attendance_records'), where('room', 'in', candidates)));
    const records: AttendanceRecordLite[] = snap.docs.map(d => {
      const data = d.data() as any;
      return { date: String(data.date || ''), students: data.students || {} };
    });
    const stats = computeStudentAttendanceStats(records, studentId);
    const { present, absent, late, leave } = stats;
    await setDoc(doc(db, 'students', studentId), {
      attendanceStats: { present, absent, late, leave },
      attendanceStatsUpdatedAt: serverTimestamp(),
    }, { merge: true });
    return { present, absent, late, leave };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `students/${studentId}.attendanceStats`);
  }
}

/**
 * 2.1 Fetch a single attendance record by document ID
 */
export async function getAttendanceRecord(recordId: string): Promise<FirestoreAttendanceRecord | null> {
  const collectionPath = 'attendance_records';
  try {
    const recordRef = doc(db, collectionPath, recordId);
    const snap = await getDoc(recordRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as FirestoreAttendanceRecord;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `${collectionPath}/${recordId}`);
  }
}

/**
 * 3. Update behavior score and automatically trigger alert banners and conference documents
 */
export async function updateBehaviorScoreAndTriggerAlert(
  studentId: string,
  scoreDeducted: number,
  reason: string
): Promise<{ newScore: number; riskLevel: 'NORMAL' | 'WARNING' | 'CRITICAL' }> {
  const studentsPath = `students/${studentId}`;
  try {
    return await runTransaction(db, async (transaction) => {
      const studentRef = doc(db, 'students', studentId);
      const studentDoc = await transaction.get(studentRef);

      if (!studentDoc.exists()) {
        throw new Error(`Student document 'students/${studentId}' does not exist.`);
      }

      const studentData = studentDoc.data();
      const currentScore = typeof studentData.behaviorScore === 'number' ? studentData.behaviorScore : 100;
      const studentName = studentData.fullName || studentData.name || `นักเรียนรหัส ${studentId}`;
      const parentUid = studentData.parentUid || studentData.parentId || '';
      const studentUid = studentData.studentUid || null;
      const dateToday = new Date().toISOString().split('T')[0];

      // Deduct score ensuring it stays within [0, 100]
      const newScore = Math.max(0, Math.min(100, currentScore + scoreDeducted));
      
      // Determine new risk level
      let riskLevel: 'NORMAL' | 'WARNING' | 'CRITICAL' = 'NORMAL';
      if (newScore < 70) {
        riskLevel = 'CRITICAL';
      } else if (newScore < 80) {
        riskLevel = 'WARNING';
      }

      // 1. Update Student Profile
      transaction.update(studentRef, {
        behaviorScore: newScore,
        riskLevel: riskLevel,
        updatedAt: serverTimestamp()
      });

      // 2. Write to discipline_logs
      const logRef = doc(collection(db, 'discipline_logs'));
      transaction.set(logRef, {
        studentId,
        studentName,
        type: scoreDeducted < 0 ? 'deduction' : 'addition',
        points: scoreDeducted,
        reason,
        timestamp: serverTimestamp(),
        date: dateToday,
        recordedBy: 'ระบบประเมินผลอัตโนมัติ'
      });

      // 3. Normal Point deduction alert notification
      const notificationRef = doc(collection(db, 'parent_notifications'));
      const statusTextTranslation = scoreDeducted < 0 ? "ถูกหักคะแนนพฤติกรรม" : "ได้รับคะแนนพฤติกรรมคืน";
      const alertTitle = `แจ้งผลคะแนนพฤติกรรม: น้อง${studentName}`;
      const alertMessage = `แจ้งเตือนจากระบบประจำวันที่ ${dateToday}: น้อง${studentName} ${statusTextTranslation} ${Math.abs(scoreDeducted)} คะแนน จากสาเหตุ "${reason}" ส่งผลให้ขณะนี้คะแนนความประพฤติสะสมเหลือ ${newScore} คะแนน`;

      transaction.set(notificationRef, {
        parentUid,
        parentId: parentUid,
        studentUid,
        studentId,
        studentName,
        title: alertTitle,
        message: alertMessage,
        status: 'unread',
        createdAt: serverTimestamp(),
        pointsDeducted: scoreDeducted < 0 ? Math.abs(scoreDeducted) : 0,
        remainingScore: newScore,
        type: riskLevel === 'CRITICAL' ? 'critical' : (riskLevel === 'WARNING' ? 'warning' : 'info')
      });

      // WARNING State Alert Trigger (< 80)
      if (newScore < 80) {
        const warningNotifRef = doc(collection(db, 'parent_notifications'));
        transaction.set(warningNotifRef, {
          parentUid,
          parentId: parentUid,
          studentUid,
          studentId,
          studentName,
          title: "⚠️ คะแนนพฤติกรรมเริ่มลดลง",
          message: `แจ้งเตือนความประพฤติ: คะแนนพฤติกรรมของน้อง${studentName} ลดลงต่ำกว่าเกณฑ์เฝ้าระวังสีส้ม (ปัจจุบันเหลือ ${newScore} คะแนน) กรุณาช่วยตักเตือนและติดตามอย่างใกล้ชิดค่ะ`,
          status: 'unread',
          createdAt: serverTimestamp(),
          pointsDeducted: 0,
          remainingScore: newScore,
          type: 'warning'
        });
      }

      // CRITICAL State Invitation Trigger (< 70)
      if (newScore < 70) {
        const confRef = doc(db, 'parent_conferences', `conf_${studentId}_${dateToday}`);
        transaction.set(confRef, {
          studentId,
          studentName,
          parentUid,
          parentId: parentUid,
          status: 'PENDING',
          title: "นัดหมายพบฝ่ายปกครอง (คะแนนต่ำกว่า 70 คะแนน)",
          message: `เนื่องจากคะแนนพฤติกรรมคงเหลือของน้อง${studentName} อยู่ในระดับวิกฤต (ปัจจุบันเหลือ ${newScore} คะแนน) ซึ่งต่ำกว่าเกณฑ์ของโรงเรียน เพื่อดูแลช่วยเหลือนักเรียนอย่างมีประสิทธิภาพ ทางฝ่ายปกครองจึงจำเป็นต้องขอสัญญานัดหมายเพื่อพูดคุยปรับทัศนคติร่วมกัน`,
          createdAt: serverTimestamp(),
          remainingScore: newScore,
          scheduledDate: null,
          scheduledTime: null,
          availableSlots: [
            "วันจันทร์ 09:00 - 10:00 น.",
            "วันอังคาร 10:30 - 11:30 น.",
            "วันพุธ 13:00 - 14:00 น.",
            "วันพฤหัสบดี 14:30 - 15:30 น.",
            "วันศุกร์ 13:30 - 14:30 น."
          ],
          notes: ""
        }, { merge: true });
      }

      return { newScore, riskLevel };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, studentsPath);
  }
}

/**
 * Centralized parent notifications (parent_notifications/{notifId})
 * FIX: หลายจุดใน store.ts เดิม push แจ้งเตือนเข้า state.parentNotifications แบบ session-local
 * ล้วนๆ (ไม่เคยเขียน Firestore) ทำให้ผู้ปกครองไม่เห็นแจ้งเตือนจริงถ้าไม่ได้อยู่ในเซสชันเบราว์เซอร์
 * เดียวกับตอนที่เหตุการณ์เกิดขึ้น — ใช้ schema/pattern เดียวกับที่ updateBehaviorScoreAndTriggerAlert
 * ใช้อยู่แล้วข้างบน (parentUid/parentId/studentId/studentName/title/message/status/createdAt/type)
 */
export type CreateParentNotificationInput = Pick<ParentNotification, 'parentUid' | 'studentId' | 'studentName' | 'title' | 'message'> &
  Partial<Pick<ParentNotification, 'type' | 'pointsDeducted' | 'remainingScore' | 'attendanceStatus' | 'date' | 'studentUid'>>;

/** เขียนแจ้งเตือนผู้ปกครอง (และนักเรียนเจ้าของ ถ้ามี studentUid) 1 รายการ — ถ้าไม่มี parentUid จริง
 *  (นักเรียนยังไม่เชื่อมบัญชีผู้ปกครอง) ข้ามการเขียนไปเงียบๆ แทนการ fabricate ID ปลอมแบบ
 *  `parent_${studentId}` ที่เคยเป็นมา (เขียนไปก็ไม่มีผู้ปกครองคนไหนอ่านได้จริงอยู่ดี เพราะไม่มี Auth UID
 *  ไหนตรงกับ ID ปลอมนั้น) — เกตนี้ตั้งใจคงไว้เหมือนเดิม แม้จะมี studentUid มาด้วยก็ตาม เพราะทุกจุดที่
 *  เรียกฟังก์ชันนี้อยู่ปัจจุบันยังถือว่า "ไม่มีผู้ปกครองเชื่อมบัญชี" เป็นกรณีข้อมูลไม่สมบูรณ์ที่ควร skip
 *  ทั้งคู่ ไม่ใช่แค่ฝั่งผู้ปกครอง (ถ้าต้องการแยกกัน ต้องตัดสินใจ scope ใหม่แยกต่างหาก) */
export async function createParentNotification(
  data: CreateParentNotificationInput,
  firestoreDb: Firestore = db,
): Promise<void> {
  if (!data.parentUid) {
    console.warn('[createParentNotification] skipped: no real parentUid for studentId', data.studentId);
    return;
  }
  const ref = doc(collection(firestoreDb, 'parent_notifications'));
  try {
    await setDoc(ref, {
      id: ref.id,
      parentUid: data.parentUid,
      parentId: data.parentUid,
      studentUid: data.studentUid ?? null,
      studentId: data.studentId,
      studentName: data.studentName,
      title: data.title,
      message: data.message,
      status: 'unread',
      createdAt: serverTimestamp(),
      type: data.type ?? 'info',
      ...(data.pointsDeducted !== undefined ? { pointsDeducted: data.pointsDeducted } : {}),
      ...(data.remainingScore !== undefined ? { remainingScore: data.remainingScore } : {}),
      ...(data.attendanceStatus !== undefined ? { attendanceStatus: data.attendanceStatus } : {}),
      ...(data.date !== undefined ? { date: data.date } : {}),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `parent_notifications/${ref.id}`);
  }
}

/** ผู้ปกครองเจ้าของกด "อ่านแล้ว" เอง — rules จำกัดให้แก้ได้แค่ field status เท่านั้น */
export async function markParentNotificationRead(notifId: string, firestoreDb: Firestore = db): Promise<void> {
  try {
    await updateDoc(doc(firestoreDb, 'parent_notifications', notifId), { status: 'read' });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `parent_notifications/${notifId}`);
  }
}

/** อ่านทั้งหมด — ยิง update ทีละรายการ (ปกติมีไม่กี่สิบรายการต่อผู้ปกครอง ไม่จำเป็นต้องใช้ batch) */
export async function markAllParentNotificationsRead(notifIds: string[], firestoreDb: Firestore = db): Promise<void> {
  await Promise.all(notifIds.map(id => markParentNotificationRead(id, firestoreDb)));
}

/** real-time listener ของแจ้งเตือน 1 คน เรียงใหม่สุดก่อน — ใช้ได้ทั้งฝั่งผู้ปกครอง ({parentUid}) และ
 *  ฝั่งนักเรียนเจ้าของเอง ({studentUid}) ตาม role ของผู้ใช้ปัจจุบัน ส่งมาได้ทีละแบบเท่านั้น
 *  (ถ้าส่งมาทั้งคู่ ใช้ parentUid ก่อน) */
export function subscribeParentNotifications(
  onUpdate: (notifications: ParentNotification[]) => void,
  filter: { parentUid?: string; studentUid?: string },
): () => void {
  try {
    const parentUid = filter.parentUid;
    const studentUid = filter.studentUid;
    if (!parentUid && !studentUid) { onUpdate([]); return () => {}; }
    const col = collection(db, 'parent_notifications');
    const whereClause = parentUid ? where('parentUid', '==', parentUid) : where('studentUid', '==', studentUid);
    return onSnapshot(query(col, whereClause), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as ParentNotification));
      list.sort((a, b) => {
        const ta = (a.createdAt as any)?.toMillis?.() ?? 0;
        const tb = (b.createdAt as any)?.toMillis?.() ?? 0;
        return tb - ta;
      });
      onUpdate(list);
    }, (error) => {
      console.warn('[subscribeParentNotifications] listener error:', error.message);
      onUpdate([]);
    });
  } catch (error) {
    console.warn('[subscribeParentNotifications] setup error:', error);
    return () => {};
  }
}

/**
 * 4. Batched client-side seeder using writeBatch
 */
export async function seedDatabaseWeb(): Promise<void> {
  const collectionPath = "admin_periods_config";
  try {
    const periods = [
      { id: "period_0", periodNumber: 0, periodName: "คาบ 0 โฮมรูม (Homeroom)", startTime: "08:00", endTime: "08:30" },
      { id: "period_1", periodNumber: 1, periodName: "คาบเรียนที่ 1", startTime: "08:30", endTime: "09:20" },
      { id: "period_2", periodNumber: 2, periodName: "คาบเรียนที่ 2", startTime: "09:20", endTime: "10:10" },
      { id: "period_3", periodNumber: 3, periodName: "คาบเรียนที่ 3", startTime: "10:10", endTime: "11:00" },
      { id: "period_4", periodNumber: 4, periodName: "คาบเรียนที่ 4", startTime: "11:00", endTime: "11:50" },
      { id: "period_5", periodNumber: 5, periodName: "คาบ 5 พักกลางวัน (Lunch Break)", startTime: "11:50", endTime: "12:50" },
      { id: "period_6", periodNumber: 6, periodName: "คาบเรียนที่ 6", startTime: "12:50", endTime: "13:40" },
      { id: "period_7", periodNumber: 7, periodName: "คาบเรียนที่ 7", startTime: "13:40", endTime: "14:30" },
      { id: "period_8", periodNumber: 8, periodName: "คาบเรียนที่ 8", startTime: "14:30", endTime: "15:20" }
    ];

    const teachers = [
      {
        teacherId: "teacher_kiattisak",
        fullName: "Mr. Kiattisak",
        email: "kiattika@utd.ac.th",
        role: "HOMEROOM",
        roomResponsibility: "ม.5/8"
      },
      {
        teacherId: "teacher_koykoy",
        fullName: "Mrs. Koy Koy",
        email: "koykoy@utd.ac.th",
        role: "TEACHER",
        roomResponsibility: ""
      }
    ];

    const students = [
      {
        studentId: "38501",
        studentNumber: 1,
        studentNo: 1,
        fullName: "นายกิตติคุณ มงคลศิลป์",
        nickname: "กิต",
        className: "ม.5/8",
        room: "ม.5/8",
        behaviorScore: 100,
        riskLevel: "NORMAL",
        parentUid: "test_parent_001",
        parentId: "test_parent_001",
        studentUid: "test_student_001"
      },
      {
        studentId: "38502",
        studentNumber: 2,
        studentNo: 2,
        fullName: "สมชาย ใจดี",
        nickname: "ชาย",
        className: "ม.5/8",
        room: "ม.5/8",
        behaviorScore: 100,
        riskLevel: "NORMAL",
        parentUid: "test_parent_002",
        parentId: "test_parent_002"
      },
      {
        studentId: "38503",
        studentNumber: 3,
        studentNo: 3,
        fullName: "สมหญิง มุ่งมั่น",
        nickname: "หญิง",
        className: "ม.5/8",
        room: "ม.5/8",
        behaviorScore: 100,
        riskLevel: "NORMAL",
        parentUid: "test_parent_003",
        parentId: "test_parent_003"
      },
      {
        studentId: "38504",
        studentNumber: 4,
        studentNo: 4,
        fullName: "วิชัย ชัยชนะ",
        nickname: "ชัย",
        className: "ม.5/8",
        room: "ม.5/8",
        behaviorScore: 100,
        riskLevel: "NORMAL",
        parentUid: "test_parent_004",
        parentId: "test_parent_004"
      }
    ];

    const schedules = [
      { id: "sch_hr_monday", dayOfWeek: "monday", periodNumber: 0, subjectCode: "HOMEROOM", subjectType: "ACTIVITY", teacherIds: ["teacher_kiattisak"], room: "ม.5/8" },
      { id: "sch_hr_tuesday", dayOfWeek: "tuesday", periodNumber: 0, subjectCode: "HOMEROOM", subjectType: "ACTIVITY", teacherIds: ["teacher_kiattisak"], room: "ม.5/8" },
      { id: "sch_hr_wednesday", dayOfWeek: "wednesday", periodNumber: 0, subjectCode: "HOMEROOM", subjectType: "ACTIVITY", teacherIds: ["teacher_kiattisak"], room: "ม.5/8" },
      { id: "sch_hr_thursday", dayOfWeek: "thursday", periodNumber: 0, subjectCode: "HOMEROOM", subjectType: "ACTIVITY", teacherIds: ["teacher_kiattisak"], room: "ม.5/8" },
      { id: "sch_hr_friday", dayOfWeek: "friday", periodNumber: 0, subjectCode: "HOMEROOM", subjectType: "ACTIVITY", teacherIds: ["teacher_kiattisak"], room: "ม.5/8" },
      { id: "sch_math_monday", dayOfWeek: "monday", periodNumber: 8, subjectCode: "ค32101", subjectType: "MAIN", teacherIds: ["teacher_kiattisak"], room: "ม.5/8" },
      { id: "sch_math_tuesday", dayOfWeek: "tuesday", periodNumber: 8, subjectCode: "ค32101", subjectType: "MAIN", teacherIds: ["teacher_kiattisak"], room: "ม.5/8" }
    ];

    // Seed using batched writes
    const { writeBatch } = await import('firebase/firestore');
    const batch = writeBatch(db);
    periods.forEach(p => batch.set(doc(db, "admin_periods_config", p.id), p, { merge: true }));
    teachers.forEach(t => batch.set(doc(db, "teachers", t.teacherId), t, { merge: true }));
    students.forEach(s => batch.set(doc(db, "students", s.studentId), s, { merge: true }));
    schedules.forEach(sc => batch.set(doc(db, "schedules", sc.id), sc, { merge: true }));
    await batch.commit();

    console.log("Client batched seeding finished completely!");
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, collectionPath);
  }
}

export async function updateParentConferenceSchedule(
  conferenceId: string,
  scheduledDate: string,
  scheduledTime: string
): Promise<void> {
  const collectionPath = "parent_conferences";
  try {
    const ref = doc(db, collectionPath, conferenceId);
    await setDoc(ref, {
      status: 'SCHEDULED',
      scheduledDate,
      scheduledTime,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${collectionPath}/${conferenceId}`);
  }
}

export interface GradebookScoreRecord {
  id?: string;
  courseCode: string;
  className: string;
  studentId: string;
  term: string;
  preMidterm: number;
  midterm: number;
  postMidterm: number;
  final: number;
  total: number;
  grade: string;
  updatedAt?: any;
}

/**
 * Normalized targeted query to fetch students by class name
 * Uses canonical `className` field indexed with `studentNumber`
 */
export async function getStudentsByClass(className: string): Promise<any[]> {
  const collectionPath = 'students';
  try {
    // Normalize room/class format (e.g. 'M.5/8' -> 'ม.5/8')
    let canonicalClass = className.trim();
    if (canonicalClass.startsWith('M.') || canonicalClass.startsWith('m.')) {
      canonicalClass = canonicalClass.replace(/^M\./i, 'ม.');
    }

    const studentsCol = collection(db, collectionPath);
    const q = query(
      studentsCol, 
      where('className', '==', canonicalClass), 
      orderBy('studentNumber', 'asc')
    );

    const snap = await getDocs(q);
    
    if (snap.empty) {
      console.warn(`[getStudentsByClass] No student records found for canonical class '${canonicalClass}'.`);
      return [];
    }

    return snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        studentId: data.studentId || d.id,
        studentNumber: data.studentNumber ?? data.studentNo ?? 0,
        studentNo: data.studentNumber ?? data.studentNo ?? 0,
        name: data.fullName || data.name || `นักเรียน ${data.studentId || d.id}`,
        fullName: data.fullName || data.name || `นักเรียน ${data.studentId || d.id}`,
        className: data.className || canonicalClass,
        room: data.className || canonicalClass,
        avatar: data.avatar || data.photoUrl || '',
        parentId: data.parentId || ''
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `${collectionPath}?className=${className}`);
  }
}

/**
 * Save score entries under 'gradebook_scores' collection using composite ID format:
 * SCORE_${courseCode}_${className}_${studentId}_${term}
 */
export async function saveGradebookScore(scoreData: GradebookScoreRecord): Promise<void> {
  const collectionPath = 'gradebook_scores';
  const docId = `SCORE_${scoreData.courseCode}_${scoreData.className}_${scoreData.studentId}_${scoreData.term}`;
  try {
    const ref = doc(db, collectionPath, docId);
    await setDoc(ref, {
      ...scoreData,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${collectionPath}/${docId}`);
  }
}

/**
 * Fetch gradebook scores by courseCode and className
 */
export async function getGradebookScoresByClass(
  courseCode: string, 
  className: string, 
  term: string = '1/2569'
): Promise<Record<string, GradebookScoreRecord>> {
  const collectionPath = 'gradebook_scores';
  try {
    let canonicalClass = className.trim();
    if (canonicalClass.startsWith('M.') || canonicalClass.startsWith('m.')) {
      canonicalClass = canonicalClass.replace(/^M\./i, 'ม.');
    }

    const scoresCol = collection(db, collectionPath);
    const snap = await getDocs(query(
      scoresCol, 
      where('courseCode', '==', courseCode), 
      where('className', '==', canonicalClass)
    ));
    
    const resultMap: Record<string, GradebookScoreRecord> = {};
    snap.docs.forEach(docSnap => {
      const data = docSnap.data() as GradebookScoreRecord;
      if (data.studentId) {
        resultMap[data.studentId] = data;
      }
    });
    return resultMap;
  } catch (error) {
    console.warn("Notice fetching gradebook scores:", error);
    return {};
  }
}

/**
 * Save student self-assessment record to 'student_self_assessments'
 */
export async function saveSelfAssessmentRecord(assessment: StudentSelfAssessment): Promise<void> {
  const collectionPath = 'student_self_assessments';
  const docId = assessment.studentId;
  try {
    const ref = doc(db, collectionPath, docId);
    await setDoc(ref, {
      ...assessment,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${collectionPath}/${docId}`);
  }
}

/**
 * Fetch a single student self-assessment
 */
export async function getSelfAssessmentRecord(studentId: string): Promise<StudentSelfAssessment | null> {
  const collectionPath = 'student_self_assessments';
  try {
    const ref = doc(db, collectionPath, studentId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return snap.data() as StudentSelfAssessment;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `${collectionPath}/${studentId}`);
  }
}

/**
 * Fetch all student self-assessments
 */
export async function getAllSelfAssessmentRecords(): Promise<Record<string, StudentSelfAssessment>> {
  const collectionPath = 'student_self_assessments';
  try {
    const colRef = collection(db, collectionPath);
    const snap = await getDocs(colRef);
    const map: Record<string, StudentSelfAssessment> = {};
    snap.docs.forEach(d => {
      const data = d.data() as StudentSelfAssessment;
      map[data.studentId || d.id] = data;
    });
    return map;
  } catch (error) {
    console.warn("Notice fetching all self-assessments:", error);
    return {};
  }
}

/**
 * Link a Parent's Firebase Auth UID to a Student document
 */
export async function linkParentToStudent(
  studentId: string, 
  parentUid: string, 
  parentEmail?: string
): Promise<void> {
  const collectionPath = 'students';
  try {
    const ref = doc(db, collectionPath, studentId);
    await setDoc(ref, {
      parentUid: parentUid.trim(),
      parentId: parentUid.trim(),
      ...(parentEmail ? { parentEmail: parentEmail.trim() } : {}),
      updatedAt: serverTimestamp()
    }, { merge: true });
    console.log(`[linkParentToStudent] Linked student ${studentId} with parentUid: ${parentUid}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${collectionPath}/${studentId}`);
  }
}

/**
 * Update student profile information in Firestore
 */
export async function updateStudentProfileFirestore(
  studentId: string,
  profile: {
    nickname?: string;
    photoUrl?: string;
    address?: string;
    parentUid?: string;
    parentEmail?: string;
  }
): Promise<void> {
  const collectionPath = 'students';
  try {
    const ref = doc(db, collectionPath, studentId);
    const updatePayload: Record<string, any> = {
      updatedAt: serverTimestamp()
    };
    if (profile.nickname !== undefined) updatePayload.nickname = profile.nickname;
    if (profile.photoUrl !== undefined) updatePayload.photoUrl = profile.photoUrl;
    if (profile.address !== undefined) updatePayload['homeLocation.address'] = profile.address;
    if (profile.parentUid !== undefined) {
      updatePayload.parentUid = profile.parentUid.trim();
      updatePayload.parentId = profile.parentUid.trim();
    }
    if (profile.parentEmail !== undefined) {
      updatePayload.parentEmail = profile.parentEmail.trim();
    }
    await updateDoc(ref, updatePayload);
  } catch (error) {
    console.warn(`[updateStudentProfileFirestore] Notice: Firestore update handled:`, error);
  }
}

/**
 * Gate Attendance Persistence
 */
export async function saveGateAttendanceRecordFirestore(record: GateAttendanceRecord): Promise<void> {
  const collectionPath = 'gate_attendance_logs';
  try {
    const ref = doc(db, collectionPath, record.id);
    await setDoc(ref, {
      ...record,
      createdAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.warn('[saveGateAttendanceRecordFirestore] Firestore notice:', error);
  }
}

/**
 * Detailed Leave Requests Persistence
 */
export async function saveDetailedLeaveRequestFirestore(request: DetailedLeaveRequest): Promise<void> {
  const collectionPath = 'detailed_leave_requests';
  try {
    const ref = doc(db, collectionPath, request.id);
    await setDoc(ref, {
      ...request,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.warn('[saveDetailedLeaveRequestFirestore] Firestore notice:', error);
  }
}

export async function updateDetailedLeaveStatusFirestore(id: string, status: 'APPROVED' | 'REJECTED', remarks?: string): Promise<void> {
  const collectionPath = 'detailed_leave_requests';
  try {
    const ref = doc(db, collectionPath, id);
    await updateDoc(ref, {
      status,
      teacherRemarks: remarks || '',
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.warn('[updateDetailedLeaveStatusFirestore] Firestore notice:', error);
  }
}

/**
 * GPS Check-in Logs & Geofence Config Persistence
 */
export async function saveGPSCheckInLogFirestore(log: GPSCheckInLog): Promise<void> {
  const collectionPath = 'gps_check_in_logs';
  try {
    const ref = doc(db, collectionPath, log.id);
    await setDoc(ref, {
      ...log,
      createdAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.warn('[saveGPSCheckInLogFirestore] Firestore notice:', error);
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Department config (department_config) — กลุ่มสาระฯ/กลุ่มงาน จัดการโดยแอดมิน
 * ──────────────────────────────────────────────────────────────────────────── */
export async function saveDepartmentConfig(dept: {
  id: string; name: string; order?: number; kind?: string; parentId?: string | null; active?: boolean;
  backupApproverUid?: string | null; backupApproverName?: string | null;
}): Promise<void> {
  try {
    const payload: Record<string, unknown> = {
      name: dept.name,
      order: dept.order ?? 999,
      kind: dept.kind ?? 'LEARNING_AREA',
      parentId: dept.parentId ?? null,
      active: dept.active ?? true,
      updatedAt: serverTimestamp(),
    };
    // TASK 4: ผู้รับผิดชอบสำรอง — ใส่เฉพาะตอนมีการส่งค่ามาจริง (undefined) ไม่งั้น merge:true จะไม่แตะ
    // field เดิม ทำให้ saveEdit/addNew ที่ไม่ได้ตั้งใจแก้ backupApprover ไม่เผลอไปเคลียร์ค่าที่ตั้งไว้แล้ว
    if (dept.backupApproverUid !== undefined) payload.backupApproverUid = dept.backupApproverUid;
    if (dept.backupApproverName !== undefined) payload.backupApproverName = dept.backupApproverName;
    await setDoc(doc(db, 'department_config', dept.id), payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `department_config/${dept.id}`);
  }
}

/** soft-delete (active:false) — ไม่ลบจริงเพื่อไม่ให้ข้อมูลอ้างอิงเดิม (staff.departmentId) เสีย */
export async function deactivateDepartmentConfig(id: string): Promise<void> {
  try {
    await setDoc(doc(db, 'department_config', id), { active: false, updatedAt: serverTimestamp() }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `department_config/${id}`);
  }
}

/**
 * real-time listener สำหรับ gps_check_in_logs ของวันหนึ่ง
 * ครูที่ปรึกษาใช้ดูว่านักเรียนคนไหนเช็คอินเข้าโรงเรียนด้วย GPS จากพิกัดไหน เวลาไหน
 * (HOMEROOM_TEACHER อ่านได้ตาม firestore.rules)
 */
export function subscribeGpsCheckInLogsByDate(
  dateStr: string,
  onUpdate: (logs: GPSCheckInLog[]) => void
): () => void {
  try {
    const q = query(collection(db, 'gps_check_in_logs'), where('date', '==', dateStr));
    return onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as GPSCheckInLog));
      list.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
      onUpdate(list);
    }, (error) => {
      console.warn('[subscribeGpsCheckInLogsByDate] Listener error:', error.message);
      onUpdate([]);
    });
  } catch (error) {
    console.warn('[subscribeGpsCheckInLogsByDate] Setup error:', error);
    return () => {};
  }
}

export async function saveSchoolGeofenceConfigFirestore(config: SchoolGeofenceConfig): Promise<void> {
  const collectionPath = 'school_settings';
  try {
    const ref = doc(db, collectionPath, 'geofence_config');
    await setDoc(ref, {
      ...config,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.warn('[saveSchoolGeofenceConfigFirestore] Firestore notice:', error);
  }
}

/**
 * Substitute Teaching & Post-Teaching Persistence
 */
/** ลบ key ที่มีค่า undefined ออก (Firestore ไม่รับ undefined) */
function stripUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}

export async function saveSubstituteAssignmentFirestore(assignment: SubstituteAssignment): Promise<void> {
  const collectionPath = 'substitute_assignments';
  try {
    const ref = doc(db, collectionPath, assignment.id);
    await setDoc(ref, {
      ...stripUndefined(assignment),
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${collectionPath}/${assignment.id}`);
  }
}

/** อัปเดตเฉพาะบาง field ของเอกสารสอนแทน (ใช้ตอนอนุมัติ/ปฏิเสธ/บันทึกหลังสอน) */
export async function updateSubstituteAssignmentFirestore(
  id: string,
  patch: Partial<SubstituteAssignment>
): Promise<void> {
  const collectionPath = 'substitute_assignments';
  try {
    const ref = doc(db, collectionPath, id);
    await setDoc(ref, {
      ...stripUndefined(patch as Record<string, any>),
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${collectionPath}/${id}`);
  }
}

/** เขียนคู่แลกคาบสอน (swapMode 'SWAP') 2 document พร้อมกันแบบ atomic — ถ้าฝั่งใดฝั่งหนึ่งล้มเหลว
 *  ทั้งคู่จะไม่ถูกเขียนเลย กันเอกสารกำพร้า (ผูกกันด้วย linkedSwapId ที่ตั้งไว้ก่อนเรียกฟังก์ชันนี้แล้ว) */
export async function saveSubstituteSwapPairFirestore(legA: SubstituteAssignment, legB: SubstituteAssignment): Promise<void> {
  const collectionPath = 'substitute_assignments';
  try {
    const { writeBatch } = await import('firebase/firestore');
    const batch = writeBatch(db);
    batch.set(doc(db, collectionPath, legA.id), { ...stripUndefined(legA), updatedAt: serverTimestamp() }, { merge: true });
    batch.set(doc(db, collectionPath, legB.id), { ...stripUndefined(legB), updatedAt: serverTimestamp() }, { merge: true });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${collectionPath}/${legA.id}+${legB.id}`);
  }
}

/** อัปเดตหลาย document พร้อมกันแบบ atomic — ใช้ตอนยืนยัน/ปฏิเสธคู่แลกคาบที่ต้อง cascade ไปอีกฝั่ง */
export async function updateSubstituteAssignmentsBatchFirestore(
  patches: { id: string; patch: Partial<SubstituteAssignment> }[]
): Promise<void> {
  const collectionPath = 'substitute_assignments';
  try {
    const { writeBatch } = await import('firebase/firestore');
    const batch = writeBatch(db);
    patches.forEach(({ id, patch }) => {
      batch.set(doc(db, collectionPath, id), { ...stripUndefined(patch as Record<string, any>), updatedAt: serverTimestamp() }, { merge: true });
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${collectionPath}/batch(${patches.map(p => p.id).join(',')})`);
  }
}

export function subscribeSubstituteAssignments(onUpdate: (assignments: SubstituteAssignment[]) => void): () => void {
  const collectionPath = 'substitute_assignments';
  try {
    const ref = collection(db, collectionPath);
    return onSnapshot(ref, (snapshot) => {
      const list: SubstituteAssignment[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as SubstituteAssignment);
      });
      onUpdate(list);
    }, (error) => {
      console.warn('[subscribeSubstituteAssignments] Listener error:', error);
    });
  } catch (error) {
    console.warn('[subscribeSubstituteAssignments] Setup error:', error);
    return () => {};
  }
}

export function subscribePostTeachingRecords(onUpdate: (records: PostTeachingRecord[]) => void): () => void {
  const collectionPath = 'post_teaching_records';
  try {
    const ref = collection(db, collectionPath);
    return onSnapshot(ref, (snapshot) => {
      const list: PostTeachingRecord[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as PostTeachingRecord);
      });
      onUpdate(list);
    }, (error) => {
      console.warn('[subscribePostTeachingRecords] Listener error:', error);
    });
  } catch (error) {
    console.warn('[subscribePostTeachingRecords] Setup error:', error);
    return () => {};
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Late Attendance Requests — ครูขอเช็คชื่อย้อนหลัง (Firestore: late_attendance_requests)
 * ผู้อนุมัติ: DEPUTY_DIRECTOR_ACADEMIC / SUPER_ADMIN
 * ไม่ลบ document ตอนอนุมัติ/ปฏิเสธ — merge เปลี่ยนแค่ status เพื่อเก็บประวัติ
 * ──────────────────────────────────────────────────────────────────────────── */

const LATE_ATTENDANCE_COL = 'late_attendance_requests';

export async function submitLateAttendanceRequestFirestore(
  req: Omit<LateAttendanceRequestRecord,
    'id' | 'status' | 'requestedAt' | 'approverUid' | 'approverName' | 'decidedAt' | 'rejectReason'>
): Promise<string> {
  // random id → ทุกครั้งที่ยื่นคือ create ใหม่ (rule อนุญาตให้ครู create ของตัวเองเท่านั้น)
  const id = `lar_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const ref = doc(db, LATE_ATTENDANCE_COL, id);
  const payload: LateAttendanceRequestRecord = {
    ...(stripUndefined(req as Record<string, any>) as any),
    id,
    status: 'PENDING',
    requestedAt: new Date().toISOString(),
    approverUid: null,
    approverName: null,
    decidedAt: null,
    rejectReason: null,
  };
  try {
    await setDoc(ref, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `${LATE_ATTENDANCE_COL}/${id}`);
  }
  return id;
}

export async function decideLateAttendanceRequestFirestore(
  id: string,
  decision: 'APPROVED' | 'REJECTED',
  approver: { uid: string; name: string },
  rejectReason?: string
): Promise<void> {
  const ref = doc(db, LATE_ATTENDANCE_COL, id);
  try {
    // merge — เก็บ field เดิม (teacherId/scheduleId/reason ฯลฯ) ไว้ครบ เปลี่ยนแค่สถานะ
    await setDoc(ref, {
      status: decision,
      approverUid: approver.uid,
      approverName: approver.name,
      decidedAt: new Date().toISOString(),
      rejectReason: decision === 'REJECTED' ? (rejectReason || 'ไม่ระบุเหตุผล') : null,
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${LATE_ATTENDANCE_COL}/${id}`);
  }
}

/** real-time listener; ส่ง filter.teacherId เพื่อดูเฉพาะคำขอของครูคนนั้น (ผ่าน firestore.rules) */
export function subscribeLateAttendanceRequests(
  onUpdate: (reqs: LateAttendanceRequestRecord[]) => void,
  filter?: { teacherId?: string }
): () => void {
  try {
    const col = collection(db, LATE_ATTENDANCE_COL);
    const ref = filter?.teacherId ? query(col, where('teacherId', '==', filter.teacherId)) : col;
    return onSnapshot(ref, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as LateAttendanceRequestRecord));
      list.sort((a, b) => (b.requestedAt || '').localeCompare(a.requestedAt || ''));
      onUpdate(list);
    }, (error) => {
      console.warn('[subscribeLateAttendanceRequests] Listener error:', error.message);
    });
  } catch (error) {
    console.warn('[subscribeLateAttendanceRequests] Setup error:', error);
    return () => {};
  }
}

export function subscribeStaffList(onUpdate: (staff: UserProfile[]) => void): () => void {
  const collectionPath = 'staff';
  try {
    const ref = collection(db, collectionPath);
    return onSnapshot(ref, (snapshot) => {
      const list: UserProfile[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as UserProfile);
      });
      onUpdate(list);
    }, (error) => {
      console.warn('[subscribeStaffList] Listener error:', error);
    });
  } catch (error) {
    console.warn('[subscribeStaffList] Setup error:', error);
    return () => {};
  }
}

export async function savePostTeachingRecordFirestore(record: PostTeachingRecord): Promise<void> {
  const collectionPath = 'post_teaching_records';
  const docId = `${record.courseId}_${record.date}`;
  try {
    const ref = doc(db, collectionPath, docId);
    await setDoc(ref, {
      ...stripUndefined(record as Record<string, any>),
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.warn('[savePostTeachingRecordFirestore] Firestore notice:', error);
  }
}

/**
 * Mental Health Screenings & SDQ Persistence
 *
 * FIX: ทั้ง 3 ฟังก์ชันนี้เดิม catch แล้ว console.warn เงียบๆ โดยไม่ throw ต่อ — ทำให้ permission-denied
 * จริง (เช่นตอน rules ปฏิเสธ) มองไม่เห็นจากฝั่งเรียกใช้เลย ส่วน store.ts ก็ยัง set optimistic state
 * ต่อไปเหมือนเดิมไม่ว่าการเขียนจริงจะสำเร็จหรือไม่ ผู้ใช้เห็น "บันทึกสำเร็จ" ปลอมทั้งที่ Firestore
 * ปฏิเสธจริง — เปลี่ยนให้ throw ต่อผ่าน handleFirestoreError (pattern เดียวกับฟังก์ชันอื่นในไฟล์นี้)
 * เพื่อให้ store.ts รอผลจริงก่อนอัปเดต state/แสดงข้อความสำเร็จ
 */
export async function save2QScreeningFirestore(studentId: string, screening: TwoQuestionScreening): Promise<void> {
  const collectionPath = 'student_screenings_2q';
  try {
    const ref = doc(db, collectionPath, studentId);
    await setDoc(ref, {
      ...screening,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${collectionPath}/${studentId}`);
  }
}

export async function savePHQ9ScreeningFirestore(studentId: string, screening: PHQ9Screening): Promise<void> {
  const collectionPath = 'student_screenings_phq9';
  try {
    const ref = doc(db, collectionPath, studentId);
    await setDoc(ref, {
      ...screening,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${collectionPath}/${studentId}`);
  }
}

export async function saveSDQAssessmentFirestore(sdq: SDQAssessment): Promise<void> {
  const collectionPath = 'student_assessments_sdq';
  try {
    const ref = doc(db, collectionPath, sdq.id);
    await setDoc(ref, {
      ...sdq,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${collectionPath}/${sdq.id}`);
  }
}

/** real-time listener ของผลประเมิน SDQ ของนักเรียนคนเดียว — ใช้แสดง "3 มุมมอง" (ตนเอง/ครู/ผู้ปกครอง)
 *  ใน HealthMentalWellbeingModule.tsx แทนการอ่านจาก state.sdqAssessments ของ Zustand (เดิมไม่เคยมี
 *  listener ผูกไว้เลย ว่างเปล่าเสมอไม่ว่าจะ submit เท่าไหร่)
 *  - { studentUid } → นักเรียนเจ้าของเห็นครบทั้ง 3 มุมมอง (rules อนุญาตผ่าน studentUid==auth.uid)
 *  - { respondentUid } → ผู้ปกครอง/ครูเห็นเฉพาะรายการที่ตัวเองเป็นคนกรอก (rules ยังไม่เปิดให้เห็น
 *    มุมมองอื่นของครอบครัวเดียวกัน — เป็นการตัดสินใจ scope แบบระมัดระวังไว้ก่อน ดูคำอธิบายในคำตอบ) */
export function subscribeSDQAssessments(
  onUpdate: (assessments: SDQAssessment[]) => void,
  filter: { studentUid?: string; respondentUid?: string }
): () => void {
  try {
    const col = collection(db, 'student_assessments_sdq');
    const clauses = [];
    if (filter.studentUid) clauses.push(where('studentUid', '==', filter.studentUid));
    if (filter.respondentUid) clauses.push(where('respondentUid', '==', filter.respondentUid));
    if (clauses.length === 0) { onUpdate([]); return () => {}; }
    return onSnapshot(query(col, ...clauses), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as SDQAssessment));
      list.sort((a, b) => (b.assessmentDate || '').localeCompare(a.assessmentDate || ''));
      onUpdate(list);
    }, (error) => {
      console.warn('[subscribeSDQAssessments] listener error:', error.message);
      onUpdate([]);
    });
  } catch (error) {
    console.warn('[subscribeSDQAssessments] setup error:', error);
    return () => {};
  }
}

/**
 * Parent Engagement Persistence (Billing, Messages, Appointments)
 *
 * ขอบเขตงานจริง (ยืนยันจากโรงเรียน): "แจ้งค่าใช้จ่าย + ส่งใบเสร็จ เท่านั้น" ไม่ใช่ระบบบัญชีเต็มรูปแบบ
 */
const BILLING_INVOICES_COL = 'billing_invoices';
const BILLING_COUNTERS_COL = 'billing_counters';

/** ปีการศึกษาปัจจุบัน (พ.ศ.) — namespace ของเลขที่ใบแจ้งหนี้ต่อปี (เช่น "2569") */
export function getCurrentAcademicYear(): string {
  return String(new Date().getFullYear() + 543);
}

/** QR mockup ผูกกับเลขที่ใบแจ้งหนี้จริง (ไม่ใช่ EMVCo PromptPay payload จริง — นอกขอบเขตงานนี้
 *  ที่ยืนยันแค่ "แจ้งค่าใช้จ่าย + ส่งใบเสร็จ" ไม่ใช่ระบบเชื่อมธนาคารจริง — คงรูปแบบ mock เดิมที่มีอยู่
 *  ในระบบไว้ แค่ทำให้ REF ที่ฝังในภาพตรงกับเลขที่ auditable จริงแทนเลขปลอมตายตัว) */
function buildPromptPayQrMock(invoiceNumber: string, amount: number): string {
  const payload = `PROMPTPAY-MOCK|REF:${invoiceNumber}|AMOUNT:${amount.toFixed(2)}`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(payload)}`;
}

export type CreateInvoiceInput = Pick<BillingInvoice, 'studentId' | 'title' | 'items' | 'totalAmount' | 'dueDate'> & {
  studentUid: string | null;
  parentUid: string | null;
};

/**
 * สร้างใบแจ้งหนี้ 1 ใบ พร้อมออกเลขที่ auditable จริงผ่าน billing_counters/{ปีการศึกษา}
 * FIX: เดิมไม่มีฟีเจอร์นี้อยู่เลยในระบบ (เส้นทางสร้าง→แสดง→จ่าย ใช้งานจริงไม่ได้แม้แต่ขั้นตอนเดียว)
 * และ receiptNo เดิม (ใน payBillingInvoiceFirestore) ใช้ Math.random() — ตรวจสอบย้อนหลังไม่ได้
 *
 * อ่าน+เพิ่ม counter ในธุรกรรมเดียวกับการเขียนเอกสารจริงเสมอ (กันเลขซ้ำ/กระโดดข้ามจาก race
 * condition) — pattern เดียวกับ enrollInActivity ที่พิสูจน์แล้วว่าได้ผลจริงกับระบบสมัครชุมนุม
 */
export async function createBillingInvoice(
  data: CreateInvoiceInput,
  createdBy: string,
  firestoreDb: Firestore = db,
): Promise<string> {
  const academicYear = getCurrentAcademicYear();
  const counterRef = doc(firestoreDb, BILLING_COUNTERS_COL, academicYear);
  const invoiceId = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const invoiceRef = doc(firestoreDb, BILLING_INVOICES_COL, invoiceId);
  try {
    await runTransaction(firestoreDb, async (transaction) => {
      // อ่านก่อนเขียนเสมอ (ข้อกำหนดของ Firestore transaction)
      const counterSnap = await transaction.get(counterRef);
      const nextNumber = (counterSnap.exists() ? Number((counterSnap.data() as any).lastNumber) || 0 : 0) + 1;
      const invoiceNumber = `INV-${academicYear}-${String(nextNumber).padStart(4, '0')}`;

      const payload: BillingInvoice = {
        id: invoiceId,
        invoiceNumber,
        studentId: data.studentId,
        studentUid: data.studentUid,
        parentUid: data.parentUid,
        title: data.title,
        items: data.items,
        totalAmount: data.totalAmount,
        dueDate: data.dueDate,
        status: 'PENDING',
        promptPayQr: buildPromptPayQrMock(invoiceNumber, data.totalAmount),
        createdBy,
        createdAt: new Date().toISOString(),
      };

      transaction.set(invoiceRef, payload);
      transaction.set(counterRef, { academicYear, lastNumber: nextNumber, updatedAt: serverTimestamp() }, { merge: true });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `${BILLING_INVOICES_COL}/${invoiceId}`);
  }
  return invoiceId;
}

/**
 * สร้างใบแจ้งหนี้แบบเดียวกันให้หลายนักเรียนพร้อมกัน (เช่น ค่าเทอมทั้งห้อง/ทั้งโรงเรียน) — จองเลขที่
 * ต่อเนื่องเป็นชุดในธุรกรรมเดียวกันทั้งชุด (อ่าน counter ครั้งเดียว เพิ่มทีละ 1 ต่อคนในชุด แล้วเขียน
 * ค่า counter สุดท้ายครั้งเดียว) แบ่งเป็นชุดละไม่เกิน 400 รายการต่อธุรกรรม (Firestore จำกัด 500
 * การเขียนต่อธุรกรรม — เผื่อพื้นที่ไว้สำหรับ counter write) รันทีละชุดตามลำดับเพื่อความปลอดภัย
 */
export async function createBillingInvoicesBulk(
  targets: { studentId: string; studentUid: string | null; parentUid: string | null }[],
  common: Pick<BillingInvoice, 'title' | 'items' | 'totalAmount' | 'dueDate'>,
  createdBy: string,
  firestoreDb: Firestore = db,
): Promise<string[]> {
  const academicYear = getCurrentAcademicYear();
  const counterRef = doc(firestoreDb, BILLING_COUNTERS_COL, academicYear);
  const allIds: string[] = [];
  const CHUNK_SIZE = 400;

  for (let i = 0; i < targets.length; i += CHUNK_SIZE) {
    const chunk = targets.slice(i, i + CHUNK_SIZE);
    try {
      await runTransaction(firestoreDb, async (transaction) => {
        const counterSnap = await transaction.get(counterRef);
        let nextNumber = counterSnap.exists() ? Number((counterSnap.data() as any).lastNumber) || 0 : 0;
        const now = new Date().toISOString();

        chunk.forEach((target, idx) => {
          nextNumber += 1;
          const invoiceId = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${idx}`;
          const invoiceNumber = `INV-${academicYear}-${String(nextNumber).padStart(4, '0')}`;
          const invoiceRef = doc(firestoreDb, BILLING_INVOICES_COL, invoiceId);
          const payload: BillingInvoice = {
            id: invoiceId,
            invoiceNumber,
            studentId: target.studentId,
            studentUid: target.studentUid,
            parentUid: target.parentUid,
            title: common.title,
            items: common.items,
            totalAmount: common.totalAmount,
            dueDate: common.dueDate,
            status: 'PENDING',
            promptPayQr: buildPromptPayQrMock(invoiceNumber, common.totalAmount),
            createdBy,
            createdAt: now,
          };
          transaction.set(invoiceRef, payload);
          allIds.push(invoiceId);
        });

        transaction.set(counterRef, { academicYear, lastNumber: nextNumber, updatedAt: serverTimestamp() }, { merge: true });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `${BILLING_INVOICES_COL} (bulk chunk starting at index ${i})`);
    }
  }
  return allIds;
}

/**
 * real-time listener ของใบแจ้งหนี้
 *  - ไม่ระบุ filter → FINANCE_STAFF/SUPER_ADMIN เห็นทั้งโรงเรียน (rules อนุญาตอ่านทั้ง collection)
 *  - { studentUid } → นักเรียนดูของตัวเอง (ต้อง filter ฝั่ง query ให้ผ่าน rules)
 *  - { parentUid }  → ผู้ปกครองดูของบุตรหลาน (ต้อง filter ฝั่ง query ให้ผ่าน rules)
 */
export function subscribeBillingInvoices(
  onUpdate: (invoices: BillingInvoice[]) => void,
  filter: { studentUid?: string; parentUid?: string } = {}
): () => void {
  try {
    const col = collection(db, BILLING_INVOICES_COL);
    const clauses = [];
    if (filter.studentUid) clauses.push(where('studentUid', '==', filter.studentUid));
    if (filter.parentUid) clauses.push(where('parentUid', '==', filter.parentUid));
    const ref = clauses.length > 0 ? query(col, ...clauses) : col;
    return onSnapshot(ref, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as BillingInvoice));
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      onUpdate(list);
    }, (error) => {
      console.warn('[subscribeBillingInvoices] listener error:', error.message);
      onUpdate([]);
    });
  } catch (error) {
    console.warn('[subscribeBillingInvoices] setup error:', error);
    return () => {};
  }
}

export async function payBillingInvoiceFirestore(invoiceId: string, receiptNo: string): Promise<void> {
  const collectionPath = 'billing_invoices';
  try {
    const ref = doc(db, collectionPath, invoiceId);
    await setDoc(ref, {
      status: 'PAID',
      receiptNo,
      paidAt: new Date().toISOString(),
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.warn('[payBillingInvoiceFirestore] Firestore notice:', error);
  }
}

export async function sendParentTeacherMessageFirestore(msg: ParentTeacherMessage): Promise<void> {
  const collectionPath = 'parent_teacher_messages';
  try {
    const ref = doc(db, collectionPath, msg.id);
    await setDoc(ref, {
      ...msg,
      createdAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.warn('[sendParentTeacherMessageFirestore] Firestore notice:', error);
  }
}

export async function bookParentAppointmentFirestore(appointment: ParentAppointment): Promise<void> {
  const collectionPath = 'parent_appointments';
  try {
    const ref = doc(db, collectionPath, appointment.id);
    await setDoc(ref, {
      ...appointment,
      createdAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.warn('[bookParentAppointmentFirestore] Firestore notice:', error);
  }
}

/**
 * Active Learning Points & Logs Persistence
 */
export async function saveActiveLearningLogFirestore(record: ActiveLearningRecord): Promise<void> {
  const collectionPath = 'active_learning_logs';
  try {
    const ref = doc(db, collectionPath, record.id);
    await setDoc(ref, {
      ...record,
      createdAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.warn('[saveActiveLearningLogFirestore] Firestore notice:', error);
  }
}

/**
 * Real-time listener สำหรับ active_learning_logs ทั้งหมด — ใช้ใน ClassroomLeaderboard
 * เพื่อให้กระดานคะแนนแสดงข้อมูลจริงจาก Firestore (เดิมอ่านจาก Zustand store ที่ว่างเมื่อ
 * เปิดหน้าใหม่/ล็อกอินใหม่ → กระดานว่างทั้งที่มี log จริง)
 */
export function subscribeActiveLearningLogs(
  callback: (records: ActiveLearningRecord[]) => void
): () => void {
  try {
    const ref = collection(db, 'active_learning_logs');
    return onSnapshot(ref, (snapshot) => {
      const rows = snapshot.docs.map(d => {
        const data = d.data() as any;
        return {
          id: d.id,
          studentId: String(data.studentId || ''),
          courseId: data.courseId || undefined,
          points: Number(data.points || 0),
          category: data.category || 'GENERAL',
          note: data.note || undefined,
          awardedAt: data.awardedAt || '',
        } as ActiveLearningRecord;
      });
      callback(rows);
    }, (error) => {
      console.warn('[subscribeActiveLearningLogs] Listener error:', error.message);
      callback([]);
    });
  } catch (error) {
    console.warn('[subscribeActiveLearningLogs] Setup error:', error);
    return () => {};
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Student Portfolio Entries (student_portfolio_entries)
 * นักเรียนบันทึกผลงานเอง (รางวัล/อบรม/ฝึกงาน/จิตอาสา) → ครูที่ปรึกษาอนุมัติ
 * ก่อนแสดงให้ผู้ปกครอง/แดชบอร์ดวิชาการ. ไม่ลบ doc — merge เปลี่ยนแค่ฟิลด์รีวิว
 * ──────────────────────────────────────────────────────────────────────────── */

const PORTFOLIO_COL = 'student_portfolio_entries';

/** นักเรียนสร้างรายการใหม่ (status ต้องเป็น PENDING — firestore.rules บังคับ) */
export async function submitStudentPortfolioEntry(
  entry: Pick<StudentPortfolioEntry,
    'studentId' | 'studentUid' | 'homeroomClass' | 'parentUid' | 'type' | 'title' | 'description' | 'entryDate'> &
    Partial<Pick<StudentPortfolioEntry, 'attachmentUrl'>>
): Promise<string> {
  const id = `pfe_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const payload: StudentPortfolioEntry = {
    id,
    studentId: entry.studentId,
    studentUid: entry.studentUid,
    homeroomClass: entry.homeroomClass,
    parentUid: entry.parentUid ?? null,
    type: entry.type,
    title: entry.title,
    description: entry.description,
    entryDate: entry.entryDate,
    submittedAt: new Date().toISOString(),
    attachmentUrl: entry.attachmentUrl ?? null,
    status: 'PENDING',
    reviewedBy: null,
    reviewedByName: null,
    reviewedAt: null,
    rejectReason: null,
  };
  try {
    await setDoc(doc(db, PORTFOLIO_COL, id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `${PORTFOLIO_COL}/${id}`);
  }
  return id;
}

/** ครูที่ปรึกษาอนุมัติ/ปฏิเสธ — merge เฉพาะฟิลด์รีวิว (rule ไม่ยอมให้แก้เนื้อหา) */
export async function decideStudentPortfolioEntry(
  id: string,
  decision: 'APPROVED' | 'REJECTED',
  reviewer: { uid: string; name: string },
  rejectReason?: string
): Promise<void> {
  try {
    await setDoc(doc(db, PORTFOLIO_COL, id), {
      status: decision,
      reviewedBy: reviewer.uid,
      reviewedByName: reviewer.name,
      reviewedAt: new Date().toISOString(),
      rejectReason: decision === 'REJECTED' ? (rejectReason || 'ไม่ระบุเหตุผล') : null,
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${PORTFOLIO_COL}/${id}`);
  }
}

/**
 * real-time listener. เลือก filter ตามผู้ใช้ (ต้อง filter ฝั่ง query ให้ผ่าน firestore.rules):
 *  - { studentUid }             → นักเรียนดูของตัวเอง (ทุกสถานะ)
 *  - { homeroomClass }          → ครูที่ปรึกษาดูทั้งห้อง (ทุกสถานะ)
 *  - { parentUid, approvedOnly } → ผู้ปกครองดูของบุตรหลาน (เฉพาะ APPROVED)
 */
export function subscribeStudentPortfolioEntries(
  onUpdate: (entries: StudentPortfolioEntry[]) => void,
  filter: { studentUid?: string; homeroomClass?: string; parentUid?: string; approvedOnly?: boolean }
): () => void {
  try {
    const col = collection(db, PORTFOLIO_COL);
    const clauses = [];
    if (filter.studentUid) clauses.push(where('studentUid', '==', filter.studentUid));
    if (filter.homeroomClass) clauses.push(where('homeroomClass', '==', filter.homeroomClass));
    if (filter.parentUid) clauses.push(where('parentUid', '==', filter.parentUid));
    if (filter.approvedOnly) clauses.push(where('status', '==', 'APPROVED'));
    if (clauses.length === 0) { onUpdate([]); return () => {}; }
    return onSnapshot(query(col, ...clauses), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as StudentPortfolioEntry));
      list.sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
      onUpdate(list);
    }, (error) => {
      console.warn('[subscribeStudentPortfolioEntries] Listener error:', error.message);
      onUpdate([]);
    });
  } catch (error) {
    console.warn('[subscribeStudentPortfolioEntries] Setup error:', error);
    return () => {};
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Student Home Locations (student_home_locations/{studentId})
 * พิกัด GPS + ภาพบ้าน — อ่อนไหว: เจ้าของ + ครูที่ปรึกษาห้องนั้น + SUPER_ADMIN เท่านั้น
 * doc id = studentId (บ้านเดียวต่อคน, upsert)
 * ──────────────────────────────────────────────────────────────────────────── */

const HOME_LOCATION_COL = 'student_home_locations';

export async function saveStudentHomeLocation(
  loc: Omit<StudentHomeLocation, 'id' | 'updatedAt'>
): Promise<void> {
  const payload: StudentHomeLocation = {
    ...loc,
    id: loc.studentId,
    landmarkNotes: loc.landmarkNotes ?? null,
    accuracy: loc.accuracy ?? null,
    updatedAt: new Date().toISOString(),
  };
  try {
    await setDoc(doc(db, HOME_LOCATION_COL, loc.studentId), payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${HOME_LOCATION_COL}/${loc.studentId}`);
  }
}

/** นักเรียนดูพิกัดบ้านของตัวเอง (single doc) */
export function subscribeStudentHomeLocation(
  studentId: string,
  onUpdate: (loc: StudentHomeLocation | null) => void
): () => void {
  try {
    return onSnapshot(doc(db, HOME_LOCATION_COL, studentId), (snap) => {
      onUpdate(snap.exists() ? ({ id: snap.id, ...snap.data() } as StudentHomeLocation) : null);
    }, (error) => {
      console.warn('[subscribeStudentHomeLocation] Listener error:', error.message);
      onUpdate(null);
    });
  } catch (error) {
    console.warn('[subscribeStudentHomeLocation] Setup error:', error);
    return () => {};
  }
}

/** ครูที่ปรึกษาดูพิกัดบ้านนักเรียนทั้งห้อง (query by homeroomClass — ผ่าน firestore.rules) */
export function subscribeStudentHomeLocationsByRoom(
  homeroomClass: string,
  onUpdate: (locs: StudentHomeLocation[]) => void
): () => void {
  try {
    const q = query(collection(db, HOME_LOCATION_COL), where('homeroomClass', '==', homeroomClass));
    return onSnapshot(q, (snap) => {
      onUpdate(snap.docs.map(d => ({ id: d.id, ...d.data() } as StudentHomeLocation)));
    }, (error) => {
      console.warn('[subscribeStudentHomeLocationsByRoom] Listener error:', error.message);
      onUpdate([]);
    });
  } catch (error) {
    console.warn('[subscribeStudentHomeLocationsByRoom] Setup error:', error);
    return () => {};
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Elective activities (ชุมนุม/กิจกรรมตามความสนใจ) — elective_activities_config +
 * activity_enrollments + activity_enrollment_counts
 *
 * ออกแบบใหม่: แอดมินงานชุมนุมสร้างชื่อ+จำนวนรับ+ครูรับผิดชอบเองตรงๆ ไม่ผูกกับ subjectCode/
 * scheduleId ที่ import จากตารางสอนอีกต่อไป (ของเดิมดึงจาก schedules ซึ่งทุกคาบ "กิจกรรมชุมนุม"
 * ของทุกครูใช้ชื่อกลางเดียวกันหมด แยกชุมนุมจริงไม่ได้) — 1 ชุมนุม = 1 โควตาที่นั่งเดียว ไม่มี
 * concept "หลาย section" อีกต่อไป
 *
 * capacity ตรวจสอบแบบ atomic ผ่าน "ตัวนับ" แยก (activity_enrollment_counts/{activityId})
 * ไม่ใช่การนับจาก activity_enrollments ตรงๆ เพราะ Firestore Transaction.get() รับได้แค่
 * DocumentReference เดียว query ข้าม document ไม่ได้ — ตัวนับนี้ sync คู่กับ enrollment เสมอ
 * ในทรานแซกชันเดียวกัน (อ่าน-ตรวจ-เขียนพร้อมกัน) ทำให้ 2 คนแย่งที่นั่งสุดท้ายพร้อมกัน มีแค่คนเดียว
 * ที่ transaction สำเร็จจริง (อีกคน retry แล้วเห็นค่านับใหม่ที่เต็มแล้ว จึงถูก throw error)
 *
 * ทุกฟังก์ชันรับ `firestoreDb` เป็น parameter เสริม (default = db ของแอปจริง) เพื่อให้ทดสอบผ่าน
 * Firebase Emulator จริงได้ตรงๆ (ส่ง context.firestore() จาก @firebase/rules-unit-testing เข้ามา)
 * โดยไม่ต้องเขียนตรรกะซ้ำในเทสต์ — ดู src/__tests__/firestore.rules.test.ts
 * ──────────────────────────────────────────────────────────────────────────── */

/** สร้างชุมนุมใหม่ — auto id (ไม่ผูกกับ subjectCode อีกต่อไป) คืนค่า id ที่สร้างให้เรียกใช้ต่อได้ */
export async function createElectiveActivity(
  config: {
    name: string; capacity: number;
    responsibleTeacherUids: string[]; responsibleTeacherNames: string[];
    dayOfWeek?: string | null; periodNumber?: number | null; room?: string | null;
    enrollmentStatus?: 'OPEN' | 'CLOSED';
    createdBy: string;
  },
  firestoreDb: Firestore = db,
): Promise<string> {
  const ref = doc(collection(firestoreDb, 'elective_activities_config'));
  try {
    await setDoc(ref, {
      id: ref.id,
      name: config.name,
      capacity: config.capacity,
      responsibleTeacherUids: config.responsibleTeacherUids,
      responsibleTeacherNames: config.responsibleTeacherNames,
      dayOfWeek: config.dayOfWeek ?? null,
      periodNumber: config.periodNumber ?? null,
      room: config.room ?? null,
      enrollmentStatus: config.enrollmentStatus ?? 'OPEN',
      createdBy: config.createdBy,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `elective_activities_config/${ref.id}`);
  }
  return ref.id;
}

/** แก้ไขชุมนุมที่มีอยู่ (ชื่อ/จำนวนรับ/ครูรับผิดชอบ) — ไม่แตะ createdAt/createdBy เดิม */
export async function updateElectiveActivity(
  id: string,
  updates: Partial<Pick<ElectiveActivityConfig,
    'name' | 'capacity' | 'responsibleTeacherUids' | 'responsibleTeacherNames' |
    'dayOfWeek' | 'periodNumber' | 'room' | 'enrollmentStatus'>>,
  firestoreDb: Firestore = db,
): Promise<void> {
  try {
    await updateDoc(doc(firestoreDb, 'elective_activities_config', id), updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `elective_activities_config/${id}`);
  }
}

/** ลบชุมนุม — ไม่แตะ activity_enrollments ที่มีอยู่แล้ว (เก็บประวัติไว้) */
export async function removeElectiveActivityConfig(id: string, firestoreDb: Firestore = db): Promise<void> {
  try {
    await deleteDoc(doc(firestoreDb, 'elective_activities_config', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `elective_activities_config/${id}`);
  }
}

export function subscribeElectiveActivityConfigs(onUpdate: (configs: ElectiveActivityConfig[]) => void): () => void {
  try {
    return onSnapshot(collection(db, 'elective_activities_config'), (snap) => {
      onUpdate(snap.docs.map(d => ({ id: d.id, ...d.data() } as ElectiveActivityConfig)));
    }, (err) => {
      console.warn('[subscribeElectiveActivityConfigs] listener error:', err.message);
      onUpdate([]);
    });
  } catch (error) {
    console.warn('[subscribeElectiveActivityConfigs] setup error:', error);
    return () => {};
  }
}

/** สมัครชุมนุม/กิจกรรม ELECTIVE — atomic capacity check ผ่านทรานแซกชัน (กัน race condition) */
export async function enrollInActivity(
  params: {
    activityId: string;
    studentId: string;
    studentUid: string;
    capacity: number;
  },
  firestoreDb: Firestore = db,
): Promise<void> {
  const { activityId, studentId, studentUid, capacity } = params;
  const enrollmentId = `${activityId}_${studentId}`;
  const enrollmentRef = doc(firestoreDb, 'activity_enrollments', enrollmentId);
  const counterRef = doc(firestoreDb, 'activity_enrollment_counts', activityId);
  try {
    await runTransaction(firestoreDb, async (transaction) => {
      // อ่านก่อนเขียนเสมอ (ข้อกำหนดของ Firestore transaction)
      const [enrollmentSnap, counterSnap] = await Promise.all([
        transaction.get(enrollmentRef),
        transaction.get(counterRef),
      ]);

      if (enrollmentSnap.exists() && !(enrollmentSnap.data() as any).removedAt) {
        throw new Error('ENROLL_ALREADY_ACTIVE: สมัครชุมนุมนี้ไปแล้ว');
      }

      const currentCount = counterSnap.exists() ? Number((counterSnap.data() as any).count) || 0 : 0;
      if (currentCount >= capacity) {
        throw new Error('ENROLL_FULL: ที่นั่งเต็มแล้ว');
      }

      transaction.set(enrollmentRef, {
        id: enrollmentId,
        activityId,
        studentId,
        studentUid,
        enrolledAt: serverTimestamp(),
        removedAt: null,
        removedBy: null,
        removedReason: null,
      });
      transaction.set(counterRef, {
        activityId,
        count: currentCount + 1,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    });
  } catch (error) {
    // ข้อความจาก throw ภายใน (เต็มแล้ว/สมัครไปแล้ว) ต้องส่งต่อให้ UI แสดงจริง ไม่ sanitize ทิ้ง
    if (error instanceof Error && (error.message.startsWith('ENROLL_FULL') || error.message.startsWith('ENROLL_ALREADY_ACTIVE'))) {
      throw new Error(error.message.split(': ').slice(1).join(': '));
    }
    handleFirestoreError(error, OperationType.WRITE, `activity_enrollments/${enrollmentId}`);
  }
}

/** ถอนชุมนุม — นักเรียนถอนตัวเอง (removedBy: null) หรือครูรับผิดชอบถอน (removedBy: uid ครู) */
export async function withdrawFromActivity(
  params: {
    activityId: string;
    studentId: string;
    removedBy: string | null;
    removedReason: string | null;
  },
  firestoreDb: Firestore = db,
): Promise<void> {
  const { activityId, studentId, removedBy, removedReason } = params;
  const enrollmentId = `${activityId}_${studentId}`;
  const enrollmentRef = doc(firestoreDb, 'activity_enrollments', enrollmentId);
  const counterRef = doc(firestoreDb, 'activity_enrollment_counts', activityId);
  try {
    await runTransaction(firestoreDb, async (transaction) => {
      const [enrollmentSnap, counterSnap] = await Promise.all([
        transaction.get(enrollmentRef),
        transaction.get(counterRef),
      ]);
      if (!enrollmentSnap.exists() || (enrollmentSnap.data() as any).removedAt) {
        throw new Error('WITHDRAW_NOT_FOUND: ไม่พบการสมัครที่ยังไม่ถูกถอน');
      }
      const currentCount = counterSnap.exists() ? Number((counterSnap.data() as any).count) || 0 : 0;

      transaction.update(enrollmentRef, {
        removedAt: serverTimestamp(),
        removedBy,
        removedReason,
      });
      transaction.set(counterRef, {
        count: Math.max(0, currentCount - 1),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('WITHDRAW_NOT_FOUND')) {
      throw new Error(error.message.split(': ').slice(1).join(': '));
    }
    handleFirestoreError(error, OperationType.WRITE, `activity_enrollments/${enrollmentId}`);
  }
}

/** รายชื่อสมัครปัจจุบัน (ยังไม่ถูกถอน) ของชุมนุมหนึ่ง — real-time สำหรับหน้าครูรับผิดชอบ */
export function subscribeActiveEnrollmentsByActivity(
  activityId: string,
  onUpdate: (enrollments: ActivityEnrollment[]) => void,
): () => void {
  try {
    const q = query(
      collection(db, 'activity_enrollments'),
      where('activityId', '==', activityId),
      where('removedAt', '==', null),
    );
    return onSnapshot(q, (snap) => {
      onUpdate(snap.docs.map(d => ({ id: d.id, ...d.data() } as ActivityEnrollment)));
    }, (err) => {
      console.warn('[subscribeActiveEnrollmentsByActivity] listener error:', err.message);
      onUpdate([]);
    });
  } catch (error) {
    console.warn('[subscribeActiveEnrollmentsByActivity] setup error:', error);
    return () => {};
  }
}

/** รายชื่อสมัครปัจจุบันของนักเรียนคนหนึ่ง ทุกชุมนุม — real-time สำหรับหน้านักเรียน */
export function subscribeActiveEnrollmentsByStudent(
  studentId: string,
  onUpdate: (enrollments: ActivityEnrollment[]) => void,
): () => void {
  try {
    const q = query(
      collection(db, 'activity_enrollments'),
      where('studentId', '==', studentId),
      where('removedAt', '==', null),
    );
    return onSnapshot(q, (snap) => {
      onUpdate(snap.docs.map(d => ({ id: d.id, ...d.data() } as ActivityEnrollment)));
    }, (err) => {
      console.warn('[subscribeActiveEnrollmentsByStudent] listener error:', err.message);
      onUpdate([]);
    });
  } catch (error) {
    console.warn('[subscribeActiveEnrollmentsByStudent] setup error:', error);
    return () => {};
  }
}

/** ตัวนับที่นั่งของทุก section — real-time สำหรับแสดง "ที่นั่งเหลือ" หน้านักเรียน */
export function subscribeActivityEnrollmentCounts(onUpdate: (counts: Record<string, number>) => void): () => void {
  try {
    return onSnapshot(collection(db, 'activity_enrollment_counts'), (snap) => {
      const map: Record<string, number> = {};
      snap.forEach(d => { map[d.id] = Number((d.data() as any).count) || 0; });
      onUpdate(map);
    }, (err) => {
      console.warn('[subscribeActivityEnrollmentCounts] listener error:', err.message);
      onUpdate({});
    });
  } catch (error) {
    console.warn('[subscribeActivityEnrollmentCounts] setup error:', error);
    return () => {};
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * House config (คณะสี) — รากฐานสำหรับระบบคะแนนถ้วยในอนาคต (ยังไม่คำนวณคะแนนถ้วยตอนนี้)
 * ──────────────────────────────────────────────────────────────────────────── */

export async function saveHouseConfig(
  house: { id?: string; name: string; colorHex: string; assignmentMode: 'SINGLE_PER_ROOM' | 'MIXED' },
): Promise<void> {
  const id = house.id || `house_${Date.now()}`;
  try {
    await setDoc(doc(db, 'house_config', id), {
      id,
      name: house.name,
      colorHex: house.colorHex,
      assignmentMode: house.assignmentMode,
      createdAt: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `house_config/${id}`);
  }
}

export async function deleteHouseConfig(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'house_config', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `house_config/${id}`);
  }
}

export function subscribeHouseConfigs(onUpdate: (houses: HouseConfig[]) => void): () => void {
  try {
    return onSnapshot(collection(db, 'house_config'), (snap) => {
      onUpdate(snap.docs.map(d => ({ id: d.id, ...d.data() } as HouseConfig)));
    }, (err) => {
      console.warn('[subscribeHouseConfigs] listener error:', err.message);
      onUpdate([]);
    });
  } catch (error) {
    console.warn('[subscribeHouseConfigs] setup error:', error);
    return () => {};
  }
}

/** โหมด SINGLE_PER_ROOM: assign นักเรียนทั้งห้องเข้าคณะเดียวกันในทีเดียว (batch write) */
export async function bulkAssignHouseToRoom(room: string, houseId: string | null, studentIds: string[]): Promise<void> {
  if (studentIds.length === 0) return;
  try {
    // Firestore batch จำกัด 500 การเขียนต่อ batch — แบ่งเป็นชุดกันเกิน
    for (let i = 0; i < studentIds.length; i += 450) {
      const chunk = studentIds.slice(i, i + 450);
      const batch = writeBatch(db);
      chunk.forEach(studentId => {
        batch.update(doc(db, 'students', studentId), { houseId, updatedAt: serverTimestamp() });
      });
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `students (bulk houseId) room=${room}`);
  }
}

/** โหมด MIXED: assign รายบุคคล */
export async function assignHouseToStudent(studentId: string, houseId: string | null): Promise<void> {
  try {
    await updateDoc(doc(db, 'students', studentId), { houseId, updatedAt: serverTimestamp() });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `students/${studentId}.houseId`);
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Admin periods config (admin_periods_config/{periodId}) — ตารางเวลา & กระดิ่งคาบเรียนจริงที่
 * useTeacherFirestoreSchedule.ts ใช้คำนวณเวลาเริ่ม-จบคาบจริงในหน้าครู (fsPeriods) — ก่อนหน้านี้
 * เมนู "ตารางเวลา & กระดิ่ง" ในหน้าแอดมินเรียก PeriodManagementPage.tsx ซึ่งจริงๆ แล้วอ่าน/เขียน
 * school_settings/periods_config คนละ collection กันเลย (ไม่มีอะไรอ่าน collection นั้นเป็นค่าหลัก)
 * ทำให้แก้ตารางเวลาจากหน้าแอดมินแล้วไม่มีผลอะไรกับระบบจริงเลย — ฟังก์ชันชุดนี้ผูกกับ
 * admin_periods_config ตัวจริงโดยตรงแทน (schema เดิมตาม AdminPeriodConfig ใน
 * useTeacherFirestoreSchedule.ts: periodNumber/periodName/startTime/endTime/periodType)
 * ──────────────────────────────────────────────────────────────────────────── */

export async function saveAdminPeriodConfig(
  period: { id: string; periodNumber: number; periodName: string; startTime: string; endTime: string; periodType: string },
  firestoreDb: Firestore = db,
): Promise<void> {
  try {
    await setDoc(doc(firestoreDb, 'admin_periods_config', period.id), period, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `admin_periods_config/${period.id}`);
  }
}

export async function deleteAdminPeriodConfig(id: string, firestoreDb: Firestore = db): Promise<void> {
  try {
    await deleteDoc(doc(firestoreDb, 'admin_periods_config', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `admin_periods_config/${id}`);
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * School calendar (school_calendar_events/{eventId}) — วันหยุดพิเศษ + วันเปิด-ปิดภาคเรียน
 * แยกต่างหากจาก school_settings/system_locks (คนละเรื่องกัน — อันนั้นแค่เก็บเลขภาคเรียนปัจจุบัน
 * สำหรับล็อกคะแนน) ใช้ตรวจ "วันนี้เป็นวันเรียนไหม" ใน TeacherPortal.tsx เป็นหลัก
 * ──────────────────────────────────────────────────────────────────────────── */

export async function saveSchoolCalendarEvent(
  event: { id?: string; date: string; type: 'HOLIDAY' | 'SEMESTER_START' | 'SEMESTER_END'; name: string; academicYear: string; semester: '1' | '2' | null; createdBy: string },
  firestoreDb: Firestore = db,
): Promise<string> {
  const ref = event.id ? doc(firestoreDb, 'school_calendar_events', event.id) : doc(collection(firestoreDb, 'school_calendar_events'));
  try {
    await setDoc(ref, {
      id: ref.id,
      date: event.date,
      type: event.type,
      name: event.name,
      academicYear: event.academicYear,
      semester: event.semester,
      createdBy: event.createdBy,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `school_calendar_events/${ref.id}`);
  }
  return ref.id;
}

export async function deleteSchoolCalendarEvent(id: string, firestoreDb: Firestore = db): Promise<void> {
  try {
    await deleteDoc(doc(firestoreDb, 'school_calendar_events', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `school_calendar_events/${id}`);
  }
}

export function subscribeSchoolCalendarEvents(onUpdate: (events: SchoolCalendarEvent[]) => void): () => void {
  try {
    return onSnapshot(collection(db, 'school_calendar_events'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as SchoolCalendarEvent));
      list.sort((a, b) => a.date.localeCompare(b.date));
      onUpdate(list);
    }, (err) => {
      console.warn('[subscribeSchoolCalendarEvents] listener error:', err.message);
      onUpdate([]);
    });
  } catch (error) {
    console.warn('[subscribeSchoolCalendarEvents] setup error:', error);
    return () => {};
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Guidance Counseling Cases (guidance_counseling_cases/{caseId})
 * เนื้อหาการให้คำปรึกษาจิตวิทยาของผู้เยาว์ — ข้อมูลอ่อนไหวที่สุดในระบบ อ่าน/เขียนได้เฉพาะ
 * GUIDANCE_COUNSELOR/SUPER_ADMIN เท่านั้น (ดู firestore.rules match /guidance_counseling_cases)
 * ต่างจาก collection สุขภาพจิตอื่นๆ ตรงที่ครูประจำชั้น/ผู้ปกครอง/นักเรียนเจ้าของเคสอ่านไม่ได้เลย
 * ──────────────────────────────────────────────────────────────────────────── */

const GUIDANCE_CASES_COL = 'guidance_counseling_cases';

export async function createGuidanceCounselingCase(
  data: Pick<GuidanceCounselingCase, 'studentId' | 'studentName' | 'classRoom' | 'category' | 'notes' | 'severity'> &
    { counselorUid: string; counselorName: string }
): Promise<string> {
  const id = `case_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  const payload: GuidanceCounselingCase = {
    id,
    studentId: data.studentId,
    studentName: data.studentName,
    classRoom: data.classRoom,
    counselorUid: data.counselorUid,
    counselorName: data.counselorName,
    category: data.category,
    notes: data.notes,
    severity: data.severity,
    status: 'IN_PROGRESS',
    createdAt: now,
    updatedAt: now,
    lastSessionDate: now.split('T')[0],
  };
  try {
    await setDoc(doc(db, GUIDANCE_CASES_COL, id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `${GUIDANCE_CASES_COL}/${id}`);
  }
  return id;
}

export async function updateGuidanceCounselingCaseStatus(
  caseId: string,
  status: GuidanceCounselingCase['status']
): Promise<void> {
  try {
    await setDoc(doc(db, GUIDANCE_CASES_COL, caseId), {
      status,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${GUIDANCE_CASES_COL}/${caseId}`);
  }
}

/** real-time listener — เฉพาะ GUIDANCE_COUNSELOR/SUPER_ADMIN ที่ผ่าน rules จะได้ข้อมูลจริง
 *  role อื่นจะโดน permission-denied จาก listener error callback (คืน list ว่างแทนการพัง UI) */
export function subscribeGuidanceCounselingCases(
  onUpdate: (cases: GuidanceCounselingCase[]) => void
): () => void {
  try {
    return onSnapshot(collection(db, GUIDANCE_CASES_COL), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as GuidanceCounselingCase));
      list.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
      onUpdate(list);
    }, (error) => {
      console.warn('[subscribeGuidanceCounselingCases] listener error:', error.message);
      onUpdate([]);
    });
  } catch (error) {
    console.warn('[subscribeGuidanceCounselingCases] setup error:', error);
    return () => {};
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Infirmary Visits (infirmary_visits/{visitId})
 * บันทึกการเข้ารับบริการห้องพยาบาล — เขียนได้เฉพาะ INFIRMARY_STAFF/SUPER_ADMIN แต่ตั้งใจให้
 * "อ่านได้" โดยนักเรียนเจ้าของ + ผู้ปกครองที่ผูกไว้ (studentUid/parentUid denormalize จาก
 * students/{studentId} จริง — validate ฝั่ง rules ผ่าน studentField() เสมอ)
 * ── ใช้ร่วมกันทั้ง InfirmaryPortal.tsx (เขียน) และ HealthMentalWellbeingModule.tsx (อ่าน)
 * ──────────────────────────────────────────────────────────────────────────── */

const INFIRMARY_COL = 'infirmary_visits';

export async function recordInfirmaryVisit(
  data: Pick<InfirmaryVisit,
    'studentId' | 'symptoms' | 'temperature' | 'treatment' | 'medicationGiven' | 'restDurationMinutes' | 'isUrgentAlert'> &
    { studentUid: string | null; parentUid: string | null; nurseUid: string; nurseName: string; studentName: string },
  firestoreDb: Firestore = db,
): Promise<string> {
  const id = `inf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date();
  const payload: InfirmaryVisit = {
    id,
    studentId: data.studentId,
    studentUid: data.studentUid,
    parentUid: data.parentUid,
    visitDate: now.toISOString().split('T')[0],
    visitTime: now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.',
    symptoms: data.symptoms,
    temperature: data.temperature,
    treatment: data.treatment,
    medicationGiven: data.medicationGiven,
    restDurationMinutes: data.restDurationMinutes,
    nurseUid: data.nurseUid,
    nurseName: data.nurseName,
    isUrgentAlert: data.isUrgentAlert,
    parentAcknowledged: false,
    createdAt: now.toISOString(),
  };
  try {
    // ระบบแจ้งเตือนรวมศูนย์: เขียนแจ้งเตือนผู้ปกครองคู่กันไปในธุรกรรมเดียวกันเสมอ (ไม่ใช่ 2 การเขียน
    // แยกอิสระที่อาจสำเร็จแค่ฝั่งเดียว) — ถ้าไม่มี parentUid จริง (ยังไม่เชื่อมบัญชี LINE) ข้ามการ
    // แจ้งเตือนไปเงียบๆ ไม่ fabricate ID ปลอม (การบันทึกอาการยังสำเร็จตามปกติ)
    const batch = writeBatch(firestoreDb);
    batch.set(doc(firestoreDb, INFIRMARY_COL, id), payload);
    if (data.parentUid) {
      const notifRef = doc(collection(firestoreDb, 'parent_notifications'));
      batch.set(notifRef, {
        id: notifRef.id,
        parentUid: data.parentUid,
        parentId: data.parentUid,
        studentUid: data.studentUid ?? null,
        studentId: data.studentId,
        studentName: data.studentName,
        title: data.isUrgentAlert ? '🚨 แจ้งเตือนด่วน: นักเรียนเข้าห้องพยาบาล' : '🏥 แจ้งเตือน: นักเรียนเข้าห้องพยาบาล',
        message: `น้อง${data.studentName} เข้ารับบริการห้องพยาบาลด้วยอาการ "${data.symptoms}" เมื่อเวลา ${payload.visitTime} กรุณากดรับทราบในระบบ`,
        status: 'unread',
        createdAt: serverTimestamp(),
        type: data.isUrgentAlert ? 'critical' : 'warning',
      });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `${INFIRMARY_COL}/${id}`);
  }
  return id;
}

/** ผู้ปกครองกด "รับทราบ" เอง — rules จำกัดให้แก้ได้แค่ parentAcknowledged/acknowledgedAt เท่านั้น */
export async function acknowledgeInfirmaryVisit(visitId: string): Promise<void> {
  try {
    await setDoc(doc(db, INFIRMARY_COL, visitId), {
      parentAcknowledged: true,
      acknowledgedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${INFIRMARY_COL}/${visitId}`);
  }
}

/**
 * real-time listener สำหรับสถิติห้องพยาบาล
 *  - ไม่ระบุ filter → พยาบาล/SUPER_ADMIN เห็นทั้งโรงเรียน (rules อนุญาตอ่านทั้ง collection ตาม role)
 *  - { studentUid } → นักเรียนดูของตัวเอง (ต้อง filter ฝั่ง query ให้ผ่าน rules)
 *  - { parentUid }  → ผู้ปกครองดูของบุตรหลาน (ต้อง filter ฝั่ง query ให้ผ่าน rules)
 */
export function subscribeInfirmaryVisits(
  onUpdate: (visits: InfirmaryVisit[]) => void,
  filter: { studentUid?: string; parentUid?: string } = {}
): () => void {
  try {
    const col = collection(db, INFIRMARY_COL);
    const clauses = [];
    if (filter.studentUid) clauses.push(where('studentUid', '==', filter.studentUid));
    if (filter.parentUid) clauses.push(where('parentUid', '==', filter.parentUid));
    const ref = clauses.length > 0 ? query(col, ...clauses) : col;
    return onSnapshot(ref, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as InfirmaryVisit));
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      onUpdate(list);
    }, (error) => {
      console.warn('[subscribeInfirmaryVisits] listener error:', error.message);
      onUpdate([]);
    });
  } catch (error) {
    console.warn('[subscribeInfirmaryVisits] setup error:', error);
    return () => {};
  }
}


