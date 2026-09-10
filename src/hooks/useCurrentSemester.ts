import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

/**
 * ภาคเรียนปัจจุบันของโรงเรียน — อ่านจาก school_settings/academic_year (จุดเดียวกับที่หน้า
 * "ตั้งค่าระบบและการล็อก" (SystemSettingsAndLocksPage) เขียน) แบบ real-time
 *
 * ถ้ายังไม่มีใครตั้งค่าไว้ ใช้ fallback จากเดือนปัจจุบัน (พ.ค.–ต.ค. = ภาคเรียน 1, ที่เหลือ = ภาคเรียน 2)
 * — ใช้เป็นค่าอ้างอิงเท่านั้น ไม่ได้เขียนอะไรกลับ
 */
export interface CurrentSemester {
  academicYear: string; // พ.ศ. เช่น "2569"
  term: '1' | '2';
  /** ป้ายแสดงผล เช่น "1/2569" */
  label: string;
  loading: boolean;
  /** true = มาจาก school_settings/academic_year จริง, false = fallback จากวันที่ */
  isConfigured: boolean;
}

function dateFallback(): { academicYear: string; term: '1' | '2' } {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const term: '1' | '2' = month >= 5 && month <= 10 ? '1' : '2';
  // ม.ค.–เม.ย. ยังนับเป็นปีการศึกษาที่เปิดเมื่อ พ.ค. ปีก่อนหน้า
  const gregYear = month <= 4 ? now.getFullYear() - 1 : now.getFullYear();
  return { academicYear: String(gregYear + 543), term };
}

export function useCurrentSemester(): CurrentSemester {
  const [state, setState] = useState<Omit<CurrentSemester, 'label'>>(() => ({
    ...dateFallback(),
    loading: true,
    isConfigured: false,
  }));

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'school_settings', 'academic_year'),
      (snap) => {
        const data = snap.exists() ? snap.data() : null;
        if (data?.academicYear && (data?.semester === '1' || data?.semester === '2')) {
          setState({ academicYear: String(data.academicYear), term: data.semester, loading: false, isConfigured: true });
        } else {
          setState({ ...dateFallback(), loading: false, isConfigured: false });
        }
      },
      () => setState({ ...dateFallback(), loading: false, isConfigured: false }),
    );
    return unsub;
  }, []);

  return { ...state, label: `${state.term}/${state.academicYear}` };
}
