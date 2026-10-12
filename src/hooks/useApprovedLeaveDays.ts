import { useEffect, useMemo, useState } from 'react';
import { subscribeApprovedLeaveDays } from '../services/firestoreService';
import { leaveStudentIdsOn } from '../lib/leaveAttendance';
import type { StudentLeaveDay } from '../types';

/** นักเรียนที่ลา (อนุมัติแล้ว) ในวัน ymd — สดจาก Firestore; อ่านไม่ได้/ว่าง = เซ็ตว่าง (ไม่เดา) */
export function useLeaveStudentIds(ymd: string): ReadonlySet<string> {
  const [days, setDays] = useState<StudentLeaveDay[]>([]);
  useEffect(() => subscribeApprovedLeaveDays(setDays, ymd), [ymd]);
  return useMemo(() => leaveStudentIdsOn(days, ymd), [days, ymd]);
}
