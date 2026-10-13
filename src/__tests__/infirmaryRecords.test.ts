import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { readSource } from './helpers/readSource';
import {
  validateCheckup, validateVaccination, validateDonation, isYmd, latestCheckup, checkupDocId, sortByDateDesc,
} from '../lib/healthRecords';
import {
  countByMonth, topCounts, visitSummary, visitsByRoom, dispenseTotals, latestLogPerStudent, bmiDistribution,
  bloodTypeDistribution, donationSummary, checkupCoverage, vaccineCounts,
} from '../lib/infirmaryStats';
import { infirmaryVisitNotice } from '../lib/studentNotices';

const src = (p: string) => readSource(path.resolve(__dirname, '..', p));

describe('healthRecords validators', () => {
  it('isYmd รับเฉพาะวันที่จริง', () => {
    expect(isYmd('2026-10-14')).toBe(true);
    expect(isYmd('2026-02-30')).toBe(false);
    expect(isYmd('14/10/2569')).toBe(false);
    expect(isYmd('')).toBe(false);
  });
  it('validateCheckup: ต้องมีนักเรียน/ปี 4 หลัก/วันที่/ผล และจำกัดความยาว', () => {
    const ok = { studentId: '10001', academicYear: '2569', examDate: '2026-10-01', visionResult: 'NORMAL' as const, hearingResult: 'NORMAL' as const };
    expect(validateCheckup(ok)).toBeNull();
    expect(validateCheckup({ ...ok, studentId: '' })).toMatch(/นักเรียน/);
    expect(validateCheckup({ ...ok, academicYear: '69' })).toMatch(/ปีการศึกษา/);
    expect(validateCheckup({ ...ok, examDate: '' })).toMatch(/วันที่/);
    expect(validateCheckup({ ...ok, visionLeft: 'x'.repeat(13) })).toMatch(/12/);
    expect(validateCheckup({ ...ok, note: 'x'.repeat(301) })).toMatch(/300/);
    expect(checkupDocId('10001', '2569')).toBe('10001_2569');
  });
  it('validateVaccination / validateDonation', () => {
    expect(validateVaccination({ studentId: '1', vaccine: ' ', doseDate: '2026-01-01' })).toMatch(/ชื่อวัคซีน/);
    expect(validateVaccination({ studentId: '1', vaccine: 'HPV', doseDate: '2026-01-01' })).toBeNull();
    expect(validateDonation({ subjectType: 'STUDENT', donorName: 'ก', donatedAt: '2026-01-01' })).toMatch(/นักเรียน/);
    expect(validateDonation({ subjectType: 'STAFF', staffId: 't1', donorName: 'ครู', donatedAt: '2026-01-01' })).toBeNull();
    expect(validateDonation({ subjectType: 'STAFF', staffId: 't1', donorName: 'ครู', donatedAt: 'x' })).toMatch(/วันที่/);
  });
  it('latestCheckup เลือกปีล่าสุด; ไม่มี = null', () => {
    expect(latestCheckup([])).toBeNull();
    const l = latestCheckup([{ academicYear: '2568', examDate: '2025-06-01' }, { academicYear: '2569', examDate: '2026-05-01' }]);
    expect(l?.academicYear).toBe('2569');
    expect(sortByDateDesc([{ d: '2026-01-01' }, { d: '2026-03-01' }], x => x.d)[0].d).toBe('2026-03-01');
  });
});

describe('infirmaryStats (ข้อมูลจริงเท่านั้น)', () => {
  const now = new Date(2026, 9, 14); // 14 ต.ค. 2026
  it('countByMonth: 6 เดือนล่าสุด เก่า→ใหม่ นับเฉพาะที่อยู่ในช่วง', () => {
    const r = countByMonth(['2026-10-01', '2026-10-13', '2026-08-02', '2025-01-01'], now, 6);
    expect(r).toHaveLength(6);
    expect(r[5].ym).toBe('2026-10');
    expect(r[5].count).toBe(2);
    expect(r.find(x => x.ym === '2026-08')?.count).toBe(1);
    expect(r[0].ym).toBe('2026-05');
  });
  it('ข้อมูลว่าง = ศูนย์/ว่าง ไม่มีตัวเลขสมมติ', () => {
    expect(visitSummary([], now)).toEqual({ total: 0, last30: 0, urgent: 0, uniqueStudents: 0, avgRestMinutes: null });
    expect(topCounts([])).toEqual([]);
    expect(dispenseTotals([])).toEqual([]);
    expect(bmiDistribution([], 100)).toMatchObject({ recorded: 0, missing: 100 });
    expect(bloodTypeDistribution([], 50)).toMatchObject({ recorded: 0, missing: 50 });
    expect(donationSummary([], now).total).toBe(0);
    expect(checkupCoverage([], 10)).toMatchObject({ examined: 0, notExamined: 10 });
    expect(vaccineCounts([])).toEqual([]);
  });
  it('visitSummary/topCounts/visitsByRoom', () => {
    const visits = [
      { studentId: 'a', visitDate: '2026-10-10', symptoms: 'ปวดหัว', restDurationMinutes: 20, isUrgentAlert: false },
      { studentId: 'a', visitDate: '2026-10-11', symptoms: ' ปวดหัว ', restDurationMinutes: 40, isUrgentAlert: true },
      { studentId: 'b', visitDate: '2026-05-01', symptoms: 'ไข้', restDurationMinutes: 0, isUrgentAlert: false },
    ];
    expect(visitSummary(visits, now)).toMatchObject({ total: 3, last30: 2, urgent: 1, uniqueStudents: 2, avgRestMinutes: 30 });
    expect(topCounts(visits.map(v => v.symptoms))[0]).toEqual({ label: 'ปวดหัว', count: 2 });
    expect(visitsByRoom(visits, [{ studentId: 'a', room: 'ม.2/2' }, { studentId: 'b', room: 'ม.3/1' }])[0]).toEqual({ label: 'ม.2/2', count: 2 });
  });
  it('dispenseTotals รวมเฉพาะ DISPENSE', () => {
    const r = dispenseTotals([
      { medicineName: 'พาราเซตามอล', unit: 'เม็ด', delta: -2, type: 'DISPENSE', at: '' },
      { medicineName: 'พาราเซตามอล', unit: 'เม็ด', delta: -3, type: 'DISPENSE', at: '' },
      { medicineName: 'พาราเซตามอล', unit: 'เม็ด', delta: 100, type: 'RESTOCK', at: '' },
    ]);
    expect(r).toEqual([{ label: 'พาราเซตามอล', unit: 'เม็ด', count: 5 }]);
  });
  it('BMI: ใช้ผลล่าสุดต่อคน', () => {
    const logs = [
      { studentId: 'a', academicYear: '2569', term: '1', bmi: 20, bmiCategory: 'NORMAL' as const },
      { studentId: 'a', academicYear: '2569', term: '2', bmi: 26, bmiCategory: 'OVERWEIGHT' as const },
      { studentId: 'b', academicYear: '2569', term: '1', bmi: 17, bmiCategory: 'UNDERWEIGHT' as const },
    ];
    expect(latestLogPerStudent(logs)).toHaveLength(2);
    const d = bmiDistribution(logs, 10);
    expect(d.counts).toEqual({ UNDERWEIGHT: 1, NORMAL: 0, OVERWEIGHT: 1, OBESE: 0 });
    expect(d.missing).toBe(8);
  });
  it('บริจาคโลหิต: นับผู้บริจาคไม่ซ้ำแยกนักเรียน/บุคลากร', () => {
    const mk = (o: any) => ({ id: Math.random().toString(), donorName: 'x', donatedAt: '2026-10-01', recordedByUid: 'u', recordedByName: 'n', ...o });
    const s = donationSummary([
      mk({ subjectType: 'STUDENT', studentId: '1' }), mk({ subjectType: 'STUDENT', studentId: '1' }), mk({ subjectType: 'STAFF', staffId: '1' }),
    ], now);
    expect(s).toMatchObject({ total: 3, students: 2, staff: 1, donors: 2 });
  });
});

describe('แจ้งเตือนผู้ปกครองผ่านแอปงานพยาบาล + ไม่มีข้อมูลปลอม', () => {
  it('ข้อความแจ้งเตือนเคสด่วนเป็น critical', () => {
    const n = infirmaryVisitNotice({ symptoms: 'เป็นลม', visitTime: '10:00 น.', isUrgentAlert: true }, 'สมชาย');
    expect(n.type).toBe('critical');
    expect(n.message).toContain('เป็นลม');
  });
  it('InfirmaryPortal ไม่มีปุ่ม Line/ค่าปลอมเดิม และส่งแจ้งเตือนจริงผ่าน notifyParentOfInfirmaryVisit', () => {
    const portal = src('components/infirmary/InfirmaryPortal.tsx');
    expect(portal).not.toMatch(/Line ผู้ปกครอง/);
    expect(portal).not.toContain('20/20');
    expect(portal).not.toContain('เมืองอุตรดิตถ์');
    expect(portal).not.toMatch(/font-mono mt-0\.5">21\.4/);
    expect(portal).not.toContain('acknowledgeInfirmaryVisit');
    expect(portal).toContain('notifyParentOfInfirmaryVisit');
    expect(portal).toContain('กดส่งผ่านแอปงานพยาบาล');
    expect(portal).not.toMatch(/\|\| students\[0\]/);
  });
  it('notifyParentOfInfirmaryVisit เขียน parent_notifications ก่อนแล้วค่อยบันทึก parentNotifiedAt และไม่มีผู้รับ = throw', () => {
    const svc = src('services/firestoreService.ts');
    const fn = svc.slice(svc.indexOf('export async function notifyParentOfInfirmaryVisit'));
    expect(fn.slice(0, 1800)).toMatch(/NO_RECIPIENT[\s\S]*createParentNotification[\s\S]*parentNotifiedAt/);
  });
  it('พอร์ทัลผู้ปกครองบนมือถือมีเมนูห้องพยาบาล และหน้าสุขภาพแสดงผลตรวจ/วัคซีน/บริจาคโลหิต', () => {
    expect(src('mobile/mobileMenu.ts')).toContain("id: 'infirmary'");
    expect(src('mobile/MobileApp.tsx')).toContain("view === 'infirmary'");
    expect(src('components/student-parent/HealthMentalWellbeingModule.tsx')).toContain('<StudentHealthRecordsCards');
  });
  it('rules: บล็อก 36-38 มีและห้ามลบโดยพยาบาล/ผู้ปกครองเขียนเอง', () => {
    const rules = src('../firestore.rules');
    for (const c of ['student_checkups', 'student_vaccinations', 'blood_donations']) expect(rules).toContain(`match /${c}/`);
    expect(rules).not.toMatch(/match \/blood_donations[\s\S]{0,2500}allow write: if isSignedIn\(\)/);
  });
});
