/**
 * ตรวจข้อมูลก่อนสร้างบุคลากรรายบุคคล (callable createStaffMember) — pure function + lookups ที่ inject เข้ามา
 * เพื่อให้ unit test ได้ครบทุกกิ่ง (src/__tests__/staffValidation.test.ts)
 */
import { ALLOWED_EMAIL_DOMAIN, studentIdFromEmail } from './access';
import { normalizeEmail } from './email';

/** staff doc id (teacherId): ตัวอักษร/ตัวเลขขึ้นต้น ตามด้วยตัวอักษร ตัวเลข - หรือ _ (ยาวไม่เกิน 64) — ห้าม / . ช่องว่าง */
export const STAFF_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

/** บทบาทที่ไม่ใช่บุคลากร — สร้างบุคลากรด้วยบทบาทเหล่านี้ไม่ได้ */
export const NON_STAFF_ROLES = ['STUDENT', 'PARENT'];

const ROLE_PATTERN = /^[A-Z_]+$/;
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+$/;
const MAX_TEXT = 120;

export interface NewStaffInput {
  staffId?: unknown;
  email?: unknown;
  roles?: unknown;
  prefix?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  position?: unknown;
  departmentId?: unknown;
}

export interface NewStaff {
  staffId: string;
  email: string;
  roles: string[];
  prefix: string;
  firstName: string;
  lastName: string;
  position: string;
  departmentId: string;
}

export interface NewStaffLookups {
  staffExists(staffId: string): Promise<boolean>;
  /** staff ทุกคนที่ใช้อีเมลนี้ (รวมคนที่ถูกปิดการใช้งาน) */
  findStaffIdsByEmail(email: string): Promise<string[]>;
  findStudentIdsByEmail(email: string): Promise<string[]>;
}

export type NewStaffError = { ok: false; code: 'invalid-argument' | 'already-exists'; message: string };
export type NewStaffResult = { ok: true; value: NewStaff } | NewStaffError;

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const fail = (code: NewStaffError['code'], message: string): NewStaffError => ({ ok: false, code, message });

export async function validateNewStaff(input: NewStaffInput, lookups: NewStaffLookups): Promise<NewStaffResult> {
  // 1. รูปแบบ (ไม่ต้องอ่านฐานข้อมูล)
  const staffId = text(input.staffId);
  if (!STAFF_ID_PATTERN.test(staffId)) {
    return fail('invalid-argument', 'รหัสบุคลากรไม่ถูกต้อง — ใช้ตัวอักษรภาษาอังกฤษ ตัวเลข - หรือ _ (ขึ้นต้นด้วยตัวอักษรหรือตัวเลข ไม่เกิน 64 ตัว)');
  }

  const email = normalizeEmail(input.email);
  if (!email || !EMAIL_SHAPE.test(email)) return fail('invalid-argument', 'อีเมลไม่ถูกต้อง');
  if (!email.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`)) {
    return fail('invalid-argument', `อีเมลบุคลากรต้องเป็นบัญชีของโรงเรียน (@${ALLOWED_EMAIL_DOMAIN}) เท่านั้น`);
  }
  if (studentIdFromEmail(email) !== null) {
    return fail('invalid-argument', 'อีเมลรูปแบบ it{รหัสนักเรียน}@utd.ac.th สงวนไว้สำหรับนักเรียน ใช้เป็นอีเมลบุคลากรไม่ได้');
  }

  if (!Array.isArray(input.roles) || !input.roles.every((r) => typeof r === 'string' && ROLE_PATTERN.test(r))) {
    return fail('invalid-argument', 'รูปแบบบทบาทไม่ถูกต้อง');
  }
  const roles = Array.from(new Set(input.roles as string[]));
  if (roles.length === 0) return fail('invalid-argument', 'ต้องเลือกบทบาทอย่างน้อย 1 บทบาท');
  const nonStaff = roles.filter((r) => NON_STAFF_ROLES.includes(r));
  if (nonStaff.length > 0) {
    return fail('invalid-argument', `บุคลากรมีบทบาท ${nonStaff.join(', ')} ไม่ได้ (เป็นบทบาทของนักเรียน/ผู้ปกครอง)`);
  }

  const firstName = text(input.firstName);
  const lastName = text(input.lastName);
  if (!firstName || !lastName) return fail('invalid-argument', 'กรุณากรอกชื่อและนามสกุล');
  const prefix = text(input.prefix);
  const position = text(input.position);
  const departmentId = text(input.departmentId);
  if ([prefix, firstName, lastName, position, departmentId].some((v) => v.length > MAX_TEXT)) {
    return fail('invalid-argument', `ข้อความแต่ละช่องยาวได้ไม่เกิน ${MAX_TEXT} ตัวอักษร`);
  }

  // 2. ความซ้ำซ้อนกับข้อมูลที่มีอยู่
  if (await lookups.staffExists(staffId)) {
    return fail('already-exists', `มีบุคลากรรหัส "${staffId}" อยู่แล้ว (รวมบุคลากรที่ถูกปิดการใช้งาน)`);
  }
  const staffWithEmail = await lookups.findStaffIdsByEmail(email);
  if (staffWithEmail.length > 0) {
    return fail('already-exists', `อีเมล ${email} ถูกใช้โดยบุคลากรรหัส ${staffWithEmail.join(', ')} อยู่แล้ว (รวมบุคลากรที่ถูกปิดการใช้งาน)`);
  }
  const studentsWithEmail = await lookups.findStudentIdsByEmail(email);
  if (studentsWithEmail.length > 0) {
    return fail('already-exists', `อีเมล ${email} เป็นอีเมลของนักเรียนรหัส ${studentsWithEmail.join(', ')}`);
  }

  return { ok: true, value: { staffId, email, roles, prefix, firstName, lastName, position, departmentId } };
}
