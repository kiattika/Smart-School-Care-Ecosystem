/**
 * รายการผังที่นั่งที่ครูคนหนึ่งควรจัดล่วงหน้า — คำนวณจาก schedules จริงของภาคเรียนปัจจุบัน (ไม่เดา/ไม่เติม)
 *
 * - วิชาปกติ/โฮมรูม: 1 รายการต่อ (ชั้น/ห้องเรียน + ห้องกายภาพ) — ทุกวิชาที่ครูสอนห้องเดียวกันรวมเป็นผังเดียว
 * - วิชา AP: 1 รายการต่อ (รหัสวิชา + ห้องกายภาพ) รายชื่อมาจากรายชื่อ AP ที่ครูคัดไว้
 * - ข้ามแถวที่ไม่ใช่ห้องเรียน (Non-Student, ระดับชั้นลอย ๆ เช่น "M.4" ที่ไม่มีเลขห้อง, ชุมนุมรวมระดับ)
 */
import { isApCourse, apLevelsForSchedule, levelsOfSchedule } from './apCourses';
import { isStaffAssigned } from './staffIdentity';
import { normalizeEmail } from './normalizeEmail';
import { classKeyOf, seatingTargetFor, seatingTargetLabel, type SeatingLayoutKind, type SeatingTarget } from './seatingLayoutKey';
import type { RawScheduleDoc } from './studentDaySchedule';

export interface SeatingPlanItem {
  target: SeatingTarget;
  kind: SeatingLayoutKind;
  /** ชั้น/ห้องเรียนที่แสดง (CLASS = ห้องนั้น; AP = ห้องแรกที่รวมกัน) */
  level: string;
  /** ทุกห้องเรียนที่รวมกัน (CLASS = 1 ห้อง; AP = หลายห้อง) */
  levels: string[];
  physicalRoom: string;
  /** รหัสวิชาแรกสุด (ใช้เป็นรหัสบนผัง) */
  code: string;
  courses: { code: string; name: string }[];
  /** จำนวนคาบ/สัปดาห์ที่ใช้ผังนี้ */
  periods: number;
  label: string;
}

function hasTeacherRefs(raw: RawScheduleDoc): boolean {
  if (typeof raw.teacherId === 'string' && raw.teacherId) return true;
  return Array.isArray(raw.teacherIds) && raw.teacherIds.some((t: unknown) => typeof t === 'string' && t);
}

export function listSeatingPlanItems(input: {
  schedules: RawScheduleDoc[];
  staffId: string | null | undefined;
  /** ใช้จับคู่เฉพาะ doc รุ่นเก่าที่ไม่มี teacherId/teacherIds */
  staffEmail?: string | null;
}): SeatingPlanItem[] {
  const { schedules, staffId, staffEmail } = input;
  if (!staffId) return [];
  const me = { staffId };
  const myEmail = staffEmail ? normalizeEmail(staffEmail) : '';

  const byKey = new Map<string, SeatingPlanItem>();
  const seenSlot = new Set<string>();

  for (const raw of schedules) {
    const mine = isStaffAssigned(me, raw)
      || (!!myEmail && !hasTeacherRefs(raw) && normalizeEmail(String(raw.teacherEmail || '')) === myEmail);
    if (!mine) continue;

    const code = String(raw.subjectCode || raw.courseCode || '').trim();
    const name = String(raw.subjectName || raw.courseName || '').trim();
    const physicalRoom = String(raw.room || '').trim();
    const ap = isApCourse(name);

    let kind: SeatingLayoutKind;
    let levels: string[];
    if (ap) {
      kind = 'AP';
      levels = apLevelsForSchedule(raw as never, schedules as never[]);
      if (levels.length === 0) levels = levelsOfSchedule(raw);
      if (!code || levels.length === 0) continue;
    } else {
      kind = 'CLASS';
      const level = String(raw.level || raw.targetClass || '').trim();
      if (!classKeyOf(level)) continue; // ไม่ใช่ห้องเรียน (Non-Student / ชั้นลอย ๆ) = ไม่มีผัง
      levels = [level];
    }

    const target = seatingTargetFor({ ownerStaffId: staffId, kind, level: levels[0], physicalRoom, code });
    if (!target) continue;

    // นับคาบไม่ซ้ำ (วัน+คาบ) ต่อผัง — doc ซ้ำ/แยกชั้นของ AP ไม่ถูกนับซ้ำ
    const day = String(raw.dayOfWeek ?? raw.scheduleDay ?? '');
    const slot = `${target.layoutId}|${day}|${raw.periodNumber}`;
    const isNewSlot = !seenSlot.has(slot);
    seenSlot.add(slot);

    let item = byKey.get(target.layoutId);
    if (!item) {
      item = {
        target, kind, level: levels[0], levels, physicalRoom, code,
        courses: [], periods: 0,
        label: seatingTargetLabel({ kind, level: levels[0], physicalRoom, code }),
      };
      byKey.set(target.layoutId, item);
    }
    if (isNewSlot) item.periods += 1;
    if (!item.courses.some(c => c.code === code)) item.courses.push({ code, name });
  }

  return [...byKey.values()].sort((a, b) => {
    const ca = classKeyOf(a.level) || '', cb = classKeyOf(b.level) || '';
    const [a1, a2] = ca.split('-').map(Number), [b1, b2] = cb.split('-').map(Number);
    return (a1 - b1) || (a2 - b2) || a.physicalRoom.localeCompare(b.physicalRoom, 'th', { numeric: true }) || a.kind.localeCompare(b.kind);
  });
}
