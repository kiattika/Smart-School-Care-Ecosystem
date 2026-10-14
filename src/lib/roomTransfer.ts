/**
 * ย้ายห้องเรียน (room_transfers) — งานทะเบียนวัดผลยื่นคำขอ → คณะกรรมการพิจารณา (งานทะเบียนบันทึกมติ) → ดำเนินการย้าย
 * (ต้องตรง firestore.rules บล็อก "room_transfers")
 *
 * - เก็บประวัติห้องเดิม/คณะสีเดิมไว้ในเอกสารคำขอเสมอ (APPLIED = ย้ายจริง ณ effectiveDate) ไม่ทับข้อมูลเดิม
 * - คณะสีตามห้อง: ผลงานก่อนวันที่ย้ายนับให้คณะสีเดิม, หลังวันที่ย้ายนับให้คณะสีใหม่ — ใช้ houseOn() (ระบบคะแนนถ้วยยังไม่ได้สร้าง)
 */
export type TransferStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'APPLIED';
export const TRANSFER_STATUS_LABEL: Record<TransferStatus, string> = {
  PENDING: 'รอคณะกรรมการพิจารณา', APPROVED: 'อนุมัติแล้ว รอดำเนินการย้าย', REJECTED: 'ไม่อนุมัติ', APPLIED: 'ย้ายห้องแล้ว',
};
export const TRANSFER_REASON_MAX = 500;
export const TRANSFER_COMMITTEE_MAX = 300;
export const TRANSFER_NOTE_MAX = 500;

export interface RoomTransfer {
  id: string;
  studentId: string;
  studentName: string;
  fromRoom: string;
  toRoom: string;
  fromHouseId: string | null;
  toHouseId: string | null;
  reason: string;
  status: TransferStatus;
  requestedByName: string;
  decisionCommittee?: string;
  decisionDate?: string;
  decisionNote?: string;
  decidedByName?: string;
  /** วันที่มีผล (yyyy-mm-dd) — มีเมื่อ APPLIED */
  effectiveDate?: string;
}

const isoDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

export function validateTransferRequest(i: { studentId: string; fromRoom: string; toRoom: string; reason: string }): string | null {
  if (!i.studentId) return 'เลือกนักเรียน';
  if (!i.toRoom.trim()) return 'ระบุห้องปลายทาง';
  if (i.toRoom.trim() === (i.fromRoom || '').trim()) return 'ห้องปลายทางต้องต่างจากห้องเดิม';
  if (!i.reason.trim()) return 'ระบุเหตุผลการย้าย';
  if (i.reason.length > TRANSFER_REASON_MAX) return `เหตุผลยาวเกิน ${TRANSFER_REASON_MAX} ตัวอักษร`;
  return null;
}

export function validateTransferDecision(i: { decision: string; committee: string; date: string; note: string }): string | null {
  if (i.decision !== 'APPROVED' && i.decision !== 'REJECTED') return 'เลือกผลการพิจารณา';
  if (!i.committee.trim()) return 'ระบุคณะกรรมการ/เลขที่คำสั่ง/มติที่ประชุม';
  if (i.committee.length > TRANSFER_COMMITTEE_MAX) return `ข้อมูลคณะกรรมการยาวเกิน ${TRANSFER_COMMITTEE_MAX} ตัวอักษร`;
  if (!isoDate(i.date)) return 'เลือกวันที่ประชุม';
  if (i.note.length > TRANSFER_NOTE_MAX) return `หมายเหตุยาวเกิน ${TRANSFER_NOTE_MAX} ตัวอักษร`;
  return null;
}

export function validateTransferApply(effectiveDate: string): string | null {
  return isoDate(effectiveDate) ? null : 'เลือกวันที่มีผล';
}

/**
 * คณะสีของนักเรียน ณ วันที่ date (yyyy-mm-dd): ดูเฉพาะการย้ายที่ APPLIED เรียงตามวันที่มีผล
 * วันที่ก่อนการย้ายครั้งแรกที่มีผลหลังวันนั้น → คณะสีเดิมของการย้ายครั้งนั้น; ไม่มีการย้ายหลังวันนั้น → คณะสีปัจจุบัน
 * (วันที่มีผล = ผลงานตั้งแต่วันนั้นเป็นต้นไปนับให้คณะสีใหม่)
 */
export function houseOn(currentHouseId: string | null | undefined, transfers: readonly Pick<RoomTransfer, 'status' | 'effectiveDate' | 'fromHouseId'>[], date: string): string | null {
  const applied = transfers.filter(t => t.status === 'APPLIED' && t.effectiveDate).sort((a, b) => a.effectiveDate!.localeCompare(b.effectiveDate!));
  const next = applied.find(t => t.effectiveDate! > date);
  return next ? next.fromHouseId : (currentHouseId ?? null);
}
