import { useEffect, useState } from 'react';
import type { HomeVisitRecord } from '../types';
import { subscribeHomeVisitRecordsByRoom } from '../services/firestoreService';

/** บันทึกเยี่ยมบ้านจริงของห้อง (ทุกปีการศึกษา) */
export function useHomeVisitRecords(room?: string): { records: HomeVisitRecord[]; loading: boolean } {
  const [records, setRecords] = useState<HomeVisitRecord[]>([]);
  const [loading, setLoading] = useState(!!room);
  useEffect(() => {
    if (!room) { setRecords([]); setLoading(false); return; }
    setLoading(true);
    return subscribeHomeVisitRecordsByRoom(room, (r) => { setRecords(r); setLoading(false); });
  }, [room]);
  return { records, loading };
}
