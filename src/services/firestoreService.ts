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
  runTransaction, 
  serverTimestamp,
  orderBy
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { StudentSelfAssessment } from '../types';

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
      const parentId = studentData.parentId || `parent_${studentId}`;
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
        parentId,
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
          parentId,
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
          parentId,
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
        parentId: "parent_38501"
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
        parentId: "parent_38502"
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
        parentId: "parent_38503"
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
        parentId: "parent_38504"
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
