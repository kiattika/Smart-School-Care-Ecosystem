/**
 * ประวัติการเข้าเรียนรายบุคคล รายวัน-รายคาบ-รายวิชา — ตรรกะบริสุทธิ์ (test ได้)
 * ใช้โดยครูผู้สอนและครูที่ปรึกษา (มีสิทธิ์อ่าน attendance_records ตรง) — นักเรียน/ผู้ปกครองใช้ยอดสะสม
 * students/{id}.courseAttendanceStats แทน (ดู courseAttendanceStats.ts)
 *
 * วิชาของแต่ละ record: ใช้ courseCode ที่ครูบันทึกไว้ในเอกสาร; ข้อมูลก่อนมีฟิลด์นี้ → หาจากตารางสอนจริง
 * (ห้อง + วันในสัปดาห์ของ date + เลขคาบ) ถ้าหาไม่เจอ = "ไม่ทราบวิชา" ไม่เดา
 */
import { attendanceStatsFromCounts, StudentAttendanceStats, AttendanceStatusValue } from './studentAttendanceStats';
import { isScheduleForRoom, RawScheduleDoc, WEEKDAY_KEYS } from './studentDaySchedule';

/** key ของ field ใน Firestore map — ห้ามมี . / [ ] * ~ หรือช่องว่าง (ใช้ใน field path ของ update) */
export function courseStatKey(code: string): string {
  return String(code || '').trim().replace(/[.\/\[\]*~`\s]+/g, '_');
}

export interface AttendanceRecordFull {
  id?: string;
  date: string; // YYYY-MM-DD
  room?: string;
  periodNumber?: number;
  courseCode?: string;
  courseName?: string;
  source?: string;
  checkedByName?: string;
  students: Record<string, AttendanceStatusValue>;
}

export interface AttendanceLogRow {
  key: string; // date|period
  date: string;
  periodNumber: number | null;
  courseKey: string; // '' = ไม่ทราบวิชา
  courseCode: string;
  courseName: string;
  status: AttendanceStatusValue;
  checkedByName: string;
  source: string; // HOMEROOM_DEFAULT | PERIOD_OVERRIDE | '' (ข้อมูลเก่า)
}

const dayKeyOfDate = (date: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return '';
  return WEEKDAY_KEYS[new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getDay()];
};

function schedDayKey(raw: RawScheduleDoc): string {
  if (typeof raw.dayOfWeek === 'string' && raw.dayOfWeek) return raw.dayOfWeek.toLowerCase();
  if (typeof raw.scheduleDay === 'number') return WEEKDAY_KEYS[raw.scheduleDay % 7] || '';
  return '';
}

/** วิชาของ record: courseCode ในเอกสารก่อน ไม่มีค่อยหาจากตารางสอน (ห้อง+วัน+คาบ) */
export function resolveRecordCourse(
  rec: Pick<AttendanceRecordFull, 'date' | 'room' | 'periodNumber' | 'courseCode' | 'courseName'>,
  schedules: RawScheduleDoc[],
): { code: string; name: string } | null {
  if (rec.courseCode && rec.courseCode.trim()) return { code: rec.courseCode, name: rec.courseName || rec.courseCode };
  if (rec.periodNumber === undefined || rec.periodNumber === null) return null;
  const day = dayKeyOfDate(rec.date);
  const hit = schedules.find(s =>
    schedDayKey(s) === day &&
    Number(s.periodNumber) === rec.periodNumber &&
    isScheduleForRoom(s, rec.room),
  );
  if (!hit) return null;
  const code = String(hit.subjectCode || hit.courseCode || '').trim();
  if (!code) return null;
  return { code, name: String(hit.subjectName || hit.courseName || code) };
}

/** แถวประวัติของนักเรียนคนเดียว เรียงวันที่ใหม่→เก่า แล้วคาบน้อย→มาก */
export function buildStudentAttendanceLog(
  records: AttendanceRecordFull[],
  schedules: RawScheduleDoc[],
  studentId: string,
): AttendanceLogRow[] {
  const rows: AttendanceLogRow[] = [];
  for (const rec of records) {
    const status = rec.students?.[studentId];
    if (!status) continue;
    const course = resolveRecordCourse(rec, schedules);
    rows.push({
      key: `${rec.date}|${rec.periodNumber ?? ''}`,
      date: rec.date,
      periodNumber: rec.periodNumber ?? null,
      courseKey: course ? courseStatKey(course.code) : '',
      courseCode: course?.code || '',
      courseName: course?.name || '',
      status,
      checkedByName: rec.checkedByName || '',
      source: rec.source || '',
    });
  }
  return rows.sort((a, b) => b.date.localeCompare(a.date) || (a.periodNumber ?? 99) - (b.periodNumber ?? 99));
}

export interface CourseStatsRow { courseKey: string; code: string; name: string; stats: StudentAttendanceStats }

/** สรุปรายวิชาจากแถวประวัติ (วิชาที่หาไม่เจอรวมเป็น "ไม่ทราบวิชา") */
export function aggregateLogByCourse(rows: AttendanceLogRow[], studentId: string): CourseStatsRow[] {
  const map = new Map<string, { code: string; name: string; c: { present: number; absent: number; late: number; leave: number } }>();
  for (const r of rows) {
    let e = map.get(r.courseKey);
    if (!e) { e = { code: r.courseCode, name: r.courseName || 'ไม่ทราบวิชา', c: { present: 0, absent: 0, late: 0, leave: 0 } }; map.set(r.courseKey, e); }
    e.c[r.status.toLowerCase() as 'present' | 'absent' | 'late' | 'leave']++;
  }
  return [...map.entries()]
    .map(([courseKey, e]) => ({ courseKey, code: e.code, name: e.name, stats: attendanceStatsFromCounts(studentId, e.c) }))
    .sort((a, b) => a.code.localeCompare(b.code, 'th'));
}
