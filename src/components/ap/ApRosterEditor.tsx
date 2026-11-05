import React, { useMemo, useState } from 'react';
import { Users, X, Search } from 'lucide-react';
import { saveApRoster } from '../../services/apRosterService';

interface StudentRow { studentId: string; name: string; room?: string; className?: string; studentNo?: number; }

interface Props {
  semesterId: string;
  code: string;
  courseName: string;
  ownerStaffId: string;
  levels: string[];
  candidates: StudentRow[];
  /** รายชื่อที่ยืนยันไว้แล้ว (ไม่มี = ยังไม่เคยยืนยัน เริ่มจากติ๊กทุกคนให้ครูเอาคนที่ไม่เรียนออก) */
  confirmedIds: string[] | null;
  onClose: () => void;
  onSaved: () => void;
}

/** ครูผู้สอน AP คัดนักเรียนที่ไม่ได้เลือกวิชานี้ออกจากห้อง แล้วยืนยันรายชื่อ — ไม่ติ๊กทุกคนแทนครู: เริ่มจากทุกคนแต่ต้องกดยืนยันเอง */
export function ApRosterEditor({ semesterId, code, courseName, ownerStaffId, levels, candidates, confirmedIds, onClose, onSaved }: Props) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(confirmedIds ?? candidates.map(c => c.studentId)));
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const rooms = useMemo(() => {
    const m = new Map<string, StudentRow[]>();
    for (const s of candidates) {
      const r = s.room || s.className || 'ไม่ระบุห้อง';
      m.set(r, [...(m.get(r) || []), s]);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'th', { numeric: true }));
  }, [candidates]);

  const needle = q.trim().toLowerCase();
  const matches = (s: StudentRow) => !needle || s.name.toLowerCase().includes(needle) || s.studentId.includes(needle);
  const toggle = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const setRoom = (list: StudentRow[], on: boolean) => setSelected(prev => {
    const n = new Set(prev);
    list.forEach(s => (on ? n.add(s.studentId) : n.delete(s.studentId)));
    return n;
  });

  const save = async () => {
    setBusy(true); setErr('');
    try {
      await saveApRoster({ semesterId, code, courseName, ownerStaffId, levels, studentIds: [...selected] });
      onSaved();
    } catch (e) {
      setErr('บันทึกไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
      <div className="bg-slate-900 border border-slate-700/60 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="p-4 border-b border-slate-700/60 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2"><Users className="w-4 h-4 text-indigo-400" /> รายชื่อนักเรียน {courseName}</h2>
            <p className="text-xs text-slate-400 mt-1">เอาชื่อนักเรียนที่ไม่ได้เลือกเรียนวิชานี้ออก แล้วกด “ยืนยันรายชื่อ” — ห้องที่รวมกัน: {levels.join(', ')}</p>
          </div>
          <button onClick={onClose} aria-label="ปิด" className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-3 border-b border-slate-700/60 flex items-center gap-2">
          <Search className="w-4 h-4 text-slate-500" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหาชื่อหรือเลขประจำตัว" className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500" />
          <span className="text-xs text-slate-400">เลือก {selected.size}/{candidates.length} คน</span>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {candidates.length === 0 && <p className="text-sm text-slate-400">ไม่พบนักเรียนในห้องที่รวมกัน (ตรวจชั้นของวิชาในตารางสอน)</p>}
          {rooms.map(([room, list]) => (
            <div key={room}>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-xs font-bold text-indigo-300">{room} ({list.filter(s => selected.has(s.studentId)).length}/{list.length})</h3>
                <div className="flex gap-2 text-[11px]">
                  <button onClick={() => setRoom(list, true)} className="text-slate-300 hover:text-white underline">เลือกทั้งห้อง</button>
                  <button onClick={() => setRoom(list, false)} className="text-slate-300 hover:text-white underline">ไม่เลือกทั้งห้อง</button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {list.filter(matches).map(s => (
                  <label key={s.studentId} className="flex items-center gap-2 text-xs text-slate-200 bg-slate-800/50 border border-slate-700/40 rounded-lg px-2 py-1.5 cursor-pointer">
                    <input type="checkbox" checked={selected.has(s.studentId)} onChange={() => toggle(s.studentId)} />
                    <span className="truncate">{s.studentNo ? `${s.studentNo}. ` : ''}{s.name}</span>
                    <span className="ml-auto text-slate-500 font-mono">{s.studentId}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="p-3 border-t border-slate-700/60 flex items-center justify-between gap-3">
          <p className="text-[11px] text-slate-400">{err ? <span className="text-red-400">{err}</span> : 'นักเรียนที่เอาออกจะไม่อยู่ในรายชื่อเช็คชื่อ/ผังที่นั่งของวิชานี้ และไปปรากฏในรายงานตกหล่นหากไม่มีครูท่านอื่นรับเข้า'}</p>
          <button onClick={save} disabled={busy || selected.size === 0} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold shrink-0">
            {busy ? 'กำลังบันทึก…' : 'ยืนยันรายชื่อ'}
          </button>
        </div>
      </div>
    </div>
  );
}
