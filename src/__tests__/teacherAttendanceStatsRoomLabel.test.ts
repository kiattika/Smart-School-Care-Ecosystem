import { describe, it, expect } from 'vitest';
import { readSource } from './helpers/readSource';

describe('guard: ดรอปดาวน์ "สถิติการเข้าเรียนรายบุคคล" แยกรายวิชาในระดับชั้นเดียวกัน', () => {
  it('TeacherPortal สร้างตัวเลือก ห้อง+รายวิชา (ป้าย "ระดับชั้น (ห้อง) — รหัส ชื่อวิชา") และไม่แสดงห้อง Non-Student', () => {
    const src = readSource('src/TeacherPortal.tsx');
    expect(src).toMatch(/attendanceRoomOptions/);
    expect(src).toMatch(/non-student/i);
    expect(src).toMatch(/courseCode: c\.code/);
    expect(src).toMatch(/<TeacherAttendanceStatsPanel options=\{attendanceRoomOptions\}/);
  });
  it('TeacherAttendanceStatsPanel จำกัดสถิติเฉพาะรายวิชาที่เลือก (courseStatKey ของ option)', () => {
    const src = readSource('src/components/attendance/TeacherAttendanceStatsPanel.tsx');
    expect(src).toMatch(/courseStatKey\(active\.courseCode\)/);
    expect(src).toMatch(/<option key=\{o\.value\} value=\{o\.value\}>\{o\.label\}<\/option>/);
    expect(src).not.toMatch(/onlyMine/);
  });
});

describe('guard: สมุดคะแนนแสดงชุมนุมเป็นชื่อ ไม่โชว์รหัสภายใน ELECTIVE_<id>', () => {
  it('ตัวเลือกวิชาของ elective_ แสดง "ชุมนุม <ชื่อ>"', () => {
    expect(readSource('src/TeacherPortal.tsx')).toMatch(/c\.id\.startsWith\('elective_'\) \? `ชุมนุม \$\{c\.name\}`/);
  });
});

describe('guard: สมัครชุมนุมใหม่หลังถอน (doc เดิมมี removedAt)', () => {
  it('enrollInActivity ใช้ transaction.update กับ doc ที่มีอยู่ และ rules อนุญาตเฉพาะกรณีนั้น', () => {
    const svc = readSource('src/services/firestoreService.ts');
    const i = svc.indexOf('export async function enrollInActivity');
    const body = svc.slice(i, svc.indexOf('export async function withdrawFromActivity'));
    expect(body).toMatch(/if \(enrollmentSnap\.exists\(\)\) \{[\s\S]*transaction\.update\(enrollmentRef/);
    const rules = readSource('firestore.rules');
    const k = rules.indexOf('match /activity_enrollments/');
    const block = rules.slice(k, rules.indexOf('allow delete: if false;', k));
    expect(block).toMatch(/resource\.data\.removedAt != null/);
    expect(block).toMatch(/hasOnly\(\['enrolledAt', 'removedAt', 'removedBy', 'removedReason'\]\)/);
  });
});
