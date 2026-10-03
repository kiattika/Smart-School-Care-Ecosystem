import { describe, it, expect } from 'vitest';
import {
  buildHouseSummary,
  roomStatusOf,
  roomStatusLabel,
  readableTextColor,
  compareRooms,
  houseCounts,
  SummaryStudent,
} from '../lib/houseSummary';

const RED = { id: 'h-red', name: 'คณะสีแดง', colorHex: '#ef4444' };
const BLUE = { id: 'h-blue', name: 'คณะสีน้ำเงิน', colorHex: '#3b82f6' };
const GREEN = { id: 'h-green', name: 'คณะสีเขียว', colorHex: '#22c55e' };

/** สร้างนักเรียน n คนในห้อง room ที่ houseId เดียวกัน */
let seq = 0;
const make = (n: number, room: string | null, houseId: string | null | undefined): SummaryStudent[] =>
  Array.from({ length: n }, () => ({ studentId: String(++seq), room, houseId }));

const nameOf = (id: string) => [RED, BLUE, GREEN].find((h) => h.id === id)?.name ?? id;

describe('buildHouseSummary', () => {
  it('whole room in one house: room count = room total; one block per house in house_config (no fixed 4)', () => {
    const s = buildHouseSummary([RED, BLUE, GREEN], [...make(40, 'ม.5/8', 'h-red'), ...make(38, 'ม.5/9', 'h-blue')]);
    expect(s.houses.map((b) => b.house.id)).toEqual(['h-red', 'h-blue', 'h-green']); // 3 คณะ = 3 บล็อก
    expect(s.houses[0]).toMatchObject({ total: 40, rooms: [{ room: 'ม.5/8', count: 40, roomTotal: 40 }] });
    expect(s.houses[1]).toMatchObject({ total: 38, rooms: [{ room: 'ม.5/9', count: 38, roomTotal: 38 }] });
    expect(s.houses[2]).toMatchObject({ total: 0, rooms: [] });
    expect(s.unassigned).toEqual({ total: 0, orphanedCount: 0, rooms: [] });
    expect(roomStatusOf(s, 'ม.5/8')).toEqual({ kind: 'SINGLE', houseId: 'h-red', unassigned: 0 });
  });

  it('mixed room: each house gets its share over the whole room (e.g. 12/40); room status = MIXED', () => {
    const s = buildHouseSummary([RED, BLUE], [...make(12, 'ม.4/1', 'h-red'), ...make(28, 'ม.4/1', 'h-blue')]);
    expect(s.houses[0].rooms).toEqual([{ room: 'ม.4/1', count: 12, roomTotal: 40 }]);
    expect(s.houses[1].rooms).toEqual([{ room: 'ม.4/1', count: 28, roomTotal: 40 }]);
    expect(roomStatusOf(s, 'ม.4/1')).toEqual({ kind: 'MIXED' });
    expect(roomStatusLabel(roomStatusOf(s, 'ม.4/1'), nameOf)).toBe('คละคณะ');
  });

  it('students without houseId go to the unassigned block (with their share of the room)', () => {
    const s = buildHouseSummary([RED], [...make(30, 'ม.6/2', 'h-red'), ...make(5, 'ม.6/2', null), ...make(3, 'ม.6/3', undefined), ...make(2, 'ม.6/3', '')]);
    expect(s.unassigned).toEqual({
      total: 10,
      orphanedCount: 0,
      rooms: [{ room: 'ม.6/2', count: 5, roomTotal: 35 }, { room: 'ม.6/3', count: 5, roomTotal: 5 }],
    });
    expect(roomStatusOf(s, 'ม.6/2')).toEqual({ kind: 'SINGLE', houseId: 'h-red', unassigned: 5 });
    expect(roomStatusLabel(roomStatusOf(s, 'ม.6/2'), nameOf)).toBe('คณะสีแดง · ยังไม่จัด 5 คน');
    expect(roomStatusLabel(roomStatusOf(s, 'ม.6/3'), nameOf)).toBe('ยังไม่จัดคณะ');
  });

  it('houseId of a deleted house counts as unassigned (and is reported as orphaned), not as a block', () => {
    const s = buildHouseSummary([BLUE], [...make(10, 'ม.1/1', 'h-red-deleted'), ...make(4, 'ม.1/1', 'h-blue')]);
    expect(s.houses.map((b) => b.house.id)).toEqual(['h-blue']);
    expect(s.unassigned).toEqual({ total: 10, orphanedCount: 10, rooms: [{ room: 'ม.1/1', count: 10, roomTotal: 14 }] });
    expect(roomStatusOf(s, 'ม.1/1')).toEqual({ kind: 'SINGLE', houseId: 'h-blue', unassigned: 10 });
  });

  it('groups "ม.5/8" and "M.5/8" as the same room (isSameRoom), first spelling is shown', () => {
    const s = buildHouseSummary([RED], [...make(20, 'ม.5/8', 'h-red'), ...make(20, 'M.5/8', 'h-red')]);
    expect(s.houses[0].rooms).toEqual([{ room: 'ม.5/8', count: 40, roomTotal: 40 }]);
    expect(roomStatusOf(s, 'M.5/8')).toEqual({ kind: 'SINGLE', houseId: 'h-red', unassigned: 0 });
  });

  it('rooms are sorted by name with numeric order; students with no room are listed last', () => {
    const s = buildHouseSummary([RED], [...make(1, 'ม.5/10', 'h-red'), ...make(1, null, 'h-red'), ...make(1, 'ม.5/9', 'h-red'), ...make(1, 'ม.4/2', 'h-red')]);
    expect(s.houses[0].rooms.map((r) => r.room)).toEqual(['ม.4/2', 'ม.5/9', 'ม.5/10', '']);
    expect(compareRooms('ม.5/9', 'ม.5/10')).toBeLessThan(0);
  });

  it('no houses / no students → empty summary (no sample data)', () => {
    expect(buildHouseSummary([], [])).toEqual({ houses: [], unassigned: { total: 0, orphanedCount: 0, rooms: [] }, roomStatuses: [] });
    const noStudents = buildHouseSummary([RED, BLUE], []);
    expect(noStudents.houses.every((b) => b.total === 0 && b.rooms.length === 0)).toBe(true);
  });
});

describe('ordering and per-house counts (house list "N ห้อง · M คน")', () => {
  it('summary blocks follow the order of the houses passed in (= the house list above on the page)', () => {
    const listOrder = [GREEN, RED, BLUE]; // ไม่ได้เรียงตามชื่อ/สี — ต้องคงลำดับนี้
    const s = buildHouseSummary(listOrder, make(3, 'ม.2/1', 'h-blue'));
    expect(s.houses.map((b) => b.house.id)).toEqual(['h-green', 'h-red', 'h-blue']);
  });

  it('counts named rooms (a mixed room counts for every house in it) and all students incl. no-room ones', () => {
    const s = buildHouseSummary([RED, BLUE], [
      ...make(40, 'ม.5/8', 'h-red'),
      ...make(12, 'ม.4/1', 'h-red'), ...make(28, 'ม.4/1', 'h-blue'),
      ...make(2, null, 'h-red'),
    ]);
    expect(houseCounts(s.houses[0])).toEqual({ rooms: 2, students: 54 });
    expect(houseCounts(s.houses[1])).toEqual({ rooms: 1, students: 28 });
    expect(houseCounts(undefined)).toEqual({ rooms: 0, students: 0 });
  });
});

describe('readableTextColor', () => {
  it('dark text on light house colors, white on dark ones', () => {
    expect(readableTextColor('#f59e0b')).toBe('#0f172a'); // amber
    expect(readableTextColor('#ffffff')).toBe('#0f172a');
    expect(readableTextColor('#3b82f6')).toBe('#ffffff'); // blue
    expect(readableTextColor('#ef4444')).toBe('#ffffff'); // red
    expect(readableTextColor('not-a-color')).toBe('#ffffff');
  });
});
