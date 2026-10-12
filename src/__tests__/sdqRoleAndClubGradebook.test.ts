import { describe, it, expect } from 'vitest';
import { readSource } from './helpers/readSource';

describe('guard: SDQ ผู้กรอกกรอกได้เฉพาะมุมมองของตัวเอง', () => {
  it('HealthMentalWellbeingModule ไม่มีปุ่มสลับไปกรอกมุมมองครู/ผู้ปกครอง (นักเรียน=STUDENT, ผู้ปกครอง=PARENT)', () => {
    const src = readSource('src/components/student-parent/HealthMentalWellbeingModule.tsx');
    expect(src).not.toMatch(/setSdqEvaluator/);
    expect(src).toMatch(/const sdqEvaluator: 'STUDENT' \| 'PARENT' = isParentView \? 'PARENT' : 'STUDENT'/);
  });
  it('rules: evaluatorType ผูกกับบทบาทผู้เขียน', () => {
    const r = readSource('firestore.rules');
    const blk = r.slice(r.indexOf('match /student_assessments_sdq/'), r.indexOf('allow update, delete', r.indexOf('match /student_assessments_sdq/')));
    expect(blk).toMatch(/evaluatorType == 'STUDENT' &&\s*isSelfStudent/);
    expect(blk).toMatch(/evaluatorType == 'PARENT' && isSignedIn\(\) &&/);
    expect(blk).toMatch(/evaluatorType == 'TEACHER' &&\s*isHomeroomTeacherOf/);
  });
});

describe('guard: สมุดบันทึกคะแนนชุมนุมดึงรายชื่อจาก activity_enrollments', () => {
  const src = readSource('src/TeacherPortal.tsx');
  it('เพิ่มชุมนุมที่ครูรับผิดชอบเข้า gradebookCourses (id elective_<cfg>) และตัดคาบชุมนุม Non-Student ออก', () => {
    expect(src).toMatch(/isStaffIn\(user, cfg\.responsibleTeacherUids\)/);
    expect(src).toMatch(/id: `elective_\$\{cfg\.id\}`/);
    expect(src).toMatch(/\/ชุมนุม\/\.test\(c\.name \|\| ''\) && \/\^non-student\$\/i/);
  });
  it('รายชื่อชุมนุมมาจาก subscribeActiveEnrollmentsByActivity ไม่ใช่ getStudentsByClass', () => {
    expect(src).toMatch(/if \(!selectedGradebookCourseId\.startsWith\('elective_'\)\) getStudentsByClass/);
    expect(src).toMatch(/subscribeActiveEnrollmentsByActivity\(selectedGradebookCourseId\.slice\('elective_'\.length\)/);
  });
});
