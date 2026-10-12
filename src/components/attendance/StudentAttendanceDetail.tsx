import React, { useMemo, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { cn } from '../../lib/utils';
import { DatePicker } from '../shared/DatePicker';
import { RawScheduleDoc } from '../../lib/studentDaySchedule';
import { AttendanceRecordFull, aggregateLogByCourse, buildStudentAttendanceLog } from '../../lib/attendanceHistory';
import { attendanceStatsFromCounts } from '../../lib/studentAttendanceStats';

const STATUS_TH = { PRESENT: 'มา', LATE: 'สาย', ABSENT: 'ขาด', LEAVE: 'ลา' } as const;
const STATUS_CLASS = {
  PRESENT: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  LATE: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  ABSENT: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  LEAVE: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
} as const;

const thaiDate = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y) return ymd;
  return new Date(y, m - 1, d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
};

/**
 * สถิติการเข้าเรียนรายบุคคลแบบละเอียด: สรุปรายวิชา + ประวัติรายวัน-รายคาบ ย้อนหลังตามช่วงวันที่ที่เลือก
 * ข้อมูลจาก attendance_records จริง (ครูผู้สอน/ครูที่ปรึกษาเท่านั้นที่อ่านได้)
 */
export function StudentAttendanceDetail({ studentId, records, schedules, range, onRangeChange, loading, limitToCourseKeys }: {
  studentId: string;
  records: AttendanceRecordFull[];
  schedules: RawScheduleDoc[];
  range: { start: string; end: string };
  onRangeChange: (r: { start: string; end: string }) => void;
  loading?: boolean;
  /** จำกัดเฉพาะวิชาเหล่านี้ (key = courseStatKey(code)) — เช่น วิชาที่ครูผู้สอนท่านนี้สอน; ว่าง/ไม่ส่ง = ทุกวิชา */
  limitToCourseKeys?: Set<string> | null;
}) {
  const [courseFilter, setCourseFilter] = useState<string>('ALL');

  const log = useMemo(() => {
    const all = buildStudentAttendanceLog(records, schedules, studentId);
    return limitToCourseKeys && limitToCourseKeys.size > 0 ? all.filter(r => limitToCourseKeys.has(r.courseKey)) : all;
  }, [records, schedules, studentId, limitToCourseKeys]);
  const byCourse = useMemo(() => aggregateLogByCourse(log, studentId), [log, studentId]);
  const total = useMemo(() => {
    const c = { present: 0, absent: 0, late: 0, leave: 0 };
    for (const r of log) c[r.status.toLowerCase() as keyof typeof c]++;
    return attendanceStatsFromCounts(studentId, c);
  }, [log, studentId]);
  const shown = courseFilter === 'ALL' ? log : log.filter(r => r.courseKey === courseFilter);

  return (
    <div className="space-y-4" data-testid="student-attendance-detail">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-[11px] text-slate-400 space-y-1">
          <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" /> ตั้งแต่วันที่</span>
          <DatePicker value={range.start} max={range.end} onChange={v => v && onRangeChange({ ...range, start: v })} ariaLabel="ตั้งแต่วันที่" />
        </label>
        <label className="text-[11px] text-slate-400 space-y-1">
          <span>ถึงวันที่</span>
          <DatePicker value={range.end} min={range.start} onChange={v => v && onRangeChange({ ...range, end: v })} ariaLabel="ถึงวันที่" />
        </label>
        <div className="ml-auto text-right">
          <div className={cn('text-lg font-black', total.isBelowThreshold ? 'text-rose-400' : 'text-white')}>
            {total.attendanceRate === null ? '—' : `${total.attendanceRate}%`}
          </div>
          <div className="text-[10px] text-slate-400">เข้าเรียนรวม (ไม่นับวันลา)</div>
        </div>
      </div>

      {loading && <div className="text-xs text-slate-500 py-4 text-center">กำลังโหลดประวัติการเช็คชื่อ...</div>}
      {!loading && log.length === 0 && (
        <div className="text-xs text-slate-500 py-6 text-center">ไม่พบการเช็คชื่อของนักเรียนคนนี้ในช่วงวันที่ที่เลือก</div>
      )}

      {byCourse.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-300">สรุปรายวิชา</h4>
          {byCourse.map(c => (
            <button
              type="button"
              key={c.courseKey || 'unknown'}
              onClick={() => setCourseFilter(courseFilter === c.courseKey ? 'ALL' : c.courseKey)}
              className={cn(
                'w-full text-left rounded-xl border p-3 flex items-center justify-between gap-3 transition-colors',
                courseFilter === c.courseKey ? 'border-indigo-500/60 bg-indigo-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10',
                c.stats.isBelowThreshold && 'border-rose-500/40',
              )}
            >
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">{c.name}</div>
                {c.code && <div className="text-[10px] text-slate-400 font-mono">{c.code}</div>}
              </div>
              <div className="flex items-center gap-3 text-center shrink-0 text-[10px]">
                <span className="text-emerald-400"><b className="text-sm">{c.stats.present}</b><br />มา</span>
                <span className="text-amber-400"><b className="text-sm">{c.stats.late}</b><br />สาย</span>
                <span className="text-rose-400"><b className="text-sm">{c.stats.absent}</b><br />ขาด</span>
                <span className="text-indigo-400"><b className="text-sm">{c.stats.leave}</b><br />ลา</span>
                <span className={cn('min-w-[2.75rem] font-black text-sm', c.stats.isBelowThreshold ? 'text-rose-300' : 'text-white')}>
                  {c.stats.attendanceRate === null ? '—' : `${c.stats.attendanceRate}%`}
                </span>
              </div>
            </button>
          ))}
          {courseFilter !== 'ALL' && (
            <button type="button" onClick={() => setCourseFilter('ALL')} className="text-[11px] text-indigo-300 underline">แสดงทุกวิชา</button>
          )}
        </div>
      )}

      {shown.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-bold text-slate-300">ประวัติรายวัน-รายคาบ ({shown.length} รายการ)</h4>
          <div className="rounded-xl border border-white/10 divide-y divide-white/5 max-h-80 overflow-y-auto">
            {shown.map(r => (
              <div key={r.key} className="flex items-center gap-3 px-3 py-2 text-xs">
                <span className="w-20 text-slate-400 shrink-0">{thaiDate(r.date)}</span>
                <span className="w-12 text-slate-300 shrink-0">{r.periodNumber === null ? '—' : r.periodNumber === 0 ? 'คาบ 0' : `คาบ ${r.periodNumber}`}</span>
                <span className="flex-1 min-w-0 truncate text-slate-200">{r.courseName || <span className="text-slate-500">ไม่ทราบวิชา</span>}</span>
                <span className={cn('px-2 py-0.5 rounded-md border text-[10px] font-bold shrink-0', STATUS_CLASS[r.status])}>{STATUS_TH[r.status]}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
