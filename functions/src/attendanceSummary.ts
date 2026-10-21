// ต้องเป็น v1 ที่ region เริ่มต้น เหมือนฟังก์ชันอื่นของโปรเจกต์ (ไม่ใช้ Cloud Run — ดู CLAUDE.md เรื่องโควตา)
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { FIRESTORE_DATABASE_ID } from './config';
import { buildAttendanceSummary, type HomeroomDay } from './attendanceSummaryLogic';
import { semesterRange } from './publicSummaryLogic';

/** attendance_summary/current — ตัวเลขรวมการมาเรียนจากเช็คโฮมรูม (ผู้บริหารอ่านได้; client เขียนไม่ได้) */
if (!admin.apps.length) admin.initializeApp();
const db = getFirestore(admin.app(), FIRESTORE_DATABASE_ID);

function currentSemester(data: Record<string, any> | undefined): { academicYear: string; term: '1' | '2' } {
  if (data?.academicYear && (data?.semester === '1' || data?.semester === '2')) return { academicYear: String(data.academicYear), term: data.semester };
  const now = new Date(Date.now() + 7 * 3600 * 1000);
  const month = now.getUTCMonth() + 1;
  const term: '1' | '2' = month >= 5 && month <= 10 ? '1' : '2';
  const greg = month <= 4 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
  return { academicYear: String(greg + 543), term };
}

export async function rebuildAttendanceSummary(): Promise<{ written: boolean }> {
  const sem = currentSemester((await db.collection('school_settings').doc('academic_year').get()).data());
  const range = semesterRange(sem.academicYear, sem.term);
  const snap = await db.collection('attendance_records').where('source', '==', 'HOMEROOM_DEFAULT').where('date', '>=', range.from).get();
  const docs: HomeroomDay[] = snap.docs.map((d) => d.data() as HomeroomDay);
  const summary = buildAttendanceSummary(docs, sem);
  if (!summary) { await db.collection('attendance_summary').doc('current').delete().catch(() => undefined); return { written: false }; }
  await db.collection('attendance_summary').doc('current').set({ ...summary, updatedAt: FieldValue.serverTimestamp() });
  return { written: true };
}

/** วันทำการ 17:40 (เวลาไทย) — หลังคำนวณขาดเรียนต่อเนื่อง 17:30 */
export const scheduledAttendanceSummary = functions.pubsub.schedule('40 17 * * 1-5').timeZone('Asia/Bangkok').onRun(async () => {
  await rebuildAttendanceSummary();
});

const REFRESH_ROLES = ['SUPER_ADMIN', 'EXECUTIVE', 'DIRECTOR', 'DEPUTY_DIRECTOR_ACADEMIC', 'DEPUTY_DIRECTOR_BUDGET', 'DEPUTY_DIRECTOR_PERSONNEL', 'DEPUTY_DIRECTOR_GENERAL'];
export const refreshAttendanceSummary = functions.https.onCall(async (_data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'กรุณาเข้าสู่ระบบก่อน');
  const roles = (context.auth.token.roles as string[]) || [];
  if (!roles.some((r) => REFRESH_ROLES.includes(r))) throw new functions.https.HttpsError('permission-denied', 'เฉพาะผู้บริหารหรือผู้ดูแลระบบ');
  try {
    return { success: true, ...(await rebuildAttendanceSummary()) };
  } catch (err: any) {
    throw new functions.https.HttpsError('internal', err?.message || String(err));
  }
});
