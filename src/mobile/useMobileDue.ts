import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import type { Student } from '../types';
import { useCurrentSemester } from '../hooks/useCurrentSemester';
import { subscribeSDQAssessments, subscribeSemesterHealthLogs } from '../services/firestoreService';
import { readDocOrNull } from '../services/screeningService';
import { isTwoQDue, type MobileDueStatus } from '../lib/mobileDue';

/**
 * สถานะแบบประเมินของนักเรียน/ผู้ปกครองสำหรับเมนูมือถือ — อ่านจาก Firestore จริง (ไม่ใช่ Zustand ที่ว่างทุกเซสชัน)
 * ค่ายังไม่รู้ = undefined → เมนูนั้นซ่อนไว้ก่อน; `refresh()` ใช้ตอนกลับจากหน้าทำแบบประเมิน (2Q อ่านครั้งเดียว ไม่ live)
 */
export function useMobileDue(opts: { role: 'student' | 'parent' | null; uid: string | undefined; child: Student | undefined }): { due: MobileDueStatus; refresh: () => void } {
  const { role, uid, child } = opts;
  const sem = useCurrentSemester();
  const [healthDone, setHealthDone] = useState<boolean | undefined>(undefined);
  const [sdqDone, setSdqDone] = useState<boolean | undefined>(undefined);
  const [twoQDue, setTwoQDue] = useState<boolean | undefined>(undefined);
  const [tick, setTick] = useState(0);
  const studentId = child?.studentId;

  useEffect(() => {
    if (role !== 'student' || !uid || !studentId || sem.loading) { setHealthDone(undefined); return; }
    return subscribeSemesterHealthLogs(
      logs => setHealthDone(logs.some(l => l.studentId === studentId && l.academicYear === sem.academicYear && l.term === sem.term)),
      { studentUid: uid },
    );
  }, [role, uid, studentId, sem.loading, sem.academicYear, sem.term]);

  useEffect(() => {
    if (!role || !uid || !studentId || sem.loading) { setSdqDone(undefined); return; }
    const evaluator = role === 'parent' ? 'PARENT' : 'STUDENT';
    return subscribeSDQAssessments(
      list => setSdqDone(list.some(a => a.studentId === studentId && a.evaluatorType === evaluator && a.academicYear === sem.academicYear)),
      role === 'parent' ? { respondentUid: uid } : { studentUid: uid },
    );
  }, [role, uid, studentId, sem.loading, sem.academicYear]);

  useEffect(() => {
    if (role !== 'student' || !studentId) { setTwoQDue(undefined); return; }
    let cancelled = false;
    readDocOrNull<{ conductedAt?: string }>(`student_screenings_2q/${studentId}`)
      .then(d => { if (!cancelled) setTwoQDue(isTwoQDue(d?.conductedAt, format(new Date(), 'yyyy-MM-dd'))); })
      .catch(() => { if (!cancelled) setTwoQDue(undefined); }); // อ่านไม่ได้ = ไม่เดา ซ่อนไว้
    return () => { cancelled = true; };
  }, [role, studentId, tick]);

  return { due: { healthDone, sdqDone, twoQDue }, refresh: () => setTick(t => t + 1) };
}
