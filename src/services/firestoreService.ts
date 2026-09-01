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
  onSnapshot
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
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
  StudentHomeLocation
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
 * 2. Save a daily attendance or course attendance record
 */
export async function saveAttendanceRecord(recordData: FirestoreAttendanceRecord): Promise<void> {
  const collectionPath = 'attendance_records';
  try {
    const recordRef = doc(db, collectionPath, recordData.id);
    await setDoc(recordRef, {
      ...recordData,
      checkedAt: recordData.checkedAt || serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${collectionPath}/${recordData.id}`);
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
}): Promise<void> {
  try {
    await setDoc(doc(db, 'department_config', dept.id), {
      name: dept.name,
      order: dept.order ?? 999,
      kind: dept.kind ?? 'LEARNING_AREA',
      parentId: dept.parentId ?? null,
      active: dept.active ?? true,
      updatedAt: serverTimestamp(),
    }, { merge: true });
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
    console.warn('[save2QScreeningFirestore] Firestore notice:', error);
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
    console.warn('[savePHQ9ScreeningFirestore] Firestore notice:', error);
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
    console.warn('[saveSDQAssessmentFirestore] Firestore notice:', error);
  }
}

/**
 * Parent Engagement Persistence (Billing, Messages, Appointments)
 */
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


