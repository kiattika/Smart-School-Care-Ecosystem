/**
 * เครื่องมือคัดกรองซึมเศร้า/ฆ่าตัวตาย ตามลำดับ 2Q → 9Q → 8Q (คู่มือกรมสุขภาพจิต/สพฐ. — ฉบับไทย ไม่ใช่ PHQ-9 สากล)
 * pure ทดสอบได้: src/__tests__/depressionScreening.test.ts — ⚠ งานนี้กระทบความปลอดภัยเด็ก: อ่านรายงานจุดที่ตัดสินใจเอง/TODO
 * ท้ายงาน (docs/depression-screening.md) ก่อนใช้งานจริง
 *
 * ── 9Q (ซึมเศร้า) ──
 *   9 ข้อ ข้อละ 0-3: ไม่มีเลย=0, เป็นบางวัน(1-7วัน)=1, เป็นบ่อย(>7วัน)=2, เป็นทุกวัน=3
 *   รวม <7 ไม่มีอาการ/น้อยมาก, 7-12 น้อย, 13-18 ปานกลาง, ≥19 รุนแรง
 *   กติกาพิเศษ: ข้อ 9 (คิดทำร้ายตนเอง) ตอบ > 0 = ธงแดงทันที ไม่ว่าคะแนนรวมเท่าไร (แยกจากระดับคะแนนรวม)
 * ── 8Q (ความเสี่ยงฆ่าตัวตาย) ── ให้คะแนนไม่เท่ากันต่อข้อ
 *   ข้อ 1=1, 2=2, 3=6 (ถ้าตอบ "มี" ถามต่อ: ควบคุมความคิดได้ไหม ได้=0 ไม่ได้=+8), 4=8, 5=9, 6=4, 7=10, 8=4
 *   รวม 0 ไม่มีแนวโน้ม, 1-8 น้อย, 9-16 ปานกลาง, ≥17 รุนแรง = ส่งต่อโรงพยาบาลด่วน (ธงแดงสูงสุด)
 *
 * 9Q ถูกเปิดให้ทำได้เฉพาะเมื่อ (ก) 2Q ล่าสุดเป็นบวก หรือ (ข) ครูแนะแนว/ครูที่ปรึกษาเปิดให้ (grant);
 * 8Q กรอกโดยครูเท่านั้น และเปิดได้เมื่อ 9Q ล่าสุด รวม ≥7 หรือมีธงแดงข้อ 9 — เงื่อนไขเดียวกันนี้ firestore.rules บังคับจริงอีกชั้น
 */

// ───────────────────────── 9Q ─────────────────────────

export type NineQAnswerValue = 0 | 1 | 2 | 3;
export const NINE_Q_ITEM_COUNT = 9;
/** ข้อ 9 = คิดทำร้ายตนเอง/คิดว่าตายไปเสียคงจะดี */
export const NINE_Q_SUICIDE_ITEM = 9;

export const NINE_Q_ITEMS: readonly string[] = [
  'เบื่อ ไม่สนใจอยากทำอะไร',
  'ไม่สบายใจ ซึมเศร้า ท้อแท้',
  'หลับยาก หรือหลับๆ ตื่นๆ หรือหลับมากไป',
  'เหนื่อยง่าย หรือไม่ค่อยมีแรง',
  'เบื่ออาหารหรือกินมากเกินไป',
  'รู้สึกไม่ดีกับตัวเอง คิดว่าตัวเองล้มเหลวหรือเป็นคนทำให้ตัวเองหรือครอบครัวผิดหวัง',
  'สมาธิไม่ดี เวลาทำอะไร เช่น ดูโทรทัศน์ ฟังวิทยุ หรือทำงานที่ต้องใช้ความตั้งใจ',
  'พูดช้า ทำอะไรช้าลง จนคนอื่นสังเกตเห็นได้ หรือกระสับกระส่ายไม่สามารถอยู่นิ่งได้เหมือนที่เคยเป็น',
  'คิดทำร้ายตนเองหรือคิดว่าถ้าตายๆ ไปเสียคงจะดี',
];

export const NINE_Q_OPTIONS: ReadonlyArray<{ value: NineQAnswerValue; label: string }> = [
  { value: 0, label: 'ไม่มีเลย' },
  { value: 1, label: 'เป็นบางวัน (1-7 วัน)' },
  { value: 2, label: 'เป็นบ่อย (> 7 วัน)' },
  { value: 3, label: 'เป็นทุกวัน' },
];

export type NineQRiskLevel = 'NONE' | 'MILD' | 'MODERATE' | 'SEVERE';
export const NINE_Q_RISK_LABEL: Record<NineQRiskLevel, string> = {
  NONE: 'ไม่มีอาการ/น้อยมาก',
  MILD: 'น้อย',
  MODERATE: 'ปานกลาง',
  SEVERE: 'รุนแรง',
};
export const NINE_Q_MILD_MIN = 7;
export const NINE_Q_MODERATE_MIN = 13;
export const NINE_Q_SEVERE_MIN = 19;
export const NINE_Q_TOTAL_MAX = 27;

export function classifyNineQ(total: number): NineQRiskLevel {
  if (total >= NINE_Q_SEVERE_MIN) return 'SEVERE';
  if (total >= NINE_Q_MODERATE_MIN) return 'MODERATE';
  if (total >= NINE_Q_MILD_MIN) return 'MILD';
  return 'NONE';
}

/** คำตอบ 9Q: เลขข้อ (1-9) → ค่า 0-3; ข้อที่ยังไม่ตอบ = ไม่มี key */
export type NineQAnswers = Partial<Record<number, NineQAnswerValue>>;
export const NINE_Q_ITEM_NUMBERS: readonly number[] = Array.from({ length: NINE_Q_ITEM_COUNT }, (_, i) => i + 1);

export interface NineQResult {
  answers: NineQAnswerValue[]; // 9 ค่า ตามลำดับข้อ
  totalScore: number;
  riskLevel: NineQRiskLevel;
  /** ธงแดงจากข้อ 9 (ตอบ > 0) — แยกจาก riskLevel (คะแนนรวม) */
  redFlagItem9: boolean;
}

export type NineQScoring = ({ ok: true } & NineQResult) | { ok: false; missingItems: number[]; invalidItems: number[] };

const isNineQValue = (v: unknown): v is NineQAnswerValue => v === 0 || v === 1 || v === 2 || v === 3;

/** ต้องตอบครบ 9 ข้อและทุกค่าเป็น 0-3 — ไม่ครบ/ผิด = error (ไม่คำนวณครึ่งๆ กลางๆ ไม่นับข้อว่างเป็น 0) */
export function scoreNineQ(answers: NineQAnswers): NineQScoring {
  const missingItems = NINE_Q_ITEM_NUMBERS.filter((n) => answers[n] === undefined || answers[n] === null);
  const invalidItems = NINE_Q_ITEM_NUMBERS.filter((n) => answers[n] !== undefined && answers[n] !== null && !isNineQValue(answers[n]));
  if (missingItems.length > 0 || invalidItems.length > 0) return { ok: false, missingItems, invalidItems };
  const list = NINE_Q_ITEM_NUMBERS.map((n) => answers[n] as NineQAnswerValue);
  const totalScore = list.reduce<number>((a, b) => a + b, 0);
  return {
    ok: true,
    answers: list,
    totalScore,
    riskLevel: classifyNineQ(totalScore),
    redFlagItem9: (answers[NINE_Q_SUICIDE_ITEM] as NineQAnswerValue) > 0,
  };
}

// ───────────────────────── 8Q ─────────────────────────

export const EIGHT_Q_ITEM_COUNT = 8;

export interface EightQItem {
  n: number;
  text: string;
  /** คะแนนเมื่อตอบ "มี" */
  points: number;
  /** เฉพาะข้อ 3: คำถามต่อเมื่อตอบ "มี" — ควบคุมความคิดนั้นได้ไหม */
  followUp?: { text: string; pointsIfCannotControl: number };
}

export const EIGHT_Q_ITEMS: readonly EightQItem[] = [
  { n: 1, text: 'คิดอยากฆ่าตัวตาย หรือคิดว่าตายไปจะดีกว่า', points: 1 },
  { n: 2, text: 'อยากทำร้ายตัวเอง หรือทำให้ตัวเองบาดเจ็บ', points: 2 },
  {
    n: 3,
    text: 'คิดเกี่ยวกับการฆ่าตัวตาย (ช่วง 1 เดือนที่ผ่านมา)',
    points: 6,
    followUp: { text: 'ควบคุมความคิดนั้นได้ไหม', pointsIfCannotControl: 8 },
  },
  { n: 4, text: 'มีแผนการที่จะฆ่าตัวตาย', points: 8 },
  { n: 5, text: 'เตรียมการทำร้ายตนเอง/ฆ่าตัวตายโดยตั้งใจให้ตายจริง', points: 9 },
  { n: 6, text: 'เคยทำร้ายตนเองแต่ไม่ตั้งใจให้เสียชีวิต', points: 4 },
  { n: 7, text: 'เคยพยายามฆ่าตัวตายโดยตั้งใจให้ตาย', points: 10 },
  { n: 8, text: 'ตลอดชีวิตที่ผ่านมาเคยพยายามฆ่าตัวตาย', points: 4 },
];

export type EightQRiskLevel = 'NONE' | 'LOW' | 'MODERATE' | 'SEVERE';
export const EIGHT_Q_RISK_LABEL: Record<EightQRiskLevel, string> = {
  NONE: 'ไม่มีแนวโน้ม',
  LOW: 'น้อย',
  MODERATE: 'ปานกลาง',
  SEVERE: 'รุนแรง',
};
export const EIGHT_Q_LOW_MIN = 1;
export const EIGHT_Q_MODERATE_MIN = 9;
export const EIGHT_Q_SEVERE_MIN = 17;
export const EIGHT_Q_URGENT_MIN = 17;

export function classifyEightQ(total: number): EightQRiskLevel {
  if (total >= EIGHT_Q_SEVERE_MIN) return 'SEVERE';
  if (total >= EIGHT_Q_MODERATE_MIN) return 'MODERATE';
  if (total >= EIGHT_Q_LOW_MIN) return 'LOW';
  return 'NONE';
}

/** คำตอบ 8Q: ข้อ n → มี(true)/ไม่มี(false); ข้อ 3 ถ้า "มี" ต้องตอบ q3CanControl (true = ควบคุมได้) ด้วย */
export interface EightQAnswers {
  answers: Partial<Record<number, boolean>>;
  /** true = ควบคุมความคิดได้ (+0), false = ควบคุมไม่ได้ (+8); ไม่ใช้เมื่อข้อ 3 ตอบ "ไม่มี" */
  q3CanControl?: boolean;
}

export interface EightQResult {
  /** 8 ค่า (มี/ไม่มี) ตามลำดับข้อ */
  answers: boolean[];
  /** เฉพาะเมื่อข้อ 3 = มี: null เมื่อข้อ 3 = ไม่มี */
  q3CanControl: boolean | null;
  totalScore: number;
  riskLevel: EightQRiskLevel;
  /** ≥17 = ส่งต่อโรงพยาบาลด่วน (ธงแดงสูงสุด) */
  urgentReferral: boolean;
}

export type EightQScoring = ({ ok: true } & EightQResult) | { ok: false; missingItems: number[]; missingQ3FollowUp: boolean };

export function scoreEightQ(input: EightQAnswers): EightQScoring {
  const nums = EIGHT_Q_ITEMS.map((i) => i.n);
  const missingItems = nums.filter((n) => typeof input.answers[n] !== 'boolean');
  const q3Yes = input.answers[3] === true;
  const missingQ3FollowUp = q3Yes && typeof input.q3CanControl !== 'boolean';
  if (missingItems.length > 0 || missingQ3FollowUp) return { ok: false, missingItems, missingQ3FollowUp };

  let total = 0;
  for (const item of EIGHT_Q_ITEMS) {
    if (input.answers[item.n] === true) {
      total += item.points;
      if (item.followUp && input.q3CanControl === false) total += item.followUp.pointsIfCannotControl;
    }
  }
  return {
    ok: true,
    answers: nums.map((n) => input.answers[n] === true),
    q3CanControl: q3Yes ? (input.q3CanControl as boolean) : null,
    totalScore: total,
    riskLevel: classifyEightQ(total),
    urgentReferral: total >= EIGHT_Q_URGENT_MIN,
  };
}

// ───────────────────────── ลำดับการทำ (gate) ─────────────────────────

/** 8Q เปิดได้เมื่อ 9Q ล่าสุด รวม ≥7 (ระดับน้อยขึ้นไป) หรือมีธงแดงข้อ 9 */
export function eightQUnlocked(nineQ: { riskLevel: NineQRiskLevel; redFlagItem9: boolean } | null | undefined): boolean {
  return !!nineQ && (nineQ.riskLevel !== 'NONE' || nineQ.redFlagItem9 === true);
}

export type NineQBasisKind = '2Q' | 'GRANT';
export interface NineQBasis { kind: NineQBasisKind; id: string }

/**
 * นักเรียนทำ 9Q ได้ไหม และด้วยสิทธิ์ใด (basis) — ต้องเป็น "ฐานที่ยังไม่เคยใช้":
 *  (ก) 2Q ล่าสุดเป็นบวก (basis id = id ของ 2Q ฉบับนั้น) หรือ (ข) มีใบอนุญาต (grant) ที่ครูเปิดให้
 * ฐานหนึ่งใช้ได้ครั้งเดียว (ใช้แล้วบันทึกใน progress.usedBasisIds) — ตรงกับที่ firestore.rules บังคับ
 * ลำดับ: ใช้ grant ก่อน (ครูตั้งใจเปิด) แล้วค่อย 2Q
 */
export function pickNineQBasis(input: {
  twoQ: { id: string; isPositive: boolean } | null | undefined;
  grantIds: readonly string[];
  usedBasisIds: readonly string[];
}): NineQBasis | null {
  const used = new Set(input.usedBasisIds);
  const grant = input.grantIds.find((id) => !used.has(id));
  if (grant) return { kind: 'GRANT', id: grant };
  if (input.twoQ && input.twoQ.isPositive === true && !used.has(input.twoQ.id)) return { kind: '2Q', id: input.twoQ.id };
  return null;
}

// ───────────────────────── สิทธิ์การมองเห็น (ต้องตรงกับ firestore.rules) ─────────────────────────

export type ScreeningViewer = 'GUIDANCE_COUNSELOR' | 'HOMEROOM_TEACHER' | 'STUDENT';

export interface ScreeningCapabilities {
  read2Q: boolean;
  /** 9Q: riskLevel + ธงแดง (summary) */
  read9QSummary: boolean;
  /** 9Q: คำตอบรายข้อ + คะแนนรวม */
  read9QDetail: boolean;
  /** 8Q: คะแนน/คำตอบ */
  read8QDetail: boolean;
  /** 8Q: แค่ "มีเคสอยู่ในการดูแล ใช่/ไม่" */
  read8QCaseFlag: boolean;
  write8Q: boolean;
  openNineQ: boolean;
}

/**
 * สิทธิ์ตามตารางสเปคส่วนที่ 4 — hasActiveCounselor = มีครูแนะแนวที่ ACTIVE อยู่ในระบบ (school_settings/guidance_status)
 * ครูแนะแนว: เต็มเสมอ | ครูที่ปรึกษา(ของห้องนั้น): 9Q อ่านได้แค่ระดับ (ถ้ามีครูแนะแนว) / เต็ม (ถ้าไม่มี),
 * 8Q เขียน+อ่านเต็มได้เฉพาะเมื่อไม่มีครูแนะแนว (ถ้ามีเห็นแค่ ใช่/ไม่ ว่ามีเคส) | นักเรียน: อ่านเฉพาะ 2Q ของตัวเอง
 */
export function screeningCapabilities(viewer: ScreeningViewer, hasActiveCounselor: boolean): ScreeningCapabilities {
  if (viewer === 'GUIDANCE_COUNSELOR') {
    return { read2Q: true, read9QSummary: true, read9QDetail: true, read8QDetail: true, read8QCaseFlag: true, write8Q: true, openNineQ: true };
  }
  if (viewer === 'HOMEROOM_TEACHER') {
    const full = !hasActiveCounselor;
    return { read2Q: true, read9QSummary: true, read9QDetail: full, read8QDetail: full, read8QCaseFlag: true, write8Q: full, openNineQ: true };
  }
  return { read2Q: true, read9QSummary: false, read9QDetail: false, read8QDetail: false, read8QCaseFlag: false, write8Q: false, openNineQ: false };
}

// ───────────────────────── แจ้งผู้ปกครอง (คำเตือนเท่านั้น ไม่บังคับ ไม่ส่งอัตโนมัติ) ─────────────────────────

export type ParentNoticeMethod = 'PHONE' | 'IN_PERSON' | 'MESSAGE' | 'OTHER';
export const PARENT_NOTICE_METHOD_LABEL: Record<ParentNoticeMethod, string> = {
  PHONE: 'โทรศัพท์',
  IN_PERSON: 'พบด้วยตนเอง',
  MESSAGE: 'ข้อความ (เช่น LINE)',
  OTHER: 'อื่นๆ',
};
export type ParentNoticeScope = 'NINE_Q' | 'EIGHT_Q';

/** เหตุผลที่ควรแจ้งผู้ปกครอง: 9Q ปานกลางขึ้นไป, 8Q มีคะแนน, หรือธงแดงข้อ 9 ของ 9Q — ว่าง = ไม่มีเหตุที่ต้องเตือน */
export function parentNoticeReasons(input: {
  nineQRisk?: NineQRiskLevel | null;
  nineQRedFlag?: boolean | null;
  eightQTotal?: number | null;
}): string[] {
  const reasons: string[] = [];
  if (input.nineQRisk === 'MODERATE' || input.nineQRisk === 'SEVERE') reasons.push('9Q ระดับปานกลางขึ้นไป');
  if (input.nineQRedFlag === true) reasons.push('ธงแดงจากข้อ 9 ของ 9Q (คิดทำร้ายตนเอง)');
  if (typeof input.eightQTotal === 'number' && input.eightQTotal > 0) reasons.push('8Q มีคะแนน');
  return reasons;
}
