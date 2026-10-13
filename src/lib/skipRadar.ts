/**
 * เรดาร์โดดเรียน — ตรรกะบริสุทธิ์ (test ได้) คำนวณจาก attendance_records จริงเท่านั้น (ไม่มีที่เก็บข้อมูลใหม่)
 *
 * นิยาม "โดดคาบ" (ค่าเริ่มต้น ยังไม่ยืนยันจากโรงเรียน): ในวันเดียวกัน นักเรียนมีหลักฐานว่า "มาโรงเรียน"
 * (PRESENT/LATE ในเอกสารเช็คชื่ออย่างน้อยหนึ่งฉบับ) แต่ถูกเช็คเป็น ABSENT ในคาบเรียน (คาบ ≥ 1) อย่างน้อยหนึ่งคาบ
 * - ขาดทั้งวัน (ไม่มี PRESENT/LATE เลย) = ไม่ใช่โดดคาบ (เป็นการขาดเรียนปกติ — อยู่ในสถิติการเข้าเรียนอยู่แล้ว)
 * - LEAVE (ลา) ไม่นับเป็นโดด
 * - หลักฐานว่ามาโรงเรียนต้องมาจากเอกสาร "คนละฉบับ" กับคาบที่ ABSENT
 */
import type { AttendanceRecordFull } from './attendanceHistory';

export const SKIP_WATCH_THRESHOLD = 2; // ครั้งในช่วงที่ดู → เฝ้าระวัง
export const SKIP_ALERT_THRESHOLD = 4; // ครั้งในช่วงที่ดู → ควรติดตาม

export type SkipLevel = 'NONE' | 'WATCH' | 'ALERT';

export interface SkipIncident {
  date: string;
  periodNumber: number;
  courseKey: string; // courseCode || courseName || ''
  courseLabel: string;
}

export interface StudentSkipSummary {
  studentId: string;
  incidents: SkipIncident[];
  total: number;
  days: number;
  byPeriod: Record<number, number>;
  topCourse: { label: string; count: number } | null;
  lastDate: string;
  level: SkipLevel;
}

export function skipLevel(total: number): SkipLevel {
  if (total >= SKIP_ALERT_THRESHOLD) return 'ALERT';
  if (total >= SKIP_WATCH_THRESHOLD) return 'WATCH';
  return 'NONE';
}

const isPresentLike = (s: unknown) => s === 'PRESENT' || s === 'LATE';

export function detectSkipIncidents(records: AttendanceRecordFull[], studentIds: string[]): StudentSkipSummary[] {
  const wanted = new Set(studentIds);
  // จัดกลุ่มตามวัน
  const byDate = new Map<string, AttendanceRecordFull[]>();
  for (const r of records) {
    if (!r?.date) continue;
    const arr = byDate.get(r.date);
    if (arr) arr.push(r); else byDate.set(r.date, [r]);
  }
  const out = new Map<string, SkipIncident[]>();
  for (const [date, docs] of byDate) {
    for (const sid of wanted) {
      const docIdx = docs.map((d, i) => ({ d, i })).filter(({ d }) => d.students && d.students[sid] !== undefined);
      if (docIdx.length < 2) continue;
      for (const { d, i } of docIdx) {
        const period = d.periodNumber ?? 0;
        if (period < 1 || d.students[sid] !== 'ABSENT') continue;
        const hasOtherEvidence = docIdx.some(o => o.i !== i && isPresentLike(o.d.students[sid]));
        if (!hasOtherEvidence) continue;
        const label = d.courseName || d.courseCode || '';
        const list = out.get(sid) || [];
        list.push({ date, periodNumber: period, courseKey: d.courseCode || d.courseName || '', courseLabel: label });
        out.set(sid, list);
      }
    }
  }
  const result: StudentSkipSummary[] = [];
  for (const sid of wanted) {
    const incidents = (out.get(sid) || []).sort((a, b) => b.date.localeCompare(a.date) || a.periodNumber - b.periodNumber);
    const byPeriod: Record<number, number> = {};
    const byCourse = new Map<string, { label: string; count: number }>();
    for (const inc of incidents) {
      byPeriod[inc.periodNumber] = (byPeriod[inc.periodNumber] || 0) + 1;
      if (inc.courseKey) {
        const c = byCourse.get(inc.courseKey) || { label: inc.courseLabel || inc.courseKey, count: 0 };
        c.count += 1;
        byCourse.set(inc.courseKey, c);
      }
    }
    const topCourse = [...byCourse.values()].sort((a, b) => b.count - a.count)[0] || null;
    result.push({
      studentId: sid,
      incidents,
      total: incidents.length,
      days: new Set(incidents.map(i => i.date)).size,
      byPeriod,
      topCourse,
      lastDate: incidents[0]?.date || '',
      level: skipLevel(incidents.length),
    });
  }
  return result.sort((a, b) => b.total - a.total || a.studentId.localeCompare(b.studentId));
}

/** จำนวนครั้งต่อคาบรวมทั้งห้อง (คาบ 1-8) — ใช้ทำ heat strip */
export function periodTotals(summaries: StudentSkipSummary[], maxPeriod = 8): number[] {
  const arr = Array.from({ length: maxPeriod }, () => 0);
  for (const s of summaries) for (const [p, n] of Object.entries(s.byPeriod)) {
    const idx = Number(p) - 1;
    if (idx >= 0 && idx < maxPeriod) arr[idx] += n;
  }
  return arr;
}
