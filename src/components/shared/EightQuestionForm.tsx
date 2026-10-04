import React from 'react';
import {
  EIGHT_Q_ITEMS,
  EIGHT_Q_RISK_LABEL,
  EightQAnswers,
  scoreEightQ,
} from '../../lib/depressionScreening';

export const EMPTY_EIGHT_Q: EightQAnswers = { answers: {} };

const YES_NO: ReadonlyArray<{ value: boolean; label: string }> = [
  { value: false, label: 'ไม่มี' },
  { value: true, label: 'มี' },
];

/**
 * แบบประเมินความเสี่ยงฆ่าตัวตาย 8Q (ฉบับไทย กรมสุขภาพจิต) — ฟอร์มสำหรับ "ครู" กรอกแทนนักเรียนระหว่างพูดคุยเท่านั้น
 * (ไม่มีหน้าจอให้นักเรียนทำเอง และ firestore.rules ไม่ให้นักเรียนเขียน/อ่าน 8Q) ข้อ 3 ถ้าตอบ "มี" ถามต่อว่าควบคุมความคิดนั้นได้ไหม
 * แสดงคะแนนรวม/ระดับสดให้ครูผู้กรอกเห็น (ผู้กรอกคือผู้มีสิทธิ์อ่านผลอยู่แล้ว)
 * ป้ายตัวเลือกต้อง `relative` เสมอ (radio ซ่อนด้วย sr-only — ดู NineQuestionForm.tsx)
 */
export function EightQuestionForm({
  value, onChange, disabled = false, showErrors = false, idPrefix = 'eightq',
}: {
  value: EightQAnswers;
  onChange: (next: EightQAnswers) => void;
  disabled?: boolean;
  showErrors?: boolean;
  idPrefix?: string;
}) {
  const scoring = scoreEightQ(value);
  const missing = 'missingItems' in scoring ? scoring.missingItems : [];
  const missingQ3 = 'missingQ3FollowUp' in scoring ? scoring.missingQ3FollowUp : false;

  const choice = (name: string, current: boolean | undefined, labels: ReadonlyArray<{ value: boolean; label: string }>, set: (v: boolean) => void, aria: string) => (
    <div role="radiogroup" aria-label={aria} className="grid grid-cols-2 gap-1.5 max-w-xs">
      {labels.map((o) => (
        <label
          key={String(o.value)}
          className={`relative text-center px-2 py-2.5 rounded-lg border text-[11px] font-semibold select-none transition-colors ${
            current === o.value ? 'bg-purple-500/25 border-purple-500 text-purple-100' : 'bg-slate-950 border-white/10 text-slate-300 hover:border-white/30'
          } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <input type="radio" name={name} checked={current === o.value} disabled={disabled} onChange={() => set(o.value)} className="sr-only" />
          {o.label}
        </label>
      ))}
    </div>
  );

  return (
    <div className="space-y-3" data-testid="eightq-form">
      <ol className="space-y-2.5">
        {EIGHT_Q_ITEMS.map((item) => {
          const v = value.answers[item.n];
          const unanswered = v === undefined;
          return (
            <li
              key={item.n}
              data-testid={`eightq-item-${item.n}`}
              className={`rounded-xl border p-3 space-y-2 ${showErrors && unanswered ? 'border-rose-500/50 bg-rose-500/5' : 'border-white/10 bg-slate-950/40'}`}
            >
              <p className="text-xs text-slate-100 leading-relaxed"><span className="font-mono font-bold text-purple-300 mr-1.5">{item.n}.</span>{item.text}</p>
              {choice(`${idPrefix}-q${item.n}`, v, YES_NO, (b) => onChange({ ...value, answers: { ...value.answers, [item.n]: b } }), `ข้อ ${item.n}`)}
              {showErrors && unanswered && <span role="alert" className="block text-[11px] text-rose-400">กรุณาตอบข้อ {item.n}</span>}

              {item.followUp && v === true && (
                <div className="mt-2 ml-3 pl-3 border-l border-purple-500/40 space-y-1.5" data-testid="eightq-q3-followup">
                  <p className="text-xs text-slate-200">{item.followUp.text}</p>
                  {choice(`${idPrefix}-q3-control`, value.q3CanControl, [{ value: true, label: 'ได้' }, { value: false, label: 'ไม่ได้' }], (b) => onChange({ ...value, q3CanControl: b }), 'ควบคุมความคิดนั้นได้ไหม')}
                  {showErrors && missingQ3 && <span role="alert" className="block text-[11px] text-rose-400">กรุณาตอบว่าควบคุมความคิดได้หรือไม่</span>}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <div className="text-xs rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2.5" data-testid="eightq-preview">
        {'totalScore' in scoring ? (
          <span className="text-slate-300">
            คะแนนรวม <b className="font-mono text-white">{scoring.totalScore}</b> → <b className={scoring.riskLevel === 'NONE' ? 'text-emerald-400' : scoring.riskLevel === 'LOW' ? 'text-amber-400' : 'text-rose-400'}>{EIGHT_Q_RISK_LABEL[scoring.riskLevel]}</b>
            {scoring.urgentReferral && <b className="ml-2 text-rose-400">ส่งต่อโรงพยาบาลด่วน</b>}
          </span>
        ) : (
          <span className="text-slate-500">ตอบให้ครบทุกข้อ{missing.length > 0 ? ` (ยังเหลือ ${missing.length} ข้อ)` : ''}{missingQ3 ? ' และตอบข้อย่อยของข้อ 3' : ''} เพื่อดูผลสรุป</span>
        )}
      </div>
    </div>
  );
}
