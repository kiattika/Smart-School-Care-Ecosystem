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

