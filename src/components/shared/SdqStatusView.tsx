import React from 'react';
import {
  SDQ_LEGACY_NOTE,
  SDQ_STRENGTH_LABEL,
  SDQ_SUBSCALE_LABEL,
  SDQ_TRIAGE_LABEL,
  SdqStrengthStatus,
  SdqSubscaleKey,
  SdqTriage,
  isLegacySdqCriteria,
} from '../../lib/sdq';
import { IMPACT_DURATION_OPTIONS, IMPACT_TOTAL_MAX, IMPACT_TRIAGE_LABEL, ImpactDuration } from '../../lib/sdqImpact';

export const SDQ_TRIAGE_CHIP: Record<SdqTriage, string> = {
  NORMAL: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  AT_RISK: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  VULNERABLE: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
};
const STRENGTH_CHIP: Record<SdqStrengthStatus, string> = {
  HAS_STRENGTH: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  NO_STRENGTH: 'bg-slate-700/40 text-slate-300 border-slate-600',
};

export interface SdqStatusInput {
  totalDifficultiesScore: number;
  triagingStatus: SdqTriage;
  subscaleStatus?: Partial<Record<SdqSubscaleKey, SdqTriage | SdqStrengthStatus>>;
  criteriaVersion?: string | null;
  /** ส่วนที่ 2 (ผลกระทบ) — ไม่มี = ข้อมูลเก่า ไม่แสดงส่วนนี้ */
  impactTotalScore?: number;
  impactTriage?: SdqTriage;
  impactDurationMonths?: ImpactDuration | string;
}

/**
 * แสดงสถานะรวม + สถานะรายด้านทั้ง 5 ของผลประเมิน SDQ 1 ชุด
 * ผลเก่าที่ไม่มี criteriaVersion แสดงสถานะรวมที่บันทึกไว้พร้อมหมายเหตุ "คำนวณด้วยเกณฑ์เดิม" และไม่มีสถานะรายด้าน
 * (ไม่คำนวณย้อนหลังให้ — ดู src/lib/sdq.ts)
 */
export function SdqStatusView({ rec }: { rec: SdqStatusInput }) {
  const legacy = isLegacySdqCriteria(rec);
  const sub = rec.subscaleStatus;
  return (
    <div className="space-y-1.5" data-testid="sdq-status">
      <div className="text-[10px] font-bold text-purple-300/80">ชนิดของปัญหา (5 ด้าน)</div>
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="text-slate-400">รวม {rec.totalDifficultiesScore}/40</span>
        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${SDQ_TRIAGE_CHIP[rec.triagingStatus]}`}>
          {SDQ_TRIAGE_LABEL[rec.triagingStatus]}
        </span>
      </div>
      {!legacy && sub && (
        <div className="flex flex-wrap gap-1">
          {(Object.keys(SDQ_SUBSCALE_LABEL) as SdqSubscaleKey[]).map((k) => {
            const v = sub[k];
            if (!v) return null;
            const isStrength = k === 'prosocial';
            return (
              <span key={k} className={`px-1.5 py-0.5 rounded border text-[10px] ${isStrength ? STRENGTH_CHIP[v as SdqStrengthStatus] : SDQ_TRIAGE_CHIP[v as SdqTriage]}`}>
                {SDQ_SUBSCALE_LABEL[k]}: {isStrength ? SDQ_STRENGTH_LABEL[v as SdqStrengthStatus] : SDQ_TRIAGE_LABEL[v as SdqTriage]}
              </span>
            );
          })}
        </div>
      )}
      {legacy && <p className="text-[10px] text-amber-400/90" data-testid="sdq-legacy-note">* {SDQ_LEGACY_NOTE}</p>}
      {rec.impactTriage !== undefined && rec.impactTotalScore !== undefined && (
        <div className="pt-1.5 mt-1 border-t border-white/10 space-y-1" data-testid="sdq-impact-status">
          <div className="text-[10px] font-bold text-sky-300/80">ผลกระทบ (ความรุนแรงของปัญหา)</div>
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="text-slate-400">รวม {rec.impactTotalScore}/{IMPACT_TOTAL_MAX}</span>
            <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${SDQ_TRIAGE_CHIP[rec.impactTriage]}`}>{IMPACT_TRIAGE_LABEL[rec.impactTriage]}</span>
          </div>
          {rec.impactDurationMonths && (
            <div className="text-[10px] text-slate-500">มีปัญหามานาน: {IMPACT_DURATION_OPTIONS.find((o) => o.value === rec.impactDurationMonths)?.label ?? rec.impactDurationMonths}</div>
          )}
        </div>
      )}
    </div>
  );
}
