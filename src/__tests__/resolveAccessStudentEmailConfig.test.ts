import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  resolveAccess,
  AccessLookups,
  StaffRecord,
  StudentRecord,
  DENY_MESSAGES,
  STUDENT_EMAIL_FORMAT_TIMEOUT_MS,
} from '../../functions/src/access';

/**
 * resolveAccess กับ school_settings/studentEmailFormat — {prefix}{studentId}@{domain}
 * path ของการ login: อ่าน config ไม่ได้ / ช้า / ผิดรูปแบบ ต้องใช้ค่าเริ่มต้นเดิม (it / utd.ac.th) และห้าม throw
 */
type FormatSource = () => Promise<unknown>;

function makeLookups(opts: {
  format?: FormatSource | 'not-implemented';
  staff?: Record<string, StaffRecord[]>;
  studentsByEmail?: Record<string, StudentRecord[]>;
  studentsById?: Record<string, StudentRecord>;
} = {}) {
  const getStudentEmailFormat = vi.fn(typeof opts.format === 'function' ? opts.format : async () => null);
  const lookups = {
    findStaffByEmail: vi.fn(async (email: string) => opts.staff?.[email] ?? []),
    findStudentsByEmail: vi.fn(async (email: string) => opts.studentsByEmail?.[email] ?? []),
    getStudentById: vi.fn(async (id: string) => opts.studentsById?.[id] ?? null),
    ...(opts.format === 'not-implemented' ? {} : { getStudentEmailFormat }),
  } satisfies AccessLookups;
  return { lookups, getStudentEmailFormat };
}

const verified = (email: string) => ({ email, emailVerified: true });
const student = (id: string): StudentRecord => ({ id });

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('config doc exists', () => {
  const custom = async () => ({ prefix: 's', domain: 'utd.ac.th', updatedBy: 'someone' });

  it('matches a student by the configured prefix', async () => {
    const { lookups } = makeLookups({ format: custom, studentsById: { '38501': student('38501') } });
    expect(await resolveAccess(verified('S38501@utd.ac.th'), lookups)).toMatchObject({ allowed: true, kind: 'student', studentId: '38501' });
    expect(lookups.getStudentById).toHaveBeenCalledWith('38501');
  });

  it('no longer matches the old prefix once the config changed (the config is really read)', async () => {
    const { lookups } = makeLookups({ format: custom, studentsById: { '38501': student('38501') } });
    expect(await resolveAccess(verified('it38501@utd.ac.th'), lookups)).toEqual({ allowed: false, reason: 'NOT_REGISTERED' });
    expect(lookups.getStudentById).not.toHaveBeenCalled();
  });

  it('accepts a configured student domain other than utd.ac.th — student path only', async () => {
    const { lookups } = makeLookups({
      format: async () => ({ prefix: 's', domain: 'student.utd.ac.th' }),
      studentsById: { '38501': student('38501') },
      staff: { 's38501@student.utd.ac.th': [{ id: 'teacher-1', roles: ['SUPER_ADMIN'] }] }, // ต้องไม่ถูกใช้ — บุคลากรต้อง @utd.ac.th
    });
    expect(await resolveAccess(verified('s38501@student.utd.ac.th'), lookups)).toMatchObject({ allowed: true, kind: 'student', studentId: '38501' });
    expect(lookups.findStaffByEmail).not.toHaveBeenCalled();
  });

  it('a student-domain email registered through the students.email field logs in without any pattern', async () => {
    const { lookups } = makeLookups({
      format: async () => ({ prefix: 's', domain: 'student.utd.ac.th' }),
      studentsByEmail: { 'custom.name@student.utd.ac.th': [student('40001')] },
    });
    expect(await resolveAccess(verified('custom.name@student.utd.ac.th'), lookups)).toMatchObject({ allowed: true, studentId: '40001' });
    expect(lookups.getStudentById).not.toHaveBeenCalled();
  });

  it('still rejects domains that are neither utd.ac.th nor the configured student domain', async () => {
    const { lookups } = makeLookups({ format: async () => ({ prefix: 's', domain: 'student.utd.ac.th' }) });
    for (const email of ['s1@gmail.com', 's1@evilstudent.utd.ac.th', 's1@student.utd.ac.th.evil.com', 'a@sub.student.utd.ac.th']) {
      expect(await resolveAccess(verified(email), lookups), email).toEqual({ allowed: false, reason: 'DOMAIN_NOT_ALLOWED' });
    }
    expect(DENY_MESSAGES.DOMAIN_NOT_ALLOWED).toContain('ติดต่อผู้ดูแลระบบ');
  });

  it('staff at @utd.ac.th are unaffected by the student config (and the config is not even read for them)', async () => {
    const { lookups, getStudentEmailFormat } = makeLookups({
      format: custom,
      staff: { 't@utd.ac.th': [{ id: 'teacher-2', roles: ['SUBJECT_TEACHER'] }] },
    });
    expect(await resolveAccess(verified('t@utd.ac.th'), lookups)).toMatchObject({ allowed: true, kind: 'staff', staffId: 'teacher-2' });
    expect(getStudentEmailFormat).not.toHaveBeenCalled();
  });

  it('an empty prefix is honoured', async () => {
    const { lookups } = makeLookups({ format: async () => ({ prefix: '', domain: 'utd.ac.th' }), studentsById: { '38501': student('38501') } });
    expect(await resolveAccess(verified('38501@utd.ac.th'), lookups)).toMatchObject({ allowed: true, studentId: '38501' });
  });
});

describe('config doc missing → original default (it / utd.ac.th)', () => {
  it('null (no doc), {} and an interface that does not implement the lookup all behave like before', async () => {
    for (const format of [async () => null, async () => ({}), 'not-implemented' as const]) {
      const { lookups } = makeLookups({ format, studentsById: { '38501': student('38501') } });
      expect(await resolveAccess(verified('it38501@utd.ac.th'), lookups)).toMatchObject({ allowed: true, studentId: '38501' });
      expect(await resolveAccess(verified('s38501@utd.ac.th'), lookups)).toEqual({ allowed: false, reason: 'NOT_REGISTERED' });
      expect(await resolveAccess(verified('it38501@student.utd.ac.th'), lookups)).toEqual({ allowed: false, reason: 'DOMAIN_NOT_ALLOWED' });
    }
  });
});

describe('config unreadable → default, never throws (login path)', () => {
  it('a rejected read falls back to the default format and logs a warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { lookups } = makeLookups({ format: async () => { throw new Error('PERMISSION_DENIED'); }, studentsById: { '38501': student('38501') } });
    await expect(resolveAccess(verified('it38501@utd.ac.th'), lookups)).resolves.toMatchObject({ allowed: true, studentId: '38501' });
    // โดเมนอื่น + อ่านพัง → ค่าเริ่มต้น = utd.ac.th เท่านั้น → ปฏิเสธ (ไม่ใช่ throw)
    await expect(resolveAccess(verified('it38501@student.utd.ac.th'), lookups)).resolves.toEqual({ allowed: false, reason: 'DOMAIN_NOT_ALLOWED' });
    expect(warn).toHaveBeenCalled();
  });

  it('a synchronous throw is handled the same way', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { lookups } = makeLookups({ format: (() => { throw new Error('boom'); }) as unknown as FormatSource, studentsById: { '38501': student('38501') } });
    await expect(resolveAccess(verified('it38501@utd.ac.th'), lookups)).resolves.toMatchObject({ allowed: true });
  });

  it('a read that never answers is abandoned after the timeout (blocking functions must answer within 7s)', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { lookups } = makeLookups({ format: () => new Promise(() => {}), studentsById: { '38501': student('38501') } });
    const pending = resolveAccess(verified('it38501@utd.ac.th'), lookups);
    await vi.advanceTimersByTimeAsync(STUDENT_EMAIL_FORMAT_TIMEOUT_MS + 10);
    await expect(pending).resolves.toMatchObject({ allowed: true, studentId: '38501' });
    expect(STUDENT_EMAIL_FORMAT_TIMEOUT_MS).toBeLessThan(7000);
  });

  it('malformed stored values fall back per field instead of breaking matching', async () => {
    const { lookups } = makeLookups({
      format: async () => ({ prefix: 'Bad Prefix!', domain: '@nope' }), // ทั้งคู่ผิด → ค่าเริ่มต้นทั้งคู่
      studentsById: { '38501': student('38501') },
    });
    expect(await resolveAccess(verified('it38501@utd.ac.th'), lookups)).toMatchObject({ allowed: true, studentId: '38501' });
    const half = makeLookups({ format: async () => ({ prefix: 's', domain: 'x' }), studentsById: { '38501': student('38501') } });
    expect(await resolveAccess(verified('s38501@utd.ac.th'), half.lookups)).toMatchObject({ allowed: true }); // prefix ใช้ได้ domain กลับเป็น utd.ac.th
  });
});
