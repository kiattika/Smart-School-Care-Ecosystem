import { create } from 'zustand';
import { 
  StoreState, 
  AttendanceStatus, 
  Course, 
  StudentSelfAssessment, 
  ActiveLearningCategory, 
  ActiveLearningRecord,
  GateAttendanceRecord,
  DetailedLeaveRequest,
  SemesterHealthRecord,
  ChronicIllness,
  AllergyRecord,
  SpecialCareNeed,
  InfirmaryVisit,
  TwoQuestionScreening,
  PHQ9Screening,
  SDQAssessment,
  GuardianBackground,
  HomeVisitLogRecord,
  EQFHardshipScreening,
  MeritDemeritRecord,
  PortfolioItem,
  DigitalCertificate,
  VolunteerHourRecord,
  ReportCardTerm,
  HomeworkAssignment,
  ExamScheduleItem,
  BillingInvoice,
  ParentTeacherMessage,
  ParentAppointment,
  GPSCheckInLog,
  SubstituteAssignment,
  SubstituteApprovalStep,
  SubstituteApprovalStage,
  PostTeachingRecord
} from './types';
import { SUBSTITUTE_STAGE_ROLE, SUBSTITUTE_STAGE_ORDER, SUBSTITUTE_TEACHER_DECLINED_ROLE } from './types';
import { DEFAULT_SCHOOL_GEOFENCE } from './utils/geoUtils';
import { 
  saveSelfAssessmentRecord, 
  updateStudentProfileFirestore,
  saveGateAttendanceRecordFirestore,
  saveDetailedLeaveRequestFirestore,
  updateDetailedLeaveStatusFirestore,
  saveGPSCheckInLogFirestore,
  saveSchoolGeofenceConfigFirestore,
  saveSubstituteAssignmentFirestore,
  updateSubstituteAssignmentFirestore,
  saveSubstituteSwapPairFirestore,
  updateSubstituteAssignmentsBatchFirestore,
  savePostTeachingRecordFirestore,
  save2QScreeningFirestore,
  savePHQ9ScreeningFirestore,
  saveSDQAssessmentFirestore,
  payBillingInvoiceFirestore,
  sendParentTeacherMessageFirestore,
  bookParentAppointmentFirestore,
  saveActiveLearningLogFirestore
} from './services/firestoreService';

const STATUS_CYCLE: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'LATE', 'LEAVE'];

/** สร้าง approval chain 4 ขั้น — ขั้นที่ 1 auto-approve เฉพาะเมื่อผู้เสนอคือ HEAD_OF_DEPARTMENT ตัวจริง
 *  ใช้ร่วมกันทั้ง proposeSubstituteAssignment (เดี่ยว) และ proposeSubstituteSwap (คู่แลกคาบ) */
function buildSubstituteApprovalChain(
  isHodProposer: boolean,
  proposerEmail: string,
  proposerName: string,
  now: string
): SubstituteApprovalStep[] {
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
          comment: 'เสนอจัดครูสอนแทนโดยหัวหน้ากลุ่มสาระฯ',
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
  currentPeriod: 'คาบ 1',
  students: [],
  courses: [],
  globalCourses: [],
  homeroomAssignments: {},
  scheduleChangeRequests: [],
  analytics: [],
  leaveRequests: [],
  scheduleConfig: {
    isActivityDay: false,
    shortenMinutes: 0
  },
  schoolCheckInRecords: {},
  attendanceRecords: {},
  parentConferences: [],
  parentNotifications: [],
  selfAssessments: {},

  // Student & Parent Extended Initial State (Clean empty arrays / objects)
  gateAttendanceLogs: [],
  detailedLeaveRequests: [],
  semesterHealthLogs: {},
  chronicIllnesses: {},
  allergies: {},
  specialCareNeeds: {},
  infirmaryVisits: [],
  twoQuestionScreenings: {},
  phq9Screenings: {},
  sdqAssessments: [],
  guardianProfiles: {},
  homeVisitLogs: [],
  eqfHardshipScreenings: {},
  meritDemeritLogs: [],
  portfolioItems: [],
  digitalCertificates: [],
  volunteerRecords: [],
  reportCards: {},
  homeworkAssignments: [],
  examSchedules: [],
  billingInvoices: [],
  parentTeacherMessages: [],
  parentAppointments: [],

  schoolGeofenceConfig: DEFAULT_SCHOOL_GEOFENCE,
  gpsCheckInLogs: [],
  activeLearningPoints: {},
  activeLearningLogs: [],
  courseScoreSettings: [],
  studentScores: [],
  substituteAssignments: [],
  postTeachingRecords: [],
  staffDirectory: [],
  periodSwaps: [],
  homeVisits: [],

  schoolDuties: [],
  administrativeTasks: [],

  setUser: (user) => set({ user }),
  setCurrentDate: (date: Date) => set({ currentDate: date }),
  
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

  adjustBehaviorScore: (studentId: string, amount: number) => set((state) => {
    let updatedAnalytics = state.analytics.map(a => {
      if (a.studentId === studentId) {
        return { ...a, behaviorScore: Math.max(0, Math.min(100, a.behaviorScore + amount)) };
      }
      return a;
    });

    const studentAnalytic = updatedAnalytics.find(a => a.studentId === studentId);
    const newScore = studentAnalytic?.behaviorScore ?? 100;

    let updatedStudents = [...state.students];
    let updatedConferences = [...state.parentConferences];
    let updatedNotifications = [...state.parentNotifications];

    const studentIndex = updatedStudents.findIndex(s => s.studentId === studentId);
    if (studentIndex !== -1) {
      const studentObj = updatedStudents[studentIndex];
      const riskLevel = newScore < 70 ? 'CRITICAL' : 'LOW';
      updatedStudents[studentIndex] = {
        ...studentObj,
        ...({ riskLevel } as any)
      };
    }

    const studentObj = state.students.find(s => s.studentId === studentId);
    const studentName = studentObj ? studentObj.name : `นักเรียนรหัส ${studentId}`;
    const parentUid = (studentObj as any)?.parentUid || (studentObj as any)?.parentId || `parent_${studentId}`;
    const parentId = (studentObj as any)?.parentId || parentUid;

    // Handle warning threshold (< 80)
    if (newScore < 80) {
      const hasWarning = updatedNotifications.some(n => n.studentId === studentId && n.type === 'warning' && n.remainingScore === newScore);
      if (!hasWarning) {
        updatedNotifications.push({
          id: `notif_warn_${Date.now()}`,
          parentUid,
          parentId,
          studentId,
          studentName,
          title: "⚠️ คะแนนพฤติกรรมเริ่มลดลง",
          message: `แจ้งเตือนความประพฤติ: คะแนนพฤติกรรมของน้อง${studentName} ลดลงต่ำกว่าเกณฑ์เฝ้าระวัง (ปัจจุบันเหลือ ${newScore} คะแนน) กรุณาช่วยตักเตือนและติดตามอย่างใกล้ชิดค่ะ`,
          status: 'unread',
          createdAt: new Date(),
          pointsDeducted: amount < 0 ? Math.abs(amount) : 0,
          remainingScore: newScore,
          type: 'warning'
        });
      }
    }

    // Handle critical threshold (< 70)
    if (newScore < 70) {
      const hasConf = updatedConferences.some(c => c.studentId === studentId && c.status === 'PENDING');
      if (!hasConf) {
        updatedConferences.push({
          id: `conf_${Date.now()}`,
          studentId,
          studentName,
          parentUid,
          parentId,
          status: 'PENDING',
          title: "นัดหมายพบฝ่ายปกครอง (คะแนนต่ำกว่า 70 คะแนน)",
          message: `เนื่องจากคะแนนพฤติกรรมคงเหลือของน้อง${studentName} อยู่ในระดับวิกฤต (ปัจจุบันเหลือ ${newScore} คะแนน) ซึ่งต่ำกว่าเกณฑ์ของโรงเรียน เพื่อดูแลช่วยเหลือนักเรียนอย่างมีประสิทธิภาพ ทางฝ่ายปกครองจึงจำเป็นต้องขอสัญญานัดหมายเพื่อพูดคุยปรับทัศนคติร่วมกัน`,
          createdAt: new Date(),
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
        });
      }
    }

    return {
      analytics: updatedAnalytics,
      students: updatedStudents,
      parentConferences: updatedConferences,
      parentNotifications: updatedNotifications
    };
  }),

  submitLeaveRequest: (studentId: string, date: Date, reason: string) => set((state) => ({
    leaveRequests: [
      ...state.leaveRequests,
      { id: Date.now().toString(), studentId, date, reason, status: 'PENDING' }
    ]
  })),

  updateLeaveRequestStatus: (id: string, status: 'APPROVED' | 'REJECTED') => set((state) => ({
    leaveRequests: state.leaveRequests.map(req => req.id === id ? { ...req, status } : req)
  })),

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
  submitScheduleChangeRequest: (req) => set((state) => ({
    scheduleChangeRequests: [
      ...state.scheduleChangeRequests,
      { ...req, id: Date.now().toString(), status: 'PENDING', createdAt: new Date() }
    ]
  })),
  updateScheduleChangeRequestStatus: (id, status) => set((state) => ({
    scheduleChangeRequests: state.scheduleChangeRequests.map(req => req.id === id ? { ...req, status } : req)
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
        room: gc ? gc.roomName : 'ม.5/8',
        term: '1/2569',
        studentsCount: 40,
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
  updateStudentProfile: (studentId, profile) => {
    set((state) => ({
      students: state.students.map(s => {
        if (s.studentId === studentId) {
          const updatedStudent: any = {
            ...s,
            nickname: profile.nickname,
            photoUrl: profile.photoUrl,
            avatar: profile.photoUrl,
            name: s.name.includes("(") ? `${s.name.split(" ")[0]} ${s.name.split(" ")[1]} ${profile.nickname} (เลขที่ ${s.studentNo})` : s.name,
            homeLocation: {
              ...s.homeLocation,
              address: profile.address
            }
          };
          if (profile.parentUid !== undefined) {
            updatedStudent.parentUid = profile.parentUid;
            updatedStudent.parentId = profile.parentUid;
          }
          if (profile.parentEmail !== undefined) {
            updatedStudent.parentEmail = profile.parentEmail;
          }
          return updatedStudent;
        }
        return s;
      })
    }));

    // Async persist to Firestore
    try {
      updateStudentProfileFirestore(studentId, profile).catch(err => {
        console.warn("Notice: Firestore persistence for student profile update handled optimistically", err);
      });
    } catch {
      // ignore
    }
  },
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
  submitPostTeachingRecord: (record) => {
    savePostTeachingRecordFirestore(record).catch(err => console.warn('Firestore post teaching notice:', err));
    return set((state) => ({
      postTeachingRecords: [
        ...state.postTeachingRecords.filter(r => !(r.courseId === record.courseId && r.date === record.date)),
        record
      ]
    }));
  },
  submitPeriodSwap: (swap) => set((state) => ({
    periodSwaps: [
      ...state.periodSwaps,
      { ...swap, id: 'swap-' + Date.now(), status: 'PENDING_TEACHER' }
    ]
  })),
  updatePeriodSwapStatus: (id, status) => set((state) => ({
    periodSwaps: state.periodSwaps.map(ps => ps.id === id ? { ...ps, status } : ps)
  })),
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
    // ขั้นที่ 1 ถือว่าอนุมัติโดยผู้เสนอทันที เฉพาะกรณีผู้เสนอคือหัวหน้ากลุ่มสาระฯ ตัวจริงเท่านั้น
    // — ถ้าครูขอลากิจ/ไปราชการด้วยตนเอง (proposedByRole เป็น SUBJECT_TEACHER/HOMEROOM_TEACHER)
    // ขั้นที่ 1 ต้องรอหัวหน้ากลุ่มสาระฯ มาอนุมัติจริงก่อน ห้าม auto-approve แทน
    const isHodProposer = payload.proposedByRole === 'HEAD_OF_DEPARTMENT';
    const chain = buildSubstituteApprovalChain(isHodProposer, proposerEmail, proposerName, now);

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
      const isHodProposer = payload.proposedByRole === 'HEAD_OF_DEPARTMENT';
      const chain = buildSubstituteApprovalChain(isHodProposer, proposerEmail, proposerName, now);
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
  submitHomeVisit: (visit) => set((state) => ({
    homeVisits: [
      ...state.homeVisits.filter(v => v.studentId !== visit.studentId),
      visit
    ]
  })),
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

  scheduleConference: (conferenceId: string, date: string, time: string) => set((state) => {
    let studentId = '';
    let studentName = '';
    
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
    const parentUid = (student as any)?.parentUid || (student as any)?.parentId || `parent_${studentId}`;
    const parentId = (student as any)?.parentId || parentUid;

    const newNotif = {
      id: `notif_sch_${Date.now()}`,
      parentUid,
      parentId,
      studentId,
      studentName,
      title: "🗓️ ยืนยันการนัดพบคณะกรรมการสถานศึกษาเรียบร้อยแล้ว",
      message: `ระบบยืนยันสิทธิ์การนัดหมายพบฝ่ายปกครองของน้อง${studentName} ในวัน${date} เวลา ${time} เรียบร้อยแล้ว คณะครูและฝ่ายปกครองยินดีต้อนรับค่ะ`,
      status: 'unread' as const,
      createdAt: new Date(),
      pointsDeducted: 0,
      remainingScore: 0,
      type: 'info' as const
    };

    console.log(`[Admin Notice] Parent of student ${studentName} scheduled meeting on ${date} at ${time}`);

    return {
      parentConferences: updatedConferences,
      parentNotifications: [newNotif, ...state.parentNotifications]
    };
  }),

  addMockParentNotification: (notif) => set((state) => {
    const student = state.students.find(s => s.studentId === notif.studentId);
    const parentUid = notif.parentUid || (student as any)?.parentUid || notif.parentId || `parent_${notif.studentId}`;
    const parentId = notif.parentId || parentUid;
    return {
      parentNotifications: [
        {
          ...notif,
          parentUid,
          parentId,
          id: `notif_${Date.now()}`,
          status: 'unread' as const,
          createdAt: new Date()
        },
        ...state.parentNotifications
      ]
    };
  }),

  addActiveLearningPoints: (studentId: string, points: number, category: ActiveLearningCategory = 'GENERAL', note?: string, courseId?: string) => {
    const newLog: ActiveLearningRecord = {
      id: `al-log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      studentId,
      courseId,
      points,
      category,
      note,
      awardedAt: new Date().toISOString()
    };
    saveActiveLearningLogFirestore(newLog).catch(err => console.warn('Firestore active learning notice:', err));

    return set((state) => {
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

    set((state) => ({
      selfAssessments: {
        ...state.selfAssessments,
        [assessment.studentId]: updated
      }
    }));

    try {
      await saveSelfAssessmentRecord(updated);
    } catch (err) {
      console.warn("Notice: Firestore persistence for self-assessment handled locally/optimistically", err);
    }
  },

  // Extended Student & Parent Actions Implementation
  recordGateAttendance: (studentId: string, type: 'ENTRY' | 'EXIT', method: GateAttendanceRecord['method']) => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const timeStr = `${hours}:${minutes} น.`;
    const dateStr = now.toISOString().split('T')[0];
    const isLate = type === 'ENTRY' && (now.getHours() > 8 || (now.getHours() === 8 && now.getMinutes() > 0));

    return set((state) => {
      const student = state.students.find(s => s.studentId === studentId);
      const studentName = student ? student.name : `นักเรียน (${studentId})`;
      const parentUid = (student as any)?.parentUid || (student as any)?.parentId || `parent_${studentId}`;
      const parentId = (student as any)?.parentId || parentUid;

      const newGateRecord: GateAttendanceRecord = {
        id: `gate-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        studentId,
        studentName,
        type,
        timestamp: timeStr,
        date: dateStr,
        gateName: 'ประตู 1 (ประตูใหญ่หน้าโรงเรียน)',
        method,
        status: isLate ? 'LATE' : 'ON_TIME',
        temperature: 36.4 + Number((Math.random() * 0.4).toFixed(1)),
        parentNotified: true
      };

      saveGateAttendanceRecordFirestore(newGateRecord).catch(err => console.warn('Firestore gate attendance notice:', err));

      const newNotification = {
        id: `notif-gate-${Date.now()}`,
        parentUid,
        parentId,
        studentId,
        studentName,
        title: type === 'ENTRY' ? `🔔 แจ้งเตือนการมาถึงโรงเรียน (${studentName})` : `👋 แจ้งเตือนการเดินทางออกจากโรงเรียน (${studentName})`,
        message: type === 'ENTRY' 
          ? `นักเรียนได้สแกนเข้าโรงเรียนผ่านประตู 1 เมื่อเวลา ${timeStr} สถานะ: ${isLate ? 'สาย' : 'ตรงเวลา'} อุณหภูมิร่างกายปกติ` 
          : `นักเรียนได้สแกนแตะบัตรผ่านประตู 1 เดินทางออกจากโรงเรียนเมื่อเวลา ${timeStr}`,
        status: 'unread' as const,
        createdAt: now,
        pointsDeducted: 0,
        remainingScore: 100,
        type: 'info' as const
      };

      return {
        gateAttendanceLogs: [newGateRecord, ...state.gateAttendanceLogs],
        parentNotifications: [newNotification, ...state.parentNotifications]
      };
    });
  },

  submitDetailedLeave: (req) => {
    const newLeave: DetailedLeaveRequest = {
      ...req,
      id: `leave-${Date.now()}`,
      status: 'PENDING',
      submittedAt: new Date().toISOString()
    };
    saveDetailedLeaveRequestFirestore(newLeave).catch(err => console.warn('Firestore leave request notice:', err));

    return set((state) => {
      const student = state.students.find(s => s.studentId === req.studentId);
      const parentUid = (student as any)?.parentUid || (student as any)?.parentId || `parent_${req.studentId}`;
      const parentId = (student as any)?.parentId || parentUid;

      return {
        detailedLeaveRequests: [newLeave, ...state.detailedLeaveRequests],
        parentNotifications: [
          {
            id: `notif-leave-${Date.now()}`,
            parentUid,
            parentId,
            studentId: req.studentId,
            studentName: student ? student.name : 'นักเรียน',
            title: '📝 ยื่นใบลาออนไลน์ (e-Leave) เรียบร้อยแล้ว',
            message: `ใบลาประเภท ${req.leaveType === 'SICK' ? 'ลาป่วย' : 'ลากิจ'} สำหรับวันที่ ${req.startDate} ถึง ${req.endDate} อยู่ระหว่างรอครูประจำชั้นตรวจสอบ`,
            status: 'unread' as const,
            createdAt: new Date(),
            pointsDeducted: 0,
            remainingScore: 100,
            type: 'info' as const
          },
          ...state.parentNotifications
        ]
      };
    });
  },

  approveDetailedLeave: (id: string, teacherRemarks?: string) => {
    updateDetailedLeaveStatusFirestore(id, 'APPROVED', teacherRemarks).catch(err => console.warn('Firestore leave approval notice:', err));

    return set((state) => {
      const updated = state.detailedLeaveRequests.map(l => {
        if (l.id === id) {
          return {
            ...l,
            status: 'APPROVED' as const,
            teacherRemarks: teacherRemarks || 'อนุมัติการลาเรียบร้อย',
            approvedBy: 'ครูกิตติศักดิ์ (ครูประจำชั้น)'
          };
        }
        return l;
      });

      const targetLeave = state.detailedLeaveRequests.find(l => l.id === id);
      const studentId = targetLeave ? targetLeave.studentId : '';
      const student = state.students.find(s => s.studentId === studentId);
      const parentUid = (student as any)?.parentUid || (student as any)?.parentId || `parent_${studentId}`;
      const parentId = (student as any)?.parentId || parentUid;

      // Auto-update student morning status to LEAVE if applicable
      const updatedStudents = state.students.map(s => {
        if (s.studentId === studentId) {
          return {
            ...s,
            attendance: {
              ...s.attendance,
              morningStatus: 'LEAVE' as const,
              checkInMethod: 'MANUAL' as const,
              checkInTime: 'อนุมัติการลา'
            }
          };
        }
        return s;
      });

      return {
        detailedLeaveRequests: updated,
        students: updatedStudents,
        parentNotifications: studentId ? [
          {
            id: `notif-leave-approved-${Date.now()}`,
            parentUid,
            parentId,
            studentId,
            studentName: student ? student.name : 'นักเรียน',
            title: '✅ ใบลาได้รับการอนุมัติแล้ว',
            message: `ครูประจำชั้นได้อนุมัติใบลาของ ${student ? student.name : 'นักเรียน'} เรียบร้อยแล้ว และระบบได้บันทึกการลาในสมุดบัญชีเวลาเรียน`,
            status: 'unread' as const,
            createdAt: new Date(),
            pointsDeducted: 0,
            remainingScore: 100,
            type: 'info' as const
          },
          ...state.parentNotifications
        ] : state.parentNotifications
      };
    });
  },

  acknowledgeInfirmaryAlert: (visitId: string) => set((state) => {
    const updated = state.infirmaryVisits.map(v => {
      if (v.id === visitId) {
        return {
          ...v,
          parentAcknowledged: true,
          acknowledgedAt: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.'
        };
      }
      return v;
    });
    return { infirmaryVisits: updated };
  }),

  savePHQ9Screening: (studentId: string, answers: number[]) => {
    const totalScore = answers.reduce((acc, curr) => acc + curr, 0);
    let riskLevel: PHQ9Screening['riskLevel'] = 'NORMAL';
    let recommendation = 'สุขภาพจิตอยู่ในเกณฑ์ปกติ มีสภาวะอารมณ์ที่มั่นคง';

    if (totalScore >= 20) {
      riskLevel = 'VERY_SEVERE';
      recommendation = 'มีภาวะซึมเศร้าระดับรุนแรงมาก ควรได้รับการส่งต่อพบจิตแพทย์หรือแพทย์ผู้เชี่ยวชาญทันที';
    } else if (totalScore >= 15) {
      riskLevel = 'SEVERE';
      recommendation = 'มีภาวะซึมเศร้าระดับรุนแรง ครูแนะแนวและผู้ปกครองควรให้การดูแลอย่างใกล้ชิดและนัดปรึกษาแพทย์';
    } else if (totalScore >= 10) {
      riskLevel = 'MODERATE';
      recommendation = 'มีภาวะซึมเศร้าระดับปานกลาง แนะนำให้เข้ารับคำปรึกษาจากครูแนะแนวหรือนักจิตวิทยาโรงเรียน';
    } else if (totalScore >= 5) {
      riskLevel = 'MILD';
      recommendation = 'มีภาวะซึมเศร้าระดับเล็กน้อย ควรหากิจกรรมผ่อนคลายความเครียดและพูดคุยกับเพื่อนหรือครอบครัว';
    }

    const screening: PHQ9Screening = {
      id: `phq-${Date.now()}`,
      studentId,
      answers,
      totalScore,
      riskLevel,
      recommendation,
      conductedAt: new Date().toISOString().split('T')[0]
    };
    savePHQ9ScreeningFirestore(studentId, screening).catch(err => console.warn('Firestore PHQ-9 notice:', err));

    return set((state) => ({
      phq9Screenings: {
        ...state.phq9Screenings,
        [studentId]: screening
      }
    }));
  },

  save2QScreening: (studentId: string, q1: boolean, q2: boolean) => {
    const isPositive = q1 || q2;
    const screening: TwoQuestionScreening = {
      id: `2q-${Date.now()}`,
      studentId,
      q1Depressed: q1,
      q2Hopeless: q2,
      isPositive,
      conductedAt: new Date().toISOString().split('T')[0]
    };
    save2QScreeningFirestore(studentId, screening).catch(err => console.warn('Firestore 2Q notice:', err));

    return set((state) => ({
      twoQuestionScreenings: {
        ...state.twoQuestionScreenings,
        [studentId]: screening
      }
    }));
  },

  submitSDQAssessment: (sdq) => {
    const newSDQ: SDQAssessment = {
      ...sdq,
      id: `sdq-${Date.now()}`,
      assessmentDate: new Date().toISOString().split('T')[0]
    };
    saveSDQAssessmentFirestore(newSDQ).catch(err => console.warn('Firestore SDQ notice:', err));

    return set((state) => ({
      sdqAssessments: [newSDQ, ...state.sdqAssessments]
    }));
  },

  addMeritDemeritRecord: (studentId: string, type: 'MERIT' | 'DEMERIT', points: number, category: string, description: string, teacherName: string) => set((state) => {
    const newRecord: MeritDemeritRecord = {
      id: `md-${Date.now()}`,
      studentId,
      type,
      points: type === 'MERIT' ? Math.abs(points) : -Math.abs(points),
      category,
      description,
      teacherName,
      date: new Date().toISOString().split('T')[0],
      academicYear: '2569'
    };

    const delta = type === 'MERIT' ? Math.abs(points) : -Math.abs(points);
    const updatedAnalytics = state.analytics.map(a => {
      if (a.studentId === studentId) {
        return {
          ...a,
          behaviorScore: Math.min(100, Math.max(0, a.behaviorScore + delta))
        };
      }
      return a;
    });

    const student = state.students.find(s => s.studentId === studentId);
    const parentUid = (student as any)?.parentUid || (student as any)?.parentId || `parent_${studentId}`;
    const parentId = (student as any)?.parentId || parentUid;

    return {
      meritDemeritLogs: [newRecord, ...state.meritDemeritLogs],
      analytics: updatedAnalytics,
      parentNotifications: [
        {
          id: `notif-behavior-${Date.now()}`,
          parentUid,
          parentId,
          studentId,
          studentName: student ? student.name : 'นักเรียน',
          title: type === 'MERIT' ? `🌟 บันทึกคะแนนความดี (+${Math.abs(points)} คะแนน)` : `⚠️ แจ้งเตือนการตัดคะแนนพฤติกรรม (-${Math.abs(points)} คะแนน)`,
          message: `${category}: ${description} (บันทึกโดย ${teacherName})`,
          status: 'unread' as const,
          createdAt: new Date(),
          pointsDeducted: type === 'DEMERIT' ? Math.abs(points) : 0,
          remainingScore: 95,
          type: type === 'MERIT' ? 'info' as const : 'warning' as const
        },
        ...state.parentNotifications
      ]
    };
  }),

  addPortfolioItem: (item) => set((state) => {
    const newItem: PortfolioItem = {
      ...item,
      id: `port-${Date.now()}`,
      isVerifiedByTeacher: true,
      teacherVerifier: 'ครูกิตติศักดิ์'
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

  submitHomework: (assignmentId: string, fileName: string) => set((state) => {
    const updated = state.homeworkAssignments.map(hw => {
      if (hw.id === assignmentId) {
        return {
          ...hw,
          status: 'SUBMITTED' as const,
          submittedFile: fileName,
          submittedAt: new Date().toLocaleDateString('th-TH') + ' ' + new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.'
        };
      }
      return hw;
    });
    return { homeworkAssignments: updated };
  }),

  payBillingInvoice: (invoiceId: string) => {
    const receiptNo = `REC-2569-${Math.floor(10000 + Math.random() * 90000)}`;
    payBillingInvoiceFirestore(invoiceId, receiptNo).catch(err => console.warn('Firestore invoice payment notice:', err));

    return set((state) => {
      const updated = state.billingInvoices.map(inv => {
        if (inv.id === invoiceId) {
          return {
            ...inv,
            status: 'PAID' as const,
            paidAt: new Date().toLocaleDateString('th-TH') + ' ' + new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.',
            receiptNo
          };
        }
        return inv;
      });
      return { billingInvoices: updated };
    });
  },

  sendParentTeacherMessage: (studentId: string, senderRole: ParentTeacherMessage['senderRole'], senderName: string, message: string) => {
    const newMsg: ParentTeacherMessage = {
      id: `msg-${Date.now()}`,
      studentId,
      senderRole,
      senderName,
      message,
      timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.',
      read: true
    };
    sendParentTeacherMessageFirestore(newMsg).catch(err => console.warn('Firestore parent teacher message notice:', err));

    return set((state) => ({
      parentTeacherMessages: [...state.parentTeacherMessages, newMsg]
    }));
  },

  bookParentAppointment: (apt) => {
    const newApt: ParentAppointment = {
      ...apt,
      id: `apt-${Date.now()}`,
      status: 'CONFIRMED',
      meetLink: apt.meetingType === 'ONLINE_MEET' ? 'https://meet.google.com/abc-defg-hij' : undefined
    };
    bookParentAppointmentFirestore(newApt).catch(err => console.warn('Firestore parent appointment notice:', err));

    return set((state) => ({
      parentAppointments: [newApt, ...state.parentAppointments]
    }));
  },

  addGPSCheckInLog: (log) => {
    const newLog: GPSCheckInLog = {
      ...log,
      id: `gps-log-${Date.now()}`
    };
    saveGPSCheckInLogFirestore(newLog).catch(err => console.warn('Firestore GPS check in notice:', err));

    return set((state) => {
      // If it's a student, also synchronize with gate logs and morning attendance
      let updatedGateLogs = state.gateAttendanceLogs;
      let updatedStudents = state.students;
      let updatedCheckInRecords = { ...state.schoolCheckInRecords };

      if (log.userId && log.userId.startsWith('695')) {
        const gateLog: GateAttendanceRecord = {
          id: `gate-gps-${Date.now()}`,
          studentId: log.userId,
          studentName: log.userName,
          type: log.type,
          timestamp: log.timestamp,
          date: log.date,
          gateName: log.nearestGate || 'พิกัดดาวเทียมโรงเรียน (GPS Geofence)',
          method: 'GPS_GEOFENCE',
          status: log.status === 'ON_TIME' ? 'ON_TIME' : 'LATE',
          parentNotified: true,
          distanceMeters: log.distanceMeters,
          coordinates: { latitude: log.latitude, longitude: log.longitude },
          selfieUrl: log.selfieUrl
        };
        saveGateAttendanceRecordFirestore(gateLog).catch(err => console.warn('Firestore gate attendance GPS notice:', err));
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

  updateSchoolGeofenceConfig: (config) => {
    saveSchoolGeofenceConfigFirestore(config as any).catch(err => console.warn('Firestore geofence config notice:', err));
    return set((state) => ({
      schoolGeofenceConfig: {
        ...state.schoolGeofenceConfig,
        ...config
      }
    }));
  }
}));

