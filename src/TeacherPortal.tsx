import { cn, parseThaiSchedule, isSameRoom, formatCourseTitle } from "./lib/utils";
import React, { useState, useEffect, useMemo } from 'react';
import { usePeriodsConfig } from './hooks/usePeriodsConfig';
import { useTeacherFirestoreSchedule, isTeacherEmailMatch } from './hooks/useTeacherFirestoreSchedule';
import { useHomeroomAttendance } from './hooks/useHomeroomAttendance';
import { useRealStudents } from './hooks/useRealStudents';
import { saveAttendanceRecord, getTodayScheduleByTeacher, getStudentsByClass, saveGradebookScore, getGradebookScoresByClass, submitLateAttendanceRequestFirestore, subscribeLateAttendanceRequests } from './services/firestoreService';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from './lib/firebase';
import { TeacherScheduleList, SubjectPeriod } from './components/TeacherScheduleList';
import { format, setHours, setMinutes, isWithinInterval, isBefore, isAfter } from 'date-fns';
import { th } from 'date-fns/locale';
import { useStore } from './store';
import { AttendanceStatus, Course, GlobalCourse, PostTeachingRecord, PeriodSwap, SubstituteAssignment, Student, LateAttendanceRequestRecord } from './types';
import { Minus, Plus, BookOpen, Users, ArrowLeft, PlusCircle, X, Clock, Settings, CheckCircle, Edit3, Sparkles, Shuffle, Calendar, ArrowUpRight, FileText, AlertTriangle, ChevronRight, ChevronLeft, AlertOctagon, Eye, Satellite, Radio, MapPin, ShieldCheck, Crosshair } from 'lucide-react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'motion/react';
import { StudentAssessmentDetailModal } from './components/StudentAssessmentDetailModal';
import { ActiveLearningClassroom } from './components/ActiveLearningClassroom';
import { TeachingLoadTable } from './components/TeachingLoadTable';
import { ClassroomSeatingManager } from './components/ClassroomSeatingManager';
import { ClassroomLeaderboard } from './components/ClassroomLeaderboard';
import { GPSGeofenceCheckinModal } from './components/GPSGeofenceCheckinModal';

// Helper for tailwind classes

const PERIODS = ['โฮมรูม', 'คาบ 1', 'คาบ 2', 'คาบ 3', 'คาบ 4', 'พักกลางวัน', 'คาบ 5', 'คาบ 6', 'คาบ 7', 'คาบ 8'];

const DAY_TH_NAMES: Record<string, string> = {
  monday: 'จันทร์', tuesday: 'อังคาร', wednesday: 'พุธ', thursday: 'พฤหัสบดี',
  friday: 'ศุกร์', saturday: 'เสาร์', sunday: 'อาทิตย์'
};

export function TeacherPortal() {
  const {
    user,
    currentDate,
    currentPeriod,
    analytics,
    attendanceRecords,
    scheduleConfig,
    setCurrentPeriod,
    setAttendanceStatus,
    adjustBehaviorScore,
    moveStudentSeat,
    setCurrentDate,
    setScheduleConfig,
    courses,
    activeLearningPoints,
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
    updateCourseScoreSetting,
    completeSubstituteAssignment
  } = useStore();

  // รายชื่อนักเรียนอ่านจาก Firestore สด (real-time) แทน Zustand store แบบ session-local
  // ใช้ในผังห้องเรียน (ClassroomSeatingManager), สุ่มนักเรียน, gradebook, Early Warning
  const { students } = useRealStudents();

  // --- บันทึกหลังสอนแทน (deadline ก่อน 24:00 น. ของวันที่สอน) ---
  const [subCompleteTarget, setSubCompleteTarget] = useState<SubstituteAssignment | null>(null);
  const [subCSummary, setSubCSummary] = useState('');
  const [subCProblems, setSubCProblems] = useState('');
  const [subCSolutions, setSubCSolutions] = useState('');
  const [subCSubmitting, setSubCSubmitting] = useState(false);

  const handleSubmitSubCompletion = async () => {
    if (!subCompleteTarget || !subCSummary.trim()) return;
    setSubCSubmitting(true);
    try {
      await completeSubstituteAssignment(subCompleteTarget.id, {
        summary: subCSummary.trim(),
        problems: subCProblems.trim(),
        solutions: subCSolutions.trim(),
      });
      const late = subCompleteTarget.postTeachingDueAt
        ? Date.now() > new Date(subCompleteTarget.postTeachingDueAt).getTime()
        : false;
      setSubCompleteTarget(null);
      setSubCSummary(''); setSubCProblems(''); setSubCSolutions('');
      setToast(late ? '⚠️ บันทึกหลังสอนแทนแล้ว (เลยกำหนด 24:00 น. — flag overdue)' : 'บันทึกหลังสอนแทนเรียบร้อยภายในกำหนด');
      setTimeout(() => setToast(null), 4000);
    } catch (err) {
      setToast('บันทึกไม่สำเร็จ: ' + (err instanceof Error ? err.message : String(err)));
      setTimeout(() => setToast(null), 4000);
    } finally {
      setSubCSubmitting(false);
    }
  };

  const { periods: dbPeriods, error: periodsError } = usePeriodsConfig();
  const { 
    periods: fsPeriods, 
    schedules: fsSchedules, 
    loading: fsLoading, 
    error: fsError,
    isPeriodsEmpty,
    emptyPeriodsMessage,
    isSchedulesEmpty,
    emptySchedulesMessage,
    clearError: clearFsError,
    updateScheduleAttendance, 
    updatePartnerAttendance 
  } = useTeacherFirestoreSchedule();

  const todayStr = format(currentDate, 'yyyy-MM-dd');
  // ครูผู้สอน/ครูประจำชั้นเท่านั้นที่มีตารางสอน + ต้องอ่าน attendance_records
  // (role อนุมัติ เช่น DEPUTY_DIRECTOR_ACADEMIC ถูก route ไป ApprovalsPortal แล้ว — ไม่ถึงหน้านี้)
  const isTeacherRole = ['SUBJECT_TEACHER', 'HOMEROOM_TEACHER'].includes(user?.activeRole || '') || user?.role === 'teacher' || user?.role === 'advisor';

  // ── คำขอเช็คชื่อย้อนหลังของครูคนนี้ (Firestore: late_attendance_requests) ──
  const [myLateRequests, setMyLateRequests] = useState<LateAttendanceRequestRecord[]>([]);
  const [lateSubmitting, setLateSubmitting] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    return subscribeLateAttendanceRequests(setMyLateRequests, { teacherId: user.uid });
  }, [user?.uid]);

  // สถานะคำขอเช็คชื่อย้อนหลังของครูคนนี้ ต่อ (scheduleId + วันสอน) — ล่าสุดชนะ
  const lateRequestByKey = useMemo(() => {
    const m = new Map<string, LateAttendanceRequestRecord>();
    for (const r of myLateRequests) {
      const key = `${r.scheduleId}__${r.teachingDate}`;
      const prev = m.get(key);
      if (!prev || (r.requestedAt || '') > (prev.requestedAt || '')) m.set(key, r);
    }
    return m;
  }, [myLateRequests]);

  // ── บันทึกการเช็คชื่อจริงของวันนี้ (attendance_records) — ใช้คำนวณ attendanceTaken แทน session-local store ──
  const [todayAttendanceDocs, setTodayAttendanceDocs] = useState<Array<{ id: string; periodNumber: number | null; room: string }>>([]);
  useEffect(() => {
    if (!isTeacherRole) { setTodayAttendanceDocs([]); return; }
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    const qy = query(collection(db, 'attendance_records'), where('date', '==', dateStr));
    const unsub = onSnapshot(qy, (snap) => {
      const rows: Array<{ id: string; periodNumber: number | null; room: string }> = [];
      snap.forEach(d => {
        const data = d.data() as any;
        // เก็บ "ทุก" record ของวันนี้ — รวมคาบที่ไม่มี field periodNumber ด้วย
        // (โฮมรูมเขียนผ่าน useHomeroomAttendance เป็น id `${date}_${room}` ไม่มี periodNumber
        //  ถ้า drop ทิ้งตรงนี้ คาบโฮมรูมที่เช็คแล้วจะกลับไปขึ้นปุ่ม "ขอเช็คชื่อย้อนหลัง")
        const pn = (data.periodNumber !== undefined && data.periodNumber !== null) ? Number(data.periodNumber) : null;
        rows.push({ id: d.id, periodNumber: pn, room: String(data.room || '') });
      });
      setTodayAttendanceDocs(rows);
    }, (err) => console.warn('[TeacherPortal] today attendance listener:', err.message));
    return () => unsub();
  }, [currentDate, isTeacherRole]);

  // รายวิชาทั้งระบบ (ทุกครู) — derive จาก Firestore `schedules` แบบ real-time
  // แทนการอ่าน globalCourses จาก Zustand store ซึ่งจะมีค่าเฉพาะเซสชันที่เพิ่ง import เท่านั้น
  // (พอเปิดหน้าใหม่/ล็อกอินใหม่/คนละเครื่อง store ว่าง → ตารางสอนหายทั้งที่ Firestore มีครบ)
  const globalCourses: GlobalCourse[] = useMemo(() => {
    return (fsSchedules as any[]).map(sch => {
      const rawId = String(sch.id || '');
      const courseId = rawId.startsWith('sch_') ? `course_${rawId.slice(4)}` : rawId;
      const dayTh = DAY_TH_NAMES[String(sch.dayOfWeek || '').toLowerCase()] || sch.dayOfWeek || '';
      const hasPeriod = sch.periodNumber !== undefined && sch.periodNumber !== null;
      const scheduleString = dayTh
        ? (hasPeriod ? `${dayTh} คาบ ${sch.periodNumber}` : dayTh)
        : (sch.scheduleString || sch.schedule || '');
      return {
        courseId,
        code: sch.subjectCode || sch.courseCode || '',
        courseName: sch.subjectName || sch.courseName || '',
        teacherName: sch.sourceTeacherName || sch.teacherName || sch.unlinkedTeacherName || 'ครูผู้สอน',
        teacherEmail: sch.teacherEmail || sch.unlinkedTeacherEmail || '',
        roomName: sch.room || sch.level || sch.targetClass || '',
        scheduleString,
        level: sch.level || '',
      } as GlobalCourse;
    });
  }, [fsSchedules]);

  const myCourses: Course[] = useMemo(() => {
    const rawList = globalCourses
      .filter(gc => {
        // 1. Is original teacher
        const isOriginal = isTeacherEmailMatch(gc.teacherEmail, user?.email);
        
        // 2. Is substitute teacher today
        const isSub = substituteAssignments.some(sa => 
          sa.courseId === gc.courseId && 
          isTeacherEmailMatch(sa.substituteTeacherEmail, user?.email) && 
          sa.date === todayStr
        );

        // 3. Is target of an approved swap for this course
        const isSwapTarget = periodSwaps.some(ps => 
          ps.targetCourseId === gc.courseId && 
          isTeacherEmailMatch(ps.targetEmail, user?.email) && 
          ps.status === 'APPROVED'
        );
        // OR is requester of an approved swap and now teaches the target course instead
        const isSwapRequester = periodSwaps.some(ps =>
          ps.requesterCourseId === gc.courseId &&
          isTeacherEmailMatch(ps.requesterEmail, user?.email) && 
          ps.status === 'APPROVED'
        );

        return isOriginal || isSub || isSwapTarget || isSwapRequester;
      })
      .map(gc => {
        // Find original course if it exists to get `attendanceTaken` status
        const originalCourse = courses.find(c => 
          c.id === gc.courseId || 
          c.id.includes(gc.code) ||
          (c.code === gc.code && isSameRoom(c.room, gc.roomName))
        );
        
        const hasRecords = !!(
          (attendanceRecords[gc.courseId] && Object.keys(attendanceRecords[gc.courseId]).length > 0) ||
          (originalCourse && attendanceRecords[originalCourse.id] && Object.keys(attendanceRecords[originalCourse.id]).length > 0)
        );

        const isTaken = originalCourse?.attendanceTaken || hasRecords || false;
        
        let roleLabel = "";
        const isSub = substituteAssignments.some(sa => sa.courseId === gc.courseId && isTeacherEmailMatch(sa.substituteTeacherEmail, user?.email) && sa.date === todayStr);
        if (isSub) {
          roleLabel = "สอนแทน (Substitute)";
        } else {
          const isSwap = periodSwaps.some(ps => (ps.targetCourseId === gc.courseId || ps.requesterCourseId === gc.courseId) && ps.status === 'APPROVED');
          if (isSwap) {
            roleLabel = "สลับคาบเรียน (Swapped)";
          }
        }

        // level = ระดับชั้น (ม.5/8); ถ้า globalCourse ไม่มี ให้ใช้ roomName ต่อเมื่อ roomName เป็นชื่อชั้นเอง
        const levelStr = gc.level || (/ม\.\s?\d/.test(gc.roomName) ? gc.roomName : '');
        return {
          id: gc.courseId,
          code: gc.code,
          name: gc.courseName,
          room: gc.roomName,
          level: levelStr,
          term: '1/2569',
          studentsCount: gc.roomName.includes('5/8') ? 40 : gc.roomName.includes('5/9') ? 38 : gc.roomName.includes('5/11') ? 42 : 35,
          schedule: gc.scheduleString,
          attendanceTaken: isTaken,
          teacherName: gc.teacherName,
          roleLabel
        };
      });

    // Deduplicate myCourses by unique code + room + schedule
    const seenCourseKeys = new Set<string>();
    const uniqueCourses: Course[] = [];
    rawList.forEach(course => {
      const key = `${course.code}_${course.room}_${course.schedule}`;
      if (!seenCourseKeys.has(key)) {
        seenCourseKeys.add(key);
        uniqueCourses.push(course);
      }
    });

    return uniqueCourses;
  }, [globalCourses, user?.email, substituteAssignments, todayStr, periodSwaps, courses]);

  const [view, setView] = useState<'dashboard' | 'class' | 'active_learning'>('dashboard');
  const [activeCourse, setActiveCourse] = useState<Course | null>(null);
  // เข้าห้องเรียนในโหมด "เช็คชื่อย้อนหลัง" (อนุมัติแล้ว) — ล็อกกิจกรรมอื่น ทำได้แค่เช็คชื่อ
  const [retroactiveAttendanceMode, setRetroactiveAttendanceMode] = useState(false);

  const handleGoHome = () => {
    setView('dashboard');
    setActiveCourse(null);
    setViewingRecord(null);
    setRetroactiveAttendanceMode(false);
  };

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
  const [assessmentModalStudent, setAssessmentModalStudent] = useState<Student | null>(null);
  const [isShuffling, setIsShuffling] = useState(false);
  const [shufflingStudentIds, setShufflingStudentIds] = useState<string[]>([]);
  const [randomPickedStudent, setRandomPickedStudent] = useState<Student | null>(null);

  // New States for Post-Teaching Records
  const [showPostTeachingModal, setShowPostTeachingModal] = useState(false);
  const [postTeachingCourse, setPostTeachingCourse] = useState<Course | null>(null);
  const [postTeachingPeriod, setPostTeachingPeriod] = useState<SubjectPeriod | null>(null);
  const [ptDate, setPtDate] = useState('');
  const [ptSummary, setPtSummary] = useState('');
  const [ptProblems, setPtProblems] = useState('');
  const [ptSolutions, setPtSolutions] = useState('');
  const [viewingRecord, setViewingRecord] = useState<PostTeachingRecord | null>(null);

  // New States for Dashboard Navigation
  const [dashboardTab, setDashboardTab] = useState<'courses' | 'teaching-load' | 'leaderboard' | 'substitutions' | 'records' | 'gradebook' | 'gps-geofence'>('courses');
  const [isTeacherGPSModalOpen, setIsTeacherGPSModalOpen] = useState(false);

  // Dynamic Role-Based Access Control (RBAC) Tab Filtering
  const availableDashboardTabs = useMemo(() => {
    const rawTabs: Array<{
      id: 'courses' | 'teaching-load' | 'leaderboard' | 'substitutions' | 'records' | 'gradebook' | 'gps-geofence';
      label: string;
      count: number;
      hideForRoles?: string[];
    }> = [
      { id: 'courses', label: 'ตารางสอนและการเข้าเรียน', count: myCourses.length },
      { id: 'gps-geofence', label: '📍 พิกัดดาวเทียม & เช็คอิน (GPS Geofence)', count: 0 },
      { id: 'teaching-load', label: 'ตารางภาระงานสอน (Teaching Load)', count: 6, hideForRoles: ['SUBJECT_TEACHER'] },
      { id: 'leaderboard', label: '🏆 กระดานคะแนน Active Learning (Leaderboard)', count: Object.values(activeLearningPoints).filter(p => p > 0).length },
      { id: 'substitutions', label: 'จัดการภาระลา & สอนแทน', count: substituteAssignments.filter(sa => sa.substituteTeacherEmail === user?.email && sa.date === todayStr).length + periodSwaps.filter(ps => ps.targetEmail === user?.email && ps.status === 'PENDING_TEACHER').length },
      { id: 'records', label: 'ประวัติบันทึกหลังสอนทั้งหมด', count: postTeachingRecords.filter(r => myCourses.some(c => c.id === r.courseId)).length },
      { id: 'gradebook', label: 'สมุดบันทึกคะแนน (Gradebook)', count: 0 }
    ];

    return rawTabs.filter(tab => {
      const currentRole = user?.activeRole || 'SUBJECT_TEACHER';
      if (tab.hideForRoles && tab.hideForRoles.includes(currentRole)) return false;
      return true;
    });
  }, [user?.activeRole, myCourses.length, activeLearningPoints, substituteAssignments, user?.email, todayStr, periodSwaps, postTeachingRecords]);

  // Seamless fallback when role changes and current tab is restricted
  useEffect(() => {
    const isCurrentTabValid = availableDashboardTabs.some(t => t.id === dashboardTab);
    if (!isCurrentTabValid) {
      setDashboardTab('courses');
    }
  }, [availableDashboardTabs, dashboardTab]);

  const [selectedGradebookCourseId, setSelectedGradebookCourseId] = useState<string>('');
  const [gradebookStudents, setGradebookStudents] = useState<any[]>([]);
  const [gradebookLoading, setGradebookLoading] = useState<boolean>(false);
  const [showScoreSettingModal, setShowScoreSettingModal] = useState(false);
  const [scoreSettingForm, setScoreSettingForm] = useState({ preMidterm: 25, midterm: 20, postMidterm: 25, final: 30 });
  const [scoreSettingError, setScoreSettingError] = useState('');
  const [isCopyMode, setIsCopyMode] = useState(false);
  const [copyTargetCourses, setCopyTargetCourses] = useState<string[]>([]);
  const [isEarlyWarningDrawerOpen, setIsEarlyWarningDrawerOpen] = useState(false);

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
  const courseStudents = useMemo(() => {
    const targetRoom = activeCourse?.room;
    if (!targetRoom) return [];

    return (students || []).filter(s => 
      isSameRoom(s.room, targetRoom) || 
      isSameRoom((s as any).className, targetRoom)
    );
  }, [activeCourse?.room, students]);

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

  // Late Attendance Modal (ขอเช็คชื่อย้อนหลัง)
  const [showLateModal, setShowLateModal] = useState(false);
  const [lateCourse, setLateCourse] = useState<Course | null>(null);
  const [latePeriod, setLatePeriod] = useState<SubjectPeriod | null>(null);
  const [lateReason, setLateReason] = useState('');

  // Schedule Request Modal
  const [showScheduleReqModal, setShowScheduleReqModal] = useState(false);
  const [scheduleReqCourse, setScheduleReqCourse] = useState<Course | null>(null);
  const [scheduleReqNote, setScheduleReqNote] = useState('');

  // Admin Config Modal
  const [showConfigModal, setShowConfigModal] = useState(false);

  const availableRooms = ['ม.1/1', 'ม.1/2', 'ม.1/3', 'ม.2/1', 'ม.2/2', 'ม.3/1'];

  // Parse Thai Schedule Notation e.g. "จ1", "อ3-4", "อ2, พ4, ฤ1, ศ3"
  const parseSchedule = parseThaiSchedule;

  // Time Simulation Helpers
  const getPeriodTimes = (index: number) => {
    // 1. First try to find period configuration matching the periodNumber
    const match = (fsPeriods && fsPeriods.length > 0)
      ? fsPeriods.find(p => p.periodNumber === index)
      : dbPeriods.find(p => p.periodNumber === index);

    if (match) {
      const [sh, sm] = match.startTime.split(':').map(Number);
      const [eh, em] = match.endTime.split(':').map(Number);
      const start = setMinutes(setHours(currentDate, sh || 0), sm || 0);
      const end = setMinutes(setHours(currentDate, eh || 0), em || 0);
      return { start, end };
    }

    // 2. Standard school period timetable
    const standardPeriods: Record<number, { start: [number, number]; end: [number, number] }> = {
      0: { start: [8, 0], end: [8, 30] },
      1: { start: [8, 30], end: [9, 20] },
      2: { start: [9, 20], end: [10, 10] },
      3: { start: [10, 10], end: [11, 0] },
      4: { start: [11, 0], end: [11, 50] },
      5: { start: [11, 50], end: [12, 40] },
      6: { start: [12, 40], end: [13, 30] },
      7: { start: [13, 30], end: [14, 20] },
      8: { start: [14, 20], end: [15, 10] },
      9: { start: [15, 10], end: [16, 0] }
    };

    if (standardPeriods[index]) {
      const { start: sTime, end: eTime } = standardPeriods[index];
      const start = setMinutes(setHours(currentDate, sTime[0]), sTime[1]);
      const end = setMinutes(setHours(currentDate, eTime[0]), eTime[1]);
      return { start, end };
    }

    const start = setMinutes(setHours(currentDate, 8 + Math.floor(index * 50 / 60)), (index * 50) % 60);
    const end = setMinutes(setHours(currentDate, 8 + Math.floor((index * 50 + 50) / 60)), (index * 50 + 50) % 60);
    return { start, end };
  };

  const formatTime = (date: Date) => format(date, 'HH:mm');

  const handleLateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!latePeriod || !lateReason.trim() || !user?.uid) return;

    // กันยื่นซ้ำ ถ้ามีคำขอ PENDING/APPROVED สำหรับคาบนี้อยู่แล้ว
    const key = `${latePeriod.scheduleId || latePeriod.id}__${todayStr}`;
    const existing = lateRequestByKey.get(key);
    if (existing && (existing.status === 'PENDING' || existing.status === 'APPROVED')) {
      setToast(existing.status === 'PENDING' ? 'มีคำขอที่รออนุมัติอยู่แล้วสำหรับคาบนี้' : 'คาบนี้ได้รับอนุมัติแล้ว เข้าเช็คชื่อย้อนหลังได้เลย');
      setShowLateModal(false);
      return;
    }

    setLateSubmitting(true);
    try {
      await submitLateAttendanceRequestFirestore({
        teacherId: user.uid,
        teacherName: user.displayName || user.email || 'ครูผู้สอน',
        teacherEmail: user.email || '',
        scheduleId: latePeriod.scheduleId || latePeriod.id,
        subjectCode: latePeriod.subjectCode,
        subjectName: latePeriod.subjectName,
        level: latePeriod.level || latePeriod.className || '',
        periodNumber: Number(latePeriod.periodNumber),
        room: latePeriod.room || '',
        teachingDate: todayStr,
        reason: lateReason.trim(),
      });
      setToast('ส่งคำขอเช็คชื่อย้อนหลังแล้ว รอรองผู้อำนวยการฝ่ายวิชาการอนุมัติ');
      setTimeout(() => setToast(null), 4000);
      setShowLateModal(false);
      setLateReason('');
      setLateCourse(null);
      setLatePeriod(null);
    } catch (err) {
      setToast('ส่งคำขอไม่สำเร็จ: ' + (err instanceof Error ? err.message : String(err)));
      setTimeout(() => setToast(null), 4000);
    } finally {
      setLateSubmitting(false);
    }
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
      isLate: isLate,
      scheduleId: postTeachingPeriod?.scheduleId || postTeachingPeriod?.id,
      subjectCode: postTeachingPeriod?.subjectCode || postTeachingCourse.code,
      level: postTeachingPeriod?.level || postTeachingPeriod?.className || (postTeachingCourse as any).level,
      room: postTeachingPeriod?.room || postTeachingCourse.room,
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
      const matchedSched = (fsSchedules as any[]).find(s => {
        const code = s.courseCode || s.subjectCode || '';
        const cls = String(s.targetClass || s.room || s.level || '');
        return code === activeCourse?.code &&
          cls.replace(/^M\./i, 'ม.') === activeCourse?.room?.replace(/^M\./i, 'ม.');
      });
      if (matchedSched) {
        await updateScheduleAttendance(matchedSched.id, true);
      }

      setToast(retroactiveAttendanceMode ? 'บันทึกเช็คชื่อย้อนหลังเรียบร้อยแล้ว!' : 'บันทึกการเช็กชื่อเรียบร้อยแล้ว!');
      setTimeout(() => setToast(null), 3000);
      setRetroactiveAttendanceMode(false);
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
      <header className="h-14 sm:h-16 border-b border-slate-800/80 bg-[#161f30] flex items-center justify-between px-3 sm:px-6 shrink-0 shadow-lg relative z-20">
        <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent"></div>
        {/* Interactive App Title & Home Button */}
        <button
          id="btn-teacher-portal-home"
          type="button"
          onClick={handleGoHome}
          className="flex items-center gap-2 sm:gap-3 group text-left cursor-pointer focus:outline-none transition-all duration-150 hover:opacity-95 active:scale-[0.98] select-none rounded-xl p-1 -ml-1 hover:bg-white/5 min-w-0"
          title="กลับไปยังหน้าหลัก (Dashboard ภาระงานสอน)"
        >
          <div className="w-8 h-8 bg-emerald-600 group-hover:bg-emerald-500 rounded-lg flex items-center justify-center font-bold text-white shadow-[0_0_10px_rgba(16,185,129,0.4)] group-hover:shadow-[0_0_16px_rgba(16,185,129,0.6)] transition-all duration-200 shrink-0">
            T
          </div>
          <h1 className="text-sm sm:text-base md:text-lg font-bold tracking-tight text-white flex items-center gap-1.5 transition-colors truncate">
            <span className="group-hover:text-emerald-300 transition-colors">Smart School Care</span>
            <span className="text-emerald-400 font-medium group-hover:text-emerald-300 transition-colors truncate">
              | {user?.activeRole === 'HOMEROOM_TEACHER' ? 'Homeroom' : user?.activeRole === 'HEAD_OF_DEPARTMENT' ? 'Head of Dept' : user?.activeRole === 'SUPERVISORY_TEACHER' ? 'Supervisor' : user?.activeRole === 'EXECUTIVE' ? 'Executive' : 'Subject Teacher'}
            </span>
          </h1>
        </button>

        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          {/* Config Modal Trigger Button */}
          <button 
            onClick={() => setShowConfigModal(true)}
            title="ตั้งค่าชั่วโมง/ตารางกิจกรรม"
            className="flex items-center gap-1.5 bg-[#1b2a4a] hover:bg-[#23365d] border border-blue-900/50 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs text-blue-400 transition-colors font-medium cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5 text-blue-300" />
            <span className="hidden sm:inline">ตั้งค่ากิจกรรม</span>
            {scheduleConfig.isActivityDay && (
              <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 rounded ml-0.5 border border-amber-500/30">
                -{scheduleConfig.shortenMinutes}m
              </span>
            )}
          </button>

          <div className="flex items-center gap-2.5 pl-2 border-l border-slate-800">
            <div className="w-8 h-8 rounded-full bg-slate-800/80 border border-emerald-800/50 flex items-center justify-center text-xs font-bold text-emerald-400">
              {user?.displayName ? (user.displayName.includes('Kiattisak') ? 'K' : user.displayName.slice(0, 2)) : 'K'}
            </div>
            <div className="hidden md:flex flex-col text-left">
              <span className="text-xs font-bold text-slate-200">{user?.displayName || 'Mr. Kiattisak'}</span>
              <span className="text-[10px] text-emerald-400 font-medium">กลุ่มสาระฯ คณิตศาสตร์</span>
            </div>
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

            {/* Sub Tabs Selection (RBAC Conditionally Filtered) */}
            <div className="flex border-b border-slate-800/80 mb-8 gap-6 overflow-x-auto">
              {availableDashboardTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setDashboardTab(tab.id as any)}
                  className={cn(
                    "pb-3 text-sm font-bold transition-all relative shrink-0 cursor-pointer",
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
              const rawMappedPeriods: SubjectPeriod[] = [];

              // schedules docs ที่ import จากไฟล์ภาระงานสอนใช้ field `dayOfWeek` (string) / `subjectCode` ฯลฯ
              // ส่วน interface เดิมคาดหวัง `scheduleDay` (number) / `courseCode` — normalize ให้รองรับทั้งสองแบบ
              const DAY_NAME_TO_NUM: Record<string, number> = {
                sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6
              };
              const todayFsSchedules = (!fsLoading && fsSchedules.length > 0)
                ? (fsSchedules as any[])
                    .map(raw => {
                      const dayNum = typeof raw.scheduleDay === 'number'
                        ? raw.scheduleDay
                        : DAY_NAME_TO_NUM[String(raw.dayOfWeek || '').toLowerCase()];
                      return {
                        id: raw.id,
                        teacherEmail: raw.teacherEmail || raw.unlinkedTeacherEmail || '',
                        teacherIds: raw.teacherIds,
                        teacherId: raw.teacherId,
                        scheduleDay: dayNum,
                        periodNumber: raw.periodNumber,
                        courseCode: raw.courseCode || raw.subjectCode || '',
                        courseName: raw.courseName || raw.subjectName || '',
                        targetClass: raw.targetClass || raw.room || raw.level || '',
                        // ระดับชั้น (ม.5/8) แยกจากห้องกายภาพ (943) — ไฟล์ import เก็บชั้นไว้ที่ field `level`
                        classLevel: raw.level || raw.targetClass || raw.room || '',
                        room: raw.room || raw.level || '',
                        type: raw.type || raw.subjectType || 'MAIN',
                        attendanceTaken: raw.attendanceTaken,
                        studentsCount: raw.studentsCount,
                        teachingPartner: raw.teachingPartner,
                        partnerCheckedAttendance: raw.partnerCheckedAttendance,
                      };
                    })
                    .filter(item =>
                      (isTeacherEmailMatch(item.teacherEmail, user?.email) ||
                        (user?.uid && (item.teacherId === user.uid ||
                          (Array.isArray(item.teacherIds) && item.teacherIds.includes(user.uid))))) &&
                      item.scheduleDay === targetDayOfWeek
                    )
                : [];

              if (todayFsSchedules.length > 0) {
                // Use Firestore sync schedules & periods!
                todayFsSchedules.forEach(item => {
                  const { start, end } = getPeriodTimes(item.periodNumber);
                  const startTime = formatTime(start);
                  const endTime = formatTime(end);

                  // จับคู่ course ให้ตรงคาบนี้เป๊ะ ๆ ก่อน (id ที่ derive จาก schedule doc id ของคาบนี้เอง)
                  // แล้วค่อย fallback loose match — กัน stale schedule ที่ code+level ซ้ำกันแย่ง match
                  const derivedCourseId = `course_${String(item.id).replace(/^sch_/, '')}`;
                  const matchedCourse =
                    myCourses.find(c => c.id === derivedCourseId || c.id === item.id) ||
                    myCourses.find(c =>
                      c.code === item.courseCode &&
                      (isSameRoom(c.room, item.targetClass) ||
                        isSameRoom(c.level, item.classLevel) ||
                        isSameRoom(c.room, item.classLevel))
                    );

                  const courseId = matchedCourse ? matchedCourse.id : item.id;
                  // เช็คชื่อจริงไปแล้วหรือยัง — จับคู่กับ attendance_records ของวันนั้นจริง (Firestore)
                  // วิธีหลัก: เทียบ "doc id" แบบเป๊ะ ๆ ตามสูตรที่ตัวเขียนใช้จริง
                  //   TakeAttendanceModal/ClassroomSeatingManager: `${date}_${room-แทน / ด้วย -}_p${period}`
                  //   useHomeroomAttendance (คาบ 0): `${date}_${room-แทน / ด้วย -}` (ไม่มี _p0)
                  // เดิมเทียบด้วย a.periodNumber === Number(item.periodNumber) อย่างเดียว → พังเมื่อ
                  //   periodNumber ถูกเก็บเป็น string, เป็น undefined (โฮมรูม), หรือฟอร์แมตห้องไม่ตรง
                  //   ทำให้คาบที่ "เช็คชื่อจริงแล้ว" กลับไปโชว์ปุ่ม "ขอเช็คชื่อย้อนหลัง" (regression)
                  const attRoomCandidates = [item.classLevel, item.targetClass, item.room]
                    .filter(Boolean).map(v => String(v));
                  const expectedRecordIds = new Set<string>();
                  attRoomCandidates.forEach(r => {
                    const rr = r.replace('/', '-');
                    expectedRecordIds.add(`${todayStr}_${rr}_p${item.periodNumber}`);
                    if (Number(item.periodNumber) === 0) expectedRecordIds.add(`${todayStr}_${rr}`);
                  });
                  const firestoreChecked = todayAttendanceDocs.some(a =>
                    expectedRecordIds.has(a.id) ||
                    (a.periodNumber !== null &&
                      Number(a.periodNumber) === Number(item.periodNumber) &&
                      attRoomCandidates.some(r => isSameRoom(a.room, r)))
                  );
                  const hasRecords = firestoreChecked || !!(
                    (attendanceRecords[courseId] && Object.keys(attendanceRecords[courseId]).length > 0) ||
                    (attendanceRecords[item.id] && Object.keys(attendanceRecords[item.id]).length > 0)
                  );
                  const isAttendanceTaken = firestoreChecked || (matchedCourse ? matchedCourse.attendanceTaken : false) || !!item.attendanceTaken || hasRecords;

                  if (import.meta.env.DEV) {
                    // [DEBUG-ATT] ยังคงไว้ชั่วคราวเพื่อพิสูจน์ regression คาบ 7 หลัง emulator กลับมาใช้งานได้
                    // (ต้องเช็คชื่อคาบ 7 จริงแล้วดู log ว่า expectedRecordIds ตรงกับ todayDocs id ไหม) — ลบออกเมื่อยืนยันแล้ว
                    // eslint-disable-next-line no-console
                    console.log('[DEBUG-ATT]', {
                      period: item.periodNumber, code: item.courseCode, classLevel: item.classLevel, room: item.room, targetClass: item.targetClass,
                      firestoreChecked, isAttendanceTaken,
                      expectedRecordIds: [...expectedRecordIds],
                      todayDocs: todayAttendanceDocs.map(a => `${a.id}(p${a.periodNumber}@${a.room})`),
                    });
                  }

                  const recordDate = format(targetDate, 'yyyy-MM-dd');
                  // จับคู่ด้วย id ที่ชัดเจนเท่านั้น (courseId ที่ derive จาก schedule / scheduleId)
                  // ไม่จับคู่หลวมด้วย subjectCode+room — เจอ false positive กับ record เก่าที่ courseId คนละรูปแบบ
                  const existingRecord = postTeachingRecords.find(r =>
                    r.date === recordDate && (
                      r.courseId === courseId ||
                      r.courseId === item.id ||
                      r.courseId === `course_${String(item.id).replace(/^sch_/, '')}` ||
                      r.scheduleId === item.id
                    ));
                  const lateReq = lateRequestByKey.get(`${item.id}__${recordDate}`);

                  rawMappedPeriods.push({
                    id: item.id,
                    scheduleId: item.id,
                    courseId: courseId,
                    periodNumber: item.periodNumber,
                    startTime,
                    endTime,
                    subjectCode: item.courseCode,
                    subjectName: item.courseName,
                    className: item.classLevel || item.targetClass,
                    level: item.classLevel || item.targetClass,
                    room: item.room || (item.targetClass.includes('5/8') ? '[943] HR 5/8' : item.targetClass.includes('5/9') ? '[935] HR 5/9' : 'ห้องเรียน ' + item.targetClass),
                    attendanceTaken: isAttendanceTaken,
                    lateRequestStatus: lateReq ? lateReq.status : null,
                    hasPostTeachingRecord: !!existingRecord,
                    roleLabel: item.type === 'ACTIVITY' ? 'กิจกรรม' : matchedCourse?.roleLabel || 'วิชาการ',
                    studentsCount: item.studentsCount || 40,
                    type: item.type,
                    teachingPartner: item.teachingPartner,
                    partnerCheckedAttendance: item.partnerCheckedAttendance
                  });
                });
              }

              // Deduplicate schedule items by period slot (periodNumber + subjectCode + className)
              const seenPeriodSlotKeys = new Set<string>();
              const mappedPeriods: SubjectPeriod[] = [];
              rawMappedPeriods.forEach(p => {
                const slotKey = `${p.periodNumber}_${p.subjectCode}_${p.className?.replace(/^M\./i, 'ม.')}`;
                if (!seenPeriodSlotKeys.has(slotKey)) {
                  seenPeriodSlotKeys.add(slotKey);
                  mappedPeriods.push(p);
                }
              });

              // Ensure they are sorted ascending by periodNumber (e.g. 0, 4, 8)
              mappedPeriods.sort((a, b) => a.periodNumber - b.periodNumber);

              const resolveCourseAndPeriod = (periodId: string) => {
                const periodItem = mappedPeriods.find(p => p.id === periodId || p.courseId === periodId);
                let course = myCourses.find(c => c.id === periodId);
                if (!course && periodItem) {
                  course = myCourses.find(c =>
                    c.id === periodItem.courseId ||
                    (c.code === periodItem.subjectCode &&
                      (isSameRoom(c.room, periodItem.className) || isSameRoom(c.level, periodItem.className)))
                  );
                }
                if (!course && periodItem) {
                  course = {
                    id: periodItem.courseId || periodItem.id,
                    code: periodItem.subjectCode,
                    name: periodItem.subjectName,
                    room: periodItem.className,
                    level: periodItem.className,
                    term: '1/2569',
                    studentsCount: periodItem.studentsCount || 40,
                    attendanceTaken: !!periodItem.attendanceTaken,
                    periodIndex: periodItem.periodNumber
                  };
                }
                const pIndex = periodItem ? periodItem.periodNumber : (course?.periodIndex || 1);
                return { course, pIndex, periodItem };
              };

              return (
                <div className="space-y-4">
                  {/* Empty periods alert for regular teachers if no periods configured */}
                  {(!fsLoading && fsPeriods.length === 0 && dbPeriods.length === 0) && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center gap-3 text-amber-300 text-sm">
                      <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400" />
                      <span>{emptyPeriodsMessage || "ยังไม่มีการตั้งค่าคาบเรียนจากผู้ดูแลระบบ"}</span>
                    </div>
                  )}

                  {/* Empty schedules alert if no schedules configured in Firestore */}
                  {isSchedulesEmpty && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center gap-3 text-amber-300 text-sm" id="empty-schedules-banner">
                      <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400" />
                      <span>{emptySchedulesMessage || "ยังไม่มีตารางสอนในระบบ กรุณาติดต่อผู้ดูแลระบบ"}</span>
                    </div>
                  )}

                  {/* Non-blocking visible write error alert */}
                  {(fsError || periodsError) && (
                    <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex items-center justify-between gap-3 text-rose-300 text-sm">
                      <div className="flex items-center gap-3">
                        <AlertOctagon className="w-5 h-5 shrink-0 text-rose-400" />
                        <span>{fsError || periodsError}</span>
                      </div>
                      {clearFsError && (
                        <button onClick={clearFsError} className="text-rose-400 hover:text-rose-200">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button
                      onClick={async () => {
                        if (mappedPeriods.length > 0) {
                          let hasError = false;
                          for (const p of mappedPeriods) {
                            markAttendanceDone(p.courseId);
                            if (p.id) {
                              markAttendanceDone(p.id);
                              try {
                                await updateScheduleAttendance(p.id, true);
                              } catch(e) {
                                hasError = true;
                                console.error("Could not update firestore schedule attendance:", e);
                              }
                            }
                            if (p.subjectCode) {
                              markAttendanceDone(p.subjectCode);
                            }
                          }
                          
                          if (hasError) {
                            setToast('บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
                          } else {
                            setToast('จำลองเช็คชื่อสำเร็จแล้ว (ทุกคาบเรียน)');
                          }
                          setTimeout(() => setToast(null), 3000);
                        } else {
                          setToast('ไม่มีคาบเรียนให้จำลองเช็คชื่อ');
                          setTimeout(() => setToast(null), 3000);
                        }
                      }}
                      className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-lg flex items-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      จำลองเช็คชื่อสำเร็จ (Simulate)
                    </button>
                  </div>
                  <TeacherScheduleList
                    periods={mappedPeriods}
                    currentDate={currentDate}
                    isNextDay={isNextDay}
                    dayLabel={dayLabel}
                    onTakeAttendance={(periodId) => {
                      const { course, pIndex, periodItem } = resolveCourseAndPeriod(periodId);
                      if (course) {
                        setRetroactiveAttendanceMode(false);
                        setActiveCourse({
                          ...course,
                          periodIndex: pIndex,
                          room: periodItem?.className || course.room,
                          level: periodItem?.className || course.level
                        });
                        setCurrentPeriod(PERIODS[pIndex] || `คาบ ${pIndex}`);
                        setView('class');
                      }
                    }}
                    onRequestLateAttendance={(periodId) => {
                      const { course, periodItem } = resolveCourseAndPeriod(periodId);
                      if (!periodItem) return;
                      const key = `${periodItem.scheduleId || periodItem.id}__${todayStr}`;
                      const req = lateRequestByKey.get(key);
                      if (req?.status === 'APPROVED') {
                        // อนุมัติแล้ว → เข้าเช็คชื่อย้อนหลังได้ (โหมดเช็คชื่ออย่างเดียว)
                        if (course) {
                          setActiveCourse({ ...course, periodIndex: periodItem.periodNumber, room: periodItem.className || course.room, level: periodItem.className || course.level });
                          setCurrentPeriod(PERIODS[periodItem.periodNumber] || `คาบ ${periodItem.periodNumber}`);
                          setRetroactiveAttendanceMode(true);
                          setView('class');
                        }
                        return;
                      }
                      if (req?.status === 'PENDING') {
                        setToast('คำขอเช็คชื่อย้อนหลังของคาบนี้กำลังรอรองผู้อำนวยการฝ่ายวิชาการอนุมัติ');
                        setTimeout(() => setToast(null), 4000);
                        return;
                      }
                      // ยังไม่เคยขอ หรือถูกปฏิเสธ → เปิดฟอร์มขอ
                      setLateCourse(course || null);
                      setLatePeriod(periodItem);
                      setLateReason('');
                      setShowLateModal(true);
                    }}
                    onRecordPostTeaching={(periodId) => {
                      const { course, periodItem } = resolveCourseAndPeriod(periodId);
                      if (course) {
                        setPostTeachingCourse(course);
                        setPostTeachingPeriod(periodItem || null);
                        setPtDate(format(targetDate, 'yyyy-MM-dd'));
                        setShowPostTeachingModal(true);
                      }
                    }}
                    onViewPostTeachingRecord={(periodId) => {
                      const recordDate = format(targetDate, 'yyyy-MM-dd');
                      const pItem = mappedPeriods.find(p => p.id === periodId || p.courseId === periodId);
                      const existingRecord = postTeachingRecords.find(r =>
                        r.date === recordDate && (
                          r.courseId === periodId ||
                          (pItem && (r.courseId === pItem.courseId || r.courseId === pItem.id ||
                            r.courseId === `course_${String(pItem.id).replace(/^sch_/, '')}` || r.scheduleId === pItem.id))
                        ));
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
                        setToast('บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
                        setTimeout(() => setToast(null), 4000);
                      }
                    }}
                    onEnterClassroom={(periodId) => {
                      const { course, pIndex, periodItem } = resolveCourseAndPeriod(periodId);
                      if (course) {
                        setRetroactiveAttendanceMode(false);
                        setActiveCourse({
                          ...course,
                          periodIndex: pIndex,
                          room: periodItem?.className || course.room,
                          level: periodItem?.className || course.level
                        });
                        setCurrentPeriod(PERIODS[pIndex] || `คาบ ${pIndex}`);
                        setView('class');
                      }
                    }}
                  />
                </div>
              );
            })()}

            {/* role อนุมัติสอนแทน (HEAD_OF_DEPARTMENT ฯลฯ) ถูก route ไป ApprovalsPortal แล้ว —
                หน้านี้เหลือเฉพาะฟอร์มขอสลับคาบของครูผู้สอนทั่วไป */}
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
                          <option key={gc.courseId} value={gc.courseId}>{gc.code} {formatCourseTitle(gc.courseName, gc.level, gc.roomName)} - {gc.scheduleString}</option>
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
                            <option key={gc.courseId} value={gc.courseId}>{gc.code} {formatCourseTitle(gc.courseName, gc.level, gc.roomName)} - {gc.scheduleString}</option>
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
                      <Calendar className="w-5 h-5 text-emerald-400" /> งานสอนแทนที่ท่านได้รับมอบหมาย (อนุมัติครบ 4 ขั้นแล้ว)
                    </h3>

                    <div className="space-y-3">
                      {(() => {
                        const myApproved = substituteAssignments.filter(
                          sa => isTeacherEmailMatch(sa.substituteTeacherEmail, user?.email) && sa.status === 'APPROVED'
                        );
                        if (myApproved.length === 0) {
                          return <div className="text-center py-6 text-xs text-slate-500">ไม่มีภาระงานสอนแทนที่ผ่านการอนุมัติสำหรับท่าน</div>;
                        }
                        return myApproved
                          .slice()
                          .sort((a, b) => a.date.localeCompare(b.date))
                          .map(sa => {
                            const course = globalCourses.find(c => c.courseId === sa.courseId);
                            const code = sa.courseCode || course?.code || '';
                            const name = sa.courseName || course?.courseName || 'รายวิชา';
                            const room = sa.room || course?.roomName || '';
                            const overdue = !sa.isCompleted && sa.postTeachingDueAt
                              ? Date.now() > new Date(sa.postTeachingDueAt).getTime()
                              : false;
                            return (
                              <div key={sa.id} className={cn(
                                'p-4 border rounded-xl space-y-2',
                                overdue ? 'bg-red-950/20 border-red-800/40' : 'bg-emerald-950/20 border-emerald-800/40'
                              )}>
                                <div className="flex justify-between text-xs text-emerald-400 font-bold">
                                  <span>วิชา: {code} {name}</span>
                                  <span>{sa.periodName || sa.schedule} · {sa.date}</span>
                                </div>
                                <p className="text-xs text-slate-300">ห้องเรียน: <span className="font-bold text-white">{room}</span></p>
                                <p className="text-[10px] text-slate-400">
                                  แทนคุณครู: {sa.originalTeacherName || sa.originalTeacherEmail}
                                  {sa.notes ? <> · งานมอบหมาย: {sa.notes}</> : null}
                                </p>
                                {sa.isCompleted ? (
                                  <div className="text-[10px] text-emerald-400 flex items-center gap-1">
                                    <CheckCircle className="w-3.5 h-3.5" /> บันทึกหลังสอนแล้ว {sa.isLate ? '· ⚠️ ส่งช้ากว่ากำหนด' : '· ตรงเวลา'}
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-between gap-2">
                                    <span className={cn('text-[10px] font-bold', overdue ? 'text-red-400' : 'text-amber-400')}>
                                      {overdue ? '⚠️ เลยเส้นตายบันทึก 24:00 น.' : 'บันทึกหลังสอนก่อน 24:00 น. ของวันสอน'}
                                    </span>
                                    <button
                                      onClick={() => { setSubCompleteTarget(sa); setSubCSummary(''); setSubCProblems(''); setSubCSolutions(''); }}
                                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 shrink-0"
                                    >
                                      <FileText className="w-3 h-3" /> บันทึกหลังสอนแทน
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          });
                      })()}
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
                                <h4 className="text-sm font-bold text-white">{course?.code} {formatCourseTitle(course?.courseName, course?.level, course?.roomName)}</h4>
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
                        <option key={c.id} value={c.id}>{c.code} {formatCourseTitle(c.name, c.level, c.room)}</option>
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

            {dashboardTab === 'teaching-load' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="bg-[#161f30] border border-slate-800/80 rounded-2xl p-6 shadow-xl">
                  <div className="mb-6 border-b border-slate-800 pb-4">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-emerald-400" />
                      ตารางภาระงานสอนรายบุคคลและภาพรวมกลุ่มสาระการเรียนรู้
                    </h3>
                    <p className="text-slate-400 text-sm mt-1">
                      สรุปรายวิชา คาบสอนวิชาการ คาบกิจกรรม และตารางห้องเรียนตามประกาศตารางสอนของโรงเรียน
                    </p>
                  </div>
                  <TeachingLoadTable initialTeacherName={user?.displayName || 'Mr. Kiattisak'} />
                </div>
              </div>
            )}

            {dashboardTab === 'leaderboard' && (
              <ClassroomLeaderboard />
            )}

            {dashboardTab === 'gps-geofence' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                {/* Hero Header Card */}
                <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                  <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="space-y-2">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        ระบบระบุพิกัดดาวเทียมโรงเรียน (GPS Satellite Geofence Active)
                      </div>
                      <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                        เช็คอินลงเวลาปฏิบัติราชการและเข้าเรียนด้วยพิกัดดาวเทียม
                      </h3>
                      <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
                        ระบบตรวจสอบพิกัด Geofence อัตโนมัติ (รัศมี 350 เมตร รอบสถานศึกษา) ป้องกันการปลอมแปลงพิกัด พร้อมบันทึกเวลาจริงและส่งผลการเช็คชื่อเข้าสู่ระบบบริหารสถานศึกษาทันที
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0">
                      <button
                        onClick={() => setIsTeacherGPSModalOpen(true)}
                        className="py-3 px-5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2.5 transition-all cursor-pointer"
                      >
                        <Satellite className="w-4 h-4 animate-spin [animation-duration:8s]" />
                        <span>เปิดหน้าจอเช็คอินสด (Live GPS Clock-in)</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Campus Gate Coordinates & Status Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-[#161f30] border border-slate-800 rounded-2xl p-5 shadow-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[11px] font-bold border border-emerald-500/20">
                        เปิดบริการ 24 ชม.
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-white mb-1">ประตู 1 (หน้าโรงเรียน)</h4>
                    <p className="text-xs text-slate-400 mb-3">ถนนประชานิมิตร • ซุ้มประตูหลักและจุดคัดกรอง</p>
                    <div className="text-[11px] font-mono text-slate-400 pt-2 border-t border-slate-800 flex justify-between">
                      <span>Lat: 17.625620</span>
                      <span>Lng: 100.093200</span>
                    </div>
                  </div>

                  <div className="bg-[#161f30] border border-slate-800 rounded-2xl p-5 shadow-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[11px] font-bold border border-emerald-500/20">
                        เปิดบริการ 24 ชม.
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-white mb-1">ประตู 2 (ด้านหลังโรงเรียน)</h4>
                    <p className="text-xs text-slate-400 mb-3">ซอยแปดวา • จุดจอดรถครูและบุคลากร</p>
                    <div className="text-[11px] font-mono text-slate-400 pt-2 border-t border-slate-800 flex justify-between">
                      <span>Lat: 17.624890</span>
                      <span>Lng: 100.092800</span>
                    </div>
                  </div>

                  <div className="bg-[#161f30] border border-slate-800 rounded-2xl p-5 shadow-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[11px] font-bold border border-emerald-500/20">
                        เปิดบริการ 24 ชม.
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-white mb-1">ประตู 3 (ศูนย์กีฬา/อาคารอเนกประสงค์)</h4>
                    <p className="text-xs text-slate-400 mb-3">ฝั่งสนามกีฬาเฉลิมพระเกียรติ</p>
                    <div className="text-[11px] font-mono text-slate-400 pt-2 border-t border-slate-800 flex justify-between">
                      <span>Lat: 17.625800</span>
                      <span>Lng: 100.094100</span>
                    </div>
                  </div>
                </div>

                {/* Features Banner */}
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>ระบบป้องกันการจำลองพิกัดเสมือน (Anti-Mock Location) และบันทึกประวัติเวลา Real-time</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-indigo-400" />
                    <span>เชื่อมต่อกับระบบเช็คชื่อรายวิชาและแจ้งเตือนผู้ปกครองผ่าน LINE ทันที</span>
                  </div>
                </div>
              </div>
            )}

            {fsLoading && myCourses.length === 0 && dashboardTab === 'courses' && (
              <div className="text-center py-20 border border-dashed border-white/10 rounded-2xl bg-[#151921]">
                <span className="animate-spin text-2xl leading-none inline-block mb-3">⟳</span>
                <p className="text-slate-500">กำลังโหลดตารางสอนจากฐานข้อมูล...</p>
              </div>
            )}
            {!fsLoading && myCourses.length === 0 && dashboardTab === 'courses' && (
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
                            <span className="text-xs text-slate-300">{c.code} {formatCourseTitle(c.name, c.level, c.room)}</span>
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
        <div className="flex flex-1 min-h-0 animate-in fade-in duration-300 relative overflow-hidden">
          
          {/* Mobile Floating Button for Alerts & Warnings */}
          <div className="lg:hidden absolute bottom-4 left-4 z-30">
            <button
              onClick={() => setIsEarlyWarningDrawerOpen(!isEarlyWarningDrawerOpen)}
              className="px-3 py-2 bg-amber-500/90 hover:bg-amber-500 text-slate-950 font-bold text-xs rounded-full shadow-xl border border-amber-300/40 flex items-center gap-1.5 backdrop-blur-md"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>แจ้งเตือน ({criticalStudents.length + warningStudents.length})</span>
            </button>
          </div>

          {/* Collapsible Left Sidebar / Drawer: Alerts & Warnings (Overlay on mobile, inline on desktop) */}
          <aside 
            className={cn(
              "border-r border-white/10 bg-[#0d0f17] flex flex-col shrink-0 transition-all duration-300 ease-in-out select-none z-30",
              // Desktop rules:
              "hidden lg:flex",
              isEarlyWarningDrawerOpen ? "lg:w-80 shadow-2xl" : "lg:w-12 bg-[#0a0c12] hover:bg-[#0f121d]"
            )}
          >
            {isEarlyWarningDrawerOpen ? (
              /* EXPANDED STATE */
              <div className="flex flex-col h-full overflow-y-auto">
                <div className="p-3.5 border-b border-white/10 flex items-center justify-between sticky top-0 bg-[#0d0f17] z-10">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-xs font-bold text-slate-200">Alerts & Warnings</h2>
                      <p className="text-[10px] text-slate-400">ระบบแจ้งเตือน & เฝ้าระวัง</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setIsEarlyWarningDrawerOpen(false)}
                      title="ย่อแถบแจ้งเตือน"
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors flex items-center text-xs gap-1"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span className="text-[11px]">ย่อแถบ</span>
                    </button>
                  </div>
                </div>

                <div className="p-3 border-b border-white/10 bg-slate-900/40 flex items-center justify-between">
                  <button 
                    onClick={() => setView('dashboard')}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-green-400 transition-colors py-0.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> กลับหน้าหลัก
                  </button>
                  {(criticalStudents.length > 0 || warningStudents.length > 0) && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30">
                      {criticalStudents.length + warningStudents.length} รายการ
                    </span>
                  )}
                </div>

                {/* 1. EARLY WARNING HUB (วิกฤต) */}
                <div className="p-4 border-b border-white/10 bg-red-500/10">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-red-400 flex items-center gap-1.5">
                      <AlertOctagon className="w-3.5 h-3.5" /> Early Warning Hub (วิกฤต)
                    </h2>
                    {criticalStudents.length > 0 && (
                      <span className="text-[10px] bg-red-500 text-white font-mono px-1.5 py-0.5 rounded-full font-bold">
                        {criticalStudents.length}
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {criticalStudents.length === 0 ? (
                      <div className="text-xs text-slate-500 py-1">ไม่มีนักเรียนในกลุ่มวิกฤต</div>
                    ) : criticalStudents.map(a => {
                      const student = students.find(s => s.studentId === a.studentId);
                      return (
                        <div key={student?.id || a.studentId} className="p-3 bg-red-950/40 border border-red-500/50 rounded-lg shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-sm font-bold text-white">{student?.name || `รหัส ${a.studentId}`}</span>
                            <span className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded font-mono">{a.subjectAttendanceRate}%</span>
                          </div>
                          <p className="text-[11px] text-red-300">ความเสี่ยงสูงเวลาเรียนไม่พอ</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. แจ้งเตือนระดับเฝ้าระวัง */}
                <div className="p-4 flex-1 overflow-y-auto">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-amber-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" /> แจ้งเตือนระดับเฝ้าระวัง
                    </h2>
                    {warningStudents.length > 0 && (
                      <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 font-mono px-1.5 py-0.5 rounded-full font-bold">
                        {warningStudents.length}
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {warningStudents.length === 0 ? (
                      <div className="text-xs text-slate-500 py-1">ไม่มีนักเรียนในกลุ่มเฝ้าระวัง</div>
                    ) : warningStudents.map(a => {
                      const student = students.find(s => s.studentId === a.studentId);
                      return (
                        <div key={student?.id || a.studentId} className="p-3 bg-amber-950/30 border border-amber-500/40 rounded-lg">
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-sm text-slate-200">{student?.name || `รหัส ${a.studentId}`}</span>
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

                {/* 3. สถิติรวมห้องเรียน */}
                <div className="p-4 bg-slate-900/50 border-t border-white/10 mt-auto">
                  <div className="text-xs text-slate-500 mb-2">สถิติรวมห้องเรียน {activeCourse?.room}</div>
                  <div className="flex items-end gap-2">
                    <span className="text-2xl font-bold text-green-400">{avgAttendance}%</span>
                    <span className="text-xs text-slate-400 pb-1">ค่าเฉลี่ยการเข้าเรียน</span>
                  </div>
                </div>
              </div>
            ) : (
              /* COLLAPSED STATE (Default) - Vertical Bar with Label & Icon */
              <div 
                onClick={() => setIsEarlyWarningDrawerOpen(true)}
                className="h-full flex flex-col items-center justify-between py-4 cursor-pointer hover:bg-slate-800/40 transition-colors group"
                title="คลิกเพื่อเปิด Alerts & Warnings (แจ้งเตือนเฝ้าระวัง)"
              >
                {/* Top Icon & Indicator */}
                <div className="flex flex-col items-center gap-2">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEarlyWarningDrawerOpen(true);
                    }}
                    className="w-8 h-8 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 flex items-center justify-center transition-all group-hover:scale-105 relative"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    {(criticalStudents.length > 0 || warningStudents.length > 0) && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                    )}
                  </button>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white transition-colors" />
                </div>

                {/* Middle Vertical Label */}
                <div className="flex-1 flex items-center justify-center py-6">
                  <div className="[writing-mode:vertical-rl] rotate-180 flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-400 group-hover:text-amber-300 transition-colors whitespace-nowrap">
                    <span className="uppercase text-[11px] font-bold text-slate-300 group-hover:text-white">Alerts & Warnings</span>
                    <span className="text-[10px] text-slate-500 font-normal">แจ้งเตือนเฝ้าระวัง</span>
                    {(criticalStudents.length > 0 || warningStudents.length > 0) && (
                      <span className="bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold">
                        {criticalStudents.length + warningStudents.length}
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom Stats Mini Badge */}
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[10px] font-mono font-bold text-green-400 group-hover:scale-110 transition-transform">
                    {avgAttendance}%
                  </span>
                  <span className="text-[8px] text-slate-500">เฉลี่ย</span>
                </div>
              </div>
            )}
          </aside>

          {/* Mobile Overlay Drawer for Alerts & Warnings */}
          {isEarlyWarningDrawerOpen && (
            <div className="lg:hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex">
              <div className="w-4/5 max-w-sm bg-[#0d0f17] h-full flex flex-col shadow-2xl border-r border-white/10 animate-in slide-in-from-left duration-200">
                <div className="p-4 border-b border-white/10 flex items-center justify-between bg-[#0d0f17]">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                    <div>
                      <h2 className="text-sm font-bold text-slate-200">Alerts & Warnings</h2>
                      <p className="text-[10px] text-slate-400">ระบบแจ้งเตือน & เฝ้าระวัง</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsEarlyWarningDrawerOpen(false)}
                    className="p-1 text-slate-400 hover:text-white rounded-lg"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                </div>
                
                {/* Warnings List on Mobile */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  <div className="text-xs font-bold text-red-400 flex items-center gap-1.5">
                    <AlertOctagon className="w-4 h-4" /> วิกฤตเวลาเรียนไม่พอ ({criticalStudents.length})
                  </div>
                  {criticalStudents.length === 0 ? (
                    <div className="text-xs text-slate-500">ไม่มีนักเรียนในกลุ่มวิกฤต</div>
                  ) : criticalStudents.map(a => {
                    const student = students.find(s => s.studentId === a.studentId);
                    return (
                      <div key={student?.id || a.studentId} className="p-3 bg-red-950/40 border border-red-500/50 rounded-xl">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-sm font-bold text-white">{student?.name || `รหัส ${a.studentId}`}</span>
                          <span className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded font-mono">{a.subjectAttendanceRate}%</span>
                        </div>
                        <p className="text-[11px] text-red-300">ความเสี่ยงสูงเวลาเรียนไม่พอ</p>
                      </div>
                    );
                  })}

                  <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5 pt-3 border-t border-white/10">
                    <AlertTriangle className="w-4 h-4" /> ระดับเฝ้าระวัง ({warningStudents.length})
                  </div>
                  {warningStudents.length === 0 ? (
                    <div className="text-xs text-slate-500">ไม่มีนักเรียนในกลุ่มเฝ้าระวัง</div>
                  ) : warningStudents.map(a => {
                    const student = students.find(s => s.studentId === a.studentId);
                    return (
                      <div key={student?.id || a.studentId} className="p-3 bg-amber-950/30 border border-amber-500/40 rounded-xl">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-sm text-slate-200">{student?.name || `รหัส ${a.studentId}`}</span>
                          <span className="text-xs font-mono text-amber-400">{a.subjectAttendanceRate}%</span>
                        </div>
                        <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden mt-1">
                          <div className="bg-amber-500 h-full" style={{ width: `${a.subjectAttendanceRate}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="p-4 bg-slate-900 border-t border-white/10 flex justify-between items-center">
                  <span className="text-xs text-slate-400">ค่าเฉลี่ยเข้าเรียน</span>
                  <span className="text-xl font-bold text-green-400">{avgAttendance}%</span>
                </div>
              </div>
              <div className="flex-1" onClick={() => setIsEarlyWarningDrawerOpen(false)} />
            </div>
          )}

          {/* Main Seating Manager with Categories, Layout Templates, Locking & Random Picker */}
          <main className="flex-1 flex flex-col overflow-hidden">
            <ClassroomSeatingManager
              course={activeCourse}
              students={students}
              onBackToDashboard={() => { setActiveCourse(null); setRetroactiveAttendanceMode(false); }}
              onSelectStudentDetail={(s) => setAssessmentModalStudent(s)}
              attendanceOnly={retroactiveAttendanceMode}
            />
          </main>
        </div>
      )}

      {view === 'active_learning' && activeCourse && (
        <ActiveLearningClassroom 
          course={activeCourse} 
          students={courseStudents} 
          onBack={() => setView('dashboard')} 
        />
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
                <button
                  onClick={() => {
                    setAssessmentModalStudent(selectedStudentForScore);
                    setSelectedStudentForScore(null);
                  }}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-colors shadow-lg flex items-center justify-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5" /> ดูข้อมูลวิเคราะห์ตนเอง
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Late Attendance Request Modal */}
      {showLateModal && latePeriod && (
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
                  <span className="font-bold text-white">{latePeriod.subjectCode} {latePeriod.subjectName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">ระดับชั้น:</span>
                  <span className="font-bold text-white">{latePeriod.level || latePeriod.className}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">คาบที่:</span>
                  <span className="font-bold text-amber-400">คาบ {latePeriod.periodNumber}{latePeriod.room ? ` · ห้อง ${latePeriod.room}` : ''}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">วันสอน:</span>
                  <span className="font-bold text-white">{todayStr}</span>
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
                  disabled={!lateReason.trim() || lateSubmitting}
                  className="w-full bg-[#3b2211] border border-amber-800/60 text-amber-400 hover:bg-[#4a2b16] disabled:opacity-50 font-bold py-3 rounded-xl transition-all shadow-[0_4px_15px_rgba(245,158,11,0.2)]"
                >
                  {lateSubmitting ? 'กำลังส่ง...' : 'ส่งคำขอให้รองผู้อำนวยการฝ่ายวิชาการ'}
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
                <span>วันเวลาที่บันทึก: {viewingRecord?.submittedAt ? new Date(viewingRecord.submittedAt).toLocaleString('th-TH') : '-'}</span>
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

      {/* Student Self-Assessment Detail Modal */}
      {assessmentModalStudent && (
        <StudentAssessmentDetailModal
          student={assessmentModalStudent}
          assessment={useStore.getState().selfAssessments[assessmentModalStudent.studentId]}
          viewerRole="TEACHER"
          onClose={() => setAssessmentModalStudent(null)}
        />
      )}

      {/* Teacher GPS Satellite Geofence Modal */}
      <GPSGeofenceCheckinModal
        isOpen={isTeacherGPSModalOpen}
        onClose={() => setIsTeacherGPSModalOpen(false)}
      />

      {/* บันทึกหลังสอนแทน (deadline ก่อน 24:00 น. ของวันที่สอน) */}
      <AnimatePresence>
        {subCompleteTarget && (
          <div className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#111622] border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-8"
            >
              <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-400" /> บันทึกหลังสอนแทน
                </h3>
                <button onClick={() => setSubCompleteTarget(null)} className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="text-xs text-slate-300 bg-slate-950/40 rounded-xl p-3 border border-slate-800/80">
                {subCompleteTarget.courseCode} {subCompleteTarget.courseName} · {subCompleteTarget.room} · {subCompleteTarget.date}<br />
                แทนคุณครู {subCompleteTarget.originalTeacherName || subCompleteTarget.originalTeacherEmail}
                {subCompleteTarget.postTeachingDueAt && Date.now() > new Date(subCompleteTarget.postTeachingDueAt).getTime() && (
                  <span className="block mt-1 text-red-400 font-bold">⚠️ เลยเส้นตาย 24:00 น. ของวันที่สอน — จะถูก flag เป็น overdue</span>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">สรุปเนื้อหาที่สอนแทน <span className="text-red-500">*</span></label>
                <textarea rows={3} value={subCSummary} onChange={e => setSubCSummary(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-emerald-500 font-semibold" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">ปัญหา/อุปสรรค</label>
                  <textarea rows={2} value={subCProblems} onChange={e => setSubCProblems(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-emerald-500 font-semibold" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">แนวทางแก้ไข/ข้อแนะนำ</label>
                  <textarea rows={2} value={subCSolutions} onChange={e => setSubCSolutions(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-emerald-500 font-semibold" />
                </div>
              </div>
              <div className="flex gap-2.5 justify-end pt-3 border-t border-slate-800/50">
                <button onClick={() => setSubCompleteTarget(null)} className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-slate-400">ยกเลิก</button>
                <button
                  onClick={handleSubmitSubCompletion} disabled={subCSubmitting || !subCSummary.trim()}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-black flex items-center gap-1.5"
                >
                  <CheckCircle className="w-3.5 h-3.5" /> {subCSubmitting ? 'กำลังบันทึก...' : 'ส่งบันทึกหลังสอนแทน'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
