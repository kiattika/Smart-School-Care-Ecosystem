import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { readSource } from './helpers/readSource';
import {
  emptyThaiAddress, formatThaiAddress, validateThaiAddress, withProvince, withAmphoe, withTambon, withVillage, villageLabel,
  type ProvinceRef, type VillageMap,
} from '../lib/thaiAddress';
import { validateStudentInfo, emptyStudentInfo } from '../lib/homeVisitData';

const dir = path.resolve(__dirname, '../data/thaiAddress');
const areas = JSON.parse(fs.readFileSync(path.join(dir, 'areas.json'), 'utf8')) as ProvinceRef[];
const villages = JSON.parse(fs.readFileSync(path.join(dir, 'villages.json'), 'utf8')) as VillageMap;
const prov = (code: string) => areas.find(p => p[0] === code)!;

describe('ข้อมูลอ้างอิงที่อยู่', () => {
  it('ครบ 77 จังหวัด และตำบลทุกตำบลมีรหัสไปรษณีย์ 5 หลักอย่างน้อย 1 รหัส', () => {
    expect(areas).toHaveLength(77);
    for (const p of areas) for (const a of p[2]) for (const t of a[2]) {
      expect(t[0]).toMatch(/^\d{6}$/);
      expect(t[2].length, `${p[1]}/${a[1]}/${t[1]}`).toBeGreaterThan(0);
      t[2].forEach(c => expect(c).toMatch(/^\d{5}$/));
    }
  });
  it('อุตรดิตถ์ 9 อำเภอ 67 ตำบล และกระบี่ 8 อำเภอ 53 ตำบล', () => {
    const count = (p: ProvinceRef) => p[2].reduce((n, a) => n + a[2].length, 0);
    expect([prov('53')[2].length, count(prov('53'))]).toEqual([9, 67]);
    expect([prov('81')[2].length, count(prov('81'))]).toEqual([8, 53]);
  });
  it('หมู่บ้านทุกแห่งอยู่ในตำบลที่มีจริง และเลขหมู่ (ถ้ามี) อยู่ใน 1-49', () => {
    const tambons = new Set(areas.flatMap(p => p[2].flatMap(a => a[2].map(t => t[0]))));
    let total = 0;
    for (const [tid, list] of Object.entries(villages)) {
      expect(tambons.has(tid)).toBe(true);
      for (const v of list) { total++; if (v[0] !== null) { expect(v[0]).toBeGreaterThanOrEqual(1); expect(v[0]).toBeLessThan(50); } expect(v[1].length).toBeGreaterThan(0); }
    }
    expect(total).toBe(1047);
    expect(Object.keys(villages).every(k => k.startsWith('53') || k.startsWith('81'))).toBe(true);
  });
  it('ไม่เก็บคอลัมน์สำรวจ/พิกัดของ DOPA ลงข้อมูลที่ฝังในแอป', () => {
    const raw = fs.readFileSync(path.join(dir, 'villages.json'), 'utf8');
    expect(raw).not.toMatch(/"q0|lat|long/);
  });
});

describe('ตรรกะที่อยู่', () => {
  const uttaradit = prov('53');
  const mueang = uttaradit[2].find(a => a[1] === 'เมืองอุตรดิตถ์')!;
  const tambon = mueang[2][0];
  it('เลือกจังหวัด→อำเภอ→ตำบล เติมรหัสไปรษณีย์เมื่อมีรหัสเดียว และเปลี่ยนระดับบนล้างระดับล่าง', () => {
    let a = { ...emptyThaiAddress(), houseNo: '12', soi: '4' };
    a = withProvince(a, uttaradit); a = withAmphoe(a, mueang); a = withTambon(a, tambon);
    expect(a).toMatchObject({ provinceCode: '53', province: 'อุตรดิตถ์', amphoe: 'เมืองอุตรดิตถ์', tambon: tambon[1], houseNo: '12', soi: '4' });
    expect(a.postalCode).toBe(tambon[2].length === 1 ? tambon[2][0] : '');
    const b = withAmphoe(a, uttaradit[2][1]);
    expect(b).toMatchObject({ tambonCode: '', tambon: '', postalCode: '', houseNo: '12' });
  });
  it('เลือกหมู่บ้านเติมหมู่ที่; ชุมชน (หมู่ ≥ 50) ไม่เติมเลขหมู่', () => {
    const base = withTambon(withAmphoe(withProvince(emptyThaiAddress(), uttaradit), mueang), tambon);
    const v: [number, string, string] = [3, 'บ้านสวน', '53010103'];
    expect(withVillage(base, v)).toMatchObject({ moo: '3', village: 'บ้านสวน', villageCode: '53010103' });
    expect(villageLabel(v)).toBe('หมู่ 3 บ้านสวน');
    expect(withVillage(base, [null, 'ชุมชนตัวอย่าง', '53010150']).moo).toBe('');
    expect(withVillage(withVillage(base, v), null)).toMatchObject({ moo: '', village: '', villageCode: '' });
  });
  it('formatThaiAddress / validateThaiAddress', () => {
    const a = { ...emptyThaiAddress(), houseNo: '12/3', moo: '5', village: 'บ้านสวน', soi: '4', road: 'ใหญ่', provinceCode: '53', province: 'อุตรดิตถ์', amphoeCode: '5301', amphoe: 'เมืองอุตรดิตถ์', tambonCode: '530101', tambon: 'ในเมือง', postalCode: '53000' };
    expect(formatThaiAddress(a)).toBe('12/3 หมู่ 5 บ้านสวน ซอย 4 ถนน ใหญ่ ต.ในเมือง อ.เมืองอุตรดิตถ์ จ.อุตรดิตถ์ 53000');
    expect(validateThaiAddress(a)).toEqual([]);
    expect(validateThaiAddress({ ...a, houseNo: '', postalCode: '5300' })).toEqual(['ระบุบ้านเลขที่', 'ระบุรหัสไปรษณีย์ 5 หลัก']);
    expect(validateThaiAddress(null)).toHaveLength(1);
    expect(formatThaiAddress(null)).toBe('');
  });
  it('validateStudentInfo: บังคับที่อยู่แบบแยกช่องเฉพาะเมื่อทะเบียนส่วนกลางไม่มีที่อยู่', () => {
    const s = emptyStudentInfo({ studentId: '1', studentUid: 'u', homeroomClass: 'ม.5/8' });
    expect(validateStudentInfo(s).some(m => m.includes('ที่อยู่'))).toBe(true);
    expect(validateStudentInfo(s, { centralAddress: '99 ม.1 ต.ท่าอิฐ' }).some(m => m.includes('ที่อยู่'))).toBe(false);
  });
});

describe('guard: ฟอร์มนักเรียนใช้ AddressFields เฉพาะเมื่อไม่มีที่อยู่ส่วนกลาง', () => {
  it('StudentHomeVisitInfoForm', () => {
    const src = readSource('src/components/homevisit/StudentHomeVisitInfoForm.tsx');
    expect(src).toMatch(/\{!centralAddress && \(/);
    expect(src).toMatch(/<AddressFields value=\{form\.currentAddress\}/);
    expect(src).toMatch(/validateStudentInfo\(form, \{ centralAddress \}\)/);
  });
});

describe('ที่อยู่ตามทะเบียนบ้าน (ข้อ 4) แบบแยกช่อง', () => {
  const full = (over: object = {}) => ({ ...emptyThaiAddress(), houseNo: '9', provinceCode: '53', province: 'อุตรดิตถ์', amphoeCode: '5301', amphoe: 'เมืองอุตรดิตถ์', tambonCode: '530101', tambon: 'ท่าอิฐ', postalCode: '53000', ...over });
  const base = () => ({ ...emptyStudentInfo({ studentId: '10001', studentUid: 'u1', homeroomClass: 'ม.5/8' }), gender: 'ชาย', birthDate: '2010-01-01', nationality: 'ไทย', ethnicity: 'ไทย', religion: 'พุทธ', prevEducationLevel: 'มัธยมศึกษาตอนต้น', prevSchool: 'โรงเรียนทดสอบ' } as any);
  const regErrors = (s: any) => validateStudentInfo(s, { centralAddress: '99 ม.1' }).filter(m => m.startsWith('ที่อยู่ตามทะเบียนบ้าน'));

  it('เหมือนที่อยู่ปัจจุบัน → ไม่บังคับ', () => {
    expect(regErrors({ ...base(), registeredSameAsCurrent: true })).toEqual([]);
  });
  it('ไม่เหมือน + ยังไม่กรอก → ต้องกรอกแยกช่อง; กรอกครบ → ผ่าน', () => {
    expect(regErrors({ ...base(), registeredSameAsCurrent: false }).length).toBeGreaterThan(0);
    expect(regErrors({ ...base(), registeredSameAsCurrent: false, registeredAddressStructured: full() })).toEqual([]);
    expect(regErrors({ ...base(), registeredSameAsCurrent: false, registeredAddressStructured: full({ postalCode: '' }) }).length).toBeGreaterThan(0);
  });
  it('ข้อมูลเก่าที่พิมพ์เองไว้ (ไม่มี structured) ผ่านโดยไม่บังคับกรอกใหม่', () => {
    expect(regErrors({ ...base(), registeredSameAsCurrent: false, registeredAddress: '12 ม.3 ต.ท่าอิฐ' })).toEqual([]);
  });
  it('ฟอร์มใช้ AddressFields และสร้างข้อความรวมใน registeredAddress ให้เสมอ', () => {
    const src = readSource('src/components/homevisit/StudentHomeVisitInfoForm.tsx');
    expect(src).toContain('data-testid="registered-address"');
    expect(src).toMatch(/registeredAddressStructured: a, registeredAddress: formatThaiAddress\(a\)/);
    expect(src).not.toMatch(/<textarea[^>]*registeredAddress/);
  });
});
