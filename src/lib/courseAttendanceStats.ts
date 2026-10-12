/**
 * สถิติการเข้าเรียน "แยกรายวิชา" ต่อนักเรียน — ตรรกะบริสุทธิ์ (test ได้)
 *
 * ที่มา: ตอนครูบันทึก attendance_records ของคาบวิชา (บันทึก courseCode/courseName ลงเอกสารด้วย)
 * ระบบ sync ยอดสะสมไปที่ students/{id}.courseAttendanceStats.{key} = { code, name, present, absent, late, leave }
 * (derived cache เหมือน attendanceStats — นักเรียน/ผู้ปกครองอ่านเอกสาร students ของตัวเองได้อยู่แล้ว
 * โดยไม่ต้องเปิดสิทธิ์อ่าน attendance_records ทั้งห้อง) ยอดนับตั้งแต่เริ่มบันทึกรหัสวิชาลงเอกสารเท่านั้น
 * — การเช็คชื่อเก่าที่ไม่มี courseCode ย้อนนับไม่ได้ (ไม่เดาวิชาจากตาราง)
 */
import { attendanceStatsFromCounts, StudentAttendanceStats, AttendanceStatusValue } from './studentAttendanceStats';
import { isScheduleForRoom, RawScheduleDoc } from './studentDaySchedule';
import { AttendanceRecordFull, buildStudentAttendanceLog, courseStatKey } from './attendanceHistory';

export interface CourseAttendanceCounts { code: string; name: string; present: number; absent: number; late: number; leave: number }
export type CourseAttendanceStatsMap = Record<string, Partial<CourseAttendanceCounts>>;

export { courseStatKey };

export interface CourseRecordSide {
  courseCode?: string | null;
  courseName?: string | null;
  students: Record<string, AttendanceStatusValue>;
}

export interface CourseStatDelta { studentId: string; key: string; code: string; name: string; status: AttendanceStatusValue; by: 1 | -1 }

/**
 * ผลต่างของยอดรายวิชาเมื่อเขียน record ทับของเดิม: ลดสถานะเก่า (ใต้วิชาเก่า) แล้วเพิ่มสถานะใหม่ (ใต้วิชาใหม่)
 * — คาบที่ไม่มี courseCode (เช่นโฮมรูม) ไม่นับรายวิชา; ถ้าสถานะและวิชาไม่เปลี่ยนไม่สร้าง delta
 */
export function diffCourseAttendance(oldSide: CourseRecordSide | null, newSide: CourseRecordSide): CourseStatDelta[] {
  const oldKey = oldSide?.courseCode ? courseStatKey(oldSide.courseCode) : '';
  const newKey = newSide.courseCode ? courseStatKey(newSide.courseCode) : '';
  const out: CourseStatDelta[] = [];
  const ids = new Set([...Object.keys(oldSide?.students || {}), ...Object.keys(newSide.students || {})]);
  for (const studentId of ids) {
    const o = oldKey ? oldSide!.students[studentId] : undefined;
    const n = newKey ? newSide.students[studentId] : undefined;
    if (o === n && oldKey === newKey) continue;
    if (o && oldKey) out.push({ studentId, key: oldKey, code: String(oldSide!.courseCode), name: String(oldSide!.courseName || oldSide!.courseCode), status: o, by: -1 });
    if (n && newKey) out.push({ studentId, key: newKey, code: String(newSide.courseCode), name: String(newSide.courseName || newSide.courseCode), status: n, by: 1 });
  }
  return out;
}

export interface CourseAttendanceRow {
  key: string;
  code: string;
  name: string;
  /** true = มีในตารางเรียนของห้องภาคเรียนนี้ */
  inSchedule: boolean;
  stats: StudentAttendanceStats;
}

/**
 * แถวสถิติรายวิชา = ทุกวิชาในตารางเรียนของห้องนักเรียน (ภาคเรียนปัจจุบัน) + วิชาที่เคยมียอดแต่ไม่อยู่ในตารางแล้ว
 * วิชาที่ยังไม่เคยเช็คชื่อได้แถวยอด 0 (rate = null → UI แสดง "ยังไม่มีข้อมูล")
 */
export function buildCourseAttendanceRows(input: {
  schedules: RawScheduleDoc[];
  studentRoom?: string;
  studentId: string;
  courseStats?: CourseAttendanceStatsMap | null;
}): CourseAttendanceRow[] {
  const { schedules, studentRoom, studentId, courseStats } = input;
  const subjects = new Map<string, { code: string; name: string }>();
  for (const raw of schedules) {
    if (!isScheduleForRoom(raw, studentRoom)) continue;
    const code = String(raw.subjectCode || raw.courseCode || '').trim();
    if (!code) continue;
    const key = courseStatKey(code);
    if (!subjects.has(key)) subjects.set(key, { code, name: String(raw.subjectName || raw.courseName || code) });
  }
  const rows: CourseAttendanceRow[] = [];
  const seen = new Set<string>();
  const mk = (key: string, code: string, name: string, inSchedule: boolean) => {
    seen.add(key);
    rows.push({ key, code, name, inSchedule, stats: attendanceStatsFromCounts(studentId, courseStats?.[key]) });
  };
  for (const [key, s] of subjects) mk(key, s.code, courseStats?.[key]?.name || s.name, true);
  for (const [key, c] of Object.entries(courseStats || {})) {
    if (!seen.has(key)) mk(key, c.code || key, c.name || c.code || key, false);
  }
  return rows.sort((a, b) => a.code.localeCompare(b.code, 'th'));
}

/**
 * คำนวณยอดสะสมรายวิชา "ใหม่ทั้งหมด" ของนักเรียนคนเดียวจาก attendance_records + ตารางสอน (ใช้ backfill การเช็คชื่อเก่า
 * ที่ยังไม่มี courseCode — หาวิชาจากห้อง+วัน+คาบ; หาไม่เจอไม่นับ) ผลลัพธ์ = ค่าที่ควรอยู่ใน students/{id}.courseAttendanceStats
 */
export function computeCourseStatsMap(
  records: AttendanceRecordFull[],
  schedules: RawScheduleDoc[],
  studentId: string,
): CourseAttendanceStatsMap {
  const out: CourseAttendanceStatsMap = {};
  for (const row of buildStudentAttendanceLog(records, schedules, studentId)) {
    if (!row.courseKey) continue;
    const e = (out[row.courseKey] ||= { code: row.courseCode, name: row.courseName || row.courseCode, present: 0, absent: 0, late: 0, leave: 0 });
    const f = row.status.toLowerCase() as 'present' | 'absent' | 'late' | 'leave';
    e[f] = (e[f] || 0) + 1;
  }
  return out;
}
