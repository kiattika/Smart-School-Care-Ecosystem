/**
 * แปลง error จากการเข้าสู่ระบบเป็นข้อความภาษาไทยที่ผู้ใช้อ่านเข้าใจ
 *
 * การปฏิเสธจริงเกิดที่ฝั่งเซิร์ฟเวอร์ (blocking functions beforeUserCreated/beforeUserSignedIn
 * ใน functions/src/authBlocking.ts) — Firebase Auth SDK ห่อข้อความของ HttpsError ไว้ใน
 * error `auth/internal-error` รูปแบบประมาณ
 *   Firebase: ... BLOCKING_FUNCTION_ERROR_RESPONSE ... {"error":{"message":"<ข้อความไทย>","status":"PERMISSION_DENIED"}} ...
 * จึงต้องแกะ "message" ข้างในออกมาแสดง แทนที่จะโชว์ JSON ดิบ
 */

export const AUTH_NO_ROLE = 'AUTH_NO_ROLE';
export const AUTH_NO_PROFILE = 'AUTH_NO_PROFILE';

const NO_ROLE_MESSAGE = 'บัญชีนี้ยังไม่ได้รับสิทธิ์เข้าใช้งานระบบ กรุณาติดต่อผู้ดูแลระบบ';

/** ดึงข้อความที่ blocking function ส่งกลับมา (ถ้ามี) — คืน null ถ้าไม่ใช่ error จาก blocking function */
export function extractBlockingFunctionMessage(err: unknown): string | null {
  const e = err as { message?: unknown; customData?: { _serverResponse?: unknown } } | null;
  const candidates: string[] = [];
  if (typeof e?.message === 'string') candidates.push(e.message);
  if (e?.customData?._serverResponse !== undefined) {
    try { candidates.push(JSON.stringify(e.customData._serverResponse)); } catch { /* ignore */ }
  }

  for (const text of candidates) {
    if (!/BLOCKING_FUNCTION|PERMISSION_DENIED|UNAVAILABLE/.test(text)) continue;
    // "message":"..." ที่ escape ซ้อนกี่ชั้นก็ได้ — คลายทีละชั้นจนได้ข้อความจริง
    const m = text.match(/\\*"message\\*"\s*:\s*\\*"((?:[^"\\]|\\.)*?)\\*"/);
    if (!m) continue;
    let msg = m[1];
    for (let i = 0; i < 3 && /\\/.test(msg); i++) {
      try { msg = JSON.parse(`"${msg}"`); } catch { break; }
    }
    msg = msg.trim();
    if (msg) return msg;
  }
  return null;
}

export function describeAuthError(err: unknown): string {
  const e = err as { code?: unknown; message?: unknown } | null;
  const code = typeof e?.code === 'string' ? e.code : '';
  const message = typeof e?.message === 'string' ? e.message : '';

  if (message.includes(AUTH_NO_ROLE)) return NO_ROLE_MESSAGE;
  if (message.includes(AUTH_NO_PROFILE)) {
    return 'ไม่พบข้อมูลบุคลากรของบัญชีนี้ในทะเบียน (staff) จึงเข้าใช้งานไม่ได้ กรุณาติดต่อผู้ดูแลระบบ';
  }

  const blocked = extractBlockingFunctionMessage(err);
  if (blocked) return blocked;

  switch (code) {
    case 'auth/unauthorized-domain':
      return 'โดเมนนี้ยังไม่ได้รับอนุญาตใน Firebase Console (Authorized Domains)';
    case 'auth/popup-blocked':
      return 'เบราว์เซอร์บล็อกหน้าต่างป๊อปอัป กรุณาอนุญาตป๊อปอัปเพื่อเข้าสู่ระบบ';
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
    case 'auth/user-disabled':
      return 'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ';
    case 'auth/network-request-failed':
      return 'เชื่อมต่อเซิร์ฟเวอร์ยืนยันตัวตนไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ต (หรือ Auth/Functions Emulator ในเครื่อง) แล้วลองใหม่';
    case 'auth/too-many-requests':
      return 'พยายามเข้าสู่ระบบหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่';
  }
  return message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ กรุณาลองใหม่อีกครั้ง';
}
