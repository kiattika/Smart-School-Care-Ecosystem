import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
// FieldValue ต้อง import จาก subpath นี้ — `admin.firestore.FieldValue` เป็น undefined ใน Functions emulator
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { FIRESTORE_DATABASE_ID } from './config';

if (!admin.apps.length) {
  admin.initializeApp();
}

const auth = admin.auth();
// Named database เดียวกับ client — ไม่ใช่ (default) ดู functions/src/config.ts
const db = getFirestore(admin.app(), FIRESTORE_DATABASE_ID);

// การกำหนด claims ตอนสร้างบัญชี/login อยู่ที่ blocking functions (authBlocking.ts) แล้ว
// — onUserCreated (v1) เดิมถูกลบ เพราะให้ default role กับทุกอีเมลที่ไม่เจอในทะเบียน

/**
 * Callable HTTPS Cloud Function to assign roles directly by an authorized Super Admin.
 *
 * จุดเดียวที่เปลี่ยนบทบาทได้: เขียนทั้ง staff.roles (+ mirror teachers.roles) และ custom claims
 * client ห้ามเขียน staff.roles เอง — เรียก function นี้อย่างเดียว (ดู StaffRoleManagementPage)
 *
 * รับ `staffId` = document id ของ staff (teacherId จากไฟล์ import — ไม่ใช่ Auth UID)
 * บัญชี Auth ของบุคลากรหาจาก staff.email; ถ้ายังไม่เคย login (ไม่มีบัญชี) อัปเดตแค่ staff.roles
 * แล้ว beforeUserSignedIn จะออก claims ให้ตอน login ครั้งแรกเอง
 */
export const assignUserRole = functions.https.onCall(async (data, context) => {
  // 1. Verify caller is authenticated and has SUPER_ADMIN role
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const callerRoles = (context.auth.token.roles as string[]) || [];
  if (!callerRoles.includes('SUPER_ADMIN')) {
    throw new functions.https.HttpsError('permission-denied', 'Only SUPER_ADMIN can assign user roles.');
  }

  const { staffId, roles } = data || {};
  if (typeof staffId !== 'string' || !staffId || staffId.includes('/') || !Array.isArray(roles) ||
      !roles.every((r: unknown) => typeof r === 'string' && /^[A-Z_]+$/.test(r))) {
    throw new functions.https.HttpsError('invalid-argument', 'staffId and an array of role strings are required.');
  }

  // 2. staff/{staffId} ต้องมีอยู่จริง — ตรวจก่อนเขียนอะไรทั้งสิ้น จะได้ไม่เหลือสถานะครึ่งๆ กลางๆ
  const staffRef = db.collection('staff').doc(staffId);
  const staffSnap = await staffRef.get();
  if (!staffSnap.exists) {
    throw new functions.https.HttpsError('not-found', `No staff record "${staffId}".`);
  }
  const email = String(staffSnap.get('email') || '').trim().toLowerCase();

  let targetUser: admin.auth.UserRecord | null = null;
  if (email) {
    try {
      targetUser = await auth.getUserByEmail(email);
    } catch (err: any) {
      if (err?.code !== 'auth/user-not-found') {
        throw new functions.https.HttpsError('internal', err?.message || String(err));
      }
    }
  }

  try {
    // 3. staff.roles (+ mirror teachers) ใน named database — แหล่งความจริงที่ blocking function อ่านตอน login
    const roleFields = {
      roles,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: context.auth.uid,
    };
    const batch = db.batch();
    batch.set(staffRef, roleFields, { merge: true });
    batch.set(db.collection('teachers').doc(staffId), roleFields, { merge: true });
    await batch.commit();

    if (targetUser) {
      // 4. Custom claims ให้ตรงทันที (ไม่ต้องรอ login ใหม่) — โครงสร้างเดียวกับที่ blocking function ออก
      //    roles ว่าง = ถอนสิทธิ์: ไม่ใส่ primaryRole (hasRole() ใน rules เช็ค primaryRole ด้วย)
      const claims: Record<string, unknown> = { roles, staffId };
      if (roles.length > 0) claims.primaryRole = roles[0];
      await auth.setCustomUserClaims(targetUser.uid, claims);

      // 5. Revoke refresh tokens: session เดิมของ target จะรีเฟรช token ไม่ได้ และหลุดเมื่อ reload หน้า
      //    ⚠️ ข้อจำกัดที่ยอมรับแล้ว (accepted, ไม่แก้): ID token ที่ออกไปแล้วยังใช้ได้จนหมดอายุ (≤ 1 ชม.)
      //    และ Firestore rules ไม่ตรวจการ revoke — ผู้ใช้ที่ถูก "ลด" สิทธิ์จึงยังใช้สิทธิ์เดิมได้สูงสุด ~1 ชม.
      //    ถ้า tab ยังเปิดค้างไว้โดยไม่ reload. ตั้งใจไม่ปิดช่องนี้ด้วยการเช็ค staff doc ใน rules ทุก request
      //    (ต้นทุน get() ทุก read/write ของทั้งระบบ)
      await auth.revokeRefreshTokens(targetUser.uid);
    }

    return { success: true, staffId, roles, targetUid: targetUser?.uid ?? null };
  } catch (error: any) {
    throw new functions.https.HttpsError('internal', error.message);
  }
});
