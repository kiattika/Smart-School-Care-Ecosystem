import { describe, it, expect } from 'vitest';
import Papa from 'papaparse';
import { IMPORT_TEMPLATES, templateFilename } from '../lib/importTemplates';
import { IMPORT_DEPENDENCIES, IMPORT_ORDER } from '../lib/importOrder';
import { summarizeUnlinkedTeachers } from '../lib/importUnlinkedSummary';
import { isTeacherLoadReportFormat, parseTeacherLoadReport } from '../utils/teacherLoadReportParser';

const parse = (csv: string) => Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: 'greedy' }).data;

describe('ลำดับการ์ดนำเข้า', () => {
  it('มี 4 ประเภทครบ ไม่ซ้ำ และทุกการ์ดอยู่หลังสิ่งที่มันพึ่งพา', () => {
    expect([...IMPORT_ORDER].sort()).toEqual(['COURSE', 'PARENT', 'STUDENT', 'TEACHER']);
    IMPORT_ORDER.forEach((t, i) => {
      for (const dep of IMPORT_DEPENDENCIES[t]) expect(IMPORT_ORDER.indexOf(dep)).toBeLessThan(i);
    });
    expect(IMPORT_DEPENDENCIES.COURSE).toContain('TEACHER'); // matchedTeacherId จับคู่จาก staff
    expect(IMPORT_DEPENDENCIES.PARENT).toContain('STUDENT'); // ตรวจรหัสนักเรียนจาก students
  });
});

describe('เทมเพลตตัวอย่างครบทั้ง 4 ประเภท', () => {
  it('ทุกประเภทมีไฟล์ชื่อไม่ซ้ำและมีแถวตัวอย่าง', () => {
    const names = IMPORT_ORDER.map(templateFilename);
    expect(new Set(names).size).toBe(4);
    for (const t of IMPORT_ORDER) expect(parse(IMPORT_TEMPLATES[t]).length).toBeGreaterThan(0);
  });
  it('เทมเพลตตารางสอนเป็นรูปแบบรายงานภาระงานสอน, หลายแถวต่อครูหนึ่งคน และ parse ผ่านทุกแถว', () => {
    const rows = parse(IMPORT_TEMPLATES.COURSE);
    expect(isTeacherLoadReportFormat(rows)).toBe(true);
    const staff = [
      { id: 'teacher-01', email: 'tawee@utd.ac.th', fullName: 'นายทวี รักเรียน' },
      { id: 'teacher-02', email: 'somjit@utd.ac.th', fullName: 'นางสาวสมจิต แข็งขัน' },
    ];
    const { courseRows } = parseTeacherLoadReport(rows, staff);
    expect(courseRows).toHaveLength(3);
    expect(courseRows.every((r) => r.isValid)).toBe(true);
    // แถวที่ 2 ไม่มีชื่อ/อีเมล → ใช้ของครูแถวแรก (forward-fill)
    expect(courseRows.map((r) => r.matchedTeacherId)).toEqual(['teacher-01', 'teacher-01', 'teacher-02']);
    expect(courseRows[0].slots).toHaveLength(4);
  });
  it('ไม่มีบุคลากรในระบบ → ทุกแถวไม่ผูกครู (ไม่เดา id)', () => {
    const { courseRows } = parseTeacherLoadReport(parse(IMPORT_TEMPLATES.COURSE), []);
    expect(courseRows.every((r) => !r.matchedTeacherId && !!r.unlinkedTeacherName)).toBe(true);
  });
});

describe('summarizeUnlinkedTeachers', () => {
  const row = (isValid: boolean, p: object) => ({ isValid, parsedData: p });
  it('นับเฉพาะแถวที่ผ่านตรวจและไม่ผูกครู, ครูซ้ำนับคนเดียว', () => {
    const s = summarizeUnlinkedTeachers([
      row(true, { matchedTeacherId: 't1' }),
      row(true, { unlinkedTeacherName: 'A', unlinkedTeacherEmail: 'a@utd.ac.th' }),
      row(true, { unlinkedTeacherName: 'A', unlinkedTeacherEmail: 'a@utd.ac.th' }),
      row(true, { unlinkedTeacherName: 'B' }),
      row(false, { unlinkedTeacherName: 'C' }),
    ]);
    expect(s).toEqual({ rowCount: 3, teacherCount: 2, teachers: ['A (a@utd.ac.th)', 'B'] });
  });
  it('ผูกครูครบ / แถวเดิม (legacy) = ไม่มีคำเตือน', () => {
    expect(summarizeUnlinkedTeachers([row(true, { matchedTeacherId: 't1' }), row(true, {})]).rowCount).toBe(0);
    expect(summarizeUnlinkedTeachers([]).rowCount).toBe(0);
  });
});
