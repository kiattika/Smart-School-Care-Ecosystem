import * as fs from 'fs';

/**
 * อ่านไฟล์ source/rules เป็นข้อความโดยแปลง CRLF → LF เสมอ
 *
 * บน Windows ที่ core.autocrlf=true working tree เป็น CRLF (เช่น src/TeacherPortal.tsx = i/lf w/crlf)
 * เทสต์ที่เทียบข้อความหลายบรรทัด/regex `$` จะ fail ทั้งที่โค้ดถูก — ใช้ helper นี้แทน
 * fs.readFileSync(path, 'utf8') ทุกจุดใน src/__tests__
 */
export function readSource(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
}
