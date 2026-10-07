import { describe, it, expect } from 'vitest';
import { shouldShowInTeachingLoad } from '../lib/teachingLoadVisibility';
import { readSource } from './helpers/readSource';

describe('shouldShowInTeachingLoad', () => {
  it('ครูที่ใช้งานอยู่แสดงเสมอ แม้ยังไม่มีคาบ', () => {
    expect(shouldShowInTeachingLoad({ status: 'ACTIVE' }, 0)).toBe(true);
    expect(shouldShowInTeachingLoad({}, 0)).toBe(true);
    expect(shouldShowInTeachingLoad({}, 12)).toBe(true);
  });
  it('ครูที่ปิดการใช้งานและไม่มีคาบ → ซ่อน', () => {
    expect(shouldShowInTeachingLoad({ status: 'INACTIVE' }, 0)).toBe(false);
  });
  it('ครูที่ปิดการใช้งานแต่ยังมีคาบค้าง → แสดง (ให้แอดมินเห็นว่าต้องโอน/เก็บกวาด)', () => {
    expect(shouldShowInTeachingLoad({ status: 'INACTIVE' }, 3)).toBe(true);
  });
  it('ไม่มี staff doc → ถือว่าไม่ใช่ครูที่ใช้งาน ไม่ซ่อนถ้ามีคาบ', () => {
    expect(shouldShowInTeachingLoad(null, 0)).toBe(false);
    expect(shouldShowInTeachingLoad(undefined, 2)).toBe(true);
  });
});

describe('TeachingLoadTable ใช้ตัวกรองสถานะ', () => {
  const src = readSource('src/components/TeachingLoadTable.tsx');
  it('เรียก shouldShowInTeachingLoad ก่อน push รายการครู และมีป้ายปิดการใช้งาน', () => {
    expect(src).toContain('shouldShowInTeachingLoad');
    expect(src).toContain('isStaffActive');
    expect(src).toContain('ปิดการใช้งาน • ยังมีคาบค้าง');
  });
});
