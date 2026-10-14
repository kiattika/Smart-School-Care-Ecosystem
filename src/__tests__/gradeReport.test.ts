import { describe, it, expect } from 'vitest';
import { readSource } from './helpers/readSource';
import { GRADE_REPORT_DISCLAIMER, buildGradeRows, gradeFromTotal, summarizeGrades, termOptions, type ScoreDoc } from '../lib/gradeReport';

const sc = (over: Partial<ScoreDoc>): ScoreDoc => ({ courseCode: 'ท23101', studentId: '11111', term: '1/2569', ...over });

describe('gradeFromTotal', () => {
  it('ตามเกณฑ์ 80/75/70/65/60/55/50', () => {
    expect([100, 80, 79, 75, 74, 70, 69, 65, 64, 60, 59, 55, 54, 50, 49, 0].map(gradeFromTotal))
      .toEqual(['4', '4', '3.5', '3.5', '3', '3', '2.5', '2.5', '2', '2', '1.5', '1.5', '1', '1', '0', '0']);
  });
});

describe('buildGradeRows', () => {
  const full = sc({ courseName: 'ภาษาไทย', credits: 1.5, preMidterm: 27, midterm: 14, postMidterm: 24, final: 11, total: 76, grade: '3.5', maxPreMidterm: 30, maxMidterm: 20, maxPostMidterm: 30, maxFinal: 20 });
  it('คำนวณร้อยละจากคะแนนเต็มที่เก็บไว้ และเก็บชื่อ/หน่วยกิตจากเอกสารคะแนน', () => {
    const [r] = buildGradeRows({ term: '1/2569', scores: [full] });
    expect(r).toMatchObject({ code: 'ท23101', name: 'ภาษาไทย', credits: 1.5, total: 76, maxTotal: 100, percent: 76, grade: '3.5', hasScore: true });
    expect(r.max).toEqual({ pre: 30, mid: 20, post: 30, final: 20 });
  });
  it('เอกสารรุ่นเก่า (ไม่มีคะแนนเต็ม/หน่วยกิต/ชื่อ): ไม่เดา — เต็มเป็น null, หน่วยกิต null, ชื่อ = รหัส; ร้อยละคิดจากเต็ม 100', () => {
    const [r] = buildGradeRows({ term: '1/2569', scores: [sc({ preMidterm: 20, midterm: 15, postMidterm: 20, final: 20, total: 75, grade: '3.5' })] });
    expect(r).toMatchObject({ name: 'ท23101', credits: null, maxTotal: null, percent: 75, grade: '3.5' });
    expect(r.max).toEqual({ pre: null, mid: null, post: null, final: null });
  });
  it('วิชากิจกรรมแสดง ผ/มผ ไม่มีคะแนนตัวเลข', () => {
    const rows = buildGradeRows({ term: '1/2569', scores: [
      sc({ courseCode: 'ก23905', courseName: 'กิจกรรมแนะแนว', passFailResult: 'PASS', total: 0, grade: 'ผ' }),
      sc({ courseCode: 'ก23911', courseName: 'ลูกเสือ', passFailResult: 'FAIL', total: 0, grade: 'มผ' }),
    ] });
    expect(rows.map(r => [r.code, r.grade, r.total, r.isActivity])).toEqual([['ก23905', 'ผ', null, true], ['ก23911', 'มผ', null, true]]);
  });
  it('กรองเฉพาะภาคเรียนที่เลือก และไม่แสดงวิชายกเว้น (PLC/CZ)', () => {
    const rows = buildGradeRows({ term: '1/2569', scores: [full, sc({ term: '2/2569', courseCode: 'ค23101' }), sc({ courseCode: 'CZ001', courseName: 'Cleaning Zone', total: 80 })] });
    expect(rows.map(r => r.code)).toEqual(['ท23101']);
  });
  it('includeSchedule: วิชาในตารางที่ยังไม่มีคะแนน = ยังไม่มีผล (ไม่ใส่ศูนย์) ; ไม่ includeSchedule = ไม่แสดง', () => {
    const courses = [{ code: 'ค23101', name: 'คณิตศาสตร์', credits: 1.5 }, { code: 'ท23101', name: 'ภาษาไทย', credits: 1.5 }, { code: 'HR', name: 'โฮมรูม ทำความสะอาด' }];
    const withSched = buildGradeRows({ term: '1/2569', scores: [full], courses, includeSchedule: true });
    expect(withSched.map(r => [r.code, r.hasScore, r.grade])).toEqual([['ท23101', true, '3.5'], ['ค23101', false, null]].sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'th')));
    expect(buildGradeRows({ term: '1/2569', scores: [full], courses, includeSchedule: false })).toHaveLength(1);
  });
});

describe('summarizeGrades', () => {
  it('เกรดเฉลี่ยถ่วงหน่วยกิต เฉพาะวิชาหลักที่มีผลและหน่วยกิต; ไม่นับวิชาไม่มีหน่วยกิต/ยังไม่มีผล/กิจกรรม', () => {
    const rows = buildGradeRows({ term: '1/2569', scores: [
      sc({ courseCode: 'ท23101', courseName: 'ไทย', credits: 1.5, total: 76, grade: '3.5' }),
      sc({ courseCode: 'ค23101', courseName: 'คณิต', credits: 0.5, total: 60, grade: '2' }),
      sc({ courseCode: 'ว23101', courseName: 'วิทย์', total: 90, grade: '4' }), // ไม่มีหน่วยกิต
      sc({ courseCode: 'ก23905', courseName: 'แนะแนว', credits: 0.5, passFailResult: 'PASS', total: 0, grade: 'ผ' }),
    ], courses: [{ code: 'อ23101', name: 'อังกฤษ', credits: 1 }], includeSchedule: true });
    const s = summarizeGrades(rows);
    expect(s.gpa).toBe(3.13); // (1.5*3.5 + 0.5*2) / 2.0 = 3.125 → ปัดเป็น 3.13
    expect(s.creditsCounted).toBe(2);
    expect(s.missingCredits).toBe(1);
    expect(s.pending).toBe(1);
    expect(s.activityPassed).toBe(1);
  });
  it('ไม่มีข้อมูลพอ = gpa null', () => { expect(summarizeGrades([]).gpa).toBeNull(); });
});

describe('termOptions', () => {
  it('รวมภาคที่มีคะแนนกับภาคปัจจุบัน เรียงล่าสุดก่อน', () => {
    expect(termOptions([sc({ term: '1/2569' }), sc({ term: '2/2568' })], '2/2569')).toEqual(['2/2569', '1/2569', '2/2568']);
  });
});

describe('guard: รายงานต้องมีหมายเหตุ "ไม่เป็นทางการ/SGS" และไม่มีข้อมูลปลอม', () => {
  it('ข้อความหมายเหตุ', () => {
    expect(GRADE_REPORT_DISCLAIMER).toMatch(/ไม่เป็นทางการ/);
    expect(GRADE_REPORT_DISCLAIMER).toMatch(/ยังไม่ได้รับการอนุมัติ/);
    expect(GRADE_REPORT_DISCLAIMER).toMatch(/SGS/);
  });
  it('คอมโพเนนต์แสดงหมายเหตุทั้งบนจอและในฉบับพิมพ์', () => {
    const src = readSource('src/components/student-parent/StudentGradeReport.tsx');
    expect((src.match(/GRADE_REPORT_DISCLAIMER/g) || []).length).toBeGreaterThanOrEqual(3); // import + บนจอ + ในแผ่นพิมพ์
    expect(src).toMatch(/id="gr-sheet"/);
  });
  it('แท็บผลการเรียนของนักเรียน/ผู้ปกครองไม่อ่านจาก store.reportCards ที่ว่างเสมอ และไม่มีค่าสำรองปลอม (16.5 / อันดับ / 320)', () => {
    const src = readSource('src/components/student-parent/AcademicHomeworkModule.tsx');
    expect(src).not.toMatch(/reportCards/);
    expect(src).not.toMatch(/16\.5|classRank|PROMOTED/);
    expect(src).toMatch(/<StudentGradeReport/);
  });
});
