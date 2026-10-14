import { describe, it, expect } from 'vitest';
import { readSource } from './helpers/readSource';
import {
  courseKindOf, emptyUnit, groupCoursesByCode, prefillCreditsHours, isProjectReady, levelLabelOf, parseWeeks, projectCoverage,
  assessmentTotal, unitLabel, validateProject, type TeachingProject,
} from '../lib/teachingProject';

const base = { description: 'คำอธิบาย', indicators: ['ตัวชี้วัด 1'], units: [{ ...emptyUnit('LESSON'), title: 'บทที่ 1' }], assessment: [], credits: '1.5', hoursPerWeek: '3', courseType: '', levelLabel: 'ม.4', assessmentNote: '' };

describe('teachingProject lib', () => {
  it('ประเภทวิชา: ก = กิจกรรม, PLC/CZ = ยกเว้น, อื่นๆ = ปกติ', () => {
    expect(courseKindOf({ code: 'ก33905', name: 'กิจกรรมแนะแนว' })).toBe('ACTIVITY');
    expect(courseKindOf({ code: 'ก23911', name: 'กิจกรรมลูกเสือ/เนตรนารี' })).toBe('ACTIVITY');
    expect(courseKindOf({ code: 'ว30103', name: 'ชีววิทยาพื้นฐาน', subjectType: 'ACTIVITY' })).toBe('ACTIVITY');
    expect(courseKindOf({ code: 'ว30103', name: 'ชีววิทยาพื้นฐาน' })).toBe('NORMAL');
    expect(courseKindOf({ code: 'X1', name: 'PLC' })).toBe('EXEMPT');
    expect(courseKindOf({ code: 'X2', name: 'CZ' })).toBe('EXEMPT');
    expect(courseKindOf({ code: 'ก99', name: 'Cleaning Zone' })).toBe('EXEMPT');
  });
  it('parseWeeks', () => {
    expect(parseWeeks('1-2')).toEqual([1, 2]);
    expect(parseWeeks('5')).toEqual([5, 5]);
    expect(parseWeeks('3 – 5')).toEqual([3, 5]);
    expect(parseWeeks('5-3')).toBeNull();
    expect(parseWeeks('0')).toBeNull();
    expect(parseWeeks('abc')).toBeNull();
  });
  it('รหัสวิชาเดียวกันหลายห้องรวมเป็น 1 กลุ่ม (ใช้ร่วมทุกห้อง)', () => {
    const g = groupCoursesByCode([
      { code: 'ว30103', name: 'ชีววิทยา', level: 'ม.4/2' }, { code: 'ว30103', name: 'ชีววิทยา', level: 'ม.4/1' },
      { code: 'ว30103', name: 'ชีววิทยา', level: 'ม.4/1' }, { code: 'ก33905', name: 'แนะแนว', level: 'ม.4/1' }, { code: '', name: 'ไม่มีรหัส', level: 'ม.4/1' },
    ]);
    expect(g).toHaveLength(2);
    expect(g.find(x => x.code === 'ว30103')!.levels).toEqual(['ม.4/1', 'ม.4/2']);
    expect(levelLabelOf(['ม.4/1', 'ม.4/2', 'ม.5/1'])).toBe('ม.4, ม.5');
  });
  it('validate/ready/coverage', () => {
    expect(validateProject(base)).toEqual([]);
    expect(validateProject({ ...base, units: [{ ...base.units[0], weeks: 'x' }] })[0]).toMatch(/สัปดาห์/);
    expect(validateProject({ ...base, indicators: Array(31).fill('a') })[0]).toMatch(/ตัวชี้วัด/);
    expect(validateProject({ ...base, units: [{ ...base.units[0], hours: 200 }] })[0]).toMatch(/ชั่วโมง/);
    expect(isProjectReady(base)).toBe(true);
    expect(isProjectReady({ ...base, indicators: [' '] })).toBe(false);
    expect(isProjectReady({ ...base, units: [emptyUnit('EXAM')] })).toBe(false);
    const groups = groupCoursesByCode([{ code: 'ว30103', name: 'a', level: 'ม.4/1' }, { code: 'ค30101', name: 'b', level: 'ม.4/1' }, { code: 'ก33905', name: 'c', level: 'ม.4/1' }]);
    const cov = projectCoverage(groups, [{ courseKey: 'ว30103', ...base } as unknown as TeachingProject]);
    expect(cov).toEqual({ required: 2, done: 1, missing: ['ค30101'] });
    expect(assessmentTotal([{ label: 'a', percent: 70 }, { label: 'b', percent: 30 }])).toBe(100);
    expect(unitLabel({ weeks: '3-5', title: 'เซลล์' })).toBe('สัปดาห์ 3-5 · เซลล์');
  });
  it('unit id ไม่ซ้ำ', () => { expect(new Set(Array.from({ length: 50 }, () => emptyUnit().id)).size).toBe(50); });
});

describe('teaching project wiring guards', () => {
  it('rules มีบล็อก teaching_projects และ id คอลเลกชันตรงกับ service', () => {
    expect(readSource('firestore.rules')).toMatch(/match \/teaching_projects\/\{pid\}/);
    expect(readSource('src/services/teachingProjectService.ts')).toContain("'teaching_projects'");
  });
  it('บันทึกหลังสอนเชื่อมโครงการสอน (PlanUnitPicker + ฟิลด์ plan*) และล้างค่าเมื่อปิด', () => {
    const tp = readSource('src/TeacherPortal.tsx');
    expect(tp).toMatch(/<PlanUnitPicker/);
    expect(tp).toMatch(/planUnitIds: ptPlan\.unitIds/);
    expect(tp).toMatch(/MyTeachingProjectsPanel/);
    expect(readSource('src/types.ts')).toMatch(/planUnitIds\?: string\[\]/);
  });
  it('มุมมองผู้ตรวจโครงการสอนอ่านอย่างเดียว (ไม่เรียกฟังก์ชันเขียน)', () => {
    expect(readSource('src/components/teachingproject/TeachingProjectsOverview.tsx')).not.toMatch(/saveTeachingProject|deleteTeachingProject/);
  });
});

describe('ค่าเริ่มต้นหน่วยกิต/ชั่วโมงของโครงการสอนจากจำนวนคาบ', () => {
  it('นับคาบต่อห้อง (ห้องที่คาบมากสุด ไม่รวมข้ามห้อง) และเติม 1 คาบ = 1 ชม. = 0.5 นก.', () => {
    const g = groupCoursesByCode([
      { code: 'ว21101', name: 'วิทย์', level: 'ม.2/1', room: 'ม.2/1', schedule: 'จันทร์ คาบ 1' },
      { code: 'ว21101', name: 'วิทย์', level: 'ม.2/1', room: 'ม.2/1', schedule: 'พุธ คาบ 3' },
      { code: 'ว21101', name: 'วิทย์', level: 'ม.2/1', room: 'ม.2/1', schedule: 'พุธ คาบ 3' },
      { code: 'ว21101', name: 'วิทย์', level: 'ม.2/2', room: 'ม.2/2', schedule: 'อังคาร คาบ 2' },
    ])[0];
    expect(g.periodsPerWeek).toBe(2);
    expect(prefillCreditsHours(g)).toEqual({ credits: '1', hoursPerWeek: '2' });
  });
  it('วิชากิจกรรมไม่มีหน่วยกิต แต่ใส่ชั่วโมงได้; ไม่รู้คาบ = ว่าง', () => {
    expect(prefillCreditsHours({ code: 'ก21901', periodsPerWeek: 1 })).toEqual({ credits: '', hoursPerWeek: '1' });
    expect(prefillCreditsHours({ code: 'ค21101', periodsPerWeek: 0 })).toEqual({ credits: '', hoursPerWeek: '' });
    expect(prefillCreditsHours({ code: 'ค21101', periodsPerWeek: 3 }).credits).toBe('1.5');
  });
});
