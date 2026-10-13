import type { AllergyRecord, ChronicIllness, SpecialCareNeed } from '../types';

/** ข้อมูลสุขภาพประจำตัว (student_health_profiles/{studentId}) — ตรรกะล้วน; rules ตรวจรูปร่าง/ขนาด ส่วนเนื้อหาตรวจที่นี่ */
export const MAX_HEALTH_ITEMS = 20;
export const MAX_TEXT = 300;

export interface HealthProfileLists {
  chronicIllnesses: ChronicIllness[];
  allergies: AllergyRecord[];
  specialCare: SpecialCareNeed[];
}

export const EMPTY_HEALTH_LISTS: HealthProfileLists = { chronicIllnesses: [], allergies: [], specialCare: [] };

export const SEVERITY_LABEL: Record<ChronicIllness['severity'], string> = { MILD: 'เล็กน้อย', MODERATE: 'ปานกลาง', SEVERE: 'รุนแรง' };
export const ALLERGY_TYPE_LABEL: Record<AllergyRecord['type'], string> = { FOOD: 'แพ้อาหาร', DRUG: 'แพ้ยา', ENVIRONMENTAL: 'แพ้สิ่งแวดล้อม' };

export function newItemId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

const t = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** คืนรายการข้อผิดพลาด (ว่าง = ใช้ได้) และไม่ยอมรับรายการว่าง/ยาวเกิน */
export function validateHealthLists(l: HealthProfileLists): string[] {
  const errs: string[] = [];
  const over = (s: string) => s.length > MAX_TEXT;
  if (l.chronicIllnesses.length > MAX_HEALTH_ITEMS || l.allergies.length > MAX_HEALTH_ITEMS || l.specialCare.length > MAX_HEALTH_ITEMS) {
    errs.push(`แต่ละหมวดบันทึกได้ไม่เกิน ${MAX_HEALTH_ITEMS} รายการ`);
  }
  l.chronicIllnesses.forEach((c, i) => {
    if (!t(c.name)) errs.push(`โรคประจำตัวรายการที่ ${i + 1}: กรอกชื่อโรค`);
    if (!['MILD', 'MODERATE', 'SEVERE'].includes(c.severity)) errs.push(`โรคประจำตัวรายการที่ ${i + 1}: เลือกระดับ`);
    if (over(t(c.name)) || over(t(c.treatmentCare))) errs.push(`โรคประจำตัวรายการที่ ${i + 1}: ข้อความยาวเกิน ${MAX_TEXT} ตัวอักษร`);
  });
  l.allergies.forEach((a, i) => {
    if (!t(a.allergen)) errs.push(`รายการแพ้ที่ ${i + 1}: กรอกสิ่งที่แพ้`);
    if (!['FOOD', 'DRUG', 'ENVIRONMENTAL'].includes(a.type)) errs.push(`รายการแพ้ที่ ${i + 1}: เลือกประเภท`);
    if (over(t(a.allergen)) || over(t(a.reaction))) errs.push(`รายการแพ้ที่ ${i + 1}: ข้อความยาวเกิน ${MAX_TEXT} ตัวอักษร`);
  });
  l.specialCare.forEach((s, i) => {
    if (!t(s.category) || !t(s.description)) errs.push(`ความต้องการพิเศษรายการที่ ${i + 1}: กรอกประเภทและรายละเอียด`);
    if (over(t(s.category)) || over(t(s.description)) || over(t(s.actionPlan))) errs.push(`ความต้องการพิเศษรายการที่ ${i + 1}: ข้อความยาวเกิน ${MAX_TEXT} ตัวอักษร`);
  });
  return errs;
}

/** ตัดช่องว่างหัวท้ายก่อนบันทึก */
export function normalizeHealthLists(l: HealthProfileLists): HealthProfileLists {
  return {
    chronicIllnesses: l.chronicIllnesses.map(c => ({ ...c, name: t(c.name), treatmentCare: t(c.treatmentCare) })),
    allergies: l.allergies.map(a => ({ ...a, allergen: t(a.allergen), reaction: t(a.reaction) })),
    specialCare: l.specialCare.map(s => ({ ...s, category: t(s.category), description: t(s.description), actionPlan: t(s.actionPlan) })),
  };
}

export type HealthVerifyStatus = 'NONE' | 'UNVERIFIED' | 'VERIFIED';
/** ไม่มีข้อมูล = NONE; มีแต่ยังไม่ผ่านพยาบาล = UNVERIFIED (ครอบครัวแก้ใหม่ทุกครั้งกลับเป็นสถานะนี้) */
export function healthVerifyStatus(profile: { verifiedAt?: unknown } | null | undefined): HealthVerifyStatus {
  if (!profile) return 'NONE';
  return profile.verifiedAt ? 'VERIFIED' : 'UNVERIFIED';
}
