import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  Upload, 
  FileSpreadsheet, 
  Download, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  Trash2, 
  X, 
  Database,
  Info,
  ShieldAlert,
  Users,
  ArrowRight,
  Loader2
} from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { writeBatch, doc, serverTimestamp, collection, getDocs, onSnapshot } from 'firebase/firestore';
import {
  computeSyncReplacePlan, scheduleDocIdFor, primaryTeacherKey,
  SCHEDULE_REFERENCING_COLLECTIONS, collectReferenceValues, partitionStaleByReferences,
  type ScheduleSemester,
} from '../lib/scheduleSyncReplace';
import {
  computeImportImpact, isImpactFullyConfirmed, reviewKeysOf, type ImportImpact,
} from '../lib/scheduleImportImpact';
import { applyHandoverAndCleanup, writeImportLog, type AftercareResult } from '../lib/scheduleImportAftercare';
import { requireConfiguredSemester } from '../hooks/useCurrentSemester';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase';
import { useStore } from '../store';
import { Student, Course, GlobalCourse, UserRole } from '../types';
import { ROLE_NAMES_TH } from './StaffRoleManagementPage';
import { normalizeEmail } from '../lib/normalizeEmail';
import { IMPORT_TEMPLATES, templateFilename } from '../lib/importTemplates';
import { summarizeUnlinkedTeachers } from '../lib/importUnlinkedSummary';
import {
  isTeacherLoadReportFormat, 
  parseTeacherLoadReport, 
  THAI_DAY_MAP 
} from '../utils/teacherLoadReportParser';

export type ImportType = 'STUDENT' | 'TEACHER' | 'COURSE' | 'PARENT';

// ค่าความสัมพันธ์ที่ยอมรับสำหรับการนำเข้าผู้ปกครอง
const PARENT_RELATIONSHIPS = ['บิดา', 'มารดา', 'ผู้ปกครอง'] as const;

/**
 * ตรวจสอบเลขบัตรประชาชนไทย 13 หลักด้วย checksum มาตรฐาน
 * (หลักที่ 13 = (11 - (Σ(digit[i] * (13 - i)) mod 11)) mod 10)
 */
function isValidThaiNationalId(raw: string): boolean {
  const id = (raw || '').replace(/[\s-]/g, '');
  if (!/^\d{13}$/.test(id)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(id.charAt(i), 10) * (13 - i);
  }
  const check = (11 - (sum % 11)) % 10;
  return check === parseInt(id.charAt(12), 10);
}

/** SHA-256 → hex (Web Crypto API, ฝั่ง client — เลขบัตรดิบไม่ถูกส่ง/เก็บที่ใดนอกจาก hash) */
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export interface BulkDataImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialImportType?: ImportType;
  onImportSuccess?: (type: ImportType, count: number) => void;
  // 'modal' (ค่าเริ่มต้น) = popup overlay ลอยเหมือนเดิม ใช้ตอนเรียกจากปุ่ม "นำเข้า" ในหน้าอื่น (เช่น
  // StaffRoleManagementPage/StudentManagementPage) ที่หน้าเดิมยังต้องอยู่ด้านหลังให้กลับไปได้
  // 'inline' = render เป็น section เต็มหน้าปกติแทน ไม่มี fixed overlay/backdrop/X ปิด — ใช้ตอนเป็นเนื้อหา
  // หลักของหน้าเอง (เช่นเมนู "นำเข้าภาระงานสอน" ใน AdminPortal.tsx ที่ควรแสดงแบบ routed section
  // เหมือนเมนูอื่นๆ ไม่ใช่ popup ลอย) — เนื้อหา/ฟังก์ชันการทำงานข้างในเหมือนกันทุกประการ เปลี่ยนแค่ wrapper
  variant?: 'modal' | 'inline';
  // true = ประเภทข้อมูลถูกล็อกจาก initialImportType (ใช้เมื่ออยู่ในการ์ดของหน้านำเข้า): ซ่อน header, ตัวเลือกประเภท
  // และปุ่มยกเลิก — เหลือเทมเพลต + โซนลากไฟล์ + ตารางตรวจสอบ + ปุ่มยืนยัน; logic parse/เขียนเหมือนเดิมทุกประการ
  lockImportType?: boolean;
  // ใช้แทนการสลับประเภทเองเมื่อ lockImportType (เช่น ปุ่ม "ไปนำเข้าบุคลากร" ในคำเตือนของตารางสอน)
  onRequestSwitchType?: (type: ImportType) => void;
  // แจ้งผู้ใช้งาน (เจ้าของการ์ด) ว่ากำลังเขียน Firestore อยู่ — กันสลับการ์ดกลางคัน
  onBusyChange?: (busy: boolean) => void;
}

export interface ValidatedRow {
  id: string; // Row index or unique key
  col1: string; // e.g. Student ID / Teacher ID / Course Code
  col2: string; // e.g. Name / Course Name
  col3: string; // e.g. Room / Email / Credits
  col4: string; // e.g. Student No / Position / Instructor
  isValid: boolean;
  errorMessage?: string;
  warnings?: string[];
  parsedData: Record<string, any>;
}

// Normalize object keys for flexible column matching
function normalizeRowKeys(row: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(row)) {
    const cleanKey = key.trim().toLowerCase().replace(/[\s_\-\.\/]+/g, '');
    result[cleanKey] = typeof value === 'string' ? value.trim() : value;
  }
  return result;
}

// Helper to extract value using multiple candidate column names
function getFieldValue(normalized: Record<string, any>, candidates: string[]): string {
  for (const candidate of candidates) {
    const cleanCandidate = candidate.toLowerCase().replace(/[\s_\-\.\/]+/g, '');
    if (normalized[cleanCandidate] !== undefined && normalized[cleanCandidate] !== null && normalized[cleanCandidate] !== '') {
      return String(normalized[cleanCandidate]).trim();
    }
  }
  return '';
}

export function BulkDataImportModal({ isOpen, onClose, initialImportType, onImportSuccess, variant = 'modal', lockImportType = false, onRequestSwitchType, onBusyChange }: BulkDataImportModalProps) {
  const [importType, setImportType] = useState<ImportType>(initialImportType || 'STUDENT');
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [rawParsedRows, setRawParsedRows] = useState<Record<string, any>[] | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importError, setImportError] = useState<string | null>(null);
  const [realStaffList, setRealStaffList] = useState<Array<{ id: string; fullName?: string; firstName?: string; lastName?: string; displayName?: string; email?: string; prefix?: string; status?: string }>>([]);
  const [isStaffLoading, setIsStaffLoading] = useState(false);
  const [realStudentIds, setRealStudentIds] = useState<Set<string>>(new Set());
  const [isStudentIdsLoading, setIsStudentIdsLoading] = useState(false);

  // โหมด sync/replace สำหรับ COURSE: schedule เก่าของครูที่อยู่ในไฟล์นี้ ที่ไม่มีในไฟล์ใหม่
  const [staleSchedules, setStaleSchedules] = useState<{ id: string; label: string }[]>([]);
  const [scanningStale, setScanningStale] = useState(false);
  const [replaceStale, setReplaceStale] = useState(false);

  // ผลกระทบของการนำเข้าซ้ำ (เปลี่ยนครู / เก็บกวาดครูที่ปิดการใช้งาน) — แอดมินต้องตรวจและยืนยันก่อนนำเข้า
  // ทีละรายการ หรือยืนยันทั้งหมดในคราวเดียว (confirmedReviewKeys เก็บคีย์ `change:<id>` / `cleanup:<id>`)
  const [importImpact, setImportImpact] = useState<ImportImpact | null>(null);
  const [confirmedReviewKeys, setConfirmedReviewKeys] = useState<Set<string>>(new Set());

  const fileInputRef = useRef<HTMLInputElement>(null);
  const staffSigRef = useRef<string>('');

  // Sync initialImportType when modal opens
  useEffect(() => {
    if (isOpen && initialImportType) {
      setImportType(initialImportType);
    }
  }, [isOpen, initialImportType]);

  // Load real staff from Firestore for teacher matching — LIVE listener (onSnapshot)
  // so การจับคู่ครูตอน import COURSE ไม่พึ่งจังหวะ fetch ครั้งเดียวอีกต่อไป
  useEffect(() => {
    if (!isOpen) return;
    setIsStaffLoading(true);
    const unsubscribe = onSnapshot(
      collection(db, 'staff'),
      (snap) => {
        const staff = snap.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            email: data.email || '',
            prefix: data.prefix || '',
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            fullName: data.fullName || `${data.prefix || ''}${data.firstName || ''} ${data.lastName || ''}`.trim(),
            displayName: data.displayName || '',
            // ใช้ตัดสินว่าครูที่ถูกแทนที่ "ปิดการใช้งาน" แล้วหรือยัง (เก็บกวาดตารางได้) — ดู lib/staffStatus.ts
            status: typeof data.status === 'string' ? data.status : '',
          };
        });
        setIsStaffLoading(false);
        // long-poll listener ยิง snapshot ซ้ำเป็นระยะแม้ข้อมูลไม่เปลี่ยน — เทียบเนื้อหาก่อน
        // ถ้าเหมือนเดิม อย่า setRealStaffList (ไม่งั้น previewData useMemo re-compute + re-render รัว ๆ
        // จนเกิดจังหวะที่กดปุ่มยืนยันไม่ติด)
        const sig = staff.map(s => `${s.id}${s.email}${s.fullName}${s.displayName}${s.status}`).join('');
        if (sig === staffSigRef.current) return;
        staffSigRef.current = sig;
        setRealStaffList(staff);
      },
      (err) => {
        console.error('[BulkDataImportModal] Error loading staff roster:', err);
        setIsStaffLoading(false);
      }
    );
    return () => unsubscribe();
  }, [isOpen]);

  // Load real student IDs from Firestore for PARENT import validation
  useEffect(() => {
    if (!isOpen) return;
    const fetchStudentIds = async () => {
      setIsStudentIdsLoading(true);
      try {
        const snap = await getDocs(collection(db, 'students'));
        const ids = new Set<string>();
        snap.docs.forEach(d => {
          ids.add(d.id);
          const sid = d.data().studentId;
          if (sid) ids.add(String(sid));
        });
        setRealStudentIds(ids);
      } catch (err) {
        console.error('[BulkDataImportModal] Error loading student roster:', err);
      } finally {
        setIsStudentIdsLoading(false);
      }
    };
    fetchStudentIds();
  }, [isOpen]);

  // Access current user role from store
  const user = useStore(state => state.user);
  const addStudentsToStore = (newStudents: Student[]) => {
    const currentStudents = useStore.getState().students;
    const studentMap = new Map(currentStudents.map(s => [s.studentId, s]));
    newStudents.forEach(s => studentMap.set(s.studentId, s));
    useStore.setState({ students: Array.from(studentMap.values()) });
  };

  const addCoursesToStore = (newCourses: Course[], newGlobalCourses: GlobalCourse[]) => {
    const currentCourses = useStore.getState().courses;
    const currentGlobal = useStore.getState().globalCourses;
    const courseMap = new Map(currentCourses.map(c => [c.id, c]));
    const globalMap = new Map(currentGlobal.map(g => [g.courseId, g]));

    newCourses.forEach(c => courseMap.set(c.id, c));
    newGlobalCourses.forEach(g => globalMap.set(g.courseId, g));

    useStore.setState({ 
      courses: Array.from(courseMap.values()),
      globalCourses: Array.from(globalMap.values())
    });
  };

  // Determine current user's permissions
  const userRoles: UserRole[] = useMemo(() => {
    if (!user) return [];
    const roles: UserRole[] = [];
    if (user.activeRole) roles.push(user.activeRole);
    if (user.profile?.roles) {
      user.profile.roles.forEach(r => {
        if (!roles.includes(r)) roles.push(r);
      });
    }
    if (user.role === 'admin' && !roles.includes('SUPER_ADMIN')) {
      roles.push('SUPER_ADMIN');
    }
    return roles;
  }, [user]);

  const hasPermissionForCurrentType = useMemo(() => {
    const isSuperAdmin = userRoles.includes('SUPER_ADMIN');
    const isHomeroom = userRoles.includes('HOMEROOM_TEACHER');
    const isSubjectTeacher = userRoles.includes('SUBJECT_TEACHER');

    if (importType === 'TEACHER') {
      return isSuperAdmin;
    }
    if (importType === 'PARENT') {
      return isSuperAdmin;
    }
    if (importType === 'STUDENT') {
      return isSuperAdmin || isHomeroom;
    }
    if (importType === 'COURSE') {
      return isSuperAdmin || isHomeroom || isSubjectTeacher;
    }
    return false;
  }, [importType, userRoles]);

  // Download template CSV file — header row ต้องตรงกับที่ validateRows()/parser คาดหวัง (เนื้อหาอยู่ใน lib/importTemplates.ts)
  const handleDownloadTemplate = () => {
    const headers = IMPORT_TEMPLATES[importType];
    const filename = templateFilename(importType);

    const bom = '\uFEFF';
    const blob = new Blob([bom + headers], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Real validation against parsed rows
  const validateRows = (rawRows: Record<string, any>[], type: ImportType): ValidatedRow[] => {
    // 1. Dedicated Teacher Load Report (รายงานภาระงานสอน) Parser for COURSE
    if (type === 'COURSE' && isTeacherLoadReportFormat(rawRows)) {
      const { courseRows } = parseTeacherLoadReport(rawRows, realStaffList);
      
      return courseRows.map((row, idx) => ({
        id: `course_load_${idx + 1}`,
        col1: row.subjectCode || 'ไม่มีรหัส',
        col2: `${row.subjectName}${row.subjectType === 'ACTIVITY' ? ' (กิจกรรม)' : ''}`,
        col3: `${row.teacherName} • ${row.slots.length} คาบ (${row.scheduleRaw})`,
        col4: `${row.room ? `ห้อง ${row.room}` : '-'} • ${row.level || '-'}`,
        isValid: row.isValid,
        errorMessage: row.errors.length > 0 ? `⚠️ ${row.errors.join(', ')}` : undefined,
        warnings: row.warnings,
        parsedData: {
          isTeacherLoadReport: true,
          subjectCode: row.subjectCode,
          subjectName: row.subjectName,
          room: row.room,
          level: row.level,
          credits: 1.5,
          slots: row.slots,
          subjectType: row.subjectType,
          teacherName: row.teacherName,
          teacherEmail: row.teacherEmail,
          department: row.department,
          matchedTeacherId: row.matchedTeacherId,
          matchedTeacherEmail: row.matchedTeacherEmail,
          unlinkedTeacherName: row.unlinkedTeacherName,
          unlinkedTeacherEmail: row.unlinkedTeacherEmail,
          expectedPeriodCount: row.expectedPeriodCount,
          scheduleRaw: row.scheduleRaw
        }
      }));
    }

    // 2. Standard / Legacy Row Validation
    const seenIds = new Set<string>();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^0[0-9]{8,9}$/;

    return rawRows.map((raw, idx) => {
      const normalized = normalizeRowKeys(raw);
      const rowId = String(idx + 1);

      if (type === 'STUDENT') {
        const studentId = getFieldValue(normalized, ['studentid', 'id', 'studentcode', 'code', 'รหัสนักเรียน', 'รหัสประจำตัว', 'เลขประจำตัว']);
        let prefix = getFieldValue(normalized, ['prefix', 'title', 'คำนำหน้า', 'คำนำหน้านาม']);
        let firstName = getFieldValue(normalized, ['firstname', 'first_name', 'ชื่อ', 'ชื่อจริง']);
        let lastName = getFieldValue(normalized, ['lastname', 'last_name', 'นามสกุล']);
        const rawFullName = getFieldValue(normalized, ['fullname', 'name', 'ชื่อนามสกุล', 'ชื่อและนามสกุล']);
        const room = getFieldValue(normalized, ['room', 'classname', 'class', 'grade', 'graderoom', 'ห้อง', 'ห้องเรียน', 'ระดับชั้น']);
        const studentNoStr = getFieldValue(normalized, ['studentno', 'number', 'no', 'studentnumber', 'เลขที่']);
        const parentMobile = getFieldValue(normalized, ['parentmobile', 'parentphone', 'mobile', 'phone', 'เบอร์โทรผู้ปกครอง', 'เบอร์ผู้ปกครอง', 'เบอร์โทร']);

        // Handle single fullName column if separate fields are not given
        if (!firstName && rawFullName) {
          const parts = rawFullName.trim().split(/\s+/);
          if (['นาย', 'นางสาว', 'นาง', 'เด็กชาย', 'เด็กหญิง', 'ด.ช.', 'ด.ญ.'].includes(parts[0])) {
            prefix = parts[0];
            firstName = parts[1] || '';
            lastName = parts.slice(2).join(' ') || '';
          } else {
            firstName = parts[0] || '';
            lastName = parts.slice(1).join(' ') || '';
          }
        }

        const fullName = `${prefix ? prefix : ''}${firstName} ${lastName}`.trim() || rawFullName;
        const studentNo = parseInt(studentNoStr, 10);

        let isValid = true;
        const errors: string[] = [];

        if (!studentId) {
          isValid = false;
          errors.push('ขาดรหัสประจำตัวนักเรียน (Student ID)');
        } else if (seenIds.has(studentId)) {
          isValid = false;
          errors.push(`รหัสประจำตัวซ้ำซ้อน (${studentId})`);
        } else {
          seenIds.add(studentId);
        }

        if (!firstName && !rawFullName) {
          isValid = false;
          errors.push('ขาดชื่อ-นามสกุลนักเรียน');
        }

        if (!room) {
          isValid = false;
          errors.push('ขาดการระบุห้องเรียน (เช่น ม.5/8)');
        }

        if (studentNoStr && (isNaN(studentNo) || studentNo <= 0)) {
          isValid = false;
          errors.push('เลขที่ต้องเป็นจำนวนเต็มบวก');
        }

        if (parentMobile && !phoneRegex.test(parentMobile.replace(/[-\s]/g, ''))) {
          isValid = false;
          errors.push('เบอร์โทรศัพท์ผู้ปกครองไม่ถูกต้อง (ต้องเป็นตัวเลข 9-10 หลักขึ้นต้นด้วย 0)');
        }

        return {
          id: rowId,
          col1: studentId || 'ไม่มีข้อมูล',
          col2: fullName || 'ไม่มีข้อมูล',
          col3: room || 'ไม่มีข้อมูล',
          col4: studentNoStr ? `เลขที่ ${studentNoStr}` : 'ไม่ได้ระบุเลขที่',
          isValid,
          errorMessage: errors.length > 0 ? `⚠️ ${errors.join(', ')}` : undefined,
          parsedData: {
            studentId,
            prefix: prefix || 'นาย',
            firstName,
            lastName,
            fullName,
            room,
            studentNo: isNaN(studentNo) || studentNo <= 0 ? (idx + 1) : studentNo,
            parentMobile: parentMobile ? parentMobile.replace(/[-\s]/g, '') : '',
          }
        };
      } else if (type === 'TEACHER') {
        const teacherId = getFieldValue(normalized, ['teacherid', 'id', 'staffid', 'รหัสครู', 'รหัสประจำตัวครู', 'รหัสบุคลากร']);
        let prefix = getFieldValue(normalized, ['prefix', 'title', 'คำนำหน้า']);
        let firstName = getFieldValue(normalized, ['firstname', 'first_name', 'ชื่อ', 'ชื่อจริง']);
        let lastName = getFieldValue(normalized, ['lastname', 'last_name', 'นามสกุล']);
        const rawFullName = getFieldValue(normalized, ['fullname', 'name', 'ชื่อนามสกุล']);
        const position = getFieldValue(normalized, ['position', 'ตำแหน่ง']);
        // normalize ตั้งแต่ตอน parse — ทั้ง validation, preview และ payload ที่เขียนลง staff/teachers ใช้ค่าเดียวกัน
        const email = normalizeEmail(getFieldValue(normalized, ['email', 'e-mail', 'อีเมล', 'อีเมล์']));
        const rolesStr = getFieldValue(normalized, ['roles', 'role', 'บทบาท', 'สิทธิ์']);
        const department = getFieldValue(normalized, ['department', 'departmentid', 'dept', 'กลุ่มสาระ', 'กลุ่มสาระฯ', 'สังกัด']);

        if (!firstName && rawFullName) {
          const parts = rawFullName.trim().split(/\s+/);
          if (['นาย', 'นางสาว', 'นาง', 'ดร.'].includes(parts[0])) {
            prefix = parts[0];
            firstName = parts[1] || '';
            lastName = parts.slice(2).join(' ') || '';
          } else {
            firstName = parts[0] || '';
            lastName = parts.slice(1).join(' ') || '';
          }
        }

        const fullName = `${prefix ? prefix : ''}${firstName} ${lastName}`.trim() || rawFullName;

        let isValid = true;
        const errors: string[] = [];

        if (!teacherId) {
          isValid = false;
          errors.push('ขาดรหัสประจำตัวครู (ID)');
        } else if (seenIds.has(teacherId)) {
          isValid = false;
          errors.push(`รหัสประจำตัวซ้ำซ้อน (${teacherId})`);
        } else {
          seenIds.add(teacherId);
        }

        if (!firstName && !rawFullName) {
          isValid = false;
          errors.push('ขาดชื่อ-นามสกุลครู');
        }

        if (!email) {
          isValid = false;
          errors.push('ขาดอีเมลบุคลากร');
        } else if (!emailRegex.test(email)) {
          isValid = false;
          errors.push('รูปแบบอีเมลไม่ถูกต้อง');
        }

        // บทบาท: ถ้า admin กรอกคอลัมน์ Roles มา → ใช้ตามนั้น
        // ถ้าเว้นว่าง (หรือกรอกแล้วเหลือ 0 หลัง trim) → ตั้งเป็นครูผู้สอนอัตโนมัติ
        // (นำเข้ารายชื่อก่อน แล้วค่อยกำหนดบทบาทพิเศษทีหลังที่หน้า "จัดการสิทธิ์บุคลากร")
        const parsedRoles = rolesStr
          ? (rolesStr.split(/[,;|]/).map(r => r.trim()).filter(Boolean) as UserRole[])
          : [];
        const rolesArray: UserRole[] = parsedRoles.length > 0 ? parsedRoles : ['SUBJECT_TEACHER'];
        const usedRoleDefault = parsedRoles.length === 0;

        const teacherWarnings: string[] = [];
        if (usedRoleDefault) {
          teacherWarnings.push('ℹ️ ไม่ได้ระบุบทบาท — ตั้งเป็นครูผู้สอน (SUBJECT_TEACHER) อัตโนมัติ');
        }
        if (!department) {
          teacherWarnings.push('ℹ️ ไม่ได้ระบุกลุ่มสาระฯ — กำหนดภายหลังได้ที่หน้า "จัดการสิทธิ์บุคลากร"');
        }

        return {
          id: rowId,
          col1: teacherId || 'ไม่มีข้อมูล',
          col2: fullName || 'ไม่มีข้อมูล',
          col3: email || 'ไม่มีข้อมูล',
          col4: position || 'ครูผู้สอน',
          isValid,
          errorMessage: errors.length > 0 ? `⚠️ ${errors.join(', ')}` : undefined,
          warnings: teacherWarnings.length > 0 ? teacherWarnings : undefined,
          parsedData: {
            teacherId,
            prefix: prefix || 'ครู',
            firstName,
            lastName,
            fullName,
            position: position || 'ครูผู้สอน',
            email,
            roles: rolesArray,
            // กลุ่มสาระฯ เว้นว่างได้ ('' = ยังไม่ระบุ ไม่ถือเป็น error) — กำหนดทีหลังที่หน้าจัดการสิทธิ์
            departmentId: department || ''
          }
        };
      } else if (type === 'PARENT') {
        // PARENT — ข้อมูลยืนยันตัวตนผู้ปกครองสำหรับเทียบตอนเชื่อมบัญชี LINE (LIFF) ครั้งแรก
        const studentId = getFieldValue(normalized, ['studentid', 'id', 'studentcode', 'code', 'รหัสนักเรียน', 'รหัสประจำตัว', 'เลขประจำตัว']);
        const parentPrefix = getFieldValue(normalized, ['parentprefix', 'prefix', 'คำนำหน้า', 'คำนำหน้าผู้ปกครอง']);
        const parentFirstName = getFieldValue(normalized, ['parentfirstname', 'firstname', 'ชื่อผู้ปกครอง', 'ชื่อ']);
        const parentLastName = getFieldValue(normalized, ['parentlastname', 'lastname', 'นามสกุลผู้ปกครอง', 'นามสกุล']);
        const parentNationalIdRaw = getFieldValue(normalized, ['parentnationalid', 'nationalid', 'idcard', 'citizenid', 'เลขบัตรประชาชน', 'เลขประจำตัวประชาชน']);
        const parentMobile = getFieldValue(normalized, ['parentmobile', 'parentphone', 'mobile', 'phone', 'เบอร์โทรผู้ปกครอง', 'เบอร์ผู้ปกครอง', 'เบอร์โทร']);
        const relationship = getFieldValue(normalized, ['relationship', 'relation', 'ความสัมพันธ์', 'เกี่ยวข้องเป็น']);

        const parentNationalId = parentNationalIdRaw.replace(/[\s-]/g, '');
        const fullName = `${parentPrefix}${parentFirstName} ${parentLastName}`.trim();

        let isValid = true;
        const errors: string[] = [];

        if (!studentId) {
          isValid = false;
          errors.push('ขาดรหัสประจำตัวนักเรียน (Student ID)');
        } else if (realStudentIds.size > 0 && !realStudentIds.has(studentId)) {
          isValid = false;
          errors.push(`ไม่พบรหัสนักเรียน ${studentId} ในระบบ (students collection)`);
        } else if (seenIds.has(studentId)) {
          isValid = false;
          errors.push(`มีข้อมูลผู้ปกครองของนักเรียน ${studentId} ซ้ำในไฟล์ (1 นักเรียนต่อ 1 แถว)`);
        } else {
          seenIds.add(studentId);
        }

        if (!parentFirstName || !parentLastName) {
          isValid = false;
          errors.push('ขาดชื่อ-นามสกุลผู้ปกครอง');
        }

        if (!parentNationalId) {
          isValid = false;
          errors.push('ขาดเลขบัตรประชาชนผู้ปกครอง');
        } else if (!isValidThaiNationalId(parentNationalId)) {
          isValid = false;
          errors.push('เลขบัตรประชาชนไม่ถูกต้อง (checksum หลักที่ 13 ไม่ผ่าน)');
        }

        if (parentMobile && !phoneRegex.test(parentMobile.replace(/[-\s]/g, ''))) {
          isValid = false;
          errors.push('เบอร์โทรผู้ปกครองไม่ถูกต้อง (ตัวเลข 9-10 หลักขึ้นต้นด้วย 0)');
        }

        if (!relationship) {
          isValid = false;
          errors.push('ขาดการระบุความสัมพันธ์');
        } else if (!PARENT_RELATIONSHIPS.includes(relationship as any)) {
          isValid = false;
          errors.push(`ความสัมพันธ์ต้องเป็น ${PARENT_RELATIONSHIPS.join(' / ')} เท่านั้น`);
        }

        return {
          id: rowId,
          col1: studentId || 'ไม่มีข้อมูล',
          col2: fullName || 'ไม่มีข้อมูล',
          col3: relationship || 'ไม่ระบุ',
          col4: parentMobile ? parentMobile.replace(/[-\s]/g, '') : 'ไม่ระบุเบอร์',
          isValid,
          errorMessage: errors.length > 0 ? `⚠️ ${errors.join(', ')}` : undefined,
          parsedData: {
            studentId,
            parentPrefix: parentPrefix || '',
            parentFirstName,
            parentLastName,
            parentNationalId, // ดิบ — อยู่ใน state ชั่วคราวเท่านั้น, จะถูก hash ก่อนเขียน Firestore
            parentMobile: parentMobile ? parentMobile.replace(/[-\s]/g, '') : '',
            relationship,
          },
        };
      } else {
        // COURSE
        const courseCode = getFieldValue(normalized, ['coursecode', 'code', 'subjectcode', 'รหัสวิชา']);
        const courseName = getFieldValue(normalized, ['coursename', 'name', 'subjectname', 'ชื่อวิชา', 'รายวิชา']);
        const level = getFieldValue(normalized, ['level', 'grade', 'ระดับชั้น']);
        const room = getFieldValue(normalized, ['room', 'classname', 'class', 'ห้อง', 'ห้องเรียน']);
        const creditsStr = getFieldValue(normalized, ['credits', 'credit', 'หน่วยกิต']);
        const instructorId = getFieldValue(normalized, ['instructorid', 'teacherid', 'teachername', 'อาจารย์ผู้สอน', 'ครูผู้สอน']);

        const credits = parseFloat(creditsStr);
        let isValid = true;
        const errors: string[] = [];

        if (!courseCode) {
          isValid = false;
          errors.push('ขาดรหัสวิชา (Course Code)');
        }

        if (!courseName) {
          isValid = false;
          errors.push('ขาดชื่อรายวิชา');
        }

        if (!room && !level) {
          isValid = false;
          errors.push('ขาดการระบุระดับชั้นหรือห้องเรียน');
        }

        if (!creditsStr || isNaN(credits) || credits < 0.5 || credits > 5.0) {
          isValid = false;
          errors.push('จำนวนหน่วยกิตอยู่นอกเกณฑ์มาตรฐาน (0.5 - 5.0)');
        }

        return {
          id: rowId,
          col1: courseCode || 'ไม่มีข้อมูล',
          col2: courseName || 'ไม่มีข้อมูล',
          col3: !isNaN(credits) ? `${credits} หน่วยกิต` : (creditsStr || 'ไม่มีข้อมูล'),
          col4: [level, room && room !== level ? `ห้อง ${room}` : ''].filter(Boolean).join(' • ') || 'ทุกห้อง',
          isValid,
          errorMessage: errors.length > 0 ? `⚠️ ${errors.join(', ')}` : undefined,
          parsedData: {
            courseCode,
            courseName,
            level: level || (room.includes('/') ? room.split('/')[0] : room),
            room: room || level,
            credits: isNaN(credits) ? 1.5 : credits,
            instructorId
          }
        };
      }
    });
  };

  // Drag behavior
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      processFile(droppedFile);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  // Real file processing with PapaParse and SheetJS (XLSX)
  const processFile = async (selectedFile: File) => {
    setImportError(null);
    const extension = selectedFile.name.split('.').pop()?.toLowerCase();
    
    if (extension !== 'xlsx' && extension !== 'xls' && extension !== 'csv') {
      setImportError('❌ กรุณาเลือกอัปโหลดไฟล์ตระกูล Excel (.xlsx, .xls) หรือ CSV (.csv) เท่านั้น');
      return;
    }

    setFile(selectedFile);

    try {
      if (extension === 'csv') {
        Papa.parse<Record<string, any>>(selectedFile, {
          header: true,
          skipEmptyLines: 'greedy',
          complete: (results) => {
            if (results.errors && results.errors.length > 0 && results.data.length === 0) {
              setImportError(`เกิดข้อผิดพลาดในการอ่านไฟล์ CSV: ${results.errors[0].message}`);
              return;
            }
            // เก็บ raw rows ไว้ — การ validate จะทำผ่าน useEffect ที่ re-run เมื่อ staff/student list เปลี่ยน
            setRawParsedRows(results.data);
          },
          error: (error) => {
            setImportError(`ไม่สามารถอ่านไฟล์ CSV ได้: ${error.message}`);
          }
        });
      } else {
        // Excel files (.xlsx, .xls)
        const arrayBuffer = await selectedFile.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          setImportError('ไม่พบแผ่นงาน (Worksheet) ในไฟล์ Excel ที่เลือก');
          return;
        }

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

        if (rawJson.length === 0) {
          setImportError('ไม่พบแถวข้อมูลในไฟล์ Excel ที่เลือก');
          return;
        }

        // เก็บ raw rows ไว้ — การ validate จะทำผ่าน useEffect ที่ re-run เมื่อ staff/student list เปลี่ยน
        setRawParsedRows(rawJson);
      }
    } catch (err: any) {
      console.error('[BulkDataImportModal] Parsing Error:', err);
      setImportError(`เกิดข้อผิดพลาดในการประมวลผลไฟล์: ${err?.message || 'รูปแบบไฟล์ไม่ถูกต้อง'}`);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setRawParsedRows(null); // previewData (useMemo) จะกลายเป็น [] เอง
    setImportError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Real batched Firestore writes (chunked <= 500)
  const handleConfirmImport = async () => {
    // ห้าม early-return เงียบ ๆ (CLAUDE.md) — ต้องมี feedback ที่ผู้ใช้เห็นได้เสมอ
    if (!file) {
      setImportError('กรุณาเลือกไฟล์ก่อนกดยืนยันการนำเข้าข้อมูล');
      return;
    }
    if (!isValidated) {
      setImportError('ระบบกำลังอ่านและตรวจสอบไฟล์อยู่ กรุณารอสักครู่แล้วลองใหม่');
      return;
    }
    if (previewData.length === 0) {
      setImportError('ไม่พบแถวข้อมูลในไฟล์ที่ตรวจสอบได้ กรุณาตรวจไฟล์ต้นฉบับหรืออัปโหลดไฟล์ใหม่');
      return;
    }

    // กันไม่ให้ import ก่อนข้อมูลอ้างอิงโหลดเสร็จ (COURSE→staff, PARENT→students)
    if (importType === 'COURSE' && isStaffLoading) {
      setImportError('กำลังโหลดรายชื่อครูจากฐานข้อมูล กรุณารอสักครู่แล้วลองใหม่');
      return;
    }
    if (importType === 'PARENT' && isStudentIdsLoading) {
      setImportError('กำลังโหลดรายชื่อนักเรียนจากฐานข้อมูล กรุณารอสักครู่แล้วลองใหม่');
      return;
    }

    if (!hasPermissionForCurrentType) {
      alert(`❌ คุณไม่มีสิทธิ์ในการนำเข้าข้อมูลประเภท ${importType}`);
      return;
    }
    
    // Filter only valid rows
    const validRows = previewData.filter(r => r.isValid);
    if (validRows.length === 0) {
      alert('❌ ไม่พบแถวข้อมูลที่ผ่านการตรวจสอบความถูกต้อง กรุณาปรับปรุงไฟล์เอกสารก่อนนำเข้า');
      return;
    }

    // ตารางสอนต้องผูกภาคเรียน (ส่วนของ doc id + field academicYear/term) — อ่านค่าที่ตั้งไว้จริงเท่านั้น
    // ยังไม่ได้ตั้งค่า = หยุดการนำเข้าทั้งหมด ไม่เดา/ไม่ fallback จากวันที่
    let semesterForImport: ScheduleSemester | null = null;
    if (importType === 'COURSE') {
      try {
        semesterForImport = await requireConfiguredSemester();
      } catch (err) {
        setImportError(`❌ ${err instanceof Error ? err.message : String(err)}`);
        return;
      }
    }
    const sem = semesterForImport as ScheduleSemester;

    // ผลกระทบของการนำเข้าซ้ำ (เปลี่ยนครู/เก็บกวาด): แอดมินต้องตรวจและยืนยันครบทุกรายการก่อน และต้องเป็น SUPER_ADMIN
    // (การโอนประวัติ/เก็บกวาด/เขียน log ทำได้เฉพาะ SUPER_ADMIN ตาม rules)
    if (importType === 'COURSE' && importImpact) {
      if (!isImpactFullyConfirmed(importImpact, confirmedReviewKeys)) {
        setImportError('❌ กรุณาตรวจสอบและยืนยันรายการที่ได้รับผลกระทบให้ครบก่อนนำเข้า (ยืนยันทีละรายการ หรือกด "ยืนยันทั้งหมด")');
        return;
      }
      if (reviewKeysOf(importImpact).length > 0 && !userRoles.includes('SUPER_ADMIN')) {
        setImportError('❌ ไฟล์นี้ทำให้มีการเปลี่ยนครู/เก็บกวาดตาราง ซึ่งต้องให้ผู้ดูแลระบบ (SUPER_ADMIN) เป็นผู้นำเข้า');
        return;
      }
    }

    setIsImporting(true);
    setImportProgress(10);
    setImportError(null);

    const BATCH_SIZE = 450; // Keep safely below 500 Firestore limit
    const totalValid = validRows.length;
    let processedCount = 0;

    try {
      const newStudentsToStore: Student[] = [];
      const newCoursesToStore: Course[] = [];
      const newGlobalCoursesToStore: GlobalCourse[] = [];

      // TASK 3 (ครูร่วมสอน — ยืนยันจากข้อมูลจริง Teacher_Load_Report เช่น HR ม.5/8 มี 2 ครูรับผิดชอบ
      // ร่วมกัน): ไฟล์รายงานภาระงานสอนแยกเป็น "แถวต่อครูหนึ่งคน" เสมอ — 2 ครูที่รับผิดชอบคาบ/ห้อง
      // เดียวกันจริงจะได้ scheduleDocId ตรงกัน (scheduleDocIdFor ไม่ฝัง teacherKey ให้ ACTIVITY ที่มี
      // ห้องเรียนจริงระบุอยู่) แต่การเขียนแบบเดิม (batch.set ทีละแถว ทับด้วย teacherIds: [ครูคนนั้นคน
      // เดียว] ทุกครั้ง) จะทำให้ครูคนหลังในไฟล์ทับ teacherIds ของครูคนก่อนหน้าเงียบๆ — เหมือนบั๊ก PLC
      // เดิมที่เคย fix ไปแล้ว (ดู ROOT CAUSE FIX ด้านบน) ต้อง scan ทุกแถวก่อนเขียนจริง แล้ว union
      // teacherIds ต่อ scheduleDocId ไว้ล่วงหน้า จากนั้นทุกแถวที่ตกลง doc id เดียวกันจะเขียน "อาร์เรย์
      // ที่รวมครบแล้ว" ชุดเดียวกันเสมอ ไม่ว่าจะประมวลผลตามลำดับไหน (idempotent, ไม่ใช่ last-write-wins)
      const mergedTeachersByScheduleId = new Map<string, {
        teacherIds: string[];
        primaryTeacherId: string | null;
        primaryTeacherEmail: string | null;
        primaryTeacherName: string;
        unlinkedTeacherName: string | null;
        unlinkedTeacherEmail: string | null;
      }>();
      if (importType === 'COURSE') {
        for (const row of validRows) {
          const parsedData = row.parsedData as any;
          if (!parsedData?.isTeacherLoadReport) continue;
          const teacherKey = primaryTeacherKey(parsedData);
          for (const slot of (parsedData.slots || [])) {
            const scheduleDocId = scheduleDocIdFor(parsedData.subjectCode, parsedData.room, parsedData.level, slot.dayOfWeek, slot.periodNumber, parsedData.subjectType, teacherKey, sem);
            const entry = mergedTeachersByScheduleId.get(scheduleDocId) || {
              teacherIds: [], primaryTeacherId: null, primaryTeacherEmail: null, primaryTeacherName: '',
              unlinkedTeacherName: null, unlinkedTeacherEmail: null,
            };
            if (parsedData.matchedTeacherId) {
              if (!entry.teacherIds.includes(parsedData.matchedTeacherId)) entry.teacherIds.push(parsedData.matchedTeacherId);
              if (!entry.primaryTeacherId) {
                entry.primaryTeacherId = parsedData.matchedTeacherId;
                entry.primaryTeacherEmail = parsedData.matchedTeacherEmail || parsedData.teacherEmail || null;
                entry.primaryTeacherName = parsedData.teacherName || '';
              }
            } else if (!entry.primaryTeacherId && !entry.unlinkedTeacherName) {
              // ยังไม่มีครูที่ match ได้เลยสำหรับ doc นี้ — เก็บข้อมูล unlinked ไว้ก่อน (ถ้ามีครูคนอื่น
              // ใน doc เดียวกัน match ได้ทีหลัง จะไม่ทับของครูที่ match ได้แล้ว)
              entry.unlinkedTeacherName = parsedData.unlinkedTeacherName || parsedData.teacherName || null;
              entry.unlinkedTeacherEmail = parsedData.unlinkedTeacherEmail || parsedData.teacherEmail || null;
              entry.primaryTeacherName = entry.primaryTeacherName || parsedData.teacherName || '';
            }
            mergedTeachersByScheduleId.set(scheduleDocId, entry);
          }
        }
      }

      for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
        const chunk = validRows.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);

        for (const row of chunk) {
          const { parsedData } = row;

          if (importType === 'STUDENT') {
            const studentRef = doc(db, 'students', parsedData.studentId);
            
            // Clean Firestore Document payload with NO synthetic parent placeholder
            const studentPayload = {
              id: parsedData.studentId,
              studentId: parsedData.studentId,
              studentCode: parsedData.studentId,
              studentNo: parsedData.studentNo,
              studentNumber: parsedData.studentNo,
              number: parsedData.studentNo,
              title: parsedData.prefix,
              prefix: parsedData.prefix,
              firstName: parsedData.firstName,
              lastName: parsedData.lastName,
              name: parsedData.fullName,
              fullName: parsedData.fullName,
              nickname: '',
              room: parsedData.room,
              className: parsedData.room,
              grade: parsedData.room.includes('/') ? parsedData.room.split('/')[0] : parsedData.room,
              behaviorScore: 100,
              riskLevel: 'NORMAL',
              status: 'ACTIVE',
              // ห้ามใส่ parentUid/parentId/studentUid ที่นี่ — เขียนแบบ merge อยู่แล้ว
              // ถ้าใส่ null ลงไป การ re-import จะลบ link ที่เชื่อมไว้แล้ว (เช่นบัญชีทดสอบนักเรียน/ผู้ปกครอง)
              // นักเรียนใหม่ที่ยังไม่มี field เหล่านี้ = ยังไม่ผูกบัญชี ซึ่งถูกต้องอยู่แล้ว
              parentMobile: parsedData.parentMobile || '',
              homeLocation: {
                address: '',
                coordinates: [13.7563, 100.5018],
                routeImage: ''
              },
              attendance: {
                morningStatus: 'PRESENT',
                checkInMethod: 'MANUAL',
                checkInTime: null
              },
              seatIndex: null,
              photoUrl: '',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            };

            batch.set(studentRef, studentPayload, { merge: true });

            newStudentsToStore.push({
              ...studentPayload,
              attendance: {
                morningStatus: 'PRESENT',
                checkInMethod: 'MANUAL',
                checkInTime: null
              }
            } as unknown as Student);

          } else if (importType === 'TEACHER') {
            const teacherRef = doc(db, 'teachers', parsedData.teacherId);
            const staffRef = doc(db, 'staff', parsedData.teacherId);

            const teacherPayload = {
              id: parsedData.teacherId,
              teacherId: parsedData.teacherId,
              prefix: parsedData.prefix,
              firstName: parsedData.firstName,
              lastName: parsedData.lastName,
              fullName: parsedData.fullName,
              position: parsedData.position,
              email: normalizeEmail(parsedData.email),
              roles: parsedData.roles,
              departmentId: parsedData.departmentId,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            };

            batch.set(teacherRef, teacherPayload, { merge: true });
            batch.set(staffRef, teacherPayload, { merge: true });

          } else if (importType === 'PARENT') {
            // PARENT — เขียนเป็น parent_verification_records/{studentId}_verify
            // เลขบัตรประชาชนถูก hash (SHA-256) ฝั่ง client ก่อนเสมอ — ไม่เก็บค่าดิบใน Firestore
            const verifyRef = doc(db, 'parent_verification_records', `${parsedData.studentId}_verify`);
            const parentNationalIdHash = await sha256Hex(parsedData.parentNationalId);

            batch.set(verifyRef, {
              id: `${parsedData.studentId}_verify`,
              studentId: parsedData.studentId,
              parentPrefix: parsedData.parentPrefix || '',
              parentFirstName: parsedData.parentFirstName,
              parentLastName: parsedData.parentLastName,
              parentNationalIdHash,
              parentMobile: parsedData.parentMobile || '',
              relationship: parsedData.relationship,
              linkedParentUid: null,   // null จนกว่าผู้ปกครองจะเชื่อมบัญชี LINE สำเร็จจริง
              linkedAt: null,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            }, { merge: true });

          } else {
            // COURSE Import
            if (parsedData.isTeacherLoadReport) {
              // Dedicated multi-slot expansion for Teacher Load Report (TASK 7 & TASK 8)
              const dayThNames: Record<string, string> = {
                monday: 'จันทร์',
                tuesday: 'อังคาร',
                wednesday: 'พุธ',
                thursday: 'พฤหัสบดี',
                friday: 'ศุกร์',
                saturday: 'เสาร์',
                sunday: 'อาทิตย์'
              };

              // teacherKey ต้องคำนวณตัวเดียวกับ computeSyncReplacePlan (ดู scheduleSyncReplace.ts)
              // ไม่งั้น doc id ที่เขียนจริงกับ id ที่ใช้ตรวจ stale จะไม่ตรงกัน
              const teacherKey = primaryTeacherKey(parsedData);
              for (const slot of (parsedData.slots || [])) {
                // ROOT CAUSE FIX: แถว ACTIVITY (PLC/โฮมรูม/ลูกเสือ/แนะแนว ฯลฯ) มักไม่มีห้องเฉพาะ
                // และครูหลายคนมักมีกิจกรรมชื่อเดียวกัน+วัน-คาบเดียวกันพร้อมกันทั้งโรงเรียน — ต้องฝัง
                // identity ครูเข้าไปใน doc id (ผ่าน scheduleDocIdFor) ไม่งั้น batch.set({merge:true})
                // ของครูที่ประมวลผลทีหลังในไฟล์จะทับ teacherId ของครูคนก่อนหน้าเงียบๆ ที่ id เดียวกัน
                const scheduleDocId = scheduleDocIdFor(parsedData.subjectCode, parsedData.room, parsedData.level, slot.dayOfWeek, slot.periodNumber, parsedData.subjectType, teacherKey, sem);
                const scheduleRef = doc(db, 'schedules', scheduleDocId);

                // TASK 3 (ครูร่วมสอน): ใช้ teacherIds ที่ union มาแล้วจาก mergedTeachersByScheduleId
                // (pre-pass ด้านบน) เสมอ แทนที่จะสร้าง [ครูคนนี้คนเดียว] จากแถวนี้ตรงๆ — กันไม่ให้
                // แถวของครูอีกคนที่ scheduleDocId เดียวกัน (คาบ/ห้องเดียวกันจริง) เขียนทับ teacherIds
                // ของครูคนก่อนหน้าเงียบๆ ทุกแถวที่ตกลง doc id เดียวกันจะได้อาร์เรย์ที่รวมครบแล้วชุด
                // เดียวกันเสมอ ไม่ว่าจะเขียนตามลำดับไหน (idempotent)
                const merged = mergedTeachersByScheduleId.get(scheduleDocId);
                const teacherIds = merged?.teacherIds.length ? merged.teacherIds : (parsedData.matchedTeacherId ? [parsedData.matchedTeacherId] : []);
                const primaryTeacherId = merged?.primaryTeacherId ?? (parsedData.matchedTeacherId || null);
                const primaryTeacherEmail = merged?.primaryTeacherEmail ?? (parsedData.matchedTeacherEmail || parsedData.teacherEmail || null);
                const primaryTeacherName = merged?.primaryTeacherName || parsedData.teacherName || '';

                const schedulePayload = {
                  id: scheduleDocId,
                  academicYear: sem.academicYear,
                  term: sem.term,
                  subjectCode: parsedData.subjectCode,
                  subjectName: parsedData.subjectName,
                  room: parsedData.room || '',
                  level: parsedData.level || '',
                  credits: parsedData.credits || 1.5,
                  teacherIds,
                  teacherId: primaryTeacherId,
                  teacherEmail: primaryTeacherEmail || (primaryTeacherId ? `${primaryTeacherId}@utd.ac.th` : null),
                  sourceTeacherName: primaryTeacherName,
                  department: parsedData.department || '',
                  unlinkedTeacherName: primaryTeacherId ? null : (merged?.unlinkedTeacherName ?? (parsedData.unlinkedTeacherName || parsedData.teacherName || null)),
                  unlinkedTeacherEmail: primaryTeacherId ? null : (merged?.unlinkedTeacherEmail ?? (parsedData.unlinkedTeacherEmail || parsedData.teacherEmail || null)),
                  subjectType: parsedData.subjectType, // 'MAIN' or 'ACTIVITY'
                  dayOfWeek: slot.dayOfWeek,
                  periodNumber: slot.periodNumber,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp()
                };

                batch.set(scheduleRef, schedulePayload, { merge: true });

                const scheduleLabel = `${dayThNames[slot.dayOfWeek] || slot.dayOfWeek} คาบ ${slot.periodNumber}`;
                // ใช้ต่อจาก scheduleDocId เสมอ (ตัด prefix "sch_" ออก) กันไม่ให้ id คู่นี้ไหลออกจากกันอีก
                const courseSlotId = `course_${scheduleDocId.slice(4)}`;
                const finalTeacherEmail = parsedData.matchedTeacherEmail || parsedData.teacherEmail || '';

                newCoursesToStore.push({
                  id: courseSlotId,
                  code: parsedData.subjectCode,
                  name: parsedData.subjectName,
                  room: parsedData.room || parsedData.level || '',
                  term: `${sem.term}/${sem.academicYear}`,
                  periodIndex: slot.periodNumber,
                  schedule: scheduleLabel,
                  attendanceTaken: false,
                  teacherName: parsedData.teacherName || 'ครูผู้สอน',
                  teacherEmail: finalTeacherEmail
                });

                newGlobalCoursesToStore.push({
                  courseId: courseSlotId,
                  code: parsedData.subjectCode,
                  courseName: parsedData.subjectName,
                  teacherName: parsedData.teacherName || 'ครูผู้สอน',
                  teacherEmail: finalTeacherEmail,
                  roomName: parsedData.room || parsedData.level || '',
                  scheduleString: scheduleLabel,
                  level: parsedData.level || ''
                });
              }
            } else {
              // Legacy Flat Template Course Write
              // id ผ่านฟังก์ชันกลางเดียวกับเส้นทาง Teacher Load Report (รวมภาคเรียน) — ไฟล์รูปแบบเก่าไม่มีวัน/คาบ จึงใช้ monday/คาบ 1 ตามที่เขียนอยู่เดิม
              const scheduleDocId = scheduleDocIdFor(parsedData.courseCode, parsedData.room, parsedData.level, 'monday', 1, 'MAIN', undefined, sem);
              const scheduleRef = doc(db, 'schedules', scheduleDocId);

              const schedulePayload = {
                id: scheduleDocId,
                academicYear: sem.academicYear,
                term: sem.term,
                subjectCode: parsedData.courseCode,
                subjectName: parsedData.courseName,
                room: parsedData.room,
                level: parsedData.level,
                credits: parsedData.credits,
                teacherIds: parsedData.instructorId ? [parsedData.instructorId] : [],
                unlinkedTeacherName: parsedData.instructorId ? null : 'Unlinked Instructor',
                subjectType: 'MAIN',
                dayOfWeek: 'monday',
                periodNumber: 1,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
              };

              batch.set(scheduleRef, schedulePayload, { merge: true });

              const courseId = `course_${scheduleDocId.slice(4)}`;
              newCoursesToStore.push({
                id: courseId,
                code: parsedData.courseCode,
                name: parsedData.courseName,
                room: parsedData.room,
                term: `${sem.term}/${sem.academicYear}`,
                periodIndex: 1,
                schedule: 'จันทร์ 08:30 - 09:20 น.',
                attendanceTaken: false,
                teacherName: parsedData.instructorId || 'ครูผู้สอน',
                teacherEmail: '' // ไฟล์รูปแบบเก่าไม่มีอีเมลครู — ห้ามเติมอีเมลของคนอื่นแทน
              });

              newGlobalCoursesToStore.push({
                courseId,
                code: parsedData.courseCode,
                courseName: parsedData.courseName,
                teacherName: parsedData.instructorId || 'ครูผู้สอน',
                teacherEmail: '',
                roomName: parsedData.room,
                scheduleString: 'จันทร์ 08:30 - 09:20 น.',
                level: parsedData.level
              });
            }
          }
        }

        // Commit batch
        await batch.commit();
        processedCount += chunk.length;
        setImportProgress(Math.min(95, Math.round((processedCount / totalValid) * 90) + 10));
      }

      // ── ผลกระทบของการนำเข้าซ้ำ: โอนประวัติให้ครูคนเดิม + เก็บกวาดตารางของครูที่ปิดการใช้งานและมีคนมาแทนแล้ว ──
      // (แอดมินตรวจและยืนยันรายการเหล่านี้ไปแล้วก่อนเริ่ม — ดูแผงสรุปผลกระทบ; ทุกอย่างถูกบันทึกลง schedule_import_logs)
      let aftercare: AftercareResult = { stampedBySchedule: {}, cleaned: [], errors: [] };
      const syncReport = { deleted: [] as { id: string; label: string }[], protectedDocs: [] as { id: string; label: string }[] };
      const canRunAftercare = importType === 'COURSE' && !!importImpact && userRoles.includes('SUPER_ADMIN');
      if (canRunAftercare && importImpact) {
        aftercare = await applyHandoverAndCleanup(db, importImpact);
      }

      // ── sync/replace: ลบ schedule เก่าของครูในไฟล์นี้ที่ไม่มีในไฟล์ใหม่ (admin ยืนยันแล้ว) ──
      if (importType === 'COURSE' && replaceStale && staleSchedules.length > 0) {
        // กันลบ schedule ที่ยังมีข้อมูลที่ครูบันทึกไว้อ้างถึงอยู่ (เช็คชื่อ/บันทึกหลังสอน/คำขอเช็คชื่อย้อนหลัง/สอนแทน)
        // ⚠️ fail-closed: อ่าน collection ใดไม่ได้ = ไม่ลบอะไรเลย (ดีกว่าลบโดยไม่รู้ว่ามีข้อมูลผูกอยู่)
        let referencedValues: Set<string> | null = new Set<string>();
        try {
          for (const ref of SCHEDULE_REFERENCING_COLLECTIONS) {
            const snap = await getDocs(collection(db, ref.collection));
            collectReferenceValues(snap.docs.map(d => d.data() as Record<string, any>), ref.fields, referencedValues);
          }
        } catch (err) {
          referencedValues = null;
          console.error('[BulkDataImportModal] sync/replace: อ่านข้อมูลอ้างอิง schedule ไม่ครบ — ยกเลิกการลบทั้งหมด', err);
          alert('⚠️ นำเข้าข้อมูลสำเร็จ แต่ตรวจสอบข้อมูลที่ผูกกับตารางสอนเก่าไม่ครบ จึงไม่ได้ลบตารางสอนเก่าออก (ไม่มีข้อมูลเสียหาย) กรุณาลองใหม่หรือแจ้งผู้ดูแลระบบ');
        }
        if (referencedValues) {
          const { deletable, protectedDocs } = partitionStaleByReferences<{ id: string; label: string }>(staleSchedules, referencedValues);
          syncReport.deleted = deletable;
          syncReport.protectedDocs = protectedDocs;
          for (let i = 0; i < deletable.length; i += 450) {
            const delBatch = writeBatch(db);
            deletable.slice(i, i + 450).forEach(s => delBatch.delete(doc(db, 'schedules', s.id)));
            await delBatch.commit();
          }
          console.log(`[BulkDataImportModal] sync/replace: ลบ schedule เก่า ${deletable.length} รายการ (เก็บไว้ ${protectedDocs.length} รายการที่ยังมีข้อมูลบันทึกผูกอยู่)`);
          if (protectedDocs.length > 0) {
            alert(`ℹ️ ตารางสอนเก่า ${protectedDocs.length} รายการไม่ถูกลบ เพราะยังมีบันทึก (เช่น บันทึกหลังสอน/เช็คชื่อย้อนหลัง/สอนแทน) ผูกอยู่ — ตรวจสอบและจัดการเองได้ภายหลัง`);
          }
        }
      }

      // ── log การนำเข้า (เพิ่มอย่างเดียว): ใครนำเข้า เปลี่ยน/ลบอะไร และใครเคยเป็นผู้บันทึกของตารางที่ถูกเก็บกวาด ──
      if (canRunAftercare && importImpact && user) {
        try {
          await writeImportLog(db, {
            actor: { uid: user.uid, staffId: user.staffId, email: user.email, name: user.displayName },
            semester: sem,
            fileName: file?.name,
            rowsValid: totalValid,
            impact: importImpact,
            aftercare,
            confirmedItemCount: reviewKeysOf(importImpact).length,
            syncReplace: { enabled: replaceStale, deleted: syncReport.deleted, protectedDocs: syncReport.protectedDocs },
          });
        } catch (err) {
          aftercare.errors.push(`เขียน log การนำเข้าไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)}`);
        }
        const stampedTotal = Object.values(aftercare.stampedBySchedule).reduce((a, b) => a + b, 0);
        if (aftercare.errors.length > 0) {
          alert(`⚠️ นำเข้าตารางสอนแล้ว แต่มีบางขั้นตอนไม่สมบูรณ์:\n- ${aftercare.errors.join('\n- ')}\n\nตรวจสอบ log การนำเข้าและแจ้งผู้ดูแลระบบ`);
        } else if (importImpact.teacherChanges.length > 0 || aftercare.cleaned.length > 0) {
          alert(`✅ นำเข้าสำเร็จ\n• โอนประวัติ: เปลี่ยนครู ${importImpact.teacherChanges.length} คาบ (ประทับชื่อครูคนเดิมในบันทึกหลังสอน ${stampedTotal} รายการ)\n• เก็บกวาดตารางครูที่ปิดการใช้งาน ${aftercare.cleaned.length} รายการ\n• บันทึก log การนำเข้าแล้ว`);
        }
      }

      // นำเข้าบุคลากรอาจเพิ่ม/เปลี่ยนครูแนะแนว (GUIDANCE_COUNSELOR) — สิทธิ์อ่าน 9Q/8Q ของครูที่ปรึกษาขึ้นกับ "มีครูแนะแนวที่ใช้งานอยู่ไหม"
      // (school_settings/guidance_status — Cloud Functions เป็นผู้คำนวณ) จึงให้คำนวณใหม่ (ล้มเหลว = แค่เตือน ไม่ทำให้การนำเข้าล้ม)
      if (importType === 'TEACHER') {
        try {
          await httpsCallable(functions, 'refreshGuidanceStatus')();
        } catch (err) {
          console.warn('[BulkDataImportModal] refreshGuidanceStatus failed — ให้ SUPER_ADMIN เรียก refreshGuidanceStatus เองภายหลัง:', err);
        }
      }

      // Update local Zustand store
      if (newStudentsToStore.length > 0) {
        addStudentsToStore(newStudentsToStore);
      }
      if (newCoursesToStore.length > 0) {
        addCoursesToStore(newCoursesToStore, newGlobalCoursesToStore);
      }

      setImportProgress(100);

      setTimeout(() => {
        setIsImporting(false);
        if (onImportSuccess) {
          onImportSuccess(importType, totalValid);
        }
        onClose();
        handleRemoveFile();
      }, 500);

    } catch (err: any) {
      console.error('[BulkDataImportModal] Batch Commit Error:', err);
      setIsImporting(false);
      setImportError(`เกิดข้อผิดพลาดในการบันทึกข้อมูลเข้า Firestore: ${err?.message || 'กรุณาลองใหม่อีกครั้ง'}`);
    }
  };

  // previewData เป็น derived value (useMemo) ไม่ใช่ state — จึงไม่มีจังหวะที่มันเป็น []
  // ชั่วคราวระหว่าง re-render (เดิมเป็น state ที่ถูก effect เคลียร์ ทำให้กดปุ่มยืนยันแล้ว
  // handleConfirmImport เห็น previewData.length === 0 แล้ว early-return เงียบ ๆ)
  // re-compute เมื่อ rawParsedRows / importType / roster (staff, students) เปลี่ยนเนื้อหาจริง
  const previewData: ValidatedRow[] = useMemo(
    () => (rawParsedRows ? validateRows(rawParsedRows, importType) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawParsedRows, importType, realStaffList, realStudentIds]
  );
  const isValidated = rawParsedRows !== null;

  // ตารางสอน: แถวที่ผ่านตรวจแต่จับคู่ครูไม่ได้ — สรุปให้เห็นก่อนยืนยัน (ไม่นำเข้าเงียบๆ)
  const unlinkedSummary = useMemo(
    () => (importType === 'COURSE' ? summarizeUnlinkedTeachers(previewData) : null),
    [importType, previewData]
  );

  useEffect(() => {
    onBusyChange?.(isImporting);
  }, [isImporting, onBusyChange]);

  // ── COURSE sync/replace: หา schedule เก่าของครูที่อยู่ในไฟล์นี้ ที่ไม่มีในไฟล์ใหม่ ──
  // Bulk Import COURSE เขียนแบบ merge เท่านั้น ไม่เคยลบของเก่า → ข้อมูลผีสะสม (เช่น ห้อง 944
  // ที่ไม่มีในไฟล์จริงแต่ค้างจาก import ทดสอบรอบก่อน). สแกนไว้ให้ admin ยืนยันลบก่อน import
  //
  // ⚠️ SAFETY: ถ้าครูคนไหน "มีแถวที่ import ไม่ผ่าน" ในไฟล์นี้ → **ไม่แตะ schedule เก่าของครูคนนั้นเลย**
  // (เดิม: ครูมีแถววิชาการที่ valid + แถวกิจกรรมที่ parse ไม่ผ่าน → newIds มีแค่วิชาการ →
  //  กิจกรรมเดิมของครูโดน flag ว่า stale แล้วโดนลบทั้งหมด — สาเหตุจริงของ "คาบกิจกรรมหาย")
  useEffect(() => {
    setStaleSchedules([]);
    setReplaceStale(false);
    setImportImpact(null);
    setConfirmedReviewKeys(new Set());
    if (importType !== 'COURSE' || previewData.length === 0) return;
    const loadRows = previewData.filter(r => r.parsedData?.isTeacherLoadReport);
    const validRows = loadRows.filter(r => r.isValid);
    if (validRows.length === 0) return;

    let cancelled = false;
    (async () => {
      setScanningStale(true);
      try {
        // ยังไม่ได้ตั้งค่าภาคเรียน → ไม่สแกน (handleImport จะหยุดและแจ้ง error เอง); เทียบเฉพาะภายในภาคเรียนเดียวกัน
        const semester = await requireConfiguredSemester();
        const snap = await getDocs(collection(db, 'schedules'));
        if (cancelled) return;
        const existingDocs = snap.docs.map(d => ({ id: d.id, data: d.data() as Record<string, any> }));
        const plan = computeSyncReplacePlan(
          loadRows.map(r => ({ isValid: r.isValid, parsedData: r.parsedData as Record<string, any> })),
          existingDocs,
          semester,
        );
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          plan.debug.forEach(line => console.log('[SYNC-REPLACE]', line));
        }
        if (!cancelled) {
          setStaleSchedules(plan.stale.map(s => ({ id: s.id, label: s.label })));
          // ผลกระทบของการนำเข้าซ้ำ: เปลี่ยนครูในคาบเดิม / ตารางของครูที่ปิดการใช้งานและมีคนมาแทนแล้ว
          setImportImpact(computeImportImpact(
            loadRows.map(r => ({ isValid: r.isValid, parsedData: r.parsedData as Record<string, any> })),
            existingDocs,
            semester,
            realStaffList.map(s => ({ id: s.id, fullName: s.fullName || s.displayName, status: s.status })),
            plan.stale.map(s => s.id),
          ));
        }
      } catch (e) {
        console.warn('[BulkDataImportModal] stale schedule scan failed:', e);
      } finally {
        if (!cancelled) setScanningStale(false);
      }
    })();
    return () => { cancelled = true; };
  }, [previewData, importType, realStaffList]);

  if (!isOpen) return null;

  // ยืนยันรายการที่ได้รับผลกระทบ — ทีละรายการ หรือทั้งหมดในคราวเดียว
  const toggleReviewKey = (key: string) => setConfirmedReviewKeys(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const confirmAllReviewKeys = () => { if (importImpact) setConfirmedReviewKeys(new Set(reviewKeysOf(importImpact))); };
  const clearReviewKeys = () => setConfirmedReviewKeys(new Set());
  const reviewTotal = importImpact ? reviewKeysOf(importImpact).length : 0;
  const reviewDone = importImpact ? reviewKeysOf(importImpact).filter(k => confirmedReviewKeys.has(k)).length : 0;
  const impactBlocksImport = importType === 'COURSE' && !!importImpact && !isImpactFullyConfirmed(importImpact, confirmedReviewKeys);

  const validCount = previewData.filter(r => r.isValid).length;
  const invalidCount = previewData.filter(r => !r.isValid).length;

  const isInline = variant === 'inline';

  return (
    <div className={isInline
      ? 'text-slate-200 animate-in fade-in duration-300'
      : 'fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in text-slate-200'
    }>
      <div className={isInline
        ? (lockImportType ? 'w-full flex flex-col overflow-hidden' : 'bg-[#11151d] border border-white/10 rounded-2xl w-full shadow-xl flex flex-col overflow-hidden')
        : 'bg-[#11151d] border border-white/10 rounded-2xl max-w-4xl w-full shadow-2xl flex flex-col my-8 max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200'
      }>

        {/* Header — ไม่มีปุ่มปิด (X) ในโหมด inline เพราะไม่มี overlay ให้ปิดกลับไป (ตัวมันเองคือเนื้อหาหลักของหน้าอยู่แล้ว)
            ซ่อนทั้งหมดเมื่อ lockImportType (การ์ดของหน้านำเข้ามีหัวข้อของตัวเองแล้ว) */}
        {!lockImportType && (
        <div className="p-6 border-b border-white/5 bg-[#0a0f16] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center">
              <FileSpreadsheet className="w-5.5 h-5.5 text-indigo-400" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block mb-0.5">Bulk Integration Engine</span>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                นำเข้าข้อมูลนักเรียน บุคลากร และตารางสอนชุดใหญ่
              </h3>
            </div>
          </div>
          {!isInline && (
          <button
            onClick={onClose}
            disabled={isImporting}
            className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          )}
        </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Permission warning banner if current user lacks required role */}
          {!hasPermissionForCurrentType && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3 text-amber-300 animate-in fade-in">
              <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold">แจ้งเตือนสิทธิ์การเข้าถึงข้อมูล</h4>
                <p className="text-[11px] text-amber-200/90 mt-0.5">
                  บทบาทปัจจุบันของคุณ ({userRoles.map(r => ROLE_NAMES_TH[r] || r).join(', ') || 'ไม่มีบทบาท'}) ไม่มีสิทธิ์ในการนำเข้าข้อมูลประเภท <strong>{importType === 'TEACHER' ? 'บุคลากร (ต้องเป็น Super Admin)' : importType === 'PARENT' ? 'ข้อมูลยืนยันตัวตนผู้ปกครอง (ต้องเป็น Super Admin)' : importType === 'STUDENT' ? 'นักเรียน (ต้องเป็น Super Admin หรือ ครูประจำชั้น)' : 'ตารางสอน (ต้องเป็น Super Admin หรือ ครู)'}</strong>
                </p>
              </div>
            </div>
          )}

          {/* Error Alert */}
          {importError && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex items-start gap-3 text-rose-300 animate-in fade-in">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-xs font-bold">พบข้อผิดพลาด</h4>
                <p className="text-[11px] text-rose-200/90 mt-0.5">{importError}</p>
              </div>
              <button 
                onClick={() => setImportError(null)}
                className="text-rose-400 hover:text-rose-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* 1. Import Type Selector — ซ่อนเมื่อประเภทถูกล็อกโดยการ์ด (หน้านำเข้ามีการ์ดต่อประเภทอยู่แล้ว) */}
          {!lockImportType && (
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
              ขั้นตอนที่ 1: เลือกประเภทข้อมูลที่ต้องการนำเข้า
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { type: 'STUDENT', label: 'รายชื่อนักเรียนในสังกัด', desc: 'ข้อมูลรหัสประจำตัว, ชื่อ-นามสกุล, ห้องประจำชั้น, เลขที่' },
                { type: 'TEACHER', label: 'รายชื่อครูและบุคลากร', desc: 'ข้อมูลรหัสบุคลากร, ชื่อ, อีเมล, สิทธิบทบาทเบื้องต้น' },
                { type: 'COURSE', label: 'ตารางสอนและวิชาเรียน', desc: 'ข้อมูลรหัสวิชา, ชื่อวิชา, หน่วยกิต, ห้องเรียนที่เปิดสอน' },
                { type: 'PARENT', label: 'ข้อมูลยืนยันตัวตนผู้ปกครอง', desc: 'Student ID, ชื่อผู้ปกครอง, เลขบัตร ปชช. (hash), เบอร์, ความสัมพันธ์ — สำหรับเชื่อมบัญชี LINE' }
              ].map(item => {
                const isSelected = importType === item.type;
                return (
                  <button
                    type="button"
                    key={item.type}
                    onClick={() => {
                      if (!isImporting) {
                        setImportType(item.type as ImportType);
                        if (file) handleRemoveFile();
                      }
                    }}
                    className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer h-24 ${
                      isSelected 
                        ? 'bg-indigo-500/10 border-indigo-500/40 text-white shadow-inner' 
                        : 'bg-slate-950/40 border-white/5 text-slate-400 hover:border-slate-800'
                    }`}
                  >
                    <span className="text-xs font-bold block">{item.label}</span>
                    <span className="text-[10px] text-slate-400 leading-tight mt-1">{item.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>
          )}

          {/* Prerequisite Alert for COURSE import if staff roster is empty in Firestore */}
          {importType === 'COURSE' && !isStaffLoading && realStaffList.length === 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start justify-between gap-3 text-amber-300 animate-in fade-in">
              <div className="flex items-start gap-3">
                <Users className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold">ข้อมูลการจับคู่บัญชีครูผู้สอน</h4>
                  <p className="text-[11px] text-amber-200/90 mt-0.5 leading-relaxed">
                    ระบบจะใช้คอลัมน์ <strong>อีเมล์</strong> ในไฟล์ตารางสอนเพื่อจับคู่กับบัญชีบุคลากรในระบบโดยอัตโนมัติ ตอนนี้ยังไม่มีบุคลากรในระบบ — ควรนำเข้าบุคลากรก่อน มิฉะนั้นระบบจะบันทึกตารางสอนและอีเมลไว้รอผูกบัญชีภายหลัง (ทุกแถวจะไม่ผูกครู)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (onRequestSwitchType) {
                    onRequestSwitchType('TEACHER');
                    return;
                  }
                  setImportType('TEACHER');
                  if (file) handleRemoveFile();
                }}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold rounded-lg border border-amber-500/40 transition-colors cursor-pointer"
              >
                <span>{lockImportType ? 'ไปนำเข้าบุคลากรก่อน' : 'สลับไปนำเข้ารายชื่อครู'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* PARENT import — คำอธิบายสถาปัตยกรรมและ PDPA */}
          {importType === 'PARENT' && (
            <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-4 flex items-start gap-3 text-indigo-200 animate-in fade-in">
              <ShieldAlert className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-indigo-300">ข้อมูลยืนยันตัวตนผู้ปกครอง (ยังไม่ใช่บัญชี login)</h4>
                <p className="text-[11px] leading-relaxed">
                  ผู้ปกครองจะล็อกอินผ่าน LINE (LIFF) ในอนาคต — ตอนนี้จึงยังไม่มี Firebase Auth UID จริง
                  ข้อมูลนี้เขียนลง collection <strong>parent_verification_records</strong> (1 เอกสารต่อ 1 นักเรียน)
                  เพื่อให้ระบบเทียบยืนยันตอนผู้ปกครองเชื่อมบัญชี LINE ครั้งแรก แล้วจึงเติม <code>linkedParentUid</code>
                </p>
                <p className="text-[11px] leading-relaxed text-amber-300/90">
                  🔒 เลขบัตรประชาชนจะถูกทำ hash (SHA-256) ในเบราว์เซอร์ก่อนส่งเสมอ — <strong>ไม่มีการเก็บเลขบัตรแบบข้อความธรรมดาใน Firestore</strong> ตาม PDPA
                </p>
              </div>
            </div>
          )}

          {/* 2. Drag & Drop Upload Zone + Download Template */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                {lockImportType ? 'อัปโหลดไฟล์เอกสาร' : 'ขั้นตอนที่ 2: อัปโหลดไฟล์เอกสาร'}
              </label>
              
              {/* Template Download Button */}
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                ดาวน์โหลดไฟล์เทมเพลตตัวอย่าง ({templateFilename(importType)})
              </button>
            </div>

            {importType === 'TEACHER' && (
              <p className="text-[10px] text-slate-400 flex items-start gap-1.5">
                <Info className="w-3 h-3 text-indigo-400 shrink-0 mt-0.5" />
                คอลัมน์ <strong className="text-slate-300">Roles</strong> และ <strong className="text-slate-300">Department</strong> เว้นว่างได้ —
                ระบบจะตั้งเป็น <strong className="text-slate-300">ครูผู้สอน (SUBJECT_TEACHER)</strong> ให้อัตโนมัติ
                แล้วค่อยกำหนดบทบาทพิเศษ/กลุ่มสาระฯ ทีหลังที่หน้า "จัดการสิทธิ์บุคลากร"
              </p>
            )}

            {!file ? (
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center flex flex-col items-center justify-center space-y-3 cursor-pointer transition-all ${
                  dragActive 
                    ? 'border-indigo-500 bg-indigo-500/5' 
                    : 'border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-950/80'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-12 h-12 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center shadow-lg">
                  <Upload className="w-6 h-6 text-indigo-400" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-200">ลากไฟล์มาวางตรงนี้ หรือคลิกเพื่อเลือกไฟล์นำเข้า</p>
                  <p className="text-[10px] text-slate-500 mt-1">รองรับไฟล์จริงทั้ง CSV (.csv) และ Excel (.xlsx, .xls) ทำการอ่านและตรวจสอบความถูกต้องแบบอัตโนมัติ</p>
                </div>
              </div>
            ) : (
              <div className="bg-slate-950/80 border border-white/5 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center">
                    <FileSpreadsheet className="w-5.5 h-5.5 text-indigo-400" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">{file.name}</h4>
                    <p className="text-[10px] text-slate-500">ขนาดไฟล์: {(file.size / 1024).toFixed(1)} KB • สแกนและแยกโครงสร้างข้อมูลแล้ว</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="ลบไฟล์และอัปโหลดใหม่"
                >
                  <Trash2 className="w-4 h-4 text-rose-400" />
                </button>
              </div>
            )}
          </div>

          {/* 3. Data Preview & Validation Table */}
          {isValidated && previewData.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-white/5 animate-in fade-in duration-300">
              
              {/* Validation Summary Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                  <span>{lockImportType ? 'ตรวจสอบความถูกต้องของข้อมูลจริง' : 'ขั้นตอนที่ 3: ตรวจสอบความถูกต้องของข้อมูลจริง'} ({previewData.length} แถวจากไฟล์)</span>
                </div>
                
                {/* Badges Summary */}
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-lg shadow-sm">
                    <CheckCircle2 className="w-3 h-3" />
                    ผ่านเกณฑ์ตรวจสอบ: {validCount} รายการ
                  </span>
                  {invalidCount > 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-bold rounded-lg shadow-sm">
                      <XCircle className="w-3 h-3 animate-pulse" />
                      พบข้อผิดพลาด: {invalidCount} รายการ
                    </span>
                  )}
                </div>
              </div>

              {/* ตารางสอน: สรุปแถวที่จับคู่ครูไม่ได้ก่อนยืนยัน */}
              {unlinkedSummary && unlinkedSummary.rowCount > 0 && (
                <div data-testid="unlinked-teacher-summary" className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-4 flex items-start gap-3 text-amber-200">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1.5 text-[11px] leading-relaxed">
                    <h4 className="text-xs font-bold text-amber-300">
                      {unlinkedSummary.rowCount} จาก {validCount} แถวที่จะนำเข้า ยังจับคู่ครูไม่ได้ ({unlinkedSummary.teacherCount} คน)
                    </h4>
                    <p>
                      แถวเหล่านี้จะถูกบันทึกโดย<strong>ไม่มีครูผู้สอน</strong> (เก็บชื่อ/อีเมลไว้รอผูกเอง) — วิชาจะยังไม่ขึ้นในหน้าครูจนกว่าจะผูกบัญชี
                      แนะนำให้<strong>นำเข้าบุคลากรก่อน</strong> (การ์ดข้อ 1) หรือตรวจว่าอีเมลในไฟล์ตรงกับบุคลากรในระบบ แล้วอัปโหลดไฟล์นี้ใหม่
                    </p>
                    <details className="text-amber-300/90">
                      <summary className="cursor-pointer">ดูรายชื่อครูที่ไม่ผูก</summary>
                      <ul className="mt-1 space-y-0.5 max-h-32 overflow-y-auto font-mono text-[10px]">
                        {unlinkedSummary.teachers.map(t => <li key={t}>• {t}</li>)}
                      </ul>
                    </details>
                  </div>
                </div>
              )}

              {/* Preview Table */}
              <div className="border border-white/5 rounded-xl overflow-hidden bg-slate-950/40">
                <div className="max-h-60 overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900/50 border-b border-white/5 text-slate-400 text-[11px] font-semibold sticky top-0 z-10 backdrop-blur-md">
                        <th className="px-4 py-3 text-center w-12">แถวที่</th>
                        <th className="px-4 py-3">
                          {importType === 'STUDENT' ? 'รหัสนักเรียน' : importType === 'TEACHER' ? 'รหัสประจำตัวครู' : importType === 'PARENT' ? 'รหัสนักเรียน (ของบุตร)' : 'รหัสวิชา'}
                        </th>
                        <th className="px-4 py-3">
                          {importType === 'STUDENT' ? 'ชื่อ-นามสกุลนักเรียน' : importType === 'TEACHER' ? 'ชื่อ-นามสกุลบุคลากร' : importType === 'PARENT' ? 'ชื่อ-นามสกุลผู้ปกครอง' : 'ชื่อวิชาเรียน'}
                        </th>
                        <th className="px-4 py-3">
                          {importType === 'STUDENT' ? 'ห้องเรียน' : importType === 'TEACHER' ? 'อีเมลโรงเรียน' : importType === 'PARENT' ? 'ความสัมพันธ์' : 'ระดับชั้น / หน่วยกิต'}
                        </th>
                        <th className="px-4 py-3">
                          {importType === 'STUDENT' ? 'เลขที่' : importType === 'TEACHER' ? 'ตำแหน่งหลัก' : importType === 'PARENT' ? 'เบอร์โทร' : 'ห้องประจำวิชา'}
                        </th>
                        <th className="px-4 py-3">สถานะตรวจสอบ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-xs text-slate-300">
                      {previewData.map((row, index) => (
                        <tr 
                          key={row.id} 
                          className={`transition-colors ${
                            row.isValid 
                              ? 'hover:bg-white/[0.01]' 
                              : 'bg-rose-500/[0.04] hover:bg-rose-500/[0.07]'
                          }`}
                        >
                          <td className="px-4 py-3 text-center font-mono text-slate-500">{index + 1}</td>
                          <td className={`px-4 py-3 font-mono font-bold ${!row.isValid && !row.col1 ? 'text-rose-400 underline decoration-dashed' : ''}`}>
                            {row.col1 || 'ไม่มีข้อมูล'}
                          </td>
                          <td className="px-4 py-3">{row.col2}</td>
                          <td className="px-4 py-3 font-mono">{row.col3}</td>
                          <td className="px-4 py-3">{row.col4}</td>
                          <td className="px-4 py-3">
                            {row.isValid ? (
                              <div className="space-y-1">
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                                  <CheckCircle2 className="w-3 h-3" /> ผ่านการตรวจสอบ {row.parsedData?.slots ? `(${row.parsedData.slots.length} คาบสอน)` : ''}
                                </span>
                                {row.warnings && row.warnings.length > 0 && (
                                  <div className="space-y-0.5">
                                    {row.warnings.map((w: string, wIdx: number) => (
                                      <p key={wIdx} className="text-[10px] text-amber-300/90 font-light flex items-center gap-1 leading-tight">
                                        <AlertTriangle className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                                        {w}
                                      </p>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded">
                                  <XCircle className="w-3 h-3" /> ข้อมูลขัดข้อง
                                </span>
                                <p className="text-[10px] text-rose-300 font-light mt-0.5 leading-tight">{row.errorMessage}</p>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Security note */}
              <div className="bg-slate-900/30 p-3 rounded-xl border border-white/5 text-[10px] text-slate-400 flex items-start gap-2">
                <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <p>
                  <strong>เกณฑ์ความปลอดภัย Firestore Batched Writes:</strong> ระบบจะละเว้นแถวที่ "พบข้อผิดพลาด" และนำเข้าเฉพาะแถวที่ "ผ่านเกณฑ์ตรวจสอบ" จำนวน {validCount} รายการ เข้าสู่ฐานข้อมูล Firestore ในรูปแบบ Batched Write แบบกลุ่มละไม่เกิน 500 รายการอย่างเสถียร
                </p>
              </div>

              {/* COURSE — ผลที่จะเกิดขึ้นเมื่อนำเข้าซ้ำ: แอดมินตรวจและยืนยันรายการที่ได้รับผลกระทบก่อนนำเข้า */}
              {importType === 'COURSE' && importImpact && (
                <div className="bg-sky-950/30 border border-sky-500/40 rounded-xl p-4 space-y-3 text-[11px] text-sky-100">
                  <div className="flex items-center gap-2 font-bold text-sky-200 text-xs">
                    <Info className="w-4 h-4" /> ผลที่จะเกิดขึ้นเมื่อนำเข้าไฟล์นี้ (ตรวจสอบก่อนยืนยัน)
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-center">
                    {[
                      { label: 'คาบในไฟล์', value: importImpact.slotsInFile },
                      { label: 'คาบใหม่ที่เพิ่ม', value: importImpact.created },
                      { label: 'ไม่เปลี่ยนแปลง', value: importImpact.unchanged },
                      { label: 'ข้อมูลวิชาเปลี่ยน', value: importImpact.detailsChanged },
                      { label: 'เปลี่ยนครู', value: importImpact.teacherChanges.length + importImpact.teacherAdded },
                    ].map(s => (
                      <div key={s.label} className="bg-black/30 rounded-lg py-2">
                        <div className="text-base font-bold text-white">{s.value}</div>
                        <div className="text-[10px] text-sky-300/80">{s.label}</div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-1 text-sky-200/90 leading-relaxed">
                    <p>• คาบที่ตรงกับของเดิม (วิชา ห้อง วัน คาบ เดียวกัน) จะถูกเขียนทับด้วยข้อมูลจากไฟล์ — คาบใหม่จะถูกเพิ่ม ไม่ซ้ำกับของเดิม</p>
                    <p>• <strong>ไม่ถูกแตะต้อง:</strong> การเช็คชื่อรายคาบ เนื้อหาบันทึกหลังสอน คะแนนใน Gradebook คำขอเช็คชื่อย้อนหลัง และรายการสอนแทน (การนำเข้าไม่แก้ข้อมูลเหล่านี้ ยกเว้นการประทับชื่อครูคนเดิมตามด้านล่าง)</p>
                    <p>• ตารางของครูที่ไม่มีแถวในไฟล์นี้ จะไม่ถูกลบหรือแก้ (ยกเว้นกรณีครูที่ปิดการใช้งานและมีคนมาแทนแล้ว ตามด้านล่าง)</p>
                  </div>

                  {reviewTotal > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-black/30 rounded-lg px-3 py-2">
                      <span className="font-bold text-white">
                        รายการที่ได้รับผลกระทบ — ยืนยันแล้ว {reviewDone}/{reviewTotal} รายการ
                        {reviewDone === reviewTotal && <span className="text-emerald-400 ml-2">✓ ครบแล้ว</span>}
                      </span>
                      <span className="flex items-center gap-2">
                        <button type="button" onClick={confirmAllReviewKeys} disabled={isImporting || reviewDone === reviewTotal}
                          className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold cursor-pointer disabled:cursor-not-allowed">
                          ยืนยันทั้งหมด (ตรวจสอบแล้ว)
                        </button>
                        <button type="button" onClick={clearReviewKeys} disabled={isImporting || reviewDone === 0}
                          className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:text-slate-600 text-slate-300 font-bold cursor-pointer disabled:cursor-not-allowed">
                          ล้างการยืนยัน
                        </button>
                      </span>
                    </div>
                  )}

                  {importImpact.teacherChanges.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="font-bold text-white">เปลี่ยนครูในคาบเดิม ({importImpact.teacherChanges.length} คาบ)</div>
                      <p className="text-sky-200/80 leading-relaxed">
                        ครูผู้สอนของคาบเหล่านี้จะถูกเปลี่ยนตามไฟล์ใหม่ — <strong>ประวัติบันทึกหลังสอนเดิมยังอยู่กับครูคนเดิม</strong> (ระบบประทับชื่อครูคนเดิมไว้ที่บันทึกที่ยังไม่มีผู้บันทึก
                        ครูคนเดิมยังเห็นประวัติของตน) และครูคนใหม่จะเห็นบันทึกเดิมของคาบนี้พร้อมป้ายบอกว่าครูคนไหนเป็นผู้บันทึก เพื่อรู้ว่าสอนไปถึงไหนแล้ว
                      </p>
                      <ul className="space-y-1 max-h-48 overflow-y-auto">
                        {importImpact.teacherChanges.map(c => (
                          <li key={c.id}>
                            <label className="flex items-start gap-2 cursor-pointer bg-black/20 rounded-lg px-2 py-1.5">
                              <input type="checkbox" checked={confirmedReviewKeys.has(`change:${c.id}`)} onChange={() => toggleReviewKey(`change:${c.id}`)}
                                disabled={isImporting} className="mt-0.5 rounded border-sky-500/40 bg-black text-emerald-500" />
                              <span>
                                <span className="font-mono text-white">{c.label}</span><br />
                                ครูเดิมที่ออก: <strong className="text-amber-200">{c.leavingTeacherNames.join(', ')}</strong>
                                {' → '}ครูตามไฟล์ใหม่: <strong className="text-emerald-200">{c.toTeacherNames.length > 0 ? c.toTeacherNames.join(', ') : 'ยังจับคู่ครูไม่ได้'}</strong>
                              </span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {importImpact.cleanupEligible.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="font-bold text-white">ตารางของครูที่ปิดการใช้งาน และมีครูมาสอนคาบเดียวกันแล้ว — จะถูกเก็บกวาด ({importImpact.cleanupEligible.length} รายการ)</div>
                      <p className="text-sky-200/80 leading-relaxed">
                        จะลบเฉพาะตารางของบุคลากรที่ <strong>ถูกปิดการใช้งานแล้วทั้งหมด</strong> และมีครูอื่นรับคาบเดียวกัน (วิชา ห้อง วัน คาบ) ในไฟล์นี้แล้วเท่านั้น
                        ก่อนลบระบบประทับชื่อครูเจ้าของตารางลงในบันทึกหลังสอนที่ยังไม่มีผู้บันทึก (ประวัติไม่หาย) และ <strong>บันทึกลง log</strong> ว่าใครเคยเป็นผู้บันทึกและมีข้อมูลผูกอยู่เท่าใด
                      </p>
                      <ul className="space-y-1 max-h-48 overflow-y-auto">
                        {importImpact.cleanupEligible.map(c => (
                          <li key={c.id}>
                            <label className="flex items-start gap-2 cursor-pointer bg-black/20 rounded-lg px-2 py-1.5">
                              <input type="checkbox" checked={confirmedReviewKeys.has(`cleanup:${c.id}`)} onChange={() => toggleReviewKey(`cleanup:${c.id}`)}
                                disabled={isImporting} className="mt-0.5 rounded border-sky-500/40 bg-black text-emerald-500" />
                              <span>
                                <span className="font-mono text-white">{c.label}</span><br />
                                ครูที่ปิดการใช้งาน: <strong className="text-amber-200">{c.inactiveTeacherNames.join(', ')}</strong>
                              </span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {importImpact.inactiveNotReplaced.length > 0 && (
                    <details className="text-amber-200">
                      <summary className="cursor-pointer font-bold">⚠️ ครูที่ปิดการใช้งานแต่ยังไม่มีใครมาแทนในไฟล์นี้ ({importImpact.inactiveNotReplaced.length} รายการ) — ไม่ลบ</summary>
                      <ul className="mt-1 space-y-0.5 max-h-32 overflow-y-auto font-mono text-[10px]">
                        {importImpact.inactiveNotReplaced.map(s => <li key={s.id}>• {s.label}</li>)}
                      </ul>
                    </details>
                  )}

                  {importImpact.untouchedTotal > 0 && (
                    <details className="text-sky-300/80">
                      <summary className="cursor-pointer">ตารางเดิม {importImpact.untouchedTotal} รายการที่ไม่มีแถวตรงกันในไฟล์นี้ — ไม่ถูกแตะ (ครู {importImpact.untouched.length} ราย)</summary>
                      <ul className="mt-1 space-y-0.5 max-h-32 overflow-y-auto text-[10px]">
                        {importImpact.untouched.map(u => <li key={u.teacher}>• {u.teacher} — {u.docCount} คาบ</li>)}
                      </ul>
                      <p className="mt-1 text-[10px]">ถ้าครูกลุ่มนี้ย้ายออกแล้ว ให้ปิดการใช้งานบุคลากรก่อน เมื่อมีครูมาแทนในไฟล์ ระบบจะเก็บกวาดให้ในการนำเข้าครั้งถัดไป</p>
                    </details>
                  )}
                </div>
              )}

              {/* COURSE sync/replace — ลบข้อมูลตารางสอนเก่าที่ไม่มีในไฟล์ใหม่ */}
              {importType === 'COURSE' && (scanningStale || staleSchedules.length > 0) && (
                <div className="bg-amber-950/30 border border-amber-500/40 rounded-xl p-3 space-y-2">
                  {scanningStale ? (
                    <p className="text-[11px] text-amber-300 flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> กำลังตรวจข้อมูลตารางสอนเก่าที่ค้างอยู่…
                    </p>
                  ) : (
                    <>
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={replaceStale}
                          onChange={e => setReplaceStale(e.target.checked)}
                          className="mt-0.5 rounded border-amber-500/40 bg-black text-amber-500 focus:ring-amber-500/50"
                        />
                        <span className="text-[11px] text-amber-200">
                          <strong>โหมด Sync/Replace:</strong> พบตารางสอนเก่าของครูในไฟล์นี้ <strong>{staleSchedules.length} รายการ</strong> ที่ไม่มีอยู่ในไฟล์ที่กำลังนำเข้า
                          — ติ๊กเพื่อ <strong className="text-red-300">ลบถาวร</strong> (เฉพาะครูที่ปรากฏในไฟล์นี้ ไม่แตะครูคนอื่น; ข้ามรายการที่ยังมีบันทึกหลังสอน/คำขอเช็คชื่อย้อนหลัง/รายการสอนแทนผูกอยู่)
                        </span>
                      </label>
                      <details className="text-[10px] text-amber-300/80">
                        <summary className="cursor-pointer">ดูรายการที่จะลบ ({staleSchedules.length})</summary>
                        <ul className="mt-1 space-y-0.5 max-h-32 overflow-y-auto font-mono">
                          {staleSchedules.map(s => <li key={s.id}>• {s.label}</li>)}
                        </ul>
                      </details>
                    </>
                  )}
                </div>
              )}

            </div>
          )}

          {/* 4. Progress Loading Section */}
          {isImporting && (
            <div className="bg-slate-950/80 border border-indigo-500/30 rounded-2xl p-6 text-center space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between text-xs text-slate-300 font-bold">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin" />
                  <span>กำลังเขียนข้อมูลลง Firestore Database (Batched Writes)...</span>
                </div>
                <span className="font-mono text-indigo-400">{importProgress}%</span>
              </div>
              
              {/* Progress Bar */}
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 h-full rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${importProgress}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-500">กรุณาอย่าเพิ่งปิดหน้าต่าง ระบบกำลังประมวลผลการบันทึกข้อมูลเข้าฐานข้อมูลจริง</p>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-6 border-t border-white/5 bg-[#0a0f16] flex items-center justify-between">
          <div className="text-[10px] text-slate-500">
            {unlinkedSummary && unlinkedSummary.rowCount > 0
              ? <span className="text-amber-300 font-semibold">⚠️ {unlinkedSummary.rowCount} แถวยังไม่ผูกครู — ดูสรุปด้านบนก่อนยืนยัน</span>
              : 'School Management System • Batched Firestore Import Engine'}
          </div>
          <div className="flex items-center gap-3">
            {!lockImportType && (
            <button
              type="button"
              onClick={onClose}
              disabled={isImporting}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-white/5 transition-colors cursor-pointer"
            >
              ยกเลิก (Cancel)
            </button>
            )}
            
            {/* Re-upload trigger */}
            {file && (
              <button
                type="button"
                onClick={handleRemoveFile}
                disabled={isImporting}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-xl border border-white/5 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                อัปโหลดไฟล์ใหม่
              </button>
            )}

            {(() => {
              // COURSE ต้องรอ staff list โหลดเสร็จก่อน (ไม่งั้นจับคู่ครูพลาด);
              // PARENT ต้องรอ student IDs โหลดเสร็จก่อน (ไม่งั้น validate นักเรียนพลาด)
              const rosterLoading =
                (importType === 'COURSE' && isStaffLoading) ||
                (importType === 'PARENT' && isStudentIdsLoading);
              const parsing = !!file && !isValidated; // เลือกไฟล์แล้ว แต่ยังอ่าน/ตรวจไม่เสร็จ
              const disabled =
                isImporting || rosterLoading || parsing || !file || validCount === 0 || !hasPermissionForCurrentType || impactBlocksImport;
              const label = rosterLoading
                ? (importType === 'COURSE' ? 'กำลังโหลดรายชื่อครู...' : 'กำลังโหลดรายชื่อนักเรียน...')
                : parsing
                  ? 'กำลังอ่านและตรวจสอบไฟล์...'
                  : impactBlocksImport
                    ? `ยืนยันรายการที่ได้รับผลกระทบก่อน (${reviewDone}/${reviewTotal})`
                    : `ยืนยันการนำเข้าข้อมูล (${validCount} แถว)`;
              return (
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={disabled}
                  className={`px-5 py-2 text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5 ${
                    disabled
                      ? 'bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer shadow-[0_4px_15px_rgba(99,102,241,0.25)] active:scale-[0.98]'
                  }`}
                >
                  {(rosterLoading || parsing || isImporting)
                    ? <RefreshCw className="w-4 h-4 animate-spin" />
                    : <Database className="w-4 h-4" />}
                  {label}
                </button>
              );
            })()}
          </div>
        </div>

      </div>
    </div>
  );
}

