import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * TASK 2: วิชากิจกรรม (ACTIVITY) บันทึกแค่ผ่าน (ผ) / ไม่ผ่าน (มผ) แทนคะแนนตัวเลข 4 ช่องแบบวิชาหลัก
 * (MAIN) — ใช้ source-inspection เพราะ mount เต็มรูปแบบต้องพึ่ง Firestore listener จำนวนมาก
 * (ตามรูปแบบเดิมของโปรเจกต์)
 */
describe('Gradebook TASK 2: วิชากิจกรรมบันทึกผ่าน/ไม่ผ่าน แทนคะแนนตัวเลข', () => {
  const teacherPortalSrc = fs.readFileSync(path.resolve(__dirname, '../TeacherPortal.tsx'), 'utf8');
  const typesSrc = fs.readFileSync(path.resolve(__dirname, '../types.ts'), 'utf8');
  const firestoreServiceSrc = fs.readFileSync(path.resolve(__dirname, '../services/firestoreService.ts'), 'utf8');

  it('Course/GlobalCourse มี subjectType ให้แยกวิชาหลัก/กิจกรรม', () => {
    expect(typesSrc).toContain("subjectType?: 'MAIN' | 'ACTIVITY';");
  });

  it('StudentScore/GradebookScoreRecord เพิ่ม passFailResult แบบ field แยก ไม่แตะความหมาย field ตัวเลขเดิม', () => {
    expect(typesSrc).toContain("passFailResult?: 'PASS' | 'FAIL' | null;");
    expect(firestoreServiceSrc).toContain("passFailResult?: 'PASS' | 'FAIL' | null;");
  });

  it('globalCourses ดึง subjectType จาก schedule doc จริง (field เดียวกับที่ detectSubjectType ใช้)', () => {
    expect(teacherPortalSrc).toContain("subjectType: (sch.subjectType || sch.type) === 'ACTIVITY' ? 'ACTIVITY' : 'MAIN',");
  });

  it('myCourses ส่ง subjectType ต่อไปยัง Course object', () => {
    expect(teacherPortalSrc).toContain("subjectType: gc.subjectType || 'MAIN'");
  });

  it('gradebook table แยก UI ตาม isActivitySubject: ผ่าน/ไม่ผ่าน ไม่ใช่ตัวเลข', () => {
    expect(teacherPortalSrc).toContain("const isActivitySubject = selectedCourse?.subjectType === 'ACTIVITY';");
    expect(teacherPortalSrc).toContain('ผ่าน (ผ)');
    expect(teacherPortalSrc).toContain('ไม่ผ่าน (มผ)');
  });

  it('handlePassFailChange เขียน passFailResult ทั้งใน local state และ Firestore', () => {
    expect(teacherPortalSrc).toContain("const handlePassFailChange = (studentId: string, result: 'PASS' | 'FAIL') => {");
    expect(teacherPortalSrc).toContain('passFailResult: result');
  });

  it('เปลี่ยนคะแนนตัวเลข (วิชาหลัก) ต้องล้าง passFailResult เป็น null เสมอ (กันค่าเก่าค้างข้ามประเภทวิชา)', () => {
    expect(teacherPortalSrc).toContain('grade, passFailResult: null');
  });
});
