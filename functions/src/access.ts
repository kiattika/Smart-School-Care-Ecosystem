/**
 * กติกาสิทธิ์เข้าระบบ (ยืนยันกับเจ้าของโปรเจกต์แล้ว) — pure function ไม่แตะ Firebase ใดๆ
 * เพื่อให้ unit test ได้ครบทุกกิ่ง (src/__tests__/resolveAccess.test.ts)
 *
 * - ต้องมีอีเมล, emailVerified = true และโดเมนเป็น @utd.ac.th เท่านั้น
 * - เจอใน staff (ด้วย email ตัวพิมพ์เล็ก) → roles จาก staff doc; roles ว่าง = ปฏิเสธ
 * - ไม่เจอใน staff → หา students ด้วย field email, ไม่เจอค่อยลองรูปแบบ STUDENT_EMAIL_TEMPLATE
 *   → roles ['STUDENT']
 * - ไม่เจอทั้งคู่ = ปฏิเสธ (ไม่มี default role ใดๆ ทั้งสิ้น)
 *
 * ผู้เรียกใช้: beforeUserCreated / beforeUserSignedIn ใน authBlocking.ts
 */

export const ALLOWED_EMAIL_DOMAIN = 'utd.ac.th';

/**
 * รูปแบบอีเมลนักเรียน (Google Workspace ของโรงเรียน) — `{studentId}` คือรหัสนักเรียน (ตัวเลข)
 * ใช้เป็นทางสำรองเมื่อ students/{id} ยังไม่มี field email. เก็บเป็นค่าเดียวตรงนี้
 * เพราะจะย้ายไปตั้งค่าใน admin settings ภายหลัง
 */
export const STUDENT_EMAIL_TEMPLATE = 'it{studentId}@utd.ac.th';

export interface StaffRecord {
  /** document id ของ staff (= teacherId จากไฟล์ import ไม่ใช่ Auth UID) */
  id: string;
  roles?: unknown;
}

export interface StudentRecord {
  /** document id ของ students (= รหัสนักเรียน) */
  id: string;
  studentUid?: unknown;
}

export interface AccessLookups {
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
  if (!email.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`)) return { allowed: false, reason: 'DOMAIN_NOT_ALLOWED' };

  // 1. บุคลากร — ข้าม doc alias เก่าที่ใช้อีเมลเป็น doc id (seed เดิมเขียน staff/{email} ซ้ำกับ staff/{uid})
  const staff = (await lookups.findStaffByEmail(email)).filter((s) => s.id.toLowerCase() !== email);
  if (staff.length > 1) return { allowed: false, reason: 'AMBIGUOUS_RECORD' };
  if (staff.length === 1) {
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
    const sid = studentIdFromEmail(email);
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
