import { describe, it, expect } from 'vitest';
import path from 'path';
import { readSource } from './helpers/readSource';
import { validateHealthLists, normalizeHealthLists, healthVerifyStatus, EMPTY_HEALTH_LISTS, MAX_HEALTH_ITEMS } from '../lib/healthProfile';

const ci = (over: any = {}) => ({ id: 'c', name: 'หอบหืด', severity: 'MILD', treatmentCare: '', ...over });
const al = (over: any = {}) => ({ id: 'a', allergen: 'กุ้ง', type: 'FOOD', reaction: '', ...over });
const sc = (over: any = {}) => ({ id: 's', category: 'สายตา', description: 'สายตาสั้น', actionPlan: '', ...over });

describe('validateHealthLists', () => {
  it('ว่างทั้งหมดใช้ได้ (ครอบครัวยืนยันว่าไม่มี)', () => {
    expect(validateHealthLists(EMPTY_HEALTH_LISTS)).toEqual([]);
  });
  it('รายการที่กรอกครบใช้ได้', () => {
    expect(validateHealthLists({ chronicIllnesses: [ci()], allergies: [al()], specialCare: [sc()] })).toEqual([]);
  });
  it('ไม่ยอมรับรายการว่าง/ระดับผิด/ข้อความยาวเกิน/เกิน 20 รายการ', () => {
    expect(validateHealthLists({ ...EMPTY_HEALTH_LISTS, chronicIllnesses: [ci({ name: '  ' })] }).length).toBe(1);
    expect(validateHealthLists({ ...EMPTY_HEALTH_LISTS, chronicIllnesses: [ci({ severity: 'X' })] }).length).toBe(1);
    expect(validateHealthLists({ ...EMPTY_HEALTH_LISTS, allergies: [al({ allergen: '' })] }).length).toBe(1);
    expect(validateHealthLists({ ...EMPTY_HEALTH_LISTS, specialCare: [sc({ description: '' })] }).length).toBe(1);
    expect(validateHealthLists({ ...EMPTY_HEALTH_LISTS, allergies: [al({ reaction: 'ก'.repeat(301) })] }).length).toBe(1);
    expect(validateHealthLists({ ...EMPTY_HEALTH_LISTS, allergies: Array.from({ length: MAX_HEALTH_ITEMS + 1 }, (_, i) => al({ id: `a${i}` })) }).length).toBe(1);
  });
  it('normalize ตัดช่องว่างหัวท้าย', () => {
    const n = normalizeHealthLists({ ...EMPTY_HEALTH_LISTS, allergies: [al({ allergen: '  ถั่ว  ', reaction: ' ผื่น ' })] });
    expect(n.allergies[0]).toMatchObject({ allergen: 'ถั่ว', reaction: 'ผื่น' });
  });
});

describe('healthVerifyStatus', () => {
  it('ไม่มี=NONE, มีแต่ไม่มีตรา=UNVERIFIED, มีตรา=VERIFIED', () => {
    expect(healthVerifyStatus(null)).toBe('NONE');
    expect(healthVerifyStatus(undefined)).toBe('NONE');
    expect(healthVerifyStatus({ verifiedAt: null })).toBe('UNVERIFIED');
    expect(healthVerifyStatus({ verifiedAt: { seconds: 1 } })).toBe('VERIFIED');
  });
});

describe('guard: ห้ามข้อมูลสุขภาพปลอมกลับมา + rules ผูกกับโครงสร้างที่ตั้งใจ', () => {
  const src = (p: string) => readSource(path.resolve(__dirname, '..', p));
  it('แท็บโรคประจำตัวของพยาบาลไม่มีข้อมูลตายตัว (เคยแสดง หอบหืด/เพนิซิลลิน/คุณแม่สมศรี กับนักเรียนทุกคน)', () => {
    const s = src('components/infirmary/InfirmaryPortal.tsx');
    expect(s).not.toMatch(/Ventolin|Penicillin|สมศรี|089-123-4567/);
    expect(s).toContain('InfirmaryHealthProfilePanel');
  });
  it('หน้าสุขภาพนักเรียน/ผู้ปกครองอ่านโปรไฟล์จริง ไม่ใช่ store ที่ว่างเสมอ', () => {
    const s = src('components/student-parent/HealthMentalWellbeingModule.tsx');
    expect(s).toContain('HealthProfileSection');
    expect(s).not.toMatch(/chronicIllnesses\[|specialCareNeeds\[|allergies\[/);
  });
  it('rules: ครอบครัวเขียน (ล้างตรา), พยาบาลแตะได้เฉพาะ verified*, ห้ามลบ', () => {
    const r = readSource(path.resolve(__dirname, '../../firestore.rules'));
    const i = r.indexOf('match /student_health_profiles/{sid}');
    expect(i).toBeGreaterThan(-1);
    const block = r.slice(i, i + 5500);
    expect(block).toMatch(/hasOnly\(\['verifiedAt', 'verifiedByUid', 'verifiedByName'\]\)/);
    expect(block).toMatch(/verifiedAt == null/);
    expect(block).toMatch(/allow delete: if false/);
    expect(block).not.toMatch(/\|\| isSignedIn\(\)/);
  });
});
