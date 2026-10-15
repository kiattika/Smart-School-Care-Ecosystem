import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { SDQ_CONFIRM_LABEL, SDQ_ONCE_PER_YEAR_NOTICE } from '../../lib/sdqScreening';

/** คำเตือน "ประเมินตามความเป็นจริง ทำได้ 1 ครั้งต่อปีการศึกษา" + ช่องยืนยันก่อนส่ง (ทุกฟอร์ม SDQ รอบที่ 1) */
export function SdqOnceNotice({ confirmed, onConfirmChange, idPrefix }: { confirmed: boolean; onConfirmChange: (v: boolean) => void; idPrefix: string }) {
  return (
    <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-2" data-testid="sdq-once-notice">
      <p className="text-xs text-amber-300 flex items-start gap-2"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {SDQ_ONCE_PER_YEAR_NOTICE}</p>
      <label htmlFor={`${idPrefix}-confirm`} className="flex items-start gap-2 text-xs text-slate-200 cursor-pointer">
        <input id={`${idPrefix}-confirm`} type="checkbox" checked={confirmed} onChange={e => onConfirmChange(e.target.checked)} className="mt-0.5 w-4 h-4 accent-purple-600" />
        {SDQ_CONFIRM_LABEL}
      </label>
    </div>
  );
}
