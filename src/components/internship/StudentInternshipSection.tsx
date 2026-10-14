import React, { useEffect, useState } from 'react';
import {
  INTERNSHIP_LIMITS, INTERNSHIP_STATUS_LABEL, canStudentCancel, canStudentEdit, canStudentResubmit, canSubmitNow, registrationPhase, thaiRange,
  type InternshipForm, type InternshipRequest, type InternshipSettings,
} from '../../lib/internship';
import { cancelInternship, submitInternship, subscribeInternshipForStudent, subscribeInternshipSettings } from '../../services/internshipService';

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'ดำเนินการไม่สำเร็จ');
const inp = 'w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white';
const EMPTY: InternshipForm = { companyName: '', companyAddress: '', headName: '', headPosition: '', periodId: '' };

/** นักเรียนยื่นคำร้องขอฝึกงาน (ผู้ปกครองดูสถานะอย่างเดียว) — งานแนะแนวเป็นผู้พิจารณาและออกหนังสือ */
export function StudentInternshipSection({ student, readOnly = false }: { student: { studentId: string; name: string }; readOnly?: boolean }) {
  const [settings, setSettings] = useState<InternshipSettings | null>(null);
  const [mine, setMine] = useState<InternshipRequest | null>(null);
  const [form, setForm] = useState<InternshipForm>(EMPTY);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => subscribeInternshipSettings(setSettings, e => setError(e.message)), []);
  useEffect(() => subscribeInternshipForStudent(student.studentId, setMine, e => setError(e.message)), [student.studentId]);
  const open = canSubmitNow(settings, Date.now());
  const set = <K extends keyof InternshipForm>(k: K, v: string) => setForm(f => ({ ...f, [k]: v }));
  const run = async (fn: () => Promise<void>) => { setBusy(true); setError(''); try { await fn(); setEditing(false); } catch (e) { setError(errMsg(e)); } finally { setBusy(false); } };
  const startEdit = () => {
    if (mine) setForm({ companyName: mine.companyName, companyAddress: mine.companyAddress, headName: mine.headName, headPosition: mine.headPosition, periodId: mine.periodId });
    else setForm(EMPTY);
    setEditing(true);
  };
  const showForm = !readOnly && open && (editing || !mine);
  return (
    <div className="space-y-3 animate-in fade-in duration-300">
      <h3 className="text-base font-bold text-white">คำร้องขอฝึกงาน</h3>
      {readOnly && <p className="text-xs text-amber-300">ผู้ปกครองดูสถานะคำร้องของบุตรหลานได้อย่างเดียว — การยื่นคำร้องให้นักเรียนทำเองในบัญชีนักเรียน</p>}
      <p className="text-xs text-slate-400">งานแนะแนวเป็นผู้พิจารณาและจัดทำหนังสือราชการขอความอนุเคราะห์ถึงสถานประกอบการให้</p>
      {error && <p role="alert" className="text-xs text-rose-400">{error}</p>}
      {!settings && <p className="text-sm text-slate-500">งานแนะแนวยังไม่ได้ตั้งค่าการรับคำร้องขอฝึกงาน</p>}
      {settings && !open && !mine && <p className="text-sm text-slate-400">{registrationPhase(settings, Date.now()) === 'NOT_YET' ? 'ยังไม่ถึงช่วงเปิดรับคำร้อง' : 'ขณะนี้ปิดรับคำร้องขอฝึกงาน'}</p>}
      {mine && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-1.5 text-sm">
          <div className="flex items-center gap-2"><span className="font-bold text-white">{mine.companyName}</span><span className="ml-auto px-2 py-0.5 rounded-full bg-slate-800 text-xs text-slate-200">{INTERNSHIP_STATUS_LABEL[mine.status]}</span></div>
          <div className="text-xs text-slate-300">{mine.companyAddress}</div>
          <div className="text-xs text-slate-300">ผู้บังคับบัญชา: {mine.headName} ({mine.headPosition})</div>
          <div className="text-xs text-slate-300">ช่วงฝึกงาน: {mine.periodLabel} ({thaiRange(mine.startYmd, mine.endYmd)})</div>
          {(mine.status === 'REJECTED' || mine.status === 'APPROVED') && mine.staffNote && <div className="text-xs text-amber-300">หมายเหตุจากงานแนะแนว: {mine.staffNote}</div>}
          {mine.status === 'APPROVED' && <div className="text-xs text-emerald-300">อนุมัติแล้ว — งานแนะแนวจะจัดทำหนังสือถึงสถานประกอบการ</div>}
          {!readOnly && (
            <div className="flex flex-wrap gap-2 pt-1">
              {open && (canStudentEdit(mine.status) || canStudentResubmit(mine.status)) && !editing && (
                <button className="px-3 py-1.5 rounded-lg text-xs bg-cyan-600 text-white cursor-pointer" onClick={startEdit}>{canStudentResubmit(mine.status) ? 'ยื่นใหม่' : 'แก้ไขคำร้อง'}</button>
              )}
              {canStudentCancel(mine.status) && (
                <button disabled={busy} className="px-3 py-1.5 rounded-lg text-xs border border-slate-600 text-slate-300 disabled:opacity-40 cursor-pointer" onClick={() => void run(() => cancelInternship(mine))}>ยกเลิกคำร้อง</button>
              )}
            </div>
          )}
        </div>
      )}
      {showForm && settings && (
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-3 text-sm">
          <div className="font-bold text-slate-100">{mine ? 'แก้ไขคำร้อง' : 'ยื่นคำร้องขอฝึกงาน'}</div>
          <input className={inp} placeholder="ชื่อสถานประกอบการ *" maxLength={INTERNSHIP_LIMITS.companyName} value={form.companyName} onChange={e => set('companyName', e.target.value)} aria-label="ชื่อสถานประกอบการ" />
          <textarea className={inp} rows={2} placeholder="ที่อยู่สถานประกอบการ *" maxLength={INTERNSHIP_LIMITS.companyAddress} value={form.companyAddress} onChange={e => set('companyAddress', e.target.value)} aria-label="ที่อยู่สถานประกอบการ" />
          <input className={inp} placeholder="ชื่อผู้บังคับบัญชา / ผู้มีอำนาจสูงสุดของหน่วยงาน *" maxLength={INTERNSHIP_LIMITS.headName} value={form.headName} onChange={e => set('headName', e.target.value)} aria-label="ชื่อผู้บังคับบัญชา" />
          <input className={inp} placeholder="ตำแหน่ง *" maxLength={INTERNSHIP_LIMITS.headPosition} value={form.headPosition} onChange={e => set('headPosition', e.target.value)} aria-label="ตำแหน่ง" />
          <div>
            <div className="text-xs text-slate-400 mb-1">ช่วงวันฝึกงาน (งานแนะแนวกำหนดให้เลือก) *</div>
            <div className="space-y-1">
              {settings.periods.map(p => (
                <label key={p.id} className="flex items-center gap-2 text-slate-200 text-xs">
                  <input type="radio" name="internship-period" checked={form.periodId === p.id} onChange={() => set('periodId', p.id)} />
                  {p.label} <span className="text-slate-400">({thaiRange(p.startYmd, p.endYmd)})</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button disabled={busy} className="px-3 py-1.5 rounded-lg text-xs bg-cyan-600 text-white disabled:opacity-40 cursor-pointer" onClick={() => void run(() => submitInternship(student, form, settings, mine))}>ส่งคำร้อง</button>
            {mine && <button className="px-3 py-1.5 rounded-lg text-xs border border-slate-600 text-slate-300 cursor-pointer" onClick={() => setEditing(false)}>ยกเลิกการแก้ไข</button>}
          </div>
        </div>
      )}
    </div>
  );
}
