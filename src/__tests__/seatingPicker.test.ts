import { describe, it, expect } from 'vitest';
import { buildDeskGroupsForPicker } from '../lib/seatingPicker';
import type { SeatingGroup, SeatingAssignment } from '../types/seating';
import type { Student } from '../types';

/**
 * Regression: บั๊กที่ยืนยันจากการทดสอบจริง — จัดผัง "แถวโต๊ะคู่" (ROW group, 10 ที่นั่ง)
 * แล้วกด "สุ่มโต๊ะ" ได้นักเรียนมา 10 คน แทนที่จะเป็น 2 คน
 * (สาเหตุ: 1 ROW group = ทั้งแถว ไม่ถูกหั่นเป็นโต๊ะคู่ก่อนส่งให้ picker)
 */

const mkStudent = (id: string): Student =>
  ({ id, studentId: id, name: `นร ${id}`, fullName: `นักเรียน ${id}`, studentNo: Number(id.slice(-2)), room: 'ม.5/8', nickname: '', photoUrl: '', seatIndex: null, homeLocation: { address: '', coordinates: [0, 0], routeImage: '' }, attendance: { morningStatus: 'PRESENT', checkInMethod: 'MANUAL', checkInTime: null } }) as Student;

const mkRowGroup = (id: string, seatCount: number, order: number): SeatingGroup => ({
  id,
  name: `แถวที่ ${order} (โต๊ะคู่)`,
  capacity: seatCount,
  order,
  shape: 'ROW',
  seats: Array.from({ length: seatCount }, (_, i) => ({
    id: `seat_${id}_${i + 1}`,
    groupId: id,
    seatNumber: i + 1,
    status: 'ACTIVE' as const,
  })),
});

const seatAll = (groups: SeatingGroup[], students: Student[]): Record<string, SeatingAssignment> => {
  const out: Record<string, SeatingAssignment> = {};
  let si = 0;
  groups.forEach(g =>
    g.seats.forEach(seat => {
      if (si < students.length) {
        out[seat.id] = {
          id: `a_${seat.id}`,
          seatId: seat.id,
          studentId: students[si].studentId,
          layoutId: 'L',
          effectiveFrom: '2026-01-01',
        } as SeatingAssignment;
        si++;
      }
    })
  );
  return out;
};

describe('buildDeskGroupsForPicker — สุ่มโต๊ะต้องได้ทีละโต๊ะ ไม่ใช่ทั้งแถว', () => {
  it('REPRO/FIX: ผังแถวโต๊ะคู่ 4 แถว × 10 ที่นั่ง → หั่นเป็น 20 โต๊ะ โต๊ะละ ≤ 2 คน', () => {
    const groups = [mkRowGroup('group_1', 10, 1), mkRowGroup('group_2', 10, 2), mkRowGroup('group_3', 10, 3), mkRowGroup('group_4', 10, 4)];
    const students = Array.from({ length: 36 }, (_, i) => mkStudent(`38${String(i + 1).padStart(3, '0')}`));
    const assignments = seatAll(groups, students);

    const desks = buildDeskGroupsForPicker(groups, assignments, students);

    // 4 แถว × ceil(10/2) = 20 โต๊ะ
    expect(desks).toHaveLength(20);
    // ไม่มีโต๊ะไหนเกิน 2 คนเด็ดขาด
    for (const d of desks) {
      expect(d.students.length).toBeLessThanOrEqual(2);
      expect(d.seatIndices.length).toBeLessThanOrEqual(2);
    }
    // รวมนักเรียนทุกโต๊ะ = 36 (ครบ ไม่ตกหล่น ไม่ซ้ำ)
    const allIds = desks.flatMap(d => d.students.map(s => s.studentId));
    expect(allIds).toHaveLength(36);
    expect(new Set(allIds).size).toBe(36);
    // id โต๊ะไม่ซ้ำ
    expect(new Set(desks.map(d => d.id)).size).toBe(20);
  });

  it('POD group (โต๊ะแล็บ) คงทั้งกลุ่มเป็นหน่วยเดียว ไม่หั่น', () => {
    const pod: SeatingGroup = {
      id: 'group_lab_1',
      name: 'โต๊ะทดลองที่ 1',
      capacity: 6,
      order: 1,
      shape: 'POD',
      seats: Array.from({ length: 6 }, (_, i) => ({ id: `seat_lab_${i + 1}`, groupId: 'group_lab_1', seatNumber: i + 1, status: 'ACTIVE' as const })),
    };
    const students = Array.from({ length: 6 }, (_, i) => mkStudent(`s${i + 1}`));
    const assignments = seatAll([pod], students);

    const desks = buildDeskGroupsForPicker([pod], assignments, students);
    expect(desks).toHaveLength(1);
    expect(desks[0].students).toHaveLength(6);
  });

  it('โต๊ะที่ยังไม่มีคนนั่ง → students ว่าง (picker จะกรองออกเอง)', () => {
    const groups = [mkRowGroup('group_1', 10, 1)];
    const students = [mkStudent('a1'), mkStudent('a2')]; // นั่งแค่ 2 คนแรก
    const assignments = seatAll(groups, students);

    const desks = buildDeskGroupsForPicker(groups, assignments, students);
    expect(desks).toHaveLength(5);
    expect(desks[0].students).toHaveLength(2);
    expect(desks.slice(1).every(d => d.students.length === 0)).toBe(true);
  });
});
