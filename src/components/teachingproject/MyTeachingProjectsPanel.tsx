import React, { useMemo, useState } from 'react';
import { useStore } from '../../store';
import { useCurrentSemester } from '../../hooks/useCurrentSemester';
import { useTeachingProjects } from '../../hooks/useTeachingProjects';
import { deleteTeachingProject, saveTeachingProject, type ProjectContent } from '../../services/teachingProjectService';
import { semesterIdOf } from '../../lib/lessonPlans';
import {
  COURSE_KIND_LABEL, groupCoursesByCode, isProjectReady, levelLabelOf, projectCoverage, projectDocId,
  type CourseGroup, type CourseLike, type TeachingProject,
} from '../../lib/teachingProject';
import { staffDepartmentId, type StaffRow } from '../../lib/supervisionView';
import { TeachingProjectEditor } from './TeachingProjectEditor';
import { TeachingProjectView } from './TeachingProjectView';

/** ครูจัดทำโครงการสอนตามรหัสวิชา — 1 ฉบับใช้กับทุกห้องที่สอนรหัสเดียวกัน */
export function MyTeachingProjectsPanel({ courses }: { courses: CourseLike[] }) {
  const user = useStore(s => s.user);
  const staff = useStore(s => s.staffDirectory) as StaffRow[];
  const sem = useCurrentSemester();
  const staffId = user?.staffId || '';
  const semesterId = semesterIdOf(sem.academicYear, sem.term);
  const q = useMemo(() => (staffId ? ({ scope: 'SELF', staffId } as const) : null), [staffId]);
  const { data, loading, error } = useTeachingProjects(semesterId, q);
  const groups = useMemo(() => groupCoursesByCode(courses), [courses]);
  const byKey = new Map<string, TeachingProject>(data.map((p): [string, TeachingProject] => [p.courseKey, p]));
  const cov = projectCoverage(groups, data);
  const [openKey, setOpenKey] = useState('');
  const [viewKey, setViewKey] = useState('');

  if (!staffId) return <p className="text-sm text-slate-400">บัญชีนี้ไม่ได้เชื่อมกับทะเบียนบุคลากร</p>;
  const dept = staffDepartmentId(staff.find(s => s.id === staffId));

  const save = (g: CourseGroup, c: ProjectContent) => saveTeachingProject({
    semester: { academicYear: sem.academicYear, term: sem.term },
    teacher: { staffId, name: user?.displayName || '', departmentId: dept },
    course: { code: g.code, name: g.name }, content: c, exists: byKey.has(g.key),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-sm">
        <p className="text-white font-medium">โครงการสอน ภาคเรียน {sem.label}</p>
        <p className="text-slate-400 mt-1">ทำตามรหัสวิชาที่สอน ฉบับเดียวใช้กับทุกห้องที่เรียนรหัสเดียวกัน — ตอนบันทึกหลังสอนเลือกหัวข้อที่สอนจริงจากโครงการนี้ได้ (ยืดหยุ่นเมื่อมีกิจกรรมแทรก)</p>
        <p className="mt-2 text-cyan-300">รายวิชาปกติที่ทำครบ {cov.done}/{cov.required}{cov.missing.length > 0 && ` · ยังไม่ครบ: ${cov.missing.join(', ')}`}</p>
      </div>
      {error && <p role="alert" className="text-sm text-amber-300">โหลดข้อมูลไม่สำเร็จ: {error}</p>}
      {loading ? <p className="text-sm text-slate-400">กำลังโหลด…</p>
        : groups.length === 0 ? <p className="text-sm text-slate-400">ไม่พบรายวิชาที่ท่านสอนในภาคเรียนนี้</p>
          : groups.map(g => {
            const p = byKey.get(g.key);
            const isOpen = openKey === g.key;
            return (
              <div key={g.key} className="rounded-xl border border-slate-700 bg-slate-900/40 p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><p className="text-white text-sm font-medium">{g.code} {g.name}</p>
                    <p className="text-xs text-slate-400">ห้องที่สอน: {g.levels.join(', ') || '-'} · {COURSE_KIND_LABEL[g.kind]}</p></div>
                  <span className="text-xs px-2 py-1 rounded-full bg-slate-800 text-slate-200">
                    {g.kind === 'EXEMPT' ? 'ไม่ต้องทำ' : p ? (isProjectReady(p) ? `ทำแล้ว · ${p.units.length} แถว` : 'ร่าง — ยังไม่ครบ') : 'ยังไม่ได้ทำ'}
                  </span>
                </div>
                {g.kind !== 'EXEMPT' && !isOpen && (
                  <div className="flex gap-2">
                    <button className="px-3 py-1.5 rounded-lg text-xs bg-cyan-600 text-white cursor-pointer" onClick={() => { setOpenKey(g.key); setViewKey(''); }}>{p ? 'แก้ไขโครงการสอน' : 'สร้างโครงการสอน'}</button>
                    {p && <button className="px-3 py-1.5 rounded-lg text-xs border border-slate-600 text-slate-300 cursor-pointer" onClick={() => setViewKey(viewKey === g.key ? '' : g.key)}>{viewKey === g.key ? 'ซ่อน' : 'ดู'}</button>}
                    {p && <button className="px-3 py-1.5 rounded-lg text-xs border border-rose-500/50 text-rose-300 cursor-pointer"
                      onClick={() => { if (window.confirm('ลบโครงการสอนวิชานี้?')) void deleteTeachingProject(projectDocId(semesterId, staffId, g.key)); }}>ลบ</button>}
                  </div>
                )}
                {viewKey === g.key && p && <TeachingProjectView p={p} />}
                {isOpen && (
                  <TeachingProjectEditor
                    levelsNote={g.levels.join(', ')}
                    init={p ? { kind: p.kind, levelLabel: p.levelLabel, credits: p.credits, hoursPerWeek: p.hoursPerWeek, courseType: p.courseType, description: p.description, indicators: p.indicators, units: p.units, assessment: p.assessment, assessmentNote: p.assessmentNote }
                      : { kind: g.kind === 'ACTIVITY' ? 'ACTIVITY' : 'NORMAL', levelLabel: levelLabelOf(g.levels), credits: '', hoursPerWeek: '', courseType: g.kind === 'ACTIVITY' ? 'กิจกรรมพัฒนาผู้เรียน' : '', description: '', indicators: [], units: [], assessment: [], assessmentNote: '' }}
                    onSave={(c) => save(g, c)} onCancel={() => setOpenKey('')} />
                )}
              </div>
            );
          })}
    </div>
  );
}
