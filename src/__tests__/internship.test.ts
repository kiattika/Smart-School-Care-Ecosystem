import { describe, it, expect } from 'vitest';
import {
  buildLetter, canIssueLetter, canStaffDecide, canStudentCancel, canStudentEdit, canStudentResubmit, canSubmitNow, registrationPhase,
  thaiDate, thaiRange, validateRequestForm, validateSettingsInput, type InternshipPeriod, type InternshipRequest, type InternshipSettings,
} from '../lib/internship';
import { readSource } from './helpers/readSource';

const P: InternshipPeriod = { id: 'p1', label: 'ปิดภาคเรียนที่ 1', startYmd: '2026-10-01', endYmd: '2026-10-20' };
const okSettings = { periods: [P], purposeText: 'เพื่อเรียนรู้', acceptanceFormText: 'แบบตอบรับ', signerName: 'ผอ.', signerPosition: 'ผู้อำนวยการ', registrationEnabled: true, opensYmd: '', closesYmd: '2026-10-30' };
const okForm = { companyName: 'บริษัท ก', companyAddress: '1 ถ.หลัก', headName: 'นายสมชาย', headPosition: 'กรรมการ', periodId: 'p1' };

describe('validateSettingsInput', () => {
  it('ผ่านเมื่อครบ', () => expect(validateSettingsInput(okSettings)).toEqual([]));
  it('เปิดรับต้องมีวันปิด ช่วงฝึกงาน และข้อความเหตุผล', () => {
    expect(validateSettingsInput({ ...okSettings, closesYmd: '' }).length).toBe(1);
    expect(validateSettingsInput({ ...okSettings, periods: [] }).length).toBe(1);
    expect(validateSettingsInput({ ...okSettings, purposeText: ' ' }).length).toBe(1);
    expect(validateSettingsInput({ ...okSettings, registrationEnabled: false, closesYmd: '', periods: [], purposeText: '' })).toEqual([]);
  });
  it('ช่วงฝึกงาน: วันสิ้นสุดต้องไม่ก่อนวันเริ่ม, id ห้ามซ้ำ, ชื่อห้ามว่าง', () => {
    expect(validateSettingsInput({ ...okSettings, periods: [{ ...P, endYmd: '2026-09-01' }] }).length).toBe(1);
    expect(validateSettingsInput({ ...okSettings, periods: [P, { ...P, label: 'อีกช่วง' }] }).length).toBe(1);
    expect(validateSettingsInput({ ...okSettings, periods: [{ ...P, label: ' ' }] }).length).toBe(1);
  });
});

describe('validateRequestForm', () => {
  it('ผ่านเมื่อครบและเลือกช่วงที่มีอยู่', () => expect(validateRequestForm(okForm, [P])).toEqual([]));
  it('ต้องกรอกครบทุกช่อง และเลือกช่วงที่งานแนะแนวกำหนดเท่านั้น', () => {
    expect(validateRequestForm({ companyName: '', companyAddress: '', headName: '', headPosition: '', periodId: '' }, [P]).length).toBe(5);
    expect(validateRequestForm({ ...okForm, periodId: 'zzz' }, [P]).length).toBe(1);
    expect(validateRequestForm({ ...okForm, companyName: 'ก'.repeat(201) }, [P]).length).toBe(1);
  });
});

describe('ช่วงเวลารับคำร้อง', () => {
  const S = { ...okSettings, registrationOpensAt: null, registrationClosesAt: Date.UTC(2026, 9, 30) } as unknown as InternshipSettings;
  it('เปิด/ปิดตามเวลา และไม่มีช่วงฝึกงานถือว่ายื่นไม่ได้', () => {
    expect(registrationPhase(S, Date.UTC(2026, 9, 10))).toBe('OPEN');
    expect(registrationPhase(S, Date.UTC(2026, 9, 31))).toBe('CLOSED');
    expect(registrationPhase({ ...S, registrationEnabled: false }, Date.UTC(2026, 9, 10))).toBe('CLOSED');
    expect(registrationPhase(null, 0)).toBe('CLOSED');
    expect(canSubmitNow(S, Date.UTC(2026, 9, 10))).toBe(true);
    expect(canSubmitNow({ ...S, periods: [] }, Date.UTC(2026, 9, 10))).toBe(false);
    expect(canSubmitNow(null, 0)).toBe(false);
  });
});

describe('การเปลี่ยนสถานะ (ตรง rules)', () => {
  it('นักเรียน: แก้/ยกเลิกเมื่อรอพิจารณา, ยื่นใหม่เมื่อถูกปฏิเสธหรือยกเลิก', () => {
    expect(canStudentEdit('SUBMITTED') && canStudentCancel('SUBMITTED')).toBe(true);
    expect(canStudentEdit('APPROVED') || canStudentCancel('APPROVED') || canStudentEdit('REJECTED')).toBe(false);
    expect(canStudentResubmit('REJECTED') && canStudentResubmit('CANCELLED')).toBe(true);
    expect(canStudentResubmit('APPROVED') || canStudentResubmit('SUBMITTED')).toBe(false);
  });
  it('งานแนะแนว: SUBMITTED→APPROVED/REJECTED, APPROVED แก้เลขที่ได้ แต่เปลี่ยนเป็น REJECTED ไม่ได้', () => {
    expect(canStaffDecide('SUBMITTED', 'APPROVED') && canStaffDecide('SUBMITTED', 'REJECTED') && canStaffDecide('APPROVED', 'APPROVED')).toBe(true);
    expect(canStaffDecide('APPROVED', 'REJECTED') || canStaffDecide('REJECTED', 'APPROVED') || canStaffDecide('CANCELLED', 'APPROVED')).toBe(false);
    expect(canIssueLetter('APPROVED')).toBe(true);
    expect(canIssueLetter('SUBMITTED')).toBe(false);
  });
});

describe('หนังสือราชการ', () => {
  const r: InternshipRequest = { id: '11111', studentId: '11111', studentName: 'เด็กชายหนึ่ง', room: 'ม.5/1', ...okForm, periodLabel: P.label, startYmd: P.startYmd, endYmd: P.endYmd, status: 'APPROVED' };
  it('แปลงวันที่เป็น พ.ศ.', () => {
    expect(thaiDate('2026-10-15')).toBe('15 ตุลาคม 2569');
    expect(thaiDate('bad')).toBe('');
    expect(thaiRange('2026-10-01', '2026-10-20')).toBe('1 ตุลาคม 2569 ถึงวันที่ 20 ตุลาคม 2569');
  });
  it('สร้างจากข้อมูลคำร้อง; เลขที่/วันที่ที่ยังไม่มีเป็นค่าว่าง (ไม่เติมเอง)', () => {
    const L = buildLetter({ schoolName: 'โรงเรียนอุตรดิตถ์', req: r, settings: { purposeText: 'เพื่อเรียนรู้', acceptanceFormText: 'แบบตอบรับ', signerName: 'ผอ.', signerPosition: 'ผู้อำนวยการ' } });
    expect(L.number).toBe('');
    expect(L.dateText).toBe('');
    expect(L.to).toBe('กรรมการ บริษัท ก');
    expect(L.intro).toContain('เด็กชายหนึ่ง');
    expect(L.intro).toContain('บริษัท ก');
    expect(L.purpose).toBe('เพื่อเรียนรู้');
    expect(L.period).toContain('1 ตุลาคม 2569');
    expect(buildLetter({ schoolName: 'ร', req: { ...r, letterNo: 'ศธ 1', letterDateYmd: '2026-10-15' }, settings: { purposeText: '', acceptanceFormText: '', signerName: '', signerPosition: '' } }).dateText).toBe('15 ตุลาคม 2569');
  });
});

describe('wiring', () => {
  it('rules, service และพอร์ทัลเชื่อมกัน', () => {
    const rules = readSource('firestore.rules');
    expect(rules).toMatch(/match \/internship_settings\/\{sid\}/);
    expect(rules).toMatch(/match \/internship_requests\/\{studentId\}/);
    expect(rules).toMatch(/internshipOpen\(\) && internshipBodyOk\(request\.resource\.data\)/);
    const svc = readSource('src/services/internshipService.ts');
    expect(svc).not.toMatch(/getDoc\(doc\(db, REQUESTS/); // ห้าม getDoc คำร้องที่อาจยังไม่มี (rules อ่านจาก resource.data)
    expect(svc).toMatch(/where\('studentId', '==', studentId\)/);
    expect(readSource('src/components/guidance/GuidancePortal.tsx')).toMatch(/<GuidanceInternshipSection \/>/);
    expect(readSource('src/StudentPortal.tsx')).toMatch(/<StudentInternshipSection student=/);
    expect(readSource('src/ParentPortal.tsx')).toMatch(/<StudentInternshipSection readOnly /);
  });
  it('ไม่ใช้ <input type=date> และไม่ใส่ key บน custom component', () => {
    for (const f of ['GuidanceInternshipSection', 'StudentInternshipSection', 'InternshipLetterModal']) {
      const src = readSource(`src/components/internship/${f}.tsx`);
      expect(src).not.toMatch(/type="date"/);
      expect(src).not.toMatch(/<[A-Z]\w+[^>]*\skey=/);
    }
  });
});
