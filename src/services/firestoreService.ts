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
import { isSameRoom } from '../lib/utils';
import { REAL_STUDENTS } from '../data/realStudents';

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
 * Standardized Firestore error handler for robust diagnostics
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
  console.error('Firestore Service Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
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
 * 1. Fetch today's schedule for a specific teacher on a specific weekday
 */
export async function getTodayScheduleByTeacher(teacherId: string, dayOfWeek: string): Promise<FirestoreSchedule[]> {
  const collectionPath = 'schedules';
  try {
    const dayLower = dayOfWeek.toLowerCase();
    const dayMap: Record<string, number> = {
      monday: 1, mon: 1,
      tuesday: 2, tue: 2,
      wednesday: 3, wed: 3,
      thursday: 4, thu: 4,
      friday: 5, fri: 5,
      saturday: 6, sat: 6,
      sunday: 0, sun: 0
    };
    const dayNum = dayMap[dayLower] || 1;

    const schedulesCol = collection(db, collectionPath);
    const querySnapshot = await getDocs(schedulesCol);
    const schedules: FirestoreSchedule[] = [];

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const matchesDay = (
        (data.dayOfWeek && String(data.dayOfWeek).toLowerCase() === dayLower) ||
        (data.scheduleDay && data.scheduleDay === dayNum)
      );

      const matchesTeacher = (
        (data.teacherIds && Array.isArray(data.teacherIds) && (data.teacherIds.includes(teacherId) || data.teacherIds.includes('teacher_kiattisak'))) ||
        (data.teacherEmail && data.teacherEmail === teacherId) ||
        (teacherId.includes('@') && data.teacherEmail && data.teacherEmail.toLowerCase() === teacherId.toLowerCase()) ||
        (data.teacherId && data.teacherId === teacherId) ||
        !teacherId
      );

      if (matchesDay && matchesTeacher) {
        schedules.push({ id: docSnap.id, ...data } as FirestoreSchedule);
      }
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
    console.log(`Successfully saved attendance record '${recordData.id}'`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${collectionPath}/${recordData.id}`);
  }
}

/**
 * 3. Update behavior score and automatically trigger alert banners and conference documents based on score thresholds
 * - Warning threshold: < 80 points (Creates a parent warning notification)
 * - Critical threshold: < 70 points (Updates student riskLevel to CRITICAL and creates parent_conference document)
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
 * 4. Seed database via client-side Web SDK (fully authenticated/authorized under client rules if needed)
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
        studentId: "38502",
        fullName: "สมชาย ใจดี",
        nickname: "ชาย",
        room: "ม.5/8",
        behaviorScore: 100,
        riskLevel: "NORMAL",
        parentId: "parent_38502"
      },
      {
        studentId: "38503",
        fullName: "สมหญิง มุ่งมั่น",
        nickname: "หญิง",
        room: "ม.5/8",
        behaviorScore: 100,
        riskLevel: "NORMAL",
        parentId: "parent_38503"
      },
      {
        studentId: "38504",
        fullName: "วิชัย ชัยชนะ",
        nickname: "ชัย",
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

    // Seed Admin Periods
    for (const period of periods) {
      await setDoc(doc(db, "admin_periods_config", period.id), period);
    }
    // Seed Teachers
    for (const teacher of teachers) {
      await setDoc(doc(db, "teachers", teacher.teacherId), teacher);
    }
    // Seed Students
    for (const student of students) {
      await setDoc(doc(db, "students", student.studentId), student);
    }
    // Seed Schedules
    for (const schedule of schedules) {
      await setDoc(doc(db, "schedules", schedule.id), schedule);
    }

    console.log("Seeding finished completely via client Web SDK!");
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, collectionPath);
  }
}

/**
 * Update Parent Conference schedule status to SCHEDULED in Firestore
 */
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
 * Helper function to fetch students by class/room name
 * using query(collection(db, 'students'), where('className', '==', className), orderBy('studentNumber', 'asc'))
 */
export async function getStudentsByClass(className: string): Promise<any[]> {
  const collectionPath = 'students';
  try {
    const studentsCol = collection(db, collectionPath);
    let docs: any[] = [];
    
    // Attempt standard query using where('className', '==', className) and orderBy('studentNumber', 'asc')
    try {
      const q = query(studentsCol, where('className', '==', className), orderBy('studentNumber', 'asc'));
      const snap = await getDocs(q);
      docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      // Fallback query if composite index or field variation
      let snap = await getDocs(query(studentsCol, where('className', '==', className)));
      if (snap.empty) {
        snap = await getDocs(query(studentsCol, where('room', '==', className)));
      }
      docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    if (docs.length === 0) {
      // Client-side fallback matching room or className with normalization for "M.5/8" vs "ม.5/8"
      try {
        const allSnap = await getDocs(studentsCol);
        docs = allSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(data => {
            const r = (data as any).className || (data as any).room || '';
            return isSameRoom(r, className);
          });
      } catch (err) {
        console.warn('Notice: Firestore getDocs fallback error in getStudentsByClass', err);
      }
    }

    // If still 0 documents, fallback to local REAL_STUDENTS dataset
    if (docs.length === 0) {
      let matched = REAL_STUDENTS.filter(s => isSameRoom(s.room, className));
      if (matched.length === 0) {
        matched = REAL_STUDENTS.filter(s => isSameRoom(s.room, 'ม.5/8'));
      }
      docs = matched;
    }

    // Sort by studentNumber / studentNo / number asc
    docs.sort((a, b) => {
      const numA = Number(a.studentNumber ?? a.studentNo ?? a.number ?? 0);
      const numB = Number(b.studentNumber ?? b.studentNo ?? b.number ?? 0);
      return numA - numB;
    });

    return docs.map(d => ({
      id: d.id,
      studentId: d.studentId || d.studentCode || d.id,
      studentNumber: d.studentNumber ?? d.studentNo ?? d.number ?? 0,
      studentNo: d.studentNo ?? d.studentNumber ?? d.number ?? 0,
      name: d.fullName || d.name || `นักเรียน ${d.studentId || d.id}`,
      fullName: d.fullName || d.name || `นักเรียน ${d.studentId || d.id}`,
      className: d.className || d.room || className,
      room: d.room || d.className || className,
      avatar: d.avatar || d.photoUrl || '',
      parentId: d.parentId || ''
    }));
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
    const scoresCol = collection(db, collectionPath);
    let snap = await getDocs(query(scoresCol, where('courseCode', '==', courseCode), where('className', '==', className)));
    if (snap.empty) {
      // Fallback: query all scores for courseCode
      snap = await getDocs(query(scoresCol, where('courseCode', '==', courseCode)));
    }
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



