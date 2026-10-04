import { describe, it, expect } from 'vitest';
import * as path from 'path';
import {
  SDQ_CRITERIA,
  SDQ_CRITERIA_VERSION,
  SdqDifficultyKey,
  SdqEvaluatorType,
  SdqScores,
  SdqTriage,
  classifySdqStrength,
  classifySdqSubscale,
  classifySdqTotal,
  computeSdq,
  isLegacySdqCriteria,
  isValidAcademicYear,
  sdqDocId,
  validateSdqScores,
} from '../lib/sdq';
import { readSource } from './helpers/readSource';

/**
 * เกณฑ์ตามคู่มือกรมสุขภาพจิต/สพฐ. (หน้า 139-141) — เขียนซ้ำที่นี่เป็น "ช่วงคะแนน" แยกจาก SDQ_CRITERIA (ซึ่งเก็บเป็นขอบล่าง)
 * เพื่อให้เทสต์เป็นอิสระจากโค้ด แล้วไล่ตรวจ "ทุกค่าคะแนน" (ไม่ใช่แค่ขอบเขต) ทั้งสองฝั่งของทุกขอบ
 * [ปกติสูงสุด, เสี่ยงสูงสุด, คะแนนสูงสุด] — ปกติ 0..n, เสี่ยง n+1..r, มีปัญหา r+1..max
 */
type Ranges = { normalMax: number; riskMax: number; max: number };
const selfTable: Record<'total' | SdqDifficultyKey, Ranges> = {
  total: { normalMax: 16, riskMax: 18, max: 40 },
  emotional: { normalMax: 5, riskMax: 6, max: 10 },
  conduct: { normalMax: 4, riskMax: 5, max: 10 },
  hyperactivity: { normalMax: 5, riskMax: 6, max: 10 },
  peerProblems: { normalMax: 3, riskMax: 4, max: 10 },
};
const adultTable: Record<'total' | SdqDifficultyKey, Ranges> = {
  total: { normalMax: 15, riskMax: 17, max: 40 },
  emotional: { normalMax: 3, riskMax: 4, max: 10 },
  conduct: { normalMax: 3, riskMax: 4, max: 10 },
  hyperactivity: { normalMax: 5, riskMax: 6, max: 10 },
  peerProblems: { normalMax: 5, riskMax: 6, max: 10 },
};
const expectedClass = (v: number, r: Ranges): SdqTriage => (v <= r.normalMax ? 'NORMAL' : v <= r.riskMax ? 'AT_RISK' : 'VULNERABLE');

const suites: Array<{ name: string; evaluators: SdqEvaluatorType[]; table: typeof selfTable }> = [
  { name: 'student self-report (STUDENT)', evaluators: ['STUDENT'], table: selfTable },
  { name: 'teacher / parent (TEACHER, PARENT share one set)', evaluators: ['TEACHER', 'PARENT'], table: adultTable },
];

describe.each(suites)('official criteria — $name', ({ evaluators, table }) => {
  for (const ev of evaluators) {
    it(`${ev}: total of the 4 difficulty subscales — every value 0..40`, () => {
      for (let v = 0; v <= table.total.max; v++) {
        expect(classifySdqTotal(v, ev), `total=${v}`).toBe(expectedClass(v, table.total));
      }
    });

    for (const key of ['emotional', 'conduct', 'hyperactivity', 'peerProblems'] as const) {
      it(`${ev}: ${key} — every value 0..10`, () => {
        for (let v = 0; v <= 10; v++) {
          expect(classifySdqSubscale(key, v, ev), `${key}=${v}`).toBe(expectedClass(v, table[key]));
        }
      });
    }

    it(`${ev}: prosocial (strength) — 0-3 no strength, 4-10 has strength`, () => {
      for (let v = 0; v <= 3; v++) expect(classifySdqStrength(v, ev), `prosocial=${v}`).toBe('NO_STRENGTH');
      for (let v = 4; v <= 10; v++) expect(classifySdqStrength(v, ev), `prosocial=${v}`).toBe('HAS_STRENGTH');
    });
  }
});

describe('the exact edges the school listed (both sides of every cut-off)', () => {
  it('STUDENT total: 16 normal | 17-18 at risk | 19 problem', () => {
    expect([16, 17, 18, 19].map((v) => classifySdqTotal(v, 'STUDENT'))).toEqual(['NORMAL', 'AT_RISK', 'AT_RISK', 'VULNERABLE']);
  });
  it('TEACHER/PARENT total: 15 normal | 16-17 at risk | 18 problem', () => {
    for (const ev of ['TEACHER', 'PARENT'] as const) {
      expect([15, 16, 17, 18].map((v) => classifySdqTotal(v, ev))).toEqual(['NORMAL', 'AT_RISK', 'AT_RISK', 'VULNERABLE']);
    }
  });
  it('the same score is judged differently by evaluator (total 16-18 and per-subscale)', () => {
    expect(classifySdqTotal(16, 'STUDENT')).toBe('NORMAL');
    expect(classifySdqTotal(16, 'TEACHER')).toBe('AT_RISK');
    expect(classifySdqTotal(18, 'STUDENT')).toBe('AT_RISK');
    expect(classifySdqTotal(18, 'PARENT')).toBe('VULNERABLE');
    expect(classifySdqSubscale('emotional', 4, 'STUDENT')).toBe('NORMAL');
    expect(classifySdqSubscale('emotional', 4, 'TEACHER')).toBe('AT_RISK');
    expect(classifySdqSubscale('peerProblems', 4, 'STUDENT')).toBe('AT_RISK');
    expect(classifySdqSubscale('peerProblems', 4, 'PARENT')).toBe('NORMAL');
    expect(classifySdqSubscale('conduct', 5, 'STUDENT')).toBe('AT_RISK');
    expect(classifySdqSubscale('conduct', 5, 'TEACHER')).toBe('VULNERABLE');
  });
  it('TEACHER and PARENT share exactly one criteria set; STUDENT has its own', () => {
    expect(SDQ_CRITERIA.TEACHER).toBe(SDQ_CRITERIA.PARENT);
    expect(SDQ_CRITERIA.STUDENT).not.toBe(SDQ_CRITERIA.TEACHER);
  });
});

describe('computeSdq(scores, evaluatorType) — overall + all 5 subscale statuses', () => {
  const scores: SdqScores = { emotional: 4, conduct: 5, hyperactivity: 6, peerProblems: 4, prosocial: 3 }; // รวม 19

  it('the evaluator decides the result for the same scores', () => {
    const self = computeSdq(scores, 'STUDENT');
    expect(self.totalDifficultiesScore).toBe(19);
    expect(self.triagingStatus).toBe('VULNERABLE');
    expect(self.subscaleStatus).toEqual({ emotional: 'NORMAL', conduct: 'AT_RISK', hyperactivity: 'AT_RISK', peerProblems: 'AT_RISK', prosocial: 'NO_STRENGTH' });

    for (const ev of ['TEACHER', 'PARENT'] as const) {
      const adult = computeSdq(scores, ev);
      expect(adult.triagingStatus).toBe('VULNERABLE');
      expect(adult.subscaleStatus).toEqual({ emotional: 'AT_RISK', conduct: 'VULNERABLE', hyperactivity: 'AT_RISK', peerProblems: 'NORMAL', prosocial: 'NO_STRENGTH' });
    }
  });

  it('total counts only the 4 difficulty subscales; prosocial never raises the total', () => {
    const a = computeSdq({ emotional: 1, conduct: 1, hyperactivity: 1, peerProblems: 1, prosocial: 0 }, 'TEACHER');
    const b = computeSdq({ emotional: 1, conduct: 1, hyperactivity: 1, peerProblems: 1, prosocial: 10 }, 'TEACHER');
    expect(a.totalDifficultiesScore).toBe(4);
    expect(b.totalDifficultiesScore).toBe(4);
    expect(a.subscaleStatus.prosocial).toBe('NO_STRENGTH');
    expect(b.subscaleStatus.prosocial).toBe('HAS_STRENGTH');
  });

  it('stamps the criteria version and writes Thai recommendations with the flagged subscales', () => {
    const r = computeSdq(scores, 'TEACHER');
    expect(r.criteriaVersion).toBe(SDQ_CRITERIA_VERSION);
    expect(r.recommendations[0]).toContain('19/40');
    expect(r.recommendations[0]).toContain('มีปัญหา');
    expect(r.recommendations.join(' | ')).toContain('ด้านที่ต้องติดตาม');
    expect(r.recommendations.join(' | ')).toContain('ความประพฤติ: มีปัญหา');
    expect(r.recommendations.join(' | ')).toContain('ไม่มีจุดแข็ง');
    // ทุกด้านปกติ → ไม่มีบรรทัด "ด้านที่ต้องติดตาม"
    expect(computeSdq({ emotional: 0, conduct: 0, hyperactivity: 0, peerProblems: 0, prosocial: 9 }, 'STUDENT').recommendations.join('|')).not.toContain('ด้านที่ต้องติดตาม');
  });
});

describe('legacy records (saved before the official criteria)', () => {
  it('no criteriaVersion = legacy (not recalculated); the current version is not', () => {
    expect(isLegacySdqCriteria({})).toBe(true);
    expect(isLegacySdqCriteria({ criteriaVersion: undefined })).toBe(true);
    expect(isLegacySdqCriteria({ criteriaVersion: null })).toBe(true);
    expect(isLegacySdqCriteria({ criteriaVersion: 'old' })).toBe(true);
    expect(isLegacySdqCriteria({ criteriaVersion: SDQ_CRITERIA_VERSION })).toBe(false);
    expect(isLegacySdqCriteria(computeSdq({ emotional: 0, conduct: 0, hyperactivity: 0, peerProblems: 0, prosocial: 5 }, 'PARENT'))).toBe(false);
  });
});

describe('validateSdqScores — every subscale must be entered (no silent defaults)', () => {
  const ok = { emotional: '2', conduct: '1', hyperactivity: '0', peerProblems: '10', prosocial: 9 };
  it('accepts integers 0-10 given as strings or numbers', () => {
    expect(validateSdqScores(ok)).toEqual({ ok: true, scores: { emotional: 2, conduct: 1, hyperactivity: 0, peerProblems: 10, prosocial: 9 } });
  });
  it('rejects empty, missing, decimals, negatives, >10 and garbage with a per-field message', () => {
    const r = validateSdqScores({ emotional: '', conduct: '1.5', hyperactivity: '-1', peerProblems: '11', prosocial: 'abc' });
    expect(r.ok).toBe(false);
    if ('errors' in r) expect(Object.keys(r.errors).sort()).toEqual(['conduct', 'emotional', 'hyperactivity', 'peerProblems', 'prosocial']);
    const missing = validateSdqScores({ ...ok, prosocial: undefined });
    expect('errors' in missing && missing.errors.prosocial).toBe('กรุณากรอกคะแนน');
    expect(validateSdqScores({}).ok).toBe(false);
  });
});

describe('academic year + document id', () => {
  it('only 4-digit years are valid', () => {
    for (const y of ['2569', '2570']) expect(isValidAcademicYear(y)).toBe(true);
    for (const y of ['', '69', '25690', '2569 ', 2569, null, undefined]) expect(isValidAcademicYear(y)).toBe(false);
  });

  it('sdqDocId is {studentId}_{evaluatorType}_{academicYear} — the exact shape firestore.rules enforces', () => {
    expect(sdqDocId('38501', 'TEACHER', '2569')).toBe('38501_TEACHER_2569');
    const rules = readSource(path.resolve(__dirname, '../../firestore.rules'));
    expect(rules).toContain("sdqId == request.resource.data.studentId + '_' + request.resource.data.evaluatorType + '_' + request.resource.data.academicYear");
    expect(rules).toContain('isCurrentAcademicYear(request.resource.data.academicYear)');
  });
});

describe('wiring guards', () => {
  const src = (rel: string) => readSource(path.resolve(__dirname, '../..', rel));

  it('src/lib/sdq.ts cites the official source of the criteria', () => {
    const s = src('src/lib/sdq.ts');
    expect(s).toContain('กรมสุขภาพจิต');
    expect(s).toContain('สพฐ.');
    expect(s).toContain('การบริหารจัดการระบบการดูแลช่วยเหลือนักเรียน');
    expect(s).toContain('หน้า 139-141');
  });

  it('every caller passes the evaluator type (computeSdq via buildSdqSubmission / SdqEntryForm)', () => {
    expect(src('src/components/advisor/AdvisorSdqPanel.tsx')).toContain("buildSdqSubmission(values, impact, 'TEACHER')");
    expect(src('src/components/advisor/AdvisorSdqPanel.tsx')).toContain('evaluatorType="TEACHER"');
    const h = src('src/components/student-parent/HealthMentalWellbeingModule.tsx');
    expect(h).toContain('buildSdqSubmission(sdqScores, sdqImpact, sdqEvaluator)');
    expect(h).toContain('evaluatorType={sdqEvaluator}');
    expect(src('src/components/shared/SdqScoreForm.tsx')).toContain('computeSdq(validation.scores, evaluatorType)');
    expect(src('src/lib/sdqSubmission.ts')).toContain('computeSdq(s.scores, evaluatorType)');
    // ไม่มีจุดไหนเรียก computeSdq แบบพารามิเตอร์เดียวอีก
    for (const f of ['src/components/advisor/AdvisorSdqPanel.tsx', 'src/components/student-parent/HealthMentalWellbeingModule.tsx', 'src/components/shared/SdqScoreForm.tsx', 'src/lib/sdqSubmission.ts']) {
      expect(src(f)).not.toMatch(/computeSdq\([^,()]+\)/);
    }
  });

  it('the student/parent module shows the real result (no hardcoded "ปกติ (Normal)") and no hardcoded default scores', () => {
    const s = src('src/components/student-parent/HealthMentalWellbeingModule.tsx');
    expect(s).not.toContain('ปกติ (Normal)');
    expect(s).toContain('<SdqStatusView rec={sdq} />');
    expect(s).not.toMatch(/emotional:\s*2,\s*\n?\s*conduct:\s*1/);
    expect(s).toContain('useState<SdqFormValues>(EMPTY_SDQ_FORM)');
    expect(s).toContain('academicYear: currentAcademicYear');
  });

  it('the store derives the id from (student, evaluator, year) and refuses a missing year', () => {
    const s = src('src/store.ts');
    expect(s).toContain('id: sdqDocId(sdq.studentId, sdq.evaluatorType, sdq.academicYear)');
    expect(s).toContain('isValidAcademicYear(sdq.academicYear)');
  });

  it('readers of old data flag the legacy criteria (Guidance counts, Executive card, trend years)', () => {
    expect(src('src/components/guidance/GuidancePortal.tsx')).toContain('isLegacySdqCriteria');
    expect(src('src/ExecutivePortal.tsx')).toContain('isLegacySdqCriteria');
    expect(src('src/lib/sdqTrend.ts')).toContain('legacyCriteria');
    expect(src('src/components/shared/SdqStatusView.tsx')).toContain('SDQ_LEGACY_NOTE');
  });

  it('AdvisorPortal exposes the SDQ tab and the panel saves as TEACHER with the school year', () => {
    expect(src('src/AdvisorPortal.tsx')).toContain("{ id: 'sdq', label: 'SDQ นักเรียน', icon: Heart }");
    const p = src('src/components/advisor/AdvisorSdqPanel.tsx');
    expect(p).toContain("evaluatorType: 'TEACHER'");
    expect(p).toContain('academicYear,');
    expect(p).not.toMatch(/useState\(\s*students\[0\]/);
  });

  it('GuidancePortal no longer hardcodes the year in the SDQ heading', () => {
    const g = src('src/components/guidance/GuidancePortal.tsx');
    expect(g).not.toContain('ประจำปีการศึกษา 2569');
    expect(g).toContain('<SdqTrendSection');
  });
});
