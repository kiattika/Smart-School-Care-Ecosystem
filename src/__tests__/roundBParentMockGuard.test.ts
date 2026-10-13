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
  it('ข้อความล่าสุดมาจาก class_chat_threads จริง และมี empty state', () => {
    expect(src).toContain('ยังไม่มีข้อความจากครูประจำชั้น');
    expect(src).toContain('useMemberThreads');
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

describe('นัดพบครู (parent_appointments) เขียนจริงผ่านบริการ ไม่เก็บใน Zustand', () => {
  it('store ไม่มีสถานะ/ฟังก์ชันนัดหมายแล้ว (ห้ามกลับไปเก็บใน store)', () => {
    const src = readSource('src/store.ts');
    expect(src).not.toMatch(/parentAppointments|bookParentAppointment/);
  });
  it('createAppointmentRequest เริ่มที่ REQUESTED, throw เมื่อเขียนไม่สำเร็จ, ไม่แนบลิงก์ประชุมปลอม', () => {
    const src = readSource('src/services/firestoreService.ts');
    const start = src.indexOf('export async function createAppointmentRequest');
    const body = src.slice(start, src.indexOf('export async function respondAppointment', start));
    expect(body).toContain("status: 'REQUESTED'");
    expect(body).toContain('handleFirestoreError(');
    expect(body).not.toContain('meet.google.com');
    expect(body).not.toContain("'CONFIRMED'");
  });
  it('ฟอร์มผู้ปกครองรอผลเขียนจริงก่อนขึ้น "ส่งแล้ว"', () => {
    const src = readSource('src/components/student-parent/ParentEngagementServices.tsx');
    expect(src).toMatch(/await createAppointmentRequest\(/);
    expect(src).not.toMatch(/bookParentAppointment/);
  });
});
