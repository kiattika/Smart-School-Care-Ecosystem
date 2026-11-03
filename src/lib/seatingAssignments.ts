import type { SeatingAssignment } from '../types/seating';

/**
 * ผังที่นั่ง: รวมรายการนั่งที่ยัง active ให้เหลือ "1 คน = 1 ที่นั่ง" และ "1 ที่นั่ง = 1 คน"
 * เอกสารเก่าที่ย้าย/สลับที่นั่งแล้วไม่ถูกปิด (effectiveTo ยังเป็น null) ทำให้นักเรียนคนเดียวโผล่หลายที่นั่ง —
 * ให้รายการที่ effectiveFrom ใหม่สุดชนะ (ที่นั่งตามด้วยนักเรียนตามลำดับเวลา) คืนเป็น seatId → assignment
 */
export function dedupeActiveAssignments(list: SeatingAssignment[]): Record<string, SeatingAssignment> {
  const active = list
    .filter(a => !a.effectiveTo && a.seatId && a.studentId)
    .sort((a, b) => (a.effectiveFrom || '').localeCompare(b.effectiveFrom || ''));
  const bySeat = new Map<string, SeatingAssignment>();
  for (const a of active) bySeat.set(a.seatId, a); // ใหม่กว่าทับที่นั่งเดิม
  const byStudent = new Map<string, SeatingAssignment>();
  for (const a of bySeat.values()) {
    const prev = byStudent.get(a.studentId);
    if (!prev || (prev.effectiveFrom || '') <= (a.effectiveFrom || '')) byStudent.set(a.studentId, a);
  }
  const out: Record<string, SeatingAssignment> = {};
  for (const a of byStudent.values()) out[a.seatId] = a;
  return out;
}
