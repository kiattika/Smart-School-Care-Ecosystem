import { collection, doc, getDoc, onSnapshot, query, serverTimestamp, updateDoc, where, writeBatch, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  validateTransferApply, validateTransferDecision, validateTransferRequest, type RoomTransfer, type TransferStatus,
} from '../lib/roomTransfer';

const COL = 'room_transfers';
type By = { staffId: string; name: string };

const fromDoc = (id: string, x: Record<string, any>): RoomTransfer => ({
  id, studentId: x.studentId, studentName: x.studentName || '', fromRoom: x.fromRoom, toRoom: x.toRoom,
  fromHouseId: x.fromHouseId ?? null, toHouseId: x.toHouseId ?? null, reason: x.reason || '', status: x.status as TransferStatus,
  requestedByName: x.requestedByName || '', decisionCommittee: x.decisionCommittee, decisionDate: x.decisionDate,
  decisionNote: x.decisionNote, decidedByName: x.decidedByName, effectiveDate: x.effectiveDate,
});

export function subscribeRoomTransfers(cb: (l: RoomTransfer[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(collection(db, COL), snap => cb(snap.docs.map(d => fromDoc(d.id, d.data()))), e => onError?.(e));
}
export function subscribeRoomTransfersForStudent(studentId: string, cb: (l: RoomTransfer[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(query(collection(db, COL), where('studentId', '==', studentId)), snap => cb(snap.docs.map(d => fromDoc(d.id, d.data()))), e => onError?.(e));
}

/** ยื่นคำขอย้ายห้อง — ห้อง/คณะสีเดิมประทับจากทะเบียนนักเรียนจริง; คณะสีใหม่ = คณะสีของห้องปลายทาง (null = ยังไม่จัด) */
export async function requestRoomTransfer(input: { studentId: string; studentName: string; toRoom: string; toHouseId: string | null; reason: string }, by: By): Promise<void> {
  if (!by.staffId) throw new Error('บัญชีนี้ไม่ได้เชื่อมกับทะเบียนบุคลากร');
  const snap = await getDoc(doc(db, 'students', input.studentId));
  if (!snap.exists()) throw new Error('ไม่พบนักเรียน');
  const s = snap.data();
  const fromRoom = String(s.room || '');
  const err = validateTransferRequest({ studentId: input.studentId, fromRoom, toRoom: input.toRoom, reason: input.reason });
  if (err) throw new Error(err);
  await addDoc(collection(db, COL), {
    studentId: input.studentId, studentName: input.studentName.slice(0, 160), fromRoom, toRoom: input.toRoom.trim(),
    fromHouseId: typeof s.houseId === 'string' && s.houseId ? s.houseId : null, toHouseId: input.toHouseId || null,
    reason: input.reason.trim(), status: 'PENDING', requestedByStaffId: by.staffId, requestedByName: by.name.slice(0, 160),
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
}

/** บันทึกมติคณะกรรมการ (เฉพาะงานทะเบียนวัดผล) */
export async function decideRoomTransfer(id: string, d: { decision: 'APPROVED' | 'REJECTED'; committee: string; date: string; note: string }, by: By): Promise<void> {
  const err = validateTransferDecision(d);
  if (err) throw new Error(err);
  await updateDoc(doc(db, COL, id), {
    status: d.decision, decisionCommittee: d.committee.trim(), decisionDate: d.date, decisionNote: d.note.trim(),
    decidedByStaffId: by.staffId, decidedByName: by.name.slice(0, 160), decidedAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
}

/** ดำเนินการย้ายจริง: อัปเดตห้อง/คณะสีของนักเรียน + ปิดคำขอเป็น APPLIED ในชุดเขียนเดียว (ประวัติห้องเดิมอยู่ในคำขอ) */
export async function applyRoomTransfer(t: RoomTransfer, effectiveDate: string, by: By): Promise<void> {
  const err = validateTransferApply(effectiveDate);
  if (err) throw new Error(err);
  if (t.status !== 'APPROVED') throw new Error('ต้องผ่านการอนุมัติก่อน');
  const b = writeBatch(db);
  b.update(doc(db, 'students', t.studentId), { room: t.toRoom, houseId: t.toHouseId ?? null, roomTransferId: t.id, updatedAt: serverTimestamp() });
  b.update(doc(db, COL, t.id), {
    status: 'APPLIED', effectiveDate, appliedByStaffId: by.staffId, appliedByName: by.name.slice(0, 160), appliedAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  await b.commit();
}
