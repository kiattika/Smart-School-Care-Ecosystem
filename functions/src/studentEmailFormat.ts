/**
 * รูปแบบอีเมลนักเรียน — ตั้งค่าได้ที่ Firestore school_settings/studentEmailFormat { prefix, domain }
 * รูปแบบเต็ม: {prefix}{studentId}@{domain} (ยังไม่รองรับ suffix / template ซับซ้อนกว่านี้)
 *
 * pure + ไม่ import อะไรเลย (ทดสอบได้) — ต้องให้ผลเหมือน src/lib/studentEmailFormat.ts ของ client ทุกตัวอักษร
 * (functions import โค้ดจาก src/ ไม่ได้) มี test เทียบสองฝั่งใน src/__tests__/studentEmailFormat.test.ts
 *
 * ใช้ใน path ของการ login (access.ts) — sanitizeStudentEmailFormat ห้าม throw เด็ดขาด:
 * ค่าไม่มี/ผิดรูปแบบ = ใช้ค่าเริ่มต้นเดิมของฟิลด์นั้น
 */

export interface StudentEmailFormat {
  prefix: string;
  domain: string;
}

export const DEFAULT_STUDENT_EMAIL_FORMAT: StudentEmailFormat = { prefix: 'it', domain: 'utd.ac.th' };

/** prefix: ตัวพิมพ์เล็ก ตัวเลข . _ - (ว่างได้ — ไม่มี prefix) ยาวไม่เกิน 32 */
export const PREFIX_PATTERN = /^[a-z0-9._-]{0,32}$/;
/** domain: อย่างน้อย 2 ส่วนคั่นด้วยจุด (เช่น utd.ac.th, student.utd.ac.th) ไม่มี @ ช่องว่าง หรือเครื่องหมายอื่น */
export const DOMAIN_PATTERN = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

const clean = (v: unknown): string | null => (typeof v === 'string' ? v.trim().toLowerCase() : null);

export const isValidPrefix = (v: string): boolean => PREFIX_PATTERN.test(v);
export const isValidDomain = (v: string): boolean => v.length <= 253 && DOMAIN_PATTERN.test(v);

/**
 * ค่าจาก Firestore (ไม่รู้ว่าหน้าตาเป็นอย่างไร) → รูปแบบที่ใช้งานได้เสมอ ไม่ throw
 * แต่ละฟิลด์: ไม่ใช่ string / ผิดรูปแบบ → ค่าเริ่มต้นของฟิลด์นั้น
 */
export function sanitizeStudentEmailFormat(raw: unknown): StudentEmailFormat {
  const obj = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const prefix = clean(obj.prefix);
  const domain = clean(obj.domain);
  return {
    prefix: prefix !== null && isValidPrefix(prefix) ? prefix : DEFAULT_STUDENT_EMAIL_FORMAT.prefix,
    domain: domain !== null && isValidDomain(domain) ? domain : DEFAULT_STUDENT_EMAIL_FORMAT.domain,
  };
}

export interface StudentEmailFormatErrors {
  prefix?: string;
  domain?: string;
}

/** ตรวจค่าที่ admin กรอก — ผิดแล้วบอกเหตุผลเป็นภาษาไทย (ไม่เติมค่าเริ่มต้นให้เงียบๆ เหมือน sanitize) */
export function validateStudentEmailFormat(
  input: { prefix?: unknown; domain?: unknown },
): { ok: true; value: StudentEmailFormat } | { ok: false; errors: StudentEmailFormatErrors } {
  const prefix = clean(input.prefix) ?? '';
  const domain = clean(input.domain) ?? '';
  const errors: StudentEmailFormatErrors = {};
  if (!isValidPrefix(prefix)) errors.prefix = 'ใช้ได้เฉพาะตัวอักษรภาษาอังกฤษ ตัวเลข . _ - (ไม่เกิน 32 ตัว, เว้นว่างได้)';
  if (!domain) errors.domain = 'กรุณากรอกโดเมน เช่น utd.ac.th';
  else if (!isValidDomain(domain)) errors.domain = 'โดเมนไม่ถูกต้อง — กรอกเฉพาะชื่อโดเมน เช่น utd.ac.th (ไม่ต้องใส่ @)';
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, value: { prefix, domain } };
}

/** อีเมลนักเรียนตามรูปแบบ (ตัวพิมพ์เล็กเสมอ — blocking function ค้นด้วยอีเมลตัวพิมพ์เล็กแบบตรงตัว) */
export function formatStudentEmail(studentId: string, format: StudentEmailFormat = DEFAULT_STUDENT_EMAIL_FORMAT): string {
  return `${format.prefix}${studentId.trim()}@${format.domain}`.toLowerCase();
}

/** template สำหรับ studentIdFromEmail ใน access.ts เช่น 'it{studentId}@utd.ac.th' */
export function studentEmailTemplate(format: StudentEmailFormat = DEFAULT_STUDENT_EMAIL_FORMAT): string {
  return `${format.prefix}{studentId}@${format.domain}`;
}
