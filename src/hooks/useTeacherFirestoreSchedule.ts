import { useEffect, useState } from 'react';
import { collection, onSnapshot, getDocs, doc, setDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { TEACHING_LOAD_DATA } from '../data/teachingLoadData';
import { parseThaiSchedule } from '../lib/utils';

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
  if (email1.toLowerCase() === email2.toLowerCase()) return true;
  const kiattisakEmails = ['kiattisak@utd.ac.th', 'kiattika@utd.ac.th', 'kiattika@gmail.com', 'teacher@utd.ac.th'];
  if (kiattisakEmails.includes(email1.toLowerCase()) && kiattisakEmails.includes(email2.toLowerCase())) return true;
  return false;
};

// Helper to generate the default schedules cleanly
const getSchedulesToSeed = (): ScheduleItem[] => {
  const items: ScheduleItem[] = [];

  TEACHING_LOAD_DATA.forEach(teacher => {
    const email = teacher.teacherEmail || `${teacher.teacherName.toLowerCase().replace(/[^a-z0-9]/g, '')}@utd.ac.th`;

    teacher.subjects.forEach((subj) => {
      const segments = parseThaiSchedule(subj.schedule);
      segments.forEach(seg => {
        const daySuffix = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'][seg.day === 0 ? 6 : seg.day - 1] || `d${seg.day}`;
        const isAct = subj.subjectCode === 'HR' || subj.subjectCode === 'CZ';
        const cleanEmail = email.replace(/[@.]/g, '-');
        const cleanCode = subj.subjectCode.replace(/[^a-zA-Z0-9\u0E00-\u0E7F]/g, '');
        const cleanClass = subj.level.replace(/[^a-zA-Z0-9]/g, '');

        const itemData: ScheduleItem = {
          id: `sched-${cleanEmail}-${cleanCode}-${cleanClass}-${daySuffix}-p${seg.periodIndex}`,
          courseCode: subj.subjectCode,
          courseName: subj.subjectName,
          periodNumber: seg.periodIndex,
          scheduleDay: seg.day,
          room: subj.room,
          targetClass: subj.level,
          type: isAct ? 'ACTIVITY' : 'MAIN',
          teacherEmail: email,
          teacherName: teacher.teacherName,
          teachingPartner: subj.subjectCode === 'HR' ? 'Mrs. Koy K.' : null,
          partnerCheckedAttendance: false,
          attendanceTaken: false,
          studentsCount: subj.level.includes('5/8') ? 40 : subj.level.includes('5/9') ? 38 : subj.level.includes('5/11') ? 42 : 35
        };

        items.push(itemData);
      });
    });
  });

  return items;
};

// Helper to remove any undefined properties from an object before saving to Firestore
const sanitizeForFirestore = <T extends Record<string, any>>(obj: T): Partial<T> => {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== undefined)
  ) as Partial<T>;
};

export function useTeacherFirestoreSchedule() {
  const [periods, setPeriods] = useState<AdminPeriodConfig[]>(DEFAULT_ADMIN_PERIODS);
  const [schedules, setSchedules] = useState<ScheduleItem[]>(() => getSchedulesToSeed());
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribePeriods = () => {};
    let unsubscribeSchedules = () => {};

    const syncData = async () => {
      try {
        const periodsColRef = collection(db, 'admin_periods_config');
        const schedulesColRef = collection(db, 'schedules');

        // Check and seed periods safely if user has authenticated write permission
        if (auth.currentUser) {
          try {
            const periodSnap = await getDocs(periodsColRef);
            if (periodSnap.empty) {
              for (const p of DEFAULT_ADMIN_PERIODS) {
                await setDoc(doc(db, 'admin_periods_config', p.id), sanitizeForFirestore(p), { merge: true });
              }
            }

            const scheduleSnap = await getDocs(schedulesColRef);
            const batchToSeed = getSchedulesToSeed();
            if (scheduleSnap.empty) {
              for (const s of batchToSeed) {
                await setDoc(doc(db, 'schedules', s.id), sanitizeForFirestore(s), { merge: true });
              }
            }
          } catch (seedErr) {
            // Non-fatal seed error (e.g. read-only user)
            console.warn("Notice: Firestore schedule auto-seeder bypassed:", seedErr);
          }
        }

        // Setup real-time listeners
        unsubscribePeriods = onSnapshot(periodsColRef, (snapshot) => {
          if (!snapshot.empty) {
            const list: AdminPeriodConfig[] = [];
            snapshot.forEach((docSnap) => {
              list.push({ id: docSnap.id, ...docSnap.data() } as AdminPeriodConfig);
            });
            setPeriods(list.sort((a, b) => a.periodNumber - b.periodNumber));
          }
        }, (err) => {
          console.warn("Notice: admin_periods_config listener fallback to defaults:", err.message);
        });

        unsubscribeSchedules = onSnapshot(schedulesColRef, (snapshot) => {
          if (!snapshot.empty) {
            const list: ScheduleItem[] = [];
            snapshot.forEach((docSnap) => {
              list.push({ id: docSnap.id, ...docSnap.data() } as ScheduleItem);
            });
            setSchedules(list);
          }
          setLoading(false);
        }, (err) => {
          console.warn("Notice: schedules listener fallback to defaults:", err.message);
          setLoading(false);
        });

      } catch (err: any) {
        console.warn("Notice: Using local schedule fallback:", err.message);
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
      // Update local state immediately
      setSchedules(prev => prev.map(s => s.id === scheduleId ? { ...s, attendanceTaken: status } : s));
    } catch (err: any) {
      console.warn("Local update fallback for schedule attendance:", err.message);
      setSchedules(prev => prev.map(s => s.id === scheduleId ? { ...s, attendanceTaken: status } : s));
    }
  };

  const updatePartnerAttendance = async (scheduleId: string, status: boolean) => {
    try {
      const docRef = doc(db, 'schedules', scheduleId);
      await setDoc(docRef, { partnerCheckedAttendance: status }, { merge: true });
      // Update local state immediately
      setSchedules(prev => prev.map(s => s.id === scheduleId ? { ...s, partnerCheckedAttendance: status } : s));
    } catch (err: any) {
      console.warn("Local update fallback for partner attendance:", err.message);
      setSchedules(prev => prev.map(s => s.id === scheduleId ? { ...s, partnerCheckedAttendance: status } : s));
    }
  };

  return { periods, schedules, loading, error, updateScheduleAttendance, updatePartnerAttendance };
}
