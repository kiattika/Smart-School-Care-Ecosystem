import { isValidScoreSetting, scoreSettingDocId, scoreSettingToForm } from '../lib/scoreSettings';
import { countPeriodsPerWeek, creditsFromPeriods, effectiveCredits, importCredits, isActivityCode, isSchoolSpecificCode, subjectGroupOf } from '../lib/subjectCode';
import { buildGradeRows as buildGradeRowsSC } from '../lib/gradeReport';
import { courseKindOf as courseKindSC } from '../lib/teachingProject';
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

describe('สัดส่วนคะแนนรายวิชา (บันทึกถาวร)', () => {
  it('ตรวจรวม 100 / จำนวนเต็ม / ไม่ติดลบ', () => {
    expect(isValidScoreSetting({ maxPreMidterm: 25, maxMidterm: 20, maxPostMidterm: 25, maxFinal: 30 })).toBe(true);
    expect(isValidScoreSetting({ maxPreMidterm: 25, maxMidterm: 20, maxPostMidterm: 25, maxFinal: 31 })).toBe(false);
    expect(isValidScoreSetting({ maxPreMidterm: -5, maxMidterm: 30, maxPostMidterm: 35, maxFinal: 40 })).toBe(false);
  });
  it('doc id ต่อครู+วิชา และแปลงเป็นฟอร์มถูกคีย์ (เดิมส่ง maxXxx เข้าฟอร์มทำช่องเพี้ยน)', () => {
    expect(scoreSettingDocId('t1', 'ว1/2')).toBe('t1__ว1_2');
    expect(scoreSettingToForm({ courseId: 'c', maxPreMidterm: 30, maxMidterm: 20, maxPostMidterm: 20, maxFinal: 30 })).toEqual({ preMidterm: 30, midterm: 20, postMidterm: 20, final: 30 });
    expect(scoreSettingToForm(undefined)).toEqual({ preMidterm: 25, midterm: 20, postMidterm: 25, final: 30 });
  });
  it('พอร์ทัลบันทึกลง Firestore ก่อนปิดหน้าต่าง และโหลดกลับด้วย subscribe', () => {
    const src = readSource('src/TeacherPortal.tsx');
    expect(src).toContain('saveCourseScoreSetting(sid');
    expect(src).toContain('subscribeCourseScoreSettings(sid');
  });
});

describe('รหัสวิชา → ประเภท/หน่วยกิต', () => {
  it('อักษรตัวแรกบอกกลุ่มสาระฯ; ก = กิจกรรม; HR/CZ = เฉพาะกิจ', () => {
    expect(subjectGroupOf('ว21101')).toBe('วิทยาศาสตร์และเทคโนโลยี');
    expect(subjectGroupOf('จ31201')).toBe('ภาษาจีน');
    expect(subjectGroupOf('ก21901')).toBe('กิจกรรมพัฒนาผู้เรียน');
    expect(subjectGroupOf('HR')).toBeNull();
    expect(isActivityCode('ก21901')).toBe(true);
    expect(isSchoolSpecificCode('HR')).toBe(true);
    expect(isSchoolSpecificCode('CZ')).toBe(true);
    expect(isSchoolSpecificCode('ว21101')).toBe(false);
    expect(isSchoolSpecificCode('ก21901')).toBe(false);
    expect(isSchoolSpecificCode('')).toBe(false);
  });
  it('courseKindOf: HR/CZ = EXEMPT, ก = ACTIVITY, อื่น = NORMAL', () => {
    expect(courseKindSC({ code: 'HR', name: 'โฮมรูม' })).toBe('EXEMPT');
    expect(courseKindSC({ code: 'CZ', name: 'x' })).toBe('EXEMPT');
    expect(courseKindSC({ code: 'ก21901', name: 'ลูกเสือ' })).toBe('ACTIVITY');
    expect(courseKindSC({ code: 'ค21101', name: 'คณิตศาสตร์' })).toBe('NORMAL');
  });
  it('1 คาบ/สัปดาห์ = 0.5 หน่วยกิต; กิจกรรม/เฉพาะกิจไม่มี; ไม่รู้คาบใช้ค่าที่เก็บ; ไม่มีเลย = null', () => {
    expect(creditsFromPeriods(3)).toBe(1.5);
    expect(creditsFromPeriods(0)).toBeNull();
    expect(effectiveCredits({ code: 'ว21101', periodsPerWeek: 2, stored: 1.5 })).toBe(1);
    expect(effectiveCredits({ code: 'ก21901', periodsPerWeek: 2, stored: 1.5 })).toBeNull();
    expect(effectiveCredits({ code: 'HR', periodsPerWeek: 1 })).toBeNull();
    expect(effectiveCredits({ code: 'ว21101', subjectType: 'ACTIVITY', periodsPerWeek: 2 })).toBeNull();
    expect(effectiveCredits({ code: 'ว21101', stored: 1 })).toBe(1);
    expect(effectiveCredits({ code: 'ว21101' })).toBeNull();
  });
  it('นับคาบ/สัปดาห์: วัน+คาบซ้ำนับครั้งเดียว; นำเข้าไม่ใส่ 1.5 ปลอมอีก', () => {
    const slots = [{ dayOfWeek: 'monday', periodNumber: 1 }, { dayOfWeek: 'monday', periodNumber: 1 }, { dayOfWeek: 'tuesday', periodNumber: 4 }, { dayOfWeek: 'friday', periodNumber: 2 }];
    expect(countPeriodsPerWeek(slots)).toBe(3);
    expect(importCredits('ท21101', 'MAIN', slots)).toBe(1.5);
    expect(importCredits('ก21901', 'ACTIVITY', slots)).toBe(0);
    expect(importCredits('HR', 'ACTIVITY', slots)).toBe(0);
  });
  it('ปพ.6: หน่วยกิตคำนวณจากคาบ, กิจกรรม ผ/มผ ไม่มีหน่วยกิต, HR/CZ ไม่แสดง', () => {
    const rows = buildGradeRowsSC({
      term: '1/2569',
      scores: [{ courseCode: 'ว21101', term: '1/2569', preMidterm: 20, midterm: 15, postMidterm: 20, final: 25 }, { courseCode: 'ก21901', term: '1/2569', passFailResult: 'PASS' }, { courseCode: 'HR', term: '1/2569' }] as any,
      courses: [{ code: 'ว21101', name: 'วิทย์', credits: 1.5, periods: 2 }, { code: 'ก21901', name: 'ลูกเสือ', credits: 1.5, periods: 1 }, { code: 'HR', name: 'โฮมรูม', periods: 1 }],
    });
    expect(rows.map(r => r.code).sort()).toEqual(['ก21901', 'ว21101']);
    expect(rows.find(r => r.code === 'ว21101')!.credits).toBe(1);
    expect(rows.find(r => r.code === 'ก21901')!.credits).toBeNull();
    expect(rows.find(r => r.code === 'ก21901')!.grade).toBe('ผ');
  });
});
