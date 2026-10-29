/**
 * ระบบนิเทศการสอน — ตรรกะกลาง (ต้องตรง firestore.rules บล็อก "supervision_*")
 *
 * - แบบสังเกตการสอน 20 ข้อ เต็ม 100 (แบบประจำภาคเรียน 2568) ระดับ 5 ดีมาก … 1 ไม่ผ่าน
 * - 1 รอบต่อภาคเรียน, 1 ผลสังเกตการสอนต่อครู 1 คนต่อรอบ (doc id = `{roundId}_{teacherStaffId}`)
 * - ผู้นิเทศ: ครูนิเทศที่ถูกจับคู่ + หัวหน้า/รองหัวหน้ากลุ่มสาระฯ (ผู้นิเทศโดยตำแหน่ง ของกลุ่มสาระฯ ตนเอง)
 * - ตัวตนบุคลากรเป็น staff doc id (claim staffId) เสมอ ไม่ใช่ Auth UID — ดู staffIdentity.ts
 */

import type { EvalTemplate } from './evaluationTemplate';
import { numberedLabel } from './evaluationTemplate';

export const SUPERVISION_TEMPLATE_VERSION = 1;

export type SupervisionScore = 1 | 2 | 3 | 4 | 5;

export interface SupervisionItem { id: string; section: number; label: string }
export interface SupervisionSection { no: number; title: string }

export const SUPERVISION_SECTIONS: readonly SupervisionSection[] = [
  { no: 1, title: 'การจัดบรรยากาศและบริหารชั้นเรียน' },
  { no: 2, title: 'บุคลิกภาพ' },
  { no: 3, title: 'การดำเนินการสอน' },
  { no: 4, title: 'การใช้สื่อและนวัตกรรมการเรียนรู้' },
  { no: 5, title: 'การวัดและประเมินผล' },
];

/** id = `s{หมวด}_{ข้อ}` — ใช้เป็น key ใน scores (rules ตรวจ key ชุดเดียวกันนี้) */
export const SUPERVISION_ITEMS: readonly SupervisionItem[] = [
  { id: 's1_1', section: 1, label: '1.1 การตรงต่อเวลา' },
  { id: 's1_2', section: 1, label: '1.2 การควบคุมความเป็นระเบียบในชั้นเรียน' },
  { id: 's1_3', section: 1, label: '1.3 การให้คำปรึกษาแก่ผู้เรียนในชั้นเรียน' },
  { id: 's1_4', section: 1, label: '1.4 การรักษาความสะอาดในชั้นเรียน' },
  { id: 's2_1', section: 2, label: '2.1 การแต่งกายสุภาพ เหมาะสม' },
  { id: 's2_2', section: 2, label: '2.2 การใช้น้ำเสียง มีความชัดเจน' },
  { id: 's2_3', section: 2, label: '2.3 ความเชื่อมั่นในตนเอง' },
  { id: 's2_4', section: 2, label: '2.4 การใช้ภาษาสื่อสารและสร้างบรรยากาศการเรียนรู้' },
  { id: 's3_1', section: 3, label: '3.1 วางแผนการจัดการเรียนรู้สอดคล้องกับมาตรฐานการเรียนรู้ ตัวชี้วัด/ผลการเรียนรู้ที่คาดหวัง' },
  { id: 's3_2', section: 3, label: '3.2 เนื้อหาสอดคล้องกับจุดประสงค์การเรียนรู้' },
  { id: 's3_3', section: 3, label: '3.3 การสอดแทรกความรู้ทั่วไปและคุณธรรม จริยธรรม' },
  { id: 's3_4', section: 3, label: '3.4 การใช้วิธีการสอนที่เหมาะสมน่าสนใจ (บรรยาย สาธิต เรียนเป็นกลุ่ม รายงานหน้าชั้น ค้นคว้านอกห้อง ปฏิบัติจริง ฯลฯ)' },
  { id: 's3_5', section: 3, label: '3.5 การเปิดโอกาสให้ผู้เรียนซักถามหรือแสดงความคิดเห็น' },
  { id: 's3_6', section: 3, label: '3.6 มีการตั้งคำถามที่กระตุ้นผู้เรียนใช้กระบวนการคิดและร่วมแสดงความคิดเห็น' },
  { id: 's3_7', section: 3, label: '3.7 การสรุปเนื้อหา ได้ตรงตามจุดประสงค์' },
  { id: 's4_1', section: 4, label: '4.1 ใช้สื่อการสอนที่สอดคล้องตามตัวชี้วัด' },
  { id: 's4_2', section: 4, label: '4.2 ใช้สื่อที่มีความถูกต้อง ทันสมัย' },
  { id: 's4_3', section: 4, label: '4.3 ใช้สื่อหรือตัวอย่างที่หลากหลายในการจัดการเรียนรู้' },
  { id: 's5_1', section: 5, label: '5.1 สอดคล้องและครอบคลุมจุดประสงค์' },
  { id: 's5_2', section: 5, label: '5.2 การประเมินผลตามสภาพจริง (ปรนัย อัตนัย ปฏิบัติ รายงาน มอบหมายงาน แบบฝึกหัด สังเกตพฤติกรรม ฯลฯ)' },
];

/** แบบตั้งต้น (เวอร์ชัน 1) — แอดมินแก้เป็นเวอร์ชันใหม่ได้ ดู lib/evaluationTemplate.ts */
export const DEFAULT_SUPERVISION_TEMPLATE: EvalTemplate = {
  kind: 'SUPERVISION',
  version: SUPERVISION_TEMPLATE_VERSION,
  criteria: SUPERVISION_ITEMS.map(i => ({ id: i.id, label: i.label.replace(/^\d+\.\d+\s+/, ''), section: i.section, ...(i.id === 's5_2' ? { assessmentMethod: true } : {}) })),
  sections: SUPERVISION_SECTIONS.map(s => ({ no: s.no, title: s.title })),
};

export const SUPERVISION_ITEM_COUNT = SUPERVISION_ITEMS.length; // 20 (แบบเวอร์ชัน 1)
export const SUPERVISION_MAX_SCORE = SUPERVISION_ITEM_COUNT * 5; // 100
export const SUPERVISION_MAX_PHOTOS = 6;

export const SCORE_LABELS: Record<SupervisionScore, string> = {
  5: 'ดีมาก', 4: 'ดี', 3: 'พอใช้', 2: 'ควรปรับปรุง', 1: 'ไม่ผ่าน',
};

export type SupervisionBand = 'ดีมาก' | 'ดี' | 'พอใช้' | 'ควรปรับปรุง' | 'ไม่ผ่าน';
export const SUPERVISION_BANDS: readonly SupervisionBand[] = ['ดีมาก', 'ดี', 'พอใช้', 'ควรปรับปรุง', 'ไม่ผ่าน'];

/**
 * เกณฑ์สรุปผล: 91–100 ดีมาก, 81–90 ดี, 71–80 พอใช้, 61–70 ควรปรับปรุง, ต่ำกว่า 61 (รวม 60) = ไม่ผ่าน
 * (แบบเดิมเขียน "61–70" กับ "ต่ำกว่า 60" ทำให้ 60 พอดีไม่มีเกณฑ์ — โรงเรียนเลือกให้ 60 ลงมาเป็นไม่ผ่าน)
 */
export function supervisionBand(percent: number): SupervisionBand {
  if (percent >= 91) return 'ดีมาก';
  if (percent >= 81) return 'ดี';
  if (percent >= 71) return 'พอใช้';
  if (percent >= 61) return 'ควรปรับปรุง';
  return 'ไม่ผ่าน';
}

export type ScoreMap = Partial<Record<string, number>>;

const isScore = (v: unknown): v is SupervisionScore =>
  typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 5;

export interface ObservationResult {
  answered: number;
  complete: boolean;
  total: number;
  /** total × 100 ÷ (จำนวนข้อ × 5) — ยังตอบไม่ครบ = null (ไม่คิดเปอร์เซ็นต์จากข้อที่ตอบบางส่วน) */
  percent: number | null;
  band: SupervisionBand | null;
}

/** คิดคะแนน — ต้องตอบครบทุกข้อของแบบ (เวอร์ชัน 1 = 20 ข้อ) ด้วยคะแนน 1–5 ถึงจะได้เปอร์เซ็นต์/ผลสรุป */
export function computeObservation(scores: ScoreMap | null | undefined, tpl: EvalTemplate = DEFAULT_SUPERVISION_TEMPLATE): ObservationResult {
  const s = scores || {};
  let answered = 0;
  let total = 0;
  for (const item of tpl.criteria) {
    const v = s[item.id];
    if (isScore(v)) { answered += 1; total += v; }
  }
  const count = tpl.criteria.length;
  const complete = count > 0 && answered === count;
  const percent = complete ? Math.round((total * 100 / (count * 5)) * 100) / 100 : null;
  return { answered, complete, total, percent, band: percent === null ? null : supervisionBand(percent) };
}

// ───────────────────────── รอบนิเทศ / รหัสเอกสาร ─────────────────────────

export type SupervisionTerm = '1' | '2';

export const supervisionRoundId = (academicYear: string, term: string) => `${academicYear}_${term}`;
export const isValidRoundId = (id: string) => /^\d{4}_[12]$/.test(id);
export const observationId = (roundId: string, teacherStaffId: string) => `${roundId}_${teacherStaffId}`;
export const assignmentId = (roundId: string, teacherStaffId: string, supervisorStaffId: string) =>
  `${roundId}_${teacherStaffId}_${supervisorStaffId}`;

export interface SupervisionRound {
  id: string;
  academicYear: string;
  term: SupervisionTerm;
  /** OPEN = บันทึก/แก้ผลได้, CLOSED = ปิดรอบแล้ว (ดูอย่างเดียว) */
  status: 'OPEN' | 'CLOSED';
  openedByStaffId?: string;
}

export interface SupervisionAssignment {
  id: string;
  roundId: string;
  teacherStaffId: string;
  supervisorStaffId: string;
}

export interface SupervisionPhoto { url: string }

export interface SupervisionObservation {
  id: string;
  roundId: string;
  academicYear: string;
  term: SupervisionTerm;
  templateVersion: number;
  teacherStaffId: string;
  teacherName: string;
  /** กลุ่มสาระฯ ของผู้รับการนิเทศ ณ ตอนบันทึก (ต้องตรง staff/{teacherStaffId}.assignments.departmentId — rules ตรวจ) */
  departmentId: string;
  supervisorStaffId: string;
  supervisorName: string;
  courseCode: string;
  courseName: string;
  level: string;
  /** YYYY-MM-DD ที่ไปสังเกตการสอน */
  observedDate: string;
  observedTime: string;
  scores: ScoreMap;
  total: number;
  percent: number | null;
  band: SupervisionBand | null;
  /** 5.2 ระบุวิธีประเมินผล (ถ้ามี) */
  assessmentMethod: string;
  strengths: string;
  improvements: string;
  comment: string;
  photos: SupervisionPhoto[];
  /** false = ฉบับร่าง (เห็นเฉพาะผู้นิเทศ/หัวหน้างานนิเทศ), true = ส่งแล้ว ล็อกคะแนน */
  submitted: boolean;
  acknowledged: boolean;
  teacherReply: string;
}

// ───────────────────────── สิทธิ์ ─────────────────────────

export const SUPERVISOR_ROLES = [
  'SUPERVISORY_TEACHER', 'HEAD_OF_DEPARTMENT', 'DEPUTY_HEAD_OF_DEPARTMENT', 'INSTRUCTIONAL_SUPERVISOR',
] as const;

/** ผู้นิเทศโดยตำแหน่ง — นิเทศครูในกลุ่มสาระฯ ตนเองได้โดยไม่ต้องจับคู่ */
export const EX_OFFICIO_SUPERVISOR_ROLES = ['HEAD_OF_DEPARTMENT', 'DEPUTY_HEAD_OF_DEPARTMENT'] as const;

/** เห็นผลรายบุคคลของครูทุกคน: ผอ./รองผอ./หัวหน้างานนิเทศ */
export const SUPERVISION_VIEW_ALL_ROLES = [
  'INSTRUCTIONAL_SUPERVISOR', 'DIRECTOR', 'DEPUTY_DIRECTOR_ACADEMIC', 'EXECUTIVE',
  'DEPUTY_DIRECTOR_BUDGET', 'DEPUTY_DIRECTOR_PERSONNEL', 'DEPUTY_DIRECTOR_GENERAL',
] as const;

/** เปิดรอบ/จับคู่ผู้นิเทศ */
export const SUPERVISION_MANAGE_ROLES = ['INSTRUCTIONAL_SUPERVISOR', 'SUPER_ADMIN'] as const;

/** เพิ่ม/แก้แบบประเมิน (แบบสังเกตการสอน + แบบประเมินแผนการสอน) — หัวหน้างานนิเทศเท่านั้น (SUPER_ADMIN ไม่ได้; ต้องตรง rules `etEditor()`) */
export const TEMPLATE_EDIT_ROLES = ['INSTRUCTIONAL_SUPERVISOR'] as const;

const has = (roles: readonly string[] | undefined, list: readonly string[]) => !!roles && roles.some(r => list.includes(r));

export const canManageSupervision = (roles: readonly string[] | undefined) => has(roles, SUPERVISION_MANAGE_ROLES);
export const canEditEvaluationTemplates = (roles: readonly string[] | undefined) => has(roles, TEMPLATE_EDIT_ROLES);
/**
 * แก้แบบประเมินได้เมื่อ "บทบาทที่กำลังใช้อยู่" (activeRole) เป็นหัวหน้างานนิเทศ และบัญชีมีบทบาทนี้จริง
 * — บัญชีเดียวถือหลายบทบาทได้ แต่สลับไปใช้บทบาทอื่นแล้วต้องแก้แบบประเมินไม่ได้ (บังคับที่หน้าจอเท่านั้น:
 * rules เห็นแค่ claims roles ทั้งหมด ไม่รู้ว่าสลับบทบาทไหนอยู่)
 */
export const canEditEvaluationTemplatesAs = (roles: readonly string[] | undefined, activeRole: string | undefined | null) =>
  canEditEvaluationTemplates(roles) && !!activeRole && TEMPLATE_EDIT_ROLES.some(r => r === activeRole);
export const canViewAllSupervision = (roles: readonly string[] | undefined) => has(roles, SUPERVISION_VIEW_ALL_ROLES);
export const isExOfficioSupervisor = (roles: readonly string[] | undefined) => has(roles, EX_OFFICIO_SUPERVISOR_ROLES);
export const isSupervisor = (roles: readonly string[] | undefined) => has(roles, SUPERVISOR_ROLES);

export interface StaffRef { staffId: string; departmentId?: string }

/**
 * ผู้นิเทศ `me` นิเทศครู `teacher` ได้หรือไม่ — ห้ามนิเทศตัวเอง;
 * ต้องถูกจับคู่ในรอบนั้น หรือเป็นหัวหน้า/รองหัวหน้ากลุ่มสาระฯ เดียวกับครูคนนั้น
 */
export function canObserve(
  me: StaffRef & { roles: readonly string[] },
  teacher: StaffRef,
  assignedTeacherIds: readonly string[],
): boolean {
  if (!me.staffId || !teacher.staffId || me.staffId === teacher.staffId) return false;
  if (!isSupervisor(me.roles)) return false;
  if (assignedTeacherIds.includes(teacher.staffId)) return true;
  return isExOfficioSupervisor(me.roles) && !!me.departmentId && me.departmentId === teacher.departmentId;
}

export type SupervisionReadScope = 'ALL' | 'DEPARTMENT' | 'SUPERVISED' | 'SELF';

/**
 * ขอบเขตผลที่ผู้ใช้เห็น (UI เลือก query ตามนี้ — rules บังคับซ้ำ):
 * ALL = ผอ./รองผอ./หัวหน้างานนิเทศ; DEPARTMENT = หัวหน้า/รองหัวหน้ากลุ่มสาระฯ;
 * SUPERVISED = ครูนิเทศ (เฉพาะที่ตนเองนิเทศ); SELF = ผู้รับการนิเทศ (ของตนเอง)
 */
export function supervisionScopes(roles: readonly string[] | undefined): SupervisionReadScope[] {
  const scopes: SupervisionReadScope[] = [];
  if (canViewAllSupervision(roles)) scopes.push('ALL');
  if (isExOfficioSupervisor(roles)) scopes.push('DEPARTMENT');
  if (isSupervisor(roles)) scopes.push('SUPERVISED');
  scopes.push('SELF');
  return scopes;
}

// ───────────────────────── ภาพรวม (ไม่มีชื่อบุคคล) ─────────────────────────

export interface SupervisionOverview {
  submitted: number;
  acknowledged: number;
  averagePercent: number | null;
  bands: Record<SupervisionBand, number>;
  /** ค่าเฉลี่ยรายหมวด (1–5) ตาม SUPERVISION_SECTIONS — ไม่มีข้อมูล = null */
  sectionAverages: { no: number; title: string; average: number | null }[];
  /** ข้อที่เฉลี่ยต่ำสุด 3 ข้อ (ประเด็นที่ควรพัฒนาทั้งโรงเรียน/กลุ่มสาระฯ) */
  lowestItems: { id: string; label: string; average: number }[];
}

type OverviewInput = Pick<SupervisionObservation, 'submitted' | 'acknowledged' | 'percent' | 'band' | 'scores'> & { templateVersion?: number };

export function summarizeObservations(list: readonly OverviewInput[], tpl: EvalTemplate = DEFAULT_SUPERVISION_TEMPLATE): SupervisionOverview {
  const done = list.filter(o => o.submitted);
  const bands: Record<SupervisionBand, number> = { 'ดีมาก': 0, 'ดี': 0, 'พอใช้': 0, 'ควรปรับปรุง': 0, 'ไม่ผ่าน': 0 };
  let pctSum = 0;
  let pctN = 0;
  const itemSum: Record<string, { sum: number; n: number }> = {};
  for (const o of done) {
    if (o.band) bands[o.band] += 1;
    if (typeof o.percent === 'number') { pctSum += o.percent; pctN += 1; }
    // รายข้อ/รายหมวดนับเฉพาะผลที่ใช้แบบเวอร์ชันเดียวกับ tpl (รหัสข้อเดียวกันอาจเปลี่ยนความหมายข้ามเวอร์ชัน)
    if ((o.templateVersion ?? 1) !== tpl.version) continue;
    for (const item of tpl.criteria) {
      const v = o.scores?.[item.id];
      if (isScore(v)) {
        const cur = itemSum[item.id] || { sum: 0, n: 0 };
        cur.sum += v; cur.n += 1; itemSum[item.id] = cur;
      }
    }
  }
  const avg = (id: string) => (itemSum[id] && itemSum[id].n > 0 ? itemSum[id].sum / itemSum[id].n : null);
  const sectionAverages = tpl.sections.map(sec => {
    const vals = tpl.criteria.filter(i => i.section === sec.no).map(i => avg(i.id)).filter((v): v is number => v !== null);
    return { no: sec.no, title: sec.title, average: vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100 : null };
  });
  const lowestItems = tpl.criteria
    .map(i => ({ id: i.id, label: numberedLabel(tpl, i), average: avg(i.id) }))
    .filter((i): i is { id: string; label: string; average: number } => i.average !== null)
    .sort((a, b) => a.average - b.average)
    .slice(0, 3)
    .map(i => ({ ...i, average: Math.round(i.average * 100) / 100 }));
  return {
    submitted: done.length,
    acknowledged: done.filter(o => o.acknowledged).length,
    averagePercent: pctN ? Math.round((pctSum / pctN) * 100) / 100 : null,
    bands,
    sectionAverages,
    lowestItems,
  };
}

// ───────────────────────── สร้างข้อมูลที่จะบันทึก ─────────────────────────

export interface ObservationFormInput {
  roundId: string;
  teacher: { staffId: string; name: string; departmentId: string };
  supervisor: { staffId: string; name: string };
  courseCode: string;
  courseName: string;
  level: string;
  observedDate: string;
  observedTime: string;
  scores: ScoreMap;
  assessmentMethod: string;
  strengths: string;
  improvements: string;
  comment: string;
  photos: SupervisionPhoto[];
}

/** ข้อความผิดพลาดที่ผู้ใช้อ่านรู้เรื่อง — null = ส่งได้ (ใช้กับปุ่ม "ส่งผล" เท่านั้น; ฉบับร่างไม่บังคับ) */
export function validateForSubmit(input: ObservationFormInput, tpl: EvalTemplate = DEFAULT_SUPERVISION_TEMPLATE): string | null {
  const r = computeObservation(input.scores, tpl);
  if (!r.complete) return `ยังให้คะแนนไม่ครบ (${r.answered}/${tpl.criteria.length} ข้อ)`;
  if (!input.courseName.trim()) return 'กรุณาระบุรายวิชาที่สังเกตการสอน';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.observedDate)) return 'กรุณาเลือกวันที่สังเกตการสอน';
  return null;
}

const clip = (v: string, n: number) => (v || '').trim().slice(0, n);

/**
 * ฟิลด์ของเอกสาร supervision_observations (ยังไม่รวม createdAt/updatedAt/submittedAt ซึ่ง service ใส่ serverTimestamp ให้)
 * คะแนนรวม/เปอร์เซ็นต์/ผลสรุปคำนวณจากคะแนนรายข้อเสมอ — ไม่รับค่าจากภายนอก (rules ตรวจซ้ำตอนส่ง)
 */
export function buildObservationFields(input: ObservationFormInput, submit: boolean, tpl: EvalTemplate = DEFAULT_SUPERVISION_TEMPLATE) {
  const scores: Record<string, number> = {};
  for (const item of tpl.criteria) {
    const v = input.scores[item.id];
    if (isScore(v)) scores[item.id] = v;
  }
  const r = computeObservation(scores, tpl);
  const [academicYear, term] = input.roundId.split('_');
  return {
    roundId: input.roundId,
    academicYear,
    term,
    templateVersion: tpl.version,
    teacherStaffId: input.teacher.staffId,
    teacherName: clip(input.teacher.name, 160),
    departmentId: input.teacher.departmentId,
    supervisorStaffId: input.supervisor.staffId,
    supervisorName: clip(input.supervisor.name, 160),
    courseCode: clip(input.courseCode, 40),
    courseName: clip(input.courseName, 160),
    level: clip(input.level, 40),
    observedDate: input.observedDate,
    observedTime: clip(input.observedTime, 20),
    scores,
    total: r.total,
    percent: r.percent,
    band: r.band,
    assessmentMethod: clip(input.assessmentMethod, 300),
    strengths: clip(input.strengths, 2000),
    improvements: clip(input.improvements, 2000),
    comment: clip(input.comment, 2000),
    photos: input.photos.slice(0, SUPERVISION_MAX_PHOTOS).map(p => ({ url: p.url })),
    submitted: submit,
    acknowledged: false,
    teacherReply: '',
  };
}
