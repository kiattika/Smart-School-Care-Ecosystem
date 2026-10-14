import React from 'react';
import { SUPERVISION_BANDS, summarizeObservations, supervisionBand, type SupervisionObservation } from '../../lib/supervision';

/** ภาพรวมผลนิเทศ — ไม่แสดงชื่อ/คะแนนรายบุคคล (ผู้บริหารเห็นเฉพาะภาพรวม) */
export function SupervisionOverviewPanel({ observations, totalTeachers, title }: {
  observations: readonly SupervisionObservation[];
  /** จำนวนครูที่ต้องรับการนิเทศ (ถ้ารู้) — ใช้แสดงความคืบหน้า */
  totalTeachers?: number;
  title: string;
}) {
  const o = summarizeObservations(observations);
  if (o.submitted === 0) {
    return <div className="bg-[#161f30] border border-slate-800/80 rounded-xl p-6 text-sm text-slate-400">{title}: ยังไม่มีผลการนิเทศที่ส่งแล้วในรอบนี้</div>;
  }
  const maxBand = Math.max(1, ...Object.values(o.bands));
  return (
    <div className="bg-[#161f30] border border-slate-800/80 rounded-xl p-4 sm:p-6 space-y-5">
      <h3 className="text-lg font-bold text-white">{title}</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ['ส่งผลแล้ว', totalTeachers ? `${o.submitted}/${totalTeachers} คน` : `${o.submitted} คน`],
          ['ครูรับทราบแล้ว', `${o.acknowledged} คน`],
          ['คะแนนเฉลี่ย', o.averagePercent === null ? '-' : `${o.averagePercent}%`],
          ['ระดับของค่าเฉลี่ย', o.averagePercent === null ? '-' : supervisionBand(o.averagePercent)],
        ].map(([k, v]) => (
          <div key={k} className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
            <p className="text-xs text-slate-400">{k}</p><p className="text-lg font-bold text-cyan-300">{v}</p>
          </div>
        ))}
      </div>
      <div className="space-y-1.5">
        <p className="text-xs text-slate-400">จำนวนครูตามระดับผลการนิเทศ</p>
        {SUPERVISION_BANDS.map(b => (
          <div key={b} className="flex items-center gap-2 text-sm">
            <span className="w-24 text-slate-300">{b}</span>
            <div className="flex-1 h-3 bg-slate-800 rounded"><div className="h-3 bg-cyan-500 rounded" style={{ width: `${(o.bands[b] / maxBand) * 100}%` }} /></div>
            <span className="w-8 text-right text-slate-200">{o.bands[b]}</span>
          </div>
        ))}
      </div>
      <div className="space-y-1.5">
        <p className="text-xs text-slate-400">ค่าเฉลี่ยรายหมวด (เต็ม 5)</p>
        {o.sectionAverages.map(s => (
          <div key={s.no} className="flex justify-between text-sm"><span className="text-slate-300">หมวด {s.no} {s.title}</span><span className="text-slate-100 font-semibold">{s.average ?? '-'}</span></div>
        ))}
      </div>
      {o.lowestItems.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-slate-400">ประเด็นที่ควรพัฒนา (เฉลี่ยต่ำสุด 3 ข้อ)</p>
          {o.lowestItems.map(i => <p key={i.id} className="text-sm text-slate-300">{i.label} — <span className="text-amber-300">{i.average}</span></p>)}
        </div>
      )}
    </div>
  );
}
