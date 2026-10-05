/**
 * เทมเพลตตัวอย่าง (CSV) ของการนำเข้าข้อมูลขนาดใหญ่ — header ต้องตรงกับที่ parser/validateRows ใน
 * BulkDataImportModal คาดหวัง (มี test src/__tests__/importTemplates.test.ts คุมไว้)
 */
export type TemplateImportType = 'STUDENT' | 'TEACHER' | 'COURSE' | 'PARENT';

export const IMPORT_TEMPLATES: Record<TemplateImportType, string> = {
  STUDENT: 'Student ID,Prefix,FirstName,LastName,Room,StudentNo,ParentMobile\n38501,นาย,กฤตยชญ์,บุญช่วย,ม.5/8,1,0812345678\n38502,นาย,ณัฐพล,สุขสบาย,ม.5/8,2,0898765432\n38503,นางสาว,สมศรี,ใจดี,ม.5/8,3,0861112233',
  // หมายเหตุ: teacher-04 เว้นคอลัมน์ Roles และ Department ว่าง → ระบบตั้งเป็น SUBJECT_TEACHER อัตโนมัติ
  TEACHER: 'Teacher ID,Prefix,FirstName,LastName,Position,Email,Roles,Department\nteacher-01,นาย,ทวี,รักเรียน,ครู คศ.1,tawee@utd.ac.th,"SUBJECT_TEACHER,HOMEROOM_TEACHER",math-dept\nteacher-02,นางสาว,สมจิต,แข็งขัน,ครู คศ.2,somjit@utd.ac.th,SUBJECT_TEACHER,sci-dept\nteacher-03,นางสาว,พิมลวรรณ,ศรีงาม,ครูผู้ช่วย,pimonwan@utd.ac.th,GUIDANCE_COUNSELOR,thai-dept\nteacher-04,นาย,ประสงค์,ตั้งใจสอน,ครูผู้ช่วย,prasong@utd.ac.th,,',
  // รูปแบบ "รายงานภาระงานสอน" (หลายแถวต่อครูหนึ่งคน — ชื่อ/อีเมลกรอกแถวแรกของครูแต่ละคน แถวถัดไปเว้นว่างได้)
  // อีเมลต้องตรงกับบุคลากรที่นำเข้าไว้แล้ว ไม่งั้นแถวนั้นจะไม่ถูกผูกกับครู
  COURSE: 'ที่,ชื่อ-สกุล,อีเมล์,กลุ่มสาระ,ลำดับวิชา,รหัสวิชา,ชื่อรายวิชา,คาบ/ห้อง,วัน-คาบที่สอน,ระดับ\n1,นายทวี รักเรียน,tawee@utd.ac.th,คณิตศาสตร์,1,ค32101,คณิตศาสตร์พื้นฐาน 3,4 / [943] ม.5/8,"อ2, พ4, ฤ1, ศ3",ม.5\n,,,,2,ค32201,คณิตศาสตร์เพิ่มเติม 3,2 / [944] ม.5/9,"จ1, ศ3",ม.5\n2,นางสาวสมจิต แข็งขัน,somjit@utd.ac.th,วิทยาศาสตร์,1,ว32101,ฟิสิกส์ 1,3 / [945] ม.5/8,"จ3-4, พ2",ม.5',
  PARENT: 'Student ID,ParentPrefix,ParentFirstName,ParentLastName,ParentNationalId,ParentMobile,Relationship\n38501,นาย,สมชาย,บุญช่วย,1101700207269,0812345678,บิดา\n38502,นาง,มาลี,สุขสบาย,3100600258967,0898765432,มารดา\n38503,นาย,วิรัตน์,ใจดี,1409901259376,0861112233,ผู้ปกครอง',
};

export const templateFilename = (t: TemplateImportType): string =>
  t === 'STUDENT' ? 'Student_Template.csv'
  : t === 'TEACHER' ? 'Teacher_Template.csv'
  : t === 'PARENT' ? 'Parent_Template.csv'
  : 'Schedule_Template.csv';
