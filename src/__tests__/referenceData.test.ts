import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { readSource } from './helpers/readSource';
import {
  cleanPhone, withSchoolPrefix, mergeSchools, mergeVillages, searchSchools, schoolToInfoPatch,
  buildSchoolOverride, buildVillageOverride, newCustomId, type SchoolBase, type VillageBase,
} from '../lib/referenceData';
import type { SchoolOverrideDoc, VillageOverrideDoc } from '../types/reference';

const src = (rel: string) => readSource(path.resolve(__dirname, '..', rel));
const sBase: SchoolBase[] = [
  ['1001', 'โรงเรียนบ้านท่าเสา', 'ท่าเสา', 'เมือง', 'สพป.อต.1', '055411234', 'ป.6'],
  ['1002', 'โรงเรียนอุตรดิตถ์', 'ท่าอิฐ', 'เมือง', 'สพม.40', '055411111', 'ม.6'],
];
const sOv = (o: Partial<SchoolOverrideDoc>): SchoolOverrideDoc => ({ id: 'x', baseCode: null, disabled: false, provinceCode: '53', name: 'โรงเรียนใหม่', subdistrict: '', district: '', affiliation: '', telephone: '', classMax: '', updatedAt: 't', updatedBy: 'u', ...o } as SchoolOverrideDoc);

describe('cleanPhone / withSchoolPrefix', () => {
  it('คงเฉพาะเลข, 8 หลักเติม 0, ผิดรูปแบบคืนว่าง', () => {
    expect(cleanPhone('055-411234')).toBe('055411234');
    expect(cleanPhone('55411234')).toBe('055411234');
    expect(cleanPhone('๐๕๕๔๑๑๒๓๔')).toBe('055411234');
    expect(cleanPhone('12345')).toBe('');
    expect(cleanPhone(null)).toBe('');
  });
  it('เติมคำว่า โรงเรียน เมื่อไม่มี', () => {
    expect(withSchoolPrefix('บ้านนา')).toBe('โรงเรียนบ้านนา');
    expect(withSchoolPrefix('โรงเรียนบ้านนา')).toBe('โรงเรียนบ้านนา');
  });
});

describe('mergeSchools', () => {
  it('ชุดหลักล้วน: ไม่มีรายการแก้ไข/ซ่อน', () => {
    const r = mergeSchools(sBase, []);
    expect(r).toHaveLength(2);
    expect(r.every(s => s.source === 'BASE' && !s.disabled)).toBe(true);
  });
  it('override ของชุดหลักแทนค่า; ซ่อนแล้วนักเรียนไม่เห็นแต่แอดมินเห็น', () => {
    const ov = [sOv({ id: 'b_1001', baseCode: '1001', name: 'โรงเรียนบ้านท่าเสา (แก้)', disabled: true })];
    expect(mergeSchools(sBase, ov).map(s => s.moeCode)).toEqual(['1002']);
    const all = mergeSchools(sBase, ov, { includeDisabled: true });
    const edited = all.find(s => s.moeCode === '1001')!;
    expect(edited.source).toBe('BASE_EDITED');
    expect(edited.disabled).toBe(true);
    expect(edited.overrideId).toBe('b_1001');
  });
  it('รายการที่เพิ่มเองมี source CUSTOM และ moeCode เป็น null', () => {
    const r = mergeSchools(sBase, [sOv({ id: 'c_1' })]);
    const c = r.find(s => s.source === 'CUSTOM')!;
    expect(c.moeCode).toBeNull();
    expect(r).toHaveLength(3);
  });
});

describe('mergeVillages', () => {
  const vBase: VillageBase[] = [[2, 'บ้านสอง', '53010102'], [1, 'บ้านหนึ่ง', '53010101']];
  const vOv = (o: Partial<VillageOverrideDoc>): VillageOverrideDoc => ({ id: 'x', baseCode: null, disabled: false, provinceCode: '53', amphoeCode: '5301', tambonCode: '530101', moo: null, name: 'ชุมชนใหม่', updatedAt: 't', updatedBy: 'u', ...o } as VillageOverrideDoc);
  it('เรียงตามหมู่; ชุมชน (ไม่มีหมู่) อยู่ท้าย', () => {
    const r = mergeVillages(vBase, [vOv({ id: 'c_1' })]);
    expect(r.map(v => v.name)).toEqual(['บ้านหนึ่ง', 'บ้านสอง', 'ชุมชนใหม่']);
  });
  it('ซ่อน/แก้ชุดหลักผ่าน b_<code>', () => {
    const ov = [vOv({ id: 'b_53010101', baseCode: '53010101', moo: 1, name: 'บ้านหนึ่งใหม่', disabled: true })];
    expect(mergeVillages(vBase, ov).map(v => v.code)).toEqual(['53010102']);
    expect(mergeVillages(vBase, ov, { includeDisabled: true }).find(v => v.code === '53010101')!.name).toBe('บ้านหนึ่งใหม่');
  });
});

describe('searchSchools / schoolToInfoPatch', () => {
  const list = mergeSchools(sBase, []);
  it('ค้นโดยไม่ต้องพิมพ์คำว่า โรงเรียน; ขึ้นต้นตรงมาก่อน; ค้นตามตำบลได้', () => {
    expect(searchSchools(list, 'บ้านท่า')[0].moeCode).toBe('1001');
    expect(searchSchools(list, 'ท่าอิฐ').map(s => s.moeCode)).toEqual(['1002']);
    expect(searchSchools(list, '')).toHaveLength(2);
    expect(searchSchools(list, 'ไม่มีแน่นอน')).toHaveLength(0);
  });
  it('patch เติมฟอร์มข้อ 2 รวมรหัส สพฐ.', () => {
    const p = schoolToInfoPatch(list.find(s => s.moeCode === '1001')!, 'อุตรดิตถ์');
    expect(p).toMatchObject({ prevSchool: 'โรงเรียนบ้านท่าเสา', prevProvince: 'อุตรดิตถ์', prevPhone: '055411234', prevSchoolMoeCode: '1001' });
  });
});

describe('buildSchoolOverride / buildVillageOverride', () => {
  it('โรงเรียน: ต้องมีจังหวัดและชื่อ, เบอร์ผิดรูปแบบไม่ผ่าน, เติมคำนำหน้าและล้างเบอร์', () => {
    const base = { id: 'c_1', baseCode: null, provinceCode: '53', name: ' บ้านนา ', subdistrict: '', district: '', affiliation: '', telephone: '055-411234', classMax: '' };
    const ok = buildSchoolOverride(base, 'u', 'T');
    expect(ok.ok).toBe(true);
    if (ok.ok) { expect(ok.doc.name).toBe('โรงเรียนบ้านนา'); expect(ok.doc.telephone).toBe('055411234'); expect(ok.doc.updatedBy).toBe('u'); }
    expect(buildSchoolOverride({ ...base, name: '' }, 'u', 'T').ok).toBe(false);
    expect(buildSchoolOverride({ ...base, provinceCode: '' }, 'u', 'T').ok).toBe(false);
    expect(buildSchoolOverride({ ...base, telephone: '123' }, 'u', 'T').ok).toBe(false);
  });
  it('หมู่บ้าน: ตำบล 6 หลัก, ชื่อ, หมู่เป็นเลข 1-2 หลักหรือว่าง (→ null)', () => {
    const base = { id: 'c_1', baseCode: null, provinceCode: '53', amphoeCode: '5301', tambonCode: '530101', moo: '', name: 'ชุมชนวัด' };
    const r = buildVillageOverride(base, 'u', 'T');
    expect(r.ok && r.doc.moo).toBeNull();
    const r2 = buildVillageOverride({ ...base, moo: '7' }, 'u', 'T');
    expect(r2.ok && r2.doc.moo).toBe(7);
    expect(buildVillageOverride({ ...base, moo: 'ก' }, 'u', 'T').ok).toBe(false);
    expect(buildVillageOverride({ ...base, tambonCode: '' }, 'u', 'T').ok).toBe(false);
    expect(buildVillageOverride({ ...base, name: ' ' }, 'u', 'T').ok).toBe(false);
  });
  it('newCustomId ขึ้นต้น c_ และไม่ซ้ำ', () => {
    expect(newCustomId()).toMatch(/^c_/);
    expect(newCustomId()).not.toBe(newCustomId());
  });
});

describe('ข้อมูลโรงเรียน src/data/schools', () => {
  const dir = path.resolve(__dirname, '../data/schools');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  const all = files.flatMap(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as SchoolBase[]);
  it('77 จังหวัด / 29,642 โรง; โครงสร้างแถวครบ 7 ช่อง; เบอร์ว่างหรือถูกรูปแบบ', () => {
    expect(files).toHaveLength(77);
    expect(all).toHaveLength(29642);
    expect(all.every(r => r.length === 7 && r[0] && r[1])).toBe(true);
    expect(all.every(r => r[5] === '' || /^0\d{8,9}$/.test(r[5]))).toBe(true);
  });
  it('อุตรดิตถ์ (53) มีข้อมูล', () => {
    expect(JSON.parse(fs.readFileSync(path.join(dir, '53.json'), 'utf8')).length).toBeGreaterThan(100);
  });
});

describe('guard: เมนูแอดมิน / rules / การเดินสาย', () => {
  it('AdminPortal มีเมนู ref-villages และ ref-schools พร้อมหน้า', () => {
    const s = src('AdminPortal.tsx');
    expect(s).toContain("id: 'ref-villages'");
    expect(s).toContain("id: 'ref-schools'");
    expect(s).toContain('<AdminReferenceVillagesPage />');
    expect(s).toContain('<AdminReferenceSchoolsPage />');
  });
  it('หน้าแอดมินไม่ใช้ window.confirm และเขียนผ่าน saveReferenceOverride', () => {
    for (const f of ['components/admin/AdminReferenceSchoolsPage.tsx', 'components/admin/AdminReferenceVillagesPage.tsx']) {
      const s = src(f);
      expect(s).not.toMatch(/window\.confirm|\bconfirm\(/);
      expect(s).toContain('saveReferenceOverride');
      expect(s).toContain('includeDisabled: true');
    }
  });
  it('rules: reference_* อ่านได้เมื่อล็อกอิน เขียน/ลบเฉพาะ SUPER_ADMIN', () => {
    const r = readSource(path.resolve(__dirname, '../../firestore.rules'));
    for (const col of ['reference_schools', 'reference_villages']) {
      const i = r.indexOf(`match /${col}/`);
      expect(i).toBeGreaterThan(-1);
      const block = r.slice(i, i + 900);
      expect(block).toMatch(/allow read: if isSignedIn\(\)/);
      expect(block).toMatch(/allow delete: if hasRole\('SUPER_ADMIN'\)/);
      expect(block).not.toMatch(/allow (create|update|write)[^;]*isSignedIn\(\)\s*;/);
    }
  });
  it('นักเรียนเห็นเฉพาะรายการที่ไม่ซ่อน และแบบฟอร์มต่อ SchoolPicker / useVillageDirectory', () => {
    expect(src('components/homevisit/SchoolPicker.tsx')).toContain('useSchoolDirectory');
    expect(src('components/homevisit/SchoolPicker.tsx')).not.toContain('includeDisabled: true');
    expect(src('components/homevisit/AddressFields.tsx')).toContain('useVillageDirectory');
    expect(src('components/homevisit/StudentHomeVisitInfoForm.tsx')).toContain('<SchoolPicker');
  });
});
