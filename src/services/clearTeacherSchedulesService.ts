import { arrayRemove, collection, doc, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  SCHEDULE_REFERENCING_COLLECTIONS,
  collectReferenceValues,
  partitionStaleByReferences,
} from '../lib/scheduleSyncReplace';

export interface ClearTeacherSchedulesResult {
  deleted: number;
  hidden: number;
  detached: number;
}

/**
 * เอาครูคนหนึ่งออกจากตารางสอนที่เลือก (กรณีครูเลิกสอนทั้งหมด จึงไม่มีแถวในไฟล์นำเข้า — sync/replace ไม่แตะ)
 * - คาบร่วมกับครูคนอื่น: ถอดเฉพาะครูคนนี้ออกจาก teacherIds (คาบยังอยู่ของครูที่เหลือ)
 * - คาบที่ไม่มีบันทึกผูกอยู่: ลบถาวร
 * - คาบที่มีเช็คชื่อ/บันทึกหลังสอน/สอนแทนผูกอยู่: ซ่อน (supersededAt) เก็บประวัติไว้
 * fail-closed: อ่านข้อมูลอ้างอิงไม่ครบ = throw ไม่ทำอะไรเลย
 */
export async function clearTeacherSchedules(
  staffId: string,
  schedules: { id: string; teacherIds?: string[]; teacherId?: string }[],
  actorUid: string | null,
): Promise<ClearTeacherSchedulesResult> {
  if (!staffId) throw new Error('ไม่ระบุครู');
  const referenced = new Set<string>();
  for (const ref of SCHEDULE_REFERENCING_COLLECTIONS) {
    const snap = await getDocs(collection(db, ref.collection));
    collectReferenceValues(snap.docs.map(d => d.data() as Record<string, any>), ref.fields, referenced);
  }

  const shared: typeof schedules = [];
  const solo: { id: string }[] = [];
  for (const s of schedules) {
    const others = (Array.isArray(s.teacherIds) ? s.teacherIds : []).filter(t => t && t !== staffId);
    (others.length > 0 ? shared : solo).push(s);
  }
  const { deletable, protectedDocs } = partitionStaleByReferences(solo, referenced);

  const ops: ((b: ReturnType<typeof writeBatch>) => void)[] = [];
  shared.forEach(s => {
    const others = (s.teacherIds || []).filter(t => t && t !== staffId);
    ops.push(b => b.update(doc(db, 'schedules', s.id), {
      teacherIds: arrayRemove(staffId),
      ...(s.teacherId === staffId ? { teacherId: others[0] } : {}),
      updatedAt: serverTimestamp(),
    }));
  });
  deletable.forEach(s => ops.push(b => b.delete(doc(db, 'schedules', s.id))));
  protectedDocs.forEach(s => ops.push(b => b.update(doc(db, 'schedules', s.id), {
    supersededAt: serverTimestamp(),
    supersededBy: actorUid,
    supersededReason: 'TEACHER_SCHEDULE_CLEARED',
  })));

  for (let i = 0; i < ops.length; i += 450) {
    const b = writeBatch(db);
    ops.slice(i, i + 450).forEach(op => op(b));
    await b.commit();
  }
  return { deleted: deletable.length, hidden: protectedDocs.length, detached: shared.length };
}
