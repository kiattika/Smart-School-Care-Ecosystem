import { describe, it, expect } from 'vitest';
import { buildStudentDaySchedule, scheduleDayKey } from '../lib/studentDaySchedule';

const periods = [
  { periodNumber: 0, startTime: '08:00', endTime: '08:30' },
  { periodNumber: 1, startTime: '08:30', endTime: '09:20' },
  { periodNumber: 2, startTime: '09:20', endTime: '10:10' },
  { periodNumber: 3, startTime: '10:10', endTime: '11:00' },
];
// 2026-10-12 เป็นวันจันทร์
const monday = (h: number, m: number) => new Date(2026, 9, 12, h, m);

const docs = [
  { id: 'a', subjectCode: 'ค32101', subjectName: 'คณิตศาสตร์', level: 'ม.5/8', room: '421', dayOfWeek: 'monday', periodNumber: 1, subjectType: 'MAIN' },
  { id: 'a2', subjectCode: 'ค32101', subjectName: 'คณิตศาสตร์', level: 'ม.5/8', room: '421', dayOfWeek: 'monday', periodNumber: 1, subjectType: 'MAIN' }, // ครูร่วม
  { id: 'b', subjectCode: 'ว32202', subjectName: 'ฟิสิกส์', level: 'ม.5/8', room: 'แล็บ', dayOfWeek: 'monday', periodNumber: 2, subjectType: 'MAIN' },
  { id: 'c', subjectCode: 'ท32101', subjectName: 'ภาษาไทย', level: 'ม.5/8', dayOfWeek: 'tuesday', periodNumber: 1 },       // คนละวัน
  { id: 'd', subjectCode: 'ค32101', subjectName: 'คณิตศาสตร์', level: 'ม.5/7', dayOfWeek: 'monday', periodNumber: 3 },      // คนละห้อง
  { id: 'e', courseCode: 'อ32101', courseName: 'อังกฤษ', targetClass: 'ม.5/8', scheduleDay: 1, periodNumber: 3 },           // รูปแบบเก่า
  { id: 'f', subjectCode: 'PLC', subjectName: 'PLC ครู', dayOfWeek: 'monday', periodNumber: 0, subjectType: 'ACTIVITY' },   // ไม่มีห้อง
];

describe('buildStudentDaySchedule', () => {
  it('weekday key', () => { expect(scheduleDayKey(monday(9, 0))).toBe('monday'); });

  it('คัดเฉพาะวันนี้ + ห้องของนักเรียน, รองรับ field แบบเก่า, ตัดซ้ำคาบเดียวกัน, เรียงตามคาบ', () => {
    const { rows } = buildStudentDaySchedule({ schedules: docs, periods, studentRoom: '5/8', now: monday(9, 30) });
    expect(rows.map(r => [r.periodNumber, r.code])).toEqual([[1, 'ค32101'], [2, 'ว32202'], [3, 'อ32101']]);
  });

  it('สถานะตามเวลาปัจจุบัน', () => {
    const at = (h: number, m: number) => buildStudentDaySchedule({ schedules: docs, periods, studentRoom: 'ม.5/8', now: monday(h, m) }).rows.map(r => r.status);
    expect(at(8, 0)).toEqual(['UPCOMING', 'UPCOMING', 'UPCOMING']);
    expect(at(9, 30)).toEqual(['DONE', 'NOW', 'UPCOMING']);
    expect(at(11, 0)).toEqual(['DONE', 'DONE', 'DONE']);
  });

  it('ไม่มีห้อง / ห้องไม่ตรง / ไม่มีตาราง = ว่าง (ไม่เติมวิชาแทน)', () => {
    expect(buildStudentDaySchedule({ schedules: docs, periods, studentRoom: undefined, now: monday(9, 0) }).rows).toEqual([]);
    expect(buildStudentDaySchedule({ schedules: docs, periods, studentRoom: 'ม.6/1', now: monday(9, 0) }).rows).toEqual([]);
    expect(buildStudentDaySchedule({ schedules: [], periods, studentRoom: 'ม.5/8', now: monday(9, 0) }).rows).toEqual([]);
  });

  it('วันเสาร์-อาทิตย์ไม่มีคาบ', () => {
    const sat = new Date(2026, 9, 17, 9, 0);
    expect(buildStudentDaySchedule({ schedules: docs, periods, studentRoom: 'ม.5/8', now: sat }).rows).toEqual([]);
  });
});
