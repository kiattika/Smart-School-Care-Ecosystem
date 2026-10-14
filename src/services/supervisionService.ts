/**
 * บริการระบบนิเทศการสอน (Firestore) — รอบนิเทศ / จับคู่ผู้นิเทศ / ผลสังเกตการสอน
 * ตรรกะคิดคะแนน/สิทธิ์อยู่ src/lib/supervision.ts; สิทธิ์จริงบังคับที่ firestore.rules บล็อก 39
 * ทุกฟังก์ชันเขียน throw เมื่อไม่สำเร็จ (ห้ามกลืน error แล้วแจ้งสำเร็จ)
 */
import {
  collection, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, deleteDoc, where,
  type Query,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  assignmentId, buildObservationFields, observationId, supervisionRoundId, validateForSubmit,
  type ObservationFormInput, type SupervisionAssignment, type SupervisionObservation, type SupervisionRound,
  type SupervisionReadScope, type SupervisionTerm,
} from '../lib/supervision';

type Unsub = () => void;

// ───────── รอบนิเทศ ─────────

export function subscribeSupervisionRounds(cb: (rounds: SupervisionRound[]) => void, onError?: (e: Error) => void): Unsub {
  return onSnapshot(
    collection(db, 'supervision_rounds'),
    (snap) => {
      const list = snap.docs
        .map(d => ({ id: d.id, ...(d.data() as Omit<SupervisionRound, 'id'>) }))
        .sort((a, b) => b.id.localeCompare(a.id));
      cb(list);
    },
    (err) => onError?.(err),
  );
}

/** เปิดรอบ (1 ภาคเรียน = 1 รอบ) — มีรอบนั้นอยู่แล้วจะ throw ไม่เขียนทับ */
export async function openSupervisionRound(academicYear: string, term: SupervisionTerm, openedByStaffId: string): Promise<string> {
  if (!/^\d{4}$/.test(academicYear)) throw new Error('ปีการศึกษาไม่ถูกต้อง');
  const id = supervisionRoundId(academicYear, term);
  const ref = doc(db, 'supervision_rounds', id);
  if ((await getDoc(ref)).exists()) throw new Error(`รอบนิเทศ ${term}/${academicYear} มีอยู่แล้ว`);
  await setDoc(ref, { academicYear, term, status: 'OPEN', openedByStaffId, createdAt: serverTimestamp() });
  return id;
}

export async function setSupervisionRoundStatus(roundId: string, status: 'OPEN' | 'CLOSED'): Promise<void> {
  await updateDoc(doc(db, 'supervision_rounds', roundId), { status });
}

// ───────── การจับคู่ ─────────

export type AssignmentQuery = { kind: 'ALL' } | { kind: 'SUPERVISOR'; staffId: string } | { kind: 'TEACHER'; staffId: string };

export function subscribeSupervisionAssignments(
  roundId: string, q: AssignmentQuery, cb: (list: SupervisionAssignment[]) => void, onError?: (e: Error) => void,
): Unsub {
  const col = collection(db, 'supervision_assignments');
  const base = where('roundId', '==', roundId);
  const built: Query =
    q.kind === 'ALL' ? query(col, base)
      : q.kind === 'SUPERVISOR' ? query(col, base, where('supervisorStaffId', '==', q.staffId))
        : query(col, base, where('teacherStaffId', '==', q.staffId));
  return onSnapshot(
    built,
    (snap) => cb(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<SupervisionAssignment, 'id'>) }))),
    (err) => onError?.(err),
  );
}

export async function addSupervisionAssignment(roundId: string, teacherStaffId: string, supervisorStaffId: string): Promise<void> {
  if (teacherStaffId === supervisorStaffId) throw new Error('ผู้นิเทศนิเทศตัวเองไม่ได้');
  await setDoc(doc(db, 'supervision_assignments', assignmentId(roundId, teacherStaffId, supervisorStaffId)), {
    roundId, teacherStaffId, supervisorStaffId, createdAt: serverTimestamp(),
  });
}

export async function removeSupervisionAssignment(id: string): Promise<void> {
  await deleteDoc(doc(db, 'supervision_assignments', id));
}

// ───────── ผลสังเกตการสอน ─────────

export type ObservationQuery =
  | { scope: Extract<SupervisionReadScope, 'ALL'>; submittedOnly: boolean }       // หัวหน้างานนิเทศ = ทั้งหมดรวมร่าง; ผอ./รองผอ. = เฉพาะที่ส่งแล้ว
  | { scope: 'DEPARTMENT'; departmentId: string }                                  // หัวหน้า/รองหัวหน้ากลุ่มสาระฯ (ส่งแล้วเท่านั้น)
  | { scope: 'SUPERVISED'; staffId: string }                                       // ครูนิเทศ: ที่ตนเองนิเทศ (รวมร่าง)
  | { scope: 'SELF'; staffId: string };                                            // ผู้รับการนิเทศ: ของตนเอง (ส่งแล้วเท่านั้น)

/** query ต้องมีเงื่อนไขตรงกับ rules เสมอ (ไม่งั้น permission-denied แม้เอกสารจะเป็นของตนเอง) */
export function subscribeSupervisionObservations(
  roundId: string, q: ObservationQuery, cb: (list: SupervisionObservation[]) => void, onError?: (e: Error) => void,
): Unsub {
  const col = collection(db, 'supervision_observations');
  const base = where('roundId', '==', roundId);
  let built: Query;
  switch (q.scope) {
    case 'ALL':
      built = q.submittedOnly ? query(col, base, where('submitted', '==', true)) : query(col, base);
      break;
    case 'DEPARTMENT':
      built = query(col, base, where('departmentId', '==', q.departmentId), where('submitted', '==', true));
      break;
    case 'SUPERVISED':
      built = query(col, base, where('supervisorStaffId', '==', q.staffId));
      break;
    case 'SELF':
      built = query(col, base, where('teacherStaffId', '==', q.staffId), where('submitted', '==', true));
      break;
  }
  return onSnapshot(
    built,
    (snap) => cb(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<SupervisionObservation, 'id'>) }))),
    (err) => onError?.(err),
  );
}

/**
 * บันทึกฉบับร่าง (submit=false) หรือส่งผล (submit=true; ล็อกคะแนน) — 1 ผลต่อครู 1 คนต่อรอบ (doc id ตายตัว)
 * ส่งผลโดยคะแนนไม่ครบ/ไม่ระบุวิชา/วันที่ = throw ก่อนเขียน
 */
export async function saveSupervisionObservation(input: ObservationFormInput, opts: { submit: boolean; exists: boolean }): Promise<string> {
  if (opts.submit) {
    const problem = validateForSubmit(input);
    if (problem) throw new Error(problem);
  }
  const id = observationId(input.roundId, input.teacher.staffId);
  const fields = buildObservationFields(input, opts.submit);
  const ref = doc(db, 'supervision_observations', id);
  const stamps: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (opts.submit) stamps.submittedAt = serverTimestamp();
  if (opts.exists) {
    // ฉบับร่างเดิม: เขียนทับทั้งเอกสาร (rules ตรวจฟิลด์ที่เปลี่ยนไม่ได้ว่าไม่ถูกแก้) — เก็บ createdAt เดิมไว้
    const prev = await getDoc(ref);
    if (!prev.exists()) throw new Error('ไม่พบฉบับร่างเดิม');
    await setDoc(ref, { ...fields, ...stamps, createdAt: prev.data().createdAt });
  } else {
    await setDoc(ref, { ...fields, ...stamps, createdAt: serverTimestamp() });
  }
  return id;
}

export async function deleteSupervisionDraft(id: string): Promise<void> {
  await deleteDoc(doc(db, 'supervision_observations', id));
}

/** ครูผู้รับการนิเทศกดรับทราบ (+ความเห็นตอบกลับ) — แทนการลงชื่อบนกระดาษ */
export async function acknowledgeSupervisionObservation(id: string, teacherReply: string): Promise<void> {
  await updateDoc(doc(db, 'supervision_observations', id), {
    acknowledged: true,
    acknowledgedAt: serverTimestamp(),
    teacherReply: (teacherReply || '').trim().slice(0, 1000),
    updatedAt: serverTimestamp(),
  });
}
