/**
 * คีย์ผังที่นั่ง — ตรรกะกลางที่เดียว (ต้องตรงกับ `firestore.rules.comments` บล็อก seating_layouts)
 *
 * 1 ผัง = (ครูเจ้าของ, ชั้น/ห้องเรียน, ห้องกายภาพ) เช่น `ม.5/1 @ 546` ของครู sci-20
 *  - ไม่รวมรหัสวิชา: วิชาต่าง ๆ ที่ครูคนเดียวสอนห้องเดียวกัน (ชั้น+ห้องกายภาพเดียวกัน) ใช้ผังเดียวกัน
 *  - วิชาเดียวกันที่สอนต่างห้องกายภาพ (เช่น โฮมรูม 1 คาบ + ห้องแล็บ 2 คาบ) ได้คนละผัง
 *  - ครูแต่ละคนมีผังของตัวเอง (อิสระ) — ต้องการผังเหมือนครูอื่นให้ "คัดลอกผัง" (สำเนา ไม่ผูกสด)
 *  - วิชา AP (นักเรียนหลายห้องมาเรียนรวมกัน) ผูกด้วยรหัสวิชา+ห้องกายภาพ; ชุมนุมผูกด้วย id ชุมนุม
 *  - ไม่ระบุห้องกายภาพ = ใช้ส่วน `noroom` (ไม่เดาห้อง) — ยังจัดผัง/เช็คชื่อได้
 * id ทุกแบบขึ้นต้นด้วย `seat_{staffId}__` เพื่อให้ rules ตรวจได้ว่าเป็นผังของเจ้าของจริง
 */

export type SeatingLayoutKind = 'CLASS' | 'AP' | 'ELECTIVE';

export const SEAT_NO_ROOM = 'noroom';

/** ตัดตัวอักษรที่ใช้เป็น doc id ไม่ได้/ก่อความกำกวม (`/`, ช่องว่าง, `_` ซ้ำ) */
function slug(raw: string): string {
  return String(raw ?? '')
    .trim()
    .replace(/[\s/\\#?\[\]]+/g, '-')
    .replace(/_+/g, '-');
}

/**
 * ชั้น/ห้องเรียนแบบมาตรฐาน: "ม.5/8", "M.5/8", "ม 5 / 8" → "5-8"
 * อ่านไม่ออกว่าเป็นชั้น/ห้อง = null (ไม่เดา)
 */
export function classKeyOf(level: string | null | undefined): string | null {
  const m = String(level ?? '').match(/(\d+)\s*\/\s*(\d+)/);
  return m ? `${Number(m[1])}-${Number(m[2])}` : null;
}

/** ห้องกายภาพ (เช่น 546, "[953]") → ส่วนของคีย์; ว่าง = `noroom` */
export function physicalRoomKeyOf(room: string | null | undefined): string {
  const cleaned = String(room ?? '').replace(/[\[\]]/g, '').trim();
  return cleaned ? slug(cleaned).toLowerCase() : SEAT_NO_ROOM;
}

export interface SeatingTarget {
  kind: SeatingLayoutKind;
  /** ใช้ค้นหา "ผังของครูท่านอื่นที่ชั้น/ห้องเดียวกัน" (ไม่มีครูเจ้าของ) */
  targetKey: string;
  /** id เอกสารผัง (ขึ้นต้น `seat_{staffId}__`) */
  layoutId: string;
}

export interface SeatingTargetInput {
  ownerStaffId: string | null | undefined;
  kind?: SeatingLayoutKind;
  /** CLASS: ชั้น/ห้องเรียน เช่น ม.5/8 */
  level?: string | null;
  /** ห้องกายภาพ เช่น 546 (ว่าง = ไม่ระบุ) */
  physicalRoom?: string | null;
  /** AP: รหัสวิชา */
  code?: string | null;
  /** ELECTIVE: id ชุมนุม */
  activityId?: string | null;
}

/** ไม่มีครูเจ้าของ/ข้อมูลไม่พอระบุผัง = null (ผู้เรียกต้องแสดง error/empty state ห้ามเดา) */
export function seatingTargetFor(input: SeatingTargetInput): SeatingTarget | null {
  const staffId = String(input.ownerStaffId ?? '').trim();
  if (!staffId || /[\/\s]/.test(staffId)) return null;
  const kind = input.kind ?? 'CLASS';
  const roomKey = physicalRoomKeyOf(input.physicalRoom);

  let targetKey: string | null = null;
  if (kind === 'CLASS') {
    const cls = classKeyOf(input.level);
    if (cls) targetKey = `C_${cls}_${roomKey}`;
  } else if (kind === 'AP') {
    const code = slug(String(input.code ?? '')).toLowerCase();
    if (code) targetKey = `AP_${code}_${roomKey}`;
  } else {
    const act = slug(String(input.activityId ?? ''));
    if (act) targetKey = `EL_${act}`;
  }
  if (!targetKey) return null;
  return { kind, targetKey, layoutId: `seat_${staffId}__${targetKey}` };
}

/** ป้ายอ่านง่าย เช่น "ม.5/1 @ 546" / "ม.5/1 @ ไม่ระบุห้อง" */
export function seatingTargetLabel(input: { kind?: SeatingLayoutKind; level?: string | null; physicalRoom?: string | null; code?: string | null; activityName?: string | null }): string {
  const room = String(input.physicalRoom ?? '').replace(/[\[\]]/g, '').trim() || 'ไม่ระบุห้อง';
  if (input.kind === 'AP') return `${input.code || 'AP'} @ ${room}`;
  if (input.kind === 'ELECTIVE') return input.activityName || 'ชุมนุม';
  return `${String(input.level ?? '').trim()} @ ${room}`;
}

/** id ผังขึ้นต้นด้วย `seat_{staffId}__` จริงไหม (ตรงกับเงื่อนไขใน rules) */
export function layoutBelongsTo(layoutId: string, staffId: string | null | undefined): boolean {
  const s = String(staffId ?? '').trim();
  return !!s && layoutId.startsWith(`seat_${s}__`);
}
