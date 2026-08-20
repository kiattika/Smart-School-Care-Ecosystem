import React, { useState, useMemo } from 'react';
import { 
  BookOpen, 
  Users, 
  Clock, 
  Search, 
  Filter, 
  ChevronDown, 
  ChevronRight, 
  FileSpreadsheet, 
  Calendar, 
  Layers, 
  Sparkles, 
  CheckCircle2, 
  Award,
  Download
} from 'lucide-react';
import { TEACHING_LOAD_DATA, TeacherTeachingLoad, TeachingSubject } from '../data/teachingLoadData';
import { cn } from '../lib/utils';

interface TeachingLoadTableProps {
  initialTeacherName?: string;
  onSelectTeacher?: (teacher: TeacherTeachingLoad) => void;
  className?: string;
}

export function TeachingLoadTable({ initialTeacherName, onSelectTeacher, className }: TeachingLoadTableProps) {
  const [searchTerm, setSearchTerm] = useState(initialTeacherName || '');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('ALL');
  const [expandedTeacherIds, setExpandedTeacherIds] = useState<number[]>([4]); // Default expand Mr. Kiattisak

  // Distinct departments
  const departments = useMemo(() => {
    const set = new Set<string>();
    TEACHING_LOAD_DATA.forEach(t => set.add(t.department));
    return Array.from(set);
  }, []);

  // Filtered teachers
  const filteredData = useMemo(() => {
    return TEACHING_LOAD_DATA.filter(teacher => {
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
  }, [searchTerm, selectedDepartment]);

  // High-level metrics
  const totalTeachers = TEACHING_LOAD_DATA.length;
  const totalMainPeriods = TEACHING_LOAD_DATA.reduce((acc, t) => acc + t.totalMainPeriods, 0);
  const totalActivityPeriods = TEACHING_LOAD_DATA.reduce((acc, t) => acc + t.totalActivityPeriods, 0);
  const totalOverallPeriods = TEACHING_LOAD_DATA.reduce((acc, t) => acc + t.totalPeriods, 0);

  const toggleExpand = (id: number) => {
    setExpandedTeacherIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const expandAll = () => {
    setExpandedTeacherIds(TEACHING_LOAD_DATA.map(t => t.id));
  };

  const collapseAll = () => {
    setExpandedTeacherIds([]);
  };

  const handleExportCSV = () => {
    const rows = [
      ['ID', 'Department', 'Teacher Name', 'Homeroom', 'Order', 'Subject Code', 'Subject Name', 'Periods/Week', 'Room', 'Schedule', 'Level', 'Total Periods']
    ];

    TEACHING_LOAD_DATA.forEach(t => {
      if (t.subjects.length === 0) {
        rows.push([
          t.id.toString(),
          t.department,
          t.teacherName,
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
            t.id.toString(),
            t.department,
            t.teacherName,
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
    link.setAttribute('download', 'teaching_load_official_roster.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0f1219] border border-white/10 rounded-2xl p-5 shadow-xl relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">จำนวนครูทั้งหมด</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-white">{totalTeachers} <span className="text-sm font-normal text-slate-400">คน</span></div>
          <p className="text-xs text-slate-500 mt-1">4 กลุ่มสาระการเรียนรู้</p>
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
          <p className="text-xs text-slate-500 mt-1">HomeRoom & Cleaning Zone</p>
        </div>

        <div className="bg-[#0f1219] border border-white/10 rounded-2xl p-5 shadow-xl relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">รวมภาระงานสอนทั้งสิ้น</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-amber-400">{totalOverallPeriods} <span className="text-sm font-normal text-slate-400">คาบ</span></div>
          <p className="text-xs text-slate-500 mt-1">เฉลี่ย {(totalOverallPeriods / totalTeachers).toFixed(1)} คาบ/คน/สัปดาห์</p>
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
              placeholder="ค้นหาชื่อครู, รหัสวิชา (ค32201), ห้อง (943), ชั้น (M.5/8)..."
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
            className="px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
          >
            ขยายทั้งหมด
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
          >
            ยุบทั้งหมด
          </button>
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 flex items-center gap-1.5 transition-colors shadow-[0_0_15px_rgba(16,185,129,0.15)]"
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
            const isExpanded = expandedTeacherIds.includes(teacher.id);
            const isPrimary = teacher.totalPeriods > 0;

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
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/5 text-slate-300 border border-white/10">
                          ครูที่ปรึกษา: {teacher.homeroom}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">ID: #{teacher.id} • {teacher.teacherEmail || `${teacher.teacherName.toLowerCase().replace(/[^a-z0-9]/g, '')}@utd.ac.th`}</p>
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
                              const isActivity = subj.subjectCode === 'HR' || subj.subjectCode === 'CZ' || subj.subjectName.includes('กิจกรรม');

                              return (
                                <tr key={`${teacher.id}-${subj.order}-${subj.subjectCode}`} className="hover:bg-white/[0.03] transition-colors">
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
