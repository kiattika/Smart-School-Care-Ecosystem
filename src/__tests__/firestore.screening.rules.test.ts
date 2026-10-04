import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as path from 'path';
import { initializeTestEnvironment, RulesTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { readSource } from './helpers/readSource';
import { screeningCapabilities } from '../lib/depressionScreening';

/**
 * firestore.rules — คัดกรองซึมเศร้า/ฆ่าตัวตาย 2Q → 9Q → 8Q (ต้องรันบน Firestore Emulator จริง: npm run emulators:exec)
 * ครอบคลุมสิทธิ์ทุกบทบาท × (มี / ไม่มี / ไม่รู้สถานะ) ครูแนะแนวที่ใช้งานอยู่ + เงื่อนไขลำดับ 2Q → 9Q → 8Q ที่ rules บังคับจริง
 * ตารางสิทธิ์ที่ใช้เทียบอยู่ที่ screeningCapabilities() (src/lib/depressionScreening.ts) — ตัวเดียวกับที่ UI ใช้ซ่อน/แสดงปุ่ม
 */

const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST;
const [EMU_HOST, EMU_PORT] = (EMULATOR_HOST || ':').split(':');
let testEnv: RulesTestEnvironment;

describe.runIf(!EMULATOR_HOST)('Screening rules (skipped)', () => {
  it.skip('ไม่มี FIRESTORE_EMULATOR_HOST — รันผ่าน npm run emulators:exec', () => {});
});

beforeAll(async () => {
  if (!EMULATOR_HOST) return;
  testEnv = await initializeTestEnvironment({
    projectId: 'kiattisak-project-001',
    firestore: { rules: readSource(path.resolve(__dirname, '../../firestore.rules')), host: EMU_HOST, port: Number(EMU_PORT) },
  });
});
afterAll(async () => { if (testEnv) await testEnv.cleanup(); });
beforeEach(async () => { if (EMULATOR_HOST) await testEnv.clearFirestore(); });

// ── ตัวละคร ──
const SID = 'scr9-std-1';
const STU_UID = 'scr9-stu-uid';
const OTHER_SID = 'scr9-std-2';
const OTHER_UID = 'scr9-stu-uid-2';
const ROOM = 'ม.5/8';
const HR_STAFF = 'hr-own';          // ครูที่ปรึกษาห้อง ม.5/8
const HR_OTHER_STAFF = 'hr-other';  // ครูที่ปรึกษาห้องอื่น

const ctx = (uid: string, roles: string[], extra: Record<string, unknown> = {}) => testEnv.authenticatedContext(uid, { roles, ...extra }).firestore();
const guidance = () => ctx('guid-uid', ['GUIDANCE_COUNSELOR'], { staffId: 'g-1' });
const homeroom = () => ctx('hr-uid', ['HOMEROOM_TEACHER'], { staffId: HR_STAFF });
const homeroomOtherRoom = () => ctx('hr2-uid', ['HOMEROOM_TEACHER'], { staffId: HR_OTHER_STAFF });
const student = () => ctx(STU_UID, ['STUDENT']);
const otherStudent = () => ctx(OTHER_UID, ['STUDENT']);
const executive = () => ctx('exec-uid', ['EXECUTIVE']);
const subjectTeacher = () => ctx('sub-uid', ['SUBJECT_TEACHER'], { staffId: 'sub-1' });
const superAdmin = () => ctx('adm-uid', ['SUPER_ADMIN'], { staffId: 'adm-1' });

type CounselorState = 'ACTIVE' | 'NONE' | 'UNKNOWN';

async function seed(counselor: CounselorState) {
  await testEnv.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await db.doc(`students/${SID}`).set({ studentId: SID, studentUid: STU_UID, room: ROOM });
    await db.doc(`students/${OTHER_SID}`).set({ studentId: OTHER_SID, studentUid: OTHER_UID, room: ROOM });
    await db.doc(`staff/${HR_STAFF}`).set({ roles: ['HOMEROOM_TEACHER'], assignments: { homeroomClass: ROOM } });
    await db.doc(`staff/${HR_OTHER_STAFF}`).set({ roles: ['HOMEROOM_TEACHER'], assignments: { homeroomClass: 'ม.6/1' } });
    if (counselor !== 'UNKNOWN') {
      await db.doc('school_settings/guidance_status').set({ hasActiveCounselor: counselor === 'ACTIVE', count: counselor === 'ACTIVE' ? 1 : 0 });
    }
  });
}

const twoQ = (over: Record<string, unknown> = {}) => ({ id: '2q-1', studentId: SID, q1Depressed: true, q2Hopeless: false, isPositive: true, conductedAt: '2026-10-05', ...over });
const nineSummary = (over: Record<string, unknown> = {}) => ({
  id: '9q-1', studentId: SID, studentUid: STU_UID, riskLevel: 'MODERATE', redFlagItem9: false, conductedAt: '2026-10-05',
  basisKind: '2Q', basisId: '2q-1', respondentKind: 'STUDENT', recordedByUid: STU_UID, ...over,
});
const nineDetail = (over: Record<string, unknown> = {}) => ({
  id: '9q-1', studentId: SID, studentUid: STU_UID, answers: [2, 2, 2, 1, 1, 1, 1, 1, 0], totalScore: 11,
  basisKind: '2Q', basisId: '2q-1', conductedAt: '2026-10-05', recordedByUid: STU_UID, ...over,
});
const progress = (basisKind: string, basisId: string, used: string[]) => ({
  studentId: SID, studentUid: STU_UID, usedBasisIds: used, lastBasisKind: basisKind, lastBasisId: basisId, lastNineQAt: '2026-10-05',
});
const eightQ = (uid: string, over: Record<string, unknown> = {}) => ({
  id: '8q-1', studentId: SID, answers: [true, false, false, false, false, false, false, false], q3CanControl: null,
  totalScore: 1, riskLevel: 'LOW', urgentReferral: false, conductedAt: '2026-10-05', recordedByUid: uid, recordedByName: 'ครู', ...over,
});
const flag = (uid: string, over: Record<string, unknown> = {}) => ({ studentId: SID, hasCase: true, updatedByUid: uid, ...over });

/** เขียน 9Q ของนักเรียนทั้ง 3 เอกสารใน batch เดียว (summary + detail + progress) */
async function studentSubmitsNineQ(kind: '2Q' | 'GRANT', basisId: string, used: string[], overrides: { summary?: Record<string, unknown>; detail?: Record<string, unknown> } = {}, withProgress = true) {
  const db = student();
  const batch = db.batch();
  batch.set(db.doc(`student_screenings_9q/${SID}`), nineSummary({ basisKind: kind, basisId, ...(overrides.summary || {}) }));
  batch.set(db.doc(`student_screenings_9q_detail/${SID}`), nineDetail({ basisKind: kind, basisId, ...(overrides.detail || {}) }));
  if (withProgress) batch.set(db.doc(`student_screening_progress/${SID}`), progress(kind, basisId, used));
  return batch.commit();
}

const put = (p: string, data: Record<string, unknown>) =>
  testEnv.withSecurityRulesDisabled(async (c) => { await c.firestore().doc(p).set(data); });

describe.skipIf(!EMULATOR_HOST)('คัดกรองซึมเศร้า 2Q → 9Q → 8Q — firestore.rules', () => {
  // ═════════ สิทธิ์การอ่าน: ทุกบทบาท × มี/ไม่มี/ไม่รู้สถานะ ครูแนะแนวที่ใช้งานอยู่ ═════════
  describe.each([
    { counselor: 'ACTIVE' as CounselorState, hasActive: true },
    { counselor: 'NONE' as CounselorState, hasActive: false },
    // doc สถานะยังไม่มี = fail-closed: ถือว่ามีครูแนะแนว (ครูที่ปรึกษาเห็นแค่ระดับ)
    { counselor: 'UNKNOWN' as CounselorState, hasActive: true },
  ])('read matrix — guidance_status = $counselor', ({ counselor, hasActive }) => {
    async function seedAll() {
      await seed(counselor);
      await put(`student_screenings_2q/${SID}`, twoQ());
      await put(`student_screenings_9q/${SID}`, nineSummary());
      await put(`student_screenings_9q_detail/${SID}`, nineDetail());
      await put(`student_screenings_8q/${SID}`, eightQ('g-uid'));
      await put(`student_8q_case_flags/${SID}`, flag('g-uid'));
    }
    const cells: Array<[string, (db: ReturnType<typeof student>) => Promise<unknown>]> = [];
    const paths = {
      '2Q': `student_screenings_2q/${SID}`,
      '9Q summary': `student_screenings_9q/${SID}`,
      '9Q detail': `student_screenings_9q_detail/${SID}`,
      '8Q detail': `student_screenings_8q/${SID}`,
      '8Q case flag': `student_8q_case_flags/${SID}`,
    };
    void cells;

    const check = async (who: () => ReturnType<typeof student>, expected: Record<keyof typeof paths, boolean>) => {
      for (const [label, p] of Object.entries(paths) as Array<[keyof typeof paths, string]>) {
        const op = who().doc(p).get();
        if (expected[label]) await assertSucceeds(op); else await assertFails(op);
      }
    };

    it('GUIDANCE_COUNSELOR reads everything, always', async () => {
      await seedAll();
      const c = screeningCapabilities('GUIDANCE_COUNSELOR', hasActive);
      expect(c).toMatchObject({ read2Q: true, read9QSummary: true, read9QDetail: true, read8QDetail: true, read8QCaseFlag: true });
      await check(guidance, { '2Q': true, '9Q summary': true, '9Q detail': true, '8Q detail': true, '8Q case flag': true });
    });

    it('HOMEROOM_TEACHER of the room: 2Q + 9Q level always; 9Q answers / 8Q score only if NO active counselor; 8Q "has case" always', async () => {
      await seedAll();
      const c = screeningCapabilities('HOMEROOM_TEACHER', hasActive);
      await check(homeroom, {
        '2Q': c.read2Q, '9Q summary': c.read9QSummary, '9Q detail': c.read9QDetail, '8Q detail': c.read8QDetail, '8Q case flag': c.read8QCaseFlag,
      });
      // ย้ำด้วยค่าที่เขียนมือ (ไม่พึ่งตาราง) กันตารางกับ rules เพี้ยนไปด้วยกัน
      await assertSucceeds(homeroom().doc(paths['9Q summary']).get());
      await assertSucceeds(homeroom().doc(paths['8Q case flag']).get());
      if (hasActive) {
        await assertFails(homeroom().doc(paths['9Q detail']).get());
        await assertFails(homeroom().doc(paths['8Q detail']).get());
      } else {
        await assertSucceeds(homeroom().doc(paths['9Q detail']).get());
        await assertSucceeds(homeroom().doc(paths['8Q detail']).get());
      }
    });

    it('HOMEROOM_TEACHER of ANOTHER room reads nothing of this student', async () => {
      await seedAll();
      await check(homeroomOtherRoom, { '2Q': false, '9Q summary': false, '9Q detail': false, '8Q detail': false, '8Q case flag': false });
    });

    it('the student reads ONLY their own 2Q — never 9Q (summary or answers) or 8Q', async () => {
      await seedAll();
      const c = screeningCapabilities('STUDENT', hasActive);
      expect(c).toMatchObject({ read2Q: true, read9QSummary: false, read9QDetail: false, read8QDetail: false, read8QCaseFlag: false });
      await check(student, { '2Q': true, '9Q summary': false, '9Q detail': false, '8Q detail': false, '8Q case flag': false });
      await check(otherStudent, { '2Q': false, '9Q summary': false, '9Q detail': false, '8Q detail': false, '8Q case flag': false });
    });

    it('EXECUTIVE reads 2Q only (school-wide counts); SUBJECT_TEACHER reads nothing; SUPER_ADMIN reads everything', async () => {
      await seedAll();
      await check(executive, { '2Q': true, '9Q summary': false, '9Q detail': false, '8Q detail': false, '8Q case flag': false });
      await check(subjectTeacher, { '2Q': false, '9Q summary': false, '9Q detail': false, '8Q detail': false, '8Q case flag': false });
      await check(superAdmin, { '2Q': true, '9Q summary': true, '9Q detail': true, '8Q detail': true, '8Q case flag': true });
    });
  });

  // ═════════ 2Q: นักเรียนทำเองอิสระ ═════════
  describe('2Q', () => {
    it('the student can save their own 2Q any number of times (no round limit); someone else’s student cannot', async () => {
      await seed('ACTIVE');
      await assertSucceeds(student().doc(`student_screenings_2q/${SID}`).set(twoQ({ id: '2q-a' })));
      await assertSucceeds(student().doc(`student_screenings_2q/${SID}`).set(twoQ({ id: '2q-b', isPositive: false, q1Depressed: false })));
      await assertSucceeds(student().doc(`student_screenings_2q/${SID}`).set(twoQ({ id: '2q-c' })));
      await assertFails(otherStudent().doc(`student_screenings_2q/${SID}`).set(twoQ()));
    });

    it('2Q can be written by GUIDANCE and by the homeroom teacher of that room only', async () => {
      await seed('ACTIVE');
      await assertSucceeds(guidance().doc(`student_screenings_2q/${SID}`).set(twoQ()));
      await assertSucceeds(homeroom().doc(`student_screenings_2q/${SID}`).set(twoQ()));
      await assertFails(homeroomOtherRoom().doc(`student_screenings_2q/${SID}`).set(twoQ()));
      await assertFails(subjectTeacher().doc(`student_screenings_2q/${SID}`).set(twoQ()));
      await assertFails(executive().doc(`student_screenings_2q/${SID}`).set(twoQ()));
    });
  });

  // ═════════ 9Q: เปิดให้นักเรียนทำได้เฉพาะ (ก) 2Q ล่าสุดเป็นบวก (ข) ครูเปิดให้ ═════════
  describe('9Q — student access gate', () => {
    it('(ก) 2Q positive: the student may submit 9Q (summary + answers + progress in ONE batch)', async () => {
      await seed('ACTIVE');
      await put(`student_screenings_2q/${SID}`, twoQ());
      await assertSucceeds(studentSubmitsNineQ('2Q', '2q-1', ['2q-1']));
    });

    it('the same basis cannot be used twice (no endless retakes while 2Q stays positive)', async () => {
      await seed('ACTIVE');
      await put(`student_screenings_2q/${SID}`, twoQ());
      await assertSucceeds(studentSubmitsNineQ('2Q', '2q-1', ['2q-1']));
      await assertFails(studentSubmitsNineQ('2Q', '2q-1', ['2q-1', '2q-1']));
      await assertFails(studentSubmitsNineQ('2Q', '2q-1', ['2q-1']));
    });

    it('a NEW positive 2Q is a new basis → another 9Q round is allowed, and progress keeps the history of used bases', async () => {
      await seed('ACTIVE');
      await put(`student_screenings_2q/${SID}`, twoQ());
      await assertSucceeds(studentSubmitsNineQ('2Q', '2q-1', ['2q-1']));
      await put(`student_screenings_2q/${SID}`, twoQ({ id: '2q-2' }));
      await assertSucceeds(studentSubmitsNineQ('2Q', '2q-2', ['2q-1', '2q-2']));
      // ลบประวัติฐานที่ใช้แล้วทิ้ง (เพื่อใช้ 2q-1 ซ้ำ) ไม่ได้
      await assertFails(studentSubmitsNineQ('2Q', '2q-2', ['2q-2']));
    });

    it('2Q negative, or no 2Q at all, and no grant → the student cannot write 9Q', async () => {
      await seed('ACTIVE');
      await assertFails(studentSubmitsNineQ('2Q', '2q-1', ['2q-1']));            // ไม่มี 2Q เลย
      await put(`student_screenings_2q/${SID}`, twoQ({ isPositive: false, q1Depressed: false }));
      await assertFails(studentSubmitsNineQ('2Q', '2q-1', ['2q-1']));            // 2Q ล่าสุดเป็นลบ
    });

    it('the basis id must be the id of the CURRENT positive 2Q (an old/made-up id is refused)', async () => {
      await seed('ACTIVE');
      await put(`student_screenings_2q/${SID}`, twoQ({ id: '2q-now' }));
      await assertFails(studentSubmitsNineQ('2Q', '2q-old', ['2q-old']));
      await assertFails(studentSubmitsNineQ('2Q', 'made-up', ['made-up']));
    });

    it('(ข) a grant opened by GUIDANCE or by the homeroom teacher lets the student answer once; the student cannot open one', async () => {
      await seed('ACTIVE');
      // นักเรียนเปิดให้ตัวเองไม่ได้ (แม้ใส่ openedByUid เป็นตัวเอง)
      await assertFails(student().doc(`student_screening_progress/${SID}/grants/g-self`).set({ openedByUid: STU_UID, openedByName: 'x', openedByRole: 'STUDENT', openedAt: '2026-10-05' }));
      await assertSucceeds(guidance().doc(`student_screening_progress/${SID}/grants/g-1`).set({ openedByUid: 'guid-uid', openedByName: 'แนะแนว', openedByRole: 'GUIDANCE_COUNSELOR', openedAt: '2026-10-05' }));
      await assertSucceeds(homeroom().doc(`student_screening_progress/${SID}/grants/g-2`).set({ openedByUid: 'hr-uid', openedByName: 'ที่ปรึกษา', openedByRole: 'HOMEROOM_TEACHER', openedAt: '2026-10-05', note: 'มาปรึกษาเอง' }));
      await assertSucceeds(studentSubmitsNineQ('GRANT', 'g-1', ['g-1']));
      await assertFails(studentSubmitsNineQ('GRANT', 'g-1', ['g-1', 'g-1']));            // ใบเดิมใช้ซ้ำไม่ได้
      await assertSucceeds(studentSubmitsNineQ('GRANT', 'g-2', ['g-1', 'g-2']));          // ใบที่สองใช้ได้
    });

    it('grants: only GUIDANCE / the homeroom teacher OF THAT ROOM / SUPER_ADMIN may open; others (other-room homeroom, subject teacher, executive, another student) cannot; openedByUid must be the caller', async () => {
      await seed('ACTIVE');
      const g = (uid: string) => ({ openedByUid: uid, openedByName: 'ครู', openedByRole: 'X', openedAt: '2026-10-05' });
      await assertFails(homeroomOtherRoom().doc(`student_screening_progress/${SID}/grants/a`).set(g('hr2-uid')));
      await assertFails(subjectTeacher().doc(`student_screening_progress/${SID}/grants/b`).set(g('sub-uid')));
      await assertFails(executive().doc(`student_screening_progress/${SID}/grants/c`).set(g('exec-uid')));
      await assertFails(otherStudent().doc(`student_screening_progress/${SID}/grants/d`).set(g(OTHER_UID)));
      await assertFails(guidance().doc(`student_screening_progress/${SID}/grants/e`).set(g('someone-else')));   // ปลอมผู้เปิด
      await assertFails(guidance().doc(`student_screening_progress/${SID}/grants/f`).set({ ...g('guid-uid'), extra: 1 }));
      await assertSucceeds(superAdmin().doc(`student_screening_progress/${SID}/grants/ok`).set(g('adm-uid')));
    });

    it('a grant of ANOTHER student cannot be used, and a revoked (deleted) grant cannot be used', async () => {
      await seed('ACTIVE');
      await guidance().doc(`student_screening_progress/${OTHER_SID}/grants/g-other`).set({ openedByUid: 'guid-uid', openedByName: 'x', openedByRole: 'GUIDANCE_COUNSELOR', openedAt: '2026-10-05' });
      await assertFails(studentSubmitsNineQ('GRANT', 'g-other', ['g-other']));
      await guidance().doc(`student_screening_progress/${SID}/grants/g-rev`).set({ openedByUid: 'guid-uid', openedByName: 'x', openedByRole: 'GUIDANCE_COUNSELOR', openedAt: '2026-10-05' });
      await assertSucceeds(guidance().doc(`student_screening_progress/${SID}/grants/g-rev`).delete());
      await assertFails(studentSubmitsNineQ('GRANT', 'g-rev', ['g-rev']));
    });

    it('the student reads their own grants and progress (to know a 9Q is open) but not another student’s', async () => {
      await seed('ACTIVE');
      await put(`student_screening_progress/${SID}/grants/g-1`, { openedByUid: 'guid-uid', openedByName: 'x', openedByRole: 'GUIDANCE_COUNSELOR', openedAt: '2026-10-05' });
      await put(`student_screening_progress/${SID}`, progress('GRANT', 'g-0', ['g-0']));
      await assertSucceeds(student().doc(`student_screening_progress/${SID}/grants/g-1`).get());
      await assertSucceeds(student().doc(`student_screening_progress/${SID}`).get());
      await assertFails(otherStudent().doc(`student_screening_progress/${SID}/grants/g-1`).get());
      await assertFails(otherStudent().doc(`student_screening_progress/${SID}`).get());
    });

    it('integrity of the student write: must come WITH the progress update; progress must append exactly one basis; only whitelisted fields; valid values', async () => {
      await seed('ACTIVE');
      await put(`student_screenings_2q/${SID}`, twoQ());
      await assertFails(studentSubmitsNineQ('2Q', '2q-1', ['2q-1'], {}, false));                                  // ไม่มี progress ใน batch
      await assertFails(studentSubmitsNineQ('2Q', '2q-1', ['2q-1', 'junk']));                                      // progress เพิ่มมากกว่า 1 ฐาน
      await assertFails(studentSubmitsNineQ('2Q', '2q-1', ['2q-1'], { summary: { riskLevel: 'GREAT' } }));       // ค่าไม่อยู่ใน enum
      await assertFails(studentSubmitsNineQ('2Q', '2q-1', ['2q-1'], { summary: { totalScore: 3 } }));            // summary ห้ามมีคะแนนรวม
      await assertFails(studentSubmitsNineQ('2Q', '2q-1', ['2q-1'], { detail: { answers: [1, 2, 3] } }));        // ต้อง 9 ข้อ
      await assertFails(studentSubmitsNineQ('2Q', '2q-1', ['2q-1'], { detail: { totalScore: 99 } }));            // เกิน 27
      await assertFails(studentSubmitsNineQ('2Q', '2q-1', ['2q-1'], { summary: { studentUid: OTHER_UID } }));    // ปลอม studentUid
      await assertFails(studentSubmitsNineQ('2Q', '2q-1', ['2q-1'], { summary: { evil: true } }));               // field แปลกปลอม
      await assertSucceeds(studentSubmitsNineQ('2Q', '2q-1', ['2q-1']));
    });

    it('another student can never write 9Q for this student, even with a valid-looking batch', async () => {
      await seed('ACTIVE');
      await put(`student_screenings_2q/${SID}`, twoQ());
      const db = otherStudent();
      const batch = db.batch();
      batch.set(db.doc(`student_screenings_9q/${SID}`), nineSummary({ studentUid: OTHER_UID }));
      batch.set(db.doc(`student_screenings_9q_detail/${SID}`), nineDetail({ studentUid: OTHER_UID }));
      batch.set(db.doc(`student_screening_progress/${SID}`), { ...progress('2Q', '2q-1', ['2q-1']), studentUid: OTHER_UID });
      await assertFails(batch.commit());
    });
  });

  // ═════════ 9Q: ใครเขียนแทนนักเรียนได้ ═════════
  describe('9Q — staff writes', () => {
    it('GUIDANCE_COUNSELOR (and SUPER_ADMIN) can record 9Q on behalf of a student; a homeroom teacher cannot write 9Q at all (they open a grant instead)', async () => {
      await seed('ACTIVE');
      await assertSucceeds(guidance().doc(`student_screenings_9q/${SID}`).set(nineSummary({ basisKind: 'STAFF', basisId: 'staff-1', respondentKind: 'STAFF', recordedByUid: 'guid-uid' })));
      await assertSucceeds(guidance().doc(`student_screenings_9q_detail/${SID}`).set(nineDetail({ basisKind: 'STAFF', basisId: 'staff-1', recordedByUid: 'guid-uid' })));
      await assertSucceeds(superAdmin().doc(`student_screenings_9q/${SID}`).set(nineSummary()));
      await assertFails(homeroom().doc(`student_screenings_9q/${SID}`).set(nineSummary()));
      await assertFails(homeroom().doc(`student_screenings_9q_detail/${SID}`).set(nineDetail()));
      // แม้ไม่มีครูแนะแนวในระบบ (ครูที่ปรึกษาทำแทนได้เฉพาะ 8Q ตามสเปค) — 9Q นักเรียนตอบเอง ครูแค่เปิดให้
      await testEnv.withSecurityRulesDisabled(async (c) => { await c.firestore().doc('school_settings/guidance_status').set({ hasActiveCounselor: false, count: 0 }); });
      await assertFails(homeroom().doc(`student_screenings_9q/${SID}`).set(nineSummary()));
      await assertFails(subjectTeacher().doc(`student_screenings_9q/${SID}`).set(nineSummary()));
      await assertFails(executive().doc(`student_screenings_9q/${SID}`).set(nineSummary()));
    });
  });

  // ═════════ 8Q: ครูกรอกแทนเท่านั้น และเปิดได้เมื่อ 9Q ล่าสุด ≥7 หรือมีธงแดงข้อ 9 ═════════
  describe('8Q', () => {
    it('the student can never write 8Q or its case flag (no student screen exists)', async () => {
      await seed('NONE');
      await put(`student_screenings_9q/${SID}`, nineSummary({ riskLevel: 'SEVERE' }));
      await assertFails(student().doc(`student_screenings_8q/${SID}`).set(eightQ(STU_UID)));
      await assertFails(student().doc(`student_8q_case_flags/${SID}`).set(flag(STU_UID)));
    });

    it('sequence: no 9Q → 8Q refused; 9Q "NONE" (<7) without red flag → refused; NONE + red flag → allowed; MILD (≥7) → allowed', async () => {
      await seed('ACTIVE');
      await assertFails(guidance().doc(`student_screenings_8q/${SID}`).set(eightQ('guid-uid')));
      await put(`student_screenings_9q/${SID}`, nineSummary({ riskLevel: 'NONE', redFlagItem9: false }));
      await assertFails(guidance().doc(`student_screenings_8q/${SID}`).set(eightQ('guid-uid')));
      await assertFails(guidance().doc(`student_8q_case_flags/${SID}`).set(flag('guid-uid')));
      await put(`student_screenings_9q/${SID}`, nineSummary({ riskLevel: 'NONE', redFlagItem9: true }));
      await assertSucceeds(guidance().doc(`student_screenings_8q/${SID}`).set(eightQ('guid-uid')));
      await put(`student_screenings_9q/${SID}`, nineSummary({ riskLevel: 'MILD', redFlagItem9: false }));
      await assertSucceeds(guidance().doc(`student_screenings_8q/${SID}`).set(eightQ('guid-uid')));
      await assertSucceeds(guidance().doc(`student_8q_case_flags/${SID}`).set(flag('guid-uid')));
    });

    it('GUIDANCE_COUNSELOR writes 8Q always (when unlocked); the homeroom teacher writes 8Q ONLY when there is no active counselor', async () => {
      for (const counselor of ['ACTIVE', 'NONE', 'UNKNOWN'] as CounselorState[]) {
        await testEnv.clearFirestore();
        await seed(counselor);
        await put(`student_screenings_9q/${SID}`, nineSummary({ riskLevel: 'MODERATE' }));
        const hasActive = counselor !== 'NONE';
        const caps = screeningCapabilities('HOMEROOM_TEACHER', hasActive);
        await assertSucceeds(guidance().doc(`student_screenings_8q/${SID}`).set(eightQ('guid-uid')));
        // (สร้าง promise ตอนจะ await ทันที — ถ้าสร้างก่อนแล้วค่อย await จะเกิด unhandled rejection ตอนถูกปฏิเสธ)
        if (caps.write8Q) {
          await assertSucceeds(homeroom().doc(`student_screenings_8q/${SID}`).set(eightQ('hr-uid')));
          await assertSucceeds(homeroom().doc(`student_8q_case_flags/${SID}`).set(flag('hr-uid')));
        } else {
          await assertFails(homeroom().doc(`student_screenings_8q/${SID}`).set(eightQ('hr-uid')));
          await assertFails(homeroom().doc(`student_8q_case_flags/${SID}`).set(flag('hr-uid')));
        }
        expect(caps.write8Q, `counselor=${counselor}`).toBe(counselor === 'NONE');
        await assertFails(homeroomOtherRoom().doc(`student_screenings_8q/${SID}`).set(eightQ('hr2-uid')));
        await assertFails(subjectTeacher().doc(`student_screenings_8q/${SID}`).set(eightQ('sub-uid')));
        await assertFails(executive().doc(`student_screenings_8q/${SID}`).set(eightQ('exec-uid')));
      }
    });

    it('the sequence gate applies to teachers; SUPER_ADMIN may correct data regardless', async () => {
      await seed('NONE');
      await assertFails(homeroom().doc(`student_screenings_8q/${SID}`).set(eightQ('hr-uid')));   // ไม่มี 9Q
      await assertSucceeds(superAdmin().doc(`student_screenings_8q/${SID}`).set(eightQ('adm-uid')));
    });

    it('8Q write integrity: recordedByUid must be the caller, 8 answers, whitelisted fields, valid risk level', async () => {
      await seed('ACTIVE');
      await put(`student_screenings_9q/${SID}`, nineSummary({ riskLevel: 'SEVERE' }));
      const db = guidance().doc(`student_screenings_8q/${SID}`);
      await assertFails(db.set(eightQ('someone-else')));
      await assertFails(db.set(eightQ('guid-uid', { answers: [true] })));
      await assertFails(db.set(eightQ('guid-uid', { riskLevel: 'HUGE' })));
      await assertFails(db.set(eightQ('guid-uid', { parentNotified: true })));
      await assertFails(db.set(eightQ('guid-uid', { studentId: OTHER_SID })));
      await assertSucceeds(db.set(eightQ('guid-uid', { totalScore: 52, riskLevel: 'SEVERE', urgentReferral: true, q3CanControl: false })));
    });
  });

  // ═════════ บันทึกแจ้งผู้ปกครอง ═════════
  describe('parent notice log', () => {
    const notice = (uid: string, over: Record<string, unknown> = {}) => ({ scope: 'NINE_Q', screeningId: '9q-1', notifiedByUid: uid, notifiedByName: 'ครู', notifiedAt: '2026-10-05T10:00', method: 'PHONE', ...over });

    it('GUIDANCE and the homeroom teacher of that room can log a 9Q notice (as themselves); nobody else can; the student cannot read or write', async () => {
      await seed('ACTIVE');
      await assertSucceeds(guidance().doc(`student_screening_notices/${SID}/entries/n1`).set(notice('guid-uid')));
      await assertSucceeds(homeroom().doc(`student_screening_notices/${SID}/entries/n2`).set(notice('hr-uid', { method: 'IN_PERSON', note: 'พบผู้ปกครองที่โรงเรียน' })));
      await assertFails(homeroom().doc(`student_screening_notices/${SID}/entries/n3`).set(notice('guid-uid')));          // ปลอมผู้แจ้ง
      await assertFails(homeroomOtherRoom().doc(`student_screening_notices/${SID}/entries/n4`).set(notice('hr2-uid')));
      await assertFails(subjectTeacher().doc(`student_screening_notices/${SID}/entries/n5`).set(notice('sub-uid')));
      await assertFails(student().doc(`student_screening_notices/${SID}/entries/n6`).set(notice(STU_UID)));
      await assertFails(student().doc(`student_screening_notices/${SID}/entries/n1`).get());
      await assertFails(executive().doc(`student_screening_notices/${SID}/entries/n1`).get());
      await assertSucceeds(homeroom().doc(`student_screening_notices/${SID}/entries/n1`).get());
    });

    it('append-only: no update; invalid scope/method/extra fields are refused; only SUPER_ADMIN can delete', async () => {
      await seed('ACTIVE');
      await assertSucceeds(guidance().doc(`student_screening_notices/${SID}/entries/n1`).set(notice('guid-uid')));
      await assertFails(guidance().doc(`student_screening_notices/${SID}/entries/n1`).update({ method: 'OTHER' }));
      await assertFails(guidance().doc(`student_screening_notices/${SID}/entries/n1`).delete());
      await assertFails(guidance().doc(`student_screening_notices/${SID}/entries/n7`).set(notice('guid-uid', { method: 'CARRIER_PIGEON' })));
      await assertFails(guidance().doc(`student_screening_notices/${SID}/entries/n8`).set(notice('guid-uid', { scope: 'TWO_Q' })));
      await assertFails(guidance().doc(`student_screening_notices/${SID}/entries/n9`).set(notice('guid-uid', { autoSent: true })));
      await assertSucceeds(superAdmin().doc(`student_screening_notices/${SID}/entries/n1`).delete());
    });

    it('an 8Q notice: GUIDANCE always; the homeroom teacher only when there is no active counselor', async () => {
      await seed('ACTIVE');
      await assertSucceeds(guidance().doc(`student_screening_notices/${SID}/entries/e1`).set(notice('guid-uid', { scope: 'EIGHT_Q', screeningId: '8q-1' })));
      await assertFails(homeroom().doc(`student_screening_notices/${SID}/entries/e2`).set(notice('hr-uid', { scope: 'EIGHT_Q', screeningId: '8q-1' })));
      await testEnv.withSecurityRulesDisabled(async (c) => { await c.firestore().doc('school_settings/guidance_status').set({ hasActiveCounselor: false, count: 0 }); });
      await assertSucceeds(homeroom().doc(`student_screening_notices/${SID}/entries/e3`).set(notice('hr-uid', { scope: 'EIGHT_Q', screeningId: '8q-1' })));
    });
  });

  // ═════════ school_settings/guidance_status (cache ที่ใช้ตัดสินสิทธิ์) ═════════
  describe('school_settings/guidance_status', () => {
    it('any signed-in user can read it but NOBODY can write it from a client — not even SUPER_ADMIN (only the Admin SDK in Cloud Functions)', async () => {
      await seed('ACTIVE');
      await assertSucceeds(student().doc('school_settings/guidance_status').get());
      await assertSucceeds(homeroom().doc('school_settings/guidance_status').get());
      for (const who of [superAdmin, guidance, homeroom, student]) {
        await assertFails(who().doc('school_settings/guidance_status').set({ hasActiveCounselor: false, count: 0 }));
        await assertFails(who().doc('school_settings/guidance_status').update({ hasActiveCounselor: false }));
      }
      // wildcard เดิมของ school_settings ยังใช้ได้กับเอกสารอื่น
      await assertSucceeds(superAdmin().doc('school_settings/anything_else').set({ x: 1 }));
    });

    it('missing doc = fail-closed: the homeroom teacher gets the restricted view (as if a counselor exists)', async () => {
      await seed('UNKNOWN');
      await put(`student_screenings_9q_detail/${SID}`, nineDetail());
      await assertFails(homeroom().doc(`student_screenings_9q_detail/${SID}`).get());
    });

    it('a stale/garbled doc without the field is also treated as "has counselor"', async () => {
      await seed('UNKNOWN');
      await put('school_settings/guidance_status', { updatedAt: 'x' });
      await put(`student_screenings_9q_detail/${SID}`, nineDetail());
      await assertFails(homeroom().doc(`student_screenings_9q_detail/${SID}`).get());
    });
  });
});
