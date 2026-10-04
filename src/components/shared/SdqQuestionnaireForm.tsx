import React from 'react';
import { SDQ_SUBSCALES, SDQ_SUBSCALE_LABEL, SdqEvaluatorType, computeSdq } from '../../lib/sdq';
import {
  SDQ_ANSWER_OPTIONS,
  SDQ_ITEM_COUNT,
  SDQ_ITEM_NUMBERS,
  SdqAnswerValue,
  SdqAnswers,
  answeredSdqCount,
  missingSdqItems,
  scoreSdqAnswers,
  sdqItemText,
} from '../../lib/sdqQuestionnaire';
import { SdqStatusView } from './SdqStatusView';

export const EMPTY_SDQ_ANSWERS: SdqAnswers = {};

/**
 * แบบสอบถาม SDQ 25 ข้อ (ส่วนที่ 1) — ผู้ตอบเลือกทีละข้อ ไม่จริง / ค่อนข้างจริง / จริง แล้วระบบบวกคะแนน 5 ด้านให้เอง
 * (src/lib/sdqQuestionnaire.ts) แล้วส่งต่อ src/lib/sdq.ts แปลผลตามเกณฑ์ของผู้ประเมิน
 * - แสดงเลขข้อตามแบบฟอร์มทางการกำกับทุกข้อ เรียง 1-25 (ไม่จัดกลุ่มตามด้าน เพื่อไม่ชี้นำคำตอบ)
 * - ไม่มีค่าเริ่มต้นแทนผู้ตอบ: ข้อที่ยังไม่ตอบไม่นับเป็น 0 — ต้องตอบครบ 25 ข้อก่อนบันทึก
 * - ปุ่มตอบใหญ่ แตะง่ายบนมือถือ; แถบความคืบหน้าติดบน (sticky) พร้อมปุ่มกระโดดไปข้อที่ยังไม่ตอบ
 */
export function SdqQuestionnaireForm({
  answers, onChange, evaluatorType, disabled = false, showErrors = false, idPrefix = 'sdq',
}: {
  answers: SdqAnswers;
  onChange: (next: SdqAnswers) => void;
  evaluatorType: SdqEvaluatorType;
  disabled?: boolean;
  showErrors?: boolean;
  idPrefix?: string;
}) {
  const answered = answeredSdqCount(answers);
  const missing = missingSdqItems(answers);
  const scoring = scoreSdqAnswers(answers);
  const preview = scoring.ok ? computeSdq(scoring.scores, evaluatorType) : null;
  const pct = Math.round((answered / SDQ_ITEM_COUNT) * 100);

  const jumpToFirstMissing = () => {
    if (missing.length === 0) return;
    document.getElementById(`${idPrefix}-item-${missing[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className="space-y-3" data-testid="sdq-questionnaire">
      <div className="sticky top-0 z-10 -mx-1 px-1 py-2 bg-[#121624]/95 backdrop-blur border-b border-white/10">
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="font-semibold text-slate-200" data-testid="sdq-progress-count">ตอบแล้ว {answered}/{SDQ_ITEM_COUNT} ข้อ</span>
          {missing.length > 0 && (
            <button type="button" onClick={jumpToFirstMissing} className="text-purple-300 hover:text-purple-200 underline underline-offset-2">
              ไปข้อที่ยังไม่ตอบ (ข้อ {missing[0]})
            </button>
          )}
        </div>
        <div className="mt-1.5 h-1.5 rounded-full bg-slate-800 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={SDQ_ITEM_COUNT} aria-valuenow={answered} aria-label="ความคืบหน้าการตอบ">
          <div className="h-full bg-purple-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <p className="text-[11px] text-slate-400">เลือกคำตอบที่ตรงที่สุดในแต่ละข้อ (ทุกข้อต้องตอบ)</p>

      <ol className="space-y-2.5">
        {SDQ_ITEM_NUMBERS.map((n) => {
          const value = answers[n];
          const unanswered = value === undefined;
          return (
            <li
              key={n}
              id={`${idPrefix}-item-${n}`}
              data-testid={`sdq-item-${n}`}
              className={`rounded-xl border p-3 space-y-2 ${showErrors && unanswered ? 'border-rose-500/50 bg-rose-500/5' : 'border-white/10 bg-slate-950/40'}`}
            >
              <p className="text-xs text-slate-100 leading-relaxed"><span className="font-mono font-bold text-purple-300 mr-1.5">{n}.</span>{sdqItemText(evaluatorType, n)}</p>
              <div role="radiogroup" aria-label={`ข้อ ${n}`} className="grid grid-cols-3 gap-1.5">
                {SDQ_ANSWER_OPTIONS.map((o) => (
                  <label
                    key={o.value}
                    className={`text-center px-1 py-2.5 rounded-lg border text-[11px] font-semibold select-none transition-colors ${
                      value === o.value ? 'bg-purple-500/25 border-purple-500 text-purple-100' : 'bg-slate-950 border-white/10 text-slate-300 hover:border-white/30'
                    } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <input
                      type="radio"
                      name={`${idPrefix}-q${n}`}
                      value={o.value}
                      checked={value === o.value}
                      disabled={disabled}
                      onChange={() => onChange({ ...answers, [n]: o.value as SdqAnswerValue })}
                      className="sr-only"
                    />
                    {o.label}
                  </label>
                ))}
              </div>
              {showErrors && unanswered && <span role="alert" className="block text-[11px] text-rose-400">กรุณาตอบข้อ {n}</span>}
            </li>
          );
        })}
      </ol>

      <div className="text-xs rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2.5 space-y-2" data-testid="sdq-preview">
        {scoring.ok && preview ? (
          <>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-300" data-testid="sdq-domain-scores">
              {SDQ_SUBSCALES.map(({ key }) => (
                <span key={key}>{SDQ_SUBSCALE_LABEL[key]} <b className="font-mono text-white">{scoring.scores[key]}</b>/10</span>
              ))}
            </div>
            <SdqStatusView rec={preview} />
          </>
        ) : (
          <span className="text-slate-500">ตอบให้ครบ {SDQ_ITEM_COUNT} ข้อ ระบบจะรวมคะแนน 5 ด้านและแปลผลให้อัตโนมัติ (ยังเหลือ {missing.length} ข้อ)</span>
        )}
      </div>
    </div>
  );
}
