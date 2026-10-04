/**
 * กติกาสิทธิ์เข้าระบบ (ยืนยันกับเจ้าของโปรเจกต์แล้ว) — pure function ไม่แตะ Firebase ใดๆ
 * เพื่อให้ unit test ได้ครบทุกกิ่ง (src/__tests__/resolveAccess.test.ts)
 *
 * - ต้องมีอีเมล, emailVerified = true และโดเมนเป็น @utd.ac.th เท่านั้น — ข้อยกเว้นเดียว: โดเมนอีเมลนักเรียนที่ admin
 *   ตั้งไว้ใน school_settings/studentEmailFormat (ผ่านได้เฉพาะทางนักเรียน; บุคลากรยังต้อง @utd.ac.th)
 * - เจอใน staff (ด้วย email ตัวพิมพ์เล็ก) → roles จาก staff doc; roles ว่าง = ปฏิเสธ
 * - ไม่เจอใน staff → หา students ด้วย field email, ไม่เจอค่อยลองรูปแบบอีเมลนักเรียนจาก config
 *   ({prefix}{studentId}@{domain}) → roles ['STUDENT']
 * - อ่าน config ไม่ได้ / ช้า / ผิดรูปแบบ = ใช้ค่าเริ่มต้น it / utd.ac.th (path ของการ login ห้ามพัง)
 * - ไม่เจอทั้งคู่ = ปฏิเสธ (ไม่มี default role ใดๆ ทั้งสิ้น)
 *
 * ผู้เรียกใช้: beforeUserCreated / beforeUserSignedIn ใน authBlocking.ts
 */

import {
  DEFAULT_STUDENT_EMAIL_FORMAT,
  StudentEmailFormat,
  sanitizeStudentEmailFormat,
  studentEmailTemplate,
} from './studentEmailFormat';

export const ALLOWED_EMAIL_DOMAIN = 'utd.ac.th';

/**
 * template อีเมลนักเรียน "ค่าเริ่มต้น" — `{studentId}` คือรหัสนักเรียน (ตัวเลข)
 * ค่าจริงที่ใช้ตอน login อ่านจาก school_settings/studentEmailFormat (ดู studentEmailFormat.ts)
 * ค่านี้ใช้เมื่อไม่มี config / อ่านไม่ได้ เท่านั้น
 */
export const STUDENT_EMAIL_TEMPLATE = studentEmailTemplate(DEFAULT_STUDENT_EMAIL_FORMAT);

/** รอ config ได้ไม่เกินนี้ (ms) — blocking function ต้องตอบภายใน 7 วินาที */
export const STUDENT_EMAIL_FORMAT_TIMEOUT_MS = 2000;

export interface StaffRecord {
  /** document id ของ staff (= teacherId จากไฟล์ import ไม่ใช่ Auth UID) */
  id: string;
  roles?: unknown;
  /** 'ACTIVE' | 'INACTIVE' — ไม่มี field = ACTIVE (ข้อมูลเดิมก่อนมีระบบปิดการใช้งาน) */
  status?: unknown;
}

/** บุคลากรถูกปิดการใช้งานหรือไม่ — เฉพาะ status === 'INACTIVE' เท่านั้น (ไม่มี field / ค่าอื่น = ใช้งานได้) */
export function isStaffInactive(status: unknown): boolean {
  return status === 'INACTIVE';
}

export interface StudentRecord {
  /** document id ของ students (= รหัสนักเรียน) */
  id: string;
  studentUid?: unknown;
}

export interface AccessLookups {
  /**
   * ค่าดิบของ school_settings/studentEmailFormat (null = ไม่มี doc) — ไม่ implement = ใช้ค่าเริ่มต้น
   * ผู้เรียกไม่ต้อง catch: resolveAccess ครอบ error/timeout และ sanitize ให้เอง
   */
  getStudentEmailFormat?(): Promise<unknown>;
  findStaffByEmail(email: string): Promise<StaffRecord[]>;
  findStudentsByEmail(email: string): Promise<StudentRecord[]>;
  getStudentById(studentId: string): Promise<StudentRecord | null>;
}

export type DenyReason =
  | 'INCOMPLETE_EVENT'
  | 'NO_EMAIL'
  | 'EMAIL_NOT_VERIFIED'
  | 'DOMAIN_NOT_ALLOWED'
  | 'STAFF_NO_ROLES'
  | 'STAFF_INACTIVE'
  | 'AMBIGUOUS_RECORD'
  | 'NOT_REGISTERED';

export type AccessDecision =
  | { allowed: true; kind: 'staff'; staffId: string; roles: string[]; primaryRole: string }
  | { allowed: true; kind: 'student'; studentId: string; roles: ['STUDENT']; primaryRole: 'STUDENT'; studentUid: string | null }
  | { allowed: false; reason: DenyReason };

/** ข้อความที่ผู้ใช้เห็นบนหน้า Login (ส่งผ่าน HttpsError ของ blocking function) */
export const DENY_MESSAGES: Record<DenyReason, string> = {
  INCOMPLETE_EVENT: 'ไม่สามารถยืนยันข้อมูลบัญชีที่ใช้เข้าสู่ระบบได้ จึงไม่อนุญาตให้เข้าใช้งาน กรุณาลองใหม่อีกครั้ง หากยังไม่ได้ กรุณาติดต่อผู้ดูแลระบบ',
  NO_EMAIL: 'บัญชีนี้ไม่มีอีเมล จึงเข้าใช้งานระบบไม่ได้ กรุณาติดต่อผู้ดูแลระบบ',
  EMAIL_NOT_VERIFIED: 'อีเมลของบัญชีนี้ยังไม่ได้รับการยืนยัน จึงเข้าใช้งานระบบไม่ได้ กรุณาติดต่อผู้ดูแลระบบ',
  DOMAIN_NOT_ALLOWED: `ระบบนี้รองรับเฉพาะบัญชี Google Workspace ของโรงเรียน (@${ALLOWED_EMAIL_DOMAIN}) เท่านั้น หากเป็นบุคลากรหรือนักเรียนของโรงเรียน กรุณาติดต่อผู้ดูแลระบบ`,
  STAFF_NO_ROLES: 'บัญชีนี้ยังไม่ได้รับการกำหนดบทบาทในระบบ กรุณาติดต่อผู้ดูแลระบบ',
  STAFF_INACTIVE: 'บัญชีบุคลากรนี้ถูกปิดการใช้งานแล้ว จึงเข้าใช้งานระบบไม่ได้ กรุณาติดต่อผู้ดูแลระบบ',
  AMBIGUOUS_RECORD: 'พบข้อมูลบุคคลซ้ำซ้อนสำหรับอีเมลนี้ ระบบจึงไม่อนุญาตให้เข้าใช้งาน กรุณาติดต่อผู้ดูแลระบบ',
  NOT_REGISTERED: 'ไม่พบบัญชีนี้ในทะเบียนบุคลากรหรือนักเรียนของโรงเรียน กรุณาติดต่อผู้ดูแลระบบ',
};

/**
 * ข้อมูลผู้ใช้จาก blocking event — ตั้งแต่ firebase-functions v7 `event.data` เป็น `AuthUserRecord | undefined`
 * ไม่มี data หรือไม่มี uid = null → ผู้เรียกต้องปฏิเสธ (fail closed: ไม่รู้ว่าเป็นใคร = ไม่ให้เข้า)
 */
export function blockingUserFromEvent(
  data: { uid?: unknown; email?: unknown; emailVerified?: unknown } | null | undefined,
): { uid: string; email: string | null; emailVerified: boolean } | null {
  if (!data || typeof data.uid !== 'string' || data.uid === '') return null;
  return {
    uid: data.uid,
    email: typeof data.email === 'string' ? data.email : null,
    emailVerified: data.emailVerified === true,
  };
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** ดึงรหัสนักเรียนจากอีเมลตาม template (เช่น it38501@utd.ac.th → '38501') ไม่ตรงรูปแบบ → null */
export function studentIdFromEmail(email: string, template: string = STUDENT_EMAIL_TEMPLATE): string | null {
  const [before, after] = template.toLowerCase().split('{studentid}');
  if (after === undefined) return null;
  const re = new RegExp(`^${escapeRegExp(before)}(\\d+)${escapeRegExp(after)}$`);
  const m = email.toLowerCase().match(re);
  return m ? m[1] : null;
}

/** อ่าน config รูปแบบอีเมลนักเรียน — ไม่ throw ไม่ค้าง: error / timeout / ผิดรูปแบบ → ค่าเริ่มต้นเดิม */
async function loadStudentEmailFormat(lookups: AccessLookups): Promise<StudentEmailFormat> {
  if (!lookups.getStudentEmailFormat) return DEFAULT_STUDENT_EMAIL_FORMAT;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const raw = await Promise.race([
      lookups.getStudentEmailFormat(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), STUDENT_EMAIL_FORMAT_TIMEOUT_MS); }),
    ]);
    return sanitizeStudentEmailFormat(raw);
  } catch (err) {
    console.warn('[access] school_settings/studentEmailFormat unavailable — using default format:', err instanceof Error ? err.message : err);
    return DEFAULT_STUDENT_EMAIL_FORMAT;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function normalizeRoles(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return Array.from(new Set(raw.filter((r): r is string => typeof r === 'string' && r.trim() !== '').map((r) => r.trim())));
}

export async function resolveAccess(
  user: { email?: string | null; emailVerified?: boolean | null },
  lookups: AccessLookups,
): Promise<AccessDecision> {
  const email = (user.email || '').trim().toLowerCase();
  if (!email) return { allowed: false, reason: 'NO_EMAIL' };
  if (user.emailVerified !== true) return { allowed: false, reason: 'EMAIL_NOT_VERIFIED' };
  // โดเมนโรงเรียน (@utd.ac.th) ผ่านเสมอ; โดเมนอื่นผ่านได้เฉพาะโดเมนอีเมลนักเรียนที่ admin ตั้งไว้ และเข้าได้ทางนักเรียนเท่านั้น
  // (อ่าน config เมื่อจำเป็นเท่านั้น — login ของบุคลากร @utd.ac.th ไม่ต้องอ่านเพิ่ม)
  const schoolDomain = email.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`);
  let format: StudentEmailFormat | null = null;
  if (!schoolDomain) {
    format = await loadStudentEmailFormat(lookups);
    if (!email.endsWith(`@${format.domain}`)) return { allowed: false, reason: 'DOMAIN_NOT_ALLOWED' };
  }

  // 1. บุคลากร — ข้าม doc alias เก่าที่ใช้อีเมลเป็น doc id (seed เดิมเขียน staff/{email} ซ้ำกับ staff/{uid})
  //    (โดเมนนักเรียนที่ไม่ใช่ @utd.ac.th ข้ามขั้นนี้ — บุคลากรต้องใช้อีเมลโรงเรียนเท่านั้น)
  const staff = schoolDomain ? (await lookups.findStaffByEmail(email)).filter((s) => s.id.toLowerCase() !== email) : [];
  if (staff.length > 1) return { allowed: false, reason: 'AMBIGUOUS_RECORD' };
  if (staff.length === 1) {
    // ปิดการใช้งาน (setStaffActive) — ตรวจก่อน roles: คนที่ถูกปิดต้องได้ข้อความนี้เสมอ ไม่ไหลไปเป็นนักเรียน
    if (isStaffInactive(staff[0].status)) return { allowed: false, reason: 'STAFF_INACTIVE' };
    const roles = normalizeRoles(staff[0].roles);
    if (roles.length === 0) return { allowed: false, reason: 'STAFF_NO_ROLES' };
    return { allowed: true, kind: 'staff', staffId: staff[0].id, roles, primaryRole: roles[0] };
  }

  // 2. นักเรียน — field email ก่อน แล้วค่อยรูปแบบอีเมลมาตรฐาน
  let student: StudentRecord | null = null;
  const byEmail = await lookups.findStudentsByEmail(email);
  if (byEmail.length > 1) return { allowed: false, reason: 'AMBIGUOUS_RECORD' };
  if (byEmail.length === 1) {
    student = byEmail[0];
  } else {
    format = format ?? await loadStudentEmailFormat(lookups);
    const sid = studentIdFromEmail(email, studentEmailTemplate(format));
    if (sid) student = await lookups.getStudentById(sid);
  }

  if (!student) return { allowed: false, reason: 'NOT_REGISTERED' };
  return {
    allowed: true,
    kind: 'student',
    studentId: student.id,
    roles: ['STUDENT'],
    primaryRole: 'STUDENT',
    studentUid: typeof student.studentUid === 'string' && student.studentUid ? student.studentUid : null,
  };
}
