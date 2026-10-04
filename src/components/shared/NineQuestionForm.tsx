import React from 'react';
import {
  NINE_Q_ITEMS,
  NINE_Q_ITEM_COUNT,
  NINE_Q_ITEM_NUMBERS,
  NINE_Q_OPTIONS,
  NineQAnswerValue,
  NineQAnswers,
} from '../../lib/depressionScreening';

export const EMPTY_NINE_Q_ANSWERS: NineQAnswers = {};

/**
 * แบบประเมินภาวะซึมเศร้า 9Q (ฉบับไทย กรมสุขภาพจิต) — นักเรียนตอบเองทีละข้อ ข้อละ 4 ตัวเลือก
 * ⚠ ฟอร์มนี้ "ไม่แสดงคะแนนรวม/ระดับ/ธงแดง" ใดๆ ให้ผู้ตอบเห็น (นักเรียนห้ามเห็นผลดิบของ 9Q/8Q) — ผลคำนวณตอนบันทึกเท่านั้น
 * ไม่มีค่าเริ่มต้นแทนผู้ตอบ: ต้องตอบครบ 9 ข้อก่อนส่ง
 * หมายเหตุ layout: ป้ายตัวเลือกต้อง `relative` เสมอ — radio ที่ซ่อนด้วย sr-only เป็น position:absolute ถ้าไม่มี ancestor ที่ relative
 * browser จะเลื่อน root ของ App ที่ overflow-hidden ตอนโฟกัส ทำให้ทั้งหน้าเลื่อนหาย (บั๊กเดียวกับ SDQ ที่แก้ไปแล้ว)
 */
export function NineQuestionForm({
  answers, onChange, disabled = false, showErrors = false, idPrefix = 'nineq',
}: {
  answers: NineQAnswers;
  onChange: (next: NineQAnswers) => void;
  disabled?: boolean;
  showErrors?: boolean;
  idPrefix?: string;
}) {
  const answered = NINE_Q_ITEM_NUMBERS.filter((n) => answers[n] !== undefined).length;
  const pct = Math.round((answered / NINE_Q_ITEM_COUNT) * 100);

  return (
    <div className="space-y-3" data-testid="nineq-form">
      <div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-semibold text-slate-200" data-testid="nineq-progress-count">ตอบแล้ว {answered}/{NINE_Q_ITEM_COUNT} ข้อ</span>
        </div>
        <div className="mt-1.5 h-1.5 rounded-full bg-slate-800 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={NINE_Q_ITEM_COUNT} aria-valuenow={answered} aria-label="ความคืบหน้าการตอบ">
          <div className="h-full bg-purple-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <ol className="space-y-2.5">
        {NINE_Q_ITEM_NUMBERS.map((n) => {
          const value = answers[n];
          const unanswered = value === undefined;
          return (
            <li
              key={n}
              data-testid={`nineq-item-${n}`}
              className={`rounded-xl border p-3 space-y-2 ${showErrors && unanswered ? 'border-rose-500/50 bg-rose-500/5' : 'border-white/10 bg-slate-950/40'}`}
            >
              <p className="text-xs text-slate-100 leading-relaxed"><span className="font-mono font-bold text-purple-300 mr-1.5">{n}.</span>{NINE_Q_ITEMS[n - 1]}</p>
              <div role="radiogroup" aria-label={`ข้อ ${n}`} className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {NINE_Q_OPTIONS.map((o) => (
                  <label
                    key={o.value}
                    // relative: กักช่อง radio ที่ซ่อนด้วย sr-only ไว้ในป้ายตัวเอง (ดูหมายเหตุหัวไฟล์)
                    className={`relative text-center px-1 py-2.5 rounded-lg border text-[11px] font-semibold select-none transition-colors ${
                      value === o.value ? 'bg-purple-500/25 border-purple-500 text-purple-100' : 'bg-slate-950 border-white/10 text-slate-300 hover:border-white/30'
                    } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <input
                      type="radio"
                      name={`${idPrefix}-q${n}`}
                      value={o.value}
                      checked={value === o.value}
                      disabled={disabled}
                      onChange={() => onChange({ ...answers, [n]: o.value as NineQAnswerValue })}
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
    </div>
  );
}
