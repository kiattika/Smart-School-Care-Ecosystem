import React from 'react';
import { Scale } from 'lucide-react';
import { SDQ_TRIAGE_LABEL } from '../../lib/sdq';
import { TriangulationResult } from '../../lib/sdqScreening';
import { SDQ_TRIAGE_CHIP } from '../shared/SdqStatusView';

/** ผลการวิเคราะห์ความสอดคล้อง 3 ฝ่าย — staffAction แสดงเฉพาะบุคลากร */
export function SdqTriangulationBox({ tri, showStaffAction }: { tri: TriangulationResult; showStaffAction: boolean }) {
  return (
    <div className="p-4 rounded-2xl border border-purple-500/25 bg-purple-500/5 space-y-1.5" data-testid="sdq-triangulation">
      <div className="flex flex-wrap items-center gap-2">
        <Scale className="w-4 h-4 text-purple-400 shrink-0" />
        <span className="text-xs font-bold text-white">ความสอดคล้องของผลทั้ง 3 ฝ่าย: {tri.title}</span>
        {tri.overall && (
          <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${SDQ_TRIAGE_CHIP[tri.overall]}`}>ภาพรวม: {SDQ_TRIAGE_LABEL[tri.overall]}</span>
        )}
      </div>
      <p className="text-[11px] text-slate-300">{tri.interpretation}</p>
      {showStaffAction && <p className="text-[11px] text-purple-300"><b>แนวทางดูแลช่วยเหลือ:</b> {tri.staffAction}</p>}
    </div>
  );
}
