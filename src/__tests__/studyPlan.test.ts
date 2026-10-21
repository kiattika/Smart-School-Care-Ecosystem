import { describe, it, expect } from 'vitest';
import {
  buildRoster, compareWithSelfAssessment, countCompare, parseStudyPlan, planStatus, studyLevelOfRoom, summarizeRoster, validateStudyPlan,
  type StudyPlan,
} from '../lib/studyPlan';
import { readSource } from './helpers/readSource';
import * as path from 'path';

const base = { level: 'M6' as const, planType: 'UNIVERSITY' as const, portfolioUrl: '', portfolioSent: false, note: '' };
const choice = { institution: 'มหาวิทยาลัย ก', program: 'คณะ ข', round: 'R1' as const };
const mk = (over: Partial<StudyPlan> = {}): StudyPlan => ({
  studentId: 's1', studentUid: 'u1', room: 'ม.6/1', level: 'M6', academicYear: '2569', planType: 'UNIVERSITY',
  choices: [choice], portfolioUrl: '', portfolioSent: false, note: '', updatedAtMs: null, ...over,
});

describe('studyLevelOfRoom', () => {
  it('รู้จักเฉพาะ ม.3 / ม.6 (ทั้ง ม. และ M.) อื่น ๆ = null', () => {
    expect(studyLevelOfRoom('ม.6/3')).toBe('M6');
    expect(studyLevelOfRoom('M.3/10')).toBe('M3');
    expect(studyLevelOfRoom('ม.5/8')).toBeNull();
    expect(studyLevelOfRoom('ม.16/1')).toBeNull();
    expect(studyLevelOfRoom('')).toBeNull();
    expect(studyLevelOfRoom(undefined)).toBeNull();
  });
});

describe('validateStudyPlan', () => {
  it('ม.6 อุดมศึกษา: ต้องมีรายการอย่างน้อย 1 และกรอกครบ', () => {
    expect(validateStudyPlan({ ...base, choices: [choice] })).toEqual([]);
    expect(validateStudyPlan({ ...base, choices: [] })).toContain('ใส่สถาบัน/สาขาที่สนใจอย่างน้อย 1 รายการ');
    expect(validateStudyPlan({ ...base, choices: [{ ...choice, program: ' ' }] }).length).toBe(1);
    expect(validateStudyPlan({ ...base, choices: [choice, choice, choice, choice] }).some(m => m.includes('ไม่เกิน 3'))).toBe(true);
  });
  it('ลิงก์พอร์ตต้อง https; ติ๊กส่งแล้วต้องมีลิงก์', () => {
    expect(validateStudyPlan({ ...base, choices: [choice], portfolioUrl: 'http://a.b/c' }).length).toBe(1);
    expect(validateStudyPlan({ ...base, choices: [choice], portfolioUrl: 'javascript:alert(1)' }).length).toBe(1);
    expect(validateStudyPlan({ ...base, choices: [choice], portfolioSent: true }).length).toBe(1);
    expect(validateStudyPlan({ ...base, choices: [choice], portfolioUrl: 'https://drive.google.com/x', portfolioSent: true })).toEqual([]);
  });
  it('แผนที่ไม่ใช่อุดมศึกษา: ห้ามมีรายการ/พอร์ต; ประเภทต้องตรงระดับ', () => {
    expect(validateStudyPlan({ ...base, planType: 'WORK', choices: [] })).toEqual([]);
    expect(validateStudyPlan({ ...base, planType: 'WORK', choices: [choice] }).length).toBe(1);
    expect(validateStudyPlan({ ...base, level: 'M3', planType: 'UNIVERSITY', choices: [] }).length).toBe(1);
    expect(validateStudyPlan({ ...base, level: 'M3', planType: 'M4_SAME_SCHOOL', choices: [] })).toEqual([]);
  });
});

describe('roster / summary / compare', () => {
  const students = [
    { studentId: 's1', name: 'ก', room: 'ม.6/1' }, { studentId: 's2', name: 'ข', room: 'ม.6/1' },
    { studentId: 's3', name: 'ค', room: 'ม.3/2' }, { studentId: 's4', name: 'ง', room: 'ม.5/1' },
  ];
  it('นับเฉพาะ ม.3/ม.6; ไม่มีแผน = ยังไม่กรอก', () => {
    const rows = buildRoster(students, [mk({ portfolioUrl: 'https://x.y/z', portfolioSent: true })]);
    expect(rows.map(r => r.studentId).sort()).toEqual(['s1', 's2', 's3']);
    const m6 = summarizeRoster(rows, 'M6');
    expect(m6).toMatchObject({ total: 2, filled: 1, notFilled: 1, portfolioSent: 1 });
    expect(m6.byFirstRound.find(r => r.id === 'R1')?.count).toBe(1);
    expect(summarizeRoster(rows, 'M3')).toMatchObject({ total: 1, filled: 0, notFilled: 1, byFirstRound: [] });
  });
  it('planStatus และ compare ไม่ตัดสินความสอดคล้อง', () => {
    expect(planStatus(null)).toBe('NOT_FILLED');
    expect(planStatus(mk())).toBe('FILLED');
    expect(compareWithSelfAssessment(null, '  ')).toBe('NO_PLAN_NO_GOAL');
    expect(compareWithSelfAssessment(mk(), '')).toBe('PLAN_ONLY');
    expect(compareWithSelfAssessment(null, 'หมอ')).toBe('GOAL_ONLY');
    expect(compareWithSelfAssessment(mk(), 'หมอ')).toBe('BOTH');
    expect(countCompare([{ compare: 'BOTH' }, { compare: 'BOTH' }, { compare: 'GOAL_ONLY' }])).toMatchObject({ BOTH: 2, GOAL_ONLY: 1, PLAN_ONLY: 0 });
  });
});

describe('parseStudyPlan', () => {
  it('เอกสารผิดรูปแบบ = null (ไม่เดา)', () => {
    expect(parseStudyPlan('x', undefined)).toBeNull();
    expect(parseStudyPlan('x', { level: 'M6', planType: 'M4_SAME_SCHOOL' })).toBeNull();
    expect(parseStudyPlan('x', { level: 'M5', planType: 'WORK' })).toBeNull();
  });
  it('รอบ TCAS ที่ไม่รู้จัก → ยังไม่แน่ใจ', () => {
    const p = parseStudyPlan('s9', { level: 'M6', planType: 'UNIVERSITY', choices: [{ institution: 'a', program: 'b', round: 'ZZ' }], room: 'ม.6/1' });
    expect(p?.choices[0].round).toBe('UNSURE');
    expect(p?.studentId).toBe('s9');
  });
});

describe('rules ตรงกับ lib', () => {
  const rules = readSource(path.resolve(__dirname, '../../firestore.rules'));
  const block = rules.slice(rules.indexOf('match /student_study_plans/'), rules.indexOf('match /user_preferences/'));
  it('rules มี planType ครบตามที่ lib ยอมรับ และไม่มีให้ผู้ปกครอง/SUPER_ADMIN เขียนหรืออ่านรายบุคคล', () => {
    for (const id of ['UNIVERSITY', 'VOCATIONAL', 'WORK', 'OTHER', 'UNDECIDED', 'M4_SAME_SCHOOL', 'M4_OTHER_SCHOOL']) expect(block).toContain(`'${id}'`);
    expect(block).not.toContain("hasRole('SUPER_ADMIN')");
    expect(block).not.toMatch(/isSignedIn\(\)\s*\)?\s*;/);
    expect(block).toContain('allow delete: if false;');
  });
});
