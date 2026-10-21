import { describe, it, expect } from 'vitest';
import { clubEntries, gradeLockEntries, lateAttendanceEntries, topCountdowns, TOP_COUNTDOWNS, type CountdownEntry } from '../lib/countdownRegistry';
import { readSource } from './helpers/readSource';

const NOW = Date.UTC(2026, 9, 21, 8, 0, 0); // 15:00 ไทย
const H = 3_600_000;
const entry = (id: string, targetMs: number): CountdownEntry => ({ id, source: 'GRADE_LOCK', title: id, label: 'x', targetMs });

describe('topCountdowns', () => {
  it('เรียงใกล้สุดก่อน เอาแค่ 3 อันดับ ตัดที่เลยเวลา และตัด id ซ้ำ', () => {
    const out = topCountdowns([entry('d', NOW + 4 * H), entry('a', NOW + 1 * H), entry('old', NOW - H), entry('b', NOW + 2 * H), entry('a', NOW + 9 * H), entry('c', NOW + 3 * H)], NOW);
    expect(out.map((e) => e.id)).toEqual(['a', 'b', 'c']);
    expect(out).toHaveLength(TOP_COUNTDOWNS);
  });
  it('ว่าง = ว่าง (ไม่แต่งข้อมูล)', () => {
    expect(topCountdowns([], NOW)).toEqual([]);
  });
});

describe('แหล่งข้อมูล', () => {
  it('ล็อกระบบ: เปิดอยู่และมีเวลาล็อกในอนาคตเท่านั้น', () => {
    const locks = [
      { id: 'l1', title: 'กรอกคะแนน', isOpen: true, endDate: '2026-10-22', endTime: '23:59' },
      { id: 'l2', title: 'ปิดอยู่', isOpen: false, endDate: '2026-10-22' },
      { id: 'l3', title: 'หมดแล้ว', isOpen: true, endDate: '2026-10-01' },
    ];
    const out = gradeLockEntries(locks, NOW);
    expect(out.map((e) => e.title)).toEqual(['กรอกคะแนน']);
    expect(out[0].label).toBe('ล็อกระบบใน');
  });

  it('ชุมนุม: เปิดรับอยู่และมีเวลาปิดเท่านั้น', () => {
    const clubs = [
      { id: 'c1', name: 'คอมพิวเตอร์', enrollmentStatus: 'OPEN' as const, enrollmentClosesAt: NOW + 5 * H },
      { id: 'c2', name: 'ไม่มีเวลาปิด', enrollmentStatus: 'OPEN' as const },
      { id: 'c3', name: 'ปิดแล้ว', enrollmentStatus: 'CLOSED' as const, enrollmentClosesAt: NOW + 5 * H },
      { id: 'c4', name: 'ยังไม่เปิด', enrollmentStatus: 'OPEN' as const, enrollmentOpensAt: NOW + H, enrollmentClosesAt: NOW + 5 * H },
    ];
    expect(clubEntries(clubs, NOW).map((e) => e.id)).toEqual(['club:c1']);
  });

  it('เช็คชื่อย้อนหลัง: นับเฉพาะที่อนุมัติแล้วและยังใช้สิทธิ์ได้ (รวมเวลาที่ขยาย)', () => {
    const deadline = NOW + 9 * H; // 24:00 ไทย
    const step = { decision: 'APPROVE' as const, role: 'ACADEMIC_HEAD' as const, byUid: 'u', byStaffId: 's', byName: 'n', at: NOW, note: '', reviewUntil: NOW + H };
    const approved = { id: 'r1', status: 'APPROVED', deadlineAt: deadline, headStep: step, requesterLevel: 'TEACHER' as const };
    const extended = { ...approved, id: 'r2', extendedUntil: deadline + 5 * H };
    const pending = { id: 'r3', status: 'PENDING', deadlineAt: deadline, requesterLevel: 'TEACHER' as const };
    const expired = { id: 'r4', status: 'PENDING', deadlineAt: NOW - H, requesterLevel: 'TEACHER' as const };
    const out = lateAttendanceEntries([approved, extended, pending, expired] as any, NOW);
    expect(out.map((e) => [e.id, e.targetMs])).toEqual([['late:r1', deadline], ['late:r2', deadline + 5 * H]]);
  });
});

describe('การต่อสายใน UI (guard)', () => {
  it('App แสดง AppCountdownStrip เฉพาะเมื่อมี navbar (ล็อกอินแล้ว)', () => {
    expect(readSource('src/App.tsx')).toContain('{showNavbar && <AppCountdownStrip />}');
  });
  it('hook ฟังชุมนุมเฉพาะนักเรียน และคำขอเฉพาะของตัวเอง (teacherId = uid)', () => {
    const h = readSource('src/hooks/useAppCountdowns.ts');
    expect(h).toContain("{ teacherId: user.uid }");
    expect(h).toContain('if (!isStudent)');
  });
});
