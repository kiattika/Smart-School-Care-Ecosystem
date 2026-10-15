// ต้องเป็น v1 ที่ region เริ่มต้น เหมือนฟังก์ชันอื่นของโปรเจกต์ (โควตา region เต็ม — ห้ามใช้ v2)
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { FIRESTORE_DATABASE_ID } from './config';
import {
  PublicSummary, activeTeacherCount, guidanceSection, infirmarySection, maskCell, semesterRange,
  studentsSection, supervisionSection, teachingSection, sdqSection,
} from './publicSummaryLogic';

/**
 * public_summary/current — สรุปตัวเลขรวมของโรงเรียนสำหรับหน้า /info (เปิดสาธารณะ ไม่ต้องล็อกอิน)
 * หน้าเว็บอ่านเอกสารนี้เอกสารเดียว ไม่ query ข้อมูลรายบุคคลเลย; client เขียนไม่ได้ (rules) — เขียนด้วย Admin SDK เท่านั้น
 * ทุกช่องที่นับได้ 1–4 ถูกซ่อน (publicSummaryLogic.ts)
 */
if (!admin.apps.length) admin.initializeApp();
const db = getFirestore(admin.app(), FIRESTORE_DATABASE_ID);

function currentSemester(data: Record<string, any> | undefined): { academicYear: string; term: '1' | '2' } {
  if (data?.academicYear && (data?.semester === '1' || data?.semester === '2')) {
    return { academicYear: String(data.academicYear), term: data.semester };
  }
  const now = new Date(Date.now() + 7 * 3600 * 1000); // เวลาไทย
  const month = now.getUTCMonth() + 1;
  const term: '1' | '2' = month >= 5 && month <= 10 ? '1' : '2';
  const greg = month <= 4 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
  return { academicYear: String(greg + 543), term };
}

export async function rebuildPublicSummary(): Promise<void> {
  const sem = currentSemester((await db.collection('school_settings').doc('academic_year').get()).data());
  const range = semesterRange(sem.academicYear, sem.term);
  const get = async (col: string) => (await db.collection(col).get()).docs.map((d) => ({ id: d.id, ...d.data() }) as any);

  const [students, staff, visits, cases, subs, rounds, sdq] = await Promise.all([
    get('students'), get('staff'), get('infirmary_visits'), get('guidance_counseling_cases'), get('substitute_assignments'), get('supervision_rounds'),
    get('student_assessments_sdq'),
  ]);

  // รอบนิเทศล่าสุด (id = ปี_ภาค เรียงตามสตริงได้)
  const latest = rounds.map((r) => r.id).sort().pop();
  let supervision: PublicSummary['supervision'] = null;
  if (latest) {
    const obs = (await db.collection('supervision_observations').where('roundId', '==', latest).get()).docs.map((d) => d.data());
    const [y, t] = latest.split('_');
    supervision = { roundLabel: `ภาคเรียน ${t}/${y}`, ...supervisionSection(obs) };
  }

  const summary: PublicSummary = {
    schemaVersion: 1,
    academicYear: sem.academicYear,
    term: sem.term,
    students: studentsSection(students),
    staff: { teachers: maskCell(activeTeacherCount(staff)) },
    infirmary: infirmarySection(visits, range),
    guidance: guidanceSection(cases, range),
    supervision,
    teaching: teachingSection(subs, range),
    sdq: sdqSection(sdq, sem.academicYear),
  };
  await db.collection('public_summary').doc('current').set({ ...summary, updatedAt: FieldValue.serverTimestamp() });
}

/** ทุกวัน 03:00 (เวลาไทย) */
export const scheduledPublicSummary = functions.pubsub.schedule('0 3 * * *').timeZone('Asia/Bangkok').onRun(async () => {
  await rebuildPublicSummary();
});

/** SUPER_ADMIN สั่งคำนวณทันที (หลัง deploy ครั้งแรก หรือเมื่อต้องการข้อมูลล่าสุด) */
export const refreshPublicSummary = functions.https.onCall(async (_data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'กรุณาเข้าสู่ระบบก่อน');
  const roles = (context.auth.token.roles as string[]) || [];
  if (!roles.includes('SUPER_ADMIN')) throw new functions.https.HttpsError('permission-denied', 'เฉพาะผู้ดูแลระบบ (SUPER_ADMIN) เท่านั้น');
  try {
    await rebuildPublicSummary();
    return { success: true };
  } catch (err: any) {
    throw new functions.https.HttpsError('internal', err?.message || String(err));
  }
});
