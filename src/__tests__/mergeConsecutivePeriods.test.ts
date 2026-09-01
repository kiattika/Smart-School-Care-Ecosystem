import { describe, it, expect } from 'vitest';
import { mergeConsecutivePeriods, periodRangeLabel } from '../lib/mergeConsecutivePeriods';
import type { SubjectPeriod } from '../components/TeacherScheduleList';

const p = (over: Partial<SubjectPeriod>): SubjectPeriod => ({
  id: `id-${over.periodNumber}`, courseId: `c-${over.periodNumber}`, periodNumber: 1,
  startTime: '08:30', endTime: '09:20', subjectCode: 'ค32101', subjectName: 'คณิต',
  className: 'ม.5/9', room: '935', ...over,
});

describe('mergeConsecutivePeriods', () => {
  it('รวมคาบ 3-4 วิชา+ห้องเดียวกันที่ติดกัน เป็นแถวเดียว พร้อมช่วงเวลารวม', () => {
    const merged = mergeConsecutivePeriods([
      p({ periodNumber: 3, startTime: '10:10', endTime: '11:00' }),
      p({ periodNumber: 4, startTime: '11:00', endTime: '11:50' }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].periodNumber).toBe(3);
    expect(merged[0].periodNumberEnd).toBe(4);
    expect(merged[0].startTime).toBe('10:10');
    expect(merged[0].endTime).toBe('11:50');
    expect(merged[0].mergedPeriodNumbers).toEqual([3, 4]);
    expect(merged[0].mergedCourseIds).toEqual(['c-3', 'c-4']);
    expect(periodRangeLabel(merged[0])).toBe('3-4');
  });

  it('รวม triple period (5-7) ได้', () => {
    const merged = mergeConsecutivePeriods([
      p({ periodNumber: 5 }), p({ periodNumber: 6 }), p({ periodNumber: 7, endTime: '15:10' }),
    ]);
    expect(merged).toHaveLength(1);
    expect(periodRangeLabel(merged[0])).toBe('5-7');
    expect(merged[0].endTime).toBe('15:10');
  });

  it('ไม่รวมถ้ามีคาบอื่นคั่น (3 แล้วข้ามไป 5)', () => {
    const merged = mergeConsecutivePeriods([p({ periodNumber: 3 }), p({ periodNumber: 5 })]);
    expect(merged).toHaveLength(2);
    expect(periodRangeLabel(merged[0])).toBe('3');
  });

  it('ไม่รวมถ้าคนละวิชา หรือคนละห้อง', () => {
    expect(mergeConsecutivePeriods([
      p({ periodNumber: 3 }), p({ periodNumber: 4, subjectCode: 'ค32201' }),
    ])).toHaveLength(2);
    expect(mergeConsecutivePeriods([
      p({ periodNumber: 3, room: '935' }), p({ periodNumber: 4, room: '943' }),
    ])).toHaveLength(2);
  });

  it('รวมโดยมองข้ามฟอร์แมตห้อง M.5/9 vs ม.5/9', () => {
    const merged = mergeConsecutivePeriods([
      p({ periodNumber: 3, className: 'M.5/9' }), p({ periodNumber: 4, className: 'ม.5/9' }),
    ]);
    expect(merged).toHaveLength(1);
  });

  it('คาบรวม: เช็คแล้วถ้าคาบย่อยใดคาบหนึ่งเช็คแล้ว', () => {
    const merged = mergeConsecutivePeriods([
      p({ periodNumber: 3, attendanceTaken: true }), p({ periodNumber: 4, attendanceTaken: false }),
    ]);
    expect(merged[0].attendanceTaken).toBe(true);
  });

  it('คาบเดี่ยว label = เลขคาบ ไม่มีขีด', () => {
    expect(periodRangeLabel(p({ periodNumber: 2 }))).toBe('2');
  });
});
