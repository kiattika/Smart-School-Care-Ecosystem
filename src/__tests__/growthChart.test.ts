import { describe, it, expect } from 'vitest';
import { buildGrowthPoints, paddedDomain } from '../lib/growthChart';
import * as path from 'path';
import { readSource } from './helpers/readSource';
const src = (p: string) => readSource(path.resolve(__dirname, '..', p));

describe('growthChart helper', () => {
  it('เรียงตามปี/ภาคเรียน และข้ามค่าที่ไม่ใช่ตัวเลข', () => {
    const pts = buildGrowthPoints([
      { id: 'b', semester: '2/2569', academicYear: '2569', term: '2', height: 165, weight: 65, bmi: 23.9 },
      { id: 'a', semester: '1/2569', academicYear: '2569', term: '1', height: 163, weight: 60, bmi: 22.6 },
      { id: 'x', semester: '1/2568', academicYear: '2568', term: '1', height: NaN, weight: 50, bmi: 20 },
    ]);
    expect(pts.map((p) => p.label)).toEqual(['1/2569', '2/2569']);
  });
  it('ไม่มี log → ไม่มีจุด (ไม่สร้างข้อมูลปลอม)', () => {
    expect(buildGrowthPoints([])).toEqual([]);
  });
  it('paddedDomain ครอบค่าอ้างอิงและไม่หดเป็นศูนย์เมื่อค่าเท่ากัน', () => {
    const [lo, hi] = paddedDomain([20], [18.5, 22.9]);
    expect(lo).toBeLessThan(18.5);
    expect(hi).toBeGreaterThan(22.9);
    const [a, b] = paddedDomain([165]);
    expect(b).toBeGreaterThan(a);
  });
  it('โมดูลสุขภาพใช้กราฟและไม่ใช้สองแกน', () => {
    expect(src('components/student-parent/HealthMentalWellbeingModule.tsx')).toContain('<GrowthTrendChart');
    expect(src('components/health/GrowthTrendChart.tsx')).not.toMatch(/yAxisId|orientation="right"/);
  });
});
