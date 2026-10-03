/**
 * สำเนาฝั่ง Cloud Functions ของ src/lib/normalizeEmail.ts (functions import โค้ดจาก src/ ของ client ไม่ได้)
 * ต้องให้ผลเหมือนกันทุกตัวอักษร — มี test เทียบสองฝั่ง: src/__tests__/staffValidation.test.ts
 * ตัดอักขระล่องหน (zero-width / BOM) + trim + lowercase
 */
export function normalizeEmail(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(/[\u200B-\u200D\u2060\uFEFF]/g, '').trim().toLowerCase();
}
