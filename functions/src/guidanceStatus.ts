// ต้องเป็น v1 (รุ่นแรก ไม่ใช้ Cloud Run) ที่ region เริ่มต้น เหมือน assignUserRole — ห้ามเปลี่ยนเป็น v2 onCall (โควตา region เต็ม)
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { FIRESTORE_DATABASE_ID } from './config';
import { activeGuidanceCounselors, GUIDANCE_ROLE } from './guidanceStatusLogic';
export { StaffForGuidanceStatus, GUIDANCE_ROLE, activeGuidanceCounselors, hasActiveGuidanceCounselor } from './guidanceStatusLogic';

/**
 * สถานะ "มีครูแนะแนวที่ใช้งานอยู่ในระบบหรือไม่" — school_settings/guidance_status { hasActiveCounselor, count }
 *
 * ทำไมต้องมี doc นี้: firestore.rules ค้นหา "มี staff คนใดที่ ACTIVE และเป็น GUIDANCE_COUNSELOR ไหม" ด้วย query ไม่ได้
 * (rules ทำได้แค่ get/exists ทีละเอกสาร) แต่สิทธิ์อ่านข้อมูล 9Q/8Q ของครูที่ปรึกษาขึ้นกับคำตอบนี้ — จึงคำนวณฝั่ง server แล้ว
 * cache เป็นเอกสารเดียว (client เขียนไม่ได้ — rules ปิด ต้องผ่าน Admin SDK เท่านั้น)
 *
 * ผู้เรียกใช้ (คำนวณใหม่ทุกครั้งที่ใครอาจเปลี่ยนสถานะ/บทบาท): assignUserRole, createStaffMember, setStaffActive,
 * และ callable refreshGuidanceStatus (SUPER_ADMIN — เรียกหลัง deploy ครั้งแรก/หลัง import บุคลากร)
 * ถ้า doc นี้ยังไม่มี rules ถือว่า "มีครูแนะแนว" (ปิดสิทธิ์ครูที่ปรึกษาไว้ก่อน — fail-closed) ไม่ใช่ "ไม่มี"
 */

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = getFirestore(admin.app(), FIRESTORE_DATABASE_ID);

/** คำนวณจาก staff จริงแล้วเขียน school_settings/guidance_status (Admin SDK — ข้าม rules) */
export async function recomputeGuidanceStatus(): Promise<{ hasActiveCounselor: boolean; count: number }> {
  const snap = await db.collection('staff').where('roles', 'array-contains', GUIDANCE_ROLE).get();
  const counselors = activeGuidanceCounselors(snap.docs.map((d) => ({ id: d.id, email: d.get('email'), roles: d.get('roles'), status: d.get('status') })));
  const result = { hasActiveCounselor: counselors.length > 0, count: counselors.length };
  await db.collection('school_settings').doc('guidance_status').set({ ...result, updatedAt: FieldValue.serverTimestamp() });
  return result;
}

/** เรียกต่อท้ายงานที่เปลี่ยนบทบาท/สถานะบุคลากร — ล้มเหลวไม่ทำให้งานหลักล้ม แต่ log ชัดเจน (สถานะจะค้างจนกว่าจะ refresh) */
export async function refreshGuidanceStatusSafely(): Promise<boolean> {
  try {
    await recomputeGuidanceStatus();
    return true;
  } catch (err) {
    console.error('[guidanceStatus] refresh failed — school_settings/guidance_status may be stale:', err);
    return false;
  }
}

/** SUPER_ADMIN: คำนวณ school_settings/guidance_status ใหม่ (หลัง deploy ครั้งแรก / หลัง import บุคลากรจำนวนมาก) */
export const refreshGuidanceStatus = functions.https.onCall(async (_data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'กรุณาเข้าสู่ระบบก่อน');
  const roles = (context.auth.token.roles as string[]) || [];
  if (!roles.includes('SUPER_ADMIN')) throw new functions.https.HttpsError('permission-denied', 'เฉพาะผู้ดูแลระบบ (SUPER_ADMIN) เท่านั้น');
  try {
    return { success: true, ...(await recomputeGuidanceStatus()) };
  } catch (err: any) {
    throw new functions.https.HttpsError('internal', err?.message || String(err));
  }
});
