import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useStore } from '../store';
import { format } from 'date-fns';

export interface HomeroomAttendanceRecord {
  id: string; // "YYYY-MM-DD_Room"
  date: string; // "YYYY-MM-DD"
  room: string; // "ม.5/8"
  checkedByEmail: string;
  checkedByName: string;
  checkedAt: string; // ISO or formatted string
  isLocked: boolean;
  requestedEditBy?: string | null;
  unlockedAt?: string | null;
  students: Record<string, 'PRESENT' | 'LATE' | 'ABSENT' | 'LEAVE'>;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function useHomeroomAttendance(date: string, room: string) {
  const [record, setRecord] = useState<HomeroomAttendanceRecord | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const { 
    user, 
    updateMorningAttendance, 
    setAttendanceStatus,
    courses 
  } = useStore();

  const formattedRoom = room ? room.replace('/', '-') : '';
  const docId = `${date}_${formattedRoom}`;
  const docPath = `attendance_records/${docId}`;

  // Listen to the homeroom attendance record for real-time locking
  useEffect(() => {
    if (!date || !room) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const docRef = doc(db, 'attendance_records', docId);

    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as HomeroomAttendanceRecord;
        setRecord(data);

        // Sync local morning attendance store with Firestore state
        if (data.students) {
          Object.entries(data.students).forEach(([studentId, status]) => {
            updateMorningAttendance(studentId, status, 'MANUAL');
          });
        }
      } else {
        setRecord(null);
      }
      setLoading(false);
    }, (err) => {
      console.warn('Notice: Firestore listener error in useHomeroomAttendance:', err.message);
      setError(err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [date, room, docId, updateMorningAttendance]);

  // Save homeroom attendance & cascade status
  const saveHomeroomAttendance = async (
    studentsAttendance: Record<string, 'PRESENT' | 'LATE' | 'ABSENT' | 'LEAVE'>
  ) => {
    if (!date || !room) return;

    const teacherName = user?.displayName || user?.email?.split('@')[0] || 'Mr.Kiattisak';
    const teacherEmail = user?.email || 'kiattisak@utd.ac.th';

    const payload: HomeroomAttendanceRecord = {
      id: docId,
      date,
      room,
      checkedByEmail: teacherEmail,
      checkedByName: teacherName,
      checkedAt: format(new Date(), 'HH:mm'),
      isLocked: true,
      requestedEditBy: null,
      students: studentsAttendance,
    };

    try {
      const docRef = doc(db, 'attendance_records', docId);
      await setDoc(docRef, payload, { merge: true });

      // 1. Sync to local state
      Object.entries(studentsAttendance).forEach(([studentId, status]) => {
        updateMorningAttendance(studentId, status, 'MANUAL');
      });

      // 2. Default Cascading Logic:
      // If student is ABSENT or LEAVE, automatically set their attendance status
      // in subsequent main courses (คาบ 1-8) of that classroom to ABSENT or LEAVE.
      // Let's filter courses matching this class (e.g. "ม.5/8" or "M.5/8")
      const classKeyClean = room.replace(/^ม\./i, 'M.').toLowerCase();

      courses.forEach((course) => {
        const courseRoomClean = (course.room || '').replace(/^ม\./i, 'M.').toLowerCase();
        if (courseRoomClean === classKeyClean || course.room === room) {
          Object.entries(studentsAttendance).forEach(([studentId, status]) => {
            if (status === 'ABSENT' || status === 'LEAVE') {
              setAttendanceStatus(course.id, studentId, status);
            }
          });
        }
      });

    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      handleFirestoreError(err, OperationType.WRITE, docPath);
    }
  };

  // Request Edit / Unlock editing
  const requestUnlock = async () => {
    try {
      const docRef = doc(db, 'attendance_records', docId);
      await updateDoc(docRef, {
        isLocked: false,
        requestedEditBy: user?.email || 'kiattika@utd.ac.th',
        unlockedAt: format(new Date(), 'HH:mm')
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      handleFirestoreError(err, OperationType.UPDATE, docPath);
    }
  };

  return {
    record,
    loading,
    error,
    saveHomeroomAttendance,
    requestUnlock
  };
}
