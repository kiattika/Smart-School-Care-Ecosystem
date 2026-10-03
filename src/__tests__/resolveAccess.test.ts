import { describe, it, expect, vi } from 'vitest';
import {
  resolveAccess,
  studentIdFromEmail,
  blockingUserFromEvent,
  AccessLookups,
  StaffRecord,
  StudentRecord,
  DENY_MESSAGES,
  STUDENT_EMAIL_TEMPLATE,
} from '../../functions/src/access';

/**
 * กติกาสิทธิ์เข้าระบบที่ blocking functions (beforeUserCreated/beforeUserSignedIn) ใช้ —
 * ทุกกิ่ง: ไม่มีอีเมล / ยังไม่ verify / ผิดโดเมน / staff (มี roles, roles ว่าง, ซ้ำ) /
 * student (field email, รูปแบบ it{studentId}, ซ้ำ) / ไม่เจอเลย
 */
function makeLookups(opts: {
  staff?: Record<string, StaffRecord[]>;
  studentsByEmail?: Record<string, StudentRecord[]>;
  studentsById?: Record<string, StudentRecord>;
} = {}) {
  const lookups = {
    findStaffByEmail: vi.fn(async (email: string) => opts.staff?.[email] ?? []),
    findStudentsByEmail: vi.fn(async (email: string) => opts.studentsByEmail?.[email] ?? []),
    getStudentById: vi.fn(async (id: string) => opts.studentsById?.[id] ?? null),
  } satisfies AccessLookups;
  return lookups;
}

const verified = (email: string | null | undefined) => ({ email, emailVerified: true });

describe('resolveAccess — email gate', () => {
  it('denies a user with no email', async () => {
    const l = makeLookups();
    expect(await resolveAccess(verified(null), l)).toEqual({ allowed: false, reason: 'NO_EMAIL' });
    expect(await resolveAccess(verified(''), l)).toEqual({ allowed: false, reason: 'NO_EMAIL' });
    expect(l.findStaffByEmail).not.toHaveBeenCalled();
  });

  it('denies an unverified email even on the school domain', async () => {
    const l = makeLookups({ staff: { 'a@utd.ac.th': [{ id: 't-1', roles: ['SUBJECT_TEACHER'] }] } });
    expect(await resolveAccess({ email: 'a@utd.ac.th', emailVerified: false }, l))
      .toEqual({ allowed: false, reason: 'EMAIL_NOT_VERIFIED' });
    expect(await resolveAccess({ email: 'a@utd.ac.th' }, l))
      .toEqual({ allowed: false, reason: 'EMAIL_NOT_VERIFIED' });
    expect(l.findStaffByEmail).not.toHaveBeenCalled();
  });

  it('denies non-utd.ac.th domains, including the removed @school.ac.th and look-alike domains', async () => {
    const l = makeLookups();
    for (const email of ['someone@gmail.com', 'somchai.j@school.ac.th', 'x@evilutd.ac.th', 'x@sub.utd.ac.th', 'x@utd.ac.th.evil.com']) {
      expect(await resolveAccess(verified(email), l)).toEqual({ allowed: false, reason: 'DOMAIN_NOT_ALLOWED' });
    }
    expect(l.findStaffByEmail).not.toHaveBeenCalled();
  });
});

describe('resolveAccess — staff', () => {
  it('grants staff roles from the staff doc, looked up by lowercased email; staffId = doc id (teacherId)', async () => {
    const l = makeLookups({ staff: { 'teacher.a@utd.ac.th': [{ id: 'teacher-01', roles: ['HOMEROOM_TEACHER', 'SUBJECT_TEACHER'] }] } });
    expect(await resolveAccess(verified('  Teacher.A@UTD.ac.th '), l)).toEqual({
      allowed: true, kind: 'staff', staffId: 'teacher-01',
      roles: ['HOMEROOM_TEACHER', 'SUBJECT_TEACHER'], primaryRole: 'HOMEROOM_TEACHER',
    });
    expect(l.findStaffByEmail).toHaveBeenCalledWith('teacher.a@utd.ac.th');
    expect(l.findStudentsByEmail).not.toHaveBeenCalled();
  });

  it('denies a staff member whose roles are empty / missing / malformed — no SUBJECT_TEACHER default', async () => {
    for (const roles of [[], undefined, null, 'SUPER_ADMIN', ['', '  ', 42]]) {
      const l = makeLookups({ staff: { 'b@utd.ac.th': [{ id: 'teacher-02', roles }] } });
      expect(await resolveAccess(verified('b@utd.ac.th'), l)).toEqual({ allowed: false, reason: 'STAFF_NO_ROLES' });
      // staff ที่ไม่มี roles ต้องไม่ไหลไปเป็นนักเรียน
      expect(l.findStudentsByEmail).not.toHaveBeenCalled();
    }
  });

  it('ignores a legacy alias doc keyed by the email itself (staff/{email})', async () => {
    const l = makeLookups({ staff: { 'c@utd.ac.th': [
      { id: 'c@utd.ac.th', roles: ['SUPER_ADMIN'] },
      { id: 'teacher-03', roles: ['SUBJECT_TEACHER'] },
    ] } });
    expect(await resolveAccess(verified('c@utd.ac.th'), l)).toMatchObject({ allowed: true, staffId: 'teacher-03', roles: ['SUBJECT_TEACHER'] });
  });

  it('denies when two real staff docs share the email (does not guess which roles apply)', async () => {
    const l = makeLookups({ staff: { 'd@utd.ac.th': [
      { id: 'teacher-04', roles: ['SUBJECT_TEACHER'] },
      { id: 'teacher-99', roles: ['SUPER_ADMIN'] },
    ] } });
    expect(await resolveAccess(verified('d@utd.ac.th'), l)).toEqual({ allowed: false, reason: 'AMBIGUOUS_RECORD' });
  });
});

describe('resolveAccess — students', () => {
  it('grants STUDENT when students has a doc with that email field', async () => {
    const l = makeLookups({ studentsByEmail: { 'yossakorn@utd.ac.th': [{ id: '38501', studentUid: 'uid-old' }] } });
    expect(await resolveAccess(verified('yossakorn@utd.ac.th'), l)).toEqual({
      allowed: true, kind: 'student', studentId: '38501', roles: ['STUDENT'], primaryRole: 'STUDENT', studentUid: 'uid-old',
    });
    expect(l.getStudentById).not.toHaveBeenCalled();
  });

  it('falls back to the it{studentId}@utd.ac.th pattern when no student has the email field', async () => {
    const l = makeLookups({ studentsById: { '38502': { id: '38502' } } });
    expect(await resolveAccess(verified('IT38502@utd.ac.th'), l)).toEqual({
      allowed: true, kind: 'student', studentId: '38502', roles: ['STUDENT'], primaryRole: 'STUDENT', studentUid: null,
    });
    expect(l.findStudentsByEmail).toHaveBeenCalledWith('it38502@utd.ac.th');
    expect(l.getStudentById).toHaveBeenCalledWith('38502');
  });

  it('denies a pattern-shaped email whose student doc does not exist', async () => {
    const l = makeLookups();
    expect(await resolveAccess(verified('it99999@utd.ac.th'), l)).toEqual({ allowed: false, reason: 'NOT_REGISTERED' });
  });

  it('denies when two students share the email field', async () => {
    const l = makeLookups({ studentsByEmail: { 'e@utd.ac.th': [{ id: '1' }, { id: '2' }] } });
    expect(await resolveAccess(verified('e@utd.ac.th'), l)).toEqual({ allowed: false, reason: 'AMBIGUOUS_RECORD' });
  });
});

describe('resolveAccess — not registered', () => {
  it('denies a verified @utd.ac.th account found in neither staff nor students', async () => {
    const l = makeLookups();
    expect(await resolveAccess(verified('nobody@utd.ac.th'), l)).toEqual({ allowed: false, reason: 'NOT_REGISTERED' });
    expect(l.getStudentById).not.toHaveBeenCalled(); // ไม่ตรงรูปแบบ it{id} — ไม่ต้องเดา id
  });

  it('every deny reason has a Thai message telling the user to contact the administrator', () => {
    for (const msg of Object.values(DENY_MESSAGES)) expect(msg).toContain('ติดต่อผู้ดูแลระบบ');
  });
});

describe('studentIdFromEmail', () => {
  it('parses the configured template only', () => {
    expect(STUDENT_EMAIL_TEMPLATE).toBe('it{studentId}@utd.ac.th');
    expect(studentIdFromEmail('it38501@utd.ac.th')).toBe('38501');
    expect(studentIdFromEmail('IT38501@UTD.AC.TH')).toBe('38501');
    expect(studentIdFromEmail('it@utd.ac.th')).toBeNull();
    expect(studentIdFromEmail('itabc@utd.ac.th')).toBeNull();
    expect(studentIdFromEmail('xit38501@utd.ac.th')).toBeNull();
    expect(studentIdFromEmail('it38501@utdxac.th')).toBeNull(); // จุดใน template ต้องไม่เป็น regex wildcard
    expect(studentIdFromEmail('s38501@school.org', 's{studentId}@school.org')).toBe('38501');
  });
});

describe('blockingUserFromEvent (fail closed on incomplete blocking events)', () => {
  it('returns null when event.data is missing or has no uid', () => {
    expect(blockingUserFromEvent(undefined)).toBeNull();
    expect(blockingUserFromEvent(null)).toBeNull();
    expect(blockingUserFromEvent({})).toBeNull();
    expect(blockingUserFromEvent({ uid: '', email: 'a@utd.ac.th', emailVerified: true })).toBeNull();
    expect(blockingUserFromEvent({ uid: 42 as unknown as string, email: 'a@utd.ac.th', emailVerified: true })).toBeNull();
  });

  it('passes uid/email through and treats anything but emailVerified === true as unverified', () => {
    expect(blockingUserFromEvent({ uid: 'u1', email: 'a@utd.ac.th', emailVerified: true }))
      .toEqual({ uid: 'u1', email: 'a@utd.ac.th', emailVerified: true });
    expect(blockingUserFromEvent({ uid: 'u1', email: undefined, emailVerified: 'true' }))
      .toEqual({ uid: 'u1', email: null, emailVerified: false });
  });

  it('has a Thai deny message', () => {
    expect(DENY_MESSAGES.INCOMPLETE_EVENT).toContain('ติดต่อผู้ดูแลระบบ');
  });
});

describe('resolveAccess — deactivated staff (setStaffActive)', () => {
  it("denies staff whose status is 'INACTIVE' with STAFF_INACTIVE (checked before roles)", async () => {
    const l = makeLookups({ staff: { 'gone@utd.ac.th': [{ id: 'teacher-30', roles: ['SUPER_ADMIN'], status: 'INACTIVE' }] } });
    expect(await resolveAccess(verified('gone@utd.ac.th'), l)).toEqual({ allowed: false, reason: 'STAFF_INACTIVE' });
    const noRoles = makeLookups({ staff: { 'gone2@utd.ac.th': [{ id: 'teacher-31', roles: [], status: 'INACTIVE' }] } });
    expect(await resolveAccess(verified('gone2@utd.ac.th'), noRoles)).toEqual({ allowed: false, reason: 'STAFF_INACTIVE' });
    // ถูกปิดแล้วต้องไม่ไหลไปหานักเรียน
    expect(l.findStudentsByEmail).not.toHaveBeenCalled();
  });

  it('existing staff without a status field (data before this feature) are ACTIVE', async () => {
    const l = makeLookups({ staff: { 'old@utd.ac.th': [{ id: 'teacher-32', roles: ['SUBJECT_TEACHER'] }] } });
    expect(await resolveAccess(verified('old@utd.ac.th'), l)).toMatchObject({ allowed: true, staffId: 'teacher-32' });
    for (const status of ['ACTIVE', null, '', 'inactive']) {
      const s = makeLookups({ staff: { 'x@utd.ac.th': [{ id: 'teacher-33', roles: ['SUBJECT_TEACHER'], status }] } });
      expect(await resolveAccess(verified('x@utd.ac.th'), s), String(status)).toMatchObject({ allowed: true });
    }
  });

  it('has a Thai deny message', () => {
    expect(DENY_MESSAGES.STAFF_INACTIVE).toContain('ปิดการใช้งาน');
    expect(DENY_MESSAGES.STAFF_INACTIVE).toContain('ติดต่อผู้ดูแลระบบ');
  });
});
