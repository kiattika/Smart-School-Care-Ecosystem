import { useEffect, useState } from 'react';
import { subscribeStudentBloodType, type StudentBloodTypeDoc } from '../services/firestoreService';

/** undefined = กำลังโหลด, null = ยังไม่เคยระบุ (ยังเลือกได้) */
export function useStudentBloodType(studentId: string | undefined) {
  const [doc, setDoc] = useState<StudentBloodTypeDoc | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setDoc(undefined); setError(null);
    if (!studentId) return;
    return subscribeStudentBloodType(studentId, setDoc, (e) => { setError(e.message); setDoc(null); });
  }, [studentId]);
  return { doc, error };
}
