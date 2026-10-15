import { describe, it, expect } from 'vitest';
import {
  buildClassProfile, buildRoomRows, concernList, hasRound1, profileSummaryText, progressLabel, resultsOf, round2Eligibility,
  screensFor, sdqRound2DocId, triangulate, validateFollowUpReason, type SdqRecordLike,
} from '../lib/sdqScreening';
import { buildSdqRoomStatus, buildSdqTrend } from '../lib/sdqTrend';
import { sdqSection } from '../../functions/src/publicSummaryLogic';
import { readSource } from './helpers/readSource';

const rec = (studentId: string, evaluatorType: SdqRecordLike['evaluatorType'], triagingStatus: SdqRecordLike['triagingStatus'], extra: Partial<SdqRecordLike> = {}): SdqRecordLike => ({
  studentId, evaluatorType, academicYear: '2569', totalDifficultiesScore: 10, triagingStatus, ...extra,
});
const N = 'NORMAL' as const, R = 'AT_RISK' as const, V = 'VULNERABLE' as const;

describe('ความสอดคล้อง 3 ฝ่าย (แนบ ข้อ 2)', () => {
  const tri = (s?: SdqRecordLike['triagingStatus'], t?: SdqRecordLike['triagingStatus'], p?: SdqRecordLike['triagingStatus']) =>
    triangulate({ ...(s ? { STUDENT: { triagingStatus: s } } : {}), ...(t ? { TEACHER: { triagingStatus: t } } : {}), ...(p ? { PARENT: { triagingStatus: p } } : {}) });
  it('สอดคล้องทั้ง 3 ฝ่าย / ปกติทั้งหมด', () => {
    expect(tri(R, V, R).pattern).toBe('ALL_CONCERN');
    expect(tri(R, V, R).overall).toBe('VULNERABLE');
    expect(tri(N, N, N).pattern).toBe('ALL_NORMAL');
  });
  it('บ้าน-โรงเรียนขัดกัน (ครู vs ผู้ปกครอง)', () => {
    expect(tri(N, R, N).pattern).toBe('HOME_SCHOOL_CONFLICT');
    expect(tri(N, N, V).pattern).toBe('HOME_SCHOOL_CONFLICT');
  });
  it('ขัดที่ตัวนักเรียน (ครู+ผู้ปกครองว่ามีปัญหา นักเรียนว่าปกติ)', () => {
    expect(tri(N, R, V).pattern).toBe('STUDENT_INSIGHT_GAP');
    expect(tri(N, R, V).staffAction).toMatch(/ยึดผลของครู\/ผู้ปกครอง/);
  });
  it('นักเรียนเห็นปัญหาคนเดียว และกรณีประเมินไม่ครบ', () => {
    expect(tri(V, N, N).pattern).toBe('STUDENT_ONLY_CONCERN');
    expect(tri(R, R).pattern).toBe('INCOMPLETE');
    expect(tri(undefined, R, R).pattern).toBe('INCOMPLETE');
  });
});

describe('รอบการประเมิน', () => {
  const recs = [rec('s1', 'TEACHER', R), rec('s1', 'TEACHER', N, { round: 2 }), rec('s1', 'STUDENT', N)];
  it('รอบที่ 2 แยกจากรอบที่ 1 และไม่ทำให้ "ทำแล้ว" ของรอบ 1 เพี้ยน', () => {
    expect(resultsOf(recs, 's1', '2569', 1).TEACHER?.triagingStatus).toBe('AT_RISK');
    expect(resultsOf(recs, 's1', '2569', 2).TEACHER?.triagingStatus).toBe('NORMAL');
    expect(hasRound1(recs, 's1', 'PARENT', '2569')).toBe(false);
    expect(hasRound1([rec('s1', 'TEACHER', N, { round: 2 })], 's1', 'TEACHER', '2569')).toBe(false);
    expect(sdqRound2DocId('10001', '2569')).toBe('10001_TEACHER_2569_R2');
  });
  it('สิทธิ์ประเมินซ้ำจากผลรอบแรก + เหตุผลจำเป็น + เทียบความก้าวหน้า', () => {
    const e = round2Eligibility(resultsOf(recs, 's1', '2569', 1));
    expect(e.byRisk).toBe(true);
    expect(e.autoReason).toContain('ครู เสี่ยง');
    expect(round2Eligibility({ STUDENT: { triagingStatus: N } }).byRisk).toBe(false);
    expect(validateFollowUpReason('  ')).not.toBeNull();
    expect(validateFollowUpReason('ดูแลใกล้ชิด')).toBeNull();
    expect(progressLabel(R, N).tone).toBe('better');
    expect(progressLabel(N, V).tone).toBe('worse');
  });
  it('แนวโน้มข้ามปี/สถานะการกรอกของห้อง ใช้รอบที่ 1 เท่านั้น', () => {
    const full = recs.map(r => ({ ...r, subscaleScores: { emotional: 1, conduct: 1, hyperactivity: 1, peerProblems: 1, prosocial: 8 }, assessmentDate: r.round === 2 ? '2027-01-01' : '2026-06-01' }));
    expect(buildSdqRoomStatus(['s1'], full, '2569').rows[0].teacherResult?.triagingStatus).toBe('AT_RISK');
    expect(buildSdqTrend(full, { evaluatorType: 'TEACHER' }).years.length).toBeGreaterThan(0);
  });
});

describe('สรุปผลการคัดกรองรายชั้นเรียน (แนบ ข้อ 3)', () => {
  const sub = (e: SdqRecordLike['triagingStatus'], h: SdqRecordLike['triagingStatus']) => ({ emotional: e, conduct: N, hyperactivity: h, peerProblems: N, prosocial: 'HAS_STRENGTH' as const });
  const recs = [
    rec('a', 'TEACHER', N, { subscaleStatus: sub(N, N) }),
    rec('b', 'TEACHER', R, { subscaleStatus: sub(R, N) }),
    rec('c', 'TEACHER', V, { subscaleStatus: sub(N, V) }),
    rec('d', 'TEACHER', N), // ผลรุ่นเก่า ไม่มีรายด้าน
    rec('a', 'PARENT', V, { subscaleStatus: sub(V, N) }),
  ];
  it('นับจำนวน/ร้อยละรายด้าน และรวม 3 ฝ่ายใช้ผลที่รุนแรงสุด', () => {
    const p = buildClassProfile(screensFor(recs, ['a', 'b', 'c', 'd', 'e'], '2569', 'TEACHER'), 5);
    expect(p.assessed).toBe(4);
    expect(p.rows.total).toEqual({ normal: 2, risk: 1, problem: 1, n: 4 });
    expect(p.rows.emotional).toEqual({ normal: 2, risk: 1, problem: 0, n: 3 });
    expect(p.rows.prosocial.normal).toBe(3);
    const w = screensFor(recs, ['a'], '2569', 'WORST');
    expect(w[0].overall).toBe('VULNERABLE');
    expect(w[0].sub.emotional).toBe('VULNERABLE');
  });
  it('รายชื่อกลุ่มเสี่ยง/มีปัญหา + ด้านที่เด่นชัด และข้อความสรุป', () => {
    const screens = screensFor(recs, ['a', 'b', 'c', 'd'], '2569', 'TEACHER');
    const list = concernList(screens);
    expect(list.map(r => r.studentId)).toEqual(['c', 'b']);
    expect(list[0].prominent).toEqual(['hyperactivity']);
    expect(profileSummaryText(buildClassProfile(screens, 4))).toMatch(/ร้อยละ 50/);
  });
  it('รายห้อง (ผู้บริหาร) ไม่มีชื่อ', () => {
    const rows = buildRoomRows(screensFor(recs, ['a', 'b', 'c'], '2569', 'TEACHER'), id => (id === 'c' ? 'ม.1/2' : 'ม.1/1'), new Map([['ม.1/1', 40], ['ม.1/2', 38]]));
    expect(rows).toEqual([
      { room: 'ม.1/1', total: 40, assessed: 2, normal: 1, risk: 1, problem: 0 },
      { room: 'ม.1/2', total: 38, assessed: 1, normal: 0, risk: 0, problem: 1 },
    ]);
  });
});

describe('หน้า info สาธารณะ: SDQ ทั้งโรงเรียน (มุมมองครู รอบ 1 ปีปัจจุบัน) ซ่อนช่อง <5', () => {
  it('นับเฉพาะ TEACHER รอบ 1 ปีนั้น และซ่อนตัวเลขเล็ก', () => {
    const rows = [
      ...Array.from({ length: 12 }, () => ({ evaluatorType: 'TEACHER', academicYear: '2569', triagingStatus: 'NORMAL', subscaleStatus: { emotional: 'NORMAL' } })),
      ...Array.from({ length: 6 }, () => ({ evaluatorType: 'TEACHER', academicYear: '2569', triagingStatus: 'AT_RISK', subscaleStatus: { emotional: 'AT_RISK' } })),
      { evaluatorType: 'TEACHER', academicYear: '2569', triagingStatus: 'VULNERABLE', subscaleStatus: { emotional: 'VULNERABLE' } },
      { evaluatorType: 'TEACHER', academicYear: '2569', triagingStatus: 'VULNERABLE', round: 2 },
      { evaluatorType: 'STUDENT', academicYear: '2569', triagingStatus: 'VULNERABLE' },
      { evaluatorType: 'TEACHER', academicYear: '2568', triagingStatus: 'VULNERABLE' },
    ];
    const s = sdqSection(rows, '2569');
    expect(s.assessed).toBe(19);
    expect(s.overall['ปกติ']).toBe(12);
    expect(s.overall['มีปัญหา']).toBeNull(); // 1 คน → ซ่อน
    expect(s.overall['เสี่ยง']).toBeNull();   // ซ่อนเพิ่มกันลบย้อน
    expect(s.concernByDimension['ด้านอารมณ์']).toBe(7);
    expect(JSON.stringify(s)).not.toMatch(/studentId|name/);
  });
});

describe('ผูกกับหน้าจอ', () => {
  it('ฟอร์ม SDQ มีคำเตือน 1 ครั้ง/ปี + ยืนยันก่อนส่ง และปิดฟอร์มเมื่อทำแล้ว', () => {
    const hmw = readSource('src/components/student-parent/HealthMentalWellbeingModule.tsx');
    expect(hmw).toContain('<SdqOnceNotice');
    expect(hmw).toContain('data-testid="sdq-form-closed"');
    expect(hmw).toContain('isParentView ? { studentId } : { studentUid: user.uid }');
    expect(hmw).toContain('showStaffAction={false}');
    expect(readSource('src/components/advisor/AdvisorSdqPanel.tsx')).toContain('<SdqOnceNotice');
  });
  it('ครูที่ปรึกษาเห็นผล 3 มุมมอง + รายงานคัดกรองชั้นเรียนในสถิติวิชาการ; แนะแนวเห็นรายชื่อ; ผู้บริหารไม่เห็นรายชื่อ', () => {
    expect(readSource('src/components/advisor/AdvisorSdqPanel.tsx')).toContain('<SdqStudentDetail');
    expect(readSource('src/AdvisorPortal.tsx')).toContain('<SdqClassReportLive');
    expect(readSource('src/components/guidance/GuidancePortal.tsx')).toMatch(/<SdqSchoolOverviewLive[^>]*showNames /);
    expect(readSource('src/ExecutivePortal.tsx')).toContain('showNames={false}');
  });
});
