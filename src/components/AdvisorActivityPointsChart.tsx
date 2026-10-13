import React, { useEffect, useMemo, useState } from 'react';
import { Award } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { subscribeActiveLearningLogsForRoom } from '../services/firestoreService';
import { useCurrentSemester } from '../hooks/useCurrentSemester';
import { studentPointsTotals } from '../lib/courseRank';
import { buildRoomPointsRows } from '../lib/courseOverview';
import type { ActiveLearningRecord, Student } from '../types';

/**
 * กราฟแท่งคะแนนกิจกรรมรวมรายบุคคลของห้องที่ปรึกษา (รวมทุกวิชา ภาคเรียนปัจจุบัน) — เมนู "สถิติวิชาการ"
 * อ่านผ่าน rules ครูที่ปรึกษา (query where homeroomClass==ห้อง): เห็นเฉพาะคะแนนที่ให้หลังระบบเก็บห้องลง log
 * ไม่ใช่คะแนนความประพฤติ — ครูผู้สอนแต่ละวิชาใช้ประกอบจิตพิสัยของวิชานั้น
 */
export function AdvisorActivityPointsChart({ room, students }: { room?: string; students: Student[] }) {
  const { academicYear, term, label } = useCurrentSemester();
  const [logs, setLogs] = useState<ActiveLearningRecord[]>([]);
  useEffect(() => subscribeActiveLearningLogsForRoom(room || '', setLogs), [room]);

  const data = useMemo(
    () => buildRoomPointsRows(students, studentPointsTotals(logs, { academicYear, term })),
    [logs, students, academicYear, term],
  );
  const chartData = useMemo(
    () => data.map(d => ({ ...d, label: `${d.studentNo < Number.MAX_SAFE_INTEGER ? d.studentNo : '-'}. ${d.name}` })),
    [data],
  );
  const withPoints = data.filter(d => d.total > 0).length;

  const sum = data.reduce((n, d) => n + d.total, 0);

  return (
    <div className="bg-[#121624] border border-white/10 rounded-2xl p-5 space-y-3" data-testid="advisor-activity-points-chart">
      <div>
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Award className="w-4 h-4 text-amber-400" /> คะแนนกิจกรรมรายวิชารวมรายบุคคล (เรียงตามเลขที่) — ห้อง {room || '-'}
        </h3>
        <p className="text-[11px] text-slate-400">
          ผลรวมคะแนนกิจกรรมทุกวิชา ภาคเรียน {label} (ไม่ใช่คะแนนความประพฤติ) · แสดงเฉพาะคะแนนที่ให้หลังระบบเก็บห้องไว้กับคะแนน
        </p>
      </div>

      {!room ? (
        <div className="py-8 text-center text-xs text-slate-500">ยังไม่ได้กำหนดห้องที่ปรึกษา</div>
      ) : withPoints === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500">ยังไม่มีคะแนนกิจกรรมของนักเรียนในห้องนี้ในภาคเรียนนี้</div>
      ) : (
        <>
          <div className="text-[11px] text-slate-400">เรียงตามเลขที่ · นักเรียนที่มีคะแนน {withPoints} จาก {data.length} คน · รวม {sum} คะแนน</div>
          <div style={{ height: Math.max(180, chartData.length * 28 + 40) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" horizontal={false} />
                <XAxis type="number" allowDecimals={false} stroke="#94a3b8" fontSize={11} />
                <YAxis type="category" dataKey="label" width={170} stroke="#94a3b8" fontSize={11} />
                <Tooltip
                  cursor={{ fill: '#ffffff0d' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload as (typeof chartData)[number];
                    return (
                      <div className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-[11px] text-slate-200 shadow-lg">
                        <div className="font-bold text-white">{d.label}</div>
                        <div className="text-emerald-400 font-bold">รวม {d.total} คะแนน</div>
                        {d.byCourse.map(c => <div key={c.courseName}>{c.courseName}: {c.points}</div>)}
                      </div>
                    );
                  }}
                />
                <Bar dataKey="total" fill="#6366f1" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
