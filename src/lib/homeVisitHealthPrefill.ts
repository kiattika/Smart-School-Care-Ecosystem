import type { StudentHomeVisitInfo } from '../types';

/**
 * แบบเยี่ยมบ้านข้อ 3 ดึงจากข้อมูลสุขภาพที่มีอยู่แล้ว:
 *  - หมู่เลือดที่ล็อกไว้ (student_blood_type) ทับค่าในแบบเสมอ (เป็นข้อมูลหลัก)
 *  - น้ำหนัก/ส่วนสูงล่าสุดจากบันทึกภาคเรียน เติมเฉพาะช่องที่ยังว่าง (ไม่ทับที่นักเรียนกรอกเอง)
 * คืน object เดิมเมื่อไม่มีอะไรเปลี่ยน (กัน setState วน)
 */
export function pickHealthPrefill(
  form: StudentHomeVisitInfo,
  src: { bloodType: string | null; latest: { weight: number; height: number } | null },
): StudentHomeVisitInfo {
  let next = form;
  if (src.bloodType && form.bloodType !== src.bloodType) next = { ...next, bloodType: src.bloodType };
  if (src.latest) {
    if (form.weightKg == null && Number.isFinite(src.latest.weight)) next = { ...next, weightKg: src.latest.weight };
    if (form.heightCm == null && Number.isFinite(src.latest.height)) next = { ...next, heightCm: src.latest.height };
  }
  return next;
}
