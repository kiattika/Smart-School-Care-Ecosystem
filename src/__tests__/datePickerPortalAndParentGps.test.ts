import { describe, it, expect } from 'vitest';
import path from 'path';
import { readSource } from './helpers/readSource';
import { computePopupPosition } from '../components/shared/popupPosition';

const src = (p: string) => readSource(path.resolve(__dirname, '..', p));
const VIEW = { width: 1200, height: 800 };
const POP = { width: 288, height: 340 };
const anchor = (top: number, left = 100) => ({ top, bottom: top + 40, left, right: left + 200 });

describe('computePopupPosition', () => {
  it('ที่ด้านล่างพอ → เปิดลงล่างชิดใต้ปุ่ม', () => {
    const r = computePopupPosition(anchor(100), POP, VIEW);
    expect(r.placement).toBe('below');
    expect(r.top).toBe(144);
  });
  it('ด้านล่างไม่พอ ด้านบนมีที่ → เปิดขึ้นบน (ไม่ล้นขอบล่างจอ)', () => {
    const r = computePopupPosition(anchor(700), POP, VIEW);
    expect(r.placement).toBe('above');
    expect(r.top + POP.height).toBeLessThanOrEqual(700);
  });
  it('บีบเข้าจอทั้งแนวนอน (ปุ่มชิดขวา/ชิดซ้าย)', () => {
    expect(computePopupPosition(anchor(100, 1100), POP, VIEW).left + POP.width).toBeLessThanOrEqual(VIEW.width);
    expect(computePopupPosition(anchor(100, -50), POP, VIEW).left).toBeGreaterThanOrEqual(0);
  });
  it('จอเตี้ยมาก → จำกัดความสูงให้เลื่อนได้ ไม่ล้นจอ', () => {
    const r = computePopupPosition(anchor(100), POP, { width: 800, height: 300 });
    expect(r.maxHeight).toBeGreaterThanOrEqual(160);
    expect(r.top).toBeGreaterThanOrEqual(8);
  });
});

describe('DatePicker วาดผ่าน portal (เคยถูกกล่องแม่ตัดขอบล่างและถูกการ์ดอื่นทับ)', () => {
  const dp = src('components/shared/DatePicker.tsx');
  it('ใช้ createPortal ไปที่ document.body + position fixed + พื้นทึบ + z สูง', () => {
    expect(dp).toContain("from 'react-dom'");
    expect(dp).toMatch(/createPortal\(/);
    expect(dp).toContain('document.body');
    expect(dp).toMatch(/position: 'fixed'/);
    expect(dp).toMatch(/zIndex: 1000/);
    expect(dp).toMatch(/bg-slate-900 border border-slate-700/);
    expect(dp).not.toMatch(/absolute z-50 mt-1 w-72/);
  });
  it('คลิกนอก/กด Esc ปิด และนับป๊อปอัปใน portal เป็นส่วนของตัวเอง', () => {
    expect(dp).toContain('popupRef.current?.contains');
    expect(dp).toContain("e.key === 'Escape'");
  });
});

describe('ผู้ปกครองไม่มีปุ่ม GPS (ทั้งแถบบนและปุ่มลอย)', () => {
  it('QuickActionHub ไม่แสดงเมื่อ activeRole = PARENT', () => {
    const q = src('components/QuickActionHub.tsx');
    expect(q).toContain("user?.activeRole === 'PARENT'");
    expect(q.indexOf("user?.activeRole === 'PARENT'")).toBeLessThan(q.indexOf('return (\n    <>'));
  });
  it('แถบบนซ่อนเหมือนเดิม', () => {
    expect(src('components/NavbarWithRoleSwitcher.tsx')).toContain("activeRole !== 'PARENT'");
  });
});

describe('DatePicker แสดงวันปัจจุบันชัดเจน', () => {
  const dp = src('components/shared/DatePicker.tsx');
  it('วันนี้มีวงแหวนเด่น + ปุ่มลัด "เลือกวันนี้/ไปเดือนนี้" พร้อมบอกวันที่วันนี้', () => {
    expect(dp).toContain('ring-2 ring-emerald-400');
    expect(dp).toContain('data-testid="datepicker-today"');
    expect(dp).toContain('เลือกวันนี้');
    expect(dp).toContain('ไปเดือนนี้');
  });
});

describe('DatePicker ช่องว่างเปิดที่เดือนปัจจุบัน', () => {
  it('ไม่เปิดที่เดือนของ min เมื่อ min เป็นอดีต (บีบด้วย min/max เท่านั้น)', () => {
    const dp = src('components/shared/DatePicker.tsx');
    expect(dp).toContain('defaultView(min, max)');
    expect(dp).not.toContain('parseYmd(min) || new Date()');
  });
});
