/**
 * เวลาที่เชื่อถือได้สำหรับการเช็คอิน — ไม่เชื่อนาฬิกา/เขตเวลาของเครื่องผู้ใช้
 *
 * เว็บไม่มีทางรู้เวลาจริงโดยไม่ถามเซิร์ฟเวอร์: ปรับเวลาเครื่องย้อนกลับก็หลบ "สาย" ได้
 * จึงอ่านเวลาจาก header `Date` ของ origin เดียวกัน (Firebase Hosting/Vite ส่งให้ทุก response, ความละเอียด 1 วินาที)
 * แล้วหา offset เทียบเวลาเครื่อง ส่วนวัน/เวลา/ชั่วโมงใช้เขตเวลา Asia/Bangkok เสมอ (ไม่ขึ้นกับเขตเวลาของเครื่อง)
 *
 * อ่านไม่ได้ (ออฟไลน์/ถูกบล็อก) = ใช้เวลาเครื่อง และบันทึก clockSource = 'DEVICE' ให้ครูเห็นว่ายืนยันไม่ได้
 */

export const SCHOOL_TIME_ZONE = 'Asia/Bangkok';

export interface TrustedNow {
  /** เวลาที่เชื่อถือได้ (เซิร์ฟเวอร์ถ้าได้, ไม่ได้ = เวลาเครื่อง) */
  now: Date;
  source: 'SERVER' | 'DEVICE';
  /** เวลาเครื่อง − เวลาเซิร์ฟเวอร์ (วินาที, เครื่องเร็ว = บวก); 0 เมื่อ source = DEVICE */
  skewSeconds: number;
}

/** offset = เวลาเซิร์ฟเวอร์ − เวลาเครื่อง (ms) จาก header Date; ใช้กึ่งกลางของช่วงรอรับเพื่อลดความคลาด */
export function offsetFromDateHeader(dateHeader: string | null | undefined, sentAtMs: number, receivedAtMs: number): number | null {
  if (!dateHeader) return null;
  const serverMs = Date.parse(dateHeader);
  if (Number.isNaN(serverMs)) return null;
  // header Date ตัดเศษวินาทีทิ้ง → บวกครึ่งวินาทีเพื่อให้ค่าเฉลี่ยใกล้จริง
  return serverMs + 500 - Math.round((sentAtMs + receivedAtMs) / 2);
}

export function buildTrustedNow(deviceNow: Date, offsetMs: number | null): TrustedNow {
  if (offsetMs === null) return { now: deviceNow, source: 'DEVICE', skewSeconds: 0 };
  return {
    now: new Date(deviceNow.getTime() + offsetMs),
    source: 'SERVER',
    skewSeconds: Math.round(-offsetMs / 1000),
  };
}

/** ถามเวลาจากเซิร์ฟเวอร์ (timeout สั้น ไม่ throw) */
export async function getTrustedNow(timeoutMs = 4000): Promise<TrustedNow> {
  const deviceNow = new Date();
  try {
    if (typeof fetch !== 'function' || typeof window === 'undefined') return buildTrustedNow(deviceNow, null);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const sentAt = Date.now();
    const res = await fetch(`${window.location.origin}/?_t=${sentAt}`, { method: 'HEAD', cache: 'no-store', signal: ctrl.signal });
    clearTimeout(timer);
    const off = offsetFromDateHeader(res.headers.get('date'), sentAt, Date.now());
    return buildTrustedNow(new Date(), off);
  } catch {
    return buildTrustedNow(deviceNow, null);
  }
}

export interface SchoolClockParts { ymd: string; hour: number; minute: number; label: string }

/** วัน/เวลาตามเขตเวลาโรงเรียน (Asia/Bangkok) — label = "HH:MM น." */
export function schoolClockParts(date: Date): SchoolClockParts {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: SCHOOL_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const get = (t: string) => parts.find(p => p.type === t)?.value || '00';
  const hour = Number(get('hour')) % 24;
  const minute = Number(get('minute'));
  return {
    ymd: `${get('year')}-${get('month')}-${get('day')}`,
    hour, minute,
    label: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} น.`,
  };
}
