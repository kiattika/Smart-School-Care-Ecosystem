/**
 * แผนการสอน/โครงการสอน (นิเทศเฟส 2) — ตรรกะกลาง (ต้องตรง firestore.rules บล็อก "lesson_plan_submissions")
 *
 * - ครูแปะลิงก์ https อย่างเดียว (ไม่เก็บไฟล์) ต่อรายวิชา (รหัสวิชา) ต่อภาคเรียน; doc id = `{semesterId}_{teacherStaffId}_{courseKey}`
 * - ต้องส่ง "ฉบับสมบูรณ์" (PLAN) อย่างน้อย 1 รายวิชา ที่เหลือส่งเป็น "โครงการสอน" (PROJECT) แทนได้
 * - ตรวจ 2 ขั้น: หัวหน้า/รองหัวหน้ากลุ่มสาระฯ → หัวหน้างานนิเทศ; ขอแก้ไข (REVISION) ครูส่งใหม่ = เริ่มขั้นแรกอีกครั้ง
 */

export type LessonPlanKind = 'PLAN' | 'PROJECT';
export type LessonPlanStage = 'SUBMITTED' | 'DEPT_APPROVED' | 'APPROVED' | 'REVISION';

export const KIND_LABEL: Record<LessonPlanKind, string> = { PLAN: 'แผนการสอนฉบับสมบูรณ์', PROJECT: 'โครงการสอน' };
export const STAGE_LABEL: Record<LessonPlanStage, string> = {
  SUBMITTED: 'รอหัวหน้ากลุ่มสาระฯ ตรวจ',
  DEPT_APPROVED: 'รอหัวหน้างานนิเทศตรวจ',
  APPROVED: 'ผ่านการตรวจแล้ว',
  REVISION: 'ขอให้แก้ไข',
};

/**
 * แบบประเมินความเหมาะสมแผนการจัดการเรียนรู้ 15 ข้อ (ตามแบบตัวอย่างที่โรงเรียนใช้อ้างอิง) — ให้คะแนนข้อละ 1–5
 * (5 มากที่สุด … 1 น้อยที่สุด) แล้วสรุปค่าเฉลี่ย/ระดับ; id q1–q15 ต้องตรง firestore.rules (lpScoresOk)
 * ส่วนข้อที่เป็นเรื่อง "การสอนจริง" (กระบวนการจัดการเรียนรู้/พฤติกรรมครู) อยู่ในแบบสังเกตการสอน (supervision.ts) ไม่ซ้ำที่นี่
 */
export const PLAN_CRITERIA = [
  { id: 'q1', label: 'มาตรฐานการเรียนรู้ สาระการเรียนรู้ ผลการเรียนรู้ สอดคล้องกับหลักสูตรสถานศึกษา' },
  { id: 'q2', label: 'การวิเคราะห์มาตรฐานและตัวชี้วัดสอดคล้องกับพฤติกรรมการเรียนรู้ แนวการวัดและประเมินผล และภาระงาน/ชิ้นงาน' },
  { id: 'q3', label: 'การเขียนสาระสำคัญในแผนการจัดการเรียนรู้' },
  { id: 'q4', label: 'จุดประสงค์การเรียนรู้ระบุพฤติกรรมชัดเจน สามารถวัดได้' },
  { id: 'q5', label: 'สาระการเรียนรู้ครบถ้วน สัมพันธ์กับจุดประสงค์การเรียนรู้' },
  { id: 'q6', label: 'กิจกรรมการเรียนรู้เหมาะสม ครบถ้วนทุกขั้นตอนตามวิธีสอน/กระบวนการ/เทคนิคการสอนที่ระบุไว้ (กลยุทธ์ในการจัดการเรียนรู้)' },
  { id: 'q7', label: 'กิจกรรมการเรียนรู้มีกลยุทธ์ส่งเสริมความแตกต่างระหว่างบุคคลของผู้เรียน' },
  { id: 'q8', label: 'กิจกรรมการเรียนรู้เรียงลำดับจากง่ายไปหายาก สอดคล้องกับเวลา' },
  { id: 'q9', label: 'ระบุการใช้สื่อ/แหล่งเรียนรู้สัมพันธ์สอดคล้องกับกิจกรรมการเรียนรู้' },
  { id: 'q10', label: 'มีหลักฐาน เช่น สื่อ ใบกิจกรรม ใบความรู้ เครื่องมือวัด ที่ปรากฏในแผนครบถ้วน' },
  { id: 'q11', label: 'สื่อการเรียนรู้ช่วยกระตุ้นและส่งเสริมให้ผู้เรียนฝึกปฏิบัติได้ด้วยตนเองหรือเป็นกลุ่ม' },
  { id: 'q12', label: 'ระบุเครื่องมือสำหรับการวัดผลประเมินผลอย่างชัดเจน' },
  { id: 'q13', label: 'การวัดและประเมินผลมีเครื่องมือและเกณฑ์ที่วัดได้ตรงตามมาตรฐานการเรียนรู้ ตัวชี้วัดและจุดประสงค์' },
  { id: 'q14', label: 'การวัดและประเมินผลเน้นการประเมินตามสภาพจริง' },
  { id: 'q15', label: 'การวัดและประเมินผลสนองต่อการส่งเสริมผลสัมฤทธิ์ทางการเรียน' },
] as const;
export type CriterionId = typeof PLAN_CRITERIA[number]['id'];
export type ScoresMap = Partial<Record<CriterionId, number>>;

export const SCORE_LABEL: Record<number, string> = { 5: 'มากที่สุด', 4: 'มาก', 3: 'ปานกลาง', 2: 'น้อย', 1: 'น้อยที่สุด' };

/** ค่าเฉลี่ยของข้อที่ให้คะแนนแล้ว (ยังไม่ให้เลย = null) ปัด 2 ตำแหน่ง */
export function averageScore(scores: ScoresMap): number | null {
  const v = PLAN_CRITERIA.map(c => scores[c.id]).filter((n): n is number => typeof n === 'number');
  return v.length === 0 ? null : Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 100) / 100;
}
/** เกณฑ์ระดับความเหมาะสมตามแบบ: 4.50–5.00 มากที่สุด, 3.50–4.49 มาก, 2.50–3.49 ปานกลาง, 1.50–2.49 น้อย, <1.50 น้อยที่สุด */
export function suitabilityLevel(avg: number | null): string {
  if (avg === null) return '-';
  if (avg >= 4.5) return 'มากที่สุด';
  if (avg >= 3.5) return 'มาก';
  if (avg >= 2.5) return 'ปานกลาง';
  if (avg >= 1.5) return 'น้อย';
  return 'น้อยที่สุด';
}
export function scoresComplete(scores: ScoresMap): boolean {
  return PLAN_CRITERIA.every(c => Number.isInteger(scores[c.id]) && (scores[c.id] as number) >= 1 && (scores[c.id] as number) <= 5);
}

export interface LessonPlanReview {
  byStaffId: string;
  byName: string;
  decision: 'APPROVE' | 'REVISE';
  comment: string;
  scores: ScoresMap;
  at?: unknown;
}

export interface LessonPlan {
  id: string;
  semesterId: string;
  academicYear: string;
  term: '1' | '2';
  teacherStaffId: string;
  teacherName: string;
  departmentId: string;
  courseKey: string;
  courseCode: string;
  courseName: string;
  level: string;
  kind: LessonPlanKind;
  url: string;
  note: string;
  stage: LessonPlanStage;
  deptReview?: LessonPlanReview;
  finalReview?: LessonPlanReview;
}

export const semesterIdOf = (academicYear: string, term: string) => `${academicYear}_${term}`;
/** รหัสวิชาที่ใช้เป็น courseKey — Firestore doc id ห้ามมี "/" และต้องไม่ว่าง ≤ 60 ตัว */
export const courseKeyOf = (code: string) => (code || '').trim().replace(/[\/\s]+/g, '-').slice(0, 60);
export const planDocId = (semesterId: string, teacherStaffId: string, courseKey: string) => `${semesterId}_${teacherStaffId}_${courseKey}`;

export const isHttpsUrl = (u: string) => /^https:\/\/[^ ]{4,490}$/.test((u || '').trim());

export function validateSubmission(input: { kind: string; url: string; note: string }): string | null {
  if (input.kind !== 'PLAN' && input.kind !== 'PROJECT') return 'กรุณาเลือกประเภทที่ส่ง';
  if (!isHttpsUrl(input.url)) return 'ลิงก์ต้องขึ้นต้นด้วย https:// และไม่มีช่องว่าง';
  if ((input.note || '').length > 500) return 'หมายเหตุยาวเกิน 500 ตัวอักษร';
  return null;
}

/**
 * URL สำหรับฝังดูในหน้าตรวจ (เคียงข้างแบบประเมิน) — รองรับ Google Docs/Slides/Sheets/Drive (ต้องตั้งสิทธิ์ให้ผู้ตรวจดูได้)
 * และไฟล์ .pdf ตรง ๆ; ลิงก์อื่นฝังไม่ได้ (null) ให้เปิดแท็บใหม่แทน
 */
export function embedUrlFor(url: string): string | null {
  try {
    const u = new URL((url || '').trim());
    if (u.protocol !== 'https:') return null;
    if (u.hostname === 'docs.google.com') {
      const m = u.pathname.match(/^\/(document|presentation|spreadsheets)\/d\/([\w-]+)/);
      if (m) return `https://docs.google.com/${m[1]}/d/${m[2]}/preview`;
      return null;
    }
    if (u.hostname === 'drive.google.com') {
      const f = u.pathname.match(/^\/file\/d\/([\w-]+)/);
      const id = f?.[1] || (u.pathname === '/open' ? u.searchParams.get('id') : null);
      return id && /^[\w-]+$/.test(id) ? `https://drive.google.com/file/d/${id}/preview` : null;
    }
    if (/\.pdf$/i.test(u.pathname)) return u.toString();
    return null;
  } catch { return null; }
}

// ───────────── สิทธิ์/ขอบเขตการเห็น ─────────────
export type PlanQuery = { scope: 'ALL' } | { scope: 'DEPARTMENT'; departmentId: string } | { scope: 'SELF'; staffId: string };

/** ผู้ตรวจ/ผู้ดู query ใด (ต้องตรง rules; EXECUTIVE ไม่เห็นรายบุคคล) — null = ไม่มีสิทธิ์ดูรวม */
export function planOverviewQuery(roles: readonly string[], departmentId: string): PlanQuery | null {
  if (roles.includes('INSTRUCTIONAL_SUPERVISOR') || roles.includes('DIRECTOR') || roles.includes('DEPUTY_DIRECTOR_ACADEMIC')) return { scope: 'ALL' };
  if ((roles.includes('HEAD_OF_DEPARTMENT') || roles.includes('DEPUTY_HEAD_OF_DEPARTMENT')) && departmentId) return { scope: 'DEPARTMENT', departmentId };
  return null;
}

/** ขั้นที่ผู้ใช้ลงมือตรวจแผนนี้ได้ ('DEPT' | 'FINAL' | null) — ตรงกับ lpDeptStageActor / ขั้นหัวหน้างานนิเทศใน rules */
export function reviewStageFor(
  plan: Pick<LessonPlan, 'stage' | 'teacherStaffId' | 'departmentId'>,
  me: { staffId: string; roles: readonly string[]; departmentId: string },
  teacherIsHead: boolean,
): 'DEPT' | 'FINAL' | null {
  if (!me.staffId || plan.teacherStaffId === me.staffId) return null;
  if (plan.stage === 'SUBMITTED') {
    const exOfficio = (me.roles.includes('HEAD_OF_DEPARTMENT') || me.roles.includes('DEPUTY_HEAD_OF_DEPARTMENT'))
      && !!plan.departmentId && me.departmentId === plan.departmentId;
    const fallback = me.roles.includes('INSTRUCTIONAL_SUPERVISOR') && (plan.departmentId === '' || teacherIsHead);
    return exOfficio || fallback ? 'DEPT' : null;
  }
  if (plan.stage === 'DEPT_APPROVED' && me.roles.includes('INSTRUCTIONAL_SUPERVISOR')) return 'FINAL';
  return null;
}

// ───────────── ความครบถ้วนต่อครู ─────────────
export type Compliance = 'NONE' | 'PROJECT_ONLY' | 'PLAN_SUBMITTED' | 'PLAN_APPROVED';
export const COMPLIANCE_LABEL: Record<Compliance, string> = {
  NONE: 'ยังไม่ส่ง',
  PROJECT_ONLY: 'ส่งเฉพาะโครงการสอน (ยังไม่มีฉบับสมบูรณ์)',
  PLAN_SUBMITTED: 'ส่งฉบับสมบูรณ์แล้ว (รอตรวจ/แก้ไข)',
  PLAN_APPROVED: 'ฉบับสมบูรณ์ผ่านแล้ว',
};

/** เกณฑ์: ต้องมีฉบับสมบูรณ์ ≥ 1 รายวิชา; ฉบับที่ถูกขอแก้ไขยังไม่นับว่าส่งแล้ว */
export function complianceOf(plans: readonly Pick<LessonPlan, 'kind' | 'stage'>[]): Compliance {
  const full = plans.filter((p) => p.kind === 'PLAN');
  if (full.some((p) => p.stage === 'APPROVED')) return 'PLAN_APPROVED';
  if (full.some((p) => p.stage !== 'REVISION')) return 'PLAN_SUBMITTED';
  return plans.length > 0 ? 'PROJECT_ONLY' : 'NONE';
}
