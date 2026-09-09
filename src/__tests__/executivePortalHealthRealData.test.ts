import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * ExecutivePortal TASK 5 (audit ข้อมูลปลอม, Health tab): เดิม tab นี้ทั้งหมดเป็นข้อมูลปลอม —
 * malnutrition/dentalIssues/visionIssues/mentalStress (% คงที่ ไม่มีฟิลด์จริงในระบบเลย),
 * BMI Distribution chart (height/weight/bmi มาจาก mockStudentParentData.ts เท่านั้น ไม่เคย
 * เขียนลง Firestore จริง — grep ยืนยันแล้ว) และ Commute vs Performance scatter (ไม่มี commute
 * distance จริง เหมือนที่พบใน TASK 4) — เอาออกทั้งหมด แทนที่ด้วยสรุปภาพรวมจากข้อมูลจริงที่มี
 * (คัดกรอง 2Q/PHQ-9, ประเมิน SDQ, บันทึกห้องพยาบาล) นับจำนวน/เปอร์เซ็นต์ระดับโรงเรียนเท่านั้น
 * ไม่โชว์ผลรายบุคคล ผูกกับ firestore.rules ที่เพิ่ม EXECUTIVE อ่านได้แล้ว (commit ก่อนหน้า)
 */
describe('ExecutivePortal TASK 5: Health tab ใช้ข้อมูลสุขภาพจริงแทนข้อมูลปลอม', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../ExecutivePortal.tsx'), 'utf8');
  const firestoreServiceSrc = fs.readFileSync(path.resolve(__dirname, '../services/firestoreService.ts'), 'utf8');

  it('firestoreService มี subscribe school-wide สำหรับ 2Q/PHQ-9/SDQ (ต่างจากฟังก์ชันเดิมที่ต้อง scope studentUid/respondentUid)', () => {
    expect(firestoreServiceSrc).toContain('export function subscribeAll2QScreenings(');
    expect(firestoreServiceSrc).toContain('export function subscribeAllPHQ9Screenings(');
    expect(firestoreServiceSrc).toContain('export function subscribeAllSDQAssessments(');
  });

  it('ExecutivePortal: Health tab subscribe ข้อมูลจริงทั้ง 4 แหล่ง (2Q/PHQ-9/SDQ/ห้องพยาบาล)', () => {
    expect(src).toContain('subscribeAll2QScreenings(setScreenings2Q)');
    expect(src).toContain('subscribeAllPHQ9Screenings(setScreeningsPhq9)');
    expect(src).toContain('subscribeAllSDQAssessments(setSdqAssessments)');
    expect(src).toContain('subscribeInfirmaryVisits(setInfirmaryVisits)');
  });

  it('healthSummary คำนวณจากข้อมูลจริง (isPositive/riskLevel/triagingStatus/visitDate) ไม่ fabricate ตัวเลข', () => {
    expect(src).toContain('screenings2Q.filter(s => s.isPositive).length');
    expect(src).toContain("screeningsPhq9.filter(s => s.riskLevel !== 'NORMAL' && s.riskLevel !== 'MILD').length");
    expect(src).toContain("sdqAssessments.filter(s => s.triagingStatus === 'AT_RISK' || s.triagingStatus === 'VULNERABLE').length");
  });

  it('ไม่ระบุตัวบุคคล: ไม่ map รายชื่อ/studentId ลง JSX ของ Health tab โดยตรง (สรุปจำนวน/เปอร์เซ็นต์เท่านั้น)', () => {
    const healthTabMatch = src.match(/\{activeTab === 'health' && \([\s\S]*?\n {10}\)\}/);
    expect(healthTabMatch).not.toBeNull();
    const healthTabSrc = healthTabMatch![0];
    expect(healthTabSrc).not.toContain('.studentId}');
    expect(healthTabSrc).not.toMatch(/\.name\}/);
  });

  it('regression guard: ไม่เหลือ malnutrition/dentalIssues/visionIssues/BMI Distribution/Commute scatter ปลอม', () => {
    expect(src).not.toContain('healthRisks.malnutrition');
    expect(src).not.toContain('healthRisks.dentalIssues');
    expect(src).not.toContain('healthRisks.visionIssues');
    expect(src).not.toContain('healthRisks.mentalStress');
    expect(src).not.toContain('mockExecutiveData.bmiDistribution');
    expect(src).not.toContain('mockExecutiveData.correlationData');
    expect(src).not.toContain('BMI Distribution');
    expect(src).not.toContain('Commute vs. Performance Analysis');
  });
});
