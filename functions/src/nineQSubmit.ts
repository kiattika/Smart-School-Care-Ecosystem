// ต้องเป็น v1 (รุ่นแรก ไม่ใช้ Cloud Run) ที่ region เริ่มต้น เหมือน assignUserRole — ห้ามเปลี่ยนเป็น v2 onCall (โควตา region เต็ม)
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { FIRESTORE_DATABASE_ID } from './config';
import {
  NineQBasis,
  bangkokDate,
  buildNineQDocs,
  decideNineQCaller,
  parseNineQRequest,
  pickNineQBasis,
  scoreNineQAnswers,
} from './nineQ';

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = getFirestore(admin.app(), FIRESTORE_DATABASE_ID);

/**
 * บันทึกผล 9Q — "ทางเดียว" ที่เขียน student_screenings_9q / _9q_detail / student_screening_progress ได้ (firestore.rules ปิดการเขียนจาก client)
 *
 * client ส่งแค่คำตอบดิบ 9 ข้อ + studentId — เซิร์ฟเวอร์:
 *  1. คำนวณ riskLevel / คะแนนรวม / ธงแดงข้อ 9 เอง (ไม่รับค่าที่ client คำนวณมา)
 *  2. ตรวจว่าผู้เรียกมีสิทธิ์: นักเรียนเจ้าของ (ต้องมีฐานที่ยังไม่เคยใช้ — 2Q ล่าสุดบวก หรือใบอนุญาตที่ครูเปิดให้) หรือครูแนะแนว/SUPER_ADMIN
 *     หรือครูที่ปรึกษาของห้อง (เฉพาะเมื่อไม่มีครูแนะแนวที่ใช้งานอยู่) กรอกแทนนักเรียน (นักเรียนบอกคำตอบปากเปล่า)
 *  3. เขียน 3 เอกสารใน transaction เดียว — ฐานหนึ่งใช้ได้ครั้งเดียว (กันส่งซ้ำพร้อมกัน)
 * ผลลัพธ์ที่คืน: นักเรียน = { success } เท่านั้น (ห้ามเห็นคะแนน/ระดับ/ธงแดง); ครู = { success, riskLevel, redFlagItem9, totalScore }
 */
export const submitNineQ = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'กรุณาเข้าสู่ระบบก่อน');
  }
  const uid = context.auth.uid;
  const token = context.auth.token as Record<string, unknown>;
  const roles: string[] = Array.isArray(token.roles) ? (token.roles as unknown[]).filter((r): r is string => typeof r === 'string') : [];

  const parsed = parseNineQRequest(data);
  if (!parsed.ok) {
    throw new functions.https.HttpsError('invalid-argument', parsed.message);
  }
  const { studentId, answers } = parsed.value;
  const score = scoreNineQAnswers(answers);
  if (!score) throw new functions.https.HttpsError('invalid-argument', 'คำตอบไม่ถูกต้อง');

  const studentSnap = await db.collection('students').doc(studentId).get();
  if (!studentSnap.exists) {
    // ข้อความกลางๆ — ไม่บอกว่าคนนี้มีนักเรียนหรือไม่
    throw new functions.https.HttpsError('permission-denied', 'ไม่สามารถบันทึกแบบประเมินได้');
  }
  const studentUid = typeof studentSnap.get('studentUid') === 'string' ? (studentSnap.get('studentUid') as string) : null;
  const studentRoom = typeof studentSnap.get('room') === 'string' ? (studentSnap.get('room') as string) : null;

  // ข้อมูลที่ใช้ตัดสินสิทธิ์ครูที่ปรึกษา: ห้องที่ดูแล (staff/{staffId claim}) + มีครูแนะแนวที่ใช้งานอยู่ไหม (fail-closed: ไม่มี doc = มี)
  let callerHomeroomClass: string | null = null;
  if (roles.includes('HOMEROOM_TEACHER') && typeof token.staffId === 'string' && token.staffId) {
    const staffSnap = await db.collection('staff').doc(token.staffId).get();
    const hc = staffSnap.exists ? staffSnap.get('assignments.homeroomClass') : null;
    callerHomeroomClass = typeof hc === 'string' && hc ? hc : null;
  }
  const statusSnap = await db.collection('school_settings').doc('guidance_status').get();
  const hasActiveCounselor = !statusSnap.exists || statusSnap.get('hasActiveCounselor') !== false;

  const caller = decideNineQCaller({ uid, roles, studentUid, studentRoom, callerHomeroomClass, hasActiveCounselor });
  if (!caller) {
    throw new functions.https.HttpsError('permission-denied', 'ไม่สามารถบันทึกแบบประเมินได้');
  }

  const now = new Date();
  const id = `9q-${now.getTime()}`;
  const conductedAt = bangkokDate(now);
  const summaryRef = db.collection('student_screenings_9q').doc(studentId);
  const detailRef = db.collection('student_screenings_9q_detail').doc(studentId);
  const progressRef = db.collection('student_screening_progress').doc(studentId);

  try {
    await db.runTransaction(async (tx) => {
      let basis: NineQBasis | { kind: 'STAFF'; id: string };
      let usedBasisIds: string[] = [];

      if (caller.kind === 'STUDENT') {
        const [progressSnap, twoQSnap, grantsSnap] = await Promise.all([
          tx.get(progressRef),
          tx.get(db.collection('student_screenings_2q').doc(studentId)),
          tx.get(progressRef.collection('grants')),
        ]);
        const used = progressSnap.exists ? progressSnap.get('usedBasisIds') : [];
        usedBasisIds = Array.isArray(used) ? used.filter((x: unknown): x is string => typeof x === 'string') : [];
        const picked = pickNineQBasis({
          twoQ: twoQSnap.exists ? { id: twoQSnap.get('id'), isPositive: twoQSnap.get('isPositive') } : null,
          grantIds: grantsSnap.docs.map((g) => g.id),
          usedBasisIds,
        });
        if (!picked) {
          // ไม่มีฐาน = แบบประเมินนี้ยังไม่เปิดให้นักเรียนคนนี้ — ข้อความกลางๆ ไม่บอกเงื่อนไข/ผลคัดกรอง
          throw new functions.https.HttpsError('failed-precondition', 'ไม่สามารถบันทึกแบบประเมินได้ในขณะนี้');
        }
        basis = picked;
      } else {
        basis = { kind: 'STAFF', id: `staff-${now.getTime()}` };
      }

      const docs = buildNineQDocs({
        studentId,
        studentUid: studentUid ?? '',
        recordedByUid: uid,
        score,
        basisKind: basis.kind,
        basisId: basis.id,
        respondentKind: caller.kind === 'STUDENT' ? 'STUDENT' : 'STAFF',
        conductedAt,
        id,
      });
      tx.set(summaryRef, { ...docs.summary, updatedAt: FieldValue.serverTimestamp() });
      tx.set(detailRef, { ...docs.detail, updatedAt: FieldValue.serverTimestamp() });
      if (caller.kind === 'STUDENT') {
        tx.set(progressRef, {
          studentId,
          studentUid: studentUid ?? '',
          usedBasisIds: [...usedBasisIds, basis.id],
          lastBasisKind: basis.kind,
          lastBasisId: basis.id,
          lastNineQAt: conductedAt,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    });
  } catch (err) {
    if (err instanceof functions.https.HttpsError) throw err;
    console.error('[submitNineQ] transaction failed:', err);
    throw new functions.https.HttpsError('internal', 'บันทึกแบบประเมินไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
  }

  if (caller.kind === 'STUDENT') return { success: true };
  return { success: true, riskLevel: score.riskLevel, redFlagItem9: score.redFlagItem9, totalScore: score.totalScore };
});
