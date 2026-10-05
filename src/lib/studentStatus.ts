/**
 * สถานะนักเรียนตามระเบียบกระทรวงศึกษาธิการ — นักเรียน "ห้ามลบถาวร" (บันทึกย้อนหลังยังอ้างถึง) เปลี่ยนสถานะแทน
 *
 * - `status` = 'ACTIVE' | 'INACTIVE' (รูปแบบเดิม ข้อมูลเก่าที่ไม่มี field = ACTIVE)
 * - `statusReason` = เหตุผลละเอียด 8 ค่า (ACTIVE = ยังศึกษาอยู่)
 * - ข้อมูลเก่าที่ไม่มี statusReason ตัดสินจาก `status` (INACTIVE = ไม่ได้ศึกษาต่อ ไม่ทราบสาเหตุ)
 */
export const STUDENT_STATUS_REASONS = [
  'ACTIVE', 'GRADUATED', 'WITHDRAWN', 'TRANSFERRED', 'EXPELLED', 'ABSENT_WITHDRAWN', 'DECEASED', 'IMPRISONED',
] as const;
export type StudentStatusReason = (typeof STUDENT_STATUS_REASONS)[number];

/** สถานะใหม่ที่เลือกได้ในฟอร์ม "เปลี่ยนสถานะ" (7 แบบ ไม่รวม ACTIVE) */
export const INACTIVE_STATUS_REASONS = STUDENT_STATUS_REASONS.filter((r) => r !== 'ACTIVE') as Exclude<StudentStatusReason, 'ACTIVE'>[];

export const STUDENT_STATUS_LABELS_TH: Record<StudentStatusReason, string> = {
  ACTIVE: 'ศึกษาอยู่',
  GRADUATED: 'จบการศึกษา',
  WITHDRAWN: 'ลาออก',
  TRANSFERRED: 'ย้ายสถานศึกษา',
  EXPELLED: 'พ้นสภาพ/ให้ออก',
  ABSENT_WITHDRAWN: 'จำหน่าย (ขาดเรียนติดต่อกัน)',
  DECEASED: 'เสียชีวิต',
  IMPRISONED: 'ต้องโทษจำคุก/คุมขัง',
};

export interface StudentStatusFields {
  status?: string | null;
  statusReason?: string | null;
}

export function isStudentStatusReason(v: unknown): v is StudentStatusReason {
  return typeof v === 'string' && (STUDENT_STATUS_REASONS as readonly string[]).includes(v);
}

/** เหตุผลสถานะปัจจุบัน — ไม่มีข้อมูลเลย = ACTIVE (นักเรียนเดิมก่อนมีระบบนี้) */
export function currentStatusReason(s: StudentStatusFields): StudentStatusReason | 'UNKNOWN_INACTIVE' {
  if (isStudentStatusReason(s.statusReason)) return s.statusReason;
  return s.status === 'INACTIVE' ? 'UNKNOWN_INACTIVE' : 'ACTIVE';
}

export function isStudentActive(s: StudentStatusFields): boolean {
  return currentStatusReason(s) === 'ACTIVE';
}

export function statusLabelTh(s: StudentStatusFields): string {
  const r = currentStatusReason(s);
  return r === 'UNKNOWN_INACTIVE' ? 'ไม่ได้ศึกษาต่อแล้ว' : STUDENT_STATUS_LABELS_TH[r];
}

export type StatusChangeValidation = { ok: true } | { ok: false; error: string };

/** กฎของฟอร์มเปลี่ยนสถานะ: ทุกสถานะที่ไม่ใช่ ACTIVE บังคับหมายเหตุ; กลับเป็น ACTIVE ไม่บังคับ */
export function validateStatusChange(target: StudentStatusReason, note: string, current: StudentStatusFields): StatusChangeValidation {
  if (!isStudentStatusReason(target)) return { ok: false, error: 'สถานะที่เลือกไม่ถูกต้อง' };
  if (currentStatusReason(current) === target) return { ok: false, error: 'นักเรียนอยู่ในสถานะนี้อยู่แล้ว' };
  if (target !== 'ACTIVE' && !note.trim()) return { ok: false, error: 'กรุณากรอกหมายเหตุ (บังคับทุกสถานะที่ไม่ใช่ศึกษาอยู่)' };
  return { ok: true };
}

/** field ที่เขียนลง students/{id} เมื่อเปลี่ยนสถานะ (statusChangedAt ใส่ตอนเขียน = serverTimestamp) */
export function statusFieldsFor(target: StudentStatusReason, note: string, changedBy: string) {
  return {
    status: target === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
    statusReason: target,
    statusNote: note.trim(),
    statusChangedBy: changedBy,
  };
}
