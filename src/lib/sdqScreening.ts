/**
 * SDQ ระดับระบบดูแลช่วยเหลือ: รอบการประเมิน, การวิเคราะห์ความสอดคล้อง 3 ฝ่าย (Triangulation),
 * สรุปผลการคัดกรองรายชั้นเรียน (Classroom Profile) และภาพรวมทั้งโรงเรียน — ตรรกะล้วน (ต้องตรง firestore.rules)
 *
 * รอบการประเมิน (ยืนยันจากโรงเรียน 15 ต.ค. 2569):
 *  - รอบที่ 1: ทุกฝ่าย (นักเรียน/ครูที่ปรึกษา/ผู้ปกครอง) ประเมินได้ 1 ครั้งต่อปีการศึกษา ส่งแล้วแก้/ทำซ้ำไม่ได้
 *    doc id = `{studentId}_{evaluator}_{ปี}` (sdqDocId) — เอกสารเก่าไม่มีฟิลด์ round = รอบที่ 1
 *  - รอบที่ 2 (ติดตามผล): เฉพาะมุมมองครู โดยครูที่ปรึกษาหรือครูแนะแนว ในภาคเรียนที่ 2 สำหรับนักเรียนที่รอบแรก
 *    ฝ่ายใดฝ่ายหนึ่งพบ "เสี่ยง/มีปัญหา" หรือครูระบุว่าอยู่ระหว่างการดูแลใกล้ชิด (ต้องมีเหตุผลเสมอ)
 *    doc id = `{studentId}_TEACHER_{ปี}_R2`, round = 2, followUpReason
 */
import type { SdqEvaluatorType, SdqTriage, SdqDifficultyKey, SdqStrengthStatus } from './sdq';
import { SDQ_TRIAGE_LABEL } from './sdq';

export type SdqRound = 1 | 2;
export const SDQ_ROUND2_SUFFIX = '_R2';
export const SDQ_FOLLOWUP_REASON_MAX = 500;
export const SDQ_EVALUATORS: readonly SdqEvaluatorType[] = ['STUDENT', 'TEACHER', 'PARENT'];

/** ข้อความเตือนก่อนส่ง (ข้อ 1) — แสดงทุกฟอร์ม */
export const SDQ_ONCE_PER_YEAR_NOTICE =
  'กรุณาประเมินตามความเป็นจริง — แบบประเมินนี้ทำได้เพียง 1 ครั้งต่อปีการศึกษา เมื่อส่งแล้วจะแก้ไขหรือประเมินซ้ำไม่ได้';
export const SDQ_CONFIRM_LABEL = 'ข้าพเจ้าตอบตามความเป็นจริง และเข้าใจว่าส่งได้เพียงครั้งเดียวในปีการศึกษานี้';

export function sdqRound2DocId(studentId: string, academicYear: string): string {
  return `${studentId}_TEACHER_${academicYear}${SDQ_ROUND2_SUFFIX}`;
}

export interface SdqRecordLike {
  studentId: string;
  evaluatorType: SdqEvaluatorType;
  academicYear?: string | null;
  round?: number | null;
  totalDifficultiesScore: number;
  triagingStatus: SdqTriage;
  subscaleStatus?: Partial<Record<SdqDifficultyKey, SdqTriage>> & { prosocial?: SdqStrengthStatus };
  impactTriage?: SdqTriage;
  assessmentDate?: string;
}

export const sdqRoundOf = (r: { round?: number | null }): SdqRound => (r.round === 2 ? 2 : 1);
export const isConcern = (t: SdqTriage | undefined | null): boolean => t === 'AT_RISK' || t === 'VULNERABLE';
const SEVERITY: Record<SdqTriage, number> = { NORMAL: 0, AT_RISK: 1, VULNERABLE: 2 };
export const worseTriage = (a: SdqTriage, b: SdqTriage): SdqTriage => (SEVERITY[b] > SEVERITY[a] ? b : a);

/** ผลของนักเรียนคนหนึ่งในปี/รอบที่กำหนด แยกตามผู้ประเมิน */
export function resultsOf<T extends SdqRecordLike>(records: readonly T[], studentId: string, academicYear: string, round: SdqRound = 1): Partial<Record<SdqEvaluatorType, T>> {
  const out: Partial<Record<SdqEvaluatorType, T>> = {};
  for (const r of records) {
    if (r.studentId !== studentId || r.academicYear !== academicYear || sdqRoundOf(r) !== round) continue;
    out[r.evaluatorType] = r;
  }
  return out;
}

/** ฝ่ายนี้ประเมินรอบที่ 1 ของปีนี้แล้วหรือยัง — ใช้ปิดฟอร์ม (ข้อ 1) */
export function hasRound1(records: readonly SdqRecordLike[], studentId: string, evaluator: SdqEvaluatorType, academicYear: string): boolean {
  return records.some(r => r.studentId === studentId && r.evaluatorType === evaluator && r.academicYear === academicYear && sdqRoundOf(r) === 1);
}

// ───────── การวิเคราะห์ความสอดคล้อง 3 ฝ่าย (แนบ ข้อ 2) ─────────
export type TriangulationPattern =
  | 'INCOMPLETE'        // ยังประเมินไม่ครบ (ต้องมีครูและผู้ปกครองอย่างน้อย จึงเทียบบ้าน-โรงเรียนได้)
  | 'ALL_NORMAL'
  | 'ALL_CONCERN'       // สอดคล้องกันทั้ง 3 ฝ่าย (เสี่ยง/มีปัญหา)
  | 'HOME_SCHOOL_CONFLICT'
  | 'STUDENT_INSIGHT_GAP'
  | 'STUDENT_ONLY_CONCERN';

export interface TriangulationResult {
  pattern: TriangulationPattern;
  title: string;
  /** การตีความทางพฤติกรรม — แสดงได้ทุกฝ่าย */
  interpretation: string;
  /** แนวทางการขับเคลื่อนและดูแลช่วยเหลือ — แสดงเฉพาะบุคลากร */
  staffAction: string;
  /** ผลรวมที่ใช้จัดกลุ่ม (รุนแรงที่สุดในบรรดาฝ่ายที่ประเมินแล้ว) */
  overall: SdqTriage | null;
  evaluated: SdqEvaluatorType[];
}

const TRI_TEXT: Record<TriangulationPattern, Omit<TriangulationResult, 'pattern' | 'overall' | 'evaluated'>> = {
  INCOMPLETE: {
    title: 'ยังประเมินไม่ครบทุกฝ่าย',
    interpretation: 'ต้องมีผลของครูที่ปรึกษาและผู้ปกครองอย่างน้อย จึงจะเปรียบเทียบพฤติกรรมที่บ้านกับที่โรงเรียนได้',
    staffAction: 'ติดตามให้ฝ่ายที่ยังไม่ประเมินทำแบบประเมินให้ครบ',
  },
  ALL_NORMAL: {
    title: 'ผลสอดคล้องกัน — ปกติ',
    interpretation: 'ทุกฝ่ายที่ประเมินเห็นตรงกันว่าอยู่ในเกณฑ์ปกติ',
    staffAction: 'ส่งเสริมพัฒนาตามปกติ (กิจกรรมโฮมรูม/ประชุมผู้ปกครองชั้นเรียน)',
  },
  ALL_CONCERN: {
    title: 'ผลสอดคล้องกันทั้ง 3 ฝ่าย — เสี่ยง/มีปัญหา',
    interpretation: 'พฤติกรรมเกิดขึ้นเด่นชัดทั้งที่บ้านและโรงเรียน และนักเรียนเองก็รับรู้ถึงปัญหานั้น',
    staffAction: 'จัดเป็นกลุ่มเสี่ยง/มีปัญหาทันที วางแผนช่วยเหลือร่วมกันระหว่างบ้านและโรงเรียน หรือส่งต่อผู้เชี่ยวชาญหากรุนแรง',
  },
  HOME_SCHOOL_CONFLICT: {
    title: 'ผลต่างกันระหว่างบ้านและโรงเรียน',
    interpretation: 'พฤติกรรมอาจขึ้นอยู่กับสิ่งแวดล้อม ตัวกระตุ้น หรือกฎระเบียบในสถานที่นั้น ๆ เช่น เครียดเฉพาะที่โรงเรียน หรือมีปัญหาเฉพาะเวลาอยู่กับครอบครัว',
    staffAction: 'ครูที่ปรึกษาเยี่ยมบ้าน (Home Visit) หรือจัด Classroom Meeting พูดคุยเชิงลึกกับผู้ปกครองเพื่อหาสาเหตุที่แท้จริง',
  },
  STUDENT_INSIGHT_GAP: {
    title: 'ผลต่างกันที่ตัวนักเรียน',
    interpretation: 'ครูและผู้ปกครองเห็นว่ามีปัญหา แต่นักเรียนประเมินตนเองว่าปกติ — อาจยังไม่ตระหนักรู้ถึงพฤติกรรมของตนเอง',
    staffAction: 'ยึดผลของครู/ผู้ปกครองเป็นหลักในการเฝ้าระวัง พร้อมให้คำปรึกษาเบื้องต้นเพื่อสร้างความตระหนักรู้',
  },
  STUDENT_ONLY_CONCERN: {
    title: 'นักเรียนประเมินตนเองว่าเสี่ยง/มีปัญหา',
    interpretation: 'นักเรียนรับรู้ปัญหาของตนเอง ขณะที่ครูและผู้ปกครองยังไม่เห็นในพฤติกรรมภายนอก',
    staffAction: 'พูดคุยรายบุคคลเพื่อรับฟังความรู้สึกของนักเรียน (กรณีนี้ไม่อยู่ในเอกสารต้นแบบ — เพิ่มเพื่อไม่ให้ตกหล่น)',
  },
};

export function triangulate(byEval: Partial<Record<SdqEvaluatorType, { triagingStatus: SdqTriage }>>): TriangulationResult {
  const evaluated = SDQ_EVALUATORS.filter(e => byEval[e]);
  const st = (e: SdqEvaluatorType) => byEval[e]?.triagingStatus;
  const overall = evaluated.reduce<SdqTriage | null>((acc, e) => (acc ? worseTriage(acc, st(e)!) : st(e)!), null);
  const make = (pattern: TriangulationPattern): TriangulationResult => ({ pattern, ...TRI_TEXT[pattern], overall, evaluated });
  const t = st('TEACHER'); const p = st('PARENT'); const s = st('STUDENT');
  if (!t || !p) {
    return make('INCOMPLETE');
  }
  if (isConcern(t) !== isConcern(p)) return make('HOME_SCHOOL_CONFLICT');
  if (isConcern(t) && isConcern(p)) {
    if (s && !isConcern(s)) return make('STUDENT_INSIGHT_GAP');
    return s ? make('ALL_CONCERN') : make('INCOMPLETE');
  }
  // ครูและผู้ปกครองปกติ
  if (s && isConcern(s)) return make('STUDENT_ONLY_CONCERN');
  return s ? make('ALL_NORMAL') : make('INCOMPLETE');
}

// ───────── รอบที่ 2 ─────────
export interface Round2Eligibility {
  /** รอบแรกมีฝ่ายใดเสี่ยง/มีปัญหา — ไม่ต้องพิมพ์เหตุผลเอง (ระบบเติมให้) */
  byRisk: boolean;
  autoReason: string;
}
export function round2Eligibility(round1: Partial<Record<SdqEvaluatorType, { triagingStatus: SdqTriage }>>): Round2Eligibility {
  const flagged = SDQ_EVALUATORS.filter(e => isConcern(round1[e]?.triagingStatus));
  const NAME: Record<SdqEvaluatorType, string> = { STUDENT: 'นักเรียน', TEACHER: 'ครู', PARENT: 'ผู้ปกครอง' };
  return {
    byRisk: flagged.length > 0,
    autoReason: flagged.length
      ? `ผลรอบแรก: ${flagged.map(e => `${NAME[e]} ${SDQ_TRIAGE_LABEL[round1[e]!.triagingStatus]}`).join(', ')}`
      : '',
  };
}
export function validateFollowUpReason(reason: string): string | null {
  const r = reason.trim();
  if (!r) return 'ระบุเหตุผลที่ประเมินซ้ำ (เช่น อยู่ระหว่างการดูแลช่วยเหลืออย่างใกล้ชิด)';
  if (r.length > SDQ_FOLLOWUP_REASON_MAX) return `เหตุผลยาวเกิน ${SDQ_FOLLOWUP_REASON_MAX} ตัวอักษร`;
  return null;
}

/** เทียบรอบ 1 กับรอบ 2 (มุมมองครู) */
export function progressLabel(r1: SdqTriage | undefined, r2: SdqTriage | undefined): { text: string; tone: 'better' | 'same' | 'worse' | 'none' } {
  if (!r1 || !r2) return { text: 'ยังเทียบไม่ได้', tone: 'none' };
  if (SEVERITY[r2] < SEVERITY[r1]) return { text: 'ดีขึ้น', tone: 'better' };
  if (SEVERITY[r2] > SEVERITY[r1]) return { text: 'แย่ลง', tone: 'worse' };
  return { text: 'คงเดิม', tone: 'same' };
}

// ───────── สรุปผลการคัดกรองรายชั้นเรียน (แนบ ข้อ 3 / แบบสรุปรายงาน) ─────────
export type ProfileSource = SdqEvaluatorType | 'WORST';
export const PROFILE_SOURCE_LABEL: Record<ProfileSource, string> = {
  TEACHER: 'มุมมองครูที่ปรึกษา', STUDENT: 'นักเรียนประเมินตนเอง', PARENT: 'มุมมองผู้ปกครอง', WORST: 'รวม 3 ฝ่าย (ผลที่รุนแรงที่สุด)',
};
export type ProfileRowKey = SdqDifficultyKey | 'total' | 'prosocial';
export const PROFILE_ROWS: { key: ProfileRowKey; label: string }[] = [
  { key: 'emotional', label: '1. ด้านอารมณ์' },
  { key: 'conduct', label: '2. ด้านพฤติกรรมเกเร / ความประพฤติ' },
  { key: 'hyperactivity', label: '3. ด้านพฤติกรรมไม่อยู่นิ่ง / สมาธิสั้น' },
  { key: 'peerProblems', label: '4. ด้านความสัมพันธ์กับเพื่อน' },
  { key: 'total', label: 'คะแนนรวมปัญหา (ด้านที่ 1–4)' },
  { key: 'prosocial', label: '5. ด้านสัมพันธภาพทางสังคม (จุดแข็ง)' },
];
const DIFF_KEYS: SdqDifficultyKey[] = ['emotional', 'conduct', 'hyperactivity', 'peerProblems'];
export const SUBSCALE_SHORT: Record<SdqDifficultyKey, string> = {
  emotional: 'ด้านอารมณ์', conduct: 'ด้านพฤติกรรมเกเร', hyperactivity: 'ด้านไม่อยู่นิ่ง/สมาธิสั้น', peerProblems: 'ด้านความสัมพันธ์กับเพื่อน',
};

export interface ProfileCell { normal: number; risk: number; problem: number; n: number }
export interface StudentScreen {
  studentId: string;
  overall: SdqTriage;
  sub: Partial<Record<SdqDifficultyKey, SdqTriage>>;
  prosocial?: SdqStrengthStatus;
}

/** ผลของนักเรียนแต่ละคนตามแหล่งที่เลือก (WORST = รุนแรงที่สุดต่อด้านจากทุกฝ่ายที่ประเมิน) */
export function screensFor(records: readonly SdqRecordLike[], studentIds: readonly string[], academicYear: string, source: ProfileSource, round: SdqRound = 1): StudentScreen[] {
  const out: StudentScreen[] = [];
  for (const id of studentIds) {
    const by = resultsOf(records, id, academicYear, round);
    const recs = (source === 'WORST' ? SDQ_EVALUATORS.map(e => by[e]) : [by[source]]).filter((r): r is SdqRecordLike => !!r);
    if (!recs.length) continue;
    const s: StudentScreen = { studentId: id, overall: 'NORMAL', sub: {} };
    for (const r of recs) {
      s.overall = worseTriage(s.overall, r.triagingStatus);
      for (const k of DIFF_KEYS) {
        const v = r.subscaleStatus?.[k];
        if (v) s.sub[k] = s.sub[k] ? worseTriage(s.sub[k]!, v) : v;
      }
      const ps = r.subscaleStatus?.prosocial;
      if (ps) s.prosocial = s.prosocial === 'NO_STRENGTH' || ps === 'NO_STRENGTH' ? 'NO_STRENGTH' : 'HAS_STRENGTH';
    }
    out.push(s);
  }
  return out;
}

const emptyCell = (): ProfileCell => ({ normal: 0, risk: 0, problem: 0, n: 0 });
const addTo = (c: ProfileCell, t: SdqTriage) => { c.n++; if (t === 'NORMAL') c.normal++; else if (t === 'AT_RISK') c.risk++; else c.problem++; };

export interface ClassProfile {
  rows: Record<ProfileRowKey, ProfileCell>;
  assessed: number;
  total: number;
}
/** ตารางส่วนที่ 1: จำนวนต่อด้าน (ด้านจุดแข็ง: มีจุดแข็ง = ช่องปกติ, ไม่มีจุดแข็ง = ช่องมีปัญหา) — ผลรุ่นเก่าไม่มีรายด้านนับเฉพาะแถวรวม */
export function buildClassProfile(screens: readonly StudentScreen[], totalStudents: number): ClassProfile {
  const rows = Object.fromEntries(PROFILE_ROWS.map(r => [r.key, emptyCell()])) as Record<ProfileRowKey, ProfileCell>;
  for (const s of screens) {
    addTo(rows.total, s.overall);
    for (const k of DIFF_KEYS) if (s.sub[k]) addTo(rows[k], s.sub[k]!);
    if (s.prosocial) addTo(rows.prosocial, s.prosocial === 'HAS_STRENGTH' ? 'NORMAL' : 'VULNERABLE');
  }
  return { rows, assessed: screens.length, total: totalStudents };
}

export const pct = (part: number, whole: number): number => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

export interface ConcernRow {
  studentId: string;
  overall: SdqTriage;
  /** ด้านที่มีปัญหาเด่นชัด — มีปัญหาก่อน แล้วเสี่ยง */
  prominent: SdqDifficultyKey[];
}
/** ตารางส่วนที่ 2: นักเรียนที่คะแนนรวมหรือรายด้านใดเสี่ยง/มีปัญหา */
export function concernList(screens: readonly StudentScreen[]): ConcernRow[] {
  return screens
    .map(s => ({
      studentId: s.studentId,
      overall: s.overall,
      prominent: DIFF_KEYS.filter(k => isConcern(s.sub[k])).sort((a, b) => SEVERITY[s.sub[b]!] - SEVERITY[s.sub[a]!]),
    }))
    .filter(r => isConcern(r.overall) || r.prominent.length > 0)
    .sort((a, b) => SEVERITY[b.overall] - SEVERITY[a.overall]);
}

/** ส่วนที่ 3 ข้อ 1: ข้อความสรุปภาพรวม (สร้างจากตัวเลขจริง ครูแก้ต่อได้) */
export function profileSummaryText(p: ClassProfile): string {
  const t = p.rows.total;
  if (!t.n) return 'ยังไม่มีผลการประเมินในชั้นเรียนนี้';
  const concern = t.risk + t.problem;
  const worst = DIFF_KEYS
    .map(k => ({ k, c: p.rows[k].risk + p.rows[k].problem }))
    .filter(x => x.c > 0)
    .sort((a, b) => b.c - a.c)[0];
  return `ประเมินแล้ว ${t.n} จาก ${p.total} คน นักเรียนส่วนใหญ่${t.normal >= concern ? 'เป็นกลุ่มปกติ' : 'อยู่ในกลุ่มเสี่ยง/มีปัญหา'} `
    + `(ปกติร้อยละ ${pct(t.normal, t.n)}) โดยมีกลุ่มเสี่ยงและกลุ่มมีปัญหารวมกันร้อยละ ${pct(concern, t.n)}`
    + (worst ? ` ปัญหาที่พบมากที่สุดคือ${SUBSCALE_SHORT[worst.k]} (${worst.c} คน)` : ' ไม่พบปัญหารายด้าน');
}

// ───────── ภาพรวมทั้งโรงเรียน (ผู้บริหาร/งานแนะแนว) — ไม่มีชื่อ ─────────
export interface RoomRow { room: string; total: number; assessed: number; normal: number; risk: number; problem: number }
export function buildRoomRows(screens: readonly StudentScreen[], roomOf: (studentId: string) => string | undefined, roomTotals: Map<string, number>): RoomRow[] {
  const rows = new Map<string, RoomRow>();
  for (const [room, total] of roomTotals) rows.set(room, { room, total, assessed: 0, normal: 0, risk: 0, problem: 0 });
  for (const s of screens) {
    const room = roomOf(s.studentId);
    if (!room) continue;
    const r = rows.get(room) ?? { room, total: 0, assessed: 0, normal: 0, risk: 0, problem: 0 };
    r.assessed++;
    if (s.overall === 'NORMAL') r.normal++; else if (s.overall === 'AT_RISK') r.risk++; else r.problem++;
    rows.set(room, r);
  }
  return [...rows.values()].sort((a, b) => a.room.localeCompare(b.room, 'th', { numeric: true }));
}
