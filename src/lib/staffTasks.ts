import { canTeacherDecide } from './leaveFlow';
import { isAppointmentPending, canStaffHandleAppointment } from './appointmentFlow';
import { SUBSTITUTE_STAGE_ROLE } from '../types';
import { normalizeEmail } from './normalizeEmail';
import { actorKindsFor, type LateFlowRequest } from './lateAttendanceFlow';
import { isThreadForTeacher, isThreadUnread, type ChatThreadLike } from './classChat';

/**
 * กระดิ่งงานค้างของบุคลากร — คำนวณสดจากข้อมูลจริงที่ครูมีสิทธิ์เห็นตามบทบาทที่ใช้งานอยู่ (activeRole)
 * ไม่ใช่กล่องข้อความ: งานหายจากกระดิ่งเองเมื่อมีคนจัดการแล้ว (ไม่ค้างเป็น "ยังไม่อ่าน" ของเรื่องที่จบไปแล้ว)
 *
 * แหล่งที่ต่อแล้ว: ใบลานักเรียนรอครูที่ปรึกษา · คำขอเช็คชื่อย้อนหลัง/เข้าหลังเวลารอรองผอ.วิชาการ ·
 * คัดกรอง 2Q บวก (รอนักเรียนทำ 9Q) และ 9Q ธงแดง (รอแจ้งผู้ปกครอง/พบนักเรียน) ของครูแนะแนว/ครูที่ปรึกษา — นิยามใน screeningTasks.ts
 * คำขอนัดพบครูจากผู้ปกครอง (ครูที่ปรึกษา: ผู้ที่ขอพบครูที่ปรึกษา · ครูแนะแนว: ผู้ที่ขอพบครูแนะแนว) รอตอบรับ
 * งานกิจการนักเรียน (STUDENT_AFFAIRS): รายการคะแนนความประพฤติ PENDING + คำร้องแก้/ยกเลิก PENDING
 * จัดครูสอนแทน: รออนุมัติในขั้นของบทบาทที่ใช้งานอยู่ · รอฉัน (ครูสอนแทน) ยืนยัน
 * ข้อความแจ้งผล (staff_notifications ที่ยังไม่อ่าน) แสดงแยกเป็นส่วน "ข้อความ" ใน StaffTaskBell และนับรวมที่ป้ายจำนวน
 */
export type StaffTaskKind = 'LEAVE' | 'LATE_ATTENDANCE' | 'SCREENING_2Q' | 'SCREENING_RED_FLAG' | 'APPOINTMENT' | 'SUBSTITUTE_APPROVAL' | 'SUBSTITUTE_CONFIRM' | 'CHAT_UNREAD' | 'CONDUCT_REVIEW' | 'CONDUCT_CHANGE';

export interface StaffTask {
  kind: StaffTaskKind;
  label: string;
  count: number;
  /** บอกว่าไปจัดการที่ไหน (กระดิ่งไม่พาไปหน้าอื่นเอง) */
  where: string;
}

export interface StaffTaskInput {
  activeRole: string;
  /** ใบลาของห้องที่ฉันเป็นครูที่ปรึกษา (ว่างได้ถ้าไม่ใช่ครูที่ปรึกษา) */
  roomLeaves: { status: string }[];
  /** คำขอเช็คชื่อย้อนหลังทั้งหมดที่ฉันมีสิทธิ์เห็น */
  lateRequests: LateFlowRequest[];
  /** บทบาททั้งหมดของฉัน + เวลาปัจจุบัน — ใช้นับเฉพาะคำขอที่ "ฉันตัดสินได้จริง" (หัวหน้า/รอง/ผอ.สำรอง ตามสิทธิ์และช่วงเวลา) */
  myRoles?: readonly string[];
  nowMs?: number;
  /** จำนวนงานคัดกรองค้าง (นับจาก screeningTasks.ts) — ไม่ส่ง = ไม่มี */
  screening?: { twoQ: number; redFlag: number };
  /** คำขอนัดพบที่ส่งถึงฉัน (ครูที่ปรึกษา = ของห้องฉัน, ครูแนะแนว = ที่ขอพบครูแนะแนว) */
  appointments?: { status: string; recipient?: string; targetStaffId?: string }[];
  /** รายการจัดครูสอนแทนทั้งหมดที่ฉันเห็น (จาก store ที่ sync อยู่แล้ว) */
  substitutes?: { status?: string; currentApprovalStage?: string; substituteTeacherEmail?: string }[];
  /** อีเมลของฉัน — ใช้จับคู่คำขอที่รอฉันยืนยันเป็นครูสอนแทน */
  myEmail?: string;
  /** staffId ของผู้ดู — นัดแนะแนวที่ผู้ปกครองระบุครูคนอื่นไม่นับเป็นงานค้างของฉัน */
  myStaffId?: string;
  /** ห้องสนทนาของห้องที่ฉันเป็นครูที่ปรึกษา — นับเป็นบรรทัดเดียวแบบรวม (ไม่แยกรายข้อความ) */
  chatThreads?: (ChatThreadLike & { targetStaffId?: string })[];
  /** จำนวนที่รองานกิจการพิจารณา (นับเฉพาะสถานะ PENDING) — ไม่ส่ง = ไม่มี */
  conduct?: { pendingEntries: number; pendingChanges: number };
}

// SUPER_ADMIN ไม่มีสิทธิ์อนุมัติ (ดูแลข้อมูลพื้นฐานเท่านั้น); DIRECTOR สำรองระดับรอง
export const LATE_REQUEST_APPROVER_ROLES = ['ACADEMIC_HEAD', 'DEPUTY_DIRECTOR_ACADEMIC', 'DIRECTOR'] as const;

/** บทบาทที่ต้องฟังใบลาห้อง / คำขอเข้าสาย — ใช้ตัดสินว่าจะ subscribe อะไร (ไม่ subscribe เกินสิทธิ์) */
export function staffTaskSources(activeRole: string): { leaves: boolean; lateRequests: boolean; screening: boolean; appointments: boolean; substitutes: boolean; chat: boolean; conduct: boolean } {
  return {
    chat: activeRole === 'HOMEROOM_TEACHER',
    conduct: activeRole === 'STUDENT_AFFAIRS',
    // บุคลากรทุกบทบาทอาจถูกมอบหมายสอนแทน / อาจเป็นผู้อนุมัติขั้นใดขั้นหนึ่ง — ข้อมูลมาจาก store ที่ sync อยู่แล้ว (ไม่เพิ่ม listener)
    substitutes: true,
    appointments: activeRole === 'GUIDANCE_COUNSELOR' || activeRole === 'HOMEROOM_TEACHER',
    screening: activeRole === 'GUIDANCE_COUNSELOR' || activeRole === 'HOMEROOM_TEACHER',
    leaves: activeRole === 'HOMEROOM_TEACHER',
    lateRequests: (LATE_REQUEST_APPROVER_ROLES as readonly string[]).includes(activeRole),
  };
}

export function buildStaffTasks(input: StaffTaskInput): StaffTask[] {
  const src = staffTaskSources(input.activeRole);
  const tasks: StaffTask[] = [];
  if (src.leaves) {
    const n = input.roomLeaves.filter(l => canTeacherDecide(l.status)).length;
    if (n > 0) tasks.push({ kind: 'LEAVE', label: 'ใบลานักเรียนรออนุมัติ', count: n, where: 'พอร์ทัลครูที่ปรึกษา → ภาพรวม (ส่วน A)' });
  }
  if (src.lateRequests) {
    const actor = { roles: input.myRoles && input.myRoles.length ? input.myRoles : [input.activeRole], staffId: input.myStaffId || '' };
    const now = input.nowMs ?? Date.now();
    const n = input.lateRequests.filter(r => actorKindsFor(r, actor, now).length > 0).length;
    if (n > 0) tasks.push({ kind: 'LATE_ATTENDANCE', label: 'คำขอเช็คชื่อย้อนหลังรอฉันพิจารณา', count: n, where: 'พอร์ทัลอนุมัติ' });
  }
  if (src.substitutes && input.substitutes) {
    const stageRole = (st?: string) => (st && st !== 'COMPLETED' ? (SUBSTITUTE_STAGE_ROLE as Record<string, string>)[st] : undefined);
    const approve = input.substitutes.filter(a => a.status === 'PENDING_APPROVAL' && stageRole(a.currentApprovalStage) === input.activeRole).length;
    if (approve > 0) tasks.push({ kind: 'SUBSTITUTE_APPROVAL', label: 'การจัดครูสอนแทนรออนุมัติในขั้นของฉัน', count: approve, where: 'พอร์ทัลอนุมัติ → จัดครูสอนแทน' });
    const me = normalizeEmail(input.myEmail || '');
    const confirm = me ? input.substitutes.filter(a => a.status === 'PENDING_TEACHER_CONFIRMATION' && normalizeEmail(a.substituteTeacherEmail || '') === me).length : 0;
    if (confirm > 0) tasks.push({ kind: 'SUBSTITUTE_CONFIRM', label: 'คำขอให้ฉันสอนแทน รอยืนยัน', count: confirm, where: 'พอร์ทัลครู → สอนแทน' });
  }
  if (src.appointments && input.appointments) {
    const n = input.appointments.filter(a => isAppointmentPending(a.status) && canStaffHandleAppointment({ recipient: a.recipient || 'HOMEROOM', targetStaffId: a.targetStaffId }, input.myStaffId)).length;
    if (n > 0) tasks.push({ kind: 'APPOINTMENT', label: 'คำขอนัดพบจากผู้ปกครองรอตอบรับ', count: n, where: input.activeRole === 'GUIDANCE_COUNSELOR' ? 'พอร์ทัลแนะแนว → นัดพบผู้ปกครอง' : 'พอร์ทัลครูที่ปรึกษา → ภาพรวม (ส่วน A)' });
  }
  if (src.chat && input.chatThreads) {
    // แชทรวมเป็นบรรทัดเดียว: จำนวนห้องสนทนาที่ยังไม่อ่าน (เฉพาะห้องสนทนาที่ส่งถึงฉันหรือ "ท่านใดก็ได้")
    const n = input.chatThreads.filter(t => isThreadForTeacher(t, input.myStaffId) && isThreadUnread(t, 'TEACHER')).length;
    if (n > 0) tasks.push({ kind: 'CHAT_UNREAD', label: 'ห้องสนทนาที่มีข้อความใหม่จากผู้ปกครอง/นักเรียน', count: n, where: 'พอร์ทัลครูที่ปรึกษา → แชทห้องเรียน' });
  }
  if (src.conduct && input.conduct) {
    if (input.conduct.pendingEntries > 0) tasks.push({ kind: 'CONDUCT_REVIEW', label: 'รายการคะแนนความประพฤติรอพิจารณา', count: input.conduct.pendingEntries, where: 'พอร์ทัลงานกิจการ → เรื่องรอพิจารณา' });
    if (input.conduct.pendingChanges > 0) tasks.push({ kind: 'CONDUCT_CHANGE', label: 'คำร้องแก้/ยกเลิกคะแนนรอพิจารณา', count: input.conduct.pendingChanges, where: 'พอร์ทัลงานกิจการ → คำร้องแก้/ยกเลิกคะแนน' });
  }
  if (src.screening && input.screening) {
    const where = input.activeRole === 'GUIDANCE_COUNSELOR' ? 'พอร์ทัลแนะแนว → คัดกรองสุขภาพจิต' : 'พอร์ทัลครูที่ปรึกษา → คัดกรองสุขภาพจิต';
    if (input.screening.twoQ > 0) tasks.push({ kind: 'SCREENING_2Q', label: 'ผลคัดกรอง 2Q เป็นบวก รอนักเรียนทำ 9Q', count: input.screening.twoQ, where });
    if (input.screening.redFlag > 0) tasks.push({ kind: 'SCREENING_RED_FLAG', label: 'ผล 9Q มีธงแดง รอแจ้งผู้ปกครองหรือพบนักเรียน', count: input.screening.redFlag, where });
  }
  return tasks;
}

export function totalStaffTasks(tasks: StaffTask[]): number {
  return tasks.reduce((sum, t) => sum + t.count, 0);
}
