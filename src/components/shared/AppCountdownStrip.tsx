import React, { useState } from 'react';
import { AlarmClock, X } from 'lucide-react';
import { useAppCountdowns } from '../../hooks/useAppCountdowns';
import { DeadlineCountdown } from './DeadlineCountdown';

/** แถบใต้แถบบนสุด: กำหนดเวลาที่ใกล้ที่สุด 3 อันดับของฉัน (ตอนเปิดแอป) — ปิดได้ในเซสชัน; ไม่มีกำหนดเวลา = ไม่แสดงอะไร */
export function AppCountdownStrip() {
  const entries = useAppCountdowns();
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || entries.length === 0) return null;
  return (
    <div className="shrink-0 px-4 py-2 bg-amber-500/5 border-b border-amber-500/20 flex items-start gap-3" data-testid="app-countdown-strip">
      <AlarmClock className="w-4 h-4 text-amber-300 mt-1 shrink-0" />
      <div className="flex-1 min-w-0 space-y-1">
        {entries.map((e) => (
          <div key={e.id} className="flex items-center justify-between gap-3 flex-wrap">
            <span className="text-xs text-slate-200 truncate">{e.title}</span>
            <DeadlineCountdown targetMs={e.targetMs} label={e.label} />
          </div>
        ))}
      </div>
      <button onClick={() => setDismissed(true)} aria-label="ซ่อนกำหนดเวลา" className="text-slate-400 hover:text-white cursor-pointer shrink-0"><X className="w-4 h-4" /></button>
    </div>
  );
}
