import { describe, it, expect } from 'vitest';
import { readSource } from './helpers/readSource';
import { studentLevelLabel, sortRoster, rosterLevels, filterRosterByLevel } from '../lib/gradebookRoster';

const S = (studentId: string, room: string | undefined, no?: number) => ({ studentId, room, studentNo: no });

describe('gradebookRoster', () => {
  it('ป้ายระดับชั้น: M. → ม., ไม่มีห้อง → ว่าง', () => {
    expect(studentLevelLabel({ room: 'M.5/8' })).toBe('ม.5/8');
    expect(studentLevelLabel({ className: 'ม.4/2' })).toBe('ม.4/2');
    expect(studentLevelLabel({})).toBe('');
  });
  it('เรียงตามชั้น→ห้อง (ตัวเลข ไม่ใช่ข้อความ) → เลขที่', () => {
    const r = sortRoster([S('c', 'ม.5/10', 1), S('a', 'ม.5/8', 5), S('b', 'ม.5/8', 2), S('d', 'ม.4/12', 9), S('z', undefined, 1)]);
    expect(r.map(s => s.studentId)).toEqual(['d', 'b', 'a', 'c', 'z']);
  });
  it('เลขที่ไม่มี ไปท้ายห้อง; เท่ากันเรียงตามรหัส', () => {
    const r = sortRoster([S('2', 'ม.5/8'), S('1', 'ม.5/8', 3), S('0', 'ม.5/8')]);
    expect(r.map(s => s.studentId)).toEqual(['1', '0', '2']);
  });
  it('รายการระดับชั้นไม่ซ้ำและกรองได้', () => {
    const l = [S('a', 'ม.5/8', 1), S('b', 'M.5/8', 2), S('c', 'ม.5/9', 1)];
    expect(rosterLevels(l)).toEqual(['ม.5/8', 'ม.5/9']);
    expect(filterRosterByLevel(l, 'ม.5/8').map(s => s.studentId)).toEqual(['a', 'b']);
    expect(filterRosterByLevel(l, '')).toHaveLength(3);
  });
});

describe('guard: สมุดคะแนนมีคอลัมน์/ตัวกรองระดับชั้น และสถิติมีสีมา/สาย/ขาด/ลา', () => {
  it('TeacherPortal แสดงคอลัมน์ระดับชั้น, เรียง, กรอง', () => {
    const src = readSource('src/TeacherPortal.tsx');
    expect(src).toContain('>ระดับชั้น</th>');
    expect(src).toContain('gradebookRoster.map(');
    expect(src).toContain('id="gradebook-level-filter"');
  });
  it('แถวสถิติใช้สีเดียวกับส่วนรายละเอียด', () => {
    const src = readSource('src/components/attendance/TeacherAttendanceStatsPanel.tsx');
    for (const c of ['text-emerald-400', 'text-amber-400', 'text-rose-400', 'text-indigo-400']) expect(src).toContain(c);
  });
});
