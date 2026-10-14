import { describe, it, expect } from 'vitest';
import { readSource } from './helpers/readSource';
import { houseOn, validateTransferApply, validateTransferDecision, validateTransferRequest } from '../lib/roomTransfer';

describe('validate', () => {
  it('คำขอ: ห้องต้องต่างและมีเหตุผล', () => {
    expect(validateTransferRequest({ studentId: '1', fromRoom: 'ม.4/1', toRoom: 'ม.4/2', reason: 'ย้ายแผนการเรียน' })).toBeNull();
    expect(validateTransferRequest({ studentId: '1', fromRoom: 'ม.4/1', toRoom: 'ม.4/1', reason: 'x' })).toMatch(/ต่างจาก/);
    expect(validateTransferRequest({ studentId: '1', fromRoom: 'ม.4/1', toRoom: 'ม.4/2', reason: ' ' })).toMatch(/เหตุผล/);
  });
  it('มติ/วันที่มีผล', () => {
    expect(validateTransferDecision({ decision: 'APPROVED', committee: 'คำสั่งที่ 5/2569', date: '2569-11-01', note: '' })).toBeNull();
    expect(validateTransferDecision({ decision: 'MAYBE', committee: 'x', date: '2569-11-01', note: '' })).toMatch(/ผลการพิจารณา/);
    expect(validateTransferDecision({ decision: 'APPROVED', committee: '', date: '2569-11-01', note: '' })).toMatch(/คณะกรรมการ/);
    expect(validateTransferApply('1/1/69')).toMatch(/วันที่/);
    expect(validateTransferApply('2569-11-01')).toBeNull();
  });
});

describe('houseOn — ผลงานเดิมให้สีเดิม ผลงานใหม่ให้สีใหม่', () => {
  const t = (effectiveDate: string, fromHouseId: string | null) => ({ status: 'APPLIED' as const, effectiveDate, fromHouseId });
  it('ก่อน/หลังวันที่มีผล และหลายครั้ง', () => {
    const ts = [t('2569-11-01', 'red'), t('2570-02-01', 'blue')]; // red → blue → (ปัจจุบัน green)
    expect(houseOn('green', ts, '2569-10-31')).toBe('red');
    expect(houseOn('green', ts, '2569-11-01')).toBe('blue'); // วันที่มีผลเป็นต้นไป = สีใหม่
    expect(houseOn('green', ts, '2570-01-31')).toBe('blue');
    expect(houseOn('green', ts, '2570-02-01')).toBe('green');
  });
  it('ไม่นับคำขอที่ยังไม่ย้ายจริง และไม่มีการย้าย = สีปัจจุบัน', () => {
    expect(houseOn('red', [{ status: 'APPROVED', effectiveDate: undefined, fromHouseId: 'blue' }], '2569-01-01')).toBe('red');
    expect(houseOn(undefined, [], '2569-01-01')).toBeNull();
  });
});

describe('static', () => {
  it('rules: ลบ/แก้ย้อนหลังไม่ได้ และอนุมัติจบต้องผูกกับ graduation_approvals', () => {
    const r = readSource('firestore.rules');
    const i = r.indexOf('match /room_transfers/');
    expect(r.slice(i, i + 5200)).toContain('allow delete: if false;');
    expect(r).toContain('function regGraduating(sid)');
    expect(r).toContain("request.resource.data.statusReason == 'GRADUATED'");
    expect(readSource('src/services/studentLifecycle.ts')).toContain('export async function graduateStudents');
  });
});
