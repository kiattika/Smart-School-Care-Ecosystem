import React, { useState } from 'react';
import { useCurrentSemester } from '../../hooks/useCurrentSemester';
import { useTeachingProjects } from '../../hooks/useTeachingProjects';
import { semesterIdOf, type PlanQuery } from '../../lib/lessonPlans';
import { isProjectReady, totalHours, type TeachingProject } from '../../lib/teachingProject';
import { groupWithTones } from '../../lib/groupTones';
import { useDepartments } from '../../hooks/useDepartments';
import { TeachingProjectView } from './TeachingProjectView';

/** ผู้ตรวจ/ผู้บริหารดูโครงการสอนที่ครูจัดทำ (อ่านอย่างเดียว ขอบเขตตามสิทธิ์ของ q) */
export function TeachingProjectsOverview({ q }: { q: PlanQuery }) {
  const sem = useCurrentSemester();
  const { data, loading, error } = useTeachingProjects(semesterIdOf(sem.academicYear, sem.term), q);
  const [openId, setOpenId] = useState('');
  const { nameOf: deptNameOf } = useDepartments();
  const groups = groupWithTones<TeachingProject>(data, p => p.departmentId || '', k => deptNameOf(k) || k, (a, b) => a.teacherName.localeCompare(b.teacherName, 'th') || a.courseCode.localeCompare(b.courseCode, 'th'));
  if (error) return <p role="alert" className="text-sm text-amber-300">โหลดไม่สำเร็จ: {error}</p>;
  if (loading) return <p className="text-sm text-slate-400">กำลังโหลด…</p>;
  if (data.length === 0) return <p className="text-sm text-slate-400">ยังไม่มีครูจัดทำโครงการสอนในภาคเรียนนี้</p>;
  return (
    <div className="space-y-4">
      {groups.map(g => (
        <section key={g.key || 'none'} aria-label={g.label} className="space-y-2">
          <p className="text-xs font-semibold"><span className={`inline-block px-2.5 py-1 rounded-full border ${g.tone.chip}`}>{g.label} · {g.items.length} โครงการ</span></p>
          <ul className="space-y-2">
            {g.items.map(p => (
              <li key={p.id} className={`rounded-xl border border-slate-700 p-3 space-y-2 ${g.tone.row}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><p className="text-sm text-white">{p.teacherName} · {p.courseCode} {p.courseName}</p>
                    <p className="text-xs text-slate-400">{p.units.length} แถว · {totalHours(p.units)} ชม. · {isProjectReady(p) ? 'ครบองค์ประกอบหลัก' : 'ร่าง/ยังไม่ครบ'}</p></div>
                  <button className="px-3 py-1.5 rounded-lg text-xs border border-slate-600 text-slate-300 cursor-pointer" onClick={() => setOpenId(openId === p.id ? '' : p.id)}>{openId === p.id ? 'ซ่อน' : 'ดู'}</button>
                </div>
                {openId === p.id && <TeachingProjectView p={p} />}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
