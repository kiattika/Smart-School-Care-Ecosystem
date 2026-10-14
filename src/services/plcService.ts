import { collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, type Query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { PlanQuery } from '../lib/lessonPlans';
import { validatePlc, type PlcContent, type PlcLog } from '../lib/plc';

const col = () => collection(db, 'plc_logs');

/** q ต้องตรงสิทธิ์ (planOverviewQuery ของ lessonPlans.ts หรือ SELF — ใช้ฟิลด์ authorStaffId สำหรับ SELF) */
export function subscribePlcLogs(semesterId: string, q: PlanQuery, cb: (list: PlcLog[]) => void, onError?: (e: Error) => void): () => void {
  const base = where('semesterId', '==', semesterId);
  const built: Query =
    q.scope === 'ALL' ? query(col(), base)
      : q.scope === 'DEPARTMENT' ? query(col(), base, where('departmentId', '==', q.departmentId))
        : query(col(), base, where('authorStaffId', '==', q.staffId));
  return onSnapshot(built, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PlcLog, 'id'>) }))), (err) => onError?.(err));
}

export interface SavePlcInput {
  semester: { academicYear: string; term: '1' | '2' };
  author: { staffId: string; name: string; departmentId: string };
  content: PlcContent;
  /** แก้ไขเอกสารเดิม = ส่ง id; สร้างใหม่ = ไม่ส่ง */
  id?: string;
}

export async function savePlcLog(input: SavePlcInput): Promise<string> {
  const problems = validatePlc(input.content);
  if (problems.length > 0) throw new Error(problems[0]);
  const c = input.content;
  const content = {
    groupName: c.groupName.trim(), topic: c.topic.trim(), meetingDate: c.meetingDate, step: c.step,
    members: c.members.map(m => m.trim()).filter(Boolean), summary: c.summary, outcome: c.outcome, nextAction: c.nextAction, evidenceUrl: c.evidenceUrl.trim(),
  };
  if (input.id) {
    await updateDoc(doc(db, 'plc_logs', input.id), { ...content, updatedAt: serverTimestamp() });
    return input.id;
  }
  const ref = doc(col());
  await setDoc(ref, {
    semesterId: `${input.semester.academicYear}_${input.semester.term}`, academicYear: input.semester.academicYear, term: input.semester.term,
    authorStaffId: input.author.staffId, authorName: input.author.name.slice(0, 160), departmentId: input.author.departmentId,
    ...content, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deletePlcLog(id: string): Promise<void> { await deleteDoc(doc(db, 'plc_logs', id)); }
