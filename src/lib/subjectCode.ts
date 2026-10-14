/**
 * รหัสวิชา: อักษรตัวแรกบอกกลุ่มสาระฯ/ภาษา — ใช้จัดประเภทวิชาและคำนวณหน่วยกิต
 * - ก = กิจกรรมพัฒนาผู้เรียน (ประเมิน ผ/มผ ไม่มีหน่วยกิต)
 * - รหัสที่ไม่ขึ้นต้นด้วยอักษรกลุ่มสาระฯ (เช่น HR, CZ) = รหัสเฉพาะกิจของโรงเรียน: ไม่มีหน่วยกิต ไม่ตัดสินผล
 *   ไม่แสดงใน ปพ.6 และไม่ต้องส่งแผน/โครงการสอน
 */
export const SUBJECT_LETTER_GROUPS: Readonly<Record<string, string>> = {
  'ท': 'ภาษาไทย', 'ค': 'คณิตศาสตร์', 'ว': 'วิทยาศาสตร์และเทคโนโลยี',
  'ส': 'สังคมศึกษา ศาสนา และวัฒนธรรม', 'พ': 'สุขศึกษาและพลศึกษา', 'ศ': 'ศิลปะ',
  'ง': 'การงานอาชีพ', 'อ': 'ภาษาอังกฤษ',
  'จ': 'ภาษาจีน', 'ญ': 'ภาษาญี่ปุ่น', 'ฝ': 'ภาษาฝรั่งเศส', 'ย': 'ภาษาเยอรมัน', 'ป': 'ภาษาสเปน',
  'ร': 'ภาษาอาหรับ', 'ล': 'ภาษาลาว', 'ฮ': 'ภาษาฮินดู', 'ข': 'ภาษาเขมร', 'ซ': 'ภาษารัสเซีย',
  'ต': 'ภาษาเวียดนาม', 'น': 'ภาษาลาติน', 'บ': 'ภาษาบาลี', 'ม': 'ภาษามาลายู',
};
/** ก ชนกับภาษาเกาหลีในตารางอักษรย่อ — ตามที่โรงเรียนกำหนด ขึ้นต้นด้วย ก = กิจกรรมพัฒนาผู้เรียนเสมอ */
export const ACTIVITY_LETTER = 'ก';

const firstChar = (code: string) => (code || '').trim().charAt(0);

export function isActivityCode(code: string): boolean { return firstChar(code) === ACTIVITY_LETTER; }

/** รหัสเฉพาะกิจของโรงเรียน (HR, CZ ฯลฯ) = ไม่ใช่ ก และไม่ใช่อักษรกลุ่มสาระฯ; รหัสว่างไม่ถือว่าเฉพาะกิจ (ไม่รู้) */
export function isSchoolSpecificCode(code: string): boolean {
  const c = firstChar(code);
  return c !== '' && c !== ACTIVITY_LETTER && !(c in SUBJECT_LETTER_GROUPS);
}

export function subjectGroupOf(code: string): string | null {
  const c = firstChar(code);
  if (c === ACTIVITY_LETTER) return 'กิจกรรมพัฒนาผู้เรียน';
  return SUBJECT_LETTER_GROUPS[c] ?? null;
}

/** 1 คาบ(ชั่วโมง)/สัปดาห์ = 0.5 หน่วยกิต */
export function creditsFromPeriods(periodsPerWeek: number | null | undefined): number | null {
  return typeof periodsPerWeek === 'number' && Number.isFinite(periodsPerWeek) && periodsPerWeek > 0 ? periodsPerWeek * 0.5 : null;
}

/**
 * หน่วยกิตที่ใช้จริง: วิชากิจกรรม (ก)/รหัสเฉพาะกิจ = null (ไม่มี); วิชาปกติ = คำนวณจากคาบรวม/สัปดาห์
 * ถ้ารู้จำนวนคาบ; ไม่รู้ → ใช้ค่าที่เก็บไว้ (ถ้ามี); ไม่มีเลย = null (ห้ามเดา)
 */
export function effectiveCredits(input: { code: string; subjectType?: string; periodsPerWeek?: number | null; stored?: number | null }): number | null {
  if (isActivityCode(input.code) || isSchoolSpecificCode(input.code) || input.subjectType === 'ACTIVITY') return null;
  const calc = creditsFromPeriods(input.periodsPerWeek);
  if (calc !== null) return calc;
  return typeof input.stored === 'number' && Number.isFinite(input.stored) && input.stored > 0 ? input.stored : null;
}

/** นับคาบ/สัปดาห์ของรหัสวิชาหนึ่งในห้องหนึ่ง จากแถวตารางสอน (1 แถว = 1 คาบ; ซ้ำวัน+คาบเดียวกันนับครั้งเดียว) */
export function countPeriodsPerWeek(slots: ReadonlyArray<{ dayOfWeek?: unknown; periodNumber?: unknown; schedule?: unknown }>): number {
  const set = new Set<string>();
  for (const s of slots) {
    const k = s.dayOfWeek != null && s.periodNumber != null ? `${String(s.dayOfWeek).toLowerCase()}#${s.periodNumber}` : s.schedule ? String(s.schedule) : '';
    if (k) set.add(k);
  }
  return set.size;
}

/** หน่วยกิตที่เขียนลง schedules ตอนนำเข้า: คำนวณจากคาบ/สัปดาห์ของแถวนั้น; ไม่มีหน่วยกิต (ก/เฉพาะกิจ) = 0 — ห้ามใช้ค่าเดาเดิม 1.5 */
export function importCredits(code: string, subjectType: string | undefined, slots: ReadonlyArray<{ dayOfWeek?: unknown; periodNumber?: unknown }>): number {
  return effectiveCredits({ code, subjectType, periodsPerWeek: countPeriodsPerWeek(slots) }) ?? 0;
}
