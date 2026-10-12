import { describe, it, expect } from 'vitest';
import { readSource } from './helpers/readSource';

/** รอบ B — หน้า/บริการผู้ปกครองต้องไม่มีข้อมูลหรือพฤติกรรมปลอมกลับมา */
describe('ParentPortal ไม่ฝังข้อมูลปลอม', () => {
  const src = readSource('src/ParentPortal.tsx');
  it('ไม่มีชื่อครู/เบอร์โทร/ข้อความตัวอย่างฝังตาย', () => {
    expect(src).not.toContain('ครูกิตติศักดิ์');
    expect(src).not.toContain('02-123-4567');
    expect(src).not.toContain('น้องสมชาย');
  });
  it("ไม่มี fallback ห้อง '5/8'", () => {
    expect(src).not.toMatch(/\|\|\s*'5\/8'/);
  });
  it('ข้อความล่าสุดมาจาก store จริง และมี empty state', () => {
    expect(src).toContain('ยังไม่มีข้อความจากครูหรือโรงเรียน');
    expect(src).toContain("m.senderRole !== 'PARENT'");
  });
});

describe('ParentEngagementServices ไม่สร้างการตอบกลับ/ลิงก์/สถานะปลอม', () => {
  const src = readSource('src/components/student-parent/ParentEngagementServices.tsx');
  it('ไม่มีครูตอบกลับอัตโนมัติ ไม่มีชื่อครูฝังตาย ไม่มีลิงก์ Meet ปลอม ไม่มีสถานะ ออนไลน์ ปลอม', () => {
    expect(src).not.toContain('ครูกิตติศักดิ์');
    expect(src).not.toMatch(/sendParentTeacherMessage\(\s*student\.studentId,\s*'TEACHER'/);
    expect(src).not.toContain('meet.google.com');
    expect(src).not.toContain('ออนไลน์</p>');
  });
  it('ไม่มีค่าเริ่มต้นปลอมของฟอร์มนัดหมาย และไม่สร้าง parentId แทน', () => {
    expect(src).not.toContain('2026-08-25');
    expect(src).not.toContain('TCAS');
    expect(src).not.toContain('`parent_${');
    expect(src).toContain('user?.uid');
  });
});

describe('store.bookParentAppointment', () => {
  const src = readSource('src/store.ts');
  const start = src.indexOf('bookParentAppointment: (apt) => {');
  const body = src.slice(start, src.indexOf('addGPSCheckInLog', start));
  it("สถานะเริ่มต้น = REQUESTED และไม่แนบลิงก์ประชุมปลอม", () => {
    expect(body).toContain("status: 'REQUESTED'");
    expect(body).not.toContain("'CONFIRMED'");
    expect(body).not.toContain('meet.google.com');
  });
});
