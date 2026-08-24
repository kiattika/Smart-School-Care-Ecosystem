import { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface AdminPeriodConfig {
  id: string;
  periodNumber: number;
  periodName: string;
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
  periodType: string;
}

export interface ScheduleItem {
  id: string;
  courseCode: string;
  courseName: string;
  periodNumber: number;
  scheduleDay: number; // 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday
  room: string;
  targetClass: string;
  type: 'MAIN' | 'ACTIVITY';
  teacherEmail: string;
  teacherName: string;
  teachingPartner?: string | null;
  partnerCheckedAttendance?: boolean;
  attendanceTaken?: boolean;
  studentsCount?: number;
}

const DEFAULT_ADMIN_PERIODS: AdminPeriodConfig[] = [
  { id: 'p0', periodNumber: 0, periodName: 'HR กิจกรรมโฮมรูม', startTime: '08:00', endTime: '08:30', periodType: 'ACTIVITY' },
  { id: 'p1', periodNumber: 1, periodName: 'คาบเรียนวิชาการที่ 1', startTime: '08:30', endTime: '09:20', periodType: 'MAIN' },
  { id: 'p2', periodNumber: 2, periodName: 'คาบเรียนวิชาการที่ 2', startTime: '09:20', endTime: '10:10', periodType: 'MAIN' },
  { id: 'p3', periodNumber: 3, periodName: 'คาบเรียนวิชาการที่ 3', startTime: '10:10', endTime: '11:00', periodType: 'MAIN' },
  { id: 'p4', periodNumber: 4, periodName: 'คาบเรียนวิชาการที่ 4', startTime: '11:00', endTime: '11:50', periodType: 'MAIN' },
  { id: 'p5', periodNumber: 5, periodName: 'พักกลางวัน', startTime: '11:50', endTime: '12:40', periodType: 'BREAK' },
  { id: 'p6', periodNumber: 6, periodName: 'คาบเรียนวิชาการที่ 5', startTime: '12:40', endTime: '13:30', periodType: 'MAIN' },
  { id: 'p7', periodNumber: 7, periodName: 'คาบเรียนวิชาการที่ 6', startTime: '13:30', endTime: '14:20', periodType: 'MAIN' },
  { id: 'p8', periodNumber: 8, periodName: 'คาบเรียนวิชาการที่ 7', startTime: '14:20', endTime: '15:10', periodType: 'MAIN' }
];

export const isTeacherEmailMatch = (email1?: string, email2?: string): boolean => {
  if (!email1 || !email2) return false;
  const e1 = email1.toLowerCase();
  const e2 = email2.toLowerCase();
  if (e1 === e2) return true;
  const kiattisakEmails = [
    'kiattisak@utd.ac.th', 
    'kiattika@utd.ac.th', 
    'kiattika@gmail.com', 
    'teacher@utd.ac.th',
    'teacher.test@utd.ac.th',
    'advisor.test@utd.ac.th'
  ];
  if (kiattisakEmails.includes(e1) && kiattisakEmails.includes(e2)) return true;
  return false;
};

// Helper to remove any undefined properties from an object before saving to Firestore
const sanitizeForFirestore = <T extends Record<string, any>>(obj: T): Partial<T> => {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== undefined)
  ) as Partial<T>;
};

export function useTeacherFirestoreSchedule() {
  const [periods, setPeriods] = useState<AdminPeriodConfig[]>(DEFAULT_ADMIN_PERIODS);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribePeriods = () => {};
    let unsubscribeSchedules = () => {};

    const syncData = () => {
      try {
        const periodsColRef = collection(db, 'admin_periods_config');
        const schedulesColRef = collection(db, 'schedules');

        // Setup strictly read-only real-time listeners (no mount auto-seeding writes for non-admin users)
        unsubscribePeriods = onSnapshot(periodsColRef, (snapshot) => {
          if (!snapshot.empty) {
            const list: AdminPeriodConfig[] = [];
            snapshot.forEach((docSnap) => {
              list.push({ id: docSnap.id, ...docSnap.data() } as AdminPeriodConfig);
            });
            setPeriods(list.sort((a, b) => a.periodNumber - b.periodNumber));
          } else {
            setPeriods([]);
          }
        }, (err) => {
          console.warn("Notice: admin_periods_config listener (using defaults):", err.message);
        });

        unsubscribeSchedules = onSnapshot(schedulesColRef, (snapshot) => {
          if (!snapshot.empty) {
            const list: ScheduleItem[] = [];
            snapshot.forEach((docSnap) => {
              list.push({ id: docSnap.id, ...docSnap.data() } as ScheduleItem);
            });
            setSchedules(list);
          } else {
            setSchedules([]);
          }
          setLoading(false);
        }, (err) => {
          console.warn("Notice: schedules listener (using defaults):", err.message);
          setLoading(false);
        });

      } catch (err: any) {
        console.warn("Notice: Firestore schedule sync setup:", err.message);
        setLoading(false);
      }
    };

    syncData();

    return () => {
      unsubscribePeriods();
      unsubscribeSchedules();
    };
  }, []);

  const updateScheduleAttendance = async (scheduleId: string, status: boolean) => {
    const target = schedules.find(s => s.id === scheduleId);
    const previousStatus = target?.attendanceTaken;

    // 1. Optimistic local update for responsive UI
    setSchedules(prev => prev.map(s => s.id === scheduleId ? { ...s, attendanceTaken: status } : s));
    setError(null);

    try {
      // 2. Attempt Firestore write
      const docRef = doc(db, 'schedules', scheduleId);
      await setDoc(docRef, { attendanceTaken: status }, { merge: true });
    } catch (err: any) {
      // 3. Revert local state to prior value on failure
      setSchedules(prev => prev.map(s => s.id === scheduleId ? { ...s, attendanceTaken: previousStatus } : s));
      const errorMsg = 'บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
      setError(errorMsg);
      console.error("Firestore write failed for updateScheduleAttendance:", err);
      throw err;
    }
  };

  const updatePartnerAttendance = async (scheduleId: string, status: boolean) => {
    const target = schedules.find(s => s.id === scheduleId);
    const previousStatus = target?.partnerCheckedAttendance;

    // 1. Optimistic local update for responsive UI
    setSchedules(prev => prev.map(s => s.id === scheduleId ? { ...s, partnerCheckedAttendance: status } : s));
    setError(null);

    try {
      // 2. Attempt Firestore write
      const docRef = doc(db, 'schedules', scheduleId);
      await setDoc(docRef, { partnerCheckedAttendance: status }, { merge: true });
    } catch (err: any) {
      // 3. Revert local state to prior value on failure
      setSchedules(prev => prev.map(s => s.id === scheduleId ? { ...s, partnerCheckedAttendance: previousStatus } : s));
      const errorMsg = 'บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
      setError(errorMsg);
      console.error("Firestore write failed for updatePartnerAttendance:", err);
      throw err;
    }
  };

  const clearError = () => setError(null);

  return { 
    periods, 
    schedules, 
    loading, 
    error, 
    isPeriodsEmpty: !loading && periods.length === 0,
    emptyPeriodsMessage: 'ยังไม่มีการตั้งค่าคาบเรียนจากผู้ดูแลระบบ',
    isSchedulesEmpty: !loading && schedules.length === 0,
    emptySchedulesMessage: 'ยังไม่มีตารางสอนในระบบ กรุณาติดต่อผู้ดูแลระบบ',
    clearError, 
    updateScheduleAttendance, 
    updatePartnerAttendance 
  };
}
