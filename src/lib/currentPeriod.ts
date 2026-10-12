/**
 * หาคาบปัจจุบันจากตารางเวลาจริง (admin_periods_config) — ใช้ร่วมกับหน้า "ตารางเวลา & กระดิ่งคาบเรียน"
 * ห้ามฝังเวลา/เลขคาบไว้ในโค้ด: แอดมินแก้ตารางแล้วแถบด้านบนต้องเปลี่ยนตาม
 */
export interface PeriodConfigLike {
  periodNumber: number;
  periodName?: string;
  startTime?: string; // "HH:mm" (ว่าง = ยังไม่ตั้งเวลา)
  endTime?: string;
  periodType?: string;
}

export interface CurrentPeriodInfo {
  /** ข้อความบนแถบ เช่น "คาบ 8" หรือ "พักกลางวัน" */
  name: string;
  timeRange: string;
  isActive: boolean;
  isLunch: boolean;
  isHomeroom: boolean;
}

export function parseHHmm(v?: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((v || '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

const GENERIC_NAME = /^คาบ(เรียน)?(ที่)?\s*\d+$/;

export function periodDisplayName(p: PeriodConfigLike): string {
  const name = (p.periodName || '').trim();
  if (p.periodType === 'BREAK') return name || 'พัก';
  if (!name || GENERIC_NAME.test(name)) return `คาบ ${p.periodNumber}`;
  return `คาบ ${p.periodNumber} (${name})`;
}

/** คืน null เมื่อไม่มีคาบที่ตั้งเวลาไว้เลย (ไม่เดาแทน) */
export function findCurrentPeriod(periods: PeriodConfigLike[], now: Date): CurrentPeriodInfo | null {
  const timed = periods
    .map(p => ({ p, s: parseHHmm(p.startTime), e: parseHHmm(p.endTime) }))
    .filter((x): x is { p: PeriodConfigLike; s: number; e: number } => x.s !== null && x.e !== null && x.e > x.s)
    .sort((a, b) => a.s - b.s);
  if (timed.length === 0) return null;

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const hit = timed.find(x => nowMin >= x.s && nowMin < x.e);
  if (hit) {
    return {
      name: periodDisplayName(hit.p),
      timeRange: `${hit.p.startTime} - ${hit.p.endTime}`,
      isActive: true,
      isLunch: hit.p.periodType === 'BREAK',
      isHomeroom: hit.p.periodNumber === 0,
    };
  }
  const first = timed[0];
  const last = timed[timed.length - 1];
  if (nowMin < first.s) {
    return { name: 'ก่อนเริ่มคาบแรก', timeRange: `ก่อน ${first.p.startTime} น.`, isActive: false, isLunch: false, isHomeroom: false };
  }
  if (nowMin >= last.e) {
    return { name: 'หลังเวลาเรียน (เลิกเรียน)', timeRange: `หลัง ${last.p.endTime} น.`, isActive: false, isLunch: false, isHomeroom: false };
  }
  // ช่องว่างระหว่างคาบ (ตารางไม่ต่อเนื่อง)
  return { name: 'ช่วงพักระหว่างคาบ', timeRange: '', isActive: false, isLunch: false, isHomeroom: false };
}
