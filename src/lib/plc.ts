/**
 * บันทึก PLC (ชุมชนแห่งการเรียนรู้ทางวิชาชีพ) — plc_logs (ต้องตรง firestore.rules บล็อก "plc_logs")
 * 1 เอกสาร = 1 ครั้งที่พบกัน; จัดวงจรด้วยชื่อกลุ่ม + ประเด็น + ขั้น PDCA (ไม่มีเอกสาร "วงจร" แยก — เรียงตามวันที่ได้เอง)
 */
import { MAX_PLC_LINKS, MAX_PLC_MEMBERS, MAX_PLC_PHOTOS, isHttpsLink, isStoragePhotoUrl } from './evidenceLinks';

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
  /** ชื่อสมาชิก (สำเนาไว้แสดงผล; เรียงคู่กับ memberStaffIds — เอกสารเก่าเป็นชื่อพิมพ์เอง ไม่มี memberStaffIds) */
  members: string[];
  /** รหัสบุคลากรของสมาชิกที่เลือกจากทะเบียน (ไม่รวมผู้บันทึก) — สมาชิกเหล่านี้เห็นบันทึกเดียวกันและนับเข้าแฟ้มของตน */
  memberStaffIds?: string[];
  summary: string;
  outcome: string;
  nextAction: string;
  evidenceUrls?: string[];
  /** ฟิลด์เดี่ยวของเอกสารเก่า — อ่านผ่าน linksOf() */
  evidenceUrl?: string;
  /** URL รูปถ่าย (Firebase Storage) ≤ 4 */
  photos?: string[];
}
export type PlcContent = Pick<PlcLog, 'groupName' | 'topic' | 'meetingDate' | 'step' | 'summary' | 'outcome' | 'nextAction'> & {
  memberStaffIds: string[]; members: string[]; evidenceUrls: string[]; photos: string[];
};

export const emptyPlc = (): PlcContent => ({ groupName: '', topic: '', meetingDate: '', step: 'PLAN', memberStaffIds: [], members: [], summary: '', outcome: '', nextAction: '', evidenceUrls: [], photos: [] });

/** ผู้ที่นับว่าเข้าร่วมบันทึกนี้: ผู้บันทึก + สมาชิกที่เลือกจากทะเบียน */
export const participantIds = (l: Pick<PlcLog, 'authorStaffId' | 'memberStaffIds'>) => [l.authorStaffId, ...(l.memberStaffIds || [])];

/** ปัญหาที่ต้องแก้ก่อนบันทึก (ว่าง = บันทึกได้) — ตรงกับขอบเขตใน rules */
export function validatePlc(c: PlcContent): string[] {
  const out: string[] = [];
  if (!c.groupName.trim()) out.push('กรุณาระบุชื่อกลุ่ม PLC');
  if (c.groupName.length > 120) out.push('ชื่อกลุ่มยาวเกิน 120 ตัวอักษร');
  if (!c.topic.trim()) out.push('กรุณาระบุประเด็น/ปัญหาที่ร่วมกันพัฒนา');
  if (c.topic.length > 300) out.push('ประเด็นยาวเกิน 300 ตัวอักษร');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.meetingDate)) out.push('กรุณาเลือกวันที่พบกัน');
  if (!PLC_STEPS.includes(c.step)) out.push('กรุณาเลือกขั้นของวงจร');
  if (c.memberStaffIds.length > MAX_PLC_MEMBERS) out.push(`สมาชิกได้ไม่เกิน ${MAX_PLC_MEMBERS} คน`);
  if (new Set(c.memberStaffIds).size !== c.memberStaffIds.length) out.push('มีสมาชิกซ้ำในรายการ');
  if (!c.summary.trim()) out.push('กรุณาสรุปสิ่งที่ทำ/ประชุมในครั้งนี้');
  if (c.summary.length > 2000 || c.outcome.length > 1500 || c.nextAction.length > 1000) out.push('ข้อความยาวเกินกำหนด');
  if (c.evidenceUrls.length > MAX_PLC_LINKS) out.push(`แนบลิงก์ได้ไม่เกิน ${MAX_PLC_LINKS} ลิงก์`);
  if (c.evidenceUrls.some(u => !isHttpsLink(u))) out.push('ลิงก์หลักฐานต้องขึ้นต้นด้วย https:// และไม่มีช่องว่าง');
  if (c.photos.length > MAX_PLC_PHOTOS) out.push(`แนบรูปได้ไม่เกิน ${MAX_PLC_PHOTOS} รูป`);
  if (c.photos.some(u => !isStoragePhotoUrl(u))) out.push('รูปถ่ายไม่ถูกต้อง');
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
