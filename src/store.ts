import { create } from 'zustand';
import { selfieExpiresAt } from './lib/selfieRetention';
import { format } from 'date-fns';
import { isValidAcademicYear, sdqDocId } from './lib/sdq';
import { nextClockValue } from './lib/appClock';
import {
  StoreState, 
  AttendanceStatus, 
  Course, 
  StudentSelfAssessment, 
  ActiveLearningCategory, 
  ActiveLearningRecord,
  ActiveLearningExtra,
  GateAttendanceRecord,
  DetailedLeaveRequest,
  SemesterHealthRecord,
  ChronicIllness,
  AllergyRecord,
  SpecialCareNeed,
  TwoQuestionScreening,
  SDQAssessment,
  GuardianBackground,
  HomeVisitLogRecord,
  EQFHardshipScreening,
  MeritDemeritRecord,
  PortfolioItem,
  DigitalCertificate,
  VolunteerHourRecord,
  ReportCardTerm,
  ExamScheduleItem,
  BillingInvoice,
  ParentTeacherMessage,
  GPSCheckInLog,
  SubstituteAssignment,
  SubstituteApprovalStep,
  SubstituteApprovalStage,
  PostTeachingRecord
} from './types';
import { substituteUpdateNotices, SUBSTITUTE_STAGE_LABEL } from './lib/staffNotifications';
import { SUBSTITUTE_STAGE_ROLE, SUBSTITUTE_STAGE_ORDER, SUBSTITUTE_TEACHER_DECLINED_ROLE } from './types';
import { DEFAULT_SCHOOL_GEOFENCE } from './utils/geoUtils';
import { 
  saveSelfAssessmentRecord, 
  saveGateAttendanceRecordFirestore,
  saveGPSCheckInLogFirestore,
  saveCheckInSelfieFirestore,
  getOwnStudentRoomFirestore,
  saveSchoolGeofenceConfigFirestore,
  saveSubstituteAssignmentFirestore,
  updateSubstituteAssignmentFirestore,
  saveSubstituteSwapPairFirestore,
  updateSubstituteAssignmentsBatchFirestore,
  savePostTeachingRecordFirestore,
  save2QScreeningFirestore,
  saveSDQAssessmentFirestore,
  sendParentTeacherMessageFirestore,
  saveActiveLearningLogFirestore,
  updateBehaviorScoreAndTriggerAlert,
  createParentNotification,
  sendStaffNotifications
} from './services/firestoreService';

const STATUS_CYCLE: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'LATE', 'LEAVE'];

/** สร้าง approval chain 4 ขั้น — ขั้นที่ 1 auto-approve เฉพาะเมื่อผู้เสนอคือ HEAD_OF_DEPARTMENT ตัวจริง
 *  หรือผู้ได้รับมอบหมายให้ปฏิบัติหน้าที่แทน (backupApproverUid/ACADEMIC_HEAD fallback ตอนหัวหน้า
 *  กลุ่มสาระฯ ลาป่วยเอง — ดู actingAsBackupApproverForDeptId ใน types.ts)
 *  ใช้ร่วมกันทั้ง proposeSubstituteAssignment (เดี่ยว) และ proposeSubstituteSwap (คู่แลกคาบ) */
function buildSubstituteApprovalChain(
  isHodProposer: boolean,
  proposerEmail: string,
  proposerName: string,
  now: string,
  actingAsBackupApproverForDeptId?: string | null
): SubstituteApprovalStep[] {
  const approveComment = actingAsBackupApproverForDeptId
    ? 'เสนอจัดครูสอนแทนโดยผู้ได้รับมอบหมายให้ปฏิบัติหน้าที่แทนหัวหน้ากลุ่มสาระฯ (ลาป่วย)'
    : 'เสนอจัดครูสอนแทนโดยหัวหน้ากลุ่มสาระฯ';
  return SUBSTITUTE_STAGE_ORDER
    .filter((s): s is Exclude<SubstituteApprovalStage, 'COMPLETED'> => s !== 'COMPLETED')
    .map((stage, idx) => {
      if (idx === 0 && isHodProposer) {
        return {
          stage,
          approverRole: SUBSTITUTE_STAGE_ROLE[stage],
          approverName: proposerName,
          approverEmail: proposerEmail,
          status: 'APPROVED' as const,
          approvedAt: now,
          comment: approveComment,
        };
      }
      return {
        stage,
        approverRole: SUBSTITUTE_STAGE_ROLE[stage],
        approverName: '',
        approverEmail: '',
        status: 'PENDING' as const,
      };
    });
}

export const useStore = create<StoreState>((set, get) => ({
  user: null,
  currentDate: new Date(),
  isTimeSimulated: false,
  currentPeriod: 'คาบ 1',
  students: [],
  courses: [],
  globalCourses: [],
  homeroomAssignments: {},
  analytics: [],
  scheduleConfig: {
    isActivityDay: false,
    shortenMinutes: 0
  },
  schoolCheckInRecords: {},
  attendanceRecords: {},
  parentConferences: [],
  selfAssessments: {},

  // Student & Parent Extended Initial State (Clean empty arrays / objects)
  gateAttendanceLogs: [],
  semesterHealthLogs: {},
  chronicIllnesses: {},
  allergies: {},
  specialCareNeeds: {},
  twoQuestionScreenings: {},
  sdqAssessments: [],
  guardianProfiles: {},
  homeVisitLogs: [],
  eqfHardshipScreenings: {},
  meritDemeritLogs: [],
  portfolioItems: [],
  digitalCertificates: [],
  volunteerRecords: [],
  reportCards: {},
  examSchedules: [],
  billingInvoices: [],
  parentTeacherMessages: [],

  schoolGeofenceConfig: DEFAULT_SCHOOL_GEOFENCE,
  gpsCheckInLogs: [],
  activeLearningPoints: {},
  activeLearningLogs: [],
  courseScoreSettings: [],
  studentScores: [],
  substituteAssignments: [],
  postTeachingRecords: [],
  staffDirectory: [],

  schoolDuties: [],
  administrativeTasks: [],

  setUser: (user) => set({ user }),
  tickClock: (now = new Date()) => set((state) => {
    const next = nextClockValue(state.currentDate, now, state.isTimeSimulated, import.meta.env.DEV);
    return next.getTime() === state.currentDate.getTime() ? state : { currentDate: next };
  }),
  // production ไม่มีโหมดจำลองเวลา — กันไว้ที่ store ด้วย ไม่ใช่แค่ซ่อน modal
  setSimulatedTime: (date: Date) => {
    if (!import.meta.env.DEV) return;
    set({ currentDate: date, isTimeSimulated: true });
  },
  clearTimeSimulation: () => set({ currentDate: new Date(), isTimeSimulated: false }),
  
  setCurrentPeriod: (period: string) => set({ currentPeriod: period }),
  
  cycleAttendanceStatus: (courseId: string, studentId: string) => set((state) => {
    const courseRecords = state.attendanceRecords[courseId] || {};
    const currentStatus = courseRecords[studentId] || 'UNMARKED';
    const currentIndex = currentStatus === 'UNMARKED' ? -1 : STATUS_CYCLE.indexOf(currentStatus as AttendanceStatus);
    const nextStatus = STATUS_CYCLE[(currentIndex + 1) % STATUS_CYCLE.length];
    
    return {
      attendanceRecords: {
        ...state.attendanceRecords,
        [courseId]: {
          ...courseRecords,
          [studentId]: nextStatus
        }
      }
    };
  }),

  setAttendanceStatus: (courseId: string, studentId: string, status: AttendanceStatus) => set((state) => {
    const courseRecords = state.attendanceRecords[courseId] || {};
    return {
      attendanceRecords: {
        ...state.attendanceRecords,
        [courseId]: {
          ...courseRecords,
          [studentId]: status
        }
      }
    };
  }),

  // FIX (Task 0 — ตรวจสอบ behaviorScore): เดิมฟังก์ชันนี้แก้แค่ state.analytics (session-local,
  // เริ่มต้นว่างเปล่าเสมอและไม่เคยมีใคร push รายการใหม่เข้าไปเลย — เป็นแค่ .map() ทับของเดิมที่ไม่มีอยู่จริง)
  // ทำให้ปุ่ม +/- คะแนนพฤติกรรมในหน้าครูเป็นปุ่มหลอก: กดแล้วตัวเลขที่แสดงไม่เคยขยับเลยเพราะอ่านจาก
  // analytics.find() ที่ว่างเปล่าตลอดกาลอยู่ดี — เปลี่ยนไปเรียก Firestore transaction จริง
  // (updateBehaviorScoreAndTriggerAlert — เขียนไว้แล้วแต่ไม่เคยถูกเรียกใช้จริงมาก่อน) ซึ่งอัปเดต
  // students/{id}.behaviorScore + riskLevel, บันทึก discipline_logs, และสร้าง parent_notifications/
  // parent_conferences ของจริงให้เอง — ตัวเลขไหลกลับมาที่ UI ผ่าน useRealStudents() (real-time) แทน
  // รอผลเขียนจริง — ล้มเหลวแล้ว throw ให้ผู้เรียกแจ้งครู (ห้ามโชว์ว่าสำเร็จทั้งที่คะแนนไม่ถูกบันทึก)
  adjustBehaviorScore: async (studentId: string, amount: number, reason?: string) => {
    await updateBehaviorScoreAndTriggerAlert(studentId, amount, reason || 'ปรับคะแนนพฤติกรรมด่วนโดยครูผู้สอน');
  },

  // NOTE: คำขอเช็คชื่อย้อนหลังย้ายไป Firestore แล้ว (late_attendance_requests + firestoreService)
  // — เดิม action นี้เขียนแค่ local state ทำให้คำขอหายข้าม session

  setScheduleConfig: (config) => set({ scheduleConfig: config }),
  setGlobalCourses: (courses) => set({ globalCourses: courses }),
  setHomeroomAssignments: (assignments) => set({ homeroomAssignments: assignments }),
  
  markSchoolCheckIn: (studentId, status, time) => set((state) => ({
    schoolCheckInRecords: {
      ...state.schoolCheckInRecords,
      [studentId]: { status, time: time || new Date() }
    }
  })),

  moveStudentSeat: (studentId: string, newSeatIndex: number | null) => set((state) => {
    const students = [...state.students];
    const sourceIndex = students.findIndex(s => s.studentId === studentId);
    if (sourceIndex === -1) return state;

    const sourceStudent = students[sourceIndex];
    
    // Check if target seat is already occupied by someone else in the same room
    if (newSeatIndex !== null) {
      const targetIndex = students.findIndex(s => s.seatIndex === newSeatIndex && s.room === sourceStudent.room);
      if (targetIndex !== -1 && targetIndex !== sourceIndex) {
        // Swap their seats
        const targetStudent = students[targetIndex];
        students[targetIndex] = { ...targetStudent, seatIndex: sourceStudent.seatIndex };
      }
    }
    
    students[sourceIndex] = { ...sourceStudent, seatIndex: newSeatIndex };
    return { students };
  }),

  resetClassroomSeats: (room?: string) => set((state) => {
    const isSameRoom = (r1?: string, r2?: string) => {
      if (!r1 || !r2) return true;
      const n1 = r1.replace(/^M\./i, 'ม.').trim();
      const n2 = r2.replace(/^M\./i, 'ม.').trim();
      return n1 === n2;
    };

    const students = state.students.map(s => {
      if (!room || isSameRoom(s.room, room)) {
        return { ...s, seatIndex: null };
      }
      return s;
    });

    return { students };
  }),

  autoAssignClassroomSeats: (room?: string, capacity = 40) => set((state) => {
    const isSameRoom = (r1?: string, r2?: string) => {
      if (!r1 || !r2) return true;
      const n1 = r1.replace(/^M\./i, 'ม.').trim();
      const n2 = r2.replace(/^M\./i, 'ม.').trim();
      return n1 === n2;
    };

    const roomStudents = state.students.filter(s => !room || isSameRoom(s.room, room));
    const occupiedSeats = new Set<number>();
    roomStudents.forEach(s => {
      if (s.seatIndex !== null && s.seatIndex !== undefined && s.seatIndex < capacity) {
        occupiedSeats.add(s.seatIndex);
      }
    });

    let nextSeat = 0;
    const students = state.students.map(s => {
      if (!room || isSameRoom(s.room, room)) {
        if (s.seatIndex === null || s.seatIndex === undefined || s.seatIndex >= capacity) {
          while (occupiedSeats.has(nextSeat) && nextSeat < capacity) {
            nextSeat++;
          }
          if (nextSeat < capacity) {
            occupiedSeats.add(nextSeat);
            const assigned = nextSeat;
            nextSeat++;
            return { ...s, seatIndex: assigned };
          }
        }
      }
      return s;
    });

    return { students };
  }),
  setCourses: (courses: Course[]) => set({ courses }),
  updateCourseSchedule: (courseId: string, newSchedule: string) => set((state) => ({
    courses: state.courses.map(c => c.id === courseId ? { ...c, schedule: newSchedule } : c),
    globalCourses: state.globalCourses.map(c => c.courseId === courseId ? { ...c, scheduleString: newSchedule } : c)
  })),
  markAttendanceDone: (courseId: string) => set((state) => {
    // 1. Update matching courses in state.courses
    let matchedAny = false;
    let updatedCourses = state.courses.map(c => {
      if (
        c.id === courseId ||
        c.code === courseId ||
        courseId.includes(c.id) ||
        (courseId.includes(c.code) && (courseId.includes('5/8') ? c.room.includes('5/8') : courseId.includes('5/9') ? c.room.includes('5/9') : true))
      ) {
        matchedAny = true;
        return { ...c, attendanceTaken: true };
      }
      return c;
    });

    // If not found in updatedCourses, add or update an entry for this courseId
    const exists = updatedCourses.some(c => c.id === courseId);
    if (!exists) {
      const gc = state.globalCourses.find(g => g.courseId === courseId || courseId.includes(g.code));
      updatedCourses.push({
        id: courseId,
        code: gc ? gc.code : courseId.split('-')[0],
        name: gc ? gc.courseName : 'รายวิชา',
        room: gc ? gc.roomName : '', // ไม่รู้ห้อง = ว่าง (ห้ามเติมห้อง/จำนวนนักเรียนปลอม)
        term: '1/2569',
        attendanceTaken: true,
        periodIndex: 1,
        schedule: gc ? gc.scheduleString : 'พ0'
      });
    }

    // 2. Also populate attendanceRecords with default PRESENT for all students
    const existingRecords = state.attendanceRecords[courseId] || {};
    const newRecords = { ...existingRecords };
    state.students.forEach(s => {
      if (!newRecords[s.studentId]) {
        newRecords[s.studentId] = 'PRESENT';
      }
    });

    return {
      courses: updatedCourses,
      attendanceRecords: {
        ...state.attendanceRecords,
        [courseId]: newRecords
      }
    };
  }),
  updateMorningAttendance: (studentId, status, method) => set((state) => ({
    students: state.students.map(s => {
      if (s.studentId === studentId) {
        const isAbsentOrLeave = status === 'ABSENT' || status === 'LEAVE';
        return {
          ...s,
          attendance: {
            morningStatus: status,
            checkInMethod: isAbsentOrLeave ? null : method,
            checkInTime: isAbsentOrLeave ? null : new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }) + ' น.'
          }
        };
      }
      return s;
    })
  })),
  // เขียน Firestore ก่อน (throw เมื่อไม่สำเร็จ) แล้วค่อยอัปเดต state — ห้ามแจ้งบันทึกสำเร็จทั้งที่ยังไม่ได้บันทึก
  submitPostTeachingRecord: async (record) => {
    await savePostTeachingRecordFirestore(record);
    set((state) => ({
      postTeachingRecords: [
        ...state.postTeachingRecords.filter(r => !(r.courseId === record.courseId && r.date === record.date)),
        record
      ]
    }));
  },
  assignSubstituteTeacher: (assignment) => {
    const newAss: SubstituteAssignment = { ...assignment, id: 'sub-' + Date.now() };
    saveSubstituteAssignmentFirestore(newAss).catch(err => console.warn('Firestore substitute assignment notice:', err));
    return set((state) => ({
      substituteAssignments: [
        ...state.substituteAssignments,
        newAss
      ]
    }));
  },
  removeSubstituteAssignment: (id) => set((state) => ({
    substituteAssignments: state.substituteAssignments.filter(sa => sa.id !== id)
  })),

  setStaffDirectory: (staff) => set({ staffDirectory: staff }),
  setSubstituteAssignments: (list) => set({ substituteAssignments: list }),
  setPostTeachingRecords: (list) => set({ postTeachingRecords: list }),

  // เสนอจัดครูสอนแทน — สร้าง approval chain 4 ขั้น (ขั้นที่ 1 = หัวหน้ากลุ่มสาระฯ ผู้เสนอ ถือว่าอนุมัติแล้ว)
  proposeSubstituteAssignment: async (payload) => {
    const now = new Date().toISOString();
    const existing = payload.id
      ? get().substituteAssignments.find(s => s.id === payload.id)
      : undefined;
    const id =
      payload.id ||
      (payload.leaveRequestId
        ? `sub_${payload.leaveRequestId}_${payload.courseId}`
        : `sub_${payload.courseId}_${payload.date}_${Date.now()}`);

    const proposerEmail = payload.proposedByEmail || '';
    const proposerName = payload.proposedByName || '';
    // ขั้นที่ 1 ถือว่าอนุมัติโดยผู้เสนอทันที เฉพาะกรณีผู้เสนอคือหัวหน้ากลุ่มสาระฯ ตัวจริง หรือผู้ได้รับ
    // มอบหมายให้ปฏิบัติหน้าที่แทน (actingAsBackupApproverForDeptId — ตอนหัวหน้ากลุ่มสาระฯ ลาป่วยเอง)
    // — ถ้าครูขอลากิจ/ไปราชการด้วยตนเอง (proposedByRole เป็น SUBJECT_TEACHER/HOMEROOM_TEACHER ธรรมดา)
    // ขั้นที่ 1 ต้องรอหัวหน้ากลุ่มสาระฯ มาอนุมัติจริงก่อน ห้าม auto-approve แทน
    const isHodProposer = payload.proposedByRole === 'HEAD_OF_DEPARTMENT' || !!payload.actingAsBackupApproverForDeptId;
    const chain = buildSubstituteApprovalChain(isHodProposer, proposerEmail, proposerName, now, payload.actingAsBackupApproverForDeptId);

    // ครูที่ถูกมอบหมาย (substituteTeacherEmail) ต้องกดยืนยันก่อนเข้า approval chain — ยกเว้น
    // กรณีลาป่วย (isHodProposer) ซึ่งเป็นสถานการณ์ฉุกเฉินวันเดียวกัน หัวหน้ากลุ่มสาระฯ ต้องสั่งการ
    // ให้ครูเข้าสอนแทนได้ทันที ไม่ต้องรอยืนยันในแอพก่อน (ยืนยันจากโรงเรียนแล้ว — ต่างจากลากิจ/
    // ไปราชการที่ครูขอเอง ซึ่งยังต้องผ่านขั้นตอนนี้เหมือนเดิม)
    // สำหรับกรณีที่ยังต้องยืนยัน — ยกเว้น "resubmit" รายการที่ครูสอนแทน "คนเดิม" เคยกดยืนยันไปแล้ว
    // ครั้งหนึ่ง (ถูกส่งกลับจากขั้นอนุมัติ แล้วผู้เสนอแก้ไขรายละเอียดส่งใหม่โดยไม่เปลี่ยนตัวครู —
    // ไม่ต้องยืนยันซ้ำ) — ถ้าเปลี่ยนไปเลือกครูสอนแทนคนใหม่ (เช่น คนเดิมกดปฏิเสธ) ต้องให้คนใหม่ยืนยันเสมอ
    const alreadyConfirmedBySubstitute =
      !!existing?.teacherConfirmedAt &&
      existing.substituteTeacherEmail?.toLowerCase() === payload.substituteTeacherEmail?.toLowerCase();
    const needsTeacherConfirmation = !isHodProposer && !alreadyConfirmedBySubstitute;

    const { id: _ignored, ...rest } = payload;
    const assignment: SubstituteAssignment = {
      ...rest,
      id,
      status: needsTeacherConfirmation ? 'PENDING_TEACHER_CONFIRMATION' : 'PENDING_APPROVAL',
      currentApprovalStage: isHodProposer ? 'STAGE_2_ACADEMIC_HEAD' : 'STAGE_1_HEAD_OF_DEPARTMENT',
      approvalChain: chain,
      postTeachingDueAt: `${payload.date}T23:59:59`,
      isCompleted: false,
      teacherConfirmedAt: alreadyConfirmedBySubstitute ? existing?.teacherConfirmedAt : undefined,
      rejectionReason: undefined,
      rejectedAt: undefined,
      rejectedByName: undefined,
      rejectedByRole: undefined,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    await saveSubstituteAssignmentFirestore(assignment);

    set((state) => ({
      substituteAssignments: [
        ...state.substituteAssignments.filter(s => s.id !== id),
        assignment,
      ],
    }));

    return assignment;
  },

  // แลกคาบสอนสองทาง (วิธี A) — เขียน 2 document พร้อมกันแบบ atomic ผูกกันด้วย linkedSwapId
  // ทั้งคู่เริ่มที่ PENDING_TEACHER_CONFIRMATION เสมอ (ยังไม่รองรับ resubmit คู่แลกคาบที่เคยยืนยันแล้ว
  // — ถือเป็นคำขอใหม่ทุกครั้ง ต่างจาก proposeSubstituteAssignment เดี่ยวที่ resubmit ได้)
  proposeSubstituteSwap: async (legA, legB) => {
    const now = new Date().toISOString();
    const idA = legA.id || `sub_${legA.courseId}_${legA.date}_${Date.now()}_a`;
    const idB = legB.id || `sub_${legB.courseId}_${legB.date}_${Date.now()}_b`;

    const buildLeg = (payload: typeof legA, id: string, linkedId: string): SubstituteAssignment => {
      const proposerEmail = payload.proposedByEmail || '';
      const proposerName = payload.proposedByName || '';
      const isHodProposer = payload.proposedByRole === 'HEAD_OF_DEPARTMENT' || !!payload.actingAsBackupApproverForDeptId;
      const chain = buildSubstituteApprovalChain(isHodProposer, proposerEmail, proposerName, now, payload.actingAsBackupApproverForDeptId);
      const { id: _ignored, ...rest } = payload;
      return {
        ...rest,
        id,
        // เช่นเดียวกับ proposeSubstituteAssignment — ถ้า HOD เป็นผู้เสนอ (เช่น จัดสอนแทนกรณีลาป่วย)
        // ข้าม gate ยืนยันตัวตนไปเลย เข้าสู่การอนุมัติทันที ไม่ต้องรอครูกดยืนยัน
        status: isHodProposer ? 'PENDING_APPROVAL' : 'PENDING_TEACHER_CONFIRMATION',
        currentApprovalStage: isHodProposer ? 'STAGE_2_ACADEMIC_HEAD' : 'STAGE_1_HEAD_OF_DEPARTMENT',
        approvalChain: chain,
        postTeachingDueAt: `${payload.date}T23:59:59`,
        isCompleted: false,
        swapMode: 'SWAP',
        linkedSwapId: linkedId,
        createdAt: now,
        updatedAt: now,
      };
    };

    const assignmentA = buildLeg(legA, idA, idB);
    const assignmentB = buildLeg(legB, idB, idA);

    await saveSubstituteSwapPairFirestore(assignmentA, assignmentB);

    set((state) => ({
      substituteAssignments: [
        ...state.substituteAssignments.filter(s => s.id !== idA && s.id !== idB),
        assignmentA,
        assignmentB,
      ],
    }));

    return { legA: assignmentA, legB: assignmentB };
  },

  // ครูที่ถูกมอบหมาย (substituteTeacherEmail) ยืนยัน/ปฏิเสธ ก่อนเข้า approval chain 4 ขั้น
  respondToTeacherConfirmation: async (id, decision, responder, reason) => {
    const target = get().substituteAssignments.find(s => s.id === id);
    if (!target) throw new Error('ไม่พบรายการจัดครูสอนแทน');
    if (target.status !== 'PENDING_TEACHER_CONFIRMATION') {
      throw new Error('รายการนี้ไม่ได้อยู่ในสถานะรอยืนยันจากครูสอนแทน');
    }
    if (target.substituteTeacherEmail?.toLowerCase() !== responder.email.toLowerCase()) {
      throw new Error('เฉพาะครูที่ถูกมอบหมายให้สอนแทนคาบนี้เท่านั้นที่ยืนยัน/ปฏิเสธได้');
    }
    if (decision === 'DECLINE' && !reason?.trim()) {
      throw new Error('การปฏิเสธต้องระบุเหตุผล');
    }

    const now = new Date().toISOString();
    const buildPatch = (): Partial<SubstituteAssignment> =>
      decision === 'DECLINE'
        ? {
            status: 'REJECTED',
            rejectionReason: reason?.trim() || '',
            rejectedAt: now,
            rejectedByName: responder.name,
            rejectedByRole: SUBSTITUTE_TEACHER_DECLINED_ROLE,
          }
        : { status: 'PENDING_APPROVAL', teacherConfirmedAt: now };

    const patch = buildPatch();
    const patches: { id: string; patch: Partial<SubstituteAssignment> }[] = [{ id: target.id, patch }];

    // คู่แลกคาบ (SWAP) — ยืนยัน/ปฏิเสธฝั่งเดียว cascade ไปอีกฝั่งเสมอ เพราะเป็นข้อตกลงเดียวกัน
    // (กันกรณีอีกฝั่งค้างเป็นภาระผูกพันครึ่งๆ กลางๆ โดยไม่มีใครยืนยัน)
    if (target.swapMode === 'SWAP' && target.linkedSwapId) {
      const linked = get().substituteAssignments.find(s => s.id === target.linkedSwapId);
      if (linked && linked.status === 'PENDING_TEACHER_CONFIRMATION') {
        patches.push({ id: linked.id, patch });
      }
    }

    await updateSubstituteAssignmentsBatchFirestore(patches);

    set((state) => ({
      substituteAssignments: state.substituteAssignments.map(a => {
        const found = patches.find(p => p.id === a.id);
        return found ? { ...a, ...found.patch } : a;
      }),
    }));

    // แจ้งผู้เสนอ (ไม่ใช่ผู้กด) — non-fatal: ผลบันทึกแล้ว
    void sendStaffNotifications(
      substituteUpdateNotices(target, decision === 'DECLINE' ? { type: 'TEACHER_DECLINED', reason: reason?.trim() || '' } : { type: 'TEACHER_CONFIRMED' }, responder.name, responder.email),
      { uid: get().user?.uid || '', name: responder.name },
    );
  },

  // อนุมัติ/ปฏิเสธ ตามลำดับขั้น — sequential, ห้ามบุคคลเดียวข้ามหลายขั้น
  decideSubstituteApproval: async (id, decision, approver, comment) => {
    const target = get().substituteAssignments.find(s => s.id === id);
    if (!target) throw new Error('ไม่พบรายการจัดครูสอนแทน');
    if (target.status !== 'PENDING_APPROVAL') {
      throw new Error('รายการนี้ไม่อยู่ในสถานะรออนุมัติ (อาจรอครูสอนแทนยืนยันก่อน หรือดำเนินการเสร็จแล้ว)');
    }

    const stage = target.currentApprovalStage;
    if (!stage || stage === 'COMPLETED') {
      throw new Error('รายการนี้ผ่านการอนุมัติครบทุกขั้นแล้ว');
    }

    const chain = (target.approvalChain || []).map(s => ({ ...s }));
    const stepIdx = chain.findIndex(s => s.stage === stage);
    if (stepIdx === -1) throw new Error('ไม่พบข้อมูลขั้นอนุมัติปัจจุบัน');

    const requiredRole = SUBSTITUTE_STAGE_ROLE[stage as Exclude<SubstituteApprovalStage, 'COMPLETED'>];
    if (approver.role !== requiredRole) {
      throw new Error(`ขั้นอนุมัตินี้สงวนสิทธิ์เฉพาะบทบาท ${requiredRole} เท่านั้น`);
    }

    // ห้ามบุคคลเดียวปรากฏซ้ำในหลายขั้น (รวมถึงผู้เสนอขั้นที่ 1)
    const priorApprovers = chain
      .slice(0, stepIdx)
      .map(s => s.approverEmail?.toLowerCase())
      .filter(Boolean);
    if (priorApprovers.includes(approver.email.toLowerCase())) {
      throw new Error('บุคคลนี้ได้อนุมัติในขั้นก่อนหน้าแล้ว — ต้องแยกผู้อนุมัติตามลำดับ 4 ขั้น');
    }

    if (chain.slice(0, stepIdx).some(s => s.status !== 'APPROVED')) {
      throw new Error('ยังมีขั้นอนุมัติก่อนหน้าที่ยังไม่เสร็จสิ้น');
    }

    const decidedAt = new Date().toISOString();
    let patch: Partial<SubstituteAssignment>;

    if (decision === 'REJECT') {
      chain[stepIdx] = {
        ...chain[stepIdx],
        status: 'REJECTED',
        approverName: approver.name,
        approverEmail: approver.email,
        approvedAt: decidedAt,
        comment: comment || '',
      };
      patch = {
        approvalChain: chain,
        status: 'REJECTED',
        rejectionReason: comment || '',
        rejectedAt: decidedAt,
        rejectedByName: approver.name,
        rejectedByRole: approver.role,
      };
    } else {
      chain[stepIdx] = {
        ...chain[stepIdx],
        status: 'APPROVED',
        approverName: approver.name,
        approverEmail: approver.email,
        approvedAt: decidedAt,
        comment: comment || '',
      };
      const nextStage =
        SUBSTITUTE_STAGE_ORDER[SUBSTITUTE_STAGE_ORDER.indexOf(stage) + 1] || 'COMPLETED';
      patch = {
        approvalChain: chain,
        currentApprovalStage: nextStage,
        status: nextStage === 'COMPLETED' ? 'APPROVED' : 'PENDING_APPROVAL',
      };
    }

    // คู่แลกคาบ (SWAP) — ถ้าฝ่ายอนุมัติปฏิเสธฝั่งใดฝั่งหนึ่งระหว่างลำดับ 4 ขั้น cascade ไปอีกฝั่งเสมอ
    // (กันภาระผูกพันค้างฝั่งเดียว — swap เป็นข้อตกลงแบบให้-รับพร้อมกัน ถ้าฝั่งหนึ่งไม่ผ่านอีกฝั่งก็ควรล้มด้วย)
    const patches: { id: string; patch: Partial<SubstituteAssignment> }[] = [{ id, patch }];
    if (decision === 'REJECT' && target.swapMode === 'SWAP' && target.linkedSwapId) {
      const linked = get().substituteAssignments.find(s => s.id === target.linkedSwapId);
      if (linked && linked.status !== 'REJECTED' && linked.status !== 'APPROVED') {
        patches.push({
          id: linked.id,
          patch: {
            status: 'REJECTED',
            rejectionReason: `ยกเลิกอัตโนมัติ — อีกฝั่งของคู่แลกคาบถูกส่งกลับแก้ไข (${comment || 'ไม่ระบุเหตุผล'})`,
            rejectedAt: decidedAt,
            rejectedByName: approver.name,
            rejectedByRole: approver.role,
          },
        });
      }
    }

    if (patches.length > 1) {
      await updateSubstituteAssignmentsBatchFirestore(patches);
    } else {
      await updateSubstituteAssignmentFirestore(id, patch);
    }
    set((state) => ({
      substituteAssignments: state.substituteAssignments.map(a => {
        const found = patches.find(p => p.id === a.id);
        return found ? { ...a, ...found.patch } : a;
      }),
    }));

    // แจ้งผู้เกี่ยวข้อง (ผู้เสนอ/ครูสอนแทน/ครูเจ้าของคาบ) — non-fatal: ผลอนุมัติบันทึกแล้ว
    const stageLabel = SUBSTITUTE_STAGE_LABEL[stage] || String(stage);
    void sendStaffNotifications(
      substituteUpdateNotices(
        target,
        decision === 'REJECT'
          ? { type: 'REJECTED', stageLabel, reason: comment || '' }
          : { type: 'STAGE_APPROVED', stageLabel, completed: patch.status === 'APPROVED' },
        approver.name, approver.email,
      ),
      { uid: get().user?.uid || '', name: approver.name },
    );
  },

  // บันทึกหลังสอนแทน — flag overdue ถ้าเลย 24:00 น. ของวันที่สอน + เขียน post_teaching_records จริง
  completeSubstituteAssignment: async (id, completion) => {
    const target = get().substituteAssignments.find(s => s.id === id);
    if (!target) throw new Error('ไม่พบรายการจัดครูสอนแทน');
    if (target.status !== 'APPROVED') {
      throw new Error('รายการนี้ยังอนุมัติไม่ครบ 4 ขั้น จึงยังบันทึกหลังสอนไม่ได้');
    }

    const nowIso = new Date().toISOString();
    const dueAt = target.postTeachingDueAt || `${target.date}T23:59:59`;
    const isLate = Date.now() > new Date(dueAt).getTime();

    const patch: Partial<SubstituteAssignment> = {
      isCompleted: true,
      completedAt: nowIso,
      completionSummary: completion.summary,
      completionProblems: completion.problems || '',
      completionSolutions: completion.solutions || '',
      completionAttendance: completion.attendance || {},
      isLate,
    };
    await updateSubstituteAssignmentFirestore(id, patch);

    const record: PostTeachingRecord = {
      courseId: target.courseId,
      date: target.date,
      summary: `[ปฏิบัติหน้าที่สอนแทน ${target.originalTeacherName || target.originalTeacherEmail} โดย ${target.substituteTeacherName || target.substituteTeacherEmail}] ${completion.summary}`,
      problems: completion.problems || 'ไม่มี',
      solutions: completion.solutions || 'ไม่มี',
      submittedAt: nowIso,
      isLate,
    };
    await savePostTeachingRecordFirestore(record);

    set((state) => ({
      substituteAssignments: state.substituteAssignments.map(a =>
        a.id === id ? { ...a, ...patch } : a
      ),
      postTeachingRecords: [
        ...state.postTeachingRecords.filter(r => !(r.courseId === record.courseId && r.date === record.date)),
        record,
      ],
    }));
  },
  updateSchoolDutyStatus: (dutyId, status) => set((state) => ({
    schoolDuties: state.schoolDuties.map(d => d.dutyId === dutyId ? { ...d, status } : d)
  })),
  submitSchoolDutyLog: (dutyId) => set((state) => ({
    schoolDuties: state.schoolDuties.map(d => d.dutyId === dutyId ? { ...d, logSubmitted: true } : d)
  })),
  updateAdministrativeTaskStatus: (taskId, status) => set((state) => ({
    administrativeTasks: state.administrativeTasks.map(t => t.taskId === taskId ? { ...t, status } : t)
  })),
  updateStudentScore: (courseId, studentId, scores) => set((state) => {
    const existing = state.studentScores.find(s => s.courseId === courseId && s.studentId === studentId);
    if (existing) {
      return {
        studentScores: state.studentScores.map(s => 
          (s.courseId === courseId && s.studentId === studentId) ? { ...s, ...scores } : s
        )
      };
    } else {
      return {
        studentScores: [
          ...state.studentScores,
          { 
            id: `score-${Date.now()}-${Math.random()}`, 
            courseId, 
            studentId, 
            preMidterm: 0, 
            midterm: 0, 
            postMidterm: 0, 
            final: 0, 
            total: 0, 
            grade: '', 
            ...scores 
          }
        ]
      };
    }
  }),
  updateCourseScoreSetting: (setting) => set((state) => {
    const existing = state.courseScoreSettings.find(s => s.courseId === setting.courseId);
    if (existing) {
      return {
        courseScoreSettings: state.courseScoreSettings.map(s => s.courseId === setting.courseId ? setting : s)
      };
    }
    return { courseScoreSettings: [...state.courseScoreSettings, setting] };
  }),

  // FIX (ระบบแจ้งเตือนรวมศูนย์): เดิม push เข้า state.parentNotifications แบบ session-local ล้วนๆ
  // (ไม่เคยเขียน Firestore) เปลี่ยนเป็นเขียนจริงผ่าน createParentNotification() — ถ้าไม่มี parentUid
  // จริง (นักเรียนยังไม่เชื่อมบัญชีผู้ปกครอง) ฟังก์ชันนั้นจะข้ามการเขียนไปเอง ไม่ fabricate ID ปลอม
  // แบบ `parent_${studentId}` ที่เคยเป็นมา (เขียนไปก็ไม่มีผู้ปกครองคนไหนอ่านได้จริงอยู่ดี)
  scheduleConference: (conferenceId: string, date: string, time: string) => {
    let studentId = '';
    let studentName = '';
    let parentUid = '';
    let studentUid: string | undefined;

    set((state) => {
      const updatedConferences = state.parentConferences.map(c => {
        if (c.id === conferenceId) {
          studentId = c.studentId;
          studentName = c.studentName;
          return {
            ...c,
            status: 'SCHEDULED' as const,
            scheduledDate: date,
            scheduledTime: time
          };
        }
        return c;
      });

      const student = state.students.find(s => s.studentId === studentId);
      parentUid = (student as any)?.parentUid || (student as any)?.parentId || '';
      studentUid = student?.studentUid;

      return { parentConferences: updatedConferences };
    });

    createParentNotification({
      parentUid,
      studentUid,
      studentId,
      studentName,
      title: '🗓️ ยืนยันการนัดพบคณะกรรมการสถานศึกษาเรียบร้อยแล้ว',
      message: `ระบบยืนยันสิทธิ์การนัดหมายพบฝ่ายปกครองของน้อง${studentName} ในวัน${date} เวลา ${time} เรียบร้อยแล้ว คณะครูและฝ่ายปกครองยินดีต้อนรับค่ะ`,
      type: 'info',
    }).catch(err => console.warn('Firestore parent notification notice:', err));
  },

  addActiveLearningPoints: async (studentId: string, points: number, category: ActiveLearningCategory = 'GENERAL', note?: string, courseId?: string, extra?: ActiveLearningExtra) => {
    // ไม่มี staffId = ไม่ใช่ครูที่ระบุตัวได้ → rules จะปฏิเสธ (ครูผู้ให้ต้องเป็นเจ้าของ log ผ่าน claim staffId)
    const teacherStaffId = get().user?.staffId;
    const newLog: ActiveLearningRecord = {
      id: `al-log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      studentId,
      courseId,
      points,
      category,
      note,
      awardedAt: new Date().toISOString(),
      ...(extra?.courseName ? { courseName: extra.courseName } : {}),
      ...(extra?.courseKey ? { courseKey: extra.courseKey } : {}),
      ...(extra?.homeroomClass ? { homeroomClass: extra.homeroomClass } : {}),
      ...(teacherStaffId ? { teacherStaffId } : {}),
      ...(extra?.academicYear && extra?.term ? { academicYear: extra.academicYear, term: extra.term } : {}),
    };
    // เขียน Firestore สำเร็จก่อนค่อยอัปเดตแต้มในหน้าจอ (ล้มเหลว = throw ไม่แสดงแต้มที่ไม่มีอยู่จริง)
    await saveActiveLearningLogFirestore(newLog);

    set((state) => {
      const currentPoints = state.activeLearningPoints[studentId] || 0;
      const newPoints = Math.max(0, currentPoints + points);
      return {
        activeLearningPoints: {
          ...state.activeLearningPoints,
          [studentId]: newPoints
        },
        activeLearningLogs: [newLog, ...state.activeLearningLogs]
      };
    });
  },

  saveSelfAssessment: async (assessment: StudentSelfAssessment) => {
    const updated: StudentSelfAssessment = {
      ...assessment,
      updatedAt: new Date().toISOString(),
      submittedAt: assessment.submittedAt || new Date().toISOString(),
      isCompleted: true
    };

    // เขียน Firestore จริงก่อน — ล้มเหลวต้อง throw ให้ฟอร์มแจ้งผู้ใช้ (เดิมกลืน error แล้วแจ้งสำเร็จทั้งที่ไม่ได้บันทึก
    // ทำให้ข้อมูลหายตอนกลับมาเปิด และครูที่ปรึกษาไม่เห็น)
    await saveSelfAssessmentRecord(updated);

    set((state) => ({
      selfAssessments: {
        ...state.selfAssessments,
        [assessment.studentId]: updated
      }
    }));
  },


  // ใบลานักเรียนย้ายไป Firestore จริงทั้งสาย (createLeaveRequest/acknowledgeLeaveRequest/decideLeaveRequest ใน
  // firestoreService + subscribeLeaveRequests) — ไม่มีสถานะใบลาใน store อีกต่อไป (เดิม session-local + ผู้อนุมัติฝังชื่อ)

  // FIX: save2QScreening/submitSDQAssessment เดิม fire-and-forget การเขียน Firestore จริง (.catch แค่ console.warn)
  // แล้ว set optimistic state ทันทีไม่ว่าผลจริงจะเป็นอย่างไร — ผู้ใช้เห็น "บันทึกสำเร็จ" ปลอมทั้งที่
  // rules ปฏิเสธจริงอยู่เบื้องหลัง เปลี่ยนเป็น await ก่อน แล้วค่อย set state/return ตอนเขียนสำเร็จจริง
  // เท่านั้น — โยน error ต่อให้ผู้เรียก (component) จับแสดงผลจริงแทนการโชว์สำเร็จลอยๆ
  save2QScreening: async (studentId: string, q1: boolean, q2: boolean) => {
    const isPositive = q1 || q2;
    const screening: TwoQuestionScreening = {
      id: `2q-${Date.now()}`,
      studentId,
      q1Depressed: q1,
      q2Hopeless: q2,
      isPositive,
      conductedAt: format(new Date(), 'yyyy-MM-dd')
    };
    await save2QScreeningFirestore(studentId, screening);

    set((state) => ({
      twoQuestionScreenings: {
        ...state.twoQuestionScreenings,
        [studentId]: screening
      }
    }));
  },

  submitSDQAssessment: async (sdq) => {
    if (!isValidAcademicYear(sdq.academicYear)) {
      throw new Error('ไม่พบปีการศึกษาปัจจุบัน (school_settings/academic_year) — บันทึก SDQ ไม่ได้');
    }
    const newSDQ: SDQAssessment = {
      ...sdq,
      // id ตายตัวต่อ (นักเรียน, ผู้ประเมิน, ปี) — กรอกซ้ำในปีเดียวกันชนกับเอกสารเดิม (rules ห้ามผู้กรอกแก้/ทับ)
      id: sdqDocId(sdq.studentId, sdq.evaluatorType, sdq.academicYear),
      assessmentDate: format(new Date(), 'yyyy-MM-dd')
    };
    await saveSDQAssessmentFirestore(newSDQ);

    set((state) => ({
      sdqAssessments: [newSDQ, ...state.sdqAssessments]
    }));
  },

  addMeritDemeritRecord: (studentId: string, type: 'MERIT' | 'DEMERIT', points: number, category: string, description: string, teacherName: string) => {
    const newRecord: MeritDemeritRecord = {
      id: `md-${Date.now()}`,
      studentId,
      type,
      points: type === 'MERIT' ? Math.abs(points) : -Math.abs(points),
      category,
      description,
      teacherName,
      date: format(new Date(), 'yyyy-MM-dd'),
      academicYear: '2569'
    };

    const delta = type === 'MERIT' ? Math.abs(points) : -Math.abs(points);
    // FIX (Task 0 — ตรวจสอบ behaviorScore): behaviorScore ตอนนี้อัปเดตจริงผ่าน Firestore
    // transaction เดียวกับ adjustBehaviorScore ด้านบน (updateBehaviorScoreAndTriggerAlert) —
    // ไม่แก้ state.analytics (dead — ไม่เคยมีใครอ่านค่าที่ .map() ทับตรงนี้จริง) และไม่ push
    // parentNotifications ปลอมที่นี่อีกต่อไป (ของจริง remainingScore ถูกต้อง ถูกสร้างใน
    // ทรานแซกชันเดียวกันแล้ว — ของเดิม hardcode remainingScore: 95 เสมอไม่ว่าคะแนนจริงเท่าไหร่)
    updateBehaviorScoreAndTriggerAlert(studentId, delta, `${category}: ${description} (บันทึกโดย ${teacherName})`)
      .catch(err => console.warn('[addMeritDemeritRecord] Firestore behavior score update failed:', err));

    // ⚠️ ยังไม่ได้แก้ในรอบนี้: meritDemeritLogs (ประวัติรายการที่แสดงในแท็บ "ประวัติ" ของ
    // BehaviorDisciplineModule) ยังเป็น session-local เหมือนเดิม — ตัวคะแนนสะสม (behaviorScore)
    // ที่แสดงจริงทุกหน้าตอนนี้เป็นของจริงแล้ว แต่ประวัติรายละเอียดยังไม่ sync ข้าม session/เครื่อง
    // (ของจริงถูกเขียนไปที่ Firestore collection `discipline_logs` แล้วโดย
    // updateBehaviorScoreAndTriggerAlert ข้างต้น — แค่ยังไม่มีจุดไหนอ่านกลับมาแสดงแบบ real-time)
    set((state) => ({ meritDemeritLogs: [newRecord, ...state.meritDemeritLogs] }));
  },

  addPortfolioItem: (item) => set((state) => {
    const newItem: PortfolioItem = {
      ...item,
      id: `port-${Date.now()}`,
      // ผลงานที่นักเรียนเพิ่มเองต้องรอครูที่ปรึกษาอนุมัติ — ห้ามระบุว่าครูคนใดยืนยันโดยอัตโนมัติ
      isVerifiedByTeacher: false
    };
    return { portfolioItems: [newItem, ...state.portfolioItems] };
  }),

  addDigitalCertificate: (cert) => set((state) => {
    const newCert: DigitalCertificate = {
      ...cert,
      id: `cert-${Date.now()}`
    };
    return { digitalCertificates: [newCert, ...state.digitalCertificates] };
  }),

  submitVolunteerHours: (rec) => set((state) => {
    const newVol: VolunteerHourRecord = {
      ...rec,
      id: `vol-${Date.now()}`,
      status: 'APPROVED'
    };
    return { volunteerRecords: [newVol, ...state.volunteerRecords] };
  }),

  sendParentTeacherMessage: async (studentId: string, senderRole: ParentTeacherMessage['senderRole'], senderName: string, message: string) => {
    const newMsg: ParentTeacherMessage = {
      id: `msg-${Date.now()}`,
      studentId,
      senderRole,
      senderName,
      message,
      timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.',
      read: true
    };
    await sendParentTeacherMessageFirestore(newMsg);

    set((state) => ({
      parentTeacherMessages: [...state.parentTeacherMessages, newMsg]
    }));
  },

  // บันทึกเช็คอิน GPS — เขียน Firestore ก่อน (throw เมื่อไม่สำเร็จ) แล้วค่อยอัปเดต state; ห้ามแจ้งสำเร็จทั้งที่ยังไม่ได้บันทึก
  addGPSCheckInLog: async (log) => {
    const isStudent = String(log.userRole || '').toUpperCase() === 'STUDENT';
    const authUid = get().user?.uid;
    // รูปเซลฟี่ไม่ฝังในเอกสารเช็คอิน/ประตู (เอกสารเล็ก อ่านเร็ว) — แยกไป gps_checkin_selfies พร้อมวันหมดอายุ
    const { selfieUrl: selfieDataUrl, ...logNoSelfie } = log;
    const newLog: GPSCheckInLog = {
      ...logNoSelfie,
      id: `gps-log-${Date.now()}`,
      ...(selfieDataUrl ? { hasSelfie: true } : {}),
      // ใส่ auth uid ของผู้เช็คอินจริง ให้ rules เทียบ (userId เป็นรหัสนักเรียน/บุคลากร ไม่ใช่ uid)
      ...(authUid ? { authUid } : {}),
    };
    const matchedStudent = isStudent
      ? get().students.find(s => s.studentId === log.userId || s.id === log.userId)
      : undefined;

    let gateLog: GateAttendanceRecord | null = null;
    if (isStudent) {
      const parentUid = matchedStudent?.parentUid || matchedStudent?.parentId;
      // studentUid ต้องเป็น auth uid ของนักเรียนที่เช็คอินจริง (rules เทียบกับ request.auth.uid)
      // rules เทียบกับ request.auth.uid — ใช้ uid ที่ล็อกอินอยู่จริงก่อน (studentUid ใน students doc อาจว่าง/ไม่ตรง ทำให้ถูกปฏิเสธ)
      const studentUid = authUid || matchedStudent?.studentUid;
      gateLog = {
        id: `gate-gps-${Date.now()}`,
        studentId: log.userId,
        studentName: log.userName,
        ...(studentUid ? { studentUid } : {}),
        ...(parentUid ? { parentUid: parentUid as string } : {}),
        type: log.type,
        timestamp: log.timestamp,
        date: log.date,
        gateName: log.nearestGate || 'พิกัดดาวเทียมโรงเรียน (GPS Geofence)',
        method: 'GPS_GEOFENCE',
        status: log.status === 'ON_TIME' ? 'ON_TIME' : 'LATE',
        parentNotified: false, // ระบบยังไม่ส่งแจ้งเตือนผู้ปกครองจากการเช็คอินนี้
        distanceMeters: log.distanceMeters,
        coordinates: { latitude: log.latitude, longitude: log.longitude },
      };
    }

    if (selfieDataUrl) {
      if (!authUid) throw new Error('FIRESTORE_PERMISSION-DENIED: ต้องเข้าสู่ระบบก่อนแนบรูป');
      // ห้องของนักเรียน: จาก store ถ้ามี ไม่งั้นอ่านจาก Firestore ด้วย uid ของตัวเอง (store.students ว่างในเซสชันนักเรียน)
      const homeroomClass = matchedStudent?.room || (isStudent ? await getOwnStudentRoomFirestore(authUid) : undefined);
      await saveCheckInSelfieFirestore({
        logId: newLog.id, authUid, userId: log.userId,
        homeroomClass, date: log.date, dataUrl: selfieDataUrl,
        expireAt: selfieExpiresAt(new Date()),
      });
    }
    await saveGPSCheckInLogFirestore(newLog);
    if (gateLog) await saveGateAttendanceRecordFirestore(gateLog);

    set((state) => {
      let updatedGateLogs = state.gateAttendanceLogs;
      let updatedStudents = state.students;
      let updatedCheckInRecords = { ...state.schoolCheckInRecords };

      if (gateLog) {
        updatedGateLogs = [gateLog, ...state.gateAttendanceLogs];
        if (log.type === 'ENTRY') {
          const studentStatus = log.status === 'ON_TIME' ? 'PRESENT' : 'LATE';
          updatedCheckInRecords[log.userId] = {
            status: studentStatus,
            time: new Date()
          };
          updatedStudents = state.students.map(s => {
            if (s.id === log.userId || s.studentId === log.userId) {
              return {
                ...s,
                attendance: {
                  morningStatus: studentStatus,
                  checkInMethod: 'GEOFENCE' as const,
                  checkInTime: log.timestamp
                }
              };
            }
            return s;
          });
        }
      }

      return {
        gpsCheckInLogs: [newLog, ...state.gpsCheckInLogs],
        gateAttendanceLogs: updatedGateLogs,
        students: updatedStudents,
        schoolCheckInRecords: updatedCheckInRecords
      };
    });
  },

  // อัปเดต state ในเครื่องเท่านั้น — การบันทึก Firestore ทำที่ผู้เรียก (GPSGeofenceCheckinModal await saveSchoolGeofenceConfigFirestore เอง)
  // เดิมเขียนซ้ำที่นี่แบบ fire-and-forget (สองรอบ และกลืน error)
  updateSchoolGeofenceConfig: (config) => {
    return set((state) => ({
      schoolGeofenceConfig: {
        ...state.schoolGeofenceConfig,
        ...config
      }
    }));
  }
}));

