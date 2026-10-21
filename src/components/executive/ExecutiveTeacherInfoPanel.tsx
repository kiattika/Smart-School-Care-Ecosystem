import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useStore } from '../../store';
import { useDepartments } from '../../hooks/useDepartments';
import { useCurrentSemester } from '../../hooks/useCurrentSemester';
import { useAllSchedules } from '../../hooks/useAllSchedules';
import { useLessonPlans } from '../../hooks/useLessonPlans';
import { useTeachingProjects } from '../../hooks/useTeachingProjects';
import { usePlcLogs } from '../../hooks/usePlcAndReflections';
import { useRoundObservations, useSupervisionRounds } from '../../hooks/useSupervision';
import { overviewQuery } from '../../lib/supervisionView';
import { complianceOf, COMPLIANCE_LABEL, semesterIdOf, type PlanQuery } from '../../lib/lessonPlans';
import { computeTeacherStats, getStats, semesterDateRange, STAT_KINDS, STAT_LABEL } from '../../lib/teacherStats';
import { filterTeacherRows, staffFullName, teachingLoadFor, type StaffLike } from '../../lib/executiveTeacherInfo';
import { inactiveStaffLabelTh } from '../../lib/staffStatusReasons';

const ALL: PlanQuery = { scope: 'ALL' };
const Box = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 space-y-2">{children}</div>
);

/**
 * ข้อมูลครูรายบุคคล (แสดงชื่อ) — เฉพาะกลุ่มผู้บริหาร (EXECUTIVE + รองผอ.งบประมาณ/บุคคล/ทั่วไป)
 * อ่านอย่างเดียว: สถิติลา/สอนแทน/แลกคาบ, ผลนิเทศ + แผน/โครงการสอน + PLC, ภาระงานสอน, ข้อมูลบุคลากร
 */
export function ExecutiveTeacherInfoPanel() {
  const staff = useStore(s => s.staffDirectory) as StaffLike[];
  const assignments = useStore(s => s.substituteAssignments);
  const roles = (useStore(s => s.user?.profile?.roles) || []) as string[];
  const sem = useCurrentSemester();
  const semesterId = semesterIdOf(sem.academicYear, sem.term);
  const { departments } = useDepartments();
  const schedules = useAllSchedules();
  const plans = useLessonPlans(semesterId, ALL);
  const projects = useTeachingProjects(semesterId, ALL);
  const plc = usePlcLogs(semesterId, ALL);
  const { data: rounds } = useSupervisionRounds();
  const round = rounds.find(r => r.academicYear === sem.academicYear && r.term === sem.term) || null;
  const obs = useRoundObservations(round?.id || null, overviewQuery(roles));

  const [query, setQuery] = useState('');
  const [dept, setDept] = useState('');
  const [inactive, setInactive] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const stats = useMemo(() => computeTeacherStats(assignments, semesterDateRange(sem.academicYear, sem.term)), [assignments, sem.academicYear, sem.term]);
  const rows = useMemo(() => filterTeacherRows(
    staff.map(s => ({ staff: s, name: staffFullName(s), load: teachingLoadFor(s, schedules.data) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'th')),
    { query, departmentId: dept, includeInactive: inactive },
  ), [staff, schedules.data, query, dept, inactive]);
  const deptName = (id?: string) => departments.find(d => d.id === id)?.name || '';
  const errors = [schedules.error, plans.error, projects.error, plc.error, obs.error].filter(Boolean);

  return (
    <div className="max-w-6xl mx-auto space-y-4 relative z-10">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="ค้นหาชื่อ / อีเมล / ตำแหน่ง"
            className="bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-sm text-white w-64" />
        </div>
        <select value={dept} onChange={e => setDept(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white">
          <option value="">ทุกกลุ่มสาระฯ</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <label className="text-xs text-slate-400 flex items-center gap-1.5">
          <input type="checkbox" checked={inactive} onChange={e => setInactive(e.target.checked)} /> รวมบุคลากรที่ปิดการใช้งาน
        </label>
        <span className="text-xs text-slate-500 ml-auto">ภาคเรียน {sem.term}/{sem.academicYear} · {rows.length} คน</span>
      </div>
      {errors.length > 0 && <p role="alert" className="text-sm text-amber-300">โหลดข้อมูลบางส่วนไม่สำเร็จ: {errors.join(' · ')}</p>}
      {!round && <p className="text-xs text-slate-500">ยังไม่มีรอบนิเทศของภาคเรียนนี้ — ส่วนผลนิเทศจะว่าง</p>}

      {rows.length === 0 ? (
        <p className="text-sm text-slate-400">{staff.length === 0 ? 'ยังไม่มีข้อมูลบุคลากร' : 'ไม่พบบุคลากรตามเงื่อนไข'}</p>
      ) : (
        <div className="space-y-2">
          {rows.map(({ staff: s, name, load }) => {
            const st = getStats(stats, s.email);
            const myPlans = plans.data.filter(p => p.teacherStaffId === s.id);
            const myProjects = projects.data.filter(p => p.teacherStaffId === s.id || (p.coTeacherStaffIds || []).includes(s.id));
            const myPlc = plc.data.filter(l => l.authorStaffId === s.id || (l.memberStaffIds || []).includes(s.id));
            const myObs = obs.data.filter(o => o.teacherStaffId === s.id);
            const open = openId === s.id;
            const inactiveStaff = s.status === 'INACTIVE';
            return (
              <div key={s.id} className="rounded-xl border border-white/10 bg-slate-900/40">
                <button type="button" onClick={() => setOpenId(open ? null : s.id)} aria-expanded={open}
                  className="w-full text-left px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-1">
                  <span className="font-semibold text-white min-w-[12rem]">{name}{inactiveStaff && <span className="ml-2 text-xs text-slate-400">(ปิดการใช้งาน)</span>}</span>
                  <span className="text-xs text-slate-400">{s.position || '—'} · {deptName(s.assignments?.departmentId) || 'ไม่ระบุกลุ่มสาระฯ'}</span>
                  <span className="text-xs text-slate-300 ml-auto">สอน {load.periodsPerWeek} คาบ/สัปดาห์ · {load.subjects} วิชา</span>
                </button>
                {open && (
                  <div className="px-4 pb-4 grid gap-3 md:grid-cols-2">
                    <Box>
                      <h4 className="text-sm font-bold text-white">ข้อมูลบุคลากร</h4>
                      <p className="text-xs text-slate-300">อีเมล: {s.email || '—'}</p>
                      <p className="text-xs text-slate-300">ตำแหน่ง: {s.position || '—'}</p>
                      <p className="text-xs text-slate-300">กลุ่มสาระฯ: {deptName(s.assignments?.departmentId) || '—'}{s.assignments?.homeroomClass ? ` · ครูที่ปรึกษา ${s.assignments.homeroomClass}` : ''}</p>
                      <p className="text-xs text-slate-300">สถานะ: {inactiveStaff ? inactiveStaffLabelTh(s.statusReason) : 'ใช้งานอยู่'}</p>
                    </Box>
                    <Box>
                      <h4 className="text-sm font-bold text-white">ภาระงานสอน (ภาคเรียนนี้)</h4>
                      <p className="text-xs text-slate-300">{load.periodsPerWeek} คาบ/สัปดาห์ · {load.subjects} รายวิชา · {load.classes} ห้อง</p>
                      {load.periodsPerWeek === 0 && <p className="text-xs text-slate-500">ไม่พบตารางสอนที่ผูกกับบุคลากรคนนี้</p>}
                    </Box>
                    <Box>
                      <h4 className="text-sm font-bold text-white">สถิติลา / สอนแทน / แลกคาบ</h4>
                      <ul className="text-xs text-slate-300 grid grid-cols-2 gap-x-4">
                        {STAT_KINDS.map(k => <li key={k}>{STAT_LABEL[k]}: {st[k].periods} คาบ ({st[k].days} วัน)</li>)}
                      </ul>
                      <p className="text-xs text-slate-500">นับเฉพาะรายการที่อนุมัติครบแล้ว{st.pending > 0 ? ` · รออนุมัติ ${st.pending} รายการ` : ''}</p>
                    </Box>
                    <Box>
                      <h4 className="text-sm font-bold text-white">ผลนิเทศการสอน</h4>
                      {myObs.length === 0 ? <p className="text-xs text-slate-500">ยังไม่มีผลนิเทศที่ส่งแล้วในรอบนี้</p> : myObs.map(o => (
                        <p key={o.id} className="text-xs text-slate-300">{o.courseName || o.courseCode} · {o.observedDate} · {o.percent === null ? '—' : `${Math.round(o.percent)}%`}{o.band ? ` (${o.band})` : ''}</p>
                      ))}
                    </Box>
                    <Box>
                      <h4 className="text-sm font-bold text-white">แผน / โครงการสอน</h4>
                      <p className="text-xs text-slate-300">{COMPLIANCE_LABEL[complianceOf(myPlans)]}</p>
                      <p className="text-xs text-slate-300">แผน/โครงการที่ส่ง {myPlans.length} รายการ · โครงการสอนรายสัปดาห์ {myProjects.length} ฉบับ</p>
                    </Box>
                    <Box>
                      <h4 className="text-sm font-bold text-white">PLC</h4>
                      <p className="text-xs text-slate-300">{myPlc.length === 0 ? 'ยังไม่มีบันทึก PLC ในภาคเรียนนี้' : `${myPlc.length} ครั้ง (ผู้บันทึกหรือสมาชิก)`}</p>
                    </Box>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <p className="text-xs text-slate-500">ข้อมูลส่วนบุคคลสำหรับผู้บริหารเท่านั้น — อ่านอย่างเดียว ไม่เผยแพร่ต่อ</p>
    </div>
  );
}
