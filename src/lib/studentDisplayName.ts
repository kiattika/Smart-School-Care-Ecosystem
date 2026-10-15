/**
 * ชื่อนักเรียนสำหรับแสดงผล — ใส่คำนำหน้า (title) หน้าชื่อก็ต่อเมื่อชื่อเต็มยังไม่ขึ้นต้นด้วยคำนำหน้านั้น
 * (fullName ในทะเบียนหลายรายการเก็บคำนำหน้าไว้แล้ว เช่น "ด.ช.นักเรียน…" → เดิมต่อ title ซ้ำเป็น "ด.ช.ด.ช.นักเรียน…")
 */
export function studentDisplayName(s: { title?: string; fullName?: string; name?: string }): string {
  const full = (s.fullName || s.name || '').trim();
  const title = (s.title || '').trim();
  return title && !full.startsWith(title) ? `${title}${full}` : full;
}
