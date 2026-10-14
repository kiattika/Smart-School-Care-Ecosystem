/**
 * ตรรกะล้วน (ไม่แตะ Firebase) ของสรุปสารสนเทศโรงเรียนสำหรับหน้าสาธารณะ — ทดสอบได้ใน src/__tests__/publicSummary.test.ts
 *
 * หลักการ: ผลลัพธ์เป็น "ตัวเลขรวม" เท่านั้น ไม่มีชื่อ/รหัส/อีเมลของใครเลย และทุกช่องที่นับได้ 1–4 จะถูกซ่อน (null = "<5")
 * พร้อมซ่อนช่องรองเพิ่มเมื่อมีเพียงช่องเดียวที่ถูกซ่อน (กันคำนวณย้อนจากยอดรวมด้วยการลบ)
 */

export const MIN_CELL = 5;

/** null = ซ่อน (แสดงเป็น "<5") */
export type Cell = number | null;

/** ซ่อนค่า 1–4 (0 แสดงได้ เพราะไม่ระบุตัวบุคคล) */
export const maskCell = (n: number): Cell => (n > 0 && n < MIN_CELL ? null : n);

/**
 * ซ่อนช่องเล็กในชุดตัวเลขที่รวมกันเป็นยอดรวมที่แสดงอยู่ด้วย: ถ้าซ่อนไปช่องเดียว ต้องซ่อนช่องที่เล็กที่สุดถัดไปด้วย
 * (ไม่งั้นเอายอดรวมลบช่องที่เหลือ จะได้ค่าที่ซ่อนอยู่)
 */
export function maskCounts(counts: Record<string, number>): Record<string, Cell> {
  const out: Record<string, Cell> = {};
  for (const [k, v] of Object.entries(counts)) out[k] = maskCell(v);
  const hidden = Object.keys(out).filter((k) => out[k] === null);
  if (hidden.length === 1) {
    const rest = Object.keys(out).filter((k) => out[k] !== null && (out[k] as number) > 0);
    if (rest.length > 0) {
      const smallest = rest.reduce((a, b) => ((out[a] as number) <= (out[b] as number) ? a : b));
      out[smallest] = null;
    }
  }
  return out;
}

export const countBy = <T>(rows: readonly T[], key: (r: T) => string): Record<string, number> => {
  const m: Record<string, number> = {};
  for (const r of rows) { const k = key(r); m[k] = (m[k] || 0) + 1; }
  return m;
};

/** ช่วงวันที่ของภาคเรียน (academicYear เป็น พ.ศ.): ภาค 1 = 1 พ.ค.–31 ต.ค., ภาค 2 = 1 พ.ย.–30 เม.ย. */
export function semesterRange(academicYear: string, term: '1' | '2'): { from: string; to: string } {
  const y = Number(academicYear) - 543;
  return term === '1' ? { from: `${y}-05-01`, to: `${y}-10-31` } : { from: `${y}-11-01`, to: `${y + 1}-04-30` };
}

export const inRange = (date: unknown, r: { from: string; to: string }) =>
  typeof date === 'string' && date >= r.from && date <= r.to;

/** ระดับชั้นจาก "ม.5" / "ม.5/3" → "ม.5"; อื่น ๆ → "อื่น ๆ" */
export function levelOf(grade: unknown): string {
  const m = typeof grade === 'string' ? grade.match(/ม\.?\s*([1-6])/) : null;
  return m ? `ม.${m[1]}` : 'อื่น ๆ';
}

const monthOf = (date: string) => date.slice(0, 7);

// ───────────── ส่วนต่าง ๆ ของสรุป ─────────────

export interface StudentRow { status?: unknown; grade?: unknown }
export function studentsSection(rows: readonly StudentRow[]) {
  const active = rows.filter((s) => s.status !== 'INACTIVE');
  return { total: active.length, byLevel: maskCounts(countBy(active, (s) => levelOf(s.grade))) };
}

export interface VisitRow { visitDate?: unknown; isUrgentAlert?: unknown }
export function infirmarySection(rows: readonly VisitRow[], range: { from: string; to: string }) {
  const inSem = rows.filter((r) => inRange(r.visitDate, range));
  return {
    visits: maskCell(inSem.length),
    urgent: maskCell(inSem.filter((r) => r.isUrgentAlert === true).length),
    byMonth: maskCounts(countBy(inSem, (r) => monthOf(r.visitDate as string))),
  };
}

export interface CaseRow { createdAt?: unknown; category?: unknown; status?: unknown }
export function guidanceSection(rows: readonly CaseRow[], range: { from: string; to: string }) {
  const inSem = rows.filter((r) => inRange(typeof r.createdAt === 'string' ? r.createdAt.slice(0, 10) : '', range));
  const cat = (r: CaseRow) => (typeof r.category === 'string' && r.category.trim() ? r.category.trim().slice(0, 60) : 'อื่น ๆ');
  return {
    cases: maskCell(inSem.length),
    resolved: maskCell(inSem.filter((r) => r.status === 'RESOLVED').length),
    byCategory: maskCounts(countBy(inSem, cat)),
  };
}

export interface SupervisionRow { submitted?: unknown; percent?: unknown; band?: unknown }
export const SUPERVISION_BAND_LIST = ['ดีมาก', 'ดี', 'พอใช้', 'ควรปรับปรุง', 'ไม่ผ่าน'] as const;
export function supervisionSection(rows: readonly SupervisionRow[]) {
  const done = rows.filter((r) => r.submitted === true);
  const pct = done.map((r) => r.percent).filter((p): p is number => typeof p === 'number');
  const bands = Object.fromEntries(SUPERVISION_BAND_LIST.map((b) => [b, done.filter((r) => r.band === b).length]));
  return {
    observed: maskCell(done.length),
    // ค่าเฉลี่ยแสดงเมื่อมีผลอย่างน้อย MIN_CELL คนเท่านั้น
    averagePercent: pct.length >= MIN_CELL ? Math.round((pct.reduce((a, b) => a + b, 0) / pct.length) * 100) / 100 : null,
    bands: done.length >= MIN_CELL ? maskCounts(bands) : Object.fromEntries(SUPERVISION_BAND_LIST.map((b) => [b, null])) as Record<string, Cell>,
  };
}

export interface SubstituteRow {
  date?: unknown; status?: unknown; swapMode?: unknown; triggerType?: unknown;
  originalTeacherEmail?: unknown; substituteTeacherEmail?: unknown;
}
export type TeachingKind = 'SICK_LEAVE' | 'PERSONAL_LEAVE' | 'OFFICIAL_DUTY' | 'OTHER_ABSENCE' | 'SWAP' | 'COVERED_FOR_OTHERS';
export const TEACHING_KINDS: TeachingKind[] = ['SICK_LEAVE', 'PERSONAL_LEAVE', 'OFFICIAL_DUTY', 'OTHER_ABSENCE', 'SWAP', 'COVERED_FOR_OTHERS'];
const lower = (v: unknown) => (typeof v === 'string' ? v.trim().toLowerCase() : '');

/** นิยามเดียวกับ src/lib/teacherStats.ts (เฉพาะที่อนุมัติครบ): ค่าที่แสดง = จำนวนคาบทั้งโรงเรียน ซ่อนเมื่อมีครูที่เกี่ยวข้องน้อยกว่า MIN_CELL คน */
export function teachingSection(rows: readonly SubstituteRow[], range: { from: string; to: string }) {
  const periods: Record<string, number> = {};
  const teachers: Record<string, Set<string>> = {};
  const add = (kind: TeachingKind, email: string) => {
    if (!email) return;
    periods[kind] = (periods[kind] || 0) + 1;
    (teachers[kind] = teachers[kind] || new Set()).add(email);
  };
  for (const a of rows) {
    if (a.status !== 'APPROVED' || !inRange(a.date, range)) continue;
    const orig = lower(a.originalTeacherEmail);
    const sub = lower(a.substituteTeacherEmail);
    const kind: TeachingKind = a.swapMode === 'SWAP' ? 'SWAP'
      : a.triggerType === 'SICK_LEAVE' ? 'SICK_LEAVE'
        : a.triggerType === 'PERSONAL_LEAVE' ? 'PERSONAL_LEAVE'
          : a.triggerType === 'OFFICIAL_DUTY' ? 'OFFICIAL_DUTY' : 'OTHER_ABSENCE';
    add(kind, orig);
    if (a.swapMode !== 'SWAP' && sub && sub !== orig) add('COVERED_FOR_OTHERS', sub);
  }
  const out = {} as Record<TeachingKind, { periods: Cell; teachers: Cell }>;
  for (const k of TEACHING_KINDS) {
    const t = teachers[k]?.size || 0;
    out[k] = { periods: t > 0 && t < MIN_CELL ? null : (periods[k] || 0), teachers: maskCell(t) };
  }
  return out;
}

export interface PublicSummary {
  schemaVersion: 1;
  academicYear: string;
  term: '1' | '2';
  students: ReturnType<typeof studentsSection>;
  staff: { teachers: Cell };
  infirmary: ReturnType<typeof infirmarySection>;
  guidance: ReturnType<typeof guidanceSection>;
  supervision: (ReturnType<typeof supervisionSection> & { roundLabel: string }) | null;
  teaching: ReturnType<typeof teachingSection>;
}

/** ครูที่ใช้งานอยู่ (ข้าม doc alias ที่ใช้อีเมลเป็น id เหมือน guidanceStatusLogic) */
export function activeTeacherCount(rows: readonly { id: string; email?: unknown; roles?: unknown; status?: unknown }[]): number {
  return rows.filter((s) => {
    if (typeof s.email === 'string' && s.id.toLowerCase() === s.email.trim().toLowerCase()) return false;
    if (s.status === 'INACTIVE') return false;
    return Array.isArray(s.roles) && s.roles.includes('SUBJECT_TEACHER');
  }).length;
}
