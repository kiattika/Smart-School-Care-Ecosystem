import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { DepartmentConfig } from '../types';
import { DEFAULT_DEPARTMENTS } from '../lib/departments';

/**
 * รายชื่อกลุ่มสาระฯ/กลุ่มงาน จาก Firestore `department_config` แบบ real-time
 * — เดิม hardcode เป็น array; ตอนนี้แอดมินแก้ไขได้ผ่านเมนู แล้วสะท้อนทุกที่ทันที
 *
 * ถ้า Firestore ยังว่าง (ยังไม่ seed) จะ fallback เป็น DEFAULT_DEPARTMENTS
 * เพื่อให้หน้าจอไม่ว่างระหว่างตั้งค่าครั้งแรก
 */
const FALLBACK: DepartmentConfig[] = DEFAULT_DEPARTMENTS.map(d => ({ ...d, active: true }));

export function useDepartments() {
  const [departments, setDepartments] = useState<DepartmentConfig[]>(FALLBACK);
  const [loading, setLoading] = useState(true);
  const [isFallback, setIsFallback] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'department_config'),
      (snap) => {
        if (snap.empty) {
          setDepartments(FALLBACK);
          setIsFallback(true);
        } else {
          const list = snap.docs
            .map(d => ({ id: d.id, ...d.data() } as DepartmentConfig))
            .filter(d => d.active !== false)
            .sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.name.localeCompare(b.name, 'th'));
          setDepartments(list);
          setIsFallback(false);
        }
        setLoading(false);
      },
      (err) => {
        console.warn('[useDepartments] listener error:', err.message);
        setDepartments(FALLBACK);
        setIsFallback(true);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const nameOf = (id?: string | null) =>
    (id && departments.find(d => d.id === id)?.name) || 'ไม่ได้ระบุกลุ่มสาระฯ';

  return { departments, loading, isFallback, nameOf };
}
