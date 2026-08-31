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
  History,
  Trash2,
  Edit2,
  Copy,
  UserX,
  Share2,
  HelpCircle,
  Award
} from 'lucide-react';
import { Student, Course, AttendanceStatus } from '../types';
import { SeatingLayout, SeatingGroup, SeatingSeat, SeatingAssignment } from '../types/seating';
import { cn, isSameRoom, formatRoomName, formatCourseTitle } from '../lib/utils';
import { useStore } from '../store';
import { RandomStudentPickerModal, ClassroomDeskGroup } from './RandomStudentPickerModal';
import { buildDeskGroupsForPicker } from '../lib/seatingPicker';
import { SeatHistoryModal } from './seating/SeatHistoryModal';
import { TemplatePickerModal } from './seating/TemplatePickerModal';
import { CreateGroupModal } from './seating/CreateGroupModal';
import { TakeAttendanceModal } from './seating/TakeAttendanceModal';
import { getAttendanceRecord } from '../services/firestoreService';
import { format } from 'date-fns';
import { 
  getSeatingLayoutFromFirestore, 
  saveSeatingLayoutToFirestore,
  assignStudentToSeatInFirestore,
  unassignSeatInFirestore,
  swapStudentSeatsInFirestore,
  getSharedLayoutTemplatesFromFirestore,
  cloneLayoutTemplateInFirestore
} from '../services/seatingService';

interface ClassroomSeatingManagerProps {
  course?: Course | null;
  students: Student[];
  onBackToDashboard?: () => void;
  onSelectStudentDetail?: (student: Student) => void;
  onTakeAttendance?: () => void;
}

export const ClassroomSeatingManager: React.FC<ClassroomSeatingManagerProps> = ({
  course: propCourse,
  students,
  onBackToDashboard,
  onSelectStudentDetail,
  onTakeAttendance
}) => {
  const course: Course = propCourse || {
    id: 'course-m58-default',
    code: 'ว32204',
    name: 'ฟิสิกส์ 4',
    room: 'ม.5/8',
    level: 'ม.5/8',
    term: '1/2569',
    studentsCount: 40,
    attendanceTaken: false,
    schedule: 'จ1-2, พ3-4'
  };

  const { 
    user,
    currentDate,
    attendanceRecords, 
    setAttendanceStatus, 
    adjustBehaviorScore, 
    addActiveLearningPoints,
    activeLearningPoints,
    analytics
  } = useStore();

  const courseSubjectId = course?.code || course?.id || 'default-subject';
  const courseClassId = course?.room || 'ม.5/8';
  const layoutId = `layout_${courseSubjectId}_${courseClassId.replace(/[^a-zA-Z0-9]/g, '_')}`;

  // Filter students for this course/room
  const courseStudents = useMemo(() => {
    const targetRoom = course?.room;
    if (!targetRoom) return [];
    return (students || []).filter(s => 
      isSameRoom(s.room, targetRoom) || 
      isSameRoom((s as any).className, targetRoom)
    );
  }, [course?.room, students]);

  // 1. Dynamic Layout State
  const [layoutMeta, setLayoutMeta] = useState<SeatingLayout>({
    id: layoutId,
    name: `ผังห้องเรียน ${formatCourseTitle(course.name, course.level, course.room)}`,
    subjectCode: course.code,
    room: course.room,
    teacherId: user?.uid || 'teacher_001',
    teacherEmail: user?.email || 'teacher@utd.ac.th',
    category: 'CLASSROOM',
    isTemplate: false,
    isLocked: false,
    totalCapacity: 40,
    zoomScale: 100,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  // Groups and Seats state
  const [groups, setGroups] = useState<SeatingGroup[]>([]);
  // Active assignments mapping: seatId -> SeatingAssignment
  const [assignments, setAssignments] = useState<Record<string, SeatingAssignment>>({});
  // Local history cache for modal
  const [allAssignmentsHistory, setAllAssignmentsHistory] = useState<SeatingAssignment[]>([]);

  // UI States
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState<number>(100);
  const [isLayoutLocked, setIsLayoutLocked] = useState<boolean>(false);

  // Modals
  const [showTemplateModal, setShowTemplateModal] = useState<boolean>(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState<boolean>(false);
  const [showRandomPicker, setShowRandomPicker] = useState<boolean>(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState<boolean>(false);
  const [selectedSeatForHistory, setSelectedSeatForHistory] = useState<{ seat: SeatingSeat; group: SeatingGroup } | null>(null);
  const [selectedStudentForHistory, setSelectedStudentForHistory] = useState<Student | null>(null);

  // Interaction State
  const [selectedStudentToPlace, setSelectedStudentToPlace] = useState<Student | null>(null);
  const [draggedStudent, setDraggedStudent] = useState<{ student: Student; fromSeatId?: string } | null>(null);
  const [highlightedStudentIds, setHighlightedStudentIds] = useState<string[]>([]);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState<string>('');

  // 2. Attendance Status & Gating (Firestore-backed)
  const courseId = course?.id || 'default-course';
  const [firestoreAttendance, setFirestoreAttendance] = useState<Record<string, 'PRESENT' | 'LATE' | 'ABSENT' | 'LEAVE'> | null>(null);

  // Fetch real attendance record from Firestore for today's course/period
  useEffect(() => {
    let isMounted = true;
    const fetchAttendance = async () => {
      try {
        const dateStr = format(currentDate || new Date(), 'yyyy-MM-dd');
        const rawRoom = course?.room || 'ม.5/8';
        const roomStr = rawRoom.replace('/', '-');
        const periodNum = course?.periodIndex || 1;
        const recordId = `${dateStr}_${roomStr}_p${periodNum}`;

        const rec = await getAttendanceRecord(recordId);
        if (rec && rec.students && isMounted) {
          setFirestoreAttendance(rec.students);
        }
      } catch (err) {
        console.error('Error loading attendance from Firestore:', err);
      }
    };
    fetchAttendance();
    return () => {
      isMounted = false;
    };
  }, [course?.room, course?.periodIndex, currentDate]);

  const currentAttendance = firestoreAttendance || attendanceRecords[courseId] || attendanceRecords[course.code] || {};
  const hasAttendanceRecords = Object.keys(currentAttendance).length > 0;
  // Gated strictly when real student attendance statuses exist
  const isAttendanceDone = hasAttendanceRecords;

  // Derived Total Capacity
  const totalCapacity = useMemo(() => {
    return groups.reduce((sum, g) => sum + (g.seats?.length || g.capacity || 0), 0);
  }, [groups]);

  // Derived list of unassigned students
  const seatedStudentIds = useMemo(() => {
    const ids = new Set<string>();
    (Object.values(assignments) as SeatingAssignment[]).forEach(a => {
      if (!a.effectiveTo && a.studentId) {
        ids.add(a.studentId);
      }
    });
    return ids;
  }, [assignments]);

  const unassignedStudents = useMemo(() => {
    return courseStudents.filter(s => !seatedStudentIds.has(s.studentId));
  }, [courseStudents, seatedStudentIds]);

  // Build Default Standard Groups (4 double rows = 40 seats)
  const generateDefaultStandardGroups = (): SeatingGroup[] => {
    const newGroups: SeatingGroup[] = [];
    const groupCount = 4;
    const seatsPerGroup = 10;

    for (let g = 1; g <= groupCount; g++) {
      const gId = `group_${g}`;
      const seats: SeatingSeat[] = [];
      for (let s = 1; s <= seatsPerGroup; s++) {
        seats.push({
          id: `seat_${g}_${s}`,
          groupId: gId,
          seatNumber: s,
          label: `${g}-${s}`,
          status: 'ACTIVE'
        });
      }
      newGroups.push({
        id: gId,
        layoutId,
        name: `แถวที่ ${g} (โต๊ะคู่)`,
        capacity: seatsPerGroup,
        order: g,
        positionX: (g - 1) * 280,
        positionY: 0,
        shape: 'ROW',
        seats
      });
    }
    return newGroups;
  };

  // 3. Load Layout from Firestore or fallback to LocalStorage/Default
  useEffect(() => {
    let isMounted = true;
    const fetchLayout = async () => {
      setIsLoading(true);
      try {
        const remoteData = await getSeatingLayoutFromFirestore(layoutId);
        if (!isMounted) return;

        if (remoteData && remoteData.groups && remoteData.groups.length > 0) {
          setLayoutMeta(remoteData.layout);
          setGroups(remoteData.groups);
          setZoomScale(remoteData.layout.zoomScale || 100);
          setIsLayoutLocked(remoteData.layout.isLocked ?? false);

          // Convert active assignments array to record
          const assignMap: Record<string, SeatingAssignment> = {};
          remoteData.assignments.forEach(a => {
            if (!a.effectiveTo) {
              assignMap[a.seatId] = a;
            }
          });
          setAssignments(assignMap);
          setAllAssignmentsHistory(remoteData.assignments);
        } else {
          // Check local fallback
          const localKey = `seating_layout_${layoutId}`;
          const localRaw = localStorage.getItem(localKey);
          if (localRaw) {
            const parsed = JSON.parse(localRaw);
            if (parsed.groups && parsed.groups.length > 0) {
              setGroups(parsed.groups);
              setAssignments(parsed.assignments || {});
              setZoomScale(parsed.zoomScale || 100);
              setIsLayoutLocked(parsed.isLocked ?? false);
              return;
            }
          }

          // Generate default standard layout
          const defGroups = generateDefaultStandardGroups();
          setGroups(defGroups);

          // Auto-assign existing course students to default seats initially
          const initialAssign: Record<string, SeatingAssignment> = {};
          let studentIdx = 0;
          defGroups.forEach(g => {
            g.seats.forEach(s => {
              if (studentIdx < courseStudents.length) {
                const student = courseStudents[studentIdx];
                const assignment: SeatingAssignment = {
                  id: `assign_${s.id}_${student.studentId}`,
                  layoutId,
                  groupId: g.id,
                  seatId: s.id,
                  studentId: student.studentId,
                  studentName: student.name,
                  studentNo: student.studentNo,
                  effectiveFrom: new Date().toISOString(),
                  effectiveTo: null,
                  assignedBy: user?.uid || 'teacher_001'
                };
                initialAssign[s.id] = assignment;
                studentIdx++;
              }
            });
          });
          setAssignments(initialAssign);
        }
      } catch (err) {
        console.warn('Could not load remote seating layout, using default:', err);
        const defGroups = generateDefaultStandardGroups();
        setGroups(defGroups);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchLayout();
    return () => { isMounted = false; };
  }, [layoutId, courseStudents]);

  // 4. Save Layout Function
  const handleSaveLayout = async (showNotice: boolean = true) => {
    setIsSaving(true);
    try {
      const updatedMeta: SeatingLayout = {
        ...layoutMeta,
        totalCapacity,
        zoomScale,
        isLocked: isLayoutLocked,
        updatedAt: new Date().toISOString()
      };

      const currentAssignmentsArray: SeatingAssignment[] = Object.values(assignments);
      await saveSeatingLayoutToFirestore(updatedMeta, groups, currentAssignmentsArray);

      // Save locally as backup
      localStorage.setItem(`seating_layout_${layoutId}`, JSON.stringify({
        layout: updatedMeta,
        groups,
        assignments,
        zoomScale,
        isLocked: isLayoutLocked
      }));

      if (showNotice) {
        setSaveToast('บันทึกและซิงค์ผังที่นั่งเรียบร้อยแล้ว');
        setTimeout(() => setSaveToast(null), 3000);
      }
    } catch (err) {
      console.error('Error saving layout to Firestore:', err);
      // Fallback local persistence
      localStorage.setItem(`seating_layout_${layoutId}`, JSON.stringify({
        layout: layoutMeta,
        groups,
        assignments,
        zoomScale,
        isLocked: isLayoutLocked
      }));
      if (showNotice) {
        setSaveToast('บันทึกข้อมูลในเครื่องเรียบร้อยแล้ว (ออฟไลน์)');
        setTimeout(() => setSaveToast(null), 3000);
      }
    } finally {
      setIsSaving(false);
    }
  };

  // 5. Group Management Handlers
  const handleAddGroup = (name: string, capacity: number, description?: string) => {
    const newGroupId = `group_${Date.now()}`;
    const seats: SeatingSeat[] = [];
    for (let s = 1; s <= capacity; s++) {
      seats.push({
        id: `seat_${newGroupId}_${s}`,
        groupId: newGroupId,
        seatNumber: s,
        label: `${groups.length + 1}-${s}`,
        status: 'ACTIVE'
      });
    }

    const newGroup: SeatingGroup = {
      id: newGroupId,
      layoutId,
      name,
      capacity,
      order: groups.length + 1,
      shape: 'POD',
      description,
      positionX: (groups.length % 4) * 280,
      positionY: Math.floor(groups.length / 4) * 320,
      seats
    };

    setGroups(prev => [...prev, newGroup]);
    setSaveToast(`เพิ่มกลุ่ม "${name}" (${capacity} ที่นั่ง) สำเร็จ`);
    setTimeout(() => setSaveToast(null), 2500);
  };

  const handleDeleteGroup = (groupId: string) => {
    const groupToDelete = groups.find(g => g.id === groupId);
    if (!groupToDelete) return;

    if (window.confirm(`ต้องการลบ "${groupToDelete.name}" หรือไม่? (นักเรียนที่นั่งอยู่จะถูกย้ายออก)`)) {
      // Remove active assignments in this group
      setAssignments(prev => {
        const next = { ...prev };
        groupToDelete.seats.forEach(s => {
          if (next[s.id]) {
            delete next[s.id];
          }
        });
        return next;
      });

      setGroups(prev => prev.filter(g => g.id !== groupId));
      setSaveToast(`ลบกลุ่ม "${groupToDelete.name}" เรียบร้อยแล้ว`);
      setTimeout(() => setSaveToast(null), 2500);
    }
  };

  const handleResizeGroup = (groupId: string, delta: number) => {
    setGroups(prev => prev.map(group => {
      if (group.id !== groupId) return group;

      const currentSeats = [...group.seats];
      const newCapacity = Math.max(1, Math.min(16, currentSeats.length + delta));

      if (delta > 0) {
        // Add seats
        const nextNum = currentSeats.length + 1;
        const newSeat: SeatingSeat = {
          id: `seat_${groupId}_${Date.now()}_${nextNum}`,
          groupId,
          seatNumber: nextNum,
          label: `${group.order}-${nextNum}`,
          status: 'ACTIVE'
        };
        currentSeats.push(newSeat);
      } else if (delta < 0 && currentSeats.length > 1) {
        // Remove the last seat
        const removedSeat = currentSeats.pop();
        if (removedSeat && assignments[removedSeat.id]) {
          // Unassign student on removed seat
          setAssignments(curr => {
            const next = { ...curr };
            delete next[removedSeat.id];
            return next;
          });
        }
      }

      return {
        ...group,
        capacity: newCapacity,
        seats: currentSeats
      };
    }));
  };

  const handleSaveGroupName = (groupId: string) => {
    if (!editingGroupName.trim()) {
      setEditingGroupId(null);
      return;
    }
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, name: editingGroupName.trim() } : g));
    setEditingGroupId(null);
    setEditingGroupName('');
  };

  // 6. Seat Assignment Handlers
  const handleAssignStudent = async (student: Student, seat: SeatingSeat, group: SeatingGroup) => {
    if (isLayoutLocked) {
      setSaveToast('⚠️ ผังที่นั่งถูกล็อกไว้ ปลดล็อกก่อนทำการเปลี่ยนแปลง');
      setTimeout(() => setSaveToast(null), 3000);
      return;
    }

    const previousAssignment = assignments[seat.id];
    const now = new Date().toISOString();

    // Check if student is already seated elsewhere in this layout
    let prevSeatIdForThisStudent: string | null = null;
    (Object.entries(assignments) as [string, SeatingAssignment][]).forEach(([sId, a]) => {
      if (a.studentId === student.studentId) {
        prevSeatIdForThisStudent = sId;
      }
    });

    const newAssignment: SeatingAssignment = {
      id: `assign_${seat.id}_${student.studentId}_${Date.now()}`,
      layoutId,
      groupId: group.id,
      seatId: seat.id,
      studentId: student.studentId,
      studentName: student.name,
      studentNo: student.studentNo,
      effectiveFrom: now,
      effectiveTo: null,
      assignedBy: user?.uid || 'teacher_001',
      reason: 'คุณครูมอบหมายที่นั่ง'
    };

    setAssignments(prev => {
      const next = { ...prev };
      // If student was elsewhere, vacate that seat
      if (prevSeatIdForThisStudent && prevSeatIdForThisStudent !== seat.id) {
        delete next[prevSeatIdForThisStudent];
      }
      next[seat.id] = newAssignment;
      return next;
    });

    // Record in history
    setAllAssignmentsHistory(prev => [
      ...(previousAssignment ? [{ ...previousAssignment, effectiveTo: now }] : []),
      newAssignment,
      ...prev
    ]);

    setSelectedStudentToPlace(null);
    setDraggedStudent(null);

    // Sync to Firestore in background
    try {
      await assignStudentToSeatInFirestore(newAssignment);
    } catch (e) {
      console.warn('Background sync assign error:', e);
    }
  };

  const handleUnassignSeat = async (seatId: string) => {
    if (isLayoutLocked) return;

    const currentAssignment = assignments[seatId];
    if (!currentAssignment) return;

    const now = new Date().toISOString();
    setAssignments(prev => {
      const next = { ...prev };
      delete next[seatId];
      return next;
    });

    setAllAssignmentsHistory(prev => [
      { ...currentAssignment, effectiveTo: now },
      ...prev.filter(a => a.id !== currentAssignment.id)
    ]);

    try {
      await unassignSeatInFirestore(layoutId, seatId, currentAssignment.studentId);
    } catch (e) {
      console.warn('Background sync unassign error:', e);
    }
  };

  const handleSwapSeats = async (seatAId: string, seatBId: string) => {
    if (isLayoutLocked || seatAId === seatBId) return;

    const assignA = assignments[seatAId];
    const assignB = assignments[seatBId];
    if (!assignA && !assignB) return;

    const now = new Date().toISOString();

    setAssignments(prev => {
      const next = { ...prev };
      if (assignA && assignB) {
        // Swap both
        next[seatAId] = { ...assignB, seatId: seatAId, effectiveFrom: now, id: `assign_${seatAId}_${assignB.studentId}_${Date.now()}` };
        next[seatBId] = { ...assignA, seatId: seatBId, effectiveFrom: now, id: `assign_${seatBId}_${assignA.studentId}_${Date.now()}` };
      } else if (assignA && !assignB) {
        // Move A to B
        delete next[seatAId];
        next[seatBId] = { ...assignA, seatId: seatBId, effectiveFrom: now, id: `assign_${seatBId}_${assignA.studentId}_${Date.now()}` };
      } else if (!assignA && assignB) {
        // Move B to A
        delete next[seatBId];
        next[seatAId] = { ...assignB, seatId: seatAId, effectiveFrom: now, id: `assign_${seatAId}_${assignB.studentId}_${Date.now()}` };
      }
      return next;
    });

    setDraggedStudent(null);
    setSelectedStudentToPlace(null);
  };

  // Auto-Assign unseated students
  const handleAutoAssignAll = () => {
    if (isLayoutLocked) return;

    const availableSeats: { seat: SeatingSeat; group: SeatingGroup }[] = [];
    groups.forEach(g => {
      g.seats.forEach(s => {
        if (!assignments[s.id]) {
          availableSeats.push({ seat: s, group: g });
        }
      });
    });

    if (availableSeats.length === 0 || unassignedStudents.length === 0) {
      setSaveToast('ไม่มีที่นั่งว่างหรือนักเรียนทุกคนมีที่นั่งแล้ว');
      setTimeout(() => setSaveToast(null), 2500);
      return;
    }

    const newAssignments = { ...assignments };
    const now = new Date().toISOString();
    let assignedCount = 0;

    unassignedStudents.forEach((student, idx) => {
      if (idx < availableSeats.length) {
        const { seat, group } = availableSeats[idx];
        const assign: SeatingAssignment = {
          id: `assign_${seat.id}_${student.studentId}_${Date.now()}_${idx}`,
          layoutId,
          groupId: group.id,
          seatId: seat.id,
          studentId: student.studentId,
          studentName: student.name,
          studentNo: student.studentNo,
          effectiveFrom: now,
          effectiveTo: null,
          assignedBy: user?.uid || 'teacher_001',
          reason: 'จัดที่นั่งอัตโนมัติ'
        };
        newAssignments[seat.id] = assign;
        assignedCount++;
      }
    });

    setAssignments(newAssignments);
    setSaveToast(`จัดที่นั่งอัตโนมัติสำเร็จ (${assignedCount} คน)`);
    setTimeout(() => setSaveToast(null), 3000);
  };

  // Clear all seat assignments
  const handleClearAllSeats = () => {
    if (isLayoutLocked) return;
    if (window.confirm('คุณต้องการยกเลิกการนั่งของนักเรียนทุกคนในห้องใช่หรือไม่?')) {
      const now = new Date().toISOString();
      const currentList: SeatingAssignment[] = (Object.values(assignments) as SeatingAssignment[]).map(a => ({ ...a, effectiveTo: now }));
      setAllAssignmentsHistory(prev => [...currentList, ...prev]);
      setAssignments({});
      setSaveToast('ยกเลิกการนั่งทั้งหมดเรียบร้อยแล้ว');
      setTimeout(() => setSaveToast(null), 2500);
    }
  };

  // 7. Applying Layout Presets / Templates
  const handleApplyTemplate = async (templateId: string, templateData?: Partial<SeatingLayout>) => {
    if (templateId === 'preset_standard_40') {
      setGroups(generateDefaultStandardGroups());
      setAssignments({});
      setSaveToast('ปรับใช้แม่แบบ "แถวคู่มาตรฐาน (40 ที่นั่ง)" เรียบร้อยแล้ว');
    } else if (templateId === 'preset_lab_pods_36') {
      const newGroups: SeatingGroup[] = [];
      for (let g = 1; g <= 6; g++) {
        const gId = `group_lab_${g}`;
        const seats: SeatingSeat[] = [];
        for (let s = 1; s <= 6; s++) {
          seats.push({ id: `seat_${gId}_${s}`, groupId: gId, seatNumber: s, label: `โต๊ะ ${g}-${s}`, status: 'ACTIVE' });
        }
        newGroups.push({
          id: gId,
          layoutId,
          name: `โต๊ะทดลองที่ ${g}`,
          capacity: 6,
          order: g,
          shape: 'POD',
          positionX: ((g - 1) % 3) * 320,
          positionY: Math.floor((g - 1) / 3) * 340,
          seats
        });
      }
      setGroups(newGroups);
      setAssignments({});
      setSaveToast('ปรับใช้แม่แบบ "โต๊ะแล็บทดลอง (6 กลุ่ม 36 ที่นั่ง)" เรียบร้อยแล้ว');
    } else if (templateId === 'preset_large_groups_40') {
      const newGroups: SeatingGroup[] = [];
      for (let g = 1; g <= 8; g++) {
        const gId = `group_al_${g}`;
        const seats: SeatingSeat[] = [];
        for (let s = 1; s <= 5; s++) {
          seats.push({ id: `seat_${gId}_${s}`, groupId: gId, seatNumber: s, label: `G${g}-${s}`, status: 'ACTIVE' });
        }
        newGroups.push({
          id: gId,
          layoutId,
          name: `กลุ่มย่อย ${g}`,
          capacity: 5,
          order: g,
          shape: 'POD',
          positionX: ((g - 1) % 4) * 280,
          positionY: Math.floor((g - 1) / 4) * 320,
          seats
        });
      }
      setGroups(newGroups);
      setAssignments({});
      setSaveToast('ปรับใช้แม่แบบ "กลุ่มแล็บใหญ่ (8 กลุ่ม 40 ที่นั่ง)" เรียบร้อยแล้ว');
    } else if (templateId === 'preset_u_shape_32') {
      const newGroups: SeatingGroup[] = [
        {
          id: 'group_u_left',
          layoutId,
          name: 'แถวปีกซ้าย',
          capacity: 10,
          order: 1,
          shape: 'ROW',
          positionX: 0,
          positionY: 0,
          seats: Array.from({ length: 10 }, (_, i) => ({ id: `seat_u_left_${i + 1}`, groupId: 'group_u_left', seatNumber: i + 1, label: `L-${i + 1}`, status: 'ACTIVE' }))
        },
        {
          id: 'group_u_back',
          layoutId,
          name: 'แถวหลังห้อง (แนวนอน)',
          capacity: 12,
          order: 2,
          shape: 'ROW',
          positionX: 300,
          positionY: 0,
          seats: Array.from({ length: 12 }, (_, i) => ({ id: `seat_u_back_${i + 1}`, groupId: 'group_u_back', seatNumber: i + 1, label: `B-${i + 1}`, status: 'ACTIVE' }))
        },
        {
          id: 'group_u_right',
          layoutId,
          name: 'แถวปีกขวา',
          capacity: 10,
          order: 3,
          shape: 'ROW',
          positionX: 620,
          positionY: 0,
          seats: Array.from({ length: 10 }, (_, i) => ({ id: `seat_u_right_${i + 1}`, groupId: 'group_u_right', seatNumber: i + 1, label: `R-${i + 1}`, status: 'ACTIVE' }))
        }
      ];
      setGroups(newGroups);
      setAssignments({});
      setSaveToast('ปรับใช้แม่แบบ "ตัว U / เกือกม้า (32 ที่นั่ง)" เรียบร้อยแล้ว');
    } else if (templateId === 'preset_exam_grid_40') {
      const newGroups: SeatingGroup[] = [];
      for (let g = 1; g <= 5; g++) {
        const gId = `group_exam_${g}`;
        const seats: SeatingSeat[] = [];
        for (let s = 1; s <= 8; s++) {
          seats.push({ id: `seat_${gId}_${s}`, groupId: gId, seatNumber: s, label: `แถว ${g} โต๊ะ ${s}`, status: 'ACTIVE' });
        }
        newGroups.push({
          id: gId,
          layoutId,
          name: `แถวสอบที่ ${g}`,
          capacity: 8,
          order: g,
          shape: 'ROW',
          positionX: (g - 1) * 230,
          positionY: 0,
          seats
        });
      }
      setGroups(newGroups);
      setAssignments({});
      setSaveToast('ปรับใช้แม่แบบ "โต๊ะสอบแถวเดี่ยว (40 ที่นั่ง)" เรียบร้อยแล้ว');
    } else {
      // Remote Template Deep Cloning
      try {
        const clonedGroups = await cloneLayoutTemplateInFirestore(templateId, layoutId);
        setGroups(clonedGroups);
        setAssignments({});
        setSaveToast('คัดลอกผังแม่แบบจากคุณครูสำเร็จแล้ว!');
      } catch (err) {
        console.error('Error cloning template:', err);
      }
    }
    setTimeout(() => setSaveToast(null), 3000);
  };

  // Convert current dynamic groups to pickable "desk" units for RandomStudentPickerModal.
  // ROW/GRID ("แถวโต๊ะคู่") ถูกหั่นเป็นโต๊ะละ 2 ที่นั่ง — ไม่งั้น "สุ่มโต๊ะ" จะได้ทั้งแถว ดู buildDeskGroupsForPicker
  const classroomGroupsForPicker: ClassroomDeskGroup[] = useMemo(
    () => buildDeskGroupsForPicker(groups, assignments, courseStudents),
    [groups, assignments, courseStudents]
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b0e14] text-slate-100 overflow-hidden select-none font-sans">
      
      {/* Top Header & Toolbar */}
      <header className="px-5 py-3.5 bg-[#121620] border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/20">
            <LayoutGrid className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                ผังห้องเรียน {formatCourseTitle(course.name, course.level, course.room)}
              </h2>
              {isLayoutLocked ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> ล็อกผังแล้ว
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <Unlock className="w-3 h-3" /> โหมดแก้ไข
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              ความจุห้อง: <strong className="text-emerald-400 font-mono">{seatedStudentIds.size}/{totalCapacity}</strong> ที่นั่ง • {groups.length} กลุ่มโต๊ะ • นักเรียนในห้อง {courseStudents.length} คน
            </p>
          </div>
        </div>

        {/* Toolbar Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Zoom Controls */}
          <div className="flex items-center bg-[#181c28] border border-slate-800 rounded-xl p-1 text-slate-300">
            <button
              onClick={() => setZoomScale(z => Math.max(70, z - 10))}
              title="ย่อขนาด"
              className="p-1.5 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 text-[11px] font-mono font-bold text-slate-300">
              {zoomScale}%
            </span>
            <button
              onClick={() => setZoomScale(z => Math.min(140, z + 10))}
              title="ขยายขนาด"
              className="p-1.5 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Random Picker Button */}
          <button
            onClick={() => setShowRandomPicker(true)}
            className="px-3 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg shadow-indigo-600/20"
          >
            <Sparkles className="w-3.5 h-3.5 animate-spin [animation-duration:6s]" />
            <span>สุ่มนักเรียน (Fair Pick)</span>
          </button>

          {/* Template Picker */}
          <button
            onClick={() => setShowTemplateModal(true)}
            className="px-3 py-2 bg-[#181c28] hover:bg-slate-800 border border-slate-700/80 text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            <span>แม่แบบผังห้อง</span>
          </button>

          {/* Add Group Button */}
          <button
            onClick={() => setShowCreateGroupModal(true)}
            disabled={isLayoutLocked}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-600/20"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>เพิ่มกลุ่มโต๊ะ</span>
          </button>

          {/* Auto Assign */}
          <button
            onClick={handleAutoAssignAll}
            disabled={isLayoutLocked || unassignedStudents.length === 0}
            className="px-3 py-2 bg-[#181c28] hover:bg-slate-800 border border-slate-700/80 disabled:opacity-40 text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <UserCheck className="w-3.5 h-3.5 text-blue-400" />
            <span>จัดที่นั่งอัตโนมัติ</span>
          </button>

          {/* Lock / Unlock Toggle */}
          <button
            onClick={() => {
              const nextState = !isLayoutLocked;
              setIsLayoutLocked(nextState);
              setLayoutMeta(m => ({ ...m, isLocked: nextState }));
              setSaveToast(nextState ? '🔒 ล็อกผังที่นั่งแล้ว' : '🔓 ปลดล็อกผังเพื่อแก้ไข');
              setTimeout(() => setSaveToast(null), 2500);
            }}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
              isLayoutLocked
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
            }`}
          >
            {isLayoutLocked ? <Lock className="w-3.5 h-3.5 text-amber-400" /> : <Unlock className="w-3.5 h-3.5 text-slate-400" />}
            <span>{isLayoutLocked ? 'ปลดล็อก' : 'ล็อกผัง'}</span>
          </button>

          {/* Save Button */}
          <button
            onClick={() => handleSaveLayout(true)}
            disabled={isSaving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg shadow-blue-600/20"
          >
            {isSaving ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            <span>บันทึกผัง</span>
          </button>
        </div>
      </header>

      {/* Attendance Gating Warning Banner */}
      {!isAttendanceDone && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-5 py-2.5 flex items-center justify-between gap-3 text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>ยังไม่ได้เช็คชื่อเข้าเรียนสำหรับคาบนี้:</strong> กรุณาบันทึกเช็คชื่อเพื่อให้ระบบแสดงสถานะ ขาด/ลา บนที่นั่ง และสุ่มได้อย่างถูกต้อง
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              if (onTakeAttendance) {
                onTakeAttendance();
              } else {
                setShowAttendanceModal(true);
              }
            }}
            className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs transition-all whitespace-nowrap shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>บันทึกการเช็คชื่อ (Take Attendance)</span>
          </button>
        </div>
      )}

      {/* Save Notification Toast */}
      {saveToast && (
        <div className="fixed top-16 right-6 z-50 bg-[#161f30] border border-emerald-500/40 text-emerald-300 px-4 py-2.5 rounded-xl text-xs font-bold shadow-2xl flex items-center gap-2 animate-in slide-in-from-top duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{saveToast}</span>
        </div>
      )}

      {/* Main Workspace Layout */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        
        {/* Left Side: Unseated Students Pool */}
        <aside className="w-64 bg-[#10141e] border-r border-slate-800 flex flex-col shrink-0 z-10">
          <div className="p-3.5 border-b border-slate-800 flex items-center justify-between bg-[#0e111a]">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-400" />
              <h3 className="text-xs font-bold text-white">นักเรียนที่ยังไม่มีที่นั่ง</h3>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-800 text-slate-300">
              {unassignedStudents.length} คน
            </span>
          </div>

          <div className="p-3 overflow-y-auto space-y-2 flex-1">
            {courseStudents.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
                <Users className="w-8 h-8 text-slate-600" />
                <span>ยังไม่มีรายชื่อนักเรียนในห้องนี้</span>
                <span className="text-[10px] text-slate-600">กรุณานำเข้าข้อมูลนักเรียนผ่านระบบจัดการ</span>
              </div>
            ) : unassignedStudents.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500/40" />
                <span>นักเรียนทุกคนมีที่นั่งครบแล้ว</span>
              </div>
            ) : (
              unassignedStudents.map(student => {
                const attStatus = currentAttendance[student.studentId];
                const isAbsent = attStatus === 'ABSENT';
                const isLeave = attStatus === 'LEAVE';
                const isSelected = selectedStudentToPlace?.studentId === student.studentId;

                return (
                  <div
                    key={student.studentId}
                    onClick={() => {
                      if (isLayoutLocked) return;
                      setSelectedStudentToPlace(isSelected ? null : student);
                    }}
                    draggable={!isLayoutLocked}
                    onDragStart={() => setDraggedStudent({ student })}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                      isSelected
                        ? 'bg-emerald-950/40 border-emerald-500 text-white shadow-lg shadow-emerald-900/20'
                        : isAbsent
                        ? 'bg-red-950/20 border-red-500/30 text-slate-400 opacity-75'
                        : isLeave
                        ? 'bg-amber-950/20 border-amber-500/30 text-slate-400 opacity-75'
                        : 'bg-[#181c28] border-slate-800 hover:border-slate-700 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={student.avatar}
                        alt={student.name}
                        className="w-7 h-7 rounded-full bg-slate-800 object-cover shrink-0 border border-slate-700"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate">{student.name}</div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1.5 font-mono">
                          <span>เลขที่ {student.studentNumber || '-'}</span>
                          {student.nickname && <span>({student.nickname})</span>}
                        </div>
                      </div>
                    </div>

                    {isAbsent ? (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 shrink-0">
                        ขาด
                      </span>
                    ) : isLeave ? (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                        ลา
                      </span>
                    ) : (
                      <GripVertical className="w-3.5 h-3.5 text-slate-500 shrink-0 opacity-50 hover:opacity-100" />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {selectedStudentToPlace && (
            <div className="p-3 bg-emerald-950/30 border-t border-emerald-500/30 text-xs text-emerald-300">
              <p className="font-bold flex items-center gap-1 mb-1">
                <Sparkles className="w-3.5 h-3.5" /> เลือกที่นั่งบนผัง
              </p>
              <p className="text-[11px] text-slate-400">
                คลิกที่เก้าอี้ว่างบนผังเพื่อวาง {selectedStudentToPlace.name}
              </p>
            </div>
          )}
        </aside>

        {/* Center: Interactive Seating Chart Canvas */}
        <main className="flex-1 overflow-auto p-8 relative flex flex-col items-center">
          
          {/* Blackboard / Presentation Front Indicator */}
          <div className="w-full max-w-4xl mb-8 flex flex-col items-center">
            <div className="w-3/4 h-7 bg-slate-900 border border-slate-700/80 rounded-xl flex items-center justify-center text-xs font-bold text-slate-400 tracking-wider shadow-inner">
              🖥️ กระดานดำ / หน้าห้องเรียน (TEACHER PODIUM & BLACKBOARD)
            </div>
          </div>

          {/* Seating Groups Container */}
          <div 
            className="flex flex-wrap gap-8 justify-center items-start transition-transform duration-200 origin-top"
            style={{ transform: `scale(${zoomScale / 100})` }}
          >
            {groups.map(group => {
              const isEditing = editingGroupId === group.id;

              return (
                <div
                  key={group.id}
                  className="bg-[#141824] border border-slate-800/90 hover:border-slate-700 rounded-2xl p-4 shadow-xl transition-all min-w-[260px] max-w-md flex flex-col"
                >
                  {/* Group Header */}
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800/80">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={editingGroupName}
                            onChange={e => setEditingGroupName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSaveGroupName(group.id)}
                            className="bg-[#1b2030] border border-emerald-500 rounded px-2 py-0.5 text-xs text-white outline-none w-32"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveGroupName(group.id)}
                            className="p-1 text-emerald-400 hover:text-emerald-300"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span 
                          onClick={() => {
                            if (!isLayoutLocked) {
                              setEditingGroupId(group.id);
                              setEditingGroupName(group.name);
                            }
                          }}
                          className="text-xs font-bold text-white truncate cursor-pointer hover:text-emerald-400 flex items-center gap-1.5"
                          title="คลิกเพื่อแก้ไขชื่อกลุ่ม"
                        >
                          {group.name}
                          {!isLayoutLocked && <Edit2 className="w-2.5 h-2.5 text-slate-500 opacity-60" />}
                        </span>
                      )}
                    </div>

                    {/* Group Capacity Controls & Delete */}
                    {!isLayoutLocked && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleResizeGroup(group.id, -1)}
                          title="ลดที่นั่งในกลุ่ม"
                          disabled={group.seats.length <= 1}
                          className="p-1 bg-[#1b2030] hover:bg-slate-700 text-slate-300 disabled:opacity-30 rounded-md transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-1.5 text-[11px] font-mono font-bold text-emerald-400">
                          {group.seats.length}
                        </span>
                        <button
                          onClick={() => handleResizeGroup(group.id, 1)}
                          title="เพิ่มที่นั่งในกลุ่ม"
                          disabled={group.seats.length >= 16}
                          className="p-1 bg-[#1b2030] hover:bg-slate-700 text-slate-300 disabled:opacity-30 rounded-md transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteGroup(group.id)}
                          title="ลบกลุ่มนี้"
                          className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors ml-1"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Seats Grid */}
                  <div className="grid grid-cols-2 gap-2.5">
                    {group.seats.map(seat => {
                      const assignment = assignments[seat.id];
                      const student = assignment ? courseStudents.find(s => s.studentId === assignment.studentId) : null;
                      const attStatus = student ? currentAttendance[student.studentId] : null;
                      const isAbsent = attStatus === 'ABSENT';
                      const isLeave = attStatus === 'LEAVE';
                      const isTargetForPlace = selectedStudentToPlace !== null && !assignment;

                      return (
                        <div
                          key={seat.id}
                          onClick={() => {
                            if (selectedStudentToPlace && !assignment) {
                              handleAssignStudent(selectedStudentToPlace, seat, group);
                            }
                          }}
                          onDragOver={e => e.preventDefault()}
                          onDrop={() => {
                            if (draggedStudent) {
                              if (draggedStudent.fromSeatId) {
                                handleSwapSeats(draggedStudent.fromSeatId, seat.id);
                              } else {
                                handleAssignStudent(draggedStudent.student, seat, group);
                              }
                            }
                          }}
                          className={`min-h-[105px] p-2.5 rounded-xl border transition-all flex flex-col justify-between relative group/seat ${
                            assignment && student
                              ? isAbsent
                                ? 'bg-red-950/20 border-red-500/40 text-slate-400 ring-1 ring-red-500/20'
                                : isLeave
                                ? 'bg-amber-950/20 border-amber-500/40 text-slate-400 ring-1 ring-amber-500/20'
                                : 'bg-[#1a2030] border-slate-700/80 hover:border-slate-600 text-slate-100 shadow-md'
                              : isTargetForPlace
                              ? 'bg-emerald-950/20 border-dashed border-emerald-500/60 hover:bg-emerald-900/30 cursor-pointer animate-pulse'
                              : 'bg-slate-900/40 border-dashed border-slate-800 text-slate-500 hover:border-slate-700'
                          }`}
                        >
                          {/* Seat Label & Actions */}
                          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                            <span className="font-mono">{seat.label || seat.seatNumber}</span>
                            
                            <div className="flex items-center gap-1">
                              {/* Seat History Button */}
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  setSelectedSeatForHistory({ seat, group });
                                }}
                                title="ดูประวัติที่นั่งนี้"
                                className="p-0.5 text-slate-500 hover:text-indigo-400 rounded transition-colors"
                              >
                                <History className="w-3 h-3" />
                              </button>

                              {/* Unassign Button */}
                              {!isLayoutLocked && assignment && (
                                <button
                                  onClick={e => {
                                    e.stopPropagation();
                                    handleUnassignSeat(seat.id);
                                  }}
                                  title="ย้ายออกจากที่นั่ง"
                                  className="p-0.5 text-slate-500 hover:text-red-400 rounded transition-colors"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Seated Student Content or Empty Seat */}
                          {assignment && student ? (
                            <div 
                              draggable={!isLayoutLocked}
                              onDragStart={() => setDraggedStudent({ student, fromSeatId: seat.id })}
                              className="cursor-grab active:cursor-grabbing flex flex-col justify-between flex-1"
                            >
                              <div className="flex items-center gap-2">
                                <img
                                  src={student.avatar}
                                  alt={student.name}
                                  className={`w-7 h-7 rounded-full object-cover shrink-0 border ${
                                    isAbsent ? 'border-red-500/50 grayscale' : isLeave ? 'border-amber-500/50 grayscale' : 'border-emerald-500/50'
                                  }`}
                                />
                                <div className="min-w-0">
                                  <div className="text-xs font-bold truncate text-white leading-tight">
                                    {student.name}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    #{student.studentNumber} {student.nickname && `(${student.nickname})`}
                                  </div>
                                </div>
                              </div>

                              {/* Attendance & Points Badges */}
                              <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-slate-800/80 text-[10px]">
                                {isAbsent ? (
                                  <span className="px-1.5 py-0.2 rounded font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                                    ขาดเรียน
                                  </span>
                                ) : isLeave ? (
                                  <span className="px-1.5 py-0.2 rounded font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                    ลากิจ/ป่วย
                                  </span>
                                ) : (
                                  <span className="text-emerald-400 font-mono font-bold flex items-center gap-0.5">
                                    <Award className="w-3 h-3" />
                                    {activeLearningPoints[student.studentId] || 0} pt
                                  </span>
                                )}

                                {/* Quick Point Increment */}
                                {!isLayoutLocked && !isAbsent && (
                                  <button
                                    onClick={e => {
                                      e.stopPropagation();
                                      addActiveLearningPoints(student.studentId, 1);
                                      setSaveToast(`+1 คะแนนจิตพิสัย: ${student.name}`);
                                      setTimeout(() => setSaveToast(null), 2000);
                                    }}
                                    title="+1 แต้มการมีส่วนร่วม"
                                    className="px-1.5 py-0.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded font-bold transition-all text-[9px]"
                                  >
                                    +1
                                  </button>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-600 text-[11px]">
                              {isTargetForPlace ? (
                                <span className="text-emerald-400 font-bold">คลิกเพื่อวาง</span>
                              ) : (
                                <span>ว่าง</span>
                              )}
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
        </main>
      </div>

      {/* Template Picker Modal (Task 2B) */}
      <TemplatePickerModal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        onSelectTemplate={handleApplyTemplate}
      />

      {/* Create Group Modal */}
      <CreateGroupModal
        isOpen={showCreateGroupModal}
        onClose={() => setShowCreateGroupModal(false)}
        onCreateGroup={handleAddGroup}
        nextGroupNumber={groups.length + 1}
      />

      {/* Seat History Modal (Task 3) */}
      <SeatHistoryModal
        isOpen={selectedSeatForHistory !== null}
        onClose={() => setSelectedSeatForHistory(null)}
        layoutId={layoutId}
        selectedSeat={selectedSeatForHistory}
        allLocalAssignments={allAssignmentsHistory}
      />

      {/* Random Student Picker Modal (Adapted to dynamic classroom groups) */}
      <RandomStudentPickerModal
        isOpen={showRandomPicker}
        onClose={() => setShowRandomPicker(false)}
        courseStudents={courseStudents}
        classroomGroups={classroomGroupsForPicker}
        attendanceRecords={currentAttendance}
        courseId={courseId}
        onSelectHighlight={(ids) => setHighlightedStudentIds(ids)}
      />

      {/* Real Firestore Attendance Modal */}
      <TakeAttendanceModal
        isOpen={showAttendanceModal}
        onClose={() => setShowAttendanceModal(false)}
        course={course}
        students={courseStudents}
        currentDate={currentDate}
        initialAttendance={currentAttendance}
        teacherId={user?.uid || 'teacher_001'}
        teacherName={user?.displayName || 'ครูผู้สอน'}
        onAttendanceSaved={(newStatuses) => {
          setFirestoreAttendance(newStatuses);
          // Also sync to store
          const { setAttendanceRecords, attendanceRecords: currRecs } = useStore.getState() as any;
          if (setAttendanceRecords) {
            setAttendanceRecords({
              ...currRecs,
              [courseId]: newStatuses,
              [course.code]: newStatuses
            });
          }
          setSaveToast('บันทึกการเช็คชื่อเข้าเรียนลง Firestore เรียบร้อยแล้ว');
          setTimeout(() => setSaveToast(null), 3000);
        }}
      />

    </div>
  );
};
