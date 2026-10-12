import { describe, it, expect } from 'vitest';
import { readSource } from './helpers/readSource';

describe('NavbarWithRoleSwitcher ไม่มีทางลัดสลับเป็นมุมมองผู้ปกครอง/นักเรียน', () => {
  const src = readSource('src/components/NavbarWithRoleSwitcher.tsx');
  it("ไม่ setUser({ role: 'parent' | 'student' }) ให้บุคลากร (ผู้ปกครอง/นักเรียนต้องล็อกอินด้วยบัญชีจริง)", () => {
    expect(src).not.toMatch(/role:\s*'parent'/);
    expect(src).not.toMatch(/role:\s*'student'/);
    expect(src).not.toContain('Portal Views');
  });
});
