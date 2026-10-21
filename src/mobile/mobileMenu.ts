/** เมนูหน้ามือถือตามบทบาท — ตรรกะบริสุทธิ์ (test ได้) เมนูใช้บ่อยเท่านั้น งานอื่นเปิดเว็บเต็ม */
import type { MobileDueStatus } from '../lib/mobileDue';

export type MobileMenuId =
  | 'checkin' | 'schedule' | 'homeroom' | 'homeLocation' | 'chat'
  | 'club' | 'health' | 'sdq' | 'twoQ'                       // นักเรียน
  | 'childGate' | 'leave' | 'homeVisit' | 'appointment' | 'infirmary'     // ผู้ปกครอง (leave ใช้ร่วมกับนักเรียน)
  | 'courses' | 'portfolio'                                  // นักเรียน+ผู้ปกครอง (portfolio เฉพาะผู้ปกครอง)
  | 'approvals';                                             // ผู้อนุมัติ (หัวหน้า/รอง/ผอ.)

export interface MobileMenuItem { id: MobileMenuId; label: string }

/** ผู้อนุมัติคำขอเช็คชื่อย้อนหลัง (SUPER_ADMIN ไม่มีสิทธิ์ — ตรงกับ lateAttendanceFlow/rules) */
export const MOBILE_APPROVER_ROLES = ['ACADEMIC_HEAD', 'DEPUTY_DIRECTOR_ACADEMIC', 'DIRECTOR'] as const;

const STAFF_ROLES_WITH_SCHEDULE = [
  'SUBJECT_TEACHER', 'HOMEROOM_TEACHER', 'HEAD_OF_DEPARTMENT', 'ACADEMIC_HEAD', 'DEPUTY_DIRECTOR_ACADEMIC',
  'DIRECTOR', 'GUIDANCE_COUNSELOR', 'INSTRUCTIONAL_SUPERVISOR',
];

/** เมนูแบบประเมินที่ทำครั้งเดียวต่อรอบ (สุขภาพ/SDQ) จะหายเมื่อทำแล้ว; 2Q โผล่เมื่อครบ 2 สัปดาห์ — ยังไม่รู้สถานะ = ซ่อน */
export function mobileMenuFor(input: { appRole: string; roles: string[]; due?: MobileDueStatus }): MobileMenuItem[] {
  const { appRole, roles } = input;
  const due = input.due || {};
  if (appRole === 'student') {
    return [
      { id: 'checkin', label: 'เช็คอินเข้าโรงเรียน' },
      { id: 'schedule', label: 'ตารางเรียนวันนี้' },
      { id: 'courses', label: 'สถิติรายวิชา & คะแนนกิจกรรม' },
      { id: 'leave', label: 'ยื่นใบลา' },
      ...(due.clubOpen === true ? [{ id: 'club' as const, label: 'สมัครชุมนุม' }] : []),
      ...(due.healthDone === false ? [{ id: 'health' as const, label: 'บันทึกข้อมูลสุขภาพ' }] : []),
      ...(due.sdqDone === false ? [{ id: 'sdq' as const, label: 'ประเมิน SDQ' }] : []),
      ...(due.twoQDue === true ? [{ id: 'twoQ' as const, label: 'ประเมิน 2Q (ทุก 2 สัปดาห์)' }] : []),
      { id: 'homeLocation', label: 'พิกัดบ้านของฉัน' },
      { id: 'chat', label: 'สนทนากับครูประจำชั้น' },
    ];
  }
  if (appRole === 'parent' && roles.includes('PARENT')) {
    return [
      { id: 'childGate', label: 'เช็คอินเข้าโรงเรียนของบุตรหลาน' },
      { id: 'schedule', label: 'ตารางเรียนวันนี้ของบุตรหลาน' },
      { id: 'courses', label: 'สถิติรายวิชา & คะแนนกิจกรรม' },
      { id: 'portfolio', label: 'แฟ้มผลงานของบุตรหลาน' },
      { id: 'leave', label: 'ใบลา' },
      { id: 'appointment', label: 'นัดพบครู' },
      { id: 'infirmary', label: 'ห้องพยาบาลของบุตรหลาน' },
      { id: 'homeVisit', label: 'ข้อมูลเยี่ยมบ้าน' },
      ...(due.sdqDone === false ? [{ id: 'sdq' as const, label: 'ประเมิน SDQ' }] : []),
      { id: 'chat', label: 'สนทนากับครูประจำชั้น' },
    ];
  }
  if (appRole === 'parent') return [];
  // บุคลากร
  const items: MobileMenuItem[] = [{ id: 'checkin', label: 'เช็คอินเข้าโรงเรียน' }];
  if (roles.some(r => STAFF_ROLES_WITH_SCHEDULE.includes(r))) items.push({ id: 'schedule', label: 'ตารางสอนวันนี้' });
  // เมนูเดียวตามบทบาททั้งหมดที่บัญชีมี (ครูหนึ่งคนมีหลายบทบาทได้) — ผู้อนุมัติได้เมนูอนุมัติเพิ่ม
  if (roles.some(r => (MOBILE_APPROVER_ROLES as readonly string[]).includes(r))) items.push({ id: 'approvals', label: 'อนุมัติเช็คชื่อย้อนหลัง' });
  if (roles.includes('HOMEROOM_TEACHER')) {
    items.push({ id: 'homeroom', label: 'เช็คชื่อโฮมรูม' });
    items.push({ id: 'chat', label: 'ข้อความผู้ปกครอง/นักเรียน' });
  }
  return items;
}
