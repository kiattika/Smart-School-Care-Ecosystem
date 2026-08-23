import { create } from 'zustand';
import { 
  StoreState, 
  AttendanceStatus, 
  Course, 
  StudentSelfAssessment, 
  MOCK_MULTI_ROLE_USERS, 
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
  GPSCheckInLog
} from './types';
import { DEFAULT_SCHOOL_GEOFENCE } from './utils/geoUtils';
import { MOCK_COURSES, MOCK_ANALYTICS, MOCK_LEAVE_REQUESTS, STATUS_CYCLE, GLOBAL_COURSES } from './data/mockData';
import { mockStudentsData } from './data/mockStudentsData';
import { mockSelfAssessments } from './data/mockSelfAssessments';
import { 
  INITIAL_GATE_LOGS,
  INITIAL_DETAILED_LEAVE_REQUESTS,
  INITIAL_SEMESTER_HEALTH_LOGS,
  INITIAL_CHRONIC_ILLNESSES,
  INITIAL_ALLERGIES,
  INITIAL_SPECIAL_CARE_NEEDS,
  INITIAL_INFIRMARY_VISITS,
  INITIAL_2Q_SCREENINGS,
  INITIAL_PHQ9_SCREENINGS,
  INITIAL_SDQ_ASSESSMENTS,
  INITIAL_GUARDIAN_PROFILES,
  INITIAL_HOME_VISIT_LOGS,
  INITIAL_EQF_SCREENINGS,
  INITIAL_MERIT_DEMERIT_LOGS,
  INITIAL_PORTFOLIO_ITEMS,
  INITIAL_DIGITAL_CERTIFICATES,
  INITIAL_VOLUNTEER_RECORDS,
  INITIAL_REPORT_CARDS,
  INITIAL_HOMEWORK_ASSIGNMENTS,
  INITIAL_EXAM_SCHEDULES,
  INITIAL_BILLING_INVOICES,
  INITIAL_PARENT_TEACHER_MESSAGES,
  INITIAL_PARENT_APPOINTMENTS
} from './data/mockStudentParentData';
import { saveSelfAssessmentRecord, updateStudentProfileFirestore } from './services/firestoreService';

const defaultKiattisakProfile = MOCK_MULTI_ROLE_USERS[0];

export const useStore = create<StoreState>((set, get) => ({
  user: {
    uid: defaultKiattisakProfile.id,
    email: defaultKiattisakProfile.email,
    displayName: 'Mr. Kiattisak (ครูผู้สอน)',
    role: 'teacher',
    activeRole: 'SUBJECT_TEACHER',
    profile: defaultKiattisakProfile
  },
  currentDate: new Date(),
  currentPeriod: 'คาบ 1',
  students: mockStudentsData,
  courses: MOCK_COURSES,
  globalCourses: GLOBAL_COURSES,
  homeroomAssignments: {
    'kiattisak@utd.ac.th': 'M.5/8',
    'teacher@utd.ac.th': 'M.5/8',
    'koy@utd.ac.th': 'M.5/8',
    'smith@utd.ac.th': 'M.2/10',
    'jones@utd.ac.th': 'M.1/3',
    'ball@utd.ac.th': 'M.5/7',
    'noi@utd.ac.th': 'M.4/4',
    'somjai@utd.ac.th': 'M.4/1'
  },
  scheduleChangeRequests: [],
  analytics: MOCK_ANALYTICS,
  leaveRequests: MOCK_LEAVE_REQUESTS,
  lateAttendanceRequests: [],
  scheduleConfig: {
    isActivityDay: false,
    shortenMinutes: 0
  },
  schoolCheckInRecords: {},
  attendanceRecords: {},
  parentConferences: [],
  parentNotifications: [],
  selfAssessments: mockSelfAssessments,

  // Student & Parent Extended Initial State
  gateAttendanceLogs: INITIAL_GATE_LOGS,
  detailedLeaveRequests: INITIAL_DETAILED_LEAVE_REQUESTS,
  semesterHealthLogs: INITIAL_SEMESTER_HEALTH_LOGS,
  chronicIllnesses: INITIAL_CHRONIC_ILLNESSES,
  allergies: INITIAL_ALLERGIES,
  specialCareNeeds: INITIAL_SPECIAL_CARE_NEEDS,
  infirmaryVisits: INITIAL_INFIRMARY_VISITS,
  twoQuestionScreenings: INITIAL_2Q_SCREENINGS,
  phq9Screenings: INITIAL_PHQ9_SCREENINGS,
  sdqAssessments: INITIAL_SDQ_ASSESSMENTS,
  guardianProfiles: INITIAL_GUARDIAN_PROFILES,
  homeVisitLogs: INITIAL_HOME_VISIT_LOGS,
  eqfHardshipScreenings: INITIAL_EQF_SCREENINGS,
  meritDemeritLogs: INITIAL_MERIT_DEMERIT_LOGS,
  portfolioItems: INITIAL_PORTFOLIO_ITEMS,
  digitalCertificates: INITIAL_DIGITAL_CERTIFICATES,
  volunteerRecords: INITIAL_VOLUNTEER_RECORDS,
  reportCards: INITIAL_REPORT_CARDS,
  homeworkAssignments: INITIAL_HOMEWORK_ASSIGNMENTS,
  examSchedules: INITIAL_EXAM_SCHEDULES,
  billingInvoices: INITIAL_BILLING_INVOICES,
  parentTeacherMessages: INITIAL_PARENT_TEACHER_MESSAGES,
  parentAppointments: INITIAL_PARENT_APPOINTMENTS,

  schoolGeofenceConfig: DEFAULT_SCHOOL_GEOFENCE,
  gpsCheckInLogs: [
    {
      id: 'gps-log-01',
      userId: '6950801',
      userName: 'นายกิตติศักดิ์ เจริญสุข (ม.5/8)',
      userRole: 'STUDENT',
      type: 'ENTRY',
      timestamp: '07:25 น.',
      date: '2026-08-21',
      latitude: 17.625410,
      longitude: 100.093350,
      distanceMeters: 42,
      isInsideGeofence: true,
      status: 'ON_TIME',
      accuracyMeters: 4.8,
      nearestGate: 'ประตู 1 (หน้าโรงเรียน - ถนนประชานิมิตร)',
      notes: 'สแกนพิกัดดาวเทียมสำเร็จ'
    },
    {
      id: 'gps-log-02',
      userId: '6950802',
      userName: 'นายณัฐวุฒิ สุขประเสริฐ (ม.5/8)',
      userRole: 'STUDENT',
      type: 'ENTRY',
      timestamp: '07:38 น.',
      date: '2026-08-21',
      latitude: 17.625520,
      longitude: 100.093280,
      distanceMeters: 38,
      isInsideGeofence: true,
      status: 'ON_TIME',
      accuracyMeters: 5.2,
      nearestGate: 'ประตู 1 (หน้าโรงเรียน - ถนนประชานิมิตร)',
      notes: 'เช็คอินผ่านสมาร์ตโฟน'
    },
    {
      id: 'gps-log-03',
      userId: 'user-kiattisak',
      userName: 'นายกิตติศักดิ์ เจริญสุข (ครู)',
      userRole: 'TEACHER',
      type: 'ENTRY',
      timestamp: '07:15 น.',
      date: '2026-08-21',
      latitude: 17.625350,
      longitude: 100.093410,
      distanceMeters: 12,
      isInsideGeofence: true,
      status: 'ON_TIME',
      accuracyMeters: 3.5,
      nearestGate: 'ประตู 1 (หน้าโรงเรียน - ถนนประชานิมิตร)',
      notes: 'ลงเวลาปฏิบัติหน้าที่เวรประจำวัน'
    }
  ],

  activeLearningPoints: {
    '6950801': 38,
    '6950802': 32,
    '6950803': 29,
    '6950804': 25,
    '6950805': 22,
    '6950806': 18,
    '6950807': 16,
    '6950808': 14,
    '6950809': 11,
    '6950810': 9,
    '6950901': 35,
    '6950902': 28,
    '6950903': 24,
    '6950904': 21,
    '6950905': 19,
    '6951101': 30,
    '6951102': 27,
    '6951103': 23,
    '38501': 26,
    '38502': 34,
    '38511': 20
  },
  activeLearningLogs: [
    {
      id: 'al-log-1',
      studentId: '6950801',
      points: 5,
      category: 'PRESENTATION',
      note: 'นำเสนอโครงงาน Active Learning หน้าชั้นเรียนอย่างชัดเจน',
      awardedAt: '2026-08-18T09:30:00Z'
    },
    {
      id: 'al-log-2',
      studentId: '6950802',
      points: 3,
      category: 'ANSWER',
      note: 'ตอบคำถามวิเคราะห์โจทย์ประยุกต์ได้ถูกต้อง',
      awardedAt: '2026-08-18T10:15:00Z'
    },
    {
      id: 'al-log-3',
      studentId: '6950803',
      points: 4,
      category: 'COLLABORATION',
      note: 'เป็นผู้นำกลุ่มและช่วยเพื่อนร่วมทีมทำแบบฝึกหัดจนเสร็จ',
      awardedAt: '2026-08-17T14:20:00Z'
    },
    {
      id: 'al-log-4',
      studentId: '6950801',
      points: 2,
      category: 'HELPING_PEERS',
      note: 'ช่วยเพื่อนจัดเตรียมอุปกรณ์ทดลองวิทยาศาสตร์',
      awardedAt: '2026-08-17T11:00:00Z'
    },
    {
      id: 'al-log-5',
      studentId: '6950901',
      points: 5,
      category: 'CREATIVITY',
      note: 'เสนอไอเดียและแนวคิดสร้างสรรค์ในการแก้ปัญหาโจทย์',
      awardedAt: '2026-08-16T13:45:00Z'
    }
  ],
  
  postTeachingRecords: [
    {
      courseId: '1',
      date: '2026-07-13',
      summary: 'สอนเรื่องแรงในแนวราบและแนวดิ่ง มีการทำแบบฝึกหัดท้ายบท',
      problems: 'นักเรียนบางคนยังสับสนทิศทางของแรงลัพธ์',
      solutions: 'เน้นวาดแผนภาพ Free Body Diagram เพิ่มเติมในท้ายคาบ',
      submittedAt: '2026-07-13T16:30:00.000Z',
      isLate: false
    },
    {
      courseId: '2',
      date: '2026-07-12',
      summary: 'สอนเรื่องโครงสร้างอะตอมและการจัดเรียงอิเล็กตรอน',
      problems: 'นักเรียนส่งใบงานช้าเนื่องจากเนื้อหาค่อนข้างเยอะ',
      solutions: 'มอบหมายให้สรุปเป็น Mind Map นอกเวลาเรียนแทน',
      submittedAt: '2026-07-13T08:15:00.000Z',
      isLate: true
    }
  ],
  periodSwaps: [
    {
      id: 'swap-1',
      requesterEmail: 'teacher@utd.ac.th',
      targetEmail: 'somjai@utd.ac.th',
      requesterCourseId: '5',
      targetCourseId: '2',
      status: 'PENDING_TEACHER'
    },
    {
      id: 'swap-2',
      requesterEmail: 'somjai@utd.ac.th',
      targetEmail: 'teacher@utd.ac.th',
      requesterCourseId: '1',
      targetCourseId: '6',
      status: 'APPROVED'
    }
  ],
  substituteAssignments: [
    {
      id: 'sub-1',
      originalTeacherEmail: 'somjai@utd.ac.th',
      substituteTeacherEmail: 'teacher@utd.ac.th',
      courseId: '1',
      date: '2026-07-14'
    }
  ],

  homeVisits: [
    {
      studentId: '1',
      advisorEmail: 'teacher@utd.ac.th',
      visitedAt: '2026-07-10T14:30:00Z',
      geoVerified: true,
      riskLevel: 'LOW',
      photoUploaded: true
    }
  ],
  schoolDuties: [
    {
      dutyId: 'duty-1',
      teacherEmail: 'teacher@utd.ac.th',
      date: '2026-07-14',
      location: 'ประตู 1 (หน้าโรงเรียน)',
      status: 'CHECKED_IN',
      logSubmitted: true
    },
    {
      dutyId: 'duty-2',
      teacherEmail: 'somjai@utd.ac.th',
      date: '2026-07-14',
      location: 'โรงอาหาร',
      status: 'ABSENT',
      logSubmitted: false
    }
  ],
  administrativeTasks: [
    {
      taskId: 'task-1',
      assignedToEmail: 'teacher@utd.ac.th',
      department: 'วิชาการ',
      taskName: 'ส่งแผนการสอนรายวิชา ท32101',
      deadline: '2026-07-20',
      status: 'PENDING'
    },
    {
      taskId: 'task-2',
      assignedToEmail: 'somjai@utd.ac.th',
      department: 'วิชาการ',
      taskName: 'ส่งข้อสอบกลางภาค',
      deadline: '2026-07-10',
      status: 'COMPLETED_ON_TIME'
    }
  ],
  studentScores: [
    {
      id: 'score-38502-k0',
      courseId: 'kiattisak-0',
      studentId: '38502',
      preMidterm: 22,
      midterm: 19,
      postMidterm: 24,
      final: 28,
      total: 93,
      grade: '4'
    },
    {
      id: 'score-38502-k4',
      courseId: 'kiattisak-4',
      studentId: '38502',
      preMidterm: 20,
      midterm: 15,
      postMidterm: 20,
      final: 25,
      total: 80,
      grade: '4'
    },
    {
      id: 'score-1-1',
      courseId: '1',
      studentId: '1',
      preMidterm: 25,
      midterm: 18,
      postMidterm: 28,
      final: 15,
      total: 86,
      grade: '4'
    },
    {
      id: 'score-1-2',
      courseId: '1',
      studentId: '2',
      preMidterm: 10,
      midterm: 8,
      postMidterm: 12,
      final: 10,
      total: 40,
      grade: '0'
    }
  ],
  courseScoreSettings: [],

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

  submitLateAttendanceRequest: (req) => set((state) => ({
    lateAttendanceRequests: [
      ...state.lateAttendanceRequests,
      { ...req, id: Date.now().toString(), status: 'PENDING', createdAt: new Date() }
    ]
  })),

  updateLateAttendanceRequestStatus: (id, status) => set((state) => ({
    lateAttendanceRequests: state.lateAttendanceRequests.map(req => req.id === id ? { ...req, status } : req)
  })),

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
  submitPostTeachingRecord: (record) => set((state) => ({
    postTeachingRecords: [
      ...state.postTeachingRecords.filter(r => !(r.courseId === record.courseId && r.date === record.date)),
      record
    ]
  })),
  submitPeriodSwap: (swap) => set((state) => ({
    periodSwaps: [
      ...state.periodSwaps,
      { ...swap, id: 'swap-' + Date.now(), status: 'PENDING_TEACHER' }
    ]
  })),
  updatePeriodSwapStatus: (id, status) => set((state) => ({
    periodSwaps: state.periodSwaps.map(ps => ps.id === id ? { ...ps, status } : ps)
  })),
  assignSubstituteTeacher: (assignment) => set((state) => ({
    substituteAssignments: [
      ...state.substituteAssignments,
      { ...assignment, id: 'sub-' + Date.now() }
    ]
  })),
  removeSubstituteAssignment: (id) => set((state) => ({
    substituteAssignments: state.substituteAssignments.filter(sa => sa.id !== id)
  })),
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

  addActiveLearningPoints: (studentId: string, points: number, category: ActiveLearningCategory = 'GENERAL', note?: string, courseId?: string) => set((state) => {
    const currentPoints = state.activeLearningPoints[studentId] || 0;
    const newPoints = Math.max(0, currentPoints + points);
    const newLog: ActiveLearningRecord = {
      id: `al-log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      studentId,
      courseId,
      points,
      category,
      note,
      awardedAt: new Date().toISOString()
    };

    return {
      activeLearningPoints: {
        ...state.activeLearningPoints,
        [studentId]: newPoints
      },
      activeLearningLogs: [newLog, ...state.activeLearningLogs]
    };
  }),

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
  recordGateAttendance: (studentId: string, type: 'ENTRY' | 'EXIT', method: GateAttendanceRecord['method']) => set((state) => {
    const student = state.students.find(s => s.studentId === studentId);
    const studentName = student ? student.name : `นักเรียน (${studentId})`;
    const parentUid = (student as any)?.parentUid || (student as any)?.parentId || `parent_${studentId}`;
    const parentId = (student as any)?.parentId || parentUid;
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const timeStr = `${hours}:${minutes} น.`;
    const dateStr = now.toISOString().split('T')[0];
    const isLate = type === 'ENTRY' && (now.getHours() > 8 || (now.getHours() === 8 && now.getMinutes() > 0));

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
  }),

  submitDetailedLeave: (req) => set((state) => {
    const student = state.students.find(s => s.studentId === req.studentId);
    const parentUid = (student as any)?.parentUid || (student as any)?.parentId || `parent_${req.studentId}`;
    const parentId = (student as any)?.parentId || parentUid;
    const newLeave: DetailedLeaveRequest = {
      ...req,
      id: `leave-${Date.now()}`,
      status: 'PENDING',
      submittedAt: new Date().toISOString()
    };

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
  }),

  approveDetailedLeave: (id: string, teacherRemarks?: string) => set((state) => {
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
  }),

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

  savePHQ9Screening: (studentId: string, answers: number[]) => set((state) => {
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

    return {
      phq9Screenings: {
        ...state.phq9Screenings,
        [studentId]: screening
      }
    };
  }),

  save2QScreening: (studentId: string, q1: boolean, q2: boolean) => set((state) => {
    const isPositive = q1 || q2;
    const screening: TwoQuestionScreening = {
      id: `2q-${Date.now()}`,
      studentId,
      q1Depressed: q1,
      q2Hopeless: q2,
      isPositive,
      conductedAt: new Date().toISOString().split('T')[0]
    };

    return {
      twoQuestionScreenings: {
        ...state.twoQuestionScreenings,
        [studentId]: screening
      }
    };
  }),

  submitSDQAssessment: (sdq) => set((state) => {
    const newSDQ: SDQAssessment = {
      ...sdq,
      id: `sdq-${Date.now()}`,
      assessmentDate: new Date().toISOString().split('T')[0]
    };

    return {
      sdqAssessments: [newSDQ, ...state.sdqAssessments]
    };
  }),

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

  payBillingInvoice: (invoiceId: string) => set((state) => {
    const updated = state.billingInvoices.map(inv => {
      if (inv.id === invoiceId) {
        return {
          ...inv,
          status: 'PAID' as const,
          paidAt: new Date().toLocaleDateString('th-TH') + ' ' + new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.',
          receiptNo: `REC-2569-${Math.floor(10000 + Math.random() * 90000)}`
        };
      }
      return inv;
    });
    return { billingInvoices: updated };
  }),

  sendParentTeacherMessage: (studentId: string, senderRole: ParentTeacherMessage['senderRole'], senderName: string, message: string) => set((state) => {
    const newMsg: ParentTeacherMessage = {
      id: `msg-${Date.now()}`,
      studentId,
      senderRole,
      senderName,
      message,
      timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.',
      read: true
    };
    return { parentTeacherMessages: [...state.parentTeacherMessages, newMsg] };
  }),

  bookParentAppointment: (apt) => set((state) => {
    const newApt: ParentAppointment = {
      ...apt,
      id: `apt-${Date.now()}`,
      status: 'CONFIRMED',
      meetLink: apt.meetingType === 'ONLINE_MEET' ? 'https://meet.google.com/abc-defg-hij' : undefined
    };
    return { parentAppointments: [newApt, ...state.parentAppointments] };
  }),

  addGPSCheckInLog: (log) => set((state) => {
    const newLog: GPSCheckInLog = {
      ...log,
      id: `gps-log-${Date.now()}`
    };

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
  }),

  updateSchoolGeofenceConfig: (config) => set((state) => ({
    schoolGeofenceConfig: {
      ...state.schoolGeofenceConfig,
      ...config
    }
  }))
}));

