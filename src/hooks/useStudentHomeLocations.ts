import { useEffect, useState } from 'react';
import type { StudentHomeLocation } from '../types';
import { subscribeStudentHomeLocationsByRoom } from '../services/firestoreService';

/** พิกัดบ้านนักเรียนจริงทั้งห้อง (student_home_locations) — คืน map ตาม studentId */
export function useStudentHomeLocations(room?: string): { byStudent: Map<string, StudentHomeLocation>; loading: boolean } {
  const [rows, setRows] = useState<StudentHomeLocation[]>([]);
  const [loading, setLoading] = useState(!!room);
  useEffect(() => {
    if (!room) { setRows([]); setLoading(false); return; }
    setLoading(true);
    return subscribeStudentHomeLocationsByRoom(room, (r) => { setRows(r); setLoading(false); });
  }, [room]);
  return { byStudent: new Map(rows.map(r => [r.studentId, r])), loading };
}
