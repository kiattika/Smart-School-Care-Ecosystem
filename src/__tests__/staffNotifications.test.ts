import { describe, it, expect } from 'vitest';
import {
  buildStaffNotification, lateAttendanceDecisionNotice, substituteUpdateNotices,
  STAFF_NOTIFICATION_TITLE_MAX, STAFF_NOTIFICATION_MESSAGE_MAX,
} from '../lib/staffNotifications';
import { invoiceIssuedNotice, slipVerifiedNotice, slipRejectedNotice, portfolioDecisionNotice } from '../lib/studentNotices';
import { buildStaffTasks, totalStaffTasks } from '../lib/staffTasks';
import { readSource } from './helpers/readSource';

const sub = { id: 's1', courseName: 'คณิต', room: 'ม.5/8', date: '2026-10-20', periodName: 'คาบ 3',
  originalTeacherEmail: 'Orig@school.ac.th', substituteTeacherEmail: 'sub@school.ac.th', proposedByEmail: 'prop@school.ac.th' };

describe('staffNotifications (ข้อความถึงบุคลากร)', () => {
  it('normalize อีเมลผู้รับ, ตัดความยาว, ไม่ส่งเมื่อไม่มีอีเมลที่ใช้ได้', () => {
    const d = buildStaffNotification({ recipientEmail: ' Me@School.ac.th ', kind: 'SUBSTITUTE_UPDATE', title: 'ก'.repeat(300), message: 'ข'.repeat(900), refId: 'x' })!;
    expect(d.recipientEmail).toBe('me@school.ac.th');
    expect(d.title.length).toBe(STAFF_NOTIFICATION_TITLE_MAX);
    expect(d.message.length).toBe(STAFF_NOTIFICATION_MESSAGE_MAX);
    expect(buildStaffNotification({ recipientEmail: '', kind: 'SUBSTITUTE_UPDATE', title: 't', message: 'm', refId: 'x' })).toBeNull();
    expect(buildStaffNotification({ recipientEmail: 'abc', kind: 'SUBSTITUTE_UPDATE', title: 't', message: 'm', refId: 'x' })).toBeNull();
  });
  it('คำขอเช็คชื่อย้อนหลัง: ส่งถึงครูผู้ยื่น พร้อมเหตุผลเมื่อไม่อนุมัติ', () => {
    const req = { id: 'r1', teacherEmail: 'T@school.ac.th', subjectName: 'ฟิสิกส์', level: 'ม.4', periodNumber: 2, teachingDate: '2026-10-01' };
    const ok = lateAttendanceDecisionNotice(req, 'APPROVED', 'รองผอ.')!;
    expect(ok.recipientEmail).toBe('t@school.ac.th');
    expect(ok.title).toContain('อนุมัติ');
    const no = lateAttendanceDecisionNotice(req, 'REJECTED', 'รองผอ.', 'เกินกำหนด')!;
    expect(no.message).toContain('เกินกำหนด');
    expect(lateAttendanceDecisionNotice({ ...req, teacherEmail: undefined }, 'APPROVED', 'x')).toBeNull();
  });
  it('สอนแทน: ครูยืนยัน/ปฏิเสธ → แจ้งเฉพาะผู้เสนอ; ปฏิเสธขั้นอนุมัติ → ผู้เสนอ+ครูสอนแทน+ครูเจ้าของคาบ; ไม่แจ้งตัวเอง ไม่ซ้ำ', () => {
    const c = substituteUpdateNotices(sub, { type: 'TEACHER_CONFIRMED' }, 'ครูแทน', 'sub@school.ac.th');
    expect(c.map(x => x.recipientEmail)).toEqual(['prop@school.ac.th']);
    const d = substituteUpdateNotices(sub, { type: 'TEACHER_DECLINED', reason: 'ติดธุระ' }, 'ครูแทน', 'sub@school.ac.th');
    expect(d[0].message).toContain('ติดธุระ');
    const r = substituteUpdateNotices(sub, { type: 'REJECTED', stageLabel: 'ขั้น 2', reason: 'ไม่เหมาะสม' }, 'หัวหน้า', 'head@school.ac.th');
    expect(r.map(x => x.recipientEmail).sort()).toEqual(['orig@school.ac.th', 'prop@school.ac.th', 'sub@school.ac.th']);
    const dup = substituteUpdateNotices({ ...sub, proposedByEmail: 'ORIG@school.ac.th' }, { type: 'REJECTED', stageLabel: 's', reason: '' }, 'x', 'head@school.ac.th');
    expect(dup).toHaveLength(2);
  });
  it('สอนแทน: อนุมัติระหว่างขั้น → ผู้เสนอเท่านั้น; ครบทุกขั้น → ทุกคน', () => {
    expect(substituteUpdateNotices(sub, { type: 'STAGE_APPROVED', stageLabel: 'ขั้น 1', completed: false }, 'x', 'h@school.ac.th')).toHaveLength(1);
    expect(substituteUpdateNotices(sub, { type: 'STAGE_APPROVED', stageLabel: 'ขั้น 4', completed: true }, 'x', 'h@school.ac.th')).toHaveLength(3);
  });
});

describe('กระดิ่ง: งานสอนแทน', () => {
  const base = { roomLeaves: [], lateRequests: [] };
  const subs = [
    { status: 'PENDING_APPROVAL', currentApprovalStage: 'STAGE_2_ACADEMIC_HEAD' },
    { status: 'PENDING_APPROVAL', currentApprovalStage: 'STAGE_1_HEAD_OF_DEPARTMENT' },
    { status: 'PENDING_TEACHER_CONFIRMATION', substituteTeacherEmail: 'Me@school.ac.th' },
    { status: 'PENDING_TEACHER_CONFIRMATION', substituteTeacherEmail: 'other@school.ac.th' },
    { status: 'APPROVED', currentApprovalStage: 'COMPLETED' },
  ];
  it('ผู้อนุมัติเห็นเฉพาะรายการในขั้นของบทบาทตัวเอง', () => {
    const t = buildStaffTasks({ ...base, activeRole: 'ACADEMIC_HEAD', substitutes: subs });
    expect(t.find(x => x.kind === 'SUBSTITUTE_APPROVAL')?.count).toBe(1);
  });
  it('ครูเห็นคำขอที่รอตนยืนยัน (จับคู่อีเมลไม่สนตัวพิมพ์)', () => {
    const t = buildStaffTasks({ ...base, activeRole: 'SUBJECT_TEACHER', substitutes: subs, myEmail: 'me@SCHOOL.ac.th' });
    expect(t.map(x => x.kind)).toEqual(['SUBSTITUTE_CONFIRM']);
    expect(totalStaffTasks(t)).toBe(1);
    expect(buildStaffTasks({ ...base, activeRole: 'SUBJECT_TEACHER', substitutes: subs })).toEqual([]);
  });
});

describe('ข้อความแจ้งเตือนฝั่งนักเรียน (studentNotices)', () => {
  it('การเงิน: ออกบิล/ยืนยันชำระ/สลิปไม่ผ่าน (มีเหตุผล)', () => {
    expect(invoiceIssuedNotice({ title: 'ค่าเทอม', totalAmount: 1500, dueDate: '2026-11-01' }).message).toContain('1,500');
    expect(slipVerifiedNotice({ title: 'ค่าเทอม', invoiceNumber: 'INV-2569-0001' }).message).toContain('INV-2569-0001');
    const r = slipRejectedNotice({ title: 'ค่าเทอม', invoiceNumber: 'INV-1' }, 'ยอดไม่ตรง');
    expect(r.type).toBe('warning');
    expect(r.message).toContain('ยอดไม่ตรง');
  });
  it('แฟ้มสะสมผลงาน: อนุมัติ/ไม่อนุมัติพร้อมเหตุผล', () => {
    expect(portfolioDecisionNotice({ title: 'รางวัล A' }, 'APPROVED', 'ครู').type).toBe('info');
    expect(portfolioDecisionNotice({ title: 'รางวัล A' }, 'REJECTED', 'ครู', 'หลักฐานไม่ชัด').message).toContain('หลักฐานไม่ชัด');
  });
  it('ไม่มีข้อความแจ้งนักเรียนเรื่อง 9Q (ข้อมูลอ่อนไหว)', () => {
    expect(readSource('src/lib/studentNotices.ts')).not.toMatch(/9Q|NINE_Q/);
  });
});

describe('guard: ข้อความอนุมัติ + แจ้งเตือนนักเรียนต้องต่อจริง', () => {
  it('createParentNotification ข้ามเฉพาะเมื่อไม่มีผู้รับเลย (นักเรียนไม่มีผู้ปกครองยังได้รับ)', () => {
    const src = readSource('src/services/firestoreService.ts');
    expect(src).toMatch(/if \(!parentUid && !studentUid\)/);
  });
  it('รายการอนุมัติเรียก sendStaffNotifications หลังบันทึกสำเร็จ (ไม่กลืน error ของงานหลัก)', () => {
    expect(readSource('src/components/LateAttendanceApprovalList.tsx')).toMatch(/sendStaffNotifications\(\[lateAttendanceDecisionNotice/);
    const store = readSource('src/store.ts');
    expect(store).toMatch(/substituteUpdateNotices\(/);
    expect((store.match(/sendStaffNotifications\(/g) || []).length).toBeGreaterThanOrEqual(2);
  });
  it('ใบลา: ครูตัดสินแจ้งนักเรียนแม้ไม่มีผู้ปกครอง และผู้ปกครองรับทราบแล้วแจ้งนักเรียน', () => {
    expect(readSource('src/components/advisor/AdvisorLeaveInbox.tsx')).not.toMatch(/if \(leave\.parentUid\)/);
    expect(readSource('src/components/student-parent/GateAttendanceTracker.tsx')).toMatch(/ผู้ปกครองรับทราบใบลาแล้ว/);
  });
  it('การเงิน/แฟ้มสะสมผลงานแจ้งนักเรียน', () => {
    const fin = readSource('src/components/finance/FinancePortal.tsx');
    expect(fin).toMatch(/invoiceIssuedNotice\(/);
    expect(fin).toMatch(/slipVerifiedNotice\(/);
    expect(fin).toMatch(/slipRejectedNotice\(/);
    expect(readSource('src/components/portfolio/AdvisorPortfolioReview.tsx')).toMatch(/portfolioDecisionNotice\(/);
  });
  it('กระดิ่งแสดงส่วนข้อความและทำเครื่องหมายอ่านแล้ว', () => {
    const bell = readSource('src/components/notifications/StaffTaskBell.tsx');
    expect(bell).toMatch(/subscribeStaffNotifications\(/);
    expect(bell).toMatch(/markStaffNotificationRead\(/);
  });
});
