import { SdqTriage } from './sdq';

/**
 * SDQ ส่วนที่ 2 — แบบประเมินผลกระทบ (impact supplement, "หน้าหลัง") — pure ทดสอบได้: src/__tests__/sdqImpact.test.ts
 *
 * ── แหล่งที่มา ──
 * เกณฑ์และการให้คะแนนจากคู่มือกรมสุขภาพจิต / สพฐ. (เอกสาร "การบริหารจัดการระบบการดูแลช่วยเหลือนักเรียน" หน้า 139-141
 * ตามตารางที่เจ้าของโปรเจกต์ส่งมา — เกณฑ์เดียวกันทั้ง 3 ผู้ประเมิน: นักเรียน/ครู/ผู้ปกครอง)
 *
 * คนละมิติกับส่วนที่ 1 (25 ข้อ → 5 ด้านใน src/lib/sdq.ts): ส่วนที่ 1 บอก "ชนิดของปัญหา" (อารมณ์/ความประพฤติ/...)
 * ส่วนนี้บอก "ความรุนแรงของผลกระทบ" ต่อชีวิตประจำวัน
 *
 * ข้อ 1  คำถามคัดกรอง (gate, ไม่คิดคะแนน): ไม่ / ใช่-เล็กน้อย / ใช่-ชัดเจน / ใช่-มาก
 *        ตอบ "ไม่" → ข้ามที่เหลือทั้งหมด บันทึก ปกติ (คะแนนรวม 0) ทันที
 * ข้อ 2  ระยะเวลาที่มีปัญหา (เก็บแสดงผลเฉยๆ ไม่คิดคะแนน)
 * ข้อ 3  ความไม่สบายใจ: ไม่เลย=0, เล็กน้อย=0, ค่อนข้างมาก=1, มาก=2
 * ข้อ 4  รบกวนชีวิตประจำวัน 4 ด้าน (บ้าน/เพื่อน/ห้องเรียน/กิจกรรมยามว่าง) คะแนนแบบเดียวกับข้อ 3
 * คะแนนรวมผลกระทบ = ข้อ 3 + ผลรวม 4 ด้านข้อ 4 (เต็ม 10): ปกติ = 0, เสี่ยง = 1-2, มีปัญหา = 3-10
 */

export const IMPACT_CRITERIA_SOURCE = 'คู่มือกรมสุขภาพจิต/สพฐ. "การบริหารจัดการระบบการดูแลช่วยเหลือนักเรียน" หน้า 139-141';

export type ImpactGateAnswer = 'NO' | 'YES_MINOR' | 'YES_DEFINITE' | 'YES_SEVERE';
export const IMPACT_GATE_OPTIONS: ReadonlyArray<{ value: ImpactGateAnswer; label: string }> = [
  { value: 'NO', label: 'ไม่' },
  { value: 'YES_MINOR', label: 'ใช่ — มีปัญหาเล็กน้อย' },
  { value: 'YES_DEFINITE', label: 'ใช่ — มีปัญหาชัดเจน' },
  { value: 'YES_SEVERE', label: 'ใช่ — มีปัญหามาก' },
];

/** ระยะเวลาที่มีปัญหา — เก็บเป็นรหัสช่วง (ฟิลด์ impactDurationMonths) แสดงผลเท่านั้น ไม่คิดคะแนน */
export type ImpactDuration = 'LT_1' | 'M1_5' | 'M6_12' | 'GT_12';
export const IMPACT_DURATION_OPTIONS: ReadonlyArray<{ value: ImpactDuration; label: string }> = [
  { value: 'LT_1', label: 'น้อยกว่า 1 เดือน' },
  { value: 'M1_5', label: '1-5 เดือน' },
  { value: 'M6_12', label: '6-12 เดือน' },
  { value: 'GT_12', label: 'มากกว่า 1 ปี' },
];

export type ImpactLevel = 'NOT_AT_ALL' | 'A_LITTLE' | 'QUITE_A_LOT' | 'A_GREAT_DEAL';
export const IMPACT_LEVEL_OPTIONS: ReadonlyArray<{ value: ImpactLevel; label: string; score: 0 | 1 | 2 }> = [
  { value: 'NOT_AT_ALL', label: 'ไม่เลย', score: 0 },
  { value: 'A_LITTLE', label: 'เล็กน้อย', score: 0 },
  { value: 'QUITE_A_LOT', label: 'ค่อนข้างมาก', score: 1 },
  { value: 'A_GREAT_DEAL', label: 'มาก', score: 2 },
];
export const impactLevelScore = (level: ImpactLevel): 0 | 1 | 2 =>
  (IMPACT_LEVEL_OPTIONS.find((o) => o.value === level) as { score: 0 | 1 | 2 }).score;

export type ImpactDomainKey = 'home' | 'friends' | 'classroom' | 'leisure';
export const IMPACT_DOMAINS: ReadonlyArray<{ key: ImpactDomainKey; label: string }> = [
  { key: 'home', label: 'ความเป็นอยู่ที่บ้าน' },
  { key: 'friends', label: 'การคบเพื่อน' },
  { key: 'classroom', label: 'การเรียนในห้องเรียน' },
  { key: 'leisure', label: 'กิจกรรมยามว่าง' },
];

export const IMPACT_TOTAL_MAX = 10;
export const IMPACT_AT_RISK_MIN = 1;
export const IMPACT_VULNERABLE_MIN = 3;

export const IMPACT_TRIAGE_LABEL: Record<SdqTriage, string> = { NORMAL: 'ปกติ', AT_RISK: 'เสี่ยง', VULNERABLE: 'มีปัญหา' };

export function classifyImpactTotal(total: number): SdqTriage {
  if (total >= IMPACT_VULNERABLE_MIN) return 'VULNERABLE';
  if (total >= IMPACT_AT_RISK_MIN) return 'AT_RISK';
  return 'NORMAL';
}

/** คำเรียกผู้ถูกประเมินในข้อความคำถาม: ผู้ปกครอง = "เด็ก", นักเรียน/ครู = "นักเรียน" */
export const impactSubject = (evaluator: 'STUDENT' | 'TEACHER' | 'PARENT'): string => (evaluator === 'PARENT' ? 'เด็ก' : 'นักเรียน');

export const impactGateQuestion = (evaluator: 'STUDENT' | 'TEACHER' | 'PARENT'): string =>
  `โดยรวมแล้ว${impactSubject(evaluator)}มีปัญหาด้านอารมณ์ สมาธิ พฤติกรรม หรือความสามารถในการเข้ากับผู้อื่นหรือไม่`;
export const impactDistressQuestion = (evaluator: 'STUDENT' | 'TEACHER' | 'PARENT'): string =>
  `ปัญหานี้ทำให้${impactSubject(evaluator)}รู้สึกไม่สบายใจหรือไม่`;
export const IMPACT_DOMAINS_QUESTION = 'ปัญหานี้รบกวนชีวิตประจำวันในด้านต่อไปนี้หรือไม่';

/** ค่าในฟอร์ม — ว่างตั้งต้น ไม่มีค่าเริ่มต้นแทนผู้กรอก */
export interface ImpactFormValues {
  gate: ImpactGateAnswer | '';
  duration: ImpactDuration | '';
  distress: ImpactLevel | '';
  domains: Record<ImpactDomainKey, ImpactLevel | ''>;
}
export const EMPTY_IMPACT_FORM: ImpactFormValues = {
  gate: '',
  duration: '',
  distress: '',
  domains: { home: '', friends: '', classroom: '', leisure: '' },
};

/** ฟิลด์ที่เก็บลงเอกสาร SDQAssessment (ทั้งหมด optional ในเอกสาร — ข้อมูลเก่าไม่มี) */
export interface SdqImpactResult {
  impactGateAnswer: ImpactGateAnswer;
  /** รหัสช่วงระยะเวลา (ไม่คิดคะแนน) — ไม่มีเมื่อ gate = ไม่ */
  impactDurationMonths?: ImpactDuration;
  /** 0-2 — ไม่มีเมื่อ gate = ไม่ */
  impactDistressScore?: number;
  /** แต่ละด้าน 0-2 — ไม่มีเมื่อ gate = ไม่ */
  impactDomainScores?: Record<ImpactDomainKey, number>;
  /** 0-10 (gate = ไม่ → 0) */
  impactTotalScore: number;
  impactTriage: SdqTriage;
}

export type ImpactFieldKey = 'gate' | 'duration' | 'distress' | ImpactDomainKey;
export type ImpactErrors = Partial<Record<ImpactFieldKey, string>>;

/** คะแนนรวมจาก 5 ช่อง (ข้อ 3 + 4 ด้าน) */
export function impactTotal(distress: number, domains: Record<ImpactDomainKey, number>): number {
  return distress + domains.home + domains.friends + domains.classroom + domains.leisure;
}

/**
 * ตรวจและคำนวณหน้าผลกระทบ
 * - gate ว่าง = error (ต้องตอบก่อน)
 * - gate = ไม่ → ok ทันที: ปกติ คะแนน 0 ไม่ต้องกรอกข้อ 2-4 (ค่าที่ค้างในฟอร์มถูกทิ้ง ไม่เก็บ)
 * - gate = ใช่ → ต้องตอบข้อ 2, 3 และทั้ง 4 ด้านของข้อ 4 ครบ
 */
export function computeImpact(values: ImpactFormValues): { ok: true; impact: SdqImpactResult } | { ok: false; errors: ImpactErrors } {
  if (values.gate === '') return { ok: false, errors: { gate: 'กรุณาตอบคำถามคัดกรอง' } };
  if (values.gate === 'NO') {
    return { ok: true, impact: { impactGateAnswer: 'NO', impactTotalScore: 0, impactTriage: 'NORMAL' } };
  }
  const errors: ImpactErrors = {};
  if (values.duration === '') errors.duration = 'กรุณาเลือกระยะเวลาที่มีปัญหา';
  if (values.distress === '') errors.distress = 'กรุณาเลือกคำตอบ';
  for (const { key } of IMPACT_DOMAINS) if (values.domains[key] === '') errors[key] = 'กรุณาเลือกคำตอบ';
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const distress = impactLevelScore(values.distress as ImpactLevel);
  const domains = {
    home: impactLevelScore(values.domains.home as ImpactLevel),
    friends: impactLevelScore(values.domains.friends as ImpactLevel),
    classroom: impactLevelScore(values.domains.classroom as ImpactLevel),
    leisure: impactLevelScore(values.domains.leisure as ImpactLevel),
  };
  const total = impactTotal(distress, domains);
  return {
    ok: true,
    impact: {
      impactGateAnswer: values.gate,
      impactDurationMonths: values.duration as ImpactDuration,
      impactDistressScore: distress,
      impactDomainScores: domains,
      impactTotalScore: total,
      impactTriage: classifyImpactTotal(total),
    },
  };
}
