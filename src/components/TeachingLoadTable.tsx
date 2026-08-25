import React, { useState, useMemo, useEffect } from 'react';
import { 
  BookOpen, 
  Users, 
  Clock, 
  Search, 
  Filter, 
  ChevronDown, 
  ChevronRight, 
  FileSpreadsheet, 
  Layers, 
  Download,
  Loader2,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { cn } from '../lib/utils';
import { matchTeacherByName } from '../utils/teacherLoadReportParser';

export interface TeachingSubject {
  order: number;
  subjectCode: string;
  subjectName: string;
  level: string;
  room: string;
  schedule: string;
  periodsPerWeek: number;
  totalPeriods: number;
  subjectType: 'MAIN' | 'ACTIVITY';
}

export interface TeacherTeachingLoad {
  id: string | number;
  staffDocId: string;
  teacherName: string;
  teacherEmail: string;
  department: string;
  homeroom: string;
  subjects: TeachingSubject[];
  totalMainPeriods: number;
  totalActivityPeriods: number;
  totalPeriods: number;
  isUnlinked?: boolean;
}

const DAY_ORDER: Record<string, number> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7
};

const DAY_SHORT_TH: Record<string, string> = {
  monday: 'จ.',
  tuesday: 'อ.',
  wednesday: 'พ.',
  thursday: 'พฤ.',
  friday: 'ศ.',
  saturday: 'ส.',
  sunday: 'อา.'
};

interface TeachingLoadTableProps {
  initialTeacherName?: string;
  onSelectTeacher?: (teacher: TeacherTeachingLoad) => void;
  onOpenImport?: () => void;
  className?: string;
}

export function TeachingLoadTable({ initialTeacherName, onSelectTeacher, onOpenImport, className }: TeachingLoadTableProps) {
  const [searchTerm, setSearchTerm] = useState(initialTeacherName || '');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('ALL');
  const [expandedTeacherIds, setExpandedTeacherIds] = useState<string[]>([]);
  
  const [staffData, setStaffData] = useState<any[]>([]);
  const [schedulesData, setSchedulesData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Subscribe to real Firestore collections
  useEffect(() => {
    setIsLoading(true);

    const unsubStaff = onSnapshot(collection(db, 'staff'), (snap) => {
      const staffList = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setStaffData(staffList);
    }, (err) => {
      console.error('[TeachingLoadTable] Staff listener error:', err);
    });

    const unsubSchedules = onSnapshot(collection(db, 'schedules'), (snap) => {
      const scheduleList = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSchedulesData(scheduleList);
      setIsLoading(false);
    }, (err) => {
      console.error('[TeachingLoadTable] Schedules listener error:', err);
      setIsLoading(false);
    });

    return () => {
      unsubStaff();
      unsubSchedules();
    };
  }, []);

  // Compute live Teacher Teaching Loads by joining staff and schedules
  const teachingLoads: TeacherTeachingLoad[] = useMemo(() => {
    // Index schedules by teacher
    // We map each teacher staff record, plus any unlinked schedules
    const staffLoadsMap = new Map<string, {
      staffDocId: string;
      teacherName: string;
      teacherEmail: string;
      department: string;
      homeroom: string;
      scheduleItems: any[];
    }>();

    // 1. Initialize staff members
    staffData.forEach((st) => {
      const name = st.fullName || `${st.prefix || ''}${st.firstName || ''} ${st.lastName || ''}`.trim() || st.displayName || st.email || st.id;
      const dept = st.department || st.departmentId || 'กลุ่มสาระการเรียนรู้ทั่วไป';
      const homeroom = st.homeroom || st.homeroomClass || st.room || '-';

      staffLoadsMap.set(st.id, {
        staffDocId: st.id,
        teacherName: name,
        teacherEmail: st.email || '',
        department: dept,
        homeroom,
        scheduleItems: []
      });
    });

    // 2. Associate schedules to staff
    const unlinkedScheduleMap = new Map<string, any[]>();

    schedulesData.forEach((sch) => {
      let matchedStaffId: string | null = null;

      // Check direct teacherIds or teacherId
      if (sch.teacherIds && Array.isArray(sch.teacherIds) && sch.teacherIds.length > 0) {
        matchedStaffId = sch.teacherIds[0];
      } else if (sch.teacherId) {
        matchedStaffId = sch.teacherId;
      }

      // Check email match
      if (!matchedStaffId && sch.teacherEmail) {
        const found = staffData.find(s => s.email && s.email.toLowerCase() === sch.teacherEmail.toLowerCase());
        if (found) matchedStaffId = found.id;
      }

      // Check name match against staff
      if (!matchedStaffId && sch.sourceTeacherName) {
        const matchRes = matchTeacherByName(sch.sourceTeacherName, staffData);
        if (matchRes?.id) matchedStaffId = matchRes.id;
      }

      if (matchedStaffId && staffLoadsMap.has(matchedStaffId)) {
        staffLoadsMap.get(matchedStaffId)!.scheduleItems.push(sch);
      } else {
        // Collect into unlinked teacher
        const unlinkedKey = sch.unlinkedTeacherName || sch.sourceTeacherName || 'ครูผู้สอนที่ยังไม่ได้จับคู่';
        if (!unlinkedScheduleMap.has(unlinkedKey)) {
          unlinkedScheduleMap.set(unlinkedKey, []);
        }
        unlinkedScheduleMap.get(unlinkedKey)!.push(sch);
      }
    });

    const result: TeacherTeachingLoad[] = [];

    // Format staff records
    Array.from(staffLoadsMap.values()).forEach((entry, idx) => {
      const subjects = groupSchedulesIntoSubjects(entry.scheduleItems);
      const totalMainPeriods = subjects.filter(s => s.subjectType === 'MAIN').reduce((sum, s) => sum + s.totalPeriods, 0);
      const totalActivityPeriods = subjects.filter(s => s.subjectType === 'ACTIVITY').reduce((sum, s) => sum + s.totalPeriods, 0);
      const totalPeriods = totalMainPeriods + totalActivityPeriods;

      result.push({
        id: entry.staffDocId,
        staffDocId: entry.staffDocId,
        teacherName: entry.teacherName,
        teacherEmail: entry.teacherEmail,
        department: entry.department,
        homeroom: entry.homeroom,
        subjects,
        totalMainPeriods,
        totalActivityPeriods,
        totalPeriods
      });
    });

    // Format unlinked records if any exist
    Array.from(unlinkedScheduleMap.entries()).forEach(([teacherName, items], idx) => {
      const subjects = groupSchedulesIntoSubjects(items);
      const totalMainPeriods = subjects.filter(s => s.subjectType === 'MAIN').reduce((sum, s) => sum + s.totalPeriods, 0);
      const totalActivityPeriods = subjects.filter(s => s.subjectType === 'ACTIVITY').reduce((sum, s) => sum + s.totalPeriods, 0);
      const totalPeriods = totalMainPeriods + totalActivityPeriods;
      const dept = items[0]?.department || 'ยังไม่ได้ระบุกลุ่มสาระ';

      result.push({
        id: `unlinked_${idx}`,
        staffDocId: `unlinked_${idx}`,
        teacherName: `${teacherName} (ยังไม่ผูกบัญชี)`,
        teacherEmail: items[0]?.teacherEmail || '-',
        department: dept,
        homeroom: '-',
        subjects,
        totalMainPeriods,
        totalActivityPeriods,
        totalPeriods,
        isUnlinked: true
      });
    });

    return result;
  }, [staffData, schedulesData]);

  // Helper to group flat schedule slots into aggregated subjects
  function groupSchedulesIntoSubjects(scheduleSlots: any[]): TeachingSubject[] {
    if (!scheduleSlots || scheduleSlots.length === 0) return [];

    const grouped = new Map<string, {
      subjectCode: string;
      subjectName: string;
      level: string;
      room: string;
      subjectType: 'MAIN' | 'ACTIVITY';
      slots: Array<{ dayOfWeek: string; periodNumber: number }>;
    }>();

    scheduleSlots.forEach(slot => {
      const key = `${slot.subjectCode || 'UNK'}_${slot.room || ''}_${slot.level || ''}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          subjectCode: slot.subjectCode || '-',
          subjectName: slot.subjectName || slot.name || '-',
          level: slot.level || '-',
          room: slot.room || '-',
          subjectType: slot.subjectType || (slot.subjectCode === 'HR' || slot.subjectCode === 'CZ' || (slot.subjectName && slot.subjectName.includes('กิจกรรม')) ? 'ACTIVITY' : 'MAIN'),
          slots: []
        });
      }
      if (slot.dayOfWeek && slot.periodNumber) {
        grouped.get(key)!.slots.push({
          dayOfWeek: slot.dayOfWeek,
          periodNumber: Number(slot.periodNumber)
        });
      }
    });

    const subjects: TeachingSubject[] = [];
    let order = 1;

    grouped.forEach((val) => {
      // Sort slots by day then period
      val.slots.sort((a, b) => {
        const dayDiff = (DAY_ORDER[a.dayOfWeek.toLowerCase()] || 99) - (DAY_ORDER[b.dayOfWeek.toLowerCase()] || 99);
        if (dayDiff !== 0) return dayDiff;
        return a.periodNumber - b.periodNumber;
      });

      // Format schedule string: e.g. "จ.1, อ.3-4"
      const scheduleString = formatSlotsSummary(val.slots);
      const periodCount = val.slots.length;

      subjects.push({
        order: order++,
        subjectCode: val.subjectCode,
        subjectName: val.subjectName,
        level: val.level,
        room: val.room,
        schedule: scheduleString || '-',
        periodsPerWeek: periodCount,
        totalPeriods: periodCount,
        subjectType: val.subjectType
      });
    });

    return subjects;
  }

  // Format array of slots into compact human-readable Thai strings
  function formatSlotsSummary(slots: Array<{ dayOfWeek: string; periodNumber: number }>): string {
    if (slots.length === 0) return '-';

    const dayMap = new Map<string, number[]>();
    slots.forEach(s => {
      const d = s.dayOfWeek.toLowerCase();
      if (!dayMap.has(d)) dayMap.set(d, []);
      if (!dayMap.get(d)!.includes(s.periodNumber)) {
        dayMap.get(d)!.push(s.periodNumber);
      }
    });

    const parts: string[] = [];
    dayMap.forEach((periods, day) => {
      periods.sort((a, b) => a - b);
      const dayPrefix = DAY_SHORT_TH[day] || day;
      
      // Group contiguous period numbers
      const periodRanges: string[] = [];
      let start = periods[0];
      let prev = periods[0];

      for (let i = 1; i <= periods.length; i++) {
        if (i < periods.length && periods[i] === prev + 1) {
          prev = periods[i];
        } else {
          if (start === prev) {
            periodRanges.push(`${start}`);
          } else {
            periodRanges.push(`${start}-${prev}`);
          }
          if (i < periods.length) {
            start = periods[i];
            prev = periods[i];
          }
        }
      }
      parts.push(`${dayPrefix}${periodRanges.join(',')}`);
    });

    return parts.join(', ');
  }

  // Distinct departments
  const departments = useMemo(() => {
    const set = new Set<string>();
    teachingLoads.forEach(t => {
      if (t.department) set.add(t.department);
    });
    return Array.from(set);
  }, [teachingLoads]);

  // Filtered teachers
  const filteredData = useMemo(() => {
    return teachingLoads.filter(teacher => {
      const matchDept = selectedDepartment === 'ALL' || teacher.department === selectedDepartment;
      const matchSearch = searchTerm.trim() === '' || 
        teacher.teacherName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        teacher.homeroom.toLowerCase().includes(searchTerm.toLowerCase()) ||
        teacher.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
        teacher.subjects.some(s => 
          s.subjectCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.subjectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.room.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.level.toLowerCase().includes(searchTerm.toLowerCase())
        );
      return matchDept && matchSearch;
    });
  }, [teachingLoads, searchTerm, selectedDepartment]);

  // High-level metrics
  const totalTeachers = teachingLoads.length;
  const totalMainPeriods = teachingLoads.reduce((acc, t) => acc + t.totalMainPeriods, 0);
  const totalActivityPeriods = teachingLoads.reduce((acc, t) => acc + t.totalActivityPeriods, 0);
  const totalOverallPeriods = teachingLoads.reduce((acc, t) => acc + t.totalPeriods, 0);

  const toggleExpand = (id: string | number) => {
    const stringId = String(id);
    setExpandedTeacherIds(prev => 
      prev.includes(stringId) ? prev.filter(item => item !== stringId) : [...prev, stringId]
    );
  };

  const expandAll = () => {
    setExpandedTeacherIds(teachingLoads.map(t => String(t.id)));
  };

  const collapseAll = () => {
    setExpandedTeacherIds([]);
  };

  const handleExportCSV = () => {
    const rows = [
      ['ID', 'Department', 'Teacher Name', 'Email', 'Homeroom', 'Order', 'Subject Code', 'Subject Name', 'Periods/Week', 'Room', 'Schedule', 'Level', 'Total Periods']
    ];

    teachingLoads.forEach(t => {
      if (t.subjects.length === 0) {
        rows.push([
          String(t.id),
          t.department,
          t.teacherName,
          t.teacherEmail,
          t.homeroom,
          '-',
          '-',
          'ไม่มีรายวิชาสอน',
          '0',
          '-',
          '-',
          '-',
          '0'
        ]);
      } else {
        t.subjects.forEach(s => {
          rows.push([
            String(t.id),
            t.department,
            t.teacherName,
            t.teacherEmail,
            t.homeroom,
            s.order.toString(),
            s.subjectCode,
            `"${s.subjectName}"`,
            s.periodsPerWeek.toString(),
            `"${s.room}"`,
            `"${s.schedule}"`,
            s.level,
            s.totalPeriods.toString()
          ]);
        });
      }
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'teaching_load_roster.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className="bg-[#0f1219] border border-white/10 rounded-2xl p-16 flex flex-col items-center justify-center text-center space-y-4">
        <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
        <div>
          <h3 className="text-base font-bold text-white">กำลังโหลดข้อมูลภาระงานสอนจาก Firestore...</h3>
          <p className="text-xs text-slate-400 mt-1">กำลังประมวลผลการจับคู่ข้อมูลครูกับตารางสอนแบบเรียลไทม์</p>
        </div>
      </div>
    );
  }

  // Global Empty State when no teaching load data exists at all
  if (teachingLoads.length === 0 || schedulesData.length === 0) {
    return (
      <div className="bg-[#0f1219] border border-dashed border-white/15 rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shadow-inner">
          <BookOpen className="w-8 h-8" />
        </div>
        <div className="max-w-md">
          <h3 className="text-lg font-bold text-white">ยังไม่มีข้อมูลภาระงานสอนในระบบ</h3>
          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
            ยังไม่พบข้อมูลตารางสอนในฐานข้อมูล Firestore คุณสามารถนำเข้าไฟล์รายงานภาระงานสอน (.xlsx / .csv) เพื่อสร้างตารางภาระงานสอนแบบสมบูรณ์
          </p>
        </div>
        {onOpenImport && (
          <button
            onClick={onOpenImport}
            className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>นำเข้าภาระงานสอน (Bulk Data Import)</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0f1219] border border-white/10 rounded-2xl p-5 shadow-xl relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">จำนวนครูในระบบ</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-white">{totalTeachers} <span className="text-sm font-normal text-slate-400">คน</span></div>
          <p className="text-xs text-slate-500 mt-1">{departments.length} กลุ่มสาระการเรียนรู้</p>
        </div>

        <div className="bg-[#0f1219] border border-white/10 rounded-2xl p-5 shadow-xl relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">คาบสอนวิชาการ (Main)</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <BookOpen className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-emerald-400">{totalMainPeriods} <span className="text-sm font-normal text-slate-400">คาบ/สัปดาห์</span></div>
          <p className="text-xs text-slate-500 mt-1">รายวิชาพื้นฐาน & เพิ่มเติม</p>
        </div>

        <div className="bg-[#0f1219] border border-white/10 rounded-2xl p-5 shadow-xl relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">คาบกิจกรรม (Activity)</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-purple-400">{totalActivityPeriods} <span className="text-sm font-normal text-slate-400">คาบ/สัปดาห์</span></div>
          <p className="text-xs text-slate-500 mt-1">HomeRoom & กิจกรรมพัฒนาผู้เรียน</p>
        </div>

        <div className="bg-[#0f1219] border border-white/10 rounded-2xl p-5 shadow-xl relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">รวมภาระงานสอนทั้งสิ้น</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-amber-400">{totalOverallPeriods} <span className="text-sm font-normal text-slate-400">คาบ</span></div>
          <p className="text-xs text-slate-500 mt-1">เฉลี่ย {totalTeachers > 0 ? (totalOverallPeriods / totalTeachers).toFixed(1) : 0} คาบ/คน/สัปดาห์</p>
        </div>
      </div>

      {/* Controls & Filter Bar */}
      <div className="bg-[#0f1219] border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between shadow-xl">
        <div className="flex flex-1 flex-col sm:flex-row gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาชื่อครู, รหัสวิชา (ค32201), ห้อง (943), ชั้น (ม.5/8)..."
              className="w-full pl-9 pr-4 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
            />
          </div>

          {/* Department Filter */}
          <div className="relative min-w-[180px]">
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 appearance-none cursor-pointer"
            >
              <option value="ALL">ทุกกลุ่มสาระการเรียนรู้</option>
              {departments.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <Filter className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={expandAll}
            className="px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
          >
            ขยายทั้งหมด
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
          >
            ยุบทั้งหมด
          </button>
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 flex items-center gap-1.5 transition-colors shadow-[0_0_15px_rgba(16,185,129,0.15)] cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            ส่งออก CSV
          </button>
        </div>
      </div>

      {/* Main Teaching Load List / Table */}
      <div className="space-y-4">
        {filteredData.length === 0 ? (
          <div className="bg-[#0f1219] border border-white/10 rounded-2xl p-12 text-center text-slate-500">
            <BookOpen className="w-12 h-12 mx-auto mb-3 text-slate-600" />
            <p className="text-base font-semibold text-slate-400">ไม่พบข้อมูลภาระงานสอนที่ตรงกับเงื่อนไขการค้นหา</p>
            <p className="text-xs text-slate-600 mt-1">ลองเปลี่ยนคำค้นหาหรือเลือกกลุ่มสาระอื่น</p>
          </div>
        ) : (
          filteredData.map(teacher => {
            const isExpanded = expandedTeacherIds.includes(String(teacher.id));

            return (
              <div 
                key={teacher.id}
                className="bg-[#0f1219] border border-white/10 rounded-2xl overflow-hidden shadow-xl transition-all hover:border-white/20"
              >
                {/* Teacher Header Bar */}
                <div 
                  onClick={() => toggleExpand(teacher.id)}
                  className={cn(
                    "p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer select-none transition-colors",
                    isExpanded ? "bg-white/[0.03] border-b border-white/10" : "hover:bg-white/[0.02]"
                  )}
                >
                  <div className="flex items-center gap-3.5">
                    <button 
                      className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center transition-transform shrink-0",
                        isExpanded ? "bg-blue-500/20 text-blue-400 rotate-90" : "bg-white/5 text-slate-400 hover:text-white"
                      )}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>

                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shrink-0">
                      {teacher.teacherName.charAt(0)}
                    </div>

                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h3 className="font-bold text-base text-white hover:text-blue-400 transition-colors">
                          {teacher.teacherName}
                        </h3>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          {teacher.department}
                        </span>
                        {teacher.homeroom && teacher.homeroom !== '-' && (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/5 text-slate-300 border border-white/10">
                            ครูที่ปรึกษา: {teacher.homeroom}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">ID: {teacher.staffDocId} {teacher.teacherEmail && teacher.teacherEmail !== '-' ? `• ${teacher.teacherEmail}` : ''}</p>
                    </div>
                  </div>

                  {/* Summary Chips */}
                  <div className="flex items-center gap-2.5 self-end sm:self-center">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/40 border border-white/10 text-xs">
                      <span className="text-slate-400">วิชาการ:</span>
                      <span className="font-bold text-emerald-400">{teacher.totalMainPeriods}</span>
                      <span className="text-slate-600">|</span>
                      <span className="text-slate-400">กิจกรรม:</span>
                      <span className="font-bold text-purple-400">{teacher.totalActivityPeriods}</span>
                    </div>

                    <div className={cn(
                      "px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm",
                      teacher.totalPeriods >= 18 ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" :
                      teacher.totalPeriods > 0 ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" :
                      "bg-slate-800/60 text-slate-400 border border-slate-700"
                    )}>
                      <span>รวม {teacher.totalPeriods} คาบ</span>
                    </div>
                  </div>
                </div>

                {/* Expanded Subject Table */}
                {isExpanded && (
                  <div className="p-4 sm:p-6 bg-black/20 animate-in fade-in duration-200">
                    {teacher.subjects.length === 0 ? (
                      <div className="py-8 text-center text-slate-500 border border-dashed border-white/10 rounded-xl bg-white/[0.01]">
                        <BookOpen className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                        <p className="text-sm font-medium text-slate-400">ไม่มีภาระงานสอนรายวิชาในภาคเรียนนี้</p>
                        <p className="text-xs text-slate-600">อาจปฏิบัติหน้าที่ฝ่ายสนับสนุนหรือภาระงานพิเศษ</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-white/10">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-[#0c0e16] text-slate-400 font-medium text-xs border-b border-white/10">
                            <tr>
                              <th className="px-4 py-3 text-center w-12">#</th>
                              <th className="px-4 py-3">รหัสวิชา</th>
                              <th className="px-4 py-3">ชื่อรายวิชา</th>
                              <th className="px-4 py-3">ระดับชั้น</th>
                              <th className="px-4 py-3">ห้องเรียน / อาคาร</th>
                              <th className="px-4 py-3">ตารางสอน (Schedule)</th>
                              <th className="px-4 py-3 text-center">คาบ/สัปดาห์</th>
                              <th className="px-4 py-3 text-center">รวมคาบ</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5 bg-[#0f1219]/60">
                            {teacher.subjects.map((subj) => {
                              const isActivity = subj.subjectType === 'ACTIVITY';

                              return (
                                <tr key={`${teacher.id}-${subj.order}-${subj.subjectCode}-${subj.room}`} className="hover:bg-white/[0.03] transition-colors">
                                  <td className="px-4 py-3.5 text-center text-xs text-slate-500 font-mono">
                                    {subj.order}
                                  </td>
                                  <td className="px-4 py-3.5 font-mono font-bold">
                                    <span className={cn(
                                      "px-2 py-1 rounded text-xs",
                                      isActivity ? "bg-purple-500/15 text-purple-300 border border-purple-500/30" : "bg-blue-500/15 text-blue-300 border border-blue-500/30"
                                    )}>
                                      {subj.subjectCode}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3.5 font-medium text-slate-200">
                                    <div className="flex items-center gap-2">
                                      <span>{subj.subjectName}</span>
                                      {isActivity && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">กิจกรรม</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3.5 text-slate-300 font-medium">
                                    <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-xs">
                                      {subj.level}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3.5 text-slate-400 text-xs">
                                    {subj.room}
                                  </td>
                                  <td className="px-4 py-3.5 font-mono text-xs text-amber-300">
                                    <div className="flex items-center gap-1.5">
                                      <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                      <span>{subj.schedule}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3.5 text-center font-bold text-slate-300 text-xs">
                                    {subj.periodsPerWeek}
                                  </td>
                                  <td className="px-4 py-3.5 text-center font-black text-sm text-blue-400">
                                    {subj.totalPeriods}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot className="bg-[#0a0d14] border-t border-white/10 font-bold text-xs">
                            <tr>
                              <td colSpan={6} className="px-4 py-3 text-right text-slate-400">
                                รวมภาระงานสอน ({teacher.teacherName}):
                              </td>
                              <td className="px-4 py-3 text-center text-slate-300">
                                {teacher.subjects.reduce((sum, s) => sum + s.periodsPerWeek, 0)}
                              </td>
                              <td className="px-4 py-3 text-center text-blue-400 text-sm font-black">
                                {teacher.totalPeriods}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
