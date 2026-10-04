/**
 * สำเนาฝั่ง client ของ functions/src/studentEmailFormat.ts (functions import โค้ดจาก src/ ไม่ได้ และกลับกัน)
 * ต้องให้ผลเหมือนกันทุกตัวอักษร — มี test เทียบสองฝั่ง: src/__tests__/studentEmailFormat.test.ts
 * แก้ที่ใดที่หนึ่งต้องแก้ทั้งคู่
 *
 * รูปแบบอีเมลนักเรียน: {prefix}{studentId}@{domain} — ค่าอยู่ที่ Firestore school_settings/studentEmailFormat
 * (client อ่านผ่าน useStudentEmailFormat, function ใช้ตอน login) ไม่มี doc / ผิดรูปแบบ = it / utd.ac.th
 */

export interface StudentEmailFormat {
  prefix: string;
  domain: string;
}

export const DEFAULT_STUDENT_EMAIL_FORMAT: StudentEmailFormat = { prefix: 'it', domain: 'utd.ac.th' };

export const PREFIX_PATTERN = /^[a-z0-9._-]{0,32}$/;
export const DOMAIN_PATTERN = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

const clean = (v: unknown): string | null => (typeof v === 'string' ? v.trim().toLowerCase() : null);

export const isValidPrefix = (v: string): boolean => PREFIX_PATTERN.test(v);
export const isValidDomain = (v: string): boolean => v.length <= 253 && DOMAIN_PATTERN.test(v);

/** ค่าจาก Firestore → รูปแบบที่ใช้งานได้เสมอ ไม่ throw (ฟิลด์ที่ไม่มี/ผิดรูปแบบ → ค่าเริ่มต้นของฟิลด์นั้น) */
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

/** ตรวจค่าที่ admin กรอก — ผิดแล้วบอกเหตุผลเป็นภาษาไทย (ไม่เติมค่าเริ่มต้นให้เงียบๆ) */
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

/** ข้อความแสดงรูปแบบ เช่น 'it{รหัสประจำตัว}@utd.ac.th' (ใช้ใน placeholder / คำอธิบาย) */
export function studentEmailPatternLabel(format: StudentEmailFormat = DEFAULT_STUDENT_EMAIL_FORMAT): string {
  return `${format.prefix}{รหัสประจำตัว}@${format.domain}`;
}
