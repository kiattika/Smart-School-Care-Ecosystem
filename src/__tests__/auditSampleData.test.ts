import { describe, it, expect } from 'vitest';
import { AuditStore, classifyDoc, renderReport, runAudit } from '../../scripts/lib/sampleDataAudit';

type Docs = Record<string, Array<{ id: string; data: Record<string, unknown> }>>;
const fakeStore = (docs: Docs): AuditStore & { calls: string[] } => {
  const calls: string[] = [];
  return {
    calls,
    async listCollections() { calls.push('listCollections'); return Object.keys(docs); },
    async readAll(c, fields) {
      calls.push(`readAll:${c}`);
      return docs[c].map(d => ({ id: d.id, data: Object.fromEntries(Object.entries(d.data).filter(([k]) => fields.includes(k))) }));
    },
    async readFirst(c, n) { calls.push(`readFirst:${c}`); return docs[c].slice(0, n); },
  };
};

describe('classifyDoc — กติกาจากผู้ใช้เท่านั้น', () => {
  it('staff/teachers: kiattika@utd.ac.th (ทน invisible char/ตัวพิมพ์ใหญ่) = ของจริงแน่นอน, อื่นๆ = ตัวอย่าง', () => {
    expect(classifyDoc('staff', { email: 'kiattika@utd.ac.th' })).toBe('CERTAIN_REAL');
    expect(classifyDoc('teachers', { email: 'Kiattika@utd.ac.th​' })).toBe('CERTAIN_REAL');
    expect(classifyDoc('staff', { email: 'someone@utd.ac.th' })).toBe('LIKELY_SAMPLE');
    expect(classifyDoc('staff', {})).toBe('LIKELY_SAMPLE');
  });
  it('schedules: ต้องมี academicYear+term ครบ และ teacherIds มี teacher_kiattisak', () => {
    const ok = { academicYear: '2569', term: '1', teacherIds: ['x', 'teacher_kiattisak'] };
    expect(classifyDoc('schedules', ok)).toBe('LIKELY_REAL');
    expect(classifyDoc('schedules', { ...ok, term: undefined })).toBe('LIKELY_SAMPLE');
    expect(classifyDoc('schedules', { ...ok, teacherIds: ['other'] })).toBe('LIKELY_SAMPLE');
    expect(classifyDoc('schedules', { teacherIds: ['teacher_kiattisak'] })).toBe('LIKELY_SAMPLE');
  });
  it('students = ตัวอย่างทั้งหมด; collection อื่น = ไม่จัดกลุ่ม', () => {
    expect(classifyDoc('students', { studentId: '38501' })).toBe('LIKELY_SAMPLE');
    expect(classifyDoc('student_assessments_sdq', { studentId: '38501' })).toBe('UNCLASSIFIED');
  });
});

describe('runAudit / renderReport', () => {
  const docs: Docs = {
    staff: [{ id: 's1', data: { email: 'kiattika@utd.ac.th' } }, { id: 's2', data: { email: 'a@utd.ac.th' } }],
    students: [{ id: '38501', data: {} }],
    house_points: [1, 2, 3, 4].map(i => ({ id: `h${i}`, data: { studentId: `s${i}`, createdAt: '2026-01-01', secret: 'ไม่ควรโผล่' } })),
    empty_one: [],
  };
  it('นับ/จัดกลุ่มถูก, ไม่ hardcode รายชื่อ collection, อ่านอย่างเดียว', async () => {
    const store = fakeStore(docs);
    const audits = await runAudit(store);
    expect(audits.map(a => a.name)).toEqual(['empty_one', 'house_points', 'staff', 'students']);
    const staff = audits.find(a => a.name === 'staff')!;
    expect(staff.certainReal).toEqual(['s1']);
    expect(staff.likelySampleCount).toBe(1);
    const hp = audits.find(a => a.name === 'house_points')!;
    expect(hp.unclassifiedCount).toBe(4);
    expect(hp.samples).toHaveLength(3);
    expect(hp.samples[0].fields).toEqual({ studentId: 's1', createdAt: '2026-01-01' }); // เฉพาะ field สำคัญ
    expect(store.calls.every(c => /^(listCollections|readAll|readFirst):?/.test(c))).toBe(true);
  });
  it('รายงานมีคำถามและไม่มีคำว่าลบเป็นข้อเสนอ; id ของจริงแน่นอนแสดงครบ', async () => {
    const md = renderReport(await runAudit(fakeStore(docs)), { date: '2026-10-05', targetLabel: 'test', databaseId: 'db' });
    expect(md).toContain('`s1`');
    expect(md).toContain('ยืนยันว่าลบได้ทั้งหมดไหม');
    expect(md).toContain('**house_points** มี 4 เอกสาร ผูกกับ staff/students/schedules ตัวอย่างไหม ควรลบตามหรือเก็บไว้');
    expect(md).not.toContain('ไม่ควรโผล่');
  });
});
