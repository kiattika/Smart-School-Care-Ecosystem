import { describe, it, expect } from 'vitest';
import { parseTeacherLoadReport } from '../utils/teacherLoadReportParser';

/**
 * Task 1 — พิสูจน์ root cause ของบั๊ก "ไม่พบบัญชีครูที่มีอีเมล kiattika@utd.ac.th"
 * ตอน import ตารางสอน (COURSE) ทั้งที่ staff/kiattika@utd.ac.th มีอยู่จริงใน Firestore
 *
 * BulkDataImportModal.validateRows() closure จับค่า realStaffList ณ ตอนที่ processFile ถูกเรียก
 * ถ้า getDocs('staff') ยังโหลดไม่เสร็จ → realStaffList = [] → parseTeacherLoadReport(rows, [])
 * → matchTeacherByEmail หา staff ไม่เจอ → warning นี้ และ preview ไม่ถูก re-validate ทีหลัง
 *
 * เทสต์นี้จำลอง "parse เกิดก่อน staff โหลดเสร็จ" (staffList = []) แล้วเทียบกับ "staff โหลดเสร็จแล้ว"
 */
describe('BulkDataImportModal staff-list staleness (root cause proof)', () => {
  const teacherLoadRows = [
    {
      'กลุ่มสาระ': 'คณิตศาสตร์',
      'ที่': '1',
      'ชื่อ-สกุล': 'นายเกียรติศักดิ์ แก้วหล้า',
      'อีเมล์': 'kiattika@utd.ac.th',
      'ประจำชั้น': 'ม.5/8',
      'ลำดับวิชา': '1',
      'รหัสวิชา': 'ค32201',
      'ชื่อรายวิชา': 'คณิตศาสตร์เพิ่มเติม',
      'คาบ/ห้อง': '4 / [943] HR 5/8',
      'วัน-คาบที่สอน': 'อ2, พ4, ฤ1, ศ3',
      'ระดับ': 'ม.5/8',
      'สรุปคาบ': '4',
    },
  ];

  // staff doc ที่ seed จริง: staff/kiattika@utd.ac.th มี field email ตรงเป๊ะ
  const loadedStaffList = [
    { id: 'kiattika@utd.ac.th', email: 'kiattika@utd.ac.th', fullName: 'นายเกียรติศักดิ์ แก้วหล้า', displayName: 'นายเกียรติศักดิ์ แก้วหล้า' },
    { id: 'test_admin_kiattika_001', email: 'kiattika@utd.ac.th', fullName: 'นายเกียรติศักดิ์ แก้วหล้า', displayName: 'นายเกียรติศักดิ์ แก้วหล้า' },
  ];

  it('REPRO: staffList=[] (parse ก่อน fetch เสร็จ) → เกิด warning "ไม่พบบัญชีครูที่มีอีเมล kiattika@utd.ac.th" + ไม่ match', () => {
    const { courseRows } = parseTeacherLoadReport(teacherLoadRows, []);

    expect(courseRows).toHaveLength(1);
    expect(courseRows[0].matchedTeacherId).toBeUndefined();
    expect(courseRows[0].warnings.some(w => w.includes('ไม่พบบัญชีครูที่มีอีเมล') && w.includes('kiattika@utd.ac.th'))).toBe(true);
  });

  it('FIXED-STATE: staffList โหลดเสร็จแล้ว (email ตรงเป๊ะ) → exact match Step 1 ทำงาน ไม่มี warning', () => {
    const { courseRows } = parseTeacherLoadReport(teacherLoadRows, loadedStaffList);

    expect(courseRows).toHaveLength(1);
    expect(courseRows[0].matchedTeacherId).toBe('kiattika@utd.ac.th');
    expect(courseRows[0].matchedTeacherEmail).toBe('kiattika@utd.ac.th');
    expect(courseRows[0].warnings.some(w => w.includes('ไม่พบบัญชีครู'))).toBe(false);
  });

  it('CONCLUSION: ผลลัพธ์ต่างกันสิ้นเชิงระหว่าง 2 กรณี = อาการที่ผู้ใช้เจอเกิดจาก realStaffList ว่าง ณ ตอน parse เท่านั้น', () => {
    const empty = parseTeacherLoadReport(teacherLoadRows, []).courseRows[0];
    const loaded = parseTeacherLoadReport(teacherLoadRows, loadedStaffList).courseRows[0];
    expect(empty.matchedTeacherId).toBeUndefined();
    expect(loaded.matchedTeacherId).toBeDefined();
  });
});
