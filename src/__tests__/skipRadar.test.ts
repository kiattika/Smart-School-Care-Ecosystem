import { describe, it, expect } from 'vitest';
import { detectSkipIncidents, periodTotals, skipLevel } from '../lib/skipRadar';

const rec = (date: string, periodNumber: number, students: Record<string, any>, courseCode = '') =>
  ({ date, periodNumber, students, courseCode, courseName: courseCode }) as any;

describe('skipRadar', () => {
  it('มาตอนเช้าแต่ขาดคาบ = โดด', () => {
    const r = detectSkipIncidents([
      rec('2026-10-01', 0, { a: 'PRESENT' }),
      rec('2026-10-01', 4, { a: 'ABSENT' }, 'ค21101'),
    ], ['a']);
    expect(r[0].total).toBe(1);
    expect(r[0].byPeriod[4]).toBe(1);
    expect(r[0].topCourse?.label).toBe('ค21101');
  });
  it('ขาดทั้งวัน / ลา ไม่นับ', () => {
    const r = detectSkipIncidents([
      rec('2026-10-01', 0, { a: 'ABSENT', b: 'PRESENT' }),
      rec('2026-10-01', 4, { a: 'ABSENT', b: 'LEAVE' }),
    ], ['a', 'b']);
    expect(r.every(x => x.total === 0)).toBe(true);
  });
  it('คาบเดียวไม่มีหลักฐานอื่น ไม่นับ และคาบ 0 ไม่นับเป็นโดด', () => {
    expect(detectSkipIncidents([rec('2026-10-01', 3, { a: 'ABSENT' })], ['a'])[0].total).toBe(0);
    expect(detectSkipIncidents([rec('2026-10-01', 0, { a: 'ABSENT' }), rec('2026-10-01', 2, { a: 'PRESENT' })], ['a'])[0].total).toBe(0);
  });
  it('มาสายถือว่ามาโรงเรียน; เรียงตามจำนวน; ระดับ', () => {
    const r = detectSkipIncidents([
      rec('2026-10-01', 0, { a: 'LATE', b: 'PRESENT' }),
      rec('2026-10-01', 2, { a: 'ABSENT', b: 'ABSENT' }),
      rec('2026-10-01', 3, { a: 'ABSENT', b: 'PRESENT' }),
    ], ['a', 'b']);
    expect(r[0].studentId).toBe('a');
    expect(r[0].total).toBe(2);
    expect(r[0].level).toBe('WATCH');
    expect(periodTotals(r)[1]).toBe(2);
    expect(skipLevel(4)).toBe('ALERT');
    expect(skipLevel(1)).toBe('NONE');
  });
});
