import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';

/**
 * อัปโหลดภาพถ่ายบ้านนักเรียนขึ้น Firebase Storage
 * path: student_home_photos/{ownerUid}/{timestamp-rand}.jpg  (ownerUid = Auth UID ของนักเรียน)
 * storage.rules อนุญาตให้เขียนเฉพาะเจ้าของ + รูปภาพ + < 5MB
 *
 * คืน download URL (มี token) — เก็บลง Firestore `student_home_locations.photoUrls`
 * ครูที่ปรึกษาเปิดดูผ่าน URL นี้ (การเข้าถึง gate ด้วย firestore.rules ของ doc นั้น)
 */
export async function uploadHomePhoto(ownerUid: string, blob: Blob): Promise<string> {
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const objectRef = ref(storage, `student_home_photos/${ownerUid}/${name}`);
  await uploadBytes(objectRef, blob, { contentType: 'image/jpeg' });
  return getDownloadURL(objectRef);
}
