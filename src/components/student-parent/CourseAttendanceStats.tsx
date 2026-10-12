import React, { useMemo } from 'react';
import { BookOpen } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTeacherFirestoreSchedule } from '../../hooks/useTeacherFirestoreSchedule';
import { buildCourseAttendanceRows, CourseAttendanceStatsMap } from '../../lib/courseAttendanceStats';

/**
 * สถิติการเข้าเรียนแยกรายวิชา — ทุกวิชาในตารางเรียนจริงของห้องนักเรียน + ยอดสะสมจาก
 * students/{id}.courseAttendanceStats (sync ตอนครูเช็คชื่อคาบวิชา) ยอดนับตั้งแต่เริ่มบันทึกรหัสวิชา
 */
export function CourseAttendanceStats({ studentId, room, courseStats }: {
  studentId: string;
  room?: string;
  courseStats?: CourseAttendanceStatsMap | null;
}) {
  const { schedules, loading } = useTeacherFirestoreSchedule();
  const rows = useMemo(
    () => buildCourseAttendanceRows({ schedules: schedules as any[], studentRoom: room, studentId, courseStats }),
    [schedules, room, studentId, courseStats],
  );

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-md shadow-xl space-y-4" data-testid="course-attendance-stats">
      <div>
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-indigo-400" /> สถิติการเข้าเรียนแยกรายวิชา
        </h3>
        <p className="text-[11px] text-slate-400">
          นับจากการเช็คชื่อรายคาบของครูผู้สอน (ไม่รวมโฮมรูม) — วิชาที่ยังไม่เคยเช็คชื่อจะแสดงว่ายังไม่มีข้อมูล
        </p>
      </div>

      {loading && <div className="py-6 text-center text-xs text-slate-500">กำลังโหลดรายวิชา...</div>}
      {!loading && rows.length === 0 && (
        <div className="py-6 text-center text-xs text-slate-500">
          {room ? 'ยังไม่พบรายวิชาในตารางเรียนของห้องนี้' : 'ยังไม่ได้กำหนดห้องเรียน จึงแสดงรายวิชาไม่ได้'}
        </div>
      )}

      <div className="space-y-2">
        {rows.map(r => {
          const st = r.stats;
          return (
            <div key={r.key} className={cn(
              'rounded-2xl border p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3',
              st.isBelowThreshold ? 'bg-red-950/30 border-red-800/50' : 'bg-slate-800/40 border-slate-800',
            )}>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">{r.name}</div>
                <div className="text-[10px] text-slate-400 font-mono">{r.code}{!r.inSchedule && ' • ไม่อยู่ในตารางปัจจุบัน'}</div>
              </div>
              {st.totalRecorded === 0 ? (
                <span className="text-[11px] text-slate-500">ยังไม่มีข้อมูลการเช็คชื่อ</span>
              ) : (
                <div className="flex items-center gap-4 text-center shrink-0">
                  <Stat label="มา" value={st.present} tone="text-emerald-400" />
                  <Stat label="สาย" value={st.late} tone="text-amber-400" />
                  <Stat label="ขาด" value={st.absent} tone="text-red-400" />
                  <Stat label="ลา" value={st.leave} tone="text-indigo-400" />
                  <div className="min-w-[3.5rem]">
                    <div className={cn('text-sm font-black', st.isBelowThreshold ? 'text-red-300' : 'text-white')}>
                      {st.attendanceRate === null ? '—' : `${st.attendanceRate}%`}
                    </div>
                    <div className="text-[10px] text-slate-400">เข้าเรียน</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <div className={cn('text-sm font-black', tone)}>{value}</div>
      <div className="text-[10px] text-slate-400">{label}</div>
    </div>
  );
}
