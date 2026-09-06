import { useMemo } from 'react';
import { useRoomAttendanceRecords } from './useRoomAttendanceRecords';
import {
  computeStudentAttendanceStats,
  DEFAULT_ATTENDANCE_THRESHOLD_PERCENT,
  StudentAttendanceStats,
} from '../lib/studentAttendanceStats';

/**
 * สถิติการเข้าเรียนของนักเรียนคนเดียว (ขาด/ลา/มาสาย/รวมเวลาเรียน + % อัตราเข้าเรียน + ธงเตือน)
 * จาก attendance_records จริง แบบ real-time — ใช้ร่วมกันทั้ง 4 บทบาท:
 *   - ครูประจำวิชา: ต่อนักเรียนในห้อง/รายวิชาที่สอน
 *   - ครูที่ปรึกษา: ต่อนักเรียนทุกคนในห้องที่ดูแล (ดู useRoomAttendanceRecords ตรงสำหรับมุมมองทั้งห้อง)
 *   - ผู้ปกครอง: ต่อบุตรหลานตัวเอง
 *   - นักเรียน: ต่อตัวเอง
 *
 * threshold (% ต่ำกว่านี้ = ธงเตือน) ยังไม่มีการยืนยันจากโรงเรียน — ใช้ค่าเริ่มต้นที่สมเหตุสมผล
 * (DEFAULT_ATTENDANCE_THRESHOLD_PERCENT = 80) ตามที่ผู้ใช้อนุญาตให้ตั้งเองไปก่อนได้
 */
export function useStudentAttendanceStats(
  studentId: string | undefined,
  room: string | undefined,
  range: { start: string; end: string },
  threshold: number = DEFAULT_ATTENDANCE_THRESHOLD_PERCENT,
): { stats: StudentAttendanceStats | null; loading: boolean; error: string | null } {
  const { records, loading, error } = useRoomAttendanceRecords(room ? [room] : [], range);

  const stats = useMemo(() => {
    if (!studentId) return null;
    return computeStudentAttendanceStats(records, studentId, threshold);
  }, [records, studentId, threshold]);

  return { stats, loading, error };
}
