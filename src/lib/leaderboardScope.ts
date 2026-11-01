import { isSameRoom } from './utils';
import { isStaffAssigned } from './staffIdentity';
import { courseActivityKey } from './courseRank';

/** วิชา (รหัสวิชา+ชั้น) ที่ครูคนนี้สอนจริงตามตารางสอน — ใช้จำกัดกระดานคะแนน Active Learning */
export interface TaughtCourse { courseKey: string; level: string; }

/** ดึงวิชา/ห้องที่ครูสอนจากเอกสาร schedules (teacherId/teacherIds = staff doc id) ไม่ซ้ำกัน */
export function taughtCoursesFromSchedules(
  schedules: Record<string, any>[],
  user: { staffId?: unknown } | null | undefined,
): TaughtCourse[] {
  const seen = new Map<string, TaughtCourse>();
  for (const sch of schedules) {
    if (!isStaffAssigned(user, sch)) continue;
    const level = String(sch.level || sch.targetClass || '').trim();
    const code = String(sch.subjectCode || sch.courseCode || '').trim();
    if (!level || !code) continue;
    const courseKey = courseActivityKey({ code, level });
    if (!seen.has(courseKey)) seen.set(courseKey, { courseKey, level });
  }
  return Array.from(seen.values());
}

/**
 * นักเรียนที่แสดงในกระดานคะแนน:
 * - เลือกวิชา → เฉพาะนักเรียนห้องของวิชานั้น (วิชาที่ไม่มีห้องในตาราง เช่น ชุมนุม = เฉพาะคนที่มีคะแนนวิชานั้น)
 * - ไม่ได้เลือกวิชา → ห้องทั้งหมดที่ครูสอน
 */
export function leaderboardStudents<S extends { studentId: string; room?: string }>(
  students: S[],
  taught: TaughtCourse[],
  courseKey: string,
  pointsOfCourse: Record<string, number>,
): S[] {
  const rooms = courseKey
    ? taught.filter(t => t.courseKey === courseKey).map(t => t.level)
    : taught.map(t => t.level);
  return students.filter(s =>
    (s.studentId in pointsOfCourse && !!courseKey && !taught.some(t => t.courseKey === courseKey)) ||
    rooms.some(r => isSameRoom(s.room, r)),
  );
}
