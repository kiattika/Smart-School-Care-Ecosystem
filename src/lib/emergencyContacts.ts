import type { FamilyHomeVisitInfo, GuardianInfo, ParentInfo } from '../types';

/**
 * ผู้ติดต่อฉุกเฉิน — สกัดจากแบบเยี่ยมบ้านฝั่งผู้ปกครอง (home_visit_family_info) ทั้งหมดที่กรอกไว้: บิดา / มารดา / ผู้ปกครอง
 * เก็บแยกเป็น student_emergency_contacts/{studentId} เฉพาะ ชื่อ-ความสัมพันธ์-เบอร์ เพราะเอกสารเยี่ยมบ้านมีรายได้/ครัวเรือน
 * ซึ่งพยาบาลไม่มีสิทธิ์อ่าน (ห้ามเปิดสิทธิ์อ่านเอกสารเยี่ยมบ้านให้พยาบาล)
 */
export type EmergencyContactSource = 'FATHER' | 'MOTHER' | 'GUARDIAN';
export interface EmergencyContact {
  source: EmergencyContactSource;
  relation: string;
  name: string;
  phone: string;
}
export const MAX_EMERGENCY_CONTACTS = 3;

const SOURCE_LABEL: Record<EmergencyContactSource, string> = { FATHER: 'บิดา', MOTHER: 'มารดา', GUARDIAN: 'ผู้ปกครอง' };

const fullName = (p: Pick<ParentInfo, 'title' | 'firstName' | 'lastName'>) =>
  [p.title, p.firstName, p.lastName].map(s => (s || '').trim()).filter(Boolean).join(' ').replace(/^(\S+) (\S+)/, (m, t, f) => (['นาย', 'นาง', 'นางสาว', 'น.ส.'].includes(t) ? `${t}${f}` : m));
/** เก็บเฉพาะตัวเลข (เบอร์ที่กรอก "-" หรือว่าง = ไม่มีเบอร์ ใช้ติดต่อไม่ได้) */
export const phoneDigits = (s: string | null | undefined) => (s || '').replace(/\D/g, '');
export const hasUsablePhone = (s: string | null | undefined) => phoneDigits(s).length >= 9;

export function deriveEmergencyContacts(info: Pick<FamilyHomeVisitInfo, 'father' | 'mother' | 'guardian'> | null | undefined): EmergencyContact[] {
  if (!info) return [];
  const out: EmergencyContact[] = [];
  const push = (source: EmergencyContactSource, relation: string, p: Pick<ParentInfo, 'title' | 'firstName' | 'lastName' | 'phone'>) => {
    if (!hasUsablePhone(p.phone)) return;
    const phone = (p.phone || '').trim();
    // บุคคลเดียวกัน (ผู้ปกครอง = บิดา/มารดา ซึ่งระบบคัดลอกข้อมูลให้) เบอร์ซ้ำ → แสดงครั้งเดียว ใช้ความสัมพันธ์ของรายการแรก
    if (out.some(c => phoneDigits(c.phone) === phoneDigits(phone))) return;
    out.push({ source, relation, name: fullName(p).slice(0, 120), phone: phone.slice(0, 30) });
  };
  if (info.father?.presence !== 'DECEASED') push('FATHER', SOURCE_LABEL.FATHER, info.father || ({} as ParentInfo));
  if (info.mother?.presence !== 'DECEASED') push('MOTHER', SOURCE_LABEL.MOTHER, info.mother || ({} as ParentInfo));
  const g: GuardianInfo | undefined = info.guardian;
  if (g) push('GUARDIAN', (g.relation || '').trim() || SOURCE_LABEL.GUARDIAN, g);
  return out.slice(0, MAX_EMERGENCY_CONTACTS);
}

/** ผู้ปกครองที่เป็นบิดา/มารดา (ซ้ำเบอร์) → ติดป้ายว่าเป็นผู้ปกครองด้วย เพื่อให้พยาบาลรู้ว่าใครเป็นผู้ปกครองตัวจริง */
export function sameContacts(a: EmergencyContact[], b: EmergencyContact[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
