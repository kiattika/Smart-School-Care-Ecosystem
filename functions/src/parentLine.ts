// ต้องเป็น v1 callable ที่ region เริ่มต้น (us-central1) เหมือน assignUserRole — ห้ามเปลี่ยนเป็น v2 (โควตา Cloud Run เต็ม ดู CLAUDE.md)
//
// ⚠️ blocking functions (beforeCreate/beforeSignIn) "ไม่ถูกเรียก" เมื่อ sign in ด้วย custom token ดังนั้น claims
// ของผู้ปกครองต้องออกจาก callable เหล่านี้เองเท่านั้น และทุกครั้งที่ sign in ซ้ำต้องตรวจ students.parentUid == uid ใหม่
//
// Secrets (ตั้งด้วย `firebase functions:secrets:set`): LINE_CHANNEL_ID, PARENT_ID_PEPPER
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { FIRESTORE_DATABASE_ID } from './config';
import {
  FetchLike, LineIdentity, PARENT_CLAIMS, hashesEqual, hmacNationalId, isLocked, isValidThaiNationalId,
  nextFailedState, normalizeNationalId, parentUidForLine, verifyLineIdToken,
} from './parentLineLogic';

if (!admin.apps.length) {
  admin.initializeApp();
}

const auth = admin.auth();
const db = getFirestore(admin.app(), FIRESTORE_DATABASE_ID);
const RUN_OPTS = { secrets: ['LINE_CHANNEL_ID', 'PARENT_ID_PEPPER'] };
const MAX_IMPORT_RECORDS = 400;
const BAD_MATCH_MESSAGE = 'ข้อมูลไม่ตรงกับที่โรงเรียนบันทึกไว้ กรุณาตรวจสอบรหัสนักเรียนและเลขบัตรประชาชนอีกครั้ง';

function requireSuperAdmin(context: functions.https.CallableContext): void {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'กรุณาเข้าสู่ระบบก่อน');
  const roles = (context.auth.token.roles as string[]) || [];
  if (!roles.includes('SUPER_ADMIN')) {
    throw new functions.https.HttpsError('permission-denied', 'เฉพาะผู้ดูแลระบบ (SUPER_ADMIN) เท่านั้นที่ทำรายการนี้ได้');
  }
}

function pepper(): string {
  const p = process.env.PARENT_ID_PEPPER || '';
  if (!p) throw new functions.https.HttpsError('failed-precondition', 'ระบบยังไม่ได้ตั้งค่า PARENT_ID_PEPPER');
  return p;
}

async function lineIdentity(idToken: unknown): Promise<LineIdentity> {
  // trim: secret ที่วางจากคลิปบอร์ดมักติดช่องว่าง/ขึ้นบรรทัดใหม่
  const channelId = (process.env.LINE_CHANNEL_ID || '').trim();
  if (!channelId) throw new functions.https.HttpsError('failed-precondition', 'ระบบยังไม่ได้ตั้งค่า LINE Login (LINE_CHANNEL_ID)');
  if (typeof idToken !== 'string' || !idToken) throw new functions.https.HttpsError('unauthenticated', 'ไม่พบ LINE ID token');
  try {
    return await verifyLineIdToken(idToken, channelId, fetch as unknown as FetchLike);
  } catch (err: any) {
    // บันทึกเหตุผลจริงลง log (ไม่บันทึก token) — ใช้ `firebase functions:log` ดู
    functions.logger.warn('LINE verify failed', { reason: err?.message || String(err), channelIdLength: channelId.length });
    throw new functions.https.HttpsError('unauthenticated', 'ยืนยันตัวตนกับ LINE ไม่สำเร็จ กรุณาเข้าสู่ระบบ LINE ใหม่');
  }
}

async function ensureAuthUser(uid: string, displayName: string): Promise<void> {
  try {
    await auth.getUser(uid);
  } catch (err: any) {
    if (err?.code !== 'auth/user-not-found') throw new functions.https.HttpsError('internal', err?.message || String(err));
    await auth.createUser({ uid, displayName: displayName || undefined });
  }
}

async function issueToken(uid: string, displayName: string): Promise<string> {
  await ensureAuthUser(uid, displayName);
  return auth.createCustomToken(uid, { ...PARENT_CLAIMS, roles: [...PARENT_CLAIMS.roles] });
}

/** SUPER_ADMIN — นำเข้าทะเบียนผู้ปกครอง: คำนวณ HMAC ฝั่งเซิร์ฟเวอร์ ไม่เก็บเลขบัตรดิบ */
export const importParentVerification = functions.runWith(RUN_OPTS).https.onCall(async (data, context) => {
  requireSuperAdmin(context);
  const records: any[] = Array.isArray(data?.records) ? data.records : [];
  if (records.length === 0) throw new functions.https.HttpsError('invalid-argument', 'ไม่มีรายการให้นำเข้า');
  if (records.length > MAX_IMPORT_RECORDS) {
    throw new functions.https.HttpsError('invalid-argument', `ส่งได้ครั้งละไม่เกิน ${MAX_IMPORT_RECORDS} รายการ`);
  }
  const key = pepper();
  const errors: { studentId: string; reason: string }[] = [];
  let written = 0;

  for (const r of records) {
    const studentId = String(r?.studentId ?? '').trim();
    if (!studentId || studentId.includes('/')) { errors.push({ studentId, reason: 'รหัสนักเรียนไม่ถูกต้อง' }); continue; }
    if (!isValidThaiNationalId(r?.parentNationalId)) { errors.push({ studentId, reason: 'เลขบัตรประชาชนไม่ถูกต้อง' }); continue; }
    const hmac = hmacNationalId(String(r.parentNationalId), key);
    const ref = db.collection('parent_verification_records').doc(`${studentId}_verify`);
    const existing = await ref.get();
    const prev = existing.exists ? existing.data() || {} : {};
    const sameParent = prev.parentNationalIdHmac === hmac;
    const payload: Record<string, unknown> = {
      id: `${studentId}_verify`,
      studentId,
      parentPrefix: String(r.parentPrefix ?? ''),
      parentFirstName: String(r.parentFirstName ?? ''),
      parentLastName: String(r.parentLastName ?? ''),
      parentNationalIdHmac: hmac,
      parentMobile: String(r.parentMobile ?? ''),
      relationship: String(r.relationship ?? ''),
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (!existing.exists) { payload.linkedParentUid = null; payload.linkedAt = null; payload.createdAt = FieldValue.serverTimestamp(); }
    if (existing.exists && !sameParent) {
      // เปลี่ยนผู้ปกครอง → ยกเลิกการเชื่อมเดิม (ทั้งทะเบียนและ students.parentUid)
      payload.linkedParentUid = null; payload.linkedAt = null;
      if (prev.linkedParentUid) {
        await db.collection('students').doc(studentId).set({ parentUid: null }, { merge: true });
      }
    }
    // ลบฟิลด์ hash แบบ SHA-256 เดิม (ถ้ามี) — เลิกใช้แล้ว
    payload.parentNationalIdHash = FieldValue.delete();
    await ref.set(payload, { merge: true });
    written++;
  }
  return { written, errors };
});

/** ผู้ปกครอง (ล็อกอิน LINE แล้ว) — เชื่อมบัญชี LINE กับนักเรียนด้วย studentId + เลขบัตรประชาชน */
export const linkParentLine = functions.runWith(RUN_OPTS).https.onCall(async (data) => {
  const line = await lineIdentity(data?.idToken);
  const studentId = String(data?.studentId ?? '').trim();
  const nationalId = normalizeNationalId(data?.nationalId);
  if (!studentId || studentId.includes('/') || !isValidThaiNationalId(nationalId)) {
    throw new functions.https.HttpsError('invalid-argument', 'กรุณากรอกรหัสนักเรียนและเลขบัตรประชาชน 13 หลักให้ถูกต้อง');
  }
  const uid = parentUidForLine(line.sub);
  const attemptsRef = db.collection('parent_link_attempts').doc(line.sub);
  const nowMs = Date.now();
  const attemptSnap = await attemptsRef.get();
  const state = attemptSnap.exists ? (attemptSnap.data() as { failedCount: number; lockedUntilMs: number }) : null;
  if (isLocked(state, nowMs)) {
    throw new functions.https.HttpsError('resource-exhausted', 'กรอกข้อมูลผิดหลายครั้ง ระบบล็อกชั่วคราว กรุณาลองใหม่ภายหลังหรือติดต่อโรงเรียน');
  }

  const recRef = db.collection('parent_verification_records').doc(`${studentId}_verify`);
  const rec = (await recRef.get()).data();
  const expected = typeof rec?.parentNationalIdHmac === 'string' ? rec.parentNationalIdHmac : '';
  if (!expected || !hashesEqual(expected, hmacNationalId(nationalId, pepper()))) {
    await attemptsRef.set({ ...nextFailedState(state, nowMs), updatedAt: FieldValue.serverTimestamp() });
    throw new functions.https.HttpsError('permission-denied', BAD_MATCH_MESSAGE);
  }
  if (rec?.linkedParentUid && rec.linkedParentUid !== uid) {
    throw new functions.https.HttpsError('failed-precondition', 'นักเรียนคนนี้ถูกเชื่อมกับบัญชี LINE อื่นแล้ว กรุณาติดต่อโรงเรียนเพื่อยกเลิกการเชื่อมเดิม');
  }
  const studentRef = db.collection('students').doc(studentId);
  if (!(await studentRef.get()).exists) {
    throw new functions.https.HttpsError('failed-precondition', 'ยังไม่พบข้อมูลนักเรียนในระบบ กรุณาติดต่อโรงเรียน');
  }

  const batch = db.batch();
  batch.set(recRef, { linkedParentUid: uid, linkedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  batch.set(studentRef, { parentUid: uid }, { merge: true });
  batch.delete(attemptsRef);
  await batch.commit();

  return { customToken: await issueToken(uid, line.name), studentId };
});

/** ผู้ปกครองที่เชื่อมแล้วกลับมาเข้าใหม่ — ตรวจทะเบียนจริงทุกครั้งก่อนออก token */
export const signInParentLine = functions.runWith(RUN_OPTS).https.onCall(async (data) => {
  const line = await lineIdentity(data?.idToken);
  const uid = parentUidForLine(line.sub);
  const linked = await db.collection('students').where('parentUid', '==', uid).limit(1).get();
  if (linked.empty) {
    throw new functions.https.HttpsError('failed-precondition', 'บัญชี LINE นี้ยังไม่ได้เชื่อมกับนักเรียน กรุณายืนยันตัวตนผู้ปกครองก่อน', 'NOT_LINKED');
  }
  return { customToken: await issueToken(uid, line.name) };
});

/** SUPER_ADMIN — ยกเลิกการเชื่อมบัญชี LINE ของนักเรียน (เช่น เปลี่ยนผู้ปกครอง/ลงผิดคน) */
export const unlinkParentLine = functions.https.onCall(async (data, context) => {
  requireSuperAdmin(context);
  const studentId = String(data?.studentId ?? '').trim();
  if (!studentId || studentId.includes('/')) throw new functions.https.HttpsError('invalid-argument', 'รหัสนักเรียนไม่ถูกต้อง');
  const studentRef = db.collection('students').doc(studentId);
  const recRef = db.collection('parent_verification_records').doc(`${studentId}_verify`);
  const [student, rec] = await Promise.all([studentRef.get(), recRef.get()]);
  const oldUid = (student.data()?.parentUid as string | null | undefined) || (rec.data()?.linkedParentUid as string | null | undefined) || null;

  const batch = db.batch();
  if (student.exists) batch.set(studentRef, { parentUid: null }, { merge: true });
  if (rec.exists) batch.set(recRef, { linkedParentUid: null, linkedAt: null, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await batch.commit();

  if (oldUid) {
    const remaining = await db.collection('students').where('parentUid', '==', oldUid).limit(1).get();
    if (remaining.empty) {
      try { await auth.revokeRefreshTokens(oldUid); } catch { /* บัญชีอาจไม่มีแล้ว — ข้อมูลถูกตัดสิทธิ์ที่ทะเบียนอยู่ดี */ }
    }
  }
  return { unlinked: !!oldUid };
});
