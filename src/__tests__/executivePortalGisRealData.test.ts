import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * ExecutivePortal TASK 4 (audit ข้อมูลปลอม, GIS tab): เดิม pin แผนที่ดึงจาก
 * mockExecutiveData.gisStudents ล้วน (lat/lng, riskStatus, isScholarship, commuteDistance
 * ปลอมทั้งหมด) — เปลี่ยนมาใช้ student_home_locations จริง (subscribeAllStudentHomeLocations,
 * ผูกกับ firestore.rules ที่เพิ่ม hasRole('EXECUTIVE') อ่านได้ทั้งโรงเรียนแล้ว) ผสานกับ
 * students จริงเพื่อดึงชื่อ + riskLevel (Student.riskLevel จริง ผูกกับ behaviorScore ใน Firestore
 * ไม่ใช่ session-local) ส่วน isScholarship/commuteDistance ไม่มีข้อมูลจริงรองรับเลยในระบบ (grep
 * ทั้งโปรเจกต์ไม่เจอ scholarship field ใดๆ) จึงตัดออกทั้งหมดตามคำสั่ง TASK 4
 */
describe('ExecutivePortal TASK 4: GIS tab ใช้พิกัดบ้านนักเรียนจริงแทนข้อมูลปลอม', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../ExecutivePortal.tsx'), 'utf8');
  const rulesSrc = fs.readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8');
  const firestoreServiceSrc = fs.readFileSync(path.resolve(__dirname, '../services/firestoreService.ts'), 'utf8');

  it('firestoreService มี subscribeAllStudentHomeLocations สำหรับอ่านทั้งโรงเรียน (ต่างจาก ByRoom ที่ scope ห้องเดียว)', () => {
    expect(firestoreServiceSrc).toContain('export function subscribeAllStudentHomeLocations(');
    expect(firestoreServiceSrc).toContain("onSnapshot(collection(db, HOME_LOCATION_COL)");
  });

  it('firestore.rules: EXECUTIVE อ่าน student_home_locations ได้ทั้งโรงเรียน (ไม่ scope ห้อง)', () => {
    const block = rulesSrc.match(/match \/student_home_locations\/\{studentId\} \{[\s\S]*?\n {4}\}/)?.[0] || '';
    expect(block).toContain("hasRole('EXECUTIVE')");
  });

  it('ExecutivePortal: GIS pin ผูกกับ student_home_locations + students จริง ไม่ใช่ mockExecutiveData.gisStudents', () => {
    expect(src).toContain('subscribeAllStudentHomeLocations(setHomeLocations)');
    expect(src).not.toContain('mockExecutiveData.gisStudents');
    expect(src).toContain('students.find(s => s.studentId === loc.studentId)');
  });

  it('regression guard: ไม่เหลือการใช้งานจริง (นอกคอมเมนต์อธิบาย) ของ riskStatus/isScholarship/commuteDistance ปลอม', () => {
    expect(src).not.toMatch(/pin\.riskStatus/);
    expect(src).not.toMatch(/pin\.isScholarship/);
    expect(src).not.toMatch(/pin\.commuteDistance/);
    // ปุ่มกรอง "นักเรียนทุน คสศ." (scholarship filter button) ถูกลบออกจริง — เหลือแค่คอมเมนต์อธิบายเหตุผล
    expect(src).not.toMatch(/onClick=\{\(\) => setGisFilter\('scholarship'\)/);
    expect(src).not.toContain("'all' | 'risk' | 'scholarship'");
  });

  it('GIS pin ใช้ Student.riskLevel จริงแทน (NORMAL/WARNING/CRITICAL) แทนสถานะปลอมเดิม', () => {
    expect(src).toContain("riskLevel: student.riskLevel || 'NORMAL'");
    expect(src).toContain("pin.riskLevel === 'WARNING' || pin.riskLevel === 'CRITICAL'");
  });
});
