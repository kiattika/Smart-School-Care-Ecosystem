import { describe, it, expect } from 'vitest';
import * as path from 'path';
import {
  EIGHT_Q_ITEMS,
  EightQAnswers,
  NINE_Q_ITEMS,
  NINE_Q_ITEM_NUMBERS,
  NINE_Q_OPTIONS,
  NineQAnswerValue,
  NineQAnswers,
  classifyEightQ,
  classifyNineQ,
  eightQUnlocked,
  parentNoticeReasons,
  pickNineQBasis,
  scoreEightQ,
  scoreNineQ,
  screeningCapabilities,
} from '../lib/depressionScreening';
import { readSource } from './helpers/readSource';

const nine = (v: NineQAnswerValue): NineQAnswers => Object.fromEntries(NINE_Q_ITEM_NUMBERS.map((n) => [n, v])) as NineQAnswers;
const scoredNine = (a: NineQAnswers) => {
  const r = scoreNineQ(a);
  if (!('totalScore' in r)) throw new Error('expected a complete 9Q sheet');
  return r;
};
const eight = (yesItems: number[], q3CanControl?: boolean): EightQAnswers => ({
  answers: Object.fromEntries(EIGHT_Q_ITEMS.map((i) => [i.n, yesItems.includes(i.n)])),
  ...(q3CanControl === undefined ? {} : { q3CanControl }),
});
const scoredEight = (a: EightQAnswers) => {
  const r = scoreEightQ(a);
  if (!('totalScore' in r)) throw new Error('expected a complete 8Q sheet');
  return r;
};

// ═══════════════ 9Q ═══════════════
describe('9Q — Thai wording and scale (not the international PHQ-9)', () => {
  it('has the 9 Thai items in order, and the four answer options with their points', () => {
    expect(NINE_Q_ITEMS).toHaveLength(9);
    expect(NINE_Q_ITEMS[0]).toBe('เบื่อ ไม่สนใจอยากทำอะไร');
    expect(NINE_Q_ITEMS[1]).toBe('ไม่สบายใจ ซึมเศร้า ท้อแท้');
    expect(NINE_Q_ITEMS[6]).toBe('สมาธิไม่ดี เวลาทำอะไร เช่น ดูโทรทัศน์ ฟังวิทยุ หรือทำงานที่ต้องใช้ความตั้งใจ');
    expect(NINE_Q_ITEMS[7]).toBe('พูดช้า ทำอะไรช้าลง จนคนอื่นสังเกตเห็นได้ หรือกระสับกระส่ายไม่สามารถอยู่นิ่งได้เหมือนที่เคยเป็น');
    expect(NINE_Q_ITEMS[8]).toBe('คิดทำร้ายตนเองหรือคิดว่าถ้าตายๆ ไปเสียคงจะดี');
    expect(NINE_Q_OPTIONS.map((o) => [o.value, o.label])).toEqual([
      [0, 'ไม่มีเลย'], [1, 'เป็นบางวัน (1-7 วัน)'], [2, 'เป็นบ่อย (> 7 วัน)'], [3, 'เป็นทุกวัน'],
    ]);
  });
});

describe('9Q — total score levels (<7 none/very low, 7-12 mild, 13-18 moderate, ≥19 severe)', () => {
  it('both sides of every cut-off, and every value 0..27', () => {
    const expected = (n: number) => (n < 7 ? 'NONE' : n <= 12 ? 'MILD' : n <= 18 ? 'MODERATE' : 'SEVERE');
    for (let n = 0; n <= 27; n++) expect(classifyNineQ(n), `total=${n}`).toBe(expected(n));
    expect([6, 7, 12, 13, 18, 19].map(classifyNineQ)).toEqual(['NONE', 'MILD', 'MILD', 'MODERATE', 'MODERATE', 'SEVERE']);
  });

  it('is NOT the international PHQ-9 banding (PHQ-9 would call 10-14 moderate, 5-9 mild)', () => {
    expect(classifyNineQ(9)).toBe('MILD');
    expect(classifyNineQ(10)).toBe('MILD');   // PHQ-9 สากล: moderate
    expect(classifyNineQ(15)).toBe('MODERATE'); // PHQ-9 สากล: moderately severe
    expect(classifyNineQ(5)).toBe('NONE');      // PHQ-9 สากล: mild
  });

  it('scores whole sheets: all 0 → 0, all 1 → 9, all 2 → 18, all 3 → 27', () => {
    expect(scoredNine(nine(0))).toMatchObject({ totalScore: 0, riskLevel: 'NONE', redFlagItem9: false });
    expect(scoredNine(nine(1))).toMatchObject({ totalScore: 9, riskLevel: 'MILD' });
    expect(scoredNine(nine(2))).toMatchObject({ totalScore: 18, riskLevel: 'MODERATE' });
    expect(scoredNine(nine(3))).toMatchObject({ totalScore: 27, riskLevel: 'SEVERE' });
  });

  it('answers are returned in item order', () => {
    const r = scoredNine({ 1: 3, 2: 2, 3: 1, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 });
    expect(r.answers).toEqual([3, 2, 1, 0, 0, 0, 0, 0, 0]);
    expect(r.totalScore).toBe(6);
  });
});

describe('9Q — special rule: item 9 > 0 is an immediate red flag regardless of the total', () => {
  it('item 9 = 1/2/3 with an otherwise empty sheet → red flag, but the total level stays "NONE"', () => {
    for (const v of [1, 2, 3] as const) {
      const r = scoredNine({ ...nine(0), 9: v });
      expect(r.redFlagItem9, `item9=${v}`).toBe(true);
      expect(r.totalScore).toBe(v);
      expect(r.riskLevel).toBe('NONE');
    }
  });

  it('item 9 = 0 → no red flag even when the total is severe (the red flag is separate from the total level)', () => {
    const r = scoredNine({ ...nine(3), 9: 0 });
    expect(r.totalScore).toBe(24);
    expect(r.riskLevel).toBe('SEVERE');
    expect(r.redFlagItem9).toBe(false);
  });

  it('only item 9 triggers it — a high score on any other single item does not', () => {
    for (const n of NINE_Q_ITEM_NUMBERS.filter((x) => x !== 9)) {
      expect(scoredNine({ ...nine(0), [n]: 3 }).redFlagItem9, `item ${n}`).toBe(false);
    }
  });
});

describe('9Q — incomplete or invalid sheets are rejected (never half-calculated, a blank is never counted as 0)', () => {
  it('empty sheet: all 9 missing', () => {
    const r = scoreNineQ({});
    expect(r.ok).toBe(false);
    expect('missingItems' in r && r.missingItems).toEqual(NINE_Q_ITEM_NUMBERS);
  });
  it('8 of 9 answered (each item in turn): the missing one is named and no score is returned', () => {
    for (const n of NINE_Q_ITEM_NUMBERS) {
      const { [n]: _drop, ...rest } = nine(1);
      const r = scoreNineQ(rest as NineQAnswers);
      expect(r.ok, `missing ${n}`).toBe(false);
      expect('missingItems' in r && r.missingItems).toEqual([n]);
      expect('totalScore' in r).toBe(false);
    }
  });
  it('values outside 0-3 are invalid', () => {
    const r = scoreNineQ({ ...nine(1), 2: 4, 5: -1, 7: 1.5 } as unknown as NineQAnswers);
    expect(r.ok).toBe(false);
    expect('invalidItems' in r && r.invalidItems).toEqual([2, 5, 7]);
  });
});

// ═══════════════ 8Q ═══════════════
describe('8Q — items and per-item points', () => {
  it('has the 8 Thai items with the specified points', () => {
    expect(EIGHT_Q_ITEMS.map((i) => [i.n, i.points])).toEqual([[1, 1], [2, 2], [3, 6], [4, 8], [5, 9], [6, 4], [7, 10], [8, 4]]);
    expect(EIGHT_Q_ITEMS[0].text).toBe('คิดอยากฆ่าตัวตาย หรือคิดว่าตายไปจะดีกว่า');
    expect(EIGHT_Q_ITEMS[2].text).toBe('คิดเกี่ยวกับการฆ่าตัวตาย (ช่วง 1 เดือนที่ผ่านมา)');
    expect(EIGHT_Q_ITEMS[2].followUp).toEqual({ text: 'ควบคุมความคิดนั้นได้ไหม', pointsIfCannotControl: 8 });
    expect(EIGHT_Q_ITEMS.filter((i) => i.followUp).map((i) => i.n)).toEqual([3]);
  });

  it('each single "มี" gives exactly its own points (item 3 alone, controllable = 6)', () => {
    const expected: Record<number, number> = { 1: 1, 2: 2, 3: 6, 4: 8, 5: 9, 6: 4, 7: 10, 8: 4 };
    for (const i of EIGHT_Q_ITEMS) {
      const r = scoredEight(eight([i.n], i.n === 3 ? true : undefined));
      expect(r.totalScore, `item ${i.n}`).toBe(expected[i.n]);
    }
  });

  it('all "ไม่มี" → 0, NONE, not urgent', () => {
    expect(scoredEight(eight([]))).toMatchObject({ totalScore: 0, riskLevel: 'NONE', urgentReferral: false, q3CanControl: null });
  });
});

describe('8Q — item 3 follow-up (can you control the thought? yes = +0, no = +8 on top of item 3)', () => {
  it('item 3 yes + can control → 6; + cannot control → 6 + 8 = 14', () => {
    expect(scoredEight(eight([3], true)).totalScore).toBe(6);
    expect(scoredEight(eight([3], false)).totalScore).toBe(14);
    expect(scoredEight(eight([3], true)).q3CanControl).toBe(true);
    expect(scoredEight(eight([3], false)).q3CanControl).toBe(false);
  });

  it('item 3 yes without answering the follow-up → error (never guessed)', () => {
    const r = scoreEightQ(eight([3]));
    expect(r.ok).toBe(false);
    expect('missingQ3FollowUp' in r && r.missingQ3FollowUp).toBe(true);
  });

  it('item 3 no → the follow-up is skipped and ignored even if a stale answer is still in the form', () => {
    const r = scoredEight({ ...eight([1], false) }); // q3CanControl=false left over, but item 3 = ไม่มี
    expect(r.totalScore).toBe(1);
    expect(r.q3CanControl).toBeNull();
    expect(scoredEight(eight([], true)).totalScore).toBe(0);
  });

  it('missing item answers are listed and nothing is scored', () => {
    const r = scoreEightQ({ answers: { 1: true, 2: false } });
    expect(r.ok).toBe(false);
    expect('missingItems' in r && r.missingItems).toEqual([3, 4, 5, 6, 7, 8]);
  });
});

describe('8Q — levels (0 none, 1-8 low, 9-16 moderate, ≥17 severe = urgent hospital referral)', () => {
  it('both sides of every cut-off, every value 0..52', () => {
    const expected = (n: number) => (n === 0 ? 'NONE' : n <= 8 ? 'LOW' : n <= 16 ? 'MODERATE' : 'SEVERE');
    for (let n = 0; n <= 52; n++) expect(classifyEightQ(n), `total=${n}`).toBe(expected(n));
  });

  it('whole sheets landing exactly on each edge', () => {
    expect(scoredEight(eight([1]))).toMatchObject({ totalScore: 1, riskLevel: 'LOW', urgentReferral: false });
    expect(scoredEight(eight([4]))).toMatchObject({ totalScore: 8, riskLevel: 'LOW' });                  // 8 = สูงสุดของ "น้อย"
    expect(scoredEight(eight([5]))).toMatchObject({ totalScore: 9, riskLevel: 'MODERATE' });             // 9 = ต่ำสุดของ "ปานกลาง"
    expect(scoredEight(eight([3, 7], true))).toMatchObject({ totalScore: 16, riskLevel: 'MODERATE', urgentReferral: false }); // 16 = สูงสุดของ "ปานกลาง"
    expect(scoredEight(eight([1, 3, 7], true))).toMatchObject({ totalScore: 17, riskLevel: 'SEVERE', urgentReferral: true }); // 17 = ต่ำสุดของ "รุนแรง"
    expect(scoredEight(eight([4, 5]))).toMatchObject({ totalScore: 17, riskLevel: 'SEVERE', urgentReferral: true });
  });

  it('maximum: everything yes and not controllable → 52', () => {
    expect(scoredEight(eight([1, 2, 3, 4, 5, 6, 7, 8], false))).toMatchObject({ totalScore: 52, riskLevel: 'SEVERE', urgentReferral: true });
  });
});

// ═══════════════ ลำดับการทำ (gate) ═══════════════
describe('8Q is unlocked only by 9Q total ≥7 or the item-9 red flag', () => {
  it('locked: no 9Q at all, or 9Q level NONE without a red flag', () => {
    expect(eightQUnlocked(null)).toBe(false);
    expect(eightQUnlocked(undefined)).toBe(false);
    expect(eightQUnlocked({ riskLevel: 'NONE', redFlagItem9: false })).toBe(false);
  });
  it('unlocked: NONE + red flag; MILD/MODERATE/SEVERE', () => {
    expect(eightQUnlocked({ riskLevel: 'NONE', redFlagItem9: true })).toBe(true);
    for (const l of ['MILD', 'MODERATE', 'SEVERE'] as const) expect(eightQUnlocked({ riskLevel: l, redFlagItem9: false })).toBe(true);
  });
  it('consistent with the scoring: total 6 without item 9 stays locked, total 7 unlocks', () => {
    const six = scoredNine({ 1: 3, 2: 3, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 });
    const seven = scoredNine({ 1: 3, 2: 3, 3: 1, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 });
    expect(eightQUnlocked(six)).toBe(false);
    expect(eightQUnlocked(seven)).toBe(true);
    expect(eightQUnlocked(scoredNine({ ...nine(0), 9: 1 }))).toBe(true);
  });
});

describe('9Q access for the student: only with an unused basis (positive latest 2Q, or a grant a teacher opened)', () => {
  it('closed: no 2Q, negative 2Q, nothing else', () => {
    expect(pickNineQBasis({ twoQ: null, grantIds: [], usedBasisIds: [] })).toBeNull();
    expect(pickNineQBasis({ twoQ: { id: '2q-1', isPositive: false }, grantIds: [], usedBasisIds: [] })).toBeNull();
  });
  it('open from a positive 2Q — once per 2Q record', () => {
    expect(pickNineQBasis({ twoQ: { id: '2q-1', isPositive: true }, grantIds: [], usedBasisIds: [] })).toEqual({ kind: '2Q', id: '2q-1' });
    expect(pickNineQBasis({ twoQ: { id: '2q-1', isPositive: true }, grantIds: [], usedBasisIds: ['2q-1'] })).toBeNull();
    expect(pickNineQBasis({ twoQ: { id: '2q-2', isPositive: true }, grantIds: [], usedBasisIds: ['2q-1'] })).toEqual({ kind: '2Q', id: '2q-2' });
  });
  it('open from a grant opened by a teacher — used grants no longer count; a grant works even when 2Q is negative', () => {
    expect(pickNineQBasis({ twoQ: { id: '2q-1', isPositive: false }, grantIds: ['g1'], usedBasisIds: [] })).toEqual({ kind: 'GRANT', id: 'g1' });
    expect(pickNineQBasis({ twoQ: null, grantIds: ['g1'], usedBasisIds: ['g1'] })).toBeNull();
    expect(pickNineQBasis({ twoQ: null, grantIds: ['g1', 'g2'], usedBasisIds: ['g1'] })).toEqual({ kind: 'GRANT', id: 'g2' });
  });
});

// ═══════════════ สิทธิ์การมองเห็น (ตารางเดียวกับที่ rules ถูกทดสอบเทียบ) ═══════════════
describe('visibility table (spec section 4)', () => {
  it('GUIDANCE_COUNSELOR reads and writes everything, with or without the status being known', () => {
    for (const has of [true, false]) {
      expect(screeningCapabilities('GUIDANCE_COUNSELOR', has)).toEqual({
        read2Q: true, read9QSummary: true, read9QDetail: true, read8QDetail: true, read8QCaseFlag: true, write8Q: true, openNineQ: true,
      });
    }
  });

  it('HOMEROOM_TEACHER with an active counselor: 2Q full, 9Q level only, 8Q "has case" only, cannot write 8Q, can open 9Q', () => {
    expect(screeningCapabilities('HOMEROOM_TEACHER', true)).toEqual({
      read2Q: true, read9QSummary: true, read9QDetail: false, read8QDetail: false, read8QCaseFlag: true, write8Q: false, openNineQ: true,
    });
  });

  it('HOMEROOM_TEACHER with NO active counselor: reads 9Q answers and reads/writes 8Q in full', () => {
    expect(screeningCapabilities('HOMEROOM_TEACHER', false)).toEqual({
      read2Q: true, read9QSummary: true, read9QDetail: true, read8QDetail: true, read8QCaseFlag: true, write8Q: true, openNineQ: true,
    });
  });

  it('STUDENT reads only 2Q — never 9Q/8Q (level, answers, case flag), cannot write 8Q or open 9Q', () => {
    for (const has of [true, false]) {
      expect(screeningCapabilities('STUDENT', has)).toEqual({
        read2Q: true, read9QSummary: false, read9QDetail: false, read8QDetail: false, read8QCaseFlag: false, write8Q: false, openNineQ: false,
      });
    }
  });
});

// ═══════════════ แจ้งผู้ปกครอง ═══════════════
describe('parent notice warning (advice only — nothing is sent automatically)', () => {
  it('no reasons → no warning', () => {
    expect(parentNoticeReasons({})).toEqual([]);
    expect(parentNoticeReasons({ nineQRisk: 'NONE', nineQRedFlag: false, eightQTotal: 0 })).toEqual([]);
    expect(parentNoticeReasons({ nineQRisk: 'MILD' })).toEqual([]);
  });
  it('9Q moderate or above, any 8Q score, or the item-9 red flag each raise a reason', () => {
    expect(parentNoticeReasons({ nineQRisk: 'MODERATE' })).toHaveLength(1);
    expect(parentNoticeReasons({ nineQRisk: 'SEVERE' })).toHaveLength(1);
    expect(parentNoticeReasons({ nineQRedFlag: true })).toHaveLength(1);
    expect(parentNoticeReasons({ eightQTotal: 1 })).toHaveLength(1);
    expect(parentNoticeReasons({ nineQRisk: 'SEVERE', nineQRedFlag: true, eightQTotal: 17 })).toHaveLength(3);
  });
});

// ═══════════════ wiring guards ═══════════════
describe('wiring guards', () => {
  const src = (rel: string) => readSource(path.resolve(__dirname, '../..', rel));

  it('the international PHQ-9 is gone from the app code (store, types, services, hooks, portals)', () => {
    for (const f of ['src/store.ts', 'src/types.ts', 'src/services/firestoreService.ts', 'src/hooks/useGuidanceScreenings.ts', 'src/ExecutivePortal.tsx', 'src/components/guidance/GuidancePortal.tsx', 'src/components/student-parent/HealthMentalWellbeingModule.tsx']) {
      const s = src(f);
      expect(s, f).not.toMatch(/savePHQ9|PHQ9Screening|phq9Screenings|subscribeAllPHQ9/);
    }
    expect(src('src/components/student-parent/HealthMentalWellbeingModule.tsx')).not.toMatch(/PHQ-9/);
    expect(src('src/ParentPortal.tsx')).not.toContain('PHQ-9');
    expect(src('src/StudentPortal.tsx')).not.toContain('PHQ-9');
  });

  it('the student has NO free-standing 9Q button: the section is rendered only for the student themself and only when a basis exists; 8Q has no student screen at all', () => {
    const hmw = src('src/components/student-parent/HealthMentalWellbeingModule.tsx');
    expect(hmw).toMatch(/canSelfReport && student\.studentUid && \(\s*<div className="lg:col-span-7">\s*<StudentNineQSection/);
    const sec = src('src/components/student-parent/StudentNineQSection.tsx');
    expect(sec).toContain('if (gate.loading || !gate.basis) return null;');
    for (const f of ['src/components/student-parent/HealthMentalWellbeingModule.tsx', 'src/components/student-parent/StudentNineQSection.tsx', 'src/StudentPortal.tsx', 'src/ParentPortal.tsx']) {
      expect(src(f), f).not.toMatch(/EightQuestionForm|saveEightQ|student_screenings_8q/);
    }
  });

  it('the student never sees raw 9Q/8Q results: the student section shows no score/level/red flag and does not read 9Q/8Q', () => {
    const sec = src('src/components/student-parent/StudentNineQSection.tsx');
    // ไม่มี JSX/ข้อความที่แสดงคะแนน/ระดับ/ธงแดง (ตัวแปรคำนวณภายในตอนส่งได้ แต่ห้ามอยู่ใน {...} ที่ render)
    const rendersResult = /{[^{}]*(totalScore|riskLevel|redFlagItem9)[^{}]*}/;
    expect(sec).not.toMatch(rendersResult);
    expect(sec).not.toMatch(/NINE_Q_RISK_LABEL|student_screenings_9q|student_screenings_8q|student_8q_case_flags/);
    const form = src('src/components/shared/NineQuestionForm.tsx');
    expect(form).not.toMatch(rendersResult);
    expect(form).not.toMatch(/NINE_Q_RISK_LABEL|classifyNineQ|scoreNineQ/);
    // hook ฝั่งนักเรียนฟังเฉพาะ 2Q + progress + grants ของตัวเอง
    const hook = src('src/hooks/useDepressionScreening.ts');
    const studentHook = hook.slice(hook.indexOf('export function useStudentNineQGate'), hook.indexOf('// ───────── ครูแนะแนว: ทั้งโรงเรียน'));
    expect(studentHook).toContain('student_screenings_2q/');
    expect(studentHook).toContain('student_screening_progress/');
    expect(studentHook).not.toMatch(/student_screenings_9q|student_screenings_8q|student_8q_case_flags/);
  });

  it('hidden radios stay inside a `relative` label in the new forms (the sr-only scroll-jump bug fixed for SDQ)', () => {
    for (const rel of ['src/components/shared/NineQuestionForm.tsx', 'src/components/shared/EightQuestionForm.tsx']) {
      const s = src(rel);
      expect(s, rel).toContain('className="sr-only"');
      expect(s, rel).toMatch(/<label\s+key=\{[^}]+\}\s+(\/\/[^\n]*\s+)*className=\{`relative /);
    }
  });

  it('GuidancePortal: 9Q label, depression tab with the panel, red-flag strip and the open-9Q / record-8Q buttons', () => {
    const g = src('src/components/guidance/GuidancePortal.tsx');
    expect(g).toContain("id: 'depression'");
    expect(g).toContain('<DepressionScreeningPanel');
    expect(g).toContain('<th className="pb-2 font-medium">9Q</th>');
    const p = src('src/components/shared/DepressionScreeningPanel.tsx');
    expect(p).toContain('data-testid="red-flag-strip"');
    expect(p).toContain('เปิด 9Q ให้นักเรียนคนนี้');
    expect(p).toContain('บันทึก 8Q');
  });

  it('AdvisorPortal has the room screening tab limited to the room, loaded only when the tab is open', () => {
    const a = src('src/AdvisorPortal.tsx');
    expect(a).toContain("{ id: 'screening', label: 'คัดกรองซึมเศร้า', icon: ShieldAlert }");
    expect(a).toContain("useRoomScreeningRecords(myStudents.map(s => s.studentId), activeTab === 'screening')");
  });

  it('ExecutivePortal does not read 9Q/8Q and says so', () => {
    const e = src('src/ExecutivePortal.tsx');
    expect(e).not.toMatch(/student_screenings_(9q|8q)|student_8q_case_flags/);
    expect(e).toContain('data-testid="exec-9q-not-available"');
  });
});
