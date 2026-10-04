import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { normalizeEmail, planEmailFixes } from '../lib/normalizeEmail';
import { parseScriptArgs, resolveScriptTarget } from '../../scripts/lib/scriptTarget';
import { readSource } from './helpers/readSource';

// อักขระล่องหนสร้างจาก char code — ไม่ฝังตัวอักษรที่มองไม่เห็นลงในไฟล์เทสต์
const ZWSP = String.fromCharCode(0x200b);
const BOM = String.fromCharCode(0xfeff);
const NBSP = String.fromCharCode(0xa0);

describe('normalizeEmail', () => {
  it('trims, lowercases and strips invisible characters', () => {
    expect(normalizeEmail('  Teacher.A@UTD.ac.th ')).toBe('teacher.a@utd.ac.th');
    expect(normalizeEmail(`${BOM}it38501@utd.ac.th${ZWSP}`)).toBe('it38501@utd.ac.th');
    expect(normalizeEmail(`${NBSP}X@utd.ac.th\t\n`)).toBe('x@utd.ac.th');
    expect(normalizeEmail('already@utd.ac.th')).toBe('already@utd.ac.th');
  });

  it('returns empty string for non-strings / empty', () => {
    for (const v of [undefined, null, 42, {}, '', '   ']) expect(normalizeEmail(v)).toBe('');
  });
});

describe('planEmailFixes (scripts/normalizeEmails.ts)', () => {
  it('plans fixes only for fields that change, covering staff/teachers email and students email+parentEmail', () => {
    const { fixes } = planEmailFixes([
      { collection: 'staff', id: 'teacher-01', fields: { email: ' A@UTD.ac.th' } },
      { collection: 'staff', id: 'teacher-02', fields: { email: 'ok@utd.ac.th' } },
      { collection: 'teachers', id: 'teacher-01', fields: { email: 'A@utd.ac.th' } },
      { collection: 'students', id: '38501', fields: { email: `IT38501@utd.ac.th${ZWSP}`, parentEmail: 'Parent@Gmail.com ' } },
      { collection: 'students', id: '38502', fields: { email: '', parentEmail: 7 } },
      { collection: 'schedules', id: 's1', fields: { email: 'IGNORED@X.com' } },
    ]);
    expect(fixes).toEqual([
      { collection: 'staff', id: 'teacher-01', field: 'email', before: ' A@UTD.ac.th', after: 'a@utd.ac.th' },
      { collection: 'teachers', id: 'teacher-01', field: 'email', before: 'A@utd.ac.th', after: 'a@utd.ac.th' },
      { collection: 'students', id: '38501', field: 'email', before: `IT38501@utd.ac.th${ZWSP}`, after: 'it38501@utd.ac.th' },
      { collection: 'students', id: '38501', field: 'parentEmail', before: 'Parent@Gmail.com ', after: 'parent@gmail.com' },
    ]);
  });

  it('reports emails that collide after normalization (per collection), ignoring legacy staff/{email} alias docs and parentEmail', () => {
    const { duplicates } = planEmailFixes([
      { collection: 'staff', id: 'teacher-01', fields: { email: 'Dup@utd.ac.th' } },
      { collection: 'staff', id: 'teacher-09', fields: { email: 'dup@utd.ac.th ' } },
      { collection: 'staff', id: 'single@utd.ac.th', fields: { email: 'single@utd.ac.th' } },
      { collection: 'staff', id: 'teacher-03', fields: { email: 'single@utd.ac.th' } },
      { collection: 'teachers', id: 'teacher-01', fields: { email: 'dup@utd.ac.th' } },
      { collection: 'students', id: '1', fields: { email: 'a@utd.ac.th', parentEmail: 'p@gmail.com' } },
      { collection: 'students', id: '2', fields: { email: 'b@utd.ac.th', parentEmail: 'P@gmail.com' } },
    ]);
    expect(duplicates).toEqual([{ collection: 'staff', email: 'dup@utd.ac.th', ids: ['teacher-01', 'teacher-09'] }]);
  });
});

describe('every write of email to staff / teachers / students goes through normalizeEmail', () => {
  const src = (rel: string) => readSource(path.resolve(__dirname, '..', rel));

  it('BulkDataImportModal: TEACHER parse + staff/teachers payload', () => {
    const s = src('components/BulkDataImportModal.tsx');
    expect(s).toContain("const email = normalizeEmail(getFieldValue(normalized, ['email', 'e-mail', 'อีเมล', 'อีเมล์']));");
    expect(s).toContain('email: normalizeEmail(parsedData.email),');
    expect(s).not.toMatch(/^\s*email: parsedData\.email,/m);
  });

  it('StudentManagementPage: student email + parentEmail', () => {
    const s = src('components/StudentManagementPage.tsx');
    // fallback เมื่อไม่ได้กรอกเอง = รูปแบบที่ admin ตั้งไว้ (studentEmailFormat.test.ts) — ค่าที่กรอกยังต้องผ่าน normalizeEmail เสมอ
    expect(s).toContain('email: normalizeEmail(formEmail) || formatStudentEmail(cleanId, studentEmailFormat),');
    expect(s).toContain('parentEmail: normalizeEmail(formParentEmail),');
    expect(s).not.toMatch(/email: form(Parent)?Email\.trim\(\)/i);
  });

  it('StaffRoleManagementPage: profile save writes the normalized email back', () => {
    expect(src('components/StaffRoleManagementPage.tsx'))
      .toContain('...(normalizeEmail(editingStaff.email) ? { email: normalizeEmail(editingStaff.email) } : {}),');
  });
});

describe('maintenance script target guard (normalizeEmails / resetAuthClaims)', () => {
  const PID = 'kiattisak-project-001';

  it('parses --dry-run, --keep (repeatable, = form) and --confirm-production', () => {
    expect(parseScriptArgs(['--dry-run', '--keep', 'a@utd.ac.th', '--keep=b@utd.ac.th', '--confirm-production', PID]))
      .toEqual({ dryRun: true, keep: ['a@utd.ac.th', 'b@utd.ac.th'], confirmProduction: PID });
    expect(() => parseScriptArgs(['--keep'])).toThrow();
    expect(() => parseScriptArgs(['--keep', '--dry-run'])).toThrow();
    expect(() => parseScriptArgs(['--force'])).toThrow(/ไม่รู้จัก/);
  });

  it('targets the emulator when its env var is set', () => {
    expect(resolveScriptTarget({ FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' }, 'FIRESTORE_EMULATOR_HOST', parseScriptArgs([]), PID))
      .toEqual({ kind: 'emulator', host: '127.0.0.1:8080' });
  });

  it('refuses production unless --confirm-production matches the real project id', () => {
    expect(() => resolveScriptTarget({}, 'FIREBASE_AUTH_EMULATOR_HOST', parseScriptArgs([]), PID)).toThrow(/ปฏิเสธ/);
    expect(() => resolveScriptTarget({}, 'FIREBASE_AUTH_EMULATOR_HOST', parseScriptArgs(['--dry-run']), PID)).toThrow(/ปฏิเสธ/);
    expect(() => resolveScriptTarget({}, 'FIREBASE_AUTH_EMULATOR_HOST', parseScriptArgs(['--confirm-production', 'other-project']), PID)).toThrow();
    expect(resolveScriptTarget({}, 'FIREBASE_AUTH_EMULATOR_HOST', parseScriptArgs(['--confirm-production', PID]), PID))
      .toEqual({ kind: 'production', projectId: PID });
  });

  it('refuses an ambiguous mix of emulator env + --confirm-production', () => {
    expect(() => resolveScriptTarget({ FIREBASE_AUTH_EMULATOR_HOST: 'x:1' }, 'FIREBASE_AUTH_EMULATOR_HOST', parseScriptArgs(['--confirm-production', PID]), PID)).toThrow();
  });
});
