import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { readSource } from './helpers/readSource';
import {
  MIN_CELL, activeTeacherCount, guidanceSection, infirmarySection, levelOf, maskCell, maskCounts, semesterRange,
  studentsSection, supervisionSection, teachingSection,
} from '../../functions/src/publicSummaryLogic';
import { barRows, formatCell, isPublicInfoPath, monthLabel } from '../lib/publicInfo';

describe('ซ่อนช่องเล็ก (<5)', () => {
  it('maskCell: 1–4 ซ่อน, 0 และ ≥5 แสดง', () => {
    expect(MIN_CELL).toBe(5);
    expect([0, 1, 4, 5, 30].map(maskCell)).toEqual([0, null, null, 5, 30]);
  });
  it('maskCounts: ซ่อนช่องเล็ก และซ่อนช่องรองเมื่อซ่อนอยู่ช่องเดียว (กันลบจากยอดรวม)', () => {
    expect(maskCounts({ a: 20, b: 3, c: 12 })).toEqual({ a: 20, b: null, c: null });
    expect(maskCounts({ a: 20, b: 3, c: 2 })).toEqual({ a: 20, b: null, c: null });
    expect(maskCounts({ a: 20, b: 0, c: 12 })).toEqual({ a: 20, b: 0, c: 12 });
  });
});

describe('ส่วนต่าง ๆ ของสรุป', () => {
  const range = semesterRange('2569', '1');
  it('ช่วงภาคเรียน', () => {
    expect(range).toEqual({ from: '2026-05-01', to: '2026-10-31' });
    expect(semesterRange('2569', '2')).toEqual({ from: '2026-11-01', to: '2027-04-30' });
  });
  it('นักเรียน: นับเฉพาะที่ไม่ INACTIVE แยกระดับชั้น', () => {
    const rows = [...Array(6)].map(() => ({ grade: 'ม.1/2' })).concat([...Array(7)].map(() => ({ grade: 'ม.5' })), [{ grade: 'ม.6', status: 'INACTIVE' }] as any);
    const s = studentsSection(rows);
    expect(s.total).toBe(13);
    expect(s.byLevel).toEqual({ 'ม.1': 6, 'ม.5': 7 });
    expect(levelOf('ป.1')).toBe('อื่น ๆ');
  });
  it('พยาบาล/แนะแนว: นับเฉพาะในภาคเรียน และซ่อนช่องเล็ก', () => {
    const visits = [...Array(6)].map(() => ({ visitDate: '2026-09-02' })).concat([{ visitDate: '2026-09-03', isUrgentAlert: true }, { visitDate: '2025-01-01' }] as any);
    const inf = infirmarySection(visits, range);
    expect(inf.visits).toBe(7);
    expect(inf.urgent).toBeNull();
    const cases = [...Array(5)].map(() => ({ createdAt: '2026-08-10T01:00:00Z', category: 'การเรียน', status: 'RESOLVED' }));
    const g = guidanceSection(cases, range);
    expect(g.cases).toBe(5);
    expect(g.byCategory).toEqual({ 'การเรียน': 5 });
  });
  it('นิเทศ: เฉลี่ยแสดงเมื่อ ≥5 คน, น้อยกว่านั้นซ่อนทั้งหมด', () => {
    const mk = (n: number) => [...Array(n)].map(() => ({ submitted: true, percent: 90, band: 'ดี' }));
    expect(supervisionSection(mk(4))).toMatchObject({ observed: null, averagePercent: null });
    expect(supervisionSection(mk(4)).bands['ดี']).toBeNull();
    expect(supervisionSection(mk(8))).toMatchObject({ observed: 8, averagePercent: 90 });
    expect(supervisionSection([{ submitted: false, percent: 99, band: 'ดีมาก' }, ...mk(5)]).observed).toBe(5);
  });
  it('สถิติสอน: เฉพาะที่อนุมัติครบ; ซ่อนเมื่อครูที่เกี่ยวข้อง <5 คน', () => {
    const row = (i: number, extra = {}) => ({ date: '2026-09-01', status: 'APPROVED', triggerType: 'SICK_LEAVE', originalTeacherEmail: `t${i}@x`, ...extra });
    const t = teachingSection([...[...Array(5)].map((_, i) => row(i)), row(9, { status: 'PENDING_APPROVAL' }), row(1, { swapMode: 'SWAP' })], range);
    expect(t.SICK_LEAVE).toEqual({ periods: 5, teachers: 5 });
    expect(t.SWAP).toEqual({ periods: null, teachers: null });
    expect(t.OFFICIAL_DUTY).toEqual({ periods: 0, teachers: 0 });
  });
  it('ครูผู้สอน: ข้าม alias อีเมลและคนที่ปิดการใช้งาน', () => {
    expect(activeTeacherCount([
      { id: 'a', email: 'a@x', roles: ['SUBJECT_TEACHER'] }, { id: 'a@x', email: 'a@x', roles: ['SUBJECT_TEACHER'] },
      { id: 'b', roles: ['SUBJECT_TEACHER'], status: 'INACTIVE' }, { id: 'c', roles: ['DIRECTOR'] },
    ])).toBe(1);
  });
  it('ผลลัพธ์ไม่มีข้อมูลระบุตัวบุคคล (ชื่อ/อีเมล)', () => {
    const json = JSON.stringify(teachingSection([{ date: '2026-09-01', status: 'APPROVED', originalTeacherEmail: 'secret@x', substituteTeacherEmail: 'other@x' }], range));
    expect(json).not.toMatch(/secret|other@x/);
  });
});

describe('ตัวช่วยหน้าสาธารณะ', () => {
  it('path / format / bars', () => {
    expect(isPublicInfoPath('/info')).toBe(true); expect(isPublicInfoPath('/info/')).toBe(true); expect(isPublicInfoPath('/information')).toBe(false);
    expect(formatCell(null)).toBe('<5'); expect(formatCell(12)).toBe('12'); expect(formatCell(undefined)).toBe('-');
    expect(monthLabel('2026-09')).toBe('ก.ย. 2569');
    const rows = barRows({ a: 10, b: null });
    expect(rows.find(r => r.key === 'b')).toMatchObject({ text: '<5', pct: 0 });
  });
});

describe('guard: หน้าสาธารณะ', () => {
  const root = path.resolve(__dirname, '../..');
  const src = (rel: string) => readSource(path.join(root, rel));
  it('firestore.rules: public_summary อ่านได้เฉพาะ get เอกสาร current โดยไม่ต้องล็อกอิน, เขียนไม่ได้', () => {
    const rules = src('firestore.rules.comments'); // อ่านฉบับมีคอมเมนต์ เพื่อหาขอบเขตบล็อก
    const block = rules.slice(rules.indexOf('match /public_summary/{docId}'), rules.indexOf('// Default Deny All Catch-All'));
    expect(block).toContain("allow get: if docId == 'current';");
    expect(block).toContain('allow list, write: if false;');
    expect(block).not.toContain('isSignedIn');
  });
  it('SchoolInfoPage อ่านเฉพาะ public_summary/current เท่านั้น', () => {
    const s = src('src/components/publicinfo/SchoolInfoPage.tsx');
    expect(s.match(/doc\(db, '([^']+)'/g)).toEqual(["doc(db, 'public_summary'"]);
    expect(s).not.toMatch(/collection\(|onSnapshot|getDocs/);
  });
  it('main.tsx แยกหน้า /info ออกจาก App (ไม่ผ่านล็อกอิน) และ functions export ฟังก์ชันสรุป', () => {
    expect(src('src/main.tsx')).toContain('isPublicInfoPath(window.location.pathname) ? <SchoolInfoPage /> : <App />');
    expect(src('functions/src/index.ts')).toContain("export { scheduledPublicSummary, refreshPublicSummary } from './publicSummary';");
  });
});
