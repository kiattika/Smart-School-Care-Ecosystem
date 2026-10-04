import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { format } from 'date-fns';
import { db } from '../lib/firebase';
import {
  EightQResult,
  EightQRiskLevel,
  NineQBasis,
  NineQResult,
  NineQRiskLevel,
  ParentNoticeMethod,
  ParentNoticeScope,
} from '../lib/depressionScreening';

/**
 * คัดกรองซึมเศร้า/ฆ่าตัวตาย 2Q → 9Q → 8Q — เอกสารและสิทธิ์ดู firestore.rules (ส่วน "คัดกรองซึมเศร้า/ฆ่าตัวตาย")
 * ทุกฟังก์ชันเขียนของจริงแล้วค่อย resolve — error (รวม permission-denied) โยนต่อให้ผู้เรียกแสดงผลจริง ห้ามกลืนเงียบ
 */

// ───────── ชนิดเอกสาร ─────────

/** 9Q สรุป — ระดับ + ธงแดงข้อ 9 เท่านั้น (ครูที่ปรึกษาอ่านได้เสมอ) */
export interface NineQSummaryDoc {
  id: string;
  studentId: string;
  studentUid: string;
  riskLevel: NineQRiskLevel;
  redFlagItem9: boolean;
  conductedAt: string;
  basisKind: string;
  basisId: string;
  respondentKind: 'STUDENT' | 'STAFF';
  recordedByUid: string;
}

/** 9Q รายละเอียด — คำตอบรายข้อ + คะแนนรวม (ครูแนะแนวเสมอ; ครูที่ปรึกษาเมื่อไม่มีครูแนะแนวที่ใช้งานอยู่) */
export interface NineQDetailDoc {
  id: string;
  studentId: string;
  studentUid: string;
  answers: number[];
  totalScore: number;
  basisKind: string;
  basisId: string;
  conductedAt: string;
  recordedByUid: string;
}

export interface EightQDoc {
  id: string;
  studentId: string;
  answers: boolean[];
  q3CanControl: boolean | null;
  totalScore: number;
  riskLevel: EightQRiskLevel;
  urgentReferral: boolean;
  conductedAt: string;
  recordedByUid: string;
  recordedByName: string;
}

export interface EightQFlagDoc { studentId: string; hasCase: boolean; updatedByUid: string }

export interface NineQProgressDoc {
  studentId: string;
  studentUid: string;
  usedBasisIds: string[];
  lastBasisKind?: string;
  lastBasisId?: string;
  lastNineQAt?: string;
}

export interface NineQGrantDoc {
  id: string;
  openedByUid: string;
  openedByName: string;
  openedByRole: string;
  openedAt: string;
  note?: string;
}

export interface ParentNoticeDoc {
  id: string;
  scope: ParentNoticeScope;
  screeningId: string;
  notifiedByUid: string;
  notifiedByName: string;
  notifiedAt: string;
  method: ParentNoticeMethod;
  note?: string;
}

const today = () => format(new Date(), 'yyyy-MM-dd');
const ref = (path: string) => doc(db, path);

// ───────── 9Q: นักเรียนตอบ (ต้องมีฐาน — 2Q บวก หรือใบอนุญาตที่ครูเปิดให้) ─────────

/**
 * นักเรียนส่ง 9Q — เขียน summary + detail + progress ใน batch เดียว (rules บังคับให้มาพร้อมกัน เพื่อ "ใช้" ฐานนั้น)
 * ผู้เรียกต้องส่ง usedBasisIds ปัจจุบัน (จาก progress ที่ฟังสดอยู่) — rules ตรวจว่า progress ใหม่ = เดิม + ฐานนี้พอดี
 */
export async function submitNineQByStudent(input: {
  studentId: string;
  studentUid: string;
  basis: NineQBasis;
  usedBasisIds: readonly string[];
  result: NineQResult;
}): Promise<void> {
  const { studentId, studentUid, basis, usedBasisIds, result } = input;
  const id = `9q-${Date.now()}`;
  const conductedAt = today();
  const batch = writeBatch(db);
  batch.set(ref(`student_screenings_9q/${studentId}`), {
    id, studentId, studentUid,
    riskLevel: result.riskLevel,
    redFlagItem9: result.redFlagItem9,
    conductedAt,
    basisKind: basis.kind, basisId: basis.id,
    respondentKind: 'STUDENT',
    recordedByUid: studentUid,
    updatedAt: serverTimestamp(),
  });
  batch.set(ref(`student_screenings_9q_detail/${studentId}`), {
    id, studentId, studentUid,
    answers: result.answers,
    totalScore: result.totalScore,
    basisKind: basis.kind, basisId: basis.id,
    conductedAt,
    recordedByUid: studentUid,
    updatedAt: serverTimestamp(),
  });
  batch.set(ref(`student_screening_progress/${studentId}`), {
    studentId, studentUid,
    usedBasisIds: [...usedBasisIds, basis.id],
    lastBasisKind: basis.kind, lastBasisId: basis.id,
    lastNineQAt: conductedAt,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

// ───────── ใบอนุญาตให้นักเรียนทำ 9Q (ครูแนะแนว/ครูที่ปรึกษา) ─────────

export async function openNineQGrant(studentId: string, opener: { uid: string; name: string; role: string }, note?: string): Promise<string> {
  const data: Record<string, unknown> = {
    openedByUid: opener.uid,
    openedByName: opener.name,
    openedByRole: opener.role,
    openedAt: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  };
  if (note && note.trim()) data.note = note.trim().slice(0, 300);
  const added = await addDoc(collection(db, `student_screening_progress/${studentId}/grants`), data);
  return added.id;
}

export async function revokeNineQGrant(studentId: string, grantId: string): Promise<void> {
  await deleteDoc(ref(`student_screening_progress/${studentId}/grants/${grantId}`));
}

// ───────── 8Q: ครูกรอกแทนนักเรียนเท่านั้น ─────────

export async function saveEightQ(input: {
  studentId: string;
  result: EightQResult;
  recorder: { uid: string; name: string };
}): Promise<EightQDoc> {
  const { studentId, result, recorder } = input;
  const eightQ: EightQDoc = {
    id: `8q-${Date.now()}`,
    studentId,
    answers: result.answers,
    q3CanControl: result.q3CanControl,
    totalScore: result.totalScore,
    riskLevel: result.riskLevel,
    urgentReferral: result.urgentReferral,
    conductedAt: today(),
    recordedByUid: recorder.uid,
    recordedByName: recorder.name,
  };
  const batch = writeBatch(db);
  batch.set(ref(`student_screenings_8q/${studentId}`), { ...eightQ, updatedAt: serverTimestamp() });
  // "มีเคสอยู่ในการดูแล ใช่/ไม่" — ครูที่ปรึกษาเห็นเฉพาะค่านี้เมื่อมีครูแนะแนว (นิยาม: 8Q มีคะแนน > 0)
  batch.set(ref(`student_8q_case_flags/${studentId}`), {
    studentId,
    hasCase: result.totalScore > 0,
    updatedByUid: recorder.uid,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
  return eightQ;
}

// ───────── บันทึกแจ้งผู้ปกครอง (ไม่ส่งอัตโนมัติ — ครูกรอกเองหลังติดต่อจริง) ─────────

export async function recordParentNotice(studentId: string, input: {
  scope: ParentNoticeScope;
  screeningId: string;
  by: { uid: string; name: string };
  notifiedAt: string;
  method: ParentNoticeMethod;
  note?: string;
}): Promise<void> {
  const data: Record<string, unknown> = {
    scope: input.scope,
    screeningId: input.screeningId,
    notifiedByUid: input.by.uid,
    notifiedByName: input.by.name,
    notifiedAt: input.notifiedAt,
    method: input.method,
  };
  if (input.note && input.note.trim()) data.note = input.note.trim().slice(0, 500);
  await addDoc(collection(db, `student_screening_notices/${studentId}/entries`), data);
}

export async function loadParentNotices(studentId: string): Promise<ParentNoticeDoc[]> {
  const snap = await getDocs(collection(db, `student_screening_notices/${studentId}/entries`));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as ParentNoticeDoc))
    .sort((a, b) => (b.notifiedAt || '').localeCompare(a.notifiedAt || ''));
}

export async function loadNineQGrants(studentId: string): Promise<NineQGrantDoc[]> {
  const snap = await getDocs(collection(db, `student_screening_progress/${studentId}/grants`));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as NineQGrantDoc));
}

// ───────── อ่านรายคน (ครูที่ปรึกษา — rules ผูกกับห้องของนักเรียนต่อเอกสาร จึง list ทั้ง collection ไม่ได้) ─────────

/** อ่านเอกสารเดียว — permission-denied/ไม่มี = null (ไม่ใช่ error: บางชั้นข้อมูลครูที่ปรึกษาไม่มีสิทธิ์อ่านโดยตั้งใจ) */
export async function readDocOrNull<T>(path: string): Promise<T | null> {
  try {
    const snap = await getDoc(ref(path));
    return snap.exists() ? ({ ...snap.data() } as T) : null;
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === 'permission-denied') return null;
    throw err;
  }
}

export function listenDoc<T>(path: string, onData: (d: T | null) => void, onError: (e: Error) => void): () => void {
  return onSnapshot(ref(path), (snap) => onData(snap.exists() ? ({ ...snap.data() } as T) : null), onError);
}

/** _docId = id ของเอกสารใน Firestore (เอกสารระดับนักเรียน = studentId; field `id` ในข้อมูลคือรหัสผลคัดกรอง ไม่ถูกทับ) */
export function listenCollection<T>(path: string, onData: (list: Array<T & { _docId: string }>) => void, onError: (e: Error) => void): () => void {
  return onSnapshot(collection(db, path), (snap) => onData(snap.docs.map((d) => ({ ...(d.data() as T), _docId: d.id }))), onError);
}
