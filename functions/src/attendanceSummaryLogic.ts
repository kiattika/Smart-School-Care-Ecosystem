import { levelOf, semesterRange } from './publicSummaryLogic';

/**
 * สรุปการมาเรียนรวมของโรงเรียน (ตรรกะบริสุทธิ์) — จากเช็คโฮมรูมรายวัน (attendance_records, source = HOMEROOM_DEFAULT)
 * นับเป็น "นักเรียน-วัน": มา (PRESENT) / สาย (LATE) / ขาด (ABSENT) / ลา (LEAVE); ร้อยละการมาเรียน = (มา+สาย) ÷ ทั้งหมด (รวมลา)
 * ไม่มีข้อมูลรายบุคคล: เก็บเฉพาะตัวเลขรวมรายวันทั้งโรงเรียน + รายห้องของ 4 ช่วง (วัน/สัปดาห์/เดือน/ภาคเรียน)
 * วันที่ไม่มีเอกสารโฮมรูม (หยุด/ยังไม่เช็ค) ไม่นับ
 */
export interface Counts { present: number; late: number; absent: number; leave: number }
export interface HomeroomDay { date: string; room: string; students: Record<string, unknown> }
export interface DailyRow extends Counts { date: string; rooms: number }
export interface RoomRow extends Counts { room: string; level: string; days: number }
export interface PeriodRooms { from: string; to: string; rooms: RoomRow[] }
export interface AttendanceSummary {
  asOf: string;
  term: { academicYear: string; term: '1' | '2'; from: string; to: string };
  daily: DailyRow[];
  periods: { day: PeriodRooms; week: PeriodRooms; month: PeriodRooms; term: PeriodRooms };
}

const zero = (): Counts => ({ present: 0, late: 0, absent: 0, leave: 0 });

export function countStudents(students: Record<string, unknown>): Counts {
  const c = zero();
  for (const v of Object.values(students || {})) {
    if (v === 'PRESENT') c.present++; else if (v === 'LATE') c.late++; else if (v === 'ABSENT') c.absent++; else if (v === 'LEAVE') c.leave++;
  }
  return c;
}
const add = (a: Counts, b: Counts) => { a.present += b.present; a.late += b.late; a.absent += b.absent; a.leave += b.leave; };

/** วันจันทร์ของสัปดาห์ที่มี date (YYYY-MM-DD, คำนวณแบบ UTC ไม่ผูกเขตเวลา) */
export function weekStartOf(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // จันทร์ = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}
export const monthStartOf = (date: string) => `${date.slice(0, 7)}-01`;

function roomsFor(docs: HomeroomDay[], from: string, to: string): PeriodRooms {
  const m = new Map<string, RoomRow>();
  for (const d of docs) {
    if (d.date < from || d.date > to) continue;
    const row = m.get(d.room) || { room: d.room, level: levelOf(d.room), days: 0, ...zero() };
    add(row, countStudents(d.students)); row.days++;
    m.set(d.room, row);
  }
  return { from, to, rooms: [...m.values()].sort((a, b) => a.room.localeCompare(b.room, 'th', { numeric: true })) };
}

/** docs = เอกสารโฮมรูมทุกห้อง; ไม่มีข้อมูลในภาคเรียนนี้ = null (ไม่แต่งตัวเลข) */
export function buildAttendanceSummary(docs: HomeroomDay[], sem: { academicYear: string; term: '1' | '2' }): AttendanceSummary | null {
  const range = semesterRange(sem.academicYear, sem.term);
  const inTerm = docs.filter((d) => typeof d.date === 'string' && typeof d.room === 'string' && d.room && d.date >= range.from && d.date <= range.to);
  if (inTerm.length === 0) return null;
  const asOf = inTerm.reduce((mx, d) => (d.date > mx ? d.date : mx), '');
  const byDate = new Map<string, DailyRow>();
  for (const d of inTerm) {
    const row = byDate.get(d.date) || { date: d.date, rooms: 0, ...zero() };
    add(row, countStudents(d.students)); row.rooms++;
    byDate.set(d.date, row);
  }
  return {
    asOf,
    term: { ...sem, from: range.from, to: range.to },
    daily: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
    periods: {
      day: roomsFor(inTerm, asOf, asOf),
      week: roomsFor(inTerm, weekStartOf(asOf) < range.from ? range.from : weekStartOf(asOf), asOf),
      month: roomsFor(inTerm, monthStartOf(asOf) < range.from ? range.from : monthStartOf(asOf), asOf),
      term: roomsFor(inTerm, range.from, asOf),
    },
  };
}
