import { describe, it, expect } from 'vitest';
import { planReminders, planExpiryNotices, isStillPending, type ReqLite, type StaffLite } from '../../functions/src/lateAttendanceRemindersLogic';
import { resolveLateRequest, reviewUntilFor } from '../lib/lateAttendanceFlow';
import { readSource } from './helpers/readSource';

const bkk = (iso: string) => Date.parse(`${iso}+07:00`);
const DEADLINE = bkk('2026-10-22T00:00:00');
const staff: StaffLite[] = [
  { email: 'Head@x.ac.th', roles: ['ACADEMIC_HEAD', 'SUBJECT_TEACHER'] },
  { email: 'dep@x.ac.th', roles: ['DEPUTY_DIRECTOR_ACADEMIC'] },
  { email: 'dir@x.ac.th', roles: ['DIRECTOR'] },
  { email: 'gone@x.ac.th', roles: ['DEPUTY_DIRECTOR_ACADEMIC'], status: 'INACTIVE' },
  { email: 'sa@x.ac.th', roles: ['SUPER_ADMIN'] },
];
const req = (over: Partial<ReqLite> = {}): ReqLite => ({
  id: 'lar_1', status: 'PENDING', teacherEmail: 'T@x.ac.th', teacherName: 'ครู ก', subjectName: 'คณิต', level: 'ม.5/8', periodNumber: 3,
  teachingDate: '2026-10-21', requesterLevel: 'TEACHER', deadlineMs: DEADLINE, headStep: null, deputyStep: null, ...over,
});
const at16 = bkk('2026-10-21T16:00:00');

describe('เตือน 16:00 ถึงสามฝ่าย', () => {
  it('ยังไม่มีผู้ตัดสิน: ครู + หัวหน้า + รอง (ไม่ส่งถึง SUPER_ADMIN/คนที่ปิดการใช้งาน/ผอ.)', () => {
    const to = planReminders([req()], staff, at16).map(d => d.recipientEmail).sort();
    expect(to).toEqual(['dep@x.ac.th', 'head@x.ac.th', 't@x.ac.th']);
  });
  it('หัวหน้าอนุมัติแล้วและรองยังทบทวนได้: เตือนครู + รอง เท่านั้น', () => {
    const r = req({ headStep: { reviewUntilMs: reviewUntilFor(bkk('2026-10-21T10:00:00')) + 86_400_000 * 0 } });
    // reviewUntil = 18:00 วันเดียวกัน → ยังไม่เลยตอน 16:00
    const to = planReminders([r], staff, at16).map(d => d.recipientEmail).sort();
    expect(to).toEqual(['dep@x.ac.th', 't@x.ac.th']);
  });
  it('มีผลตัดสินของรองแล้ว / เลย 24:00 / หมดหน้าต่างทบทวน: ไม่เตือน', () => {
    expect(planReminders([req({ deputyStep: {} })], staff, at16)).toEqual([]);
    expect(planReminders([req()], staff, DEADLINE)).toEqual([]);
    expect(planReminders([req({ headStep: { reviewUntilMs: bkk('2026-10-21T15:00:00') } })], staff, at16)).toEqual([]);
  });
  it('คำขอของหัวหน้า → เตือนรอง (ไม่เตือนหัวหน้าซ้ำ); คำขอของรอง → เตือนผอ.', () => {
    const forHead = planReminders([req({ requesterLevel: 'HEAD' })], staff, at16).map(d => d.recipientEmail).sort();
    expect(forHead).toEqual(['dep@x.ac.th', 't@x.ac.th']);
    const forDep = planReminders([req({ requesterLevel: 'DEPUTY' })], staff, at16).map(d => d.recipientEmail).sort();
    expect(forDep).toEqual(['dir@x.ac.th', 't@x.ac.th']);
  });
  it('ครั้งเดียว: docId ตายตัวต่อคำขอ+ผู้รับ (ส่งซ้ำ create() จะชน)', () => {
    const a = planReminders([req()], staff, at16).map(d => d.docId);
    const b = planReminders([req()], staff, bkk('2026-10-21T16:05:00')).map(d => d.docId);
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(a.length);
  });
  it('พฤติกรรม "ยังรอ" ตรงกับตรรกะกลางฝั่ง client', () => {
    const lite = req();
    const client = { requesterLevel: 'TEACHER' as const, deadlineAt: DEADLINE };
    for (const t of [bkk('2026-10-21T09:00:00'), bkk('2026-10-21T23:59:59'), DEADLINE]) {
      const c = resolveLateRequest(client, t);
      expect(isStillPending(lite, t).awaiting).toBe(c.state === 'AWAITING');
    }
    const hs = { reviewUntilMs: bkk('2026-10-21T18:00:00') };
    const cl = { ...client, headStep: { decision: 'APPROVE' as const, role: 'ACADEMIC_HEAD' as const, byUid: 'u', byStaffId: 'H', byName: 'h', at: 0, note: '', reviewUntil: hs.reviewUntilMs } };
    for (const t of [bkk('2026-10-21T17:59:00'), bkk('2026-10-21T18:00:01')]) {
      expect(isStillPending({ ...lite, headStep: hs }, t).deputyReview).toBe(resolveLateRequest(cl, t).deputyReviewOpen);
    }
  });
});

describe('แจ้งหมดอายุ 00:10', () => {
  it('คำขอที่ไม่มีผู้ตัดสินจนเลย 24:00 แจ้งครูครั้งเดียว', () => {
    const after = DEADLINE + 10 * 60_000;
    const plans = planExpiryNotices([req()], after);
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({ recipientEmail: 't@x.ac.th', requestId: 'lar_1' });
    expect(planExpiryNotices([{ ...req(), expiredNotified: true }], after)).toEqual([]);
    expect(planExpiryNotices([req()], at16)).toEqual([]);
    expect(planExpiryNotices([req({ status: 'APPROVED', deputyStep: {} })], after)).toEqual([]);
  });
});

describe('guard: ฟังก์ชันตั้งเวลา', () => {
  it('ตั้ง 16:00 และ 00:10 เวลาไทย, เป็น v1 region เริ่มต้น, และ export จาก index', () => {
    const src = readSource('functions/src/lateAttendanceReminders.ts');
    expect(src).toContain("schedule('0 16 * * *').timeZone('Asia/Bangkok')");
    expect(src).toContain("schedule('10 0 * * *').timeZone('Asia/Bangkok')");
    expect(src).toContain("from 'firebase-functions/v1'");
    expect(readSource('functions/src/index.ts')).toContain('lateAttendanceReminder1600, lateAttendanceExpiryNotice');
  });
});
