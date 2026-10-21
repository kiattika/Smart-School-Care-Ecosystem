import { describe, it, expect } from 'vitest';
import {
  maskPhone, parentLinkStatus, validateParentForm, formFromRecord, auditActionLabel, setParentResultMessage,
  parentDisplayName, EMPTY_PARENT_FORM, AUDIT_REASON_MAX, type ParentFormValues, type ParentRecordBrief,
} from '../lib/parentAdmin';
import {
  validateParentSet, validateUnlinkReason, buildParentAuditEntry, AUDIT_REASON_MAX as SERVER_REASON_MAX,
} from '../../functions/src/parentLineLogic';
import { readSource } from './helpers/readSource';

const VALID_ID = '1101700230708';
const goodForm: ParentFormValues = {
  parentPrefix: 'นาย', parentFirstName: 'สมชาย', parentLastName: 'ใจดี', relationship: 'บิดา',
  parentMobile: '081-234-5678', parentNationalId: VALID_ID, reason: 'ผู้ปกครองเดิมย้ายออก',
};
const rec = (over: Partial<ParentRecordBrief> = {}): ParentRecordBrief => ({
  parentPrefix: 'นาง', parentFirstName: 'สมหญิง', parentLastName: 'ใจดี', parentMobile: '0812345678', relationship: 'มารดา', linkedParentUid: null, linkedAtMs: null, ...over,
});

describe('สถานะการเชื่อมบัญชี LINE', () => {
  it('เทียบทั้ง students.parentUid และทะเบียน', () => {
    expect(parentLinkStatus(null, null)).toBe('NO_RECORD');
    expect(parentLinkStatus(null, rec())).toBe('NOT_LINKED');
    expect(parentLinkStatus('line_a', rec({ linkedParentUid: 'line_a' }))).toBe('LINKED');
  });
  it('ฝั่งเดียวมีค่า/ไม่ตรงกัน = INCONSISTENT (ไม่เหมาว่าเชื่อมแล้ว)', () => {
    expect(parentLinkStatus('line_a', null)).toBe('INCONSISTENT');
    expect(parentLinkStatus('line_a', rec())).toBe('INCONSISTENT');
    expect(parentLinkStatus(null, rec({ linkedParentUid: 'line_a' }))).toBe('INCONSISTENT');
    expect(parentLinkStatus('line_a', rec({ linkedParentUid: 'line_b' }))).toBe('INCONSISTENT');
  });
});

describe('แสดงข้อมูลผู้ปกครอง', () => {
  it('ปิดเบอร์ทั้งหมดยกเว้น 4 ตัวท้าย', () => {
    expect(maskPhone('081-234-5678')).toBe('xxx-xxx-5678');
    expect(maskPhone('0812345678')).toBe('xxx-xxx-5678');
    expect(maskPhone('025551234')).toBe('xx-xxx-1234');
    expect(maskPhone('')).toBe('ไม่มีเบอร์');
    expect(maskPhone(undefined)).toBe('ไม่มีเบอร์');
    expect(maskPhone('0812345678')).not.toContain('0812');
  });
  it('ชื่อผู้ปกครอง', () => {
    expect(parentDisplayName(rec())).toBe('นางสมหญิง ใจดี');
    expect(parentDisplayName(null)).toBe('');
  });
});

describe('ตรวจฟอร์มตั้งผู้ปกครอง (ฝั่ง client)', () => {
  it('ฟอร์มถูกต้อง = ไม่มี error', () => {
    expect(validateParentForm(goodForm)).toEqual({});
  });
  it('ขาด/ผิดทีละช่อง', () => {
    expect(validateParentForm({ ...goodForm, parentFirstName: ' ' }).parentFirstName).toBeTruthy();
    expect(validateParentForm({ ...goodForm, parentLastName: '' }).parentLastName).toBeTruthy();
    expect(validateParentForm({ ...goodForm, relationship: 'ลุง' }).relationship).toBeTruthy();
    expect(validateParentForm({ ...goodForm, parentMobile: '12345' }).parentMobile).toBeTruthy();
    expect(validateParentForm({ ...goodForm, parentNationalId: '1101700230709' }).parentNationalId).toBeTruthy();
    expect(validateParentForm({ ...goodForm, reason: '  ' }).reason).toBeTruthy();
    expect(validateParentForm({ ...goodForm, reason: 'ก'.repeat(AUDIT_REASON_MAX + 1) }).reason).toBeTruthy();
  });
  it('เติมฟอร์มจากทะเบียนเดิม แต่ไม่เติมเลขบัตร/เหตุผล (เลขบัตรย้อนกลับจาก HMAC ไม่ได้)', () => {
    const f = formFromRecord(rec());
    expect(f).toMatchObject({ parentFirstName: 'สมหญิง', relationship: 'มารดา', parentMobile: '0812345678' });
    expect(f.parentNationalId).toBe('');
    expect(f.reason).toBe('');
    expect(formFromRecord(null)).toEqual(EMPTY_PARENT_FORM);
    expect(formFromRecord(rec({ relationship: 'ไม่รู้จัก' })).relationship).toBe('');
  });
});

describe('ฝั่งเซิร์ฟเวอร์ตรวจเข้มเท่ากับฝั่ง client', () => {
  it('ข้อมูลถูกต้องผ่าน และ normalize เลขบัตร/เบอร์', () => {
    const v = validateParentSet({ ...goodForm, studentId: ' 38501 ', parentNationalId: '1-1017-00230-70-8' });
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.value.studentId).toBe('38501');
      expect(v.value.parentNationalId).toBe(VALID_ID);
      expect(v.value.parentMobile).toBe('0812345678');
    }
  });
  it('เคสผิดทุกแบบที่ client ปฏิเสธ เซิร์ฟเวอร์ก็ปฏิเสธ (และกลับกัน)', () => {
    const variants: Partial<ParentFormValues>[] = [
      {}, { parentFirstName: '' }, { parentLastName: ' ' }, { relationship: 'ลุง' }, { relationship: '' }, { parentMobile: '12345' },
      { parentMobile: '' }, { parentNationalId: '1101700230709' }, { parentNationalId: '' }, { reason: '' }, { reason: 'ก'.repeat(301) },
      { parentPrefix: 'ก'.repeat(21) }, { parentFirstName: 'ก'.repeat(81) },
    ];
    for (const v of variants) {
      const f = { ...goodForm, ...v };
      const clientOk = Object.keys(validateParentForm(f)).length === 0;
      const serverOk = validateParentSet({ ...f, studentId: '38501' }).ok;
      expect(serverOk, JSON.stringify(v)).toBe(clientOk);
    }
  });
  it('รหัสนักเรียนว่าง/มี / ปฏิเสธ', () => {
    expect(validateParentSet({ ...goodForm, studentId: '' }).ok).toBe(false);
    expect(validateParentSet({ ...goodForm, studentId: '1/2' }).ok).toBe(false);
    expect(validateParentSet(null).ok).toBe(false);
  });
  it('เหตุผลยกเลิกการเชื่อมบังคับกรอก และเพดานตรงกับฝั่ง client', () => {
    expect(validateUnlinkReason('').ok).toBe(false);
    expect(validateUnlinkReason('   ').ok).toBe(false);
    expect(validateUnlinkReason(undefined).ok).toBe(false);
    expect(validateUnlinkReason('ลงผิดคน')).toEqual({ ok: true, reason: 'ลงผิดคน' });
    expect(validateUnlinkReason('ก'.repeat(SERVER_REASON_MAX + 1)).ok).toBe(false);
    expect(SERVER_REASON_MAX).toBe(AUDIT_REASON_MAX);
  });
});

describe('ประวัติการแก้ไข (audit) ไม่มีข้อมูลอ่อนไหว', () => {
  it('รายการมีเฉพาะ ใคร/อะไร/นักเรียนคนไหน/เพราะอะไร', () => {
    const e = buildParentAuditEntry({ action: 'SET_PARENT', studentId: '38501', byUid: 'u1', byEmail: 'a@utd.ac.th', reason: 'ย้ายออก', hadLink: true, parentChanged: true, relationship: 'บิดา' });
    expect(Object.keys(e).sort()).toEqual(['action', 'byEmail', 'byUid', 'hadLink', 'parentChanged', 'reason', 'relationship', 'studentId']);
    expect(JSON.stringify(e)).not.toMatch(/Hmac|NationalId|Mobile|FirstName|LastName/i);
  });
  it('ข้อความประวัติ/ผลลัพธ์', () => {
    expect(auditActionLabel({ action: 'UNLINK', hadLink: true, parentChanged: false })).toBe('ยกเลิกการเชื่อมบัญชี LINE');
    expect(auditActionLabel({ action: 'SET_PARENT', hadLink: true, parentChanged: true })).toContain('ยกเลิกการเชื่อมเดิมอัตโนมัติ');
    expect(auditActionLabel({ action: 'SET_PARENT', hadLink: false, parentChanged: true })).toBe('เปลี่ยนผู้ปกครอง');
    expect(auditActionLabel({ action: 'SET_PARENT', hadLink: false, parentChanged: false })).toBe('บันทึกข้อมูลผู้ปกครอง');
    expect(setParentResultMessage({ parentChanged: true, unlinked: true })).toContain('ยกเลิกการเชื่อมบัญชี LINE เดิม');
    expect(setParentResultMessage({ parentChanged: true, unlinked: false })).toContain('เปลี่ยนผู้ปกครองแล้ว');
    expect(setParentResultMessage({ parentChanged: false, unlinked: false })).toBe('บันทึกข้อมูลผู้ปกครองแล้ว');
  });
});

describe('guard: ต่อสายถูกต้อง', () => {
  const fn = readSource('functions/src/parentLine.ts');
  it('ประวัติเขียนใน batch เดียวกับการเปลี่ยนแปลง (queueAudit) ทั้งยกเลิกการเชื่อมและตั้งผู้ปกครอง', () => {
    expect(fn).toMatch(/queueAudit\(batch, context, \{ action: 'UNLINK'/);
    expect(fn).toMatch(/queueAudit\(batch, context, \{\s*action: 'SET_PARENT'/);
    expect(fn.indexOf("queueAudit(batch, context, { action: 'UNLINK'")).toBeLessThan(fn.indexOf('await batch.commit();', fn.indexOf('export const unlinkParentLine')));
  });
  it('callable เป็น v1 + เฉพาะ SUPER_ADMIN + ไม่ log/ไม่เก็บเลขบัตร', () => {
    const set = fn.slice(fn.indexOf('export const setStudentParent'));
    expect(set).toContain('requireSuperAdmin(context)');
    expect(set).not.toMatch(/logger\.|console\./);
    expect(fn).not.toMatch(/https\.onCall.*\n.*region/);
    expect(readSource('functions/src/index.ts')).toContain('setStudentParent');
    expect(readSource('functions/package.json')).toContain('functions:setStudentParent');
  });
  it('เปลี่ยนผู้ปกครอง = ยกเลิกการเชื่อมเดิม ใช้ตรรกะชุดเดียวกับนำเข้าเป็นกลุ่ม', () => {
    const imp = fn.slice(fn.indexOf('export const importParentVerification'), fn.indexOf('/** ผู้ปกครอง (ล็อกอิน LINE แล้ว)'));
    expect(imp).toContain('queueVerificationUpsert(');
    expect(fn.slice(fn.indexOf('export const setStudentParent'))).toContain('queueVerificationUpsert(');
  });
  it('client ไม่แตะ HMAC และหน้าจอไม่ใช้ window.confirm / modal นำเข้าของตัวเอง', () => {
    for (const f of ['src/components/admin/ParentManagementPage.tsx', 'src/services/parentAdminService.ts', 'src/lib/parentAdmin.ts']) {
      expect(readSource(f), f).not.toMatch(/parentNationalIdHmac/);
    }
    const page = readSource('src/components/admin/ParentManagementPage.tsx');
    expect(page).not.toMatch(/window\.confirm|\bconfirm\(|BulkDataImportModal/);
    expect(page).toContain('<StudentPicker mode="single"');
    expect(page).not.toMatch(/students\[0\]/);
  });
  it('AdminPortal มีเมนูจัดการผู้ปกครอง และส่งไปหน้านำเข้ากลุ่มที่เดียว', () => {
    const a = readSource('src/AdminPortal.tsx');
    expect(a).toContain("id: 'parents'");
    expect(a).toContain("<ParentManagementPage onGoToImport={() => goToImport('PARENT')} />");
  });
});
