import { describe, it, expect } from 'vitest';
import {
  canExpressInterest, canStaffSetInterest, closesYmdOf, dayEndExclusive, fundInterestId, registrationLabel,
  registrationPhase, validateFundProgramInput, type FundProgram, type FundProgramInput,
} from '../lib/fundPrograms';
import { readSource } from './helpers/readSource';

const ok: FundProgramInput = {
  kind: 'SCHOLARSHIP', title: 'ทุนเรียนดี', funder: 'มูลนิธิ', description: '', eligibility: '', amountText: '5,000 บาท',
  selectionNote: 'สัมภาษณ์', links: ['https://example.com/a'], registrationEnabled: false, opensYmd: '', closesYmd: '',
};
const prog = (o: Partial<FundProgram> = {}): FundProgram => ({
  id: 'p1', kind: 'SCHOLARSHIP', title: 't', funder: '', description: '', eligibility: '', amountText: '', selectionNote: '', links: [],
  status: 'PUBLISHED', registrationEnabled: true, ...o,
});

describe('validateFundProgramInput', () => {
  it('รับข้อมูลครบถ้วน', () => expect(validateFundProgramInput(ok)).toEqual([]));
  it('ต้องมีชื่อและประเภทที่ถูกต้อง', () => {
    expect(validateFundProgramInput({ ...ok, title: ' ' }).length).toBe(1);
    expect(validateFundProgramInput({ ...ok, kind: 'X' }).length).toBe(1);
  });
  it('ลิงก์ต้อง https และไม่เกิน 5', () => {
    expect(validateFundProgramInput({ ...ok, links: ['http://a.com'] }).length).toBe(1);
    expect(validateFundProgramInput({ ...ok, links: Array(6).fill('https://a.com') }).length).toBe(1);
  });
  it('เปิดลงชื่อสนใจต้องมีวันปิด และวันปิดต้องไม่ก่อนวันเปิด', () => {
    expect(validateFundProgramInput({ ...ok, registrationEnabled: true }).length).toBe(1);
    expect(validateFundProgramInput({ ...ok, registrationEnabled: true, closesYmd: '2026-10-20' })).toEqual([]);
    expect(validateFundProgramInput({ ...ok, opensYmd: '2026-10-20', closesYmd: '2026-10-19' }).length).toBe(1);
  });
});

describe('ช่วงเวลาลงชื่อสนใจ', () => {
  const closes = dayEndExclusive('2026-10-20')!;
  it('ปิดสิ้นวัน: วันสุดท้ายยังรับ วันถัดไปปิด', () => {
    const p = prog({ registrationClosesAt: closes.getTime() });
    expect(closesYmdOf(closes.getTime())).toBe('2026-10-20');
    expect(registrationPhase(p, closes.getTime() - 1)).toBe('OPEN');
    expect(registrationPhase(p, closes.getTime())).toBe('CLOSED');
  });
  it('ยังไม่ถึงวันเปิด = NOT_YET', () => {
    const opens = new Date('2026-10-15T00:00:00').getTime();
    expect(registrationPhase(prog({ registrationOpensAt: opens, registrationClosesAt: closes.getTime() }), opens - 1)).toBe('NOT_YET');
  });
  it('ลงชื่อได้เฉพาะ PUBLISHED + เปิดรับ', () => {
    const now = closes.getTime() - 1000;
    expect(canExpressInterest(prog({ registrationClosesAt: closes.getTime() }), now)).toBe(true);
    expect(canExpressInterest(prog({ status: 'CLOSED', registrationClosesAt: closes.getTime() }), now)).toBe(false);
    expect(canExpressInterest(prog({ status: 'DRAFT', registrationClosesAt: closes.getTime() }), now)).toBe(false);
    expect(canExpressInterest(prog({ registrationEnabled: false }), now)).toBe(false);
  });
  it('ข้อความสถานะ', () => {
    expect(registrationLabel(prog({ registrationEnabled: false }), 0)).toContain('ไม่มีการลงชื่อ');
  });
});

describe('สถานะผู้สมัคร (งานกองทุน)', () => {
  it('INTERESTED→SHORTLISTED/AWARDED/NOT_SELECTED, SHORTLISTED→AWARDED/NOT_SELECTED เท่านั้น', () => {
    for (const to of ['SHORTLISTED', 'AWARDED', 'NOT_SELECTED']) expect(canStaffSetInterest('INTERESTED', to)).toBe(true);
    for (const to of ['AWARDED', 'NOT_SELECTED']) expect(canStaffSetInterest('SHORTLISTED', to)).toBe(true);
    expect(canStaffSetInterest('SHORTLISTED', 'INTERESTED')).toBe(false);
    expect(canStaffSetInterest('AWARDED', 'NOT_SELECTED')).toBe(false);
    expect(canStaffSetInterest('WITHDRAWN', 'AWARDED')).toBe(false);
  });
  it('id เอกสาร = programId_studentId', () => expect(fundInterestId('p1', '11111')).toBe('p1_11111'));
});

describe('guard: โครงสร้างโค้ด', () => {
  it('rules มี FUND_SCHOLARSHIP และ fund_programs/fund_interests', () => {
    const r = readSource('firestore.rules');
    expect(r).toContain("hasRole('FUND_SCHOLARSHIP')");
    expect(r).toContain('match /fund_programs/{programId}');
    expect(r).toContain('match /fund_interests/{interestId}');
  });
  it('เมนูทุน/กยศ. อยู่ทั้งพอร์ทัลนักเรียนและผู้ปกครอง และลิงก์ผ่าน isHttpsLink', () => {
    expect(readSource('src/StudentPortal.tsx')).toContain('StudentFundsSection');
    expect(readSource('src/ParentPortal.tsx')).toContain('StudentFundsSection');
    expect(readSource('src/components/funds/StudentFundsSection.tsx')).toContain('isHttpsLink');
  });
  it('ผู้ปกครองอ่านอย่างเดียว + ไม่ getDoc เอกสารที่ยังไม่มี (rules อ่าน resource.data)', () => {
    expect(readSource('src/ParentPortal.tsx')).toMatch(/<StudentFundsSection readOnly/);
    const svc = readSource('src/services/fundService.ts');
    const fn = svc.slice(svc.indexOf('export async function expressInterest'), svc.indexOf('export async function withdrawInterest'));
    expect(fn).not.toMatch(/getDoc\(ref\)/);
  });
  it('App.tsx มี route ของ FUND_SCHOLARSHIP', () => expect(readSource('src/App.tsx')).toContain("'FUND_SCHOLARSHIP'"));
});
