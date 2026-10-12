/**
 * ขั้นตอนชำระเงินของใบแจ้งหนี้ (billing_invoices) — ตรรกะบริสุทธิ์ (test ได้)
 *
 *   PENDING/OVERDUE ──ผู้ปกครอง/นักเรียนแนบสลิป──▶ VERIFYING (รอตรวจสอบ)
 *   VERIFYING ──เจ้าหน้าที่การเงินตรวจยอด+สลิป (แนบใบเสร็จได้ ไม่บังคับ)──▶ PAID
 *   VERIFYING ──เจ้าหน้าที่การเงินปฏิเสธ (ต้องระบุเหตุผล)──▶ PENDING (+ slipRejectedReason)
 *   PENDING/OVERDUE ──เจ้าหน้าที่การเงินบันทึกรับเงินเอง (เงินสด/นอกระบบ)──▶ PAID
 *
 * ห้ามฝั่งผู้ปกครอง/นักเรียนตั้งสถานะ PAID เอง — firestore.rules บังคับซ้ำที่เซิร์ฟเวอร์
 * เลขที่ใบเสร็จ = invoiceNumber เดิมเสมอ (ไม่สุ่มเลขใหม่)
 */
import type { BillingInvoice } from '../types';

export const BILLING_FILE_MAX_BYTES = 5 * 1024 * 1024;
export const BILLING_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;

export type InvoiceStatus = BillingInvoice['status'];

/** คืนข้อความ error ถ้าไฟล์ใช้ไม่ได้ ไม่มีปัญหา = null */
export function validateBillingFile(file: { size: number; type: string } | null | undefined): string | null {
  if (!file) return 'กรุณาเลือกไฟล์';
  if (!(BILLING_ALLOWED_TYPES as readonly string[]).includes(file.type)) {
    return 'รองรับเฉพาะไฟล์รูปภาพ (JPG/PNG/WebP) หรือ PDF';
  }
  if (file.size <= 0) return 'ไฟล์ว่างเปล่า';
  if (file.size >= BILLING_FILE_MAX_BYTES) return 'ไฟล์ต้องมีขนาดไม่เกิน 5 MB';
  return null;
}

/** ผู้ปกครอง/นักเรียนแนบสลิปได้เมื่อยังค้างชำระ (รวมกรณีถูกปฏิเสธสลิปแล้วกลับมาเป็น PENDING) */
export const canSubmitSlip = (inv: { status: InvoiceStatus }) => inv.status === 'PENDING' || inv.status === 'OVERDUE';
/** เจ้าหน้าที่การเงินตรวจสลิปได้เมื่ออยู่ในสถานะรอตรวจสอบ */
export const canVerifySlip = (inv: { status: InvoiceStatus }) => inv.status === 'VERIFYING';
/** เจ้าหน้าที่การเงินบันทึกรับเงินเอง (ไม่มีสลิป) ได้เมื่อยังค้างชำระ */
export const canRecordPaymentDirectly = canSubmitSlip;

/** ยังต้องชำระอยู่ (นับเป็นยอดค้าง) — VERIFYING ไม่นับ: ผู้ปกครองจ่ายแล้วแต่รอตรวจ */
export const isOutstanding = (inv: { status: InvoiceStatus }) => inv.status === 'PENDING' || inv.status === 'OVERDUE';

export interface UploadedBillingFile { url: string; storagePath: string; name: string }

export function buildSlipSubmissionPatch(input: {
  file: UploadedBillingFile;
  uploaderUid: string;
  note?: string;
  nowIso: string;
}) {
  return {
    status: 'VERIFYING' as const,
    slipUrl: input.file.url,
    slipStoragePath: input.file.storagePath,
    slipFileName: input.file.name,
    slipUploadedAt: input.nowIso,
    slipUploadedByUid: input.uploaderUid,
    slipNote: (input.note || '').trim(),
    // ส่งสลิปใหม่ = ล้างเหตุผลที่เคยถูกปฏิเสธ
    slipRejectedReason: null,
    slipRejectedAt: null,
  };
}

export function buildVerifyPatch(input: {
  invoiceNumber: string;
  verifier: { uid: string; name: string };
  receipt?: UploadedBillingFile | null;
  method: 'SLIP_VERIFIED' | 'STAFF_RECORDED';
  nowIso: string;
}) {
  return {
    status: 'PAID' as const,
    paidAt: input.nowIso,
    paymentMethod: input.method,
    receiptNo: input.invoiceNumber, // เลขเดียวกับใบแจ้งหนี้ตลอดสายเอกสาร
    verifiedBy: input.verifier.uid,
    verifiedByName: input.verifier.name,
    verifiedAt: input.nowIso,
    ...(input.receipt
      ? { receiptFileUrl: input.receipt.url, receiptStoragePath: input.receipt.storagePath, receiptFileName: input.receipt.name }
      : {}),
  };
}

export function validateRejectReason(reason: string): string | null {
  return reason.trim().length >= 3 ? null : 'กรุณาระบุเหตุผลที่ปฏิเสธสลิป (อย่างน้อย 3 ตัวอักษร)';
}

export function buildRejectPatch(input: { reason: string; rejecterUid: string; nowIso: string }) {
  return {
    status: 'PENDING' as const,
    slipRejectedReason: input.reason.trim(),
    slipRejectedAt: input.nowIso,
    slipRejectedBy: input.rejecterUid,
  };
}

/** นามสกุลไฟล์จาก content type (ใช้ตั้งชื่อ object ใน Storage) */
export function extensionForType(type: string): string {
  switch (type) {
    case 'image/jpeg': return 'jpg';
    case 'image/png': return 'png';
    case 'image/webp': return 'webp';
    case 'application/pdf': return 'pdf';
    default: return 'bin';
  }
}
