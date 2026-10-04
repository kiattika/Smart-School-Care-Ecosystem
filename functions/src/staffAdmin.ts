// ต้องเป็น v1 (รุ่นแรก ไม่ใช้ Cloud Run) ที่ region เริ่มต้น เหมือน assignUserRole — us-central1 เปิด Cloud Run
// ไม่ได้ (โควตา region เต็ม — ดู CLAUDE.md) ห้ามเปลี่ยนเป็น v2 onCall
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
// FieldValue ต้อง import จาก subpath นี้ — `admin.firestore.FieldValue` เป็น undefined ใน Functions emulator
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { FIRESTORE_DATABASE_ID } from './config';
import { isStaffInactive } from './access';
import { setActiveError } from './roleGuards';
import { validateNewStaff } from './staffValidation';
import { refreshGuidanceStatusSafely } from './guidanceStatus';

if (!admin.apps.length) {
  admin.initializeApp();
}

const auth = admin.auth();
// Named database เดียวกับ client — ไม่ใช่ (default) ดู functions/src/config.ts
const db = getFirestore(admin.app(), FIRESTORE_DATABASE_ID);

function requireSuperAdmin(context: functions.https.CallableContext): string {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'กรุณาเข้าสู่ระบบก่อน');
  }
  const callerRoles = (context.auth.token.roles as string[]) || [];
  if (!callerRoles.includes('SUPER_ADMIN')) {
    throw new functions.https.HttpsError('permission-denied', 'เฉพาะผู้ดูแลระบบ (SUPER_ADMIN) เท่านั้นที่ทำรายการนี้ได้');
  }
  return context.auth.uid;
}

async function findAuthUserByEmail(email: string): Promise<admin.auth.UserRecord | null> {
  if (!email) return null;
  try {
    return await auth.getUserByEmail(email);
  } catch (err: any) {
    if (err?.code === 'auth/user-not-found') return null;
    throw new functions.https.HttpsError('internal', err?.message || String(err));
  }
}

/**
 * เพิ่มบุคลากรรายบุคคล — เขียน staff/{staffId} + mirror teachers/{staffId} (field ชุดเดียวกับ bulk import TEACHER)
 * status 'ACTIVE'. ไม่สร้างบัญชี Auth — บุคลากร login ด้วย Google ของโรงเรียนแล้ว blocking function ออก claims ให้เอง
 */
export const createStaffMember = functions.https.onCall(async (data, context) => {
  const callerUid = requireSuperAdmin(context);

  const result = await validateNewStaff(data || {}, {
    async staffExists(staffId) {
      return (await db.collection('staff').doc(staffId).get()).exists;
    },
    async findStaffIdsByEmail(email) {
      const snap = await db.collection('staff').where('email', '==', email).limit(5).get();
      return snap.docs.map((d) => d.id);
    },
    async getStudentEmailFormat() {
      const snap = await db.collection('school_settings').doc('studentEmailFormat').get();
      return snap.exists ? snap.data() : null;
    },
    async findStudentIdsByEmail(email) {
      const snap = await db.collection('students').where('email', '==', email).limit(5).get();
      return snap.docs.map((d) => d.id);
    },
  });
  if (!result.ok) {
    throw new functions.https.HttpsError(result.code, result.message);
  }

  const s = result.value;
  const payload = {
    id: s.staffId,
    teacherId: s.staffId,
    prefix: s.prefix,
    firstName: s.firstName,
    lastName: s.lastName,
    fullName: `${s.prefix}${s.firstName} ${s.lastName}`.trim(),
    position: s.position,
    email: s.email,
    roles: s.roles,
    departmentId: s.departmentId,
    status: 'ACTIVE',
    createdBy: callerUid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  const batch = db.batch();
  // create() = ล้มทั้ง batch ถ้า staff/{staffId} มีอยู่แล้ว (กันสองคนสร้างรหัสเดียวกันพร้อมกัน)
  batch.create(db.collection('staff').doc(s.staffId), payload);
  batch.set(db.collection('teachers').doc(s.staffId), payload, { merge: true });
  try {
    await batch.commit();
  } catch (err: any) {
    if (err?.code === 6 || /ALREADY_EXISTS/i.test(String(err?.message))) {
      throw new functions.https.HttpsError('already-exists', `มีบุคลากรรหัส "${s.staffId}" อยู่แล้ว`);
    }
    throw new functions.https.HttpsError('internal', err?.message || String(err));
  }

  // สิทธิ์อ่าน 9Q/8Q ของครูที่ปรึกษาขึ้นกับ "มีครูแนะแนวที่ใช้งานอยู่ไหม" — คำนวณ school_settings/guidance_status ใหม่
  await refreshGuidanceStatusSafely();
  return { success: true, staffId: s.staffId, email: s.email, roles: s.roles };
});

/**
 * ปิด/เปิดการใช้งานบุคลากร — ไม่ลบ staff doc (บันทึกย้อนหลังยังอ้างถึง)
 * - ปิด: status 'INACTIVE' + deactivatedAt/By/Reason, ล้าง custom claims, revokeRefreshTokens
 *   (blocking function ปฏิเสธการ login ครั้งถัดไปด้วย STAFF_INACTIVE)
 * - เปิด: status 'ACTIVE' — claims จะถูกออกใหม่ตอน login ครั้งถัดไป
 */
export const setStaffActive = functions.https.onCall(async (data, context) => {
  const callerUid = requireSuperAdmin(context);

  const { staffId, active, reason } = data || {};
  if (typeof staffId !== 'string' || !staffId || staffId.includes('/') || typeof active !== 'boolean') {
    throw new functions.https.HttpsError('invalid-argument', 'ต้องระบุ staffId และ active (true/false)');
  }
  const reasonText = typeof reason === 'string' ? reason.trim() : '';
  if (!active && !reasonText) {
    throw new functions.https.HttpsError('invalid-argument', 'กรุณาระบุเหตุผลในการปิดการใช้งาน');
  }
  if (reasonText.length > 500) {
    throw new functions.https.HttpsError('invalid-argument', 'เหตุผลยาวได้ไม่เกิน 500 ตัวอักษร');
  }

  const staffRef = db.collection('staff').doc(staffId);
  const staffSnap = await staffRef.get();
  if (!staffSnap.exists) {
    throw new functions.https.HttpsError('not-found', `ไม่พบบุคลากรรหัส "${staffId}"`);
  }
  const email = String(staffSnap.get('email') || '').trim().toLowerCase();
  const rawRoles = staffSnap.get('roles');
  const targetRoles: string[] = Array.isArray(rawRoles) ? rawRoles.filter((r: unknown): r is string => typeof r === 'string') : [];
  const targetUser = await findAuthUserByEmail(email);

  const adminsSnap = await db.collection('staff').where('roles', 'array-contains', 'SUPER_ADMIN').get();
  const activeSuperAdminStaffIds = adminsSnap.docs
    .filter((d) => !isStaffInactive(d.get('status')) && d.id.toLowerCase() !== String(d.get('email') || '').toLowerCase())
    .map((d) => d.id);

  const guardError = setActiveError({
    callerUid,
    callerStaffId: context.auth!.token.staffId,
    targetStaffId: staffId,
    targetUid: targetUser?.uid ?? null,
    targetRoles,
    activeSuperAdminStaffIds,
    active,
  });
  if (guardError) {
    throw new functions.https.HttpsError('failed-precondition', guardError);
  }

  const fields: Record<string, unknown> = active
    ? {
        status: 'ACTIVE',
        reactivatedAt: FieldValue.serverTimestamp(),
        reactivatedBy: callerUid,
        deactivatedAt: FieldValue.delete(),
        deactivatedBy: FieldValue.delete(),
        deactivationReason: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      }
    : {
        status: 'INACTIVE',
        deactivatedAt: FieldValue.serverTimestamp(),
        deactivatedBy: callerUid,
        deactivationReason: reasonText,
        updatedAt: FieldValue.serverTimestamp(),
      };

  try {
    const batch = db.batch();
    batch.set(staffRef, fields, { merge: true });
    batch.set(db.collection('teachers').doc(staffId), fields, { merge: true });
    await batch.commit();

    if (!active && targetUser) {
      // ตัด session เดิม: ล้าง claims (rules ไม่ให้สิทธิ์อะไรอีก) + revoke refresh token
      // ID token ที่ออกไปแล้วยังใช้ได้จนหมดอายุ (≤ 1 ชม.) — ข้อจำกัดเดียวกับ assignUserRole
      await auth.setCustomUserClaims(targetUser.uid, null);
      await auth.revokeRefreshTokens(targetUser.uid);
    }
  } catch (err: any) {
    throw new functions.https.HttpsError('internal', err?.message || String(err));
  }

  await refreshGuidanceStatusSafely(); // ปิด/เปิดครูแนะแนวเปลี่ยนสิทธิ์ของครูที่ปรึกษา (ดู guidanceStatus.ts)
  return { success: true, staffId, active, targetUid: targetUser?.uid ?? null };
});
