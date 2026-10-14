/** รายการลิงก์หลักฐาน/ลิงก์แผน (หลายลิงก์) — ใช้ร่วมกันระหว่าง PLC และการส่งแผนการสอน; ขอบเขตต้องตรง firestore.rules */
export const MAX_PLC_LINKS = 10;
export const MAX_PLAN_LINKS = 5;
export const MAX_PLC_PHOTOS = 4;
export const MAX_PLC_MEMBERS = 20;

export const isHttpsLink = (u: string) => /^https:\/\/[^ ]{4,490}$/.test((u || '').trim());
/** URL รูปที่อัปโหลดจากระบบ (Firebase Storage tokenized URL) */
export const isStoragePhotoUrl = (u: string) => /^https:\/\/firebasestorage\.googleapis\.com\/[^ ]{4,600}$/.test(u || '');

/** เพิ่มลิงก์เข้ารายการ: คืนรายการใหม่หรือข้อความผิดพลาด (ไม่ซ้ำ, https เท่านั้น, ไม่เกิน max) */
export function addLink(list: readonly string[], raw: string, max: number): { list: string[]; error?: string } {
  const u = (raw || '').trim();
  if (!isHttpsLink(u)) return { list: [...list], error: 'ลิงก์ต้องขึ้นต้นด้วย https:// และไม่มีช่องว่าง' };
  if (list.includes(u)) return { list: [...list], error: 'มีลิงก์นี้อยู่ในรายการแล้ว' };
  if (list.length >= max) return { list: [...list], error: `แนบได้ไม่เกิน ${max} ลิงก์` };
  return { list: [...list, u] };
}

/** ลิงก์ที่ใช้งานได้ทั้งหมดของเอกสาร (รองรับเอกสารเก่าที่มีฟิลด์เดี่ยว) */
export function linksOf(doc: { urls?: string[]; url?: string; evidenceUrls?: string[]; evidenceUrl?: string }): string[] {
  const many = doc.urls ?? doc.evidenceUrls;
  const out = many && many.length > 0 ? many : [doc.url ?? doc.evidenceUrl ?? ''];
  return out.filter(isHttpsLink);
}
