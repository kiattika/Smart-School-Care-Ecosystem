/**
 * SDQ (Strengths and Difficulties Questionnaire) — โครงคะแนนและเกณฑ์กลาง (pure, ทดสอบได้: src/__tests__/sdq.test.ts)
 *
 * ใช้ร่วมกันทุกจุดที่กรอก/แสดง SDQ: ครูที่ปรึกษา (AdvisorSdqPanel), นักเรียน/ผู้ปกครอง (HealthMentalWellbeingModule),
 * ครูแนะแนว (GuidancePortal) — เกณฑ์เดียวกับที่ HealthMentalWellbeingModule ใช้เดิม (รวม 4 ด้านปัญหา ≥17 = มีปัญหา,
 * ≥14 = เสี่ยง) ย้ายมาไว้ที่เดียว
 *
 * ระบบเก็บ "คะแนนรายด้าน" (subscaleScores, 0-10 ต่อด้าน) ไม่ได้เก็บคำตอบรายข้อ — ผู้กรอกสรุปคะแนนแต่ละด้านจากแบบประเมิน
 * ฉบับทางการของโรงเรียนแล้วกรอกตัวเลขที่นี่
 */

export const SDQ_SUBSCALES = [
  { key: 'emotional', label: 'ด้านอารมณ์', hint: 'Emotional symptoms', difficulty: true },
  { key: 'conduct', label: 'ด้านความประพฤติ', hint: 'Conduct problems', difficulty: true },
  { key: 'hyperactivity', label: 'ด้านสมาธิสั้น/อยู่ไม่นิ่ง', hint: 'Hyperactivity / inattention', difficulty: true },
  { key: 'peerProblems', label: 'ด้านปัญหาความสัมพันธ์กับเพื่อน', hint: 'Peer problems', difficulty: true },
  { key: 'prosocial', label: 'ด้านสัมพันธภาพทางสังคม (จุดแข็ง)', hint: 'Prosocial behaviour', difficulty: false },
] as const;

export type SdqSubscaleKey = (typeof SDQ_SUBSCALES)[number]['key'];
export type SdqScores = Record<SdqSubscaleKey, number>;
export type SdqTriage = 'NORMAL' | 'AT_RISK' | 'VULNERABLE';
export type SdqEvaluatorType = 'STUDENT' | 'TEACHER' | 'PARENT';

export const SDQ_SUBSCALE_MAX = 10;
/** คะแนนรวม 4 ด้านปัญหา (emotional + conduct + hyperactivity + peerProblems) สูงสุด */
export const SDQ_DIFFICULTIES_MAX = 40;
export const SDQ_AT_RISK_MIN = 14;
export const SDQ_VULNERABLE_MIN = 17;

export const SDQ_TRIAGE_LABEL: Record<SdqTriage, string> = {
  NORMAL: 'เกณฑ์ปกติ',
  AT_RISK: 'กลุ่มเสี่ยง',
  VULNERABLE: 'กลุ่มมีปัญหา',
};

export const SDQ_EVALUATOR_LABEL: Record<SdqEvaluatorType, string> = {
  STUDENT: 'นักเรียน (ประเมินตนเอง)',
  TEACHER: 'ครูที่ปรึกษา',
  PARENT: 'ผู้ปกครอง',
};

export function classifySdqTotal(totalDifficulties: number): SdqTriage {
  if (totalDifficulties >= SDQ_VULNERABLE_MIN) return 'VULNERABLE';
  if (totalDifficulties >= SDQ_AT_RISK_MIN) return 'AT_RISK';
  return 'NORMAL';
}

export function totalDifficulties(scores: Pick<SdqScores, 'emotional' | 'conduct' | 'hyperactivity' | 'peerProblems'>): number {
  return scores.emotional + scores.conduct + scores.hyperactivity + scores.peerProblems;
}

export type SdqScoreErrors = Partial<Record<SdqSubscaleKey, string>>;

/**
 * ตรวจคะแนนที่กรอก — ทุกด้านต้องกรอก (ไม่มีค่าเริ่มต้นแทนให้) เป็นจำนวนเต็ม 0-10
 * รับค่าจากช่องกรอก (string) หรือ number ก็ได้
 */
export function validateSdqScores(
  input: Partial<Record<SdqSubscaleKey, unknown>>,
): { ok: true; scores: SdqScores } | { ok: false; errors: SdqScoreErrors } {
  const errors: SdqScoreErrors = {};
  const scores: Partial<SdqScores> = {};
  for (const { key } of SDQ_SUBSCALES) {
    const raw = input[key];
    const text = typeof raw === 'number' ? String(raw) : typeof raw === 'string' ? raw.trim() : '';
    if (text === '') { errors[key] = 'กรุณากรอกคะแนน'; continue; }
    if (!/^\d+$/.test(text)) { errors[key] = `ต้องเป็นจำนวนเต็ม 0-${SDQ_SUBSCALE_MAX}`; continue; }
    const n = Number(text);
    if (n > SDQ_SUBSCALE_MAX) { errors[key] = `ไม่เกิน ${SDQ_SUBSCALE_MAX}`; continue; }
    scores[key] = n;
  }
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, scores: scores as SdqScores };
}

/** ผลที่คำนวณจากคะแนนรายด้าน — ใช้เติมลงเอกสาร SDQAssessment */
export function computeSdq(scores: SdqScores): { totalDifficultiesScore: number; triagingStatus: SdqTriage; recommendations: string[] } {
  const total = totalDifficulties(scores);
  const triagingStatus = classifySdqTotal(total);
  return {
    totalDifficultiesScore: total,
    triagingStatus,
    recommendations: [
      `คะแนนปัญหาพฤติกรรมรวม: ${total}/${SDQ_DIFFICULTIES_MAX} (${SDQ_TRIAGE_LABEL[triagingStatus]})`,
      `สัมพันธภาพทางสังคม (จุดแข็ง): ${scores.prosocial}/${SDQ_SUBSCALE_MAX}`,
    ],
  };
}

// ─── ปีการศึกษา + id ของเอกสาร ───

export const ACADEMIC_YEAR_PATTERN = /^[0-9]{4}$/;
export const isValidAcademicYear = (v: unknown): v is string => typeof v === 'string' && ACADEMIC_YEAR_PATTERN.test(v);

/**
 * id ของเอกสาร SDQ = `{studentId}_{evaluatorType}_{academicYear}` — ตายตัวต่อ (นักเรียน, ผู้ประเมิน, ปี)
 * firestore.rules ใช้ id นี้กันการสร้างซ้ำ (rules ค้นหาเอกสารซ้ำด้วย query ไม่ได้ — create ทับของเดิมคือ update ซึ่งผู้กรอกทำไม่ได้)
 * ต้องตรงกับ sdqId ใน match /student_assessments_sdq/{sdqId} ของ firestore.rules
 */
export function sdqDocId(studentId: string, evaluatorType: SdqEvaluatorType, academicYear: string): string {
  return `${studentId}_${evaluatorType}_${academicYear}`;
}
