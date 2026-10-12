import type { HomeVisitRecord } from '../types';

/** ปีการศึกษา (พ.ศ.) ของวันที่ — ปีการศึกษาเริ่มพฤษภาคม: ม.ค.–เม.ย. นับเป็นปีการศึกษาก่อนหน้า */
export function academicYearBE(dateYmd: string): string {
  const [y, m] = dateYmd.split('-').map(Number);
  return String(m >= 5 ? y + 543 : y + 542);
}

export const homeVisitRecordId = (studentId: string, visitYear: string) => `${studentId}_${visitYear}`;

/** ส่วนที่ครูที่ปรึกษากรอก (ข้อ 5, 6, 12, 14, 19 ยืนยัน, 21, 25, 26) */
export type HomeVisitFormState = Omit<HomeVisitRecord, 'id' | 'studentId' | 'studentUid' | 'homeroomClass' | 'visitYear' | 'advisorUid' | 'createdAt' | 'updatedAt'>;

export function emptyHomeVisitForm(todayYmd: string, advisor: { name?: string; position?: string; phone?: string } = {}): HomeVisitFormState {
  return {
    visitedDate: todayYmd,
    advisorName: advisor.name || '', advisorPosition: advisor.position || '', advisorPhone: advisor.phone || '',
    disadvantage: [], disability: [],
    exteriorPhotoUrl: '', interiorPhotoUrl: '', extraPhotoUrls: [], photoNote: '',
    houseType: '', houseTypeOther: '', distanceBracket: '', travelEnvironment: '', travelRiskNote: '',
    concerns: '', summary: '', riskLevel: 'LOW', urgentReferral: false,
    reviewedFamilyData: false, correctionNotes: '', purposeExplained: false,
    visitGps: null,
  };
}

/** แปลงเอกสารที่เก็บไว้กลับเป็นสถานะฟอร์ม (เติมค่าที่หายไป กันเอกสารเก่า/ไม่ครบ) */
export function formFromRecord(rec: HomeVisitRecord, todayYmd: string): HomeVisitFormState {
  const base = emptyHomeVisitForm(todayYmd);
  const merged = { ...base, ...rec } as any;
  for (const k of ['id', 'studentId', 'studentUid', 'homeroomClass', 'visitYear', 'advisorUid', 'createdAt', 'updatedAt']) delete merged[k];
  // เอกสารรุ่นก่อน (ฟอร์มรุ่นแรก) เก็บ disadvantage/disability เป็นสตริง → บังคับเป็นอาร์เรย์
  if (!Array.isArray(merged.disadvantage)) merged.disadvantage = [];
  if (!Array.isArray(merged.disability)) merged.disability = merged.disability ? [String(merged.disability)] : [];
  if (!Array.isArray(merged.extraPhotoUrls)) merged.extraPhotoUrls = [];
  return merged as HomeVisitFormState;
}

/** ข้อผิดพลาดที่ต้องแก้ก่อนบันทึก (ว่าง = บันทึกได้) — ไม่เดาค่าแทนครู */
export function validateHomeVisitForm(f: HomeVisitFormState): string[] {
  const errs: string[] = [];
  if (!f.visitedDate) errs.push('เลือกวันที่เยี่ยมบ้าน');
  if (!f.advisorName.trim()) errs.push('ระบุชื่อครูที่ปรึกษา');
  if (!f.advisorPosition.trim()) errs.push('ระบุตำแหน่งครูที่ปรึกษา');
  if (f.advisorPhone.trim() && !/^0[0-9]{8,9}$/.test(f.advisorPhone.replace(/[-\s]/g, ''))) errs.push('เบอร์โทรครูไม่ถูกต้อง');
  if (f.disadvantage.length === 0) errs.push('เลือกประเภทความด้อยโอกาส (ไม่มีให้เลือก "ไม่ด้อยโอกาส")');
  if (f.disability.length === 0) errs.push('เลือกประเภทความพิการ (ไม่มีให้เลือก "ไม่พิการ")');
  if (!f.exteriorPhotoUrl && !f.photoNote.trim()) errs.push('แนบรูปที่ 1 ภาพภายนอกที่พักอาศัย หรือระบุเหตุผลที่ถ่ายไม่ได้');
  if (!f.houseType) errs.push('เลือกลักษณะกายภาพของบ้าน');
  if (!f.travelEnvironment) errs.push('เลือกสภาพแวดล้อมระหว่างการเดินทาง');
  if (f.travelEnvironment === 'RISK' && !f.travelRiskNote.trim()) errs.push('ระบุความเสี่ยงระหว่างการเดินทาง');
  if (!f.concerns.trim()) errs.push('กรอกสภาพที่น่าเป็นห่วงและความต้องการจำเป็น (ไม่มีให้ใส่ -)');
  if (!f.summary.trim()) errs.push('กรอกข้อสรุปจากการเยี่ยมบ้าน');
  if (!f.reviewedFamilyData) errs.push('ติ๊กยืนยันว่าตรวจข้อมูลที่นักเรียน/ผู้ปกครองกรอกแล้ว');
  if (!f.purposeExplained) errs.push('ติ๊กยืนยันว่าแจ้งวัตถุประสงค์การขอข้อมูลแก่ผู้ให้ข้อมูลแล้ว');
  return errs;
}

export function buildHomeVisitRecord(args: {
  form: HomeVisitFormState; studentId: string; studentUid?: string | null; homeroomClass: string;
  advisorUid: string; existing?: HomeVisitRecord | null; nowIso: string;
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
    createdAt: args.existing?.createdAt || args.nowIso,
    updatedAt: args.nowIso,
  };
}

/** ฉบับของปีการศึกษาปัจจุบัน (จากรายการทั้งห้อง) */
export function currentYearRecords(records: HomeVisitRecord[], todayYmd: string): Map<string, HomeVisitRecord> {
  const y = academicYearBE(todayYmd);
  return new Map(records.filter(r => r.visitYear === y).map(r => [r.studentId, r]));
}
