import React, { useState } from 'react';
import { useStore } from '../../store';
import { useRoundObservations, useSupervisionRounds } from '../../hooks/useSupervision';
import { isObservableTeacher, overviewQuery, type StaffRow } from '../../lib/supervisionView';
import { SupervisionOverviewPanel } from './SupervisionOverviewPanel';

/** หน้าผู้บริหาร: ภาพรวมการนิเทศทั้งโรงเรียนเท่านั้น (ไม่มีชื่อ/คะแนนรายบุคคล) */
export function ExecutiveSupervisionOverview() {
  const roles = (useStore(s => s.user?.profile?.roles) || []) as string[];
  const staff = useStore(s => s.staffDirectory) as StaffRow[];
  const { data: rounds, error: rErr } = useSupervisionRounds();
  const [pick, setPick] = useState('');
  const round = rounds.find(r => r.id === pick) || rounds[0] || null;
  const q = overviewQuery(roles);
  const { data, loading, error } = useRoundObservations(round?.id || null, q);

  if (rErr || error) return <p role="alert" className="text-sm text-amber-300 max-w-6xl mx-auto">โหลดภาพรวมการนิเทศไม่สำเร็จ: {rErr || error}</p>;
  if (!round) return <p className="text-sm text-slate-400 max-w-6xl mx-auto">ยังไม่มีรอบนิเทศ</p>;
  return (
    <div className="max-w-6xl mx-auto space-y-4 relative z-10">
      <label className="text-xs text-slate-400 flex items-center gap-2">รอบนิเทศ
        <select className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white" value={round.id} onChange={e => setPick(e.target.value)}>
          {rounds.map(r => <option key={r.id} value={r.id}>ภาคเรียน {r.term}/{r.academicYear}</option>)}
        </select>
      </label>
      {loading ? <p className="text-sm text-slate-400">กำลังโหลด…</p>
        : <SupervisionOverviewPanel title={`ภาพรวมการนิเทศทั้งโรงเรียน ภาคเรียน ${round.term}/${round.academicYear}`} observations={data} totalTeachers={staff.filter(isObservableTeacher).length} />}
    </div>
  );
}
