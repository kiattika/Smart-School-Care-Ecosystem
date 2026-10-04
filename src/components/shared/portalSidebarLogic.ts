/**
 * ตรรกะของแถบเมนูด้านข้าง (PortalSidebarLayout) — pure functions ทดสอบได้ (src/__tests__/portalSidebar.test.ts)
 */

export interface SidebarItemVisibility {
  id: string;
  /** ซ่อนเมนูนี้เมื่อบทบาทที่ใช้งานอยู่อยู่ในรายการ (เช่น TeacherPortal: teaching-load ไม่แสดงให้ SUBJECT_TEACHER) */
  hideForRoles?: readonly string[];
}

/** เมนูที่มองเห็นตามบทบาทที่ใช้งานอยู่ — ไม่มี role = ไม่ซ่อนเมนูใดตามบทบาท */
export function visibleSidebarItems<T extends SidebarItemVisibility>(items: readonly T[], activeRole?: string | null): T[] {
  return items.filter((item) => !(activeRole && item.hideForRoles?.includes(activeRole)));
}

/**
 * เมนูที่ถือว่าเลือกอยู่: ค่าเดิมถ้ายังมองเห็น ไม่งั้นเมนูแรกที่มองเห็น (เช่น สลับบทบาทแล้วเมนูเดิมถูกซ่อน)
 * ไม่มีเมนูเลย = null
 */
export function resolveActiveSidebarId<T extends { id: string }>(visibleItems: readonly T[], activeId: string | null | undefined): string | null {
  if (visibleItems.length === 0) return null;
  return visibleItems.some((i) => i.id === activeId) ? (activeId as string) : visibleItems[0].id;
}

/** key ใน localStorage ของค่าปักหมุด (ใช้ร่วมกันทุก portal — ผู้ใช้ปักหมุดครั้งเดียวมีผลทุกหน้า) */
export const SIDEBAR_PIN_STORAGE_KEY = 'ssc.portalSidebar.pinned';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

/** อ่านค่าปักหมุด — storage ใช้ไม่ได้ (private mode / ถูกบล็อก / throw) = ไม่ปักหมุด */
export function readSidebarPinned(storage: StorageLike | null | undefined, key: string = SIDEBAR_PIN_STORAGE_KEY): boolean {
  try {
    return storage?.getItem(key) === '1';
  } catch {
    return false;
  }
}

/** บันทึกค่าปักหมุด — เขียนไม่ได้ก็ไม่เป็นไร (ค่าใน state ยังใช้ได้ในหน้านี้) คืน true ถ้าบันทึกสำเร็จ */
export function writeSidebarPinned(storage: StorageLike | null | undefined, pinned: boolean, key: string = SIDEBAR_PIN_STORAGE_KEY): boolean {
  try {
    if (!storage) return false;
    storage.setItem(key, pinned ? '1' : '0');
    return true;
  } catch {
    return false;
  }
}

/**
 * โหมดของแถบบนจอ lg+:
 * - pinned: เปิดค้าง ดันเนื้อหา
 * - overlay: ขยายชั่วคราว (hover/focus) ลอยทับเนื้อหา ไม่ดัน layout
 * - collapsed: แถบไอคอนแคบ
 */
export type SidebarMode = 'pinned' | 'overlay' | 'collapsed';

export function sidebarMode(pinned: boolean, expanded: boolean): SidebarMode {
  if (pinned) return 'pinned';
  return expanded ? 'overlay' : 'collapsed';
}

/** หน่วงเวลา hover (ms) — เปิดช้ากว่าปิดเล็กน้อย กันขยายเมื่อเมาส์แค่ผ่าน */
export const SIDEBAR_OPEN_DELAY_MS = 150;
export const SIDEBAR_CLOSE_DELAY_MS = 200;
