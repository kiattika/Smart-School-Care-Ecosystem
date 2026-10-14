import React, { useMemo, useState } from 'react';
import { useStore } from '../../store';
import { useCurrentSemester } from '../../hooks/useCurrentSemester';
import { useDepartments } from '../../hooks/useDepartments';
import { isStaffActive } from '../../lib/staffStatus';
import {
  STAT_KINDS, STAT_LABEL, academicYearDateRange, aggregateStats, computeTeacherStats, getStats, semesterDateRange,
  type GroupStats,
} from '../../lib/teacherStats';

type Scope = 'TERM' | 'YEAR';

function useRange() {
  const sem = useCurrentSemester();
  const [scope, setScope] = useState<Scope>('TERM');
  const range = scope === 'TERM' ? semesterDateRange(sem.academicYear, sem.term) : academicYearDateRange(sem.academicYear);
  const picker = (
    <label className="text-xs text-slate-400 flex items-center gap-2">ช่วงเวลา
      <select className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white" value={scope} onChange={e => setScope(e.target.value as Scope)}>
        <option value="TERM">ภาคเรียนปัจจุบัน ({sem.label})</option>
        <option value="YEAR">ปีการศึกษา {sem.academicYear} (ทั้งปี)</option>
      </select>
    </label>
  );
  return { range, picker };
}

const Card = ({ children }: { children: React.ReactNode }) => <div className="bg-[#161f30] border border-slate-800/80 rounded-xl p-4 sm:p-6 space-y-4">{children}</div>;

/** สถิติของตนเอง — ครูทุกคน */
export function MyTeachingStatsPanel() {
  const email = useStore(s => s.user?.email);
  const assignments = useStore(s => s.substituteAssignments);
  const { range, picker } = useRange();
  const stats = useMemo(() => getStats(computeTeacherStats(assignments, range), email), [assignments, range, email]);
  return (
    <div className="space-y-4">
      {picker}
      <Card>
        <h3 className="text-lg font-bold text-white">สถิติการปฏิบัติงานสอนของฉัน</h3>
        <p className="text-xs text-slate-400">นับเฉพาะรายการที่อนุมัติครบแล้ว ({range.from} ถึง {range.to}) — 1 รายการ = 1 คาบ</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {STAT_KINDS.map(k => (
            <div key={k} className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
              <p className="text-xs text-slate-400">{STAT_LABEL[k]}</p>
              <p className="text-2xl font-bold text-cyan-300">{stats[k].periods} <span className="text-xs font-normal text-slate-400">คาบ</span></p>
              <p className="text-xs text-slate-500">{stats[k].days} วัน</p>
            </div>
          ))}
        </div>
        {stats.pending > 0 && <p className="text-sm text-amber-300">มีรายการรออนุมัติอีก {stats.pending} คาบ (ยังไม่รวมในตัวเลขข้างบน)</p>}
      </Card>
    </div>
  );
}

function GroupTable({ rows }: { rows: { key: string; name: string; g: GroupStats }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-400 border-b border-slate-800">
            <th className="py-2 pr-3">กลุ่ม</th><th className="pr-3">ครู</th>
            {STAT_KINDS.map(k => <th key={k} className="pr-3">{STAT_LABEL[k]}<span className="block font-normal">คาบ (คน)</span></th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.key} className="border-b border-slate-800/60 text-slate-200">
              <td className="py-2 pr-3">{r.name}</td><td className="pr-3">{r.g.teachers}</td>
              {STAT_KINDS.map(k => <td key={k} className="pr-3">{r.g.totals[k].periods} <span className="text-slate-500">({r.g.totals[k].teachers})</span></td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * ภาพรวมระดับกลุ่มสาระฯ (หัวหน้า/รองหัวหน้ากลุ่มสาระฯ — เฉพาะกลุ่มตนเอง) หรือระดับโรงเรียน (รองผอ./ผอ./ผู้บริหาร)
 * เป็นตัวเลขรวม ไม่แสดงรายชื่อครู
 */
export function ActivityOverviewPanel({ level }: { level: 'DEPARTMENT' | 'SCHOOL' }) {
  const assignments = useStore(s => s.substituteAssignments);
  const staff = useStore(s => s.staffDirectory);
  const myId = useStore(s => s.user?.staffId);
  const { departments } = useDepartments();
  const { range, picker } = useRange();

  const model = useMemo(() => {
    const m = computeTeacherStats(assignments, range);
    const active = staff.filter(s => isStaffActive(s) && s.roles?.includes('SUBJECT_TEACHER'));
    const deptOf = (s: typeof staff[number]) => s.assignments?.departmentId || '';
    const myDept = deptOf(staff.find(s => s.id === myId) || ({ assignments: {} } as typeof staff[number]));
    const byDept = departments.map(d => ({
      key: d.id, name: d.name,
      g: aggregateStats(active.filter(s => deptOf(s) === d.id).map(s => s.email), m),
    })).filter(r => r.g.teachers > 0);
    const school = aggregateStats(active.map(s => s.email), m);
    return { byDept, school, myDept };
  }, [assignments, staff, departments, range, myId]);

  if (level === 'DEPARTMENT') {
    const row = model.byDept.find(r => r.key === model.myDept);
    return (
      <div className="space-y-4">
        {picker}
        <Card>
          <h3 className="text-lg font-bold text-white">ภาพรวมกลุ่มสาระฯ{row ? ` — ${row.name}` : ''}</h3>
          {row ? <GroupTable rows={[row]} /> : <p className="text-sm text-slate-400">บัญชีนี้ยังไม่ได้ระบุกลุ่มสาระฯ ในทะเบียนบุคลากร</p>}
          <p className="text-xs text-slate-500">นับเฉพาะรายการที่อนุมัติครบแล้ว · ตัวเลขในวงเล็บ = จำนวนครูที่มีรายการนั้น</p>
        </Card>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {picker}
      <Card>
        <h3 className="text-lg font-bold text-white">ภาพรวมการปฏิบัติงานสอนทั้งโรงเรียน</h3>
        <GroupTable rows={[{ key: 'ALL', name: 'ทั้งโรงเรียน', g: model.school }, ...model.byDept]} />
        <p className="text-xs text-slate-500">นับเฉพาะรายการที่อนุมัติครบแล้ว ({range.from} ถึง {range.to}) · ตัวเลขในวงเล็บ = จำนวนครูที่มีรายการนั้น</p>
      </Card>
    </div>
  );
}
