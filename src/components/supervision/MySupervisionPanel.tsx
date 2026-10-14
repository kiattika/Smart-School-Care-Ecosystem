import React, { useMemo, useState } from 'react';
import { useStore } from '../../store';
import { useRoundObservations, useSupervisionRounds } from '../../hooks/useSupervision';
import { ObservationResultView } from './ObservationResultView';
import { OBS_STATUS_LABEL, observationStatus } from '../../lib/supervisionView';

/** ผลการนิเทศของตนเอง (ครูผู้รับการนิเทศ) — เห็นเฉพาะที่ส่งผลแล้ว + กดรับทราบได้ */
export function MySupervisionPanel() {
  const staffId = useStore(s => s.user?.staffId) || '';
  const { data: rounds, error: rErr } = useSupervisionRounds();
  const [pick, setPick] = useState('');
  const roundId = rounds.find(r => r.id === pick)?.id || rounds[0]?.id || null;
  const q = useMemo(() => (staffId ? ({ scope: 'SELF', staffId } as const) : null), [staffId]);
  const { data, loading, error } = useRoundObservations(roundId, q);
  const obs = data[0] || null;

  if (rErr || error) return <p role="alert" className="text-sm text-amber-300">โหลดผลการนิเทศไม่สำเร็จ: {rErr || error}</p>;
  if (!roundId) return <p className="text-sm text-slate-400">ยังไม่มีรอบนิเทศ</p>;
  return (
    <div className="space-y-4">
      <label className="text-xs text-slate-400 flex items-center gap-2">รอบนิเทศ
        <select className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white" value={roundId} onChange={e => setPick(e.target.value)}>
          {rounds.map(r => <option key={r.id} value={r.id}>ภาคเรียน {r.term}/{r.academicYear}</option>)}
        </select>
      </label>
      {loading ? <p className="text-sm text-slate-400">กำลังโหลด…</p>
        : obs ? <ObservationResultView obs={obs} asTeacher />
          : <p className="text-sm text-slate-400">ยังไม่มีผลการนิเทศของท่านในรอบนี้ ({OBS_STATUS_LABEL[observationStatus(null)]})</p>}
    </div>
  );
}
