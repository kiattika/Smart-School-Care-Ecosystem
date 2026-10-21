import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useCurrentSemester } from './useCurrentSemester';
import { isScheduleInTerm } from '../lib/scheduleSyncReplace';

/**
 * ตารางสอนทั้งโรงเรียนของภาคเรียนปัจจุบัน (live) — signed-in อ่าน schedules ได้ตาม rules
 * ใช้คำนวณภาระงานสอนรายครูในหน้าผู้บริหาร; error = ส่งข้อความให้หน้าจอแสดง (ไม่กลืน)
 */
export function useAllSchedules() {
  const sem = useCurrentSemester();
  const [state, setState] = useState<{ data: Record<string, any>[]; loading: boolean; error: string | null }>({ data: [], loading: true, error: null });
  useEffect(() => {
    if (sem.loading) return;
    return onSnapshot(
      collection(db, 'schedules'),
      (snap) => setState({
        data: snap.docs.filter(d => isScheduleInTerm(d.data(), sem)).map(d => ({ id: d.id, ...d.data() })),
        loading: false, error: null,
      }),
      (e) => setState({ data: [], loading: false, error: e.message }),
    );
  }, [sem.loading, sem.academicYear, sem.term]); // eslint-disable-line react-hooks/exhaustive-deps
  return state;
}
