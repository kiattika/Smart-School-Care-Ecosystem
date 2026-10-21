import { PLC_STEPS, PLC_STEP_LABEL, isCycleComplete, type PlcStep } from './plc';
import { REFLECTION_FIELDS } from './reflection';

/**
 * คำแนะนำ (ไม่บังคับ ไม่มีช่วงเวลา — ทำได้ตลอดภาคเรียน) เรื่อง PLC และสะท้อนคิด
 * ตัวเลข "ควรทำกี่ครั้ง" เป็นข้อเสนอแนะเพื่อกระตุ้น ไม่ใช่เกณฑ์ที่ระบบตรวจ/ตัดสิน — แก้ได้ที่นี่ที่เดียว
 */
export const PLC_RECOMMENDED_CYCLES = 1; // อย่างน้อย 1 วงจร PDCA ต่อภาคเรียน (= พบกัน ≥ 4 ครั้ง ครั้งละ 1 ขั้น)

export const PLC_PER_MEETING_CONTENT: readonly string[] = [
  'ชื่อกลุ่ม PLC และประเด็น/ปัญหาที่ร่วมกันพัฒนา (ใช้ชื่อกลุ่ม+ประเด็นเดิมทุกครั้งเพื่อให้นับเป็นวงจรเดียวกัน)',
  'วันที่พบกัน และขั้นของวงจรในครั้งนั้น (Plan / Do / Check / Act)',
  'สมาชิกที่เข้าร่วม (เลือกจากทะเบียนบุคลากร — สมาชิกจะเห็นบันทึกในแฟ้มของตนด้วย)',
  'สรุปสิ่งที่ทำ/ประชุมในครั้งนั้น (จำเป็น)',
  'ผลที่เกิดขึ้นและสิ่งที่จะทำต่อ',
  'หลักฐาน: ลิงก์ (https) และรูปถ่ายไม่เกิน 4 รูป — ระวังไม่ให้เห็นใบหน้านักเรียนชัดเจน (PDPA)',
];

export const PLC_STEP_FOCUS: Record<PlcStep, string> = {
  PLAN: 'วิเคราะห์ปัญหา ตั้งเป้าหมาย และออกแบบแนวทาง/นวัตกรรมที่จะทดลอง',
  DO: 'นำแนวทางไปใช้จริงในชั้นเรียน (อาจมีการสังเกตการสอนร่วมกัน)',
  CHECK: 'ตรวจสอบผลที่เกิดกับผู้เรียนเทียบกับเป้าหมาย',
  ACT: 'สรุปบทเรียน ปรับปรุง และกำหนดสิ่งที่จะทำต่อในภาคเรียนถัดไป',
};

export interface PlcProgress {
  completedCycles: number;
  /** วงจรที่คืบหน้าที่สุดที่ยังไม่ครบ (null = ยังไม่มีบันทึก หรือครบแล้วทุกวงจร) */
  inProgress: { groupName: string; topic: string; missing: PlcStep[] } | null;
  /** ข้อความสถานะเทียบกับข้อเสนอแนะ */
  summary: string;
}

export function plcProgress(cycles: ReadonlyArray<{ groupName: string; topic: string; steps: readonly PlcStep[] }>): PlcProgress {
  const completedCycles = cycles.filter(c => isCycleComplete(c.steps)).length;
  const open = cycles.filter(c => !isCycleComplete(c.steps)).sort((a, b) => b.steps.length - a.steps.length)[0];
  const inProgress = open
    ? { groupName: open.groupName, topic: open.topic, missing: PLC_STEPS.filter(s => !open.steps.includes(s)) }
    : null;
  let summary: string;
  if (completedCycles >= PLC_RECOMMENDED_CYCLES) summary = `ครบ ${completedCycles} วงจรแล้ว — ครบตามข้อเสนอแนะของภาคเรียนนี้`;
  else if (inProgress) summary = `วงจร "${inProgress.groupName}" ยังขาด ${inProgress.missing.map(s => PLC_STEP_LABEL[s]).join(', ')} — ครบ ${PLC_RECOMMENDED_CYCLES} วงจรจึงตรงตามข้อเสนอแนะ`;
  else summary = `ยังไม่มีบันทึก PLC ในภาคเรียนนี้ — แนะนำให้ครบ ${PLC_RECOMMENDED_CYCLES} วงจร (พบกันอย่างน้อย ${PLC_STEPS.length} ครั้ง)`;
  return { completedCycles, inProgress, summary };
}

export const REFLECTION_RECOMMENDED_PER_TERM = 1; // 1 ฉบับต่อภาคเรียน เขียนต่อ/แก้ไขได้ตลอดภาคเรียน

export function reflectionGuideItems() {
  return REFLECTION_FIELDS.map(f => ({ label: f.label, hint: f.hint, required: f.required }));
}
