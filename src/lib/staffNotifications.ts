import { normalizeEmail } from './normalizeEmail';

/**
 * ข้อความแจ้งผลการอนุมัติระหว่างบุคลากร (staff_notifications) — ตรรกะบริสุทธิ์ที่ service/UI/เทสต์ใช้ร่วมกัน (ต้องตรง firestore.rules)
 * ใช้เฉพาะ "ผลลัพธ์ที่ส่งถึงตัวบุคคล" (เช่น คำขอของฉันได้รับอนุมัติ/ถูกส่งกลับ); "งานที่รอให้ฉันทำ" อยู่ในกระดิ่งงานค้าง (staffTasks.ts)
 * ผู้รับระบุด้วยอีเมล (ตรงกับ token.email ที่ rules ใช้) — ไม่มีอีเมลผู้รับ = ไม่ส่ง (ไม่เดา/ไม่แต่งอีเมล)
 */
export type StaffNotificationKind = 'LATE_ATTENDANCE_DECISION' | 'SUBSTITUTE_UPDATE';

export const STAFF_NOTIFICATION_KINDS: readonly StaffNotificationKind[] = ['LATE_ATTENDANCE_DECISION', 'SUBSTITUTE_UPDATE'];
export const STAFF_NOTIFICATION_TITLE_MAX = 120;
export const STAFF_NOTIFICATION_MESSAGE_MAX = 500;

export interface StaffNotificationDraft {
  recipientEmail: string;
  kind: StaffNotificationKind;
  title: string;
  message: string;
  /** อ้างอิงเอกสารต้นเรื่อง (เช่น id คำขอ) — ใช้ตัดข้อความซ้ำ/ตรวจย้อนหลัง */
  refId: string;
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** คืน draft ที่ผ่านขนาด/อีเมลแล้ว หรือ null ถ้าไม่มีอีเมลผู้รับที่ใช้ได้ */
export function buildStaffNotification(input: StaffNotificationDraft): StaffNotificationDraft | null {
  const recipientEmail = normalizeEmail(input.recipientEmail || '');
  if (!recipientEmail || !recipientEmail.includes('@')) return null;
  return {
    recipientEmail,
    kind: input.kind,
    title: clip(input.title.trim(), STAFF_NOTIFICATION_TITLE_MAX),
    message: clip(input.message.trim(), STAFF_NOTIFICATION_MESSAGE_MAX),
    refId: input.refId,
  };
}

export function lateAttendanceDecisionNotice(req: {
  id: string; teacherEmail?: string; subjectName: string; level: string; periodNumber: number; teachingDate: string;
}, decision: 'APPROVED' | 'REJECTED', approverName: string, rejectReason?: string): StaffNotificationDraft | null {
  const what = `${req.subjectName} ${req.level} คาบ ${req.periodNumber} วันที่ ${req.teachingDate}`;
  return buildStaffNotification({
    recipientEmail: req.teacherEmail || '',
    kind: 'LATE_ATTENDANCE_DECISION',
    refId: req.id,
    title: decision === 'APPROVED' ? '✅ อนุมัติคำขอเช็คชื่อย้อนหลังแล้ว' : '❌ ไม่อนุมัติคำขอเช็คชื่อย้อนหลัง',
    message: decision === 'APPROVED'
      ? `${approverName} อนุมัติคำขอเช็คชื่อย้อนหลัง ${what} — เข้าเช็คชื่อย้อนหลังได้เลย`
      : `${approverName} ไม่อนุมัติคำขอเช็คชื่อย้อนหลัง ${what}${rejectReason ? ` — เหตุผล: ${rejectReason}` : ''}`,
  });
}

export interface SubstituteNoticeSource {
  id: string;
  courseName?: string;
  room?: string;
  date: string;
  periodName?: string;
  originalTeacherEmail?: string;
  substituteTeacherEmail?: string;
  proposedByEmail?: string;
}

const subjectLine = (a: SubstituteNoticeSource) => `${a.courseName || 'คาบสอนแทน'}${a.room ? ` ห้อง ${a.room}` : ''} วันที่ ${a.date}${a.periodName ? ` (${a.periodName})` : ''}`;

/** ผู้ที่ควรรู้ผลของรายการสอนแทน: ผู้เสนอ + ครูที่ถูกมอบหมาย + ครูเจ้าของคาบ (ไม่ซ้ำ ไม่ส่งให้ตัวเอง) */
function substituteAudience(a: SubstituteNoticeSource, actorEmail: string, only?: 'PROPOSER'): string[] {
  const set = new Set<string>();
  const add = (e?: string) => { const n = normalizeEmail(e || ''); if (n && n !== normalizeEmail(actorEmail)) set.add(n); };
  add(a.proposedByEmail);
  if (only !== 'PROPOSER') { add(a.substituteTeacherEmail); add(a.originalTeacherEmail); }
  return [...set];
}

export type SubstituteEvent =
  | { type: 'TEACHER_CONFIRMED' }
  | { type: 'TEACHER_DECLINED'; reason: string }
  | { type: 'STAGE_APPROVED'; stageLabel: string; completed: boolean }
  | { type: 'REJECTED'; stageLabel: string; reason: string };

/** ข้อความผลการจัดครูสอนแทนถึงผู้เกี่ยวข้อง — คืนหลาย draft (หนึ่งต่อผู้รับ) */
export function substituteUpdateNotices(a: SubstituteNoticeSource, ev: SubstituteEvent, actorName: string, actorEmail: string): StaffNotificationDraft[] {
  let title: string; let message: string; let only: 'PROPOSER' | undefined;
  switch (ev.type) {
    case 'TEACHER_CONFIRMED':
      title = '✅ ครูสอนแทนยืนยันรับสอนแล้ว'; message = `${actorName} ยืนยันรับสอนแทน ${subjectLine(a)} — เข้าสู่ลำดับอนุมัติ`; only = 'PROPOSER'; break;
    case 'TEACHER_DECLINED':
      title = '❌ ครูสอนแทนปฏิเสธ'; message = `${actorName} ปฏิเสธการสอนแทน ${subjectLine(a)} — เหตุผล: ${ev.reason}`; only = 'PROPOSER'; break;
    case 'STAGE_APPROVED':
      title = ev.completed ? '✅ อนุมัติครบทุกขั้น — จัดครูสอนแทนสำเร็จ' : '➡️ ผ่านการอนุมัติหนึ่งขั้น';
      message = ev.completed
        ? `${actorName} อนุมัติ${ev.stageLabel} ครบทุกขั้นแล้ว: ${subjectLine(a)}`
        : `${actorName} อนุมัติ${ev.stageLabel}: ${subjectLine(a)} — ส่งต่อขั้นถัดไป`;
      only = ev.completed ? undefined : 'PROPOSER';
      break;
    case 'REJECTED':
      title = '❌ ส่งกลับแก้ไข/ไม่อนุมัติการจัดครูสอนแทน'; message = `${actorName} (${ev.stageLabel}) ไม่อนุมัติ: ${subjectLine(a)} — เหตุผล: ${ev.reason || 'ไม่ระบุ'}`; break;
  }
  return substituteAudience(a, actorEmail, only)
    .map(recipientEmail => buildStaffNotification({ recipientEmail, kind: 'SUBSTITUTE_UPDATE', refId: a.id, title, message }))
    .filter((d): d is StaffNotificationDraft => d !== null);
}

export const SUBSTITUTE_STAGE_LABEL: Record<string, string> = {
  STAGE_1_HEAD_OF_DEPARTMENT: 'ขั้น 1 หัวหน้ากลุ่มสาระฯ',
  STAGE_2_ACADEMIC_HEAD: 'ขั้น 2 หัวหน้าวิชาการ',
  STAGE_3_DEPUTY_DIRECTOR_ACADEMIC: 'ขั้น 3 รองผอ.วิชาการ',
  STAGE_4_DIRECTOR: 'ขั้น 4 ผู้อำนวยการ',
};
