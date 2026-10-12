import { describe, it, expect } from 'vitest';
import { resolveRecordCourse, buildStudentAttendanceLog, aggregateLogByCourse } from '../lib/attendanceHistory';
import { computeCourseStatsMap } from '../lib/courseAttendanceStats';
import { readSource } from './helpers/readSource';

// 2026-10-12 = วันจันทร์
const schedules = [
  { subjectCode: 'HR', subjectName: 'HomeRoom (กิจกรรม)', level: 'ม.5/8', dayOfWeek: 'monday', periodNumber: 0 },
  { subjectCode: 'ค32102', subjectName: 'คณิตศาสตร์พื้นฐาน', level: 'ม.5/8', dayOfWeek: 'monday', periodNumber: 6 },
  { subjectCode: 'ค32102', subjectName: 'คณิตศาสตร์พื้นฐาน', level: 'ม.5/8', dayOfWeek: 'monday', periodNumber: 7 },
  { subjectCode: 'CZ', subjectName: 'Cleaning Zone', level: 'ม.5/8', dayOfWeek: 'monday', periodNumber: 9 },
  { subjectCode: 'อ1', subjectName: 'อังกฤษ', level: 'ม.5/7', dayOfWeek: 'monday', periodNumber: 6 },
];

describe('resolveRecordCourse', () => {
  it('ใช้ courseCode ในเอกสารก่อน', () => {
    expect(resolveRecordCourse({ date: '2026-10-12', room: 'ม.5/8', periodNumber: 6, courseCode: 'X1', courseName: 'วิชา X' }, schedules)).toEqual({ code: 'X1', name: 'วิชา X' });
  });
  it('record เก่า: หาจากตารางสอน (ห้อง + วัน + คาบ) — ไม่ปนห้องอื่น', () => {
    expect(resolveRecordCourse({ date: '2026-10-12', room: 'ม.5/8', periodNumber: 6 }, schedules)?.code).toBe('ค32102');
    expect(resolveRecordCourse({ date: '2026-10-12', room: 'ม.5/7', periodNumber: 6 }, schedules)?.code).toBe('อ1');
    expect(resolveRecordCourse({ date: '2026-10-12', room: 'ม.5/8', periodNumber: 0 }, schedules)?.code).toBe('HR');
  });
  it('หาไม่เจอ = null (ไม่เดา): คนละวัน / ไม่มีเลขคาบ', () => {
    expect(resolveRecordCourse({ date: '2026-10-13', room: 'ม.5/8', periodNumber: 6 }, schedules)).toBeNull();
    expect(resolveRecordCourse({ date: '2026-10-12', room: 'ม.5/8' }, schedules)).toBeNull();
  });
});

const records = [
  { date: '2026-10-12', room: 'ม.5/8', periodNumber: 0, students: { s1: 'PRESENT' } },
  { date: '2026-10-12', room: 'ม.5/8', periodNumber: 6, students: { s1: 'LATE', s2: 'PRESENT' } },
  { date: '2026-10-12', room: 'ม.5/8', periodNumber: 7, students: { s1: 'PRESENT' } },
  { date: '2026-10-12', room: 'ม.5/8', periodNumber: 9, students: { s1: 'LEAVE' } },
  { date: '2026-10-05', room: 'ม.5/8', periodNumber: 6, courseCode: 'ค32102', courseName: 'คณิตศาสตร์พื้นฐาน', students: { s1: 'ABSENT' } },
] as any[];

describe('buildStudentAttendanceLog / aggregateLogByCourse', () => {
  it('ประวัติของ s1: วันที่ใหม่→เก่า แล้วคาบน้อย→มาก, ข้ามนักเรียนที่ไม่อยู่ใน record', () => {
    const log = buildStudentAttendanceLog(records, schedules, 's1');
    expect(log.map(r => [r.date, r.periodNumber, r.status])).toEqual([
      ['2026-10-12', 0, 'PRESENT'], ['2026-10-12', 6, 'LATE'], ['2026-10-12', 7, 'PRESENT'], ['2026-10-12', 9, 'LEAVE'], ['2026-10-05', 6, 'ABSENT'],
    ]);
    expect(buildStudentAttendanceLog(records, schedules, 's2')).toHaveLength(1);
  });
  it('สรุปรายวิชา: คณิต 1 มา 1 สาย 1 ขาด, HR มา, CZ ลา', () => {
    const rows = aggregateLogByCourse(buildStudentAttendanceLog(records, schedules, 's1'), 's1');
    const by = Object.fromEntries(rows.map(r => [r.code, r.stats]));
    expect(by['ค32102']).toMatchObject({ present: 1, late: 1, absent: 1, leave: 0 });
    expect(by['HR']).toMatchObject({ present: 1 });
    expect(by['CZ']).toMatchObject({ leave: 1 });
  });
  it('วิชาที่หาไม่เจอรวมเป็น "ไม่ทราบวิชา"', () => {
    const log = buildStudentAttendanceLog([{ date: '2026-10-14', room: 'ม.5/8', periodNumber: 3, students: { s1: 'ABSENT' } }] as any, schedules, 's1');
    expect(aggregateLogByCourse(log, 's1')[0].name).toBe('ไม่ทราบวิชา');
  });
});

describe('computeCourseStatsMap (backfill)', () => {
  it('นับเฉพาะ record ที่หาวิชาได้ → ตรงกับยอดที่ควรอยู่ใน students/{id}', () => {
    const m = computeCourseStatsMap(records, schedules, 's1');
    expect(m['ค32102']).toMatchObject({ code: 'ค32102', present: 1, late: 1, absent: 1 });
    expect(m['HR']).toMatchObject({ present: 1 });
    expect(m['CZ']).toMatchObject({ leave: 1 });
    expect(Object.keys(m).sort()).toEqual(['CZ', 'HR', 'ค32102'].sort());
  });
});

describe('guard: เชื่อมต่อ UI/การเขียน', () => {
  it('โฮมรูมเขียน periodNumber 0 + ส่งวิชาได้', () => {
    const src = readSource('src/hooks/useHomeroomAttendance.ts');
    expect(src).toMatch(/periodNumber: 0/);
    expect(src).toMatch(/courseCode: course\.code/);
  });
  it('เขียนทับ record แบบ merge ใช้ courseCode เดิมต่อ', () => {
    expect(readSource('src/services/firestoreService.ts')).toMatch(/cleanExtraCode\(oldData\?\.courseCode\)/);
  });
  it('ครูผู้สอนมีแท็บสถิติรายบุคคล / ครูที่ปรึกษาเปิดรายละเอียดจริง ไม่มีข้อมูลตัวอย่าง', () => {
    expect(readSource('src/TeacherPortal.tsx')).toMatch(/<TeacherAttendanceStatsPanel/);
    const adv = readSource('src/AdvisorPortal.tsx');
    expect(adv).toMatch(/<AdvisorStudentDetailModal/);
    expect(adv).not.toMatch(/หมู่เลือด|BMI ล่าสุด|เล่นฟุตบอล|โปรแกรมเมอร์|images\.unsplash\.com/);
  });
});
