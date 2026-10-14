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

describe('validateHomeVisitForm (ส่วนที่ครูกรอก)', () => {
  const ok = () => {
    const f = emptyHomeVisitForm('2026-10-12', { name: 'ครูก', position: 'ครู คศ.1' });
    f.disadvantage = ['ไม่ด้อยโอกาส']; f.disability = ['ไม่พิการ']; f.exteriorPhotoUrl = 'https://x/y.jpg';
    f.houseType = 'บ้านชั้นเดียว'; f.travelEnvironment = 'SAFE'; f.concerns = '-'; f.summary = 'ครอบครัวดูแลดี';
    f.reviewedFamilyData = true; f.purposeExplained = true;
    return f;
  };
  it('ฟอร์มว่างบันทึกไม่ได้ ครบแล้วผ่าน', () => {
    expect(validateHomeVisitForm(emptyHomeVisitForm('2026-10-12')).length).toBeGreaterThanOrEqual(8);
    expect(validateHomeVisitForm(ok())).toEqual([]);
  });
  it('รูปภายนอกแทนด้วยเหตุผลที่ถ่ายไม่ได้ได้ แต่ต้องมีอย่างใดอย่างหนึ่ง', () => {
    const f = ok(); f.exteriorPhotoUrl = '';
    expect(validateHomeVisitForm(f).length).toBe(1);
    f.photoNote = 'อยู่ต่างจังหวัด ถ่ายคู่ป้ายโรงเรียน';
    expect(validateHomeVisitForm(f)).toEqual([]);
  });
  it('เส้นทางเสี่ยงต้องระบุรายละเอียด; ต้องติ๊กยืนยันตรวจข้อมูล/แจ้งวัตถุประสงค์', () => {
    const f = ok(); f.travelEnvironment = 'RISK';
    expect(validateHomeVisitForm(f)).toContain('ระบุความเสี่ยงระหว่างการเดินทาง');
    const g = ok(); g.reviewedFamilyData = false; g.purposeExplained = false;
    expect(validateHomeVisitForm(g).length).toBe(2);
  });
  it('เบอร์โทรครูผิดรูปแบบถูกปฏิเสธ แต่เว้นว่างได้', () => {
    const f = ok(); f.advisorPhone = '12345';
    expect(validateHomeVisitForm(f)).toContain('เบอร์โทรครูไม่ถูกต้อง');
    f.advisorPhone = '081-234-5678';
    expect(validateHomeVisitForm(f)).toEqual([]);
  });
});

describe('buildHomeVisitRecord / currentYearRecords', () => {
  const form = emptyHomeVisitForm('2026-10-12', { name: 'ครู' });
  it('id = studentId_ปีการศึกษา และเยี่ยมซ้ำรักษา createdAt เดิม', () => {
    const r1 = buildHomeVisitRecord({ form, studentId: '10001', homeroomClass: 'ม.5/8', advisorUid: 'u1', nowIso: '2026-10-12T01:00:00Z' });
    expect(r1.id).toBe(homeVisitRecordId('10001', '2569'));
    const r2 = buildHomeVisitRecord({ form, studentId: '10001', homeroomClass: 'ม.5/8', advisorUid: 'u1', existing: r1, nowIso: '2026-10-20T01:00:00Z' });
    expect(r2.createdAt).toBe('2026-10-12T01:00:00Z');
    expect(r2.updatedAt).toBe('2026-10-20T01:00:00Z');
  });
  it('เอกสารเก่าที่ฟิลด์ไม่ครบ/เป็นสตริง เปิดแก้ได้ (บังคับเป็นอาร์เรย์)', () => {
    const r = buildHomeVisitRecord({ form, studentId: '10001', homeroomClass: 'ม.5/8', advisorUid: 'u1', nowIso: 'x' });
    const old: any = { ...r, disability: 'หูหนวก', disadvantage: undefined, extraPhotoUrls: undefined };
    const f = formFromRecord(old, '2026-10-12');
    expect(f.disability).toEqual(['หูหนวก']);
    expect(f.disadvantage).toEqual([]);
    expect(f.extraPhotoUrls).toEqual([]);
  });
  it('นับเฉพาะปีการศึกษาปัจจุบัน', () => {
    const a: any = { studentId: '1', visitYear: '2569' }, b: any = { studentId: '2', visitYear: '2568' };
    expect([...currentYearRecords([a, b], '2026-10-12').keys()]).toEqual(['1']);
  });
});

describe('guard: การเชื่อมต่อ/ความปลอดภัย', () => {
  it('ไม่มีปุ่มจำลองอัปโหลด/GPS ปลอม และต่อฟอร์ม/เอกสาร/สารสนเทศจริง', () => {
    const adv = readSource('src/AdvisorPortal.tsx');
    expect(adv).not.toMatch(/จำลองอัปโหลด|setTimeout\(\(\) => \{\s*setReportForm|submitHomeVisit/);
    expect(adv).toMatch(/<HomeVisitFormModal/);
    expect(adv).toMatch(/<HomeVisitStudentDetailModal/);
    expect(adv).toMatch(/<HomeVisitDocumentModal/);
    expect(adv).toMatch(/<HomeVisitSummaryPanel/);
  });
  it('นักเรียน/ผู้ปกครองมีฟอร์มของตัวเองในพอร์ทัล', () => {
    expect(readSource('src/StudentPortal.tsx')).toMatch(/<StudentHomeVisitInfoForm/);
    expect(readSource('src/ParentPortal.tsx')).toMatch(/<FamilyHomeVisitInfoForm/);
  });
  it('ไม่เก็บเลขบัตรประชาชนในเอกสารเยี่ยมบ้าน — เก็บแยกที่ student_registry_profiles (สิทธิ์จำกัด)', () => {
    const t = readSource('src/types/homeVisit.ts') + readSource('src/components/homevisit/FamilyHomeVisitInfoForm.tsx');
    expect(t).not.toMatch(/nationalId|idCard|citizenId|เลขบัตรประชาชน\s*\*/i);
    const f = readSource('src/components/homevisit/StudentHomeVisitInfoForm.tsx');
    expect(f).toMatch(/saveRegistryProfile/);
    expect(f).not.toMatch(/saveStudentHomeVisitInfo\(\{[^}]*nationalId/);
    expect(readSource('src/lib/homeVisitData.ts')).not.toMatch(/nationalId/);
  });
  it('เอกสารสรุปไม่ใช้ข้อมูลสมมติ และมีปุ่มพิมพ์จริง', () => {
    const d = readSource('src/components/homevisit/HomeVisitDocumentModal.tsx');
    expect(d).toMatch(/window\.print\(\)/);
    expect(d).not.toMatch(/Math\.random|mock/i);
  });
  it('rules: home_visit_records จำกัดครูที่ปรึกษาห้อง/แอดมิน/ผู้บริหาร(อ่าน) และห้ามลบ', () => {
    const rules = readSource('firestore.rules');
    const blk = rules.match(/match \/home_visit_records\/\{recordId\} \{[\s\S]*?\n {4}\}/)?.[0] || '';
    expect(blk).toMatch(/isHomeroomTeacherOf\(resource\.data\.homeroomClass\)/);
    expect(blk).toMatch(/hasRole\('EXECUTIVE'\)/);
    expect(blk).toMatch(/allow delete: if false/);
    expect(blk).not.toMatch(/allow (read|write|create|update)[^;]*isSignedIn\(\)\s*;/);
  });
  it('rules: home_visit_student_info / family_info ผูกเจ้าของกับ students และห้ามลบ', () => {
    const rules = readSource('firestore.rules');
    for (const [name, field] of [['home_visit_student_info', 'studentUid'], ['home_visit_family_info', 'parentUid']] as const) {
      const blk = rules.match(new RegExp(`match /${name}/\\{studentId\\} \\{[\\s\\S]*?\\n {4}\\}`))?.[0] || '';
      expect(blk, name).toMatch(new RegExp(`request\\.resource\\.data\\.${field} == studentField\\(studentId, '${field}'`));
      expect(blk, name).toMatch(/request\.resource\.data\.homeroomClass == studentField\(studentId, 'room'/);
      expect(blk, name).toMatch(/allow delete: if false/);
      expect(blk, name).not.toMatch(/allow (read|write|create|update)[^;]*isSignedIn\(\)\s*;/);
    }
    // ผู้ปกครองห้ามอ่านเอกสารนักเรียน และนักเรียนห้ามอ่านเอกสารครอบครัว (รายได้/ครัวเรือน)
    const fam = rules.match(/match \/home_visit_family_info\/\{studentId\} \{[\s\S]*?\n {4}\}/)?.[0] || '';
    expect(fam).not.toMatch(/studentUid/);
  });
  it('storage.rules: home_visit_photos เขียนได้เฉพาะเจ้าของ + รูป + <5MB', () => {
    const blk = readSource('storage.rules').match(/match \/home_visit_photos\/\{ownerUid\}\/\{fileName\} \{[\s\S]*?\n {4}\}/)?.[0] || '';
    expect(blk).toMatch(/ownerImageRules\(ownerUid\)/);
    expect(blk).toMatch(/image\/\.\*/);
  });
});
