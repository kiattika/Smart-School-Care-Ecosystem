import type { HomeVisitPerson, HomeVisitRecord } from '../types';

/** ปีการศึกษา (พ.ศ.) ของวันที่ — ปีการศึกษาเริ่มพฤษภาคม: ม.ค.–เม.ย. นับเป็นปีการศึกษาก่อนหน้า */
export function academicYearBE(dateYmd: string): string {
  const [y, m] = dateYmd.split('-').map(Number);
  return String(m >= 5 ? y + 543 : y + 542);
}

export const homeVisitRecordId = (studentId: string, visitYear: string) => `${studentId}_${visitYear}`;

export const DISADVANTAGE_OPTIONS = [
  'ครอบครัวยากจน', 'อยู่กับผู้ปกครองที่ไม่ใช่บิดามารดา', 'บิดา/มารดาเสียชีวิต', 'บิดามารดาแยกกันอยู่/หย่าร้าง',
  'ทำงานช่วยครอบครัว/หารายได้', 'อยู่ไกลโรงเรียนมาก', 'ผู้ปกครองมีภาระหนี้สิน', 'ไม่มีข้อจำกัด',
];
export const HOUSING_TYPES = ['บ้านถาวร (เป็นเจ้าของ)', 'บ้านเช่า', 'อาศัยอยู่กับญาติ/ผู้อื่น', 'ที่พักชั่วคราว/ไม่มั่นคง'];
export const COMMUTE_MODES = ['เดิน', 'จักรยาน', 'จักรยานยนต์', 'ผู้ปกครองรับ-ส่ง', 'รถรับส่งนักเรียน', 'รถโดยสารประจำทาง', 'อื่น ๆ'];
export const DISASTER_RISKS = ['น้ำท่วม', 'ดินโคลนถล่ม', 'ไฟไหม้', 'ไม่พบความเสี่ยง'];
export const HOUSEHOLD_STATUS = ['อยู่กับบิดามารดา', 'อยู่กับบิดาหรือมารดาเพียงคนเดียว', 'อยู่กับญาติ', 'อยู่หอพัก/บ้านเช่าลำพัง', 'อื่น ๆ'];
export const SOCIAL_BEHAVIORS = [
  'เข้ากับเพื่อนได้ดี', 'ชอบอยู่คนเดียว', 'มีเพื่อนสนิทที่ส่งผลดี', 'คบเพื่อนที่เสี่ยงต่อพฤติกรรมไม่เหมาะสม',
  'ใช้เวลากับเกม/โซเชียลมาก', 'ช่วยงานบ้านเป็นประจำ', 'มีกิจกรรมสร้างสรรค์/งานอดิเรก',
];
export const PERSON_STATUS = ['อยู่ร่วมกัน', 'แยกกันอยู่', 'หย่าร้าง', 'เสียชีวิต', 'ไม่ทราบ'];

const emptyPerson = (relation: string): HomeVisitPerson => ({ name: '', relation, occupation: '', phone: '', status: '' });

export type HomeVisitFormState = Omit<HomeVisitRecord, 'id' | 'studentId' | 'studentUid' | 'homeroomClass' | 'visitYear' | 'advisorUid' | 'advisorName' | 'createdAt' | 'updatedAt'>;

export function emptyHomeVisitForm(todayYmd: string): HomeVisitFormState {
  return {
    visitedDate: todayYmd,
    disadvantage: [], disability: '',
    father: emptyPerson('บิดา'), mother: emptyPerson('มารดา'), guardian: emptyPerson('ผู้ปกครอง'),
    siblingsCount: null, closeAdults: '', photoUrls: [],
    householdStatus: '', housingType: '', householdMembers: null, dependents: null,
    commuteMode: '', commuteMinutes: null, commuteDistanceKm: null,
    hasElectricity: true, hasWater: true, disasterRisks: [], environmentRating: 3,
    closeFriends: '', socialBehaviors: [], socialNotes: '',
    teacherOpinion: '', recommendations: '', riskLevel: 'LOW', urgentReferral: false,
    visitGps: null,
  };
}

/** แปลงเอกสารที่เก็บไว้กลับเป็นสถานะฟอร์ม (เติมค่าที่หายไปด้วยค่าว่าง กันเอกสารเก่า/ไม่ครบ) */
export function formFromRecord(rec: HomeVisitRecord, todayYmd: string): HomeVisitFormState {
  const base = emptyHomeVisitForm(todayYmd);
  return {
    ...base,
    ...rec,
    father: { ...base.father, ...rec.father },
    mother: { ...base.mother, ...rec.mother },
    guardian: { ...base.guardian, ...rec.guardian },
  };
}

/** ข้อผิดพลาดที่ต้องแก้ก่อนบันทึก (ว่าง = บันทึกได้) — ไม่เดาค่าแทนครู */
export function validateHomeVisitForm(f: HomeVisitFormState): string[] {
  const errs: string[] = [];
  if (!f.visitedDate) errs.push('เลือกวันที่เยี่ยมบ้าน');
  if (!f.guardian.name.trim() && !f.father.name.trim() && !f.mother.name.trim()) errs.push('ระบุชื่อบิดา มารดา หรือผู้ปกครองอย่างน้อย 1 คน');
  if (!f.housingType) errs.push('เลือกลักษณะที่อยู่อาศัย');
  if (!f.commuteMode) errs.push('เลือกวิธีเดินทางไปโรงเรียน');
  if (!f.teacherOpinion.trim()) errs.push('กรอกความคิดเห็น/ข้อสรุปของครูที่ปรึกษา');
  for (const [label, p] of [['บิดา', f.father], ['มารดา', f.mother], ['ผู้ปกครอง', f.guardian]] as const) {
    if (p.phone.trim() && !/^0[0-9]{8,9}$/.test(p.phone.replace(/[-\s]/g, ''))) errs.push(`เบอร์โทร${label}ไม่ถูกต้อง`);
  }
  return errs;
}

export function buildHomeVisitRecord(args: {
  form: HomeVisitFormState; studentId: string; studentUid?: string | null; homeroomClass: string;
  advisorUid: string; advisorName: string; existing?: HomeVisitRecord | null; nowIso: string;
}): HomeVisitRecord {
  const visitYear = academicYearBE(args.form.visitedDate);
  return {
    ...args.form,
    id: homeVisitRecordId(args.studentId, visitYear),
    studentId: args.studentId,
    studentUid: args.studentUid ?? null,
    homeroomClass: args.homeroomClass,
    visitYear,
    advisorUid: args.advisorUid,
    advisorName: args.advisorName,
    createdAt: args.existing?.createdAt || args.nowIso,
    updatedAt: args.nowIso,
  };
}

/** ฉบับของปีการศึกษาปัจจุบัน (จากรายการทั้งห้อง) */
export function currentYearRecords(records: HomeVisitRecord[], todayYmd: string): Map<string, HomeVisitRecord> {
  const y = academicYearBE(todayYmd);
  return new Map(records.filter(r => r.visitYear === y).map(r => [r.studentId, r]));
}
