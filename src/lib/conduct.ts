/**
 * คะแนนความประพฤติตามระเบียบการปกครองนักเรียน พ.ศ. 2569 (ต้องตรง firestore.rules บล็อก "conduct_entries")
 *
 * - เริ่มที่ 100 คะแนน; ทุกรายการเป็นบัญชี (conduct_entries) แก้/ลบด้วยคำร้อง (conduct_change_requests) เท่านั้น — ไม่ลบจริง
 * - ครูทุกคนเพิ่ม/หักได้ไม่เกิน 5 คะแนนต่อครั้ง (มีผลทันที); เกิน 5 → ส่งเรื่องให้งานกิจการนักเรียน
 *   (เพิ่ม = พิจารณาอนุมัติ, หัก = งานกิจการเป็นผู้หักเอง)
 * - การหักแบ่งระดับความผิด: เบา ≤5 / ปานกลาง ≤10 / ร้ายแรง ≤20 ต่อครั้ง
 * - students.behaviorScore เป็นแคชที่เขียนพร้อมรายการ (rules ตรวจตัวเลขตรงกับบัญชีเป๊ะ):
 *   conductBase (คะแนนตั้งต้น — ค่าเดิมของนักเรียนก่อนใช้ระบบนี้ หรือ 100), conductAdded, conductDeducted สะสม
 * - เกณฑ์ "ถูกหักสะสม" 15/30/40/50 เป็นข้อแนะนำการดำเนินการของงานกิจการ (ไม่ส่งแจ้งเตือนอัตโนมัติ)
 */
export const CONDUCT_START = 100;
export const TEACHER_SELF_LIMIT = 5;
export const CONDUCT_ADD_MAX = 100;
export const CONDUCT_REASON_MAX = 500;
export const CONDUCT_CATEGORY_MAX = 100;
export const CONDUCT_NOTE_MAX = 500;

export type ConductKind = 'ADD' | 'DEDUCT';
export type OffenceLevel = 'NONE' | 'LIGHT' | 'MEDIUM' | 'SEVERE';
export type ConductStatus = 'APPLIED' | 'PENDING' | 'REJECTED' | 'REVERSED';

export const OFFENCE_LEVEL_LABEL: Record<OffenceLevel, string> = { NONE: '-', LIGHT: 'เบา', MEDIUM: 'ปานกลาง', SEVERE: 'ร้ายแรง' };
export const OFFENCE_LEVEL_CAP: Record<Exclude<OffenceLevel, 'NONE'>, number> = { LIGHT: 5, MEDIUM: 10, SEVERE: 20 };
export const CONDUCT_STATUS_LABEL: Record<ConductStatus, string> = {
  APPLIED: 'มีผลแล้ว', PENDING: 'รองานกิจการพิจารณา', REJECTED: 'ไม่อนุมัติ', REVERSED: 'ยกเลิกแล้ว',
};

export interface ConductEntry {
  id: string;
  studentId: string;
  studentName: string;
  room: string;
  kind: ConductKind;
  level: OffenceLevel;
  /** คะแนนที่ขอ/บันทึก */
  points: number;
  /** คะแนนที่มีผลจริง (0 ถ้ายังไม่มีผล/ไม่อนุมัติ) */
  appliedPoints: number;
  status: ConductStatus;
  reason: string;
  category: string;
  createdByStaffId: string;
  createdByName: string;
  decidedByName?: string;
  decisionNote?: string;
  /** วันที่บันทึก yyyy-mm-dd (จาก createdAt) */
  date: string;
}

export type ChangeAction = 'EDIT' | 'DELETE';
export type ChangeStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export const CHANGE_ACTION_LABEL: Record<ChangeAction, string> = { EDIT: 'ขอแก้คะแนน', DELETE: 'ขอยกเลิกรายการ' };
export const CHANGE_STATUS_LABEL: Record<ChangeStatus, string> = { PENDING: 'รอพิจารณา', APPROVED: 'อนุมัติแล้ว', REJECTED: 'ไม่อนุมัติ' };

export interface ConductChangeRequest {
  id: string;
  entryId: string;
  studentId: string;
  action: ChangeAction;
  newPoints: number | null;
  beforePoints: number;
  reason: string;
  status: ChangeStatus;
  requestedByName: string;
  decisionNote?: string;
}

/** เพดานคะแนนต่อครั้งของรายการ */
export function maxPointsFor(kind: ConductKind, level: OffenceLevel): number {
  if (kind === 'ADD') return level === 'NONE' ? CONDUCT_ADD_MAX : 0;
  return level === 'NONE' ? 0 : OFFENCE_LEVEL_CAP[level];
}

/** รูปแบบคะแนน/ระดับถูกต้องหรือไม่ — ข้อความผิดพลาดอ่านรู้เรื่อง, null = ถูกต้อง */
export function validatePoints(kind: ConductKind, level: OffenceLevel, points: number): string | null {
  if (!Number.isInteger(points) || points < 1) return 'คะแนนต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป';
  if (kind === 'ADD' && level !== 'NONE') return 'การเพิ่มคะแนนไม่ต้องระบุระดับความผิด';
  if (kind === 'DEDUCT' && level === 'NONE') return 'เลือกระดับความผิด (เบา/ปานกลาง/ร้ายแรง)';
  const max = maxPointsFor(kind, level);
  if (points > max) return kind === 'ADD' ? `เพิ่มได้ไม่เกิน ${max} คะแนนต่อครั้ง` : `ความผิดระดับ${OFFENCE_LEVEL_LABEL[level]}หักได้ไม่เกิน ${max} คะแนนต่อครั้ง`;
  return null;
}

export interface ConductInput { kind: ConductKind; level: OffenceLevel; points: number; reason: string; category: string }

/** ผลการตรวจฟอร์มบันทึกคะแนน: error หรือโหมด (APPLY = มีผลทันที, PENDING = ส่งงานกิจการ) */
export function planConductEntry(i: ConductInput, isAffairs: boolean): { error: string } | { mode: 'APPLY' | 'PENDING' } {
  const e = validatePoints(i.kind, i.level, i.points);
  if (e) return { error: e };
  if (!i.reason.trim()) return { error: 'ระบุเหตุผล' };
  if (i.reason.length > CONDUCT_REASON_MAX) return { error: `เหตุผลยาวเกิน ${CONDUCT_REASON_MAX} ตัวอักษร` };
  if (i.category.length > CONDUCT_CATEGORY_MAX) return { error: `หมวดความผิด/ความดียาวเกิน ${CONDUCT_CATEGORY_MAX} ตัวอักษร` };
  return { mode: isAffairs || i.points <= TEACHER_SELF_LIMIT ? 'APPLY' : 'PENDING' };
}

type Contribution = { status: ConductStatus; kind: ConductKind; appliedPoints: number } | null | undefined;
const addOf = (e: Contribution) => (e && e.status === 'APPLIED' && e.kind === 'ADD' ? e.appliedPoints : 0);
const dedOf = (e: Contribution) => (e && e.status === 'APPLIED' && e.kind === 'DEDUCT' ? e.appliedPoints : 0);

export const clampScore = (n: number) => (n < 0 ? 0 : n > 100 ? 100 : n);
export function riskOf(score: number): 'NORMAL' | 'WARNING' | 'CRITICAL' {
  return score < 70 ? 'CRITICAL' : score < 80 ? 'WARNING' : 'NORMAL';
}

export interface StudentConductFields { behaviorScore?: number; conductBase?: number; conductAdded?: number; conductDeducted?: number }

/**
 * ฟิลด์แคชใหม่ของ students/{id} หลังรายการเปลี่ยนจาก before → after (ตรงกับ cdStudentTouch ใน rules ทุกตัวอักษร)
 * before = null เมื่อสร้างรายการใหม่
 */
export function nextConductFields(s: StudentConductFields, before: Contribution, after: Contribution) {
  const base = typeof s.conductBase === 'number' ? s.conductBase : typeof s.behaviorScore === 'number' ? s.behaviorScore : CONDUCT_START;
  const added = (s.conductAdded ?? 0) + addOf(after) - addOf(before);
  const deducted = (s.conductDeducted ?? 0) + dedOf(after) - dedOf(before);
  const score = clampScore(base + added - deducted);
  return { conductBase: base, conductAdded: added, conductDeducted: deducted, behaviorScore: score, riskLevel: riskOf(score) };
}

// ───────── เกณฑ์ตามระเบียบ ─────────
export const DEDUCTION_ACTIONS = [
  { at: 50, label: 'เสนอพักการเรียน' },
  { at: 40, label: 'จัดกิจกรรมปรับเปลี่ยนพฤติกรรม' },
  { at: 30, label: 'เชิญผู้ปกครองพบ' },
  { at: 15, label: 'ส่งหนังสือแจ้งผู้ปกครอง' },
] as const;

/** การดำเนินการสูงสุดที่ถึงเกณฑ์จากคะแนนที่ถูกหักสะสม — null = ยังไม่ถึงเกณฑ์ */
export function deductionAction(deducted: number): { at: number; label: string } | null {
  return DEDUCTION_ACTIONS.find(a => deducted >= a.at) ?? null;
}

/** ผลการประเมินความประพฤติ (ใบรับรองความประพฤติ) จากคะแนนคงเหลือ */
export function conductBand(score: number): string {
  if (score >= 80) return 'เรียบร้อยดีมาก';
  if (score >= 70) return 'ดี';
  if (score >= 60) return 'เรียบร้อย';
  if (score >= 50) return 'พอใช้';
  return 'ควรปรับปรุง';
}

/** ตรวจคำร้องแก้/ลบ — null = ถูกต้อง */
export function validateChangeRequest(entry: Pick<ConductEntry, 'kind' | 'level' | 'appliedPoints' | 'status'>, c: { action: string; newPoints: number | null; reason: string }): string | null {
  if (entry.status !== 'APPLIED') return 'แก้/ยกเลิกได้เฉพาะรายการที่มีผลแล้ว';
  if (c.action !== 'EDIT' && c.action !== 'DELETE') return 'เลือกประเภทคำร้อง';
  if (!c.reason.trim()) return 'ระบุเหตุผลประกอบคำร้อง';
  if (c.reason.length > CONDUCT_REASON_MAX) return `เหตุผลยาวเกิน ${CONDUCT_REASON_MAX} ตัวอักษร`;
  if (c.action === 'EDIT') {
    if (c.newPoints === null) return 'ระบุคะแนนใหม่';
    const e = validatePoints(entry.kind, entry.level, c.newPoints);
    if (e) return e;
    if (c.newPoints === entry.appliedPoints) return 'คะแนนใหม่เท่ากับเดิม';
  }
  return null;
}
