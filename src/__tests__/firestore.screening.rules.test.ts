import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as path from 'path';
import { initializeTestEnvironment, RulesTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { readSource } from './helpers/readSource';
import { screeningCapabilities } from '../lib/depressionScreening';

/**
 * firestore.rules — คัดกรองซึมเศร้า 2Q → 9Q → 8Q (ต้องรันบน Firestore Emulator จริง: npm run emulators:exec)
 * ครอบคลุมสิทธิ์ทุกบทบาท × (มี / ไม่มี / ไม่รู้สถานะ) ครูแนะแนวที่ใช้งานอยู่
 *  - 9Q (summary/detail/progress) client เขียนไม่ได้เลย — เขียนผ่าน callable submitNineQ เท่านั้น (ทดสอบตรรกะที่ nineQServer.test.ts
 *    และ E2E บน Functions emulator ที่ authBlocking.e2e.test.ts)
 *  - 8Q: ทางฉุกเฉิน (ไม่ต้องรอ 9Q) + rules คำนวณคะแนน/ระดับ/ส่งต่อด่วนซ้ำเอง
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
const progress = (used: string[]) => ({ studentId: SID, studentUid: STU_UID, usedBasisIds: used, lastBasisKind: '2Q', lastBasisId: used[used.length - 1], lastNineQAt: '2026-10-05' });

/** เอกสาร 8Q ที่ถูกต้อง (คะแนนคำนวณมือตามสเปค: ข้อ1=1, 2=2, 3=6 (+8 ถ้าควบคุมไม่ได้), 4=8, 5=9, 6=4, 7=10, 8=4) */
const eightQ = (uid: string, over: Record<string, unknown> = {}) => ({
  id: '8q-1', studentId: SID, answers: [true, false, false, false, false, false, false, false], q3CanControl: null,
  totalScore: 1, riskLevel: 'LOW', urgentReferral: false, entryPath: 'AFTER_9Q', conductedAt: '2026-10-05', recordedByUid: uid, recordedByName: 'ครู', ...over,
});
const flag = (uid: string, over: Record<string, unknown> = {}) => ({ studentId: SID, hasCase: true, updatedByUid: uid, ...over });

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
    const paths = {
      '2Q': `student_screenings_2q/${SID}`,
      '9Q summary': `student_screenings_9q/${SID}`,
      '9Q detail': `student_screenings_9q_detail/${SID}`,
      '8Q detail': `student_screenings_8q/${SID}`,
      '8Q case flag': `student_8q_case_flags/${SID}`,
    };

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

  // ═════════ 9Q: client เขียนตรงไม่ได้เลย (ผ่าน callable submitNineQ เท่านั้น) ═════════
  describe('9Q — no direct client writes (server-computed via callable submitNineQ)', () => {
    const targets: Array<[string, Record<string, unknown>]> = [
      [`student_screenings_9q/${SID}`, nineSummary()],
      [`student_screenings_9q_detail/${SID}`, nineDetail()],
      [`student_screening_progress/${SID}`, progress(['2q-1'])],
    ];

    it('NOBODY can create/update/delete 9Q summary, 9Q answers or progress from a client — student, every teacher role, executive and even SUPER_ADMIN', async () => {
      await seed('NONE');
      await put(`student_screenings_2q/${SID}`, twoQ());
      await guidance().doc(`student_screening_progress/${SID}/grants/g-1`).set({ openedByUid: 'guid-uid', openedByName: 'x', openedByRole: 'GUIDANCE_COUNSELOR', openedAt: '2026-10-05' });
      for (const who of [student, otherStudent, guidance, homeroom, homeroomOtherRoom, subjectTeacher, executive, superAdmin]) {
        for (const [p, data] of targets) {
          await assertFails(who().doc(p).set(data));
          await assertFails(who().doc(p).update({ riskLevel: 'NONE' }));
          await assertFails(who().doc(p).delete());
        }
      }
    });

    it('the exact attack this closes: a student with a valid basis cannot write their own result (e.g. hide the red flag / lower the level) in a hand-made batch', async () => {
      await seed('ACTIVE');
      await put(`student_screenings_2q/${SID}`, twoQ());
      const db = student();
      const batch = db.batch();
      batch.set(db.doc(`student_screenings_9q/${SID}`), nineSummary({ riskLevel: 'NONE', redFlagItem9: false })); // ตอบข้อ 9 แต่ส่งว่าไม่มีธงแดง
      batch.set(db.doc(`student_screenings_9q_detail/${SID}`), nineDetail({ answers: [3, 3, 3, 3, 3, 3, 3, 3, 3], totalScore: 0 }));
      batch.set(db.doc(`student_screening_progress/${SID}`), progress(['2q-1']));
      await assertFails(batch.commit());
    });
  });

  // ═════════ ใบอนุญาตให้นักเรียนทำ 9Q (ครูเขียนจาก client ได้ — ไม่มีคะแนน) ═════════
  describe('9Q grants (opened by teachers)', () => {
    it('grants: only GUIDANCE / the homeroom teacher OF THAT ROOM / SUPER_ADMIN may open; the student, other-room homeroom, subject teacher, executive cannot; openedByUid must be the caller; no extra fields', async () => {
      await seed('ACTIVE');
      const g = (uid: string) => ({ openedByUid: uid, openedByName: 'ครู', openedByRole: 'X', openedAt: '2026-10-05' });
      await assertFails(student().doc(`student_screening_progress/${SID}/grants/self`).set(g(STU_UID)));
      await assertFails(homeroomOtherRoom().doc(`student_screening_progress/${SID}/grants/a`).set(g('hr2-uid')));
      await assertFails(subjectTeacher().doc(`student_screening_progress/${SID}/grants/b`).set(g('sub-uid')));
      await assertFails(executive().doc(`student_screening_progress/${SID}/grants/c`).set(g('exec-uid')));
      await assertFails(otherStudent().doc(`student_screening_progress/${SID}/grants/d`).set(g(OTHER_UID)));
      await assertFails(guidance().doc(`student_screening_progress/${SID}/grants/e`).set(g('someone-else')));
      await assertFails(guidance().doc(`student_screening_progress/${SID}/grants/f`).set({ ...g('guid-uid'), extra: 1 }));
      await assertSucceeds(guidance().doc(`student_screening_progress/${SID}/grants/ok1`).set(g('guid-uid')));
      await assertSucceeds(homeroom().doc(`student_screening_progress/${SID}/grants/ok2`).set({ ...g('hr-uid'), note: 'มาปรึกษาเอง' }));
      await assertSucceeds(superAdmin().doc(`student_screening_progress/${SID}/grants/ok3`).set(g('adm-uid')));
    });

    it('a teacher can revoke a grant (delete); nobody can edit one; the student reads their own grants and progress but not another student’s', async () => {
      await seed('ACTIVE');
      await put(`student_screening_progress/${SID}/grants/g-1`, { openedByUid: 'guid-uid', openedByName: 'x', openedByRole: 'GUIDANCE_COUNSELOR', openedAt: '2026-10-05' });
      await put(`student_screening_progress/${SID}`, progress(['g-0']));
      await assertSucceeds(student().doc(`student_screening_progress/${SID}/grants/g-1`).get());
      await assertSucceeds(student().doc(`student_screening_progress/${SID}`).get());
      await assertFails(otherStudent().doc(`student_screening_progress/${SID}/grants/g-1`).get());
      await assertFails(otherStudent().doc(`student_screening_progress/${SID}`).get());
      await assertFails(student().doc(`student_screening_progress/${SID}/grants/g-1`).delete());
      await assertFails(guidance().doc(`student_screening_progress/${SID}/grants/g-1`).update({ note: 'x' }));
      await assertSucceeds(guidance().doc(`student_screening_progress/${SID}/grants/g-1`).delete());
    });
  });

  // ═════════ 8Q ═════════
  describe('8Q', () => {
    it('the student can never write 8Q or its case flag (no student screen exists)', async () => {
      await seed('NONE');
      await put(`student_screenings_9q/${SID}`, nineSummary({ riskLevel: 'SEVERE' }));
      await assertFails(student().doc(`student_screenings_8q/${SID}`).set(eightQ(STU_UID)));
      await assertFails(student().doc(`student_8q_case_flags/${SID}`).set(flag(STU_UID)));
    });

    it('EMERGENCY PATH: no 9Q at all (or 9Q below 7 with no red flag) does NOT block GUIDANCE_COUNSELOR — 8Q (and the case flag) can be recorded immediately', async () => {
      await seed('ACTIVE');
      // ไม่มี 9Q เลย
      await assertSucceeds(guidance().doc(`student_screenings_8q/${SID}`).set(eightQ('guid-uid', { entryPath: 'EMERGENCY' })));
      const db = guidance();
      const batch = db.batch();
      batch.set(db.doc(`student_screenings_8q/${SID}`), eightQ('guid-uid', { entryPath: 'EMERGENCY' }));
      batch.set(db.doc(`student_8q_case_flags/${SID}`), flag('guid-uid'));
      await assertSucceeds(batch.commit());
      // 9Q ต่ำกว่า 7 และไม่มีธงแดง
      await put(`student_screenings_9q/${SID}`, nineSummary({ riskLevel: 'NONE', redFlagItem9: false }));
      await assertSucceeds(guidance().doc(`student_screenings_8q/${SID}`).set(eightQ('guid-uid', { entryPath: 'EMERGENCY' })));
      // และเส้นทางปกติ (9Q ≥7 / ธงแดง) ก็ยังบันทึกได้เหมือนเดิม
      await put(`student_screenings_9q/${SID}`, nineSummary({ riskLevel: 'MILD' }));
      await assertSucceeds(guidance().doc(`student_screenings_8q/${SID}`).set(eightQ('guid-uid', { entryPath: 'AFTER_9Q' })));
    });

    it('EMERGENCY PATH for the homeroom teacher: only when there is NO active counselor (with a counselor, or status unknown, they still cannot write 8Q)', async () => {
      for (const counselor of ['NONE', 'ACTIVE', 'UNKNOWN'] as CounselorState[]) {
        await testEnv.clearFirestore();
        await seed(counselor);
        const caps = screeningCapabilities('HOMEROOM_TEACHER', counselor !== 'NONE');
        const doc = eightQ('hr-uid', { entryPath: 'EMERGENCY' });
        if (counselor === 'NONE') {
          expect(caps.write8Q).toBe(true);
          const db = homeroom();
          const batch = db.batch();
          batch.set(db.doc(`student_screenings_8q/${SID}`), doc);
          batch.set(db.doc(`student_8q_case_flags/${SID}`), flag('hr-uid'));
          await assertSucceeds(batch.commit()); // ไม่มี 9Q ก็บันทึกได้
        } else {
          expect(caps.write8Q, counselor).toBe(false);
          await assertFails(homeroom().doc(`student_screenings_8q/${SID}`).set(doc));
          await assertFails(homeroom().doc(`student_8q_case_flags/${SID}`).set(flag('hr-uid')));
        }
        await assertFails(homeroomOtherRoom().doc(`student_screenings_8q/${SID}`).set(eightQ('hr2-uid')));
        await assertFails(subjectTeacher().doc(`student_screenings_8q/${SID}`).set(eightQ('sub-uid')));
        await assertFails(executive().doc(`student_screenings_8q/${SID}`).set(eightQ('exec-uid')));
      }
    });

    it('8Q write integrity: recordedByUid = caller; whitelisted fields only; entryPath must be AFTER_9Q or EMERGENCY; studentId must match the document', async () => {
      await seed('ACTIVE');
      const ref = () => guidance().doc(`student_screenings_8q/${SID}`);
      await assertFails(ref().set(eightQ('someone-else')));
      await assertFails(ref().set(eightQ('guid-uid', { parentNotified: true })));
      await assertFails(ref().set(eightQ('guid-uid', { entryPath: 'WHENEVER' })));
      const { entryPath: _omit, ...noPath } = eightQ('guid-uid');
      await assertFails(ref().set(noPath));                                  // ไม่ระบุ entryPath = ไม่ผ่าน
      await assertFails(ref().set(eightQ('guid-uid', { studentId: OTHER_SID })));
      await assertSucceeds(ref().set(eightQ('guid-uid')));
    });

    it('rules recompute the 8Q score from the raw answers — a wrong total, level or "urgent" flag is refused (every edge, including the item-3 follow-up)', async () => {
      await seed('ACTIVE');
      const ref = () => guidance().doc(`student_screenings_8q/${SID}`);
      const answers = (yes: number[]) => [1, 2, 3, 4, 5, 6, 7, 8].map((n) => yes.includes(n));
      const doc = (yes: number[], q3: boolean | null, total: number, level: string, urgent: boolean) =>
        eightQ('guid-uid', { answers: answers(yes), q3CanControl: q3, totalScore: total, riskLevel: level, urgentReferral: urgent });

      // ถูกต้อง: ทุกขอบของระดับ
      await assertSucceeds(ref().set(doc([], null, 0, 'NONE', false)));
      await assertSucceeds(ref().set(doc([1], null, 1, 'LOW', false)));
      await assertSucceeds(ref().set(doc([4], null, 8, 'LOW', false)));                  // 8 = สูงสุดของ "น้อย"
      await assertSucceeds(ref().set(doc([5], null, 9, 'MODERATE', false)));             // 9 = ต่ำสุดของ "ปานกลาง"
      await assertSucceeds(ref().set(doc([3, 7], true, 16, 'MODERATE', false)));         // 6 + 10 = 16
      await assertSucceeds(ref().set(doc([1, 3, 7], true, 17, 'SEVERE', true)));         // 17 = ต่ำสุดของ "รุนแรง" + ส่งต่อด่วน
      await assertSucceeds(ref().set(doc([4, 5], null, 17, 'SEVERE', true)));
      await assertSucceeds(ref().set(doc([3], true, 6, 'LOW', false)));                  // ข้อ 3 ควบคุมได้ = 6
      await assertSucceeds(ref().set(doc([3], false, 14, 'MODERATE', false)));           // ข้อ 3 ควบคุมไม่ได้ = 6 + 8
      await assertSucceeds(ref().set(doc([1, 2, 3, 4, 5, 6, 7, 8], false, 52, 'SEVERE', true))); // สูงสุด

      // ผิด: คะแนนไม่ตรงกับคำตอบ
      await assertFails(ref().set(doc([1, 3, 7], true, 3, 'LOW', false)));               // ลดคะแนนเอง
      await assertFails(ref().set(doc([4, 5], null, 16, 'MODERATE', false)));            // 17 จริง แต่ส่ง 16
      await assertFails(ref().set(doc([3], false, 6, 'LOW', false)));                    // ลืมบวก +8 ของข้อย่อย
      await assertFails(ref().set(doc([3], true, 14, 'MODERATE', false)));               // บวก +8 ทั้งที่ควบคุมได้
      // ผิด: ระดับ/ส่งต่อด่วนไม่ตรงกับคะแนน
      await assertFails(ref().set(doc([4, 5], null, 17, 'MODERATE', true)));
      await assertFails(ref().set(doc([4, 5], null, 17, 'SEVERE', false)));              // ≥17 ต้องส่งต่อด่วน
      await assertFails(ref().set(doc([4], null, 8, 'LOW', true)));                      // <17 ห้ามติดธงส่งต่อด่วน
      await assertFails(ref().set(doc([], null, 0, 'LOW', false)));
      await assertFails(ref().set(doc([5], null, 9, 'LOW', false)));
      // ผิด: โครงสร้าง
      await assertFails(ref().set(eightQ('guid-uid', { answers: [true, false] })));
      await assertFails(ref().set(eightQ('guid-uid', { answers: [1, 0, 0, 0, 0, 0, 0, 0] })));          // ไม่ใช่ bool
      await assertFails(ref().set(doc([3], null, 6, 'LOW', false)));                      // ข้อ 3 มี แต่ไม่ตอบข้อย่อย
      await assertFails(ref().set(doc([], true, 0, 'NONE', false)));                      // ข้อ 3 ไม่มี แต่มีข้อย่อยค้าง
      await assertFails(ref().set(eightQ('guid-uid', { totalScore: 1.5 })));
    });

    it('the case flag must agree with the 8Q written in the same batch (hasCase = score > 0)', async () => {
      await seed('ACTIVE');
      const db = guidance();
      const withFlag = async (eight: Record<string, unknown>, hasCase: boolean) => {
        const batch = db.batch();
        batch.set(db.doc(`student_screenings_8q/${SID}`), eight);
        batch.set(db.doc(`student_8q_case_flags/${SID}`), flag('guid-uid', { hasCase }));
        return batch.commit();
      };
      const none = eightQ('guid-uid', { answers: Array(8).fill(false), totalScore: 0, riskLevel: 'NONE' });
      await assertSucceeds(withFlag(none, false));
      await assertFails(withFlag(none, true));                          // ไม่มีคะแนนแต่บอกว่ามีเคส
      await assertFails(withFlag(eightQ('guid-uid'), false));           // มีคะแนนแต่บอกว่าไม่มีเคส (ซ่อนเคสจากครูที่ปรึกษา)
      await assertSucceeds(withFlag(eightQ('guid-uid'), true));
      await assertFails(db.doc(`student_8q_case_flags/${SID}`).set(flag('someone-else')));
      await assertFails(db.doc(`student_8q_case_flags/${SID}`).set(flag('guid-uid', { extra: 1 })));
    });
  });

  // ═════════ บันทึกแจ้งผู้ปกครอง ═════════
  describe('parent notice log', () => {
    const notice = (uid: string, over: Record<string, unknown> = {}) => ({ scope: 'NINE_Q', screeningId: '9q-1', notifiedByUid: uid, notifiedByName: 'ครู', notifiedAt: '2026-10-05T10:00', method: 'PHONE', ...over });

    it('GUIDANCE and the homeroom teacher of that room can log a 9Q notice (as themselves); nobody else can; the student cannot read or write', async () => {
      await seed('ACTIVE');
      await assertSucceeds(guidance().doc(`student_screening_notices/${SID}/entries/n1`).set(notice('guid-uid')));
      await assertSucceeds(homeroom().doc(`student_screening_notices/${SID}/entries/n2`).set(notice('hr-uid', { method: 'IN_PERSON', note: 'พบผู้ปกครองที่โรงเรียน' })));
      await assertFails(homeroom().doc(`student_screening_notices/${SID}/entries/n3`).set(notice('guid-uid')));
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
