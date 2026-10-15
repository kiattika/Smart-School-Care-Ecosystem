import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';

/**
 * SUPER_ADMIN: สั่ง Cloud Functions คำนวณ public_summary/current (หน้า /info) ใหม่ทันที — callable refreshPublicSummary
 * (ปกติคำนวณเองทุกวัน 03:00 โดย scheduledPublicSummary) — เซิร์ฟเวอร์ไม่ตอบ success = throw ห้ามแจ้งสำเร็จเอง
 */
export async function refreshPublicSummary(): Promise<void> {
  const res = await httpsCallable(functions, 'refreshPublicSummary')();
  if ((res.data as { success?: unknown } | null)?.success !== true) throw new Error('เซิร์ฟเวอร์ตอบกลับในรูปแบบที่ไม่ถูกต้อง');
}
