import { describe, it, expect } from 'vitest';
import path from 'path';
import { readSource } from './helpers/readSource';
import { BLOOD_GROUPS, isBloodGroup } from '../lib/bloodType';
import { pickHealthPrefill } from '../lib/homeVisitHealthPrefill';
import { emptyStudentInfo } from '../lib/homeVisitData';

const base = { studentId: '1', studentUid: 'u', homeroomClass: 'ม.2/2' };
const src = (p: string) => readSource(path.resolve(__dirname, '..', p));

describe('หมู่เลือด', () => {
  it('รับเฉพาะ A/B/AB/O', () => {
    expect([...BLOOD_GROUPS]).toEqual(['A', 'B', 'AB', 'O']);
    expect(isBloodGroup('AB')).toBe(true);
    expect(isBloodGroup('ไม่ทราบ')).toBe(false);
    expect(isBloodGroup('')).toBe(false);
  });
});

describe('pickHealthPrefill — แบบเยี่ยมบ้านข้อ 3 ดึงจากข้อมูลสุขภาพ', () => {
  it('หมู่เลือดที่ล็อกทับค่าในแบบ; น้ำหนัก/ส่วนสูงเติมเฉพาะช่องว่าง', () => {
    const f = { ...emptyStudentInfo(base), bloodType: 'ไม่ทราบ', weightKg: 70 };
    const r = pickHealthPrefill(f, { bloodType: 'O', latest: { weight: 65, height: 165 } });
    expect(r.bloodType).toBe('O');
    expect(r.weightKg).toBe(70);   // ไม่ทับที่กรอกเอง
    expect(r.heightCm).toBe(165);
  });
  it('ไม่มีอะไรเปลี่ยน = คืน object เดิม (กัน render วน)', () => {
    const f = { ...emptyStudentInfo(base), bloodType: 'O', weightKg: 65, heightCm: 165 };
    expect(pickHealthPrefill(f, { bloodType: 'O', latest: { weight: 65, height: 165 } })).toBe(f);
    expect(pickHealthPrefill(f, { bloodType: null, latest: null })).toBe(f);
  });
});

describe('wiring + rules', () => {
  it('บันทึกน้ำหนัก/ส่วนสูง + ข้อมูลสุขภาพ ใช้ studentUid/parentUid ตามทะเบียนจริง ไม่ใช่ alias parentId (เคยทำให้ permission-denied)', () => {
    const svc = src('services/firestoreService.ts');
    expect(svc).toMatch(/export async function getStudentLinkIds/);
    expect(svc).toMatch(/saveSemesterHealthLog[\s\S]{0,900}getStudentLinkIds/);
    expect(svc).toMatch(/saveStudentHealthProfile[\s\S]{0,900}getStudentLinkIds/);
    expect(src('components/student-parent/SemesterHealthSelfReportForm.tsx')).not.toContain('parentId');
    expect(src('components/health/HealthProfileSection.tsx')).not.toContain('student.parentId');
  });
  it('ฟอร์มน้ำหนัก/ส่วนสูงไม่มีช่องพิมพ์หมู่เลือดอิสระอีก ใช้การ์ดเลือกครั้งเดียว', () => {
    const f = src('components/student-parent/SemesterHealthSelfReportForm.tsx');
    expect(f).toContain('BloodTypeCard');
    expect(f).not.toContain('setBloodType');
  });
  it('rules: นักเรียน/ผู้ปกครอง create ได้ครั้งเดียว, update เฉพาะพยาบาล/แอดมิน, ลบไม่ได้', () => {
    const r = readSource(path.resolve(__dirname, '../../firestore.rules'));
    const b = r.slice(r.indexOf('match /student_blood_type/'), r.indexOf('match /student_emergency_contacts/'));
    expect(b).toMatch(/allow create: if \(isSelfStudent\(sid\) \|\| isParentOfStudent\(sid\)/);
    const upd = b.slice(b.indexOf('allow update'), b.indexOf('allow delete'));
    expect(upd).toContain("hasRole('INFIRMARY_STAFF')");
    expect(upd).not.toContain('isSelfStudent');
    expect(upd).not.toContain('isParentOfStudent');
    expect(b).toContain('allow delete: if false');
    expect(b).toContain("bloodType in ['A', 'B', 'AB', 'O']");
  });
});
