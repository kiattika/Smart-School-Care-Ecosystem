import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { normalizePreferences, PHOTO_URL_MAX, type UserPreferences } from '../lib/userPreferences';

const COL = 'user_preferences';

/** ผู้ใช้ที่ล็อกอินแล้วอ่านค่าของตัวเองแบบ live (doc ยังไม่มี → ค่าเริ่มต้น) */
export function subscribeUserPreferences(uid: string, cb: (p: UserPreferences, exists: boolean) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(doc(db, COL, uid), snap => cb(normalizePreferences(snap.data()), snap.exists()), e => onError?.(e));
}

/** บันทึกบางคีย์ (merge) — throw เมื่อเขียนไม่สำเร็จ ห้ามแจ้งสำเร็จเอง */
export async function saveUserPreferences(uid: string, patch: Partial<UserPreferences>): Promise<void> {
  if (patch.photoUrl !== undefined && (patch.photoUrl.length > PHOTO_URL_MAX || (patch.photoUrl && !patch.photoUrl.startsWith('https://')))) {
    throw new Error('ลิงก์รูปไม่ถูกต้อง');
  }
  await setDoc(doc(db, COL, uid), { ...patch, updatedAt: serverTimestamp() }, { merge: true });
}

/** อัปโหลดรูปโปรไฟล์ของตัวเอง → profile_photos/{uid}/... แล้วคืน download URL */
export async function uploadMyProfilePhoto(uid: string, blob: Blob): Promise<string> {
  const objectRef = ref(storage, `profile_photos/${uid}/${Date.now()}.jpg`);
  await uploadBytes(objectRef, blob, { contentType: blob.type || 'image/jpeg' });
  return getDownloadURL(objectRef);
}
