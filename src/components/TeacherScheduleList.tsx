import React, { useState, useMemo } from 'react';
import { Clock, CheckCircle2, History, BookOpen, FileText, CheckCircle, Calendar, Sparkles } from 'lucide-react';
import { mergeConsecutivePeriods, periodRangeLabel } from '../lib/mergeConsecutivePeriods';

export interface SubjectPeriod {
  id: string;
  courseId: string;     // Reference to the original course ID
  periodNumber: number; // คาบที่ (1, 2, 3...)
  startTime: string;    // "08:30"
  endTime: string;      // "09:20"
  subjectCode: string;  // "ค32101"
  subjectName: string;  // "คณิตศาสตร์พื้นฐาน"
  className: string;    // "ม.5/8"
  room: string;         // "อาคาร 3 ห้อง 321"
  attendanceTaken?: boolean;
  hasPostTeachingRecord?: boolean;
  roleLabel?: string;
  studentsCount?: number;
  type?: 'MAIN' | 'ACTIVITY';
  teachingPartner?: string;
  partnerCheckedAttendance?: boolean;
  scheduleId?: string;          // schedules/{id} — ใช้ยื่นคำขอเช็คชื่อย้อนหลัง
  level?: string;               // ระดับชั้น เช่น ม.5/8
  lateRequestStatus?: 'PENDING' | 'APPROVED' | 'REJECTED' | null;  // สถานะคำขอเช็คชื่อย้อนหลังของครูคนนี้
  // คาบรวม (double/triple period ติดกัน) — ดู lib/mergeConsecutivePeriods
  periodNumberEnd?: number;        // คาบสุดท้ายของช่วง (ถ้ารวม)
  mergedCourseIds?: string[];      // courseId ของทุกคาบย่อยในช่วง
  mergedPeriodNumbers?: number[];  // periodNumber ของทุกคาบย่อยในช่วง
}

interface TeacherScheduleListProps {
  periods: SubjectPeriod[];
  currentDate: Date;
  isNextDay: boolean;
  dayLabel: string;
  onTakeAttendance: (courseId: string) => void;
  onRequestLateAttendance: (courseId: string) => void;
  onRecordPostTeaching: (courseId: string) => void;
  onViewPostTeachingRecord: (courseId: string) => void;
  onTogglePartnerAttendance?: (courseId: string, currentStatus: boolean) => void;
  onEnterClassroom?: (courseId: string) => void;
}

export const TeacherScheduleList: React.FC<TeacherScheduleListProps> = ({
  periods,
  currentDate,
  isNextDay,
  dayLabel,
  onTakeAttendance,
  onRequestLateAttendance,
  onRecordPostTeaching,
  onViewPostTeachingRecord,
  onTogglePartnerAttendance,
  onEnterClassroom
}) => {
  const [selectedClass, setSelectedClass] = useState<string>('ALL');

  // Normalize class name helper to group correctly (e.g. "M.5/8" and "ม.5/8" both map to "ม.5/8")
  const normalizeClassName = (cls: string) => {
    if (!cls) return "";
    return cls.replace(/^M\./i, 'ม.').trim();
  };

  // 1. Extract and sort class options dynamically from periods from least to greatest
  const uniqueClassNames: string[] = Array.from(
    new Set(periods.map(p => normalizeClassName(p.className)))
  );

  const sortedClassNames = uniqueClassNames.sort((a: string, b: string) => {
    const normA = a.replace(/^ม\./i, '').trim();
    const normB = b.replace(/^ม\./i, '').trim();
    const matchA = normA.match(/(\d+)\/(\d+)/);
    const matchB = normB.match(/(\d+)\/(\d+)/);
    if (matchA && matchB) {
      const levelA = parseInt(matchA[1], 10);
      const roomA = parseInt(matchA[2], 10);
      const levelB = parseInt(matchB[1], 10);
      const roomB = parseInt(matchB[2], 10);
      if (levelA !== levelB) return levelA - levelB;
      return roomA - roomB;
    }
    return normA.localeCompare(normB, 'th');
  });

  // 2. Logic เรียงลำดับจากน้อยไปมาก (Period 1 -> Period N)
  const sortedPeriods = [...periods].sort((a, b) => a.periodNumber - b.periodNumber);

  // 3. Logic ตรวจสอบสถานะเวลา
  const getPeriodStatus = (startTime: string, endTime: string) => {
    if (isNextDay) return 'UPCOMING'; // If viewing rolled over next working day, everything is upcoming

    const currentMinutes = currentDate.getHours() * 60 + currentDate.getMinutes();

    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);

    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
      return 'CURRENT'; // กำลังเรียนอยู่
    } else if (currentMinutes > endMinutes) {
      return 'PAST';    // ผ่านมาแล้ว
    } else {
      return 'UPCOMING';// ยังมาไม่ถึง
    }
  };

  const filteredPeriods = sortedPeriods.filter(p => {
    if (selectedClass === 'ALL') return true;
    return normalizeClassName(p.className) === selectedClass;
  });

  // รวมคาบติดกัน (เช่น คาบ 3-4 วิชา+ห้องเดียวกัน) ให้เป็นแถวเดียว
  const displayPeriods = useMemo(() => mergeConsecutivePeriods(filteredPeriods), [filteredPeriods]);

  // ปุ่มบันทึกหลังสอน — gate ไว้: บันทึกได้ต่อเมื่อเช็คชื่อคาบนั้นเสร็จแล้วเท่านั้น
  // (business rule: ต้องทำกิจกรรมการเรียนการสอน = เช็คชื่อ ก่อน ถึงจะบันทึกหลังสอนได้)
  const renderPostTeachingBtn = (period: SubjectPeriod, idPrefix: string) => {
    if (period.hasPostTeachingRecord) {
      return (
        <button
          id={`${idPrefix}-${period.id}`}
          onClick={() => onViewPostTeachingRecord(period.courseId)}
          className="px-4 py-2 text-xs font-bold text-blue-400 bg-[#1b2a4a] hover:bg-[#23365d] border border-blue-900/50 rounded-lg flex items-center gap-1.5 transition active:scale-95"
        >
          <FileText className="w-3.5 h-3.5" /> ดูบันทึกหลังสอน
        </button>
      );
    }
    if (!period.attendanceTaken) {
      return (
        <span
          id={`${idPrefix}-locked-${period.id}`}
          title="เช็คชื่อคาบนี้ก่อน จึงจะบันทึกการสอนได้"
          className="px-4 py-2 text-xs font-bold text-slate-500 bg-slate-800/40 border border-slate-700/50 rounded-lg flex items-center gap-1.5 cursor-not-allowed"
        >
          <BookOpen className="w-3.5 h-3.5" /> บันทึกการสอน (เช็คชื่อก่อน)
        </span>
      );
    }
    return (
      <button
        id={`${idPrefix}-${period.id}`}
        onClick={() => onRecordPostTeaching(period.courseId)}
        className="px-4 py-2 text-xs font-bold text-blue-400 bg-[#1b2a4a] hover:bg-[#23365d] border border-blue-900/50 rounded-lg flex items-center gap-1.5 transition active:scale-95"
      >
        <BookOpen className="w-3.5 h-3.5" /> บันทึกการสอน (Lesson Log)
      </button>
    );
  };

  const renderActivityDetails = (period: SubjectPeriod) => {
    if (period.type !== 'ACTIVITY') return null;
    return (
      <div className="mt-3 p-3 bg-slate-900/60 rounded-xl border border-slate-850 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    {period.type === 'ACTIVITY' ? (
                      <span className="bg-purple-500/25 text-purple-300 font-extrabold px-2.5 py-1 rounded-md border border-purple-500/30">
                        กิจกรรมร่วม (2 ท่าน)
                      </span>
                    ) : (
                      <span className="bg-purple-500/25 text-purple-300 font-extrabold px-2.5 py-1 rounded-md border border-purple-500/30">
                        ครูสอนร่วม
                      </span>
                    )}
                    {period.teachingPartner && (
                      <span className="text-slate-300 font-bold">
                        สอนร่วมกับ {period.teachingPartner}
                      </span>
                    )}
                  </div>
        <div className="flex flex-wrap items-center gap-2">
          {period.partnerCheckedAttendance ? (
            <span className="text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 rounded-md flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" /> ซิงก์สำเร็จ: ครูสอนร่วมเช็คชื่อแล้ว
            </span>
          ) : (
            <span className="text-amber-400 font-bold bg-amber-500/10 border border-amber-500/25 px-2.5 py-1 rounded-md flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 animate-pulse" /> รอดำเนินการซิงก์จากครูสอนร่วม
            </span>
          )}
          {onTogglePartnerAttendance && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTogglePartnerAttendance(period.id, !period.partnerCheckedAttendance);
              }}
              className="text-[10px] text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-md px-2.5 py-1 transition font-bold"
            >
              จำลองครูร่วมเช็คชื่อ
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto" id="teacher-schedule-container">
      {/* Header & Filter Dropdown */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#161f30] p-5 rounded-xl border border-slate-800/80 shadow-lg" id="schedule-header">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-400" />
            <h2 className="text-xl font-bold text-white tracking-wide">ตารางสอนประจำวันของครู</h2>
            {isNextDay && (
              <span className="flex items-center gap-1 text-[11px] font-extrabold text-amber-400 bg-amber-400/15 border border-amber-400/30 px-2 py-0.5 rounded-full animate-pulse">
                <Sparkles className="w-3 h-3" />
                ตารางสอนวันถัดไป
              </span>
            )}
          </div>
          <p className="text-sm text-slate-300 font-medium">
            {dayLabel} • ข้อมูลเวลาเชื่อมต่อกับระบบบริหารของโรงเรียนโดยตรง
          </p>
        </div>
        
        {/* Dropdown เลือกห้อง (เรียงจากน้อยไปมาก) */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-300 font-bold whitespace-nowrap">กรองห้องเรียน:</span>
          <select 
            id="class-filter-dropdown"
            value={selectedClass} 
            onChange={(e) => setSelectedClass(e.target.value)}
            className="border border-slate-800/80 rounded-lg px-4 py-2 text-sm bg-slate-800/80 font-medium text-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none transition cursor-pointer"
          >
            <option value="ALL">ทั้งหมด ({uniqueClassNames.length} ห้อง)</option>
            {sortedClassNames.map((cName) => (
              <option key={cName} value={cName}>
                ห้อง {cName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* สรุปสถานะเช็คชื่อรายคาบของวันนี้ — ให้หาเจอง่ายว่าคาบไหนเช็คแล้ว/ยัง */}
      {displayPeriods.length > 0 && (
        <div className="bg-[#161f30] border border-slate-800/80 rounded-xl px-4 py-3" id="attendance-status-summary">
          <div className="flex items-center justify-between gap-3 mb-2">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> สถานะการเช็คชื่อวันนี้
            </span>
            <span className="text-xs font-bold text-emerald-400">
              เช็คแล้ว {displayPeriods.filter(p => p.attendanceTaken).length}/{displayPeriods.length} คาบ
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {displayPeriods.map(p => (
              <span
                key={p.id}
                title={`${p.subjectCode} ${p.subjectName} · ${normalizeClassName(p.className)}`}
                className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                  p.attendanceTaken
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : p.lateRequestStatus === 'PENDING'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    : 'bg-slate-800/60 text-slate-400 border-slate-700/60'
                }`}
              >
                คาบ {periodRangeLabel(p)} {p.attendanceTaken ? '✓' : p.lateRequestStatus === 'PENDING' ? '⋯' : '—'}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* List ของคาบเรียน */}
      <div className="space-y-4" id="periods-list-container">
        {displayPeriods.length === 0 ? (
          <div className="text-center py-12 bg-[#161f30] rounded-xl border border-slate-800/80 text-slate-300 text-sm" id="empty-schedule-state">
            ไม่มีวิชา/คาบเรียนในตารางสอนสำหรับวันหรือตัวเลือกนี้
          </div>
        ) : (
          displayPeriods.map((period) => {
            const status = getPeriodStatus(period.startTime, period.endTime);
            const displayClassName = normalizeClassName(period.className);

            if (status === 'PAST') {
              // 🔴 คาบที่ผ่านมาแล้ว: สีโทนเทาดร็อบลง (Grayscale / Dimmed)
              return (
                <div 
                  key={period.id} 
                  id={`period-past-${period.id}`}
                  className="bg-[#161f30]/60 border border-slate-800/80 rounded-xl p-5 transition-all opacity-75 hover:opacity-100 flex flex-col gap-3"
                >
                  <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 w-full">
                    <div className="flex items-start gap-4">
                      <span className="bg-slate-800/80 text-slate-300 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-700/50 whitespace-nowrap">
                        คาบที่ {periodRangeLabel(period)}
                      </span>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="bg-emerald-950/60 text-emerald-400 border border-emerald-800/50 px-2.5 py-0.5 rounded-md font-bold text-xs">
                            {period.subjectCode}
                          </span>
                          <h3 className="font-bold text-white text-lg leading-tight">
                            {period.subjectName}
                          </h3>
                          <span className="bg-slate-800/80 text-slate-300 border border-slate-700/50 px-2.5 py-0.5 rounded-md text-xs font-bold">
                            ห้อง {displayClassName}
                          </span>
                          {period.roleLabel && (
                            <span className="bg-slate-800/80 text-slate-300 border border-slate-700/50 px-2 py-0.5 rounded-md text-[10px] font-bold">
                              {period.roleLabel}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-300 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" /> 
                          <span className="bg-slate-800/80 text-slate-300 px-2 py-0.5 rounded text-xs font-mono">{period.startTime} - {period.endTime} น.</span> (ผ่านมาแล้ว) • <span className="text-slate-300">{period.room}</span>
                        </p>
                      </div>
                    </div>

                    {/* PAST PERIOD BUTTONS */}
                    <div className="flex flex-wrap items-center gap-2 md:self-center">
                      {!period.attendanceTaken ? (
                        <div className="flex items-center gap-2">
                          {period.lateRequestStatus === 'PENDING' ? (
                            <span className="px-3 py-1.5 text-xs font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 animate-pulse" /> รออนุมัติเช็คชื่อย้อนหลัง
                            </span>
                          ) : period.lateRequestStatus === 'APPROVED' ? (
                            <button
                              id={`btn-retroactive-approved-${period.id}`}
                              onClick={() => onRequestLateAttendance(period.courseId)}
                              className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 border border-emerald-500/50 rounded-lg flex items-center gap-1.5 transition active:scale-95 shadow-md"
                            >
                              <CheckCircle className="w-3.5 h-3.5" /> เข้าเช็คชื่อย้อนหลัง (อนุมัติแล้ว)
                            </button>
                          ) : (
                            <>
                              <span className="text-red-500 font-medium text-xs flex items-center gap-1">
                                ● ยังไม่บันทึก{period.lateRequestStatus === 'REJECTED' ? ' · คำขอถูกปฏิเสธ' : ''}
                              </span>
                              <button
                                id={`btn-retroactive-${period.id}`}
                                onClick={() => onRequestLateAttendance(period.courseId)}
                                className="px-4 py-2 text-xs font-bold text-amber-400 bg-[#3b2211] hover:bg-[#4a2b16] border border-amber-800/60 rounded-lg flex items-center gap-1.5 transition active:scale-95 shadow-sm"
                              >
                                <History className="w-3.5 h-3.5" />
                                {period.lateRequestStatus === 'REJECTED' ? 'ขอเช็คชื่อย้อนหลังอีกครั้ง' : 'ขอเช็คชื่อย้อนหลัง'}
                              </button>
                            </>
                          )}
                        </div>
                      ) : period.lateRequestStatus === 'APPROVED' ? (
                        // เช็คชื่อ "ย้อนหลัง" แล้ว — ทำได้แค่เช็คชื่ออย่างเดียว ห้ามเข้าห้องทำกิจกรรมอื่น
                        // (business logic: การเช็คชื่อย้อนหลังต่างจากเช็คชื่อตามเวลาจริง — ไม่ปลดล็อก "เข้าสู่ชั้นเรียน")
                        <span className="px-3 py-1.5 text-xs font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 rounded-lg flex items-center gap-1.5">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> เช็คชื่อย้อนหลังเรียบร้อยแล้ว
                          <span className="text-[10px] text-slate-400 font-normal">(เช็คชื่ออย่างเดียว)</span>
                        </span>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-3 py-1.5 text-xs font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 rounded-lg flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> เช็คชื่อเรียบร้อยแล้ว
                          </span>
                          {onEnterClassroom && (
                            <button
                              id={`btn-past-enter-class-${period.id}`}
                              onClick={() => onEnterClassroom(period.courseId)}
                              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 border border-indigo-500/50 rounded-lg flex items-center gap-1.5 transition active:scale-95 shadow-md shadow-indigo-600/25"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
                              เข้าสู่ชั้นเรียน
                            </button>
                          )}
                        </div>
                      )}

                      {renderPostTeachingBtn(period, 'btn-log')}
                    </div>
                  </div>
                  {renderActivityDetails(period)}
                </div>
              );
            }

            if (status === 'CURRENT') {
              // 🟢 คาบปัจจุบัน: Emerald Green
              return (
                <div 
                  key={period.id} 
                  id={`period-live-${period.id}`}
                  className="bg-gradient-to-r from-emerald-950/40 via-[#161f30] to-emerald-950/20 border-2 border-emerald-500 rounded-xl p-5 shadow-[0_0_20px_rgba(16,185,129,0.2)] relative overflow-hidden flex flex-col gap-3 transition-all duration-300"
                >
                  <div className="absolute top-0 right-0 bg-emerald-500 text-slate-950 text-[10px] font-extrabold px-3.5 py-1 rounded-bl-lg tracking-wider uppercase flex items-center gap-1.5 z-10">
                    <span className="w-1.5 h-1.5 bg-slate-950 rounded-full animate-ping" />
                    ● กำลังเรียนอยู่ (LIVE)
                  </div>
                  
                  <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 w-full">
                    <div className="flex items-start gap-4">
                      <span className="bg-slate-800/80 text-slate-300 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-700/50 whitespace-nowrap">
                        คาบที่ {periodRangeLabel(period)}
                      </span>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="bg-emerald-950/60 text-emerald-400 border border-emerald-800/50 px-2.5 py-0.5 rounded-md font-bold text-xs">
                            {period.subjectCode}
                          </span>
                          <h3 className="font-bold text-white text-lg leading-tight">
                            {period.subjectName}
                          </h3>
                          <span className="bg-slate-800/80 text-slate-300 border border-slate-700/50 px-2.5 py-0.5 rounded-md text-xs font-bold">
                            ห้อง {displayClassName}
                          </span>
                          {period.roleLabel && (
                            <span className="bg-slate-800/80 text-slate-300 border border-slate-700/50 px-2 py-0.5 rounded-md text-[10px] font-bold">
                              {period.roleLabel}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-emerald-400" /> 
                          <span className="bg-slate-800/80 text-slate-300 px-2 py-0.5 rounded font-mono text-xs">{period.startTime} - {period.endTime} น.</span> • <span className="text-slate-300">{period.room}</span>
                        </p>
                      </div>
                    </div>

                    {/* CURRENT PERIOD BUTTONS */}
                    <div className="flex flex-wrap items-center gap-3 md:self-center z-10">
                      {period.attendanceTaken ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-4 py-2 text-xs font-extrabold text-emerald-400 bg-emerald-950/60 border border-emerald-800/50 rounded-lg flex items-center gap-1.5">
                            <CheckCircle className="w-4 h-4 text-emerald-400" /> เช็คชื่อเรียบร้อยแล้ว
                          </span>
                          {onEnterClassroom && (
                            <button
                              id={`btn-live-enter-class-${period.id}`}
                              onClick={() => onEnterClassroom(period.courseId)}
                              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 border border-indigo-500/50 rounded-lg flex items-center gap-1.5 transition active:scale-95 shadow-md shadow-indigo-600/25"
                            >
                              <Sparkles className="w-4 h-4 text-indigo-200" />
                              เข้าสู่ชั้นเรียน
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-red-500 font-medium text-xs flex items-center gap-1">
                            ● ยังไม่บันทึก
                          </span>
                          <button 
                            id={`btn-take-attendance-${period.id}`}
                            onClick={() => onTakeAttendance(period.courseId)}
                            className="px-5 py-2.5 text-xs font-black text-slate-950 bg-emerald-400 hover:bg-emerald-300 active:scale-95 shadow-[0_4px_14px_rgba(16,185,129,0.35)] rounded-lg flex items-center gap-1.5 transition-all"
                          >
                            <CheckCircle2 className="w-4 h-4 animate-bounce" />
                            {period.type === 'ACTIVITY' ? 'บันทึกโฮมรูม / เช็กชื่อร่วม' : 'เช็กชื่อเข้าเรียนทันที'}
                          </button>
                        </div>
                      )}

                      {renderPostTeachingBtn(period, 'btn-live-log')}
                    </div>
                  </div>
                  {renderActivityDetails(period)}
                </div>
              );
            }

            // 🔵 คาบกำลังจะมาถึง (UPCOMING)
            return (
              <div 
                key={period.id} 
                id={`period-upcoming-${period.id}`}
                className="bg-[#161f30] border-l-4 border-l-emerald-500 border-y border-r border-slate-800/80 rounded-xl p-5 shadow-md hover:shadow-lg transition flex flex-col gap-3"
              >
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 w-full">
                  <div className="flex items-start gap-4">
                    <span className="bg-slate-800/80 text-slate-300 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-700/50 whitespace-nowrap">
                      คาบที่ {periodRangeLabel(period)}
                    </span>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="bg-emerald-950/60 text-emerald-400 border border-emerald-800/50 px-2.5 py-0.5 rounded-md font-bold text-xs">
                          {period.subjectCode}
                        </span>
                        <h3 className="font-bold text-white text-lg leading-tight">
                          {period.subjectName}
                        </h3>
                        <span className="bg-slate-800/80 text-slate-300 border border-slate-700/50 px-2.5 py-0.5 rounded-md text-xs font-bold">
                          ห้อง {displayClassName}
                        </span>
                        {period.roleLabel && (
                          <span className="bg-slate-800/80 text-slate-300 border border-slate-700/50 px-2 py-0.5 rounded-md text-[10px] font-bold">
                            {period.roleLabel}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-300 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-emerald-400" /> 
                        <span className="bg-slate-800/80 text-slate-300 px-2 py-0.5 rounded font-mono text-xs">{period.startTime} - {period.endTime} น.</span> • <span className="text-slate-300">{period.room}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 md:self-center">
                    {period.attendanceTaken ? (
                      <>
                        <span className="px-3 py-1.5 text-xs font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 rounded-lg flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> เช็คชื่อเรียบร้อยแล้ว
                        </span>
                        {onEnterClassroom && (
                          <button
                            id={`btn-upcoming-enter-class-${period.id}`}
                            onClick={() => onEnterClassroom(period.courseId)}
                            className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 border border-indigo-500/50 rounded-lg flex items-center gap-1.5 transition active:scale-95 shadow-md shadow-indigo-600/25"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
                            เข้าสู่ชั้นเรียน
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <span className="text-red-500 font-medium text-xs flex items-center gap-1">
                          ● ยังไม่บันทึก
                        </span>
                        <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/50 px-3.5 py-2 rounded-lg flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                          รอสอน
                        </span>
                      </>
                    )}

                    {renderPostTeachingBtn(period, 'btn-upcoming-log')}
                  </div>
                </div>
                {renderActivityDetails(period)}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
