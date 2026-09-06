import { describe, it, expect } from 'vitest';
import { computeAttendanceSummary, AttendanceDocLite } from '../lib/attendanceSummary';
import { isSameRoom } from '../lib/utils';

/** helper: expectedRecordIds เหมือนที่ TeacherPortal.tsx คำนวณจาก attRoomCandidates + periodNumber */
function idsFor(dateStr: string, room: string, periodNumber: number): Set<string> {
  const ids = new Set<string>();
  const rr = room.replace('/', '-');
  ids.add(`${dateStr}_${rr}_p${periodNumber}`);
  if (periodNumber === 0) ids.add(`${dateStr}_${rr}`);
  return ids;
}

describe('computeAttendanceSummary — badge สรุปขาด/ลา/มาสายบนการ์ดตารางสอน', () => {
  const room = 'ม.5/8';
  const dateStr = '2569-06-10';

  it('ไม่มี record ใดๆ เลย → undefined (ไม่แสดง badge)', () => {
    const result = computeAttendanceSummary([], idsFor(dateStr, room, 3), 3, [room], isSameRoom);
    expect(result).toBeUndefined();
  });

  it('ครูประจำชั้นเช็คโฮมรูมตอนเช้าแล้ว (มีขาด 1 คน) → คาบอื่นที่ยังไม่เช็คเห็นค่า default ทันที', () => {
    const docs: AttendanceDocLite[] = [
      {
        id: `${dateStr}_${room}`,
        periodNumber: null,
        room,
        students: { std1: 'ABSENT', std2: 'PRESENT', std3: 'PRESENT' },
        source: 'HOMEROOM_DEFAULT',
      },
    ];
    const result = computeAttendanceSummary(docs, idsFor(dateStr, room, 3), 3, [room], isSameRoom);
    expect(result).toEqual({ absent: 1, leave: 0, late: 0, present: 2, isDefault: true });
  });

  it('REGRESSION: ครูวิชาแก้ไขสถานะเฉพาะคาบตัวเอง (คนที่ขาดตอนเช้ามาสายแทน) → badge ใช้ข้อมูลจริงของคาบนั้น ไม่ใช่ค่า default เดิม', () => {
    const docs: AttendanceDocLite[] = [
      {
        id: `${dateStr}_${room}`,
        periodNumber: null,
        room,
        students: { std1: 'ABSENT', std2: 'PRESENT', std3: 'PRESENT' },
        source: 'HOMEROOM_DEFAULT',
      },
      {
        id: `${dateStr}_${room}_p3`,
        periodNumber: 3,
        room,
        students: { std1: 'LATE', std2: 'PRESENT', std3: 'PRESENT' }, // แก้เฉพาะคาบ 3
        source: 'PERIOD_OVERRIDE',
      },
    ];
    const result = computeAttendanceSummary(docs, idsFor(dateStr, room, 3), 3, [room], isSameRoom);
    expect(result).toEqual({ absent: 0, leave: 0, late: 1, present: 2, isDefault: false });
  });

  it('คาบ 0 (โฮมรูมเอง) มี record ของตัวเอง → isDefault: false เสมอ (ไม่ fallback หาตัวเอง)', () => {
    const docs: AttendanceDocLite[] = [
      { id: `${dateStr}_${room.replace('/', '-')}`, periodNumber: null, room, students: { std1: 'LEAVE' }, source: 'HOMEROOM_DEFAULT' },
    ];
    const result = computeAttendanceSummary(docs, idsFor(dateStr, room, 0), 0, [room], isSameRoom);
    expect(result).toEqual({ absent: 0, leave: 1, late: 0, present: 0, isDefault: false });
  });

  it('ห้องอื่นไม่ปนกัน — ไม่ fallback ข้ามห้อง', () => {
    const docs: AttendanceDocLite[] = [
      { id: `${dateStr}_ม.5-9`, periodNumber: null, room: 'ม.5/9', students: { std9: 'ABSENT' }, source: 'HOMEROOM_DEFAULT' },
    ];
    const result = computeAttendanceSummary(docs, idsFor(dateStr, room, 3), 3, [room], isSameRoom);
    expect(result).toBeUndefined();
  });

  it('ไม่มีนักเรียนขาด/ลา/สาย เลย (มาครบทุกคน) → นับ present ถูกต้อง, isDefault ตามที่มา', () => {
    const docs: AttendanceDocLite[] = [
      { id: `${dateStr}_${room}_p3`, periodNumber: 3, room, students: { a: 'PRESENT', b: 'PRESENT' }, source: 'PERIOD_OVERRIDE' },
    ];
    const result = computeAttendanceSummary(docs, idsFor(dateStr, room, 3), 3, [room], isSameRoom);
    expect(result).toEqual({ absent: 0, leave: 0, late: 0, present: 2, isDefault: false });
  });

  it('students ว่างเปล่า ({}) ไม่นับว่ามี record — ยัง fallback ต่อได้ตามปกติ', () => {
    const docs: AttendanceDocLite[] = [
      { id: `${dateStr}_${room}_p3`, periodNumber: 3, room, students: {}, source: 'PERIOD_OVERRIDE' },
      { id: `${dateStr}_${room}`, periodNumber: null, room, students: { std1: 'ABSENT' }, source: 'HOMEROOM_DEFAULT' },
    ];
    const result = computeAttendanceSummary(docs, idsFor(dateStr, room, 3), 3, [room], isSameRoom);
    expect(result).toEqual({ absent: 1, leave: 0, late: 0, present: 0, isDefault: true });
  });
});
