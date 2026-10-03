import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { readSource } from './helpers/readSource';

/**
 * Region ของ Cloud Functions (ดู CLAUDE.md — โควตา Cloud Run "Number of regions" เต็ม 3/3)
 * - blocking functions (รุ่นที่ 2 = Cloud Run) ต้องอยู่ asia-southeast1 — us-central1 ล้มด้วย ProjectInitFailedQuotaExceeded
 * - assignUserRole (รุ่นแรก) และ client ที่เรียกมัน อยู่ us-central1 (ค่าเริ่มต้น) ตามเดิม
 */
const root = path.resolve(__dirname, '../..');
const src = (rel: string) => readSource(path.join(root, rel));

describe('Cloud Functions regions', () => {
  it('blocking functions (beforeCreate / beforeSignIn) deploy to asia-southeast1', () => {
    const s = src('functions/src/authBlocking.ts');
    expect(s).toContain("const BLOCKING_OPTS = { region: 'asia-southeast1', timeoutSeconds: 7 } as const;");
    expect(s).toContain('beforeUserCreated(BLOCKING_OPTS, grantAccess)');
    expect(s).toContain('beforeUserSignedIn(BLOCKING_OPTS, grantAccess)');
    expect(s).not.toContain("region: 'us-central1'");
  });

  it('assignUserRole stays a default-region (us-central1) v1 callable', () => {
    const s = src('functions/src/setUserRole.ts');
    expect(s).toContain('export const assignUserRole = functions.https.onCall(');
    expect(s).not.toMatch(/\.region\(|region:/);
  });

  it('createStaffMember / setStaffActive are default-region v1 callables too (no Cloud Run in us-central1)', () => {
    const s = src('functions/src/staffAdmin.ts');
    expect(s).toMatch(/^import \* as functions from 'firebase-functions\/v1';$/m);
    expect(s).not.toMatch(/from 'firebase-functions';|from 'firebase-functions\/v2/);
    expect(s).toContain('export const createStaffMember = functions.https.onCall(');
    expect(s).toContain('export const setStaffActive = functions.https.onCall(');
    expect(s).not.toMatch(/\.region\(|region:/);
  });

  it('every exported function is listed in the deploy command', () => {
    const exported = (src('functions/src/index.ts').match(/export \{([^}]+)\}/g) || [])
      .flatMap((m) => m.replace(/export \{|\}/g, '').split(',').map((x) => x.trim()).filter(Boolean));
    const pkg = JSON.parse(src('functions/package.json'));
    const deployed = String(pkg.scripts.deploy).replace('firebase deploy --only ', '').split(',').map((x) => x.replace('functions:', ''));
    expect([...exported].sort()).toEqual([...deployed].sort());
  });

  it('the client calls functions in the default region (us-central1)', () => {
    expect(src('src/lib/firebase.ts')).toContain('export const functions = getFunctions(app);');
  });
});

/**
 * Runtime + SDK ของ Cloud Functions (ดู CLAUDE.md)
 * - Node 22: Node 20 ถูกปิด 30 ต.ค. 2026; Node 24 รองรับเฉพาะรุ่นที่ 2 แต่ assignUserRole เป็นรุ่นแรก
 * - firebase-functions >= 7.2.2: รุ่นเก่ากว่าปฏิเสธ blocking token ที่ aud เป็น *.cloudfunctions.net
 *   (Firebase CLI ใช้ตอนสร้าง trigger ครั้งแรก) → ทุกคน login ไม่ได้ (auth/error-code:-47) เคยเกิดบน production
 * - ตั้งแต่ v6 `import 'firebase-functions'` = v2 → assignUserRole ต้อง import จาก 'firebase-functions/v1'
 */
describe('Cloud Functions runtime + SDK', () => {
  const pkg = JSON.parse(src('functions/package.json'));
  const lock = JSON.parse(src('functions/package-lock.json'));

  const atLeast = (version: string, min: string) => {
    const a = version.split('.').map(Number);
    const b = min.split('.').map(Number);
    for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
    return true;
  };

  it('runs on Node 22 (not 20 = retired, not 24 = 2nd gen only)', () => {
    expect(pkg.engines.node).toBe('22');
    expect(lock.packages[''].engines.node).toBe('22');
  });

  it('locks firebase-functions >= 7.2.2 (accepts cloudfunctions.net blocking-token audience)', () => {
    expect(pkg.dependencies['firebase-functions']).toBe('^7.4.0');
    const locked = lock.packages['node_modules/firebase-functions'].version as string;
    expect(atLeast(locked, '7.2.2'), `locked firebase-functions ${locked}`).toBe(true);
  });

  it('assignUserRole imports the v1 SDK explicitly; blocking functions use v2 identity', () => {
    expect(src('functions/src/setUserRole.ts')).toMatch(/^import \* as functions from 'firebase-functions\/v1';$/m);
    expect(src('functions/src/setUserRole.ts')).not.toMatch(/from 'firebase-functions';/);
    expect(src('functions/src/authBlocking.ts')).toContain("from 'firebase-functions/v2/identity';");
  });

  it('blocking handler fails closed when the event has no user data (v7: event.data is optional)', () => {
    const s = src('functions/src/authBlocking.ts');
    expect(s).toContain('const user = blockingUserFromEvent(event.data);');
    expect(s).toContain("throw new HttpsError('permission-denied', DENY_MESSAGES.INCOMPLETE_EVENT);");
    expect(s).not.toContain('= event.data;');
  });

  it('deploy script names every function (never bare --only functions)', () => {
    expect(pkg.scripts.deploy).toBe('firebase deploy --only functions:assignUserRole,functions:createStaffMember,functions:setStaffActive,functions:beforeCreate,functions:beforeSignIn');
  });
});
