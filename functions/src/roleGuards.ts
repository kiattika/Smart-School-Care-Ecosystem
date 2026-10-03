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

// ─── setStaffActive: ปิด/เปิดการใช้งานบุคลากร ───

export const DEACTIVATE_SELF_MESSAGE =
  'ไม่สามารถปิดการใช้งานบัญชีของตัวเองได้ — ให้ผู้ดูแลระบบคนอื่นเป็นผู้ดำเนินการ';
export const LAST_SUPER_ADMIN_MESSAGE =
  'ไม่สามารถปิดการใช้งานผู้ดูแลระบบ (SUPER_ADMIN) คนสุดท้ายที่ยังใช้งานอยู่ได้ — เพิ่มหรือเปิดใช้งาน SUPER_ADMIN คนอื่นก่อน';

export interface SetActiveRequest {
  callerUid: string;
  callerStaffId?: unknown;
  targetStaffId: string;
  /** Auth UID ของเป้าหมาย (หาจาก staff.email) — null = ยังไม่เคย login */
  targetUid: string | null;
  /** roles ปัจจุบันของเป้าหมายจาก staff doc */
  targetRoles: string[];
  /** staff doc id ของ SUPER_ADMIN ทุกคนที่ยัง ACTIVE อยู่ตอนนี้ (รวมเป้าหมายถ้าเป็น) */
  activeSuperAdminStaffIds: string[];
  /** true = เปิดใช้งาน, false = ปิดการใช้งาน */
  active: boolean;
}

/**
 * คืนข้อความ error หรือ null ถ้าอนุญาต (ผู้เรียกผ่านการเช็ค SUPER_ADMIN มาก่อนแล้ว)
 * - เปิดใช้งาน: อนุญาตเสมอ
 * - ปิดตัวเอง: ห้าม (เทียบทั้ง staffId claim และ Auth UID)
 * - ปิด SUPER_ADMIN ที่ active คนสุดท้าย: ห้าม (ระบบจะไม่เหลือใครจัดการสิทธิ์ได้)
 */
export function setActiveError(req: SetActiveRequest): string | null {
  if (req.active) return null;
  if (isSelfTarget({ ...req, newRoles: req.targetRoles })) return DEACTIVATE_SELF_MESSAGE;
  if (req.targetRoles.includes('SUPER_ADMIN')) {
    const others = req.activeSuperAdminStaffIds.filter((id) => id !== req.targetStaffId);
    if (others.length === 0) return LAST_SUPER_ADMIN_MESSAGE;
  }
  return null;
}
