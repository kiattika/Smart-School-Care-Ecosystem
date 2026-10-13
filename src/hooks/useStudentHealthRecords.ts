import { useEffect, useState } from 'react';
import { subscribeStudentCheckups, subscribeStudentVaccinations, subscribeBloodDonations } from '../services/firestoreService';
import type { StudentCheckup, StudentVaccination, BloodDonation } from '../lib/healthRecords';

/** ผลตรวจสายตา/การได้ยิน + วัคซีน + บริจาคโลหิตของนักเรียนหนึ่งคน (อ่านตามทะเบียน studentId) — undefined = กำลังโหลด */
export function useStudentHealthRecords(studentId: string | undefined) {
  const [checkups, setCheckups] = useState<StudentCheckup[] | undefined>(undefined);
  const [vaccinations, setVaccinations] = useState<StudentVaccination[] | undefined>(undefined);
  const [donations, setDonations] = useState<BloodDonation[] | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setCheckups(undefined); setVaccinations(undefined); setDonations(undefined); setError(null);
    if (!studentId) return;
    const onErr = (e: Error) => setError(e.message);
    const u1 = subscribeStudentCheckups(studentId, setCheckups, (e) => { onErr(e); setCheckups([]); });
    const u2 = subscribeStudentVaccinations(studentId, setVaccinations, (e) => { onErr(e); setVaccinations([]); });
    const u3 = subscribeBloodDonations(setDonations, { studentId }, (e) => { onErr(e); setDonations([]); });
    return () => { u1(); u2(); u3(); };
  }, [studentId]);
  return { checkups, vaccinations, donations, error };
}
