import type { StudentSelfAssessment, StudentHomeVisitInfo } from '../types';
import { COMMUTE_DURATIONS } from './homeVisitData';

/**
 * ข้อมูลที่ใช้ร่วมกันระหว่าง "แบบประเมินตนเอง 30 ข้อ" กับ "แบบเก็บข้อมูลเยี่ยมบ้าน สพฐ. (ฝั่งนักเรียน)":
 * พักอาศัยกับใคร / พาหนะ / ระยะเวลาเดินทาง / ปรึกษาใคร
 * กติกา: ฟอร์มที่เปิดอยู่เติมช่องที่ "ยังว่าง" ของอีกฟอร์ม (ไม่ทับค่าที่กรอกไว้แล้ว)
 */
export interface SharedFields { livesWith: string; commuteMode: string; commuteDuration: string; consultWho: string[] }
export const emptyShared = (): SharedFields => ({ livesWith: '', commuteMode: '', commuteDuration: '', consultWho: [] });

/** ค่าที่เคยเก็บด้วยตัวเลือกรุ่นเก่าของแบบประเมินตนเอง → ตัวเลือกของ สพฐ. (เฉพาะที่ตรงกันชัดเจน) */
const LEGACY_LIVES_WITH: Record<string, string> = {
  'ปู่ ย่า ตา ยาย หรือญาติผู้ใหญ่': 'ผู้ปกครองที่ไม่ใช่บิดา มารดา',
  'หอพัก / อยู่คนเดียว': 'พักอยู่คนเดียว (เช่าหอพัก/บ้านเช่า)',
  'อื่นๆ': 'อื่น ๆ',
};
const LEGACY_COMMUTE: Record<string, string> = {
  'รถประจำทาง / รถสองแถว': 'รถโดยสารประจำทาง/รับจ้าง', 'รถจักรยานยนต์': 'จักรยานยนต์ส่วนตัว', 'ขับรถยนต์มาเอง': 'รถส่วนตัว',
  'รถสาธารณะ / รถโรงเรียน': '', 'ผู้ปกครองรับ-ส่ง': '', 'เดิน/ขี่จักรยาน': '',
};
const LEGACY_CONSULT: Record<string, string> = {
  'ผู้ปกครอง': 'ผู้ปกครอง', 'เพื่อนสนิทใน-นอกโรงเรียน': 'เพื่อน', 'คุณครู': 'ครู',
  'เก็บไว้คนเดียว/จัดการเอง': 'เก็บไว้ในใจ ไม่เล่าให้ใครฟัง', 'อื่นๆ': 'อื่น ๆ',
};

export interface LegacyHints { livesWith?: string; commuteMode?: string; commuteDuration?: string }

/** อ่านค่าร่วมจากแบบประเมินตนเอง (รองรับเอกสารรุ่นเก่า) — ค่าที่แมปไม่ได้ชัดเจนคืนใน hints ให้ผู้ใช้เลือกใหม่เอง */
export function sharedFromAssessment(a: StudentSelfAssessment | null | undefined): { shared: SharedFields; hints: LegacyHints } {
  const shared = emptyShared(); const hints: LegacyHints = {};
  const fb = a?.familyBackground;
  if (!fb) return { shared, hints };
  const lw = fb.livingWith || '';
  if (lw) {
    if (lw in LEGACY_LIVES_WITH) shared.livesWith = LEGACY_LIVES_WITH[lw];
    else if (lw === 'บิดา หรือ มารดา (ฝ่ายใดฝ่ายหนึ่ง)') hints.livesWith = lw;   // ต้องเลือกบิดา หรือ มารดา เอง
    else shared.livesWith = lw;
  }
  const tr = fb.transportation || '';
  if (tr) { if (tr in LEGACY_COMMUTE) { if (LEGACY_COMMUTE[tr]) shared.commuteMode = LEGACY_COMMUTE[tr]; else hints.commuteMode = tr; } else shared.commuteMode = tr; }
  const tt = fb.travelTime || '';
  if (tt) {
    if (tt === 'น้อยกว่า 15 นาที' || tt === '15-30 นาที') shared.commuteDuration = COMMUTE_DURATIONS[0];
    else if (tt === '31-60 นาที' || tt === 'มากกว่า 1 ชั่วโมง') hints.commuteDuration = tt;
    else shared.commuteDuration = tt;
  }
  const cp = fb.consultPerson as unknown;
  if (Array.isArray(cp)) shared.consultWho = cp.filter(Boolean) as string[];
  else if (typeof cp === 'string' && cp) shared.consultWho = [LEGACY_CONSULT[cp] ?? cp];
  return { shared, hints };
}

export const sharedFromInfo = (i: StudentHomeVisitInfo | null | undefined): SharedFields => i
  ? { livesWith: i.livesWith || '', commuteMode: i.commuteMode || '', commuteDuration: i.commuteDuration || '', consultWho: i.consultWho || [] }
  : emptyShared();

/** เติมเฉพาะช่องที่ target ยังว่างจาก source */
export function fillMissing(target: SharedFields, source: SharedFields): SharedFields {
  return {
    livesWith: target.livesWith || source.livesWith,
    commuteMode: target.commuteMode || source.commuteMode,
    commuteDuration: target.commuteDuration || source.commuteDuration,
    consultWho: target.consultWho.length ? target.consultWho : source.consultWho,
  };
}
export const sharedEqual = (a: SharedFields, b: SharedFields) =>
  a.livesWith === b.livesWith && a.commuteMode === b.commuteMode && a.commuteDuration === b.commuteDuration && a.consultWho.join('|') === b.consultWho.join('|');
