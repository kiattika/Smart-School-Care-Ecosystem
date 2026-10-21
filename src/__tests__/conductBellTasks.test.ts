import { describe, it, expect } from 'vitest';
import { buildStaffTasks, staffTaskSources } from '../lib/staffTasks';
import { taskTarget, acceptBellNav } from '../lib/bellNavigation';
import { readSource } from './helpers/readSource';

const base = { roomLeaves: [], lateRequests: [] };

describe('กระดิ่งงานกิจการนักเรียน', () => {
  it('เฉพาะบทบาท STUDENT_AFFAIRS ที่ได้งานคะแนนความประพฤติ', () => {
    expect(staffTaskSources('STUDENT_AFFAIRS').conduct).toBe(true);
    expect(staffTaskSources('HOMEROOM_TEACHER').conduct).toBe(false);
    const t = buildStaffTasks({ ...base, activeRole: 'STUDENT_AFFAIRS', conduct: { pendingEntries: 3, pendingChanges: 2 } });
    expect(t.map(x => [x.kind, x.count])).toEqual([['CONDUCT_REVIEW', 3], ['CONDUCT_CHANGE', 2]]);
    expect(buildStaffTasks({ ...base, activeRole: 'SUBJECT_TEACHER', conduct: { pendingEntries: 3, pendingChanges: 2 } })).toEqual([]);
  });

  it('ไม่มีรายการ/ไม่ส่งข้อมูล = ไม่มีงาน (ไม่แต่งตัวเลข)', () => {
    expect(buildStaffTasks({ ...base, activeRole: 'STUDENT_AFFAIRS', conduct: { pendingEntries: 0, pendingChanges: 0 } })).toEqual([]);
    expect(buildStaffTasks({ ...base, activeRole: 'STUDENT_AFFAIRS' })).toEqual([]);
  });

  it('กดแล้วพาไปแท็บที่พอร์ทัลรองรับ', () => {
    const r = taskTarget('CONDUCT_REVIEW', 'STUDENT_AFFAIRS', ['STUDENT_AFFAIRS']);
    const c = taskTarget('CONDUCT_CHANGE', 'STUDENT_AFFAIRS', ['STUDENT_AFFAIRS']);
    expect(r).toEqual({ role: 'STUDENT_AFFAIRS', tab: 'review' });
    expect(c).toEqual({ role: 'STUDENT_AFFAIRS', tab: 'changes' });
    expect(acceptBellNav(c, 'STUDENT_AFFAIRS', ['review', 'changes'])).toBe('changes');
  });

  it('ต่อสายใน UI: กระดิ่งฟังรายการ PENDING และพอร์ทัลรับเป้าหมาย', () => {
    const bell = readSource('src/components/notifications/StaffTaskBell.tsx');
    expect(bell).toContain('subscribePendingConduct');
    expect(bell).toContain('subscribePendingChanges');
    expect(readSource('src/components/studentaffairs/StudentAffairsPortal.tsx')).toContain("useConsumeBellNav('STUDENT_AFFAIRS', ['review', 'changes']");
  });
});
