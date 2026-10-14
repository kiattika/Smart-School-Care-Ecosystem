import { describe, it, expect } from 'vitest';
import { isValidThaiNationalId, normalizeNationalId, formatNationalId } from '../lib/nationalId';
import { validateRegistryInput, normalizeRegistryProfile, emptyRegistryProfile, REGISTRY_VERIFY_NOTICE } from '../lib/registryProfile';
import { buildPp5Rows, summarizePp5, attendanceForCourse, attendancePercent } from '../lib/pp5';
import { groupWithTones, GROUP_TONES, NEUTRAL_TONE } from '../lib/groupTones';
import { parentFullName, deriveParentNames } from '../lib/parentNames';
import { readSource } from './helpers/readSource';

describe('เลขประจำตัวประชาชน', () => {
  it('checksum ถูก/ผิด', () => {
    expect(isValidThaiNationalId('1101700230678')).toBe(true);
    expect(isValidThaiNationalId('1-1017-00230-67-8')).toBe(true);
    expect(isValidThaiNationalId('1101700230679')).toBe(false);
    expect(isValidThaiNationalId('12345')).toBe(false);
    expect(isValidThaiNationalId('11017002306AB')).toBe(false);
  });
  it('normalize / format', () => {
    expect(normalizeNationalId('1-1017-00230-67-8')).toBe('1101700230678');
    expect(formatNationalId('1101700230678')).toBe('1-1017-00230-67-8');
  });
  it('validateRegistryInput: ว่างผ่าน, ผิดไม่ผ่าน; normalize ตัดขีด', () => {
    expect(validateRegistryInput({ nationalId: '' })).toEqual([]);
    expect(validateRegistryInput({ nationalId: '1101700230679' })).toHaveLength(1);
    expect(normalizeRegistryProfile({ ...emptyRegistryProfile(), nationalId: '1-1017-00230-67-8' }).nationalId).toBe('1101700230678');
    expect(REGISTRY_VERIFY_NOTICE).toContain('งานทะเบียน');
  });
});

describe('ปพ.5', () => {
  const max = { pre: 25, mid: 20, post: 25, final: 30 };
  const students = [
    { studentId: '1', studentNo: 1, name: 'ก', room: 'ม.5/8' },
    { studentId: '2', studentNo: 2, name: 'ข', room: 'ม.5/8' },
    { studentId: '3', studentNo: 3, name: 'ค', room: 'ม.5/8' },
  ];
  const scores: Record<string, any> = {
    '1': { preMidterm: 25, midterm: 20, postMidterm: 20, final: 20, total: 85, grade: '4' },
    '2': { preMidterm: 10, midterm: 10, postMidterm: 10, final: 10, total: 40, grade: '0' },
  };
  it('คำนวณร้อยละ/เกรด; ไม่มีคะแนน = ว่าง ไม่ใช่ 0', () => {
    const rows = buildPp5Rows({ students, scoreOf: id => scores[id], max, isActivity: false, attendanceOf: () => null });
    expect(rows[0].percent).toBeCloseTo(85);
    expect(rows[2].total).toBeNull(); expect(rows[2].grade).toBeNull(); expect(rows[2].hasScore).toBe(false);
    const s = summarizePp5(rows);
    expect(s.count).toBe(3); expect(s.scored).toBe(2);
    expect(s.avgPercent).toBeCloseTo(62.5);
    expect(s.distribution['4']).toBe(1); expect(s.distribution['0']).toBe(1);
  });
  it('วิชากิจกรรมนับ ผ/มผ', () => {
    const rows = buildPp5Rows({ students, scoreOf: id => (id === '1' ? { passFailResult: 'PASS' } : id === '2' ? { passFailResult: 'FAIL' } : undefined), max, isActivity: true, attendanceOf: () => null });
    const s = summarizePp5(rows);
    expect(s.activityPassed).toBe(1); expect(s.activityFailed).toBe(1);
  });
  it('เวลาเรียนจากสถิติรายวิชา', () => {
    const stats = { 'ค31101|ม.5': { code: 'ค31101', present: 8, late: 1, absent: 1, leave: 0 } };
    const a = attendanceForCourse(stats, 'ค31101');
    expect(a).toEqual({ present: 8, late: 1, absent: 1, leave: 0 });
    expect(attendancePercent(a)).toBeCloseTo(90);
    expect(attendanceForCourse(stats, 'อื่น')).toBeNull();
    expect(attendancePercent(null)).toBeNull();
  });
});

describe('จัดกลุ่มตามกลุ่มสาระฯ + โทนสี', () => {
  const items = [
    { id: 'a', d: 'D2', n: 'ข' }, { id: 'b', d: 'D1', n: 'ค' }, { id: 'c', d: 'D2', n: 'ก' }, { id: 'd', d: '', n: 'ง' },
  ];
  const label = (k: string) => ({ D1: 'คณิตศาสตร์', D2: 'วิทยาศาสตร์' }[k] || k);
  it('กลุ่มเดียวกันอยู่ติดกัน สีเดียวกัน เรียงในกลุ่มตามชื่อ; ไม่ระบุกลุ่มอยู่ท้ายสีกลาง', () => {
    const g = groupWithTones(items, i => i.d, label, (a, b) => a.n.localeCompare(b.n, 'th'));
    expect(g.map(x => x.label)).toEqual(['คณิตศาสตร์', 'วิทยาศาสตร์', 'ไม่ระบุกลุ่มสาระฯ']);
    expect(g[1].items.map(i => i.id)).toEqual(['c', 'a']);
    expect(g[0].tone).toBe(GROUP_TONES[0]); expect(g[1].tone).toBe(GROUP_TONES[1]); expect(g[2].tone).toBe(NEUTRAL_TONE);
  });
  it('หน้าตรวจแผน/โครงการสอนใช้ groupWithTones และหน้ารายงานมีข้อความตรวจสอบ', () => {
    expect(readSource('src/components/lessonplans/LessonPlanReviewPanel.tsx')).toContain('groupWithTones');
    expect(readSource('src/components/teachingproject/TeachingProjectsOverview.tsx')).toContain('groupWithTones');
    expect(readSource('src/components/student-parent/RegistryHeaderCard.tsx')).toContain('REGISTRY_VERIFY_NOTICE');
    expect(readSource('src/components/student-parent/StudentGradeReport.tsx')).toContain('RegistryHeaderCard');
    expect(readSource('src/components/teacher/Pp5Sheet.tsx')).toContain('GRADE_REPORT_DISCLAIMER');
  });
});

describe('ชื่อบิดา/มารดาจากแบบเยี่ยมบ้านผู้ปกครอง', () => {
  const p = (title: string, firstName: string, lastName: string) => ({ title, firstName, lastName } as any);
  it('รวมคำนำหน้า+ชื่อ+สกุล; ไม่มีชื่อ = ว่าง', () => {
    expect(parentFullName(p('นาย', 'สมชาย', 'ใจดี'))).toBe('นาย สมชาย ใจดี');
    expect(parentFullName(p('', '', 'ใจดี'))).toBe('');
    expect(deriveParentNames({ father: p('นาย', 'ก', 'ข'), mother: p('', '', '') } as any)).toEqual({ fatherName: 'นาย ก ข', motherName: '' });
  });
  it('ฟอร์มนักเรียนไม่มีช่องชื่อบิดา/มารดา และฟอร์มผู้ปกครองซิงก์สำเนา', () => {
    expect(readSource('src/components/homevisit/StudentHomeVisitInfoForm.tsx')).not.toMatch(/fatherName|motherName/);
    expect(readSource('src/components/homevisit/FamilyHomeVisitInfoForm.tsx')).toContain('syncParentNames');
    expect(readSource('src/services/firestoreService.ts')).toMatch(/batch\.set\(doc\(db, PARENT_NAMES_COL/);
  });
});

describe('ภาคเรียนของสมุดคะแนน', () => {
  it('ไม่ฝังภาคเรียนตายตัวใน TeacherPortal/service และอ่านคะแนนกรองตามภาคเรียน', () => {
    expect(readSource('src/TeacherPortal.tsx')).not.toMatch(/'1\/2569'/);
    const svc = readSource('src/services/firestoreService.ts');
    expect(svc).not.toMatch(/'1\/2569'/);
    expect(svc).toMatch(/data\.studentId && data\.term === term/);
    expect(readSource('src/TeacherPortal.tsx')).toMatch(/useCurrentSemester\(\)/);
  });
});
