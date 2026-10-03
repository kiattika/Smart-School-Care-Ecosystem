import { isSameRoom } from './utils';

/**
 * สรุปการจัดคณะสี (HouseManagerPage) — pure function ทดสอบได้ (src/__tests__/houseSummary.test.ts)
 *
 * ข้อมูลมาจาก students แบบ real-time (useRealStudents → students/{id}.houseId) + house_config (useHouseConfig)
 * - หนึ่งบล็อกต่อหนึ่งคณะใน house_config (จำนวนตามข้อมูลจริง)
 * - นักเรียนที่ไม่มี houseId หรือ houseId ชี้ไปคณะที่ถูกลบแล้ว → บล็อก "ยังไม่ได้จัดคณะ"
 * - ห้องจัดกลุ่มด้วย isSameRoom() (ข้อมูลเก่าปน "ม.5/8" กับ "M.5/8" — CLAUDE.md)
 */

export interface SummaryStudent {
  studentId: string;
  room?: string | null;
  houseId?: string | null;
}

export interface SummaryHouse {
  id: string;
  name: string;
  colorHex: string;
}

export interface RoomCount {
  /** ชื่อห้องที่แสดง ('' = นักเรียนไม่มีข้อมูลห้อง) */
  room: string;
  /** จำนวนนักเรียนของบล็อกนี้ในห้องนี้ */
  count: number;
  /** จำนวนนักเรียนทั้งห้อง */
  roomTotal: number;
}

export interface HouseBlock<H extends SummaryHouse = SummaryHouse> {
  house: H;
  total: number;
  rooms: RoomCount[];
}

export interface UnassignedBlock {
  total: number;
  /** ในจำนวนนี้ มีกี่คนที่ houseId ชี้ไปคณะที่ถูกลบไปแล้ว */
  orphanedCount: number;
  rooms: RoomCount[];
}

export type RoomHouseStatus =
  | { kind: 'NONE' }                                   // ยังไม่มีใครในห้องถูกจัดคณะ
  | { kind: 'SINGLE'; houseId: string; unassigned: number } // ทุกคนที่จัดแล้วอยู่คณะเดียว (unassigned = ที่ยังไม่จัด)
  | { kind: 'MIXED' };                                 // อยู่มากกว่า 1 คณะ

export interface HouseSummary<H extends SummaryHouse = SummaryHouse> {
  houses: HouseBlock<H>[];
  unassigned: UnassignedBlock;
  /** สถานะคณะของห้อง (ใช้ต่อท้ายชื่อห้องใน dropdown) — ค้นด้วย roomStatusOf() */
  roomStatuses: Array<{ room: string; status: RoomHouseStatus }>;
}

const roomCollator = new Intl.Collator('th', { numeric: true, sensitivity: 'base' });

/** เรียงตามชื่อห้อง (ม.5/9 ก่อน ม.5/10) — ห้องว่าง ('' = ไม่ระบุห้อง) ไว้ท้ายสุด */
export function compareRooms(a: string, b: string): number {
  if (!a !== !b) return a ? -1 : 1;
  return roomCollator.compare(a, b);
}

export function buildHouseSummary<H extends SummaryHouse>(houses: H[], students: SummaryStudent[]): HouseSummary<H> {
  const validHouseIds = new Set(houses.map((h) => h.id));

  // จัดกลุ่มห้องด้วย isSameRoom — ชื่อที่แสดงใช้ชื่อแรกที่พบ
  const roomKeys: string[] = [];
  const roomKeyOf = (raw?: string | null): string => {
    const r = (raw || '').trim();
    if (!r) return '';
    return roomKeys.find((k) => isSameRoom(k, r)) ?? (roomKeys.push(r), r);
  };

  const roomTotals = new Map<string, number>();
  const byHouse = new Map<string, Map<string, number>>();   // houseId → room → count
  const unassignedByRoom = new Map<string, number>();
  let orphanedCount = 0;

  for (const s of students) {
    const room = roomKeyOf(s.room);
    roomTotals.set(room, (roomTotals.get(room) ?? 0) + 1);
    const hid = s.houseId || '';
    if (hid && validHouseIds.has(hid)) {
      const m = byHouse.get(hid) ?? new Map<string, number>();
      m.set(room, (m.get(room) ?? 0) + 1);
      byHouse.set(hid, m);
    } else {
      if (hid) orphanedCount++;
      unassignedByRoom.set(room, (unassignedByRoom.get(room) ?? 0) + 1);
    }
  }

  const toRoomCounts = (m: Map<string, number>): RoomCount[] =>
    Array.from(m.entries())
      .map(([room, count]) => ({ room, count, roomTotal: roomTotals.get(room) ?? count }))
      .sort((a, b) => compareRooms(a.room, b.room));

  const houseBlocks = houses.map((house) => {
    const rooms = toRoomCounts(byHouse.get(house.id) ?? new Map());
    return { house, total: rooms.reduce((n, r) => n + r.count, 0), rooms };
  });

  const unassignedRooms = toRoomCounts(unassignedByRoom);

  const roomStatuses = Array.from(roomTotals.keys())
    .sort(compareRooms)
    .map((room) => {
      const housesInRoom = houses.filter((h) => (byHouse.get(h.id)?.get(room) ?? 0) > 0);
      let status: RoomHouseStatus;
      if (housesInRoom.length === 0) status = { kind: 'NONE' };
      else if (housesInRoom.length > 1) status = { kind: 'MIXED' };
      else status = { kind: 'SINGLE', houseId: housesInRoom[0].id, unassigned: unassignedByRoom.get(room) ?? 0 };
      return { room, status };
    });

  return {
    houses: houseBlocks,
    unassigned: { total: unassignedRooms.reduce((n, r) => n + r.count, 0), orphanedCount, rooms: unassignedRooms },
    roomStatuses,
  };
}

/** สถานะคณะของห้อง (ชื่อห้องดิบจาก dropdown) — เทียบด้วย isSameRoom */
export function roomStatusOf(summary: HouseSummary<SummaryHouse>, room: string): RoomHouseStatus {
  return summary.roomStatuses.find((r) => isSameRoom(r.room, room))?.status ?? { kind: 'NONE' };
}

/** ข้อความต่อท้ายชื่อห้องใน dropdown */
export function roomStatusLabel(status: RoomHouseStatus, houseName: (id: string) => string): string {
  switch (status.kind) {
    case 'NONE': return 'ยังไม่จัดคณะ';
    case 'MIXED': return 'คละคณะ';
    case 'SINGLE':
      return status.unassigned > 0
        ? `${houseName(status.houseId)} · ยังไม่จัด ${status.unassigned} คน`
        : houseName(status.houseId);
  }
}

/** สีตัวอักษรที่อ่านออกบนพื้น colorHex (สีอ่อน → ตัวเข้ม) */
export function readableTextColor(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return '#ffffff';
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#0f172a' : '#ffffff';
}
