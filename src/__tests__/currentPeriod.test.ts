import { describe, it, expect } from 'vitest';
import { findCurrentPeriod } from '../lib/currentPeriod';
import { readSource } from './helpers/readSource';

// ตารางจริงตามหน้า "ตารางเวลา & กระดิ่งคาบเรียน" (คาบ 5 = พัก, คาบ 8 = 14:20-15:10, คาบ 9 = 15:10-16:00)
const P = (n: number, s: string, e: string, t = 'MAIN', name = `คาบเรียนที่ ${n}`) => ({ periodNumber: n, periodName: name, startTime: s, endTime: e, periodType: t });
const periods = [
  P(0, '08:00', '08:30', 'ACTIVITY'), P(1, '08:30', '09:20'), P(2, '09:20', '10:10'), P(3, '10:10', '11:00'),
  P(4, '11:00', '11:50'), P(5, '11:50', '12:40', 'BREAK', 'พักกลางวัน'), P(6, '12:40', '13:30'), P(7, '13:30', '14:20'),
  P(8, '14:20', '15:10'), P(9, '15:10', '16:00'), P(10, '16:00', '16:50'),
];
const at = (h: number, m: number) => findCurrentPeriod(periods, new Date(2026, 9, 12, h, m));

describe('findCurrentPeriod', () => {
  it('15:20 = คาบ 9 (เคยแสดงผิดเป็น "คาบ 8 กิจกรรม/แนะแนว")', () => {
    const r = at(15, 20)!;
    expect(r.name).toBe('คาบ 9');
    expect(r.timeRange).toBe('15:10 - 16:00');
    expect(r.isActive).toBe(true);
  });
  it('ขอบเขตคาบ: เริ่มนับ, จบไม่นับ', () => {
    expect(at(14, 20)!.name).toBe('คาบ 8');
    expect(at(15, 9)!.name).toBe('คาบ 8');
    expect(at(15, 10)!.name).toBe('คาบ 9');
  });
  it('คาบ 0 = โฮมรูม, คาบ BREAK = พัก', () => {
    expect(at(8, 10)!.isHomeroom).toBe(true);
    const lunch = at(12, 0)!;
    expect(lunch.isLunch).toBe(true);
    expect(lunch.name).toBe('พักกลางวัน');
  });
  it('ชื่อคาบที่ตั้งเองแสดงต่อท้ายเลขคาบ', () => {
    const r = findCurrentPeriod([P(8, '14:20', '15:10', 'ACTIVITY', 'แนะแนว')], new Date(2026, 9, 12, 14, 30))!;
    expect(r.name).toBe('คาบ 8 (แนะแนว)');
  });
  it('ก่อน/หลังเวลาเรียนอิงเวลาในตาราง', () => {
    expect(at(7, 0)).toMatchObject({ isActive: false, timeRange: 'ก่อน 08:00 น.' });
    expect(at(17, 0)).toMatchObject({ isActive: false, timeRange: 'หลัง 16:50 น.' });
  });
  it('ไม่มีตาราง/ยังไม่ตั้งเวลา = null (ไม่เดา)', () => {
    expect(findCurrentPeriod([], new Date())).toBeNull();
    expect(findCurrentPeriod([P(1, '', '')], new Date())).toBeNull();
  });
});

describe('HeaderRealTimeClock ไม่ฝังตารางเวลา', () => {
  const src = readSource('src/components/HeaderRealTimeClock.tsx');
  it('ใช้ useAdminPeriods + findCurrentPeriod', () => {
    expect(src).toMatch(/useAdminPeriods\(\)/);
    expect(src).toMatch(/findCurrentPeriod\(/);
    expect(src).not.toMatch(/SCHOOL_PERIODS|startHour/);
  });
});
