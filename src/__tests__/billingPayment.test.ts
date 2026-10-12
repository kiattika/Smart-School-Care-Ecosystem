import { describe, it, expect } from 'vitest';
import {
  validateBillingFile, canSubmitSlip, canVerifySlip, canRecordPaymentDirectly, isOutstanding,
  buildSlipSubmissionPatch, buildVerifyPatch, buildRejectPatch, validateRejectReason, extensionForType,
  BILLING_FILE_MAX_BYTES,
} from '../lib/billingPayment';
import { readSource } from './helpers/readSource';

describe('validateBillingFile', () => {
  it('รับรูปภาพ/PDF ไม่เกิน 5MB', () => {
    expect(validateBillingFile({ size: 1000, type: 'image/jpeg' })).toBeNull();
    expect(validateBillingFile({ size: 1000, type: 'image/png' })).toBeNull();
    expect(validateBillingFile({ size: 1000, type: 'application/pdf' })).toBeNull();
  });
  it('ปฏิเสธชนิดไฟล์อื่น ไฟล์ว่าง ไฟล์ใหญ่เกิน และไม่มีไฟล์', () => {
    expect(validateBillingFile({ size: 1000, type: 'text/plain' })).not.toBeNull();
    expect(validateBillingFile({ size: 1000, type: 'image/gif' })).not.toBeNull();
    expect(validateBillingFile({ size: 0, type: 'image/png' })).not.toBeNull();
    expect(validateBillingFile({ size: BILLING_FILE_MAX_BYTES, type: 'image/png' })).not.toBeNull();
    expect(validateBillingFile(null)).not.toBeNull();
  });
});

describe('สถานะที่ทำรายการได้', () => {
  it('แนบสลิปได้เฉพาะ PENDING/OVERDUE', () => {
    expect(canSubmitSlip({ status: 'PENDING' })).toBe(true);
    expect(canSubmitSlip({ status: 'OVERDUE' })).toBe(true);
    expect(canSubmitSlip({ status: 'VERIFYING' })).toBe(false);
    expect(canSubmitSlip({ status: 'PAID' })).toBe(false);
  });
  it('ตรวจสลิปได้เฉพาะ VERIFYING; บันทึกรับเงินเองได้เฉพาะที่ยังค้าง', () => {
    expect(canVerifySlip({ status: 'VERIFYING' })).toBe(true);
    expect(canVerifySlip({ status: 'PENDING' })).toBe(false);
    expect(canRecordPaymentDirectly({ status: 'PENDING' })).toBe(true);
    expect(canRecordPaymentDirectly({ status: 'VERIFYING' })).toBe(false);
    expect(canRecordPaymentDirectly({ status: 'PAID' })).toBe(false);
  });
  it('ยอดค้าง = PENDING/OVERDUE (VERIFYING ไม่นับ)', () => {
    expect(isOutstanding({ status: 'VERIFYING' })).toBe(false);
    expect(isOutstanding({ status: 'OVERDUE' })).toBe(true);
  });
});

describe('patch builders', () => {
  const file = { url: 'https://firebasestorage.googleapis.com/x', storagePath: 'billing_slips/u/inv-1.jpg', name: 'slip.jpg' };
  it('ส่งสลิป → VERIFYING และล้างเหตุผลที่เคยถูกปฏิเสธ ไม่ตั้ง PAID', () => {
    const p = buildSlipSubmissionPatch({ file, uploaderUid: 'u1', note: '  โอนแล้ว  ', nowIso: '2026-10-12T00:00:00.000Z' });
    expect(p.status).toBe('VERIFYING');
    expect(p.slipUploadedByUid).toBe('u1');
    expect(p.slipNote).toBe('โอนแล้ว');
    expect(p.slipRejectedReason).toBeNull();
    expect(p.slipRejectedAt).toBeNull();
    expect(p).not.toHaveProperty('receiptNo');
    expect(p).not.toHaveProperty('paidAt');
  });
  it('ยืนยันรับเงิน → PAID ลงชื่อผู้ตรวจ และเลขที่ใบเสร็จ = เลขใบแจ้งหนี้ (ไม่สุ่ม)', () => {
    const p = buildVerifyPatch({ invoiceNumber: 'INV-2569-0007', verifier: { uid: 'f1', name: 'การเงิน' }, method: 'SLIP_VERIFIED', nowIso: 'T' });
    expect(p.status).toBe('PAID');
    expect(p.receiptNo).toBe('INV-2569-0007');
    expect(p.verifiedBy).toBe('f1');
    expect(p.paymentMethod).toBe('SLIP_VERIFIED');
    expect(p).not.toHaveProperty('receiptFileUrl'); // ไม่แนบใบเสร็จก็ได้
  });
  it('แนบใบเสร็จ → เก็บ url/path/ชื่อไฟล์', () => {
    const p = buildVerifyPatch({ invoiceNumber: 'INV-1', verifier: { uid: 'f1', name: 'x' }, receipt: file, method: 'STAFF_RECORDED', nowIso: 'T' });
    expect(p.receiptFileUrl).toBe(file.url);
    expect(p.receiptStoragePath).toBe(file.storagePath);
    expect(p.receiptFileName).toBe('slip.jpg');
  });
  it('ปฏิเสธสลิป → กลับเป็น PENDING พร้อมเหตุผล และต้องมีเหตุผล', () => {
    expect(validateRejectReason('  ')).not.toBeNull();
    expect(validateRejectReason('ยอดไม่ตรง')).toBeNull();
    const p = buildRejectPatch({ reason: ' ยอดไม่ตรง ', rejecterUid: 'f1', nowIso: 'T' });
    expect(p.status).toBe('PENDING');
    expect(p.slipRejectedReason).toBe('ยอดไม่ตรง');
  });
  it('นามสกุลไฟล์ตามชนิด', () => {
    expect(extensionForType('image/jpeg')).toBe('jpg');
    expect(extensionForType('application/pdf')).toBe('pdf');
    expect(extensionForType('x/y')).toBe('bin');
  });
});

describe('guard: ไม่มีการ "จ่ายเงินปลอม" กลับมา', () => {
  it('ไม่มี payBillingInvoice (ทั้ง store และ service) และไม่สุ่มเลขใบเสร็จ', () => {
    for (const f of ['src/store.ts', 'src/types.ts', 'src/services/firestoreService.ts', 'src/components/finance/FinancePortal.tsx', 'src/components/student-parent/ParentEngagementServices.tsx']) {
      const src = readSource(f);
      expect(src, f).not.toMatch(/function\s+payBillingInvoice|payBillingInvoice(Firestore)?\s*[,:(]|\{\s*payBillingInvoice/);
      expect(src, f).not.toMatch(/REC-2569-/);
    }
  });
  it('หน้าผู้ปกครองไม่ตั้ง PAID เอง ไม่จำลองอัปโหลดสลิป ไม่มี alert ดาวน์โหลดปลอม', () => {
    const src = readSource('src/components/student-parent/ParentEngagementServices.tsx');
    expect(src).not.toContain('จำลองการอัปโหลดสลิป');
    expect(src).not.toContain("alert(`ดาวน์โหลดใบเสร็จ");
    expect(src).not.toContain('setSlipUploaded');
    expect(src).toContain('submitPaymentSlip');
    expect(src).not.toMatch(/status:\s*'PAID'/);
  });
  it('rules: ผู้ปกครองตั้ง PAID ไม่ได้ และ PAID ต้องลงชื่อผู้ตรวจ; storage มี path สลิป/ใบเสร็จ', () => {
    const rules = readSource('firestore.rules');
    expect(rules).toContain("request.resource.data.get('verifiedBy', '') == request.auth.uid");
    expect(rules).toContain("request.resource.data.status == 'VERIFYING'");
    expect(rules).toContain("firebasestorage");
    const storage = readSource('storage.rules');
    expect(storage).toContain('match /billing_slips/{ownerUid}/{fileName}');
    expect(storage).toContain('match /billing_receipts/{ownerUid}/{fileName}');
  });
});
