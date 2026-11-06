import { describe, it, expect } from 'vitest';
import { SEATING_PRESETS } from '../lib/seatingPresets';
import { readSource } from './helpers/readSource';

describe('seatingPresets', () => {
  it('ภาพย่อมีจำนวนที่นั่งรวม = ความจุ และจำนวนกลุ่มตรงกัน', () => {
    for (const p of SEATING_PRESETS) {
      expect(p.preview.reduce((n, g) => n + g.count, 0), p.id).toBe(p.totalCapacity);
      expect(p.preview.length, p.id).toBe(p.groupsCount);
    }
  });

  it('มีแม่แบบ 5 แถวคู่ และทุกแม่แบบมีตัวสร้างผังใน ClassroomSeatingManager', () => {
    expect(SEATING_PRESETS.some(p => p.id === 'preset_double_5_40' && p.groupsCount === 5 && p.totalCapacity === 40)).toBe(true);
    const mgr = readSource('src/components/ClassroomSeatingManager.tsx');
    for (const p of SEATING_PRESETS) expect(mgr, p.id).toContain(`'${p.id}'`);
  });

  it('id ไม่ซ้ำ', () => {
    expect(new Set(SEATING_PRESETS.map(p => p.id)).size).toBe(SEATING_PRESETS.length);
  });
});
