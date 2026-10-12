import { canTeacherDecide } from './leaveFlow';

/**
 * กระดิ่งงานค้างของบุคลากร — คำนวณสดจากข้อมูลจริงที่ครูมีสิทธิ์เห็นตามบทบาทที่ใช้งานอยู่ (activeRole)
 * ไม่ใช่กล่องข้อความ: งานหายจากกระดิ่งเองเมื่อมีคนจัดการแล้ว (ไม่ค้างเป็น "ยังไม่อ่าน" ของเรื่องที่จบไปแล้ว)
 *
 * แหล่งที่ต่อแล้ว: ใบลานักเรียนรอครูที่ปรึกษา · คำขอเช็คชื่อย้อนหลัง/เข้าหลังเวลารอรองผอ.วิชาการ
 * ยังไม่ต่อ (ต้องตัดสินใจก่อน — ดูรายงานรอบนี้): 2Q บวก/9Q ธงแดง, คำขอนัดพบครูจากผู้ปกครอง
 */
export type StaffTaskKind = 'LEAVE' | 'LATE_ATTENDANCE';

export interface StaffTask {
  kind: StaffTaskKind;
  label: string;
  count: number;
  /** บอกว่าไปจัดการที่ไหน (กระดิ่งไม่พาไปหน้าอื่นเอง) */
  where: string;
}

export interface StaffTaskInput {
  activeRole: string;
  /** ใบลาของห้องที่ฉันเป็นครูที่ปรึกษา (ว่างได้ถ้าไม่ใช่ครูที่ปรึกษา) */
  roomLeaves: { status: string }[];
  /** คำขอเช็คชื่อย้อนหลังทั้งหมดที่ฉันมีสิทธิ์เห็น */
  lateRequests: { status: string }[];
}

export const LATE_REQUEST_APPROVER_ROLES = ['DEPUTY_DIRECTOR_ACADEMIC', 'SUPER_ADMIN'] as const;

/** บทบาทที่ต้องฟังใบลาห้อง / คำขอเข้าสาย — ใช้ตัดสินว่าจะ subscribe อะไร (ไม่ subscribe เกินสิทธิ์) */
export function staffTaskSources(activeRole: string): { leaves: boolean; lateRequests: boolean } {
  return {
    leaves: activeRole === 'HOMEROOM_TEACHER',
    lateRequests: (LATE_REQUEST_APPROVER_ROLES as readonly string[]).includes(activeRole),
  };
}

export function buildStaffTasks(input: StaffTaskInput): StaffTask[] {
  const src = staffTaskSources(input.activeRole);
  const tasks: StaffTask[] = [];
  if (src.leaves) {
    const n = input.roomLeaves.filter(l => canTeacherDecide(l.status)).length;
    if (n > 0) tasks.push({ kind: 'LEAVE', label: 'ใบลานักเรียนรออนุมัติ', count: n, where: 'พอร์ทัลครูที่ปรึกษา → ภาพรวม (ส่วน A)' });
  }
  if (src.lateRequests) {
    const n = input.lateRequests.filter(r => r.status === 'PENDING').length;
    if (n > 0) tasks.push({ kind: 'LATE_ATTENDANCE', label: 'คำขอเช็คชื่อย้อนหลังรออนุมัติ', count: n, where: 'พอร์ทัลอนุมัติ' });
  }
  return tasks;
}

export function totalStaffTasks(tasks: StaffTask[]): number {
  return tasks.reduce((sum, t) => sum + t.count, 0);
}
