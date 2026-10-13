import { describe, it, expect } from 'vitest';
import { courseStatKey, diffCourseAttendance, buildCourseAttendanceRows } from '../lib/courseAttendanceStats';
import { readSource } from './helpers/readSource';

describe('courseStatKey', () => {
  it('ตัดอักขระที่ใช้ใน field path ไม่ได้', () => {
    expect(courseStatKey('ค32102')).toBe('ค32102');
    expect(courseStatKey(' ท 31.101/1 ')).toBe('ท_31_101_1');
  });
});

describe('diffCourseAttendance', () => {
  const math = { courseCode: 'ค32102', courseName: 'คณิตศาสตร์พื้นฐาน' };
  it('เช็คครั้งแรก: +1 ต่อสถานะของนักเรียนแต่ละคนใต้วิชานั้น', () => {
    const d = diffCourseAttendance(null, { ...math, students: { a: 'PRESENT', b: 'LATE' } });
    expect(d).toEqual([
      { studentId: 'a', key: 'ค32102', code: 'ค32102', name: 'คณิตศาสตร์พื้นฐาน', status: 'PRESENT', by: 1 },
      { studentId: 'b', key: 'ค32102', code: 'ค32102', name: 'คณิตศาสตร์พื้นฐาน', status: 'LATE', by: 1 },
    ]);
  });
  it('แก้ย้อนหลัง: ลดสถานะเก่า เพิ่มสถานะใหม่ ข้ามคนที่ไม่เปลี่ยน', () => {
    const d = diffCourseAttendance({ ...math, students: { a: 'PRESENT', b: 'LATE' } }, { ...math, students: { a: 'PRESENT', b: 'ABSENT' } });
    expect(d.map(x => [x.studentId, x.status, x.by])).toEqual([['b', 'LATE', -1], ['b', 'ABSENT', 1]]);
  });
  it('เปลี่ยนวิชาของคาบเดิม: ย้ายยอดจากวิชาเก่าไปวิชาใหม่', () => {
    const d = diffCourseAttendance({ courseCode: 'ว1', students: { a: 'PRESENT' } }, { courseCode: 'ว2', students: { a: 'PRESENT' } });
    expect(d.map(x => [x.key, x.by])).toEqual([['ว1', -1], ['ว2', 1]]);
  });
  it('record ที่ไม่มี courseCode (โฮมรูม/ข้อมูลเก่า) ไม่นับรายวิชา', () => {
    expect(diffCourseAttendance(null, { students: { a: 'ABSENT' } })).toEqual([]);
    expect(diffCourseAttendance({ students: { a: 'ABSENT' } }, { students: { a: 'PRESENT' } })).toEqual([]);
  });
  it('record เก่าไม่มีวิชา แล้วครูเช็คทับพร้อมวิชา: นับเฉพาะด้านใหม่ ไม่ลดอะไร', () => {
    const d = diffCourseAttendance({ students: { a: 'PRESENT' } }, { ...math, students: { a: 'PRESENT' } });
    expect(d.map(x => x.by)).toEqual([1]);
  });
});

describe('buildCourseAttendanceRows', () => {
  const schedules = [
    { subjectCode: 'ค32102', subjectName: 'คณิตศาสตร์พื้นฐาน', level: 'ม.5/8' },
    { subjectCode: 'ค32102', subjectName: 'คณิตศาสตร์พื้นฐาน', level: 'ม.5/8' }, // หลายคาบ/สัปดาห์
    { subjectCode: 'ว32202', subjectName: 'ฟิสิกส์', level: 'ม.5/8' },
    { subjectCode: 'อ1', subjectName: 'อังกฤษ', level: 'ม.5/7' },                // คนละห้อง
  ];
  it('ทุกวิชาในตารางของห้อง (ตัดซ้ำ) รวมวิชาที่ยังไม่เคยเช็คชื่อ', () => {
    const rows = buildCourseAttendanceRows({
      schedules, studentRoom: '5/8', studentId: 's1',
      courseStats: { ค32102: { code: 'ค32102', name: 'คณิตศาสตร์พื้นฐาน', present: 8, late: 1, absent: 1, leave: 0 } },
    });
    expect(rows.map(r => r.code)).toEqual(['ค32102', 'ว32202']);
    expect(rows[0].stats).toMatchObject({ present: 8, late: 1, absent: 1, attendanceRate: 90 });
    expect(rows[1].stats.totalRecorded).toBe(0);
    expect(rows[1].stats.attendanceRate).toBeNull();
  });
  it('วิชาที่มียอดแต่ไม่อยู่ในตารางแล้ว ยังแสดง (ทำเครื่องหมาย)', () => {
    const rows = buildCourseAttendanceRows({ schedules: [], studentRoom: 'ม.5/8', studentId: 's1', courseStats: { เก่า: { code: 'เก่า', name: 'วิชาเก่า', present: 2 } } });
    expect(rows).toHaveLength(1);
    expect(rows[0].inSchedule).toBe(false);
  });
  it('ไม่มีห้อง/ไม่มีตาราง/ไม่มียอด = ว่าง ไม่เติมวิชา', () => {
    expect(buildCourseAttendanceRows({ schedules, studentRoom: undefined, studentId: 's1' })).toEqual([]);
    expect(buildCourseAttendanceRows({ schedules: [], studentRoom: 'ม.5/8', studentId: 's1', courseStats: null })).toEqual([]);
  });
});

describe('guard: sync สถิติรายวิชา + UI', () => {
  it('ผู้เช็คชื่อคาบวิชาส่ง courseCode ไปกับ record', () => {
    expect(readSource('src/components/seating/TakeAttendanceModal.tsx')).toMatch(/courseCode: course\.code/);
    expect(readSource('src/TeacherPortal.tsx')).toMatch(/courseCode: activeCourse\?\.code/);
  });
  it('transaction เขียน courseAttendanceStats ผ่าน diffCourseAttendance', () => {
    const src = readSource('src/services/firestoreService.ts');
    expect(src).toMatch(/diffCourseAttendance\(/);
    expect(src).toMatch(/courseAttendanceStats\.\$\{d\.key\}/);
  });
  it('rules: ครูผู้สอนแตะได้เฉพาะ field สถิติ', () => {
    expect(readSource('firestore.rules')).toMatch(/hasRole\('SUBJECT_TEACHER'\) &&\s*request\.resource\.data\.diff\(resource\.data\)\.affectedKeys\(\)\s*\.hasOnly\(\['attendanceStats', 'attendanceStatsUpdatedAt', 'courseAttendanceStats'\]\)/);
  });
  it('ทั้งสอง portal แสดงการ์ดรวม CourseOverviewCards (สถิติเข้าเรียน + คะแนนกิจกรรม) ที่ใช้ buildCourseAttendanceRows', () => {
    for (const f of ['src/StudentPortal.tsx', 'src/ParentPortal.tsx']) expect(readSource(f)).toMatch(/<CourseOverviewCards /);
    expect(readSource('src/components/student-parent/CourseOverviewCards.tsx')).toContain('buildCourseAttendanceRows');
  });
});
