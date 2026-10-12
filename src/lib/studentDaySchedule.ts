/**
 * ตารางเรียนประจำวันของนักเรียน — คำนวณจาก schedules จริง (ห้อง + วันนี้ + ภาคเรียนปัจจุบัน) ตรรกะบริสุทธิ์ (test ได้)
 *
 * schedule doc ที่ import มี `dayOfWeek` ('monday'…), `subjectCode`/`subjectName`, `level` (ชั้น/ห้อง เช่น ม.5/8),
 * `room` (อาจเป็นห้องกายภาพ), `periodNumber`; doc รูปแบบเก่าใช้ `scheduleDay` (1-5) / `courseCode` / `courseName` / `targetClass`
 * — รองรับทั้งสองแบบ (เหมือน TeacherPortal). ไม่รู้ว่านักเรียน "เช็คชื่อแล้วหรือยัง" รายคาบ (ผู้ปกครอง/นักเรียนอ่าน
 * attendance_records ตรงไม่ได้) จึงแสดงสถานะตามเวลาเท่านั้น ไม่อ้างว่าเช็คชื่อแล้ว
 */
import { isSameRoom } from './utils';

export const WEEKDAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

export interface SchedulePeriodLite { periodNumber: number; periodName?: string; startTime: string; endTime: string; periodType?: string }

export type RawScheduleDoc = Record<string, any>;

export type DayScheduleStatus = 'DONE' | 'NOW' | 'UPCOMING';

export interface DayScheduleRow {
  key: string;
  periodNumber: number;
  periodLabel: string;
  startTime: string;
  endTime: string;
  code: string;
  subject: string;
  /** ห้องกายภาพ/ห้องเรียนตามที่ import (อาจว่าง) */
  place: string;
  isActivity: boolean;
  status: DayScheduleStatus;
}

export const scheduleDayKey = (d: Date): string => WEEKDAY_KEYS[d.getDay()];

function docDayKey(raw: RawScheduleDoc): string {
  if (typeof raw.dayOfWeek === 'string' && raw.dayOfWeek) return raw.dayOfWeek.toLowerCase();
  if (typeof raw.scheduleDay === 'number') return WEEKDAY_KEYS[raw.scheduleDay % 7] || '';
  return '';
}

const toMinutes = (hhmm: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

export function isScheduleForRoom(raw: RawScheduleDoc, studentRoom?: string): boolean {
  if (!studentRoom) return false;
  return isSameRoom(raw.level, studentRoom) || isSameRoom(raw.room, studentRoom) || isSameRoom(raw.targetClass, studentRoom);
}

export function buildStudentDaySchedule(input: {
  schedules: RawScheduleDoc[];
  periods: SchedulePeriodLite[];
  studentRoom?: string;
  now: Date;
}): { dayKey: string; rows: DayScheduleRow[] } {
  const { schedules, periods, studentRoom, now } = input;
  const dayKey = scheduleDayKey(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const byNumber = new Map(periods.map(p => [p.periodNumber, p]));
  const seen = new Set<string>();
  const rows: DayScheduleRow[] = [];

  for (const raw of schedules) {
    if (docDayKey(raw) !== dayKey) continue;
    if (!isScheduleForRoom(raw, studentRoom)) continue;
    const periodNumber = raw.periodNumber;
    if (typeof periodNumber !== 'number') continue;
    const code = String(raw.subjectCode || raw.courseCode || '');
    const dedupe = `${periodNumber}|${code}`; // ครูหลายคนสอนร่วมกัน = หลาย doc ต่อคาบเดียวกัน
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);

    const p = byNumber.get(periodNumber);
    const start = p?.startTime || '';
    const end = p?.endTime || '';
    const s = toMinutes(start), e = toMinutes(end);
    const status: DayScheduleStatus = s === null || e === null ? 'UPCOMING' : nowMin >= e ? 'DONE' : nowMin >= s ? 'NOW' : 'UPCOMING';
    rows.push({
      key: `${raw.id || dedupe}`,
      periodNumber,
      periodLabel: periodNumber === 0 ? 'HR' : `คาบ ${periodNumber}`,
      startTime: start,
      endTime: end,
      code,
      subject: String(raw.subjectName || raw.courseName || code || 'รายวิชา'),
      place: raw.level && raw.room && !isSameRoom(raw.room, raw.level) ? String(raw.room) : '',
      isActivity: raw.subjectType === 'ACTIVITY',
      status,
    });
  }
  rows.sort((a, b) => a.periodNumber - b.periodNumber);
  return { dayKey, rows };
}
