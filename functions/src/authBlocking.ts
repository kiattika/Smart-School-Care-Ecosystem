import * as admin from 'firebase-admin';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import {
  beforeUserCreated,
  beforeUserSignedIn,
  HttpsError,
  AuthBlockingEvent,
} from 'firebase-functions/v2/identity';
import { FIRESTORE_DATABASE_ID } from './config';
import { AccessLookups, DENY_MESSAGES, resolveAccess } from './access';

/** customClaims ที่ blocking function ออกให้ (BeforeCreateResponse ไม่ได้ export จาก v2/identity) */
type BlockingResponse = { customClaims: Record<string, unknown> };

if (!admin.apps.length) {
  admin.initializeApp();
}

// Named database เดียวกับ client — ไม่ใช่ (default) ดู functions/src/config.ts
const db = getFirestore(admin.app(), FIRESTORE_DATABASE_ID);

// region: asia-southeast1 (ไม่ใช่ us-central1 แบบ assignUserRole) — blocking functions เป็นรุ่นที่ 2
// ซึ่งรันบน Cloud Run และโควตา Cloud Run "Number of regions" ของโปรเจกต์เต็ม 3/3 แล้ว: deploy ไป us-central1
// ล้มด้วย ProjectInitFailedQuotaExceeded ส่วน asia-southeast1 โปรเจกต์ใช้ Cloud Run อยู่แล้ว (ไม่กินโควตาเพิ่ม)
// ห้ามย้ายกลับ us-central1 จนกว่าจะขอเพิ่มโควตา. assignUserRole (รุ่นแรก ไม่ใช้ Cloud Run) คงอยู่ us-central1
// และ client เรียกที่ region นั้นตามเดิม — blocking functions ถูกเรียกโดย Firebase Auth เอง client ไม่ได้เรียกตรง
// blocking function ต้องตอบภายใน 7 วินาที — lookup ทำทีละขั้นเท่าที่จำเป็น (limit เล็ก) ไม่มีงานหนัก
const BLOCKING_OPTS = { region: 'asia-southeast1', timeoutSeconds: 7 } as const;

const lookups: AccessLookups = {
  async findStaffByEmail(email) {
    const snap = await db.collection('staff').where('email', '==', email).limit(5).get();
    return snap.docs.map((d) => ({ id: d.id, roles: d.get('roles') }));
  },
  async findStudentsByEmail(email) {
    const snap = await db.collection('students').where('email', '==', email).limit(5).get();
    return snap.docs.map((d) => ({ id: d.id, studentUid: d.get('studentUid') }));
  },
  async getStudentById(studentId) {
    const snap = await db.collection('students').doc(studentId).get();
    return snap.exists ? { id: snap.id, studentUid: snap.get('studentUid') } : null;
  },
};

async function grantAccess(event: AuthBlockingEvent): Promise<BlockingResponse> {
  const { uid, email, emailVerified } = event.data;

  let decision;
  try {
    decision = await resolveAccess({ email, emailVerified }, lookups);
  } catch (err) {
    // fail closed — ตรวจสิทธิ์ไม่ได้ = ไม่ให้เข้า
    console.error(`[authBlocking] access lookup failed for ${email} (${uid}):`, err);
    throw new HttpsError('unavailable', 'ระบบตรวจสอบสิทธิ์ขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง หากยังไม่ได้ กรุณาติดต่อผู้ดูแลระบบ');
  }

  if (!decision.allowed) {
    console.warn(`[authBlocking] ${event.eventType} denied ${email ?? '(no email)'} (${uid}): ${decision.reason}`);
    throw new HttpsError('permission-denied', DENY_MESSAGES[decision.reason]);
  }

  if (decision.kind === 'staff') {
    return { customClaims: { roles: decision.roles, primaryRole: decision.primaryRole, staffId: decision.staffId } };
  }

  // นักเรียน: ผูก students/{studentId}.studentUid กับบัญชีนี้ (rules isSelfStudent ใช้ field นี้)
  // เขียนเฉพาะเมื่อค่าเปลี่ยน — ทุกการ login ไม่ต้องเสีย write
  if (decision.studentUid !== uid) {
    if (decision.studentUid) {
      console.warn(`[authBlocking] students/${decision.studentId}.studentUid ${decision.studentUid} → ${uid} (${email})`);
    }
    await db.collection('students').doc(decision.studentId).set(
      { studentUid: uid, studentUidLinkedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
  }
  return { customClaims: { roles: decision.roles, primaryRole: decision.primaryRole, studentId: decision.studentId } };
}

/** แทน onUserCreated (v1 trigger เดิมที่ให้ default role ทุกคน) — ปฏิเสธตั้งแต่ยังไม่สร้างบัญชี */
export const beforeCreate = beforeUserCreated(BLOCKING_OPTS, grantAccess);

/** ตรวจซ้ำทุกการ login — roles ใน claims จึงตาม staff.roles ปัจจุบันเสมอ และตัดสิทธิ์คนที่ถูกลบออกจากทะเบียน */
export const beforeSignIn = beforeUserSignedIn(BLOCKING_OPTS, grantAccess);
