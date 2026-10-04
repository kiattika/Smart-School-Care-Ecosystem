/**
 * SDQ (Strengths and Difficulties Questionnaire) — โครงคะแนนและเกณฑ์กลาง (pure, ทดสอบได้: src/__tests__/sdq.test.ts)
 *
 * ใช้ร่วมกันทุกจุดที่กรอก/แสดง SDQ: ครูที่ปรึกษา (AdvisorSdqPanel), นักเรียน/ผู้ปกครอง (HealthMentalWellbeingModule),
 * ครูแนะแนว (GuidancePortal), แนวโน้มข้ามปี (SdqTrendSection)
 *
 * ── แหล่งที่มาของเกณฑ์แปลผล ──
 * เกณฑ์จากคู่มือกรมสุขภาพจิต / สพฐ. — เอกสาร "การบริหารจัดการระบบการดูแลช่วยเหลือนักเรียน" หน้า 139-141
 * (ตัวเลขด้านล่างถอดจากตารางที่เจ้าของโปรเจกต์ส่งมา — ถ้าคู่มือฉบับล่าสุดต่างไป ให้แก้ที่ SDQ_CRITERIA ที่เดียว
 * แล้วเปลี่ยน SDQ_CRITERIA_VERSION; เทสต์ใน sdq.test.ts ตรวจค่าขอบเขตทุกเกณฑ์)
 *   - แยกตามผู้ประเมิน: ฉบับนักเรียนประเมินตนเอง (STUDENT) ต่างจากฉบับครู (TEACHER) / ผู้ปกครอง (PARENT) ซึ่งใช้ชุดเดียวกัน
 *   - แยกรายด้าน: ทั้งคะแนนรวม 4 ด้านปัญหา และรายด้านทั้ง 5 (ด้านจุดแข็ง "สัมพันธภาพทางสังคม" แปลผลเป็น มี/ไม่มีจุดแข็ง)
 * ผลประเมินที่บันทึกด้วยเกณฑ์นี้จะมี criteriaVersion = SDQ_CRITERIA_VERSION; ข้อมูลเก่าที่ไม่มี field นี้คำนวณด้วยเกณฑ์เดิม
 * (รวม 4 ด้าน ≥14 เสี่ยง, ≥17 มีปัญหา ทุกผู้ประเมิน) — ไม่คำนวณย้อนหลังอัตโนมัติ แสดงพร้อมหมายเหตุ (isLegacySdqCriteria)
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
export type SdqDifficultyKey = Exclude<SdqSubscaleKey, 'prosocial'>;
export type SdqScores = Record<SdqSubscaleKey, number>;
export type SdqTriage = 'NORMAL' | 'AT_RISK' | 'VULNERABLE';
export type SdqEvaluatorType = 'STUDENT' | 'TEACHER' | 'PARENT';

export const SDQ_SUBSCALE_MAX = 10;
/** คะแนนรวม 4 ด้านปัญหา (emotional + conduct + hyperactivity + peerProblems) สูงสุด */
export const SDQ_DIFFICULTIES_MAX = 40;

/** เวอร์ชันของเกณฑ์แปลผลที่ประทับลงผลประเมินใหม่ทุกชุด (criteriaVersion) */
export const SDQ_CRITERIA_VERSION = 'dmh-obec-2' as const;

export const SDQ_TRIAGE_LABEL: Record<SdqTriage, string> = {
  NORMAL: 'ปกติ',
  AT_RISK: 'เสี่ยง',
  VULNERABLE: 'มีปัญหา',
};

/** ด้านจุดแข็ง (prosocial) แปลผลเป็น มี/ไม่มีจุดแข็ง ไม่ใช่ ปกติ/เสี่ยง/มีปัญหา */
export type SdqStrengthStatus = 'HAS_STRENGTH' | 'NO_STRENGTH';
export const SDQ_STRENGTH_LABEL: Record<SdqStrengthStatus, string> = {
  HAS_STRENGTH: 'มีจุดแข็ง',
  NO_STRENGTH: 'ไม่มีจุดแข็ง',
};
export type SdqSubscaleStatus = Record<SdqDifficultyKey, SdqTriage> & { prosocial: SdqStrengthStatus };

/** ขอบล่างของ "เสี่ยง" และ "มีปัญหา" (ต่ำกว่า atRiskMin = ปกติ) */
export interface SdqCutoff { atRiskMin: number; vulnerableMin: number }
export interface SdqCriteriaSet {
  /** รวม 4 ด้านปัญหา (0-40) */
  total: SdqCutoff;
  emotional: SdqCutoff;
  conduct: SdqCutoff;
  hyperactivity: SdqCutoff;
  peerProblems: SdqCutoff;
  /** ด้านจุดแข็ง: คะแนน ≥ strengthMin = มีจุดแข็ง */
  prosocial: { strengthMin: number };
}

/** ฉบับนักเรียนประเมินตนเอง */
const SELF_CRITERIA: SdqCriteriaSet = {
  total: { atRiskMin: 17, vulnerableMin: 19 },          // ปกติ 0-16, เสี่ยง 17-18, มีปัญหา 19-40
  emotional: { atRiskMin: 6, vulnerableMin: 7 },        // 0-5, 6, 7-10
  conduct: { atRiskMin: 5, vulnerableMin: 6 },          // 0-4, 5, 6-10
  hyperactivity: { atRiskMin: 6, vulnerableMin: 7 },    // 0-5, 6, 7-10
  peerProblems: { atRiskMin: 4, vulnerableMin: 5 },     // 0-3, 4, 5-10
  prosocial: { strengthMin: 4 },                        // ไม่มีจุดแข็ง 0-3, มีจุดแข็ง 4-10
};

/** ฉบับครู และฉบับผู้ปกครอง (ใช้เกณฑ์เดียวกัน) */
const ADULT_CRITERIA: SdqCriteriaSet = {
  total: { atRiskMin: 16, vulnerableMin: 18 },          // ปกติ 0-15, เสี่ยง 16-17, มีปัญหา 18-40
  emotional: { atRiskMin: 4, vulnerableMin: 5 },        // 0-3, 4, 5-10
  conduct: { atRiskMin: 4, vulnerableMin: 5 },          // 0-3, 4, 5-10
  hyperactivity: { atRiskMin: 6, vulnerableMin: 7 },    // 0-5, 6, 7-10
  peerProblems: { atRiskMin: 6, vulnerableMin: 7 },     // 0-5, 6, 7-10
  prosocial: { strengthMin: 4 },                        // ไม่มีจุดแข็ง 0-3, มีจุดแข็ง 4-10
};

/** เกณฑ์แยกตามผู้ประเมิน (evaluatorType) */
export const SDQ_CRITERIA: Record<SdqEvaluatorType, SdqCriteriaSet> = {
  STUDENT: SELF_CRITERIA,
  TEACHER: ADULT_CRITERIA,
  PARENT: ADULT_CRITERIA,
};

export const SDQ_SUBSCALE_LABEL: Record<SdqSubscaleKey, string> = {
  emotional: 'อารมณ์',
  conduct: 'ความประพฤติ',
  hyperactivity: 'อยู่ไม่นิ่ง/สมาธิสั้น',
  peerProblems: 'เพื่อน',
  prosocial: 'สัมพันธภาพทางสังคม',
};

export const SDQ_EVALUATOR_LABEL: Record<SdqEvaluatorType, string> = {
  STUDENT: 'นักเรียน (ประเมินตนเอง)',
  TEACHER: 'ครูที่ปรึกษา',
  PARENT: 'ผู้ปกครอง',
};

function classifyByCutoff(value: number, cutoff: SdqCutoff): SdqTriage {
  if (value >= cutoff.vulnerableMin) return 'VULNERABLE';
  if (value >= cutoff.atRiskMin) return 'AT_RISK';
  return 'NORMAL';
}

/** สถานะ "รวม 4 ด้าน" ตามเกณฑ์ของผู้ประเมินคนนั้น */
export function classifySdqTotal(totalDifficulties: number, evaluatorType: SdqEvaluatorType): SdqTriage {
  return classifyByCutoff(totalDifficulties, SDQ_CRITERIA[evaluatorType].total);
}

/** สถานะรายด้านปัญหา (อารมณ์/ความประพฤติ/อยู่ไม่นิ่ง/เพื่อน) ตามเกณฑ์ของผู้ประเมิน */
export function classifySdqSubscale(key: SdqDifficultyKey, score: number, evaluatorType: SdqEvaluatorType): SdqTriage {
  return classifyByCutoff(score, SDQ_CRITERIA[evaluatorType][key]);
}

export function classifySdqStrength(prosocialScore: number, evaluatorType: SdqEvaluatorType): SdqStrengthStatus {
  return prosocialScore >= SDQ_CRITERIA[evaluatorType].prosocial.strengthMin ? 'HAS_STRENGTH' : 'NO_STRENGTH';
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

/** ผลที่เก็บต่อ 1 ชุดประเมิน: คะแนนรวม + สถานะรวม + สถานะรายด้านทั้ง 5 + เวอร์ชันเกณฑ์ */
export interface SdqComputed {
  totalDifficultiesScore: number;
  /** สถานะ "รวม 4 ด้าน" (ชื่อฟิลด์เดิม คงไว้ให้ที่อ่านอยู่เดิมใช้ต่อได้) */
  triagingStatus: SdqTriage;
  subscaleStatus: SdqSubscaleStatus;
  criteriaVersion: typeof SDQ_CRITERIA_VERSION;
  recommendations: string[];
}

/** ผลประเมินเก่าที่ไม่มี criteriaVersion = คำนวณด้วยเกณฑ์เดิม (ก่อนใช้เกณฑ์ กรมสุขภาพจิต/สพฐ.) — ไม่คำนวณย้อนหลัง */
export function isLegacySdqCriteria(rec: { criteriaVersion?: string | null }): boolean {
  return rec.criteriaVersion !== SDQ_CRITERIA_VERSION;
}
export const SDQ_LEGACY_NOTE = 'คำนวณด้วยเกณฑ์เดิม (ก่อนปรับตามคู่มือกรมสุขภาพจิต/สพฐ.)';

/** สถานะรายด้านทั้ง 5 ของผู้ประเมินคนนั้น */
export function classifySdqSubscales(scores: SdqScores, evaluatorType: SdqEvaluatorType): SdqSubscaleStatus {
  return {
    emotional: classifySdqSubscale('emotional', scores.emotional, evaluatorType),
    conduct: classifySdqSubscale('conduct', scores.conduct, evaluatorType),
    hyperactivity: classifySdqSubscale('hyperactivity', scores.hyperactivity, evaluatorType),
    peerProblems: classifySdqSubscale('peerProblems', scores.peerProblems, evaluatorType),
    prosocial: classifySdqStrength(scores.prosocial, evaluatorType),
  };
}

/** ผลที่คำนวณจากคะแนนรายด้าน — ใช้เติมลงเอกสาร SDQAssessment. ต้องระบุผู้ประเมินเสมอ (เกณฑ์ต่างกันตามผู้ประเมิน) */
export function computeSdq(scores: SdqScores, evaluatorType: SdqEvaluatorType): SdqComputed {
  const total = totalDifficulties(scores);
  const triagingStatus = classifySdqTotal(total, evaluatorType);
  const subscaleStatus = classifySdqSubscales(scores, evaluatorType);
  const flagged = (['emotional', 'conduct', 'hyperactivity', 'peerProblems'] as const)
    .filter((k) => subscaleStatus[k] !== 'NORMAL')
    .map((k) => `${SDQ_SUBSCALE_LABEL[k]}: ${SDQ_TRIAGE_LABEL[subscaleStatus[k]]}`);
  return {
    totalDifficultiesScore: total,
    triagingStatus,
    subscaleStatus,
    criteriaVersion: SDQ_CRITERIA_VERSION,
    recommendations: [
      `คะแนนปัญหาพฤติกรรมรวม: ${total}/${SDQ_DIFFICULTIES_MAX} (${SDQ_TRIAGE_LABEL[triagingStatus]})`,
      ...(flagged.length > 0 ? [`ด้านที่ต้องติดตาม: ${flagged.join(', ')}`] : []),
      `สัมพันธภาพทางสังคม (จุดแข็ง): ${scores.prosocial}/${SDQ_SUBSCALE_MAX} (${SDQ_STRENGTH_LABEL[subscaleStatus.prosocial]})`,
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
