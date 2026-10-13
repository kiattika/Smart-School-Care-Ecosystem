import React, { useState } from 'react';
import { CalendarClock } from 'lucide-react';
import type { ElectiveActivityConfig } from '../../types';
import { EnrollmentWindowEditor } from './EnrollmentWindowEditor';
import { DeadlineCountdown } from '../shared/DeadlineCountdown';
import { enrollmentState, formatThaiDateTime } from '../../lib/enrollmentWindow';

/** การ์ดของครูผู้รับผิดชอบชุมนุม: ดูสถานะ/นับถอยหลัง และตั้งช่วงเวลารับสมัครของชุมนุมตัวเอง (ไม่มีชุมนุม = ไม่แสดงอะไร) */
export function ResponsibleClubWindowCard({ configs }: { configs: ElectiveActivityConfig[] }) {
  const [editId, setEditId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  if (configs.length === 0) return null;
  return (
    <div className="mb-6 bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-3" data-testid="responsible-club-window">
      <h3 className="text-sm font-bold text-white flex items-center gap-2"><CalendarClock className="w-4 h-4 text-teal-400" /> ชุมนุมที่ท่านรับผิดชอบ — ช่วงเวลารับสมัคร</h3>
      {toast && <p className="text-[11px] text-emerald-300">{toast}</p>}
      {configs.map(cfg => {
        const win = enrollmentState(cfg, Date.now());
        return (
          <div key={cfg.id} className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-slate-200 font-semibold">{cfg.name}</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${win.phase === 'CLOSED' ? 'bg-rose-500/20 text-rose-300' : win.phase === 'NOT_YET' ? 'bg-sky-500/20 text-sky-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                {win.phase === 'CLOSED' ? 'ปิดรับสมัครแล้ว' : win.phase === 'NOT_YET' ? 'ยังไม่ถึงเวลาเปิดรับ' : 'เปิดรับสมัคร'}
              </span>
              {win.deadlineMs !== null && <DeadlineCountdown targetMs={win.deadlineMs} label={win.deadlineKind === 'OPENS' ? 'เปิดรับใน' : 'ปิดรับใน'} />}
              <button onClick={() => setEditId(editId === cfg.id ? null : cfg.id)} className="ml-auto text-[11px] text-indigo-300 hover:text-indigo-200 underline">ตั้งเวลา</button>
            </div>
            {(win.opensAtMs !== null || win.closesAtMs !== null) && (
              <p className="text-[10px] text-slate-500">
                {win.opensAtMs !== null && `เปิด ${formatThaiDateTime(win.opensAtMs)}`}{win.opensAtMs !== null && win.closesAtMs !== null && ' · '}{win.closesAtMs !== null && `ปิด ${formatThaiDateTime(win.closesAtMs)}`}
              </p>
            )}
            {editId === cfg.id && (
              <div key={`${cfg.id}-${String(cfg.enrollmentOpensAt?.toMillis?.() ?? '')}-${String(cfg.enrollmentClosesAt?.toMillis?.() ?? '')}`}>
                <EnrollmentWindowEditor cfg={cfg} onDone={(m) => { setToast(m); setEditId(null); setTimeout(() => setToast(null), 4000); }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
