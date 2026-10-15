import React from 'react';
import { SDQAssessment } from '../../types';
import { SdqStatusView, SDQ_TRIAGE_CHIP } from '../shared/SdqStatusView';
import { SDQ_TRIAGE_LABEL } from '../../lib/sdq';
import { IMPACT_TRIAGE_LABEL } from '../../lib/sdqImpact';

export const EVALUATOR_BADGE: Record<SDQAssessment['evaluatorType'], { label: string; cls: string }> = {
  STUDENT: { label: 'มุมมองนักเรียน', cls: 'bg-blue-500/20 text-blue-300' },
  TEACHER: { label: 'มุมมองครู', cls: 'bg-emerald-500/20 text-emerald-300' },
  PARENT: { label: 'มุมมองผู้ปกครอง', cls: 'bg-amber-500/20 text-amber-300' },
};

const BARS: { key: keyof SDQAssessment['subscaleScores']; label: string; bar: string; strength?: boolean }[] = [
  { key: 'emotional', label: '1. ด้านอารมณ์ (Emotional)', bar: 'bg-purple-500' },
  { key: 'conduct', label: '2. ด้านความประพฤติ (Conduct)', bar: 'bg-indigo-500' },
  { key: 'hyperactivity', label: '3. ด้านสมาธิสั้น (Hyperactivity)', bar: 'bg-blue-500' },
  { key: 'peerProblems', label: '4. ด้านเพื่อน (Peer Problems)', bar: 'bg-teal-500' },
  { key: 'prosocial', label: '5. จุดแข็งทางสังคม (Prosocial)', bar: 'bg-emerald-400', strength: true },
];

/** ผลประเมิน SDQ 1 ชุดแบบเต็ม (คะแนนรายด้าน + สถานะ) — บุคลากร และผลที่ผู้ใช้กรอกเอง */
export function SdqResultCard({ sdq, title }: { sdq: SDQAssessment; title?: string }) {
  const badge = EVALUATOR_BADGE[sdq.evaluatorType];
  return (
    <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-4 space-y-3.5" data-testid={`sdq-card-${sdq.evaluatorType}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.cls}`}>{title ?? badge.label}</span>
        <span className="text-[10px] text-slate-400">{sdq.assessmentDate}</span>
      </div>
      <h4 className="text-xs font-bold text-slate-200 truncate">{sdq.evaluatorName}</h4>
      {sdq.round === 2 && sdq.followUpReason && <p className="text-[10px] text-slate-400">เหตุผลที่ประเมินซ้ำ: {sdq.followUpReason}</p>}
      <div className="space-y-2 text-xs">
        {BARS.map(b => (
          <div key={b.key} className={b.strength ? 'pt-1' : ''}>
            <div className="flex justify-between text-[11px] mb-1">
              <span className={b.strength ? 'text-emerald-400 font-bold' : 'text-slate-400'}>{b.label}</span>
              <span className={`font-bold ${b.strength ? 'text-emerald-400' : 'text-slate-200'}`}>{sdq.subscaleScores[b.key]}/10</span>
            </div>
            <div className="w-full bg-slate-900 rounded-full h-1.5">
              <div className={`${b.bar} h-full rounded-full`} style={{ width: `${sdq.subscaleScores[b.key] * 10}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800 text-[11px] space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-slate-400">คะแนนปัญหารวม:</span>
          <span className="font-extrabold text-white">{sdq.totalDifficultiesScore}/40</span>
        </div>
        <SdqStatusView rec={sdq} />
      </div>
    </div>
  );
}

/** ผลของอีกฝ่ายแบบภาพรวม (ระดับเท่านั้น ไม่มีคะแนนรายด้าน) — มุมมองนักเรียน/ผู้ปกครอง */
export function SdqLevelCard({ evaluator, sdq }: { evaluator: SDQAssessment['evaluatorType']; sdq?: SDQAssessment }) {
  const badge = EVALUATOR_BADGE[evaluator];
  return (
    <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-4 space-y-2" data-testid={`sdq-level-${evaluator}`}>
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
      {sdq ? (
        <div className="space-y-1.5 text-[11px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-400">ผลโดยรวม</span>
            <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${SDQ_TRIAGE_CHIP[sdq.triagingStatus]}`}>{SDQ_TRIAGE_LABEL[sdq.triagingStatus]}</span>
          </div>
          {sdq.impactTriage && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400">ผลกระทบ</span>
              <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${SDQ_TRIAGE_CHIP[sdq.impactTriage]}`}>{IMPACT_TRIAGE_LABEL[sdq.impactTriage]}</span>
            </div>
          )}
          <div className="text-[10px] text-slate-500">ประเมินเมื่อ {sdq.assessmentDate}</div>
        </div>
      ) : (
        <p className="text-[11px] text-slate-500">ยังไม่ได้ประเมินในปีการศึกษานี้</p>
      )}
    </div>
  );
}
