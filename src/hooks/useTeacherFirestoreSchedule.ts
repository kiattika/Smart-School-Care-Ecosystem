import { useEffect, useState } from 'react';
import { collection, onSnapshot, getDocs, doc, setDoc, writeBatch } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

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
  teachingPartner?: string;
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

// Helper to generate the default schedules for both email possibilities to be foolproof
const getSchedulesToSeed = (): ScheduleItem[] => {
  const emails = ['kiattika@utd.ac.th', 'kiattisak@utd.ac.th'];
  const items: ScheduleItem[] = [];

  emails.forEach(email => {
    // 1. HR Activity: Mon - Fri for M.5/8
    for (let day = 1; day <= 5; day++) {
      const daySuffix = ['mon', 'tue', 'wed', 'thu', 'fri'][day - 1];
      items.push({
        id: `sched-hr-${daySuffix}-${email.replace(/[@.]/g, '-')}`,
        courseCode: 'HR',
        courseName: 'HomeRoom (กิจกรรม)',
        periodNumber: 0,
        scheduleDay: day,
        room: '943',
        targetClass: 'M.5/8',
        type: 'ACTIVITY',
        teacherEmail: email,
        teacherName: 'Mr.Kiattisak',
        teachingPartner: 'Mrs.Koy Koy',
        partnerCheckedAttendance: false,
        attendanceTaken: false,
        studentsCount: 40
      });
    }

    // 2. ค32101 คณิตศาสตร์พื้นฐาน (MAIN) - วันจันทร์/อังคาร คาบ 8 (M.5/8)
    items.push({
      id: `sched-m58-math-mon-${email.replace(/[@.]/g, '-')}`,
      courseCode: 'ค32101',
      courseName: 'คณิตศาสตร์พื้นฐาน',
      periodNumber: 8,
      scheduleDay: 1,
      room: '943',
      targetClass: 'M.5/8',
      type: 'MAIN',
      teacherEmail: email,
      teacherName: 'Mr.Kiattisak',
      attendanceTaken: false,
      studentsCount: 40
    });
    items.push({
      id: `sched-m58-math-tue-${email.replace(/[@.]/g, '-')}`,
      courseCode: 'ค32101',
      courseName: 'คณิตศาสตร์พื้นฐาน',
      periodNumber: 8,
      scheduleDay: 2,
      room: '943',
      targetClass: 'M.5/8',
      type: 'MAIN',
      teacherEmail: email,
      teacherName: 'Mr.Kiattisak',
      attendanceTaken: false,
      studentsCount: 40
    });

    // 3. Other typical Kiattisak schedule items to populate the UI beautifully:
    // ค32201 คณิตเพิ่มเติม M.5/8 on Thursday period 1
    items.push({
      id: `sched-m58-mathadd-thu-${email.replace(/[@.]/g, '-')}`,
      courseCode: 'ค32201',
      courseName: 'คณิตศาสตร์เพิ่มเติม',
      periodNumber: 1,
      scheduleDay: 4,
      room: '943',
      targetClass: 'M.5/8',
      type: 'MAIN',
      teacherEmail: email,
      teacherName: 'Mr.Kiattisak',
      attendanceTaken: false,
      studentsCount: 40
    });

    // ค32101 คณิตศาสตร์พื้นฐาน M.5/8 on Monday period 6 & 7
    items.push({
      id: `sched-m58-math6-mon-${email.replace(/[@.]/g, '-')}`,
      courseCode: 'ค32101',
      courseName: 'คณิตศาสตร์พื้นฐาน',
      periodNumber: 6,
      scheduleDay: 1,
      room: '943',
      targetClass: 'M.5/8',
      type: 'MAIN',
      teacherEmail: email,
      teacherName: 'Mr.Kiattisak',
      attendanceTaken: false,
      studentsCount: 40
    });
    items.push({
      id: `sched-m58-math7-mon-${email.replace(/[@.]/g, '-')}`,
      courseCode: 'ค32101',
      courseName: 'คณิตศาสตร์พื้นฐาน',
      periodNumber: 7,
      scheduleDay: 1,
      room: '943',
      targetClass: 'M.5/8',
      type: 'MAIN',
      teacherEmail: email,
      teacherName: 'Mr.Kiattisak',
      attendanceTaken: false,
      studentsCount: 40
    });

    // ส30223 การป้องกันการทุจริต M.5/8 on Thursday period 6
    items.push({
      id: `sched-m58-corrupt-thu-${email.replace(/[@.]/g, '-')}`,
      courseCode: 'ส30223',
      courseName: 'การป้องกันการทุจริต',
      periodNumber: 6,
      scheduleDay: 4,
      room: '943',
      targetClass: 'M.5/8',
      type: 'MAIN',
      teacherEmail: email,
      teacherName: 'Mr.Kiattisak',
      attendanceTaken: false,
      studentsCount: 40
    });
  });

  return items;
};

export function useTeacherFirestoreSchedule() {
  const [periods, setPeriods] = useState<AdminPeriodConfig[]>([]);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribePeriods = () => {};
    let unsubscribeSchedules = () => {};

    const syncData = async () => {
      try {
        const periodsColRef = collection(db, 'admin_periods_config');
        const schedulesColRef = collection(db, 'schedules');

        // Check and seed periods first
        const periodSnap = await getDocs(periodsColRef);
        if (periodSnap.empty) {
          console.log("Seeding admin_periods_config collection in Firestore...");
          for (const p of DEFAULT_ADMIN_PERIODS) {
            await setDoc(doc(db, 'admin_periods_config', p.id), p);
          }
        }

        // Check and seed schedules
        const scheduleSnap = await getDocs(schedulesColRef);
        if (scheduleSnap.empty) {
          console.log("Seeding schedules collection in Firestore...");
          const batchToSeed = getSchedulesToSeed();
          for (const s of batchToSeed) {
            await setDoc(doc(db, 'schedules', s.id), s);
          }
        }

        // Setup real-time listeners
        unsubscribePeriods = onSnapshot(periodsColRef, (snapshot) => {
          const list: AdminPeriodConfig[] = [];
          snapshot.forEach((docSnap) => {
            list.push({ id: docSnap.id, ...docSnap.data() } as AdminPeriodConfig);
          });
          setPeriods(list.sort((a, b) => a.periodNumber - b.periodNumber));
        }, (err) => {
          console.error("Error listening to admin_periods_config:", err);
          setError(err.message);
        });

        unsubscribeSchedules = onSnapshot(schedulesColRef, (snapshot) => {
          const list: ScheduleItem[] = [];
          snapshot.forEach((docSnap) => {
            list.push({ id: docSnap.id, ...docSnap.data() } as ScheduleItem);
          });
          setSchedules(list);
          setLoading(false);
        }, (err) => {
          console.error("Error listening to schedules:", err);
          setError(err.message);
          setLoading(false);
        });

      } catch (err: any) {
        console.error("Error setting up Firestore sync:", err);
        setError(err.message);
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
    try {
      const docRef = doc(db, 'schedules', scheduleId);
      await setDoc(docRef, { attendanceTaken: status }, { merge: true });
    } catch (err: any) {
      console.error("Error updating schedule attendance:", err);
      throw err;
    }
  };

  const updatePartnerAttendance = async (scheduleId: string, status: boolean) => {
    try {
      const docRef = doc(db, 'schedules', scheduleId);
      await setDoc(docRef, { partnerCheckedAttendance: status }, { merge: true });
    } catch (err: any) {
      console.error("Error updating partner attendance:", err);
      throw err;
    }
  };

  return { periods, schedules, loading, error, updateScheduleAttendance, updatePartnerAttendance };
}
