/**
 * วงจรสถานะนักเรียน + ทะเบียนเลขประจำตัว (Firestore) — ห้ามลบเอกสารนักเรียน เปลี่ยนสถานะแทน
 * ทุกการเขียนเป็น transaction เดียว (students + student_id_registry ไปด้วยกัน) logic ล้วนอยู่ที่
 * src/lib/studentStatus.ts / studentIdRegistry.ts
 */
import { doc, getDoc, runTransaction, serverTimestamp, Timestamp, type DocumentData } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import {
  statusFieldsFor, validateStatusChange, currentStatusReason, isStudentActive, type StudentStatusReason,
} from '../lib/studentStatus';
import {
  applyStatusChange, assignId, detectIdConflict, todayISO, type IdConflict, type RegistryEntry, type RegistryDoc,
} from '../lib/studentIdRegistry';

const REGISTRY = 'student_id_registry';

function requireUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('ไม่พบผู้ใช้ที่ล็อกอิน — ไม่สามารถบันทึกได้');
  return uid;
}

function toISODate(v: unknown): string | null {
  if (v instanceof Timestamp) return todayISO(v.toDate());
  if (v && typeof (v as { toDate?: unknown }).toDate === 'function') return todayISO((v as { toDate: () => Date }).toDate());
  return null;
}

const holderName = (d: DocumentData): string => d.fullName || d.name || `นักเรียน ${d.studentId ?? ''}`.trim();

function entriesOf(data: DocumentData | undefined): RegistryEntry[] {
  return Array.isArray(data?.entries) ? (data!.entries as RegistryEntry[]) : [];
}

/** เปลี่ยนสถานะนักเรียน + อัปเดตทะเบียนเลขประจำตัวในธุรกรรมเดียว */
export async function changeStudentStatus(args: { studentDocId: string; target: StudentStatusReason; note: string }): Promise<void> {
  const uid = requireUid();
  const studentRef = doc(db, 'students', args.studentDocId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(studentRef);
    if (!snap.exists()) throw new Error('ไม่พบเอกสารนักเรียน');
    const data = snap.data();
    const studentId: string = data.studentId || snap.id;
    const check = validateStatusChange(args.target, args.note, data);
    if ('error' in check) throw new Error(check.error);

    const regRef = doc(db, REGISTRY, studentId);
    const regSnap = await tx.get(regRef);
    const entries = applyStatusChange(entriesOf(regSnap.data()), {
      heldBy: holderName(data),
      previous: data,
      target: args.target,
      at: todayISO(),
      knownFrom: toISODate(data.createdAt),
    });

    tx.update(studentRef, {
      ...statusFieldsFor(args.target, args.note, uid),
      statusChangedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    tx.set(regRef, { studentId, entries, updatedAt: serverTimestamp() }, { merge: true });
  });
}

/** ตรวจเลขประจำตัวก่อนเพิ่มนักเรียนใหม่ (อ่านอย่างเดียว) */
export async function checkStudentIdConflict(studentId: string): Promise<IdConflict> {
  const [studentSnap, regSnap] = await Promise.all([
    getDoc(doc(db, 'students', studentId)),
    getDoc(doc(db, REGISTRY, studentId)),
  ]);
  const registry: RegistryDoc | null = regSnap.exists() ? { studentId, entries: entriesOf(regSnap.data()) } : null;
  return detectIdConflict(registry, studentSnap.exists() ? { ...studentSnap.data(), fullName: holderName(studentSnap.data()) } : null);
}

/**
 * เพิ่มนักเรียนใหม่ + ลงทะเบียนเลขประจำตัว (ธุรกรรมเดียว)
 * ถ้า students/{id} เดิมเป็นนักเรียนที่ไม่ได้ศึกษาต่อแล้ว: เก็บสำเนาเอกสารเดิมไว้ที่
 * student_id_registry/{id}/archived_records แล้วเขียนเอกสารใหม่แทนทั้งฉบับ (ไม่ merge) —
 * ไม่ให้ข้อมูล/การผูกบัญชีผู้ปกครองของคนก่อนปนไปกับคนใหม่
 */
export async function createStudentWithRegistry(args: { studentId: string; payload: Record<string, unknown>; fullName: string }): Promise<{ reassigned: boolean }> {
  const uid = requireUid();
  const studentRef = doc(db, 'students', args.studentId);
  const regRef = doc(db, REGISTRY, args.studentId);
  return runTransaction(db, async (tx) => {
    const [snap, regSnap] = await Promise.all([tx.get(studentRef), tx.get(regRef)]);
    let entries = entriesOf(regSnap.data());
    const at = todayISO();
    const existing = snap.exists() ? snap.data() : null;
    const reassign = !!existing && !isStudentActive(existing);

    if (reassign && existing) {
      const reason = currentStatusReason(existing);
      if (entries.length === 0) {
        entries = [{
          heldBy: holderName(existing),
          from: toISODate(existing.createdAt),
          to: toISODate(existing.statusChangedAt),
          reason: reason === 'UNKNOWN_INACTIVE' ? null : reason,
        }];
      }
      tx.set(doc(db, REGISTRY, args.studentId, 'archived_records', String(Date.now())), {
        archivedAt: serverTimestamp(), archivedBy: uid, record: existing,
      });
    }

    const newEntries = assignId(entries, args.fullName, at);
    const activeFields = {
      ...statusFieldsFor('ACTIVE', '', uid),
      statusChangedAt: serverTimestamp(),
    };
    if (existing && !reassign) {
      // เลขนี้ยังมีผู้ถืออยู่จริง = พฤติกรรมเดิม (merge) ไม่ยุ่งกับสถานะ/ทะเบียน
      tx.set(studentRef, args.payload, { merge: true });
    } else {
      tx.set(studentRef, { ...args.payload, ...activeFields });
      tx.set(regRef, { studentId: args.studentId, entries: newEntries, updatedAt: serverTimestamp() }, { merge: true });
    }
    return { reassigned: reassign };
  });
}
