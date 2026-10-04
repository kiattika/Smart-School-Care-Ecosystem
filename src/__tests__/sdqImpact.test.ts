import { describe, it, expect } from 'vitest';
import * as path from 'path';
import {
  EMPTY_IMPACT_FORM,
  IMPACT_DOMAINS,
  IMPACT_LEVEL_OPTIONS,
  ImpactFormValues,
  ImpactLevel,
  classifyImpactTotal,
  computeImpact,
  impactDistressQuestion,
  impactGateQuestion,
  impactLevelScore,
  impactTotal,
} from '../lib/sdqImpact';
import { buildSdqSubmission } from '../lib/sdqSubmission';
import { readSource } from './helpers/readSource';

/** SDQ ส่วนที่ 2 — ผลกระทบ (คู่มือกรมสุขภาพจิต/สพฐ. หน้า 139-141): คะแนนรวม = ข้อ 3 + 4 ด้านข้อ 4 (เต็ม 10); ปกติ 0, เสี่ยง 1-2, มีปัญหา 3-10 */
const yes = (over: Partial<ImpactFormValues> & { levels?: [ImpactLevel, ImpactLevel, ImpactLevel, ImpactLevel, ImpactLevel] } = {}): ImpactFormValues => {
  const [d, h, f, c, l] = over.levels ?? ['NOT_AT_ALL', 'NOT_AT_ALL', 'NOT_AT_ALL', 'NOT_AT_ALL', 'NOT_AT_ALL'];
  return { gate: 'YES_MINOR', duration: 'M1_5', distress: d, domains: { home: h, friends: f, classroom: c, leisure: l }, ...(over.gate ? { gate: over.gate } : {}) };
};

describe('level → score mapping (ไม่เลย=0, เล็กน้อย=0, ค่อนข้างมาก=1, มาก=2)', () => {
  it('maps each of the 4 options', () => {
    expect(impactLevelScore('NOT_AT_ALL')).toBe(0);
    expect(impactLevelScore('A_LITTLE')).toBe(0);
    expect(impactLevelScore('QUITE_A_LOT')).toBe(1);
    expect(impactLevelScore('A_GREAT_DEAL')).toBe(2);
    expect(IMPACT_LEVEL_OPTIONS.map((o) => o.label)).toEqual(['ไม่เลย', 'เล็กน้อย', 'ค่อนข้างมาก', 'มาก']);
  });
});

describe('classifyImpactTotal — every value 0..10', () => {
  it('0 normal | 1-2 at risk | 3-10 problem (both sides of each cut-off)', () => {
    const expected = (n: number) => (n === 0 ? 'NORMAL' : n <= 2 ? 'AT_RISK' : 'VULNERABLE');
    for (let n = 0; n <= 10; n++) expect(classifyImpactTotal(n), `total=${n}`).toBe(expected(n));
    expect([0, 1, 2, 3, 10].map(classifyImpactTotal)).toEqual(['NORMAL', 'AT_RISK', 'AT_RISK', 'VULNERABLE', 'VULNERABLE']);
  });
});

describe('gate question = "ไม่" skips everything and records normal', () => {
  it('returns normal with total 0 and stores no duration / distress / domain scores', () => {
    const r = computeImpact({ ...EMPTY_IMPACT_FORM, gate: 'NO' });
    expect(r).toEqual({ ok: true, impact: { impactGateAnswer: 'NO', impactTotalScore: 0, impactTriage: 'NORMAL' } });
    if ('impact' in r) {
      for (const k of ['impactDurationMonths', 'impactDistressScore', 'impactDomainScores']) expect(k in r.impact).toBe(false);
    }
  });

  it('leftover answers typed before switching the gate back to "ไม่" are discarded, not stored or counted', () => {
    const r = computeImpact({ ...yes({ levels: ['A_GREAT_DEAL', 'A_GREAT_DEAL', 'A_GREAT_DEAL', 'A_GREAT_DEAL', 'A_GREAT_DEAL'] }), gate: 'NO' });
    expect(r).toEqual({ ok: true, impact: { impactGateAnswer: 'NO', impactTotalScore: 0, impactTriage: 'NORMAL' } });
  });

  it('the gate itself is required (empty = error, nothing assumed)', () => {
    const r = computeImpact(EMPTY_IMPACT_FORM);
    expect(r.ok).toBe(false);
    expect('errors' in r && Object.keys(r.errors)).toEqual(['gate']);
  });
});

describe('gate = "ใช่" (any of the 3 yes options) requires items 2, 3 and all 4 domains', () => {
  it('reports every missing field; duration is required but never scored', () => {
    for (const gate of ['YES_MINOR', 'YES_DEFINITE', 'YES_SEVERE'] as const) {
      const r = computeImpact({ ...EMPTY_IMPACT_FORM, gate });
      expect(r.ok).toBe(false);
      expect('errors' in r && Object.keys(r.errors).sort()).toEqual(['classroom', 'distress', 'duration', 'friends', 'home', 'leisure']);
    }
    const partial = computeImpact({ ...yes(), duration: '', domains: { home: 'QUITE_A_LOT', friends: '', classroom: 'A_LITTLE', leisure: 'A_LITTLE' } });
    expect('errors' in partial && Object.keys(partial.errors).sort()).toEqual(['duration', 'friends']);
  });

  it('the gate answer (minor / definite / severe) does not change the score — only items 3-4 do', () => {
    for (const gate of ['YES_MINOR', 'YES_DEFINITE', 'YES_SEVERE'] as const) {
      const r = computeImpact(yes({ gate, levels: ['QUITE_A_LOT', 'NOT_AT_ALL', 'NOT_AT_ALL', 'NOT_AT_ALL', 'NOT_AT_ALL'] }));
      expect('impact' in r && r.impact.impactTotalScore).toBe(1);
      expect('impact' in r && r.impact.impactGateAnswer).toBe(gate);
    }
  });

  it('duration is stored as-is and never changes the score', () => {
    for (const duration of ['LT_1', 'M1_5', 'M6_12', 'GT_12'] as const) {
      const r = computeImpact({ ...yes({ levels: ['A_GREAT_DEAL', 'NOT_AT_ALL', 'NOT_AT_ALL', 'NOT_AT_ALL', 'NOT_AT_ALL'] }), duration });
      expect('impact' in r && r.impact.impactDurationMonths).toBe(duration);
      expect('impact' in r && r.impact.impactTotalScore).toBe(2);
    }
  });
});

describe('total score boundaries (0 / 1 / 2 / 3 / 10) through the full form', () => {
  const N: ImpactLevel = 'NOT_AT_ALL', L: ImpactLevel = 'A_LITTLE', Q: ImpactLevel = 'QUITE_A_LOT', G: ImpactLevel = 'A_GREAT_DEAL';
  // [distress, home, friends, classroom, leisure]
  const cases: Array<{ name: string; levels: [ImpactLevel, ImpactLevel, ImpactLevel, ImpactLevel, ImpactLevel]; total: number; triage: string }> = [
    { name: 'all "ไม่เลย" (answered yes but nothing hurts)', levels: [N, N, N, N, N], total: 0, triage: 'NORMAL' },
    { name: 'all "เล็กน้อย" still scores 0', levels: [L, L, L, L, L], total: 0, triage: 'NORMAL' },
    { name: 'one "ค่อนข้างมาก" = 1', levels: [N, N, Q, N, N], total: 1, triage: 'AT_RISK' },
    { name: 'one "มาก" = 2', levels: [N, N, N, G, N], total: 2, triage: 'AT_RISK' },
    { name: 'two "ค่อนข้างมาก" = 2', levels: [Q, N, N, N, Q], total: 2, triage: 'AT_RISK' },
    { name: '"มาก" + "ค่อนข้างมาก" = 3 (first problem value)', levels: [G, N, N, N, Q], total: 3, triage: 'VULNERABLE' },
    { name: 'three "ค่อนข้างมาก" = 3', levels: [Q, Q, Q, N, N], total: 3, triage: 'VULNERABLE' },
    { name: 'all five "มาก" = 10 (maximum)', levels: [G, G, G, G, G], total: 10, triage: 'VULNERABLE' },
  ];
  for (const c of cases) {
    it(`${c.name} → ${c.total} ${c.triage}`, () => {
      const r = computeImpact(yes({ levels: c.levels }));
      expect(r.ok).toBe(true);
      if ('impact' in r) {
        expect(r.impact.impactTotalScore).toBe(c.total);
        expect(r.impact.impactTriage).toBe(c.triage);
      }
    });
  }
});

describe('the 5 boxes (distress + 4 domains) add up correctly and are stored separately', () => {
  it('distress counted once, each domain scored on its own', () => {
    const r = computeImpact(yes({ levels: ['QUITE_A_LOT', 'A_GREAT_DEAL', 'A_LITTLE', 'QUITE_A_LOT', 'NOT_AT_ALL'] }));
    expect(r.ok).toBe(true);
    if ('impact' in r) {
      expect(r.impact.impactDistressScore).toBe(1);
      expect(r.impact.impactDomainScores).toEqual({ home: 2, friends: 0, classroom: 1, leisure: 0 });
      expect(r.impact.impactTotalScore).toBe(1 + 2 + 0 + 1 + 0);
    }
  });

  it('impactTotal sums distress + all four domains (max 10), and the domain list is exactly home/friends/classroom/leisure', () => {
    expect(impactTotal(2, { home: 2, friends: 2, classroom: 2, leisure: 2 })).toBe(10);
    expect(impactTotal(0, { home: 1, friends: 0, classroom: 0, leisure: 0 })).toBe(1);
    expect(IMPACT_DOMAINS.map((d) => d.key)).toEqual(['home', 'friends', 'classroom', 'leisure']);
    expect(IMPACT_DOMAINS.map((d) => d.label)).toEqual(['ความเป็นอยู่ที่บ้าน', 'การคบเพื่อน', 'การเรียนในห้องเรียน', 'กิจกรรมยามว่าง']);
  });

  it('each single box contributes independently (moving "มาก" across the 5 boxes always gives 2)', () => {
    const base: ImpactLevel[] = ['NOT_AT_ALL', 'NOT_AT_ALL', 'NOT_AT_ALL', 'NOT_AT_ALL', 'NOT_AT_ALL'];
    for (let i = 0; i < 5; i++) {
      const levels = base.map((v, j) => (j === i ? 'A_GREAT_DEAL' : v)) as [ImpactLevel, ImpactLevel, ImpactLevel, ImpactLevel, ImpactLevel];
      const r = computeImpact(yes({ levels }));
      expect('impact' in r && r.impact.impactTotalScore, `box ${i}`).toBe(2);
    }
  });
});

describe('same criteria for all 3 evaluators; wording follows the evaluator', () => {
  it('computeImpact has no evaluator parameter (one criteria for student / teacher / parent)', () => {
    expect(computeImpact.length).toBe(1);
  });
  it('questions say "เด็ก" for the parent and "นักเรียน" for student / teacher', () => {
    expect(impactGateQuestion('PARENT')).toContain('เด็กมีปัญหาด้านอารมณ์ สมาธิ พฤติกรรม หรือความสามารถในการเข้ากับผู้อื่นหรือไม่');
    expect(impactGateQuestion('STUDENT')).toContain('นักเรียนมีปัญหา');
    expect(impactGateQuestion('TEACHER')).toContain('นักเรียนมีปัญหา');
    expect(impactDistressQuestion('PARENT')).toBe('ปัญหานี้ทำให้เด็กรู้สึกไม่สบายใจหรือไม่');
    expect(impactDistressQuestion('TEACHER')).toBe('ปัญหานี้ทำให้นักเรียนรู้สึกไม่สบายใจหรือไม่');
  });
});

describe('buildSdqSubmission — both pages in one document payload', () => {
  const scores = { emotional: '2', conduct: '1', hyperactivity: '2', peerProblems: '1', prosocial: '9' };

  it('merges page 1 (5 domains + statuses + criteriaVersion) and page 2 (impact) for each evaluator', () => {
    for (const ev of ['STUDENT', 'TEACHER', 'PARENT'] as const) {
      const ok = buildSdqSubmission(scores, yes({ levels: ['QUITE_A_LOT', 'NOT_AT_ALL', 'NOT_AT_ALL', 'NOT_AT_ALL', 'A_GREAT_DEAL'] }), ev);
      expect(ok.ok, ev).toBe(true);
      if (ok.ok) {
        expect(ok.fields.totalDifficultiesScore).toBe(6);
        expect(ok.fields.criteriaVersion).toBe('dmh-obec-2');
        expect(ok.fields.subscaleScores.prosocial).toBe(9);
        // หน้าที่ 2 ใช้เกณฑ์เดียวกันทุกผู้ประเมิน
        expect(ok.fields.impactTotalScore).toBe(3);
        expect(ok.fields.impactTriage).toBe('VULNERABLE');
      }
    }
  });

  it('gate = ไม่ is a complete submission (page 2 skipped)', () => {
    const r = buildSdqSubmission(scores, { ...EMPTY_IMPACT_FORM, gate: 'NO' }, 'PARENT');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.fields.impactTriage).toBe('NORMAL');
  });

  it('fails (and writes nothing) if either page is incomplete, reporting errors for each page', () => {
    const noImpact = buildSdqSubmission(scores, EMPTY_IMPACT_FORM, 'TEACHER');
    expect(noImpact.ok).toBe(false);
    expect('scoreErrors' in noImpact && Object.keys(noImpact.scoreErrors)).toEqual([]);
    expect('impactErrors' in noImpact && Object.keys(noImpact.impactErrors)).toEqual(['gate']);
    const noScores = buildSdqSubmission({ ...scores, emotional: '' }, { ...EMPTY_IMPACT_FORM, gate: 'NO' }, 'TEACHER');
    expect('scoreErrors' in noScores && Object.keys(noScores.scoreErrors)).toEqual(['emotional']);
  });
});

describe('wiring guards', () => {
  const src = (rel: string) => readSource(path.resolve(__dirname, '../..', rel));

  it('the criteria source is written into the impact file', () => {
    const s = src('src/lib/sdqImpact.ts');
    expect(s).toContain('กรมสุขภาพจิต');
    expect(s).toContain('หน้า 139-141');
  });
  it('both entry points use the combined 2-page form + submission builder', () => {
    expect(src('src/components/advisor/AdvisorSdqPanel.tsx')).toContain('<SdqEntryForm');
    expect(src('src/components/student-parent/HealthMentalWellbeingModule.tsx')).toContain('<SdqEntryForm');
    expect(src('src/components/shared/SdqEntryForm.tsx')).toContain('<SdqImpactForm');
  });
  it('Guidance and the trend section show the impact result separately from the 5-domain result', () => {
    const g = src('src/components/guidance/GuidancePortal.tsx');
    expect(g).toContain('data-testid="sdq-impact-card"');
    expect(g).toContain('ความรุนแรงของผลกระทบ');
    const t = src('src/components/guidance/SdqTrendSection.tsx');
    expect(t).toContain('ผลกระทบ (ความรุนแรงของปัญหา)');
    expect(src('src/components/shared/SdqStatusView.tsx')).toContain('ชนิดของปัญหา (5 ด้าน)');
  });
});
