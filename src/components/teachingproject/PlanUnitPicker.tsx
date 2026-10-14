import React, { useMemo } from 'react';
import { useStore } from '../../store';
import { useCurrentSemester } from '../../hooks/useCurrentSemester';
import { useTeachingProjects } from '../../hooks/useTeachingProjects';
import { courseKeyOf, semesterIdOf } from '../../lib/lessonPlans';
import { PLAN_STATUS_LABEL, unitLabel, type PlanStatus } from '../../lib/teachingProject';

export interface PlanPick { projectId: string; unitIds: string[]; unitTitles: string[]; status: PlanStatus }
export const EMPTY_PLAN_PICK: PlanPick = { projectId: '', unitIds: [], unitTitles: [], status: 'ON_PLAN' };

/** ในบันทึกหลังสอน: เลือกหัวข้อจากโครงการสอนของรหัสวิชานี้ที่สอนในคาบ (เลือกได้หลายหัวข้อ/เลือกว่าไม่ตรงแผนเมื่อมีกิจกรรมแทรก) */
export function PlanUnitPicker({ courseCode, value, onChange, disabled }: {
  courseCode: string; value: PlanPick; onChange: (v: PlanPick) => void; disabled?: boolean;
}) {
  const staffId = useStore(s => s.user?.staffId) || '';
  const sem = useCurrentSemester();
  const q = useMemo(() => (staffId ? ({ scope: 'SELF', staffId } as const) : null), [staffId]);
  const { data, loading } = useTeachingProjects(semesterIdOf(sem.academicYear, sem.term), q);
  const project = data.find(p => p.courseKey === courseKeyOf(courseCode));

  if (loading) return null;
  if (!project || project.units.length === 0) {
    return <p className="text-[11px] text-slate-500">ยังไม่มีโครงการสอนของวิชานี้ในภาคเรียนนี้ — จัดทำได้ที่เมนู "โครงการสอนของฉัน" แล้วจะเลือกหัวข้อที่สอนได้ที่นี่</p>;
  }
  const toggle = (id: string, title: string) => {
    const has = value.unitIds.includes(id);
    onChange({
      ...value, projectId: project.id,
      unitIds: has ? value.unitIds.filter(x => x !== id) : [...value.unitIds, id],
      unitTitles: has ? value.unitTitles.filter((_, i) => value.unitIds[i] !== id) : [...value.unitTitles, title],
    });
  };
  return (
    <div className="bg-[#0b0f19] border border-slate-800/80 p-3 rounded-xl space-y-2">
      <p className="text-xs font-bold text-slate-300">หัวข้อที่สอนในคาบนี้ (จากโครงการสอน {project.courseCode})</p>
      <ul className="max-h-40 overflow-y-auto space-y-1">
        {project.units.map(u => (
          <li key={u.id}>
            <label className="flex items-start gap-2 text-xs text-slate-200">
              <input type="checkbox" disabled={disabled} checked={value.unitIds.includes(u.id)} onChange={() => toggle(u.id, unitLabel(u))} className="mt-0.5" />
              <span>{unitLabel(u)}{u.type === 'EXAM' && ' (สอบ)'}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-1">
        {(['ON_PLAN', 'DEVIATED'] as const).map(st => (
          <label key={st} className="flex items-center gap-2 text-xs text-slate-300">
            <input type="radio" disabled={disabled} checked={value.status === st} onChange={() => onChange({ ...value, projectId: project.id, status: st })} />{PLAN_STATUS_LABEL[st]}
          </label>
        ))}
      </div>
    </div>
  );
}
