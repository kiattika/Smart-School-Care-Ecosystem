import React from 'react';
import {
  IMPACT_DOMAINS,
  IMPACT_DOMAINS_QUESTION,
  IMPACT_DURATION_OPTIONS,
  IMPACT_GATE_OPTIONS,
  IMPACT_LEVEL_OPTIONS,
  IMPACT_TOTAL_MAX,
  IMPACT_TRIAGE_LABEL,
  ImpactErrors,
  ImpactFormValues,
  ImpactLevel,
  computeImpact,
  impactDistressQuestion,
  impactGateQuestion,
} from '../../lib/sdqImpact';
import { SdqEvaluatorType } from '../../lib/sdq';

/** กลุ่มตัวเลือก (radio) แบบปุ่ม — ไม่มีค่าเริ่มต้น */
function Choice<T extends string>({
  name, options, value, onChange, disabled, ariaLabel,
}: {
  name: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T | '';
  onChange: (v: T) => void;
  disabled: boolean;
  ariaLabel: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <label
          key={o.value}
          // relative: กักช่อง radio ที่ซ่อนด้วย sr-only ไว้ในป้ายตัวเอง (ดูเหตุผลใน SdqQuestionnaireForm.tsx)
          className={`relative px-2.5 py-1.5 rounded-lg border text-[11px] cursor-pointer select-none transition-colors ${
            value === o.value ? 'bg-purple-500/20 border-purple-500 text-purple-200' : 'bg-slate-950 border-white/10 text-slate-300 hover:border-white/30'
          } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            disabled={disabled}
            onChange={() => onChange(o.value)}
            className="sr-only"
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}

const LEVEL_OPTIONS = IMPACT_LEVEL_OPTIONS.map(({ value, label }) => ({ value, label }));

/**
 * SDQ หน้าที่ 2 — แบบประเมินผลกระทบ (src/lib/sdqImpact.ts) ใช้เกณฑ์เดียวกันทั้ง 3 ผู้ประเมิน
 * ตอบ "ไม่" ในคำถามคัดกรอง → ซ่อนข้อ 2-4 (ผลเป็น ปกติ ทันที); ตอบ "ใช่" → กรอกข้อ 2-4 ต่อ
 */
export function SdqImpactForm({
  values, onChange, evaluatorType, disabled = false, showErrors = false, idPrefix = 'impact',
}: {
  values: ImpactFormValues;
  onChange: (next: ImpactFormValues) => void;
  evaluatorType: SdqEvaluatorType;
  disabled?: boolean;
  showErrors?: boolean;
  idPrefix?: string;
}) {
  const result = computeImpact(values);
  const errors: ImpactErrors = 'errors' in result ? result.errors : {};
  const err = (k: keyof ImpactErrors) => showErrors && errors[k] ? <span role="alert" className="block text-[11px] text-rose-400 mt-1">{errors[k]}</span> : null;
  const answeredYes = values.gate !== '' && values.gate !== 'NO';

  return (
    <div className="space-y-4" data-testid="sdq-impact-form">
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-slate-200">1. {impactGateQuestion(evaluatorType)}</p>
        <Choice name={`${idPrefix}-gate`} ariaLabel="คำถามคัดกรอง" options={IMPACT_GATE_OPTIONS} value={values.gate} disabled={disabled}
          onChange={(gate) => onChange({ ...values, gate })} />
        {err('gate')}
      </div>

      {values.gate === 'NO' && (
        <p className="text-[11px] text-emerald-300" data-testid="sdq-impact-skipped">ตอบ "ไม่" — ข้ามข้อ 2-4 บันทึกผลกระทบเป็น "ปกติ" (0 คะแนน)</p>
      )}

      {answeredYes && (
        <>
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-slate-200">2. ปัญหานี้มีมานานเท่าไร <span className="text-slate-500 font-normal">(แสดงผลเท่านั้น ไม่คิดคะแนน)</span></p>
            <Choice name={`${idPrefix}-duration`} ariaLabel="ระยะเวลาที่มีปัญหา" options={IMPACT_DURATION_OPTIONS} value={values.duration} disabled={disabled}
              onChange={(duration) => onChange({ ...values, duration })} />
            {err('duration')}
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-slate-200">3. {impactDistressQuestion(evaluatorType)}</p>
            <Choice name={`${idPrefix}-distress`} ariaLabel="ความไม่สบายใจ" options={LEVEL_OPTIONS} value={values.distress} disabled={disabled}
              onChange={(distress) => onChange({ ...values, distress })} />
            {err('distress')}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-200">4. {IMPACT_DOMAINS_QUESTION}</p>
            {IMPACT_DOMAINS.map(({ key, label }) => (
              <div key={key} className="space-y-1">
                <p className="text-[11px] text-slate-400">{label}</p>
                <Choice name={`${idPrefix}-${key}`} ariaLabel={label} options={LEVEL_OPTIONS} value={values.domains[key]} disabled={disabled}
                  onChange={(v: ImpactLevel) => onChange({ ...values, domains: { ...values.domains, [key]: v } })} />
                {err(key)}
              </div>
            ))}
          </div>
        </>
      )}

      <div className="text-xs rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2.5" data-testid="sdq-impact-preview">
        {'impact' in result ? (
          <span className="text-slate-300">
            คะแนนผลกระทบรวม <b className="text-white font-mono">{result.impact.impactTotalScore}/{IMPACT_TOTAL_MAX}</b> →{' '}
            <b className={result.impact.impactTriage === 'NORMAL' ? 'text-emerald-400' : result.impact.impactTriage === 'AT_RISK' ? 'text-amber-400' : 'text-rose-400'}>
              {IMPACT_TRIAGE_LABEL[result.impact.impactTriage]}
            </b>
          </span>
        ) : (
          <span className="text-slate-500">ตอบให้ครบเพื่อดูผลสรุปของหน้านี้</span>
        )}
      </div>
    </div>
  );
}
