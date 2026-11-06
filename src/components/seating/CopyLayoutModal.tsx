import React, { useEffect, useState } from 'react';
import { Copy, X } from 'lucide-react';
import { listLayoutsByTargetKey, type LayoutSummary } from '../../services/seatingService';
import { format } from 'date-fns';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** ชั้น/ห้อง(+ห้องกายภาพ) เดียวกัน ไม่รวมครู */
  targetKey: string;
  /** ผังของฉัน (ไม่แสดงในรายการ) */
  ownLayoutId: string;
  /** ผังปัจจุบันมีที่นั่ง/นักเรียนอยู่แล้ว — การคัดลอกจะแทนที่ทั้งผัง */
  willReplace: boolean;
  onPick: (source: LayoutSummary) => void | Promise<void>;
}

/** เลือกผังของครูท่านอื่นที่ชั้น/ห้องเดียวกัน เพื่อคัดลอกเป็นสำเนาของตน (ไม่ผูกสด) */
export const CopyLayoutModal: React.FC<Props> = ({ isOpen, onClose, targetKey, ownLayoutId, willReplace, onPick }) => {
  const [items, setItems] = useState<LayoutSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    setItems(null); setError(null);
    listLayoutsByTargetKey(targetKey, ownLayoutId)
      .then(r => { if (alive) setItems(r); })
      .catch(e => { if (alive) setError(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
  }, [isOpen, targetKey, ownLayoutId]);

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-label="คัดลอกผังจากครูท่านอื่น">
      <div className="bg-slate-900 border border-slate-700/60 rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center gap-1.5"><Copy className="w-4 h-4 text-emerald-400" /> คัดลอกผังจากครูท่านอื่น</h2>
          <button onClick={onClose} aria-label="ปิด" className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-[11px] text-slate-400">
          แสดงผังของครูท่านอื่นที่ชั้น/ห้องเรียนและห้องกายภาพเดียวกับผังนี้ — คัดลอกแล้วเป็นสำเนาของคุณ แก้ได้อิสระ ไม่กระทบผังต้นทาง
          และต้องกด "บันทึกผัง" อีกครั้งจึงจะมีผล
        </p>
        {willReplace && (
          <p className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2">
            ผังปัจจุบันของคุณจะถูกแทนที่ด้วยผังที่เลือก (ถ้ายังไม่กดบันทึก ปิดหน้าจอแล้วผังเดิมยังอยู่)
          </p>
        )}
        {error && <p className="text-xs text-red-400">โหลดรายการไม่สำเร็จ: {error}</p>}
        {!error && items === null && <p className="text-xs text-slate-500">กำลังโหลด…</p>}
        {items && items.length === 0 && (
          <p className="text-xs text-slate-500 py-4 text-center">ยังไม่มีครูท่านอื่นบันทึกผังของห้องนี้ไว้</p>
        )}
        <ul className="space-y-2">
          {(items || []).map(it => (
            <li key={it.id} className="flex items-center justify-between gap-2 bg-slate-800/50 border border-slate-700/50 rounded-xl px-3 py-2">
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-100 truncate">{it.teacherName || it.ownerStaffId}</div>
                <div className="text-[10px] text-slate-400">
                  {it.totalCapacity} ที่นั่ง{it.updatedAt ? ` • แก้ล่าสุด ${format(new Date(it.updatedAt), 'dd/MM/yyyy HH:mm')}` : ''}
                </div>
              </div>
              <button
                disabled={busyId !== null}
                onClick={async () => { setBusyId(it.id); try { await onPick(it); } finally { setBusyId(null); } }}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-[11px] font-bold"
              >
                {busyId === it.id ? 'กำลังคัดลอก…' : 'คัดลอก'}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
