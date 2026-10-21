import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase';
import {
  FOLLOWUP_ACTIONS, normalizeThresholds, validateThresholds,
  type AbsenceThresholds, type FollowupAction,
} from '../lib/absenceStreak';

export interface AbsenceAlert {
  studentId: string; room: string; streakDays: number; level: 1 | 2 | 3; sinceDate: string; lastCheckedDate: string;
}
export interface AbsenceFollowup {
  id: string; studentId: string; room: string; action: FollowupAction; note: string; streakAtTime: number; byName: string; createdAtMs: number | null;
}

/** ขอบเขตการอ่านต้องตรงกับ rules: ห้อง = ครูที่ปรึกษาของห้อง, minLevel 2 = งานกิจการ/แนะแนว, 3 = ผู้บริหาร */
export type AlertScope = { kind: 'ROOM'; room: string } | { kind: 'MIN_LEVEL'; minLevel: 2 | 3 };

export function subscribeAbsenceAlerts(scope: AlertScope, cb: (l: AbsenceAlert[]) => void, onError?: (e: Error) => void): () => void {
  const col = collection(db, 'absence_alerts');
  const q = scope.kind === 'ROOM' ? query(col, where('room', '==', scope.room)) : query(col, where('level', '>=', scope.minLevel));
  return onSnapshot(q, snap => cb(snap.docs.map(d => d.data() as AbsenceAlert).sort((a, b) => b.streakDays - a.streakDays)), e => onError?.(e));
}

export function subscribeAbsenceThresholds(cb: (t: AbsenceThresholds, exists: boolean) => void): () => void {
  return onSnapshot(doc(db, 'absence_settings', 'thresholds'),
    snap => cb(normalizeThresholds(snap.exists() ? snap.data() : null), snap.exists()),
    e => { console.warn('[absence_settings] listener notice:', e.message); cb(normalizeThresholds(null), false); });
}

export async function saveAbsenceThresholds(t: AbsenceThresholds, byUid: string): Promise<void> {
  const err = validateThresholds(t);
  if (err) throw new Error(err);
  if (!byUid) throw new Error('ไม่พบผู้ใช้ที่ล็อกอิน — บันทึกไม่ได้');
  await setDoc(doc(db, 'absence_settings', 'thresholds'), { ...t, updatedAt: serverTimestamp(), updatedBy: byUid });
}

/** ห้องต้องมาจากทะเบียนนักเรียน (students.room) — rules เทียบกับทะเบียนจริง */
export function subscribeAbsenceFollowups(room: string, studentId: string, cb: (l: AbsenceFollowup[]) => void, onError?: (e: Error) => void): () => void {
  const q = query(collection(db, 'absence_followups'), where('room', '==', room), where('studentId', '==', studentId));
  return onSnapshot(q, snap => cb(snap.docs.map(d => {
    const x = d.data() as Record<string, any>;
    return { id: d.id, studentId: x.studentId, room: x.room, action: x.action, note: x.note || '', streakAtTime: x.streakAtTime ?? 0, byName: x.byName || '', createdAtMs: x.createdAt?.toMillis?.() ?? null };
  }).sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0))), e => onError?.(e));
}

/** throw เมื่อเขียนไม่สำเร็จ/ไม่มี staffId (ห้ามกลืน error แล้วแจ้งสำเร็จ) */
export async function addAbsenceFollowup(input: {
  studentId: string; room: string; action: FollowupAction; note: string; streakAtTime: number;
}, by: { uid: string; staffId: string; name: string }): Promise<void> {
  if (!by.uid || !by.staffId || !by.name) throw new Error('บัญชีนี้ไม่ได้เชื่อมกับทะเบียนบุคลากร — บันทึกไม่ได้');
  if (!input.studentId || !input.room) throw new Error('ไม่พบนักเรียนหรือห้องตามทะเบียน — บันทึกไม่ได้');
  if (!FOLLOWUP_ACTIONS.includes(input.action)) throw new Error('กรุณาเลือกผลการติดตาม');
  if (input.note.length > 500) throw new Error('หมายเหตุยาวเกิน 500 ตัวอักษร');
  if (input.action === 'OTHER' && !input.note.trim()) throw new Error('เลือก "อื่น ๆ" ต้องระบุหมายเหตุ');
  await addDoc(collection(db, 'absence_followups'), {
    studentId: input.studentId, room: input.room, action: input.action, note: input.note.trim(), streakAtTime: input.streakAtTime,
    byUid: by.uid, byStaffId: by.staffId, byName: by.name, createdAt: serverTimestamp(),
  });
}

/** งานกิจการ/SUPER_ADMIN สั่งคำนวณใหม่ทันที (ปกติคำนวณเองวันทำการ 17:30) */
export async function refreshAbsenceAlerts(): Promise<void> {
  const res = await httpsCallable(functions, 'refreshAbsenceAlerts')();
  if ((res.data as { success?: unknown } | null)?.success !== true) throw new Error('เซิร์ฟเวอร์ตอบกลับในรูปแบบที่ไม่คาดไว้');
}
