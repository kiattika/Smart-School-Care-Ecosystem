import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { normalizeOverrides, type ThemeOverrides } from '../lib/themeTokens';

/**
 * โทเคนสีของธีมที่แอดมินแก้ — school_settings/theme_tokens { overrides: {ธีม: {โทเคน: สี}}, updatedAt, updatedBy }
 * เก็บเฉพาะค่าที่ต่างจากค่าเริ่มต้นในเอกสาร (ไม่มีเอกสาร/ว่าง = ค่าเริ่มต้นทั้งหมด)
 * rules: wildcard school_settings — ผู้ล็อกอินอ่านได้, SUPER_ADMIN เขียน; ค่าสีตรวจซ้ำที่ client ทุกครั้งก่อนใส่ CSS (normalizeOverrides)
 */
const REF = () => doc(db, 'school_settings', 'theme_tokens');

export function subscribeThemeTokens(cb: (o: ThemeOverrides) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(REF(), snap => cb(normalizeOverrides(snap.data()?.overrides)), e => onError?.(e));
}

/** บันทึกทั้งชุด (แทนที่ของเดิม) — throw เมื่อเขียนไม่สำเร็จ ห้ามแจ้งสำเร็จเอง */
export async function saveThemeTokens(overrides: ThemeOverrides, updatedBy: string): Promise<void> {
  await setDoc(REF(), { overrides: normalizeOverrides(overrides), updatedAt: serverTimestamp(), updatedBy });
}
