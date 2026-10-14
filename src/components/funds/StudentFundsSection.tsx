import React, { useEffect, useState } from 'react';
import { isHttpsLink } from '../../lib/evidenceLinks';
import {
  FUND_KIND_LABEL, INTEREST_NOTE_MAX, INTEREST_STATUS_LABEL, canExpressInterest, fundInterestId, registrationLabel,
  type FundInterest, type FundKind, type FundProgram,
} from '../../lib/fundPrograms';
import { expressInterest, subscribeFundPrograms, subscribeInterestsForStudent, withdrawInterest } from '../../services/fundService';

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'ดำเนินการไม่สำเร็จ');
const host = (u: string) => { try { return new URL(u).hostname; } catch { return u; } };

/** นักเรียน/ผู้ปกครอง: ดูประกาศทุนการศึกษา หรือ กยศ. และลงชื่อสนใจ (เมื่อโครงการเปิด) */
export function StudentFundsSection({ kind, student, readOnly = false }: { kind: FundKind; student: { studentId: string; name: string }; readOnly?: boolean }) {
  const [programs, setPrograms] = useState<FundProgram[]>([]);
  const [mine, setMine] = useState<FundInterest[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  useEffect(() => subscribeFundPrograms(kind, 'PUBLISHED', setPrograms, e => setError(e.message)), [kind]);
  useEffect(() => subscribeInterestsForStudent(student.studentId, setMine, e => setError(e.message)), [student.studentId]);
  const nowMs = Date.now();
  const run = async (id: string, fn: () => Promise<void>) => { setBusy(id); setError(''); try { await fn(); } catch (e) { setError(errMsg(e)); } finally { setBusy(''); } };
  return (
    <div className="space-y-3 animate-in fade-in duration-300">
      <h3 className="text-base font-bold text-white">{FUND_KIND_LABEL[kind]}</h3>
      {readOnly && <p className="text-xs text-amber-300">ผู้ปกครองดูประกาศและสถานะของบุตรหลานได้อย่างเดียว — การลงชื่อสนใจให้นักเรียนทำเองในบัญชีนักเรียน</p>}
      <p className="text-xs text-slate-400">ลงชื่อสนใจเป็นการแจ้งความจำนงเบื้องต้นเท่านั้น — การยื่นขอจริงทำผ่านงานแนะแนว (ครูจะจัดทำหนังสือราชการให้)</p>
      {error && <p role="alert" className="text-xs text-rose-400">{error}</p>}
      {programs.length === 0 && <p className="text-sm text-slate-500">ยังไม่มีประกาศ</p>}
      {programs.map(p => {
        const my = mine.find(i => i.id === fundInterestId(p.id, student.studentId));
        const canJoin = !readOnly && canExpressInterest(p, nowMs) && (!my || my.status === 'WITHDRAWN');
        return (
          <div key={p.id} className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-2 text-sm">
            <div className="font-bold text-white">{p.title}</div>
            {p.funder && <div className="text-xs text-slate-400">ผู้ให้ทุน: {p.funder}</div>}
            {p.amountText && <div className="text-xs text-amber-300">{p.amountText}</div>}
            {p.description && <p className="text-slate-300 whitespace-pre-line">{p.description}</p>}
            {p.eligibility && <p className="text-xs text-slate-300"><b>คุณสมบัติ:</b> {p.eligibility}</p>}
            {p.selectionNote && <p className="text-xs text-slate-300"><b>วิธีคัดเลือก:</b> {p.selectionNote}</p>}
            {p.links.filter(isHttpsLink).length > 0 && (
              <ul className="text-xs space-y-0.5">
                {p.links.filter(isHttpsLink).map(u => <li key={u}><a href={u} target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">{host(u)} — {u}</a></li>)}
              </ul>
            )}
            <div className="text-xs text-slate-400">{registrationLabel(p, nowMs)}</div>
            {my && my.status !== 'WITHDRAWN' && (
              <div className="text-xs text-emerald-300">สถานะของคุณ: {INTEREST_STATUS_LABEL[my.status]}{my.staffNote ? ` — ${my.staffNote}` : ''}</div>
            )}
            {canJoin && (
              <div className="flex flex-wrap gap-2 items-center">
                <input className="flex-1 min-w-[10rem] bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs" maxLength={INTEREST_NOTE_MAX} placeholder="หมายเหตุ (ถ้ามี)" value={notes[p.id] || ''} onChange={e => setNotes(n => ({ ...n, [p.id]: e.target.value }))} aria-label="หมายเหตุ" />
                <button disabled={busy === p.id} className="px-3 py-1.5 rounded-lg text-xs bg-cyan-600 text-white disabled:opacity-40 cursor-pointer" onClick={() => void run(p.id, () => expressInterest(p, student, notes[p.id] || '', !!my))}>ลงชื่อสนใจ</button>
              </div>
            )}
            {!readOnly && my?.status === 'INTERESTED' && (
              <button disabled={busy === p.id} className="px-3 py-1.5 rounded-lg text-xs border border-slate-600 text-slate-300 disabled:opacity-40 cursor-pointer" onClick={() => void run(p.id, () => withdrawInterest(p.id, student.studentId))}>ถอนความสนใจ</button>
            )}
          </div>
        );
      })}
    </div>
  );
}
