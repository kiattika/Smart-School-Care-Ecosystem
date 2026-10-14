import { isValidThaiNationalId, normalizeNationalId } from './nationalId';

/** ข้อมูลโรงเรียนในส่วนหัว ปพ.6 (ตามตัวอย่างเอกสารที่โรงเรียนให้มา) */
export const SCHOOL_HEADER = {
  name: 'อุตรดิตถ์',
  affiliation: 'สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน กระทรวงศึกษาธิการ',
  subdistrict: 'ท่าอิฐ',
  district: 'เมืองอุตรดิตถ์',
  province: 'อุตรดิตถ์',
  area: 'พิษณุโลก อุตรดิตถ์',
} as const;

export const REGISTRY_VERIFY_NOTICE =
  'กรุณาตรวจสอบความถูกต้องของข้อมูลส่วนตัวด้านบน หากพบข้อผิดพลาด ให้แจ้งแก้ไขที่งานทะเบียนของโรงเรียน';

/** ข้อมูลส่วนหัว ปพ.6 ที่นักเรียนกรอก/ระบบคัดลอกจากแบบเยี่ยมบ้าน (ไม่เก็บ studentId/uid ในรูปแบบนี้) */
export interface RegistryProfile {
  nationalId: string;     // '' หรือ 13 หลักไม่มีขีด
  fatherName: string;
  motherName: string;
  enrolledAt: string;     // YYYY-MM-DD หรือ ''
  gender: 'M' | 'F' | '';
  birthDate: string;
  nationality: string;
  religion: string;
  prevSchool: string;
  prevProvince: string;
  updatedAt?: unknown;
}

export const emptyRegistryProfile = (): RegistryProfile => ({
  nationalId: '', fatherName: '', motherName: '', enrolledAt: '', gender: '', birthDate: '',
  nationality: '', religion: '', prevSchool: '', prevProvince: '',
});

export function validateRegistryInput(p: Pick<RegistryProfile, 'nationalId'>): string[] {
  const errs: string[] = [];
  if (p.nationalId.trim() && !isValidThaiNationalId(p.nationalId)) errs.push('เลขประจำตัวประชาชนไม่ถูกต้อง (ต้อง 13 หลักและผ่านการตรวจเลขหลักสุดท้าย) — ตรวจจากบัตรอีกครั้ง');
  return errs;
}

/** เตรียมเอกสารบันทึก: ตัดช่องว่าง/ขีดในเลขบัตร และตัดความยาวให้ไม่เกินที่ rules อนุญาต */
export function normalizeRegistryProfile(p: RegistryProfile): RegistryProfile {
  const cut = (v: string, n: number) => (v || '').trim().slice(0, n);
  return {
    nationalId: normalizeNationalId(p.nationalId || ''),
    fatherName: cut(p.fatherName, 120), motherName: cut(p.motherName, 120),
    enrolledAt: cut(p.enrolledAt, 10), gender: p.gender === 'M' || p.gender === 'F' ? p.gender : '',
    birthDate: cut(p.birthDate, 10), nationality: cut(p.nationality, 60), religion: cut(p.religion, 60),
    prevSchool: cut(p.prevSchool, 160), prevProvince: cut(p.prevProvince, 60),
  };
}
