import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ElectiveActivityConfig } from '../types';
import { useElectiveActivities } from './useElectiveActivities';

export interface ElectiveSection {
  scheduleId: string;
  subjectCode: string;
  name: string;
  teacherName: string;
  dayOfWeek: string;
  periodNumber: number;
  room: string;
  capacityPerSection: number | null;
  enrolledCount: number;
  seatsRemaining: number | null; // null = ไม่จำกัด
}

/**
 * รวม elective_activities_config (ตั้งค่า ELECTIVE + capacity) เข้ากับ schedules จริง (แต่ละ
 * section/scheduleId) + ตัวนับที่นั่งปัจจุบัน — ให้หน้านักเรียนเห็นรายการชุมนุมที่เปิดรับ พร้อม
 * ที่นั่งเหลือ แบบ real-time
 */
export function useElectiveSections() {
  const { configs, counts, loading: configsLoading } = useElectiveActivities();
  const [schedules, setSchedules] = useState<Record<string, any>[]>([]);
  const [schedulesLoading, setSchedulesLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'schedules'), (snap) => {
      setSchedules(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setSchedulesLoading(false);
    }, (err) => {
      console.warn('[useElectiveSections] schedules listener:', err.message);
      setSchedulesLoading(false);
    });
    return unsub;
  }, []);

  const sections: ElectiveSection[] = useMemo(() => {
    const configByCode = new Map<string, ElectiveActivityConfig>(configs.map(c => [c.subjectCode, c]));
    return schedules
      .filter(s => configByCode.has(s.subjectCode))
      .map(s => {
        const config = configByCode.get(s.subjectCode)!;
        const enrolledCount = counts[s.id] || 0;
        const seatsRemaining = config.capacityPerSection === null
          ? null
          : Math.max(0, config.capacityPerSection - enrolledCount);
        return {
          scheduleId: s.id,
          subjectCode: s.subjectCode,
          name: s.subjectName || config.name,
          teacherName: s.sourceTeacherName || s.teacherName || s.unlinkedTeacherName || 'ครูผู้สอน',
          dayOfWeek: s.dayOfWeek || '',
          periodNumber: Number(s.periodNumber) || 0,
          room: s.room || s.level || '',
          capacityPerSection: config.capacityPerSection,
          enrolledCount,
          seatsRemaining,
        } as ElectiveSection;
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'th'));
  }, [schedules, configs, counts]);

  return { sections, loading: configsLoading || schedulesLoading };
}
