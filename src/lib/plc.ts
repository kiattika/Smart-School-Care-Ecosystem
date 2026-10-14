/**
 * บันทึก PLC (ชุมชนแห่งการเรียนรู้ทางวิชาชีพ) — plc_logs (ต้องตรง firestore.rules บล็อก "plc_logs")
 * 1 เอกสาร = 1 ครั้งที่พบกัน; จัดวงจรด้วยชื่อกลุ่ม + ประเด็น + ขั้น PDCA (ไม่มีเอกสาร "วงจร" แยก — เรียงตามวันที่ได้เอง)
 */
export type PlcStep = 'PLAN' | 'DO' | 'CHECK' | 'ACT';
export const PLC_STEPS: readonly PlcStep[] = ['PLAN', 'DO', 'CHECK', 'ACT'];
export const PLC_STEP_LABEL: Record<PlcStep, string> = {
  PLAN: 'วางแผน (Plan)', DO: 'ปฏิบัติ (Do)', CHECK: 'ตรวจสอบ (Check)', ACT: 'ปรับปรุง (Act)',
};

export interface PlcLog {
  id: string;
  semesterId: string;
  academicYear: string;
  term: '1' | '2';
  authorStaffId: string;
  authorName: string;
  departmentId: string;
  groupName: string;
  topic: string;
  meetingDate: string;
  step: PlcStep;
  members: string[];
  summary: string;
  outcome: string;
  nextAction: string;
  evidenceUrl: string;
}
export type PlcContent = Pick<PlcLog, 'groupName' | 'topic' | 'meetingDate' | 'step' | 'members' | 'summary' | 'outcome' | 'nextAction' | 'evidenceUrl'>;

export const emptyPlc = (): PlcContent => ({ groupName: '', topic: '', meetingDate: '', step: 'PLAN', members: [], summary: '', outcome: '', nextAction: '', evidenceUrl: '' });

/** ปัญหาที่ต้องแก้ก่อนบันทึก (ว่าง = บันทึกได้) — ตรงกับขอบเขตใน rules */
export function validatePlc(c: PlcContent): string[] {
  const out: string[] = [];
  if (!c.groupName.trim()) out.push('กรุณาระบุชื่อกลุ่ม PLC');
  if (c.groupName.length > 120) out.push('ชื่อกลุ่มยาวเกิน 120 ตัวอักษร');
  if (!c.topic.trim()) out.push('กรุณาระบุประเด็น/ปัญหาที่ร่วมกันพัฒนา');
  if (c.topic.length > 300) out.push('ประเด็นยาวเกิน 300 ตัวอักษร');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.meetingDate)) out.push('กรุณาเลือกวันที่พบกัน');
  if (!PLC_STEPS.includes(c.step)) out.push('กรุณาเลือกขั้นของวงจร');
  if (c.members.length > 20 || c.members.some(m => m.length > 80)) out.push('รายชื่อสมาชิกได้ไม่เกิน 20 คน (คนละไม่เกิน 80 ตัวอักษร)');
  if (!c.summary.trim()) out.push('กรุณาสรุปสิ่งที่ทำ/ประชุมในครั้งนี้');
  if (c.summary.length > 2000 || c.outcome.length > 1500 || c.nextAction.length > 1000) out.push('ข้อความยาวเกินกำหนด');
  if (c.evidenceUrl && !/^https:\/\/[^ ]{4,490}$/.test(c.evidenceUrl)) out.push('ลิงก์หลักฐานต้องขึ้นต้นด้วย https:// และไม่มีช่องว่าง');
  return out;
}

/** จัดกลุ่มเป็นวงจรตาม (ชื่อกลุ่ม + ประเด็น) เรียงวันที่เก่า→ใหม่ในวงจร, วงจรที่ล่าสุดก่อน */
export function groupPlcCycles<T extends Pick<PlcLog, 'groupName' | 'topic' | 'meetingDate' | 'step'>>(logs: readonly T[]): { key: string; groupName: string; topic: string; logs: T[]; steps: PlcStep[] }[] {
  const m = new Map<string, { key: string; groupName: string; topic: string; logs: T[] }>();
  for (const l of logs) {
    const key = `${l.groupName.trim()}||${l.topic.trim()}`;
    const g = m.get(key) || { key, groupName: l.groupName.trim(), topic: l.topic.trim(), logs: [] };
    g.logs.push(l); m.set(key, g);
  }
  return [...m.values()]
    .map(g => ({ ...g, logs: [...g.logs].sort((a, b) => a.meetingDate.localeCompare(b.meetingDate)), steps: PLC_STEPS.filter(s => g.logs.some(l => l.step === s)) }))
    .sort((a, b) => (b.logs[b.logs.length - 1].meetingDate).localeCompare(a.logs[a.logs.length - 1].meetingDate));
}
/** ครบวงจร = มีครบทั้ง 4 ขั้น PDCA */
export const isCycleComplete = (steps: readonly PlcStep[]) => PLC_STEPS.every(s => steps.includes(s));
