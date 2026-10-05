import type { TemplateImportType } from './importTemplates';

/**
 * ลำดับการ์ดนำเข้าข้อมูล = ลำดับพึ่งพาจริงในโค้ด BulkDataImportModal:
 * - COURSE (ตารางสอน) จับคู่ครูจากคอลัมน์อีเมล/ชื่อกับ collection `staff` (matchedTeacherId) → ต้องมีบุคลากรก่อน
 * - PARENT ตรวจว่ารหัสนักเรียนมีอยู่ใน `students` (realStudentIds) → ต้องมีนักเรียนก่อน
 * - TEACHER, STUDENT ไม่พึ่งข้อมูลอื่น
 */
export const IMPORT_ORDER: TemplateImportType[] = ['TEACHER', 'STUDENT', 'COURSE', 'PARENT'];

export const IMPORT_DEPENDENCIES: Record<TemplateImportType, TemplateImportType[]> = {
  TEACHER: [],
  STUDENT: [],
  COURSE: ['TEACHER'],
  PARENT: ['STUDENT'],
};
