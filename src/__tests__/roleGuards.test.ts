import { describe, it, expect } from 'vitest';
import { isSelfTarget, selfDemotionError, SELF_DEMOTION_MESSAGE } from '../../functions/src/roleGuards';

/** assignUserRole: SUPER_ADMIN ห้ามถอน SUPER_ADMIN ของตัวเอง (E2E บน emulator อยู่ใน authBlocking.e2e.test.ts) */
const base = { callerUid: 'uid-admin', callerStaffId: 'admin-01', targetStaffId: 'admin-01', targetUid: 'uid-admin' };

describe('isSelfTarget', () => {
  it('matches by staffId claim or by Auth UID', () => {
    expect(isSelfTarget({ ...base, newRoles: [] })).toBe(true);
    expect(isSelfTarget({ ...base, callerStaffId: undefined, newRoles: [] })).toBe(true);           // UID เท่านั้น
    expect(isSelfTarget({ ...base, targetUid: null, newRoles: [] })).toBe(true);                    // staffId เท่านั้น
    expect(isSelfTarget({ ...base, targetStaffId: 'teacher-09', targetUid: 'uid-t9', newRoles: [] })).toBe(false);
    expect(isSelfTarget({ ...base, callerStaffId: '', targetStaffId: 'teacher-09', targetUid: null, newRoles: [] })).toBe(false);
  });
});

describe('selfDemotionError', () => {
  it('blocks removing SUPER_ADMIN from yourself, including an empty role list', () => {
    expect(selfDemotionError({ ...base, newRoles: ['SUBJECT_TEACHER'] })).toBe(SELF_DEMOTION_MESSAGE);
    expect(selfDemotionError({ ...base, newRoles: [] })).toBe(SELF_DEMOTION_MESSAGE);
    // UID ตรงแต่ไม่มี staffId claim (เช่น token เก่า) ก็ยังกัน
    expect(selfDemotionError({ ...base, callerStaffId: undefined, newRoles: ['EXECUTIVE'] })).toBe(SELF_DEMOTION_MESSAGE);
  });

  it('allows changing your own other roles as long as SUPER_ADMIN stays', () => {
    expect(selfDemotionError({ ...base, newRoles: ['SUPER_ADMIN'] })).toBeNull();
    expect(selfDemotionError({ ...base, newRoles: ['EXECUTIVE', 'SUPER_ADMIN'] })).toBeNull();
  });

  it('allows demoting another SUPER_ADMIN (including one who never logged in)', () => {
    expect(selfDemotionError({ ...base, targetStaffId: 'admin-02', targetUid: 'uid-admin-2', newRoles: ['SUBJECT_TEACHER'] })).toBeNull();
    expect(selfDemotionError({ ...base, targetStaffId: 'admin-03', targetUid: null, newRoles: [] })).toBeNull();
  });

  it('message is Thai and explains why', () => {
    expect(SELF_DEMOTION_MESSAGE).toContain('ล็อกตัวเองออก');
  });
});
