import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * บั๊ก "รายวิชาไม่ดึงชื่อนักเรียนมาแสดง" ในสมุดบันทึกคะแนน — พิสูจน์ root cause จริงด้วย debug log
 * ก่อนแก้ (ไม่ใช่เดา): targetClassName เดิมใช้ course.room (ห้องกายภาพ เช่น "943") ก่อน course.level
 * (ระดับชั้น เช่น "ม.5/8") แต่ getStudentsByClass() query where('className', '==', ...) และ fallback
 * ทั้งคู่เทียบกับค่า "ระดับชั้น" ของนักเรียน (students/{id}.room และ .className เก็บ "ม.5/8" ไม่ใช่ "943"
 * จริง ตรวจสอบจาก Firestore emulator ตรงๆ) ทำให้แทบทุกวิชาที่มีห้องกายภาพระบุคืนรายชื่อว่างเปล่าเงียบๆ
 *
 * ไม่เกี่ยวกับ TASK 3 (ครูร่วมสอน, teacherId -> teacherIds) เลย — live-verified ด้วย browser จริงว่า
 * บั๊กนี้เกิดกับวิชา MAIN ทั่วไป (ค32101 ไม่มีครูร่วมสอน) เหมือนกับวิชา ACTIVITY ที่มีครูร่วมสอน (HR)
 * ทุกประการ ก่อนแก้ทั้งคู่คืน 0 คน หลังแก้ทั้งคู่คืนรายชื่อถูกต้อง (HR คืน 36 คนจริงตอน live-test)
 */
describe('Gradebook: targetClassName ต้องใช้ course.level (ระดับชั้น) ก่อน course.room (ห้องกายภาพ)', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../TeacherPortal.tsx'), 'utf8');

  it('gradebook effect (ดึงรายชื่อนักเรียน) ใช้ .level ก่อน .room เสมอ', () => {
    const matches = src.match(/const targetClassName = selectedCourse\?\.level \|\| selectedCourse\?\.room \|\| \(selectedCourse as any\)\?\.className \|\| \(selectedCourse as any\)\?\.roomName \|\| '';/g);
    // มี 2 จุด: useEffect ที่ดึงรายชื่อนักเรียน + จุดบันทึกคะแนนในฟอร์ม ต้องใช้สูตรเดียวกันทั้งคู่
    // (เจอจากการเขียน regression test นี้เอง — จุดที่สองเคยพลาดแก้ไปด้วยตอนแรก)
    expect(matches?.length).toBe(2);
  });

  it('regression guard: ต้องไม่มีจุดไหนใน TeacherPortal.tsx ใช้ .room ก่อน .level อีกสำหรับ targetClassName (บั๊กเดิม)', () => {
    // บั๊กเดิม: "selectedCourse?.room ||" ตามด้วย .className ตรงๆ โดยไม่มี ".level ||" นำหน้า
    expect(src).not.toMatch(/const targetClassName = selectedCourse\?\.room \|\| \(selectedCourse as any\)\?\.className/);
  });
});
