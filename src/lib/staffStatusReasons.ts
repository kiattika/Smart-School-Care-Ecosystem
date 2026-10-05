/**
 * เหตุผลการสิ้นสุดการใช้งานบุคลากร ตามมาตรา 107 พ.ร.บ.ระเบียบข้าราชการครูและบุคลากรทางการศึกษา
 * (staff.statusReason เก็บคู่กับ staff.status ACTIVE/INACTIVE — ตั้งผ่าน callable setStaffActive เท่านั้น)
 *
 * ⚠️ ส่วนตรรกะเป็นสำเนากับ functions/src/staffStatusReasons.ts — แก้ต้องแก้ทั้งคู่ (มี test เทียบ)
 * ป้ายภาษาไทยเป็นของฝั่ง client อย่างเดียว
 */
export const STAFF_STATUS_REASONS = [
  'ACTIVE', 'RETIRED', 'RESIGNED', 'TRANSFERRED', 'ORDERED_TO_LEAVE', 'DISCIPLINARY_DISMISSAL', 'DECEASED',
] as const;
export type StaffStatusReason = (typeof STAFF_STATUS_REASONS)[number];

export const INACTIVE_STAFF_REASONS = STAFF_STATUS_REASONS.filter((r) => r !== 'ACTIVE') as Exclude<StaffStatusReason, 'ACTIVE'>[];

export const STAFF_STATUS_LABELS_TH: Record<StaffStatusReason, string> = {
  ACTIVE: 'ปฏิบัติราชการ',
  RETIRED: 'เกษียณอายุราชการ',
  RESIGNED: 'ลาออกจากราชการ',
  TRANSFERRED: 'โอนไปส่วนราชการอื่น',
  ORDERED_TO_LEAVE: 'ให้ออกจากราชการ',
  DISCIPLINARY_DISMISSAL: 'ถูกลงโทษปลดออก/ไล่ออก',
  DECEASED: 'ถึงแก่กรรม',
};

/** เหตุผลที่บังคับกรอกหมายเหตุ */
export const REASONS_REQUIRING_NOTE: readonly StaffStatusReason[] = ['ORDERED_TO_LEAVE'];

export const MAX_NOTE_LENGTH = 500;

export const isStaffStatusReason = (v: unknown): v is StaffStatusReason =>
  typeof v === 'string' && (STAFF_STATUS_REASONS as readonly string[]).includes(v);

export type StatusRequestResult =
  | { ok: true; statusReason: StaffStatusReason; note: string }
  | { ok: false; message: string };

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

/** ป้ายสถานะของบุคลากรที่ถูกปิด — ข้อมูลเก่าที่ปิดไว้ก่อนมีระบบนี้ (ไม่มี statusReason) แสดงเป็น "ปิดการใช้งาน" */
export function inactiveStaffLabelTh(statusReason: unknown): string {
  return isStaffStatusReason(statusReason) && statusReason !== 'ACTIVE'
    ? STAFF_STATUS_LABELS_TH[statusReason]
    : 'ปิดการใช้งาน';
}
