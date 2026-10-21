import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { ParentAuditEntry, ParentRecordBrief } from '../lib/parentAdmin';

const tsMs = (v: unknown): number | null => {
  const t = v as { toMillis?: () => number } | null | undefined;
  return t && typeof t.toMillis === 'function' ? t.toMillis() : null;
};

/**
 * ทะเบียนผู้ปกครองของนักเรียน (อ่านได้เฉพาะ SUPER_ADMIN ตาม rules) — คัดเฉพาะฟิลด์ที่ปลอดภัยต่อการแสดง
 * ไม่คัดลอกค่าเข้ารหัสของเลขบัตรมาไว้ฝั่ง client เลย
 */
export async function getParentRecordBrief(studentId: string): Promise<ParentRecordBrief | null> {
  const snap = await getDoc(doc(db, 'parent_verification_records', `${studentId}_verify`));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    parentPrefix: String(d.parentPrefix ?? ''),
    parentFirstName: String(d.parentFirstName ?? ''),
    parentLastName: String(d.parentLastName ?? ''),
    parentMobile: String(d.parentMobile ?? ''),
    relationship: String(d.relationship ?? ''),
    linkedParentUid: typeof d.linkedParentUid === 'string' && d.linkedParentUid ? d.linkedParentUid : null,
    linkedAtMs: tsMs(d.linkedAt),
  };
}

/** students.parentUid จริงจากทะเบียน (ไม่ใช่ alias ที่ useRealStudents ตั้งไว้) */
export async function getStudentParentUid(studentId: string): Promise<string | null> {
  const snap = await getDoc(doc(db, 'students', studentId));
  const v = snap.exists() ? snap.data().parentUid : null;
  return typeof v === 'string' && v ? v : null;
}

/** ประวัติการเปลี่ยนแปลงของนักเรียนคนนี้ (ใหม่สุดก่อน; เรียงฝั่ง client เพื่อไม่ต้องมี composite index) */
export function subscribeParentAudit(studentId: string, onUpdate: (list: ParentAuditEntry[]) => void, onError: (message: string) => void): () => void {
  return onSnapshot(
    query(collection(db, 'parent_admin_audit'), where('studentId', '==', studentId)),
    (snap) => {
      const list = snap.docs.map((d) => {
        const x = d.data();
        return {
          id: d.id,
          action: x.action === 'UNLINK' ? 'UNLINK' : 'SET_PARENT',
          studentId: String(x.studentId ?? ''),
          byEmail: String(x.byEmail ?? ''),
          reason: String(x.reason ?? ''),
          hadLink: !!x.hadLink,
          parentChanged: !!x.parentChanged,
          relationship: typeof x.relationship === 'string' ? x.relationship : null,
          createdAtMs: tsMs(x.createdAt),
        } as ParentAuditEntry;
      });
      list.sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0));
      onUpdate(list);
    },
    (err) => onError(err.message),
  );
}
