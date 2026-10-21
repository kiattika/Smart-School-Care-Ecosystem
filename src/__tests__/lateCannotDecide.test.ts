import { describe, it, expect } from 'vitest';
import { cannotDecideReason, actorKindsFor, reviewUntilFor, type LateFlowRequest, type LateStep } from '../lib/lateAttendanceFlow';
import { readSource } from './helpers/readSource';

const bkk = (iso: string) => Date.parse(`${iso}+07:00`);
const DEADLINE = bkk('2026-10-21T00:00:00') + 86_400_000;
const NOW = bkk('2026-10-21T11:00:00');
const step = (role: LateStep['role'], decision: LateStep['decision'], staffId: string, at: string): LateStep => ({
  decision, role, byUid: `u-${staffId}`, byStaffId: staffId, byName: staffId, at: bkk(at), note: '', reviewUntil: reviewUntilFor(bkk(at)),
});
const req = (over: Partial<LateFlowRequest> = {}): LateFlowRequest => ({ requesterLevel: 'TEACHER', requesterStaffId: 'T', deadlineAt: DEADLINE, status: 'PENDING', ...over });
const as = (staffId: string, ...roles: string[]) => ({ staffId, roles });

describe('เหตุผลที่ตัดสินคำขอเช็คชื่อย้อนหลังไม่ได้', () => {
  it('ตัดสินได้ = ไม่มีข้อความ', () => {
    expect(cannotDecideReason(req(), as('H', 'ACADEMIC_HEAD'), NOW)).toBeNull();
    expect(cannotDecideReason(req(), as('D', 'DEPUTY_DIRECTOR_ACADEMIC'), NOW)).toBeNull();
  });

  it('คำขอของตัวเอง / ไม่มี staffId / ไม่มีบทบาทอนุมัติ', () => {
    expect(cannotDecideReason(req(), as('T', 'ACADEMIC_HEAD'), NOW)).toContain('คำขอของท่านเอง');
    expect(cannotDecideReason(req(), as('', 'ACADEMIC_HEAD'), NOW)).toContain('ไม่ได้เชื่อมกับทะเบียนบุคลากร');
    expect(cannotDecideReason(req(), as('X', 'SUBJECT_TEACHER'), NOW)).toContain('ไม่มีสิทธิ์');
  });

  it('เลยกำหนด / ไม่มี deadline (รุ่นเก่า)', () => {
    expect(cannotDecideReason(req(), as('H', 'ACADEMIC_HEAD'), DEADLINE + 1000)).toContain('เลยกำหนด');
    expect(cannotDecideReason(req({ deadlineAt: null }), as('H', 'ACADEMIC_HEAD'), NOW)).toContain('ยื่นคำขอใหม่');
  });

  it('หัวหน้า: ตัดสินแล้ว / คำขอของหัวหน้าหรือรอง ต้องรอง/ผอ.ตัดสิน', () => {
    const decided = req({ headStep: step('ACADEMIC_HEAD', 'APPROVE', 'H', '2026-10-21T10:00:00') });
    expect(cannotDecideReason(decided, as('H', 'ACADEMIC_HEAD'), NOW)).toContain('ตัดสินขั้นหัวหน้าไปแล้ว');
    expect(cannotDecideReason(decided, as('H2', 'ACADEMIC_HEAD'), NOW)).toContain('หัวหน้าตัดสินแล้ว');
    expect(cannotDecideReason(req({ requesterLevel: 'HEAD' }), as('H2', 'ACADEMIC_HEAD'), NOW)).toContain('คำขอของหัวหน้า/รองกลุ่มงาน');
  });

  it('รอง: ทำสองขั้นไม่ได้ / พ้นเวลาทบทวน / มีรองตัดสินแล้ว / คำขอของรอง', () => {
    const asDeputyAlso = req({ headStep: step('ACADEMIC_HEAD', 'APPROVE', 'X', '2026-10-21T10:00:00') });
    expect(cannotDecideReason(asDeputyAlso, as('X', 'ACADEMIC_HEAD', 'DEPUTY_DIRECTOR_ACADEMIC'), NOW)).toContain('คนเดียวทำสองขั้นไม่ได้');
    const lateReview = req({ headStep: step('ACADEMIC_HEAD', 'APPROVE', 'H', '2026-10-21T10:00:00') });
    expect(cannotDecideReason(lateReview, as('D', 'DEPUTY_DIRECTOR_ACADEMIC'), bkk('2026-10-21T19:00:00'))).toContain('พ้นเวลาทบทวน');
    const done = req({ deputyStep: step('DEPUTY_DIRECTOR_ACADEMIC', 'REJECT', 'D', '2026-10-21T10:30:00') });
    expect(cannotDecideReason(done, as('D2', 'DEPUTY_DIRECTOR_ACADEMIC'), NOW)).toContain('ผลสุดท้าย');
    expect(cannotDecideReason(req({ requesterLevel: 'DEPUTY', requesterStaffId: 'D' }), as('D2', 'DEPUTY_DIRECTOR_ACADEMIC'), NOW)).toContain('ผู้อำนวยการเป็นผู้ตัดสิน');
  });

  it('สอดคล้องกับ actorKindsFor: มีข้อความก็ต่อเมื่อตัดสินไม่ได้', () => {
    const cases: [LateFlowRequest, ReturnType<typeof as>][] = [
      [req(), as('H', 'ACADEMIC_HEAD')], [req(), as('T', 'ACADEMIC_HEAD')], [req({ requesterLevel: 'HEAD' }), as('H2', 'ACADEMIC_HEAD')],
      [req({ requesterLevel: 'DEPUTY' }), as('D', 'DEPUTY_DIRECTOR_ACADEMIC')], [req({ requesterLevel: 'DEPUTY' }), as('P', 'DIRECTOR')],
    ];
    for (const [r, a] of cases) {
      expect(actorKindsFor(r, a, NOW).length === 0).toBe(cannotDecideReason(r, a, NOW) !== null);
    }
  });

  it('UI แสดงเหตุผลเฉพาะรายการที่รอดำเนินการและไม่ใช่โหมดดูอย่างเดียว', () => {
    const ui = readSource('src/components/LateAttendanceApprovalList.tsx');
    expect(ui).toContain('cannotDecideReason(req, actor, now)');
    expect(ui).toMatch(/!readOnly && kinds\.length === 0 && \(res\.state === 'AWAITING' \|\| res\.deputyReviewOpen\)/);
    expect(ui).toContain('late-cannot-decide');
  });
});
