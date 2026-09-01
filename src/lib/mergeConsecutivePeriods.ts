import type { SubjectPeriod } from '../components/TeacherScheduleList';

/**
 * รวมคาบที่ "ติดกัน" (double/triple period) ของวิชา + ระดับชั้น + ห้อง เดียวกัน
 * และหมายเลขคาบต่อเนื่องกัน (ไม่มีคาบอื่นคั่น) ให้แสดงเป็นรายการเดียว
 * เช่น คาบ 3 + คาบ 4 ค32101 ม.5/9 ห้อง 935 → "คาบที่ 3-4" ช่วงเวลา 10:10-11:50
 *
 * เช็คชื่อ/บันทึกหลังสอน ทำครั้งเดียวครอบทุกคาบย่อย (mergedCourseIds / mergedPeriodNumbers)
 */

const normRoom = (s?: string) => (s || '').replace(/^M\./i, 'ม.').trim().toLowerCase();

export function mergeConsecutivePeriods(periods: SubjectPeriod[]): SubjectPeriod[] {
  const sorted = [...periods].sort((a, b) => a.periodNumber - b.periodNumber);
  const out: SubjectPeriod[] = [];

  for (const p of sorted) {
    const prev = out[out.length - 1];
    const prevEnd = prev?.periodNumberEnd ?? prev?.periodNumber;

    const canMerge =
      prev &&
      prev.subjectCode === p.subjectCode &&
      normRoom(prev.className) === normRoom(p.className) &&
      normRoom(prev.room) === normRoom(p.room) &&
      (prev.type || 'MAIN') === (p.type || 'MAIN') &&
      typeof prevEnd === 'number' &&
      p.periodNumber === prevEnd + 1;

    if (canMerge && prev) {
      prev.periodNumberEnd = p.periodNumber;
      prev.endTime = p.endTime;
      prev.mergedCourseIds = [...(prev.mergedCourseIds ?? [prev.courseId]), p.courseId];
      prev.mergedPeriodNumbers = [...(prev.mergedPeriodNumbers ?? [prev.periodNumber]), p.periodNumber];
      // เช็คชื่อครั้งเดียวนับทั้งช่วง — ถือว่าเช็คแล้วถ้าคาบย่อยใดคาบหนึ่งเช็คแล้ว
      prev.attendanceTaken = prev.attendanceTaken || p.attendanceTaken;
      prev.hasPostTeachingRecord = prev.hasPostTeachingRecord || p.hasPostTeachingRecord;
      // สถานะคำขอเช็คชื่อย้อนหลัง — เอาสถานะที่ "คืบหน้าที่สุด" (APPROVED > PENDING > REJECTED > null)
      const rank = (s?: string | null) => (s === 'APPROVED' ? 3 : s === 'PENDING' ? 2 : s === 'REJECTED' ? 1 : 0);
      if (rank(p.lateRequestStatus) > rank(prev.lateRequestStatus)) prev.lateRequestStatus = p.lateRequestStatus;
      prev.partnerCheckedAttendance = prev.partnerCheckedAttendance && p.partnerCheckedAttendance;
    } else {
      out.push({ ...p });
    }
  }
  return out;
}

/** ป้ายกำกับคาบ: "คาบที่ 3" หรือ "คาบที่ 3-4" ถ้าเป็นคาบรวม */
export function periodRangeLabel(p: SubjectPeriod): string {
  return p.periodNumberEnd && p.periodNumberEnd !== p.periodNumber
    ? `${p.periodNumber}-${p.periodNumberEnd}`
    : `${p.periodNumber}`;
}
