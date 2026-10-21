import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import { useGradeLocks } from './useGradeLocks';
import { useActivityWindows } from './useActivityWindows';
import { subscribeLateAttendanceRequests, subscribeElectiveActivityConfigs } from '../services/firestoreService';
import { activityWindowEntries, clubEntries, gradeLockEntries, lateAttendanceEntries, topCountdowns, type CountdownEntry } from '../lib/countdownRegistry';
import type { LateAttendanceRequestRecord, ElectiveActivityConfig } from '../types';

/**
 * ตัวนับถอยหลังของฉัน (ใกล้สุด 3 อันดับ) — แหล่งตามประเภทผู้ใช้:
 *  บุคลากร: ล็อกระบบกรอกคะแนน/ประเมิน + คำขอเช็คชื่อย้อนหลังของฉันที่ยังใช้สิทธิ์ได้ (query ด้วย teacherId = uid ตาม rules)
 *  นักเรียน: ชุมนุมที่เปิดรับและมีเวลาปิด
 *  ผู้ปกครอง: SDQ รอบ 1 (ช่วงที่แอดมินตั้ง)
 * ข้อมูลว่าง/อ่านไม่ได้ = ไม่แสดง (ไม่เดา)
 */
export function useAppCountdowns(): CountdownEntry[] {
  const user = useStore((s) => s.user);
  const isStudent = user?.role === 'student';
  const isParent = user?.role === 'parent';
  const isStaff = !!user?.uid && !isStudent && !isParent;

  const locks = useGradeLocks();
  const windows = useActivityWindows();
  const [clubConfigs, setClubConfigs] = useState<ElectiveActivityConfig[]>([]);
  const [late, setLate] = useState<LateAttendanceRequestRecord[]>([]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isStaff || !user?.uid) { setLate([]); return; }
    return subscribeLateAttendanceRequests(setLate, { teacherId: user.uid });
  }, [isStaff, user?.uid]);

  // ชุมนุม: ฟังเฉพาะนักเรียน (ไม่เพิ่ม listener ให้บุคลากร/ผู้ปกครอง)
  useEffect(() => {
    if (!isStudent) { setClubConfigs([]); return; }
    return subscribeElectiveActivityConfigs(setClubConfigs);
  }, [isStudent]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  return useMemo(() => {
    const all: CountdownEntry[] = [];
    if (isStaff) {
      all.push(...gradeLockEntries(locks, now));
      all.push(...lateAttendanceEntries(late as any, now));
      all.push(...activityWindowEntries(windows, ['LESSON_PLAN', 'SDQ_ROUND1'], now));
    }
    if (isStudent) {
      all.push(...clubEntries(clubConfigs as any, now));
      all.push(...activityWindowEntries(windows, ['CLUB_ENROLLMENT', 'SDQ_ROUND1'], now));
    }
    if (isParent) all.push(...activityWindowEntries(windows, ['SDQ_ROUND1'], now));
    return topCountdowns(all, now);
  }, [isStaff, isStudent, isParent, locks, windows, late, clubConfigs, now]);
}
