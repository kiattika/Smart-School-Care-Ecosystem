import { describe, it, expect } from 'vitest';
import { buildExistingEmailIndex, staffEmailConflict } from '../lib/staffEmailConflict';

const existing = buildExistingEmailIndex([
  { id: 'teacher_kiattisak', email: 'Kiattisak@utd.ac.th ' },
  { id: 'kiattisak@utd.ac.th', email: 'kiattisak@utd.ac.th' }, // alias เก่า (id = อีเมล) ต้องถูกข้าม
  { id: 'abc', email: '' },
]);

describe('staffEmailConflict', () => {
  it('อีเมลเดียวกันแต่คนละรหัสกับที่มีอยู่ → ไม่นำเข้า', () => {
    const msg = staffEmailConflict('mat-18', 'kiattisak@utd.ac.th', existing, new Map());
    expect(msg).toContain('teacher_kiattisak');
  });
  it('นำเข้าซ้ำรหัสเดิมอีเมลเดิม (อัปเดต) → ผ่าน', () => {
    expect(staffEmailConflict('teacher_kiattisak', 'KIATTISAK@utd.ac.th', existing, new Map())).toBeNull();
  });
  it('อีเมลใหม่ → ผ่าน', () => {
    expect(staffEmailConflict('x1', 'new@utd.ac.th', existing, new Map())).toBeNull();
  });
  it('อีเมลซ้ำกันเองในไฟล์ (คนละรหัส) → แถวหลังถูกปฏิเสธ แถวแรกผ่าน', () => {
    const seen = new Map<string, string>();
    expect(staffEmailConflict('a1', 'dup@utd.ac.th', existing, seen)).toBeNull();
    expect(staffEmailConflict('a2', 'dup@utd.ac.th', existing, seen)).toContain('a1');
  });
  it('ไม่มีอีเมล → ไม่ตัดสิน (ตรวจที่อื่น)', () => {
    expect(staffEmailConflict('z', '', existing, new Map())).toBeNull();
  });
});
