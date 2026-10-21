import { doc, getDoc, onSnapshot, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  ACTIVITY_WINDOW_KINDS, activityWindowBlockMessage, parseActivityWindows,
  type ActivityWindowKind, type ActivityWindows,
} from '../lib/activityWindows';

const ref = () => doc(db, 'school_settings', 'activity_windows');

export function subscribeActivityWindows(cb: (w: ActivityWindows) => void): () => void {
  return onSnapshot(
    ref(),
    (snap) => cb(snap.exists() ? parseActivityWindows(snap.data()) : {}),
    (err) => { console.warn('[activity_windows] listener notice:', err.message); cb({}); },
  );
}

/** แอดมินบันทึกทั้งชุด (SUPER_ADMIN — rules wildcard school_settings); ช่วงว่างทั้งคู่ = ไม่เก็บ (ไม่จำกัด) */
export async function saveActivityWindows(windows: ActivityWindows, byUid: string): Promise<void> {
  const out: Record<string, { opensAt: Timestamp | null; closesAt: Timestamp | null }> = {};
  for (const kind of ACTIVITY_WINDOW_KINDS) {
    const w = windows[kind];
    if (!w || (w.opensAtMs === null && w.closesAtMs === null)) continue;
    out[kind] = {
      opensAt: w.opensAtMs === null ? null : Timestamp.fromMillis(w.opensAtMs),
      closesAt: w.closesAtMs === null ? null : Timestamp.fromMillis(w.closesAtMs),
    };
  }
  await setDoc(ref(), { windows: out, updatedAt: serverTimestamp(), updatedBy: byUid });
}

/**
 * ตรวจ "ตอนบันทึก" ว่าช่วงเปิดอยู่ — อ่านเอกสารสดทุกครั้ง (ไม่พึ่ง state หน้าจอ)
 * อ่านไม่ได้ = ไม่ขวาง (fail-open: ไม่ให้ระบบล็อกตัวเองเพราะเน็ต/สิทธิ์) แต่ถ้าอ่านได้และปิดอยู่ = throw
 */
export async function assertActivityWindowOpen(kind: ActivityWindowKind): Promise<void> {
  let windows: ActivityWindows = {};
  try {
    const snap = await getDoc(ref());
    windows = snap.exists() ? parseActivityWindows(snap.data()) : {};
  } catch (e) {
    console.warn('[activity_windows] read failed, not blocking:', e);
    return;
  }
  const msg = activityWindowBlockMessage(kind, windows, Date.now());
  if (msg) throw new Error(msg);
}
