import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { apCourseKey, apRosterDocId, type ApRosterDoc } from '../lib/apCourses';

const COL = 'ap_rosters';
export const AP_MAX_STUDENTS = 200;

/** ฟังรายชื่อ AP ที่ครูยืนยันแล้วของภาคเรียนนี้ (ครูทุกคนอ่านได้เพื่อตรวจตกหล่น) */
export function subscribeApRosters(semesterId: string, cb: (list: ApRosterDoc[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(query(collection(db, COL), where('semesterId', '==', semesterId)), snap => {
    cb(snap.docs.map(d => ({ ...(d.data() as Omit<ApRosterDoc, 'id'>), id: d.id, confirmed: true })));
  }, e => onError?.(e));
}

/** บันทึก/ยืนยันรายชื่อ — throw เมื่อเขียนไม่สำเร็จ (ห้ามแจ้งสำเร็จโดยไม่ได้เขียนจริง) */
export async function saveApRoster(p: {
  semesterId: string; code: string; courseName: string; ownerStaffId: string; levels: string[]; studentIds: string[];
}): Promise<void> {
  if (!p.ownerStaffId) throw new Error('ไม่พบรหัสบุคลากรของผู้ใช้');
  if (p.studentIds.length > AP_MAX_STUDENTS) throw new Error(`รายชื่อเกิน ${AP_MAX_STUDENTS} คน`);
  await setDoc(doc(db, COL, apRosterDocId(p.semesterId, p.code, p.ownerStaffId)), {
    semesterId: p.semesterId,
    courseKey: apCourseKey(p.code),
    courseName: p.courseName,
    ownerStaffId: p.ownerStaffId,
    levels: p.levels,
    studentIds: [...new Set(p.studentIds)],
    updatedAt: serverTimestamp(),
  });
}
