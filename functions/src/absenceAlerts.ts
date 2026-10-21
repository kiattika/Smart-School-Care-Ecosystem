// ต้องเป็น v1 ที่ region เริ่มต้น เหมือนฟังก์ชันอื่นของโปรเจกต์ (ไม่ใช้ Cloud Run — ดู CLAUDE.md เรื่องโควตา)
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { FIRESTORE_DATABASE_ID } from './config';
import { absenceLevel, computeRoomStreaks, normalizeThresholds, type HomeroomDayLite } from './absenceStreakLogic';

/**
 * absence_alerts/{studentId} — นักเรียนที่ขาดเรียนต่อเนื่อง (จากเช็คโฮมรูมรายวัน) ถึงเกณฑ์ติดตามขึ้นไป
 * client เขียนไม่ได้ (rules write: false) — คำนวณโดยฟังก์ชันนี้เท่านั้น; ไม่ส่งข้อความหาใคร (ครูกดบันทึกผลติดตามเอง)
 * เกณฑ์อ่านจาก absence_settings/thresholds (งานกิจการนักเรียนปรับได้) — ไม่มี/ผิดรูปแบบ = ค่าเริ่มต้น 3/5/10 วัน
 */
if (!admin.apps.length) admin.initializeApp();
const db = getFirestore(admin.app(), FIRESTORE_DATABASE_ID);

/** ดูย้อนหลังกี่วันปฏิทิน (≥ เกณฑ์สูงสุด 60 วันทำการไม่จำเป็น: จำกัด 90 วัน) */
const LOOKBACK_DAYS = 90;

export async function rebuildAbsenceAlerts(): Promise<{ alerts: number; removed: number }> {
  const thresholds = normalizeThresholds((await db.collection('absence_settings').doc('thresholds').get()).data());
  const start = new Date(Date.now() + 7 * 3600 * 1000 - LOOKBACK_DAYS * 86_400_000).toISOString().slice(0, 10);

  const [recordsSnap, studentsSnap, existingSnap] = await Promise.all([
    db.collection('attendance_records').where('source', '==', 'HOMEROOM_DEFAULT').where('date', '>=', start).get(),
    db.collection('students').get(),
    db.collection('absence_alerts').get(),
  ]);

  // นักเรียนที่ยังศึกษาอยู่เท่านั้น (ไม่มี field status = ACTIVE ตามข้อมูลเดิม)
  const roomOf = new Map(studentsSnap.docs.map((d) => [d.id, typeof d.data().room === 'string' ? (d.data().room as string) : '']));
  const activeIds = new Set(studentsSnap.docs.filter((d) => (d.data().status ?? 'ACTIVE') !== 'INACTIVE' && d.data().status !== 'GRADUATED').map((d) => d.id));

  const byRoom = new Map<string, HomeroomDayLite[]>();
  for (const d of recordsSnap.docs) {
    const r = d.data();
    if (typeof r.date !== 'string' || typeof r.room !== 'string' || !r.students) continue;
    const arr = byRoom.get(r.room) || [];
    arr.push({ date: r.date, room: r.room, students: r.students });
    byRoom.set(r.room, arr);
  }

  const next = new Map<string, Record<string, unknown>>();
  for (const days of byRoom.values()) {
    for (const s of computeRoomStreaks(days)) {
      const level = absenceLevel(s.streakDays, thresholds);
      if (level === 0 || !activeIds.has(s.studentId)) continue;
      // ห้องใช้ค่าจากทะเบียนนักเรียน (students.room) — rules เทียบกับห้องที่ปรึกษา และตอนบันทึกผลติดตามต้องตรงทะเบียนเช่นกัน
      next.set(s.studentId, { studentId: s.studentId, room: roomOf.get(s.studentId) || s.room, streakDays: s.streakDays, level, sinceDate: s.sinceDate, lastCheckedDate: s.lastCheckedDate });
    }
  }

  let batch = db.batch();
  let n = 0;
  const flush = async () => { if (n > 0) { await batch.commit(); batch = db.batch(); n = 0; } };
  for (const [id, data] of next) {
    batch.set(db.collection('absence_alerts').doc(id), { ...data, computedAt: FieldValue.serverTimestamp() });
    if (++n >= 400) await flush();
  }
  let removed = 0;
  for (const d of existingSnap.docs) {
    if (!next.has(d.id)) { batch.delete(d.ref); removed++; if (++n >= 400) await flush(); }
  }
  await flush();
  return { alerts: next.size, removed };
}

/** วันทำการ 17:30 (เวลาไทย) — หลังครูเช็คโฮมรูมและแก้ย้อนหลังของวันนั้น */
export const scheduledAbsenceAlerts = functions.pubsub.schedule('30 17 * * 1-5').timeZone('Asia/Bangkok').onRun(async () => {
  await rebuildAbsenceAlerts();
});

/** งานกิจการนักเรียน/SUPER_ADMIN สั่งคำนวณทันที (เช่น หลังปรับเกณฑ์) */
export const refreshAbsenceAlerts = functions.https.onCall(async (_data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'กรุณาเข้าสู่ระบบก่อน');
  const roles = (context.auth.token.roles as string[]) || [];
  if (!roles.includes('SUPER_ADMIN') && !roles.includes('STUDENT_AFFAIRS')) {
    throw new functions.https.HttpsError('permission-denied', 'เฉพาะงานกิจการนักเรียนหรือผู้ดูแลระบบ');
  }
  try {
    return { success: true, ...(await rebuildAbsenceAlerts()) };
  } catch (err: any) {
    throw new functions.https.HttpsError('internal', err?.message || String(err));
  }
});
