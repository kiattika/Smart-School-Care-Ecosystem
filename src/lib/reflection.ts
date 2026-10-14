/** บันทึกสะท้อนคิดการจัดการเรียนรู้รายภาคเรียน — teaching_reflections/{ปี}_{ภาค}_{staffId} (ต้องตรง firestore.rules) */
export interface Reflection {
  id: string;
  semesterId: string;
  academicYear: string;
  term: '1' | '2';
  teacherStaffId: string;
  teacherName: string;
  departmentId: string;
  outcomes: string;
  strengths: string;
  problems: string;
  improvements: string;
  nextPlan: string;
}
export type ReflectionContent = Pick<Reflection, 'outcomes' | 'strengths' | 'problems' | 'improvements' | 'nextPlan'>;
export const REFLECTION_FIELDS: { id: keyof ReflectionContent; label: string; hint: string; required: boolean }[] = [
  { id: 'outcomes', label: 'ผลการจัดการเรียนรู้ของผู้เรียน', hint: 'ผู้เรียนเกิดการเรียนรู้ตามตัวชี้วัดอย่างไร (อ้างอิงผลงาน/คะแนน/การสังเกต)', required: true },
  { id: 'strengths', label: 'จุดเด่นที่พบ', hint: 'สิ่งที่ทำได้ดีและอยากรักษาไว้', required: false },
  { id: 'problems', label: 'ปัญหา/อุปสรรค', hint: 'ปัญหาที่พบในการสอนภาคเรียนนี้', required: true },
  { id: 'improvements', label: 'การนำข้อเสนอแนะ/ผลนิเทศไปปรับปรุง', hint: 'นำข้อเสนอแนะจากการตรวจแผน/การนิเทศ/PLC ไปปรับการสอนอย่างไร', required: true },
  { id: 'nextPlan', label: 'แนวทางพัฒนาในภาคเรียนถัดไป', hint: 'สิ่งที่จะปรับ/ทดลองต่อ', required: true },
];
export const emptyReflection = (): ReflectionContent => ({ outcomes: '', strengths: '', problems: '', improvements: '', nextPlan: '' });
export const reflectionId = (semesterId: string, staffId: string) => `${semesterId}_${staffId}`;
export function validateReflection(c: ReflectionContent): string[] {
  const out: string[] = [];
  for (const f of REFLECTION_FIELDS) if (c[f.id].length > 2000) out.push(`"${f.label}" ยาวเกิน 2,000 ตัวอักษร`);
  return out;
}
/** ครบ = กรอกทุกหัวข้อที่จำเป็น */
export const isReflectionComplete = (c: ReflectionContent) => REFLECTION_FIELDS.filter(f => f.required).every(f => c[f.id].trim().length > 0);
