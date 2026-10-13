import { describe, it, expect } from 'vitest';
import path from 'path';
import { readSource } from './helpers/readSource';
import { deriveEmergencyContacts, hasUsablePhone } from '../lib/emergencyContacts';

const parent = (over: any = {}) => ({ presence: 'PRESENT', title: 'นาย', firstName: 'สมชาย', lastName: 'ใจดี', age: 40, occupation: '', incomeBracket: '', health: '', phone: '', ...over });
const guardian = (over: any = {}) => ({ ...parent(), relation: 'ป้า', education: '', chronicDisease: '', sameAddressAsStudent: true, address: '', ...over });
const info = (over: any = {}) => ({ father: parent(), mother: parent({ title: 'นาง', firstName: 'สมศรี' }), guardian: guardian(), ...over });

describe('deriveEmergencyContacts — ดึงจากแบบเยี่ยมบ้านทั้งหมดที่กรอก', () => {
  it('ไม่มีข้อมูล/ไม่มีเบอร์ = ไม่มีผู้ติดต่อ (ไม่สร้างเบอร์สมมติ)', () => {
    expect(deriveEmergencyContacts(null)).toEqual([]);
    expect(deriveEmergencyContacts(info())).toEqual([]);
    expect(deriveEmergencyContacts(info({ father: parent({ phone: '-' }) }))).toEqual([]);
  });
  it('รวมบิดา มารดา ผู้ปกครอง ที่มีเบอร์ใช้ได้ พร้อมความสัมพันธ์และชื่อเต็ม', () => {
    const r = deriveEmergencyContacts(info({
      father: parent({ phone: '081-111-1111' }), mother: parent({ title: 'นาง', firstName: 'สมศรี', phone: '089-123-4567' }), guardian: guardian({ phone: '0822222222' }),
    }));
    expect(r.map(c => c.source)).toEqual(['FATHER', 'MOTHER', 'GUARDIAN']);
    expect(r[1]).toMatchObject({ relation: 'มารดา', name: 'นางสมศรี ใจดี', phone: '089-123-4567' });
    expect(r[2].relation).toBe('ป้า');
  });
  it('ผู้ปกครองเบอร์ซ้ำกับบิดา/มารดา (ระบบคัดลอกให้) แสดงครั้งเดียว', () => {
    const r = deriveEmergencyContacts(info({ mother: parent({ phone: '089-123-4567' }), guardian: guardian({ phone: '0891234567', relation: 'มารดา' }) }));
    expect(r).toHaveLength(1);
  });
  it('บิดา/มารดาที่เสียชีวิตไม่ถูกนำมาเป็นผู้ติดต่อ แม้มีเบอร์ค้างอยู่', () => {
    expect(deriveEmergencyContacts(info({ father: parent({ presence: 'DECEASED', phone: '0811111111' }) }))).toEqual([]);
  });
  it('hasUsablePhone ต้องมีตัวเลขอย่างน้อย 9 หลัก', () => {
    expect(hasUsablePhone('-')).toBe(false);
    expect(hasUsablePhone('02-123-456')).toBe(false);
    expect(hasUsablePhone('089-123-4567')).toBe(true);
  });
});

describe('ผู้ติดต่อฉุกเฉิน — wiring + rules', () => {
  const src = (p: string) => readSource(path.resolve(__dirname, '..', p));
  it('บันทึกแบบเยี่ยมบ้านเขียนสำเนาผู้ติดต่อใน batch เดียวกัน และฟอร์มซิงก์ย้อนหลังให้ข้อมูลเก่า', () => {
    const svc = src('services/firestoreService.ts');
    expect(svc).toMatch(/saveFamilyHomeVisitInfo[\s\S]{0,400}writeBatch\(db\)[\s\S]{0,400}EMERGENCY_CONTACTS_COL/);
    expect(src('components/homevisit/FamilyHomeVisitInfoForm.tsx')).toContain('syncEmergencyContacts');
  });
  it('แท็บพยาบาลใช้ข้อมูลจริงจากสำเนา ไม่มีเบอร์/ชื่อตายตัว', () => {
    const portal = src('components/infirmary/InfirmaryPortal.tsx');
    expect(portal).toContain('InfirmaryEmergencyContactsPanel');
    expect(portal).not.toContain('089-123-4567');
    expect(portal).not.toContain('สมศรี');
  });
  it('rules: พยาบาลอ่านเอกสารเยี่ยมบ้านฝั่งครอบครัวไม่ได้ (รายได้) และสำเนาผู้ติดต่อเขียนได้เฉพาะผู้ปกครองตัวจริง', () => {
    const r = readSource(path.resolve(__dirname, '../../firestore.rules'));
    const fam = r.slice(r.indexOf('match /home_visit_family_info/'), r.indexOf('match /reference_schools/'));
    expect(fam).not.toContain('INFIRMARY_STAFF');
    const ec = r.slice(r.indexOf('match /student_emergency_contacts/'));
    expect(ec).toMatch(/allow create, update: if isParentOfStudent\(sid\)/);
    expect(ec).toContain('allow delete: if false');
  });
});
