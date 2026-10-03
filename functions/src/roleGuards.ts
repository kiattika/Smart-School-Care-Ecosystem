/**
 * กติกาการเปลี่ยนบทบาทใน assignUserRole — pure function (unit test: src/__tests__/roleGuards.test.ts)
 */

export const SELF_DEMOTION_MESSAGE =
  'ไม่สามารถถอนบทบาทผู้ดูแลระบบ (SUPER_ADMIN) ของตัวเองได้ เพื่อป้องกันการล็อกตัวเองออกจากระบบ — ให้ผู้ดูแลระบบคนอื่นเป็นผู้ดำเนินการ';

export interface RoleChangeRequest {
  /** Auth UID ของผู้เรียก (context.auth.uid) */
  callerUid: string;
  /** claim staffId ของผู้เรียก (ถ้ามี) */
  callerStaffId?: unknown;
  /** staff doc ที่จะถูกแก้ */
  targetStaffId: string;
  /** Auth UID ของเจ้าของ staff doc (หาจาก staff.email) — null = ยังไม่เคย login */
  targetUid: string | null;
  newRoles: string[];
}

/** เป้าหมายคือตัวผู้เรียกเองหรือไม่ — เทียบได้ทั้งทาง staffId claim และ Auth UID */
export function isSelfTarget(req: RoleChangeRequest): boolean {
  return (typeof req.callerStaffId === 'string' && req.callerStaffId !== '' && req.callerStaffId === req.targetStaffId)
    || (req.targetUid !== null && req.targetUid === req.callerUid);
}

/**
 * SUPER_ADMIN ห้ามถอน SUPER_ADMIN ของตัวเอง (รวมถึงตั้ง roles ว่าง) — คืนข้อความ error หรือ null ถ้าอนุญาต
 * (ผู้เรียกผ่านการเช็คว่าเป็น SUPER_ADMIN มาก่อนแล้ว จึงไม่ต้องดู roles เดิมของเป้าหมาย)
 */
export function selfDemotionError(req: RoleChangeRequest): string | null {
  if (!isSelfTarget(req)) return null;
  return req.newRoles.includes('SUPER_ADMIN') ? null : SELF_DEMOTION_MESSAGE;
}
