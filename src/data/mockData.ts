import { Course, GlobalCourse, LeaveRequest, Student, StudentAnalytics, AttendanceStatus } from '../types';
import { mockStudentsData } from './mockStudentsData';
import { TEACHING_LOAD_DATA, TeacherTeachingLoad, TeachingSubject, convertTeachingLoadToGlobalCourses } from './teachingLoadData';

export * from './teachingLoadData';

export const STATUS_CYCLE: AttendanceStatus[] = ['PRESENT', 'LATE', 'LEAVE', 'ABSENT'];

export const MOCK_STUDENTS: Student[] = mockStudentsData.slice(0, 10);

export const MOCK_COURSES: Course[] = [
  {
    id: 'c-kiattisak-1',
    code: 'ค32201',
    name: 'คณิตศาสตร์เพิ่มเติม',
    room: 'ม.5/8',
    term: '1/2569',
    studentsCount: 40,
    attendanceTaken: false,
    periodIndex: 2,
    schedule: 'อ2, พ4, ฤ1, ศ3'
  },
  {
    id: 'c-kiattisak-2',
    code: 'ค32101',
    name: 'คณิตศาสตร์พื้นฐาน',
    room: 'ม.5/9',
    term: '1/2569',
    studentsCount: 38,
    attendanceTaken: true,
    periodIndex: 3,
    schedule: 'อ3-4'
  },
  {
    id: 'c-kiattisak-3',
    code: 'ค32201',
    name: 'คณิตศาสตร์เพิ่มเติม',
    room: 'ม.5/9',
    term: '1/2569',
    studentsCount: 38,
    attendanceTaken: false,
    periodIndex: 1,
    schedule: 'จ1, พ8, ฤ2, ศ2'
  },
  {
    id: 'c-kiattisak-4',
    code: 'ค32101',
    name: 'คณิตศาสตร์พื้นฐาน',
    room: 'ม.5/11',
    term: '1/2569',
    studentsCount: 42,
    attendanceTaken: false,
    periodIndex: 6,
    schedule: 'อ6, ศ1'
  },
  {
    id: 'c-kiattisak-5',
    code: 'ค32101',
    name: 'คณิตศาสตร์พื้นฐาน',
    room: 'ม.5/8',
    term: '1/2569',
    studentsCount: 40,
    attendanceTaken: false,
    periodIndex: 6,
    schedule: 'จ6-7'
  },
  {
    id: 'c-kiattisak-6',
    code: 'HR',
    name: 'HomeRoom (กิจกรรม)',
    room: 'ม.5/8',
    term: '1/2569',
    studentsCount: 40,
    attendanceTaken: true,
    periodIndex: 0,
    schedule: 'จ0, อ0, พ0, ฤ0, ศ0'
  },
  {
    id: 'c-kiattisak-7',
    code: 'CZ',
    name: 'Cleaning Zone (กิจกรรม)',
    room: 'ม.5',
    term: '1/2569',
    studentsCount: 40,
    attendanceTaken: false,
    periodIndex: 8,
    schedule: 'จ8-9'
  }
];

export const GLOBAL_COURSES: GlobalCourse[] = convertTeachingLoadToGlobalCourses();

export const MOCK_ANALYTICS: StudentAnalytics[] = mockStudentsData.map((s, idx) => ({
  studentId: s.studentId,
  subjectAttendanceRate: 85 + ((idx * 5) % 15),
  behaviorScore: 90 + ((idx * 2) % 10)
}));

export const MOCK_LEAVE_REQUESTS: LeaveRequest[] = [
  {
    id: 'LR-01',
    studentId: '6950801',
    date: new Date(),
    reason: 'มีไข้สูง ปวดศีรษะ ไปพบแพทย์ที่ รพ.อุตรดิตถ์',
    status: 'PENDING'
  },
  {
    id: 'LR-02',
    studentId: '6950803',
    date: new Date(),
    reason: 'เข้าร่วมการแข่งขันโอลิมปิกวิชาการระดับภาค',
    status: 'APPROVED'
  }
];

export const MOCK_VISIT_DATA = [
  {
    studentId: '6950801',
    address: '12/3 หมู่ 1 ต.ท่าเสา อ.เมือง จ.อุตรดิตถ์',
    distance: '3.2 กม.',
    visitStatus: 'PENDING',
    urgent: false
  },
  {
    studentId: '6950802',
    address: '45/1 หมู่ 3 ต.ในเมือง อ.เมือง จ.อุตรดิตถ์',
    distance: '1.5 กม.',
    visitStatus: 'COMPLETED',
    urgent: false
  },
  {
    studentId: '6950803',
    address: '88/9 หมู่ 5 ต.บ้านเกาะ อ.เมือง จ.อุตรดิตถ์',
    distance: '5.8 กม.',
    visitStatus: 'PENDING',
    urgent: true
  }
];

export const mockExecutiveData = {
  gisStudents: [
    {
      id: 'GIS-01',
      name: 'นายกิตติศักดิ์ เจริญสุข',
      lat: 17.62514,
      lng: 100.09315,
      riskStatus: 'safe' as const,
      isScholarship: false,
      commuteDistance: '3.2 กม.',
      grade: 'ม.5/8'
    },
    {
      id: 'GIS-02',
      name: 'นายณัฐวุฒิ สุขประเสริฐ',
      lat: 17.62124,
      lng: 100.09845,
      riskStatus: 'safe' as const,
      isScholarship: true,
      commuteDistance: '1.5 กม.',
      grade: 'ม.5/8'
    },
    {
      id: 'GIS-03',
      name: 'นายธีรภัทร มั่นคง',
      lat: 17.63852,
      lng: 100.11452,
      riskStatus: 'warning' as const,
      isScholarship: true,
      commuteDistance: '5.8 กม.',
      grade: 'ม.5/8'
    },
    {
      id: 'GIS-04',
      name: 'นางสาวพิมลภา สว่างจิต',
      lat: 17.60421,
      lng: 100.08123,
      riskStatus: 'critical' as const,
      isScholarship: true,
      commuteDistance: '8.4 กม.',
      grade: 'ม.5/8'
    },
    {
      id: 'GIS-05',
      name: 'นางสาวกัญญารัตน์ ชัยชนะ',
      lat: 17.61543,
      lng: 100.10234,
      riskStatus: 'safe' as const,
      isScholarship: false,
      commuteDistance: '2.1 กม.',
      grade: 'ม.5/8'
    }
  ],
  globalKPIs: {
    avgAttendance: 96.4,
    avgBehavior: 88.5,
    criticalAlerts: 4
  },
  attendanceTrends: [
    { month: 'พ.ค.', attendance: 98 },
    { month: 'มิ.ย.', attendance: 97.2 },
    { month: 'ก.ค.', attendance: 96.8 },
    { month: 'ส.ค.', attendance: 95.4 },
    { month: 'ก.ย.', attendance: 96.5 }
  ],
  riskProfile: [
    { name: 'ปลอดภัย (Safe)', value: 78, color: '#10b981' },
    { name: 'เฝ้าระวัง (Warning)', value: 16, color: '#f59e0b' },
    { name: 'วิกฤต (Critical)', value: 6, color: '#ef4444' }
  ],
  healthRisks: {
    malnutrition: 8,
    dentalIssues: 15,
    visionIssues: 18,
    mentalStress: 14,
    poorNutrition: 12
  },
  bmiDistribution: [
    { category: 'Underweight', count: 45 },
    { category: 'Normal', count: 320 },
    { category: 'Overweight', count: 68 },
    { category: 'Obese', count: 22 }
  ],
  correlationData: [
    { distance: 1.2, attendance: 98, late: 1 },
    { distance: 2.5, attendance: 95, late: 2 },
    { distance: 3.8, attendance: 92, late: 3 },
    { distance: 5.4, attendance: 88, late: 5 },
    { distance: 7.2, attendance: 84, late: 7 },
    { distance: 9.5, attendance: 78, late: 12 },
    { distance: 12.0, attendance: 72, late: 15 }
  ],
  policyProposals: [
    {
      id: 'POL-01',
      title: 'โครงการจัดรถรับส่งนักเรียนพื้นที่ห่างไกล (Zone ตะวันออก)',
      description: 'จัดสรรงบประมาณสนับสนุนยานพาหนะสำหรับนักเรียนที่เดินทางเกิน 8 กิโลเมตร เพื่อลดอัตราการมาเรียนสายและขาดเรียน',
      affectedStudents: 48,
      estimatedBudget: '฿120,000 / เทอม'
    },
    {
      id: 'POL-02',
      title: 'ทุนการศึกษาและอาหารกลางวันเพิ่มเติม กสศ.',
      description: 'ขยายโควตาทุนปัจจัยพื้นฐานนักเรียนยากจนพิเศษแบบมีเงื่อนไข เพื่อความต่อเนื่องทางการศึกษา',
      affectedStudents: 35,
      estimatedBudget: '฿175,000 / ปี'
    },
    {
      id: 'POL-03',
      title: 'ศูนย์ให้คำปรึกษาและเสริมสร้างสุขภาวะทางใจ (Mental Health Hub)',
      description: 'จัดจ้างนักจิตวิทยาโรงเรียนร่วมกับคุณครูแนะแนวเพื่อให้คำปรึกษาแก่นักเรียนกลุ่มเฝ้าระวังภาวะเครียด',
      affectedStudents: 24,
      estimatedBudget: '฿80,000 / ปี'
    }
  ]
};

export const mockImportedData = GLOBAL_COURSES;
