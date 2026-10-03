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

  it('the client calls functions in the default region (us-central1)', () => {
    expect(src('src/lib/firebase.ts')).toContain('export const functions = getFunctions(app);');
  });
});
