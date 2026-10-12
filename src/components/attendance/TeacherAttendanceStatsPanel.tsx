import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useRealStudents } from '../../hooks/useRealStudents';
import { useTeacherFirestoreSchedule } from '../../hooks/useTeacherFirestoreSchedule';
import { useRoomAttendanceRecordsFull } from '../../hooks/useRoomAttendanceRecords';
import { defaultAttendanceDateRange, attendanceStatsFromCounts } from '../../lib/studentAttendanceStats';
import { buildStudentAttendanceLog } from '../../lib/attendanceHistory';
import { courseStatKey } from '../../lib/courseAttendanceStats';
import { isSameRoom } from '../../lib/utils';
import { StudentAttendanceDetail } from './StudentAttendanceDetail';

/**
 * สถิติการเข้าเรียนรายบุคคลสำหรับครูผู้สอน — เลือกห้องที่สอน + ช่วงวันที่ → ตารางนักเรียน (อัตราเข้าเรียน)
 * กดชื่อเพื่อดูละเอียดรายวิชา/รายวัน/รายคาบ ย้อนหลังได้ตามช่วงวันที่ — ข้อมูลจาก attendance_records จริง
 */
export function TeacherAttendanceStatsPanel({ rooms, myCourseCodes }: { rooms: string[]; myCourseCodes: string[] }) {
  const [room, setRoom] = useState<string>('');
  const [range, setRange] = useState(() => defaultAttendanceDateRange(30));
  const [onlyMine, setOnlyMine] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  const activeRoom = room || (rooms.length === 1 ? rooms[0] : '');
  const { students, loading: studentsLoading } = useRealStudents();
  const { schedules } = useTeacherFirestoreSchedule();
  const { records, loading, error } = useRoomAttendanceRecordsFull(activeRoom ? [activeRoom] : [], range);

  const roomStudents = useMemo(
    () => (activeRoom ? students.filter(s => isSameRoom(s.room, activeRoom)) : [])
      .slice().sort((a, b) => String(a.studentId).localeCompare(String(b.studentId))),
    [students, activeRoom],
  );
  const mineKeys = useMemo(() => new Set(myCourseCodes.filter(Boolean).map(courseStatKey)), [myCourseCodes]);
  const limit = onlyMine && mineKeys.size > 0 ? mineKeys : null;

  const rows = useMemo(() => roomStudents.map(s => {
    const log = buildStudentAttendanceLog(records, schedules as any[], s.studentId)
      .filter(r => !limit || limit.has(r.courseKey));
    const c = { present: 0, absent: 0, late: 0, leave: 0 };
    for (const r of log) c[r.status.toLowerCase() as keyof typeof c]++;
    return { student: s, stats: attendanceStatsFromCounts(s.studentId, c) };
  }), [roomStudents, records, schedules, limit]);

  return (
    <div className="bg-[#161f30] border border-slate-800/80 rounded-xl p-5 space-y-4" data-testid="teacher-attendance-stats">
      <div>
        <h3 className="text-lg font-bold text-white">สถิติการเข้าเรียนรายบุคคล</h3>
        <p className="text-xs text-slate-400">จากการเช็คชื่อรายคาบจริง — กดชื่อนักเรียนเพื่อดูละเอียดรายวิชา/รายวัน/รายคาบ ย้อนหลังตามช่วงวันที่</p>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs">
        <label className="flex items-center gap-2 text-slate-300">
          ห้อง
          <select
            value={activeRoom}
            onChange={e => { setRoom(e.target.value); setOpenId(null); }}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white"
          >
            {rooms.length !== 1 && <option value="">— เลือกห้อง —</option>}
            {rooms.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
          <input type="checkbox" checked={onlyMine} onChange={e => setOnlyMine(e.target.checked)} />
          เฉพาะวิชาที่ฉันสอน
        </label>
      </div>

      {rooms.length === 0 && <div className="py-8 text-center text-sm text-slate-500">ยังไม่พบห้องที่ท่านสอนในตารางสอนภาคเรียนนี้</div>}
      {rooms.length > 0 && !activeRoom && <div className="py-8 text-center text-sm text-slate-500">เลือกห้องเพื่อดูสถิติ</div>}
      {error && <div className="text-xs text-rose-400">โหลดบันทึกการเช็คชื่อไม่สำเร็จ: {error}</div>}
      {activeRoom && (studentsLoading || loading) && (
        <div className="py-6 flex items-center justify-center gap-2 text-xs text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> กำลังโหลด...</div>
      )}
      {activeRoom && !studentsLoading && roomStudents.length === 0 && (
        <div className="py-8 text-center text-sm text-slate-500">ยังไม่มีรายชื่อนักเรียนในห้อง {activeRoom}</div>
      )}

      <div className="space-y-2">
        {rows.map(({ student, stats }) => {
          const open = openId === student.studentId;
          return (
            <div key={student.studentId} className={cn('rounded-xl border', stats.isBelowThreshold ? 'border-rose-500/40 bg-rose-500/5' : 'border-slate-800 bg-slate-900/40')}>
              <button
                type="button"
                onClick={() => setOpenId(open ? null : student.studentId)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
              >
                {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                <span className="text-xs text-slate-500 w-14 shrink-0">{student.studentId}</span>
                <span className="flex-1 min-w-0 truncate text-sm font-bold text-white">{student.name}</span>
                <span className="hidden sm:flex items-center gap-3 text-[11px] text-slate-400 shrink-0">
                  <span>มา {stats.present}</span><span>สาย {stats.late}</span><span>ขาด {stats.absent}</span><span>ลา {stats.leave}</span>
                </span>
                <span className={cn('w-14 text-right text-sm font-black shrink-0', stats.isBelowThreshold ? 'text-rose-300' : 'text-white')}>
                  {stats.attendanceRate === null ? '—' : `${stats.attendanceRate}%`}
                </span>
              </button>
              {open && (
                <div className="px-4 pb-4 border-t border-slate-800 pt-3">
                  <StudentAttendanceDetail
                    studentId={student.studentId}
                    records={records}
                    schedules={schedules as any[]}
                    range={range}
                    onRangeChange={setRange}
                    loading={loading}
                    limitToCourseKeys={limit}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
