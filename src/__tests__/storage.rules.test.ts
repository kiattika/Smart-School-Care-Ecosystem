import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';

// เคารพ STORAGE_EMULATOR_HOST ที่ `firebase emulators:exec` ตั้งให้ (พอร์ตสำรอง)
const [SH_HOST, SH_PORT] = (process.env.FIREBASE_STORAGE_EMULATOR_HOST
  || process.env.STORAGE_EMULATOR_HOST
  || '127.0.0.1:9199').replace(/^https?:\/\//, '').split(':');

let testEnv: RulesTestEnvironment;

// รูปเล็ก ๆ (bytes) พร้อม content-type image/*
const tinyPng = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

// .put() คืน UploadTask (thenable แต่ไม่ใช่ Promise แท้) — assertSucceeds/assertFails ต้องการ Promise
const asPromise = <T,>(p: PromiseLike<T>): Promise<T> => Promise.resolve(p);

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'kiattisak-project-001',
    storage: {
      rules: fs.readFileSync(path.resolve(__dirname, '../../storage.rules'), 'utf8'),
      host: SH_HOST,
      port: Number(SH_PORT),
    },
  });
});

afterAll(async () => { if (testEnv) await testEnv.cleanup(); });
beforeEach(async () => { await testEnv.clearStorage(); });

describe('Storage Security Rules — student_home_photos', () => {
  it('lets the owner upload an image under their own uid prefix', async () => {
    const s = testEnv.authenticatedContext('stu-1', { roles: ['STUDENT'] }).storage();
    await assertSucceeds(asPromise(s.ref('student_home_photos/stu-1/a.jpg').put(tinyPng, { contentType: 'image/jpeg' })));
  });

  it('denies uploading under a different uid prefix', async () => {
    const s = testEnv.authenticatedContext('stu-1', { roles: ['STUDENT'] }).storage();
    await assertFails(asPromise(s.ref('student_home_photos/stu-2/a.jpg').put(tinyPng, { contentType: 'image/jpeg' })));
  });

  it('denies uploading a non-image content type', async () => {
    const s = testEnv.authenticatedContext('stu-1', { roles: ['STUDENT'] }).storage();
    await assertFails(asPromise(s.ref('student_home_photos/stu-1/notes.txt').put(new Uint8Array([1, 2, 3]), { contentType: 'text/plain' })));
  });

  it('denies an unauthenticated upload', async () => {
    const s = testEnv.unauthenticatedContext().storage();
    await assertFails(asPromise(s.ref('student_home_photos/stu-1/a.jpg').put(tinyPng, { contentType: 'image/jpeg' })));
  });

  it('lets the owner read their own file but denies another signed-in user reading it directly', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.storage().ref('student_home_photos/stu-1/a.jpg').put(tinyPng, { contentType: 'image/jpeg' });
    });
    await assertSucceeds(testEnv.authenticatedContext('stu-1', { roles: ['STUDENT'] }).storage().ref('student_home_photos/stu-1/a.jpg').getDownloadURL());
    await assertFails(testEnv.authenticatedContext('teacher-x', { roles: ['HOMEROOM_TEACHER'] }).storage().ref('student_home_photos/stu-1/a.jpg').getDownloadURL());
  });

  it('denies deleting a file via client', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.storage().ref('student_home_photos/stu-1/a.jpg').put(tinyPng, { contentType: 'image/jpeg' });
    });
    await assertFails(testEnv.authenticatedContext('stu-1', { roles: ['STUDENT'] }).storage().ref('student_home_photos/stu-1/a.jpg').delete());
  });

  it('denies writing outside the allowed folders', async () => {
    const s = testEnv.authenticatedContext('stu-1', { roles: ['STUDENT'] }).storage();
    await assertFails(asPromise(s.ref('random/x.jpg').put(tinyPng, { contentType: 'image/jpeg' })));
  });

  it('applies the same owner rules to student_portfolio_photos', async () => {
    const own = testEnv.authenticatedContext('stu-1', { roles: ['STUDENT'] }).storage();
    await assertSucceeds(asPromise(own.ref('student_portfolio_photos/stu-1/p.jpg').put(tinyPng, { contentType: 'image/jpeg' })));
    await assertFails(asPromise(own.ref('student_portfolio_photos/stu-2/p.jpg').put(tinyPng, { contentType: 'image/jpeg' })));
    await assertFails(asPromise(own.ref('student_portfolio_photos/stu-1/p.pdf').put(new Uint8Array([1]), { contentType: 'application/pdf' })));
  });
});

describe('Storage Security Rules — substitute_worksheets', () => {
  it('lets the owner (proposing teacher) upload a PDF worksheet under their own uid prefix', async () => {
    const t = testEnv.authenticatedContext('teacher-1', { roles: ['SUBJECT_TEACHER'] }).storage();
    await assertSucceeds(asPromise(t.ref('substitute_worksheets/teacher-1/worksheet.pdf').put(new Uint8Array([1, 2, 3]), { contentType: 'application/pdf' })));
  });

  it('lets the owner upload an image worksheet', async () => {
    const t = testEnv.authenticatedContext('teacher-1', { roles: ['SUBJECT_TEACHER'] }).storage();
    await assertSucceeds(asPromise(t.ref('substitute_worksheets/teacher-1/scan.jpg').put(tinyPng, { contentType: 'image/jpeg' })));
  });

  it('denies uploading under a different uid prefix', async () => {
    const t = testEnv.authenticatedContext('teacher-1', { roles: ['SUBJECT_TEACHER'] }).storage();
    await assertFails(asPromise(t.ref('substitute_worksheets/teacher-2/worksheet.pdf').put(new Uint8Array([1]), { contentType: 'application/pdf' })));
  });

  it('denies an unsupported content type (e.g. plain text)', async () => {
    const t = testEnv.authenticatedContext('teacher-1', { roles: ['SUBJECT_TEACHER'] }).storage();
    await assertFails(asPromise(t.ref('substitute_worksheets/teacher-1/notes.txt').put(new Uint8Array([1]), { contentType: 'text/plain' })));
  });

  it('denies an unauthenticated upload', async () => {
    const s = testEnv.unauthenticatedContext().storage();
    await assertFails(asPromise(s.ref('substitute_worksheets/teacher-1/worksheet.pdf').put(new Uint8Array([1]), { contentType: 'application/pdf' })));
  });

  it('lets the owner read their own file but denies another signed-in teacher reading it directly (assigned sub reads via tokenized URL from Firestore instead)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.storage().ref('substitute_worksheets/teacher-1/worksheet.pdf').put(new Uint8Array([1]), { contentType: 'application/pdf' });
    });
    await assertSucceeds(testEnv.authenticatedContext('teacher-1', { roles: ['SUBJECT_TEACHER'] }).storage().ref('substitute_worksheets/teacher-1/worksheet.pdf').getDownloadURL());
    await assertFails(testEnv.authenticatedContext('teacher-2', { roles: ['SUBJECT_TEACHER'] }).storage().ref('substitute_worksheets/teacher-1/worksheet.pdf').getDownloadURL());
  });

  it('denies deleting a file via client', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.storage().ref('substitute_worksheets/teacher-1/worksheet.pdf').put(new Uint8Array([1]), { contentType: 'application/pdf' });
    });
    await assertFails(testEnv.authenticatedContext('teacher-1', { roles: ['SUBJECT_TEACHER'] }).storage().ref('substitute_worksheets/teacher-1/worksheet.pdf').delete());
  });
});
