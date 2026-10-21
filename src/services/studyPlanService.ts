import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { parseStudyPlan, validateStudyPlan, type StudyChoice, type StudyLevel, type StudyPlan, type StudyPlanType } from '../lib/studyPlan';

const COL = 'student_study_plans';

type Fail = (e: Error) => void;
const toPlans = (docs: { id: string; data: () => Record<string, unknown> }[]): StudyPlan[] =>
  docs.map(d => parseStudyPlan(d.id, d.data())).filter((p): p is StudyPlan => p !== null);

/** นักเรียน/ผู้ปกครอง: แผนของนักเรียนคนเดียว (rules อ่านด้วยรหัสนักเรียนตามทะเบียน — เอกสารที่ยังไม่มี = null) */
export function subscribeMyStudyPlan(studentId: string, cb: (p: StudyPlan | null) => void, onError: Fail): () => void {
  return onSnapshot(doc(db, COL, studentId),
    snap => cb(snap.exists() ? parseStudyPlan(snap.id, snap.data()) : null),
    e => onError(e));
}

/** ครูแนะแนว/ผู้บริหาร: แผนทั้งโรงเรียน */
export function subscribeAllStudyPlans(cb: (p: StudyPlan[]) => void, onError: Fail): () => void {
  return onSnapshot(collection(db, COL), snap => cb(toPlans(snap.docs)), e => onError(e));
}

/** ครูที่ปรึกษา: เฉพาะห้องตัวเอง (rules ต้อง query ด้วย room ตรงห้องที่ดูแล) */
export function subscribeStudyPlansByRoom(room: string, cb: (p: StudyPlan[]) => void, onError: Fail): () => void {
  return onSnapshot(query(collection(db, COL), where('room', '==', room)), snap => cb(toPlans(snap.docs)), e => onError(e));
}

export interface SaveStudyPlanInput {
  studentId: string;
  studentUid: string;
  room: string;
  level: StudyLevel;
  academicYear: string;
  planType: StudyPlanType;
  choices: StudyChoice[];
  portfolioUrl: string;
  portfolioSent: boolean;
  note: string;
}

/** บันทึกจริงลง Firestore — ตรวจเนื้อหาก่อน (throw ข้อความที่แก้ได้); rules ตรวจซ้ำที่เซิร์ฟเวอร์ */
export async function saveStudyPlan(input: SaveStudyPlanInput): Promise<void> {
  const errs = validateStudyPlan(input);
  if (errs.length) throw new Error(errs.join(' / '));
  if (!input.studentUid) throw new Error('ไม่พบบัญชีนักเรียน — เข้าสู่ระบบใหม่แล้วลองอีกครั้ง');
  if (!/^\d{4}$/.test(input.academicYear)) throw new Error('ยังไม่ได้ตั้งปีการศึกษา — แจ้งผู้ดูแลระบบ');
  const usesChoices = input.planType === 'UNIVERSITY';
  await setDoc(doc(db, COL, input.studentId), {
    studentId: input.studentId,
    studentUid: input.studentUid,
    room: input.room,
    level: input.level,
    academicYear: input.academicYear,
    planType: input.planType,
    choices: usesChoices ? input.choices.map(c => ({ institution: c.institution.trim(), program: c.program.trim(), round: c.round })) : [],
    portfolioUrl: usesChoices ? input.portfolioUrl.trim() : '',
    portfolioSent: usesChoices ? input.portfolioSent : false,
    note: input.note.trim(),
    updatedAt: serverTimestamp(),
  });
}
