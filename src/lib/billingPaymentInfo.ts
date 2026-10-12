/**
 * ข้อมูลบัญชี/พร้อมเพย์ของโรงเรียนที่ใช้รับโอนเงิน — Firestore school_settings/billing_payment
 * ผู้ดูแลระบบ (SUPER_ADMIN) ตั้งค่า, ทุกคนที่ล็อกอินอ่านได้ (ผู้ปกครองต้องใช้โอนเงิน) — ห้ามเก็บข้อมูลลับในเอกสารนี้
 * ผู้ปกครองสร้าง QR จากข้อมูลนี้ (src/lib/promptPay.ts) ถ้าไม่มี promptPayId = แสดงเฉพาะเลขบัญชี ไม่มี QR
 */
import { PromptPayType, digitsOnly, validatePromptPayId } from './promptPay';

export type BillingPromptPayType = PromptPayType | 'NONE';

export interface BillingPaymentInfo {
  promptPayType: BillingPromptPayType; // NONE = ไม่ใช้พร้อมเพย์ (แสดงเลขบัญชีอย่างเดียว)
  promptPayId: string;                  // ตัวเลขล้วน ('' เมื่อ NONE)
  accountName: string;                  // ชื่อบัญชี (ผู้ปกครองใช้ตรวจชื่อผู้รับในแอปธนาคารก่อนโอน)
  bankName: string;
  bankAccountNo: string;                // ตัวเลข/ขีด
  note: string;                         // คำแนะนำเพิ่มเติม (ไม่บังคับ)
}

export const EMPTY_BILLING_PAYMENT_INFO: BillingPaymentInfo = {
  promptPayType: 'NONE', promptPayId: '', accountName: '', bankName: '', bankAccountNo: '', note: '',
};

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** อ่านค่าจาก Firestore แบบปลอดภัย — ผิดรูปแบบ = ค่าว่าง (ไม่ throw ไม่เดา) */
export function sanitizeBillingPaymentInfo(raw: unknown): BillingPaymentInfo {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const type = d.promptPayType === 'PHONE' || d.promptPayType === 'NATIONAL_ID' || d.promptPayType === 'EWALLET' ? d.promptPayType : 'NONE';
  const id = type === 'NONE' ? '' : digitsOnly(str(d.promptPayId, 20));
  const valid = type !== 'NONE' && validatePromptPayId(type, id) === null;
  return {
    promptPayType: valid ? type : 'NONE',
    promptPayId: valid ? id : '',
    accountName: str(d.accountName, 100),
    bankName: str(d.bankName, 100),
    bankAccountNo: str(d.bankAccountNo, 30),
    note: str(d.note, 300),
  };
}

export type BillingPaymentInfoErrors = Partial<Record<keyof BillingPaymentInfo, string>>;

export function validateBillingPaymentInfo(v: BillingPaymentInfo):
  { ok: true; value: BillingPaymentInfo } | { ok: false; errors: BillingPaymentInfoErrors } {
  const errors: BillingPaymentInfoErrors = {};
  const value: BillingPaymentInfo = {
    promptPayType: v.promptPayType,
    promptPayId: v.promptPayType === 'NONE' ? '' : digitsOnly(v.promptPayId),
    accountName: v.accountName.trim(),
    bankName: v.bankName.trim(),
    bankAccountNo: v.bankAccountNo.trim(),
    note: v.note.trim(),
  };
  if (value.promptPayType !== 'NONE') {
    const e = validatePromptPayId(value.promptPayType, value.promptPayId);
    if (e) errors.promptPayId = e;
  }
  if (!value.accountName) errors.accountName = 'กรุณาระบุชื่อบัญชี/ชื่อผู้รับเงิน';
  if (value.accountName.length > 100) errors.accountName = 'ยาวเกิน 100 ตัวอักษร';
  if (value.bankName.length > 100) errors.bankName = 'ยาวเกิน 100 ตัวอักษร';
  if (value.bankAccountNo && !/^[0-9\- ]{4,30}$/.test(value.bankAccountNo)) errors.bankAccountNo = 'เลขบัญชีต้องเป็นตัวเลข (ขีดคั่นได้) 4-30 ตัวอักษร';
  if (!value.bankAccountNo && value.promptPayType === 'NONE') errors.bankAccountNo = 'กรุณาระบุเลขบัญชี หรือเลือกใช้พร้อมเพย์';
  if (value.note.length > 300) errors.note = 'ยาวเกิน 300 ตัวอักษร';
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value };
}

/** ตั้งค่าครบพอให้ผู้ปกครองรู้ว่าจะโอนเข้าที่ไหนหรือไม่ */
export const hasPaymentChannel = (i: BillingPaymentInfo) => i.promptPayType !== 'NONE' || !!i.bankAccountNo;
