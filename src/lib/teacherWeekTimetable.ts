/**
 * ตารางสอนรายสัปดาห์ของครู (วัน × คาบ) — คำนวณจาก schedules จริงของภาคเรียนปัจจุบัน ตรรกะบริสุทธิ์ (test ได้)
 *
 * ใช้ตรวจสอบกับตารางสอนจริง: ไม่เติม/ไม่เดาข้อมูล — ไม่มีคาบ = ช่องว่าง
 * - จับคู่ผู้สอนด้วย staff doc id (schedules.teacherId / teacherIds) เหมือนทุกหน้า; doc รุ่นเก่าที่ไม่มี teacherId/teacherIds เลย
 *   จับคู่ด้วยอีเมลที่ normalize แล้ว (เหมือน TeachingLoadTable)
 * - "Co-taught" = คาบนี้มีผู้สอนมากกว่า 1 คนใน teacherIds/teacherId
 * - "Block i/n" = คาบติดกันในวันเดียวกันของวิชาหลัก (MAIN) ที่รหัสวิชา+ชั้น+ห้องเดียวกัน (ตั้งแต่ 2 คาบขึ้นไป) —
 *   กิจกรรม (ACTIVITY) ไม่ใส่ Block
 */
import { WEEKDAY_KEYS, type RawScheduleDoc } from './studentDaySchedule';
import { isStaffAssigned } from './staffIdentity';
import { normalizeEmail } from './normalizeEmail';

export const WEEK_DAYS = [
  { key: 'monday', label: 'จันทร์' },
  { key: 'tuesday', label: 'อังคาร' },
  { key: 'wednesday', label: 'พุธ' },
  { key: 'thursday', label: 'พฤหัสบดี' },
  { key: 'friday', label: 'ศุกร์' },
  { key: 'saturday', label: 'เสาร์' },
  { key: 'sunday', label: 'อาทิตย์' },
] as const;

/** คาบเริ่มต้นที่แสดงเสมอ: P0 (โฮมรูม) ถึง P10 — ขยายเองถ้าข้อมูล/ตารางเวลามีคาบเกินนี้ */
export const DEFAULT_LAST_PERIOD = 10;

export interface WeekCell {
  key: string;
  code: string;
  name: string;
  /** ชั้น/ห้องเรียนที่สอน เช่น ม.5/8 (ว่าง = ไม่ระบุ ไม่เดา) */
  classLabel: string;
  /** ห้องกายภาพ เช่น 943 (ว่าง = ไม่ระบุ) */
  room: string;
  isActivity: boolean;
  coTaught: boolean;
  /** ลำดับคาบ/จำนวนคาบของ Block ติดกัน (มีเมื่อ ≥ 2 คาบ และเป็นวิชาหลัก) */
  block?: { index: number; total: number };
  /** สีหลักของการ์ด (hex) — กำหนดตามกลุ่มวิชา (ตัวอักษรแรกของรหัสวิชา) */
  color: string;
}

export interface WeekGrid {
  days: { key: string; label: string }[];
  periodNumbers: number[];
  /** cells[dayKey][periodNumber] = การ์ดในช่องนั้น (เรียงตามรหัสวิชา) */
  cells: Record<string, Record<number, WeekCell[]>>;
  /** จำนวนคาบ (การ์ด) ทั้งหมด */
  total: number;
}

function docDayKey(raw: RawScheduleDoc): string {
  if (typeof raw.dayOfWeek === 'string' && raw.dayOfWeek) return raw.dayOfWeek.toLowerCase();
  if (typeof raw.scheduleDay === 'number') return WEEKDAY_KEYS[raw.scheduleDay % 7] || '';
  return '';
}

const PALETTE = ['#e11d48', '#2563eb', '#d97706', '#059669', '#7c3aed', '#0891b2', '#c2410c', '#4f46e5'];

/** สีการ์ด: HR/CZ เขียวน้ำทะเล, PLC แดงกุหลาบ, นอกนั้นตามตัวอักษรแรกของรหัสวิชา (วิชากลุ่มเดียวกันสีเดียวกัน) */
export function subjectColor(code: string): string {
  const c = (code || '').trim().toUpperCase();
  if (c === 'HR' || c === 'CZ') return '#14b8a6';
  if (c === 'PLC') return '#e11d48';
  if (!c) return '#64748b';
  let h = 0;
  for (const ch of Array.from(c)[0]) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return PALETTE[h % PALETTE.length];
}

/** ชื่อบุคลากรสำหรับแสดงในตัวเลือก — ลำดับเดียวกับหน้าตารางภาระงานสอน */
export function staffDisplayName(st: Record<string, any>): string {
  return String(
    st.fullName
    || `${st.prefix || ''}${st.firstName || ''} ${st.lastName || ''}`.trim()
    || st.displayName || st.email || st.id || '',
  ).trim();
}

function teacherIdCount(raw: RawScheduleDoc): number {
  const ids = new Set<string>();
  if (Array.isArray(raw.teacherIds)) raw.teacherIds.forEach((t: unknown) => { if (typeof t === 'string' && t) ids.add(t); });
  if (typeof raw.teacherId === 'string' && raw.teacherId) ids.add(raw.teacherId);
  return ids.size;
}

function hasTeacherRefs(raw: RawScheduleDoc): boolean {
  return teacherIdCount(raw) > 0;
}

export function buildTeacherWeekGrid(input: {
  schedules: RawScheduleDoc[];
  staffId: string | null | undefined;
  /** อีเมลของบุคลากร — ใช้จับคู่เฉพาะ doc รุ่นเก่าที่ไม่มี teacherId/teacherIds */
  staffEmail?: string | null;
  /** หมายเลขคาบจากตารางเวลาที่แอดมินตั้งไว้ (ถ้ามี) — ใช้ขยายช่วงคาบที่แสดง */
  configuredPeriodNumbers?: number[];
}): WeekGrid {
  const { schedules, staffId, staffEmail, configuredPeriodNumbers = [] } = input;
  const me = { staffId: staffId || null };
  const myEmail = staffEmail ? normalizeEmail(staffEmail) : '';

  const cells: Record<string, Record<number, WeekCell[]>> = {};
  const seen = new Set<string>();
  const usedDays = new Set<string>();
  let maxPeriod = DEFAULT_LAST_PERIOD;
  for (const n of configuredPeriodNumbers) if (Number.isInteger(n) && n > maxPeriod) maxPeriod = n;
  let total = 0;

  for (const raw of schedules) {
    const day = docDayKey(raw);
    const p = raw.periodNumber;
    if (!day || typeof p !== 'number' || !Number.isInteger(p) || p < 0) continue;

    const mine = !!staffId && isStaffAssigned(me, raw)
      || (!!myEmail && !hasTeacherRefs(raw) && normalizeEmail(String(raw.teacherEmail || '')) === myEmail);
    if (!mine) continue;

    const code = String(raw.subjectCode || raw.courseCode || '').trim();
    const name = String(raw.subjectName || raw.courseName || '').trim();
    const classLabel = String(raw.level || raw.targetClass || '').trim();
    const room = String(raw.room || '').trim();
    const dedupe = `${day}|${p}|${code}|${classLabel}|${room}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);

    const isActivity = raw.subjectType === 'ACTIVITY' || raw.type === 'ACTIVITY';
    const cell: WeekCell = {
      key: String(raw.id || dedupe),
      code, name, classLabel, room, isActivity,
      coTaught: teacherIdCount(raw) > 1,
      color: subjectColor(code),
    };
    ((cells[day] ??= {})[p] ??= []).push(cell);
    usedDays.add(day);
    if (p > maxPeriod) maxPeriod = p;
    total += 1;
  }

  // Block i/n — คาบติดกันของวิชาหลักที่รหัส+ชั้น+ห้องเดียวกัน (นับเฉพาะ ≥ 2 คาบ)
  const sameSlotKey = (c: WeekCell) => `${c.code}|${c.classLabel}|${c.room}`;
  for (const day of Object.keys(cells)) {
    const byPeriod = cells[day];
    const periods = Object.keys(byPeriod).map(Number).sort((a, b) => a - b);
    const visited = new Set<WeekCell>();
    for (const p of periods) {
      for (const start of byPeriod[p]) {
        if (visited.has(start) || start.isActivity) continue;
        const run: WeekCell[] = [start];
        visited.add(start);
        for (let q = p + 1; ; q++) {
          const next = (byPeriod[q] || []).find(c => !visited.has(c) && !c.isActivity && sameSlotKey(c) === sameSlotKey(start));
          if (!next) break;
          visited.add(next);
          run.push(next);
        }
        if (run.length >= 2) run.forEach((c, i) => { c.block = { index: i + 1, total: run.length }; });
      }
    }
    for (const p of periods) byPeriod[p].sort((a, b) => a.code.localeCompare(b.code, 'th'));
  }

  // จันทร์–ศุกร์ แสดงเสมอ; เสาร์/อาทิตย์ แสดงเมื่อมีคาบจริง
  const days = WEEK_DAYS
    .filter((d, i) => i < 5 || usedDays.has(d.key))
    .map(d => ({ key: d.key, label: d.label }));
  const periodNumbers = Array.from({ length: maxPeriod + 1 }, (_, i) => i);

  return { days, periodNumbers, cells, total };
}
