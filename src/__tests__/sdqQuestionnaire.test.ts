import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { computeSdq, SDQ_SUBSCALES, SdqEvaluatorType, SdqScores, SdqSubscaleKey } from '../lib/sdq';
import {
  SDQ_DOMAIN_ITEMS,
  SDQ_ITEM_COUNT,
  SDQ_ITEM_NUMBERS,
  SDQ_ITEM_TEXT,
  SDQ_REVERSE_ITEMS,
  SdqAnswerValue,
  SdqAnswers,
  answeredSdqCount,
  isReverseItem,
  missingSdqItems,
  scoreSdqAnswers,
  sdqItemDomain,
  sdqItemScore,
  sdqItemText,
} from '../lib/sdqQuestionnaire';
import { buildSdqSubmissionFromAnswers } from '../lib/sdqSubmission';
import { EMPTY_IMPACT_FORM } from '../lib/sdqImpact';
import { readSource } from './helpers/readSource';

const all = (v: SdqAnswerValue): SdqAnswers => Object.fromEntries(SDQ_ITEM_NUMBERS.map((n) => [n, v])) as SdqAnswers;
const scoresOf = (a: SdqAnswers): SdqScores => {
  const r = scoreSdqAnswers(a);
  if (!('scores' in r)) throw new Error('expected a complete answer sheet');
  return r.scores;
};
const KEYS: SdqSubscaleKey[] = ['emotional', 'conduct', 'hyperactivity', 'peerProblems', 'prosocial'];

describe('item → domain map and reverse items (official form numbering)', () => {
  it('uses exactly the item numbers the school listed for each domain', () => {
    expect(SDQ_DOMAIN_ITEMS.emotional).toEqual([3, 8, 13, 16, 24]);
    expect(SDQ_DOMAIN_ITEMS.conduct).toEqual([5, 7, 12, 18, 22]);
    expect(SDQ_DOMAIN_ITEMS.hyperactivity).toEqual([2, 10, 15, 21, 25]);
    expect(SDQ_DOMAIN_ITEMS.peerProblems).toEqual([6, 11, 14, 19, 23]);
    expect(SDQ_DOMAIN_ITEMS.prosocial).toEqual([1, 4, 9, 17, 20]);
  });

  it('the 5 domains partition items 1-25 exactly (5 each, no overlap, none missing)', () => {
    const everyItem = KEYS.flatMap((k) => [...SDQ_DOMAIN_ITEMS[k]]).sort((a, b) => a - b);
    expect(everyItem).toEqual(SDQ_ITEM_NUMBERS);
    expect(SDQ_ITEM_COUNT).toBe(25);
    for (const k of KEYS) expect(SDQ_DOMAIN_ITEMS[k]).toHaveLength(5);
    for (const k of KEYS) for (const n of SDQ_DOMAIN_ITEMS[k]) expect(sdqItemDomain(n)).toBe(k);
  });

  it('the reverse-scored items are exactly 7, 11, 14, 21, 25', () => {
    expect([...SDQ_REVERSE_ITEMS]).toEqual([7, 11, 14, 21, 25]);
    for (const n of SDQ_ITEM_NUMBERS) expect(isReverseItem(n), `item ${n}`).toBe([7, 11, 14, 21, 25].includes(n));
  });

  it('per-item score: normal ไม่จริง/ค่อนข้างจริง/จริง = 0/1/2; reverse items = 2/1/0', () => {
    for (const n of SDQ_ITEM_NUMBERS) {
      const expected = isReverseItem(n) ? [2, 1, 0] : [0, 1, 2];
      expect([0, 1, 2].map((v) => sdqItemScore(n, v as SdqAnswerValue)), `item ${n}`).toEqual(expected);
    }
  });
});

describe('scoreSdqAnswers — summing the 25 answers into 5 domain scores (0-10)', () => {
  it('all "จริง": the reverse items cancel part of the sum — emotional 10, conduct 8, hyperactivity 6, peer 6, prosocial 10', () => {
    // ข้อกลับทาง: conduct 1 ข้อ (7), hyperactivity 2 ข้อ (21, 25), peer 2 ข้อ (11, 14), emotional/prosocial ไม่มีข้อกลับทาง
    expect(scoresOf(all(2))).toEqual({ emotional: 10, conduct: 8, hyperactivity: 6, peerProblems: 6, prosocial: 10 });
  });

  it('all "ไม่จริง": the reverse items give 2 each — emotional 0, conduct 2, hyperactivity 4, peer 4, prosocial 0', () => {
    expect(scoresOf(all(0))).toEqual({ emotional: 0, conduct: 2, hyperactivity: 4, peerProblems: 4, prosocial: 0 });
  });

  it('all "ค่อนข้างจริง": every domain = 5 (the middle answer is unchanged by reversing)', () => {
    expect(scoresOf(all(1))).toEqual({ emotional: 5, conduct: 5, hyperactivity: 5, peerProblems: 5, prosocial: 5 });
  });

  it('every domain stays within 0-10 for any all-same answer', () => {
    for (const v of [0, 1, 2] as const) for (const k of KEYS) {
      const s = scoresOf(all(v))[k];
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(10);
    }
  });

  it('each of the 25 items feeds its own domain, and only that one (normal item +1, reverse item −1 when "จริง" from a neutral sheet)', () => {
    for (const n of SDQ_ITEM_NUMBERS) {
      const sheet = { ...all(1), [n]: 2 as SdqAnswerValue };
      const s = scoresOf(sheet);
      const domain = sdqItemDomain(n);
      for (const k of KEYS) {
        const expected = k === domain ? (isReverseItem(n) ? 4 : 6) : 5;
        expect(s[k], `item ${n} → ${k}`).toBe(expected);
      }
    }
  });

  it('a mixed sheet adds up by hand', () => {
    // emotional(3,8,13,16,24)=2,2,0,1,1 → 6 | conduct(5,7,12,18,22): 7 reverse; raw 0,2,1,0,1 → 0+0+1+0+1 = 2
    // hyperactivity(2,10,15,21,25): 21/25 reverse; raw 2,2,1,0,0 → 2+2+1+2+2 = 9
    // peer(6,11,14,19,23): 11/14 reverse; raw 1,2,2,0,1 → 1+0+0+0+1 = 2 | prosocial(1,4,9,17,20) raw 2,2,2,1,0 → 7
    const a: SdqAnswers = {
      3: 2, 8: 2, 13: 0, 16: 1, 24: 1,
      5: 0, 7: 2, 12: 1, 18: 0, 22: 1,
      2: 2, 10: 2, 15: 1, 21: 0, 25: 0,
      6: 1, 11: 2, 14: 2, 19: 0, 23: 1,
      1: 2, 4: 2, 9: 2, 17: 1, 20: 0,
    };
    expect(scoresOf(a)).toEqual({ emotional: 6, conduct: 2, hyperactivity: 9, peerProblems: 2, prosocial: 7 });
  });
});

describe('incomplete or invalid answer sheets are rejected, never half-calculated', () => {
  it('empty sheet: all 25 items reported missing', () => {
    const r = scoreSdqAnswers({});
    expect(r.ok).toBe(false);
    expect('missingItems' in r && r.missingItems).toEqual(SDQ_ITEM_NUMBERS);
    expect(answeredSdqCount({})).toBe(0);
  });

  it('24 of 25 answered: the one missing item is reported and no scores are returned', () => {
    for (const n of SDQ_ITEM_NUMBERS) {
      const { [n]: _drop, ...rest } = all(2);
      const r = scoreSdqAnswers(rest as SdqAnswers);
      expect(r.ok, `missing ${n}`).toBe(false);
      expect('missingItems' in r && r.missingItems).toEqual([n]);
      expect('scores' in r).toBe(false);
      expect(missingSdqItems(rest as SdqAnswers)).toEqual([n]);
      expect(answeredSdqCount(rest as SdqAnswers)).toBe(24);
    }
  });

  it('an unanswered item is never counted as 0', () => {
    const { 1: _drop, ...rest } = all(0);
    expect(scoreSdqAnswers(rest as SdqAnswers).ok).toBe(false);
  });

  it('values outside 0/1/2 (3, -1, 1.5, string, null) are flagged as invalid', () => {
    const bad = { ...all(1), 4: 3, 9: -1, 12: 1.5, 18: '2', 20: null } as unknown as SdqAnswers;
    const r = scoreSdqAnswers(bad);
    expect(r.ok).toBe(false);
    // null ถือว่ายังไม่ตอบ (ขาด) ส่วนที่เหลือคือค่าผิดปกติ
    expect('invalidItems' in r && r.invalidItems).toEqual([4, 9, 12, 18]);
    expect('missingItems' in r && r.missingItems).toEqual([20]);
  });
});

describe('question texts (numbered, per form)', () => {
  it('every form has exactly 25 non-empty questions', () => {
    for (const ev of ['STUDENT', 'PARENT', 'TEACHER'] as SdqEvaluatorType[]) {
      expect(SDQ_ITEM_TEXT[ev]).toHaveLength(25);
      for (const n of SDQ_ITEM_NUMBERS) expect(sdqItemText(ev, n).trim().length, `${ev} item ${n}`).toBeGreaterThan(0);
    }
  });

  it('spot checks against the official wording (student and parent forms)', () => {
    expect(sdqItemText('STUDENT', 1)).toBe('ฉันพยายามจะทำตัวดีกับคนอื่น ฉันใส่ใจความรู้สึกของคนอื่น');
    expect(sdqItemText('STUDENT', 7)).toBe('ฉันมักทำตามที่คนอื่นบอก');
    expect(sdqItemText('STUDENT', 25)).toBe('ฉันทำงานได้จนเสร็จ ความตั้งใจในการทำงานของฉันดี');
    expect(sdqItemText('PARENT', 1)).toBe('ห่วงใยความรู้สึกคนอื่น');
    expect(sdqItemText('PARENT', 16)).toBe('เครียดไม่ยอมห่างเวลาอยู่ในสถานการณ์ที่ไม่คุ้นและขาดความมั่นใจในตนเอง');
    expect(sdqItemText('PARENT', 22)).toBe('ขโมยของที่บ้าน ที่โรงเรียนหรือที่อื่น');
    expect(sdqItemText('PARENT', 25)).toBe('ทำงานได้จนเสร็จ มีความตั้งใจในการทำงาน');
  });

  it('the student form is written in first person; the parent form is not', () => {
    for (const n of SDQ_ITEM_NUMBERS) expect(SDQ_ITEM_TEXT.PARENT[n - 1], `parent item ${n}`).not.toMatch(/^ฉัน/);
    expect(SDQ_ITEM_TEXT.STUDENT.filter((t) => t.startsWith('ฉัน')).length).toBeGreaterThan(15);
  });

  it('TEACHER uses the same wording as PARENT — confirmed against the official manual ("ครู/ผู้ปกครอง" is one section)', () => {
    expect(SDQ_ITEM_TEXT.TEACHER).toBe(SDQ_ITEM_TEXT.PARENT);
    const lib = readSource(path.resolve(__dirname, '../lib/sdqQuestionnaire.ts'));
    expect(lib).toContain('ครู/ผู้ปกครอง');
    // ไม่มีหมายเหตุ "ชั่วคราว/ต้องตรวจซ้ำ" เหลืออยู่ทั้งในไลบรารีและหน้าฟอร์ม
    expect(lib).not.toContain('PROVISIONAL');
    expect(lib).not.toContain('ไปก่อน');
    expect(lib).not.toContain('⚠');
    const form = readSource(path.resolve(__dirname, '../components/shared/SdqQuestionnaireForm.tsx'));
    expect(form).not.toContain('provisional');
    expect(form).not.toContain('ไปก่อน');
  });

  it('the 7 corrected items carry the exact manual wording', () => {
    expect(sdqItemText('STUDENT', 1)).toBe('ฉันพยายามจะทำตัวดีกับคนอื่น ฉันใส่ใจความรู้สึกของคนอื่น');
    expect(sdqItemText('STUDENT', 2)).toBe('ฉันอยู่ไม่นิ่ง ฉันนั่งนาน ๆ ไม่ได้');
    expect(sdqItemText('STUDENT', 4)).toBe('ฉันเต็มใจแบ่งปันสิ่งของให้คนอื่น (ขนม, ของกิน, ของเล่น, เกม เป็นต้น)');
    for (const ev of ['PARENT', 'TEACHER'] as const) {
      expect(sdqItemText(ev, 3)).toBe('มักจะบ่นว่าปวดศีรษะ ปวดท้อง หรือไม่สบาย');
      expect(sdqItemText(ev, 8)).toBe('กังวลใจหลายเรื่อง ดูวิตกกังวลเสมอ');
      expect(sdqItemText(ev, 12)).toBe('มักมีเรื่องทะเลาะวิวาทกับเด็กอื่น หรือรังแกเด็กอื่น');
      expect(sdqItemText(ev, 13)).toBe('ดูไม่มีความสุข ท้อแท้ ร้องไห้บ่อย');
    }
  });
});

describe('hand-off to the existing criteria (src/lib/sdq.ts is unchanged)', () => {
  it('scores computed from answers go through computeSdq per evaluator exactly like typed scores did', () => {
    const s = scoresOf(all(2)); // 10 / 8 / 6 / 6 / 10 → รวม 4 ด้าน = 30
    const student = computeSdq(s, 'STUDENT');
    const teacher = computeSdq(s, 'TEACHER');
    expect(student.totalDifficultiesScore).toBe(30);
    expect(student.triagingStatus).toBe('VULNERABLE');
    expect(teacher.triagingStatus).toBe('VULNERABLE');
    expect(student.subscaleStatus.prosocial).toBe('HAS_STRENGTH');
    expect(student.subscaleStatus.emotional).toBe('VULNERABLE');
    // เกณฑ์ผู้ประเมินต่างกัน: ด้านเพื่อน 6 → นักเรียน "มีปัญหา" (≥5), ครู/ผู้ปกครอง "เสี่ยง" (6)
    expect(student.subscaleStatus.peerProblems).toBe('VULNERABLE');
    expect(teacher.subscaleStatus.peerProblems).toBe('AT_RISK');
  });

  it('buildSdqSubmissionFromAnswers: complete sheet → stored fields (5 domain scores + statuses + impact)', () => {
    const r = buildSdqSubmissionFromAnswers(all(1), { ...EMPTY_IMPACT_FORM, gate: 'NO' }, 'PARENT');
    expect(r.ok).toBe(true);
    if ('fields' in r) {
      expect(r.fields.subscaleScores).toEqual({ emotional: 5, conduct: 5, hyperactivity: 5, peerProblems: 5, prosocial: 5 });
      expect(r.fields.totalDifficultiesScore).toBe(20);
      expect(r.fields.criteriaVersion).toBe('dmh-obec-2');
      expect(r.fields.impactTriage).toBe('NORMAL');
    }
  });

  it('buildSdqSubmissionFromAnswers: an incomplete sheet fails and names the missing items (nothing to save)', () => {
    const { 13: _a, 24: _b, ...rest } = all(0);
    const r = buildSdqSubmissionFromAnswers(rest as SdqAnswers, { ...EMPTY_IMPACT_FORM, gate: 'NO' }, 'STUDENT');
    expect(r.ok).toBe(false);
    expect('missingItems' in r && r.missingItems).toEqual([13, 24]);
    expect('fields' in r).toBe(false);
  });

  it('sdq.ts still takes plain 0-10 domain scores (SDQ_SUBSCALES unchanged) so older typed-in records keep displaying', () => {
    expect(SDQ_SUBSCALES.map((s) => s.key)).toEqual(KEYS);
  });
});

describe('wiring guards', () => {
  const src = (rel: string) => readSource(path.resolve(__dirname, '../..', rel));

  it('the typed-number score form is gone; both entry points use the 25-item questionnaire via SdqEntryForm', () => {
    expect(() => src('src/components/shared/SdqScoreForm.tsx')).toThrow();
    expect(src('src/components/shared/SdqEntryForm.tsx')).toContain('<SdqQuestionnaireForm');
    expect(src('src/components/advisor/AdvisorSdqPanel.tsx')).toContain("buildSdqSubmissionFromAnswers(answers, impact, 'TEACHER')");
    expect(src('src/components/student-parent/HealthMentalWellbeingModule.tsx')).toContain('buildSdqSubmissionFromAnswers(sdqAnswers, sdqImpact, sdqEvaluator)');
  });

  it('the form shows the official item number on every question and a progress counter', () => {
    const f = src('src/components/shared/SdqQuestionnaireForm.tsx');
    expect(f).toContain('{n}.</span>{sdqItemText(evaluatorType, n)}');
    expect(f).toContain('data-testid="sdq-progress-count"');
    expect(f).toContain('SDQ_ANSWER_OPTIONS');
  });
});
