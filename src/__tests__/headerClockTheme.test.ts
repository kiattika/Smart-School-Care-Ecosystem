import { describe, it, expect } from 'vitest';
import { readSource } from './helpers/readSource';

// ชิปนาฬิกาอยู่ในแถบบน (data-shell="topbar"): ธีมสว่างที่แถบเป็นสีเข้มคืนตัวหนังสือในแถบเป็นสีขาว
// แต่กฎโทเคนเปลี่ยน bg-[#0f172a] เป็นพื้นอ่อน → เวลา/วันที่ขาวบนพื้นอ่อน อ่านไม่ออก (พบ 28 ต.ค. 2569 ธีมชมพู)
describe('guard: ชิปนาฬิกาในแถบบนไม่ใช้พื้นหลังฮาร์ดโค้ด bg-[#hex]', () => {
  const src = readSource('src/components/HeaderRealTimeClock.tsx');
  it('ไม่มี bg-[#…] ใน className ของชิป', () => {
    // ตัดคอมเมนต์ JSX ออกก่อน (ข้อความอธิบายอาจกล่าวถึงรูปแบบนี้)
    const code = src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
    expect(code).not.toMatch(/bg-\[#[0-9a-fA-F]{3,8}\]/);
    expect(code).not.toMatch(/hover:bg-\[#/);
  });
  it('ใช้ขาวโปร่งตามกฎของแถบบน', () => {
    expect(src).toContain('bg-white/10');
  });
});
