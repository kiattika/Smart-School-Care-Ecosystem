import { validateThaiAddress } from './thaiAddress';
import type { FamilyHomeVisitInfo, StudentHomeVisitInfo, ParentInfo, GuardianInfo, FriendInfo,  } from '../types';

/* ───────── ตัวเลือกตามแบบ สพฐ. ───────── */
export const DISADVANTAGE_OPTIONS = [
  'ไม่ด้อยโอกาส', 'ถูกบังคับให้ขายแรงงาน', 'เด็กอยู่ในธุรกิจทางเพศ', 'เด็กถูกทอดทิ้ง', 'เด็กในสถานพินิจและคุ้มครองเด็กเยาวชน',
  'เด็กเร่ร่อน', 'ผลกระทบจากเอดส์', 'ชนกลุ่มน้อย', 'เด็กที่ถูกทำร้ายทารุณ', 'เด็กยากจน', 'เด็กที่มีปัญหาเกี่ยวกับยาเสพติด',
  'กำพร้า', 'ทำงานรับผิดชอบตนเองและครอบครัว',
];
export const DISABILITY_OPTIONS = [
  'ไม่พิการ', 'บกพร่องทางการมองเห็น', 'บกพร่องทางการได้ยิน', 'ความพิการซ้อน', 'บกพร่องทางสติปัญญา',
  'บกพร่องทางร่างกายหรือสุขภาพ', 'บกพร่องทางการเรียนรู้', 'บกพร่องทางการพูดและภาษา', 'บกพร่องทางพฤติกรรมหรืออารมณ์', 'ออทิสติก',
];
export const PERSON_HEALTH = ['ปกติ', 'พิการ', 'เจ็บป่วยเรื้อรัง', 'ทุพพลภาพ'];
export const PARENTS_STATUS = [
  'อยู่ด้วยกัน', 'แยกกันอยู่', 'หย่าร้าง', 'บิดา-มารดาเสียชีวิต/สาบสูญ', 'มารดาเสียชีวิต/สาบสูญ', 'มารดาสมรสใหม่',
  'บิดาเสียชีวิต/สาบสูญ', 'บิดาสมรสใหม่', 'บิดามารดาทอดทิ้ง', 'อื่น ๆ',
];
export const CLOSEST_FAMILY = ['บิดา', 'มารดา', 'พี่สาว', 'น้องสาว', 'พี่ชาย', 'น้องชาย', 'ผู้ปกครอง', 'อื่น ๆ'];
export const CONSULT_OPTIONS = ['บิดา', 'มารดา', 'ผู้ปกครอง', 'พี่น้อง', 'ญาติ', 'เพื่อน', 'ครู', 'เพื่อนในโลกออนไลน์', 'เก็บไว้ในใจ ไม่เล่าให้ใครฟัง', 'Hotline', 'อื่น ๆ'];
export const HOUSING_STATUS = ['บ้านของตนเอง/เจ้าของบ้าน', 'บ้านเช่า (เสียค่าเช่า)', 'อาศัยอยู่กับผู้อื่น/อยู่ฟรี', 'บ้านพัก/หอพัก', 'อื่น ๆ'];
export const HOUSE_TYPES = ['บ้านชั้นเดียว', 'บ้านสองชั้น', 'ทาวน์เฮ้าส์', 'อื่น ๆ'];
export const DEPENDENTS = ['ครัวเรือนไม่มีภาระพึ่งพิง', 'มีคนพิการ/เจ็บป่วยเรื้อรัง', 'มีผู้สูงอายุ (มากกว่า 60 ปี)', 'เป็นบิดา/มารดาเลี้ยงเดี่ยว', 'มีคนอายุ 15-60 ปีที่ว่างงาน (ไม่ใช่นักเรียน/นักศึกษา)'];
export const SAFETY_RISKS = ['สภาพทรุดโทรม/ไม่ปลอดภัย/ทำจากวัสดุท้องถิ่น (ไม้ไผ่ ใบจาก หรือวัสดุเหลือใช้)', 'ไม่มีห้องส้วมในที่อยู่อาศัยและบริเวณบ้าน', 'สภาพแวดล้อมบริเวณบ้านไม่ปลอดภัย', 'อื่น ๆ'];
export const LIVES_WITH = ['บิดาและมารดา', 'บิดา', 'มารดา', 'พี่/น้อง (ไม่ได้อยู่กับบิดา มารดา)', 'เพื่อน/คนรู้จัก', 'ผู้ปกครองที่ไม่ใช่บิดา มารดา', 'พักอยู่ที่โรงเรียน (นักเรียนประจำ)', 'พักอยู่คนเดียว (เช่าหอพัก/บ้านเช่า)', 'พักอยู่กับมูลนิธิ/วัด/นายจ้าง', 'อื่น ๆ'];
export const COMMUTE_MODES = ['เดิน', 'จักรยาน', 'รถโรงเรียน', 'จักรยานยนต์ส่วนตัว', 'รถส่วนตัว', 'เรือส่วนตัว', 'จักรยานยนต์รับจ้าง', 'รถโดยสารประจำทาง/รับจ้าง', 'เรือโดยสารประจำทาง/รับจ้าง', 'เดินทางโดยรถไฟ', 'เดินทางโดยรถไฟฟ้า', 'อื่น ๆ'];
export const DISTANCE_BRACKETS = ['0-5 กิโลเมตร', '6-10 กิโลเมตร', '11-15 กิโลเมตร', '16-20 กิโลเมตร', '21-40 กิโลเมตร', '40 กิโลเมตรขึ้นไป'];
export const COMMUTE_DURATIONS = ['น้อยกว่า 30 นาที', '30-50 นาที', '1-3 ชั่วโมง', 'มากกว่า 3 ชั่วโมง'];
export const ELECTRICITY = ['ไฟบ้านหรือมิเตอร์', 'เครื่องปั่นไฟ/โซลาเซลล์', 'ไฟต่อพ่วง/แบตเตอรี่', 'ไม่มีไฟฟ้า/ไม่มีเครื่องกำเนิดไฟฟ้าชนิดอื่น ๆ'];
export const DRINKING_WATER = ['น้ำดื่มบรรจุขวด/ตู้หยอดน้ำ', 'น้ำประปา', 'น้ำบ่อ/น้ำบาดาล', 'น้ำฝน/น้ำประปาภูเขา/ลำธาร'];
export const DISASTER_RISKS = ['ไม่มีความเสี่ยง', 'พื้นที่วาตภัย', 'พื้นที่มลพิษทางอากาศ', 'พื้นที่มลพิษทางเสียง', 'พื้นที่แผ่นดินไหว/ดินถล่ม', 'พื้นที่อุทกภัย', 'พื้นที่โรคระบาด'];
export const INCOME_BRACKETS = ['ไม่มีรายได้', 'ต่ำกว่า 5,000 บาท', '5,000-9,999 บาท', '10,000-19,999 บาท', '20,000-39,999 บาท', '40,000 บาทขึ้นไป', 'ไม่ทราบ/ไม่ประสงค์ระบุ'];
export const EDUCATION_LEVELS = ['ไม่ได้เรียน', 'ประถมศึกษา', 'มัธยมศึกษาตอนต้น', 'มัธยมศึกษาตอนปลาย/ปวช.', 'ปวส./อนุปริญญา', 'ปริญญาตรี', 'สูงกว่าปริญญาตรี'];
export const PREV_EDUCATION_LEVELS = ['อนุบาล', 'ประถมศึกษา', 'มัธยมศึกษาตอนต้น', 'มัธยมศึกษาตอนปลาย', 'อื่น ๆ'];
export const BLOOD_TYPES = ['A', 'B', 'AB', 'O', 'ไม่ทราบ'];
export const SIGNING_PURPOSE_TEXT = 'ได้มีการแจ้งวัตถุประสงค์การขอข้อมูลตามแบบเก็บข้อมูลเยี่ยมบ้านนักเรียนรายบุคคลแก่ผู้ให้ข้อมูลเรียบร้อยแล้ว';

/* ───────── ค่าเริ่มต้น ───────── */
export const emptyParent = (): ParentInfo => ({ presence: '', title: '', firstName: '', lastName: '', age: null, occupation: '', incomeBracket: '', health: '', phone: '' });
export const emptyGuardian = (): GuardianInfo => ({ relation: '', title: '', firstName: '', lastName: '', age: null, occupation: '', incomeBracket: '', health: '', phone: '', education: '', chronicDisease: '', sameAddressAsStudent: true, address: '' });
export const emptyFriend = (): FriendInfo => ({ title: '', firstName: '', lastName: '', nickname: '', classRoom: '', phone: '' });

export function emptyFamilyInfo(base: { studentId: string; studentUid?: string | null; parentUid: string; homeroomClass: string }, parentMobile = ''): FamilyHomeVisitInfo {
  return {
    ...base,
    father: emptyParent(), mother: emptyParent(), parentsStatus: '', parentsStatusOther: '',
    guardian: { ...emptyGuardian(), phone: parentMobile },
    housingStatus: '', rentPerMonth: null, housingOther: '', dependents: [], safetyLevel: '', safetyRisks: [], safetyOther: '',
    electricity: [], drinkingWater: [], disasterRisks: [], updatedAt: '',
  };
}
export function emptyStudentInfo(base: { studentId: string; studentUid: string; homeroomClass: string }): StudentHomeVisitInfo {
  return {
    ...base,
    gender: '', birthDate: '', nationality: '', ethnicity: '', religion: '',
    prevEducationLevel: '', prevGpa: '', prevSchool: '', prevAffiliation: '', prevSubdistrict: '', prevDistrict: '', prevProvince: '', prevPhone: '',
    weightKg: null, heightCm: null, bloodType: '', chronicDisease: '',
    registeredSameAsCurrent: true, registeredAddress: '', currentAddress: null,
    siblings: { onlyChild: false, birthOrder: null, totalSiblings: null, brothers: null, sisters: null, halfOlder: null, halfYounger: null, studying: null },
    closestInFamily: [], closestOther: '', consultWho: [], consultOther: '', consultHotline: '',
    livesWith: '', livesWithOther: '', commuteMode: '', commuteOther: '', commuteDuration: '',
    friendsInSchool: emptyFriend(), friendsOutside: emptyFriend(), updatedAt: '',
  };
}
/** เอกสารเก่า/ไม่ครบ → เติมค่าว่างให้ครบทุก field */
export function normalizeStudentInfo(raw: Partial<StudentHomeVisitInfo> | null | undefined, base: { studentId: string; studentUid: string; homeroomClass: string }): StudentHomeVisitInfo {
  const e = emptyStudentInfo(base);
  if (!raw) return e;
  return { ...e, ...raw, siblings: { ...e.siblings, ...raw.siblings }, friendsInSchool: { ...e.friendsInSchool, ...raw.friendsInSchool }, friendsOutside: { ...e.friendsOutside, ...raw.friendsOutside } };
}
export function normalizeFamilyInfo(raw: Partial<FamilyHomeVisitInfo> | null | undefined, base: { studentId: string; studentUid?: string | null; parentUid: string; homeroomClass: string }, parentMobile = ''): FamilyHomeVisitInfo {
  const e = emptyFamilyInfo(base, parentMobile);
  if (!raw) return e;
  return { ...e, ...raw, father: { ...e.father, ...raw.father }, mother: { ...e.mother, ...raw.mother }, guardian: { ...e.guardian, ...raw.guardian } };
}

/* ───────── ข้อมูลที่ระบบคำนวณ ───────── */
/** อายุเป็นปี/เดือน จากวันเกิด YYYY-MM-DD (null = วันเกิดไม่ถูกต้อง/อนาคต) */
export function ageFromBirthDate(birthYmd: string, todayYmd: string): { years: number; months: number } | null {
  const b = birthYmd.split('-').map(Number), t = todayYmd.split('-').map(Number);
  if (b.length !== 3 || t.length !== 3 || b.some(Number.isNaN) || t.some(Number.isNaN)) return null;
  let months = (t[0] - b[0]) * 12 + (t[1] - b[1]);
  if (t[2] < b[2]) months -= 1;
  if (months < 0) return null;
  return { years: Math.floor(months / 12), months: months % 12 };
}
/** รูปร่างจากดัชนีมวลกาย (BMI) — คำนวณอัตโนมัติจากน้ำหนัก/ส่วนสูงที่กรอก; เกณฑ์ผู้ใหญ่ทั่วไปเป็นการประมาณ ไม่ใช่เกณฑ์เด็กตามอายุ */
export function bodyShapeFromBmi(weightKg: number | null, heightCm: number | null): { bmi: number; label: string } | null {
  if (!weightKg || !heightCm || weightKg <= 0 || heightCm <= 0) return null;
  const bmi = Math.round((weightKg / Math.pow(heightCm / 100, 2)) * 10) / 10;
  const label = bmi < 18.5 ? 'น้ำหนักต่ำกว่าเกณฑ์' : bmi < 23 ? 'สมส่วน' : bmi < 25 ? 'น้ำหนักเกิน' : 'อ้วน';
  return { bmi, label };
}
/** ช่วงระยะทางตามแบบ สพฐ. ข้อ 19 จากระยะ (เมตร) */
export function distanceBracketFromMeters(m: number | null): string {
  if (m === null || !Number.isFinite(m)) return '';
  const km = m / 1000;
  if (km <= 5) return DISTANCE_BRACKETS[0];
  if (km <= 10) return DISTANCE_BRACKETS[1];
  if (km <= 15) return DISTANCE_BRACKETS[2];
  if (km <= 20) return DISTANCE_BRACKETS[3];
  if (km <= 40) return DISTANCE_BRACKETS[4];
  return DISTANCE_BRACKETS[5];
}

/* ───────── ตรวจความครบถ้วน ───────── */
const phoneOk = (p: string) => !p.trim() || /^0[0-9]{8,9}$/.test(p.replace(/[-\s]/g, ''));

/** centralAddress = ที่อยู่ในทะเบียนส่วนกลาง; ถ้ามีแล้วไม่บังคับกรอกที่อยู่แบบแยกช่อง */
export function validateStudentInfo(s: StudentHomeVisitInfo, opts: { centralAddress?: string } = {}): string[] {
  const e: string[] = [];
  if (!opts.centralAddress?.trim()) e.push(...validateThaiAddress(s.currentAddress));
  if (!s.gender) e.push('เลือกเพศ');
  if (!s.birthDate) e.push('เลือกวัน/เดือน/ปีเกิด');
  if (!s.nationality.trim()) e.push('ระบุสัญชาติ (ไม่ทราบให้ใส่ -)');
  if (!s.ethnicity.trim()) e.push('ระบุเชื้อชาติ (ไม่ทราบให้ใส่ -)');
  if (!s.religion.trim()) e.push('ระบุศาสนา (ไม่ทราบให้ใส่ -)');
  if (!s.prevEducationLevel) e.push('เลือกระดับการศึกษาที่จบ');
  if (!s.prevSchool.trim()) e.push('ระบุโรงเรียนเดิม (ไม่ทราบให้ใส่ -)');
  if (s.closestInFamily.length === 0) e.push('เลือกคนในครอบครัวที่สนิทที่สุดอย่างน้อย 1 ข้อ');
  if (s.consultWho.length === 0) e.push('เลือกคนที่ปรึกษาเมื่อทุกข์ใจอย่างน้อย 1 ข้อ');
  if (!s.livesWith) e.push('เลือกว่าพักอาศัยอยู่กับใคร');
  if (!phoneOk(s.prevPhone)) e.push('เบอร์โทรโรงเรียนเดิมไม่ถูกต้อง');
  if (!phoneOk(s.friendsInSchool.phone) || !phoneOk(s.friendsOutside.phone)) e.push('เบอร์โทรเพื่อนไม่ถูกต้อง');
  return e;
}
export function validateFamilyInfo(f: FamilyHomeVisitInfo): string[] {
  const e: string[] = [];
  for (const [label, p] of [['บิดา', f.father], ['มารดา', f.mother]] as const) {
    if (!p.presence) e.push(`เลือกสถานะ${label} (ปรากฏ/ไม่ปรากฏ/เสียชีวิต)`);
    if (p.presence === 'PRESENT') {
      if (!p.firstName.trim() || !p.lastName.trim()) e.push(`ระบุชื่อ-นามสกุล${label}`);
      if (p.age === null || p.age < 15 || p.age > 110) e.push(`ระบุอายุ${label} (15-110 ปี)`);
      if (!p.occupation.trim()) e.push(`ระบุอาชีพ${label} (ไม่ทราบให้ใส่ -)`);
      if (!p.health) e.push(`เลือกสุขภาพ${label}`);
    }
    if (!phoneOk(p.phone)) e.push(`เบอร์โทร${label}ไม่ถูกต้อง`);
  }
  if (!f.parentsStatus) e.push('เลือกสถานภาพของบิดา-มารดา');
  const g = f.guardian;
  if (!g.relation.trim()) e.push('ระบุความสัมพันธ์ของผู้ปกครองกับนักเรียน');
  if (!g.firstName.trim() || !g.lastName.trim()) e.push('ระบุชื่อ-นามสกุลผู้ปกครอง');
  if (g.age === null || g.age < 15 || g.age > 110) e.push('ระบุอายุผู้ปกครอง (15-110 ปี)');
  if (!g.occupation.trim()) e.push('ระบุอาชีพผู้ปกครอง (ไม่ทราบให้ใส่ -)');
  if (!g.sameAddressAsStudent && !g.address.trim()) e.push('ระบุที่อยู่ผู้ปกครอง');
  if (!phoneOk(g.phone)) e.push('เบอร์โทรผู้ปกครองไม่ถูกต้อง');
  if (!f.housingStatus) e.push('เลือกสถานะที่อยู่อาศัย');
  if (f.housingStatus === HOUSING_STATUS[1] && (f.rentPerMonth === null || f.rentPerMonth < 0)) e.push('ระบุค่าเช่าต่อเดือน');
  if (f.dependents.length === 0) e.push('เลือกภาระพึ่งพิงของครัวเรือน');
  if (!f.safetyLevel) e.push('เลือกความปลอดภัยของที่อยู่อาศัย');
  if (f.safetyLevel === 'RISK' && f.safetyRisks.length === 0) e.push('ระบุสิ่งที่เสี่ยงของที่อยู่อาศัย');
  if (f.electricity.length === 0) e.push('เลือกแหล่งไฟฟ้าหลัก');
  if (f.drinkingWater.length === 0) e.push('เลือกแหล่งน้ำดื่ม');
  if (f.disasterRisks.length === 0) e.push('เลือกความเสี่ยงด้านภัยพิบัติ');
  return e;
}
