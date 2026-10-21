import { PARENT_RELATIONSHIPS } from './parentRelationship';
import { isValidThaiNationalId, normalizeNationalId } from './nationalId';

/**
 * ตรรกะหน้า "จัดการผู้ปกครอง" ของแอดมิน (ตรวจฟอร์ม/สถานะ/ข้อความ) — กติกาตรวจต้องตรงกับ
 * functions/src/parentLineLogic.ts (`validateParentSet`) เพราะเซิร์ฟเวอร์ตรวจซ้ำเสมอ
 */
export const AUDIT_REASON_MAX = 300;

/** เฉพาะข้อมูลที่ปลอดภัยต่อการแสดง — ห้ามมีค่าเข้ารหัสของเลขบัตร (ไม่คัดลอกจากเอกสารมาถึง UI) */
export interface ParentRecordBrief {
  parentPrefix: string;
  parentFirstName: string;
  parentLastName: string;
  parentMobile: string;
  relationship: string;
  linkedParentUid: string | null;
  linkedAtMs: number | null;
}

export type ParentLinkStatus = 'NO_RECORD' | 'NOT_LINKED' | 'LINKED' | 'INCONSISTENT';

/**
 * สถานะการเชื่อมบัญชี LINE — เทียบทั้ง students.parentUid (ที่ rules ใช้จริง) และทะเบียนยืนยัน (linkedParentUid)
 * ฝั่งเดียวมีค่า/สองฝั่งไม่ตรงกัน = INCONSISTENT (ยกเลิกการเชื่อมจะล้างทั้งสองฝั่ง)
 */
export function parentLinkStatus(studentParentUid: string | null | undefined, record: Pick<ParentRecordBrief, 'linkedParentUid'> | null): ParentLinkStatus {
  const s = studentParentUid || null;
  const r = record?.linkedParentUid || null;
  if (s && r && s === r) return 'LINKED';
  if (s || r) return 'INCONSISTENT';
  return record ? 'NOT_LINKED' : 'NO_RECORD';
}

export const LINK_STATUS_LABEL: Record<ParentLinkStatus, string> = {
  NO_RECORD: 'ยังไม่มีทะเบียนผู้ปกครอง',
  NOT_LINKED: 'มีทะเบียน — ยังไม่เชื่อมบัญชี LINE',
  LINKED: 'เชื่อมบัญชี LINE แล้ว',
  INCONSISTENT: 'ข้อมูลการเชื่อมไม่ตรงกัน',
};

/** ปิดเบอร์ทั้งหมดยกเว้น 4 ตัวท้าย (เช่น xxx-xxx-1234); ไม่มีเบอร์ = ข้อความว่าไม่มี (ไม่เดา) */
export function maskPhone(raw: unknown): string {
  const d = String(raw ?? '').replace(/\D/g, '');
  if (d.length < 5) return d ? 'x'.repeat(d.length) : 'ไม่มีเบอร์';
  const tail = d.slice(-4);
  const head = 'x'.repeat(d.length - 4);
  if (d.length === 10) return `${head.slice(0, 3)}-${head.slice(3)}-${tail}`;
  if (d.length === 9) return `${head.slice(0, 2)}-${head.slice(2)}-${tail}`;
  return `${head}-${tail}`;
}

export function parentDisplayName(r: Pick<ParentRecordBrief, 'parentPrefix' | 'parentFirstName' | 'parentLastName'> | null): string {
  if (!r) return '';
  return `${r.parentPrefix || ''}${r.parentFirstName || ''} ${r.parentLastName || ''}`.trim();
}

export interface ParentFormValues {
  parentPrefix: string; parentFirstName: string; parentLastName: string;
  relationship: string; parentMobile: string; parentNationalId: string; reason: string;
}

export const EMPTY_PARENT_FORM: ParentFormValues = {
  parentPrefix: '', parentFirstName: '', parentLastName: '', relationship: '', parentMobile: '', parentNationalId: '', reason: '',
};

export type ParentFormErrors = Partial<Record<keyof ParentFormValues, string>>;

export function validateParentForm(v: ParentFormValues): ParentFormErrors {
  const e: ParentFormErrors = {};
  if (!v.parentFirstName.trim()) e.parentFirstName = 'กรุณากรอกชื่อ';
  else if (v.parentFirstName.trim().length > 80) e.parentFirstName = 'ชื่อยาวเกินไป';
  if (!v.parentLastName.trim()) e.parentLastName = 'กรุณากรอกนามสกุล';
  else if (v.parentLastName.trim().length > 80) e.parentLastName = 'นามสกุลยาวเกินไป';
  if (v.parentPrefix.trim().length > 20) e.parentPrefix = 'คำนำหน้ายาวเกินไป';
  if (!(PARENT_RELATIONSHIPS as readonly string[]).includes(v.relationship)) e.relationship = 'กรุณาเลือกความสัมพันธ์';
  if (!/^0\d{8,9}$/.test(v.parentMobile.replace(/[\s-]/g, ''))) e.parentMobile = 'เบอร์โทรต้องเป็นตัวเลข 9-10 หลักขึ้นต้นด้วย 0';
  if (!isValidThaiNationalId(v.parentNationalId)) e.parentNationalId = 'เลขบัตรประชาชน 13 หลักไม่ถูกต้อง';
  if (!v.reason.trim()) e.reason = 'กรุณาระบุเหตุผล';
  else if (v.reason.trim().length > AUDIT_REASON_MAX) e.reason = `ไม่เกิน ${AUDIT_REASON_MAX} ตัวอักษร`;
  return e;
}

/** เติมฟอร์มจากทะเบียนเดิม (ไม่เติมเลขบัตรและเหตุผล — เลขบัตรเก็บเป็น HMAC ย้อนกลับไม่ได้ ต้องกรอกใหม่ทุกครั้ง) */
export function formFromRecord(r: ParentRecordBrief | null): ParentFormValues {
  if (!r) return { ...EMPTY_PARENT_FORM };
  return {
    ...EMPTY_PARENT_FORM,
    parentPrefix: r.parentPrefix, parentFirstName: r.parentFirstName, parentLastName: r.parentLastName,
    relationship: (PARENT_RELATIONSHIPS as readonly string[]).includes(r.relationship) ? r.relationship : '',
    parentMobile: r.parentMobile,
  };
}

export interface ParentAuditEntry {
  id: string; action: 'UNLINK' | 'SET_PARENT'; studentId: string; byEmail: string; reason: string;
  hadLink: boolean; parentChanged: boolean; relationship: string | null; createdAtMs: number | null;
}

export function auditActionLabel(e: Pick<ParentAuditEntry, 'action' | 'hadLink' | 'parentChanged'>): string {
  if (e.action === 'UNLINK') return 'ยกเลิกการเชื่อมบัญชี LINE';
  if (e.parentChanged) return e.hadLink ? 'เปลี่ยนผู้ปกครอง (ยกเลิกการเชื่อมเดิมอัตโนมัติ)' : 'เปลี่ยนผู้ปกครอง';
  return 'บันทึกข้อมูลผู้ปกครอง';
}

/** ข้อความสรุปผลหลังกดบันทึก (จากค่าที่เซิร์ฟเวอร์ตอบ) */
export function setParentResultMessage(res: { parentChanged: boolean; unlinked: boolean }): string {
  if (res.unlinked) return 'เปลี่ยนผู้ปกครองแล้ว และยกเลิกการเชื่อมบัญชี LINE เดิมอัตโนมัติ — ผู้ปกครองคนใหม่ต้องเชื่อมบัญชีเอง';
  if (res.parentChanged) return 'เปลี่ยนผู้ปกครองแล้ว (เดิมยังไม่ได้เชื่อมบัญชี LINE)';
  return 'บันทึกข้อมูลผู้ปกครองแล้ว';
}

export { normalizeNationalId };
