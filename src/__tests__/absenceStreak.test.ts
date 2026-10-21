import { describe, it, expect } from 'vitest';
import {
  absenceLevel, computeRoomStreaks, DEFAULT_ABSENCE_THRESHOLDS, normalizeThresholds, validateThresholds, type HomeroomDayLite,
} from '../lib/absenceStreak';
import { readSource } from './helpers/readSource';

const day = (date: string, students: Record<string, string>): HomeroomDayLite => ({ date, room: 'ม.1/1', students });

describe('computeRoomStreaks', () => {
  it('นับ ABSENT ติดกันย้อนจากวันล่าสุด; มา/สาย/ลา ตัดสาย', () => {
    const days = [
      day('2026-10-19', { a: 'ABSENT', b: 'ABSENT', c: 'ABSENT', d: 'PRESENT' }),
      day('2026-10-20', { a: 'ABSENT', b: 'LEAVE', c: 'ABSENT', d: 'ABSENT' }),
      day('2026-10-21', { a: 'ABSENT', b: 'ABSENT', c: 'LATE', d: 'ABSENT' }),
    ];
    const r = Object.fromEntries(computeRoomStreaks(days).map(s => [s.studentId, s]));
    expect(r.a.streakDays).toBe(3);
    expect(r.a.sinceDate).toBe('2026-10-19');
    expect(r.b.streakDays).toBe(1); // ลา ตัดสาย
    expect(r.c).toBeUndefined();    // วันล่าสุดสาย = ไม่มีสาย
    expect(r.d.streakDays).toBe(2);
  });
  it('วันที่ไม่มีเอกสาร (หยุด/ไม่เช็ค) ข้ามไปโดยไม่ตัดสาย และไม่นับเป็นขาด', () => {
    const days = [day('2026-10-16', { a: 'ABSENT' }), day('2026-10-21', { a: 'ABSENT' })]; // ข้ามหลายวัน
    expect(computeRoomStreaks(days)[0].streakDays).toBe(2);
  });
  it('นักเรียนที่ไม่อยู่ในเอกสารวันหนึ่ง = ข้ามวันนั้น', () => {
    const days = [day('2026-10-20', { a: 'ABSENT', b: 'ABSENT' }), day('2026-10-21', { a: 'ABSENT' })];
    const r = Object.fromEntries(computeRoomStreaks(days).map(s => [s.studentId, s.streakDays]));
    expect(r).toEqual({ a: 2, b: 1 });
  });
  it('ไม่มีข้อมูล = ว่าง', () => { expect(computeRoomStreaks([])).toEqual([]); });
});

describe('thresholds', () => {
  it('ระดับตามเกณฑ์เริ่มต้น 3/5/10', () => {
    const t = DEFAULT_ABSENCE_THRESHOLDS;
    expect([2, 3, 4, 5, 9, 10].map(n => absenceLevel(n, t))).toEqual([0, 1, 1, 2, 2, 3]);
  });
  it('ปรับเกณฑ์ได้; ไม่ผ่านการตรวจ = ค่าเริ่มต้น (ไม่เดา)', () => {
    expect(normalizeThresholds({ watchDays: 2, weekDays: 4, severeDays: 7 })).toEqual({ watchDays: 2, weekDays: 4, severeDays: 7 });
    expect(normalizeThresholds({ watchDays: 5, weekDays: 3, severeDays: 7 })).toEqual(DEFAULT_ABSENCE_THRESHOLDS);
    expect(normalizeThresholds(undefined)).toEqual(DEFAULT_ABSENCE_THRESHOLDS);
    expect(validateThresholds({ watchDays: 1.5, weekDays: 4, severeDays: 7 })).not.toBeNull();
    expect(validateThresholds({ watchDays: 1, weekDays: 2, severeDays: 61 })).not.toBeNull();
  });
});

describe('สำเนา functions/src/absenceStreakLogic.ts ตรงกับ src/lib/absenceStreak.ts (ส่วนตรรกะ)', () => {
  const body = (s: string) => s.slice(s.indexOf('export interface AbsenceThresholds')).split('/** ใครควรเห็นตามระดับ')[0].replace(/\r/g, '').trim();
  it('เหมือนกันทุกตัวอักษร', () => {
    expect(body(readSource('functions/src/absenceStreakLogic.ts'))).toBe(body(readSource('src/lib/absenceStreak.ts')));
  });
  it('rules ตรง: ชนิด action ของผลติดตาม + เกณฑ์ 1..60', async () => {
    const { FOLLOWUP_ACTIONS } = await import('../lib/absenceStreak');
    const rules = readSource('firestore.rules.comments');
    for (const a of FOLLOWUP_ACTIONS) expect(rules).toContain(`'${a}'`);
    expect(rules).toMatch(/severeDays <= 60/);
  });
  it('functions index/deploy มีฟังก์ชันใหม่', () => {
    expect(readSource('functions/src/index.ts')).toContain("export { scheduledAbsenceAlerts, refreshAbsenceAlerts } from './absenceAlerts';");
  });
});
