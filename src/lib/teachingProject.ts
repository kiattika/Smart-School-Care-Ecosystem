import { isActivityCode, isSchoolSpecificCode } from './subjectCode';
/**
 * โครงการสอนรายสัปดาห์ (teaching_projects) — ตรรกะกลาง (ต้องตรง firestore.rules บล็อก "teaching_projects")
 *
 * - ทำ 1 ฉบับต่อ (ภาคเรียน, ครู, รหัสวิชา) และใช้ร่วมกับ "ทุกห้องที่ครูคนนั้นสอนรหัสวิชาเดียวกัน" อัตโนมัติ
 *   (doc id = `{ปี}_{ภาค}_{staffId}_{courseKey}` ไม่ผูกห้อง)
 * - ประเภทวิชา: NORMAL = ต้องทำ, ACTIVITY = วิชากิจกรรม (รหัสขึ้นต้น "ก" เช่น ชุมนุม/ลูกเสือ/แนะแนว — ทำได้แต่ไม่บังคับ),
 *   EXEMPT = ไม่ต้องทำ (PLC, CZ ฯลฯ)
 * - แถวหัวข้อ (units) มี id คงที่ — บันทึกหลังสอนอ้างถึงด้วย id นี้ (`planUnitIds`) แก้ข้อความ/ลำดับแถวได้โดยไม่ขาดความเชื่อมโยง
 */
import { courseKeyOf } from './lessonPlans';

export type CourseKind = 'NORMAL' | 'ACTIVITY' | 'EXEMPT';
export const COURSE_KIND_LABEL: Record<CourseKind, string> = {
  NORMAL: 'รายวิชาปกติ — ต้องทำโครงการสอน',
  ACTIVITY: 'วิชากิจกรรม — ทำได้ ไม่บังคับ',
  EXEMPT: 'ไม่ต้องทำโครงการสอน',
};

/** ชื่อวิชา/กิจกรรมที่ไม่ต้องทำโครงการสอน (PLC, CZ=Cleaning Zone) — ยังไม่มีรหัสที่แน่นอนจากโรงเรียน จึงจับจากชื่อ */
const EXEMPT_NAME = /PLC|\bCZ\b|cleaning\s*zone|ชุมชนแห่งการเรียนรู้ทางวิชาชีพ|ทำความสะอาด/i;

export function courseKindOf(c: { code: string; name: string; subjectType?: string }): CourseKind {
  // รหัสเฉพาะกิจของโรงเรียน (HR, CZ ฯลฯ ที่ไม่ขึ้นต้นด้วยอักษรกลุ่มสาระฯ/ก) ไม่ต้องทำแผน/โครงการสอน
  if (isSchoolSpecificCode(c.code) || EXEMPT_NAME.test(c.name || '') || EXEMPT_NAME.test(c.code || '')) return 'EXEMPT';
  if (isActivityCode(c.code) || c.subjectType === 'ACTIVITY') return 'ACTIVITY';
  return 'NORMAL';
}

export interface ProjectUnit {
  id: string;
  /** LESSON = บท/หัวข้อที่สอน, EXAM = สอบกลางภาค/ปลายภาค/แบบทดสอบประจำบท */
  type: 'LESSON' | 'EXAM';
  /** สัปดาห์ เช่น "1-2" หรือ "5" */
  weeks: string;
  title: string;
  /** หัวข้อย่อย/เนื้อหาสาระ (พิมพ์หลายบรรทัดได้) */
  detail: string;
  hours: number | null;
  activities: string;
  media: string;
}
export interface AssessmentItem { label: string; percent: number }

export interface TeachingProject {
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
  kind: 'NORMAL' | 'ACTIVITY';
  levelLabel: string;
  credits: string;
  hoursPerWeek: string;
  courseType: string;
  description: string;
  indicators: string[];
  units: ProjectUnit[];
  assessment: AssessmentItem[];
  assessmentNote: string;
  /** ครูร่วมสอนที่เจ้าของแชร์ฉบับนี้ให้ (staff id) + สำเนาชื่อเรียงคู่กัน — รุ่นเก่าไม่มี */
  coTeacherStaffIds?: string[];
  coTeacherNames?: string[];
}

export const MAX_CO_TEACHERS = 10;
export const MAX_UNITS = 60;
export const MAX_INDICATORS = 30;
export const MAX_ASSESSMENT = 20;

export const projectDocId = (semesterId: string, teacherStaffId: string, courseKey: string) => `${semesterId}_${teacherStaffId}_${courseKey}`;
export const newUnitId = () => `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const emptyUnit = (type: 'LESSON' | 'EXAM' = 'LESSON'): ProjectUnit =>
  ({ id: newUnitId(), type, weeks: '', title: type === 'EXAM' ? 'สอบกลางภาค' : '', detail: '', hours: null, activities: '', media: '' });

/** "1-2" → [1,2], "5" → [5,5], ว่าง/ผิดรูปแบบ → null */
export function parseWeeks(w: string): [number, number] | null {
  const m = (w || '').trim().match(/^(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?$/);
  if (!m) return null;
  const a = Number(m[1]); const b = m[2] ? Number(m[2]) : a;
  return a >= 1 && b >= a && b <= 52 ? [a, b] : null;
}

/** ปัญหาที่ต้องแก้ก่อนบันทึก (ว่าง = บันทึกได้) — บันทึกฉบับร่างได้เสมอถ้าผ่านเฉพาะเรื่องขนาด/รูปแบบ */
export function validateProject(p: Pick<TeachingProject, 'description' | 'indicators' | 'units' | 'assessment' | 'credits' | 'hoursPerWeek' | 'courseType' | 'levelLabel' | 'assessmentNote'>): string[] {
  const out: string[] = [];
  if (p.description.length > 2000) out.push('คำอธิบายรายวิชายาวเกิน 2,000 ตัวอักษร');
  if (p.indicators.length > MAX_INDICATORS) out.push(`ตัวชี้วัดได้ไม่เกิน ${MAX_INDICATORS} ข้อ`);
  if (p.indicators.some(i => i.length > 500)) out.push('ตัวชี้วัดแต่ละข้อยาวเกิน 500 ตัวอักษร');
  if (p.units.length > MAX_UNITS) out.push(`หัวข้อได้ไม่เกิน ${MAX_UNITS} แถว`);
  p.units.forEach((u, i) => {
    if (u.weeks.trim() && !parseWeeks(u.weeks)) out.push(`แถวที่ ${i + 1}: สัปดาห์ต้องเป็นตัวเลข เช่น 3 หรือ 3-5`);
    if (u.title.length > 200 || u.detail.length > 1500 || u.activities.length > 800 || u.media.length > 500) out.push(`แถวที่ ${i + 1}: ข้อความยาวเกินกำหนด`);
    if (u.hours !== null && !(u.hours >= 0 && u.hours <= 100)) out.push(`แถวที่ ${i + 1}: จำนวนชั่วโมงต้องอยู่ระหว่าง 0–100`);
  });
  if (p.assessment.length > MAX_ASSESSMENT) out.push(`รายการวัดผลได้ไม่เกิน ${MAX_ASSESSMENT} รายการ`);
  if (p.assessment.some(a => !(a.percent >= 0 && a.percent <= 100))) out.push('สัดส่วนคะแนนต้องอยู่ระหว่าง 0–100');
  if (p.credits.length > 10 || p.hoursPerWeek.length > 10 || p.courseType.length > 80 || p.levelLabel.length > 80 || p.assessmentNote.length > 500) out.push('ข้อมูลทั่วไปยาวเกินกำหนด');
  return out;
}

export function assessmentTotal(items: readonly AssessmentItem[]): number {
  return Math.round(items.reduce((a, b) => a + (Number(b.percent) || 0), 0) * 100) / 100;
}

/** พร้อมใช้งาน = มีคำอธิบาย ตัวชี้วัด ≥ 1 และหัวข้อที่สอน (LESSON) ≥ 1 แถวที่มีชื่อ */
export function isProjectReady(p: Pick<TeachingProject, 'description' | 'indicators' | 'units'>): boolean {
  return p.description.trim().length > 0 && p.indicators.some(i => i.trim()) && p.units.some(u => u.type === 'LESSON' && u.title.trim());
}

/** ชั่วโมงรวมของแถวหัวข้อ (ไว้เทียบกับหน่วยกิต × 40 ชม./หน่วยกิตโดยผู้ใช้เอง ไม่บังคับ) */
export const totalHours = (units: readonly ProjectUnit[]) => units.reduce((a, u) => a + (u.hours || 0), 0);

export interface CourseLike { code: string; name: string; level: string; room?: string; subjectType?: string }
export interface CourseGroup {
  key: string; code: string; name: string; kind: CourseKind;
  /** ห้อง/ระดับชั้นทั้งหมดที่ครูสอนรหัสนี้ — ใช้แสดงว่าโครงการสอนจะใช้กับห้องใดบ้าง */
  levels: string[];
}
/** จัดกลุ่มรายวิชาของครูตามรหัสวิชา (รหัสเดียวกันหลายห้อง = 1 โครงการ) */
export function groupCoursesByCode(courses: readonly CourseLike[]): CourseGroup[] {
  const m = new Map<string, CourseGroup>();
  for (const c of courses) {
    const key = courseKeyOf(c.code);
    if (!key) continue;
    const g = m.get(key) || { key, code: c.code.trim(), name: c.name, kind: courseKindOf(c), levels: [] };
    const lv = (c.level || '').trim();
    if (lv && !g.levels.includes(lv)) g.levels.push(lv);
    m.set(key, g);
  }
  return [...m.values()].map(g => ({ ...g, levels: g.levels.sort((a, b) => a.localeCompare(b, 'th', { numeric: true })) }))
    .sort((a, b) => a.code.localeCompare(b.code, 'th'));
}

/** "ม.4/1" → "ม.4" (ระดับชั้นของโครงการ) */
export const levelOfRoom = (room: string) => (room || '').split('/')[0].trim();
export function levelLabelOf(levels: readonly string[]): string {
  return [...new Set(levels.map(levelOfRoom).filter(Boolean))].join(', ');
}

export interface ProjectCoverage { required: number; done: number; missing: string[] }
/** ความครบถ้วน: นับเฉพาะวิชาปกติ (NORMAL) — ทำเสร็จ = มีโครงการที่ isProjectReady */
export function projectCoverage(groups: readonly CourseGroup[], projects: readonly Pick<TeachingProject, 'courseKey' | 'description' | 'indicators' | 'units'>[]): ProjectCoverage {
  const req = groups.filter(g => g.kind === 'NORMAL');
  const ready = new Set(projects.filter(isProjectReady).map(p => p.courseKey));
  const missing = req.filter(g => !ready.has(g.key)).map(g => g.code);
  return { required: req.length, done: req.length - missing.length, missing };
}

/** ข้อความหัวข้อไว้แสดงในบันทึกหลังสอน: "สัปดาห์ 3-5 · 2.1 เซลล์ …" */
export function unitLabel(u: Pick<ProjectUnit, 'weeks' | 'title'>): string {
  return `${u.weeks.trim() ? `สัปดาห์ ${u.weeks.trim()} · ` : ''}${u.title.trim() || '(ไม่มีชื่อ)'}`;
}

export type PlanStatus = 'ON_PLAN' | 'DEVIATED';
export const PLAN_STATUS_LABEL: Record<PlanStatus, string> = {
  ON_PLAN: 'สอนตามโครงการสอน',
  DEVIATED: 'ไม่ตรงตามโครงการสอน (มีกิจกรรมแทรก/ปรับเปลี่ยน)',
};

/** ตรวจรายชื่อครูร่วมสอนก่อนบันทึก (ว่าง = ผ่าน) */
export function validateCoTeachers(ids: readonly string[], names: readonly string[]): string {
  if (ids.length > MAX_CO_TEACHERS) return `ครูร่วมสอนได้ไม่เกิน ${MAX_CO_TEACHERS} คน`;
  if (ids.length !== names.length) return 'รายชื่อครูร่วมสอนไม่ครบถ้วน';
  if (new Set(ids).size !== ids.length) return 'มีครูร่วมสอนซ้ำกัน';
  return '';
}

/** โครงการของรหัสวิชานี้ที่ครูเห็น: ฉบับที่ตนเป็นเจ้าของมาก่อน แล้วฉบับที่ครูอื่นแชร์ให้ */
export function projectsForKey<T extends Pick<TeachingProject, 'courseKey' | 'teacherStaffId'>>(projects: readonly T[], courseKey: string, staffId: string): T[] {
  return projects.filter(p => p.courseKey === courseKey)
    .sort((a, b) => (a.teacherStaffId === staffId ? 0 : 1) - (b.teacherStaffId === staffId ? 0 : 1));
}
