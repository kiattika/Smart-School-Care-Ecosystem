import { describe, it, expect } from 'vitest';
import {
  computeStudentAttendanceStats,
  attendanceStatsFromCounts,
  defaultAttendanceDateRange,
  roomQueryCandidates,
  diffAttendanceStatuses,
  DEFAULT_ATTENDANCE_THRESHOLD_PERCENT,
  AttendanceRecordLite,
} from '../lib/studentAttendanceStats';

describe('computeStudentAttendanceStats — สถิติจาก attendance_records สด (ครู/ครูที่ปรึกษา)', () => {
  it('ไม่มี record ของนักเรียนคนนี้เลย → attendanceRate เป็น null (ไม่ใช่ 0 หรือ 100 ปลอมๆ)', () => {
    const stats = computeStudentAttendanceStats([], 'std1');
    expect(stats.attendanceRate).toBeNull();
    expect(stats.isBelowThreshold).toBe(false);
    expect(stats.totalRecorded).toBe(0);
  });

  it('นับขาด/ลา/มาสาย/มาปกติแยกกันถูกต้อง', () => {
    const records: AttendanceRecordLite[] = [
      { date: '2569-06-01', students: { std1: 'PRESENT' } },
      { date: '2569-06-02', students: { std1: 'ABSENT' } },
      { date: '2569-06-03', students: { std1: 'LATE' } },
      { date: '2569-06-04', students: { std1: 'LEAVE' } },
      { date: '2569-06-05', students: { std1: 'PRESENT' } },
    ];
    const stats = computeStudentAttendanceStats(records, 'std1');
    expect(stats.present).toBe(2);
    expect(stats.absent).toBe(1);
    expect(stats.late).toBe(1);
    expect(stats.leave).toBe(1);
    expect(stats.countedSessions).toBe(4); // ไม่รวม leave
    expect(stats.totalRecorded).toBe(5);   // รวม leave
  });

  it('สูตรอัตราเข้าเรียน = (present+late)/(present+late+absent) — leave ไม่นับทั้งตัวตั้งตัวหาร', () => {
    const records: AttendanceRecordLite[] = [
      { date: 'd1', students: { std1: 'PRESENT' } },
      { date: 'd2', students: { std1: 'PRESENT' } },
      { date: 'd3', students: { std1: 'LATE' } },
      { date: 'd4', students: { std1: 'ABSENT' } },
      { date: 'd5', students: { std1: 'LEAVE' } }, // ไม่ควรกระทบตัวเลข
    ];
    const stats = computeStudentAttendanceStats(records, 'std1');
    // (2 present + 1 late) / (2+1+1 counted) = 3/4 = 75%
    expect(stats.attendanceRate).toBe(75);
  });

  it('ธงเตือนขึ้นเมื่อ rate ต่ำกว่าเกณฑ์ default (80%) และไม่ขึ้นเมื่อเท่ากับ/สูงกว่า', () => {
    const belowRecords: AttendanceRecordLite[] = [
      { date: 'd1', students: { std1: 'ABSENT' } },
      { date: 'd2', students: { std1: 'ABSENT' } },
      { date: 'd3', students: { std1: 'PRESENT' } },
      { date: 'd4', students: { std1: 'PRESENT' } },
    ]; // 50%
    expect(computeStudentAttendanceStats(belowRecords, 'std1').isBelowThreshold).toBe(true);

    const atThreshold: AttendanceRecordLite[] = [
      { date: 'd1', students: { std1: 'PRESENT' } },
      { date: 'd2', students: { std1: 'PRESENT' } },
      { date: 'd3', students: { std1: 'PRESENT' } },
      { date: 'd4', students: { std1: 'PRESENT' } },
      { date: 'd5', students: { std1: 'ABSENT' } },
    ]; // 80% exactly — เกณฑ์ "ต่ำกว่า" ไม่ควรขึ้นธงเมื่อเท่ากับพอดี
    expect(computeStudentAttendanceStats(atThreshold, 'std1').isBelowThreshold).toBe(false);
  });

  it('ไม่ปนกับนักเรียนคนอื่นในห้องเดียวกัน (isolation)', () => {
    const records: AttendanceRecordLite[] = [
      { date: 'd1', students: { std1: 'ABSENT', std2: 'PRESENT' } },
      { date: 'd2', students: { std1: 'ABSENT', std2: 'PRESENT' } },
    ];
    const stats1 = computeStudentAttendanceStats(records, 'std1');
    const stats2 = computeStudentAttendanceStats(records, 'std2');
    expect(stats1.attendanceRate).toBe(0);
    expect(stats2.attendanceRate).toBe(100);
  });

  it('รองรับ threshold ที่กำหนดเอง', () => {
    const records: AttendanceRecordLite[] = [
      { date: 'd1', students: { std1: 'PRESENT' } },
      { date: 'd2', students: { std1: 'ABSENT' } },
    ]; // 50%
    expect(computeStudentAttendanceStats(records, 'std1', 90).isBelowThreshold).toBe(true);
    expect(computeStudentAttendanceStats(records, 'std1', 40).isBelowThreshold).toBe(false);
  });
});

describe('attendanceStatsFromCounts — สถิติจากยอดสะสม students/{id}.attendanceStats (ผู้ปกครอง/นักเรียน)', () => {
  it('ไม่มี attendanceStats เลย (undefined — นักเรียนใหม่ยังไม่เคยถูกเช็คชื่อ) → ไม่ crash, rate null', () => {
    const stats = attendanceStatsFromCounts('std1', undefined);
    expect(stats.attendanceRate).toBeNull();
    expect(stats.present).toBe(0);
  });

  it('ให้ผลตรงกับ computeStudentAttendanceStats เมื่อยอดรวมตรงกัน (สอง entry point ต้องสอดคล้องกัน)', () => {
    const records: AttendanceRecordLite[] = [
      { date: 'd1', students: { std1: 'PRESENT' } },
      { date: 'd2', students: { std1: 'ABSENT' } },
      { date: 'd3', students: { std1: 'LATE' } },
    ];
    const fromRecords = computeStudentAttendanceStats(records, 'std1');
    const fromCounts = attendanceStatsFromCounts('std1', { present: 1, absent: 1, late: 1, leave: 0 });
    expect(fromCounts.attendanceRate).toBe(fromRecords.attendanceRate);
    expect(fromCounts.countedSessions).toBe(fromRecords.countedSessions);
  });
});

describe('defaultAttendanceDateRange — ค่าเริ่มต้น (ยังไม่ยืนยันจากโรงเรียน)', () => {
  it('ครอบคลุมวันนี้ ย้อนหลัง N วัน (inclusive)', () => {
    const today = new Date('2569-06-15T10:00:00');
    const range = defaultAttendanceDateRange(30, today);
    expect(range.end).toBe('2569-06-15');
    // 30 วันรวมวันนี้ = ย้อนไป 29 วัน
    expect(range.start).toBe('2569-05-17');
  });

  it('DEFAULT_ATTENDANCE_THRESHOLD_PERCENT เป็นค่าเริ่มต้นที่ยังไม่ยืนยัน (80)', () => {
    expect(DEFAULT_ATTENDANCE_THRESHOLD_PERCENT).toBe(80);
  });
});

describe('diffAttendanceStatuses — ตรรกะที่ป้องกัน attendanceStats เพี้ยนเวลาแก้ไข attendance ย้อนหลัง', () => {
  it('doc ใหม่ (ไม่เคยมีมาก่อน) — ทุกคนเป็น "เพิ่มใหม่" (ไม่มี oldStatus)', () => {
    const deltas = diffAttendanceStatuses({}, { std1: 'PRESENT', std2: 'ABSENT' });
    expect(deltas).toHaveLength(2);
    expect(deltas.find(d => d.studentId === 'std1')).toEqual({ studentId: 'std1', oldStatus: undefined, newStatus: 'PRESENT' });
    expect(deltas.find(d => d.studentId === 'std2')).toEqual({ studentId: 'std2', oldStatus: undefined, newStatus: 'ABSENT' });
  });

  it('บันทึกซ้ำโดยไม่มีอะไรเปลี่ยน → deltas ว่างเปล่า (ไม่ touch counter เลยสักคน)', () => {
    const same = { std1: 'PRESENT' as const, std2: 'ABSENT' as const };
    expect(diffAttendanceStatuses(same, { ...same })).toHaveLength(0);
  });

  it('REGRESSION (เงื่อนไขที่ผู้ใช้กำหนด): แก้ไขสถานะนักเรียนคนเดิมย้อนหลัง (ABSENT → PRESENT) — ต้องได้ delta ลบของเก่า+บวกของใหม่ ไม่ใช่แค่บวกอย่างเดียว', () => {
    const deltas = diffAttendanceStatuses({ std1: 'ABSENT' }, { std1: 'PRESENT' });
    expect(deltas).toEqual([{ studentId: 'std1', oldStatus: 'ABSENT', newStatus: 'PRESENT' }]);
  });

  it('นักเรียนที่ไม่เปลี่ยนสถานะ ไม่ปรากฏใน deltas แม้คนอื่นในคาบเดียวกันเปลี่ยน', () => {
    const deltas = diffAttendanceStatuses(
      { std1: 'ABSENT', std2: 'PRESENT' },
      { std1: 'PRESENT', std2: 'PRESENT' },
    );
    expect(deltas).toEqual([{ studentId: 'std1', oldStatus: 'ABSENT', newStatus: 'PRESENT' }]);
  });

  it('นักเรียนที่หายไปจาก map ใหม่ทั้งหมด (ไม่ใช่ patch บางส่วน) → newStatus เป็น undefined (ลบสถานะเดิมออกจากยอดสะสม)', () => {
    const deltas = diffAttendanceStatuses({ std1: 'ABSENT' }, {});
    expect(deltas).toEqual([{ studentId: 'std1', oldStatus: 'ABSENT', newStatus: undefined }]);
  });
});

describe('roomQueryCandidates — กัน format ห้องไม่ตรงกันตอน query Firestore', () => {
  it('สร้าง variant ม./M./bare ให้ครบจากรูปแบบเดียว', () => {
    const candidates = roomQueryCandidates('ม.5/8');
    expect(candidates).toContain('ม.5/8');
    expect(candidates).toContain('M.5/8');
    expect(candidates).toContain('5/8');
  });

  it('ห้องว่างเปล่า → คืน array ว่าง (ไม่ query ทั้ง collection โดยไม่ตั้งใจ)', () => {
    expect(roomQueryCandidates('')).toEqual([]);
  });

  it('ไม่มี pattern เลข/เลข → คืนอย่างน้อยค่าดิบตัวเอง', () => {
    expect(roomQueryCandidates('Non-Student')).toContain('Non-Student');
  });
});
