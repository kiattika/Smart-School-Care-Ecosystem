import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { classPlanDocId, validateClassPlan, type ClassPlanContent, type ClassPlanDoc, type ClassPlanRound } from '../lib/sdqClassPlan';

const COL = 'sdq_class_plans';

const fromDoc = (id: string, x: Record<string, any>): ClassPlanDoc => ({
  id, room: x.room || '', academicYear: x.academicYear || '', round: x.round === 2 ? 2 : 1,
  studentPlans: x.studentPlans && typeof x.studentPlans === 'object' ? x.studentPlans : {}, activityPlan: x.activityPlan || '',
});

/** ฟังด้วย query (room + ปี) ไม่ใช่ getDoc ตรง ๆ — เอกสารที่ยังไม่มีจะทำให้ rules อ่าน resource.data ไม่ได้ (permission-denied) */
export function subscribeClassPlans(room: string, academicYear: string, cb: (l: ClassPlanDoc[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(query(collection(db, COL), where('room', '==', room), where('academicYear', '==', academicYear)),
    snap => cb(snap.docs.map(d => fromDoc(d.id, d.data()))), e => onError?.(e));
}

/** บันทึก (สร้าง/เขียนทับ) — throw เมื่อเขียนไม่สำเร็จ ห้ามกลืน error แล้วแจ้งสำเร็จ */
export async function saveClassPlan(
  ctx: { room: string; academicYear: string; round: ClassPlanRound }, content: ClassPlanContent, by: { uid: string; staffId: string },
): Promise<void> {
  if (!by.uid || !by.staffId) throw new Error('บัญชีนี้ไม่ได้เชื่อมกับทะเบียนบุคลากร');
  if (!ctx.room || !ctx.academicYear) throw new Error('ไม่พบห้องหรือปีการศึกษา');
  const err = validateClassPlan(content);
  if (err) throw new Error(err);
  await setDoc(doc(db, COL, classPlanDocId(ctx.academicYear, ctx.round, ctx.room)), {
    room: ctx.room, academicYear: ctx.academicYear, round: ctx.round,
    studentPlans: content.studentPlans, activityPlan: content.activityPlan,
    updatedByUid: by.uid, updatedByStaffId: by.staffId, updatedAt: serverTimestamp(),
  });
}
