/**
 * ข้อความ "แนวทางช่วยเหลือ" รายบุคคล + "แนวทางกิจกรรมโฮมรูม" ของรายงานคัดกรอง SDQ ชั้นเรียน (ครูที่ปรึกษา)
 * 1 เอกสารต่อ (ห้อง, ปีการศึกษา, รอบ) ที่ `sdq_class_plans` — ครูที่ปรึกษาของห้องนั้นอ่าน/เขียนได้ (ต้องตรง firestore.rules)
 * เนื้อหาเป็นข้อความอิสระของครู ไม่มีผลคัดกรอง/คะแนนอยู่ในเอกสารนี้ (ผล SDQ ยังอยู่ที่ student_assessments_sdq)
 */
export const CLASS_PLAN_LIMITS = { perStudent: 500, activity: 1000, maxStudents: 60 } as const;

export type ClassPlanRound = 1 | 2;

export interface ClassPlanContent {
  /** studentId → แนวทางช่วยเหลือ (เฉพาะรายที่มีข้อความ) */
  studentPlans: Record<string, string>;
  activityPlan: string;
}

export interface ClassPlanDoc extends ClassPlanContent {
  id: string;
  room: string;
  academicYear: string;
  round: ClassPlanRound;
}

/** รหัสเอกสาร: ห้องมี "/" (ม.5/8) ใช้เป็น doc id ตรง ๆ ไม่ได้ จึงแทน "/" และช่องว่างด้วย "-" */
export function classPlanDocId(academicYear: string, round: ClassPlanRound, room: string): string {
  return `${academicYear}_${round}_${room.trim().replace(/[\/\s]+/g, '-')}`.slice(0, 150);
}

/** ตัดช่องว่าง, ทิ้งรายที่ว่าง, ทิ้งรหัสนักเรียนที่ไม่ได้อยู่ในห้อง (กันค้างจากรายชื่อเก่า) */
export function normalizeClassPlan(input: ClassPlanContent, validStudentIds: readonly string[]): ClassPlanContent {
  const valid = new Set(validStudentIds);
  const studentPlans: Record<string, string> = {};
  for (const [sid, text] of Object.entries(input.studentPlans || {})) {
    const t = (text || '').trim();
    if (t && valid.has(sid)) studentPlans[sid] = t;
  }
  return { studentPlans, activityPlan: (input.activityPlan || '').trim() };
}

export function validateClassPlan(c: ClassPlanContent): string | null {
  const ids = Object.keys(c.studentPlans);
  if (ids.length > CLASS_PLAN_LIMITS.maxStudents) return `บันทึกได้ไม่เกิน ${CLASS_PLAN_LIMITS.maxStudents} คนต่อรายงาน`;
  for (const sid of ids) {
    if (c.studentPlans[sid].length > CLASS_PLAN_LIMITS.perStudent) return `แนวทางช่วยเหลือรายบุคคลยาวเกิน ${CLASS_PLAN_LIMITS.perStudent} ตัวอักษร`;
  }
  if (c.activityPlan.length > CLASS_PLAN_LIMITS.activity) return `แนวทางกิจกรรมโฮมรูมยาวเกิน ${CLASS_PLAN_LIMITS.activity} ตัวอักษร`;
  return null;
}

/** ฟอร์มมีการเปลี่ยนจากที่บันทึกไว้หรือไม่ (เทียบหลัง normalize ทั้งสองฝั่ง) */
export function isClassPlanDirty(draft: ClassPlanContent, saved: ClassPlanContent | undefined, validStudentIds: readonly string[]): boolean {
  const a = normalizeClassPlan(draft, validStudentIds);
  const b = normalizeClassPlan(saved ?? { studentPlans: {}, activityPlan: '' }, validStudentIds);
  if (a.activityPlan !== b.activityPlan) return true;
  const ka = Object.keys(a.studentPlans), kb = Object.keys(b.studentPlans);
  return ka.length !== kb.length || ka.some(k => a.studentPlans[k] !== b.studentPlans[k]);
}
