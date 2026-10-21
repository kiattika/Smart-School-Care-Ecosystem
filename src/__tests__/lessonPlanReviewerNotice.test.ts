import { describe, it, expect } from 'vitest';
import { nextReviewerStaffIds } from '../lib/lessonPlans';
import { lessonPlanSubmittedNotice, STAFF_NOTIFICATION_KINDS } from '../lib/staffNotifications';
import { messageTarget, acceptBellNav } from '../lib/bellNavigation';
import { readSource } from './helpers/readSource';

const STAFF = [
  { id: 't1', roles: ['SUBJECT_TEACHER'], assignments: { departmentId: 'math' } },
  { id: 'hod-math', roles: ['SUBJECT_TEACHER', 'HEAD_OF_DEPARTMENT'], assignments: { departmentId: 'math' } },
  { id: 'dep-math', roles: ['DEPUTY_HEAD_OF_DEPARTMENT'], assignments: { departmentId: 'math' } },
  { id: 'hod-thai', roles: ['HEAD_OF_DEPARTMENT'], assignments: { departmentId: 'thai' } },
  { id: 'sup1', roles: ['INSTRUCTIONAL_SUPERVISOR'] },
  { id: 'sup-off', roles: ['INSTRUCTIONAL_SUPERVISOR'], status: 'INACTIVE' },
];

describe('nextReviewerStaffIds', () => {
  it('ขั้นแรก: หัวหน้า/รองหัวหน้ากลุ่มสาระฯ ของแผนกเดียวกันเท่านั้น', () => {
    expect(nextReviewerStaffIds({ teacherStaffId: 't1', departmentId: 'math' }, 'DEPT', STAFF).sort()).toEqual(['dep-math', 'hod-math']);
  });
  it('ครูเป็นหัวหน้ากลุ่มเอง หรือไม่มีแผนก → หัวหน้างานนิเทศ (ไม่รวมคนที่ปิดการใช้งาน)', () => {
    expect(nextReviewerStaffIds({ teacherStaffId: 'hod-math', departmentId: 'math' }, 'DEPT', STAFF)).toEqual(['sup1']);
    expect(nextReviewerStaffIds({ teacherStaffId: 't1', departmentId: '' }, 'DEPT', STAFF)).toEqual(['sup1']);
  });
  it('ขั้นสุดท้าย: หัวหน้างานนิเทศ และตัดผู้ลงมือออก', () => {
    expect(nextReviewerStaffIds({ teacherStaffId: 't1', departmentId: 'math' }, 'FINAL', STAFF)).toEqual(['sup1']);
    expect(nextReviewerStaffIds({ teacherStaffId: 't1', departmentId: 'math' }, 'FINAL', STAFF, ['sup1'])).toEqual([]);
  });
  it('ไม่มีผู้ตรวจ/ไม่มีทะเบียน = [] (ไม่เดา)', () => {
    expect(nextReviewerStaffIds({ teacherStaffId: 't1', departmentId: 'art' }, 'DEPT', STAFF)).toEqual([]);
    expect(nextReviewerStaffIds({ teacherStaffId: 't1', departmentId: 'math' }, 'DEPT', [])).toEqual([]);
  });
  it('ครูเจ้าของแผนไม่ได้รับแจ้งของตัวเอง', () => {
    expect(nextReviewerStaffIds({ teacherStaffId: 'hod-math', departmentId: 'math' }, 'DEPT', [{ id: 'hod-math', roles: ['HEAD_OF_DEPARTMENT', 'INSTRUCTIONAL_SUPERVISOR'], assignments: { departmentId: 'math' } }])).toEqual([]);
  });
});

describe('lessonPlanSubmittedNotice + กระดิ่ง', () => {
  const plan = { id: 'p1', courseName: 'คณิตศาสตร์', courseCode: 'ค32101', level: 'ม.5', teacherName: 'ครูก' };
  it('ข้อความตามขั้น/ส่งใหม่ และไม่มีอีเมล = null', () => {
    const d = lessonPlanSubmittedNotice(plan, 'DEPT', false, 'H@School.ac.th');
    expect(d?.kind).toBe('LESSON_PLAN_SUBMITTED');
    expect(d?.recipientEmail).toBe('h@school.ac.th');
    expect(d?.title).toContain('รอท่านตรวจ');
    expect(lessonPlanSubmittedNotice(plan, 'DEPT', true, 'h@school.ac.th')?.title).toContain('ฉบับแก้ไข');
    expect(lessonPlanSubmittedNotice(plan, 'FINAL', false, 'h@school.ac.th')?.message).toContain('หัวหน้างานนิเทศ');
    expect(lessonPlanSubmittedNotice(plan, 'DEPT', false, '')).toBeNull();
  });
  it('ชนิดใหม่ตรงกับ rules และพาผู้ตรวจไปแท็บตรวจแผนการสอน', () => {
    expect(STAFF_NOTIFICATION_KINDS).toContain('LESSON_PLAN_SUBMITTED');
    expect(readSource('firestore.rules.comments')).toContain("'LESSON_PLAN_SUBMITTED'");
    expect(readSource('firestore.rules')).toContain("'LESSON_PLAN_SUBMITTED'");
    expect(messageTarget('LESSON_PLAN_SUBMITTED', ['SUBJECT_TEACHER', 'INSTRUCTIONAL_SUPERVISOR', 'HEAD_OF_DEPARTMENT'])).toEqual({ role: 'INSTRUCTIONAL_SUPERVISOR', tab: 'plans' });
    expect(messageTarget('LESSON_PLAN_SUBMITTED', ['SUBJECT_TEACHER', 'HEAD_OF_DEPARTMENT'])).toEqual({ role: 'HEAD_OF_DEPARTMENT', tab: 'supervision-plans' });
    expect(messageTarget('LESSON_PLAN_SUBMITTED', ['SUBJECT_TEACHER'])).toBeNull();
  });
  it('พอร์ทัลปลายทางรับเป้าหมาย', () => {
    expect(acceptBellNav({ role: 'INSTRUCTIONAL_SUPERVISOR', tab: 'plans' }, 'INSTRUCTIONAL_SUPERVISOR', ['plans'])).toBe('plans');
    expect(readSource('src/components/supervision/SupervisionPortal.tsx')).toContain("useConsumeBellNav(activeRole, ['plans']");
    const ap = readSource('src/ApprovalsPortal.tsx');
    expect(ap).toContain("'supervision-plans'");
    expect(ap).toContain('startTab={supervisionStart');
  });
  it('ต่อสายในบริการ: แจ้งหลังบันทึกสำเร็จ (non-fatal) ทั้งตอนส่งและตอนผ่านขั้นแรก', () => {
    const s = readSource('src/services/lessonPlanService.ts');
    expect(s).toContain("lessonPlanSubmittedNotice(planRef, 'DEPT'");
    expect(s).toContain("lessonPlanSubmittedNotice(planRef, 'FINAL'");
    expect(s).toContain("r.stage === 'DEPT' && r.decision === 'APPROVE'");
    expect(readSource('src/components/lessonplans/MyLessonPlansPanel.tsx')).toContain('staffDirectory: staff');
    expect(readSource('src/components/lessonplans/LessonPlanReviewPanel.tsx')).toContain('staffDirectory: staff');
  });
});
