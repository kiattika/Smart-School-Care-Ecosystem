import { describe, it, expect } from 'vitest';
import { academicYearBE, emptyHomeVisitForm, validateHomeVisitForm, buildHomeVisitRecord, formFromRecord, currentYearRecords, homeVisitRecordId } from '../lib/homeVisitForm';
import { readSource } from './helpers/readSource';

describe('academicYearBE', () => {
  it('พ.ค.–ธ.ค. = ปี พ.ศ. ปัจจุบัน, ม.ค.–เม.ย. = ปีการศึกษาก่อนหน้า', () => {
    expect(academicYearBE('2026-10-12')).toBe('2569');
    expect(academicYearBE('2026-05-01')).toBe('2569');
    expect(academicYearBE('2026-04-30')).toBe('2568');
    expect(academicYearBE('2027-01-15')).toBe('2569');
  });
});

describe('validateHomeVisitForm', () => {
  const ok = () => {
    const f = emptyHomeVisitForm('2026-10-12');
    f.guardian.name = 'สมชาย'; f.housingType = 'บ้านเช่า'; f.commuteMode = 'เดิน'; f.teacherOpinion = 'ครอบครัวดูแลดี';
    return f;
  };
  it('ฟอร์มว่างบันทึกไม่ได้ ครบแล้วผ่าน', () => {
    expect(validateHomeVisitForm(emptyHomeVisitForm('2026-10-12')).length).toBeGreaterThanOrEqual(4);
    expect(validateHomeVisitForm(ok())).toEqual([]);
  });
  it('เบอร์โทรผิดรูปแบบถูกปฏิเสธ (ผู้ปกครอง) แต่เว้นว่างได้', () => {
    const f = ok(); f.guardian.phone = '12345';
    expect(validateHomeVisitForm(f)).toContain('เบอร์โทรผู้ปกครองไม่ถูกต้อง');
    f.guardian.phone = '081-234-5678';
    expect(validateHomeVisitForm(f)).toEqual([]);
  });
});

describe('buildHomeVisitRecord / currentYearRecords', () => {
  const form = (() => { const f = emptyHomeVisitForm('2026-10-12'); f.guardian.name = 'ก'; return f; })();
  it('id = studentId_ปีการศึกษา และเยี่ยมซ้ำรักษา createdAt เดิม', () => {
    const r1 = buildHomeVisitRecord({ form, studentId: '10001', homeroomClass: 'ม.5/8', advisorUid: 'u1', advisorName: 'ครู', nowIso: '2026-10-12T01:00:00Z' });
    expect(r1.id).toBe(homeVisitRecordId('10001', '2569'));
    const r2 = buildHomeVisitRecord({ form, studentId: '10001', homeroomClass: 'ม.5/8', advisorUid: 'u1', advisorName: 'ครู', existing: r1, nowIso: '2026-10-20T01:00:00Z' });
    expect(r2.createdAt).toBe('2026-10-12T01:00:00Z');
    expect(r2.updatedAt).toBe('2026-10-20T01:00:00Z');
  });
  it('เอกสารเก่าที่ฟิลด์ไม่ครบ เปิดแก้ได้ (เติมค่าว่าง)', () => {
    const r = buildHomeVisitRecord({ form, studentId: '10001', homeroomClass: 'ม.5/8', advisorUid: 'u1', advisorName: 'ครู', nowIso: 'x' });
    const partial: any = { ...r, father: { name: 'พ่อ' } };
    expect(formFromRecord(partial, '2026-10-12').father.occupation).toBe('');
  });
  it('นับเฉพาะปีการศึกษาปัจจุบัน', () => {
    const a: any = { studentId: '1', visitYear: '2569' }, b: any = { studentId: '2', visitYear: '2568' };
    expect([...currentYearRecords([a, b], '2026-10-12').keys()]).toEqual(['1']);
  });
});

describe('guard: การเชื่อมต่อ/ความปลอดภัย', () => {
  it('ไม่มีปุ่มจำลองอัปโหลด/GPS ปลอม และไม่ใช้ homeVisits ใน store แล้ว', () => {
    const adv = readSource('src/AdvisorPortal.tsx');
    expect(adv).not.toMatch(/จำลองอัปโหลด|setTimeout\(\(\) => \{\s*setReportForm|submitHomeVisit/);
    expect(adv).toMatch(/<HomeVisitFormModal/);
    expect(adv).toMatch(/<HomeVisitStudentDetailModal/);
  });
  it('rules: home_visit_records จำกัดครูที่ปรึกษาห้อง/แอดมิน/ผู้บริหาร(อ่าน) และห้ามลบ', () => {
    const rules = readSource('firestore.rules');
    const blk = rules.match(/match \/home_visit_records\/\{recordId\} \{[\s\S]*?\n {4}\}/)?.[0] || '';
    expect(blk).toMatch(/isHomeroomTeacherOf\(resource\.data\.homeroomClass\)/);
    expect(blk).toMatch(/hasRole\('EXECUTIVE'\)/);
    expect(blk).toMatch(/allow delete: if false/);
    expect(blk).not.toMatch(/allow (read|write|create|update)[^;]*isSignedIn\(\)\s*;/);
  });
  it('storage.rules: home_visit_photos เขียนได้เฉพาะเจ้าของ + รูป + <5MB', () => {
    const blk = readSource('storage.rules').match(/match \/home_visit_photos\/\{ownerUid\}\/\{fileName\} \{[\s\S]*?\n {4}\}/)?.[0] || '';
    expect(blk).toMatch(/ownerImageRules\(ownerUid\)/);
    expect(blk).toMatch(/image\/\.\*/);
  });
});
