import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  UserCheck, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Search, 
  UserX, 
  FileSpreadsheet, 
  Save, 
  ShieldCheck,
  Calendar,
  Sparkles,
  Users
} from 'lucide-react';
import { Student, Course } from '../../types';
import { saveAttendanceRecord } from '../../services/firestoreService';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

interface TakeAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  course: Course;
  students: Student[];
  currentDate?: Date;
  initialAttendance?: Record<string, 'PRESENT' | 'LATE' | 'ABSENT' | 'LEAVE'>;
  teacherId?: string;
  teacherName?: string;
  onAttendanceSaved: (newStatuses: Record<string, 'PRESENT' | 'LATE' | 'ABSENT' | 'LEAVE'>) => void;
}

export const TakeAttendanceModal: React.FC<TakeAttendanceModalProps> = ({
  isOpen,
  onClose,
  course,
  students,
  currentDate = new Date(),
  initialAttendance = {},
  teacherId = 'teacher_001',
  teacherName = 'ครูผู้สอน',
  onAttendanceSaved
}) => {
  // Initialize local attendance status map from initial attendance or default to PRESENT
  const [statuses, setStatuses] = useState<Record<string, 'PRESENT' | 'LATE' | 'ABSENT' | 'LEAVE'>>(() => {
    const map: Record<string, 'PRESENT' | 'LATE' | 'ABSENT' | 'LEAVE'> = {};
    students.forEach(s => {
      map[s.studentId] = initialAttendance[s.studentId] || 'PRESENT';
    });
    return map;
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'PRESENT' | 'LATE' | 'ABSENT' | 'LEAVE'>('ALL');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync if initialAttendance changes when opening
  React.useEffect(() => {
    if (isOpen) {
      const map: Record<string, 'PRESENT' | 'LATE' | 'ABSENT' | 'LEAVE'> = {};
      students.forEach(s => {
        map[s.studentId] = initialAttendance[s.studentId] || 'PRESENT';
      });
      setStatuses(map);
      setErrorMessage(null);
    }
  }, [isOpen, students, initialAttendance]);

  // Status counters
  const counts = useMemo(() => {
    let present = 0;
    let late = 0;
    let absent = 0;
    let leave = 0;
    Object.values(statuses).forEach(st => {
      if (st === 'PRESENT') present++;
      else if (st === 'LATE') late++;
      else if (st === 'ABSENT') absent++;
      else if (st === 'LEAVE') leave++;
    });
    return {
      total: students.length,
      present,
      late,
      absent,
      leave
    };
  }, [statuses, students]);

  // Filtered students
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const currentSt = statuses[s.studentId] || 'PRESENT';
      if (activeFilter !== 'ALL' && currentSt !== activeFilter) {
        return false;
      }
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.studentId.toLowerCase().includes(q) ||
        (s.studentNumber && String(s.studentNumber).includes(q)) ||
        (s.nickname && s.nickname.toLowerCase().includes(q))
      );
    });
  }, [students, statuses, activeFilter, searchTerm]);

  const handleSetStatus = (studentId: string, status: 'PRESENT' | 'LATE' | 'ABSENT' | 'LEAVE') => {
    setStatuses(prev => ({
      ...prev,
      [studentId]: status
    }));
  };

  const handleMarkAllPresent = () => {
    const next: Record<string, 'PRESENT' | 'LATE' | 'ABSENT' | 'LEAVE'> = {};
    students.forEach(s => {
      next[s.studentId] = 'PRESENT';
    });
    setStatuses(next);
  };

  const handleSaveToFirestore = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      const rawRoom = course.room || 'ม.5/8';
      const roomStr = rawRoom.replace('/', '-');
      const periodNum = course.periodIndex || 1;
      const recordId = `${dateStr}_${roomStr}_p${periodNum}`;

      // Write directly to Firestore attendance_records collection
      await saveAttendanceRecord({
        id: recordId,
        date: dateStr,
        room: rawRoom,
        checkedByTeacherId: teacherId,
        checkedByName: teacherName,
        periodNumber: periodNum,
        checkedAt: format(new Date(), 'HH:mm'),
        isLocked: true,
        students: statuses
      });

      // Notify parent component to update state & persistence
      onAttendanceSaved(statuses);
      onClose();
    } catch (err: any) {
      console.error('Failed to save attendance to Firestore:', err);
      setErrorMessage('ไม่สามารถบันทึกข้อมูลลง Firestore ได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        className="bg-[#111622] border border-slate-700/80 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800 bg-[#161c2c] flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  บันทึกการเช็คชื่อเข้าเรียน (Live Attendance Record)
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Firestore Connected
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-200">{course.code} {course.name}</span>
                <span>•</span>
                <span>ห้อง {course.room}</span>
                <span>•</span>
                <span className="flex items-center gap-1 font-mono text-slate-300">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  {format(currentDate, 'dd MMMM yyyy', { locale: th })} (คาบที่ {course.periodIndex || 1})
                </span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action & Stats Bar */}
        <div className="p-4 bg-[#141926] border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          {/* Status Counter Badges */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <button
              onClick={() => setActiveFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                activeFilter === 'ALL'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              ทั้งหมด: <span className="font-mono text-white ml-1">{counts.total}</span>
            </button>
            <button
              onClick={() => setActiveFilter('PRESENT')}
              className={`px-3 py-1.5 rounded-xl font-bold border transition-all ${
                activeFilter === 'PRESENT'
                  ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300 shadow-sm'
                  : 'bg-emerald-950/20 border-emerald-800/40 text-emerald-400 hover:bg-emerald-900/30'
              }`}
            >
              มาเรียน: <span className="font-mono ml-1">{counts.present}</span>
            </button>
            <button
              onClick={() => setActiveFilter('LATE')}
              className={`px-3 py-1.5 rounded-xl font-bold border transition-all ${
                activeFilter === 'LATE'
                  ? 'bg-amber-950/60 border-amber-500 text-amber-300 shadow-sm'
                  : 'bg-amber-950/20 border-amber-800/40 text-amber-400 hover:bg-amber-900/30'
              }`}
            >
              มาสาย: <span className="font-mono ml-1">{counts.late}</span>
            </button>
            <button
              onClick={() => setActiveFilter('ABSENT')}
              className={`px-3 py-1.5 rounded-xl font-bold border transition-all ${
                activeFilter === 'ABSENT'
                  ? 'bg-red-950/60 border-red-500 text-red-300 shadow-sm'
                  : 'bg-red-950/20 border-red-800/40 text-red-400 hover:bg-red-900/30'
              }`}
            >
              ขาดเรียน: <span className="font-mono ml-1">{counts.absent}</span>
            </button>
            <button
              onClick={() => setActiveFilter('LEAVE')}
              className={`px-3 py-1.5 rounded-xl font-bold border transition-all ${
                activeFilter === 'LEAVE'
                  ? 'bg-blue-950/60 border-blue-500 text-blue-300 shadow-sm'
                  : 'bg-blue-950/20 border-blue-800/40 text-blue-400 hover:bg-blue-900/30'
              }`}
            >
              ลากิจ/ป่วย: <span className="font-mono ml-1">{counts.leave}</span>
            </button>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleMarkAllPresent}
              className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>ตั้งค่ามาครบทุกคน</span>
            </button>
          </div>
        </div>

        {/* Search Filter */}
        <div className="px-5 py-3 border-b border-slate-800 bg-[#0e121c] flex items-center gap-3">
          <Search className="w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="ค้นหาตามชื่อ, รหัสนักเรียน, เลขที่ หรือชื่อเล่น..."
            className="w-full bg-transparent text-xs text-white placeholder-slate-500 outline-none"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="text-slate-500 hover:text-slate-300 text-xs">
              ล้าง
            </button>
          )}
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="px-6 py-2.5 bg-red-500/15 border-b border-red-500/30 text-red-300 text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Student Attendance List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2.5 divide-y divide-slate-800/40">
          {filteredStudents.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              ไม่พบนักเรียนตามเงื่อนไขการค้นหา
            </div>
          ) : (
            filteredStudents.map((student, idx) => {
              const currentStatus = statuses[student.studentId] || 'PRESENT';

              return (
                <div
                  key={student.studentId}
                  className="pt-2.5 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-[#141926] hover:bg-[#181e2e] border border-slate-800/80 transition-colors"
                >
                  {/* Student Info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-7 text-center font-mono text-xs font-bold text-slate-500 shrink-0">
                      {student.studentNumber || idx + 1}
                    </span>
                    <img
                      src={student.avatar}
                      alt={student.name}
                      className="w-9 h-9 rounded-full object-cover bg-slate-800 border border-slate-700 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-white truncate flex items-center gap-2">
                        <span>{student.name}</span>
                        {student.nickname && (
                          <span className="text-xs text-slate-400 font-normal">({student.nickname})</span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        รหัส {student.studentId} • ห้อง {student.room}
                      </div>
                    </div>
                  </div>

                  {/* 4-State Toggle Selector */}
                  <div className="grid grid-cols-4 gap-1.5 shrink-0 sm:w-80">
                    {/* PRESENT */}
                    <button
                      type="button"
                      onClick={() => handleSetStatus(student.studentId, 'PRESENT')}
                      className={`py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all ${
                        currentStatus === 'PRESENT'
                          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30'
                          : 'bg-slate-800/70 text-slate-400 hover:text-emerald-300 hover:bg-slate-800'
                      }`}
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>มา</span>
                    </button>

                    {/* LATE */}
                    <button
                      type="button"
                      onClick={() => handleSetStatus(student.studentId, 'LATE')}
                      className={`py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all ${
                        currentStatus === 'LATE'
                          ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/30'
                          : 'bg-slate-800/70 text-slate-400 hover:text-amber-300 hover:bg-slate-800'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>สาย</span>
                    </button>

                    {/* ABSENT */}
                    <button
                      type="button"
                      onClick={() => handleSetStatus(student.studentId, 'ABSENT')}
                      className={`py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all ${
                        currentStatus === 'ABSENT'
                          ? 'bg-red-600 text-white shadow-lg shadow-red-900/30'
                          : 'bg-slate-800/70 text-slate-400 hover:text-red-300 hover:bg-slate-800'
                      }`}
                    >
                      <UserX className="w-3.5 h-3.5" />
                      <span>ขาด</span>
                    </button>

                    {/* LEAVE */}
                    <button
                      type="button"
                      onClick={() => handleSetStatus(student.studentId, 'LEAVE')}
                      className={`py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all ${
                        currentStatus === 'LEAVE'
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'
                          : 'bg-slate-800/70 text-slate-400 hover:text-blue-300 hover:bg-slate-800'
                      }`}
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>ลา</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-[#161c2c] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>ข้อมูลจะถูกบันทึกลงคอลเลกชัน <code className="font-mono text-slate-300">attendance_records</code> ใน Firestore ทันที</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-slate-700 hover:bg-white/5 text-slate-300 font-bold text-xs transition-colors"
            >
              ยกเลิก
            </button>

            <button
              type="button"
              onClick={handleSaveToFirestore}
              disabled={isSaving}
              className="flex-1 sm:flex-initial px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs shadow-xl shadow-emerald-900/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {isSaving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>กำลังบันทึกลง Firestore...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>บันทึกข้อมูลเช็คชื่อ (Save to Firestore)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
