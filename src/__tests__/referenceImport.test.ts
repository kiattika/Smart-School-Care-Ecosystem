import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import fs from 'node:fs';
import path from 'node:path';
import { readSource } from './helpers/readSource';
import {
  SCHOOL_HEADERS, VILLAGE_HEADERS, toCsv, exportSchoolsOfProvince, exportAllVillages, planSchoolImport, planVillageImport, planToWrites, summarize,
} from '../lib/referenceImport';
import type { SchoolBase, VillageBase } from '../lib/referenceData';
import type { SchoolOverrideDoc, VillageOverrideDoc } from '../types/reference';
import type { ProvinceRef } from '../lib/thaiAddress';

const provinces: ProvinceRef[] = [['53', 'อุตรดิตถ์', [['5301', 'เมืองอุตรดิตถ์', [['530101', 'ท่าอิฐ', ['53000']], ['530102', 'ท่าเสา', ['53000']]]]]]];
const sBase: SchoolBase[] = [
  ['1001', 'โรงเรียนบ้านท่าเสา', 'ท่าเสา', 'เมือง', 'สพป.อต.1', '055411234', 'ป.6'],
  ['1002', 'โรงเรียนอุตรดิตถ์', 'ท่าอิฐ', 'เมือง', 'สพม.40', '055411111', 'ม.6'],
];
const vBase: Record<string, VillageBase[]> = { '530101': [[1, 'บ้านหนึ่ง', '53010101'], [2, 'บ้านสอง', '53010102']] };
const BY = 'adm', NOW = 'T';
let n = 0; const mk = () => `c_test${++n}`;
const sOv = (o: Partial<SchoolOverrideDoc>): SchoolOverrideDoc => ({ id: 'x', baseCode: null, disabled: false, provinceCode: '53', name: 'โรงเรียนใหม่', subdistrict: '', district: '', affiliation: '', telephone: '', classMax: '', updatedAt: 't', updatedBy: 'u', ...o } as SchoolOverrideDoc);
const toObjects = (header: readonly string[], rows: string[][]) => rows.map(r => Object.fromEntries(header.map((h, i) => [h, r[i]])));
const ctx = (overrides: SchoolOverrideDoc[] = []) => ({ provinces, baseByProvince: { '53': sBase }, overrides });

describe('ส่งออก', () => {
  it('โรงเรียน: แถวต่อโรงเรียน, ระบุแหล่งที่มา/สถานะ รวมที่ซ่อน', () => {
    const rows = exportSchoolsOfProvince(sBase, [sOv({ id: 'b_1001', baseCode: '1001', name: 'โรงเรียนบ้านท่าเสา', disabled: true }), sOv({ id: 'c_1', name: 'โรงเรียนเพิ่มเอง' })], '53', 'อุตรดิตถ์');
    expect(rows).toHaveLength(3);
    const hidden = rows.find(r => r[2] === '1001')!;
    expect(hidden[9]).toBe('แก้ไขแล้ว'); expect(hidden[10]).toBe('ซ่อน');
    const custom = rows.find(r => r[3] === 'โรงเรียนเพิ่มเอง')!;
    expect(custom[2]).toBe(''); expect(custom[9]).toBe('เพิ่มเอง'); expect(custom[10]).toBe('แสดง');
    expect(rows.every(r => r.length === SCHOOL_HEADERS.length)).toBe(true);
  });
  it('หมู่บ้าน: ตำบลที่ไม่มีข้อมูลไม่ออกแถว; ชุมชนไม่มีหมู่ → หมู่ว่าง; แถวครบคอลัมน์', () => {
    const ov: VillageOverrideDoc[] = [{ id: 'c_1', baseCode: null, disabled: false, provinceCode: '53', amphoeCode: '5301', tambonCode: '530102', moo: null, name: 'ชุมชนวัด', updatedAt: 't', updatedBy: 'u' }];
    const rows = exportAllVillages(provinces, vBase, ov);
    expect(rows.map(r => r[7])).toEqual(['บ้านหนึ่ง', 'บ้านสอง', 'ชุมชนวัด']);
    expect(rows[2][6]).toBe(''); expect(rows[2][8]).toBe('');
    expect(rows.every(r => r.length === VILLAGE_HEADERS.length)).toBe(true);
  });
  it('CSV: BOM, escape , " ขึ้นบรรทัดใหม่ และอ่านกลับด้วย XLSX ได้ครบภาษาไทย (round-trip)', () => {
    const rows = [['53', 'อุตรดิตถ์', '', 'โรงเรียน "ตัวอย่าง", สาขา', '', '', '', '', '', 'เพิ่มเอง', 'แสดง']];
    const csv = toCsv(SCHOOL_HEADERS, rows);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const wb = XLSX.read(csv, { type: 'string' });
    const parsed = XLSX.utils.sheet_to_json<Record<string, string>>(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    expect(parsed[0]['ชื่อโรงเรียน']).toBe('โรงเรียน "ตัวอย่าง", สาขา');
    expect(parsed[0]['จังหวัด']).toBe('อุตรดิตถ์');
  });
});

describe('planSchoolImport', () => {
  it('ส่งออกแล้วนำเข้ากลับโดยไม่แก้ → ไม่เปลี่ยนอะไรเลย (idempotent)', () => {
    const ov = [sOv({ id: 'c_1', name: 'โรงเรียนเพิ่มเอง' }), sOv({ id: 'b_1002', baseCode: '1002', name: 'โรงเรียนอุตรดิตถ์ (แก้)', subdistrict: 'ท่าอิฐ', district: 'เมือง', affiliation: 'สพม.40', telephone: '055411111', classMax: 'ม.6' })];
    const rows = toObjects(SCHOOL_HEADERS, exportSchoolsOfProvince(sBase, ov, '53', 'อุตรดิตถ์'));
    const res = planSchoolImport(rows, ctx(ov), BY, NOW, mk);
    expect(summarize(res)).toMatchObject({ NEW: 0, UPDATE: 0, RESTORE: 0, ERROR: 0 });
  });
  it('แก้ชุดหลัก → UPDATE (b_<รหัส>); ซ่อน → disabled; กลับเท่าชุดหลักและมี override → RESTORE', () => {
    const base = Object.fromEntries(SCHOOL_HEADERS.map((h, i) => [h, ['53', 'อุตรดิตถ์', '1001', 'โรงเรียนบ้านท่าเสา', 'ท่าเสา', 'เมือง', 'สพป.อต.1', '055411234', 'ป.6', 'ชุดหลัก', 'แสดง'][i]]));
    const edited = planSchoolImport([{ ...base, 'โทรศัพท์': '055000000', 'สถานะ': 'ซ่อน' }], ctx(), BY, NOW, mk)[0];
    expect(edited.action).toBe('UPDATE');
    expect(edited.doc).toMatchObject({ id: 'b_1001', baseCode: '1001', telephone: '055000000', disabled: true });
    const restored = planSchoolImport([base], ctx([sOv({ id: 'b_1001', baseCode: '1001', name: 'โรงเรียนอื่น' })]), BY, NOW, mk)[0];
    expect(restored).toMatchObject({ action: 'RESTORE', deleteId: 'b_1001' });
  });
  it('แถวใหม่ไม่มีรหัส → NEW เติม "โรงเรียน" นำหน้า; ชื่อซ้ำในไฟล์/ซ้ำกับของเดิมจับคู่เป็น UPDATE', () => {
    const row = { 'รหัสจังหวัด': '53', 'ชื่อโรงเรียน': 'บ้านนา', 'โทรศัพท์': '055-123456' };
    const res = planSchoolImport([row, row], ctx(), BY, NOW, mk);
    expect(res[0].action).toBe('NEW'); expect(res[0].doc?.name).toBe('โรงเรียนบ้านนา'); expect(res[0].doc?.telephone).toBe('055123456');
    expect(res[1].action).toBe('ERROR');
    const upd = planSchoolImport([{ ...row, 'โทรศัพท์': '055999999' }], ctx([sOv({ id: 'c_9', name: 'โรงเรียนบ้านนา', telephone: '055123456' })]), BY, NOW, mk)[0];
    expect(upd).toMatchObject({ action: 'UPDATE' }); expect(upd.doc?.id).toBe('c_9');
  });
  it('ข้อผิดพลาด: ไม่รู้จักจังหวัด / รหัส สพฐ. ไม่มีในชุดหลัก / ไม่มีชื่อ / เบอร์ผิด; รับชื่อจังหวัดแทนรหัสได้', () => {
    const res = planSchoolImport([
      { 'ชื่อโรงเรียน': 'ก', 'จังหวัด': 'ไม่มีจริง' },
      { 'รหัสจังหวัด': '53', 'รหัส สพฐ.': '9999', 'ชื่อโรงเรียน': 'ข' },
      { 'รหัสจังหวัด': '53', 'ชื่อโรงเรียน': '' , 'ตำบล': 'x' },
      { 'รหัสจังหวัด': '53', 'ชื่อโรงเรียน': 'ค', 'โทรศัพท์': '123' },
      { 'จังหวัด': 'จังหวัดอุตรดิตถ์', 'ชื่อโรงเรียน': 'ง' },
    ], ctx(), BY, NOW, mk);
    expect(res.map(r => r.action)).toEqual(['ERROR', 'ERROR', 'ERROR', 'ERROR', 'NEW']);
  });
  it('แถวว่างทั้งแถวข้ามไป (UNCHANGED)', () => {
    expect(planSchoolImport([{ 'ชื่อโรงเรียน': '', 'รหัสจังหวัด': '' }], ctx(), BY, NOW, mk)[0].action).toBe('UNCHANGED');
  });
});

describe('planVillageImport', () => {
  const vctx = (overrides: VillageOverrideDoc[] = []) => ({ areas: provinces, baseMap: vBase, overrides });
  it('ส่งออกแล้วนำเข้ากลับ → ไม่เปลี่ยน', () => {
    const rows = toObjects(VILLAGE_HEADERS, exportAllVillages(provinces, vBase, []));
    expect(summarize(planVillageImport(rows, vctx(), BY, NOW, mk))).toMatchObject({ NEW: 0, UPDATE: 0, RESTORE: 0, ERROR: 0 });
  });
  it('แก้ชื่อชุดหลัก → UPDATE b_<รหัส>; เพิ่มใหม่ไม่มีรหัส → NEW (หมู่ว่าง = ชุมชน); ตำบลผิด/รหัสหมู่บ้านผิด → ERROR', () => {
    const res = planVillageImport([
      { 'รหัสตำบล': '530101', 'รหัสหมู่บ้าน': '53010101', 'หมู่ที่': '1', 'ชื่อหมู่บ้าน/ชุมชน': 'บ้านหนึ่งใหม่' },
      { 'รหัสตำบล': '530102', 'หมู่ที่': '', 'ชื่อหมู่บ้าน/ชุมชน': 'ชุมชนวัด' },
      { 'รหัสตำบล': '999999', 'ชื่อหมู่บ้าน/ชุมชน': 'ผิด' },
      { 'รหัสตำบล': '530101', 'รหัสหมู่บ้าน': '00000000', 'ชื่อหมู่บ้าน/ชุมชน': 'ผิด' },
      { 'รหัสตำบล': '530101', 'หมู่ที่': 'ก', 'ชื่อหมู่บ้าน/ชุมชน': 'หมู่ผิด' },
    ], vctx(), BY, NOW, mk);
    expect(res.map(r => r.action)).toEqual(['UPDATE', 'NEW', 'ERROR', 'ERROR', 'ERROR']);
    expect(res[0].doc).toMatchObject({ id: 'b_53010101', moo: 1, name: 'บ้านหนึ่งใหม่', provinceCode: '53', amphoeCode: '5301' });
    expect(res[1].doc).toMatchObject({ moo: null, baseCode: null });
  });
  it('planToWrites แยกเขียน/ลบ ข้าม UNCHANGED และ ERROR', () => {
    const res = planSchoolImport([
      { 'รหัสจังหวัด': '53', 'ชื่อโรงเรียน': 'ใหม่' },
      { 'รหัสจังหวัด': '53', 'รหัส สพฐ.': '1001', 'ชื่อโรงเรียน': 'โรงเรียนบ้านท่าเสา', 'ตำบล': 'ท่าเสา', 'อำเภอ/เขต': 'เมือง', 'สังกัด': 'สพป.อต.1', 'โทรศัพท์': '055411234', 'ระดับสูงสุดที่เปิดสอน': 'ป.6' },
      { 'รหัสจังหวัด': 'zz', 'ชื่อโรงเรียน': 'ผิด' },
    ], ctx([sOv({ id: 'b_1001', baseCode: '1001', name: 'อื่น' })]), BY, NOW, mk);
    const { writes, deleteIds } = planToWrites(res);
    expect(writes).toHaveLength(1); expect(deleteIds).toEqual(['b_1001']);
  });
});

describe('guard: การ์ดนำเข้า/ส่งออกอยู่ในเมนู import ของแอดมินที่เดียว', () => {
  it('AdminPortal มีการ์ดโรงเรียน/หมู่บ้านในหน้า import และไม่เปิด modal นำเข้าเอง', () => {
    const s = readSource('src/AdminPortal.tsx');
    expect(s).toContain('REFERENCE_CARDS');
    expect(s).toContain('<ReferenceDataImportExport kind={card.kind} />');
    expect(s).toContain('import-card-ref-');
  });
  it('คอมโพเนนต์เขียนผ่าน commitReferenceChanges, จำกัด Super Admin, ไม่แจ้งสำเร็จก่อนเขียนจริง, ไม่ใช้ window.confirm', () => {
    const s = readSource('src/components/admin/ReferenceDataImportExport.tsx');
    expect(s).toContain('commitReferenceChanges');
    expect(s).toMatch(/isSuperAdmin/);
    expect(s).not.toMatch(/window\.confirm|\bconfirm\(/);
    expect(s.indexOf('await commitReferenceChanges')).toBeLessThan(s.indexOf('นำเข้าสำเร็จ:'));
  });
  it('ข้อมูลชุดหลักมี 77 จังหวัดสำหรับส่งออกทั้งประเทศ', () => {
    expect(fs.readdirSync(path.resolve(__dirname, '../data/schools')).filter(f => f.endsWith('.json'))).toHaveLength(77);
  });
});
