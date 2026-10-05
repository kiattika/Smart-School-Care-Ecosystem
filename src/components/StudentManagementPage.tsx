import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  UserCheck, 
  Edit2, 
  Plus, 
  ArrowRightLeft,
  History,
  X, 
  Check, 
  Save, 
  HelpCircle,
  Users,
  ChevronDown,
  AlertCircle,
  FileSpreadsheet,
  Loader2,
  GraduationCap,
  Link,
  Unlink,
  Phone,
  Mail,
  UserPlus,
  Home,
  CheckCircle2,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { recomputeStudentAttendanceStats } from '../services/firestoreService';
import { Student } from '../types';
import { isSameRoom } from '../lib/utils';
import { normalizeEmail } from '../lib/normalizeEmail';
import { useStudentEmailFormat } from '../hooks/useStudentEmailFormat';
import { formatStudentEmail, studentEmailPatternLabel } from '../lib/studentEmailFormat';
import {
  INACTIVE_STATUS_REASONS, STUDENT_STATUS_LABELS_TH, isStudentActive, statusLabelTh, validateStatusChange,
  type StudentStatusReason,
} from '../lib/studentStatus';
import type { IdConflict } from '../lib/studentIdRegistry';
import { changeStudentStatus, checkStudentIdConflict, createStudentWithRegistry } from '../services/studentLifecycle';

export interface StudentRecord {
  id: string;
  studentId: string;
  studentCode?: string;
  studentNo: number;
  studentNumber?: number;
  prefix?: string;
  title?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  name?: string;
  nickname?: string;
  email?: string;      // อีเมลนักเรียนเอง (รูปแบบ it{รหัสประจำตัว}@utd.ac.th) — ต่างจาก parentEmail
  room: string;
  className?: string;
  grade?: string;
  parentUid?: string | null;
  parentId?: string | null;
  parentEmail?: string;
  parentMobile?: string;
  photoUrl?: string;
  avatar?: string;
  status?: string;
  statusReason?: string;
  statusNote?: string;
  statusChangedAt?: unknown;
  behaviorScore?: number;
  address?: string;
  homeLocation?: {
    address?: string;
    coordinates?: [number, number];
    routeImage?: string;
  };
  attendance?: {
    morningStatus?: string;
    checkInMethod?: string;
    checkInTime?: string | null;
  };
}

const COMMON_ROOMS = [
  'ม.1/1', 'ม.1/2', 'ม.1/3',
  'ม.2/1', 'ม.2/2', 'ม.2/3',
  'ม.3/1', 'ม.3/2', 'ม.3/3',
  'ม.4/1', 'ม.4/2', 'ม.4/3',
  'ม.5/1', 'ม.5/2', 'ม.5/8', 'ม.5/9',
  'ม.6/1', 'ม.6/2', 'ม.6/8'
];

/**
 * onGoToImport: พาไปเมนู "ระบบนำเข้าข้อมูลขนาดใหญ่" ของ AdminPortal (ชนิด STUDENT) — การนำเข้าข้อมูล
 * มีที่เดียว (BulkDataImportModal แบบ inline ในเมนู 'import') ไม่เปิด modal ซ้ำในหน้านี้
 */
export function StudentManagementPage({ onGoToImport, onOpenIdRegistry }: { onGoToImport?: () => void; onOpenIdRegistry?: (studentId?: string) => void } = {}) {
  // ดึงข้อมูลนักเรียนจริงจาก Firestore 'students' collection แบบ Real-time
  // รูปแบบอีเมลนักเรียนจาก school_settings/studentEmailFormat (ไม่มี = it / utd.ac.th) — config ตัวเดียวกับที่ blocking function ใช้
  const { format: studentEmailFormat } = useStudentEmailFormat();
  const [rawStudentsList, setRawStudentsList] = useState<StudentRecord[]>([]);
  // แถวเก่าที่ยังไม่มี field email: แสดง/ตั้งต้นฟอร์มแก้ไขด้วยรูปแบบปัจจุบัน (ยังไม่เขียนลง Firestore จนกว่าแอดมินจะกด "บันทึก")
  const studentsList = useMemo(
    () => rawStudentsList.map(s => (s.email ? s : { ...s, email: formatStudentEmail(s.studentId || s.id, studentEmailFormat) })),
    [rawStudentsList, studentEmailFormat]
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    const unsubscribe = onSnapshot(
      collection(db, 'students'),
      (snapshot) => {
        const docs: StudentRecord[] = snapshot.docs.map(docSnap => {
          const data = docSnap.data();
          const sId = data.studentId || docSnap.id;
          const sNo = Number(data.studentNo ?? data.studentNumber ?? data.number ?? 0);
          const rawRoom = data.room || data.className || '';
          
          let pfx = data.prefix || data.title || '';
          let fName = data.firstName || '';
          let lName = data.lastName || '';
          let full = data.fullName || data.name || '';

          if (!fName && full) {
            const parts = full.trim().split(/\s+/);
            if (['นาย', 'นางสาว', 'เด็กชาย', 'เด็กหญิง', 'ด.ช.', 'ด.ญ.', 'นาง'].includes(parts[0])) {
              pfx = pfx || parts[0];
              fName = parts[1] || '';
              lName = parts.slice(2).join(' ') || '';
            } else {
              fName = parts[0] || '';
              lName = parts.slice(1).join(' ') || '';
            }
          }

          const composedFullName = full || `${pfx}${fName} ${lName}`.trim() || `นักเรียน ${sId}`;

          return {
            id: docSnap.id,
            studentId: sId,
            studentCode: data.studentCode || sId,
            studentNo: sNo,
            studentNumber: sNo,
            prefix: pfx,
            title: pfx,
            firstName: fName,
            lastName: lName,
            fullName: composedFullName,
            name: composedFullName,
            nickname: data.nickname || '',
            // ค่าที่เก็บไว้จริงเท่านั้น — ถ้า doc เก่ายังไม่มี field email ค่า fallback ตามรูปแบบที่ตั้งไว้
            // เติมที่ studentsList (useMemo ด้านบน) เพื่อให้เปลี่ยนรูปแบบแล้วอัปเดตทันทีโดยไม่ต้อง subscribe ใหม่
            email: data.email || '',
            room: rawRoom,
            className: rawRoom,
            grade: data.grade || (rawRoom.includes('/') ? rawRoom.split('/')[0] : rawRoom),
            parentUid: data.parentUid || data.parentId || null,
            parentId: data.parentId || data.parentUid || null,
            parentEmail: data.parentEmail || '',
            parentMobile: data.parentMobile || '',
            photoUrl: data.photoUrl || data.avatar || '',
            avatar: data.avatar || data.photoUrl || '',
            status: data.status || 'ACTIVE',
            statusReason: data.statusReason || undefined,
            statusNote: data.statusNote || '',
            statusChangedAt: data.statusChangedAt ?? null,
            behaviorScore: data.behaviorScore ?? 100,
            address: data.homeLocation?.address || data.address || '',
            homeLocation: data.homeLocation || {
              address: data.address || '',
              coordinates: [13.7563, 100.5018],
              routeImage: ''
            },
            attendance: data.attendance || {
              morningStatus: 'PRESENT',
              checkInMethod: 'MANUAL',
              checkInTime: null
            }
          };
        });

        // จัดเรียงตาม ห้องเรียน และ เลขที่
        docs.sort((a, b) => {
          if (a.room !== b.room) {
            return a.room.localeCompare(b.room, 'th');
          }
          if (a.studentNo !== b.studentNo) {
            return a.studentNo - b.studentNo;
          }
          return (a.fullName || '').localeCompare(b.fullName || '', 'th');
        });

        setRawStudentsList(docs);
        setIsLoading(false);
      },
      (err) => {
        console.error('Error fetching students from Firestore:', err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // State การค้นหาและกรอง
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('ALL');
  const [parentLinkFilter, setParentLinkFilter] = useState<'ALL' | 'LINKED' | 'UNLINKED'>('ALL');

  // State ของ Modal แก้ไข / เพิ่ม
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNewStudent, setIsNewStudent] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentRecord | null>(null);

  // Form States ภายใน Modal
  const [formStudentId, setFormStudentId] = useState('');
  const [formPrefix, setFormPrefix] = useState('นาย');
  const [formFirstName, setFormFirstName] = useState('');
  const [formLastName, setFormLastName] = useState('');
  const [formNickname, setFormNickname] = useState('');
  const [formEmail, setFormEmail] = useState('');
  // ไม่ตั้งห้องเริ่มต้นให้ — ผู้ใช้ต้องเลือกเอง (save ตรวจห้องว่างอยู่แล้ว) ห้ามเติมห้องปลอม
  const [formRoom, setFormRoom] = useState('');
  const [formStudentNo, setFormStudentNo] = useState<number>(1);
  const [formPhotoUrl, setFormPhotoUrl] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formParentUid, setFormParentUid] = useState('');
  const [formParentEmail, setFormParentEmail] = useState('');
  const [formParentMobile, setFormParentMobile] = useState('');

  // แท็บรายการ: ACTIVE = นักเรียนที่ยังศึกษาอยู่ (ค่าเริ่มต้น), HISTORY = ไม่ได้ศึกษาต่อแล้ว (เอกสารไม่ถูกลบ)
  const [listTab, setListTab] = useState<'ACTIVE' | 'HISTORY'>('ACTIVE');

  // เปลี่ยนสถานะนักเรียน (แทนปุ่มลบถาวร)
  const [statusTarget, setStatusTarget] = useState<StudentRecord | null>(null);
  const [newStatus, setNewStatus] = useState<StudentStatusReason>('WITHDRAWN');
  const [statusNote, setStatusNote] = useState('');
  const [statusError, setStatusError] = useState<string | null>(null);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const statusTargetIsActive = statusTarget ? isStudentActive(statusTarget) : true;

  // คำเตือนเลขประจำตัวซ้ำ (เพิ่มนักเรียนใหม่): แสดงครั้งแรก ต้องกดบันทึกอีกครั้งเพื่อยืนยัน
  const [idConflict, setIdConflict] = useState<IdConflict | null>(null);
  const [conflictAckedFor, setConflictAckedFor] = useState<string | null>(null);

  // Toast / SweetAlert states
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showSweetAlert, setShowSweetAlert] = useState<{
    show: boolean;
    title: string;
    text: string;
    type: 'success' | 'warning' | 'error';
  } | null>(null);

  // แยกนักเรียนที่ยังศึกษาอยู่ / ประวัติ (ไม่ได้ศึกษาต่อแล้ว)
  const activeStudents = useMemo(() => studentsList.filter(isStudentActive), [studentsList]);
  const historyStudents = useMemo(() => studentsList.filter(s => !isStudentActive(s)), [studentsList]);
  const scopedStudents = listTab === 'ACTIVE' ? activeStudents : historyStudents;

  // หาห้องเรียนทั้งหมดที่มีข้อมูลในระบบ
  const availableRooms = useMemo(() => {
    const roomsSet = new Set<string>();
    COMMON_ROOMS.forEach(r => roomsSet.add(r));
    scopedStudents.forEach(s => {
      if (s.room) roomsSet.add(s.room);
      if (s.className) roomsSet.add(s.className);
    });
    return Array.from(roomsSet).sort((a, b) => a.localeCompare(b, 'th'));
  }, [scopedStudents]);

  // สถิติตัวเลขสรุป
  const stats = useMemo(() => {
    const total = scopedStudents.length;
    const linked = scopedStudents.filter(s => !!s.parentUid && s.parentUid.trim() !== '').length;
    const unlinked = total - linked;
    const distinctRooms = new Set(scopedStudents.map(s => s.room).filter(Boolean)).size;
    return { total, linked, unlinked, distinctRooms };
  }, [scopedStudents]);

  // กรองตารางรายชื่อนักเรียนตามเงื่อนไขค้นหาและห้องเรียน
  const filteredStudents = useMemo(() => {
    return scopedStudents.filter(student => {
      // 1. Search Query
      const sQuery = searchQuery.trim().toLowerCase();
      const matchesSearch = !sQuery || (
        (student.fullName && student.fullName.toLowerCase().includes(sQuery)) ||
        (student.firstName && student.firstName.toLowerCase().includes(sQuery)) ||
        (student.lastName && student.lastName.toLowerCase().includes(sQuery)) ||
        (student.nickname && student.nickname.toLowerCase().includes(sQuery)) ||
        (student.studentId && student.studentId.toLowerCase().includes(sQuery)) ||
        (student.studentCode && student.studentCode.toLowerCase().includes(sQuery)) ||
        (student.parentMobile && student.parentMobile.includes(sQuery)) ||
        (student.parentEmail && student.parentEmail.toLowerCase().includes(sQuery)) ||
        (student.email && student.email.toLowerCase().includes(sQuery))
      );

      // 2. Room Filter (ใช้ isSameRoom ป้องกันความคลาดเคลื่อน ม.5/8 vs M.5/8)
      const matchesRoom = selectedRoom === 'ALL' || isSameRoom(student.room || student.className, selectedRoom);

      // 3. Parent Linkage Filter
      const hasParentLink = !!student.parentUid && student.parentUid.trim() !== '';
      const matchesParentLink = 
        parentLinkFilter === 'ALL' || 
        (parentLinkFilter === 'LINKED' && hasParentLink) || 
        (parentLinkFilter === 'UNLINKED' && !hasParentLink);

      return matchesSearch && matchesRoom && matchesParentLink;
    });
  }, [scopedStudents, searchQuery, selectedRoom, parentLinkFilter]);

  // ฟังก์ชันแสดงการแจ้งเตือน
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const triggerSweetAlert = (title: string, text: string, type: 'success' | 'warning' | 'error') => {
    setShowSweetAlert({ show: true, title, text, type });
  };

  // เปิด Modal เพิ่มนักเรียนใหม่
  const handleAddNewClick = () => {
    setIsNewStudent(true);
    setEditingStudent(null);
    setFormStudentId('');
    setFormPrefix('นาย');
    setFormFirstName('');
    setFormLastName('');
    setFormNickname('');
    setFormEmail('');
    setFormRoom(selectedRoom !== 'ALL' ? selectedRoom : '');
    setFormStudentNo(activeStudents.length + 1);
    setIdConflict(null);
    setConflictAckedFor(null);
    setFormPhotoUrl('');
    setFormAddress('');
    setFormParentUid('');
    setFormParentEmail('');
    setFormParentMobile('');
    setIsModalOpen(true);
  };

  // เปิด Modal แก้ไขข้อมูลนักเรียน
  const handleEditClick = (student: StudentRecord) => {
    setIsNewStudent(false);
    setEditingStudent(student);
    setFormStudentId(student.studentId || student.id);
    setFormPrefix(student.prefix || 'นาย');
    setFormFirstName(student.firstName || '');
    setFormLastName(student.lastName || '');
    setFormNickname(student.nickname || '');
    setFormEmail(student.email || '');
    setFormRoom(student.room || student.className || '');
    setFormStudentNo(student.studentNo || student.studentNumber || 1);
    setFormPhotoUrl(student.photoUrl || student.avatar || '');
    setFormAddress(student.address || student.homeLocation?.address || '');
    setFormParentUid(student.parentUid || student.parentId || '');
    setFormParentEmail(student.parentEmail || '');
    setFormParentMobile(student.parentMobile || '');
    setIdConflict(null);
    setConflictAckedFor(null);
    setIsModalOpen(true);
  };

  // บันทึกข้อมูลนักเรียนลง Firestore
  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = formStudentId.trim();

    if (!cleanId) {
      triggerToast('⚠️ กรุณาระบุรหัสประจำตัวนักเรียน (Student ID)');
      return;
    }

    if (!formFirstName.trim() || !formLastName.trim()) {
      triggerToast('⚠️ กรุณาระบุชื่อจริงและนามสกุล');
      return;
    }

    if (!formRoom.trim()) {
      triggerToast('⚠️ กรุณาระบุห้องเรียน (เช่น ม.5/8)');
      return;
    }

    setIsSaving(true);
    try {
      // เพิ่มนักเรียนใหม่: ตรวจเลขประจำตัวกับทะเบียน/เอกสารเดิมก่อน — มีประวัติ = เตือนและให้กดยืนยันอีกครั้ง (ไม่บล็อก)
      if (isNewStudent && conflictAckedFor !== cleanId) {
        const conflict = await checkStudentIdConflict(cleanId);
        setIdConflict(conflict);
        if (conflict.level !== 'none') {
          setConflictAckedFor(cleanId);
          setIsSaving(false);
          return;
        }
      }
      const studentDocRef = doc(db, 'students', cleanId);
      const fullName = `${formPrefix ? formPrefix : ''}${formFirstName.trim()} ${formLastName.trim()}`.trim();
      const parentUidValue = formParentUid.trim() ? formParentUid.trim() : null;

      const payload = {
        id: cleanId,
        studentId: cleanId,
        studentCode: cleanId,
        studentNo: Number(formStudentNo) || 1,
        studentNumber: Number(formStudentNo) || 1,
        number: Number(formStudentNo) || 1,
        prefix: formPrefix,
        title: formPrefix,
        firstName: formFirstName.trim(),
        lastName: formLastName.trim(),
        name: fullName,
        fullName: fullName,
        nickname: formNickname.trim(),
        // ถ้าไม่ได้กรอกเอง ใช้รูปแบบอีเมลนักเรียนที่ admin ตั้งไว้ (school_settings/studentEmailFormat; ไม่มี = it{รหัส}@utd.ac.th)
        // normalizeEmail = ตัดอักขระล่องหน + trim + lowercase (blocking function ค้น students ด้วย email ตรงตัว)
        email: normalizeEmail(formEmail) || formatStudentEmail(cleanId, studentEmailFormat),
        room: formRoom.trim(),
        className: formRoom.trim(),
        grade: formRoom.includes('/') ? formRoom.split('/')[0] : formRoom,
        parentUid: parentUidValue,
        parentId: parentUidValue,
        parentEmail: normalizeEmail(formParentEmail),
        parentMobile: formParentMobile.trim(),
        photoUrl: formPhotoUrl.trim(),
        avatar: formPhotoUrl.trim(),
        homeLocation: {
          address: formAddress.trim(),
          coordinates: [13.7563, 100.5018],
          routeImage: ''
        },
        address: formAddress.trim(),
        // สถานะ (status/statusReason/...) ไม่เขียนจากฟอร์มแก้ไข — เปลี่ยนผ่าน "เปลี่ยนสถานะ" เท่านั้น; นักเรียนใหม่ได้ ACTIVE จาก createStudentWithRegistry
        behaviorScore: editingStudent?.behaviorScore ?? 100,
        updatedAt: serverTimestamp(),
        ...(isNewStudent ? { createdAt: serverTimestamp() } : {})
      };

      if (isNewStudent) {
        // นักเรียนใหม่: เขียนเอกสาร + ลงทะเบียนเลขประจำตัวในธุรกรรมเดียว
        await createStudentWithRegistry({ studentId: cleanId, payload, fullName });
      } else {
        await setDoc(studentDocRef, payload, { merge: true });
      }

      setIsModalOpen(false);
      triggerSweetAlert(
        isNewStudent ? 'เพิ่มข้อมูลนักเรียนสำเร็จ!' : 'อัปเดตข้อมูลนักเรียนสำเร็จ!',
        `บันทึกข้อมูลของ ${fullName} (รหัส ${cleanId}) ลงในระบบเรียบร้อยแล้ว`,
        'success'
      );
    } catch (err) {
      console.error('Error saving student to Firestore:', err);
      triggerToast(`❌ เกิดข้อผิดพลาดในการบันทึก: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Resync สถิติการเข้าเรียนสะสม (students/{id}.attendanceStats) ให้ตรงกับ attendance_records
  // จริงทั้งหมด — attendanceStats เป็นแค่ derived cache (ดู recomputeStudentAttendanceStats ใน
  // firestoreService.ts) ใช้ปุ่มนี้เมื่อสงสัยว่าตัวเลขเพี้ยน (เช่น ข้อมูลเก่าก่อนมีระบบนี้)
  const [resyncingStudentId, setResyncingStudentId] = useState<string | null>(null);
  const handleResyncAttendance = async (student: StudentRecord) => {
    setResyncingStudentId(student.studentId);
    try {
      const stats = await recomputeStudentAttendanceStats(student.studentId, student.room);
      triggerSweetAlert(
        'Resync สถิติการเข้าเรียนสำเร็จ',
        `${student.fullName || student.studentId}: มา ${stats.present} · ขาด ${stats.absent} · ลา ${stats.leave} · สาย ${stats.late}`,
        'success'
      );
    } catch (err) {
      triggerToast(`❌ Resync ไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setResyncingStudentId(null);
    }
  };

  // เปลี่ยนสถานะนักเรียน (ห้ามลบเอกสารนักเรียน — ดู firestore.rules students: allow delete: if false)
  const openStatusChange = (student: StudentRecord) => {
    setStatusTarget(student);
    setNewStatus(isStudentActive(student) ? 'WITHDRAWN' : 'ACTIVE');
    setStatusNote('');
    setStatusError(null);
  };

  const handleConfirmStatusChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusTarget) return;
    const check = validateStatusChange(newStatus, statusNote, statusTarget);
    if ('error' in check) {
      setStatusError(check.error);
      return;
    }
    setIsChangingStatus(true);
    setStatusError(null);
    try {
      await changeStudentStatus({ studentDocId: statusTarget.id || statusTarget.studentId, target: newStatus, note: statusNote });
      const name = statusTarget.fullName || statusTarget.studentId;
      setStatusTarget(null);
      triggerSweetAlert(
        'เปลี่ยนสถานะสำเร็จ',
        `${name}: ${STUDENT_STATUS_LABELS_TH[newStatus]}${newStatus === 'ACTIVE' ? '' : ' — ย้ายไปแท็บประวัติแล้ว และบันทึกลงทะเบียนเลขประจำตัวเรียบร้อย'}`,
        'success'
      );
    } catch (err) {
      console.error('Error changing student status:', err);
      setStatusError(`เกิดข้อผิดพลาด: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsChangingStatus(false);
    }
  };

  return (
    <div className="bg-[#0a0f16] border border-white/5 rounded-2xl p-6 min-h-[600px] flex flex-col space-y-6 relative overflow-hidden text-slate-100">
      
      {/* Background Decorative Gradient Glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Toast Notification Element */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 duration-300">
          <div className="bg-slate-900 border border-purple-500/30 text-purple-200 px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-xs font-semibold backdrop-blur-md">
            <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* SweetAlert Custom Modal */}
      {showSweetAlert && showSweetAlert.show && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-[#11151d] border border-white/10 rounded-2xl max-w-md w-full p-6 text-center shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">{showSweetAlert.title}</h3>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">{showSweetAlert.text}</p>
            <button
              onClick={() => setShowSweetAlert(null)}
              className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
            >
              ตกลง (OK)
            </button>
          </div>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest bg-purple-500/10 px-2.5 py-0.5 rounded-full border border-purple-500/20">
              Student Information System (SIS)
            </span>
          </div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-purple-400" />
            <span>จัดการข้อมูลนักเรียน (Student Roster Management)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            ค้นหา ตรวจสอบความถูกต้อง เชื่อมโยงบัญชีผู้ปกครอง (Parent Linkage) และแก้ไขข้อมูลนักเรียนแบบ Real-time บน Firestore
          </p>
        </div>

        {/* Action buttons and Info stats pill */}
        <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
          {/* Add Student Button */}
          <button
            onClick={handleAddNewClick}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl transition-all shadow-[0_4px_15px_rgba(168,85,247,0.25)] active:scale-[0.98] cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>เพิ่มนักเรียนใหม่</span>
          </button>

          {onOpenIdRegistry && (
            <button
              onClick={() => onOpenIdRegistry()}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-white/10 transition-all cursor-pointer"
            >
              <History className="w-4 h-4" />
              <span>ทะเบียนเลขประจำตัว</span>
            </button>
          )}

          {/* Info stats pill */}
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl px-4 py-2.5 flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 bg-purple-500/10 text-purple-400 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] text-slate-400">{listTab === 'ACTIVE' ? 'นักเรียนที่ศึกษาอยู่' : 'ประวัติ (ไม่ได้ศึกษาต่อแล้ว)'}</div>
              <div className="text-sm font-bold text-white font-mono">{stats.total} คน ({stats.distinctRooms} ห้อง)</div>
            </div>
          </div>
        </div>
      </div>

      {/* แท็บ: รายการหลัก (ศึกษาอยู่) / ประวัติ (ไม่ได้ศึกษาต่อแล้ว) */}
      <div className="flex items-center gap-2" role="tablist">
        <button
          role="tab"
          aria-selected={listTab === 'ACTIVE'}
          onClick={() => setListTab('ACTIVE')}
          data-testid="tab-active"
          className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${listTab === 'ACTIVE' ? 'bg-purple-600/20 text-purple-200 border-purple-500/40' : 'bg-slate-900/40 text-slate-400 border-white/5 hover:text-slate-200'}`}
        >
          ศึกษาอยู่ ({activeStudents.length})
        </button>
        <button
          role="tab"
          aria-selected={listTab === 'HISTORY'}
          onClick={() => setListTab('HISTORY')}
          data-testid="tab-history"
          className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${listTab === 'HISTORY' ? 'bg-amber-600/20 text-amber-200 border-amber-500/40' : 'bg-slate-900/40 text-slate-400 border-white/5 hover:text-slate-200'}`}
        >
          ประวัติ (ไม่ได้ศึกษาต่อแล้ว) ({historyStudents.length})
        </button>
      </div>

      {/* 1. Search & Filter Bar */}
      <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center">
        {/* Search Input */}
        <div className="w-full md:flex-1 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหารหัสนักเรียน, ชื่อ-นามสกุล, ชื่อเล่น หรือเบอร์โทร..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:border-purple-500 outline-none transition-all"
          />
        </div>

        {/* Filter Room / Class */}
        <div className="w-full md:w-56 relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-slate-400">
            <Filter className="w-3.5 h-3.5 mr-1" />
            <span className="text-[10px] font-bold uppercase mr-1">ห้อง:</span>
          </div>
          <select
            value={selectedRoom}
            onChange={(e) => setSelectedRoom(e.target.value)}
            className="w-full bg-slate-950 border border-white/10 rounded-xl pl-16 pr-8 py-2.5 text-xs text-slate-200 focus:border-purple-500 outline-none transition-all appearance-none cursor-pointer"
          >
            <option value="ALL">ทุกห้องเรียน ({scopedStudents.length})</option>
            {availableRooms.map(room => {
              const countInRoom = scopedStudents.filter(s => isSameRoom(s.room || s.className, room)).length;
              return (
                <option key={room} value={room}>
                  {room} {countInRoom > 0 ? `(${countInRoom} คน)` : ''}
                </option>
              );
            })}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        </div>

        {/* Filter Parent Linkage */}
        <div className="w-full md:w-60 relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-slate-400">
            <Link className="w-3.5 h-3.5 mr-1" />
            <span className="text-[10px] font-bold uppercase mr-1">ผู้ปกครอง:</span>
          </div>
          <select
            value={parentLinkFilter}
            onChange={(e) => setParentLinkFilter(e.target.value as any)}
            className="w-full bg-slate-950 border border-white/10 rounded-xl pl-24 pr-8 py-2.5 text-xs text-slate-200 focus:border-purple-500 outline-none transition-all appearance-none cursor-pointer"
          >
            <option value="ALL">ทั้งหมด ({stats.total})</option>
            <option value="LINKED">เชื่อมโยงแล้ว ({stats.linked})</option>
            <option value="UNLINKED">ยังไม่เชื่อมบัญชี ({stats.unlinked})</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* 2. Students Data Table */}
      <div className="border border-white/5 rounded-2xl overflow-hidden bg-slate-950/20 flex-1">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/50 border-b border-white/5 text-slate-400 text-xs font-semibold">
                <th className="px-5 py-4 font-mono">รหัสประจำตัว</th>
                <th className="px-3 py-4 text-center">เลขที่</th>
                <th className="px-5 py-4">รูปถ่าย / ชื่อ-นามสกุล</th>
                <th className="px-4 py-4 text-center">ห้องเรียน</th>
                <th className="px-5 py-4">สถานะเชื่อมโยงผู้ปกครอง (Parent Linkage)</th>
                <th className="px-5 py-4">อีเมลนักเรียน (Student Email)</th>
                <th className="px-5 py-4">ข้อมูลติดต่อผู้ปกครอง</th>
                <th className="px-5 py-4 text-right">ดำเนินการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                      <p className="text-xs font-semibold text-slate-300">กำลังโหลดรายชื่อนักเรียนจากฐานข้อมูล Firestore...</p>
                    </div>
                  </td>
                </tr>
              ) : scopedStudents.length === 0 && listTab === 'HISTORY' ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500 text-xs">ยังไม่มีนักเรียนที่เปลี่ยนสถานะเป็นไม่ได้ศึกษาต่อแล้ว</td>
                </tr>
              ) : studentsList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center space-y-3 max-w-md mx-auto">
                      <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                        <GraduationCap className="w-7 h-7" />
                      </div>
                      <p className="text-sm font-bold text-slate-200">ยังไม่มีข้อมูลนักเรียนในฐานข้อมูล Firestore</p>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        ท่านสามารถนำเข้าข้อมูลบัญชีรายชื่อนักเรียนผ่านเมนู "ระบบนำเข้าข้อมูลขนาดใหญ่" เพื่อเริ่มใช้งานระบบดูแลช่วยเหลือนักเรียน
                      </p>
                      <div className="flex items-center gap-3 pt-2">
                        {onGoToImport && (
                          <button
                            onClick={onGoToImport}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-600/30 transition-all cursor-pointer"
                          >
                            <FileSpreadsheet className="w-4 h-4" />
                            <span>ไปที่ระบบนำเข้าข้อมูลขนาดใหญ่ (นักเรียน)</span>
                          </button>
                        )}
                        <button
                          onClick={handleAddNewClick}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-white/10 transition-all cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          <span>เพิ่มทีละคน</span>
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <HelpCircle className="w-8 h-8 text-slate-600" />
                      <p className="text-xs">ไม่พบข้อมูลนักเรียนที่สอดคล้องกับเงื่อนไขการค้นหาหรือตัวกรอง</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredStudents.map(student => {
                  const hasParentLink = !!student.parentUid && student.parentUid.trim() !== '';
                  const initial = student.firstName ? student.firstName.charAt(0) : 'S';

                  return (
                    <tr key={student.id} className="hover:bg-white/[0.02] transition-colors group">
                      {/* ID */}
                      <td className="px-5 py-4 font-mono text-xs">
                        <span className="text-purple-400 font-bold block">{student.studentId}</span>
                        {student.studentCode && student.studentCode !== student.studentId && (
                          <span className="text-slate-500 text-[10px] block">Code: {student.studentCode}</span>
                        )}
                      </td>

                      {/* เลขที่ */}
                      <td className="px-3 py-4 text-center">
                        <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-lg bg-slate-800 border border-slate-700 text-xs font-mono font-bold text-slate-200">
                          {student.studentNo || student.studentNumber || '-'}
                        </span>
                      </td>

                      {/* ชื่อ - นามสกุล + รูป */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {student.photoUrl || student.avatar ? (
                            <img
                              src={student.photoUrl || student.avatar}
                              alt={student.fullName}
                              className="w-9 h-9 rounded-xl object-cover border border-white/10 shrink-0 bg-slate-800"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600/30 to-indigo-600/30 border border-purple-500/30 text-purple-300 flex items-center justify-center text-xs font-bold shrink-0">
                              {initial}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-100 group-hover:text-white transition-colors flex items-center gap-1.5 flex-wrap">
                              <span>{student.fullName}</span>
                              {student.nickname && (
                                <span className="text-[10px] font-normal text-slate-400 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                                  ({student.nickname})
                                </span>
                              )}
                            </div>
                            {listTab === 'HISTORY' && (
                              <span className="inline-flex items-center gap-1 mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20" title={student.statusNote || ''}>
                                {statusLabelTh(student)}{student.statusNote ? ` — ${student.statusNote}` : ''}
                              </span>
                            )}
                            {student.address && (
                              <span className="text-[10px] text-slate-500 truncate max-w-[220px] block mt-0.5" title={student.address}>
                                🏠 {student.address}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* ห้องเรียน */}
                      <td className="px-4 py-4 text-center">
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-mono">
                          {student.room || student.className || '-'}
                        </span>
                      </td>

                      {/* สถานะเชื่อมโยงผู้ปกครอง */}
                      <td className="px-5 py-4">
                        {hasParentLink ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <Link className="w-3 h-3" />
                              <span>เชื่อมโยงบัญชีแล้ว</span>
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 block truncate max-w-[200px]" title={student.parentUid || ''}>
                              UID: {student.parentUid}
                            </span>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20">
                              <Unlink className="w-3 h-3 text-amber-400" />
                              <span>ยังไม่เชื่อมบัญชีผู้ปกครอง</span>
                            </span>
                            <span className="text-[10px] text-slate-500 block">
                              รอผู้ปกครองลงทะเบียนเชื่อมโยง
                            </span>
                          </div>
                        )}
                      </td>

                      {/* อีเมลนักเรียนเอง — ต่างจากอีเมลผู้ปกครองในคอลัมน์ถัดไป */}
                      <td className="px-5 py-4 text-xs">
                        {student.email ? (
                          <div className="flex items-center gap-1.5 text-slate-300">
                            <Mail className="w-3 h-3 text-indigo-400 shrink-0" />
                            <span className="truncate max-w-[150px] font-mono">{student.email}</span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-600 italic">- ไม่ได้ระบุ -</span>
                        )}
                      </td>

                      {/* ข้อมูลติดต่อผู้ปกครอง */}
                      <td className="px-5 py-4 text-xs">
                        <div className="space-y-1">
                          {student.parentMobile ? (
                            <div className="flex items-center gap-1.5 text-slate-300">
                              <Phone className="w-3 h-3 text-purple-400 shrink-0" />
                              <span className="font-mono">{student.parentMobile}</span>
                            </div>
                          ) : null}
                          {student.parentEmail ? (
                            <div className="flex items-center gap-1.5 text-slate-400">
                              <Mail className="w-3 h-3 text-slate-500 shrink-0" />
                              <span className="truncate max-w-[150px]">{student.parentEmail}</span>
                            </div>
                          ) : null}
                          {!student.parentMobile && !student.parentEmail && (
                            <span className="text-[10px] text-slate-600 italic">- ไม่ได้ระบุข้อมูล -</span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleEditClick(student)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-purple-600/20 hover:text-purple-300 border border-slate-700/60 hover:border-purple-500/30 text-slate-300 text-xs font-semibold rounded-lg transition-all active:scale-[0.97]"
                            title="แก้ไขข้อมูลนักเรียน"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>แก้ไข</span>
                          </button>
                          <button
                            onClick={() => handleResyncAttendance(student)}
                            disabled={resyncingStudentId === student.studentId}
                            className="p-1.5 bg-slate-800 hover:bg-blue-500/20 hover:text-blue-300 border border-slate-700/60 hover:border-blue-500/30 text-slate-400 rounded-lg transition-all active:scale-[0.97] disabled:opacity-50"
                            title="Resync สถิติการเข้าเรียนสะสม จาก attendance_records จริง (ใช้เมื่อสงสัยว่าตัวเลขเพี้ยน)"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${resyncingStudentId === student.studentId ? 'animate-spin' : ''}`} />
                          </button>
                          <button
                            onClick={() => openStatusChange(student)}
                            data-testid={`change-status-${student.studentId}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-amber-500/20 hover:text-amber-300 border border-slate-700/60 hover:border-amber-500/30 text-slate-300 text-xs font-semibold rounded-lg transition-all active:scale-[0.97]"
                            title="เปลี่ยนสถานะนักเรียน (จบ/ลาออก/ย้าย ฯลฯ) — ไม่ลบข้อมูล"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                            <span>เปลี่ยนสถานะ</span>
                          </button>
                          {onOpenIdRegistry && (
                            <button
                              onClick={() => onOpenIdRegistry(student.studentId)}
                              className="p-1.5 bg-slate-800 hover:bg-indigo-500/20 hover:text-indigo-300 border border-slate-700/60 hover:border-indigo-500/30 text-slate-400 rounded-lg transition-all active:scale-[0.97]"
                              title="ดูประวัติผู้ถือเลขประจำตัวนี้"
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Modal: Add / Edit Student */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-40 overflow-y-auto animate-fade-in">
          <div className="bg-[#11151d] border border-white/10 rounded-2xl max-w-2xl w-full shadow-2xl flex flex-col my-8 max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom-8 duration-300 text-slate-200">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-white/5 bg-[#0a0f16] flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest block mb-0.5">
                  {isNewStudent ? 'New Student Enrollment' : 'Edit Student Roster'}
                </span>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-purple-400" />
                  <span>{isNewStudent ? 'เพิ่มข้อมูลนักเรียนใหม่' : `แก้ไขข้อมูลนักเรียน: ${editingStudent?.fullName}`}</span>
                </h3>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveStudent} className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* บล็อก 1: ข้อมูลระบุตัวตน & ห้องเรียน */}
              <div className="space-y-3">
                <span className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  1. ข้อมูลประจำตัวนักเรียน
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-900/30 p-4 border border-white/5 rounded-xl">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      รหัสประจำตัวนักเรียน (ID) *
                    </label>
                    <input
                      type="text"
                      value={formStudentId}
                      onChange={(e) => setFormStudentId(e.target.value)}
                      disabled={!isNewStudent}
                      className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-purple-300 focus:border-purple-500 outline-none font-mono disabled:opacity-60"
                      placeholder="เช่น 68001"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      ห้องเรียน (Class/Room) *
                    </label>
                    <input
                      type="text"
                      value={formRoom}
                      onChange={(e) => setFormRoom(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-purple-500 outline-none"
                      placeholder="เช่น ม.5/8"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      เลขที่ (Student No.) *
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={formStudentNo}
                      onChange={(e) => setFormStudentNo(parseInt(e.target.value, 10) || 1)}
                      className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-purple-500 outline-none font-mono"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* บล็อก 2: ชื่อ-นามสกุล และรูปถ่าย */}
              <div className="space-y-3">
                <span className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  2. ชื่อ-นามสกุล และโปรไฟล์
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-900/30 p-4 border border-white/5 rounded-xl">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      คำนำหน้านาม
                    </label>
                    <select
                      value={formPrefix}
                      onChange={(e) => setFormPrefix(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-purple-500 outline-none"
                    >
                      <option value="นาย">นาย</option>
                      <option value="นางสาว">นางสาว</option>
                      <option value="ด.ช.">เด็กชาย (ด.ช.)</option>
                      <option value="ด.ญ.">เด็กหญิง (ด.ญ.)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      ชื่อจริง (First Name) *
                    </label>
                    <input
                      type="text"
                      value={formFirstName}
                      onChange={(e) => setFormFirstName(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-purple-500 outline-none"
                      placeholder="เช่น กิตติศักดิ์"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      นามสกุล (Last Name) *
                    </label>
                    <input
                      type="text"
                      value={formLastName}
                      onChange={(e) => setFormLastName(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-purple-500 outline-none"
                      placeholder="เช่น เจริญสุข"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      ชื่อเล่น (Nickname)
                    </label>
                    <input
                      type="text"
                      value={formNickname}
                      onChange={(e) => setFormNickname(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-purple-500 outline-none"
                      placeholder="เช่น กอล์ฟ"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      อีเมลนักเรียน (Student Email)
                    </label>
                    <input
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-purple-500 outline-none"
                      placeholder={formStudentId ? formatStudentEmail(formStudentId, studentEmailFormat) : studentEmailPatternLabel(studentEmailFormat)}
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      เว้นว่างได้ — ระบบจะใช้รูปแบบ {studentEmailPatternLabel(studentEmailFormat)} ให้อัตโนมัติ (ตั้งค่ารูปแบบได้ที่เมนู "ปีการศึกษา & ล็อกระบบ"; แก้ไขได้กรณีพิมพ์ผิดตอน import)
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      ลิงก์รูปถ่ายนักเรียน (Photo URL)
                    </label>
                    <input
                      type="url"
                      value={formPhotoUrl}
                      onChange={(e) => setFormPhotoUrl(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-purple-500 outline-none"
                      placeholder="https://images.unsplash.com/..."
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      ที่อยู่บ้านนักเรียน
                    </label>
                    <input
                      type="text"
                      value={formAddress}
                      onChange={(e) => setFormAddress(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-purple-500 outline-none"
                      placeholder="บ้านเลขที่ ตำบล อำเภอ จังหวัด..."
                    />
                  </div>
                </div>
              </div>

              {/* บล็อก 3: เชื่อมโยงบัญชีผู้ปกครอง */}
              <div className="space-y-3">
                <span className="block text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Link className="w-3.5 h-3.5" />
                  <span>3. ข้อมูลและการเชื่อมโยงบัญชีผู้ปกครอง (Parent Account Linkage)</span>
                </span>
                <div className="space-y-3 bg-slate-900/30 p-4 border border-emerald-500/20 rounded-xl">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Firebase Auth UID ของผู้ปกครอง (parentUid)
                    </label>
                    <input
                      type="text"
                      value={formParentUid}
                      onChange={(e) => setFormParentUid(e.target.value)}
                      className="w-full bg-slate-950 border border-emerald-500/30 rounded-lg px-3 py-2 text-xs text-emerald-300 focus:border-emerald-500 outline-none font-mono"
                      placeholder="เช่น test_parent_001 หรือ UID จาก Firebase Auth (เว้นว่างได้หากยังไม่เชื่อมโยง)"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      ระบุเพื่ออนุญาตให้ผู้ปกครองสามารถเข้าถึงข้อมูลการเข้าแถว บันทึกคะแนน และขอลาของนักเรียนคนนี้ได้ตาม Firestore Security Rules
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        เบอร์โทรศัพท์ผู้ปกครอง (Parent Mobile)
                      </label>
                      <input
                        type="tel"
                        value={formParentMobile}
                        onChange={(e) => setFormParentMobile(e.target.value)}
                        className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-purple-500 outline-none"
                        placeholder="เช่น 0812345678"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        อีเมลผู้ปกครอง (Parent Email)
                      </label>
                      <input
                        type="email"
                        value={formParentEmail}
                        onChange={(e) => setFormParentEmail(e.target.value)}
                        className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-purple-500 outline-none"
                        placeholder="เช่น parent@gmail.com"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer Buttons */}

                {/* คำเตือนเลขประจำตัวซ้ำกับผู้ถือเดิม (ไม่บล็อก — ต้องกดยืนยันอีกครั้ง) */}
                {isNewStudent && idConflict && idConflict.level !== 'none' && (
                  <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-4 space-y-2 text-amber-200" data-testid="id-conflict-warning">
                    <h4 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" />
                      {idConflict.level === 'active-holder'
                        ? `เลขประจำตัว ${formStudentId.trim()} มีนักเรียนที่ยังศึกษาอยู่ถือครอง (${idConflict.existingHolder}) — การบันทึกจะเขียนทับข้อมูลของเขา`
                        : `เลขประจำตัว ${formStudentId.trim()} เคยมีผู้ถือครองมาก่อน`}
                    </h4>
                    {idConflict.entries.length > 0 && (
                      <ul className="text-[11px] space-y-0.5 font-mono">
                        {idConflict.entries.map((e, i) => (
                          <li key={i}>• {e.heldBy} · {e.from ?? 'ไม่ทราบวันเริ่ม'} → {e.to ?? 'ปัจจุบัน'}{e.reason ? ` (${STUDENT_STATUS_LABELS_TH[e.reason]})` : ''}</li>
                        ))}
                      </ul>
                    )}
                    {idConflict.level === 'history' && (
                      <p className="text-[11px] leading-relaxed">
                        หากยืนยัน ระบบจะเก็บสำเนาข้อมูลเดิมไว้ในทะเบียนเลขประจำตัว แล้วออกเลขนี้ให้นักเรียนคนใหม่ — ข้อมูลที่ผูกกับเลขนี้ (เช่น เช็คชื่อ/ผลประเมินเก่า) จะปะปนกับคนใหม่ ตรวจสอบก่อนยืนยัน
                      </p>
                    )}
                    <p className="text-[11px] font-semibold">กด "บันทึกข้อมูล" อีกครั้งเพื่อยืนยันเพิ่มนักเรียนใหม่</p>
                  </div>
                )}

              <div className="pt-4 border-t border-white/5 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-white/10 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>กำลังบันทึกลง Firestore...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>บันทึกข้อมูล (Save)</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Modal: เปลี่ยนสถานะนักเรียน (แทนการลบถาวร) */}
      {statusTarget && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in" data-testid="status-change-modal">
          <form
            onSubmit={handleConfirmStatusChange}
            className="bg-[#11151d] border border-amber-500/20 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200 space-y-4"
          >
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 shrink-0 rounded-xl flex items-center justify-center bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <ArrowRightLeft className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-white">เปลี่ยนสถานะนักเรียน</h3>
                <p className="text-xs text-slate-400 leading-relaxed mt-0.5">
                  <span className="text-white font-bold">{statusTarget.fullName}</span> (รหัส {statusTarget.studentId}) — สถานะปัจจุบัน:{' '}
                  <span className="text-amber-300 font-semibold">{statusLabelTh(statusTarget)}</span>
                </p>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">สถานะใหม่ *</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as StudentStatusReason)}
                className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-amber-500 outline-none cursor-pointer"
                data-testid="status-select"
              >
                {statusTargetIsActive ? null : <option value="ACTIVE">{STUDENT_STATUS_LABELS_TH.ACTIVE} (กลับมาเรียน)</option>}
                {INACTIVE_STATUS_REASONS.map(r => (
                  <option key={r} value={r}>{STUDENT_STATUS_LABELS_TH[r]}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                หมายเหตุ {newStatus === 'ACTIVE' ? '(ไม่บังคับ)' : '*'}
              </label>
              <textarea
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
                rows={3}
                placeholder={newStatus === 'ACTIVE' ? 'เช่น กลับเข้าเรียนต่อ' : 'เช่น เลขที่หนังสือ/วันที่มีผล/เหตุผล'}
                className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-amber-500 outline-none resize-none"
                data-testid="status-note"
              />
            </div>

            {newStatus !== 'ACTIVE' && (
              <p className="text-[11px] text-amber-200/90 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 leading-relaxed">
                ข้อมูลนักเรียนจะ<strong>ไม่ถูกลบ</strong> — ย้ายไปแท็บ "ประวัติ" และเลขประจำตัว {statusTarget.studentId} จะถูกบันทึกในทะเบียนเลขประจำตัวว่าถูกปล่อยแล้ว
              </p>
            )}
            {statusError && <p className="text-xs text-rose-400 font-semibold" data-testid="status-error">{statusError}</p>}

            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => setStatusTarget(null)}
                disabled={isChangingStatus}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-white/10 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={isChangingStatus}
                className="inline-flex items-center gap-2 px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all disabled:opacity-50"
              >
                {isChangingStatus ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>{isChangingStatus ? 'กำลังบันทึก...' : 'ยืนยันเปลี่ยนสถานะ'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
