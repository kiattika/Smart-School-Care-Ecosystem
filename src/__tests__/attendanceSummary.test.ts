import { describe, it, expect } from 'vitest';
import { buildAttendanceSummary, countStudents, weekStartOf } from '../../functions/src/attendanceSummaryLogic';
import { attendanceRate, levelRows, parseAttendanceSummary, roomsByLowestRate, sumCounts } from '../lib/attendanceSummaryView';
import { readSource } from './helpers/readSource';

const sem = { academicYear: '2569', term: '1' as const };
const docs = [
  { date: '2026-10-19', room: 'ม.1/1', students: { a: 'PRESENT', b: 'LATE', c: 'ABSENT', d: 'LEAVE' } },
  { date: '2026-10-20', room: 'ม.1/1', students: { a: 'PRESENT', b: 'PRESENT', c: 'PRESENT', d: 'PRESENT' } },
  { date: '2026-10-20', room: 'ม.4/2', students: { e: 'ABSENT', f: 'PRESENT' } },
];

describe('สรุปการมาเรียน (ฝั่ง functions)', () => {
  it('นับสถานะ และข้ามค่าที่ไม่รู้จัก', () => {
    expect(countStudents({ a: 'PRESENT', b: 'X', c: 'ABSENT' })).toEqual({ present: 1, late: 0, absent: 1, leave: 0 });
  });
  it('สัปดาห์เริ่มวันจันทร์', () => {
    expect(weekStartOf('2026-10-21')).toBe('2026-10-19');
    expect(weekStartOf('2026-10-25')).toBe('2026-10-19');
  });
  it('ไม่มีข้อมูล = null ไม่แต่งตัวเลข', () => {
    expect(buildAttendanceSummary([], sem)).toBeNull();
  });
  it('ไม่มีชื่อ/รหัสนักเรียนในผลลัพธ์', () => {
    const s = buildAttendanceSummary(docs, sem);
    expect(s).not.toBeNull();
    const json = JSON.stringify(s);
    for (const id of ['"a"', '"b"', '"e"']) expect(json).not.toContain(id);
  });
});

describe('มุมมองผู้บริหาร', () => {
  it('ร้อยละ = (มา+สาย)÷ทั้งหมดรวมลา; ไม่มีข้อมูล = null', () => {
    expect(attendanceRate({ present: 1, late: 1, absent: 1, leave: 1 })).toBe(50);
    expect(attendanceRate({ present: 0, late: 0, absent: 0, leave: 0 })).toBeNull();
  });
  it('parse เอกสารจริงจาก logic ได้ และเอกสารผิดรูป = null', () => {
    const v = parseAttendanceSummary(JSON.parse(JSON.stringify(buildAttendanceSummary(docs, sem))));
    expect(v).not.toBeNull();
    expect(v!.periods.term.rooms.length).toBe(2);
    expect(sumCounts(v!.periods.term.rooms).absent).toBe(2);
    expect(parseAttendanceSummary({ foo: 1 })).toBeNull();
    expect(parseAttendanceSummary(null)).toBeNull();
  });
  it('เรียงห้องร้อยละต่ำสุดก่อน และรวมรายระดับ', () => {
    const v = parseAttendanceSummary(JSON.parse(JSON.stringify(buildAttendanceSummary(docs, sem))))!;
    expect(roomsByLowestRate(v.periods.term.rooms)[0].room).toBe('ม.4/2');
    expect(levelRows(v.periods.term.rooms).length).toBe(2);
  });
  it('แผงไม่ฝังตัวเลขปลอม และต่อกับหน้าภาพรวม', () => {
    const panel = readSource('src/components/executive/ExecutiveAttendancePanel.tsx');
    expect(panel).toContain("'attendance_summary'");
    expect(readSource('src/ExecutivePortal.tsx')).toContain('<ExecutiveAttendancePanel />');
  });
});
