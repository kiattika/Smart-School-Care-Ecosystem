import { describe, it, expect } from 'vitest';
import { remapLayoutForCopy } from '../lib/seatingCopy';
import type { SeatingAssignment, SeatingGroup } from '../types/seating';

const groups: SeatingGroup[] = [
  { id: 'g1', name: 'แถว 1', capacity: 2, groupIndex: 0, seats: [
    { id: 's1', seatNumber: 1, label: '1-1' }, { id: 's2', seatNumber: 2, label: '1-2' }] },
  { id: 'g2', name: 'แถว 2', capacity: 1, groupIndex: 1, seats: [{ id: 's3', seatNumber: 1, label: '2-1' }] },
];
const asg = (id: string, seat: string, sid: string, extra: Partial<SeatingAssignment> = {}): SeatingAssignment => ({
  id, layoutId: 'seat_A__C_5-1_546', groupId: 'g1', seatId: seat, studentId: sid, studentName: 'เก่า',
  effectiveFrom: '2026-11-01T00:00:00.000Z', effectiveTo: null, ...extra,
});
const NOW = '2026-11-06T05:00:00.000Z';

describe('remapLayoutForCopy', () => {
  const roster = new Map([['101', { name: 'สมชาย', studentNo: 1 }], ['102', { name: 'สมหญิง', studentNo: 2 }]]);
  const out = remapLayoutForCopy({
    sourceGroups: groups,
    sourceAssignments: [asg('a1', 's1', '101'), asg('a2', 's2', '102'), asg('a3', 's3', '999'), asg('old', 's1', '102', { effectiveTo: '2026-11-02T00:00:00.000Z' })],
    targetLayoutId: 'seat_B__C_5-1_546', roster, actorUid: 'uid-b', nowIso: NOW,
  });

  it('คัดลอกโครงกลุ่ม/ที่นั่งครบ และตั้ง layoutId ปลายทาง', () => {
    expect(out.groups.map(g => g.id)).toEqual(['g1', 'g2']);
    expect(out.groups.every(g => g.layoutId === 'seat_B__C_5-1_546')).toBe(true);
    expect(out.groups[1].order).toBe(2);
  });

  it('รายการนั่ง: id ใหม่มี layoutId ปลายทาง, ใช้ชื่อ/เลขที่ล่าสุดจากทะเบียน, เริ่มนับวันนี้', () => {
    expect(out.assignments).toHaveLength(2);
    for (const a of out.assignments) {
      expect(a.id.startsWith('assign_seat_B__C_5-1_546_')).toBe(true);
      expect(a.layoutId).toBe('seat_B__C_5-1_546');
      expect(a.effectiveFrom).toBe(NOW);
      expect(a.effectiveTo).toBeNull();
      expect(a.assignedBy).toBe('uid-b');
    }
    expect(out.assignments.find(a => a.studentId === '101')!.studentName).toBe('สมชาย');
  });

  it('ไม่คัดลอกนักเรียนที่ไม่อยู่ในรายชื่อปัจจุบัน (นับเป็น skipped) และไม่คัดลอกประวัติที่ปิดแล้ว', () => {
    expect(out.skippedStudents).toBe(1);
    expect(out.assignments.some(a => a.studentId === '999')).toBe(false);
    expect(out.assignments.filter(a => a.studentId === '102')).toHaveLength(1);
  });

  it('ที่นั่งที่ไม่มีในโครงผัง = ไม่คัดลอก', () => {
    const r = remapLayoutForCopy({
      sourceGroups: groups, sourceAssignments: [asg('x', 'ghost', '101')],
      targetLayoutId: 'T', roster, actorUid: 'u', nowIso: NOW,
    });
    expect(r.assignments).toHaveLength(0);
    expect(r.skippedStudents).toBe(1);
  });
});
