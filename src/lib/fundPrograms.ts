import { enrollmentState, toMillis, type EnrollmentPhase } from './enrollmentWindow';
import { isHttpsLink } from './evidenceLinks';

/**
 * ทุนการศึกษา / กองทุนกู้ยืมเพื่อการศึกษา (กยศ.) — ตรรกะล้วน (ต้องตรง firestore.rules: fund_programs / fund_interests)
 *
 * งานกองทุนและทุนการศึกษา (FUND_SCHOLARSHIP) ประกาศโปรแกรม → นักเรียน/ผู้ปกครองลงชื่อ "สนใจ" (ถ้าเปิดลงทะเบียน)
 * → งานกองทุนคัดเลือกตามเกณฑ์ของผู้ให้ทุนแต่ละแห่ง (บันทึกเกณฑ์เป็นข้อความ ไม่บังคับรูปแบบเดียว) แล้วบันทึกผล
 * นักเรียนยื่นจริงผ่านงานแนะแนว (ออกหนังสือราชการ) — ส่วนนั้นอยู่นอกขอบเขตเมนูนี้
 */
export type FundKind = 'SCHOLARSHIP' | 'STUDENT_LOAN';
export const FUND_KINDS: readonly FundKind[] = ['SCHOLARSHIP', 'STUDENT_LOAN'];
export const FUND_KIND_LABEL: Record<FundKind, string> = {
  SCHOLARSHIP: 'ทุนการศึกษา',
  STUDENT_LOAN: 'กองทุนกู้ยืมเพื่อการศึกษา (กยศ.)',
};

export type FundStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED';
export const FUND_STATUS_LABEL: Record<FundStatus, string> = { DRAFT: 'ฉบับร่าง (ยังไม่แสดงให้นักเรียน)', PUBLISHED: 'ประกาศแล้ว', CLOSED: 'ปิดแล้ว' };

export type InterestStatus = 'INTERESTED' | 'WITHDRAWN' | 'SHORTLISTED' | 'AWARDED' | 'NOT_SELECTED';
export const INTEREST_STATUS_LABEL: Record<InterestStatus, string> = {
  INTERESTED: 'ลงชื่อสนใจแล้ว', WITHDRAWN: 'ถอนความสนใจ', SHORTLISTED: 'ผ่านการคัดเลือกเบื้องต้น', AWARDED: 'ได้รับทุน/อนุมัติ', NOT_SELECTED: 'ไม่ผ่านการคัดเลือก',
};
/** งานกองทุนเปลี่ยนสถานะได้จาก → ไป (ตรงกับ rules) */
export const STAFF_INTEREST_TRANSITIONS: Record<string, InterestStatus[]> = {
  INTERESTED: ['SHORTLISTED', 'AWARDED', 'NOT_SELECTED'],
  SHORTLISTED: ['AWARDED', 'NOT_SELECTED'],
};
export const canStaffSetInterest = (from: string, to: string) => (STAFF_INTEREST_TRANSITIONS[from] || []).includes(to as InterestStatus);

export const FUND_TITLE_MAX = 200;
export const FUND_FUNDER_MAX = 200;
export const FUND_DESC_MAX = 2000;
export const FUND_ELIGIBILITY_MAX = 1000;
export const FUND_AMOUNT_MAX = 200;
export const FUND_SELECTION_MAX = 1000;
export const FUND_LINKS_MAX = 5;
export const INTEREST_NOTE_MAX = 500;

export interface FundProgramInput {
  kind: string;
  title: string;
  funder: string;
  description: string;
  eligibility: string;
  amountText: string;
  selectionNote: string;
  links: string[];
  registrationEnabled: boolean;
  opensYmd: string; // '' = ไม่จำกัด
  closesYmd: string; // '' = ไม่จำกัด (ปิดสิ้นวันที่ระบุ)
}

export interface FundProgram {
  id: string;
  kind: FundKind;
  title: string;
  funder: string;
  description: string;
  eligibility: string;
  amountText: string;
  selectionNote: string;
  links: string[];
  status: FundStatus;
  registrationEnabled: boolean;
  /** Timestamp/Date/ms — ว่าง = ไม่จำกัด */
  registrationOpensAt?: unknown;
  registrationClosesAt?: unknown;
}

export interface FundInterest {
  id: string;
  programId: string;
  studentId: string;
  /** uid บัญชีนักเรียนที่ประทับตอนลงชื่อ (ใช้ส่งแจ้งผล) */
  studentUid?: string;
  studentName?: string;
  room?: string;
  kind: FundKind;
  status: InterestStatus;
  note: string;
  staffNote?: string;
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export function validateFundProgramInput(i: FundProgramInput): string[] {
  const errs: string[] = [];
  if (!FUND_KINDS.includes(i.kind as FundKind)) errs.push('เลือกประเภท (ทุนการศึกษา หรือ กยศ.)');
  const title = i.title.trim();
  if (!title) errs.push('ระบุชื่อทุน/โครงการ');
  else if (title.length > FUND_TITLE_MAX) errs.push(`ชื่อยาวเกิน ${FUND_TITLE_MAX} ตัวอักษร`);
  if (i.funder.length > FUND_FUNDER_MAX) errs.push(`ชื่อผู้ให้ทุนยาวเกิน ${FUND_FUNDER_MAX} ตัวอักษร`);
  if (i.description.length > FUND_DESC_MAX) errs.push(`รายละเอียดยาวเกิน ${FUND_DESC_MAX} ตัวอักษร`);
  if (i.eligibility.length > FUND_ELIGIBILITY_MAX) errs.push(`คุณสมบัติยาวเกิน ${FUND_ELIGIBILITY_MAX} ตัวอักษร`);
  if (i.amountText.length > FUND_AMOUNT_MAX) errs.push(`จำนวนเงินยาวเกิน ${FUND_AMOUNT_MAX} ตัวอักษร`);
  if (i.selectionNote.length > FUND_SELECTION_MAX) errs.push(`วิธีคัดเลือกยาวเกิน ${FUND_SELECTION_MAX} ตัวอักษร`);
  if (i.links.length > FUND_LINKS_MAX) errs.push(`ใส่ลิงก์ได้ไม่เกิน ${FUND_LINKS_MAX} ลิงก์`);
  if (i.links.some(l => !isHttpsLink(l))) errs.push('ลิงก์ต้องขึ้นต้นด้วย https://');
  for (const [label, v] of [['วันเปิดรับ', i.opensYmd], ['วันปิดรับ', i.closesYmd]] as const) {
    if (v && !YMD.test(v)) errs.push(`${label}ไม่ถูกต้อง`);
  }
  if (i.opensYmd && i.closesYmd && i.closesYmd < i.opensYmd) errs.push('วันปิดรับต้องไม่ก่อนวันเปิดรับ');
  if (i.registrationEnabled && !i.closesYmd) errs.push('เปิดให้ลงชื่อสนใจต้องกำหนดวันปิดรับ');
  return errs;
}

/** เวลาเริ่มของวัน (เวลาท้องถิ่น) — วันเปิดรับ */
export const dayStart = (ymd: string): Date | null => (YMD.test(ymd) ? new Date(`${ymd}T00:00:00`) : null);
/** สิ้นวัน = 00:00 ของวันถัดไป (ปิดรับ "ภายในสิ้นวันที่ระบุ" — rules เทียบ request.time < closesAt) */
export function dayEndExclusive(ymd: string): Date | null {
  const d = dayStart(ymd);
  if (!d) return null;
  d.setDate(d.getDate() + 1);
  return d;
}
export function toYmd(v: unknown): string {
  const ms = toMillis(v as never);
  if (ms === null) return '';
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
/** วันปิดรับที่แสดง = วันก่อน closesAt (เก็บเป็นสิ้นวัน) */
export function closesYmdOf(v: unknown): string {
  const ms = toMillis(v as never);
  return ms === null ? '' : toYmd(ms - 1);
}

/** เฟสการลงชื่อสนใจ ณ ตอนนี้ — ตรงกับ rules (`fundRegistrationOpen`) */
export function registrationPhase(p: Pick<FundProgram, 'registrationEnabled' | 'registrationOpensAt' | 'registrationClosesAt'>, nowMs: number): EnrollmentPhase {
  return enrollmentState({
    enrollmentStatus: p.registrationEnabled ? 'OPEN' : 'CLOSED',
    enrollmentOpensAt: p.registrationOpensAt as never,
    enrollmentClosesAt: p.registrationClosesAt as never,
  }, nowMs).phase;
}
export const canExpressInterest = (p: FundProgram, nowMs: number) => p.status === 'PUBLISHED' && registrationPhase(p, nowMs) === 'OPEN';

export const fundInterestId = (programId: string, studentId: string) => `${programId}_${studentId}`;

/** ข้อความสถานะการลงทะเบียนของโปรแกรม (หน้านักเรียน) */
export function registrationLabel(p: FundProgram, nowMs: number): string {
  if (!p.registrationEnabled) return 'ประกาศให้ทราบ — ไม่มีการลงชื่อสนใจในระบบ';
  const phase = registrationPhase(p, nowMs);
  if (phase === 'NOT_YET') return 'ยังไม่เปิดให้ลงชื่อสนใจ';
  if (phase === 'CLOSED' || p.status === 'CLOSED') return 'ปิดรับลงชื่อสนใจแล้ว';
  return 'เปิดให้ลงชื่อสนใจ';
}
