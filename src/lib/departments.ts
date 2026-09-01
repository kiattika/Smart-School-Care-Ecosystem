export interface DefaultDepartment {
  id: string;
  name: string;
  order: number;
  kind: 'LEARNING_AREA' | 'DIRECTORATE' | 'SUPPORT' | 'ACTIVITY';
  parentId?: string | null;
}

/**
 * ค่าเริ่มต้นของกลุ่มสาระฯ/กลุ่มงาน — ใช้ตอน seed `department_config` และเป็น fallback
 * เมื่อ Firestore ยังว่าง. อย่า import ไปใช้แสดงผลตรง ๆ — ใช้ hook `useDepartments()`
 * ซึ่งอ่านจาก Firestore แบบ real-time (แอดมินแก้ไขได้ผ่านเมนู "จัดการกลุ่มสาระฯ")
 *
 * หมายเหตุ: `administration` (ฝ่ายบริหารงานบุคคล) กับ `directorate` (กลุ่มอำนวยการ) เป็นคนละกลุ่ม
 * — administration = งานบุคคล/ธุรการ, directorate = ผู้อำนวยการ + รองผู้อำนวยการกลุ่มงานต่าง ๆ
 */
export const DEFAULT_DEPARTMENTS: DefaultDepartment[] = [
  { id: 'directorate', name: 'กลุ่มอำนวยการ', order: 0, kind: 'DIRECTORATE' },
  { id: 'sci-dept', name: 'กลุ่มสาระฯ วิทยาศาสตร์และเทคโนโลยี', order: 1, kind: 'LEARNING_AREA' },
  { id: 'sci-cs-dept', name: 'กลุ่มสาระฯ วิทยาศาสตร์และเทคโนโลยี (คอมพิวเตอร์)', order: 2, kind: 'LEARNING_AREA', parentId: 'sci-dept' },
  { id: 'math-dept', name: 'กลุ่มสาระฯ คณิตศาสตร์', order: 3, kind: 'LEARNING_AREA' },
  { id: 'thai-dept', name: 'กลุ่มสาระฯ ภาษาไทย', order: 4, kind: 'LEARNING_AREA' },
  { id: 'art-dept', name: 'กลุ่มสาระฯ ศิลปะ', order: 5, kind: 'LEARNING_AREA' },
  { id: 'foreign-dept', name: 'กลุ่มสาระฯ ภาษาต่างประเทศ', order: 6, kind: 'LEARNING_AREA' },
  { id: 'soc-dept', name: 'กลุ่มสาระฯ สังคมศึกษา ศาสนา และวัฒนธรรม', order: 7, kind: 'LEARNING_AREA' },
  { id: 'health-dept', name: 'กลุ่มสาระฯ สุขศึกษาและพลศึกษา', order: 8, kind: 'LEARNING_AREA' },
  { id: 'career-dept', name: 'กลุ่มสาระฯ การงานอาชีพ', order: 9, kind: 'LEARNING_AREA' },
  { id: 'activity-dept', name: 'กลุ่มกิจกรรมพัฒนาผู้เรียน', order: 10, kind: 'ACTIVITY' },
  { id: 'administration', name: 'ฝ่ายบริหารงานบุคคล', order: 11, kind: 'SUPPORT' },
];
