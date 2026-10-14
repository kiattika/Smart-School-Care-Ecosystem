import type { UserProfile } from '../types/auth';

export interface AdvisorOption { staffId: string; name: string }

const fullName = (s: Pick<UserProfile, 'prefix' | 'firstName' | 'lastName'>) => `${s.prefix || ''}${s.firstName || ''} ${s.lastName || ''}`.trim();

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
