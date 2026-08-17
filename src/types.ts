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
  
  // Actions
  setUser: (user: User | null) => void;
  setCurrentDate: (date: Date) => void;
  setCurrentPeriod: (period: string) => void;
  cycleAttendanceStatus: (courseId: string, studentId: string) => void;
  setAttendanceStatus: (courseId: string, studentId: string, status: AttendanceStatus) => void;
  adjustBehaviorScore: (studentId: string, amount: number) => void;
  submitLeaveRequest: (studentId: string, date: Date, reason: string) => void;
  updateLeaveRequestStatus: (id: string, status: 'APPROVED' | 'REJECTED') => void;
  moveStudentSeat: (studentId: string, newSeatIndex: number | null) => void;
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
}
