/**
 * ช่วงเวลาเปิด–ปิดรับสมัครชุมนุม + ตัวช่วยนับถอยหลัง — ตรรกะล้วน (test ได้)
 * ต้องตรงกับ firestore.rules (`activityEnrollmentOpen`): enrollmentStatus == 'OPEN' และ
 *   (ไม่มี enrollmentOpensAt หรือ now ≥ opensAt) และ (ไม่มี enrollmentClosesAt หรือ now < closesAt)
 */
export type EnrollmentPhase = 'NOT_YET' | 'OPEN' | 'CLOSED';

type TimeLike = { toMillis: () => number } | Date | number | string | null | undefined;

export function toMillis(v: TimeLike): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (v instanceof Date) { const n = v.getTime(); return Number.isNaN(n) ? null : n; }
  if (typeof v === 'string') { const n = Date.parse(v); return Number.isNaN(n) ? null : n; }
  if (typeof (v as any).toMillis === 'function') { const n = (v as any).toMillis(); return Number.isFinite(n) ? n : null; }
  return null;
}

export interface EnrollmentWindowInput {
  enrollmentStatus?: 'OPEN' | 'CLOSED' | null;
  enrollmentOpensAt?: TimeLike;
  enrollmentClosesAt?: TimeLike;
}

export interface EnrollmentState {
  phase: EnrollmentPhase;
  opensAtMs: number | null;
  closesAtMs: number | null;
  /** เวลาเป้าหมายของตัวนับถอยหลัง: NOT_YET → เวลาเปิด, OPEN ที่มีเวลาปิด → เวลาปิด, อื่น ๆ = null */
  deadlineMs: number | null;
  deadlineKind: 'OPENS' | 'CLOSES' | null;
}

export function enrollmentState(cfg: EnrollmentWindowInput, nowMs: number): EnrollmentState {
  const opensAtMs = toMillis(cfg.enrollmentOpensAt);
  const closesAtMs = toMillis(cfg.enrollmentClosesAt);
  const base = { opensAtMs, closesAtMs };
  if ((cfg.enrollmentStatus ?? 'OPEN') === 'CLOSED') return { ...base, phase: 'CLOSED', deadlineMs: null, deadlineKind: null };
  if (opensAtMs !== null && nowMs < opensAtMs) return { ...base, phase: 'NOT_YET', deadlineMs: opensAtMs, deadlineKind: 'OPENS' };
  if (closesAtMs !== null && nowMs >= closesAtMs) return { ...base, phase: 'CLOSED', deadlineMs: null, deadlineKind: null };
  return { ...base, phase: 'OPEN', deadlineMs: closesAtMs, deadlineKind: closesAtMs !== null ? 'CLOSES' : null };
}

/** ปิดรับแล้ว (สั่งปิด หรือเลยเวลาปิด) — ชุมนุมที่ปิดแล้วเข้าตารางสอนครู */
export const isEnrollmentClosed = (cfg: EnrollmentWindowInput, nowMs: number) => enrollmentState(cfg, nowMs).phase === 'CLOSED';
export const isEnrollmentOpenNow = (cfg: EnrollmentWindowInput, nowMs: number) => enrollmentState(cfg, nowMs).phase === 'OPEN';

export type Urgency = 'NORMAL' | 'SOON' | 'URGENT' | 'EXPIRED';

export function countdownUrgency(remainingMs: number): Urgency {
  if (remainingMs <= 0) return 'EXPIRED';
  if (remainingMs <= 3_600_000) return 'URGENT';      // ≤ 1 ชั่วโมง
  if (remainingMs <= 86_400_000) return 'SOON';       // ≤ 24 ชั่วโมง
  return 'NORMAL';
}

/** "2 วัน 3 ชม." / "3 ชม. 12 นาที" / "12 นาที 05 วิ" / "ครบกำหนดแล้ว" */
export function formatCountdown(remainingMs: number): string {
  if (remainingMs <= 0) return 'ครบกำหนดแล้ว';
  const totalSec = Math.floor(remainingMs / 1000);
  const d = Math.floor(totalSec / 86_400);
  const h = Math.floor((totalSec % 86_400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (d > 0) return `${d} วัน ${h} ชม.`;
  if (h > 0) return `${h} ชม. ${m} นาที`;
  return `${m} นาที ${String(s).padStart(2, '0')} วิ`;
}

/** ตรวจช่วงเวลาที่แอดมิน/ครูกรอก (ค่าว่างได้ทั้งคู่) — คืนข้อความผิดพลาด หรือ null */
export function validateEnrollmentWindow(opensAtMs: number | null, closesAtMs: number | null): string | null {
  if (opensAtMs !== null && closesAtMs !== null && closesAtMs <= opensAtMs) return 'เวลาปิดรับสมัครต้องหลังเวลาเปิดรับสมัคร';
  return null;
}

/** รวมวัน (YYYY-MM-DD) + เวลา (HH:mm) ตามเวลาท้องถิ่นของเครื่อง → ms; วันว่าง = null; เวลาว่าง = defaultTime */
export function composeLocalMillis(ymd: string, hhmm: string, defaultTime = '00:00'): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd || '')) return null;
  const time = /^\d{2}:\d{2}$/.test(hhmm || '') ? hhmm : defaultTime;
  const [y, mo, d] = ymd.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const dt = new Date(y, mo - 1, d, h, mi, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt.getTime();
}

export function splitLocalMillis(ms: number | null): { ymd: string; hhmm: string } {
  if (ms === null) return { ymd: '', hhmm: '' };
  const dt = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return { ymd: `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`, hhmm: `${p(dt.getHours())}:${p(dt.getMinutes())}` };
}

/** ข้อความช่วงเวลาไทยสั้น ๆ เช่น "14 ต.ค. 2569 16:30" */
export function formatThaiDateTime(ms: number): string {
  const dt = new Date(ms);
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const p = (n: number) => String(n).padStart(2, '0');
  return `${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear() + 543} ${p(dt.getHours())}:${p(dt.getMinutes())}`;
}
