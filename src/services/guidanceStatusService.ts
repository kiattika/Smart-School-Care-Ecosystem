import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';

export interface GuidanceStatusResult { hasActiveCounselor: boolean; count: number }

/**
 * SUPER_ADMIN: ให้ Cloud Functions คำนวณ school_settings/guidance_status ใหม่จาก staff จริง (callable refreshGuidanceStatus)
 * ผลลัพธ์มาจากเซิร์ฟเวอร์เท่านั้น — ตอบผิดรูปแบบ = throw (ห้ามเดาเป็น true/false)
 */
export async function refreshGuidanceStatus(): Promise<GuidanceStatusResult> {
  const res = await httpsCallable(functions, 'refreshGuidanceStatus')();
  const data = (res.data ?? {}) as Record<string, unknown>;
  if (typeof data.hasActiveCounselor !== 'boolean') {
    throw new Error('เซิร์ฟเวอร์ตอบกลับในรูปแบบที่ไม่ถูกต้อง');
  }
  return { hasActiveCounselor: data.hasActiveCounselor, count: typeof data.count === 'number' ? data.count : 0 };
}
