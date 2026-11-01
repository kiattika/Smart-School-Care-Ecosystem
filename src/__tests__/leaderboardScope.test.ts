import { describe, it, expect } from 'vitest';
import { taughtCoursesFromSchedules, leaderboardStudents } from '../lib/leaderboardScope';

const me = { staffId: 't1' };
const schedules = [
  { subjectCode: 'ค31101', level: 'ม.5/8', teacherIds: ['t1'] },
  { subjectCode: 'ค31101', level: 'ม.5/8', teacherIds: ['t1'] },
  { subjectCode: 'ว31101', level: 'M.5/9', teacherId: 't1' },
  { subjectCode: 'ท31101', level: 'ม.4/1', teacherIds: ['t2'] },
];
const students = [
  { studentId: 'a', room: 'ม.5/8' }, { studentId: 'b', room: 'ม.5/9' }, { studentId: 'c', room: 'ม.4/1' },
];
describe('leaderboardScope', () => {
  it('รวมเฉพาะวิชาที่ครูสอน ไม่ซ้ำ', () => {
    expect(taughtCoursesFromSchedules(schedules, me).map(t => t.courseKey)).toEqual(['ค31101|ม.5/8', 'ว31101|M.5/9']);
  });
  it('ไม่มี staffId = ไม่มีวิชา', () => {
    expect(taughtCoursesFromSchedules(schedules, {})).toEqual([]);
  });
  it('ไม่เลือกวิชา = ทุกห้องที่สอน ไม่รวมห้องอื่น', () => {
    const t = taughtCoursesFromSchedules(schedules, me);
    expect(leaderboardStudents(students, t, '', {}).map(s => s.studentId)).toEqual(['a', 'b']);
  });
  it('เลือกวิชา = เฉพาะห้องของวิชานั้น', () => {
    const t = taughtCoursesFromSchedules(schedules, me);
    expect(leaderboardStudents(students, t, 'ค31101|ม.5/8', {}).map(s => s.studentId)).toEqual(['a']);
    expect(leaderboardStudents(students, t, 'ว31101|M.5/9', {}).map(s => s.studentId)).toEqual(['b']);
  });
  it('ชุมนุม (ไม่มีในตารางสอน) = เฉพาะคนที่มีคะแนนวิชานั้น', () => {
    const t = taughtCoursesFromSchedules(schedules, me);
    expect(leaderboardStudents(students, t, 'elective_x', { c: 3 }).map(s => s.studentId)).toEqual(['c']);
  });
});
