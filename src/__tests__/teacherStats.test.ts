import { describe, it, expect } from 'vitest';
import type { SubstituteAssignment } from '../types';
import { aggregateStats, academicYearDateRange, computeTeacherStats, getStats, semesterDateRange } from '../lib/teacherStats';

const A = (o: Partial<SubstituteAssignment>): SubstituteAssignment => ({
  id: Math.random().toString(), originalTeacherEmail: 'a@utd.ac.th', substituteTeacherEmail: 'b@utd.ac.th',
  courseId: 'c', date: '2026-08-10', status: 'APPROVED', triggerType: 'SICK_LEAVE', ...o,
});
const range = semesterDateRange('2569', '1');

describe('ช่วงภาคเรียน', () => {
  it('ภาค 1 = พ.ค.–ต.ค., ภาค 2 ข้ามปี, ทั้งปี พ.ค.–เม.ย.', () => {
    expect(range).toEqual({ from: '2026-05-01', to: '2026-10-31' });
    expect(semesterDateRange('2569', '2')).toEqual({ from: '2026-11-01', to: '2027-04-30' });
    expect(academicYearDateRange('2569')).toEqual({ from: '2026-05-01', to: '2027-04-30' });
  });
});

describe('computeTeacherStats', () => {
  it('นับเฉพาะที่อนุมัติแล้ว: ลา/ราชการ ของเจ้าของคาบ และ สอนแทน ของผู้สอนแทน', () => {
    const m = computeTeacherStats([
      A({}), A({ date: '2026-08-10' }), A({ date: '2026-08-11', triggerType: 'OFFICIAL_DUTY' }),
      A({ triggerType: 'PERSONAL_LEAVE', date: '2026-09-01' }),
      A({ triggerType: undefined, date: '2026-09-02' }),
      A({ status: 'REJECTED' }), A({ status: 'PENDING_APPROVAL' }),
    ], range);
    const a = getStats(m, 'A@utd.ac.th');
    expect(a.SICK_LEAVE).toEqual({ periods: 2, days: 1 });
    expect(a.OFFICIAL_DUTY.periods).toBe(1);
    expect(a.PERSONAL_LEAVE.periods).toBe(1);
    expect(a.OTHER_ABSENCE.periods).toBe(1);
    expect(a.pending).toBe(1);
    expect(getStats(m, 'b@utd.ac.th').COVERED_FOR_OTHERS.periods).toBe(5);
  });
  it('แลกคาบ: นับให้เจ้าของคาบเดิมเท่านั้น ไม่นับเป็นสอนแทน/ลา', () => {
    const m = computeTeacherStats([
      A({ swapMode: 'SWAP', triggerType: undefined }),
      A({ swapMode: 'SWAP', triggerType: undefined, originalTeacherEmail: 'b@utd.ac.th', substituteTeacherEmail: 'a@utd.ac.th' }),
    ], range);
    expect(getStats(m, 'a@utd.ac.th')).toMatchObject({ SWAP: { periods: 1 }, COVERED_FOR_OTHERS: { periods: 0 }, SICK_LEAVE: { periods: 0 } });
    expect(getStats(m, 'b@utd.ac.th').SWAP.periods).toBe(1);
  });
  it('นอกช่วงวันที่ไม่นับ; ครูไม่มีรายการ = ศูนย์', () => {
    const m = computeTeacherStats([A({ date: '2026-04-30' }), A({ date: '2026-11-01' })], range);
    expect(getStats(m, 'a@utd.ac.th').SICK_LEAVE.periods).toBe(0);
    expect(getStats(m, 'nobody@utd.ac.th').SWAP.periods).toBe(0);
  });
});

describe('aggregateStats', () => {
  it('รวมเป็นตัวเลข ไม่ซ้ำคน และนับจำนวนครูที่มีรายการ', () => {
    const m = computeTeacherStats([A({}), A({ date: '2026-08-12' }), A({ originalTeacherEmail: 'c@utd.ac.th' })], range);
    const g = aggregateStats(['a@utd.ac.th', 'A@utd.ac.th', 'c@utd.ac.th', 'z@utd.ac.th'], m);
    expect(g.teachers).toBe(3);
    expect(g.totals.SICK_LEAVE).toEqual({ periods: 3, days: 3, teachers: 2 });
    expect(JSON.stringify(g)).not.toContain('@');
  });
});
