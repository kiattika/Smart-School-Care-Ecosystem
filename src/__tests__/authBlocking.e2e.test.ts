import { describe, it, expect, beforeAll } from 'vitest';
import { initializeApp as initClientApp, deleteApp } from 'firebase/app';
import {
  getAuth as getClientAuth,
  connectAuthEmulator,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { initializeApp as initAdminApp, getApps } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { describeAuthError } from '../lib/authErrors';
import { DENY_MESSAGES } from '../../functions/src/access';
import { SELF_DEMOTION_MESSAGE, DEACTIVATE_SELF_MESSAGE } from '../../functions/src/roleGuards';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';
import authTestConfig from '../../firebase.authtest.json';

/**
 * E2E ของ blocking functions (beforeCreate/beforeSignIn) บน Auth + Functions + Firestore emulator จริง
 * รันด้วย `npm run emulators:exec:auth` (firebase.authtest.json พอร์ตแยก 9399/8299/5299 —
 * ไม่ชน emulator หลัก). รัน vitest ธรรมดา (ไม่มี emulator) = skip
 */
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const FS_HOST = process.env.FIRESTORE_EMULATOR_HOST;
const PROJECT_ID = 'kiattisak-project-001';
const FS_BASE = `http://${FS_HOST}/v1/projects/${PROJECT_ID}/databases/${firebaseConfig.firestoreDatabaseId}/documents`;
const PASSWORD = 'test1234';

function toValue(v: unknown): unknown {
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  if (typeof v === 'string') return { stringValue: v };
  if (v && typeof v === 'object') {
    return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toValue(x)])) } };
  }
  return { nullValue: null };
}

// เขียนผ่าน REST (admin SDK เขียน named DB ของ emulator แล้ว lock ค้าง — ดู seedEmulatorAuth.ts)
async function fsPut(path: string, data: Record<string, unknown>) {
  const fields = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, toValue(v)]));
  const res = await fetch(`${FS_BASE}/${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`fsPut ${path}: ${res.status} ${await res.text()}`);
}

async function fsGetField(path: string, field: string): Promise<string | undefined> {
  const res = await fetch(`${FS_BASE}/${path}`, { headers: { Authorization: 'Bearer owner' } });
  if (!res.ok) return undefined;
  const json = await res.json();
  return json.fields?.[field]?.stringValue;
}

describe.skipIf(!AUTH_HOST || !FS_HOST)('auth blocking functions (emulator E2E)', () => {
  const clientApp = initClientApp({ apiKey: 'emulator-key', projectId: PROJECT_ID, authDomain: `${PROJECT_ID}.firebaseapp.com` }, 'e2e');
  const clientAuth = getClientAuth(clientApp);
  let studentUid = '';

  beforeAll(async () => {
    connectAuthEmulator(clientAuth, `http://${AUTH_HOST}`, { disableWarnings: true });
    if (!getApps().length) initAdminApp({ projectId: PROJECT_ID });
    const adminAuth = getAdminAuth();

    await fsPut('staff/teacher-07', { email: 'hr.e2e@utd.ac.th', roles: ['HOMEROOM_TEACHER', 'SUBJECT_TEACHER'] });
    await fsPut('staff/teacher-08', { email: 'noroles.e2e@utd.ac.th', roles: [] });
    await fsPut('students/38599', { studentId: '38599', name: 'นักเรียน E2E' });

    // admin SDK createUser ไม่ผ่าน beforeCreate (เหมือน production) — ใช้สร้างบัญชีที่ verify แล้ว
    for (const email of ['hr.e2e@utd.ac.th', 'noroles.e2e@utd.ac.th', 'it38599@utd.ac.th', 'outsider.e2e@gmail.com', 'nobody.e2e@utd.ac.th']) {
      const u = await adminAuth.createUser({ email, password: PASSWORD, emailVerified: true });
      if (email.startsWith('it38599')) studentUid = u.uid;
    }
  }, 60_000);

  async function signInError(email: string): Promise<unknown> {
    try {
      await signInWithEmailAndPassword(clientAuth, email, PASSWORD);
    } catch (err) {
      return err;
    }
    await signOut(clientAuth);
    throw new Error(`expected sign-in of ${email} to be rejected`);
  }

  it('staff: issues {roles, primaryRole, staffId} from staff/{teacherId}', async () => {
    const cred = await signInWithEmailAndPassword(clientAuth, 'hr.e2e@utd.ac.th', PASSWORD);
    const { claims } = await cred.user.getIdTokenResult(true);
    expect(claims.roles).toEqual(['HOMEROOM_TEACHER', 'SUBJECT_TEACHER']);
    expect(claims.primaryRole).toBe('HOMEROOM_TEACHER');
    expect(claims.staffId).toBe('teacher-07');
    await signOut(clientAuth);
  });

  it('student (it{studentId} pattern): issues {roles:[STUDENT], studentId} and links students/{id}.studentUid', async () => {
    const cred = await signInWithEmailAndPassword(clientAuth, 'it38599@utd.ac.th', PASSWORD);
    const { claims } = await cred.user.getIdTokenResult(true);
    expect(claims.roles).toEqual(['STUDENT']);
    expect(claims.studentId).toBe('38599');
    expect(claims.staffId).toBeUndefined();
    expect(await fsGetField('students/38599', 'studentUid')).toBe(studentUid);
    await signOut(clientAuth);
  });

  it('rejects a non-utd.ac.th account with the Thai message, readable via describeAuthError', async () => {
    const err = await signInError('outsider.e2e@gmail.com');
    expect(describeAuthError(err)).toBe(DENY_MESSAGES.DOMAIN_NOT_ALLOWED);
  });

  it('rejects a staff member with empty roles and an unregistered @utd.ac.th account', async () => {
    expect(describeAuthError(await signInError('noroles.e2e@utd.ac.th'))).toBe(DENY_MESSAGES.STAFF_NO_ROLES);
    expect(describeAuthError(await signInError('nobody.e2e@utd.ac.th'))).toBe(DENY_MESSAGES.NOT_REGISTERED);
  });

  it('beforeCreate rejects self sign-up (email/password = unverified email)', async () => {
    let err: unknown;
    try {
      await createUserWithEmailAndPassword(clientAuth, 'selfsignup.e2e@utd.ac.th', PASSWORD);
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(describeAuthError(err)).toBe(DENY_MESSAGES.EMAIL_NOT_VERIFIED);
    await deleteApp(clientApp);
  });
});

/** roles (array of string) ของ doc ผ่าน REST */
async function fsGetRoles(path: string): Promise<string[] | undefined> {
  const res = await fetch(`${FS_BASE}/${path}`, { headers: { Authorization: 'Bearer owner' } });
  if (!res.ok) return undefined;
  const json = await res.json();
  return (json.fields?.roles?.arrayValue?.values ?? []).map((v: { stringValue: string }) => v.stringValue);
}

/**
 * assignUserRole (callable) บน Functions emulator — SUPER_ADMIN ห้ามถอน SUPER_ADMIN ของตัวเอง
 * (กฎ pure function ทดสอบละเอียดใน roleGuards.test.ts; ตรงนี้ยืนยันว่า callable จริงบังคับใช้ และไม่เขียนอะไรเลย)
 */
describe.skipIf(!AUTH_HOST || !FS_HOST)('assignUserRole self-demotion guard (emulator E2E)', () => {
  const app = initClientApp({ apiKey: 'emulator-key', projectId: PROJECT_ID, authDomain: `${PROJECT_ID}.firebaseapp.com` }, 'e2e-roles');
  const clientAuth = getClientAuth(app);
  const fns = getFunctions(app, 'us-central1');
  const assignUserRole = httpsCallable(fns, 'assignUserRole');

  beforeAll(async () => {
    connectAuthEmulator(clientAuth, `http://${AUTH_HOST}`, { disableWarnings: true });
    connectFunctionsEmulator(fns, '127.0.0.1', authTestConfig.emulators.functions.port);
    if (!getApps().length) initAdminApp({ projectId: PROJECT_ID });

    await fsPut('staff/admin-01', { email: 'admin.e2e@utd.ac.th', roles: ['SUPER_ADMIN', 'SUBJECT_TEACHER'] });
    await fsPut('staff/teacher-09', { email: 't9.e2e@utd.ac.th', roles: ['SUBJECT_TEACHER'] }); // ยังไม่เคย login
    await getAdminAuth().createUser({ email: 'admin.e2e@utd.ac.th', password: PASSWORD, emailVerified: true });

    const cred = await signInWithEmailAndPassword(clientAuth, 'admin.e2e@utd.ac.th', PASSWORD);
    const { claims } = await cred.user.getIdTokenResult(true);
    expect(claims.staffId).toBe('admin-01');
    expect(claims.roles).toContain('SUPER_ADMIN');
  }, 60_000);

  async function callError(data: Record<string, unknown>): Promise<{ code?: string; message?: string }> {
    try {
      await assignUserRole(data);
    } catch (err) {
      return err as { code?: string; message?: string };
    }
    throw new Error(`expected assignUserRole(${JSON.stringify(data)}) to be rejected`);
  }

  it('rejects removing SUPER_ADMIN from yourself (and an empty role list) without writing anything', async () => {
    for (const roles of [['SUBJECT_TEACHER'], []]) {
      const err = await callError({ staffId: 'admin-01', roles });
      expect(err.code).toBe('functions/failed-precondition');
      // client SDK ต่อท้ายด้วยรหัส HTTP (เช่น ' [400]') — ข้อความจาก server ต้องอยู่ครบ
      expect(err.message).toContain(SELF_DEMOTION_MESSAGE);
    }
    expect(await fsGetRoles('staff/admin-01')).toEqual(['SUPER_ADMIN', 'SUBJECT_TEACHER']);
  });

  it('still lets a SUPER_ADMIN change another staff member (never logged in → staff.roles only)', async () => {
    const res = await assignUserRole({ staffId: 'teacher-09', roles: ['HOMEROOM_TEACHER'] });
    expect(res.data).toMatchObject({ success: true, staffId: 'teacher-09', targetUid: null });
    expect(await fsGetRoles('staff/teacher-09')).toEqual(['HOMEROOM_TEACHER']);
  });

  it('allows changing your own other roles as long as SUPER_ADMIN stays', async () => {
    const res = await assignUserRole({ staffId: 'admin-01', roles: ['SUPER_ADMIN', 'EXECUTIVE'] });
    expect(res.data).toMatchObject({ success: true, staffId: 'admin-01' });
    expect(await fsGetRoles('staff/admin-01')).toEqual(['SUPER_ADMIN', 'EXECUTIVE']);
    await signOut(clientAuth);
    await deleteApp(app);
  });
});

/**
 * createStaffMember + setStaffActive บน Functions emulator จริง — บัญชีที่ถูกปิดการใช้งาน login ไม่ได้
 * (blocking function ปฏิเสธด้วย STAFF_INACTIVE) และเปิดใช้งานแล้วกลับมา login ได้
 */
describe.skipIf(!AUTH_HOST || !FS_HOST)('staff create / deactivate / reactivate (emulator E2E)', () => {
  const adminApp = initClientApp({ apiKey: 'emulator-key', projectId: PROJECT_ID, authDomain: `${PROJECT_ID}.firebaseapp.com` }, 'e2e-staff-admin');
  const adminAuth = getClientAuth(adminApp);
  const fns = getFunctions(adminApp, 'us-central1');
  const createStaffMember = httpsCallable(fns, 'createStaffMember');
  const setStaffActive = httpsCallable(fns, 'setStaffActive');
  const assignUserRoleFn = httpsCallable(fns, 'assignUserRole');
  // บัญชีของบุคลากรที่ถูกสร้าง/ปิด — app แยก ไม่ให้กระทบ session ของ admin
  const targetApp = initClientApp({ apiKey: 'emulator-key', projectId: PROJECT_ID, authDomain: `${PROJECT_ID}.firebaseapp.com` }, 'e2e-staff-target');
  const targetAuth = getClientAuth(targetApp);
  const TARGET_EMAIL = 't55.e2e@utd.ac.th';

  beforeAll(async () => {
    connectAuthEmulator(adminAuth, `http://${AUTH_HOST}`, { disableWarnings: true });
    connectAuthEmulator(targetAuth, `http://${AUTH_HOST}`, { disableWarnings: true });
    connectFunctionsEmulator(fns, '127.0.0.1', authTestConfig.emulators.functions.port);
    if (!getApps().length) initAdminApp({ projectId: PROJECT_ID });

    await fsPut('staff/admin-77', { email: 'admin77.e2e@utd.ac.th', roles: ['SUPER_ADMIN'] });
    await getAdminAuth().createUser({ email: 'admin77.e2e@utd.ac.th', password: PASSWORD, emailVerified: true });
    const cred = await signInWithEmailAndPassword(adminAuth, 'admin77.e2e@utd.ac.th', PASSWORD);
    expect((await cred.user.getIdTokenResult(true)).claims.staffId).toBe('admin-77');
  }, 60_000);

  async function callError(fn: typeof setStaffActive, data: Record<string, unknown>) {
    try { await fn(data); } catch (err) { return err as { code?: string; message?: string }; }
    throw new Error(`expected ${JSON.stringify(data)} to be rejected`);
  }

  async function targetSignIn(): Promise<{ ok: true; staffId: unknown } | { ok: false; err: unknown }> {
    try {
      const cred = await signInWithEmailAndPassword(targetAuth, TARGET_EMAIL, PASSWORD);
      const { claims } = await cred.user.getIdTokenResult(true);
      await signOut(targetAuth);
      return { ok: true, staffId: claims.staffId };
    } catch (err) {
      return { ok: false, err };
    }
  }

  it('createStaffMember writes staff + teachers (status ACTIVE) and rejects a duplicate id', async () => {
    const res = await createStaffMember({
      staffId: 'teacher-55', email: ' T55.e2e@UTD.ac.th ', roles: ['SUBJECT_TEACHER'],
      prefix: 'นาย', firstName: 'ทดสอบ', lastName: 'ปิดใช้งาน', position: 'ครู',
    });
    expect(res.data).toMatchObject({ success: true, staffId: 'teacher-55', email: TARGET_EMAIL });
    expect(await fsGetField('staff/teacher-55', 'status')).toBe('ACTIVE');
    expect(await fsGetField('staff/teacher-55', 'email')).toBe(TARGET_EMAIL);
    expect(await fsGetField('teachers/teacher-55', 'status')).toBe('ACTIVE');

    const dup = await callError(createStaffMember, { staffId: 'teacher-55', email: 'other.e2e@utd.ac.th', roles: ['SUBJECT_TEACHER'], firstName: 'ก', lastName: 'ข' });
    expect(dup.code).toBe('functions/already-exists');
    const dupEmail = await callError(createStaffMember, { staffId: 'teacher-56', email: TARGET_EMAIL, roles: ['SUBJECT_TEACHER'], firstName: 'ก', lastName: 'ข' });
    expect(dupEmail.code).toBe('functions/already-exists');
  });

  it('the new staff member can log in (claims staffId = teacher-55)', async () => {
    await getAdminAuth().createUser({ email: TARGET_EMAIL, password: PASSWORD, emailVerified: true });
    expect(await targetSignIn()).toEqual({ ok: true, staffId: 'teacher-55' });
  });

  it('a SUPER_ADMIN cannot deactivate themselves', async () => {
    const err = await callError(setStaffActive, { staffId: 'admin-77', active: false, reason: 'ทดสอบ' });
    expect(err.code).toBe('functions/failed-precondition');
    expect(err.message).toContain(DEACTIVATE_SELF_MESSAGE);
    expect(await fsGetField('staff/admin-77', 'status')).toBeUndefined();
  });

  it('deactivated: status INACTIVE + reason, claims cleared, login rejected with STAFF_INACTIVE, roles cannot be changed', async () => {
    await setStaffActive({ staffId: 'teacher-55', active: false, reason: 'ย้ายไปโรงเรียนอื่น' });
    expect(await fsGetField('staff/teacher-55', 'status')).toBe('INACTIVE');
    expect(await fsGetField('staff/teacher-55', 'deactivationReason')).toBe('ย้ายไปโรงเรียนอื่น');
    const user = await getAdminAuth().getUserByEmail(TARGET_EMAIL);
    expect(user.customClaims ?? {}).toEqual({});

    const login = await targetSignIn();
    expect(login.ok).toBe(false);
    expect(login.ok === false && describeAuthError(login.err)).toBe(DENY_MESSAGES.STAFF_INACTIVE);

    const roleErr = await callError(assignUserRoleFn, { staffId: 'teacher-55', roles: ['HOMEROOM_TEACHER'] });
    expect(roleErr.code).toBe('functions/failed-precondition');
  });

  it('reactivated: status ACTIVE and the staff member can log in again', async () => {
    await setStaffActive({ staffId: 'teacher-55', active: true, reason: '' });
    expect(await fsGetField('staff/teacher-55', 'status')).toBe('ACTIVE');
    expect(await fsGetField('staff/teacher-55', 'deactivationReason')).toBeUndefined();
    expect(await targetSignIn()).toEqual({ ok: true, staffId: 'teacher-55' });
    await signOut(adminAuth);
    await deleteApp(targetApp);
    await deleteApp(adminApp);
  });
});

async function fsDelete(path: string) {
  const res = await fetch(`${FS_BASE}/${path}`, { method: 'DELETE', headers: { Authorization: 'Bearer owner' } });
  if (!res.ok && res.status !== 404) throw new Error(`fsDelete ${path}: ${res.status} ${await res.text()}`);
}

/**
 * school_settings/studentEmailFormat บน emulator จริง — blocking function อ่าน config ตอน login ทุกครั้ง:
 * ไม่มี doc = it / utd.ac.th, ตั้งค่าใหม่มีผลทันที (prefix และโดเมนอื่น), ค่าเสีย = กลับไปค่าเริ่มต้น (ไม่พัง)
 */
describe.skipIf(!AUTH_HOST || !FS_HOST)('student email format config (emulator E2E)', () => {
  const app = initClientApp({ apiKey: 'emulator-key', projectId: PROJECT_ID, authDomain: `${PROJECT_ID}.firebaseapp.com` }, 'e2e-fmt');
  const auth = getClientAuth(app);
  const CFG = 'school_settings/studentEmailFormat';

  beforeAll(async () => {
    connectAuthEmulator(auth, `http://${AUTH_HOST}`, { disableWarnings: true });
    if (!getApps().length) initAdminApp({ projectId: PROJECT_ID });
    // นักเรียนทดสอบ (ไม่มี field email — จับคู่ด้วยรูปแบบอย่างเดียว)
    for (const id of ['38700', '38701', '38702']) await fsPut(`students/${id}`, { studentId: id, name: `นักเรียน ${id}` });
    for (const email of ['it38700@utd.ac.th', 's38701@student.utd.ac.th', 'it38702@utd.ac.th', 'it38700@student.utd.ac.th']) {
      await getAdminAuth().createUser({ email, password: PASSWORD, emailVerified: true });
    }
    await fsDelete(CFG);
  }, 60_000);

  async function tryLogin(email: string): Promise<{ ok: true; studentId: unknown } | { ok: false; message: string }> {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, PASSWORD);
      const { claims } = await cred.user.getIdTokenResult(true);
      await signOut(auth);
      return { ok: true, studentId: claims.studentId };
    } catch (err) {
      return { ok: false, message: describeAuthError(err) };
    }
  }

  it('no config doc → the original it{id}@utd.ac.th pattern; other domains are refused', async () => {
    expect(await tryLogin('it38700@utd.ac.th')).toEqual({ ok: true, studentId: '38700' });
    expect(await tryLogin('it38700@student.utd.ac.th')).toEqual({ ok: false, message: DENY_MESSAGES.DOMAIN_NOT_ALLOWED });
  });

  it('after the admin saves a new format it applies at once: new prefix + domain log in, the old pattern no longer does', async () => {
    await fsPut(CFG, { prefix: 's', domain: 'student.utd.ac.th' });
    expect(await tryLogin('s38701@student.utd.ac.th')).toEqual({ ok: true, studentId: '38701' });
    expect(await tryLogin('it38702@utd.ac.th')).toEqual({ ok: false, message: DENY_MESSAGES.NOT_REGISTERED });
    expect(await tryLogin('it38700@student.utd.ac.th')).toEqual({ ok: false, message: DENY_MESSAGES.NOT_REGISTERED });
  });

  it('a malformed stored value does not break login — it falls back to the default format', async () => {
    await fsPut(CFG, { prefix: 'Bad Prefix!', domain: '@nope' });
    expect(await tryLogin('it38700@utd.ac.th')).toEqual({ ok: true, studentId: '38700' });
    expect(await tryLogin('s38701@student.utd.ac.th')).toEqual({ ok: false, message: DENY_MESSAGES.DOMAIN_NOT_ALLOWED });
  });

  it('deleting the doc restores the default behaviour', async () => {
    await fsDelete(CFG);
    expect(await tryLogin('it38700@utd.ac.th')).toEqual({ ok: true, studentId: '38700' });
    expect(await tryLogin('s38701@student.utd.ac.th')).toEqual({ ok: false, message: DENY_MESSAGES.DOMAIN_NOT_ALLOWED });
    await deleteApp(app);
  });
});
