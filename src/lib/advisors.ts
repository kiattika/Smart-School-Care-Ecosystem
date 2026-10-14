import type { UserProfile } from '../types/auth';

export interface AdvisorOption { staffId: string; name: string }

/** ชื่อแสดง — ลำดับเดียวกับหน้าภาระงานสอน (fullName → คำนำหน้า+ชื่อ+สกุล → displayName → อีเมล) เพื่อไม่ให้ครูที่มีแค่ field ใดfield หนึ่งหายไป */
const fullName = (s: Partial<UserProfile> & { fullName?: string; displayName?: string }) =>
  (s.fullName || `${s.prefix || ''}${s.firstName || ''} ${s.lastName || ''}`.trim() || s.displayName || s.email || '').trim();

/** ครูที่ปรึกษาของห้อง = บุคลากรที่ยังใช้งานอยู่, มีบทบาท HOMEROOM_TEACHER และ assignments.homeroomClass ตรงห้อง (ตรงกับ isHomeroomTeacherOf ใน rules) */
export function advisorsOfRoom(staff: UserProfile[], room: string | undefined): AdvisorOption[] {
  if (!room) return [];
  return staff
    .filter(s => (s.roles || []).includes('HOMEROOM_TEACHER') && s.status !== 'INACTIVE' && s.assignments?.homeroomClass === room)
    .map(s => ({ staffId: s.id || '', name: fullName(s) }))
    .filter(a => a.staffId && a.name)
    .sort((a, b) => a.name.localeCompare(b.name, 'th'));
}

/** ครูแนะแนวที่ใช้งานอยู่ */
export function counselorsOf(staff: UserProfile[]): AdvisorOption[] {
  return staff
    .filter(s => (s.roles || []).includes('GUIDANCE_COUNSELOR') && s.status !== 'INACTIVE')
    .map(s => ({ staffId: s.id || '', name: fullName(s) }))
    .filter(a => a.staffId && a.name)
    .sort((a, b) => a.name.localeCompare(b.name, 'th'));
}
