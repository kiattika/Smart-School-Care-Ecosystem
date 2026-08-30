import { useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useStore } from '../store';
import {
  subscribeSubstituteAssignments,
  subscribePostTeachingRecords,
} from '../services/firestoreService';
import { UserProfile, UserRole } from '../types';

/**
 * เชื่อม real-time listener ของ Firestore เข้ากับ store:
 * - staff              → staffDirectory (รายชื่อบุคลากรจริง, ใช้แทน ALL_TEACHERS hardcode)
 * - substitute_assignments → substituteAssignments (งานจัดครูสอนแทน + approval chain)
 * - post_teaching_records  → postTeachingRecords
 *
 * เรียกครั้งเดียวหลังผู้ใช้ล็อกอิน (ใน App.tsx) — ทุก listener เป็น read-only
 */
export function useSubstituteSync(enabled: boolean) {
  const setStaffDirectory = useStore(s => s.setStaffDirectory);
  const setSubstituteAssignments = useStore(s => s.setSubstituteAssignments);
  const setPostTeachingRecords = useStore(s => s.setPostTeachingRecords);

  useEffect(() => {
    if (!enabled) return;

    const unsubStaff = onSnapshot(
      collection(db, 'staff'),
      (snap) => {
        const list: UserProfile[] = snap.docs.map(d => {
          const data = d.data() as any;
          const roles: UserRole[] =
            Array.isArray(data.roles) && data.roles.length > 0
              ? data.roles
              : ['SUBJECT_TEACHER'];
          return {
            id: d.id,
            email: data.email || '',
            prefix: data.prefix || '',
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            position: data.position || 'ครูผู้สอน',
            roles,
            assignments: data.assignments || {
              departmentId: data.departmentId || '',
              homeroomClass: data.homeroomClass || '',
              teachingSubjects: data.teachingSubjects || [],
              supervisoryMentees: data.supervisoryMentees || [],
            },
          };
        });
        setStaffDirectory(list);
      },
      (err) => console.warn('[useSubstituteSync] staff listener notice:', err.message)
    );

    const unsubSubs = subscribeSubstituteAssignments(setSubstituteAssignments);
    const unsubPtr = subscribePostTeachingRecords(setPostTeachingRecords);

    return () => {
      unsubStaff();
      unsubSubs();
      unsubPtr();
    };
  }, [enabled, setStaffDirectory, setSubstituteAssignments, setPostTeachingRecords]);
}
