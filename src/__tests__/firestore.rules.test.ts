import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { enrollInActivity, withdrawFromActivity, createBillingInvoice, createBillingInvoicesBulk, recordInfirmaryVisit, createParentNotification } from '../services/firestoreService';

let testEnv: RulesTestEnvironment;

// เคารพ FIRESTORE_EMULATOR_HOST ที่ `firebase emulators:exec` ตั้งให้ (เช่นตอนรันบน
// พอร์ตสำรองเพราะ emulator หลักติดพอร์ต 8080 อยู่) — fallback เป็น 127.0.0.1:8080 ตามเดิม
const [EMU_HOST, EMU_PORT] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'kiattisak-project-001',
    firestore: {
      rules: fs.readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8'),
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
  await testEnv.clearFirestore();
});

function asRole(...roles: string[]) {
  return testEnv.authenticatedContext('test-uid', { roles });
}

function asUser(uid: string, roles: string[] = []) {
  return testEnv.authenticatedContext(uid, { roles });
}

function asAnonymous() {
  return testEnv.unauthenticatedContext();
}

describe('Firestore Security Rules Engine Unit Tests', () => {
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

    it('allows GUIDANCE_COUNSELOR and student self to write self assessment', async () => {
      await assertSucceeds(
        asRole('GUIDANCE_COUNSELOR').firestore().doc('student_self_assessments/assess-g').set({ score: 10 })
      );
      await assertSucceeds(
        asUser('student-me').firestore().doc('student_self_assessments/student-me').set({ score: 12 })
      );
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
    it('allows SUPER_ADMIN to read and write parent verification records', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('parent_verification_records/38501_verify').set({
          studentId: '38501',
          parentNationalIdHash: 'abc123',
          relationship: 'บิดา',
          linkedParentUid: null,
        });
      });

      await assertSucceeds(asRole('SUPER_ADMIN').firestore().doc('parent_verification_records/38501_verify').get());
      await assertSucceeds(
        asRole('SUPER_ADMIN').firestore().doc('parent_verification_records/38502_verify').set({
          studentId: '38502', parentNationalIdHash: 'def456', relationship: 'มารดา', linkedParentUid: null,
        })
      );
    });

    it('REGRESSION: denies HOMEROOM_TEACHER, EXECUTIVE, and PARENT from reading parent verification records', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('parent_verification_records/38501_verify').set({
          studentId: '38501', parentNationalIdHash: 'abc123', linkedParentUid: null,
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
      await assertSucceeds(asUser(HR_TEACHER_UID, ['HOMEROOM_TEACHER']).firestore().doc('student_portfolio_entries/e5').get());
    });
    it('denies a homeroom teacher of a different room from reading', async () => {
      await seed();
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('student_portfolio_entries/e6').set(baseEntry());
      });
      await assertFails(asUser('other-hr', ['HOMEROOM_TEACHER']).firestore().doc('student_portfolio_entries/e6').get());
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
      await assertSucceeds(asUser(HR_TEACHER_UID, ['HOMEROOM_TEACHER']).firestore().doc('student_portfolio_entries/e8').set(
        baseEntry({ status: 'APPROVED', reviewedBy: HR_TEACHER_UID, reviewedByName: 'ครูที่ปรึกษา', reviewedAt: '2026-08-03T00:00:00.000Z' })
      ));
    });
    it('REGRESSION: denies the homeroom teacher editing student-authored content while reviewing', async () => {
      await seed();
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('student_portfolio_entries/e9').set(baseEntry());
      });
      await assertFails(asUser(HR_TEACHER_UID, ['HOMEROOM_TEACHER']).firestore().doc('student_portfolio_entries/e9').set(
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
      await assertFails(asUser(HR_TEACHER_UID, ['HOMEROOM_TEACHER']).firestore().doc('student_portfolio_entries/e11').delete());
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
      await assertSucceeds(asUser(HR_TEACHER_UID, ['HOMEROOM_TEACHER']).firestore().doc(`student_home_locations/${STU_ID}`).get());
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
      await assertSucceeds(asUser(HR_TEACHER_UID, ['HOMEROOM_TEACHER']).firestore().doc('student_home_locations/never-created').get());
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
        asUser('teacher-club-uid', ['SUBJECT_TEACHER']).firestore().doc('activity_enrollments/club-1_std-e1').update({
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
        asUser('teacher-club-uid-2', ['SUBJECT_TEACHER']).firestore().doc('activity_enrollments/club-1_std-e2').update({
          removedAt: new Date().toISOString(), removedBy: 'teacher-club-uid-2', removedReason: 'ทดสอบครูร่วมสอน',
        })
      );
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
      const dbTeacher = asUser('teacher-ra-uid', ['SUBJECT_TEACHER']).firestore();
      await withdrawFromActivity({ activityId: 'club-ra', studentId: 'std-r1', removedBy: 'teacher-ra-uid', removedReason: 'ไม่ผ่านคัดเลือก นศท' }, dbTeacher as any);

      // นักเรียนคนเดิมสมัครชุมนุมอื่นที่ยังว่างได้
      await expect(
        enrollInActivity({ activityId: 'club-rb', studentId: 'std-r1', studentUid: 'r-uid-1', capacity: 5 }, dbR as any)
      ).resolves.not.toThrow();
    });
  });

  // student_screenings_2q / student_screenings_phq9 — doc id คือรหัสนักเรียน 5 หลัก ไม่ใช่ Auth UID
  // REGRESSION: isSelf(studentId) เดิมเทียบ auth.uid กับรหัส 5 หลักตรงๆ ไม่มีวันจริง แก้เป็น
  // isSelfStudent() ที่เทียบผ่าน students/{studentId}.studentUid จริงแทน
  describe('student_screenings_2q / student_screenings_phq9 collections', () => {
    const STU_UID = 'stu-uid-scr1';
    const STU_ID = 'scr-std-1';
    const OTHER_UID = 'stu-uid-scr2';

    async function seed() {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc(`students/${STU_ID}`).set({ studentId: STU_ID, studentUid: STU_UID });
      });
    }

    it('REGRESSION: lets the real student (matched via students/{id}.studentUid) write their own 2Q/PHQ-9, denies a different signed-in student', async () => {
      await seed();
      await assertSucceeds(asUser(STU_UID, ['STUDENT']).firestore().doc(`student_screenings_2q/${STU_ID}`).set({
        id: '2q-1', studentId: STU_ID, q1Depressed: false, q2Hopeless: true, isPositive: true, conductedAt: '2026-09-01',
      }));
      await assertSucceeds(asUser(STU_UID, ['STUDENT']).firestore().doc(`student_screenings_phq9/${STU_ID}`).set({
        id: 'phq-1', studentId: STU_ID, answers: [2, 2, 2, 2, 2, 2, 2, 2, 2], totalScore: 18, riskLevel: 'SEVERE',
        recommendation: 'ทดสอบ', conductedAt: '2026-09-01',
      }));
      await assertFails(asUser(OTHER_UID, ['STUDENT']).firestore().doc(`student_screenings_2q/${STU_ID}`).set({
        id: '2q-2', studentId: STU_ID, q1Depressed: false, q2Hopeless: false, isPositive: false, conductedAt: '2026-09-01',
      }));
      await assertFails(asUser(OTHER_UID, ['STUDENT']).firestore().doc(`student_screenings_phq9/${STU_ID}`).set({
        id: 'phq-2', studentId: STU_ID, answers: [0, 0, 0, 0, 0, 0, 0, 0, 0], totalScore: 0, riskLevel: 'NORMAL',
        recommendation: 'ทดสอบ', conductedAt: '2026-09-01',
      }));
    });

    it('lets GUIDANCE_COUNSELOR and HOMEROOM_TEACHER read; denies an unrelated student', async () => {
      await seed();
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc(`student_screenings_phq9/${STU_ID}`).set({
          id: 'phq-3', studentId: STU_ID, answers: [3, 3, 3, 3, 3, 3, 3, 3, 3], totalScore: 27, riskLevel: 'VERY_SEVERE',
          recommendation: 'ทดสอบ', conductedAt: '2026-09-01',
        });
      });
      await assertSucceeds(asRole('GUIDANCE_COUNSELOR').firestore().doc(`student_screenings_phq9/${STU_ID}`).get());
      await assertSucceeds(asRole('HOMEROOM_TEACHER').firestore().doc(`student_screenings_phq9/${STU_ID}`).get());
      await assertFails(asUser(OTHER_UID, ['STUDENT']).firestore().doc(`student_screenings_phq9/${STU_ID}`).get());
    });

    it('TASK 5 (ExecutivePortal Health): EXECUTIVE role อ่านได้เพื่อสรุปภาพรวมโรงเรียน (นับจำนวน ไม่ระบุตัวบุคคล)', async () => {
      await seed();
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc(`student_screenings_2q/${STU_ID}`).set({
          id: '2q-3', studentId: STU_ID, q1Depressed: true, q2Hopeless: false, isPositive: true, conductedAt: '2026-09-01',
        });
        await ctx.firestore().doc(`student_screenings_phq9/${STU_ID}`).set({
          id: 'phq-4', studentId: STU_ID, answers: [1, 1, 1, 1, 1, 1, 1, 1, 1], totalScore: 9, riskLevel: 'MODERATE',
          recommendation: 'ทดสอบ', conductedAt: '2026-09-01',
        });
      });
      await assertSucceeds(asRole('EXECUTIVE').firestore().doc(`student_screenings_2q/${STU_ID}`).get());
      await assertSucceeds(asRole('EXECUTIVE').firestore().doc(`student_screenings_phq9/${STU_ID}`).get());
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

      async function seed() {
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
          await ctx.firestore().doc(`students/${STU_ID}`).set({ studentId: STU_ID, studentUid: STU_UID, room: ROOM, parentUid: PARENT_UID });
          await ctx.firestore().doc(`staff/${HR_TEACHER_UID}`).set({ roles: ['HOMEROOM_TEACHER'], assignments: { homeroomClass: ROOM } });
          await ctx.firestore().doc('staff/other-hr').set({ roles: ['HOMEROOM_TEACHER'], assignments: { homeroomClass: 'ม.6/1' } });
        });
      }
      const sdqDoc = (over: Record<string, unknown> = {}) => ({
        id: 'x', studentId: STU_ID, studentUid: STU_UID,
        evaluatorType: 'STUDENT', evaluatorName: 'ทดสอบ',
        subscaleScores: { emotional: 1, conduct: 1, hyperactivity: 1, peerProblems: 1, prosocial: 8 },
        totalDifficultiesScore: 4, triagingStatus: 'NORMAL', assessmentDate: '2026-09-01', recommendations: [],
        ...over,
      });

      it('PATH 1: lets the student themselves create (self-eval)', async () => {
        await seed();
        await assertSucceeds(asUser(STU_UID, ['STUDENT']).firestore().doc('student_assessments_sdq/sdq-p1').set(
          sdqDoc({ id: 'sdq-p1', respondentUid: STU_UID, evaluatorType: 'STUDENT' })
        ));
      });

      it('PATH 2: lets the real linked parent (parentUid match) create', async () => {
        await seed();
        await assertSucceeds(asUser(PARENT_UID, ['PARENT']).firestore().doc('student_assessments_sdq/sdq-p2').set(
          sdqDoc({ id: 'sdq-p2', respondentUid: PARENT_UID, evaluatorType: 'PARENT', evaluatorName: 'ผู้ปกครอง' })
        ));
      });

      it('PATH 3: lets the real homeroom teacher of that room create', async () => {
        await seed();
        await assertSucceeds(asUser(HR_TEACHER_UID, ['HOMEROOM_TEACHER']).firestore().doc('student_assessments_sdq/sdq-p3').set(
          sdqDoc({ id: 'sdq-p3', respondentUid: HR_TEACHER_UID, evaluatorType: 'TEACHER', evaluatorName: 'ครูที่ปรึกษา' })
        ));
      });

      it('REGRESSION: denies a different student, a different parent, and a homeroom teacher of a different room (self-attestation alone is not enough)', async () => {
        await seed();
        await assertFails(asUser('other-student-uid', ['STUDENT']).firestore().doc('student_assessments_sdq/sdq-d1').set(
          sdqDoc({ id: 'sdq-d1', respondentUid: 'other-student-uid', evaluatorType: 'STUDENT' })
        ));
        await assertFails(asUser('other-parent-uid', ['PARENT']).firestore().doc('student_assessments_sdq/sdq-d2').set(
          sdqDoc({ id: 'sdq-d2', respondentUid: 'other-parent-uid', evaluatorType: 'PARENT', evaluatorName: 'ผู้ปกครองคนอื่น' })
        ));
        await assertFails(asUser('other-hr', ['HOMEROOM_TEACHER']).firestore().doc('student_assessments_sdq/sdq-d3').set(
          sdqDoc({ id: 'sdq-d3', respondentUid: 'other-hr', evaluatorType: 'TEACHER', evaluatorName: 'ครูห้องอื่น' })
        ));
      });

      it('denies a SUBJECT_TEACHER (not a homeroom teacher at all) from creating', async () => {
        await seed();
        await assertFails(asRole('SUBJECT_TEACHER').firestore().doc('student_assessments_sdq/sdq-d4').set(
          sdqDoc({ id: 'sdq-d4', respondentUid: 'test-uid', evaluatorType: 'TEACHER', evaluatorName: 'ครูวิชาอื่น' })
        ));
      });

      it('denies faking studentUid to a value that does not match the real student doc', async () => {
        await seed();
        await assertFails(asUser(STU_UID, ['STUDENT']).firestore().doc('student_assessments_sdq/sdq-d5').set(
          sdqDoc({ id: 'sdq-d5', studentUid: 'forged-uid', respondentUid: STU_UID, evaluatorType: 'STUDENT' })
        ));
      });

      it('denies naming someone else as respondentUid even from a legitimate relationship (self-attestation must also be honest)', async () => {
        await seed();
        await assertFails(asUser(PARENT_UID, ['PARENT']).firestore().doc('student_assessments_sdq/sdq-d6').set(
          sdqDoc({ id: 'sdq-d6', respondentUid: 'someone-else', evaluatorType: 'PARENT', evaluatorName: 'ผู้ปกครอง' })
        ));
      });

      it('only SUPER_ADMIN/GUIDANCE_COUNSELOR can update or delete an already-submitted assessment (not the original respondent)', async () => {
        await seed();
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
          await ctx.firestore().doc('student_assessments_sdq/sdq-u1').set(
            sdqDoc({ id: 'sdq-u1', respondentUid: STU_UID, evaluatorType: 'STUDENT' })
          );
        });
        await assertFails(asUser(STU_UID, ['STUDENT']).firestore().doc('student_assessments_sdq/sdq-u1').set(
          sdqDoc({ id: 'sdq-u1', respondentUid: STU_UID, evaluatorType: 'STUDENT', totalDifficultiesScore: 10 })
        ));
        await assertSucceeds(asRole('GUIDANCE_COUNSELOR').firestore().doc('student_assessments_sdq/sdq-u1').set(
          sdqDoc({ id: 'sdq-u1', respondentUid: STU_UID, evaluatorType: 'STUDENT', totalDifficultiesScore: 10 })
        ));
        await assertFails(asUser(STU_UID, ['STUDENT']).firestore().doc('student_assessments_sdq/sdq-u1').delete());
        await assertSucceeds(asRole('SUPER_ADMIN').firestore().doc('student_assessments_sdq/sdq-u1').delete());
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

      await assertFails(asRole('HOMEROOM_TEACHER').firestore().doc('guidance_counseling_cases/case-3').get());
      await assertFails(asRole('SUBJECT_TEACHER').firestore().doc('guidance_counseling_cases/case-3').get());
      await assertFails(asRole('PARENT').firestore().doc('guidance_counseling_cases/case-3').get());
      await assertFails(asUser('some-student-uid', ['STUDENT']).firestore().doc('guidance_counseling_cases/case-3').get());

      await assertFails(asRole('HOMEROOM_TEACHER').firestore().doc('guidance_counseling_cases/case-4').set(baseCase({ id: 'case-4' })));
      await assertFails(asRole('PARENT').firestore().doc('guidance_counseling_cases/case-3').set(baseCase({ status: 'RESOLVED' })));
    });

    it('lets a GUIDANCE_COUNSELOR (not just the original author) update status to RESOLVED', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc('guidance_counseling_cases/case-5').set(baseCase());
      });
      await assertSucceeds(asUser('other-counselor', ['GUIDANCE_COUNSELOR']).firestore().doc('guidance_counseling_cases/case-5').set(
        baseCase({ status: 'RESOLVED', updatedAt: '2026-09-02T00:00:00.000Z' })
      ));
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
});


