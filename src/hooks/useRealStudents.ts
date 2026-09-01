import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, Query, CollectionReference } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Student } from '../types';

/**
 * Live real-time listener สำหรับ collection `students` ใน Firestore
 *
 * ทำไมต้องมี hook นี้: หน้าเดิม (AdvisorPortal ฯลฯ) อ่านรายชื่อนักเรียนจาก Zustand store
 * ซึ่งจะมีข้อมูลก็ต่อเมื่อ "มีคน import ในเซสชันเบราว์เซอร์เดียวกัน" เท่านั้น พอเปิดใหม่/ล็อกอินใหม่/
 * คนละเครื่อง store จะว่าง → หน้าจอขึ้น "ไม่มีข้อมูล" ทั้งที่ Firestore มีข้อมูลครบ
 * (ผิดกฎ CLAUDE.md: ข้อมูลต้อง sync จาก Firestore สด ไม่ใช่ session-local state)
 *
 * ใช้ mapping ชุดเดียวกับ StudentManagementPage.tsx / BulkDataImportModal payload
 * แล้ว normalize ให้ตรงกับ type `Student`
 */

const THAI_PREFIXES = ['นาย', 'นางสาว', 'เด็กชาย', 'เด็กหญิง', 'ด.ช.', 'ด.ญ.', 'นาง'];

function mapDocToStudent(id: string, data: any): Student {
  const studentId = data.studentId || id;
  const studentNo = Number(data.studentNo ?? data.studentNumber ?? data.number ?? 0);
  const room = data.room || data.className || '';

  let prefix = data.prefix || data.title || '';
  let firstName = data.firstName || '';
  let lastName = data.lastName || '';
  const rawFull = data.fullName || data.name || '';

  if (!firstName && rawFull) {
    const parts = String(rawFull).trim().split(/\s+/);
    if (THAI_PREFIXES.includes(parts[0])) {
      prefix = prefix || parts[0];
      firstName = parts[1] || '';
      lastName = parts.slice(2).join(' ') || '';
    } else {
      firstName = parts[0] || '';
      lastName = parts.slice(1).join(' ') || '';
    }
  }

  const fullName = rawFull || `${prefix}${firstName} ${lastName}`.trim() || `นักเรียน ${studentId}`;
  const attendance = data.attendance || {};
  // อย่าปล่อยให้ src="" (React จะ warn + เบราว์เซอร์โหลดหน้าซ้ำ) — ใช้รูป avatar generated เป็น fallback
  const avatarUrl = data.avatar || data.photoUrl
    || `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(studentId || fullName)}`;

  return {
    id,
    studentId,
    name: fullName,
    fullName,
    nickname: data.nickname || '',
    avatar: avatarUrl,
    photoUrl: data.photoUrl || data.avatar || avatarUrl,
    seatIndex: data.seatIndex ?? null,
    room,
    studentNo,
    studentCode: data.studentCode || studentId,
    title: prefix || undefined,
    firstName,
    lastName,
    grade: data.grade || (room.includes('/') ? room.split('/')[0] : room),
    number: studentNo,
    status: data.status || 'ACTIVE',
    parentUid: data.parentUid || data.parentId || undefined,
    parentId: data.parentId || data.parentUid || undefined,
    parentEmail: data.parentEmail || '',
    studentUid: data.studentUid || undefined,
    homeLocation: {
      address: data.homeLocation?.address || data.address || '',
      coordinates: data.homeLocation?.coordinates || [13.7563, 100.5018],
      routeImage: data.homeLocation?.routeImage || '',
    },
    attendance: {
      morningStatus: attendance.morningStatus || 'PRESENT',
      checkInMethod: attendance.checkInMethod ?? 'MANUAL',
      checkInTime: attendance.checkInTime ?? null,
    },
  } as Student;
}

export interface UseRealStudentsOptions {
  /**
   * จำกัดเฉพาะนักเรียนที่ผูกกับ parentUid นี้ (สำหรับ ParentPortal)
   * — ต้อง filter ฝั่ง query เพื่อให้ผ่าน firestore.rules (rule เช็ค resource.data.parentUid == auth.uid)
   *   การ list ทั้ง collection แบบไม่ filter จะถูกปฏิเสธสำหรับ role ที่ไม่มีสิทธิ์อ่านทั้งหมด
   */
  parentUid?: string | null;
  /**
   * จำกัดเฉพาะ record ของนักเรียนคนนี้ (สำหรับ StudentPortal) — filter ฝั่ง query
   * เพื่อให้ผ่าน firestore.rules (rule เช็ค resource.data.studentUid == auth.uid);
   * list ทั้ง collection ถูกปฏิเสธสำหรับ role STUDENT
   */
  studentUid?: string | null;
}

export function useRealStudents(options: UseRealStudentsOptions = {}) {
  const { parentUid, studentUid } = options;
  // ผู้เรียกส่ง key มา = ตั้งใจ query แบบ filtered — ถ้าค่ายังว่าง (auth ยังไม่ resolve)
  // ต้อง "รอ" ไม่ใช่ fallback ไป query ทั้ง collection (ซึ่ง STUDENT/PARENT จะโดน rules ปฏิเสธ
  // แล้วหน้าจอเด้งขึ้น "ยังไม่ได้ผูกกับทะเบียนนักเรียน" ชั่วขณะ ก่อนจะแก้ตัวเองตอน auth มา)
  const wantsFilter = 'studentUid' in options || 'parentUid' in options;
  const filterNotReady = wantsFilter && !studentUid && !parentUid;

  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (filterNotReady) {
      // ยัง loading อยู่ — ยังไม่ query จนกว่า id จะพร้อม
      setLoading(true);
      setStudents([]);
      return;
    }
    setLoading(true);
    const col = collection(db, 'students') as CollectionReference;
    const ref: Query = studentUid
      ? query(col, where('studentUid', '==', studentUid))
      : parentUid
      ? query(col, where('parentUid', '==', parentUid))
      : col;
    const unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        const list = snapshot.docs.map(docSnap => mapDocToStudent(docSnap.id, docSnap.data()));
        list.sort((a, b) => {
          if ((a.room || '') !== (b.room || '')) {
            return (a.room || '').localeCompare(b.room || '', 'th');
          }
          if (a.studentNo !== b.studentNo) {
            return a.studentNo - b.studentNo;
          }
          return (a.fullName || '').localeCompare(b.fullName || '', 'th');
        });
        setStudents(list);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error('[useRealStudents] Firestore listener error:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [parentUid, studentUid, filterNotReady]);

  return { students, loading, error };
}
