import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

/** LIFF ID ของแอป LINE (ตั้งใน .env / build env) — ว่าง = ยังไม่ได้ตั้งค่า LINE */
export const LIFF_ID: string = (import.meta.env.VITE_LINE_LIFF_ID as string | undefined) || '';
export const isLineConfigured = () => LIFF_ID.length > 0;

const PENDING_KEY = 'ssc_line_login_pending';
export function markLinePending(on: boolean) {
  try { on ? sessionStorage.setItem(PENDING_KEY, '1') : sessionStorage.removeItem(PENDING_KEY); } catch { /* ignore */ }
}
export function isLinePending(): boolean {
  try { return sessionStorage.getItem(PENDING_KEY) === '1'; } catch { return false; }
}

/**
 * เริ่ม LIFF: ยังไม่ล็อกอิน LINE → redirect ไปล็อกอิน (หน้ากลับมาแล้วเรียกซ้ำเพื่อได้ ID token)
 * คืน null เมื่อกำลัง redirect
 */
export async function getLineIdToken(): Promise<string | null> {
  if (!isLineConfigured()) throw new Error('LINE_NOT_CONFIGURED');
  const { default: liff } = await import('@line/liff');
  await liff.init({ liffId: LIFF_ID });
  if (!liff.isLoggedIn()) {
    markLinePending(true);
    liff.login({ redirectUri: window.location.href });
    return null;
  }
  const token = liff.getIDToken();
  if (!token) throw new Error('LINE_NO_ID_TOKEN');
  return token;
}

export type ParentSignInResult = { customToken: string } | { notLinked: true };

/** ผู้ปกครองที่เชื่อมแล้ว → ได้ customToken; ยังไม่เชื่อม → notLinked (ให้แสดงฟอร์มยืนยันตัวตน) */
export async function requestParentSignIn(idToken: string): Promise<ParentSignInResult> {
  try {
    const res = await httpsCallable<{ idToken: string }, { customToken: string }>(functions, 'signInParentLine')({ idToken });
    return { customToken: res.data.customToken };
  } catch (err: any) {
    if (err?.details === 'NOT_LINKED') return { notLinked: true };
    throw err;
  }
}

export async function requestParentLink(idToken: string, studentId: string, nationalId: string): Promise<string> {
  const res = await httpsCallable<{ idToken: string; studentId: string; nationalId: string }, { customToken: string }>(
    functions, 'linkParentLine')({ idToken, studentId, nationalId });
  return res.data.customToken;
}

/** SUPER_ADMIN — นำเข้าทะเบียนผู้ปกครอง (เซิร์ฟเวอร์คำนวณ HMAC) */
export interface ParentImportRecord {
  studentId: string; parentPrefix: string; parentFirstName: string; parentLastName: string;
  parentNationalId: string; parentMobile: string; relationship: string;
}
export async function importParentRecords(records: ParentImportRecord[]): Promise<{ written: number; errors: { studentId: string; reason: string }[] }> {
  const call = httpsCallable<{ records: ParentImportRecord[] }, { written: number; errors: { studentId: string; reason: string }[] }>(functions, 'importParentVerification');
  let written = 0;
  const errors: { studentId: string; reason: string }[] = [];
  for (let i = 0; i < records.length; i += 200) {
    const res = await call({ records: records.slice(i, i + 200) });
    written += res.data.written;
    errors.push(...res.data.errors);
  }
  return { written, errors };
}

export async function unlinkParent(studentId: string): Promise<boolean> {
  const res = await httpsCallable<{ studentId: string }, { unlinked: boolean }>(functions, 'unlinkParentLine')({ studentId });
  return res.data.unlinked;
}
