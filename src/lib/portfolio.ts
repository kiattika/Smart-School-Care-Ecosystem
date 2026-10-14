/** แฟ้มสะสมงานครูรายภาคเรียน — รวมข้อมูลจากโครงการสอน/แผน/นิเทศ/บันทึกหลังสอน/PLC/สะท้อนคิด (คำนวณฝั่ง client จากข้อมูลจริงเท่านั้น) */
import type { PostTeachingRecord } from '../types';

/**
 * ช่วงวันที่ของภาคเรียนตามปฏิทินมาตรฐาน (ภาค 1: 1 พ.ค.–31 ต.ค., ภาค 2: 1 พ.ย.–30 เม.ย.ปีถัดไป)
 * — ตรงกับค่า fallback ใน useCurrentSemester; โรงเรียนยังไม่มีวันเปิด-ปิดภาคเรียนจริงในระบบ จึงเป็นค่าอ้างอิง
 */
export function semesterRange(academicYear: string, term: '1' | '2'): { from: string; to: string } {
  const g = Number(academicYear) - 543;
  return term === '1' ? { from: `${g}-05-01`, to: `${g}-10-31` } : { from: `${g}-11-01`, to: `${g + 1}-04-30` };
}

export interface PostTeachingSummary { total: number; late: number; onTime: number; linkedToPlan: number; deviated: number }
/** สรุปบันทึกหลังสอนของครูคนนี้ในช่วงวันที่ (ผูกด้วย recordedByStaffId เท่านั้น — บันทึกเก่าไม่มีตัวผู้บันทึกจึงไม่นับ ไม่เดา) */
export function summarizePostTeaching(records: readonly PostTeachingRecord[], staffId: string, from: string, to: string): PostTeachingSummary {
  const mine = staffId ? records.filter(r => r.recordedByStaffId === staffId && r.date >= from && r.date <= to) : [];
  return {
    total: mine.length,
    late: mine.filter(r => r.isLate).length,
    onTime: mine.filter(r => !r.isLate).length,
    linkedToPlan: mine.filter(r => (r.planUnitIds?.length || 0) > 0).length,
    deviated: mine.filter(r => r.planStatus === 'DEVIATED').length,
  };
}
export const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : null);
