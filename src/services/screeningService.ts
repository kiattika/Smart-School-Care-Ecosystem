import { httpsCallable } from 'firebase/functions';
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
import { db, functions } from '../lib/firebase';
import {
  EightQEntryPath,
  EightQResult,
  EightQRiskLevel,
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
  entryPath: EightQEntryPath;
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

// ───────── 9Q: ส่งคำตอบดิบให้เซิร์ฟเวอร์คำนวณ/ตรวจสิทธิ์/เขียน (callable submitNineQ) ─────────

export interface NineQStaffResult { riskLevel: NineQRiskLevel; redFlagItem9: boolean; totalScore: number }

async function callSubmitNineQ(studentId: string, answers: readonly number[]): Promise<Record<string, unknown>> {
  // ส่งเฉพาะคำตอบดิบ — ไม่ส่ง riskLevel/คะแนน/ธงแดง (เซิร์ฟเวอร์คำนวณเอง ไม่รับค่าจาก client)
  const res = await httpsCallable(functions, 'submitNineQ')({ studentId, answers: [...answers] });
  return (res.data ?? {}) as Record<string, unknown>;
}

/**
 * นักเรียนส่ง 9Q ของตัวเอง — เซิร์ฟเวอร์เลือกฐาน (2Q ล่าสุดบวก/ใบอนุญาตที่ครูเปิดให้ ที่ยังไม่เคยใช้) และเขียน summary + detail + progress เอง
 * ไม่คืนผลใดๆ (นักเรียนห้ามเห็นคะแนน/ระดับ/ธงแดง) — ไม่มีฐาน = เซิร์ฟเวอร์ปฏิเสธด้วยข้อความกลางๆ
 */
export async function submitNineQByStudent(input: { studentId: string; answers: readonly number[] }): Promise<void> {
  await callSubmitNineQ(input.studentId, input.answers);
}

/** ครูกรอก 9Q แทนนักเรียน (นักเรียนบอกคำตอบปากเปล่า) — ครูแนะแนวเสมอ; ครูที่ปรึกษาเมื่อไม่มีครูแนะแนว; คืนผลให้ครูผู้กรอกเห็น */
export async function recordNineQOnBehalf(input: { studentId: string; answers: readonly number[] }): Promise<NineQStaffResult> {
  const d = await callSubmitNineQ(input.studentId, input.answers);
  return { riskLevel: d.riskLevel as NineQRiskLevel, redFlagItem9: d.redFlagItem9 === true, totalScore: Number(d.totalScore) };
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
  /** AFTER_9Q = ตามลำดับปกติ | EMERGENCY = ทางฉุกเฉิน (ประเมินทันทีโดยไม่ต้องรอ 9Q) */
  entryPath: EightQEntryPath;
}): Promise<EightQDoc> {
  const { studentId, result, recorder, entryPath } = input;
  const eightQ: EightQDoc = {
    id: `8q-${Date.now()}`,
    studentId,
    answers: result.answers,
    q3CanControl: result.q3CanControl,
    totalScore: result.totalScore,
    riskLevel: result.riskLevel,
    urgentReferral: result.urgentReferral,
    entryPath,
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
