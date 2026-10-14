import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as path from 'path';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { collection, deleteField, getDocs, query, where, doc as mDoc, setDoc as mSetDoc, updateDoc as mUpdateDoc, deleteDoc as mDeleteDoc, getDoc as mGetDoc, serverTimestamp as mServerTimestamp, writeBatch as mWriteBatch } from 'firebase/firestore';
import { enrollInActivity, withdrawFromActivity, createBillingInvoice, createBillingInvoicesBulk, recordInfirmaryVisit, createParentNotification } from '../services/firestoreService';
import { readSource } from './helpers/readSource';

let testEnv: RulesTestEnvironment;

// ใช้ FIRESTORE_EMULATOR_HOST ที่ `firebase emulators:exec` ตั้งให้ (npm run emulators:exec /
// emulators:exec:isolated) เท่านั้น — ไม่มี = ไม่มี emulator (เช่น `npm test` เฉยๆ) → skip ทั้ง suite
// แทนที่จะ fail ด้วย "fetch failed" (และไม่ยิงไปที่ :8080 ซึ่งอาจเป็น emulator dev ที่มีข้อมูลอยู่)
const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST;
const SKIP_REASON = 'ไม่มี FIRESTORE_EMULATOR_HOST — Firestore rules tests ต้องรันบน emulator จริง: npm run emulators:exec (หรือ emulators:exec:isolated)';
const [EMU_HOST, EMU_PORT] = (EMULATOR_HOST || ':').split(':');

describe.runIf(!EMULATOR_HOST)('Firestore Security Rules (skipped)', () => {
  it.skip(SKIP_REASON, () => {});
});
if (!EMULATOR_HOST) console.warn(`[firestore.rules.test] SKIPPED: ${SKIP_REASON}`);

beforeAll(async () => {
  if (!EMULATOR_HOST) return;
  testEnv = await initializeTestEnvironment({
    projectId: 'kiattisak-project-001',
    firestore: {
      rules: readSource(path.resolve(__dirname, '../../firestore.rules')),
      host: EMU_HOST,
      port: Number(EMU_PORT),
    },
  });
});

afterAll(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

beforeEach(async () => {
  if (!EMULATOR_HOST) return;
  await testEnv.clearFirestore();
});

function asRole(...roles: string[]) {
  return testEnv.authenticatedContext('test-uid', { roles });
}

function asUser(uid: string, roles: string[] = [], extraClaims: Record<string, unknown> = {}) {
  return testEnv.authenticatedContext(uid, { roles, ...extraClaims });
}

function asAnonymous() {
  return testEnv.unauthenticatedContext();
}

describe.skipIf(!EMULATOR_HOST)('Firestore Security Rules Engine Unit Tests', () => {
  // 1. students collection
  describe('students collection', () => {
    it('allows SUPER_ADMIN, EXECUTIVE, HOMEROOM_TEACHER, and SUBJECT_TEACHER to read', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('students/std-101').set({ name: 'Somchai', parentUid: 'parent-101' });
      });

      await assertSucceeds(asRole('SUPER_ADMIN').firestore().doc('students/std-101').get());
      await assertSucceeds(asRole('EXECUTIVE').firestore().doc('students/std-101').get());
      await assertSucceeds(asRole('HOMEROOM_TEACHER').firestore().doc('students/std-101').get());
      await assertSucceeds(asRole('SUBJECT_TEACHER').firestore().doc('students/std-101').get());
    });

    it('allows a linked parent (parentUid matching auth.uid) to read student record', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('students/std-101').set({ name: 'Somchai', parentUid: 'parent-alice' });
      });

      const parentDb = asUser('parent-alice', ['PARENT']).firestore();
      await assertSucceeds(parentDb.doc('students/std-101').get());
    });

    it('denies an unlinked parent from reading another student record', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('students/std-101').set({ name: 'Somchai', parentUid: 'parent-alice' });
      });

      const otherParentDb = asUser('parent-bob', ['PARENT']).firestore();
      await assertFails(otherParentDb.doc('students/std-101').get());
    });

    it('denies unauthenticated access to students', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('students/std-101').set({ name: 'Somchai', parentUid: 'parent-alice' });
      });

      await assertFails(asAnonymous().firestore().doc('students/std-101').get());
    });

    it('allows SUPER_ADMIN and HOMEROOM_TEACHER to write to students', async () => {
      await assertSucceeds(
        asRole('SUPER_ADMIN').firestore().doc('students/std-new').set({ name: 'New Student' })
      );
      await assertSucceeds(
        asRole('HOMEROOM_TEACHER').firestore().doc('students/std-new-2').set({ name: 'New Student 2' })
      );
    });

    // Regression Test 1: A SUBJECT_TEACHER cannot write to students
    it('REGRESSION: denies a SUBJECT_TEACHER (not SUPER_ADMIN/HOMEROOM_TEACHER) from writing to students', async () => {
      await assertFails(
        asRole('SUBJECT_TEACHER').firestore().doc('students/std-bad-write').set({ name: 'Illegal Write' })
      );
    });

    // ครูผู้สอน sync ยอดสถิติเข้าเรียน (รวม + รายวิชา) ได้ แต่แตะ field อื่นของนักเรียนไม่ได้
    it('SUBJECT_TEACHER อัปเดตได้เฉพาะ attendanceStats / courseAttendanceStats ของนักเรียน', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('students/std-att').set({ studentId: 'std-att', name: 'สถิติ', parentUid: 'p-att', studentUid: 's-att' });
      });
      const ref = () => asRole('SUBJECT_TEACHER').firestore().doc('students/std-att');
      await assertSucceeds(ref().update({ 'attendanceStats.present': 1, attendanceStatsUpdatedAt: new Date() }));
      await assertSucceeds(ref().update({ 'courseAttendanceStats.ค32102.present': 1, 'courseAttendanceStats.ค32102.code': 'ค32102' }));
      await assertFails(ref().update({ name: 'แก้ชื่อ' }));
      await assertFails(ref().update({ behaviorScore: 0 }));
      await assertFails(ref().update({ 'attendanceStats.present': 1, parentUid: 'evil' }));
      // นักเรียน/ผู้ปกครองแก้สถิติตัวเองไม่ได้
      await assertFails(asUser('s-att', ['STUDENT']).firestore().doc('students/std-att').update({ 'courseAttendanceStats.x.present': 99 }));
      await assertFails(asUser('p-att', ['PARENT']).firestore().doc('students/std-att').update({ 'attendanceStats.present': 99 }));
    });

    // นักเรียนห้ามลบถาวร — เปลี่ยนสถานะแทน (students: allow delete: if false)
    it('ครูที่ปรึกษาแก้ทะเบียนนักเรียนตรง ๆ ไม่ได้ (parentUid/คะแนนความประพฤติ/ห้อง/สถานะ/โปรไฟล์) — ได้แค่แคชสถิติเช็คชื่อ', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await db.doc('students/std-hr1').set({ studentId: 'std-hr1', name: 'ในห้อง', room: 'ม.3/1', behaviorScore: 100, parentUid: 'real-parent' });
        await db.doc('staff/hr-t1').set({ firstName: 'ครู', lastName: 'ประจำชั้น', roles: ['HOMEROOM_TEACHER'], assignments: { homeroomClass: 'ม.3/1' } });
      });
      const hr = asUser('uid-hr-t1', ['HOMEROOM_TEACHER'], { staffId: 'hr-t1' }).firestore();
      const own = () => hr.doc('students/std-hr1');
      await assertFails(own().update({ parentUid: 'attacker-uid', parentId: 'attacker-uid' })); // เชื่อมบัญชีผู้ปกครองเอง = ช่องโหว่เดิม
      await assertFails(own().update({ behaviorScore: 0 })); // ต้องผ่านระบบ conduct_entries
      await assertFails(own().update({ riskLevel: 'NORMAL', conductDeducted: 0 }));
      await assertFails(own().update({ room: 'ม.3/2' }));
      await assertFails(own().update({ status: 'INACTIVE', statusReason: 'GRADUATED' }));
      await assertFails(own().update({ nickname: 'x', photoUrl: 'https://x/y.jpg', updatedAt: new Date() })); // นักเรียนกรอกเอง ครูไม่แก้
      await assertSucceeds(own().update({ 'attendanceStats.present': 1, attendanceStatsUpdatedAt: new Date() })); // เช็คชื่อโฮมรูม
      // SUPER_ADMIN ยังเชื่อมบัญชีผู้ปกครองได้
      await assertSucceeds(asRole('SUPER_ADMIN').firestore().doc('students/std-hr1').update({ parentUid: 'linked-by-admin' }));
    });

    it('DELETE students: ปฏิเสธทุกบทบาท แม้ SUPER_ADMIN / HOMEROOM_TEACHER และเอกสารยังอยู่', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('students/std-del').set({ studentId: 'std-del', name: 'ลบไม่ได้', parentUid: 'parent-del', studentUid: 'stu-del' });
      });
      await assertFails(asRole('SUPER_ADMIN').firestore().doc('students/std-del').delete());
      await assertFails(asRole('HOMEROOM_TEACHER').firestore().doc('students/std-del').delete());
      await assertFails(asRole('SUBJECT_TEACHER').firestore().doc('students/std-del').delete());
      await assertFails(asUser('parent-del', ['PARENT']).firestore().doc('students/std-del').delete());
      await assertFails(asUser('stu-del', ['STUDENT']).firestore().doc('students/std-del').delete());
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const snap = await ctx.firestore().doc('students/std-del').get();
        expect(snap.exists).toBe(true);
      });
    });

    it('SUPER_ADMIN เปลี่ยนสถานะนักเรียนได้ (update status/statusReason/statusNote)', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('students/std-st').set({ studentId: 'std-st', name: 'A', status: 'ACTIVE' });
      });
      await assertSucceeds(asRole('SUPER_ADMIN').firestore().doc('students/std-st').update({
        status: 'INACTIVE', statusReason: 'WITHDRAWN', statusNote: 'ลาออก', statusChangedBy: 'test-uid',
      }));
    });

    // TASK 1: staff roles ที่ต้องใช้ทะเบียนนักเรียนทั้งโรงเรียน (แนะแนว/พยาบาล/การเงิน/ศึกษานิเทศก์)
    it('allows GUIDANCE_COUNSELOR / INFIRMARY_STAFF / FINANCE_STAFF / INSTRUCTIONAL_SUPERVISOR to LIST students', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('students/s1').set({ name: 'A', parentUid: 'p1' });
        await ctx.firestore().doc('students/s2').set({ name: 'B' }); // ไม่มี parentUid — ทดสอบว่า list ไม่ crash
      });
      for (const role of ['GUIDANCE_COUNSELOR', 'INFIRMARY_STAFF', 'FINANCE_STAFF', 'INSTRUCTIONAL_SUPERVISOR']) {
        await assertSucceeds(getDocs(collection(asRole(role).firestore(), 'students')));
      }
    });

    it('REGRESSION: a parent can LIST only their own children (query filtered by parentUid); unfiltered list denied', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('students/s1').set({ name: 'Child A', parentUid: 'parent-alice' });
        await ctx.firestore().doc('students/s2').set({ name: 'Other', parentUid: 'parent-bob' });
      });
      const parentDb = asUser('parent-alice', ['PARENT']).firestore();
      await assertSucceeds(getDocs(query(collection(parentDb, 'students'), where('parentUid', '==', 'parent-alice'))));
      await assertFails(getDocs(collection(parentDb, 'students')));
    });

    it('REGRESSION: a plain signed-in user with no relevant role cannot list students', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('students/s1').set({ name: 'A', parentUid: 'p1' });
      });
      await assertFails(getDocs(collection(asRole('SOME_OTHER_ROLE').firestore(), 'students')));
    });

    it('allows a STUDENT to read their own record (studentUid matching auth.uid)', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('students/std-self').set({ name: 'Me', studentUid: 'stu-uid-1' });
      });
      const studentDb = asUser('stu-uid-1', ['STUDENT']).firestore();
      await assertSucceeds(studentDb.doc('students/std-self').get());
    });

    it('denies a STUDENT reading another student record', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('students/std-other').set({ name: 'Someone Else', studentUid: 'stu-uid-2' });
      });
      const studentDb = asUser('stu-uid-1', ['STUDENT']).firestore();
      await assertFails(studentDb.doc('students/std-other').get());
    });

    it('REGRESSION: a STUDENT can LIST only their own record (query filtered by studentUid); unfiltered list denied', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('students/s1').set({ name: 'Me', studentUid: 'stu-uid-1' });
        await ctx.firestore().doc('students/s2').set({ name: 'Other', studentUid: 'stu-uid-2' });
      });
      const studentDb = asUser('stu-uid-1', ['STUDENT']).firestore();
      await assertSucceeds(getDocs(query(collection(studentDb, 'students'), where('studentUid', '==', 'stu-uid-1'))));
      await assertFails(getDocs(collection(studentDb, 'students')));
    });

    // TASK (รูปโปรไฟล์นักเรียน): นักเรียนแก้ photoUrl ของตัวเองได้ แต่แก้ field อื่นไม่ได้
    it('allows a STUDENT to update ONLY photoUrl / photoUpdatedAt on their own record', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('students/69501').set({ studentId: '69501', studentUid: 'stu-uid-1', name: 'Me', photoUrl: 'old.jpg' });
      });
      const studentDb = asUser('stu-uid-1', ['STUDENT']).firestore();
      await assertSucceeds(studentDb.doc('students/69501').update({ photoUrl: 'new.jpg', photoUpdatedAt: '2026-09-10T00:00:00Z' }));
      // แก้ field อื่นพ่วงมาด้วย → ปฏิเสธ
      await assertFails(studentDb.doc('students/69501').update({ photoUrl: 'x.jpg', name: 'Hacked' }));
      await assertFails(studentDb.doc('students/69501').update({ behaviorScore: 0 }));
    });

    it('denies a STUDENT updating another student photoUrl, and denies create/delete', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('students/69502').set({ studentId: '69502', studentUid: 'stu-uid-2', name: 'Other', photoUrl: 'o.jpg' });
      });
      const studentDb = asUser('stu-uid-1', ['STUDENT']).firestore();
      await assertFails(studentDb.doc('students/69502').update({ photoUrl: 'evil.jpg' }));
      await assertFails(studentDb.doc('students/69599').set({ studentId: '69599', studentUid: 'stu-uid-1', photoUrl: 'p.jpg' }));
      await assertFails(studentDb.doc('students/69502').delete());
    });
  });

  // ทะเบียนเลขประจำตัวนักเรียน (student_id_registry)
  describe('student_id_registry collection', () => {
    const entry = (over: object = {}) => ({ heldBy: 'สมชาย', from: '2024-05-15', to: null, reason: null, ...over });
    const seed = async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('student_id_registry/38501').set({ studentId: '38501', entries: [entry(), entry({ heldBy: 'สมศรี' })] });
      });
    };

    it('อ่านได้เฉพาะ SUPER_ADMIN / HOMEROOM_TEACHER; ครู/ผู้ปกครอง/นักเรียน/ผู้ไม่ล็อกอินอ่านไม่ได้', async () => {
      await seed();
      await assertSucceeds(asRole('SUPER_ADMIN').firestore().doc('student_id_registry/38501').get());
      await assertSucceeds(asRole('HOMEROOM_TEACHER').firestore().doc('student_id_registry/38501').get());
      await assertFails(asRole('SUBJECT_TEACHER').firestore().doc('student_id_registry/38501').get());
      await assertFails(asRole('GUIDANCE_COUNSELOR').firestore().doc('student_id_registry/38501').get());
      await assertFails(asUser('p1', ['PARENT']).firestore().doc('student_id_registry/38501').get());
      await assertFails(asUser('s1', ['STUDENT']).firestore().doc('student_id_registry/38501').get());
      await assertFails(asAnonymous().firestore().doc('student_id_registry/38501').get());
    });

    it('สร้างได้เมื่อ studentId ตรงกับ id เอกสารและ entries เป็น list เท่านั้น', async () => {
      const db = asRole('SUPER_ADMIN').firestore();
      await assertSucceeds(db.doc('student_id_registry/40001').set({ studentId: '40001', entries: [entry()] }));
      await assertFails(db.doc('student_id_registry/40002').set({ studentId: '99999', entries: [entry()] }));
      await assertFails(db.doc('student_id_registry/40003').set({ studentId: '40003', entries: 'x' }));
      await assertFails(asRole('SUBJECT_TEACHER').firestore().doc('student_id_registry/40004').set({ studentId: '40004', entries: [] }));
    });

    it('แก้ได้เฉพาะคงจำนวน/เพิ่มประวัติ — ทำให้ประวัติสั้นลงไม่ได้ และเปลี่ยน studentId ไม่ได้', async () => {
      await seed();
      const ref = asRole('SUPER_ADMIN').firestore().doc('student_id_registry/38501');
      await assertSucceeds(ref.update({ entries: [entry({ to: '2025-01-01', reason: 'WITHDRAWN' }), entry({ heldBy: 'สมศรี' })] })); // ปิดรายการ (ขนาดเท่าเดิม)
      await assertSucceeds(ref.update({ entries: [entry(), entry(), entry({ heldBy: 'คนใหม่' })] })); // เพิ่มผู้ถือใหม่
      await assertFails(ref.update({ entries: [entry()] }));            // ลบประวัติ
      await assertFails(ref.update({ entries: [] }));
      await assertFails(ref.update({ studentId: '99999' }));
    });

    it('ห้ามลบเอกสารทะเบียนทุกบทบาท', async () => {
      await seed();
      await assertFails(asRole('SUPER_ADMIN').firestore().doc('student_id_registry/38501').delete());
      await assertFails(asRole('HOMEROOM_TEACHER').firestore().doc('student_id_registry/38501').delete());
    });

    it('archived_records: เพิ่มได้อย่างเดียว ห้ามแก้/ลบ และอ่านได้เฉพาะแอดมิน/ครูประจำชั้น', async () => {
      await seed();
      const db = asRole('SUPER_ADMIN').firestore();
      await assertSucceeds(db.doc('student_id_registry/38501/archived_records/1').set({ record: { name: 'เก่า' } }));
      await assertFails(db.doc('student_id_registry/38501/archived_records/1').update({ record: {} }));
      await assertFails(db.doc('student_id_registry/38501/archived_records/1').delete());
      await assertSucceeds(db.doc('student_id_registry/38501/archived_records/1').get());
      await assertFails(asRole('SUBJECT_TEACHER').firestore().doc('student_id_registry/38501/archived_records/1').get());
      await assertFails(asRole('SUBJECT_TEACHER').firestore().doc('student_id_registry/38501/archived_records/2').set({ record: {} }));
    });
  });

  // 2. student_self_assessments (PHQ-9, SDQ)
  describe('student_self_assessments collection', () => {
    it('allows GUIDANCE_COUNSELOR and SUPER_ADMIN to read', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('student_self_assessments/assess-01').set({ studentUid: 'std-uid-1', score: 9 });
      });

      await assertSucceeds(asRole('GUIDANCE_COUNSELOR').firestore().doc('student_self_assessments/assess-01').get());
      await assertSucceeds(asRole('SUPER_ADMIN').firestore().doc('student_self_assessments/assess-01').get());
    });

    it('allows the student self to read their own self-assessment', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('student_self_assessments/assess-01').set({ studentUid: 'std-uid-1', score: 9 });
      });

      const studentDb = asUser('std-uid-1', ['STUDENT']).firestore();
      await assertSucceeds(studentDb.doc('student_self_assessments/assess-01').get());
    });

    it('denies a SUBJECT_TEACHER from reading student self assessments', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('student_self_assessments/assess-01').set({ studentUid: 'std-uid-1', score: 9 });
      });

      await assertFails(asRole('SUBJECT_TEACHER').firestore().doc('student_self_assessments/assess-01').get());
    });

    it('TASK 9 (ExecutivePortal Learner Analytics): EXECUTIVE role อ่านได้ทั้งโรงเรียน (สรุปกราฟ/เปอร์เซ็นต์ ไม่โชว์รายบุคคล)', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('student_self_assessments/assess-01').set({ studentUid: 'std-uid-1', score: 9 });
      });

      await assertSucceeds(asRole('EXECUTIVE').firestore().doc('student_self_assessments/assess-01').get());
    });

    it('GUIDANCE_COUNSELOR เขียนได้; นักเรียนเจ้าของ (ผ่าน students.studentUid) เขียนของตัวเองได้ถ้า homeroomClass ตรง students.room', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('students/10001').set({ studentId: '10001', room: 'ม.5/8', studentUid: 'stu-1', parentUid: 'par-1' });
      });
      await assertSucceeds(
        asRole('GUIDANCE_COUNSELOR').firestore().doc('student_self_assessments/assess-g').set({ score: 10 })
      );
      const stu = asUser('stu-1', ['STUDENT'], { studentId: '10001' }).firestore();
      const ok = { studentId: '10001', studentUid: 'stu-1', homeroomClass: 'ม.5/8', isCompleted: true };
      await assertSucceeds(stu.doc('student_self_assessments/10001').get()); // ยังไม่มีเอกสารก็อ่านได้
      await assertSucceeds(stu.doc('student_self_assessments/10001').set(ok));
      await assertSucceeds(stu.doc('student_self_assessments/10001').get());
      await assertSucceeds(stu.doc('student_self_assessments/10001').set({ ...ok, familyBackground: { livingWith: 'บิดาและมารดา' } }, { merge: true }));
      // ปฏิเสธ: เขียนแทนคนอื่น / ห้องไม่ตรง / uid = รหัสนักเรียนเดิม (ช่องโหว่/บั๊กรุ่นเก่า) / ลบ
      await assertFails(stu.doc('student_self_assessments/10002').set({ ...ok, studentId: '10002' }));
      await assertFails(stu.doc('student_self_assessments/10001').set({ ...ok, homeroomClass: 'ม.6/1' }));
      await assertFails(asUser('student-me').firestore().doc('student_self_assessments/student-me').set({ score: 12 }));
      await assertFails(stu.doc('student_self_assessments/10001').delete());
      await assertFails(asUser('par-1', ['PARENT']).firestore().doc('student_self_assessments/10001').get());
    });

    it('ครูที่ปรึกษาอ่านแบบประเมินของห้องตัวเองได้ (query ตาม homeroomClass) ห้องอื่น/ครูวิชาอ่านไม่ได้', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('staff/teacher-07').set({ roles: ['HOMEROOM_TEACHER'], assignments: { homeroomClass: 'ม.5/8' } });
        await ctx.firestore().doc('staff/teacher-08').set({ roles: ['HOMEROOM_TEACHER'], assignments: { homeroomClass: 'ม.6/1' } });
        await ctx.firestore().doc('student_self_assessments/10001').set({ studentId: '10001', homeroomClass: 'ม.5/8', isCompleted: true });
      });
      const hr = asUser('hr-uid-1', ['HOMEROOM_TEACHER'], { staffId: 'teacher-07' }).firestore();
      await assertSucceeds(hr.doc('student_self_assessments/10001').get());
      await assertSucceeds(hr.collection('student_self_assessments').where('homeroomClass', '==', 'ม.5/8').get());
      await assertFails(hr.doc('student_self_assessments/10001').update({ isCompleted: false }));
      const other = asUser('hr-uid-2', ['HOMEROOM_TEACHER'], { staffId: 'teacher-08' }).firestore();
      await assertFails(other.doc('student_self_assessments/10001').get());
    });

  });

  // 3. discipline_logs
  describe('discipline_logs collection', () => {
    it('allows HOMEROOM_TEACHER, EXECUTIVE, GUIDANCE_COUNSELOR, SUPER_ADMIN to read', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('discipline_logs/log-01').set({ studentId: 'std-101', points: -5 });
      });

      await assertSucceeds(asRole('HOMEROOM_TEACHER').firestore().doc('discipline_logs/log-01').get());
      await assertSucceeds(asRole('EXECUTIVE').firestore().doc('discipline_logs/log-01').get());
      await assertSucceeds(asRole('GUIDANCE_COUNSELOR').firestore().doc('discipline_logs/log-01').get());
      await assertSucceeds(asRole('SUPER_ADMIN').firestore().doc('discipline_logs/log-01').get());
    });

    it('denies unassigned roles and parents from reading discipline logs', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('discipline_logs/log-01').set({ studentId: 'std-101', points: -5 });
      });

      await assertFails(asRole('PARENT').firestore().doc('discipline_logs/log-01').get());
      await assertFails(asAnonymous().firestore().doc('discipline_logs/log-01').get());
    });

    it('lets a student / parent read only logs carrying their own uid; never other children\'s or uid-less old logs', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('discipline_logs/mine').set({ studentId: 'std-101', studentUid: 'stu-uid-1', parentUid: 'par-uid-1', points: -5 });
        await ctx.firestore().doc('discipline_logs/other').set({ studentId: 'std-102', studentUid: 'stu-uid-2', parentUid: 'par-uid-2', points: -5 });
        await ctx.firestore().doc('discipline_logs/old').set({ studentId: 'std-101', points: -5 });
        await ctx.firestore().doc('discipline_logs/nullparent').set({ studentId: 'std-103', studentUid: 'stu-uid-3', parentUid: null, points: 5 });
      });
      await assertSucceeds(asUser('stu-uid-1', ['STUDENT']).firestore().doc('discipline_logs/mine').get());
      await assertSucceeds(asUser('par-uid-1', ['PARENT']).firestore().doc('discipline_logs/mine').get());
      await assertFails(asUser('stu-uid-1', ['STUDENT']).firestore().doc('discipline_logs/other').get());
      await assertFails(asUser('par-uid-1', ['PARENT']).firestore().doc('discipline_logs/other').get());
      await assertFails(asUser('stu-uid-1', ['STUDENT']).firestore().doc('discipline_logs/old').get());
      // parentUid เป็น null ต้องไม่ match ผู้ใช้ใดๆ (กัน null == null)
      await assertFails(asUser('par-uid-9', ['PARENT']).firestore().doc('discipline_logs/nullparent').get());
      // และเขียนเองไม่ได้
      await assertFails(asUser('stu-uid-1', ['STUDENT']).firestore().doc('discipline_logs/x').set({ studentId: 'std-101', studentUid: 'stu-uid-1', points: 50 }));
    });

    it('allows SUBJECT_TEACHER, HOMEROOM_TEACHER, SUPER_ADMIN to write discipline logs', async () => {
      await assertSucceeds(
        asRole('SUBJECT_TEACHER').firestore().doc('discipline_logs/log-new-1').set({ studentId: 'std-101', points: -2 })
      );
      await assertSucceeds(
        asRole('HOMEROOM_TEACHER').firestore().doc('discipline_logs/log-new-2').set({ studentId: 'std-101', points: -3 })
      );
    });

    it('denies parents and unauthenticated users from writing discipline logs', async () => {
      await assertFails(
        asRole('PARENT').firestore().doc('discipline_logs/log-new-3').set({ points: 100 })
      );
      await assertFails(
        asAnonymous().firestore().doc('discipline_logs/log-new-4').set({ points: 100 })
      );
    });
  });

  // 4. parent_notifications
  describe('parent_notifications collection', () => {
    it('allows linked parent to read their notifications and HOMEROOM_TEACHER to read all', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('parent_notifications/notif-01').set({ parentUid: 'parent-alice', message: 'Hello' });
      });

      await assertSucceeds(asUser('parent-alice', ['PARENT']).firestore().doc('parent_notifications/notif-01').get());
      await assertSucceeds(asRole('HOMEROOM_TEACHER').firestore().doc('parent_notifications/notif-01').get());
    });

    it('denies a different parent from reading notifications intended for another parent', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('parent_notifications/notif-01').set({ parentUid: 'parent-alice', message: 'Hello' });
      });

      await assertFails(asUser('parent-bob', ['PARENT']).firestore().doc('parent_notifications/notif-01').get());
    });

    it('allows SUBJECT_TEACHER and HOMEROOM_TEACHER to write parent notifications', async () => {
      await assertSucceeds(
        asRole('SUBJECT_TEACHER').firestore().doc('parent_notifications/notif-new-1').set({ parentUid: 'parent-alice', msg: 'Update' })
      );
      await assertSucceeds(
        asRole('HOMEROOM_TEACHER').firestore().doc('parent_notifications/notif-new-2').set({ parentUid: 'parent-alice', msg: 'Update 2' })
      );
    });
  });

  // 5. parent_conferences
  describe('parent_conferences collection', () => {
    it('allows HOMEROOM_TEACHER and SUPER_ADMIN to read and write parent conferences', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('parent_conferences/conf-01').set({ parentUid: 'parent-alice', topic: 'Academic Review' });
      });

      await assertSucceeds(asRole('HOMEROOM_TEACHER').firestore().doc('parent_conferences/conf-01').get());
      await assertSucceeds(asRole('SUPER_ADMIN').firestore().doc('parent_conferences/conf-01').get());
      await assertSucceeds(
        asRole('HOMEROOM_TEACHER').firestore().doc('parent_conferences/conf-new').set({ topic: 'Discussion' })
      );
    });

    // Regression Test 4: A parent can read a parent_conferences doc where they are the linked parent, and cannot read one for a different parent
    it('REGRESSION: allows linked parent to read parent_conferences and denies a different parent', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('parent_conferences/conf-01').set({ parentUid: 'parent-alice', topic: 'Behavior Progress' });
      });

      const linkedParentDb = asUser('parent-alice', ['PARENT']).firestore();
      const otherParentDb = asUser('parent-bob', ['PARENT']).firestore();

      await assertSucceeds(linkedParentDb.doc('parent_conferences/conf-01').get());
      await assertFails(otherParentDb.doc('parent_conferences/conf-01').get());
    });

    it('denies SUBJECT_TEACHER and PARENT from writing parent conferences', async () => {
      await assertFails(
        asRole('SUBJECT_TEACHER').firestore().doc('parent_conferences/conf-invalid').set({ topic: 'Denied' })
      );
      await assertFails(
        asRole('PARENT').firestore().doc('parent_conferences/conf-invalid').set({ topic: 'Denied' })
      );
    });
  });

  // 6. schedules
  describe('schedules collection', () => {
    it('allows any authenticated user to read schedules', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('schedules/sch-01').set({ classRoom: 'ม.5/8', subjectCode: 'ว30201' });
      });

      await assertSucceeds(asRole('SUBJECT_TEACHER').firestore().doc('schedules/sch-01').get());
      await assertSucceeds(asRole('PARENT').firestore().doc('schedules/sch-01').get());
      await assertSucceeds(asUser('student-001', ['STUDENT']).firestore().doc('schedules/sch-01').get());
    });

    // Regression Test 2 (part): An unauthenticated context cannot read schedules
    it('REGRESSION: denies unauthenticated context from reading schedules', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('schedules/sch-01').set({ classRoom: 'ม.5/8' });
      });

      await assertFails(asAnonymous().firestore().doc('schedules/sch-01').get());
    });

    it('allows SUBJECT_TEACHER, HOMEROOM_TEACHER, and SUPER_ADMIN to write schedules', async () => {
      await assertSucceeds(
        asRole('SUBJECT_TEACHER').firestore().doc('schedules/sch-new-1').set({ classRoom: 'ม.5/8' })
      );
      await assertSucceeds(
        asRole('SUPER_ADMIN').firestore().doc('schedules/sch-new-2').set({ classRoom: 'ม.5/8' })
      );
    });
  });

  // 7. attendance_records
  describe('attendance_records collection', () => {
    it('allows SUBJECT_TEACHER, EXECUTIVE, and HOMEROOM_TEACHER to read and write attendance', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('attendance_records/att-01').set({ parentUid: 'parent-alice', status: 'present' });
      });

      await assertSucceeds(asRole('SUBJECT_TEACHER').firestore().doc('attendance_records/att-01').get());
      await assertSucceeds(asRole('EXECUTIVE').firestore().doc('attendance_records/att-01').get());
      await assertSucceeds(
        asRole('SUBJECT_TEACHER').firestore().doc('attendance_records/att-new').set({ status: 'present' })
      );
    });

    // Regression Test 3 (part): A parent whose parentUid matches student's parentUid can read attendance; different parent cannot
    it('REGRESSION: allows linked parent to read attendance_records and denies different parent', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('attendance_records/att-01').set({ parentUid: 'parent-alice', status: 'present' });
      });

      const linkedParent = asUser('parent-alice', ['PARENT']).firestore();
      const otherParent = asUser('parent-bob', ['PARENT']).firestore();

      await assertSucceeds(linkedParent.doc('attendance_records/att-01').get());
      await assertFails(otherParent.doc('attendance_records/att-01').get());
    });

    it('denies unauthenticated context from reading attendance_records', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('attendance_records/att-01').set({ parentUid: 'parent-alice', status: 'present' });
      });

      await assertFails(asAnonymous().firestore().doc('attendance_records/att-01').get());
    });
  });

  // 8. gradebook_scores
  describe('gradebook_scores collection', () => {
    it('allows SUBJECT_TEACHER, HEAD_OF_DEPARTMENT, and EXECUTIVE to read and write gradebook_scores', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('gradebook_scores/score-01').set({ parentUid: 'parent-alice', score: 85 });
      });

      await assertSucceeds(asRole('SUBJECT_TEACHER').firestore().doc('gradebook_scores/score-01').get());
      await assertSucceeds(asRole('HEAD_OF_DEPARTMENT').firestore().doc('gradebook_scores/score-01').get());
      await assertSucceeds(
        asRole('HEAD_OF_DEPARTMENT').firestore().doc('gradebook_scores/score-new').set({ score: 90 })
      );
    });

    // Regression Test 3 (part): A parent whose parentUid matches can read gradebook_scores; different parent cannot
    it('REGRESSION: allows linked parent to read gradebook_scores and denies different parent', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('gradebook_scores/score-01').set({ parentUid: 'parent-alice', score: 85 });
      });

      const linkedParent = asUser('parent-alice', ['PARENT']).firestore();
      const otherParent = asUser('parent-bob', ['PARENT']).firestore();

      await assertSucceeds(linkedParent.doc('gradebook_scores/score-01').get());
      await assertFails(otherParent.doc('gradebook_scores/score-01').get());
    });

    it('นักเรียนเจ้าของ/ผู้ปกครองตัวจริง (ตามทะเบียน students) อ่านคะแนนของตัวเองได้ด้วย query studentId; คนอื่น/นักเรียนต่างคนอ่านไม่ได้', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await db.doc('students/11111').set({ studentId: '11111', studentUid: 'stu-uid-11111', parentUid: 'par-uid-11111' });
        await db.doc('students/22222').set({ studentId: '22222', studentUid: 'stu-uid-22222', parentUid: 'par-uid-22222' });
        await db.doc('gradebook_scores/SCORE_ท23101_ม.3_11111_1-2569').set({ courseCode: 'ท23101', className: 'ม.3/1', studentId: '11111', term: '1/2569', total: 76, grade: '3.5' });
        await db.doc('gradebook_scores/SCORE_ท23101_ม.3_22222_1-2569').set({ courseCode: 'ท23101', className: 'ม.3/1', studentId: '22222', term: '1/2569', total: 90, grade: '4' });
      });
      const col = (c: any) => collection(c, 'gradebook_scores');
      const stu1 = asUser('stu-uid-11111', ['STUDENT']).firestore();
      const par1 = asUser('par-uid-11111', ['PARENT']).firestore();
      await assertSucceeds(getDocs(query(col(stu1), where('studentId', '==', '11111'))));
      await assertSucceeds(getDocs(query(col(par1), where('studentId', '==', '11111'))));
      await assertFails(getDocs(query(col(stu1), where('studentId', '==', '22222'))));
      await assertFails(getDocs(query(col(par1), where('studentId', '==', '22222'))));
      await assertFails(getDocs(col(stu1))); // ไม่กรอง studentId = อ่านทั้งคอลเลกชันไม่ได้
      // เขียนไม่ได้ทั้งนักเรียนและผู้ปกครอง
      await assertFails(mSetDoc(mDoc(stu1, 'gradebook_scores/x1'), { studentId: '11111', total: 100 }));
      await assertFails(mSetDoc(mDoc(par1, 'gradebook_scores/x2'), { studentId: '11111', total: 100 }));
    });

    it('denies unauthenticated context from reading gradebook_scores', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('gradebook_scores/score-01').set({ score: 85 });
      });

      await assertFails(asAnonymous().firestore().doc('gradebook_scores/score-01').get());
    });
  });

  // 8.1 gradebook_hidden_courses (TASK 3 — คาบกิจกรรมที่ไม่ต้องประเมิน ครูซ่อนเป็นรายบุคคล)
  describe('gradebook_hidden_courses collection', () => {
    it('allows a teacher to hide (create) and unhide (delete) their own course', async () => {
      const teacher = asUser('teacher-uid-1', ['SUBJECT_TEACHER']).firestore();
      await assertSucceeds(
        teacher.doc('gradebook_hidden_courses/teacher-uid-1_course-plc').set({
          teacherUid: 'teacher-uid-1', courseId: 'course-plc', courseName: 'PLC'
        })
      );
      await assertSucceeds(teacher.doc('gradebook_hidden_courses/teacher-uid-1_course-plc').delete());
    });

    it('denies creating a hidden-course doc under someone else\'s teacherUid (spoofing)', async () => {
      const teacher = asUser('teacher-uid-1', ['SUBJECT_TEACHER']).firestore();
      await assertFails(
        teacher.doc('gradebook_hidden_courses/teacher-uid-2_course-plc').set({
          teacherUid: 'teacher-uid-2', courseId: 'course-plc', courseName: 'PLC'
        })
      );
    });

    it('allows a teacher to list only their own hidden courses, not another teacher\'s', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('gradebook_hidden_courses/teacher-uid-1_course-plc').set({
          teacherUid: 'teacher-uid-1', courseId: 'course-plc', courseName: 'PLC'
        });
        await ctx.firestore().doc('gradebook_hidden_courses/teacher-uid-2_course-lunch').set({
          teacherUid: 'teacher-uid-2', courseId: 'course-lunch', courseName: 'พักกลางวัน'
        });
      });

      const teacher1 = asUser('teacher-uid-1', ['SUBJECT_TEACHER']).firestore();
      const ownSnap = await teacher1.collection('gradebook_hidden_courses').where('teacherUid', '==', 'teacher-uid-1').get();
      expect(ownSnap.size).toBe(1);

      await assertFails(
        teacher1.collection('gradebook_hidden_courses').where('teacherUid', '==', 'teacher-uid-2').get()
      );
    });

    it('denies unauthenticated access to gradebook_hidden_courses', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('gradebook_hidden_courses/teacher-uid-1_course-plc').set({
          teacherUid: 'teacher-uid-1', courseId: 'course-plc', courseName: 'PLC'
        });
      });
      await assertFails(asAnonymous().firestore().doc('gradebook_hidden_courses/teacher-uid-1_course-plc').get());
    });

    it('denies update (must delete + recreate instead — doc is effectively immutable once written)', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('gradebook_hidden_courses/teacher-uid-1_course-plc').set({
          teacherUid: 'teacher-uid-1', courseId: 'course-plc', courseName: 'PLC'
        });
      });
      const teacher = asUser('teacher-uid-1', ['SUBJECT_TEACHER']).firestore();
      await assertFails(teacher.doc('gradebook_hidden_courses/teacher-uid-1_course-plc').update({ courseName: 'changed' }));
    });
  });

  // 9. admin_periods_config
  describe('admin_periods_config collection', () => {
    it('allows any signed-in user to read admin_periods_config', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('admin_periods_config/config-01').set({ active: true });
      });

      await assertSucceeds(asRole('SUBJECT_TEACHER').firestore().doc('admin_periods_config/config-01').get());
      await assertSucceeds(asRole('HOMEROOM_TEACHER').firestore().doc('admin_periods_config/config-01').get());
    });

    it('denies unauthenticated context from reading admin_periods_config', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('admin_periods_config/config-01').set({ active: true });
      });

      await assertFails(asAnonymous().firestore().doc('admin_periods_config/config-01').get());
    });

    it('allows SUPER_ADMIN to write admin_periods_config and denies non-admin', async () => {
      await assertSucceeds(
        asRole('SUPER_ADMIN').firestore().doc('admin_periods_config/config-new').set({ active: true })
      );
      await assertFails(
        asRole('SUBJECT_TEACHER').firestore().doc('admin_periods_config/config-new-bad').set({ active: false })
      );
    });
  });

  // 10. school_settings
  describe('school_settings collection', () => {
    it('allows signed-in users to read school_settings', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('school_settings/periods_config').set({ name: 'Default Schedule' });
      });

      await assertSucceeds(asRole('SUBJECT_TEACHER').firestore().doc('school_settings/periods_config').get());
    });

    // Regression Test 2 (part): An unauthenticated context cannot read school_settings
    it('REGRESSION: denies unauthenticated context from reading school_settings', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('school_settings/periods_config').set({ name: 'Default Schedule' });
      });

      await assertFails(asAnonymous().firestore().doc('school_settings/periods_config').get());
    });

    it('allows SUPER_ADMIN to write school_settings and denies non-admin', async () => {
      await assertSucceeds(
        asRole('SUPER_ADMIN').firestore().doc('school_settings/periods_config').set({ name: 'Updated' })
      );
      await assertFails(
        asRole('SUBJECT_TEACHER').firestore().doc('school_settings/periods_config').set({ name: 'Hacked' })
      );
    });

    // school_settings/studentEmailFormat — รูปแบบอีเมลนักเรียน {prefix}{studentId}@{domain}
    describe('studentEmailFormat', () => {
      const PATH = 'school_settings/studentEmailFormat';
      const valid = { prefix: 'it', domain: 'utd.ac.th' };
      const admin = () => asRole('SUPER_ADMIN').firestore().doc(PATH);

      it('lets any signed-in user read it (client hook + staff pages), but not anonymous users', async () => {
        await testEnv.withSecurityRulesDisabled(async (ctx) => { await ctx.firestore().doc(PATH).set(valid); });
        for (const roles of [['SUBJECT_TEACHER'], ['STUDENT'], ['PARENT'], []]) {
          await assertSucceeds(asUser('some-uid', roles).firestore().doc(PATH).get());
        }
        await assertFails(asAnonymous().firestore().doc(PATH).get());
      });

      it('lets only SUPER_ADMIN write (create / update / delete)', async () => {
        await assertSucceeds(admin().set(valid));
        await assertSucceeds(admin().set({ prefix: 's', domain: 'student.utd.ac.th', updatedBy: 'uid-1' }));
        await assertSucceeds(admin().delete());

        await testEnv.withSecurityRulesDisabled(async (ctx) => { await ctx.firestore().doc(PATH).set(valid); });
        for (const role of ['HOMEROOM_TEACHER', 'SUBJECT_TEACHER', 'EXECUTIVE', 'DIRECTOR', 'ACADEMIC_HEAD', 'STUDENT', 'PARENT']) {
          const ref = asRole(role).firestore().doc(PATH);
          await assertFails(ref.set({ prefix: 'x', domain: 'evil.example.com' }));
          await assertFails(ref.update({ prefix: 'x' }));
          await assertFails(ref.delete());
        }
        await assertFails(asUser('no-roles', []).firestore().doc(PATH).set(valid));
        await assertFails(asAnonymous().firestore().doc(PATH).set(valid));
      });

      it('accepts an empty prefix and a multi-label domain; rejects malformed values even from SUPER_ADMIN', async () => {
        await assertSucceeds(admin().set({ prefix: '', domain: 'utd.ac.th' }));
        await assertSucceeds(admin().set({ prefix: 'stu_1.a-b', domain: 'a.b.example.co.th' }));

        for (const bad of [
          { prefix: 'IT', domain: 'utd.ac.th' },              // ตัวพิมพ์ใหญ่ (client sanitize เป็นตัวเล็กก่อนเขียนเสมอ)
          { prefix: 'it ', domain: 'utd.ac.th' },             // ช่องว่าง
          { prefix: 'a'.repeat(33), domain: 'utd.ac.th' },    // ยาวเกิน 32
          { prefix: 'it', domain: '@utd.ac.th' },             // มี @
          { prefix: 'it', domain: 'utd' },                    // ไม่มีจุด
          { prefix: 'it', domain: 'utd.ac.th/evil' },         // อักขระต้องห้าม
          { prefix: 'it', domain: '' },
          { prefix: 'it', domain: 'UTD.ac.th' },
          { prefix: 42, domain: 'utd.ac.th' },                // ไม่ใช่ string
          { prefix: 'it', domain: ['utd.ac.th'] },
          { prefix: 'it' },                                   // ขาด domain
          { domain: 'utd.ac.th' },                            // ขาด prefix
          { prefix: 'it', domain: 'utd.ac.th', role: 'x' },   // field แปลกปลอม
        ]) {
          await assertFails(admin().set(bad as Record<string, unknown>));
        }
        await testEnv.withSecurityRulesDisabled(async (ctx) => { await ctx.firestore().doc(PATH).set(valid); });
        await assertFails(admin().update({ domain: 'not a domain' }));
      });

      it('REGRESSION: the school_settings/{settingId} wildcard is not a way around the format check', async () => {
        // SUPER_ADMIN ยังเขียน school_settings อื่นได้อิสระ (wildcard เดิม) แต่เขียน studentEmailFormat ผ่านทางนั้นไม่ได้
        await assertSucceeds(asRole('SUPER_ADMIN').firestore().doc('school_settings/anything_else').set({ whatever: 1 }));
        await assertFails(admin().set({ prefix: 'IT', domain: 'x' }));
        await assertFails(admin().set({ anything: 'goes' }));
      });
    });

    // school_settings/billing_payment — บัญชี/พร้อมเพย์ที่โรงเรียนรับโอน (ผู้ปกครองสร้าง QR จากค่านี้)
    describe('billing_payment', () => {
      const PATH = 'school_settings/billing_payment';
      const valid = { promptPayType: 'PHONE', promptPayId: '0812345678', accountName: 'โรงเรียนอุตรดิตถ์', bankName: 'กรุงไทย', bankAccountNo: '123-4-56789-0', note: '' };
      const admin = () => asRole('SUPER_ADMIN').firestore().doc(PATH);

      it('lets any signed-in user read, not anonymous', async () => {
        await testEnv.withSecurityRulesDisabled(async (ctx) => { await ctx.firestore().doc(PATH).set(valid); });
        for (const roles of [['PARENT'], ['STUDENT'], ['SUBJECT_TEACHER'], []]) {
          await assertSucceeds(asUser('some-uid', roles).firestore().doc(PATH).get());
        }
        await assertFails(asAnonymous().firestore().doc(PATH).get());
      });

      it('lets only SUPER_ADMIN write', async () => {
        await assertSucceeds(admin().set(valid));
        await assertSucceeds(admin().set({ ...valid, promptPayType: 'NONE', promptPayId: '', updatedBy: 'uid-1' }));
        for (const role of ['FINANCE_STAFF', 'EXECUTIVE', 'SUBJECT_TEACHER', 'STUDENT', 'PARENT']) {
          await assertFails(asRole(role).firestore().doc(PATH).set(valid));
        }
        await assertFails(asAnonymous().firestore().doc(PATH).set(valid));
      });

      it('rejects malformed data even from SUPER_ADMIN', async () => {
        for (const bad of [
          { ...valid, promptPayId: '812345678' },                       // เบอร์ไม่ครบ/ไม่ขึ้นต้น 0
          { ...valid, promptPayType: 'NATIONAL_ID', promptPayId: '123' },
          { ...valid, promptPayType: 'EWALLET', promptPayId: '1'.repeat(14) },
          { ...valid, promptPayType: 'NONE', promptPayId: '0812345678' }, // NONE ต้องไม่มี id
          { ...valid, promptPayType: 'CARD' },
          { ...valid, note: 'x'.repeat(301) },
          { ...valid, accountName: 5 },
          { ...valid, extra: 'x' },
          { promptPayType: 'NONE', promptPayId: '' },                    // ขาด field
        ]) {
          await assertFails(admin().set(bad as Record<string, unknown>));
        }
      });

      it('REGRESSION: the school_settings wildcard is not a way around validation', async () => {
        await assertFails(admin().set({ anything: 'goes' }));
      });
    });
  });

  // 11. staff collection
  describe('staff collection', () => {
    it('allows signed-in users to read staff directory', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('staff/staff-001').set({ name: 'Teacher Sompong' });
      });

      await assertSucceeds(asRole('SUBJECT_TEACHER').firestore().doc('staff/staff-001').get());
    });

    // Regression Test 2 (part): An unauthenticated context cannot read staff
    it('REGRESSION: denies unauthenticated context from reading staff', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('staff/staff-001').set({ name: 'Teacher Sompong' });
      });

      await assertFails(asAnonymous().firestore().doc('staff/staff-001').get());
    });

    // ผู้ใช้ที่ signed-in แต่ไม่มี roles ใน claims (ไม่อยู่ในทะเบียน — blocking function ไม่ออก claims ให้)
    it('REGRESSION: denies a signed-in user with no roles claim from reading staff / teachers', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('staff/staff-001').set({ name: 'Teacher Sompong' });
        await ctx.firestore().doc('teachers/staff-001').set({ name: 'Teacher Sompong' });
      });
      const noRoleNoClaim = testEnv.authenticatedContext('outsider-uid').firestore();
      const noRoleEmpty = asUser('outsider-uid', []).firestore();
      for (const db of [noRoleNoClaim, noRoleEmpty]) {
        await assertFails(db.doc('staff/staff-001').get());
        await assertFails(getDocs(collection(db, 'staff')));
        await assertFails(db.doc('teachers/staff-001').get());
      }
      // primaryRole อย่างเดียวโดยไม่มี roles ก็ไม่พอ
      await assertFails(testEnv.authenticatedContext('outsider-uid', { primaryRole: 'SUBJECT_TEACHER' }).firestore().doc('staff/staff-001').get());
      // ส่วนผู้มี roles (รวมนักเรียน) ยังอ่านได้
      await assertSucceeds(asUser('stu-uid', ['STUDENT'], { studentId: '38501' }).firestore().doc('staff/staff-001').get());
    });

    // staff ที่ import จริงใช้ teacherId เป็น doc id (ไม่ใช่ Auth UID) — isHomeroomTeacherOf ต้องอ่านผ่าน claim staffId
    describe('isHomeroomTeacherOf via staffId claim', () => {
      const ROOM = 'ม.5/8';
      const TEACHER_ID = 'teacher-07';          // doc id จากไฟล์ import
      const TEACHER_UID = 'firebase-uid-xyz';    // Auth UID — ไม่เท่ากับ doc id
      beforeEach(async () => {
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
          await ctx.firestore().doc(`staff/${TEACHER_ID}`).set({ email: 'hr@utd.ac.th', roles: ['HOMEROOM_TEACHER'], assignments: { homeroomClass: ROOM } });
          await ctx.firestore().doc('student_home_locations/38501').set({ studentId: '38501', studentUid: 'stu-1', homeroomClass: ROOM, lat: 17.6, lng: 100.1 });
        });
      });

      it('lets the homeroom teacher through when claims.staffId = teacherId (doc keyed by teacherId, not uid)', async () => {
        await assertSucceeds(asUser(TEACHER_UID, ['HOMEROOM_TEACHER'], { staffId: TEACHER_ID }).firestore().doc('student_home_locations/38501').get());
      });

      it('REGRESSION: denies the same teacher without a staffId claim (no fallback to staff/{uid})', async () => {
        await assertFails(asUser(TEACHER_UID, ['HOMEROOM_TEACHER']).firestore().doc('student_home_locations/38501').get());
      });

      it('REGRESSION: denies a staffId claim pointing at a staff doc of a different room / a missing doc', async () => {
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
          await ctx.firestore().doc('staff/teacher-08').set({ roles: ['HOMEROOM_TEACHER'], assignments: { homeroomClass: 'ม.6/1' } });
        });
        await assertFails(asUser(TEACHER_UID, ['HOMEROOM_TEACHER'], { staffId: 'teacher-08' }).firestore().doc('student_home_locations/38501').get());
        await assertFails(asUser(TEACHER_UID, ['HOMEROOM_TEACHER'], { staffId: 'no-such-teacher' }).firestore().doc('student_home_locations/38501').get());
      });
    });

    it('allows SUPER_ADMIN to write to staff and denies non-admin', async () => {
      await assertSucceeds(
        asRole('SUPER_ADMIN').firestore().doc('staff/staff-new').set({ name: 'New Staff' })
      );
      await assertFails(
        asRole('HOMEROOM_TEACHER').firestore().doc('staff/staff-new').set({ name: 'Illegal Edit' })
      );
    });
  });

  // 12. teachers collection
  describe('teachers collection', () => {
    it('allows signed-in users to read teachers directory', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('teachers/tch-001').set({ name: 'Dr. Kiattisak' });
      });

      await assertSucceeds(asRole('SUBJECT_TEACHER').firestore().doc('teachers/tch-001').get());
    });

    // Regression Test 2 (part): An unauthenticated context cannot read teachers
    it('REGRESSION: denies unauthenticated context from reading teachers', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('teachers/tch-001').set({ name: 'Dr. Kiattisak' });
      });

      await assertFails(asAnonymous().firestore().doc('teachers/tch-001').get());
    });

    it('allows SUPER_ADMIN to write to teachers and denies non-admin', async () => {
      await assertSucceeds(
        asRole('SUPER_ADMIN').firestore().doc('teachers/tch-new').set({ name: 'New Teacher' })
      );
      await assertFails(
        asRole('SUBJECT_TEACHER').firestore().doc('teachers/tch-new').set({ name: 'Denied Edit' })
      );
    });
  });

  // 13. seating_layouts and subcollections (groups, seats)
  describe('seating_layouts collection & subcollections', () => {
    it('allows signed-in users to read seating layouts', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('seating_layouts/layout_m58').set({
          name: 'Physics M58',
          room: 'ม.5/8',
          totalCapacity: 40
        });
      });

      await assertSucceeds(asRole('SUBJECT_TEACHER').firestore().doc('seating_layouts/layout_m58').get());
      await assertSucceeds(asUser('student-101', ['STUDENT']).firestore().doc('seating_layouts/layout_m58').get());
      await assertFails(asAnonymous().firestore().doc('seating_layouts/layout_m58').get());
    });

    it('allows teachers and SUPER_ADMIN to create and update seating layouts and nested groups/seats', async () => {
      await assertSucceeds(
        asRole('SUBJECT_TEACHER').firestore().doc('seating_layouts/layout_new').set({
          name: 'New Layout',
          room: 'ม.5/8',
          category: 'CLASSROOM'
        })
      );
      await assertSucceeds(
        asRole('HOMEROOM_TEACHER').firestore().doc('seating_layouts/layout_new/groups/group_1').set({
          name: 'Group 1',
          capacity: 4
        })
      );
      await assertSucceeds(
        asRole('SUPER_ADMIN').firestore().doc('seating_layouts/layout_new/groups/group_1/seats/seat_1').set({
          seatNumber: 1
        })
      );
      await assertFails(
        asUser('student-101', ['STUDENT']).firestore().doc('seating_layouts/layout_new').set({
          name: 'Hacked Layout'
        })
      );
    });
  });

  // 14. seating_assignments collection
  describe('seating_assignments collection', () => {
    it('allows teachers and admins to read and write assignments', async () => {
      await assertSucceeds(
        asRole('SUBJECT_TEACHER').firestore().doc('seating_assignments/assign_001').set({
          layoutId: 'layout_m58',
          studentId: 'std_38501',
          seatId: 'seat_1',
          effectiveFrom: '2026-08-25T08:00:00Z',
          effectiveTo: null
        })
      );
      await assertSucceeds(
        asRole('HOMEROOM_TEACHER').firestore().doc('seating_assignments/assign_001').get()
      );
      await assertSucceeds(
        asRole('EXECUTIVE').firestore().doc('seating_assignments/assign_001').get()
      );
    });

    it('allows a student to read their own seating assignment', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('seating_assignments/assign_std1').set({
          studentId: 'student-alice',
          layoutId: 'layout_m58',
          seatId: 'seat_1',
          effectiveFrom: '2026-08-25T08:00:00Z'
        });
      });

      await assertSucceeds(
        asUser('student-alice', ['STUDENT']).firestore().doc('seating_assignments/assign_std1').get()
      );
      await assertFails(
        asUser('student-bob', ['STUDENT']).firestore().doc('seating_assignments/assign_std1').get()
      );
    });

    it('denies students from writing to seating assignments', async () => {
      await assertFails(
        asUser('student-alice', ['STUDENT']).firestore().doc('seating_assignments/assign_new').set({
          studentId: 'student-alice',
          seatId: 'seat_front'
        })
      );
    });
  });

  // 16. substitute_assignments & post_teaching_records
  describe('substitute_assignments collection', () => {
    it('allows any signed-in user to read substitute assignments', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('substitute_assignments/sub-01').set({
          courseId: 'c1', date: '2026-08-30', status: 'PENDING_APPROVAL',
        });
      });

      await assertSucceeds(asRole('SUBJECT_TEACHER').firestore().doc('substitute_assignments/sub-01').get());
      await assertSucceeds(asUser('student-001', ['STUDENT']).firestore().doc('substitute_assignments/sub-01').get());
    });

    it('REGRESSION: denies unauthenticated context from reading or writing substitute_assignments', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('substitute_assignments/sub-01').set({ courseId: 'c1' });
      });

      await assertFails(asAnonymous().firestore().doc('substitute_assignments/sub-01').get());
      await assertFails(asAnonymous().firestore().doc('substitute_assignments/sub-02').set({ courseId: 'c2' }));
    });

    it('allows the 4 approval roles + SUPER_ADMIN + proposing HEAD_OF_DEPARTMENT to write', async () => {
      await assertSucceeds(
        asRole('HEAD_OF_DEPARTMENT').firestore().doc('substitute_assignments/sub-hod').set({ courseId: 'c1', currentApprovalStage: 'STAGE_2_ACADEMIC_HEAD' })
      );
      await assertSucceeds(
        asRole('ACADEMIC_HEAD').firestore().doc('substitute_assignments/sub-ah').set({ courseId: 'c1' })
      );
      await assertSucceeds(
        asRole('DEPUTY_DIRECTOR_ACADEMIC').firestore().doc('substitute_assignments/sub-dd').set({ courseId: 'c1' })
      );
      await assertSucceeds(
        asRole('DIRECTOR').firestore().doc('substitute_assignments/sub-dir').set({ courseId: 'c1' })
      );
      await assertSucceeds(
        asRole('SUPER_ADMIN').firestore().doc('substitute_assignments/sub-adm').set({ courseId: 'c1' })
      );
    });

    it('allows a SUBJECT_TEACHER (substitute teacher) to write the post-teaching completion', async () => {
      await assertSucceeds(
        asRole('SUBJECT_TEACHER').firestore().doc('substitute_assignments/sub-complete').set({
          courseId: 'c1', isCompleted: true, completionSummary: 'สอนเรื่องสมการ',
        })
      );
    });

    it('allows SUBJECT_TEACHER and HOMEROOM_TEACHER to self-propose a personal-leave/official-duty request (stage 1 stays pending)', async () => {
      await assertSucceeds(
        asRole('SUBJECT_TEACHER').firestore().doc('substitute_assignments/sub-self-1').set({
          courseId: 'c1', triggerType: 'PERSONAL_LEAVE', proposedByRole: 'SUBJECT_TEACHER',
          status: 'PENDING_APPROVAL', currentApprovalStage: 'STAGE_1_HEAD_OF_DEPARTMENT',
        })
      );
      await assertSucceeds(
        asRole('HOMEROOM_TEACHER').firestore().doc('substitute_assignments/sub-self-2').set({
          courseId: 'c1', triggerType: 'OFFICIAL_DUTY', proposedByRole: 'HOMEROOM_TEACHER',
          status: 'PENDING_APPROVAL', currentApprovalStage: 'STAGE_1_HEAD_OF_DEPARTMENT',
        })
      );
    });

    it('REGRESSION: denies PARENT and STUDENT from writing substitute_assignments', async () => {
      await assertFails(
        asRole('PARENT').firestore().doc('substitute_assignments/sub-bad').set({ courseId: 'c1', status: 'APPROVED' })
      );
      await assertFails(
        asUser('student-x', ['STUDENT']).firestore().doc('substitute_assignments/sub-bad-2').set({ courseId: 'c1' })
      );
    });
  });

  describe('post_teaching_records collection', () => {
    it('allows any signed-in user to read and teachers/admins to write', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('post_teaching_records/ptr-01').set({ courseId: 'c1', date: '2026-08-30' });
      });

      await assertSucceeds(asRole('SUBJECT_TEACHER').firestore().doc('post_teaching_records/ptr-01').get());
      await assertSucceeds(
        asRole('SUBJECT_TEACHER').firestore().doc('post_teaching_records/ptr-new').set({ courseId: 'c1', isLate: false })
      );
      await assertSucceeds(
        asRole('HEAD_OF_DEPARTMENT').firestore().doc('post_teaching_records/ptr-new-2').set({ courseId: 'c1' })
      );
    });

    it('REGRESSION: denies unauthenticated and PARENT from writing post_teaching_records', async () => {
      await assertFails(
        asAnonymous().firestore().doc('post_teaching_records/ptr-bad').set({ courseId: 'c1' })
      );
      await assertFails(
        asRole('PARENT').firestore().doc('post_teaching_records/ptr-bad-2').set({ courseId: 'c1' })
      );
    });
  });

  // 16b. late_attendance_requests — ครูขอเช็คชื่อย้อนหลัง, อนุมัติโดย DEPUTY_DIRECTOR_ACADEMIC
  describe('late_attendance_requests collection', () => {
    const seedReq = (extra: Record<string, any> = {}) =>
      testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('late_attendance_requests/lar-01').set({
          id: 'lar-01', teacherId: 'teacher-uid-1', teacherName: 'ครู ก', scheduleId: 'sch_x',
          subjectCode: 'ค32101', subjectName: 'คณิต', level: 'ม.5/8', periodNumber: 7, room: '943',
          teachingDate: '2026-08-31', reason: 'ลืมเช็ค', status: 'PENDING',
          requestedAt: '2026-08-31T14:00:00.000Z', approverUid: null, approverName: null,
          decidedAt: null, rejectReason: null, ...extra,
        });
      });

    it('เจ้าของคำขอ + DEPUTY_DIRECTOR_ACADEMIC + SUPER_ADMIN + DIRECTOR + EXECUTIVE อ่านได้; คนอื่นอ่านไม่ได้', async () => {
      await seedReq();
      await assertSucceeds(asUser('teacher-uid-1', ['SUBJECT_TEACHER']).firestore().doc('late_attendance_requests/lar-01').get());
      await assertSucceeds(asRole('DEPUTY_DIRECTOR_ACADEMIC').firestore().doc('late_attendance_requests/lar-01').get());
      await assertSucceeds(asRole('SUPER_ADMIN').firestore().doc('late_attendance_requests/lar-01').get());
      await assertSucceeds(asRole('DIRECTOR').firestore().doc('late_attendance_requests/lar-01').get());
      await assertSucceeds(asRole('EXECUTIVE').firestore().doc('late_attendance_requests/lar-01').get());
      await assertFails(asUser('teacher-uid-2', ['SUBJECT_TEACHER']).firestore().doc('late_attendance_requests/lar-01').get());
      await assertFails(asRole('HEAD_OF_DEPARTMENT').firestore().doc('late_attendance_requests/lar-01').get());
      await assertFails(asAnonymous().firestore().doc('late_attendance_requests/lar-01').get());
    });

    it('REGRESSION: DIRECTOR อ่านได้อย่างเดียว — สร้าง/แก้ status/ลบ ไม่ได้', async () => {
      await seedReq();
      const dir = asRole('DIRECTOR').firestore();
      await assertSucceeds(dir.doc('late_attendance_requests/lar-01').get());
      await assertFails(dir.doc('late_attendance_requests/lar-01').set({ status: 'APPROVED', approverUid: 'dir-1' }, { merge: true }));
      await assertFails(dir.doc('late_attendance_requests/lar-01').set({ status: 'REJECTED' }, { merge: true }));
      await assertFails(dir.doc('late_attendance_requests/lar-new-by-dir').set({ teacherId: 'dir-1', scheduleId: 's', status: 'PENDING' }));
      await assertFails(dir.doc('late_attendance_requests/lar-01').delete());
    });

    it('ครูสร้างคำขอของตัวเอง (status=PENDING) ได้; สร้างในนามคนอื่น หรือ status อื่น ไม่ได้', async () => {
      const teacherDb = asUser('teacher-uid-1', ['SUBJECT_TEACHER']).firestore();
      await assertSucceeds(teacherDb.doc('late_attendance_requests/lar-new').set({
        teacherId: 'teacher-uid-1', scheduleId: 's1', status: 'PENDING', reason: 'r', periodNumber: 7,
      }));
      await assertFails(teacherDb.doc('late_attendance_requests/lar-bad-owner').set({
        teacherId: 'teacher-uid-2', scheduleId: 's1', status: 'PENDING',
      }));
      await assertFails(teacherDb.doc('late_attendance_requests/lar-bad-status').set({
        teacherId: 'teacher-uid-1', scheduleId: 's1', status: 'APPROVED',
      }));
    });

    it('REGRESSION: อนุมัติ/ปฏิเสธได้เฉพาะ DEPUTY_DIRECTOR_ACADEMIC / SUPER_ADMIN — ครูเจ้าของแก้ status เองไม่ได้', async () => {
      await seedReq();
      await assertSucceeds(asRole('DEPUTY_DIRECTOR_ACADEMIC').firestore().doc('late_attendance_requests/lar-01')
        .set({ status: 'APPROVED', approverUid: 'dep-1' }, { merge: true }));
      await seedReq();
      await assertFails(asUser('teacher-uid-1', ['SUBJECT_TEACHER']).firestore().doc('late_attendance_requests/lar-01')
        .set({ status: 'APPROVED' }, { merge: true }));
    });

    it('REGRESSION: ผู้อนุมัติแก้ teacherId ของคำขอไม่ได้ (ตรึงเจ้าของ) + ลบ document ไม่ได้', async () => {
      await seedReq();
      await assertFails(asRole('DEPUTY_DIRECTOR_ACADEMIC').firestore().doc('late_attendance_requests/lar-01')
        .set({ status: 'APPROVED', teacherId: 'someone-else' }, { merge: true }));
      await seedReq();
      await assertFails(asRole('SUPER_ADMIN').firestore().doc('late_attendance_requests/lar-01').delete());
      await assertFails(asRole('DEPUTY_DIRECTOR_ACADEMIC').firestore().doc('late_attendance_requests/lar-01').delete());
    });
  });

  // 17. parent_verification_records - SUPER_ADMIN only (PDPA-sensitive identity data)
  describe('parent_verification_records collection', () => {
    it('allows SUPER_ADMIN to read but NOT write parent verification records (writes go through Cloud Functions)', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('parent_verification_records/38501_verify').set({
          studentId: '38501',
          parentNationalIdHmac: 'abc123',
          relationship: 'บิดา',
          linkedParentUid: null,
        });
      });

      await assertSucceeds(asRole('SUPER_ADMIN').firestore().doc('parent_verification_records/38501_verify').get());
      await assertFails(
        asRole('SUPER_ADMIN').firestore().doc('parent_verification_records/38502_verify').set({
          studentId: '38502', parentNationalIdHmac: 'def456', relationship: 'มารดา', linkedParentUid: null,
        })
      );
    });

    it('REGRESSION: denies HOMEROOM_TEACHER, EXECUTIVE, and PARENT from reading parent verification records', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('parent_verification_records/38501_verify').set({
          studentId: '38501', parentNationalIdHmac: 'abc123', linkedParentUid: null,
        });
      });

      await assertFails(asRole('HOMEROOM_TEACHER').firestore().doc('parent_verification_records/38501_verify').get());
      await assertFails(asRole('EXECUTIVE').firestore().doc('parent_verification_records/38501_verify').get());
      await assertFails(asUser('parent-alice', ['PARENT']).firestore().doc('parent_verification_records/38501_verify').get());
    });

    it('REGRESSION: denies non-admin roles and the parent themself from writing parent verification records', async () => {
      await assertFails(
        asRole('HOMEROOM_TEACHER').firestore().doc('parent_verification_records/pv-bad').set({ studentId: '38501' })
      );
      await assertFails(
        asRole('SUBJECT_TEACHER').firestore().doc('parent_verification_records/pv-bad-2').set({ studentId: '38501' })
      );
      await assertFails(
        asUser('parent-alice', ['PARENT']).firestore().doc('parent_verification_records/pv-bad-3').set({ studentId: '38501', linkedParentUid: 'parent-alice' })
      );
      await assertFails(
        asAnonymous().firestore().doc('parent_verification_records/pv-bad-4').set({ studentId: '38501' })
      );
    });
  });

  // 15b. detailed_leave_requests — นักเรียน/ผู้ปกครองยื่น → ผู้ปกครองรับทราบ → ครูที่ปรึกษาตัดสิน
  describe('detailed_leave_requests collection', () => {
    const STU_UID = 'stu-uid-l1';
    const STU_ID = 'l-std-1';
    const ROOM = 'ม.5/8';
    const PARENT_UID = 'parent-l1';
    const HR_UID = 'hr-l1';
    const COL = 'detailed_leave_requests';
    const stu = () => asUser(STU_UID, ['STUDENT']).firestore();
    const par = () => asUser(PARENT_UID, ['PARENT']).firestore();
    const hr = () => asUser(HR_UID, ['HOMEROOM_TEACHER'], { staffId: HR_UID }).firestore();
    const otherHr = () => asUser('other-hr-l', ['HOMEROOM_TEACHER'], { staffId: 'other-hr-l' }).firestore();

    async function seed(opts: { parent?: boolean } = {}) {
      const withParent = opts.parent !== false;
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc(`students/${STU_ID}`).set({
          studentId: STU_ID, studentUid: STU_UID, room: ROOM, name: 'Leave Kid',
          ...(withParent ? { parentUid: PARENT_UID } : {}),
        });
        await ctx.firestore().doc(`staff/${HR_UID}`).set({ roles: ['HOMEROOM_TEACHER'], assignments: { homeroomClass: ROOM } });
        await ctx.firestore().doc('staff/other-hr-l').set({ roles: ['HOMEROOM_TEACHER'], assignments: { homeroomClass: 'ม.6/1' } });
      });
    }
    const leave = (id: string, over: Record<string, unknown> = {}) => ({
      id, studentId: STU_ID, studentUid: STU_UID, parentUid: PARENT_UID, homeroomClass: ROOM,
      leaveType: 'SICK', startDate: '2026-10-13', endDate: '2026-10-14', totalDays: 2, reason: 'ไข้หวัด',
      status: 'PENDING_PARENT', submittedByRole: 'student', submittedByUid: STU_UID, submittedBy: 'Leave Kid',
      submittedAt: '2026-10-12T00:00:00.000Z', noParentLinked: false, parentAcknowledgedAt: null,
      ...over,
    });
    async function put(id: string, over: Record<string, unknown> = {}) {
      await testEnv.withSecurityRulesDisabled(async (ctx) => { await ctx.firestore().doc(`${COL}/${id}`).set(leave(id, over)); });
    }

    describe('create', () => {
      it('student with a linked parent starts at PENDING_PARENT', async () => {
        await seed();
        await assertSucceeds(stu().doc(`${COL}/c1`).set(leave('c1')));
      });
      it('denies a student creating an already-APPROVED / skip-parent leave', async () => {
        await seed();
        await assertFails(stu().doc(`${COL}/c2`).set(leave('c2', { status: 'APPROVED' })));
        await assertFails(stu().doc(`${COL}/c3`).set(leave('c3', { status: 'PENDING_TEACHER' })));
      });
      it('student without a linked parent goes straight to the teacher with noParentLinked', async () => {
        await seed({ parent: false });
        await assertSucceeds(stu().doc(`${COL}/c4`).set(leave('c4', { parentUid: null, status: 'PENDING_TEACHER', noParentLinked: true })));
        await assertFails(stu().doc(`${COL}/c5`).set(leave('c5', { parentUid: null, status: 'PENDING_PARENT', noParentLinked: true })));
      });
      it('the real parent can submit; it goes to the teacher immediately', async () => {
        await seed();
        await assertSucceeds(par().doc(`${COL}/c6`).set(leave('c6', { status: 'PENDING_TEACHER', submittedByRole: 'parent', submittedByUid: PARENT_UID, submittedBy: 'ผู้ปกครอง' })));
        await assertFails(par().doc(`${COL}/c7`).set(leave('c7', { status: 'PENDING_PARENT', submittedByRole: 'parent', submittedByUid: PARENT_UID })));
      });
      it('denies another parent/student submitting for this child', async () => {
        await seed();
        await assertFails(asUser('stranger-parent', ['PARENT']).firestore().doc(`${COL}/c8`).set(leave('c8', { status: 'PENDING_TEACHER', submittedByRole: 'parent', submittedByUid: 'stranger-parent' })));
        await assertFails(asUser('stranger-stu', ['STUDENT']).firestore().doc(`${COL}/c9`).set(leave('c9', { submittedByUid: 'stranger-stu' })));
      });
      it('denies faked homeroomClass / studentUid / parentUid and bad shape', async () => {
        await seed();
        await assertFails(stu().doc(`${COL}/d1`).set(leave('d1', { homeroomClass: 'ม.6/1' })));
        await assertFails(stu().doc(`${COL}/d2`).set(leave('d2', { parentUid: 'someone-else' })));
        await assertFails(stu().doc(`${COL}/d3`).set(leave('d3', { endDate: '2026-10-01' })));
        await assertFails(stu().doc(`${COL}/d4`).set(leave('d4', { totalDays: 99 })));
        await assertFails(stu().doc(`${COL}/d5`).set(leave('d5', { reason: '' })));
        await assertFails(stu().doc(`${COL}/d6`).set({ ...leave('d6'), approvedBy: 'ครู' }));
        await assertFails(stu().doc(`${COL}/other-id`).set(leave('d7')));
      });
    });

    describe('update', () => {
      it('students and parents can never approve (self-approval blocked)', async () => {
        await seed();
        await put('u1', { status: 'PENDING_TEACHER' });
        await assertFails(stu().doc(`${COL}/u1`).update({ status: 'APPROVED' }));
        await assertFails(par().doc(`${COL}/u1`).update({ status: 'APPROVED', decidedBy: 'x', teacherRemarks: '' }));
      });
      it('the linked parent acknowledges a PENDING_PARENT leave (and nothing else)', async () => {
        await seed();
        await put('u2');
        await assertFails(par().doc(`${COL}/u2`).update({ status: 'APPROVED' }));
        await assertFails(par().doc(`${COL}/u2`).update({ status: 'PENDING_TEACHER', parentAcknowledgedAt: 'x', parentAcknowledgedBy: PARENT_UID, reason: 'แก้เหตุผล' }));
        await assertSucceeds(par().doc(`${COL}/u2`).update({ status: 'PENDING_TEACHER', parentAcknowledgedAt: '2026-10-12T01:00:00.000Z', parentAcknowledgedBy: PARENT_UID }));
      });
      it('another parent cannot acknowledge', async () => {
        await seed();
        await put('u3');
        await assertFails(asUser('stranger-parent', ['PARENT']).firestore().doc(`${COL}/u3`).update({ status: 'PENDING_TEACHER', parentAcknowledgedAt: 'x', parentAcknowledgedBy: 'stranger-parent' }));
      });
      it('the homeroom teacher cannot decide before the parent acknowledged', async () => {
        await seed();
        await put('u4');
        await assertFails(hr().doc(`${COL}/u4`).update({ status: 'APPROVED', decidedBy: 'ครู', teacherRemarks: '' }));
      });
      it('the homeroom teacher of that room approves/rejects a PENDING_TEACHER leave', async () => {
        await seed();
        await put('u5', { status: 'PENDING_TEACHER' });
        await put('u6', { status: 'PENDING_TEACHER' });
        await assertSucceeds(hr().doc(`${COL}/u5`).update({ status: 'APPROVED', decidedBy: 'ครูที่ปรึกษา', decidedByStaffId: HR_UID, decidedAt: '2026-10-12T02:00:00.000Z', teacherRemarks: 'อนุมัติ' }));
        await assertSucceeds(hr().doc(`${COL}/u6`).update({ status: 'REJECTED', decidedBy: 'ครูที่ปรึกษา', decidedByStaffId: HR_UID, decidedAt: '2026-10-12T02:00:00.000Z', teacherRemarks: 'ไม่มีเอกสาร' }));
      });
      it('a teacher of another room cannot decide; decided leaves are final', async () => {
        await seed();
        await put('u7', { status: 'PENDING_TEACHER' });
        await assertFails(otherHr().doc(`${COL}/u7`).update({ status: 'APPROVED', decidedBy: 'ครูห้องอื่น', teacherRemarks: '' }));
        await put('u8', { status: 'APPROVED', decidedBy: 'ครู', teacherRemarks: '' });
        await assertFails(hr().doc(`${COL}/u8`).update({ status: 'REJECTED', decidedBy: 'ครู', teacherRemarks: '' }));
      });
      it('a decision cannot edit the student-entered content', async () => {
        await seed();
        await put('u9', { status: 'PENDING_TEACHER' });
        await assertFails(hr().doc(`${COL}/u9`).update({ status: 'APPROVED', decidedBy: 'ครู', teacherRemarks: '', reason: 'เปลี่ยนเหตุผล' }));
        await assertFails(hr().doc(`${COL}/u9`).update({ status: 'APPROVED', decidedBy: '', teacherRemarks: '' }));
      });
    });

    describe('read / delete', () => {
      it('owner student, linked parent and the homeroom teacher can read; others cannot', async () => {
        await seed();
        await put('r1');
        await assertSucceeds(stu().doc(`${COL}/r1`).get());
        await assertSucceeds(par().doc(`${COL}/r1`).get());
        await assertSucceeds(hr().doc(`${COL}/r1`).get());
        await assertFails(otherHr().doc(`${COL}/r1`).get());
        await assertFails(asUser('stranger-stu', ['STUDENT']).firestore().doc(`${COL}/r1`).get());
        await assertFails(asUser('stranger-parent', ['PARENT']).firestore().doc(`${COL}/r1`).get());
      });
      it('queries by studentUid / parentUid / homeroomClass work for the right viewer', async () => {
        await seed();
        await put('r2');
        const q = (db: any, f: string, v: string) => getDocs(query(collection(db, COL), where(f, '==', v)));
        await assertSucceeds(q(stu(), 'studentUid', STU_UID));
        await assertSucceeds(q(par(), 'parentUid', PARENT_UID));
        await assertSucceeds(q(hr(), 'homeroomClass', ROOM));
        await assertFails(q(otherHr(), 'homeroomClass', ROOM));
        await assertFails(q(par(), 'studentUid', STU_UID));
      });
      it('nobody can delete a leave', async () => {
        await seed();
        await put('x1');
        await assertFails(stu().doc(`${COL}/x1`).delete());
        await assertFails(hr().doc(`${COL}/x1`).delete());
        await assertFails(asRole('SUPER_ADMIN').firestore().doc(`${COL}/x1`).delete());
      });
    });
  });

  // 15c. student_leave_days — วันลาอนุมัติแล้ว (ไม่มีเหตุผล) ให้ครูประจำวิชาเห็นตอนเช็คชื่อ
  describe('student_leave_days collection', () => {
    const STU_UID = 'stu-uid-d1';
    const STU_ID = 'd-std-1';
    const ROOM = 'ม.5/8';
    const HR_UID = 'hr-d1';
    const LCOL = 'detailed_leave_requests';
    const DCOL = 'student_leave_days';
    const hr = () => asUser(HR_UID, ['HOMEROOM_TEACHER'], { staffId: HR_UID }).firestore();
    const otherHr = () => asUser('other-hr-d', ['HOMEROOM_TEACHER'], { staffId: 'other-hr-d' }).firestore();
    const subj = () => asUser('subj-d1', ['SUBJECT_TEACHER'], { staffId: 'subj-d1' }).firestore();
    const day = (id: string, over: Record<string, unknown> = {}) => ({
      leaveId: id, studentId: STU_ID, homeroomClass: ROOM, startDate: '2026-10-13', endDate: '2026-10-14',
      createdAt: new Date(), ...over,
    });
    async function seed(id: string, status = 'PENDING_TEACHER') {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc(`staff/${HR_UID}`).set({ roles: ['HOMEROOM_TEACHER'], assignments: { homeroomClass: ROOM } });
        await ctx.firestore().doc('staff/other-hr-d').set({ roles: ['HOMEROOM_TEACHER'], assignments: { homeroomClass: 'ม.6/1' } });
        await ctx.firestore().doc(`${LCOL}/${id}`).set({
          id, studentId: STU_ID, studentUid: STU_UID, parentUid: null, homeroomClass: ROOM, leaveType: 'SICK',
          startDate: '2026-10-13', endDate: '2026-10-14', totalDays: 2, reason: 'เรื่องส่วนตัว',
          status, submittedByRole: 'student', submittedByUid: STU_UID, submittedBy: 'x',
          submittedAt: '2026-10-12T00:00:00.000Z', noParentLinked: true, parentAcknowledgedAt: null,
        });
      });
    }
    const approve = { status: 'APPROVED', decidedBy: 'ครู', decidedByStaffId: HR_UID, decidedAt: '2026-10-12T02:00:00.000Z', teacherRemarks: '' };

    it('approving a leave and writing its leave-day in one batch succeeds', async () => {
      await seed('ld1');
      const db = hr();
      const b = db.batch();
      b.update(db.doc(`${LCOL}/ld1`), approve);
      b.set(db.doc(`${DCOL}/ld1`), day('ld1'));
      await assertSucceeds(b.commit());
    });
    it('denies a leave-day without approving the leave in the same batch', async () => {
      await seed('ld2');
      await assertFails(hr().doc(`${DCOL}/ld2`).set(day('ld2')));
    });
    it('denies a leave-day for a REJECTED or already-decided leave', async () => {
      await seed('ld3');
      const db = hr();
      const b = db.batch();
      b.update(db.doc(`${LCOL}/ld3`), { ...approve, status: 'REJECTED' });
      b.set(db.doc(`${DCOL}/ld3`), day('ld3'));
      await assertFails(b.commit());
      await seed('ld4', 'APPROVED');
      await assertFails(hr().doc(`${DCOL}/ld4`).set(day('ld4')));
    });
    it('denies a leave-day whose student/room/dates differ from the leave, or with a reason field', async () => {
      await seed('ld5');
      for (const over of [{ studentId: 'other' }, { homeroomClass: 'ม.6/1' }, { endDate: '2026-12-31' }, { reason: 'เรื่องส่วนตัว' }]) {
        const db = hr();
        const b = db.batch();
        b.update(db.doc(`${LCOL}/ld5`), approve);
        b.set(db.doc(`${DCOL}/ld5`), day('ld5', over));
        await assertFails(b.commit());
      }
    });
    it('a teacher of another room cannot approve, so cannot create the leave-day', async () => {
      await seed('ld6');
      const db = otherHr();
      const b = db.batch();
      b.update(db.doc(`${LCOL}/ld6`), approve);
      b.set(db.doc(`${DCOL}/ld6`), day('ld6'));
      await assertFails(b.commit());
    });
    it('subject teachers can read leave-days but students/parents cannot; nobody can update or delete', async () => {
      await seed('ld7');
      await testEnv.withSecurityRulesDisabled(async (ctx) => { await ctx.firestore().doc(`${DCOL}/ld7`).set(day('ld7')); });
      await assertSucceeds(subj().doc(`${DCOL}/ld7`).get());
      await assertSucceeds(asRole('EXECUTIVE').firestore().doc(`${DCOL}/ld7`).get());
      await assertFails(asUser(STU_UID, ['STUDENT']).firestore().doc(`${DCOL}/ld7`).get());
      await assertFails(asUser('par-d', ['PARENT']).firestore().doc(`${DCOL}/ld7`).get());
      await assertFails(hr().doc(`${DCOL}/ld7`).update({ endDate: '2026-12-31' }));
      await assertFails(hr().doc(`${DCOL}/ld7`).delete());
      await assertFails(asRole('SUPER_ADMIN').firestore().doc(`${DCOL}/ld7`).delete());
    });
  });

  // 15c2. staff_notifications — ข้อความแจ้งผลการอนุมัติระหว่างบุคลากร (ผู้รับตามอีเมล) + parent_notifications สำหรับแนะแนว/การเงิน
  describe('staff_notifications collection', () => {
    const COL = 'staff_notifications';
    const ME = 'me@school.ac.th';
    const sender = () => asUser('dep-1', ['DEPUTY_DIRECTOR_ACADEMIC'], { email: 'dep@school.ac.th' }).firestore();
    const me = () => asUser('t-1', ['SUBJECT_TEACHER'], { email: 'Me@School.ac.th' }).firestore();
    const other = () => asUser('t-2', ['SUBJECT_TEACHER'], { email: 'other@school.ac.th' }).firestore();
    const stu = () => asUser('stu-x', ['STUDENT'], { email: 'stu@school.ac.th' }).firestore();
    const note = (id: string, over: Record<string, unknown> = {}) => ({
      id, recipientEmail: ME, kind: 'LATE_ATTENDANCE_DECISION', title: 'อนุมัติแล้ว', message: 'ข้อความ', refId: 'req-1',
      senderUid: 'dep-1', senderName: 'รองผอ.', createdAt: new Date(), readAt: null, ...over,
    });
    async function put(id: string) {
      await testEnv.withSecurityRulesDisabled(async (ctx) => { await ctx.firestore().doc(`${COL}/${id}`).set(note(id)); });
    }

    it('staff can send to a recipient email as themselves', async () => {
      await assertSucceeds(sender().doc(`${COL}/n1`).set(note('n1')));
    });
    it('denies spoofed sender uid, bad kind, uppercase/invalid email, oversized text, pre-read, extra keys', async () => {
      await assertFails(sender().doc(`${COL}/n2`).set(note('n2', { senderUid: 'someone-else' })));
      await assertFails(sender().doc(`${COL}/n3`).set(note('n3', { kind: 'ANYTHING' })));
      await assertFails(sender().doc(`${COL}/n4`).set(note('n4', { recipientEmail: 'Me@School.ac.th' })));
      await assertFails(sender().doc(`${COL}/n5`).set(note('n5', { recipientEmail: 'not-an-email' })));
      await assertFails(sender().doc(`${COL}/n6`).set(note('n6', { message: 'ก'.repeat(501) })));
      await assertFails(sender().doc(`${COL}/n7`).set(note('n7', { readAt: new Date().toISOString() })));
      await assertFails(sender().doc(`${COL}/n8`).set(note('n8', { extra: 1 })));
    });
    it('denies students and anonymous from sending', async () => {
      await assertFails(stu().doc(`${COL}/n9`).set(note('n9', { senderUid: 'stu-x' })));
      await assertFails(asAnonymous().firestore().doc(`${COL}/n10`).set(note('n10')));
    });
    it('only the recipient (by token email, case-insensitive) can read; others and the sender cannot', async () => {
      await put('r1');
      await assertSucceeds(me().doc(`${COL}/r1`).get());
      await assertFails(other().doc(`${COL}/r1`).get());
      await assertFails(sender().doc(`${COL}/r1`).get());
      await assertSucceeds(me().collection(COL).where('recipientEmail', '==', ME).get());
      await assertFails(other().collection(COL).where('recipientEmail', '==', ME).get());
    });
    it('recipient can only set readAt; no delete by anyone', async () => {
      await put('u1');
      await assertSucceeds(me().doc(`${COL}/u1`).update({ readAt: new Date().toISOString() }));
      await put('u2');
      await assertFails(me().doc(`${COL}/u2`).update({ title: 'แก้ข้อความ' }));
      await assertFails(other().doc(`${COL}/u2`).update({ readAt: new Date().toISOString() }));
      await assertFails(me().doc(`${COL}/u2`).delete());
    });

    describe('parent_notifications: GUIDANCE_COUNSELOR / FINANCE_STAFF can notify a student', () => {
      const STU_ID = 'n-std-1';
      const STU_UID = 'n-stu-uid';
      const base = (id: string, over: Record<string, unknown> = {}) => ({
        id, parentUid: null, parentId: null, studentUid: STU_UID, studentId: STU_ID, studentName: 'เด็ก', title: 't', message: 'm',
        status: 'unread', createdAt: new Date(), type: 'info', ...over,
      });
      async function seed() {
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
          await ctx.firestore().doc(`students/${STU_ID}`).set({ studentId: STU_ID, studentUid: STU_UID, room: 'ม.4/1', name: 'เด็ก' });
        });
      }
      it('allows counselor and finance, reads by the student only', async () => {
        await seed();
        await assertSucceeds(asUser('gc', ['GUIDANCE_COUNSELOR']).firestore().doc('parent_notifications/g1').set(base('g1')));
        await assertSucceeds(asUser('fin', ['FINANCE_STAFF']).firestore().doc('parent_notifications/f1').set(base('f1')));
        await assertSucceeds(asUser(STU_UID, ['STUDENT']).firestore().doc('parent_notifications/g1').get());
        await assertFails(asUser('stranger', ['STUDENT']).firestore().doc('parent_notifications/g1').get());
      });
      it('still denies a wrong studentUid even from finance', async () => {
        await seed();
        await assertFails(asUser('fin', ['FINANCE_STAFF']).firestore().doc('parent_notifications/f2').set(base('f2', { studentUid: 'someone-else' })));
      });
    });
  });

  // 15c1. คลังยาห้องพยาบาล — ยอดคงเหลือเปลี่ยนได้เฉพาะเมื่อมี movement คู่กันใน batch เดียว
  describe('infirmary stock (infirmary_medicines + infirmary_stock_movements)', () => {
    const nurse = () => asUser('nurse-1', ['INFIRMARY_STAFF']).firestore() as any;
    const exec = () => asUser('exec-1', ['EXECUTIVE']).firestore() as any;
    const teacher = () => asUser('t-1', ['HOMEROOM_TEACHER'], { staffId: 't-1' }).firestore() as any;
    const parent = () => asUser('p-1', ['PARENT']).firestore() as any;
    const med = (over: Record<string, unknown> = {}) => ({
      id: 'med1', name: 'พาราเซตามอล', category: 'สามัญ', unit: 'เม็ด', stock: 100, minAlert: 20, active: true,
      lastMovementId: 'mv0', createdBy: 'nurse-1', createdAt: '2026-10-13T00:00:00.000Z', updatedAt: '2026-10-13T00:00:00.000Z', ...over,
    });
    const mv = (id: string, over: Record<string, unknown> = {}) => ({
      id, medicineId: 'med1', medicineName: 'พาราเซตามอล', unit: 'เม็ด', type: 'RESTOCK', delta: 50, balanceAfter: 150,
      byUid: 'nurse-1', byName: 'พยาบาล', at: '2026-10-13T01:00:00.000Z', ...over,
    });
    async function seedMed() {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('infirmary_medicines/med1').set(med());
        await ctx.firestore().doc('infirmary_stock_movements/mv0').set(mv('mv0', { type: 'INITIAL', delta: 100, balanceAfter: 100 }));
      });
    }

    it('create with initial stock needs the paired INITIAL movement; zero stock needs none', async () => {
      const db = nurse();
      const b1 = mWriteBatch(db);
      b1.set(mDoc(db, 'infirmary_stock_movements/mvA'), mv('mvA', { medicineId: 'medA', type: 'INITIAL', delta: 30, balanceAfter: 30 }));
      b1.set(mDoc(db, 'infirmary_medicines/medA'), med({ id: 'medA', stock: 30, lastMovementId: 'mvA' }));
      await assertSucceeds(b1.commit());
      const { lastMovementId: _omit, ...noMv } = med({ id: 'medB', stock: 0 });
      await assertSucceeds(mSetDoc(mDoc(db, 'infirmary_medicines/medB'), noMv));
      // stock > 0 without movement
      const { lastMovementId: _omit2, ...bad } = med({ id: 'medC', stock: 5 });
      await assertFails(mSetDoc(mDoc(db, 'infirmary_medicines/medC'), bad));
    });

    it('restock/dispense succeed only with a matching movement in the same batch', async () => {
      await seedMed();
      const db = nurse();
      const ok = mWriteBatch(db);
      ok.set(mDoc(db, 'infirmary_stock_movements/mv1'), mv('mv1'));
      ok.update(mDoc(db, 'infirmary_medicines/med1'), { stock: 150, lastMovementId: 'mv1', updatedAt: 'x' });
      await assertSucceeds(ok.commit());
      const disp = mWriteBatch(db);
      disp.set(mDoc(db, 'infirmary_stock_movements/mv2'), mv('mv2', { type: 'DISPENSE', delta: -10, balanceAfter: 140, studentId: '10001' }));
      disp.update(mDoc(db, 'infirmary_medicines/med1'), { stock: 140, lastMovementId: 'mv2', updatedAt: 'x' });
      await assertSucceeds(disp.commit());
    });

    it('rejects stock change without movement, mismatched balance/delta, negative stock, wrong sign', async () => {
      await seedMed();
      const db = nurse();
      await assertFails(mUpdateDoc(mDoc(db, 'infirmary_medicines/med1'), { stock: 999, updatedAt: 'x' }));
      const wrongBal = mWriteBatch(db);
      wrongBal.set(mDoc(db, 'infirmary_stock_movements/m3'), mv('m3', { delta: 50, balanceAfter: 150 }));
      wrongBal.update(mDoc(db, 'infirmary_medicines/med1'), { stock: 200, lastMovementId: 'm3', updatedAt: 'x' });
      await assertFails(wrongBal.commit());
      const neg = mWriteBatch(db);
      neg.set(mDoc(db, 'infirmary_stock_movements/m4'), mv('m4', { type: 'DISPENSE', delta: -150, balanceAfter: -50 }));
      neg.update(mDoc(db, 'infirmary_medicines/med1'), { stock: -50, lastMovementId: 'm4', updatedAt: 'x' });
      await assertFails(neg.commit());
      const sign = mWriteBatch(db);
      sign.set(mDoc(db, 'infirmary_stock_movements/m5'), mv('m5', { type: 'DISPENSE', delta: 10, balanceAfter: 110 }));
      sign.update(mDoc(db, 'infirmary_medicines/med1'), { stock: 110, lastMovementId: 'm5', updatedAt: 'x' });
      await assertFails(sign.commit());
      // movement alone (no medicine update pointing to it)
      await assertFails(mSetDoc(mDoc(db, 'infirmary_stock_movements/m6'), mv('m6')));
      // forged byUid
      const forged = mWriteBatch(db);
      forged.set(mDoc(db, 'infirmary_stock_movements/m7'), mv('m7', { byUid: 'someone-else' }));
      forged.update(mDoc(db, 'infirmary_medicines/med1'), { stock: 150, lastMovementId: 'm7', updatedAt: 'x' });
      await assertFails(forged.commit());
    });

    it('metadata edits (name/minAlert/active) need no movement; movements are immutable; med cannot be deleted', async () => {
      await seedMed();
      const db = nurse();
      await assertSucceeds(mUpdateDoc(mDoc(db, 'infirmary_medicines/med1'), { minAlert: 30, active: false, updatedAt: 'x' }));
      await assertFails(mUpdateDoc(mDoc(db, 'infirmary_medicines/med1'), { createdBy: 'x' }));
      await assertFails(mUpdateDoc(mDoc(db, 'infirmary_stock_movements/mv0'), { note: 'edit' }));
      await assertFails(db.doc('infirmary_stock_movements/mv0').delete());
      await assertFails(db.doc('infirmary_medicines/med1').delete());
    });

    it('read: nurse/exec only; teacher, parent, anonymous denied; non-nurse cannot write', async () => {
      await seedMed();
      await assertSucceeds(mGetDoc(mDoc(nurse(), 'infirmary_medicines/med1')));
      await assertSucceeds(mGetDoc(mDoc(exec(), 'infirmary_stock_movements/mv0')));
      await assertFails(mGetDoc(mDoc(teacher(), 'infirmary_medicines/med1')));
      await assertFails(mGetDoc(mDoc(parent(), 'infirmary_stock_movements/mv0')));
      await assertFails(mUpdateDoc(mDoc(teacher(), 'infirmary_medicines/med1'), { minAlert: 1, updatedAt: 'x' }));
      await assertFails(mUpdateDoc(mDoc(exec(), 'infirmary_medicines/med1'), { minAlert: 1, updatedAt: 'x' }));
    });
  });

  // 15c1b. ช่วงเวลารับสมัครชุมนุม — เวลาเซิร์ฟเวอร์บังคับที่ rules (activityEnrollmentOpen) + ครูรับผิดชอบตั้งช่วงเวลาของตัวเอง
  describe('club enrollment window (enrollmentOpensAt/ClosesAt)', () => {
    const SID = 'win-std-1';
    const STU = 'win-stu-uid';
    const HOUR = 3_600_000;
    const stu = () => asUser(STU, ['STUDENT']).firestore() as any;
    const owner = () => asUser('win-t1', ['SUBJECT_TEACHER'], { staffId: 'win-t1' }).firestore() as any;
    const otherT = () => asUser('win-t2', ['SUBJECT_TEACHER'], { staffId: 'win-t2' }).firestore() as any;
    async function seedClub(id: string, over: Record<string, unknown>) {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc(`students/${SID}`).set({ studentId: SID, studentUid: STU, room: 'ม.1/1', name: 'Win Kid' });
        await ctx.firestore().doc(`elective_activities_config/${id}`).set({
          name: 'ชุมนุมทดสอบ', capacity: 20, responsibleTeacherUids: ['win-t1'], responsibleTeacherNames: ['ครูหนึ่ง'], enrollmentStatus: 'OPEN', ...over,
        });
      });
    }
    const enrollDoc = (club: string) => ({ activityId: club, studentId: SID, studentUid: STU, enrolledAt: new Date().toISOString(), removedAt: null, removedBy: null, removedReason: null });

    it('สมัครได้เมื่ออยู่ในช่วงเวลา / ไม่กำหนดเวลา', async () => {
      await seedClub('c-in', { enrollmentOpensAt: new Date(Date.now() - HOUR), enrollmentClosesAt: new Date(Date.now() + HOUR) });
      await seedClub('c-none', {});
      await assertSucceeds(mSetDoc(mDoc(stu(), `activity_enrollments/c-in_${SID}`), enrollDoc('c-in')));
      await assertSucceeds(mSetDoc(mDoc(stu(), `activity_enrollments/c-none_${SID}`), enrollDoc('c-none')));
    });

    it('สมัครไม่ได้เมื่อเลยเวลาปิด / ยังไม่ถึงเวลาเปิด / สั่งปิดมือ', async () => {
      await seedClub('c-late', { enrollmentClosesAt: new Date(Date.now() - HOUR) });
      await seedClub('c-early', { enrollmentOpensAt: new Date(Date.now() + HOUR) });
      await seedClub('c-closed', { enrollmentStatus: 'CLOSED' });
      await assertFails(mSetDoc(mDoc(stu(), `activity_enrollments/c-late_${SID}`), enrollDoc('c-late')));
      await assertFails(mSetDoc(mDoc(stu(), `activity_enrollments/c-early_${SID}`), enrollDoc('c-early')));
      await assertFails(mSetDoc(mDoc(stu(), `activity_enrollments/c-closed_${SID}`), enrollDoc('c-closed')));
    });

    it('ครูรับผิดชอบตั้งช่วงเวลา/สถานะของชุมนุมตัวเองได้ แต่แก้ฟิลด์อื่นหรือชุมนุมคนอื่นไม่ได้', async () => {
      await seedClub('c-own', {});
      const ref = (db: any) => mDoc(db, 'elective_activities_config/c-own');
      await assertSucceeds(mUpdateDoc(ref(owner()), { enrollmentOpensAt: new Date(Date.now() + HOUR), enrollmentClosesAt: new Date(Date.now() + 5 * HOUR) }));
      await assertSucceeds(mUpdateDoc(ref(owner()), { enrollmentStatus: 'CLOSED' }));
      await assertFails(mUpdateDoc(ref(owner()), { capacity: 999 }));
      await assertFails(mUpdateDoc(ref(owner()), { enrollmentClosesAt: 'not-a-timestamp' }));
      await assertFails(mUpdateDoc(ref(otherT()), { enrollmentStatus: 'CLOSED' }));
      await assertFails(mUpdateDoc(ref(stu()), { enrollmentStatus: 'CLOSED' }));
    });
  });

  // 15c1c. ข้อมูลสุขภาพประจำตัว — ครอบครัวกรอก พยาบาลยืนยันได้อย่างเดียว
  describe('student_health_profiles (โรคประจำตัว/แพ้/ดูแลพิเศษ)', () => {
    const SID = 'hp-std-1';
    const STU = 'hp-stu';
    const PAR = 'hp-par';
    const HR = 'hp-hr';
    const stu = () => asUser(STU, ['STUDENT']).firestore() as any;
    const par = () => asUser(PAR, ['PARENT']).firestore() as any;
    const otherPar = () => asUser('hp-par-2', ['PARENT']).firestore() as any;
    const nurse = () => asUser('hp-nurse', ['INFIRMARY_STAFF']).firestore() as any;
    const hr = () => asUser(HR, ['HOMEROOM_TEACHER'], { staffId: HR }).firestore() as any;
    const otherHr = () => asUser('hp-hr2', ['HOMEROOM_TEACHER'], { staffId: 'hp-hr2' }).firestore() as any;
    const ref = (db: any) => mDoc(db, `student_health_profiles/${SID}`);
    async function seed() {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc(`students/${SID}`).set({ studentId: SID, studentUid: STU, parentUid: PAR, room: 'ม.2/2', name: 'HP Kid' });
        await ctx.firestore().doc(`staff/${HR}`).set({ roles: ['HOMEROOM_TEACHER'], assignments: { homeroomClass: 'ม.2/2' } });
        await ctx.firestore().doc('staff/hp-hr2').set({ roles: ['HOMEROOM_TEACHER'], assignments: { homeroomClass: 'ม.6/1' } });
      });
    }
    const profile = (role: 'STUDENT' | 'PARENT', uid: string, over: Record<string, unknown> = {}) => ({
      studentId: SID, studentUid: STU, parentUid: PAR,
      chronicIllnesses: [{ id: 'ci1', name: 'หอบหืด', severity: 'MODERATE', treatmentCare: 'พกยาพ่น' }],
      allergies: [{ id: 'al1', allergen: 'เพนิซิลลิน', type: 'DRUG', reaction: 'ผื่น' }],
      specialCare: [],
      updatedAt: mServerTimestamp(), updatedByUid: uid, updatedByRole: role,
      verifiedAt: null, verifiedByUid: null, verifiedByName: null, ...over,
    });
    async function put(over: Record<string, unknown> = {}) {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc(`student_health_profiles/${SID}`).set({ ...profile('PARENT', PAR), updatedAt: new Date(), ...over });
      });
    }

    it('ผู้ปกครองตัวจริง/นักเรียนเจ้าของสร้างได้; คนอื่นและพยาบาลสร้างไม่ได้', async () => {
      await seed();
      await assertSucceeds(mSetDoc(ref(par()), profile('PARENT', PAR)));
      await put(); // รีเซ็ต
      await testEnv.withSecurityRulesDisabled(async (ctx) => { await ctx.firestore().doc(`student_health_profiles/${SID}`).delete(); });
      await assertSucceeds(mSetDoc(ref(stu()), profile('STUDENT', STU)));
      await testEnv.withSecurityRulesDisabled(async (ctx) => { await ctx.firestore().doc(`student_health_profiles/${SID}`).delete(); });
      await assertFails(mSetDoc(ref(otherPar()), profile('PARENT', 'hp-par-2')));
      await assertFails(mSetDoc(ref(nurse()), profile('PARENT', 'hp-nurse')));
    });

    it('สร้างโดยแอบติดตรายืนยัน / ปลอมเจ้าของ / ปลอมผู้เขียน / รายการเกิน 20 → ถูกปฏิเสธ', async () => {
      await seed();
      await assertFails(mSetDoc(ref(par()), profile('PARENT', PAR, { verifiedAt: mServerTimestamp(), verifiedByUid: PAR, verifiedByName: 'x' })));
      await assertFails(mSetDoc(ref(par()), profile('PARENT', PAR, { studentUid: 'someone-else' })));
      await assertFails(mSetDoc(ref(par()), profile('PARENT', 'not-me')));
      await assertFails(mSetDoc(ref(par()), profile('PARENT', PAR, { allergies: Array.from({ length: 21 }, (_, i) => ({ id: `a${i}`, allergen: 'x', type: 'FOOD', reaction: '' })) })));
      await assertFails(mSetDoc(ref(par()), { ...profile('PARENT', PAR), extraField: 1 }));
    });

    it('พยาบาลยืนยันได้อย่างเดียว (แตะรายการข้อมูลไม่ได้) และครอบครัวแก้ใหม่ต้องล้างตรา', async () => {
      await seed(); await put();
      await assertSucceeds(mUpdateDoc(ref(nurse()), { verifiedAt: mServerTimestamp(), verifiedByUid: 'hp-nurse', verifiedByName: 'พยาบาลเอ' }));
      await put({ verifiedAt: new Date(), verifiedByUid: 'hp-nurse', verifiedByName: 'พยาบาลเอ' });
      await assertFails(mUpdateDoc(ref(nurse()), { allergies: [] }));
      await assertFails(mUpdateDoc(ref(nurse()), { verifiedAt: mServerTimestamp(), verifiedByUid: 'someone-else', verifiedByName: 'ปลอม' }));
      // ครอบครัวแก้โดยยังคงตรา → ไม่ได้ ; ล้างตราพร้อมแก้ → ได้
      await assertFails(mSetDoc(ref(par()), profile('PARENT', PAR, { verifiedAt: new Date(), verifiedByUid: 'hp-nurse', verifiedByName: 'พยาบาลเอ' })));
      await assertSucceeds(mSetDoc(ref(par()), profile('PARENT', PAR, { allergies: [] })));
    });

    it('อ่าน: ครอบครัว/พยาบาล/ครูที่ปรึกษาของห้องได้; ครูห้องอื่นและผู้ปกครองคนอื่นไม่ได้; ลบไม่ได้', async () => {
      await seed(); await put();
      await assertSucceeds(mGetDoc(ref(par())));
      await assertSucceeds(mGetDoc(ref(stu())));
      await assertSucceeds(mGetDoc(ref(nurse())));
      await assertSucceeds(mGetDoc(ref(hr())));
      await assertFails(mGetDoc(ref(otherHr())));
      await assertFails(mGetDoc(ref(otherPar())));
      await assertFails((par() as any).doc(`student_health_profiles/${SID}`).delete());
      await assertFails((asUser('hp-admin', ['SUPER_ADMIN']).firestore() as any).doc(`student_health_profiles/${SID}`).delete());
    });
  });

  describe('student_blood_type (หมู่เลือด เลือกครั้งเดียว)', () => {
    const SID = 'bt-std-1';
    const STU = 'bt-stu';
    const PAR = 'bt-par';
    const stu = () => asUser(STU, ['STUDENT']).firestore() as any;
    const par = () => asUser(PAR, ['PARENT']).firestore() as any;
    const otherPar = () => asUser('bt-par-2', ['PARENT']).firestore() as any;
    const nurse = () => asUser('bt-nurse', ['INFIRMARY_STAFF']).firestore() as any;
    const hr = () => asUser('bt-hr', ['HOMEROOM_TEACHER'], { staffId: 'bt-hr' }).firestore() as any;
    const ref = (db: any) => mDoc(db, `student_blood_type/${SID}`);
    const doc = (uid: string, role: string, over: Record<string, unknown> = {}) => ({
      studentId: SID, studentUid: STU, parentUid: PAR, bloodType: 'O', setByUid: uid, setByRole: role, setAt: mServerTimestamp(), ...over,
    });
    async function seed(withParent = true) {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc(`students/${SID}`).set({ studentId: SID, studentUid: STU, ...(withParent ? { parentUid: PAR } : {}), room: 'ม.2/2' });
        await ctx.firestore().doc('staff/bt-hr').set({ roles: ['HOMEROOM_TEACHER'], assignments: { homeroomClass: 'ม.2/2' } });
      });
    }
    async function put() {
      await testEnv.withSecurityRulesDisabled(async (ctx) => { await ctx.firestore().doc(`student_blood_type/${SID}`).set({ ...doc(STU, 'STUDENT'), setAt: new Date() }); });
    }

    it('นักเรียนเจ้าของ/ผู้ปกครองตัวจริง/พยาบาล สร้างได้; คนอื่น/ครูสร้างไม่ได้', async () => {
      await seed();
      await assertSucceeds(mSetDoc(ref(stu()), doc(STU, 'STUDENT')));
      await testEnv.withSecurityRulesDisabled(async (ctx) => { await ctx.firestore().doc(`student_blood_type/${SID}`).delete(); });
      await assertSucceeds(mSetDoc(ref(par()), doc(PAR, 'PARENT')));
      await testEnv.withSecurityRulesDisabled(async (ctx) => { await ctx.firestore().doc(`student_blood_type/${SID}`).delete(); });
      await assertSucceeds(mSetDoc(ref(nurse()), doc('bt-nurse', 'NURSE')));
      await testEnv.withSecurityRulesDisabled(async (ctx) => { await ctx.firestore().doc(`student_blood_type/${SID}`).delete(); });
      await assertFails(mSetDoc(ref(otherPar()), doc('bt-par-2', 'PARENT')));
      await assertFails(mSetDoc(ref(hr()), doc('bt-hr', 'NURSE')));
    });
    it('เลือกแล้วนักเรียน/ผู้ปกครองเปลี่ยนเองไม่ได้ แต่พยาบาลแก้ได้; ลบไม่ได้', async () => {
      await seed(); await put();
      await assertFails(mSetDoc(ref(stu()), doc(STU, 'STUDENT', { bloodType: 'A' })));
      await assertFails(mSetDoc(ref(par()), doc(PAR, 'PARENT', { bloodType: 'A' })));
      await assertSucceeds(mSetDoc(ref(nurse()), doc('bt-nurse', 'NURSE', { bloodType: 'A' })));
      await assertFails((nurse() as any).doc(`student_blood_type/${SID}`).delete());
    });
    it('ค่าต้องเป็น A/B/AB/O, ฟิลด์เกินไม่ได้, parentUid ต้องตรงทะเบียน (นักเรียนที่ไม่มี parentUid ส่งเป็น null)', async () => {
      await seed();
      await assertFails(mSetDoc(ref(stu()), doc(STU, 'STUDENT', { bloodType: 'ไม่ทราบ' })));
      await assertFails(mSetDoc(ref(stu()), doc(STU, 'STUDENT', { extra: 1 })));
      await assertFails(mSetDoc(ref(stu()), doc(STU, 'STUDENT', { parentUid: 'someone-else' })));
      await testEnv.withSecurityRulesDisabled(async (ctx) => { await ctx.firestore().doc(`students/${SID}`).set({ studentId: SID, studentUid: STU, parentId: 'legacy-only', room: 'ม.2/2' }); });
      await assertSucceeds(mSetDoc(ref(stu()), doc(STU, 'STUDENT', { parentUid: null })));
      await assertFails(mSetDoc(ref(nurse()), doc('bt-nurse', 'NURSE', { parentUid: 'legacy-only' })));
    });
    it('อ่าน: นักเรียน/ผู้ปกครอง/พยาบาล/ครูที่ปรึกษา; ผู้ปกครองคนอื่นอ่านไม่ได้', async () => {
      await seed(); await put();
      await assertSucceeds(mGetDoc(ref(stu())));
      await assertSucceeds(mGetDoc(ref(par())));
      await assertSucceeds(mGetDoc(ref(nurse())));
      await assertSucceeds(mGetDoc(ref(hr())));
      await assertFails(mGetDoc(ref(otherPar())));
    });
  });

  // student_semester_health: นักเรียนที่ทะเบียนมีแค่ parentId (legacy) ต้องบันทึกได้เมื่อส่ง parentUid = null ตามทะเบียนจริง
  describe('student_semester_health — ทะเบียนมี parentId อย่างเดียว', () => {
    it('ส่ง parentUid ตามทะเบียนจริง (null) ผ่าน; ส่งค่า parentId (alias) ถูกปฏิเสธ', async () => {
      const SID = 'sem-legacy-1'; const U = 'sem-legacy-stu';
      await testEnv.withSecurityRulesDisabled(async (ctx) => { await ctx.firestore().doc(`students/${SID}`).set({ studentId: SID, studentUid: U, parentId: 'legacy-par', room: 'ม.5/8' }); });
      const d = asUser(U, ['STUDENT']).firestore() as any;
      const docBody = (parentUid: string | null) => ({ studentId: SID, studentUid: U, parentUid, academicYear: '2569', term: '2', semester: '2/2569', height: 165, weight: 65, bmi: 23.9, bmiCategory: 'NORMAL', bloodType: '', recordedByUid: U, recordedByRole: 'STUDENT', recordedAt: '2026-10-13T00:00:00Z' });
      await assertFails(d.doc(`student_semester_health/${SID}_2569_2`).set(docBody('legacy-par')));
      await assertSucceeds(d.doc(`student_semester_health/${SID}_2569_2`).set(docBody(null)));
    });
  });

  describe('student_emergency_contacts (ผู้ติดต่อฉุกเฉินจากแบบเยี่ยมบ้าน)', () => {
    const SID = 'ec-std-1';
    const PAR = 'ec-par';
    const par = () => asUser(PAR, ['PARENT']).firestore() as any;
    const otherPar = () => asUser('ec-par-2', ['PARENT']).firestore() as any;
    const stu = () => asUser('ec-stu', ['STUDENT']).firestore() as any;
    const nurse = () => asUser('ec-nurse', ['INFIRMARY_STAFF']).firestore() as any;
    const hr = () => asUser('ec-hr', ['HOMEROOM_TEACHER'], { staffId: 'ec-hr' }).firestore() as any;
    const otherHr = () => asUser('ec-hr2', ['HOMEROOM_TEACHER'], { staffId: 'ec-hr2' }).firestore() as any;
    const ref = (db: any) => mDoc(db, `student_emergency_contacts/${SID}`);
    const doc = (over: Record<string, unknown> = {}) => ({
      studentId: SID, parentUid: PAR, homeroomClass: 'ม.2/2',
      contacts: [{ source: 'MOTHER', relation: 'มารดา', name: 'นางสมศรี ใจดี', phone: '089-123-4567' }],
      updatedAt: mServerTimestamp(), ...over,
    });
    async function seed() {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc(`students/${SID}`).set({ studentId: SID, studentUid: 'ec-stu', parentUid: PAR, room: 'ม.2/2', name: 'EC Kid' });
        await ctx.firestore().doc('staff/ec-hr').set({ roles: ['HOMEROOM_TEACHER'], assignments: { homeroomClass: 'ม.2/2' } });
        await ctx.firestore().doc('staff/ec-hr2').set({ roles: ['HOMEROOM_TEACHER'], assignments: { homeroomClass: 'ม.6/1' } });
      });
    }

    it('เขียน: ผู้ปกครองตัวจริงเท่านั้น (นักเรียน/ผู้ปกครองคนอื่น/พยาบาล/ครู เขียนไม่ได้)', async () => {
      await seed();
      await assertSucceeds(mSetDoc(ref(par()), doc()));
      await assertFails(mSetDoc(ref(otherPar()), doc()));
      await assertFails(mSetDoc(ref(stu()), doc()));
      await assertFails(mSetDoc(ref(nurse()), doc()));
      await assertFails(mSetDoc(ref(hr()), doc()));
    });
    it('เขียน: ห้ามฟิลด์เกิน/ห้องไม่ตรงทะเบียน/parentUid ไม่ใช่ตัวเอง/เกิน 3 รายการ/updatedAt ย้อนหลัง', async () => {
      await seed();
      await assertFails(mSetDoc(ref(par()), doc({ extra: 'x' })));
      await assertFails(mSetDoc(ref(par()), doc({ homeroomClass: 'ม.6/1' })));
      await assertFails(mSetDoc(ref(par()), doc({ parentUid: 'someone-else' })));
      await assertFails(mSetDoc(ref(par()), doc({ contacts: Array.from({ length: 4 }, (_, i) => ({ source: 'GUARDIAN', relation: 'x', name: 'n', phone: `0800000000${i}` })) })));
      await assertFails(mSetDoc(ref(par()), doc({ updatedAt: new Date('2020-01-01') })));
    });
    it('อ่าน: พยาบาล/แอดมิน/ครูที่ปรึกษาห้องนั้น/ผู้ปกครองตัวจริง; นักเรียน ครูห้องอื่น ผู้ปกครองคนอื่น อ่านไม่ได้; ลบไม่ได้', async () => {
      await seed();
      await assertSucceeds(mSetDoc(ref(par()), doc()));
      await assertSucceeds(mGetDoc(ref(nurse())));
      await assertSucceeds(mGetDoc(ref(par())));
      await assertSucceeds(mGetDoc(ref(hr())));
      await assertSucceeds(mGetDoc(ref(asUser('ec-admin', ['SUPER_ADMIN']).firestore() as any)));
      await assertFails(mGetDoc(ref(stu())));
      await assertFails(mGetDoc(ref(otherHr())));
      await assertFails(mGetDoc(ref(otherPar())));
      await assertFails((par() as any).doc(`student_emergency_contacts/${SID}`).delete());
    });
    it('พยาบาลยังอ่านเอกสารเยี่ยมบ้านฝั่งครอบครัว (รายได้/ครัวเรือน) ไม่ได้', async () => {
      await seed();
      await assertFails((nurse() as any).doc(`home_visit_family_info/${SID}`).get());
    });
  });

  // 15c2. class_messages / class_chat_threads — แชทแยกช่องส่วนตัว (ครูประจำชั้น ↔ ผู้ปกครอง | นักเรียน)
  describe('class chat (class_messages + class_chat_threads)', () => {
    const SID = 'chat-std-1';
    const ROOM = 'ม.5/8';
    const STU_UID = 'chat-stu';
    const PARENT_UID = 'chat-parent';
    const HR_UID = 'chat-hr';
    const par = () => asUser(PARENT_UID, ['PARENT']).firestore() as any;
    const stu = () => asUser(STU_UID, ['STUDENT']).firestore() as any;
    const hr = () => asUser(HR_UID, ['HOMEROOM_TEACHER'], { staffId: HR_UID }).firestore() as any;
    const otherHr = () => asUser('chat-hr2', ['HOMEROOM_TEACHER'], { staffId: 'chat-hr2' }).firestore() as any;
    const otherPar = () => asUser('chat-parent-2', ['PARENT']).firestore() as any;
    const admin = () => asUser('chat-admin', ['SUPER_ADMIN']).firestore() as any;

    async function seed() {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc(`students/${SID}`).set({ studentId: SID, studentUid: STU_UID, parentUid: PARENT_UID, room: ROOM, name: 'Chat Kid' });
        await ctx.firestore().doc(`staff/${HR_UID}`).set({ roles: ['HOMEROOM_TEACHER'], assignments: { homeroomClass: ROOM } });
        await ctx.firestore().doc('staff/chat-hr2').set({ roles: ['HOMEROOM_TEACHER'], assignments: { homeroomClass: 'ม.6/1' } });
      });
    }
    const msg = (id: string, over: Record<string, unknown> = {}) => ({
      id, studentId: SID, channel: 'PARENT', room: ROOM, memberUid: PARENT_UID, senderUid: PARENT_UID, senderRole: 'PARENT',
      senderName: 'ผู้ปกครอง', text: 'สวัสดีครับ', sentAt: '2026-10-13T00:00:00.000Z', createdAt: mServerTimestamp(), ...over,
    });
    const teacherMsg = (id: string, channel: 'PARENT' | 'STUDENT', memberUid: string) =>
      msg(id, { channel, memberUid, senderUid: HR_UID, senderRole: 'TEACHER', senderName: 'ครูประจำชั้น' });
    async function put(id: string, over: Record<string, unknown> = {}) {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc(`class_messages/${id}`).set({ ...msg(id, over), createdAt: new Date() });
      });
    }

    it('parent can send in the PARENT channel; teacher can reply; student can send in the STUDENT channel', async () => {
      await seed();
      await assertSucceeds(mSetDoc(mDoc(par(), 'class_messages/m1'), msg('m1')));
      await assertSucceeds(mSetDoc(mDoc(hr(), 'class_messages/m2'), teacherMsg('m2', 'PARENT', PARENT_UID)));
      await assertSucceeds(mSetDoc(mDoc(stu(), 'class_messages/m3'), msg('m3', { channel: 'STUDENT', memberUid: STU_UID, senderUid: STU_UID, senderRole: 'STUDENT' })));
      await assertSucceeds(mSetDoc(mDoc(hr(), 'class_messages/m4'), teacherMsg('m4', 'STUDENT', STU_UID)));
    });

    it('rejects spoofed identity: other parent, wrong memberUid, wrong room, wrong role, forged sender, bad text', async () => {
      await seed();
      await assertFails(mSetDoc(mDoc(otherPar(), 'class_messages/x1'), msg('x1', { senderUid: 'chat-parent-2', memberUid: 'chat-parent-2' })));
      await assertFails(mSetDoc(mDoc(par(), 'class_messages/x2'), msg('x2', { memberUid: STU_UID })));
      await assertFails(mSetDoc(mDoc(par(), 'class_messages/x3'), msg('x3', { room: 'ม.1/1' })));
      await assertFails(mSetDoc(mDoc(par(), 'class_messages/x4'), msg('x4', { senderRole: 'TEACHER' })));
      await assertFails(mSetDoc(mDoc(par(), 'class_messages/x5'), msg('x5', { senderUid: 'someone-else' })));
      await assertFails(mSetDoc(mDoc(par(), 'class_messages/x6'), msg('x6', { text: '' })));
      await assertFails(mSetDoc(mDoc(par(), 'class_messages/x7'), msg('x7', { text: 'ก'.repeat(1001) })));
      await assertFails(mSetDoc(mDoc(par(), 'class_messages/x8'), msg('x8', { createdAt: new Date('2020-01-01') })));
      await assertFails(mSetDoc(mDoc(par(), 'class_messages/x9'), { ...msg('x9'), extra: 1 }));
      await assertFails(mSetDoc(mDoc(otherHr(), 'class_messages/x10'), teacherMsg('x10', 'PARENT', PARENT_UID)));
      // parent cannot post into the student's channel and vice versa
      await assertFails(mSetDoc(mDoc(par(), 'class_messages/x11'), msg('x11', { channel: 'STUDENT', memberUid: STU_UID })));
      await assertFails(mSetDoc(mDoc(stu(), 'class_messages/x12'), msg('x12', { channel: 'PARENT', memberUid: PARENT_UID, senderUid: STU_UID, senderRole: 'PARENT' })));
    });

    it('read is private per channel: member + homeroom teacher of the room only (not the other channel, other parent, other teacher, admin)', async () => {
      await seed();
      await put('r1');
      await put('r2', { channel: 'STUDENT', memberUid: STU_UID, senderUid: STU_UID, senderRole: 'STUDENT' });
      await assertSucceeds(mGetDoc(mDoc(par(), 'class_messages/r1')));
      await assertSucceeds(mGetDoc(mDoc(hr(), 'class_messages/r1')));
      await assertSucceeds(mGetDoc(mDoc(hr(), 'class_messages/r2')));
      await assertSucceeds(mGetDoc(mDoc(stu(), 'class_messages/r2')));
      await assertFails(mGetDoc(mDoc(stu(), 'class_messages/r1')));
      await assertFails(mGetDoc(mDoc(par(), 'class_messages/r2')));
      await assertFails(mGetDoc(mDoc(otherPar(), 'class_messages/r1')));
      await assertFails(mGetDoc(mDoc(otherHr(), 'class_messages/r1')));
      await assertFails(mGetDoc(mDoc(admin(), 'class_messages/r1')));
    });

    it('list queries: member by memberUid, teacher by room; unscoped query denied', async () => {
      await seed();
      await put('q1');
      await assertSucceeds(getDocs(query(collection(par(), 'class_messages'), where('memberUid', '==', PARENT_UID), where('studentId', '==', SID), where('channel', '==', 'PARENT'))));
      await assertSucceeds(getDocs(query(collection(hr(), 'class_messages'), where('room', '==', ROOM), where('studentId', '==', SID), where('channel', '==', 'PARENT'))));
      await assertFails(getDocs(query(collection(par(), 'class_messages'), where('studentId', '==', SID))));
      await assertFails(getDocs(query(collection(otherHr(), 'class_messages'), where('room', '==', ROOM))));
    });

    it('messages are immutable (no update, no delete)', async () => {
      await seed();
      await put('i1');
      await assertFails(mUpdateDoc(mDoc(par(), 'class_messages/i1'), { text: 'แก้' }));
      await assertFails(par().doc('class_messages/i1').delete());
      await assertFails(hr().doc('class_messages/i1').delete());
    });

    describe('เลือกครูที่ปรึกษา (targetStaffId)', () => {
      const adv2 = () => asUser('chat-hr3', ['HOMEROOM_TEACHER'], { staffId: 'chat-hr3' }).firestore() as any;
      async function seedAdv() {
        await seed();
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
          await ctx.firestore().doc('staff/chat-hr3').set({ roles: ['HOMEROOM_TEACHER'], assignments: { homeroomClass: ROOM } });
        });
      }
      const tThread = (target: string, over: Record<string, unknown> = {}) => ({
        id: `${SID}_PARENT_${target}`, studentId: SID, studentName: 'Chat Kid', channel: 'PARENT', room: ROOM, memberUid: PARENT_UID,
        lastText: 'สวัสดี', lastSenderRole: 'PARENT', lastAt: '2026-10-13T00:00:00.000Z', memberLastReadAt: '2026-10-13T00:00:00.000Z',
        updatedAt: '2026-10-13T00:00:00.000Z', targetStaffId: target, ...over,
      });
      it('ผู้ปกครองส่งถึงครูที่ปรึกษาของห้องตัวเองได้ — ครูต่างห้อง/ไม่มีอยู่จริง ไม่ได้', async () => {
        await seedAdv();
        await assertSucceeds(mSetDoc(mDoc(par(), 'class_messages/t1'), msg('t1', { targetStaffId: HR_UID })));
        await assertSucceeds(mSetDoc(mDoc(par(), 'class_messages/t2'), msg('t2', { targetStaffId: 'chat-hr3' })));
        await assertFails(mSetDoc(mDoc(par(), 'class_messages/t3'), msg('t3', { targetStaffId: 'chat-hr2' })));
        await assertFails(mSetDoc(mDoc(par(), 'class_messages/t4'), msg('t4', { targetStaffId: 'no-such-staff' })));
      });
      it('ครูตอบได้เฉพาะห้องสนทนาที่ส่งถึงตน (หรือ "ท่านใดก็ได้") — ครูร่วมห้องที่ไม่ได้ถูกเลือกตอบไม่ได้', async () => {
        await seedAdv();
        await assertSucceeds(mSetDoc(mDoc(hr(), 'class_messages/t5'), { ...teacherMsg('t5', 'PARENT', PARENT_UID), targetStaffId: HR_UID }));
        await assertFails(mSetDoc(mDoc(adv2(), 'class_messages/t6'), { ...teacherMsg('t6', 'PARENT', PARENT_UID), senderUid: 'chat-hr3', targetStaffId: HR_UID }));
        await assertSucceeds(mSetDoc(mDoc(adv2(), 'class_messages/t7'), { ...teacherMsg('t7', 'PARENT', PARENT_UID), senderUid: 'chat-hr3' }));
      });
      it('ห้องสนทนาเจาะจงครู: id ต้องเป็น {studentId}_{channel}_{staffId}; สร้างได้โดยผู้ปกครองหรือครูผู้ถูกเลือกเท่านั้น', async () => {
        await seedAdv();
        await assertSucceeds(mSetDoc(mDoc(par(), `class_chat_threads/${SID}_PARENT_${HR_UID}`), tThread(HR_UID)));
        await assertFails(mSetDoc(mDoc(par(), `class_chat_threads/${SID}_PARENT`), tThread(HR_UID, { id: `${SID}_PARENT` })));
        await assertFails(mSetDoc(mDoc(adv2(), `class_chat_threads/${SID}_PARENT_${HR_UID}x`), tThread(HR_UID, { id: `${SID}_PARENT_${HR_UID}x` })));
        await assertSucceeds(mSetDoc(mDoc(hr(), `class_chat_threads/${SID}_STUDENT_${HR_UID}`), tThread(HR_UID, { id: `${SID}_STUDENT_${HR_UID}`, channel: 'STUDENT', memberUid: STU_UID })));
      });
      it('ครูร่วมห้องที่ไม่ได้ถูกเลือก อ่านได้แต่แก้ตัวสรุป/เวลาอ่านของห้องสนทนานั้นไม่ได้', async () => {
        await seedAdv();
        await testEnv.withSecurityRulesDisabled(async (ctx) => { await ctx.firestore().doc(`class_chat_threads/${SID}_PARENT_${HR_UID}`).set(tThread(HR_UID)); });
        const ref = (db: any) => mDoc(db, `class_chat_threads/${SID}_PARENT_${HR_UID}`);
        await assertFails(mUpdateDoc(ref(adv2()), { teacherLastReadAt: '2026-10-13T01:00:00.000Z' }));
        await assertSucceeds(mUpdateDoc(ref(hr()), { teacherLastReadAt: '2026-10-13T01:00:00.000Z' }));
      });
    });

    describe('threads', () => {
      const thread = (over: Record<string, unknown> = {}) => ({
        id: `${SID}_PARENT`, studentId: SID, studentName: 'Chat Kid', channel: 'PARENT', room: ROOM, memberUid: PARENT_UID,
        lastText: 'สวัสดี', lastSenderRole: 'PARENT', lastAt: '2026-10-13T00:00:00.000Z', memberLastReadAt: '2026-10-13T00:00:00.000Z', updatedAt: '2026-10-13T00:00:00.000Z', ...over,
      });
      async function putThread() {
        await testEnv.withSecurityRulesDisabled(async (ctx) => { await ctx.firestore().doc(`class_chat_threads/${SID}_PARENT`).set(thread()); });
      }

      it('member or homeroom teacher can create the thread; others cannot; id must match', async () => {
        await seed();
        await assertSucceeds(mSetDoc(mDoc(par(), `class_chat_threads/${SID}_PARENT`), thread()));
        await assertSucceeds(mSetDoc(mDoc(hr(), `class_chat_threads/${SID}_STUDENT`), thread({ id: `${SID}_STUDENT`, channel: 'STUDENT', memberUid: STU_UID, memberLastReadAt: '', teacherLastReadAt: '2026-10-13T00:00:00.000Z', lastSenderRole: 'TEACHER' })));
        await assertFails(mSetDoc(mDoc(otherPar(), `class_chat_threads/${SID}_PARENT`), thread()));
        await assertFails(mSetDoc(mDoc(otherHr(), `class_chat_threads/${SID}_PARENT`), thread()));
        await assertFails(mSetDoc(mDoc(par(), 'class_chat_threads/wrong-id'), thread({ id: 'wrong-id' })));
        await assertFails(mSetDoc(mDoc(par(), `class_chat_threads/${SID}_PARENT`), thread({ memberUid: 'forged' })));
      });

      it('each side can only touch its own read marker + last message fields', async () => {
        await seed();
        await putThread();
        const ref = (db: any) => mDoc(db, `class_chat_threads/${SID}_PARENT`);
        await assertSucceeds(mUpdateDoc(ref(par()), { memberLastReadAt: '2026-10-13T01:00:00.000Z', updatedAt: 'x' }));
        await assertSucceeds(mUpdateDoc(ref(hr()), { teacherLastReadAt: '2026-10-13T01:00:00.000Z', lastText: 'ตอบ', lastSenderRole: 'TEACHER', lastAt: '2026-10-13T01:00:00.000Z' }));
        await assertFails(mUpdateDoc(ref(par()), { teacherLastReadAt: '2026-10-13T02:00:00.000Z' }));
        await assertFails(mUpdateDoc(ref(hr()), { memberLastReadAt: '2026-10-13T02:00:00.000Z' }));
        await assertFails(mUpdateDoc(ref(par()), { memberUid: 'forged' }));
        await assertFails(mUpdateDoc(ref(hr()), { room: 'ม.1/1' }));
        await assertFails(mUpdateDoc(ref(otherPar()), { memberLastReadAt: 'z' }));
        await assertFails(mUpdateDoc(ref(otherHr()), { teacherLastReadAt: 'z' }));
      });

      it('thread read: member + homeroom teacher only; no delete', async () => {
        await seed();
        await putThread();
        const ref = (db: any) => mDoc(db, `class_chat_threads/${SID}_PARENT`);
        await assertSucceeds(mGetDoc(ref(par())));
        await assertSucceeds(mGetDoc(ref(hr())));
        await assertFails(mGetDoc(ref(stu())));
        await assertFails(mGetDoc(ref(otherHr())));
        await assertFails(mGetDoc(ref(admin())));
        await assertFails(par().doc(`class_chat_threads/${SID}_PARENT`).delete());
      });
    });
  });

  // 15d. parent_appointments — ผู้ปกครองขอนัด → ครูที่ปรึกษา/ครูแนะแนวตอบรับ
  describe('parent_appointments collection', () => {
    const STU_UID = 'stu-uid-a1';
    const STU_ID = 'a-std-1';
    const ROOM = 'ม.5/8';
    const PARENT_UID = 'parent-a1';
    const HR_UID = 'hr-a1';
    const COL = 'parent_appointments';
    const par = () => asUser(PARENT_UID, ['PARENT']).firestore();
    const stu = () => asUser(STU_UID, ['STUDENT']).firestore();
    const hr = () => asUser(HR_UID, ['HOMEROOM_TEACHER'], { staffId: HR_UID }).firestore();
    const otherHr = () => asUser('other-hr-a', ['HOMEROOM_TEACHER'], { staffId: 'other-hr-a' }).firestore();
    const gc = () => asUser('gc-a1', ['GUIDANCE_COUNSELOR'], { staffId: 'gc-a1' }).firestore();
    const subj = () => asUser('subj-a1', ['SUBJECT_TEACHER'], { staffId: 'subj-a1' }).firestore();

    async function seed() {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc(`students/${STU_ID}`).set({ studentId: STU_ID, studentUid: STU_UID, room: ROOM, name: 'Appt Kid', parentUid: PARENT_UID });
        await ctx.firestore().doc(`staff/${HR_UID}`).set({ roles: ['HOMEROOM_TEACHER'], assignments: { homeroomClass: ROOM } });
        await ctx.firestore().doc('staff/other-hr-a').set({ roles: ['HOMEROOM_TEACHER'], assignments: { homeroomClass: 'ม.6/1' } });
      });
    }
    const appt = (id: string, over: Record<string, unknown> = {}) => ({
      id, studentId: STU_ID, studentUid: STU_UID, parentUid: PARENT_UID, homeroomClass: ROOM, recipient: 'HOMEROOM',
      topic: 'ปรึกษาการเรียน', preferredDate: '2026-10-20', timeSlot: '15:30 - 16:00 น.', meetingType: 'IN_PERSON',
      status: 'REQUESTED', requestedBy: 'ผู้ปกครอง', requestedAt: '2026-10-12T00:00:00.000Z',
      ...over,
    });
    async function put(id: string, over: Record<string, unknown> = {}) {
      await testEnv.withSecurityRulesDisabled(async (ctx) => { await ctx.firestore().doc(`${COL}/${id}`).set(appt(id, over)); });
    }
    const confirm = { status: 'CONFIRMED', respondedBy: 'ครู', respondedByStaffId: HR_UID, respondedAt: '2026-10-12T02:00:00.000Z', teacherNote: '', locationOrLink: 'ห้องแนะแนว' };

    describe('targetStaffId (เลือกครูแนะแนว)', () => {
      const gcA = () => asUser('gc-t1', ['GUIDANCE_COUNSELOR'], { staffId: 'gc-t1' }).firestore();
      const gcB = () => asUser('gc-t2', ['GUIDANCE_COUNSELOR'], { staffId: 'gc-t2' }).firestore();
      async function seedGc() {
        await seed();
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
          await ctx.firestore().doc('staff/gc-t1').set({ roles: ['GUIDANCE_COUNSELOR'] });
          await ctx.firestore().doc('staff/gc-t2').set({ roles: ['GUIDANCE_COUNSELOR'] });
        });
      }
      it('ผู้ปกครองระบุครูแนะแนวตัวจริงได้ / ใครก็ได้ (\'\') ได้ — ระบุครูที่ไม่ใช่แนะแนว, ไม่มีอยู่จริง หรือใช้กับ HOMEROOM ไม่ได้', async () => {
        await seedGc();
        await assertSucceeds(par().doc(`${COL}/t1`).set(appt('t1', { recipient: 'GUIDANCE', targetStaffId: 'gc-t1' })));
        await assertSucceeds(par().doc(`${COL}/t2`).set(appt('t2', { recipient: 'GUIDANCE', targetStaffId: '' })));
        await assertFails(par().doc(`${COL}/t3`).set(appt('t3', { recipient: 'GUIDANCE', targetStaffId: HR_UID })));
        await assertFails(par().doc(`${COL}/t4`).set(appt('t4', { recipient: 'GUIDANCE', targetStaffId: 'no-such-staff' })));
        await assertFails(par().doc(`${COL}/t5`).set(appt('t5', { recipient: 'HOMEROOM', targetStaffId: 'gc-t1' })));
      });
      it('นัดที่ระบุครู: เฉพาะครูคนนั้นตอบรับ/ปิดงานได้ — ครูแนะแนวคนอื่นอ่านได้แต่ตอบไม่ได้', async () => {
        await seedGc();
        await put('t6', { recipient: 'GUIDANCE', targetStaffId: 'gc-t1' });
        const resp = { ...confirm, respondedByStaffId: 'gc-t1', updatedAt: new Date() };
        await assertSucceeds(gcB().doc(`${COL}/t6`).get());
        await assertFails(gcB().doc(`${COL}/t6`).update(resp));
        await assertSucceeds(gcA().doc(`${COL}/t6`).update(resp));
        await assertFails(gcB().doc(`${COL}/t6`).update({ status: 'COMPLETED', completedAt: '2026-10-13T00:00:00.000Z', updatedAt: new Date() }));
        await assertSucceeds(gcA().doc(`${COL}/t6`).update({ status: 'COMPLETED', completedAt: '2026-10-13T00:00:00.000Z', updatedAt: new Date() }));
      });
      it('นัด "ใครก็ได้" และนัดเดิมที่ไม่มี targetStaffId: ครูแนะแนวคนใดก็ตอบได้', async () => {
        await seedGc();
        await put('t7', { recipient: 'GUIDANCE', targetStaffId: '' });
        await put('t8', { recipient: 'GUIDANCE' });
        await assertSucceeds(gcB().doc(`${COL}/t7`).update({ ...confirm, respondedByStaffId: 'gc-t2', updatedAt: new Date() }));
        await assertSucceeds(gcA().doc(`${COL}/t8`).update({ ...confirm, respondedByStaffId: 'gc-t1', updatedAt: new Date() }));
      });
    });

    describe('targetStaffId (เลือกครูที่ปรึกษา)', () => {
      const adv2 = () => asUser('hr-a2', ['HOMEROOM_TEACHER'], { staffId: 'hr-a2' }).firestore();
      async function seedAdv() {
        await seed();
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
          await ctx.firestore().doc('staff/hr-a2').set({ roles: ['HOMEROOM_TEACHER'], assignments: { homeroomClass: ROOM } });
        });
      }
      it('ผู้ปกครองระบุครูที่ปรึกษาของห้องตัวเองได้ / "ทั้งหมด" (ว่าง) ได้ — ครูต่างห้อง, ไม่ใช่ครูที่ปรึกษา, ไม่มีอยู่จริง ไม่ได้', async () => {
        await seedAdv();
        await assertSucceeds(par().doc(`${COL}/h1`).set(appt('h1', { targetStaffId: HR_UID })));
        await assertSucceeds(par().doc(`${COL}/h2`).set(appt('h2', { targetStaffId: 'hr-a2' })));
        await assertSucceeds(par().doc(`${COL}/h3`).set(appt('h3', { targetStaffId: '' })));
        await assertFails(par().doc(`${COL}/h4`).set(appt('h4', { targetStaffId: 'other-hr-a' })));
        await assertFails(par().doc(`${COL}/h5`).set(appt('h5', { targetStaffId: 'no-such-staff' })));
      });
      it('นัดที่ระบุครูที่ปรึกษา: เฉพาะครูคนนั้นตอบรับได้ — ครูที่ปรึกษาร่วมห้องอ่านได้แต่ตอบไม่ได้', async () => {
        await seedAdv();
        await put('h6', { targetStaffId: HR_UID });
        await assertSucceeds(adv2().doc(`${COL}/h6`).get());
        await assertFails(adv2().doc(`${COL}/h6`).update({ ...confirm, respondedByStaffId: 'hr-a2', updatedAt: new Date() }));
        await assertSucceeds(hr().doc(`${COL}/h6`).update({ ...confirm, updatedAt: new Date() }));
      });
      it('นัด "ทั้งหมด" และนัดเดิมที่ไม่มี targetStaffId: ครูที่ปรึกษาคนใดของห้องก็ตอบได้', async () => {
        await seedAdv();
        await put('h7', { targetStaffId: '' });
        await put('h8', {});
        await assertSucceeds(adv2().doc(`${COL}/h7`).update({ ...confirm, respondedByStaffId: 'hr-a2', updatedAt: new Date() }));
        await assertSucceeds(hr().doc(`${COL}/h8`).update({ ...confirm, updatedAt: new Date() }));
      });
    });

    describe('create', () => {
      it('the real parent can request, to either recipient', async () => {
        await seed();
        await assertSucceeds(par().doc(`${COL}/c1`).set(appt('c1')));
        await assertSucceeds(par().doc(`${COL}/c2`).set(appt('c2', { recipient: 'GUIDANCE', meetingType: 'ONLINE_MEET' })));
      });
      it('denies students, strangers, other parents and teachers creating one', async () => {
        await seed();
        await assertFails(stu().doc(`${COL}/c3`).set(appt('c3')));
        await assertFails(asUser('stranger-parent', ['PARENT']).firestore().doc(`${COL}/c4`).set(appt('c4', { parentUid: 'stranger-parent' })));
        await assertFails(hr().doc(`${COL}/c5`).set(appt('c5')));
      });
      it('denies faked studentUid/room/parentUid, non-REQUESTED start, bad shape', async () => {
        await seed();
        await assertFails(par().doc(`${COL}/d1`).set(appt('d1', { homeroomClass: 'ม.6/1' })));
        await assertFails(par().doc(`${COL}/d2`).set(appt('d2', { studentUid: 'someone' })));
        await assertFails(par().doc(`${COL}/d3`).set(appt('d3', { status: 'CONFIRMED' })));
        await assertFails(par().doc(`${COL}/d4`).set(appt('d4', { recipient: 'EXECUTIVE' })));
        await assertFails(par().doc(`${COL}/d5`).set(appt('d5', { timeSlot: '03:00 - 04:00 น.' })));
        await assertFails(par().doc(`${COL}/d6`).set(appt('d6', { topic: '' })));
        await assertFails(par().doc(`${COL}/d7`).set({ ...appt('d7'), locationOrLink: 'https://x' }));
        await assertFails(par().doc(`${COL}/other-id`).set(appt('d8')));
      });
    });

    describe('read', () => {
      it('owner parent/student, the homeroom teacher of that room (HOMEROOM) and SUPER_ADMIN can read; others cannot', async () => {
        await seed();
        await put('r1');
        await assertSucceeds(par().doc(`${COL}/r1`).get());
        await assertSucceeds(stu().doc(`${COL}/r1`).get());
        await assertSucceeds(hr().doc(`${COL}/r1`).get());
        await assertSucceeds(asRole('SUPER_ADMIN').firestore().doc(`${COL}/r1`).get());
        await assertFails(otherHr().doc(`${COL}/r1`).get());
        await assertFails(gc().doc(`${COL}/r1`).get());
        await assertFails(subj().doc(`${COL}/r1`).get());
        await assertFails(asUser('stranger-parent', ['PARENT']).firestore().doc(`${COL}/r1`).get());
      });
      it('a GUIDANCE-bound request is read by guidance counselors, not by the homeroom teacher', async () => {
        await seed();
        await put('r2', { recipient: 'GUIDANCE' });
        await assertSucceeds(gc().doc(`${COL}/r2`).get());
        await assertFails(hr().doc(`${COL}/r2`).get());
      });
      it('list queries scoped like the app does (parentUid / homeroom+recipient / guidance)', async () => {
        await seed();
        await put('l1');
        await put('l2', { recipient: 'GUIDANCE' });
        await assertSucceeds(par().collection(COL).where('parentUid', '==', PARENT_UID).get());
        await assertSucceeds(hr().collection(COL).where('homeroomClass', '==', ROOM).where('recipient', '==', 'HOMEROOM').get());
        await assertSucceeds(gc().collection(COL).where('recipient', '==', 'GUIDANCE').get());
        await assertFails(hr().collection(COL).where('homeroomClass', '==', ROOM).get());
        await assertFails(gc().collection(COL).get());
      });
    });

    describe('update', () => {
      it('the receiving homeroom teacher confirms (location required) or declines', async () => {
        await seed();
        await put('u1'); await put('u2'); await put('u3');
        await assertSucceeds(hr().doc(`${COL}/u1`).update(confirm));
        await assertFails(hr().doc(`${COL}/u2`).update({ ...confirm, locationOrLink: '' }));
        await assertSucceeds(hr().doc(`${COL}/u3`).update({ ...confirm, status: 'DECLINED', teacherNote: 'ติดประชุม', locationOrLink: '' }));
      });
      it('wrong teachers cannot respond: other room, guidance on a HOMEROOM request, subject teacher, student, parent', async () => {
        await seed();
        await put('u4');
        await assertFails(otherHr().doc(`${COL}/u4`).update(confirm));
        await assertFails(gc().doc(`${COL}/u4`).update(confirm));
        await assertFails(subj().doc(`${COL}/u4`).update(confirm));
        await assertFails(stu().doc(`${COL}/u4`).update(confirm));
        await assertFails(par().doc(`${COL}/u4`).update(confirm));
      });
      it('a counselor responds to a GUIDANCE request; the response cannot change other fields', async () => {
        await seed();
        await put('u5', { recipient: 'GUIDANCE' });
        await put('u6');
        await assertSucceeds(gc().doc(`${COL}/u5`).update({ ...confirm, respondedByStaffId: 'gc-a1' }));
        await assertFails(hr().doc(`${COL}/u6`).update({ ...confirm, topic: 'แก้หัวข้อ' }));
        await assertFails(hr().doc(`${COL}/u6`).update({ ...confirm, parentUid: 'x' }));
      });
      it('completion only from CONFIRMED; cannot respond twice', async () => {
        await seed();
        await put('u7'); await put('u8', { status: 'CONFIRMED', locationOrLink: 'ห้องแนะแนว' });
        await assertFails(hr().doc(`${COL}/u7`).update({ status: 'COMPLETED', completedAt: 'x' }));
        await assertSucceeds(hr().doc(`${COL}/u8`).update({ status: 'COMPLETED', completedAt: '2026-10-20T10:00:00.000Z' }));
        await assertFails(hr().doc(`${COL}/u8`).update({ ...confirm, status: 'DECLINED' }));
      });
      it('the real parent cancels an open request (and nothing else); others cannot', async () => {
        await seed();
        await put('u9'); await put('u10', { status: 'COMPLETED' });
        await assertFails(par().doc(`${COL}/u9`).update({ status: 'CONFIRMED' }));
        await assertFails(par().doc(`${COL}/u9`).update({ status: 'CANCELLED', cancelledAt: 'x', topic: 'แก้' }));
        await assertSucceeds(par().doc(`${COL}/u9`).update({ status: 'CANCELLED', cancelledAt: '2026-10-13T00:00:00.000Z' }));
        await assertFails(par().doc(`${COL}/u10`).update({ status: 'CANCELLED', cancelledAt: 'x' }));
        await assertFails(stu().doc(`${COL}/u9`).update({ status: 'CANCELLED', cancelledAt: 'x' }));
        await assertFails(asUser('stranger-parent', ['PARENT']).firestore().doc(`${COL}/u9`).update({ status: 'CANCELLED', cancelledAt: 'x' }));
      });
      it('nobody can delete one', async () => {
        await seed();
        await put('x1');
        await assertFails(par().doc(`${COL}/x1`).delete());
        await assertFails(hr().doc(`${COL}/x1`).delete());
        await assertFails(asRole('SUPER_ADMIN').firestore().doc(`${COL}/x1`).delete());
      });
    });
  });

  // 16. student_portfolio_entries — นักเรียนบันทึกผลงานเอง + ครูที่ปรึกษาอนุมัติ
  describe('student_portfolio_entries collection', () => {
    const STU_UID = 'stu-uid-p1';
    const STU_ID = 'p-std-1';
    const ROOM = 'ม.5/8';
    const PARENT_UID = 'parent-p1';
    const HR_TEACHER_UID = 'hr-teacher-1';

    async function seed() {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc(`students/${STU_ID}`).set({ studentId: STU_ID, studentUid: STU_UID, room: ROOM, parentUid: PARENT_UID, name: 'Portfolio Kid' });
        await ctx.firestore().doc(`staff/${HR_TEACHER_UID}`).set({ roles: ['HOMEROOM_TEACHER'], assignments: { homeroomClass: ROOM } });
        await ctx.firestore().doc(`staff/other-hr`).set({ roles: ['HOMEROOM_TEACHER'], assignments: { homeroomClass: 'ม.6/1' } });
      });
    }
    const baseEntry = (over: Record<string, unknown> = {}) => ({
      studentId: STU_ID, studentUid: STU_UID, homeroomClass: ROOM, parentUid: PARENT_UID,
      type: 'AWARD', title: 'รางวัลชนะเลิศ', description: 'แข่งคณิต', entryDate: '2026-08-01',
      submittedAt: '2026-08-02T00:00:00.000Z', attachmentUrl: null,
      status: 'PENDING', reviewedBy: null, reviewedByName: null, reviewedAt: null, rejectReason: null,
      ...over,
    });

    it('lets a student create their own PENDING entry', async () => {
      await seed();
      await assertSucceeds(asUser(STU_UID, ['STUDENT']).firestore().doc('student_portfolio_entries/e1').set(baseEntry()));
    });
    it('denies a student self-approving on create', async () => {
      await seed();
      await assertFails(asUser(STU_UID, ['STUDENT']).firestore().doc('student_portfolio_entries/e2').set(baseEntry({ status: 'APPROVED' })));
    });
    it('denies a student creating an entry for someone else', async () => {
      await seed();
      await assertFails(asUser('other-stu', ['STUDENT']).firestore().doc('student_portfolio_entries/e3').set(baseEntry({ studentUid: 'other-stu' })));
    });
    it('denies a student faking homeroomClass', async () => {
      await seed();
      await assertFails(asUser(STU_UID, ['STUDENT']).firestore().doc('student_portfolio_entries/e4').set(baseEntry({ homeroomClass: 'ม.6/1' })));
    });

    it('lets the student read their own entry in any status; the homeroom teacher reads it too', async () => {
      await seed();
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('student_portfolio_entries/e5').set(baseEntry({ status: 'PENDING' }));
      });
      await assertSucceeds(asUser(STU_UID, ['STUDENT']).firestore().doc('student_portfolio_entries/e5').get());
      await assertSucceeds(asUser(HR_TEACHER_UID, ['HOMEROOM_TEACHER'], { staffId: HR_TEACHER_UID }).firestore().doc('student_portfolio_entries/e5').get());
    });
    it('denies a homeroom teacher of a different room from reading', async () => {
      await seed();
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('student_portfolio_entries/e6').set(baseEntry());
      });
      await assertFails(asUser('other-hr', ['HOMEROOM_TEACHER'], { staffId: 'other-hr' }).firestore().doc('student_portfolio_entries/e6').get());
    });
    it('lets a parent read only APPROVED entries of their child', async () => {
      await seed();
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('student_portfolio_entries/e7a').set(baseEntry({ status: 'APPROVED' }));
        await ctx.firestore().doc('student_portfolio_entries/e7b').set(baseEntry({ status: 'PENDING' }));
      });
      await assertSucceeds(asUser(PARENT_UID, ['PARENT']).firestore().doc('student_portfolio_entries/e7a').get());
      await assertFails(asUser(PARENT_UID, ['PARENT']).firestore().doc('student_portfolio_entries/e7b').get());
    });

    it('lets the homeroom teacher approve (review fields only)', async () => {
      await seed();
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('student_portfolio_entries/e8').set(baseEntry());
      });
      await assertSucceeds(asUser(HR_TEACHER_UID, ['HOMEROOM_TEACHER'], { staffId: HR_TEACHER_UID }).firestore().doc('student_portfolio_entries/e8').set(
        baseEntry({ status: 'APPROVED', reviewedBy: HR_TEACHER_UID, reviewedByName: 'ครูที่ปรึกษา', reviewedAt: '2026-08-03T00:00:00.000Z' })
      ));
    });
    it('REGRESSION: denies the homeroom teacher editing student-authored content while reviewing', async () => {
      await seed();
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('student_portfolio_entries/e9').set(baseEntry());
      });
      await assertFails(asUser(HR_TEACHER_UID, ['HOMEROOM_TEACHER'], { staffId: HR_TEACHER_UID }).firestore().doc('student_portfolio_entries/e9').set(
        baseEntry({ status: 'APPROVED', reviewedBy: HR_TEACHER_UID, title: 'ครูแก้ชื่อเรื่อง' })
      ));
    });
    it('denies a SUBJECT_TEACHER (not the homeroom teacher) from approving', async () => {
      await seed();
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('student_portfolio_entries/e10').set(baseEntry());
      });
      await assertFails(asRole('SUBJECT_TEACHER').firestore().doc('student_portfolio_entries/e10').set(
        baseEntry({ status: 'APPROVED', reviewedBy: 'test-uid' })
      ));
    });
    it('denies deleting a portfolio entry', async () => {
      await seed();
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('student_portfolio_entries/e11').set(baseEntry());
      });
      await assertFails(asUser(HR_TEACHER_UID, ['HOMEROOM_TEACHER'], { staffId: HR_TEACHER_UID }).firestore().doc('student_portfolio_entries/e11').delete());
    });
  });

  // 17. student_home_locations — พิกัด GPS + ภาพบ้าน (ห้ามผู้ปกครอง/ครูวิชาอื่นเข้าถึง)
  describe('student_home_locations collection', () => {
    const STU_UID = 'stu-uid-h1';
    const STU_ID = 'h-std-1';
    const ROOM = 'ม.5/8';
    const PARENT_UID = 'parent-h1';
    const HR_TEACHER_UID = 'hr-teacher-h';

    async function seed() {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc(`students/${STU_ID}`).set({ studentId: STU_ID, studentUid: STU_UID, room: ROOM, parentUid: PARENT_UID });
        await ctx.firestore().doc(`staff/${HR_TEACHER_UID}`).set({ roles: ['HOMEROOM_TEACHER'], assignments: { homeroomClass: ROOM } });
      });
    }
    const loc = (over: Record<string, unknown> = {}) => ({
      studentId: STU_ID, studentUid: STU_UID, homeroomClass: ROOM,
      latitude: 17.62, longitude: 100.09, accuracy: 12,
      capturedAt: '2026-08-01T00:00:00.000Z', photoUrls: ['https://storage/x.jpg'], landmarkNotes: null,
      updatedAt: '2026-08-01T00:00:00.000Z', id: STU_ID,
      ...over,
    });

    it('lets a student write their own home location with a photo', async () => {
      await seed();
      await assertSucceeds(asUser(STU_UID, ['STUDENT']).firestore().doc(`student_home_locations/${STU_ID}`).set(loc()));
    });
    it('denies writing a home location with no photo', async () => {
      await seed();
      await assertFails(asUser(STU_UID, ['STUDENT']).firestore().doc(`student_home_locations/${STU_ID}`).set(loc({ photoUrls: [] })));
    });
    it('denies a student writing another student home location', async () => {
      await seed();
      await assertFails(asUser('intruder', ['STUDENT']).firestore().doc(`student_home_locations/${STU_ID}`).set(loc({ studentUid: 'intruder' })));
    });
    it('lets the homeroom teacher read it; denies the parent and other teachers', async () => {
      await seed();
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc(`student_home_locations/${STU_ID}`).set(loc());
      });
      await assertSucceeds(asUser(HR_TEACHER_UID, ['HOMEROOM_TEACHER'], { staffId: HR_TEACHER_UID }).firestore().doc(`student_home_locations/${STU_ID}`).get());
      await assertFails(asUser(PARENT_UID, ['PARENT']).firestore().doc(`student_home_locations/${STU_ID}`).get());
      await assertFails(asRole('SUBJECT_TEACHER').firestore().doc(`student_home_locations/${STU_ID}`).get());
      await assertSucceeds(asUser(STU_UID, ['STUDENT']).firestore().doc(`student_home_locations/${STU_ID}`).get());
    });
    it('TASK 4 (ExecutivePortal GIS): EXECUTIVE role อ่านได้ทั้งโรงเรียน (ไม่ scope ห้อง) เพื่อสรุปแผนที่ผู้บริหาร', async () => {
      await seed();
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc(`student_home_locations/${STU_ID}`).set(loc());
      });
      await assertSucceeds(asRole('EXECUTIVE').firestore().doc(`student_home_locations/${STU_ID}`).get());
    });
    it('denies deleting a home location', async () => {
      await seed();
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc(`student_home_locations/${STU_ID}`).set(loc());
      });
      await assertFails(asUser(STU_UID, ['STUDENT']).firestore().doc(`student_home_locations/${STU_ID}`).delete());
    });
    it('REGRESSION: reading a not-yet-created home-location doc does not error (listener before first save)', async () => {
      await seed();
      // ไม่มี doc — get ต้องผ่านแบบ "ไม่มีข้อมูล" ไม่ใช่ rule error
      await assertSucceeds(asUser(STU_UID, ['STUDENT']).firestore().doc('student_home_locations/never-created').get());
      await assertSucceeds(asUser(HR_TEACHER_UID, ['HOMEROOM_TEACHER'], { staffId: HR_TEACHER_UID }).firestore().doc('student_home_locations/never-created').get());
    });
    it('REGRESSION: stale studentUid copy in the doc (account relinked) — current linked uid still reads; old uid and others do not', async () => {
      await seed();
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc(`student_home_locations/${STU_ID}`).set(loc({ studentUid: 'old-uid-before-relink' }));
      });
      await assertSucceeds(asUser(STU_UID, ['STUDENT']).firestore().doc(`student_home_locations/${STU_ID}`).get());
      await assertFails(asUser('old-uid-before-relink', ['STUDENT']).firestore().doc(`student_home_locations/${STU_ID}`).get());
      await assertFails(asUser(PARENT_UID, ['PARENT']).firestore().doc(`student_home_locations/${STU_ID}`).get());
    });
  });

  // 17c. active_learning_logs — คะแนนกิจกรรมรายวิชา (ครูผู้ให้ + นักเรียนเจ้าของ + SUPER_ADMIN/EXECUTIVE เท่านั้น)
  describe('active_learning_logs collection (คะแนนกิจกรรมรายวิชา)', () => {
    const STU_UID = 'stu-uid-al';
    const STU_ID = 'al-std-1';
    const OTHER_STU_UID = 'stu-uid-al-2';
    const T_UID = 'teacher-uid-al';
    const T_STAFF = 'tch-al-001';
    const OTHER_T_UID = 'teacher-uid-al-2';
    const OTHER_T_STAFF = 'tch-al-002';

    const logDoc = (over: Record<string, unknown> = {}) => ({
      id: 'log-1', studentId: STU_ID, courseId: 'ค32102', courseName: 'คณิต ม.5/8', points: 2, category: 'ANSWER',
      awardedAt: '2026-10-13T03:00:00.000Z', teacherStaffId: T_STAFF, academicYear: '2569', term: '1', createdAt: new Date(),
      ...over,
    });
    const teacher = () => asUser(T_UID, ['SUBJECT_TEACHER'], { staffId: T_STAFF });
    const otherTeacher = () => asUser(OTHER_T_UID, ['SUBJECT_TEACHER'], { staffId: OTHER_T_STAFF });

    async function seed() {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc(`students/${STU_ID}`).set({ studentId: STU_ID, studentUid: STU_UID, room: 'ม.5/8' });
        await ctx.firestore().doc('active_learning_logs/log-1').set(logDoc());
      });
    }

    it('ครูผู้ให้คะแนนสร้าง log ของตัวเองได้ (teacherStaffId ตรง claim)', async () => {
      await seed();
      await assertSucceeds(teacher().firestore().doc('active_learning_logs/log-new').set(logDoc({ id: 'log-new' })));
    });
    it('ครูสร้าง log ในนามครูท่านอื่น / ไม่ระบุผู้ให้ / มี field แปลกปลอม ไม่ได้', async () => {
      await seed();
      await assertFails(teacher().firestore().doc('active_learning_logs/log-x').set(logDoc({ id: 'log-x', teacherStaffId: OTHER_T_STAFF })));
      const { teacherStaffId: _omit, ...noTeacher } = logDoc({ id: 'log-y' });
      await assertFails(teacher().firestore().doc('active_learning_logs/log-y').set(noTeacher));
      await assertFails(teacher().firestore().doc('active_learning_logs/log-z').set(logDoc({ id: 'log-z', behaviorScore: 100 })));
    });
    it('นักเรียนสร้าง/แก้/ลบ log ไม่ได้', async () => {
      await seed();
      const stu = asUser(STU_UID, ['STUDENT']);
      await assertFails(stu.firestore().doc('active_learning_logs/log-s').set(logDoc({ id: 'log-s' })));
      await assertFails(stu.firestore().doc('active_learning_logs/log-1').update({ points: 99 }));
      await assertFails(stu.firestore().doc('active_learning_logs/log-1').delete());
    });
    it('ครูแก้/ลบ log ย้อนหลังไม่ได้ (เฉพาะ SUPER_ADMIN)', async () => {
      await seed();
      await assertFails(teacher().firestore().doc('active_learning_logs/log-1').update({ points: 99 }));
      await assertFails(teacher().firestore().doc('active_learning_logs/log-1').delete());
      await assertSucceeds(asRole('SUPER_ADMIN').firestore().doc('active_learning_logs/log-1').update({ points: 3 }));
    });
    it('ครูอ่านได้เฉพาะที่ตนให้ — query where teacherStaffId ผ่าน, ครูท่านอื่นและ query ทั้งหมดไม่ผ่าน', async () => {
      await seed();
      const col = (c: ReturnType<typeof teacher>) => c.firestore().collection('active_learning_logs');
      await assertSucceeds(col(teacher()).where('teacherStaffId', '==', T_STAFF).get());
      await assertFails(col(otherTeacher()).where('teacherStaffId', '==', T_STAFF).get());
      await assertFails(col(teacher()).get());
      await assertFails(otherTeacher().firestore().doc('active_learning_logs/log-1').get());
    });
    it('นักเรียนเจ้าของอ่านของตัวเองได้ (where studentId) — คนอื่นอ่านไม่ได้', async () => {
      await seed();
      await assertSucceeds(asUser(STU_UID, ['STUDENT']).firestore().collection('active_learning_logs').where('studentId', '==', STU_ID).get());
      await assertFails(asUser(OTHER_STU_UID, ['STUDENT']).firestore().collection('active_learning_logs').where('studentId', '==', STU_ID).get());
      await assertFails(asUser(STU_UID, ['STUDENT']).firestore().collection('active_learning_logs').get());
    });
    it('REGRESSION: bare signed-in (ไม่มีบทบาท/ผู้ปกครอง/ครูที่ปรึกษาที่ไม่ใช่ผู้ให้) อ่านไม่ได้ ส่วน SUPER_ADMIN/EXECUTIVE อ่านได้', async () => {
      await seed();
      await assertFails(asUser('random-uid', []).firestore().doc('active_learning_logs/log-1').get());
      await assertFails(asUser('parent-uid', ['PARENT']).firestore().doc('active_learning_logs/log-1').get());
      await assertFails(asUser('hr-uid', ['HOMEROOM_TEACHER'], { staffId: 'tch-hr' }).firestore().doc('active_learning_logs/log-1').get());
      await assertSucceeds(asRole('SUPER_ADMIN').firestore().doc('active_learning_logs/log-1').get());
      await assertSucceeds(asRole('EXECUTIVE').firestore().collection('active_learning_logs').get());
    });

    describe('ผู้ปกครอง + ครูที่ปรึกษา อ่านได้ (denormalize homeroomClass)', () => {
      const PARENT_UID = 'parent-uid-al';
      const HR_UID = 'hr-uid-al';
      const HR_STAFF = 'tch-hr-al';
      async function seedFamily() {
        await seed();
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
          await ctx.firestore().doc(`students/${STU_ID}`).set({ studentId: STU_ID, studentUid: STU_UID, parentUid: PARENT_UID, room: 'ม.5/8' });
          await ctx.firestore().doc(`staff/${HR_STAFF}`).set({ roles: ['HOMEROOM_TEACHER'], assignments: { homeroomClass: 'ม.5/8' } });
          await ctx.firestore().doc('staff/tch-hr-other').set({ roles: ['HOMEROOM_TEACHER'], assignments: { homeroomClass: 'ม.6/1' } });
          await ctx.firestore().doc('active_learning_logs/log-room').set(logDoc({ id: 'log-room', homeroomClass: 'ม.5/8' }));
        });
      }
      const parent = (uid = PARENT_UID) => asUser(uid, ['PARENT']);
      const hr = (uid = HR_UID, staffId = HR_STAFF) => asUser(uid, ['HOMEROOM_TEACHER'], { staffId });
      const col = (c: ReturnType<typeof teacher>) => c.firestore().collection('active_learning_logs');

      it('ผู้ปกครองตัวจริงอ่านของบุตรได้ (where studentId) — ผู้ปกครองคนอื่น/query ทั้งหมดไม่ได้', async () => {
        await seedFamily();
        await assertSucceeds(col(parent()).where('studentId', '==', STU_ID).get());
        await assertFails(col(parent('parent-uid-other')).where('studentId', '==', STU_ID).get());
        await assertFails(col(parent()).get());
      });
      it('ผู้ปกครองสร้าง/แก้/ลบ log ไม่ได้', async () => {
        await seedFamily();
        await assertFails(parent().firestore().doc('active_learning_logs/log-p').set(logDoc({ id: 'log-p' })));
        await assertFails(parent().firestore().doc('active_learning_logs/log-1').update({ points: 99 }));
        await assertFails(parent().firestore().doc('active_learning_logs/log-1').delete());
      });
      it('REGRESSION: นักเรียนเปลี่ยนผู้ปกครอง (relink) — ผู้ปกครองเก่าอ่านไม่ได้ตาม registry', async () => {
        await seedFamily();
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
          await ctx.firestore().doc(`students/${STU_ID}`).update({ parentUid: 'parent-uid-new' });
        });
        await assertFails(col(parent()).where('studentId', '==', STU_ID).get());
        await assertSucceeds(col(parent('parent-uid-new')).where('studentId', '==', STU_ID).get());
      });
      it('ครูที่ปรึกษาอ่านของห้องตัวเองได้ (where homeroomClass) — ห้องอื่น/query ทั้งหมดไม่ได้', async () => {
        await seedFamily();
        await assertSucceeds(col(hr()).where('homeroomClass', '==', 'ม.5/8').get());
        await assertFails(col(hr('hr-uid-other', 'tch-hr-other')).where('homeroomClass', '==', 'ม.5/8').get());
        await assertFails(col(hr()).get());
        await assertFails(hr().firestore().doc('active_learning_logs/log-1').get()); // log รุ่นเก่าไม่มี homeroomClass
      });
      it('create: homeroomClass ต้องตรง students.room จริง (กัน denormalize มั่วเพื่อเปิดให้ครูห้องอื่นอ่าน)', async () => {
        await seedFamily();
        await assertSucceeds(teacher().firestore().doc('active_learning_logs/log-hr-ok').set(logDoc({ id: 'log-hr-ok', homeroomClass: 'ม.5/8' })));
        await assertFails(teacher().firestore().doc('active_learning_logs/log-hr-bad').set(logDoc({ id: 'log-hr-bad', homeroomClass: 'ม.6/1' })));
      });
    });
  });

  // 18. department_config — แอดมินจัดการกลุ่มสาระฯ
  describe('department_config collection', () => {
    it('lets any signed-in user read', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('department_config/math-dept').set({ name: 'คณิต', order: 1 });
      });
      await assertSucceeds(asRole('SUBJECT_TEACHER').firestore().doc('department_config/math-dept').get());
      await assertSucceeds(asUser('stu-1', ['STUDENT']).firestore().doc('department_config/math-dept').get());
    });
    it('only SUPER_ADMIN may write', async () => {
      await assertSucceeds(asRole('SUPER_ADMIN').firestore().doc('department_config/new-dept').set({ name: 'ใหม่', order: 5 }));
      await assertFails(asRole('HEAD_OF_DEPARTMENT').firestore().doc('department_config/bad').set({ name: 'x' }));
      await assertFails(asRole('SUBJECT_TEACHER').firestore().doc('department_config/bad').set({ name: 'x' }));
      await assertFails(asAnonymous().firestore().doc('department_config/bad').set({ name: 'x' }));
    });
  });

  // 19. elective_activities_config — ชุมนุมที่แอดมินงานชุมนุมสร้างชื่อ+จำนวนรับ+ครูรับผิดชอบเอง
  // (ออกแบบใหม่ — ไม่ผูกกับ subjectCode ที่ import จากตารางสอนอีกต่อไป)
  describe('elective_activities_config collection', () => {
    it('lets any signed-in user read', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('elective_activities_config/club-1').set({ name: 'ชุมนุมคอมพิวเตอร์', capacity: 20, responsibleTeacherUids: ['teacher-club-uid'], responsibleTeacherNames: ['ครูเอ'], enrollmentStatus: 'OPEN' });
      });
      await assertSucceeds(asRole('SUBJECT_TEACHER').firestore().doc('elective_activities_config/club-1').get());
      await assertSucceeds(asUser('stu-1', ['STUDENT']).firestore().doc('elective_activities_config/club-1').get());
    });
    it('denies anonymous read (ต้อง signed-in)', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('elective_activities_config/club-x').set({ name: 'X', capacity: 10, responsibleTeacherUids: ['t-x'], responsibleTeacherNames: ['X'], enrollmentStatus: 'OPEN' });
      });
      await assertFails(asAnonymous().firestore().doc('elective_activities_config/club-x').get());
    });
    it('allows SUPER_ADMIN and ACADEMIC_HEAD to write; denies other roles', async () => {
      await assertSucceeds(
        asRole('SUPER_ADMIN').firestore().doc('elective_activities_config/club-a').set({ name: 'A', capacity: 10, responsibleTeacherUids: ['t-a'], responsibleTeacherNames: ['ครู A'], enrollmentStatus: 'OPEN' })
      );
      await assertSucceeds(
        asRole('ACADEMIC_HEAD').firestore().doc('elective_activities_config/club-b').set({ name: 'B', capacity: 15, responsibleTeacherUids: ['t-b'], responsibleTeacherNames: ['ครู B'], enrollmentStatus: 'OPEN' })
      );
      await assertFails(
        asRole('SUBJECT_TEACHER').firestore().doc('elective_activities_config/club-c').set({ name: 'C', capacity: 10, responsibleTeacherUids: ['t-c'], responsibleTeacherNames: ['ครู C'], enrollmentStatus: 'OPEN' })
      );
      await assertFails(
        asRole('HEAD_OF_DEPARTMENT').firestore().doc('elective_activities_config/club-d').set({ name: 'D', capacity: 10, responsibleTeacherUids: ['t-d'], responsibleTeacherNames: ['ครู D'], enrollmentStatus: 'OPEN' })
      );
    });
  });

  // 20. activity_enrollments — สมัคร/ถอนชุมนุม (ผูกกับ activityId แทน scheduleId/subjectCode เดิม)
  describe('activity_enrollments collection', () => {
    const seedStudentAndClub = async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('students/std-e1').set({ studentId: 'std-e1', studentUid: 'stu-e1-uid', name: 'นักเรียน E1' });
        await ctx.firestore().doc('students/std-e2').set({ studentId: 'std-e2', studentUid: 'stu-e2-uid', name: 'นักเรียน E2' });
        // ตั้งใจให้มีครูรับผิดชอบร่วม 2 คน (teacher-club-uid, teacher-club-uid-2) — ยืนยันแล้วว่าเป็น
        // รูปแบบจริงที่เกิดบ่อย ไม่ใช่ edge case (ดู TASK 3 ในชุดใหญ่เดียวกันนี้)
        await ctx.firestore().doc('elective_activities_config/club-1').set({ name: 'ชุมนุมคอมพิวเตอร์', capacity: 20, responsibleTeacherUids: ['teacher-club-uid', 'teacher-club-uid-2'], responsibleTeacherNames: ['ครูเอ', 'ครูบี'], enrollmentStatus: 'OPEN' });
      });
    };

    it('lets any signed-in user read (ต้องเห็นจำนวนคนสมัครเพื่อคำนวณที่นั่งเหลือ)', async () => {
      await seedStudentAndClub();
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('activity_enrollments/club-1_std-e1').set({
          activityId: 'club-1', studentId: 'std-e1', studentUid: 'stu-e1-uid',
          removedAt: null, removedBy: null, removedReason: null,
        });
      });
      await assertSucceeds(asUser('stu-e2-uid', ['STUDENT']).firestore().doc('activity_enrollments/club-1_std-e1').get());
    });

    it('นักเรียนสมัคร (create) ของตัวเองเท่านั้นสำเร็จ — สมัครแทนคนอื่นถูกปฏิเสธ', async () => {
      await seedStudentAndClub();
      await assertSucceeds(
        asUser('stu-e1-uid', ['STUDENT']).firestore().doc('activity_enrollments/club-1_std-e1').set({
          activityId: 'club-1', studentId: 'std-e1', studentUid: 'stu-e1-uid',
          removedAt: null, removedBy: null, removedReason: null,
        })
      );
      // stu-e2-uid พยายามสมัครแทน std-e1 (studentId ไม่ตรงกับ studentUid ของตัวเอง)
      await assertFails(
        asUser('stu-e2-uid', ['STUDENT']).firestore().doc('activity_enrollments/club-1_std-e1_fake').set({
          activityId: 'club-1', studentId: 'std-e1', studentUid: 'stu-e2-uid',
          removedAt: null, removedBy: null, removedReason: null,
        })
      );
    });

    it('สมัครใหม่หลังถอน: นักเรียนเจ้าของ update กลับเป็น active ได้; คนอื่น/แก้ฟิลด์อื่น/ชุมนุมปิด ถูกปฏิเสธ', async () => {
      await seedStudentAndClub();
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('activity_enrollments/club-1_std-e1').set({
          id: 'club-1_std-e1', activityId: 'club-1', studentId: 'std-e1', studentUid: 'stu-e1-uid',
          removedAt: new Date().toISOString(), removedBy: null, removedReason: null,
        });
      });
      const reenroll = { enrolledAt: new Date().toISOString(), removedAt: null, removedBy: null, removedReason: null };
      await assertFails(asUser('stu-e2-uid', ['STUDENT']).firestore().doc('activity_enrollments/club-1_std-e1').update(reenroll));
      await assertFails(asUser('stu-e1-uid', ['STUDENT']).firestore().doc('activity_enrollments/club-1_std-e1').update({ ...reenroll, studentUid: 'stu-e2-uid' }));
      await assertFails(asUser('stu-e1-uid', ['STUDENT']).firestore().doc('activity_enrollments/club-1_std-e1').update({ ...reenroll, activityId: 'club-2' }));
      await testEnv.withSecurityRulesDisabled(async (ctx) => { await ctx.firestore().doc('elective_activities_config/club-1').update({ enrollmentStatus: 'CLOSED' }); });
      await assertFails(asUser('stu-e1-uid', ['STUDENT']).firestore().doc('activity_enrollments/club-1_std-e1').update(reenroll));
      await testEnv.withSecurityRulesDisabled(async (ctx) => { await ctx.firestore().doc('elective_activities_config/club-1').update({ enrollmentStatus: 'OPEN' }); });
      await assertSucceeds(asUser('stu-e1-uid', ['STUDENT']).firestore().doc('activity_enrollments/club-1_std-e1').update(reenroll));
      // active แล้วสมัครซ้ำผ่าน update ไม่ได้ (ต้องเคยถอนเท่านั้น)
      await assertFails(asUser('stu-e1-uid', ['STUDENT']).firestore().doc('activity_enrollments/club-1_std-e1').update({ ...reenroll, enrolledAt: new Date(Date.now() + 1000).toISOString() }));
    });

    it('ครูที่ไม่ใช่ผู้รับผิดชอบชุมนุมนั้นถอนชื่อนักเรียนไม่ได้', async () => {
      await seedStudentAndClub();
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('activity_enrollments/club-1_std-e1').set({
          activityId: 'club-1', studentId: 'std-e1', studentUid: 'stu-e1-uid',
          removedAt: null, removedBy: null, removedReason: null,
        });
      });
      // ครูคนอื่น (ไม่ใช่ teacher-club-uid ที่รับผิดชอบ club-1)
      await assertFails(
        asUser('teacher-other-uid', ['SUBJECT_TEACHER']).firestore().doc('activity_enrollments/club-1_std-e1').update({
          removedAt: new Date().toISOString(), removedBy: 'teacher-other-uid', removedReason: 'ทดสอบ',
        })
      );
      // ครูรับผิดชอบชุมนุมถอนได้จริง
      await assertSucceeds(
        asUser('teacher-club-uid', ['SUBJECT_TEACHER'], { staffId: 'teacher-club-uid' }).firestore().doc('activity_enrollments/club-1_std-e1').update({
          removedAt: new Date().toISOString(), removedBy: 'teacher-club-uid', removedReason: 'ไม่ผ่านคัดเลือก นศท',
        })
      );
    });

    it('ครูร่วมสอนคนที่ 2 ในชุมนุมเดียวกัน (responsibleTeacherUids array) ถอนชื่อนักเรียนได้เหมือนกัน', async () => {
      await seedStudentAndClub();
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('activity_enrollments/club-1_std-e2').set({
          activityId: 'club-1', studentId: 'std-e2', studentUid: 'stu-e2-uid',
          removedAt: null, removedBy: null, removedReason: null,
        });
      });
      // teacher-club-uid-2 คือครูร่วมสอนคนที่ 2 ใน responsibleTeacherUids ของ club-1 (ไม่ใช่คนแรก)
      await assertSucceeds(
        asUser('teacher-club-uid-2', ['SUBJECT_TEACHER'], { staffId: 'teacher-club-uid-2' }).firestore().doc('activity_enrollments/club-1_std-e2').update({
          removedAt: new Date().toISOString(), removedBy: 'teacher-club-uid-2', removedReason: 'ทดสอบครูร่วมสอน',
        })
      );
    });

    // responsibleTeacherUids เก็บ staff doc id (teacherId) ไม่ใช่ Auth UID — ตัวตนครู = claim staffId เท่านั้น
    describe('isResponsibleTeacherOfActivity matches claim staffId, never auth.uid', () => {
      const STAFF_ID = 'teacher-17';          // doc id จากไฟล์ import (อยู่ใน responsibleTeacherUids)
      const REAL_UID = 'firebase-uid-k9x';    // Auth UID ของครูคนเดียวกัน — ไม่เท่ากับ staffId
      const seedClub = async () => {
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
          await ctx.firestore().doc('students/std-s1').set({ studentId: 'std-s1', studentUid: 'stu-s1-uid', name: 'นักเรียน S1' });
          await ctx.firestore().doc('elective_activities_config/club-s').set({ name: 'ชุมนุม S', capacity: 10, responsibleTeacherUids: [STAFF_ID], responsibleTeacherNames: ['ครู S'], enrollmentStatus: 'OPEN' });
          await ctx.firestore().doc('activity_enrollments/club-s_std-s1').set({
            activityId: 'club-s', studentId: 'std-s1', studentUid: 'stu-s1-uid',
            removedAt: null, removedBy: null, removedReason: null,
          });
        });
      };
      const withdraw = (removedBy: string) => ({ removedAt: new Date().toISOString(), removedBy, removedReason: 'ทดสอบ staffId' });

      it('lets the teacher whose staffId is in responsibleTeacherUids withdraw (uid ≠ staffId)', async () => {
        await seedClub();
        await assertSucceeds(
          asUser(REAL_UID, ['SUBJECT_TEACHER'], { staffId: STAFF_ID }).firestore().doc('activity_enrollments/club-s_std-s1').update(withdraw(REAL_UID))
        );
      });

      it('REGRESSION: denies a user whose uid equals the listed id but whose staffId does not', async () => {
        await seedClub();
        // uid ตรงกับค่าใน responsibleTeacherUids แต่ staffId เป็นคนอื่น → ห้าม
        await assertFails(
          asUser(STAFF_ID, ['SUBJECT_TEACHER'], { staffId: 'teacher-99' }).firestore().doc('activity_enrollments/club-s_std-s1').update(withdraw(STAFF_ID))
        );
        // uid ตรงแต่ไม่มี claim staffId เลย (ไม่มี fallback ไป uid) → ห้าม
        await assertFails(
          asUser(STAFF_ID, ['SUBJECT_TEACHER']).firestore().doc('activity_enrollments/club-s_std-s1').update(withdraw(STAFF_ID))
        );
      });
    });

    it('นักเรียนถอนตัวเอง (removedBy ต้องเป็น null) สำเร็จ — ปลอม removedBy เป็นคนอื่นไม่ได้', async () => {
      await seedStudentAndClub();
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('activity_enrollments/club-1_std-e1').set({
          activityId: 'club-1', studentId: 'std-e1', studentUid: 'stu-e1-uid',
          removedAt: null, removedBy: null, removedReason: null,
        });
      });
      await assertFails(
        asUser('stu-e1-uid', ['STUDENT']).firestore().doc('activity_enrollments/club-1_std-e1').update({
          removedAt: new Date().toISOString(), removedBy: 'someone-else-uid', removedReason: 'เปลี่ยนใจ',
        })
      );
      await assertSucceeds(
        asUser('stu-e1-uid', ['STUDENT']).firestore().doc('activity_enrollments/club-1_std-e1').update({
          removedAt: new Date().toISOString(), removedBy: null, removedReason: 'เปลี่ยนใจ',
        })
      );
    });

    it('ห้ามลบ document จริงเด็ดขาด (เก็บประวัติไว้เสมอ)', async () => {
      await seedStudentAndClub();
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('activity_enrollments/club-1_std-e1').set({
          activityId: 'club-1', studentId: 'std-e1', studentUid: 'stu-e1-uid',
          removedAt: null, removedBy: null, removedReason: null,
        });
      });
      await assertFails(asRole('SUPER_ADMIN').firestore().doc('activity_enrollments/club-1_std-e1').delete());
      await assertFails(asUser('stu-e1-uid', ['STUDENT']).firestore().doc('activity_enrollments/club-1_std-e1').delete());
    });
  });

  // 21. activity_enrollment_counts — ตัวนับที่นั่งต่อ activityId (derived, sync คู่ enrollment)
  describe('activity_enrollment_counts collection', () => {
    it('lets any signed-in user read', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('activity_enrollment_counts/club-1').set({ count: 5 });
      });
      await assertSucceeds(asUser('stu-1', ['STUDENT']).firestore().doc('activity_enrollment_counts/club-1').get());
    });
    it('allows STUDENT/TEACHER/SUPER_ADMIN to write a valid non-negative count; denies PARENT and negative values', async () => {
      await assertSucceeds(asUser('stu-1', ['STUDENT']).firestore().doc('activity_enrollment_counts/club-a').set({ count: 1 }));
      await assertSucceeds(asRole('SUBJECT_TEACHER').firestore().doc('activity_enrollment_counts/club-b').set({ count: 2 }));
      await assertFails(asRole('PARENT').firestore().doc('activity_enrollment_counts/club-c').set({ count: 1 }));
      await assertFails(asUser('stu-1', ['STUDENT']).firestore().doc('activity_enrollment_counts/club-d').set({ count: -1 }));
    });
  });

  // 22. house_config (คณะสี) — รากฐานระบบคะแนนถ้วยในอนาคต
  describe('house_config collection', () => {
    it('lets any signed-in user read; only SUPER_ADMIN/ACADEMIC_HEAD write', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('house_config/house-red').set({ name: 'คณะสีแดง', colorHex: '#ef4444', assignmentMode: 'SINGLE_PER_ROOM' });
      });
      await assertSucceeds(asUser('stu-1', ['STUDENT']).firestore().doc('house_config/house-red').get());
      await assertSucceeds(asRole('SUPER_ADMIN').firestore().doc('house_config/house-blue').set({ name: 'คณะสีน้ำเงิน', colorHex: '#3b82f6', assignmentMode: 'MIXED' }));
      await assertSucceeds(asRole('ACADEMIC_HEAD').firestore().doc('house_config/house-green').set({ name: 'คณะสีเขียว', colorHex: '#22c55e', assignmentMode: 'MIXED' }));
      await assertFails(asRole('SUBJECT_TEACHER').firestore().doc('house_config/house-bad').set({ name: 'x', colorHex: '#000', assignmentMode: 'MIXED' }));
    });
  });

  // 22.1 school_calendar_events (วันหยุดพิเศษ + วันเปิด-ปิดภาคเรียน) — แยกจาก school_settings/
  // system_locks (คนละเรื่องกัน) — อ่านได้ทุกคน signed-in เขียน/แก้ไข/ลบเฉพาะ SUPER_ADMIN เท่านั้น
  describe('school_calendar_events collection', () => {
    it('lets any signed-in user read; denies anonymous', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('school_calendar_events/ev-1').set({
          date: '2026-04-13', type: 'HOLIDAY', name: 'วันสงกรานต์', academicYear: '2569', semester: null,
        });
      });
      await assertSucceeds(asRole('SUBJECT_TEACHER').firestore().doc('school_calendar_events/ev-1').get());
      await assertSucceeds(asUser('stu-1', ['STUDENT']).firestore().doc('school_calendar_events/ev-1').get());
      await assertFails(asAnonymous().firestore().doc('school_calendar_events/ev-1').get());
    });

    it('allows only SUPER_ADMIN to write/delete; denies every other role including ACADEMIC_HEAD', async () => {
      await assertSucceeds(
        asRole('SUPER_ADMIN').firestore().doc('school_calendar_events/ev-2').set({
          date: '2026-04-14', type: 'HOLIDAY', name: 'วันสงกรานต์ (วันที่ 2)', academicYear: '2569', semester: null,
        })
      );
      await assertFails(
        asRole('ACADEMIC_HEAD').firestore().doc('school_calendar_events/ev-3').set({
          date: '2026-04-15', type: 'HOLIDAY', name: 'วันสงกรานต์ (วันที่ 3)', academicYear: '2569', semester: null,
        })
      );
      await assertFails(
        asRole('SUBJECT_TEACHER').firestore().doc('school_calendar_events/ev-4').set({
          date: '2026-05-01', type: 'HOLIDAY', name: 'วันแรงงาน', academicYear: '2569', semester: null,
        })
      );
      await assertSucceeds(asRole('SUPER_ADMIN').firestore().doc('school_calendar_events/ev-2').delete());
      await assertFails(asRole('ACADEMIC_HEAD').firestore().doc('school_calendar_events/ev-2').delete());
    });
  });

  // 23. REAL race condition — 2 นักเรียนสมัครที่นั่งสุดท้ายพร้อมกัน ต้องมีแค่คนเดียวสำเร็จ
  // (ยิงผ่าน enrollInActivity จริงจาก services/firestoreService.ts ไม่ใช่จำลองแยก — ทดสอบโค้ด
  // เดียวกับที่ใช้งานจริง โดยส่ง context.firestore() ของ rules-testing SDK เข้าไปแทน db ของแอป)
  describe('ELECTIVE enrollment — real race condition (Firestore transaction)', () => {
    it('capacity เต็มพอดี 1 ที่นั่ง — 2 คนสมัครพร้อมกัน มีแค่ 1 คนสำเร็จ อีกคน error "เต็มแล้ว"', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('students/std-race-1').set({ studentId: 'std-race-1', studentUid: 'race-uid-1' });
        await ctx.firestore().doc('students/std-race-2').set({ studentId: 'std-race-2', studentUid: 'race-uid-2' });
      });

      const dbA = asUser('race-uid-1', ['STUDENT']).firestore();
      const dbB = asUser('race-uid-2', ['STUDENT']).firestore();

      const results = await Promise.allSettled([
        enrollInActivity({ activityId: 'club-race-last-seat', studentId: 'std-race-1', studentUid: 'race-uid-1', capacity: 1 }, dbA as any),
        enrollInActivity({ activityId: 'club-race-last-seat', studentId: 'std-race-2', studentUid: 'race-uid-2', capacity: 1 }, dbB as any),
      ]);

      const fulfilled = results.filter(r => r.status === 'fulfilled');
      const rejected = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[];
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason.message).toContain('เต็มแล้ว');

      // ตัวนับที่นั่งต้องหยุดที่ 1 พอดี ไม่ใช่ 2 (ไม่ oversell)
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const counterSnap = await ctx.firestore().doc('activity_enrollment_counts/club-race-last-seat').get();
        expect(counterSnap.data()?.count).toBe(1);
      });
    });

    it('ถอนตัวแล้วที่นั่งว่างขึ้นทันที ให้คนอื่นสมัครแทนได้', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('students/std-w1').set({ studentId: 'std-w1', studentUid: 'w-uid-1' });
        await ctx.firestore().doc('students/std-w2').set({ studentId: 'std-w2', studentUid: 'w-uid-2' });
      });
      const dbW1 = asUser('w-uid-1', ['STUDENT']).firestore();
      const dbW2 = asUser('w-uid-2', ['STUDENT']).firestore();

      await enrollInActivity({ activityId: 'club-withdraw-1', studentId: 'std-w1', studentUid: 'w-uid-1', capacity: 1 }, dbW1 as any);
      // ที่นั่งเต็มแล้ว — คนที่ 2 สมัครไม่ได้
      await expect(
        enrollInActivity({ activityId: 'club-withdraw-1', studentId: 'std-w2', studentUid: 'w-uid-2', capacity: 1 }, dbW2 as any)
      ).rejects.toThrow('เต็มแล้ว');

      // คนแรกถอนตัว
      await withdrawFromActivity({ activityId: 'club-withdraw-1', studentId: 'std-w1', removedBy: null, removedReason: null }, dbW1 as any);

      // คนที่ 2 สมัครสำเร็จหลังที่นั่งว่าง
      await expect(
        enrollInActivity({ activityId: 'club-withdraw-1', studentId: 'std-w2', studentUid: 'w-uid-2', capacity: 1 }, dbW2 as any)
      ).resolves.not.toThrow();
    });

    it('นักเรียนที่ถูกครูถอน สมัครชุมนุมอื่นที่ยังว่างได้สำเร็จ', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('students/std-r1').set({ studentId: 'std-r1', studentUid: 'r-uid-1' });
        await ctx.firestore().doc('elective_activities_config/club-ra').set({ name: 'ชุมนุม RA', capacity: 5, responsibleTeacherUids: ['teacher-ra-uid'], responsibleTeacherNames: ['ครู RA'], enrollmentStatus: 'OPEN' });
      });
      const dbR = asUser('r-uid-1', ['STUDENT']).firestore();

      await enrollInActivity({ activityId: 'club-ra', studentId: 'std-r1', studentUid: 'r-uid-1', capacity: 5 }, dbR as any);

      // ครูรับผิดชอบ club-ra ถอนนักเรียนคนนี้ (ไม่ผ่านคัดเลือก)
      const dbTeacher = asUser('teacher-ra-uid', ['SUBJECT_TEACHER'], { staffId: 'teacher-ra-uid' }).firestore();
      await withdrawFromActivity({ activityId: 'club-ra', studentId: 'std-r1', removedBy: 'teacher-ra-uid', removedReason: 'ไม่ผ่านคัดเลือก นศท' }, dbTeacher as any);

      // นักเรียนคนเดิมสมัครชุมนุมอื่นที่ยังว่างได้
      await expect(
        enrollInActivity({ activityId: 'club-rb', studentId: 'std-r1', studentUid: 'r-uid-1', capacity: 5 }, dbR as any)
      ).resolves.not.toThrow();
    });
  });

  // student_screenings_2q — doc id คือรหัสนักเรียน 5 หลัก ไม่ใช่ Auth UID
  // REGRESSION: isSelf(studentId) เดิมเทียบ auth.uid กับรหัส 5 หลักตรงๆ ไม่มีวันจริง แก้เป็น
  // isSelfStudent() ที่เทียบผ่าน students/{studentId}.studentUid จริงแทน
  // (9Q/8Q และสิทธิ์ตามบทบาท x มี/ไม่มีครูแนะแนว ทดสอบละเอียดที่ firestore.screening.rules.test.ts)
  describe('student_screenings_2q + legacy student_screenings_phq9 collections', () => {
    const STU_UID = 'stu-uid-scr1';
    const STU_ID = 'scr-std-1';
    const OTHER_UID = 'stu-uid-scr2';

    async function seed() {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc(`students/${STU_ID}`).set({ studentId: STU_ID, studentUid: STU_UID, room: 'ม.5/8' });
      });
    }

    it('REGRESSION: lets the real student (matched via students/{id}.studentUid) write their own 2Q, denies a different signed-in student', async () => {
      await seed();
      await assertSucceeds(asUser(STU_UID, ['STUDENT']).firestore().doc(`student_screenings_2q/${STU_ID}`).set({
        id: '2q-1', studentId: STU_ID, q1Depressed: false, q2Hopeless: true, isPositive: true, conductedAt: '2026-09-01',
      }));
      await assertFails(asUser(OTHER_UID, ['STUDENT']).firestore().doc(`student_screenings_2q/${STU_ID}`).set({
        id: '2q-2', studentId: STU_ID, q1Depressed: false, q2Hopeless: false, isPositive: false, conductedAt: '2026-09-01',
      }));
    });

    it('the international PHQ-9 collection is retired: nobody can write it (not even the student or an admin); only GUIDANCE_COUNSELOR/SUPER_ADMIN can still read old data', async () => {
      await seed();
      const doc = { id: 'phq-1', studentId: STU_ID, answers: [2, 2, 2, 2, 2, 2, 2, 2, 2], totalScore: 18, riskLevel: 'SEVERE', recommendation: 'ทดสอบ', conductedAt: '2026-09-01' };
      await assertFails(asUser(STU_UID, ['STUDENT']).firestore().doc(`student_screenings_phq9/${STU_ID}`).set(doc));
      await assertFails(asRole('SUPER_ADMIN').firestore().doc(`student_screenings_phq9/${STU_ID}`).set(doc));
      await assertFails(asRole('GUIDANCE_COUNSELOR').firestore().doc(`student_screenings_phq9/${STU_ID}`).set(doc));
      await testEnv.withSecurityRulesDisabled(async (ctx) => { await ctx.firestore().doc(`student_screenings_phq9/${STU_ID}`).set(doc); });
      await assertSucceeds(asRole('GUIDANCE_COUNSELOR').firestore().doc(`student_screenings_phq9/${STU_ID}`).get());
      await assertSucceeds(asRole('SUPER_ADMIN').firestore().doc(`student_screenings_phq9/${STU_ID}`).get());
      for (const who of [asRole('HOMEROOM_TEACHER'), asRole('EXECUTIVE'), asUser(STU_UID, ['STUDENT']), asUser(OTHER_UID, ['STUDENT'])]) {
        await assertFails(who.firestore().doc(`student_screenings_phq9/${STU_ID}`).get());
      }
    });

    it('PARENT: ผู้ปกครองตัวจริง (students.parentUid) อ่าน 2Q และบันทึก "แจ้งผู้ปกครองแล้ว" ของบุตรหลานได้ แต่เขียน 2Q ไม่ได้ และผู้ปกครองคนอื่นอ่านไม่ได้', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc(`students/${STU_ID}`).set({ studentId: STU_ID, studentUid: STU_UID, room: 'ม.5/8', parentUid: 'parent-real' });
        await ctx.firestore().doc(`student_screenings_2q/${STU_ID}`).set({ id: '2q-p', studentId: STU_ID, q1Depressed: true, q2Hopeless: false, isPositive: true, conductedAt: '2026-09-01' });
        await ctx.firestore().doc(`student_screening_notices/${STU_ID}/entries/n1`).set({ scope: 'NINE_Q', screeningId: 'x', notifiedByUid: 't', notifiedByName: 'ครู', notifiedAt: '2026-09-02', method: 'PHONE' });
      });
      const parent = asUser('parent-real', ['PARENT']).firestore();
      const other = asUser('parent-other', ['PARENT']).firestore();
      await assertSucceeds(parent.doc(`student_screenings_2q/${STU_ID}`).get());
      await assertSucceeds(parent.collection(`student_screening_notices/${STU_ID}/entries`).get());
      await assertFails(parent.doc(`student_screenings_2q/${STU_ID}`).set({ id: '2q-p2', studentId: STU_ID, q1Depressed: false, q2Hopeless: false, isPositive: false, conductedAt: '2026-09-03' }));
      await assertFails(parent.collection(`student_screening_notices/${STU_ID}/entries`).add({ scope: 'NINE_Q', screeningId: 'x', notifiedByUid: 'parent-real', notifiedByName: 'x', notifiedAt: '2026-09-03', method: 'PHONE' }));
      await assertFails(other.doc(`student_screenings_2q/${STU_ID}`).get());
      await assertFails(other.collection(`student_screening_notices/${STU_ID}/entries`).get());
      // 9Q/8Q ผู้ปกครองยังอ่านไม่ได้เหมือนเดิม
      await assertFails(parent.doc(`student_screenings_9q/${STU_ID}`).get());
      await assertFails(parent.doc(`student_screenings_8q/${STU_ID}`).get());
    });

    it('TASK 5 (ExecutivePortal Health): EXECUTIVE can still read 2Q for school-wide counts (no identities shown in the UI)', async () => {
      await seed();
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc(`student_screenings_2q/${STU_ID}`).set({
          id: '2q-3', studentId: STU_ID, q1Depressed: true, q2Hopeless: false, isPositive: true, conductedAt: '2026-09-01',
        });
      });
      await assertSucceeds(asRole('EXECUTIVE').firestore().doc(`student_screenings_2q/${STU_ID}`).get());
    });
  });

  // student_assessments_sdq — read access baseline (write path ยังมีปัญหา evaluator self-check
  // ที่ยังไม่แก้ในรอบนี้ ดูรายละเอียดในคำตอบท้ายงาน — ต้องตัดสินใจ scope เพิ่มก่อนแก้)
  describe('student_assessments_sdq collection (read baseline)', () => {
    it('lets GUIDANCE_COUNSELOR/HOMEROOM_TEACHER/SUPER_ADMIN read; denies an unrelated signed-in user', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('student_assessments_sdq/sdq-1').set({
          id: 'sdq-1', studentId: 'sdq-std-1', studentUid: 'sdq-std-uid-1', respondentUid: 'teacher-uid-x',
          evaluatorType: 'TEACHER', evaluatorName: 'ครูทดสอบ',
          subscaleScores: { emotional: 1, conduct: 1, hyperactivity: 1, peerProblems: 1, prosocial: 8 },
          totalDifficultiesScore: 4, triagingStatus: 'NORMAL', assessmentDate: '2026-09-01', recommendations: [],
        });
      });
      await assertSucceeds(asRole('GUIDANCE_COUNSELOR').firestore().doc('student_assessments_sdq/sdq-1').get());
      await assertSucceeds(asRole('HOMEROOM_TEACHER').firestore().doc('student_assessments_sdq/sdq-1').get());
      await assertSucceeds(asRole('SUPER_ADMIN').firestore().doc('student_assessments_sdq/sdq-1').get());
      await assertSucceeds(asRole('EXECUTIVE').firestore().doc('student_assessments_sdq/sdq-1').get());
      await assertFails(asUser('unrelated-uid', ['STUDENT']).firestore().doc('student_assessments_sdq/sdq-1').get());
    });

    it('lets the student (studentUid match) and the respondent themselves read; denies everyone else', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('student_assessments_sdq/sdq-1b').set({
          id: 'sdq-1b', studentId: 'sdq-std-1b', studentUid: 'sdq-std-uid-1b', respondentUid: 'parent-uid-1b',
          evaluatorType: 'PARENT', evaluatorName: 'ผู้ปกครองทดสอบ',
          subscaleScores: { emotional: 1, conduct: 1, hyperactivity: 1, peerProblems: 1, prosocial: 8 },
          totalDifficultiesScore: 4, triagingStatus: 'NORMAL', assessmentDate: '2026-09-01', recommendations: [],
        });
      });
      await assertSucceeds(asUser('sdq-std-uid-1b', ['STUDENT']).firestore().doc('student_assessments_sdq/sdq-1b').get());
      await assertSucceeds(asUser('parent-uid-1b', ['PARENT']).firestore().doc('student_assessments_sdq/sdq-1b').get());
      await assertFails(asUser('other-parent', ['PARENT']).firestore().doc('student_assessments_sdq/sdq-1b').get());
    });

    // FIX (ยืนยันจากโรงเรียน): SDQ กรอกได้ 3 กลุ่ม (นักเรียนเอง/ผู้ปกครอง/ครูที่ปรึกษาห้องนั้นจริง)
    // เดิม rule เช็คแค่ self-attestation (evaluatorId==auth.uid ที่ผู้เขียนใส่เอง) — ไม่ตรวจความสัมพันธ์
    // จริงเลย ทำให้ใครก็เขียนให้เด็กคนไหนก็ได้แค่ระบุ uid ตัวเอง แก้เป็นตรวจสอบจริงผ่าน students/{id}
    describe('create — verified respondent relationship (3 valid paths + denials)', () => {
      const STU_UID = 'sdq2-stu-uid';
      const STU_ID = 'sdq2-std-1';
      const ROOM = 'ม.5/8';
      const PARENT_UID = 'sdq2-parent-uid';
      const HR_TEACHER_UID = 'sdq2-hr-teacher';

      const YEAR = '2569';
      // doc id ตายตัว {studentId}_{evaluatorType}_{academicYear} (sdqDocId) — rules บังคับสำหรับผู้กรอก 3 กลุ่ม
      const sdqPath = (evaluatorType: string, year = YEAR) => `student_assessments_sdq/${STU_ID}_${evaluatorType}_${year}`;

      async function seed() {
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
          await ctx.firestore().doc('school_settings/academic_year').set({ academicYear: YEAR, semester: '1' });
          await ctx.firestore().doc(`students/${STU_ID}`).set({ studentId: STU_ID, studentUid: STU_UID, room: ROOM, parentUid: PARENT_UID });
          await ctx.firestore().doc(`staff/${HR_TEACHER_UID}`).set({ roles: ['HOMEROOM_TEACHER'], assignments: { homeroomClass: ROOM } });
          await ctx.firestore().doc('staff/other-hr').set({ roles: ['HOMEROOM_TEACHER'], assignments: { homeroomClass: 'ม.6/1' } });
        });
      }
      const sdqDoc = (over: Record<string, unknown> = {}) => ({
        id: 'x', studentId: STU_ID, studentUid: STU_UID, academicYear: YEAR,
        evaluatorType: 'STUDENT', evaluatorName: 'ทดสอบ',
        subscaleScores: { emotional: 1, conduct: 1, hyperactivity: 1, peerProblems: 1, prosocial: 8 },
        totalDifficultiesScore: 4, triagingStatus: 'NORMAL', assessmentDate: '2026-09-01', recommendations: [],
        ...over,
      });

      it('PATH 1: lets the student themselves create (self-eval)', async () => {
        await seed();
        await assertSucceeds(asUser(STU_UID, ['STUDENT']).firestore().doc(sdqPath('STUDENT')).set(
          sdqDoc({ id: 'sdq-p1', respondentUid: STU_UID, evaluatorType: 'STUDENT' })
        ));
      });

      it('PATH 2: lets the real linked parent (parentUid match) create', async () => {
        await seed();
        await assertSucceeds(asUser(PARENT_UID, ['PARENT']).firestore().doc(sdqPath('PARENT')).set(
          sdqDoc({ id: 'sdq-p2', respondentUid: PARENT_UID, evaluatorType: 'PARENT', evaluatorName: 'ผู้ปกครอง' })
        ));
      });

      it('PATH 3: lets the real homeroom teacher of that room create', async () => {
        await seed();
        await assertSucceeds(asUser(HR_TEACHER_UID, ['HOMEROOM_TEACHER'], { staffId: HR_TEACHER_UID }).firestore().doc(sdqPath('TEACHER')).set(
          sdqDoc({ id: 'sdq-p3', respondentUid: HR_TEACHER_UID, evaluatorType: 'TEACHER', evaluatorName: 'ครูที่ปรึกษา' })
        ));
      });

      it('REGRESSION: denies a different student, a different parent, and a homeroom teacher of a different room (self-attestation alone is not enough)', async () => {
        await seed();
        await assertFails(asUser('other-student-uid', ['STUDENT']).firestore().doc(sdqPath('STUDENT')).set(
          sdqDoc({ id: 'sdq-d1', respondentUid: 'other-student-uid', evaluatorType: 'STUDENT' })
        ));
        await assertFails(asUser('other-parent-uid', ['PARENT']).firestore().doc(sdqPath('PARENT')).set(
          sdqDoc({ id: 'sdq-d2', respondentUid: 'other-parent-uid', evaluatorType: 'PARENT', evaluatorName: 'ผู้ปกครองคนอื่น' })
        ));
        await assertFails(asUser('other-hr', ['HOMEROOM_TEACHER'], { staffId: 'other-hr' }).firestore().doc(sdqPath('TEACHER')).set(
          sdqDoc({ id: 'sdq-d3', respondentUid: 'other-hr', evaluatorType: 'TEACHER', evaluatorName: 'ครูห้องอื่น' })
        ));
      });

      it('ROLE-BOUND: ผู้กรอกกรอกได้เฉพาะมุมมองของตัวเอง (นักเรียน→STUDENT, ผู้ปกครอง→PARENT, ครูที่ปรึกษา→TEACHER)', async () => {
        await seed();
        const stu = () => asUser(STU_UID, ['STUDENT']).firestore();
        const par = () => asUser(PARENT_UID, ['PARENT']).firestore();
        const hr = () => asUser(HR_TEACHER_UID, ['HOMEROOM_TEACHER'], { staffId: HR_TEACHER_UID }).firestore();
        // นักเรียนกรอกแทนครู/ผู้ปกครองไม่ได้
        await assertFails(stu().doc(sdqPath('TEACHER')).set(sdqDoc({ respondentUid: STU_UID, evaluatorType: 'TEACHER' })));
        await assertFails(stu().doc(sdqPath('PARENT')).set(sdqDoc({ respondentUid: STU_UID, evaluatorType: 'PARENT' })));
        // ผู้ปกครองกรอกแทนนักเรียน/ครูไม่ได้
        await assertFails(par().doc(sdqPath('STUDENT')).set(sdqDoc({ respondentUid: PARENT_UID, evaluatorType: 'STUDENT' })));
        await assertFails(par().doc(sdqPath('TEACHER')).set(sdqDoc({ respondentUid: PARENT_UID, evaluatorType: 'TEACHER' })));
        // ครูที่ปรึกษากรอกแทนนักเรียน/ผู้ปกครองไม่ได้
        await assertFails(hr().doc(sdqPath('STUDENT')).set(sdqDoc({ respondentUid: HR_TEACHER_UID, evaluatorType: 'STUDENT' })));
        await assertFails(hr().doc(sdqPath('PARENT')).set(sdqDoc({ respondentUid: HR_TEACHER_UID, evaluatorType: 'PARENT' })));
      });

      it('denies a SUBJECT_TEACHER (not a homeroom teacher at all) from creating', async () => {
        await seed();
        await assertFails(asRole('SUBJECT_TEACHER').firestore().doc(sdqPath('TEACHER')).set(
          sdqDoc({ id: 'sdq-d4', respondentUid: 'test-uid', evaluatorType: 'TEACHER', evaluatorName: 'ครูวิชาอื่น' })
        ));
      });

      it('denies faking studentUid to a value that does not match the real student doc', async () => {
        await seed();
        await assertFails(asUser(STU_UID, ['STUDENT']).firestore().doc(sdqPath('STUDENT')).set(
          sdqDoc({ id: 'sdq-d5', studentUid: 'forged-uid', respondentUid: STU_UID, evaluatorType: 'STUDENT' })
        ));
      });

      it('denies naming someone else as respondentUid even from a legitimate relationship (self-attestation must also be honest)', async () => {
        await seed();
        await assertFails(asUser(PARENT_UID, ['PARENT']).firestore().doc(sdqPath('PARENT')).set(
          sdqDoc({ id: 'sdq-d6', respondentUid: 'someone-else', evaluatorType: 'PARENT', evaluatorName: 'ผู้ปกครอง' })
        ));
      });


      // ── ปีการศึกษา + กันกรอกซ้ำ (feat/sdq-homeroom-entry) ──
      it('DUPLICATE: the same (student, evaluator, year) cannot be created twice by a respondent — not by re-writing it, not under another id', async () => {
        await seed();
        const teacher = () => asUser(HR_TEACHER_UID, ['HOMEROOM_TEACHER'], { staffId: HR_TEACHER_UID }).firestore();
        const doc1 = sdqDoc({ respondentUid: HR_TEACHER_UID, evaluatorType: 'TEACHER', evaluatorName: 'ครูที่ปรึกษา' });
        await assertSucceeds(teacher().doc(sdqPath('TEACHER')).set(doc1));
        // ทับ id เดิม = update → ผู้กรอกทำไม่ได้
        await assertFails(teacher().doc(sdqPath('TEACHER')).set({ ...doc1, totalDifficultiesScore: 30 }));
        // สร้างซ้ำด้วย id อื่น (เลี่ยงชน id) → id ไม่ตรงรูปแบบ ถูกปฏิเสธ
        await assertFails(teacher().doc('student_assessments_sdq/sdq-another-id').set(doc1));
        await assertFails(teacher().doc(`student_assessments_sdq/${STU_ID}_TEACHER_2569_2`).set(doc1));
      });

      it('the same evaluator CAN assess again in a different academic year, and other evaluators can assess in the same year', async () => {
        await seed();
        await assertSucceeds(asUser(HR_TEACHER_UID, ['HOMEROOM_TEACHER'], { staffId: HR_TEACHER_UID }).firestore().doc(sdqPath('TEACHER')).set(
          sdqDoc({ respondentUid: HR_TEACHER_UID, evaluatorType: 'TEACHER', evaluatorName: 'ครู' })));
        // ผู้ประเมินคนละประเภท ปีเดียวกัน — ผ่าน
        await assertSucceeds(asUser(STU_UID, ['STUDENT']).firestore().doc(sdqPath('STUDENT')).set(sdqDoc({ respondentUid: STU_UID })));
        await assertSucceeds(asUser(PARENT_UID, ['PARENT']).firestore().doc(sdqPath('PARENT')).set(
          sdqDoc({ respondentUid: PARENT_UID, evaluatorType: 'PARENT', evaluatorName: 'ผู้ปกครอง' })));
        // ปีถัดไป: admin เปลี่ยนปีปัจจุบันแล้ว ครูกรอกชุดใหม่ได้
        await testEnv.withSecurityRulesDisabled(async (ctx) => { await ctx.firestore().doc('school_settings/academic_year').set({ academicYear: '2570', semester: '1' }); });
        await assertSucceeds(asUser(HR_TEACHER_UID, ['HOMEROOM_TEACHER'], { staffId: HR_TEACHER_UID }).firestore().doc(sdqPath('TEACHER', '2570')).set(
          sdqDoc({ academicYear: '2570', respondentUid: HR_TEACHER_UID, evaluatorType: 'TEACHER', evaluatorName: 'ครู' })));
      });

      it('academicYear must be present, well-formed and equal to the CURRENT year in school_settings/academic_year', async () => {
        await seed();
        const teacher = () => asUser(HR_TEACHER_UID, ['HOMEROOM_TEACHER'], { staffId: HR_TEACHER_UID }).firestore();
        const base = { respondentUid: HR_TEACHER_UID, evaluatorType: 'TEACHER', evaluatorName: 'ครู' };
        // ไม่มี academicYear เลย
        const { academicYear: _omit, ...noYear } = sdqDoc(base);
        await assertFails(teacher().doc(`student_assessments_sdq/${STU_ID}_TEACHER_undefined`).set(noYear));
        // ปีย้อนหลัง/อนาคต/รูปแบบผิด/ชนิดผิด (แม้ id จะตรงกับปีที่ใส่)
        for (const bad of ['2568', '2570', '69', '2569 ', 2569 as unknown as string, null as unknown as string]) {
          await assertFails(teacher().doc(sdqPath('TEACHER', String(bad))).set(sdqDoc({ ...base, academicYear: bad })));
        }
        // id ปีหนึ่ง แต่ field ปีอีกอัน
        await assertFails(teacher().doc(sdqPath('TEACHER', '2568')).set(sdqDoc(base)));
        await assertFails(teacher().doc(sdqPath('TEACHER')).set(sdqDoc({ ...base, academicYear: '2568' })));
      });

      it('no school_settings/academic_year configured → respondents are refused (the year is never guessed)', async () => {
        await seed();
        await testEnv.withSecurityRulesDisabled(async (ctx) => { await ctx.firestore().doc('school_settings/academic_year').delete(); });
        await assertFails(asUser(HR_TEACHER_UID, ['HOMEROOM_TEACHER'], { staffId: HR_TEACHER_UID }).firestore().doc(sdqPath('TEACHER')).set(
          sdqDoc({ respondentUid: HR_TEACHER_UID, evaluatorType: 'TEACHER', evaluatorName: 'ครู' })));
      });

      it('a homeroom teacher can assess a student whose account is not linked yet (no studentUid → studentUid is ""), but cannot forge a uid for a linked one', async () => {
        await seed();
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
          await ctx.firestore().doc('students/sdq2-unlinked').set({ studentId: 'sdq2-unlinked', room: ROOM });
        });
        const t = () => asUser(HR_TEACHER_UID, ['HOMEROOM_TEACHER'], { staffId: HR_TEACHER_UID }).firestore();
        const unlinked = sdqDoc({ studentId: 'sdq2-unlinked', studentUid: '', respondentUid: HR_TEACHER_UID, evaluatorType: 'TEACHER', evaluatorName: 'ครู' });
        await assertSucceeds(t().doc('student_assessments_sdq/sdq2-unlinked_TEACHER_2569').set(unlinked));
        await testEnv.withSecurityRulesDisabled(async (ctx) => { await ctx.firestore().doc('student_assessments_sdq/sdq2-unlinked_TEACHER_2569').delete(); });
        await assertFails(t().doc('student_assessments_sdq/sdq2-unlinked_TEACHER_2569').set({ ...unlinked, studentUid: 'made-up-uid' }));
        await assertFails(t().doc(sdqPath('TEACHER')).set({ ...unlinked, studentId: STU_ID, studentUid: '' })); // linked student: '' ไม่ผ่าน
      });

      it('SUPER_ADMIN / GUIDANCE_COUNSELOR are not limited by the uniqueness/year rule (can create and edit as before)', async () => {
        await seed();
        for (const role of ['SUPER_ADMIN', 'GUIDANCE_COUNSELOR']) {
          const db = asRole(role).firestore();
          await assertSucceeds(db.doc(sdqPath('TEACHER')).set(sdqDoc({ respondentUid: 'x', evaluatorType: 'TEACHER' })));   // สร้าง
          await assertSucceeds(db.doc(sdqPath('TEACHER')).set(sdqDoc({ respondentUid: 'x', evaluatorType: 'TEACHER', totalDifficultiesScore: 12 }))); // แก้ทับ
          await assertSucceeds(db.doc('student_assessments_sdq/legacy-no-year').set((({ academicYear: _y, ...rest }) => rest)(sdqDoc({ respondentUid: 'x' })))); // รูปแบบเดิม/ไม่มีปี
          await assertSucceeds(db.doc(sdqPath('TEACHER')).delete());
        }
      });

      it('the impact (page 2) fields ride in the same document: create with them is allowed for all 3 respondents, with or without the gate skip', async () => {
        await seed();
        const impactYes = {
          subscaleStatus: { emotional: 'NORMAL', conduct: 'NORMAL', hyperactivity: 'NORMAL', peerProblems: 'NORMAL', prosocial: 'HAS_STRENGTH' }, criteriaVersion: 'dmh-obec-2',
          impactGateAnswer: 'YES_DEFINITE', impactDurationMonths: 'M6_12', impactDistressScore: 1,
          impactDomainScores: { home: 2, friends: 0, classroom: 1, leisure: 0 }, impactTotalScore: 4, impactTriage: 'VULNERABLE',
        };
        const impactNo = { impactGateAnswer: 'NO', impactTotalScore: 0, impactTriage: 'NORMAL' };
        await assertSucceeds(asUser(STU_UID, ['STUDENT']).firestore().doc(sdqPath('STUDENT')).set(sdqDoc({ respondentUid: STU_UID, ...impactYes })));
        await assertSucceeds(asUser(PARENT_UID, ['PARENT']).firestore().doc(sdqPath('PARENT')).set(
          sdqDoc({ respondentUid: PARENT_UID, evaluatorType: 'PARENT', evaluatorName: 'ผู้ปกครอง', ...impactNo })));
        await assertSucceeds(asUser(HR_TEACHER_UID, ['HOMEROOM_TEACHER'], { staffId: HR_TEACHER_UID }).firestore().doc(sdqPath('TEACHER')).set(
          sdqDoc({ respondentUid: HR_TEACHER_UID, evaluatorType: 'TEACHER', evaluatorName: 'ครู', ...impactYes })));
        // กฎกันซ้ำยังบังคับเหมือนเดิมแม้มี field เพิ่ม
        await assertFails(asUser(HR_TEACHER_UID, ['HOMEROOM_TEACHER'], { staffId: HR_TEACHER_UID }).firestore().doc(sdqPath('TEACHER')).set(
          sdqDoc({ respondentUid: HR_TEACHER_UID, evaluatorType: 'TEACHER', evaluatorName: 'ครู', ...impactNo })));
      });

      it('only SUPER_ADMIN/GUIDANCE_COUNSELOR can update or delete an already-submitted assessment (not the original respondent)', async () => {
        await seed();
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
          await ctx.firestore().doc(sdqPath('STUDENT')).set(
            sdqDoc({ id: 'sdq-u1', respondentUid: STU_UID, evaluatorType: 'STUDENT' })
          );
        });
        await assertFails(asUser(STU_UID, ['STUDENT']).firestore().doc(sdqPath('STUDENT')).set(
          sdqDoc({ id: 'sdq-u1', respondentUid: STU_UID, evaluatorType: 'STUDENT', totalDifficultiesScore: 10 })
        ));
        await assertSucceeds(asRole('GUIDANCE_COUNSELOR').firestore().doc(sdqPath('STUDENT')).set(
          sdqDoc({ id: 'sdq-u1', respondentUid: STU_UID, evaluatorType: 'STUDENT', totalDifficultiesScore: 10 })
        ));
        await assertFails(asUser(STU_UID, ['STUDENT']).firestore().doc(sdqPath('STUDENT')).delete());
        await assertSucceeds(asRole('SUPER_ADMIN').firestore().doc(sdqPath('STUDENT')).delete());
      });
    });
  });

  // guidance_counseling_cases — เนื้อหาการให้คำปรึกษาจิตวิทยา ข้อมูลอ่อนไหวที่สุดในระบบ
  // GUIDANCE_COUNSELOR/SUPER_ADMIN เท่านั้น ห้ามครูประจำชั้น/ครูวิชาอื่น/ผู้ปกครอง/นักเรียนอ่านได้เลย
  describe('guidance_counseling_cases collection', () => {
    const COUNSELOR_UID = 'counselor-uid-1';
    const STU_ID = 'gc-std-1';

    const baseCase = (over: Record<string, unknown> = {}) => ({
      id: 'case-1', studentId: STU_ID, studentName: 'นักเรียนทดสอบ', classRoom: 'ม.5/8',
      counselorUid: COUNSELOR_UID, counselorName: 'ครูแนะแนวทดสอบ', category: 'ความเครียดจากการเรียน',
      notes: 'พูดคุยเบื้องต้น นัดติดตามสัปดาห์หน้า', severity: 'MODERATE', status: 'IN_PROGRESS',
      createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z', lastSessionDate: '2026-09-01',
      ...over,
    });

    it('lets GUIDANCE_COUNSELOR create a case naming themselves as counselorUid; denies naming someone else', async () => {
      await assertSucceeds(asUser(COUNSELOR_UID, ['GUIDANCE_COUNSELOR']).firestore().doc('guidance_counseling_cases/case-1').set(baseCase()));
      await assertFails(asUser(COUNSELOR_UID, ['GUIDANCE_COUNSELOR']).firestore().doc('guidance_counseling_cases/case-2').set(baseCase({ counselorUid: 'someone-else' })));
    });

    it('lets SUPER_ADMIN read/write; denies HOMEROOM_TEACHER, SUBJECT_TEACHER, PARENT, and the case student from reading or writing', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('guidance_counseling_cases/case-3').set(baseCase());
      });
      await assertSucceeds(asRole('SUPER_ADMIN').firestore().doc('guidance_counseling_cases/case-3').get());
      await assertSucceeds(asRole('SUPER_ADMIN').firestore().doc('guidance_counseling_cases/case-3').set(baseCase({ status: 'RESOLVED' })));
      await assertFails(asRole('GUIDANCE_COUNSELOR').firestore().doc('guidance_counseling_cases/case-3').get()); // ไม่ใช่เจ้าของเคส

      await assertFails(asRole('HOMEROOM_TEACHER').firestore().doc('guidance_counseling_cases/case-3').get());
      await assertFails(asRole('SUBJECT_TEACHER').firestore().doc('guidance_counseling_cases/case-3').get());
      await assertFails(asRole('PARENT').firestore().doc('guidance_counseling_cases/case-3').get());
      await assertFails(asUser('some-student-uid', ['STUDENT']).firestore().doc('guidance_counseling_cases/case-3').get());

      await assertFails(asRole('HOMEROOM_TEACHER').firestore().doc('guidance_counseling_cases/case-4').set(baseCase({ id: 'case-4' })));
      await assertFails(asRole('PARENT').firestore().doc('guidance_counseling_cases/case-3').set(baseCase({ status: 'RESOLVED' })));
    });

    it('ครูแนะแนวอ่าน/แก้สถานะได้เฉพาะเคสของตน; ครูแนะแนวคนอื่นอ่าน/แก้ไม่ได้', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('guidance_counseling_cases/case-5').set(baseCase());
      });
      const owner = asUser(COUNSELOR_UID, ['GUIDANCE_COUNSELOR']).firestore();
      const other = asUser('other-counselor', ['GUIDANCE_COUNSELOR']).firestore();
      await assertSucceeds(owner.doc('guidance_counseling_cases/case-5').get());
      await assertFails(other.doc('guidance_counseling_cases/case-5').get());
      await assertSucceeds(owner.doc('guidance_counseling_cases/case-5').update({ status: 'RESOLVED', updatedAt: '2026-09-02T00:00:00.000Z' }));
      await assertFails(other.doc('guidance_counseling_cases/case-5').update({ status: 'IN_PROGRESS', updatedAt: '2026-09-03T00:00:00.000Z' }));
    });

    it('query กรอง counselorUid == uid ผ่าน; query ทั้ง collection โดยครูแนะแนวถูกปฏิเสธ; เจ้าของย้ายเคส/ลบไม่ได้', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('guidance_counseling_cases/case-7').set(baseCase({ id: 'case-7' }));
        await ctx.firestore().doc('guidance_counseling_cases/case-8').set(baseCase({ id: 'case-8', counselorUid: 'other-counselor' }));
      });
      const owner = asUser(COUNSELOR_UID, ['GUIDANCE_COUNSELOR']).firestore();
      await assertSucceeds(owner.collection('guidance_counseling_cases').where('counselorUid', '==', COUNSELOR_UID).get());
      await assertFails(owner.collection('guidance_counseling_cases').get());
      await assertFails(owner.doc('guidance_counseling_cases/case-7').update({ counselorUid: 'other-counselor' }));
      await assertFails(owner.doc('guidance_counseling_cases/case-7').delete());
      await assertSucceeds(asRole('SUPER_ADMIN').firestore().collection('guidance_counseling_cases').get());
    });

    it('REGRESSION: denies an unauthenticated user entirely', async () => {
      await assertFails(asAnonymous().firestore().doc('guidance_counseling_cases/case-6').get());
      await assertFails(asAnonymous().firestore().doc('guidance_counseling_cases/case-6').set(baseCase({ id: 'case-6' })));
    });
  });

  // infirmary_visits — บันทึกห้องพยาบาล: เขียนได้เฉพาะ INFIRMARY_STAFF/SUPER_ADMIN แต่ตั้งใจ
  // ให้ผู้ปกครอง+นักเรียนเจ้าของอ่านได้ (ต่างจาก guidance_counseling_cases ที่ปิดไม่ให้อ่านเลย)
  describe('infirmary_visits collection', () => {
    const STU_UID = 'stu-uid-inf1';
    const STU_ID = 'inf-std-1';
    const PARENT_UID = 'parent-inf1';
    const NURSE_UID = 'nurse-uid-1';

    async function seed() {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc(`students/${STU_ID}`).set({ studentId: STU_ID, studentUid: STU_UID, parentUid: PARENT_UID });
      });
    }
    const baseVisit = (over: Record<string, unknown> = {}) => ({
      id: 'inf-1', studentId: STU_ID, studentUid: STU_UID, parentUid: PARENT_UID,
      visitDate: '2026-09-01', visitTime: '09:30 น.', symptoms: 'ปวดศีรษะ', temperature: 37.6,
      treatment: 'นอนพัก', medicationGiven: 'พาราเซตามอล', restDurationMinutes: 30,
      nurseUid: NURSE_UID, nurseName: 'พยาบาลทดสอบ', isUrgentAlert: false, parentAcknowledged: false,
      createdAt: '2026-09-01T02:30:00.000Z',
      ...over,
    });

    it('lets INFIRMARY_STAFF create a visit with studentUid/parentUid matching the real student doc; denies a mismatch', async () => {
      await seed();
      await assertSucceeds(asRole('INFIRMARY_STAFF').firestore().doc('infirmary_visits/inf-1').set(baseVisit()));
      await assertFails(asRole('INFIRMARY_STAFF').firestore().doc('infirmary_visits/inf-2').set(baseVisit({ id: 'inf-2', parentUid: 'someone-else' })));
    });

    it('denies a SUBJECT_TEACHER/HOMEROOM_TEACHER from creating a visit', async () => {
      await seed();
      await assertFails(asRole('SUBJECT_TEACHER').firestore().doc('infirmary_visits/inf-3').set(baseVisit({ id: 'inf-3' })));
      await assertFails(asRole('HOMEROOM_TEACHER').firestore().doc('infirmary_visits/inf-4').set(baseVisit({ id: 'inf-4' })));
    });

    it('lets the student and the linked parent read; denies an unrelated parent/teacher', async () => {
      await seed();
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('infirmary_visits/inf-5').set(baseVisit({ id: 'inf-5' }));
      });
      await assertSucceeds(asUser(STU_UID, ['STUDENT']).firestore().doc('infirmary_visits/inf-5').get());
      await assertSucceeds(asUser(PARENT_UID, ['PARENT']).firestore().doc('infirmary_visits/inf-5').get());
      await assertFails(asUser('other-parent', ['PARENT']).firestore().doc('infirmary_visits/inf-5').get());
      await assertFails(asRole('SUBJECT_TEACHER').firestore().doc('infirmary_visits/inf-5').get());
    });
    it('TASK 5 (ExecutivePortal Health): EXECUTIVE role อ่านได้เพื่อสรุปภาพรวมโรงเรียน', async () => {
      await seed();
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('infirmary_visits/inf-8').set(baseVisit({ id: 'inf-8' }));
      });
      await assertSucceeds(asRole('EXECUTIVE').firestore().doc('infirmary_visits/inf-8').get());
    });

    it('lets the linked parent acknowledge (parentAcknowledged/acknowledgedAt only); denies changing other fields or an unrelated parent acknowledging', async () => {
      await seed();
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('infirmary_visits/inf-6').set(baseVisit({ id: 'inf-6' }));
      });
      await assertSucceeds(asUser(PARENT_UID, ['PARENT']).firestore().doc('infirmary_visits/inf-6').set(
        baseVisit({ id: 'inf-6', parentAcknowledged: true, acknowledgedAt: '2026-09-01T03:00:00.000Z' })
      ));
      await assertFails(asUser(PARENT_UID, ['PARENT']).firestore().doc('infirmary_visits/inf-6').set(
        baseVisit({ id: 'inf-6', parentAcknowledged: true, acknowledgedAt: '2026-09-01T03:00:00.000Z', symptoms: 'แก้ไขอาการ' })
      ));
      await assertFails(asUser('other-parent', ['PARENT']).firestore().doc('infirmary_visits/inf-6').set(
        baseVisit({ id: 'inf-6', parentAcknowledged: true })
      ));
    });

    it('denies INFIRMARY_STAFF from repointing studentUid/parentUid on update; denies deleting', async () => {
      await seed();
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('infirmary_visits/inf-7').set(baseVisit({ id: 'inf-7' }));
      });
      await assertFails(asRole('INFIRMARY_STAFF').firestore().doc('infirmary_visits/inf-7').set(
        baseVisit({ id: 'inf-7', parentUid: 'repointed-parent' })
      ));
      await assertFails(asRole('INFIRMARY_STAFF').firestore().doc('infirmary_visits/inf-7').delete());
    });

    it('พยาบาลกด "ส่งผ่านแอปงานพยาบาล": สร้างแจ้งเตือน (ผู้รับเป็น studentUid ได้เมื่อยังไม่มีผู้ปกครอง) และบันทึก parentNotifiedAt ที่เคสได้; ผู้ปกครองรับทราบต่อได้', async () => {
      await seed();
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('infirmary_visits/inf-8').set(baseVisit({ id: 'inf-8' }));
      });
      const nurseDb = asRole('INFIRMARY_STAFF').firestore();
      await assertSucceeds(nurseDb.doc('parent_notifications/inf-n1').set({
        id: 'inf-n1', parentUid: null, parentId: null, studentUid: STU_UID, studentId: STU_ID, studentName: 'นักเรียนทดสอบ',
        title: '🏥 แจ้งเตือน', message: 'ทดสอบ', status: 'unread', type: 'warning',
      }));
      await assertSucceeds(nurseDb.doc('infirmary_visits/inf-8').set(
        { parentNotifiedAt: '2026-10-14T01:00:00.000Z', parentNotifiedByName: 'พยาบาลทดสอบ' }, { merge: true } as any,
      ));
      await assertSucceeds(asUser(PARENT_UID, ['PARENT']).firestore().doc('infirmary_visits/inf-8').set(
        { parentAcknowledged: true, acknowledgedAt: '2026-10-14T02:00:00.000Z' }, { merge: true } as any,
      ));
    });

    // ระบบแจ้งเตือนรวมศูนย์ — TASK 1: บันทึกอาการต้องเขียนแจ้งเตือนผู้ปกครองคู่กันไปเสมอในธุรกรรมเดียวกัน
    it('บันทึกเข้าห้องพยาบาลจริงต้องสร้าง parent_notifications คู่กันไปด้วยในธุรกรรมเดียวกัน', async () => {
      await seed();
      const dbNurse = asUser(NURSE_UID, ['INFIRMARY_STAFF']).firestore();
      const visitId = await recordInfirmaryVisit({
        studentId: STU_ID, studentUid: STU_UID, parentUid: PARENT_UID,
        studentName: 'นักเรียนทดสอบ', symptoms: 'ไข้สูง', temperature: 38.5,
        treatment: 'เช็ดตัว', medicationGiven: 'พาราเซตามอล', restDurationMinutes: 20,
        isUrgentAlert: true, nurseUid: NURSE_UID, nurseName: 'พยาบาลทดสอบ',
      }, dbNurse as any);

      expect(visitId).toBeTruthy();
      let notifCount = 0;
      let notifId = '';
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const snap = await ctx.firestore().collection('parent_notifications').where('parentUid', '==', PARENT_UID).get();
        notifCount = snap.size;
        notifId = snap.docs[0]?.id || '';
        expect(snap.docs[0]?.data().studentUid).toBe(STU_UID);
      });
      expect(notifCount).toBe(1);
      // นักเรียนเจ้าของเรื่องเองก็ต้องอ่านแจ้งเตือนนี้ได้ด้วย (ไม่ใช่แค่ผู้ปกครอง)
      await assertSucceeds(asUser(STU_UID, ['STUDENT']).firestore().doc(`parent_notifications/${notifId}`).get());
    });
  });

  // ระบบแจ้งเตือนรวมศูนย์ — TASK 1: parent_notifications เขียนได้จาก role งาน + STUDENT/PARENT ที่เขียน
  // ให้ตัวเองเท่านั้น (verify ผ่าน studentField()); เจ้าของกด "อ่านแล้ว" เองได้ (แก้ได้แค่ status)
  describe('parent_notifications collection', () => {
    const STU_UID = 'notif-stu-uid-1';
    const STU_ID = 'notif-std-1';
    const PARENT_UID = 'notif-parent-uid-1';

    async function seed() {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc(`students/${STU_ID}`).set({ studentId: STU_ID, studentUid: STU_UID, parentUid: PARENT_UID });
      });
    }
    const notifDoc = (over: Record<string, unknown> = {}) => ({
      id: 'x', parentUid: PARENT_UID, parentId: PARENT_UID, studentUid: STU_UID, studentId: STU_ID, studentName: 'นักเรียนทดสอบ',
      title: 'แจ้งเตือนทดสอบ', message: 'ข้อความทดสอบ', status: 'unread', type: 'info',
      ...over,
    });

    it('lets STUDENT/PARENT create a notification addressed to their own real parentUid; denies a forged parentUid', async () => {
      await seed();
      await assertSucceeds(asUser(STU_UID, ['STUDENT']).firestore().doc('parent_notifications/n1').set(notifDoc({ id: 'n1' })));
      await assertSucceeds(asUser(PARENT_UID, ['PARENT']).firestore().doc('parent_notifications/n2').set(notifDoc({ id: 'n2' })));
      await assertFails(asUser(STU_UID, ['STUDENT']).firestore().doc('parent_notifications/n3').set(
        notifDoc({ id: 'n3', parentUid: 'someone-else', parentId: 'someone-else' })
      ));
    });

    it('lets HOMEROOM_TEACHER/SUBJECT_TEACHER/SUPER_ADMIN create for any student; denies an unrelated STUDENT/PARENT', async () => {
      await seed();
      await assertSucceeds(asRole('HOMEROOM_TEACHER').firestore().doc('parent_notifications/n4').set(notifDoc({ id: 'n4' })));
      await assertSucceeds(asRole('SUBJECT_TEACHER').firestore().doc('parent_notifications/n5').set(notifDoc({ id: 'n5' })));
      await assertSucceeds(asRole('SUPER_ADMIN').firestore().doc('parent_notifications/n6').set(notifDoc({ id: 'n6' })));
      await assertFails(asUser('other-student', ['STUDENT']).firestore().doc('parent_notifications/n7').set(notifDoc({ id: 'n7' })));
    });

    it('lets the linked parent mark their own notification read (status only); denies changing other fields or an unrelated parent', async () => {
      await seed();
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('parent_notifications/n8').set(notifDoc({ id: 'n8' }));
      });
      await assertSucceeds(asUser(PARENT_UID, ['PARENT']).firestore().doc('parent_notifications/n8').update({ status: 'read' }));
      await assertFails(asUser(PARENT_UID, ['PARENT']).firestore().doc('parent_notifications/n8').update({ status: 'read', title: 'แก้ไขหัวข้อ' }));
      await assertFails(asUser('other-parent', ['PARENT']).firestore().doc('parent_notifications/n8').update({ status: 'read' }));
    });

    it('lets the linked parent/student read; denies an unrelated parent; only SUPER_ADMIN can delete', async () => {
      await seed();
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('parent_notifications/n9').set(notifDoc({ id: 'n9' }));
      });
      await assertSucceeds(asUser(PARENT_UID, ['PARENT']).firestore().doc('parent_notifications/n9').get());
      await assertFails(asUser('other-parent', ['PARENT']).firestore().doc('parent_notifications/n9').get());
      await assertFails(asUser(PARENT_UID, ['PARENT']).firestore().doc('parent_notifications/n9').delete());
      await assertSucceeds(asRole('SUPER_ADMIN').firestore().doc('parent_notifications/n9').delete());
    });

    // TASK (เพิ่มกระดิ่งฝั่งนักเรียน): studentUid denormalize เข้า schema ให้นักเรียนเจ้าของอ่าน/
    // มาร์คอ่านแล้วเองได้ด้วย โดยไม่กระทบ scope เดิมของผู้ปกครองเลย
    it('lets the owning student read/mark-read their own notification via studentUid; denies an unrelated student', async () => {
      await seed();
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('parent_notifications/n10').set(notifDoc({ id: 'n10' }));
      });
      await assertSucceeds(asUser(STU_UID, ['STUDENT']).firestore().doc('parent_notifications/n10').get());
      await assertSucceeds(asUser(STU_UID, ['STUDENT']).firestore().doc('parent_notifications/n10').update({ status: 'read' }));
      await assertFails(asUser('other-student', ['STUDENT']).firestore().doc('parent_notifications/n10').get());
      // ผู้ปกครองเดิมยังอ่านได้ตามปกติ ไม่มี regression
      await assertSucceeds(asUser(PARENT_UID, ['PARENT']).firestore().doc('parent_notifications/n10').get());
    });

    it('denies creating a notification with a forged studentUid that does not match the real students/{id}.studentUid, even for a role-based writer', async () => {
      await seed();
      await assertFails(
        asRole('HOMEROOM_TEACHER').firestore().doc('parent_notifications/n11').set(
          notifDoc({ id: 'n11', studentUid: 'someone-elses-uid' })
        )
      );
      // studentUid: null (ไม่ทราบ/ยังไม่เชื่อมบัญชี) ยังเขียนได้ปกติ — ไม่ใช่ทุกคนต้องมี studentUid จริงเสมอไป
      await assertSucceeds(
        asRole('HOMEROOM_TEACHER').firestore().doc('parent_notifications/n12').set(
          notifDoc({ id: 'n12', studentUid: null })
        )
      );
    });

    it('createParentNotification (helper จริงที่ store.ts เรียก) ข้ามการเขียนเงียบๆ เมื่อไม่มี parentUid จริง แทนการ fabricate ID ปลอม', async () => {
      const dbTeacher = asRole('HOMEROOM_TEACHER').firestore();
      await expect(createParentNotification({
        parentUid: '', studentId: 'ghost-std', studentName: 'ผี', title: 'x', message: 'y',
      }, dbTeacher as any)).resolves.not.toThrow();

      let count = 0;
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const snap = await ctx.firestore().collection('parent_notifications').where('studentId', '==', 'ghost-std').get();
        count = snap.size;
      });
      expect(count).toBe(0);
    });
  });

  // เฟส 2 การเงิน — TASK 1: billing_invoices/billing_counters — ระบบสร้างใบแจ้งหนี้จริง (เดิมไม่มี
  // ฟีเจอร์นี้อยู่เลย) เขียน/แก้ไขเฉพาะ FINANCE_STAFF/SUPER_ADMIN, อ่านเพิ่มเจ้าของ (parentUid/
  // studentUid ตรง) — เลขที่ใบแจ้งหนี้ต้อง auditable จริงผ่าน counter transaction กันชนกัน race condition
  describe('billing_invoices / billing_counters collections', () => {
    const STU_UID = 'bill-stu-uid-1';
    const STU_ID = 'bill-std-1';
    const PARENT_UID = 'bill-parent-uid-1';
    const FINANCE_UID = 'finance-uid-1';

    async function seed() {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc(`students/${STU_ID}`).set({ studentId: STU_ID, studentUid: STU_UID, parentUid: PARENT_UID });
      });
    }
    const invoiceDoc = (over: Record<string, unknown> = {}) => ({
      id: 'x', invoiceNumber: 'INV-2569-0001', studentId: STU_ID, studentUid: STU_UID, parentUid: PARENT_UID,
      title: 'ค่าบำรุงการศึกษา', items: [{ description: 'ค่าบำรุงการศึกษา', amount: 3000 }], totalAmount: 3000,
      dueDate: '2026-12-31', status: 'PENDING', promptPayQr: 'https://example.com/qr.png',
      createdBy: FINANCE_UID, createdAt: '2026-09-06T00:00:00.000Z',
      ...over,
    });

    it('lets FINANCE_STAFF create an invoice with studentUid/parentUid matching the real student doc; denies a mismatch', async () => {
      await seed();
      await assertSucceeds(asUser(FINANCE_UID, ['FINANCE_STAFF']).firestore().doc('billing_invoices/inv-1').set(
        invoiceDoc({ id: 'inv-1' })
      ));
      await assertFails(asUser(FINANCE_UID, ['FINANCE_STAFF']).firestore().doc('billing_invoices/inv-2').set(
        invoiceDoc({ id: 'inv-2', parentUid: 'someone-else' })
      ));
    });

    it('denies create by non-finance roles (SUBJECT_TEACHER, PARENT, STUDENT)', async () => {
      await seed();
      await assertFails(asRole('SUBJECT_TEACHER').firestore().doc('billing_invoices/inv-3').set(invoiceDoc({ id: 'inv-3' })));
      await assertFails(asUser(PARENT_UID, ['PARENT']).firestore().doc('billing_invoices/inv-4').set(
        invoiceDoc({ id: 'inv-4', createdBy: PARENT_UID })
      ));
      await assertFails(asUser(STU_UID, ['STUDENT']).firestore().doc('billing_invoices/inv-5').set(
        invoiceDoc({ id: 'inv-5', createdBy: STU_UID })
      ));
    });

    it('denies naming someone else as createdBy, and denies creating with a non-PENDING status', async () => {
      await seed();
      await assertFails(asUser(FINANCE_UID, ['FINANCE_STAFF']).firestore().doc('billing_invoices/inv-6').set(
        invoiceDoc({ id: 'inv-6', createdBy: 'someone-else' })
      ));
      await assertFails(asUser(FINANCE_UID, ['FINANCE_STAFF']).firestore().doc('billing_invoices/inv-7').set(
        invoiceDoc({ id: 'inv-7', status: 'PAID' })
      ));
    });

    it('lets FINANCE_STAFF/SUPER_ADMIN/EXECUTIVE and the linked student/parent read; denies an unrelated parent/student', async () => {
      await seed();
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('billing_invoices/inv-8').set(invoiceDoc({ id: 'inv-8' }));
      });
      await assertSucceeds(asRole('FINANCE_STAFF').firestore().doc('billing_invoices/inv-8').get());
      await assertSucceeds(asRole('SUPER_ADMIN').firestore().doc('billing_invoices/inv-8').get());
      await assertSucceeds(asRole('EXECUTIVE').firestore().doc('billing_invoices/inv-8').get());
      await assertSucceeds(asUser(STU_UID, ['STUDENT']).firestore().doc('billing_invoices/inv-8').get());
      await assertSucceeds(asUser(PARENT_UID, ['PARENT']).firestore().doc('billing_invoices/inv-8').get());
      await assertFails(asUser('other-parent', ['PARENT']).firestore().doc('billing_invoices/inv-8').get());
      await assertFails(asUser('other-student', ['STUDENT']).firestore().doc('billing_invoices/inv-8').get());
    });

    it('lets FINANCE_STAFF edit invoice content but not repoint studentUid/parentUid; denies delete', async () => {
      await seed();
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('billing_invoices/inv-9').set(invoiceDoc({ id: 'inv-9' }));
      });
      await assertSucceeds(asRole('FINANCE_STAFF').firestore().doc('billing_invoices/inv-9').set(
        invoiceDoc({ id: 'inv-9', totalAmount: 3500 })
      ));
      await assertFails(asRole('FINANCE_STAFF').firestore().doc('billing_invoices/inv-9').set(
        invoiceDoc({ id: 'inv-9', parentUid: 'repointed-parent' })
      ));
      await assertFails(asRole('FINANCE_STAFF').firestore().doc('billing_invoices/inv-9').delete());
    });

    // ขั้นตอนชำระเงิน: ผู้ปกครอง/นักเรียนแนบสลิป → VERIFYING; เจ้าหน้าที่การเงินตรวจแล้วจึง PAID (ลงชื่อผู้ตรวจ)
    describe('payment slip flow', () => {
      const SLIP_URL = 'https://firebasestorage.googleapis.com/v0/b/x/o/billing_slips%2Fp%2Finv.jpg?alt=media&token=t';
      const slipPatch = (uid: string, over: Record<string, unknown> = {}) => ({
        status: 'VERIFYING', slipUrl: SLIP_URL, slipStoragePath: `billing_slips/${uid}/inv.jpg`, slipFileName: 'slip.jpg',
        slipUploadedAt: '2026-10-12T10:00:00.000Z', slipUploadedByUid: uid, slipNote: '',
        slipRejectedReason: null, slipRejectedAt: null,
        ...over,
      });
      async function seedInvoice(id: string, over: Record<string, unknown> = {}) {
        await seed();
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
          await ctx.firestore().doc(`billing_invoices/${id}`).set(invoiceDoc({ id, ...over }));
        });
      }

      it('lets the owning parent or student submit a slip (PENDING/OVERDUE → VERIFYING)', async () => {
        await seedInvoice('pay-1');
        await assertSucceeds(asUser(PARENT_UID, ['PARENT']).firestore().doc('billing_invoices/pay-1').update(slipPatch(PARENT_UID)));
        await seedInvoice('pay-2', { status: 'OVERDUE' });
        await assertSucceeds(asUser(STU_UID, ['STUDENT']).firestore().doc('billing_invoices/pay-2').update(slipPatch(STU_UID)));
      });

      it('denies a parent marking an invoice PAID, changing the amount, or pointing the slip at a non-Storage URL', async () => {
        await seedInvoice('pay-3');
        const db = asUser(PARENT_UID, ['PARENT']).firestore();
        await assertFails(db.doc('billing_invoices/pay-3').update({ status: 'PAID', verifiedBy: PARENT_UID }));
        await assertFails(db.doc('billing_invoices/pay-3').update({ ...slipPatch(PARENT_UID), totalAmount: 1 }));
        await assertFails(db.doc('billing_invoices/pay-3').update(slipPatch(PARENT_UID, { slipUrl: 'https://evil.example.com/slip.jpg' })));
        await assertFails(db.doc('billing_invoices/pay-3').update(slipPatch(PARENT_UID, { slipUploadedByUid: 'someone-else' })));
        await assertFails(db.doc('billing_invoices/pay-3').update(slipPatch(PARENT_UID, { receiptNo: 'REC-FAKE' })));
      });

      it('denies a slip from a non-owner, and on invoices already VERIFYING or PAID', async () => {
        await seedInvoice('pay-4');
        await assertFails(asUser('other-parent', ['PARENT']).firestore().doc('billing_invoices/pay-4').update(slipPatch('other-parent')));
        await seedInvoice('pay-5', { status: 'VERIFYING' });
        await assertFails(asUser(PARENT_UID, ['PARENT']).firestore().doc('billing_invoices/pay-5').update(slipPatch(PARENT_UID)));
        await seedInvoice('pay-6', { status: 'PAID' });
        await assertFails(asUser(PARENT_UID, ['PARENT']).firestore().doc('billing_invoices/pay-6').update(slipPatch(PARENT_UID)));
      });

      it('lets FINANCE_STAFF confirm PAID only when verifiedBy is their own uid', async () => {
        await seedInvoice('pay-7', { status: 'VERIFYING', ...slipPatch(PARENT_UID) });
        const db = asUser(FINANCE_UID, ['FINANCE_STAFF']).firestore();
        await assertFails(db.doc('billing_invoices/pay-7').update({ status: 'PAID', receiptNo: 'INV-2569-0001' }));
        await assertFails(db.doc('billing_invoices/pay-7').update({ status: 'PAID', verifiedBy: 'someone-else' }));
        await assertSucceeds(db.doc('billing_invoices/pay-7').update({
          status: 'PAID', verifiedBy: FINANCE_UID, verifiedByName: 'การเงิน', verifiedAt: '2026-10-12T11:00:00.000Z',
          paidAt: '2026-10-12T11:00:00.000Z', paymentMethod: 'SLIP_VERIFIED', receiptNo: 'INV-2569-0001',
        }));
      });

      it('lets FINANCE_STAFF reject a slip back to PENDING with a reason, and the parent can then resubmit', async () => {
        await seedInvoice('pay-8', { status: 'VERIFYING', ...slipPatch(PARENT_UID) });
        await assertSucceeds(asUser(FINANCE_UID, ['FINANCE_STAFF']).firestore().doc('billing_invoices/pay-8').update({
          status: 'PENDING', slipRejectedReason: 'ยอดไม่ตรง', slipRejectedAt: '2026-10-12T11:00:00.000Z', slipRejectedBy: FINANCE_UID,
        }));
        const parentDb = asUser(PARENT_UID, ['PARENT']).firestore();
        // ส่งซ้ำแต่ยังเก็บเหตุผลเดิมไว้ → ไม่ได้ (ต้องล้างเป็น null)
        await assertFails(parentDb.doc('billing_invoices/pay-8').update(slipPatch(PARENT_UID, { slipRejectedReason: 'ยอดไม่ตรง' })));
        await assertSucceeds(parentDb.doc('billing_invoices/pay-8').update(slipPatch(PARENT_UID)));
      });
    });

    it('only SUPER_ADMIN/FINANCE_STAFF can read/write billing_counters directly', async () => {
      await assertSucceeds(asRole('FINANCE_STAFF').firestore().doc('billing_counters/2569').set({ academicYear: '2569', lastNumber: 5 }));
      await assertSucceeds(asRole('SUPER_ADMIN').firestore().doc('billing_counters/2569').get());
      await assertFails(asRole('SUBJECT_TEACHER').firestore().doc('billing_counters/2569').get());
      await assertFails(asUser(PARENT_UID, ['PARENT']).firestore().doc('billing_counters/2569').set({ academicYear: '2569', lastNumber: 999 }));
    });

    // REAL race condition — 2 ใบแจ้งหนี้ถูกสร้างพร้อมกัน ต้องได้เลขที่ไม่ชนกัน (ยิงผ่าน
    // createBillingInvoice จริงจาก services/firestoreService.ts ไม่ใช่จำลองแยก — ทดสอบโค้ดเดียวกับ
    // ที่ใช้งานจริง ผ่าน context.firestore() ของ rules-testing SDK แทน db ของแอป เหมือนระบบสมัครชุมนุม)
    it('สร้างใบแจ้งหนี้ 2 รายการพร้อมกัน — เลขที่ใบแจ้งหนี้ต้องไม่ชนกันและต่อเนื่อง', async () => {
      const YEAR_STU_A = 'bill-race-std-a';
      const YEAR_STU_B = 'bill-race-std-b';
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc(`students/${YEAR_STU_A}`).set({ studentId: YEAR_STU_A, studentUid: 'race-uid-a', parentUid: 'race-parent-a' });
        await ctx.firestore().doc(`students/${YEAR_STU_B}`).set({ studentId: YEAR_STU_B, studentUid: 'race-uid-b', parentUid: 'race-parent-b' });
      });

      const dbFinance = asUser('finance-race-uid', ['FINANCE_STAFF']).firestore();
      const input = { title: 'ค่าเทอม', items: [{ description: 'ค่าเทอม', amount: 1000 }], totalAmount: 1000, dueDate: '2026-12-31' };

      const results = await Promise.all([
        createBillingInvoice({ studentId: YEAR_STU_A, studentUid: 'race-uid-a', parentUid: 'race-parent-a', ...input }, 'finance-race-uid', dbFinance as any),
        createBillingInvoice({ studentId: YEAR_STU_B, studentUid: 'race-uid-b', parentUid: 'race-parent-b', ...input }, 'finance-race-uid', dbFinance as any),
      ]);

      expect(results).toHaveLength(2);
      const invoiceNumbers = await Promise.all(results.map(async (id) => {
        let invoiceNumber = '';
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
          const snap = await ctx.firestore().doc(`billing_invoices/${id}`).get();
          invoiceNumber = (snap.data() as any).invoiceNumber;
        });
        return invoiceNumber;
      }));
      // ต้องไม่ชนกัน (unique) และเป็นรูปแบบ auditable ที่ถูกต้อง
      expect(new Set(invoiceNumbers).size).toBe(2);
      for (const num of invoiceNumbers) {
        expect(num).toMatch(/^INV-\d{4}-\d{4,}$/);
      }
    });

    it('createBillingInvoicesBulk ออกเลขที่ต่อเนื่องไม่ซ้ำให้ทุกคนในชุดเดียว', async () => {
      const ids = ['bulk-std-1', 'bulk-std-2', 'bulk-std-3'];
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        for (const sid of ids) {
          await ctx.firestore().doc(`students/${sid}`).set({ studentId: sid, studentUid: `${sid}-uid`, parentUid: `${sid}-parent` });
        }
      });
      const dbFinance = asUser('finance-bulk-uid', ['FINANCE_STAFF']).firestore();
      const targets = ids.map(sid => ({ studentId: sid, studentUid: `${sid}-uid`, parentUid: `${sid}-parent` }));
      const created = await createBillingInvoicesBulk(
        targets,
        { title: 'ค่าเทอมรวมทั้งห้อง', items: [{ description: 'ค่าเทอม', amount: 2000 }], totalAmount: 2000, dueDate: '2026-12-31' },
        'finance-bulk-uid',
        dbFinance as any,
      );
      expect(created).toHaveLength(3);
      const invoiceNumbers = await Promise.all(created.map(async (id) => {
        let invoiceNumber = '';
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
          const snap = await ctx.firestore().doc(`billing_invoices/${id}`).get();
          invoiceNumber = (snap.data() as any).invoiceNumber;
        });
        return invoiceNumber;
      }));
      expect(new Set(invoiceNumbers).size).toBe(3);
    });
  });

  // student_semester_health — น้ำหนัก/ส่วนสูงรายภาคเรียน (นักเรียนกรอกเอง ภาคเรียนละ 1 ครั้ง)
  describe('student_semester_health collection', () => {
    const SID = '69777';
    const STU_UID = 'sem-stu-uid';
    const PARENT_UID = 'sem-parent-uid';
    const DOC_ID = `${SID}_2569_1`;
    const goodDoc = {
      studentId: SID, studentUid: STU_UID, parentUid: PARENT_UID,
      academicYear: '2569', term: '1', semester: '1/2569',
      height: 165, weight: 55, bmi: 20.2, bmiCategory: 'NORMAL', bloodType: 'O',
      recordedByUid: STU_UID, recordedByRole: 'STUDENT', recordedAt: '2026-09-10T00:00:00Z',
    };

    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc(`students/${SID}`).set({ studentId: SID, studentUid: STU_UID, parentUid: PARENT_UID, room: 'ม.5/8' });
      });
    });

    it('allows a STUDENT to self-report once for the current semester', async () => {
      const studentDb = asUser(STU_UID, ['STUDENT']).firestore();
      await assertSucceeds(studentDb.doc(`student_semester_health/${DOC_ID}`).set(goodDoc));
    });

    it('denies a second self-report for the same semester (create over an existing doc)', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc(`student_semester_health/${DOC_ID}`).set(goodDoc);
      });
      const studentDb = asUser(STU_UID, ['STUDENT']).firestore();
      await assertFails(studentDb.doc(`student_semester_health/${DOC_ID}`).set({ ...goodDoc, weight: 99 }));
      // นักเรียนแก้ย้อนหลังเองก็ไม่ได้
      await assertFails(studentDb.doc(`student_semester_health/${DOC_ID}`).update({ weight: 99 }));
    });

    it('เอกสารค้างของบัญชีเก่า (studentUid ไม่ตรงทะเบียนปัจจุบัน): นักเรียนตัวจริงเขียนทับได้ครั้งเดียว แล้วล็อกตามปกติ', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc(`student_semester_health/${DOC_ID}`).set({ ...goodDoc, studentUid: 'old-account-uid', recordedByUid: 'old-account-uid' });
      });
      const studentDb = asUser(STU_UID, ['STUDENT']).firestore();
      await assertSucceeds(studentDb.doc(`student_semester_health/${DOC_ID}`).set(goodDoc));
      // เขียนทับแล้วเป็นของบัญชีนี้ — กลับไปล็อก เขียนซ้ำไม่ได้
      await assertFails(studentDb.doc(`student_semester_health/${DOC_ID}`).set({ ...goodDoc, weight: 99 }));
    });

    it('อ่านตามทะเบียนจริง: เอกสารที่ค้าง studentUid เก่า/parentUid=null นักเรียนตัวจริงและผู้ปกครองตัวจริงอ่านได้ (query ด้วย studentId); คนอื่นอ่านไม่ได้', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc(`students/${SID}`).update({ parentUid: PARENT_UID });
        await ctx.firestore().doc(`student_semester_health/${DOC_ID}`).set({ ...goodDoc, studentUid: 'old-account-uid', parentUid: null, recordedByUid: 'old-account-uid' });
      });
      const col = (db: any) => db.collection('student_semester_health').where('studentId', '==', SID);
      await assertSucceeds(col(asUser(STU_UID, ['STUDENT']).firestore()).get());
      await assertSucceeds(col(asUser(PARENT_UID, ['PARENT']).firestore()).get());
      await assertFails(col(asUser('other-stu', ['STUDENT']).firestore()).get());
      await assertFails(col(asUser('other-par', ['PARENT']).firestore()).get());
    });

    it('เขียนทับเอกสารค้างได้เฉพาะนักเรียนตัวจริง/ภาคเรียนเดิม/ข้อมูลตรงทะเบียน (คนอื่น เปลี่ยนภาคเรียน ส่งเจ้าของผิด ถูกปฏิเสธ)', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc(`student_semester_health/${DOC_ID}`).set({ ...goodDoc, studentUid: 'old-account-uid', recordedByUid: 'old-account-uid' });
      });
      const other = asUser('someone-else', ['STUDENT']).firestore();
      await assertFails(other.doc(`student_semester_health/${DOC_ID}`).set({ ...goodDoc, recordedByUid: 'someone-else' }));
      const studentDb = asUser(STU_UID, ['STUDENT']).firestore();
      // goodDoc.term เป็น '1' อยู่แล้ว (= ภาคเรียนเดิมของ DOC_ID) จึงต้องใช้ '2' เพื่อทดสอบการเปลี่ยนภาคเรียน
      await assertFails(studentDb.doc(`student_semester_health/${DOC_ID}`).set({ ...goodDoc, term: '2' }));
      await assertFails(studentDb.doc(`student_semester_health/${DOC_ID}`).set({ ...goodDoc, studentUid: 'old-account-uid' }));
      await assertFails(studentDb.doc(`student_semester_health/${DOC_ID}`).set({ ...goodDoc, recordedByUid: 'old-account-uid' }));
      await assertFails(studentDb.doc(`student_semester_health/${DOC_ID}`).set({ ...goodDoc, recordedByRole: 'INFIRMARY' }));
    });

    it('denies a doc id that does not match studentId_academicYear_term', async () => {
      const studentDb = asUser(STU_UID, ['STUDENT']).firestore();
      await assertFails(studentDb.doc(`student_semester_health/${SID}_bogus`).set(goodDoc));
    });

    it('denies self-report with a mismatched studentUid / parentUid denormalization', async () => {
      const studentDb = asUser(STU_UID, ['STUDENT']).firestore();
      await assertFails(studentDb.doc(`student_semester_health/${DOC_ID}`).set({ ...goodDoc, parentUid: 'someone-else' }));
      const otherStudentDb = asUser('other-stu-uid', ['STUDENT']).firestore();
      await assertFails(otherStudentDb.doc(`student_semester_health/${DOC_ID}`).set({ ...goodDoc, studentUid: 'other-stu-uid', recordedByUid: 'other-stu-uid' }));
    });

    it('allows INFIRMARY_STAFF to create and to override (update) an existing record', async () => {
      const nurseDb = asRole('INFIRMARY_STAFF').firestore();
      await assertSucceeds(nurseDb.doc(`student_semester_health/${DOC_ID}`).set({ ...goodDoc, recordedByUid: 'test-uid', recordedByRole: 'INFIRMARY_STAFF' }));
      await assertSucceeds(nurseDb.doc(`student_semester_health/${DOC_ID}`).update({ weight: 58, bmi: 21.3 }));
    });

    it('lets the owner student, linked parent, homeroom teacher and nurse read; denies an unrelated user', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc(`student_semester_health/${DOC_ID}`).set(goodDoc);
      });
      await assertSucceeds(asUser(STU_UID, ['STUDENT']).firestore().doc(`student_semester_health/${DOC_ID}`).get());
      await assertSucceeds(asUser(PARENT_UID, ['PARENT']).firestore().doc(`student_semester_health/${DOC_ID}`).get());
      await assertSucceeds(asRole('HOMEROOM_TEACHER').firestore().doc(`student_semester_health/${DOC_ID}`).get());
      await assertSucceeds(asRole('INFIRMARY_STAFF').firestore().doc(`student_semester_health/${DOC_ID}`).get());
      await assertFails(asUser('random-uid', ['STUDENT']).firestore().doc(`student_semester_health/${DOC_ID}`).get());
    });
  });

  // gps_check_in_logs — เช็คอิน GPS: userId เป็นรหัสนักเรียน/บุคลากร (ไม่ใช่ uid) จึงเทียบด้วย authUid
  describe('gps_check_in_logs collection', () => {
    const GLOG = {
      userId: '10001', userName: 'Somchai', userRole: 'STUDENT', type: 'ENTRY', timestamp: '07:28 น.', date: '2026-09-10',
      latitude: 17.6, longitude: 100.1, distanceMeters: 12, isInsideGeofence: true, status: 'ON_TIME', authUid: 'gps-stu-uid',
    };

    it('lets any signed-in user (even a student with role STUDENT) write their own log when authUid == auth.uid', async () => {
      const studentDb = asUser('gps-stu-uid', ['STUDENT']).firestore();
      await assertSucceeds(studentDb.doc('gps_check_in_logs/c1').set(GLOG));
      await assertSucceeds(studentDb.doc('gps_check_in_logs/c1').get());
    });

    it('denies writing a log attributed to someone else (authUid != auth.uid and userId != uid)', async () => {
      const studentDb = asUser('gps-stu-uid', ['STUDENT']).firestore();
      await assertFails(studentDb.doc('gps_check_in_logs/c2').set({ ...GLOG, authUid: 'someone-else' }));
    });

    it('denies another student reading the log; lets homeroom teacher read', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('gps_check_in_logs/c3').set(GLOG);
      });
      await assertFails(asUser('other-uid', ['STUDENT']).firestore().doc('gps_check_in_logs/c3').get());
      await assertSucceeds(asRole('HOMEROOM_TEACHER').firestore().doc('gps_check_in_logs/c3').get());
    });
  });

  // gps_checkin_selfies — รูปเซลฟี่เช็คอินแยกเอกสาร หมดอายุเองด้วย TTL (expireAt)
  describe('gps_checkin_selfies collection', () => {
    const DAY = 24 * 60 * 60 * 1000;
    const selfie = (over: Record<string, unknown> = {}) => ({
      authUid: 'sf-stu-uid', userId: '10001', homeroomClass: 'ม.5/8', date: '2026-10-13',
      dataUrl: 'data:image/jpeg;base64,AAAA', expireAt: new Date(Date.now() + 30 * DAY), ...over,
    });
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('staff/teacher-07').set({ roles: ['HOMEROOM_TEACHER'], assignments: { homeroomClass: 'ม.5/8' } });
        await ctx.firestore().doc('staff/teacher-08').set({ roles: ['HOMEROOM_TEACHER'], assignments: { homeroomClass: 'ม.6/1' } });
      });
    });

    it('lets the owner create their own selfie (authUid == auth.uid) and read it back', async () => {
      const db = asUser('sf-stu-uid', ['STUDENT']).firestore();
      await assertSucceeds(db.doc('gps_checkin_selfies/s1').set(selfie()));
      await assertSucceeds(db.doc('gps_checkin_selfies/s1').get());
    });

    it('denies creating a selfie attributed to someone else', async () => {
      await assertFails(asUser('sf-stu-uid', ['STUDENT']).firestore().doc('gps_checkin_selfies/s2').set(selfie({ authUid: 'other-uid' })));
    });

    it('denies a missing/past/too-far expireAt, an oversized dataUrl and unknown fields', async () => {
      const db = asUser('sf-stu-uid', ['STUDENT']).firestore();
      await assertFails(db.doc('gps_checkin_selfies/s3').set(selfie({ expireAt: new Date(Date.now() - DAY) })));
      await assertFails(db.doc('gps_checkin_selfies/s4').set(selfie({ expireAt: new Date(Date.now() + 365 * DAY) })));
      await assertFails(db.doc('gps_checkin_selfies/s5').set(selfie({ dataUrl: 'x'.repeat(140001) })));
      await assertFails(db.doc('gps_checkin_selfies/s6').set(selfie({ extra: 1 })));
      const { expireAt: _e, ...noExpire } = selfie();
      await assertFails(db.doc('gps_checkin_selfies/s7').set(noExpire));
    });

    it('denies updating an existing selfie (even by the owner)', async () => {
      const db = asUser('sf-stu-uid', ['STUDENT']).firestore();
      await assertSucceeds(db.doc('gps_checkin_selfies/s8').set(selfie()));
      await assertFails(db.doc('gps_checkin_selfies/s8').set(selfie({ dataUrl: 'data:image/jpeg;base64,BBBB' })));
    });

    it('lets the homeroom teacher of THAT room read; denies another room, another student, and a blank-room doc', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('gps_checkin_selfies/s9').set(selfie());
        await ctx.firestore().doc('gps_checkin_selfies/s10').set(selfie({ homeroomClass: '' }));
      });
      await assertSucceeds(asUser('hr-1', ['HOMEROOM_TEACHER'], { staffId: 'teacher-07' }).firestore().doc('gps_checkin_selfies/s9').get());
      await assertFails(asUser('hr-2', ['HOMEROOM_TEACHER'], { staffId: 'teacher-08' }).firestore().doc('gps_checkin_selfies/s9').get());
      await assertFails(asUser('stu-2', ['STUDENT']).firestore().doc('gps_checkin_selfies/s9').get());
      await assertFails(asUser('hr-1', ['HOMEROOM_TEACHER'], { staffId: 'teacher-07' }).firestore().doc('gps_checkin_selfies/s10').get());
      await assertSucceeds(asRole('SUPER_ADMIN').firestore().doc('gps_checkin_selfies/s9').get());
    });

    it('only SUPER_ADMIN may delete', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('gps_checkin_selfies/s11').set(selfie());
      });
      await assertFails(asUser('sf-stu-uid', ['STUDENT']).firestore().doc('gps_checkin_selfies/s11').delete());
      await assertSucceeds(asRole('SUPER_ADMIN').firestore().doc('gps_checkin_selfies/s11').delete());
    });
  });

  // gate_attendance_logs — การผ่านประตูโรงเรียน (ครูที่ปรึกษา/ผู้ปกครอง/นักเรียน อ่านผ่าน denormalized uid)
  describe('gate_attendance_logs collection', () => {
    const LOG = {
      studentId: '69501', studentName: 'Somchai', studentUid: 'gate-stu-uid', parentUid: 'gate-parent-uid',
      type: 'ENTRY', timestamp: '07:28 น.', date: '2026-09-10', gateName: 'ประตู 1', method: 'GPS_GEOFENCE',
      status: 'ON_TIME', parentNotified: true,
    };

    it('lets homeroom teacher / EXECUTIVE read; lets the linked parent and the student self read via denormalized uid', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('gate_attendance_logs/g1').set(LOG);
      });
      await assertSucceeds(asRole('HOMEROOM_TEACHER').firestore().doc('gate_attendance_logs/g1').get());
      await assertSucceeds(asRole('EXECUTIVE').firestore().doc('gate_attendance_logs/g1').get());
      await assertSucceeds(asUser('gate-parent-uid', ['PARENT']).firestore().doc('gate_attendance_logs/g1').get());
      await assertSucceeds(asUser('gate-stu-uid', ['STUDENT']).firestore().doc('gate_attendance_logs/g1').get());
      await assertFails(asUser('unrelated-uid', ['STUDENT']).firestore().doc('gate_attendance_logs/g1').get());
    });

    it('lets a parent LIST by parentUid and a student LIST by studentUid; denies an unfiltered list', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('gate_attendance_logs/g1').set(LOG);
        await ctx.firestore().doc('gate_attendance_logs/g2').set({ ...LOG, studentId: '69502', studentUid: 'x', parentUid: 'y' });
      });
      const parentDb = asUser('gate-parent-uid', ['PARENT']).firestore();
      await assertSucceeds(getDocs(query(collection(parentDb, 'gate_attendance_logs'), where('parentUid', '==', 'gate-parent-uid'))));
      await assertFails(getDocs(collection(parentDb, 'gate_attendance_logs')));
      const studentDb = asUser('gate-stu-uid', ['STUDENT']).firestore();
      await assertSucceeds(getDocs(query(collection(studentDb, 'gate_attendance_logs'), where('studentUid', '==', 'gate-stu-uid'))));
    });

    it('lets a student write their own gate log (studentUid == auth.uid); denies writing for another student', async () => {
      const studentDb = asUser('gate-stu-uid', ['STUDENT']).firestore();
      await assertSucceeds(studentDb.doc('gate_attendance_logs/gs1').set(LOG));
      await assertFails(studentDb.doc('gate_attendance_logs/gs2').set({ ...LOG, studentUid: 'someone-else' }));
    });
  });

  // 14.5 log การนำเข้าภาระงานสอน (schedule_import_logs) — append-only, SUPER_ADMIN สร้างเอง, ไม่เปิดให้ signed-in ทั่วไป
  describe('schedule_import_logs (log การนำเข้าภาระงานสอน)', () => {
    const LOG = { type: 'TEACHING_LOAD_IMPORT', importedByUid: 'admin-uid', academicYear: '2569', term: '1', teacherChanges: [], cleanedSchedules: [] };

    it('SUPER_ADMIN สร้าง log ของตัวเองได้ (importedByUid == auth.uid)', async () => {
      const db = asUser('admin-uid', ['SUPER_ADMIN']).firestore();
      await assertSucceeds(db.doc('schedule_import_logs/l1').set(LOG));
    });

    it('SUPER_ADMIN สร้าง log แทนคนอื่น หรือผิดชนิด ไม่ได้', async () => {
      const db = asUser('admin-uid', ['SUPER_ADMIN']).firestore();
      await assertFails(db.doc('schedule_import_logs/l2').set({ ...LOG, importedByUid: 'someone-else' }));
      await assertFails(db.doc('schedule_import_logs/l3').set({ ...LOG, type: 'OTHER' }));
    });

    it('บทบาทอื่นสร้างไม่ได้ (ครู, หัวหน้าวิชาการ, ผู้บริหาร)', async () => {
      for (const role of ['SUBJECT_TEACHER', 'HOMEROOM_TEACHER', 'ACADEMIC_HEAD', 'DIRECTOR', 'EXECUTIVE']) {
        const db = asUser('admin-uid', [role]).firestore();
        await assertFails(db.doc(`schedule_import_logs/x-${role}`).set(LOG));
      }
    });

    it('log แก้ไข/ลบไม่ได้แม้เป็น SUPER_ADMIN (append-only)', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('schedule_import_logs/seed1').set(LOG);
      });
      const db = asUser('admin-uid', ['SUPER_ADMIN']).firestore();
      await assertFails(db.doc('schedule_import_logs/seed1').update({ term: '2' }));
      await assertFails(db.doc('schedule_import_logs/seed1').delete());
    });

    it('อ่านได้เฉพาะ SUPER_ADMIN / หัวหน้าวิชาการ / รองผอ.วิชาการ / ผอ. — ครู นักเรียน และผู้ปกครองอ่านไม่ได้', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('schedule_import_logs/seed2').set(LOG);
      });
      for (const role of ['SUPER_ADMIN', 'ACADEMIC_HEAD', 'DEPUTY_DIRECTOR_ACADEMIC', 'DIRECTOR']) {
        await assertSucceeds(asUser('reader-uid', [role]).firestore().doc('schedule_import_logs/seed2').get());
      }
      for (const role of ['SUBJECT_TEACHER', 'HOMEROOM_TEACHER', 'STUDENT', 'PARENT']) {
        await assertFails(asUser('reader-uid', [role]).firestore().doc('schedule_import_logs/seed2').get());
      }
      await assertFails(asAnonymous().firestore().doc('schedule_import_logs/seed2').get());
    });
  });

  // 15. Default Deny Catch-All (Regression Test 5)
  describe('Default Deny Catch-All (Undeclared paths)', () => {
    it('REGRESSION: denies authenticated user with no matching role from reading or writing undeclared collections', async () => {
      const db = asRole('SOME_ARBITRARY_ROLE').firestore();

      await assertFails(db.doc('some_future_collection/doc1').get());
      await assertFails(db.doc('some_future_collection/doc1').set({ data: 123 }));
      await assertFails(db.doc('internal_audit_logs/log_01').get());
      await assertFails(db.doc('internal_audit_logs/log_01').set({ note: 'attempt' }));
    });
  });

  // 16b. home_visit_student_info / home_visit_family_info — ข้อมูลเยี่ยมบ้านที่นักเรียน/ผู้ปกครองกรอกเอง
  describe('home_visit_student_info / home_visit_family_info', () => {
    const ROOM = 'ม.5/8', T_ID = 'teacher-07', T_UID = 'hr-uid-1';
    const stu = (over: Record<string, unknown> = {}) => ({ studentId: '10001', studentUid: 'stu-1', homeroomClass: ROOM, ...over });
    const fam = (over: Record<string, unknown> = {}) => ({ studentId: '10001', parentUid: 'par-1', homeroomClass: ROOM, ...over });
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc(`staff/${T_ID}`).set({ roles: ['HOMEROOM_TEACHER'], assignments: { homeroomClass: ROOM } });
        await ctx.firestore().doc('staff/teacher-08').set({ roles: ['HOMEROOM_TEACHER'], assignments: { homeroomClass: 'ม.6/1' } });
        await ctx.firestore().doc('students/10001').set({ studentId: '10001', room: ROOM, studentUid: 'stu-1', parentUid: 'par-1' });
      });
    });
    const S = () => asUser('stu-1', ['STUDENT'], { studentId: '10001' }).firestore();
    const P = () => asUser('par-1', ['PARENT']).firestore();
    const HR = () => asUser(T_UID, ['HOMEROOM_TEACHER'], { staffId: T_ID }).firestore();

    it('นักเรียนเจ้าของเขียน/อ่าน/แก้ของตัวเองได้ (ก่อนมีเอกสารก็อ่านได้)', async () => {
      await assertSucceeds(S().doc('home_visit_student_info/10001').get());
      await assertSucceeds(S().doc('home_visit_student_info/10001').set(stu()));
      await assertSucceeds(S().doc('home_visit_student_info/10001').update({ nationality: 'ไทย' }));
    });
    it('ปฏิเสธ: นักเรียนเขียนแทนคนอื่น / uid ไม่ตรง / ห้องไม่ตรง / ผู้ปกครองเขียนเอกสารนักเรียน', async () => {
      await assertFails(S().doc('home_visit_student_info/10002').set(stu({ studentId: '10002' })));
      await assertFails(S().doc('home_visit_student_info/10001').set(stu({ studentUid: 'other' })));
      await assertFails(S().doc('home_visit_student_info/10001').set(stu({ homeroomClass: 'ม.6/1' })));
      await assertFails(P().doc('home_visit_student_info/10001').set(stu()));
    });
    it('REGRESSION: ผูกบัญชีนักเรียนใหม่ (uid เปลี่ยน) — เอกสารเดิมที่เก็บ uid เก่ายังอ่านได้ด้วย uid ปัจจุบัน; uid เก่า/คนอื่นอ่านไม่ได้', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('home_visit_student_info/10001').set(stu({ studentUid: 'old-uid-before-relink' }));
        await ctx.firestore().doc('home_visit_family_info/10001').set(fam({ parentUid: 'old-parent-uid' }));
      });
      // students/10001.studentUid = 'stu-1' (uid ปัจจุบัน)
      await assertSucceeds(S().doc('home_visit_student_info/10001').get());
      await assertSucceeds(P().doc('home_visit_family_info/10001').get());
      await assertFails(asUser('old-uid-before-relink', ['STUDENT']).firestore().doc('home_visit_student_info/10001').get());
      await assertFails(asUser('stranger', ['STUDENT']).firestore().doc('home_visit_student_info/10001').get());
      await assertFails(asUser('old-parent-uid', ['PARENT']).firestore().doc('home_visit_family_info/10001').get());
    });
    it('ผู้ปกครองที่ผูก parentUid เขียน/อ่านเอกสารครอบครัวได้; นักเรียนอ่าน/เขียนไม่ได้; ผู้ปกครองคนอื่นไม่ได้', async () => {
      await assertSucceeds(P().doc('home_visit_family_info/10001').set(fam()));
      await assertSucceeds(P().doc('home_visit_family_info/10001').get());
      await assertFails(S().doc('home_visit_family_info/10001').get());
      await assertFails(S().doc('home_visit_family_info/10001').set(fam({ parentUid: 'stu-1' })));
      const other = asUser('par-2', ['PARENT']).firestore();
      await assertFails(other.doc('home_visit_family_info/10001').get());
      await assertFails(other.doc('home_visit_family_info/10001').set(fam({ parentUid: 'par-2' })));
      await assertFails(P().doc('home_visit_family_info/10001').set(fam({ homeroomClass: 'ม.6/1' })));
    });
    it('ครูที่ปรึกษาห้องนั้นอ่านได้ แต่เขียนไม่ได้; ห้องอื่น/ครูวิชา/ไม่ล็อกอินอ่านไม่ได้', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('home_visit_student_info/10001').set(stu());
        await ctx.firestore().doc('home_visit_family_info/10001').set(fam());
      });
      for (const c of ['home_visit_student_info', 'home_visit_family_info']) {
        await assertSucceeds(HR().doc(`${c}/10001`).get());
        await assertFails(HR().doc(`${c}/10001`).update({ x: 1 }));
        await assertFails(asUser('hr-uid-2', ['HOMEROOM_TEACHER'], { staffId: 'teacher-08' }).firestore().doc(`${c}/10001`).get());
        await assertFails(asUser('subj', ['SUBJECT_TEACHER']).firestore().doc(`${c}/10001`).get());
        await assertFails(asAnonymous().firestore().doc(`${c}/10001`).get());
      }
    });
    it('EXECUTIVE/SUPER_ADMIN อ่านได้; ห้ามลบทุกบทบาท', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('home_visit_student_info/10001').set(stu());
        await ctx.firestore().doc('home_visit_family_info/10001').set(fam());
      });
      for (const c of ['home_visit_student_info', 'home_visit_family_info']) {
        await assertSucceeds(asUser('ex', ['EXECUTIVE']).firestore().doc(`${c}/10001`).get());
        await assertSucceeds(asUser('adm', ['SUPER_ADMIN']).firestore().doc(`${c}/10001`).get());
        await assertFails(asUser('adm', ['SUPER_ADMIN']).firestore().doc(`${c}/10001`).delete());
      }
      await assertFails(S().doc('home_visit_student_info/10001').delete());
      await assertFails(P().doc('home_visit_family_info/10001').delete());
    });
  });

  // 16b-2. student_registry_profiles — ข้อมูลส่วนหัว ปพ.6 + เลขประจำตัวประชาชน (PDPA) สิทธิ์จำกัด
  describe('student_registry_profiles (เลขประจำตัวประชาชน/ส่วนหัว ปพ.6)', () => {
    const ROOM = 'ม.5/8', T_ID = 'teacher-07', T_UID = 'hr-uid-1';
    const prof = (over: Record<string, unknown> = {}) => ({
      studentId: '10001', studentUid: 'stu-1', homeroomClass: ROOM, nationalId: '1101700230678',
      enrolledAt: '2566-05-16', gender: 'M', birthDate: '2552-01-01',
      nationality: 'ไทย', religion: 'พุทธ', prevSchool: 'โรงเรียนเดิม', prevProvince: 'อุตรดิตถ์', updatedAt: mServerTimestamp(), ...over,
    });
    const ref = (db: any, id = '10001') => mDoc(db, `student_registry_profiles/${id}`);
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc(`staff/${T_ID}`).set({ roles: ['HOMEROOM_TEACHER'], assignments: { homeroomClass: ROOM } });
        await ctx.firestore().doc('staff/teacher-08').set({ roles: ['HOMEROOM_TEACHER'], assignments: { homeroomClass: 'ม.6/1' } });
        await ctx.firestore().doc('students/10001').set({ studentId: '10001', room: ROOM, studentUid: 'stu-1', parentUid: 'par-1' });
        await ctx.firestore().doc('student_registry_profiles/10001').set({ ...prof(), updatedAt: new Date() });
      });
    });
    const S = () => asUser('stu-1', ['STUDENT'], { studentId: '10001' }).firestore();
    const P = () => asUser('par-1', ['PARENT']).firestore();
    const HR = () => asUser(T_UID, ['HOMEROOM_TEACHER'], { staffId: T_ID }).firestore();

    it('นักเรียนเจ้าของเขียน/แก้ได้ (nationalId 13 หลักหรือว่าง)', async () => {
      await assertSucceeds(mSetDoc(ref(S()), prof()));
      await assertSucceeds(mSetDoc(ref(S()), prof({ nationalId: '' })));
    });
    it('ปฏิเสธ: เลขไม่ใช่ 13 หลัก / มีตัวอักษร / uid ไม่ตรง / ห้องไม่ตรง / เขียนแทนคนอื่น / field เกิน / updatedAt ไม่ใช่เวลาเซิร์ฟเวอร์', async () => {
      await assertFails(mSetDoc(ref(S()), prof({ nationalId: '12345' })));
      await assertFails(mSetDoc(ref(S()), prof({ nationalId: '11017002306AB' })));
      await assertFails(mSetDoc(ref(S()), prof({ studentUid: 'other' })));
      await assertFails(mSetDoc(ref(S()), prof({ homeroomClass: 'ม.6/1' })));
      await assertFails(mSetDoc(ref(S(), '10002'), prof({ studentId: '10002' })));
      await assertFails(mSetDoc(ref(S()), prof({ extra: 'x' })));
      await assertFails(mSetDoc(ref(S()), prof({ updatedAt: new Date('2020-01-01') })));
      await assertFails(mSetDoc(ref(S()), prof({ gender: 'X' })));
    });
    it('ผู้ปกครองตัวจริง/ครูที่ปรึกษาห้องนั้น/SUPER_ADMIN อ่านได้ แต่ผู้ปกครองและครูเขียนไม่ได้', async () => {
      await assertSucceeds(mGetDoc(ref(S())));
      await assertSucceeds(mGetDoc(ref(P())));
      await assertSucceeds(mGetDoc(ref(HR())));
      await assertSucceeds(mGetDoc(ref(asUser('adm', ['SUPER_ADMIN']).firestore())));
      await assertFails(mSetDoc(ref(P()), prof()));
      await assertFails(mSetDoc(ref(HR()), prof()));
    });
    it('ปฏิเสธการอ่าน: EXECUTIVE / ครูห้องอื่น / ครูวิชา / ผู้ปกครองคนอื่น / ไม่ล็อกอิน / list ทั้งคอลเลกชัน', async () => {
      await assertFails(mGetDoc(ref(asUser('ex', ['EXECUTIVE']).firestore())));
      await assertFails(mGetDoc(ref(asUser('hr-uid-2', ['HOMEROOM_TEACHER'], { staffId: 'teacher-08' }).firestore())));
      await assertFails(mGetDoc(ref(asUser('subj', ['SUBJECT_TEACHER']).firestore())));
      await assertFails(mGetDoc(ref(asUser('par-2', ['PARENT']).firestore())));
      await assertFails(mGetDoc(ref(asAnonymous().firestore())));
      await assertFails(getDocs(collection(asUser('adm', ['SUPER_ADMIN']).firestore(), 'student_registry_profiles')));
    });
    it('ห้ามลบทุกบทบาท', async () => {
      await assertFails(mDeleteDoc(ref(S())));
      await assertFails(mDeleteDoc(ref(asUser('adm', ['SUPER_ADMIN']).firestore())));
    });
  });

  // 16b-3. student_parent_names — สำเนาชื่อบิดา/มารดา (ผู้ปกครองเขียน) แสดงในส่วนหัว ปพ.6
  describe('student_parent_names', () => {
    const ROOM = 'ม.5/8', T_ID = 'teacher-07', T_UID = 'hr-uid-1';
    const names = (over: Record<string, unknown> = {}) => ({ studentId: '10001', parentUid: 'par-1', homeroomClass: ROOM, fatherName: 'นาย พ่อ ทดสอบ', motherName: 'นาง แม่ ทดสอบ', updatedAt: mServerTimestamp(), ...over });
    const ref = (db: any, id = '10001') => mDoc(db, `student_parent_names/${id}`);
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc(`staff/${T_ID}`).set({ roles: ['HOMEROOM_TEACHER'], assignments: { homeroomClass: ROOM } });
        await ctx.firestore().doc('staff/teacher-08').set({ roles: ['HOMEROOM_TEACHER'], assignments: { homeroomClass: 'ม.6/1' } });
        await ctx.firestore().doc('students/10001').set({ studentId: '10001', room: ROOM, studentUid: 'stu-1', parentUid: 'par-1' });
        await ctx.firestore().doc('student_parent_names/10001').set({ ...names(), updatedAt: new Date() });
      });
    });
    const S = () => asUser('stu-1', ['STUDENT'], { studentId: '10001' }).firestore();
    const P = () => asUser('par-1', ['PARENT']).firestore();
    const HR = () => asUser(T_UID, ['HOMEROOM_TEACHER'], { staffId: T_ID }).firestore();

    it('ผู้ปกครองตัวจริงเขียน/แก้ได้', async () => {
      await assertSucceeds(mSetDoc(ref(P()), names()));
      await assertSucceeds(mSetDoc(ref(P()), names({ fatherName: '' })));
    });
    it('ปฏิเสธ: นักเรียน/ครู/ผู้ปกครองคนอื่นเขียน, uid/ห้องไม่ตรง, field เกิน, ชื่อยาวเกิน, เวลาไม่ใช่เซิร์ฟเวอร์', async () => {
      await assertFails(mSetDoc(ref(S()), names()));
      await assertFails(mSetDoc(ref(HR()), names()));
      await assertFails(mSetDoc(ref(asUser('par-2', ['PARENT']).firestore()), names({ parentUid: 'par-2' })));
      await assertFails(mSetDoc(ref(P()), names({ parentUid: 'other' })));
      await assertFails(mSetDoc(ref(P()), names({ homeroomClass: 'ม.6/1' })));
      await assertFails(mSetDoc(ref(P()), names({ income: 1 })));
      await assertFails(mSetDoc(ref(P()), names({ fatherName: 'ก'.repeat(121) })));
      await assertFails(mSetDoc(ref(P()), names({ updatedAt: new Date('2020-01-01') })));
    });
    it('อ่านได้: ผู้ปกครอง/นักเรียนเจ้าของ/ครูที่ปรึกษาห้องนั้น/SUPER_ADMIN; อ่านไม่ได้: EXECUTIVE/ครูห้องอื่น/ครูวิชา/คนอื่น/ไม่ล็อกอิน; ห้าม list/ลบ', async () => {
      await assertSucceeds(mGetDoc(ref(P())));
      await assertSucceeds(mGetDoc(ref(S())));
      await assertSucceeds(mGetDoc(ref(HR())));
      await assertSucceeds(mGetDoc(ref(asUser('adm', ['SUPER_ADMIN']).firestore())));
      await assertFails(mGetDoc(ref(asUser('ex', ['EXECUTIVE']).firestore())));
      await assertFails(mGetDoc(ref(asUser('hr-uid-2', ['HOMEROOM_TEACHER'], { staffId: 'teacher-08' }).firestore())));
      await assertFails(mGetDoc(ref(asUser('subj', ['SUBJECT_TEACHER']).firestore())));
      await assertFails(mGetDoc(ref(asUser('par-2', ['PARENT']).firestore())));
      await assertFails(mGetDoc(ref(asAnonymous().firestore())));
      await assertFails(getDocs(collection(asUser('adm', ['SUPER_ADMIN']).firestore(), 'student_parent_names')));
      await assertFails(mDeleteDoc(ref(P())));
    });
  });

  // 16b-4. course_score_settings — สัดส่วนคะแนนรายวิชา (ต่อครู+วิชา)
  describe('course_score_settings', () => {
    const cs = (over: Record<string, unknown> = {}) => ({ ownerStaffId: 't1', courseId: 'ว21101_ม.2/1', maxPreMidterm: 30, maxMidterm: 20, maxPostMidterm: 20, maxFinal: 30, updatedAt: mServerTimestamp(), ...over });
    const T = () => asUser('u-t1', ['SUBJECT_TEACHER'], { staffId: 't1' }).firestore();
    const ref = (db: any, id = 't1__ว21101_ม.2_1') => mDoc(db, `course_score_settings/${id}`);
    it('เจ้าของบันทึก/ตั้งใหม่ทับได้ และอ่านกลับได้ (query ตาม ownerStaffId)', async () => {
      await assertSucceeds(mSetDoc(ref(T()), cs()));
      await assertSucceeds(mSetDoc(ref(T()), cs({ maxPreMidterm: 25, maxMidterm: 25 })));
      await assertSucceeds(mGetDoc(ref(T())));
      await assertSucceeds(getDocs(query(collection(T(), 'course_score_settings'), where('ownerStaffId', '==', 't1'))));
      await assertSucceeds(mGetDoc(ref(asUser('adm', ['SUPER_ADMIN']).firestore())));
    });
    it('ปฏิเสธ: รวมไม่ครบ 100/ติดลบ/ไม่ใช่จำนวนเต็ม/field เกิน/ไม่ใช่เจ้าของ/เวลาไม่ใช่เซิร์ฟเวอร์/ลบ/ครูอื่นอ่าน', async () => {
      await assertFails(mSetDoc(ref(T()), cs({ maxFinal: 31 })));
      await assertFails(mSetDoc(ref(T()), cs({ maxPreMidterm: -10, maxFinal: 70 })));
      await assertFails(mSetDoc(ref(T()), cs({ maxPreMidterm: 30.5, maxFinal: 29.5 })));
      await assertFails(mSetDoc(ref(T()), cs({ extra: 1 })));
      await assertFails(mSetDoc(ref(T()), cs({ ownerStaffId: 't2' })));
      await assertFails(mSetDoc(ref(T()), cs({ updatedAt: new Date('2020-01-01') })));
      await assertFails(mSetDoc(ref(asUser('u-st', ['STUDENT'], { staffId: 't1' }).firestore()), cs()));
      await testEnv.withSecurityRulesDisabled(async (ctx) => { await ctx.firestore().doc('course_score_settings/t1__x').set({ ...cs(), updatedAt: new Date() }); });
      await assertFails(mDeleteDoc(ref(T(), 't1__x')));
      await assertFails(mGetDoc(ref(asUser('u-t2', ['SUBJECT_TEACHER'], { staffId: 't2' }).firestore(), 't1__x')));
    });
  });

  // 16. home_visit_records — บันทึกเยี่ยมบ้าน (แบบ สพฐ.) เฉพาะครูที่ปรึกษาห้องนั้น/SUPER_ADMIN (+ EXECUTIVE อ่าน)
  describe('home_visit_records', () => {
    const ROOM = 'ม.5/8';
    const T_ID = 'teacher-07', T_UID = 'hr-uid-1';
    const rec = (over: Record<string, unknown> = {}) => ({
      studentId: '10001', homeroomClass: ROOM, visitYear: '2569', advisorUid: T_UID, teacherOpinion: 'x', ...over,
    });
    const hr = () => asUser(T_UID, ['HOMEROOM_TEACHER'], { staffId: T_ID });
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc(`staff/${T_ID}`).set({ roles: ['HOMEROOM_TEACHER'], assignments: { homeroomClass: ROOM } });
        await ctx.firestore().doc('staff/teacher-08').set({ roles: ['HOMEROOM_TEACHER'], assignments: { homeroomClass: 'ม.6/1' } });
        await ctx.firestore().doc('students/10001').set({ studentId: '10001', room: ROOM, studentUid: 'stu-1', parentUid: 'par-1' });
      });
    });

    it('ครูที่ปรึกษาห้องนั้นสร้าง/อ่าน/แก้ได้ (id = studentId_ปี, advisorUid = ตัวเอง)', async () => {
      const db = hr().firestore();
      await assertSucceeds(db.doc('home_visit_records/10001_2569').set(rec()));
      await assertSucceeds(db.doc('home_visit_records/10001_2569').get());
      await assertSucceeds(db.doc('home_visit_records/10001_2569').update({ teacherOpinion: 'y' }));
    });
    it('ปฏิเสธ: id ไม่ตรงรูปแบบ / room ไม่ตรง students / advisorUid ไม่ใช่ตัวเอง', async () => {
      const db = hr().firestore();
      await assertFails(db.doc('home_visit_records/other_2569').set(rec()));
      await assertFails(db.doc('home_visit_records/10001_2569').set(rec({ homeroomClass: 'ม.6/1' })));
      await assertFails(db.doc('home_visit_records/10001_2569').set(rec({ advisorUid: 'someone-else' })));
    });
    it('ปฏิเสธ: ครูที่ปรึกษาห้องอื่น, ครูวิชา, นักเรียน, ผู้ปกครอง, ไม่ล็อกอิน (อ่าน/เขียน)', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => { await ctx.firestore().doc('home_visit_records/10001_2569').set(rec()); });
      const others = [
        asUser('hr-uid-2', ['HOMEROOM_TEACHER'], { staffId: 'teacher-08' }),
        asUser('subj', ['SUBJECT_TEACHER']),
        asUser('stu-1', ['STUDENT'], { studentId: '10001' }),
        asUser('par-1', ['PARENT']),
      ];
      for (const c of others) {
        await assertFails(c.firestore().doc('home_visit_records/10001_2569').get());
        await assertFails(c.firestore().doc('home_visit_records/10001_2569').update({ teacherOpinion: 'hack' }));
      }
      await assertFails(asAnonymous().firestore().doc('home_visit_records/10001_2569').get());
    });
    it('EXECUTIVE อ่านได้แต่เขียนไม่ได้; SUPER_ADMIN อ่านได้; ห้ามลบทุกบทบาท', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => { await ctx.firestore().doc('home_visit_records/10001_2569').set(rec()); });
      await assertSucceeds(asUser('ex', ['EXECUTIVE']).firestore().doc('home_visit_records/10001_2569').get());
      await assertFails(asUser('ex', ['EXECUTIVE']).firestore().doc('home_visit_records/10001_2569').update({ teacherOpinion: 'z' }));
      await assertSucceeds(asUser('adm', ['SUPER_ADMIN']).firestore().doc('home_visit_records/10001_2569').get());
      await assertFails(asUser('adm', ['SUPER_ADMIN']).firestore().doc('home_visit_records/10001_2569').delete());
      await assertFails(hr().firestore().doc('home_visit_records/10001_2569').delete());
    });
  });

  describe('reference_schools / reference_villages (ข้อมูลอ้างอิงที่แอดมินจัดการ)', () => {
    const school = { id: 'c_1', baseCode: null, disabled: false, provinceCode: '53', name: 'โรงเรียนทดสอบ' };
    const village = { id: 'c_1', baseCode: null, disabled: false, tambonCode: '530101', name: 'บ้านทดสอบ' };
    it('SUPER_ADMIN เขียน/ลบได้; ผู้ล็อกอินอื่นอ่านได้แต่เขียน/ลบไม่ได้; ไม่ล็อกอินอ่านไม่ได้', async () => {
      for (const [col, doc] of [['reference_schools', school], ['reference_villages', village]] as const) {
        const adm = asUser('adm', ['SUPER_ADMIN']).firestore();
        await assertSucceeds(adm.doc(`${col}/c_1`).set(doc));
        await assertSucceeds(asUser('stu', ['STUDENT'], { studentId: '10001' }).firestore().doc(`${col}/c_1`).get());
        for (const role of ['STUDENT', 'PARENT', 'SUBJECT_TEACHER', 'HOMEROOM_TEACHER', 'EXECUTIVE'] as const) {
          const db = asUser('u-' + role, [role]).firestore();
          await assertFails(db.doc(`${col}/c_2`).set({ ...doc, id: 'c_2' }));
          await assertFails(db.doc(`${col}/c_1`).delete());
        }
        await assertFails(asAnonymous().firestore().doc(`${col}/c_1`).get());
        await assertFails(adm.doc(`${col}/c_bad`).set({ ...doc, name: '' }));
        await assertSucceeds(adm.doc(`${col}/c_1`).delete());
      }
    });
  });
  describe('student_checkups / student_vaccinations / blood_donations (บันทึกสุขภาพโดยพยาบาล)', () => {
    const SID = 'hr-std-1';
    const STU = 'hr-stu';
    const PAR = 'hr-par';
    const stu = () => asUser(STU, ['STUDENT']).firestore() as any;
    const par = () => asUser(PAR, ['PARENT']).firestore() as any;
    const otherPar = () => asUser('hr-par-2', ['PARENT']).firestore() as any;
    const nurse = () => asUser('hr-nurse', ['INFIRMARY_STAFF']).firestore() as any;
    const admin = () => asUser('hr-admin', ['SUPER_ADMIN']).firestore() as any;
    const hr = () => asUser('hr-hr', ['HOMEROOM_TEACHER'], { staffId: 'hr-hr' }).firestore() as any;
    const staffUser = () => asUser('hr-staff-uid', ['SUBJECT_TEACHER'], { staffId: 'hr-t1' }).firestore() as any;
    const otherStaff = () => asUser('hr-staff-uid2', ['SUBJECT_TEACHER'], { staffId: 'hr-t2' }).firestore() as any;
    async function seed() {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc(`students/${SID}`).set({ studentId: SID, studentUid: STU, parentUid: PAR, room: 'ม.2/2' });
        await ctx.firestore().doc('staff/hr-hr').set({ roles: ['HOMEROOM_TEACHER'], assignments: { homeroomClass: 'ม.2/2' } });
        await ctx.firestore().doc('staff/hr-t1').set({ roles: ['SUBJECT_TEACHER'] });
      });
    }
    const checkup = (uid: string, over: Record<string, unknown> = {}) => ({
      studentId: SID, academicYear: '2569', examDate: '2026-10-01', visionLeft: '20/20', visionRight: '20/25',
      visionResult: 'NORMAL', hearingResult: 'NORMAL', recordedByUid: uid, recordedByName: 'พยาบาล', recordedAt: mServerTimestamp(), ...over,
    });
    const vacc = (uid: string, over: Record<string, unknown> = {}) => ({
      studentId: SID, vaccine: 'HPV', doseDate: '2026-09-01', recordedByUid: uid, recordedByName: 'พยาบาล', recordedAt: mServerTimestamp(), ...over,
    });
    const donation = (uid: string, over: Record<string, unknown> = {}) => ({
      subjectType: 'STUDENT', studentId: SID, donorName: 'เด็กชายทดสอบ', donatedAt: '2026-09-10', recordedByUid: uid, recordedByName: 'พยาบาล', recordedAt: mServerTimestamp(), ...over,
    });

    it('student_checkups: พยาบาล/แอดมินสร้าง-แก้ได้; นักเรียน/ผู้ปกครอง/ครูสร้างไม่ได้; docId ต้อง {studentId}_{ปี}', async () => {
      await seed();
      await assertSucceeds(mSetDoc(mDoc(nurse(), `student_checkups/${SID}_2569`), checkup('hr-nurse')));
      await assertSucceeds(mSetDoc(mDoc(nurse(), `student_checkups/${SID}_2569`), checkup('hr-nurse', { hearingResult: 'ABNORMAL' })));
      await assertSucceeds(mSetDoc(mDoc(admin(), `student_checkups/${SID}_2568`), checkup('hr-admin', { academicYear: '2568' })));
      await assertFails(mSetDoc(mDoc(stu(), `student_checkups/${SID}_2570`), checkup(STU, { academicYear: '2570' })));
      await assertFails(mSetDoc(mDoc(par(), `student_checkups/${SID}_2570`), checkup(PAR, { academicYear: '2570' })));
      await assertFails(mSetDoc(mDoc(hr(), `student_checkups/${SID}_2570`), checkup('hr-hr', { academicYear: '2570' })));
      await assertFails(mSetDoc(mDoc(nurse(), `student_checkups/wrong-id`), checkup('hr-nurse', { academicYear: '2571' })));
      await assertFails(mSetDoc(mDoc(nurse(), `student_checkups/${SID}_2572`), checkup('hr-nurse', { academicYear: '2572', visionResult: 'GOOD' })));
      await assertFails(mSetDoc(mDoc(nurse(), `student_checkups/${SID}_2573`), checkup('hr-nurse', { academicYear: '2573', extra: 1 })));
      await assertFails(mSetDoc(mDoc(nurse(), `student_checkups/${SID}_2574`), checkup('someone-else', { academicYear: '2574' })));
      await assertFails((nurse() as any).doc(`student_checkups/${SID}_2569`).delete());
    });
    it('student_checkups: อ่านได้ นักเรียนเจ้าของ/ผู้ปกครองตัวจริง/ครูที่ปรึกษา/พยาบาล; ผู้ปกครองคนอื่นไม่ได้', async () => {
      await seed();
      await testEnv.withSecurityRulesDisabled(async (ctx) => { await ctx.firestore().doc(`student_checkups/${SID}_2569`).set({ ...checkup('hr-nurse'), recordedAt: new Date() }); });
      const q = (db: any) => getDocs(query(collection(db, 'student_checkups'), where('studentId', '==', SID)));
      await assertSucceeds(q(stu())); await assertSucceeds(q(par())); await assertSucceeds(q(hr())); await assertSucceeds(q(nurse()));
      await assertFails(q(otherPar()));
    });

    it('student_vaccinations: พยาบาลเพิ่ม/แก้ได้; ผู้ปกครองเพิ่มไม่ได้; ลบได้เฉพาะ SUPER_ADMIN', async () => {
      await seed();
      const ref = mDoc(nurse(), 'student_vaccinations/v1');
      await assertSucceeds(mSetDoc(ref, vacc('hr-nurse')));
      await assertSucceeds(mSetDoc(ref, vacc('hr-nurse', { note: 'เข็มที่ 2' })));
      await assertFails(mSetDoc(mDoc(par(), 'student_vaccinations/v2'), vacc(PAR)));
      await assertFails(mSetDoc(mDoc(nurse(), 'student_vaccinations/v3'), vacc('hr-nurse', { vaccine: '' })));
      await assertFails(mSetDoc(mDoc(nurse(), 'student_vaccinations/v4'), vacc('hr-nurse', { studentId: 'no-such-student' })));
      await assertFails((nurse() as any).doc('student_vaccinations/v1').delete());
      await assertSucceeds((admin() as any).doc('student_vaccinations/v1').delete());
    });
    it('student_vaccinations: อ่าน นักเรียน/ผู้ปกครอง/ครูที่ปรึกษา ผ่าน; ผู้ปกครองคนอื่นไม่ผ่าน', async () => {
      await seed();
      await testEnv.withSecurityRulesDisabled(async (ctx) => { await ctx.firestore().doc('student_vaccinations/v1').set({ ...vacc('hr-nurse'), recordedAt: new Date() }); });
      await assertSucceeds(mGetDoc(mDoc(stu(), 'student_vaccinations/v1')));
      await assertSucceeds(mGetDoc(mDoc(par(), 'student_vaccinations/v1')));
      await assertSucceeds(mGetDoc(mDoc(hr(), 'student_vaccinations/v1')));
      await assertFails(mGetDoc(mDoc(otherPar(), 'student_vaccinations/v1')));
    });

    it('blood_donations: พยาบาลบันทึกนักเรียน/บุคลากรได้; ต้องมีนักเรียน/บุคลากรจริง; ฟิลด์ไม่ตรงชนิดไม่ได้', async () => {
      await seed();
      await assertSucceeds(mSetDoc(mDoc(nurse(), 'blood_donations/d1'), donation('hr-nurse')));
      await assertSucceeds(mSetDoc(mDoc(nurse(), 'blood_donations/d2'), { subjectType: 'STAFF', staffId: 'hr-t1', donorName: 'ครูทดสอบ', donatedAt: '2026-09-10', recordedByUid: 'hr-nurse', recordedByName: 'พยาบาล', recordedAt: mServerTimestamp() }));
      await assertFails(mSetDoc(mDoc(nurse(), 'blood_donations/d3'), donation('hr-nurse', { studentId: 'no-such-student' })));
      await assertFails(mSetDoc(mDoc(nurse(), 'blood_donations/d4'), { subjectType: 'STAFF', staffId: 'no-such-staff', donorName: 'x', donatedAt: '2026-09-10', recordedByUid: 'hr-nurse', recordedByName: 'พยาบาล', recordedAt: mServerTimestamp() }));
      await assertFails(mSetDoc(mDoc(nurse(), 'blood_donations/d5'), donation('hr-nurse', { staffId: 'hr-t1' })));
      await assertFails(mSetDoc(mDoc(nurse(), 'blood_donations/d6'), donation('hr-nurse', { donatedAt: '' })));
      await assertFails(mSetDoc(mDoc(stu(), 'blood_donations/d7'), donation(STU)));
      await assertFails(mSetDoc(mDoc(par(), 'blood_donations/d8'), donation(PAR)));
      await assertFails(mSetDoc(mDoc(staffUser(), 'blood_donations/d9'), { subjectType: 'STAFF', staffId: 'hr-t1', donorName: 'ครูทดสอบ', donatedAt: '2026-09-10', recordedByUid: 'hr-staff-uid', recordedByName: 'ครู', recordedAt: mServerTimestamp() }));
      await assertFails((nurse() as any).doc('blood_donations/d1').delete());
      await assertSucceeds((admin() as any).doc('blood_donations/d1').delete());
    });
    it('blood_donations: อ่าน — นักเรียน/ผู้ปกครองเห็นของบุตรหลาน, บุคลากรเห็นของตัวเอง, คนอื่นไม่เห็น', async () => {
      await seed();
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('blood_donations/d1').set({ ...donation('hr-nurse'), recordedAt: new Date() });
        await ctx.firestore().doc('blood_donations/d2').set({ subjectType: 'STAFF', staffId: 'hr-t1', donorName: 'ครูทดสอบ', donatedAt: '2026-09-10', recordedByUid: 'hr-nurse', recordedByName: 'พยาบาล', recordedAt: new Date() });
      });
      const qs = (db: any) => getDocs(query(collection(db, 'blood_donations'), where('subjectType', '==', 'STUDENT'), where('studentId', '==', SID)));
      const qt = (db: any) => getDocs(query(collection(db, 'blood_donations'), where('subjectType', '==', 'STAFF'), where('staffId', '==', 'hr-t1')));
      await assertSucceeds(qs(stu())); await assertSucceeds(qs(par())); await assertSucceeds(qs(nurse()));
      await assertFails(qs(otherPar())); await assertFails(qs(hr()));
      await assertSucceeds(qt(staffUser())); await assertSucceeds(qt(nurse()));
      await assertFails(qt(otherStaff())); await assertFails(qt(stu()));
    });
  });


  describe('supervision_* (ระบบนิเทศการสอน)', () => {
    const RID = '2569_1';
    const SC = (n: number) => Object.fromEntries(['s1_1', 's1_2', 's1_3', 's1_4', 's2_1', 's2_2', 's2_3', 's2_4', 's3_1', 's3_2', 's3_3', 's3_4', 's3_5', 's3_6', 's3_7', 's4_1', 's4_2', 's4_3', 's5_1', 's5_2'].map(k => [k, n]));
    const staffCtx = (sid: string, roles: string[]) => asUser(`uid-${sid}`, roles, { staffId: sid }).firestore();
    const seedSup = async (roundStatus: 'OPEN' | 'CLOSED' = 'OPEN') => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await db.doc('staff/t1').set({ firstName: 'ครู', lastName: 'หนึ่ง', roles: ['SUBJECT_TEACHER'], assignments: { departmentId: 'D1' } });
        await db.doc('staff/t3').set({ firstName: 'ครู', lastName: 'สาม', roles: ['SUBJECT_TEACHER'], assignments: { departmentId: 'D1' } });
        await db.doc('staff/t2').set({ firstName: 'ครู', lastName: 'สอง', roles: ['SUBJECT_TEACHER'], assignments: { departmentId: 'D2' } });
        await db.doc('staff/sup1').set({ firstName: 'นิเทศ', lastName: 'หนึ่ง', roles: ['SUPERVISORY_TEACHER'], assignments: { departmentId: 'D3' } });
        await db.doc('staff/hod1').set({ firstName: 'หัวหน้า', lastName: 'D1', roles: ['HEAD_OF_DEPARTMENT'], assignments: { departmentId: 'D1' } });
        await db.doc('staff/hod2').set({ firstName: 'หัวหน้า', lastName: 'D2', roles: ['HEAD_OF_DEPARTMENT'], assignments: { departmentId: 'D2' } });
        await db.doc(`supervision_rounds/${RID}`).set({ academicYear: '2569', term: '1', status: roundStatus });
        await db.doc(`supervision_assignments/${RID}_t1_sup1`).set({ roundId: RID, teacherStaffId: 't1', supervisorStaffId: 'sup1' });
        await db.doc(`supervision_assignments/${RID}_t3_sup1`).set({ roundId: RID, teacherStaffId: 't3', supervisorStaffId: 'sup1' });
      });
    };
    const obsDoc = (teacher: string, dept: string, supervisor: string, submit: boolean, n = 5, over: Record<string, unknown> = {}) => ({
      roundId: RID, academicYear: '2569', term: '1', templateVersion: 1,
      teacherStaffId: teacher, teacherName: 'ครู', departmentId: dept, supervisorStaffId: supervisor, supervisorName: 'ผู้นิเทศ',
      courseCode: 'ท21101', courseName: 'ภาษาไทย', level: 'ม.1/1', observedDate: '2026-09-01', observedTime: '09:00',
      scores: submit ? SC(n) : { s1_1: 4 }, total: submit ? n * 20 : 4, percent: submit ? n * 20 : null,
      band: submit ? (n * 20 >= 91 ? 'ดีมาก' : n * 20 >= 81 ? 'ดี' : n * 20 >= 71 ? 'พอใช้' : n * 20 >= 61 ? 'ควรปรับปรุง' : 'ไม่ผ่าน') : null,
      assessmentMethod: '', strengths: '', improvements: '', comment: '', photos: [],
      submitted: submit, acknowledged: false, teacherReply: '',
      createdAt: mServerTimestamp(), updatedAt: mServerTimestamp(),
      ...(submit ? { submittedAt: mServerTimestamp() } : {}),
      ...over,
    });
    const seedObs = async (id: string, teacher: string, dept: string, supervisor: string, submit: boolean) => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc(`supervision_observations/${id}`).set({ ...obsDoc(teacher, dept, supervisor, submit), createdAt: new Date(), updatedAt: new Date(), ...(submit ? { submittedAt: new Date() } : {}) });
      });
    };

    it('รอบ/จับคู่: หัวหน้างานนิเทศและ SUPER_ADMIN จัดการได้; ครูทั่วไปทำไม่ได้', async () => {
      await seedSup();
      const ok = { academicYear: '2569', term: '2', status: 'OPEN', openedByStaffId: 'x', createdAt: mServerTimestamp() };
      await assertSucceeds(mSetDoc(mDoc(staffCtx('sup-head', ['INSTRUCTIONAL_SUPERVISOR']), 'supervision_rounds/2569_2'), ok));
      await assertFails(mSetDoc(mDoc(staffCtx('t1', ['SUBJECT_TEACHER']), 'supervision_rounds/2570_1'), { ...ok, academicYear: '2570', term: '1' }));
      await assertFails(mSetDoc(mDoc(staffCtx('sup-head', ['INSTRUCTIONAL_SUPERVISOR']), 'supervision_rounds/2569_x'), ok)); // id ผิดรูปแบบ
      const asg = { roundId: RID, teacherStaffId: 't2', supervisorStaffId: 'sup1', createdAt: mServerTimestamp() };
      await assertSucceeds(mSetDoc(mDoc(staffCtx('sup-head', ['INSTRUCTIONAL_SUPERVISOR']), `supervision_assignments/${RID}_t2_sup1`), asg));
      await assertFails(mSetDoc(mDoc(staffCtx('t1', ['SUBJECT_TEACHER']), `supervision_assignments/${RID}_t2_sup1`), asg));
      await assertFails(mSetDoc(mDoc(staffCtx('sup-head', ['INSTRUCTIONAL_SUPERVISOR']), `supervision_assignments/${RID}_t2_t2`), { ...asg, supervisorStaffId: 't2' })); // นิเทศตัวเอง
      await assertSucceeds(mUpdateDoc(mDoc(staffCtx('sup-head', ['INSTRUCTIONAL_SUPERVISOR']), `supervision_rounds/${RID}`), { status: 'CLOSED' }));
      await assertFails(mUpdateDoc(mDoc(staffCtx('t1', ['SUBJECT_TEACHER']), `supervision_rounds/${RID}`), { status: 'CLOSED' }));
    });

    it('สร้างผล: ครูนิเทศต้องถูกจับคู่; หัวหน้ากลุ่มสาระฯ ทำได้เฉพาะครูในกลุ่มสาระฯ ตนเอง; ห้ามนิเทศตัวเอง', async () => {
      await seedSup();
      const sup = staffCtx('sup1', ['SUPERVISORY_TEACHER']);
      await assertSucceeds(mSetDoc(mDoc(sup, `supervision_observations/${RID}_t3`), obsDoc('t3', 'D1', 'sup1', false)));
      await assertFails(mSetDoc(mDoc(sup, `supervision_observations/${RID}_t2`), obsDoc('t2', 'D2', 'sup1', false))); // ไม่ได้จับคู่
      const hod = staffCtx('hod1', ['HEAD_OF_DEPARTMENT']);
      await assertSucceeds(mSetDoc(mDoc(hod, `supervision_observations/${RID}_t1`), obsDoc('t1', 'D1', 'hod1', false))); // กลุ่มสาระฯ เดียวกัน ไม่ต้องจับคู่
      await assertFails(mSetDoc(mDoc(hod, `supervision_observations/${RID}_t2`), obsDoc('t2', 'D2', 'hod1', false))); // กลุ่มสาระฯ อื่น
      await assertFails(mSetDoc(mDoc(hod, `supervision_observations/${RID}_hod1`), obsDoc('hod1', 'D1', 'hod1', false))); // นิเทศตัวเอง
      await assertFails(mSetDoc(mDoc(staffCtx('t1', ['SUBJECT_TEACHER']), `supervision_observations/${RID}_t2`), obsDoc('t2', 'D2', 't1', false))); // ครูทั่วไป
    });

    it('สร้างผล: รอบปิด / departmentId ไม่ตรง staff / ผู้นิเทศไม่ใช่ตัวเอง / รหัสเอกสารผิด ถูกปฏิเสธ', async () => {
      await seedSup('CLOSED');
      const sup = staffCtx('sup1', ['SUPERVISORY_TEACHER']);
      await assertFails(mSetDoc(mDoc(sup, `supervision_observations/${RID}_t1`), obsDoc('t1', 'D1', 'sup1', false)));
      await testEnv.withSecurityRulesDisabled(async (ctx) => { await ctx.firestore().doc(`supervision_rounds/${RID}`).update({ status: 'OPEN' }); });
      await assertFails(mSetDoc(mDoc(sup, `supervision_observations/${RID}_t1`), obsDoc('t1', 'D2', 'sup1', false))); // dept ปลอม
      await assertFails(mSetDoc(mDoc(sup, `supervision_observations/${RID}_t1`), obsDoc('t1', 'D1', 'hod1', false))); // สวมรอยผู้นิเทศ
      await assertFails(mSetDoc(mDoc(sup, `supervision_observations/${RID}_wrong`), obsDoc('t1', 'D1', 'sup1', false)));
      await assertSucceeds(mSetDoc(mDoc(sup, `supervision_observations/${RID}_t1`), obsDoc('t1', 'D1', 'sup1', false)));
    });

    it('ส่งผล: คะแนนรวม/เปอร์เซ็นต์/ผลสรุปต้องตรงกับคะแนนรายข้อ และตอบครบ 20 ข้อ', async () => {
      await seedSup();
      const sup = staffCtx('sup1', ['SUPERVISORY_TEACHER']);
      const ref = (c: any) => mDoc(c, `supervision_observations/${RID}_t1`);
      await assertFails(mSetDoc(ref(sup), obsDoc('t1', 'D1', 'sup1', true, 5, { total: 99 })));
      await assertFails(mSetDoc(ref(sup), obsDoc('t1', 'D1', 'sup1', true, 5, { band: 'ดี' })));
      await assertFails(mSetDoc(ref(sup), obsDoc('t1', 'D1', 'sup1', true, 5, { scores: { ...SC(5), s1_1: 6 } })));
      await assertFails(mSetDoc(ref(sup), obsDoc('t1', 'D1', 'sup1', true, 5, { scores: { s1_1: 5 }, total: 5, percent: 5, band: 'ไม่ผ่าน' }))); // ไม่ครบ
      await assertSucceeds(mSetDoc(ref(sup), obsDoc('t1', 'D1', 'sup1', true, 4))); // 80 = พอใช้ (71–80) ตรงกับตรรกะ client
    });

    it('ส่งแล้วล็อก: ผู้นิเทศแก้ไม่ได้; ครูกดรับทราบได้ครั้งเดียวและแก้ฟิลด์อื่นไม่ได้; ฉบับร่างลบได้เฉพาะผู้นิเทศ', async () => {
      await seedSup();
      await seedObs(`${RID}_t1`, 't1', 'D1', 'sup1', true);
      const sup = staffCtx('sup1', ['SUPERVISORY_TEACHER']);
      const t1 = staffCtx('t1', ['SUBJECT_TEACHER']);
      await assertFails(mUpdateDoc(mDoc(sup, `supervision_observations/${RID}_t1`), { comment: 'แก้', updatedAt: mServerTimestamp() }));
      await assertFails(mUpdateDoc(mDoc(t1, `supervision_observations/${RID}_t1`), { total: 50, acknowledged: true, acknowledgedAt: mServerTimestamp(), updatedAt: mServerTimestamp() }));
      await assertSucceeds(mUpdateDoc(mDoc(t1, `supervision_observations/${RID}_t1`), { acknowledged: true, acknowledgedAt: mServerTimestamp(), teacherReply: 'รับทราบ', updatedAt: mServerTimestamp() }));
      await assertFails(mUpdateDoc(mDoc(t1, `supervision_observations/${RID}_t1`), { acknowledged: true, acknowledgedAt: mServerTimestamp(), teacherReply: 'ซ้ำ', updatedAt: mServerTimestamp() }));
      await assertFails(mUpdateDoc(mDoc(staffCtx('t2', ['SUBJECT_TEACHER']), `supervision_observations/${RID}_t1`), { acknowledged: true, acknowledgedAt: mServerTimestamp(), updatedAt: mServerTimestamp() }));
      await assertFails((sup as any).doc(`supervision_observations/${RID}_t1`).delete()); // ส่งแล้วลบไม่ได้
      await seedObs(`${RID}_t2`, 't2', 'D2', 'sup1', false);
      await assertFails((staffCtx('hod2', ['HEAD_OF_DEPARTMENT']) as any).doc(`supervision_observations/${RID}_t2`).delete());
      await assertSucceeds((sup as any).doc(`supervision_observations/${RID}_t2`).delete());
    });

    it('อ่าน: ครูเห็นเฉพาะที่ส่งแล้วของตน; ฉบับร่างเห็นเฉพาะผู้นิเทศ+หัวหน้างานนิเทศ; ผอ./รองผอ./EXECUTIVE เห็นที่ส่งแล้วทั้งหมด; หัวหน้ากลุ่มสาระฯ เห็นเฉพาะกลุ่มตนเอง; SUPER_ADMIN เห็นรายบุคคลไม่ได้', async () => {
      await seedSup();
      await seedObs(`${RID}_t1`, 't1', 'D1', 'sup1', true);
      await seedObs(`${RID}_t2`, 't2', 'D2', 'sup1', false);
      const col = (c: any) => collection(c, 'supervision_observations');
      const self = (c: any, sid: string) => getDocs(query(col(c), where('roundId', '==', RID), where('teacherStaffId', '==', sid), where('submitted', '==', true)));
      await assertSucceeds(self(staffCtx('t1', ['SUBJECT_TEACHER']), 't1'));
      await assertFails(self(staffCtx('t1', ['SUBJECT_TEACHER']), 't2'));
      await assertFails((staffCtx('t2', ['SUBJECT_TEACHER']) as any).doc(`supervision_observations/${RID}_t2`).get()); // ร่างของตน — ครูยังไม่เห็น
      await assertSucceeds((staffCtx('sup1', ['SUPERVISORY_TEACHER']) as any).doc(`supervision_observations/${RID}_t2`).get());
      await assertSucceeds(getDocs(query(col(staffCtx('sup-head', ['INSTRUCTIONAL_SUPERVISOR'])), where('roundId', '==', RID))));
      const submittedAll = (c: any) => getDocs(query(col(c), where('roundId', '==', RID), where('submitted', '==', true)));
      for (const r of ['DIRECTOR', 'DEPUTY_DIRECTOR_ACADEMIC', 'EXECUTIVE']) await assertSucceeds(submittedAll(staffCtx(`x-${r}`, [r])));
      await assertFails(getDocs(query(col(staffCtx('x-dir', ['DIRECTOR'])), where('roundId', '==', RID)))); // รวมร่าง = ไม่ได้
      await assertFails(submittedAll(staffCtx('adm', ['SUPER_ADMIN'])));
      const dept = (c: any, d: string) => getDocs(query(col(c), where('roundId', '==', RID), where('departmentId', '==', d), where('submitted', '==', true)));
      await assertSucceeds(dept(staffCtx('hod1', ['HEAD_OF_DEPARTMENT']), 'D1'));
      await assertFails(dept(staffCtx('hod1', ['HEAD_OF_DEPARTMENT']), 'D2'));
      await assertFails(submittedAll(staffCtx('hod1', ['HEAD_OF_DEPARTMENT'])));
      await assertFails(submittedAll(staffCtx('sup1', ['SUPERVISORY_TEACHER']))); // ครูนิเทศเห็นเฉพาะที่ตนเองนิเทศ
      await assertSucceeds(getDocs(query(col(staffCtx('sup1', ['SUPERVISORY_TEACHER'])), where('roundId', '==', RID), where('supervisorStaffId', '==', 'sup1'))));
    });
  });

  describe('lesson_plan_submissions (นิเทศเฟส 2: แผน/โครงการสอน 2 ขั้น)', () => {
    const SEM = '2569_1';
    const ctxOf = (sid: string, roles: string[]) => asUser(`uid-${sid}`, roles, { staffId: sid }).firestore();
    const CK = Object.fromEntries(Array.from({ length: 15 }, (_, i) => [`q${i + 1}`, 4]));
    const planId = (t: string) => `${SEM}_${t}_ท21101`;
    const base = (t: string, dept: string, over: any = {}) => ({
      semesterId: SEM, academicYear: '2569', term: '1', teacherStaffId: t, teacherName: 'ครู', departmentId: dept,
      courseKey: 'ท21101', courseCode: 'ท21101', courseName: 'ภาษาไทย', level: 'ม.1', kind: 'PLAN',
      url: 'https://docs.google.com/document/d/abc/edit', note: '', stage: 'SUBMITTED',
      createdAt: mServerTimestamp(), updatedAt: mServerTimestamp(), ...over,
    });
    const review = (sid: string, decision: string, comment = '') => ({ byStaffId: sid, byName: 'ผู้ตรวจ', decision, comment, scores: CK, at: mServerTimestamp() });
    const seed = async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await db.doc('staff/t1').set({ roles: ['SUBJECT_TEACHER'], assignments: { departmentId: 'D1' } });
        await db.doc('staff/t2').set({ roles: ['SUBJECT_TEACHER'], assignments: { departmentId: 'D2' } });
        await db.doc('staff/hod1').set({ roles: ['HEAD_OF_DEPARTMENT'], assignments: { departmentId: 'D1' } });
        await db.doc('staff/hod2').set({ roles: ['HEAD_OF_DEPARTMENT'], assignments: { departmentId: 'D2' } });
        await db.doc('staff/sv').set({ roles: ['INSTRUCTIONAL_SUPERVISOR'], assignments: { departmentId: 'D3' } });
      });
    };
    const put = async (id: string, data: any) => testEnv.withSecurityRulesDisabled(async (ctx) => { await ctx.firestore().doc(`lesson_plan_submissions/${id}`).set({ ...data, createdAt: new Date(), updatedAt: new Date() }); });
    const col = (c: any) => collection(c, 'lesson_plan_submissions');

    it('หลายลิงก์: urls ≤ 5, https ทุกตัว, urls[0] ต้องเท่ากับ url; เอกสารเก่าที่มีแต่ url ยังแก้เป็น urls ได้', async () => {
      await seed();
      const t1 = ctxOf('t1', ['SUBJECT_TEACHER']);
      const two = ['https://docs.google.com/document/d/abc/edit', 'https://drive.google.com/file/d/xyz/view'];
      await assertSucceeds(mSetDoc(mDoc(t1, `lesson_plan_submissions/${planId('t1')}`), base('t1', 'D1', { urls: two })));
      await assertFails(mSetDoc(mDoc(t1, `lesson_plan_submissions/${SEM}_t1_ค11111`), base('t1', 'D1', { courseKey: 'ค11111', urls: [...two, ...two, 'https://a.co/1', 'https://a.co/2'] }))); // > 5
      await assertFails(mSetDoc(mDoc(t1, `lesson_plan_submissions/${SEM}_t1_ค22222`), base('t1', 'D1', { courseKey: 'ค22222', urls: ['http://a.co/1'] })));
      await assertFails(mSetDoc(mDoc(t1, `lesson_plan_submissions/${SEM}_t1_ค33333`), base('t1', 'D1', { courseKey: 'ค33333', urls: [two[1], two[0]] }))); // urls[0] != url
      await assertSucceeds(mUpdateDoc(mDoc(t1, `lesson_plan_submissions/${planId('t1')}`), { urls: [two[0]], updatedAt: mServerTimestamp() }));
      await put(`${SEM}_t1_ว11111`, base('t1', 'D1', { courseKey: 'ว11111' })); // เอกสารเก่า: ไม่มี urls
      await assertSucceeds(mUpdateDoc(mDoc(t1, `lesson_plan_submissions/${SEM}_t1_ว11111`), { urls: two, stage: 'SUBMITTED', updatedAt: mServerTimestamp() }));
    });

    it('ครูสร้างของตนเองได้ (id/แผนก/ลิงก์ https ถูกต้อง) แต่ของคนอื่น/ลิงก์ไม่ใช่ https/แผนกผิด/ข้ามขั้นไม่ได้', async () => {
      await seed();
      const t1 = ctxOf('t1', ['SUBJECT_TEACHER']);
      await assertSucceeds(mSetDoc(mDoc(t1, `lesson_plan_submissions/${planId('t1')}`), base('t1', 'D1')));
      await assertFails(mSetDoc(mDoc(t1, `lesson_plan_submissions/${planId('t2')}`), base('t2', 'D2')));
      await assertFails(mSetDoc(mDoc(t1, `lesson_plan_submissions/${SEM}_t1_x`), base('t1', 'D1', { courseKey: 'ท21101' }))); // id ไม่ตรง courseKey
      await assertFails(mSetDoc(mDoc(t1, `lesson_plan_submissions/${SEM}_t1_ว1`), base('t1', 'D1', { courseKey: 'ว1', url: 'http://x.com/a' })));
      await assertFails(mSetDoc(mDoc(t1, `lesson_plan_submissions/${SEM}_t1_ว2`), base('t1', 'D2', { courseKey: 'ว2' }))); // แผนกไม่ตรงทะเบียน
      await assertFails(mSetDoc(mDoc(t1, `lesson_plan_submissions/${SEM}_t1_ว3`), base('t1', 'D1', { courseKey: 'ว3', stage: 'APPROVED' })));
    });

    it('ขั้น 1: หัวหน้า/รองกลุ่มสาระฯ ของแผนกเท่านั้น ผ่านได้ → DEPT_APPROVED; ต่างแผนก/ตัวเอง/ขาด scores ไม่ได้; ขอแก้ไขต้องมีความเห็น', async () => {
      await seed();
      await put(planId('t1'), base('t1', 'D1'));
      const ref = (c: any) => mDoc(c, `lesson_plan_submissions/${planId('t1')}`);
      const ok = { stage: 'DEPT_APPROVED', deptReview: review('hod1', 'APPROVE'), updatedAt: mServerTimestamp() };
      await assertFails(mUpdateDoc(ref(ctxOf('hod2', ['HEAD_OF_DEPARTMENT'])), { ...ok, deptReview: review('hod2', 'APPROVE') }));
      await assertFails(mUpdateDoc(ref(ctxOf('t1', ['SUBJECT_TEACHER'])), ok));
      await assertFails(mUpdateDoc(ref(ctxOf('hod1', ['HEAD_OF_DEPARTMENT'])), { ...ok, deptReview: { ...review('hod1', 'APPROVE'), scores: { q1: 5 } } })); // ตอบไม่ครบ 15 ข้อ
      await assertFails(mUpdateDoc(ref(ctxOf('hod1', ['HEAD_OF_DEPARTMENT'])), { stage: 'REVISION', deptReview: review('hod1', 'REVISE', ''), updatedAt: mServerTimestamp() }));
      await assertFails(mUpdateDoc(ref(ctxOf('hod1', ['HEAD_OF_DEPARTMENT'])), { stage: 'APPROVED', deptReview: review('hod1', 'APPROVE'), updatedAt: mServerTimestamp() })); // ข้ามขั้น
      await assertFails(mUpdateDoc(ref(ctxOf('hod1', ['HEAD_OF_DEPARTMENT'])), { ...ok, deptReview: { ...review('hod1', 'APPROVE'), scores: { ...CK, q3: 6 } } })); // คะแนนนอกช่วง 1–5
      await assertSucceeds(mUpdateDoc(ref(ctxOf('hod1', ['HEAD_OF_DEPARTMENT'])), ok));
    });

    it('ขั้น 2: เฉพาะหัวหน้างานนิเทศ เมื่อผ่านขั้น 1 แล้ว; ขั้น 1 ยังไม่ผ่านห้ามข้าม', async () => {
      await seed();
      await put(planId('t1'), base('t1', 'D1', { stage: 'DEPT_APPROVED', deptReview: review('hod1', 'APPROVE') }));
      const ref = (c: any) => mDoc(c, `lesson_plan_submissions/${planId('t1')}`);
      const fin = { stage: 'APPROVED', finalReview: review('sv', 'APPROVE'), updatedAt: mServerTimestamp() };
      await assertFails(mUpdateDoc(ref(ctxOf('hod1', ['HEAD_OF_DEPARTMENT'])), { ...fin, finalReview: review('hod1', 'APPROVE') }));
      await assertSucceeds(mUpdateDoc(ref(ctxOf('sv', ['INSTRUCTIONAL_SUPERVISOR'])), fin));
      await put(planId('t2'), base('t2', 'D2'));
      await assertFails(mUpdateDoc(mDoc(ctxOf('sv', ['INSTRUCTIONAL_SUPERVISOR']), `lesson_plan_submissions/${planId('t2')}`), fin)); // ยังเป็น SUBMITTED
    });

    it('ครูแก้ลิงก์/ส่งใหม่ได้เมื่อ SUBMITTED/REVISION เท่านั้น และแก้ผลตรวจเองไม่ได้; ลบได้เฉพาะก่อนผ่านขั้น 1', async () => {
      await seed();
      await put(planId('t1'), base('t1', 'D1', { stage: 'REVISION', deptReview: review('hod1', 'REVISE', 'แก้') }));
      const ref = (c: any) => mDoc(c, `lesson_plan_submissions/${planId('t1')}`);
      const t1 = ctxOf('t1', ['SUBJECT_TEACHER']);
      await assertFails(mUpdateDoc(ref(t1), { stage: 'APPROVED', updatedAt: mServerTimestamp() }));
      await assertFails(mUpdateDoc(ref(t1), { deptReview: review('t1', 'APPROVE'), stage: 'SUBMITTED', updatedAt: mServerTimestamp() }));
      await assertSucceeds(mUpdateDoc(ref(t1), { url: 'https://drive.google.com/file/d/xyz/view', stage: 'SUBMITTED', updatedAt: mServerTimestamp() }));
      await put(planId('t2'), base('t2', 'D2', { stage: 'DEPT_APPROVED', deptReview: review('hod2', 'APPROVE') }));
      await assertFails(mDeleteDoc(mDoc(ctxOf('t2', ['SUBJECT_TEACHER']), `lesson_plan_submissions/${planId('t2')}`)));
      await assertSucceeds(mDeleteDoc(ref(t1)));
    });

    it('การอ่าน: ครูเห็นของตนเอง; หัวหน้ากลุ่มฯ เห็นเฉพาะแผนก; หัวหน้างานนิเทศ/ผอ./รอง ผอ.วิชาการเห็นทั้งหมด; ผู้บริหารอื่น/แอดมินไม่เห็นรายบุคคล', async () => {
      await seed();
      await put(planId('t1'), base('t1', 'D1'));
      await put(planId('t2'), base('t2', 'D2'));
      const own = (c: any, t: string) => getDocs(query(col(c), where('semesterId', '==', SEM), where('teacherStaffId', '==', t)));
      const dep = (c: any, d: string) => getDocs(query(col(c), where('semesterId', '==', SEM), where('departmentId', '==', d)));
      const all = (c: any) => getDocs(query(col(c), where('semesterId', '==', SEM)));
      await assertSucceeds(own(ctxOf('t1', ['SUBJECT_TEACHER']), 't1'));
      await assertFails(own(ctxOf('t1', ['SUBJECT_TEACHER']), 't2'));
      await assertSucceeds(dep(ctxOf('hod1', ['HEAD_OF_DEPARTMENT']), 'D1'));
      await assertFails(dep(ctxOf('hod1', ['HEAD_OF_DEPARTMENT']), 'D2'));
      await assertFails(all(ctxOf('hod1', ['HEAD_OF_DEPARTMENT'])));
      await assertSucceeds(all(ctxOf('sv', ['INSTRUCTIONAL_SUPERVISOR'])));
      await assertSucceeds(all(ctxOf('d1', ['DIRECTOR'])));
      await assertSucceeds(all(ctxOf('d2', ['DEPUTY_DIRECTOR_ACADEMIC'])));
      await assertFails(all(ctxOf('ex', ['EXECUTIVE'])));
      await assertFails(all(ctxOf('adm', ['SUPER_ADMIN'])));
    });
  });

  describe('teaching_projects (โครงการสอนรายสัปดาห์)', () => {
    const SEM = '2569_1';
    const ctxOf = (sid: string, roles: string[]) => asUser(`uid-${sid}`, roles, { staffId: sid }).firestore();
    const pid = (t: string, k = 'ว30103') => `${SEM}_${t}_${k}`;
    const doc0 = (t: string, dept: string, over: any = {}) => ({
      semesterId: SEM, academicYear: '2569', term: '1', teacherStaffId: t, teacherName: 'ครู', departmentId: dept,
      courseKey: 'ว30103', courseCode: 'ว30103', courseName: 'ชีววิทยา', kind: 'NORMAL', levelLabel: 'ม.4', credits: '1.5',
      hoursPerWeek: '3', courseType: 'พื้นฐาน', description: 'x', indicators: ['a'], units: [{ id: 'u1', type: 'LESSON', weeks: '1-2', title: 'บท 1', detail: '', hours: 3, activities: '', media: '' }],
      assessment: [{ label: 'ระหว่างภาค', percent: 70 }], assessmentNote: '',
      createdAt: mServerTimestamp(), updatedAt: mServerTimestamp(), ...over,
    });
    const seed = async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await db.doc('staff/t1').set({ roles: ['SUBJECT_TEACHER'], assignments: { departmentId: 'D1' } });
        await db.doc('staff/t2').set({ roles: ['SUBJECT_TEACHER'], assignments: { departmentId: 'D2' } });
        await db.doc('staff/hod1').set({ roles: ['HEAD_OF_DEPARTMENT'], assignments: { departmentId: 'D1' } });
        await db.doc('staff/sv').set({ roles: ['INSTRUCTIONAL_SUPERVISOR'], assignments: { departmentId: 'D3' } });
      });
    };
    const put = async (id: string, data: any) => testEnv.withSecurityRulesDisabled(async (ctx) => { await ctx.firestore().doc(`teaching_projects/${id}`).set({ ...data, createdAt: new Date(), updatedAt: new Date() }); });

    it('ครูสร้าง/แก้/ลบของตนเองได้; ของคนอื่น แผนกผิด id ผิด หรือรายการเกินจำนวนไม่ได้', async () => {
      await seed();
      const t1 = ctxOf('t1', ['SUBJECT_TEACHER']);
      await assertSucceeds(mSetDoc(mDoc(t1, `teaching_projects/${pid('t1')}`), doc0('t1', 'D1')));
      await assertFails(mSetDoc(mDoc(t1, `teaching_projects/${pid('t2')}`), doc0('t2', 'D2')));
      await assertFails(mSetDoc(mDoc(t1, `teaching_projects/${pid('t1', 'ค1')}`), doc0('t1', 'D2', { courseKey: 'ค1' }))); // แผนกไม่ตรงทะเบียน
      await assertFails(mSetDoc(mDoc(t1, `teaching_projects/${SEM}_t1_x`), doc0('t1', 'D1', { courseKey: 'ว9' }))); // id ไม่ตรง courseKey
      await assertFails(mSetDoc(mDoc(t1, `teaching_projects/${pid('t1', 'ว8')}`), doc0('t1', 'D1', { courseKey: 'ว8', units: Array.from({ length: 61 }, (_, i) => ({ id: `u${i}` })) })));
      await assertFails(mSetDoc(mDoc(t1, `teaching_projects/${pid('t1', 'ว7')}`), doc0('t1', 'D1', { courseKey: 'ว7', kind: 'EXEMPT' })));
      await assertSucceeds(mUpdateDoc(mDoc(t1, `teaching_projects/${pid('t1')}`), { description: 'แก้ไข', updatedAt: mServerTimestamp() }));
      await assertFails(mUpdateDoc(mDoc(t1, `teaching_projects/${pid('t1')}`), { teacherStaffId: 't2', updatedAt: mServerTimestamp() }));
      await assertFails(mUpdateDoc(mDoc(t1, `teaching_projects/${pid('t1')}`), { description: 'x'.repeat(2001), updatedAt: mServerTimestamp() }));
      await assertSucceeds(mDeleteDoc(mDoc(t1, `teaching_projects/${pid('t1')}`)));
    });

    it('ครูร่วมสอน: เจ้าของตั้งได้; ครูร่วมอ่าน/แก้เนื้อหาฉบับเดียวกันได้ แต่แก้รายชื่อครูร่วม/ชื่อเจ้าของ/ลบไม่ได้; คนนอกอ่านไม่ได้', async () => {
      await seed();
      await put(pid('t1'), doc0('t1', 'D1'));
      const t1 = ctxOf('t1', ['SUBJECT_TEACHER']);
      const t2 = ctxOf('t2', ['SUBJECT_TEACHER']);
      const ref = (c: any) => mDoc(c, `teaching_projects/${pid('t1')}`);
      // ยังไม่ได้เป็นครูร่วม → อ่าน/แก้ไม่ได้
      await assertFails(mGetDoc(ref(t2)));
      await assertFails(mUpdateDoc(ref(t2), { description: 'x', updatedAt: mServerTimestamp() }));
      // ตัวเองเป็นครูร่วมของตัวเองไม่ได้ / ชื่อไม่เรียงคู่ / เกิน 10 คน
      await assertFails(mUpdateDoc(ref(t1), { coTeacherStaffIds: ['t1'], coTeacherNames: ['ก'], updatedAt: mServerTimestamp() }));
      await assertFails(mUpdateDoc(ref(t1), { coTeacherStaffIds: ['t2'], coTeacherNames: [], updatedAt: mServerTimestamp() }));
      await assertFails(mUpdateDoc(ref(t1), { coTeacherStaffIds: Array.from({ length: 11 }, (_, i) => `s${i}`), coTeacherNames: Array.from({ length: 11 }, () => 'ก'), updatedAt: mServerTimestamp() }));
      await assertSucceeds(mUpdateDoc(ref(t1), { coTeacherStaffIds: ['t2'], coTeacherNames: ['ครูสอง'], updatedAt: mServerTimestamp() }));
      // ครูร่วมอ่าน + แก้เนื้อหาได้ (query array-contains ผ่าน)
      await assertSucceeds(mGetDoc(ref(t2)));
      await assertSucceeds(getDocs(query(collection(t2, 'teaching_projects'), where('semesterId', '==', SEM), where('coTeacherStaffIds', 'array-contains', 't2'))));
      await assertSucceeds(mUpdateDoc(ref(t2), { description: 'ครูร่วมแก้', updatedAt: mServerTimestamp() }));
      // แต่แก้รายชื่อครูร่วม/ชื่อเจ้าของ/ย้ายเจ้าของ/ลบไม่ได้
      await assertFails(mUpdateDoc(ref(t2), { coTeacherStaffIds: [], coTeacherNames: [], updatedAt: mServerTimestamp() }));
      await assertFails(mUpdateDoc(ref(t2), { coTeacherStaffIds: ['t2', 'hod1'], coTeacherNames: ['ก', 'ข'], updatedAt: mServerTimestamp() }));
      await assertFails(mUpdateDoc(ref(t2), { teacherName: 'เปลี่ยนชื่อ', updatedAt: mServerTimestamp() }));
      await assertFails(mUpdateDoc(ref(t2), { teacherStaffId: 't2', updatedAt: mServerTimestamp() }));
      await assertFails(mDeleteDoc(ref(t2)));
      // ครูคนอื่น (ไม่ใช่ครูร่วม) ยังอ่านไม่ได้
      await assertFails(mGetDoc(ref(ctxOf('hr3', ['SUBJECT_TEACHER']))));
    });

    it('ครูอื่น/ผู้บริหารอื่น/แอดมินแก้โครงการของครูไม่ได้ (หัวหน้างานนิเทศก็อ่านอย่างเดียว)', async () => {
      await seed();
      await put(pid('t1'), doc0('t1', 'D1'));
      for (const c of [ctxOf('t2', ['SUBJECT_TEACHER']), ctxOf('hod1', ['HEAD_OF_DEPARTMENT']), ctxOf('sv', ['INSTRUCTIONAL_SUPERVISOR']), ctxOf('adm', ['SUPER_ADMIN'])]) {
        await assertFails(mUpdateDoc(mDoc(c, `teaching_projects/${pid('t1')}`), { description: 'hack', updatedAt: mServerTimestamp() }));
        await assertFails(mDeleteDoc(mDoc(c, `teaching_projects/${pid('t1')}`)));
      }
    });

    it('การอ่าน: เจ้าของ; หัวหน้ากลุ่มสาระฯ เฉพาะแผนก; หัวหน้างานนิเทศ/ผอ./รอง ผอ.วิชาการ ทั้งหมด; EXECUTIVE/SUPER_ADMIN ไม่ได้', async () => {
      await seed();
      await put(pid('t1'), doc0('t1', 'D1'));
      await put(pid('t2'), doc0('t2', 'D2'));
      const col = (c: any) => collection(c, 'teaching_projects');
      const own = (c: any, t: string) => getDocs(query(col(c), where('semesterId', '==', SEM), where('teacherStaffId', '==', t)));
      const dep = (c: any, d: string) => getDocs(query(col(c), where('semesterId', '==', SEM), where('departmentId', '==', d)));
      const all = (c: any) => getDocs(query(col(c), where('semesterId', '==', SEM)));
      await assertSucceeds(own(ctxOf('t1', ['SUBJECT_TEACHER']), 't1'));
      await assertFails(own(ctxOf('t1', ['SUBJECT_TEACHER']), 't2'));
      await assertSucceeds(dep(ctxOf('hod1', ['HEAD_OF_DEPARTMENT']), 'D1'));
      await assertFails(dep(ctxOf('hod1', ['HEAD_OF_DEPARTMENT']), 'D2'));
      await assertSucceeds(all(ctxOf('sv', ['INSTRUCTIONAL_SUPERVISOR'])));
      await assertSucceeds(all(ctxOf('d1', ['DIRECTOR'])));
      await assertSucceeds(all(ctxOf('d2', ['DEPUTY_DIRECTOR_ACADEMIC'])));
      await assertFails(all(ctxOf('ex', ['EXECUTIVE'])));
      await assertFails(all(ctxOf('adm', ['SUPER_ADMIN'])));
    });
  });

  describe('plc_logs / teaching_reflections (นิเทศเฟส 3)', () => {
    const SEM = '2569_1';
    const ctxOf = (sid: string, roles: string[]) => asUser(`uid-${sid}`, roles, { staffId: sid }).firestore();
    const plc = (t: string, dept: string, over: any = {}) => ({
      semesterId: SEM, academicYear: '2569', term: '1', authorStaffId: t, authorName: 'ครู', departmentId: dept,
      groupName: 'PLC คณิต', topic: 'การคิดวิเคราะห์', meetingDate: '2026-09-01', step: 'PLAN', members: ['ก', 'ข'], memberStaffIds: ['t2', 't3'],
      summary: 'ประชุม', outcome: '', nextAction: '', evidenceUrls: [], photos: [], createdAt: mServerTimestamp(), updatedAt: mServerTimestamp(), ...over,
    });
    const refl = (t: string, dept: string, over: any = {}) => ({
      semesterId: SEM, academicYear: '2569', term: '1', teacherStaffId: t, teacherName: 'ครู', departmentId: dept,
      outcomes: 'a', strengths: '', problems: 'b', improvements: 'c', nextPlan: 'd', createdAt: mServerTimestamp(), updatedAt: mServerTimestamp(), ...over,
    });
    const seed = async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await db.doc('staff/t1').set({ roles: ['SUBJECT_TEACHER'], assignments: { departmentId: 'D1' } });
        await db.doc('staff/t2').set({ roles: ['SUBJECT_TEACHER'], assignments: { departmentId: 'D2' } });
        await db.doc('staff/hod1').set({ roles: ['HEAD_OF_DEPARTMENT'], assignments: { departmentId: 'D1' } });
        await db.doc('staff/sv').set({ roles: ['INSTRUCTIONAL_SUPERVISOR'], assignments: { departmentId: 'D3' } });
      });
    };
    const put = async (path: string, data: any) => testEnv.withSecurityRulesDisabled(async (ctx) => { await ctx.firestore().doc(path).set({ ...data, createdAt: new Date(), updatedAt: new Date() }); });

    it('PLC: ครูสร้าง/แก้/ลบของตนเองได้; ปลอมผู้เขียน แผนกผิด ขั้นผิด ลิงก์ไม่ใช่ https ไม่ได้', async () => {
      await seed();
      const t1 = ctxOf('t1', ['SUBJECT_TEACHER']);
      await assertSucceeds(mSetDoc(mDoc(t1, 'plc_logs/a1'), plc('t1', 'D1')));
      await assertFails(mSetDoc(mDoc(t1, 'plc_logs/a2'), plc('t2', 'D2')));
      await assertFails(mSetDoc(mDoc(t1, 'plc_logs/a3'), plc('t1', 'D2')));
      await assertFails(mSetDoc(mDoc(t1, 'plc_logs/a4'), plc('t1', 'D1', { step: 'DONE' })));
      await assertFails(mSetDoc(mDoc(t1, 'plc_logs/a5'), plc('t1', 'D1', { evidenceUrls: ['http://x.co/a'] })));
      await assertFails(mSetDoc(mDoc(t1, 'plc_logs/a6'), plc('t1', 'D1', { meetingDate: '1/9/2569' })));
      await assertSucceeds(mUpdateDoc(mDoc(t1, 'plc_logs/a1'), { step: 'DO', summary: 'ปฏิบัติ', updatedAt: mServerTimestamp() }));
      await assertFails(mUpdateDoc(mDoc(t1, 'plc_logs/a1'), { authorStaffId: 't2', updatedAt: mServerTimestamp() }));
      await assertSucceeds(mDeleteDoc(mDoc(t1, 'plc_logs/a1')));
    });

    it('PLC: สมาชิกที่ถูกเลือกอ่านได้ (แต่แก้/ลบไม่ได้); คนนอกรายชื่ออ่านไม่ได้; รองรับหลายลิงก์/รูป ≤ 4 และเอกสารเก่าที่ไม่มี memberStaffIds', async () => {
      await seed();
      const FB = (n: number) => `https://firebasestorage.googleapis.com/v0/b/p/o/supervision_photos%2Fu%2F${n}.jpg?alt=media&token=t`;
      const t1 = ctxOf('t1', ['SUBJECT_TEACHER']);
      await assertSucceeds(mSetDoc(mDoc(t1, 'plc_logs/m1'), plc('t1', 'D1', {
        evidenceUrls: ['https://x.co/1', 'https://x.co/2'], photos: [FB(1), FB(2), FB(3), FB(4)],
      })));
      await assertFails(mSetDoc(mDoc(t1, 'plc_logs/m2'), plc('t1', 'D1', { photos: [FB(1), FB(2), FB(3), FB(4), FB(5)] })));
      await assertFails(mSetDoc(mDoc(t1, 'plc_logs/m3'), plc('t1', 'D1', { photos: ['https://evil.example/a.jpg'] })));
      await assertFails(mSetDoc(mDoc(t1, 'plc_logs/m4'), plc('t1', 'D1', { evidenceUrls: Array.from({ length: 11 }, (_, i) => `https://x.co/${i}`) })));
      await assertFails(mSetDoc(mDoc(t1, 'plc_logs/m5'), plc('t1', 'D1', { memberStaffIds: Array.from({ length: 21 }, (_, i) => `s${i}`) })));
      await assertFails(mSetDoc(mDoc(t1, 'plc_logs/m6'), plc('t1', 'D1', { evidenceUrls: ['javascript:alert(1)'] })));
      const t2 = ctxOf('t2', ['SUBJECT_TEACHER']);
      await assertSucceeds(mGetDoc(mDoc(t2, 'plc_logs/m1')));
      await assertFails(mUpdateDoc(mDoc(t2, 'plc_logs/m1'), { summary: 'hack', updatedAt: mServerTimestamp() }));
      await assertFails(mDeleteDoc(mDoc(t2, 'plc_logs/m1')));
      await assertSucceeds(getDocs(query(collection(t2, 'plc_logs'), where('semesterId', '==', SEM), where('memberStaffIds', 'array-contains', 't2'))));
      const t4 = ctxOf('t4', ['SUBJECT_TEACHER']);
      await assertFails(mGetDoc(mDoc(t4, 'plc_logs/m1')));
      // เอกสารเก่า (ไม่มี memberStaffIds/evidenceUrls) ผู้เขียนยังอ่านได้ และคนอื่นอ่านไม่ได้โดยไม่ error ของ rules
      await put('plc_logs/old1', { semesterId: SEM, academicYear: '2569', term: '1', authorStaffId: 't1', authorName: 'ครู', departmentId: 'D1', groupName: 'g', topic: 't', meetingDate: '2026-09-01', step: 'PLAN', members: ['ก'], summary: 's', evidenceUrl: 'https://x.co/old' });
      await assertSucceeds(mGetDoc(mDoc(t1, 'plc_logs/old1')));
      await assertFails(mGetDoc(mDoc(t2, 'plc_logs/old1')));
      // ผู้เขียนแก้เอกสารเก่าให้เป็นรูปแบบใหม่ได้
      await assertSucceeds(mUpdateDoc(mDoc(t1, 'plc_logs/old1'), { memberStaffIds: ['t2'], evidenceUrls: ['https://x.co/old'], photos: [], evidenceUrl: deleteField(), updatedAt: mServerTimestamp() }));
    });

    it('PLC: ผู้อื่น (รวมหัวหน้า/หัวหน้างานนิเทศ/แอดมิน) แก้หรือลบของครูไม่ได้', async () => {
      await seed();
      await put('plc_logs/b1', plc('t1', 'D1'));
      for (const c of [ctxOf('t2', ['SUBJECT_TEACHER']), ctxOf('hod1', ['HEAD_OF_DEPARTMENT']), ctxOf('sv', ['INSTRUCTIONAL_SUPERVISOR']), ctxOf('adm', ['SUPER_ADMIN'])]) {
        await assertFails(mUpdateDoc(mDoc(c, 'plc_logs/b1'), { summary: 'hack', updatedAt: mServerTimestamp() }));
        await assertFails(mDeleteDoc(mDoc(c, 'plc_logs/b1')));
      }
    });

    it('สะท้อนคิด: id = ปี_ภาค_staffId เท่านั้น; แก้ได้เฉพาะเจ้าของ; เกิน 2000 ตัวอักษรไม่ได้', async () => {
      await seed();
      const t1 = ctxOf('t1', ['SUBJECT_TEACHER']);
      await assertSucceeds(mSetDoc(mDoc(t1, `teaching_reflections/${SEM}_t1`), refl('t1', 'D1')));
      await assertFails(mSetDoc(mDoc(t1, 'teaching_reflections/random'), refl('t1', 'D1')));
      await assertFails(mSetDoc(mDoc(t1, `teaching_reflections/${SEM}_t2`), refl('t2', 'D2')));
      await assertFails(mUpdateDoc(mDoc(t1, `teaching_reflections/${SEM}_t1`), { outcomes: 'x'.repeat(2001), updatedAt: mServerTimestamp() }));
      await assertSucceeds(mUpdateDoc(mDoc(t1, `teaching_reflections/${SEM}_t1`), { outcomes: 'แก้', updatedAt: mServerTimestamp() }));
      await assertFails(mUpdateDoc(mDoc(ctxOf('sv', ['INSTRUCTIONAL_SUPERVISOR']), `teaching_reflections/${SEM}_t1`), { outcomes: 'hack', updatedAt: mServerTimestamp() }));
    });

    it('การอ่าน PLC/สะท้อนคิด: เจ้าของ; หัวหน้ากลุ่มสาระฯ เฉพาะแผนก; หัวหน้างานนิเทศ/ผอ./รอง ผอ.วิชาการ ทั้งหมด; EXECUTIVE/SUPER_ADMIN ไม่ได้', async () => {
      await seed();
      await put('plc_logs/c1', plc('t1', 'D1'));
      await put('plc_logs/c2', plc('t2', 'D2'));
      await put(`teaching_reflections/${SEM}_t1`, refl('t1', 'D1'));
      await put(`teaching_reflections/${SEM}_t2`, refl('t2', 'D2'));
      const all = (c: any, name: string) => getDocs(query(collection(c, name), where('semesterId', '==', SEM)));
      const dep = (c: any, name: string, d: string) => getDocs(query(collection(c, name), where('semesterId', '==', SEM), where('departmentId', '==', d)));
      const own = (c: any, name: string, field: string, id: string) => getDocs(query(collection(c, name), where('semesterId', '==', SEM), where(field, '==', id)));
      await assertSucceeds(own(ctxOf('t1', ['SUBJECT_TEACHER']), 'plc_logs', 'authorStaffId', 't1'));
      await assertFails(own(ctxOf('t1', ['SUBJECT_TEACHER']), 'plc_logs', 'authorStaffId', 't2'));
      await assertSucceeds(own(ctxOf('t1', ['SUBJECT_TEACHER']), 'teaching_reflections', 'teacherStaffId', 't1'));
      for (const name of ['plc_logs', 'teaching_reflections']) {
        await assertSucceeds(dep(ctxOf('hod1', ['HEAD_OF_DEPARTMENT']), name, 'D1'));
        await assertFails(dep(ctxOf('hod1', ['HEAD_OF_DEPARTMENT']), name, 'D2'));
        await assertSucceeds(all(ctxOf('sv', ['INSTRUCTIONAL_SUPERVISOR']), name));
        await assertSucceeds(all(ctxOf('d1', ['DIRECTOR']), name));
        await assertSucceeds(all(ctxOf('d2', ['DEPUTY_DIRECTOR_ACADEMIC']), name));
        await assertFails(all(ctxOf('ex', ['EXECUTIVE']), name));
        await assertFails(all(ctxOf('adm', ['SUPER_ADMIN']), name));
      }
    });
  });

  describe('public_summary (สารสนเทศโรงเรียนสาธารณะ)', () => {
    it('ใครก็อ่านเอกสาร current ได้แม้ไม่ล็อกอิน; อ่านเอกสารอื่น/list ไม่ได้; เขียนไม่ได้แม้ SUPER_ADMIN', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('public_summary/current').set({ schemaVersion: 1 });
        await ctx.firestore().doc('public_summary/other').set({ secret: 1 });
      });
      await assertSucceeds(asAnonymous().firestore().doc('public_summary/current').get());
      await assertFails(asAnonymous().firestore().doc('public_summary/other').get());
      await assertFails(getDocs(collection(asAnonymous().firestore() as any, 'public_summary')));
      await assertFails(mSetDoc(mDoc(asRole('SUPER_ADMIN').firestore() as any, 'public_summary/current'), { schemaVersion: 2 }));
      await assertFails(mSetDoc(mDoc(asAnonymous().firestore() as any, 'public_summary/current'), { schemaVersion: 2 }));
    });
  });
  describe('evaluation_template* (แบบประเมินที่แอดมินแก้ได้เป็นเวอร์ชัน)', () => {
    const RID = '2569_1';
    const sc = (sid: string, roles: string[]) => asUser(`uid-${sid}`, roles, { staffId: sid }).firestore();
    // staff = staffId ของผู้เผยแพร่ (rules บังคับ createdByStaffId/updatedByStaffId == myStaffId() ของผู้เรียก)
    const verDoc = (kind: string, version: number, ids: string[], sections: unknown[] = [], staff = 'sup-head') => ({
      kind, version, ids, criteria: ids.map(id => ({ id, label: `ข้อ ${id}`, ...(kind === 'SUPERVISION' ? { section: 1 } : {}) })), sections,
      createdAt: mServerTimestamp(), createdByStaffId: staff,
    });
    const publish = (db: any, kind: string, version: number, ids: string[], sections: unknown[] = [], staff = 'sup-head') => {
      const b = mWriteBatch(db);
      b.set(mDoc(db, `evaluation_template_versions/${kind}_${version}`), verDoc(kind, version, ids, sections, staff));
      b.set(mDoc(db, `evaluation_templates/${kind}`), { kind, currentVersion: version, updatedAt: mServerTimestamp(), updatedByStaffId: staff });
      return b.commit();
    };
    const seed = async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await db.doc('staff/t1').set({ firstName: 'ครู', lastName: 'หนึ่ง', roles: ['SUBJECT_TEACHER'], assignments: { departmentId: 'D1' } });
        await db.doc('staff/sup1').set({ firstName: 'นิเทศ', lastName: 'หนึ่ง', roles: ['SUPERVISORY_TEACHER'], assignments: { departmentId: 'D3' } });
        await db.doc(`supervision_rounds/${RID}`).set({ academicYear: '2569', term: '1', status: 'OPEN' });
        await db.doc(`supervision_assignments/${RID}_t1_sup1`).set({ roundId: RID, teacherStaffId: 't1', supervisorStaffId: 'sup1' });
      });
    };

    it('เผยแพร่เวอร์ชัน: หัวหน้างานนิเทศ/SUPER_ADMIN ทำได้ ครูทั่วไปทำไม่ได้; ต้องเริ่มที่ 2 และเพิ่มทีละ 1', async () => {
      await seed();
      await assertFails(publish(sc('t1', ['SUBJECT_TEACHER']), 'LESSON_PLAN', 2, ['c1', 'c2']));
      await assertFails(publish(sc('sup-head', ['INSTRUCTIONAL_SUPERVISOR']), 'LESSON_PLAN', 3, ['c1'])); // ข้ามเวอร์ชัน
      await assertSucceeds(publish(sc('sup-head', ['INSTRUCTIONAL_SUPERVISOR']), 'LESSON_PLAN', 2, ['c1', 'c2']));
      await assertFails(publish(sc('admin', ['SUPER_ADMIN']), 'LESSON_PLAN', 2, ['c1'])); // เวอร์ชันซ้ำ
      await assertSucceeds(publish(sc('admin', ['SUPER_ADMIN']), 'LESSON_PLAN', 3, ['c1', 'c2', 'c3'], [], 'admin'));
      // เวอร์ชันที่เผยแพร่แล้วแก้/ลบไม่ได้
      const db = sc('sup-head', ['INSTRUCTIONAL_SUPERVISOR']);
      await assertFails(mUpdateDoc(mDoc(db, 'evaluation_template_versions/LESSON_PLAN_2'), { ids: ['c1'] }));
      await assertFails(mDeleteDoc(mDoc(db, 'evaluation_template_versions/LESSON_PLAN_2')));
      // ตัวชี้ย้อนกลับ/ขยับโดยไม่สร้างเวอร์ชันไม่ได้
      await assertFails(mSetDoc(mDoc(db, 'evaluation_templates/LESSON_PLAN'), { kind: 'LESSON_PLAN', currentVersion: 2, updatedAt: mServerTimestamp(), updatedByStaffId: 'sup-head' }));
      await assertFails(mSetDoc(mDoc(db, 'evaluation_templates/LESSON_PLAN'), { kind: 'LESSON_PLAN', currentVersion: 4, updatedAt: mServerTimestamp(), updatedByStaffId: 'sup-head' }));
      // บุคลากรอ่านได้
      await assertSucceeds(mGetDoc(mDoc(sc('t1', ['SUBJECT_TEACHER']), 'evaluation_templates/LESSON_PLAN')));
    });

    it('แบบนิเทศเวอร์ชัน 2: ฉบับใหม่ต้องใช้เวอร์ชันปัจจุบัน; คะแนนต้องตรง id ของแบบและครบเมื่อส่ง', async () => {
      await seed();
      await assertSucceeds(publish(sc('sup-head', ['INSTRUCTIONAL_SUPERVISOR']), 'SUPERVISION', 2, ['a1', 'a2', 'a3'], [{ no: 1, title: 'หมวด' }]));
      const sup = sc('sup1', ['SUPERVISORY_TEACHER']);
      const base = (over: Record<string, unknown>) => ({
        roundId: RID, academicYear: '2569', term: '1', templateVersion: 2,
        teacherStaffId: 't1', teacherName: 'ครู', departmentId: 'D1', supervisorStaffId: 'sup1', supervisorName: 'ผู้นิเทศ',
        courseCode: '', courseName: 'ไทย', level: '', observedDate: '2026-09-01', observedTime: '',
        scores: { a1: 4 }, total: 4, percent: null, band: null,
        assessmentMethod: '', strengths: '', improvements: '', comment: '', photos: [],
        submitted: false, acknowledged: false, teacherReply: '',
        createdAt: mServerTimestamp(), updatedAt: mServerTimestamp(), ...over,
      });
      const ref = () => mDoc(sup, `supervision_observations/${RID}_t1`);
      await assertFails(mSetDoc(ref(), base({ templateVersion: 1, scores: { s1_1: 4 } }))); // เวอร์ชันเก่าเริ่มฉบับใหม่ไม่ได้
      await assertFails(mSetDoc(ref(), base({ scores: { s1_1: 4 } }))); // id ไม่อยู่ในแบบ
      await assertSucceeds(mSetDoc(ref(), base({})));
      const full = { scores: { a1: 5, a2: 4, a3: 3 }, total: 12, percent: 80, band: 'พอใช้', submitted: true, submittedAt: mServerTimestamp(), createdAt: undefined };
      const { createdAt: _c, ...fullNoCreated } = full as any;
      const keepCreated = async () => (await mGetDoc(ref())).data()!.createdAt;
      const upd = async (over: Record<string, unknown>) => mSetDoc(ref(), { ...base({}), createdAt: await keepCreated(), ...over });
      await assertFails(upd({ ...fullNoCreated, scores: { a1: 5, a2: 4 }, total: 9, percent: 60, band: 'ไม่ผ่าน' })); // ไม่ครบ
      await assertFails(upd({ ...fullNoCreated, scores: { a1: 5, a2: 4, a3: 9 }, total: 18, percent: 120 })); // นอกช่วง 1–5
      await assertFails(upd({ ...fullNoCreated, percent: 95, band: 'ดีมาก' })); // percent ไม่ตรง total
      await assertFails(upd({ ...fullNoCreated, band: 'ดีมาก' })); // ผลสรุปไม่ตรง percent
      await assertFails(upd({ ...fullNoCreated, templateVersion: 1 })); // เปลี่ยนเวอร์ชันของฉบับร่างไม่ได้
      await assertSucceeds(upd(fullNoCreated));
    });

    it('ตรวจแผนการสอน: review ใหม่ต้องใช้เวอร์ชันปัจจุบัน (ไม่มี templateVersion = v1 ใช้ได้เมื่อยังไม่เคยเผยแพร่เวอร์ชันใหม่)', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await db.doc('staff/t1').set({ firstName: 'ครู', lastName: 'หนึ่ง', roles: ['SUBJECT_TEACHER'], assignments: { departmentId: 'D1' } });
        await db.doc('staff/hod1').set({ firstName: 'หัวหน้า', lastName: 'D1', roles: ['HEAD_OF_DEPARTMENT'], assignments: { departmentId: 'D1' } });
        for (const id of ['p1', 'p2']) {
          await db.doc(`lesson_plan_submissions/${id}`).set({
            semesterId: '2569_1', academicYear: '2569', term: '1', teacherStaffId: 't1', teacherName: 'ครู', departmentId: 'D1', courseKey: id,
            courseCode: id, courseName: id, level: 'ม.1', kind: 'PLAN', url: 'https://example.com/plan', note: '', stage: 'SUBMITTED',
            createdAt: new Date(), updatedAt: new Date(),
          });
        }
      });
      const hod = sc('hod1', ['HEAD_OF_DEPARTMENT']);
      const q15 = Object.fromEntries(Array.from({ length: 15 }, (_, i) => [`q${i + 1}`, 4]));
      const review = (scores: Record<string, number>, extra: Record<string, unknown> = {}) => ({
        stage: 'DEPT_APPROVED', updatedAt: mServerTimestamp(),
        deptReview: { byStaffId: 'hod1', byName: 'หัวหน้า', decision: 'APPROVE', comment: '', scores, at: mServerTimestamp(), ...extra },
      });
      await assertSucceeds(mUpdateDoc(mDoc(hod, 'lesson_plan_submissions/p1'), review(q15))); // v1 ปกติ
      await assertSucceeds(publish(sc('sup-head', ['INSTRUCTIONAL_SUPERVISOR']), 'LESSON_PLAN', 2, ['c1', 'c2']));
      await assertFails(mUpdateDoc(mDoc(hod, 'lesson_plan_submissions/p2'), review(q15))); // v1 หลังมี v2 ไม่ได้
      await assertFails(mUpdateDoc(mDoc(hod, 'lesson_plan_submissions/p2'), review({ c1: 4 }, { templateVersion: 2 }))); // ไม่ครบ
      await assertFails(mUpdateDoc(mDoc(hod, 'lesson_plan_submissions/p2'), review({ c1: 4, q2: 4 }, { templateVersion: 2 }))); // id ผิด
      await assertFails(mUpdateDoc(mDoc(hod, 'lesson_plan_submissions/p2'), review({ c1: 4, c2: 6 }, { templateVersion: 2 }))); // นอกช่วง
      await assertSucceeds(mUpdateDoc(mDoc(hod, 'lesson_plan_submissions/p2'), review({ c1: 4, c2: 5 }, { templateVersion: 2 })));
    });
  });
  describe('grade_retakes / graduation_approvals (งานทะเบียนวัดผล)', () => {
    const sc = (sid: string, roles: string[]) => asUser(`uid-${sid}`, roles, { staffId: sid }).firestore();
    const RID = '11111_1-2569_ท23101';
    const retake = (over: Record<string, unknown> = {}) => ({
      studentId: '11111', studentUid: 'uid-stu', parentUid: 'uid-par', room: 'ม.3/1', term: '1/2569', courseCode: 'ท23101', courseName: 'ภาษาไทย',
      kind: 'MAKEUP', originalGrade: '0', newGrade: '2', retakeDate: '2569-11-01', note: '', recordedByStaffId: 'reg1', recordedByName: 'ทะเบียน',
      createdAt: mServerTimestamp(), updatedAt: mServerTimestamp(), ...over,
    });
    const seed = async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await db.doc('students/11111').set({ studentId: '11111', name: 'เด็กหนึ่ง', room: 'ม.3/1', studentUid: 'uid-stu', parentUid: 'uid-par' });
        await db.doc('students/22222').set({ studentId: '22222', name: 'เด็กสอง', room: 'ม.4/1', studentUid: 'uid-stu2' });
        await db.doc('staff/hr1').set({ firstName: 'ครู', lastName: 'ประจำชั้น', roles: ['HOMEROOM_TEACHER'], assignments: { homeroomClass: 'ม.3/1' } });
        await db.doc('staff/hr2').set({ firstName: 'ครู', lastName: 'อื่น', roles: ['HOMEROOM_TEACHER'], assignments: { homeroomClass: 'ม.5/1' } });
      });
    };

    it('งานทะเบียน/ผู้ช่วยบันทึกได้ ครูทั่วไปบันทึกไม่ได้; ข้อมูลต้องตรงทะเบียนนักเรียน', async () => {
      await seed();
      await assertFails(mSetDoc(mDoc(sc('t1', ['SUBJECT_TEACHER']), `grade_retakes/${RID}`), retake({ recordedByStaffId: 't1' })));
      await assertSucceeds(mSetDoc(mDoc(sc('reg1', ['REGISTRAR']), `grade_retakes/${RID}`), retake()));
      await assertFails(mSetDoc(mDoc(sc('reg1', ['REGISTRAR']), `grade_retakes/${RID}x`), retake())); // รหัสเอกสารไม่ตรง
      await assertFails(mSetDoc(mDoc(sc('reg1', ['REGISTRAR']), 'grade_retakes/11111_1-2569_ค1'), retake({ courseCode: 'ค1', room: 'ม.9/9' }))); // ห้องไม่ตรงทะเบียน
      await assertFails(mSetDoc(mDoc(sc('reg1', ['REGISTRAR']), 'grade_retakes/11111_1-2569_ค1'), retake({ courseCode: 'ค1', newGrade: '0' }))); // เท่าเดิม
      await assertFails(mSetDoc(mDoc(sc('reg1', ['REGISTRAR']), 'grade_retakes/11111_1-2569_ค1'), retake({ courseCode: 'ค1', newGrade: '5' }))); // เกรดไม่มี
      await assertFails(mSetDoc(mDoc(sc('reg1', ['REGISTRAR']), 'grade_retakes/11111_1-2569_ค1'), retake({ courseCode: 'ค1', recordedByStaffId: 'someone' }))); // สวมรอย
      await assertSucceeds(mSetDoc(mDoc(sc('asst1', ['REGISTRAR_ASSISTANT']), 'grade_retakes/11111_1-2569_ค1'), retake({ courseCode: 'ค1', recordedByStaffId: 'asst1', originalGrade: 'ร', newGrade: '1' })));
    });

    it('ผู้ช่วยแก้ได้แต่ลบไม่ได้; แก้ฟิลด์ระบุตัวไม่ได้; งานทะเบียนลบได้', async () => {
      await seed();
      await assertSucceeds(mSetDoc(mDoc(sc('reg1', ['REGISTRAR']), `grade_retakes/${RID}`), retake()));
      const created = (await mGetDoc(mDoc(sc('reg1', ['REGISTRAR']), `grade_retakes/${RID}`))).data()!.createdAt;
      const upd = (over: Record<string, unknown>) => mSetDoc(mDoc(sc('asst1', ['REGISTRAR_ASSISTANT']), `grade_retakes/${RID}`), retake({ recordedByStaffId: 'asst1', createdAt: created, ...over }));
      await assertSucceeds(upd({ newGrade: '3' }));
      await assertFails(upd({ studentId: '22222' }));
      await assertFails(upd({ courseCode: 'ค9' }));
      await assertFails(mDeleteDoc(mDoc(sc('asst1', ['REGISTRAR_ASSISTANT']), `grade_retakes/${RID}`)));
      await assertSucceeds(mDeleteDoc(mDoc(sc('reg1', ['REGISTRAR']), `grade_retakes/${RID}`)));
    });

    it('อ่าน: นักเรียนเจ้าของ/ผู้ปกครอง/ครูที่ปรึกษาห้องนั้น/งานทะเบียน ได้; คนอื่นไม่ได้', async () => {
      await seed();
      await assertSucceeds(mSetDoc(mDoc(sc('reg1', ['REGISTRAR']), `grade_retakes/${RID}`), retake()));
      const read = (db: any) => mGetDoc(mDoc(db, `grade_retakes/${RID}`));
      await assertSucceeds(read(asUser('uid-stu', []).firestore()));
      await assertSucceeds(read(asUser('uid-par', []).firestore()));
      await assertSucceeds(read(sc('hr1', ['HOMEROOM_TEACHER'])));
      await assertSucceeds(read(sc('asst1', ['REGISTRAR_ASSISTANT'])));
      await assertFails(read(sc('hr2', ['HOMEROOM_TEACHER'])));
      await assertFails(read(asUser('uid-stu2', []).firestore()));
      await assertFails(read(sc('t1', ['SUBJECT_TEACHER'])));
    });

    it('อนุมัติจบหลักสูตร: เฉพาะงานทะเบียน (ผู้ช่วยไม่ได้) ระดับต้องตรงห้อง และแก้/ลบไม่ได้', async () => {
      await seed();
      const gid = '11111_ม.3';
      const grad = (over: Record<string, unknown> = {}) => ({
        studentId: '11111', studentUid: 'uid-stu', parentUid: 'uid-par', room: 'ม.3/1', level: 'ม.3', academicYear: '2569', note: '',
        approvedByStaffId: 'reg1', approvedByName: 'ทะเบียน', approvedAt: mServerTimestamp(), ...over,
      });
      await assertFails(mSetDoc(mDoc(sc('asst1', ['REGISTRAR_ASSISTANT']), `graduation_approvals/${gid}`), grad({ approvedByStaffId: 'asst1' })));
      await assertFails(mSetDoc(mDoc(sc('reg1', ['REGISTRAR']), 'graduation_approvals/11111_ม.6'), grad({ level: 'ม.6' }))); // ห้องเป็น ม.3
      await assertFails(mSetDoc(mDoc(sc('reg1', ['REGISTRAR']), 'graduation_approvals/22222_ม.3'), grad({ studentId: '22222', room: 'ม.4/1' }))); // ม.4 ไม่จบ
      await assertSucceeds(mSetDoc(mDoc(sc('reg1', ['REGISTRAR']), `graduation_approvals/${gid}`), grad()));
      await assertFails(mSetDoc(mDoc(sc('reg1', ['REGISTRAR']), `graduation_approvals/${gid}`), grad({ note: 'แก้' })));
      await assertFails(mDeleteDoc(mDoc(sc('reg1', ['REGISTRAR']), `graduation_approvals/${gid}`)));
      await assertSucceeds(mGetDoc(mDoc(asUser('uid-stu', []).firestore(), `graduation_approvals/${gid}`)));
    });

    it('อนุมัติจบทั้งชั้น (batch): งานทะเบียนซ่อนนักเรียนได้เฉพาะพร้อมเอกสารอนุมัติ; ผู้ช่วย/ไม่มีเอกสารอนุมัติทำไม่ได้', async () => {
      await seed();
      const grad = (staff: string) => ({
        studentId: '11111', studentUid: 'uid-stu', parentUid: 'uid-par', room: 'ม.3/1', level: 'ม.3', academicYear: '2569', note: '',
        approvedByStaffId: staff, approvedByName: 'ทะเบียน', approvedAt: mServerTimestamp(),
      });
      const stuPatch = (uid: string) => ({ status: 'INACTIVE', statusReason: 'GRADUATED', statusNote: 'จบ', statusChangedBy: uid, statusChangedAt: mServerTimestamp(), updatedAt: mServerTimestamp() });
      const run = async (staff: string, role: string, withApproval: boolean) => {
        const db = sc(staff, [role]);
        const b = mWriteBatch(db);
        if (withApproval) b.set(mDoc(db, 'graduation_approvals/11111_ม.3'), grad(staff));
        b.update(mDoc(db, 'students/11111'), stuPatch(`uid-${staff}`));
        b.set(mDoc(db, 'student_id_registry/11111'), { studentId: '11111', entries: [], updatedAt: mServerTimestamp() }, { merge: true });
        return b.commit();
      };
      await assertFails(run('reg1', 'REGISTRAR', false)); // ไม่มีเอกสารอนุมัติ
      await assertFails(run('asst1', 'REGISTRAR_ASSISTANT', true)); // ผู้ช่วย
      await assertFails(mUpdateDoc(mDoc(sc('reg1', ['REGISTRAR']), 'students/11111'), { name: 'แก้ชื่อ', updatedAt: mServerTimestamp() })); // แก้ฟิลด์อื่นไม่ได้
      await assertSucceeds(run('reg1', 'REGISTRAR', true));
    });

    it('ย้ายห้อง: ยื่นคำขอ → มติ (ตัวจริงเท่านั้น) → ดำเนินการย้ายพร้อมอัปเดตนักเรียน; แก้/ลบย้อนหลังไม่ได้', async () => {
      await seed();
      const asst = sc('asst1', ['REGISTRAR_ASSISTANT']);
      const reg = sc('reg1', ['REGISTRAR']);
      const req = (staff: string, over: Record<string, unknown> = {}) => ({
        studentId: '11111', studentName: 'เด็กหนึ่ง', fromRoom: 'ม.3/1', toRoom: 'ม.3/2', fromHouseId: null, toHouseId: 'h2', reason: 'ย้ายตามความเหมาะสม', status: 'PENDING',
        requestedByStaffId: staff, requestedByName: 'ทะเบียน', createdAt: mServerTimestamp(), updatedAt: mServerTimestamp(), ...over,
      });
      await assertFails(mSetDoc(mDoc(sc('t1', ['SUBJECT_TEACHER']), 'room_transfers/t1'), req('t1')));
      await assertFails(mSetDoc(mDoc(asst, 'room_transfers/t1'), req('asst1', { fromRoom: 'ม.9/9' }))); // ห้องเดิมไม่ตรงทะเบียน
      await assertFails(mSetDoc(mDoc(asst, 'room_transfers/t1'), req('asst1', { status: 'APPROVED' }))); // ข้ามขั้นตอน
      await assertSucceeds(mSetDoc(mDoc(asst, 'room_transfers/t1'), req('asst1')));
      const decide = (db: any, staff: string, status = 'APPROVED') => mUpdateDoc(mDoc(db, 'room_transfers/t1'), {
        status, decisionCommittee: 'คำสั่งที่ 7/2569', decisionDate: '2569-11-01', decisionNote: '', decidedByStaffId: staff, decidedByName: 'ทะเบียน', decidedAt: mServerTimestamp(), updatedAt: mServerTimestamp(),
      });
      await assertFails(decide(asst, 'asst1')); // ผู้ช่วยบันทึกมติไม่ได้
      // ยังไม่อนุมัติ → ย้ายนักเรียนไม่ได้
      const apply = async (db: any, staff: string, room = 'ม.3/2') => {
        const b = mWriteBatch(db);
        b.update(mDoc(db, 'students/11111'), { room, houseId: 'h2', roomTransferId: 't1', updatedAt: mServerTimestamp() });
        b.update(mDoc(db, 'room_transfers/t1'), { status: 'APPLIED', effectiveDate: '2569-11-05', appliedByStaffId: staff, appliedByName: 'ทะเบียน', appliedAt: mServerTimestamp(), updatedAt: mServerTimestamp() });
        return b.commit();
      };
      await assertFails(apply(reg, 'reg1'));
      await assertSucceeds(decide(reg, 'reg1'));
      await assertFails(decide(reg, 'reg1', 'REJECTED')); // ตัดสินแล้วแก้ไม่ได้
      await assertFails(apply(asst, 'asst1', 'ม.5/5')); // ห้องไม่ตรงคำขอ
      await assertSucceeds(apply(asst, 'asst1')); // ผู้ช่วยดำเนินการย้ายได้
      await assertFails(mDeleteDoc(mDoc(reg, 'room_transfers/t1')));
      await assertFails(mUpdateDoc(mDoc(reg, 'room_transfers/t1'), { reason: 'แก้ย้อนหลัง', updatedAt: mServerTimestamp() }));
    });
  });
  describe('conduct_entries / conduct_change_requests (งานกิจการนักเรียน)', () => {
    const sc = (sid: string, roles: string[]) => asUser(`uid-${sid}`, roles, { staffId: sid }).firestore();
    // ใช้ครูผู้สอน (SUBJECT_TEACHER) เท่านั้น: HOMEROOM_TEACHER มีสิทธิ์แก้ students ทุกฟิลด์อยู่เดิม (ข้ามการตรวจแคชได้)
    const seed = async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await db.doc('students/11111').set({ studentId: '11111', name: 'เด็กหนึ่ง', room: 'ม.3/1', studentUid: 'uid-stu', parentUid: 'uid-par', behaviorScore: 100 });
        await db.doc('students/22222').set({ studentId: '22222', name: 'เด็กสอง', room: 'ม.4/1', studentUid: 'uid-stu2', parentUid: 'uid-par2', behaviorScore: 100 });
        await db.doc('staff/hr1').set({ firstName: 'ครู', lastName: 'ประจำชั้น', roles: ['HOMEROOM_TEACHER'], assignments: { homeroomClass: 'ม.3/1' } });
      });
    };
    const entry = (staff: string, over: Record<string, unknown> = {}) => ({
      studentId: '11111', studentName: 'เด็กหนึ่ง', studentUid: 'uid-stu', parentUid: 'uid-par', room: 'ม.3/1', kind: 'DEDUCT', level: 'LIGHT',
      points: 3, appliedPoints: 3, status: 'APPLIED', reason: 'มาสาย', category: '', date: '2569-11-01',
      createdByStaffId: staff, createdByName: 'ครู', createdAt: mServerTimestamp(), updatedAt: mServerTimestamp(), ...over,
    });
    const cache = (eid: string, o: { added?: number; ded?: number; score?: number; risk?: string } = {}) => ({
      behaviorScore: o.score ?? 97, riskLevel: o.risk ?? 'NORMAL', conductBase: 100, conductAdded: o.added ?? 0, conductDeducted: o.ded ?? 3,
      lastConductEntryId: eid, updatedAt: mServerTimestamp(),
    });
    const submit = (db: any, eid: string, e: Record<string, unknown>, c: Record<string, unknown>, sid = '11111') => {
      const b = mWriteBatch(db);
      b.set(mDoc(db, `conduct_entries/${eid}`), e);
      b.update(mDoc(db, `students/${sid}`), c);
      return b.commit();
    };

    it('ครูหัก/เพิ่ม ≤5 มีผลทันที เมื่อแคชคะแนนตรงเป๊ะ; แคชผิดหรือไม่ปรับแคชไม่ได้', async () => {
      await seed();
      const t = sc('t1', ['SUBJECT_TEACHER']);
      await assertSucceeds(submit(t, 'e1', entry('t1'), cache('e1')));
      await assertFails(submit(t, 'e2', entry('t1'), cache('e2', { ded: 3, score: 97 }))); // ไม่สะสมต่อจากแคชเดิม (ควรเป็น 6/94)
      await assertSucceeds(submit(t, 'e5', entry('t1'), cache('e5', { ded: 6, score: 94 })));
      await assertFails(mSetDoc(mDoc(t, 'conduct_entries/e3'), entry('t1'))); // ไม่ปรับแคชใน batch เดียวกัน
      const b = mWriteBatch(t); // แคชคะแนนไม่ตรงกับรายการ
      b.set(mDoc(t, 'conduct_entries/e4'), entry('t1', { points: 2, appliedPoints: 2 }));
      b.update(mDoc(t, 'students/11111'), cache('e4', { ded: 2, score: 50 }));
      await assertFails(b.commit());
    });

    it('ครูเกิน 5 ต้องเป็น PENDING เท่านั้น; ระดับ/เพดานต้องตรง; สวมรอยผู้บันทึกไม่ได้', async () => {
      await seed();
      const t = sc('t1', ['SUBJECT_TEACHER']);
      await assertFails(submit(t, 'e1', entry('t1', { level: 'MEDIUM', points: 8, appliedPoints: 8 }), cache('e1', { ded: 8, score: 92 })));
      await assertSucceeds(mSetDoc(mDoc(t, 'conduct_entries/e2'), entry('t1', { level: 'MEDIUM', points: 8, appliedPoints: 0, status: 'PENDING' })));
      await assertFails(mSetDoc(mDoc(t, 'conduct_entries/e3'), entry('t1', { level: 'LIGHT', points: 6, appliedPoints: 0, status: 'PENDING' }))); // เบาเกิน 5
      await assertFails(mSetDoc(mDoc(t, 'conduct_entries/e4'), entry('t1', { createdByStaffId: 'other', appliedPoints: 0, status: 'PENDING' }))); // สวมรอย
      await assertFails(mSetDoc(mDoc(t, 'conduct_entries/e5'), entry('t1', { room: 'ม.9/9', appliedPoints: 0, status: 'PENDING' }))); // ห้องไม่ตรงทะเบียน
      await assertFails(mSetDoc(mDoc(sc('x1', ['PARENT']), 'conduct_entries/e6'), entry('x1', { appliedPoints: 0, status: 'PENDING' }))); // ไม่ใช่บุคลากร
    });

    it('งานกิจการพิจารณารายการที่ส่งมา (อนุมัติปรับแคช/ไม่อนุมัติไม่แตะแคช); ครูพิจารณาเองไม่ได้', async () => {
      await seed();
      const t = sc('t1', ['SUBJECT_TEACHER']);
      const a = sc('aff1', ['STUDENT_AFFAIRS']);
      await assertSucceeds(mSetDoc(mDoc(t, 'conduct_entries/e1'), entry('t1', { level: 'MEDIUM', points: 8, appliedPoints: 0, status: 'PENDING' })));
      await assertSucceeds(mSetDoc(mDoc(t, 'conduct_entries/e2'), entry('t1', { level: 'MEDIUM', points: 8, appliedPoints: 0, status: 'PENDING' })));
      const decide = (db: any, eid: string, status: string, applied: number, staff = 'aff1') => {
        const b = mWriteBatch(db);
        b.update(mDoc(db, `conduct_entries/${eid}`), {
          status, appliedPoints: applied, level: 'MEDIUM', decidedByStaffId: staff, decidedByName: 'กิจการ', decidedAt: mServerTimestamp(), decisionNote: '', updatedAt: mServerTimestamp(),
        });
        if (status === 'APPLIED') b.update(mDoc(db, 'students/11111'), cache(eid, { ded: applied, score: 100 - applied }));
        return b.commit();
      };
      await assertFails(decide(t, 'e1', 'APPLIED', 8, 't1')); // ครูไม่มีสิทธิ์
      await assertSucceeds(decide(a, 'e1', 'APPLIED', 8));
      await assertFails(decide(a, 'e1', 'REJECTED', 0)); // พิจารณาแล้วเปลี่ยนไม่ได้
      await assertSucceeds(decide(a, 'e2', 'REJECTED', 0));
    });

    it('งานกิจการบันทึกเกิน 5 ได้ทันที (ตามเพดานระดับ) แต่ไม่เกินเพดาน', async () => {
      await seed();
      const a = sc('aff1', ['STUDENT_AFFAIRS']);
      await assertSucceeds(submit(a, 'e1', entry('aff1', { level: 'SEVERE', points: 20, appliedPoints: 20 }), cache('e1', { ded: 20, score: 80, risk: 'NORMAL' })));
      await assertFails(submit(a, 'e2', entry('aff1', { level: 'SEVERE', points: 21, appliedPoints: 21 }), cache('e2', { ded: 41, score: 59, risk: 'CRITICAL' })));
    });

    it('แก้/ยกเลิกคะแนนผ่านคำร้องเท่านั้น: ผู้บันทึกยื่น งานกิจการอนุมัติ; ลบไม่ได้', async () => {
      await seed();
      const t = sc('t1', ['SUBJECT_TEACHER']);
      const a = sc('aff1', ['STUDENT_AFFAIRS']);
      await assertSucceeds(submit(t, 'e1', entry('t1'), cache('e1')));
      const req = (staff: string, over: Record<string, unknown> = {}) => ({
        entryId: 'e1', studentId: '11111', action: 'DELETE', newPoints: null, beforePoints: 3, reason: 'บันทึกผิดคน', status: 'PENDING',
        requestedByStaffId: staff, requestedByName: 'ครู', createdAt: mServerTimestamp(), updatedAt: mServerTimestamp(), ...over,
      });
      await assertFails(mSetDoc(mDoc(sc('t2', ['SUBJECT_TEACHER']), 'conduct_change_requests/r0'), req('t2'))); // ไม่ใช่ผู้บันทึก
      await assertFails(mSetDoc(mDoc(t, 'conduct_change_requests/r0'), req('t1', { reason: '' })));
      await assertFails(mSetDoc(mDoc(t, 'conduct_change_requests/r0'), req('t1', { action: 'EDIT', newPoints: 3 }))); // เท่าเดิม
      await assertSucceeds(mSetDoc(mDoc(t, 'conduct_change_requests/r1'), req('t1')));
      // ครูแก้รายการเองตรง ๆ ไม่ได้
      await assertFails(mUpdateDoc(mDoc(t, 'conduct_entries/e1'), { status: 'REVERSED', updatedAt: mServerTimestamp() }));
      await assertFails(mDeleteDoc(mDoc(t, 'conduct_entries/e1')));
      const approve = (db: any, staff: string, over: Record<string, unknown> = {}) => {
        const b = mWriteBatch(db);
        b.update(mDoc(db, 'conduct_change_requests/r1'), { status: 'APPROVED', decidedByStaffId: staff, decidedByName: 'กิจการ', decidedAt: mServerTimestamp(), decisionNote: '', updatedAt: mServerTimestamp() });
        b.update(mDoc(db, 'conduct_entries/e1'), { status: 'REVERSED', lastChangeRequestId: 'r1', updatedAt: mServerTimestamp(), ...over });
        b.update(mDoc(db, 'students/11111'), cache('e1', { ded: 0, score: 100 }));
        return b.commit();
      };
      await assertFails(approve(t, 't1')); // ครูอนุมัติเองไม่ได้
      await assertSucceeds(approve(a, 'aff1'));
      await assertFails(mDeleteDoc(mDoc(a, 'conduct_entries/e1')));
      await assertFails(mDeleteDoc(mDoc(a, 'conduct_change_requests/r1')));
    });

    it('สิทธิ์อ่าน: งานกิจการทั้งหมด, ครูที่ปรึกษาห้องนั้น, ผู้บันทึก, นักเรียน/ผู้ปกครองเจ้าของ; ห้องอื่นอ่านไม่ได้', async () => {
      await seed();
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('conduct_entries/e1').set(entry('hr1', { createdAt: new Date(), updatedAt: new Date() }));
      });
      const get = (db: any) => mGetDoc(mDoc(db, 'conduct_entries/e1'));
      await assertSucceeds(get(sc('aff1', ['STUDENT_AFFAIRS'])));
      await assertSucceeds(get(sc('hr1', ['HOMEROOM_TEACHER'])));
      await assertSucceeds(get(asUser('uid-stu', ['STUDENT']).firestore()));
      await assertSucceeds(get(asUser('uid-par', ['PARENT']).firestore()));
      await assertFails(get(asUser('uid-par2', ['PARENT']).firestore()));
      await assertFails(get(sc('t9', ['SUBJECT_TEACHER'])));
    });

    it('งานกิจการอ่านนักเรียน/เช็คอินประตู/เยี่ยมบ้านทั้งโรงเรียนได้ แต่เขียนข้อมูลเหล่านั้นไม่ได้', async () => {
      await seed();
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('gate_attendance_logs/g1').set({ studentId: '11111', date: '2569-11-01', type: 'IN' });
      });
      const a = sc('aff1', ['STUDENT_AFFAIRS']);
      await assertSucceeds(mGetDoc(mDoc(a, 'students/11111')));
      await assertSucceeds(mGetDoc(mDoc(a, 'gate_attendance_logs/g1')));
      await assertFails(mUpdateDoc(mDoc(a, 'students/11111'), { name: 'แก้ชื่อ', updatedAt: mServerTimestamp() }));
      await assertFails(mUpdateDoc(mDoc(a, 'gate_attendance_logs/g1'), { type: 'OUT' }));
    });
  });
  // ทุนการศึกษา / กยศ. (FUND_SCHOLARSHIP)
  describe('fund_programs / fund_interests', () => {
    const fund = () => asUser('fund-1', ['FUND_SCHOLARSHIP'], { staffId: 'fund-1' }).firestore();
    const stu = () => asUser('uid-stu', ['STUDENT']).firestore();
    const stuOther = () => asUser('uid-stu2', ['STUDENT']).firestore();
    const par = () => asUser('uid-par', ['PARENT']).firestore();
    const gc = () => asUser('gc-1', ['GUIDANCE_COUNSELOR'], { staffId: 'gc-1' }).firestore();
    const prog = (id: string, o: Record<string, unknown> = {}) => ({
      id, kind: 'SCHOLARSHIP', title: 'ทุนเรียนดี', funder: 'มูลนิธิ', description: '', eligibility: '', amountText: '', selectionNote: '',
      links: [], status: 'PUBLISHED', registrationEnabled: true, registrationOpensAt: null,
      registrationClosesAt: new Date(Date.now() + 7 * 86400000),
      createdByStaffId: 'fund-1', createdByName: 'ครูทุน', createdAt: new Date(), updatedAt: new Date(), ...o,
    });
    const interest = (pid: string, o: Record<string, unknown> = {}) => ({
      programId: pid, studentId: '11111', studentUid: 'uid-stu', studentName: 'เด็กหนึ่ง', room: 'ม.3/1', kind: 'SCHOLARSHIP',
      status: 'INTERESTED', note: '', createdAt: new Date(), updatedAt: new Date(), ...o,
    });
    const nowTs = () => ({ createdAt: mServerTimestamp(), updatedAt: mServerTimestamp() });
    async function seedFund(programs: Record<string, unknown>[] = [prog('p1')]) {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await db.doc('students/11111').set({ studentId: '11111', name: 'เด็กหนึ่ง', room: 'ม.3/1', studentUid: 'uid-stu', parentUid: 'uid-par' });
        await db.doc('students/22222').set({ studentId: '22222', name: 'เด็กสอง', room: 'ม.4/1', studentUid: 'uid-stu2' });
        for (const p of programs) await db.doc(`fund_programs/${p.id}`).set(p);
      });
    }

    it('งานกองทุนสร้าง/แก้/ลบ(เฉพาะฉบับร่าง)ได้ — ครูอื่นและนักเรียนเขียนไม่ได้', async () => {
      await seedFund([]);
      await assertSucceeds(mSetDoc(mDoc(fund(), 'fund_programs/n1'), prog('n1', { status: 'DRAFT', createdAt: mServerTimestamp(), updatedAt: mServerTimestamp() })));
      await assertFails(mSetDoc(mDoc(gc(), 'fund_programs/n2'), prog('n2')));
      await assertFails(mSetDoc(mDoc(stu(), 'fund_programs/n3'), prog('n3')));
      await assertSucceeds(mDeleteDoc(mDoc(fund(), 'fund_programs/n1')));
    });

    it('นักเรียน/ผู้ปกครองอ่านเฉพาะที่ประกาศแล้ว — ฉบับร่างอ่านไม่ได้; แนะแนวอ่านได้ทั้งหมด', async () => {
      await seedFund([prog('pub'), prog('dr', { status: 'DRAFT' })]);
      await assertSucceeds(mGetDoc(mDoc(stu(), 'fund_programs/pub')));
      await assertSucceeds(mGetDoc(mDoc(par(), 'fund_programs/pub')));
      await assertFails(mGetDoc(mDoc(stu(), 'fund_programs/dr')));
      await assertSucceeds(mGetDoc(mDoc(gc(), 'fund_programs/dr')));
      await assertSucceeds(mGetDoc(mDoc(fund(), 'fund_programs/dr')));
    });

    it('นักเรียนลงชื่อสนใจได้เมื่อประกาศ+เปิดรับ; ผู้ปกครองลงแทน/ถอนแทนไม่ได้ (อ่านอย่างเดียว); คนอื่นลงแทนไม่ได้', async () => {
      await seedFund();
      await assertFails(mSetDoc(mDoc(par(), 'fund_interests/p1_11111'), { ...interest('p1'), ...nowTs() }));
      await assertSucceeds(mSetDoc(mDoc(stu(), 'fund_interests/p1_11111'), { ...interest('p1'), ...nowTs() }));
      await assertFails(mSetDoc(mDoc(stuOther(), 'fund_interests/p1_11111b'), { ...interest('p1'), ...nowTs() }));
      await assertFails(mSetDoc(mDoc(stuOther(), 'fund_interests/p1_11111'), { ...interest('p1'), ...nowTs() }));
      await assertSucceeds(mGetDoc(mDoc(stu(), 'fund_interests/p1_11111')));
      await assertFails(mUpdateDoc(mDoc(par(), 'fund_interests/p1_11111'), { status: 'WITHDRAWN', note: '', updatedAt: mServerTimestamp() }));
    });

    it('ลงชื่อไม่ได้เมื่อปิดรับ/ยังไม่เปิด/ฉบับร่าง/ไม่ได้เปิดระบบลงชื่อ', async () => {
      await seedFund([
        prog('late', { registrationClosesAt: new Date(Date.now() - 86400000) }),
        prog('early', { registrationOpensAt: new Date(Date.now() + 86400000) }),
        prog('dr', { status: 'DRAFT' }),
        prog('off', { registrationEnabled: false }),
      ]);
      for (const id of ['late', 'early', 'dr', 'off']) {
        await assertFails(mSetDoc(mDoc(stu(), `fund_interests/${id}_11111`), { ...interest(id), ...nowTs() }));
      }
    });

    it('ลงชื่อด้วยข้อมูลปลอมไม่ได้ (uid/ห้อง/ประเภท/สถานะ/id ไม่ตรง)', async () => {
      await seedFund();
      await assertFails(mSetDoc(mDoc(stu(), 'fund_interests/p1_11111'), { ...interest('p1', { studentUid: 'someone' }), ...nowTs() }));
      await assertFails(mSetDoc(mDoc(stu(), 'fund_interests/p1_11111'), { ...interest('p1', { room: 'ม.6/9' }), ...nowTs() }));
      await assertFails(mSetDoc(mDoc(stu(), 'fund_interests/p1_11111'), { ...interest('p1', { kind: 'STUDENT_LOAN' }), ...nowTs() }));
      await assertFails(mSetDoc(mDoc(stu(), 'fund_interests/p1_11111'), { ...interest('p1', { status: 'AWARDED' }), ...nowTs() }));
      await assertFails(mSetDoc(mDoc(stu(), 'fund_interests/wrong-id'), { ...interest('p1'), ...nowTs() }));
    });

    it('นักเรียนถอนได้เสมอ; ลงใหม่ได้เมื่อยังเปิดรับ; แก้เป็น AWARDED เองไม่ได้', async () => {
      await seedFund();
      await testEnv.withSecurityRulesDisabled(async (ctx) => { await ctx.firestore().doc('fund_interests/p1_11111').set(interest('p1')); });
      await assertFails(mUpdateDoc(mDoc(stu(), 'fund_interests/p1_11111'), { status: 'AWARDED', updatedAt: mServerTimestamp() }));
      await assertSucceeds(mUpdateDoc(mDoc(stu(), 'fund_interests/p1_11111'), { status: 'WITHDRAWN', note: '', updatedAt: mServerTimestamp() }));
      await assertSucceeds(mUpdateDoc(mDoc(stu(), 'fund_interests/p1_11111'), { status: 'INTERESTED', note: '', updatedAt: mServerTimestamp() }));
    });

    it('งานกองทุนบันทึกผลคัดเลือกตามลำดับสถานะได้ — ข้ามจากถอนไม่ได้, ครูแนะแนวแก้ไม่ได้', async () => {
      await seedFund();
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('fund_interests/p1_11111').set(interest('p1'));
        await ctx.firestore().doc('fund_interests/p1_22222').set(interest('p1', { studentId: '22222', studentUid: 'uid-stu2', status: 'WITHDRAWN' }));
      });
      const decide = (s: string) => ({ status: s, staffNote: 'ok', decidedByStaffId: 'fund-1', decidedByName: 'ครูทุน', updatedAt: mServerTimestamp() });
      await assertFails(mUpdateDoc(mDoc(gc(), 'fund_interests/p1_11111'), decide('SHORTLISTED')));
      await assertFails(mUpdateDoc(mDoc(fund(), 'fund_interests/p1_22222'), decide('AWARDED')));
      await assertFails(mUpdateDoc(mDoc(fund(), 'fund_interests/p1_11111'), { ...decide('SHORTLISTED'), decidedByStaffId: 'other' }));
      await assertSucceeds(mUpdateDoc(mDoc(fund(), 'fund_interests/p1_11111'), decide('SHORTLISTED')));
      await assertSucceeds(mUpdateDoc(mDoc(fund(), 'fund_interests/p1_11111'), decide('AWARDED')));
      await assertFails(mUpdateDoc(mDoc(fund(), 'fund_interests/p1_11111'), decide('NOT_SELECTED')));
    });

    it('อ่านรายการลงชื่อ: เจ้าตัว/ผู้ปกครอง/งานกองทุน/แนะแนว — นักเรียนอื่นอ่านไม่ได้; ห้ามลบ', async () => {
      await seedFund();
      await testEnv.withSecurityRulesDisabled(async (ctx) => { await ctx.firestore().doc('fund_interests/p1_11111').set(interest('p1')); });
      await assertSucceeds(mGetDoc(mDoc(stu(), 'fund_interests/p1_11111')));
      await assertSucceeds(mGetDoc(mDoc(par(), 'fund_interests/p1_11111')));
      await assertSucceeds(mGetDoc(mDoc(fund(), 'fund_interests/p1_11111')));
      await assertSucceeds(mGetDoc(mDoc(gc(), 'fund_interests/p1_11111')));
      await assertFails(mGetDoc(mDoc(stuOther(), 'fund_interests/p1_11111')));
      await assertFails(mDeleteDoc(mDoc(fund(), 'fund_interests/p1_11111')));
    });
  });
});
