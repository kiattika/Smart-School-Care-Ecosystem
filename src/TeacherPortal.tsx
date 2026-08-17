import { cn, parseThaiSchedule, isSameRoom } from "./lib/utils";
import React, { useState, useEffect, useMemo } from 'react';
import { usePeriodsConfig } from './hooks/usePeriodsConfig';
import { useTeacherFirestoreSchedule } from './hooks/useTeacherFirestoreSchedule';
import { useHomeroomAttendance } from './hooks/useHomeroomAttendance';
import { saveAttendanceRecord, getTodayScheduleByTeacher, getStudentsByClass, saveGradebookScore, getGradebookScoresByClass } from './services/firestoreService';
import { TeacherScheduleList, SubjectPeriod } from './components/TeacherScheduleList';
import { format, setHours, setMinutes, isWithinInterval, isBefore, isAfter } from 'date-fns';
import { th } from 'date-fns/locale';
import { useStore } from './store';
import { AttendanceStatus, Course, GlobalCourse, PostTeachingRecord, PeriodSwap, SubstituteAssignment, Student } from './types';
import { Minus, Plus, BookOpen, Users, ArrowLeft, PlusCircle, X, Clock, Settings, CheckCircle, Edit3, Sparkles, Shuffle, Calendar, ArrowUpRight, FileText, AlertTriangle, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'motion/react';

// Helper for tailwind classes

const PERIODS = ['โฮมรูม', 'คาบ 1', 'คาบ 2', 'คาบ 3', 'คาบ 4', 'พักกลางวัน', 'คาบ 5', 'คาบ 6', 'คาบ 7', 'คาบ 8'];

export function TeacherPortal() {
  const {
    user,
    currentDate, 
    currentPeriod, 
    students, 
    analytics, 
    attendanceRecords,
    scheduleConfig,
    setCurrentPeriod,
    setAttendanceStatus,
    adjustBehaviorScore,
    moveStudentSeat,
    setCurrentDate,
    setScheduleConfig,
    submitLateAttendanceRequest,
    lateAttendanceRequests,
    courses,
    globalCourses,
    setCourses,
    markAttendanceDone,
    submitScheduleChangeRequest,
    postTeachingRecords,
    periodSwaps,
    substituteAssignments,
    studentScores,
    courseScoreSettings,
    submitPostTeachingRecord,
    submitPeriodSwap,
    updatePeriodSwapStatus,
    updateStudentScore,
    updateCourseScoreSetting
  } = useStore();

  const { periods: dbPeriods } = usePeriodsConfig();
  const { 
    periods: fsPeriods, 
    schedules: fsSchedules, 
    loading: fsLoading, 
    updateScheduleAttendance, 
    updatePartnerAttendance 
  } = useTeacherFirestoreSchedule();

  const todayStr = format(currentDate, 'yyyy-MM-dd');



  const myCourses: Course[] = useMemo(() => globalCourses
    .filter(gc => {
      // 1. Is original teacher
      const isOriginal = gc.teacherEmail === user?.email;
      
      // 2. Is substitute teacher today
      const isSub = substituteAssignments.some(sa => 
        sa.courseId === gc.courseId && 
        sa.substituteTeacherEmail === user?.email && 
        sa.date === todayStr
      );

      // 3. Is target of an approved swap for this course
      const isSwapTarget = periodSwaps.some(ps => 
        ps.targetCourseId === gc.courseId && 
        ps.targetEmail === user?.email && 
        ps.status === 'APPROVED'
      );
      // OR is requester of an approved swap and now teaches the target course instead
      const isSwapRequester = periodSwaps.some(ps =>
        ps.requesterCourseId === gc.courseId &&
        ps.requesterEmail === user?.email &&
        ps.status === 'APPROVED'
      );

      return isOriginal || isSub || isSwapTarget || isSwapRequester;
    })
    .map(gc => {
      // Find original course if it exists to get `attendanceTaken` status
      const originalCourse = courses.find(c => c.id === gc.courseId);
      
      let roleLabel = "";
      const isSub = substituteAssignments.some(sa => sa.courseId === gc.courseId && sa.substituteTeacherEmail === user?.email && sa.date === todayStr);
      if (isSub) {
        roleLabel = "สอนแทน (Substitute)";
      } else {
        const isSwap = periodSwaps.some(ps => (ps.targetCourseId === gc.courseId || ps.requesterCourseId === gc.courseId) && ps.status === 'APPROVED');
        if (isSwap) {
          roleLabel = "สลับคาบเรียน (Swapped)";
        }
      }

      return {
        id: gc.courseId,
        code: gc.code,
        name: gc.courseName,
        room: gc.roomName,
        term: '1/2569',
        studentsCount: 35,
        schedule: gc.scheduleString,
        attendanceTaken: originalCourse?.attendanceTaken || false,
        teacherName: gc.teacherName,
        roleLabel
      };
    }), [globalCourses, user?.email, substituteAssignments, todayStr, periodSwaps, courses]);

  const [view, setView] = useState<'dashboard' | 'class'>('dashboard');
  const [activeCourse, setActiveCourse] = useState<Course | null>(null);

  const isHrActive = !!(activeCourse && (activeCourse.code === 'HR' || activeCourse.name?.toLowerCase().includes('homeroom')));
  const hrTodayStr = format(currentDate, 'yyyy-MM-dd');
  const activeHrRoom = isHrActive ? (activeCourse?.room || 'ม.5/8') : 'ม.5/8';

  const {
    record: hrRecord,
    saveHomeroomAttendance,
    requestUnlock: hrRequestUnlock
  } = useHomeroomAttendance(hrTodayStr, activeHrRoom);

  // New States for Seating random pick & behavior scoring
  const [selectedStudentForScore, setSelectedStudentForScore] = useState<Student | null>(null);
  const [isShuffling, setIsShuffling] = useState(false);
  const [shufflingStudentIds, setShufflingStudentIds] = useState<string[]>([]);
  const [randomPickedStudent, setRandomPickedStudent] = useState<Student | null>(null);

  // New States for Post-Teaching Records
  const [showPostTeachingModal, setShowPostTeachingModal] = useState(false);
  const [postTeachingCourse, setPostTeachingCourse] = useState<Course | null>(null);
  const [ptDate, setPtDate] = useState('');
  const [ptSummary, setPtSummary] = useState('');
  const [ptProblems, setPtProblems] = useState('');
  const [ptSolutions, setPtSolutions] = useState('');
  const [viewingRecord, setViewingRecord] = useState<PostTeachingRecord | null>(null);

  // New States for Dashboard Navigation
  const [dashboardTab, setDashboardTab] = useState<'courses' | 'substitutions' | 'records' | 'gradebook'>('courses');
  const [selectedGradebookCourseId, setSelectedGradebookCourseId] = useState<string>('');
  const [gradebookStudents, setGradebookStudents] = useState<any[]>([]);
  const [gradebookLoading, setGradebookLoading] = useState<boolean>(false);
  const [showScoreSettingModal, setShowScoreSettingModal] = useState(false);
  const [scoreSettingForm, setScoreSettingForm] = useState({ preMidterm: 25, midterm: 20, postMidterm: 25, final: 30 });
  const [scoreSettingError, setScoreSettingError] = useState('');
  const [isCopyMode, setIsCopyMode] = useState(false);
  const [copyTargetCourses, setCopyTargetCourses] = useState<string[]>([]);

  useEffect(() => {
    if (!selectedGradebookCourseId) {
      setGradebookStudents([]);
      setGradebookLoading(false);
      return;
    }

    const selectedCourse = myCourses.find(c => c.id === selectedGradebookCourseId);
    const targetClassName = selectedCourse?.room || (selectedCourse as any)?.className || (selectedCourse as any)?.roomName || '';
    const courseCode = selectedCourse?.code || '';
    const term = selectedCourse?.term || '1/2569';

    if (!targetClassName) {
      setGradebookStudents([]);
      setGradebookLoading(false);
      return;
    }

    setGradebookLoading(true);

    getStudentsByClass(targetClassName).then((fetchedStudents) => {
      if (fetchedStudents && fetchedStudents.length > 0) {
        setGradebookStudents(fetchedStudents);
      } else {
        const filteredStoreStudents = students.filter(s => isSameRoom(s.room, targetClassName) || isSameRoom((s as any).className, targetClassName));
        setGradebookStudents(filteredStoreStudents);
      }
      setGradebookLoading(false);
    }).catch(err => {
      console.warn("Notice fetching students for gradebook:", err);
      const filteredStoreStudents = students.filter(s => isSameRoom(s.room, targetClassName) || isSameRoom((s as any).className, targetClassName));
      setGradebookStudents(filteredStoreStudents);
      setGradebookLoading(false);
    });

    getGradebookScoresByClass(courseCode, targetClassName, term).then((scoresMap) => {
      Object.values(scoresMap).forEach(rec => {
        if (rec.studentId) {
          updateStudentScore(selectedGradebookCourseId, rec.studentId, {
            preMidterm: rec.preMidterm,
            midterm: rec.midterm,
            postMidterm: rec.postMidterm,
            final: rec.final,
            total: rec.total,
            grade: rec.grade
          });
        }
      });
    });
  }, [selectedGradebookCourseId]);

  // New States for Swaps Form
  const [swapRequesterCourseId, setSwapRequesterCourseId] = useState('');
  const [swapTargetEmail, setSwapTargetEmail] = useState('');
  const [swapTargetCourseId, setSwapTargetCourseId] = useState('');

  // Dynamic classroom layout configuration
  const courseStudents = activeCourse?.room
    ? (students.filter(s => isSameRoom(s.room, activeCourse.room)).length > 0
        ? students.filter(s => isSameRoom(s.room, activeCourse.room))
        : students.filter(s => s.room === undefined || s.room === null || s.room === 'ม.1/1'))
    : students;

  const isM58 = isSameRoom(activeCourse?.room, 'ม.5/8');
  const layout = isM58 ? {
    totalRows: 5,
    totalCols: 8,
    aisleAfterCols: [2, 4, 6]
  } : {
    totalRows: 5,
    totalCols: 10,
    aisleAfterCols: [] as number[]
  };

  const unassignedStudents = courseStudents.filter(s => s.seatIndex === null);
  
  const [toast, setToast] = useState<string | null>(null);
  const [syncingCourseId, setSyncingCourseId] = useState<string | null>(null);

  // Late Attendance Modal
  const [showLateModal, setShowLateModal] = useState(false);
  const [lateCourse, setLateCourse] = useState<Course | null>(null);
  const [lateReason, setLateReason] = useState('');

  // Schedule Request Modal
  const [showScheduleReqModal, setShowScheduleReqModal] = useState(false);
  const [scheduleReqCourse, setScheduleReqCourse] = useState<Course | null>(null);
  const [scheduleReqNote, setScheduleReqNote] = useState('');

  // Admin Config Modal
  const [showConfigModal, setShowConfigModal] = useState(false);

  const availableRooms = ['ม.1/1', 'ม.1/2', 'ม.1/3', 'ม.2/1', 'ม.2/2', 'ม.3/1'];

  // Parse Thai Schedule Notation e.g. "จ1", "อ3-4"
  const parseSchedule = (scheduleStr: string | undefined) => {
    if (!scheduleStr) return [];
    
    const match = scheduleStr.match(/^([จอพศฤ]+)([\d\-]+)$/);
    if (!match) return [];
    
    const dayStr = match[1];
    const periodsStr = match[2];
    
    let targetDay = 1; // 1 = Monday, 5 = Friday
    if (dayStr === 'จ') targetDay = 1;
    else if (dayStr === 'อ') targetDay = 2;
    else if (dayStr === 'พุ') targetDay = 3;
    else if (dayStr === 'พฤ' || dayStr === 'ฤ') targetDay = 4;
    else if (dayStr === 'ศ') targetDay = 5;

    const periods: number[] = [];
    if (periodsStr.includes('-')) {
      const [start, end] = periodsStr.split('-').map(Number);
      for(let i = start; i <= end; i++) periods.push(i);
    } else {
      periods.push(Number(periodsStr));
    }
    
    return periods.map(p => ({ day: targetDay, periodIndex: p }));
  };

  // Time Simulation Helpers
  const getPeriodTimes = (index: number) => {
    // 1. First try to find period configuration matching the periodNumber
    const match = dbPeriods.find(p => p.periodNumber === index);
    if (match) {
      const [sh, sm] = match.startTime.split(':').map(Number);
      const [eh, em] = match.endTime.split(':').map(Number);
      const start = setMinutes(setHours(currentDate, sh || 0), sm || 0);
      const end = setMinutes(setHours(currentDate, eh || 0), em || 0);
      return { start, end };
    }

    // 2. Fallback to default school schedule if not found in dbPeriods
    const baseDuration = scheduleConfig.isActivityDay ? 50 - scheduleConfig.shortenMinutes : 50;
    
    // Start at 08:30 (8 * 60 + 30 = 510 mins)
    let currentMins = 8 * 60 + 30; // 08:30
    
    for (let i = 0; i < index; i++) {
      if (i === 0) currentMins += 20; // Homeroom
      else if (i === 5) currentMins += 60; // Lunch
      else currentMins += baseDuration;
    }
    
    const startMins = currentMins;
    let duration = baseDuration;
    if (index === 0) duration = 20;
    else if (index === 5) duration = 60;
    
    const endMins = startMins + duration;
    
    const start = setMinutes(setHours(currentDate, Math.floor(startMins / 60)), startMins % 60);
    const end = setMinutes(setHours(currentDate, Math.floor(endMins / 60)), endMins % 60);
    
    return { start, end };
  };

  const formatTime = (date: Date) => format(date, 'HH:mm');

  const handleLateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lateCourse || !lateReason) return;
    
    submitLateAttendanceRequest({
      teacherName: user?.displayName || 'Unknown',
      subjectCode: lateCourse.code,
      subjectName: lateCourse.name,
      room: lateCourse.room,
      period: PERIODS[lateCourse.periodIndex],
      reason: lateReason,
      createdAt: new Date()
    });
    
    setShowLateModal(false);
    setLateReason('');
    setLateCourse(null);
  };

  const handleScheduleReqSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleReqCourse || !scheduleReqNote) return;
    
    submitScheduleChangeRequest({
      courseId: scheduleReqCourse.id,
      teacherName: user?.displayName || 'Unknown',
      subjectCode: scheduleReqCourse.code,
      room: scheduleReqCourse.room,
      currentSchedule: scheduleReqCourse.schedule || PERIODS[scheduleReqCourse.periodIndex],
      note: scheduleReqNote
    });
    
    setShowScheduleReqModal(false);
    setScheduleReqNote('');
    setScheduleReqCourse(null);
    setToast('ส่งคำร้องขอสลับตารางสอนเรียบร้อยแล้ว');
    setTimeout(() => setToast(null), 3000);
  };

  const handleRandomSelect = () => {
    if (courseStudents.length === 0) return;
    setIsShuffling(true);
    setRandomPickedStudent(null);
    setShufflingStudentIds([]);

    let count = 0;
    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * courseStudents.length);
      const randomStudent = courseStudents[randomIndex];
      setShufflingStudentIds([randomStudent.studentId]);
      count++;
      
      if (count > 15) {
        clearInterval(interval);
        const finalIndex = Math.floor(Math.random() * courseStudents.length);
        const finalStudent = courseStudents[finalIndex];
        setShufflingStudentIds([]);
        setRandomPickedStudent(finalStudent);
        setIsShuffling(false);
      }
    }, 120);
  };

  const handlePostTeachingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!postTeachingCourse) return;

    const teachingDateStr = ptDate || format(currentDate, 'yyyy-MM-dd');
    const submittedAtIso = currentDate.toISOString();

    const dateParts = teachingDateStr.split('-').map(Number);
    const teachingMidnight = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], 23, 59, 59, 999);
    const isLate = isAfter(currentDate, teachingMidnight);

    submitPostTeachingRecord({
      courseId: postTeachingCourse.id,
      date: teachingDateStr,
      summary: ptSummary,
      problems: ptProblems,
      solutions: ptSolutions,
      submittedAt: submittedAtIso,
      isLate: isLate
    });

    setToast(`บันทึกหลังสอนวิชา ${postTeachingCourse.name} เรียบร้อยแล้ว! ${isLate ? '⚠️ (ส่งช้ากว่ากำหนด)' : '✅ (ส่งตรงเวลา)'}`);
    setShowPostTeachingModal(false);
    setPtSummary('');
    setPtProblems('');
    setPtSolutions('');
    setPostTeachingCourse(null);

    setTimeout(() => setToast(null), 4000);
  };

  const handleSwapSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!swapRequesterCourseId || !swapTargetEmail || !swapTargetCourseId || !user?.email) return;

    submitPeriodSwap({
      requesterEmail: user.email,
      targetEmail: swapTargetEmail,
      requesterCourseId: swapRequesterCourseId,
      targetCourseId: swapTargetCourseId
    });

    setToast('ส่งคำร้องขอสลับคาบเรียนไปยังเพื่อนครูแล้ว');
    setSwapRequesterCourseId('');
    setSwapTargetEmail('');
    setSwapTargetCourseId('');
    setTimeout(() => setToast(null), 3000);
  };

  const [isSavingAttendance, setIsSavingAttendance] = useState(false);

  const handleAttendanceDone = async (courseId: string) => {
    setIsSavingAttendance(true);
    try {
      const studentStatuses: Record<string, 'PRESENT' | 'LATE' | 'ABSENT' | 'LEAVE'> = {};
      courseStudents.forEach(student => {
        const status = attendanceRecords[courseId]?.[student.studentId] || 'PRESENT';
        studentStatuses[student.studentId] = (status === 'UNMARKED' ? 'PRESENT' : status) as any;
      });

      const teacherId = user?.email || 'kiattika@utd.ac.th';
      const teacherName = user?.displayName || user?.email?.split('@')[0] || 'Mr.Kiattisak';
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      const roomStr = (activeCourse?.room || 'ม.5/8').replace('/', '-');
      const periodNum = activeCourse?.periodIndex || 0;
      const recordId = `${dateStr}_${roomStr}_p${periodNum}`;

      // Save to main attendance_records via live Firestore Service
      await saveAttendanceRecord({
        id: recordId,
        date: dateStr,
        room: activeCourse?.room || 'ม.5/8',
        checkedByTeacherId: teacherId,
        checkedByName: teacherName,
        periodNumber: periodNum,
        checkedAt: format(new Date(), 'HH:mm'),
        isLocked: true,
        students: studentStatuses
      });

      if (isHrActive) {
        await saveHomeroomAttendance(studentStatuses);
      }

      markAttendanceDone(courseId);

      // Update Firestore schedules collection too
      const matchedSched = fsSchedules.find(s => 
        s.courseCode === activeCourse?.code && 
        (s.targetClass.replace(/^M\./i, 'ม.') === activeCourse?.room?.replace(/^M\./i, 'ม.'))
      );
      if (matchedSched) {
        await updateScheduleAttendance(matchedSched.id, true);
      }

      setToast('บันทึกการเช็กชื่อเรียบร้อยแล้ว!');
      setTimeout(() => setToast(null), 3000);
      setView('dashboard');
    } catch (err) {
      console.error("Failed to save attendance:", err);
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSavingAttendance(false);
    }
  };

  const handleSyncRoster = (courseId: string) => {
    setSyncingCourseId(courseId);
    setTimeout(() => {
      setSyncingCourseId(null);
      setToast('ซิงค์รายชื่อนักเรียน 40 คน สำเร็จ!');
      setTimeout(() => setToast(null), 3000);
    }, 1500);
  };

  // Find students at risk
  const criticalStudents = analytics.filter(a => a.subjectAttendanceRate < 60);
  const warningStudents = analytics.filter(a => a.subjectAttendanceRate >= 60 && a.subjectAttendanceRate < 80);
  const avgAttendance = Math.round(analytics.reduce((acc, a) => acc + a.subjectAttendanceRate, 0) / (analytics.length || 1));

  return (
    <div className="flex flex-col h-screen w-full bg-[#0b0d14] text-slate-100 overflow-hidden font-sans selection:bg-blue-500/30">
      
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 fade-in duration-300">
          <div className="bg-green-900/90 border border-green-500/30 backdrop-blur-md text-green-100 px-6 py-3 rounded-full shadow-[0_0_30px_rgba(34,197,94,0.2)] flex items-center gap-3 font-medium">
            <CheckCircle className="w-5 h-5 text-green-400" />
            {toast}
          </div>
        </div>
      )}

      {/* Header */}
      <header className="h-16 border-b border-slate-800/80 bg-[#161f30] flex items-center justify-between px-6 shrink-0 shadow-lg relative">
        <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent"></div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-600 rounded flex items-center justify-center font-bold text-white shadow-[0_0_10px_rgba(16,185,129,0.4)]">T</div>
          <h1 className="text-lg font-bold tracking-tight text-white">
            Smart School Care <span className="text-emerald-400 font-medium">| Subject Teacher</span>
          </h1>
        </div>
        <div className="flex items-center gap-6">
          <button 
            onClick={() => setShowConfigModal(true)}
            className="flex items-center gap-2 bg-[#1b2a4a] hover:bg-[#23365d] border border-blue-900/50 px-3 py-1.5 rounded-lg text-sm text-blue-400 transition-colors font-medium"
          >
            <Clock className="w-4 h-4 text-amber-400" />
            <span className="font-mono">{formatTime(currentDate)}</span>
            {scheduleConfig.isActivityDay && (
              <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 rounded ml-1 border border-amber-500/30">
                -{scheduleConfig.shortenMinutes}m
              </span>
            )}
          </button>
          <div className="text-sm text-slate-300 font-mono hidden sm:block">
            {format(currentDate, 'd MMMM yyyy', { locale: th })}
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-slate-800/80 border border-emerald-800/50 flex items-center justify-center text-xs font-bold text-emerald-400">ครู เอ</div>
          </div>
        </div>
      </header>

      {/* Main Area */}
      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="flex-1 flex flex-col min-h-0 overflow-hidden"
        >
          {view === 'dashboard' ? (
            <main className="flex-1 overflow-y-auto p-8 bg-[#0b0f19]">
          <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-end mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">หน้าจัดการภาระงานสอน (Academic Load)</h2>
                <p className="text-slate-300">จัดการรายวิชา เช็คชื่อ และสลับภาระงานสอนแทนสำหรับครูผู้สอน</p>
              </div>
            </div>

            {/* Sub Tabs Selection */}
            <div className="flex border-b border-slate-800/80 mb-8 gap-6">
              {[
                { id: 'courses', label: 'ตารางสอนและการเข้าเรียน', count: myCourses.length },
                { id: 'substitutions', label: 'จัดการภาระลา & สอนแทน', count: substituteAssignments.filter(sa => sa.substituteTeacherEmail === user?.email && sa.date === todayStr).length + periodSwaps.filter(ps => ps.targetEmail === user?.email && ps.status === 'PENDING_TEACHER').length },
                { id: 'records', label: 'ประวัติบันทึกหลังสอนทั้งหมด', count: postTeachingRecords.filter(r => myCourses.some(c => c.id === r.courseId)).length },
                { id: 'gradebook', label: 'สมุดบันทึกคะแนน (Gradebook)', count: 0 }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setDashboardTab(tab.id as any)}
                  className={cn(
                    "pb-3 text-sm font-bold transition-all relative",
                    dashboardTab === tab.id ? "text-emerald-400 border-b-2 border-emerald-400" : "text-slate-400 hover:text-slate-200"
                  )}
                >
                  <span className="flex items-center gap-2">
                    {tab.label}
                    {tab.count > 0 && (
                      <span className="bg-slate-800/80 text-slate-300 border border-slate-700/50 text-xs px-2 py-0.5 rounded-full font-mono">
                        {tab.count}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>

            {dashboardTab === 'courses' && (() => {
              // 1. Calculate schedule target day and label
              const dayOfWeek = currentDate.getDay();
              const targetDate = new Date(currentDate.getTime());
              let isNextDay = false;
              let dayLabel = "";

              if (dayOfWeek === 6) { // Saturday -> Monday
                targetDate.setDate(targetDate.getDate() + 2);
                isNextDay = true;
                dayLabel = "ตารางสอนวันถัดไป (วันจันทร์)";
              } else if (dayOfWeek === 0) { // Sunday -> Monday
                targetDate.setDate(targetDate.getDate() + 1);
                isNextDay = true;
                dayLabel = "ตารางสอนวันถัดไป (วันจันทร์)";
              } else {
                isNextDay = false;
                const dayNames = ["วันอาทิตย์", "วันจันทร์", "วันอังคาร", "วันพุธ", "วันพฤหัสบดี", "วันศุกร์", "วันเสาร์"];
                dayLabel = `ตารางสอนวันนี้ (${dayNames[dayOfWeek]})`;
              }
              const targetDayOfWeek = targetDate.getDay(); // 1 to 5

              // 2. Map and filter periods specifically for targetDayOfWeek
              const mappedPeriods: SubjectPeriod[] = [];

              if (!fsLoading && fsSchedules.length > 0) {
                // Use Firestore sync schedules & periods!
                const todaySchedules = fsSchedules.filter(item => 
                  (item.teacherEmail === user?.email) && 
                  (item.scheduleDay === targetDayOfWeek)
                );

                todaySchedules.forEach(item => {
                  // Find period times from fsPeriods matching item.periodNumber
                  const pConfig = fsPeriods.find(p => p.periodNumber === item.periodNumber);
                  const startTime = pConfig ? pConfig.startTime : "08:00";
                  const endTime = pConfig ? pConfig.endTime : "08:30";

                  // Find matching course in myCourses to get original id if available, or use a derived id
                  const matchedCourse = myCourses.find(c => 
                    c.code === item.courseCode && 
                    (c.room?.replace(/^M\./i, 'ม.') === item.targetClass.replace(/^M\./i, 'ม.'))
                  );

                  const courseId = matchedCourse ? matchedCourse.id : item.id;
                  const isAttendanceTaken = matchedCourse ? matchedCourse.attendanceTaken : !!item.attendanceTaken;

                  const recordDate = format(targetDate, 'yyyy-MM-dd');
                  const existingRecord = postTeachingRecords.find(r => r.courseId === courseId && r.date === recordDate);

                  mappedPeriods.push({
                    id: item.id,
                    courseId: courseId,
                    periodNumber: item.periodNumber,
                    startTime,
                    endTime,
                    subjectCode: item.courseCode,
                    subjectName: item.courseName,
                    className: item.targetClass,
                    room: item.room || 'ห้องเรียน ม.5/8',
                    attendanceTaken: isAttendanceTaken,
                    hasPostTeachingRecord: !!existingRecord,
                    roleLabel: item.type === 'ACTIVITY' ? 'กิจกรรม' : matchedCourse?.roleLabel || 'วิชาการ',
                    studentsCount: item.studentsCount || 40,
                    type: item.type,
                    teachingPartner: item.teachingPartner,
                    partnerCheckedAttendance: item.partnerCheckedAttendance
                  });
                });
              } else {
                // Fallback to local myCourses calculation
                myCourses.forEach(course => {
                  const segments = parseSchedule(course.schedule); // e.g. [{ day: 2, periodIndex: 2 }, ...]
                  const todaySegments = segments.filter(seg => seg.day === targetDayOfWeek);

                  if (todaySegments.length > 0) {
                    // Sort segments ascending
                    todaySegments.sort((a, b) => a.periodIndex - b.periodIndex);

                    // Group consecutive periods (e.g., 6 and 7)
                    const blocks: number[][] = [];
                    todaySegments.forEach(seg => {
                      if (blocks.length === 0) {
                        blocks.push([seg.periodIndex]);
                      } else {
                        const lastBlock = blocks[blocks.length - 1];
                        const lastPeriod = lastBlock[lastBlock.length - 1];
                        if (seg.periodIndex === lastPeriod + 1) {
                          lastBlock.push(seg.periodIndex);
                        } else {
                          blocks.push([seg.periodIndex]);
                        }
                      }
                    });

                    blocks.forEach(block => {
                      const pIndex = block[0];
                      const endPIndex = block[block.length - 1];
                      const { start } = getPeriodTimes(pIndex);
                      const { end: latestEnd } = getPeriodTimes(endPIndex);

                      const recordDate = format(targetDate, 'yyyy-MM-dd');
                      const existingRecord = postTeachingRecords.find(r => r.courseId === course.id && r.date === recordDate);

                      mappedPeriods.push({
                        id: `${course.id}-${pIndex}`,
                        courseId: course.id,
                        periodNumber: pIndex,
                        startTime: formatTime(start),
                        endTime: formatTime(latestEnd),
                        subjectCode: course.code,
                        subjectName: course.name,
                        className: course.room || 'ม.5/8',
                        room: course.room || 'อาคาร 3 ห้อง 321',
                        attendanceTaken: course.attendanceTaken,
                        hasPostTeachingRecord: !!existingRecord,
                        roleLabel: course.roleLabel,
                        studentsCount: course.studentsCount
                      });
                    });
                  }
                });
              }

              // Ensure they are sorted ascending by periodNumber
              mappedPeriods.sort((a, b) => a.periodNumber - b.periodNumber);

              return (
                <TeacherScheduleList
                  periods={mappedPeriods}
                  currentDate={currentDate}
                  isNextDay={isNextDay}
                  dayLabel={dayLabel}
                  onTakeAttendance={(periodId) => {
                    let course = myCourses.find(c => c.id === periodId);
                    if (!course) {
                      const matchedItem = fsSchedules.find(s => s.id === periodId);
                      if (matchedItem) {
                        course = {
                          id: matchedItem.id,
                          code: matchedItem.courseCode,
                          name: matchedItem.courseName,
                          room: matchedItem.targetClass,
                          term: '1/2569',
                          studentsCount: matchedItem.studentsCount || 40,
                          attendanceTaken: !!matchedItem.attendanceTaken
                        };
                      }
                    }
                    if (course) {
                      const parsedSchedules = parseSchedule(course.schedule);
                      let pIndex = course.periodIndex || 1;
                      if (parsedSchedules && parsedSchedules.length > 0) {
                        pIndex = parsedSchedules[0].periodIndex;
                      }
                      setActiveCourse(course);
                      setCurrentPeriod(PERIODS[pIndex] || 'คาบ 1');
                      setView('class');
                    }
                  }}
                  onRequestLateAttendance={(periodId) => {
                    let course = myCourses.find(c => c.id === periodId);
                    if (!course) {
                      const matchedItem = fsSchedules.find(s => s.id === periodId);
                      if (matchedItem) {
                        course = {
                          id: matchedItem.id,
                          code: matchedItem.courseCode,
                          name: matchedItem.courseName,
                          room: matchedItem.targetClass,
                          term: '1/2569',
                          studentsCount: matchedItem.studentsCount || 40,
                          attendanceTaken: !!matchedItem.attendanceTaken
                        };
                      }
                    }
                    if (course) {
                      setLateCourse(course);
                      setShowLateModal(true);
                    }
                  }}
                  onRecordPostTeaching={(periodId) => {
                    let course = myCourses.find(c => c.id === periodId);
                    if (!course) {
                      const matchedItem = fsSchedules.find(s => s.id === periodId);
                      if (matchedItem) {
                        course = {
                          id: matchedItem.id,
                          code: matchedItem.courseCode,
                          name: matchedItem.courseName,
                          room: matchedItem.targetClass,
                          term: '1/2569',
                          studentsCount: matchedItem.studentsCount || 40,
                          attendanceTaken: !!matchedItem.attendanceTaken
                        };
                      }
                    }
                    if (course) {
                      setPostTeachingCourse(course);
                      setPtDate(format(targetDate, 'yyyy-MM-dd'));
                      setShowPostTeachingModal(true);
                    }
                  }}
                  onViewPostTeachingRecord={(periodId) => {
                    const recordDate = format(targetDate, 'yyyy-MM-dd');
                    const existingRecord = postTeachingRecords.find(r => r.courseId === periodId && r.date === recordDate);
                    if (existingRecord) {
                      setViewingRecord(existingRecord);
                    }
                  }}
                  onTogglePartnerAttendance={async (periodId, currentStatus) => {
                    try {
                      await updatePartnerAttendance(periodId, currentStatus);
                      setToast('ซิงค์ข้อมูลผู้สอนร่วมเรียบร้อยแล้ว!');
                      setTimeout(() => setToast(null), 3000);
                    } catch (err) {
                      console.error("Failed to toggle partner attendance:", err);
                    }
                  }}
                />
              );
            })()}

            {dashboardTab === 'substitutions' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-300">
                {/* Form to submit request */}
                <div className="bg-[#161f30] border border-slate-800/80 rounded-xl p-6 space-y-4">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-800/80 pb-3">
                    <Shuffle className="w-5 h-5 text-emerald-400" /> ส่งคำร้องขอสลับภาระงานสอน
                  </h3>
                  
                  <form onSubmit={handleSwapSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-300 mb-1.5">วิชาของท่านที่ต้องการแลกเปลี่ยน</label>
                      <select
                        required
                        value={swapRequesterCourseId}
                        onChange={e => setSwapRequesterCourseId(e.target.value)}
                        className="w-full bg-[#0b0f19] border border-slate-800/80 rounded-lg p-2.5 text-sm text-slate-200 outline-none focus:border-emerald-500"
                      >
                        <option value="">-- เลือกวิชาของท่าน --</option>
                        {globalCourses.filter(gc => gc.teacherEmail === user?.email).map(gc => (
                          <option key={gc.courseId} value={gc.courseId}>{gc.code} {gc.courseName} ({gc.roomName}) - {gc.scheduleString}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-slate-300 mb-1.5">คุณครูที่ต้องการขอสลับคาบสอนด้วย</label>
                      <select
                        required
                        value={swapTargetEmail}
                        onChange={e => {
                          setSwapTargetEmail(e.target.value);
                          setSwapTargetCourseId('');
                        }}
                        className="w-full bg-[#0b0f19] border border-slate-800/80 rounded-lg p-2.5 text-sm text-slate-200 outline-none focus:border-emerald-500"
                      >
                        <option value="">-- เลือกคุณครู --</option>
                        {Array.from(new Map(globalCourses.filter(gc => gc.teacherEmail !== user?.email).map(gc => [gc.teacherEmail, gc])).values()).map(gc => (
                          <option key={gc.teacherEmail} value={gc.teacherEmail}>{gc.teacherName} ({gc.teacherEmail})</option>
                        ))}
                      </select>
                    </div>

                    {swapTargetEmail && (
                      <div>
                        <label className="block text-sm font-bold text-slate-300 mb-1.5">วิชาของเพื่อนครูที่ขอแลกเปลี่ยน</label>
                        <select
                          required
                          value={swapTargetCourseId}
                          onChange={e => setSwapTargetCourseId(e.target.value)}
                          className="w-full bg-[#0b0f19] border border-slate-800/80 rounded-lg p-2.5 text-sm text-slate-200 outline-none focus:border-emerald-500"
                        >
                          <option value="">-- เลือกวิชาของเพื่อนครู --</option>
                          {globalCourses.filter(gc => gc.teacherEmail === swapTargetEmail).map(gc => (
                            <option key={gc.courseId} value={gc.courseId}>{gc.code} {gc.courseName} ({gc.roomName}) - {gc.scheduleString}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={!swapRequesterCourseId || !swapTargetEmail || !swapTargetCourseId}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold rounded-lg transition-colors shadow-lg shadow-emerald-600/20"
                    >
                      ยื่นคำร้องสลับคาบเรียน
                    </button>
                  </form>
                </div>

                <div className="space-y-6">
                  {/* Incoming requests waiting for me */}
                  <div className="bg-[#161f30] border border-slate-800/80 rounded-xl p-6 space-y-4">
                    <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800/80 pb-3">
                      <ArrowUpRight className="w-5 h-5 text-blue-400 rotate-180" /> คำร้องขอสลับคาบเรียนที่ส่งถึงท่าน
                    </h3>
                    
                    <div className="space-y-3">
                      {periodSwaps.filter(ps => ps.targetEmail === user?.email && ps.status === 'PENDING_TEACHER').length === 0 ? (
                        <div className="text-center py-6 text-xs text-slate-500">ไม่มีคำร้องสลับคาบส่งถึงท่าน</div>
                      ) : (
                        periodSwaps.filter(ps => ps.targetEmail === user?.email && ps.status === 'PENDING_TEACHER').map(ps => {
                          const reqCourse = globalCourses.find(c => c.courseId === ps.requesterCourseId);
                          const targetCourse = globalCourses.find(c => c.courseId === ps.targetCourseId);
                          return (
                            <div key={ps.id} className="bg-[#0b0f19] p-4 border border-slate-800/80 rounded-xl space-y-3">
                              <div className="flex justify-between items-start">
                                <div className="text-xs text-slate-400">จาก: <span className="text-white font-bold">{reqCourse?.teacherName}</span></div>
                                <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded text-[10px]">รออนุมัติ</span>
                              </div>
                              <p className="text-xs text-slate-300">
                                ขอแลกคาบวิชา <span className="text-emerald-400 font-bold">{reqCourse?.courseName} ({reqCourse?.scheduleString})</span> ของเขา กับวิชา <span className="text-yellow-400 font-bold">{targetCourse?.courseName} ({targetCourse?.scheduleString})</span> ของท่าน
                              </p>
                              <div className="flex gap-2 justify-end">
                                <button
                                  onClick={() => { updatePeriodSwapStatus(ps.id, 'PENDING_ADMIN'); setToast('อนุมัติคำขอแล้ว รอวิชาการพิจารณาขั้นสุดท้าย'); setTimeout(() => setToast(null), 3000); }}
                                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-md transition-colors"
                                >
                                  ยอมรับสลับคาบ (Approve)
                                </button>
                                <button
                                  onClick={() => { updatePeriodSwapStatus(ps.id, 'REJECTED'); setToast('ปฏิเสธคำขอสลับคาบแล้ว'); setTimeout(() => setToast(null), 3000); }}
                                  className="px-3 py-1 bg-red-600/15 hover:bg-red-600/20 text-red-400 border border-red-500/20 text-xs font-bold rounded-md transition-colors"
                                >
                                  ปฏิเสธ (Reject)
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* My Sent requests */}
                  <div className="bg-[#161f30] border border-slate-800/80 rounded-xl p-6 space-y-4">
                    <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800/80 pb-3">
                      <ArrowUpRight className="w-5 h-5 text-amber-400" /> สถานะคำร้องที่ท่านยื่นขอ
                    </h3>
                    
                    <div className="space-y-3">
                      {periodSwaps.filter(ps => ps.requesterEmail === user?.email).length === 0 ? (
                        <div className="text-center py-6 text-xs text-slate-500">ท่านยังไม่เคยยื่นคำร้องสลับคาบ</div>
                      ) : (
                        periodSwaps.filter(ps => ps.requesterEmail === user?.email).map(ps => {
                          const reqCourse = globalCourses.find(c => c.courseId === ps.requesterCourseId);
                          const targetCourse = globalCourses.find(c => c.courseId === ps.targetCourseId);
                          return (
                            <div key={ps.id} className="bg-[#0b0f19] p-4 border border-slate-800/80 rounded-xl flex items-center justify-between gap-4">
                              <div className="text-xs space-y-1">
                                <div className="text-slate-300 font-bold">สลับ: {reqCourse?.courseName} ⇆ {targetCourse?.courseName}</div>
                                <div className="text-slate-400">ผู้รับ: {targetCourse?.teacherName}</div>
                              </div>
                              <span className={cn(
                                "px-2.5 py-1 rounded text-[10px] font-bold border",
                                ps.status === 'PENDING_TEACHER' ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                                ps.status === 'PENDING_ADMIN' ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                                ps.status === 'APPROVED' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                "bg-red-500/10 text-red-400 border-red-500/20"
                              )}>
                                {ps.status === 'PENDING_TEACHER' ? 'รอครูอนุมัติ' :
                                 ps.status === 'PENDING_ADMIN' ? 'รอแอดมินอนุมัติ' :
                                 ps.status === 'APPROVED' ? 'อนุมัติเสร็จสมบูรณ์' : 'ปฏิเสธ'}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Substitute assignments */}
                  <div className="bg-[#161f30] border border-slate-800/80 rounded-xl p-6 space-y-4">
                    <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800/80 pb-3">
                      <Calendar className="w-5 h-5 text-emerald-400" /> งานสอนแทนที่ท่านได้รับมอบหมายวันนี้
                    </h3>
                    
                    <div className="space-y-3">
                      {substituteAssignments.filter(sa => sa.substituteTeacherEmail === user?.email && sa.date === todayStr).length === 0 ? (
                        <div className="text-center py-6 text-xs text-slate-500">ไม่มีภาระงานสอนแทนสำหรับท่านในวันนี้</div>
                      ) : (
                        substituteAssignments.filter(sa => sa.substituteTeacherEmail === user?.email && sa.date === todayStr).map(sa => {
                          const course = globalCourses.find(c => c.courseId === sa.courseId);
                          return (
                            <div key={sa.id} className="bg-emerald-950/20 p-4 border border-emerald-800/40 rounded-xl space-y-1">
                              <div className="flex justify-between text-xs text-emerald-400 font-bold">
                                <span>วิชา: {course?.code} {course?.courseName}</span>
                                <span>{course?.scheduleString}</span>
                              </div>
                              <p className="text-xs text-slate-300">ห้องเรียน: <span className="font-bold text-white">{course?.roomName}</span></p>
                              <p className="text-[10px] text-slate-400">แทนคุณครู: {course?.teacherName}</p>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {dashboardTab === 'records' && (
              <div className="bg-[#161f30] border border-slate-800/80 rounded-xl p-6 space-y-6 animate-in fade-in duration-300">
                <div className="border-b border-slate-800/80 pb-4 flex justify-between items-center">
                  <h3 className="text-lg font-bold text-white">ประวัติบันทึกหลังสอนทั้งหมด</h3>
                </div>

                <div className="space-y-4">
                  {postTeachingRecords.filter(r => myCourses.some(c => c.id === r.courseId)).length === 0 ? (
                    <div className="text-center py-12 text-slate-500">ยังไม่พบบันทึกหลังการสอนที่เคยส่ง</div>
                  ) : (
                    postTeachingRecords
                      .filter(r => myCourses.some(c => c.id === r.courseId))
                      .map((record, idx) => {
                        const course = globalCourses.find(c => c.courseId === record.courseId);
                        return (
                          <div key={idx} className="bg-[#0b0f19] p-5 border border-slate-800/80 rounded-xl space-y-3 hover:border-slate-700 transition-colors">
                            <div className="flex flex-wrap justify-between items-start gap-2">
                              <div>
                                <h4 className="text-sm font-bold text-white">{course?.code} {course?.courseName} ({course?.roomName})</h4>
                                <div className="text-[11px] text-slate-400 mt-0.5">
                                  วันที่สอน: {format(new Date(record.date), 'dd MMMM yyyy', { locale: th })} • ส่งเมื่อ: {new Date(record.submittedAt).toLocaleTimeString('th-TH')} น.
                                </div>
                              </div>
                              
                              {record.isLate ? (
                                <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1">
                                  <AlertTriangle className="w-3.5 h-3.5" /> ส่งช้ากว่ากำหนด (Late)
                                </span>
                              ) : (
                                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1">
                                  <CheckCircle className="w-3.5 h-3.5 animate-pulse" /> ตรงเวลา (On Time)
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-800/80 text-xs">
                              <div>
                                <span className="text-slate-400 font-bold block mb-1">📝 สรุปผลการสอน</span>
                                <p className="text-slate-300 whitespace-pre-line leading-relaxed bg-[#161f30] p-2.5 rounded border border-slate-800/80">{record.summary}</p>
                              </div>
                              <div>
                                <span className="text-slate-400 font-bold block mb-1">⚠️ ปัญหาและอุปสรรค</span>
                                <p className="text-slate-300 whitespace-pre-line leading-relaxed bg-[#161f30] p-2.5 rounded border border-slate-800/80">{record.problems}</p>
                              </div>
                              <div>
                                <span className="text-slate-400 font-bold block mb-1">💡 แนวทางแก้ไข/พัฒนา</span>
                                <p className="text-slate-300 whitespace-pre-line leading-relaxed bg-[#161f30] p-2.5 rounded border border-slate-800/80">{record.solutions}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>
            )}

            {dashboardTab === 'gradebook' && (
              <div className="bg-[#161f30] border border-slate-800/80 rounded-xl p-6 space-y-6 animate-in fade-in duration-300">
                <div className="border-b border-slate-800/80 pb-4 flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-blue-400" /> สมุดบันทึกคะแนน (Gradebook)
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">บันทึกคะแนนและคำนวณเกรดอัตโนมัติ</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {selectedGradebookCourseId && (
                      <button 
                        onClick={() => {
                          const existing = courseScoreSettings.find(s => s.courseId === selectedGradebookCourseId);
                          setScoreSettingForm(existing || { preMidterm: 25, midterm: 20, postMidterm: 25, final: 30 });
                          setScoreSettingError('');
                          setShowScoreSettingModal(true);
                        }}
                        className="bg-[#1b2a4a] hover:bg-[#23365d] text-blue-400 border border-blue-900/50 text-xs font-bold py-2 px-3 rounded-lg transition-colors flex items-center gap-2"
                      >
                        ⚙️ ตั้งค่าสัดส่วนคะแนนรายวิชา
                      </button>
                    )}
                    <select 
                      className="bg-[#0b0f19] border border-slate-800/80 text-white text-sm rounded-lg p-2 focus:border-emerald-500 outline-none"
                      value={selectedGradebookCourseId}
                      onChange={(e) => setSelectedGradebookCourseId(e.target.value)}
                    >
                      <option value="">-- เลือกรายวิชา --</option>
                      {myCourses.map(c => (
                        <option key={c.id} value={c.id}>{c.code} {c.name} ({c.room})</option>
                      ))}
                    </select>
                  </div>
                </div>

                {!selectedGradebookCourseId ? (
                  <div className="text-center py-12 text-slate-500">
                    <p>กรุณาเลือกรายวิชาเพื่อบันทึกคะแนน</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    {(() => {
                      const selectedCourse = myCourses.find(c => c.id === selectedGradebookCourseId);
                      const targetClassName = selectedCourse?.room || (selectedCourse as any)?.className || (selectedCourse as any)?.roomName || '';
                      const courseCode = selectedCourse?.code || '';
                      const term = selectedCourse?.term || '1/2569';

                      const rawSetting = courseScoreSettings.find(s => s.courseId === selectedGradebookCourseId);
                      const setting = {
                        preMidterm: rawSetting ? rawSetting.maxPreMidterm : 25,
                        midterm: rawSetting ? rawSetting.maxMidterm : 20,
                        postMidterm: rawSetting ? rawSetting.maxPostMidterm : 25,
                        final: rawSetting ? rawSetting.maxFinal : 30
                      };

                      if (gradebookLoading) {
                        return (
                          <div className="text-center py-12 text-slate-400">
                            <p>กำลังโหลดข้อมูลนักเรียน...</p>
                          </div>
                        );
                      }

                      if (gradebookStudents.length === 0) {
                        return (
                          <div className="text-center py-12 text-slate-400 border border-dashed border-slate-800/80 rounded-xl p-8">
                            <p className="text-slate-300 font-medium">ไม่พบข้อมูลนักเรียนในห้อง {targetClassName}</p>
                          </div>
                        );
                      }

                      return (
                        <table className="w-full text-left text-sm text-slate-300">
                          <thead className="bg-[#0b0f19] border-b border-slate-800/80">
                            <tr>
                              <th className="px-4 py-3 font-bold text-slate-200">เลขที่ (No.)</th>
                              <th className="px-4 py-3 font-bold text-slate-200">รหัสนักเรียน</th>
                              <th className="px-4 py-3 font-bold text-slate-200">ชื่อ - นามสกุล</th>
                              <th className="px-4 py-3 font-bold text-center text-slate-200">ก่อนกลางภาค<br/><span className="text-[10px] text-slate-400 font-normal">Max {setting.preMidterm}</span></th>
                              <th className="px-4 py-3 font-bold text-center text-slate-200">กลางภาค<br/><span className="text-[10px] text-slate-400 font-normal">Max {setting.midterm}</span></th>
                              <th className="px-4 py-3 font-bold text-center text-slate-200">หลังกลางภาค<br/><span className="text-[10px] text-slate-400 font-normal">Max {setting.postMidterm}</span></th>
                              <th className="px-4 py-3 font-bold text-center text-slate-200">ปลายภาค<br/><span className="text-[10px] text-slate-400 font-normal">Max {setting.final}</span></th>
                              <th className="px-4 py-3 font-bold text-center text-blue-400">รวม (Total)</th>
                              <th className="px-4 py-3 font-bold text-center text-emerald-400">เกรด (Grade)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/80">
                            {gradebookStudents.map((student, idx) => {
                              const studentId = student.studentId || student.id;
                              const studentNumber = student.studentNumber ?? student.studentNo ?? student.number ?? (idx + 1);
                              const studentName = student.fullName || student.name || `นักเรียน ${studentId}`;

                              const score = studentScores.find(s => s.courseId === selectedGradebookCourseId && s.studentId === studentId) || {
                                preMidterm: 0, midterm: 0, postMidterm: 0, final: 0, total: 0, grade: '0'
                              };

                              const calculateGrade = (total: number) => {
                                if (total >= 80) return '4';
                                if (total >= 75) return '3.5';
                                if (total >= 70) return '3';
                                if (total >= 65) return '2.5';
                                if (total >= 60) return '2';
                                if (total >= 55) return '1.5';
                                if (total >= 50) return '1';
                                return '0';
                              };

                              const handleScoreChange = (field: 'preMidterm'|'midterm'|'postMidterm'|'final', valStr: string) => {
                                let val = parseInt(valStr, 10);
                                if (isNaN(val)) val = 0;
                                // Bounds checking
                                if (field === 'preMidterm' && val > setting.preMidterm) val = setting.preMidterm;
                                if (field === 'midterm' && val > setting.midterm) val = setting.midterm;
                                if (field === 'postMidterm' && val > setting.postMidterm) val = setting.postMidterm;
                                if (field === 'final' && val > setting.final) val = setting.final;
                                if (val < 0) val = 0;

                                const newScores = { ...score, [field]: val };
                                const total = newScores.preMidterm + newScores.midterm + newScores.postMidterm + newScores.final;
                                const grade = calculateGrade(total);

                                updateStudentScore(selectedGradebookCourseId, studentId, { ...newScores, total, grade });

                                // Persist to Firestore under composite ID: SCORE_${courseCode}_${className}_${studentId}_${term}
                                saveGradebookScore({
                                  courseCode,
                                  className: targetClassName,
                                  studentId,
                                  term,
                                  preMidterm: newScores.preMidterm,
                                  midterm: newScores.midterm,
                                  postMidterm: newScores.postMidterm,
                                  final: newScores.final,
                                  total,
                                  grade
                                });
                              };

                              return (
                                <tr key={student.id || studentId} className="hover:bg-slate-800/40 transition-colors">
                                  <td className="px-4 py-2 font-mono text-xs">{studentNumber}</td>
                                  <td className="px-4 py-2 font-mono text-xs">{studentId}</td>
                                  <td className="px-4 py-2 text-xs font-medium text-white">{studentName}</td>
                                  <td className="px-4 py-2 text-center">
                                    <input type="number" min="0" max={setting.preMidterm} value={score.preMidterm || ''} onChange={(e) => handleScoreChange('preMidterm', e.target.value)} className="w-16 bg-[#0b0f19] border border-slate-800/80 text-white rounded px-2 py-1 text-center font-mono text-xs focus:border-emerald-500 outline-none" />
                                  </td>
                                  <td className="px-4 py-2 text-center">
                                    <input type="number" min="0" max={setting.midterm} value={score.midterm || ''} onChange={(e) => handleScoreChange('midterm', e.target.value)} className="w-16 bg-[#0b0f19] border border-slate-800/80 text-white rounded px-2 py-1 text-center font-mono text-xs focus:border-emerald-500 outline-none" />
                                  </td>
                                  <td className="px-4 py-2 text-center">
                                    <input type="number" min="0" max={setting.postMidterm} value={score.postMidterm || ''} onChange={(e) => handleScoreChange('postMidterm', e.target.value)} className="w-16 bg-[#0b0f19] border border-slate-800/80 text-white rounded px-2 py-1 text-center font-mono text-xs focus:border-emerald-500 outline-none" />
                                  </td>
                                  <td className="px-4 py-2 text-center">
                                    <input type="number" min="0" max={setting.final} value={score.final || ''} onChange={(e) => handleScoreChange('final', e.target.value)} className="w-16 bg-[#0b0f19] border border-slate-800/80 text-white rounded px-2 py-1 text-center font-mono text-xs focus:border-emerald-500 outline-none" />
                                  </td>
                                  <td className="px-4 py-2 text-center font-bold text-blue-400 font-mono text-sm">{score.total}</td>
                                  <td className="px-4 py-2 text-center font-bold text-emerald-400 font-mono text-sm">{score.grade}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

            {myCourses.length === 0 && (
              <div className="text-center py-20 border border-dashed border-white/10 rounded-2xl bg-[#151921]">
                <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-slate-300 mb-2">ยังไม่มีรายวิชาที่สอน</h3>
                <p className="text-slate-500 mb-6">รอผู้ดูแลระบบเพิ่มรายวิชาที่คุณรับผิดชอบ</p>
              </div>
            )}
          </div>

          {/* Score Setting Modal */}
          {showScoreSettingModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in">
              <div className="bg-[#151921] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold text-white">ตั้งค่าสัดส่วนคะแนน</h3>
                  <button onClick={() => setShowScoreSettingModal(false)} className="text-slate-400 hover:text-white transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">ก่อนกลางภาค (Pre-Midterm)</label>
                    <input type="number" min="0" max="100" value={scoreSettingForm.preMidterm} onChange={(e) => setScoreSettingForm({...scoreSettingForm, preMidterm: parseInt(e.target.value) || 0})} className="w-full bg-[#0b0d14] border border-white/10 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">กลางภาค (Midterm)</label>
                    <input type="number" min="0" max="100" value={scoreSettingForm.midterm} onChange={(e) => setScoreSettingForm({...scoreSettingForm, midterm: parseInt(e.target.value) || 0})} className="w-full bg-[#0b0d14] border border-white/10 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">หลังกลางภาค (Post-Midterm)</label>
                    <input type="number" min="0" max="100" value={scoreSettingForm.postMidterm} onChange={(e) => setScoreSettingForm({...scoreSettingForm, postMidterm: parseInt(e.target.value) || 0})} className="w-full bg-[#0b0d14] border border-white/10 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">ปลายภาค (Final)</label>
                    <input type="number" min="0" max="100" value={scoreSettingForm.final} onChange={(e) => setScoreSettingForm({...scoreSettingForm, final: parseInt(e.target.value) || 0})} className="w-full bg-[#0b0d14] border border-white/10 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none" />
                  </div>
                </div>

                <div className="mt-4 flex justify-between items-center text-sm font-bold bg-white/5 p-3 rounded-lg">
                  <span className="text-slate-300">ผลรวม:</span>
                  <span className={scoreSettingForm.preMidterm + scoreSettingForm.midterm + scoreSettingForm.postMidterm + scoreSettingForm.final === 100 ? "text-emerald-400" : "text-rose-400"}>
                    {scoreSettingForm.preMidterm + scoreSettingForm.midterm + scoreSettingForm.postMidterm + scoreSettingForm.final} / 100
                  </span>
                </div>

                {scoreSettingError && (
                  <div className="mt-3 text-rose-400 text-xs font-bold bg-rose-500/10 p-2 rounded border border-rose-500/20">
                    {scoreSettingError}
                  </div>
                )}

                <div className="mt-4">
                  {!isCopyMode ? (
                    <button 
                      onClick={() => setIsCopyMode(true)}
                      className="text-xs text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 transition-colors"
                    >
                      📋 คัดลอกสัดส่วนคะแนนไปยังห้องอื่น
                    </button>
                  ) : (
                    <div className="bg-[#0b0d14] border border-white/10 rounded-lg p-3">
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-xs font-bold text-slate-300">เลือกห้องเรียนที่ต้องการคัดลอก</label>
                        <button onClick={() => { setIsCopyMode(false); setCopyTargetCourses([]); }} className="text-[10px] text-slate-500 hover:text-white">ยกเลิก</button>
                      </div>
                      <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                        {myCourses.filter(c => c.id !== selectedGradebookCourseId && c.code === myCourses.find(mc => mc.id === selectedGradebookCourseId)?.code).map(c => (
                          <label key={c.id} className="flex items-center gap-2 p-2 hover:bg-white/5 rounded cursor-pointer">
                            <input 
                              type="checkbox" 
                              className="rounded border-white/20 bg-black text-blue-500 focus:ring-blue-500/50"
                              checked={copyTargetCourses.includes(c.id)}
                              onChange={(e) => {
                                if (e.target.checked) setCopyTargetCourses([...copyTargetCourses, c.id]);
                                else setCopyTargetCourses(copyTargetCourses.filter(id => id !== c.id));
                              }}
                            />
                            <span className="text-xs text-slate-300">{c.code} {c.name} ({c.room})</span>
                          </label>
                        ))}
                        {myCourses.filter(c => c.id !== selectedGradebookCourseId && c.code === myCourses.find(mc => mc.id === selectedGradebookCourseId)?.code).length === 0 && (
                          <div className="text-xs text-slate-500 py-2 text-center">ไม่มีวิชาอื่นที่รหัสเดียวกันให้คัดลอก</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <button 
                  onClick={() => {
                    const total = scoreSettingForm.preMidterm + scoreSettingForm.midterm + scoreSettingForm.postMidterm + scoreSettingForm.final;
                    if (total !== 100) {
                      setScoreSettingError('สัดส่วนคะแนนรวมต้องเท่ากับ 100 พอดี');
                      return;
                    }
                    if (selectedGradebookCourseId) {
                      updateCourseScoreSetting({
                        courseId: selectedGradebookCourseId,
                        maxPreMidterm: scoreSettingForm.preMidterm,
                        maxMidterm: scoreSettingForm.midterm,
                        maxPostMidterm: scoreSettingForm.postMidterm,
                        maxFinal: scoreSettingForm.final
                      });

                      if (isCopyMode) {
                        copyTargetCourses.forEach(id => {
                          updateCourseScoreSetting({
                            courseId: id,
                            maxPreMidterm: scoreSettingForm.preMidterm,
                            maxMidterm: scoreSettingForm.midterm,
                            maxPostMidterm: scoreSettingForm.postMidterm,
                            maxFinal: scoreSettingForm.final
                          });
                        });
                      }
                    }
                    setShowScoreSettingModal(false);
                    setIsCopyMode(false);
                    setCopyTargetCourses([]);
                  }}
                  className="w-full mt-6 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  disabled={scoreSettingForm.preMidterm + scoreSettingForm.midterm + scoreSettingForm.postMidterm + scoreSettingForm.final !== 100}
                >
                  {isCopyMode && copyTargetCourses.length > 0 ? `บันทึกและคัดลอก (${copyTargetCourses.length} ห้อง)` : 'บันทึกการตั้งค่า'}
                </button>
              </div>
            </div>
          )}

        </main>
      ) : (
        <div className="flex flex-1 min-h-0 animate-in fade-in duration-300">
          
          {/* Sidebar: Early Warning Hub */}
          <aside className="w-72 border-r border-white/10 bg-[#0d0f17] flex flex-col shrink-0 overflow-y-auto">
            
            <div className="p-4 border-b border-white/10 flex items-center justify-between sticky top-0 bg-[#0d0f17] z-10">
              <button 
                onClick={() => setView('dashboard')}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-green-400 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> กลับหน้าหลัก
              </button>
            </div>

            <div className="p-4 border-b border-white/10 bg-red-500/10">
              <h2 className="text-xs font-bold uppercase tracking-widest text-red-400 mb-3">Early Warning Hub (วิกฤต)</h2>
              <div className="space-y-2">
                {criticalStudents.length === 0 ? (
                  <div className="text-xs text-slate-500">ไม่มีนักเรียนในกลุ่มวิกฤต</div>
                ) : criticalStudents.map(a => {
                  const student = students.find(s => s.studentId === a.studentId);
                  return (
                    <div key={student?.id} className="p-3 bg-red-950/40 border border-red-500/50 rounded-lg shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-sm font-bold">{student?.name}</span>
                        <span className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded font-mono">{a.subjectAttendanceRate}%</span>
                      </div>
                      <p className="text-[11px] text-red-300">ความเสี่ยงสูงเวลาเรียนไม่พอ</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-4 flex-1 overflow-hidden">
              <h2 className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-3">แจ้งเตือนระดับเฝ้าระวัง</h2>
              <div className="space-y-2">
                {warningStudents.length === 0 ? (
                  <div className="text-xs text-slate-500">ไม่มีนักเรียนในกลุ่มเฝ้าระวัง</div>
                ) : warningStudents.map(a => {
                  const student = students.find(s => s.studentId === a.studentId);
                  return (
                    <div key={student?.id} className="p-3 bg-amber-950/30 border border-amber-500/40 rounded-lg">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-sm">{student?.name}</span>
                        <span className="text-xs font-mono text-amber-400">{a.subjectAttendanceRate}%</span>
                      </div>
                      <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                        <div className="bg-amber-500 h-full" style={{ width: `${a.subjectAttendanceRate}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-4 bg-slate-900/50 border-t border-white/10">
              <div className="text-xs text-slate-500 mb-2">สถิติรวมห้องเรียน {activeCourse?.room}</div>
              <div className="flex items-end gap-2">
                <span className="text-2xl font-bold text-green-400">{avgAttendance}%</span>
                <span className="text-xs text-slate-400 pb-1">ค่าเฉลี่ยการเข้าเรียน</span>
              </div>
            </div>

          </aside>

          {/* Main Content */}
          <main className="flex-1 flex flex-col bg-[#0b0d14]">
            
            {/* Top Bar / Period Selector */}
            <section className="p-4 bg-[#151921] border-b border-white/10 flex items-center justify-between shadow-sm shrink-0">
              <div className="flex items-center gap-4">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-white">{activeCourse?.name} ({activeCourse?.room})</span>
                  <span className="text-xs text-slate-400 font-mono">{activeCourse?.code} - {currentPeriod}</span>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button 
                  onClick={handleRandomSelect}
                  disabled={isShuffling || courseStudents.length === 0}
                  className="px-4 py-1.5 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors shadow-lg shadow-yellow-600/20 flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  สุ่มรายชื่อ (Random Student)
                </button>
                <button 
                  onClick={() => activeCourse && handleAttendanceDone(activeCourse.id)}
                  disabled={isSavingAttendance}
                  className="px-4 py-1.5 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-500 disabled:opacity-50 transition-colors shadow-lg shadow-green-600/20 flex items-center gap-1.5"
                >
                  {isSavingAttendance ? (
                    <>
                      <Clock className="w-3.5 h-3.5 animate-spin" />
                      กำลังบันทึกข้อมูล...
                    </>
                  ) : (
                    'บันทึกการเช็คชื่อทั้งหมด'
                  )}
                </button>
              </div>
            </section>

            {/* Flexible Drag-and-Drop Seating Area */}
            <div className="flex-1 flex overflow-hidden flex-col">
              {/* Homeroom Co-advisor Locking Banner inside Teacher Portal */}
              {isHrActive && hrRecord && hrRecord.isLocked && (
                <div className="mx-6 mt-6 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-in fade-in duration-200 shrink-0">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                    <div>
                      <p className="font-bold text-sm text-white">เช็กชื่อโฮมรูมแล้ว โดย {hrRecord.checkedByName} เวลา {hrRecord.checkedAt} น.</p>
                      <p className="text-xs text-slate-400 font-medium">ข้อมูลการเช็กชื่อถูกล็อคตามเงื่อนไขของระบบครูสอนร่วมประจำชั้นเพื่อความสอดคล้อง</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => hrRequestUnlock()}
                    className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold text-xs rounded-lg transition-colors shrink-0"
                  >
                    ขอแก้ไขข้อมูล
                  </button>
                </div>
              )}
              {isHrActive && hrRecord && !hrRecord.isLocked && (
                <div className="mx-6 mt-6 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-in fade-in duration-200 shrink-0">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div>
                      <p className="font-bold text-sm text-white">ปลดล็อคโดย {hrRecord.requestedEditBy?.split('@')[0]} (แก้ไขได้แล้ว)</p>
                      <p className="text-xs text-slate-400 font-medium">คุณครูสามารถคลิกสัญลักษณ์สถานะด้านล่างบนบัตรนักเรียนแต่ละคนเพื่อเช็กชื่อใหม่ และกดบันทึก</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Seating Grid Container */}
              <div className="flex-1 p-6 overflow-auto bg-[#0b0d14]">
                <div className="flex flex-col gap-5 min-w-[1400px]">
                  {Array.from({ length: layout.totalRows }).map((_, rIndex) => {
                    const r = rIndex + 1;
                    return (
                      <div key={r} className="flex gap-4 justify-center items-stretch">
                        {Array.from({ length: layout.totalCols }).map((_, cIndex) => {
                          const c = cIndex + 1;
                          const seatIndex = (r - 1) * layout.totalCols + (c - 1);
                          const student = courseStudents.find(s => s.seatIndex === seatIndex);
                          
                          return (
                            <React.Fragment key={c}>
                              <div 
                                className={cn(
                                  "w-[180px] rounded-xl transition-all duration-200 border-2",
                                  student ? "border-transparent" : "border-dashed border-white/10 bg-white/5 min-h-[160px] flex items-center justify-center"
                                )}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  const studentId = e.dataTransfer.getData('studentId');
                                  if (studentId) moveStudentSeat(studentId, seatIndex);
                                }}
                              >
                                {student ? (
                                  <div
                                    draggable
                                    onDragStart={(e) => e.dataTransfer.setData('studentId', student.studentId)}
                                    className="cursor-move h-full w-full text-left"
                                  >
                                    {(() => {
                                      const status = attendanceRecords[activeCourse.id]?.[student.studentId] || 'UNMARKED';
                                      const studentAnalytics = analytics.find(a => a.studentId === student.studentId);
                                      const bScore = studentAnalytics?.behaviorScore ?? 100;
                                      
                                      let borderClass = "border-white/10 border-l-slate-500";
                                      let shadowClass = "";
                                      if (status === 'PRESENT') { borderClass = "border-white/10 border-l-green-500"; shadowClass = ""; }
                                      else if (status === 'LATE') { borderClass = "border-white/10 border-l-amber-500"; shadowClass = "shadow-[0_0_15px_rgba(245,158,11,0.05)]"; }
                                      else if (status === 'LEAVE') { borderClass = "border-white/10 border-l-blue-500"; shadowClass = ""; }
                                      else if (status === 'ABSENT') { borderClass = "border-white/10 border-l-red-500"; shadowClass = "shadow-[0_0_15px_rgba(239,68,68,0.1)]"; }

                                      const isGlow = shufflingStudentIds.includes(student.studentId);
                                      return (
                                        <div 
                                          onClick={() => {
                                            setSelectedStudentForScore(student);
                                          }}
                                          className={cn(
                                            "bg-[#1c1f2b] rounded-xl p-3 flex flex-col gap-2 relative overflow-hidden group border-l-4 border-y border-r transition-all duration-200 h-full w-full hover:border-r-green-500/30 hover:border-y-green-500/30 cursor-pointer",
                                            borderClass, shadowClass,
                                            isGlow ? "ring-4 ring-yellow-400 animate-pulse scale-105 border-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.5)] z-10" : ""
                                          )}
                                        >
                                          <div className="flex justify-between items-start">
                                            <img 
                                              src={student.avatar} 
                                              alt={student.name}
                                              draggable={false}
                                              className={cn(
                                                "w-10 h-10 rounded-full border-2 bg-slate-700 transition-colors",
                                                status === 'PRESENT' ? 'border-green-500' :
                                                status === 'LATE' ? 'border-amber-500' :
                                                status === 'LEAVE' ? 'border-blue-500' :
                                                status === 'ABSENT' ? 'border-red-500' :
                                                'border-slate-500'
                                              )}
                                            />
                                            <div className="text-right">
                                              <div className="text-[10px] text-slate-400 font-mono">#{student.studentId}</div>
                                            </div>
                                          </div>
                                          
                                          <div>
                                            <h3 className={cn("font-bold text-xs transition-colors line-clamp-1", 
                                              status === 'ABSENT' ? 'text-red-400' : 'text-slate-200'
                                            )} title={student.name}>{student.name}</h3>
                                            
                                            <div className="flex items-center justify-between mt-1">
                                              <p className="text-[10px] text-slate-400 flex items-center gap-0.5">
                                                คะแนน: 
                                                <span className={cn(
                                                  "font-medium",
                                                  bScore > 100 ? "text-green-400" :
                                                  bScore < 80 ? "text-red-400" : "text-slate-200"
                                                )}>
                                                  {bScore >= 100 ? `+${bScore - 100}` : bScore - 100}
                                                </span>
                                              </p>
                                              
                                              <div className="flex items-center">
                                                <button 
                                                  onClick={(e) => { e.stopPropagation(); adjustBehaviorScore(student.studentId, -5); }}
                                                  className="w-4 h-4 flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                                  title="หักคะแนนพฤติกรรม"
                                                >
                                                  <Minus className="w-3 h-3" />
                                                </button>
                                                <button 
                                                  onClick={(e) => { e.stopPropagation(); adjustBehaviorScore(student.studentId, 5); }}
                                                  className="w-4 h-4 flex items-center justify-center text-slate-500 hover:text-green-400 hover:bg-green-500/10 rounded transition-colors"
                                                  title="เพิ่มคะแนนพฤติกรรม"
                                                >
                                                  <Plus className="w-3 h-3" />
                                                </button>
                                              </div>
                                            </div>
                                          </div>
                                          
                                          <div className="grid grid-cols-2 gap-1 mt-auto">
                                            <button 
                                              onClick={(e) => { 
                                                if (isHrActive && hrRecord?.isLocked) return;
                                                e.stopPropagation(); 
                                                setAttendanceStatus(activeCourse.id, student.studentId, 'PRESENT'); 
                                              }}
                                              disabled={isHrActive && hrRecord?.isLocked}
                                              className={cn("py-1 text-[10px] rounded font-bold transition-colors", 
                                                status === 'PRESENT' ? 'bg-green-500 text-white' : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10',
                                                (isHrActive && hrRecord?.isLocked) ? "opacity-50 cursor-not-allowed" : ""
                                              )}>มา</button>
                                            <button 
                                              onClick={(e) => { 
                                                if (isHrActive && hrRecord?.isLocked) return;
                                                e.stopPropagation(); 
                                                setAttendanceStatus(activeCourse.id, student.studentId, 'LATE'); 
                                              }}
                                              disabled={isHrActive && hrRecord?.isLocked}
                                              className={cn("py-1 text-[10px] rounded font-bold transition-colors", 
                                                status === 'LATE' ? 'bg-amber-500 text-white' : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10',
                                                (isHrActive && hrRecord?.isLocked) ? "opacity-50 cursor-not-allowed" : ""
                                              )}>สาย</button>
                                            <button 
                                              onClick={(e) => { 
                                                if (isHrActive && hrRecord?.isLocked) return;
                                                e.stopPropagation(); 
                                                setAttendanceStatus(activeCourse.id, student.studentId, 'LEAVE'); 
                                              }}
                                              disabled={isHrActive && hrRecord?.isLocked}
                                              className={cn("py-1 text-[10px] rounded font-bold transition-colors", 
                                                status === 'LEAVE' ? 'bg-blue-500 text-white' : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10',
                                                (isHrActive && hrRecord?.isLocked) ? "opacity-50 cursor-not-allowed" : ""
                                              )}>ลา</button>
                                            <button 
                                              onClick={(e) => { 
                                                if (isHrActive && hrRecord?.isLocked) return;
                                                e.stopPropagation(); 
                                                setAttendanceStatus(activeCourse.id, student.studentId, 'ABSENT'); 
                                              }}
                                              disabled={isHrActive && hrRecord?.isLocked}
                                              className={cn("py-1 text-[10px] rounded font-bold transition-colors", 
                                                status === 'ABSENT' ? 'bg-red-500 text-white' : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10',
                                                (isHrActive && hrRecord?.isLocked) ? "opacity-50 cursor-not-allowed" : ""
                                              )}>ขาด</button>
                                          </div>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                ) : (
                                  <div className="text-white/20 text-[10px] font-bold uppercase tracking-widest text-center select-none">
                                    โต๊ะว่าง
                                  </div>
                                )}
                              </div>
                              {layout.aisleAfterCols.includes(c) && (
                                <div className="w-8 shrink-0 flex items-center justify-center border-l border-r border-dashed border-white/5 bg-slate-900/10 rounded-md">
                                  <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest select-none text-center" style={{ writingMode: 'vertical-lr' }}>ทางเดิน</span>
                                </div>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Unassigned Students Sidebar */}
              <aside 
                className="w-64 border-l border-white/10 bg-[#0d0f17] flex flex-col shrink-0"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const studentId = e.dataTransfer.getData('studentId');
                  if (studentId) moveStudentSeat(studentId, null);
                }}
              >
                <div className="p-4 border-b border-white/10 bg-slate-900/50">
                  <h2 className="text-sm font-bold text-slate-300">นักเรียนที่ยังไม่มีที่นั่ง</h2>
                  <div className="text-[10px] text-slate-500 mt-1">ลากและวางการ์ดเพื่อจัดที่นั่ง</div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 text-left">
                  {unassignedStudents.map(student => (
                    <div
                      key={student.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('studentId', student.studentId)}
                      className="bg-[#1c1f2b] p-3 rounded-lg border border-white/10 cursor-move shadow-md hover:border-green-500/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <img src={student.avatar} draggable={false} className="w-10 h-10 rounded-full border border-slate-700 bg-slate-800" alt={student.name} />
                        <div>
                          <div className="font-bold text-xs text-slate-200 line-clamp-1">{student.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">#{student.studentId}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {unassignedStudents.length === 0 && (
                    <div className="text-center py-10 text-xs text-slate-500">
                      นักเรียนมีที่นั่งครบทุกคนแล้ว
                    </div>
                  )}
                </div>
              </aside>
            </div>

          </main>
        </div>
      )}
        </motion.div>
      </AnimatePresence>

      {/* Behavior Scoring Popup Modal */}
      {selectedStudentForScore && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-[#151921] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            <div className="p-5 border-b border-white/10 flex justify-between items-center bg-slate-900/50">
              <div className="flex items-center gap-3">
                <img 
                  src={selectedStudentForScore.avatar} 
                  alt={selectedStudentForScore.name}
                  className="w-10 h-10 rounded-full border border-white/15 bg-slate-800"
                />
                <div>
                  <h2 className="text-sm font-bold text-white">{selectedStudentForScore.name}</h2>
                  <p className="text-[10px] text-slate-400">เลขประจำตัว: #{selectedStudentForScore.studentId}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedStudentForScore(null)} 
                className="text-slate-400 hover:text-white transition-colors p-1 rounded-full hover:bg-white/5"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              <div>
                <div className="text-xs text-slate-400 mb-2 font-bold uppercase tracking-wider">คะแนนพฤติกรรมปัจจุบัน</div>
                <div className="bg-black/30 px-4 py-3 rounded-xl border border-white/5 flex justify-between items-center">
                  <span className="text-xs text-slate-400">ระดับคะแนนพฤติกรรมสะสม:</span>
                  <span className={cn(
                    "text-lg font-mono font-bold",
                    (analytics.find(a => a.studentId === selectedStudentForScore.studentId)?.behaviorScore ?? 100) >= 100 ? "text-green-400" : "text-red-400"
                  )}>
                    {analytics.find(a => a.studentId === selectedStudentForScore.studentId)?.behaviorScore ?? 100} คะแนน
                  </span>
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-400 mb-2.5 font-bold uppercase tracking-wider">ปรับปรุงคะแนนด่วน (Presets)</div>
                <div className="grid grid-cols-3 gap-2">
                  <button 
                    onClick={() => {
                      adjustBehaviorScore(selectedStudentForScore.studentId, 5);
                      setSelectedStudentForScore(null);
                    }}
                    className="py-2.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> 5 คะแนน
                  </button>
                  <button 
                    onClick={() => {
                      adjustBehaviorScore(selectedStudentForScore.studentId, 10);
                      setSelectedStudentForScore(null);
                    }}
                    className="py-2.5 bg-green-500/15 hover:bg-green-500/25 text-green-300 border border-green-500/30 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> 10 คะแนน
                  </button>
                  <button 
                    onClick={() => {
                      adjustBehaviorScore(selectedStudentForScore.studentId, 1);
                      setSelectedStudentForScore(null);
                    }}
                    className="py-2.5 bg-[#10b981]/10 hover:bg-[#10b981]/20 text-emerald-400 border border-[#10b981]/20 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> 1 คะแนน
                  </button>
                  <button 
                    onClick={() => {
                      adjustBehaviorScore(selectedStudentForScore.studentId, -5);
                      setSelectedStudentForScore(null);
                    }}
                    className="py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1"
                  >
                    <Minus className="w-3.5 h-3.5" /> 5 คะแนน
                  </button>
                  <button 
                    onClick={() => {
                      adjustBehaviorScore(selectedStudentForScore.studentId, -10);
                      setSelectedStudentForScore(null);
                    }}
                    className="py-2.5 bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1"
                  >
                    <Minus className="w-3.5 h-3.5" /> 10 คะแนน
                  </button>
                  <button 
                    onClick={() => {
                      adjustBehaviorScore(selectedStudentForScore.studentId, -1);
                      setSelectedStudentForScore(null);
                    }}
                    className="py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1"
                  >
                    <Minus className="w-3.5 h-3.5" /> 1 คะแนน
                  </button>
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-400 mb-2 font-bold uppercase tracking-wider">บันทึกเหตุผลเพิ่มเติม (เหตุการณ์ในคาบ)</div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {['ตอบคำถามดีเยี่ยม', 'ช่วยแนะนำเพื่อน', 'คุยเสียงดังในห้อง', 'ไม่ส่งงานตามกำหนด'].map(reason => (
                    <button
                      key={reason}
                      onClick={() => {
                        const amt = reason.includes('ดีเยี่ยม') || reason.includes('ช่วยแนะนำ') ? 5 : -5;
                        adjustBehaviorScore(selectedStudentForScore.studentId, amt);
                        setSelectedStudentForScore(null);
                      }}
                      className="p-2 bg-[#1c1f2b] hover:bg-white/5 border border-white/5 text-slate-300 rounded-lg text-[11px] text-left transition-colors truncate"
                    >
                      {reason.includes('ดีเยี่ยม') || reason.includes('ช่วยแนะนำ') ? '🟢 ' : '🔴 '}
                      {reason}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  onClick={() => setSelectedStudentForScore(null)}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold rounded-xl border border-white/10 transition-colors"
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Late Attendance Request Modal */}
      {showLateModal && lateCourse && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-[#161f30] border border-amber-500/30 rounded-xl w-full max-w-md shadow-xl overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-800/80 flex justify-between items-center bg-amber-500/10">
              <h2 className="text-lg font-bold text-amber-400 flex items-center gap-2">
                <Clock className="w-5 h-5" /> ยื่นขอเช็คชื่อย้อนหลัง
              </h2>
              <button onClick={() => setShowLateModal(false)} className="text-amber-400/60 hover:text-amber-400 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleLateSubmit} className="p-6 space-y-4">
              <div className="bg-[#0b0f19] p-4 rounded-lg border border-slate-800/80 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">วิชา:</span>
                  <span className="font-bold text-white">{lateCourse.code} {lateCourse.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">ห้องเรียน:</span>
                  <span className="font-bold text-white">{lateCourse.room}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">คาบเรียน:</span>
                  <span className="font-bold text-amber-400">{PERIODS[lateCourse.periodIndex]}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">เหตุผลที่ขอเช็คชื่อย้อนหลัง</label>
                <textarea 
                  required
                  value={lateReason}
                  onChange={e => setLateReason(e.target.value)}
                  placeholder="โปรดระบุเหตุผลที่ไม่ได้เช็คชื่อในเวลาเรียน..."
                  rows={4}
                  className="w-full bg-[#0b0f19] border border-slate-800/80 rounded-lg p-3 text-sm text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all resize-none"
                />
              </div>

              <div className="pt-2">
                <button 
                  type="submit"
                  disabled={!lateReason}
                  className="w-full bg-[#3b2211] border border-amber-800/60 text-amber-400 hover:bg-[#4a2b16] disabled:opacity-50 font-bold py-3 rounded-xl transition-all shadow-[0_4px_15px_rgba(245,158,11,0.2)]"
                >
                  ส่งคำขอย้อนหลังให้ผู้บริหาร
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Change Request Modal */}
      {showScheduleReqModal && scheduleReqCourse && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-[#161f30] border border-blue-500/30 rounded-xl w-full max-w-md shadow-xl overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-800/80 flex justify-between items-center bg-blue-500/10">
              <h2 className="text-lg font-bold text-blue-400 flex items-center gap-2">
                <Edit3 className="w-5 h-5" /> แจ้งขอแก้ไขตารางสอน
              </h2>
              <button onClick={() => setShowScheduleReqModal(false)} className="text-blue-400/60 hover:text-blue-400 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleScheduleReqSubmit} className="p-6 space-y-4">
              <div className="bg-[#0b0f19] p-4 rounded-lg border border-slate-800/80 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">วิชา:</span>
                  <span className="font-bold text-white">{scheduleReqCourse.code} {scheduleReqCourse.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">ห้องเรียน:</span>
                  <span className="font-bold text-white">{scheduleReqCourse.room}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">ตารางปัจจุบัน:</span>
                  <span className="font-bold text-blue-400">{scheduleReqCourse.schedule || PERIODS[scheduleReqCourse.periodIndex]}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">ข้อความถึงแอดมิน (โปรดระบุคาบที่ต้องการสลับ)</label>
                <textarea 
                  required
                  value={scheduleReqNote}
                  onChange={e => setScheduleReqNote(e.target.value)}
                  placeholder="เช่น ขอสลับวิชา ค21101 ม.1/1 จาก พฤ5 ไปเป็น อ2 สัปดาห์นี้"
                  rows={4}
                  className="w-full bg-[#0b0f19] border border-slate-800/80 rounded-lg p-3 text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all resize-none"
                />
              </div>

              <div className="pt-2">
                <button 
                  type="submit"
                  disabled={!scheduleReqNote}
                  className="w-full bg-[#1b2a4a] hover:bg-[#23365d] border border-blue-900/50 text-blue-400 disabled:opacity-50 font-bold py-3 rounded-xl transition-all"
                >
                  ส่งคำร้องให้ผู้ดูแลระบบ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Schedule Config Simulation Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-[#161f30] border border-slate-800/80 rounded-xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-800/80 flex justify-between items-center bg-[#0b0f19]">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Settings className="w-4 h-4 text-slate-400" /> Time Simulation (Admin Config)
              </h2>
              <button onClick={() => setShowConfigModal(false)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-3">จำลองเวลาปัจจุบัน</label>
                <input 
                  type="time" 
                  value={formatTime(currentDate)}
                  onChange={(e) => {
                    const [hours, minutes] = e.target.value.split(':').map(Number);
                    const newDate = new Date(currentDate);
                    newDate.setHours(hours, minutes, 0, 0);
                    setCurrentDate(newDate);
                  }}
                  className="w-full bg-[#0b0f19] border border-slate-800/80 rounded-lg p-2.5 text-sm text-white focus:border-emerald-500 outline-none transition-all font-mono"
                />
              </div>

              <div>
                <label className="flex items-center justify-between mb-3">
                  <span className="text-sm font-bold text-slate-300">จำลองวันกิจกรรม (ลดคาบเรียน)</span>
                  <input 
                    type="checkbox" 
                    checked={scheduleConfig.isActivityDay}
                    onChange={(e) => setScheduleConfig({ ...scheduleConfig, isActivityDay: e.target.checked, shortenMinutes: e.target.checked ? 5 : 0 })}
                    className="w-4 h-4 rounded border-slate-800 bg-[#0b0f19] text-emerald-500 focus:ring-emerald-500"
                  />
                </label>
                
                {scheduleConfig.isActivityDay && (
                  <div className="pl-4 border-l-2 border-amber-500/50 space-y-2 mt-2">
                    <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
                      <input 
                        type="radio" 
                        name="shorten" 
                        checked={scheduleConfig.shortenMinutes === 5}
                        onChange={() => setScheduleConfig({ ...scheduleConfig, shortenMinutes: 5 })}
                      /> ลดคาบละ 5 นาที
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
                      <input 
                        type="radio" 
                        name="shorten" 
                        checked={scheduleConfig.shortenMinutes === 10}
                        onChange={() => setScheduleConfig({ ...scheduleConfig, shortenMinutes: 10 })}
                      /> ลดคาบละ 10 นาที
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Post-Teaching Record Entry Modal with Midnight Deadline Lock */}
      {showPostTeachingModal && postTeachingCourse && (() => {
        const isMidnightLocked = (() => {
          if (!ptDate) return false;
          try {
            const selectedDateParts = ptDate.split('-').map(Number);
            const selectedMidnight = new Date(selectedDateParts[0], selectedDateParts[1] - 1, selectedDateParts[2], 23, 59, 59, 999);
            return isAfter(currentDate, selectedMidnight);
          } catch (err) {
            return false;
          }
        })();

        return (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
            <div className="bg-[#161f30] border border-slate-800/80 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
              
              {/* Header */}
              <div className="p-5 border-b border-slate-800/80 flex justify-between items-center bg-[#0b0f19]">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">บันทึกหลังสอนรายวัน (Post-Teaching Record)</h2>
                    <p className="text-xs text-slate-400">{postTeachingCourse.code} {postTeachingCourse.name} ({postTeachingCourse.room})</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setShowPostTeachingModal(false);
                    setPostTeachingCourse(null);
                  }} 
                  className="text-slate-400 hover:text-white transition-colors p-1 rounded-full hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content / Form */}
              <form onSubmit={handlePostTeachingSubmit} className="p-6 space-y-4">
                
                {/* Teaching Date Selection & Status Indicator */}
                <div className="bg-[#0b0f19] border border-slate-800/80 p-4 rounded-xl space-y-3">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">วันที่ทำการสอน (Teaching Date)</label>
                      <input 
                        type="date"
                        value={ptDate}
                        onChange={(e) => setPtDate(e.target.value)}
                        className="bg-[#161f30] border border-slate-800/80 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:border-emerald-500 outline-none"
                      />
                    </div>
                    <div className="text-left sm:text-right">
                      <div className="text-[10px] text-slate-400 font-medium">เวลาจำลอง (Simulated Time):</div>
                      <div className="text-xs font-mono text-slate-200 font-bold">{format(currentDate, 'dd MMM yyyy HH:mm', { locale: th })} น.</div>
                    </div>
                  </div>

                  <div className="border-t border-slate-800/80 pt-3 flex items-center justify-between">
                    <span className="text-xs text-slate-400">เส้นตายการส่ง (Midnight Deadline):</span>
                    <span className="text-xs font-mono text-slate-300 font-bold">23:59 น. ของวันที่ระบุ</span>
                  </div>

                  {/* Lock Status Message */}
                  {isMidnightLocked ? (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-3 py-2.5 rounded-lg flex items-start gap-2.5 text-xs">
                      <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">ระบบปิดรับบันทึกหลังสอนสำหรับวันนี้แล้ว (LOCKED)</p>
                        <p className="text-slate-400 mt-0.5 text-[11px] leading-relaxed">ไม่อนุญาตให้ส่งหรือแก้ไขเนื่องจากเลยกำหนดเส้นตายเวลาเที่ยงคืน (Midnight Deadline Lock) หากจำเป็นต้องลงบันทึกหลังจากปิดระบบ โปรดติดต่อฝ่ายวิชาการเพื่อทำเรื่องขออนุมัติปลดล็อค</p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-2 rounded-lg flex items-center gap-2 text-xs">
                      <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                      <div>
                        <p className="font-bold">ระบบเปิดรับบันทึกตามปกติ (ACTIVE)</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Form Input fields */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">1. สรุปผลการสอน (Summary) <span className="text-red-500">*</span></label>
                    <textarea
                      required
                      disabled={isMidnightLocked}
                      value={ptSummary}
                      onChange={(e) => setPtSummary(e.target.value)}
                      placeholder="เช่น นักเรียนเข้าใจเนื้อหาเป็นอย่างดี มีการทดลองตามเป้าหมายและทำใบงานเสร็จสิ้น"
                      rows={2}
                      className="w-full bg-[#0b0f19] border border-slate-800/80 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:border-emerald-500 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">2. ปัญหาและอุปสรรคที่พบ (Problems)</label>
                    <textarea
                      disabled={isMidnightLocked}
                      value={ptProblems}
                      onChange={(e) => setPtProblems(e.target.value)}
                      placeholder="เช่น นักเรียนบางกลุ่มเริ่มทดลองช้าเนื่องจากลืมสมุดแล็บ"
                      rows={2}
                      className="w-full bg-[#0b0f19] border border-slate-800/80 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:border-emerald-500 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">3. แนวทางแก้ไขและพัฒนา (Solutions)</label>
                    <textarea
                      disabled={isMidnightLocked}
                      value={ptSolutions}
                      onChange={(e) => setPtSolutions(e.target.value)}
                      placeholder="เช่น ให้เพื่อนกลุ่มอื่นแชร์ภาพแล็บและกำชับให้เช็คอุปกรณ์ล่วงหน้า"
                      rows={2}
                      className="w-full bg-[#0b0f19] border border-slate-800/80 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:border-emerald-500 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-3 pt-3 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPostTeachingModal(false);
                      setPostTeachingCourse(null);
                    }}
                    className="px-4 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all"
                  >
                    ยกเลิก (Cancel)
                  </button>
                  <button
                    type="submit"
                    disabled={isMidnightLocked}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-red-500/20 disabled:text-red-400 border border-transparent disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-600/10"
                  >
                    {isMidnightLocked ? (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5 text-red-400" /> ล็อคระบบแล้ว
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-3.5 h-3.5" /> บันทึกข้อมูลหลังสอน
                      </>
                    )}
                  </button>
                </div>

              </form>
            </div>
          </div>
        );
      })()}

      {/* View Post-Teaching Record Summary Modal */}
      {viewingRecord && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-[#161f30] border border-slate-800/80 rounded-xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-800/80 flex justify-between items-center bg-[#0b0f19]">
              <div className="flex items-center gap-2 text-emerald-400">
                <FileText className="w-5 h-5" />
                <h3 className="text-sm font-bold text-white">รายละเอียดบันทึกหลังสอน</h3>
              </div>
              <button 
                onClick={() => setViewingRecord(null)} 
                className="text-slate-400 hover:text-white transition-colors p-1 rounded-full hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="flex items-center justify-between bg-[#0b0f19] p-3 rounded-lg border border-slate-800/80 font-mono">
                <span className="text-slate-400">วันที่ทำการสอน:</span>
                <span className="text-white font-bold">{viewingRecord.date}</span>
              </div>

              <div className="space-y-1">
                <div className="text-slate-400 font-bold">📝 สรุปผลการสอน (Summary):</div>
                <div className="bg-[#0b0f19] p-3 rounded-xl border border-slate-800/80 text-slate-200 min-h-[50px] whitespace-pre-wrap leading-relaxed">
                  {viewingRecord.summary}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-amber-400 font-bold">⚠️ ปัญหาและอุปสรรค (Problems):</div>
                <div className="bg-[#0b0f19] p-3 rounded-xl border border-slate-800/80 text-slate-200 min-h-[50px] whitespace-pre-wrap leading-relaxed">
                  {viewingRecord.problems || 'ไม่มี'}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-emerald-400 font-bold">💡 แนวทางแก้ไข/พัฒนา (Solutions):</div>
                <div className="bg-[#0b0f19] p-3 rounded-xl border border-slate-800/80 text-slate-200 min-h-[50px] whitespace-pre-wrap leading-relaxed">
                  {viewingRecord.solutions || 'ไม่มี'}
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-500 pt-3 border-t border-slate-800/80 font-mono">
                <span>วันเวลาที่บันทึก: {new Date(viewingRecord.submittedAt).toLocaleString('th-TH')}</span>
                {viewingRecord.isLate && <span className="text-amber-500 font-bold">⚠️ ส่งล่าช้า</span>}
              </div>

              <div className="flex justify-end pt-2">
                <button 
                  onClick={() => setViewingRecord(null)}
                  className="px-4 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-all"
                >
                  ปิด (Close)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="h-8 bg-[#0b0f19] border-t border-slate-800/80 flex items-center justify-between px-4 text-[10px] text-slate-500 shrink-0">
        <div>Real-time Sync Status: <span className="text-emerald-500">Connected</span></div>
        <div className="flex gap-4">
          <span>Backend: Zustand Mock</span>
          <span>Zustand Context: {activeCourse ? activeCourse.code + '_' + activeCourse.room : 'dashboard'}</span>
        </div>
      </footer>

    </div>
  );
}
