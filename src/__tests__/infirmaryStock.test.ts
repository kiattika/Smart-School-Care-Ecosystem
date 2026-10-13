import { describe, it, expect } from 'vitest';
import { readSource } from './helpers/readSource';
import {
  applyStockChange, deltaAllowed, isLowStock, composeMedicationGiven, validateDispenseLines,
} from '../lib/infirmaryStock';

describe('infirmaryStock logic', () => {
  it('deltaAllowed ตามชนิด', () => {
    expect(deltaAllowed('RESTOCK', 5)).toBe(true);
    expect(deltaAllowed('RESTOCK', -5)).toBe(false);
    expect(deltaAllowed('DISPENSE', -1)).toBe(true);
    expect(deltaAllowed('DISPENSE', 1)).toBe(false);
    expect(deltaAllowed('DISCARD', -2)).toBe(true);
    expect(deltaAllowed('ADJUST', -3)).toBe(true);
    expect(deltaAllowed('ADJUST', 0)).toBe(false);
    expect(deltaAllowed('RESTOCK', 1.5)).toBe(false);
  });
  it('applyStockChange: ไม่ติดลบ', () => {
    expect(applyStockChange(10, 'DISPENSE', -4)).toEqual({ ok: true, balanceAfter: 6 });
    expect(applyStockChange(3, 'DISPENSE', -4)).toEqual({ ok: false, error: 'INSUFFICIENT_STOCK' });
    expect(applyStockChange(3, 'DISPENSE', 4)).toEqual({ ok: false, error: 'INVALID_DELTA' });
    expect(applyStockChange(0, 'RESTOCK', 20)).toEqual({ ok: true, balanceAfter: 20 });
  });
  it('isLowStock: ≤ จุดเตือน, ปิดใช้งานไม่เตือน', () => {
    expect(isLowStock({ stock: 5, minAlert: 5 })).toBe(true);
    expect(isLowStock({ stock: 6, minAlert: 5 })).toBe(false);
    expect(isLowStock({ stock: 0, minAlert: 5, active: false })).toBe(false);
  });
  it('composeMedicationGiven / validateDispenseLines', () => {
    const lines = [{ medicineId: 'a', name: 'พารา', unit: 'เม็ด', qty: 2 }];
    expect(composeMedicationGiven(lines, ' ยาหม่อง ')).toBe('พารา 2 เม็ด, ยาหม่อง');
    expect(composeMedicationGiven([], '')).toBe('');
    expect(validateDispenseLines(lines, { a: 5 })).toBeNull();
    expect(validateDispenseLines(lines, { a: 1 })).toMatch(/ไม่พอ/);
    expect(validateDispenseLines([{ ...lines[0], qty: 0 }], { a: 5 })).toMatch(/มากกว่า 0/);
    expect(validateDispenseLines([...lines, ...lines], { a: 5 })).toMatch(/ซ้ำ/);
    expect(validateDispenseLines(lines, {})).toMatch(/ไม่พบ/);
  });
});

describe('guard: คลังยาไม่ใช้ข้อมูลตัวอย่าง + rules บังคับคู่เคลื่อนไหว', () => {
  it('InfirmaryPortal ไม่มี mock medicines / alert จำลอง', () => {
    const s = readSource('src/components/infirmary/InfirmaryPortal.tsx');
    expect(s).not.toMatch(/Medicine inventory state \(mock\)/);
    expect(s).not.toMatch(/alert\('เพิ่มรายการยาสำเร็จ'\)/);
    expect(s).toMatch(/subscribeInfirmaryMedicines/);
  });
  it('rules: ยอดยาแก้ได้เมื่อมี movement คู่ (getAfter), movement แก้/ลบไม่ได้, ผู้ปกครอง/นักเรียนอ่านไม่ได้', () => {
    const r = readSource('firestore.rules');
    const a = r.indexOf('match /infirmary_medicines/');
    const b = r.indexOf('// 32. Semester Health Log');
    const block = r.slice(a, b);
    expect(block).toMatch(/getAfter\(/);
    expect(block).toMatch(/allow update, delete: if false;/);
    expect(block).not.toMatch(/isSignedIn\(\)/);
  });
});
