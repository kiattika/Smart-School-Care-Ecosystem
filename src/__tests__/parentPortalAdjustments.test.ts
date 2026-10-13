import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { readSource } from './helpers/readSource';
import {
  emptyGuardian, guardianChoiceOf, guardianFromParent, validateFamilyInfo, normalizeFamilyInfo,
} from '../lib/homeVisitData';
import type { ParentInfo } from '../types';

const root = path.resolve(__dirname, '../..');
const src = (rel: string) => readSource(path.join(root, rel));

const father: ParentInfo = { presence: 'PRESENT', title: 'นาย', firstName: 'สมชาย', lastName: 'ใจดี', age: 45, occupation: 'ครู', incomeBracket: '20,000-39,999 บาท', health: 'ปกติ', phone: '0812345678' };

describe('ข้อ 13 ผู้ปกครอง: บิดา/มารดา/อื่น ๆ', () => {
  it('guardianChoiceOf: relation ว่าง = ยังไม่เลือก, บิดา/มารดา = ใช้ข้อมูลด้านบน, อย่างอื่น = OTHER', () => {
    expect(guardianChoiceOf(emptyGuardian())).toBe('');
    expect(guardianChoiceOf({ ...emptyGuardian(), relation: 'บิดา' })).toBe('FATHER');
    expect(guardianChoiceOf({ ...emptyGuardian(), relation: 'มารดา' })).toBe('MOTHER');
    expect(guardianChoiceOf({ ...emptyGuardian(), relation: 'ป้า' })).toBe('OTHER');
  });

  it('guardianFromParent คัดลอกข้อมูลบิดา/มารดาและคงฟิลด์ที่บิดามารดาไม่มี (การศึกษา/ที่อยู่)', () => {
    const prev = { ...emptyGuardian(), education: 'ปริญญาตรี', sameAddressAsStudent: false, address: 'บ้านเลขที่ 1' };
    const g = guardianFromParent(father, 'บิดา', prev);
    expect(g).toMatchObject({ relation: 'บิดา', firstName: 'สมชาย', lastName: 'ใจดี', age: 45, occupation: 'ครู', phone: '0812345678', health: 'ปกติ', education: 'ปริญญาตรี', address: 'บ้านเลขที่ 1' });
  });

  it('validateFamilyInfo: เลือกบิดาแต่บิดาไม่ใช่ "ปรากฏ" → error ชัดเจน', () => {
    const base = normalizeFamilyInfo(null, { studentId: 's', parentUid: 'p', homeroomClass: 'ม.5/8' } as any, '');
    const f = { ...base, father: { ...base.father, presence: 'DECEASED' as const }, guardian: { ...base.guardian, relation: 'บิดา' } };
    expect(validateFamilyInfo(f).some(e => e.includes('เลือกบิดาเป็นผู้ปกครองไม่ได้'))).toBe(true);
  });

  it('ฟอร์มมีตัวเลือก บิดา/มารดา/อื่น ๆ และแสดงฟอร์มกรอกเองเฉพาะ "อื่น ๆ"', () => {
    const s = src('src/components/homevisit/FamilyHomeVisitInfoForm.tsx');
    expect(s).toContain("['บิดา', 'มารดา', 'อื่น ๆ']");
    expect(s).toContain("choice === 'OTHER' && (<>");
  });
});

describe('ผู้ปกครอง: คัดกรองอารมณ์ดูอย่างเดียว', () => {
  const s = src('src/components/student-parent/HealthMentalWellbeingModule.tsx');
  it('ฝั่งผู้ปกครองเห็น ParentScreeningResultsView ไม่เห็นแบบฟอร์ม 2Q', () => {
    expect(s).toContain("activeTab === 'screening' && isParentView && (");
    expect(s).toContain("activeTab === 'screening' && !isParentView && (");
    expect(s).toContain('<ParentScreeningResultsView');
  });
  it('มุมมองผู้ปกครองไม่แสดงหมายเหตุภายใน (note) และคำตอบรายข้อ', () => {
    const view = s.slice(s.indexOf('function ParentScreeningResultsView'), s.indexOf('type HealthMentalWellbeingModuleProps'));
    expect(view).not.toMatch(/\.note\b|q1Depressed|q2Hopeless/);
  });
  it('rules: ผู้ปกครองอ่าน 2Q และ notices ได้ แต่เขียน 2Q ไม่ได้', () => {
    const r = src('firestore.rules');
    const twoQ = r.slice(r.indexOf('match /student_screenings_2q/{studentId}'), r.indexOf('match /student_screenings_phq9'));
    expect(twoQ).toMatch(/allow read:[^;]*isParentOfStudent\(studentId\)/);
    expect(twoQ).toMatch(/allow write:(?![^;]*isParentOfStudent)/);
    const notices = r.slice(r.indexOf('match /student_screening_notices/'), r.indexOf('match /student_screening_followups/'));
    expect(notices).toMatch(/allow read:[^;]*isParentOfStudent\(studentId\)/);
  });
});

describe('ประตูโรงเรียน + GPS', () => {
  const g = src('src/components/student-parent/GateAttendanceTracker.tsx');
  it('ไม่มีแท็บสถิติการเข้าเรียน (ทั้งผู้ปกครองและนักเรียน)', () => {
    expect(g).not.toContain("'subject'");
    expect(g).not.toContain('<span>สถิติการเข้าเรียน</span>');
    expect(g).not.toContain('attendanceStatsFromCounts');
  });
  it('ไม่อ้างว่าซิงก์ LINE Official (ไม่มีระบบนั้นจริง) และแสดง log รายวันแบบครูที่ปรึกษา', () => {
    expect(g).not.toContain('ซิงค์แจ้งเตือนผ่าน LINE Official');
    expect(g).toContain('data-testid="gate-day-rows"');
  });
  it('ปุ่ม GPS บน Navbar ซ่อนเมื่อบทบาทเป็นผู้ปกครอง', () => {
    expect(src('src/components/NavbarWithRoleSwitcher.tsx')).toContain("{activeRole !== 'PARENT' && (");
  });
});
