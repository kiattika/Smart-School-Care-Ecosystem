import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { readSource } from './helpers/readSource';

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
  const src = readSource(path.resolve(__dirname, '../ExecutivePortal.tsx'));
  const firestoreServiceSrc = readSource(path.resolve(__dirname, '../services/firestoreService.ts'));

  it('firestoreService มี subscribe school-wide สำหรับ 2Q/SDQ (ต่างจากฟังก์ชันเดิมที่ต้อง scope studentUid/respondentUid)', () => {
    expect(firestoreServiceSrc).toContain('export function subscribeAll2QScreenings(');
    // PHQ-9 สากลเลิกใช้แล้ว (แทนด้วย 9Q ไทยซึ่ง EXECUTIVE ไม่มีสิทธิ์อ่าน) — ต้องไม่มี subscribe PHQ-9 เหลือ
    expect(firestoreServiceSrc).not.toContain('subscribeAllPHQ9Screenings');
    expect(firestoreServiceSrc).toContain('export function subscribeAllSDQAssessments(');
  });

  it('ExecutivePortal: Health tab subscribe ข้อมูลจริง 3 แหล่ง (2Q/SDQ/ห้องพยาบาล) — ไม่อ่าน 9Q/8Q', () => {
    expect(src).toContain('subscribeAll2QScreenings(setScreenings2Q)');
    expect(src).not.toContain('PHQ9');
    expect(src).not.toMatch(/student_screenings_(9q|8q)/);
    expect(src).toContain('subscribeAllSDQAssessments(setSdqAssessments)');
    expect(src).toContain('subscribeInfirmaryVisits(setInfirmaryVisits)');
  });

  it('healthSummary คำนวณจากข้อมูลจริง (isPositive/riskLevel/triagingStatus/visitDate) ไม่ fabricate ตัวเลข', () => {
    expect(src).toContain('screenings2Q.filter(s => s.isPositive).length');
    // ไม่มีสรุป PHQ-9/9Q/8Q ในหน้าผู้บริหารอีก (ข้อมูลอ่อนไหว — rules ไม่ให้ EXECUTIVE อ่าน)
    expect(src).not.toMatch(/phq9|Phq9/);
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
