import React, { useEffect, useMemo, useState } from 'react';
import { decideConductChange, resolveConduct, subscribePendingChanges, subscribePendingConduct } from '../../services/conductService';
import { useConductActor } from '../../hooks/useConductActor';
import {
  CHANGE_ACTION_LABEL, CONDUCT_NOTE_MAX, OFFENCE_LEVEL_CAP, OFFENCE_LEVEL_LABEL, maxPointsFor,
  type ConductChangeRequest, type ConductEntry, type OffenceLevel,
} from '../../lib/conduct';

const field = 'rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100';

function PendingItem({ e }: { e: ConductEntry }) {
  const actor = useConductActor();
  const [level, setLevel] = useState<OffenceLevel>(e.level);
  const [points, setPoints] = useState(String(e.points));
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const run = async (approve: boolean) => {
    setMsg('');
    try { await resolveConduct(e.id, { approve, appliedPoints: Number(points), level, note }, actor); }
    catch (err) { setMsg((err as Error).message); }
  };
  const isAdd = e.kind === 'ADD';
  return (
    <div className="py-3 space-y-2 text-sm">
      <p><b>{e.studentName}</b> ({e.studentId}) {e.room} — {isAdd ? <span className="text-emerald-300">ขอเพิ่ม {e.points} คะแนน</span> : <span className="text-rose-300">ส่งเรื่องให้หัก (เสนอ {e.points} คะแนน · ระดับ{OFFENCE_LEVEL_LABEL[e.level]})</span>}</p>
      <p className="text-xs text-slate-400">{e.category ? `${e.category} · ` : ''}{e.reason} · ส่งโดย {e.createdByName} ({e.date})</p>
      <div className="grid gap-2 sm:grid-cols-4">
        {!isAdd && (
          <select aria-label="ระดับความผิด" className={field} value={level} onChange={ev => setLevel(ev.target.value as OffenceLevel)}>
            {(Object.keys(OFFENCE_LEVEL_CAP) as Array<keyof typeof OFFENCE_LEVEL_CAP>).map(l => <option key={l} value={l}>ระดับ{OFFENCE_LEVEL_LABEL[l]}</option>)}
          </select>
        )}
        <input aria-label="คะแนนที่มีผลจริง" type="number" min={1} max={maxPointsFor(e.kind, level)} className={field} value={points} onChange={ev => setPoints(ev.target.value)} />
        <input aria-label="หมายเหตุการพิจารณา" maxLength={CONDUCT_NOTE_MAX} placeholder="หมายเหตุ" className={`${field} sm:col-span-2`} value={note} onChange={ev => setNote(ev.target.value)} />
        <button className="rounded-lg bg-lime-500 text-slate-950 font-semibold px-3 py-2" onClick={() => run(true)}>{isAdd ? 'อนุมัติ' : 'หักคะแนน'}</button>
        <button className="rounded-lg bg-slate-700 text-slate-100 font-semibold px-3 py-2" onClick={() => run(false)}>ไม่อนุมัติ</button>
      </div>
      {msg && <p role="alert" className="text-xs text-amber-300">{msg}</p>}
    </div>
  );
}

function ChangeItem({ r, name }: { r: ConductChangeRequest; name: string }) {
  const actor = useConductActor();
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const run = async (approve: boolean) => {
    setMsg('');
    try { await decideConductChange(r, { approve, note }, actor); } catch (err) { setMsg((err as Error).message); }
  };
  return (
    <div className="py-3 space-y-2 text-sm">
      <p><b>{name}</b> ({r.studentId}) — {CHANGE_ACTION_LABEL[r.action]} {r.action === 'EDIT' ? `จาก ${r.beforePoints} เป็น ${r.newPoints} คะแนน` : `(${r.beforePoints} คะแนน)`}</p>
      <p className="text-xs text-slate-400">เหตุผล: {r.reason} · ผู้ยื่น (ผู้บันทึกรายการเดิม) {r.requestedByName}</p>
      <div className="grid gap-2 sm:grid-cols-4">
        <input aria-label="หมายเหตุการพิจารณา" maxLength={CONDUCT_NOTE_MAX} placeholder="หมายเหตุ" className={`${field} sm:col-span-2`} value={note} onChange={e => setNote(e.target.value)} />
        <button className="rounded-lg bg-lime-500 text-slate-950 font-semibold px-3 py-2" onClick={() => run(true)}>อนุมัติ</button>
        <button className="rounded-lg bg-slate-700 text-slate-100 font-semibold px-3 py-2" onClick={() => run(false)}>ไม่อนุมัติ</button>
      </div>
      {msg && <p role="alert" className="text-xs text-amber-300">{msg}</p>}
    </div>
  );
}

/** งานกิจการ: รายการที่ครูส่งมา (เกิน 5 คะแนน) */
export function ConductReviewPanel() {
  const [list, setList] = useState<ConductEntry[]>([]);
  const [err, setErr] = useState('');
  useEffect(() => subscribePendingConduct(setList, e => setErr(e.message)), []);
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">เรื่องที่ครูส่งมาเกิน 5 คะแนน — เพิ่มคะแนน = พิจารณาอนุมัติ, หักคะแนน = งานกิจการเป็นผู้กำหนดและหักเอง (เพดาน เบา ≤5 / ปานกลาง ≤10 / ร้ายแรง ≤20)</p>
      {err && <p role="alert" className="text-xs text-amber-300">{err}</p>}
      {list.length === 0 ? <p className="text-sm text-slate-400 border border-dashed border-slate-700 rounded-xl p-6 text-center">ไม่มีเรื่องรอพิจารณา</p>
        : <ul className="divide-y divide-slate-800">{list.map(e => <li key={e.id}><PendingItem e={e} /></li>)}</ul>}
    </div>
  );
}

/** งานกิจการ: คำร้องขอแก้/ยกเลิกรายการจากผู้บันทึก */
export function ConductChangesPanel({ nameOf }: { nameOf: (studentId: string) => string }) {
  const [list, setList] = useState<ConductChangeRequest[]>([]);
  const [err, setErr] = useState('');
  useEffect(() => subscribePendingChanges(setList, e => setErr(e.message)), []);
  const sorted = useMemo(() => [...list], [list]);
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">การแก้/ยกเลิกคะแนนทำได้เมื่อมีคำร้องพร้อมเหตุผลจากผู้ที่บันทึกรายการนั้นเท่านั้น — รายการไม่ถูกลบ ประวัติคงอยู่ในระบบ</p>
      {err && <p role="alert" className="text-xs text-amber-300">{err}</p>}
      {sorted.length === 0 ? <p className="text-sm text-slate-400 border border-dashed border-slate-700 rounded-xl p-6 text-center">ไม่มีคำร้องรอพิจารณา</p>
        : <ul className="divide-y divide-slate-800">{sorted.map(r => <li key={r.id}><ChangeItem r={r} name={nameOf(r.studentId)} /></li>)}</ul>}
    </div>
  );
}
