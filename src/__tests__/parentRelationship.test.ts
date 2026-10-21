import { describe, it, expect } from 'vitest';
import { PARENT_RELATIONSHIPS, parentDisplayNameOf, parentRelationshipLabel } from '../lib/parentRelationship';
import { parentDisplayName } from '../lib/parentAdmin';
import { PARENT_RELATIONSHIPS as FN_RELATIONSHIPS, normalizeRelationship, registryParentName } from '../../functions/src/parentLineLogic';
import { readSource } from './helpers/readSource';

describe('ป้ายความสัมพันธ์ผู้ปกครอง', () => {
  it('รู้จัก บิดา/มารดา/ผู้ปกครอง และตัดช่องว่าง', () => {
    expect(parentRelationshipLabel('บิดา')).toBe('บิดา');
    expect(parentRelationshipLabel(' มารดา ')).toBe('มารดา');
    expect(parentRelationshipLabel('ผู้ปกครอง')).toBe('ผู้ปกครอง');
  });
  it('ว่าง/ไม่รู้จัก → "ผู้ปกครอง" (ไม่แสดง "บุคลากรทางการศึกษา")', () => {
    for (const v of [undefined, null, '', 'ลุง', 42]) expect(parentRelationshipLabel(v)).toBe('ผู้ปกครอง');
  });
  it('รายการตรงกับ functions และกับ BulkDataImportModal', () => {
    expect([...PARENT_RELATIONSHIPS]).toEqual([...FN_RELATIONSHIPS]);
    expect(readSource('src/components/BulkDataImportModal.tsx')).toContain("['บิดา', 'มารดา', 'ผู้ปกครอง']");
  });
  it('functions: ค่าที่ไม่รู้จัก = null ไม่เดา', () => {
    expect(normalizeRelationship('มารดา')).toBe('มารดา');
    expect(normalizeRelationship('ลุง')).toBeNull();
    expect(normalizeRelationship(undefined)).toBeNull();
  });
  it('เชื่อมบัญชี/นำเข้าซ้ำ เขียน parentRelationship; buildAppUser อ่านด้วย parentUid', () => {
    const fn = readSource('functions/src/parentLine.ts');
    expect(fn).toMatch(/parentUid: uid, parentRelationship: normalizeRelationship\(rec\?\.relationship\)/);
    expect(fn).toMatch(/parentRelationship: normalizeRelationship\(r\.relationship\)/);
    const auth = readSource('src/lib/auth.ts');
    expect(auth).toMatch(/where\('parentUid', '==', uid\)/);
    expect(auth).toContain('parentRegistryInfo(fbUser.uid)');
  });
});

describe('ชื่อผู้ปกครองตามทะเบียน (students.parentDisplayName)', () => {
  it('functions: รวมคำนำหน้า+ชื่อ นามสกุล ตรงกับรูปแบบในหน้าจัดการผู้ปกครอง', () => {
    const samples = [
      { parentPrefix: 'นาง', parentFirstName: 'เพียงฤทัย', parentLastName: 'แก้วหล้า' },
      { parentPrefix: '', parentFirstName: 'สมชาย', parentLastName: 'ใจดี' },
      { parentPrefix: ' นาย ', parentFirstName: ' ก ', parentLastName: ' ข ' },
    ];
    for (const s of samples) {
      const fn = registryParentName(s.parentPrefix, s.parentFirstName, s.parentLastName);
      const trimmed = { parentPrefix: s.parentPrefix.trim(), parentFirstName: s.parentFirstName.trim(), parentLastName: s.parentLastName.trim() };
      expect(fn).toBe(parentDisplayName(trimmed));
    }
    expect(registryParentName('นาง', 'เพียงฤทัย', 'แก้วหล้า')).toBe('นางเพียงฤทัย แก้วหล้า');
  });
  it('functions: ไม่มีชื่อหรือนามสกุล/ยาวเกิน = null (ไม่เดา)', () => {
    expect(registryParentName('นาง', '', 'แก้วหล้า')).toBeNull();
    expect(registryParentName('นาง', 'เพียงฤทัย', '')).toBeNull();
    expect(registryParentName(undefined, undefined, undefined)).toBeNull();
    expect(registryParentName('', 'ก'.repeat(100), 'ข'.repeat(100))).toBeNull();
  });
  it('client: อ่านเฉพาะข้อความที่ไม่ว่าง ไม่เกิน 160 ตัวอักษร', () => {
    expect(parentDisplayNameOf(' นางเพียงฤทัย แก้วหล้า ')).toBe('นางเพียงฤทัย แก้วหล้า');
    for (const v of [undefined, null, '', '   ', 42, 'ก'.repeat(161)]) expect(parentDisplayNameOf(v)).toBe('');
  });
  it('เชื่อมบัญชี/นำเข้าซ้ำ เขียนชื่อ; เปลี่ยนผู้ปกครอง/ยกเลิกการเชื่อม ล้างชื่อ; Navbar ใช้ชื่อทะเบียนก่อนชื่อ LINE', () => {
    const fn = readSource('functions/src/parentLine.ts');
    expect(fn).toMatch(/parentDisplayName: registryParentName\(rec\?\.parentPrefix, rec\?\.parentFirstName, rec\?\.parentLastName\)/);
    expect(fn).toMatch(/parentDisplayName: registryParentName\(r\.parentPrefix, r\.parentFirstName, r\.parentLastName\)/);
    expect(fn.match(/parentUid: null, parentDisplayName: FieldValue\.delete\(\)/g)?.length).toBe(2);
    const auth = readSource('src/lib/auth.ts');
    expect(auth).toContain('parentInfo?.name || fbUser.displayName');
  });
});
