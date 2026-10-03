import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { staffIdOf, isSameStaff, isStaffIn, isStaffAssigned } from '../lib/staffIdentity';
import { seedStaffIdFor } from '../../scripts/lib/seedStaffId';
import { readSource } from './helpers/readSource';

/**
 * ตัวตนบุคลากรที่ login = user.staffId (claim staffId) เท่านั้น — ฟิลด์ teacherId/teacherIds/
 * responsibleTeacherUids/backupApproverUid เก็บ staff doc id (teacherId จากไฟล์ import) ไม่ใช่ Auth UID
 */
// รูปเดียวกับ User (src/types.ts) — staffId/studentId เป็น optional
type TestUser = { uid?: string; staffId?: string; studentId?: string } | null | undefined;
const teacher: TestUser & object = { uid: 'firebase-uid-abc', staffId: 'teacher-07' };
const student: TestUser = { uid: 'stu-uid-1', studentId: '38501' };     // ไม่มี staffId
const uidOnlyTeacher: TestUser = { uid: 'teacher-07' };                  // uid บังเอิญตรงกับ staff id แต่ไม่มี claim

describe('staffIdentity helpers', () => {
  it('staffIdOf returns the staffId claim only', () => {
    expect(staffIdOf(teacher)).toBe('teacher-07');
    expect(staffIdOf(student)).toBeNull();
    expect(staffIdOf(uidOnlyTeacher)).toBeNull();
    expect(staffIdOf({ staffId: '' })).toBeNull();
    expect(staffIdOf(null)).toBeNull();
    expect(staffIdOf(undefined)).toBeNull();
  });

  it('matches by staffId (single field, array field, schedule teacherId/teacherIds)', () => {
    expect(isSameStaff(teacher, 'teacher-07')).toBe(true);
    expect(isStaffIn(teacher, ['teacher-01', 'teacher-07'])).toBe(true);
    expect(isStaffAssigned(teacher, { teacherId: 'teacher-07' })).toBe(true);
    expect(isStaffAssigned(teacher, { teacherId: 'teacher-01', teacherIds: ['teacher-01', 'teacher-07'] })).toBe(true);
  });

  it('never matches by Auth UID (no fallback)', () => {
    expect(isSameStaff(teacher, teacher.uid)).toBe(false); // uid ของครูคนเดียวกัน
    expect(isStaffIn(teacher, [teacher.uid])).toBe(false);
    expect(isStaffAssigned(teacher, { teacherId: teacher.uid, teacherIds: [teacher.uid] })).toBe(false);
    // uid เท่ากับค่าในฟิลด์พอดี แต่ไม่มี claim staffId → ไม่ match
    expect(isSameStaff(uidOnlyTeacher, 'teacher-07')).toBe(false);
    expect(isStaffIn(uidOnlyTeacher, ['teacher-07'])).toBe(false);
  });

  it('users without staffId (students / parents / signed out) never match', () => {
    for (const u of [student, uidOnlyTeacher, null, undefined, { staffId: '' }] as TestUser[]) {
      expect(isSameStaff(u, 'teacher-07')).toBe(false);
      expect(isStaffIn(u, ['teacher-07', ''])).toBe(false);
      expect(isStaffAssigned(u, { teacherId: 'teacher-07', teacherIds: ['teacher-07'] })).toBe(false);
    }
    // ค่าว่าง/undefined ในฟิลด์ต้องไม่ match กับผู้ใช้ที่ไม่มี staffId
    expect(isSameStaff(student, undefined)).toBe(false);
    expect(isSameStaff({ staffId: undefined }, undefined)).toBe(false);
  });

  it('handles missing / malformed fields', () => {
    expect(isStaffIn(teacher, undefined)).toBe(false);
    expect(isStaffIn(teacher, 'teacher-07')).toBe(false); // ไม่ใช่ array
    expect(isStaffAssigned(teacher, null)).toBe(false);
    expect(isStaffAssigned(teacher, {})).toBe(false);
  });
});

describe('guard: staff-reference fields are never compared with user.uid', () => {
  const root = path.resolve(__dirname, '../..');
  const srcDir = path.join(root, 'src');
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== '__tests__') walk(p); }
      else if (/\.(ts|tsx)$/.test(e.name)) files.push(p);
    }
  };
  walk(srcDir);

  // ฟิลด์ที่เก็บ staff doc id + การเทียบกับ uid ทุกรูปแบบที่เคยพบ (includes / === / !== ทั้งสองฝั่ง)
  const FIELDS = '(?:teacherIds|responsibleTeacherUids|backupApproverUid|teacherId)';
  const UID = '(?:user|currentUser|effectiveUser)\\??\\.uid';
  const BAD = [
    new RegExp(`${FIELDS}[^;\\n]{0,80}\\.includes\\(\\s*${UID}`),
    new RegExp(`${FIELDS}\\s*[!=]==?\\s*${UID}`),
    new RegExp(`${UID}\\s*[!=]==?\\s*[\\w?.]*${FIELDS}\\b`),
    new RegExp(`${UID}\\s+in\\s+[\\w?.]*${FIELDS}`),
  ];

  it('no app source file compares these fields with user.uid (use src/lib/staffIdentity.ts)', () => {
    const offenders: string[] = [];
    for (const f of files) {
      readSource(f).split('\n').forEach((line, i) => {
        if (BAD.some((re) => re.test(line))) offenders.push(`${path.relative(root, f)}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it('the guard regex actually catches the old buggy forms', () => {
    const old = [
      '(!!user?.uid && (gc.teacherIds || []).includes(user.uid));',
      '(user?.uid && (item.teacherId === user.uid ||',
      '!!user?.uid && (cfg.responsibleTeacherUids || []).includes(user.uid) &&',
      'if (d.backupApproverUid) return d.backupApproverUid === user.uid;',
      'return user.uid === d.backupApproverUid;',
    ];
    for (const line of old) expect(BAD.some((re) => re.test(line)), line).toBe(true);
    expect(BAD.some((re) => re.test('teacherId: user.uid,'))).toBe(false); // เขียนค่าเอง (late requests) ไม่ใช่การเทียบ
  });

  it('firestore.rules isResponsibleTeacherOfActivity uses myStaffId(), never request.auth.uid', () => {
    const rules = readSource(path.join(root, 'firestore.rules'));
    const fn = rules.slice(rules.indexOf('function isResponsibleTeacherOfActivity'), rules.indexOf('}', rules.indexOf('function isResponsibleTeacherOfActivity')));
    expect(fn).toContain("myStaffId() in get(");
    expect(fn).not.toContain('request.auth.uid');
  });

  it('emulator seed keys staff docs by a teacherId-style id that differs from the uid', () => {
    const seed = readSource(path.join(root, 'scripts/seedEmulatorAuth.ts'));
    expect(seed).toContain('const staffId = seedStaffIdFor(userRecord.uid);');
    expect(seed).not.toContain('const staffId = userRecord.uid;');
    for (const uid of ['test_admin_kiattika_001', 'test_advisor_001', 'test_hod_math_001']) {
      expect(seedStaffIdFor(uid)).not.toBe(uid);
    }
    expect(seedStaffIdFor('test_advisor_001')).toBe('tch-advisor-001');
  });
});
