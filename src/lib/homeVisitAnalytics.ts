import type { HomeVisitRecord, StudentHomeVisitInfo, FamilyHomeVisitInfo } from '../types';
import { academicYearBE } from './homeVisitForm';
import { DISADVANTAGE_OPTIONS, DISABILITY_OPTIONS, HOUSING_STATUS, DEPENDENTS, ELECTRICITY, DRINKING_WATER, DISASTER_RISKS, DISTANCE_BRACKETS, COMMUTE_MODES, COMMUTE_DURATIONS, LIVES_WITH, INCOME_BRACKETS, bodyShapeFromBmi } from './homeVisitData';

/** สารสนเทศเยี่ยมบ้านระดับห้อง/โรงเรียน — เป็นจำนวนล้วน ไม่มีชื่อนักเรียน (ใช้ระดับโรงเรียนกับผู้บริหารได้) */
export interface Dist { label: string; count: number }
export interface HomeVisitSummary {
  totalStudents: number;
  visited: number;              // มีบันทึกเยี่ยมบ้านปีการศึกษานี้
  studentFormDone: number;      // นักเรียนกรอกแล้ว
  familyFormDone: number;       // ผู้ปกครองกรอกแล้ว
  riskHigh: number; riskMedium: number; riskLow: number;
  urgentReferral: number;
  disadvantaged: number;        // มีความด้อยโอกาสอย่างน้อย 1 ประเภท (ไม่นับ "ไม่ด้อยโอกาส")
  disabled: number;
  unsafeHousing: number;
  unsafeTravel: number;
  disadvantageTypes: Dist[]; disabilityTypes: Dist[];
  distance: Dist[]; commuteMode: Dist[]; commuteDuration: Dist[]; livesWith: Dist[];
  housing: Dist[]; dependents: Dist[]; electricity: Dist[]; drinkingWater: Dist[]; disasterRisks: Dist[];
  guardianIncome: Dist[];
  bodyShape: Dist[];
}

const tally = (options: string[], values: string[][]): Dist[] =>
  options.map(label => ({ label, count: values.filter(v => v.includes(label)).length }));

/** ใช้เฉพาะระเบียนของปีการศึกษาที่ระบุ (ข้อมูลนักเรียน/ครอบครัวเป็นเอกสารเดียวต่อคน ไม่แยกปี) */
export function summarizeHomeVisit(args: {
  totalStudents: number; records: HomeVisitRecord[]; studentInfo: StudentHomeVisitInfo[]; familyInfo: FamilyHomeVisitInfo[]; todayYmd: string;
}): HomeVisitSummary {
  const year = academicYearBE(args.todayYmd);
  const recs = args.records.filter(r => r.visitYear === year);
  const si = args.studentInfo, fi = args.familyInfo;
  const real = (arr: string[], none: string) => arr.filter(x => x !== none).length > 0;
  const shapes = si.map(s => bodyShapeFromBmi(s.weightKg, s.heightCm)?.label).filter((x): x is string => !!x);
  const shapeLabels = Array.from(new Set(shapes));
  return {
    totalStudents: args.totalStudents,
    visited: recs.length,
    studentFormDone: si.length,
    familyFormDone: fi.length,
    riskHigh: recs.filter(r => r.riskLevel === 'HIGH').length,
    riskMedium: recs.filter(r => r.riskLevel === 'MEDIUM').length,
    riskLow: recs.filter(r => r.riskLevel === 'LOW').length,
    urgentReferral: recs.filter(r => r.urgentReferral).length,
    disadvantaged: recs.filter(r => real(r.disadvantage, DISADVANTAGE_OPTIONS[0])).length,
    disabled: recs.filter(r => real(r.disability, DISABILITY_OPTIONS[0])).length,
    unsafeHousing: fi.filter(f => f.safetyLevel === 'RISK').length,
    unsafeTravel: recs.filter(r => r.travelEnvironment === 'RISK').length,
    disadvantageTypes: tally(DISADVANTAGE_OPTIONS.slice(1), recs.map(r => r.disadvantage)),
    disabilityTypes: tally(DISABILITY_OPTIONS.slice(1), recs.map(r => r.disability)),
    distance: tally(DISTANCE_BRACKETS, recs.map(r => [r.distanceBracket])),
    commuteMode: tally(COMMUTE_MODES, si.map(s => [s.commuteMode])),
    commuteDuration: tally(COMMUTE_DURATIONS, si.map(s => [s.commuteDuration])),
    livesWith: tally(LIVES_WITH, si.map(s => [s.livesWith])),
    housing: tally(HOUSING_STATUS, fi.map(f => [f.housingStatus])),
    dependents: tally(DEPENDENTS, fi.map(f => f.dependents)),
    electricity: tally(ELECTRICITY, fi.map(f => f.electricity)),
    drinkingWater: tally(DRINKING_WATER, fi.map(f => f.drinkingWater)),
    disasterRisks: tally(DISASTER_RISKS, fi.map(f => f.disasterRisks)),
    guardianIncome: tally(INCOME_BRACKETS, fi.map(f => [f.guardian.incomeBracket])),
    bodyShape: tally(shapeLabels, shapes.map(s => [s])),
  };
}
