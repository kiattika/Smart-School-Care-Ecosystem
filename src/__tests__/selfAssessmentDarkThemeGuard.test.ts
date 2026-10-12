import { describe, it, expect } from 'vitest';
import { readSource } from './helpers/readSource';

describe('ฟอร์มประเมินตนเองใช้ธีมมืดเหมือนหน้าหลัก', () => {
  const src = readSource('src/components/StudentSelfAssessmentForm.tsx');
  it('การ์ดหลักไม่ใช่พื้นขาว', () => {
    expect(src).toMatch(/id="student-self-assessment-form-container" className="bg-slate-900\/70/);
  });
  it('ส่วนเนื้อหาไม่มีพื้นขาว/ตัวหนังสือเทาเข้มบนพื้นมืด', () => {
    // ตัดส่วนหัว/ตัวบอกขั้น (ตั้งใจใช้พื้นขาวโปร่ง) ด้วย marker แทนเลขบรรทัดที่เลื่อนทุกครั้งที่แก้ไฟล์
    const content = src.slice(src.indexOf('SECTION 1'));
    expect(content).not.toMatch(/\bbg-white(?![/\w-])|\bbg-slate-50\b|\btext-slate-(700|900)\b|\bborder-slate-(200|300)\b/);
  });
  it('ช่องกรอกมีตัวหนังสือสีสว่าง', () => {
    expect(src).toMatch(/text-sm text-white placeholder:text-slate-500 rounded-xl border/);
  });
});
