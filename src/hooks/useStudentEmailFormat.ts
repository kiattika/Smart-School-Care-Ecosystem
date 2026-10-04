import { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { StudentEmailFormat, sanitizeStudentEmailFormat } from '../lib/studentEmailFormat';

/**
 * รูปแบบอีเมลนักเรียนแบบ real-time จาก school_settings/studentEmailFormat — config ตัวเดียวกับที่ blocking function
 * ใช้ตอน login. ไม่มี doc / อ่านไม่ได้ / ผิดรูปแบบ = ค่าเริ่มต้นเดิม (it / utd.ac.th) ไม่ throw
 * (ค่าเริ่มต้นแสดงระหว่างโหลดด้วย — loading บอกว่ายังไม่ได้ค่าจริง)
 */
export function useStudentEmailFormat(): { format: StudentEmailFormat; loading: boolean; exists: boolean } {
  const [raw, setRaw] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onSnapshot(
      doc(db, 'school_settings', 'studentEmailFormat'),
      (snap) => {
        setRaw(snap.exists() ? snap.data() : null);
        setLoading(false);
      },
      (err) => {
        console.warn('[useStudentEmailFormat] listener notice — using default format:', err.message);
        setRaw(null);
        setLoading(false);
      },
    );
  }, []);

  const sanitized = sanitizeStudentEmailFormat(raw);
  // identity คงที่ตราบใดที่ prefix/domain ไม่เปลี่ยน — ใช้เป็น dependency ของ useMemo/useEffect ได้
  const format = useMemo(() => sanitized, [sanitized.prefix, sanitized.domain]); // eslint-disable-line react-hooks/exhaustive-deps
  return { format, loading, exists: raw !== null };
}
