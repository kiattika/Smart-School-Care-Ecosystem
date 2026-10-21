/**
 * แผนศึกษาต่อ (ม.3 / ม.6) และ TCAS — `student_study_plans/{studentId}` (ต้องตรง firestore.rules.comments บล็อก study plans)
 *
 * นักเรียนกรอกเอง (ผู้ปกครองดูอย่างเดียว); ครูแนะแนวเห็นรายชื่อ+สถานะ; ครูที่ปรึกษาเห็นห้องตัวเอง;
 * ผู้บริหารเห็นเฉพาะตัวเลขรวม (ไม่แสดงชื่อ). ไม่มีข้อมูล = "ยังไม่กรอก" ไม่เดาค่าให้
 */

export type StudyLevel = 'M3' | 'M6';

export const STUDY_LEVEL_LABEL: Record<StudyLevel, string> = { M3: 'ม.3', M6: 'ม.6' };

/** ระดับชั้นจากชื่อห้อง "ม.6/3" / "M.6/3" — เฉพาะ ม.3 และ ม.6 ที่ต้องทำแผน; อื่น ๆ = null */
export function studyLevelOfRoom(room: string | undefined | null): StudyLevel | null {
  const m = /^\s*(?:ม|M|m)\.?\s*([36])\s*\//.exec(room || '');
  if (!m) return null;
  return m[1] === '3' ? 'M3' : 'M6';
}

export const M6_PLAN_TYPES = [
  { id: 'UNIVERSITY', label: 'ศึกษาต่อระดับอุดมศึกษา (TCAS)' },
  { id: 'VOCATIONAL', label: 'ศึกษาต่อสายอาชีพ/ราชภัฏ/โรงเรียนเฉพาะทาง' },
  { id: 'WORK', label: 'ทำงาน/ประกอบอาชีพ' },
  { id: 'OTHER', label: 'อื่น ๆ' },
  { id: 'UNDECIDED', label: 'ยังไม่ตัดสินใจ' },
] as const;

export const M3_PLAN_TYPES = [
  { id: 'M4_SAME_SCHOOL', label: 'เรียนต่อ ม.4 ที่โรงเรียนเดิม' },
  { id: 'M4_OTHER_SCHOOL', label: 'เรียนต่อ ม.4 ที่โรงเรียนอื่น' },
  { id: 'VOCATIONAL', label: 'ศึกษาต่อสายอาชีพ (ปวช./อื่น ๆ)' },
  { id: 'OTHER', label: 'อื่น ๆ' },
  { id: 'UNDECIDED', label: 'ยังไม่ตัดสินใจ' },
] as const;

export type StudyPlanType = (typeof M6_PLAN_TYPES)[number]['id'] | (typeof M3_PLAN_TYPES)[number]['id'];

export const TCAS_ROUNDS = [
  { id: 'R1', label: 'รอบ 1 พอร์ตโฟลิโอ' },
  { id: 'R2', label: 'รอบ 2 โควตา' },
  { id: 'R3', label: 'รอบ 3 แอดมิชชัน' },
  { id: 'R4', label: 'รอบ 4 รับตรงอิสระ' },
  { id: 'UNSURE', label: 'ยังไม่แน่ใจ' },
] as const;
export type TcasRound = (typeof TCAS_ROUNDS)[number]['id'];

export interface StudyChoice {
  /** ลำดับความสนใจ (1 = อันดับแรก) ไม่เก็บ — ใช้ลำดับในอาร์เรย์ */
  institution: string;
  program: string;
  round: TcasRound;
}

export interface StudyPlan {
  studentId: string;
  studentUid: string;
  room: string;
  level: StudyLevel;
  academicYear: string;
  planType: StudyPlanType;
  choices: StudyChoice[];
  /** ลิงก์พอร์ตโฟลิโอ (https เท่านั้น) — ว่าง = ยังไม่มี */
  portfolioUrl: string;
  /** นักเรียนยืนยันว่าส่งพอร์ตโฟลิโอแล้ว (รอบ 1) */
  portfolioSent: boolean;
  note: string;
  updatedAtMs: number | null;
}

export const MAX_CHOICES = 3;
export const MAX_TEXT = 120;
export const MAX_NOTE = 500;
export const MAX_URL = 500;

export const isHttpsUrl = (v: string): boolean => /^https:\/\/[^\s]+$/i.test(v.trim());

export function planTypesFor(level: StudyLevel) {
  return level === 'M6' ? M6_PLAN_TYPES : M3_PLAN_TYPES;
}

/** ม.6 เลือกอุดมศึกษา = ต้องมีอย่างน้อย 1 ตัวเลือก (สถาบัน+สาขา); ม.3 ใช้ตัวเลือกไม่ได้ (เก็บแค่ประเภท+หมายเหตุ) */
export function usesChoices(level: StudyLevel, planType: StudyPlanType): boolean {
  return level === 'M6' && planType === 'UNIVERSITY';
}

/** ข้อผิดพลาดที่ต้องแก้ก่อนบันทึก (ว่าง = ผ่าน) — ตรงกับที่ rules บังคับได้ + ส่วนที่ rules วนตรวจรายการไม่ได้ */
export function validateStudyPlan(p: Pick<StudyPlan, 'level' | 'planType' | 'choices' | 'portfolioUrl' | 'portfolioSent' | 'note'>): string[] {
  const errs: string[] = [];
  if (!planTypesFor(p.level).some(t => t.id === p.planType)) errs.push('เลือกแผนหลังจบชั้นนี้');
  if (p.note.length > MAX_NOTE) errs.push(`หมายเหตุยาวเกิน ${MAX_NOTE} ตัวอักษร`);
  if (!usesChoices(p.level, p.planType)) {
    if (p.choices.length > 0) errs.push('แผนนี้ไม่ใช้รายการสถาบัน/สาขา');
    if (p.portfolioUrl.trim() || p.portfolioSent) errs.push('พอร์ตโฟลิโอใช้กับแผนศึกษาต่ออุดมศึกษาเท่านั้น');
    return errs;
  }
  if (p.choices.length < 1) errs.push('ใส่สถาบัน/สาขาที่สนใจอย่างน้อย 1 รายการ');
  if (p.choices.length > MAX_CHOICES) errs.push(`ใส่ได้ไม่เกิน ${MAX_CHOICES} รายการ`);
  p.choices.forEach((c, i) => {
    if (!c.institution.trim() || !c.program.trim()) errs.push(`รายการที่ ${i + 1}: กรอกสถาบันและสาขา/คณะให้ครบ`);
    if (c.institution.length > MAX_TEXT || c.program.length > MAX_TEXT) errs.push(`รายการที่ ${i + 1}: ข้อความยาวเกิน ${MAX_TEXT} ตัวอักษร`);
    if (!TCAS_ROUNDS.some(r => r.id === c.round)) errs.push(`รายการที่ ${i + 1}: เลือกรอบ TCAS`);
  });
  const url = p.portfolioUrl.trim();
  if (url && (!isHttpsUrl(url) || url.length > MAX_URL)) errs.push('ลิงก์พอร์ตโฟลิโอต้องขึ้นต้นด้วย https:// และไม่เกิน 500 ตัวอักษร');
  if (p.portfolioSent && !url) errs.push('ติ๊ก "ส่งพอร์ตโฟลิโอแล้ว" ต้องใส่ลิงก์พอร์ตโฟลิโอด้วย');
  return errs;
}

export type PlanStatus = 'NOT_FILLED' | 'FILLED' | 'PORTFOLIO_SENT';

export const PLAN_STATUS_LABEL: Record<PlanStatus, string> = {
  NOT_FILLED: 'ยังไม่กรอก',
  FILLED: 'กรอกแล้ว',
  PORTFOLIO_SENT: 'ส่งพอร์ตโฟลิโอแล้ว',
};

export function planStatus(plan: StudyPlan | undefined | null): PlanStatus {
  if (!plan) return 'NOT_FILLED';
  return plan.portfolioSent ? 'PORTFOLIO_SENT' : 'FILLED';
}

export function planTypeLabel(level: StudyLevel, id: string): string {
  return planTypesFor(level).find(t => t.id === id)?.label ?? id;
}

/** แปลงเอกสารจาก Firestore → StudyPlan (ฟิลด์ผิดรูปแบบ = ไม่รับเอกสารนั้น, ไม่เดา) */
export function parseStudyPlan(id: string, raw: Record<string, unknown> | undefined): StudyPlan | null {
  if (!raw) return null;
  const level = raw.level === 'M3' || raw.level === 'M6' ? raw.level : null;
  if (!level || typeof raw.planType !== 'string') return null;
  if (!planTypesFor(level).some(t => t.id === raw.planType)) return null;
  const choicesRaw = Array.isArray(raw.choices) ? raw.choices : [];
  const choices: StudyChoice[] = [];
  for (const c of choicesRaw) {
    if (!c || typeof c !== 'object') continue;
    const o = c as Record<string, unknown>;
    if (typeof o.institution !== 'string' || typeof o.program !== 'string') continue;
    const round = TCAS_ROUNDS.find(r => r.id === o.round)?.id ?? 'UNSURE';
    choices.push({ institution: o.institution, program: o.program, round });
  }
  const ts = raw.updatedAt as { toMillis?: () => number } | undefined;
  return {
    studentId: typeof raw.studentId === 'string' ? raw.studentId : id,
    studentUid: typeof raw.studentUid === 'string' ? raw.studentUid : '',
    room: typeof raw.room === 'string' ? raw.room : '',
    level,
    academicYear: typeof raw.academicYear === 'string' ? raw.academicYear : '',
    planType: raw.planType as StudyPlanType,
    choices,
    portfolioUrl: typeof raw.portfolioUrl === 'string' ? raw.portfolioUrl : '',
    portfolioSent: raw.portfolioSent === true,
    note: typeof raw.note === 'string' ? raw.note : '',
    updatedAtMs: ts && typeof ts.toMillis === 'function' ? ts.toMillis() : null,
  };
}

export interface StudyRosterStudent { studentId: string; name: string; room: string }

export interface StudyRosterRow {
  studentId: string;
  name: string;
  room: string;
  level: StudyLevel;
  status: PlanStatus;
  plan: StudyPlan | null;
}

/** รายชื่อนักเรียน ม.3/ม.6 ทั้งหมด พร้อมสถานะแผน (นักเรียนที่ไม่มีแผน = ยังไม่กรอก) เรียงตามห้อง→ชื่อ */
export function buildRoster(students: StudyRosterStudent[], plans: StudyPlan[]): StudyRosterRow[] {
  const byId = new Map(plans.map(p => [p.studentId, p]));
  const rows: StudyRosterRow[] = [];
  for (const s of students) {
    const level = studyLevelOfRoom(s.room);
    if (!level) continue;
    const plan = byId.get(s.studentId) ?? null;
    rows.push({ studentId: s.studentId, name: s.name, room: s.room, level, status: planStatus(plan), plan });
  }
  return rows.sort((a, b) => a.room.localeCompare(b.room, 'th') || a.name.localeCompare(b.name, 'th'));
}

export interface StudySummary {
  level: StudyLevel;
  total: number;
  notFilled: number;
  filled: number;
  portfolioSent: number;
  /** จำนวนตามประเภทแผน (เฉพาะที่กรอกแล้ว) */
  byPlanType: { id: string; label: string; count: number }[];
  /** ม.6 เท่านั้น: รอบ TCAS ของตัวเลือกอันดับแรก */
  byFirstRound: { id: TcasRound; label: string; count: number }[];
}

export function summarizeRoster(rows: StudyRosterRow[], level: StudyLevel): StudySummary {
  const mine = rows.filter(r => r.level === level);
  const filledRows = mine.filter(r => r.plan);
  const byPlanType = planTypesFor(level)
    .map(t => ({ id: t.id as string, label: t.label as string, count: filledRows.filter(r => r.plan?.planType === t.id).length }));
  const byFirstRound = level === 'M6'
    ? TCAS_ROUNDS.map(r => ({
        id: r.id as TcasRound, label: r.label as string,
        count: filledRows.filter(x => x.plan?.choices[0]?.round === r.id).length,
      }))
    : [];
  return {
    level,
    total: mine.length,
    notFilled: mine.filter(r => r.status === 'NOT_FILLED').length,
    filled: mine.filter(r => r.status !== 'NOT_FILLED').length,
    portfolioSent: mine.filter(r => r.status === 'PORTFOLIO_SENT').length,
    byPlanType,
    byFirstRound,
  };
}

export type GoalCompare = 'NO_PLAN_NO_GOAL' | 'PLAN_ONLY' | 'GOAL_ONLY' | 'BOTH';

export const GOAL_COMPARE_LABEL: Record<GoalCompare, string> = {
  NO_PLAN_NO_GOAL: 'ยังไม่มีทั้งแผนและเป้าหมายในแบบประเมินตนเอง',
  PLAN_ONLY: 'มีแผน แต่ยังไม่ได้ตอบข้อ 27 ในแบบประเมินตนเอง',
  GOAL_ONLY: 'ตอบข้อ 27 แล้ว แต่ยังไม่กรอกแผนศึกษาต่อ',
  BOTH: 'มีทั้งแผนและเป้าหมายข้อ 27 — ครูอ่านเทียบกันเอง',
};

/**
 * เทียบแผนศึกษาต่อกับเป้าหมายข้อ 27 ของแบบประเมินตนเอง 30 ข้อ — ระบบ **ไม่ตัดสินว่าสอดคล้องหรือไม่**
 * (ข้อ 27 เป็นข้อความอิสระ) แค่บอกว่ามีข้อมูลฝั่งไหนบ้าง และให้ครูอ่านเทียบ
 */
export function compareWithSelfAssessment(plan: StudyPlan | null, goalText: string | undefined | null): GoalCompare {
  const hasGoal = !!(goalText && goalText.trim());
  if (plan && hasGoal) return 'BOTH';
  if (plan) return 'PLAN_ONLY';
  if (hasGoal) return 'GOAL_ONLY';
  return 'NO_PLAN_NO_GOAL';
}

export function countCompare(rows: { compare: GoalCompare }[]): Record<GoalCompare, number> {
  const out: Record<GoalCompare, number> = { NO_PLAN_NO_GOAL: 0, PLAN_ONLY: 0, GOAL_ONLY: 0, BOTH: 0 };
  for (const r of rows) out[r.compare]++;
  return out;
}
