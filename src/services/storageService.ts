import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';

/**
 * อัปโหลดรูป (บีบอัดแล้ว) ที่เกี่ยวกับนักเรียน ขึ้น Firebase Storage
 * path: {folder}/{ownerUid}/{timestamp-rand}.jpg  (ownerUid = Auth UID ของนักเรียน)
 * storage.rules อนุญาต write เฉพาะเจ้าของ + image/* + < 5MB สำหรับ folder ที่กำหนดไว้
 *
 * คืน download URL (มี token) — เก็บลง Firestore. ผู้ที่อ่าน Firestore doc ได้ (gate ด้วย
 * firestore.rules) จึงจะได้ URL นี้ไปเปิดดู
 */
export type StudentPhotoFolder = 'student_home_photos' | 'student_portfolio_photos';

export async function uploadStudentPhoto(
  folder: StudentPhotoFolder,
  ownerUid: string,
  blob: Blob,
): Promise<string> {
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const objectRef = ref(storage, `${folder}/${ownerUid}/${name}`);
  await uploadBytes(objectRef, blob, { contentType: 'image/jpeg' });
  return getDownloadURL(objectRef);
}

/** ภาพถ่ายบ้านนักเรียน (ประกอบการเยี่ยมบ้าน) */
export const uploadHomePhoto = (ownerUid: string, blob: Blob) =>
  uploadStudentPhoto('student_home_photos', ownerUid, blob);

/** ภาพประกอบแฟ้มสะสมผลงาน */
export const uploadPortfolioPhoto = (ownerUid: string, blob: Blob) =>
  uploadStudentPhoto('student_portfolio_photos', ownerUid, blob);
