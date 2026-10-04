import { describe, it, expect } from 'vitest';
import { buildSdqTrend, buildSdqRoomStatus, filterSdqByYear, SdqTrendRecord } from '../lib/sdqTrend';
import { computeSdq, SdqEvaluatorType, SdqScores } from '../lib/sdq';

function rec(studentId: string, year: string | null | undefined, scores: Partial<SdqScores> = {}, over: Partial<SdqTrendRecord> = {}): SdqTrendRecord {
  const s: SdqScores = { emotional: 2, conduct: 2, hyperactivity: 2, peerProblems: 2, prosocial: 8, ...scores };
  const c = computeSdq(s);
  return { studentId, evaluatorType: 'TEACHER', academicYear: year, assessmentDate: '2026-06-01', subscaleScores: s, totalDifficultiesScore: c.totalDifficultiesScore, triagingStatus: c.triagingStatus, ...over };
}

describe('buildSdqTrend', () => {
  it('no data at all → empty, no trend, no error', () => {
    const t = buildSdqTrend([]);
    expect(t).toMatchObject({ years: [], hasTrend: false, availableYears: [], legacyCount: 0, delta: null });
  });

  it('first year of the system (one year only) → one year card, hasTrend false, delta null (blank, not an error)', () => {
    const t = buildSdqTrend([rec('1', '2569'), rec('2', '2569', { emotional: 4 })]);
    expect(t.years).toHaveLength(1);
    expect(t.hasTrend).toBe(false);
    expect(t.delta).toBeNull();
    expect(t.years[0]).toMatchObject({ year: '2569', responses: 2, students: 2 });
    expect(t.years[0].averages.emotional).toBe(3);
  });

  it('two years → per-subscale averages and the latest-vs-previous delta', () => {
    const t = buildSdqTrend([
      rec('1', '2569', { emotional: 6, prosocial: 5 }), rec('2', '2569', { emotional: 4, prosocial: 7 }),
      rec('1', '2570', { emotional: 3, prosocial: 9 }), rec('2', '2570', { emotional: 3, prosocial: 9 }),
    ]);
    expect(t.hasTrend).toBe(true);
    expect(t.years.map(y => y.year)).toEqual(['2569', '2570']);
    expect(t.years[0].averages.emotional).toBe(5);
    expect(t.years[1].averages.emotional).toBe(3);
    expect(t.delta?.averages.emotional).toBe(-2);
    expect(t.delta?.averages.prosocial).toBe(3);
    expect(t.delta?.averages.conduct).toBe(0);
  });

  it('keeps only the latest N years (default 3), oldest → newest, but lists every year for the selector (newest first)', () => {
    const t = buildSdqTrend(['2567', '2568', '2569', '2570'].map((y) => rec('1', y)));
    expect(t.years.map(y => y.year)).toEqual(['2568', '2569', '2570']);
    expect(t.availableYears).toEqual(['2570', '2569', '2568', '2567']);
    expect(buildSdqTrend(['2568', '2569', '2570'].map((y) => rec('1', y)), { maxYears: 2 }).years.map(y => y.year)).toEqual(['2569', '2570']);
  });

  it('sorts years numerically, not by input order', () => {
    expect(buildSdqTrend([rec('1', '2570'), rec('1', '2568'), rec('1', '2569')]).years.map(y => y.year)).toEqual(['2568', '2569', '2570']);
  });

  it('a gap year (2568 then 2570) still compares the two most recent years that have data', () => {
    const t = buildSdqTrend([rec('1', '2568', { conduct: 6 }), rec('1', '2570', { conduct: 2 })]);
    expect(t.hasTrend).toBe(true);
    expect(t.delta?.averages.conduct).toBe(-4);
  });

  it('duplicates of (student, evaluator, year) count once — the latest assessmentDate wins', () => {
    const t = buildSdqTrend([
      rec('1', '2569', { emotional: 9 }, { assessmentDate: '2026-01-01' }),
      rec('1', '2569', { emotional: 1 }, { assessmentDate: '2026-03-01' }),
    ]);
    expect(t.years[0].responses).toBe(1);
    expect(t.years[0].averages.emotional).toBe(1);
  });

  it('different evaluators of the same student/year are separate responses; the evaluator filter narrows them', () => {
    const rows = [rec('1', '2569', { emotional: 8 }), rec('1', '2569', { emotional: 2 }, { evaluatorType: 'PARENT' })];
    expect(buildSdqTrend(rows).years[0].responses).toBe(2);
    expect(buildSdqTrend(rows).years[0].averages.emotional).toBe(5);
    expect(buildSdqTrend(rows, { evaluatorType: 'PARENT' }).years[0].averages.emotional).toBe(2);
    expect(buildSdqTrend(rows, { evaluatorType: 'STUDENT' }).years).toEqual([]);
  });

  it('records without an academic year (pre-feature data) count as legacy and are never mixed into a year', () => {
    const t = buildSdqTrend([rec('1', undefined, { emotional: 10 }), rec('2', null), rec('3', ''), rec('4', 'abc'), rec('5', '2569', { emotional: 2 })]);
    expect(t.legacyCount).toBe(4);
    expect(t.years).toHaveLength(1);
    expect(t.years[0].averages.emotional).toBe(2);
  });

  it('counts triage buckets per year and rounds averages to 2 decimals', () => {
    const t = buildSdqTrend([rec('1', '2569', { emotional: 5, conduct: 5, hyperactivity: 5, peerProblems: 2 }), rec('2', '2569'), rec('3', '2569', { emotional: 1 })]);
    expect(t.years[0].triage).toEqual({ NORMAL: 2, AT_RISK: 0, VULNERABLE: 1 });
    expect(t.years[0].averages.emotional).toBe(2.67);
  });
});

describe('filterSdqByYear', () => {
  const rows = [rec('1', '2569'), rec('2', '2570'), rec('3', undefined)];
  it('ALL keeps everything, a year keeps that year, LEGACY keeps those without a valid year', () => {
    expect(filterSdqByYear(rows, 'ALL')).toHaveLength(3);
    expect(filterSdqByYear(rows, '2569').map(r => r.studentId)).toEqual(['1']);
    expect(filterSdqByYear(rows, 'LEGACY').map(r => r.studentId)).toEqual(['3']);
    expect(filterSdqByYear(rows, '2599')).toEqual([]);
  });
});

describe('buildSdqRoomStatus (advisor roster: who has / has not been assessed this year)', () => {
  const ids = ['1', '2', '3'];
  it('marks done/pending per evaluator for the given year only', () => {
    const r = buildSdqRoomStatus(ids, [
      rec('1', '2569'),                                                          // ครู ปีนี้ ✓
      rec('2', '2568'),                                                          // ครู ปีก่อน — ไม่นับเป็นของปีนี้
      rec('3', '2569', {}, { evaluatorType: 'PARENT' as SdqEvaluatorType }),     // ผู้ปกครอง ปีนี้ — ครูยังไม่กรอก
      rec('99', '2569'),                                                         // ไม่ใช่นักเรียนในห้อง — ไม่นับ
    ], '2569');
    expect(r.total).toBe(3);
    expect(r.teacherDone).toBe(1);
    expect(r.rows.find(x => x.studentId === '1')?.byEvaluator.TEACHER).toBe(true);
    expect(r.rows.find(x => x.studentId === '1')?.teacherResult?.triagingStatus).toBe('NORMAL');
    expect(r.rows.find(x => x.studentId === '2')?.byEvaluator.TEACHER).toBe(false);
    expect(r.rows.find(x => x.studentId === '3')?.byEvaluator).toEqual({ STUDENT: false, TEACHER: false, PARENT: true });
    expect(r.rows.find(x => x.studentId === '3')?.teacherResult).toBeNull();
  });

  it('empty room / no records → everyone pending, no error', () => {
    expect(buildSdqRoomStatus([], [], '2569')).toEqual({ rows: [], teacherDone: 0, total: 0 });
    expect(buildSdqRoomStatus(ids, [], '2569').teacherDone).toBe(0);
  });
});
