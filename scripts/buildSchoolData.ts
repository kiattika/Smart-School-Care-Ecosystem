/**
 * สร้างรายชื่อโรงเรียนสำหรับช่อง "จบจากสถานศึกษา" ในแบบเยี่ยมบ้าน — แยกไฟล์ตามจังหวัด (โหลดเฉพาะจังหวัดที่เลือก)
 *
 *   npx tsx scripts/buildSchoolData.ts <schools.json>
 *
 * - อินพุต: ทะเบียนโรงเรียน (JSON array; ฟิลด์ที่ใช้: moeCode schoolName subdistrict district province areaName telephone classMaxLevel)
 *   คอลัมน์อื่น (พิกัด จำนวนนักเรียน ขนาดโรงเรียน ฯลฯ) ไม่เอา
 * - รหัสจังหวัดจับคู่จากชื่อกับ src/data/thaiAddress/areas.json (ต้องรันสคริปต์ที่อยู่ก่อน)
 * - เอาต์พุต: src/data/schools/<รหัสจังหวัด 2 หลัก>.json = [[moeCode, ชื่อเต็ม, ตำบล, อำเภอ/เขต, สังกัด, โทรศัพท์, ระดับสูงสุด]]
 * - โทรศัพท์: ใช้ cleanPhone() ใน src/lib/referenceData.ts (8 หลัก → เติม 0; ไม่ใช่ 9-10 หลักขึ้นต้น 0 → ทิ้ง ไม่เดาเลข)
 */
import fs from 'node:fs';
import path from 'node:path';
import { cleanPhone, withSchoolPrefix } from '../src/lib/referenceData';

const [src] = process.argv.slice(2);
if (!src) { console.error('usage: npx tsx scripts/buildSchoolData.ts <schools.json>'); process.exit(1); }

const areas = JSON.parse(fs.readFileSync('src/data/thaiAddress/areas.json', 'utf8')) as [string, string, unknown][];
const pcodeByName = new Map(areas.map(p => [p[1], p[0]]));
const raw = JSON.parse(fs.readFileSync(src, 'utf8')) as Record<string, any>[];

const byProv = new Map<string, unknown[][]>();
let skipped = 0;
for (const r of raw) {
  const pcode = pcodeByName.get(String(r.province ?? '').trim());
  const name = String(r.schoolName ?? '').trim();
  if (!pcode || !name || !r.moeCode) { skipped++; continue; }
  const classMax = String(r.classMaxLevel ?? '').trim();
  const list = byProv.get(pcode) ?? [];
  list.push([String(r.moeCode), withSchoolPrefix(name), String(r.subdistrict ?? '').trim(), String(r.district ?? '').trim(), String(r.areaName ?? '').trim().replace(/\s+/g, ' '), cleanPhone(r.telephone), classMax === '0' ? '' : classMax]);
  byProv.set(pcode, list);
}
const outDir = path.resolve('src/data/schools');
fs.mkdirSync(outDir, { recursive: true });
let total = 0;
for (const [pcode, list] of byProv) {
  list.sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'th'));
  fs.writeFileSync(path.join(outDir, `${pcode}.json`), JSON.stringify(list));
  total += list.length;
}
console.log(`provinces=${byProv.size} schools=${total} skipped=${skipped}`);
