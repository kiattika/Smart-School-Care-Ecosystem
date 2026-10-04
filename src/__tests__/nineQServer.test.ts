import { describe, it, expect } from 'vitest';
import * as path from 'path';
import {
  bangkokDate,
  buildNineQDocs,
  classifyNineQ as serverClassify,
  decideNineQCaller,
  parseNineQRequest,
  pickNineQBasis as serverPick,
  scoreNineQAnswers,
} from '../../functions/src/nineQ';
import { classifyNineQ as clientClassify, pickNineQBasis as clientPick, scoreNineQ as clientScore, NineQAnswers } from '../lib/depressionScreening';
import { readSource } from './helpers/readSource';

/**
 * 9Q ฝั่งเซิร์ฟเวอร์ (functions/src/nineQ.ts) — callable submitNineQ เป็นทางเดียวที่เขียนผล 9Q ได้ (TODO-3):
 * เซิร์ฟเวอร์คำนวณระดับ/ธงแดงเองจากคำตอบดิบ ไม่เชื่อค่าที่ client ส่ง
 */
const all = (v: number) => Array(9).fill(v) as number[];

describe('server scoring (same rules as the client copy: <7 NONE, 7-12 MILD, 13-18 MODERATE, ≥19 SEVERE; red flag = item 9 > 0)', () => {
  it('classifies every total 0..27 exactly like the client', () => {
    for (let n = 0; n <= 27; n++) expect(serverClassify(n), `total=${n}`).toBe(clientClassify(n));
    expect([6, 7, 12, 13, 18, 19].map(serverClassify)).toEqual(['NONE', 'MILD', 'MILD', 'MODERATE', 'MODERATE', 'SEVERE']);
  });

  it('scores whole sheets: all 0 / 1 / 2 / 3', () => {
    expect(scoreNineQAnswers(all(0))).toMatchObject({ totalScore: 0, riskLevel: 'NONE', redFlagItem9: false });
    expect(scoreNineQAnswers(all(1))).toMatchObject({ totalScore: 9, riskLevel: 'MILD', redFlagItem9: true });
    expect(scoreNineQAnswers(all(2))).toMatchObject({ totalScore: 18, riskLevel: 'MODERATE' });
    expect(scoreNineQAnswers(all(3))).toMatchObject({ totalScore: 27, riskLevel: 'SEVERE' });
  });

  it('item 9 red flag is independent of the total (the attack: answer item 9 but claim no red flag is now impossible)', () => {
    expect(scoreNineQAnswers([0, 0, 0, 0, 0, 0, 0, 0, 1])).toMatchObject({ totalScore: 1, riskLevel: 'NONE', redFlagItem9: true });
    expect(scoreNineQAnswers([3, 3, 3, 3, 3, 3, 3, 3, 0])).toMatchObject({ totalScore: 24, riskLevel: 'SEVERE', redFlagItem9: false });
  });

  it('rejects incomplete / malformed answers (never half-calculated)', () => {
    for (const bad of [null, undefined, 'x', {}, [], [1, 2, 3], all(1).slice(0, 8), [...all(1), 1], [0, 0, 0, 0, 0, 0, 0, 0, 4], [0, 0, 0, 0, 0, 0, 0, 0, -1], [0, 0, 0, 0, 0, 0, 0, 0, 1.5], [0, 0, 0, 0, 0, 0, 0, 0, '1'], [0, 0, 0, 0, 0, 0, 0, 0, null]]) {
      expect(scoreNineQAnswers(bad), JSON.stringify(bad)).toBeNull();
    }
  });

  it('matches the client scoring for random sheets (client and server copies cannot drift)', () => {
    let seed = 12345;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % 4; };
    for (let i = 0; i < 300; i++) {
      const sheet = Array.from({ length: 9 }, rnd);
      const server = scoreNineQAnswers(sheet)!;
      const client = clientScore(Object.fromEntries(sheet.map((v, k) => [k + 1, v])) as NineQAnswers);
      expect('totalScore' in client).toBe(true);
      if ('totalScore' in client) {
        expect(server.totalScore).toBe(client.totalScore);
        expect(server.riskLevel).toBe(client.riskLevel);
        expect(server.redFlagItem9).toBe(client.redFlagItem9);
        expect(server.answers).toEqual(client.answers);
      }
    }
  });
});

describe('request parsing — the client can only send raw answers; any result it adds is ignored', () => {
  it('accepts studentId + 9 answers and returns only those two', () => {
    expect(parseNineQRequest({ studentId: ' 38501 ', answers: all(1) })).toEqual({ ok: true, value: { studentId: '38501', answers: all(1) } });
  });
  it('drops attacker-supplied results (riskLevel / redFlagItem9 / totalScore / basis) — they never reach the writer', () => {
    const r = parseNineQRequest({ studentId: '38501', answers: [0, 0, 0, 0, 0, 0, 0, 0, 3], riskLevel: 'NONE', redFlagItem9: false, totalScore: 0, basisKind: '2Q', basisId: 'x' });
    expect(r).toEqual({ ok: true, value: { studentId: '38501', answers: [0, 0, 0, 0, 0, 0, 0, 0, 3] } });
  });
  it('rejects a missing/odd studentId and bad answers', () => {
    expect(parseNineQRequest({ answers: all(1) }).ok).toBe(false);
    expect(parseNineQRequest({ studentId: '', answers: all(1) }).ok).toBe(false);
    expect(parseNineQRequest({ studentId: 'a/b', answers: all(1) }).ok).toBe(false);
    expect(parseNineQRequest({ studentId: '1', answers: [1] }).ok).toBe(false);
    expect(parseNineQRequest(null).ok).toBe(false);
  });
});

describe('who may call (decideNineQCaller)', () => {
  const base = { uid: 'u1', studentUid: 'stu-1', studentRoom: 'ม.5/8', callerHomeroomClass: null as string | null, hasActiveCounselor: true };

  it('the student themself (uid = students/{id}.studentUid, role STUDENT) → STUDENT path (must still pass the basis check)', () => {
    expect(decideNineQCaller({ ...base, uid: 'stu-1', roles: ['STUDENT'] })).toEqual({ kind: 'STUDENT' });
  });
  it('another student, or a student without the STUDENT role, or an unlinked student record → denied', () => {
    expect(decideNineQCaller({ ...base, uid: 'someone-else', roles: ['STUDENT'] })).toBeNull();
    expect(decideNineQCaller({ ...base, uid: 'stu-1', roles: [] })).toBeNull();
    expect(decideNineQCaller({ ...base, uid: 'stu-1', roles: ['STUDENT'], studentUid: null })).toBeNull();
    expect(decideNineQCaller({ ...base, uid: 'x', roles: ['PARENT'] })).toBeNull();
  });
  it('GUIDANCE_COUNSELOR and SUPER_ADMIN → STAFF always (with or without an active counselor in the system)', () => {
    for (const has of [true, false]) {
      expect(decideNineQCaller({ ...base, roles: ['GUIDANCE_COUNSELOR'], hasActiveCounselor: has })).toEqual({ kind: 'STAFF', role: 'GUIDANCE_COUNSELOR' });
      expect(decideNineQCaller({ ...base, roles: ['SUPER_ADMIN'], hasActiveCounselor: has })).toEqual({ kind: 'STAFF', role: 'SUPER_ADMIN' });
    }
  });
  it('homeroom teacher of THAT room → STAFF only when there is NO active counselor; with a counselor (or an unknown status → treated as having one) they cannot fill 9Q', () => {
    const hr = { ...base, roles: ['HOMEROOM_TEACHER'], callerHomeroomClass: 'ม.5/8' };
    expect(decideNineQCaller({ ...hr, hasActiveCounselor: false })).toEqual({ kind: 'STAFF', role: 'HOMEROOM_TEACHER' });
    expect(decideNineQCaller({ ...hr, hasActiveCounselor: true })).toBeNull();
  });
  it('homeroom teacher of another room, with no assigned room, subject teacher, executive → denied', () => {
    expect(decideNineQCaller({ ...base, roles: ['HOMEROOM_TEACHER'], callerHomeroomClass: 'ม.6/1', hasActiveCounselor: false })).toBeNull();
    expect(decideNineQCaller({ ...base, roles: ['HOMEROOM_TEACHER'], callerHomeroomClass: null, hasActiveCounselor: false })).toBeNull();
    expect(decideNineQCaller({ ...base, roles: ['SUBJECT_TEACHER'], hasActiveCounselor: false })).toBeNull();
    expect(decideNineQCaller({ ...base, roles: ['EXECUTIVE'], hasActiveCounselor: false })).toBeNull();
  });
});

describe('student basis (the server picks it — never trusts a client-claimed basis); each basis works once', () => {
  it('matches the client picking rules for every combination', () => {
    const twoQs = [null, { id: '2q-1', isPositive: true }, { id: '2q-1', isPositive: false }, { id: '2q-2', isPositive: true }];
    const grants = [[], ['g1'], ['g1', 'g2']];
    const useds = [[], ['2q-1'], ['g1'], ['2q-1', 'g1'], ['g1', 'g2']];
    for (const twoQ of twoQs) for (const grantIds of grants) for (const usedBasisIds of useds) {
      expect(serverPick({ twoQ, grantIds, usedBasisIds }), JSON.stringify({ twoQ, grantIds, usedBasisIds })).toEqual(clientPick({ twoQ, grantIds, usedBasisIds }));
    }
  });
  it('closed without a positive unused 2Q or an unused grant; garbage in progress is tolerated', () => {
    expect(serverPick({ twoQ: null, grantIds: [], usedBasisIds: [] })).toBeNull();
    expect(serverPick({ twoQ: { id: '2q-1', isPositive: false }, grantIds: [], usedBasisIds: [] })).toBeNull();
    expect(serverPick({ twoQ: { id: '2q-1', isPositive: true }, grantIds: [], usedBasisIds: ['2q-1'] })).toBeNull();
    expect(serverPick({ twoQ: { id: '2q-1', isPositive: true }, grantIds: [], usedBasisIds: 'oops' })).toEqual({ kind: '2Q', id: '2q-1' });
    expect(serverPick({ twoQ: { id: 7, isPositive: true }, grantIds: [], usedBasisIds: [] })).toBeNull();      // id ไม่ใช่ string
    expect(serverPick({ twoQ: { id: '2q-1', isPositive: 'true' }, grantIds: [], usedBasisIds: [] })).toBeNull(); // ไม่ใช่ boolean จริง
  });
});

describe('documents written', () => {
  const score = scoreNineQAnswers([2, 2, 2, 1, 1, 1, 1, 1, 1])!;
  const docs = buildNineQDocs({ studentId: '38501', studentUid: 'stu-1', recordedByUid: 'stu-1', score, basisKind: '2Q', basisId: '2q-1', respondentKind: 'STUDENT', conductedAt: '2026-10-05', id: '9q-1' });

  it('the summary carries level + red flag only (what the homeroom teacher may always read) — no score, no answers', () => {
    expect(docs.summary).toMatchObject({ riskLevel: 'MILD', redFlagItem9: true, respondentKind: 'STUDENT', basisKind: '2Q', basisId: '2q-1', studentId: '38501' });
    expect(docs.summary).not.toHaveProperty('totalScore');
    expect(docs.summary).not.toHaveProperty('answers');
  });
  it('the detail carries answers + total (guidance, or homeroom when there is no counselor)', () => {
    expect(docs.detail).toMatchObject({ totalScore: 12, answers: [2, 2, 2, 1, 1, 1, 1, 1, 1] });
    expect(docs.detail).not.toHaveProperty('riskLevel');
  });
  it('Bangkok date (UTC+7) regardless of the function host timezone', () => {
    expect(bangkokDate(new Date('2026-10-04T18:00:00Z'))).toBe('2026-10-05');   // 01:00 น. ไทย วันถัดไป
    expect(bangkokDate(new Date('2026-10-04T16:59:00Z'))).toBe('2026-10-04');
  });
});

describe('wiring: the callable is the only writer, and what it must do', () => {
  const src = (rel: string) => readSource(path.resolve(__dirname, '../..', rel));
  it('submitNineQ is a v1 default-region callable, exported, in the named deploy list, and uses a transaction', () => {
    const s = src('functions/src/nineQSubmit.ts');
    expect(s).toMatch(/^import \* as functions from 'firebase-functions\/v1';$/m);
    expect(s).toContain('export const submitNineQ = functions.https.onCall(');
    expect(s).not.toMatch(/\.region\(|region:/);
    expect(s).toContain('db.runTransaction');
    expect(s).toContain("getFirestore(admin.app(), FIRESTORE_DATABASE_ID)");
    expect(src('functions/src/index.ts')).toContain("export { submitNineQ } from './nineQSubmit';");
    expect(src('functions/package.json')).toContain('functions:submitNineQ');
  });
  it('the student gets nothing back (no score/level/red flag); teachers get the result', () => {
    const s = src('functions/src/nineQSubmit.ts');
    expect(s).toContain("if (caller.kind === 'STUDENT') return { success: true };");
    expect(s).toContain('return { success: true, riskLevel: score.riskLevel');
  });
  it('it never reads a result or basis from the request (only studentId + answers)', () => {
    const s = src('functions/src/nineQSubmit.ts');
    expect(s).not.toMatch(/data\.(riskLevel|redFlagItem9|totalScore|basisKind|basisId)/);
  });
});
