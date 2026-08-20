import { UserProfile, UserRole } from './types/auth';

export * from './types/auth';

export type Role = 'teacher' | 'parent' | 'advisor' | 'executive' | 'student' | 'admin';

export interface User {
  uid: string;
  role: Role;
  email: string;
  displayName: string;
  avatar?: string;
  profile?: UserProfile;
  activeRole?: UserRole;
}

export type AttendanceStatus = 'PRESENT' | 'LATE' | 'LEAVE' | 'ABSENT' | 'UNMARKED';

export interface Student {
  id: string;
  studentId: string;
  name: string;
  avatar?: string;
  seatIndex: number | null;
  room?: string;
  studentNo: number;       // เลขที่ (ใช้จัดเรียงข้อมูล strictly)
  fullName: string;        // ชื่อ-นามสกุล
  nickname: string;        // ชื่อเล่น
  photoUrl: string;        // ลิงก์รูปถ่ายหน้าตรง
  homeLocation: {
    address: string;       // ที่อยู่บ้าน
    coordinates: [number, number]; // [Lat, Lng] เผื่อไปดึง Google Maps
    routeImage: string;    // ลิงก์รูปแผนที่ดาวเทียมจำลองเส้นทางจากบ้าน -> รร.
  };
  attendance: {
    morningStatus: 'PRESENT' | 'ABSENT' | 'LATE' | 'LEAVE'; // มา, ขาด, สาย, ลา
    checkInMethod: 'SCAN' | 'GEOFENCE' | 'MANUAL' | null;   // วิธีเช็คชื่อ
    checkInTime: string | null;                             // เวลาที่บันทึก
  };
  // New fields for the reconciled Student schema
  studentCode?: string;   // รหัสประจำตัวนักเรียน
  title?: 'นาย' | 'นางสาว';
  firstName?: string;
  lastName?: string;
  grade?: string;         // ระดับชั้น (ม.5)
  number?: number;        // เลขที่ (1-10)
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface StudentAnalytics {
  studentId: string;
  subjectAttendanceRate: number; // percentage 0-100
  behaviorScore: number;
}

export type ActiveLearningCategory = 
  | 'ANSWER'         // ตอบคำถามในชั้นเรียน
  | 'COLLABORATION'  // ความร่วมมือและการทำงานกลุ่ม
  | 'PRESENTATION'   // การนำเสนอผลงาน
  | 'LEADERSHIP'     // ความเป็นผู้นำและการแก้ปัญหา
  | 'HELPING_PEERS'  // การช่วยเหลือและอธิบายให้เพื่อน
  | 'CREATIVITY'     // ความคิดสร้างสรรค์และนวัตกรรม
  | 'GENERAL';       // คะแนนทั่วไป

export interface ActiveLearningRecord {
  id: string;
  studentId: string;
  courseId?: string;
  points: number;
  category: ActiveLearningCategory;
  note?: string;
  awardedAt: string; // ISO string
}

export interface AttendanceRecord {
  studentId: string;
  status: AttendanceStatus;
}

export interface LeaveRequest {
  id: string;
  studentId: string;
  date: Date;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export interface LateAttendanceRequest {
  id: string;
  teacherName: string;
  subjectCode: string;
  subjectName: string;
  room: string;
  period: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: Date;
}

export interface ScheduleConfig {
  isActivityDay: boolean;
  shortenMinutes: number; // 0, 5, or 10
}

export interface GlobalCourse {
  courseId: string;
  code: string;
  courseName: string;
  teacherName: string;
  teacherEmail: string;
  roomName: string;
  scheduleString: string;
  level: string;
}

export interface Course {
  id: string;
  code: string;
  name: string;
  room: string;
  term: string;
  studentsCount: number;
  periodIndex?: number; 
  schedule?: string; 
  attendanceTaken: boolean;
  teacherName?: string;
  teacherEmail?: string;
  roleLabel?: string;
}

export interface ScheduleChangeRequest {
  id: string;
  courseId: string;
  teacherName: string;
  subjectCode: string;
  room: string;
  currentSchedule: string;
  note: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: Date;
}

export interface PostTeachingRecord {
  courseId: string;
  date: string;
  summary: string;
  problems: string;
  solutions: string;
  submittedAt: string;
  isLate: boolean;
}

export interface PeriodSwap {
  id: string;
  requesterEmail: string;
  targetEmail: string;
  requesterCourseId: string;
  targetCourseId: string;
  status: 'PENDING_TEACHER' | 'PENDING_ADMIN' | 'APPROVED' | 'REJECTED';
}

export interface SubstituteAssignment {
  id: string;
  originalTeacherEmail: string;
  substituteTeacherEmail: string;
  courseId: string;
  date: string;
}

export interface HomeVisit {
  studentId: string;
  advisorEmail: string;
  visitedAt: string;
  geoVerified: boolean;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  photoUploaded: boolean;
}

export interface SchoolDuty {
  dutyId: string;
  teacherEmail: string;
  date: string;
  location: string;
  status: 'CHECKED_IN' | 'ABSENT';
  logSubmitted: boolean;
}

export interface AdministrativeTask {
  taskId: string;
  assignedToEmail: string;
  department: string;
  taskName: string;
  deadline: string;
  status: 'PENDING' | 'COMPLETED_ON_TIME' | 'COMPLETED_LATE';
}

export interface StudentScore {
  id: string;
  courseId: string;
  studentId: string;
  preMidterm: number;
  midterm: number;
  postMidterm: number;
  final: number;
  total: number;
  grade: string;
}

export interface CourseScoreSetting {
  courseId: string;
  maxPreMidterm: number;
  maxMidterm: number;
  maxPostMidterm: number;
  maxFinal: number;
}

export interface ParentConference {
  id: string;
  studentId: string;
  studentName: string;
  parentId: string;
  status: 'PENDING' | 'SCHEDULED' | 'COMPLETED';
  title: string;
  message: string;
  createdAt: Date;
  remainingScore: number;
  scheduledDate: string | null;
  scheduledTime: string | null;
  availableSlots: string[];
  notes?: string;
}

export interface ParentNotification {
  id: string;
  parentId: string;
  studentId: string;
  studentName: string;
  title: string;
  message: string;
  status: 'unread' | 'read';
  createdAt: Date;
  pointsDeducted: number;
  remainingScore: number;
  attendanceStatus?: string;
  date?: string;
  type?: 'info' | 'warning' | 'critical';
}

export interface StudentSelfAssessment {
  id?: string;
  studentId: string;
  studentName?: string;
  submittedAt?: string;
  updatedAt?: string;
  isCompleted: boolean;
  
  // ส่วนที่ 1: ข้อมูลพื้นฐานและการติดต่อ (Basic Information)
  basicInfo: {
    titleFullName: string;       // ข้อ 1: คำนำหน้านาม ชื่อ-นามสกุล
    nickname: string;            // ข้อ 2: ชื่อเล่นที่อยากให้ครูเรียก
    gradeRoom: string;           // ข้อ 3: ระดับชั้น / ห้องเรียน (ม.4, ม.5, ม.6)
    studentNo: string;           // ข้อ 4: เลขที่
    contactChannels: string[];   // ข้อ 5: ช่องทางการติดต่อที่สะดวกที่สุด
    contactDetail: string;       // ข้อ 6: ระบุ ID / ข้อมูลติดต่อ
  };

  // ส่วนที่ 2: ภูมิหลัง บริบทครอบครัว และการเดินทาง (Background & Context)
  familyBackground: {
    livingWith: string;          // ข้อ 7: ปัจจุบันพักอาศัยอยู่กับใคร
    transportation: string;      // ข้อ 8: การเดินทางมาโรงเรียนส่วนใหญ่ใช้พาหนะใด
    travelTime: string;          // ข้อ 9: ระยะเวลาที่ใช้ในการเดินทางมาโรงเรียน
    responsibilities: string[];  // ข้อ 10: ภาระงานนอกเหนือจากการเรียนที่ต้องรับผิดชอบประจำ
    consultPerson: string;       // ข้อ 11: เมื่อมีเรื่องสบายใจ/ไม่สบายใจ ปรึกษาใครบ่อยที่สุด
  };

  // ส่วนที่ 3: ตัวตน นิสัย และความสนใจ (Identity & Interests)
  identity: {
    threeWords: string;          // ข้อ 12: เลือก 3 คำที่อธิบายความเป็นตัวตน
    hobbies: string[];           // ข้อ 13: งานอดิเรก หรือกิจกรรมที่ชอบทำมากที่สุดยามว่าง
    specialSkills: string;       // ข้อ 14: ทักษะ ความสามารถพิเศษ หรือจุดแข็งที่ภาคภูมิใจ
    groupRole: string;           // ข้อ 15: เมื่อต้องทำงานกลุ่ม ถนัดทำหน้าที่ใดมากที่สุด
  };

  // ส่วนที่ 4: สไตล์การเรียนรู้และทักษะยุคใหม่ (Learning Style & AI)
  learningStyle: {
    preferredStyles: string[];   // ข้อ 16: รูปแบบการเรียนรู้ที่ทำให้เข้าใจเนื้อหาได้ดีที่สุด
    learningObstacles: string[]; // ข้อ 17: ข้อจำกัดหรือสิ่งที่รู้สึกว่าเป็นอุปสรรคต่อการเรียนรู้
    primaryDevices: string[];    // ข้อ 18: อุปกรณ์หลักที่ใช้นอกเวลาเรียนเพื่อทำรายงาน
    aiExperience: string;        // ข้อ 19: ประสบการณ์การใช้เครื่องมือ AI (เช่น ChatGPT) ช่วยเรียน
    teacherStyle: string;        // ข้อ 20: สไตล์ครูผู้สอนที่ทำให้นักเรียนเรียนได้อย่างมีความสุข
  };

  // ส่วนที่ 5: ความสัมพันธ์ โซเชียลมีเดีย และความปลอดภัย (Social Media & Bullying)
  socialAndSafety: {
    topSocialMedia: string[];    // ข้อ 21: โซเชียลมีเดียที่ใช้บ่อยที่สุด 2 อันดับแรก
    schoolBullyingExperience: string; // ข้อ 22: ประสบการณ์พบเห็นหรือโดนบูลลี่ในโรงเรียน
    cyberbullyingExperience: string;  // ข้อ 23: ประสบการณ์ Cyberbullying บนโลกออนไลน์
    schoolSafetyScore: number;        // ข้อ 24: ระดับความรู้สึกปลอดภัยและสบายใจเมื่ออยู่โรงเรียน (1-5)
    socialComparisonStress: string;   // ข้อ 25: เคยรู้สึกเครียดจากการเปรียบเทียบตัวเองบนโซเชียลไหม
    messageToTeacherSafety: string;   // ข้อ 26: พื้นที่ฝากบอกครู: เรื่องแกล้งกันหรือออนไลน์ที่อยากให้ครูสอดส่อง
  };

  // ส่วนที่ 6: เป้าหมาย อนาคต และข้อความถึงครู (Goals & Expectations)
  futureGoals: {
    careerGoals: string;             // ข้อ 27: เป้าหมายการศึกษาต่อหรืออาชีพในอนาคตที่สนใจ
    selfImprovement: string;         // ข้อ 28: สิ่งสำคัญที่อยากพัฒนาตัวเองให้ดีขึ้นในระดับ ม.ปลาย
    supportNeeded: string;           // ข้อ 29: สิ่งที่อยากให้ครูหรือโรงเรียนช่วยเหลือ/สนับสนุนมากที่สุด
    privateMessageToTeacher: string; // ข้อ 30: สิ่งที่อยากบอกครูเพิ่มเติม (ข้อมูลลับส่วนตัว)
  };
}

export interface StoreState {
  user: User | null;
  currentDate: Date;
  currentPeriod: string;
  students: Student[];
  courses: Course[];
  globalCourses: GlobalCourse[];
  homeroomAssignments: Record<string, string>; // teacherEmail -> roomName
  scheduleChangeRequests: ScheduleChangeRequest[];
  analytics: StudentAnalytics[];
  attendanceRecords: Record<string, Record<string, AttendanceStatus>>; // mapped by courseId -> studentId
  leaveRequests: LeaveRequest[];
  lateAttendanceRequests: LateAttendanceRequest[];
  scheduleConfig: ScheduleConfig;
  schoolCheckInRecords: Record<string, { status: AttendanceStatus, time?: Date }>;
  
  postTeachingRecords: PostTeachingRecord[];
  periodSwaps: PeriodSwap[];
  substituteAssignments: SubstituteAssignment[];

  homeVisits: HomeVisit[];
  schoolDuties: SchoolDuty[];
  administrativeTasks: AdministrativeTask[];
  studentScores: StudentScore[];
  courseScoreSettings: CourseScoreSetting[];

  parentConferences: ParentConference[];
  parentNotifications: ParentNotification[];
  selfAssessments: Record<string, StudentSelfAssessment>;
  
  // Active Learning Points & Leaderboard
  activeLearningPoints: Record<string, number>; // studentId -> cumulative points
  activeLearningLogs: ActiveLearningRecord[];

  // Actions
  addActiveLearningPoints: (studentId: string, points: number, category?: ActiveLearningCategory, note?: string, courseId?: string) => void;
  setUser: (user: User | null) => void;
  setCurrentDate: (date: Date) => void;
  setCurrentPeriod: (period: string) => void;
  cycleAttendanceStatus: (courseId: string, studentId: string) => void;
  setAttendanceStatus: (courseId: string, studentId: string, status: AttendanceStatus) => void;
  adjustBehaviorScore: (studentId: string, amount: number) => void;
  submitLeaveRequest: (studentId: string, date: Date, reason: string) => void;
  updateLeaveRequestStatus: (id: string, status: 'APPROVED' | 'REJECTED') => void;
  moveStudentSeat: (studentId: string, newSeatIndex: number | null) => void;
  resetClassroomSeats: (room?: string) => void;
  autoAssignClassroomSeats: (room?: string, capacity?: number) => void;
  submitLateAttendanceRequest: (req: Omit<LateAttendanceRequest, 'id' | 'status'>) => void;
  updateLateAttendanceRequestStatus: (id: string, status: 'APPROVED' | 'REJECTED') => void;
  setScheduleConfig: (config: ScheduleConfig) => void;
  setGlobalCourses: (courses: GlobalCourse[]) => void;
  setHomeroomAssignments: (assignments: Record<string, string>) => void;
  markSchoolCheckIn: (studentId: string, status: AttendanceStatus, time?: Date) => void;
  setCourses: (courses: Course[]) => void;
  updateCourseSchedule: (courseId: string, newSchedule: string) => void;
  submitScheduleChangeRequest: (req: Omit<ScheduleChangeRequest, 'id' | 'status' | 'createdAt'>) => void;
  updateScheduleChangeRequestStatus: (id: string, status: 'APPROVED' | 'REJECTED') => void;
  markAttendanceDone: (courseId: string) => void;
  updateStudentProfile: (studentId: string, profile: { nickname: string; photoUrl: string; address: string }) => void;
  updateMorningAttendance: (studentId: string, status: 'PRESENT' | 'ABSENT' | 'LATE' | 'LEAVE', method: 'SCAN' | 'GEOFENCE' | 'MANUAL') => void;
  
  submitPostTeachingRecord: (record: PostTeachingRecord) => void;
  submitPeriodSwap: (swap: Omit<PeriodSwap, 'id' | 'status'>) => void;
  updatePeriodSwapStatus: (id: string, status: PeriodSwap['status']) => void;
  assignSubstituteTeacher: (assignment: Omit<SubstituteAssignment, 'id'>) => void;
  removeSubstituteAssignment: (id: string) => void;

  submitHomeVisit: (visit: HomeVisit) => void;
  updateSchoolDutyStatus: (dutyId: string, status: 'CHECKED_IN' | 'ABSENT') => void;
  submitSchoolDutyLog: (dutyId: string) => void;
  updateAdministrativeTaskStatus: (taskId: string, status: 'COMPLETED_ON_TIME' | 'COMPLETED_LATE') => void;
  updateStudentScore: (courseId: string, studentId: string, scores: Partial<StudentScore>) => void;
  updateCourseScoreSetting: (setting: CourseScoreSetting) => void;

  // New Actions for Parent Engagement
  scheduleConference: (conferenceId: string, date: string, time: string) => void;
  addMockParentNotification: (notif: Omit<ParentNotification, 'id' | 'createdAt' | 'status'>) => void;
  saveSelfAssessment: (assessment: StudentSelfAssessment) => Promise<void>;
}
