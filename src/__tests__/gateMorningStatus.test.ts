import { describe, it, expect } from 'vitest';
import { gateMorningByStudent, resolveMorningStatus, formatCheckInClock } from '../lib/gateMorningStatus';
import { readSource } from './helpers/readSource';
import type { GateAttendanceRecord } from '../types';

const T = '2026-10-13';
const g = (o: Partial<GateAttendanceRecord>): GateAttendanceRecord => ({
  id: 'x', studentId: '10001', studentName: 'a', type: 'ENTRY', timestamp: '12:35 น.', date: T,
  gateName: 'g', method: 'GPS_GEOFENCE', status: 'LATE', parentNotified: false, ...o,
});

describe('gateMorningByStudent', () => {
  it('LATE → สาย, ON_TIME/NORMAL → มา, เก็บเวลาและวิธี', () => {
    const m = gateMorningByStudent([g({}), g({ studentId: '2', status: 'ON_TIME', method: 'NFC_CARD', timestamp: '07:10 น.' })], T);
    expect(m.get('10001')).toEqual({ status: 'LATE', time: '12:35 น.', method: 'GEOFENCE' });
    expect(m.get('2')).toEqual({ status: 'PRESENT', time: '07:10 น.', method: 'SCAN' });
  });
  it('ใช้ ENTRY แรกสุดของวัน และข้าม EXIT/วันอื่น', () => {
    const m = gateMorningByStudent([
      g({ timestamp: '12:35 น.' }), g({ timestamp: '07:20 น.', status: 'ON_TIME' }),
      g({ type: 'EXIT', timestamp: '03:00 น.' }), g({ date: '2026-10-12', timestamp: '01:00 น.' }),
    ], T);
    expect(m.get('10001')?.status).toBe('PRESENT');
    expect(m.get('10001')?.time).toBe('07:20 น.');
  });
});

describe('resolveMorningStatus', () => {
  const gate = { status: 'LATE' as const, time: '12:35 น.', method: 'GEOFENCE' as const };
  it('ผลเช็คอินสายชนะค่า PRESENT ที่บันทึกไว้แต่ยังไม่ล็อก (กรณีในภาพ)', () => {
    expect(resolveMorningStatus({ hrStatus: 'PRESENT', hrLocked: false, gate, })).toBe('LATE');
  });
  it('ครูบันทึกและล็อกแล้ว = ครูยืนยันเอง ชนะประตู', () => {
    expect(resolveMorningStatus({ hrStatus: 'PRESENT', hrLocked: true, gate, })).toBe('PRESENT');
  });
  it('override บนหน้าจอชนะทุกอย่าง', () => {
    expect(resolveMorningStatus({ override: 'ABSENT', hrLocked: true, hrStatus: 'PRESENT', gate, })).toBe('ABSENT');
  });
  it('ยังไม่เช็คอินและไม่มีบันทึก → ขาด (ไม่ใช้ค่า PRESENT เริ่มต้นใน doc); มีใบลาอนุมัติ → ลา', () => {
    expect(resolveMorningStatus({ hrLocked: false })).toBe('ABSENT');
    expect(resolveMorningStatus({ hrLocked: false, onApprovedLeave: true })).toBe('LEAVE');
    expect(resolveMorningStatus({ hrLocked: false, gate, onApprovedLeave: true })).toBe('LATE');
  });
  it('ไม่มีผลประตู → ใช้ที่บันทึก', () => {
    expect(resolveMorningStatus({ hrStatus: 'LEAVE', hrLocked: false, })).toBe('LEAVE');
    expect(resolveMorningStatus({ hrLocked: false })).toBe('ABSENT');
  });
});

describe('formatCheckInClock', () => {
  it('ไม่แสดง Invalid Date', () => {
    expect(formatCheckInClock('12:35 น.')).toBe('12:35 น.');
    expect(formatCheckInClock('')).toBe('-');
    expect(formatCheckInClock('ไม่ใช่เวลา')).toBe('-');
    expect(formatCheckInClock('2026-10-13T05:35:00.000Z')).toMatch(/\d{1,2}[:.]\d{2}/);
  });
  it('แผง GPS ใช้ formatCheckInClock ไม่ใช้ new Date(timestamp) ตรง ๆ', () => {
    const src = readSource('src/components/homevisit/AdvisorGpsCheckInPanel.tsx');
    expect(src).toContain('formatCheckInClock(l.timestamp)');
    expect(src).not.toMatch(/new Date\(l\.timestamp\)/);
  });
  it('AdvisorPortal ใช้ผลเช็คอินประตูในการหาสถานะเช้า', () => {
    const src = readSource('src/AdvisorPortal.tsx');
    expect(src).toContain('resolveMorningStatus');
    expect(src).toContain('subscribeGateAttendanceLogs');
  });
});
