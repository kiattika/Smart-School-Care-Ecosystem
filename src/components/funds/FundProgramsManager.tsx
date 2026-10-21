import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '../../store';
import { DatePicker } from '../shared/DatePicker';
import { LinkListInput } from '../shared/LinkListInput';
import {
  FUND_AMOUNT_MAX, FUND_DESC_MAX, FUND_ELIGIBILITY_MAX, FUND_FUNDER_MAX, FUND_KIND_LABEL, FUND_LINKS_MAX, FUND_SELECTION_MAX, FUND_STATUS_LABEL,
  FUND_TITLE_MAX, INTEREST_NOTE_MAX, INTEREST_STATUS_LABEL, canStaffSetInterest, closesYmdOf, registrationLabel, toYmd,
  type FundInterest, type FundKind, type FundProgram, type FundProgramInput, type FundStatus, type InterestStatus,
} from '../../lib/fundPrograms';
import {
  decideInterest, deleteDraftFund, saveFundProgram, setFundStatus, subscribeFundPrograms, subscribeInterestsForProgram,
} from '../../services/fundService';

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'ดำเนินการไม่สำเร็จ');
const inp = 'w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white';
const EMPTY = (kind: FundKind): FundProgramInput => ({
  kind, title: '', funder: '', description: '', eligibility: '', amountText: '', selectionNote: '', links: [],
  registrationEnabled: false, opensYmd: '', closesYmd: '',
});
const fromProgram = (p: FundProgram): FundProgramInput => ({
  kind: p.kind, title: p.title, funder: p.funder, description: p.description, eligibility: p.eligibility, amountText: p.amountText,
  selectionNote: p.selectionNote, links: p.links, registrationEnabled: p.registrationEnabled,
  opensYmd: toYmd(p.registrationOpensAt), closesYmd: closesYmdOf(p.registrationClosesAt),
});

function ProgramForm({ kind, program, onDone }: { kind: FundKind; program: FundProgram | null; onDone: () => void }) {
  const user = useStore(s => s.user);
  const [f, setF] = useState<FundProgramInput>(program ? fromProgram(program) : EMPTY(kind));
  const [pending, setPending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = <K extends keyof FundProgramInput>(k: K, v: FundProgramInput[K]) => setF(x => ({ ...x, [k]: v }));
  const save = async (status: FundStatus) => {
    setBusy(true); setError('');
    try {
      await saveFundProgram(program?.id ?? null, f, status, { staffId: user?.staffId || '', name: user?.displayName || '' });
      onDone();
    } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-3 text-sm">
      <h3 className="font-bold text-slate-100">{program ? 'แก้ไข' : 'เพิ่ม'}{FUND_KIND_LABEL[kind]}</h3>
      {error && <p role="alert" className="text-xs text-rose-400">{error}</p>}
      <input className={inp} placeholder="ชื่อทุน / โครงการ *" maxLength={FUND_TITLE_MAX} value={f.title} onChange={e => set('title', e.target.value)} aria-label="ชื่อทุน" />
      <input className={inp} placeholder="ผู้ให้ทุน / หน่วยงาน" maxLength={FUND_FUNDER_MAX} value={f.funder} onChange={e => set('funder', e.target.value)} aria-label="ผู้ให้ทุน" />
      <input className={inp} placeholder="จำนวนเงิน / จำนวนทุน (ข้อความ เช่น 3,000 บาท/ภาคเรียน 5 ทุน)" maxLength={FUND_AMOUNT_MAX} value={f.amountText} onChange={e => set('amountText', e.target.value)} aria-label="จำนวนเงิน" />
      <textarea className={inp} rows={3} placeholder="รายละเอียด" maxLength={FUND_DESC_MAX} value={f.description} onChange={e => set('description', e.target.value)} aria-label="รายละเอียด" />
      <textarea className={inp} rows={2} placeholder="คุณสมบัติผู้สมัคร" maxLength={FUND_ELIGIBILITY_MAX} value={f.eligibility} onChange={e => set('eligibility', e.target.value)} aria-label="คุณสมบัติ" />
      <textarea className={inp} rows={2} placeholder="วิธีคัดเลือก (แต่ละผู้ให้ทุนไม่เหมือนกัน — เช่น พิจารณาจากเกรด/รายได้/สัมภาษณ์)" maxLength={FUND_SELECTION_MAX} value={f.selectionNote} onChange={e => set('selectionNote', e.target.value)} aria-label="วิธีคัดเลือก" />
      <div>
        <div className="text-xs text-slate-400 mb-1">ลิงก์ประกาศ / เอกสาร (https เท่านั้น)</div>
        <LinkListInput links={f.links} onChange={l => set('links', l)} max={FUND_LINKS_MAX} onPendingChange={setPending} />
      </div>
      <label className="flex items-center gap-2 text-slate-200">
        <input type="checkbox" checked={f.registrationEnabled} onChange={e => set('registrationEnabled', e.target.checked)} />
        เปิดให้นักเรียน/ผู้ปกครองลงชื่อ "สนใจ" ในระบบ (ไม่ติ๊ก = ประกาศให้ทราบอย่างเดียว)
      </label>
      {f.registrationEnabled && (
        <div className="grid sm:grid-cols-2 gap-2">
          <div><div className="text-xs text-slate-400 mb-1">เริ่มรับ (ว่าง = ทันทีที่ประกาศ)</div><DatePicker value={f.opensYmd} onChange={v => set('opensYmd', v)} clearable ariaLabel="วันเริ่มรับ" /></div>
          <div><div className="text-xs text-slate-400 mb-1">ปิดรับ (สิ้นวันที่) *</div><DatePicker value={f.closesYmd} onChange={v => set('closesYmd', v)} min={f.opensYmd || undefined} ariaLabel="วันปิดรับ" /></div>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button disabled={busy || pending} className="px-3 py-1.5 rounded-lg text-xs bg-cyan-600 text-white disabled:opacity-40 cursor-pointer" onClick={() => void save('PUBLISHED')}>ประกาศ</button>
        <button disabled={busy || pending} className="px-3 py-1.5 rounded-lg text-xs bg-slate-700 text-white disabled:opacity-40 cursor-pointer" onClick={() => void save('DRAFT')}>บันทึกฉบับร่าง</button>
        <button className="px-3 py-1.5 rounded-lg text-xs border border-slate-600 text-slate-300 cursor-pointer" onClick={onDone}>ยกเลิก</button>
      </div>
    </div>
  );
}

function InterestsPanel({ program }: { program: FundProgram }) {
  const user = useStore(s => s.user);
  const [list, setList] = useState<FundInterest[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  useEffect(() => subscribeInterestsForProgram(program.id, l => setList(l.sort((a, b) => (a.room || '').localeCompare(b.room || '', 'th') || a.studentId.localeCompare(b.studentId))), e => setError(e.message)), [program.id]);
  const decide = async (i: FundInterest, to: InterestStatus) => {
    setBusy(i.id); setError('');
    try { await decideInterest(i, to, notes[i.id] || '', { staffId: user?.staffId || '', name: user?.displayName || '' }, program.title); }
    catch (e) { setError(errMsg(e)); } finally { setBusy(''); }
  };
  const active = list.filter(i => i.status !== 'WITHDRAWN');
  return (
    <div className="mt-3 border-t border-slate-700 pt-3 space-y-2" data-testid="fund-interests">
      <div className="text-xs font-bold text-slate-300">ผู้ลงชื่อสนใจ {active.length} คน{list.length > active.length ? ` (ถอน ${list.length - active.length})` : ''}</div>
      {error && <p role="alert" className="text-xs text-rose-400">{error}</p>}
      {active.length === 0 && <p className="text-xs text-slate-500">ยังไม่มีผู้ลงชื่อ</p>}
      {active.map(i => (
        <div key={i.id} className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-100">{i.studentName || i.studentId}</span>
            <span className="text-slate-400">{i.studentId}{i.room ? ` · ${i.room}` : ''}</span>
            <span className="ml-auto px-2 py-0.5 rounded-full bg-slate-800 text-slate-200">{INTEREST_STATUS_LABEL[i.status]}</span>
          </div>
          {i.note && <p className="text-slate-400">หมายเหตุจากนักเรียน: {i.note}</p>}
          {i.staffNote && <p className="text-slate-400">บันทึกงานกองทุน: {i.staffNote}</p>}
          {(['SHORTLISTED', 'AWARDED', 'NOT_SELECTED'] as InterestStatus[]).some(to => canStaffSetInterest(i.status, to)) && (
            <div className="flex flex-wrap gap-2 items-center">
              <input className="flex-1 min-w-[10rem] bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white" maxLength={INTEREST_NOTE_MAX} placeholder="บันทึก (ถ้ามี)" value={notes[i.id] || ''} onChange={e => setNotes(n => ({ ...n, [i.id]: e.target.value }))} aria-label="บันทึกผล" />
              {(['SHORTLISTED', 'AWARDED', 'NOT_SELECTED'] as InterestStatus[]).filter(to => canStaffSetInterest(i.status, to)).map(to => (
                <button key={to} disabled={busy === i.id} className="px-2 py-1 rounded bg-slate-700 text-white disabled:opacity-40 cursor-pointer" onClick={() => void decide(i, to)}>{INTEREST_STATUS_LABEL[to]}</button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/** งานกองทุน: จัดการโปรแกรมทุนการศึกษา หรือ กยศ. + ดูผู้ลงชื่อสนใจและบันทึกผลคัดเลือก */
export function FundProgramsManager({ kind }: { kind: FundKind }) {
  const [programs, setPrograms] = useState<FundProgram[]>([]);
  const [editing, setEditing] = useState<FundProgram | 'new' | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState('');
  useEffect(() => subscribeFundPrograms(kind, 'STAFF', setPrograms, e => setError(e.message)), [kind]);
  const nowMs = Date.now();
  const act = async (fn: () => Promise<void>) => { setError(''); try { await fn(); } catch (e) { setError(errMsg(e)); } };
  const grouped = useMemo(() => programs, [programs]);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-bold text-slate-100">{FUND_KIND_LABEL[kind]}</h3>
        {editing === null && <button className="px-3 py-1.5 rounded-lg text-xs bg-cyan-600 text-white cursor-pointer" onClick={() => setEditing('new')}>+ เพิ่ม</button>}
      </div>
      {error && <p role="alert" className="text-xs text-rose-400">{error}</p>}
      {editing !== null && <ProgramForm kind={kind} program={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />}
      {grouped.length === 0 && editing === null && <p className="text-sm text-slate-500">ยังไม่มีรายการ</p>}
      {grouped.map(p => (
        <div key={p.id} className="bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-slate-100">{p.title}</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">{FUND_STATUS_LABEL[p.status]}</span>
            <span className="text-[11px] text-slate-400">{registrationLabel(p, nowMs)}</span>
          </div>
          {p.funder && <div className="text-xs text-slate-400">ผู้ให้ทุน: {p.funder}</div>}
          <div className="flex flex-wrap gap-2 mt-2">
            <button className="px-2.5 py-1 rounded bg-slate-700 text-white text-xs cursor-pointer" onClick={() => setEditing(p)}>แก้ไข</button>
            {p.status === 'PUBLISHED' && <button className="px-2.5 py-1 rounded bg-slate-700 text-white text-xs cursor-pointer" onClick={() => void act(() => setFundStatus(p.id, 'CLOSED'))}>ปิดโครงการ</button>}
            {p.status !== 'PUBLISHED' && <button className="px-2.5 py-1 rounded bg-slate-700 text-white text-xs cursor-pointer" onClick={() => void act(() => setFundStatus(p.id, 'PUBLISHED'))}>ประกาศ</button>}
            {p.status === 'DRAFT' && <button className="px-2.5 py-1 rounded bg-rose-900/60 text-rose-200 text-xs cursor-pointer" onClick={() => void act(() => deleteDraftFund(p.id))}>ลบฉบับร่าง</button>}
            {p.registrationEnabled && <button className="px-2.5 py-1 rounded bg-slate-700 text-white text-xs cursor-pointer" onClick={() => setOpen(open === p.id ? null : p.id)}>{open === p.id ? 'ซ่อนผู้ลงชื่อ' : 'ผู้ลงชื่อสนใจ'}</button>}
          </div>
          {open === p.id && <InterestsPanel program={p} />}
        </div>
      ))}
    </div>
  );
}
