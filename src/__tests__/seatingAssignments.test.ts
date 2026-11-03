import { describe, it, expect } from 'vitest';
import { dedupeActiveAssignments } from '../lib/seatingAssignments';

const a = (id: string, seatId: string, studentId: string, from: string, to: string | null = null) =>
  ({ id, layoutId: 'L', groupId: 'g', seatId, studentId, effectiveFrom: from, effectiveTo: to }) as any;

describe('dedupeActiveAssignments', () => {
  it('นักเรียนคนเดียวหลายที่นั่ง → เหลือที่นั่งล่าสุด', () => {
    const r = dedupeActiveAssignments([
      a('1', 's1', 'A', '2026-01-01'), a('2', 's7', 'A', '2026-02-01'), a('3', 's2', 'B', '2026-01-01'),
    ]);
    expect(Object.keys(r).sort()).toEqual(['s2', 's7']);
    expect(r.s7.studentId).toBe('A');
  });
  it('ที่นั่งเดียวหลายคน → เหลือคนล่าสุด', () => {
    const r = dedupeActiveAssignments([a('1', 's1', 'A', '2026-01-01'), a('2', 's1', 'B', '2026-03-01')]);
    expect(r.s1.studentId).toBe('B');
    expect(Object.keys(r)).toEqual(['s1']);
  });
  it('รายการที่ปิดแล้ว (effectiveTo) ไม่นับ', () => {
    expect(dedupeActiveAssignments([a('1', 's1', 'A', '2026-01-01', '2026-02-01')])).toEqual({});
  });
});
