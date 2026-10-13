import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { readSource } from './helpers/readSource';
import {
  enrollmentState, isEnrollmentClosed, isEnrollmentOpenNow, countdownUrgency, formatCountdown,
  validateEnrollmentWindow, composeLocalMillis, splitLocalMillis, toMillis,
} from '../lib/enrollmentWindow';

const T = (iso: string) => ({ toMillis: () => Date.parse(iso) }); // เหมือน Firestore Timestamp
const NOW = Date.parse('2026-10-13T10:00:00Z');

describe('enrollmentState', () => {
  it('ไม่กำหนดเวลา = เปิดตามสถานะ', () => {
    expect(enrollmentState({ enrollmentStatus: 'OPEN' }, NOW).phase).toBe('OPEN');
    expect(enrollmentState({}, NOW).phase).toBe('OPEN');
    expect(enrollmentState({ enrollmentStatus: 'CLOSED' }, NOW).phase).toBe('CLOSED');
  });
  it('ยังไม่ถึงเวลาเปิด → NOT_YET + นับถอยหลังถึงเวลาเปิด', () => {
    const st = enrollmentState({ enrollmentStatus: 'OPEN', enrollmentOpensAt: T('2026-10-14T00:00:00Z') }, NOW);
    expect(st.phase).toBe('NOT_YET');
    expect(st.deadlineKind).toBe('OPENS');
    expect(st.deadlineMs).toBe(Date.parse('2026-10-14T00:00:00Z'));
  });
  it('อยู่ในช่วง → OPEN + นับถอยหลังถึงเวลาปิด; เลยเวลาปิด → CLOSED', () => {
    const cfg = { enrollmentStatus: 'OPEN' as const, enrollmentOpensAt: T('2026-10-13T00:00:00Z'), enrollmentClosesAt: T('2026-10-13T12:00:00Z') };
    const open = enrollmentState(cfg, NOW);
    expect(open.phase).toBe('OPEN');
    expect(open.deadlineKind).toBe('CLOSES');
    expect(isEnrollmentClosed(cfg, Date.parse('2026-10-13T12:00:00Z'))).toBe(true); // เท่ากับเวลาปิด = ปิด (rules: now < closes)
    expect(isEnrollmentOpenNow(cfg, Date.parse('2026-10-13T11:59:59Z'))).toBe(true);
  });
  it('สั่งปิดมือ (CLOSED) ชนะช่วงเวลา', () => {
    expect(enrollmentState({ enrollmentStatus: 'CLOSED', enrollmentClosesAt: T('2027-01-01T00:00:00Z') }, NOW).phase).toBe('CLOSED');
  });
  it('toMillis รองรับ Timestamp/Date/ISO/ตัวเลข และปฏิเสธค่าเพี้ยน', () => {
    expect(toMillis(T('2026-10-13T00:00:00Z'))).toBe(Date.parse('2026-10-13T00:00:00Z'));
    expect(toMillis(new Date(5))).toBe(5);
    expect(toMillis('nope')).toBeNull();
    expect(toMillis(null)).toBeNull();
  });
});

describe('นับถอยหลัง', () => {
  it('ระดับความเร่งด่วน', () => {
    expect(countdownUrgency(0)).toBe('EXPIRED');
    expect(countdownUrgency(3_600_000)).toBe('URGENT');
    expect(countdownUrgency(3_600_001)).toBe('SOON');
    expect(countdownUrgency(86_400_000)).toBe('SOON');
    expect(countdownUrgency(86_400_001)).toBe('NORMAL');
  });
  it('รูปแบบข้อความ', () => {
    expect(formatCountdown(0)).toBe('ครบกำหนดแล้ว');
    expect(formatCountdown(2 * 86_400_000 + 3 * 3_600_000)).toBe('2 วัน 3 ชม.');
    expect(formatCountdown(3 * 3_600_000 + 12 * 60_000)).toBe('3 ชม. 12 นาที');
    expect(formatCountdown(12 * 60_000 + 5_000)).toBe('12 นาที 05 วิ');
  });
});

describe('ตรวจ/แปลงช่วงเวลาที่กรอก', () => {
  it('เวลาปิดต้องหลังเวลาเปิด', () => {
    expect(validateEnrollmentWindow(100, 100)).not.toBeNull();
    expect(validateEnrollmentWindow(200, 100)).not.toBeNull();
    expect(validateEnrollmentWindow(100, 200)).toBeNull();
    expect(validateEnrollmentWindow(null, 100)).toBeNull();
    expect(validateEnrollmentWindow(null, null)).toBeNull();
  });
  it('compose/split ไปกลับได้ และเวลาว่างใช้ค่าเริ่มต้น', () => {
    const ms = composeLocalMillis('2026-10-20', '16:30')!;
    expect(splitLocalMillis(ms)).toEqual({ ymd: '2026-10-20', hhmm: '16:30' });
    expect(splitLocalMillis(composeLocalMillis('2026-10-20', '', '23:59'))).toEqual({ ymd: '2026-10-20', hhmm: '23:59' });
    expect(composeLocalMillis('', '10:00')).toBeNull();
    expect(splitLocalMillis(null)).toEqual({ ymd: '', hhmm: '' });
  });
});

describe('firestore.rules — ช่วงเวลารับสมัครชุมนุม (static guard; ทดสอบจริงที่ emulator)', () => {
  const rules = readSource(path.resolve(__dirname, '../../firestore.rules'));
  it('สมัคร/สมัครใหม่หลังถอน ต้องผ่าน activityEnrollmentOpen (เวลาเซิร์ฟเวอร์) ไม่ใช่แค่ enrollmentStatus', () => {
    expect(rules).toContain('function activityEnrollmentOpen(');
    expect(rules).toContain('request.time >= get(');
    expect(rules).toContain('request.time < get(');
    expect((rules.match(/activityEnrollmentOpen\(/g) || []).length).toBeGreaterThanOrEqual(3); // นิยาม + create + re-enroll
  });
  it('ครูรับผิดชอบแก้ได้เฉพาะฟิลด์ช่วงเวลา/สถานะของชุมนุมตัวเอง', () => {
    expect(rules).toMatch(/isResponsibleTeacherOfActivity\(configId\)[\s\S]{0,200}hasOnly\(\['enrollmentStatus', 'enrollmentOpensAt', 'enrollmentClosesAt'\]\)/);
  });
  it('ตัวนับถอยหลัง/ช่วงเวลาไม่ใช้ input type date/time ตรง ๆ', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../components/elective/EnrollmentWindowEditor.tsx'), 'utf8');
    expect(src).not.toMatch(/type=["'](date|time|datetime-local)["']/);
  });
});

import { gradeLockDeadlines } from '../lib/gradeLockWindow';
describe('gradeLockDeadlines (นับถอยหลังช่วงกรอกคะแนน)', () => {
  const at = (ymd: string, hhmm = '12:00') => composeLocalMillis(ymd, hhmm)!;
  const base = { id: 'midterm', title: 'กลางภาค' };
  it('เปิดอยู่ + มีเวลาล็อกในอนาคต → นับถอยหลังถึงเวลาล็อก (ไม่ใส่เวลา = 23:59)', () => {
    const r = gradeLockDeadlines([{ ...base, isOpen: true, endDate: '2026-10-20' }], at('2026-10-13'));
    expect(r).toHaveLength(1);
    expect(r[0].kind).toBe('CLOSES');
    expect(r[0].targetMs).toBe(at('2026-10-20', '23:59'));
  });
  it('ยังไม่ถึงเวลาเปิด → นับถอยหลังถึงเวลาเปิด', () => {
    const r = gradeLockDeadlines([{ ...base, isOpen: true, startDate: '2026-10-15', startTime: '08:00', endDate: '2026-10-20' }], at('2026-10-13'));
    expect(r[0].kind).toBe('OPENS');
    expect(r[0].targetMs).toBe(at('2026-10-15', '08:00'));
  });
  it('ปิดอยู่/ไม่กำหนดเวลา/เลยเวลาล็อกแล้ว = ไม่แสดง; เรียงตามใกล้สุด', () => {
    const now = at('2026-10-13');
    expect(gradeLockDeadlines([{ ...base, isOpen: false, endDate: '2026-10-20' }], now)).toEqual([]);
    expect(gradeLockDeadlines([{ ...base, isOpen: true }], now)).toEqual([]);
    expect(gradeLockDeadlines([{ ...base, isOpen: true, endDate: '2026-10-01' }], now)).toEqual([]);
    const two = gradeLockDeadlines([
      { id: 'b', title: 'B', isOpen: true, endDate: '2026-10-25' },
      { id: 'a', title: 'A', isOpen: true, endDate: '2026-10-18' },
    ], now);
    expect(two.map(x => x.id)).toEqual(['a', 'b']);
  });
});
