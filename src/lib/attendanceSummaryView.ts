/**
 * มุมมองสรุปการมาเรียนของผู้บริหาร — อ่านจาก attendance_summary/current (Cloud Function สร้างจากเช็คโฮมรูม)
 * รูปแบบเอกสารตรงกับ functions/src/attendanceSummaryLogic.ts (ตัวเลขรวมเท่านั้น ไม่มีชื่อนักเรียน)
 * ร้อยละการมาเรียน = (มา + สาย) ÷ ทั้งหมด (รวมลา) — ข้อมูลว่าง/ทั้งหมด 0 = ไม่แสดงร้อยละ (null)
 */
export interface Counts { present: number; late: number; absent: number; leave: number }
export interface DailyRow extends Counts { date: string; rooms: number }
export interface RoomRow extends Counts { room: string; level: string; days: number }
export interface PeriodRooms { from: string; to: string; rooms: RoomRow[] }
export type PeriodKey = 'day' | 'week' | 'month' | 'term';
export interface AttendanceSummaryView {
  asOf: string;
  term: { academicYear: string; term: '1' | '2'; from: string; to: string };
  daily: DailyRow[];
  periods: Record<PeriodKey, PeriodRooms>;
}

export const PERIOD_LABEL: Record<PeriodKey, string> = { day: 'รายวัน', week: 'รายสัปดาห์', month: 'รายเดือน', term: 'รายภาคเรียน' };
export const PERIOD_KEYS: PeriodKey[] = ['day', 'week', 'month', 'term'];

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
const counts = (x: any): Counts => ({ present: num(x?.present), late: num(x?.late), absent: num(x?.absent), leave: num(x?.leave) });
const period = (x: any): PeriodRooms => ({
  from: String(x?.from || ''), to: String(x?.to || ''),
  rooms: Array.isArray(x?.rooms) ? x.rooms.map((r: any) => ({ room: String(r?.room || ''), level: String(r?.level || 'อื่น ๆ'), days: num(r?.days), ...counts(r) })).filter((r: RoomRow) => r.room) : [],
});

/** เอกสารดิบ → มุมมอง (รูปแบบไม่ถูกต้อง = null ไม่เดา) */
export function parseAttendanceSummary(data: unknown): AttendanceSummaryView | null {
  const d = data as any;
  if (!d || typeof d.asOf !== 'string' || !d.periods || !d.term) return null;
  return {
    asOf: d.asOf,
    term: { academicYear: String(d.term.academicYear || ''), term: d.term.term === '2' ? '2' : '1', from: String(d.term.from || ''), to: String(d.term.to || '') },
    daily: Array.isArray(d.daily) ? d.daily.map((r: any) => ({ date: String(r?.date || ''), rooms: num(r?.rooms), ...counts(r) })).filter((r: DailyRow) => r.date) : [],
    periods: { day: period(d.periods.day), week: period(d.periods.week), month: period(d.periods.month), term: period(d.periods.term) },
  };
}

export const totalOf = (c: Counts) => c.present + c.late + c.absent + c.leave;
/** ร้อยละ 0–100 ทศนิยม 1 ตำแหน่ง; ไม่มีข้อมูล = null */
export function attendanceRate(c: Counts): number | null {
  const t = totalOf(c);
  return t > 0 ? Math.round(((c.present + c.late) / t) * 1000) / 10 : null;
}
export function sumCounts(rows: Counts[]): Counts {
  return rows.reduce((a, r) => ({ present: a.present + r.present, late: a.late + r.late, absent: a.absent + r.absent, leave: a.leave + r.leave }), { present: 0, late: 0, absent: 0, leave: 0 });
}
/** รวมรายห้อง → รายระดับชั้น (ม.1–ม.6 ตามลำดับ, อื่น ๆ ท้ายสุด) */
export function levelRows(rooms: RoomRow[]): Array<{ level: string; rooms: number } & Counts> {
  const m = new Map<string, { level: string; rooms: number } & Counts>();
  for (const r of rooms) {
    const cur = m.get(r.level) || { level: r.level, rooms: 0, present: 0, late: 0, absent: 0, leave: 0 };
    cur.rooms++; cur.present += r.present; cur.late += r.late; cur.absent += r.absent; cur.leave += r.leave;
    m.set(r.level, cur);
  }
  return [...m.values()].sort((a, b) => a.level.localeCompare(b.level, 'th', { numeric: true }));
}
/** ห้องที่ร้อยละการมาเรียนต่ำสุดก่อน (ห้องไม่มีข้อมูลไว้ท้าย) */
export function roomsByLowestRate(rooms: RoomRow[]): RoomRow[] {
  return [...rooms].sort((a, b) => (attendanceRate(a) ?? 101) - (attendanceRate(b) ?? 101) || a.room.localeCompare(b.room, 'th', { numeric: true }));
}
