import React, { useMemo, useState } from 'react';
import { useStore } from '../../store';
import { useCurrentSemester } from '../../hooks/useCurrentSemester';
import { useTeachingProjects } from '../../hooks/useTeachingProjects';
import { deleteTeachingProject, saveTeachingProject, setProjectCoTeachers, type ProjectContent } from '../../services/teachingProjectService';
import { semesterIdOf } from '../../lib/lessonPlans';
import {
  COURSE_KIND_LABEL, MAX_CO_TEACHERS, groupCoursesByCode, isProjectReady, levelLabelOf, projectCoverage, projectsForKey,
  type CourseGroup, type CourseLike, type TeachingProject, prefillCreditsHours } from '../../lib/teachingProject';
import { staffDepartmentId, staffFullName, type StaffRow } from '../../lib/supervisionView';
import { StaffMultiPicker } from '../shared/StaffMultiPicker';
import { useDepartments } from '../../hooks/useDepartments';
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
  const { nameOf: deptNameOf } = useDepartments();
  const cov = projectCoverage(groups, data);
  const [openKey, setOpenKey] = useState('');
  const [viewKey, setViewKey] = useState('');
  const [coKey, setCoKey] = useState('');

  if (!staffId) return <p className="text-sm text-slate-400">บัญชีนี้ไม่ได้เชื่อมกับทะเบียนบุคลากร</p>;
  const dept = staffDepartmentId(staff.find(s => s.id === staffId));

  const save = (g: CourseGroup, c: ProjectContent, p?: TeachingProject) => saveTeachingProject({
    semester: { academicYear: sem.academicYear, term: sem.term },
    teacher: { staffId, name: user?.displayName || '', departmentId: dept },
    course: { code: g.code, name: g.name }, content: c, exists: !!p, existingId: p?.id,
  });
  const initOf = (g: CourseGroup, p?: TeachingProject) => p
    ? { kind: p.kind, levelLabel: p.levelLabel, credits: p.credits, hoursPerWeek: p.hoursPerWeek, courseType: p.courseType, description: p.description, indicators: p.indicators, units: p.units, assessment: p.assessment, assessmentNote: p.assessmentNote }
    : { kind: (g.kind === 'ACTIVITY' ? 'ACTIVITY' : 'NORMAL') as 'ACTIVITY' | 'NORMAL', levelLabel: levelLabelOf(g.levels), ...prefillCreditsHours(g), courseType: g.kind === 'ACTIVITY' ? 'กิจกรรมพัฒนาผู้เรียน' : '', description: '', indicators: [], units: [], assessment: [], assessmentNote: '' };

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
            const list = projectsForKey<TeachingProject>(data, g.key, staffId);
            const badge = (p?: TeachingProject) => (g.kind === 'EXEMPT' ? 'ไม่ต้องทำ' : p ? (isProjectReady(p) ? `ทำแล้ว · ${p.units.length} แถว` : 'ร่าง — ยังไม่ครบ') : 'ยังไม่ได้ทำ');
            const head = (p?: TeachingProject) => (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><p className="text-white text-sm font-medium">{g.code} {g.name}</p>
                  <p className="text-xs text-slate-400">ห้องที่สอน: {g.levels.join(', ') || '-'} · {COURSE_KIND_LABEL[g.kind]}</p>
                  {p && p.teacherStaffId !== staffId && <p className="text-xs text-violet-300">ฉบับที่ {p.teacherName} แชร์ให้ (ครูร่วมสอน) — แก้เนื้อหาได้ ฉบับเดียวกันกับเจ้าของ</p>}
                  {p && p.teacherStaffId === staffId && (p.coTeacherNames?.length || 0) > 0 && <p className="text-xs text-violet-300">แชร์กับครูร่วมสอน: {p.coTeacherNames!.join(', ')}</p>}
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-slate-800 text-slate-200">{badge(p)}</span>
              </div>
            );
            if (list.length === 0) {
              const isOpen = openKey === g.key;
              return (
                <div key={g.key} className="rounded-xl border border-slate-700 bg-slate-900/40 p-4 space-y-2">
                  {head()}
                  {g.kind !== 'EXEMPT' && !isOpen && <button className="px-3 py-1.5 rounded-lg text-xs bg-cyan-600 text-white cursor-pointer" onClick={() => { setOpenKey(g.key); setViewKey(''); }}>สร้างโครงการสอน</button>}
                  {isOpen && <TeachingProjectEditor levelsNote={g.levels.join(', ')} init={initOf(g)} onSave={(c) => save(g, c)} onCancel={() => setOpenKey('')} />}
                </div>
              );
            }
            return (
              <div key={g.key} className="space-y-3">
                {list.map(p => {
                  const owner = p.teacherStaffId === staffId;
                  const isOpen = openKey === p.id;
                  const coOpen = coKey === p.id;
                  return (
                    <div key={p.id} className="rounded-xl border border-slate-700 bg-slate-900/40 p-4 space-y-2">
                      {head(p)}
                      {!isOpen && (
                        <div className="flex flex-wrap gap-2">
                          <button className="px-3 py-1.5 rounded-lg text-xs bg-cyan-600 text-white cursor-pointer" onClick={() => { setOpenKey(p.id); setViewKey(''); }}>แก้ไขโครงการสอน</button>
                          <button className="px-3 py-1.5 rounded-lg text-xs border border-slate-600 text-slate-300 cursor-pointer" onClick={() => setViewKey(viewKey === p.id ? '' : p.id)}>{viewKey === p.id ? 'ซ่อน' : 'ดู'}</button>
                          {owner && <button className="px-3 py-1.5 rounded-lg text-xs border border-violet-500/50 text-violet-200 cursor-pointer" onClick={() => setCoKey(coOpen ? '' : p.id)}>ครูร่วมสอน ({p.coTeacherStaffIds?.length || 0})</button>}
                          {owner && <button className="px-3 py-1.5 rounded-lg text-xs border border-rose-500/50 text-rose-300 cursor-pointer"
                            onClick={() => { if (window.confirm('ลบโครงการสอนวิชานี้? ครูร่วมสอนจะไม่เห็นฉบับนี้อีก')) void deleteTeachingProject(p.id); }}>ลบ</button>}
                        </div>
                      )}
                      {coOpen && owner && <div key={p.id}><CoTeacherEditor p={p} staff={staff} meId={staffId} dept={dept} deptNameOf={deptNameOf} onClose={() => setCoKey('')} /></div>}
                      {viewKey === p.id && <TeachingProjectView p={p} />}
                      {isOpen && <TeachingProjectEditor levelsNote={g.levels.join(', ')} init={initOf(g, p)} onSave={(c) => save(g, c, p)} onCancel={() => setOpenKey('')} />}
                    </div>
                  );
                })}
              </div>
            );
          })}
    </div>
  );
}

/** เจ้าของเลือกครูร่วมสอนที่ใช้โครงการสอนฉบับเดียวกัน (เช่น ครูหลายคนสอนรหัสวิชาเดียวกัน/ชุมนุมที่มีครูร่วม) */
function CoTeacherEditor({ p, staff, meId, dept, deptNameOf, onClose }: {
  p: TeachingProject; staff: StaffRow[]; meId: string; dept: string; deptNameOf: (id?: string | null) => string; onClose: () => void;
}) {
  const [ids, setIds] = useState<string[]>(p.coTeacherStaffIds || []);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const nameOf = (id: string) => {
    const i = (p.coTeacherStaffIds || []).indexOf(id);
    const row = staff.find(s => s.id === id);
    return row ? staffFullName(row) : (i >= 0 ? (p.coTeacherNames || [])[i] : '') || id;
  };
  const save = async () => {
    setBusy(true); setMsg('');
    try { await setProjectCoTeachers(p.id, { ids, names: ids.map(nameOf) }); setMsg('บันทึกแล้ว'); }
    catch (e) { setMsg(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ'); } finally { setBusy(false); }
  };
  return (
    <div className="rounded-lg border border-violet-500/30 bg-slate-950/60 p-3 space-y-2">
      <p className="text-xs text-violet-200">ครูร่วมสอนจะเห็นและแก้เนื้อหาฉบับนี้ร่วมกับท่าน (ฉบับเดียว ไม่ซ้ำ) แต่เพิ่ม/ลบครูร่วมสอนหรือลบโครงการไม่ได้ — ฉบับนี้นับเป็นโครงการของวิชานี้ของครูร่วมสอนทุกคน</p>
      <StaffMultiPicker staff={staff} selectedIds={ids} onChange={setIds} excludeId={meId} max={MAX_CO_TEACHERS} deptId={dept} deptName={deptNameOf(dept)} deptLabelOf={deptNameOf} />
      <div className="flex items-center gap-2">
        <button disabled={busy} className="px-3 py-1.5 rounded-lg text-xs bg-violet-600 text-white disabled:opacity-40 cursor-pointer" onClick={() => void save()}>บันทึกครูร่วมสอน</button>
        <button className="px-3 py-1.5 rounded-lg text-xs border border-slate-600 text-slate-300 cursor-pointer" onClick={onClose}>ปิด</button>
        {msg && <span role="status" className="text-xs text-slate-300">{msg}</span>}
      </div>
    </div>
  );
}
