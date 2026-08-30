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
  ArrowRight
} from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { writeBatch, doc, serverTimestamp, collection, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useStore } from '../store';
import { Student, Course, GlobalCourse, UserRole } from '../types';
import { ROLE_NAMES_TH } from './StaffRoleManagementPage';
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

export function BulkDataImportModal({ isOpen, onClose, initialImportType, onImportSuccess }: BulkDataImportModalProps) {
  const [importType, setImportType] = useState<ImportType>(initialImportType || 'STUDENT');
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [rawParsedRows, setRawParsedRows] = useState<Record<string, any>[] | null>(null);
  const [previewData, setPreviewData] = useState<ValidatedRow[]>([]);
  const [isValidated, setIsValidated] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importError, setImportError] = useState<string | null>(null);
  const [realStaffList, setRealStaffList] = useState<Array<{ id: string; fullName?: string; firstName?: string; lastName?: string; displayName?: string; email?: string; prefix?: string }>>([]);
  const [isStaffLoading, setIsStaffLoading] = useState(false);
  const [realStudentIds, setRealStudentIds] = useState<Set<string>>(new Set());
  const [isStudentIdsLoading, setIsStudentIdsLoading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          };
        });
        setRealStaffList(staff);
        setIsStaffLoading(false);
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

  const templateFilename = (t: ImportType): string =>
    t === 'STUDENT' ? 'Student_Template.csv'
    : t === 'TEACHER' ? 'Teacher_Template.csv'
    : t === 'PARENT' ? 'Parent_Template.csv'
    : 'Course_Template.csv';

  // Download template CSV file — header row ต้องตรงกับที่ validateRows()/parser คาดหวัง
  const handleDownloadTemplate = () => {
    const templates: Record<ImportType, string> = {
      STUDENT: 'Student ID,Prefix,FirstName,LastName,Room,StudentNo,ParentMobile\n38501,นาย,กฤตยชญ์,บุญช่วย,ม.5/8,1,0812345678\n38502,นาย,ณัฐพล,สุขสบาย,ม.5/8,2,0898765432\n38503,นางสาว,สมศรี,ใจดี,ม.5/8,3,0861112233',
      // หมายเหตุ: teacher-04 เว้นคอลัมน์ Roles และ Department ว่าง → ระบบตั้งเป็น SUBJECT_TEACHER อัตโนมัติ
      TEACHER: 'Teacher ID,Prefix,FirstName,LastName,Position,Email,Roles,Department\nteacher-01,นาย,ทวี,รักเรียน,ครู คศ.1,tawee@utd.ac.th,"SUBJECT_TEACHER,HOMEROOM_TEACHER",math-dept\nteacher-02,นางสาว,สมจิต,แข็งขัน,ครู คศ.2,somjit@utd.ac.th,SUBJECT_TEACHER,sci-dept\nteacher-03,นางสาว,พิมลวรรณ,ศรีงาม,ครูผู้ช่วย,pimonwan@utd.ac.th,GUIDANCE_COUNSELOR,thai-dept\nteacher-04,นาย,ประสงค์,ตั้งใจสอน,ครูผู้ช่วย,prasong@utd.ac.th,,',
      COURSE: 'Course Code,Course Name,Level,Room,Credits,Instructor ID\nTH32101,ภาษาไทย 3,ม.5,ม.5/8,1.5,teacher-somchai\nMA32101,คณิตศาสตร์พื้นฐาน 3,ม.5,ม.5/8,1.5,teacher-kiattisak\nSCI32201,ฟิสิกส์เพิ่มเติม 1,ม.5,ม.5/8,2.0,teacher-somjai\nEN32101,ภาษาอังกฤษ 3,ม.5,ม.5/8,1.0,teacher-weena',
      PARENT: 'Student ID,ParentPrefix,ParentFirstName,ParentLastName,ParentNationalId,ParentMobile,Relationship\n38501,นาย,สมชาย,บุญช่วย,1101700207269,0812345678,บิดา\n38502,นาง,มาลี,สุขสบาย,3100600258967,0898765432,มารดา\n38503,นาย,วิรัตน์,ใจดี,1409901259376,0861112233,ผู้ปกครอง',
    };
    const headers = templates[importType];
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
        const email = getFieldValue(normalized, ['email', 'e-mail', 'อีเมล', 'อีเมล์']);
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
          col4: room || level || 'ทุกห้อง',
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
    setRawParsedRows(null);
    setPreviewData([]);
    setIsValidated(false);
    setImportError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Real batched Firestore writes (chunked <= 500)
  const handleConfirmImport = async () => {
    if (previewData.length === 0) return;

    // กันไม่ให้ import ก่อนข้อมูลอ้างอิงโหลดเสร็จ (COURSE→staff, PARENT→students)
    if (importType === 'COURSE' && isStaffLoading) {
      alert('⏳ กำลังโหลดรายชื่อครูจากฐานข้อมูล กรุณารอสักครู่แล้วลองใหม่');
      return;
    }
    if (importType === 'PARENT' && isStudentIdsLoading) {
      alert('⏳ กำลังโหลดรายชื่อนักเรียนจากฐานข้อมูล กรุณารอสักครู่แล้วลองใหม่');
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
              parentUid: null, // Critical: Unset/null on initial import until linked
              parentId: null,
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
              email: parsedData.email,
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
              const cleanRoom = (parsedData.room || parsedData.level || 'all').replace(/[^a-zA-Z0-9]/g, '_');
              const dayThNames: Record<string, string> = {
                monday: 'จันทร์',
                tuesday: 'อังคาร',
                wednesday: 'พุธ',
                thursday: 'พฤหัสบดี',
                friday: 'ศุกร์',
                saturday: 'เสาร์',
                sunday: 'อาทิตย์'
              };

              for (const slot of (parsedData.slots || [])) {
                const scheduleDocId = `sch_${parsedData.subjectCode}_${cleanRoom}_${slot.dayOfWeek}_p${slot.periodNumber}`;
                const scheduleRef = doc(db, 'schedules', scheduleDocId);

                const schedulePayload = {
                  id: scheduleDocId,
                  subjectCode: parsedData.subjectCode,
                  subjectName: parsedData.subjectName,
                  room: parsedData.room || '',
                  level: parsedData.level || '',
                  credits: parsedData.credits || 1.5,
                  teacherIds: parsedData.matchedTeacherId ? [parsedData.matchedTeacherId] : [],
                  teacherId: parsedData.matchedTeacherId || null,
                  teacherEmail: parsedData.matchedTeacherEmail || parsedData.teacherEmail || (parsedData.matchedTeacherId ? `${parsedData.matchedTeacherId}@utd.ac.th` : null),
                  sourceTeacherName: parsedData.teacherName || '',
                  department: parsedData.department || '',
                  unlinkedTeacherName: parsedData.matchedTeacherId ? null : (parsedData.unlinkedTeacherName || parsedData.teacherName || null),
                  unlinkedTeacherEmail: parsedData.matchedTeacherId ? null : (parsedData.unlinkedTeacherEmail || parsedData.teacherEmail || null),
                  subjectType: parsedData.subjectType, // 'MAIN' or 'ACTIVITY'
                  dayOfWeek: slot.dayOfWeek,
                  periodNumber: slot.periodNumber,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp()
                };

                batch.set(scheduleRef, schedulePayload, { merge: true });

                const scheduleLabel = `${dayThNames[slot.dayOfWeek] || slot.dayOfWeek} คาบ ${slot.periodNumber}`;
                const courseSlotId = `course_${parsedData.subjectCode}_${cleanRoom}_${slot.dayOfWeek}_p${slot.periodNumber}`;
                const finalTeacherEmail = parsedData.matchedTeacherEmail || parsedData.teacherEmail || (parsedData.matchedTeacherId ? `${parsedData.matchedTeacherId}@utd.ac.th` : 'kiattisak@utd.ac.th');

                newCoursesToStore.push({
                  id: courseSlotId,
                  code: parsedData.subjectCode,
                  name: parsedData.subjectName,
                  room: parsedData.room || parsedData.level || '',
                  term: '1/2569',
                  studentsCount: 40,
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
              const cleanRoom = (parsedData.room || 'all').replace(/[^a-zA-Z0-9]/g, '_');
              const scheduleDocId = `sch_${parsedData.courseCode}_${cleanRoom}`;
              const scheduleRef = doc(db, 'schedules', scheduleDocId);

              const schedulePayload = {
                id: scheduleDocId,
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

              const courseId = `course_${parsedData.courseCode}_${cleanRoom}`;
              newCoursesToStore.push({
                id: courseId,
                code: parsedData.courseCode,
                name: parsedData.courseName,
                room: parsedData.room,
                term: '1/2569',
                studentsCount: 40,
                periodIndex: 1,
                schedule: 'จันทร์ 08:30 - 09:20 น.',
                attendanceTaken: false,
                teacherName: parsedData.instructorId || 'ครูผู้สอน',
                teacherEmail: 'kiattisak@utd.ac.th'
              });

              newGlobalCoursesToStore.push({
                courseId,
                code: parsedData.courseCode,
                courseName: parsedData.courseName,
                teacherName: parsedData.instructorId || 'ครูผู้สอน',
                teacherEmail: 'kiattisak@utd.ac.th',
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

  // (Re)validate the preview whenever raw rows OR the roster data they are matched
  // against change. This is the core fix: if staff/students finish loading AFTER the
  // file was parsed, the preview is recomputed instead of showing a stale "ไม่พบบัญชีครู".
  useEffect(() => {
    if (!rawParsedRows) {
      setPreviewData([]);
      setIsValidated(false);
      return;
    }
    setPreviewData(validateRows(rawParsedRows, importType));
    setIsValidated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawParsedRows, importType, realStaffList, realStudentIds]);

  if (!isOpen) return null;

  const validCount = previewData.filter(r => r.isValid).length;
  const invalidCount = previewData.filter(r => !r.isValid).length;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in text-slate-200">
      <div className="bg-[#11151d] border border-white/10 rounded-2xl max-w-4xl w-full shadow-2xl flex flex-col my-8 max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
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
          <button 
            onClick={onClose}
            disabled={isImporting}
            className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

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

          {/* 1. Import Type Selector */}
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

          {/* Prerequisite Alert for COURSE import if staff roster is empty in Firestore */}
          {importType === 'COURSE' && !isStaffLoading && realStaffList.length === 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start justify-between gap-3 text-amber-300 animate-in fade-in">
              <div className="flex items-start gap-3">
                <Users className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold">ข้อมูลการจับคู่บัญชีครูผู้สอน</h4>
                  <p className="text-[11px] text-amber-200/90 mt-0.5 leading-relaxed">
                    ระบบจะใช้คอลัมน์ <strong>อีเมล์</strong> ในไฟล์ตารางสอนเพื่อจับคู่กับบัญชีบุคลากรในระบบโดยอัตโนมัติ หากยังไม่ได้นำเข้ารายชื่อครู ระบบจะบันทึกข้อมูลตารางสอนและอีเมลไว้พร้อมสำหรับการผูกบัญชีในภายหลัง
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setImportType('TEACHER');
                  if (file) handleRemoveFile();
                }}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold rounded-lg border border-amber-500/40 transition-colors cursor-pointer"
              >
                <span>สลับไปนำเข้ารายชื่อครู</span>
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
                ขั้นตอนที่ 2: อัปโหลดไฟล์เอกสาร
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
                  <span>ขั้นตอนที่ 3: ตรวจสอบความถูกต้องของข้อมูลจริง ({previewData.length} แถวจากไฟล์)</span>
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
            School Management System • Batched Firestore Import Engine
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isImporting}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-white/5 transition-colors cursor-pointer"
            >
              ยกเลิก (Cancel)
            </button>
            
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
              const disabled = isImporting || rosterLoading || !file || validCount === 0 || !hasPermissionForCurrentType;
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
                  <Database className="w-4 h-4" />
                  {rosterLoading
                    ? (importType === 'COURSE' ? 'กำลังโหลดรายชื่อครู...' : 'กำลังโหลดรายชื่อนักเรียน...')
                    : `ยืนยันการนำเข้าข้อมูล (${validCount} แถว)`}
                </button>
              );
            })()}
          </div>
        </div>

      </div>
    </div>
  );
}

