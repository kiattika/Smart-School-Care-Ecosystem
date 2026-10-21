import { describe, it, expect } from 'vitest';
import { plcProgress, PLC_RECOMMENDED_CYCLES } from '../lib/teachingGuidance';

describe('plcProgress', () => {
  it('ไม่มีบันทึก = แนะนำให้ครบวงจร', () => {
    const p = plcProgress([]);
    expect(p.completedCycles).toBe(0);
    expect(p.inProgress).toBeNull();
    expect(p.summary).toMatch(/ยังไม่มีบันทึก/);
  });
  it('ขาดขั้น = บอกขั้นที่ขาด', () => {
    const p = plcProgress([{ groupName: 'ก', topic: 'ข', steps: ['PLAN', 'DO'] }]);
    expect(p.inProgress?.missing).toEqual(['CHECK', 'ACT']);
    expect(p.summary).toMatch(/ตรวจสอบ/);
  });
  it('ครบวงจรตามข้อเสนอแนะ', () => {
    const p = plcProgress([{ groupName: 'ก', topic: 'ข', steps: ['PLAN', 'DO', 'CHECK', 'ACT'] }]);
    expect(p.completedCycles).toBeGreaterThanOrEqual(PLC_RECOMMENDED_CYCLES);
    expect(p.summary).toMatch(/ครบ/);
  });
});
