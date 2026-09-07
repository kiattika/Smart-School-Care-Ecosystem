import { useEffect, useMemo, useState } from 'react';
import { ElectiveActivityConfig } from '../types';
import { subscribeElectiveActivityConfigs, subscribeActivityEnrollmentCounts } from '../services/firestoreService';

/**
 * รายการชุมนุม/กิจกรรมตามความสนใจ (ELECTIVE) ที่แอดมินงานชุมนุมสร้างไว้ + ตัวนับที่นั่งปัจจุบัน
 * ของแต่ละชุมนุมแบบ real-time — ใช้ทั้งฝั่งแอดมิน (ตั้งค่า), นักเรียน (สมัคร/ดูที่นั่งเหลือ), และ
 * ครูรับผิดชอบ (เช็คว่าตัวเองรับผิดชอบชุมนุมไหนอยู่ — ดู TeacherPortal.tsx)
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

  const configById = useMemo(() => {
    const map = new Map<string, ElectiveActivityConfig>();
    configs.forEach(c => map.set(c.id, c));
    return map;
  }, [configs]);

  // ครูรับผิดชอบ 1 คนอาจดูแลได้มากกว่า 1 ชุมนุม (ไม่บังคับ 1:1) — เผื่อกรณีนี้ไว้แม้ยังไม่มี UI
  // เลือกเมื่อมีหลายชุมนุม (ดู TeacherPortal.tsx — ใช้ตัวแรกไปก่อนถ้ามีมากกว่า 1)
  const configsByTeacherUid = useMemo(() => {
    const map = new Map<string, ElectiveActivityConfig[]>();
    configs.forEach(c => {
      const list = map.get(c.responsibleTeacherUid) || [];
      list.push(c);
      map.set(c.responsibleTeacherUid, list);
    });
    return map;
  }, [configs]);

  const seatsRemaining = (activityId: string): number | null => {
    const config = configById.get(activityId);
    if (!config) return null;
    const enrolled = counts[activityId] || 0;
    return Math.max(0, config.capacity - enrolled);
  };

  return { configs, configById, configsByTeacherUid, counts, seatsRemaining, loading };
}
