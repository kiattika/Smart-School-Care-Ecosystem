import React, { useEffect, useState } from 'react';
import { requestConductChange, subscribeMyChanges, subscribeMyConduct } from '../../services/conductService';
import { useConductActor } from '../../hooks/useConductActor';
import {
  CHANGE_ACTION_LABEL, CHANGE_STATUS_LABEL, CONDUCT_REASON_MAX, CONDUCT_STATUS_LABEL, OFFENCE_LEVEL_LABEL,
  type ChangeAction, type ConductChangeRequest, type ConductEntry,
} from '../../lib/conduct';

const field = 'rounded-lg bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs text-slate-100';

function EntryRow({ e, pending }: { e: ConductEntry; pending?: ConductChangeRequest }) {
  const actor = useConductActor();
  const [open, setOpen] = useState<ChangeAction | null>(null);
  const [pts, setPts] = useState(String(e.appliedPoints));
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState('');
  const send = async () => {
    if (!open) return;
    setMsg('');
    try {
      await requestConductChange(e, { action: open, newPoints: open === 'EDIT' ? Number(pts) : null, reason }, actor);
      setOpen(null); setReason('');
    } catch (err) { setMsg((err as Error).message); }
  };
  return (
    <li className="py-2 text-xs space-y-1.5">
      <p>
        <span className={e.kind === 'ADD' ? 'text-emerald-300' : 'text-rose-300'}>{e.kind === 'ADD' ? '+' : '-'}{e.status === 'PENDING' || e.status === 'REJECTED' ? e.points : e.appliedPoints}</span>
        {' '}{e.kind === 'DEDUCT' && `(ระดับ${OFFENCE_LEVEL_LABEL[e.level]}) `}{e.reason}
        <span className="text-slate-500"> · {e.date} · {CONDUCT_STATUS_LABEL[e.status]}</span>
      </p>
      {pending && <p className="text-amber-300">คำร้อง{CHANGE_ACTION_LABEL[pending.action]}รอพิจารณา</p>}
      {e.status === 'APPLIED' && !pending && (
        open ? (
          <div className="grid gap-2 sm:grid-cols-4">
            {open === 'EDIT' && <input aria-label="คะแนนใหม่" type="number" min={1} className={field} value={pts} onChange={ev => setPts(ev.target.value)} />}
            <input aria-label="เหตุผลคำร้อง" maxLength={CONDUCT_REASON_MAX} placeholder="เหตุผลประกอบคำร้อง (จำเป็น)" className={`${field} sm:col-span-2`} value={reason} onChange={ev => setReason(ev.target.value)} />
            <div className="flex gap-2"><button className="rounded bg-lime-500 text-slate-950 font-semibold px-3 py-1.5" onClick={send}>ส่งคำร้อง</button><button className="rounded bg-slate-700 px-3 py-1.5" onClick={() => setOpen(null)}>ยกเลิก</button></div>
          </div>
        ) : (
          <div className="flex gap-3"><button className="text-sky-300 underline" onClick={() => setOpen('EDIT')}>ขอแก้คะแนน</button><button className="text-rose-300 underline" onClick={() => setOpen('DELETE')}>ขอยกเลิกรายการ</button></div>
        )
      )}
      {msg && <p role="alert" className="text-amber-300">{msg}</p>}
    </li>
  );
}

/** ครู: รายการที่ฉันบันทึกให้นักเรียนคนนี้ + ยื่นคำร้องขอแก้/ยกเลิก (งานกิจการเป็นผู้พิจารณา) */
export function MyConductEntriesPanel({ studentId }: { studentId: string }) {
  const actor = useConductActor();
  const [entries, setEntries] = useState<ConductEntry[]>([]);
  const [changes, setChanges] = useState<ConductChangeRequest[]>([]);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!actor.staffId) return;
    const a = subscribeMyConduct(actor.staffId, setEntries, e => setErr(e.message));
    const b = subscribeMyChanges(actor.staffId, setChanges, e => setErr(e.message));
    return () => { a(); b(); };
  }, [actor.staffId]);
  const mine = entries.filter(e => e.studentId === studentId).slice(0, 20);
  if (!actor.staffId) return null;
  return (
    <div>
      <div className="text-xs text-slate-400 mb-2 font-bold uppercase tracking-wider">รายการที่ฉันบันทึก (ขอแก้/ยกเลิกได้ ผ่านงานกิจการ)</div>
      {err && <p role="alert" className="text-xs text-amber-300">{err}</p>}
      {mine.length === 0 ? <p className="text-xs text-slate-500">ยังไม่มีรายการ</p>
        : <ul className="divide-y divide-white/5">{mine.map(e => <li key={e.id}><EntryRow e={e} pending={changes.find(c => c.entryId === e.id && c.status === 'PENDING')} /></li>)}</ul>}
    </div>
  );
}
