/**
 * เหตุผลการสิ้นสุดการใช้งานบุคลากร ตามมาตรา 107 พ.ร.บ.ระเบียบข้าราชการครูและบุคลากรทางการศึกษา
 * ใช้คู่กับ staff.status (ACTIVE/INACTIVE): INACTIVE ต้องมี statusReason ที่ไม่ใช่ ACTIVE เสมอ
 *
 * ⚠️ ไฟล์นี้เป็นสำเนาของส่วนตรรกะใน src/lib/staffStatusReasons.ts (functions build แยกจาก src/) — แก้ต้องแก้ทั้งคู่
 * (มี test เทียบ: src/__tests__/staffStatusReasons.test.ts)
 */
export const STAFF_STATUS_REASONS = [
  'ACTIVE', 'RETIRED', 'RESIGNED', 'TRANSFERRED', 'ORDERED_TO_LEAVE', 'DISCIPLINARY_DISMISSAL', 'DECEASED',
] as const;
export type StaffStatusReason = (typeof STAFF_STATUS_REASONS)[number];

export const INACTIVE_STAFF_REASONS = STAFF_STATUS_REASONS.filter((r) => r !== 'ACTIVE') as Exclude<StaffStatusReason, 'ACTIVE'>[];

/** เหตุผลที่บังคับกรอกหมายเหตุ (มีเหตุผลย่อยหลายแบบตามมาตรา 107 ต้องระบุให้ชัด) */
export const REASONS_REQUIRING_NOTE: readonly StaffStatusReason[] = ['ORDERED_TO_LEAVE'];

export const MAX_NOTE_LENGTH = 500;

export const isStaffStatusReason = (v: unknown): v is StaffStatusReason =>
  typeof v === 'string' && (STAFF_STATUS_REASONS as readonly string[]).includes(v);

export type StatusRequestResult =
  | { ok: true; statusReason: StaffStatusReason; note: string }
  | { ok: false; message: string };

/**
 * ตรวจคำขอปิด/เปิดการใช้งาน
 * - ปิด (active=false): ต้องมี statusReason ที่ไม่ใช่ ACTIVE; หมายเหตุบังคับเฉพาะ ORDERED_TO_LEAVE
 * - เปิด (active=true): statusReason เป็น ACTIVE เสมอ (ถ้าส่งมาเป็นอย่างอื่น = ปฏิเสธ)
 */
export function validateStatusRequest(input: { active: boolean; statusReason?: unknown; reason?: unknown }): StatusRequestResult {
  const note = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (note.length > MAX_NOTE_LENGTH) return { ok: false, message: `หมายเหตุยาวได้ไม่เกิน ${MAX_NOTE_LENGTH} ตัวอักษร` };

  if (input.active) {
    if (input.statusReason !== undefined && input.statusReason !== null && input.statusReason !== 'ACTIVE') {
      return { ok: false, message: 'การเปิดใช้งานต้องมีสถานะเป็น ACTIVE เท่านั้น' };
    }
    return { ok: true, statusReason: 'ACTIVE', note };
  }

  if (!isStaffStatusReason(input.statusReason) || input.statusReason === 'ACTIVE') {
    return { ok: false, message: 'กรุณาเลือกสถานะการสิ้นสุดการใช้งาน (เกษียณ/ลาออก/โอน/ให้ออก/ไล่ออก-ปลดออก/ถึงแก่กรรม)' };
  }
  if (REASONS_REQUIRING_NOTE.includes(input.statusReason) && !note) {
    return { ok: false, message: 'กรณีให้ออกจากราชการ ต้องระบุหมายเหตุ (เหตุผลย่อยตามมาตรา 107)' };
  }
  return { ok: true, statusReason: input.statusReason, note };
}
