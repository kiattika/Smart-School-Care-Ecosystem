import React, { useEffect, useMemo, useState } from 'react';
import { Award } from 'lucide-react';
import { subscribeActiveLearningLogsForStudent, subscribeCourseRankLevels } from '../../services/firestoreService';
import { useCurrentSemester } from '../../hooks/useCurrentSemester';
import { DEFAULT_RANK_LEVELS, rankColor, rankLabel, summarizeCoursePoints, type RankLevel } from '../../lib/courseRank';
import type { ActiveLearningRecord } from '../../types';

/**
 * คะแนนกิจกรรมรายวิชา + เครื่องหมายเชิดชูของนักเรียน (อ่านสดจาก active_learning_logs ของตัวเองเท่านั้น)
 * คะแนนต่อวิชาตลอดภาคเรียนปัจจุบัน → ระดับ (แรงค์) ตามตารางที่แอดมินตั้ง — ไม่ใช่คะแนนความประพฤติ
 */
export function CourseActivityPoints({ studentId }: { studentId: string }) {
  const [logs, setLogs] = useState<ActiveLearningRecord[]>([]);
  const [levels, setLevels] = useState<RankLevel[]>(DEFAULT_RANK_LEVELS);
  const [loaded, setLoaded] = useState(false);
  const { academicYear, term, label } = useCurrentSemester();

  useEffect(() => subscribeActiveLearningLogsForStudent(studentId, (rows) => { setLogs(rows); setLoaded(true); }), [studentId]);
  useEffect(() => subscribeCourseRankLevels(setLevels), []);

  const rows = useMemo(
    () => summarizeCoursePoints(logs, { academicYear, term }, levels),
    [logs, academicYear, term, levels],
  );

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-md shadow-xl space-y-4" data-testid="course-activity-points">
      <div>
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Award className="w-4 h-4 text-amber-400" /> คะแนนกิจกรรมและเครื่องหมายเชิดชูรายวิชา
        </h3>
        <p className="text-[11px] text-slate-400">
          คะแนนที่ได้จากการร่วมกิจกรรมในคาบของแต่ละวิชา ภาคเรียน {label} — ครูผู้สอนใช้ประกอบคะแนนจิตพิสัย (ไม่ใช่คะแนนความประพฤติ)
        </p>
      </div>

      {!loaded && <div className="py-6 text-center text-xs text-slate-500">กำลังโหลดคะแนน...</div>}
      {loaded && rows.length === 0 && (
        <div className="py-6 text-center text-xs text-slate-500">ยังไม่มีคะแนนกิจกรรมในภาคเรียนนี้</div>
      )}

      <div className="space-y-2">
        {rows.map(r => {
          const color = rankColor(r.rank.level.key);
          if (r.unassigned) {
            return (
              <div key={r.courseId} className="rounded-2xl border border-slate-800 bg-slate-800/30 p-3.5" data-testid="course-activity-row-unassigned">
                <div className="text-xs font-bold text-slate-300">ไม่ระบุวิชา</div>
                <div className="text-[10px] text-slate-500">คะแนนสะสม {r.points} คะแนน — ให้ก่อนระบบแยกรายวิชา จึงไม่นับเป็นเครื่องหมายเชิดชูของวิชาใด</div>
              </div>
            );
          }
          return (
            <div key={r.courseId} className="rounded-2xl border border-slate-800 bg-slate-800/40 p-3.5 space-y-2" data-testid="course-activity-row">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">{r.courseName}</div>
                  <div className="text-[10px] text-slate-400">คะแนนสะสม {r.points} คะแนน</div>
                </div>
                <span
                  className="shrink-0 rounded-full px-3 py-1 text-[11px] font-black border"
                  style={{ color, borderColor: color, background: `${color}1f` }}
                >
                  {rankLabel(r.rank.level)}
                </span>
              </div>
              <div>
                <div className="h-1.5 w-full rounded-full bg-slate-700 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${r.rank.progressPct}%`, background: color }} />
                </div>
                <div className="mt-1 text-[10px] text-slate-400">
                  {r.rank.next
                    ? `อีก ${r.rank.pointsToNext} คะแนน ถึงระดับ ${rankLabel(r.rank.next)}`
                    : 'ถึงระดับสูงสุดแล้ว'}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
