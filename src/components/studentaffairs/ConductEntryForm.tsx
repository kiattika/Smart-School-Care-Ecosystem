import React, { useState } from 'react';
import { submitConduct } from '../../services/conductService';
import { useConductActor } from '../../hooks/useConductActor';
import {
  CONDUCT_CATEGORY_MAX, CONDUCT_REASON_MAX, OFFENCE_LEVEL_CAP, OFFENCE_LEVEL_LABEL, TEACHER_SELF_LIMIT, maxPointsFor, planConductEntry,
  type ConductKind, type OffenceLevel,
} from '../../lib/conduct';

/**
 * ฟอร์มเพิ่ม/หักคะแนนความประพฤติ (ใช้ทั้งครูและงานกิจการ)
 * ครู ≤ 5 คะแนน = มีผลทันที; เกิน 5 = ส่งเรื่องให้งานกิจการพิจารณา (เพิ่ม = อนุมัติ, หัก = งานกิจการหักเอง); งานกิจการ = มีผลทันที
 */
export function ConductEntryForm({ studentId, onDone }: { studentId: string; onDone?: () => void }) {
  const actor = useConductActor();
  const [kind, setKind] = useState<ConductKind>('DEDUCT');
  const [level, setLevel] = useState<OffenceLevel>('LIGHT');
  const [points, setPoints] = useState('1');
  const [category, setCategory] = useState('');
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const lvl: OffenceLevel = kind === 'ADD' ? 'NONE' : level === 'NONE' ? 'LIGHT' : level;
  const pts = Number(points);
  const plan = planConductEntry({ kind, level: lvl, points: pts, reason: reason || '-', category }, actor.isAffairs);
  const hint = 'error' in plan ? plan.error
    : plan.mode === 'APPLY' ? 'บันทึกแล้วมีผลทันที'
      : kind === 'ADD' ? 'เกิน 5 คะแนน — จะส่งให้งานกิจการนักเรียนพิจารณาอนุมัติ' : 'เกิน 5 คะแนน — จะส่งเรื่องให้งานกิจการนักเรียนพิจารณาหักเอง';

  const submit = async () => {
    setBusy(true); setMsg('');
    try {
      const r = await submitConduct(studentId, { kind, level: lvl, points: pts, reason, category }, actor);
      setMsg(r === 'APPLIED' ? 'บันทึกคะแนนแล้ว' : 'ส่งเรื่องให้งานกิจการนักเรียนแล้ว');
      setReason(''); setCategory(''); setPoints('1');
      onDone?.();
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };

  const field = 'rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100';
  return (
    <div className="space-y-3 text-sm">
      <div className="flex gap-2">
        {(['ADD', 'DEDUCT'] as const).map(k => (
          <button key={k} type="button" onClick={() => setKind(k)} className={`flex-1 rounded-lg px-3 py-2 font-semibold border ${kind === k ? (k === 'ADD' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300' : 'bg-rose-500/20 border-rose-500/50 text-rose-300') : 'border-slate-700 text-slate-400'}`}>
            {k === 'ADD' ? 'เพิ่มคะแนน' : 'หักคะแนน'}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {kind === 'DEDUCT' && (
          <select aria-label="ระดับความผิด" className={field} value={lvl} onChange={e => setLevel(e.target.value as OffenceLevel)}>
            {(Object.keys(OFFENCE_LEVEL_CAP) as Array<keyof typeof OFFENCE_LEVEL_CAP>).map(l => <option key={l} value={l}>ความผิดระดับ{OFFENCE_LEVEL_LABEL[l]} (หักได้ไม่เกิน {OFFENCE_LEVEL_CAP[l]})</option>)}
          </select>
        )}
        <input aria-label="คะแนน" type="number" min={1} max={maxPointsFor(kind, lvl)} className={field} value={points} onChange={e => setPoints(e.target.value)} />
        <input aria-label="หมวดความผิด/ความดี" maxLength={CONDUCT_CATEGORY_MAX} placeholder="หมวดความผิด/ความดี (ถ้ามี)" className={`${field} sm:col-span-2`} value={category} onChange={e => setCategory(e.target.value)} />
        <textarea aria-label="เหตุผล" maxLength={CONDUCT_REASON_MAX} rows={2} placeholder="เหตุผล/เหตุการณ์ที่เกิดขึ้น (จำเป็น)" className={`${field} sm:col-span-2`} value={reason} onChange={e => setReason(e.target.value)} />
      </div>
      <p className="text-xs text-slate-400">{hint}{!actor.isAffairs && ` · ครูเพิ่ม/หักได้ครั้งละไม่เกิน ${TEACHER_SELF_LIMIT} คะแนน`}</p>
      <button disabled={busy || !reason.trim() || 'error' in plan} onClick={submit} className="w-full rounded-lg bg-lime-500 text-slate-950 font-semibold px-4 py-2 disabled:opacity-40">บันทึก</button>
      {msg && <p role="status" className="text-xs text-slate-300">{msg}</p>}
    </div>
  );
}
