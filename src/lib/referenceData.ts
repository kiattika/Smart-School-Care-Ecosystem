import type { SchoolOverrideDoc, VillageOverrideDoc } from '../types/reference';
import type { StudentHomeVisitInfo } from '../types/homeVisit';

/**
 * รายชื่อโรงเรียน/หมู่บ้าน = ข้อมูลชุดหลัก (ฝังในแอป) + ส่วนที่แอดมินเพิ่ม/แก้/ซ่อน (Firestore) — ตรรกะบริสุทธิ์ (test ได้)
 * ห้าม import ไฟล์ที่ใช้ import.meta.glob ที่นี่ (สคริปต์ build ใช้ cleanPhone ผ่าน tsx)
 */
export type SchoolBase = [moeCode: string, name: string, subdistrict: string, district: string, affiliation: string, telephone: string, classMax: string];
export type VillageBase = [moo: number | null, name: string, code: string];

export interface SchoolRecord {
  key: string; moeCode: string | null; name: string; subdistrict: string; district: string; affiliation: string; telephone: string; classMax: string;
  source: 'BASE' | 'BASE_EDITED' | 'CUSTOM'; disabled: boolean; overrideId: string | null;
}
export interface VillageRecord {
  key: string; code: string; moo: number | null; name: string;
  source: 'BASE' | 'BASE_EDITED' | 'CUSTOM'; disabled: boolean; overrideId: string | null;
}

/** โทรศัพท์: เหลือเฉพาะตัวเลข; 8 หลัก → เติม 0 นำหน้า; ต้องเป็น 9-10 หลักขึ้นต้น 0 ไม่งั้นคืนค่าว่าง (ไม่เดาเลข) */
export function cleanPhone(v: unknown): string {
  let d = String(v ?? '').replace(/[๐-๙]/g, c => String(c.charCodeAt(0) - 0x0e50)).replace(/\D/g, '');
  if (d.length === 8) d = '0' + d;
  return /^0\d{8,9}$/.test(d) ? d : '';
}
export const withSchoolPrefix = (n: string): string => { const t = n.trim().replace(/\s+/g, ' '); return t.startsWith('โรงเรียน') ? t : `โรงเรียน${t}`; };
const th = (a: string, b: string) => a.localeCompare(b, 'th');

/** รวมชุดหลักกับส่วนที่แอดมินแก้; includeDisabled=false (ฝั่งนักเรียน) ตัดรายการที่ซ่อนออก */
export function mergeSchools(base: SchoolBase[], overrides: SchoolOverrideDoc[], opts: { includeDisabled?: boolean } = {}): SchoolRecord[] {
  const byBase = new Map(overrides.filter(o => o.baseCode).map(o => [o.baseCode as string, o]));
  const out: SchoolRecord[] = [];
  for (const b of base) {
    const o = byBase.get(b[0]);
    if (!o) { out.push({ key: `b_${b[0]}`, moeCode: b[0], name: b[1], subdistrict: b[2], district: b[3], affiliation: b[4], telephone: b[5], classMax: b[6], source: 'BASE', disabled: false, overrideId: null }); continue; }
    out.push({ key: `b_${b[0]}`, moeCode: b[0], name: o.name || b[1], subdistrict: o.subdistrict, district: o.district, affiliation: o.affiliation, telephone: o.telephone, classMax: o.classMax, source: 'BASE_EDITED', disabled: !!o.disabled, overrideId: o.id });
  }
  for (const o of overrides) {
    if (o.baseCode) continue;
    out.push({ key: o.id, moeCode: null, name: o.name, subdistrict: o.subdistrict, district: o.district, affiliation: o.affiliation, telephone: o.telephone, classMax: o.classMax, source: 'CUSTOM', disabled: !!o.disabled, overrideId: o.id });
  }
  return (opts.includeDisabled ? out : out.filter(s => !s.disabled)).sort((a, b) => th(a.name, b.name));
}

export function mergeVillages(base: VillageBase[], overrides: VillageOverrideDoc[], opts: { includeDisabled?: boolean } = {}): VillageRecord[] {
  const byBase = new Map(overrides.filter(o => o.baseCode).map(o => [o.baseCode as string, o]));
  const out: VillageRecord[] = [];
  for (const b of base) {
    const o = byBase.get(b[2]);
    out.push(o
      ? { key: `b_${b[2]}`, code: b[2], moo: o.moo, name: o.name || b[1], source: 'BASE_EDITED', disabled: !!o.disabled, overrideId: o.id }
      : { key: `b_${b[2]}`, code: b[2], moo: b[0], name: b[1], source: 'BASE', disabled: false, overrideId: null });
  }
  for (const o of overrides) if (!o.baseCode) out.push({ key: o.id, code: o.id, moo: o.moo, name: o.name, source: 'CUSTOM', disabled: !!o.disabled, overrideId: o.id });
  return (opts.includeDisabled ? out : out.filter(v => !v.disabled)).sort((a, b) => (a.moo ?? 999) - (b.moo ?? 999) || th(a.name, b.name));
}

/** ค้นชื่อโรงเรียน (ไม่สนช่องว่าง/คำว่า "โรงเรียน"); ขึ้นต้นตรงมาก่อน แล้วตามด้วยที่มีคำอยู่ในชื่อ/ตำบล/อำเภอ */
export function searchSchools(list: SchoolRecord[], query: string, limit = 50): SchoolRecord[] {
  const norm = (s: string) => s.replace(/\s+/g, '').replace(/^โรงเรียน/, '');
  const q = norm(query.trim());
  if (!q) return list.slice(0, limit);
  const starts: SchoolRecord[] = [], contains: SchoolRecord[] = [];
  for (const s of list) {
    const n = norm(s.name);
    if (n.startsWith(q)) starts.push(s);
    else if (n.includes(q) || s.subdistrict.includes(query.trim()) || s.district.includes(query.trim())) contains.push(s);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
}

/** ค่าที่เติมลงฟอร์ม "ข้อ 2 ประวัติการเรียน" เมื่อเลือกโรงเรียน (นักเรียนแก้ต่อได้) */
export function schoolToInfoPatch(s: SchoolRecord, provinceName: string): Pick<StudentHomeVisitInfo, 'prevSchool' | 'prevAffiliation' | 'prevSubdistrict' | 'prevDistrict' | 'prevProvince' | 'prevPhone' | 'prevSchoolMoeCode'> {
  return { prevSchool: s.name, prevAffiliation: s.affiliation, prevSubdistrict: s.subdistrict, prevDistrict: s.district, prevProvince: provinceName, prevPhone: s.telephone, prevSchoolMoeCode: s.moeCode ?? '' };
}

/** ตรวจ/ประกอบเอกสารที่แอดมินบันทึก — คืน error เป็นข้อความไทย หรือเอกสารพร้อมเขียน */
export function buildSchoolOverride(input: { id: string; baseCode: string | null; provinceCode: string; name: string; subdistrict: string; district: string; affiliation: string; telephone: string; classMax: string; disabled?: boolean }, by: string, now: string): { ok: true; doc: SchoolOverrideDoc } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!/^\d{2}$/.test(input.provinceCode)) errors.push('เลือกจังหวัด');
  if (!input.name.trim()) errors.push('ระบุชื่อโรงเรียน');
  if (input.telephone.trim() && !cleanPhone(input.telephone)) errors.push('เบอร์โทรไม่ถูกต้อง (9-10 หลัก ขึ้นต้น 0)');
  if (errors.length) return { ok: false, errors };
  return { ok: true, doc: { id: input.id, baseCode: input.baseCode, disabled: !!input.disabled, provinceCode: input.provinceCode, name: withSchoolPrefix(input.name), subdistrict: input.subdistrict.trim(), district: input.district.trim(), affiliation: input.affiliation.trim(), telephone: cleanPhone(input.telephone), classMax: input.classMax.trim(), updatedAt: now, updatedBy: by } };
}
export function buildVillageOverride(input: { id: string; baseCode: string | null; provinceCode: string; amphoeCode: string; tambonCode: string; moo: string; name: string; disabled?: boolean }, by: string, now: string): { ok: true; doc: VillageOverrideDoc } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!/^\d{6}$/.test(input.tambonCode)) errors.push('เลือกตำบล');
  if (!input.name.trim()) errors.push('ระบุชื่อหมู่บ้าน/ชุมชน');
  if (input.moo.trim() && !/^\d{1,2}$/.test(input.moo.trim())) errors.push('หมู่ที่ต้องเป็นตัวเลข 1-2 หลัก');
  if (errors.length) return { ok: false, errors };
  return { ok: true, doc: { id: input.id, baseCode: input.baseCode, disabled: !!input.disabled, provinceCode: input.provinceCode, amphoeCode: input.amphoeCode, tambonCode: input.tambonCode, moo: input.moo.trim() ? Number(input.moo) : null, name: input.name.trim(), updatedAt: now, updatedBy: by } };
}
export const newCustomId = (now = Date.now()): string => `c_${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
