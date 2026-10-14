import {
  collection, deleteDoc, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, type Query,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  scoresComplete, courseKeyOf, planDocId, validateSubmission,
  type ScoresMap, type LessonPlan, type LessonPlanKind, type PlanQuery,
} from '../lib/lessonPlans';

const col = () => collection(db, 'lesson_plan_submissions');

/** query ต้องมีเงื่อนไขตรง rules เสมอ (ดู planOverviewQuery) */
export function subscribeLessonPlans(
  semesterId: string, q: PlanQuery, cb: (list: LessonPlan[]) => void, onError?: (e: Error) => void,
): () => void {
  const base = where('semesterId', '==', semesterId);
  const built: Query =
    q.scope === 'ALL' ? query(col(), base)
      : q.scope === 'DEPARTMENT' ? query(col(), base, where('departmentId', '==', q.departmentId))
        : query(col(), base, where('teacherStaffId', '==', q.staffId));
  return onSnapshot(
    built,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LessonPlan, 'id'>) }))),
    (err) => onError?.(err),
  );
}

export interface SubmitPlanInput {
  semester: { academicYear: string; term: '1' | '2' };
  teacher: { staffId: string; name: string; departmentId: string };
  course: { code: string; name: string; level: string };
  kind: LessonPlanKind;
  url: string;
  note: string;
  /** มีเอกสารอยู่แล้ว (แก้/ส่งใหม่) */
  exists: boolean;
}

/** ครูส่งแผน/โครงการ (สร้างใหม่) หรือแก้ลิงก์แล้วส่งใหม่ (เริ่มขั้นแรกอีกครั้ง) */
export async function submitLessonPlan(input: SubmitPlanInput): Promise<string> {
  const problem = validateSubmission(input);
  if (problem) throw new Error(problem);
  const key = courseKeyOf(input.course.code);
  if (!key) throw new Error('รายวิชานี้ไม่มีรหัสวิชา ส่งแผนไม่ได้');
  const semesterId = `${input.semester.academicYear}_${input.semester.term}`;
  const id = planDocId(semesterId, input.teacher.staffId, key);
  const ref = doc(db, 'lesson_plan_submissions', id);
  const content = { kind: input.kind, url: input.url.trim(), note: (input.note || '').trim() };
  if (input.exists) {
    await updateDoc(ref, { ...content, stage: 'SUBMITTED', updatedAt: serverTimestamp() });
  } else {
    await setDoc(ref, {
      semesterId, academicYear: input.semester.academicYear, term: input.semester.term,
      teacherStaffId: input.teacher.staffId, teacherName: input.teacher.name.slice(0, 160),
      departmentId: input.teacher.departmentId,
      courseKey: key, courseCode: input.course.code.slice(0, 40), courseName: input.course.name.slice(0, 160), level: (input.course.level || '').slice(0, 40),
      ...content, stage: 'SUBMITTED',
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
  }
  return id;
}

export async function deleteLessonPlan(id: string): Promise<void> {
  await deleteDoc(doc(db, 'lesson_plan_submissions', id));
}

export interface ReviewInput {
  id: string;
  stage: 'DEPT' | 'FINAL';
  decision: 'APPROVE' | 'REVISE';
  comment: string;
  scores: ScoresMap;
  reviewer: { staffId: string; name: string };
}

/** ตรวจแผน: อนุมัติขั้นนี้ หรือขอแก้ไข (ต้องมีความเห็น) — ต้องตอบแบบประเมินครบทุกข้อ */
export async function reviewLessonPlan(r: ReviewInput): Promise<void> {
  if (!scoresComplete(r.scores)) throw new Error('กรุณาตอบแบบประเมินให้ครบทั้ง 15 ข้อก่อนบันทึกผล');
  if (r.decision === 'REVISE' && !r.comment.trim()) throw new Error('กรณีขอให้แก้ไข ต้องระบุความเห็น/สิ่งที่ต้องแก้');
  const ref = doc(db, 'lesson_plan_submissions', r.id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('ไม่พบรายการนี้');
  const review = {
    byStaffId: r.reviewer.staffId, byName: r.reviewer.name.slice(0, 160),
    decision: r.decision, comment: r.comment.trim().slice(0, 1000), scores: r.scores, at: serverTimestamp(),
  };
  if (r.stage === 'DEPT') {
    await updateDoc(ref, { stage: r.decision === 'APPROVE' ? 'DEPT_APPROVED' : 'REVISION', deptReview: review, updatedAt: serverTimestamp() });
  } else {
    await updateDoc(ref, { stage: r.decision === 'APPROVE' ? 'APPROVED' : 'REVISION', finalReview: review, updatedAt: serverTimestamp() });
  }
}
