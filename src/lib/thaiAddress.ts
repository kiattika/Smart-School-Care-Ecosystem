import type { ThaiAddress } from '../types/homeVisit';

/**
 * ที่อยู่ไทยแบบแยกช่อง — ตรรกะบริสุทธิ์ (test ได้) + ตัวโหลดข้อมูลอ้างอิง
 * ข้อมูลสร้างด้วย scripts/buildThaiAddressData.ts (ThepExcel ตำบล/รหัสไปรษณีย์ทั่วประเทศ + หมู่บ้านจาก DOPA เฉพาะจังหวัดที่นำเข้า)
 */
export type TambonRef = [id: string, name: string, postcodes: string[]];
export type AmphoeRef = [id: string, name: string, tambons: TambonRef[]];
export type ProvinceRef = [id: string, name: string, amphoes: AmphoeRef[]];
export type VillageRef = [moo: number | null, name: string, code: string];
export type VillageMap = Record<string, VillageRef[]>; // key = รหัสตำบล 6 หลัก

export const emptyThaiAddress = (): ThaiAddress => ({
  houseNo: '', moo: '', village: '', villageCode: '', soi: '', road: '',
  provinceCode: '', province: '', amphoeCode: '', amphoe: '', tambonCode: '', tambon: '', postalCode: '',
});

/** โหลดแบบ lazy (แยก chunk) — ไม่ให้ข้อมูล ~400KB อยู่ใน bundle หลัก */
export async function loadThaiAddressData(): Promise<{ areas: ProvinceRef[]; villages: VillageMap }> {
  const [areas, villages] = await Promise.all([
    import('../data/thaiAddress/areas.json'),
    import('../data/thaiAddress/villages.json'),
  ]);
  return { areas: areas.default as unknown as ProvinceRef[], villages: villages.default as unknown as VillageMap };
}

/** ข้อความที่อยู่เต็มรูปแบบไทย เช่น "12 หมู่ 3 บ้านสวน ซอย 4 ถนนใหญ่ ต.ในเมือง อ.เมืองอุตรดิตถ์ จ.อุตรดิตถ์ 53000" */
export function formatThaiAddress(a: ThaiAddress | null | undefined): string {
  if (!a) return '';
  const bkk = a.provinceCode === '10';
  const parts = [
    a.houseNo.trim(),
    a.moo.trim() && `หมู่ ${a.moo.trim()}`,
    a.village.trim(),
    a.soi.trim() && `ซอย ${a.soi.trim().replace(/^ซอย\s*/, '')}`,
    a.road.trim() && `ถนน ${a.road.trim().replace(/^ถนน\s*/, '')}`,
    a.tambon && `${bkk ? 'แขวง' : 'ต.'}${a.tambon}`,
    a.amphoe && `${bkk ? 'เขต' : 'อ.'}${a.amphoe}`,
    a.province && (bkk ? a.province : `จ.${a.province}`),
    a.postalCode.trim(),
  ];
  return parts.filter(Boolean).join(' ');
}

/** ตรวจความครบ (ช่องที่ต้องกรอก: บ้านเลขที่ จังหวัด อำเภอ ตำบล รหัสไปรษณีย์ 5 หลัก) */
export function validateThaiAddress(a: ThaiAddress | null | undefined): string[] {
  const e: string[] = [];
  if (!a) return ['กรอกที่อยู่ปัจจุบัน (บ้านเลขที่ จังหวัด อำเภอ ตำบล รหัสไปรษณีย์)'];
  if (!a.houseNo.trim()) e.push('ระบุบ้านเลขที่');
  if (a.moo.trim() && !/^\d{1,2}$/.test(a.moo.trim())) e.push('หมู่ที่ต้องเป็นตัวเลข 1-2 หลัก');
  if (!a.provinceCode) e.push('เลือกจังหวัด');
  if (!a.amphoeCode) e.push('เลือกอำเภอ/เขต');
  if (!a.tambonCode) e.push('เลือกตำบล/แขวง');
  if (!/^\d{5}$/.test(a.postalCode.trim())) e.push('ระบุรหัสไปรษณีย์ 5 หลัก');
  return e;
}

/** เปลี่ยนจังหวัด → ล้างอำเภอ/ตำบล/หมู่บ้าน/รหัสไปรษณีย์ (ไม่แตะบ้านเลขที่ ซอย ถนน) */
export function withProvince(a: ThaiAddress, p: ProvinceRef | null): ThaiAddress {
  return { ...a, provinceCode: p?.[0] ?? '', province: p?.[1] ?? '', amphoeCode: '', amphoe: '', tambonCode: '', tambon: '', village: '', villageCode: '', moo: '', postalCode: '' };
}
export function withAmphoe(a: ThaiAddress, am: AmphoeRef | null): ThaiAddress {
  return { ...a, amphoeCode: am?.[0] ?? '', amphoe: am?.[1] ?? '', tambonCode: '', tambon: '', village: '', villageCode: '', moo: '', postalCode: '' };
}
/** เลือกตำบล → เติมรหัสไปรษณีย์ให้เมื่อมีรหัสเดียว (มีหลายรหัส = ให้เลือกเอง) และล้างหมู่บ้านเดิม */
export function withTambon(a: ThaiAddress, t: TambonRef | null): ThaiAddress {
  return { ...a, tambonCode: t?.[0] ?? '', tambon: t?.[1] ?? '', village: '', villageCode: '', moo: '', postalCode: t && t[2].length === 1 ? t[2][0] : '' };
}
/** เลือกหมู่บ้านจากรายการ → เติมหมู่ที่ (ถ้ามี) และชื่อหมู่บ้าน; null = ล้างค่า */
export function withVillage(a: ThaiAddress, v: VillageRef | null): ThaiAddress {
  return v ? { ...a, villageCode: v[2], village: v[1], moo: v[0] === null ? '' : String(v[0]) } : { ...a, villageCode: '', village: '', moo: '' };
}
export const villageLabel = (v: VillageRef): string => (v[0] === null ? v[1] : `หมู่ ${v[0]} ${v[1]}`);
