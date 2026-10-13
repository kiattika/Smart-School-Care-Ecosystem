/**
 * บันทึกสุขภาพที่พยาบาลกรอกจริง: ตรวจสายตา/การได้ยินประจำปี, ประวัติวัคซีน, ประวัติบริจาคโลหิต
 * (ตรรกะบริสุทธิ์ ใช้ร่วมกัน UI/เทสต์ — ต้องตรงกับ firestore.rules บล็อก 36-38)
 * ห้ามมีค่าตัวอย่างฝังในโค้ด — ไม่มีข้อมูล = แสดง empty state
 */
export type ScreenResult = 'NORMAL' | 'ABNORMAL' | 'NOT_TESTED';
export const SCREEN_RESULT_LABEL: Record<ScreenResult, string> = {
  NORMAL: 'ปกติ',
  ABNORMAL: 'ผิดปกติ (ควรพบแพทย์/ติดตาม)',
  NOT_TESTED: 'ยังไม่ได้ตรวจ',
};

export interface StudentCheckup {
  studentId: string;
  academicYear: string;
  examDate: string; // YYYY-MM-DD
  visionLeft?: string;
  visionRight?: string;
  visionResult: ScreenResult;
  hearingResult: ScreenResult;
  note?: string;
  recordedByUid: string;
  recordedByName: string;
  recordedAt?: unknown;
}

export interface StudentVaccination {
  id: string;
  studentId: string;
  vaccine: string;
  doseDate: string; // YYYY-MM-DD
  place?: string;
  note?: string;
  recordedByUid: string;
  recordedByName: string;
  recordedAt?: unknown;
}

export interface BloodDonation {
  id: string;
  subjectType: 'STUDENT' | 'STAFF';
  studentId?: string;
  staffId?: string;
  donorName: string;
  donatedAt: string; // YYYY-MM-DD
  place?: string;
  note?: string;
  recordedByUid: string;
  recordedByName: string;
  recordedAt?: unknown;
}

export const checkupDocId = (studentId: string, academicYear: string) => `${studentId}_${academicYear}`;

export function isYmd(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

const RESULTS: ScreenResult[] = ['NORMAL', 'ABNORMAL', 'NOT_TESTED'];

export function validateCheckup(c: Pick<StudentCheckup, 'studentId' | 'academicYear' | 'examDate' | 'visionLeft' | 'visionRight' | 'visionResult' | 'hearingResult' | 'note'>): string | null {
  if (!c.studentId) return 'ยังไม่ได้เลือกนักเรียน';
  if (!/^\d{4}$/.test(c.academicYear || '')) return 'ปีการศึกษาไม่ถูกต้อง';
  if (!isYmd(c.examDate)) return 'กรุณาเลือกวันที่ตรวจ';
  if (!RESULTS.includes(c.visionResult) || !RESULTS.includes(c.hearingResult)) return 'กรุณาเลือกผลตรวจสายตาและการได้ยิน';
  if ((c.visionLeft || '').length > 12 || (c.visionRight || '').length > 12) return 'ค่าสายตาต้องไม่เกิน 12 ตัวอักษร (เช่น 20/20)';
  if ((c.note || '').length > 300) return 'หมายเหตุยาวเกิน 300 ตัวอักษร';
  return null;
}

export function validateVaccination(v: Pick<StudentVaccination, 'studentId' | 'vaccine' | 'doseDate' | 'place' | 'note'>): string | null {
  if (!v.studentId) return 'ยังไม่ได้เลือกนักเรียน';
  const name = (v.vaccine || '').trim();
  if (!name) return 'กรุณาระบุชื่อวัคซีน';
  if (name.length > 80) return 'ชื่อวัคซีนยาวเกิน 80 ตัวอักษร';
  if (!isYmd(v.doseDate)) return 'กรุณาเลือกวันที่ได้รับวัคซีน';
  if ((v.place || '').length > 80) return 'สถานที่ยาวเกิน 80 ตัวอักษร';
  if ((v.note || '').length > 200) return 'หมายเหตุยาวเกิน 200 ตัวอักษร';
  return null;
}

export function validateDonation(d: Pick<BloodDonation, 'subjectType' | 'studentId' | 'staffId' | 'donorName' | 'donatedAt' | 'place' | 'note'>): string | null {
  if (d.subjectType === 'STUDENT' && !d.studentId) return 'ยังไม่ได้เลือกนักเรียน';
  if (d.subjectType === 'STAFF' && !d.staffId) return 'ยังไม่ได้เลือกบุคลากร';
  if (!(d.donorName || '').trim()) return 'ไม่พบชื่อผู้บริจาค';
  if (!isYmd(d.donatedAt)) return 'กรุณาเลือกวันที่บริจาค';
  if ((d.place || '').length > 80) return 'สถานที่ยาวเกิน 80 ตัวอักษร';
  if ((d.note || '').length > 200) return 'หมายเหตุยาวเกิน 200 ตัวอักษร';
  return null;
}

/** ผลตรวจล่าสุด (ตามปีการศึกษามากสุดก่อน แล้ววันที่ตรวจ) — ไม่มี = null */
export function latestCheckup<T extends { academicYear: string; examDate: string }>(list: T[]): T | null {
  if (list.length === 0) return null;
  return [...list].sort((a, b) => (b.academicYear + b.examDate).localeCompare(a.academicYear + a.examDate))[0];
}

/** เรียงใหม่→เก่าตามวันที่ที่ระบุ */
export function sortByDateDesc<T>(list: T[], key: (x: T) => string): T[] {
  return [...list].sort((a, b) => key(b).localeCompare(key(a)));
}

/** ชื่อวัคซีนที่พบบ่อย — เป็นคำแนะนำให้เลือก/พิมพ์เองได้ ไม่ใช่ข้อมูลของใคร */
export const COMMON_VACCINE_SUGGESTIONS = ['HPV', 'dT (คอตีบ-บาดทะยัก)', 'MMR (หัด-คางทูม-หัดเยอรมัน)', 'JE (ไข้สมองอักเสบ)', 'ตับอักเสบบี', 'ไข้หวัดใหญ่', 'โควิด-19'];
