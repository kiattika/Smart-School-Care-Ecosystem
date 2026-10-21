import { describe, it, expect, beforeEach } from 'vitest';
import { acceptBellNav, taskTarget, messageTarget, useBellNav } from '../lib/bellNavigation';
import { readSource } from './helpers/readSource';
import type { ChatThreadLike } from '../lib/classChat';

describe('bellNavigation — เป้าหมายของงานค้าง', () => {
  it('ใบลา/นัดพบ/คัดกรอง ของครูที่ปรึกษา → พอร์ทัลครูที่ปรึกษา', () => {
    expect(taskTarget('LEAVE', 'HOMEROOM_TEACHER', ['HOMEROOM_TEACHER'])).toEqual({ role: 'HOMEROOM_TEACHER', tab: 'dashboard' });
    expect(taskTarget('APPOINTMENT', 'HOMEROOM_TEACHER', [])).toEqual({ role: 'HOMEROOM_TEACHER', tab: 'dashboard' });
    expect(taskTarget('SCREENING_RED_FLAG', 'HOMEROOM_TEACHER', [])).toEqual({ role: 'HOMEROOM_TEACHER', tab: 'screening' });
  });

  it('ครูแนะแนว: นัดพบ → appointments, คัดกรอง → depression', () => {
    expect(taskTarget('APPOINTMENT', 'GUIDANCE_COUNSELOR', [])).toEqual({ role: 'GUIDANCE_COUNSELOR', tab: 'appointments' });
    expect(taskTarget('SCREENING_2Q', 'GUIDANCE_COUNSELOR', [])).toEqual({ role: 'GUIDANCE_COUNSELOR', tab: 'depression' });
  });

  it('คำขอเช็คชื่อย้อนหลัง → บทบาทผู้อนุมัติ (ใช้บทบาทปัจจุบันก่อน; ไม่มีบทบาทอนุมัติ = ไม่พาไป ไม่เดา)', () => {
    expect(taskTarget('LATE_ATTENDANCE', 'DEPUTY_DIRECTOR_ACADEMIC', ['ACADEMIC_HEAD', 'DEPUTY_DIRECTOR_ACADEMIC'])).toEqual({ role: 'DEPUTY_DIRECTOR_ACADEMIC', tab: 'late-attendance' });
    expect(taskTarget('LATE_ATTENDANCE', 'SUBJECT_TEACHER', ['SUBJECT_TEACHER', 'ACADEMIC_HEAD'])).toEqual({ role: 'ACADEMIC_HEAD', tab: 'late-attendance' });
    expect(taskTarget('LATE_ATTENDANCE', 'SUBJECT_TEACHER', ['SUBJECT_TEACHER'])).toBeNull();
    // SUPER_ADMIN ไม่มีสิทธิ์อนุมัติ
    expect(taskTarget('LATE_ATTENDANCE', 'SUPER_ADMIN', ['SUPER_ADMIN'])).toBeNull();
  });

  it('สอนแทน: รออนุมัติ → แท็บ substitute ของบทบาทปัจจุบัน; รอยืนยัน → ครูผู้สอน', () => {
    expect(taskTarget('SUBSTITUTE_APPROVAL', 'ACADEMIC_HEAD', [])).toEqual({ role: 'ACADEMIC_HEAD', tab: 'substitute' });
    expect(taskTarget('SUBSTITUTE_CONFIRM', 'ACADEMIC_HEAD', ['ACADEMIC_HEAD', 'SUBJECT_TEACHER'])).toEqual({ role: 'SUBJECT_TEACHER', tab: 'substitutions' });
    expect(taskTarget('SUBSTITUTE_CONFIRM', 'ACADEMIC_HEAD', ['ACADEMIC_HEAD'])).toBeNull();
  });

  it('ข้อความ: ผลคำขอ → ครู; เตือน 16:00 → ผู้อนุมัติถ้ามีบทบาท ไม่งั้นครู', () => {
    expect(messageTarget('LATE_ATTENDANCE_DECISION', ['SUBJECT_TEACHER'])).toEqual({ role: 'SUBJECT_TEACHER', tab: 'courses' });
    expect(messageTarget('LATE_ATTENDANCE_REMINDER', ['SUBJECT_TEACHER', 'ACADEMIC_HEAD'])).toEqual({ role: 'ACADEMIC_HEAD', tab: 'late-attendance' });
    expect(messageTarget('LATE_ATTENDANCE_REMINDER', ['SUBJECT_TEACHER'])).toEqual({ role: 'SUBJECT_TEACHER', tab: 'courses' });
    expect(messageTarget('SUBSTITUTE_UPDATE', ['SUBJECT_TEACHER'])).toEqual({ role: 'SUBJECT_TEACHER', tab: 'substitutions' });
    expect(messageTarget('SUBSTITUTE_UPDATE', ['EXECUTIVE'])).toBeNull();
  });
});

describe('bellNavigation — การรับเป้าหมาย', () => {
  beforeEach(() => useBellNav.getState().clear());

  it('state เริ่มต้นเป็น null', () => {
    expect(useBellNav.getState().target).toBeNull();
  });

  it('รับเฉพาะเป้าหมายของบทบาทตัวเองและแท็บที่พอร์ทัลรองรับ', () => {
    const t = { role: 'GUIDANCE_COUNSELOR', tab: 'appointments' };
    expect(acceptBellNav(t, 'GUIDANCE_COUNSELOR', ['appointments', 'depression'])).toBe('appointments');
    expect(acceptBellNav(t, 'HOMEROOM_TEACHER', ['appointments'])).toBeNull();
    expect(acceptBellNav(t, 'GUIDANCE_COUNSELOR', ['depression'])).toBeNull();
    expect(acceptBellNav(null, 'GUIDANCE_COUNSELOR', ['appointments'])).toBeNull();
  });

  it('go / clear', () => {
    useBellNav.getState().go({ role: 'X', tab: 'y' });
    expect(useBellNav.getState().target).toEqual({ role: 'X', tab: 'y' });
    useBellNav.getState().clear();
    expect(useBellNav.getState().target).toBeNull();
  });
});

describe('bellNavigation — การต่อสายใน UI (guard)', () => {
  it('Navbar ส่ง onRoleChange ให้กระดิ่ง และกระดิ่งตั้งเป้าหมายก่อนสลับบทบาท', () => {
    expect(readSource('src/components/NavbarWithRoleSwitcher.tsx')).toContain('<StaffTaskBell activeRole={activeRole} onSwitchRole={onRoleChange} />');
    const bell = readSource('src/components/notifications/StaffTaskBell.tsx');
    expect(bell.indexOf('goNav(t);')).toBeGreaterThan(-1);
    expect(bell.indexOf('goNav(t);')).toBeLessThan(bell.indexOf('onSwitchRole?.('));
    // ไปได้เฉพาะบทบาทที่มีจริง
    expect(bell).toContain('myRoles.includes(t.role)');
  });

  it('พอร์ทัลปลายทางทั้ง 4 รับเป้าหมายด้วย useConsumeBellNav', () => {
    for (const f of ['src/AdvisorPortal.tsx', 'src/TeacherPortal.tsx', 'src/ApprovalsPortal.tsx', 'src/components/guidance/GuidancePortal.tsx']) {
      expect(readSource(f), f).toContain('useConsumeBellNav(');
    }
  });
});

describe('แจ้งเตือนแชทแบบรวมในกระดิ่ง', () => {
  const t = (over: Record<string, unknown>) => ({ lastAt: '2026-10-21T08:00:00Z', lastSenderRole: 'PARENT', teacherLastReadAt: '2026-10-21T07:00:00Z', ...over }) as ChatThreadLike & { targetStaffId?: string };

  it('นับเป็นบรรทัดเดียว = จำนวนห้องสนทนาที่ยังไม่อ่านของฉัน', async () => {
    const { buildStaffTasks } = await import('../lib/staffTasks');
    const base = { activeRole: 'HOMEROOM_TEACHER', roomLeaves: [], lateRequests: [], myStaffId: 'tch-1' };
    const tasks = buildStaffTasks({
      ...base,
      chatThreads: [
        t({}),                                                    // ยังไม่อ่าน ✔
        t({ lastSenderRole: 'STUDENT' }),                          // ยังไม่อ่าน ✔
        t({ teacherLastReadAt: '2026-10-21T09:00:00Z' }),          // อ่านแล้ว
        t({ lastSenderRole: 'TEACHER' }),                          // ครูส่งเอง
        t({ targetStaffId: 'tch-2' }),                             // ส่งถึงครูท่านอื่น
      ],
    });
    const chat = tasks.filter((x) => x.kind === 'CHAT_UNREAD');
    expect(chat).toHaveLength(1);
    expect(chat[0].count).toBe(2);
  });

  it('บทบาทอื่นไม่เห็น และพาไปแท็บแชทของครูที่ปรึกษา', async () => {
    const { buildStaffTasks } = await import('../lib/staffTasks');
    expect(buildStaffTasks({ activeRole: 'SUBJECT_TEACHER', roomLeaves: [], lateRequests: [], chatThreads: [t({})] }).some((x) => x.kind === 'CHAT_UNREAD')).toBe(false);
    expect(taskTarget('CHAT_UNREAD', 'HOMEROOM_TEACHER', [])).toEqual({ role: 'HOMEROOM_TEACHER', tab: 'class-chat' });
  });
});

describe('ขาดเรียนต่อเนื่อง ในกระดิ่ง', () => {
  it('ครูที่ปรึกษา/กิจการ/แนะแนวเห็นเป็นจำนวน; บทบาทอื่นไม่เห็น; กดแล้วพาไปแท็บของบทบาทนั้น', async () => {
    const { buildStaffTasks } = await import('../lib/staffTasks');
    const base = { roomLeaves: [], lateRequests: [], absence: { count: 3 } };
    for (const role of ['HOMEROOM_TEACHER', 'STUDENT_AFFAIRS', 'GUIDANCE_COUNSELOR']) {
      const x = buildStaffTasks({ ...base, activeRole: role }).find((k) => k.kind === 'ABSENCE_STREAK');
      expect(x?.count).toBe(3);
    }
    expect(buildStaffTasks({ ...base, activeRole: 'SUBJECT_TEACHER' }).some((k) => k.kind === 'ABSENCE_STREAK')).toBe(false);
    expect(buildStaffTasks({ ...base, activeRole: 'HOMEROOM_TEACHER', absence: { count: 0 } }).some((k) => k.kind === 'ABSENCE_STREAK')).toBe(false);
    expect(taskTarget('ABSENCE_STREAK', 'HOMEROOM_TEACHER', [])).toEqual({ role: 'HOMEROOM_TEACHER', tab: 'absence-streak' });
    expect(taskTarget('ABSENCE_STREAK', 'STUDENT_AFFAIRS', [])).toEqual({ role: 'STUDENT_AFFAIRS', tab: 'streak' });
    expect(taskTarget('ABSENCE_STREAK', 'GUIDANCE_COUNSELOR', [])).toEqual({ role: 'GUIDANCE_COUNSELOR', tab: 'absence' });
  });
});
