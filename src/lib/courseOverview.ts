/**
 * รวม "สถิติเข้าเรียนรายวิชา" กับ "คะแนนกิจกรรม/เครื่องหมายเชิดชูรายวิชา" เป็นแถวต่อวิชาเดียวกัน
 * (บน = เข้าเรียน, ล่าง = คะแนนกิจกรรม) — ใช้ร่วมกันระหว่างหน้านักเรียนและผู้ปกครอง
 */
import { courseStatKey } from './attendanceHistory';
import type { CourseAttendanceRow } from './courseAttendanceStats';
import { rankForPoints, type CoursePointsSummary, type RankLevel, type StudentPointsTotal } from './courseRank';

export interface CourseOverviewItem {
  key: string;
  name: string;
  code: string;
  inSchedule: boolean;
  /** undefined = ไม่มีข้อมูลเข้าเรียนของวิชานี้ (วิชาที่มีแต่คะแนน เช่น ชุมนุม) */
  attendance?: CourseAttendanceRow;
  /** undefined = ยังไม่มีคะแนนกิจกรรมในภาคเรียนนี้ */
  points?: CoursePointsSummary;
}

/** รหัสวิชาจาก courseKey ของคะแนน (`รหัส|ชั้น`) — ชุมนุม (elective_*) และ id เดิมไม่มีรหัส */
export function courseCodeOfPointsKey(courseKey: string): string {
  const i = courseKey.indexOf('|');
  return i > 0 ? courseKey.slice(0, i) : '';
}

/**
 * คะแนนรุ่นเก่าไม่มี courseKey (เก็บแค่ courseId = course_<scheduleId>) — หารหัสวิชาจากตารางสอนจริง:
 * schedules/{sch_<x>} ↔ courseId `course_<x>` แล้วอ่าน subjectCode/courseCode ของเอกสารนั้น
 */
export function buildCourseIdToCode(schedules: Record<string, any>[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const raw of schedules) {
    const id = String(raw.id || '');
    const code = String(raw.subjectCode || raw.courseCode || '').trim();
    if (!id || !code) continue;
    m.set(`course_${id.replace(/^sch_/, '')}`, code);
    m.set(id, code);
  }
  return m;
}

export function mergeCourseOverview(
  attendance: CourseAttendanceRow[],
  points: CoursePointsSummary[],
  opts: { courseIdToCode?: Map<string, string>; levels?: RankLevel[] } = {},
): {
  items: CourseOverviewItem[];
  /** คะแนนที่ไม่ระบุวิชา (ก่อนระบบแยกวิชา) — แสดงแยก ไม่มีแรงค์ */
  unassigned: CoursePointsSummary | null;
} {
  const items: CourseOverviewItem[] = attendance.map(a => ({
    key: a.key, name: a.name, code: a.code, inSchedule: a.inSchedule, attendance: a,
  }));
  const byKey = new Map(items.map(i => [i.key, i]));
  const extra = new Map<string, CourseOverviewItem>();
  let unassigned: CoursePointsSummary | null = null;
  const add = (it: CourseOverviewItem, p: CoursePointsSummary) => {
    // หลายก้อนที่ชี้วิชาเดียวกัน (เช่น คะแนนรุ่นเก่ารายคาบหลาย id) — รวมคะแนนแล้วคิดแรงค์ใหม่
    if (!it.points) { it.points = p; return; }
    const total = it.points.points + p.points;
    it.points = { ...it.points, points: total, rank: rankForPoints(total, opts.levels) };
  };
  for (const p of points) {
    if (p.unassigned) { unassigned = p; continue; }
    const code = courseCodeOfPointsKey(p.courseId) || opts.courseIdToCode?.get(p.courseId) || '';
    const hit = code ? byKey.get(courseStatKey(code)) : undefined;
    if (hit) { add(hit, p); continue; }
    // วิชาที่มีแต่คะแนน (ไม่อยู่ในตาราง/ชุมนุม) — แถวของตัวเอง (รวมก้อนที่ key เดียวกัน)
    const k = `points:${code || p.courseName || p.courseId}`; // ไม่มีรหัส = จัดกลุ่มตามชื่อวิชาที่บันทึกไว้
    const row = extra.get(k) ?? { key: k, name: p.courseName, code, inSchedule: false };
    add(row, p);
    extra.set(k, row);
  }
  return { items: [...items, ...extra.values()], unassigned };
}

export interface RoomPointsRow {
  studentId: string;
  studentNo: number;
  name: string;
  total: number;
  byCourse: { courseName: string; points: number }[];
}

/**
 * แถวกราฟของครูที่ปรึกษา: นักเรียนทุกคนในห้อง เรียงตามเลขที่ (คนที่ยังไม่มีคะแนนได้ 0 — แท่งว่าง)
 * เลขที่ไม่มี/ซ้ำ เรียงต่อด้วยชื่อ เพื่อให้ลำดับคงที่
 */
export function buildRoomPointsRows(
  students: { studentId: string; studentNo?: number | string | null; name: string; nickname?: string }[],
  totals: StudentPointsTotal[],
): RoomPointsRow[] {
  const byId = new Map(totals.map(t => [t.studentId, t]));
  const no = (v: number | string | null | undefined) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : Number.MAX_SAFE_INTEGER;
  };
  return students
    .map(s => {
      const t = byId.get(s.studentId);
      return {
        studentId: s.studentId,
        studentNo: no(s.studentNo),
        name: s.nickname ? `${s.name} (${s.nickname})` : s.name,
        total: t?.total ?? 0,
        byCourse: t?.byCourse ?? [],
      };
    })
    .sort((a, b) => a.studentNo - b.studentNo || a.name.localeCompare(b.name, 'th'));
}
