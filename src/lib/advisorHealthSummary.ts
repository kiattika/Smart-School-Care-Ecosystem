/**
 * สรุปสุขภาพนักเรียนในห้องสำหรับครูที่ปรึกษา — เฉพาะ "ที่จำเป็นต้องรู้" เพื่อดูแลในชั้นเรียน (ตรรกะล้วน ทดสอบได้)
 *  - ครูที่ปรึกษาเห็นรายละเอียดที่ครอบครัวกรอก (โรค/แพ้/ดูแลพิเศษ) ตามสิทธิ์ใน rules
 *  - ข้อความที่จะแจ้ง "ครูผู้สอนท่านอื่น" สร้างจากรายการที่ครอบครัวติ๊กอนุญาต (shareWithTeachers) เท่านั้น
 *    และแจ้งเฉพาะข้อควรระวัง (โรคประจำตัว → ไม่ระบุชื่อโรค) — ผลตรวจสายตา/การได้ยินผิดปกติรวมให้ครูเลือกเองรายคน
 *  - ไม่มีข้อมูล ≠ ไม่มีโรค: แยก "ยังไม่ได้บันทึก" ออกจาก "ไม่มีรายการ"
 */
import type { AllergyRecord, ChronicIllness, SpecialCareNeed } from '../types';

export interface StudentHealthBrief {
  studentId: string;
  name: string;
  /** อ่านข้อมูลสุขภาพไม่ได้/ยังไม่โหลด — แยกจากไม่มีเอกสาร */
  readError?: boolean;
  hasProfile: boolean;
  verified: boolean;
  chronic: ChronicIllness[];
  allergies: AllergyRecord[];
  specialCare: SpecialCareNeed[];
  bloodType?: string;
  visionAbnormal: boolean;
  hearingAbnormal: boolean;
  emergencyContactCount: number;
}

export const emptyBrief = (studentId: string, name: string): StudentHealthBrief => ({
  studentId, name, hasProfile: false, verified: false, chronic: [], allergies: [], specialCare: [],
  visionAbnormal: false, hearingAbnormal: false, emergencyContactCount: 0,
});

const t = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** มีเรื่องที่ครูที่ปรึกษาควรทราบ */
export function needsAttention(b: StudentHealthBrief): boolean {
  return b.chronic.length > 0 || b.allergies.length > 0 || b.specialCare.length > 0 || b.visionAbnormal || b.hearingAbnormal;
}

export function hasSharedItems(b: StudentHealthBrief): boolean {
  return [...b.chronic, ...b.allergies, ...b.specialCare].some(i => i.shareWithTeachers === true);
}

/** บรรทัดข้อควรระวังที่ครอบครัวอนุญาตให้แจ้งครูผู้สอน (ไม่ระบุชื่อโรค) */
export function sharedTeacherLines(b: StudentHealthBrief): string[] {
  const lines: string[] = [];
  for (const c of b.chronic) {
    if (c.shareWithTeachers !== true) continue;
    lines.push(t(c.treatmentCare) ? `ข้อจำกัดด้านสุขภาพ — ${t(c.treatmentCare)}` : 'มีข้อจำกัดด้านสุขภาพ (โปรดสอบถามครูที่ปรึกษา)');
  }
  for (const a of b.allergies) {
    if (a.shareWithTeachers !== true) continue;
    lines.push(`แพ้${t(a.allergen)}${t(a.reaction) ? ` (${t(a.reaction)})` : ''}`);
  }
  for (const s of b.specialCare) {
    if (s.shareWithTeachers !== true) continue;
    lines.push(`${t(s.category)}: ${t(s.description)}${t(s.actionPlan) ? ` — ที่ครูควรช่วย: ${t(s.actionPlan)}` : ''}`);
  }
  return lines;
}

/** คำแนะนำจัดชั้นเรียนจากผลตรวจประจำปี (ใช้เฉพาะเมื่อครูเลือกรวม) */
export function screeningLines(b: StudentHealthBrief): string[] {
  const l: string[] = [];
  if (b.visionAbnormal) l.push('สายตาผิดปกติจากผลตรวจประจำปี — ควรจัดที่นั่งใกล้กระดาน');
  if (b.hearingAbnormal) l.push('การได้ยินผิดปกติจากผลตรวจประจำปี — ควรพูดชัดเจนและหันหน้าสื่อสาร/จัดที่นั่งใกล้ครู');
  return l;
}

export function teacherNoticeLinesFor(b: StudentHealthBrief, includeScreening: boolean): string[] {
  return [...sharedTeacherLines(b), ...(includeScreening ? screeningLines(b) : [])];
}

/** ข้อความสำหรับแจ้งครูผู้สอน (คัดลอกไปส่งเอง) — รวมเฉพาะนักเรียนที่เลือกและมีข้อความอย่างน้อย 1 บรรทัด; ไม่มี = '' */
export function buildTeacherNoticeText(
  room: string,
  briefs: StudentHealthBrief[],
  include: ReadonlySet<string>,
  includeScreeningIds: ReadonlySet<string> = new Set(),
): string {
  const blocks: string[] = [];
  for (const b of briefs) {
    if (!include.has(b.studentId)) continue;
    const lines = teacherNoticeLinesFor(b, includeScreeningIds.has(b.studentId));
    if (lines.length === 0) continue;
    blocks.push(`• ${b.name}\n${lines.map(x => `   - ${x}`).join('\n')}`);
  }
  if (blocks.length === 0) return '';
  return `เรียน ครูผู้สอนห้อง ${room}\nข้อควรระวังด้านสุขภาพของนักเรียนที่ผู้ปกครองอนุญาตให้แจ้ง (โปรดใช้เพื่อการดูแลในชั้นเรียนเท่านั้น ไม่เผยแพร่ต่อ)\n\n${blocks.join('\n\n')}`;
}
