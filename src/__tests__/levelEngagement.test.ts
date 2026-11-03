import { describe, it, expect } from 'vitest';
import { levelEngagement, levelOfRoom } from '../lib/levelEngagement';

const T = { academicYear: '2569', term: '2' as const };
const log = (studentId: string, points: number, term = '2') =>
  ({ studentId, points, academicYear: '2569', term, awardedAt: '2026-11-01' }) as any;

describe('levelEngagement', () => {
  it('แปลงห้องเป็นระดับชั้น', () => {
    expect(levelOfRoom('ม.5/8')).toBe('ม.5');
    expect(levelOfRoom('M.5/9')).toBe('ม.5');
    expect(levelOfRoom('x')).toBe('');
  });
  it('คิดจากข้อมูลจริง เฉพาะระดับที่มีนักเรียน', () => {
    const students = [
      { studentId: 'a', room: 'ม.5/8' }, { studentId: 'b', room: 'M.5/9' },
      { studentId: 'c', room: 'ม.5/8' }, { studentId: 'd', room: 'ม.5/9' },
    ];
    const r = levelEngagement([log('a', 4), log('a', 2), log('b', 2), log('c', 5, '1')], students, T);
    expect(r).toEqual([{ grade: 'ม.5', students: 4, avgPts: 2, participation: 50 }]);
  });
  it('ไม่มีนักเรียน/ไม่มีคะแนน = ว่างหรือ 0 ไม่แต่งตัวเลข', () => {
    expect(levelEngagement([], [], T)).toEqual([]);
    expect(levelEngagement([], [{ studentId: 'a', room: 'ม.4/1' }], T)[0]).toMatchObject({ avgPts: 0, participation: 0 });
  });
});
