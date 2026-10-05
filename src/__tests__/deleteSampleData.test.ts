import { describe, it, expect } from 'vitest';
import {
  ALLOWED_COLLECTIONS, AuthPort, PROTECTED_EMAIL, chunk, collectProtectedIds, isProtectedDoc, parseDeleteArgs,
  planAuthDeletion, planFirestoreDeletion, runAuthDeletion, runFirestoreDeletion, validateCollections,
} from '../../scripts/lib/deleteSampleData';
import { CERTAIN_REAL_EMAIL } from '../../scripts/lib/sampleDataAudit';

const ZW = '​';

describe('allowlist ของ --collections', () => {
  it('ตรงกับรายชื่อที่ตกลงไว้ และตรงกับค่าคุ้มครองของ audit', () => {
    expect([...ALLOWED_COLLECTIONS]).toEqual([
      'schedules', 'staff', 'teachers', 'students', 'attendance_records', 'elective_activities_config',
      'gradebook_hidden_courses', 'parent_verification_records', 'seating_assignments', 'seating_layouts',
      'student_assessments_sdq', 'student_self_assessments',
    ]);
    expect(PROTECTED_EMAIL).toBe(CERTAIN_REAL_EMAIL);
  });
  it('ปฏิเสธ collection นอกรายชื่อ / ว่าง / พิมพ์ใหญ่ / เครื่องหมายแปลก', () => {
    expect(() => validateCollections(['staff', 'users'])).toThrow(/users/);
    expect(() => validateCollections(['Staff'])).toThrow();
    expect(() => validateCollections(['*'])).toThrow();
    expect(() => validateCollections([''])).toThrow();
    expect(() => validateCollections([])).toThrow(/อย่างน้อย/);
    expect(validateCollections(['staff', 'students'])).toEqual(['staff', 'students']);
  });
});

describe('parseDeleteArgs', () => {
  it('ต้องมี --collections', () => {
    expect(() => parseDeleteArgs([])).toThrow(/--collections/);
    expect(() => parseDeleteArgs(['--execute'])).toThrow(/--collections/);
    expect(() => parseDeleteArgs(['--collections'])).toThrow();
    expect(() => parseDeleteArgs(['--collections', '--execute'])).toThrow();
  });
  it('ค่าเริ่มต้น = dry-run (execute=false), ไม่ลบ Auth', () => {
    const a = parseDeleteArgs(['--collections', 'students']);
    expect(a.execute).toBe(false);
    expect(a.deleteAuthAccounts).toBe(false);
    expect(a.collections).toEqual(['students']);
  });
  it('รองรับ --collections=a,b และ dedupe, ส่งต่อ --confirm-production', () => {
    const a = parseDeleteArgs(['--collections=staff,staff,teachers', '--confirm-production', 'p1', '--execute']);
    expect(a.collections).toEqual(['staff', 'teachers']);
    expect(a.confirmProduction).toBe('p1');
    expect(a.execute).toBe(true);
  });
  it('--collections รายการผิดแม้แค่ตัวเดียว = ปฏิเสธทั้งคำสั่ง', () => {
    expect(() => parseDeleteArgs(['--collections', 'staff,bogus'])).toThrow(/bogus/);
    expect(() => parseDeleteArgs(['--collections', 'staff,,teachers'])).toThrow();
  });
  it('--dry-run ร่วมกับ --execute ขัดกัน; --keep / argument แปลก ถูกปฏิเสธ', () => {
    expect(() => parseDeleteArgs(['--collections', 'students', '--dry-run', '--execute'])).toThrow(/ขัดกัน/);
    expect(() => parseDeleteArgs(['--collections', 'students', '--keep', 'a@b.c'])).toThrow();
    expect(() => parseDeleteArgs(['--collections', 'students', '--force'])).toThrow();
  });
  it('--delete-auth-accounts โดยไม่มี staff/teachers = error ชัดเจน (ไม่เงียบ)', () => {
    expect(() => parseDeleteArgs(['--collections', 'students,schedules', '--delete-auth-accounts'])).toThrow(/ไม่มีบัญชี Auth ให้ลบ/);
    expect(parseDeleteArgs(['--collections', 'teachers', '--delete-auth-accounts']).deleteAuthAccounts).toBe(true);
    expect(parseDeleteArgs(['--collections', 'staff', '--delete-auth-accounts']).deleteAuthAccounts).toBe(true);
  });
});

describe('ตรรกะยกเว้น — Firestore', () => {
  const staff = [
    { id: 'teacher_kiattisak', email: 'kiattika@utd.ac.th' },
    { id: 'a1', email: `  KIATTIKA@utd.ac.th${ZW}` }, // ตัวพิมพ์ใหญ่/ช่องว่าง/อักขระล่องหน
    { id: 'kiattika@utd.ac.th', email: undefined }, // alias doc id เป็นอีเมล
    { id: 's1', email: 'sample1@utd.ac.th' },
    { id: 's2' },
  ];
  const teachers = [
    { id: 'teacher_kiattisak' }, // mirror ไม่มี email แต่ id ตรงกับ staff ที่คุ้มครอง
    { id: 't9', email: 'sample9@utd.ac.th' },
  ];

  it('ไม่ลบ doc ของ kiattika ไม่ว่าเลือก collection แบบไหน', () => {
    for (const cols of [['staff'], ['teachers'], ['staff', 'teachers']]) {
      const plan = planFirestoreDeletion(cols, { staff, teachers });
      const all = Object.values(plan.toDelete).flat();
      expect(all).not.toContain('teacher_kiattisak');
      expect(all).not.toContain('a1');
      expect(all).not.toContain('kiattika@utd.ac.th');
    }
    const p = planFirestoreDeletion(['staff', 'teachers'], { staff, teachers });
    expect(p.toDelete.staff).toEqual(['s1', 's2']);
    expect(p.toDelete.teachers).toEqual(['t9']);
    expect(p.protectedSkipped.teachers).toEqual(['teacher_kiattisak']);
  });
  it('เลือกแค่ staff → teachers ไม่อยู่ในแผนเลย', () => {
    const p = planFirestoreDeletion(['staff'], { staff, teachers });
    expect(p.toDelete.teachers).toBeUndefined();
  });
  it('collection อื่นไม่ใช้ตรรกะยกเว้นอีเมล', () => {
    expect(isProtectedDoc('students', { id: 'x', email: PROTECTED_EMAIL }, new Set())).toBe(false);
    expect(collectProtectedIds({ staff }).has('teacher_kiattisak')).toBe(true);
  });
  it('เก็บอีเมลเฉพาะ doc ที่จะลบ (ไม่รวมคุ้มครอง)', () => {
    const p = planFirestoreDeletion(['staff', 'teachers'], { staff, teachers });
    expect(p.staffEmails).toEqual(['sample1@utd.ac.th', 'sample9@utd.ac.th']);
  });
  it('runFirestoreDeletion: batch ≤ 450, ล้มแล้วนับ failed, และ abort ถ้ามี protected หลุดมาในแผน', async () => {
    expect(chunk(Array.from({ length: 901 }, (_, i) => i)).map((b) => b.length)).toEqual([450, 450, 1]);
    const ids = Array.from({ length: 1000 }, (_, i) => `d${i}`);
    const sizes: number[] = [];
    const plan = { toDelete: { students: ids }, protectedSkipped: {}, staffEmails: [], total: 1000 };
    const ok = await runFirestoreDeletion({ async deleteBatch(_c, b) { sizes.push(b.length); } }, plan, new Set());
    expect(sizes).toEqual([450, 450, 100]);
    expect(ok[0]).toMatchObject({ deleted: 1000, failed: 0 });

    let n = 0;
    const bad = await runFirestoreDeletion({ async deleteBatch() { if (++n === 2) throw new Error('boom'); } }, plan, new Set());
    expect(bad[0]).toMatchObject({ deleted: 450, failed: 550, error: 'boom' });

    const sneaky = { toDelete: { staff: ['s1', 'teacher_kiattisak'] }, protectedSkipped: {}, staffEmails: [], total: 2 };
    const calls: string[][] = [];
    await expect(runFirestoreDeletion({ async deleteBatch(_c, b) { calls.push(b); } }, sneaky, new Set(['teacher_kiattisak']))).rejects.toThrow(/ABORT/);
    expect(calls).toEqual([]);
  });
});

describe('ตรรกะยกเว้น — Firebase Auth', () => {
  const accounts: Record<string, { uid: string; email: string }> = {
    'kiattika@utd.ac.th': { uid: 'U-REAL', email: 'kiattika@utd.ac.th' },
    's1@utd.ac.th': { uid: 'U-1', email: 's1@utd.ac.th' },
    's2@utd.ac.th': { uid: 'U-2', email: 's2@utd.ac.th' },
    // อีเมลคนละตัวแต่ชี้บัญชีเดียวกับ kiattika (จำลองข้อมูลเพี้ยน) → ต้องกันด้วย UID
    'alias@utd.ac.th': { uid: 'U-REAL', email: 'alias@utd.ac.th' },
  };
  const deleted: string[] = [];
  const port = (): AuthPort => ({
    async getUserByEmail(e) { return accounts[e] ?? null; },
    async deleteUser(uid) { if (uid === 'U-2') throw new Error('nope'); deleted.push(uid); },
  });

  it('วางแผนข้ามอีเมล kiattika (แม้พิมพ์ผิดรูปแบบ) และบัญชี UID เดียวกัน', async () => {
    const plan = await planAuthDeletion(port(), [`KIATTIKA@utd.ac.th${ZW}`, 's1@utd.ac.th', 's2@utd.ac.th', 'alias@utd.ac.th', 'ghost@utd.ac.th']);
    expect(plan.toDelete.map((u) => u.uid)).toEqual(['U-1', 'U-2']);
    expect(plan.notFound).toEqual(['ghost@utd.ac.th']);
    expect(plan.skippedProtected.map((s) => s.email).sort()).toEqual(['alias@utd.ac.th', 'kiattika@utd.ac.th']);
    expect(plan.protectedUid).toBe('U-REAL');
  });
  it('runAuthDeletion: ลบทีละบัญชี รายงานสำเร็จ/ล้มเหลว', async () => {
    deleted.length = 0;
    const plan = await planAuthDeletion(port(), ['s1@utd.ac.th', 's2@utd.ac.th']);
    const r = await runAuthDeletion(port(), plan);
    expect(r.deleted.map((u) => u.uid)).toEqual(['U-1']);
    expect(r.failed).toEqual([{ uid: 'U-2', email: 's2@utd.ac.th', error: 'nope' }]);
  });
  it('runAuthDeletion: บัญชีคุ้มครองหลุดเข้าแผน (ทางอีเมลหรือ UID) = abort และไม่ลบบัญชีนั้น', async () => {
    deleted.length = 0;
    const base = { notFound: [], skippedProtected: [], protectedUid: 'U-REAL' };
    await expect(runAuthDeletion(port(), { ...base, toDelete: [{ uid: 'X', email: ' KIATTIKA@utd.ac.th' }] })).rejects.toThrow(/ABORT/);
    await expect(runAuthDeletion(port(), { ...base, toDelete: [{ uid: 'U-REAL', email: 'other@utd.ac.th' }] })).rejects.toThrow(/ABORT/);
    expect(deleted).toEqual([]);
  });
});
