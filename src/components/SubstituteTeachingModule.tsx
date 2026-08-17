import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserCheck, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Calendar, 
  FileText, 
  PlusCircle, 
  Send, 
  ShieldAlert, 
  Sparkles, 
  Trash2, 
  ChevronRight, 
  Award, 
  Search, 
  BookOpen, 
  Clock, 
  Check, 
  Info,
  Layers,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store';
import { cn, isSameRoom } from '../lib/utils';

// --- Types & Schema ---
export type SubstituteStatus = 'PENDING_ASSIGNMENT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

export interface SubstituteTask {
  id: string;
  originalTeacherName: string;
  originalTeacherEmail: string;
  departmentName: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  room: string;
  schedule: string;       // e.g., "จ2", "อ4", "พุ1"
  periodName: string;     // e.g., "คาบ 2 (09:10 - 10:00 น.)"
  date: string;           // e.g., "2026-07-21"
  status: SubstituteStatus;
  substituteTeacherEmail?: string;
  substituteTeacherName?: string;
  notes?: string;
  rejectionReason?: string;
  isCompleted?: boolean;
  completionSummary?: string;
  completionProblems?: string;
  completionSolutions?: string;
  completionAttendance?: Record<string, 'PRESENT' | 'ABSENT' | 'LATE' | 'LEAVE'>;
  completedAt?: string;
}

// All teachers metadata for department mappings
const ALL_TEACHERS = [
  { name: 'นาย เกียรติศักดิ์ ศรีวิไล', email: 'kiattisak@utd.ac.th', dept: 'กลุ่มสาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี', position: 'ครู คศ.3 (วิทยฐานะชำนาญการพิเศษ)' },
  { name: 'คุณครู วิภาดา รักเรียน', email: 'wipada.r@school.ac.th', dept: 'กลุ่มสาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี', position: 'ครู คศ.2 (วิทยฐานะชำนาญการ)' },
  { name: 'คุณครู สมใจ รักสอน', email: 'somjai@utd.ac.th', dept: 'กลุ่มสาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี', position: 'ครู คศ.1' },
  { name: 'คุณครู มานะ บากบั่น', email: 'mana@utd.ac.th', dept: 'กลุ่มสาระการเรียนรู้คณิตศาสตร์', position: 'ครู คศ.2' },
  { name: 'นาย ก (ครูภาษาไทย)', email: 'teacher@utd.ac.th', dept: 'กลุ่มสาระการเรียนรู้ภาษาไทย', position: 'ครู คศ.1' },
  { name: 'คุณครู วีณา รื่นรมย์', email: 'weena@utd.ac.th', dept: 'กลุ่มสาระการเรียนรู้ศิลปะ', position: 'ครู คศ.2' }
];

const getTeacherDepartment = (email: string) => {
  const t = ALL_TEACHERS.find(x => x.email === email);
  return t ? t.dept : 'กลุ่มสาระการเรียนรู้ทั่วไป';
};

export function SubstituteTeachingModule() {
  const { 
    globalCourses, 
    courses, 
    students, 
    currentDate,
    assignSubstituteTeacher, 
    substituteAssignments,
    submitPostTeachingRecord
  } = useStore();

  // Active Role Simulator State
  // HEAD_OF_DEPARTMENT: organizes/proposes within their dept.
  // ACADEMIC_ASSISTANT_DIRECTOR: approves proposed substitions.
  // SUBSTITUTE_TEACHER: views assigned substitution classes & marks attendance / teaching logs.
  const [simulatorRole, setSimulatorRole] = useState<'HEAD_OF_DEPARTMENT' | 'ACADEMIC_ASSISTANT_DIRECTOR' | 'SUBSTITUTE_TEACHER'>('HEAD_OF_DEPARTMENT');
  const [selectedDeptTeacherEmail, setSelectedDeptTeacherEmail] = useState<string>('wipada.r@school.ac.th'); // simulator active user for HOD
  const [selectedSubTeacherEmail, setSelectedSubTeacherEmail] = useState<string>('kiattisak@utd.ac.th'); // simulator active user for Teacher

  // Core substitute tasks list
  const [tasks, setTasks] = useState<SubstituteTask[]>([]);
  
  // Modals / Selection states
  const [activeTaskForAssign, setActiveTaskForAssign] = useState<SubstituteTask | null>(null);
  const [substituteTeacherEmail, setSubstituteTeacherEmail] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  
  // Custom Absences form states
  const [showAddAbsenceModal, setShowAddAbsenceModal] = useState(false);
  const [absenceTeacherEmail, setAbsenceTeacherEmail] = useState<string>('somjai@utd.ac.th');
  const [absenceCourseId, setAbsenceCourseId] = useState<string>('');
  const [absenceDate, setAbsenceDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Reject dialog states
  const [taskToReject, setTaskToReject] = useState<SubstituteTask | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');

  // Complete substitution task states
  const [taskToComplete, setTaskToComplete] = useState<SubstituteTask | null>(null);
  const [completionSummary, setCompletionSummary] = useState<string>('');
  const [completionProblems, setCompletionProblems] = useState<string>('');
  const [completionSolutions, setCompletionSolutions] = useState<string>('');
  const [completionAttendance, setCompletionAttendance] = useState<Record<string, 'PRESENT' | 'ABSENT' | 'LATE' | 'LEAVE'>>({});

  // Success Notification banner
  const [successToast, setSuccessToast] = useState<{title: string; message: string} | null>(null);

  // Initialize Default Tasks
  useEffect(() => {
    setTasks([
      {
        id: 'task-1',
        originalTeacherName: 'คุณครู สมใจ รักสอน',
        originalTeacherEmail: 'somjai@utd.ac.th',
        departmentName: 'กลุ่มสาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี',
        courseId: '1',
        courseCode: 'ว30101',
        courseName: 'วิทยาศาสตร์กายภาพ 1',
        room: 'ม.4/1',
        schedule: 'จ2',
        periodName: 'คาบ 2 (09:10 - 10:00 น.)',
        date: new Date().toISOString().split('T')[0],
        status: 'PENDING_ASSIGNMENT'
      },
      {
        id: 'task-2',
        originalTeacherName: 'คุณครู สมใจ รักสอน',
        originalTeacherEmail: 'somjai@utd.ac.th',
        departmentName: 'กลุ่มสาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี',
        courseId: '2',
        courseCode: 'ว30101',
        courseName: 'วิทยาศาสตร์กายภาพ 1',
        room: 'ม.4/2',
        schedule: 'อ4',
        periodName: 'คาบ 4 (11:00 - 11:50 น.)',
        date: new Date().toISOString().split('T')[0],
        status: 'PENDING_ASSIGNMENT'
      },
      {
        id: 'task-3',
        originalTeacherName: 'คุณครู มานะ บากบั่น',
        originalTeacherEmail: 'mana@utd.ac.th',
        departmentName: 'กลุ่มสาระการเรียนรู้คณิตศาสตร์',
        courseId: '3',
        courseCode: 'ค31101',
        courseName: 'คณิตศาสตร์พื้นฐาน',
        room: 'ม.1/1',
        schedule: 'พุ1',
        periodName: 'คาบ 1 (08:20 - 09:10 น.)',
        date: new Date().toISOString().split('T')[0],
        status: 'PENDING_APPROVAL',
        substituteTeacherEmail: 'wipada.r@school.ac.th',
        substituteTeacherName: 'คุณครู วิภาดา รักเรียน',
        notes: 'ฝากสอนเนื้อหาเรื่อง สมการเชิงเส้นสองตัวแปร และให้นักเรียนทำแบบฝึกหัดหน้า 45 ในหนังสือเรียน'
      },
      {
        id: 'task-4',
        originalTeacherName: 'คุณครู วีณา รื่นรมย์',
        originalTeacherEmail: 'weena@utd.ac.th',
        departmentName: 'กลุ่มสาระการเรียนรู้ศิลปะ',
        courseId: '5',
        courseCode: 'ศ32101',
        courseName: 'ศิลปะ 2',
        room: 'ม.2/3',
        schedule: 'ศ5',
        periodName: 'คาบ 5 (12:40 - 13:30 น.)',
        date: new Date().toISOString().split('T')[0],
        status: 'APPROVED',
        substituteTeacherEmail: 'kiattisak@utd.ac.th',
        substituteTeacherName: 'นาย เกียรติศักดิ์ ศรีวิไล',
        notes: 'ให้นักเรียนทำใบงานระบายสีทัศนศิลป์ตามใบงานที่ครูเตรียมวางไว้บนโต๊ะคอมพิวเตอร์'
      }
    ]);
  }, []);

  const triggerToast = (title: string, message: string) => {
    setSuccessToast({ title, message });
    setTimeout(() => {
      setSuccessToast(null);
    }, 5000);
  };

  // Conflict Checking Engine
  // Checks if a candidate teacher is currently teaching during the same schedule/period of any course
  const checkTeacherConflict = (candidateEmail: string, targetSchedule: string, targetDate: string) => {
    // 1. Check if the candidate teaches any original courses on this exact schedule
    const conflictCourse = courses.find(c => c.teacherEmail === candidateEmail && c.schedule === targetSchedule);
    if (conflictCourse) {
      return `ติดสอนวิชา ${conflictCourse.code} (${conflictCourse.room})`;
    }

    // 2. Check if the candidate is already approved as substitute for another class on this exact schedule/date
    const conflictSub = tasks.find(t => 
      t.substituteTeacherEmail === candidateEmail && 
      t.schedule === targetSchedule && 
      t.date === targetDate && 
      t.status === 'APPROVED'
    );
    if (conflictSub) {
      return `ได้รับอนุมัติสอนแทนห้อง ${conflictSub.room} แล้ว`;
    }

    return null;
  };

  // Add a brand new sick leave absence to test the workflow dynamically
  const handleCreateAbsence = (e: React.FormEvent) => {
    e.preventDefault();
    const origTeacher = ALL_TEACHERS.find(t => t.email === absenceTeacherEmail);
    if (!origTeacher) return;

    // Find the course details
    const selectedCourse = courses.find(c => c.id === absenceCourseId) || 
                           courses.find(c => c.teacherEmail === absenceTeacherEmail);

    if (!selectedCourse) {
      alert('คุณครูท่านนี้ยังไม่มีรายวิชาที่กำหนดในระบบ กรุณาเลือกครูท่านอื่นที่มีรายวิชาสอน');
      return;
    }

    // Map time period based on schedule
    let periodStr = 'คาบ 1 (08:20 - 09:10 น.)';
    if (selectedCourse.schedule?.includes('2')) periodStr = 'คาบ 2 (09:10 - 10:00 น.)';
    else if (selectedCourse.schedule?.includes('3')) periodStr = 'คาบ 3 (10:00 - 10:50 น.)';
    else if (selectedCourse.schedule?.includes('4')) periodStr = 'คาบ 4 (11:00 - 11:50 น.)';
    else if (selectedCourse.schedule?.includes('5')) periodStr = 'คาบ 5 (12:40 - 13:30 น.)';
    else if (selectedCourse.schedule?.includes('6')) periodStr = 'คาบ 6 (13:30 - 14:20 น.)';
    else if (selectedCourse.schedule?.includes('7')) periodStr = 'คาบ 7 (14:20 - 15:10 น.)';
    else if (selectedCourse.schedule?.includes('8')) periodStr = 'คาบ 8 (15:10 - 16:00 น.)';

    const newTask: SubstituteTask = {
      id: 'task-' + Date.now(),
      originalTeacherName: origTeacher.name,
      originalTeacherEmail: origTeacher.email,
      departmentName: getTeacherDepartment(origTeacher.email),
      courseId: selectedCourse.id,
      courseCode: selectedCourse.code,
      courseName: selectedCourse.name,
      room: selectedCourse.room,
      schedule: selectedCourse.schedule || 'จ1',
      periodName: periodStr,
      date: absenceDate,
      status: 'PENDING_ASSIGNMENT'
    };

    setTasks(prev => [newTask, ...prev]);
    setShowAddAbsenceModal(false);
    triggerToast(
      "แจ้งการลาสำเร็จ", 
      `ระบบได้นำรายวิชา ${newTask.courseCode} ของ ${newTask.originalTeacherName} เข้าสู่กระดานรอจัดครูสอนแทนชั่วคราวแล้ว`
    );
  };

  // Submit substitution assignment for approval
  const handleProposeSubstitute = () => {
    if (!activeTaskForAssign || !substituteTeacherEmail) return;

    const subTeacher = ALL_TEACHERS.find(t => t.email === substituteTeacherEmail);
    if (!subTeacher) return;

    setTasks(prev => prev.map(t => {
      if (t.id === activeTaskForAssign.id) {
        return {
          ...t,
          status: 'PENDING_APPROVAL',
          substituteTeacherEmail: subTeacher.email,
          substituteTeacherName: subTeacher.name,
          notes: notes,
          rejectionReason: undefined // Clear past rejection reasons
        };
      }
      return t;
    }));

    setActiveTaskForAssign(null);
    setSubstituteTeacherEmail('');
    setNotes('');

    triggerToast(
      "เสนอความเห็นสำเร็จ",
      "ส่งรายการจัดครูสอนแทนชั่วคราวให้ผู้ช่วย ผอ. กลุ่มบริหารวิชาการ เพื่อตรวจสอบและลงนามอนุมัติเรียบร้อยแล้ว"
    );
  };

  // Approve substitute teaching request
  const handleApproveTask = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        return { ...t, status: 'APPROVED' };
      }
      return t;
    }));

    // Trigger store assignment sync
    if (task.substituteTeacherEmail) {
      assignSubstituteTeacher({
        originalTeacherEmail: task.originalTeacherEmail,
        substituteTeacherEmail: task.substituteTeacherEmail,
        courseId: task.courseId,
        date: task.date
      });
    }

    triggerToast(
      "อนุมัติคำขอสำเร็จ",
      `ออกคำสั่งมอบหมายวิชา ${task.courseCode} ให้แก่ ${task.substituteTeacherName} เพื่อเข้าปฏิบัติการสอนแทนอย่างเป็นทางการแล้ว`
    );
  };

  // Reject and return with comments
  const handleRejectTask = () => {
    if (!taskToReject) return;

    setTasks(prev => prev.map(t => {
      if (t.id === taskToReject.id) {
        return {
          ...t,
          status: 'REJECTED',
          rejectionReason: rejectionReason
        };
      }
      return t;
    }));

    const name = taskToReject.originalTeacherName;
    setTaskToReject(null);
    setRejectionReason('');

    triggerToast(
      "ส่งกลับแก้ไขแล้ว",
      `ส่งรายการสอนแทนของ ${name} กลับไปยังหัวหน้ากลุ่มสาระฯ เรียบร้อยพร้อมข้อเสนอแนะเพิ่มเติม`
    );
  };

  // Init attendance map with defaults when completing a task
  const initCompletionForm = (task: SubstituteTask) => {
    setTaskToComplete(task);
    setCompletionSummary('');
    setCompletionProblems('');
    setCompletionSolutions('');

    // Prepopulate attendance
    const filteredStudents = students.filter(s => isSameRoom(s.room, task.room));
    const initialAttendance: Record<string, 'PRESENT' | 'ABSENT' | 'LATE' | 'LEAVE'> = {};
    filteredStudents.forEach(s => {
      initialAttendance[s.studentId] = 'PRESENT';
    });
    setCompletionAttendance(initialAttendance);
  };

  // Save the attendance and teaching log
  const handleSaveCompletion = () => {
    if (!taskToComplete) return;

    setTasks(prev => prev.map(t => {
      if (t.id === taskToComplete.id) {
        return {
          ...t,
          isCompleted: true,
          completionSummary,
          completionProblems,
          completionSolutions,
          completionAttendance,
          completedAt: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.'
        };
      }
      return t;
    }));

    // Submit teaching log to standard store so it displays in global post-teaching reports
    submitPostTeachingRecord({
      courseId: taskToComplete.courseId,
      date: taskToComplete.date,
      summary: `[ปฏิบัติหน้าที่สอนแทนครูที่ลาป่วย - บันทึกโดย ${taskToComplete.substituteTeacherName}] ${completionSummary}`,
      problems: completionProblems || 'ไม่มี',
      solutions: completionSolutions || 'ไม่มี',
      submittedAt: new Date().toISOString(),
      isLate: false
    });

    const room = taskToComplete.room;
    setTaskToComplete(null);

    triggerToast(
      "บันทึกข้อมูลการสอนแทนแล้ว",
      `บันทึกผลการเข้าเรียนและข้อสรุปการสอนห้อง ${room} เข้าสู่ระบบสารสนเทศส่วนกลางเรียบร้อย`
    );
  };

  // Delete an unassigned task
  const handleDeleteTask = (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    triggerToast("ลบข้อมูลสำเร็จ", "ลบคำสั่งดังกล่าวออกจากรายการประวัติแล้ว");
  };

  // Filters for role views
  const filteredTasksForHOD = tasks.filter(t => {
    const hodDept = getTeacherDepartment(selectedDeptTeacherEmail);
    return t.departmentName === hodDept;
  });

  const filteredTasksForApprover = tasks.filter(t => t.status === 'PENDING_APPROVAL');

  const filteredTasksForSubTeacher = tasks.filter(t => 
    t.substituteTeacherEmail === selectedSubTeacherEmail && 
    t.status === 'APPROVED'
  );

  return (
    <div className="w-full bg-[#0a0f18] min-h-screen text-slate-100 pb-12 font-sans">
      
      {/* SUCCESS TOAST NOTIFICATION */}
      <AnimatePresence>
        {successToast && (
          <motion.div 
            initial={{ opacity: 0, y: -50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-24 right-6 z-50 max-w-md bg-emerald-950/95 border-2 border-emerald-500/30 text-emerald-100 p-4 rounded-xl shadow-2xl backdrop-blur-md flex gap-3 items-start"
          >
            <div className="p-1 bg-emerald-500/20 text-emerald-400 rounded-lg shrink-0">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold">{successToast.title}</h4>
              <p className="text-xs text-emerald-300/85 mt-1 leading-relaxed">{successToast.message}</p>
            </div>
            <button 
              onClick={() => setSuccessToast(null)}
              className="text-emerald-400 hover:text-emerald-200 transition-colors shrink-0 ml-auto"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* COMPACT DASHBOARD BANNER */}
      <div className="bg-slate-950/60 border-b border-slate-800 py-6 px-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wider flex items-center gap-1">
                <Layers className="w-3 h-3" /> RESTRICTED RBAC
              </span>
              <span className="text-xs text-slate-500 font-mono">Module V2.4</span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              Substitute Teaching Management <span className="text-indigo-400 font-medium text-lg font-mono">| ระบบจัดครูสอนแทนชั่วคราว</span>
            </h1>
            <p className="text-xs text-slate-400">
              อำนวยความสะดวกในการจัดครูสอนแทน คัดกรองครูว่างที่ตรงตามกลุ่มสาระวิชาโดยตรง และระบบตรวจสอบเวลาเรียนชน (Conflict Check)
            </p>
          </div>

          <button
            onClick={() => {
              // Reset to target course
              setAbsenceCourseId(courses[0]?.id || '');
              setShowAddAbsenceModal(true);
            }}
            className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 shrink-0 self-start md:self-center border border-indigo-500/30"
          >
            <PlusCircle className="w-4 h-4" /> แจ้งครูลาป่วย / ตารางว่าง
          </button>
        </div>
      </div>

      {/* IN-SITE WORKFLOW IDENTITY SWITCHER */}
      <div className="max-w-7xl mx-auto px-6 mt-6">
        <div className="bg-slate-900/60 border border-slate-800/80 p-4 rounded-2xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center border border-slate-700">
              <ShieldAlert className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-xs font-extrabold text-indigo-400 tracking-wider uppercase">สลับสิทธิ์การทดสอบระบบ (Simulator Settings)</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">เปลี่ยนผู้ใช้สมมติเพื่อทดสอบกระบวนการตั้งแต่ เสนอจัดครู -&gt; อนุมัติ -&gt; บันทึกคาบสอน</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSimulatorRole('HEAD_OF_DEPARTMENT')}
              className={cn(
                "px-3 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5",
                simulatorRole === 'HEAD_OF_DEPARTMENT'
                  ? "bg-amber-500/10 text-amber-400 border-amber-500/30 shadow-lg"
                  : "bg-slate-950/40 text-slate-400 border-slate-800 hover:text-slate-300"
              )}
            >
              <Users className="w-3.5 h-3.5" /> หัวหน้ากลุ่มสาระวิชา
            </button>
            <button
              onClick={() => setSimulatorRole('ACADEMIC_ASSISTANT_DIRECTOR')}
              className={cn(
                "px-3 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5",
                simulatorRole === 'ACADEMIC_ASSISTANT_DIRECTOR'
                  ? "bg-blue-500/10 text-blue-400 border-blue-500/30 shadow-lg"
                  : "bg-slate-950/40 text-slate-400 border-slate-800 hover:text-slate-300"
              )}
            >
              <UserCheck className="w-3.5 h-3.5" /> ผู้ช่วย ผอ. วิชาการ (ผู้อนุมัติ)
            </button>
            <button
              onClick={() => setSimulatorRole('SUBSTITUTE_TEACHER')}
              className={cn(
                "px-3 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5",
                simulatorRole === 'SUBSTITUTE_TEACHER'
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-lg"
                  : "bg-slate-950/40 text-slate-400 border-slate-800 hover:text-slate-300"
              )}
            >
              <Award className="w-3.5 h-3.5" /> ครูผู้รับปฏิบัติหน้าที่สอนแทน
            </button>
          </div>
        </div>

        {/* ROLE SIMULATOR SUB BAR (Identity selector) */}
        {simulatorRole === 'HEAD_OF_DEPARTMENT' && (
          <div className="mt-3 bg-amber-500/5 border border-amber-500/10 px-4 py-3 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs text-amber-300">
            <span className="font-bold flex items-center gap-1.5">
              <Info className="w-4 h-4 shrink-0 text-amber-400" />
              บทบาทที่ใช้งาน: หัวหน้ากลุ่มสาระวิชา (จัดและเสนอความเห็นผู้สอนแทน)
            </span>
            <div className="flex items-center gap-2">
              <span>เลือกหัวหน้ากลุ่มสาระฯ:</span>
              <select
                value={selectedDeptTeacherEmail}
                onChange={e => setSelectedDeptTeacherEmail(e.target.value)}
                className="bg-slate-950 text-slate-200 border border-amber-500/20 rounded-lg p-1 px-2 text-[11px] font-semibold outline-none"
              >
                <option value="wipada.r@school.ac.th">คุณครู วิภาดา (วิทยาศาสตร์ฯ)</option>
                <option value="mana@utd.ac.th">คุณครู มานะ (คณิตศาสตร์)</option>
              </select>
              <span className="text-slate-400 italic">
                สังกัด: {getTeacherDepartment(selectedDeptTeacherEmail).replace("กลุ่มสาระการเรียนรู้", "")}
              </span>
            </div>
          </div>
        )}

        {simulatorRole === 'ACADEMIC_ASSISTANT_DIRECTOR' && (
          <div className="mt-3 bg-blue-500/5 border border-blue-500/10 px-4 py-3 rounded-xl flex items-center gap-1.5 text-xs text-blue-300">
            <UserCheck className="w-4 h-4 text-blue-400" />
            <span className="font-bold">
              บทบาทที่ใช้งาน: ดร. สมเกียรติ ยอดเยี่ยม (ผู้ช่วย ผอ. กลุ่มงานวิชาการ) — สิทธิ์อนุมัติรายการแบบจำลอง
            </span>
          </div>
        )}

        {simulatorRole === 'SUBSTITUTE_TEACHER' && (
          <div className="mt-3 bg-emerald-500/5 border border-emerald-500/10 px-4 py-3 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs text-emerald-300">
            <span className="font-bold flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              บทบาทที่ใช้งาน: ครูผู้สอนที่ได้รับมอบหมายแทน (ลงชื่อเช็กชื่อชั้นเรียน / ทำบันทึกส่งรายงานสรุป)
            </span>
            <div className="flex items-center gap-2">
              <span>เลือกครูผู้สอนแทนชั่วคราว:</span>
              <select
                value={selectedSubTeacherEmail}
                onChange={e => setSelectedSubTeacherEmail(e.target.value)}
                className="bg-slate-950 text-slate-200 border border-emerald-500/20 rounded-lg p-1 px-2 text-[11px] font-semibold outline-none"
              >
                <option value="kiattisak@utd.ac.th">นาย เกียรติศักดิ์ ศรีวิไล</option>
                <option value="wipada.r@school.ac.th">คุณครู วิภาดา รักเรียน</option>
                <option value="teacher@utd.ac.th">นาย ก (ภาษาไทย)</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* MAIN VIEWGRID */}
      <div className="max-w-7xl mx-auto px-6 mt-8 grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* LEFT & CENTER COLUMNS: DYNAMIC BOARDS DEPENDING ON ROLE */}
        <div className="xl:col-span-2 space-y-8">
          
          {/* TAB-STYLE VIEW */}
          {simulatorRole === 'HEAD_OF_DEPARTMENT' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Layers className="w-5 h-5 text-amber-400" />
                    กระดานติดตามงานและเสนอครูสอนแทน (Department Board)
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    แสดงตารางสอนที่ว่างของกลุ่มสาระการเรียนรู้ <span className="text-amber-300 underline font-semibold">{getTeacherDepartment(selectedDeptTeacherEmail)}</span>
                  </p>
                </div>
                
                <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded text-[10px] font-mono">
                  พบ {filteredTasksForHOD.length} รายการ
                </span>
              </div>

              {filteredTasksForHOD.length === 0 ? (
                <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-12 text-center text-slate-500">
                  <AlertCircle className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-sm font-semibold">ไม่มีรายการครูลาพักการสอนในกลุ่มสาระวิชานี้ขณะนี้</p>
                  <p className="text-xs text-slate-600 mt-1">ท่านสามารถแจ้งครูลาเพิ่มจำลองที่ปุ่ม "แจ้งครูลาป่วย" มุมบนขวา</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredTasksForHOD.map(task => (
                    <div 
                      key={task.id}
                      className={cn(
                        "bg-[#111622] border rounded-2xl p-5 flex flex-col justify-between transition-all relative overflow-hidden",
                        task.status === 'PENDING_ASSIGNMENT' ? "border-amber-500/20 hover:border-amber-500/40" :
                        task.status === 'PENDING_APPROVAL' ? "border-sky-500/20 hover:border-sky-500/40" :
                        task.status === 'APPROVED' ? "border-emerald-500/20 hover:border-emerald-500/40" :
                        "border-red-500/20 hover:border-red-500/40"
                      )}
                    >
                      {/* Left accent color */}
                      <div className={cn(
                        "absolute top-0 left-0 w-1 h-full",
                        task.status === 'PENDING_ASSIGNMENT' ? "bg-amber-500" :
                        task.status === 'PENDING_APPROVAL' ? "bg-sky-500" :
                        task.status === 'APPROVED' ? "bg-emerald-500" :
                        "bg-red-500"
                      )} />

                      <div className="space-y-4">
                        <div className="flex justify-between items-start pl-2">
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase tracking-widest block font-bold">{task.departmentName}</span>
                            <span className="text-slate-400 font-bold text-xs mt-1 block">ครูผู้สอนเดิม: {task.originalTeacherName}</span>
                          </div>
                          
                          <span className={cn(
                            "px-2 py-1 rounded-full text-[10px] font-bold border shrink-0",
                            task.status === 'PENDING_ASSIGNMENT' ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                            task.status === 'PENDING_APPROVAL' ? "bg-sky-500/10 text-sky-400 border-sky-500/20" :
                            task.status === 'APPROVED' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                            "bg-red-500/10 text-red-400 border-red-500/20"
                          )}>
                            {task.status === 'PENDING_ASSIGNMENT' ? 'รอจัดครูสอนแทน' :
                             task.status === 'PENDING_APPROVAL' ? 'รออนุมัติ' :
                             task.status === 'APPROVED' ? 'อนุมัติแล้ว' : 'ส่งกลับแก้ไข'}
                          </span>
                        </div>

                        {/* Subject info box */}
                        <div className="bg-slate-950/40 rounded-xl p-3.5 border border-slate-800/80 space-y-2">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-white font-black">{task.courseCode} {task.courseName}</span>
                            <span className="bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded font-mono text-[10px]">{task.room}</span>
                          </div>
                          
                          <div className="flex items-center gap-4 text-xs text-slate-400">
                            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-slate-500" /> {task.periodName}</span>
                            <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-slate-500" /> {task.date}</span>
                          </div>
                        </div>

                        {/* Substitution Assign Details */}
                        {task.substituteTeacherEmail && (
                          <div className="bg-slate-950/20 border border-slate-800/60 rounded-xl p-3 space-y-1 pl-3 text-xs text-slate-300">
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-500">ครูที่เสนอสอนแทน:</span>
                              <span className="font-bold text-white underline">{task.substituteTeacherName}</span>
                            </div>
                            {task.notes && (
                              <div className="text-slate-400 text-[11px] leading-relaxed mt-1">
                                <span className="font-bold text-slate-500">งานมอบหมาย:</span> {task.notes}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Rejection comments warning */}
                        {task.status === 'REJECTED' && task.rejectionReason && (
                          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3 text-xs text-red-400 space-y-1">
                            <div className="font-bold flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" /> ความเห็นผู้ช่วย ผอ. (ข้อความส่งกลับแก้ไข)
                            </div>
                            <p className="italic text-[11px]">{task.rejectionReason}</p>
                          </div>
                        )}

                        {/* Completed summaries */}
                        {task.isCompleted && (
                          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 text-xs text-emerald-400 space-y-1">
                            <div className="font-bold flex items-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5" /> เสร็จสิ้นการปฏิบัติการสอนแทน ({task.completedAt})
                            </div>
                            <p className="text-[11px] text-slate-300 line-clamp-2"><span className="text-slate-500 font-bold">บันทึก:</span> {task.completionSummary}</p>
                          </div>
                        )}
                      </div>

                      {/* Control buttons */}
                      <div className="flex gap-2 mt-4 pt-3 border-t border-slate-800/50">
                        {task.status === 'PENDING_ASSIGNMENT' || task.status === 'REJECTED' ? (
                          <button
                            onClick={() => {
                              setActiveTaskForAssign(task);
                              setSubstituteTeacherEmail('');
                              setNotes('');
                            }}
                            className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs transition-colors shadow-md shadow-amber-500/5 flex items-center justify-center gap-1"
                          >
                            <UserCheck className="w-3.5 h-3.5" /> จัดครูสอนแทน
                          </button>
                        ) : (
                          <div className="flex-1 text-center py-2 text-slate-500 text-xs italic bg-slate-950/20 border border-slate-900 rounded-xl select-none">
                            {task.status === 'PENDING_APPROVAL' ? 'อยู่ระหว่างรออนุมัติ...' : 'อนุมัติเสร็จสิ้น'}
                          </div>
                        )}

                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          className="p-2 bg-slate-900 hover:bg-red-500/10 text-slate-400 hover:text-red-400 border border-slate-800 rounded-xl transition-colors"
                          title="ลบคำร้อง"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {simulatorRole === 'ACADEMIC_ASSISTANT_DIRECTOR' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-blue-400" />
                    แท็บรายการรออนุมัติการสอนแทน (Academic Approvals)
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">ระบบลงนามคำสั่งราชการมอบหมายหน้าที่ครูสอนแทนรายคาบ</p>
                </div>

                <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded text-[10px] font-mono">
                  รออนุมัติ {filteredTasksForApprover.length} รายการ
                </span>
              </div>

              {filteredTasksForApprover.length === 0 ? (
                <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-12 text-center text-slate-500">
                  <CheckCircle className="w-10 h-10 text-emerald-500/60 mx-auto mb-3" />
                  <p className="text-sm font-semibold">เรียบร้อย! ไม่มีคำสั่งแต่งตั้งค้างเสนออนุมัติในเวลานี้</p>
                  <p className="text-xs text-slate-600 mt-1">สลับสิทธิ์เป็น "หัวหน้ากลุ่มสาระฯ" เพื่อทดสอบเสนอจัดครูได้เพิ่มเติม</p>
                </div>
              ) : (
                <div className="bg-[#111622] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-300 font-bold">
                        <tr>
                          <th className="px-5 py-4">ครูที่ลางาน (สาระฯ)</th>
                          <th className="px-5 py-4">วิชาที่สอน / ห้องเรียน</th>
                          <th className="px-5 py-4">คาบที่ลา</th>
                          <th className="px-5 py-4 text-sky-400">ผู้ได้รับจัดสอนแทน (ครูว่าง)</th>
                          <th className="px-5 py-4 text-right">ดำเนินการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-300">
                        {filteredTasksForApprover.map(task => (
                          <tr key={task.id} className="hover:bg-slate-900/40 transition-colors">
                            <td className="px-5 py-4">
                              <div className="font-bold text-white">{task.originalTeacherName}</div>
                              <div className="text-[10px] text-slate-500 mt-0.5">{task.departmentName.replace("กลุ่มสาระการเรียนรู้", "")}</div>
                            </td>
                            <td className="px-5 py-4">
                              <div className="font-semibold text-slate-200">{task.courseCode} - {task.courseName}</div>
                              <div className="text-[10px] text-indigo-400 mt-0.5 font-mono">{task.room} | ประจำวันที่ {task.date}</div>
                            </td>
                            <td className="px-5 py-4 text-slate-400 font-medium">
                              {task.periodName.split(" ")[0]} 
                              <span className="text-[10px] text-slate-500 block">{task.periodName.substring(task.periodName.indexOf("("))}</span>
                            </td>
                            <td className="px-5 py-4">
                              <div className="font-bold text-sky-400 underline">{task.substituteTeacherName}</div>
                              {task.notes && (
                                <p className="text-[10px] text-slate-400 truncate max-w-[200px] mt-0.5" title={task.notes}>
                                  <span className="font-bold text-slate-500">หมายเหตุ:</span> {task.notes}
                                </p>
                              )}
                            </td>
                            <td className="px-5 py-4 text-right">
                              <div className="flex gap-2 justify-end">
                                <button
                                  onClick={() => {
                                    setTaskToReject(task);
                                    setRejectionReason('');
                                  }}
                                  className="px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-[11px] font-bold rounded-lg transition-colors"
                                >
                                  ปฏิเสธ/แก้ไข
                                </button>
                                <button
                                  onClick={() => handleApproveTask(task.id)}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black rounded-lg transition-colors flex items-center gap-1 shadow-lg shadow-emerald-500/10"
                                >
                                  <Check className="w-3.5 h-3.5" /> อนุมัติคำสั่ง
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {simulatorRole === 'SUBSTITUTE_TEACHER' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Award className="w-5 h-5 text-emerald-400" />
                    ภาระสอนแทนชั่วคราววันนี้ ({filteredTasksForSubTeacher.length})
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">แสดงรายชื่อคาบสอนแทนของท่านที่ผ่านการอนุมัติแต่งตั้งอย่างเป็นทางการแล้ว</p>
                </div>

                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-mono">
                  อนุมัติแล้ว {filteredTasksForSubTeacher.filter(t => !t.isCompleted).length} ค้างปฏิบัติ
                </span>
              </div>

              {filteredTasksForSubTeacher.length === 0 ? (
                <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-12 text-center text-slate-500">
                  <CheckCircle className="w-10 h-10 text-emerald-500/30 mx-auto mb-3" />
                  <p className="text-sm font-semibold">ไม่มีคาบสอนแทนของท่านในระบบจำลองขณะนี้</p>
                  <p className="text-xs text-slate-600 mt-1">ท่านสามารถสลับสิทธิ์ไปเป็น "หัวหน้ากลุ่มสาระฯ" เพื่อทำการเสนอจัดครูสอนแทนเพิ่มได้</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredTasksForSubTeacher.map(task => (
                    <div 
                      key={task.id}
                      className={cn(
                        "bg-[#111622] border rounded-2xl p-5 flex flex-col justify-between transition-all",
                        task.isCompleted ? "border-slate-800 opacity-75" : "border-emerald-500/25 hover:border-emerald-500/40"
                      )}
                    >
                      <div className="space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[9px] font-bold">
                              คำสั่งผ่านการอนุมัติ
                            </span>
                            <h3 className="text-slate-400 font-bold text-xs mt-2">ครูที่ขาดสอน: {task.originalTeacherName}</h3>
                          </div>
                          
                          <div className="text-right">
                            <span className="text-[10px] text-slate-500 block font-mono">ID: {task.id}</span>
                            {task.isCompleted && (
                              <span className="text-emerald-400 font-bold text-[10px] mt-1 inline-block">✓ บันทึกสอนแทนแล้ว</span>
                            )}
                          </div>
                        </div>

                        {/* Subject header */}
                        <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/80 space-y-2">
                          <div className="flex justify-between items-center text-xs font-bold">
                            <span className="text-white text-sm">{task.courseCode} {task.courseName}</span>
                            <span className="bg-indigo-500/15 text-indigo-400 px-2 py-0.5 rounded font-mono text-[10px]">{task.room}</span>
                          </div>
                          <div className="text-xs text-slate-400 flex flex-wrap gap-4 pt-1">
                            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-slate-500" /> {task.periodName}</span>
                            <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-slate-500" /> {task.date}</span>
                          </div>
                        </div>

                        {task.notes && (
                          <div className="bg-slate-950/20 border border-slate-800/50 rounded-xl p-3 text-xs text-slate-400 leading-relaxed">
                            <span className="font-extrabold text-slate-500">โน้ตมอบหมายงาน:</span> {task.notes}
                          </div>
                        )}

                        {task.isCompleted && (
                          <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3 text-xs text-slate-300 leading-relaxed space-y-1">
                            <div className="font-bold text-emerald-400">บันทึกผลการเข้าเรียน & สรุปสาระความรู้:</div>
                            <p className="text-[11px] italic">{task.completionSummary}</p>
                            <p className="text-[11px] text-slate-400 mt-1"><span className="text-slate-500 font-bold">บันทึกเมื่อ:</span> วันนี้ เวลา {task.completedAt}</p>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-800/50 flex">
                        {!task.isCompleted ? (
                          <button
                            onClick={() => initCompletionForm(task)}
                            className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs transition-colors flex items-center justify-center gap-1 shadow-lg shadow-emerald-500/10"
                          >
                            <FileText className="w-4 h-4" /> เช็กชื่อและบันทึกการสอนแทน
                          </button>
                        ) : (
                          <button
                            disabled
                            className="flex-1 py-2 text-slate-500 text-xs italic bg-slate-950/40 border border-slate-900 rounded-xl select-none flex items-center justify-center gap-1"
                          >
                            <CheckCircle className="w-4 h-4 text-slate-600" /> บันทึกและส่งรายงานแล้ว
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: WORKFLOW VISUALIZATION & METRICS */}
        <div className="space-y-6">
          
          {/* STATS OVERVIEW CARD */}
          <div className="bg-[#111622] border border-slate-800 rounded-2xl p-6 space-y-5 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl"></div>
            
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4.5 h-4.5 text-indigo-400" /> ภาพรวมสถิติการสอนแทน
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">สถานะใบมอบหมายวิชาเรียนทับซ้อนและจัดสรรครู</p>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3.5 space-y-1">
                <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">กำลังลาค้างจัดสรร</span>
                <span className="text-2xl font-extrabold text-amber-500 font-mono">
                  {tasks.filter(t => t.status === 'PENDING_ASSIGNMENT').length}
                </span>
                <span className="text-[9px] text-slate-400 block">รอส่งหัวหน้าสาระฯ</span>
              </div>
              <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3.5 space-y-1">
                <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">ค้างลงนามอนุมัติ</span>
                <span className="text-2xl font-extrabold text-sky-400 font-mono">
                  {tasks.filter(t => t.status === 'PENDING_APPROVAL').length}
                </span>
                <span className="text-[9px] text-slate-400 block">รอผู้ช่วย ผอ. ลงนาม</span>
              </div>
              <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3.5 space-y-1">
                <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">อนุมัติเรียบร้อย</span>
                <span className="text-2xl font-extrabold text-emerald-400 font-mono">
                  {tasks.filter(t => t.status === 'APPROVED').length}
                </span>
                <span className="text-[9px] text-slate-400 block">ปฏิบัติหน้าที่แทน</span>
              </div>
              <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3.5 space-y-1">
                <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">ดำเนินการเสร็จสิ้น</span>
                <span className="text-2xl font-extrabold text-white font-mono">
                  {tasks.filter(t => t.isCompleted).length}
                </span>
                <span className="text-[9px] text-slate-400 block">บันทึกเช็กชื่อแล้ว</span>
              </div>
            </div>
          </div>

          {/* SICK LEAVE FLOW INFO */}
          <div className="bg-[#111622] border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-3">
              <Info className="w-4 h-4 text-indigo-400" /> ขั้นตอนดำเนินงานอย่างเป็นทางการ (Workflow Guide)
            </h4>
            
            <div className="space-y-4 text-xs text-slate-400">
              <div className="flex gap-2.5 items-start">
                <div className="w-5 h-5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold font-mono text-[10px] shrink-0">1</div>
                <div>
                  <h5 className="font-bold text-slate-300">แจ้งครูลาป่วยเละตารางว่าง</h5>
                  <p className="text-[11px] mt-0.5">เมื่อครูลาป่วย สารสนเทศวิชาการจะดึงรายวิชาที่ต้องได้รับการสอนแทนเข้ามาค้างจัดบนกระดาน</p>
                </div>
              </div>

              <div className="flex gap-2.5 items-start">
                <div className="w-5 h-5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold font-mono text-[10px] shrink-0">2</div>
                <div>
                  <h5 className="font-bold text-slate-300">หัวหน้ากลุ่มสาระวิชา เสนอครู</h5>
                  <p className="text-[11px] mt-0.5">กดปุ่ม "จัดครูสอนแทน" ระบบคัดกรองเฉพาะครูในกลุ่มสาระฯเดียวกันที่ **ตารางว่างไม่ชนคาบ** แล้วเสนอผู้ช่วย ผอ. อนุมัติ</p>
                </div>
              </div>

              <div className="flex gap-2.5 items-start">
                <div className="w-5 h-5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold font-mono text-[10px] shrink-0">3</div>
                <div>
                  <h5 className="font-bold text-slate-300">ผู้ช่วย ผอ. วิชาการ อนุมัติ</h5>
                  <p className="text-[11px] mt-0.5">ตรวจสอบความถูกต้องและความครอบคลุมภาระงาน กดอนุมัติแต่งตั้ง หรือส่งกลับแก้ไขหากครูสอนแทนมีภารกิจด่วนอื่น</p>
                </div>
              </div>

              <div className="flex gap-2.5 items-start">
                <div className="w-5 h-5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold font-mono text-[10px] shrink-0">4</div>
                <div>
                  <h5 className="font-bold text-slate-300">ครูสอนแทนเช็กชื่อและส่งบันทึก</h5>
                  <p className="text-[11px] mt-0.5">ครูผู้สอนแทนเข้าปฏิบัติภารกิจ ทำการเช็กชื่อนักเรียนในห้อง และส่งสรุปผลหลังสอนเพื่อประสานงานครูเจ้าของวิชาต่อไป</p>
                </div>
              </div>
            </div>
          </div>

          {/* CONFLICT CHECK DEMO INFO */}
          <div className="bg-[#111622] border border-slate-800 rounded-2xl p-5 text-xs text-slate-400 space-y-3.5">
            <div className="flex items-center gap-2 text-indigo-400 font-bold border-b border-slate-800 pb-2">
              <ShieldAlert className="w-4 h-4" /> ฟีเจอร์ความปลอดภัยเชิงวิชาการ
            </div>
            <p className="text-[11px] leading-relaxed">
              ระบบตรวจสอบความขัดแย้งของตารางเวลาเรียน (Schedule Conflict Checking Engine) ทำหน้าที่ดึงสถิติตารางสอนจริงของผู้สมัครทุกคนจากฐานข้อมูล 
              เพื่อป้องกันไม่ให้คุณครูได้รับคำสั่งซ้ำซ้อนในวันและคาบเวลาเรียนเดียวกัน
            </p>
            <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800/80 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0"></span>
              <p className="text-[10px] text-slate-500 font-mono">Smart Matching Filters: Same Department, Conflict Exempt</p>
            </div>
          </div>

        </div>

      </div>

      {/* MODAL 1: SICK LEAVE TRIGGERING (ADD ABSENCE) */}
      <AnimatePresence>
        {showAddAbsenceModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#111622] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5"
            >
              <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-indigo-400" />
                    แจ้งคุณครูลาป่วย/สร้างตารางค้างจัดแทน
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">ส่งคาบเรียนเข้ากระดานจัดสอนแทนชั่วคราว</p>
                </div>
                <button 
                  onClick={() => setShowAddAbsenceModal(false)}
                  className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateAbsence} className="space-y-4">
                {/* Select Teacher */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">คุณครูที่ลางาน (Teacher Absent)</label>
                  <select
                    value={absenceTeacherEmail}
                    onChange={e => {
                      setAbsenceTeacherEmail(e.target.value);
                      const filtered = courses.filter(c => c.teacherEmail === e.target.value);
                      if (filtered.length > 0) setAbsenceCourseId(filtered[0].id);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-indigo-500 transition-all font-semibold"
                  >
                    {ALL_TEACHERS.map(t => (
                      <option key={t.email} value={t.email}>{t.name} ({t.position})</option>
                    ))}
                  </select>
                </div>

                {/* Select Course */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">เลือกวิชาและคาบเรียนที่จะลาป่วย</label>
                  <select
                    value={absenceCourseId}
                    onChange={e => setAbsenceCourseId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-indigo-500 transition-all font-semibold"
                  >
                    <option value="">-- ดึงจากตารางสอนปัจจุบันของครู --</option>
                    {courses.filter(c => c.teacherEmail === absenceTeacherEmail).map(c => (
                      <option key={c.id} value={c.id}>{c.code} {c.name} ({c.room}) - {c.schedule}</option>
                    ))}
                  </select>
                </div>

                {/* Date Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">วันที่ครูลางาน</label>
                  <input
                    type="date"
                    required
                    value={absenceDate}
                    onChange={e => setAbsenceDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-indigo-500 transition-all font-mono"
                  />
                </div>

                <div className="bg-slate-950/60 p-3.5 border border-slate-800/80 rounded-xl flex items-start gap-2.5 text-slate-400">
                  <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] leading-relaxed">
                    ระบบวิชาการจะสร้างคำสั่งประเภท **[รอจัดครูสอนแทน]** และคัดกรองเฉพาะครูในกลุ่มสาระการเรียนรู้เดียวกัน เพื่อให้หัวหน้ากลุ่มสาระวิชาทำรายการคัดเลือกครูเข้าสอนแทนในลำดับถัดไป
                  </p>
                </div>

                <div className="flex gap-2.5 justify-end pt-3 border-t border-slate-800/50">
                  <button
                    type="button"
                    onClick={() => setShowAddAbsenceModal(false)}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-semibold text-slate-400 transition-all"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-extrabold transition-all shadow-md shadow-indigo-600/10 flex items-center gap-1"
                  >
                    <PlusCircle className="w-3.5 h-3.5" /> บันทึกการลาของครู
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: ASSIGN SUBSTITUTE MODAL (WITH SAMEDEPARTMENT & CONFLICT CHECKS) */}
      <AnimatePresence>
        {activeTaskForAssign && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#111622] border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5"
            >
              <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-amber-400" />
                    มอบหมายการสอนแทน (Substitute Teacher Assignment)
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">วิชา {activeTaskForAssign.courseCode} {activeTaskForAssign.courseName} | ห้อง {activeTaskForAssign.room}</p>
                </div>
                <button 
                  onClick={() => setActiveTaskForAssign(null)}
                  className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-slate-950/60 p-4 border border-slate-800/80 rounded-xl space-y-1.5 text-xs text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-500">สังกัดกลุ่มสาระวิชา:</span>
                  <span className="font-bold text-white">{activeTaskForAssign.departmentName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">คุณครูเจ้าของชั่วโมงเดิม:</span>
                  <span className="font-bold text-white">{activeTaskForAssign.originalTeacherName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">วัน/เวลาคาบสอนทับซ้อน:</span>
                  <span className="font-bold text-amber-400 font-mono">{activeTaskForAssign.periodName} ({activeTaskForAssign.schedule})</span>
                </div>
              </div>

              <div className="space-y-4">
                {/* Candidate dropdown with SAME DEPARTMENT & CONFLICT check */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">
                    รายชื่อครูในกลุ่มสาระฯ เดียวกัน (คัดกรองความขัดแย้งเวลาตารางสอนแล้ว)
                  </label>
                  <select
                    required
                    value={substituteTeacherEmail}
                    onChange={e => setSubstituteTeacherEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-amber-500 transition-all font-semibold"
                  >
                    <option value="">-- กรุณาเลือกคุณครูผู้สอนแทน --</option>
                    {/* Filter to SAME department & check conflicts */}
                    {ALL_TEACHERS.map(cand => {
                      const isSameDept = cand.dept === activeTaskForAssign.departmentName;
                      const isSelf = cand.email === activeTaskForAssign.originalTeacherEmail;
                      
                      if (!isSameDept || isSelf) return null;

                      // Run conflict checker
                      const conflictMsg = checkTeacherConflict(cand.email, activeTaskForAssign.schedule, activeTaskForAssign.date);

                      return (
                        <option 
                          key={cand.email} 
                          value={cand.email}
                          disabled={!!conflictMsg}
                          className={conflictMsg ? 'text-red-500' : 'text-slate-100'}
                        >
                          {cand.name} {conflictMsg ? `❌ [ไม่ว่าง - ${conflictMsg}]` : '✓ (ตารางเรียนว่างปฏิบัติหน้าที่แทนได้)'}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* notes/instructions */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">
                    ข้อกำหนด/หมายเหตุ มอบหมายแผนการสอน (Notes to Teacher)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="ระบุคำอธิบายใบงาน แหล่งค้นคว้า หรือแนวทางควบคุมชั้นเรียนเพื่อแจ้งให้ครูสอนแทนทราบล่วงหน้า..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-amber-500 transition-all placeholder:text-slate-600 font-semibold"
                  />
                </div>

                <div className="bg-amber-500/5 p-3.5 border border-amber-500/15 rounded-xl flex items-start gap-2 text-amber-300">
                  <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                  <p className="text-[10px] leading-relaxed">
                    เมื่อกดส่งความเห็น ข้อมูลจะถูกจัดเข้าสู่สถานะ **[รออนุมัติ]** เพื่อแจ้งเตือนไปยังห้องปฏิบัติงานผู้ช่วยผู้อำนวยการฝ่ายวิชาการในการอนุมัติใบแต่งตั้ง
                  </p>
                </div>
              </div>

              <div className="flex gap-2.5 justify-end pt-3 border-t border-slate-800/50">
                <button
                  type="button"
                  onClick={() => setActiveTaskForAssign(null)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-semibold text-slate-400 transition-all"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={!substituteTeacherEmail}
                  onClick={handleProposeSubstitute}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold transition-all shadow-md shadow-amber-600/10 flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" /> เสนอผู้ช่วย ผอ. อนุมัติ
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: REJECT/CORRECTION DIALOG */}
      <AnimatePresence>
        {taskToReject && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#111622] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4"
            >
              <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-red-400" />
                  ส่งความเห็นกลับไปแก้ไขการสอนแทน
                </h3>
                <button onClick={() => setTaskToReject(null)} className="text-slate-400 hover:text-white">
                  <XCircle className="w-4 h-4" />
                </button>
              </div>

              <div className="text-xs text-slate-300">
                ท่านกำลังปฏิเสธคำขอการเสนอคุณครู <span className="font-bold text-red-400">{taskToReject.substituteTeacherName}</span> ให้สอนแทนวิชา {taskToReject.courseCode} ของคุณครู {taskToReject.originalTeacherName}
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-400">เหตุผลส่งกลับแก้ไข/ข้อความเสนอแนะเพิ่มเติม</label>
                <textarea
                  rows={3}
                  required
                  placeholder="ระบุข้อแนะนำเพิ่มเติม เช่น ครูผู้สอนแทนมีประชุมงานด่วนคาบนี้ หรือขอให้พิจารณาเลือกครูท่านอื่นที่ตรงสายรายวิชามากขึ้น..."
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-red-500 transition-all font-semibold"
                />
              </div>

              <div className="flex gap-2.5 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setTaskToReject(null)}
                  className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-slate-400"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={!rejectionReason}
                  onClick={handleRejectTask}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold transition-all"
                >
                  ส่งกลับแก้ไข
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 4: RECORD ATTENDANCE & SUMMARY REPORT DRAWER / MODAL */}
      <AnimatePresence>
        {taskToComplete && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#111622] border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-6 my-8 max-h-[90vh] flex flex-col"
            >
              {/* Header */}
              <div className="flex justify-between items-start border-b border-slate-800 pb-3 shrink-0">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-emerald-400" />
                    เช็กชื่อและส่งรายงานบันทึกผลการสอนแทน
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">วิชา {taskToComplete.courseCode} {taskToComplete.courseName} | ชั้นเรียน {taskToComplete.room}</p>
                </div>
                <button 
                  onClick={() => setTaskToComplete(null)}
                  className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable Form Body */}
              <div className="flex-1 overflow-y-auto pr-2 space-y-6">
                
                {/* SECTION 1: ATTENDANCE CHECKER */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">ส่วนที่ 1: บันทึกข้อมูลการเข้าเรียนของนักเรียน ({students.filter(s => isSameRoom(s.room, taskToComplete.room)).length} คน)</h4>
                    <span className="text-[10px] text-slate-500">คลิกที่ปุ่มสถานะเพื่อสลับการเช็กชื่อของแต่ละบุคคล</span>
                  </div>

                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl overflow-hidden max-h-[220px] overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 font-semibold">เลขที่</th>
                          <th className="px-4 py-2 font-semibold">รหัสนักเรียน</th>
                          <th className="px-4 py-2 font-semibold">ชื่อ-นามสกุล</th>
                          <th className="px-4 py-2 text-right font-semibold">สถานะเช็กชื่อ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40 text-slate-300">
                        {students.filter(s => isSameRoom(s.room, taskToComplete.room)).map(student => {
                          const currentStat = completionAttendance[student.studentId] || 'PRESENT';
                          return (
                            <tr key={student.id} className="hover:bg-slate-900/30">
                              <td className="px-4 py-2 font-mono text-slate-500">{student.studentNo}</td>
                              <td className="px-4 py-2 font-mono text-slate-400">{student.studentId}</td>
                              <td className="px-4 py-2 font-semibold text-white">{student.fullName || student.name}</td>
                              <td className="px-4 py-2 text-right">
                                <div className="inline-flex rounded-lg overflow-hidden border border-slate-800">
                                  {(['PRESENT', 'ABSENT', 'LATE', 'LEAVE'] as const).map(st => (
                                    <button
                                      key={st}
                                      type="button"
                                      onClick={() => {
                                        setCompletionAttendance(prev => ({
                                          ...prev,
                                          [student.studentId]: st
                                        }));
                                      }}
                                      className={cn(
                                        "px-2 py-1 text-[10px] font-extrabold transition-all",
                                        currentStat === st ? (
                                          st === 'PRESENT' ? "bg-emerald-500 text-white" :
                                          st === 'ABSENT' ? "bg-red-500 text-white" :
                                          st === 'LATE' ? "bg-amber-500 text-white" :
                                          "bg-sky-500 text-white"
                                        ) : "bg-slate-950 text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                                      )}
                                    >
                                      {st === 'PRESENT' ? 'มา' :
                                       st === 'ABSENT' ? 'ขาด' :
                                       st === 'LATE' ? 'สาย' : 'ลา'}
                                    </button>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* SECTION 2: TEACHING LOG REPORT */}
                <div className="space-y-4 pt-2 border-t border-slate-800/50">
                  <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">ส่วนที่ 2: บันทึกหลังสอน & ปัญหาอุปสรรค</h4>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">
                        สรุปเนื้อหาที่สอนวันนี้ (Summary of Content taught) <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        rows={2}
                        required
                        placeholder="สรุปเนื้อหาสำคัญที่ได้ทำการควบคุมห้องเรียน หรือเรื่องราวที่ได้สอนสอนแทนในคาบนี้ให้ครบถ้วน..."
                        value={completionSummary}
                        onChange={e => setCompletionSummary(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-emerald-500 transition-all font-semibold"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">ปัญหา/อุปสรรคที่พบ (ถ้ามี)</label>
                        <textarea
                          rows={2}
                          placeholder="เช่น นักเรียนบางคนสับสนโจทย์ใบงาน หรือส่งชั่วโมงช้าเนื่องจากลืมสมุดมา..."
                          value={completionProblems}
                          onChange={e => setCompletionProblems(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-emerald-500 transition-all placeholder:text-slate-700 font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">แนวทางการแก้ไข/ข้อแนะนำผู้เรียน</label>
                        <textarea
                          rows={2}
                          placeholder="เช่น แนะนำให้ทบทวนสูตรเพิ่มเติมทางคลิปวิดีโอ หรือสั่งงานสรุปแบบย่อพิเศษ..."
                          value={completionSolutions}
                          onChange={e => setCompletionSolutions(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-emerald-500 transition-all placeholder:text-slate-700 font-semibold"
                        />
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Action Buttons */}
              <div className="flex gap-2.5 justify-end pt-3 border-t border-slate-800/50 shrink-0">
                <button
                  type="button"
                  onClick={() => setTaskToComplete(null)}
                  className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-slate-400"
                >
                  ย้อนกลับ
                </button>
                <button
                  type="button"
                  disabled={!completionSummary}
                  onClick={handleSaveCompletion}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-500/15"
                >
                  <CheckCircle className="w-3.5 h-3.5" /> ส่งรายงานบันทึกการสอนแทน
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
