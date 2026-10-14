import { collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  GRADUATION_LEVELS, retakeDocId, validateRetake,
  type GradeRetake, type GraduationApproval, type RetakeInput,
} from '../lib/gradeRetake';
import { getStudentLinkIds } from './firestoreService';

const RETAKES = 'grade_retakes';
const GRADUATIONS = 'graduation_approvals';

const fromDoc = (id: string, x: Record<string, any>): GradeRetake => ({
  id, studentId: x.studentId, term: x.term, courseCode: x.courseCode, courseName: x.courseName || '', kind: x.kind,
  originalGrade: x.originalGrade, newGrade: x.newGrade, retakeDate: x.retakeDate || '', note: x.note || '',
  recordedByStaffId: x.recordedByStaffId || '', recordedByName: x.recordedByName || '',
});

/** ผลแก้ตัว/เรียนซ้ำของนักเรียนคนเดียว — query ต้องกรอง studentId (ตรง rules: นักเรียน/ผู้ปกครองตามทะเบียนอ่านได้) */
export function subscribeGradeRetakesForStudent(studentId: string, cb: (l: GradeRetake[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(query(collection(db, RETAKES), where('studentId', '==', studentId)),
    snap => cb(snap.docs.map(d => fromDoc(d.id, d.data()))), e => onError?.(e));
}

/** ผลแก้ตัวทั้งห้อง (ใช้คำนวณลำดับที่ให้ครูที่ปรึกษา) — ห้องตรงกับ students.room ตอนบันทึก */
export function subscribeGradeRetakesForRoom(room: string, cb: (l: GradeRetake[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(query(collection(db, RETAKES), where('room', '==', room)),
    snap => cb(snap.docs.map(d => fromDoc(d.id, d.data()))), e => onError?.(e));
}

/**
 * บันทึก/แก้ผลแก้ตัว (งานทะเบียนวัดผล/ผู้ช่วย) — studentUid/parentUid/room ประทับจากทะเบียนนักเรียนจริง (rules เทียบ students/{id})
 * แก้ซ้ำ (รหัสเดียวกัน) = เขียนทับผลล่าสุด; ฟิลด์ระบุตัว (นักเรียน/ภาค/วิชา) ไม่เปลี่ยน
 */
export async function saveGradeRetake(input: RetakeInput, room: string, by: { staffId: string; name: string }): Promise<string> {
  const err = validateRetake(input);
  if (err) throw new Error(err);
  if (!by.staffId) throw new Error('บัญชีนี้ไม่ได้เชื่อมกับทะเบียนบุคลากร');
  const id = retakeDocId(input.studentId, input.term, input.courseCode);
  const ref = doc(db, RETAKES, id);
  const [link, prev] = await Promise.all([getStudentLinkIds(input.studentId), getDoc(ref)]);
  const base = {
    studentId: input.studentId, studentUid: link.studentUid ?? null, parentUid: link.parentUid ?? null, room,
    term: input.term, courseCode: input.courseCode.trim(), courseName: input.courseName.trim().slice(0, 160),
    kind: input.kind, originalGrade: input.originalGrade, newGrade: input.newGrade, retakeDate: input.retakeDate,
    note: input.note.trim(), recordedByStaffId: by.staffId, recordedByName: by.name.slice(0, 160),
  };
  await setDoc(ref, { ...base, createdAt: prev.exists() ? prev.data().createdAt : serverTimestamp(), updatedAt: serverTimestamp() });
  return id;
}

/** ลบผลแก้ตัว — เฉพาะงานทะเบียนวัดผล (ผู้ช่วยลบไม่ได้ — rules บังคับ) */
export async function deleteGradeRetake(id: string): Promise<void> {
  await deleteDoc(doc(db, RETAKES, id));
}

// ───────── อนุมัติจบหลักสูตร ─────────
export function subscribeGraduationApprovals(studentId: string, cb: (l: GraduationApproval[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(query(collection(db, GRADUATIONS), where('studentId', '==', studentId)),
    snap => cb(snap.docs.map(d => { const x = d.data(); return { id: d.id, studentId: x.studentId, level: x.level, academicYear: x.academicYear, note: x.note || '', approvedByStaffId: x.approvedByStaffId, approvedByName: x.approvedByName }; })),
    e => onError?.(e));
}

/** ผลแก้ตัวทั้งห้องแบบอ่านครั้งเดียว (ใช้ตรวจวิชาค้างก่อนอนุมัติจบ) */
export async function getGradeRetakesForRoom(room: string): Promise<GradeRetake[]> {
  const snap = await getDocs(query(collection(db, RETAKES), where('room', '==', room)));
  return snap.docs.map(d => fromDoc(d.id, d.data()));
}
export { GRADUATION_LEVELS };
