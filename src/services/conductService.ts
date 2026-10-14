import {
  collection, doc, onSnapshot, query, runTransaction, serverTimestamp, where, type DocumentData, type Query,
} from 'firebase/firestore';
import { format } from 'date-fns';
import { db } from '../lib/firebase';
import {
  nextConductFields, planConductEntry, validateChangeRequest, validatePoints,
  type ChangeAction, type ConductChangeRequest, type ConductEntry, type ConductInput, type OffenceLevel,
} from '../lib/conduct';

const ENTRIES = 'conduct_entries';
const CHANGES = 'conduct_change_requests';

export type Actor = { staffId: string; name: string; isAffairs: boolean };

const entryFrom = (id: string, x: DocumentData): ConductEntry => ({
  id, studentId: x.studentId, studentName: x.studentName || '', room: x.room || '', kind: x.kind, level: x.level, points: x.points,
  appliedPoints: x.appliedPoints ?? 0, status: x.status, reason: x.reason || '', category: x.category || '',
  createdByStaffId: x.createdByStaffId || '', createdByName: x.createdByName || '', decidedByName: x.decidedByName,
  decisionNote: x.decisionNote, date: x.date || '',
});
const changeFrom = (id: string, x: DocumentData): ConductChangeRequest => ({
  id, entryId: x.entryId, studentId: x.studentId, action: x.action, newPoints: x.newPoints ?? null, beforePoints: x.beforePoints ?? 0,
  reason: x.reason || '', status: x.status, requestedByName: x.requestedByName || '', decisionNote: x.decisionNote,
});

function watch<T>(q: Query, map: (id: string, d: DocumentData) => T, cb: (l: T[]) => void, onError?: (e: Error) => void) {
  return onSnapshot(q, snap => cb(snap.docs.map(d => map(d.id, d.data()))), e => onError?.(e));
}
const byDateDesc = (a: { date: string }, b: { date: string }) => b.date.localeCompare(a.date);

/** รายการรอพิจารณา (งานกิจการ) */
export const subscribePendingConduct = (cb: (l: ConductEntry[]) => void, onError?: (e: Error) => void) =>
  watch(query(collection(db, ENTRIES), where('status', '==', 'PENDING')), entryFrom, l => cb(l.sort(byDateDesc)), onError);
/** รายการของนักเรียนคนหนึ่ง (งานกิจการ/ครูที่ปรึกษาห้องนั้น) */
export const subscribeConductForStudent = (studentId: string, cb: (l: ConductEntry[]) => void, onError?: (e: Error) => void) =>
  watch(query(collection(db, ENTRIES), where('studentId', '==', studentId)), entryFrom, l => cb(l.sort(byDateDesc)), onError);
/** รายการที่ฉันบันทึก (ใช้ขอแก้/ลบ) — rules: ผู้บันทึกอ่านของตัวเองได้ */
export const subscribeMyConduct = (staffId: string, cb: (l: ConductEntry[]) => void, onError?: (e: Error) => void) =>
  watch(query(collection(db, ENTRIES), where('createdByStaffId', '==', staffId)), entryFrom, l => cb(l.sort(byDateDesc)), onError);
/** นักเรียน/ผู้ปกครอง: ประวัติของตัวเอง/บุตรหลาน (rules เทียบ studentUid/parentUid ในเอกสาร) */
export const subscribeConductForOwner = (filter: { studentUid?: string; parentUid?: string }, cb: (l: ConductEntry[]) => void, onError?: (e: Error) => void) => {
  const c = filter.studentUid ? where('studentUid', '==', filter.studentUid) : filter.parentUid ? where('parentUid', '==', filter.parentUid) : null;
  if (!c) { cb([]); return () => {}; }
  return watch(query(collection(db, ENTRIES), c), entryFrom, l => cb(l.sort(byDateDesc)), onError);
};
export const subscribePendingChanges = (cb: (l: ConductChangeRequest[]) => void, onError?: (e: Error) => void) =>
  watch(query(collection(db, CHANGES), where('status', '==', 'PENDING')), changeFrom, cb, onError);
export const subscribeMyChanges = (staffId: string, cb: (l: ConductChangeRequest[]) => void, onError?: (e: Error) => void) =>
  watch(query(collection(db, CHANGES), where('requestedByStaffId', '==', staffId)), changeFrom, cb, onError);

/**
 * บันทึกคะแนน: ครู ≤5 = มีผลทันที (เขียนรายการ + แคช students ในธุรกรรมเดียว), >5 = ส่งงานกิจการ (PENDING);
 * งานกิจการ = มีผลทันที (หักตามระดับ เบา ≤5 / กลาง ≤10 / ร้ายแรง ≤20)
 */
export async function submitConduct(studentId: string, input: ConductInput, actor: Actor): Promise<'APPLIED' | 'PENDING'> {
  if (!actor.staffId) throw new Error('บัญชีนี้ไม่ได้เชื่อมกับทะเบียนบุคลากร');
  const plan = planConductEntry(input, actor.isAffairs);
  if ('error' in plan) throw new Error(plan.error);
  const apply = plan.mode === 'APPLY';
  const studentRef = doc(db, 'students', studentId);
  const entryRef = doc(collection(db, ENTRIES));
  await runTransaction(db, async tx => {
    const snap = await tx.get(studentRef);
    if (!snap.exists()) throw new Error('ไม่พบนักเรียน');
    const s = snap.data();
    tx.set(entryRef, {
      studentId, studentName: String(s.fullName || s.name || '').slice(0, 160), studentUid: typeof s.studentUid === 'string' ? s.studentUid : '',
      parentUid: typeof s.parentUid === 'string' && s.parentUid ? s.parentUid : null, room: String(s.room || ''),
      kind: input.kind, level: input.level, points: input.points, appliedPoints: apply ? input.points : 0, status: apply ? 'APPLIED' : 'PENDING',
      reason: input.reason.trim(), category: input.category.trim(), date: format(new Date(), 'yyyy-MM-dd'),
      createdByStaffId: actor.staffId, createdByName: actor.name.slice(0, 160), createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    if (apply) {
      const after = { status: 'APPLIED' as const, kind: input.kind, appliedPoints: input.points };
      tx.update(studentRef, { ...nextConductFields(s, null, after), lastConductEntryId: entryRef.id, updatedAt: serverTimestamp() });
    }
  });
  return apply ? 'APPLIED' : 'PENDING';
}

/** งานกิจการพิจารณารายการที่ส่งมา — อนุมัติ (กำหนดคะแนน/ระดับที่มีผลจริง) หรือไม่อนุมัติ */
export async function resolveConduct(
  entryId: string,
  d: { approve: boolean; appliedPoints: number; level: OffenceLevel; note: string },
  actor: Actor,
): Promise<void> {
  const entryRef = doc(db, ENTRIES, entryId);
  await runTransaction(db, async tx => {
    const es = await tx.get(entryRef);
    if (!es.exists()) throw new Error('ไม่พบรายการ');
    const e = es.data();
    if (e.status !== 'PENDING') throw new Error('รายการนี้ถูกพิจารณาแล้ว');
    const common = { decidedByStaffId: actor.staffId, decidedByName: actor.name.slice(0, 160), decidedAt: serverTimestamp(), decisionNote: d.note.trim().slice(0, 500), updatedAt: serverTimestamp() };
    if (!d.approve) { tx.update(entryRef, { status: 'REJECTED', appliedPoints: 0, level: e.level, ...common }); return; }
    const err = validatePoints(e.kind, d.level, d.appliedPoints);
    if (err) throw new Error(err);
    const studentRef = doc(db, 'students', e.studentId);
    const ss = await tx.get(studentRef);
    if (!ss.exists()) throw new Error('ไม่พบนักเรียน');
    tx.update(entryRef, { status: 'APPLIED', appliedPoints: d.appliedPoints, level: d.level, ...common });
    tx.update(studentRef, {
      ...nextConductFields(ss.data(), null, { status: 'APPLIED', kind: e.kind, appliedPoints: d.appliedPoints }),
      lastConductEntryId: entryId, updatedAt: serverTimestamp(),
    });
  });
}

/** ผู้บันทึกยื่นคำร้องขอแก้/ยกเลิกรายการของตน (พร้อมเหตุผล) — งานกิจการเป็นผู้อนุมัติ */
export async function requestConductChange(entry: ConductEntry, c: { action: ChangeAction; newPoints: number | null; reason: string }, actor: Actor): Promise<void> {
  const err = validateChangeRequest(entry, c);
  if (err) throw new Error(err);
  const ref = doc(collection(db, CHANGES));
  await runTransaction(db, async tx => {
    tx.set(ref, {
      entryId: entry.id, studentId: entry.studentId, action: c.action, newPoints: c.action === 'EDIT' ? c.newPoints : null, beforePoints: entry.appliedPoints,
      reason: c.reason.trim(), status: 'PENDING', requestedByStaffId: actor.staffId, requestedByName: actor.name.slice(0, 160),
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
  });
}

/** งานกิจการพิจารณาคำร้อง: อนุมัติ = แก้คะแนน/ยกเลิกรายการ + ปรับแคชคะแนน (ธุรกรรมเดียว) — ประวัติอยู่ในคำร้อง ไม่ลบรายการจริง */
export async function decideConductChange(req: ConductChangeRequest, d: { approve: boolean; note: string }, actor: Actor): Promise<void> {
  const reqRef = doc(db, CHANGES, req.id);
  const entryRef = doc(db, ENTRIES, req.entryId);
  await runTransaction(db, async tx => {
    const [rs, es] = await Promise.all([tx.get(reqRef), tx.get(entryRef)]);
    if (!rs.exists() || !es.exists()) throw new Error('ไม่พบคำร้อง/รายการ');
    if (rs.data().status !== 'PENDING') throw new Error('คำร้องนี้ถูกพิจารณาแล้ว');
    const e = es.data();
    const decided = { decidedByStaffId: actor.staffId, decidedByName: actor.name.slice(0, 160), decidedAt: serverTimestamp(), decisionNote: d.note.trim().slice(0, 500), updatedAt: serverTimestamp() };
    if (!d.approve) { tx.update(reqRef, { status: 'REJECTED', ...decided }); return; }
    if (e.status !== 'APPLIED') throw new Error('รายการนี้ไม่มีผลแล้ว แก้ไม่ได้');
    const studentRef = doc(db, 'students', e.studentId);
    const ss = await tx.get(studentRef);
    if (!ss.exists()) throw new Error('ไม่พบนักเรียน');
    const before = { status: 'APPLIED' as const, kind: e.kind, appliedPoints: e.appliedPoints as number };
    let after: typeof before | { status: 'REVERSED'; kind: typeof e.kind; appliedPoints: number };
    if (req.action === 'DELETE') {
      after = { status: 'REVERSED', kind: e.kind, appliedPoints: e.appliedPoints };
      tx.update(entryRef, { status: 'REVERSED', lastChangeRequestId: req.id, updatedAt: serverTimestamp() });
    } else {
      const np = req.newPoints as number;
      const err = validatePoints(e.kind, e.level, np);
      if (err) throw new Error(err);
      after = { status: 'APPLIED', kind: e.kind, appliedPoints: np };
      tx.update(entryRef, { appliedPoints: np, lastChangeRequestId: req.id, updatedAt: serverTimestamp() });
    }
    tx.update(reqRef, { status: 'APPROVED', ...decided });
    tx.update(studentRef, { ...nextConductFields(ss.data(), before, after), lastConductEntryId: req.entryId, updatedAt: serverTimestamp() });
  });
}
