import { useEffect, useMemo, useState } from 'react';
import { ElectiveActivityConfig } from '../types';
import { subscribeElectiveActivityConfigs, subscribeActivityEnrollmentCounts } from '../services/firestoreService';

/**
 * รายการ subjectCode ที่ถูกตั้งเป็น ELECTIVE (ชุมนุม/กิจกรรมตามความสนใจ) + ตัวนับที่นั่งปัจจุบัน
 * ของทุก section (scheduleId) แบบ real-time — ใช้ทั้งฝั่งแอดมิน (ตั้งค่า), นักเรียน (สมัคร/ดูที่นั่ง
 * เหลือ), และครู (เช็คว่า course ของตัวเองเป็น ELECTIVE ไหม)
 */
export function useElectiveActivities() {
  const [configs, setConfigs] = useState<ElectiveActivityConfig[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeElectiveActivityConfigs((list) => {
      setConfigs(list);
      setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    return subscribeActivityEnrollmentCounts(setCounts);
  }, []);

  const configBySubjectCode = useMemo(() => {
    const map = new Map<string, ElectiveActivityConfig>();
    configs.forEach(c => map.set(c.subjectCode, c));
    return map;
  }, [configs]);

  const isElective = (subjectCode?: string | null) => !!subjectCode && configBySubjectCode.has(subjectCode);

  const seatsRemaining = (scheduleId: string, subjectCode?: string | null): number | null => {
    const config = subjectCode ? configBySubjectCode.get(subjectCode) : undefined;
    if (!config || config.capacityPerSection === null) return null; // ไม่จำกัด
    const enrolled = counts[scheduleId] || 0;
    return Math.max(0, config.capacityPerSection - enrolled);
  };

  return { configs, configBySubjectCode, counts, isElective, seatsRemaining, loading };
}
