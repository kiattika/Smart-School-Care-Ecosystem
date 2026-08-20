import { create } from 'zustand';
import { StoreState, AttendanceStatus, Course, StudentSelfAssessment, MOCK_MULTI_ROLE_USERS, ActiveLearningCategory, ActiveLearningRecord } from './types';
import { MOCK_COURSES, MOCK_ANALYTICS, MOCK_LEAVE_REQUESTS, STATUS_CYCLE, GLOBAL_COURSES } from './data/mockData';
import { mockStudentsData } from './data/mockStudentsData';
import { mockSelfAssessments } from './data/mockSelfAssessments';
import { saveSelfAssessmentRecord } from './services/firestoreService';

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
    const parentId = studentObj?.studentId ? `parent_${studentObj.studentId}` : `parent_${studentId}`;

    // Handle warning threshold (< 80)
    if (newScore < 80) {
      const hasWarning = updatedNotifications.some(n => n.studentId === studentId && n.type === 'warning' && n.remainingScore === newScore);
      if (!hasWarning) {
        updatedNotifications.push({
          id: `notif_warn_${Date.now()}`,
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
  updateStudentProfile: (studentId, profile) => set((state) => ({
    students: state.students.map(s => {
      if (s.studentId === studentId) {
        return {
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
      }
      return s;
    })
  })),
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

    const newNotif = {
      id: `notif_sch_${Date.now()}`,
      parentId: `parent_${studentId}`,
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

  addMockParentNotification: (notif) => set((state) => ({
    parentNotifications: [
      {
        ...notif,
        id: `notif_${Date.now()}`,
        status: 'unread' as const,
        createdAt: new Date()
      },
      ...state.parentNotifications
    ]
  })),

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
  }
}));

