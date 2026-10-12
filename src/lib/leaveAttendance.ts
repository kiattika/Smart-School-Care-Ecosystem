import type { StudentLeaveDay } from '../types';

export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'LEAVE';

/** นักเรียนที่มีใบลาอนุมัติแล้วครอบคลุมวันที่ ymd (YYYY-MM-DD) */
export function leaveStudentIdsOn(days: StudentLeaveDay[], ymd: string): Set<string> {
  const ids = new Set<string>();
  for (const d of days) if (d.startDate <= ymd && ymd <= d.endDate) ids.add(d.studentId);
  return ids;
}

/**
 * ค่าเริ่มต้นสถานะเช็คชื่อ: ที่บันทึก/โฮมรูมไว้แล้วมาก่อนเสมอ (ครูแก้เองได้) ถ้ายังไม่มีสถานะและมีใบลาอนุมัติ → LEAVE
 * ใช้เฉพาะ pre-fill ในฟอร์ม — ไม่เขียนทับของที่บันทึกแล้ว และไม่ใช่ตัวตัดสินว่า "เช็คชื่อคาบนี้แล้ว"
 */
export function withLeavePrefill(
  base: Record<string, AttendanceStatus>,
  leaveIds: ReadonlySet<string>,
): Record<string, AttendanceStatus> {
  const out = { ...base };
  leaveIds.forEach(id => { if (!out[id]) out[id] = 'LEAVE'; });
  return out;
}
