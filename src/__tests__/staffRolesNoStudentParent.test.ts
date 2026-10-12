import { describe, it, expect } from 'vitest';
import { readSource } from './helpers/readSource';
import { NON_STAFF_ROLES } from '../../functions/src/staffValidation';
import { NON_STAFF_ROLE_KEYS } from '../components/StaffRoleManagementPage';

describe('บทบาท STUDENT/PARENT ไม่ใช่บทบาทบุคลากร', () => {
  it('ค่าฝั่ง client ตรงกับ functions', () => {
    expect([...NON_STAFF_ROLE_KEYS].sort()).toEqual([...NON_STAFF_ROLES].sort());
  });

  it('assignUserRole ปฏิเสธ NON_STAFF_ROLES ก่อนเขียนอะไร', () => {
    const src = readSource('functions/src/setUserRole.ts');
    const reject = src.indexOf('NON_STAFF_ROLES.includes');
    expect(reject).toBeGreaterThan(-1);
    expect(reject).toBeLessThan(src.indexOf('batch.commit()'));
    expect(reject).toBeLessThan(src.indexOf('setCustomUserClaims'));
  });

  it('หน้าจัดการสิทธิ์ไม่แสดงช่องเลือก STUDENT/PARENT ทั้งฟอร์มแก้ไข ตัวกรอง และฟอร์มเพิ่ม', () => {
    const src = readSource('src/components/StaffRoleManagementPage.tsx');
    expect(src).not.toMatch(/Object\.entries\(ROLE_NAMES_TH\)\s*\.map|Object\.entries\(ROLE_NAMES_TH\)\.map/);
    expect(src).toMatch(/STAFF_ROLE_ENTRIES\.map/);
    expect(src).toMatch(/setFormRoles\(staff\.roles\.filter\(r => !NON_STAFF_ROLE_KEYS\.includes\(r\)\)\)/);
  });
});
