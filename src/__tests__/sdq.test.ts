import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { classifySdqTotal, computeSdq, validateSdqScores, sdqDocId, isValidAcademicYear } from '../lib/sdq';
import { readSource } from './helpers/readSource';

describe('SDQ scoring (same thresholds the student/parent module always used)', () => {
  it('classifies the total of the 4 difficulty subscales: <14 normal, 14-16 at risk, >=17 vulnerable', () => {
    expect(classifySdqTotal(0)).toBe('NORMAL');
    expect(classifySdqTotal(13)).toBe('NORMAL');
    expect(classifySdqTotal(14)).toBe('AT_RISK');
    expect(classifySdqTotal(16)).toBe('AT_RISK');
    expect(classifySdqTotal(17)).toBe('VULNERABLE');
    expect(classifySdqTotal(40)).toBe('VULNERABLE');
  });

  it('computeSdq totals only the 4 difficulty subscales (prosocial is a strength, not counted)', () => {
    const r = computeSdq({ emotional: 4, conduct: 3, hyperactivity: 5, peerProblems: 2, prosocial: 10 });
    expect(r.totalDifficultiesScore).toBe(14);
    expect(r.triagingStatus).toBe('AT_RISK');
    expect(r.recommendations[0]).toContain('14/40');
    expect(r.recommendations[0]).toContain('กลุ่มเสี่ยง');
    expect(computeSdq({ emotional: 0, conduct: 0, hyperactivity: 0, peerProblems: 0, prosocial: 0 }).triagingStatus).toBe('NORMAL');
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
  it('the student/parent module no longer saves hardcoded default scores and stamps the academic year', () => {
    const s = src('src/components/student-parent/HealthMentalWellbeingModule.tsx');
    expect(s).not.toMatch(/emotional:\s*2,\s*\n?\s*conduct:\s*1/);
    expect(s).toContain('useState<SdqFormValues>(EMPTY_SDQ_FORM)');
    expect(s).toContain('academicYear: currentAcademicYear');
  });
  it('the store derives the id from (student, evaluator, year) and refuses a missing year', () => {
    const s = src('src/store.ts');
    expect(s).toContain('id: sdqDocId(sdq.studentId, sdq.evaluatorType, sdq.academicYear)');
    expect(s).toContain('isValidAcademicYear(sdq.academicYear)');
  });
  it('AdvisorPortal exposes the SDQ tab and the panel saves as TEACHER with the school year', () => {
    expect(src('src/AdvisorPortal.tsx')).toContain("{ id: 'sdq', label: 'SDQ นักเรียน', icon: Heart }");
    const p = src('src/components/advisor/AdvisorSdqPanel.tsx');
    expect(p).toContain("evaluatorType: 'TEACHER'");
    expect(p).toContain('academicYear,');
    expect(p).not.toMatch(/useState\(\s*students\[0\]/); // ไม่ auto-select นักเรียนคนแรก
  });
  it('GuidancePortal no longer hardcodes the year in the SDQ heading', () => {
    const g = src('src/components/guidance/GuidancePortal.tsx');
    expect(g).not.toContain('ประจำปีการศึกษา 2569');
    expect(g).toContain('<SdqTrendSection');
  });
});
