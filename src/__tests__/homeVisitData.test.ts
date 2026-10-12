import { describe, it, expect } from 'vitest';
import {
  ageFromBirthDate, bodyShapeFromBmi, distanceBracketFromMeters, prefillFromSelfAssessment, validateStudentInfo, validateFamilyInfo,
  emptyStudentInfo, emptyFamilyInfo, DISTANCE_BRACKETS, COMMUTE_DURATIONS, HOUSING_STATUS,
} from '../lib/homeVisitData';
import { summarizeHomeVisit } from '../lib/homeVisitAnalytics';

describe('คำนวณจากระบบ', () => {
  it('อายุ ปี/เดือน', () => {
    expect(ageFromBirthDate('2010-03-15', '2026-10-12')).toEqual({ years: 16, months: 6 });
    expect(ageFromBirthDate('2010-10-13', '2026-10-12')).toEqual({ years: 15, months: 11 });
    expect(ageFromBirthDate('2030-01-01', '2026-10-12')).toBeNull();
  });
  it('BMI → รูปร่าง; ข้อมูลไม่ครบ = null', () => {
    expect(bodyShapeFromBmi(60, 170)).toEqual({ bmi: 20.8, label: 'สมส่วน' });
    expect(bodyShapeFromBmi(null, 170)).toBeNull();
    expect(bodyShapeFromBmi(90, 160)?.label).toBe('อ้วน');
  });
  it('ระยะทาง → ช่วงตามแบบ สพฐ. ขอบเขตรวมขอบบน', () => {
    expect(distanceBracketFromMeters(5000)).toBe(DISTANCE_BRACKETS[0]);
    expect(distanceBracketFromMeters(5001)).toBe(DISTANCE_BRACKETS[1]);
    expect(distanceBracketFromMeters(41000)).toBe(DISTANCE_BRACKETS[5]);
    expect(distanceBracketFromMeters(null)).toBe('');
  });
});

describe('prefillFromSelfAssessment', () => {
  const a = (fb: any): any => ({ isCompleted: true, familyBackground: fb });
  it('ไม่มี/ยังไม่เสร็จ → ไม่เติมอะไร', () => {
    expect(prefillFromSelfAssessment(null)).toEqual({ hints: {} });
    expect(prefillFromSelfAssessment({ isCompleted: false, familyBackground: {} } as any)).toEqual({ hints: {} });
  });
  it('เติมเฉพาะค่าที่แมปได้ชัดเจน ค่ากำกวมเป็น hint', () => {
    const r = prefillFromSelfAssessment(a({ livingWith: 'บิดาและมารดา', transportation: 'รถจักรยานยนต์', travelTime: '15-30 นาที', consultPerson: 'ผู้ปกครอง' }));
    expect(r.livesWith).toBe('บิดาและมารดา');
    expect(r.commuteMode).toBe('จักรยานยนต์ส่วนตัว');
    expect(r.commuteDuration).toBe(COMMUTE_DURATIONS[0]);
    const amb = prefillFromSelfAssessment(a({ livingWith: 'บิดา หรือ มารดา (ฝ่ายใดฝ่ายหนึ่ง)', transportation: 'เดิน/ขี่จักรยาน', travelTime: '31-60 นาที' }));
    expect(amb.livesWith).toBeUndefined();
    expect(amb.hints.livesWith).toBe('บิดา หรือ มารดา (ฝ่ายใดฝ่ายหนึ่ง)');
    expect(amb.commuteDuration).toBeUndefined();
    expect(amb.hints.commuteDuration).toBe('31-60 นาที');
  });
});

describe('validate', () => {
  const base = { studentId: '1', studentUid: 'u', homeroomClass: 'ม.5/8' };
  it('นักเรียน: ว่างไม่ผ่าน ครบผ่าน', () => {
    const s = emptyStudentInfo(base);
    expect(validateStudentInfo(s).length).toBeGreaterThan(5);
    Object.assign(s, { gender: 'M', birthDate: '2010-01-01', nationality: 'ไทย', ethnicity: 'ไทย', religion: 'พุทธ', prevEducationLevel: 'มัธยมศึกษาตอนต้น', prevSchool: 'ร.ร.ก', closestInFamily: ['มารดา'], consultWho: ['เพื่อน'], livesWith: 'บิดาและมารดา' });
    expect(validateStudentInfo(s)).toEqual([]);
  });
  it('ผู้ปกครอง: ค่าเช่าต้องระบุเมื่อบ้านเช่า, เบอร์ผิดไม่ผ่าน', () => {
    const f = emptyFamilyInfo({ ...base, parentUid: 'p' }, '0812345678');
    expect(f.guardian.phone).toBe('0812345678');
    expect(validateFamilyInfo(f).length).toBeGreaterThan(5);
    Object.assign(f, {
      father: { ...f.father, presence: 'DECEASED' }, mother: { ...f.mother, presence: 'DECEASED' }, parentsStatus: 'บิดา-มารดาเสียชีวิต/สาบสูญ',
      guardian: { ...f.guardian, relation: 'ยาย', firstName: 'ก', lastName: 'ข', age: 60, occupation: '-', health: 'ปกติ' },
      housingStatus: HOUSING_STATUS[1], dependents: ['มีผู้สูงอายุ (มากกว่า 60 ปี)'], safetyLevel: 'GOOD', electricity: ['ไฟบ้านหรือมิเตอร์'], drinkingWater: ['น้ำประปา'], disasterRisks: ['ไม่มีความเสี่ยง'],
    });
    expect(validateFamilyInfo(f)).toContain('ระบุค่าเช่าต่อเดือน');
    f.rentPerMonth = 2000;
    expect(validateFamilyInfo(f)).toEqual([]);
    f.guardian.phone = '123';
    expect(validateFamilyInfo(f)).toContain('เบอร์โทรผู้ปกครองไม่ถูกต้อง');
  });
});

describe('summarizeHomeVisit (จำนวนล้วน ไม่มีชื่อ)', () => {
  const rec = (o: any): any => ({ visitYear: '2569', disadvantage: ['ไม่ด้อยโอกาส'], disability: ['ไม่พิการ'], riskLevel: 'LOW', urgentReferral: false, travelEnvironment: 'SAFE', distanceBracket: '0-5 กิโลเมตร', ...o });
  it('นับถูก และกรองเฉพาะปีการศึกษาปัจจุบัน', () => {
    const s = summarizeHomeVisit({
      totalStudents: 10, todayYmd: '2026-10-12',
      records: [rec({ disadvantage: ['เด็กยากจน'], riskLevel: 'HIGH', urgentReferral: true }), rec({}), rec({ visitYear: '2568', riskLevel: 'HIGH' })],
      studentInfo: [{ commuteMode: 'เดิน/ขี่จักรยาน', weightKg: 60, heightCm: 170 } as any],
      familyInfo: [{ safetyLevel: 'RISK', housingStatus: HOUSING_STATUS[1], dependents: [], electricity: [], drinkingWater: [], disasterRisks: [], guardian: { incomeBracket: 'ไม่มีรายได้' } } as any],
    });
    expect(s.visited).toBe(2); expect(s.riskHigh).toBe(1); expect(s.urgentReferral).toBe(1);
    expect(s.disadvantaged).toBe(1); expect(s.unsafeHousing).toBe(1);
    expect(s.disadvantageTypes.find(d => d.label === 'เด็กยากจน')?.count).toBe(1);
    expect(s.guardianIncome.find(d => d.label === 'ไม่มีรายได้')?.count).toBe(1);
    expect(s.bodyShape).toEqual([{ label: 'สมส่วน', count: 1 }]);
    expect(JSON.stringify(s)).not.toMatch(/studentId|name/i);
  });
});
