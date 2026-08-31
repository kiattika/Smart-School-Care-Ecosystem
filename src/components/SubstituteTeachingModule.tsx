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
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useStore } from '../store';
import { cn, isSameRoom } from '../lib/utils';
import { UserRole, SubstituteAssignment, SubstituteApprovalStage, SUBSTITUTE_STAGE_ROLE } from '../types';
import { DEPARTMENTS, ROLE_NAMES_TH } from './StaffRoleManagementPage';

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
  { role: 'HEAD_OF_DEPARTMENT', label: 'หัวหน้ากลุ่มสาระฯ — เสนอจัดครูสอนแทน' },
  { role: 'ACADEMIC_HEAD', label: 'หัวหน้าฝ่ายวิชาการฯ — อนุมัติขั้น 2' },
  { role: 'DEPUTY_DIRECTOR_ACADEMIC', label: 'รองผู้อำนวยการฝ่ายวิชาการ — อนุมัติขั้น 3' },
  { role: 'DIRECTOR', label: 'ผู้อำนวยการ — อนุมัติขั้น 4' },
  { role: 'SUBJECT_TEACHER', label: 'ครูผู้รับมอบหมายสอนแทน — บันทึกหลังสอน' },
];

const APPROVAL_ROLES: UserRole[] = ['ACADEMIC_HEAD', 'DEPUTY_DIRECTOR_ACADEMIC', 'DIRECTOR'];

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
  const decideSubstituteApproval = useStore(s => s.decideSubstituteApproval);
  const completeSubstituteAssignment = useStore(s => s.completeSubstituteAssignment);

  const isDev = import.meta.env.DEV;

  // บทบาทของผู้ใช้จริงถ้าอยู่ในลำดับ workflow สอนแทน — ใช้เป็นค่าเริ่มต้นของ persona
  const SUB_WORKFLOW_ROLES: UserRole[] = ['HEAD_OF_DEPARTMENT', 'ACADEMIC_HEAD', 'DEPUTY_DIRECTOR_ACADEMIC', 'DIRECTOR', 'SUBJECT_TEACHER'];
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

  const deptName = (id?: string) => DEPARTMENTS.find(d => d.id === id)?.name || 'ไม่ได้ระบุกลุ่มสาระฯ';

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
  const [absenceDate, setAbsenceDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedScheduleId, setSelectedScheduleId] = useState('');
  const [subEmail, setSubEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // --- decide modal ---
  const [decideTarget, setDecideTarget] = useState<SubstituteAssignment | null>(null);
  const [decideMode, setDecideMode] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [decideComment, setDecideComment] = useState('');

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
    const deptId = isDev ? (effectiveDeptId || DEPARTMENTS[0]?.id) : effectiveDeptId;
    return staffDirectory.filter(s => s.assignments?.departmentId === deptId);
  }, [staffDirectory, effectiveDeptId, isDev]);

  const absentTeacherSchedules = useMemo(() => {
    if (!absentEmail) return [];
    const dayNum = jsDateToThaiDayNum(absenceDate);
    return schedules
      .filter(s => s.emails.includes(absentEmail.toLowerCase()) && s.day === dayNum && s.period >= 0)
      .sort((a, b) => a.period - b.period);
  }, [schedules, absentEmail, absenceDate]);

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

  // งานในกลุ่มสาระฯ ของ HOD (ดูจากกลุ่มสาระของครูที่ขาด หรือ departmentId ที่บันทึกไว้)
  const deptAssignments = useMemo(() => {
    const deptId = isDev ? (effectiveDeptId || DEPARTMENTS[0]?.id) : effectiveDeptId;
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

  const isOverdue = (sa: SubstituteAssignment) =>
    !sa.isCompleted && sa.postTeachingDueAt ? Date.now() > new Date(sa.postTeachingDueAt).getTime() : false;

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------
  const resetProposeForm = () => {
    setAbsentEmail(''); setTriggerType('SICK_LEAVE'); setLeaveReason('');
    setAbsenceDate(new Date().toISOString().split('T')[0]);
    setSelectedScheduleId(''); setSubEmail(''); setNotes('');
  };

  const handlePropose = async () => {
    const sched = absentTeacherSchedules.find(s => s.id === selectedScheduleId);
    const absent = staffDirectory.find(s => s.email?.toLowerCase() === absentEmail.toLowerCase());
    const sub = staffDirectory.find(s => s.email?.toLowerCase() === subEmail.toLowerCase());
    if (!sched || !absent || !sub) {
      showToast('ข้อมูลไม่ครบ', 'กรุณาเลือกครูที่ลา คาบสอน และครูผู้สอนแทนให้ครบถ้วน', true);
      return;
    }
    if ((triggerType === 'PERSONAL_LEAVE' || triggerType === 'OFFICIAL_DUTY') && !leaveReason.trim()) {
      showToast('ต้องระบุเหตุผล', 'การลากิจ/ไปราชการ ต้องแจ้งเหตุผลประกอบ', true);
      return;
    }
    const scheduleStr = `${THAI_DAY_ABBREV[sched.day] || ''}${sched.period}`;

    setSubmitting(true);
    try {
      await proposeSubstituteAssignment({
        originalTeacherEmail: absent.email,
        originalTeacherName: `${absent.prefix || ''}${absent.firstName} ${absent.lastName}`.trim(),
        substituteTeacherEmail: sub.email,
        substituteTeacherName: `${sub.prefix || ''}${sub.firstName} ${sub.lastName}`.trim(),
        courseId: sched.id,
        courseCode: sched.code,
        courseName: sched.name,
        room: sched.room || sched.targetClass,
        periodName: sched.period === 0 ? 'คาบ 0 (โฮมรูม)' : `คาบ ${sched.period}`,
        schedule: scheduleStr,
        date: absenceDate,
        departmentName: deptName(effectiveDeptId || absent.assignments?.departmentId),
        departmentId: effectiveDeptId || absent.assignments?.departmentId || '',
        triggerType,
        leaveReason: leaveReason.trim() || (triggerType === 'SICK_LEAVE' ? 'ลาป่วย' : ''),
        proposedByEmail: effectiveEmail,
        proposedByName: effectiveName,
        proposedByRole: 'HEAD_OF_DEPARTMENT',
        notes: notes.trim(),
      });
      setProposeOpen(false);
      resetProposeForm();
      showToast('เสนอจัดครูสอนแทนสำเร็จ', 'ส่งเข้าลำดับอนุมัติ ขั้นที่ 2 (หัวหน้าฝ่ายวิชาการและหลักสูตร) แล้ว');
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
        proposedByRole: 'HEAD_OF_DEPARTMENT',
        notes: sa.notes,
      });
      showToast('ส่งอนุมัติใหม่แล้ว', 'รายการถูกส่งกลับเข้าลำดับอนุมัติขั้นที่ 2 อีกครั้ง');
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
      PENDING_ASSIGNMENT: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      PENDING_APPROVAL: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
      APPROVED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      REJECTED: 'bg-red-500/10 text-red-400 border-red-500/20',
    };
    const label: Record<string, string> = {
      PENDING_ASSIGNMENT: 'รอจัดครู',
      PENDING_APPROVAL: sa.currentApprovalStage ? STAGE_LABEL_TH[sa.currentApprovalStage] : 'รออนุมัติ',
      APPROVED: sa.isCompleted ? 'บันทึกหลังสอนแล้ว' : 'อนุมัติครบ 4 ขั้น',
      REJECTED: 'ส่งกลับแก้ไข',
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
      <div className="text-[11px] text-slate-300">
        <span className="text-slate-500">ครูสอนแทน:</span> <span className="font-bold text-white underline">{sa.substituteTeacherName}</span>
      </div>
      {sa.notes ? (
        <div className="text-[11px] text-slate-400"><span className="text-slate-500 font-bold">งานมอบหมาย:</span> {sa.notes}</div>
      ) : null}
    </div>
  );

  const roleLabel = ROLE_NAMES_TH[effectiveRole] || effectiveRole;
  const canPropose = effectiveRole === 'HEAD_OF_DEPARTMENT';
  const isApprover = APPROVAL_ROLES.includes(effectiveRole);
  const isSubTeacher = effectiveRole === 'SUBJECT_TEACHER' || effectiveRole === 'HOMEROOM_TEACHER';
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

          {canPropose && (
            <button
              onClick={() => { resetProposeForm(); setProposeOpen(true); }}
              className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 shrink-0 border border-indigo-500/30"
            >
              <PlusCircle className="w-4 h-4" /> แจ้งครูลา / จัดครูสอนแทน
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

          {/* HOD BOARD */}
          {canPropose && (
            <section className="space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-400" /> กระดานจัดครูสอนแทน — {deptName(effectiveDeptId || DEPARTMENTS[0]?.id)}
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
                          <div className="font-bold flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> ส่งกลับโดย {sa.rejectedByName} ({sa.rejectedByRole})</div>
                          <p className="italic text-[11px] mt-1">{sa.rejectionReason}</p>
                          <button
                            onClick={() => handleRepropose(sa)}
                            disabled={submitting}
                            className="mt-2 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-[11px] font-bold rounded-lg flex items-center gap-1"
                          >
                            <Send className="w-3 h-3" /> แก้ไขและเสนออนุมัติใหม่
                          </button>
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
              className="bg-[#111622] border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 my-8"
            >
              <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-amber-400" /> แจ้งครูลาและจัดครูสอนแทน
                </h3>
                <button onClick={() => setProposeOpen(false)} className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-400 hover:text-white">
                  <XCircle className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">ครูที่ลา (ในกลุ่มสาระฯ ของท่าน)</label>
                  <select
                    value={absentEmail}
                    onChange={e => { setAbsentEmail(e.target.value); setSelectedScheduleId(''); setSubEmail(''); }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-amber-500 font-semibold"
                  >
                    <option value="">-- เลือกครูที่ลา --</option>
                    {deptTeachers.map(t => (
                      <option key={t.id} value={t.email}>{t.prefix}{t.firstName} {t.lastName} ({t.position})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1.5">ประเภทการลา</label>
                    <select
                      value={triggerType}
                      onChange={e => setTriggerType(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-amber-500 font-semibold"
                    >
                      <option value="SICK_LEAVE">ลาป่วย</option>
                      <option value="PERSONAL_LEAVE">ลากิจ</option>
                      <option value="OFFICIAL_DUTY">ไปราชการ</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1.5">วันที่ลา</label>
                    <input
                      type="date" value={absenceDate}
                      onChange={e => { setAbsenceDate(e.target.value); setSelectedScheduleId(''); }}
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
                    คาบสอนที่ต้องจัดแทน (ดึงจากตารางสอนจริงของครู · {absentEmail ? `${absentTeacherSchedules.length} คาบในวันนี้` : 'เลือกครูก่อน'})
                  </label>
                  <select
                    value={selectedScheduleId} onChange={e => { setSelectedScheduleId(e.target.value); setSubEmail(''); }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-amber-500 font-semibold"
                  >
                    <option value="">-- เลือกคาบสอน --</option>
                    {absentTeacherSchedules.map(s => (
                      <option key={s.id} value={s.id}>
                        {THAI_DAY_ABBREV[s.day]}{s.period} · {s.code} {s.name} · {s.room || s.targetClass}
                      </option>
                    ))}
                  </select>
                  {absentEmail && absentTeacherSchedules.length === 0 && (
                    <p className="text-[10px] text-amber-400 mt-1">ไม่พบคาบสอนของครูท่านนี้ในวันที่เลือก (ตรวจสอบ collection schedules)</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">ครูผู้สอนแทน (กลุ่มสาระฯ เดียวกัน · ตรวจตารางชนแล้ว)</label>
                  <select
                    value={subEmail} onChange={e => setSubEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-amber-500 font-semibold"
                  >
                    <option value="">-- เลือกครูผู้สอนแทน --</option>
                    {deptTeachers
                      .filter(t => t.email?.toLowerCase() !== absentEmail.toLowerCase())
                      .map(t => {
                        const sched = absentTeacherSchedules.find(s => s.id === selectedScheduleId);
                        const conflict = checkCandidateConflict(t.email, sched, absenceDate);
                        return (
                          <option key={t.id} value={t.email} disabled={!!conflict}>
                            {t.prefix}{t.firstName} {t.lastName} {conflict ? `❌ ${conflict}` : '✓ ว่าง'}
                          </option>
                        );
                      })}
                  </select>
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
                  disabled={submitting || !absentEmail || !selectedScheduleId || !subEmail}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" /> {submitting ? 'กำลังบันทึก...' : 'เสนอเข้าลำดับอนุมัติ'}
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
