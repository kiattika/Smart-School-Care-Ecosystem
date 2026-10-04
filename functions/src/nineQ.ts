/**
 * 9Q (แบบประเมินภาวะซึมเศร้าฉบับไทย) ฝั่งเซิร์ฟเวอร์ — ตรรกะล้วน (ไม่แตะ Firebase) ทดสอบได้: src/__tests__/nineQServer.test.ts
 *
 * ทำไมคำนวณที่นี่: ผล 9Q (riskLevel/ธงแดงข้อ 9) เดิมนักเรียนเป็นคนคำนวณฝั่ง client แล้วส่งเข้า Firestore ตรงๆ — firestore.rules
 * ตรวจได้แค่ชนิดข้อมูล ไม่ตรวจว่าตรงกับคำตอบ (นักเรียนที่ตั้งใจจะลดระดับ/ซ่อนธงแดงของตัวเองได้) ตอนนี้ client ส่งได้แค่ "คำตอบดิบ 9 ข้อ"
 * ผ่าน callable submitNineQ แล้วเซิร์ฟเวอร์คำนวณเอง + ตรวจสิทธิ์/เงื่อนไขเอง; firestore.rules ห้าม client เขียน 9Q ตรงทั้งหมด
 *
 * ต้องให้ผลเหมือน src/lib/depressionScreening.ts ทุกตัวอักษร (functions import โค้ดจาก src/ ไม่ได้) — มี test เทียบสองฝั่ง
 * เกณฑ์ 9Q (คู่มือกรมสุขภาพจิต/สพฐ.): <7 ไม่มีอาการ/น้อยมาก, 7-12 น้อย, 13-18 ปานกลาง, ≥19 รุนแรง; ธงแดง = ข้อ 9 > 0 (แยกจากคะแนนรวม)
 */

export type NineQRiskLevel = 'NONE' | 'MILD' | 'MODERATE' | 'SEVERE';
export const NINE_Q_ITEM_COUNT = 9;

export function classifyNineQ(total: number): NineQRiskLevel {
  if (total >= 19) return 'SEVERE';
  if (total >= 13) return 'MODERATE';
  if (total >= 7) return 'MILD';
  return 'NONE';
}

export interface NineQScore {
  answers: number[];
  totalScore: number;
  riskLevel: NineQRiskLevel;
  redFlagItem9: boolean;
}

/** คำตอบดิบ 9 ข้อ (จำนวนเต็ม 0-3 ครบทุกข้อ) → คะแนน; ไม่ครบ/ผิดรูปแบบ = null (ไม่คำนวณครึ่งๆ กลางๆ) */
export function scoreNineQAnswers(raw: unknown): NineQScore | null {
  if (!Array.isArray(raw) || raw.length !== NINE_Q_ITEM_COUNT) return null;
  if (!raw.every((v) => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 3)) return null;
  const answers = raw as number[];
  const totalScore = answers.reduce((a, b) => a + b, 0);
  return { answers: [...answers], totalScore, riskLevel: classifyNineQ(totalScore), redFlagItem9: answers[8] > 0 };
}

export interface NineQRequest { studentId: string; answers: number[] }

/** ตรวจ input ของ callable — ไม่รับ riskLevel/ธงแดง/คะแนนจาก client (ถ้าส่งมาก็ไม่ถูกใช้) */
export function parseNineQRequest(data: unknown): { ok: true; value: NineQRequest } | { ok: false; message: string } {
  const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const studentId = typeof d.studentId === 'string' ? d.studentId.trim() : '';
  if (!studentId || studentId.includes('/')) return { ok: false, message: 'ต้องระบุ studentId' };
  const scored = scoreNineQAnswers(d.answers);
  if (!scored) return { ok: false, message: 'ต้องส่งคำตอบ 9 ข้อ (จำนวนเต็ม 0-3 ครบทุกข้อ)' };
  return { ok: true, value: { studentId, answers: scored.answers } };
}

// ───────── ใครส่งได้ ─────────

export type NineQCaller =
  | { kind: 'STUDENT' }
  | { kind: 'STAFF'; role: 'SUPER_ADMIN' | 'GUIDANCE_COUNSELOR' | 'HOMEROOM_TEACHER' };

/**
 * ผู้เรียกเป็นใคร (null = ไม่มีสิทธิ์):
 *  - ครูแนะแนว / SUPER_ADMIN → STAFF (กรอกแทนนักเรียนได้เสมอ)
 *  - ครูที่ปรึกษาของห้องนั้น → STAFF เฉพาะเมื่อไม่มีครูแนะแนวที่ใช้งานอยู่ (hasActiveCounselor=false); มีครูแนะแนวอยู่ = ทำได้แค่เปิดใบอนุญาต
 *  - นักเรียนเจ้าของเอง (uid ตรงกับ students/{id}.studentUid และมี role STUDENT) → STUDENT (ต้องผ่านเงื่อนไขฐาน 2Q บวก/ใบอนุญาต)
 */
export function decideNineQCaller(input: {
  uid: string;
  roles: readonly string[];
  studentUid: string | null;
  studentRoom: string | null;
  callerHomeroomClass: string | null;
  hasActiveCounselor: boolean;
}): NineQCaller | null {
  const { uid, roles } = input;
  if (roles.includes('SUPER_ADMIN')) return { kind: 'STAFF', role: 'SUPER_ADMIN' };
  if (roles.includes('GUIDANCE_COUNSELOR')) return { kind: 'STAFF', role: 'GUIDANCE_COUNSELOR' };
  if (
    roles.includes('HOMEROOM_TEACHER') &&
    !input.hasActiveCounselor &&
    !!input.callerHomeroomClass &&
    input.studentRoom === input.callerHomeroomClass
  ) {
    return { kind: 'STAFF', role: 'HOMEROOM_TEACHER' };
  }
  if (roles.includes('STUDENT') && !!input.studentUid && input.studentUid === uid) return { kind: 'STUDENT' };
  return null;
}

// ───────── ฐานที่นักเรียนใช้ทำ 9Q ─────────

export interface NineQBasis { kind: '2Q' | 'GRANT'; id: string }

/**
 * ฐานที่ใช้ได้ตอนนี้ (ยังไม่เคยใช้): ใบอนุญาตที่ครูเปิดให้ก่อน แล้วค่อย 2Q ล่าสุดที่เป็นบวก — เซิร์ฟเวอร์เลือกเอง ไม่เชื่อฐานที่ client อ้าง
 * (ตรงกับ pickNineQBasis ใน src/lib/depressionScreening.ts)
 */
export function pickNineQBasis(input: {
  twoQ: { id?: unknown; isPositive?: unknown } | null;
  grantIds: readonly string[];
  usedBasisIds: unknown;
}): NineQBasis | null {
  const used = new Set(Array.isArray(input.usedBasisIds) ? (input.usedBasisIds as unknown[]).filter((x): x is string => typeof x === 'string') : []);
  const grant = input.grantIds.find((id) => !used.has(id));
  if (grant) return { kind: 'GRANT', id: grant };
  const twoQId = input.twoQ && typeof input.twoQ.id === 'string' ? input.twoQ.id : '';
  if (input.twoQ && input.twoQ.isPositive === true && twoQId && !used.has(twoQId)) return { kind: '2Q', id: twoQId };
  return null;
}

// ───────── เอกสารที่เขียน ─────────

/** วันที่ (yyyy-MM-dd) ตามเวลาไทย (UTC+7) — ไม่พึ่ง timezone ของเครื่อง function */
export function bangkokDate(now: Date): string {
  return new Date(now.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

export interface NineQDocsInput {
  studentId: string;
  studentUid: string;
  recordedByUid: string;
  score: NineQScore;
  basisKind: '2Q' | 'GRANT' | 'STAFF';
  basisId: string;
  respondentKind: 'STUDENT' | 'STAFF';
  conductedAt: string;
  id: string;
}

export function buildNineQDocs(i: NineQDocsInput): { summary: Record<string, unknown>; detail: Record<string, unknown> } {
  const common = {
    id: i.id,
    studentId: i.studentId,
    studentUid: i.studentUid,
    conductedAt: i.conductedAt,
    basisKind: i.basisKind,
    basisId: i.basisId,
    recordedByUid: i.recordedByUid,
  };
  return {
    // สรุป: ระดับ + ธงแดงเท่านั้น (ครูที่ปรึกษาอ่านได้เสมอ) ไม่มีคะแนน/คำตอบ
    summary: { ...common, riskLevel: i.score.riskLevel, redFlagItem9: i.score.redFlagItem9, respondentKind: i.respondentKind },
    // รายละเอียด: คำตอบรายข้อ + คะแนนรวม (ครูแนะแนวเสมอ; ครูที่ปรึกษาเมื่อไม่มีครูแนะแนว)
    detail: { ...common, answers: i.score.answers, totalScore: i.score.totalScore },
  };
}
