import { describe, it, expect } from 'vitest';
import {
  initialLeaveStatus, countLeaveDays, validateLeaveForm, normalizeLeaveStatus, isLeavePending,
  canParentAcknowledge, canTeacherDecide, leaveStatusLabel, LEAVE_REASON_MAX,
} from '../lib/leaveFlow';
import { buildStaffTasks, staffTaskSources, totalStaffTasks } from '../lib/staffTasks';
import { readSource } from './helpers/readSource';

describe('สายงานใบลา (leaveFlow)', () => {
  it('สถานะเริ่มต้น: นักเรียนยื่น → รอผู้ปกครอง, ผู้ปกครองยื่น → ถึงครูทันที, ไม่มีผู้ปกครอง → ถึงครูทันที', () => {
    expect(initialLeaveStatus('student', true)).toBe('PENDING_PARENT');
    expect(initialLeaveStatus('parent', true)).toBe('PENDING_TEACHER');
    expect(initialLeaveStatus('student', false)).toBe('PENDING_TEACHER');
  });

  it('นับวันลารวมวันเริ่ม-สิ้นสุด และปฏิเสธวันที่ผิด', () => {
    expect(countLeaveDays('2026-10-13', '2026-10-13')).toBe(1);
    expect(countLeaveDays('2026-10-13', '2026-10-15')).toBe(3);
    expect(countLeaveDays('2026-10-30', '2026-11-02')).toBe(4);
    expect(countLeaveDays('2026-10-15', '2026-10-13')).toBe(0);
    expect(countLeaveDays('', '2026-10-13')).toBe(0);
    expect(countLeaveDays('2026-10-13', 'abc')).toBe(0);
  });

  it('ตรวจฟอร์ม: ต้องมีวันที่ เหตุผล และไม่เกินขีดจำกัด', () => {
    const ok = { leaveType: 'SICK' as const, startDate: '2026-10-13', endDate: '2026-10-14', reason: 'ไข้หวัด' };
    expect(validateLeaveForm(ok)).toEqual([]);
    expect(validateLeaveForm({ ...ok, startDate: '' }).length).toBeGreaterThan(0);
    expect(validateLeaveForm({ ...ok, endDate: '2026-10-01' }).length).toBeGreaterThan(0);
    expect(validateLeaveForm({ ...ok, reason: '   ' }).length).toBeGreaterThan(0);
    expect(validateLeaveForm({ ...ok, reason: 'ก'.repeat(LEAVE_REASON_MAX + 1) }).length).toBeGreaterThan(0);
    expect(validateLeaveForm({ ...ok, endDate: '2027-01-30' }).length).toBeGreaterThan(0);
  });

  it('ผู้ปกครองรับทราบได้เฉพาะ PENDING_PARENT; ครูตัดสินได้เฉพาะ PENDING_TEACHER (ข้ามขั้นไม่ได้)', () => {
    expect(canParentAcknowledge('PENDING_PARENT')).toBe(true);
    expect(canParentAcknowledge('PENDING_TEACHER')).toBe(false);
    expect(canParentAcknowledge('APPROVED')).toBe(false);
    expect(canTeacherDecide('PENDING_PARENT')).toBe(false);
    expect(canTeacherDecide('PENDING_TEACHER')).toBe(true);
    expect(canTeacherDecide('APPROVED')).toBe(false);
    expect(canTeacherDecide('REJECTED')).toBe(false);
  });

  it("ข้อมูลเก่า 'PENDING' ถือเป็นรอครู และยังนับเป็นรอดำเนินการ", () => {
    expect(normalizeLeaveStatus('PENDING')).toBe('PENDING_TEACHER');
    expect(canTeacherDecide('PENDING')).toBe(true);
    expect(isLeavePending('PENDING')).toBe(true);
    expect(isLeavePending('PENDING_PARENT')).toBe(true);
    expect(isLeavePending('APPROVED')).toBe(false);
  });

  it('ข้อความสถานะ บอกให้ชัดเมื่อไม่มีผู้ปกครองเชื่อมบัญชี', () => {
    expect(leaveStatusLabel('PENDING_PARENT')).toBe('รอผู้ปกครองรับทราบ');
    expect(leaveStatusLabel('PENDING_TEACHER')).toBe('รอครูที่ปรึกษาตรวจสอบ');
    expect(leaveStatusLabel('PENDING_TEACHER', { noParentLinked: true })).toContain('ยังไม่มีผู้ปกครอง');
    expect(leaveStatusLabel('APPROVED')).toBe('อนุมัติแล้ว');
    expect(leaveStatusLabel('REJECTED')).toBe('ไม่อนุมัติ');
  });
});

describe('กระดิ่งงานค้างของบุคลากร (staffTasks)', () => {
  const leaves = [{ status: 'PENDING_PARENT' }, { status: 'PENDING_TEACHER' }, { status: 'PENDING' }, { status: 'APPROVED' }];
  const NOW = Date.parse('2026-10-21T03:00:00Z'); // 10:00 ไทย
  const DEADLINE = Date.parse('2026-10-21T17:00:00Z'); // 24:00 ไทย
  const doneStep = { decision: 'APPROVE' as const, role: 'DEPUTY_DIRECTOR_ACADEMIC' as const, byUid: 'u', byStaffId: 'D1', byName: 'รอง', at: NOW, note: '' };
  // 2 คำขอรอพิจารณา + 1 คำขอที่รองตัดสินแล้ว (ไม่นับเป็นงานค้าง)
  const late = [
    { status: 'PENDING', requesterStaffId: 'T1', deadlineAt: DEADLINE },
    { status: 'PENDING', requesterStaffId: 'T2', deadlineAt: DEADLINE },
    { status: 'APPROVED', requesterStaffId: 'T3', deadlineAt: DEADLINE, deputyStep: doneStep },
  ];

  it('ครูที่ปรึกษา: นับเฉพาะใบลาที่ถึงตัวแล้ว (ไม่นับที่ยังรอผู้ปกครอง/จบแล้ว)', () => {
    const tasks = buildStaffTasks({ activeRole: 'HOMEROOM_TEACHER', roomLeaves: leaves, lateRequests: late });
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ kind: 'LEAVE', count: 2 });
  });
  it('หัวหน้ากลุ่มงานวิชาการ/รองผอ.กลุ่มงานวิชาการ/ผอ.สำรอง: นับคำขอเช็คชื่อย้อนหลังที่ตัวเองตัดสินได้', () => {
    for (const role of ['ACADEMIC_HEAD', 'DEPUTY_DIRECTOR_ACADEMIC', 'DIRECTOR']) {
      const tasks = buildStaffTasks({ activeRole: role, roomLeaves: leaves, lateRequests: late, myRoles: [role], myStaffId: 'X1', nowMs: NOW });
      expect(tasks).toHaveLength(1);
      expect(tasks[0]).toMatchObject({ kind: 'LATE_ATTENDANCE', count: 2 });
    }
  });
  it('SUPER_ADMIN ไม่มีงานอนุมัติเช็คชื่อย้อนหลัง และห้ามนับคำขอของตัวเอง', () => {
    expect(buildStaffTasks({ activeRole: 'SUPER_ADMIN', roomLeaves: leaves, lateRequests: late, myRoles: ['SUPER_ADMIN'], myStaffId: 'X1', nowMs: NOW })).toEqual([]);
    const own = buildStaffTasks({ activeRole: 'DEPUTY_DIRECTOR_ACADEMIC', roomLeaves: [], lateRequests: late, myRoles: ['DEPUTY_DIRECTOR_ACADEMIC'], myStaffId: 'T1', nowMs: NOW });
    expect(own[0]).toMatchObject({ count: 1 }); // คำขอ T1 ของตัวเองไม่นับ
  });
  it('บทบาทอื่นไม่ได้งานของคนอื่นไปแสดง และไม่ subscribe เกินสิทธิ์', () => {
    expect(buildStaffTasks({ activeRole: 'SUBJECT_TEACHER', roomLeaves: leaves, lateRequests: late })).toEqual([]);
    expect(staffTaskSources('SUBJECT_TEACHER')).toEqual({ leaves: false, lateRequests: false, screening: false, appointments: false, substitutes: true, chat: false, conduct: false });
    expect(staffTaskSources('HOMEROOM_TEACHER')).toEqual({ leaves: true, lateRequests: false, screening: true, appointments: true, substitutes: true, chat: true, conduct: false });
    expect(staffTaskSources('DEPUTY_DIRECTOR_ACADEMIC')).toEqual({ leaves: false, lateRequests: true, screening: false, appointments: false, substitutes: true, chat: false, conduct: false });
    expect(staffTaskSources('SUPER_ADMIN').lateRequests).toBe(false);
  });
  it('รวมจำนวนทั้งหมด', () => {
    expect(totalStaffTasks([{ kind: 'LEAVE', label: '', count: 2, where: '' }, { kind: 'LATE_ATTENDANCE', label: '', count: 3, where: '' }])).toBe(5);
    expect(totalStaffTasks([])).toBe(0);
  });
});

describe('guard: ใบลาต้องเป็นของจริงทั้งสาย', () => {
  it('store ไม่มีสถานะ/ฟังก์ชันใบลา (เดิม session-local + ผู้อนุมัติฝังชื่อ)', () => {
    const src = readSource('src/store.ts');
    expect(src).not.toMatch(/detailedLeaveRequests|submitDetailedLeave|approveDetailedLeave|leaveRequests|submitLeaveRequest|updateLeaveRequestStatus/);
    expect(src).not.toMatch(/ครูกิตติศักดิ์/);
    expect(src).not.toMatch(/isVerifiedByTeacher: true/);
  });
  it('บริการ Firestore ของใบลา throw เมื่อเขียนไม่สำเร็จ (ห้ามกลืน error แล้วแจ้งสำเร็จ)', () => {
    const src = readSource('src/services/firestoreService.ts');
    const i = src.indexOf('export async function createLeaveRequest');
    const j = src.indexOf('export function subscribeLeaveRequests');
    const block = src.slice(i, j);
    expect(block).toContain('handleFirestoreError(error, OperationType.CREATE');
    expect(block).toContain('handleFirestoreError(error, OperationType.UPDATE');
    expect(block).not.toMatch(/console\.warn\('\[(save|update)Detailed/);
  });
  it('ฟอร์มยื่นใบลา: ไม่มีวันที่/จำนวนวัน/ไฟล์แนบสมมติ และไม่มีปุ่มอนุมัติของครู', () => {
    const src = readSource('src/components/student-parent/GateAttendanceTracker.tsx');
    expect(src).not.toMatch(/2026-08-2\d|totalDays: 2|ใบรับรองแพทย์|approveDetailedLeave|อนุมัติใบลา|Random Student Picker/);
    expect(src).toMatch(/createLeaveRequest\(/);
    expect(src).toMatch(/subscribeLeaveRequests\(/);
    expect(src).toMatch(/isParentView && canParentAcknowledge/);
  });
  it('หน้าครูที่ปรึกษาอ่านใบลาจาก Firestore ตามห้องตัวเอง และใช้กล่องกลาง', () => {
    const src = readSource('src/AdvisorPortal.tsx');
    expect(src).toMatch(/subscribeLeaveRequests\(setRoomLeaves, \{ homeroomClass: myRoom \}\)/);
    expect(src).toContain('<AdvisorLeaveInbox');
    expect(src).not.toMatch(/leaveRequests|updateLeaveRequestStatus/);
    const inbox = readSource('src/components/advisor/AdvisorLeaveInbox.tsx');
    expect(inbox).toMatch(/decideLeaveRequest\(/);
    expect(inbox).toMatch(/staffId: user\.staffId/);
  });
  it('กระดิ่งงานค้างอยู่ในส่วนหัวกลางของบุคลากร', () => {
    const nav = readSource('src/components/NavbarWithRoleSwitcher.tsx');
    expect(nav).toContain('<StaffTaskBell activeRole={activeRole} onSwitchRole={onRoleChange} />');
  });
});
