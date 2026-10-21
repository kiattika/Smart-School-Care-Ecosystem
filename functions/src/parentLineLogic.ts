// logic ล้วน (ไม่แตะ Firebase) ของระบบยืนยันผู้ปกครองผ่าน LINE — แยกไฟล์เพื่อให้ vitest ทดสอบได้
import { createHmac, timingSafeEqual } from 'crypto';

export const LINE_VERIFY_URL = 'https://api.line.me/oauth2/v2.1/verify';
/** ผิดติดกันกี่ครั้งถึงล็อก และล็อกกี่นาที */
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_MINUTES = 30;

/** เลขบัตรประชาชนไทย 13 หลัก + checksum (ชุดเดียวกับฝั่ง client) */
export function normalizeNationalId(raw: unknown): string {
  return String(raw ?? '').replace(/[\s-]/g, '');
}

export function isValidThaiNationalId(raw: unknown): boolean {
  const id = normalizeNationalId(raw);
  if (!/^\d{13}$/.test(id)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(id.charAt(i), 10) * (13 - i);
  return (11 - (sum % 11)) % 10 === parseInt(id.charAt(12), 10);
}

/** HMAC-SHA256(เลขบัตร, pepper) → hex — pepper อยู่ใน Functions secret เท่านั้น (ไม่อยู่ใน Firestore/client) */
export function hmacNationalId(nationalId: string, pepper: string): string {
  if (!pepper) throw new Error('PARENT_ID_PEPPER ว่าง');
  return createHmac('sha256', pepper).update(normalizeNationalId(nationalId)).digest('hex');
}

export function hashesEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a || '', 'utf8');
  const bb = Buffer.from(b || '', 'utf8');
  return ba.length === bb.length && ba.length > 0 && timingSafeEqual(ba, bb);
}

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) =>
  Promise<{ ok: boolean; status: number; json: () => Promise<any> }>;

export interface LineIdentity { sub: string; name: string; picture?: string }

/** ยืนยัน ID token กับเซิร์ฟเวอร์ LINE — ไม่ผ่าน/aud ไม่ตรง/หมดอายุ = throw */
export async function verifyLineIdToken(idToken: string, channelId: string, fetchFn: FetchLike, nowSec = Math.floor(Date.now() / 1000)): Promise<LineIdentity> {
  if (!idToken || !channelId) throw new Error('LINE_NOT_CONFIGURED');
  const body = new URLSearchParams({ id_token: idToken, client_id: channelId }).toString();
  const res = await fetchFn(LINE_VERIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  let j: any = null;
  try { j = await res.json(); } catch { /* body ไม่ใช่ JSON */ }
  // เหตุผลจริงของ LINE (error_description ไม่มีข้อมูลลับ) ติดไปกับ message เพื่อใช้ดูใน log ฝั่งเซิร์ฟเวอร์เท่านั้น
  if (!res.ok) throw new Error(`LINE_TOKEN_INVALID: HTTP ${res.status} ${j?.error_description || j?.error || ''}`.trim());
  if (!j || typeof j.sub !== 'string' || !j.sub) throw new Error('LINE_TOKEN_INVALID: ไม่มี sub');
  if (String(j.aud) !== String(channelId)) throw new Error(`LINE_TOKEN_INVALID: aud ${j.aud} ไม่ตรงกับ channelId ที่ตั้งไว้`);
  if (typeof j.exp === 'number' && j.exp < nowSec) throw new Error('LINE_TOKEN_INVALID: token หมดอายุ');
  return { sub: j.sub, name: typeof j.name === 'string' ? j.name : '', picture: typeof j.picture === 'string' ? j.picture : undefined };
}

export interface AttemptState { failedCount: number; lockedUntilMs: number }

export function isLocked(state: AttemptState | null | undefined, nowMs: number): boolean {
  return !!state && state.lockedUntilMs > nowMs;
}

/** ผลหลังผิด 1 ครั้ง */
export function nextFailedState(state: AttemptState | null | undefined, nowMs: number): AttemptState {
  // ล็อกหมดอายุแล้วเริ่มนับใหม่
  const base = state && state.lockedUntilMs && state.lockedUntilMs <= nowMs ? 0 : (state?.failedCount ?? 0);
  const failedCount = base + 1;
  return failedCount >= MAX_FAILED_ATTEMPTS
    ? { failedCount: 0, lockedUntilMs: nowMs + LOCK_MINUTES * 60_000 }
    : { failedCount, lockedUntilMs: 0 };
}

/** อัตลักษณ์ Firebase ของผู้ปกครอง — 1 บัญชี LINE = 1 uid */
export const parentUidForLine = (sub: string) => `line_${sub}`;
export const PARENT_CLAIMS = { roles: ['PARENT'], primaryRole: 'PARENT' } as const;

/** ความสัมพันธ์ผู้ปกครอง (สำเนาของ src/lib/parentRelationship.ts) — เก็บที่ students.parentRelationship ให้ผู้ปกครองอ่านเอง */
export const PARENT_RELATIONSHIPS = ['บิดา', 'มารดา', 'ผู้ปกครอง'] as const;
/** ค่าที่รู้จักเท่านั้น; ไม่รู้จัก/ว่าง = null (ไม่เดา) */
export function normalizeRelationship(raw: unknown): string | null {
  const v = typeof raw === 'string' ? raw.trim() : '';
  return (PARENT_RELATIONSHIPS as readonly string[]).includes(v) ? v : null;
}

/**
 * ชื่อผู้ปกครองตามทะเบียน (คำนำหน้า+ชื่อ นามสกุล) — คัดลอกลง students.parentDisplayName ตอนเชื่อมบัญชี/นำเข้าซ้ำ
 * เพื่อให้ Navbar ของผู้ปกครองแสดงชื่อตามทะเบียนแทนชื่อโปรไฟล์ LINE (client อ่าน parent_verification_records ไม่ได้)
 * ไม่มีชื่อหรือไม่มีนามสกุล = null (ไม่เดา → client ใช้ชื่อจากบัญชี LINE ตามเดิม)
 * รูปแบบตรงกับ parentDisplayName() ใน src/lib/parentAdmin.ts (มี test เทียบ)
 */
export function registryParentName(prefix: unknown, firstName: unknown, lastName: unknown): string | null {
  const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const first = s(firstName);
  const last = s(lastName);
  if (!first || !last) return null;
  const full = `${s(prefix)}${first} ${last}`.trim();
  return full.length <= 160 ? full : null;
}

// ---------- แอดมิน: ตั้ง/เปลี่ยนผู้ปกครองรายบุคคล + ประวัติการแก้ไข ----------
export const PARENT_AUDIT_COLLECTION = 'parent_admin_audit';
export const AUDIT_REASON_MAX = 300;

export interface ParentSetInput {
  studentId: string; parentPrefix: string; parentFirstName: string; parentLastName: string;
  parentNationalId: string; parentMobile: string; relationship: string; reason: string;
}

/** ตรวจ/ปรับรูปข้อมูลที่แอดมินกรอก — ผิด = คืนข้อความภาษาไทยให้แสดงตรง ๆ (ไม่เดาค่าแทน) */
export function validateParentSet(raw: unknown): { ok: true; value: ParentSetInput } | { ok: false; message: string } {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const studentId = str(d.studentId);
  if (!studentId || studentId.includes('/')) return { ok: false, message: 'รหัสนักเรียนไม่ถูกต้อง' };
  const parentFirstName = str(d.parentFirstName);
  const parentLastName = str(d.parentLastName);
  if (!parentFirstName || !parentLastName) return { ok: false, message: 'กรุณากรอกชื่อและนามสกุลผู้ปกครอง' };
  if (parentFirstName.length > 80 || parentLastName.length > 80) return { ok: false, message: 'ชื่อหรือนามสกุลยาวเกินไป' };
  const parentPrefix = str(d.parentPrefix);
  if (parentPrefix.length > 20) return { ok: false, message: 'คำนำหน้ายาวเกินไป' };
  const relationship = normalizeRelationship(d.relationship);
  if (!relationship) return { ok: false, message: `ความสัมพันธ์ต้องเป็น ${PARENT_RELATIONSHIPS.join(' / ')} เท่านั้น` };
  const mobile = str(d.parentMobile).replace(/[\s-]/g, '');
  if (!/^0\d{8,9}$/.test(mobile)) return { ok: false, message: 'เบอร์โทรศัพท์ต้องเป็นตัวเลข 9-10 หลักขึ้นต้นด้วย 0' };
  if (!isValidThaiNationalId(d.parentNationalId)) return { ok: false, message: 'เลขบัตรประชาชนผู้ปกครองไม่ถูกต้อง' };
  const reason = str(d.reason);
  if (!reason) return { ok: false, message: 'กรุณาระบุเหตุผลในการเปลี่ยนแปลง' };
  if (reason.length > AUDIT_REASON_MAX) return { ok: false, message: `เหตุผลต้องไม่เกิน ${AUDIT_REASON_MAX} ตัวอักษร` };
  return { ok: true, value: { studentId, parentPrefix, parentFirstName, parentLastName, parentNationalId: normalizeNationalId(d.parentNationalId), parentMobile: mobile, relationship, reason } };
}

/** เหตุผลของการยกเลิกการเชื่อม (บังคับกรอก) */
export function validateUnlinkReason(raw: unknown): { ok: true; reason: string } | { ok: false; message: string } {
  const reason = typeof raw === 'string' ? raw.trim() : '';
  if (!reason) return { ok: false, message: 'กรุณาระบุเหตุผลในการยกเลิกการเชื่อมบัญชี' };
  if (reason.length > AUDIT_REASON_MAX) return { ok: false, message: `เหตุผลต้องไม่เกิน ${AUDIT_REASON_MAX} ตัวอักษร` };
  return { ok: true, reason };
}

export type ParentAuditAction = 'UNLINK' | 'SET_PARENT';

/** รายการประวัติ — ห้ามมีเลขบัตร/HMAC/เบอร์/ชื่อผู้ปกครอง/uid ของผู้ปกครอง (เก็บแค่ว่าใครทำอะไรกับนักเรียนคนไหน เพราะอะไร) */
export function buildParentAuditEntry(p: {
  action: ParentAuditAction; studentId: string; byUid: string; byEmail: string; reason: string;
  hadLink: boolean; parentChanged: boolean; relationship?: string | null;
}): Record<string, unknown> {
  return {
    action: p.action, studentId: p.studentId, byUid: p.byUid, byEmail: p.byEmail, reason: p.reason,
    hadLink: p.hadLink, parentChanged: p.parentChanged, relationship: p.relationship ?? null,
  };
}
