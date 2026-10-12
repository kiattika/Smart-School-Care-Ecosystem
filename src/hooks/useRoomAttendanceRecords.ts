import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AttendanceRecordLite, roomQueryCandidates } from '../lib/studentAttendanceStats';
import type { AttendanceRecordFull } from '../lib/attendanceHistory';

/**
 * Live listener ของ attendance_records ที่ query จริงจาก Firestore ตามห้อง(s) + ช่วงวันที่ —
 * hook กลางที่ใช้ร่วมกันทั้ง 4 บทบาท (ครูวิชา/ครูที่ปรึกษา/ผู้ปกครอง/นักเรียน) ผ่าน
 * useStudentAttendanceStats.ts (รายบุคคล) หรือเรียกตรงสำหรับมุมมองทั้งห้อง (ครูที่ปรึกษา)
 *
 * รับ `rooms` เป็น array เพราะครูผู้สอนวิชาอาจสอนหลายห้องพร้อมกัน — ยิง query เดียวด้วย
 * `where('room', 'in', [...])` (ไม่ query แยกทีละห้อง) แล้ว fan-out ห้องแต่ละห้องเป็นหลาย
 * candidate string ด้วย roomQueryCandidates() กัน format ห้องไม่ตรงกัน (ม.5/8 / M.5/8 / 5/8)
 */
export function useRoomAttendanceRecords(
  rooms: string[],
  range: { start: string; end: string },
) {
  const [records, setRecords] = useState<AttendanceRecordLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // key เสถียรสำหรับ dependency array (rooms/range เป็น object/array ใหม่ทุก render)
  const roomsKey = useMemo(() => Array.from(new Set(rooms.filter(Boolean))).sort().join('|'), [rooms]);
  const rangeKey = `${range.start}__${range.end}`;

  useEffect(() => {
    const uniqueRooms = roomsKey ? roomsKey.split('|') : [];
    if (uniqueRooms.length === 0 || !range.start || !range.end) {
      setRecords([]);
      setLoading(false);
      return;
    }

    const candidates = Array.from(new Set(uniqueRooms.flatMap(roomQueryCandidates))).slice(0, 30);
    if (candidates.length === 0) {
      setRecords([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const qy = query(
      collection(db, 'attendance_records'),
      where('room', 'in', candidates),
      where('date', '>=', range.start),
      where('date', '<=', range.end),
    );
    const unsub = onSnapshot(
      qy,
      (snap) => {
        setRecords(snap.docs.map(d => {
          const data = d.data() as any;
          return { date: String(data.date || ''), students: data.students || {} } as AttendanceRecordLite;
        }));
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.warn('[useRoomAttendanceRecords] listener error:', err.message);
        setError(err.message);
        setLoading(false);
      },
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomsKey, rangeKey]);

  return { records, loading, error };
}

/**
 * เหมือน useRoomAttendanceRecords แต่คืนฟิลด์ครบ (คาบ/วิชา/ผู้เช็ค) สำหรับดูประวัติรายคาบรายวัน — ครูผู้สอน/ครูที่ปรึกษาเท่านั้น
 * (rules: attendance_records อ่านได้เฉพาะบทบาทครู; นักเรียน/ผู้ปกครองใช้ยอดสะสมที่ students/{id})
 */
export function useRoomAttendanceRecordsFull(
  rooms: string[],
  range: { start: string; end: string },
) {
  const [records, setRecords] = useState<AttendanceRecordFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const roomsKey = useMemo(() => Array.from(new Set(rooms.filter(Boolean))).sort().join('|'), [rooms]);
  const rangeKey = `${range.start}__${range.end}`;

  useEffect(() => {
    const uniqueRooms = roomsKey ? roomsKey.split('|') : [];
    const candidates = Array.from(new Set(uniqueRooms.flatMap(roomQueryCandidates))).slice(0, 30);
    if (candidates.length === 0 || !range.start || !range.end) {
      setRecords([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const qy = query(
      collection(db, 'attendance_records'),
      where('room', 'in', candidates),
      where('date', '>=', range.start),
      where('date', '<=', range.end),
    );
    const unsub = onSnapshot(
      qy,
      (snap) => {
        setRecords(snap.docs.map(d => {
          const data = d.data() as any;
          return {
            id: d.id,
            date: String(data.date || ''),
            room: data.room,
            periodNumber: typeof data.periodNumber === 'number' ? data.periodNumber : undefined,
            courseCode: data.courseCode,
            courseName: data.courseName,
            source: data.source,
            checkedByName: data.checkedByName,
            students: data.students || {},
          } as AttendanceRecordFull;
        }));
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.warn('[useRoomAttendanceRecordsFull] listener error:', err.message);
        setError(err.message);
        setLoading(false);
      },
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomsKey, rangeKey]);

  return { records, loading, error };
}
