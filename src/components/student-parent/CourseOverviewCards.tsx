import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Award } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTeacherFirestoreSchedule } from '../../hooks/useTeacherFirestoreSchedule';
import { useCurrentSemester } from '../../hooks/useCurrentSemester';
import { buildCourseAttendanceRows, CourseAttendanceStatsMap } from '../../lib/courseAttendanceStats';
import { DEFAULT_RANK_LEVELS, rankColor, rankLabel, summarizeCoursePoints, type RankLevel } from '../../lib/courseRank';
import { buildCourseIdToCode, mergeCourseOverview } from '../../lib/courseOverview';
import { subscribeActiveLearningLogsForStudent, subscribeCourseRankLevels } from '../../services/firestoreService';
import type { ActiveLearningRecord } from '../../types';

/**
 * การ์ดรายวิชา (ใช้ร่วมกันหน้านักเรียนและผู้ปกครอง): แถวต่อวิชา — บน = สถิติเข้าเรียน, ล่าง = คะแนนกิจกรรม + เครื่องหมายเชิดชู
 * คะแนนอ่านสดจาก active_learning_logs ของนักเรียนคนนั้น (rules: นักเรียนเจ้าของ / ผู้ปกครองตัวจริง) — ไม่ใช่คะแนนความประพฤติ
 */
export function CourseOverviewCards({ studentId, room, courseStats }: {
  studentId: string;
  room?: string;
  courseStats?: CourseAttendanceStatsMap | null;
}) {
  const { schedules, loading } = useTeacherFirestoreSchedule();
  const { academicYear, term, label } = useCurrentSemester();
  const [logs, setLogs] = useState<ActiveLearningRecord[]>([]);
  const [levels, setLevels] = useState<RankLevel[]>(DEFAULT_RANK_LEVELS);
  useEffect(() => subscribeActiveLearningLogsForStudent(studentId, setLogs), [studentId]);
  useEffect(() => subscribeCourseRankLevels(setLevels), []);

  const attendance = useMemo(
    () => buildCourseAttendanceRows({ schedules: schedules as any[], studentRoom: room, studentId, courseStats }),
    [schedules, room, studentId, courseStats],
  );
  const points = useMemo(
    () => summarizeCoursePoints(logs, { academicYear, term }, levels),
    [logs, academicYear, term, levels],
  );
  // คะแนนรุ่นเก่าไม่มี courseKey — จับคู่กับวิชาด้วยรหัสวิชาจากตารางสอน (courseId = course_<scheduleId>)
  const courseIdToCode = useMemo(() => buildCourseIdToCode(schedules as any[]), [schedules]);
  const { items, unassigned } = useMemo(
    () => mergeCourseOverview(attendance, points, { courseIdToCode, levels }),
    [attendance, points, courseIdToCode, levels],
  );

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-md shadow-xl space-y-4" data-testid="course-overview-cards">
      <div>
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-indigo-400" /> สถิติการเข้าเรียนและคะแนนกิจกรรมรายวิชา
        </h3>
        <p className="text-[11px] text-slate-400">
          บน: นับจากการเช็คชื่อรายคาบของครูผู้สอน (ไม่รวมโฮมรูม) · ล่าง: คะแนนกิจกรรมในคาบและเครื่องหมายเชิดชู ภาคเรียน {label}
          {' '}(ครูผู้สอนใช้ประกอบคะแนนจิตพิสัย ไม่ใช่คะแนนความประพฤติ)
        </p>
      </div>

      {loading && <div className="py-6 text-center text-xs text-slate-500">กำลังโหลดรายวิชา...</div>}
      {!loading && items.length === 0 && (
        <div className="py-6 text-center text-xs text-slate-500">
          {room ? 'ยังไม่พบรายวิชาในตารางเรียนของห้องนี้' : 'ยังไม่ได้กำหนดห้องเรียน จึงแสดงรายวิชาไม่ได้'}
        </div>
      )}

      <div className="space-y-2">
        {items.map(it => {
          const st = it.attendance?.stats;
          const p = it.points;
          const color = p ? rankColor(p.rank.level.key) : undefined;
          return (
            <div key={it.key} data-testid="course-overview-row" className={cn(
              'rounded-2xl border overflow-hidden',
              st?.isBelowThreshold ? 'bg-red-950/30 border-red-800/50' : 'bg-slate-800/40 border-slate-800',
            )}>
              {/* แถวบน: สถิติเข้าเรียน */}
              <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">{it.name}</div>
                  <div className="text-[10px] text-slate-400 font-mono">{it.code}{it.attendance && !it.inSchedule && ' • ไม่อยู่ในตารางปัจจุบัน'}</div>
                </div>
                {!st ? null : st.totalRecorded === 0 ? (
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

              {/* แถวล่าง: คะแนนกิจกรรม + เครื่องหมายเชิดชู */}
              <div className="border-t border-slate-700/60 bg-slate-900/40 px-3.5 py-2.5" data-testid="course-overview-points">
                {p ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400">
                        <Award className="w-3.5 h-3.5" /> คะแนนกิจกรรม {p.points} คะแนน
                      </span>
                      <span className="shrink-0 rounded-full px-3 py-0.5 text-[11px] font-black border"
                        style={{ color, borderColor: color, background: `${color}1f` }}>
                        {rankLabel(p.rank.level)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-700 overflow-hidden">
                      {/* เพิ่งขึ้นระดับพอดี (0% ในระดับนี้) ยังแสดงจุดเริ่มต้นให้เห็นว่ามีแถบ */}
                      <div className="h-full rounded-full" style={{ width: `${p.rank.progressPct}%`, minWidth: p.points > 0 ? '0.5rem' : undefined, background: color }} />
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {p.rank.next ? `อีก ${p.rank.pointsToNext} คะแนน ถึงระดับ ${rankLabel(p.rank.next)}` : 'ถึงระดับสูงสุดแล้ว'}
                    </div>
                  </div>
                ) : (
                  <span className="text-[11px] text-slate-500">ยังไม่มีคะแนนกิจกรรมในภาคเรียนนี้</span>
                )}
              </div>
            </div>
          );
        })}

        {unassigned && (
          <div className="rounded-2xl border border-slate-800 bg-slate-800/30 p-3.5" data-testid="course-activity-row-unassigned">
            <div className="text-xs font-bold text-slate-300">ไม่ระบุวิชา</div>
            <div className="text-[10px] text-slate-500">คะแนนสะสม {unassigned.points} คะแนน — ให้ก่อนระบบแยกรายวิชา จึงไม่นับเป็นเครื่องหมายเชิดชูของวิชาใด</div>
          </div>
        )}
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
