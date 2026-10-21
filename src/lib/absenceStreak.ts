/**
 * ขาดเรียนต่อเนื่อง (ตรรกะบริสุทธิ์) — คำนวณจากบันทึกเช็คชื่อโฮมรูมรายวัน (`attendance_records` ที่ source = HOMEROOM_DEFAULT)
 * สำเนาของตรรกะนี้อยู่ที่ functions/src/absenceStreakLogic.ts (แก้ต้องแก้ทั้งคู่ — มี test เทียบ)
 *
 * นิยาม (ค่าเริ่มต้น ยืนยันกับงานกิจการ/โรงเรียนได้ — เกณฑ์ปรับที่ `absence_settings/thresholds`):
 * - นับเฉพาะ "วันที่ครูเช็คโฮมรูมแล้ว" ของห้องนั้น; วันที่ไม่มีเอกสาร (หยุด/ยังไม่เช็ค) = ข้าม ไม่นับว่ามา/ขาด และไม่ตัดสาย
 * - สายขาดเรียนต่อเนื่อง = ABSENT ติดกันนับย้อนจากวันที่เช็คล่าสุด; PRESENT/LATE/LEAVE ตัดสาย (ลา ≠ ขาด)
 * - นักเรียนที่ไม่อยู่ในเอกสารวันนั้น = ข้ามวัน (ไม่ตัดสาย)
 * - ระบบไม่ส่งข้อความหาผู้ปกครองเอง — ครูกดบันทึกผลการติดตาม (absence_followups)
 */
export interface AbsenceThresholds {
  /** ครูที่ปรึกษา เริ่มเห็น/ติดตาม (ค่าเริ่มต้น 3 วัน) */
  watchDays: number;
  /** + งานกิจการนักเรียน + ครูแนะแนว (ค่าเริ่มต้น 5 วัน ≈ ทั้งสัปดาห์) */
  weekDays: number;
  /** + ผู้บริหาร/รองผู้อำนวยการ พิจารณาตามระเบียบ (ค่าเริ่มต้น 10 วัน) */
  severeDays: number;
}

export const DEFAULT_ABSENCE_THRESHOLDS: AbsenceThresholds = { watchDays: 3, weekDays: 5, severeDays: 10 };
export const MAX_ABSENCE_THRESHOLD_DAYS = 60;

/** 0 = ปกติ, 1 = ติดตาม (ครูที่ปรึกษา), 2 = ขาดทั้งสัปดาห์ (+กิจการ/แนะแนว), 3 = ขาดนาน (+ผู้บริหาร) */
export type AbsenceLevel = 0 | 1 | 2 | 3;

export function validateThresholds(t: AbsenceThresholds): string | null {
  const vals = [t.watchDays, t.weekDays, t.severeDays];
  if (!vals.every(v => Number.isInteger(v) && v >= 1 && v <= MAX_ABSENCE_THRESHOLD_DAYS)) return `จำนวนวันต้องเป็นเลขจำนวนเต็ม 1–${MAX_ABSENCE_THRESHOLD_DAYS}`;
  if (!(t.watchDays < t.weekDays && t.weekDays < t.severeDays)) return 'ต้องเรียงจากน้อยไปมาก: ติดตาม < ทั้งสัปดาห์ < ขาดนาน';
  return null;
}

/** ค่าที่อ่านจากเอกสาร (ทีละ field; ผิดรูปแบบ/ไม่ผ่านการตรวจ = ค่าเริ่มต้นทั้งชุด ไม่เดา) */
export function normalizeThresholds(raw: unknown): AbsenceThresholds {
  const r = (raw || {}) as Partial<AbsenceThresholds>;
  const t = { watchDays: Number(r.watchDays), weekDays: Number(r.weekDays), severeDays: Number(r.severeDays) };
  return validateThresholds(t) === null ? t : { ...DEFAULT_ABSENCE_THRESHOLDS };
}

export function absenceLevel(streak: number, t: AbsenceThresholds): AbsenceLevel {
  if (streak >= t.severeDays) return 3;
  if (streak >= t.weekDays) return 2;
  if (streak >= t.watchDays) return 1;
  return 0;
}

export type AbsenceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'LEAVE';
export interface HomeroomDayLite { date: string; room: string; students: Record<string, AbsenceStatus | string> }

export interface StudentStreak {
  studentId: string;
  room: string;
  streakDays: number;
  /** วันแรกของสายขาด (YYYY-MM-DD) */
  sinceDate: string;
  /** วันล่าสุดที่เช็คโฮมรูมแล้ว */
  lastCheckedDate: string;
}

/**
 * days = เอกสารโฮมรูมของ "ห้องเดียว" (ลำดับใดก็ได้) → สายขาดเรียนต่อเนื่องของนักเรียนที่ขาดอยู่ ณ วันที่เช็คล่าสุด
 * คืนเฉพาะ streakDays ≥ 1
 */
export function computeRoomStreaks(days: HomeroomDayLite[]): StudentStreak[] {
  const sorted = [...days].filter(d => d?.date && d.students).sort((a, b) => b.date.localeCompare(a.date)); // ใหม่ → เก่า
  if (sorted.length === 0) return [];
  const room = sorted[0].room;
  const ids = new Set<string>();
  for (const d of sorted) for (const id of Object.keys(d.students)) ids.add(id);
  const out: StudentStreak[] = [];
  for (const studentId of ids) {
    let streak = 0, since = '';
    let started = false;
    for (const d of sorted) {
      const st = d.students[studentId];
      if (st === undefined || st === null) continue; // ไม่อยู่ในเอกสารวันนั้น = ข้ามวัน
      if (!started && st !== 'ABSENT') break;        // วันล่าสุดที่มีข้อมูลไม่ใช่ขาด = ไม่มีสาย
      if (st === 'ABSENT') { streak += 1; since = d.date; started = true; continue; }
      break; // PRESENT/LATE/LEAVE ตัดสาย
    }
    if (streak >= 1) out.push({ studentId, room, streakDays: streak, sinceDate: since, lastCheckedDate: sorted[0].date });
  }
  return out.sort((a, b) => b.streakDays - a.streakDays);
}

/** ใครควรเห็นตามระดับ (ใช้อธิบายในหน้าจอ) */
export const ABSENCE_LEVEL_AUDIENCE: Record<Exclude<AbsenceLevel, 0>, { label: string; audience: string; action: string }> = {
  1: { label: 'ติดตาม', audience: 'ครูที่ปรึกษา', action: 'ติดต่อผู้ปกครอง/นักเรียนเพื่อสอบถามสาเหตุ และบันทึกผลการติดตาม' },
  2: { label: 'ขาดทั้งสัปดาห์', audience: 'ครูที่ปรึกษา + งานกิจการนักเรียน + ครูแนะแนว', action: 'ร่วมกันติดตาม พิจารณาเยี่ยมบ้าน/ให้คำปรึกษา และประสานผู้ปกครอง' },
  3: { label: 'ขาดนาน', audience: 'ครูที่ปรึกษา + งานกิจการ + แนะแนว + ผู้บริหาร', action: 'เสนอผู้บริหารพิจารณาดำเนินการตามระเบียบของโรงเรียน/ต้นสังกัด' },
};

export const FOLLOWUP_ACTIONS = ['CALLED_PARENT', 'CALLED_STUDENT', 'HOME_VISIT', 'REFERRED_COUNSELOR', 'REFERRED_AFFAIRS', 'RETURNED', 'OTHER'] as const;
export type FollowupAction = (typeof FOLLOWUP_ACTIONS)[number];
export const FOLLOWUP_LABEL: Record<FollowupAction, string> = {
  CALLED_PARENT: 'โทร/ติดต่อผู้ปกครองแล้ว', CALLED_STUDENT: 'ติดต่อนักเรียนแล้ว', HOME_VISIT: 'เยี่ยมบ้านแล้ว',
  REFERRED_COUNSELOR: 'ส่งต่อครูแนะแนว', REFERRED_AFFAIRS: 'ส่งต่องานกิจการนักเรียน', RETURNED: 'นักเรียนกลับมาเรียนแล้ว', OTHER: 'อื่น ๆ (ระบุในหมายเหตุ)',
};
