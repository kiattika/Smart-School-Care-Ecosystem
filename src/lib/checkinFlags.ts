import type { GPSCheckInLog } from '../types';
import { calculateHaversineDistance } from '../utils/geoUtils';

/**
 * ธงเตือน "ควรตรวจสอบ" ของการเช็คอิน GPS — เป็นสัญญาณช่วยครู ไม่ใช่การตัดสินว่าปลอม
 * (เว็บตรวจ mock location โดยตรงไม่ได้ จึงมองหารูปแบบที่ GPS จริงแทบไม่ทำ)
 *
 * ข้อควรระวังเรื่อง false positive: พิกัดจาก Wi-Fi/เสาสัญญาณมักซ้ำกันเป๊ะและมี accuracy ใหญ่ (>~20 ม.)
 * ดังนั้นธง "พิกัดซ้ำ" ใช้เฉพาะรายการที่อ้างว่าแม่นยำสูง (accuracy ≤ HIGH_PRECISION_MAX_M)
 */

export type CheckInFlagCode =
  | 'ACCURACY_TOO_PERFECT' | 'NO_ACCURACY' | 'SAME_SPOT_REPEAT' | 'SHARED_SPOT'
  | 'IMPOSSIBLE_JUMP' | 'CLOCK_SKEW' | 'CLOCK_MISMATCH' | 'DEVICE_CLOCK';

export interface CheckInFlag { code: CheckInFlagCode; label: string }

/** เกณฑ์ — ปรับที่เดียว */
export const FLAG_THRESHOLDS = {
  perfectAccuracyMaxM: 1,        // accuracy ≤ 1 ม. = สะอาดเกินจริง (GPS มือถือจริงมักหลายเมตร)
  highPrecisionMaxM: 15,         // ธงพิกัดซ้ำใช้เฉพาะรายการที่อ้างว่าแม่นกว่านี้
  repeatDays: 2,                 // พิกัดเดิม (6 ตำแหน่ง ≈ 0.1 ม.) ในอีก ≥ 2 วันอื่น
  sharedUsers: 2,                // พิกัดเดิมของคนต่างกัน ≥ 2 คนในวันเดียวกัน
  jumpMinMeters: 300,
  jumpMaxSpeedMps: 55,           // ≈ 200 กม./ชม.
  skewMaxSeconds: 300,           // เวลาเครื่องคลาดจากเซิร์ฟเวอร์เกิน 5 นาที
  mismatchMaxMinutes: 10,        // เวลาที่อ้างกับเวลาเซิร์ฟเวอร์ที่บันทึกต่างกันเกิน 10 นาที
} as const;

const LABELS: Record<CheckInFlagCode, string> = {
  ACCURACY_TOO_PERFECT: 'ค่าความแม่นยำสะอาดผิดปกติ (≤ 1 ม.)',
  NO_ACCURACY: 'ไม่มีค่าความแม่นยำของ GPS',
  SAME_SPOT_REPEAT: 'พิกัดซ้ำเป๊ะกับวันอื่น (GPS จริงมักคลาดเล็กน้อย)',
  SHARED_SPOT: 'พิกัดซ้ำเป๊ะกับนักเรียนคนอื่นในวันเดียวกัน',
  IMPOSSIBLE_JUMP: 'พิกัดกระโดดเร็วเกินจริงจากรายการก่อนหน้า',
  CLOCK_SKEW: 'นาฬิกาเครื่องคลาดจากเซิร์ฟเวอร์เกิน 5 นาที',
  CLOCK_MISMATCH: 'เวลาที่แจ้งไม่ตรงกับเวลาเซิร์ฟเวอร์ที่บันทึก',
  DEVICE_CLOCK: 'ยืนยันเวลากับเซิร์ฟเวอร์ไม่ได้ (ใช้เวลาเครื่อง)',
};

const spotKey = (l: Pick<GPSCheckInLog, 'latitude' | 'longitude'>) => `${l.latitude.toFixed(6)},${l.longitude.toFixed(6)}`;

/** เวลาของ log เป็น ms — เวลาเซิร์ฟเวอร์ก่อน, ไม่มีก็ประกอบจาก date + "HH:MM น." (เขตเวลาไทย) */
export function logTimeMs(l: GPSCheckInLog): number | null {
  if (typeof l.serverTimeMs === 'number') return l.serverTimeMs;
  return claimedTimeMs(l);
}

function claimedTimeMs(l: GPSCheckInLog): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(l.timestamp || '');
  if (!m || !/^\d{4}-\d{2}-\d{2}$/.test(l.date || '')) return null;
  const ms = Date.parse(`${l.date}T${m[1].padStart(2, '0')}:${m[2]}:00+07:00`);
  return Number.isNaN(ms) ? null : ms;
}

const isHighPrecision = (l: GPSCheckInLog) =>
  typeof l.accuracyMeters === 'number' && l.accuracyMeters > 0 && l.accuracyMeters <= FLAG_THRESHOLDS.highPrecisionMaxM;

/** คืน Map<logId, ธง[]> เฉพาะ log ที่มีธง — ส่ง log ทั้งช่วง (หลายวัน/หลายคน) เพื่อให้เทียบข้ามวัน/ข้ามคนได้ */
export function flagCheckIns(logs: GPSCheckInLog[]): Map<string, CheckInFlag[]> {
  const out = new Map<string, CheckInFlag[]>();
  const add = (id: string, code: CheckInFlagCode) => {
    const list = out.get(id) || [];
    if (!list.some(f => f.code === code)) list.push({ code, label: LABELS[code] });
    out.set(id, list);
  };

  const bySpot = new Map<string, GPSCheckInLog[]>();
  const byUser = new Map<string, GPSCheckInLog[]>();
  for (const l of logs) {
    if (isHighPrecision(l)) {
      const k = spotKey(l);
      bySpot.set(k, [...(bySpot.get(k) || []), l]);
    }
    byUser.set(l.userId, [...(byUser.get(l.userId) || []), l]);
  }

  for (const l of logs) {
    // 1) ความแม่นยำ
    if (typeof l.accuracyMeters === 'number' && l.accuracyMeters > 0 && l.accuracyMeters <= FLAG_THRESHOLDS.perfectAccuracyMaxM) add(l.id, 'ACCURACY_TOO_PERFECT');
    if (l.accuracyMeters === undefined || l.accuracyMeters === null || l.accuracyMeters === 0) add(l.id, 'NO_ACCURACY');

    // 2) เวลา
    if (l.clockSource === 'DEVICE') add(l.id, 'DEVICE_CLOCK');
    if (typeof l.clockSkewSeconds === 'number' && Math.abs(l.clockSkewSeconds) > FLAG_THRESHOLDS.skewMaxSeconds) add(l.id, 'CLOCK_SKEW');
    const claimed = claimedTimeMs(l);
    if (typeof l.serverTimeMs === 'number' && claimed !== null
      && Math.abs(l.serverTimeMs - claimed) > FLAG_THRESHOLDS.mismatchMaxMinutes * 60_000) add(l.id, 'CLOCK_MISMATCH');
  }

  // 3) พิกัดซ้ำ — เฉพาะรายการที่อ้างว่าแม่นยำสูง
  bySpot.forEach(group => {
    const dates = new Set(group.map(g => g.date));
    const users = new Set(group.map(g => g.userId));
    for (const l of group) {
      const otherDaysSameUser = new Set(group.filter(g => g.userId === l.userId && g.date !== l.date).map(g => g.date));
      if (otherDaysSameUser.size >= FLAG_THRESHOLDS.repeatDays) add(l.id, 'SAME_SPOT_REPEAT');
      const sameDayOthers = new Set(group.filter(g => g.date === l.date && g.userId !== l.userId).map(g => g.userId));
      if (sameDayOthers.size + 1 >= FLAG_THRESHOLDS.sharedUsers) add(l.id, 'SHARED_SPOT');
    }
    void dates; void users;
  });

  // 4) กระโดดเร็วเกินจริงเทียบรายการก่อนหน้าของคนเดียวกัน
  byUser.forEach(list => {
    const timed = list
      .map(l => ({ l, t: logTimeMs(l) }))
      .filter((x): x is { l: GPSCheckInLog; t: number } => x.t !== null)
      .sort((a, b) => a.t - b.t);
    for (let i = 1; i < timed.length; i++) {
      const prev = timed[i - 1], cur = timed[i];
      const dist = calculateHaversineDistance(
        { latitude: prev.l.latitude, longitude: prev.l.longitude },
        { latitude: cur.l.latitude, longitude: cur.l.longitude },
      );
      if (dist < FLAG_THRESHOLDS.jumpMinMeters) continue;
      const dtSec = Math.max((cur.t - prev.t) / 1000, 1);
      if (dist / dtSec > FLAG_THRESHOLDS.jumpMaxSpeedMps) add(cur.l.id, 'IMPOSSIBLE_JUMP');
    }
  });

  return out;
}
