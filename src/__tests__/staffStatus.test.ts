import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { isStaffActive } from '../lib/staffStatus';
import { callableErrorMessage } from '../lib/callableErrors';
import { isStaffInactive } from '../../functions/src/access';
import { readSource } from './helpers/readSource';

describe('isStaffActive (client) mirrors isStaffInactive (functions)', () => {
  it("only status === 'INACTIVE' is inactive; a missing status (old data) is active", () => {
    for (const status of [undefined, null, '', 'ACTIVE', 'inactive', 'DISABLED', 0]) {
      expect(isStaffActive({ status }), String(status)).toBe(true);
      expect(isStaffInactive(status), String(status)).toBe(false);
    }
    expect(isStaffActive({ status: 'INACTIVE' })).toBe(false);
    expect(isStaffInactive('INACTIVE')).toBe(true);
    expect(isStaffActive({})).toBe(true);
    expect(isStaffActive(null)).toBe(false);
  });
});

describe('callableErrorMessage', () => {
  it('shows the Thai message from the function, without the SDK " [400]" suffix', () => {
    expect(callableErrorMessage({ code: 'functions/already-exists', message: 'มีบุคลากรรหัส "t-1" อยู่แล้ว [409]' })).toBe('มีบุคลากรรหัส "t-1" อยู่แล้ว');
    expect(callableErrorMessage({ code: 'functions/failed-precondition', message: 'ไม่สามารถปิดการใช้งานบัญชีของตัวเองได้' })).toBe('ไม่สามารถปิดการใช้งานบัญชีของตัวเองได้');
  });

  it('falls back for internal / network errors and empty messages', () => {
    expect(callableErrorMessage({ code: 'functions/internal', message: 'INTERNAL' }, 'fallback')).toBe('fallback');
    expect(callableErrorMessage({ code: 'functions/unavailable', message: 'x' }, 'fallback')).toBe('fallback');
    expect(callableErrorMessage(null, 'fallback')).toBe('fallback');
    expect(callableErrorMessage({ message: '' }, 'fallback')).toBe('fallback');
  });
});

describe('staff pickers hide INACTIVE staff (B4)', () => {
  const root = path.resolve(__dirname, '../..');
  const src = (rel: string) => readSource(path.join(root, rel));

  it('club responsible-teacher picker offers active staff only, but keeps already-selected inactive staff resolvable', () => {
    const s = src('src/components/admin/ElectiveActivityManagerPage.tsx');
    expect(s).toContain('const active = isStaffActive(data);');
    expect(s).toContain('teachers.filter(t => t.active && !teacherUidsInput.includes(t.uid)');
    // selectedTeachers ยังค้นจาก teachers ทั้งหมด (ไม่กรอง active) — ไม่งั้นแก้ไขชุมนุมเดิมแล้วครูที่ถูกปิดหายตอนบันทึก
    expect(s).toContain('teacherUidsInput.map(uid => teachers.find(t => t.uid === uid))');
  });

  it('backup-approver picker lists active staff only', () => {
    expect(src('src/components/admin/DepartmentManagerModal.tsx')).toContain('snap.docs.filter(d => isStaffActive(d.data()))');
  });

  it('substitute candidate lists (same dept + other depts) exclude inactive staff', () => {
    const s = src('src/components/SubstituteTeachingModule.tsx');
    expect(s).toContain('staffDirectory.filter(t => isStaffActive(t) && t.email?.toLowerCase() !== absentLower && t.assignments?.departmentId === deptId)');
    expect(s).toMatch(/\.filter\(t =>\s+isStaffActive\(t\) &&\s+t\.email\?\.toLowerCase\(\) !== absentLower &&\s+t\.assignments\?\.departmentId !== deptId/);
    expect(src('src/hooks/useSubstituteSync.ts')).toContain("status: data.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',");
  });
});
