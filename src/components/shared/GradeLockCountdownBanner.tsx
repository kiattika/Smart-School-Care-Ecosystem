import React from 'react';
import { AlarmClock } from 'lucide-react';
import { useGradeLocks } from '../../hooks/useGradeLocks';
import { gradeLockDeadlines } from '../../lib/gradeLockWindow';
import { DeadlineCountdown } from './DeadlineCountdown';

/** เตือนผู้เกี่ยวข้อง: ระบบกรอกคะแนน/ประเมินที่เปิดอยู่และมีเวลาล็อก พร้อมนับถอยหลัง (ไม่มี = ไม่แสดงอะไร) */
export function GradeLockCountdownBanner() {
  const locks = useGradeLocks();
  const items = gradeLockDeadlines(locks, Date.now());
  if (items.length === 0) return null;
  return (
    <div className="mb-6 bg-amber-500/5 border border-amber-500/30 rounded-2xl p-4 space-y-2" data-testid="grade-lock-countdown">
      <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2"><AlarmClock className="w-4 h-4" /> กำหนดเวลาของระบบกรอกคะแนน/ประเมิน</h3>
      {items.map(it => (
        <div key={it.id} className="flex items-center justify-between gap-3 flex-wrap">
          <span className="text-xs text-slate-200">{it.title}</span>
          <DeadlineCountdown targetMs={it.targetMs} label={it.kind === 'OPENS' ? 'เปิดให้กรอกใน' : 'ล็อกระบบใน'} />
        </div>
      ))}
    </div>
  );
}
