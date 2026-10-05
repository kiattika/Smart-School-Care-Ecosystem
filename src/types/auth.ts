import type { StaffStatusReason } from "../lib/staffStatusReasons";
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
  /** 'INACTIVE' = ถูกปิดการใช้งาน (callable setStaffActive) — ไม่มี = ใช้งานได้ ดู src/lib/staffStatus.ts */
  status?: 'ACTIVE' | 'INACTIVE';
  /** เหตุผลตามมาตรา 107 (ACTIVE เมื่อใช้งานอยู่) — ข้อมูลที่ปิดไว้ก่อนมีระบบนี้ไม่มี field นี้ */
  statusReason?: StaffStatusReason;
  deactivationReason?: string;
  
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
