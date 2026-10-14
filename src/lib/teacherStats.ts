/**
 * สถิติการปฏิบัติงานสอนของครูแต่ละคน (แลกคาบ / สอนแทน / ลา / ไปราชการ) — คำนวณจาก substitute_assignments
 * ที่ "อนุมัติครบแล้ว" เท่านั้น ไม่มีคอลเลกชันใหม่ (pure — ทดสอบได้)
 *
 * นิยาม (1 เอกสาร = 1 คาบ):
 *  - swapMode === 'SWAP'  → นับเป็น "แลกคาบ" ให้ครูเจ้าของคาบเดิม (originalTeacherEmail) เท่านั้น ไม่นับเป็นสอนแทน/ลา
 *  - อื่น ๆ (COVER)       → ครูเจ้าของคาบเดิมนับตาม triggerType (ลาป่วย/ลากิจ/ไปราชการ; ไม่ระบุ = อื่น ๆ)
 *                           และครูที่มาสอนแทน (substituteTeacherEmail) นับ "สอนแทนให้ผู้อื่น"
 *  - "วัน" = จำนวนวันที่ไม่ซ้ำ (วันเดียวอาจหลายคาบ)
 */
import type { SubstituteAssignment } from '../types';

export type StatKind = 'SICK_LEAVE' | 'PERSONAL_LEAVE' | 'OFFICIAL_DUTY' | 'OTHER_ABSENCE' | 'SWAP' | 'COVERED_FOR_OTHERS';

export const STAT_LABEL: Record<StatKind, string> = {
  SICK_LEAVE: 'ลาป่วย',
  PERSONAL_LEAVE: 'ลากิจ',
  OFFICIAL_DUTY: 'ไปราชการ',
  OTHER_ABSENCE: 'ไม่อยู่สอน (ไม่ระบุสาเหตุ)',
  SWAP: 'แลก/เปลี่ยนคาบ',
  COVERED_FOR_OTHERS: 'สอนแทนผู้อื่น',
};
export const STAT_KINDS = Object.keys(STAT_LABEL) as StatKind[];

export interface StatCell { periods: number; days: number }
export type TeacherStats = Record<StatKind, StatCell> & { pending: number };

const emptyStats = (): TeacherStats => ({
  SICK_LEAVE: { periods: 0, days: 0 }, PERSONAL_LEAVE: { periods: 0, days: 0 }, OFFICIAL_DUTY: { periods: 0, days: 0 },
  OTHER_ABSENCE: { periods: 0, days: 0 }, SWAP: { periods: 0, days: 0 }, COVERED_FOR_OTHERS: { periods: 0, days: 0 }, pending: 0,
});

const norm = (e: string | undefined) => (e || '').trim().toLowerCase();

/** ช่วงวันที่ (YYYY-MM-DD) ของภาคเรียน: ภาค 1 = 1 พ.ค.–31 ต.ค., ภาค 2 = 1 พ.ย.–30 เม.ย. ปีถัดไป (academicYear เป็น พ.ศ.) */
export function semesterDateRange(academicYear: string, term: '1' | '2'): { from: string; to: string } {
  const y = Number(academicYear) - 543;
  return term === '1' ? { from: `${y}-05-01`, to: `${y}-10-31` } : { from: `${y}-11-01`, to: `${y + 1}-04-30` };
}
export const academicYearDateRange = (academicYear: string) => {
  const y = Number(academicYear) - 543;
  return { from: `${y}-05-01`, to: `${y + 1}-04-30` };
};

const PENDING = new Set(['PENDING_TEACHER_CONFIRMATION', 'PENDING_ASSIGNMENT', 'PENDING_APPROVAL']);

export function kindForOriginal(a: Pick<SubstituteAssignment, 'swapMode' | 'triggerType'>): StatKind {
  if (a.swapMode === 'SWAP') return 'SWAP';
  if (a.triggerType === 'SICK_LEAVE') return 'SICK_LEAVE';
  if (a.triggerType === 'PERSONAL_LEAVE') return 'PERSONAL_LEAVE';
  if (a.triggerType === 'OFFICIAL_DUTY') return 'OFFICIAL_DUTY';
  return 'OTHER_ABSENCE';
}

/** สถิติรายครู (key = อีเมลตัวพิมพ์เล็ก) ภายในช่วงวันที่ (รวมปลายทั้งสองด้าน) */
export function computeTeacherStats(
  assignments: readonly SubstituteAssignment[],
  range: { from: string; to: string },
): Map<string, TeacherStats> {
  const out = new Map<string, TeacherStats>();
  const dates = new Map<string, Set<string>>(); // `${email}|${kind}` → วันที่
  const get = (email: string) => { let s = out.get(email); if (!s) { s = emptyStats(); out.set(email, s); } return s; };
  const add = (email: string, kind: StatKind, date: string) => {
    if (!email) return;
    get(email)[kind].periods += 1;
    const k = `${email}|${kind}`;
    const set = dates.get(k) || new Set<string>();
    set.add(date); dates.set(k, set);
    get(email)[kind].days = set.size;
  };
  for (const a of assignments) {
    if (!a.date || a.date < range.from || a.date > range.to) continue;
    const orig = norm(a.originalTeacherEmail);
    const sub = norm(a.substituteTeacherEmail);
    if (a.status === 'APPROVED') {
      add(orig, kindForOriginal(a), a.date);
      if (a.swapMode !== 'SWAP' && sub && sub !== orig) add(sub, 'COVERED_FOR_OTHERS', a.date);
    } else if (a.status && PENDING.has(a.status)) {
      if (orig) get(orig).pending += 1;
    }
  }
  return out;
}

export const getStats = (m: Map<string, TeacherStats>, email: string | undefined): TeacherStats => m.get(norm(email)) || emptyStats();

/** รวมสถิติหลายคน (ไม่ระบุตัวบุคคล) + จำนวนครูที่มีรายการแต่ละประเภท */
export interface GroupStats { teachers: number; totals: Record<StatKind, StatCell & { teachers: number }>; pending: number }

export function aggregateStats(emails: readonly string[], m: Map<string, TeacherStats>): GroupStats {
  const totals = Object.fromEntries(STAT_KINDS.map(k => [k, { periods: 0, days: 0, teachers: 0 }])) as GroupStats['totals'];
  let pending = 0;
  const seen = new Set<string>();
  for (const e of emails) {
    const key = norm(e);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const s = m.get(key);
    if (!s) continue;
    pending += s.pending;
    for (const k of STAT_KINDS) {
      totals[k].periods += s[k].periods;
      totals[k].days += s[k].days;
      if (s[k].periods > 0) totals[k].teachers += 1;
    }
  }
  return { teachers: seen.size, totals, pending };
}
