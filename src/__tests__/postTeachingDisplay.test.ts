import { describe, it, expect } from 'vitest';
import { periodOfRecord, sortPostTeachingRecords } from '../lib/postTeachingDisplay';
import { splitLevels, levelsOfSchedule, apCandidates } from '../lib/apCourses';

const rec = (o: any) => ({ courseId: 'c', date: '2026-11-01', summary: '', problems: '', solutions: '', submittedAt: '2026-11-01T01:00:00Z', isLate: false, ...o });

describe('post teaching display', () => {
  it('ถอดคาบจาก scheduleId หรือ periodNumber (0 = โฮมรูม)', () => {
    expect(periodOfRecord(rec({ scheduleId: 'abc_p4' }))).toBe(4);
    expect(periodOfRecord(rec({ periodNumber: 0 }))).toBe(0);
    expect(periodOfRecord(rec({}))).toBeNull();
  });
  it('เรียงใหม่→เก่า วันที่ แล้วคาบมาก→น้อย', () => {
    const out = sortPostTeachingRecords([
      rec({ date: '2026-10-30', periodNumber: 9 }), rec({ date: '2026-11-02', periodNumber: 1 }),
      rec({ date: '2026-11-02', periodNumber: 5 }), rec({ date: '2026-11-02', periodNumber: 0 }),
    ]);
    expect(out.map(r => `${r.date}/${r.periodNumber}`)).toEqual(['2026-11-02/5', '2026-11-02/1', '2026-11-02/0', '2026-10-30/9']);
  });
});

describe('AP levels string', () => {
  it('แยก "M.6/1, M.6/2" เป็นสองห้อง', () => {
    expect(splitLevels('M.6/1, M.6/2')).toEqual(['M.6/1', 'M.6/2']);
    expect(splitLevels('ม.6/1 และ ม.6/2')).toEqual(['ม.6/1', 'ม.6/2']);
    expect(levelsOfSchedule({ level: 'M.6/1, M.6/2' })).toHaveLength(2);
  });
  it('ผู้สมัครรวมนักเรียนทั้ง 6/1 และ 6/2', () => {
    const st = [{ studentId: '1', room: 'ม.6/1' }, { studentId: '2', room: 'ม.6/2' }, { studentId: '3', room: 'ม.6/3' }];
    expect(apCandidates(st, levelsOfSchedule({ level: 'M.6/1, M.6/2' })).map(s => s.studentId)).toEqual(['1', '2']);
  });
});
