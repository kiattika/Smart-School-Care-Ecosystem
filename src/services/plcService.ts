import { collection, deleteDoc, deleteField, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, type Query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { PlanQuery } from '../lib/lessonPlans';
import { validatePlc, type PlcContent, type PlcLog } from '../lib/plc';

const col = () => collection(db, 'plc_logs');

/** q ต้องตรงสิทธิ์ (planOverviewQuery ของ lessonPlans.ts หรือ SELF — ใช้ฟิลด์ authorStaffId สำหรับ SELF) */
export function subscribePlcLogs(semesterId: string, q: PlanQuery, cb: (list: PlcLog[]) => void, onError?: (e: Error) => void): () => void {
  const base = where('semesterId', '==', semesterId);
  const toList = (snap: { docs: { id: string; data: () => unknown }[] }) => snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PlcLog, 'id'>) }));
  if (q.scope === 'SELF') {
    // ของตนเอง = ที่ตนบันทึก + ที่ผู้อื่นบันทึกแล้วเลือกตนเป็นสมาชิก (2 query ที่ตรง rules ทั้งคู่ แล้วรวมตาม id)
    let mine: PlcLog[] | null = null; let asMember: PlcLog[] | null = null;
    const emit = () => {
      if (!mine || !asMember) return; // รอทั้งสอง query ก่อนแจ้งผล
      const m = new Map<string, PlcLog>();
      [...mine, ...asMember].forEach(l => m.set(l.id, l));
      cb([...m.values()]);
    };
    const u1 = onSnapshot(query(col(), base, where('authorStaffId', '==', q.staffId)), (snap) => { mine = toList(snap); emit(); }, (err) => onError?.(err));
    const u2 = onSnapshot(query(col(), base, where('memberStaffIds', 'array-contains', q.staffId)), (snap) => { asMember = toList(snap); emit(); }, (err) => onError?.(err));
    return () => { u1(); u2(); };
  }
  const built: Query = q.scope === 'ALL' ? query(col(), base) : query(col(), base, where('departmentId', '==', q.departmentId));
  return onSnapshot(built, (snap) => cb(toList(snap)), (err) => onError?.(err));
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
    memberStaffIds: c.memberStaffIds, members: c.members.map(m => m.trim().slice(0, 80)),
    summary: c.summary, outcome: c.outcome, nextAction: c.nextAction,
    evidenceUrls: c.evidenceUrls.map(u => u.trim()), photos: c.photos,
  };
  if (input.id) {
    // evidenceUrl (ฟิลด์เดี่ยวของเอกสารเก่า) ถูกแทนที่ด้วย evidenceUrls
    await updateDoc(doc(db, 'plc_logs', input.id), { ...content, evidenceUrl: deleteField(), updatedAt: serverTimestamp() });
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
