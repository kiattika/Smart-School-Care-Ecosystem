import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

export interface Period {
  id: string;
  periodNumber: number;
  periodName: string;
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  periodType: string;
  days: string[];
}

const DEFAULT_PERIODS: Period[] = [
  { id: 'p-hr1', periodNumber: 0, periodName: 'กิจกรรมหน้าเสาธง & โฮมรูม', startTime: '07:30', endTime: '08:30', periodType: 'HOMEROOM', days: ['MON', 'TUE', 'WED', 'THU', 'FRI'] },
  { id: 'p-1', periodNumber: 1, periodName: 'คาบเรียนวิชาการที่ 1', startTime: '08:30', endTime: '09:20', periodType: 'ACADEMIC', days: ['MON', 'TUE', 'WED', 'THU', 'FRI'] },
  { id: 'p-2', periodNumber: 2, periodName: 'คาบเรียนวิชาการที่ 2', startTime: '09:20', endTime: '10:10', periodType: 'ACADEMIC', days: ['MON', 'TUE', 'WED', 'THU', 'FRI'] },
  { id: 'p-b1', periodNumber: 3, periodName: 'พักเบรกเช้า', startTime: '10:10', endTime: '10:20', periodType: 'BREAK', days: ['MON', 'TUE', 'WED', 'THU', 'FRI'] },
  { id: 'p-3', periodNumber: 3, periodName: 'คาบเรียนวิชาการที่ 3', startTime: '10:20', endTime: '11:10', periodType: 'ACADEMIC', days: ['MON', 'TUE', 'WED', 'THU', 'FRI'] },
  { id: 'p-4', periodNumber: 4, periodName: 'คาบเรียนวิชาการที่ 4', startTime: '11:10', endTime: '12:00', periodType: 'ACADEMIC', days: ['MON', 'TUE', 'WED', 'THU', 'FRI'] },
  { id: 'p-lunch', periodNumber: 5, periodName: 'พักรับประทานอาหารกลางวัน', startTime: '12:00', endTime: '12:50', periodType: 'LUNCH', days: ['MON', 'TUE', 'WED', 'THU', 'FRI'] },
  { id: 'p-5', periodNumber: 5, periodName: 'คาบเรียนวิชาการที่ 5', startTime: '12:50', endTime: '13:40', periodType: 'ACADEMIC', days: ['MON', 'TUE', 'WED', 'THU', 'FRI'] },
  { id: 'p-6', periodNumber: 6, periodName: 'คาบเรียนวิชาการที่ 6', startTime: '13:40', endTime: '14:30', periodType: 'ACADEMIC', days: ['MON', 'TUE', 'WED', 'THU', 'FRI'] },
  { id: 'p-7', periodNumber: 7, periodName: 'คาบเรียนวิชาการที่ 7', startTime: '14:30', endTime: '15:20', periodType: 'ACADEMIC', days: ['MON', 'TUE', 'WED', 'THU', 'FRI'] },
  { id: 'p-dev', periodNumber: 8, periodName: 'กิจกรรมพัฒนาผู้เรียน (ชมรม/แนะแนว)', startTime: '15:20', endTime: '16:10', periodType: 'DEVELOPMENT', days: ['MON', 'TUE', 'WED', 'THU', 'FRI'] },
  { id: 'p-home', periodNumber: 9, periodName: 'โฮมรูมเย็น / เคลียร์ห้องเรียน', startTime: '16:10', endTime: '16:30', periodType: 'HOMEROOM', days: ['MON', 'TUE', 'WED', 'THU', 'FRI'] }
];

export function usePeriodsConfig() {
  const [periods, setPeriods] = useState<Period[]>(DEFAULT_PERIODS);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const docRef = doc(db, 'school_settings', 'periods_config');
    
    // Read-only real-time listener (no auto-seeding writes on mount for any role)
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data && Array.isArray(data.periods)) {
          const sorted = [...data.periods].sort((a, b) => a.periodNumber - b.periodNumber);
          setPeriods(sorted);
        }
      }
      setLoading(false);
    }, (err) => {
      console.warn("Firestore listening notice in usePeriodsConfig (using defaults):", err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const updatePeriodsConfig = async (newPeriods: Period[]) => {
    const previousPeriods = periods;
    // 1. Optimistic update
    setPeriods(newPeriods);
    setError(null);

    try {
      // 2. Attempt Firestore write
      const docRef = doc(db, 'school_settings', 'periods_config');
      await setDoc(docRef, {
        periods: newPeriods,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err: any) {
      // 3. Revert optimistic state on failure
      setPeriods(previousPeriods);
      const errorMsg = 'บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
      setError(errorMsg);
      console.error("Firestore write failed in updatePeriodsConfig:", err);
      throw err;
    }
  };

  const clearError = () => setError(null);

  return { periods, loading, error, clearError, updatePeriodsConfig };
}
