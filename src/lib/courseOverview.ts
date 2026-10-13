/**
 * รวม "สถิติเข้าเรียนรายวิชา" กับ "คะแนนกิจกรรม/เครื่องหมายเชิดชูรายวิชา" เป็นแถวต่อวิชาเดียวกัน
 * (บน = เข้าเรียน, ล่าง = คะแนนกิจกรรม) — ใช้ร่วมกันระหว่างหน้านักเรียนและผู้ปกครอง
 */
import { courseStatKey } from './attendanceHistory';
import type { CourseAttendanceRow } from './courseAttendanceStats';
import type { CoursePointsSummary } from './courseRank';

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

export function mergeCourseOverview(attendance: CourseAttendanceRow[], points: CoursePointsSummary[]): {
  items: CourseOverviewItem[];
  /** คะแนนที่ไม่ระบุวิชา (ก่อนระบบแยกวิชา) — แสดงแยก ไม่มีแรงค์ */
  unassigned: CoursePointsSummary | null;
} {
  const items: CourseOverviewItem[] = attendance.map(a => ({
    key: a.key, name: a.name, code: a.code, inSchedule: a.inSchedule, attendance: a,
  }));
  const byKey = new Map(items.map(i => [i.key, i]));
  let unassigned: CoursePointsSummary | null = null;
  for (const p of points) {
    if (p.unassigned) { unassigned = p; continue; }
    const code = courseCodeOfPointsKey(p.courseId);
    const hit = code ? byKey.get(courseStatKey(code)) : undefined;
    if (hit && !hit.points) { hit.points = p; continue; }
    // วิชาที่มีแต่คะแนน (ไม่อยู่ในตาราง/ชุมนุม) — แถวของตัวเอง
    items.push({ key: `points:${p.courseId}`, name: p.courseName, code: code || '', inSchedule: false, points: p });
  }
  return { items, unassigned };
}
