import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { normalizeEmail } from '../lib/normalizeEmail';
import { sendStaffNotifications } from './firestoreService';
import type { StaffNotificationDraft } from '../lib/staffNotifications';

/**
 * อีเมลของบุคลากรตาม staff doc id (staff/{staffId}.email) — ใช้แจ้งผลถึงครูที่เอกสารต้นเรื่องเก็บแค่ staffId
 * ไม่มีเอกสาร/ไม่มีอีเมล = null (ไม่เดา ไม่แต่งอีเมล)
 */
export async function staffEmailOf(staffId: string): Promise<string | null> {
  if (!staffId) return null;
  try {
    const snap = await getDoc(doc(db, 'staff', staffId));
    const e = snap.exists() ? normalizeEmail(String(snap.data().email || '')) : '';
    return e && e.includes('@') ? e : null;
  } catch (err) {
    console.warn('[staffEmailOf] ไม่สามารถอ่านทะเบียนบุคลากร', err);
    return null;
  }
}

/**
 * แจ้งผลถึงบุคลากรตาม staffId หลังงานหลักสำเร็จแล้ว — non-fatal เสมอ (ไม่ throw: ห้ามทำให้การตัดสิน/บันทึกที่สำเร็จแล้วดูเหมือนล้ม)
 * `build` รับอีเมลผู้รับแล้วคืน draft; ไม่มีผู้ส่งที่ล็อกอิน/ไม่มีอีเมลผู้รับ = ข้าม
 */
export async function notifyStaffById(
  staffId: string,
  build: (recipientEmail: string) => StaffNotificationDraft | null,
  senderName: string,
): Promise<void> {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const email = await staffEmailOf(staffId);
    if (!email) return;
    await sendStaffNotifications([build(email)], { uid, name: senderName || 'บุคลากร' });
  } catch (err) {
    console.warn('[notifyStaffById] failed', err);
  }
}
