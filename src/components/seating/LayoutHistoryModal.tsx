import React, { useEffect, useMemo, useState } from 'react';
import { History, X } from 'lucide-react';
import { getLayoutHistoryFromFirestore } from '../../services/seatingService';
import type { SeatingAssignment } from '../../types/seating';
import { format } from 'date-fns';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  layoutId: string;
}

const fmt = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : format(d, 'dd/MM/yyyy HH:mm');
};

/** ประวัติการนั่งทั้งผัง (ใหม่→เก่า) — ค้นด้วยชื่อ/เลขประจำตัวได้ */
export const LayoutHistoryModal: React.FC<Props> = ({ isOpen, onClose, layoutId }) => {
  const [rows, setRows] = useState<SeatingAssignment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    setRows(null); setError(null); setQ('');
    getLayoutHistoryFromFirestore(layoutId)
      .then(r => { if (alive) setRows(r); })
      .catch(e => { if (alive) setError(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
  }, [isOpen, layoutId]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!rows) return [];
    return needle ? rows.filter(r => `${r.studentName || ''} ${r.studentId}`.toLowerCase().includes(needle)) : rows;
  }, [rows, q]);

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-label="ประวัติผังที่นั่งทั้งห้อง">
      <div className="bg-slate-900 border border-slate-700/60 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col p-4 gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center gap-1.5"><History className="w-4 h-4 text-indigo-400" /> ประวัติผังที่นั่งทั้งห้อง</h2>
          <button onClick={onClose} aria-label="ปิด" className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="ค้นหาชื่อหรือเลขประจำตัวนักเรียน"
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500"
        />
        {error && <p className="text-xs text-red-400">โหลดประวัติไม่สำเร็จ: {error}</p>}
        {!error && rows === null && <p className="text-xs text-slate-500">กำลังโหลด…</p>}
        {rows && rows.length === 0 && <p className="text-xs text-slate-500 py-6 text-center">ยังไม่มีประวัติการนั่ง (ยังไม่เคยบันทึกผัง)</p>}
        {rows && rows.length > 0 && (
          <div className="overflow-auto border border-slate-800 rounded-xl">
            <table className="w-full text-xs">
              <thead className="bg-slate-800/70 text-slate-400 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2">นักเรียน</th>
                  <th className="text-left px-3 py-2">ที่นั่ง</th>
                  <th className="text-left px-3 py-2">เริ่มนั่ง</th>
                  <th className="text-left px-3 py-2">ถึง</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(r => (
                  <tr key={r.id} className="border-t border-slate-800">
                    <td className="px-3 py-1.5 text-slate-100">{r.studentName || r.studentId}<span className="text-slate-500 ml-1">{r.studentNo ? `เลขที่ ${r.studentNo}` : ''}</span></td>
                    <td className="px-3 py-1.5 text-slate-300">{r.groupName ? `${r.groupName} • ` : ''}{r.seatLabel || r.seatNumber || r.seatId}</td>
                    <td className="px-3 py-1.5 text-slate-300">{fmt(r.effectiveFrom)}</td>
                    <td className="px-3 py-1.5">{r.effectiveTo ? <span className="text-slate-400">{fmt(r.effectiveTo)}</span> : <span className="text-emerald-400 font-bold">ปัจจุบัน</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
