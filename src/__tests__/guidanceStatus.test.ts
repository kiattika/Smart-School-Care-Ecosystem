import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { activeGuidanceCounselors, hasActiveGuidanceCounselor } from '../../functions/src/guidanceStatusLogic';
import { readSource } from './helpers/readSource';

/**
 * hasActiveGuidanceCounselor — "มีครูแนะแนวที่ใช้งานอยู่ในระบบหรือไม่" (functions/src/guidanceStatusLogic.ts)
 * ผลถูก cache เป็น school_settings/guidance_status ให้ firestore.rules ใช้ตัดสินสิทธิ์อ่าน 9Q/8Q ของครูที่ปรึกษา
 */
const staff = (id: string, roles: unknown, status?: unknown, email?: string) => ({ id, roles, status, email });

describe('hasActiveGuidanceCounselor — case 1: there IS an active counselor', () => {
  it('one ACTIVE staff with the GUIDANCE_COUNSELOR role', () => {
    expect(hasActiveGuidanceCounselor([staff('t1', ['SUBJECT_TEACHER']), staff('g1', ['GUIDANCE_COUNSELOR'], 'ACTIVE')])).toBe(true);
  });
  it('a staff doc without a status field counts as active (older data)', () => {
    expect(hasActiveGuidanceCounselor([staff('g1', ['GUIDANCE_COUNSELOR'])])).toBe(true);
  });
  it('a counselor who also holds other roles still counts', () => {
    expect(hasActiveGuidanceCounselor([staff('g1', ['HOMEROOM_TEACHER', 'GUIDANCE_COUNSELOR'], 'ACTIVE')])).toBe(true);
  });
  it('an INACTIVE counselor does not hide an active one', () => {
    expect(hasActiveGuidanceCounselor([staff('g1', ['GUIDANCE_COUNSELOR'], 'INACTIVE'), staff('g2', ['GUIDANCE_COUNSELOR'], 'ACTIVE')])).toBe(true);
    expect(activeGuidanceCounselors([staff('g1', ['GUIDANCE_COUNSELOR'], 'INACTIVE'), staff('g2', ['GUIDANCE_COUNSELOR'], 'ACTIVE')]).map((s) => s.id)).toEqual(['g2']);
  });
});

describe('hasActiveGuidanceCounselor — case 2: there is NO active counselor', () => {
  it('empty staff list', () => {
    expect(hasActiveGuidanceCounselor([])).toBe(false);
  });
  it('nobody holds the role', () => {
    expect(hasActiveGuidanceCounselor([staff('t1', ['SUBJECT_TEACHER']), staff('h1', ['HOMEROOM_TEACHER'], 'ACTIVE')])).toBe(false);
  });
  it('the only counselor was deactivated (setStaffActive → INACTIVE)', () => {
    expect(hasActiveGuidanceCounselor([staff('g1', ['GUIDANCE_COUNSELOR'], 'INACTIVE')])).toBe(false);
  });
  it('a counselor whose roles were removed (empty / missing / malformed roles) does not count', () => {
    expect(hasActiveGuidanceCounselor([staff('g1', [], 'ACTIVE')])).toBe(false);
    expect(hasActiveGuidanceCounselor([staff('g1', undefined, 'ACTIVE')])).toBe(false);
    expect(hasActiveGuidanceCounselor([staff('g1', 'GUIDANCE_COUNSELOR', 'ACTIVE')])).toBe(false); // ไม่ใช่ array
  });
  it('legacy alias docs keyed by the e-mail (same person duplicated) are ignored — an alias alone is not a counselor', () => {
    expect(hasActiveGuidanceCounselor([staff('g@utd.ac.th', ['GUIDANCE_COUNSELOR'], 'ACTIVE', 'g@utd.ac.th')])).toBe(false);
    expect(hasActiveGuidanceCounselor([staff('g@utd.ac.th', ['GUIDANCE_COUNSELOR'], 'ACTIVE', 'G@UTD.AC.TH'), staff('g1', ['GUIDANCE_COUNSELOR'], 'ACTIVE', 'g@utd.ac.th')])).toBe(true);
  });
});

describe('where the cache is kept fresh and read', () => {
  const src = (rel: string) => readSource(path.resolve(__dirname, '../..', rel));

  it('every function that changes roles or active status refreshes the cache; a SUPER_ADMIN callable can backfill it', () => {
    expect(src('functions/src/setUserRole.ts')).toContain('refreshGuidanceStatusSafely()');
    const admin = src('functions/src/staffAdmin.ts');
    expect(admin.match(/refreshGuidanceStatusSafely\(\)/g)?.length).toBe(2); // createStaffMember + setStaffActive
    expect(src('functions/src/index.ts')).toContain('refreshGuidanceStatus');
    expect(src('functions/package.json')).toContain('functions:refreshGuidanceStatus');
    const g = src('functions/src/guidanceStatus.ts');
    expect(g).toContain("db.collection('school_settings').doc('guidance_status')");
    expect(g).toContain("roles.includes('SUPER_ADMIN')");
  });

  it('firestore.rules reads the same doc, fails closed when it is missing, and clients can never write it', () => {
    const rules = src('firestore.rules');
    expect(rules).toContain("school_settings/guidance_status");
    expect(rules).toMatch(/!exists\(\/databases\/\$\(database\)\/documents\/school_settings\/guidance_status\)\s*\|\|/);
    expect(rules).toContain("get('hasActiveCounselor', true) == true");
    expect(rules).toContain("settingId != 'guidance_status'");
    expect(rules).toMatch(/match \/school_settings\/guidance_status \{\s*allow read: if isSignedIn\(\);\s*allow write: if false;/);
  });
});
