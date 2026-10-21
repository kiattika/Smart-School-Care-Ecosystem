import { describe, it, expect } from 'vitest';
import { lessonPlanReviewNotice, supervisionResultNotice, conductDecisionNotice, STAFF_NOTIFICATION_KINDS } from '../lib/staffNotifications';
import { messageTarget } from '../lib/bellNavigation';
import { readSource } from './helpers/readSource';

describe('ข้อความแจ้งผลถึงครูเจ้าของเรื่อง', () => {
  const plan = { id: 'p1', courseName: 'คณิตศาสตร์', courseCode: 'ค32101', level: 'ม.5' };

  it('ตรวจแผน: ผ่านขั้นสุดท้าย / ผ่านขั้นหัวหน้ากลุ่ม / ขอให้แก้ไข', () => {
    const fin = lessonPlanReviewNotice(plan, 'FINAL', 'APPROVE', 'นิเทศ', '', 'T@School.ac.th');
    expect(fin?.kind).toBe('LESSON_PLAN_REVIEW');
    expect(fin?.recipientEmail).toBe('t@school.ac.th');
    expect(fin?.title).toContain('ผ่านการตรวจครบ');
    expect(lessonPlanReviewNotice(plan, 'DEPT', 'APPROVE', 'หัวหน้า', 'ดีมาก', 't@school.ac.th')?.message).toContain('ดีมาก');
    const rev = lessonPlanReviewNotice(plan, 'DEPT', 'REVISE', 'หัวหน้า', 'เพิ่มตัวชี้วัด', 't@school.ac.th');
    expect(rev?.title).toContain('ขอให้แก้ไข');
    expect(rev?.message).toContain('เพิ่มตัวชี้วัด');
  });

  it('ผลนิเทศ: แจ้งให้กดรับทราบ', () => {
    const n = supervisionResultNotice({ id: 'o1', courseName: 'ฟิสิกส์', observedDate: '2026-10-20' }, 'ครูนิเทศ', 't@school.ac.th');
    expect(n?.kind).toBe('SUPERVISION_RESULT');
    expect(n?.title).toContain('กดรับทราบ');
    expect(n?.message).toContain('ฟิสิกส์');
  });

  it('ผลพิจารณาคะแนนความประพฤติ: รายการ/คำร้อง × อนุมัติ/ไม่อนุมัติ', () => {
    const a = conductDecisionNotice('ENTRY', true, 'ด.ช.ก', 'งานกิจการ', '', 'e1', 't@school.ac.th');
    expect(a?.title).toContain('อนุมัติรายการคะแนนความประพฤติ');
    const r = conductDecisionNotice('CHANGE', false, 'ด.ช.ก', 'งานกิจการ', 'ข้อมูลไม่พอ', 'c1', 't@school.ac.th');
    expect(r?.title).toContain('ไม่อนุมัติคำร้อง');
    expect(r?.message).toContain('ข้อมูลไม่พอ');
  });

  it('ไม่มีอีเมลผู้รับ = ไม่สร้างข้อความ (ไม่เดา)', () => {
    expect(lessonPlanReviewNotice(plan, 'FINAL', 'APPROVE', '', '', '')).toBeNull();
    expect(supervisionResultNotice({ id: 'o1' }, 'x', '')).toBeNull();
    expect(conductDecisionNotice('ENTRY', true, '', 'x', '', 'e', 'not-an-email')).toBeNull();
  });

  it('ชนิดใหม่อยู่ในรายการชนิดที่ตรงกับ rules และกระดิ่งพาไปแท็บของครู', () => {
    for (const k of ['LESSON_PLAN_REVIEW', 'SUPERVISION_RESULT', 'CONDUCT_DECISION'] as const) {
      expect(STAFF_NOTIFICATION_KINDS).toContain(k);
      expect(readSource('firestore.rules.comments')).toContain(`'${k}'`);
      expect(messageTarget(k, ['SUBJECT_TEACHER'])).not.toBeNull();
    }
    expect(messageTarget('LESSON_PLAN_REVIEW', ['SUBJECT_TEACHER'])?.tab).toBe('my-lesson-plans');
    expect(messageTarget('SUPERVISION_RESULT', ['SUBJECT_TEACHER'])?.tab).toBe('my-supervision');
    expect(messageTarget('CONDUCT_DECISION', ['SUBJECT_TEACHER'])?.tab).toBe('conduct');
  });

  it('ต่อสายในบริการ: ส่งหลังงานหลักสำเร็จ (non-fatal) และไม่แจ้งตัวเอง', () => {
    expect(readSource('src/services/lessonPlanService.ts')).toContain('lessonPlanReviewNotice(');
    expect(readSource('src/services/supervisionService.ts')).toMatch(/if \(opts\.submit\) \{\s*void notifyStaffById/);
    const c = readSource('src/services/conductService.ts');
    expect(c).toContain("conductDecisionNotice('ENTRY'");
    expect(c).toContain("conductDecisionNotice('CHANGE'");
    expect(c).toContain('!== actor.staffId');
    // ผู้แจ้งต้องไม่ throw ทับงานหลัก
    expect(readSource('src/services/staffNotify.ts')).toMatch(/catch \(err\)[\s\S]*console\.warn\('\[notifyStaffById\] failed'/);
  });
});
