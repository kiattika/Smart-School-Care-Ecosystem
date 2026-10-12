import { useEffect, useState } from 'react';
import type { StudentHomeVisitInfo, FamilyHomeVisitInfo, HomeVisitRecord } from '../types';
import {
  subscribeStudentHomeVisitInfo, subscribeFamilyHomeVisitInfo,
  subscribeStudentHomeVisitInfoByRoom, subscribeFamilyHomeVisitInfoByRoom,
  subscribeAllHomeVisitRecords, subscribeAllStudentHomeVisitInfo, subscribeAllFamilyHomeVisitInfo,
} from '../services/firestoreService';

type Sub<T> = (cb: (v: T) => void) => () => void;
function useSub<T>(init: T, make: (() => Sub<T> | null), deps: unknown[]): { data: T; loading: boolean } {
  const [data, setData] = useState<T>(init);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const sub = make();
    if (!sub) { setData(init); setLoading(false); return; }
    setLoading(true);
    return sub((v) => { setData(v); setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { data, loading };
}

/** นักเรียนคนเดียว (หน้านักเรียน/ผู้ปกครอง) */
export const useStudentHomeVisitInfo = (studentId?: string) =>
  useSub<StudentHomeVisitInfo | null>(null, () => (studentId ? (cb) => subscribeStudentHomeVisitInfo(studentId, cb) : null), [studentId]);
export const useFamilyHomeVisitInfo = (studentId?: string) =>
  useSub<FamilyHomeVisitInfo | null>(null, () => (studentId ? (cb) => subscribeFamilyHomeVisitInfo(studentId, cb) : null), [studentId]);

/** ทั้งห้อง (ครูที่ปรึกษา) */
export const useRoomStudentHomeVisitInfo = (room?: string) =>
  useSub<StudentHomeVisitInfo[]>([], () => (room ? (cb) => subscribeStudentHomeVisitInfoByRoom(room, cb) : null), [room]);
export const useRoomFamilyHomeVisitInfo = (room?: string) =>
  useSub<FamilyHomeVisitInfo[]>([], () => (room ? (cb) => subscribeFamilyHomeVisitInfoByRoom(room, cb) : null), [room]);

/** ทั้งโรงเรียน (ผู้บริหาร — สรุปเป็นจำนวนเท่านั้น) */
export const useSchoolHomeVisitData = () => ({
  records: useSub<HomeVisitRecord[]>([], () => subscribeAllHomeVisitRecords, []).data,
  studentInfo: useSub<StudentHomeVisitInfo[]>([], () => subscribeAllStudentHomeVisitInfo, []).data,
  familyInfo: useSub<FamilyHomeVisitInfo[]>([], () => subscribeAllFamilyHomeVisitInfo, []).data,
});
