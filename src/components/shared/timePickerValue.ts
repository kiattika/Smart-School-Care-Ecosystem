/**
 * ค่าของ TimePicker (24 ชั่วโมง) — pure functions ทดสอบได้ (src/__tests__/timePicker.test.ts)
 * ค่าที่เก็บ/ส่งออกเป็น 'HH:mm' เหมือน <input type="time"> เดิม, '' = ยังไม่เลือก
 */

export const HOURS: string[] = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));

export interface TimeParts {
  hour: string;   // '00'-'23' หรือ '' (ยังไม่เลือก)
  minute: string; // '00'-'59' หรือ '' (ยังไม่เลือก)
}

/** 'HH:mm' (รับ 'H:mm' ด้วย) → ส่วนชั่วโมง/นาที; ค่าว่างหรือไม่ถูกต้อง → ทั้งคู่ว่าง */
export function parseTimeValue(value: string | null | undefined): TimeParts {
  const m = /^(\d{1,2}):(\d{2})$/.exec((value ?? '').trim());
  if (!m) return { hour: '', minute: '' };
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return { hour: '', minute: '' };
  return { hour: String(h).padStart(2, '0'), minute: String(min).padStart(2, '0') };
}

/** ส่วนชั่วโมง/นาที → 'HH:mm'; ส่วนใดส่วนหนึ่งว่าง → '' (ยังไม่ครบ = ยังไม่มีค่า) */
export function composeTimeValue(parts: TimeParts): string {
  if (!parts.hour || !parts.minute) return '';
  return `${parts.hour}:${parts.minute}`;
}

/** ตัวเลือกนาทีตาม step (ค่าเริ่มต้น 1 นาที) — รวมนาทีปัจจุบันเสมอแม้ไม่ตรง step (ค่าเดิมต้องไม่หาย) */
export function minuteOptions(step = 1, current = ''): string[] {
  const s = Number.isInteger(step) && step >= 1 && step <= 30 ? step : 1;
  const opts = new Set<string>();
  for (let m = 0; m < 60; m += s) opts.add(String(m).padStart(2, '0'));
  if (current) opts.add(current);
  return Array.from(opts).sort();
}
