import { normalizeEmail } from './normalizeEmail';

/**
 * ตรวจอีเมลซ้ำตอนนำเข้าบุคลากร (TEACHER) ก่อนเขียน staff/teachers
 *
 * อีเมลเดียวกันแต่คนละรหัส (staff doc id) ทำให้ blocking function เจอ staff > 1 doc
 * → AMBIGUOUS_RECORD ปฏิเสธการ login ของคนนั้นทั้งหมด (ปิดใช้งานรายการหนึ่งก็ไม่ช่วย) จึงต้องไม่นำเข้า
 *
 * - รหัสเดียวกัน + อีเมลเดียวกัน = นำเข้าซ้ำเพื่ออัปเดต → ผ่าน
 * - doc alias เก่าที่ใช้อีเมลเป็น doc id ถูกข้าม (เหมือน functions/src/access.ts)
 */
export interface ExistingStaffEmail {
  id: string;
  email?: string;
}

/** map อีเมล (normalize แล้ว) → รหัส staff ที่มีอยู่แล้ว */
export function buildExistingEmailIndex(staff: ExistingStaffEmail[]): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const s of staff) {
    const email = normalizeEmail(s.email);
    if (!email || s.id.toLowerCase() === email) continue;
    const ids = index.get(email) ?? [];
    ids.push(s.id);
    index.set(email, ids);
  }
  return index;
}

/**
 * คืนข้อความ error ภาษาไทยถ้าอีเมลของแถวนี้ชนกับบุคลากรคนอื่น; ไม่ชน = null
 * `seenEmails` = อีเมลที่พบแล้วในไฟล์เดียวกัน (email → teacherId แรกที่ใช้) — เติมให้เองเมื่อไม่ชน
 */
export function staffEmailConflict(
  teacherId: string,
  rawEmail: string,
  existing: Map<string, string[]>,
  seenEmails: Map<string, string>,
): string | null {
  const email = normalizeEmail(rawEmail);
  if (!email) return null;

  const others = (existing.get(email) ?? []).filter(id => id !== teacherId);
  if (others.length > 0) {
    return `อีเมลนี้มีอยู่แล้วในระบบกับรหัส ${others.join(', ')} — ไม่นำเข้า (ถ้าเป็นคนเดียวกัน ให้ใช้รหัสเดิม)`;
  }

  const firstInFile = seenEmails.get(email);
  if (firstInFile !== undefined && firstInFile !== teacherId) {
    return `อีเมลซ้ำกับรหัส ${firstInFile} ในไฟล์เดียวกัน`;
  }
  if (firstInFile === undefined && teacherId) seenEmails.set(email, teacherId);
  return null;
}
