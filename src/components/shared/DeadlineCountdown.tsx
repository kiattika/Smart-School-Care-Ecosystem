import React, { useEffect, useState } from 'react';
import { Timer } from 'lucide-react';
import { countdownUrgency, formatCountdown, type Urgency } from '../../lib/enrollmentWindow';

/** นาฬิกากลาง: เดินทุกวินาทีเมื่อเหลือ ≤ 1 ชม. ไม่งั้นทุก 30 วินาที */
export function useNowMs(targetMs: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (targetMs === null) return;
    const remaining = targetMs - Date.now();
    const step = remaining <= 3_600_000 ? 1000 : 30_000;
    const id = setInterval(() => setNow(Date.now()), step);
    return () => clearInterval(id);
  }, [targetMs, targetMs !== null && targetMs - now <= 3_600_000]);
  return now;
}

const TONE: Record<Urgency, string> = {
  NORMAL: 'bg-sky-500/10 border-sky-500/30 text-sky-300',
  SOON: 'bg-amber-500/15 border-amber-500/40 text-amber-300',
  URGENT: 'bg-rose-500/15 border-rose-500/50 text-rose-300 animate-pulse',
  EXPIRED: 'bg-slate-700/40 border-slate-600 text-slate-400',
};

/** ป้ายนับถอยหลังถึงเวลาเป้าหมาย — เหลือ ≤ 24 ชม. เป็นสีเหลือง, ≤ 1 ชม. เป็นสีแดงกะพริบ */
export function DeadlineCountdown({ targetMs, label, className = '' }: { targetMs: number | null; label: string; className?: string }) {
  const now = useNowMs(targetMs);
  if (targetMs === null) return null;
  const remaining = targetMs - now;
  const urgency = countdownUrgency(remaining);
  return (
    <span data-testid="deadline-countdown" data-urgency={urgency} className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-bold ${TONE[urgency]} ${className}`}>
      <Timer className="w-3 h-3 shrink-0" />
      {label} {formatCountdown(remaining)}
    </span>
  );
}
