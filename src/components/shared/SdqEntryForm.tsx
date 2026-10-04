import React from 'react';
import { SdqEvaluatorType } from '../../lib/sdq';
import { EMPTY_IMPACT_FORM, ImpactFormValues } from '../../lib/sdqImpact';
import { SdqFormValues, SdqScoreForm } from './SdqScoreForm';
import { SdqImpactForm } from './SdqImpactForm';

export { EMPTY_IMPACT_FORM };
export type { ImpactFormValues };

/**
 * ฟอร์มกรอก SDQ ครบ 2 ส่วนในการบันทึกเดียวกัน — ใช้ร่วมกันทุกจุด (AdvisorSdqPanel, HealthMentalWellbeingModule)
 *   หน้าที่ 1: คะแนน 5 ด้านจากแบบประเมิน 25 ข้อ (ชนิดของปัญหา)       → SdqScoreForm
 *   หน้าที่ 2: แบบประเมินผลกระทบ (ความรุนแรงของปัญหาต่อชีวิตประจำวัน) → SdqImpactForm
 * บันทึกครั้งเดียวลงเอกสาร SDQAssessment เดียว (ดู buildSdqSubmission ใน src/lib/sdqSubmission.ts)
 */
export function SdqEntryForm({
  scores, onScoresChange, impact, onImpactChange, evaluatorType, disabled = false, showErrors = false, idPrefix,
}: {
  scores: SdqFormValues;
  onScoresChange: (next: SdqFormValues) => void;
  impact: ImpactFormValues;
  onImpactChange: (next: ImpactFormValues) => void;
  evaluatorType: SdqEvaluatorType;
  disabled?: boolean;
  showErrors?: boolean;
  idPrefix?: string;
}) {
  return (
    <div className="space-y-5" data-testid="sdq-entry-form-body">
      <section className="space-y-3">
        <h4 className="text-xs font-bold text-purple-300">หน้าที่ 1 · คะแนน 5 ด้านจากแบบประเมิน 25 ข้อ <span className="text-slate-500 font-normal">(ชนิดของปัญหา)</span></h4>
        <SdqScoreForm values={scores} onChange={onScoresChange} evaluatorType={evaluatorType} disabled={disabled} showErrors={showErrors} />
      </section>
      <section className="space-y-3 border-t border-white/10 pt-4">
        <h4 className="text-xs font-bold text-purple-300">หน้าที่ 2 · ผลกระทบ <span className="text-slate-500 font-normal">(ความรุนแรงของปัญหาต่อชีวิตประจำวัน)</span></h4>
        <SdqImpactForm values={impact} onChange={onImpactChange} evaluatorType={evaluatorType} disabled={disabled} showErrors={showErrors} idPrefix={idPrefix} />
      </section>
    </div>
  );
}
