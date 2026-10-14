/**
 * ปพ.5 (ใบคะแนนรายวิชา) สำหรับครูผู้สอน — คำนวณจากคะแนนที่ครูบันทึกในสมุดคะแนนจริงเท่านั้น
 * ไม่มีข้อมูล = เว้นว่าง (ห้ามเติม 0/ค่าสมมติ); ร/มส ไม่มีแหล่งข้อมูลในระบบ จึงไม่นับ
 */
import { gradeFromTotal } from './gradeReport';

export interface Pp5Max { pre: number; mid: number; post: number; final: number }
export interface Pp5Student { studentId: string; studentNo: number | null; name: string; room: string }
export interface Pp5Score {
  preMidterm?: number; midterm?: number; postMidterm?: number; final?: number; total?: number;
  grade?: string; passFailResult?: 'PASS' | 'FAIL' | null;
}
export interface Pp5Attendance { present: number; late: number; absent: number; leave: number }

export interface Pp5Row {
  student: Pp5Student;
  hasScore: boolean;
  pre: number | null; mid: number | null; post: number | null; final: number | null;
  total: number | null; percent: number | null; grade: string | null;
  attendance: Pp5Attendance | null;
  attendancePercent: number | null;
}

export const PP5_GRADES = ['4', '3.5', '3', '2.5', '2', '1.5', '1', '0'] as const;

const n = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** ร้อยละเวลาเรียน = (มา+สาย) / คาบที่เช็คทั้งหมด; ไม่มีเช็คชื่อ = null */
export function attendancePercent(a: Pp5Attendance | null): number | null {
  if (!a) return null;
  const total = a.present + a.late + a.absent + a.leave;
  return total > 0 ? ((a.present + a.late) / total) * 100 : null;
}

export function buildPp5Rows(input: {
  students: readonly Pp5Student[];
  scoreOf: (studentId: string) => Pp5Score | undefined;
  max: Pp5Max;
  isActivity: boolean;
  attendanceOf: (studentId: string) => Pp5Attendance | null;
}): Pp5Row[] {
  const maxTotal = input.max.pre + input.max.mid + input.max.post + input.max.final;
  return input.students.map(student => {
    const sc = input.scoreOf(student.studentId);
    const attendance = input.attendanceOf(student.studentId);
    const base = { student, attendance, attendancePercent: attendancePercent(attendance) };
    if (!sc) return { ...base, hasScore: false, pre: null, mid: null, post: null, final: null, total: null, percent: null, grade: null };
    if (input.isActivity) {
      return { ...base, hasScore: !!sc.passFailResult, pre: null, mid: null, post: null, final: null, total: null, percent: null,
        grade: sc.passFailResult === 'PASS' ? 'ผ' : sc.passFailResult === 'FAIL' ? 'มผ' : null };
    }
    const parts = [n(sc.preMidterm), n(sc.midterm), n(sc.postMidterm), n(sc.final)];
    const total = n(sc.total) ?? (parts.some(p => p !== null) ? parts.reduce<number>((s, p) => s + (p ?? 0), 0) : null);
    return { ...base, hasScore: total !== null, pre: parts[0], mid: parts[1], post: parts[2], final: parts[3], total,
      percent: total !== null && maxTotal > 0 ? (total / maxTotal) * 100 : null,
      grade: total !== null ? (sc.grade && sc.grade !== '' ? sc.grade : gradeFromTotal(maxTotal > 0 ? (total / maxTotal) * 100 : total)) : null };
  });
}

export interface Pp5Summary {
  count: number;
  scored: number;
  avgPercent: number | null;
  avgAttendance: number | null;
  distribution: Record<string, number>;
  activityPassed: number; activityFailed: number;
}

export function summarizePp5(rows: readonly Pp5Row[]): Pp5Summary {
  const distribution: Record<string, number> = Object.fromEntries(PP5_GRADES.map(g => [g, 0]));
  let pass = 0, fail = 0;
  rows.forEach(r => {
    if (r.grade === 'ผ') pass++; else if (r.grade === 'มผ') fail++;
    else if (r.grade && r.grade in distribution) distribution[r.grade]++;
  });
  const pcts = rows.map(r => r.percent).filter((v): v is number => v !== null);
  const atts = rows.map(r => r.attendancePercent).filter((v): v is number => v !== null);
  const avg = (l: number[]) => (l.length ? l.reduce((s, v) => s + v, 0) / l.length : null);
  return { count: rows.length, scored: rows.filter(r => r.hasScore).length, avgPercent: avg(pcts), avgAttendance: avg(atts), distribution, activityPassed: pass, activityFailed: fail };
}

/** รวมสถิติเข้าเรียนของวิชา (courseAttendanceStats ในเอกสารนักเรียน คีย์ = courseKey) ตามรหัสวิชา; ไม่มี = null */
export function attendanceForCourse(stats: unknown, courseCode: string): Pp5Attendance | null {
  if (!stats || typeof stats !== 'object' || !courseCode) return null;
  const acc: Pp5Attendance = { present: 0, late: 0, absent: 0, leave: 0 };
  let found = false;
  Object.values(stats as Record<string, any>).forEach(e => {
    if (e && String(e.code || '').trim() === courseCode.trim()) {
      acc.present += Number(e.present) || 0; acc.late += Number(e.late) || 0; acc.absent += Number(e.absent) || 0; acc.leave += Number(e.leave) || 0;
      found = true;
    }
  });
  return found ? acc : null;
}
