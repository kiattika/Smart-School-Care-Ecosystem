import { collection, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  canExpressInterest, canStaffSetInterest, dayEndExclusive, dayStart, fundInterestId, validateFundProgramInput,
  INTEREST_NOTE_MAX, type FundInterest, type FundKind, type FundProgram, type FundProgramInput, type FundStatus, type InterestStatus,
} from '../lib/fundPrograms';

const PROGRAMS = 'fund_programs';
const INTERESTS = 'fund_interests';
type By = { staffId: string; name: string };

const programFrom = (id: string, x: Record<string, any>): FundProgram => ({
  id, kind: x.kind, title: x.title || '', funder: x.funder || '', description: x.description || '', eligibility: x.eligibility || '',
  amountText: x.amountText || '', selectionNote: x.selectionNote || '', links: Array.isArray(x.links) ? x.links : [],
  status: x.status, registrationEnabled: x.registrationEnabled === true,
  registrationOpensAt: x.registrationOpensAt ?? null, registrationClosesAt: x.registrationClosesAt ?? null,
});
const interestFrom = (id: string, x: Record<string, any>): FundInterest => ({
  id, programId: x.programId, studentId: x.studentId, studentName: x.studentName, room: x.room, kind: x.kind,
  status: x.status, note: x.note || '', staffNote: x.staffNote,
});

/** บุคลากรงานกองทุน/แนะแนว: อ่านทุกสถานะ; นักเรียน/ผู้ปกครอง: เฉพาะที่ประกาศแล้ว (query ต้องตรง rules) */
export function subscribeFundPrograms(kind: FundKind, scope: 'STAFF' | 'PUBLISHED', cb: (l: FundProgram[]) => void, onError?: (e: Error) => void): () => void {
  const q = scope === 'STAFF'
    ? query(collection(db, PROGRAMS), where('kind', '==', kind))
    : query(collection(db, PROGRAMS), where('kind', '==', kind), where('status', '==', 'PUBLISHED'));
  return onSnapshot(q, snap => cb(snap.docs.map(d => programFrom(d.id, d.data())).sort((a, b) => a.title.localeCompare(b.title, 'th'))), e => onError?.(e));
}

/** สร้าง/แก้โปรแกรม — throw เมื่อเขียนไม่สำเร็จ (ห้ามแจ้งสำเร็จเอง) */
export async function saveFundProgram(existingId: string | null, input: FundProgramInput, status: FundStatus, by: By): Promise<string> {
  if (!by.staffId) throw new Error('บัญชีนี้ไม่ได้เชื่อมกับทะเบียนบุคลากร');
  const errs = validateFundProgramInput(input);
  if (errs.length) throw new Error(errs.join(' / '));
  const ref = existingId ? doc(db, PROGRAMS, existingId) : doc(collection(db, PROGRAMS));
  const body = {
    kind: input.kind, title: input.title.trim(), funder: input.funder.trim(), description: input.description.trim(),
    eligibility: input.eligibility.trim(), amountText: input.amountText.trim(), selectionNote: input.selectionNote.trim(),
    links: input.links.map(l => l.trim()), status, registrationEnabled: input.registrationEnabled,
    registrationOpensAt: dayStart(input.opensYmd), registrationClosesAt: dayEndExclusive(input.closesYmd),
    updatedAt: serverTimestamp(),
  };
  if (existingId) await updateDoc(ref, body);
  else await setDoc(ref, { ...body, id: ref.id, createdByStaffId: by.staffId, createdByName: by.name.slice(0, 160), createdAt: serverTimestamp() });
  return ref.id;
}

export async function setFundStatus(programId: string, status: FundStatus): Promise<void> {
  await updateDoc(doc(db, PROGRAMS, programId), { status, updatedAt: serverTimestamp() });
}
export async function deleteDraftFund(programId: string): Promise<void> {
  await deleteDoc(doc(db, PROGRAMS, programId));
}

export function subscribeInterestsForProgram(programId: string, cb: (l: FundInterest[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(query(collection(db, INTERESTS), where('programId', '==', programId)), snap => cb(snap.docs.map(d => interestFrom(d.id, d.data()))), e => onError?.(e));
}
export function subscribeInterestsForStudent(studentId: string, cb: (l: FundInterest[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(query(collection(db, INTERESTS), where('studentId', '==', studentId)), snap => cb(snap.docs.map(d => interestFrom(d.id, d.data()))), e => onError?.(e));
}

/** นักเรียน/ผู้ปกครองลงชื่อสนใจ (หรือกลับมาลงใหม่หลังถอน) — ห้อง/uid ประทับจากทะเบียนนักเรียนจริง */
export async function expressInterest(program: FundProgram, student: { studentId: string; name: string }, note: string): Promise<void> {
  if (!canExpressInterest(program, Date.now())) throw new Error('โครงการนี้ไม่ได้เปิดให้ลงชื่อสนใจในขณะนี้');
  if (note.length > INTEREST_NOTE_MAX) throw new Error(`หมายเหตุยาวเกิน ${INTEREST_NOTE_MAX} ตัวอักษร`);
  const reg = await getDoc(doc(db, 'students', student.studentId));
  if (!reg.exists()) throw new Error('ไม่พบนักเรียน');
  const s = reg.data();
  if (!s.studentUid) throw new Error('ยังไม่มีบัญชีนักเรียนที่เชื่อมกับรหัสนี้ — ติดต่อโรงเรียน');
  const ref = doc(db, INTERESTS, fundInterestId(program.id, student.studentId));
  const prev = await getDoc(ref);
  const body = {
    programId: program.id, studentId: student.studentId, studentUid: s.studentUid, studentName: student.name.slice(0, 160),
    room: String(s.room || ''), kind: program.kind, status: 'INTERESTED' as InterestStatus, note: note.trim(), updatedAt: serverTimestamp(),
  };
  if (prev.exists()) await updateDoc(ref, { status: 'INTERESTED' as InterestStatus, note: note.trim(), updatedAt: serverTimestamp() }); // rules: แก้ได้เฉพาะ status/note
  else await setDoc(ref, { ...body, createdAt: serverTimestamp() });
}

export async function withdrawInterest(programId: string, studentId: string): Promise<void> {
  await updateDoc(doc(db, INTERESTS, fundInterestId(programId, studentId)), { status: 'WITHDRAWN', updatedAt: serverTimestamp() });
}

/** งานกองทุนบันทึกผลคัดเลือก (หมายเหตุถึงนักเรียน/ภายใน ≤500) */
export async function decideInterest(interest: FundInterest, to: InterestStatus, staffNote: string, by: By): Promise<void> {
  if (!by.staffId) throw new Error('บัญชีนี้ไม่ได้เชื่อมกับทะเบียนบุคลากร');
  if (!canStaffSetInterest(interest.status, to)) throw new Error('เปลี่ยนสถานะนี้ไม่ได้จากสถานะปัจจุบัน');
  if (staffNote.length > INTEREST_NOTE_MAX) throw new Error(`หมายเหตุยาวเกิน ${INTEREST_NOTE_MAX} ตัวอักษร`);
  await updateDoc(doc(db, INTERESTS, interest.id), {
    status: to, staffNote: staffNote.trim(), decidedByStaffId: by.staffId, decidedByName: by.name.slice(0, 160), updatedAt: serverTimestamp(),
  });
}
