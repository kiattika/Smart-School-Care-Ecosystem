import { isSameRoom } from './utils';

/**
 * ห้องประจำชั้นจากคอลัมน์ "ประจำชั้น" ของรายงานภาระงานสอน (เช่น "M.5/6")
 * → รูปแบบเดียวกับทะเบียนนักเรียน "ม.5/6" ; ค่าที่ไม่ใช่รูปแบบ ชั้น/ห้อง (เช่น "-", ว่าง) = '' (ไม่เดา ไม่เขียน)
 */
export function normalizeHomeroomLabel(raw: unknown): string {
  const text = String(raw ?? '').trim();
  const m = text.match(/(\d+)\s*\/\s*(\d+)/);
  return m ? `ม.${Number(m[1])}/${Number(m[2])}` : '';
}

export interface HomeroomSourceRow {
  matchedTeacherId?: string | null;
  homeroom?: string | null;
  teacherName?: string;
}

export interface HomeroomUpdate { staffId: string; homeroomClass: string }

export interface HomeroomPlan {
  updates: HomeroomUpdate[];
  /** ครูที่ไฟล์ระบุห้องประจำชั้นขัดกันเอง (ไม่เขียน) */
  conflicts: string[];
}

/**
 * วางแผนการอัปเดต `staff.assignments.homeroomClass` จากไฟล์นำเข้า — ฟังก์ชันล้วน
 * - เฉพาะแถวที่จับคู่ครูได้ (matchedTeacherId) — ไม่เดา/ไม่สร้างตัวตน
 * - ห้องเดิมที่ตรงกับในไฟล์ (isSameRoom) ไม่เขียนซ้ำ
 * - ไฟล์ระบุห้องต่างกันสำหรับครูคนเดียวกัน = conflict ไม่เขียน
 */
export function planHomeroomUpdates(
  rows: readonly HomeroomSourceRow[],
  currentByStaffId: ReadonlyMap<string, string>,
): HomeroomPlan {
  const wanted = new Map<string, string>();
  const names = new Map<string, string>();
  const conflicted = new Map<string, string>();
  for (const r of rows) {
    const id = r.matchedTeacherId;
    const room = normalizeHomeroomLabel(r.homeroom);
    if (!id || !room || conflicted.has(id)) continue;
    if (r.teacherName && !names.has(id)) names.set(id, r.teacherName);
    const prev = wanted.get(id);
    if (prev && !isSameRoom(prev, room)) {
      wanted.delete(id);
      conflicted.set(id, names.get(id) || id);
      continue;
    }
    wanted.set(id, room);
  }
  const updates: HomeroomUpdate[] = [];
  for (const [staffId, homeroomClass] of wanted) {
    const current = currentByStaffId.get(staffId) || '';
    if (current && isSameRoom(current, homeroomClass)) continue;
    updates.push({ staffId, homeroomClass });
  }
  return { updates, conflicts: Array.from(conflicted.values()) };
}
