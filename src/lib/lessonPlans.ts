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
 * รายการตรวจแผน (ร่างเบื้องต้น — ยังไม่ใช่แบบประเมินทางการของโรงเรียน; แก้รายการ/ข้อความได้โดยคง id c1–c10 ให้ตรง rules
 * หรือแก้ rules + templateVersion พร้อมกัน) ตอบข้อละ Y (มี/เหมาะสม) หรือ N (ต้องปรับ)
 */
export const PLAN_CHECKLIST = [
  { id: 'c1', label: 'ระบุมาตรฐาน/ตัวชี้วัด/ผลการเรียนรู้ชัดเจน' },
  { id: 'c2', label: 'สาระสำคัญ/แนวคิดหลักสอดคล้องกับตัวชี้วัด' },
  { id: 'c3', label: 'จุดประสงค์การเรียนรู้วัดและประเมินผลได้' },
  { id: 'c4', label: 'สาระการเรียนรู้/เนื้อหาครบถ้วนและถูกต้อง' },
  { id: 'c5', label: 'กิจกรรมการเรียนรู้เน้นผู้เรียนเป็นสำคัญ (Active Learning) แบ่งขั้นตอนชัดเจน' },
  { id: 'c6', label: 'สื่อ/แหล่งเรียนรู้เหมาะสมกับผู้เรียนและเนื้อหา' },
  { id: 'c7', label: 'การวัดและประเมินผลสอดคล้องกับจุดประสงค์' },
  { id: 'c8', label: 'มีเกณฑ์การให้คะแนน/ประเมินที่ชัดเจน' },
  { id: 'c9', label: 'บูรณาการสมรรถนะ/คุณลักษณะอันพึงประสงค์' },
  { id: 'c10', label: 'โดยรวมพร้อมนำไปใช้สอนจริง' },
] as const;
export type CheckId = typeof PLAN_CHECKLIST[number]['id'];
export type ChecksMap = Partial<Record<CheckId, 'Y' | 'N'>>;

export interface LessonPlanReview {
  byStaffId: string;
  byName: string;
  decision: 'APPROVE' | 'REVISE';
  comment: string;
  checks: ChecksMap;
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

export function checksComplete(checks: ChecksMap): boolean {
  return PLAN_CHECKLIST.every((c) => checks[c.id] === 'Y' || checks[c.id] === 'N');
}
