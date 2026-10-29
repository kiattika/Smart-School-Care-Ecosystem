/**
 * โครงการสอน ⇄ ไฟล์ Excel — เทมเพลต / ดาวน์โหลดทั้งฉบับ / นำเข้า (pure functions ทดสอบได้ — src/__tests__/teachingProjectExcel.test.ts)
 *
 * รูปแบบสมุดงาน (ไฟล์ที่ดาวน์โหลดไปแก้แล้วอัพโหลดกลับได้ทันที):
 *  - "ข้อมูลทั่วไป"  : หัวข้อ | ค่า (ประเภทวิชา, ระดับชั้น, หน่วยกิต, ชั่วโมง/สัปดาห์, คำอธิบายรายวิชา, หมายเหตุการวัดผล)
 *  - "ตัวชี้วัด"      : 1 แถว = 1 ข้อ
 *  - "เนื้อหา"        : 1 แถว = 1 บท/หัวข้อ หรือการสอบ (ประเภท = บท | สอบ)
 *  - "การวัดผล"      : รายการ | ร้อยละ
 *  - "คำแนะนำ"       : วิธีกรอก (ไม่ถูกอ่านตอนนำเข้า)
 * นำเข้า = เติมลงฟอร์มให้ครูตรวจก่อนกดบันทึก (ไม่เขียน Firestore เอง) — ข้อมูลที่ไม่ผ่านตรวจแสดงเป็นคำเตือน/ข้อผิดพลาดรายแถว
 */
import * as XLSX from 'xlsx';
import {
  MAX_ASSESSMENT, MAX_INDICATORS, MAX_UNITS, newUnitId, parseWeeks, validateProject,
  type AssessmentItem, type ProjectUnit, type TeachingProject,
} from './teachingProject';

export type ExcelContent = Pick<TeachingProject, 'levelLabel' | 'credits' | 'hoursPerWeek' | 'courseType' | 'description' | 'indicators' | 'units' | 'assessment' | 'assessmentNote'>;

export const SHEET_INFO = 'ข้อมูลทั่วไป';
export const SHEET_INDICATORS = 'ตัวชี้วัด';
export const SHEET_UNITS = 'เนื้อหา';
export const SHEET_ASSESS = 'การวัดผล';
export const SHEET_GUIDE = 'คำแนะนำ';

export const INFO_KEYS = { courseType: 'ประเภทวิชา', levelLabel: 'ระดับชั้น', credits: 'หน่วยกิต', hoursPerWeek: 'ชั่วโมง/สัปดาห์', description: 'คำอธิบายรายวิชา', assessmentNote: 'หมายเหตุการวัดผล' } as const;
export const UNIT_HEADERS = ['ประเภท (บท/สอบ)', 'สัปดาห์', 'บท/หัวข้อ', 'ชั่วโมง', 'หัวข้อย่อย/เนื้อหาสาระ', 'กิจกรรมการเรียนการสอน', 'สื่อ/แหล่งเรียนรู้'] as const;
export const ASSESS_HEADERS = ['รายการ', 'ร้อยละ'] as const;
export const INDICATOR_HEADER = 'ตัวชี้วัด / ผลการเรียนรู้ (1 แถว = 1 ข้อ)';

const GUIDE_ROWS = [
  ['วิธีกรอกเทมเพลตโครงการสอน'],
  [''],
  ['1. กรอกข้อมูลในชีต "ข้อมูลทั่วไป" "ตัวชี้วัด" "เนื้อหา" "การวัดผล" แล้วบันทึกไฟล์เป็น .xlsx'],
  ['2. กลับมาที่ระบบ เมนู ผลการนิเทศ > โครงการสอน เลือกวิชา กด "นำเข้าจาก Excel" — ระบบจะเติมลงฟอร์มให้ตรวจก่อน ยังไม่บันทึกจนกว่าจะกดปุ่ม "บันทึก"'],
  ['3. ห้ามเปลี่ยนชื่อชีต และห้ามเปลี่ยนหัวคอลัมน์แถวแรกของชีต "เนื้อหา" และ "การวัดผล"'],
  ['4. ชีต "เนื้อหา": คอลัมน์ ประเภท ใส่ "บท" (หัวข้อที่สอน) หรือ "สอบ" (สอบกลางภาค/ปลายภาค/แบบทดสอบ); สัปดาห์ใส่เลขเดียวหรือช่วง เช่น 3 หรือ 3-5 (คอลัมน์นี้ตั้งเป็นข้อความไว้แล้ว ไม่ต้องกลัวถูกแปลงเป็นวันที่)'],
  ['5. 1 แถวในชีต "เนื้อหา" = 1 บท/หัวข้อ — ขึ้นบรรทัดใหม่ในช่องเดียวด้วย Alt+Enter ได้'],
  ['6. ชีต "การวัดผล": รวมร้อยละควรเท่ากับ 100'],
  [`7. จำกัดไม่เกิน ${MAX_INDICATORS} ตัวชี้วัด, ${MAX_UNITS} แถวเนื้อหา, ${MAX_ASSESSMENT} รายการวัดผล, คำอธิบายรายวิชา 2,000 ตัวอักษร`],
];

/** เซลล์ข้อความล้วน (กัน Excel แปลง "1-2" เป็นวันที่ / ตัดเลขศูนย์) */
const textCell = (v: string): XLSX.CellObject => ({ t: 's', v, z: '@' });

function sheetFromAoa(rows: (string | number | null)[][], opts: { textCols?: number[]; widths?: number[] } = {}): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const text = new Set(opts.textCols || []);
  rows.forEach((r, ri) => r.forEach((v, ci) => {
    if (text.has(ci) && ri > 0) ws[XLSX.utils.encode_cell({ r: ri, c: ci })] = textCell(v === null || v === undefined ? '' : String(v));
  }));
  if (opts.widths) ws['!cols'] = opts.widths.map(wch => ({ wch }));
  return ws;
}

/** สร้างสมุดงานจากเนื้อหาโครงการ (เทมเพลตเปล่า = ส่งค่าเริ่มต้นของวิชา + ตัวอย่างบรรทัดว่าง) */
export function buildProjectWorkbook(c: ExcelContent, opts: { title: string; example?: boolean }): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const info = sheetFromAoa([
    ['หัวข้อ', 'ค่า'],
    [INFO_KEYS.courseType, c.courseType],
    [INFO_KEYS.levelLabel, c.levelLabel],
    [INFO_KEYS.credits, c.credits],
    [INFO_KEYS.hoursPerWeek, c.hoursPerWeek],
    [INFO_KEYS.description, c.description],
    [INFO_KEYS.assessmentNote, c.assessmentNote],
  ], { textCols: [1], widths: [24, 110] });
  XLSX.utils.book_append_sheet(wb, info, SHEET_INFO);

  const ind = c.indicators.length > 0 ? c.indicators : opts.example ? ['ตัวอย่าง: ข้อ 1 อธิบายและยกตัวอย่างได้', ''] : [''];
  XLSX.utils.book_append_sheet(wb, sheetFromAoa([[INDICATOR_HEADER], ...ind.map(i => [i])], { textCols: [0], widths: [120] }), SHEET_INDICATORS);

  const unitRows: (string | number | null)[][] = c.units.map(u => [
    u.type === 'EXAM' ? 'สอบ' : 'บท', u.weeks, u.title, u.hours, u.detail, u.activities, u.media,
  ]);
  if (unitRows.length === 0 && opts.example) {
    unitRows.push(['บท', '1', 'ตัวอย่าง: บทที่ 1 …… หัวข้อ 1.1', 2, 'หัวข้อย่อย/เนื้อหาสาระ', 'กิจกรรมการเรียนรู้', 'สื่อ/แหล่งเรียนรู้']);
    unitRows.push(['สอบ', '10', 'สอบกลางภาคเรียน', 2, '', '', '']);
  }
  XLSX.utils.book_append_sheet(wb, sheetFromAoa([[...UNIT_HEADERS], ...unitRows], { textCols: [0, 1, 2, 4, 5, 6], widths: [16, 10, 44, 9, 50, 50, 44] }), SHEET_UNITS);

  const assessRows: (string | number | null)[][] = c.assessment.map(a => [a.label, a.percent]);
  if (assessRows.length === 0 && opts.example) assessRows.push(['คะแนนระหว่างภาค', 80], ['สอบปลายภาค', 20]);
  XLSX.utils.book_append_sheet(wb, sheetFromAoa([[...ASSESS_HEADERS], ...assessRows], { textCols: [0], widths: [60, 12] }), SHEET_ASSESS);

  const guide = XLSX.utils.aoa_to_sheet([...GUIDE_ROWS, [''], [`ไฟล์: ${opts.title}`]]);
  guide['!cols'] = [{ wch: 130 }];
  XLSX.utils.book_append_sheet(wb, guide, SHEET_GUIDE);
  return wb;
}

export function workbookToArrayBuffer(wb: XLSX.WorkBook): ArrayBuffer {
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
}

/** ชื่อไฟล์ที่ปลอดภัย (ตัดอักขระต้องห้ามของระบบไฟล์) */
export function safeFileName(s: string): string {
  return s.replace(/[\\/:*?"<>|\s]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'โครงการสอน';
}

export interface ParseResult {
  /** ว่างถ้าเปิดไฟล์ไม่ได้/ไม่ใช่รูปแบบเทมเพลต */
  content: ExcelContent | null;
  /** ปัญหาที่ทำให้นำเข้าไม่ได้ (ไม่ใช่รูปแบบ/ชีตหาย) */
  errors: string[];
  /** คำเตือนที่นำเข้าได้แต่ครูควรตรวจ (แถวที่ถูกข้าม ฯลฯ) */
  warnings: string[];
}

const str = (v: unknown): string => (v === null || v === undefined ? '' : typeof v === 'string' ? v : String(v)).replace(/\r\n?/g, '\n').trim();
const norm = (s: string) => s.replace(/[\s()（）/／]/g, '').toLowerCase();

function rowsOf(wb: XLSX.WorkBook, name: string): unknown[][] | null {
  const key = wb.SheetNames.find(n => n.trim() === name);
  if (!key) return null;
  return XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[key], { header: 1, blankrows: false, defval: '', raw: true });
}

/** หาคอลัมน์จากหัวตาราง (ไม่สนช่องว่าง/วงเล็บ/ตัวพิมพ์) */
function colIndex(header: unknown[], label: string, ...alts: string[]): number {
  const want = [label, ...alts].map(norm);
  return header.findIndex(h => want.some(w => norm(str(h)) === w || norm(str(h)).startsWith(w)));
}

/** อ่านสมุดงานตามรูปแบบเทมเพลต — ไม่ throw (ปัญหาอยู่ใน errors/warnings) */
export function parseProjectWorkbook(wb: XLSX.WorkBook): ParseResult {
  const errors: string[] = []; const warnings: string[] = [];
  const infoRows = rowsOf(wb, SHEET_INFO);
  const unitRows = rowsOf(wb, SHEET_UNITS);
  if (!infoRows && !unitRows) return { content: null, errors: [`ไม่พบชีต "${SHEET_INFO}" หรือ "${SHEET_UNITS}" — กรุณาใช้ไฟล์จากปุ่มดาวน์โหลดเทมเพลต/โครงการสอน`], warnings };

  const info: Record<string, string> = {};
  (infoRows || []).slice(1).forEach(r => { const k = str(r[0]); if (k) info[norm(k)] = str(r[1]); });
  const pick = (k: string) => info[norm(k)] ?? '';
  const knownKeys = Object.values(INFO_KEYS).map(norm);
  Object.keys(info).filter(k => !knownKeys.includes(k)).forEach(k => warnings.push(`ชีต "${SHEET_INFO}": ไม่รู้จักหัวข้อ "${k}" — ข้าม`));
  if (!infoRows) warnings.push(`ไม่พบชีต "${SHEET_INFO}" — ข้อมูลทั่วไปไม่ถูกเปลี่ยน`);

  const indRows = rowsOf(wb, SHEET_INDICATORS);
  if (!indRows) warnings.push(`ไม่พบชีต "${SHEET_INDICATORS}" — ตัวชี้วัดว่าง`);
  const indicators = (indRows || []).slice(1).map(r => str(r[0])).filter(Boolean);
  if (indicators.length > MAX_INDICATORS) { warnings.push(`ตัวชี้วัดเกิน ${MAX_INDICATORS} ข้อ — ตัดส่วนเกินออก`); indicators.length = MAX_INDICATORS; }

  const units: ProjectUnit[] = [];
  let unitsTrimmed = false;
  if (!unitRows) warnings.push(`ไม่พบชีต "${SHEET_UNITS}" — ไม่มีแถวเนื้อหา`);
  else {
    const h = unitRows[0] || [];
    const ci = { type: colIndex(h, 'ประเภท'), weeks: colIndex(h, 'สัปดาห์'), title: colIndex(h, 'บท/หัวข้อ', 'บทหัวข้อ'), hours: colIndex(h, 'ชั่วโมง'),
      detail: colIndex(h, 'หัวข้อย่อย', 'เนื้อหาสาระ'), act: colIndex(h, 'กิจกรรม'), media: colIndex(h, 'สื่อ') };
    if (ci.title < 0 || ci.weeks < 0) errors.push(`ชีต "${SHEET_UNITS}": ไม่พบหัวคอลัมน์ "สัปดาห์" และ "บท/หัวข้อ" ในแถวแรก`);
    else {
      unitRows.slice(1).forEach((r, i) => {
        const line = i + 2;
        const cell = (c: number) => (c >= 0 ? str(r[c]) : '');
        const title = cell(ci.title);
        const weeksRaw = r[ci.weeks];
        let weeks = cell(ci.weeks).replace(/\s+/g, '').replace(/–|—/g, '-');
        if (!title && !weeks && !cell(ci.detail)) return;
        if (units.length >= MAX_UNITS) { if (!unitsTrimmed) warnings.push(`แถวเนื้อหาเกิน ${MAX_UNITS} แถว — ตัดส่วนเกินออก`); unitsTrimmed = true; return; }
        if (typeof weeksRaw === 'number' && weeksRaw > 52) warnings.push(`เนื้อหาแถว ${line}: สัปดาห์ "${weeksRaw}" ผิดปกติ (Excel อาจแปลง "1-2" เป็นวันที่) — ตรวจสอบ`);
        if (weeks && !parseWeeks(weeks)) { warnings.push(`เนื้อหาแถว ${line}: สัปดาห์ "${weeks}" ไม่ถูกรูปแบบ (ใช้ 3 หรือ 3-5) — เว้นว่างไว้`); weeks = ''; }
        const typeTxt = cell(ci.type);
        const type: 'LESSON' | 'EXAM' = /สอบ|exam|test|ทดสอบ/i.test(typeTxt) ? 'EXAM' : 'LESSON';
        if (typeTxt && !/^(บท|สอบ|exam|lesson)/i.test(typeTxt) && !/สอบ|ทดสอบ/.test(typeTxt)) warnings.push(`เนื้อหาแถว ${line}: ประเภท "${typeTxt}" ไม่รู้จัก — ถือเป็น "บท"`);
        let hours: number | null = null;
        const hTxt = cell(ci.hours);
        if (hTxt !== '') {
          const n = Number(hTxt.replace(/,/g, ''));
          if (Number.isFinite(n) && n >= 0 && n <= 100) hours = n; else warnings.push(`เนื้อหาแถว ${line}: ชั่วโมง "${hTxt}" ไม่ถูกต้อง (0–100) — เว้นว่างไว้`);
        }
        units.push({ id: newUnitId(), type, weeks, title: title.slice(0, 200), detail: cell(ci.detail), hours, activities: cell(ci.act), media: cell(ci.media) });
      });
    }
  }

  const aRows = rowsOf(wb, SHEET_ASSESS);
  const assessment: AssessmentItem[] = [];
  if (!aRows) warnings.push(`ไม่พบชีต "${SHEET_ASSESS}" — ไม่มีรายการวัดผล`);
  else {
    const h = aRows[0] || [];
    const cl = colIndex(h, 'รายการ'); const cp = colIndex(h, 'ร้อยละ', '%', 'เปอร์เซ็นต์');
    if (cl < 0 || cp < 0) errors.push(`ชีต "${SHEET_ASSESS}": ไม่พบหัวคอลัมน์ "รายการ" และ "ร้อยละ"`);
    else aRows.slice(1).forEach((r, i) => {
      const label = str(r[cl]); const pTxt = str(r[cp]).replace('%', '');
      if (!label && !pTxt) return;
      const p = Number(pTxt);
      if (!label) { warnings.push(`การวัดผลแถว ${i + 2}: ไม่มีชื่อรายการ — ข้าม`); return; }
      if (!Number.isFinite(p) || p < 0 || p > 100) { warnings.push(`การวัดผลแถว ${i + 2}: ร้อยละ "${pTxt}" ไม่ถูกต้อง — ข้าม`); return; }
      if (assessment.length >= MAX_ASSESSMENT) { warnings.push(`รายการวัดผลเกิน ${MAX_ASSESSMENT} รายการ — ตัดส่วนเกินออก`); return; }
      assessment.push({ label: label.slice(0, 120), percent: p });
    });
    const total = assessment.reduce((a, b) => a + b.percent, 0);
    if (assessment.length > 0 && Math.round(total * 100) / 100 !== 100) warnings.push(`รวมร้อยละการวัดผล = ${Math.round(total * 100) / 100} (ควรเท่ากับ 100)`);
  }
  if (errors.length > 0) return { content: null, errors, warnings };

  const content: ExcelContent = {
    courseType: pick(INFO_KEYS.courseType).slice(0, 80), levelLabel: pick(INFO_KEYS.levelLabel).slice(0, 80),
    credits: pick(INFO_KEYS.credits).slice(0, 10), hoursPerWeek: pick(INFO_KEYS.hoursPerWeek).slice(0, 10),
    description: pick(INFO_KEYS.description), assessmentNote: pick(INFO_KEYS.assessmentNote).slice(0, 500),
    indicators, units, assessment,
  };
  if (content.description.length > 2000) warnings.push(`คำอธิบายรายวิชายาว ${content.description.length} ตัวอักษร (เกิน 2,000) — แก้ในฟอร์มก่อนบันทึก`);
  // ข้อความยาวเกินที่ rules/ฟอร์มรับ — แจ้งก่อนบันทึก (ไม่ตัดเนื้อหาเงียบ ๆ ยกเว้นช่องที่ตัดไว้ข้างต้น)
  validateProject({ ...content }).forEach(p => { if (!warnings.includes(p)) warnings.push(p); });
  return { content, errors, warnings };
}

/** อ่านไฟล์ที่ผู้ใช้เลือก (ArrayBuffer) — ไฟล์เสีย/ไม่ใช่ Excel = errors */
export function parseProjectFile(buf: ArrayBuffer): ParseResult {
  let wb: XLSX.WorkBook;
  try { wb = XLSX.read(buf, { type: 'array' }); } catch { return { content: null, errors: ['เปิดไฟล์ไม่ได้ — ต้องเป็นไฟล์ .xlsx'], warnings: [] }; }
  return parseProjectWorkbook(wb);
}

/**
 * ใช้ id แถวเดิมเมื่อชื่อหัวข้อตรงกัน (+ประเภทเดียวกัน) — บันทึกหลังสอนที่อ้างหัวข้อเดิมไม่ขาดความเชื่อมโยงเมื่ออัพโหลดทับ
 * ชื่อซ้ำกันหลายแถวจับคู่ตามลำดับที่พบ
 */
export function reuseUnitIds(incoming: readonly ProjectUnit[], existing: readonly ProjectUnit[]): ProjectUnit[] {
  const pool = new Map<string, string[]>();
  existing.forEach(u => { const k = `${u.type}|${u.title.trim()}`; if (u.title.trim()) pool.set(k, [...(pool.get(k) || []), u.id]); });
  return incoming.map(u => {
    const k = `${u.type}|${u.title.trim()}`;
    const ids = pool.get(k);
    return ids && ids.length > 0 ? { ...u, id: ids.shift() as string } : u;
  });
}
