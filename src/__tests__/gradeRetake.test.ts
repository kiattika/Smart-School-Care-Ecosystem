import { describe, it, expect } from 'vitest';
import { readSource } from './helpers/readSource';
import { buildGradeRows, summarizeGrades, type ScoreDoc } from '../lib/gradeReport';
import { graduationLevelOf, needsRemedy, retakeDocId, validateGraduation, validateRetake, type GradeRetake } from '../lib/gradeRetake';

const sc = (over: Partial<ScoreDoc>): ScoreDoc => ({ courseCode: 'ท23101', studentId: '11111', term: '1/2569', credits: 1.5, grade: '0', total: 30, ...over });
const rt = (over: Partial<GradeRetake> = {}): GradeRetake => ({
  id: 'x', studentId: '11111', term: '1/2569', courseCode: 'ท23101', courseName: 'ภาษาไทย', kind: 'MAKEUP', originalGrade: '0', newGrade: '2',
  retakeDate: '2569-11-01', note: '', recordedByStaffId: 'r1', recordedByName: 'ทะเบียน', ...over,
});
const base = { studentId: '11111', term: '1/2569', courseCode: 'ท23101', courseName: 'ภาษาไทย', kind: 'MAKEUP', originalGrade: '0', newGrade: '2', retakeDate: '2569-11-01', note: '' };

describe('validateRetake', () => {
  it('ผ่านเมื่อครบถ้วน', () => expect(validateRetake(base)).toBeNull());
  it('ปฏิเสธผลใหม่เท่าเดิม/ชนิดไม่ตรง/ภาคผิด/รหัสวิชามี /', () => {
    expect(validateRetake({ ...base, newGrade: '0' })).toMatch(/เท่ากับ/);
    expect(validateRetake({ ...base, originalGrade: 'มผ', newGrade: '3' })).toMatch(/ชนิดเดียวกัน/);
    expect(validateRetake({ ...base, term: '3/2569' })).toMatch(/ภาคเรียน/);
    expect(validateRetake({ ...base, courseCode: 'ท/1' })).toMatch(/รหัสวิชา/);
    expect(validateRetake({ ...base, retakeDate: '1/1/69' })).toMatch(/วันที่/);
  });
  it('ร/มส แก้เป็นเกรดตัวเลขได้ และ มผ → ผ ได้', () => {
    expect(validateRetake({ ...base, originalGrade: 'ร', newGrade: '1' })).toBeNull();
    expect(validateRetake({ ...base, originalGrade: 'มส', newGrade: '2' })).toBeNull();
    expect(validateRetake({ ...base, originalGrade: 'มผ', newGrade: 'ผ' })).toBeNull();
  });
});

describe('retake ใน buildGradeRows/summarizeGrades', () => {
  it('แสดงเกรดเดิมคู่เกรดใหม่ และ GPA ใช้เกรดใหม่', () => {
    const scores = [sc({}), sc({ courseCode: 'ค23101', grade: '4', total: 90 })];
    const before = summarizeGrades(buildGradeRows({ term: '1/2569', scores }));
    const rows = buildGradeRows({ term: '1/2569', scores, retakes: [rt()] });
    const th = rows.find(r => r.code === 'ท23101')!;
    expect(th.grade).toBe('0'); // ไม่ทับผลของครู
    expect(th.retake).toMatchObject({ originalGrade: '0', newGrade: '2', kind: 'MAKEUP' });
    expect(th.gpaGrade).toBe('2');
    const after = summarizeGrades(rows);
    expect(before.gpa).toBe(2); // (0×1.5 + 4×1.5)/3
    expect(after.gpa).toBe(3);  // (2×1.5 + 4×1.5)/3
  });
  it('ผลแก้ตัวของภาค/วิชาอื่นไม่กระทบ', () => {
    const rows = buildGradeRows({ term: '1/2569', scores: [sc({})], retakes: [rt({ term: '2/2569' }), rt({ courseCode: 'ค23101' })] });
    expect(rows[0].retake).toBeUndefined();
    expect(rows[0].gpaGrade).toBe('0');
  });
});

describe('helpers', () => {
  it('needsRemedy / retakeDocId / graduationLevelOf', () => {
    expect(['0', 'ร', 'มส', 'มผ'].every(g => needsRemedy(g))).toBe(true);
    expect(['1', '4', 'ผ', null].some(g => needsRemedy(g as string))).toBe(false);
    expect(retakeDocId('11111', '1/2569', 'ท23101')).toBe('11111_1-2569_ท23101');
    expect([graduationLevelOf('ม.3/2'), graduationLevelOf('ม.6/10'), graduationLevelOf('ม.4/1'), graduationLevelOf('')]).toEqual(['ม.3', 'ม.6', null, null]);
    expect(validateGraduation({ studentId: '1', level: 'ม.4', academicYear: '2569', note: '' })).toMatch(/ม.3/);
    expect(validateGraduation({ studentId: '1', level: 'ม.6', academicYear: '2569', note: '' })).toBeNull();
  });
});

describe('rules/บทบาท (static)', () => {
  const rules = readSource('firestore.rules');
  const blk = (name: string) => { const i = rules.indexOf(`match /${name}`); return rules.slice(i, i + 1800); };
  it('ผู้ช่วยลบผลแก้ตัวไม่ได้ และอนุมัติจบไม่ได้', () => {
    expect(blk('grade_retakes/')).toContain('allow delete: if regFull()');
    expect(rules).toContain("function regFull() { return hasRole('SUPER_ADMIN') || hasRole('REGISTRAR'); }");
    expect(blk('graduation_approvals')).toContain('allow create: if regFull()');
  });
  it('บทบาทใหม่อยู่ใน ROLE_PERMISSIONS/ชื่อไทย/สี', () => {
    expect(readSource('src/types/auth.ts')).toMatch(/REGISTRAR_ASSISTANT: \[/);
    expect(readSource('src/components/StaffRoleManagementPage.tsx')).toContain("REGISTRAR_ASSISTANT: 'ผู้ช่วยงานทะเบียนวัดผล'");
    expect(readSource('src/App.tsx')).toContain('<RegistrarPortal />');
  });
});
