import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { GradeLockLike } from '../lib/gradeLockWindow';

/** school_settings/system_locks (อ่านได้ทุกคนที่ล็อกอิน) — อ่านไม่ได้/ไม่มี = รายการว่าง (ไม่แสดงตัวนับ ไม่เดา) */
export function useGradeLocks(): GradeLockLike[] {
  const [locks, setLocks] = useState<GradeLockLike[]>([]);
  useEffect(() => {
    return onSnapshot(
      doc(db, 'school_settings', 'system_locks'),
      (snap) => {
        const data = snap.exists() ? snap.data() : null;
        setLocks(data && Array.isArray(data.lockConfigs) ? (data.lockConfigs as GradeLockLike[]) : []);
      },
      (err) => { console.warn('[useGradeLocks] listener notice:', err.message); setLocks([]); },
    );
  }, []);
  return locks;
}
