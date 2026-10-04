import { SDQ_SUBSCALES, SdqEvaluatorType, SdqScores, SdqSubscaleKey } from './sdq';

/**
 * SDQ ส่วนที่ 1 — แบบสอบถาม 25 ข้อ → คะแนนรายด้าน 5 ด้าน (0-10 ต่อด้าน) — pure ทดสอบได้: src/__tests__/sdqQuestionnaire.test.ts
 *
 * ผู้ตอบเลือกทีละข้อ (ไม่จริง / ค่อนข้างจริง / จริง) แล้วระบบบวกคะแนนแต่ละด้านให้ — ผลที่ได้ (SdqScores) ส่งต่อให้
 * src/lib/sdq.ts แปลผลตามเกณฑ์เหมือนเดิม (ที่นั่นไม่รู้ว่าตัวเลขมาจากการพิมพ์เองหรือบวกจากคำตอบ)
 *
 * เลขข้อ = ลำดับในแบบฟอร์มทางการ (แสดงกำกับทุกข้อ) แมปข้อ → ด้านและข้อกลับทางเหมือนกันทุกฉบับ
 * ระบบเก็บเฉพาะคะแนนรายด้าน ไม่เก็บคำตอบรายข้อ (ข้อมูลเก่าที่กรอกเป็นตัวเลขรายด้านยังแสดงผลได้ตามปกติ)
 *
 * ⚠ ฉบับครู (TEACHER) ใช้ข้อความเดียวกับฉบับผู้ปกครอง (PARENT) "ไปก่อน" — ผู้ใช้ต้องตรวจซ้ำกับแบบฟอร์มฉบับครูตัวจริง
 *    ของกรมสุขภาพจิต/สพฐ. แล้วแก้ที่ SDQ_ITEM_TEXT.TEACHER (ที่เดียว) ถ้าถ้อยคำต่างกัน
 */

export const SDQ_ITEM_COUNT = 25;

/** ข้อ → ด้าน (เลขข้อตามแบบฟอร์มทางการ) */
export const SDQ_DOMAIN_ITEMS: Record<SdqSubscaleKey, readonly number[]> = {
  emotional: [3, 8, 13, 16, 24],
  conduct: [5, 7, 12, 18, 22],
  hyperactivity: [2, 10, 15, 21, 25],
  peerProblems: [6, 11, 14, 19, 23],
  prosocial: [1, 4, 9, 17, 20],
};

/** ข้อที่คะแนนกลับทาง (จริง=0, ค่อนข้างจริง=1, ไม่จริง=2) — เหมือนกันทุกฉบับ */
export const SDQ_REVERSE_ITEMS: readonly number[] = [7, 11, 14, 21, 25];

/** ค่าคำตอบดิบต่อข้อ ก่อนกลับทาง: ไม่จริง=0, ค่อนข้างจริง=1, จริง=2 */
export type SdqAnswerValue = 0 | 1 | 2;
export const SDQ_ANSWER_OPTIONS: ReadonlyArray<{ value: SdqAnswerValue; label: string }> = [
  { value: 0, label: 'ไม่จริง' },
  { value: 1, label: 'ค่อนข้างจริง' },
  { value: 2, label: 'จริง' },
];

/** คำตอบทั้งชุด: เลขข้อ (1-25) → ค่าดิบ; ข้อที่ยังไม่ตอบ = ไม่มี key */
export type SdqAnswers = Partial<Record<number, SdqAnswerValue>>;

// ── ข้อความคำถาม (ดัชนี 0 = ข้อ 1) ──

const STUDENT_TEXT: readonly string[] = [
  'ฉันพยายามทำตัวดีกับคนอื่น ฉันใส่ใจความรู้สึกของคนอื่น',
  'ฉันอยู่ไม่นิ่ง ฉันนั่งนิ่งๆ ไม่ได้',
  'ฉันปวดศีรษะ ปวดท้อง หรือไม่สบายบ่อยๆ',
  'ฉันเต็มใจแบ่งปันสิ่งของให้เพื่อน (ขนม, ของเล่น, ดินสอ เป็นต้น)',
  'ฉันโกรธแรง และมักอารมณ์เสีย',
  'ฉันชอบอยู่กับตัวเอง ฉันชอบเล่นคนเดียวหรืออยู่ตามลำพัง',
  'ฉันมักทำตามที่คนอื่นบอก',
  'ฉันขี้กังวล',
  'ใครๆ ก็พึ่งฉันได้ ถ้าเขาเสียใจ อารมณ์ไม่ดี หรือไม่สบายใจ',
  'ฉันอยู่ไม่สุข วุ่นวาย',
  'ฉันมีเพื่อนสนิท',
  'ฉันมีเรื่องทะเลาะวิวาทบ่อย ฉันทำให้คนอื่นทำอย่างที่ฉันต้องการได้',
  'ฉันไม่มีความสุข ท้อแท้ ร้องไห้บ่อยๆ',
  'เพื่อนๆ ส่วนมากชอบฉัน',
  'ฉันวอกแวกง่าย ฉันรู้สึกว่าไม่มีสมาธิ',
  'ฉันกังวลเวลาอยู่ในสถานการณ์ที่ไม่คุ้น และเสียความมั่นใจในตนเองง่าย',
  'ฉันใจดีกับเด็กที่เล็กกว่า',
  'มีคนว่าฉันโกหก หรือขี้โกงบ่อยๆ',
  'เด็กๆ คนอื่นล้อเลียน หรือรังแกฉัน',
  'ฉันมักจะอาสาช่วยเหลือผู้อื่น (พ่อแม่, ครู, เพื่อน, เด็กคนอื่นๆ เป็นต้น)',
  'ฉันคิดก่อนทำ',
  'ฉันเอาของคนอื่นในบ้าน ที่โรงเรียนหรือที่อื่น',
  'ฉันเข้ากับผู้ใหญ่ได้ดีกว่ากับเด็กในวัยเดียวกัน',
  'ฉันขี้กลัว รู้สึกหวาดกลัวได้ง่าย',
  'ฉันทำงานได้จนเสร็จ ความตั้งใจในการทำงานของฉันดี',
];

const PARENT_TEXT: readonly string[] = [
  'ห่วงใยความรู้สึกคนอื่น',
  'อยู่ไม่นิ่ง นั่งนิ่งๆ ไม่ได้',
  'มักจะบ่นว่าปวดศีรษะ ปวดท้อง',
  'เต็มใจแบ่งปันสิ่งของให้เพื่อน (ขนม, ของเล่น, ดินสอ เป็นต้น)',
  'มักจะอาละวาด หรือโมโหร้าย',
  'ค่อนข้างแยกตัว ชอบเล่นคนเดียว',
  'เชื่อฟัง มักจะทำตามที่ผู้ใหญ่ต้องการ',
  'กังวลใจหลายเรื่อง ดูกังวลเสมอ',
  'เป็นที่พึ่งได้เวลาที่คนอื่นเสียใจ อารมณ์ไม่ดีหรือไม่สบายใจ',
  'อยู่ไม่สุข วุ่นวายอย่างมาก',
  'มีเพื่อนสนิท',
  'มักจะมีเรื่องทะเลาะวิวาทกับเด็กอื่น หรือรังแกเด็กอื่น',
  'ดูไม่มีความสุข ท้อแท้',
  'เป็นที่ชื่นชอบของเพื่อน',
  'วอกแวกง่าย สมาธิสั้น',
  'เครียดไม่ยอมห่างเวลาอยู่ในสถานการณ์ที่ไม่คุ้นและขาดความมั่นใจในตนเอง',
  'ใจดีกับเด็กที่เล็กกว่า',
  'ชอบโกหก หรือขี้โกง',
  'ถูกเด็กคนอื่นล้อเลียน หรือรังแก',
  'ชอบอาสาช่วยเหลือผู้อื่น (พ่อแม่, ครู, เพื่อน, เด็กคนอื่นๆ เป็นต้น)',
  'คิดก่อนทำ',
  'ขโมยของที่บ้าน ที่โรงเรียนหรือที่อื่น',
  'เข้ากับผู้ใหญ่ได้ดีกว่ากับเด็กวัยเดียวกัน',
  'ขี้กลัว รู้สึกหวาดกลัวได้ง่าย',
  'ทำงานได้จนเสร็จ มีความตั้งใจในการทำงาน',
];

/**
 * ข้อความแยกตามฉบับ — TEACHER ใช้ชุดเดียวกับ PARENT ไปก่อน (ดู ⚠ ที่หัวไฟล์: ต้องตรวจกับฉบับครูตัวจริง)
 */
export const SDQ_ITEM_TEXT: Record<SdqEvaluatorType, readonly string[]> = {
  STUDENT: STUDENT_TEXT,
  PARENT: PARENT_TEXT,
  TEACHER: PARENT_TEXT,
};

/** ฉบับที่ข้อความยังเป็นของฉบับอื่นชั่วคราว (ให้ UI แสดงหมายเหตุ/ให้ผู้ใช้ตรวจซ้ำ) */
export const SDQ_PROVISIONAL_TEXT_EVALUATORS: readonly SdqEvaluatorType[] = ['TEACHER'];

export const SDQ_ITEM_NUMBERS: readonly number[] = Array.from({ length: SDQ_ITEM_COUNT }, (_, i) => i + 1);

export const sdqItemText = (evaluatorType: SdqEvaluatorType, item: number): string => SDQ_ITEM_TEXT[evaluatorType][item - 1];

const ITEM_DOMAIN: Record<number, SdqSubscaleKey> = (() => {
  const map: Record<number, SdqSubscaleKey> = {};
  for (const { key } of SDQ_SUBSCALES) for (const n of SDQ_DOMAIN_ITEMS[key]) map[n] = key;
  return map;
})();
export const sdqItemDomain = (item: number): SdqSubscaleKey => ITEM_DOMAIN[item];
export const isReverseItem = (item: number): boolean => SDQ_REVERSE_ITEMS.includes(item);

/** คะแนนของข้อหลังกลับทางแล้ว (ข้อกลับทาง: จริง=0, ค่อนข้างจริง=1, ไม่จริง=2) */
export function sdqItemScore(item: number, raw: SdqAnswerValue): 0 | 1 | 2 {
  return (isReverseItem(item) ? 2 - raw : raw) as 0 | 1 | 2;
}

export type SdqScoringResult =
  | { ok: true; scores: SdqScores }
  | { ok: false; missingItems: number[]; invalidItems: number[] };

/** ข้อที่ยังไม่ได้ตอบ (เรียงตามเลขข้อ) */
export function missingSdqItems(answers: SdqAnswers): number[] {
  return SDQ_ITEM_NUMBERS.filter((n) => answers[n] === undefined || answers[n] === null);
}

export const answeredSdqCount = (answers: SdqAnswers): number => SDQ_ITEM_COUNT - missingSdqItems(answers).length;

/**
 * คำตอบ 25 ข้อ → คะแนน 5 ด้าน (0-10 ต่อด้าน)
 * ต้องตอบครบทั้ง 25 ข้อและทุกค่าเป็น 0/1/2 — ไม่ครบ/ค่าผิดปกติ = error (ไม่คำนวณครึ่งๆ กลางๆ ไม่ปล่อยให้ข้อว่างนับเป็น 0)
 */
export function scoreSdqAnswers(answers: SdqAnswers): SdqScoringResult {
  const missingItems = missingSdqItems(answers);
  const invalidItems = SDQ_ITEM_NUMBERS.filter((n) => {
    const v = answers[n];
    return v !== undefined && v !== null && v !== 0 && v !== 1 && v !== 2;
  });
  if (missingItems.length > 0 || invalidItems.length > 0) return { ok: false, missingItems, invalidItems };

  const scores: SdqScores = { emotional: 0, conduct: 0, hyperactivity: 0, peerProblems: 0, prosocial: 0 };
  for (const n of SDQ_ITEM_NUMBERS) scores[ITEM_DOMAIN[n]] += sdqItemScore(n, answers[n] as SdqAnswerValue);
  return { ok: true, scores };
}
