/**
 * สร้างข้อมูลที่อยู่ไทยสำหรับดรอปดาวน์ (จังหวัด → อำเภอ → ตำบล → หมู่บ้าน + รหัสไปรษณีย์)
 *
 *   npx tsx scripts/buildThaiAddressData.ts <ThepExcel-Thailand-Tambon.xlsx> <dopa-village-province-1.json> [<dopa-2.json> ...]
 *
 * - ตาราง จังหวัด/อำเภอ/ตำบล/รหัสไปรษณีย์ทั่วประเทศ: ชีต TambonDatabase ของ ThepExcel-Thailand-Tambon.xlsx
 * - หมู่บ้าน: ไฟล์ JSON รายจังหวัดจาก catalog.dopa.go.th (ใช้เฉพาะ pcode/acode/tcode/mcode/mname — คอลัมน์สำรวจ q* และ lat/long ไม่เอา)
 *   ตำบลของ DOPA (tcode 8 หลัก) จับคู่กับ TambonID ของ ThepExcel ด้วย 6 หลักแรก
 * - เขียนผลที่ src/data/thaiAddress/{areas,villages}.json (อ่านอย่างเดียวตอนรันแอป ไม่แตะ Firestore)
 */
import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';

const [xlsxPath, ...dopaPaths] = process.argv.slice(2);
if (!xlsxPath || dopaPaths.length === 0) {
  console.error('usage: npx tsx scripts/buildThaiAddressData.ts <tambon.xlsx> <dopa.json> [...]');
  process.exit(1);
}

const wb = XLSX.read(fs.readFileSync(xlsxPath), { type: 'buffer' });
const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['TambonDatabase'], { defval: null });

type Tambon = [string, string, string[]]; // [tambonId(6), ชื่อ, รหัสไปรษณีย์[]]
type Amphoe = [string, string, Tambon[]];
type Province = [string, string, Amphoe[]];
const prov = new Map<string, { name: string; amphoes: Map<string, { name: string; tambons: Tambon[] }> }>();
for (const r of rows) {
  const tid = String(r.TambonID ?? '').trim();
  if (!/^\d{6}$/.test(tid)) continue;
  const pcode = String(r.ProvinceID).padStart(2, '0');
  const acode = String(r.DistrictID).padStart(4, '0');
  const posts = [...new Set(String(r.PostCodeAll ?? r.PostCodeMain ?? '').split(/[^0-9]+/).filter(p => /^\d{5}$/.test(p)))];
  if (r.PostCodeMain && !posts.includes(String(r.PostCodeMain))) posts.unshift(String(r.PostCodeMain));
  const p = prov.get(pcode) ?? { name: String(r.ProvinceThai), amphoes: new Map() };
  const a = p.amphoes.get(acode) ?? { name: String(r.DistrictThaiShort), tambons: [] };
  a.tambons.push([tid, String(r.TambonThaiShort), posts]);
  p.amphoes.set(acode, a); prov.set(pcode, p);
}
const th = (a: string, b: string) => a.localeCompare(b, 'th');
const areas: Province[] = [...prov.entries()]
  .map(([pc, p]): Province => [pc, p.name, [...p.amphoes.entries()]
    .map(([ac, a]): Amphoe => [ac, a.name, a.tambons.sort((x, y) => th(x[1], y[1]))])
    .sort((x, y) => th(x[1], y[1]))])
  .sort((x, y) => th(x[1], y[1]));

// หมู่บ้าน: tambonId(6) → [[หมู่ที่|null, ชื่อ, mcode]]
// 2 หลักท้ายของ mcode = เลขหมู่; ค่า ≥ 50 ดูเป็นชุมชน (ไม่ใช่หมู่ที่) จึงไม่เติมเลขหมู่ให้ — ยืนยันกับ DOPA ก่อนเปลี่ยนกฎนี้
const villages: Record<string, [number | null, string, string][]> = {};
const knownTambon = new Set(areas.flatMap(p => p[2].flatMap(a => a[2].map(t => t[0]))));
let skipped = 0;
for (const f of dopaPaths) {
  const list = JSON.parse(fs.readFileSync(f, 'utf8')) as { tcode: string; mcode: string; mname: string | null }[];
  for (const v of list) {
    const tid = String(v.tcode).slice(0, 6);
    const name = (v.mname ?? '').trim();
    if (!knownTambon.has(tid) || !name || !/^\d{8}$/.test(String(v.mcode))) { skipped++; continue; }
    const moo = Number(String(v.mcode).slice(-2));
    (villages[tid] ??= []).push([moo >= 1 && moo < 50 ? moo : null, name, String(v.mcode)]);
  }
}
for (const k of Object.keys(villages)) villages[k].sort((a, b) => (a[0] ?? 999) - (b[0] ?? 999) || th(a[1], b[1]));

const outDir = path.resolve('src/data/thaiAddress');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'areas.json'), JSON.stringify(areas));
fs.writeFileSync(path.join(outDir, 'villages.json'), JSON.stringify(villages));
console.log(`provinces=${areas.length} tambons=${knownTambon.size} villageTambons=${Object.keys(villages).length} villages=${Object.values(villages).reduce((n, l) => n + l.length, 0)} skipped=${skipped}`);
