// 1. นิยามบทบาทหลักทั้งหมดในโรงเรียน
export type UserRole = 
  | 'SUPER_ADMIN'          // แอดมินดูแลระบบ
  | 'EXECUTIVE'            // ผู้อำนวยการ / รองผู้อำนวยการ
  | 'HEAD_OF_DEPARTMENT'   // หัวหน้ากลุ่มสาระการเรียนรู้ (Stage 1)
  | 'ACADEMIC_HEAD'        // หัวหน้าฝ่ายวิชาการและหลักสูตร (Stage 2)
  | 'DEPUTY_DIRECTOR_ACADEMIC' // รองผู้อำนวยการฝ่ายวิชาการ (Stage 3)
  | 'DIRECTOR'             // ผู้อำนวยการโรงเรียน (Stage 4)
  | 'HOMEROOM_TEACHER'     // ครูประจำชั้น
  | 'SUBJECT_TEACHER'      // ครูผู้สอน / ครูประจำวิชา
  | 'SUPERVISORY_TEACHER'  // ครูนิเทศ
  | 'INFIRMARY_STAFF'      // ครูพยาบาล / เจ้าหน้าที่ห้องพยาบาล
  | 'GUIDANCE_COUNSELOR'   // ครูแนะแนว / ให้คำปรึกษา
  | 'FINANCE_STAFF'        // เจ้าหน้าที่งานการเงิน / บัญชี
  | 'INSTRUCTIONAL_SUPERVISOR' // ครูผู้นิเทศ / หัวหน้าฝ่ายวิชาการ
  | 'PARENT'               // ผู้ปกครองนักเรียน
  | 'STUDENT';             // นักเรียน

// 2. นิยามสิทธิ์การเข้าถึง (Permissions)
export type Permission = 
  | 'MANAGE_SYSTEM'        // จัดการระบบ/ผู้ใช้งาน
  | 'APPROVE_GRADES'       // อนุมัติเกรด/ผลการเรียน
  | 'EDIT_GRADES'          // กรอก/แก้ไขคะแนน
  | 'VIEW_ALL_REPORTS'     // ดูรายงานภาพรวมทั้งโรงเรียน
  | 'VIEW_DEPT_REPORTS'    // ดูรายงานเฉพาะกลุ่มสาระฯ
  | 'MANAGE_HOMEROOM'      // ดูแลเช็กชื่อ/พฤติกรรมห้องตนเอง
  | 'EVALUATE_TEACHERS'    // ประเมิน/นิเทศครู
  | 'MANAGE_INFIRMARY'     // บันทึกและจัดการห้องพยาบาล ยา และตรวจสุขภาพ
  | 'MANAGE_COUNSELING'    // จัดการระบบแนะแนว เคสให้คำปรึกษา และ SDQ/EQ
  | 'MANAGE_FINANCE'       // จัดการงานการเงิน บัญชี และเบิกจ่ายงบประมาณ
  | 'MANAGE_SUPERVISION';  // จัดการงานนิเทศการสอน และตรวจสอบแผนการจัดการเรียนรู้

// 3. โครงสร้างบัญชีผู้ใช้ (User Profile)
export interface UserProfile {
  id: string;
  email: string;
  prefix: string;
  firstName: string;
  lastName: string;
  position: string;         // ตำแหน่งทางราชการ เช่น ครู คศ.2
  roles: UserRole[];        // รองรับการเป็นหลายบทบาท เช่น ['HOMEROOM_TEACHER', 'HEAD_OF_DEPARTMENT']
  
  // ข้อมูลผูกพันตามบทบาท (Contextual Assignments)
  assignments?: {
    departmentId?: string;  // สังกัดกลุ่มสาระฯ (เช่น กลุ่มสาระฯ วิทยาศาสตร์)
    homeroomClass?: string; // ห้องประจำชั้น (เช่น ม.5/8)
    teachingSubjects?: {    // วิชาที่สอนและห้องที่สอน
      subjectCode: string;
      className: string;
    }[];
    supervisoryMentees?: string[]; // รายชื่อครูที่ต้องไปนิเทศ (User IDs)
  };
}

// แผนผังการจับคู่ระหว่าง Role และ Permissions
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  SUPER_ADMIN: [
    'MANAGE_SYSTEM',
    'APPROVE_GRADES',
    'EDIT_GRADES',
    'VIEW_ALL_REPORTS',
    'VIEW_DEPT_REPORTS',
    'MANAGE_HOMEROOM',
    'EVALUATE_TEACHERS'
  ],
  EXECUTIVE: [
    'APPROVE_GRADES',
    'VIEW_ALL_REPORTS',
    'EVALUATE_TEACHERS'
  ],
  HEAD_OF_DEPARTMENT: [
    'APPROVE_GRADES',
    'EDIT_GRADES',
    'VIEW_DEPT_REPORTS',
    'EVALUATE_TEACHERS'
  ],
  ACADEMIC_HEAD: [
    'MANAGE_SUPERVISION',
    'APPROVE_GRADES',
    'VIEW_ALL_REPORTS',
    'EVALUATE_TEACHERS'
  ],
  DEPUTY_DIRECTOR_ACADEMIC: [
    'APPROVE_GRADES',
    'VIEW_ALL_REPORTS',
    'EVALUATE_TEACHERS',
    'MANAGE_SUPERVISION'
  ],
  DIRECTOR: [
    'MANAGE_SYSTEM',
    'APPROVE_GRADES',
    'VIEW_ALL_REPORTS',
    'EVALUATE_TEACHERS'
  ],
  HOMEROOM_TEACHER: [
    'MANAGE_HOMEROOM',
    'VIEW_DEPT_REPORTS'
  ],
  SUBJECT_TEACHER: [
    'EDIT_GRADES'
  ],
  SUPERVISORY_TEACHER: [
    'EVALUATE_TEACHERS'
  ],
  INFIRMARY_STAFF: [
    'MANAGE_INFIRMARY'
  ],
  GUIDANCE_COUNSELOR: [
    'MANAGE_COUNSELING'
  ],
  FINANCE_STAFF: [
    'MANAGE_FINANCE',
    'VIEW_ALL_REPORTS'
  ],
  INSTRUCTIONAL_SUPERVISOR: [
    'MANAGE_SUPERVISION',
    'EVALUATE_TEACHERS',
    'VIEW_ALL_REPORTS'
  ],
  PARENT: [],
  STUDENT: []
};

// 4. Helper Function ในการตรวจสอบสิทธิ์การเข้าถึงแบบจำเพาะเจาะจงบทบาทที่ใช้งานอยู่
export function hasPermission(
  user: UserProfile,
  activeRole: UserRole,
  requiredPermission: Permission
): boolean {
  // ตรวจสอบว่าผู้ใช้มีบทบาทนี้จริงหรือไม่
  if (!user.roles.includes(activeRole)) {
    return false;
  }

  // ดึงสิทธิ์ทั้งหมดที่มีภายใต้บทบาทที่เลือกใช้งานอยู่ (activeRole)
  const permissions = ROLE_PERMISSIONS[activeRole] || [];
  return permissions.includes(requiredPermission);
}

// 5. Mock Data ของครูที่มีบทบาทแบบ Multi-role สำหรับการทดสอบระบบ
export const MOCK_MULTI_ROLE_USERS: UserProfile[] = [
  {
    id: 'teacher-kiattisak',
    email: 'kiattisak@utd.ac.th',
    prefix: 'นาย',
    firstName: 'เกียรติศักดิ์',
    lastName: 'สถิตการุณย์ (Mr. Kiattisak)',
    position: 'ครู คศ.2 (กลุ่มสาระการเรียนรู้คณิตศาสตร์)',
    roles: ['SUBJECT_TEACHER', 'HOMEROOM_TEACHER'],
    assignments: {
      departmentId: 'math-dept',
      homeroomClass: 'M.5/8',
      teachingSubjects: [
        { subjectCode: 'ค32201', className: 'M.5/8' },
        { subjectCode: 'ค32101', className: 'M.5/9' },
        { subjectCode: 'ค32201', className: 'M.5/9' },
        { subjectCode: 'ค32101', className: 'M.5/11' },
        { subjectCode: 'ค32101', className: 'M.5/8' },
        { subjectCode: 'HR', className: 'M.5/8' },
        { subjectCode: 'CZ', className: 'M.5' }
      ]
    }
  },
  {
    id: 'nurse-kanokwan',
    email: 'kanokwan.n@utd.ac.th',
    prefix: 'นางสาว',
    firstName: 'กนกวรรณ',
    lastName: 'พยาบาลวิชาชีพ',
    position: 'พยาบาลโรงเรียน (Nurse Practitioner)',
    roles: ['INFIRMARY_STAFF'],
    assignments: {
      departmentId: 'health-dept'
    }
  },
  {
    id: 'counselor-suda',
    email: 'suda.c@utd.ac.th',
    prefix: 'ดร.',
    firstName: 'สุดา',
    lastName: 'จิตวิทยา',
    position: 'ครูแนะแนวและจิตวิทยาการปรึกษา (Guidance Counselor)',
    roles: ['GUIDANCE_COUNSELOR', 'SUBJECT_TEACHER'],
    assignments: {
      departmentId: 'guidance-dept'
    }
  },
  {
    id: 'teacher-somchai',
    email: 'somchai.j@school.ac.th',
    prefix: 'นาย',
    firstName: 'สมชาย',
    lastName: 'ใจดี',
    position: 'ครู คศ.1',
    roles: ['HOMEROOM_TEACHER', 'SUBJECT_TEACHER'],
    assignments: {
      homeroomClass: 'ม.5/8',
      teachingSubjects: [
        { subjectCode: 'TH32101', className: 'ม.5/8' },
        { subjectCode: 'TH32101', className: 'ม.5/9' }
      ]
    }
  },
  {
    id: 'teacher-wipada',
    email: 'wipada.r@school.ac.th',
    prefix: 'นางสาว',
    firstName: 'วิภาดา',
    lastName: 'รักเรียน',
    position: 'ครู คศ.3 (ครูชำนาญการพิเศษ)',
    roles: ['HEAD_OF_DEPARTMENT', 'SUPERVISORY_TEACHER', 'SUBJECT_TEACHER'],
    assignments: {
      departmentId: 'sci-dept',
      teachingSubjects: [
        { subjectCode: 'SCI32201', className: 'ม.5/8' }
      ],
      supervisoryMentees: ['teacher-somchai', 'teacher-anong']
    }
  },
  {
    id: 'executive-somkiat',
    email: 'somkiat.y@school.ac.th',
    prefix: 'นาย',
    firstName: 'สมเกียรติ',
    lastName: 'ยอดเยี่ยม',
    position: 'ผู้อำนวยการโรงเรียน',
    roles: ['EXECUTIVE', 'SUPER_ADMIN'],
    assignments: {
      departmentId: 'administration'
    }
  },
  {
    id: 'finance-somying',
    email: 'somying.f@utd.ac.th',
    prefix: 'นางสาว',
    firstName: 'สมหญิง',
    lastName: 'การเงิน',
    position: 'เจ้าหน้าที่บริหารงานการเงินและบัญชี',
    roles: ['FINANCE_STAFF'],
    assignments: {
      departmentId: 'finance-dept'
    }
  },
  {
    id: 'supervisor-narong',
    email: 'narong.s@utd.ac.th',
    prefix: 'ดร.',
    firstName: 'ณรงค์',
    lastName: 'วิชาการ',
    position: 'หัวหน้าฝ่ายวิชาการและศึกษานิเทศก์',
    roles: ['INSTRUCTIONAL_SUPERVISOR', 'SUPERVISORY_TEACHER', 'HEAD_OF_DEPARTMENT'],
    assignments: {
      departmentId: 'academic-dept',
      supervisoryMentees: ['teacher-somchai', 'teacher-wipada']
    }
  }
];
