import { isStaffActive } from './staffStatus';

/**
 * รายการ "ตารางภาระงานสอน" เป็นรายงานภาระงานของภาคเรียนปัจจุบัน
 *  - บุคลากรที่ใช้งานอยู่: แสดงเสมอ (รวมคนที่ยังไม่มีคาบ)
 *  - บุคลากรที่ถูกปิดการใช้งาน: แสดงเฉพาะเมื่อยังมีคาบค้างในภาคเรียนนี้ (เพื่อให้แอดมินเห็นว่ามีตารางที่ต้องโอน/เก็บกวาด)
 *    ไม่มีคาบแล้ว = ไม่มีภาระงานให้รายงาน จึงซ่อน (ข้อมูล staff ไม่ถูกลบ ประวัติย้อนหลังยังแสดงชื่อได้ที่อื่น)
 */
export function shouldShowInTeachingLoad(
  staff: { status?: unknown } | null | undefined,
  totalPeriods: number,
): boolean {
  if (isStaffActive(staff)) return true;
  return totalPeriods > 0;
}
