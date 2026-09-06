/**
 * สรุปขาด/ลา/มาสาย ของคาบสอนหนึ่งคาบ ณ ปัจจุบัน (real-time) — ตรรกะบริสุทธิ์ (แยกออกมาให้ test ได้)
 *
 * ใช้ทำ badge บนการ์ดตารางสอนประจำวัน (TeacherScheduleList) ให้ครูผู้สอนคนอื่นที่มีคาบในห้อง/
 * วันเดียวกันเห็นได้ทันทีว่ามีนักเรียนขาด/ลา/มาสายกี่คน โดยไม่ต้องเปิด modal เช็คชื่อก่อน
 */

export type AttendanceStatusValue = 'PRESENT' | 'LATE' | 'ABSENT' | 'LEAVE';

export interface AttendanceDocLite {
  id: string;
  periodNumber: number | null;
  room: string;
  students: Record<string, AttendanceStatusValue>;
  source?: 'HOMEROOM_DEFAULT' | 'PERIOD_OVERRIDE';
}

export interface AttendanceSummary {
  absent: number;
  leave: number;
  late: number;
  present: number;
  isDefault: boolean; // true = มาจากค่าเริ่มต้นโฮมรูมตอนเช้า ไม่ใช่ข้อมูลจริงของคาบนี้เอง
}

/**
 * ลำดับความสำคัญ:
 * 1. คาบนี้มี record ของตัวเองอยู่แล้ว (จับคู่ด้วย expectedRecordIds หรือ periodNumber+ห้องตรงกัน)
 *    → ใช้ข้อมูลจริงของคาบนั้นเสมอ (isDefault: false) ไม่ว่าจะเป็นคาบ 0/โฮมรูมเอง หรือคาบอื่นที่
 *    ครูผู้สอนเช็ค/แก้ไขเองแล้ว — ตัวเลขต้องสะท้อนความจริงล่าสุดของคาบนั้น
 * 2. ยังไม่มี (และไม่ใช่คาบ 0 ซึ่งตัวมันเองคือโฮมรูม) → fallback ไปหา record HOMEROOM_DEFAULT
 *    ของห้องเดียวกันมาเป็นค่าเริ่มต้น (isDefault: true)
 * 3. ไม่มีทั้งคู่ → คืน undefined (ยังไม่มีอะไรให้สรุป ไม่แสดง badge)
 */
export function computeAttendanceSummary(
  todayAttendanceDocs: AttendanceDocLite[],
  expectedRecordIds: Set<string>,
  periodNumber: number,
  attRoomCandidates: string[],
  isSameRoom: (a?: string, b?: string) => boolean,
): AttendanceSummary | undefined {
  const periodRecord = todayAttendanceDocs.find(a =>
    expectedRecordIds.has(a.id) ||
    (a.periodNumber !== null &&
      Number(a.periodNumber) === Number(periodNumber) &&
      attRoomCandidates.some(r => isSameRoom(a.room, r)))
  );

  let students: Record<string, AttendanceStatusValue> | null = null;
  let isDefault = false;

  if (periodRecord && Object.keys(periodRecord.students).length > 0) {
    students = periodRecord.students;
  } else if (Number(periodNumber) !== 0) {
    const hrRecord = todayAttendanceDocs.find(a =>
      (a.source === 'HOMEROOM_DEFAULT' || a.periodNumber === null || a.periodNumber === 0) &&
      attRoomCandidates.some(r => isSameRoom(a.room, r)) &&
      Object.keys(a.students).length > 0
    );
    if (hrRecord) {
      students = hrRecord.students;
      isDefault = true;
    }
  }

  if (!students) return undefined;

  let absent = 0, leave = 0, late = 0, present = 0;
  Object.values(students).forEach(st => {
    if (st === 'ABSENT') absent++;
    else if (st === 'LEAVE') leave++;
    else if (st === 'LATE') late++;
    else present++;
  });
  return { absent, leave, late, present, isDefault };
}
