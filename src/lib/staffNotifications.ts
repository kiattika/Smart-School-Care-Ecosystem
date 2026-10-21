import { normalizeEmail } from './normalizeEmail';

/**
 * ข้อความแจ้งผลการอนุมัติระหว่างบุคลากร (staff_notifications) — ตรรกะบริสุทธิ์ที่ service/UI/เทสต์ใช้ร่วมกัน (ต้องตรง firestore.rules)
 * ใช้เฉพาะ "ผลลัพธ์ที่ส่งถึงตัวบุคคล" (เช่น คำขอของฉันได้รับอนุมัติ/ถูกส่งกลับ); "งานที่รอให้ฉันทำ" อยู่ในกระดิ่งงานค้าง (staffTasks.ts)
 * ผู้รับระบุด้วยอีเมล (ตรงกับ token.email ที่ rules ใช้) — ไม่มีอีเมลผู้รับ = ไม่ส่ง (ไม่เดา/ไม่แต่งอีเมล)
 */
export type StaffNotificationKind = 'LATE_ATTENDANCE_DECISION' | 'LATE_ATTENDANCE_REMINDER' | 'SUBSTITUTE_UPDATE' | 'LESSON_PLAN_REVIEW' | 'SUPERVISION_RESULT' | 'CONDUCT_DECISION';

export const STAFF_NOTIFICATION_KINDS: readonly StaffNotificationKind[] = ['LATE_ATTENDANCE_DECISION', 'LATE_ATTENDANCE_REMINDER', 'SUBSTITUTE_UPDATE', 'LESSON_PLAN_REVIEW', 'SUPERVISION_RESULT', 'CONDUCT_DECISION'];
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

type LateNoticeReq = {
  id: string; teacherEmail?: string; teacherName?: string; subjectName: string; level: string; periodNumber: number; teachingDate: string;
};
const lateWhat = (req: LateNoticeReq) => `${req.subjectName} ${req.level} คาบ ${req.periodNumber} วันที่ ${req.teachingDate}`;

/**
 * แจ้งครูผู้ยื่นเมื่อมีการตัดสิน (ขั้นหัวหน้า/ขั้นรอง) — `level` บอกว่าใครตัดสิน; `note` = เหตุผล/เงื่อนไข
 * decision: APPROVE = อนุมัติตามเสนอ, CONDITIONAL = อนุมัติมีเงื่อนไข, REJECT = ไม่อนุมัติ
 */
export function lateAttendanceDecisionNotice(req: LateNoticeReq, decision: 'APPROVE' | 'CONDITIONAL' | 'REJECT', approverName: string, note?: string, opts?: { overridesHead?: boolean }): StaffNotificationDraft | null {
  const what = lateWhat(req);
  let title: string;
  let message: string;
  if (decision === 'APPROVE') {
    title = '✅ อนุมัติคำขอเช็คชื่อย้อนหลังแล้ว';
    message = `${approverName} อนุมัติคำขอเช็คชื่อย้อนหลัง ${what} — เข้าเช็คชื่อย้อนหลังได้เลย (ก่อน 24.00 น.)`;
  } else if (decision === 'CONDITIONAL') {
    title = '⚠️ อนุมัติแบบมีเงื่อนไข — โปรดอ่านข้อความเตือน';
    message = `${approverName} อนุมัติคำขอเช็คชื่อย้อนหลัง ${what} แบบมีเงื่อนไข: ${note || '-'}`;
  } else {
    title = opts?.overridesHead ? '🟨 รองผู้อำนวยการไม่อนุมัติ (แทนผลของหัวหน้า)' : '❌ ไม่อนุมัติคำขอเช็คชื่อย้อนหลัง';
    message = `${approverName} ไม่อนุมัติคำขอเช็คชื่อย้อนหลัง ${what}${note ? ` — เหตุผล: ${note}` : ''}${opts?.overridesHead ? ' (ข้อมูลที่เช็คไปแล้วยังคงอยู่ แต่ไม่สามารถดำเนินการต่อได้)' : ''}`;
  }
  return buildStaffNotification({ recipientEmail: req.teacherEmail || '', kind: 'LATE_ATTENDANCE_DECISION', refId: req.id, title, message });
}

/** แจ้งครูเมื่อรองขยายเวลา (ธงแดง) */
export function lateAttendanceExtendedNotice(req: LateNoticeReq, approverName: string, untilLabel: string): StaffNotificationDraft | null {
  return buildStaffNotification({
    recipientEmail: req.teacherEmail || '',
    kind: 'LATE_ATTENDANCE_DECISION',
    refId: req.id,
    title: '🚩 ขยายเวลาดำเนินการ — โปรดรีบดำเนินการ',
    message: `${approverName} ขยายเวลาเช็คชื่อย้อนหลัง ${lateWhat(req)} ถึง ${untilLabel} — หากพ้นกำหนดต้องทำบันทึกชี้แจงผู้บังคับบัญชา`,
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

// ── แจ้งผลถึงครูเจ้าของเรื่อง (ผู้รับหาอีเมลจากทะเบียน staff ตาม staffId — ดู services/staffNotify.ts) ──

/** ผลการตรวจแผนการสอน/โครงการสอน: ผ่านขั้นนี้ หรือขอให้แก้ไข (พร้อมความเห็น) */
export function lessonPlanReviewNotice(
  plan: { id: string; courseName?: string; courseCode?: string; level?: string },
  stage: 'DEPT' | 'FINAL', decision: 'APPROVE' | 'REVISE', reviewerName: string, comment: string, recipientEmail: string,
): StaffNotificationDraft | null {
  const what = `${plan.courseCode ? `${plan.courseCode} ` : ''}${plan.courseName || 'แผนการสอน'}${plan.level ? ` ${plan.level}` : ''}`;
  const stageLabel = stage === 'DEPT' ? 'ขั้นหัวหน้ากลุ่มสาระฯ' : 'ขั้นหัวหน้างานนิเทศ';
  const title = decision === 'APPROVE'
    ? (stage === 'FINAL' ? '✅ แผนการสอนผ่านการตรวจครบแล้ว' : '➡️ แผนการสอนผ่านขั้นหัวหน้ากลุ่มสาระฯ')
    : '✏️ ขอให้แก้ไขแผนการสอน';
  const message = decision === 'APPROVE'
    ? `${reviewerName} ตรวจ ${what} (${stageLabel}) ผ่านแล้ว${comment.trim() ? ` — ความเห็น: ${comment.trim()}` : ''}`
    : `${reviewerName} ขอให้แก้ไข ${what} (${stageLabel}) — ${comment.trim() || 'ดูรายละเอียดในแผน'}`;
  return buildStaffNotification({ recipientEmail, kind: 'LESSON_PLAN_REVIEW', refId: plan.id, title, message });
}

/** ผลนิเทศการสอนส่งแล้ว — ครูเจ้าของผลต้องกดรับทราบ */
export function supervisionResultNotice(
  obs: { id: string; courseName?: string; observedDate?: string }, supervisorName: string, recipientEmail: string,
): StaffNotificationDraft | null {
  return buildStaffNotification({
    recipientEmail, kind: 'SUPERVISION_RESULT', refId: obs.id,
    title: '📋 มีผลการนิเทศการสอนของคุณ — โปรดกดรับทราบ',
    message: `${supervisorName} ส่งผลนิเทศ${obs.courseName ? ` วิชา ${obs.courseName}` : ''}${obs.observedDate ? ` วันที่ ${obs.observedDate}` : ''} แล้ว — ตรวจดูและกดรับทราบได้ที่ "ผลนิเทศของฉัน"`,
  });
}

/** ผลการพิจารณาของงานกิจการ: รายการคะแนนความประพฤติที่ครูส่ง / คำร้องขอแก้-ยกเลิกที่ครูยื่น */
export function conductDecisionNotice(
  what: 'ENTRY' | 'CHANGE', approved: boolean, studentName: string, deciderName: string, note: string, refId: string, recipientEmail: string,
): StaffNotificationDraft | null {
  const subject = what === 'ENTRY' ? 'รายการคะแนนความประพฤติ' : 'คำร้องแก้/ยกเลิกคะแนนความประพฤติ';
  return buildStaffNotification({
    recipientEmail, kind: 'CONDUCT_DECISION', refId,
    title: approved ? `✅ งานกิจการอนุมัติ${subject}` : `❌ งานกิจการไม่อนุมัติ${subject}`,
    message: `${deciderName} ${approved ? 'อนุมัติ' : 'ไม่อนุมัติ'}${subject}ของ ${studentName || 'นักเรียน'}${note.trim() ? ` — ${note.trim()}` : ''}`,
  });
}
