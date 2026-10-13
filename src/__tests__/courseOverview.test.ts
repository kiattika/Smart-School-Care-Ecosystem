import { describe, it, expect } from 'vitest';
import { courseCodeOfPointsKey, mergeCourseOverview } from '../lib/courseOverview';
import { studentPointsTotals, summarizeCoursePoints } from '../lib/courseRank';
import { attendanceStatsFromCounts } from '../lib/studentAttendanceStats';
import type { CourseAttendanceRow } from '../lib/courseAttendanceStats';
import type { ActiveLearningRecord } from '../types';
import { readSource } from './helpers/readSource';

const term = { academicYear: '2569', term: '1' as const };
const log = (over: Partial<ActiveLearningRecord>): ActiveLearningRecord => ({
  id: Math.random().toString(36), studentId: 's1', points: 1, category: 'ANSWER', awardedAt: '2026-10-13T03:00:00.000Z',
  academicYear: '2569', term: '1', ...over,
});
const attRow = (code: string, name: string): CourseAttendanceRow => ({
  key: code, code, name, inSchedule: true, stats: attendanceStatsFromCounts('s1', { present: 1 }),
});

describe('รวมสถิติเข้าเรียน + คะแนนกิจกรรมเป็นแถวต่อวิชา', () => {
  it('จับคู่คะแนนกับวิชาด้วยรหัสวิชาจาก courseKey; วิชาที่ไม่มีคะแนนยังแสดง (points = undefined)', () => {
    const pts = summarizeCoursePoints([
      log({ courseKey: 'CZ|ม.5/8', courseName: 'Cleaning Zone', points: 7 }),
    ], term);
    const { items, unassigned } = mergeCourseOverview([attRow('CZ', 'Cleaning Zone'), attRow('ค32102', 'คณิต')], pts);
    expect(items).toHaveLength(2);
    expect(items.find(i => i.code === 'CZ')?.points?.points).toBe(7);
    expect(items.find(i => i.code === 'ค32102')?.points).toBeUndefined();
    expect(unassigned).toBeNull();
  });
  it('วิชาที่มีแต่คะแนน (ชุมนุม/ไม่อยู่ในตาราง) เป็นแถวของตัวเอง ไม่หายไป', () => {
    const pts = summarizeCoursePoints([log({ courseKey: 'elective_abc', courseName: 'ชุมนุมหุ่นยนต์', points: 3 })], term);
    const { items } = mergeCourseOverview([attRow('CZ', 'Cleaning Zone')], pts);
    expect(items.map(i => i.name)).toEqual(['Cleaning Zone', 'ชุมนุมหุ่นยนต์']);
    expect(items[1].attendance).toBeUndefined();
  });
  it('คะแนนที่ไม่ระบุวิชาแยกออกมา ไม่ผูกกับวิชาใด', () => {
    const pts = summarizeCoursePoints([log({ points: 4 })], term);
    const { items, unassigned } = mergeCourseOverview([attRow('CZ', 'Cleaning Zone')], pts);
    expect(items[0].points).toBeUndefined();
    expect(unassigned?.points).toBe(4);
  });
  it('courseCodeOfPointsKey', () => {
    expect(courseCodeOfPointsKey('ค32102|ม.5/9')).toBe('ค32102');
    expect(courseCodeOfPointsKey('elective_x')).toBe('');
  });
  it('guard: หน้านักเรียน/ผู้ปกครองใช้การ์ดรวมเดียว ไม่เหลือ component เดิมแยกสองอัน', () => {
    for (const f of ['src/StudentPortal.tsx', 'src/ParentPortal.tsx']) {
      const s = readSource(f);
      expect(s).toContain('<CourseOverviewCards');
      expect(s).not.toContain('<CourseActivityPoints');
      expect(s).not.toContain('<CourseAttendanceStats');
    }
  });
});

describe('คะแนนรวมรายบุคคล (กราฟครูที่ปรึกษา)', () => {
  it('รวมทุกวิชาต่อคน เรียงมาก→น้อย แต่ละวิชาไม่ต่ำกว่า 0 และไม่รวมคนที่ได้ 0', () => {
    const t = studentPointsTotals([
      log({ studentId: 'a', courseKey: 'A|x', courseName: 'วิชา A', points: 5 }),
      log({ studentId: 'a', courseKey: 'B|x', courseName: 'วิชา B', points: 2 }),
      log({ studentId: 'b', courseKey: 'A|x', courseName: 'วิชา A', points: 6 }),
      log({ studentId: 'c', courseKey: 'A|x', courseName: 'วิชา A', points: 1 }),
      log({ studentId: 'c', courseKey: 'A|x', courseName: 'วิชา A', points: -1 }),
      log({ studentId: 'd', courseKey: 'A|x', points: 9, academicYear: '2568' }), // คนละปี
    ], term);
    expect(t.map(x => [x.studentId, x.total])).toEqual([['a', 7], ['b', 6]]);
    expect(t[0].byCourse).toEqual([{ courseName: 'วิชา A', points: 5 }, { courseName: 'วิชา B', points: 2 }]);
  });
  it('guard: เมนูสถิติวิชาการของครูที่ปรึกษามีกราฟ และอ่านด้วย query ตามห้อง (ตรง rules)', () => {
    expect(readSource('src/AdvisorPortal.tsx')).toContain('<AdvisorActivityPointsChart');
    expect(readSource('src/components/AdvisorActivityPointsChart.tsx')).toContain('subscribeActiveLearningLogsForRoom');
    expect(readSource('src/services/firestoreService.ts')).toMatch(/where\('homeroomClass', '==', homeroomClass\)/);
  });
  it('guard: ทุกจุดที่ให้คะแนนส่ง homeroomClass (rules ใช้ให้ครูที่ปรึกษาอ่าน) และ rules ตรวจกับ students.room', () => {
    expect(readSource('src/components/ClassroomSeatingManager.tsx')).toContain('homeroomClass: quickAwardStudent.room');
    expect((readSource('src/components/RandomStudentPickerModal.tsx').match(/homeroomClass: student\.room/g) || []).length).toBe(2);
    const rules = readSource('firestore.rules');
    expect(rules).toMatch(/request\.resource\.data\.homeroomClass == studentField\(request\.resource\.data\.studentId, 'room', '__none__'\)/);
    expect(rules).toMatch(/studentField\(resource\.data\.studentId, 'parentUid', '__none__'\) == request\.auth\.uid/);
  });
});
