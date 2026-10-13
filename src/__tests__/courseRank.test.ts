import { describe, it, expect } from 'vitest';
import {
  DEFAULT_RANK_LEVELS, rankForPoints, rankLabel, resolveRankLevels, summarizeCoursePoints, termOfDate, validateRankLevels,
} from '../lib/courseRank';
import type { ActiveLearningRecord } from '../types';
import { readSource } from './helpers/readSource';

const log = (over: Partial<ActiveLearningRecord>): ActiveLearningRecord => ({
  id: Math.random().toString(36), studentId: '10001', points: 1, category: 'ANSWER', awardedAt: '2026-10-13T03:00:00.000Z', ...over,
});

describe('courseRank — ตารางระดับ', () => {
  it('ตารางเริ่มต้นผ่านการตรวจของตัวเอง (เริ่ม 0 เรียงเข้มงวด)', () => {
    expect(validateRankLevels(DEFAULT_RANK_LEVELS).ok).toBe(true);
  });
  it('เกณฑ์ขอบ: 0→บรอนซ์ III, 3→บรอนซ์ II, 105→ปราชญ์, เกินสูงสุด→ระดับสูงสุด', () => {
    expect(rankLabel(rankForPoints(0).level)).toBe('บรอนซ์ III');
    expect(rankLabel(rankForPoints(2).level)).toBe('บรอนซ์ III');
    expect(rankLabel(rankForPoints(3).level)).toBe('บรอนซ์ II');
    expect(rankLabel(rankForPoints(104).level)).toBe('ไดมอนด์ I');
    expect(rankLabel(rankForPoints(105).level)).toBe('ปราชญ์');
    const top = rankForPoints(99999);
    expect(top.next).toBeNull();
    expect(top.progressPct).toBe(100);
    expect(top.pointsToNext).toBe(0);
  });
  it('คะแนนติดลบ/ไม่ใช่ตัวเลข = ระดับต่ำสุด', () => {
    expect(rankForPoints(-5).index).toBe(0);
    expect(rankForPoints(Number.NaN).index).toBe(0);
  });
  it('ความคืบหน้า: ครึ่งทางของบรอนซ์ III→II (0→3) ปัดเป็น 33%/67% ตามคะแนน', () => {
    expect(rankForPoints(1).progressPct).toBe(33);
    expect(rankForPoints(1).pointsToNext).toBe(2);
  });
  it('validate: ปฏิเสธระดับแรก ≠ 0, คะแนนไม่เพิ่ม, ชื่อว่าง, ไม่ใช่จำนวนเต็ม, น้อยกว่า 2 ระดับ', () => {
    const mk = (pts: number[]) => pts.map((p, i) => ({ key: `k${i}`, name: `L${i}`, division: '', minPoints: p }));
    expect(validateRankLevels(mk([1, 5])).ok).toBe(false);
    expect(validateRankLevels(mk([0, 5, 5])).ok).toBe(false);
    expect(validateRankLevels(mk([0])).ok).toBe(false);
    expect(validateRankLevels(mk([0, 2.5])).ok).toBe(false);
    expect(validateRankLevels([{ key: 'a', name: ' ', division: '', minPoints: 0 }, { key: 'b', name: 'x', division: '', minPoints: 5 }]).ok).toBe(false);
    expect(validateRankLevels(mk([0, 10, 20])).ok).toBe(true);
  });
  it('resolve: ค่าที่เก็บผิดรูปแบบ/ไม่มี = ค่าเริ่มต้น', () => {
    expect(resolveRankLevels(undefined)).toBe(DEFAULT_RANK_LEVELS);
    expect(resolveRankLevels([{ name: 'x' }])).toBe(DEFAULT_RANK_LEVELS);
  });
  it('แอดมินแก้เกณฑ์ได้: ตารางกำหนดเองถูกใช้คำนวณ', () => {
    const custom = [
      { key: 'a', name: 'เริ่มต้น', division: '', minPoints: 0 },
      { key: 'b', name: 'ดีเด่น', division: '', minPoints: 5 },
    ];
    expect(rankLabel(rankForPoints(5, custom).level)).toBe('ดีเด่น');
    expect(rankLabel(rankForPoints(4, custom).level)).toBe('เริ่มต้น');
  });
});

describe('courseRank — สรุปคะแนนต่อวิชาตามภาคเรียน', () => {
  const term = { academicYear: '2569', term: '1' as const };
  it('วันที่ → ภาคเรียน (ต.ค. 2026 = 1/2569, ก.พ. 2027 = 2/2569)', () => {
    expect(termOfDate('2026-10-13T03:00:00.000Z')).toEqual({ academicYear: '2569', term: '1' });
    expect(termOfDate('2027-02-10T03:00:00.000Z')).toEqual({ academicYear: '2569', term: '2' });
    expect(termOfDate('bad')).toBeNull();
  });
  it('รวมต่อวิชา แยกวิชา และไม่รวมภาคเรียนอื่น', () => {
    const rows = summarizeCoursePoints([
      log({ courseId: 'M1', courseName: 'คณิต', points: 5 }),
      log({ courseId: 'M1', courseName: 'คณิต', points: 2 }),
      log({ courseId: 'S1', courseName: 'วิทย์', points: 1 }),
      log({ courseId: 'M1', courseName: 'คณิต', points: 50, awardedAt: '2027-02-10T03:00:00.000Z' }), // ภาค 2
      log({ courseId: 'M1', courseName: 'คณิต', points: 9, academicYear: '2568', term: '1' }), // ปีอื่น (ระบุชัด)
    ], term);
    expect(rows.map(r => [r.courseId, r.points])).toEqual([['M1', 7], ['S1', 1]]);
    expect(rankLabel(rows[0].rank.level)).toBe('บรอนซ์ I');
  });
  it('log ที่ไม่มี courseId = "ไม่ระบุวิชา" (ไม่เดาวิชา) และคะแนนรวมไม่ต่ำกว่า 0', () => {
    const rows = summarizeCoursePoints([log({ points: -3 })], term);
    expect(rows[0].courseName).toBe('ไม่ระบุวิชา');
    expect(rows[0].points).toBe(0);
  });
});

describe('guard — คะแนนกิจกรรมรายวิชาแยกจากคะแนนความประพฤติ', () => {
  it('ตัวสุ่มตอบไม่เรียก adjustBehaviorScore และส่ง courseName + ภาคเรียนให้ addActiveLearningPoints', () => {
    const src = readSource('src/components/RandomStudentPickerModal.tsx');
    expect(src).not.toMatch(/adjustBehaviorScore\s*\(/);
    expect(src).toContain('awardExtra');
  });
  it('store ประทับ teacherStaffId จาก claim staffId (ไม่ใช่ uid)', () => {
    const src = readSource('src/store.ts');
    expect(src).toContain('get().user?.staffId');
    expect(src).toMatch(/teacherStaffId/);
  });
  it('rules active_learning_logs ไม่เปิด bare isSignedIn() ให้อ่าน/เขียน', () => {
    const rules = readSource('firestore.rules');
    const i = rules.indexOf('match /active_learning_logs/{logId}');
    const block = rules.slice(i, rules.indexOf('\n    }\n', i));
    expect(block).not.toMatch(/allow read:\s*if isSignedIn\(\)/);
    expect(block).toContain('isSelfStudent(resource.data.studentId)');
    expect(block).toContain("resource.data.get('teacherStaffId', '') == myStaffId()");
    expect(block).toContain('request.resource.data.teacherStaffId == myStaffId()');
  });
  it('หน้านักเรียนแสดงคะแนนรายวิชา และกระดานครูอ่านเฉพาะของตนเอง', () => {
    expect(readSource('src/StudentPortal.tsx')).toContain('<CourseActivityPoints');
    expect(readSource('src/components/ClassroomLeaderboard.tsx')).toContain('subscribeActiveLearningLogsForTeacher');
    expect(readSource('src/components/ClassroomLeaderboard.tsx')).not.toMatch(/subscribeActiveLearningLogs\(/);
  });
});
