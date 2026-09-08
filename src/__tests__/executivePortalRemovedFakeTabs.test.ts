import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * ExecutivePortal TASK 6/7/8 (audit ข้อมูลปลอม): 3 tab ที่ไม่มีทางเชื่อมกับข้อมูลจริงได้เลย เอาออก
 * ทั้งหมดตามคำสั่ง (เหมือนที่เคยตัดสินใจกับ tab เกินขอบเขตใน FinancePortal มาก่อน):
 *  - TASK 6 "Policy Action Center": ไม่มีระบบนโยบาย/งบประมาณจริงในระบบเลย ปุ่ม Approve/Review
 *    แค่แก้ state ในเครื่อง ไม่เขียน Firestore
 *  - TASK 7 "Report Center": ตารางห้องเรียน/ครูที่ปรึกษา hardcode เอง ปุ่ม Export เป็น setTimeout
 *    ปลอม ไม่มีไฟล์ PDF ออกจริง
 *  - TASK 8 "Master Data Management": ซ้ำซ้อนกับ BulkDataImportModal.tsx (ทำงานจริง) ที่ AdminPortal
 *    — เลือกลบแทนลิงก์ไปหน้าจริง เพราะ firestore.rules ไม่ให้ EXECUTIVE เขียน students/staff เลย
 *    (allow write เฉพาะ SUPER_ADMIN/HOMEROOM_TEACHER) การฝัง modal ในนี้จะยังใช้งานไม่ได้จริงถ้าไม่ขยาย
 *    สิทธิ์เขียนข้อมูลหลักเพิ่ม ซึ่งใหญ่กว่าการอนุญาตอ่านเพื่อสรุปภาพรวมใน TASK 4/5 มาก
 */
describe('ExecutivePortal TASK 6/7/8: เอา tab ที่ไม่มีข้อมูลจริงรองรับออกทั้งหมด', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../ExecutivePortal.tsx'), 'utf8');

  it('TASK 6: ไม่มี tab policy / actionStatuses / handleAction เหลืออยู่', () => {
    expect(src).not.toMatch(/activeTab === 'policy'/);
    expect(src).not.toMatch(/const \[actionStatuses/);
    expect(src).not.toContain('const handleAction');
    expect(src).not.toContain("id: 'policy'");
  });

  it('TASK 7: ไม่มี tab reports / handleDownload / downloadingId เหลืออยู่', () => {
    expect(src).not.toMatch(/activeTab === 'reports'/);
    expect(src).not.toContain('const handleDownload');
    expect(src).not.toContain('downloadingId');
    expect(src).not.toContain("id: 'reports'");
    expect(src).not.toContain('ครูสมปอง ใจดี'); // hardcoded fake advisor name
  });

  it('TASK 8: ไม่มี tab import / handleProcessData / isProcessing เหลืออยู่', () => {
    expect(src).not.toMatch(/activeTab === 'import'/);
    expect(src).not.toContain('const handleProcessData');
    expect(src).not.toContain('isProcessing');
    expect(src).not.toContain("id: 'import'");
    expect(src).not.toMatch(/<h3[^>]*>Master Data Management<\/h3>/);
  });

  it('regression guard: ไม่เหลือการอ่านข้อมูลจริงจาก mockExecutiveData เลยทั้งไฟล์ (import ก็ถูกลบด้วย)', () => {
    expect(src).not.toContain('mockExecutiveData.');
    expect(src).not.toMatch(/^import \{ mockExecutiveData \}/m);
  });

  it('activeTab union type ไม่มี policy/reports/import อีกต่อไป', () => {
    const typeMatch = src.match(/const \[activeTab, setActiveTab\] = useState<([^>]+)>/);
    expect(typeMatch).not.toBeNull();
    const unionType = typeMatch![1];
    expect(unionType).not.toContain("'policy'");
    expect(unionType).not.toContain("'reports'");
    expect(unionType).not.toContain("'import'");
  });
});
