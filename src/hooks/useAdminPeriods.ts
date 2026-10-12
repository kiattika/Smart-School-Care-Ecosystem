import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { AdminPeriodConfig } from './useTeacherFirestoreSchedule';

/** ตารางเวลา & กระดิ่งคาบเรียนสด จาก admin_periods_config (อ่านอย่างเดียว; ไม่มีข้อมูล = ลิสต์ว่าง ไม่เติมค่าเริ่มต้น) */
export function useAdminPeriods(): { periods: AdminPeriodConfig[]; loading: boolean } {
  const [periods, setPeriods] = useState<AdminPeriodConfig[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'admin_periods_config'),
      (snap) => {
        const list: AdminPeriodConfig[] = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() } as AdminPeriodConfig));
        setPeriods(list.sort((a, b) => a.periodNumber - b.periodNumber));
        setLoading(false);
      },
      () => { setPeriods([]); setLoading(false); },
    );
    return unsub;
  }, []);
  return { periods, loading };
}
