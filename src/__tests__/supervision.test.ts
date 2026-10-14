import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { readSource } from './helpers/readSource';
import {
  SUPERVISION_ITEMS, SUPERVISION_MAX_SCORE, buildObservationFields, canObserve, computeObservation,
  summarizeObservations, supervisionBand, supervisionScopes, validateForSubmit, type ObservationFormInput,
} from '../lib/supervision';
import {
  observableTeachers, observationStatus, overviewQuery, progressCounts, resultsQuery, supervisorsOf, type StaffRow,
} from '../lib/supervisionView';

const all = (n: number) => Object.fromEntries(SUPERVISION_ITEMS.map(i => [i.id, n]));
const teacher = (id: string, dept: string, extra: Partial<StaffRow> = {}): StaffRow =>
  ({ id, firstName: id, lastName: '', roles: ['SUBJECT_TEACHER'], status: 'ACTIVE', assignments: { departmentId: dept }, ...extra });

describe('แบบสังเกตการสอน 20 ข้อ', () => {
  it('มี 20 ข้อ เต็ม 100', () => {
    expect(SUPERVISION_ITEMS).toHaveLength(20);
    expect(SUPERVISION_MAX_SCORE).toBe(100);
  });
  it('เกณฑ์ ≥91 ดีมาก, 81–90 ดี, 71–80 พอใช้, 61–70 ควรปรับปรุง, ≤60 ไม่ผ่าน (ไม่มีช่องว่าง)', () => {
    expect(supervisionBand(100)).toBe('ดีมาก'); expect(supervisionBand(91)).toBe('ดีมาก');
    expect(supervisionBand(90.5)).toBe('ดี'); expect(supervisionBand(81)).toBe('ดี');
    expect(supervisionBand(80)).toBe('พอใช้'); expect(supervisionBand(71)).toBe('พอใช้');
    expect(supervisionBand(70)).toBe('ควรปรับปรุง'); expect(supervisionBand(61)).toBe('ควรปรับปรุง');
    expect(supervisionBand(60)).toBe('ไม่ผ่าน'); expect(supervisionBand(0)).toBe('ไม่ผ่าน');
  });
  it('ตอบไม่ครบ = ไม่มีเปอร์เซ็นต์/ผลสรุป; ครบ = คำนวณ', () => {
    expect(computeObservation({ s1_1: 5 })).toMatchObject({ answered: 1, complete: false, percent: null, band: null });
    expect(computeObservation(all(4))).toMatchObject({ complete: true, total: 80, percent: 80, band: 'พอใช้' });
    expect(computeObservation({ ...all(5), s1_1: 9 }).complete).toBe(false); // คะแนนนอกช่วง ไม่นับ
  });
  it('validateForSubmit: ต้องครบ 20 ข้อ + วิชา + วันที่', () => {
    const base: ObservationFormInput = {
      roundId: '2569_1', teacher: { staffId: 't', name: 'ครู', departmentId: 'D1' }, supervisor: { staffId: 's', name: 'ผู้นิเทศ' },
      courseCode: '', courseName: 'ไทย', level: '', observedDate: '2026-09-01', observedTime: '', scores: all(5),
      assessmentMethod: '', strengths: '', improvements: '', comment: '', photos: [],
    };
    expect(validateForSubmit(base)).toBeNull();
    expect(validateForSubmit({ ...base, scores: { s1_1: 5 } })).toMatch(/ไม่ครบ/);
    expect(validateForSubmit({ ...base, courseName: ' ' })).toMatch(/รายวิชา/);
    expect(validateForSubmit({ ...base, observedDate: '' })).toMatch(/วันที่/);
    const f = buildObservationFields(base, true);
    expect(f).toMatchObject({ total: 100, percent: 100, band: 'ดีมาก', submitted: true, acknowledged: false, templateVersion: 1 });
    expect(buildObservationFields({ ...base, scores: { s1_1: 3 } }, false)).toMatchObject({ percent: null, band: null, submitted: false });
  });
});

describe('สิทธิ์ผู้นิเทศ', () => {
  it('หัวหน้า/รองหัวหน้ากลุ่มสาระฯ นิเทศครูกลุ่มสาระฯ ตนเองโดยตำแหน่ง; ครูนิเทศต้องถูกจับคู่; ห้ามนิเทศตัวเอง', () => {
    const hod = { staffId: 'h', roles: ['HEAD_OF_DEPARTMENT'], departmentId: 'D1' };
    expect(canObserve(hod, { staffId: 't', departmentId: 'D1' }, [])).toBe(true);
    expect(canObserve(hod, { staffId: 't', departmentId: 'D2' }, [])).toBe(false);
    expect(canObserve(hod, { staffId: 'h', departmentId: 'D1' }, [])).toBe(false);
    const dep = { staffId: 'd', roles: ['DEPUTY_HEAD_OF_DEPARTMENT'], departmentId: 'D1' };
    expect(canObserve(dep, { staffId: 't', departmentId: 'D1' }, [])).toBe(true);
    const sup = { staffId: 's', roles: ['SUPERVISORY_TEACHER'], departmentId: 'D3' };
    expect(canObserve(sup, { staffId: 't', departmentId: 'D1' }, [])).toBe(false);
    expect(canObserve(sup, { staffId: 't', departmentId: 'D1' }, ['t'])).toBe(true);
    expect(canObserve({ staffId: 'x', roles: ['SUBJECT_TEACHER'] }, { staffId: 't' }, ['t'])).toBe(false);
  });
  it('observableTeachers: เฉพาะครูที่ยังใช้งาน, ไม่รวมตัวเอง, ตามจับคู่/กลุ่มสาระฯ', () => {
    const staff = [teacher('a', 'D1'), teacher('b', 'D1'), teacher('c', 'D2'), teacher('x', 'D1', { status: 'INACTIVE' }), teacher('h', 'D1', { roles: ['HEAD_OF_DEPARTMENT', 'SUBJECT_TEACHER'] })];
    const ids = (l: StaffRow[]) => l.map(s => s.id).sort();
    expect(ids(observableTeachers({ staffId: 'h', roles: ['HEAD_OF_DEPARTMENT'], departmentId: 'D1' }, staff, []))).toEqual(['a', 'b']);
    expect(ids(observableTeachers({ staffId: 's', roles: ['SUPERVISORY_TEACHER'] }, staff, [{ teacherStaffId: 'c', supervisorStaffId: 's' }, { teacherStaffId: 'a', supervisorStaffId: 'other' }]))).toEqual(['c']);
  });
  it('supervisorsOf: ผู้นิเทศโดยตำแหน่ง + ที่จับคู่ ไม่ซ้ำ', () => {
    const staff = [teacher('a', 'D1'), teacher('h', 'D1', { roles: ['HEAD_OF_DEPARTMENT'] }), teacher('s', 'D3', { roles: ['SUPERVISORY_TEACHER'] })];
    const r = supervisorsOf(staff[0], staff, [{ teacherStaffId: 'a', supervisorStaffId: 's' }, { teacherStaffId: 'a', supervisorStaffId: 'h' }]);
    expect(r.map(x => `${x.staff.id}:${x.basis}`).sort()).toEqual(['h:EX_OFFICIO', 's:ASSIGNED']);
  });
  it('ขอบเขตการเห็นผลรายบุคคลตามที่ผู้ใช้กำหนด', () => {
    expect(resultsQuery(['INSTRUCTIONAL_SUPERVISOR'], 's', '')).toEqual({ scope: 'ALL', submittedOnly: false });
    expect(resultsQuery(['DIRECTOR'], 's', '')).toEqual({ scope: 'ALL', submittedOnly: true });
    expect(resultsQuery(['DEPUTY_DIRECTOR_ACADEMIC'], 's', '')).toEqual({ scope: 'ALL', submittedOnly: true });
    expect(resultsQuery(['HEAD_OF_DEPARTMENT'], 's', 'D1')).toEqual({ scope: 'DEPARTMENT', departmentId: 'D1' });
    expect(resultsQuery(['DEPUTY_HEAD_OF_DEPARTMENT'], 's', 'D1')).toEqual({ scope: 'DEPARTMENT', departmentId: 'D1' });
    expect(resultsQuery(['SUPERVISORY_TEACHER'], 's', 'D1')).toEqual({ scope: 'SUPERVISED', staffId: 's' });
    expect(resultsQuery(['EXECUTIVE'], 's', '')).toBeNull(); // ผู้บริหารเห็นภาพรวมเท่านั้น
    expect(resultsQuery(['SUBJECT_TEACHER'], 's', 'D1')).toBeNull();
    expect(overviewQuery(['EXECUTIVE'])).toEqual({ scope: 'ALL', submittedOnly: true });
    expect(overviewQuery(['HEAD_OF_DEPARTMENT'])).toBeNull();
    expect(supervisionScopes(['SUBJECT_TEACHER'])).toEqual(['SELF']);
  });
});

describe('สถานะ/ภาพรวม', () => {
  it('observationStatus / progressCounts', () => {
    expect(observationStatus(null)).toBe('NONE');
    expect(observationStatus({ submitted: false, acknowledged: false })).toBe('DRAFT');
    expect(observationStatus({ submitted: true, acknowledged: false })).toBe('SUBMITTED');
    expect(observationStatus({ submitted: true, acknowledged: true })).toBe('ACKNOWLEDGED');
    const c = progressCounts([{ id: 'a' }, { id: 'b' }, { id: 'c' }], [
      { teacherStaffId: 'a', submitted: true, acknowledged: true }, { teacherStaffId: 'b', submitted: false, acknowledged: false },
    ]);
    expect(c).toMatchObject({ NONE: 1, DRAFT: 1, ACKNOWLEDGED: 1, SUBMITTED: 0, total: 3 });
  });
  it('summarizeObservations: นับเฉพาะที่ส่งแล้ว ไม่มีชื่อบุคคลในผลลัพธ์', () => {
    const mk = (n: number, submitted = true) => {
      const r = computeObservation(all(n));
      return { submitted, acknowledged: false, percent: r.percent, band: r.band, scores: all(n) };
    };
    const o = summarizeObservations([mk(5), mk(4), mk(3, false)]);
    expect(o.submitted).toBe(2);
    expect(o.averagePercent).toBe(90);
    expect(o.bands['ดีมาก']).toBe(1);
    expect(JSON.stringify(o)).not.toMatch(/teacherName|teacherStaffId/);
    expect(summarizeObservations([]).averagePercent).toBeNull();
  });
});

describe('guard: ระบบนิเทศ', () => {
  const root = path.resolve(__dirname, '../..');
  const src = (rel: string) => readSource(path.join(root, rel));
  it('SupervisionPortal ไม่มีข้อมูลปลอม (hardcode) — ใช้ SupervisionWorkspace จาก Firestore', () => {
    const s = src('src/components/supervision/SupervisionPortal.tsx');
    expect(s).toContain('SupervisionWorkspace');
    expect(s).not.toMatch(/นายเกียรติศักดิ์|LP-00\d|mock/i);
  });
  it('ExecutiveSupervisionOverview ใช้ overviewQuery + SupervisionOverviewPanel (ภาพรวมเท่านั้น ไม่มี list รายคน)', () => {
    const s = src('src/components/supervision/ExecutiveSupervisionOverview.tsx');
    expect(s).toContain('SupervisionOverviewPanel');
    expect(s).not.toMatch(/teacherName|ObservationResultView/);
    expect(src('src/ExecutivePortal.tsx')).toContain("activeTab === 'supervision' && <ExecutiveSupervisionOverview />");
  });
  it('firestore.rules: SUPER_ADMIN ไม่อยู่ในกฎอ่านผลรายบุคคล', () => {
    const rules = src('firestore.rules');
    const block = rules.slice(rules.indexOf('match /supervision_observations/{oid}'));
    const readRule = block.slice(block.indexOf('allow read:'), block.indexOf('allow create:'));
    expect(readRule).not.toContain('SUPER_ADMIN');
    expect(readRule).toContain("hasRole('INSTRUCTIONAL_SUPERVISOR')");
  });
  it('แบบสอบถามใน rules ตรงกับ SUPERVISION_ITEMS (20 key เดียวกัน)', () => {
    const rules = src('firestore.rules');
    const m = rules.match(/function supScoresShapeOk\(sc\) \{[\s\S]*?hasOnly\(\[([^\]]+)\]\)/);
    const keys = (m?.[1] || '').split(',').map(k => k.trim().replace(/'/g, '')).sort();
    expect(keys).toEqual(SUPERVISION_ITEMS.map(i => i.id).sort());
  });
});
