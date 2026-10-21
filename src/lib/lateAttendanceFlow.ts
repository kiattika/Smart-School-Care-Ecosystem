/**
 * ขั้นตอนอนุมัติ "เช็คชื่อย้อนหลัง" สองผู้อนุมัติ — ตรรกะบริสุทธิ์ที่ที่เดียว (ต้องตรง firestore.rules บล็อก late_attendance_requests
 * และ functions/src/lateAttendanceReminders.ts)
 *
 * ผู้อนุมัติ:
 *  - ขั้นหัวหน้า: ACADEMIC_HEAD (หัวหน้ากลุ่มงานวิชาการและหลักสูตร)
 *  - ขั้นรอง:    DEPUTY_DIRECTOR_ACADEMIC (รองผู้อำนวยการกลุ่มงานวิชาการ); DIRECTOR สำรองในระดับเดียวกับรอง (อนุมัติออนไลน์ได้)
 *  - SUPER_ADMIN ไม่มีสิทธิ์อนุมัติ (ดูแลข้อมูลพื้นฐานเท่านั้น)
 * ใครอนุมัติก่อนก็ได้; หัวหน้าอนุมัติก่อน → ครูดำเนินการได้ทันที (ก่อน 24:00) และรองมีสิทธิ์ทบทวนถึง 18:00 (ดู reviewUntil)
 *  รองตัดสิน "ล้างผล" หัวหน้าได้ทั้งหมด: อนุมัติตามเสนอ / อนุมัติมีเงื่อนไข (ข้อความเตือนครู) / ไม่อนุมัติ (ธงเหลือง — ข้อมูลเช็คชื่อที่ทำไปแล้วไม่ถูกลบ)
 *  รองไม่ตัดสินภายใน reviewUntil → ผลของหัวหน้ายืนตามเดิม; รองอนุมัติก่อน → หัวหน้าไม่ต้องทำอะไร
 * รองขยายเวลาให้ครูได้อีกไม่เกิน 24 ชม. (ธงแดง); พ้นกำหนด → ครูทำบันทึกชี้แจงผู้บังคับบัญชานอกระบบ (สถานะ "เลยกำหนด")
 * ไม่มีใครตัดสินจนถึง 24:00 ของวันสอน → "หมดอายุ"
 * ผู้บริหารระดับสูงกว่าอนุมัติคำขอของตนเอง: ของหัวหน้า → รอง/ผอ.; ของรอง → ผอ.; ห้ามอนุมัติตัวเอง; คนเดียวกันทำสองขั้นไม่ได้
 *
 * เวลาทุกอย่างเป็นเวลาเซิร์ฟเวอร์: rules บังคับ `at == request.time`; ฝั่ง client ใช้ serverTimestamp()
 * โซนเวลาไทย (UTC+7) ไม่มี DST → 24:00 ไทย = 17:00 UTC, 18:00 ไทย = 11:00 UTC
 */

export type LateDecision = 'APPROVE' | 'CONDITIONAL' | 'REJECT';
export type LateStepRole = 'ACADEMIC_HEAD' | 'DEPUTY_DIRECTOR_ACADEMIC' | 'DIRECTOR';
export type LateRequesterLevel = 'TEACHER' | 'HEAD' | 'DEPUTY';

export const DAY_MS = 86_400_000;
const BANGKOK_OFFSET_MS = 7 * 3_600_000;
/** 24:00 ไทย (= 00:00 วันถัดไป) เป็นมิลลิวินาทีภายในวัน UTC */
export const MIDNIGHT_BKK_UTC_MS = 17 * 3_600_000;
/** 18:00 ไทย เป็นมิลลิวินาทีภายในวัน UTC */
export const SIX_PM_BKK_UTC_MS = 11 * 3_600_000;
export const MAX_EXTENSION_MS = DAY_MS;
export const LATE_NOTE_MAX = 300;

/** Firestore Timestamp | ISO string | Date | ms — ฝั่ง client/ทดสอบ/Admin SDK ใช้ร่วมกัน */
export type TimeLike = { toMillis: () => number } | { seconds: number; nanoseconds?: number } | string | Date | number | null | undefined;

export function toMs(v: TimeLike): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (v instanceof Date) { const t = v.getTime(); return Number.isNaN(t) ? null : t; }
  if (typeof v === 'string') { const t = Date.parse(v); return Number.isNaN(t) ? null : t; }
  if (typeof (v as any).toMillis === 'function') return (v as any).toMillis();
  if (typeof (v as any).seconds === 'number') return (v as any).seconds * 1000 + Math.floor(((v as any).nanoseconds || 0) / 1e6);
  return null;
}

export interface LateStep {
  decision: LateDecision;
  role: LateStepRole;
  byUid: string;
  byStaffId: string;
  byName: string;
  at: TimeLike;
  note: string;
  /** เฉพาะขั้นหัวหน้า: รองทบทวนได้ถึงเวลานี้ */
  reviewUntil?: TimeLike;
}

export interface LateExtension {
  byUid: string;
  byStaffId: string;
  byName: string;
  role: LateStepRole;
  at: TimeLike;
}

/** ส่วนของคำขอที่ตรรกะนี้ใช้ (ตรงกับ LateAttendanceRequestRecord) */
export interface LateFlowRequest {
  status?: string;
  requesterLevel?: LateRequesterLevel;
  requesterStaffId?: string;
  deadlineAt?: TimeLike;
  headStep?: LateStep | null;
  deputyStep?: LateStep | null;
  extendedUntil?: TimeLike;
  extendedBy?: LateExtension | null;
}

/** 24:00 ไทยของวันที่ที่ระบุ (YYYY-MM-DD) = เริ่มวันถัดไป 00:00 ไทย */
export function deadlineForDate(teachingDate: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(teachingDate);
  if (!m) return null;
  const startUtc = Date.UTC(+m[1], +m[2] - 1, +m[3]) - BANGKOK_OFFSET_MS; // 00:00 ไทยของวันนั้น
  return startUtc + DAY_MS;
}

/** 24:00 ไทยที่ใกล้ที่สุดหลัง now (ใช้ตอนยื่นคำขอของ "วันนี้") */
export function nextBangkokMidnight(nowMs: number): number {
  return nowMs - ((nowMs - MIDNIGHT_BKK_UTC_MS) % DAY_MS + DAY_MS) % DAY_MS + DAY_MS;
}

/** รองทบทวนได้ถึง 18:00 ไทยถัดไปหลังเวลาที่หัวหน้าตัดสิน (ก่อน 18:00 = วันเดียวกัน, หลัง 18:00 = วันถัดไป) */
export function reviewUntilFor(headDecidedAtMs: number): number {
  return headDecidedAtMs - (((headDecidedAtMs - SIX_PM_BKK_UTC_MS) % DAY_MS) + DAY_MS) % DAY_MS + DAY_MS;
}

export type LateOutcome = 'PENDING' | 'APPROVE' | 'CONDITIONAL' | 'REJECT';

export type LateState =
  | 'AWAITING'      // ยังไม่มีผู้ตัดสิน และยังอยู่ในกำหนด
  | 'EXPIRED'       // ไม่มีผู้ตัดสินจนเลย 24:00 → หมดอายุ
  | 'OPEN'          // อนุมัติ (ตามเสนอ/มีเงื่อนไข) และครูยังใช้สิทธิ์ได้
  | 'OVERDUE'       // อนุมัติแล้วแต่เลยกำหนดใช้สิทธิ์ → ครูทำบันทึกชี้แจงผู้บังคับบัญชา
  | 'REJECTED';

export interface LateResolution {
  /** ผู้ตัดสินที่มีผลสุดท้าย: รองชนะหัวหน้าเสมอ */
  finalStep: LateStep | null;
  outcome: LateOutcome;
  state: LateState;
  /** ครูเริ่ม/ทำต่อได้ ณ now */
  teacherMayProceed: boolean;
  /** ธงเหลือง: รองไม่อนุมัติทั้งที่หัวหน้าอนุมัติไว้ (ข้อมูลที่ครูทำไปแล้วยังอยู่) */
  yellowFlag: boolean;
  /** ธงแดง: รองขยายเวลาให้ครู — ต้องรีบดำเนินการ */
  redFlag: boolean;
  /** ข้อความเงื่อนไข/เตือนครู (อนุมัติแบบมีเงื่อนไข) */
  conditionNote: string | null;
  /** ครูใช้สิทธิ์ได้ถึง (ms) */
  usableUntil: number | null;
  /** รองยังทบทวนผลของหัวหน้าได้อยู่ ณ now */
  deputyReviewOpen: boolean;
  /** รองยังตัดสินได้ (ยังไม่เลยกำหนด และไม่เลยหน้าต่างทบทวน) */
  deputyMayDecide: boolean;
  /** หัวหน้ายังตัดสินได้ */
  headMayDecide: boolean;
}

export function resolveLateRequest(req: LateFlowRequest, nowMs: number): LateResolution {
  const head = req.headStep || null;
  const deputy = req.deputyStep || null;
  const finalStep = deputy || head;
  const outcome: LateOutcome = finalStep ? finalStep.decision : 'PENDING';
  const deadline = toMs(req.deadlineAt);
  const extended = toMs(req.extendedUntil);
  const usableUntil = deadline == null ? null : Math.max(deadline, extended ?? 0);
  const beforeDeadline = deadline == null ? false : nowMs < deadline;
  const reviewUntil = head ? toMs(head.reviewUntil) : null;
  const deputyReviewOpen = !!head && !deputy && reviewUntil != null && nowMs <= reviewUntil;
  const deputyMayDecide = !deputy && beforeDeadline && (!head || deputyReviewOpen);
  const headMayDecide = !head && !deputy && beforeDeadline && (req.requesterLevel ?? 'TEACHER') === 'TEACHER';

  let state: LateState;
  if (outcome === 'PENDING') state = beforeDeadline ? 'AWAITING' : 'EXPIRED';
  else if (outcome === 'REJECT') state = 'REJECTED';
  else state = usableUntil != null && nowMs < usableUntil ? 'OPEN' : 'OVERDUE';

  return {
    finalStep,
    outcome,
    state,
    teacherMayProceed: state === 'OPEN',
    yellowFlag: !!deputy && deputy.decision === 'REJECT' && !!head && head.decision !== 'REJECT',
    redFlag: extended != null && deadline != null && extended > deadline,
    conditionNote: outcome === 'CONDITIONAL' && finalStep ? finalStep.note || null : null,
    usableUntil,
    deputyReviewOpen,
    deputyMayDecide,
    headMayDecide,
  };
}

/** status ที่เก็บในเอกสาร (เข้ากันได้กับ UI/รายงานเดิม) — ต้องตรง rules */
export function storedStatusFor(decision: LateDecision): 'APPROVED' | 'REJECTED' {
  return decision === 'REJECT' ? 'REJECTED' : 'APPROVED';
}

export type LateActorKind = 'HEAD' | 'DEPUTY' | 'DIRECTOR';

export interface LateActor {
  roles: readonly string[];
  staffId: string;
}

/** บทบาทที่ผู้ใช้ใช้ตัดสินคำขอนี้ได้ ณ now (ว่าง = ตัดสินไม่ได้) — เป็นตัวช่วยฝั่ง UI; rules คือด่านจริง */
export function actorKindsFor(req: LateFlowRequest, actor: LateActor, nowMs: number): LateActorKind[] {
  if (!actor.staffId || actor.staffId === req.requesterStaffId) return [];
  const res = resolveLateRequest(req, nowMs);
  const out: LateActorKind[] = [];
  const level = req.requesterLevel ?? 'TEACHER';
  const sameAsHead = !!req.headStep && req.headStep.byStaffId === actor.staffId;
  if (actor.roles.includes('ACADEMIC_HEAD') && res.headMayDecide) out.push('HEAD');
  if (!sameAsHead && res.deputyMayDecide) {
    if (actor.roles.includes('DEPUTY_DIRECTOR_ACADEMIC') && level !== 'DEPUTY') out.push('DEPUTY');
    if (actor.roles.includes('DIRECTOR')) out.push('DIRECTOR');
  }
  return out;
}

/**
 * เหตุผลที่ผู้ใช้ "ตัดสินคำขอนี้ไม่ได้" ณ now (ไว้แสดงแทนที่ปุ่มที่หายไป) — null = ตัดสินได้ (actorKindsFor ไม่ว่าง)
 * เป็นข้อความช่วยฝั่ง UI เท่านั้น ด่านจริงคือ firestore.rules; ลำดับตรวจเรียงจากสาเหตุที่ผู้ใช้แก้ไม่ได้ก่อน
 */
export function cannotDecideReason(req: LateFlowRequest, actor: LateActor, nowMs: number): string | null {
  if (actorKindsFor(req, actor, nowMs).length > 0) return null;
  if (!actor.staffId) return 'บัญชีนี้ไม่ได้เชื่อมกับทะเบียนบุคลากร จึงตัดสินคำขอไม่ได้';
  if (actor.staffId === req.requesterStaffId) return 'คำขอของท่านเอง — อนุมัติเองไม่ได้ ต้องให้ผู้อนุมัติท่านอื่นพิจารณา';
  const isHead = actor.roles.includes('ACADEMIC_HEAD');
  const isDeputy = actor.roles.includes('DEPUTY_DIRECTOR_ACADEMIC');
  const isDirector = actor.roles.includes('DIRECTOR');
  if (!isHead && !isDeputy && !isDirector) return 'บทบาทของท่านไม่มีสิทธิ์ตัดสินคำขอนี้ (ผู้อนุมัติคือหัวหน้า/รองผู้อำนวยการกลุ่มงานวิชาการ และผู้อำนวยการสำรอง)';
  const deadline = toMs(req.deadlineAt);
  if (deadline == null) return 'คำขอรุ่นเก่าไม่มีกำหนดเวลา ตัดสินไม่ได้ — ให้ครูยื่นคำขอใหม่';
  if (nowMs >= deadline) return 'เลยกำหนด 24.00 น. ของวันสอนแล้ว ตัดสินไม่ได้';
  if (req.deputyStep) return 'รอง/ผอ. ตัดสินแล้ว ซึ่งเป็นผลสุดท้าย';
  const level = req.requesterLevel ?? 'TEACHER';
  if (!!req.headStep && req.headStep.byStaffId === actor.staffId) {
    return 'ท่านตัดสินขั้นหัวหน้าไปแล้ว — ขั้นรอง/ผอ. ต้องเป็นผู้อื่น (คนเดียวทำสองขั้นไม่ได้)';
  }
  if (isHead && !isDeputy && !isDirector) {
    if (level !== 'TEACHER') return 'คำขอของหัวหน้า/รองกลุ่มงาน — รองผู้อำนวยการหรือผู้อำนวยการเป็นผู้ตัดสิน';
    if (req.headStep) return 'หัวหน้าตัดสินแล้ว — ขั้นต่อไปเป็นของรอง/ผู้อำนวยการ';
  }
  if (req.headStep && !resolveLateRequest(req, nowMs).deputyReviewOpen) {
    return 'พ้นเวลาทบทวนของรอง/ผอ. (18.00 น.) แล้ว ผลของหัวหน้ายืนตามเดิม';
  }
  if (isDeputy && !isDirector && level === 'DEPUTY') return 'คำขอของรอง — ผู้อำนวยการเป็นผู้ตัดสิน';
  return 'ท่านตัดสินคำขอนี้ไม่ได้ในขั้นตอนปัจจุบัน';
}

/** รองขยายเวลาได้เมื่อ: อนุมัติแล้ว (ไม่ใช่ปฏิเสธ), ยังไม่ขยาย, ยังไม่เลย 24:00 */
export function mayExtend(req: LateFlowRequest, actor: LateActor, nowMs: number): boolean {
  if (!actor.staffId || actor.staffId === req.requesterStaffId) return false;
  const res = resolveLateRequest(req, nowMs);
  const deadline = toMs(req.deadlineAt);
  if (deadline == null || nowMs >= deadline || req.extendedUntil) return false;
  if (res.outcome !== 'APPROVE' && res.outcome !== 'CONDITIONAL') return false;
  const level = req.requesterLevel ?? 'TEACHER';
  return (actor.roles.includes('DEPUTY_DIRECTOR_ACADEMIC') && level !== 'DEPUTY') || actor.roles.includes('DIRECTOR');
}

/** ระดับของผู้ยื่นจากบทบาทที่มี (ตรงกับที่ rules ตรวจตอน create) */
export function requesterLevelOf(roles: readonly string[]): LateRequesterLevel {
  if (roles.includes('DEPUTY_DIRECTOR_ACADEMIC')) return 'DEPUTY';
  if (roles.includes('ACADEMIC_HEAD')) return 'HEAD';
  return 'TEACHER';
}

/** ข้อความเตือนครูมาตรฐานของการอนุมัติแบบมีเงื่อนไข (แสดงต่อท้ายเหตุผลที่ผู้อนุมัติระบุ) */
export const CONDITION_REMINDER_TH =
  'โปรดเช็คชื่อให้ตรงเวลา หากลาหรือไปราชการให้มอบหมายให้เรียบร้อย และดำเนินการตามห้วงเวลาที่กำหนด';

export const LATE_STATE_LABEL_TH: Record<LateState, string> = {
  AWAITING: 'รอพิจารณา',
  EXPIRED: 'หมดอายุ',
  OPEN: 'อนุมัติแล้ว — ดำเนินการได้',
  OVERDUE: 'เลยกำหนด — ทำบันทึกชี้แจงผู้บังคับบัญชา',
  REJECTED: 'ไม่อนุมัติ',
};
