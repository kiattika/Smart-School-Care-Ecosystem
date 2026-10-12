import type { SchoolOverrideDoc, VillageOverrideDoc } from '../types/reference';
import {
  buildSchoolOverride, buildVillageOverride, mergeSchools, mergeVillages, newCustomId, withSchoolPrefix,
  type SchoolBase, type VillageBase, type SchoolRecord, type VillageRecord,
} from './referenceData';
import type { ProvinceRef } from './thaiAddress';

/**
 * นำเข้า/ส่งออกรายชื่อโรงเรียนและหมู่บ้าน (ไฟล์ CSV/Excel) — ตรรกะบริสุทธิ์ ทดสอบได้
 * ไฟล์ที่ส่งออกนำกลับมานำเข้าได้ (round-trip) และใช้กับแอปอื่นได้ (หัวคอลัมน์ภาษาไทยเป็นข้อความธรรมดา)
 * นำเข้าเขียนเฉพาะ "ส่วนที่ต่างจากชุดหลัก" (override) เหมือนหน้าจัดการ — ไม่ลบ/แก้ชุดหลักที่ฝังในแอป
 */
export const SCHOOL_HEADERS = ['รหัสจังหวัด', 'จังหวัด', 'รหัส สพฐ.', 'ชื่อโรงเรียน', 'ตำบล', 'อำเภอ/เขต', 'สังกัด', 'โทรศัพท์', 'ระดับสูงสุดที่เปิดสอน', 'แหล่งที่มา', 'สถานะ'] as const;
export const VILLAGE_HEADERS = ['รหัสจังหวัด', 'จังหวัด', 'รหัสอำเภอ', 'อำเภอ/เขต', 'รหัสตำบล', 'ตำบล/แขวง', 'หมู่ที่', 'ชื่อหมู่บ้าน/ชุมชน', 'รหัสหมู่บ้าน', 'แหล่งที่มา', 'สถานะ'] as const;

const SOURCE_TH = { BASE: 'ชุดหลัก', BASE_EDITED: 'แก้ไขแล้ว', CUSTOM: 'เพิ่มเอง' } as const;
const STATUS_SHOW = 'แสดง';
const STATUS_HIDE = 'ซ่อน';

const cell = (v: unknown): string => String(v ?? '').trim();
const isHiddenCell = (v: unknown): boolean => /^(ซ่อน|hidden|disabled|ปิด)$/i.test(cell(v));

/** CSV (UTF-8 + BOM) — Excel ภาษาไทยเปิดได้ถูกต้อง; ครอบ "" เมื่อมี , " หรือขึ้นบรรทัดใหม่ */
export function toCsv(header: readonly string[], rows: string[][]): string {
  const esc = (s: string) => (/[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return '﻿' + [header, ...rows].map(r => r.map(esc).join(',')).join('\r\n') + '\r\n';
}

export function schoolExportRows(records: SchoolRecord[], provinceCode: string, provinceName: string): string[][] {
  return records.map(s => [
    provinceCode, provinceName, s.moeCode ?? '', s.name, s.subdistrict, s.district, s.affiliation, s.telephone, s.classMax,
    SOURCE_TH[s.source], s.disabled ? STATUS_HIDE : STATUS_SHOW,
  ]);
}

export function villageExportRows(records: VillageRecord[], where: { provinceCode: string; provinceName: string; amphoeCode: string; amphoeName: string; tambonCode: string; tambonName: string }): string[][] {
  return records.map(v => [
    where.provinceCode, where.provinceName, where.amphoeCode, where.amphoeName, where.tambonCode, where.tambonName,
    v.moo === null ? '' : String(v.moo), v.name, v.source === 'CUSTOM' ? '' : v.code, SOURCE_TH[v.source], v.disabled ? STATUS_HIDE : STATUS_SHOW,
  ]);
}

/** ส่งออกโรงเรียนทั้งหมดของจังหวัดที่ระบุ (รวมที่ซ่อน) — base + overrides */
export function exportSchoolsOfProvince(base: SchoolBase[], overrides: SchoolOverrideDoc[], provinceCode: string, provinceName: string): string[][] {
  return schoolExportRows(mergeSchools(base, overrides.filter(o => o.provinceCode === provinceCode), { includeDisabled: true }), provinceCode, provinceName);
}

/** ส่งออกหมู่บ้านทุกตำบลของทุกจังหวัดที่มีข้อมูล (ชุดหลัก + ที่เพิ่ม/แก้) เรียงตามจังหวัด→อำเภอ→ตำบล→หมู่ */
export function exportAllVillages(areas: ProvinceRef[], baseMap: Record<string, VillageBase[]>, overrides: VillageOverrideDoc[]): string[][] {
  const byTambon = new Map<string, VillageOverrideDoc[]>();
  for (const o of overrides) byTambon.set(o.tambonCode, [...(byTambon.get(o.tambonCode) ?? []), o]);
  const out: string[][] = [];
  for (const [pc, pn, amphoes] of areas) for (const [ac, an, tambons] of amphoes) for (const [tc, tn] of tambons) {
    const list = mergeVillages(baseMap[tc] ?? [], byTambon.get(tc) ?? [], { includeDisabled: true });
    if (list.length) out.push(...villageExportRows(list, { provinceCode: pc, provinceName: pn, amphoeCode: ac, amphoeName: an, tambonCode: tc, tambonName: tn }));
  }
  return out;
}

/* ───────────── นำเข้า ───────────── */

export type ImportAction = 'NEW' | 'UPDATE' | 'RESTORE' | 'UNCHANGED' | 'ERROR';
export interface ImportRowResult<D> { rowNo: number; action: ImportAction; errors: string[]; label: string; doc?: D; deleteId?: string }
export interface ImportSummary { NEW: number; UPDATE: number; RESTORE: number; UNCHANGED: number; ERROR: number }

export function summarize(results: ImportRowResult<unknown>[]): ImportSummary {
  const s: ImportSummary = { NEW: 0, UPDATE: 0, RESTORE: 0, UNCHANGED: 0, ERROR: 0 };
  for (const r of results) s[r.action]++;
  return s;
}

/** ดึงค่าจากแถวด้วยชื่อหัวคอลัมน์ (ไม่สนช่องว่างรอบข้าง) */
const pick = (row: Record<string, unknown>, header: string): string => {
  for (const k of Object.keys(row)) if (k.trim() === header) return cell(row[k]);
  return '';
};

function resolveProvince(provinces: ProvinceRef[], codeCell: string, nameCell: string): ProvinceRef | null {
  const digits = codeCell.replace(/\D/g, '');
  if (digits) { const code = digits.padStart(2, '0'); const p = provinces.find(x => x[0] === code); if (p) return p; }
  const name = nameCell.replace(/^จังหวัด\s*/, '').trim();
  return name ? provinces.find(x => x[1] === name) ?? null : null;
}

const sameSchool = (a: SchoolOverrideDoc, b: SchoolOverrideDoc) =>
  a.provinceCode === b.provinceCode && a.name === b.name && a.subdistrict === b.subdistrict && a.district === b.district
  && a.affiliation === b.affiliation && a.telephone === b.telephone && a.classMax === b.classMax && !!a.disabled === !!b.disabled;

export interface SchoolImportCtx { provinces: ProvinceRef[]; baseByProvince: Record<string, SchoolBase[]>; overrides: SchoolOverrideDoc[] }

export function planSchoolImport(rows: Record<string, unknown>[], ctx: SchoolImportCtx, by: string, now: string, makeId: () => string = newCustomId): ImportRowResult<SchoolOverrideDoc>[] {
  const existingById = new Map(ctx.overrides.map(o => [o.id, o]));
  const usedIds = new Set(ctx.overrides.map(o => o.id));
  const seen = new Set<string>();
  return rows.map((row, i) => {
    const rowNo = i + 2; // แถว 1 = หัวตาราง
    const name = pick(row, 'ชื่อโรงเรียน');
    const fail = (...errors: string[]): ImportRowResult<SchoolOverrideDoc> => ({ rowNo, action: 'ERROR', errors, label: name || '(ไม่มีชื่อ)' });
    if (Object.values(row).every(v => !cell(v))) return { rowNo, action: 'UNCHANGED', errors: [], label: '(แถวว่าง)' };
    const prov = resolveProvince(ctx.provinces, pick(row, 'รหัสจังหวัด'), pick(row, 'จังหวัด'));
    if (!prov) return fail('ไม่พบจังหวัด — ระบุรหัสจังหวัด 2 หลักหรือชื่อจังหวัดให้ตรงกับระบบ');
    const moeCode = pick(row, 'รหัส สพฐ.');
    const input = {
      provinceCode: prov[0], name, subdistrict: pick(row, 'ตำบล'), district: pick(row, 'อำเภอ/เขต'), affiliation: pick(row, 'สังกัด'),
      telephone: pick(row, 'โทรศัพท์'), classMax: pick(row, 'ระดับสูงสุดที่เปิดสอน'), disabled: isHiddenCell(pick(row, 'สถานะ')),
    };
    const baseRow = moeCode ? (ctx.baseByProvince[prov[0]] ?? []).find(b => b[0] === moeCode) : undefined;
    if (moeCode && !baseRow) return fail(`ไม่พบรหัส สพฐ. ${moeCode} ในชุดหลักของจังหวัด${prov[1]} (เว้นว่างรหัสถ้าเป็นโรงเรียนที่เพิ่มใหม่)`);

    if (baseRow) {
      const id = `b_${moeCode}`;
      if (seen.has(id)) return fail(`รหัส สพฐ. ${moeCode} ซ้ำในไฟล์`);
      seen.add(id);
      const built = buildSchoolOverride({ ...input, id, baseCode: moeCode }, by, now);
      if (built.ok === false) return fail(...built.errors);
      const baseAsDoc: SchoolOverrideDoc = { id, baseCode: moeCode, disabled: false, provinceCode: prov[0], name: baseRow[1], subdistrict: baseRow[2], district: baseRow[3], affiliation: baseRow[4], telephone: baseRow[5], classMax: baseRow[6], updatedAt: '', updatedBy: '' };
      const existing = existingById.get(id);
      if (sameSchool(built.doc, baseAsDoc)) return existing ? { rowNo, action: 'RESTORE', errors: [], label: built.doc.name, deleteId: id } : { rowNo, action: 'UNCHANGED', errors: [], label: built.doc.name };
      if (existing && sameSchool(built.doc, existing)) return { rowNo, action: 'UNCHANGED', errors: [], label: built.doc.name };
      return { rowNo, action: 'UPDATE', errors: [], label: built.doc.name, doc: built.doc };
    }

    // โรงเรียนที่เพิ่มเอง: จับคู่รายการเดิมด้วย จังหวัด + ชื่อ (หลังเติมคำว่า "โรงเรียน")
    const normName = name ? withSchoolPrefix(name) : '';
    const key = `${prov[0]}|${normName}`;
    if (name && seen.has(key)) return fail('โรงเรียนนี้ซ้ำในไฟล์ (ชื่อและจังหวัดเดียวกัน)');
    if (name) seen.add(key);
    const match = name ? ctx.overrides.find(o => !o.baseCode && o.provinceCode === prov[0] && o.name === normName) : undefined;
    let id = match?.id ?? '';
    if (!id) { id = makeId(); while (usedIds.has(id)) id = makeId(); usedIds.add(id); }
    const built = buildSchoolOverride({ ...input, id, baseCode: null }, by, now);
    if (built.ok === false) return fail(...built.errors);
    if (match && sameSchool(built.doc, match)) return { rowNo, action: 'UNCHANGED', errors: [], label: built.doc.name };
    return { rowNo, action: match ? 'UPDATE' : 'NEW', errors: [], label: built.doc.name, doc: built.doc };
  });
}

const sameVillage = (a: VillageOverrideDoc, b: VillageOverrideDoc) =>
  a.tambonCode === b.tambonCode && a.name === b.name && a.moo === b.moo && !!a.disabled === !!b.disabled;

export interface VillageImportCtx { areas: ProvinceRef[]; baseMap: Record<string, VillageBase[]>; overrides: VillageOverrideDoc[] }

export function planVillageImport(rows: Record<string, unknown>[], ctx: VillageImportCtx, by: string, now: string, makeId: () => string = newCustomId): ImportRowResult<VillageOverrideDoc>[] {
  const tambonIndex = new Map<string, { pc: string; ac: string }>();
  for (const [pc, , amphoes] of ctx.areas) for (const [ac, , tambons] of amphoes) for (const [tc] of tambons) tambonIndex.set(tc, { pc, ac });
  const existingById = new Map(ctx.overrides.map(o => [o.id, o]));
  const usedIds = new Set(ctx.overrides.map(o => o.id));
  const seen = new Set<string>();
  return rows.map((row, i) => {
    const rowNo = i + 2;
    const name = pick(row, 'ชื่อหมู่บ้าน/ชุมชน');
    const fail = (...errors: string[]): ImportRowResult<VillageOverrideDoc> => ({ rowNo, action: 'ERROR', errors, label: name || '(ไม่มีชื่อ)' });
    if (Object.values(row).every(v => !cell(v))) return { rowNo, action: 'UNCHANGED', errors: [], label: '(แถวว่าง)' };
    const tcode = pick(row, 'รหัสตำบล').replace(/\D/g, '');
    const where = tambonIndex.get(tcode);
    if (!where) return fail('ไม่พบรหัสตำบล 6 หลักตามระบบ');
    const villageCode = pick(row, 'รหัสหมู่บ้าน');
    const input = { provinceCode: where.pc, amphoeCode: where.ac, tambonCode: tcode, moo: pick(row, 'หมู่ที่'), name, disabled: isHiddenCell(pick(row, 'สถานะ')) };
    const baseRow = villageCode ? (ctx.baseMap[tcode] ?? []).find(b => b[2] === villageCode) : undefined;
    if (villageCode && !baseRow) return fail(`ไม่พบรหัสหมู่บ้าน ${villageCode} ในชุดหลักของตำบลนี้ (เว้นว่างรหัสถ้าเป็นหมู่บ้านที่เพิ่มใหม่)`);

    if (baseRow) {
      const id = `b_${villageCode}`;
      if (seen.has(id)) return fail(`รหัสหมู่บ้าน ${villageCode} ซ้ำในไฟล์`);
      seen.add(id);
      const built = buildVillageOverride({ ...input, id, baseCode: villageCode }, by, now);
      if (built.ok === false) return fail(...built.errors);
      const baseAsDoc: VillageOverrideDoc = { id, baseCode: villageCode, disabled: false, provinceCode: where.pc, amphoeCode: where.ac, tambonCode: tcode, moo: baseRow[0], name: baseRow[1], updatedAt: '', updatedBy: '' };
      const existing = existingById.get(id);
      if (sameVillage(built.doc, baseAsDoc)) return existing ? { rowNo, action: 'RESTORE', errors: [], label: built.doc.name, deleteId: id } : { rowNo, action: 'UNCHANGED', errors: [], label: built.doc.name };
      if (existing && sameVillage(built.doc, existing)) return { rowNo, action: 'UNCHANGED', errors: [], label: built.doc.name };
      return { rowNo, action: 'UPDATE', errors: [], label: built.doc.name, doc: built.doc };
    }

    const mooNum = input.moo.trim() && /^\d{1,2}$/.test(input.moo.trim()) ? Number(input.moo) : null;
    const key = `${tcode}|${mooNum ?? ''}|${name.trim()}`;
    if (name && seen.has(key)) return fail('หมู่บ้านนี้ซ้ำในไฟล์ (ตำบล หมู่ และชื่อเดียวกัน)');
    if (name) seen.add(key);
    const match = name ? ctx.overrides.find(o => !o.baseCode && o.tambonCode === tcode && o.moo === mooNum && o.name === name.trim()) : undefined;
    let id = match?.id ?? '';
    if (!id) { id = makeId(); while (usedIds.has(id)) id = makeId(); usedIds.add(id); }
    const built = buildVillageOverride({ ...input, id, baseCode: null }, by, now);
    if (built.ok === false) return fail(...built.errors);
    if (match && sameVillage(built.doc, match)) return { rowNo, action: 'UNCHANGED', errors: [], label: built.doc.name };
    return { rowNo, action: match ? 'UPDATE' : 'NEW', errors: [], label: built.doc.name, doc: built.doc };
  });
}

/** รายการเขียน/ลบจริงจากผลวางแผน (ข้าม UNCHANGED/ERROR) */
export function planToWrites<D extends { id: string }>(results: ImportRowResult<D>[]): { writes: D[]; deleteIds: string[] } {
  return {
    writes: results.filter(r => (r.action === 'NEW' || r.action === 'UPDATE') && r.doc).map(r => r.doc as D),
    deleteIds: results.filter(r => r.action === 'RESTORE' && r.deleteId).map(r => r.deleteId as string),
  };
}
