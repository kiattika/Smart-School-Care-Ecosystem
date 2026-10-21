import { describe, it, expect } from 'vitest';
import * as path from 'path';
import {
  hmacNationalId, hashesEqual, isValidThaiNationalId, verifyLineIdToken, nextFailedState, isLocked,
  MAX_FAILED_ATTEMPTS, LOCK_MINUTES, parentUidForLine, LINE_VERIFY_URL, FetchLike,
} from '../../functions/src/parentLineLogic';
import { readSource } from './helpers/readSource';

const VALID_ID = '1101700230708'; // checksum ถูกต้อง

describe('parent national id', () => {
  it('validates 13-digit checksum, ignoring spaces/dashes', () => {
    expect(isValidThaiNationalId(VALID_ID)).toBe(true);
    expect(isValidThaiNationalId('1-1017-00230-70-8')).toBe(true);
    expect(isValidThaiNationalId('1101700230709')).toBe(false);
    expect(isValidThaiNationalId('123')).toBe(false);
    expect(isValidThaiNationalId(undefined)).toBe(false);
  });

  it('HMAC depends on pepper, is stable, and never contains the raw id', () => {
    const a = hmacNationalId(VALID_ID, 'pepper-1');
    expect(a).toBe(hmacNationalId('1-1017-00230-70-8', 'pepper-1'));
    expect(a).not.toBe(hmacNationalId(VALID_ID, 'pepper-2'));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toContain(VALID_ID);
    expect(() => hmacNationalId(VALID_ID, '')).toThrow();
  });

  it('hashesEqual compares exactly and rejects empty', () => {
    expect(hashesEqual('abc', 'abc')).toBe(true);
    expect(hashesEqual('abc', 'abd')).toBe(false);
    expect(hashesEqual('abc', 'ab')).toBe(false);
    expect(hashesEqual('', '')).toBe(false);
  });
});

describe('verifyLineIdToken', () => {
  const ok = (body: any): FetchLike => async () => ({ ok: true, status: 200, json: async () => body });
  it('returns identity when LINE accepts and aud matches; posts form to verify endpoint', async () => {
    let seen: any;
    const f: FetchLike = async (url, init) => { seen = { url, init }; return { ok: true, status: 200, json: async () => ({ sub: 'U123', aud: 'chan', exp: 2000, name: 'พ่อ' }) }; };
    const id = await verifyLineIdToken('tok', 'chan', f, 1000);
    expect(id).toEqual({ sub: 'U123', name: 'พ่อ', picture: undefined });
    expect(seen.url).toBe(LINE_VERIFY_URL);
    expect(seen.init.body).toContain('id_token=tok');
    expect(seen.init.body).toContain('client_id=chan');
  });
  it('rejects non-ok, wrong aud, expired, missing sub, and missing config', async () => {
    await expect(verifyLineIdToken('t', 'c', async () => ({ ok: false, status: 400, json: async () => ({}) }))).rejects.toThrow('LINE_TOKEN_INVALID');
    await expect(verifyLineIdToken('t', 'c', ok({ sub: 'U', aud: 'other', exp: 9e9 }))).rejects.toThrow('LINE_TOKEN_INVALID');
    await expect(verifyLineIdToken('t', 'c', ok({ sub: 'U', aud: 'c', exp: 1 }), 1000)).rejects.toThrow('LINE_TOKEN_INVALID');
    await expect(verifyLineIdToken('t', 'c', ok({ aud: 'c', exp: 9e9 }))).rejects.toThrow('LINE_TOKEN_INVALID');
    await expect(verifyLineIdToken('t', '', ok({}))).rejects.toThrow('LINE_NOT_CONFIGURED');
  });
});

describe('failed-attempt lock', () => {
  it('locks after MAX_FAILED_ATTEMPTS and unlocks after LOCK_MINUTES', () => {
    let s = null as ReturnType<typeof nextFailedState> | null;
    const t0 = 1_000_000;
    for (let i = 1; i < MAX_FAILED_ATTEMPTS; i++) {
      s = nextFailedState(s, t0);
      expect(isLocked(s, t0)).toBe(false);
      expect(s.failedCount).toBe(i);
    }
    s = nextFailedState(s, t0);
    expect(isLocked(s, t0)).toBe(true);
    expect(isLocked(s, t0 + LOCK_MINUTES * 60_000 - 1)).toBe(true);
    expect(isLocked(s, t0 + LOCK_MINUTES * 60_000)).toBe(false);
    expect(nextFailedState(s, t0 + LOCK_MINUTES * 60_000).failedCount).toBe(1);
  });
});

describe('parentLine callables (source guards)', () => {
  const src = readSource(path.resolve(__dirname, '../../functions/src/parentLine.ts'));
  it('are default-region v1 callables with secrets and exported', () => {
    expect(src).toMatch(/^import \* as functions from 'firebase-functions\/v1';$/m);
    expect(src).not.toMatch(/\.region\(|region:/);
    for (const n of ['importParentVerification', 'linkParentLine', 'signInParentLine', 'unlinkParentLine']) {
      expect(src).toContain(`export const ${n} =`);
      expect(readSource(path.resolve(__dirname, '../../functions/src/index.ts'))).toContain(n);
      expect(readSource(path.resolve(__dirname, '../../functions/package.json'))).toContain(`functions:${n}`);
    }
    expect(src).toContain("secrets: ['LINE_CHANNEL_ID', 'PARENT_ID_PEPPER']");
  });
  it('admin callables require SUPER_ADMIN; sign-in re-checks students.parentUid; never stores raw id', () => {
    expect(src.match(/requireSuperAdmin\(context\)/g)?.length).toBe(3); // import + unlink + setStudentParent
    expect(src).toContain("where('parentUid', '==', uid)");
    expect(src).not.toMatch(/parentNationalId:\s*(r\.|nationalId)/);
    expect(parentUidForLine('U1')).toBe('line_U1');
  });
  it('client no longer writes parent_verification_records or hashes ids itself', () => {
    const modal = readSource(path.resolve(__dirname, '../components/BulkDataImportModal.tsx'));
    expect(modal).not.toContain("'parent_verification_records'");
    expect(modal).not.toContain('sha256Hex');
    expect(modal).toContain('importParentRecords(parentImportRecords)');
  });
});
