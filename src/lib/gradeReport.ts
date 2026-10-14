/**
 * รายงานผลการเรียนรายภาคเรียน (ไม่เป็นทางการ) ของนักเรียน — คำนวณจาก gradebook_scores จริงที่ครูบันทึกเท่านั้น
 * ⚠️ คะแนนยังไม่ผ่านการอนุมัติ — คะแนนทางการให้ติดตามผ่านโปรแกรม SGS ของโรงเรียน (ข้อความ GRADE_REPORT_DISCLAIMER ต้องแสดงทุกที่ที่แสดงรายงานนี้)
 */
import { courseKindOf } from './teachingProject';
import { effectiveCredits } from './subjectCode';

export const GRADE_REPORT_DISCLAIMER =
  'หมายเหตุ: รายงานนี้เป็นคะแนนอย่างไม่เป็นทางการที่ยังไม่ได้รับการอนุมัติ — คะแนนอย่างเป็นทางการให้ติดตามผ่านโปรแกรม SGS ของโรงเรียน';

/** ตารางแปลงคะแนนรวม → ผลการเรียน (ตรงกับเกณฑ์ในโครงการสอนและสมุดคะแนนของครู) */
export function gradeFromTotal(total: number): string {
  if (total >= 80) return '4';
  if (total >= 75) return '3.5';
  if (total >= 70) return '3';
  if (total >= 65) return '2.5';
  if (total >= 60) return '2';
  if (total >= 55) return '1.5';
  if (total >= 50) return '1';
  return '0';
}

/** เอกสารใน gradebook_scores (รุ่นใหม่มี courseName/credits/คะแนนเต็ม ส่วนรุ่นเก่าไม่มี — ห้ามเดา) */
export interface ScoreDoc {
  courseCode: string;
  className?: string;
  studentId: string;
  /** รูปแบบ "ภาค/ปี" เช่น "1/2569" */
  term: string;
  preMidterm?: number; midterm?: number; postMidterm?: number; final?: number;
  total?: number;
  grade?: string;
  passFailResult?: 'PASS' | 'FAIL' | null;
  courseName?: string;
  credits?: number;
  subjectType?: 'MAIN' | 'ACTIVITY';
  maxPreMidterm?: number; maxMidterm?: number; maxPostMidterm?: number; maxFinal?: number;
}

/** วิชาในตารางเรียนของห้อง (จาก schedules) ใช้เติมชื่อ/หน่วยกิตและแสดงวิชาที่ยังไม่มีคะแนน */
export interface CourseInfo { code: string; name: string; credits?: number; subjectType?: string; /** คาบรวม/สัปดาห์ของรหัสนี้ในห้อง — ใช้คำนวณหน่วยกิต (1 คาบ = 0.5) */ periods?: number }

export interface GradeRow {
  code: string;
  name: string;
  credits: number | null;
  isActivity: boolean;
  /** ยังไม่มีเอกสารคะแนนของวิชานี้ในภาคเรียนนี้ */
  hasScore: boolean;
  parts: { pre: number | null; mid: number | null; post: number | null; final: number | null };
  /** คะแนนเต็มของแต่ละช่วง — null = เอกสารรุ่นเก่าไม่ได้เก็บไว้ */
  max: { pre: number | null; mid: number | null; post: number | null; final: number | null };
  total: number | null;
  maxTotal: number | null;
  percent: number | null;
  /** ผลการเรียนเป็นตัวเลข (วิชาหลัก) หรือ ผ/มผ (กิจกรรม) — null = ยังไม่มีผล */
  grade: string | null;
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const codeKey = (c: string) => (c || '').trim();

/** เทอมในรูป "ภาค/ปี" → ป้าย */
export const termLabel = (t: string) => `ภาคเรียนที่ ${t}`;

/** รายการภาคเรียนที่เลือกได้: ที่มีคะแนน + ภาคเรียนปัจจุบัน (ถ้าส่งมา) เรียงล่าสุดก่อน (ปีมาก→น้อย แล้วภาค) */
export function termOptions(scores: readonly ScoreDoc[], current?: string): string[] {
  const set = new Set(scores.map(s => s.term).filter(Boolean));
  if (current) set.add(current);
  const parse = (t: string) => { const [a, b] = t.split('/'); return [Number(b) || 0, Number(a) || 0] as const; };
  return [...set].sort((x, y) => { const [yx, tx] = parse(x), [yy, ty] = parse(y); return yy - yx || ty - tx; });
}

/**
 * แถวรายงาน = วิชาที่มีคะแนนในภาคเรียนนั้น + (ถ้า includeSchedule) วิชาในตารางเรียนที่ยังไม่มีคะแนน (แสดงว่า "ยังไม่มีผล")
 * — วิชาที่ยกเว้น (PLC/CZ/โฮมรูม ฯลฯ) ไม่ใช่วิชาที่ประเมินผล จึงไม่แสดง
 */
export function buildGradeRows(input: {
  term: string;
  scores: readonly ScoreDoc[];
  courses?: readonly CourseInfo[];
  includeSchedule?: boolean;
}): GradeRow[] {
  const { term, scores, courses = [], includeSchedule = false } = input;
  const info = new Map<string, CourseInfo>();
  for (const c of courses) { const k = codeKey(c.code); if (k && !info.has(k)) info.set(k, c); }
  const byCode = new Map<string, ScoreDoc>();
  for (const s of scores) if (s.term === term && codeKey(s.courseCode)) byCode.set(codeKey(s.courseCode), s);
  const codes = new Set<string>(byCode.keys());
  if (includeSchedule) info.forEach((_, k) => codes.add(k));

  const rows: GradeRow[] = [];
  for (const code of codes) {
    const s = byCode.get(code);
    const c = info.get(code);
    const name = s?.courseName || c?.name || code;
    if (courseKindOf({ code, name }) === 'EXEMPT') continue;
    const isActivity = s?.passFailResult != null || s?.subjectType === 'ACTIVITY' || courseKindOf({ code, name, subjectType: c?.subjectType }) === 'ACTIVITY';
    // วิชากิจกรรม (ก)/เฉพาะกิจไม่มีหน่วยกิต; วิชาปกติคำนวณจากคาบ/สัปดาห์ ไม่รู้ค่อยใช้ค่าที่เก็บไว้
    const credits = isActivity ? null : effectiveCredits({ code, subjectType: c?.subjectType, periodsPerWeek: c?.periods, stored: num(s?.credits) ?? num(c?.credits) });
    const max = { pre: num(s?.maxPreMidterm), mid: num(s?.maxMidterm), post: num(s?.maxPostMidterm), final: num(s?.maxFinal) };
    const maxKnown = max.pre !== null && max.mid !== null && max.post !== null && max.final !== null;
    const maxTotal = maxKnown ? max.pre! + max.mid! + max.post! + max.final! : null;
    if (!s) {
      rows.push({ code, name, credits, isActivity, hasScore: false, parts: { pre: null, mid: null, post: null, final: null }, max, total: null, maxTotal: null, percent: null, grade: null });
      continue;
    }
    if (isActivity) {
      const grade = s.passFailResult === 'PASS' ? 'ผ' : s.passFailResult === 'FAIL' ? 'มผ' : null;
      rows.push({ code, name, credits, isActivity: true, hasScore: true, parts: { pre: null, mid: null, post: null, final: null }, max, total: null, maxTotal: null, percent: null, grade });
      continue;
    }
    const parts = { pre: num(s.preMidterm), mid: num(s.midterm), post: num(s.postMidterm), final: num(s.final) };
    const total = num(s.total) ?? (Object.values(parts).every(v => v !== null) ? parts.pre! + parts.mid! + parts.post! + parts.final! : null);
    // เต็มรวมที่ไม่รู้ = ถือว่าคะแนนรวมเต็ม 100 (ค่าเริ่มต้นของสมุดคะแนน: 25+20+25+30)
    const percent = total === null ? null : Math.round((total / (maxTotal ?? 100)) * 10000) / 100;
    const grade = total === null ? null : (s.grade && s.grade !== '' ? String(s.grade) : gradeFromTotal(percent ?? total));
    rows.push({ code, name, credits, isActivity: false, hasScore: true, parts, max, total, maxTotal, percent, grade });
  }
  return rows.sort((a, b) => Number(a.isActivity) - Number(b.isActivity) || a.code.localeCompare(b.code, 'th'));
}

export interface GradeSummary {
  /** เกรดเฉลี่ย = Σ(หน่วยกิต×เกรด)/Σหน่วยกิต เฉพาะวิชาหลักที่มีทั้งผลและหน่วยกิต; null = ยังคำนวณไม่ได้ */
  gpa: number | null;
  creditsCounted: number;
  /** วิชาหลักที่มีผลแต่ไม่มีหน่วยกิต (ไม่นับในเกรดเฉลี่ย — ไม่เดาหน่วยกิต) */
  missingCredits: number;
  /** วิชาที่ยังไม่มีผล */
  pending: number;
  activityPassed: number;
  activityFailed: number;
}

export function summarizeGrades(rows: readonly GradeRow[]): GradeSummary {
  let pts = 0, cr = 0, missing = 0, pending = 0, ap = 0, af = 0;
  for (const r of rows) {
    if (r.grade === null) { pending++; continue; }
    if (r.isActivity) { if (r.grade === 'ผ') ap++; else af++; continue; }
    const g = Number(r.grade);
    if (r.credits === null || !Number.isFinite(g)) { missing++; continue; }
    pts += r.credits * g; cr += r.credits;
  }
  return { gpa: cr > 0 ? Math.round((pts / cr) * 100) / 100 : null, creditsCounted: cr, missingCredits: missing, pending, activityPassed: ap, activityFailed: af };
}
