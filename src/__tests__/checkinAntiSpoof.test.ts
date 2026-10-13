import { describe, it, expect } from 'vitest';
import { offsetFromDateHeader, buildTrustedNow, schoolClockParts } from '../lib/trustedClock';
import { flagCheckIns, FLAG_THRESHOLDS } from '../lib/checkinFlags';
import { readSource } from './helpers/readSource';
import type { GPSCheckInLog } from '../types';

const L = (o: Partial<GPSCheckInLog>): GPSCheckInLog => ({
  id: 'a', userId: 'u1', userName: 'n', userRole: 'STUDENT', type: 'ENTRY', timestamp: '07:30 น.', date: '2026-10-13',
  latitude: 17.61709, longitude: 100.08295, distanceMeters: 50, isInsideGeofence: true, status: 'ON_TIME', accuracyMeters: 8.4, ...o,
});
const codes = (m: Map<string, { code: string }[]>, id: string) => (m.get(id) || []).map(f => f.code);

describe('trustedClock', () => {
  it('offset จาก header Date: เครื่องช้า 10 นาที → offset ≈ +600s', () => {
    const server = Date.UTC(2026, 9, 13, 5, 0, 0);
    const deviceMid = server - 600_000;
    const off = offsetFromDateHeader(new Date(server).toUTCString(), deviceMid - 100, deviceMid + 100)!;
    expect(Math.abs(off - 600_500)).toBeLessThan(5);
    const t = buildTrustedNow(new Date(deviceMid), off);
    expect(t.source).toBe('SERVER');
    expect(t.skewSeconds).toBe(-600);
    expect(Math.abs(t.now.getTime() - (server + 500))).toBeLessThan(5);
  });
  it('ไม่มี/อ่านไม่ได้ header → ใช้เวลาเครื่อง และระบุ DEVICE', () => {
    expect(offsetFromDateHeader(null, 0, 1)).toBeNull();
    expect(offsetFromDateHeader('ไม่ใช่วันที่', 0, 1)).toBeNull();
    const d = new Date();
    const t = buildTrustedNow(d, null);
    expect(t).toEqual({ now: d, source: 'DEVICE', skewSeconds: 0 });
  });
  it('วัน/เวลาใช้เขตเวลา Asia/Bangkok เสมอ (ข้ามเที่ยงคืน UTC)', () => {
    // 2026-10-13 18:30 UTC = 2026-10-14 01:30 ไทย
    const p = schoolClockParts(new Date(Date.UTC(2026, 9, 13, 18, 30)));
    expect(p).toMatchObject({ ymd: '2026-10-14', hour: 1, minute: 30, label: '01:30 น.' });
    expect(schoolClockParts(new Date(Date.UTC(2026, 9, 13, 1, 5))).label).toBe('08:05 น.');
  });
});

describe('flagCheckIns', () => {
  it('log ปกติไม่มีธง', () => {
    expect(flagCheckIns([L({})]).size).toBe(0);
  });
  it('accuracy ≤ 1 ม. = สะอาดเกินจริง; ไม่มี accuracy = เตือน', () => {
    const m = flagCheckIns([L({ id: 'p', accuracyMeters: 1 }), L({ id: 'z', accuracyMeters: 0 })]);
    expect(codes(m, 'p')).toContain('ACCURACY_TOO_PERFECT');
    expect(codes(m, 'z')).toEqual(['NO_ACCURACY']);
  });
  it('พิกัดซ้ำเป๊ะข้ามวัน (accuracy แม่น) → SAME_SPOT_REPEAT; accuracy กว้าง (Wi-Fi) ไม่ติดธง', () => {
    const mk = (id: string, date: string, acc: number) => L({ id, date, accuracyMeters: acc });
    const hi = flagCheckIns([mk('d1', '2026-10-11', 5), mk('d2', '2026-10-12', 5), mk('d3', '2026-10-13', 5)]);
    expect(codes(hi, 'd3')).toContain('SAME_SPOT_REPEAT');
    const wifi = flagCheckIns([mk('d1', '2026-10-11', 40), mk('d2', '2026-10-12', 40), mk('d3', '2026-10-13', 40)]);
    expect(wifi.size).toBe(0);
  });
  it('พิกัดซ้ำเป๊ะระหว่างนักเรียนคนละคนวันเดียวกัน → SHARED_SPOT', () => {
    const m = flagCheckIns([L({ id: 'x', userId: 'a', accuracyMeters: 5 }), L({ id: 'y', userId: 'b', accuracyMeters: 5 })]);
    expect(codes(m, 'x')).toContain('SHARED_SPOT');
    expect(codes(m, 'y')).toContain('SHARED_SPOT');
  });
  it('พิกัดต่างกันเล็กน้อย (GPS จริง) ไม่ติดธงซ้ำ', () => {
    const m = flagCheckIns([
      L({ id: 'x', userId: 'a', accuracyMeters: 5, latitude: 17.617091 }),
      L({ id: 'y', userId: 'b', accuracyMeters: 5, latitude: 17.617103 }),
    ]);
    expect(m.size).toBe(0);
  });
  it('กระโดดไกลเร็วเกินจริงจากรายการก่อนหน้า → IMPOSSIBLE_JUMP', () => {
    const m = flagCheckIns([
      L({ id: 'j1', timestamp: '07:30 น.', serverTimeMs: Date.parse('2026-10-13T07:30:00+07:00') }),
      L({ id: 'j2', timestamp: '07:31 น.', latitude: 17.65, serverTimeMs: Date.parse('2026-10-13T07:31:00+07:00') }),
    ]);
    expect(codes(m, 'j2')).toContain('IMPOSSIBLE_JUMP');
    expect(codes(m, 'j1')).not.toContain('IMPOSSIBLE_JUMP');
  });
  it('ระยะใกล้ หรือเวลาห่างพอ ไม่ใช่การกระโดด', () => {
    const m = flagCheckIns([
      L({ id: 'k1', timestamp: '07:30 น.', serverTimeMs: Date.parse('2026-10-13T07:30:00+07:00') }),
      L({ id: 'k2', timestamp: '15:30 น.', latitude: 17.65, serverTimeMs: Date.parse('2026-10-13T15:30:00+07:00') }),
    ]);
    expect(codes(m, 'k2')).not.toContain('IMPOSSIBLE_JUMP');
  });
  it('เวลาเครื่องคลาด/ไม่ตรงเซิร์ฟเวอร์/ยืนยันเวลาไม่ได้', () => {
    const m = flagCheckIns([
      L({ id: 's', clockSkewSeconds: FLAG_THRESHOLDS.skewMaxSeconds + 1 }),
      L({ id: 'm', serverTimeMs: Date.parse('2026-10-13T09:00:00+07:00') }), // อ้าง 07:30 แต่เซิร์ฟเวอร์ 09:00
      L({ id: 'd', clockSource: 'DEVICE' }),
      L({ id: 'ok', clockSource: 'SERVER', clockSkewSeconds: 3, serverTimeMs: Date.parse('2026-10-13T07:30:20+07:00') }),
    ]);
    expect(codes(m, 's')).toContain('CLOCK_SKEW');
    expect(codes(m, 'm')).toContain('CLOCK_MISMATCH');
    expect(codes(m, 'd')).toEqual(['DEVICE_CLOCK']);
    expect(m.has('ok')).toBe(false);
  });
});

describe('guards (ต่อสายจริง)', () => {
  it('modal ใช้เวลาเซิร์ฟเวอร์ + เขตเวลาโรงเรียน ไม่ใช้ new Date() ตัดสิน "สาย"', () => {
    const src = readSource('src/components/GPSGeofenceCheckinModal.tsx');
    expect(src).toContain('await getTrustedNow()');
    expect(src).toContain('schoolClockParts(trusted.now)');
    expect(src).toContain('clockSource: trusted.source');
    expect(src).not.toMatch(/now\.getHours\(\)/);
  });
  it('บันทึก serverTime = serverTimestamp() และไม่เขียน serverTimeMs กลับ', () => {
    const src = readSource('src/services/firestoreService.ts');
    expect(src).toMatch(/serverTime: serverTimestamp\(\)/);
    expect(src).toMatch(/const \{ serverTimeMs: _ignored, \.\.\.rest \} = log/);
  });
  it('แผงครูที่ปรึกษาแสดงธง "ควรตรวจสอบ"', () => {
    const src = readSource('src/components/homevisit/AdvisorGpsCheckInPanel.tsx');
    expect(src).toContain('flagCheckIns(allLogs)');
    expect(src).toContain('ควรตรวจสอบ');
  });
});
