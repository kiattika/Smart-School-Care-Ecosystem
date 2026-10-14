import { describe, it, expect } from 'vitest';
import { readSource } from './helpers/readSource';
import {
  PLAN_CHECKLIST, checksComplete, complianceOf, courseKeyOf, embedUrlFor, isHttpsUrl, planDocId, planOverviewQuery,
  reviewStageFor, validateSubmission,
} from '../lib/lessonPlans';

describe('lessonPlans lib', () => {
  it('courseKey/doc id ไม่มี / หรือช่องว่าง', () => {
    expect(courseKeyOf(' ท21101 / ก ')).toBe('ท21101-ก');
    expect(planDocId('2569_1', 't1', 'ท21101')).toBe('2569_1_t1_ท21101');
  });
  it('ลิงก์ต้อง https เท่านั้น', () => {
    expect(isHttpsUrl('https://a.co/x')).toBe(true);
    expect(isHttpsUrl('http://a.co/x')).toBe(false);
    expect(isHttpsUrl('https://a b')).toBe(false);
    expect(validateSubmission({ kind: 'X', url: 'https://a.co/x', note: '' })).toBeTruthy();
    expect(validateSubmission({ kind: 'PLAN', url: 'https://a.co/x', note: '' })).toBeNull();
  });
  it('embedUrlFor: Google Docs/Drive → preview, อื่นๆ null', () => {
    expect(embedUrlFor('https://docs.google.com/document/d/abc_1/edit?usp=sharing')).toBe('https://docs.google.com/document/d/abc_1/preview');
    expect(embedUrlFor('https://drive.google.com/file/d/xyz/view')).toBe('https://drive.google.com/file/d/xyz/preview');
    expect(embedUrlFor('https://drive.google.com/open?id=xyz')).toBe('https://drive.google.com/file/d/xyz/preview');
    expect(embedUrlFor('https://x.org/a.pdf')).toBe('https://x.org/a.pdf');
    expect(embedUrlFor('https://example.com/page')).toBeNull();
    expect(embedUrlFor('javascript:alert(1)')).toBeNull();
  });
  it('complianceOf: ต้องมีฉบับสมบูรณ์ ≥ 1; ฉบับที่ขอแก้ไขยังไม่นับ', () => {
    expect(complianceOf([])).toBe('NONE');
    expect(complianceOf([{ kind: 'PROJECT', stage: 'APPROVED' }])).toBe('PROJECT_ONLY');
    expect(complianceOf([{ kind: 'PLAN', stage: 'REVISION' }])).toBe('PROJECT_ONLY');
    expect(complianceOf([{ kind: 'PLAN', stage: 'SUBMITTED' }])).toBe('PLAN_SUBMITTED');
    expect(complianceOf([{ kind: 'PLAN', stage: 'APPROVED' }, { kind: 'PROJECT', stage: 'SUBMITTED' }])).toBe('PLAN_APPROVED');
  });
  it('planOverviewQuery ตามบทบาท', () => {
    expect(planOverviewQuery(['INSTRUCTIONAL_SUPERVISOR'], '')).toEqual({ scope: 'ALL' });
    expect(planOverviewQuery(['DIRECTOR'], '')).toEqual({ scope: 'ALL' });
    expect(planOverviewQuery(['HEAD_OF_DEPARTMENT'], 'D1')).toEqual({ scope: 'DEPARTMENT', departmentId: 'D1' });
    expect(planOverviewQuery(['HEAD_OF_DEPARTMENT'], '')).toBeNull();
    expect(planOverviewQuery(['EXECUTIVE'], 'D1')).toBeNull();
    expect(planOverviewQuery(['SUBJECT_TEACHER'], 'D1')).toBeNull();
  });
  it('reviewStageFor: ขั้น 1 หัวหน้า/รองในแผนก, ขั้น 2 หัวหน้างานนิเทศ, ห้ามตรวจของตนเอง', () => {
    const p = { stage: 'SUBMITTED' as const, teacherStaffId: 't1', departmentId: 'D1' };
    expect(reviewStageFor(p, { staffId: 'h', roles: ['HEAD_OF_DEPARTMENT'], departmentId: 'D1' }, false)).toBe('DEPT');
    expect(reviewStageFor(p, { staffId: 'h', roles: ['DEPUTY_HEAD_OF_DEPARTMENT'], departmentId: 'D1' }, false)).toBe('DEPT');
    expect(reviewStageFor(p, { staffId: 'h', roles: ['HEAD_OF_DEPARTMENT'], departmentId: 'D2' }, false)).toBeNull();
    expect(reviewStageFor(p, { staffId: 't1', roles: ['HEAD_OF_DEPARTMENT'], departmentId: 'D1' }, false)).toBeNull();
    expect(reviewStageFor(p, { staffId: 's', roles: ['INSTRUCTIONAL_SUPERVISOR'], departmentId: 'D3' }, false)).toBeNull();
    expect(reviewStageFor(p, { staffId: 's', roles: ['INSTRUCTIONAL_SUPERVISOR'], departmentId: 'D3' }, true)).toBe('DEPT'); // ครูเป็นหัวหน้ากลุ่มเอง
    expect(reviewStageFor({ ...p, stage: 'DEPT_APPROVED' }, { staffId: 's', roles: ['INSTRUCTIONAL_SUPERVISOR'], departmentId: 'D3' }, false)).toBe('FINAL');
    expect(reviewStageFor({ ...p, stage: 'DEPT_APPROVED' }, { staffId: 'h', roles: ['HEAD_OF_DEPARTMENT'], departmentId: 'D1' }, false)).toBeNull();
  });
  it('แบบประเมินครบ 10 ข้อ id ตรง rules', () => {
    expect(PLAN_CHECKLIST.map(c => c.id)).toEqual(['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10']);
    expect(checksComplete({ c1: 'Y' })).toBe(false);
    expect(checksComplete(Object.fromEntries(PLAN_CHECKLIST.map(c => [c.id, 'N'])))).toBe(true);
  });
});

describe('lesson plan wiring guards', () => {
  it('หน้าตรวจแสดงแผนเคียงข้างแบบประเมิน (grid 2 คอลัมน์: iframe + แบบประเมิน)', () => {
    const src = readSource('src/components/lessonplans/LessonPlanReviewPanel.tsx');
    expect(src).toMatch(/lg:grid-cols-2/);
    expect(src).toMatch(/<iframe/);
    expect(src).toMatch(/aria-label="แบบประเมินแผนการสอน"/);
  });
  it('rules checks ตรงกับ PLAN_CHECKLIST และมีบล็อกครบ', () => {
    const rules = readSource('firestore.rules');
    expect(rules).toMatch(/match \/lesson_plan_submissions\/\{oid\}/);
    for (const c of PLAN_CHECKLIST) expect(rules).toContain(`'${c.id}'`);
  });
  it('เชื่อมเมนูครู + แท็บตรวจแผนในงานนิเทศ', () => {
    expect(readSource('src/TeacherPortal.tsx')).toMatch(/MyLessonPlansPanel/);
    expect(readSource('src/components/supervision/SupervisionWorkspace.tsx')).toMatch(/LessonPlanReviewPanel/);
  });
});
