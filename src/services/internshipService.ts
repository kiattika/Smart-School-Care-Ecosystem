import { collection, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  INTERNSHIP_LIMITS, INTERNSHIP_SETTINGS_ID, canStaffDecide, canStudentCancel, canStudentEdit, canStudentResubmit, canSubmitNow,
  dayEndExclusive, dayStart, periodById, validateRequestForm, validateSettingsInput,
  type InternshipForm, type InternshipRequest, type InternshipSettings, type InternshipSettingsInput, type InternshipStatus,
} from '../lib/internship';

const SETTINGS = 'internship_settings';
const REQUESTS = 'internship_requests';
type By = { staffId: string; name: string };

const settingsFrom = (x: Record<string, any>): InternshipSettings => ({
  periods: Array.isArray(x.periods) ? x.periods : [], purposeText: x.purposeText || '', acceptanceFormText: x.acceptanceFormText || '',
  signerName: x.signerName || '', signerPosition: x.signerPosition || '', registrationEnabled: x.registrationEnabled === true,
  registrationOpensAt: x.registrationOpensAt ?? null, registrationClosesAt: x.registrationClosesAt ?? null,
});
const requestFrom = (id: string, x: Record<string, any>): InternshipRequest => ({
  id, studentId: x.studentId, studentName: x.studentName || '', room: x.room || '', companyName: x.companyName || '', companyAddress: x.companyAddress || '',
  headName: x.headName || '', headPosition: x.headPosition || '', periodId: x.periodId || '', periodLabel: x.periodLabel || '',
  startYmd: x.startYmd || '', endYmd: x.endYmd || '', status: x.status as InternshipStatus, staffNote: x.staffNote, letterNo: x.letterNo, letterDateYmd: x.letterDateYmd,
});

/** null = ยังไม่เคยตั้งค่า */
export function subscribeInternshipSettings(cb: (s: InternshipSettings | null) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(doc(db, SETTINGS, INTERNSHIP_SETTINGS_ID), snap => cb(snap.exists() ? settingsFrom(snap.data()) : null), e => onError?.(e));
}

/** งานแนะแนวบันทึกการตั้งค่า — throw เมื่อเขียนไม่สำเร็จ */
export async function saveInternshipSettings(input: InternshipSettingsInput, by: By): Promise<void> {
  if (!by.staffId) throw new Error('บัญชีนี้ไม่ได้เชื่อมกับทะเบียนบุคลากร');
  const errs = validateSettingsInput(input);
  if (errs.length) throw new Error(errs.join(' / '));
  await setDoc(doc(db, SETTINGS, INTERNSHIP_SETTINGS_ID), {
    periods: input.periods.map(p => ({ id: p.id, label: p.label.trim(), startYmd: p.startYmd, endYmd: p.endYmd })),
    purposeText: input.purposeText.trim(), acceptanceFormText: input.acceptanceFormText.trim(),
    signerName: input.signerName.trim(), signerPosition: input.signerPosition.trim(), registrationEnabled: input.registrationEnabled,
    registrationOpensAt: dayStart(input.opensYmd), registrationClosesAt: dayEndExclusive(input.closesYmd),
    updatedByStaffId: by.staffId, updatedAt: serverTimestamp(),
  });
}

export function subscribeAllInternshipRequests(cb: (l: InternshipRequest[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(collection(db, REQUESTS), snap => cb(snap.docs.map(d => requestFrom(d.id, d.data())).sort((a, b) => a.studentName.localeCompare(b.studentName, 'th'))), e => onError?.(e));
}
/** นักเรียน/ผู้ปกครอง: query ด้วย studentId (ห้าม getDoc เอกสารที่อาจยังไม่มี — rules อ่านจาก resource.data) */
export function subscribeInternshipForStudent(studentId: string, cb: (r: InternshipRequest | null) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(query(collection(db, REQUESTS), where('studentId', '==', studentId)),
    snap => cb(snap.docs.length ? requestFrom(snap.docs[0].id, snap.docs[0].data()) : null), e => onError?.(e));
}

function bodyFrom(f: InternshipForm, settings: InternshipSettings) {
  const errs = validateRequestForm(f, settings.periods);
  if (errs.length) throw new Error(errs.join(' / '));
  const p = periodById(settings.periods, f.periodId)!;
  return {
    companyName: f.companyName.trim(), companyAddress: f.companyAddress.trim(), headName: f.headName.trim(), headPosition: f.headPosition.trim(),
    periodId: p.id, periodLabel: p.label, startYmd: p.startYmd, endYmd: p.endYmd,
  };
}

/** นักเรียนยื่น/แก้/ยื่นใหม่ — existing = คำร้องเดิมที่ subscribe ไว้ (ไม่มี = ยื่นครั้งแรก) */
export async function submitInternship(student: { studentId: string; name: string }, f: InternshipForm, settings: InternshipSettings | null, existing: InternshipRequest | null): Promise<void> {
  if (!settings || !canSubmitNow(settings, Date.now())) throw new Error('ขณะนี้ไม่ได้เปิดรับคำร้องขอฝึกงาน');
  const body = bodyFrom(f, settings);
  const ref = doc(db, REQUESTS, student.studentId);
  if (existing) {
    if (!canStudentEdit(existing.status) && !canStudentResubmit(existing.status)) throw new Error('คำร้องนี้แก้ไขไม่ได้ในสถานะปัจจุบัน');
    await updateDoc(ref, { ...body, status: 'SUBMITTED', updatedAt: serverTimestamp() });
    return;
  }
  const reg = await getDoc(doc(db, 'students', student.studentId));
  if (!reg.exists()) throw new Error('ไม่พบนักเรียน');
  const s = reg.data();
  if (!s.studentUid) throw new Error('ยังไม่มีบัญชีนักเรียนที่เชื่อมกับรหัสนี้ — ติดต่อโรงเรียน');
  await setDoc(ref, {
    studentId: student.studentId, studentUid: s.studentUid, studentName: student.name.slice(0, 160), room: String(s.room || ''),
    ...body, status: 'SUBMITTED', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
}

export async function cancelInternship(r: InternshipRequest): Promise<void> {
  if (!canStudentCancel(r.status)) throw new Error('ยกเลิกคำร้องนี้ไม่ได้ในสถานะปัจจุบัน');
  await updateDoc(doc(db, REQUESTS, r.id), { status: 'CANCELLED', updatedAt: serverTimestamp() });
}

/** งานแนะแนวอนุมัติ/ไม่อนุมัติ และบันทึกเลขที่/วันที่หนังสือ */
export async function decideInternship(r: InternshipRequest, to: 'APPROVED' | 'REJECTED', d: { staffNote: string; letterNo: string; letterDateYmd: string }, by: By): Promise<void> {
  if (!by.staffId) throw new Error('บัญชีนี้ไม่ได้เชื่อมกับทะเบียนบุคลากร');
  if (!canStaffDecide(r.status, to)) throw new Error('เปลี่ยนสถานะนี้ไม่ได้จากสถานะปัจจุบัน');
  if (d.staffNote.length > INTERNSHIP_LIMITS.staffNote) throw new Error(`หมายเหตุยาวเกิน ${INTERNSHIP_LIMITS.staffNote} ตัวอักษร`);
  if (d.letterNo.length > INTERNSHIP_LIMITS.letterNo) throw new Error(`เลขที่หนังสือยาวเกิน ${INTERNSHIP_LIMITS.letterNo} ตัวอักษร`);
  if (d.letterDateYmd && !/^\d{4}-\d{2}-\d{2}$/.test(d.letterDateYmd)) throw new Error('วันที่หนังสือไม่ถูกต้อง');
  await updateDoc(doc(db, REQUESTS, r.id), {
    status: to, staffNote: d.staffNote.trim(), letterNo: d.letterNo.trim(), letterDateYmd: d.letterDateYmd,
    decidedByStaffId: by.staffId, decidedByName: by.name.slice(0, 160), updatedAt: serverTimestamp(),
  });
}
