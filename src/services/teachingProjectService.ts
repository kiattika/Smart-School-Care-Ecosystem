import { collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, type Query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { courseKeyOf, type PlanQuery } from '../lib/lessonPlans';
import { projectDocId, validateCoTeachers, validateProject, type TeachingProject } from '../lib/teachingProject';

const col = () => collection(db, 'teaching_projects');

/** query ต้องตรง rules (planOverviewQuery ของ lessonPlans.ts หรือ SELF) */
export function subscribeTeachingProjects(
  semesterId: string, q: PlanQuery, cb: (list: TeachingProject[]) => void, onError?: (e: Error) => void,
): () => void {
  const base = where('semesterId', '==', semesterId);
  const built: Query =
    q.scope === 'ALL' ? query(col(), base)
      : q.scope === 'DEPARTMENT' ? query(col(), base, where('departmentId', '==', q.departmentId))
        : null;
  const toList = (snap: { docs: { id: string; data: () => unknown }[] }) => snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TeachingProject, 'id'>) }));
  if (!built) {
    // ของตนเอง = ที่ตนเป็นเจ้าของ + ที่ครูอื่นแชร์ให้ในฐานะครูร่วมสอน (2 query ที่ตรง rules แล้วรวมตาม id)
    const sid = (q as { staffId: string }).staffId;
    let mine: TeachingProject[] | null = null; let shared: TeachingProject[] | null = null;
    const emit = () => {
      if (!mine || !shared) return;
      const m = new Map<string, TeachingProject>();
      [...mine, ...shared].forEach(p => m.set(p.id, p));
      cb([...m.values()]);
    };
    const u1 = onSnapshot(query(col(), base, where('teacherStaffId', '==', sid)), (snap) => { mine = toList(snap); emit(); }, (err) => onError?.(err));
    const u2 = onSnapshot(query(col(), base, where('coTeacherStaffIds', 'array-contains', sid)), (snap) => { shared = toList(snap); emit(); }, (err) => onError?.(err));
    return () => { u1(); u2(); };
  }
  return onSnapshot(built, (snap) => cb(toList(snap)), (err) => onError?.(err));
}

export type ProjectContent = Pick<TeachingProject,
  'kind' | 'levelLabel' | 'credits' | 'hoursPerWeek' | 'courseType' | 'description' | 'indicators' | 'units' | 'assessment' | 'assessmentNote'>;

export interface SaveProjectInput {
  semester: { academicYear: string; term: '1' | '2' };
  teacher: { staffId: string; name: string; departmentId: string };
  course: { code: string; name: string };
  content: ProjectContent;
  exists: boolean;
  /** แก้ฉบับที่มีอยู่ (รวมฉบับที่ครูอื่นแชร์ให้) — ส่ง id เดิม; สร้างใหม่ = ไม่ส่ง */
  existingId?: string;
}

/** บันทึกโครงการสอน (สร้างใหม่/แก้ไข) — throw เมื่อไม่ผ่านการตรวจหรือเขียนไม่สำเร็จ */
export async function saveTeachingProject(input: SaveProjectInput): Promise<string> {
  const key = courseKeyOf(input.course.code);
  if (!key) throw new Error('รายวิชานี้ไม่มีรหัสวิชา บันทึกโครงการสอนไม่ได้');
  const problems = validateProject(input.content);
  if (problems.length > 0) throw new Error(problems[0]);
  const semesterId = `${input.semester.academicYear}_${input.semester.term}`;
  const id = input.existingId || projectDocId(semesterId, input.teacher.staffId, key);
  const ref = doc(db, 'teaching_projects', id);
  const c = input.content;
  const content = {
    kind: c.kind, levelLabel: c.levelLabel, credits: c.credits, hoursPerWeek: c.hoursPerWeek, courseType: c.courseType,
    description: c.description, indicators: c.indicators.map(i => i.trim()).filter(Boolean),
    units: c.units.map(u => ({ id: u.id, type: u.type, weeks: u.weeks.trim(), title: u.title.trim(), detail: u.detail, hours: u.hours, activities: u.activities, media: u.media })),
    assessment: c.assessment.map(a => ({ label: a.label.trim(), percent: Number(a.percent) || 0 })).filter(a => a.label),
    assessmentNote: c.assessmentNote,
  };
  if (input.exists) {
    await updateDoc(ref, { ...content, updatedAt: serverTimestamp() });
  } else {
    await setDoc(ref, {
      semesterId, academicYear: input.semester.academicYear, term: input.semester.term,
      teacherStaffId: input.teacher.staffId, teacherName: input.teacher.name.slice(0, 160), departmentId: input.teacher.departmentId,
      courseKey: key, courseCode: input.course.code.slice(0, 40), courseName: input.course.name.slice(0, 160),
      ...content, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
  }
  return id;
}

export async function deleteTeachingProject(id: string): Promise<void> {
  await deleteDoc(doc(db, 'teaching_projects', id));
}

/** เจ้าของเลือกครูร่วมสอน (แชร์ฉบับเดียวกัน) — ไม่รวมตนเอง ≤ MAX_CO_TEACHERS; names เรียงคู่กับ ids */
export async function setProjectCoTeachers(id: string, co: { ids: string[]; names: string[] }): Promise<void> {
  const check = validateCoTeachers(co.ids, co.names);
  if (check) throw new Error(check);
  await updateDoc(doc(db, 'teaching_projects', id), { coTeacherStaffIds: co.ids, coTeacherNames: co.names.map(n => n.slice(0, 160)), updatedAt: serverTimestamp() });
}
