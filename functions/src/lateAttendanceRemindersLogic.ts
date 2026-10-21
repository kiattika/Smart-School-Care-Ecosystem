/**
 * ตรรกะบริสุทธิ์ของการแจ้งเตือนคำขอเช็คชื่อย้อนหลัง (เตือน 16:00 / แจ้งหมดอายุ) — ไม่แตะ Firestore เพื่อให้ทดสอบได้
 * สำเนาของกติกาใน src/lib/lateAttendanceFlow.ts (แก้ต้องแก้ทั้งคู่ — มี test เทียบพฤติกรรม)
 */
export interface ReqLite {
  id: string;
  status?: string;
  teacherEmail?: string;
  teacherName?: string;
  subjectName?: string;
  level?: string;
  periodNumber?: number;
  teachingDate?: string;
  requesterLevel?: 'TEACHER' | 'HEAD' | 'DEPUTY';
  deadlineMs: number | null;
  headStep?: { reviewUntilMs: number | null } | null;
  deputyStep?: unknown | null;
}

export interface StaffLite {
  email?: string;
  roles?: string[];
  status?: string;
}

export interface NoticeDraft {
  /** id เอกสารแบบกำหนดเอง — เขียนด้วย create() จึงส่งซ้ำไม่ได้ (ครั้งเดียวต่อคำขอต่อผู้รับ) */
  docId: string;
  recipientEmail: string;
  title: string;
  message: string;
  refId: string;
}

const what = (r: ReqLite) => `${r.subjectName || 'รายวิชา'} ${r.level || ''} คาบ ${r.periodNumber ?? '-'} วันที่ ${r.teachingDate || '-'}`.replace(/\s+/g, ' ');

const emailsWithRole = (staff: StaffLite[], role: string) =>
  staff.filter(s => s.status !== 'INACTIVE' && s.email && (s.roles || []).includes(role)).map(s => String(s.email).trim().toLowerCase());

const safeId = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, '_');

/** ยังรอดำเนินการ ณ now: ยังไม่มีผู้ตัดสิน (ก่อน 24:00) หรือหัวหน้าอนุมัติแล้วและรองยังทบทวนได้ */
export function isStillPending(r: ReqLite, nowMs: number): { awaiting: boolean; deputyReview: boolean } {
  const beforeDeadline = r.deadlineMs != null && nowMs < r.deadlineMs;
  const awaiting = beforeDeadline && !r.headStep && !r.deputyStep;
  const reviewUntil = r.headStep?.reviewUntilMs ?? null;
  const deputyReview = beforeDeadline && !!r.headStep && !r.deputyStep && reviewUntil != null && nowMs <= reviewUntil;
  return { awaiting, deputyReview };
}

/** เตือน 16:00 ถึงสามฝ่าย: ครูผู้ยื่น + ผู้อนุมัติที่เกี่ยวข้อง (หัวหน้า/รอง; ผอ.เมื่อเป็นคำขอของรอง) — ครั้งเดียวต่อคำขอต่อผู้รับ */
export function planReminders(reqs: ReqLite[], staff: StaffLite[], nowMs: number): NoticeDraft[] {
  const out: NoticeDraft[] = [];
  const heads = emailsWithRole(staff, 'ACADEMIC_HEAD');
  const deputies = emailsWithRole(staff, 'DEPUTY_DIRECTOR_ACADEMIC');
  const directors = emailsWithRole(staff, 'DIRECTOR');
  const push = (r: ReqLite, who: string, email: string, title: string, message: string) => {
    if (!email.includes('@')) return;
    out.push({ docId: safeId(`lar_remind_${r.id}_${who}_${email}`), recipientEmail: email, title, message, refId: r.id });
  };
  for (const r of reqs) {
    const { awaiting, deputyReview } = isStillPending(r, nowMs);
    if (!awaiting && !deputyReview) continue;
    const level = r.requesterLevel ?? 'TEACHER';
    const w = what(r);
    if (r.teacherEmail) {
      push(r, 'teacher', String(r.teacherEmail).trim().toLowerCase(), '⏰ คำขอเช็คชื่อย้อนหลังยังไม่มีผู้พิจารณา',
        `คำขอ ${w} ยังอยู่ระหว่างพิจารณา หมดอายุเวลา 24.00 น. — โปรดแจ้งผู้อนุมัติโดยตรงอีกครั้ง`);
    }
    if (awaiting) {
      if (level === 'TEACHER') heads.forEach(e => push(r, 'head', e, '⏰ มีคำขอเช็คชื่อย้อนหลังรอพิจารณา', `${r.teacherName || 'ครู'} ขอเช็คชื่อย้อนหลัง ${w} — หมดอายุ 24.00 น.`));
      if (level !== 'DEPUTY') deputies.forEach(e => push(r, 'deputy', e, '⏰ มีคำขอเช็คชื่อย้อนหลังรอพิจารณา', `${r.teacherName || 'ครู'} ขอเช็คชื่อย้อนหลัง ${w} — หมดอายุ 24.00 น.`));
      else directors.forEach(e => push(r, 'director', e, '⏰ มีคำขอเช็คชื่อย้อนหลังของรองผู้อำนวยการรอพิจารณา', `${r.teacherName || 'รองผู้อำนวยการ'} ขอเช็คชื่อย้อนหลัง ${w} — หมดอายุ 24.00 น.`));
    } else if (deputyReview && level !== 'DEPUTY') {
      deputies.forEach(e => push(r, 'deputy', e, '⏰ คำขอเช็คชื่อย้อนหลังที่หัวหน้าอนุมัติแล้ว รอรองทบทวน', `${w} — หากไม่ตัดสินภายใน 18.00 น. ผลของหัวหน้ายืนตามเดิม`));
    }
  }
  return out;
}

/** คำขอที่เลย 24:00 โดยไม่มีผู้ตัดสิน และยังไม่เคยแจ้งหมดอายุ → แจ้งครู (ครั้งเดียว) */
export function planExpiryNotices(reqs: (ReqLite & { expiredNotified?: boolean })[], nowMs: number): (NoticeDraft & { requestId: string })[] {
  const out: (NoticeDraft & { requestId: string })[] = [];
  for (const r of reqs) {
    if (r.expiredNotified || r.status !== 'PENDING' || r.headStep || r.deputyStep) continue;
    if (r.deadlineMs == null || nowMs < r.deadlineMs) continue;
    const email = String(r.teacherEmail || '').trim().toLowerCase();
    if (!email.includes('@')) continue;
    out.push({
      requestId: r.id,
      docId: safeId(`lar_expired_${r.id}`),
      recipientEmail: email,
      title: '⌛ คำขอเช็คชื่อย้อนหลังหมดอายุ',
      message: `คำขอ ${what(r)} ไม่มีผู้พิจารณาภายใน 24.00 น. จึงหมดอายุ — กรุณาทำบันทึกชี้แจงผู้บังคับบัญชา`,
      refId: r.id,
    });
  }
  return out;
}
