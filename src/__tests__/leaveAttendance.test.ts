import { describe, it, expect } from 'vitest';
import { leaveStudentIdsOn, withLeavePrefill } from '../lib/leaveAttendance';
import { readSource } from './helpers/readSource';

const day = (studentId: string, startDate: string, endDate: string) => ({ leaveId: studentId + startDate, studentId, homeroomClass: 'ม.5/8', startDate, endDate });

describe('leaveStudentIdsOn', () => {
  it('includes only students whose approved leave covers the date (inclusive)', () => {
    const days = [day('a', '2026-10-12', '2026-10-14'), day('b', '2026-10-13', '2026-10-13'), day('c', '2026-10-01', '2026-10-11')];
    expect([...leaveStudentIdsOn(days, '2026-10-12')]).toEqual(['a']);
    expect([...leaveStudentIdsOn(days, '2026-10-13')].sort()).toEqual(['a', 'b']);
    expect([...leaveStudentIdsOn(days, '2026-10-14')]).toEqual(['a']);
    expect(leaveStudentIdsOn(days, '2026-10-15').size).toBe(0);
  });
  it('is empty with no data (no guessing)', () => {
    expect(leaveStudentIdsOn([], '2026-10-12').size).toBe(0);
  });
});

describe('withLeavePrefill', () => {
  it('marks LEAVE only where no status exists yet', () => {
    expect(withLeavePrefill({}, new Set(['a']))).toEqual({ a: 'LEAVE' });
  });
  it('never overrides a saved status (teacher override / homeroom record wins)', () => {
    expect(withLeavePrefill({ a: 'PRESENT', b: 'ABSENT' }, new Set(['a', 'b']))).toEqual({ a: 'PRESENT', b: 'ABSENT' });
  });
  it('does not mutate its input', () => {
    const base = {};
    withLeavePrefill(base, new Set(['a']));
    expect(base).toEqual({});
  });
});

describe('wiring guards', () => {
  it('decideLeaveRequest writes the reason-free leave-day in the same batch as the approval', () => {
    const src = readSource('src/services/firestoreService.ts');
    expect(src).toMatch(/batch\.set\(doc\(db, LEAVE_DAYS_COL, leaveId\)/);
    expect(src).toMatch(/await batch\.commit\(\)/);
    const block = src.slice(src.indexOf('batch.set(doc(db, LEAVE_DAYS_COL'), src.indexOf('await batch.commit()'));
    expect(block).not.toMatch(/reason|leaveType/);
  });
  it('the attendance roster pre-fills from leave days without touching the "already checked" gate', () => {
    const src = readSource('src/components/ClassroomSeatingManager.tsx');
    expect(src).toMatch(/withLeavePrefill\(/);
    expect(src).toMatch(/leaveStudentIds=\{leaveStudentIds\}/);
    expect(src).toMatch(/const currentAttendance = firestoreAttendance \|\| attendanceRecords\[courseId\] \|\| attendanceRecords\[course\.code\] \|\| \{\};/);
  });
});
