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
  parentUid?: string;     // Firebase Auth UID ของผู้ปกครอง (เชื่อมโยงตาม Security Rules)
  parentId?: string;      // Alias/Legacy ID
  parentEmail?: string;   // อีเมลผู้ปกครอง
  studentUid?: string;    // Firebase Auth UID ของนักเรียน
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
  parentUid: string;
  parentId?: string;
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
  parentUid: string;
  parentId?: string;
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

// Student & Parent Portal Enhanced Module Types
export interface GateAttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  type: 'ENTRY' | 'EXIT';
  timestamp: string; // e.g. "07:28 น."
  date: string; // e.g. "2026-08-20"
  gateName: string; // e.g. "ประตู 1 (หน้าโรงเรียน)"
  method: 'NFC_CARD' | 'BIOMETRIC_FACE' | 'BIOMETRIC_FINGER' | 'MANUAL' | 'GPS_GEOFENCE' | 'BEACON_BLE';
  status: 'ON_TIME' | 'LATE' | 'NORMAL';
  temperature?: number;
  parentNotified: boolean;
  distanceMeters?: number;
  coordinates?: { latitude: number; longitude: number };
  selfieUrl?: string;
}

export interface GPSCheckInLog {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  type: 'ENTRY' | 'EXIT';
  timestamp: string;
  date: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  isInsideGeofence: boolean;
  status: 'ON_TIME' | 'LATE' | 'EARLY_DEPARTURE' | 'NORMAL_DEPARTURE';
  accuracyMeters?: number;
  nearestGate?: string;
  selfieUrl?: string;
  notes?: string;
}

export interface DetailedLeaveRequest {
  id: string;
  studentId: string;
  leaveType: 'SICK' | 'PERSONAL' | 'ACTIVITY' | 'OTHER';
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  attachmentUrl?: string;
  attachmentName?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  submittedBy: string;
  submittedAt: string;
  teacherRemarks?: string;
  approvedBy?: string;
}

export interface SemesterHealthRecord {
  semester: string; // e.g. "1/2569"
  height: number; // cm
  weight: number; // kg
  bmi: number;
  bmiCategory: 'UNDERWEIGHT' | 'NORMAL' | 'OVERWEIGHT' | 'OBESE';
  bloodType: string;
  systolicBp?: number;
  diastolicBp?: number;
  recordedAt: string;
}

export interface ChronicIllness {
  id: string;
  name: string;
  severity: 'MILD' | 'MODERATE' | 'SEVERE';
  treatmentCare: string;
}

export interface AllergyRecord {
  id: string;
  allergen: string;
  type: 'FOOD' | 'DRUG' | 'ENVIRONMENTAL';
  reaction: string;
}

export interface SpecialCareNeed {
  id: string;
  category: string;
  description: string;
  actionPlan: string;
}

export interface InfirmaryVisit {
  id: string;
  studentId: string;
  visitTime: string;
  symptoms: string;
  temperature: number;
  treatment: string;
  medicationGiven: string;
  restDurationMinutes: number;
  nurseName: string;
  isUrgentAlert: boolean;
  parentAcknowledged: boolean;
  acknowledgedAt?: string;
}

export interface TwoQuestionScreening {
  id: string;
  studentId: string;
  q1Depressed: boolean; // ใน 2 สัปดาห์ที่ผ่านมารู้สึกหดหู่ เศร้า หรือท้อแท้
  q2Hopeless: boolean;  // ใน 2 สัปดาห์ที่ผ่านมารู้สึกเบื่อ ไม่มีความสุขในการทำสิ่งต่างๆ
  isPositive: boolean;
  conductedAt: string;
}

export interface PHQ9Screening {
  id: string;
  studentId: string;
  answers: number[]; // 9 questions (0 - 3)
  totalScore: number; // 0 - 27
  riskLevel: 'NORMAL' | 'MILD' | 'MODERATE' | 'SEVERE' | 'VERY_SEVERE';
  recommendation: string;
  conductedAt: string;
}

export interface SDQAssessment {
  id: string;
  studentId: string;
  evaluatorType: 'STUDENT' | 'TEACHER' | 'PARENT';
  evaluatorName: string;
  subscaleScores: {
    emotional: number; // อารมณ์ (0-10)
    conduct: number;   // ความประพฤติ (0-10)
    hyperactivity: number; // สมาธิสั้น (0-10)
    peerProblems: number;  // ปัญหาเพื่อน (0-10)
    prosocial: number;     // สัมพันธภาพทางสังคม (0-10)
  };
  totalDifficultiesScore: number; // รวม 4 ด้านแรก (0-40)
  triagingStatus: 'NORMAL' | 'AT_RISK' | 'VULNERABLE';
  assessmentDate: string;
  recommendations: string[];
}

export interface GuardianBackground {
  relation: string;
  fullName: string;
  phone: string;
  lineId: string;
  occupation: string;
  monthlyIncome: number;
  maritalStatus: 'MARRIED_TOGETHER' | 'DIVORCED' | 'SEPARATED' | 'DECEASED' | 'SINGLE_PARENT';
  householdMembersCount: number;
  dependentsCount: number;
  emergencyContact: {
    name: string;
    phone: string;
    relationship: string;
  };
}

export interface HomeVisitLogRecord {
  id: string;
  studentId: string;
  visitedDate: string;
  teacherName: string;
  counselorName: string;
  coordinates: [number, number];
  addressText: string;
  livingConditions: string;
  photos: { url: string; caption: string }[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  counselorNotes: string;
  studentEnvironmentRating: number; // 1-5
}

export interface EQFHardshipScreening {
  id: string;
  studentId: string;
  householdIncomePerCapita: number; // บาท/คน/เดือน
  electricityBillMonthly: number;
  housingConditionRating: number; // 1-5
  travelBarrierScore: number; // 1-5
  familyBurdenScore: number; // 1-5
  overallHardshipIndex: number; // 0-100
  isEligibleForGrant: boolean;
  grantType: string; // e.g. "ทุนเสมอภาค (กสศ.) กลุ่มยากจนพิเศษ"
  status: 'APPROVED' | 'UNDER_REVIEW' | 'REJECTED';
  assessedDate: string;
}

export interface MeritDemeritRecord {
  id: string;
  studentId: string;
  type: 'MERIT' | 'DEMERIT';
  points: number;
  category: string;
  description: string;
  teacherName: string;
  date: string;
  academicYear: string;
}

export interface BehaviorCertificate {
  certificateNo: string;
  studentId: string;
  studentFullName: string;
  studentNo: number;
  room: string;
  academicYear: string;
  currentScore: number;
  behaviorRating: 'EXCELLENT' | 'VERY_GOOD' | 'GOOD' | 'FAIR';
  issuedDate: string;
  directorName: string;
  verificationHash: string;
}

export interface PortfolioItem {
  id: string;
  studentId: string;
  title: string;
  category: 'ACADEMIC' | 'STEM' | 'ARTS_MUSIC' | 'SPORTS' | 'LEADERSHIP' | 'VOLUNTEER';
  awardLevel?: string;
  date: string;
  photos: string[];
  description: string;
  skills: string[];
  isVerifiedByTeacher: boolean;
  teacherVerifier?: string;
}

export interface DigitalCertificate {
  id: string;
  studentId: string;
  title: string;
  issuer: string;
  issueDate: string;
  category: 'ACADEMIC' | 'ACTIVITY' | 'VOLUNTEER' | 'EXTERNAL';
  certificateUrl: string;
  verificationStatus: 'VERIFIED_OFFICIAL' | 'VERIFIED_EXTERNAL' | 'PENDING';
  credentialId: string;
}

export interface VolunteerHourRecord {
  id: string;
  studentId: string;
  activityName: string;
  hours: number;
  organization: string;
  date: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
  verifierTeacher: string;
  description?: string;
}

export interface TCASPortfolioConfig {
  studentId: string;
  targetFaculty: string;
  targetUniversity: string;
  themeColor: string;
  statementOfPurpose: string;
  selectedPortfolioItemIds: string[];
  selectedCertificateIds: string[];
}

export interface ReportCardSubject {
  code?: string;
  courseCode?: string;
  name?: string;
  courseName?: string;
  credit?: number;
  credits?: number;
  preMidterm?: number;
  midterm?: number;
  midtermScore?: number;
  postMidterm?: number;
  final?: number;
  finalScore?: number;
  totalScore?: number;
  grade: string | number;
  evaluation?: 'ผ่านเกณฑ์ดีเยี่ยม' | 'ผ่านเกณฑ์' | 'ปรับปรุง' | string;
}

export interface ReportCardTerm {
  term?: string; // e.g. "1/2569"
  semester?: string;
  year?: string;
  gpa: number;
  gpax: number;
  creditsEarned?: number;
  totalCredits?: number;
  classRank?: number;
  homeroomRemarks?: string;
  studentId?: string;
  subjects: ReportCardSubject[];
}

export type ReportCardSemester = ReportCardTerm;

export interface HomeworkAssignment {
  id: string;
  studentId?: string;
  courseCode: string;
  courseName: string;
  title: string;
  description: string;
  dueDate: string;
  assignedDate: string;
  maxScore: number;
  status: 'ASSIGNED' | 'SUBMITTED' | 'GRADED' | 'OVERDUE';
  submittedFile?: string;
  submittedAt?: string;
  scoreReceived?: number;
  score?: number;
  teacherFeedback?: string;
  feedback?: string;
}

export interface ExamScheduleItem {
  id: string;
  subjectCode: string;
  subjectName: string;
  courseCode?: string;
  courseName?: string;
  examType: 'MIDTERM' | 'FINAL';
  date: string;
  time: string;
  timeSlot?: string;
  room: string;
  seatNumber: string;
  seatNo?: string;
  toolsAllowed?: string;
}

export interface BillingInvoiceItem {
  description: string;
  amount: number;
}

export interface BillingInvoice {
  id: string;
  studentId: string;
  invoiceNo: string;
  title: string;
  items: BillingInvoiceItem[];
  totalAmount: number;
  dueDate: string;
  status: 'UNPAID' | 'PAID' | 'OVERDUE';
  promptPayQr: string;
  paidAt?: string;
  receiptNo?: string;
}

export interface ParentTeacherMessage {
  id: string;
  studentId: string;
  senderRole: 'PARENT' | 'TEACHER' | 'COUNSELOR';
  senderName: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export interface ParentAppointment {
  id: string;
  studentId: string;
  parentId?: string;
  parentName?: string;
  teacherName: string;
  teacherRole?: string;
  topic: string;
  preferredDate?: string;
  date?: string;
  timeSlot: string;
  meetingType: 'ONSITE' | 'ONLINE_MEET';
  status: 'REQUESTED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  counselorNotes?: string;
  meetLink?: string;
  locationOrLink?: string;
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

  // Student & Parent Module Extended State
  gateAttendanceLogs: GateAttendanceRecord[];
  detailedLeaveRequests: DetailedLeaveRequest[];
  semesterHealthLogs: Record<string, SemesterHealthRecord[]>;
  chronicIllnesses: Record<string, ChronicIllness[]>;
  allergies: Record<string, AllergyRecord[]>;
  specialCareNeeds: Record<string, SpecialCareNeed[]>;
  infirmaryVisits: InfirmaryVisit[];
  twoQuestionScreenings: Record<string, TwoQuestionScreening>;
  phq9Screenings: Record<string, PHQ9Screening>;
  sdqAssessments: SDQAssessment[];
  guardianProfiles: Record<string, GuardianBackground>;
  homeVisitLogs: HomeVisitLogRecord[];
  eqfHardshipScreenings: Record<string, EQFHardshipScreening>;
  meritDemeritLogs: MeritDemeritRecord[];
  portfolioItems: PortfolioItem[];
  digitalCertificates: DigitalCertificate[];
  volunteerRecords: VolunteerHourRecord[];
  reportCards: Record<string, ReportCardTerm[]>;
  homeworkAssignments: HomeworkAssignment[];
  examSchedules: ExamScheduleItem[];
  billingInvoices: BillingInvoice[];
  parentTeacherMessages: ParentTeacherMessage[];
  parentAppointments: ParentAppointment[];

  schoolGeofenceConfig: {
    schoolId: string;
    schoolName: string;
    schoolAddress: string;
    centerCoordinates: { latitude: number; longitude: number };
    radiusMeters: number;
    entryStartTime: string;
    entryLateTime: string;
    exitStartTime: string;
    gates: { id: string; name: string; coordinates: { latitude: number; longitude: number }; radiusMeters: number }[];
  };
  gpsCheckInLogs: GPSCheckInLog[];

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
  updateStudentProfile: (studentId: string, profile: { nickname?: string; photoUrl?: string; address?: string; parentUid?: string; parentEmail?: string }) => void;
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

  // Extended Student & Parent Module Actions
  recordGateAttendance: (studentId: string, type: 'ENTRY' | 'EXIT', method: GateAttendanceRecord['method']) => void;
  submitDetailedLeave: (request: Omit<DetailedLeaveRequest, 'id' | 'submittedAt' | 'status'>) => void;
  approveDetailedLeave: (id: string, teacherRemarks?: string) => void;
  acknowledgeInfirmaryAlert: (visitId: string) => void;
  savePHQ9Screening: (studentId: string, answers: number[]) => void;
  save2QScreening: (studentId: string, q1: boolean, q2: boolean) => void;
  submitSDQAssessment: (sdq: Omit<SDQAssessment, 'id' | 'assessmentDate'>) => void;
  addMeritDemeritRecord: (studentId: string, type: 'MERIT' | 'DEMERIT', points: number, category: string, description: string, teacherName: string) => void;
  addPortfolioItem: (item: Omit<PortfolioItem, 'id' | 'isVerifiedByTeacher'>) => void;
  addDigitalCertificate: (cert: Omit<DigitalCertificate, 'id'>) => void;
  submitVolunteerHours: (record: Omit<VolunteerHourRecord, 'id' | 'status'>) => void;
  submitHomework: (assignmentId: string, fileName: string) => void;
  payBillingInvoice: (invoiceId: string) => void;
  sendParentTeacherMessage: (studentId: string, senderRole: ParentTeacherMessage['senderRole'], senderName: string, message: string) => void;
  bookParentAppointment: (appointment: Omit<ParentAppointment, 'id' | 'status'>) => void;

  // GPS Geofence Actions
  addGPSCheckInLog: (log: Omit<GPSCheckInLog, 'id'>) => void;
  updateSchoolGeofenceConfig: (config: Partial<StoreState['schoolGeofenceConfig']>) => void;
}
