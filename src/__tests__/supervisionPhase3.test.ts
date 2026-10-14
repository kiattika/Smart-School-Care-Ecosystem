import { describe, it, expect } from 'vitest';
import { readSource } from './helpers/readSource';
import { emptyPlc, groupPlcCycles, isCycleComplete, validatePlc, type PlcContent } from '../lib/plc';
import { emptyReflection, isReflectionComplete, validateReflection } from '../lib/reflection';
import { pct, semesterRange, summarizePostTeaching } from '../lib/portfolio';
import type { PostTeachingRecord } from '../types';

const ok: PlcContent = { ...emptyPlc(), groupName: 'PLC คณิต', topic: 'การคิดวิเคราะห์', meetingDate: '2026-09-01', summary: 'ประชุมวางแผน' };

describe('PLC', () => {
  it('validatePlc', () => {
    expect(validatePlc(ok)).toEqual([]);
    expect(validatePlc({ ...ok, groupName: ' ' })[0]).toMatch(/ชื่อกลุ่ม/);
    expect(validatePlc({ ...ok, topic: '' })[0]).toMatch(/ประเด็น/);
    expect(validatePlc({ ...ok, meetingDate: '' })[0]).toMatch(/วันที่/);
    expect(validatePlc({ ...ok, summary: '' })[0]).toMatch(/สรุป/);
    expect(validatePlc({ ...ok, evidenceUrl: 'http://x.co/a' })[0]).toMatch(/https/);
    expect(validatePlc({ ...ok, evidenceUrl: 'https://x.co/a' })).toEqual([]);
    expect(validatePlc({ ...ok, members: Array(21).fill('ก') })[0]).toMatch(/สมาชิก/);
  });
  it('จัดวงจรตามกลุ่ม+ประเด็น เรียงวันที่ และครบ PDCA', () => {
    const mk = (g: string, t: string, d: string, step: 'PLAN' | 'DO' | 'CHECK' | 'ACT') => ({ groupName: g, topic: t, meetingDate: d, step });
    const cycles = groupPlcCycles([mk('A', 't1', '2026-09-10', 'DO'), mk('A', 't1', '2026-09-01', 'PLAN'), mk('B', 't2', '2026-10-01', 'PLAN'), mk('A', 't1', '2026-09-20', 'CHECK'), mk('A', 't1', '2026-09-30', 'ACT')]);
    expect(cycles).toHaveLength(2);
    expect(cycles[0].groupName).toBe('B'); // ล่าสุดก่อน
    const a = cycles.find(c => c.groupName === 'A')!;
    expect(a.logs.map(l => l.meetingDate)).toEqual(['2026-09-01', '2026-09-10', '2026-09-20', '2026-09-30']);
    expect(isCycleComplete(a.steps)).toBe(true);
    expect(isCycleComplete(cycles[0].steps)).toBe(false);
  });
});

describe('reflection', () => {
  it('ครบเมื่อกรอกหัวข้อที่จำเป็น (จุดเด่นไม่บังคับ)', () => {
    const r = { ...emptyReflection(), outcomes: 'a', problems: 'b', improvements: 'c', nextPlan: 'd' };
    expect(isReflectionComplete(r)).toBe(true);
    expect(isReflectionComplete({ ...r, nextPlan: ' ' })).toBe(false);
    expect(validateReflection({ ...r, outcomes: 'x'.repeat(2001) })[0]).toMatch(/2,000/);
  });
});

describe('portfolio', () => {
  it('ช่วงภาคเรียนตามปฏิทินมาตรฐาน', () => {
    expect(semesterRange('2569', '1')).toEqual({ from: '2026-05-01', to: '2026-10-31' });
    expect(semesterRange('2569', '2')).toEqual({ from: '2026-11-01', to: '2027-04-30' });
  });
  it('สรุปบันทึกหลังสอนเฉพาะของครูคนนี้ในช่วงวันที่ (ไม่มีผู้บันทึก = ไม่นับ)', () => {
    const base = { courseId: 'c', summary: '', problems: '', solutions: '', submittedAt: '' };
    const rec = (o: Partial<PostTeachingRecord>) => ({ ...base, date: '2026-09-01', isLate: false, recordedByStaffId: 't1', ...o }) as PostTeachingRecord;
    const list = [rec({}), rec({ isLate: true }), rec({ planUnitIds: ['u1'] }), rec({ planStatus: 'DEVIATED' }), rec({ recordedByStaffId: 't2' }), rec({ recordedByStaffId: undefined }), rec({ date: '2026-11-05' })];
    expect(summarizePostTeaching(list, 't1', '2026-05-01', '2026-10-31')).toEqual({ total: 4, late: 1, onTime: 3, linkedToPlan: 1, deviated: 1 });
    expect(summarizePostTeaching(list, '', '2026-05-01', '2026-10-31').total).toBe(0);
    expect(pct(1, 4)).toBe(25);
    expect(pct(0, 0)).toBeNull();
  });
});

describe('phase 3 wiring guards', () => {
  it('rules มีบล็อก plc_logs / teaching_reflections ตรงกับ service', () => {
    const rules = readSource('firestore.rules');
    expect(rules).toMatch(/match \/plc_logs\/\{lid\}/);
    expect(rules).toMatch(/match \/teaching_reflections\/\{rid\}/);
    expect(readSource('src/services/plcService.ts')).toContain("'plc_logs'");
    expect(readSource('src/services/reflectionService.ts')).toContain("'teaching_reflections'");
  });
  it('แฟ้มสะสมงานพิมพ์ได้ (print CSS ซ่อนส่วนอื่น + ปุ่มพิมพ์) และไม่มีข้อมูลตัวอย่าง', () => {
    const src = readSource('src/components/portfolio/PortfolioSheet.tsx');
    expect(src).toMatch(/@media print/);
    expect(src).toMatch(/window\.print\(\)/);
    expect(src).toMatch(/pf-no-print/);
  });
  it('เมนูครู + มุมมองผู้ตรวจเชื่อมครบ; ผู้ตรวจอ่านอย่างเดียว', () => {
    const tp = readSource('src/TeacherPortal.tsx');
    expect(tp).toMatch(/PlcReflectionPanel/);
    expect(tp).toMatch(/MyPortfolioPanel/);
    expect(readSource('src/components/lessonplans/LessonPlanReviewPanel.tsx')).toMatch(/PlcReflectionOverview/);
    expect(readSource('src/components/portfolio/PlcReflectionOverview.tsx')).not.toMatch(/savePlcLog|deletePlcLog|saveReflection/);
  });
});
