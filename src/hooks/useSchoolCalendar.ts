import { useEffect, useMemo, useState } from 'react';
import { SchoolCalendarEvent } from '../types';
import { subscribeSchoolCalendarEvents } from '../services/firestoreService';

export interface CalendarStatus {
  isHoliday: boolean;
  holidayName: string | null;
  isOutsideSemester: boolean; // true เฉพาะเมื่อมีการตั้งค่าช่วงเปิด-ปิดภาคเรียนไว้จริง แล้ว "วันนี้" ไม่อยู่ในช่วงไหนเลย
}

/**
 * ปฏิทินโรงเรียน (school_calendar_events) — real-time สำหรับทั้งหน้าแอดมิน (จัดการ) และหน้าครู
 * (เช็ค "วันนี้เป็นวันเรียนไหม" ก่อนแสดงตารางสอน/ให้เช็คชื่อ)
 */
export function useSchoolCalendar() {
  const [events, setEvents] = useState<SchoolCalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeSchoolCalendarEvents((list) => {
      setEvents(list);
      setLoading(false);
    });
    return unsub;
  }, []);

  // จับคู่ SEMESTER_START/SEMESTER_END ด้วย (academicYear, semester) เดียวกัน เป็นช่วงวันที่ 1 ช่วง
  const semesterRanges = useMemo(() => {
    const starts = events.filter(e => e.type === 'SEMESTER_START');
    const ends = events.filter(e => e.type === 'SEMESTER_END');
    const ranges: { start: string; end: string; academicYear: string; semester: string | null }[] = [];
    starts.forEach(s => {
      const matchEnd = ends.find(e => e.academicYear === s.academicYear && e.semester === s.semester);
      if (matchEnd) ranges.push({ start: s.date, end: matchEnd.date, academicYear: s.academicYear, semester: s.semester });
    });
    return ranges;
  }, [events]);

  /** เช็คสถานะของวันที่ระบุ (YYYY-MM-DD) — คืน isHoliday/holidayName/isOutsideSemester */
  const getStatusForDate = (dateStr: string): CalendarStatus => {
    const holiday = events.find(e => e.type === 'HOLIDAY' && e.date === dateStr);
    // ถ้ายังไม่มีใครตั้งค่าช่วงเปิด-ปิดภาคเรียนไว้เลย ไม่ถือว่า "นอกภาคเรียน" (กันบล็อกผิดจากข้อมูลที่ยังไม่ครบ)
    const isOutsideSemester = semesterRanges.length > 0 && !semesterRanges.some(r => dateStr >= r.start && dateStr <= r.end);
    return {
      isHoliday: !!holiday,
      holidayName: holiday?.name || null,
      isOutsideSemester,
    };
  };

  return { events, loading, semesterRanges, getStatusForDate };
}
