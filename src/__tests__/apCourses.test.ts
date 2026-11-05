import { describe, it, expect } from 'vitest';
import { readSource } from './helpers/readSource';
import { isApCourse, levelsOfSchedule, apLevelsForSchedule, apCandidates, resolveApRoster, computeApReport, apRosterDocId, type ApRosterDoc } from '../lib/apCourses';

const sch = (id: string, level: string, over: Record<string, unknown> = {}) => ({
  id, subjectCode: 'ว31201', subjectName: 'ฟิสิกส์ AP', dayOfWeek: 'monday', periodNumber: 3, level, room: '546', teacherIds: ['t1'], ...over,
});
const stu = (studentId: string, room: string) => ({ studentId, room, name: studentId });
const students = [stu('1', 'ม.6/1'), stu('2', 'ม.6/1'), stu('3', 'ม.6/2'), stu('4', 'ม.6/2'), stu('5', 'ม.5/1')];
const roster = (code: string, owner: string, ids: string[]): ApRosterDoc => ({
  semesterId: '2569_2', courseKey: code, courseName: code, ownerStaffId: owner, levels: ['ม.6/1', 'ม.6/2'], studentIds: ids, confirmed: true,
});

describe('วิชา AP', () => {
  it('ตรวจชื่อวิชา AP เฉพาะคำ AP ที่ไม่ติดตัวอักษรละติน', () => {
    expect(isApCourse('ฟิสิกส์ AP')).toBe(true);
    expect(isApCourse('เคมี AP 1')).toBe(true);
    expect(isApCourse('Apply science')).toBe(false);
    expect(isApCourse('ฟิสิกส์')).toBe(false);
    expect(isApCourse(undefined)).toBe(false);
  });

  it('levels รวมชั้นของ doc และ doc พี่น้องที่แยกตามชั้น (ครูเดียวกัน คาบเดียวกัน)', () => {
    expect(levelsOfSchedule({ levels: ['ม.6/1', 'ม.6/2'], level: 'ม.6/1' })).toEqual(['ม.6/1', 'ม.6/2']);
    const all = [sch('a', 'ม.6/1'), sch('b', 'ม.6/2'), sch('c', 'ม.6/3', { teacherIds: ['t9'] })];
    expect(apLevelsForSchedule(all[0], all)).toEqual(['ม.6/1', 'ม.6/2']);
  });

  it('ยังไม่ยืนยัน = ผู้สมัครทุกคน, ยืนยันแล้ว = เฉพาะที่ครูเลือก', () => {
    const cand = apCandidates(students, ['ม.6/1', 'ม.6/2']);
    expect(cand.map(c => c.studentId)).toEqual(['1', '2', '3', '4']);
    expect(resolveApRoster(cand, null)).toHaveLength(4);
    expect(resolveApRoster(cand, roster('ว31201', 't1', ['1', '3'])).map(c => c.studentId)).toEqual(['1', '3']);
  });

  it('รายงานตกหล่น: นับเฉพาะเมื่อมีครูยืนยันแล้ว และแจ้งซ้ำ', () => {
    const phys = sch('p', 'ม.6/1', { levels: ['ม.6/1', 'ม.6/2'] });
    const chem = sch('c', 'ม.6/1', { levels: ['ม.6/1', 'ม.6/2'], subjectCode: 'ว31221', subjectName: 'เคมี AP', teacherIds: ['t2'] });
    const none = computeApReport([phys, chem], [], students);
    expect(none).toHaveLength(1);
    expect(none[0].hasConfirmedRoster).toBe(false);
    expect(none[0].fallThrough).toEqual([]);

    const r = computeApReport([phys, chem], [roster('ว31201', 't1', ['1', '3']), roster('ว31221', 't2', ['3', '2'])], students);
    expect(r[0].poolCount).toBe(4);
    expect(r[0].fallThrough.map(f => f.studentId)).toEqual(['4']);
    expect(r[0].duplicates.map(d => d.studentId)).toEqual(['3']);
    expect(r[0].unconfirmedCourses).toEqual([]);
  });

  it('ไม่ใช่ AP ไม่เข้ารายงาน และชั้นที่ไม่ซ้อนกันแยกกลุ่ม', () => {
    const other = sch('o', 'ม.6/1', { subjectName: 'ฟิสิกส์' });
    expect(computeApReport([other], [], students)).toEqual([]);
    const a = sch('a', 'ม.6/1');
    const b = sch('b', 'ม.5/1', { subjectCode: 'ว30201', teacherIds: ['t7'] });
    expect(computeApReport([a, b], [], students)).toHaveLength(2);
  });

  it('doc id ตรงรูปแบบที่ rules บังคับ และ import เก็บ levels ที่รวมแล้ว', () => {
    expect(apRosterDocId('2569_2', 'ว31201', 'tch-a')).toBe('2569_2_ว31201_tch-a');
    const src = readSource('src/components/BulkDataImportModal.tsx');
    expect(src).toContain('levels: string[]');
    expect(src).toMatch(/levels: merged\?\.levels\?\.length/);
  });
});
