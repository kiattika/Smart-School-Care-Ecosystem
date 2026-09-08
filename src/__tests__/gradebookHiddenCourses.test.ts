import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * TASK 3: ครูซ่อนคาบกิจกรรมที่ไม่ต้องประเมิน (เช่น PLC, พักกลางวัน) ออกจาก dropdown สมุดบันทึกคะแนน
 * ของตัวเองได้ — ไม่ลบข้อมูลจริง แค่ preference ส่วนตัวต่อครูคนเดียว เก็บใน collection แยก
 * (gradebook_hidden_courses) แทนการเพิ่ม flag ที่ elective_activities_config เพราะคาบแบบ PLC/
 * พักกลางวัน/HR ไม่ได้มาจาก collection นั้นเลย (นั่นมีไว้เฉพาะชุมนุมที่นักเรียนสมัครเอง) แต่มาจาก
 * schedules ที่ import ตรงๆ — เพิ่ม flag บน schedules เองเสี่ยงโดนโครงสร้าง sync/replace ของการ
 * import ลบ/เขียนทับตอน import รอบถัดไป จึงเลือกแยก collection ต่างหากที่ผูกกับครู+courseId แทน
 * (บันทึกเหตุผลไว้ตามที่ขอ) ใช้ source-inspection เพราะ mount เต็มรูปแบบต้องพึ่ง Firestore listener
 * จำนวนมาก (ตามรูปแบบเดิมของโปรเจกต์)
 */
describe('Gradebook TASK 3: ซ่อนคาบกิจกรรมที่ไม่ต้องประเมินออกจากรายการ', () => {
  const teacherPortalSrc = fs.readFileSync(path.resolve(__dirname, '../TeacherPortal.tsx'), 'utf8');
  const firestoreServiceSrc = fs.readFileSync(path.resolve(__dirname, '../services/firestoreService.ts'), 'utf8');
  const rulesSrc = fs.readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8');

  it('firestoreService มี subscribe/hide/unhide ครบ ผูกกับ collection gradebook_hidden_courses', () => {
    expect(firestoreServiceSrc).toContain("const GRADEBOOK_HIDDEN_COURSES_COL = 'gradebook_hidden_courses';");
    expect(firestoreServiceSrc).toContain('export function subscribeHiddenGradebookCourses(');
    expect(firestoreServiceSrc).toContain('export async function hideGradebookCourse(');
    expect(firestoreServiceSrc).toContain('export async function unhideGradebookCourse(');
  });

  it('firestore.rules: gradebook_hidden_courses จำกัดแค่เจ้าของ (teacherUid == auth.uid) เท่านั้น ไม่ให้ update', () => {
    const block = rulesSrc.match(/match \/gradebook_hidden_courses\/\{docId\} \{[\s\S]*?\n {4}\}/)?.[0] || '';
    expect(block).toContain('resource.data.teacherUid == request.auth.uid');
    expect(block).toContain('request.resource.data.teacherUid == request.auth.uid');
    expect(block).toContain('allow update: if false;');
  });

  it('TeacherPortal: visibleGradebookCourses กรอง hiddenGradebookCourseIds ออกจาก dropdown', () => {
    expect(teacherPortalSrc).toContain(
      'const visibleGradebookCourses = useMemo(\n    () => gradebookCourses.filter(c => !hiddenGradebookCourseIds.has(c.id)),'
    );
    // select ใช้ list ที่กรองแล้ว ไม่ใช่ list เต็ม
    expect(teacherPortalSrc).toContain('{visibleGradebookCourses.map(c => (');
  });

  it('มี modal จัดการ แสดงเฉพาะวิชากิจกรรม (ACTIVITY) ไม่ใช่วิชาหลัก (MAIN ไม่มีเหตุผลให้ซ่อน)', () => {
    expect(teacherPortalSrc).toContain("gradebookCourses.filter(c => c.subjectType === 'ACTIVITY')");
    expect(teacherPortalSrc).toContain('ไม่ต้องประเมิน');
    expect(teacherPortalSrc).toContain('แสดงอีกครั้ง');
  });
});
