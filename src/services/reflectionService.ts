import { collection, deleteDoc, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, type Query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { PlanQuery } from '../lib/lessonPlans';
import { reflectionId, validateReflection, type Reflection, type ReflectionContent } from '../lib/reflection';

const col = () => collection(db, 'teaching_reflections');

export function subscribeReflections(semesterId: string, q: PlanQuery, cb: (list: Reflection[]) => void, onError?: (e: Error) => void): () => void {
  const base = where('semesterId', '==', semesterId);
  const built: Query =
    q.scope === 'ALL' ? query(col(), base)
      : q.scope === 'DEPARTMENT' ? query(col(), base, where('departmentId', '==', q.departmentId))
        : query(col(), base, where('teacherStaffId', '==', q.staffId));
  return onSnapshot(built, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Reflection, 'id'>) }))), (err) => onError?.(err));
}

export interface SaveReflectionInput {
  semester: { academicYear: string; term: '1' | '2' };
  teacher: { staffId: string; name: string; departmentId: string };
  content: ReflectionContent;
}

/** บันทึกสะท้อนคิดของภาคเรียน (สร้างครั้งแรก/แก้ไข) — ตรวจว่ามีเอกสารอยู่หรือไม่จาก Firestore จริง ไม่เดา */
export async function saveReflection(input: SaveReflectionInput): Promise<string> {
  const problems = validateReflection(input.content);
  if (problems.length > 0) throw new Error(problems[0]);
  const semesterId = `${input.semester.academicYear}_${input.semester.term}`;
  const id = reflectionId(semesterId, input.teacher.staffId);
  const ref = doc(db, 'teaching_reflections', id);
  const exists = (await getDoc(ref)).exists();
  if (exists) {
    await updateDoc(ref, { ...input.content, updatedAt: serverTimestamp() });
  } else {
    await setDoc(ref, {
      semesterId, academicYear: input.semester.academicYear, term: input.semester.term,
      teacherStaffId: input.teacher.staffId, teacherName: input.teacher.name.slice(0, 160), departmentId: input.teacher.departmentId,
      ...input.content, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
  }
  return id;
}
export async function deleteReflection(id: string): Promise<void> { await deleteDoc(doc(db, 'teaching_reflections', id)); }
