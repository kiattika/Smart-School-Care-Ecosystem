import React from 'react';
import {
  SDQ_DIFFICULTIES_MAX,
  SDQ_STRENGTH_LABEL,
  SDQ_SUBSCALES,
  SDQ_SUBSCALE_MAX,
  SDQ_TRIAGE_LABEL,
  SdqEvaluatorType,
  SdqScoreErrors,
  SdqSubscaleKey,
  computeSdq,
  validateSdqScores,
} from '../../lib/sdq';
import { SdqStatusView } from './SdqStatusView';

/** ค่าในช่องกรอก (string) ต่อด้าน — ว่างเปล่าตั้งต้น ไม่มีค่าเริ่มต้นแทนผู้กรอก */
export type SdqFormValues = Record<SdqSubscaleKey, string>;
export const EMPTY_SDQ_FORM: SdqFormValues = { emotional: '', conduct: '', hyperactivity: '', peerProblems: '', prosocial: '' };

/**
 * ช่องกรอกคะแนน SDQ รายด้าน (0-10) + สรุปผลสดตามเกณฑ์กลางใน src/lib/sdq.ts — ใช้ร่วมกันทุกที่ที่กรอก SDQ
 * (ครูที่ปรึกษา AdvisorSdqPanel / นักเรียน-ผู้ปกครอง HealthMentalWellbeingModule)
 * evaluatorType ต้องระบุ: เกณฑ์แปลผลต่างกันตามผู้ประเมิน (นักเรียนประเมินตนเอง ≠ ครู/ผู้ปกครอง)
 * แสดง error ต่อช่องเมื่อ showErrors = true (หลังกดบันทึก)
 */
export function SdqScoreForm({
  values,
  onChange,
  evaluatorType,
  disabled = false,
  showErrors = false,
}: {
  values: SdqFormValues;
  onChange: (next: SdqFormValues) => void;
  evaluatorType: SdqEvaluatorType;
  disabled?: boolean;
  showErrors?: boolean;
}) {
  const validation = validateSdqScores(values);
  const errors: SdqScoreErrors = 'errors' in validation ? validation.errors : {};
  const preview = validation.ok ? computeSdq(validation.scores, evaluatorType) : null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {SDQ_SUBSCALES.map(({ key, label, hint }) => {
          const status = preview?.subscaleStatus[key];
          return (
            <label key={key} className="block space-y-1">
              <span className="text-[11px] font-semibold text-slate-300">
                {label} <span className="text-slate-500 font-normal">· {hint}</span>
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={SDQ_SUBSCALE_MAX}
                step={1}
                value={values[key]}
                disabled={disabled}
                onChange={(e) => onChange({ ...values, [key]: e.target.value })}
                placeholder={`0-${SDQ_SUBSCALE_MAX}`}
                aria-label={`คะแนน${label}`}
                className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-100 outline-none focus:border-purple-500 disabled:opacity-60"
              />
              {status && (
                <span className="text-[10px] text-slate-400" data-testid={`sdq-live-${key}`}>
                  แปลผล: {key === 'prosocial' ? SDQ_STRENGTH_LABEL[status as keyof typeof SDQ_STRENGTH_LABEL] : SDQ_TRIAGE_LABEL[status as keyof typeof SDQ_TRIAGE_LABEL]}
                </span>
              )}
              {showErrors && errors[key] && <span role="alert" className="text-[11px] text-rose-400">{errors[key]}</span>}
            </label>
          );
        })}
      </div>
      <div className="text-xs rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2.5" data-testid="sdq-preview">
        {preview ? (
          <SdqStatusView rec={preview} />
        ) : (
          <span className="text-slate-500">กรอกคะแนนครบทั้ง 5 ด้าน (จำนวนเต็ม 0-{SDQ_SUBSCALE_MAX}) เพื่อดูผลสรุป (รวม 4 ด้านสูงสุด {SDQ_DIFFICULTIES_MAX})</span>
        )}
      </div>
    </div>
  );
}
