/**
 * คัดลอกผังที่นั่งจากครูท่านอื่น (ห้อง/ชั้นเดียวกัน) เป็นสำเนาของตน — ไม่ผูกสดกับผังต้นทาง
 *
 * - กลุ่ม/ที่นั่งใช้ id เดิมได้ (id อยู่ใต้ผังของตนเอง ไม่ชนกับผู้อื่น)
 * - รายการนั่ง (assignment) เป็นคอลเลกชันกลาง → สร้าง id ใหม่ที่มี layoutId ปลายทางเสมอ
 * - คัดลอกเฉพาะนักเรียนที่ยังอยู่ในรายชื่อปัจจุบันของผังปลายทาง (ใช้ชื่อ/เลขที่ล่าสุดจากทะเบียน ไม่ใช้สำเนาเก่า)
 * - ที่นั่งซ้อน/นักเรียนซ้ำในต้นทางไม่ถูกคัดลอกซ้ำ (1 คน = 1 ที่นั่ง)
 */
import type { SeatingAssignment, SeatingGroup } from '../types/seating';
import { dedupeActiveAssignments } from './seatingAssignments';

export interface CopyRosterEntry { name?: string; studentNo?: number }

export interface CopiedLayout {
  groups: SeatingGroup[];
  assignments: SeatingAssignment[];
  /** นักเรียนในต้นทางที่ไม่อยู่ในรายชื่อปัจจุบัน จึงไม่ได้คัดลอก */
  skippedStudents: number;
}

export function remapLayoutForCopy(input: {
  sourceGroups: SeatingGroup[];
  sourceAssignments: SeatingAssignment[];
  targetLayoutId: string;
  roster: Map<string, CopyRosterEntry>;
  actorUid: string;
  nowIso: string;
}): CopiedLayout {
  const { sourceGroups, sourceAssignments, targetLayoutId, roster, actorUid, nowIso } = input;
  const groups: SeatingGroup[] = sourceGroups.map((g, gi) => ({
    ...g,
    layoutId: targetLayoutId,
    groupIndex: g.groupIndex ?? gi,
    order: (g.groupIndex ?? gi) + 1,
    seats: (g.seats || []).map(st => ({ ...st, groupId: g.id })),
  }));
  const seatIds = new Set(groups.flatMap(g => g.seats.map(st => st.id)));
  const seatGroup = new Map(groups.flatMap(g => g.seats.map(st => [st.id, g] as const)));

  const active = Object.values(dedupeActiveAssignments(sourceAssignments));
  const assignments: SeatingAssignment[] = [];
  let skipped = 0;
  for (const a of active) {
    const who = roster.get(a.studentId);
    if (!who || !seatIds.has(a.seatId)) { skipped += 1; continue; }
    const g = seatGroup.get(a.seatId)!;
    assignments.push({
      id: `assign_${targetLayoutId}_${a.seatId}_${a.studentId}_${Date.parse(nowIso) || 0}`,
      layoutId: targetLayoutId,
      groupId: g.id,
      seatId: a.seatId,
      seatNumber: a.seatNumber,
      seatLabel: a.seatLabel,
      groupName: g.name,
      studentId: a.studentId,
      studentName: who.name ?? a.studentName,
      studentNo: who.studentNo ?? a.studentNo,
      effectiveFrom: nowIso,
      effectiveTo: null,
      assignedBy: actorUid,
      reason: 'คัดลอกจากผังของครูท่านอื่น',
    });
  }
  return { groups, assignments, skippedStudents: skipped };
}
