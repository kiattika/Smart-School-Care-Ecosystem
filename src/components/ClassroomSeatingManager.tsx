import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Sparkles, 
  Lock, 
  Unlock, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Plus, 
  Minus, 
  Layers, 
  LayoutGrid, 
  FlaskConical, 
  Sun, 
  Monitor, 
  Sliders, 
  Move,
  RotateCcw,
  Check,
  ShieldCheck,
  UserCheck,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ArrowRightLeft,
  X,
  GripVertical,
  Hand
} from 'lucide-react';
import { Student, Course, AttendanceStatus } from '../types';
import { cn, isSameRoom, formatRoomName } from '../lib/utils';
import { useStore } from '../store';
import { REAL_STUDENTS } from '../data/realStudents';
import { RandomStudentPickerModal } from './RandomStudentPickerModal';

export type SeatingCategory = 'CLASSROOM' | 'LABORATORY' | 'OUTDOOR';
export type ClassroomTemplate = '2-2-2-2' | '3-3-2' | '2-3-3' | '3-2-3' | '1-3-3-1' | 'COMPUTER_LAB';

export interface SavedSeatingLayout {
  subjectId: string;
  classId: string;
  seatingCategory: SeatingCategory;
  classroomTemplate: ClassroomTemplate;
  groupCount: number;
  capacity: number;
  zoomScale: number;
  seatAssignments: Record<string, number | null>;
  isLocked: boolean;
  savedAt: string;
}

interface ClassroomSeatingManagerProps {
  course?: Course | null;
  students: Student[];
  onBackToDashboard?: () => void;
  onSelectStudentDetail?: (student: Student) => void;
}

export const ClassroomSeatingManager: React.FC<ClassroomSeatingManagerProps> = ({
  course: propCourse,
  students,
  onBackToDashboard,
  onSelectStudentDetail
}) => {
  const course = propCourse || {
    id: 'course-m58-default',
    code: 'ว32204',
    name: 'ฟิสิกส์ 4 (ม.5/8)',
    room: 'ม.5/8',
    term: '1/2569',
    studentsCount: 36,
    schedule: 'จ1-2, พ3-4'
  };

  const { 
    attendanceRecords, 
    setAttendanceStatus, 
    moveStudentSeat, 
    resetClassroomSeats, 
    autoAssignClassroomSeats,
    adjustBehaviorScore, 
    addActiveLearningPoints,
    activeLearningPoints,
    markAttendanceDone,
    analytics
  } = useStore();

  // 1. Seating Category & Template Selection
  const [seatingCategory, setSeatingCategory] = useState<SeatingCategory>('CLASSROOM');
  const [classroomTemplate, setClassroomTemplate] = useState<ClassroomTemplate>('2-2-2-2');
  
  // 1.1 Dynamic Group / Table Count for Lab & Outdoor Modes (Default: 6)
  const [groupCount, setGroupCount] = useState<number>(6);

  // 1.2 Layout Persistence & Locked Status per subjectId + classId
  const courseSubjectId = course?.code || course?.id || 'default-subject';
  const courseClassId = course?.room || 'ม.5/8';
  const layoutStorageKey = `smartschool_seating_layout_${courseSubjectId}_${courseClassId}`;

  // Helper to load saved layout from localStorage
  const loadSavedLayout = (): SavedSeatingLayout | null => {
    try {
      const raw = localStorage.getItem(layoutStorageKey);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.error('Error loading saved layout:', e);
    }
    return null;
  };

  // State: isLayoutLocked defaults to true if a saved layout exists for current subject + class
  const [isLayoutLocked, setIsLayoutLocked] = useState<boolean>(() => {
    const saved = loadSavedLayout();
    return saved !== null ? (saved.isLocked ?? true) : false;
  });

  const [layoutNotice, setLayoutNotice] = useState<string | null>(null);

  // 2. Dynamic Capacity Configuration (up to 48 seats)
  const [capacity, setCapacity] = useState<number>(40);

  // 2.1 Seat Block Size / Zoom Scale Controls (80% to 140%, default 100%)
  const [zoomScale, setZoomScale] = useState<number>(100);

  // Dynamic Seat Dimensions based on zoomScale and screen width
  const seatBlockWidth = useMemo(() => {
    // Base width: 155px for 100% zoom
    return Math.round(155 * (zoomScale / 100));
  }, [zoomScale]);

  const seatBlockMinHeight = useMemo(() => {
    // Base height: 150px for 100% zoom
    return Math.round(150 * (zoomScale / 100));
  }, [zoomScale]);

  // Sync layout from storage on mount or when subject/class changes
  useEffect(() => {
    const saved = loadSavedLayout();
    if (saved) {
      if (saved.seatingCategory) setSeatingCategory(saved.seatingCategory);
      if (saved.classroomTemplate) setClassroomTemplate(saved.classroomTemplate);
      if (saved.groupCount) setGroupCount(saved.groupCount);
      if (saved.capacity) setCapacity(saved.capacity);
      if (saved.zoomScale) setZoomScale(saved.zoomScale);
      setIsLayoutLocked(saved.isLocked ?? true);

      // Restore saved seat positions if available
      if (saved.seatAssignments) {
        Object.entries(saved.seatAssignments).forEach(([stId, seatIdx]) => {
          const st = courseStudents.find(s => s.studentId === stId);
          if (st && st.seatIndex !== seatIdx) {
            moveStudentSeat(stId, seatIdx);
          }
        });
      }
    }
  }, [layoutStorageKey]);

  // Handler to Save & Lock Layout
  const handleSaveAndLockLayout = () => {
    const seatAssignments: Record<string, number | null> = {};
    courseStudents.forEach(s => {
      seatAssignments[s.studentId] = s.seatIndex ?? null;
    });

    const layoutToSave: SavedSeatingLayout = {
      subjectId: courseSubjectId,
      classId: courseClassId,
      seatingCategory,
      classroomTemplate,
      groupCount,
      capacity,
      zoomScale,
      seatAssignments,
      isLocked: true,
      savedAt: new Date().toISOString()
    };

    try {
      localStorage.setItem(layoutStorageKey, JSON.stringify(layoutToSave));
    } catch (e) {
      console.error('Error saving seating layout:', e);
    }

    setIsLayoutLocked(true);
    setLayoutNotice('บันทึกและล็อกผังที่นั่งเรียบร้อยแล้วสำหรับภาคเรียนนี้');
    setTimeout(() => setLayoutNotice(null), 3500);
  };

  // Filter students for this course/room with robust multi-layer fallback
  const courseStudents = useMemo(() => {
    const targetRoom = course?.room || 'ม.5/8';

    // 1. Try exact or normalized room match in provided students
    let matched = (students || []).filter(s => 
      isSameRoom(s.room, targetRoom) || 
      isSameRoom((s as any).className, targetRoom)
    );

    // 2. If room has no match in provided students array, fallback to 5/8 in store
    if (matched.length === 0) {
      matched = (students || []).filter(s => 
        isSameRoom(s.room, 'ม.5/8') || 
        isSameRoom(s.room, '5/8')
      );
    }

    // 3. If still empty (e.g., initial state was unseeded), use REAL_STUDENTS data
    if (matched.length === 0) {
      matched = REAL_STUDENTS.filter(s => isSameRoom(s.room, targetRoom));
      if (matched.length === 0) {
        matched = REAL_STUDENTS.filter(s => isSameRoom(s.room, 'ม.5/8'));
      }
    }

    return matched;
  }, [course?.room, students]);

  // Auto-Unassign Logic: When capacity is reduced, unassign students sitting at seatIndex >= capacity
  const prevCapacityRef = useRef<number>(capacity);
  useEffect(() => {
    if (capacity < prevCapacityRef.current) {
      // Find students whose seatIndex is >= new capacity
      courseStudents.forEach(student => {
        if (student.seatIndex !== null && student.seatIndex !== undefined && student.seatIndex >= capacity) {
          moveStudentSeat(student.studentId, null);
        }
      });
    }
    prevCapacityRef.current = capacity;
  }, [capacity, courseStudents, moveStudentSeat]);

  // Handler for category change with automatic template and default capacity calculation
  const handleSelectCategory = (newCat: SeatingCategory) => {
    setSeatingCategory(newCat);
    if (newCat === 'CLASSROOM') {
      setClassroomTemplate('2-2-2-2');
      setCapacity(40);
    } else if (newCat === 'LABORATORY') {
      const defaultTables = 6;
      setGroupCount(defaultTables);
      const studentTotal = Math.max(courseStudents.length, 24);
      const seatsPerTable = Math.max(4, Math.ceil(studentTotal / defaultTables));
      setCapacity(defaultTables * seatsPerTable);
    } else if (newCat === 'OUTDOOR') {
      const defaultGroups = 6;
      setGroupCount(defaultGroups);
      const studentTotal = Math.max(courseStudents.length, 24);
      const seatsPerGrp = Math.max(4, Math.ceil(studentTotal / defaultGroups));
      setCapacity(defaultGroups * seatsPerGrp);
    }
  };

  // Handler for dynamic group/table count change (divides student count by group number)
  const handleGroupCountChange = (newCount: number) => {
    const count = Math.max(2, Math.min(12, newCount));
    setGroupCount(count);
    
    // Automatically divide student count by this group/table number to determine average group size
    const studentTotal = Math.max(courseStudents.length, 20);
    const avgSeatsPerGroup = Math.max(3, Math.ceil(studentTotal / count));
    const calculatedCapacity = count * avgSeatsPerGroup;
    setCapacity(calculatedCapacity);
  };

  // Handler for classroom template change with dynamic column and capacity alignment
  const handleSelectTemplate = (tpl: ClassroomTemplate) => {
    setClassroomTemplate(tpl);
    if (tpl === 'COMPUTER_LAB') {
      setCapacity(35); // 5 rows * 7 cols
    } else {
      setCapacity(40); // 5 rows * 8 cols
    }
  };
  
  // 3. Attendance Locking & Editing Control
  // If course already has attendance marked or saved, default to locked
  const courseId = course?.id || 'default-course';
  const currentCourseRecords = attendanceRecords[courseId] || {};
  const hasExistingRecords = Object.keys(currentCourseRecords).length > 0;
  const isInitiallyLocked = course?.attendanceTaken || hasExistingRecords;
  
  const [isAttendanceLocked, setIsAttendanceLocked] = useState<boolean>(isInitiallyLocked);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<boolean>(false);

  // 4. Random Student Picker Modal State
  const [showRandomPicker, setShowRandomPicker] = useState<boolean>(false);
  const [highlightedStudentIds, setHighlightedStudentIds] = useState<string[]>([]);

  // 5. Touch Gestures & Mobile Drag-and-Drop State
  const [touchDragState, setTouchDragState] = useState<{
    student: Student;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    fromSeatIndex: number | null;
    isDragging: boolean;
    hoveredSeatIndex: number | null;
    isHoveringUnassigned: boolean;
  } | null>(null);

  const touchDragRef = useRef<{
    student: Student;
    startX: number;
    startY: number;
    fromSeatIndex: number | null;
    isDragging: boolean;
    hoveredSeatIndex: number | null;
    isHoveringUnassigned: boolean;
  } | null>(null);

  // 6. Mobile Tap-to-Move / Tap-to-Swap Mode & Mobile Pool Drawer
  const [selectedStudentForMove, setSelectedStudentForMove] = useState<Student | null>(null);
  const [isMobilePoolOpen, setIsMobilePoolOpen] = useState<boolean>(false);

  // Touch Event Handlers
  const handleTouchStart = (e: React.TouchEvent, student: Student, fromSeatIndex: number | null) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    touchDragRef.current = {
      student,
      startX: touch.clientX,
      startY: touch.clientY,
      fromSeatIndex,
      isDragging: false,
      hoveredSeatIndex: null,
      isHoveringUnassigned: false
    };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchDragRef.current) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchDragRef.current.startX;
    const deltaY = touch.clientY - touchDragRef.current.startY;
    const dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (dist > 8 || touchDragRef.current.isDragging) {
      if (!touchDragRef.current.isDragging) {
        touchDragRef.current.isDragging = true;
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try { navigator.vibrate(30); } catch (_) {}
        }
      }

      if (e.cancelable) {
        e.preventDefault();
      }

      // Check drop target element under finger
      const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
      let hoveredSeat: number | null = null;
      let isHoveringUnassigned = false;

      if (targetEl) {
        const seatContainer = targetEl.closest('[data-seat-index]');
        if (seatContainer) {
          const rawIdx = seatContainer.getAttribute('data-seat-index');
          if (rawIdx !== null) {
            const parsed = parseInt(rawIdx, 10);
            if (!isNaN(parsed) && parsed >= 0) {
              hoveredSeat = parsed;
            }
          }
        } else {
          const unassignedZone = targetEl.closest('[data-drop-zone="unassigned"]');
          if (unassignedZone) {
            isHoveringUnassigned = true;
          }
        }
      }

      touchDragRef.current.hoveredSeatIndex = hoveredSeat;
      touchDragRef.current.isHoveringUnassigned = isHoveringUnassigned;

      setTouchDragState({
        student: touchDragRef.current.student,
        startX: touchDragRef.current.startX,
        startY: touchDragRef.current.startY,
        currentX: touch.clientX,
        currentY: touch.clientY,
        fromSeatIndex: touchDragRef.current.fromSeatIndex,
        isDragging: true,
        hoveredSeatIndex: hoveredSeat,
        isHoveringUnassigned
      });
    }
  };

  const handleTouchEnd = () => {
    if (touchDragRef.current?.isDragging) {
      const { student, hoveredSeatIndex, isHoveringUnassigned, fromSeatIndex } = touchDragRef.current;
      
      if (hoveredSeatIndex !== null && hoveredSeatIndex !== fromSeatIndex) {
        moveStudentSeat(student.studentId, hoveredSeatIndex);
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try { navigator.vibrate([40, 25, 60]); } catch (_) {}
        }
        setLayoutNotice(`ย้าย ${student.fullName || student.name} ไปยังโต๊ะที่ ${hoveredSeatIndex + 1} แล้ว`);
        setTimeout(() => setLayoutNotice(null), 2500);
      } else if (isHoveringUnassigned && fromSeatIndex !== null) {
        moveStudentSeat(student.studentId, null);
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try { navigator.vibrate(30); } catch (_) {}
        }
        setLayoutNotice(`นำ ${student.fullName || student.name} ออกจากที่นั่งแล้ว`);
        setTimeout(() => setLayoutNotice(null), 2500);
      }
    }

    touchDragRef.current = null;
    setTouchDragState(null);
  };

  const unassignedStudents = courseStudents.filter(s => s.seatIndex === null || s.seatIndex === undefined);

  // Layout Calculations based on category and template
  const getLayoutConfiguration = () => {
    if (seatingCategory === 'CLASSROOM') {
      if (classroomTemplate === '2-2-2-2') {
        return {
          totalRows: Math.ceil(capacity / 8),
          totalCols: 8,
          aisleAfterCols: [2, 4, 6],
          blockPattern: [2, 2, 2, 2],
          label: '2-2-2-2 (บล็อกละ 2 ที่นั่ง ทางเดินกลาง)'
        };
      }
      if (classroomTemplate === '3-3-2') {
        return {
          totalRows: Math.ceil(capacity / 8),
          totalCols: 8,
          aisleAfterCols: [3, 6],
          blockPattern: [3, 3, 2],
          label: '3-3-2 (แถว 3 - 3 - 2 ทางเดินคู่)'
        };
      }
      if (classroomTemplate === '2-3-3') {
        return {
          totalRows: Math.ceil(capacity / 8),
          totalCols: 8,
          aisleAfterCols: [2, 5],
          blockPattern: [2, 3, 3],
          label: '2-3-3 (แถว 2 - 3 - 3 ทางเดินคู่)'
        };
      }
      if (classroomTemplate === '3-2-3') {
        return {
          totalRows: Math.ceil(capacity / 8),
          totalCols: 8,
          aisleAfterCols: [3, 5],
          blockPattern: [3, 2, 3],
          label: '3-2-3 (แถว 3 - 2 - 3 สมมาตร)'
        };
      }
      if (classroomTemplate === '1-3-3-1') {
        return {
          totalRows: Math.ceil(capacity / 8),
          totalCols: 8,
          aisleAfterCols: [1, 4, 7],
          blockPattern: [1, 3, 3, 1],
          label: '1-3-3-1 (เดี่ยวริม กลุ่ม 3 กลาง)'
        };
      }
      // Computer Lab
      return {
        totalRows: Math.ceil(capacity / 7),
        totalCols: 7,
        aisleAfterCols: [1, 2, 3, 4, 5, 6],
        blockPattern: [1, 1, 1, 1, 1, 1, 1],
        label: 'Computer Lab (โต๊ะคอมพิวเตอร์รายบุคคล)'
      };
    }

    if (seatingCategory === 'LABORATORY') {
      // 6 lab island tables, 6-7 seats each
      return {
        totalRows: 3,
        totalCols: 2,
        tablesCount: 6,
        seatsPerTable: Math.ceil(capacity / 6),
        label: 'ห้องปฏิบัติการวิทยาศาสตร์ (6 โต๊ะทดลองกลุ่ม)'
      };
    }

    // Outdoor / Field
    return {
      totalRows: 4,
      totalCols: 3,
      groupsCount: 4,
      seatsPerGroup: Math.ceil(capacity / 4),
      label: 'สนาม / กิจกรรมกลุ่มกลางแจ้ง (Free-form / Circles)'
    };
  };

  const layout = getLayoutConfiguration();

  // Generate real desk / table groups for the current classroom layout
  const getClassroomDeskGroups = () => {
    const groups: {
      id: string;
      name: string;
      tableNumber: number;
      icon?: string;
      seatIndices: number[];
      students: Student[];
    }[] = [];

    if (seatingCategory === 'CLASSROOM') {
      const totalCols = layout.totalCols || 8;
      const totalRows = layout.totalRows || Math.ceil(capacity / totalCols);
      let tableCounter = 1;

      for (let r = 0; r < totalRows; r++) {
        let colPointer = 0;
        const pattern = layout.blockPattern || [2, 2, 2, 2];
        
        pattern.forEach((blockSize, bIdx) => {
          const seatIndices: number[] = [];
          for (let i = 0; i < blockSize; i++) {
            const c = colPointer + i;
            if (c < totalCols) {
              const seatIdx = r * totalCols + c;
              if (seatIdx < capacity) {
                seatIndices.push(seatIdx);
              }
            }
          }
          colPointer += blockSize;

          if (seatIndices.length > 0) {
            const tableStudents = courseStudents.filter(s => s.seatIndex !== null && s.seatIndex !== undefined && seatIndices.includes(s.seatIndex));
            groups.push({
              id: `table-r${r + 1}-b${bIdx + 1}`,
              name: `โต๊ะที่ ${tableCounter} (แถว ${r + 1} โต๊ะ ${bIdx + 1})`,
              tableNumber: tableCounter,
              icon: '🪑',
              seatIndices,
              students: tableStudents
            });
            tableCounter++;
          }
        });
      }
    } else if (seatingCategory === 'LABORATORY') {
      const totalTables = groupCount;
      const baseSeats = Math.floor(capacity / totalTables);
      const extraSeats = capacity % totalTables;
      let startIndex = 0;

      for (let t = 0; t < totalTables; t++) {
        const seatsAtThisTable = baseSeats + (t < extraSeats ? 1 : 0);
        const seatIndices: number[] = [];
        for (let s = 0; s < seatsAtThisTable; s++) {
          const idx = startIndex + s;
          if (idx < capacity) seatIndices.push(idx);
        }
        startIndex += seatsAtThisTable;

        const tableStudents = courseStudents.filter(st => st.seatIndex !== null && st.seatIndex !== undefined && seatIndices.includes(st.seatIndex));
        groups.push({
          id: `lab-station-${t + 1}`,
          name: `โต๊ะทดลองแล็บที่ ${t + 1} (Station #${t + 1})`,
          tableNumber: t + 1,
          icon: '🔬',
          seatIndices,
          students: tableStudents
        });
      }
    } else if (seatingCategory === 'OUTDOOR') {
      const totalBases = groupCount;
      const baseColors = [
        'ทีมสีแดง (Base A)',
        'ทีมสีน้ำเงิน (Base B)',
        'ทีมสีเขียว (Base C)',
        'ทีมสีเหลือง (Base D)',
        'ทีมสีส้ม (Base E)',
        'ทีมสีม่วง (Base F)',
        'ทีมสีชมพู (Base G)',
        'ทีมสีฟ้า (Base H)',
        'ทีมสีขาว (Base I)',
        'ทีมสีทอง (Base J)',
        'ทีมสีเงิน (Base K)',
        'ทีมสีมรกต (Base L)'
      ];
      const baseSeats = Math.floor(capacity / totalBases);
      const extraSeats = capacity % totalBases;
      let startIndex = 0;

      for (let b = 0; b < totalBases; b++) {
        const seatsPerBase = baseSeats + (b < extraSeats ? 1 : 0);
        const seatIndices: number[] = [];
        for (let s = 0; s < seatsPerBase; s++) {
          const idx = startIndex + s;
          if (idx < capacity) seatIndices.push(idx);
        }
        startIndex += seatsPerBase;

        const tableStudents = courseStudents.filter(st => st.seatIndex !== null && st.seatIndex !== undefined && seatIndices.includes(st.seatIndex));
        groups.push({
          id: `outdoor-base-${b + 1}`,
          name: `กลุ่มสนามที่ ${b + 1}: ${baseColors[b] || `กลุ่ม ${b + 1}`}`,
          tableNumber: b + 1,
          icon: '🏕️',
          seatIndices,
          students: tableStudents
        });
      }
    }

    return groups;
  };

  const deskGroups = getClassroomDeskGroups();

  // Handle Save Attendance
  const handleSaveAttendance = () => {
    setIsSaving(true);
    markAttendanceDone(course.id);
    setTimeout(() => {
      setIsSaving(false);
      setIsAttendanceLocked(true);
      setSaveSuccessNotice(true);
      setTimeout(() => setSaveSuccessNotice(false), 3500);
    }, 500);
  };

  // Quick stats
  const presentCount = courseStudents.filter(s => (currentCourseRecords[s.studentId] || 'UNMARKED') === 'PRESENT').length;
  const lateCount = courseStudents.filter(s => currentCourseRecords[s.studentId] === 'LATE').length;
  const leaveCount = courseStudents.filter(s => currentCourseRecords[s.studentId] === 'LEAVE').length;
  const absentCount = courseStudents.filter(s => currentCourseRecords[s.studentId] === 'ABSENT').length;
  const unmarkedCount = courseStudents.filter(s => !currentCourseRecords[s.studentId] || currentCourseRecords[s.studentId] === 'UNMARKED').length;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#080b13] text-slate-100 overflow-hidden">
      
      {/* Top Controls Header Bar */}
      <header className="bg-[#0f1422] border-b border-white/10 px-3 sm:px-6 py-2.5 sm:py-3.5 flex flex-wrap items-center justify-between gap-3 sm:gap-4 shrink-0 shadow-lg z-20">
        
        {/* Left: Course & Class Info */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold shadow-md shrink-0">
            <LayoutGrid className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight truncate">
                {course.name} ({course.room || 'ม.5/8'})
              </h2>
              <span className="text-[10px] sm:text-xs font-mono px-1.5 sm:px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-md font-semibold shrink-0">
                {course.code}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400 flex items-center gap-1.5 sm:gap-2 mt-0.5 truncate">
              <span>นักเรียน {courseStudents.length} คน</span>
              <span>•</span>
              <span>ผังที่นั่ง {capacity} ที่</span>
            </p>
          </div>
        </div>

        {/* Center: Attendance Summary Badges */}
        <div className="hidden sm:flex items-center gap-1.5 sm:gap-2 text-xs">
          <span className="px-2 sm:px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl font-bold flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            มา {presentCount}
          </span>
          <span className="px-2 sm:px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl font-bold flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            สาย {lateCount}
          </span>
          <span className="px-2 sm:px-2.5 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl font-bold flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            ลา {leaveCount}
          </span>
          <span className="px-2 sm:px-2.5 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-xl font-bold flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            ขาด {absentCount}
          </span>
        </div>

        {/* Right: Action Buttons */}
        <div className="flex items-center gap-2 shrink-0 ml-auto sm:ml-0">
          
          {/* Mobile Unassigned Students Pool Button */}
          {unassignedStudents.length > 0 && (
            <button
              id="btn-mobile-unassigned-pool-trigger"
              onClick={() => setIsMobilePoolOpen(true)}
              className="md:hidden px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-1.5 active:scale-95 cursor-pointer border border-indigo-400/40"
              title="เปิดรายชื่อนักเรียนที่ยังไม่มีที่นั่ง"
            >
              <Users className="w-3.5 h-3.5" />
              <span>รอนั่ง ({unassignedStudents.length})</span>
            </button>
          )}

          {/* Random Student Picker Button */}
          <button
            onClick={() => setShowRandomPicker(true)}
            className="px-2.5 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-lg shadow-amber-500/20 flex items-center gap-1.5 sm:gap-2 active:scale-95 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">สุ่มนักเรียน</span>
            <span className="sm:hidden">สุ่ม</span>
          </button>

          {/* Attendance Lock / Unlock / Save Button */}
          {isAttendanceLocked ? (
            <button
              onClick={() => setIsAttendanceLocked(false)}
              className="px-2.5 sm:px-4 py-1.5 sm:py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 border border-amber-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-md"
              title="ปลดล็อคเพื่อแก้ไขการเช็กชื่อของนักเรียน"
            >
              <Unlock className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">ขอแก้ไขข้อมูล</span>
              <span className="sm:hidden">แก้ไข</span>
            </button>
          ) : (
            <button
              onClick={handleSaveAttendance}
              disabled={isSaving}
              className="px-3 sm:px-4 py-1.5 sm:py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-lg shadow-emerald-600/20"
            >
              {isSaving ? (
                <>
                  <Clock className="w-3.5 h-3.5 animate-spin" />
                  <span>บันทึก...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>บันทึกการเช็คชื่อ</span>
                </>
              )}
            </button>
          )}

        </div>

      </header>

      {/* Seating Layout Control Toolbar (Categories, Templates & Capacity) or Locked Banner */}
      {isLayoutLocked ? (
        <div className="bg-[#121829] border-b border-white/10 px-6 py-2.5 flex flex-wrap items-center justify-between gap-4 text-xs z-10 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
              <Lock className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                <span>🔒 ผังที่นั่งถูกบันทึกและล็อกไว้แล้วสำหรับภาคเรียนนี้</span>
              </span>
              <span className="text-slate-600 hidden sm:inline">•</span>
              <span className="px-2.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-[11px] font-semibold flex items-center gap-1">
                {seatingCategory === 'CLASSROOM' ? (
                  <>
                    <LayoutGrid className="w-3 h-3" />
                    ห้องเรียน (เทมเพลต {classroomTemplate === 'COMPUTER_LAB' ? 'คอมพิวเตอร์' : classroomTemplate})
                  </>
                ) : seatingCategory === 'LABORATORY' ? (
                  <>
                    <FlaskConical className="w-3 h-3" />
                    ห้องปฏิบัติการ ({groupCount} โต๊ะทดลอง)
                  </>
                ) : (
                  <>
                    <Sun className="w-3 h-3" />
                    กิจกรรมสนาม ({groupCount} ฐานกิจกรรม)
                  </>
                )}
              </span>
              <span className="text-[11px] text-slate-400 font-mono hidden md:inline">
                ความจุ {capacity} ที่นั่ง ({courseStudents.filter(s => s.seatIndex !== null && s.seatIndex !== undefined).length}/{courseStudents.length} คนมีที่นั่ง)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Zoom Controls */}
            <div className="flex items-center gap-1.5 bg-slate-900/80 px-2.5 py-1 rounded-xl border border-white/10">
              <Maximize2 className="w-3 h-3 text-indigo-400" />
              <span className="text-slate-400 text-[10.5px]">Zoom:</span>
              <button
                onClick={() => setZoomScale(prev => Math.max(50, prev - 10))}
                className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-xs transition-colors"
                title="ซูมออก (-10%)"
              >
                <Minus className="w-2.5 h-2.5" />
              </button>
              <span className="text-[10.5px] font-mono font-bold text-slate-200 min-w-[32px] text-center">
                {zoomScale}%
              </span>
              <button
                onClick={() => setZoomScale(prev => Math.min(130, prev + 10))}
                className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-xs transition-colors"
                title="ซูมเข้า (+10%)"
              >
                <Plus className="w-2.5 h-2.5" />
              </button>
            </div>

            {/* Unlock / Edit Seating Layout Button */}
            <button
              id="btn-unlock-seating-layout"
              onClick={() => setIsLayoutLocked(false)}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 border border-amber-500/30 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-sm"
              title="ปลดล็อกเพื่อปรับเปลี่ยนหมวดหมู่ห้อง, เทมเพลต, จำนวนโต๊ะ/กลุ่ม หรือความจุที่นั่ง"
            >
              <Unlock className="w-3.5 h-3.5 text-amber-400" />
              ขอแก้ไขผังที่นั่ง
            </button>
          </div>
        </div>
      ) : (
        /* When Unlocked / Editing Mode: Full Configuration Toolbar */
        <div className="bg-[#121829] border-b border-white/5 px-6 py-2.5 flex flex-wrap items-center justify-between gap-4 text-xs z-10 animate-in fade-in duration-200">
          
          {/* 1. Category Switcher */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-semibold flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              หมวดหมู่ห้อง:
            </span>
            <div className="bg-slate-900/90 p-1 rounded-xl border border-white/10 flex items-center gap-1">
              <button
                onClick={() => handleSelectCategory('CLASSROOM')}
                className={cn(
                  "px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5",
                  seatingCategory === 'CLASSROOM' ? "bg-indigo-600 text-white shadow-md" : "text-slate-400 hover:text-white"
                )}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                ห้องเรียน (Classroom)
              </button>
              <button
                onClick={() => handleSelectCategory('LABORATORY')}
                className={cn(
                  "px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5",
                  seatingCategory === 'LABORATORY' ? "bg-indigo-600 text-white shadow-md" : "text-slate-400 hover:text-white"
                )}
              >
                <FlaskConical className="w-3.5 h-3.5" />
                ห้องปฏิบัติการ (Lab)
              </button>
              <button
                onClick={() => handleSelectCategory('OUTDOOR')}
                className={cn(
                  "px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5",
                  seatingCategory === 'OUTDOOR' ? "bg-indigo-600 text-white shadow-md" : "text-slate-400 hover:text-white"
                )}
              >
                <Sun className="w-3.5 h-3.5" />
                สนาม (Outdoor / Group)
              </button>
            </div>
          </div>

          {/* 2. Classroom Template Selector (if Classroom Mode) OR Group/Table Count (if Lab/Outdoor Mode) */}
          {seatingCategory === 'CLASSROOM' ? (
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-semibold">เทมเพลตจัดแถว:</span>
              <div className="flex flex-wrap items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-white/10">
                {(['2-2-2-2', '3-3-2', '2-3-3', '3-2-3', '1-3-3-1', 'COMPUTER_LAB'] as ClassroomTemplate[]).map(tpl => (
                  <button
                    key={tpl}
                    onClick={() => handleSelectTemplate(tpl)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg font-mono font-bold text-[11px] transition-all",
                      classroomTemplate === tpl ? "bg-amber-500 text-slate-950 shadow-sm" : "text-slate-400 hover:text-slate-200"
                    )}
                  >
                    {tpl === 'COMPUTER_LAB' ? '💻 คอมพิวเตอร์' : tpl}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Context-Sensitive Group / Table Count Input for Lab & Outdoor Modes */
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-slate-900/90 px-3 py-1.5 rounded-xl border border-amber-500/30 shadow-md">
                <Users className="w-3.5 h-3.5 text-amber-400" />
                <label htmlFor="group-table-count-input" className="text-slate-300 font-bold text-[11px] flex items-center gap-1 cursor-pointer">
                  จำนวนกลุ่ม / โต๊ะทำงาน:
                </label>
                
                <div className="flex items-center gap-1">
                  <button
                    id="btn-decrease-group-count"
                    type="button"
                    onClick={() => handleGroupCountChange(groupCount - 1)}
                    disabled={groupCount <= 2}
                    className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white flex items-center justify-center font-bold text-xs transition-colors"
                    title="ลดจำนวนกลุ่ม/โต๊ะ"
                  >
                    <Minus className="w-3 h-3" />
                  </button>

                  <input
                    id="group-table-count-input"
                    type="number"
                    min="2"
                    max="12"
                    value={groupCount}
                    onChange={(e) => handleGroupCountChange(parseInt(e.target.value) || 2)}
                    className="w-12 bg-slate-800 border border-white/20 rounded-lg px-1.5 py-0.5 text-center font-mono font-bold text-amber-300 text-xs focus:outline-none focus:border-amber-400"
                  />

                  <button
                    id="btn-increase-group-count"
                    type="button"
                    onClick={() => handleGroupCountChange(groupCount + 1)}
                    disabled={groupCount >= 12}
                    className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white flex items-center justify-center font-bold text-xs transition-colors"
                    title="เพิ่มจำนวนกลุ่ม/โต๊ะ"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                {/* Quick Presets */}
                <div className="hidden sm:flex items-center gap-1 ml-1 border-l border-white/10 pl-2">
                  {[3, 4, 6, 8, 10].map(cnt => (
                    <button
                      key={cnt}
                      onClick={() => handleGroupCountChange(cnt)}
                      className={cn(
                        "px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all",
                        groupCount === cnt 
                          ? "bg-amber-500 text-slate-950" 
                          : "text-slate-400 hover:text-white bg-slate-800/80"
                      )}
                    >
                      {cnt}
                    </button>
                  ))}
                </div>

                <span className="text-[10.5px] text-amber-400/90 font-mono ml-1 font-semibold">
                  (เฉลี่ย ~{Math.round(courseStudents.length / groupCount) || Math.floor(capacity / groupCount)} คน/{seatingCategory === 'LABORATORY' ? 'โต๊ะ' : 'กลุ่ม'})
                </span>
              </div>
            </div>
          )}

          {/* Zoom & Display Controls for Seat Block Size */}
          <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-900/90 px-2 sm:px-3 py-1.5 rounded-xl border border-white/10 shadow-inner">
            <span className="text-slate-400 font-semibold text-[11px] hidden sm:flex items-center gap-1">
              <Maximize2 className="w-3.5 h-3.5 text-indigo-400" />
              ขนาดโต๊ะ:
            </span>
            <button
              onClick={() => setZoomScale(prev => Math.max(70, prev - 10))}
              className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center font-bold text-xs transition-colors active:scale-95"
              title="ย่อขนาดโต๊ะนักเรียน (-10%)"
            >
              <Minus className="w-3 h-3" />
            </button>
            
            <div className="flex items-center gap-1">
              {[75, 90, 100, 115, 130].map(lvl => (
                <button
                  key={lvl}
                  onClick={() => setZoomScale(lvl)}
                  className={cn(
                    "px-1.5 sm:px-2 py-0.5 rounded-md font-mono text-[10px] sm:text-[10.5px] font-bold transition-all",
                    zoomScale === lvl
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  )}
                >
                  {lvl}%
                </button>
              ))}
            </div>

            <button
              onClick={() => setZoomScale(prev => Math.min(150, prev + 10))}
              className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center font-bold text-xs transition-colors active:scale-95"
              title="ขยายขนาดโต๊ะนักเรียน (+10%)"
            >
              <Plus className="w-3 h-3" />
            </button>

            <button
              onClick={() => setZoomScale(100)}
              className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold px-1.5 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/20 ml-1 transition-colors"
              title="รีเซ็ตขนาดโต๊ะเป็น 100%"
            >
              รีเซ็ต
            </button>
          </div>

          {/* 4. Dynamic Capacity Slider (Up to 42 seats) */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2 bg-slate-900/90 px-2.5 sm:px-3 py-1.5 rounded-xl border border-white/10">
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-slate-400 font-semibold text-[11px] hidden sm:inline">ความจุ:</span>
              <input
                type="range"
                min="20"
                max="42"
                step="1"
                value={capacity}
                onChange={(e) => setCapacity(parseInt(e.target.value) || 40)}
                className="w-16 sm:w-20 accent-indigo-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
              />
              <span className="font-bold font-mono text-white text-xs min-w-[28px] text-right">
                {capacity}
              </span>
            </div>
          </div>

          {/* 5. Save & Lock Seating Layout Button */}
          <button
            id="btn-save-and-lock-layout"
            onClick={handleSaveAndLockLayout}
            className="px-3 sm:px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 shadow-md shadow-emerald-900/30 active:scale-95 cursor-pointer border border-emerald-400/30 ml-auto sm:ml-0"
            title="บันทึกผังที่นั่งปัจจุบันและล็อกการตั้งค่าผังห้องเรียนสำหรับภาคเรียนนี้"
          >
            <Lock className="w-3.5 h-3.5 text-emerald-200" />
            <span className="hidden sm:inline">บันทึกและล็อกผังที่นั่ง</span>
            <span className="sm:hidden">บันทึกล็อก</span>
          </button>

        </div>
      )}

      {/* Layout Save Notification Toast */}
      {layoutNotice && (
        <div className="bg-emerald-950/90 border-b border-emerald-500/30 px-3 sm:px-6 py-2 flex items-center justify-between text-xs text-emerald-200 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{layoutNotice}</span>
          </div>
          <span className="text-emerald-400 font-mono text-[11px] font-bold">บันทึกสำเร็จ</span>
        </div>
      )}

      {/* Lock Banner / Notification */}
      {isAttendanceLocked && (
        <div className="bg-slate-900/80 border-b border-white/5 px-3 sm:px-6 py-2 flex items-center justify-between text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">
              <strong>ระบบล็อคการเช็คชื่อแล้ว (Attendance Locked)</strong> — คลิก "ขอแก้ไขข้อมูล" เพื่อปลดล็อค
            </span>
          </div>
          <span className="text-emerald-400 font-bold flex items-center gap-1 text-[11px] shrink-0 ml-2">
            <ShieldCheck className="w-3.5 h-3.5" /> บันทึกแล้ว
          </span>
        </div>
      )}

      {/* Main Seating Workspace Canvas */}
      <div className="flex-1 flex overflow-hidden relative w-full h-full">
        
        {/* Seating Layout Canvas (Scrollable without clipping boundaries) */}
        <div className="flex-1 p-4 sm:p-6 md:p-8 overflow-auto bg-[#080b13] w-full h-full scroll-smooth">
          
          {/* Inner Layout Wrapper: Ensures safe alignment & infinite scroll without data loss on left/top */}
          <div className="w-max min-w-full mx-auto flex flex-col items-center pb-24 pt-3 sm:pt-4">

            {/* Outer Classroom Envelope: Teacher Desk / Whiteboard Stage Bar */}
            <div className="w-full max-w-5xl bg-gradient-to-r from-slate-800/80 via-slate-700/80 to-slate-800/80 border border-slate-600/40 rounded-2xl py-2.5 sm:py-3 px-4 sm:px-6 mb-8 sm:mb-10 text-center shadow-lg flex items-center justify-between gap-3 shrink-0">
              <span className="text-[10px] sm:text-[11px] font-mono text-slate-400 hidden sm:inline">ประตูห้องเรียน (Entrance)</span>
              <span className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 mx-auto sm:mx-0">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                กระดานหน้าห้อง / โต๊ะครูผู้สอน (Whiteboard & Teacher Desk)
              </span>
              <span className="text-[10px] sm:text-[11px] font-mono text-slate-400 hidden sm:inline">จอโปรเจกเตอร์</span>
            </div>

            {/* 1. CLASSROOM MODE GRID (Scales individual seat blocks directly) */}
            {seatingCategory === 'CLASSROOM' && (
              <div className="flex flex-col gap-3 sm:gap-4 md:gap-5 pb-8 items-center w-full">
                {Array.from({ length: layout.totalRows || 5 }).map((_, rIndex) => {
                  const r = rIndex + 1;
                  return (
                    <div key={r} className="flex gap-2 sm:gap-3 md:gap-3.5 items-stretch shrink-0">
                      {Array.from({ length: layout.totalCols || 8 }).map((_, cIndex) => {
                        const c = cIndex + 1;
                        const seatIndex = (r - 1) * (layout.totalCols || 8) + (c - 1);
                        
                        // Skip if beyond capacity
                        if (seatIndex >= capacity) {
                          return null;
                        }

                        const student = courseStudents.find(s => s.seatIndex === seatIndex);
                        const isHighlighted = student && highlightedStudentIds.includes(student.studentId);
                        const isTouchHovered = touchDragState?.hoveredSeatIndex === seatIndex;
                        const isSelectedMoveTarget = selectedStudentForMove !== null && (!student || student.studentId !== selectedStudentForMove.studentId);

                        return (
                          <React.Fragment key={c}>
                            <div 
                              data-seat-index={seatIndex}
                              data-drop-zone="seat"
                              style={{
                                width: `${seatBlockWidth}px`,
                                minHeight: `${seatBlockMinHeight}px`
                              }}
                              onClick={() => {
                                if (selectedStudentForMove) {
                                  moveStudentSeat(selectedStudentForMove.studentId, seatIndex);
                                  setSelectedStudentForMove(null);
                                  setLayoutNotice(`ย้าย ${selectedStudentForMove.fullName || selectedStudentForMove.name} ไปยังโต๊ะที่ ${seatIndex + 1} แล้ว`);
                                  setTimeout(() => setLayoutNotice(null), 2500);
                                }
                              }}
                              className={cn(
                                "rounded-2xl transition-all duration-200 border-2 relative flex flex-col shrink-0 select-none",
                                isTouchHovered ? "border-amber-400 bg-amber-500/20 ring-4 ring-amber-400/60 scale-[1.03] z-20 shadow-xl" :
                                isSelectedMoveTarget ? "border-indigo-400/80 bg-indigo-500/10 cursor-pointer animate-pulse ring-2 ring-indigo-400/40" :
                                student 
                                  ? "border-transparent" 
                                  : "border-dashed border-white/10 bg-white/[0.02] hover:border-indigo-500/40 items-center justify-center text-center p-2 sm:p-3"
                              )}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => {
                                e.preventDefault();
                                const studentId = e.dataTransfer.getData('studentId');
                                if (studentId) moveStudentSeat(studentId, seatIndex);
                              }}
                            >
                              {isTouchHovered && (
                                <div className="absolute inset-0 bg-amber-500/30 backdrop-blur-[1px] rounded-2xl flex flex-col items-center justify-center z-30 pointer-events-none p-2 border-2 border-amber-300 text-center animate-pulse">
                                  <ArrowRightLeft className="w-5 h-5 text-amber-200 mb-1" />
                                  <span className="text-[11px] font-bold text-white leading-tight">
                                    {student ? `สลับกับ ${student.fullName || student.name}` : `วางที่โต๊ะ ${seatIndex + 1}`}
                                  </span>
                                </div>
                              )}

                              {student ? (
                                <StudentSeatCard
                                  student={student}
                                  seatNumber={seatIndex + 1}
                                  status={currentCourseRecords[student.studentId] || 'UNMARKED'}
                                  isLocked={isAttendanceLocked}
                                  isHighlighted={!!isHighlighted}
                                  isSelectedForMove={selectedStudentForMove?.studentId === student.studentId}
                                  isHoveredDropTarget={isTouchHovered}
                                  alPoints={activeLearningPoints[student.studentId] || 0}
                                  behaviorScore={analytics.find(a => a.studentId === student.studentId)?.behaviorScore ?? 100}
                                  onStatusChange={(st) => setAttendanceStatus(course.id, student.studentId, st)}
                                  onAwardPoint={(pts) => {
                                    addActiveLearningPoints(student.studentId, pts, 'ANSWER', `กิจกรรมในชั้นเรียน (+${pts} แต้ม)`, course.id);
                                    adjustBehaviorScore(student.studentId, pts);
                                  }}
                                  onCardClick={() => {
                                    if (selectedStudentForMove) {
                                      moveStudentSeat(selectedStudentForMove.studentId, seatIndex);
                                      setSelectedStudentForMove(null);
                                    } else if (onSelectStudentDetail) {
                                      onSelectStudentDetail(student);
                                    }
                                  }}
                                  onSelectForMove={() => {
                                    setSelectedStudentForMove(selectedStudentForMove?.studentId === student.studentId ? null : student);
                                  }}
                                  onTouchStart={(e) => handleTouchStart(e, student, seatIndex)}
                                  onTouchMove={handleTouchMove}
                                  onTouchEnd={handleTouchEnd}
                                  onTouchCancel={handleTouchEnd}
                                />
                              ) : (
                                <div className="space-y-1 select-none pointer-events-none">
                                  <div className="text-white/20 text-xs font-mono font-bold">
                                    โต๊ะที่ {seatIndex + 1}
                                  </div>
                                  <div className="text-[10px] text-slate-500">
                                    {isSelectedMoveTarget ? '+ แตะวางที่นี่' : 'ว่าง (ลาก/แตะวาง)'}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Aisle Spacer */}
                            {layout.aisleAfterCols?.includes(c) && (
                              <div className="w-2.5 sm:w-4 md:w-5 shrink-0 flex items-center justify-center border-l border-r border-dashed border-white/5 bg-slate-900/10 rounded-md">
                                <span className="text-[8px] sm:text-[9px] text-slate-600 font-bold uppercase tracking-widest select-none text-center" style={{ writingMode: 'vertical-lr' }}>
                                  ทางเดิน
                                </span>
                              </div>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}

            {/* 2. LABORATORY MODE (Dynamic Island Tables with individual seat scaling) */}
            {seatingCategory === 'LABORATORY' && (
              <div className={cn(
                "grid gap-4 sm:gap-6 max-w-7xl w-full pb-8",
                groupCount <= 2 ? "grid-cols-1 md:grid-cols-2" :
                groupCount <= 4 ? "grid-cols-1 md:grid-cols-2" :
                "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              )}>
                {Array.from({ length: groupCount }).map((_, tableIdx) => {
                  const tableNumber = tableIdx + 1;
                  const baseSeats = Math.floor(capacity / groupCount);
                  const extraSeats = capacity % groupCount;
                  const seatsAtThisTable = baseSeats + (tableIdx < extraSeats ? 1 : 0);
                  
                  // Calculate starting index for this table
                  let startIndex = 0;
                  for (let t = 0; t < tableIdx; t++) {
                    startIndex += baseSeats + (t < extraSeats ? 1 : 0);
                  }

                  return (
                    <div key={tableIdx} className="bg-[#121829] border border-white/10 rounded-3xl p-4 sm:p-5 shadow-xl flex flex-col space-y-4">
                      <div className="flex items-center justify-between border-b border-white/10 pb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold text-xs">
                            T{tableNumber}
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-white">โต๊ะทดลองที่ {tableNumber}</h3>
                            <p className="text-[10px] text-slate-400">Lab Station #{tableNumber}</p>
                          </div>
                        </div>
                        <span className="text-[11px] font-mono px-2 py-0.5 bg-slate-800 rounded-lg text-slate-300">
                          {seatsAtThisTable} ที่นั่ง
                        </span>
                      </div>

                      {/* Circular / Island Table Stools */}
                      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                        {Array.from({ length: seatsAtThisTable }).map((_, seatSlot) => {
                          const seatIndex = startIndex + seatSlot;
                          const student = courseStudents.find(s => s.seatIndex === seatIndex);
                          const isHighlighted = student && highlightedStudentIds.includes(student.studentId);
                          const isTouchHovered = touchDragState?.hoveredSeatIndex === seatIndex;
                          const isSelectedMoveTarget = selectedStudentForMove !== null && (!student || student.studentId !== selectedStudentForMove.studentId);

                          return (
                            <div 
                              key={seatSlot}
                              data-seat-index={seatIndex}
                              data-drop-zone="seat"
                              style={{
                                minHeight: `${seatBlockMinHeight}px`
                              }}
                              onClick={() => {
                                if (selectedStudentForMove) {
                                  moveStudentSeat(selectedStudentForMove.studentId, seatIndex);
                                  setSelectedStudentForMove(null);
                                  setLayoutNotice(`ย้าย ${selectedStudentForMove.fullName || selectedStudentForMove.name} ไปยังโต๊ะที่ ${seatIndex + 1} แล้ว`);
                                  setTimeout(() => setLayoutNotice(null), 2500);
                                }
                              }}
                              className={cn(
                                "rounded-2xl transition-all border-2 relative flex flex-col select-none",
                                isTouchHovered ? "border-amber-400 bg-amber-500/20 ring-4 ring-amber-400/60 scale-[1.03] z-20 shadow-xl" :
                                isSelectedMoveTarget ? "border-indigo-400/80 bg-indigo-500/10 cursor-pointer animate-pulse ring-2 ring-indigo-400/40" :
                                student ? "border-transparent" : "border-dashed border-white/10 bg-white/[0.02] items-center justify-center text-center p-2"
                              )}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => {
                                e.preventDefault();
                                const studentId = e.dataTransfer.getData('studentId');
                                if (studentId) moveStudentSeat(studentId, seatIndex);
                              }}
                            >
                              {isTouchHovered && (
                                <div className="absolute inset-0 bg-amber-500/30 backdrop-blur-[1px] rounded-2xl flex flex-col items-center justify-center z-30 pointer-events-none p-2 border-2 border-amber-300 text-center animate-pulse">
                                  <ArrowRightLeft className="w-5 h-5 text-amber-200 mb-1" />
                                  <span className="text-[11px] font-bold text-white leading-tight">
                                    {student ? `สลับกับ ${student.fullName || student.name}` : `วางที่สตูล ${seatSlot + 1}`}
                                  </span>
                                </div>
                              )}

                              {student ? (
                                <StudentSeatCard
                                  student={student}
                                  seatNumber={seatIndex + 1}
                                  status={currentCourseRecords[student.studentId] || 'UNMARKED'}
                                  isLocked={isAttendanceLocked}
                                  isHighlighted={!!isHighlighted}
                                  isSelectedForMove={selectedStudentForMove?.studentId === student.studentId}
                                  isHoveredDropTarget={isTouchHovered}
                                  alPoints={activeLearningPoints[student.studentId] || 0}
                                  behaviorScore={analytics.find(a => a.studentId === student.studentId)?.behaviorScore ?? 100}
                                  onStatusChange={(st) => setAttendanceStatus(course.id, student.studentId, st)}
                                  onAwardPoint={(pts) => {
                                    addActiveLearningPoints(student.studentId, pts, 'COLLABORATION', `กิจกรรมกลุ่มแล็บ (+${pts} แต้ม)`, course.id);
                                    adjustBehaviorScore(student.studentId, pts);
                                  }}
                                  onCardClick={() => {
                                    if (selectedStudentForMove) {
                                      moveStudentSeat(selectedStudentForMove.studentId, seatIndex);
                                      setSelectedStudentForMove(null);
                                    } else if (onSelectStudentDetail) {
                                      onSelectStudentDetail(student);
                                    }
                                  }}
                                  onSelectForMove={() => {
                                    setSelectedStudentForMove(selectedStudentForMove?.studentId === student.studentId ? null : student);
                                  }}
                                  onTouchStart={(e) => handleTouchStart(e, student, seatIndex)}
                                  onTouchMove={handleTouchMove}
                                  onTouchEnd={handleTouchEnd}
                                  onTouchCancel={handleTouchEnd}
                                />
                              ) : (
                                <div className="text-[10px] text-slate-500 font-mono">
                                  {isSelectedMoveTarget ? '+ แตะวางที่นี่' : `สตูล ${seatSlot + 1} (ว่าง)`}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 3. OUTDOOR / FIELD MODE (Dynamic Activity Bases with individual seat scaling) */}
            {seatingCategory === 'OUTDOOR' && (
              <div className={cn(
                "grid gap-4 sm:gap-6 max-w-7xl w-full pb-8",
                groupCount <= 2 ? "grid-cols-1 md:grid-cols-2" :
                groupCount <= 4 ? "grid-cols-1 md:grid-cols-2" :
                "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              )}>
                {Array.from({ length: groupCount }).map((_, groupIdx) => {
                  const groupNumber = groupIdx + 1;
                  const baseColors = [
                    'ทีมสีแดง (Base A)',
                    'ทีมสีน้ำเงิน (Base B)',
                    'ทีมสีเขียว (Base C)',
                    'ทีมสีเหลือง (Base D)',
                    'ทีมสีส้ม (Base E)',
                    'ทีมสีม่วง (Base F)',
                    'ทีมสีชมพู (Base G)',
                    'ทีมสีฟ้า (Base H)',
                    'ทีมสีขาว (Base I)',
                    'ทีมสีทอง (Base J)',
                    'ทีมสีเงิน (Base K)',
                    'ทีมสีมรกต (Base L)'
                  ];
                  const baseSeats = Math.floor(capacity / groupCount);
                  const extraSeats = capacity % groupCount;
                  const seatsPerGrp = baseSeats + (groupIdx < extraSeats ? 1 : 0);
                  
                  // Calculate starting index for this group
                  let startIndex = 0;
                  for (let g = 0; g < groupIdx; g++) {
                    startIndex += baseSeats + (g < extraSeats ? 1 : 0);
                  }

                  return (
                    <div key={groupIdx} className="bg-[#121829] border border-amber-500/20 rounded-3xl p-4 sm:p-6 shadow-xl space-y-4">
                      <div className="flex items-center justify-between border-b border-white/10 pb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold text-xs">
                            G{groupNumber}
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-white">
                              {baseColors[groupIdx] || `กลุ่มกิจกรรมสนามที่ ${groupNumber}`}
                            </h3>
                            <p className="text-[10px] text-amber-400/80">Outdoor Activity Base #{groupNumber}</p>
                          </div>
                        </div>
                        <span className="text-[11px] font-mono px-2 py-0.5 bg-slate-800 rounded-lg text-slate-300">
                          {seatsPerGrp} คน
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
                        {Array.from({ length: seatsPerGrp }).map((_, seatSlot) => {
                          const seatIndex = startIndex + seatSlot;
                          const student = courseStudents.find(s => s.seatIndex === seatIndex);
                          const isHighlighted = student && highlightedStudentIds.includes(student.studentId);
                          const isTouchHovered = touchDragState?.hoveredSeatIndex === seatIndex;
                          const isSelectedMoveTarget = selectedStudentForMove !== null && (!student || student.studentId !== selectedStudentForMove.studentId);

                          return (
                            <div 
                              key={seatSlot}
                              data-seat-index={seatIndex}
                              data-drop-zone="seat"
                              style={{
                                minHeight: `${seatBlockMinHeight}px`
                              }}
                              onClick={() => {
                                if (selectedStudentForMove) {
                                  moveStudentSeat(selectedStudentForMove.studentId, seatIndex);
                                  setSelectedStudentForMove(null);
                                  setLayoutNotice(`ย้าย ${selectedStudentForMove.fullName || selectedStudentForMove.name} ไปยังฐานที่ ${groupNumber} แล้ว`);
                                  setTimeout(() => setLayoutNotice(null), 2500);
                                }
                              }}
                              className={cn(
                                "rounded-2xl transition-all border-2 relative flex flex-col select-none",
                                isTouchHovered ? "border-amber-400 bg-amber-500/20 ring-4 ring-amber-400/60 scale-[1.03] z-20 shadow-xl" :
                                isSelectedMoveTarget ? "border-indigo-400/80 bg-indigo-500/10 cursor-pointer animate-pulse ring-2 ring-indigo-400/40" :
                                student ? "border-transparent" : "border-dashed border-white/10 bg-white/[0.02] items-center justify-center text-center p-2"
                              )}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => {
                                e.preventDefault();
                                const studentId = e.dataTransfer.getData('studentId');
                                if (studentId) moveStudentSeat(studentId, seatIndex);
                              }}
                            >
                              {isTouchHovered && (
                                <div className="absolute inset-0 bg-amber-500/30 backdrop-blur-[1px] rounded-2xl flex flex-col items-center justify-center z-30 pointer-events-none p-2 border-2 border-amber-300 text-center animate-pulse">
                                  <ArrowRightLeft className="w-5 h-5 text-amber-200 mb-1" />
                                  <span className="text-[11px] font-bold text-white leading-tight">
                                    {student ? `สลับกับ ${student.fullName || student.name}` : `วางที่ช่อง ${seatSlot + 1}`}
                                  </span>
                                </div>
                              )}

                              {student ? (
                                <StudentSeatCard
                                  student={student}
                                  seatNumber={seatIndex + 1}
                                  status={currentCourseRecords[student.studentId] || 'UNMARKED'}
                                  isLocked={isAttendanceLocked}
                                  isHighlighted={!!isHighlighted}
                                  isSelectedForMove={selectedStudentForMove?.studentId === student.studentId}
                                  isHoveredDropTarget={isTouchHovered}
                                  alPoints={activeLearningPoints[student.studentId] || 0}
                                  behaviorScore={analytics.find(a => a.studentId === student.studentId)?.behaviorScore ?? 100}
                                  onStatusChange={(st) => setAttendanceStatus(course.id, student.studentId, st)}
                                  onAwardPoint={(pts) => {
                                    addActiveLearningPoints(student.studentId, pts, 'LEADERSHIP', `กิจกรรมฐานกลางแจ้ง (+${pts} แต้ม)`, course.id);
                                    adjustBehaviorScore(student.studentId, pts);
                                  }}
                                  onCardClick={() => {
                                    if (selectedStudentForMove) {
                                      moveStudentSeat(selectedStudentForMove.studentId, seatIndex);
                                      setSelectedStudentForMove(null);
                                    } else if (onSelectStudentDetail) {
                                      onSelectStudentDetail(student);
                                    }
                                  }}
                                  onSelectForMove={() => {
                                    setSelectedStudentForMove(selectedStudentForMove?.studentId === student.studentId ? null : student);
                                  }}
                                  onTouchStart={(e) => handleTouchStart(e, student, seatIndex)}
                                  onTouchMove={handleTouchMove}
                                  onTouchEnd={handleTouchEnd}
                                  onTouchCancel={handleTouchEnd}
                                />
                              ) : (
                                <div className="text-[10px] text-slate-500 font-mono">
                                  {isSelectedMoveTarget ? '+ แตะวางที่นี่' : `ที่ว่าง ${seatSlot + 1}`}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>

        </div>

        {/* Sidebar: Unassigned Students (Drag & Drop Pool) - Automatically hidden when count reaches 0 to expand seating chart */}
        {unassignedStudents.length > 0 && (
          <aside 
            id="unassigned-students-sidebar"
            data-drop-zone="unassigned"
            className={cn(
              "w-72 border-l border-white/10 bg-[#0d121f] flex flex-col shrink-0 animate-in fade-in slide-in-from-right-4 duration-300 hidden md:flex transition-all",
              touchDragState?.isHoveringUnassigned ? "ring-2 ring-rose-500 bg-rose-950/20" : ""
            )}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const studentId = e.dataTransfer.getData('studentId');
              if (studentId) moveStudentSeat(studentId, null);
            }}
          >
            <div className="p-4 border-b border-white/10 bg-slate-900/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-indigo-400" />
                  <span>นักเรียนที่ยังไม่มีที่นั่ง</span>
                </h2>
                <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full font-mono text-[11px] font-bold">
                  {unassignedStudents.length} คน
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                ลากหรือแตะการ์ดเพื่อวางในผังที่นั่ง
              </p>

              {/* Quick Actions */}
              <div className="flex items-center gap-1.5 pt-1">
                <button
                  id="btn-auto-assign-all"
                  onClick={() => autoAssignClassroomSeats(course.room, capacity)}
                  disabled={unassignedStudents.length === 0}
                  className="flex-1 py-1.5 px-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white rounded-lg text-[10px] font-bold transition-all shadow flex items-center justify-center gap-1 cursor-pointer"
                  title="จัดที่นั่งให้นักเรียนที่ยังไม่มีที่นั่งทั้งหมดลงในช่องว่างอัตโนมัติ"
                >
                  <Sparkles className="w-3 h-3" />
                  จัดที่นั่งอัตโนมัติ
                </button>
                <button
                  id="btn-reset-classroom-seats"
                  onClick={() => resetClassroomSeats(course.room)}
                  className="py-1.5 px-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                  title="นำนักเรียนทุกคนออกจากที่นั่ง เพื่อจัดผังใหม่"
                >
                  <RotateCcw className="w-3 h-3" />
                  ล้างผัง
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {unassignedStudents.map((student, idx) => {
                const isSelectedForMove = selectedStudentForMove?.studentId === student.studentId;
                return (
                  <div
                    key={student.studentId}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('studentId', student.studentId)}
                    onTouchStart={(e) => handleTouchStart(e, student, null)}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onTouchCancel={handleTouchEnd}
                    onClick={() => {
                      if (isSelectedForMove) {
                        setSelectedStudentForMove(null);
                      } else {
                        setSelectedStudentForMove(student);
                      }
                    }}
                    className={cn(
                      "p-2.5 rounded-2xl border transition-all cursor-grab active:cursor-grabbing shadow-md flex items-center gap-2.5 group select-none touch-none",
                      isSelectedForMove 
                        ? "bg-indigo-900/60 border-indigo-400 ring-2 ring-indigo-400/50" 
                        : "bg-[#172033] hover:bg-[#1e2a44] border-white/10 hover:border-indigo-500/50"
                    )}
                    title="แตะเพื่อเลือกวาง หรือลากไปวางในผังที่นั่ง"
                  >
                    <GripVertical className="w-4 h-4 text-slate-500 shrink-0" />
                    <img 
                      src={student.avatar || student.photoUrl} 
                      alt="" 
                      className="w-10 h-10 rounded-full object-cover border border-slate-700 bg-slate-800 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-slate-200 group-hover:text-white truncate">
                        {student.fullName || student.name}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center justify-between font-mono mt-0.5">
                        <span>เลขที่ {student.studentNo || student.number || idx + 1}</span>
                        <span className="text-slate-500">#{student.studentCode || student.studentId}</span>
                      </div>
                      {student.nickname && (
                        <div className="text-[9.5px] text-amber-400 font-medium">
                          ({student.nickname})
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>
        )}

      </div>

      {/* Mobile Drawer: Unassigned Students Bottom Sheet Modal */}
      <AnimatePresence>
        {isMobilePoolOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 md:hidden">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobilePoolOpen(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-w-lg bg-[#0f172a] border-t sm:border border-white/10 rounded-t-3xl sm:rounded-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden z-10"
            >
              {/* Drawer Header */}
              <div className="p-4 border-b border-white/10 flex items-center justify-between bg-slate-900/90">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">นักเรียนที่ยังไม่มีที่นั่ง</h3>
                    <p className="text-[10px] text-slate-400">แตะนักเรียนเพื่อเลือก แล้วแตะโต๊ะว่างในผัง</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full font-mono text-xs font-bold">
                    {unassignedStudents.length} คน
                  </span>
                  <button 
                    onClick={() => setIsMobilePoolOpen(false)}
                    className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="p-3 border-b border-white/10 bg-slate-900/50 flex gap-2">
                <button
                  onClick={() => {
                    autoAssignClassroomSeats(course.room, capacity);
                    setIsMobilePoolOpen(false);
                  }}
                  disabled={unassignedStudents.length === 0}
                  className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all shadow flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  จัดที่นั่งอัตโนมัติทั้งหมด
                </button>
                <button
                  onClick={() => {
                    resetClassroomSeats(course.room);
                    setIsMobilePoolOpen(false);
                  }}
                  className="py-2 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  ล้างผัง
                </button>
              </div>

              {/* Student List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2.5 max-h-[50vh]">
                {unassignedStudents.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                    นักเรียนทุกคนมีที่นั่งเรียบร้อยแล้ว
                  </div>
                ) : (
                  unassignedStudents.map((student, idx) => {
                    const isSelected = selectedStudentForMove?.studentId === student.studentId;
                    return (
                      <div
                        key={student.studentId}
                        onTouchStart={(e) => {
                          handleTouchStart(e, student, null);
                        }}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={() => {
                          handleTouchEnd();
                          setIsMobilePoolOpen(false);
                        }}
                        onTouchCancel={handleTouchEnd}
                        onClick={() => {
                          setSelectedStudentForMove(isSelected ? null : student);
                          setIsMobilePoolOpen(false);
                        }}
                        className={cn(
                          "p-3 rounded-2xl border transition-all flex items-center gap-3 active:scale-[0.98] select-none touch-none",
                          isSelected 
                            ? "bg-indigo-900/70 border-indigo-400 ring-2 ring-indigo-400" 
                            : "bg-[#172033] hover:bg-[#1e2a44] border-white/10"
                        )}
                      >
                        <GripVertical className="w-4 h-4 text-slate-500 shrink-0" />
                        <img 
                          src={student.avatar || student.photoUrl} 
                          alt="" 
                          className="w-11 h-11 rounded-full object-cover border border-slate-700 bg-slate-800 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-sm text-white truncate">
                            {student.fullName || student.name}
                          </div>
                          <div className="text-xs text-slate-400 flex items-center justify-between font-mono mt-0.5">
                            <span>เลขที่ {student.studentNo || student.number || idx + 1}</span>
                            <span className="text-slate-500">#{student.studentCode || student.studentId}</span>
                          </div>
                          {student.nickname && (
                            <span className="text-xs text-amber-400 font-medium">({student.nickname})</span>
                          )}
                        </div>
                        <div className="shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // Assign to first free desk
                              const occupiedSeats = new Set(courseStudents.map(s => s.seatIndex).filter(i => i !== null && i !== undefined));
                              for (let i = 0; i < capacity; i++) {
                                if (!occupiedSeats.has(i)) {
                                  moveStudentSeat(student.studentId, i);
                                  break;
                                }
                              }
                              if (unassignedStudents.length <= 1) {
                                setIsMobilePoolOpen(false);
                              }
                            }}
                            className="px-2.5 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-bold"
                          >
                            วางช่องว่างแรก
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Tap-to-Move / Tap-to-Swap Floating Action Bar */}
      <AnimatePresence>
        {selectedStudentForMove && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-indigo-950/95 border-2 border-indigo-400/80 rounded-2xl py-3 px-4 sm:px-6 shadow-2xl backdrop-blur-md flex items-center gap-3 sm:gap-4 max-w-[90vw]"
          >
            <img 
              src={selectedStudentForMove.avatar || selectedStudentForMove.photoUrl} 
              alt=""
              className="w-10 h-10 rounded-full object-cover border-2 border-indigo-400 shrink-0" 
            />
            <div className="min-w-0 flex-1">
              <div className="text-xs sm:text-sm font-bold text-white truncate flex items-center gap-1.5">
                <span>แตะเลือกโต๊ะเพื่อจัดที่นั่ง</span>
              </div>
              <p className="text-[11px] text-indigo-300 truncate">
                {selectedStudentForMove.fullName || selectedStudentForMove.name} {selectedStudentForMove.seatIndex !== null && selectedStudentForMove.seatIndex !== undefined ? `(โต๊ะ ${selectedStudentForMove.seatIndex + 1})` : '(รอนั่ง)'}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {selectedStudentForMove.seatIndex !== null && selectedStudentForMove.seatIndex !== undefined && (
                <button
                  onClick={() => {
                    moveStudentSeat(selectedStudentForMove.studentId, null);
                    setSelectedStudentForMove(null);
                  }}
                  className="px-2.5 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-bold transition-all"
                >
                  นำออก
                </button>
              )}
              <button
                onClick={() => setSelectedStudentForMove(null)}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Ghost Overlay during Touch Drag */}
      {touchDragState && touchDragState.isDragging && (
        <div 
          style={{
            position: 'fixed',
            left: `${touchDragState.currentX - 55}px`,
            top: `${touchDragState.currentY - 60}px`,
            pointerEvents: 'none',
            zIndex: 9999
          }}
          className="bg-indigo-900/95 border-2 border-amber-400 text-white rounded-2xl p-2.5 shadow-2xl backdrop-blur-sm flex items-center gap-2.5 w-44 scale-105 animate-pulse"
        >
          <img 
            src={touchDragState.student.avatar || touchDragState.student.photoUrl} 
            alt="" 
            className="w-9 h-9 rounded-full object-cover border border-amber-400 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <div className="font-bold text-xs text-white truncate">
              {touchDragState.student.fullName || touchDragState.student.name}
            </div>
            <div className="text-[10px] text-amber-300 font-mono">
              {touchDragState.hoveredSeatIndex !== null 
                ? `👉 โต๊ะที่ ${touchDragState.hoveredSeatIndex + 1}`
                : touchDragState.isHoveringUnassigned
                ? '🗑️ นำออกจากที่นั่ง'
                : 'ลากไปวางบนโต๊ะ'}
            </div>
          </div>
        </div>
      )}

      {/* Random Student Picker Modal */}
      <RandomStudentPickerModal
        isOpen={showRandomPicker}
        onClose={() => setShowRandomPicker(false)}
        courseStudents={courseStudents}
        classroomGroups={deskGroups}
        attendanceRecords={currentCourseRecords}
        courseId={course.id}
        onSelectHighlight={(ids) => setHighlightedStudentIds(ids)}
      />

    </div>
  );
};

// Sub-component: Student Seat Card
interface StudentSeatCardProps {
  student: Student;
  seatNumber: number;
  status: AttendanceStatus;
  isLocked: boolean;
  isHighlighted: boolean;
  isSelectedForMove?: boolean;
  isHoveredDropTarget?: boolean;
  alPoints: number;
  behaviorScore: number;
  onStatusChange: (status: AttendanceStatus) => void;
  onAwardPoint: (points: number) => void;
  onCardClick?: () => void;
  onSelectForMove?: () => void;
  onTouchStart?: (e: React.TouchEvent) => void;
  onTouchMove?: (e: React.TouchEvent) => void;
  onTouchEnd?: (e: React.TouchEvent) => void;
  onTouchCancel?: (e: React.TouchEvent) => void;
}

const StudentSeatCard: React.FC<StudentSeatCardProps> = ({
  student,
  seatNumber,
  status,
  isLocked,
  isHighlighted,
  isSelectedForMove,
  isHoveredDropTarget,
  alPoints,
  behaviorScore,
  onStatusChange,
  onAwardPoint,
  onCardClick,
  onSelectForMove,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onTouchCancel
}) => {
  const studentNo = student.studentNo || student.number || seatNumber;
  const nickname = student.nickname || '';
  const studentCode = student.studentCode || student.studentId;

  // Status visual mapping
  let borderStatusClass = "border-l-slate-500";
  let statusBadgeBg = "bg-slate-500/20 text-slate-300 border-slate-500/30";
  let statusLabel = "ยังไม่เช็ค";

  if (status === 'PRESENT') {
    borderStatusClass = "border-l-emerald-500";
    statusBadgeBg = "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
    statusLabel = "มา (Present)";
  } else if (status === 'LATE') {
    borderStatusClass = "border-l-amber-500";
    statusBadgeBg = "bg-amber-500/20 text-amber-300 border-amber-500/30";
    statusLabel = "สาย (Tardy)";
  } else if (status === 'LEAVE') {
    borderStatusClass = "border-l-blue-500";
    statusBadgeBg = "bg-blue-500/20 text-blue-300 border-blue-500/30";
    statusLabel = "ลา (Leave)";
  } else if (status === 'ABSENT') {
    borderStatusClass = "border-l-rose-500";
    statusBadgeBg = "bg-rose-500/20 text-rose-300 border-rose-500/30";
    statusLabel = "ขาด (Absent)";
  }

  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData('studentId', student.studentId)}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
      onClick={onCardClick}
      className={cn(
        "bg-[#151c2e] hover:bg-[#1a233a] rounded-2xl p-2.5 flex flex-col justify-between h-full w-full text-left relative overflow-hidden transition-all duration-200 border-l-4 border-y border-r border-white/10 group cursor-grab active:cursor-grabbing shadow-md touch-none select-none",
        borderStatusClass,
        isSelectedForMove ? "ring-4 ring-indigo-400 bg-indigo-950/60 scale-105 z-20 shadow-2xl" : "",
        isHoveredDropTarget ? "ring-4 ring-amber-400 scale-105 z-30 shadow-2xl" : "",
        isHighlighted ? "ring-4 ring-amber-400 scale-105 border-amber-400 shadow-[0_0_25px_rgba(251,191,36,0.6)] z-10 animate-pulse" : ""
      )}
    >
      {/* Top row: Avatar, Seat No & Active Learning Points */}
      <div className="flex items-start justify-between gap-1.5">
        <div className="relative">
          <img 
            src={student.avatar || student.photoUrl} 
            alt={student.name}
            draggable={false}
            className={cn(
              "w-9 h-9 rounded-full object-cover border-2 bg-slate-800 transition-colors",
              status === 'PRESENT' ? 'border-emerald-500' :
              status === 'LATE' ? 'border-amber-500' :
              status === 'LEAVE' ? 'border-blue-500' :
              status === 'ABSENT' ? 'border-rose-500' :
              'border-slate-600'
            )}
          />
          <span className="absolute -bottom-1 -right-1 bg-slate-900 text-slate-300 font-mono text-[9px] font-bold px-1 rounded-md border border-slate-700">
            #{studentNo}
          </span>
        </div>

        <div className="flex flex-col items-end">
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-mono text-slate-400">#{studentCode}</span>
            {onSelectForMove && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectForMove();
                }}
                className={cn(
                  "p-0.5 rounded-md transition-colors",
                  isSelectedForMove ? "bg-indigo-500 text-white" : "text-slate-400 hover:text-white hover:bg-white/10"
                )}
                title="ย้ายหรือสลับที่นั่ง"
              >
                <ArrowRightLeft className="w-3 h-3" />
              </button>
            )}
          </div>
          <span className="text-[9.5px] font-mono font-bold text-amber-300 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20 mt-0.5">
            🌟 {alPoints} แต้ม
          </span>
        </div>
      </div>

      {/* Center: Student Name & Quick Points */}
      <div className="my-1.5">
        <h4 className="font-bold text-xs text-white group-hover:text-indigo-300 transition-colors truncate">
          {student.fullName || student.name}
        </h4>
        {nickname && (
          <p className="text-[10px] text-amber-400 font-medium">
            ({nickname})
          </p>
        )}
      </div>

      {/* Bottom Controls: Locked Badge OR 4 Attendance Status Buttons */}
      {isLocked ? (
        // Locked View: Displays clean status badge
        <div className="mt-auto pt-1 flex items-center justify-between">
          <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-lg border font-mono truncate", statusBadgeBg)}>
            {statusLabel}
          </span>
          
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); onAwardPoint(1); }}
              className="w-5 h-5 rounded-md bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 text-[10px] font-bold flex items-center justify-center transition-colors border border-amber-500/30"
              title="ให้แต้มตอบคำถาม +1"
            >
              +1
            </button>
          </div>
        </div>
      ) : (
        // Unlocked View: Interactive Attendance Status Buttons (มา, สาย, ลา, ขาด)
        <div className="grid grid-cols-4 gap-1 mt-auto pt-1">
          <button
            onClick={(e) => { e.stopPropagation(); onStatusChange('PRESENT'); }}
            className={cn(
              "py-1 text-[10px] rounded-lg font-bold transition-all",
              status === 'PRESENT' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white/5 text-slate-400 hover:bg-white/15'
            )}
            title="มาเรียน (Present)"
          >
            มา
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onStatusChange('LATE'); }}
            className={cn(
              "py-1 text-[10px] rounded-lg font-bold transition-all",
              status === 'LATE' ? 'bg-amber-500 text-slate-950 font-extrabold shadow-sm' : 'bg-white/5 text-slate-400 hover:bg-white/15'
            )}
            title="มาสาย (Tardy)"
          >
            สาย
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onStatusChange('LEAVE'); }}
            className={cn(
              "py-1 text-[10px] rounded-lg font-bold transition-all",
              status === 'LEAVE' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white/5 text-slate-400 hover:bg-white/15'
            )}
            title="ลากิจ/ลาป่วย (Leave)"
          >
            ลา
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onStatusChange('ABSENT'); }}
            className={cn(
              "py-1 text-[10px] rounded-lg font-bold transition-all",
              status === 'ABSENT' ? 'bg-rose-600 text-white shadow-sm' : 'bg-white/5 text-slate-400 hover:bg-white/15'
            )}
            title="ขาดเรียน (Absent)"
          >
            ขาด
          </button>
        </div>
      )}

    </div>
  );
};
