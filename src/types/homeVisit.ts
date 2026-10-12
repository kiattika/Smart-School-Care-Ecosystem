/**
 * ข้อมูลเยี่ยมบ้านตามแบบเก็บข้อมูลเยี่ยมบ้านนักเรียนรายบุคคลของ สพฐ. (26 ข้อ 5 ตอน) แยกตามผู้กรอก
 *  - นักเรียน  → home_visit_student_info/{studentId}   (ถาวร แก้ได้ตลอด)
 *  - ผู้ปกครอง → home_visit_family_info/{studentId}    (ถาวร แก้ได้ตลอด; เฉพาะผู้ปกครองที่ผูก parentUid กับนักเรียน)
 *  - ครู       → home_visit_records/{studentId}_{ปีการศึกษา} (ต่อปีการศึกษา)
 *  - ระบบ      → ไม่เก็บซ้ำ: ดึงจากทะเบียน/พิกัดดาวเทียม/แบบประเมินตนเองตอนแสดงผล
 * ไม่เก็บเลขบัตรประชาชน (PDPA); รายได้เก็บเป็นช่วง
 */

export type YesNoUnknown = 'YES' | 'NO' | '';

/** ผู้กรอกคือใคร — ใช้แสดงป้ายที่มาของข้อมูลในหน้าครู/เอกสารสรุป */
export type HomeVisitSource = 'SYSTEM' | 'STUDENT' | 'PARENT' | 'TEACHER';

export interface ParentInfo {
  presence: 'PRESENT' | 'ABSENT' | 'DECEASED' | '';   // ปรากฏ / ไม่ปรากฏ / เสียชีวิต
  title: string;
  firstName: string;
  lastName: string;
  age: number | null;
  occupation: string;
  incomeBracket: string;      // id จาก INCOME_BRACKETS
  health: string;             // ปกติ/พิการ/เจ็บป่วยเรื้อรัง/ทุพพลภาพ
  phone: string;
}

export interface GuardianInfo extends Omit<ParentInfo, 'presence'> {
  relation: string;           // บิดา/มารดา/อื่นๆ (ระบุ)
  education: string;
  chronicDisease: string;     // '' = ไม่มี
  sameAddressAsStudent: boolean;
  address: string;            // ใช้เมื่อไม่เหมือนที่อยู่นักเรียน
}

export interface FriendInfo {
  title: string; firstName: string; lastName: string; nickname: string;
  classRoom: string;          // เฉพาะเพื่อนในโรงเรียน
  phone: string;
}

/** ผู้ปกครองกรอก */
export interface FamilyHomeVisitInfo {
  studentId: string;
  studentUid?: string | null;
  parentUid: string;
  homeroomClass: string;
  // ข้อ 7
  father: ParentInfo;
  mother: ParentInfo;
  parentsStatus: string;
  parentsStatusOther: string;
  // ข้อ 8
  guardian: GuardianInfo;
  // ข้อ 13-16
  housingStatus: string; rentPerMonth: number | null; housingOther: string;
  dependents: string[];
  safetyLevel: 'GOOD' | 'RISK' | '';
  safetyRisks: string[]; safetyOther: string;
  // ข้อ 22-24
  electricity: string[];      // ไฟบ้าน/มิเตอร์, เครื่องปั่นไฟ/โซลาเซลล์, ไฟต่อพ่วง/แบตเตอรี่, ไม่มีไฟฟ้า
  drinkingWater: string[];
  disasterRisks: string[];
  updatedAt: string;
}

/** นักเรียนกรอก */
export interface StudentHomeVisitInfo {
  studentId: string;
  studentUid: string;
  homeroomClass: string;
  // ข้อ 1
  gender: 'M' | 'F' | '';
  birthDate: string;          // YYYY-MM-DD (อายุคำนวณจากนี้)
  nationality: string; ethnicity: string; religion: string;
  // ข้อ 2
  prevEducationLevel: string; prevGpa: string; prevSchool: string; prevAffiliation: string;
  prevSubdistrict: string; prevDistrict: string; prevProvince: string; prevPhone: string;
  prevSchoolMoeCode?: string; // รหัสโรงเรียน (เมื่อเลือกจากรายชื่อ; ว่าง = พิมพ์เอง)
  // ข้อ 3
  weightKg: number | null; heightCm: number | null; bloodType: string;
  chronicDisease: string;     // '' = ไม่มีโรคประจำตัว
  // ข้อ 4 (ที่อยู่ปัจจุบันมาจากทะเบียนระบบ)
  registeredSameAsCurrent: boolean; registeredAddress: string;
  // ที่อยู่ปัจจุบันแบบแยกช่อง — นักเรียนกรอกเมื่อทะเบียนส่วนกลาง (students.homeLocation.address) ยังไม่มีที่อยู่; null = ยังไม่กรอก
  currentAddress?: ThaiAddress | null;
  // ข้อ 9
  siblings: {
    onlyChild: boolean; birthOrder: number | null; totalSiblings: number | null;
    brothers: number | null; sisters: number | null; halfOlder: number | null; halfYounger: number | null;
    studying: number | null;
  };
  // ข้อ 10-11
  closestInFamily: string[]; closestOther: string;
  consultWho: string[]; consultOther: string; consultHotline: string;
  // ข้อ 17-18, 20 (เติมต้นทางจากแบบประเมินตนเอง ยืนยัน/แก้ได้)
  livesWith: string; livesWithOther: string;
  commuteMode: string; commuteOther: string;
  commuteDuration: string;
  // ข้อ 24
  friendsInSchool: FriendInfo;
  friendsOutside: FriendInfo;
  updatedAt: string;
}

/** ครูที่ปรึกษากรอก (ต่อปีการศึกษา) — id = `${studentId}_${visitYear}` */
export interface HomeVisitRecord {
  id: string;
  studentId: string;
  studentUid?: string | null;
  homeroomClass: string;
  visitYear: string;
  visitedDate: string;
  advisorUid: string;
  // ข้อ 25
  advisorName: string; advisorPosition: string; advisorPhone: string;
  // ข้อ 5-6
  disadvantage: string[];
  disability: string[];
  // ข้อ 12
  exteriorPhotoUrl: string; interiorPhotoUrl: string; extraPhotoUrls: string[];
  photoNote: string;          // กรณีถ่ายภายในไม่ได้/ต่างจังหวัด (ถ่ายคู่ป้ายโรงเรียน)
  // ข้อ 14, 19, 21
  houseType: string; houseTypeOther: string;
  distanceBracket: string;    // ยืนยันจากระยะทางที่ระบบคำนวณ (แก้ได้)
  travelEnvironment: 'SAFE' | 'RISK' | '';
  travelRiskNote: string;
  // ข้อ 26
  concerns: string; summary: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  urgentReferral: boolean;
  reviewedFamilyData: boolean;    // ครูตรวจข้อมูลที่นักเรียน/ผู้ปกครองกรอกแล้ว
  correctionNotes: string;        // จุดที่ครูพบว่าข้อมูลไม่ตรงความจริง
  purposeExplained: boolean;      // แจ้งวัตถุประสงค์การขอข้อมูลแก่ผู้ให้ข้อมูลแล้ว (ช่องลงนามท้ายแบบ)
  visitGps: { latitude: number; longitude: number; accuracy: number | null; distanceFromHomeM: number | null } | null;
  createdAt: string;
  updatedAt: string;
}

/** ที่อยู่แบบแยกช่อง (ตำบล/อำเภอ/จังหวัด/รหัสไปรษณีย์เลือกจากข้อมูลอ้างอิง — เก็บทั้งรหัสและชื่อ) */
export interface ThaiAddress {
  houseNo: string;       // บ้านเลขที่
  moo: string;           // หมู่ที่ (ว่างได้)
  village: string;       // ชื่อหมู่บ้าน/ชุมชน/อาคาร (ว่างได้)
  villageCode: string;   // mcode ของ DOPA เมื่อเลือกจากรายการ ('' = พิมพ์เอง/ไม่มีข้อมูล)
  soi: string;
  road: string;
  provinceCode: string; province: string;
  amphoeCode: string; amphoe: string;
  tambonCode: string; tambon: string;   // tambonCode = รหัสตำบล 6 หลัก
  postalCode: string;    // 5 หลัก
}
