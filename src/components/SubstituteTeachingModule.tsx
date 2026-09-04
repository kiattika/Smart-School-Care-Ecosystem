import React, { useState, useEffect, useMemo } from 'react';
import {
  UserCheck,
  CheckCircle,
  XCircle,
  AlertCircle,
  Calendar,
  FileText,
  PlusCircle,
  Send,
  ShieldAlert,
  Clock,
  Check,
  Info,
  Layers,
  Upload,
  Paperclip,
  Users,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useStore } from '../store';
import { cn, isSameRoom } from '../lib/utils';
import {
  UserRole,
  SubstituteAssignment,
  SubstituteApprovalStage,
  SUBSTITUTE_STAGE_ROLE,
  SUBSTITUTE_TEACHER_DECLINED_ROLE,
} from '../types';
import { ROLE_NAMES_TH } from './StaffRoleManagementPage';
import { useDepartments } from '../hooks/useDepartments';
import { uploadSubstituteWorksheet } from '../services/storageService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const THAI_DAY_ABBREV: Record<number, string> = { 1: 'จ', 2: 'อ', 3: 'พ', 4: 'ฤ', 5: 'ศ', 6: 'ส', 7: 'อา' };
const DAY_WORD_TO_NUM: Record<string, number> = {
  monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 7,
};

/** JS getDay() (0=Sun..6=Sat) → เลขวันแบบไทย 1=จันทร์..7=อาทิตย์ */
function jsDateToThaiDayNum(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00');
  const js = d.getDay();
  return js === 0 ? 7 : js;
}

interface NormalizedSchedule {
  id: string;
  emails: string[];       // อีเมลครูผู้สอนคาบนี้ (รองรับทั้ง teacherEmail และ teacherIds)
  day: number;            // 1=จันทร์..7
  period: number;         // คาบ 0 = โฮมรูม (เป็นคาบจริง — ห้าม falsy check)
  code: string;
  name: string;
  room: string;
  targetClass: string;
  level: string;          // ระดับชั้น (เช่น "ม.5") — ใช้จัดลำดับครูแนะนำสอนแทนตามระดับชั้นเดียวกัน
}

/** คาบสอนหนึ่งวันหนึ่งคาบ ผูกกับวันที่จริงในช่วงที่เลือก (ใช้เลือกได้หลายวัน/บางคาบ) */
interface DateSlot extends NormalizedSchedule {
  date: string;
}

/** ผู้สมัครครูสอนแทนที่ระบบแนะนำ พร้อมลำดับความสำคัญ (tier) */
interface SubCandidate {
  email: string;
  name: string;
  tier: 1 | 2 | 3; // 1=กลุ่มสาระ+ระดับเดียวกัน, 2=กลุ่มสาระเดียวกัน(ระดับอื่น), 3=ข้ามกลุ่มสาระ (บังคับ SUPERVISION_ONLY)
  conflict: string | null;
}

const STAGE_LABEL_TH: Record<SubstituteApprovalStage, string> = {
  STAGE_1_HEAD_OF_DEPARTMENT: 'ขั้น 1 · หัวหน้ากลุ่มสาระฯ',
  STAGE_2_ACADEMIC_HEAD: 'ขั้น 2 · หัวหน้าฝ่ายวิชาการและหลักสูตร',
  STAGE_3_DEPUTY_DIRECTOR_ACADEMIC: 'ขั้น 3 · รองผู้อำนวยการฝ่ายวิชาการ',
  STAGE_4_DIRECTOR: 'ขั้น 4 · ผู้อำนวยการ',
  COMPLETED: 'อนุมัติครบทุกขั้น',
};

const TRIGGER_LABEL_TH: Record<string, string> = {
  SICK_LEAVE: 'ลาป่วย (หัวหน้ากลุ่มสาระฯ จัดครูโดยตรง)',
  PERSONAL_LEAVE: 'ลากิจ (แจ้งเหตุผลล่วงหน้า)',
  OFFICIAL_DUTY: 'ไปราชการ (แจ้งเหตุผลล่วงหน้า)',
};

const SIM_ROLES: { role: UserRole; label: string }[] = [
  { role: 'HEAD_OF_DEPARTMENT', label: 'หัวหน้ากลุ่มสาระฯ — เสนอจัดครู / อนุมัติขั้น 1' },
  { role: 'ACADEMIC_HEAD', label: 'หัวหน้าฝ่ายวิชาการฯ — อนุมัติขั้น 2' },
  { role: 'DEPUTY_DIRECTOR_ACADEMIC', label: 'รองผู้อำนวยการฝ่ายวิชาการ — อนุมัติขั้น 3' },
  { role: 'DIRECTOR', label: 'ผู้อำนวยการ — อนุมัติขั้น 4' },
  { role: 'SUBJECT_TEACHER', label: 'ครูผู้สอน — ขอลากิจ/ราชการเอง หรือรับมอบหมายสอนแทน' },
  { role: 'HOMEROOM_TEACHER', label: 'ครูประจำชั้น — ขอลากิจ/ราชการเอง หรือรับมอบหมายสอนแทน' },
];

// HEAD_OF_DEPARTMENT อยู่ในนี้ด้วย เพื่อให้เห็นคิว "รออนุมัติขั้น 1" ของคำขอที่ครูยื่นขอเอง
// (ปกติ HOD เป็นผู้เสนอเอง ขั้น 1 จึงถือว่าอนุมัติแล้วอัตโนมัติ — แต่ถ้าครู SUBJECT_TEACHER/
// HOMEROOM_TEACHER ยื่นขอเองสำหรับลากิจ/ไปราชการ ขั้น 1 ต้องรอ HOD อนุมัติจริงผ่านคิวนี้)
const APPROVAL_ROLES: UserRole[] = ['HEAD_OF_DEPARTMENT', 'ACADEMIC_HEAD', 'DEPUTY_DIRECTOR_ACADEMIC', 'DIRECTOR'];

// ---------------------------------------------------------------------------
// Live schedules subscription (read-only)
// ---------------------------------------------------------------------------

function useSchedulesCollection(staffById: Map<string, string>) {
  const [raw, setRaw] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'schedules'),
      (snap) => setRaw(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      (err) => console.warn('[SubstituteTeachingModule] schedules listener notice:', err.message)
    );
    return () => unsub();
  }, []);

  return useMemo<NormalizedSchedule[]>(() => {
    return raw.map((s: any) => {
      const emails: string[] = [];
      if (typeof s.teacherEmail === 'string' && s.teacherEmail) emails.push(s.teacherEmail.toLowerCase());
      if (Array.isArray(s.teacherIds)) {
        s.teacherIds.forEach((uid: string) => {
          const email = staffById.get(uid);
          if (email) emails.push(email.toLowerCase());
        });
      }
      if (typeof s.teachingPartner === 'string' && s.teachingPartner) emails.push(s.teachingPartner.toLowerCase());

      let day = 0;
      if (typeof s.scheduleDay === 'number') day = s.scheduleDay;
      else if (typeof s.dayOfWeek === 'string') day = DAY_WORD_TO_NUM[s.dayOfWeek.toLowerCase()] || 0;
      else if (typeof s.day === 'number') day = s.day;

      const period =
        typeof s.periodNumber === 'number' ? s.periodNumber :
        typeof s.period === 'number' ? s.period : -1;

      return {
        id: s.id,
        emails: Array.from(new Set(emails)),
        day,
        period,
        code: s.courseCode || s.subjectCode || '',
        name: s.courseName || s.subjectName || s.courseCode || s.subjectCode || 'รายวิชา',
        room: s.room || s.targetClass || '',
        targetClass: s.targetClass || s.room || '',
        level: s.level || '',
      };
    });
  }, [raw, staffById]);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SubstituteTeachingModule() {
  const user = useStore(s => s.user);
  const staffDirectory = useStore(s => s.staffDirectory);
  const substituteAssignments = useStore(s => s.substituteAssignments);
  const students = useStore(s => s.students);
  const proposeSubstituteAssignment = useStore(s => s.proposeSubstituteAssignment);
  const respondToTeacherConfirmation = useStore(s => s.respondToTeacherConfirmation);
  const decideSubstituteApproval = useStore(s => s.decideSubstituteApproval);
  const completeSubstituteAssignment = useStore(s => s.completeSubstituteAssignment);

  const isDev = import.meta.env.DEV;

  // บทบาทของผู้ใช้จริงถ้าอยู่ในลำดับ workflow สอนแทน — ใช้เป็นค่าเริ่มต้นของ persona
  const SUB_WORKFLOW_ROLES: UserRole[] = ['HEAD_OF_DEPARTMENT', 'ACADEMIC_HEAD', 'DEPUTY_DIRECTOR_ACADEMIC', 'DIRECTOR', 'SUBJECT_TEACHER', 'HOMEROOM_TEACHER'];
  const realWorkflowRole = (user?.activeRole && SUB_WORKFLOW_ROLES.includes(user.activeRole)) ? user.activeRole : undefined;

  // --- persona: เริ่มจากบทบาทผู้ใช้จริง (DEV มี dropdown override ให้ทดสอบทุกขั้นได้) ---
  const [simRole, setSimRole] = useState<UserRole>(realWorkflowRole || 'HEAD_OF_DEPARTMENT');
  const [simEmail, setSimEmail] = useState<string>(user?.email || '');

  // sync persona เมื่อผู้ใช้จริงเปลี่ยน (สลับบทบาท / ล็อกอินใหม่)
  useEffect(() => {
    setSimRole(realWorkflowRole || 'HEAD_OF_DEPARTMENT');
    setSimEmail(user?.email || '');
  }, [user?.email, user?.activeRole]); // eslint-disable-line react-hooks/exhaustive-deps

  const staffById = useMemo(() => {
    const m = new Map<string, string>();
    staffDirectory.forEach(s => { if (s.email) m.set(s.id, s.email); });
    return m;
  }, [staffDirectory]);

  const schedules = useSchedulesCollection(staffById);

  const effectiveRole: UserRole = simRole;
  const effectiveEmail = (simEmail || user?.email || '').toLowerCase();
  const effectiveProfile = useMemo(
    () => staffDirectory.find(s => s.email?.toLowerCase() === effectiveEmail),
    [staffDirectory, effectiveEmail]
  );
  const effectiveName =
    effectiveProfile
      ? `${effectiveProfile.prefix || ''}${effectiveProfile.firstName} ${effectiveProfile.lastName}`.trim()
      : (user?.displayName || effectiveEmail || 'ผู้ใช้ระบบ');
  const effectiveDeptId = effectiveProfile?.assignments?.departmentId || '';

  const { nameOf: deptName } = useDepartments();

  // --- toast ---
  const [toast, setToast] = useState<{ title: string; message: string; error?: boolean } | null>(null);
  const showToast = (title: string, message: string, error = false) => {
    setToast({ title, message, error });
    setTimeout(() => setToast(null), 5000);
  };

  // --- propose modal ---
  const [proposeOpen, setProposeOpen] = useState(false);
  const [absentEmail, setAbsentEmail] = useState('');
  const [triggerType, setTriggerType] = useState<'SICK_LEAVE' | 'PERSONAL_LEAVE' | 'OFFICIAL_DUTY'>('SICK_LEAVE');
  const [leaveReason, setLeaveReason] = useState('');
  const todayStr = new Date().toISOString().split('T')[0];
  // ช่วงวันที่ลา — รองรับลาหลายวันติดกันแบบฟอร์มจริง (เดิมเลือกได้แค่วันเดียว)
  const [rangeStart, setRangeStart] = useState(todayStr);
  const [rangeEnd, setRangeEnd] = useState(todayStr);
  // เลือกได้บางคาบไม่บังคับทุกคาบ — key คือ `${date}::${scheduleId}`
  const [selectedSlotKeys, setSelectedSlotKeys] = useState<Set<string>>(new Set());
  // ครูสอนแทนที่เลือกต่อคาบ (key เดียวกับ selectedSlotKeys)
  const [slotSubEmail, setSlotSubEmail] = useState<Record<string, string>>({});
  // ไฟล์ใบงาน/ใบความรู้/แบบทดสอบต่อคาบ — บังคับเมื่อ coverageMode เป็น SUPERVISION_ONLY (ครูข้ามกลุ่มสาระ)
  const [slotWorksheetFile, setSlotWorksheetFile] = useState<Record<string, File | null>>({});
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // --- decide modal (ขั้นอนุมัติ 4 ขั้น) ---
  const [decideTarget, setDecideTarget] = useState<SubstituteAssignment | null>(null);
  const [decideMode, setDecideMode] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [decideComment, setDecideComment] = useState('');

  // --- confirm modal (TASK 4 — ครูที่ถูกมอบหมายยืนยัน/ปฏิเสธก่อนเข้า approval chain) ---
  const [confirmTarget, setConfirmTarget] = useState<SubstituteAssignment | null>(null);
  const [confirmMode, setConfirmMode] = useState<'CONFIRM' | 'DECLINE'>('CONFIRM');
  const [confirmReason, setConfirmReason] = useState('');

  // --- reselect substitute modal (TASK 4 — เลือกครูสอนแทนคนใหม่ หลังคนเดิมกดปฏิเสธ) ---
  const [reselectTarget, setReselectTarget] = useState<SubstituteAssignment | null>(null);
  const [reselectEmail, setReselectEmail] = useState('');

  // --- complete modal ---
  const [completeTarget, setCompleteTarget] = useState<SubstituteAssignment | null>(null);
  const [cSummary, setCSummary] = useState('');
  const [cProblems, setCProblems] = useState('');
  const [cSolutions, setCSolutions] = useState('');
  const [cAttendance, setCAttendance] = useState<Record<string, 'PRESENT' | 'ABSENT' | 'LATE' | 'LEAVE'>>({});

  // -----------------------------------------------------------------------
  // Derived
  // -----------------------------------------------------------------------
  const deptTeachers = useMemo(() => {
    // ใช้ departmentId จริงของผู้ใช้เสมอ — ไม่ fallback ไปกลุ่มสาระแรก (เดิม hack ทำให้ role ผู้บริหารเห็นกระดานผิดกลุ่ม)
    const deptId = effectiveDeptId;
    return staffDirectory.filter(s => s.assignments?.departmentId === deptId);
  }, [staffDirectory, effectiveDeptId, isDev]);

  // ครู SUBJECT_TEACHER/HOMEROOM_TEACHER ขอลากิจ/ไปราชการด้วยตนเองได้ (ไม่รวมลาป่วย — หัวหน้ากลุ่มสาระฯ
  // ยังคงเป็นคนจัดครูให้โดยตรงตามเดิม) — HOD ยังเสนอแทนคนอื่นในกลุ่มสาระได้เหมือนเดิมทุกกรณีการลา
  const canSelfPropose = effectiveRole === 'SUBJECT_TEACHER' || effectiveRole === 'HOMEROOM_TEACHER';

  // ระดับชั้นที่แต่ละครู (อีเมล lowercase) กำลังสอนอยู่จริง — อ่านจากตารางสอนสด ไม่ใช่ import เก่า
  const teacherLevels = useMemo(() => {
    const m = new Map<string, Set<string>>();
    schedules.forEach(s => {
      if (!s.level) return;
      s.emails.forEach(email => {
        if (!m.has(email)) m.set(email, new Set());
        m.get(email)!.add(s.level);
      });
    });
    return m;
  }, [schedules]);

  // คาบสอนจริงของครูที่ลา ตลอดช่วงวันที่เลือก (ผูกกับวันที่จริงแต่ละวัน ไม่ใช่แค่วันเดียว)
  const rangeSlots = useMemo<DateSlot[]>(() => {
    if (!absentEmail || !rangeStart || !rangeEnd) return [];
    const start = new Date(rangeStart + 'T00:00:00');
    const end = new Date(rangeEnd + 'T00:00:00');
    if (end < start) return [];
    const out: DateSlot[] = [];
    const emailLower = absentEmail.toLowerCase();
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const dayNum = jsDateToThaiDayNum(dateStr);
      schedules
        .filter(s => s.emails.includes(emailLower) && s.day === dayNum && s.period >= 0)
        .sort((a, b) => a.period - b.period)
        .forEach(s => out.push({ ...s, date: dateStr }));
    }
    return out;
  }, [schedules, absentEmail, rangeStart, rangeEnd]);

  const slotKey = (s: DateSlot) => `${s.date}::${s.id}`;

  const checkCandidateConflict = (candidateEmail: string, sched: NormalizedSchedule | undefined, date: string): string | null => {
    if (!sched) return null;
    const email = candidateEmail.toLowerCase();
    const clash = schedules.find(s => s.emails.includes(email) && s.day === sched.day && s.period === sched.period);
    if (clash) return `ติดสอน ${clash.code || clash.name} (${clash.room})`;
    const scheduleStr = `${THAI_DAY_ABBREV[sched.day] || ''}${sched.period}`;
    const subClash = substituteAssignments.find(sa =>
      sa.substituteTeacherEmail?.toLowerCase() === email &&
      sa.date === date &&
      sa.schedule === scheduleStr &&
      (sa.status === 'APPROVED' || sa.status === 'PENDING_APPROVAL')
    );
    if (subClash) return `ถูกจัดสอนแทนห้อง ${subClash.room} คาบนี้แล้ว`;
    return null;
  };

  /**
   * แนะนำครูสอนแทนสำหรับคาบที่เลือก เรียงลำดับ:
   * tier 1 = กลุ่มสาระเดียวกัน + สอนระดับชั้นเดียวกัน + ว่างจริง
   * tier 2 = กลุ่มสาระเดียวกัน (ระดับอื่น) + ว่างจริง
   * tier 3 = ข้ามกลุ่มสาระ (ให้เลือกเองทั้งหมด ระบบไม่ auto-suggest ระดับนี้) — บังคับ SUPERVISION_ONLY
   */
  const getCandidatesForSlot = (
    slot: DateSlot,
    opts?: { absentEmailOverride?: string; deptIdOverride?: string }
  ): { tier1: SubCandidate[]; tier2: SubCandidate[]; tier3: SubCandidate[] } => {
    const deptId = opts?.deptIdOverride ?? effectiveDeptId;
    const absentLower = (opts?.absentEmailOverride ?? absentEmail).toLowerCase();
    const toCandidate = (t: typeof staffDirectory[number], tier: 1 | 2 | 3): SubCandidate => ({
      email: t.email,
      name: `${t.prefix || ''}${t.firstName} ${t.lastName}`.trim(),
      tier,
      conflict: checkCandidateConflict(t.email, slot, slot.date),
    });

    const inDept = staffDirectory.filter(t => t.email?.toLowerCase() !== absentLower && t.assignments?.departmentId === deptId);
    const tier1: SubCandidate[] = [];
    const tier2: SubCandidate[] = [];
    inDept.forEach(t => {
      const levels = teacherLevels.get(t.email?.toLowerCase() || '');
      const sameLevel = !!slot.level && !!levels?.has(slot.level);
      (sameLevel ? tier1 : tier2).push(toCandidate(t, sameLevel ? 1 : 2));
    });

    const tier1Free = tier1.filter(c => !c.conflict);
    const tier2Free = tier2.filter(c => !c.conflict);

    // ขยายไปกลุ่มสาระอื่นเฉพาะเมื่อกลุ่มสาระเดียวกันหาครูว่างจริงไม่ได้เลย (สุดวิสัยจริง)
    const tier3: SubCandidate[] = (tier1Free.length === 0 && tier2Free.length === 0)
      ? staffDirectory
          .filter(t =>
            t.email?.toLowerCase() !== absentLower &&
            t.assignments?.departmentId !== deptId &&
            (t.roles.includes('SUBJECT_TEACHER') || t.roles.includes('HOMEROOM_TEACHER'))
          )
          .map(t => toCandidate(t, 3))
      : [];

    return { tier1, tier2, tier3 };
  };

  // งานในกลุ่มสาระฯ ของ HOD (ดูจากกลุ่มสาระของครูที่ขาด หรือ departmentId ที่บันทึกไว้)
  const deptAssignments = useMemo(() => {
    // ใช้ departmentId จริงของผู้ใช้เสมอ — ไม่ fallback ไปกลุ่มสาระแรก (เดิม hack ทำให้ role ผู้บริหารเห็นกระดานผิดกลุ่ม)
    const deptId = effectiveDeptId;
    return substituteAssignments
      .filter(sa => sa.departmentId === deptId || sa.proposedByEmail?.toLowerCase() === effectiveEmail)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [substituteAssignments, effectiveDeptId, effectiveEmail, isDev]);

  // คิวอนุมัติของ role ปัจจุบัน
  const myApprovalStage = useMemo(() => {
    const entry = Object.entries(SUBSTITUTE_STAGE_ROLE).find(([, role]) => role === effectiveRole);
    return entry ? (entry[0] as SubstituteApprovalStage) : null;
  }, [effectiveRole]);

  const approvalQueue = useMemo(() => {
    if (!myApprovalStage) return [];
    return substituteAssignments
      .filter(sa => sa.status === 'PENDING_APPROVAL' && sa.currentApprovalStage === myApprovalStage)
      .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  }, [substituteAssignments, myApprovalStage]);

  // ภาระสอนแทนของครูผู้รับมอบหมาย
  const mySubTasks = useMemo(() => {
    return substituteAssignments
      .filter(sa => sa.substituteTeacherEmail?.toLowerCase() === effectiveEmail && sa.status === 'APPROVED')
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [substituteAssignments, effectiveEmail]);

  // คำขอลากิจ/ไปราชการที่ครู (SUBJECT_TEACHER/HOMEROOM_TEACHER) ยื่นขอด้วยตนเอง — ต่างจาก deptAssignments
  // ของ HOD ตรงที่นี่คือมุมมอง "คำขอของฉัน" เฉพาะรายการที่ตัวเองเป็นผู้เสนอเอง (ไม่ใช่กรณี HOD จัดให้)
  const myOwnRequests = useMemo(() => {
    return substituteAssignments
      .filter(sa => sa.proposedByEmail?.toLowerCase() === effectiveEmail && sa.proposedByRole !== 'HEAD_OF_DEPARTMENT')
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [substituteAssignments, effectiveEmail]);

  // TASK 4 — รายการที่รอ "ตัวเอง" กดยืนยัน/ปฏิเสธก่อนเข้า approval chain (ไม่รวมรายการที่ตัวเองเสนอเอง —
  // กรณีคู่แลกคาบ (SWAP) เอกสารฝั่ง "จ่ายคืน" มี substituteTeacherEmail เป็นตัวเองแต่เสนอเองไปแล้ว
  // ถือว่ายินยอมโดยปริยาย ไม่ต้องมายืนยันซ้ำ)
  const myPendingConfirmations = useMemo(() => {
    return substituteAssignments
      .filter(sa =>
        sa.substituteTeacherEmail?.toLowerCase() === effectiveEmail &&
        sa.status === 'PENDING_TEACHER_CONFIRMATION' &&
        sa.proposedByEmail?.toLowerCase() !== effectiveEmail
      )
      .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  }, [substituteAssignments, effectiveEmail]);

  const isOverdue = (sa: SubstituteAssignment) =>
    !sa.isCompleted && sa.postTeachingDueAt ? Date.now() > new Date(sa.postTeachingDueAt).getTime() : false;

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------
  const resetProposeForm = () => {
    setAbsentEmail(''); setTriggerType('SICK_LEAVE'); setLeaveReason('');
    setRangeStart(todayStr); setRangeEnd(todayStr);
    setSelectedSlotKeys(new Set()); setSlotSubEmail({}); setSlotWorksheetFile({});
    setNotes('');
  };

  const handlePropose = async () => {
    const absent = staffDirectory.find(s => s.email?.toLowerCase() === absentEmail.toLowerCase());
    const slots = rangeSlots.filter(s => selectedSlotKeys.has(slotKey(s)));
    if (!absent || slots.length === 0) {
      showToast('ข้อมูลไม่ครบ', 'กรุณาเลือกครูที่ลาและอย่างน้อย 1 คาบสอนที่ต้องจัดครูแทน', true);
      return;
    }
    if ((triggerType === 'PERSONAL_LEAVE' || triggerType === 'OFFICIAL_DUTY') && !leaveReason.trim()) {
      showToast('ต้องระบุเหตุผล', 'การลากิจ/ไปราชการ ต้องแจ้งเหตุผลประกอบ', true);
      return;
    }

    // ตรวจให้ครบทุกคาบก่อนเริ่มอัปโหลด/บันทึกจริง กันบันทึกครึ่งๆ กลางๆ
    for (const slot of slots) {
      const key = slotKey(slot);
      const slotLabel = `${THAI_DAY_ABBREV[slot.day] || ''}${slot.period} (${slot.date})`;
      const subEmailForSlot = slotSubEmail[key];
      if (!subEmailForSlot) {
        showToast('เลือกครูสอนแทนไม่ครบ', `กรุณาเลือกครูสอนแทนสำหรับคาบ ${slotLabel}`, true);
        return;
      }
      const sub = staffDirectory.find(s => s.email?.toLowerCase() === subEmailForSlot.toLowerCase());
      const isCrossDept = sub?.assignments?.departmentId !== effectiveDeptId;
      if (isCrossDept && !slotWorksheetFile[key]) {
        showToast('ต้องแนบใบงาน', `ครูสอนแทนคาบ ${slotLabel} เป็นครูข้ามกลุ่มสาระ (ควบคุมชั้นเรียนอย่างเดียว) — ต้องแนบใบงาน/ใบความรู้/แบบทดสอบก่อนส่งคำขอ`, true);
        return;
      }
    }

    setSubmitting(true);
    try {
      let successCount = 0;
      for (const slot of slots) {
        const key = slotKey(slot);
        const scheduleStr = `${THAI_DAY_ABBREV[slot.day] || ''}${slot.period}`;
        const leaveReasonFinal = leaveReason.trim() || (triggerType === 'SICK_LEAVE' ? 'ลาป่วย' : '');
        const deptIdFinal = effectiveDeptId || absent.assignments?.departmentId || '';
        const deptNameFinal = deptName(effectiveDeptId || absent.assignments?.departmentId);

        const sub = staffDirectory.find(s => s.email?.toLowerCase() === slotSubEmail[key].toLowerCase());
        if (!sub) continue;
        const isCrossDept = sub.assignments?.departmentId !== effectiveDeptId;
        const coverageMode: 'TEACHING' | 'SUPERVISION_ONLY' = isCrossDept ? 'SUPERVISION_ONLY' : 'TEACHING';

        let worksheetAttachmentUrl: string | undefined;
        let worksheetAttachmentName: string | undefined;
        const file = slotWorksheetFile[key];
        if (coverageMode === 'SUPERVISION_ONLY' && file && user?.uid) {
          const uploaded = await uploadSubstituteWorksheet(user.uid, file);
          worksheetAttachmentUrl = uploaded.url;
          worksheetAttachmentName = uploaded.name;
        }

        await proposeSubstituteAssignment({
          originalTeacherEmail: absent.email,
          originalTeacherName: `${absent.prefix || ''}${absent.firstName} ${absent.lastName}`.trim(),
          substituteTeacherEmail: sub.email,
          substituteTeacherName: `${sub.prefix || ''}${sub.firstName} ${sub.lastName}`.trim(),
          courseId: slot.id,
          courseCode: slot.code,
          courseName: slot.name,
          room: slot.room || slot.targetClass,
          periodName: slot.period === 0 ? 'คาบ 0 (โฮมรูม)' : `คาบ ${slot.period}`,
          schedule: scheduleStr,
          date: slot.date,
          departmentName: deptNameFinal,
          departmentId: deptIdFinal,
          triggerType,
          leaveReason: leaveReasonFinal,
          proposedByEmail: effectiveEmail,
          proposedByName: effectiveName,
          proposedByRole: effectiveRole,
          notes: notes.trim(),
          coverageMode,
          worksheetAttachmentUrl,
          worksheetAttachmentName,
        });
        successCount++;
      }
      setProposeOpen(false);
      resetProposeForm();
      showToast(
        'ส่งคำขอสำเร็จ',
        `บันทึก ${successCount} คาบ — รอครูสอนแทนกดยืนยันก่อนเข้าสู่ลำดับอนุมัติ 4 ขั้น`
      );
    } catch (err) {
      showToast('บันทึกไม่สำเร็จ', err instanceof Error ? err.message : String(err), true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRepropose = async (sa: SubstituteAssignment) => {
    setSubmitting(true);
    try {
      await proposeSubstituteAssignment({
        id: sa.id,
        originalTeacherEmail: sa.originalTeacherEmail,
        originalTeacherName: sa.originalTeacherName,
        substituteTeacherEmail: sa.substituteTeacherEmail,
        substituteTeacherName: sa.substituteTeacherName,
        courseId: sa.courseId,
        courseCode: sa.courseCode,
        courseName: sa.courseName,
        room: sa.room,
        periodName: sa.periodName,
        schedule: sa.schedule,
        date: sa.date,
        departmentName: sa.departmentName,
        departmentId: sa.departmentId,
        triggerType: sa.triggerType,
        leaveReason: sa.leaveReason,
        proposedByEmail: effectiveEmail,
        proposedByName: effectiveName,
        proposedByRole: effectiveRole,
        notes: sa.notes,
        coverageMode: sa.coverageMode,
        worksheetAttachmentUrl: sa.worksheetAttachmentUrl,
        worksheetAttachmentName: sa.worksheetAttachmentName,
      });
      showToast(
        'ส่งอนุมัติใหม่แล้ว',
        effectiveRole === 'HEAD_OF_DEPARTMENT'
          ? 'รายการถูกส่งกลับเข้าลำดับอนุมัติขั้นที่ 2 อีกครั้ง'
          : 'รายการถูกส่งกลับเข้าลำดับอนุมัติขั้นที่ 1 (หัวหน้ากลุ่มสาระฯ) อีกครั้ง'
      );
    } catch (err) {
      showToast('ไม่สำเร็จ', err instanceof Error ? err.message : String(err), true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecide = async () => {
    if (!decideTarget) return;
    if (decideMode === 'REJECT' && !decideComment.trim()) {
      showToast('ต้องระบุเหตุผล', 'การส่งกลับแก้ไขต้องมีข้อเสนอแนะ', true);
      return;
    }
    setSubmitting(true);
    try {
      await decideSubstituteApproval(
        decideTarget.id,
        decideMode,
        { email: effectiveEmail, name: effectiveName, role: effectiveRole },
        decideComment.trim()
      );
      setDecideTarget(null);
      setDecideComment('');
      showToast(
        decideMode === 'APPROVE' ? 'อนุมัติสำเร็จ' : 'ส่งกลับแก้ไขแล้ว',
        decideMode === 'APPROVE'
          ? 'รายการเดินหน้าไปยังขั้นอนุมัติถัดไป (หรืออนุมัติครบแล้ว)'
          : 'ส่งกลับไปยังหัวหน้ากลุ่มสาระฯ พร้อมข้อเสนอแนะ'
      );
    } catch (err) {
      showToast('ดำเนินการไม่สำเร็จ', err instanceof Error ? err.message : String(err), true);
    } finally {
      setSubmitting(false);
    }
  };

  // TASK 4 — ครูที่ถูกมอบหมาย (substituteTeacherEmail) กดยืนยัน/ปฏิเสธก่อนเข้า approval chain
  const handleConfirmResponse = async () => {
    if (!confirmTarget) return;
    if (confirmMode === 'DECLINE' && !confirmReason.trim()) {
      showToast('ต้องระบุเหตุผล', 'การปฏิเสธต้องระบุเหตุผลให้ครูผู้ขอทราบ', true);
      return;
    }
    setSubmitting(true);
    try {
      await respondToTeacherConfirmation(
        confirmTarget.id,
        confirmMode,
        { email: effectiveEmail, name: effectiveName },
        confirmReason.trim()
      );
      setConfirmTarget(null);
      setConfirmReason('');
      showToast(
        confirmMode === 'CONFIRM' ? 'ยืนยันสำเร็จ' : 'ปฏิเสธแล้ว',
        confirmMode === 'CONFIRM'
          ? 'รายการเข้าสู่ลำดับอนุมัติ 4 ขั้นแล้ว'
          : 'แจ้งครูผู้ขอให้เลือกครูสอนแทนคนใหม่แล้ว'
      );
    } catch (err) {
      showToast('ดำเนินการไม่สำเร็จ', err instanceof Error ? err.message : String(err), true);
    } finally {
      setSubmitting(false);
    }
  };

  // TASK 4 — ผู้เสนอเลือกครูสอนแทนคนใหม่ หลังคนเดิมกดปฏิเสธ (ไม่ใช่ resubmit คนเดิมซ้ำ)
  const handleReselect = async () => {
    if (!reselectTarget || !reselectEmail) return;
    const newSub = staffDirectory.find(s => s.email?.toLowerCase() === reselectEmail.toLowerCase());
    if (!newSub) return;
    setSubmitting(true);
    try {
      const isCrossDept = newSub.assignments?.departmentId !== reselectTarget.departmentId;
      await proposeSubstituteAssignment({
        id: reselectTarget.id,
        originalTeacherEmail: reselectTarget.originalTeacherEmail,
        originalTeacherName: reselectTarget.originalTeacherName,
        substituteTeacherEmail: newSub.email,
        substituteTeacherName: `${newSub.prefix || ''}${newSub.firstName} ${newSub.lastName}`.trim(),
        courseId: reselectTarget.courseId,
        courseCode: reselectTarget.courseCode,
        courseName: reselectTarget.courseName,
        room: reselectTarget.room,
        periodName: reselectTarget.periodName,
        schedule: reselectTarget.schedule,
        date: reselectTarget.date,
        departmentName: reselectTarget.departmentName,
        departmentId: reselectTarget.departmentId,
        triggerType: reselectTarget.triggerType,
        leaveReason: reselectTarget.leaveReason,
        proposedByEmail: effectiveEmail,
        proposedByName: effectiveName,
        proposedByRole: effectiveRole,
        notes: reselectTarget.notes,
        coverageMode: isCrossDept ? 'SUPERVISION_ONLY' : 'TEACHING',
        // ครูคนใหม่ยังไม่เคยยืนยัน — ไม่พกใบงานเดิมมา ถ้าเป็นครูข้ามกลุ่มสาระต้องแนบใหม่ที่หน้ารายการ
        worksheetAttachmentUrl: isCrossDept ? reselectTarget.worksheetAttachmentUrl : undefined,
        worksheetAttachmentName: isCrossDept ? reselectTarget.worksheetAttachmentName : undefined,
      });
      setReselectTarget(null);
      setReselectEmail('');
      showToast('เลือกครูสอนแทนคนใหม่แล้ว', 'ส่งรอครูสอนแทนคนใหม่กดยืนยันอีกครั้ง');
    } catch (err) {
      showToast('ไม่สำเร็จ', err instanceof Error ? err.message : String(err), true);
    } finally {
      setSubmitting(false);
    }
  };

  const openComplete = (sa: SubstituteAssignment) => {
    setCompleteTarget(sa);
    setCSummary(''); setCProblems(''); setCSolutions('');
    const init: Record<string, 'PRESENT' | 'ABSENT' | 'LATE' | 'LEAVE'> = {};
    students.filter(s => isSameRoom(s.room, sa.room)).forEach(s => { init[s.studentId] = 'PRESENT'; });
    setCAttendance(init);
  };

  const handleComplete = async () => {
    if (!completeTarget || !cSummary.trim()) {
      showToast('ต้องกรอกสรุปการสอน', 'กรุณากรอกสรุปเนื้อหาที่สอนแทนก่อนบันทึก', true);
      return;
    }
    setSubmitting(true);
    try {
      await completeSubstituteAssignment(completeTarget.id, {
        summary: cSummary.trim(),
        problems: cProblems.trim(),
        solutions: cSolutions.trim(),
        attendance: cAttendance,
      });
      const late = completeTarget.postTeachingDueAt
        ? Date.now() > new Date(completeTarget.postTeachingDueAt).getTime()
        : false;
      setCompleteTarget(null);
      showToast(
        'บันทึกหลังสอนแทนเรียบร้อย',
        late
          ? '⚠️ บันทึกหลังเวลา 24:00 น. ของวันที่สอน — ระบบ flag เป็น overdue'
          : 'บันทึกภายในกำหนด และส่งเข้ารายงานหลังสอนส่วนกลางแล้ว',
        late
      );
    } catch (err) {
      showToast('บันทึกไม่สำเร็จ', err instanceof Error ? err.message : String(err), true);
    } finally {
      setSubmitting(false);
    }
  };

  // -----------------------------------------------------------------------
  // Render helpers
  // -----------------------------------------------------------------------
  const StatusBadge = ({ sa }: { sa: SubstituteAssignment }) => {
    const map: Record<string, string> = {
      PENDING_TEACHER_CONFIRMATION: 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20',
      PENDING_ASSIGNMENT: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      PENDING_APPROVAL: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
      APPROVED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      REJECTED: 'bg-red-500/10 text-red-400 border-red-500/20',
    };
    const label: Record<string, string> = {
      PENDING_TEACHER_CONFIRMATION: 'รอครูสอนแทนยืนยัน',
      PENDING_ASSIGNMENT: 'รอจัดครู',
      PENDING_APPROVAL: sa.currentApprovalStage ? STAGE_LABEL_TH[sa.currentApprovalStage] : 'รออนุมัติ',
      APPROVED: sa.isCompleted ? 'บันทึกหลังสอนแล้ว' : 'อนุมัติครบ 4 ขั้น',
      REJECTED: sa.rejectedByRole === SUBSTITUTE_TEACHER_DECLINED_ROLE ? 'ครูสอนแทนปฏิเสธ' : 'ส่งกลับแก้ไข',
    };
    return (
      <span className={cn('px-2 py-1 rounded-full text-[10px] font-bold border shrink-0', map[sa.status || 'PENDING_APPROVAL'])}>
        {label[sa.status || 'PENDING_APPROVAL']}
      </span>
    );
  };

  const ApprovalChain = ({ sa }: { sa: SubstituteAssignment }) => (
    <div className="flex flex-wrap gap-1.5">
      {(sa.approvalChain || []).map((step) => (
        <span
          key={step.stage}
          title={step.comment || step.approverName || ''}
          className={cn(
            'px-2 py-0.5 rounded text-[9px] font-bold border flex items-center gap-1',
            step.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
            step.status === 'REJECTED' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
            'bg-slate-800/60 text-slate-400 border-slate-700'
          )}
        >
          {step.status === 'APPROVED' ? <Check className="w-2.5 h-2.5" /> :
           step.status === 'REJECTED' ? <XCircle className="w-2.5 h-2.5" /> :
           <Clock className="w-2.5 h-2.5" />}
          {STAGE_LABEL_TH[step.stage].replace(' · ', ' ')}
        </span>
      ))}
    </div>
  );

  const CourseInfo = ({ sa }: { sa: SubstituteAssignment }) => (
    <div className="bg-slate-950/40 rounded-xl p-3.5 border border-slate-800/80 space-y-2">
      <div className="flex justify-between items-center text-xs">
        <span className="text-white font-black">{sa.courseCode} {sa.courseName}</span>
        <span className="bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded font-mono text-[10px]">{sa.room}</span>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-slate-500" /> {sa.periodName} ({sa.schedule})</span>
        <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-slate-500" /> {sa.date}</span>
      </div>
      <div className="text-[11px] text-slate-400">
        <span className="text-slate-500">ครูที่ลา:</span> {sa.originalTeacherName} ·{' '}
        <span className="text-slate-500">ประเภท:</span> {TRIGGER_LABEL_TH[sa.triggerType || ''] || '-'}
        {sa.leaveReason ? <> · <span className="text-slate-500">เหตุผล:</span> {sa.leaveReason}</> : null}
      </div>
      <div className="text-[11px] text-slate-300 flex items-center gap-2 flex-wrap">
        <span><span className="text-slate-500">ครูสอนแทน:</span> <span className="font-bold text-white underline">{sa.substituteTeacherName}</span></span>
        {sa.coverageMode === 'SUPERVISION_ONLY' && (
          <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded text-[9px] font-bold">
            ควบคุมชั้นเรียนอย่างเดียว (ข้ามกลุ่มสาระ)
          </span>
        )}
      </div>
      {sa.worksheetAttachmentUrl ? (
        <a
          href={sa.worksheetAttachmentUrl} target="_blank" rel="noopener noreferrer"
          className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 underline underline-offset-2"
        >
          <Paperclip className="w-3.5 h-3.5" /> {sa.worksheetAttachmentName || 'ใบงาน/ใบความรู้/แบบทดสอบ'}
        </a>
      ) : null}
      {sa.notes ? (
        <div className="text-[11px] text-slate-400"><span className="text-slate-500 font-bold">งานมอบหมาย:</span> {sa.notes}</div>
      ) : null}
    </div>
  );

  const rejectedByLabel = (role?: string) =>
    role === SUBSTITUTE_TEACHER_DECLINED_ROLE ? 'ครูสอนแทน (ปฏิเสธการมอบหมาย)' : (ROLE_NAMES_TH[role || ''] || role || '-');

  const roleLabel = ROLE_NAMES_TH[effectiveRole] || effectiveRole;
  const canPropose = effectiveRole === 'HEAD_OF_DEPARTMENT';
  const isApprover = APPROVAL_ROLES.includes(effectiveRole);
  const isSubTeacher = canSelfPropose; // SUBJECT_TEACHER/HOMEROOM_TEACHER — เดิมชื่อ isSubTeacher, มีความหมายเดียวกับ canSelfPropose
  const isOversight = effectiveRole === 'SUPER_ADMIN' || effectiveRole === 'EXECUTIVE';

  // -----------------------------------------------------------------------
  return (
    <div className="w-full bg-[#0a0f18] min-h-screen text-slate-100 pb-12 font-sans">
      {/* TOAST */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={cn(
              'fixed top-24 right-6 z-50 max-w-md border-2 p-4 rounded-xl shadow-2xl backdrop-blur-md flex gap-3 items-start',
              toast.error ? 'bg-red-950/95 border-red-500/30 text-red-100' : 'bg-emerald-950/95 border-emerald-500/30 text-emerald-100'
            )}
          >
            <div className={cn('p-1 rounded-lg shrink-0', toast.error ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400')}>
              {toast.error ? <AlertCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
            </div>
            <div>
              <h4 className="text-sm font-bold">{toast.title}</h4>
              <p className="text-xs opacity-85 mt-1 leading-relaxed">{toast.message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER */}
      <div className="bg-slate-950/60 border-b border-slate-800 py-6 px-8 relative overflow-hidden">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wider flex items-center gap-1">
                <Layers className="w-3 h-3" /> SEQUENTIAL 4-STAGE APPROVAL
              </span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              ระบบจัดครูสอนแทน <span className="text-indigo-400 font-medium text-lg">| Substitute Teaching</span>
            </h1>
            <p className="text-xs text-slate-400">
              ลำดับอนุมัติ 4 ขั้น: หัวหน้ากลุ่มสาระฯ → หัวหน้าฝ่ายวิชาการและหลักสูตร → รองผู้อำนวยการฝ่ายวิชาการ → ผู้อำนวยการ
              · เชื่อม Firestore <span className="font-mono text-slate-500">substitute_assignments</span> แบบเรียลไทม์
            </p>
          </div>

          {(canPropose || canSelfPropose) && (
            <button
              onClick={() => {
                resetProposeForm();
                if (!canPropose && canSelfPropose) {
                  // ครูขอลากิจ/ไปราชการด้วยตนเอง — ล็อกชื่อครูที่ลาเป็นตัวเอง และจำกัดประเภทการลา (ไม่รวมลาป่วย)
                  setAbsentEmail(effectiveEmail);
                  setTriggerType('PERSONAL_LEAVE');
                }
                setProposeOpen(true);
              }}
              className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 shrink-0 border border-indigo-500/30"
            >
              <PlusCircle className="w-4 h-4" /> {canPropose ? 'แจ้งครูลา / จัดครูสอนแทน' : 'ขอลากิจ / ไปราชการ'}
            </button>
          )}
        </div>
      </div>

      {/* DEV SIMULATOR — gate ด้วย import.meta.env.DEV เท่านั้น */}
      {isDev && (
        <div className="max-w-7xl mx-auto px-6 mt-6">
          <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-extrabold uppercase tracking-wider">
              <ShieldAlert className="w-4 h-4" /> DEV SIMULATOR — ทดสอบ workflow (ไม่แสดงใน production)
            </div>
            <div className="flex flex-wrap gap-2">
              {SIM_ROLES.map(r => (
                <button
                  key={r.role}
                  onClick={() => setSimRole(r.role)}
                  className={cn(
                    'px-3 py-2 rounded-xl text-[11px] font-bold transition-all border',
                    simRole === r.role
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                      : 'bg-slate-950/40 text-slate-400 border-slate-800 hover:text-slate-200'
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span>สวมบทบาทเป็น (staff จริงจาก Firestore):</span>
              <select
                value={simEmail}
                onChange={e => setSimEmail(e.target.value)}
                className="bg-slate-950 text-slate-200 border border-amber-500/20 rounded-lg p-1 px-2 text-[11px] font-semibold outline-none max-w-xs"
              >
                <option value="">— ใช้บัญชีที่ล็อกอิน ({user?.email || 'ไม่ทราบ'}) —</option>
                {staffDirectory.map(s => (
                  <option key={s.id} value={s.email}>
                    {s.prefix}{s.firstName} {s.lastName} · {s.roles.join(',')} · {deptName(s.assignments?.departmentId)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ROLE BANNER */}
      <div className="max-w-7xl mx-auto px-6 mt-6">
        <div className="bg-slate-900/60 border border-slate-800/80 p-3 px-4 rounded-xl flex items-center gap-2 text-xs text-indigo-300">
          <Info className="w-4 h-4 text-indigo-400 shrink-0" />
          <span className="font-bold">บทบาทที่ใช้งาน: {roleLabel}</span>
          <span className="text-slate-500">· {effectiveName}</span>
          {effectiveDeptId && <span className="text-slate-500">· สังกัด {deptName(effectiveDeptId)}</span>}
        </div>
      </div>

      {staffDirectory.length === 0 && (
        <div className="max-w-7xl mx-auto px-6 mt-6">
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-8 text-center text-slate-400 text-sm">
            ยังไม่มีข้อมูลบุคลากรใน Firestore — กรุณานำเข้ารายชื่อครูที่หน้า "จัดการสิทธิ์และบทบาทหน้าที่บุคลากร" ก่อน
          </div>
        </div>
      )}

      {/* MAIN */}
      <div className="max-w-7xl mx-auto px-6 mt-8 grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-8">

          {/* TASK 4 — รายการรอให้ "ตัวเอง" กดยืนยัน/ปฏิเสธก่อนเข้า approval chain */}
          {canSelfPropose && myPendingConfirmations.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ThumbsUp className="w-5 h-5 text-fuchsia-400" /> คำขอรอการยืนยันจากท่าน
                <span className="bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20 px-2 py-0.5 rounded text-[10px] font-mono animate-pulse">
                  {myPendingConfirmations.length}
                </span>
              </h2>
              <div className="space-y-4">
                {myPendingConfirmations.map(sa => (
                  <div key={sa.id} className="bg-[#111622] border border-fuchsia-500/30 rounded-2xl p-5 space-y-3">
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">{sa.departmentName}</span>
                      <StatusBadge sa={sa} />
                    </div>
                    <CourseInfo sa={sa} />
                    <div className="flex gap-2 justify-end pt-2 border-t border-slate-800/50">
                      <button
                        onClick={() => { setConfirmTarget(sa); setConfirmMode('DECLINE'); setConfirmReason(''); }}
                        className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-[11px] font-bold rounded-lg flex items-center gap-1"
                      >
                        <ThumbsDown className="w-3.5 h-3.5" /> ปฏิเสธ
                      </button>
                      <button
                        onClick={() => { setConfirmTarget(sa); setConfirmMode('CONFIRM'); setConfirmReason(''); }}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black rounded-lg flex items-center gap-1"
                      >
                        <ThumbsUp className="w-3.5 h-3.5" /> ยืนยันรับทราบ
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* MY OWN REQUESTS — ครูที่ขอลากิจ/ไปราชการด้วยตนเอง ติดตามสถานะคำขอของตัวเอง */}
          {canSelfPropose && (
            <section className="space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-400" /> คำขอลากิจ/ไปราชการของฉัน
                <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded text-[10px] font-mono">{myOwnRequests.length}</span>
              </h2>
              {myOwnRequests.length === 0 ? (
                <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-12 text-center text-slate-500">
                  <AlertCircle className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-sm font-semibold">ยังไม่เคยยื่นคำขอลากิจ/ไปราชการ</p>
                  <p className="text-xs text-slate-600 mt-1">กดปุ่ม "ขอลากิจ / ไปราชการ" มุมบนขวาเพื่อเริ่ม</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {myOwnRequests.map(sa => (
                    <div key={sa.id} className="bg-[#111622] border border-slate-800 rounded-2xl p-5 space-y-3">
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">{sa.departmentName}</span>
                        <StatusBadge sa={sa} />
                      </div>
                      <CourseInfo sa={sa} />
                      <ApprovalChain sa={sa} />
                      {sa.status === 'REJECTED' && sa.rejectionReason && (
                        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3 text-xs text-red-400">
                          <div className="font-bold flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> ส่งกลับโดย {sa.rejectedByName} ({rejectedByLabel(sa.rejectedByRole)})</div>
                          <p className="italic text-[11px] mt-1">{sa.rejectionReason}</p>
                          {sa.rejectedByRole === SUBSTITUTE_TEACHER_DECLINED_ROLE ? (
                            <button
                              onClick={() => { setReselectTarget(sa); setReselectEmail(''); }}
                              disabled={submitting}
                              className="mt-2 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-[11px] font-bold rounded-lg flex items-center gap-1"
                            >
                              <Users className="w-3 h-3" /> เลือกครูสอนแทนคนใหม่
                            </button>
                          ) : (
                            <button
                              onClick={() => handleRepropose(sa)}
                              disabled={submitting}
                              className="mt-2 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-[11px] font-bold rounded-lg flex items-center gap-1"
                            >
                              <Send className="w-3 h-3" /> แก้ไขและเสนออนุมัติใหม่
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* HOD BOARD */}
          {canPropose && (
            <section className="space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-400" /> กระดานจัดครูสอนแทน — {deptName(effectiveDeptId)}
              </h2>
              {deptAssignments.length === 0 ? (
                <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-12 text-center text-slate-500">
                  <AlertCircle className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-sm font-semibold">ยังไม่มีรายการจัดครูสอนแทนในกลุ่มสาระฯ นี้</p>
                  <p className="text-xs text-slate-600 mt-1">กดปุ่ม "แจ้งครูลา / จัดครูสอนแทน" มุมบนขวาเพื่อเริ่ม</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {deptAssignments.map(sa => (
                    <div key={sa.id} className="bg-[#111622] border border-slate-800 rounded-2xl p-5 space-y-3">
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">{sa.departmentName}</span>
                        <StatusBadge sa={sa} />
                      </div>
                      <CourseInfo sa={sa} />
                      <ApprovalChain sa={sa} />
                      {sa.status === 'REJECTED' && sa.rejectionReason && (
                        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3 text-xs text-red-400">
                          <div className="font-bold flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> ส่งกลับโดย {sa.rejectedByName} ({rejectedByLabel(sa.rejectedByRole)})</div>
                          <p className="italic text-[11px] mt-1">{sa.rejectionReason}</p>
                          {sa.rejectedByRole === SUBSTITUTE_TEACHER_DECLINED_ROLE ? (
                            <button
                              onClick={() => { setReselectTarget(sa); setReselectEmail(''); }}
                              disabled={submitting}
                              className="mt-2 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-[11px] font-bold rounded-lg flex items-center gap-1"
                            >
                              <Users className="w-3 h-3" /> เลือกครูสอนแทนคนใหม่
                            </button>
                          ) : (
                            <button
                              onClick={() => handleRepropose(sa)}
                              disabled={submitting}
                              className="mt-2 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-[11px] font-bold rounded-lg flex items-center gap-1"
                            >
                              <Send className="w-3 h-3" /> แก้ไขและเสนออนุมัติใหม่
                            </button>
                          )}
                        </div>
                      )}
                      {sa.isCompleted && (
                        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 text-xs text-emerald-400">
                          <div className="font-bold flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" /> บันทึกหลังสอนแล้ว {sa.isLate ? '· ⚠️ overdue' : '· ตรงเวลา'}
                          </div>
                          <p className="text-[11px] text-slate-300 mt-1">{sa.completionSummary}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* APPROVAL QUEUE */}
          {isApprover && (
            <section className="space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-sky-400" /> คิวรออนุมัติของท่าน — {myApprovalStage ? STAGE_LABEL_TH[myApprovalStage] : ''}
                <span className="bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2 py-0.5 rounded text-[10px] font-mono">{approvalQueue.length}</span>
              </h2>
              {approvalQueue.length === 0 ? (
                <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-12 text-center text-slate-500">
                  <CheckCircle className="w-10 h-10 text-emerald-500/50 mx-auto mb-3" />
                  <p className="text-sm font-semibold">ไม่มีรายการรออนุมัติในขั้นของท่าน</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {approvalQueue.map(sa => (
                    <div key={sa.id} className="bg-[#111622] border border-sky-500/20 rounded-2xl p-5 space-y-3">
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">{sa.departmentName}</span>
                        <StatusBadge sa={sa} />
                      </div>
                      <CourseInfo sa={sa} />
                      <ApprovalChain sa={sa} />
                      <div className="flex gap-2 justify-end pt-2 border-t border-slate-800/50">
                        <button
                          onClick={() => { setDecideTarget(sa); setDecideMode('REJECT'); setDecideComment(''); }}
                          className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-[11px] font-bold rounded-lg"
                        >
                          ส่งกลับแก้ไข
                        </button>
                        <button
                          onClick={() => { setDecideTarget(sa); setDecideMode('APPROVE'); setDecideComment(''); }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black rounded-lg flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" /> อนุมัติขั้นนี้
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* SUBSTITUTE TEACHER */}
          {isSubTeacher && (
            <section className="space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-400" /> ภาระสอนแทนของท่าน (อนุมัติครบแล้ว)
              </h2>
              {mySubTasks.length === 0 ? (
                <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-12 text-center text-slate-500">
                  <CheckCircle className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-sm font-semibold">ยังไม่มีคาบสอนแทนที่อนุมัติครบ 4 ขั้นสำหรับท่าน</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {mySubTasks.map(sa => (
                    <div key={sa.id} className={cn('bg-[#111622] border rounded-2xl p-5 space-y-3', isOverdue(sa) ? 'border-red-500/40' : 'border-emerald-500/25')}>
                      <div className="flex justify-between items-start">
                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[9px] font-bold">คำสั่งผ่านการอนุมัติ 4 ขั้น</span>
                        {sa.isCompleted ? (
                          <span className="text-emerald-400 text-[10px] font-bold">✓ บันทึกแล้ว {sa.isLate ? '(overdue)' : ''}</span>
                        ) : (
                          <span className={cn('text-[10px] font-bold', isOverdue(sa) ? 'text-red-400' : 'text-amber-400')}>
                            {isOverdue(sa) ? '⚠️ เลยกำหนดบันทึก' : 'เส้นตาย 24:00 น.'} · {sa.date}
                          </span>
                        )}
                      </div>
                      <CourseInfo sa={sa} />
                      {sa.isCompleted ? (
                        <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3 text-[11px] text-slate-300">
                          <div className="font-bold text-emerald-400">บันทึกหลังสอน:</div>
                          <p className="italic mt-1">{sa.completionSummary}</p>
                        </div>
                      ) : (
                        <button
                          onClick={() => openComplete(sa)}
                          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs flex items-center justify-center gap-1"
                        >
                          <FileText className="w-4 h-4" /> เช็กชื่อ & บันทึกหลังสอนแทน
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* OVERSIGHT */}
          {isOversight && (
            <section className="space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-400" /> ภาพรวมการจัดครูสอนแทนทั้งโรงเรียน (อ่านอย่างเดียว)
              </h2>
              {substituteAssignments.length === 0 ? (
                <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 text-sm">ยังไม่มีรายการจัดครูสอนแทนในระบบ</div>
              ) : (
                <div className="space-y-3">
                  {substituteAssignments.slice().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).map(sa => (
                    <div key={sa.id} className="bg-[#111622] border border-slate-800 rounded-2xl p-4 space-y-2">
                      <div className="flex justify-between items-start">
                        <span className="text-[11px] text-slate-300 font-bold">{sa.courseCode} {sa.courseName} · {sa.room} · {sa.date}</span>
                        <StatusBadge sa={sa} />
                      </div>
                      <ApprovalChain sa={sa} />
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>

        {/* RIGHT COLUMN */}
        <aside className="space-y-6">
          <div className="bg-[#111622] border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-3">ภาพรวมสถิติ</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'รออนุมัติ', value: substituteAssignments.filter(s => s.status === 'PENDING_APPROVAL').length, color: 'text-sky-400' },
                { label: 'อนุมัติครบ', value: substituteAssignments.filter(s => s.status === 'APPROVED').length, color: 'text-emerald-400' },
                { label: 'ส่งกลับแก้ไข', value: substituteAssignments.filter(s => s.status === 'REJECTED').length, color: 'text-red-400' },
                { label: 'บันทึกหลังสอนแล้ว', value: substituteAssignments.filter(s => s.isCompleted).length, color: 'text-white' },
              ].map(k => (
                <div key={k.label} className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">{k.label}</span>
                  <span className={cn('text-2xl font-extrabold font-mono', k.color)}>{k.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#111622] border border-slate-800 rounded-2xl p-6 space-y-3 text-xs text-slate-400">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-3 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-indigo-400" /> ลำดับอนุมัติ (sequential)
            </h4>
            {(['STAGE_1_HEAD_OF_DEPARTMENT', 'STAGE_2_ACADEMIC_HEAD', 'STAGE_3_DEPUTY_DIRECTOR_ACADEMIC', 'STAGE_4_DIRECTOR'] as SubstituteApprovalStage[]).map((st, i) => (
              <div key={st} className="flex gap-2 items-start">
                <span className="w-5 h-5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold font-mono text-[10px] shrink-0">{i + 1}</span>
                <span className="text-[11px]">{STAGE_LABEL_TH[st].split(' · ')[1]}</span>
              </div>
            ))}
            <p className="text-[10px] text-slate-600 pt-2 border-t border-slate-800">แต่ละขั้นอนุมัติโดยคนละบุคคลตามลำดับ · ห้าม role/บุคคลเดียวข้ามหลายขั้น</p>
          </div>
        </aside>
      </div>

      {/* PROPOSE MODAL */}
      <AnimatePresence>
        {proposeOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#111622] border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 my-8"
            >
              <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-amber-400" /> {canPropose ? 'แจ้งครูลาและจัดครูสอนแทน' : 'ขอลากิจ / ไปราชการ (จัดครูสอนแทนด้วยตนเอง)'}
                </h3>
                <button onClick={() => setProposeOpen(false)} className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-400 hover:text-white">
                  <XCircle className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                {canPropose ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1.5">ครูที่ลา (ในกลุ่มสาระฯ ของท่าน)</label>
                    <select
                      value={absentEmail}
                      onChange={e => {
                        setAbsentEmail(e.target.value);
                        setSelectedSlotKeys(new Set()); setSlotSubEmail({}); setSlotWorksheetFile({});
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-amber-500 font-semibold"
                    >
                      <option value="">-- เลือกครูที่ลา --</option>
                      {deptTeachers.map(t => (
                        <option key={t.id} value={t.email}>{t.prefix}{t.firstName} {t.lastName} ({t.position})</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1.5">ครูที่ลา</label>
                    <div className="w-full bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-xs text-white font-semibold">
                      {effectiveName} <span className="text-slate-500 font-normal">({effectiveEmail})</span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1.5">ประเภทการลา</label>
                    <select
                      value={triggerType}
                      onChange={e => setTriggerType(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-amber-500 font-semibold"
                    >
                      {canPropose && <option value="SICK_LEAVE">ลาป่วย</option>}
                      <option value="PERSONAL_LEAVE">ลากิจ</option>
                      <option value="OFFICIAL_DUTY">ไปราชการ</option>
                    </select>
                  </div>
                  <div />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1.5">วันที่เริ่มลา</label>
                    <input
                      type="date" value={rangeStart}
                      onChange={e => {
                        setRangeStart(e.target.value);
                        if (rangeEnd < e.target.value) setRangeEnd(e.target.value);
                        setSelectedSlotKeys(new Set()); setSlotSubEmail({}); setSlotWorksheetFile({});
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1.5">วันที่สิ้นสุด (ลาหลายวันติดกันได้)</label>
                    <input
                      type="date" value={rangeEnd} min={rangeStart}
                      onChange={e => {
                        setRangeEnd(e.target.value);
                        setSelectedSlotKeys(new Set()); setSlotSubEmail({}); setSlotWorksheetFile({});
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">
                    เหตุผล {triggerType !== 'SICK_LEAVE' && <span className="text-red-500">*</span>}
                    {triggerType !== 'SICK_LEAVE' && <span className="text-slate-500 font-normal"> (ลากิจ/ราชการ ต้องแจ้งเหตุผล cross-ref ตารางสอน)</span>}
                  </label>
                  <input
                    type="text" value={leaveReason} onChange={e => setLeaveReason(e.target.value)}
                    placeholder={triggerType === 'SICK_LEAVE' ? 'เช่น ป่วยเป็นไข้หวัด (ไม่บังคับ)' : 'เช่น อบรมหลักสูตร สพฐ. ที่จังหวัด...'}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-amber-500 font-semibold placeholder:text-slate-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">
                    คาบสอนที่ต้องจัดแทน (ดึงจากตารางสอนจริงตลอดช่วงวันที่เลือก · เลือกได้บางคาบ ไม่บังคับทุกคาบ
                    {absentEmail ? ` · พบ ${rangeSlots.length} คาบ` : ''})
                  </label>
                  {!absentEmail ? (
                    <p className="text-[11px] text-slate-500">เลือกครูที่ลาก่อน</p>
                  ) : rangeSlots.length === 0 ? (
                    <p className="text-[10px] text-amber-400">ไม่พบคาบสอนของครูท่านนี้ในช่วงวันที่เลือก (ตรวจสอบ collection schedules)</p>
                  ) : (
                    <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                      {rangeSlots.map(slot => {
                        const key = slotKey(slot);
                        const checked = selectedSlotKeys.has(key);
                        const { tier1, tier2, tier3 } = getCandidatesForSlot(slot);
                        const chosenEmail = slotSubEmail[key] || '';
                        const chosenCandidate = [...tier1, ...tier2, ...tier3].find(c => c.email === chosenEmail);
                        const isCrossDept = chosenCandidate?.tier === 3;
                        return (
                          <div key={key} className={cn('border rounded-xl p-3', checked ? 'border-amber-500/40 bg-amber-500/5' : 'border-slate-800 bg-slate-950/40')}>
                            <label className="flex items-center gap-2 text-xs text-white font-semibold cursor-pointer">
                              <input
                                type="checkbox" checked={checked} className="accent-amber-500"
                                onChange={e => setSelectedSlotKeys(prev => {
                                  const next = new Set(prev);
                                  if (e.target.checked) next.add(key); else next.delete(key);
                                  return next;
                                })}
                              />
                              {THAI_DAY_ABBREV[slot.day]}{slot.period} · {slot.code} {slot.name} · {slot.room || slot.targetClass} · {slot.date}
                            </label>

                            {checked && (
                              <div className="mt-2 pl-6 space-y-2">
                                <select
                                  value={chosenEmail}
                                  onChange={e => setSlotSubEmail(prev => ({ ...prev, [key]: e.target.value }))}
                                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-[11px] text-white outline-none focus:border-amber-500"
                                >
                                  <option value="">-- เลือกครูสอนแทน --</option>
                                  {tier1.length > 0 && (
                                    <optgroup label="กลุ่มสาระเดียวกัน + ระดับเดียวกัน (แนะนำ)">
                                      {tier1.map(c => (
                                        <option key={c.email} value={c.email} disabled={!!c.conflict}>
                                          {c.name} {c.conflict ? `❌ ${c.conflict}` : '✓ ว่าง'}
                                        </option>
                                      ))}
                                    </optgroup>
                                  )}
                                  {tier2.length > 0 && (
                                    <optgroup label="กลุ่มสาระเดียวกัน (ระดับอื่น)">
                                      {tier2.map(c => (
                                        <option key={c.email} value={c.email} disabled={!!c.conflict}>
                                          {c.name} {c.conflict ? `❌ ${c.conflict}` : '✓ ว่าง'}
                                        </option>
                                      ))}
                                    </optgroup>
                                  )}
                                  {tier3.length > 0 && (
                                    <optgroup label="⚠️ ข้ามกลุ่มสาระ (สุดวิสัย — ควบคุมชั้นเรียนอย่างเดียว)">
                                      {tier3.map(c => (
                                        <option key={c.email} value={c.email} disabled={!!c.conflict}>
                                          {c.name} {c.conflict ? `❌ ${c.conflict}` : '✓ ว่าง'}
                                        </option>
                                      ))}
                                    </optgroup>
                                  )}
                                </select>

                                {isCrossDept && (
                                  <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-2.5 space-y-1.5">
                                    <p className="text-[10px] text-amber-400 font-bold flex items-center gap-1">
                                      <AlertCircle className="w-3 h-3 shrink-0" /> ครูข้ามกลุ่มสาระ — ควบคุมชั้นเรียนอย่างเดียว ต้องแนบใบงาน/ใบความรู้/แบบทดสอบก่อนส่งคำขอ
                                    </p>
                                    <label className="flex items-center gap-2 text-[10px] text-slate-300 cursor-pointer bg-slate-950 border border-slate-800 rounded-lg p-2 hover:border-amber-500/40">
                                      <Upload className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                      {slotWorksheetFile[key]?.name || 'แนบไฟล์ใบงาน (PDF/Word/รูปภาพ) — ไม่เกิน 10MB'}
                                      <input
                                        type="file" accept=".pdf,.doc,.docx,image/*" className="hidden"
                                        onChange={e => setSlotWorksheetFile(prev => ({ ...prev, [key]: e.target.files?.[0] || null }))}
                                      />
                                    </label>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">งานมอบหมาย / หมายเหตุถึงครูสอนแทน</label>
                  <textarea
                    rows={2} value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder="ระบุใบงาน แผนการสอน หรือแนวทางควบคุมชั้นเรียน..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-amber-500 font-semibold placeholder:text-slate-600"
                  />
                </div>
              </div>

              <div className="flex gap-2.5 justify-end pt-3 border-t border-slate-800/50">
                <button onClick={() => setProposeOpen(false)} className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-semibold text-slate-400">ยกเลิก</button>
                <button
                  onClick={handlePropose}
                  disabled={submitting || !absentEmail || selectedSlotKeys.size === 0}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" /> {submitting ? 'กำลังบันทึก...' : `ส่งคำขอ (${selectedSlotKeys.size} คาบ)`}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DECIDE MODAL */}
      <AnimatePresence>
        {decideTarget && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#111622] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4"
            >
              <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                {decideMode === 'APPROVE' ? <Check className="w-5 h-5 text-emerald-400" /> : <XCircle className="w-5 h-5 text-red-400" />}
                {decideMode === 'APPROVE' ? 'อนุมัติ' : 'ส่งกลับแก้ไข'} — {decideTarget.currentApprovalStage ? STAGE_LABEL_TH[decideTarget.currentApprovalStage] : ''}
              </h3>
              <div className="text-xs text-slate-300 bg-slate-950/40 rounded-xl p-3 border border-slate-800/80">
                {decideTarget.courseCode} {decideTarget.courseName} · {decideTarget.room} · {decideTarget.date}<br />
                ครูสอนแทน: <span className="font-bold text-white">{decideTarget.substituteTeacherName}</span> · แทน {decideTarget.originalTeacherName}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">
                  {decideMode === 'APPROVE' ? 'ความเห็นประกอบ (ไม่บังคับ)' : 'เหตุผล / ข้อเสนอแนะ'} {decideMode === 'REJECT' && <span className="text-red-500">*</span>}
                </label>
                <textarea
                  rows={3} value={decideComment} onChange={e => setDecideComment(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-indigo-500 font-semibold"
                />
              </div>
              <div className="flex gap-2.5 justify-end">
                <button onClick={() => setDecideTarget(null)} className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-slate-400">ยกเลิก</button>
                <button
                  onClick={handleDecide} disabled={submitting}
                  className={cn(
                    'px-5 py-2 text-white rounded-xl text-xs font-extrabold disabled:opacity-50 flex items-center gap-1.5',
                    decideMode === 'APPROVE' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'
                  )}
                >
                  {submitting ? 'กำลังบันทึก...' : decideMode === 'APPROVE' ? 'ยืนยันอนุมัติ' : 'ยืนยันส่งกลับ'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CONFIRM MODAL — TASK 4: ครูที่ถูกมอบหมายยืนยัน/ปฏิเสธก่อนเข้า approval chain */}
      <AnimatePresence>
        {confirmTarget && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#111622] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4"
            >
              <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                {confirmMode === 'CONFIRM' ? <ThumbsUp className="w-5 h-5 text-emerald-400" /> : <ThumbsDown className="w-5 h-5 text-red-400" />}
                {confirmMode === 'CONFIRM' ? 'ยืนยันรับทราบ' : 'ปฏิเสธการมอบหมาย'}
              </h3>
              <div className="text-xs text-slate-300 bg-slate-950/40 rounded-xl p-3 border border-slate-800/80">
                {confirmTarget.courseCode} {confirmTarget.courseName} · {confirmTarget.room} · {confirmTarget.periodName} ({confirmTarget.schedule}) · {confirmTarget.date}<br />
                แทนคุณครู: <span className="font-bold text-white">{confirmTarget.originalTeacherName}</span>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">
                  {confirmMode === 'CONFIRM' ? 'หมายเหตุ (ไม่บังคับ)' : 'เหตุผลที่ไม่สะดวก'} {confirmMode === 'DECLINE' && <span className="text-red-500">*</span>}
                </label>
                <textarea
                  rows={3} value={confirmReason} onChange={e => setConfirmReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-indigo-500 font-semibold"
                />
              </div>
              <div className="flex gap-2.5 justify-end">
                <button onClick={() => setConfirmTarget(null)} className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-slate-400">ยกเลิก</button>
                <button
                  onClick={handleConfirmResponse} disabled={submitting}
                  className={cn(
                    'px-5 py-2 text-white rounded-xl text-xs font-extrabold disabled:opacity-50 flex items-center gap-1.5',
                    confirmMode === 'CONFIRM' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'
                  )}
                >
                  {submitting ? 'กำลังบันทึก...' : confirmMode === 'CONFIRM' ? 'ยืนยันรับทราบ' : 'ยืนยันการปฏิเสธ'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* RESELECT SUBSTITUTE MODAL — TASK 4: เลือกครูสอนแทนคนใหม่ หลังคนเดิมกดปฏิเสธ */}
      <AnimatePresence>
        {reselectTarget && (() => {
          const originalSchedule = schedules.find(s => s.id === reselectTarget.courseId);
          const candidates = originalSchedule
            ? getCandidatesForSlot(
                { ...originalSchedule, date: reselectTarget.date },
                { absentEmailOverride: reselectTarget.originalTeacherEmail, deptIdOverride: reselectTarget.departmentId }
              )
            : { tier1: [], tier2: [], tier3: [] };
          return (
            <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                className="bg-[#111622] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4"
              >
                <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Users className="w-5 h-5 text-amber-400" /> เลือกครูสอนแทนคนใหม่
                </h3>
                <div className="text-xs text-slate-300 bg-slate-950/40 rounded-xl p-3 border border-slate-800/80">
                  {reselectTarget.courseCode} {reselectTarget.courseName} · {reselectTarget.room} · {reselectTarget.periodName} ({reselectTarget.schedule}) · {reselectTarget.date}<br />
                  <span className="text-red-400">{reselectTarget.substituteTeacherName} ปฏิเสธการมอบหมายแล้ว</span>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">ครูสอนแทนคนใหม่</label>
                  <select
                    value={reselectEmail} onChange={e => setReselectEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-amber-500 font-semibold"
                  >
                    <option value="">-- เลือกครูสอนแทน --</option>
                    {candidates.tier1.length > 0 && (
                      <optgroup label="กลุ่มสาระเดียวกัน + ระดับเดียวกัน (แนะนำ)">
                        {candidates.tier1.map(c => (
                          <option key={c.email} value={c.email} disabled={!!c.conflict}>{c.name} {c.conflict ? `❌ ${c.conflict}` : '✓ ว่าง'}</option>
                        ))}
                      </optgroup>
                    )}
                    {candidates.tier2.length > 0 && (
                      <optgroup label="กลุ่มสาระเดียวกัน (ระดับอื่น)">
                        {candidates.tier2.map(c => (
                          <option key={c.email} value={c.email} disabled={!!c.conflict}>{c.name} {c.conflict ? `❌ ${c.conflict}` : '✓ ว่าง'}</option>
                        ))}
                      </optgroup>
                    )}
                    {candidates.tier3.length > 0 && (
                      <optgroup label="⚠️ ข้ามกลุ่มสาระ (ควบคุมชั้นเรียนอย่างเดียว)">
                        {candidates.tier3.map(c => (
                          <option key={c.email} value={c.email} disabled={!!c.conflict}>{c.name} {c.conflict ? `❌ ${c.conflict}` : '✓ ว่าง'}</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  {!originalSchedule && (
                    <p className="text-[10px] text-amber-400 mt-1">ไม่พบตารางสอนต้นฉบับของคาบนี้ — กรุณาติดต่อผู้ดูแลระบบ</p>
                  )}
                </div>
                <div className="flex gap-2.5 justify-end">
                  <button onClick={() => setReselectTarget(null)} className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-slate-400">ยกเลิก</button>
                  <button
                    onClick={handleReselect} disabled={submitting || !reselectEmail}
                    className="px-5 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" /> {submitting ? 'กำลังบันทึก...' : 'ส่งรอครูคนใหม่ยืนยัน'}
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* COMPLETE MODAL */}
      <AnimatePresence>
        {completeTarget && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#111622] border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 my-8 max-h-[90vh] flex flex-col"
            >
              <div className="flex justify-between items-start border-b border-slate-800 pb-3 shrink-0">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-400" /> บันทึกหลังสอนแทน · {completeTarget.courseCode} · {completeTarget.room}
                </h3>
                <button onClick={() => setCompleteTarget(null)} className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-400 hover:text-white">
                  <XCircle className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 space-y-5">
                {completeTarget.postTeachingDueAt && (
                  <div className={cn(
                    'text-[11px] rounded-lg p-2.5 border flex items-center gap-2',
                    Date.now() > new Date(completeTarget.postTeachingDueAt).getTime()
                      ? 'bg-red-500/10 border-red-500/20 text-red-400'
                      : 'bg-slate-950/40 border-slate-800 text-slate-400'
                  )}>
                    <Clock className="w-3.5 h-3.5" />
                    เส้นตายบันทึกหลังสอน: ก่อน 24:00 น. ของวันที่ {completeTarget.date}
                    {Date.now() > new Date(completeTarget.postTeachingDueAt).getTime() && ' — เลยกำหนดแล้ว จะถูก flag เป็น overdue'}
                  </div>
                )}

                {students.filter(s => isSameRoom(s.room, completeTarget.room)).length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">เช็กชื่อนักเรียน</h4>
                    <div className="bg-slate-950/80 border border-slate-800 rounded-xl max-h-[220px] overflow-y-auto divide-y divide-slate-800/40">
                      {students.filter(s => isSameRoom(s.room, completeTarget.room)).map(st => {
                        const cur = cAttendance[st.studentId] || 'PRESENT';
                        return (
                          <div key={st.id} className="flex items-center justify-between px-3 py-2 text-xs">
                            <span className="text-white font-semibold">{st.studentNo}. {st.fullName || st.name}</span>
                            <div className="inline-flex rounded-lg overflow-hidden border border-slate-800">
                              {(['PRESENT', 'ABSENT', 'LATE', 'LEAVE'] as const).map(v => (
                                <button
                                  key={v}
                                  onClick={() => setCAttendance(p => ({ ...p, [st.studentId]: v }))}
                                  className={cn(
                                    'px-2 py-1 text-[10px] font-extrabold',
                                    cur === v
                                      ? v === 'PRESENT' ? 'bg-emerald-500 text-white'
                                        : v === 'ABSENT' ? 'bg-red-500 text-white'
                                        : v === 'LATE' ? 'bg-amber-500 text-white'
                                        : 'bg-sky-500 text-white'
                                      : 'bg-slate-950 text-slate-400'
                                  )}
                                >
                                  {v === 'PRESENT' ? 'มา' : v === 'ABSENT' ? 'ขาด' : v === 'LATE' ? 'สาย' : 'ลา'}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">สรุปเนื้อหาที่สอนแทน <span className="text-red-500">*</span></label>
                    <textarea rows={2} value={cSummary} onChange={e => setCSummary(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-emerald-500 font-semibold" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">ปัญหา/อุปสรรค</label>
                      <textarea rows={2} value={cProblems} onChange={e => setCProblems(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-emerald-500 font-semibold" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">แนวทางแก้ไข/ข้อแนะนำ</label>
                      <textarea rows={2} value={cSolutions} onChange={e => setCSolutions(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-emerald-500 font-semibold" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2.5 justify-end pt-3 border-t border-slate-800/50 shrink-0">
                <button onClick={() => setCompleteTarget(null)} className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-slate-400">ย้อนกลับ</button>
                <button
                  onClick={handleComplete} disabled={submitting || !cSummary.trim()}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-black flex items-center gap-1.5"
                >
                  <CheckCircle className="w-3.5 h-3.5" /> {submitting ? 'กำลังบันทึก...' : 'ส่งรายงานหลังสอนแทน'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
