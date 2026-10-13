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
  if (!res.ok) throw new Error('LINE_TOKEN_INVALID');
  const j = await res.json();
  if (!j || typeof j.sub !== 'string' || !j.sub) throw new Error('LINE_TOKEN_INVALID');
  if (String(j.aud) !== String(channelId)) throw new Error('LINE_TOKEN_INVALID');
  if (typeof j.exp === 'number' && j.exp < nowSec) throw new Error('LINE_TOKEN_INVALID');
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
