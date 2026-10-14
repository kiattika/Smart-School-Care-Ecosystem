import React, { useMemo, useState } from 'react';
import { useStore } from '../../store';
import { useCurrentSemester } from '../../hooks/useCurrentSemester';
import { usePlcLogs } from '../../hooks/usePlcAndReflections';
import { deletePlcLog, savePlcLog } from '../../services/plcService';
import { semesterIdOf } from '../../lib/lessonPlans';
import { PLC_STEPS, PLC_STEP_LABEL, emptyPlc, groupPlcCycles, isCycleComplete, validatePlc, type PlcContent, type PlcLog } from '../../lib/plc';
import { staffDepartmentId, type StaffRow } from '../../lib/supervisionView';
import { DatePicker } from '../shared/DatePicker';

const inp = 'w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-sm text-white';
const lbl = 'text-xs text-slate-400 block mb-1';
const thDate = (ymd: string) => { const [y, m, d] = ymd.split('-').map(Number); return y ? `${d}/${m}/${y + 543}` : ymd; };

/** บันทึก PLC ของครู: ลงทีละครั้งที่พบกัน จัดเป็นวงจร PDCA ตามชื่อกลุ่ม + ประเด็น */
export function PlcPanel() {
  const user = useStore(s => s.user);
  const staff = useStore(s => s.staffDirectory) as StaffRow[];
  const sem = useCurrentSemester();
  const staffId = user?.staffId || '';
  const semesterId = semesterIdOf(sem.academicYear, sem.term);
  const q = useMemo(() => (staffId ? ({ scope: 'SELF', staffId } as const) : null), [staffId]);
  const { data, loading, error } = usePlcLogs(semesterId, q);
  const cycles = useMemo(() => groupPlcCycles(data), [data]);
  const [editing, setEditing] = useState<{ id?: string; content: PlcContent } | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  if (!staffId) return <p className="text-sm text-slate-400">บัญชีนี้ไม่ได้เชื่อมกับทะเบียนบุคลากร</p>;
  const dept = staffDepartmentId(staff.find(s => s.id === staffId));
  const problems = editing ? validatePlc(editing.content) : [];
  const set = <K extends keyof PlcContent>(k: K, v: PlcContent[K]) => setEditing(e => (e ? { ...e, content: { ...e.content, [k]: v } } : e));

  const save = async () => {
    if (!editing) return;
    setBusy(true); setMsg('');
    try {
      await savePlcLog({ semester: { academicYear: sem.academicYear, term: sem.term }, author: { staffId, name: user?.displayName || '', departmentId: dept }, content: editing.content, id: editing.id });
      setEditing(null);
    } catch (e) { setMsg(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ'); } finally { setBusy(false); }
  };
  const edit = (l: PlcLog) => setEditing({ id: l.id, content: { groupName: l.groupName, topic: l.topic, meetingDate: l.meetingDate, step: l.step, members: l.members, summary: l.summary, outcome: l.outcome || '', nextAction: l.nextAction || '', evidenceUrl: l.evidenceUrl } });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-sm">
        <p className="text-white font-medium">บันทึก PLC ภาคเรียน {sem.label}</p>
        <p className="text-slate-400 mt-1">ลงทุกครั้งที่กลุ่มพบกัน ระบุขั้นของวงจร (วางแผน → ปฏิบัติ → ตรวจสอบ → ปรับปรุง) ชื่อกลุ่มและประเด็นเดียวกันจะรวมเป็นวงจรเดียว</p>
      </div>
      {error && <p role="alert" className="text-sm text-amber-300">โหลดข้อมูลไม่สำเร็จ: {error}</p>}
      {!editing && <button className="px-3 py-1.5 rounded-lg text-xs bg-cyan-600 text-white cursor-pointer" onClick={() => setEditing({ content: emptyPlc() })}>+ บันทึกการพบกันครั้งใหม่</button>}
      {editing && (
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className={lbl}>ชื่อกลุ่ม PLC</label><input className={inp} maxLength={120} value={editing.content.groupName} onChange={e => set('groupName', e.target.value)} /></div>
            <div><label className={lbl}>วันที่พบกัน</label><DatePicker value={editing.content.meetingDate} onChange={v => set('meetingDate', v)} ariaLabel="วันที่พบกัน" className="flex items-center gap-2 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white cursor-pointer" /></div>
          </div>
          <div><label className={lbl}>ประเด็น/ปัญหาที่ร่วมกันพัฒนา</label><input className={inp} maxLength={300} value={editing.content.topic} onChange={e => set('topic', e.target.value)} /></div>
          <div>
            <span className={lbl}>ขั้นของวงจรในครั้งนี้</span>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="ขั้นของวงจร">
              {PLC_STEPS.map(st => (
                <button key={st} type="button" role="radio" aria-checked={editing.content.step === st} onClick={() => set('step', st)}
                  className={`px-3 py-1 rounded-lg text-xs border cursor-pointer ${editing.content.step === st ? 'bg-cyan-600 border-cyan-400 text-white' : 'bg-slate-950 border-slate-700 text-slate-300'}`}>{PLC_STEP_LABEL[st]}</button>
              ))}
            </div>
          </div>
          <div><label className={lbl}>สมาชิกที่เข้าร่วม (1 บรรทัด = 1 คน)</label><textarea className={inp} rows={3} value={editing.content.members.join('\n')} onChange={e => set('members', e.target.value.split('\n'))} /></div>
          <div><label className={lbl}>สรุปสิ่งที่ทำ/ประชุมในครั้งนี้</label><textarea className={inp} rows={4} maxLength={2000} value={editing.content.summary} onChange={e => set('summary', e.target.value)} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className={lbl}>ผลที่ได้/ข้อค้นพบ</label><textarea className={inp} rows={3} maxLength={1500} value={editing.content.outcome} onChange={e => set('outcome', e.target.value)} /></div>
            <div><label className={lbl}>สิ่งที่จะทำต่อ</label><textarea className={inp} rows={3} maxLength={1000} value={editing.content.nextAction} onChange={e => set('nextAction', e.target.value)} /></div>
          </div>
          <div><label className={lbl}>ลิงก์หลักฐาน (ถ้ามี เช่น รูป/เอกสารใน Google Drive)</label><input className={inp} placeholder="https://..." value={editing.content.evidenceUrl} onChange={e => set('evidenceUrl', e.target.value)} /></div>
          {problems.length > 0 && <ul className="text-xs text-amber-300 list-disc pl-5">{problems.slice(0, 3).map(p => <li key={p}>{p}</li>)}</ul>}
          <div className="flex gap-2 items-center">
            <button disabled={busy || problems.length > 0} className="px-3 py-1.5 rounded-lg text-xs bg-cyan-600 text-white disabled:opacity-40 cursor-pointer" onClick={() => void save()}>บันทึก</button>
            <button className="px-3 py-1.5 rounded-lg text-xs border border-slate-600 text-slate-300 cursor-pointer" onClick={() => { setEditing(null); setMsg(''); }}>ยกเลิก</button>
            {msg && <span role="alert" className="text-xs text-amber-300">{msg}</span>}
          </div>
        </div>
      )}
      {loading ? <p className="text-sm text-slate-400">กำลังโหลด…</p> : cycles.length === 0 ? <p className="text-sm text-slate-400">ยังไม่มีบันทึก PLC ในภาคเรียนนี้</p> : cycles.map(c => (
        <div key={c.key} className="rounded-xl border border-slate-700 bg-slate-900/40 p-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><p className="text-sm text-white font-medium">{c.groupName}</p><p className="text-xs text-slate-400">{c.topic}</p></div>
            <span className={`text-xs px-2 py-1 rounded-full ${isCycleComplete(c.steps) ? 'bg-emerald-600/30 text-emerald-200' : 'bg-slate-800 text-slate-200'}`}>
              {isCycleComplete(c.steps) ? 'ครบวงจร PDCA' : `แล้ว ${c.steps.length}/4 ขั้น`}
            </span>
          </div>
          <ul className="space-y-2">
            {c.logs.map(l => (
              <li key={l.id} className="rounded-lg border border-slate-800 p-2 text-xs text-slate-200 space-y-1">
                <p className="text-slate-400">{thDate(l.meetingDate)} · {PLC_STEP_LABEL[l.step]}{l.members.length > 0 && ` · ${l.members.length} คน`}</p>
                <p className="whitespace-pre-wrap">{l.summary}</p>
                {l.evidenceUrl && <a href={l.evidenceUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline break-all">หลักฐาน</a>}
                <div className="flex gap-2 pt-1">
                  <button className="px-2 py-1 rounded border border-slate-600 text-slate-300 cursor-pointer" onClick={() => edit(l)}>แก้ไข</button>
                  <button className="px-2 py-1 rounded border border-rose-500/50 text-rose-300 cursor-pointer" onClick={() => { if (window.confirm('ลบบันทึกนี้?')) void deletePlcLog(l.id); }}>ลบ</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
