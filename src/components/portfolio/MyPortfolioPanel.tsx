import React, { useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
import { useStore } from '../../store';
import { useCurrentSemester } from '../../hooks/useCurrentSemester';
import { useDepartments } from '../../hooks/useDepartments';
import { useLessonPlans } from '../../hooks/useLessonPlans';
import { useTeachingProjects } from '../../hooks/useTeachingProjects';
import { usePlcLogs, useReflections } from '../../hooks/usePlcAndReflections';
import { useRoundObservations } from '../../hooks/useSupervision';
import { semesterIdOf, complianceOf, COMPLIANCE_LABEL } from '../../lib/lessonPlans';
import { groupPlcCycles, isCycleComplete } from '../../lib/plc';
import { isReflectionComplete } from '../../lib/reflection';
import { semesterRange, summarizePostTeaching } from '../../lib/portfolio';
import { isProjectReady } from '../../lib/teachingProject';
import { staffDepartmentId, type StaffRow } from '../../lib/supervisionView';
import { PortfolioSheet, type PortfolioData } from './PortfolioSheet';

/** แฟ้มสะสมงานของครู: สรุปความครบถ้วนของงานในภาคเรียน + พิมพ์/บันทึกเป็น PDF */
export function MyPortfolioPanel() {
  const user = useStore(s => s.user);
  const staff = useStore(s => s.staffDirectory) as StaffRow[];
  const records = useStore(s => s.postTeachingRecords);
  const sem = useCurrentSemester();
  const { nameOf } = useDepartments();
  const staffId = user?.staffId || '';
  const semesterId = semesterIdOf(sem.academicYear, sem.term);
  const q = useMemo(() => (staffId ? ({ scope: 'SELF', staffId } as const) : null), [staffId]);
  const projects = useTeachingProjects(semesterId, q);
  const plans = useLessonPlans(semesterId, q);
  const plc = usePlcLogs(semesterId, q);
  const refl = useReflections(semesterId, q);
  const obs = useRoundObservations(semesterId, q);
  const [open, setOpen] = useState(false);

  if (!staffId) return <p className="text-sm text-slate-400">บัญชีนี้ไม่ได้เชื่อมกับทะเบียนบุคลากร</p>;
  const loading = projects.loading || plans.loading || plc.loading || refl.loading || obs.loading;
  const err = projects.error || plans.error || plc.error || refl.error || obs.error;
  const range = semesterRange(sem.academicYear, sem.term);
  const post = summarizePostTeaching(records, staffId, range.from, range.to);
  const me = staff.find(s => s.id === staffId);
  const deptId = staffDepartmentId(me);
  const submittedObs = obs.data.find(o => o.submitted) || null;
  const cycles = groupPlcCycles(plc.data);
  const reflection = refl.data[0] || null;

  const rows: [string, string, boolean][] = [
    ['โครงการสอน', `${projects.data.filter(isProjectReady).length}/${projects.data.length} ฉบับครบองค์ประกอบ`, projects.data.some(isProjectReady)],
    ['แผนการสอน (ลิงก์)', COMPLIANCE_LABEL[complianceOf(plans.data)], complianceOf(plans.data) === 'PLAN_APPROVED'],
    ['ผลการนิเทศ', submittedObs ? `ระดับ ${submittedObs.band || '-'} (${submittedObs.total}/100)` : 'ยังไม่มีผลที่ส่งแล้ว', !!submittedObs],
    ['บันทึกหลังสอน', `${post.total} ครั้ง (ล่าช้า ${post.late}, อ้างอิงโครงการสอน ${post.linkedToPlan})`, post.total > 0],
    ['PLC', `${cycles.length} วงจร (ครบ PDCA ${cycles.filter(c => isCycleComplete(c.steps)).length})`, cycles.some(c => isCycleComplete(c.steps))],
    ['บันทึกสะท้อนคิด', reflection ? (isReflectionComplete(reflection) ? 'กรอกครบแล้ว' : 'กรอกยังไม่ครบ') : 'ยังไม่ได้เขียน', !!reflection && isReflectionComplete(reflection)],
  ];
  const data: PortfolioData = {
    schoolName: 'โรงเรียนอุตรดิตถ์', teacherName: user?.displayName || '', departmentName: deptId ? String(nameOf(deptId) || '') : '',
    semesterLabel: sem.label, range, projects: projects.data, plans: plans.data, observation: submittedObs,
    postTeaching: post, plc: plc.data, reflection,
  };
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-sm">
        <p className="text-white font-medium">แฟ้มสะสมงานของฉัน ภาคเรียน {sem.label}</p>
        <p className="text-slate-400 mt-1">รวมงานทั้งหมดในระบบเป็นเอกสารเดียว พิมพ์หรือบันทึกเป็น PDF ได้ — ข้อมูลทุกอย่างมาจากสิ่งที่บันทึกไว้จริง ไม่มีค่าตัวอย่าง</p>
      </div>
      {err && <p role="alert" className="text-sm text-amber-300">โหลดข้อมูลบางส่วนไม่สำเร็จ: {err}</p>}
      {loading ? <p className="text-sm text-slate-400">กำลังโหลด…</p> : (
        <ul className="space-y-2">
          {rows.map(([label, value, ok]) => (
            <li key={label} className="flex items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-900/40 p-3 text-sm">
              <span className="text-white">{label}</span>
              <span className={ok ? 'text-emerald-300' : 'text-slate-300'}>{ok ? '✓ ' : ''}{value}</span>
            </li>
          ))}
        </ul>
      )}
      <button disabled={loading} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm bg-emerald-600 text-white disabled:opacity-40 cursor-pointer" onClick={() => setOpen(true)}><FileText className="w-4 h-4" /> ดู / พิมพ์แฟ้มสะสมงาน (PDF)</button>
      {open && <PortfolioSheet data={data} onClose={() => setOpen(false)} />}
    </div>
  );
}
