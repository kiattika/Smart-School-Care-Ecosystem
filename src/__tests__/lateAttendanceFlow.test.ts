import { describe, it, expect } from 'vitest';
import {
  resolveLateRequest, actorKindsFor, mayExtend, reviewUntilFor, nextBangkokMidnight, deadlineForDate, requesterLevelOf, storedStatusFor, toMs,
  type LateFlowRequest, type LateStep,
} from '../lib/lateAttendanceFlow';
import { readSource } from './helpers/readSource';

// ทุกเวลาเป็นเวลาไทย (UTC+7) → เขียนเป็น UTC ลบ 7 ชม.
const bkk = (iso: string) => Date.parse(`${iso}+07:00`);
const DEADLINE = bkk('2026-10-21T24:00:00'.replace('T24:00:00', 'T00:00:00')) + 86_400_000; // 24:00 ของ 21 ต.ค.

const step = (role: LateStep['role'], decision: LateStep['decision'], staffId: string, at: string, extra: Partial<LateStep> = {}): LateStep => ({
  decision, role, byUid: `u-${staffId}`, byStaffId: staffId, byName: staffId, at: bkk(at), note: decision === 'APPROVE' ? '' : 'หมายเหตุ', ...extra,
});
const head = (decision: LateStep['decision'], at = '2026-10-21T10:00:00') =>
  step('ACADEMIC_HEAD', decision, 'H', at, { reviewUntil: reviewUntilFor(bkk(at)) });
const dep = (decision: LateStep['decision'], at = '2026-10-21T15:00:00') => step('DEPUTY_DIRECTOR_ACADEMIC', decision, 'D', at);
const base = (over: Partial<LateFlowRequest> = {}): LateFlowRequest => ({ requesterLevel: 'TEACHER', requesterStaffId: 'T', deadlineAt: DEADLINE, status: 'PENDING', ...over });

describe('เวลา: 24:00 ไทย และ 18:00 ไทย', () => {
  it('deadlineForDate / nextBangkokMidnight = 24:00 ไทย (17:00 UTC)', () => {
    expect(deadlineForDate('2026-10-21')).toBe(DEADLINE);
    expect(nextBangkokMidnight(bkk('2026-10-21T09:00:00'))).toBe(DEADLINE);
    expect(nextBangkokMidnight(bkk('2026-10-21T23:59:59'))).toBe(DEADLINE);
    expect(nextBangkokMidnight(bkk('2026-10-22T00:00:01'))).toBe(DEADLINE + 86_400_000);
    expect(deadlineForDate('x')).toBeNull();
  });
  it('reviewUntil: ก่อน 18:00 = 18:00 วันเดียวกัน, หลัง 18:00 = 18:00 วันถัดไป', () => {
    expect(reviewUntilFor(bkk('2026-10-21T10:00:00'))).toBe(bkk('2026-10-21T18:00:00'));
    expect(reviewUntilFor(bkk('2026-10-21T17:59:59'))).toBe(bkk('2026-10-21T18:00:00'));
    expect(reviewUntilFor(bkk('2026-10-21T18:00:00'))).toBe(bkk('2026-10-22T18:00:00'));
    expect(reviewUntilFor(bkk('2026-10-21T23:00:00'))).toBe(bkk('2026-10-22T18:00:00'));
  });
  it('toMs รองรับ Timestamp/ISO/Date/ms/null', () => {
    expect(toMs({ toMillis: () => 5 })).toBe(5);
    expect(toMs({ seconds: 2, nanoseconds: 5_000_000 })).toBe(2005);
    expect(toMs('2026-10-21T00:00:00Z')).toBe(Date.parse('2026-10-21T00:00:00Z'));
    expect(toMs(null)).toBeNull();
    expect(toMs('ไม่ใช่วันที่')).toBeNull();
  });
});

describe('resolveLateRequest: ผลของสองผู้อนุมัติ', () => {
  const t10 = bkk('2026-10-21T10:30:00');
  it('ยังไม่มีใครตัดสิน: รอพิจารณา → เลย 24:00 หมดอายุ', () => {
    expect(resolveLateRequest(base(), t10).state).toBe('AWAITING');
    expect(resolveLateRequest(base(), t10).teacherMayProceed).toBe(false);
    expect(resolveLateRequest(base(), DEADLINE).state).toBe('EXPIRED');
  });
  it('หัวหน้าอนุมัติ: ครูดำเนินการได้ทันที และรองยังทบทวนได้ถึง 18:00', () => {
    const r = base({ headStep: head('APPROVE') });
    const at = bkk('2026-10-21T11:00:00');
    expect(resolveLateRequest(r, at)).toMatchObject({ outcome: 'APPROVE', state: 'OPEN', teacherMayProceed: true, deputyReviewOpen: true, deputyMayDecide: true });
    expect(resolveLateRequest(r, bkk('2026-10-21T18:00:01'))).toMatchObject({ outcome: 'APPROVE', state: 'OPEN', deputyReviewOpen: false, deputyMayDecide: false });
  });
  it('หัวหน้าอนุมัติ รองไม่ตัดสินภายใน 18:00 → ผลของหัวหน้ายืนตามเดิม จนครบ 24:00 แล้วเลยกำหนด', () => {
    const r = base({ headStep: head('APPROVE') });
    expect(resolveLateRequest(r, bkk('2026-10-21T23:59:00')).teacherMayProceed).toBe(true);
    expect(resolveLateRequest(r, DEADLINE + 1).state).toBe('OVERDUE');
  });
  it('รองไม่อนุมัติหลังหัวหน้าอนุมัติ: ลบล้างทั้งหมด + ธงเหลือง ครูทำต่อไม่ได้', () => {
    const r = base({ headStep: head('APPROVE'), deputyStep: dep('REJECT') });
    expect(resolveLateRequest(r, bkk('2026-10-21T16:00:00'))).toMatchObject({ outcome: 'REJECT', state: 'REJECTED', yellowFlag: true, teacherMayProceed: false });
  });
  it('หัวหน้าไม่อนุมัติ แล้วรองอนุมัติ (ภายใน 18:00): ผลรองชนะ ไม่มีธงเหลือง', () => {
    const r = base({ headStep: head('REJECT'), deputyStep: dep('APPROVE') });
    const res = resolveLateRequest(r, bkk('2026-10-21T16:00:00'));
    expect(res).toMatchObject({ outcome: 'APPROVE', state: 'OPEN', yellowFlag: false });
  });
  it('รองอนุมัติก่อน: หัวหน้าไม่ต้องทำอะไร (ตัดสินไม่ได้แล้ว)', () => {
    const r = base({ deputyStep: dep('APPROVE', '2026-10-21T09:00:00') });
    const res = resolveLateRequest(r, t10);
    expect(res).toMatchObject({ outcome: 'APPROVE', state: 'OPEN', headMayDecide: false });
    expect(actorKindsFor(r, { roles: ['ACADEMIC_HEAD'], staffId: 'H' }, t10)).toEqual([]);
  });
  it('อนุมัติแบบมีเงื่อนไข: ส่งข้อความเตือนให้ครู', () => {
    const r = base({ headStep: head('CONDITIONAL') });
    expect(resolveLateRequest(r, t10)).toMatchObject({ outcome: 'CONDITIONAL', state: 'OPEN', conditionNote: 'หมายเหตุ' });
    expect(resolveLateRequest(base({ headStep: head('APPROVE') }), t10).conditionNote).toBeNull();
  });
  it('รองขยายเวลา: ธงแดง และครูใช้สิทธิ์ต่อได้ข้ามเที่ยงคืน จนครบเวลาขยาย', () => {
    const until = DEADLINE + 12 * 3_600_000;
    const r = base({ deputyStep: dep('APPROVE'), extendedUntil: until });
    expect(resolveLateRequest(r, DEADLINE + 3_600_000)).toMatchObject({ state: 'OPEN', redFlag: true, teacherMayProceed: true, usableUntil: until });
    expect(resolveLateRequest(r, until + 1).state).toBe('OVERDUE');
    expect(resolveLateRequest(base({ deputyStep: dep('APPROVE') }), t10).redFlag).toBe(false);
  });
  it('คำขอรุ่นเก่าที่ไม่มี deadlineAt ถือว่าตัดสิน/ใช้สิทธิ์ไม่ได้ (ไม่ crash)', () => {
    const r = { status: 'PENDING' } as LateFlowRequest;
    expect(resolveLateRequest(r, t10).state).toBe('EXPIRED');
    expect(actorKindsFor(r, { roles: ['DEPUTY_DIRECTOR_ACADEMIC'], staffId: 'D' }, t10)).toEqual([]);
  });
  it('storedStatusFor ตรงกับ rules', () => {
    expect(storedStatusFor('APPROVE')).toBe('APPROVED');
    expect(storedStatusFor('CONDITIONAL')).toBe('APPROVED');
    expect(storedStatusFor('REJECT')).toBe('REJECTED');
  });
});

describe('actorKindsFor / mayExtend: ใครทำอะไรได้', () => {
  const t = bkk('2026-10-21T11:00:00');
  it('หัวหน้า/รอง/ผอ.สำรองตัดสินคำขอของครูได้; SUPER_ADMIN และครูทั่วไปไม่ได้', () => {
    const r = base();
    expect(actorKindsFor(r, { roles: ['ACADEMIC_HEAD'], staffId: 'H' }, t)).toEqual(['HEAD']);
    expect(actorKindsFor(r, { roles: ['DEPUTY_DIRECTOR_ACADEMIC'], staffId: 'D' }, t)).toEqual(['DEPUTY']);
    expect(actorKindsFor(r, { roles: ['DIRECTOR'], staffId: 'X' }, t)).toEqual(['DIRECTOR']);
    expect(actorKindsFor(r, { roles: ['SUPER_ADMIN'], staffId: 'S' }, t)).toEqual([]);
    expect(actorKindsFor(r, { roles: ['SUBJECT_TEACHER'], staffId: 'T2' }, t)).toEqual([]);
  });
  it('ห้ามอนุมัติตัวเอง; ไม่มี staffId ก็ทำไม่ได้', () => {
    expect(actorKindsFor(base({ requesterStaffId: 'D' }), { roles: ['DEPUTY_DIRECTOR_ACADEMIC'], staffId: 'D' }, t)).toEqual([]);
    expect(actorKindsFor(base(), { roles: ['DEPUTY_DIRECTOR_ACADEMIC'], staffId: '' }, t)).toEqual([]);
  });
  it('คำขอของหัวหน้า: ข้ามขั้นหัวหน้า (รอง/ผอ. ตัดสิน); คำขอของรอง: ผอ. เท่านั้น', () => {
    const rh = base({ requesterLevel: 'HEAD', requesterStaffId: 'H' });
    expect(actorKindsFor(rh, { roles: ['ACADEMIC_HEAD'], staffId: 'H2' }, t)).toEqual([]);
    expect(actorKindsFor(rh, { roles: ['DEPUTY_DIRECTOR_ACADEMIC'], staffId: 'D' }, t)).toEqual(['DEPUTY']);
    const rd = base({ requesterLevel: 'DEPUTY', requesterStaffId: 'D' });
    expect(actorKindsFor(rd, { roles: ['DEPUTY_DIRECTOR_ACADEMIC'], staffId: 'D2' }, t)).toEqual([]);
    expect(actorKindsFor(rd, { roles: ['DIRECTOR'], staffId: 'X' }, t)).toEqual(['DIRECTOR']);
  });
  it('คนเดียวสองขั้นไม่ได้: หัวหน้าตัดสินแล้ว คนเดียวกันที่เป็นรองด้วยตัดสินขั้นรองไม่ได้', () => {
    const r = base({ headStep: head('APPROVE') });
    expect(actorKindsFor(r, { roles: ['ACADEMIC_HEAD', 'DEPUTY_DIRECTOR_ACADEMIC'], staffId: 'H' }, t)).toEqual([]);
    expect(actorKindsFor(r, { roles: ['DEPUTY_DIRECTOR_ACADEMIC'], staffId: 'D' }, t)).toEqual(['DEPUTY']);
  });
  it('หมดหน้าต่างทบทวน/เลย 24:00 → ตัดสินไม่ได้', () => {
    const r = base({ headStep: head('APPROVE') });
    expect(actorKindsFor(r, { roles: ['DEPUTY_DIRECTOR_ACADEMIC'], staffId: 'D' }, bkk('2026-10-21T18:30:00'))).toEqual([]);
    expect(actorKindsFor(base(), { roles: ['ACADEMIC_HEAD'], staffId: 'H' }, DEADLINE)).toEqual([]);
  });
  it('ขยายเวลา: ทำได้เมื่ออนุมัติแล้ว ยังไม่ขยาย ก่อน 24:00 เฉพาะรอง/ผอ.', () => {
    const approved = base({ headStep: head('APPROVE') });
    expect(mayExtend(approved, { roles: ['DEPUTY_DIRECTOR_ACADEMIC'], staffId: 'D' }, t)).toBe(true);
    expect(mayExtend(approved, { roles: ['DIRECTOR'], staffId: 'X' }, t)).toBe(true);
    expect(mayExtend(approved, { roles: ['ACADEMIC_HEAD'], staffId: 'H2' }, t)).toBe(false);
    expect(mayExtend(base(), { roles: ['DEPUTY_DIRECTOR_ACADEMIC'], staffId: 'D' }, t)).toBe(false);
    expect(mayExtend({ ...approved, extendedUntil: DEADLINE + 1 }, { roles: ['DEPUTY_DIRECTOR_ACADEMIC'], staffId: 'D' }, t)).toBe(false);
    expect(mayExtend(approved, { roles: ['DEPUTY_DIRECTOR_ACADEMIC'], staffId: 'D' }, DEADLINE + 5)).toBe(false);
  });
  it('requesterLevelOf', () => {
    expect(requesterLevelOf(['SUBJECT_TEACHER'])).toBe('TEACHER');
    expect(requesterLevelOf(['SUBJECT_TEACHER', 'ACADEMIC_HEAD'])).toBe('HEAD');
    expect(requesterLevelOf(['ACADEMIC_HEAD', 'DEPUTY_DIRECTOR_ACADEMIC'])).toBe('DEPUTY');
  });
});

describe('guard: เวลา/สิทธิ์ใน rules ตรงกับตรรกะฝั่ง client', () => {
  const rules = readSource('firestore.rules.comments');
  const block = rules.slice(rules.indexOf('function lateStepOk'), rules.indexOf('// 22. Parent Verification Records'));
  it('rules ใช้ค่าคงที่เดียวกัน (17:00 UTC = 24:00 ไทย, 11:00 UTC = 18:00 ไทย, 24 ชม.)', () => {
    expect(block).toContain('% 86400000 == 61200000'); // 17:00 UTC
    expect(block).toContain('39600000'); // 11:00 UTC
    expect(block).toContain('<= 86400000');
  });
  it('rules ไม่ให้ SUPER_ADMIN อนุมัติ/อ่านคำขอเช็คชื่อย้อนหลัง และไม่ใช้ !hasRole', () => {
    const m = block.slice(block.indexOf('match /late_attendance_requests'));
    const end = m.indexOf('allow delete: if false;');
    expect(m.slice(0, end)).not.toContain('SUPER_ADMIN');
    expect(m.slice(0, end)).not.toMatch(/!hasRole\(/);
    expect(m).toContain('allow delete: if false;');
  });
  it('rules บังคับเวลาเซิร์ฟเวอร์ (at == request.time) ทุกขั้น', () => {
    expect(block).toContain('s.at == request.time');
    expect(block).toContain('request.resource.data.requestedAt == request.time');
    expect(block).toContain('extendedBy.at == request.time');
  });
  it('service ไม่ใช้นาฬิกา client เป็นเวลาตัดสิน (ใช้ serverTimestamp)', () => {
    const svc = readSource('src/services/firestoreService.ts');
    const a = svc.indexOf('export async function decideLateAttendanceRequestFirestore');
    const part = svc.slice(a, a + 1800);
    expect(part).toContain('at: serverTimestamp()');
    expect(part).not.toContain('new Date().toISOString()');
  });
});
