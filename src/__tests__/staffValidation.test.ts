import { describe, it, expect, vi } from 'vitest';
import { validateNewStaff, NewStaffLookups, NewStaffInput, STAFF_ID_PATTERN } from '../../functions/src/staffValidation';
import { normalizeEmail as fnNormalizeEmail } from '../../functions/src/email';
import { normalizeEmail as clientNormalizeEmail } from '../lib/normalizeEmail';

/** createStaffMember — validation ก่อนเขียน staff/{staffId} */
const ZWSP = String.fromCharCode(0x200b);
const BOM = String.fromCharCode(0xfeff);

function lookups(opts: { existingIds?: string[]; staffByEmail?: Record<string, string[]>; studentsByEmail?: Record<string, string[]> } = {}) {
  return {
    staffExists: vi.fn(async (id: string) => (opts.existingIds ?? []).includes(id)),
    findStaffIdsByEmail: vi.fn(async (e: string) => opts.staffByEmail?.[e] ?? []),
    findStudentIdsByEmail: vi.fn(async (e: string) => opts.studentsByEmail?.[e] ?? []),
  } satisfies NewStaffLookups;
}

const good: NewStaffInput = {
  staffId: 'teacher-41', email: 'new.teacher@utd.ac.th', roles: ['SUBJECT_TEACHER'],
  prefix: 'นาง', firstName: 'สมใจ', lastName: 'ใจดี', position: 'ครู', departmentId: 'math-dept',
};

describe('validateNewStaff — accepts', () => {
  it('a valid new staff member (normalized email, trimmed text, deduped roles)', async () => {
    const r = await validateNewStaff({ ...good, email: `  New.Teacher@UTD.ac.th${ZWSP}`, firstName: ' สมใจ ', roles: ['SUBJECT_TEACHER', 'SUBJECT_TEACHER', 'HOMEROOM_TEACHER'] }, lookups());
    expect(r).toEqual({ ok: true, value: {
      staffId: 'teacher-41', email: 'new.teacher@utd.ac.th', roles: ['SUBJECT_TEACHER', 'HOMEROOM_TEACHER'],
      prefix: 'นาง', firstName: 'สมใจ', lastName: 'ใจดี', position: 'ครู', departmentId: 'math-dept',
    } });
  });

  it('optional fields may be empty', async () => {
    const r = await validateNewStaff({ staffId: 'T1', email: 'a@utd.ac.th', roles: ['SUPER_ADMIN'], firstName: 'ก', lastName: 'ข' }, lookups());
    expect(r).toMatchObject({ ok: true, value: { prefix: '', position: '', departmentId: '' } });
  });
});

describe('validateNewStaff — staffId', () => {
  it('rejects malformed ids', async () => {
    for (const staffId of ['', ' ', 'teacher/01', 'teacher.01', 'ครู01', '-teacher', 'a b', 'x'.repeat(65), 42, null]) {
      const r = await validateNewStaff({ ...good, staffId }, lookups());
      expect(r, String(staffId)).toMatchObject({ ok: false, code: 'invalid-argument' });
    }
    expect(STAFF_ID_PATTERN.test('teacher_01-A')).toBe(true);
  });

  it('rejects an id that already exists (incl. a deactivated staff doc)', async () => {
    const r = await validateNewStaff(good, lookups({ existingIds: ['teacher-41'] }));
    expect(r).toMatchObject({ ok: false, code: 'already-exists' });
  });
});

describe('validateNewStaff — email', () => {
  it('rejects empty / malformed / non-utd.ac.th emails', async () => {
    for (const email of ['', 'no-at-sign', 'a@gmail.com', 'a@school.ac.th', 'a@evilutd.ac.th', 'a@sub.utd.ac.th', 7]) {
      expect(await validateNewStaff({ ...good, email }, lookups()), String(email)).toMatchObject({ ok: false, code: 'invalid-argument' });
    }
  });

  it('rejects the student email pattern it{studentId}@utd.ac.th', async () => {
    expect(await validateNewStaff({ ...good, email: 'IT38501@utd.ac.th' }, lookups())).toMatchObject({ ok: false, code: 'invalid-argument' });
  });

  it('rejects an email already used by another staff member (active or not) — compares normalized', async () => {
    const l = lookups({ staffByEmail: { 'new.teacher@utd.ac.th': ['teacher-07'] } });
    const r = await validateNewStaff({ ...good, email: ` NEW.teacher@utd.ac.th${BOM}` }, l);
    expect(r).toMatchObject({ ok: false, code: 'already-exists' });
    expect(l.findStaffIdsByEmail).toHaveBeenCalledWith('new.teacher@utd.ac.th');
  });

  it("rejects an email that is a student's email field", async () => {
    const r = await validateNewStaff(good, lookups({ studentsByEmail: { 'new.teacher@utd.ac.th': ['38599'] } }));
    expect(r).toMatchObject({ ok: false, code: 'already-exists' });
  });
});

describe('validateNewStaff — roles and names', () => {
  it('requires at least one role, uppercase role names, and never STUDENT / PARENT', async () => {
    for (const roles of [[], undefined, 'SUBJECT_TEACHER', ['subject_teacher'], ['SUBJECT TEACHER'], ['STUDENT'], ['SUBJECT_TEACHER', 'PARENT']]) {
      expect(await validateNewStaff({ ...good, roles }, lookups()), JSON.stringify(roles)).toMatchObject({ ok: false, code: 'invalid-argument' });
    }
  });

  it('requires first and last name; caps text length', async () => {
    expect(await validateNewStaff({ ...good, firstName: '  ' }, lookups())).toMatchObject({ ok: false, code: 'invalid-argument' });
    expect(await validateNewStaff({ ...good, lastName: undefined }, lookups())).toMatchObject({ ok: false, code: 'invalid-argument' });
    expect(await validateNewStaff({ ...good, position: 'x'.repeat(121) }, lookups())).toMatchObject({ ok: false, code: 'invalid-argument' });
  });

  it('format errors are reported before any database lookup', async () => {
    const l = lookups();
    await validateNewStaff({ ...good, roles: ['STUDENT'] }, l);
    expect(l.staffExists).not.toHaveBeenCalled();
    expect(l.findStaffIdsByEmail).not.toHaveBeenCalled();
  });

  it('all error messages are Thai', async () => {
    const r = await validateNewStaff({ ...good, staffId: 'bad/id' }, lookups());
    expect(r.ok === false && /[฀-๿]/.test(r.message)).toBe(true);
  });
});

describe('functions normalizeEmail stays identical to the client copy', () => {
  it('same output for the same inputs', () => {
    for (const raw of ['  A@UTD.ac.th ', `${BOM}it38501@utd.ac.th${ZWSP}`, '', null, 42, 'already@utd.ac.th']) {
      expect(fnNormalizeEmail(raw), String(raw)).toBe(clientNormalizeEmail(raw));
    }
  });
});
