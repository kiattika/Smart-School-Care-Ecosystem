/**
 * ตารางสอนวันนี้ของบุคลากร (หน้ามือถือ) — คำนวณจาก schedules จริง ตรรกะบริสุทธิ์ (test ได้)
 * จับคู่ผู้สอนเหมือน TeacherPortal: อีเมลตรง (normalize) หรือ staffId อยู่ใน teacherId/teacherIds; ไม่มีข้อมูล = แถวว่าง (ไม่เดา)
 */
import { WEEKDAY_KEYS, scheduleDayKey, type RawScheduleDoc, type SchedulePeriodLite, type DayScheduleStatus } from './studentDaySchedule';
import { isStaffAssigned } from './staffIdentity';
import { normalizeEmail } from '../utils/teacherLoadReportParser';

export interface TeacherDayRow {
  key: string;
  periodNumber: number;
  periodLabel: string;
  startTime: string;
  endTime: string;
  code: string;
  subject: string;
  /** ชั้น/ห้องเรียนที่สอน เช่น ม.5/8 */
  classLabel: string;
  isActivity: boolean;
  status: DayScheduleStatus;
}

const toMinutes = (hhmm: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

function docDayKey(raw: RawScheduleDoc): string {
  if (typeof raw.dayOfWeek === 'string' && raw.dayOfWeek) return raw.dayOfWeek.toLowerCase();
  if (typeof raw.scheduleDay === 'number') return WEEKDAY_KEYS[raw.scheduleDay % 7] || '';
  return '';
}

export function buildTeacherDaySchedule(input: {
  schedules: RawScheduleDoc[];
  periods: SchedulePeriodLite[];
  user: { email?: string | null; staffId?: string | null };
  now: Date;
}): { dayKey: string; rows: TeacherDayRow[] } {
  const { schedules, periods, user, now } = input;
  const dayKey = scheduleDayKey(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const myEmail = user.email ? normalizeEmail(user.email) : '';
  const byNumber = new Map(periods.map(p => [p.periodNumber, p]));
  const seen = new Set<string>();
  const rows: TeacherDayRow[] = [];

  for (const raw of schedules) {
    if (docDayKey(raw) !== dayKey) continue;
    if (typeof raw.periodNumber !== 'number') continue;
    const email = normalizeEmail(String(raw.teacherEmail || raw.unlinkedTeacherEmail || ''));
    const mine = (!!myEmail && !!email && email === myEmail) || isStaffAssigned({ staffId: user.staffId }, raw);
    if (!mine) continue;
    const code = String(raw.subjectCode || raw.courseCode || '');
    const classLabel = String(raw.level || raw.targetClass || raw.room || '');
    const dedupe = `${raw.periodNumber}|${code}|${classLabel}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);

    const p = byNumber.get(raw.periodNumber);
    const start = p?.startTime || '';
    const end = p?.endTime || '';
    const s = toMinutes(start), e = toMinutes(end);
    rows.push({
      key: String(raw.id || dedupe),
      periodNumber: raw.periodNumber,
      periodLabel: raw.periodNumber === 0 ? 'HR' : `คาบ ${raw.periodNumber}`,
      startTime: start,
      endTime: end,
      code,
      subject: String(raw.subjectName || raw.courseName || code || 'รายวิชา'),
      classLabel,
      isActivity: raw.subjectType === 'ACTIVITY' || raw.type === 'ACTIVITY',
      status: s === null || e === null ? 'UPCOMING' : nowMin >= e ? 'DONE' : nowMin >= s ? 'NOW' : 'UPCOMING',
    });
  }
  rows.sort((a, b) => a.periodNumber - b.periodNumber);
  return { dayKey, rows };
}
