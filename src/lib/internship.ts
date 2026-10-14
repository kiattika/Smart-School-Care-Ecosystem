import { enrollmentState, toMillis, type EnrollmentPhase } from './enrollmentWindow';
import { dayEndExclusive, dayStart } from './fundPrograms';

/**
 * คำร้องขอฝึกงาน — ตรรกะล้วน (ต้องตรง firestore.rules: internship_settings / internship_requests)
 *
 * งานแนะแนวตั้งค่า (internship_settings/current): ช่วงฝึกงานให้เลือก, ข้อความเหตุผล/วัตถุประสงค์, แบบหนังสือตอบรับ,
 * ผู้ลงนาม, และช่วงเวลารับคำร้อง → นักเรียนยื่นเอง (เอกสาร internship_requests/{studentId} ต่อคน)
 * → งานแนะแนว "อนุมัติ/ไม่อนุมัติ" ลำดับเดียว → ออกหนังสือราชการจากข้อมูลคำร้อง พิมพ์/บันทึก PDF
 */
export const INTERNSHIP_SETTINGS_ID = 'current';
export const INTERNSHIP_MAX_PERIODS = 10;
export const INTERNSHIP_LIMITS = {
  companyName: 200, companyAddress: 500, headName: 160, headPosition: 160, periodLabel: 120,
  purposeText: 1000, acceptanceFormText: 2000, signer: 160, staffNote: 500, letterNo: 60,
} as const;

export type InternshipStatus = 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export const INTERNSHIP_STATUS_LABEL: Record<InternshipStatus, string> = {
  SUBMITTED: 'รอพิจารณา', APPROVED: 'อนุมัติแล้ว', REJECTED: 'ไม่อนุมัติ', CANCELLED: 'ยกเลิกคำร้อง',
};

/** รูปทรงต้องตรงกับที่ rules เทียบด้วย `{id,label,startYmd,endYmd} in settings.periods` */
export interface InternshipPeriod { id: string; label: string; startYmd: string; endYmd: string }

export interface InternshipSettings {
  periods: InternshipPeriod[];
  purposeText: string;
  acceptanceFormText: string;
  signerName: string;
  signerPosition: string;
  registrationEnabled: boolean;
  registrationOpensAt?: unknown;
  registrationClosesAt?: unknown;
}

export interface InternshipSettingsInput {
  periods: InternshipPeriod[];
  purposeText: string;
  acceptanceFormText: string;
  signerName: string;
  signerPosition: string;
  registrationEnabled: boolean;
  opensYmd: string;
  closesYmd: string;
}

export interface InternshipForm {
  companyName: string; companyAddress: string; headName: string; headPosition: string; periodId: string;
}

export interface InternshipRequest extends InternshipForm {
  id: string; studentId: string; studentName: string; room: string;
  periodLabel: string; startYmd: string; endYmd: string;
  status: InternshipStatus; staffNote?: string; letterNo?: string; letterDateYmd?: string;
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export function validateSettingsInput(i: InternshipSettingsInput): string[] {
  const e: string[] = [];
  if (i.periods.length > INTERNSHIP_MAX_PERIODS) e.push(`กำหนดช่วงฝึกงานได้ไม่เกิน ${INTERNSHIP_MAX_PERIODS} ช่วง`);
  const ids = new Set<string>();
  i.periods.forEach((p, n) => {
    const t = `ช่วงที่ ${n + 1}`;
    if (!p.id || ids.has(p.id)) e.push(`${t}: รหัสซ้ำหรือว่าง`);
    ids.add(p.id);
    if (!p.label.trim()) e.push(`${t}: ระบุชื่อช่วง`);
    else if (p.label.length > INTERNSHIP_LIMITS.periodLabel) e.push(`${t}: ชื่อช่วงยาวเกิน ${INTERNSHIP_LIMITS.periodLabel} ตัวอักษร`);
    if (!YMD.test(p.startYmd) || !YMD.test(p.endYmd)) e.push(`${t}: ระบุวันเริ่มและวันสิ้นสุด`);
    else if (p.endYmd < p.startYmd) e.push(`${t}: วันสิ้นสุดต้องไม่ก่อนวันเริ่ม`);
  });
  if (i.purposeText.length > INTERNSHIP_LIMITS.purposeText) e.push(`ข้อความเหตุผล/วัตถุประสงค์ยาวเกิน ${INTERNSHIP_LIMITS.purposeText} ตัวอักษร`);
  if (i.acceptanceFormText.length > INTERNSHIP_LIMITS.acceptanceFormText) e.push(`แบบหนังสือตอบรับยาวเกิน ${INTERNSHIP_LIMITS.acceptanceFormText} ตัวอักษร`);
  if (i.signerName.length > INTERNSHIP_LIMITS.signer || i.signerPosition.length > INTERNSHIP_LIMITS.signer) e.push(`ชื่อ/ตำแหน่งผู้ลงนามยาวเกิน ${INTERNSHIP_LIMITS.signer} ตัวอักษร`);
  for (const [label, v] of [['วันเปิดรับ', i.opensYmd], ['วันปิดรับ', i.closesYmd]] as const) if (v && !YMD.test(v)) e.push(`${label}ไม่ถูกต้อง`);
  if (i.opensYmd && i.closesYmd && i.closesYmd < i.opensYmd) e.push('วันปิดรับต้องไม่ก่อนวันเปิดรับ');
  if (i.registrationEnabled) {
    if (!i.closesYmd) e.push('เปิดรับคำร้องต้องกำหนดวันปิดรับ');
    if (i.periods.length === 0) e.push('เปิดรับคำร้องต้องมีช่วงฝึกงานให้เลือกอย่างน้อย 1 ช่วง');
    if (!i.purposeText.trim()) e.push('เปิดรับคำร้องต้องกรอกข้อความเหตุผล/วัตถุประสงค์สำหรับหนังสือ');
  }
  return e;
}

export function validateRequestForm(f: InternshipForm, periods: InternshipPeriod[]): string[] {
  const e: string[] = [];
  const need = (v: string, label: string, max: number) => {
    if (!v.trim()) e.push(`ระบุ${label}`);
    else if (v.length > max) e.push(`${label}ยาวเกิน ${max} ตัวอักษร`);
  };
  need(f.companyName, 'ชื่อสถานประกอบการ', INTERNSHIP_LIMITS.companyName);
  need(f.companyAddress, 'ที่อยู่สถานประกอบการ', INTERNSHIP_LIMITS.companyAddress);
  need(f.headName, 'ชื่อผู้บังคับบัญชา/ผู้มีอำนาจสูงสุด', INTERNSHIP_LIMITS.headName);
  need(f.headPosition, 'ตำแหน่ง', INTERNSHIP_LIMITS.headPosition);
  if (!periods.some(p => p.id === f.periodId)) e.push('เลือกช่วงวันฝึกงาน');
  return e;
}

export const periodById = (periods: InternshipPeriod[], id: string) => periods.find(p => p.id === id);

export function registrationPhase(s: Pick<InternshipSettings, 'registrationEnabled' | 'registrationOpensAt' | 'registrationClosesAt'> | null, nowMs: number): EnrollmentPhase {
  if (!s) return 'CLOSED';
  return enrollmentState({
    enrollmentStatus: s.registrationEnabled ? 'OPEN' : 'CLOSED',
    enrollmentOpensAt: s.registrationOpensAt as never,
    enrollmentClosesAt: s.registrationClosesAt as never,
  }, nowMs).phase;
}
export const canSubmitNow = (s: InternshipSettings | null, nowMs: number) => !!s && s.periods.length > 0 && registrationPhase(s, nowMs) === 'OPEN';

/** นักเรียนส่ง/แก้/ยื่นใหม่ได้เมื่อไร (ตรงกับ rules) */
export const canStudentEdit = (status: string) => status === 'SUBMITTED';
export const canStudentCancel = (status: string) => status === 'SUBMITTED';
export const canStudentResubmit = (status: string) => status === 'REJECTED' || status === 'CANCELLED';
/** งานแนะแนว: SUBMITTED → APPROVED/REJECTED; APPROVED แก้เลขที่/วันที่หนังสือได้ (ยังเป็น APPROVED) */
export const canStaffDecide = (from: string, to: string) =>
  (from === 'SUBMITTED' && (to === 'APPROVED' || to === 'REJECTED')) || (from === 'APPROVED' && to === 'APPROVED');
export const canIssueLetter = (status: string) => status === 'APPROVED';

export const MONTHS_TH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
/** '2026-10-15' → '15 ตุลาคม 2569' (พ.ศ.) — '' ถ้ารูปแบบผิด */
export function thaiDate(ymd: string): string {
  if (!YMD.test(ymd)) return '';
  const [y, m, d] = ymd.split('-').map(Number);
  return `${d} ${MONTHS_TH[m - 1]} ${y + 543}`;
}
export const thaiRange = (a: string, b: string) => (a === b ? thaiDate(a) : `${thaiDate(a)} ถึงวันที่ ${thaiDate(b)}`);

export interface LetterData {
  schoolName: string;
  req: InternshipRequest;
  settings: Pick<InternshipSettings, 'purposeText' | 'acceptanceFormText' | 'signerName' | 'signerPosition'>;
}
/** เนื้อหาหนังสือขอความอนุเคราะห์ — ช่องที่ยังไม่มีข้อมูล (เลขที่/วันที่) คืนค่าว่างให้พิมพ์เป็นเส้นประ ไม่เติมเอง */
export function buildLetter({ schoolName, req, settings }: LetterData) {
  return {
    number: req.letterNo || '',
    dateText: thaiDate(req.letterDateYmd || ''),
    subject: 'ขอความอนุเคราะห์รับนักเรียนเข้าฝึกงาน',
    to: `${req.headPosition} ${req.companyName}`.trim(),
    intro: `ด้วย${schoolName} มีความประสงค์ขอความอนุเคราะห์ให้ ${req.studentName} นักเรียนชั้น ${req.room || '-'} เข้าฝึกงาน ณ ${req.companyName} ${req.companyAddress}`,
    purpose: settings.purposeText,
    period: `ในระหว่างวันที่ ${thaiRange(req.startYmd, req.endYmd)}`,
    closing: 'จึงเรียนมาเพื่อโปรดพิจารณาให้ความอนุเคราะห์ และขอได้โปรดแจ้งผลการพิจารณาตามแบบหนังสือตอบรับที่แนบมาพร้อมนี้ จักเป็นพระคุณยิ่ง',
    signerName: settings.signerName,
    signerPosition: settings.signerPosition,
    acceptance: settings.acceptanceFormText,
  };
}

export { dayStart, dayEndExclusive, toMillis };
