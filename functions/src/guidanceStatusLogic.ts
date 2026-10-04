import { isStaffInactive } from './access';

/**
 * ตรรกะล้วน (ไม่แตะ Firebase) ของ "มีครูแนะแนวที่ใช้งานอยู่ไหม" — แยกจาก guidanceStatus.ts เพื่อ unit test ได้โดยไม่ initialize Admin SDK
 * (src/__tests__/guidanceStatus.test.ts)
 */

export interface StaffForGuidanceStatus {
  id: string;
  email?: unknown;
  roles?: unknown;
  status?: unknown;
}

export const GUIDANCE_ROLE = 'GUIDANCE_COUNSELOR';

/**
 * มีครูแนะแนวที่ใช้งานอยู่ (status ไม่ใช่ INACTIVE และ roles มี GUIDANCE_COUNSELOR) อย่างน้อย 1 คนหรือไม่
 * - ข้าม doc alias เก่าที่ใช้อีเมลเป็น doc id (seed เดิมเขียน staff/{email} ซ้ำกับ staff/{id}) เหมือน resolveAccess
 */
export function activeGuidanceCounselors(staff: readonly StaffForGuidanceStatus[]): StaffForGuidanceStatus[] {
  return staff.filter((s) => {
    if (typeof s.email === 'string' && s.id.toLowerCase() === s.email.trim().toLowerCase()) return false;
    if (isStaffInactive(s.status)) return false;
    return Array.isArray(s.roles) && s.roles.includes(GUIDANCE_ROLE);
  });
}

export function hasActiveGuidanceCounselor(staff: readonly StaffForGuidanceStatus[]): boolean {
  return activeGuidanceCounselors(staff).length > 0;
}
