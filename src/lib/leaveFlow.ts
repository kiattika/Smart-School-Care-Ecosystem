/**
 * สายงานใบลานักเรียน (detailed_leave_requests) — ตรรกะบริสุทธิ์ที่ UI และเทสต์ใช้ร่วมกัน
 * (ต้องตรงกับ firestore.rules ของ detailed_leave_requests — ทดสอบเทียบใน firestore.rules.test.ts)
 *
 *   นักเรียนยื่น  → PENDING_PARENT  (ผู้ปกครองรับทราบ)  → PENDING_TEACHER → APPROVED / REJECTED
 *   ผู้ปกครองยื่น →                                      PENDING_TEACHER → APPROVED / REJECTED
 *   นักเรียนที่ยังไม่มีผู้ปกครองเชื่อมบัญชี → PENDING_TEACHER ทันที (ติดธง noParentLinked เพื่อไม่ให้ค้างรอคนที่ไม่มีอยู่จริง)
 */
export type LeaveStatus = 'PENDING_PARENT' | 'PENDING_TEACHER' | 'APPROVED' | 'REJECTED';
export type LeaveSubmitterRole = 'student' | 'parent';
export type LeaveType = 'SICK' | 'PERSONAL' | 'ACTIVITY' | 'OTHER';

export const LEAVE_TYPE_LABEL: Record<LeaveType, string> = {
  SICK: 'ลาป่วย', PERSONAL: 'ลากิจ', ACTIVITY: 'กิจกรรม', OTHER: 'อื่นๆ',
};

export const LEAVE_REASON_MAX = 500;

/** สถานะเริ่มต้นของใบลาใหม่ */
export function initialLeaveStatus(submitter: LeaveSubmitterRole, hasLinkedParent: boolean): LeaveStatus {
  if (submitter === 'parent') return 'PENDING_TEACHER';
  return hasLinkedParent ? 'PENDING_PARENT' : 'PENDING_TEACHER';
}

/** จำนวนวันลานับรวมวันเริ่ม-วันสิ้นสุด (ตามปฏิทิน) — คืน 0 ถ้าวันที่ไม่ถูกต้อง/วันสิ้นสุดก่อนวันเริ่ม */
export function countLeaveDays(startDate: string, endDate: string): number {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(startDate) || !re.test(endDate)) return 0;
  const s = Date.UTC(+startDate.slice(0, 4), +startDate.slice(5, 7) - 1, +startDate.slice(8, 10));
  const e = Date.UTC(+endDate.slice(0, 4), +endDate.slice(5, 7) - 1, +endDate.slice(8, 10));
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return 0;
  return Math.round((e - s) / 86400000) + 1;
}

export interface LeaveFormInput { leaveType: LeaveType; startDate: string; endDate: string; reason: string }

/** ตรวจฟอร์มก่อนส่ง — คืนรายการข้อความผิดพลาด (ว่าง = ผ่าน) */
export function validateLeaveForm(f: LeaveFormInput): string[] {
  const errs: string[] = [];
  if (!f.startDate) errs.push('เลือกวันที่เริ่มลา');
  if (!f.endDate) errs.push('เลือกวันที่สิ้นสุด');
  if (f.startDate && f.endDate && countLeaveDays(f.startDate, f.endDate) === 0) errs.push('วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มลา');
  if (countLeaveDays(f.startDate, f.endDate) > 60) errs.push('ลาติดต่อกันได้ไม่เกิน 60 วันต่อใบ');
  const reason = f.reason.trim();
  if (!reason) errs.push('ระบุเหตุผลการลา');
  if (reason.length > LEAVE_REASON_MAX) errs.push(`เหตุผลต้องไม่เกิน ${LEAVE_REASON_MAX} ตัวอักษร`);
  return errs;
}

/** ข้อมูลเก่าที่เคยใช้สถานะ 'PENDING' (ก่อนมีลำดับขั้น) ถือเป็นรอครู */
export function normalizeLeaveStatus(status: string): LeaveStatus {
  if (status === 'PENDING') return 'PENDING_TEACHER';
  return status as LeaveStatus;
}

export function isLeavePending(status: string): boolean {
  const s = normalizeLeaveStatus(status);
  return s === 'PENDING_PARENT' || s === 'PENDING_TEACHER';
}

/** ผู้ปกครองรับทราบได้เฉพาะใบที่นักเรียนยื่นและยังรอผู้ปกครอง */
export function canParentAcknowledge(status: string): boolean {
  return normalizeLeaveStatus(status) === 'PENDING_PARENT';
}

/** ครูตัดสินได้เฉพาะใบที่ผ่านขั้นผู้ปกครองแล้ว (หรือผู้ปกครองยื่นเอง) */
export function canTeacherDecide(status: string): boolean {
  return normalizeLeaveStatus(status) === 'PENDING_TEACHER';
}

/** ข้อความสถานะสำหรับผู้อ่านแต่ละฝั่ง */
export function leaveStatusLabel(status: string, opts: { noParentLinked?: boolean } = {}): string {
  switch (normalizeLeaveStatus(status)) {
    case 'PENDING_PARENT': return 'รอผู้ปกครองรับทราบ';
    case 'PENDING_TEACHER': return opts.noParentLinked ? 'รอครูที่ปรึกษา (ยังไม่มีผู้ปกครองเชื่อมบัญชี)' : 'รอครูที่ปรึกษาตรวจสอบ';
    case 'APPROVED': return 'อนุมัติแล้ว';
    case 'REJECTED': return 'ไม่อนุมัติ';
    default: return String(status);
  }
}
