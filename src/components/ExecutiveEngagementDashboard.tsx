import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Zap, Users, Award, Download, BarChart3, TrendingUp } from 'lucide-react';
import { ActiveLearningRecord, Student } from '../types';
import { cn } from '../lib/utils';
import {
  CATEGORY_LABELS, GRADE_LEVELS, computeGradeEngagement, computeWeeklyTrend, engagementToCsv,
} from '../lib/engagementStats';

interface Props {
  students: Student[];
  activeLearningPoints?: Record<string, number>;
  activeLearningLogs?: ActiveLearningRecord[];
}

const GRADE_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b', '#ec4899'];

/**
 * ภาพรวม Active Learning ของผู้บริหาร — คำนวณจาก students + active_learning_logs จริงทั้งหมด
 * (เดิมใช้จำนวนนักเรียน/แนวโน้ม/ระดับ engagement/เรดาร์ตายตัว — เอาออกแล้ว ไม่มีข้อมูล = แสดง 0)
 */
export const ExecutiveEngagementDashboard: React.FC<Props> = ({ students, activeLearningLogs = [] }) => {
  const [selectedGrade, setSelectedGrade] = useState<string>('ALL');

  const rows = useMemo(() => computeGradeEngagement(students, activeLearningLogs), [students, activeLearningLogs]);
  const trend = useMemo(() => computeWeeklyTrend(students, activeLearningLogs, new Date(), 8), [students, activeLearningLogs]);

  const shown = selectedGrade === 'ALL' ? rows : rows.filter(r => r.grade === selectedGrade);
  const totalStudents = rows.reduce((a, r) => a + r.students, 0);
  const totalParticipants = rows.reduce((a, r) => a + r.participants, 0);
  const totalPoints = rows.reduce((a, r) => a + r.totalPoints, 0);
  const participation = totalStudents > 0 ? Math.round((totalParticipants / totalStudents) * 100) : 0;
  const top = rows.filter(r => r.students > 0 && r.totalPoints > 0).sort((a, b) => b.avgPoints - a.avgPoints)[0];
  const hasLogs = activeLearningLogs.length > 0;

  const downloadCsv = () => {
    const blob = new Blob(['\uFEFF' + engagementToCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'engagement-by-grade.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const card = 'bg-[#0f1219] border border-white/10 rounded-2xl p-5 shadow-xl';

  return (
    <div className="space-y-8">
      <div className={cn(card, 'flex flex-col lg:flex-row lg:items-center justify-between gap-4')}>
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-emerald-400" /> การมีส่วนร่วมในห้องเรียนตามระดับชั้น
          </h2>
          <p className="text-sm text-slate-400 mt-1">คำนวณจากคะแนน Active Learning ที่ครูบันทึกจริง และจำนวนนักเรียนในระบบ</p>
        </div>
        <select
          value={selectedGrade}
          onChange={e => setSelectedGrade(e.target.value)}
          aria-label="ระดับชั้น"
          className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm font-bold text-white"
        >
          <option value="ALL">ทุกระดับชั้น (ม.1 - ม.6)</option>
          {GRADE_LEVELS.map(g => <option key={g} value={g}>ชั้น {g}</option>)}
        </select>
      </div>

      {!hasLogs && (
        <div className="p-4 rounded-2xl border border-dashed border-slate-700 text-sm text-slate-400">
          ยังไม่มีการบันทึกคะแนน Active Learning ในระบบ — ตัวเลขด้านล่างจะแสดงเมื่อครูเริ่มให้คะแนนในชั้นเรียน
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className={card}>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400"><Zap className="w-4 h-4 text-emerald-400" /> คะแนน Active รวม</div>
          <div className="text-3xl font-black text-white mt-2">{totalPoints.toLocaleString()} <span className="text-xs text-emerald-400">Pts</span></div>
        </div>
        <div className={card}>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400"><Users className="w-4 h-4 text-blue-400" /> อัตราการมีส่วนร่วม</div>
          <div className="text-3xl font-black text-blue-400 mt-2">{participation}%</div>
          <div className="text-xs text-slate-400 mt-1">{totalParticipants.toLocaleString()} จาก {totalStudents.toLocaleString()} คน ได้รับแต้มอย่างน้อย 1 ครั้ง</div>
        </div>
        <div className={card}>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400"><Award className="w-4 h-4 text-purple-400" /> ระดับชั้นที่แต้มเฉลี่ยสูงสุด</div>
          <div className="text-3xl font-black text-purple-300 mt-2">{top ? top.grade : '—'}</div>
          {top && <div className="text-xs text-slate-400 mt-1">เฉลี่ย {top.avgPoints} Pts/คน</div>}
        </div>
      </div>

      <div className={card}>
        <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4"><TrendingUp className="w-5 h-5 text-blue-400" /> แต้มรวมรายสัปดาห์ (8 สัปดาห์ล่าสุด)</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#0f1219', border: '1px solid #ffffff20' }} />
              <Legend />
              {GRADE_LEVELS.filter(g => selectedGrade === 'ALL' || g === selectedGrade).map(g => (
                <Line key={g} type="monotone" dataKey={g} stroke={GRADE_COLORS[GRADE_LEVELS.indexOf(g)]} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={card}>
        <h3 className="text-lg font-bold text-white mb-4">แต้มเฉลี่ยต่อคนแยกตามระดับชั้น</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={shown} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="grade" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip contentStyle={{ background: '#0f1219', border: '1px solid #ffffff20' }} />
              <Bar dataKey="avgPoints" name="แต้มเฉลี่ย/คน" fill="#10b981" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-[#0f1219] border border-white/10 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-5 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">สรุปรายระดับชั้น</h3>
          <button
            onClick={downloadCsv}
            className="bg-white/5 hover:bg-white/10 text-slate-300 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border border-white/10"
          >
            <Download className="w-4 h-4 text-emerald-400" /> ส่งออก CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="text-xs bg-black/40 text-slate-400 font-bold border-b border-white/5">
              <tr>
                <th className="px-4 py-3">ระดับชั้น</th>
                <th className="px-4 py-3 text-center">นักเรียน</th>
                <th className="px-4 py-3 text-center">คะแนนรวม</th>
                <th className="px-4 py-3 text-center">เฉลี่ย/คน</th>
                <th className="px-4 py-3 text-center">มีส่วนร่วม (%)</th>
                {Object.values(CATEGORY_LABELS).map(l => <th key={l} className="px-4 py-3 text-center">{l}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {shown.map(r => (
                <tr key={r.grade} className="hover:bg-white/5">
                  <td className="px-4 py-3 font-bold text-emerald-400">{r.grade}</td>
                  <td className="px-4 py-3 text-center">{r.students.toLocaleString()}</td>
                  <td className="px-4 py-3 text-center">{r.totalPoints.toLocaleString()}</td>
                  <td className="px-4 py-3 text-center">{r.avgPoints}</td>
                  <td className="px-4 py-3 text-center">{r.participationRate}%</td>
                  {(Object.keys(CATEGORY_LABELS) as (keyof typeof CATEGORY_LABELS)[]).map(c => (
                    <td key={c} className="px-4 py-3 text-center">{r.byCategory[c].toLocaleString()}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
