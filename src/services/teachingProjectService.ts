import { collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, type Query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { courseKeyOf, type PlanQuery } from '../lib/lessonPlans';
import { projectDocId, validateProject, type TeachingProject } from '../lib/teachingProject';

const col = () => collection(db, 'teaching_projects');

/** query ต้องตรง rules (planOverviewQuery ของ lessonPlans.ts หรือ SELF) */
export function subscribeTeachingProjects(
  semesterId: string, q: PlanQuery, cb: (list: TeachingProject[]) => void, onError?: (e: Error) => void,
): () => void {
  const base = where('semesterId', '==', semesterId);
  const built: Query =
    q.scope === 'ALL' ? query(col(), base)
      : q.scope === 'DEPARTMENT' ? query(col(), base, where('departmentId', '==', q.departmentId))
        : query(col(), base, where('teacherStaffId', '==', q.staffId));
  return onSnapshot(
    built,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TeachingProject, 'id'>) }))),
    (err) => onError?.(err),
  );
}

export type ProjectContent = Pick<TeachingProject,
  'kind' | 'levelLabel' | 'credits' | 'hoursPerWeek' | 'courseType' | 'description' | 'indicators' | 'units' | 'assessment' | 'assessmentNote'>;

export interface SaveProjectInput {
  semester: { academicYear: string; term: '1' | '2' };
  teacher: { staffId: string; name: string; departmentId: string };
  course: { code: string; name: string };
  content: ProjectContent;
  exists: boolean;
}

/** บันทึกโครงการสอน (สร้างใหม่/แก้ไข) — throw เมื่อไม่ผ่านการตรวจหรือเขียนไม่สำเร็จ */
export async function saveTeachingProject(input: SaveProjectInput): Promise<string> {
  const key = courseKeyOf(input.course.code);
  if (!key) throw new Error('รายวิชานี้ไม่มีรหัสวิชา บันทึกโครงการสอนไม่ได้');
  const problems = validateProject(input.content);
  if (problems.length > 0) throw new Error(problems[0]);
  const semesterId = `${input.semester.academicYear}_${input.semester.term}`;
  const id = projectDocId(semesterId, input.teacher.staffId, key);
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
