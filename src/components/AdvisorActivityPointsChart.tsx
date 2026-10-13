import React, { useEffect, useMemo, useState } from 'react';
import { Award } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { subscribeActiveLearningLogsForRoom } from '../services/firestoreService';
import { useCurrentSemester } from '../hooks/useCurrentSemester';
import { studentPointsTotals } from '../lib/courseRank';
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

  const data = useMemo(() => {
    const names = new Map(students.map(s => [s.studentId, s.nickname ? `${s.name} (${s.nickname})` : s.name]));
    return studentPointsTotals(logs, { academicYear, term })
      .filter(t => names.has(t.studentId)) // เฉพาะนักเรียนที่ยังอยู่ในห้องนี้
      .map(t => ({ ...t, name: names.get(t.studentId) as string }));
  }, [logs, students, academicYear, term]);

  const sum = data.reduce((n, d) => n + d.total, 0);

  return (
    <div className="bg-[#121624] border border-white/10 rounded-2xl p-5 space-y-3" data-testid="advisor-activity-points-chart">
      <div>
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Award className="w-4 h-4 text-amber-400" /> คะแนนกิจกรรมรายวิชารวมรายบุคคล — ห้อง {room || '-'}
        </h3>
        <p className="text-[11px] text-slate-400">
          ผลรวมคะแนนกิจกรรมทุกวิชา ภาคเรียน {label} (ไม่ใช่คะแนนความประพฤติ) · แสดงเฉพาะคะแนนที่ให้หลังระบบเก็บห้องไว้กับคะแนน
        </p>
      </div>

      {!room ? (
        <div className="py-8 text-center text-xs text-slate-500">ยังไม่ได้กำหนดห้องที่ปรึกษา</div>
      ) : data.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500">ยังไม่มีคะแนนกิจกรรมของนักเรียนในห้องนี้ในภาคเรียนนี้</div>
      ) : (
        <>
          <div className="text-[11px] text-slate-400">นักเรียนที่มีคะแนน {data.length} คน · รวม {sum} คะแนน</div>
          <div style={{ height: Math.max(180, data.length * 30 + 40) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" horizontal={false} />
                <XAxis type="number" allowDecimals={false} stroke="#94a3b8" fontSize={11} />
                <YAxis type="category" dataKey="name" width={150} stroke="#94a3b8" fontSize={11} />
                <Tooltip
                  cursor={{ fill: '#ffffff0d' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload as (typeof data)[number];
                    return (
                      <div className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-[11px] text-slate-200 shadow-lg">
                        <div className="font-bold text-white">{d.name}</div>
                        <div className="text-emerald-400 font-bold">รวม {d.total} คะแนน</div>
                        {d.byCourse.map(c => <div key={c.courseName}>{c.courseName}: {c.points}</div>)}
                      </div>
                    );
                  }}
                />
                <Bar dataKey="total" radius={[0, 6, 6, 0]}>
                  {data.map((d, i) => <Cell key={d.studentId} fill={i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#b45309' : '#6366f1'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
