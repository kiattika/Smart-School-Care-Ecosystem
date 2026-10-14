import React, { useState } from 'react';
import { PlcPanel } from './PlcPanel';
import { ReflectionPanel } from './ReflectionPanel';

/** เมนู "PLC และสะท้อนคิด" ของครู — สลับด้วยปุ่มแถบเล็ก (ไม่ซ้อน sidebar) */
export function PlcReflectionPanel() {
  const [tab, setTab] = useState<'plc' | 'reflection'>('plc');
  return (
    <div className="space-y-4">
      <div className="flex gap-2" role="tablist">
        {([['plc', 'บันทึก PLC'], ['reflection', 'บันทึกสะท้อนคิด']] as const).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`px-3 py-1.5 rounded-lg text-xs border cursor-pointer ${tab === id ? 'bg-cyan-600 border-cyan-400 text-white' : 'bg-slate-900 border-slate-700 text-slate-300'}`}>{label}</button>
        ))}
      </div>
      {tab === 'plc' ? <PlcPanel /> : <ReflectionPanel />}
    </div>
  );
}
