import { omitUndefined } from '../lib/firestorePayload';
import { deriveParentNames } from '../lib/parentNames';
import { infirmaryVisitNotice } from '../lib/studentNotices';
import { applyStockChange, type DispenseLine, type StockMovementType } from '../lib/infirmaryStock';
import { deriveEmergencyContacts } from '../lib/emergencyContacts';
import { chatThreadId, normalizeChatText, senderRoleFor } from '../lib/classChat';
import type { ChatChannel, ChatSenderRole, ChatSide } from '../lib/classChat';
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
  Timestamp,
  orderBy,
  onSnapshot,
  increment,
  writeBatch,
  Firestore
} from 'firebase/firestore';
import type { Query } from 'firebase/firestore';
import { format } from 'date-fns';
import { db, auth } from '../lib/firebase';
import type { buildSlipSubmissionPatch, buildVerifyPatch, buildRejectPatch } from '../lib/billingPayment';
import {
  computeStudentAttendanceStats,
  diffAttendanceStatuses,
  roomQueryCandidates,
  AttendanceRecordLite,
  AttendanceStatusValue,
} from '../lib/studentAttendanceStats';
import { emptyShared, fillMissing, sharedFromAssessment, sharedFromInfo, sharedEqual, type SharedFields } from '../lib/homeVisitShared';
import { emptyStudentInfo } from '../lib/homeVisitData';
import { validateAppointmentForm, validateConfirmation, type AppointmentFormInput } from '../lib/appointmentFlow';
import { normalizeEmail } from '../lib/normalizeEmail';
import { DEFAULT_RANK_LEVELS, resolveRankLevels, validateRankLevels, type RankLevel } from '../lib/courseRank';
import type { StaffNotificationKind, StaffNotificationDraft } from '../lib/staffNotifications';
import { countLeaveDays, initialLeaveStatus, validateLeaveForm, type LeaveSubmitterRole, type LeaveType } from '../lib/leaveFlow';
import { diffCourseAttendance, computeCourseStatsMap } from '../lib/courseAttendanceStats';
import type { AttendanceRecordFull } from '../lib/attendanceHistory';
import { 
  StudentSelfAssessment,
  GateAttendanceRecord,
  DetailedLeaveRequest,
  StudentLeaveDay,
  GPSCheckInLog,
  TwoQuestionScreening,
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
  SchoolCalendarEvent,
  SemesterHealthLog
} from '../types';
import type { ChronicIllness, AllergyRecord, SpecialCareNeed } from '../types';
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
  // ⚠️ เก็บ staff doc id (teacherId จากไฟล์ import) ไม่ใช่ Firebase Auth UID — เทียบกับผู้ใช้ผ่าน src/lib/staffIdentity.ts (user.staffId) เท่านั้น
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
  // รายวิชาของคาบนี้ (ว่าง = คาบโฮมรูมที่ไม่ผูกวิชา) — ใช้ sync สถิติรายวิชาที่ students/{id}.courseAttendanceStats
  courseCode?: string;
  courseName?: string;
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
const cleanExtraCode = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v : undefined);

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

      // Firestore ปฏิเสธค่า undefined (เช่น courseCode ของคาบที่ไม่มีรหัสวิชา) — ตัดทิ้งก่อนเขียน
      const cleanExtra = Object.fromEntries(Object.entries(extraFields).filter(([, v]) => v !== undefined));
      transaction.set(recordRef, {
        id: recordId,
        ...cleanExtra,
        students,
      }, { merge: true });

      // ยอดรวม (ทุกคาบ) + ยอดแยกรายวิชา (เฉพาะ record ที่ระบุ courseCode) — รวมเป็น update เดียวต่อนักเรียน
      const perStudent = new Map<string, Record<string, any>>();
      const updatesFor = (studentId: string) => {
        let u = perStudent.get(studentId);
        if (!u) { u = { attendanceStatsUpdatedAt: serverTimestamp() }; perStudent.set(studentId, u); }
        return u;
      };
      for (const delta of diffAttendanceStatuses(oldStudents, students)) {
        const u = updatesFor(delta.studentId);
        if (delta.oldStatus) u[`attendanceStats.${delta.oldStatus.toLowerCase()}`] = increment(-1);
        if (delta.newStatus) u[`attendanceStats.${delta.newStatus.toLowerCase()}`] = increment(1);
      }
      const oldData = existingSnap.exists() ? (existingSnap.data() as any) : null;
      const courseDeltas = diffCourseAttendance(
        oldData ? { courseCode: oldData.courseCode, courseName: oldData.courseName, students: oldStudents } : null,
        // set(..., {merge:true}) ทำให้ courseCode เดิมในเอกสารคงอยู่ถ้าครั้งนี้ไม่ได้ส่งมา → ใช้ค่าเดิมต่อ ไม่งั้นยอดรายวิชาเพี้ยน
        { courseCode: cleanExtraCode(extraFields.courseCode) ?? cleanExtraCode(oldData?.courseCode), courseName: extraFields.courseName ?? oldData?.courseName, students },
      );
      for (const d of courseDeltas) {
        const u = updatesFor(d.studentId);
        const base = `courseAttendanceStats.${d.key}`;
        u[`${base}.code`] = d.code;
        u[`${base}.name`] = d.name;
        u[`${base}.${d.status.toLowerCase()}`] = increment(d.by);
      }
      for (const [studentId, updates] of perStudent) {
        transaction.update(doc(db, 'students', studentId), updates);
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
 * คำนวณสถิติรายวิชา (students/{id}.courseAttendanceStats) ของนักเรียนทั้งห้อง "ใหม่ทั้งหมด" จาก attendance_records จริง —
 * ใช้ backfill การเช็คชื่อก่อนมีรหัสวิชาในเอกสาร (หาวิชาจากตารางสอน: ห้อง+วัน+คาบ) หรือเมื่อสงสัยยอดเพี้ยน
 * (derived cache เหมือน recomputeStudentAttendanceStats — ไม่ใช่ source of truth) คืนจำนวนนักเรียนที่อัปเดต
 */
export async function recomputeCourseAttendanceStatsForRoom(
  room: string,
  studentIds: string[],
  schedules: Record<string, any>[],
): Promise<number> {
  const candidates = roomQueryCandidates(room).slice(0, 30);
  if (candidates.length === 0) {
    throw new Error('recomputeCourseAttendanceStatsForRoom: room ว่างเปล่า ไม่สามารถคำนวณได้');
  }
  try {
    const snap = await getDocs(query(collection(db, 'attendance_records'), where('room', 'in', candidates)));
    const records: AttendanceRecordFull[] = snap.docs.map(d => {
      const data = d.data() as any;
      return {
        id: d.id,
        date: String(data.date || ''),
        room: data.room,
        periodNumber: typeof data.periodNumber === 'number' ? data.periodNumber : undefined,
        courseCode: data.courseCode,
        courseName: data.courseName,
        students: data.students || {},
      };
    });
    // batch ละไม่เกิน 400 รายการ (ขีดจำกัด Firestore 500)
    for (let i = 0; i < studentIds.length; i += 400) {
      const batch = writeBatch(db);
      for (const sid of studentIds.slice(i, i + 400)) {
        batch.update(doc(db, 'students', sid), {
          courseAttendanceStats: computeCourseStatsMap(records, schedules, sid),
          attendanceStatsUpdatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    }
    return studentIds.length;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `students/*.courseAttendanceStats (room ${room})`);
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
      // .toISOString() แปลงเป็น UTC เสมอ — ช่วงเที่ยงคืน-ตี 6 กว่าๆ ตามเวลาไทย (UTC+7) จะลากวันถอยหลัง
      // ไป 1 วัน ใช้ format() จาก date-fns แทน (คำนวณจาก local time fields ตรงๆ)
      const dateToday = format(new Date(), 'yyyy-MM-dd');

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
        // uid ของเจ้าของ/ผู้ปกครอง — ให้ rules เปิดให้นักเรียน/ผู้ปกครองอ่านประวัติของตัวเองได้ (query where studentUid/parentUid)
        studentUid,
        parentUid: parentUid || null,
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
export type CreateParentNotificationInput = Omit<Pick<ParentNotification, 'parentUid' | 'studentId' | 'studentName' | 'title' | 'message'>, 'parentUid'> &
  { parentUid?: string | null } &
  Partial<Pick<ParentNotification, 'type' | 'pointsDeducted' | 'remainingScore' | 'attendanceStatus' | 'date' | 'studentUid'>>;

/** เขียนแจ้งเตือนถึงผู้ปกครอง และ/หรือนักเรียนเจ้าของเรื่อง 1 รายการ — ข้ามเงียบๆ เฉพาะเมื่อ "ไม่มีผู้รับจริงเลย"
 *  (ไม่มีทั้ง parentUid และ studentUid) แทนการ fabricate ID ปลอมแบบ `parent_${studentId}`
 *  นักเรียนที่ยังไม่มีผู้ปกครองเชื่อมบัญชียังได้รับแจ้งเตือนผ่าน studentUid (parentUid เก็บเป็น null) */
export async function createParentNotification(
  data: CreateParentNotificationInput,
  firestoreDb: Firestore = db,
): Promise<void> {
  const parentUid = data.parentUid || null;
  const studentUid = data.studentUid || null;
  if (!parentUid && !studentUid) {
    console.warn('[createParentNotification] skipped: no real recipient (parentUid/studentUid) for studentId', data.studentId);
    return;
  }
  const ref = doc(collection(firestoreDb, 'parent_notifications'));
  try {
    await setDoc(ref, {
      id: ref.id,
      parentUid,
      parentId: parentUid,
      studentUid,
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
  // TASK 2 (วิชากิจกรรม — ผ่าน/ไม่ผ่าน) — ดู StudentScore.passFailResult ใน types.ts สำหรับเหตุผล
  passFailResult?: 'PASS' | 'FAIL' | null;
  // เพิ่มสำหรับรายงานผลการเรียนของนักเรียน/ผู้ปกครอง (เอกสารรุ่นเก่าไม่มี — รายงานแสดง "-" ไม่เดาค่า)
  courseName?: string;
  credits?: number;
  subjectType?: 'MAIN' | 'ACTIVITY';
  maxPreMidterm?: number;
  maxMidterm?: number;
  maxPostMidterm?: number;
  maxFinal?: number;
  updatedAt?: any;
}

/** คะแนนทุกวิชาของนักเรียนคนเดียว (นักเรียนเจ้าของ/ผู้ปกครองตัวจริง/ครู — rules บังคับ query ต้องกรอง studentId) */
export function subscribeGradebookScoresForStudent(studentId: string, cb: (list: GradebookScoreRecord[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    query(collection(db, 'gradebook_scores'), where('studentId', '==', studentId)),
    (snap) => cb(snap.docs.map(d => ({ id: d.id, ...(d.data() as GradebookScoreRecord) }))),
    (err) => onError?.(err),
  );
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
  term: string
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
      // กรองภาคเรียนให้ตรง ("ภาค/ปี") — คะแนนต่างภาคเรียนเป็นคนละเอกสาร ห้ามปนกัน
      if (data.studentId && data.term === term) {
        resultMap[data.studentId] = data;
      }
    });
    return resultMap;
  } catch (error) {
    console.warn("Notice fetching gradebook scores:", error);
    return {};
  }
}

/** คะแนนทุกวิชาของทั้งห้อง (ครูที่ปรึกษาใช้คำนวณลำดับที่ ปพ.6; rules อนุญาต HOMEROOM_TEACHER อ่าน) — ทุกภาคเรียน ให้ผู้เรียกกรองเอง */
export async function getGradebookScoresByRoom(room: string): Promise<GradebookScoreRecord[]> {
  const canonical = room.trim().replace(/^M\./i, 'ม.');
  const snap = await getDocs(query(collection(db, 'gradebook_scores'), where('className', '==', canonical)));
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as GradebookScoreRecord) }));
}

/* ────────────────────────────────────────────────────────────────────────────
 * Gradebook hidden courses (TASK 3) — คาบกิจกรรมที่ไม่ต้องประเมิน (เช่น PLC, พักกลางวัน)
 * ครูซ่อนออกจาก dropdown สมุดบันทึกคะแนนของตัวเองได้ (preference ส่วนตัวต่อครูคนเดียว ไม่ลบข้อมูลจริง
 * ไม่กระทบครูคนอื่น) — เลือก schema นี้แทนการเพิ่ม flag ที่ elective_activities_config เพราะคาบแบบ
 * PLC/พักกลางวัน/HR ไม่ได้มาจาก collection นั้นเลย (นั่นมีไว้เฉพาะชุมนุมที่นักเรียนสมัครเอง) แต่มาจาก
 * schedules ที่ import ตรงๆ — เพิ่ม flag บน schedules เองเสี่ยงโดนโครงสร้าง sync/replace ของการ import
 * ลบ/เขียนทับตอน import รอบถัดไป จึงแยกเป็น collection ต่างหากที่ผูกกับครู+courseId แทน
 * ──────────────────────────────────────────────────────────────────────────── */

const GRADEBOOK_HIDDEN_COURSES_COL = 'gradebook_hidden_courses';

export function subscribeHiddenGradebookCourses(
  teacherUid: string,
  onUpdate: (hiddenCourseIds: Set<string>) => void
): () => void {
  try {
    const q = query(collection(db, GRADEBOOK_HIDDEN_COURSES_COL), where('teacherUid', '==', teacherUid));
    return onSnapshot(q, (snap) => {
      const ids = new Set<string>();
      snap.forEach(d => { const courseId = d.data().courseId; if (courseId) ids.add(courseId); });
      onUpdate(ids);
    }, (error) => {
      console.warn('[subscribeHiddenGradebookCourses] Listener error:', error.message);
    });
  } catch (error) {
    console.warn('[subscribeHiddenGradebookCourses] Setup error:', error);
    return () => {};
  }
}

export async function hideGradebookCourse(teacherUid: string, courseId: string, courseName: string): Promise<void> {
  const docId = `${teacherUid}_${courseId}`;
  try {
    await setDoc(doc(db, GRADEBOOK_HIDDEN_COURSES_COL, docId), {
      teacherUid, courseId, courseName,
      hiddenAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `${GRADEBOOK_HIDDEN_COURSES_COL}/${docId}`);
  }
}

export async function unhideGradebookCourse(teacherUid: string, courseId: string): Promise<void> {
  const docId = `${teacherUid}_${courseId}`;
  try {
    await deleteDoc(doc(db, GRADEBOOK_HIDDEN_COURSES_COL, docId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${GRADEBOOK_HIDDEN_COURSES_COL}/${docId}`);
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
 * TASK 9 (ExecutivePortal Learner Analytics): real-time listener ของ self-assessment ทั้งโรงเรียน —
 * เดิม ExecutivePortal อ่าน selfAssessments จาก Zustand store ที่ไม่มี listener ผูกไว้เลย (ว่างเปล่า
 * เสมอเมื่อเปิดหน้าใหม่/ล็อกอินใหม่) ต่างจาก getAllSelfAssessmentRecords() ด้านล่างที่ fetch ครั้งเดียว —
 * ฟังก์ชันนี้ใช้ได้เพราะ firestore.rules เพิ่ม EXECUTIVE อ่านได้แล้ว
 */
export function subscribeAllSelfAssessments(
  onUpdate: (assessments: Record<string, StudentSelfAssessment>) => void
): () => void {
  try {
    return onSnapshot(collection(db, 'student_self_assessments'), (snap) => {
      const map: Record<string, StudentSelfAssessment> = {};
      snap.docs.forEach(d => {
        const data = d.data() as StudentSelfAssessment;
        map[data.studentId || d.id] = data;
      });
      onUpdate(map);
    }, (error) => {
      console.warn('[subscribeAllSelfAssessments] listener error:', error.message);
      onUpdate({});
    });
  } catch (error) {
    console.warn('[subscribeAllSelfAssessments] setup error:', error);
    return () => {};
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
 * TASK (รูปโปรไฟล์นักเรียน): นักเรียนอัปโหลด/เปลี่ยนรูปโปรไฟล์ของตัวเอง → เขียนกลับเข้า
 * students/{id}.photoUrl. firestore.rules อนุญาตให้ STUDENT แตะได้แค่ photoUrl/photoUpdatedAt
 * (ตรวจ isSelfStudent) — จึงห้ามใส่ updatedAt/serverTimestamp ที่นี่ (จะทำให้ affectedKeys เกิน
 * แล้ว rules ปฏิเสธ). ปล่อย error ต่อ (ไม่กลืนเงียบ) เพื่อให้ UI แสดง "บันทึกไม่สำเร็จ" ได้จริง
 */
export async function updateStudentPhotoUrl(studentId: string, photoUrl: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'students', studentId), {
      photoUrl,
      photoUpdatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `students/${studentId}.photoUrl`);
  }
}

/**
 * Gate Attendance Persistence
 */
export async function saveGateAttendanceRecordFirestore(record: GateAttendanceRecord): Promise<void> {
  const collectionPath = 'gate_attendance_logs';
  try {
    const ref = doc(db, collectionPath, record.id);
    await setDoc(ref, omitUndefined({
      ...record,
      createdAt: serverTimestamp()
    }), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${collectionPath}/${record.id}`);
  }
}

/**
 * real-time listener ของ gate_attendance_logs — แทนการอ่านจาก Zustand store (session-local
 * เห็นเฉพาะสิ่งที่เกิดในเซสชันเบราว์เซอร์เดียวกัน). ต้อง filter ฝั่ง query ให้ผ่าน firestore.rules:
 *  - { date }       → ครูที่ปรึกษาดูทั้งวัน (HOMEROOM_TEACHER อ่านได้ตาม role) แล้วกรองห้องฝั่ง UI
 *  - { parentUid }  → ผู้ปกครองดูของบุตรหลาน (rules เทียบ resource.data.parentUid)
 *  - { studentUid } → นักเรียนดูของตัวเอง (rules เทียบ resource.data.studentUid)
 */
export function subscribeGateAttendanceLogs(
  onUpdate: (logs: GateAttendanceRecord[]) => void,
  /** studentId = ผู้ปกครอง/นักเรียนตามทะเบียน (rules: isParentOfStudent/isSelfStudent) — ใช้ได้กับบันทึกเก่าที่ไม่มี parentUid ด้วย */
  filter: { date?: string; parentUid?: string; studentUid?: string; studentId?: string },
): () => void {
  try {
    const col = collection(db, 'gate_attendance_logs');
    const clauses = [];
    if (filter.date) clauses.push(where('date', '==', filter.date));
    if (filter.parentUid) clauses.push(where('parentUid', '==', filter.parentUid));
    if (filter.studentUid) clauses.push(where('studentUid', '==', filter.studentUid));
    if (filter.studentId) clauses.push(where('studentId', '==', filter.studentId));
    if (clauses.length === 0) { onUpdate([]); return () => {}; }
    return onSnapshot(query(col, ...clauses), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as GateAttendanceRecord));
      // ใหม่สุดก่อน — เรียงตาม date แล้ว timestamp ("HH:MM น.")
      list.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.timestamp || '').localeCompare(a.timestamp || ''));
      onUpdate(list);
    }, (error) => {
      console.warn('[subscribeGateAttendanceLogs] listener error:', error.message);
      onUpdate([]);
    });
  } catch (error) {
    console.warn('[subscribeGateAttendanceLogs] setup error:', error);
    return () => {};
  }
}

export interface DisciplineLogRecord {
  id: string;
  studentId: string;
  type: 'deduction' | 'addition';
  /** ค่าติดลบ = ตัดคะแนน, บวก = เพิ่มคะแนน */
  points: number;
  reason: string;
  date: string;
  recordedBy: string;
}

/** ประวัติเพิ่ม-ตัดคะแนนความประพฤติของตัวเอง/บุตรหลาน (discipline_logs) — ใหม่สุดก่อน
 *  เฉพาะรายการที่มี studentUid/parentUid (เขียนตั้งแต่เพิ่ม field นี้) — รายการเก่ากว่านั้นไม่แสดง */
export function subscribeDisciplineLogs(
  onUpdate: (logs: DisciplineLogRecord[]) => void,
  filter: { parentUid?: string; studentUid?: string },
): () => void {
  try {
    const clauses = [];
    if (filter.parentUid) clauses.push(where('parentUid', '==', filter.parentUid));
    if (filter.studentUid) clauses.push(where('studentUid', '==', filter.studentUid));
    if (clauses.length === 0) { onUpdate([]); return () => {}; }
    return onSnapshot(query(collection(db, 'discipline_logs'), ...clauses), (snap) => {
      const list = snap.docs.map(d => {
        const x = d.data() as Record<string, any>;
        return {
          id: d.id,
          studentId: String(x.studentId || ''),
          type: x.type === 'addition' ? 'addition' : 'deduction',
          points: Number(x.points) || 0,
          reason: String(x.reason || ''),
          date: String(x.date || ''),
          recordedBy: String(x.recordedBy || ''),
        } as DisciplineLogRecord;
      });
      list.sort((a, b) => b.date.localeCompare(a.date));
      onUpdate(list);
    }, (error) => {
      console.warn('[subscribeDisciplineLogs] listener error:', error.message);
      onUpdate([]);
    });
  } catch (error) {
    console.warn('[subscribeDisciplineLogs] setup error:', error);
    return () => {};
  }
}

/**
 * ใบลานักเรียน (detailed_leave_requests) — เขียน/อ่านจริงทุกขั้น ไม่กลืน error (ต้องให้ UI รู้ว่าบันทึกไม่สำเร็จ)
 * ลำดับ: ดู src/lib/leaveFlow.ts + firestore.rules (ต้องตรงกัน)
 */
const LEAVE_COL = 'detailed_leave_requests';
const LEAVE_DAYS_COL = 'student_leave_days';

export interface CreateLeaveInput {
  student: { studentId: string; studentUid: string; parentUid?: string | null; room: string };
  submitter: { role: LeaveSubmitterRole; uid: string; name: string };
  form: { leaveType: LeaveType; startDate: string; endDate: string; reason: string };
}

/** ยื่นใบลา — ตรวจฟอร์ม + ประทับ uid/ห้องจากข้อมูลนักเรียนจริง แล้วเขียน Firestore; throw ถ้าไม่สำเร็จ */
export async function createLeaveRequest(input: CreateLeaveInput): Promise<DetailedLeaveRequest> {
  const errs = validateLeaveForm(input.form);
  if (errs.length > 0) throw new Error(errs.join(' / '));
  const { student, submitter, form } = input;
  if (!student.studentUid) throw new Error('ยังไม่มีบัญชีนักเรียนที่เชื่อมกับรหัสนี้ — ติดต่อโรงเรียน');
  if (!student.room) throw new Error('ไม่พบห้องเรียนของนักเรียน — ติดต่อโรงเรียน');
  const parentUid = student.parentUid || null;
  if (submitter.role === 'parent' && !parentUid) throw new Error('บัญชีผู้ปกครองยังไม่ได้เชื่อมกับนักเรียนคนนี้');
  const ref = doc(collection(db, LEAVE_COL));
  const record: DetailedLeaveRequest = {
    id: ref.id,
    studentId: student.studentId,
    studentUid: student.studentUid,
    parentUid,
    homeroomClass: student.room,
    leaveType: form.leaveType,
    startDate: form.startDate,
    endDate: form.endDate,
    totalDays: countLeaveDays(form.startDate, form.endDate),
    reason: form.reason.trim(),
    status: initialLeaveStatus(submitter.role, !!parentUid),
    submittedByRole: submitter.role,
    submittedByUid: submitter.uid,
    submittedBy: submitter.name,
    submittedAt: new Date().toISOString(),
    noParentLinked: !parentUid,
    parentAcknowledgedAt: null,
  };
  try {
    await setDoc(ref, { ...record, updatedAt: serverTimestamp() });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `${LEAVE_COL}/${ref.id}`);
  }
  return record;
}

/** ผู้ปกครองกด "รับทราบ" ใบลาที่นักเรียนยื่น → ส่งต่อครูที่ปรึกษา */
export async function acknowledgeLeaveRequest(leaveId: string, parentUid: string): Promise<void> {
  try {
    await updateDoc(doc(db, LEAVE_COL, leaveId), {
      status: 'PENDING_TEACHER',
      parentAcknowledgedAt: new Date().toISOString(),
      parentAcknowledgedBy: parentUid,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${LEAVE_COL}/${leaveId}`);
  }
}

/** ครูที่ปรึกษา (หรือ SUPER_ADMIN) อนุมัติ/ไม่อนุมัติ — บันทึกชื่อผู้กดจริงและ staffId */
export async function decideLeaveRequest(
  leaveId: string,
  decision: 'APPROVED' | 'REJECTED',
  decider: { name: string; staffId?: string },
  remarks = '',
): Promise<void> {
  if (!decider.name) throw new Error('ไม่พบข้อมูลผู้ใช้ — เข้าสู่ระบบใหม่แล้วลองอีกครั้ง');
  try {
    const leaveRef = doc(db, LEAVE_COL, leaveId);
    const batch = writeBatch(db);
    batch.update(leaveRef, {
      status: decision,
      teacherRemarks: remarks.trim(),
      decidedBy: decider.name,
      decidedByStaffId: decider.staffId || '',
      decidedAt: new Date().toISOString(),
      updatedAt: serverTimestamp(),
    });
    if (decision === 'APPROVED') {
      // สำเนา "วันลา" แบบไม่มีเหตุผล ให้ครูประจำวิชาเห็นตอนเช็คชื่อ — เขียนใน batch เดียวกับการอนุมัติ (ผ่านทั้งคู่หรือไม่ผ่านเลย)
      const snap = await getDoc(leaveRef);
      const leave = snap.data();
      if (!leave) throw new Error('ไม่พบใบลา');
      batch.set(doc(db, LEAVE_DAYS_COL, leaveId), {
        leaveId,
        studentId: leave.studentId,
        homeroomClass: leave.homeroomClass,
        startDate: leave.startDate,
        endDate: leave.endDate,
        createdAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${LEAVE_COL}/${leaveId}`);
  }
}

/** real-time วันลาที่อนุมัติแล้ว (ไม่มีเหตุผล) ที่ยังไม่จบก่อน fromYmd — ครูผู้สอนใช้ติ๊ก "ลา" ล่วงหน้าในรายการเช็คชื่อ */
export function subscribeApprovedLeaveDays(
  onUpdate: (days: StudentLeaveDay[]) => void,
  fromYmd: string,
): () => void {
  try {
    return onSnapshot(query(collection(db, LEAVE_DAYS_COL), where('endDate', '>=', fromYmd)), (snap) => {
      onUpdate(snap.docs.map(d => d.data() as StudentLeaveDay));
    }, (error) => {
      console.warn('[subscribeApprovedLeaveDays] listener error:', error.message);
      onUpdate([]);
    });
  } catch (error) {
    console.warn('[subscribeApprovedLeaveDays] setup error:', error);
    return () => {};
  }
}

/** real-time ใบลาตามผู้ดู: นักเรียน (studentUid) / ผู้ปกครอง (parentUid) / ครูที่ปรึกษา (homeroomClass) — ต้องส่งเงื่อนไขให้ตรง rules */
export function subscribeLeaveRequests(
  onUpdate: (leaves: DetailedLeaveRequest[]) => void,
  filter: { studentUid?: string; parentUid?: string; homeroomClass?: string },
): () => void {
  const field = filter.parentUid ? 'parentUid' : filter.studentUid ? 'studentUid' : filter.homeroomClass ? 'homeroomClass' : null;
  const value = filter.parentUid || filter.studentUid || filter.homeroomClass;
  if (!field || !value) { onUpdate([]); return () => {}; }
  try {
    return onSnapshot(query(collection(db, LEAVE_COL), where(field, '==', value)), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as DetailedLeaveRequest));
      list.sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
      onUpdate(list);
    }, (error) => {
      console.warn('[subscribeLeaveRequests] listener error:', error.message);
      onUpdate([]);
    });
  } catch (error) {
    console.warn('[subscribeLeaveRequests] setup error:', error);
    return () => {};
  }
}

/**
 * GPS Check-in Logs & Geofence Config Persistence
 */
export async function saveGPSCheckInLogFirestore(log: GPSCheckInLog): Promise<void> {
  const collectionPath = 'gps_check_in_logs';
  try {
    const ref = doc(db, collectionPath, log.id);
    // serverTimeMs = field ฝั่งอ่านเท่านั้น ห้ามเขียนกลับ
    const { serverTimeMs: _ignored, ...rest } = log;
    void _ignored;
    await setDoc(ref, omitUndefined({
      ...rest,
      serverTime: serverTimestamp(),
      createdAt: serverTimestamp()
    }), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${collectionPath}/${log.id}`);
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
function gpsLogFromDoc(id: string, data: Record<string, any>): GPSCheckInLog {
  const { serverTime, ...rest } = data;
  const ms = serverTime && typeof serverTime.toMillis === 'function' ? serverTime.toMillis() : undefined;
  return { id, ...rest, ...(ms !== undefined ? { serverTimeMs: ms } : {}) } as GPSCheckInLog;
}

/**
 * log ของ "รายชื่อผู้ใช้ที่ระบุ" ตั้งแต่ startDate — ครูที่ปรึกษาดึงเฉพาะนักเรียนในห้องตัวเอง (ไม่ดึงทั้งโรงเรียน)
 * `in` รับได้ครั้งละ 30 ค่า จึงแบ่งเป็นชุดละ 30 แล้วรวมผล; ต้องมี composite index (userId ASC, date ASC)
 */
export function subscribeGpsCheckInLogsForUsers(
  userIds: string[],
  startDate: string,
  onUpdate: (logs: GPSCheckInLog[]) => void
): () => void {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (ids.length === 0) { onUpdate([]); return () => {}; }
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));
  const results: GPSCheckInLog[][] = chunks.map(() => []);
  const emit = () => onUpdate(results.flat());
  const unsubs = chunks.map((chunk, idx) => {
    try {
      const q = query(collection(db, 'gps_check_in_logs'), where('userId', 'in', chunk), where('date', '>=', startDate));
      return onSnapshot(q, (snap) => {
        results[idx] = snap.docs.map(d => gpsLogFromDoc(d.id, d.data()));
        emit();
      }, (error) => {
        console.warn('[subscribeGpsCheckInLogsForUsers] Listener error:', error.message);
        results[idx] = [];
        emit();
      });
    } catch (error) {
      console.warn('[subscribeGpsCheckInLogsForUsers] Setup error:', error);
      return () => {};
    }
  });
  return () => unsubs.forEach(u => u());
}

/** เซฟรูปเซลฟี่เช็คอินลงคอลเลกชันแยก (หมดอายุเอง) — throw เมื่อเขียนไม่สำเร็จ */
export async function saveCheckInSelfieFirestore(p: {
  logId: string; authUid: string; userId: string; homeroomClass?: string; date: string; dataUrl: string; expireAt: Date;
}): Promise<void> {
  const path = `gps_checkin_selfies/${p.logId}`;
  try {
    await setDoc(doc(db, 'gps_checkin_selfies', p.logId), omitUndefined({
      authUid: p.authUid,
      userId: p.userId,
      homeroomClass: p.homeroomClass,
      date: p.date,
      dataUrl: p.dataUrl,
      expireAt: Timestamp.fromDate(p.expireAt),
      createdAt: serverTimestamp(),
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * ห้องของนักเรียนที่ล็อกอินอยู่ (อ่านจาก students ด้วย studentUid ของตัวเอง — rules อนุญาตเจ้าของเอกสาร)
 * ใช้ตอนเซฟรูปเช็คอิน: store.students ว่างในเซสชันของนักเรียน (มีแต่เมื่อมีคน import ในเซสชันเดียวกัน)
 * ถ้าไม่ได้ห้อง ครูที่ปรึกษาจะเปิดรูปไม่ได้ (rules ผูกรูปกับ homeroomClass)
 */
export async function getOwnStudentRoomFirestore(studentUid: string): Promise<string | undefined> {
  try {
    const snap = await getDocs(query(collection(db, 'students'), where('studentUid', '==', studentUid)));
    const d = snap.docs[0]?.data();
    const room = d ? (d.room || d.className || d.homeroomClass) : undefined;
    return typeof room === 'string' && room ? room : undefined;
  } catch (error) {
    console.warn('[getOwnStudentRoomFirestore] failed:', error);
    return undefined;
  }
}

/** อ่านรูปเซลฟี่ของ log หนึ่งรายการ — null = ไม่มี/หมดอายุแล้ว (ถูก TTL ลบ) */
export async function getCheckInSelfieFirestore(logId: string): Promise<string | null> {
  const snap = await getDoc(doc(db, 'gps_checkin_selfies', logId));
  if (!snap.exists()) return null;
  const v = snap.data().dataUrl;
  return typeof v === 'string' ? v : null;
}

export function subscribeGpsCheckInLogsByDate(
  dateStr: string,
  onUpdate: (logs: GPSCheckInLog[]) => void
): () => void {
  try {
    const q = query(collection(db, 'gps_check_in_logs'), where('date', '==', dateStr));
    return onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => gpsLogFromDoc(d.id, d.data()));
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
    // โยนต่อให้ UI แจ้งผู้ใช้ — เดิมกลืน error แล้วโชว์ "บันทึกสำเร็จ" ทั้งที่ไม่ได้บันทึก
    console.warn('[saveSchoolGeofenceConfigFirestore] Firestore notice:', error);
    throw error;
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
        // id = staff doc id เสมอ (เอกสารที่นำเข้าอาจไม่มี field id ในตัวข้อมูล → เดิมทำให้ครูคนนั้นหายจากรายการให้เลือก)
        list.push({ ...(docSnap.data() as UserProfile), id: docSnap.id });
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
    handleFirestoreError(error, OperationType.WRITE, `${collectionPath}/${docId}`);
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
  /** studentId = ผู้ปกครองตัวจริงตามทะเบียน (rules: isParentOfStudent) เห็นผลทั้ง 3 ฝ่ายของบุตรหลาน */
  filter: { studentUid?: string; respondentUid?: string; studentId?: string }
): () => void {
  try {
    const col = collection(db, 'student_assessments_sdq');
    const clauses = [];
    if (filter.studentId) clauses.push(where('studentId', '==', filter.studentId));
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
 * TASK 5 (ExecutivePortal Health, สรุปภาพรวมโรงเรียน): อ่านผลคัดกรอง/ประเมินทั้งโรงเรียนแบบไม่ scope
 * รายบุคคล — ต่างจาก subscribeSDQAssessments ด้านบนที่ต้องระบุ studentUid/respondentUid เสมอ
 * (สำหรับมุมมองนักเรียน/ผู้ปกครอง/ครู) ฟังก์ชันกลุ่มนี้ใช้กับ EXECUTIVE เท่านั้น (firestore.rules
 * อนุญาตอ่านทั้ง collection แล้ว) ฝั่ง UI ต้องรวมเป็นจำนวน/เปอร์เซ็นต์เท่านั้น ห้ามโชว์ผลรายบุคคล
 */
export function subscribeAll2QScreenings(
  onUpdate: (screenings: TwoQuestionScreening[]) => void
): () => void {
  try {
    return onSnapshot(collection(db, 'student_screenings_2q'), (snap) => {
      onUpdate(snap.docs.map(d => ({ id: d.id, ...d.data() } as TwoQuestionScreening)));
    }, (error) => {
      console.warn('[subscribeAll2QScreenings] listener error:', error.message);
      onUpdate([]);
    });
  } catch (error) {
    console.warn('[subscribeAll2QScreenings] setup error:', error);
    return () => {};
  }
}

export function subscribeAllSDQAssessments(
  onUpdate: (assessments: SDQAssessment[]) => void
): () => void {
  try {
    return onSnapshot(collection(db, 'student_assessments_sdq'), (snap) => {
      onUpdate(snap.docs.map(d => ({ id: d.id, ...d.data() } as SDQAssessment)));
    }, (error) => {
      console.warn('[subscribeAllSDQAssessments] listener error:', error.message);
      onUpdate([]);
    });
  } catch (error) {
    console.warn('[subscribeAllSDQAssessments] setup error:', error);
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

/**
 * ขั้นตอนชำระเงิน (ดู src/lib/billingPayment.ts) — ทุกฟังก์ชัน "throw เมื่อเขียนไม่สำเร็จ"
 * (เดิม payBillingInvoiceFirestore กลืน error แล้ว UI ขึ้นว่าจ่ายแล้วทั้งที่ rules ปฏิเสธ)
 * ผู้เรียกต้องจับ error แล้วแจ้งผู้ใช้
 */
export async function submitPaymentSlip(
  invoiceId: string,
  patch: ReturnType<typeof buildSlipSubmissionPatch>,
): Promise<void> {
  await updateDoc(doc(db, BILLING_INVOICES_COL, invoiceId), { ...patch, updatedAt: serverTimestamp() });
}

export async function verifyInvoicePayment(
  invoiceId: string,
  patch: ReturnType<typeof buildVerifyPatch>,
): Promise<void> {
  await updateDoc(doc(db, BILLING_INVOICES_COL, invoiceId), { ...patch, updatedAt: serverTimestamp() });
}

export async function rejectPaymentSlip(
  invoiceId: string,
  patch: ReturnType<typeof buildRejectPatch>,
): Promise<void> {
  await updateDoc(doc(db, BILLING_INVOICES_COL, invoiceId), { ...patch, updatedAt: serverTimestamp() });
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
    handleFirestoreError(error, OperationType.WRITE, `${collectionPath}/${msg.id}`);
  }
}

const APPOINTMENT_COL = 'parent_appointments';

export interface CreateAppointmentInput {
  student: { studentId: string; studentUid: string; parentUid?: string | null; room: string };
  parent: { uid: string; name: string };
  form: AppointmentFormInput;
}

/** ผู้ปกครองขอนัดพบครู — ตรวจฟอร์ม + ประทับ uid/ห้องจากข้อมูลนักเรียนจริง แล้วเขียน Firestore; throw ถ้าไม่สำเร็จ */
export async function createAppointmentRequest(input: CreateAppointmentInput): Promise<ParentAppointment> {
  const errs = validateAppointmentForm(input.form, format(new Date(), 'yyyy-MM-dd'));
  if (errs.length > 0) throw new Error(errs.join(' / '));
  const { student, parent, form } = input;
  if (!student.studentUid) throw new Error('ยังไม่มีบัญชีนักเรียนที่เชื่อมกับรหัสนี้ — ติดต่อโรงเรียน');
  if (!student.room) throw new Error('ไม่พบห้องเรียนของนักเรียน — ติดต่อโรงเรียน');
  if (!student.parentUid || student.parentUid !== parent.uid) throw new Error('บัญชีผู้ปกครองยังไม่ได้เชื่อมกับนักเรียนคนนี้');
  const ref = doc(collection(db, APPOINTMENT_COL));
  const record: ParentAppointment = {
    id: ref.id,
    studentId: student.studentId,
    studentUid: student.studentUid,
    parentUid: parent.uid,
    homeroomClass: student.room,
    recipient: form.recipient as ParentAppointment['recipient'],
    targetStaffId: form.targetStaffId || '',
    topic: form.topic.trim(),
    preferredDate: form.preferredDate,
    timeSlot: form.timeSlot,
    meetingType: form.meetingType as ParentAppointment['meetingType'],
    status: 'REQUESTED',
    requestedBy: parent.name,
    requestedAt: new Date().toISOString(),
  };
  try {
    await setDoc(ref, { ...record, updatedAt: serverTimestamp() });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `${APPOINTMENT_COL}/${ref.id}`);
  }
  return record;
}

/** ครูผู้รับ ตอบรับ (ต้องมีสถานที่/ลิงก์) หรือปฏิเสธ (ต้องมีเหตุผล) คำขอนัด */
export async function respondAppointment(
  appointmentId: string,
  decision: 'CONFIRMED' | 'DECLINED',
  responder: { name: string; staffId?: string },
  detail: { meetingType: string; locationOrLink: string; teacherNote: string },
): Promise<void> {
  if (!responder.name) throw new Error('ไม่พบข้อมูลผู้ใช้ — เข้าสู่ระบบใหม่แล้วลองอีกครั้ง');
  if (decision === 'CONFIRMED') {
    const errs = validateConfirmation(detail.meetingType, detail.locationOrLink);
    if (errs.length > 0) throw new Error(errs.join(' / '));
  } else if (!detail.teacherNote.trim()) {
    throw new Error('ระบุเหตุผลที่ไม่สะดวก เพื่อให้ผู้ปกครองขอนัดใหม่ได้ตรงเวลา');
  }
  try {
    await updateDoc(doc(db, APPOINTMENT_COL, appointmentId), {
      status: decision,
      respondedBy: responder.name,
      respondedByStaffId: responder.staffId || '',
      respondedAt: new Date().toISOString(),
      teacherNote: detail.teacherNote.trim(),
      locationOrLink: decision === 'CONFIRMED' ? detail.locationOrLink.trim() : '',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${APPOINTMENT_COL}/${appointmentId}`);
  }
}

/** ครูผู้รับปิดงาน "พบกันแล้ว" */
export async function completeAppointment(appointmentId: string): Promise<void> {
  try {
    await updateDoc(doc(db, APPOINTMENT_COL, appointmentId), {
      status: 'COMPLETED',
      completedAt: new Date().toISOString(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${APPOINTMENT_COL}/${appointmentId}`);
  }
}

/** ผู้ปกครองยกเลิกนัดที่ยังไม่จบ */
export async function cancelAppointment(appointmentId: string): Promise<void> {
  try {
    await updateDoc(doc(db, APPOINTMENT_COL, appointmentId), {
      status: 'CANCELLED',
      cancelledAt: new Date().toISOString(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${APPOINTMENT_COL}/${appointmentId}`);
  }
}

/**
 * real-time นัดพบตามผู้ดู — ต้องส่งเงื่อนไขให้ตรง rules:
 * ผู้ปกครอง (parentUid) / นักเรียน (studentUid) / ครูที่ปรึกษา (homeroomClass → กรอง recipient=HOMEROOM เอง) / ครูแนะแนว (recipient=GUIDANCE)
 */
export function subscribeAppointments(
  onUpdate: (list: ParentAppointment[]) => void,
  filter: { parentUid?: string; studentUid?: string; homeroomClass?: string; guidance?: boolean },
): () => void {
  let q;
  if (filter.parentUid) q = query(collection(db, APPOINTMENT_COL), where('parentUid', '==', filter.parentUid));
  else if (filter.studentUid) q = query(collection(db, APPOINTMENT_COL), where('studentUid', '==', filter.studentUid));
  else if (filter.homeroomClass) q = query(collection(db, APPOINTMENT_COL), where('homeroomClass', '==', filter.homeroomClass), where('recipient', '==', 'HOMEROOM'));
  else if (filter.guidance) q = query(collection(db, APPOINTMENT_COL), where('recipient', '==', 'GUIDANCE'));
  else { onUpdate([]); return () => {}; }
  try {
    return onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as ParentAppointment));
      list.sort((a, b) => (b.requestedAt || '').localeCompare(a.requestedAt || ''));
      onUpdate(list);
    }, (error) => {
      console.warn('[subscribeAppointments] listener error:', error.message);
      onUpdate([]);
    });
  } catch (error) {
    console.warn('[subscribeAppointments] setup error:', error);
    return () => {};
  }
}

/**
 * แชทห้องเรียนแบบแยกช่องส่วนตัว (class_messages + class_chat_threads) — ดู src/lib/classChat.ts
 */
const CLASS_MESSAGE_COL = 'class_messages';
const CLASS_THREAD_COL = 'class_chat_threads';

export interface ClassChatMessage {
  id: string;
  studentId: string;
  channel: ChatChannel;
  room: string;
  memberUid: string;
  senderUid: string;
  senderRole: ChatSenderRole;
  senderName: string;
  text: string;
  sentAt: string;
  /** ครูที่ปรึกษาที่เลือกคุยด้วย ('' / ไม่มี = ท่านใดก็ได้) */
  targetStaffId?: string;
}

export interface ClassChatThread {
  id: string;
  studentId: string;
  studentName?: string;
  channel: ChatChannel;
  room: string;
  memberUid: string;
  lastText?: string;
  lastSenderRole?: ChatSenderRole | '';
  lastAt?: string;
  memberLastReadAt?: string;
  teacherLastReadAt?: string;
  targetStaffId?: string;
}

export interface SendClassMessageInput {
  studentId: string;
  studentName: string;
  channel: ChatChannel;
  room: string;
  memberUid: string;
  side: ChatSide;
  senderUid: string;
  senderName: string;
  text: string;
  /** ครูที่ปรึกษาที่เลือก ('' = ท่านใดก็ได้) */
  targetStaffId?: string;
}

/** ส่งข้อความ + อัปเดตสรุปห้องสนทนาในชุดเดียว (batch) — ผู้ส่งถือว่า "อ่านแล้ว" ถึงเวลานี้ */
export async function sendClassMessage(input: SendClassMessageInput): Promise<void> {
  const text = normalizeChatText(input.text);
  if (!text) throw new Error('EMPTY_OR_TOO_LONG');
  if (!input.memberUid) throw new Error('NO_LINKED_MEMBER');
  const senderRole = senderRoleFor(input.side, input.channel);
  const nowIso = new Date().toISOString();
  const msgRef = doc(collection(db, CLASS_MESSAGE_COL));
  const targetStaffId = input.targetStaffId || '';
  const targetField = targetStaffId ? { targetStaffId } : {}; // ไม่เขียนฟิลด์เมื่อ 'ใครก็ได้' — ห้องสนทนาเดิม (ไม่มีฟิลด์) ยังอัปเดตได้ตาม rules
  const threadId = chatThreadId(input.studentId, input.channel, targetStaffId);
  const batch = writeBatch(db);
  batch.set(msgRef, {
    id: msgRef.id,
    studentId: input.studentId,
    channel: input.channel,
    room: input.room,
    memberUid: input.memberUid,
    senderUid: input.senderUid,
    senderRole,
    senderName: input.senderName.slice(0, 200),
    text,
    sentAt: nowIso,
    createdAt: serverTimestamp(),
    ...targetField,
  });
  // merge: ครั้งแรก = create (ต้องมี identity ครบ), ครั้งต่อไป = update (affectedKeys มีแค่ฟิลด์ที่เปลี่ยน)
  batch.set(doc(db, CLASS_THREAD_COL, threadId), {
    id: threadId,
    studentId: input.studentId,
    studentName: input.studentName,
    channel: input.channel,
    room: input.room,
    memberUid: input.memberUid,
    lastText: text.slice(0, 120),
    lastSenderRole: senderRole,
    lastAt: nowIso,
    [input.side === 'TEACHER' ? 'teacherLastReadAt' : 'memberLastReadAt']: nowIso,
    updatedAt: nowIso,
    ...targetField,
  }, { merge: true });
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${CLASS_MESSAGE_COL}/${msgRef.id}`);
  }
}

export function subscribeClassMessages(
  onUpdate: (list: ClassChatMessage[]) => void,
  filter: { studentId: string; channel: ChatChannel; memberUid?: string; room?: string; targetStaffId?: string },
): () => void {
  // สมาชิก: กรองด้วย memberUid ของตัวเอง, ครู: กรองด้วย room (ให้ตรงเงื่อนไข rules)
  const scope = filter.memberUid ? where('memberUid', '==', filter.memberUid) : filter.room ? where('room', '==', filter.room) : null;
  if (!scope) { onUpdate([]); return () => {}; }
  const q = query(collection(db, CLASS_MESSAGE_COL), scope, where('studentId', '==', filter.studentId), where('channel', '==', filter.channel));
  try {
    return onSnapshot(q, (snap) => {
      // แยกห้องสนทนาตามครูที่เลือก (กรองฝั่ง client เพื่อให้ข้อความเดิมที่ไม่มีฟิลด์ยังอยู่ในห้อง 'ใครก็ได้')
      const want = filter.targetStaffId || '';
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as ClassChatMessage)).filter(m => (m.targetStaffId || '') === want);
      list.sort((a, b) => (a.sentAt || '').localeCompare(b.sentAt || ''));
      onUpdate(list);
    }, (error) => {
      console.warn('[subscribeClassMessages] listener error:', error.message);
      onUpdate([]);
    });
  } catch (error) {
    console.warn('[subscribeClassMessages] setup error:', error);
    return () => {};
  }
}

export function subscribeClassChatThreads(
  onUpdate: (list: ClassChatThread[]) => void,
  filter: { memberUid?: string; room?: string },
): () => void {
  const scope = filter.memberUid ? where('memberUid', '==', filter.memberUid) : filter.room ? where('room', '==', filter.room) : null;
  if (!scope) { onUpdate([]); return () => {}; }
  try {
    return onSnapshot(query(collection(db, CLASS_THREAD_COL), scope), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as ClassChatThread));
      list.sort((a, b) => (b.lastAt || '').localeCompare(a.lastAt || ''));
      onUpdate(list);
    }, (error) => {
      console.warn('[subscribeClassChatThreads] listener error:', error.message);
      onUpdate([]);
    });
  } catch (error) {
    console.warn('[subscribeClassChatThreads] setup error:', error);
    return () => {};
  }
}

/** ทำเครื่องหมายอ่านแล้ว (ฝั่งตัวเอง) — thread ยังไม่มี/เขียนไม่ได้ = ข้ามเงียบๆ */
export async function markClassThreadRead(studentId: string, channel: ChatChannel, side: ChatSide, targetStaffId = ''): Promise<void> {
  try {
    const nowIso = new Date().toISOString();
    await updateDoc(doc(db, CLASS_THREAD_COL, chatThreadId(studentId, channel, targetStaffId)), {
      [side === 'TEACHER' ? 'teacherLastReadAt' : 'memberLastReadAt']: nowIso,
      updatedAt: nowIso,
    });
  } catch (error) {
    console.warn('[markClassThreadRead] skipped:', (error as Error)?.message);
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
    handleFirestoreError(error, OperationType.WRITE, `${collectionPath}/${record.id}`);
  }
}

function activeLearningFromDoc(d: { id: string; data: () => Record<string, any> }): ActiveLearningRecord {
  const data = d.data();
  return {
    id: d.id,
    studentId: String(data.studentId || ''),
    courseId: data.courseId || undefined,
    points: Number(data.points || 0),
    category: data.category || 'GENERAL',
    note: data.note || undefined,
    awardedAt: data.awardedAt || '',
    courseName: data.courseName || undefined,
    courseKey: data.courseKey || undefined,
    homeroomClass: data.homeroomClass || undefined,
    teacherStaffId: data.teacherStaffId || undefined,
    academicYear: data.academicYear || undefined,
    term: data.term === '1' || data.term === '2' ? data.term : undefined,
  };
}

function subscribeActiveLearningQuery(
  tag: string,
  build: () => Query,
  callback: (records: ActiveLearningRecord[]) => void,
): () => void {
  try {
    return onSnapshot(build(), (snapshot) => {
      callback(snapshot.docs.map(activeLearningFromDoc));
    }, (error) => {
      console.warn(`[${tag}] Listener error:`, error.message);
      callback([]);
    });
  } catch (error) {
    console.warn(`[${tag}] Setup error:`, error);
    callback([]);
    return () => {};
  }
}

/**
 * คะแนนกิจกรรมรายวิชา (active_learning_logs) — อ่านตามผู้ดู เพราะ rules ไม่เปิดให้ทุกคนอ่านทั้งหมดแล้ว:
 *  - ทั้งโรงเรียน: เฉพาะ EXECUTIVE/SUPER_ADMIN (แดชบอร์ดผู้บริหาร)
 *  - ครูผู้สอน: เฉพาะที่ตนให้ (where teacherStaffId == staffId)
 *  - นักเรียน: เฉพาะของตัวเอง (where studentId == รหัสนักเรียน; rules เทียบ students/{id}.studentUid)
 */
export function subscribeActiveLearningLogs(callback: (records: ActiveLearningRecord[]) => void): () => void {
  return subscribeActiveLearningQuery('subscribeActiveLearningLogs', () => collection(db, 'active_learning_logs'), callback);
}

export function subscribeActiveLearningLogsForTeacher(staffId: string, callback: (records: ActiveLearningRecord[]) => void): () => void {
  if (!staffId) { callback([]); return () => {}; }
  return subscribeActiveLearningQuery('subscribeActiveLearningLogsForTeacher',
    () => query(collection(db, 'active_learning_logs'), where('teacherStaffId', '==', staffId)), callback);
}

export function subscribeActiveLearningLogsForStudent(studentId: string, callback: (records: ActiveLearningRecord[]) => void): () => void {
  if (!studentId) { callback([]); return () => {}; }
  return subscribeActiveLearningQuery('subscribeActiveLearningLogsForStudent',
    () => query(collection(db, 'active_learning_logs'), where('studentId', '==', studentId)), callback);
}

/** คะแนนกิจกรรมของนักเรียนทั้งห้องที่ฉันเป็นครูที่ปรึกษา (query ต้อง where homeroomClass==ห้อง ตาม rules) — log รุ่นเก่าไม่มี homeroomClass จึงไม่ขึ้น */
export function subscribeActiveLearningLogsForRoom(homeroomClass: string, callback: (records: ActiveLearningRecord[]) => void): () => void {
  if (!homeroomClass) { callback([]); return () => {}; }
  return subscribeActiveLearningQuery('subscribeActiveLearningLogsForRoom',
    () => query(collection(db, 'active_learning_logs'), where('homeroomClass', '==', homeroomClass)), callback);
}

/** ตารางระดับแรงค์รายวิชา (school_settings/course_rank_levels) — ไม่มี/ผิดรูปแบบ = ค่าเริ่มต้นใน src/lib/courseRank.ts */
export function subscribeCourseRankLevels(callback: (levels: RankLevel[]) => void): () => void {
  try {
    return onSnapshot(doc(db, 'school_settings', 'course_rank_levels'), (snap) => {
      callback(resolveRankLevels(snap.exists() ? snap.data().levels : undefined));
    }, (error) => {
      console.warn('[subscribeCourseRankLevels] Listener error:', error.message);
      callback(DEFAULT_RANK_LEVELS);
    });
  } catch {
    callback(DEFAULT_RANK_LEVELS);
    return () => {};
  }
}

export async function saveCourseRankLevelsFirestore(levels: RankLevel[], updatedBy: string): Promise<void> {
  const v = validateRankLevels(levels);
  if ('error' in v) throw new Error(v.error);
  await setDoc(doc(db, 'school_settings', 'course_rank_levels'), {
    levels: v.levels,
    updatedAt: serverTimestamp(),
    updatedBy,
  });
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

/**
 * TASK 4 (ExecutivePortal GIS): ผู้บริหารดูพิกัดบ้านนักเรียนทั้งโรงเรียน (ไม่ scope ห้อง) —
 * ต่างจาก subscribeStudentHomeLocationsByRoom ที่ query ทีละห้องสำหรับครูที่ปรึกษา ฟังก์ชันนี้
 * อ่านทั้ง collection ตรงๆ ต้องอาศัย firestore.rules อนุญาต EXECUTIVE อ่านได้แล้ว (ดู TASK 4 rules)
 * ฝั่ง UI ต้องรวมเป็นจุดพิกัด/สรุป ไม่โชว์ชื่อ-นามสกุลนักเรียนรายคนตรงๆ บนแผนที่ผู้บริหาร
 */
export function subscribeAllStudentHomeLocations(
  onUpdate: (locs: StudentHomeLocation[]) => void
): () => void {
  try {
    return onSnapshot(collection(db, HOME_LOCATION_COL), (snap) => {
      onUpdate(snap.docs.map(d => ({ id: d.id, ...d.data() } as StudentHomeLocation)));
    }, (error) => {
      console.warn('[subscribeAllStudentHomeLocations] Listener error:', error.message);
      onUpdate([]);
    });
  } catch (error) {
    console.warn('[subscribeAllStudentHomeLocations] Setup error:', error);
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
    dayOfWeek?: string | null; periodNumber?: number | null; periodNumberEnd?: number | null; room?: string | null;
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
      periodNumberEnd: config.periodNumberEnd ?? null,
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
    'dayOfWeek' | 'periodNumber' | 'periodNumberEnd' | 'room' | 'enrollmentStatus' | 'enrollmentOpensAt' | 'enrollmentClosesAt'>>,
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

      if (enrollmentSnap.exists()) {
        // เคยสมัครแล้วถอน → สมัครใหม่ด้วย update เฉพาะฟิลด์สถานะ (rules ไม่อนุญาตให้ set ทับ doc เดิมทั้งก้อน)
        transaction.update(enrollmentRef, {
          enrolledAt: serverTimestamp(),
          removedAt: null,
          removedBy: null,
          removedReason: null,
        });
      } else {
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
      }
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
  onUpdate: (cases: GuidanceCounselingCase[]) => void,
  /** ครูแนะแนวเห็นเฉพาะเคสของตน — ส่ง uid ตัวเองเพื่อให้ query พิสูจน์ได้ตาม rules; SUPER_ADMIN ไม่ต้องส่ง */
  ownerUid?: string
): () => void {
  try {
    const src = ownerUid ? query(collection(db, GUIDANCE_CASES_COL), where('counselorUid', '==', ownerUid)) : collection(db, GUIDANCE_CASES_COL);
    return onSnapshot(src, (snap) => {
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
    { studentUid: string | null; parentUid: string | null; nurseUid: string; nurseName: string; studentName: string;
      /** ยาที่เบิกจากคลัง (ตัดสต็อก + บันทึกเคลื่อนไหวใน transaction เดียวกับเคส) */
      dispensed?: DispenseLine[] },
  firestoreDb: Firestore = db,
): Promise<string> {
  const id = `inf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date();
  const payload: InfirmaryVisit = {
    id,
    studentId: data.studentId,
    studentUid: data.studentUid,
    parentUid: data.parentUid,
    // .toISOString() แปลงเป็น UTC เสมอ — ช่วงเที่ยงคืน-ตี 6 กว่าๆ ตามเวลาไทย (UTC+7) จะลากวันถอยหลัง
    // ไป 1 วัน ใช้ format() จาก date-fns แทน (คำนวณจาก local time fields ตรงๆ)
    visitDate: format(now, 'yyyy-MM-dd'),
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
    ...((data.parentUid || data.studentUid) ? { parentNotifiedAt: now.toISOString(), parentNotifiedByName: data.nurseName } : {}),
    createdAt: now.toISOString(),
  };
  const dispensed = (data.dispensed || []).filter(l => l.qty > 0);
  try {
    // ระบบแจ้งเตือนรวมศูนย์: เขียนแจ้งเตือนผู้ปกครองคู่กันไปในธุรกรรมเดียวกันเสมอ (ไม่ใช่ 2 การเขียน
    // แยกอิสระที่อาจสำเร็จแค่ฝั่งเดียว) — ถ้าไม่มี parentUid จริง (ยังไม่เชื่อมบัญชี LINE) ข้ามการ
    // แจ้งเตือนไปเงียบๆ ไม่ fabricate ID ปลอม (การบันทึกอาการยังสำเร็จตามปกติ)
    // ถ้ามีรายการเบิกยา ใช้ transaction (อ่านยอดสดก่อนตัดสต็อก) — เคส/แจ้งเตือน/ตัดสต็อก/เคลื่อนไหวสำเร็จหรือล้มพร้อมกัน
    await runTransaction(firestoreDb, async (tx) => {
      const meds: { ref: ReturnType<typeof doc>; data: InfirmaryMedicine; line: DispenseLine }[] = [];
      for (const line of dispensed) {
        const ref = doc(firestoreDb, MEDICINE_COL, line.medicineId);
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error(`MEDICINE_NOT_FOUND:${line.medicineId}`);
        meds.push({ ref, data: snap.data() as InfirmaryMedicine, line });
      }
      for (const m of meds) {
        const r = applyStockChange(m.data.stock, 'DISPENSE', -m.line.qty);
        if (r.ok === false) throw new Error(`${r.error}:${m.line.medicineId}`);
        const mvRef = doc(collection(firestoreDb, MOVEMENT_COL));
        tx.set(mvRef, omitUndefined({
          id: mvRef.id, medicineId: m.line.medicineId, medicineName: m.data.name, unit: m.data.unit,
          type: 'DISPENSE', delta: -m.line.qty, balanceAfter: r.balanceAfter,
          note: `จ่ายให้ ${data.studentName}`, visitId: id, studentId: data.studentId,
          byUid: data.nurseUid, byName: data.nurseName, at: now.toISOString(),
        }));
        tx.update(m.ref, { stock: r.balanceAfter, lastMovementId: mvRef.id, updatedAt: now.toISOString() });
      }
      tx.set(doc(firestoreDb, INFIRMARY_COL, id), payload);
      if (data.parentUid || data.studentUid) {
        const notice = infirmaryVisitNotice(payload, data.studentName);
        const notifRef = doc(collection(firestoreDb, 'parent_notifications'));
        tx.set(notifRef, {
          id: notifRef.id,
          parentUid: data.parentUid || null,
          parentId: data.parentUid || null,
          studentUid: data.studentUid ?? null,
          studentId: data.studentId,
          studentName: data.studentName,
          title: notice.title,
          message: notice.message,
          status: 'unread',
          createdAt: serverTimestamp(),
          type: notice.type,
        });
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `${INFIRMARY_COL}/${id}`);
  }
  return id;
}

/* ────────────────────────────────────────────────────────────────────────────
 * คลังยา/เวชภัณฑ์ห้องพยาบาล (infirmary_medicines + infirmary_stock_movements) — ดู src/lib/infirmaryStock.ts
 * ──────────────────────────────────────────────────────────────────────────── */
const MEDICINE_COL = 'infirmary_medicines';
const MOVEMENT_COL = 'infirmary_stock_movements';

export interface InfirmaryMedicine {
  id: string;
  name: string;
  category?: string;
  unit: string;
  stock: number;
  minAlert: number;
  active: boolean;
  lastMovementId?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface InfirmaryStockMovement {
  id: string;
  medicineId: string;
  medicineName: string;
  unit: string;
  type: StockMovementType;
  delta: number;
  balanceAfter: number;
  note?: string;
  visitId?: string;
  studentId?: string;
  byUid: string;
  byName: string;
  at: string;
}

export function subscribeInfirmaryMedicines(onUpdate: (list: InfirmaryMedicine[]) => void): () => void {
  try {
    return onSnapshot(collection(db, MEDICINE_COL), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as InfirmaryMedicine));
      list.sort((a, b) => (a.category || '').localeCompare(b.category || '') || a.name.localeCompare(b.name));
      onUpdate(list);
    }, (error) => {
      console.warn('[subscribeInfirmaryMedicines] listener error:', error.message);
      onUpdate([]);
    });
  } catch (error) {
    console.warn('[subscribeInfirmaryMedicines] setup error:', error);
    return () => {};
  }
}

/** ประวัติเบิกจ่ายของยาหนึ่งรายการ (เรียงใหม่→เก่าฝั่ง client เลี่ยง composite index) */
export function subscribeStockMovements(medicineId: string, onUpdate: (list: InfirmaryStockMovement[]) => void): () => void {
  if (!medicineId) { onUpdate([]); return () => {}; }
  try {
    return onSnapshot(query(collection(db, MOVEMENT_COL), where('medicineId', '==', medicineId)), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as InfirmaryStockMovement));
      list.sort((a, b) => (b.at || '').localeCompare(a.at || ''));
      onUpdate(list);
    }, (error) => {
      console.warn('[subscribeStockMovements] listener error:', error.message);
      onUpdate([]);
    });
  } catch (error) {
    console.warn('[subscribeStockMovements] setup error:', error);
    return () => {};
  }
}

export async function createInfirmaryMedicine(
  input: { name: string; category?: string; unit: string; initialStock: number; minAlert: number },
  by: { uid: string; name: string },
  firestoreDb: Firestore = db,
): Promise<string> {
  const name = input.name.trim();
  const unit = input.unit.trim();
  if (!name || !unit) throw new Error('INVALID_MEDICINE');
  if (!Number.isInteger(input.initialStock) || input.initialStock < 0 || !Number.isInteger(input.minAlert) || input.minAlert < 0) {
    throw new Error('INVALID_MEDICINE');
  }
  const ref = doc(collection(firestoreDb, MEDICINE_COL));
  const nowIso = new Date().toISOString();
  try {
    const batch = writeBatch(firestoreDb);
    let lastMovementId: string | undefined;
    if (input.initialStock > 0) {
      const mvRef = doc(collection(firestoreDb, MOVEMENT_COL));
      lastMovementId = mvRef.id;
      batch.set(mvRef, {
        id: mvRef.id, medicineId: ref.id, medicineName: name, unit, type: 'INITIAL',
        delta: input.initialStock, balanceAfter: input.initialStock, note: 'ยอดตั้งต้น',
        byUid: by.uid, byName: by.name, at: nowIso,
      });
    }
    batch.set(ref, omitUndefined({
      id: ref.id, name, category: input.category?.trim() || undefined, unit,
      stock: input.initialStock, minAlert: input.minAlert, active: true,
      lastMovementId, createdBy: by.uid, createdAt: nowIso, updatedAt: nowIso,
    }));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `${MEDICINE_COL}/${ref.id}`);
  }
  return ref.id;
}

/** รับเข้า/ทิ้ง/ปรับยอด — อ่านยอดสดใน transaction แล้วเขียนยอดใหม่คู่กับรายการเคลื่อนไหว (DISPENSE ผ่าน recordInfirmaryVisit) */
export async function changeMedicineStock(
  medicineId: string,
  type: Exclude<StockMovementType, 'INITIAL' | 'DISPENSE'>,
  delta: number,
  note: string,
  by: { uid: string; name: string },
  firestoreDb: Firestore = db,
): Promise<void> {
  try {
    await runTransaction(firestoreDb, async (tx) => {
      const ref = doc(firestoreDb, MEDICINE_COL, medicineId);
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('MEDICINE_NOT_FOUND');
      const med = snap.data() as InfirmaryMedicine;
      const r = applyStockChange(med.stock, type, delta);
      if (r.ok === false) throw new Error(r.error);
      const nowIso = new Date().toISOString();
      const mvRef = doc(collection(firestoreDb, MOVEMENT_COL));
      tx.set(mvRef, omitUndefined({
        id: mvRef.id, medicineId, medicineName: med.name, unit: med.unit, type, delta, balanceAfter: r.balanceAfter,
        note: note.trim() || undefined, byUid: by.uid, byName: by.name, at: nowIso,
      }));
      tx.update(ref, { stock: r.balanceAfter, lastMovementId: mvRef.id, updatedAt: nowIso });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${MEDICINE_COL}/${medicineId}`);
  }
}

/** แก้ชื่อ/หมวด/หน่วย/จุดเตือน/เปิด-ปิดใช้งาน (ไม่แตะยอดคงเหลือ) */
export async function updateInfirmaryMedicineMeta(
  medicineId: string,
  patch: Partial<Pick<InfirmaryMedicine, 'name' | 'category' | 'unit' | 'minAlert' | 'active'>>,
): Promise<void> {
  try {
    await updateDoc(doc(db, MEDICINE_COL, medicineId), omitUndefined({ ...patch, updatedAt: new Date().toISOString() }));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${MEDICINE_COL}/${medicineId}`);
  }
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

/** พยาบาลกด "ส่งผ่านแอปงานพยาบาล" — เพิ่มรายการในลิสต์แจ้งเตือน (parent_notifications) ของผู้ปกครอง/นักเรียนจริง
 *  แล้วบันทึก parentNotifiedAt ที่เคส; ไม่มีบัญชีผู้รับที่เชื่อมไว้ = throw (ไม่แสดงว่าแจ้งแล้วทั้งที่ไม่ได้แจ้ง) */
export async function notifyParentOfInfirmaryVisit(
  visit: InfirmaryVisit,
  ctx: { studentName: string; studentUid: string | null; parentUid: string | null; nurseName: string },
): Promise<void> {
  const parentUid = ctx.parentUid || null;
  const studentUid = ctx.studentUid || null;
  if (!parentUid && !studentUid) throw new Error('NO_RECIPIENT');
  const notice = infirmaryVisitNotice(visit, ctx.studentName);
  await createParentNotification({
    parentUid, studentUid, studentId: visit.studentId, studentName: ctx.studentName,
    title: notice.title, message: notice.message, type: notice.type, date: visit.visitDate,
  });
  try {
    await setDoc(doc(db, INFIRMARY_COL, visit.id), {
      parentNotifiedAt: new Date().toISOString(),
      parentNotifiedByName: ctx.nurseName,
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${INFIRMARY_COL}/${visit.id}`);
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



/* ────────────────────────────────────────────────────────────────────────────
 * Semester Health Log (student_semester_health/{studentId}_{academicYear}_{term})
 * ยืนยันจากโรงเรียน: นักเรียนกรอกน้ำหนัก/ส่วนสูงเอง "ภาคเรียนละ 1 ครั้ง" (ลดภาระงานพยาบาล)
 * พยาบาล (INFIRMARY_STAFF) บันทึกแทน/แก้ไขได้กรณีพิเศษ. ครูที่ปรึกษา/ผู้ปกครอง อ่านได้
 * doc id ผูกภาคเรียน → กรอกซ้ำภาคเรียนเดิมชนกับ doc เดิม (firestore.rules บังคับ 1 ครั้ง/ภาคเรียน)
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * รหัสผูกบัญชีตามทะเบียนจริง students/{id} (studentUid/parentUid ตรงตัว ไม่ใช้ alias parentId ของ useRealStudents)
 * rules เทียบฟิลด์เหล่านี้กับ students/{id} ตรง ๆ — ถ้าฝั่ง client ส่ง parentUid จาก parentId (legacy) จะไม่ตรงแล้วถูกปฏิเสธ
 */
export async function getStudentLinkIds(studentId: string): Promise<{ studentUid: string; parentUid: string | null }> {
  const snap = await getDoc(doc(db, 'students', studentId));
  const d = snap.exists() ? (snap.data() as Record<string, unknown>) : {};
  return { studentUid: typeof d.studentUid === 'string' ? d.studentUid : '', parentUid: typeof d.parentUid === 'string' && d.parentUid ? d.parentUid : null };
}

const SEMESTER_HEALTH_COL = 'student_semester_health';

export function semesterHealthDocId(studentId: string, academicYear: string, term: '1' | '2'): string {
  return `${studentId}_${academicYear}_${term}`;
}

export type SemesterHealthInput = Pick<
  SemesterHealthLog,
  'studentId' | 'studentUid' | 'parentUid' | 'academicYear' | 'term' |
  'height' | 'weight' | 'bmi' | 'bmiCategory' | 'bloodType' | 'systolicBp' | 'diastolicBp' | 'semester'
> & { recordedByRole: SemesterHealthLog['recordedByRole'] };

/**
 * นักเรียน (หรือพยาบาล) บันทึกน้ำหนัก/ส่วนสูงของภาคเรียนหนึ่ง — ปล่อย error ต่อ (ไม่กลืนเงียบ)
 * เพื่อให้ UI แสดง "บันทึกไม่สำเร็จ" ได้จริง. isNurseOverride = true → พยาบาลแก้ทับ record เดิมได้
 */
export async function saveSemesterHealthLog(
  input: SemesterHealthInput,
  recordedByUid: string,
  isNurseOverride = false,
): Promise<string> {
  const id = semesterHealthDocId(input.studentId, input.academicYear, input.term);
  // ใช้ studentUid/parentUid ตามทะเบียนจริง (rules เทียบกับ students/{id}) — ไม่เชื่อค่าจาก state ที่อาจมาจาก alias parentId
  const links = await getStudentLinkIds(input.studentId);
  const payload: SemesterHealthLog = {
    id,
    studentId: input.studentId,
    studentUid: links.studentUid || input.studentUid,
    parentUid: links.parentUid,
    academicYear: input.academicYear,
    term: input.term,
    semester: input.semester,
    height: input.height,
    weight: input.weight,
    bmi: input.bmi,
    bmiCategory: input.bmiCategory,
    bloodType: input.bloodType || '',
    ...(input.systolicBp !== undefined ? { systolicBp: input.systolicBp } : {}),
    ...(input.diastolicBp !== undefined ? { diastolicBp: input.diastolicBp } : {}),
    recordedByUid,
    recordedByRole: input.recordedByRole,
    recordedAt: new Date().toISOString(),
  };
  try {
    const ref = doc(db, SEMESTER_HEALTH_COL, id);
    if (isNurseOverride) {
      await setDoc(ref, payload, { merge: true });
    } else {
      // create เท่านั้น — ถ้ามี doc ภาคเรียนนี้แล้ว rules/`create` จะปฏิเสธ (บังคับ 1 ครั้ง/ภาคเรียน)
      await setDoc(ref, payload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${SEMESTER_HEALTH_COL}/${id}`);
  }
  return id;
}

/**
 * real-time listener — ต้อง filter ฝั่ง query ให้ผ่าน firestore.rules:
 *  - { studentId } → นักเรียนตัวจริง/ผู้ปกครองตัวจริงตามทะเบียน (แนะนำ — ไม่พึ่งสำเนา uid ในเอกสาร)
 *  - { studentUid } → นักเรียนเจ้าของ (ทุกภาคเรียน)
 *  - { parentUid }  → ผู้ปกครองของบุตรหลาน
 * ครู/พยาบาล/แอดมิน ที่มี role อ่านได้ ส่ง filter ตัวใดตัวหนึ่งเพื่อ scope ให้แคบก็ได้
 */
export function subscribeSemesterHealthLogs(
  onUpdate: (logs: SemesterHealthLog[]) => void,
  filter: { studentUid?: string; parentUid?: string; studentId?: string },
): () => void {
  try {
    const col = collection(db, SEMESTER_HEALTH_COL);
    const clauses = [];
    // studentId = ตัดสินสิทธิ์จากทะเบียนจริง (นักเรียน/ผู้ปกครองตัวจริง) — ใช้แทน studentUid/parentUid ที่เป็นสำเนาในเอกสารและอาจค้างเก่า
    if (filter.studentId) clauses.push(where('studentId', '==', filter.studentId));
    if (filter.studentUid) clauses.push(where('studentUid', '==', filter.studentUid));
    if (filter.parentUid) clauses.push(where('parentUid', '==', filter.parentUid));
    if (clauses.length === 0) { onUpdate([]); return () => {}; }
    return onSnapshot(query(col, ...clauses), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as SemesterHealthLog));
      list.sort((a, b) => `${a.academicYear}/${a.term}`.localeCompare(`${b.academicYear}/${b.term}`));
      onUpdate(list);
    }, (error) => {
      console.warn('[subscribeSemesterHealthLogs] listener error:', error.message);
      onUpdate([]);
    });
  } catch (error) {
    console.warn('[subscribeSemesterHealthLogs] setup error:', error);
    return () => {};
  }
}


/**
 * บันทึกการเยี่ยมบ้าน (แบบ สพฐ.) — home_visit_records/{studentId}_{ปีการศึกษา}
 * โยน error ต่อให้ UI แจ้งผู้ใช้ (ห้ามแสดง "บันทึกแล้ว" ทั้งที่ไม่ได้บันทึก)
 */
const HOME_VISIT_COL = 'home_visit_records';
export async function saveHomeVisitRecord(rec: import('../types').HomeVisitRecord): Promise<void> {
  await setDoc(doc(db, HOME_VISIT_COL, rec.id), rec);
}

export function subscribeHomeVisitRecordsByRoom(
  homeroomClass: string,
  onUpdate: (rows: import('../types').HomeVisitRecord[]) => void
): () => void {
  try {
    const q = query(collection(db, HOME_VISIT_COL), where('homeroomClass', '==', homeroomClass));
    return onSnapshot(q, (snap) => {
      onUpdate(snap.docs.map(d => ({ ...d.data(), id: d.id } as import('../types').HomeVisitRecord)));
    }, (error) => {
      console.warn('[subscribeHomeVisitRecordsByRoom] Listener error:', error.message);
      onUpdate([]);
    });
  } catch (error) {
    console.warn('[subscribeHomeVisitRecordsByRoom] Setup error:', error);
    return () => {};
  }
}


/**
 * ข้อมูลเยี่ยมบ้านฝั่งนักเรียน/ผู้ปกครอง (แบบ สพฐ.) — เอกสารถาวรต่อนักเรียน แก้ไขได้ตลอด
 * โยน error ต่อให้ UI แจ้งผู้ใช้
 */
const HV_STUDENT_COL = 'home_visit_student_info';
const HV_FAMILY_COL = 'home_visit_family_info';
export async function saveStudentHomeVisitInfo(info: import('../types').StudentHomeVisitInfo): Promise<void> {
  await setDoc(doc(db, HV_STUDENT_COL, info.studentId), { ...info, updatedAt: new Date().toISOString() });
}
export async function saveFamilyHomeVisitInfo(info: import('../types').FamilyHomeVisitInfo): Promise<void> {
  // เขียนข้อมูลเยี่ยมบ้าน + สำเนาผู้ติดต่อฉุกเฉิน (เฉพาะชื่อ/เบอร์) ใน batch เดียว — พยาบาลอ่านรายได้/ครัวเรือนไม่ได้ จึงอ่านเฉพาะสำเนานี้
  const batch = writeBatch(db);
  batch.set(doc(db, HV_FAMILY_COL, info.studentId), { ...info, updatedAt: new Date().toISOString() });
  batch.set(doc(db, EMERGENCY_CONTACTS_COL, info.studentId), emergencyContactsDoc(info));
  batch.set(doc(db, PARENT_NAMES_COL, info.studentId), parentNamesDoc(info));
  await batch.commit();
}

/** ข้อมูลส่วนหัว ปพ.6 student_registry_profiles/{studentId} — มีเลขประจำตัวประชาชน (PDPA) อ่านรายคนเท่านั้น (rules: นักเรียน/ผู้ปกครอง/ครูที่ปรึกษา/SUPER_ADMIN) */
const REGISTRY_PROFILE_COL = 'student_registry_profiles';
export async function getRegistryProfile(studentId: string): Promise<import('../lib/registryProfile').RegistryProfile | null> {
  const snap = await getDoc(doc(db, REGISTRY_PROFILE_COL, studentId));
  return snap.exists() ? (snap.data() as import('../lib/registryProfile').RegistryProfile) : null;
}
export async function saveRegistryProfile(p: import('../lib/registryProfile').RegistryProfile & { studentId: string; studentUid: string; homeroomClass: string }): Promise<void> {
  await setDoc(doc(db, REGISTRY_PROFILE_COL, p.studentId), { ...p, updatedAt: serverTimestamp() });
}

/** สำเนาชื่อบิดา/มารดา student_parent_names/{studentId} — ผู้ปกครองตัวจริงเขียนเท่านั้น (นักเรียนอ่านเอกสารครอบครัวที่มีรายได้ไม่ได้ จึงอ่านเฉพาะสำเนาชื่อนี้ไปแสดงในส่วนหัว ปพ.6) */
const PARENT_NAMES_COL = 'student_parent_names';
function parentNamesDoc(info: import('../types').FamilyHomeVisitInfo) {
  const n = deriveParentNames(info);
  return { studentId: info.studentId, parentUid: info.parentUid, homeroomClass: info.homeroomClass, fatherName: n.fatherName, motherName: n.motherName, updatedAt: serverTimestamp() };
}
export async function syncParentNames(info: import('../types').FamilyHomeVisitInfo): Promise<void> {
  await setDoc(doc(db, PARENT_NAMES_COL, info.studentId), parentNamesDoc(info));
}
export async function getParentNames(studentId: string): Promise<import('../lib/parentNames').ParentNames | null> {
  const snap = await getDoc(doc(db, PARENT_NAMES_COL, studentId));
  if (!snap.exists()) return null;
  const d = snap.data();
  return { fatherName: String(d.fatherName || ''), motherName: String(d.motherName || '') };
}

/** สำเนาผู้ติดต่อฉุกเฉิน student_emergency_contacts/{studentId} — ผู้ปกครองตัวจริงเขียนเท่านั้น */
const EMERGENCY_CONTACTS_COL = 'student_emergency_contacts';
export interface StudentEmergencyContactsDoc {
  studentId: string; parentUid: string; homeroomClass: string;
  contacts: import('../lib/emergencyContacts').EmergencyContact[];
  updatedAt?: Timestamp | null;
}
function emergencyContactsDoc(info: import('../types').FamilyHomeVisitInfo) {
  return {
    studentId: info.studentId,
    parentUid: info.parentUid,
    homeroomClass: info.homeroomClass,
    contacts: deriveEmergencyContacts(info),
    updatedAt: serverTimestamp(),
  };
}
/** ผู้ปกครองเปิดฟอร์มที่เคยบันทึกไว้ก่อนมีฟีเจอร์นี้ → สร้างสำเนาให้ (ไม่แตะเอกสารเยี่ยมบ้าน) */
export async function syncEmergencyContacts(info: import('../types').FamilyHomeVisitInfo): Promise<void> {
  await setDoc(doc(db, EMERGENCY_CONTACTS_COL, info.studentId), emergencyContactsDoc(info));
}
export function subscribeEmergencyContacts(
  studentId: string,
  onUpdate: (d: StudentEmergencyContactsDoc | null) => void,
  onError?: (err: Error) => void,
): () => void {
  return onSnapshot(
    doc(db, EMERGENCY_CONTACTS_COL, studentId),
    (snap) => onUpdate(snap.exists() ? ({ ...(snap.data() as StudentEmergencyContactsDoc), studentId }) : null),
    (err) => { console.warn('[subscribeEmergencyContacts] listener error:', err.message); onError?.(err); },
  );
}
function subscribeSingle<T>(col: string, id: string, onUpdate: (v: T | null) => void): () => void {
  try {
    return onSnapshot(doc(db, col, id), (snap) => onUpdate(snap.exists() ? (snap.data() as T) : null),
      (e) => { console.warn(`[subscribe ${col}] Listener error:`, e.message); onUpdate(null); });
  } catch (e) { console.warn(`[subscribe ${col}] Setup error:`, e); return () => {}; }
}
export const subscribeStudentHomeVisitInfo = (studentId: string, cb: (v: import('../types').StudentHomeVisitInfo | null) => void) => subscribeSingle(HV_STUDENT_COL, studentId, cb);
export const subscribeFamilyHomeVisitInfo = (studentId: string, cb: (v: import('../types').FamilyHomeVisitInfo | null) => void) => subscribeSingle(HV_FAMILY_COL, studentId, cb);

function subscribeByRoom<T>(col: string, room: string, onUpdate: (rows: T[]) => void): () => void {
  try {
    return onSnapshot(query(collection(db, col), where('homeroomClass', '==', room)),
      (snap) => onUpdate(snap.docs.map(d => d.data() as T)),
      (e) => { console.warn(`[subscribe ${col}] Listener error:`, e.message); onUpdate([]); });
  } catch (e) { console.warn(`[subscribe ${col}] Setup error:`, e); return () => {}; }
}
export const subscribeStudentHomeVisitInfoByRoom = (room: string, cb: (rows: import('../types').StudentHomeVisitInfo[]) => void) => subscribeByRoom(HV_STUDENT_COL, room, cb);
export const subscribeFamilyHomeVisitInfoByRoom = (room: string, cb: (rows: import('../types').FamilyHomeVisitInfo[]) => void) => subscribeByRoom(HV_FAMILY_COL, room, cb);

/** ผู้บริหาร: อ่านทั้งโรงเรียน (ใช้สรุปเป็นจำนวน/สัดส่วนเท่านั้น ห้ามแสดงชื่อรายบุคคล) */
function subscribeAllDocs<T>(col: string, onUpdate: (rows: T[]) => void): () => void {
  try {
    return onSnapshot(collection(db, col), (snap) => onUpdate(snap.docs.map(d => d.data() as T)),
      (e) => { console.warn(`[subscribeAll ${col}] Listener error:`, e.message); onUpdate([]); });
  } catch (e) { console.warn(`[subscribeAll ${col}] Setup error:`, e); return () => {}; }
}
export const subscribeAllHomeVisitRecords = (cb: (rows: import('../types').HomeVisitRecord[]) => void) => subscribeAllDocs(HOME_VISIT_COL, cb);
export const subscribeAllStudentHomeVisitInfo = (cb: (rows: import('../types').StudentHomeVisitInfo[]) => void) => subscribeAllDocs(HV_STUDENT_COL, cb);
export const subscribeAllFamilyHomeVisitInfo = (cb: (rows: import('../types').FamilyHomeVisitInfo[]) => void) => subscribeAllDocs(HV_FAMILY_COL, cb);


/** ครูที่ปรึกษา: แบบประเมินตนเองของห้อง (ต้องมี homeroomClass ในเอกสาร — นักเรียนบันทึกแล้วจึงเห็น) */
export function subscribeSelfAssessmentsByRoom(
  homeroomClass: string,
  onUpdate: (assessments: Record<string, StudentSelfAssessment>) => void,
): () => void {
  try {
    const q = query(collection(db, 'student_self_assessments'), where('homeroomClass', '==', homeroomClass));
    return onSnapshot(q, (snap) => {
      const map: Record<string, StudentSelfAssessment> = {};
      snap.docs.forEach(d => { const data = d.data() as StudentSelfAssessment; map[data.studentId || d.id] = data; });
      onUpdate(map);
    }, (error) => {
      console.warn('[subscribeSelfAssessmentsByRoom] listener error:', error.message);
      onUpdate({});
    });
  } catch (error) {
    console.warn('[subscribeSelfAssessmentsByRoom] setup error:', error);
    return () => {};
  }
}

/** แบบประเมินตนเอง → ฟอร์มเยี่ยมบ้านฝั่งนักเรียน: เติมเฉพาะช่องที่ยังว่าง (สร้างเอกสารบางส่วนถ้ายังไม่มี) */
export async function syncSharedToHomeVisitInfo(base: { studentId: string; studentUid: string; homeroomClass: string }, shared: SharedFields): Promise<void> {
  const ref = doc(db, 'home_visit_student_info', base.studentId);
  const snap = await getDoc(ref);
  const current = snap.exists() ? (snap.data() as import('../types').StudentHomeVisitInfo) : null;
  const before = sharedFromInfo(current);
  const next = fillMissing(before, shared);
  if (current && sharedEqual(before, next)) return;
  if (!current && sharedEqual(emptyShared(), next)) return;
  const patch = { livesWith: next.livesWith, commuteMode: next.commuteMode, commuteDuration: next.commuteDuration, consultWho: next.consultWho };
  const body = current ? { ...current, ...patch } : { ...emptyStudentInfo(base), ...patch };
  await setDoc(ref, { ...body, ...base, updatedAt: new Date().toISOString() });
}

/** ฟอร์มเยี่ยมบ้านฝั่งนักเรียน → แบบประเมินตนเอง: เติมเฉพาะช่องที่ยังว่าง และเฉพาะเมื่อมีแบบประเมินอยู่แล้ว */
export async function syncSharedToSelfAssessment(base: { studentId: string; studentUid: string; homeroomClass: string }, shared: SharedFields): Promise<void> {
  const ref = doc(db, 'student_self_assessments', base.studentId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const cur = snap.data() as StudentSelfAssessment;
  const before = sharedFromAssessment(cur).shared;
  const next = fillMissing(before, shared);
  if (sharedEqual(before, next)) return;
  await setDoc(ref, {
    studentId: base.studentId, studentUid: base.studentUid, homeroomClass: base.homeroomClass,
    familyBackground: { livingWith: next.livesWith, transportation: next.commuteMode, travelTime: next.commuteDuration, consultPerson: next.consultWho },
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}

/* ───────── ข้อมูลอ้างอิงที่แอดมินแก้ไขได้ (รายชื่อโรงเรียน/หมู่บ้าน) ─────────
 * เก็บเฉพาะส่วนที่ต่างจากชุดหลักในแอป (ดู src/types/reference.ts, src/lib/referenceData.ts)
 * อ่าน: ผู้ใช้ที่ล็อกอิน (ไม่ใช่ข้อมูลอ่อนไหว) · เขียน/ลบ: SUPER_ADMIN เท่านั้น (บังคับที่ firestore.rules) */
export function subscribeReferenceOverrides<T>(
  kind: 'reference_schools' | 'reference_villages',
  field: 'provinceCode' | 'tambonCode',
  value: string,
  onUpdate: (rows: T[]) => void,
  onError?: (message: string) => void,
): () => void {
  if (!value) { onUpdate([]); return () => {}; }
  return onSnapshot(query(collection(db, kind), where(field, '==', value)), (snap) => {
    onUpdate(snap.docs.map(d => ({ ...d.data(), id: d.id } as T)));
  }, (err) => {
    console.warn(`[subscribeReferenceOverrides:${kind}] listener error:`, err.message);
    onUpdate([]);
    onError?.(err.message);
  });
}

export async function saveReferenceOverride(kind: 'reference_schools' | 'reference_villages', id: string, data: object): Promise<void> {
  try {
    await setDoc(doc(db, kind, id), data);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${kind}/${id}`);
  }
}

export async function deleteReferenceOverride(kind: 'reference_schools' | 'reference_villages', id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, kind, id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${kind}/${id}`);
  }
}

/** อ่าน override ทั้งหมดครั้งเดียว (ใช้ตอนส่งออก/วางแผนนำเข้า) — อ่านได้เมื่อล็อกอิน */
export async function fetchAllReferenceOverrides<T>(kind: 'reference_schools' | 'reference_villages'): Promise<T[]> {
  try {
    const snap = await getDocs(collection(db, kind));
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as T));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, kind);
    return [];
  }
}

/** เขียน/ลบ override เป็นชุด (batch ละ ≤ 400 รายการ) — เฉพาะ SUPER_ADMIN (บังคับที่ rules) ล้มเหลวจะ throw ไม่แจ้งสำเร็จปลอม */
export async function commitReferenceChanges(
  kind: 'reference_schools' | 'reference_villages',
  writes: ({ id: string } & object)[],
  deleteIds: string[],
): Promise<void> {
  const ops: Array<{ type: 'set'; id: string; data: object } | { type: 'delete'; id: string }> = [
    ...writes.map(w => ({ type: 'set' as const, id: w.id, data: w })),
    ...deleteIds.map(id => ({ type: 'delete' as const, id })),
  ];
  try {
    for (let i = 0; i < ops.length; i += 400) {
      const batch = writeBatch(db);
      for (const op of ops.slice(i, i + 400)) {
        const ref = doc(db, kind, op.id);
        if (op.type === 'set') batch.set(ref, op.data); else batch.delete(ref);
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, kind);
  }
}


// ===== staff_notifications: ข้อความแจ้งผลการอนุมัติระหว่างบุคลากร (ผู้รับระบุด้วยอีเมล) =====
export interface StaffNotificationRecord {
  id: string;
  recipientEmail: string;
  kind: StaffNotificationKind;
  title: string;
  message: string;
  refId: string;
  senderUid: string;
  senderName: string;
  createdAt?: string;
  readAt: string | null;
}

/** ส่งข้อความถึงบุคลากรหนึ่งคน (throw เมื่อเขียนไม่สำเร็จ — ผู้เรียกที่ผลหลักเสร็จแล้วควร .catch(warn) ไม่ให้ล้มงานหลัก) */
export async function sendStaffNotification(
  draft: StaffNotificationDraft,
  sender: { uid: string; name: string },
  firestoreDb: Firestore = db,
): Promise<void> {
  const ref = doc(collection(firestoreDb, 'staff_notifications'));
  try {
    await setDoc(ref, {
      id: ref.id,
      recipientEmail: draft.recipientEmail,
      kind: draft.kind,
      title: draft.title,
      message: draft.message,
      refId: draft.refId,
      senderUid: sender.uid,
      senderName: sender.name || 'บุคลากร',
      createdAt: serverTimestamp(),
      readAt: null,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `staff_notifications/${ref.id}`);
  }
}

/** ส่งหลาย draft แบบเขียนทีละรายการ (ไม่ใช้ batch — กันชนเพดาน get() ของ rules) แล้วไม่ล้มงานหลักถ้าบางรายการพลาด */
export async function sendStaffNotifications(
  drafts: (StaffNotificationDraft | null | undefined)[],
  sender: { uid: string; name: string },
  firestoreDb: Firestore = db,
): Promise<void> {
  const list = drafts.filter((d): d is StaffNotificationDraft => !!d);
  await Promise.all(list.map(d => sendStaffNotification(d, sender, firestoreDb).catch(err => console.warn('[sendStaffNotification] failed', err))));
}

/** ข้อความของฉัน (ตามอีเมล) เรียงใหม่→เก่า — rules อนุญาตเฉพาะ query ที่กรอง recipientEmail ตรง token.email */
export function subscribeStaffNotifications(
  email: string,
  cb: (rows: StaffNotificationRecord[]) => void,
  firestoreDb: Firestore = db,
): () => void {
  const e = normalizeEmail(email || '');
  if (!e) { cb([]); return () => {}; }
  return onSnapshot(
    query(collection(firestoreDb, 'staff_notifications'), where('recipientEmail', '==', e)),
    snap => {
      const rows = snap.docs.map(d => {
        const v = d.data() as Record<string, unknown>;
        const ts = v.createdAt as { toDate?: () => Date } | string | undefined;
        return {
          ...(v as unknown as StaffNotificationRecord),
          id: d.id,
          createdAt: typeof ts === 'string' ? ts : ts?.toDate?.().toISOString(),
        } as StaffNotificationRecord;
      }).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      cb(rows);
    },
    err => { console.warn('[subscribeStaffNotifications]', err); cb([]); },
  );
}

export async function markStaffNotificationRead(id: string, firestoreDb: Firestore = db): Promise<void> {
  try {
    await updateDoc(doc(firestoreDb, 'staff_notifications', id), { readAt: new Date().toISOString() });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `staff_notifications/${id}`);
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Student Health Profile (student_health_profiles/{studentId})
 * โรคประจำตัว/แพ้/ดูแลพิเศษ — ครอบครัวกรอก พยาบาลยืนยัน (ดู firestore.rules ข้อ 33)
 * ──────────────────────────────────────────────────────────────────────────── */
export interface StudentHealthProfileDoc {
  studentId: string; studentUid: string; parentUid: string | null;
  chronicIllnesses: ChronicIllness[]; allergies: AllergyRecord[]; specialCare: SpecialCareNeed[];
  updatedAt?: Timestamp | null; updatedByUid?: string; updatedByRole?: 'STUDENT' | 'PARENT';
  verifiedAt?: Timestamp | null; verifiedByUid?: string | null; verifiedByName?: string | null;
}

/** ไม่มีเอกสาร = null (ยังไม่เคยบันทึก) — error อ่านไม่ได้ส่งต่อให้ผู้เรียกเพื่อแยกจาก "ว่าง" */
export function subscribeStudentHealthProfile(
  studentId: string,
  onUpdate: (p: StudentHealthProfileDoc | null) => void,
  onError?: (err: Error) => void,
): () => void {
  return onSnapshot(
    doc(db, 'student_health_profiles', studentId),
    (snap) => onUpdate(snap.exists() ? ({ ...(snap.data() as StudentHealthProfileDoc), studentId }) : null),
    (err) => { console.warn('[subscribeStudentHealthProfile] listener error:', err.message); onError?.(err); },
  );
}

/** ครอบครัวบันทึก/แก้ (นักเรียนหรือผู้ปกครองตัวจริง) — ล้างตรายืนยันเสมอ; throw เมื่อเขียนไม่สำเร็จ (ห้ามแจ้งสำเร็จลอย ๆ) */
export async function saveStudentHealthProfile(input: {
  studentId: string; studentUid: string; parentUid: string | null;
  actorUid: string; actorRole: 'STUDENT' | 'PARENT';
  lists: { chronicIllnesses: ChronicIllness[]; allergies: AllergyRecord[]; specialCare: SpecialCareNeed[] };
}): Promise<void> {
  const path = `student_health_profiles/${input.studentId}`;
  try {
    // ใช้ studentUid/parentUid ตามทะเบียนจริง (rules เทียบกับ students/{id}; กัน alias parentId ทำให้ถูกปฏิเสธ)
    const links = await getStudentLinkIds(input.studentId);
    await setDoc(doc(db, 'student_health_profiles', input.studentId), {
      studentId: input.studentId,
      studentUid: links.studentUid || input.studentUid,
      parentUid: links.parentUid,
      chronicIllnesses: input.lists.chronicIllnesses,
      allergies: input.lists.allergies,
      specialCare: input.lists.specialCare,
      updatedAt: serverTimestamp(),
      updatedByUid: input.actorUid,
      updatedByRole: input.actorRole,
      verifiedAt: null,
      verifiedByUid: null,
      verifiedByName: null,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/* ── หมู่เลือด student_blood_type/{studentId} — เลือกได้ครั้งเดียว (นักเรียน/ผู้ปกครอง) แก้ได้เฉพาะพยาบาล/แอดมิน ── */
const BLOOD_TYPE_COL = 'student_blood_type';
export interface StudentBloodTypeDoc {
  studentId: string; studentUid: string; parentUid: string | null;
  bloodType: import('../lib/bloodType').BloodGroup;
  setByUid: string; setByRole: 'STUDENT' | 'PARENT' | 'NURSE' | 'ADMIN'; setAt?: Timestamp | null;
}
export function subscribeStudentBloodType(
  studentId: string,
  onUpdate: (d: StudentBloodTypeDoc | null) => void,
  onError?: (err: Error) => void,
): () => void {
  return onSnapshot(
    doc(db, BLOOD_TYPE_COL, studentId),
    (snap) => onUpdate(snap.exists() ? ({ ...(snap.data() as StudentBloodTypeDoc), studentId }) : null),
    (err) => { console.warn('[subscribeStudentBloodType] listener error:', err.message); onError?.(err); },
  );
}
/** ตั้งหมู่เลือด — นักเรียน/ผู้ปกครองตั้งได้เฉพาะตอนยังไม่มีเอกสาร (create); พยาบาล/แอดมินแก้ทับได้ (update). throw เมื่อไม่สำเร็จ */
export async function setStudentBloodType(input: {
  studentId: string; bloodType: import('../lib/bloodType').BloodGroup;
  actorUid: string; actorRole: 'STUDENT' | 'PARENT' | 'NURSE' | 'ADMIN';
}): Promise<void> {
  const path = `${BLOOD_TYPE_COL}/${input.studentId}`;
  try {
    const links = await getStudentLinkIds(input.studentId);
    await setDoc(doc(db, BLOOD_TYPE_COL, input.studentId), {
      studentId: input.studentId,
      studentUid: links.studentUid,
      parentUid: links.parentUid,
      bloodType: input.bloodType,
      setByUid: input.actorUid,
      setByRole: input.actorRole,
      setAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/** พยาบาล/แอดมินยืนยันว่าข้อมูลถูกต้อง (แตะได้แค่ฟิลด์ตรายืนยัน) */
export async function verifyStudentHealthProfile(studentId: string, actor: { uid: string; name: string }): Promise<void> {
  const path = `student_health_profiles/${studentId}`;
  try {
    await updateDoc(doc(db, 'student_health_profiles', studentId), {
      verifiedAt: serverTimestamp(),
      verifiedByUid: actor.uid,
      verifiedByName: actor.name,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * บันทึกสุขภาพที่พยาบาลกรอก: ตรวจสายตา/การได้ยิน (student_checkups), วัคซีน (student_vaccinations),
 * บริจาคโลหิต (blood_donations) — ดู src/lib/healthRecords.ts + firestore.rules บล็อก 36-38
 * ทุกฟังก์ชันเขียน throw เมื่อไม่สำเร็จ (ห้ามกลืน error แล้วแจ้งว่าสำเร็จ)
 * ──────────────────────────────────────────────────────────────────────────── */
const CHECKUP_COL = 'student_checkups';
const VACCINATION_COL = 'student_vaccinations';
const DONATION_COL = 'blood_donations';

export async function saveStudentCheckup(input: Omit<import('../lib/healthRecords').StudentCheckup, 'recordedAt'>): Promise<void> {
  const err = (await import('../lib/healthRecords')).validateCheckup(input);
  if (err) throw new Error(err);
  const { checkupDocId } = await import('../lib/healthRecords');
  const id = checkupDocId(input.studentId, input.academicYear);
  try {
    await setDoc(doc(db, CHECKUP_COL, id), omitUndefined({
      studentId: input.studentId,
      academicYear: input.academicYear,
      examDate: input.examDate,
      visionLeft: input.visionLeft?.trim() || undefined,
      visionRight: input.visionRight?.trim() || undefined,
      visionResult: input.visionResult,
      hearingResult: input.hearingResult,
      note: input.note?.trim() || undefined,
      recordedByUid: input.recordedByUid,
      recordedByName: input.recordedByName,
      recordedAt: serverTimestamp(),
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${CHECKUP_COL}/${id}`);
  }
}

export function subscribeStudentCheckups(
  studentId: string,
  onUpdate: (list: import('../lib/healthRecords').StudentCheckup[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(db, CHECKUP_COL), where('studentId', '==', studentId)),
    (snap) => onUpdate(snap.docs.map(d => d.data() as import('../lib/healthRecords').StudentCheckup)),
    (e) => { console.warn('[subscribeStudentCheckups]', e.message); onError?.(e); },
  );
}

export async function addStudentVaccination(input: Omit<import('../lib/healthRecords').StudentVaccination, 'id' | 'recordedAt'>): Promise<void> {
  const err = (await import('../lib/healthRecords')).validateVaccination(input);
  if (err) throw new Error(err);
  const ref = doc(collection(db, VACCINATION_COL));
  try {
    await setDoc(ref, omitUndefined({
      studentId: input.studentId,
      vaccine: input.vaccine.trim(),
      doseDate: input.doseDate,
      place: input.place?.trim() || undefined,
      note: input.note?.trim() || undefined,
      recordedByUid: input.recordedByUid,
      recordedByName: input.recordedByName,
      recordedAt: serverTimestamp(),
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `${VACCINATION_COL}/${ref.id}`);
  }
}

export function subscribeStudentVaccinations(
  studentId: string,
  onUpdate: (list: import('../lib/healthRecords').StudentVaccination[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(db, VACCINATION_COL), where('studentId', '==', studentId)),
    (snap) => onUpdate(snap.docs.map(d => ({ ...(d.data() as any), id: d.id }))),
    (e) => { console.warn('[subscribeStudentVaccinations]', e.message); onError?.(e); },
  );
}

export async function addBloodDonation(input: Omit<import('../lib/healthRecords').BloodDonation, 'id' | 'recordedAt'>): Promise<void> {
  const err = (await import('../lib/healthRecords')).validateDonation(input);
  if (err) throw new Error(err);
  const ref = doc(collection(db, DONATION_COL));
  try {
    await setDoc(ref, omitUndefined({
      subjectType: input.subjectType,
      studentId: input.subjectType === 'STUDENT' ? input.studentId : undefined,
      staffId: input.subjectType === 'STAFF' ? input.staffId : undefined,
      donorName: input.donorName.trim(),
      donatedAt: input.donatedAt,
      place: input.place?.trim() || undefined,
      note: input.note?.trim() || undefined,
      recordedByUid: input.recordedByUid,
      recordedByName: input.recordedByName,
      recordedAt: serverTimestamp(),
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `${DONATION_COL}/${ref.id}`);
  }
}

/** ไม่ส่ง filter = ทั้งโรงเรียน (พยาบาล/แอดมิน/ผู้บริหารเท่านั้น); { studentId } = นักเรียน/ผู้ปกครอง; { staffId } = บุคลากรเจ้าของ */
export function subscribeBloodDonations(
  onUpdate: (list: import('../lib/healthRecords').BloodDonation[]) => void,
  filter: { studentId?: string; staffId?: string } = {},
  onError?: (e: Error) => void,
): () => void {
  const base = collection(db, DONATION_COL);
  const q = filter.studentId
    ? query(base, where('subjectType', '==', 'STUDENT'), where('studentId', '==', filter.studentId))
    : filter.staffId
      ? query(base, where('subjectType', '==', 'STAFF'), where('staffId', '==', filter.staffId))
      : base;
  return onSnapshot(
    q,
    (snap) => onUpdate(snap.docs.map(d => ({ ...(d.data() as any), id: d.id }))),
    (e) => { console.warn('[subscribeBloodDonations]', e.message); onError?.(e); },
  );
}

/** ข้อมูลทั้งโรงเรียนสำหรับแดชบอร์ดสถิติงานพยาบาล (อ่านครั้งเดียว กดรีเฟรชได้) — เฉพาะพยาบาล/แอดมิน */
export async function fetchInfirmaryDashboardData(academicYear: string) {
  const [health, bloodTypes, checkups, vaccinations, movements] = await Promise.all([
    getDocs(query(collection(db, 'student_semester_health'), where('academicYear', '==', academicYear))),
    getDocs(collection(db, BLOOD_TYPE_COL)),
    getDocs(query(collection(db, CHECKUP_COL), where('academicYear', '==', academicYear))),
    getDocs(collection(db, VACCINATION_COL)),
    getDocs(query(collection(db, MOVEMENT_COL), where('type', '==', 'DISPENSE'))),
  ]);
  return {
    semesterHealth: health.docs.map(d => d.data() as any),
    bloodTypes: bloodTypes.docs.map(d => ({ studentId: d.id, bloodType: (d.data() as any).bloodType as string })),
    checkups: checkups.docs.map(d => d.data() as import('../lib/healthRecords').StudentCheckup),
    vaccinations: vaccinations.docs.map(d => ({ ...(d.data() as any), id: d.id }) as import('../lib/healthRecords').StudentVaccination),
    dispenseMovements: movements.docs.map(d => d.data() as InfirmaryStockMovement),
  };
}

/** สรุปสุขภาพรายคนสำหรับครูที่ปรึกษา — อ่านเฉพาะเอกสารที่ rules อนุญาตให้ครูที่ปรึกษาของห้อง (โปรไฟล์สุขภาพ/หมู่เลือด/ผลตรวจประจำปี/ผู้ติดต่อฉุกเฉิน)
 *  แต่ละส่วนอ่านไม่ได้ = ไม่ล้มทั้งรายการ (readError) */
export async function fetchStudentHealthBrief(studentId: string, name: string): Promise<import('../lib/advisorHealthSummary').StudentHealthBrief> {
  const { emptyBrief } = await import('../lib/advisorHealthSummary');
  const b = emptyBrief(studentId, name);
  const [profile, blood, checkups, contacts] = await Promise.allSettled([
    getDoc(doc(db, 'student_health_profiles', studentId)),
    getDoc(doc(db, BLOOD_TYPE_COL, studentId)),
    getDocs(query(collection(db, CHECKUP_COL), where('studentId', '==', studentId))),
    getDoc(doc(db, EMERGENCY_CONTACTS_COL, studentId)),
  ]);
  if (profile.status === 'fulfilled') {
    if (profile.value.exists()) {
      const d = profile.value.data() as any;
      b.hasProfile = true;
      b.verified = !!d.verifiedAt;
      b.chronic = d.chronicIllnesses || [];
      b.allergies = d.allergies || [];
      b.specialCare = d.specialCare || [];
    }
  } else b.readError = true;
  if (blood.status === 'fulfilled' && blood.value.exists()) b.bloodType = (blood.value.data() as any).bloodType;
  if (checkups.status === 'fulfilled') {
    const list = checkups.value.docs.map(x => x.data() as import('../lib/healthRecords').StudentCheckup);
    const { latestCheckup } = await import('../lib/healthRecords');
    const last = latestCheckup(list);
    if (last) { b.visionAbnormal = last.visionResult === 'ABNORMAL'; b.hearingAbnormal = last.hearingResult === 'ABNORMAL'; }
  }
  if (contacts.status === 'fulfilled' && contacts.value.exists()) b.emergencyContactCount = ((contacts.value.data() as any).contacts || []).length;
  return b;
}
