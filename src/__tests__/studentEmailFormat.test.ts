import { describe, it, expect } from 'vitest';
import * as path from 'path';
import * as fn from '../../functions/src/studentEmailFormat';
import * as client from '../lib/studentEmailFormat';
import { studentIdFromEmail, STUDENT_EMAIL_TEMPLATE } from '../../functions/src/access';
import { readSource } from './helpers/readSource';

/** school_settings/studentEmailFormat — {prefix}{studentId}@{domain} */
const DEFAULT = { prefix: 'it', domain: 'utd.ac.th' };

describe('sanitizeStudentEmailFormat (never throws, falls back per field)', () => {
  it('no doc / garbage → the original default (it / utd.ac.th)', () => {
    for (const raw of [null, undefined, 42, 'x', true, [], {}, { prefix: 5, domain: null }]) {
      expect(client.sanitizeStudentEmailFormat(raw), JSON.stringify(raw)).toEqual(DEFAULT);
    }
  });

  it('valid values are kept, trimmed and lowercased; an empty prefix is allowed', () => {
    expect(client.sanitizeStudentEmailFormat({ prefix: ' S ', domain: ' Student.UTD.ac.th ' })).toEqual({ prefix: 's', domain: 'student.utd.ac.th' });
    expect(client.sanitizeStudentEmailFormat({ prefix: '', domain: 'utd.ac.th' })).toEqual({ prefix: '', domain: 'utd.ac.th' });
  });

  it('an invalid field falls back to its own default while the valid one is kept', () => {
    expect(client.sanitizeStudentEmailFormat({ prefix: 'bad prefix!', domain: 'school.ac.th' })).toEqual({ prefix: 'it', domain: 'school.ac.th' });
    expect(client.sanitizeStudentEmailFormat({ prefix: 'stu', domain: '@school.ac.th' })).toEqual({ prefix: 'stu', domain: 'utd.ac.th' });
    expect(client.sanitizeStudentEmailFormat({ prefix: 'stu' })).toEqual({ prefix: 'stu', domain: 'utd.ac.th' });
    expect(client.sanitizeStudentEmailFormat({ prefix: 'a'.repeat(33), domain: 'nodot' })).toEqual(DEFAULT);
  });
});

describe('validateStudentEmailFormat (admin input — explicit Thai errors, no silent defaults)', () => {
  it('accepts valid input and returns the normalized value', () => {
    expect(client.validateStudentEmailFormat({ prefix: ' IT ', domain: ' UTD.ac.th ' })).toEqual({ ok: true, value: DEFAULT });
    expect(client.validateStudentEmailFormat({ prefix: '', domain: 'student.utd.ac.th' })).toEqual({ ok: true, value: { prefix: '', domain: 'student.utd.ac.th' } });
  });

  it('reports which field is wrong, in Thai', () => {
    const r1 = client.validateStudentEmailFormat({ prefix: 'it id', domain: 'utd.ac.th' });
    expect(r1.ok === false && Object.keys(r1.errors)).toEqual(['prefix']);
    const r2 = client.validateStudentEmailFormat({ prefix: 'it', domain: '@utd.ac.th' });
    expect(r2.ok === false && r2.errors.domain).toContain('ไม่ต้องใส่ @');
    const r3 = client.validateStudentEmailFormat({ prefix: 'it', domain: '' });
    expect(r3.ok === false && r3.errors.domain).toContain('กรุณากรอกโดเมน');
    const r4 = client.validateStudentEmailFormat({ prefix: '$', domain: 'x' });
    expect(r4.ok === false && Object.keys(r4.errors).sort()).toEqual(['domain', 'prefix']);
    expect(client.validateStudentEmailFormat({}).ok).toBe(false);
  });
});

describe('formatStudentEmail / template', () => {
  it('builds {prefix}{studentId}@{domain} in lowercase, defaulting to it…@utd.ac.th', () => {
    expect(client.formatStudentEmail('38501')).toBe('it38501@utd.ac.th');
    expect(client.formatStudentEmail(' 38501 ', { prefix: 's', domain: 'Student.UTD.ac.th' })).toBe('s38501@student.utd.ac.th');
    expect(client.formatStudentEmail('A12', { prefix: '', domain: 'utd.ac.th' })).toBe('a12@utd.ac.th');
  });

  it('the default template is exactly the old constant, and studentIdFromEmail still works with it', () => {
    expect(fn.studentEmailTemplate()).toBe('it{studentId}@utd.ac.th');
    expect(STUDENT_EMAIL_TEMPLATE).toBe('it{studentId}@utd.ac.th');
    expect(studentIdFromEmail('IT38501@utd.ac.th')).toBe('38501');
    expect(studentIdFromEmail('it@utd.ac.th')).toBeNull();
    expect(studentIdFromEmail('xit38501@utd.ac.th')).toBeNull();
  });

  it('studentIdFromEmail follows a configured template (and not the default one)', () => {
    const t = fn.studentEmailTemplate({ prefix: 's', domain: 'student.utd.ac.th' });
    expect(t).toBe('s{studentId}@student.utd.ac.th');
    expect(studentIdFromEmail('s38501@student.utd.ac.th', t)).toBe('38501');
    expect(studentIdFromEmail('it38501@utd.ac.th', t)).toBeNull();
    expect(studentIdFromEmail('s38501@studentXutd.ac.th', t)).toBeNull(); // จุดใน domain ไม่เป็น wildcard
    expect(studentIdFromEmail('38501@utd.ac.th', fn.studentEmailTemplate({ prefix: '', domain: 'utd.ac.th' }))).toBe('38501');
  });

  it('the label shows the pattern for the UI', () => {
    expect(client.studentEmailPatternLabel()).toBe('it{รหัสประจำตัว}@utd.ac.th');
    expect(client.studentEmailPatternLabel({ prefix: 's', domain: 'x.ac.th' })).toBe('s{รหัสประจำตัว}@x.ac.th');
  });
});

describe('client and functions copies stay identical', () => {
  const rawInputs: unknown[] = [
    null, undefined, 7, {}, { prefix: 'it', domain: 'utd.ac.th' }, { prefix: ' S ', domain: ' Student.UTD.ac.th ' },
    { prefix: '', domain: 'a.b.c.th' }, { prefix: 'bad prefix', domain: '@x' }, { prefix: 'a'.repeat(33), domain: 'utd.ac.th' },
    { prefix: 'stu', domain: 'a'.repeat(64) + '.ac.th' }, { prefix: 5, domain: [] },
  ];

  it('sanitize / validate / format give the same results', () => {
    expect(fn.DEFAULT_STUDENT_EMAIL_FORMAT).toEqual(client.DEFAULT_STUDENT_EMAIL_FORMAT);
    for (const raw of rawInputs) {
      expect(fn.sanitizeStudentEmailFormat(raw), JSON.stringify(raw)).toEqual(client.sanitizeStudentEmailFormat(raw));
      const v = (raw ?? {}) as { prefix?: unknown; domain?: unknown };
      expect(fn.validateStudentEmailFormat(v), JSON.stringify(raw)).toEqual(client.validateStudentEmailFormat(v));
    }
    for (const f of [DEFAULT, { prefix: 's', domain: 'student.utd.ac.th' }, { prefix: '', domain: 'x.ac.th' }]) {
      expect(fn.formatStudentEmail(' 123 ', f)).toBe(client.formatStudentEmail(' 123 ', f));
    }
    expect(fn.PREFIX_PATTERN.source).toBe(client.PREFIX_PATTERN.source);
    expect(fn.DOMAIN_PATTERN.source).toBe(client.DOMAIN_PATTERN.source);
  });

  it('firestore.rules uses the same prefix / domain patterns', () => {
    const rules = readSource(path.resolve(__dirname, '../../firestore.rules'));
    // pattern ในรูปแบบ string ของ rules (\\. แทน \.)
    expect(rules).toContain("d.prefix.matches('^[a-z0-9._-]{0,32}$')");
    expect(rules).toContain("d.domain.matches('^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\\\\.)+[a-z]{2,63}$')");
    expect(fn.PREFIX_PATTERN.source).toBe('^[a-z0-9._-]{0,32}$');
    expect(fn.DOMAIN_PATTERN.source).toBe('^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z]{2,63}$');
  });
});

describe('wiring: nothing hardcodes the student email pattern any more', () => {
  const root = path.resolve(__dirname, '../..');
  const src = (rel: string) => readSource(path.join(root, rel));

  it('StudentManagementPage builds the email / placeholder from the shared config', () => {
    const s = src('src/components/StudentManagementPage.tsx');
    expect(s).toContain('const { format: studentEmailFormat } = useStudentEmailFormat();');
    expect(s).toContain('formatStudentEmail(cleanId, studentEmailFormat)');
    expect(s).toContain('formatStudentEmail(formStudentId, studentEmailFormat)');
    expect(s).toContain('studentEmailPatternLabel(studentEmailFormat)');
    expect(s).not.toMatch(/`it\$\{/);
    expect(s).not.toMatch(/it\$\{[a-zA-Z]+\}@utd\.ac\.th/);
  });

  it('the login path reads the same Firestore doc, and the admin page edits it', () => {
    expect(src('functions/src/authBlocking.ts')).toContain("db.collection('school_settings').doc('studentEmailFormat')");
    expect(src('src/hooks/useStudentEmailFormat.ts')).toContain("doc(db, 'school_settings', 'studentEmailFormat')");
    expect(src('src/components/admin/StudentEmailFormatSection.tsx')).toContain("doc(db, 'school_settings', 'studentEmailFormat')");
    expect(src('src/components/SystemSettingsAndLocksPage.tsx')).toContain('<StudentEmailFormatSection />');
  });
});
