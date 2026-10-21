/**
 * ตัดคอมเมนต์ออกจาก firestore.rules.comments เพื่อสร้าง firestore.rules ที่ใช้ deploy
 * เหตุผล: Firestore จำกัดไฟล์ rules ที่ 262,144 ไบต์ และตัวอักษรไทยกิน 3 ไบต์/ตัว — คอมเมนต์ไทยกินที่ราว 40%
 * ลบเฉพาะคอมเมนต์ `// …` ที่อยู่นอกสตริง (URL ภายใน regex ปลอดภัย) — ไม่แตะตรรกะ
 */
export const RULES_BYTE_LIMIT = 262_144;
export const RULES_HEADER = '// สร้างอัตโนมัติจาก firestore.rules.comments (npm run rules:build) — ห้ามแก้ไฟล์นี้โดยตรง';

export function stripRulesComments(src: string): string {
  const kept: string[] = [];
  for (const rawLine of src.replace(/\r\n/g, '\n').split('\n')) {
    let quote: string | null = null;
    let cut = -1;
    for (let i = 0; i < rawLine.length; i++) {
      const c = rawLine[i];
      if (quote) {
        if (c === '\\') { i++; continue; }
        if (c === quote) quote = null;
      } else if (c === "'" || c === '"') {
        quote = c;
      } else if (c === '/' && rawLine[i + 1] === '/') {
        cut = i;
        break;
      }
    }
    const line = (cut >= 0 ? rawLine.slice(0, cut) : rawLine).replace(/\s+$/, '');
    if (cut >= 0 && line.trim() === '') continue; // บรรทัดคอมเมนต์ล้วน → ตัดทิ้ง
    kept.push(line);
  }
  // ยุบบรรทัดว่างซ้อนให้เหลือบรรทัดเดียว
  const collapsed: string[] = [];
  for (const l of kept) {
    if (l === '' && collapsed.length > 0 && collapsed[collapsed.length - 1] === '') continue;
    collapsed.push(l);
  }
  const [first, ...rest] = collapsed; // rules_version ต้องเป็นบรรทัดแรก — header ต่อจากนั้น
  return [first, RULES_HEADER, ...rest].join('\n').replace(/\n+$/, '') + '\n';
}
