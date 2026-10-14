/** หน้าสารสนเทศโรงเรียนสาธารณะ (/info) — ตัวช่วยล้วน (ทดสอบได้) */

/** ค่าที่ซ่อนจาก server (null = นับได้ 1–4 หรือเกี่ยวข้องน้อยกว่า 5 คน) แสดงเป็น "<5" */
export type PublicCell = number | null;

export const isPublicInfoPath = (pathname: string) => /^\/info\/?$/.test(pathname);

export const formatCell = (c: PublicCell | undefined): string =>
  c === null ? '<5' : typeof c === 'number' ? c.toLocaleString('th-TH') : '-';

/** แถวของแผนภูมิแท่ง: ช่องที่ซ่อนมีความยาวแท่งเป็น 0 (ไม่เดาค่า) */
export function barRows(counts: Record<string, PublicCell> | undefined, order?: readonly string[]) {
  const keys = order ? order.filter((k) => counts && k in counts) : Object.keys(counts || {});
  const max = Math.max(1, ...keys.map((k) => (typeof counts?.[k] === 'number' ? (counts[k] as number) : 0)));
  return keys.map((k) => {
    const v: PublicCell = counts && k in counts ? counts[k] : 0; // null (ซ่อน) ต้องคงเป็น null ห้ามกลายเป็น 0
    return { key: k, label: k, value: v, text: formatCell(v), pct: typeof v === 'number' ? (v / max) * 100 : 0 };
  });
}

export const MONTH_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
/** "2026-09" → "ก.ย. 2569" */
export function monthLabel(ym: string): string {
  const m = ym.match(/^(\d{4})-(\d{2})$/);
  return m ? `${MONTH_TH[Number(m[2]) - 1] || m[2]} ${Number(m[1]) + 543}` : ym;
}
