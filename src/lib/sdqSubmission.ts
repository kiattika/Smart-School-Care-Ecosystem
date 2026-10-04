import { SdqComputed, SdqEvaluatorType, SdqScoreErrors, SdqScores, computeSdq, validateSdqScores } from './sdq';
import { ImpactErrors, ImpactFormValues, SdqImpactResult, computeImpact } from './sdqImpact';

/**
 * รวมผลหน้าที่ 1 (25 ข้อ → 5 ด้าน) + หน้าที่ 2 (ผลกระทบ) เป็นฟิลด์ที่ต้องเก็บในเอกสาร SDQAssessment เดียวกัน
 * ใช้ร่วมกันทุกจุดที่กรอก (AdvisorSdqPanel, HealthMentalWellbeingModule) — ตรวจครบทั้งสองหน้าก่อนบันทึก
 */
export type SdqSubmissionFields = SdqComputed & SdqImpactResult & { subscaleScores: SdqScores };

export function buildSdqSubmission(
  scoreValues: Partial<Record<keyof SdqScores, unknown>>,
  impactValues: ImpactFormValues,
  evaluatorType: SdqEvaluatorType,
): { ok: true; fields: SdqSubmissionFields } | { ok: false; scoreErrors: SdqScoreErrors; impactErrors: ImpactErrors } {
  const s = validateSdqScores(scoreValues);
  const i = computeImpact(impactValues);
  if (!s.ok || !i.ok) {
    return {
      ok: false,
      scoreErrors: 'errors' in s ? s.errors : {},
      impactErrors: 'errors' in i ? i.errors : {},
    };
  }
  return { ok: true, fields: { subscaleScores: s.scores, ...computeSdq(s.scores, evaluatorType), ...i.impact } };
}
