import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '../../store';
import { DatePicker } from '../shared/DatePicker';
import {
  INTERNSHIP_LIMITS, INTERNSHIP_MAX_PERIODS, INTERNSHIP_STATUS_LABEL, canIssueLetter, canStaffDecide, thaiRange, validateSettingsInput,
  type InternshipPeriod, type InternshipRequest, type InternshipSettings, type InternshipSettingsInput, type InternshipStatus,
} from '../../lib/internship';
import { closesYmdOf, toYmd } from '../../lib/fundPrograms';
import { decideInternship, saveInternshipSettings, subscribeAllInternshipRequests, subscribeInternshipSettings } from '../../services/internshipService';
import { InternshipLetterModal } from './InternshipLetterModal';

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'ดำเนินการไม่สำเร็จ');
const inp = 'w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white';
const newId = () => `p_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const toInput = (s: InternshipSettings | null): InternshipSettingsInput => ({
  periods: s?.periods ?? [], purposeText: s?.purposeText ?? '', acceptanceFormText: s?.acceptanceFormText ?? '', signerName: s?.signerName ?? '',
  signerPosition: s?.signerPosition ?? '', registrationEnabled: s?.registrationEnabled ?? false,
  opensYmd: toYmd(s?.registrationOpensAt), closesYmd: closesYmdOf(s?.registrationClosesAt),
});

function SettingsPanel({ settings }: { settings: InternshipSettings | null }) {
  const user = useStore(s => s.user);
  const [f, setF] = useState<InternshipSettingsInput>(toInput(settings));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (!dirty) setF(toInput(settings)); }, [settings, dirty]);
  const upd = (patch: Partial<InternshipSettingsInput>) => { setF(x => ({ ...x, ...patch })); setDirty(true); setSaved(false); };
  const setPeriod = (id: string, patch: Partial<InternshipPeriod>) => upd({ periods: f.periods.map(p => (p.id === id ? { ...p, ...patch } : p)) });
  const save = async () => {
    setBusy(true); setError('');
    try { await saveInternshipSettings(f, { staffId: user?.staffId || '', name: user?.displayName || '' }); setDirty(false); setSaved(true); }
    catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  };
  const preview = validateSettingsInput(f);
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-3 text-sm">
      <h3 className="font-bold text-slate-100">ตั้งค่าการรับคำร้องขอฝึกงาน</h3>
      {error && <p role="alert" className="text-xs text-rose-400">{error}</p>}
      {saved && <p className="text-xs text-emerald-300">บันทึกการตั้งค่าแล้ว</p>}
      <div className="space-y-2">
        <div className="text-xs text-slate-400">ช่วงวันฝึกงานให้นักเรียนเลือก (สูงสุด {INTERNSHIP_MAX_PERIODS} ช่วง)</div>
        {f.periods.map(p => (
          <div key={p.id} className="grid sm:grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
            <input className={inp} placeholder="ชื่อช่วง เช่น ปิดภาคเรียนที่ 1" maxLength={INTERNSHIP_LIMITS.periodLabel} value={p.label} onChange={e => setPeriod(p.id, { label: e.target.value })} aria-label="ชื่อช่วงฝึกงาน" />
            <DatePicker value={p.startYmd} onChange={v => setPeriod(p.id, { startYmd: v })} ariaLabel="วันเริ่มฝึกงาน" />
            <DatePicker value={p.endYmd} onChange={v => setPeriod(p.id, { endYmd: v })} min={p.startYmd || undefined} ariaLabel="วันสิ้นสุดฝึกงาน" />
            <button className="px-2 py-1.5 rounded-lg text-xs border border-slate-600 text-slate-300 cursor-pointer" onClick={() => upd({ periods: f.periods.filter(x => x.id !== p.id) })}>ลบ</button>
          </div>
        ))}
        {f.periods.length < INTERNSHIP_MAX_PERIODS && (
          <button className="px-3 py-1.5 rounded-lg text-xs bg-slate-700 text-white cursor-pointer" onClick={() => upd({ periods: [...f.periods, { id: newId(), label: '', startYmd: '', endYmd: '' }] })}>+ เพิ่มช่วงฝึกงาน</button>
        )}
      </div>
      <textarea className={inp} rows={3} placeholder="ข้อความเหตุผล/วัตถุประสงค์ในหนังสือ (ใช้ข้อความเดียวกันทุกฉบับ)" maxLength={INTERNSHIP_LIMITS.purposeText} value={f.purposeText} onChange={e => upd({ purposeText: e.target.value })} aria-label="ข้อความเหตุผลและวัตถุประสงค์" />
      <textarea className={inp} rows={4} placeholder="แบบหนังสือตอบรับ (ข้อความที่พิมพ์แนบท้ายหนังสือ)" maxLength={INTERNSHIP_LIMITS.acceptanceFormText} value={f.acceptanceFormText} onChange={e => upd({ acceptanceFormText: e.target.value })} aria-label="แบบหนังสือตอบรับ" />
      <div className="grid sm:grid-cols-2 gap-2">
        <input className={inp} placeholder="ชื่อผู้ลงนามในหนังสือ" maxLength={INTERNSHIP_LIMITS.signer} value={f.signerName} onChange={e => upd({ signerName: e.target.value })} aria-label="ชื่อผู้ลงนาม" />
        <input className={inp} placeholder="ตำแหน่งผู้ลงนาม" maxLength={INTERNSHIP_LIMITS.signer} value={f.signerPosition} onChange={e => upd({ signerPosition: e.target.value })} aria-label="ตำแหน่งผู้ลงนาม" />
      </div>
      <label className="flex items-center gap-2 text-slate-200"><input type="checkbox" checked={f.registrationEnabled} onChange={e => upd({ registrationEnabled: e.target.checked })} /> เปิดรับคำร้องขอฝึกงาน</label>
      {f.registrationEnabled && (
        <div className="grid sm:grid-cols-2 gap-2">
          <div><div className="text-xs text-slate-400 mb-1">เริ่มรับ (ว่าง = ทันที)</div><DatePicker value={f.opensYmd} onChange={v => upd({ opensYmd: v })} clearable ariaLabel="วันเริ่มรับคำร้อง" /></div>
          <div><div className="text-xs text-slate-400 mb-1">ปิดรับ (สิ้นวันที่) *</div><DatePicker value={f.closesYmd} onChange={v => upd({ closesYmd: v })} min={f.opensYmd || undefined} ariaLabel="วันปิดรับคำร้อง" /></div>
        </div>
      )}
      {dirty && preview.length > 0 && <p className="text-xs text-amber-300">{preview.join(' / ')}</p>}
      <button disabled={busy || !dirty} className="px-3 py-1.5 rounded-lg text-xs bg-cyan-600 text-white disabled:opacity-40 cursor-pointer" onClick={() => void save()}>บันทึกการตั้งค่า</button>
    </div>
  );
}

function RequestRow({ r, settings, onLetter }: { r: InternshipRequest; settings: InternshipSettings | null; onLetter: (r: InternshipRequest) => void }) {
  const user = useStore(s => s.user);
  const [note, setNote] = useState(r.staffNote || '');
  const [no, setNo] = useState(r.letterNo || '');
  const [date, setDate] = useState(r.letterDateYmd || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const decide = async (to: 'APPROVED' | 'REJECTED') => {
    setBusy(true); setError('');
    try { await decideInternship(r, to, { staffNote: note, letterNo: no, letterDateYmd: date }, { staffId: user?.staffId || '', name: user?.displayName || '' }); }
    catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-slate-100">{r.studentName || r.studentId}</span>
        <span className="text-slate-400">{r.studentId}{r.room ? ` · ${r.room}` : ''}</span>
        <span className="ml-auto px-2 py-0.5 rounded-full bg-slate-800 text-slate-200">{INTERNSHIP_STATUS_LABEL[r.status]}</span>
      </div>
      <div className="text-slate-300"><b>{r.companyName}</b> — {r.companyAddress}</div>
      <div className="text-slate-300">ผู้บังคับบัญชา: {r.headName} ({r.headPosition}) · {r.periodLabel} ({thaiRange(r.startYmd, r.endYmd)})</div>
      {error && <p role="alert" className="text-rose-400">{error}</p>}
      {(canStaffDecide(r.status, 'APPROVED') || canStaffDecide(r.status, 'REJECTED')) && (
        <div className="space-y-1.5 pt-1">
          <input className={inp} placeholder="หมายเหตุถึงนักเรียน (ถ้ามี)" maxLength={INTERNSHIP_LIMITS.staffNote} value={note} onChange={e => setNote(e.target.value)} aria-label="หมายเหตุ" />
          <div className="grid sm:grid-cols-2 gap-2">
            <input className={inp} placeholder="เลขที่หนังสือ (กรอกภายหลังได้)" maxLength={INTERNSHIP_LIMITS.letterNo} value={no} onChange={e => setNo(e.target.value)} aria-label="เลขที่หนังสือ" />
            <DatePicker value={date} onChange={setDate} clearable placeholder="วันที่หนังสือ" ariaLabel="วันที่หนังสือ" />
          </div>
          <div className="flex gap-2">
            {r.status === 'SUBMITTED' && <>
              <button disabled={busy} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white disabled:opacity-40 cursor-pointer" onClick={() => void decide('APPROVED')}>อนุมัติ</button>
              <button disabled={busy} className="px-3 py-1.5 rounded-lg bg-rose-700 text-white disabled:opacity-40 cursor-pointer" onClick={() => void decide('REJECTED')}>ไม่อนุมัติ</button>
            </>}
            {r.status === 'APPROVED' && <button disabled={busy} className="px-3 py-1.5 rounded-lg bg-slate-700 text-white disabled:opacity-40 cursor-pointer" onClick={() => void decide('APPROVED')}>บันทึกเลขที่/วันที่/หมายเหตุ</button>}
          </div>
        </div>
      )}
      {canIssueLetter(r.status) && settings && <button className="px-3 py-1.5 rounded-lg bg-cyan-600 text-white cursor-pointer" onClick={() => onLetter(r)}>ออกหนังสือ (พิมพ์/PDF)</button>}
    </div>
  );
}

/** งานแนะแนว: ตั้งค่า + พิจารณาคำร้องขอฝึกงาน + ออกหนังสือราชการ */
export function GuidanceInternshipSection() {
  const [settings, setSettings] = useState<InternshipSettings | null>(null);
  const [requests, setRequests] = useState<InternshipRequest[]>([]);
  const [filter, setFilter] = useState<'ALL' | InternshipStatus>('SUBMITTED');
  const [letter, setLetter] = useState<InternshipRequest | null>(null);
  const [error, setError] = useState('');
  useEffect(() => subscribeInternshipSettings(setSettings, e => setError(e.message)), []);
  useEffect(() => subscribeAllInternshipRequests(setRequests, e => setError(e.message)), []);
  const shown = useMemo(() => requests.filter(r => filter === 'ALL' || r.status === filter), [requests, filter]);
  // หนังสือพิมพ์จากคำร้องล่าสุดเสมอ (เลขที่/วันที่ที่เพิ่งบันทึก)
  const letterReq = letter ? requests.find(r => r.id === letter.id) ?? letter : null;
  return (
    <div className="space-y-4">
      {error && <p role="alert" className="text-xs text-rose-400">{error}</p>}
      <SettingsPanel settings={settings} />
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-bold text-slate-100 text-sm">คำร้องของนักเรียน ({shown.length})</h3>
          <select className="ml-auto bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white" value={filter} onChange={e => setFilter(e.target.value as typeof filter)} aria-label="กรองสถานะ">
            <option value="ALL">ทั้งหมด</option>
            {(Object.keys(INTERNSHIP_STATUS_LABEL) as InternshipStatus[]).map(s => <option key={s} value={s}>{INTERNSHIP_STATUS_LABEL[s]}</option>)}
          </select>
        </div>
        {shown.length === 0 && <p className="text-xs text-slate-500">ไม่มีคำร้อง</p>}
        {shown.map(r => <div key={r.id}><RequestRow r={r} settings={settings} onLetter={setLetter} /></div>)}
      </div>
      {letterReq && settings && <InternshipLetterModal req={letterReq} settings={settings} onClose={() => setLetter(null)} />}
    </div>
  );
}
