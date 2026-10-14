import { describe, it, expect } from 'vitest';
import { PARENT_RELATIONSHIPS, parentRelationshipLabel } from '../lib/parentRelationship';
import { PARENT_RELATIONSHIPS as FN_RELATIONSHIPS, normalizeRelationship } from '../../functions/src/parentLineLogic';
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
    expect(auth).toContain('parentPositionLabel(fbUser.uid)');
  });
});
