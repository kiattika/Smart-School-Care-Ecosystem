import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { usePeriodsConfig } from '../hooks/usePeriodsConfig';
import { 
  Clock, 
  Plus, 
  Save, 
  Trash2, 
  Edit3, 
  AlertTriangle, 
  Calendar, 
  ArrowUp, 
  ArrowDown, 
  Check, 
  Info, 
  CheckCircle2, 
  FileText,
  Copy,
  Sliders,
  Bell
} from 'lucide-react';
import { cn } from '../lib/utils';

export type PeriodType = 'HOMEROOM' | 'ACADEMIC' | 'LUNCH' | 'DEVELOPMENT' | 'BREAK';

export interface Period {
  id: string;
  periodNumber: number;
  periodName: string;
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  periodType: PeriodType;
  days: string[]; // ['MON', 'TUE', 'WED', 'THU', 'FRI']
}

export interface SchedulePattern {
  id: string;
  name: string;
  description: string;
  periods: Period[];
}

// 1. Initial Default Schedules
const DEFAULT_PATTERNS: SchedulePattern[] = [
  {
    id: 'default',
    name: 'ตารางเวลาปกติ (Default)',
    description: 'ตารางเวลาคาบเรียนมาตรฐาน 50 นาที พักกลางวัน 50 นาที ใช้ในวันจันทร์-พฤหัสบดี',
    periods: [
      { id: 'p-hr1', periodNumber: 0, periodName: 'กิจกรรมหน้าเสาธง & โฮมรูม', startTime: '07:30', endTime: '08:30', periodType: 'HOMEROOM', days: ['MON', 'TUE', 'WED', 'THU', 'FRI'] },
      { id: 'p-1', periodNumber: 1, periodName: 'คาบเรียนวิชาการที่ 1', startTime: '08:30', endTime: '09:20', periodType: 'ACADEMIC', days: ['MON', 'TUE', 'WED', 'THU', 'FRI'] },
      { id: 'p-2', periodNumber: 2, periodName: 'คาบเรียนวิชาการที่ 2', startTime: '09:20', endTime: '10:10', periodType: 'ACADEMIC', days: ['MON', 'TUE', 'WED', 'THU', 'FRI'] },
      { id: 'p-b1', periodNumber: 3, periodName: 'พักเบรกเช้า', startTime: '10:10', endTime: '10:20', periodType: 'BREAK', days: ['MON', 'TUE', 'WED', 'THU', 'FRI'] },
      { id: 'p-3', periodNumber: 3, periodName: 'คาบเรียนวิชาการที่ 3', startTime: '10:20', endTime: '11:10', periodType: 'ACADEMIC', days: ['MON', 'TUE', 'WED', 'THU', 'FRI'] },
      { id: 'p-4', periodNumber: 4, periodName: 'คาบเรียนวิชาการที่ 4', startTime: '11:10', endTime: '12:00', periodType: 'ACADEMIC', days: ['MON', 'TUE', 'WED', 'THU', 'FRI'] },
      { id: 'p-lunch', periodNumber: 5, periodName: 'พักรับประทานอาหารกลางวัน', startTime: '12:00', endTime: '12:50', periodType: 'LUNCH', days: ['MON', 'TUE', 'WED', 'THU', 'FRI'] },
      { id: 'p-5', periodNumber: 5, periodName: 'คาบเรียนวิชาการที่ 5', startTime: '12:50', endTime: '13:40', periodType: 'ACADEMIC', days: ['MON', 'TUE', 'WED', 'THU', 'FRI'] },
      { id: 'p-6', periodNumber: 6, periodName: 'คาบเรียนวิชาการที่ 6', startTime: '13:40', endTime: '14:30', periodType: 'ACADEMIC', days: ['MON', 'TUE', 'WED', 'THU', 'FRI'] },
      { id: 'p-7', periodNumber: 7, periodName: 'คาบเรียนวิชาการที่ 7', startTime: '14:30', endTime: '15:20', periodType: 'ACADEMIC', days: ['MON', 'TUE', 'WED', 'THU', 'FRI'] },
      { id: 'p-dev', periodNumber: 8, periodName: 'กิจกรรมพัฒนาผู้เรียน (ชมรม/แนะแนว)', startTime: '15:20', endTime: '16:10', periodType: 'DEVELOPMENT', days: ['MON', 'TUE', 'WED', 'THU', 'FRI'] },
      { id: 'p-home', periodNumber: 9, periodName: 'โฮมรูมเย็น / เคลียร์ห้องเรียน', startTime: '16:10', endTime: '16:30', periodType: 'HOMEROOM', days: ['MON', 'TUE', 'WED', 'THU', 'FRI'] }
    ]
  },
  {
    id: 'friday',
    name: 'ตารางเวลาวันศุกร์ / กิจกรรม',
    description: 'ลดเวลาเรียนเหลือคาบละ 40 นาทีเพื่อจัดสรรเวลาทำกิจกรรมพิเศษ ทักษะชีวิต หรือประชุมวิชาการช่วงบ่าย',
    periods: [
      { id: 'pf-hr', periodNumber: 0, periodName: 'กิจกรรมหน้าเสาธงพิเศษ', startTime: '07:30', endTime: '08:15', periodType: 'HOMEROOM', days: ['FRI'] },
      { id: 'pf-1', periodNumber: 1, periodName: 'คาบเรียนวิชาการที่ 1', startTime: '08:15', endTime: '08:55', periodType: 'ACADEMIC', days: ['FRI'] },
      { id: 'pf-2', periodNumber: 2, periodName: 'คาบเรียนวิชาการที่ 2', startTime: '08:55', endTime: '09:35', periodType: 'ACADEMIC', days: ['FRI'] },
      { id: 'pf-3', periodNumber: 3, periodName: 'คาบเรียนวิชาการที่ 3', startTime: '09:35', endTime: '10:15', periodType: 'ACADEMIC', days: ['FRI'] },
      { id: 'pf-b1', periodNumber: 4, periodName: 'พักสวดมนต์ / พักเบรก', startTime: '10:15', endTime: '10:35', periodType: 'BREAK', days: ['FRI'] },
      { id: 'pf-4', periodNumber: 4, periodName: 'คาบเรียนวิชาการที่ 4', startTime: '10:35', endTime: '11:15', periodType: 'ACADEMIC', days: ['FRI'] },
      { id: 'pf-5', periodNumber: 5, periodName: 'คาบเรียนวิชาการที่ 5', startTime: '11:15', endTime: '11:55', periodType: 'ACADEMIC', days: ['FRI'] },
      { id: 'pf-lunch', periodNumber: 6, periodName: 'พักรับประทานอาหารกลางวัน (วันศุกร์)', startTime: '11:55', endTime: '12:55', periodType: 'LUNCH', days: ['FRI'] },
      { id: 'pf-6', periodNumber: 6, periodName: 'คาบเรียนวิชาการที่ 6', startTime: '12:55', endTime: '13:35', periodType: 'ACADEMIC', days: ['FRI'] },
      { id: 'pf-7', periodNumber: 7, periodName: 'คาบเรียนวิชาการที่ 7', startTime: '13:35', endTime: '14:15', periodType: 'ACADEMIC', days: ['FRI'] },
      { id: 'pf-act', periodNumber: 8, periodName: 'กิจกรรมลูกเสือ/เนตรนารี บำเพ็ญประโยชน์', startTime: '14:15', endTime: '15:30', periodType: 'DEVELOPMENT', days: ['FRI'] },
      { id: 'pf-home', periodNumber: 9, periodName: 'เตรียมความเรียบร้อยก่อนปิดสัปดาห์', startTime: '15:30', endTime: '16:00', periodType: 'BREAK', days: ['FRI'] }
    ]
  },
  {
    id: 'exam',
    name: 'ตารางเวลาช่วงสอบ (Midterm / Final)',
    description: 'ตารางสอบมาตรฐานคาบสอบละ 60-90 นาที แบ่งช่วงเช้า-ช่วงบ่าย มีเวลาพักทบทวนความรู้',
    periods: [
      { id: 'pe-hr', periodNumber: 0, periodName: 'เตรียมความพร้อมก่อนเข้าห้องสอบ', startTime: '07:30', endTime: '08:15', periodType: 'HOMEROOM', days: ['MON', 'TUE', 'WED', 'THU', 'FRI'] },
      { id: 'pe-1', periodNumber: 1, periodName: 'สอบวิชาการช่วงที่ 1', startTime: '08:30', endTime: '10:00', periodType: 'ACADEMIC', days: ['MON', 'TUE', 'WED', 'THU', 'FRI'] },
      { id: 'pe-b1', periodNumber: 2, periodName: 'พักทบทวนความรู้ช่วงเช้า', startTime: '10:00', endTime: '10:30', periodType: 'BREAK', days: ['MON', 'TUE', 'WED', 'THU', 'FRI'] },
      { id: 'pe-2', periodNumber: 2, periodName: 'สอบวิชาการช่วงที่ 2', startTime: '10:30', endTime: '12:00', periodType: 'ACADEMIC', days: ['MON', 'TUE', 'WED', 'THU', 'FRI'] },
      { id: 'pe-lunch', periodNumber: 3, periodName: 'พักรับประทานอาหารกลางวันสอบ', startTime: '12:00', endTime: '13:00', periodType: 'LUNCH', days: ['MON', 'TUE', 'WED', 'THU', 'FRI'] },
      { id: 'pe-3', periodNumber: 3, periodName: 'สอบวิชาการช่วงที่ 3 (วิชาเลือก)', startTime: '13:00', endTime: '14:30', periodType: 'ACADEMIC', days: ['MON', 'TUE', 'WED', 'THU', 'FRI'] },
      { id: 'pe-b2', periodNumber: 4, periodName: 'พักเบรกก่อนทำความสะอาดห้องสอบ', startTime: '14:30', endTime: '15:00', periodType: 'BREAK', days: ['MON', 'TUE', 'WED', 'THU', 'FRI'] },
      { id: 'pe-clean', periodNumber: 5, periodName: 'ส่งกระดาษคำตอบและทำความสะอาด', startTime: '15:00', endTime: '15:30', periodType: 'HOMEROOM', days: ['MON', 'TUE', 'WED', 'THU', 'FRI'] }
    ]
  }
];

// Helper to convert time "HH:mm" to minutes from 00:00
const timeToMinutes = (timeStr: string): number => {
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

// Helper to format minutes back to "HH:mm"
const minutesToTime = (totalMinutes: number): string => {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

export function PeriodManagementPage() {
  const { periods: dbPeriods, updatePeriodsConfig } = usePeriodsConfig();
  const [patterns, setPatterns] = useState<SchedulePattern[]>(DEFAULT_PATTERNS);
  const [selectedPatternId, setSelectedPatternId] = useState<string>('default');
  const [activePeriods, setActivePeriods] = useState<Period[]>(() => {
    return DEFAULT_PATTERNS[0].periods;
  });

  // Sync Firestore periods with patterns and activePeriods in real-time
  useEffect(() => {
    if (dbPeriods && dbPeriods.length > 0) {
      setPatterns(prev => prev.map(p => {
        if (p.id === 'default') {
          return { ...p, periods: dbPeriods };
        }
        return p;
      }));
      if (selectedPatternId === 'default') {
        setActivePeriods(dbPeriods);
      }
    }
  }, [dbPeriods, selectedPatternId]);
  
  // Modals / Editing states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<Period | null>(null);
  const [isNewPatternModalOpen, setIsNewPatternModalOpen] = useState(false);
  const [newPatternName, setNewPatternName] = useState('');
  const [newPatternDesc, setNewPatternDesc] = useState('');
  
  // Form fields
  const [formPeriodNumber, setFormPeriodNumber] = useState<number>(1);
  const [formPeriodName, setFormPeriodName] = useState<string>('');
  const [formStartTime, setFormStartTime] = useState<string>('08:30');
  const [formEndTime, setFormEndTime] = useState<string>('09:20');
  const [formPeriodType, setFormPeriodType] = useState<PeriodType>('ACADEMIC');
  const [formDays, setFormDays] = useState<string[]>(['MON', 'TUE', 'WED', 'THU', 'FRI']);

  // Success Feedback Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'info' | 'error'>('success');

  const showToast = (msg: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Day list constant
  const DAYS_OF_WEEK = [
    { value: 'MON', label: 'จันทร์', color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20 hover:bg-yellow-500/20' },
    { value: 'TUE', label: 'อังคาร', color: 'bg-pink-500/10 text-pink-400 border-pink-500/20 hover:bg-pink-500/20' },
    { value: 'WED', label: 'พุธ', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20' },
    { value: 'THU', label: 'พฤหัสบดี', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20 hover:bg-orange-500/20' },
    { value: 'FRI', label: 'ศุกร์', color: 'bg-sky-500/10 text-sky-400 border-sky-500/20 hover:bg-sky-500/20' },
  ];

  // Selected schedule details
  const currentPattern = useMemo(() => {
    return patterns.find(p => p.id === selectedPatternId) || patterns[0];
  }, [patterns, selectedPatternId]);

  // Swapping tarrif patterns
  const handleSelectPatternChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedPatternId(id);
    const pat = patterns.find(p => p.id === id);
    if (pat) {
      setActivePeriods([...pat.periods]);
      showToast(`โหลดรูปแบบตารางเวลา "${pat.name}" สำเร็จ`, 'info');
    }
  };

  // Type helper maps
  const typeMap: Record<PeriodType, { label: string, colorClass: string, bgClass: string, textClass: string, borderClass: string }> = {
    HOMEROOM: { 
      label: 'กิจกรรมโฮมรูม / หน้าเสาธง', 
      colorClass: '#10b981', 
      bgClass: 'bg-emerald-500/15', 
      textClass: 'text-emerald-400', 
      borderClass: 'border-emerald-500/30' 
    },
    ACADEMIC: { 
      label: 'คาบเรียนวิชาการ', 
      colorClass: '#3b82f6', 
      bgClass: 'bg-blue-500/15', 
      textClass: 'text-blue-400', 
      borderClass: 'border-blue-500/30' 
    },
    LUNCH: { 
      label: 'พักรับประทานอาหารกลางวัน', 
      colorClass: '#f97316', 
      bgClass: 'bg-orange-500/15', 
      textClass: 'text-orange-400', 
      borderClass: 'border-orange-500/30' 
    },
    DEVELOPMENT: { 
      label: 'กิจกรรมพัฒนาผู้เรียน', 
      colorClass: '#a855f7', 
      bgClass: 'bg-purple-500/15', 
      textClass: 'text-purple-400', 
      borderClass: 'border-purple-500/30' 
    },
    BREAK: { 
      label: 'พักย่อย / พักสวดมนต์', 
      colorClass: '#eab308', 
      bgClass: 'bg-yellow-500/15', 
      textClass: 'text-yellow-400', 
      borderClass: 'border-yellow-500/30' 
    }
  };

  // Timeline boundaries (07:30 to 16:30)
  const TIMELINE_START = 7.5 * 60; // 450 minutes
  const TIMELINE_END = 16.5 * 60; // 990 minutes
  const TIMELINE_RANGE = TIMELINE_END - TIMELINE_START; // 540 minutes

  // Compute calculated minutes for periods & highlight overlapping ones
  const annotatedPeriods = useMemo(() => {
    // Sort active periods by start time first for proper chronological checks
    const sorted = [...activePeriods].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
    
    return sorted.map((p, idx) => {
      const startMin = timeToMinutes(p.startTime);
      const endMin = timeToMinutes(p.endTime);
      const duration = endMin - startMin;

      // Check overlap: does this period intersect with ANY OTHER period on any shared day?
      let hasOverlap = false;
      let overlappingPeriodNames: string[] = [];

      sorted.forEach((other) => {
        if (other.id === p.id) return;
        const otherStart = timeToMinutes(other.startTime);
        const otherEnd = timeToMinutes(other.endTime);

        // Check if there is a day intersection
        const hasCommonDay = p.days.some(day => other.days.includes(day));

        if (hasCommonDay) {
          // Check overlap condition
          const isOverlapping = (startMin < otherEnd && endMin > otherStart);
          if (isOverlapping) {
            hasOverlap = true;
            overlappingPeriodNames.push(other.periodName || `คาบที่ ${other.periodNumber}`);
          }
        }
      });

      return {
        ...p,
        duration,
        hasOverlap,
        overlappingPeriodNames
      };
    });
  }, [activePeriods]);

  // Overall validation issues count
  const conflictCount = useMemo(() => {
    return annotatedPeriods.filter(p => p.hasOverlap || p.duration <= 0).length;
  }, [annotatedPeriods]);

  // Calculate coordinates for timeline blocks
  const timelineBlocks = useMemo(() => {
    return annotatedPeriods.map(p => {
      const startMin = timeToMinutes(p.startTime);
      const endMin = timeToMinutes(p.endTime);
      
      // Bound within 07:30 - 16:30 for visualization
      const boundedStart = Math.max(TIMELINE_START, Math.min(TIMELINE_END, startMin));
      const boundedEnd = Math.max(TIMELINE_START, Math.min(TIMELINE_END, endMin));
      
      const leftPct = ((boundedStart - TIMELINE_START) / TIMELINE_RANGE) * 100;
      const widthPct = ((boundedEnd - boundedStart) / TIMELINE_RANGE) * 100;

      return {
        ...p,
        leftPct,
        widthPct,
        isOutOfRange: startMin < TIMELINE_START || endMin > TIMELINE_END
      };
    });
  }, [annotatedPeriods]);

  // Open modal for new Period
  const handleAddPeriodClick = () => {
    // Generate next period number
    const maxPeriodNum = activePeriods.reduce((max, p) => p.periodNumber > max ? p.periodNumber : max, 0);
    
    // Set default standard times based on last period's end time
    let nextStart = '08:30';
    let nextEnd = '09:20';
    if (activePeriods.length > 0) {
      const sortedByEnd = [...activePeriods].sort((a, b) => timeToMinutes(b.endTime) - timeToMinutes(a.endTime));
      nextStart = sortedByEnd[0].endTime;
      // End is start + 50 minutes
      const nextStartMin = timeToMinutes(nextStart);
      nextEnd = minutesToTime(nextStartMin + 50);
    }

    setEditingPeriod(null);
    setFormPeriodNumber(maxPeriodNum + 1);
    setFormPeriodName(`คาบเรียนวิชาการที่ ${maxPeriodNum + 1}`);
    setFormStartTime(nextStart);
    setFormEndTime(nextEnd);
    setFormPeriodType('ACADEMIC');
    setFormDays(['MON', 'TUE', 'WED', 'THU', 'FRI']);
    setIsModalOpen(true);
  };

  // Open modal for editing Period
  const handleEditPeriodClick = (p: Period) => {
    setEditingPeriod(p);
    setFormPeriodNumber(p.periodNumber);
    setFormPeriodName(p.periodName);
    setFormStartTime(p.startTime);
    setFormEndTime(p.endTime);
    setFormPeriodType(p.periodType);
    setFormDays([...p.days]);
    setIsModalOpen(true);
  };

  // Toggle Day Selection inside form
  const toggleDaySelection = (dayValue: string) => {
    if (formDays.includes(dayValue)) {
      setFormDays(formDays.filter(d => d !== dayValue));
    } else {
      setFormDays([...formDays, dayValue]);
    }
  };

  // Save period to active state list
  const handleSavePeriod = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formPeriodName.trim()) {
      showToast('กรุณากรอกชื่อคาบเรียน', 'error');
      return;
    }

    if (formDays.length === 0) {
      showToast('กรุณาเลือกวันอย่างน้อย 1 วัน', 'error');
      return;
    }

    const startMin = timeToMinutes(formStartTime);
    const endMin = timeToMinutes(formEndTime);

    if (endMin <= startMin) {
      showToast('เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มต้น', 'error');
      return;
    }

    const periodData: Period = {
      id: editingPeriod ? editingPeriod.id : `p-custom-${Date.now()}`,
      periodNumber: formPeriodNumber,
      periodName: formPeriodName,
      startTime: formStartTime,
      endTime: formEndTime,
      periodType: formPeriodType,
      days: formDays
    };

    if (editingPeriod) {
      // Update existing
      setActivePeriods(activePeriods.map(p => p.id === editingPeriod.id ? periodData : p));
      showToast('แก้ไขข้อมูลคาบเรียนเรียบร้อย', 'success');
    } else {
      // Add new
      setActivePeriods([...activePeriods, periodData]);
      showToast('เพิ่มคาบเรียนใหม่เรียบร้อย', 'success');
    }

    setIsModalOpen(false);
  };

  // Delete specific period from active periods
  const handleDeletePeriod = (id: string) => {
    const targetPeriod = activePeriods.find(p => p.id === id);
    if (!targetPeriod) return;

    if (window.confirm(`ยืนยันการลบคาร์เรียน "${targetPeriod.periodName}" ใช่หรือไม่?`)) {
      setActivePeriods(activePeriods.filter(p => p.id !== id));
      showToast('ลบคาบเรียนเรียบร้อยแล้ว', 'info');
    }
  };

  // Re-ordering handler (Up / Down)
  const movePeriod = (index: number, direction: 'UP' | 'DOWN') => {
    const sorted = [...activePeriods].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= sorted.length) return;

    // Swap times instead of indexes so it actually shifts chronologically on the timeline
    const currentItem = sorted[index];
    const otherItem = sorted[targetIndex];

    const currentStart = currentItem.startTime;
    const currentEnd = currentItem.endTime;

    currentItem.startTime = otherItem.startTime;
    currentItem.endTime = otherItem.endTime;

    otherItem.startTime = currentStart;
    otherItem.endTime = currentEnd;

    setActivePeriods([...sorted]);
    showToast('ปรับปรุงลำดับและเวลาคาบเรียนสำเร็จ', 'success');
  };

  // Save the overall configuration to local database/state patterns
  const handleSaveAllSettings = async () => {
    if (conflictCount > 0) {
      if (!window.confirm('ยังมีข้อผิดพลาด/เวลาซ้ำซ้อนกันในตารางตระกูลกระดิ่งนี้ คุณยังคงต้องการบันทึกใช่หรือไม่?')) {
        return;
      }
    }

    // Update our pattern listing
    const updatedPatterns = patterns.map(p => {
      if (p.id === selectedPatternId) {
        return {
          ...p,
          periods: [...activePeriods]
        };
      }
      return p;
    });

    setPatterns(updatedPatterns);
    
    try {
      // Ensure the saved periods are sorted by periodNumber ascending
      const sortedPeriodsToSave = [...activePeriods].sort((a, b) => a.periodNumber - b.periodNumber);
      await updatePeriodsConfig(sortedPeriodsToSave);
      showToast('บันทึกการปรับปรุงตารางเวลาและตารางกระดิ่งโรงเรียนสำเร็จเรียบร้อย!', 'success');
    } catch (err) {
      console.error("Firestore save error:", err);
      showToast('เกิดข้อผิดพลาดในการบันทึกข้อมูลตารางเวลาไปยัง Firestore', 'error');
    }
  };

  // Create new blank schedule pattern
  const handleCreatePatternSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatternName.trim()) {
      showToast('กรุณาระบุชื่อรูปแบบตารางเรียนใหม่', 'error');
      return;
    }

    const newId = `pattern-${Date.now()}`;
    const newPat: SchedulePattern = {
      id: newId,
      name: newPatternName,
      description: newPatternDesc || 'ตารางเวลาที่กำหนดขึ้นใหม่โดยผู้ดูแลระบบ',
      // Start with default patterns copied or clean empty
      periods: [
        { id: `p-custom-hr-${Date.now()}`, periodNumber: 0, periodName: 'กิจกรรมหน้าเสาธง', startTime: '07:30', endTime: '08:30', periodType: 'HOMEROOM', days: ['MON', 'TUE', 'WED', 'THU', 'FRI'] }
      ]
    };

    setPatterns([...patterns, newPat]);
    setSelectedPatternId(newId);
    setActivePeriods(newPat.periods);
    setIsNewPatternModalOpen(false);
    setNewPatternName('');
    setNewPatternDesc('');
    showToast(`สร้างตารางเวลาใหม่ "${newPatternName}" เรียบร้อย`, 'success');
  };

  return (
    <div className="space-y-6 text-slate-100">
      
      {/* Toast Alert */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl border shadow-xl bg-[#0f111a] border-white/10"
          >
            {toastType === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
            {toastType === 'error' && <AlertTriangle className="w-5 h-5 text-rose-500" />}
            {toastType === 'info' && <Info className="w-5 h-5 text-indigo-400" />}
            <span className="text-sm font-medium text-slate-200">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Info Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#1c1f2b] border border-white/10 rounded-2xl p-6 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-2.5 py-1 rounded-full font-bold">
              ระบบส่วนหน้าแอดมิน
            </span>
            <span className="text-xs bg-pink-500/20 text-pink-400 border border-pink-500/30 px-2.5 py-1 rounded-full font-bold">
              ตารางกระดิ่งโรงเรียน
            </span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Bell className="w-6 h-6 text-pink-400 animate-swing" />
            จัดการเวลาคาบเรียน (Period & Bell Schedule)
          </h2>
          <p className="text-slate-400 text-sm">
            จัดการคาบเรียน กำหนดเวลาเริ่ม-สิ้นสุด ปรับเวลาสำหรับการสอบ และควบคุมกระดิ่งส่งสัญญาณอัตโนมัติของโรงเรียน
          </p>
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          <button 
            onClick={() => setIsNewPatternModalOpen(true)}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border border-white/10 hover:border-white/20"
          >
            <Plus className="w-4 h-4" />
            สร้างตารางเวลาใหม่
          </button>
          <button 
            onClick={handleSaveAllSettings}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md hover:scale-[1.02] active:scale-[0.98]"
          >
            <Save className="w-4 h-4" />
            บันทึกการตั้งค่า
          </button>
        </div>
      </div>

      {/* Grid: Selector & Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Selector Dropdown Card */}
        <div className="lg:col-span-2 bg-[#1c1f2b] border border-white/10 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400 shrink-0">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">เลือกรูปแบบตารางเวลาที่จะใช้งาน</h3>
              <p className="text-slate-400 text-xs">ระบบจะอิงคาบการเรียนการสอนและตารางกระดิ่งสัญญาณตามรูปแบบที่เลือก</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <select 
              value={selectedPatternId}
              onChange={handleSelectPatternChange}
              className="flex-1 bg-[#0f111a] border border-white/15 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50"
            >
              {patterns.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            
            <div className="bg-[#0f111a] px-4 py-3 rounded-xl border border-white/5 flex items-center justify-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-300 font-medium">มีผลบังคับใช้ในสัปดาห์นี้</span>
            </div>
          </div>

          <div className="p-3.5 bg-indigo-500/5 rounded-xl border border-indigo-500/20">
            <p className="text-xs text-indigo-300 leading-relaxed">
              <span className="font-bold">รายละเอียด:</span> {currentPattern.description}
            </p>
          </div>
        </div>

        {/* Warning & Info Column */}
        <div className="bg-[#1c1f2b] border border-white/10 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              สถานะตารางเวลา & ความขัดแย้ง
            </h4>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center p-2.5 bg-black/40 rounded-xl border border-white/5 text-xs">
                <span className="text-slate-400">จำนวนคาบทั้งหมด</span>
                <span className="font-bold text-slate-200">{activePeriods.length} คาบ</span>
              </div>

              {conflictCount > 0 ? (
                <div className="p-3 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-xl flex items-start gap-2 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 animate-pulse" />
                  <div>
                    <span className="font-bold block">พบข้อผิดพลาดด้านเวลา ({conflictCount})</span>
                    <span className="block text-[11px] text-rose-300">กรุณาปรับปรุงเวลาที่เหลื่อมซ้ำซ้อนกันเพื่อป้องกันกระดิ่งชนกัน</span>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl flex items-start gap-2 text-xs">
                  <Check className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">เวลาถูกต้องทั้งหมด</span>
                    <span className="block text-[11px] text-emerald-300">คาบเรียนทั้งหมดเรียงลำดับต่อเนื่อง ไม่พบคลาสเรียนทับซ้อนกัน</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="text-[11px] text-slate-400 mt-4 border-t border-white/5 pt-3">
            * สัญญาณกระดิ่งเสียงอิเล็กทรอนิกส์จะดังขึ้นเมื่อถึงเวลาเริ่มและเวลาสิ้นสุดคาบเรียนตามตารางที่บันทึกนี้
          </div>
        </div>

      </div>

      {/* Visual Timeline (Gantt-like bar) */}
      <div className="bg-[#1c1f2b] border border-white/10 rounded-2xl p-6 shadow-lg space-y-4">
        <div>
          <h3 className="font-bold text-white text-base">แถบแสดงภาพรวมช่วงเวลากลางวัน (Day Timeline Visualization)</h3>
          <p className="text-slate-400 text-xs mt-0.5">แผนผังจำลองการเรียงคาบเรียนระหว่างเวลา 07:30 น. - 16:30 น. ของวันทำการ</p>
        </div>

        {/* Timeline Axis */}
        <div className="relative pt-6 pb-2 select-none">
          {/* Hour markers */}
          <div className="absolute top-0 left-0 w-full flex justify-between text-[10px] text-slate-500 font-mono px-1">
            <span>07:30</span>
            <span>09:00</span>
            <span>10:30</span>
            <span>12:00</span>
            <span>13:30</span>
            <span>15:00</span>
            <span>16:30</span>
          </div>

          {/* Combined Progress bar showing periods */}
          <div className="h-10 w-full bg-[#0f111a] border border-white/10 rounded-xl relative overflow-hidden flex items-center">
            {timelineBlocks.length === 0 ? (
              <div className="text-center w-full text-slate-500 text-xs">ไม่มีวิชา/คาบเรียนในตาราง</div>
            ) : (
              timelineBlocks.map((block) => (
                <div
                  key={block.id}
                  style={{
                    left: `${block.leftPct}%`,
                    width: `${block.widthPct}%`
                  }}
                  className={cn(
                    "absolute top-0 h-full border-r border-black/30 flex flex-col justify-center px-1.5 min-w-[20px] transition-all group cursor-help",
                    block.hasOverlap ? "bg-rose-500/85 z-20 animate-pulse" : ""
                  )}
                >
                  <div 
                    className="absolute inset-0 opacity-80" 
                    style={{ backgroundColor: block.hasOverlap ? undefined : typeMap[block.periodType].colorClass }}
                  />
                  
                  {/* Label inside period block */}
                  <span className="text-[10px] font-bold text-white relative z-10 truncate block leading-none">
                    {block.periodNumber > 0 ? `${block.periodNumber}` : 'HR'}
                  </span>
                  <span className="text-[9px] text-white/80 font-mono relative z-10 truncate block leading-tight">
                    {block.startTime}
                  </span>

                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 bg-[#0f111a] border border-white/15 p-2 rounded-xl text-xs text-slate-200 hidden group-hover:block z-40 shadow-2xl leading-relaxed">
                    <div className="font-bold text-white mb-0.5">{block.periodName}</div>
                    <div>เวลา: {block.startTime} - {block.endTime} น.</div>
                    <div>ระยะเวลา: {block.duration} นาที</div>
                    <div>ประเภท: {typeMap[block.periodType].label}</div>
                    {block.hasOverlap && (
                      <div className="text-rose-400 font-bold mt-1">⚠️ ทับซ้อนกับ: {block.overlappingPeriodNames.join(', ')}</div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Categories Color Legends */}
        <div className="flex flex-wrap gap-4 text-xs font-semibold justify-center pt-2 border-t border-white/5">
          {Object.entries(typeMap).map(([key, value]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded" style={{ backgroundColor: value.colorClass }} />
              <span className="text-slate-300">{value.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-rose-500 animate-pulse" />
            <span className="text-rose-400 font-bold">เวลาชนทับซ้อนกัน (Overlap)</span>
          </div>
        </div>
      </div>

      {/* Table & Period List Area */}
      <div className="bg-[#1c1f2b] border border-white/10 rounded-2xl p-6 shadow-lg space-y-4">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-white text-base">รายการคาบเรียนรายบุคคล</h3>
            <p className="text-slate-400 text-xs">คุณสามารถจัดลำดับ แก้ไข ลบ คาบเรียน หรือดูระยะเวลาเรียนแต่ละคาบได้จากตารางด้านล่าง</p>
          </div>

          <button 
            onClick={handleAddPeriodClick}
            className="flex items-center gap-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 self-start sm:self-auto hover:scale-105"
          >
            <Plus className="w-4 h-4" />
            เพิ่มคาบเวลาเรียน
          </button>
        </div>

        {/* List of Periods */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-xs text-slate-400 font-bold uppercase tracking-wider">
                <th className="py-3 px-4">จัดเรียง</th>
                <th className="py-3 px-4 text-center">ลำดับคาบ</th>
                <th className="py-3 px-4">ชื่อเรียกคาบเรียน</th>
                <th className="py-3 px-4 text-center">เวลาเริ่มต้น - สิ้นสุด</th>
                <th className="py-3 px-4 text-center">ระยะเวลา (นาที)</th>
                <th className="py-3 px-4">ประเภทคาบ</th>
                <th className="py-3 px-4">วันที่ใช้บังคับ</th>
                <th className="py-3 px-4 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {annotatedPeriods.map((p, index) => (
                <motion.tr 
                  key={p.id} 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={cn(
                    "text-sm transition-colors hover:bg-white/[0.01]",
                    p.hasOverlap ? "bg-rose-500/5 hover:bg-rose-500/10" : ""
                  )}
                >
                  {/* Sorting controls */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => movePeriod(index, 'UP')}
                        disabled={index === 0}
                        className="p-1 rounded hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent text-slate-400 hover:text-slate-200 transition-colors"
                        title="เลื่อนขึ้น"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => movePeriod(index, 'DOWN')}
                        disabled={index === annotatedPeriods.length - 1}
                        className="p-1 rounded hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent text-slate-400 hover:text-slate-200 transition-colors"
                        title="เลื่อนลง"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>

                  {/* Period Number */}
                  <td className="py-3 px-4 text-center font-bold font-mono">
                    {p.periodNumber === 0 ? (
                      <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-md">โฮมรูม</span>
                    ) : (
                      `คาบที่ ${p.periodNumber}`
                    )}
                  </td>

                  {/* Period Name */}
                  <td className="py-3 px-4 font-semibold text-slate-100">
                    <div>
                      {p.periodName}
                      {p.hasOverlap && (
                        <div className="text-[10px] text-rose-400 font-bold flex items-center gap-1 mt-0.5 animate-pulse">
                          <AlertTriangle className="w-3 h-3" /> เวลาชนทับซ้อนกับ: {p.overlappingPeriodNames.join(', ')}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Range Time */}
                  <td className="py-3 px-4 text-center font-mono text-xs font-bold text-slate-300">
                    <span className="bg-black/30 px-2.5 py-1 rounded-lg border border-white/5">
                      {p.startTime} น. - {p.endTime} น.
                    </span>
                  </td>

                  {/* Duration minutes */}
                  <td className="py-3 px-4 text-center font-mono font-bold">
                    <span className={cn(
                      "text-xs px-2 py-1 rounded",
                      p.duration <= 0 ? "bg-red-500/20 text-red-400" : "text-slate-300"
                    )}>
                      {p.duration} นาที
                    </span>
                  </td>

                  {/* Period Category Type badge */}
                  <td className="py-3 px-4">
                    <span className={cn(
                      "text-xs font-bold px-2.5 py-1 rounded-full border shrink-0",
                      typeMap[p.periodType].bgClass,
                      typeMap[p.periodType].textClass,
                      typeMap[p.periodType].borderClass
                    )}>
                      {typeMap[p.periodType].label.split(' ')[0]}
                    </span>
                  </td>

                  {/* Effective Days */}
                  <td className="py-3 px-4">
                    <div className="flex gap-0.5">
                      {['MON', 'TUE', 'WED', 'THU', 'FRI'].map((d) => {
                        const isApplicable = p.days.includes(d);
                        const thShort = d === 'MON' ? 'จ' : d === 'TUE' ? 'อ' : d === 'WED' ? 'พ' : d === 'THU' ? 'พฤ' : 'ศ';
                        return (
                          <span 
                            key={d} 
                            className={cn(
                              "text-[9px] font-bold w-5 h-5 rounded-full flex items-center justify-center border",
                              isApplicable 
                                ? "bg-indigo-500/20 text-indigo-400 border-indigo-500/30" 
                                : "bg-black/20 text-slate-600 border-transparent"
                            )}
                          >
                            {thShort}
                          </span>
                        );
                      })}
                    </div>
                  </td>

                  {/* Manage operations */}
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => handleEditPeriodClick(p)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600/20 border border-white/5 text-slate-300 hover:text-indigo-400 transition-colors"
                        title="แก้ไขข้อมูลคาบ"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeletePeriod(p.id)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 border border-white/5 text-slate-400 hover:text-rose-400 transition-colors"
                        title="ลบคาบเรียน"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>

      {/* New Schedule Pattern Creation Modal */}
      <AnimatePresence>
        {isNewPatternModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-[#1c1f2b] border border-white/10 rounded-2xl p-6 shadow-2xl w-full max-w-md text-slate-100"
            >
              <h3 className="text-lg font-bold text-white mb-1">สร้างรูปแบบตารางเรียนและเบลล์สัญญาณใหม่</h3>
              <p className="text-slate-400 text-xs mb-4">ระบบจะโคลนคาบเริ่มต้นมาให้เพื่อให้คุณสะดวกในการนำไปปรับใช้</p>

              <form onSubmit={handleCreatePatternSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">ชื่อรูปแบบตารางเรียนใหม่</label>
                  <input
                    type="text"
                    value={newPatternName}
                    onChange={(e) => setNewPatternName(e.target.value)}
                    placeholder="เช่น ตารางกิจกรรมสัปดาห์กีฬาสี"
                    className="w-full bg-[#0f111a] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">คำอธิบายรายละเอียด</label>
                  <textarea
                    rows={3}
                    value={newPatternDesc}
                    onChange={(e) => setNewPatternDesc(e.target.value)}
                    placeholder="ระบุจุดประสงค์หรือความจำเป็นของตารางเวลาพิเศษนี้..."
                    className="w-full bg-[#0f111a] border border-white/10 rounded-xl px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 resize-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsNewPatternModalOpen(false)}
                    className="bg-slate-800 hover:bg-slate-700 border border-white/5 text-slate-300 px-4 py-2 rounded-xl text-xs font-bold transition-all"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all"
                  >
                    ยืนยันสร้างรูปแบบ
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add / Edit Period Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-[#1c1f2b] border border-white/10 rounded-2xl p-6 shadow-2xl w-full max-w-lg text-slate-100"
            >
              <h3 className="text-lg font-bold text-white mb-1">
                {editingPeriod ? 'แก้ไขข้อมูลคาบเรียนและสัญญาณกระดิ่ง' : 'เพิ่มคาบเรียนและกำหนดเสียงสัญญาณใหม่'}
              </h3>
              <p className="text-slate-400 text-xs mb-5">ตั้งค่าคาบเวลาเรียน กำหนดรหัสและเลือกประเภทเพื่อให้สัมพันธ์กับตารางการสอนวิชาต่าง ๆ</p>

              <form onSubmit={handleSaveAllSettings} className="space-y-4">
                
                {/* Period ID and Name row */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">ลำดับคาบเรียน (Period No)</label>
                    <input
                      type="number"
                      min={0}
                      max={12}
                      value={formPeriodNumber}
                      onChange={(e) => setFormPeriodNumber(Number(e.target.value))}
                      className="w-full bg-[#0f111a] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 font-mono text-center"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">ชื่อเรียกคาบเรียน</label>
                    <input
                      type="text"
                      required
                      value={formPeriodName}
                      onChange={(e) => setFormPeriodName(e.target.value)}
                      placeholder="เช่น คาบวิชาภาษาไทย, พักช่วงสั้น"
                      className="w-full bg-[#0f111a] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Time Picker Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-indigo-400" />
                      เวลาเริ่มต้นคาบ (Start Time)
                    </label>
                    <input
                      type="time"
                      required
                      value={formStartTime}
                      onChange={(e) => setFormStartTime(e.target.value)}
                      className="w-full bg-[#0f111a] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 font-mono text-center"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-pink-400" />
                      เวลาสิ้นสุดคาบ (End Time)
                    </label>
                    <input
                      type="time"
                      required
                      value={formEndTime}
                      onChange={(e) => setFormEndTime(e.target.value)}
                      className="w-full bg-[#0f111a] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 font-mono text-center"
                    />
                  </div>
                </div>

                {/* Period Category Type Select */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">ประเภทการบริหารคาบเรียน</label>
                  <select
                    value={formPeriodType}
                    onChange={(e) => setFormPeriodType(e.target.value as PeriodType)}
                    className="w-full bg-[#0f111a] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="HOMEROOM">กิจกรรมโฮมรูม / กิจกรรมหน้าเสาธง</option>
                    <option value="ACADEMIC">คาบเรียนวิชาการทั่วไป</option>
                    <option value="LUNCH">พักรับประทานอาหารกลางวัน</option>
                    <option value="DEVELOPMENT">กิจกรรมพัฒนาผู้เรียน / แนะแนว / ชมรม</option>
                    <option value="BREAK">พักย่อยระหว่างวัน / พักสวดมนต์</option>
                  </select>
                </div>

                {/* Week Day Checkbox Grid */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-2">วันทำการที่มีผลบังคับใช้</label>
                  <div className="flex gap-2">
                    {DAYS_OF_WEEK.map((day) => {
                      const isSelected = formDays.includes(day.value);
                      return (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => toggleDaySelection(day.value)}
                          className={cn(
                            "flex-1 text-xs py-2 rounded-xl font-bold border transition-all text-center",
                            isSelected 
                              ? "bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/10 scale-[1.02]" 
                              : "bg-[#0f111a] border-white/10 text-slate-400 hover:text-slate-200"
                          )}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Validation alert inside modal */}
                {(() => {
                  const sMin = timeToMinutes(formStartTime);
                  const eMin = timeToMinutes(formEndTime);
                  const duration = eMin - sMin;
                  
                  if (duration <= 0) {
                    return (
                      <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มต้นอย่างถูกต้อง</span>
                      </div>
                    );
                  }

                  return (
                    <div className="p-3 bg-indigo-500/5 border border-indigo-500/20 text-indigo-300 rounded-xl text-xs flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Info className="w-3.5 h-3.5" /> ระยะเวลาคำนวณอัตโนมัติ:
                      </span>
                      <span className="font-bold font-mono">{duration} นาที</span>
                    </div>
                  );
                })()}

                {/* Footer Controls */}
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="bg-slate-800 hover:bg-slate-700 border border-white/5 text-slate-300 px-4 py-2 rounded-xl text-xs font-bold transition-all"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    onClick={handleSavePeriod}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl text-xs font-bold transition-all"
                  >
                    {editingPeriod ? 'บันทึกการแก้ไข' : 'เพิ่มคาบใหม่'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
