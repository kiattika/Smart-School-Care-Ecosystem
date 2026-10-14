/**
 * ผลแก้ตัว/เรียนซ้ำ (grade_retakes) — งานทะเบียนวัดผลเป็นผู้บันทึก (ต้องตรง firestore.rules บล็อก "grade_retakes")
 *
 * - 1 รายการ = 1 นักเรียน × 1 วิชา × 1 ภาคเรียนของ "ผลเดิม" (doc id กำหนดตายตัว จึงมีผลล่าสุดได้ชุดเดียวต่อวิชา/ภาค)
 * - แสดงคู่กับผลเดิมเสมอ (ไม่ลบ/ไม่ทับคะแนนที่ครูบันทึก) และ **เกรดเฉลี่ยคำนวณด้วยเกรดใหม่** (gpaGrade)
 * - ประเภท: MAKEUP = แก้ตัว/แก้ 0 ร มส มผ ในภาคเรียนเดิม, REPEAT = เรียนซ้ำ (ลงเรียนวิชานั้นใหม่)
 * - บทบาท: งานทะเบียนวัดผล (REGISTRAR) เพิ่ม/แก้/ลบได้, ผู้ช่วย (REGISTRAR_ASSISTANT) เพิ่ม/แก้ได้ ลบไม่ได้
 */
export type RetakeKind = 'MAKEUP' | 'REPEAT';
export const RETAKE_KIND_LABEL: Record<RetakeKind, string> = { MAKEUP: 'แก้ตัว', REPEAT: 'เรียนซ้ำ' };

/** ผลเดิมที่ทำให้ต้องแก้ไข (ร้อยละเวลาเรียนไม่ถึง = มส., คะแนนไม่ครบ = ร, ตก = 0, กิจกรรมไม่ผ่าน = มผ) */
export const ORIGINAL_GRADE_OPTIONS = ['0', 'ร', 'มส', 'มผ', '1', '1.5', '2', '2.5', '3', '3.5', '4', 'ผ'] as const;
/** ผลใหม่ที่บันทึกได้ — ตัวเลขเกรด หรือ ผ/มผ (กิจกรรม); ร/มส ไม่ใช่ผลสุดท้าย */
export const RETAKE_GRADE_OPTIONS = ['0', '1', '1.5', '2', '2.5', '3', '3.5', '4', 'ผ', 'มผ'] as const;

export const RETAKE_NOTE_MAX = 500;

export interface GradeRetake {
  id: string;
  studentId: string;
  /** "ภาค/ปี" ของผลเดิม เช่น "1/2569" (รูปแบบเดียวกับ gradebook_scores.term) */
  term: string;
  courseCode: string;
  courseName: string;
  kind: RetakeKind;
  originalGrade: string;
  newGrade: string;
  /** วันที่สอบแก้ตัว/เรียนซ้ำเสร็จ (yyyy-mm-dd) */
  retakeDate: string;
  note: string;
  recordedByStaffId: string;
  recordedByName: string;
}

const clean = (s: string) => (s || '').trim().replace(/[\/\s]+/g, '-');
/** รหัสเอกสารตายตัว: นักเรียน + ภาค/ปี + รหัสวิชา (Firestore doc id ห้ามมี "/") */
export function retakeDocId(studentId: string, term: string, courseCode: string): string {
  return `${clean(studentId)}_${clean(term)}_${clean(courseCode)}`.slice(0, 150);
}

export const isNumericGrade = (g: string) => /^(0|1|1\.5|2|2\.5|3|3\.5|4)$/.test(g);

export interface RetakeInput {
  studentId: string; term: string; courseCode: string; courseName: string;
  kind: string; originalGrade: string; newGrade: string; retakeDate: string; note: string;
}

/** ข้อผิดพลาดที่อ่านรู้เรื่อง — null = บันทึกได้ */
export function validateRetake(i: RetakeInput): string | null {
  if (!i.studentId) return 'เลือกนักเรียน';
  if (!/^[12]\/\d{4}$/.test(i.term)) return 'ภาคเรียนของผลเดิมไม่ถูกต้อง (ต้องเป็นรูปแบบ ภาค/ปี เช่น 1/2569)';
  if (!/^[^\/\s]{1,40}$/.test(i.courseCode.trim())) return 'รหัสวิชาไม่ถูกต้อง (ห้ามมีช่องว่างหรือ /)';
  if (i.kind !== 'MAKEUP' && i.kind !== 'REPEAT') return 'เลือกประเภท (แก้ตัว/เรียนซ้ำ)';
  if (!(ORIGINAL_GRADE_OPTIONS as readonly string[]).includes(i.originalGrade)) return 'ผลเดิมไม่ถูกต้อง';
  if (!(RETAKE_GRADE_OPTIONS as readonly string[]).includes(i.newGrade)) return 'ผลใหม่ไม่ถูกต้อง';
  // วิชากิจกรรมใช้ ผ/มผ, วิชาปกติใช้เกรดตัวเลข — ผลเดิมกับผลใหม่ต้องเป็นชนิดเดียวกัน
  const origActivity = i.originalGrade === 'ผ' || i.originalGrade === 'มผ';
  const newActivity = i.newGrade === 'ผ' || i.newGrade === 'มผ';
  if (origActivity !== newActivity && i.originalGrade !== 'ร' && i.originalGrade !== 'มส') return 'ผลเดิมและผลใหม่ต้องเป็นชนิดเดียวกัน (เกรดตัวเลข หรือ ผ/มผ)';
  if (i.originalGrade === i.newGrade) return 'ผลใหม่เท่ากับผลเดิม — ไม่ต้องบันทึก';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(i.retakeDate)) return 'เลือกวันที่';
  if ((i.note || '').length > RETAKE_NOTE_MAX) return `หมายเหตุยาวเกิน ${RETAKE_NOTE_MAX} ตัวอักษร`;
  return null;
}

/** ผลแก้ตัวของ (ภาค, วิชา) → แถวผลการเรียน: ใช้จับคู่ใน buildGradeRows */
export function retakeMapFor(retakes: readonly Pick<GradeRetake, 'term' | 'courseCode' | 'kind' | 'originalGrade' | 'newGrade' | 'retakeDate'>[], term: string) {
  const m = new Map<string, { kind: RetakeKind; originalGrade: string; newGrade: string; retakeDate: string }>();
  for (const r of retakes) if (r.term === term && r.courseCode.trim()) m.set(r.courseCode.trim(), { kind: r.kind, originalGrade: r.originalGrade, newGrade: r.newGrade, retakeDate: r.retakeDate });
  return m;
}

/** วิชาที่ "ควรแก้ไขผลการเรียน" จากผลปัจจุบัน — เกรด 0, ร, มส (เสี่ยง/ติด), มผ */
export function needsRemedy(grade: string | null | undefined, displayed?: string | null): boolean {
  const g = displayed ?? grade ?? '';
  return g === '0' || g === 'ร' || g === 'มส' || g === 'มผ';
}

// ───────── อนุมัติจบหลักสูตร (graduation_approvals) ─────────
export const GRADUATION_LEVELS = ['ม.3', 'ม.6'] as const;
export type GraduationLevel = typeof GRADUATION_LEVELS[number];
export const GRADUATION_NOTE_MAX = 500;
export const graduationDocId = (studentId: string, level: string) => `${clean(studentId)}_${clean(level)}`;

/** ระดับชั้นที่จบหลักสูตรจากชื่อห้อง ("ม.6/3" → ม.6); ห้องอื่น = null (ไม่ใช่ปีที่จบ) */
export function graduationLevelOf(room: string | undefined | null): GraduationLevel | null {
  const m = /^\s*(?:M\.|ม\.)\s*([36])\b/.exec(room || '');
  return m ? (`ม.${m[1]}` as GraduationLevel) : null;
}

export interface GraduationApproval {
  id: string; studentId: string; level: GraduationLevel; academicYear: string;
  note: string; approvedByStaffId: string; approvedByName: string;
}

export function validateGraduation(i: { studentId: string; level: string; academicYear: string; note: string }): string | null {
  if (!i.studentId) return 'เลือกนักเรียน';
  if (!(GRADUATION_LEVELS as readonly string[]).includes(i.level)) return 'ระดับชั้นที่จบต้องเป็น ม.3 หรือ ม.6';
  if (!/^\d{4}$/.test(i.academicYear)) return 'ปีการศึกษาไม่ถูกต้อง';
  if ((i.note || '').length > GRADUATION_NOTE_MAX) return `หมายเหตุยาวเกิน ${GRADUATION_NOTE_MAX} ตัวอักษร`;
  return null;
}
