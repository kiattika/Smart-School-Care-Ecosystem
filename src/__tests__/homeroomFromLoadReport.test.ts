import { describe, it, expect } from 'vitest';
import { normalizeHomeroomLabel, planHomeroomUpdates } from '../lib/homeroomFromLoadReport';
import { readSource } from './helpers/readSource';

describe('homeroomFromLoadReport', () => {
  it('แปลง M.5/6 → ม.5/6 และไม่เดาค่าที่ไม่ใช่ห้อง', () => {
    expect(normalizeHomeroomLabel('M.5/6')).toBe('ม.5/6');
    expect(normalizeHomeroomLabel('ม.6 / 08')).toBe('ม.6/8');
    expect(normalizeHomeroomLabel('-')).toBe('');
    expect(normalizeHomeroomLabel(undefined)).toBe('');
  });
  it('เขียนเฉพาะครูที่จับคู่ได้และห้องต่างจากเดิม', () => {
    const plan = planHomeroomUpdates(
      [
        { matchedTeacherId: 'a', homeroom: 'M.5/6' },
        { matchedTeacherId: 'a', homeroom: 'M.5/6' },
        { matchedTeacherId: 'b', homeroom: 'M.6/8' },
        { matchedTeacherId: 'c', homeroom: 'M.1/1' },
        { matchedTeacherId: null, homeroom: 'M.2/2' },
        { matchedTeacherId: 'd', homeroom: '' },
      ],
      new Map([['b', 'ม.6/8'], ['c', 'ม.2/1']]),
    );
    expect(plan.updates).toEqual([
      { staffId: 'a', homeroomClass: 'ม.5/6' },
      { staffId: 'c', homeroomClass: 'ม.1/1' },
    ]);
    expect(plan.conflicts).toEqual([]);
  });
  it('ไฟล์ระบุห้องขัดกันเอง = ไม่เขียน และรายงาน', () => {
    const plan = planHomeroomUpdates(
      [{ matchedTeacherId: 'a', homeroom: 'M.5/6', teacherName: 'ครู ก' }, { matchedTeacherId: 'a', homeroom: 'M.5/7' }],
      new Map(),
    );
    expect(plan.updates).toEqual([]);
    expect(plan.conflicts).toEqual(['ครู ก']);
  });
  it('หน้าตารางภาระงานอ่านห้องจาก assignments.homeroomClass', () => {
    expect(readSource('src/components/TeachingLoadTable.tsx')).toContain('st.assignments?.homeroomClass');
  });
});
