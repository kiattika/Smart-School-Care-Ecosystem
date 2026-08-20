import React, { useState, useMemo } from 'react';
import { 
  Trophy, 
  Medal, 
  Award, 
  Flame, 
  Sparkles, 
  TrendingUp, 
  Users, 
  Search, 
  Filter, 
  Star,
  CheckCircle2,
  Calendar,
  Layers
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell, 
  CartesianGrid 
} from 'recharts';
import { useStore } from '../store';
import { Student } from '../types';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

const PODIUM_COLORS = [
  '#f59e0b', // 1st: Gold (amber-500)
  '#94a3b8', // 2nd: Silver (slate-400)
  '#b45309', // 3rd: Bronze (amber-700)
  '#6366f1', // 4th+ Indigo
  '#3b82f6',
  '#10b981',
  '#ec4899',
  '#8b5cf6',
];

export const ClassroomLeaderboard: React.FC = () => {
  const { students, activeLearningPoints, activeLearningLogs, courses } = useStore();

  const [selectedRoom, setSelectedRoom] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [pointFilter, setPointFilter] = useState<'ALL' | 'POSITIVE_ONLY'>('ALL');

  // Available room options
  const roomOptions = useMemo(() => {
    const set = new Set<string>();
    students.forEach(s => {
      if (s.room) set.add(s.room.replace(/^M\./i, 'ม.'));
    });
    return Array.from(set).sort();
  }, [students]);

  // Filtered and sorted students by cumulative points
  const rankedStudents = useMemo(() => {
    return students
      .filter(s => {
        if (selectedRoom !== 'ALL') {
          const sRoom = (s.room || '').replace(/^M\./i, 'ม.');
          if (sRoom !== selectedRoom) return false;
        }
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const matchesName = (s.fullName || s.name || '').toLowerCase().includes(q);
          const matchesNick = (s.nickname || '').toLowerCase().includes(q);
          const matchesCode = (s.studentCode || s.studentId || '').toLowerCase().includes(q);
          if (!matchesName && !matchesNick && !matchesCode) return false;
        }
        const pts = activeLearningPoints[s.studentId] || 0;
        if (pointFilter === 'POSITIVE_ONLY' && pts <= 0) return false;
        return true;
      })
      .map(s => ({
        ...s,
        points: activeLearningPoints[s.studentId] || 0
      }))
      .sort((a, b) => b.points - a.points || (a.studentNo || 999) - (b.studentNo || 999));
  }, [students, activeLearningPoints, selectedRoom, searchTerm, pointFilter]);

  // Chart data: Top 10 students
  const chartData = useMemo(() => {
    return rankedStudents.slice(0, 10).map((s, index) => ({
      name: s.nickname ? `${s.nickname} (#${s.studentNo || index + 1})` : (s.name.split(' ')[0] || s.fullName.split(' ')[0]),
      fullName: s.fullName || s.name,
      points: s.points,
      rank: index + 1,
      studentId: s.studentId,
      room: s.room
    }));
  }, [rankedStudents]);

  // Statistics
  const totalPointsAwarded = useMemo(() => {
    return Object.values(activeLearningPoints).reduce((acc, p) => acc + p, 0);
  }, [activeLearningPoints]);

  const activeStudentsCount = useMemo(() => {
    return Object.values(activeLearningPoints).filter(p => p > 0).length;
  }, [activeLearningPoints]);

  const topStudent = rankedStudents[0];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Top Banner / Hero Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-amber-500/15 via-[#161f30] to-[#0f1422] border border-amber-500/30 rounded-3xl p-5 shadow-xl flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-lg">
            <Trophy className="w-8 h-8 animate-bounce" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">
              อันดับ 1 ประจำห้อง (Top Scorer)
            </span>
            <h4 className="text-base font-bold text-white truncate">
              {topStudent ? (topStudent.fullName || topStudent.name) : '-'}
            </h4>
            <p className="text-xs text-amber-400/90 font-mono font-bold mt-0.5 flex items-center gap-1.5">
              <span>🌟 {topStudent ? topStudent.points : 0} คะแนน</span>
              {topStudent?.nickname && <span className="text-slate-400">({topStudent.nickname})</span>}
            </p>
          </div>
        </div>

        <div className="bg-[#121829] border border-white/10 rounded-3xl p-5 shadow-xl flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0 shadow-lg">
            <Sparkles className="w-7 h-7" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider">
              คะแนนสะสมทั้งหมด (Total Points)
            </span>
            <h4 className="text-2xl font-black text-white font-mono">
              {totalPointsAwarded} <span className="text-xs text-slate-400 font-normal">แต้ม</span>
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              จากการร่วมกิจกรรม Active Learning ในชั้นเรียน
            </p>
          </div>
        </div>

        <div className="bg-[#121829] border border-white/10 rounded-3xl p-5 shadow-xl flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-lg">
            <Users className="w-7 h-7" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider">
              นักเรียนที่ได้รับแต้ม (Engaged Students)
            </span>
            <h4 className="text-2xl font-black text-white font-mono">
              {activeStudentsCount} <span className="text-xs text-slate-400 font-normal">/ {students.length} คน</span>
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              คิดเป็น {Math.round((activeStudentsCount / (students.length || 1)) * 100)}% ของนักเรียนทั้งหมด
            </p>
          </div>
        </div>
      </div>

      {/* Main Chart Section: Top 10 Visual Bar Chart */}
      <div className="bg-[#121829] border border-white/10 rounded-3xl p-6 shadow-2xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-indigo-500 p-0.5 flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-amber-400" />
              </div>
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                กราฟแสดงคะแนน 10 อันดับแรก (Top 10 Active Learning Points)
              </h3>
              <p className="text-xs text-slate-400">
                เปรียบเทียบระดับการมีส่วนร่วม ตอบคำถาม และผลงานกลุ่มในห้องเรียน
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 flex items-center gap-2 text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                id="select-leaderboard-room"
                value={selectedRoom}
                onChange={(e) => setSelectedRoom(e.target.value)}
                className="bg-transparent text-slate-200 font-medium focus:outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-slate-900 text-white">ทุกห้องเรียน (All Rooms)</option>
                {roomOptions.map(r => (
                  <option key={r} value={r} className="bg-slate-900 text-white">ห้อง {r}</option>
                ))}
              </select>
            </div>

            <div className="bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 flex items-center gap-2 text-xs">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <input
                id="search-leaderboard"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ค้นหาชื่อ / รหัส..."
                className="bg-transparent text-white placeholder-slate-500 focus:outline-none w-32"
              />
            </div>
          </div>
        </div>

        {/* Visual Chart */}
        {chartData.length > 0 ? (
          <div className="h-72 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 20, left: -10, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="#94a3b8" 
                  fontSize={11}
                  tickLine={false}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis 
                  stroke="#94a3b8" 
                  fontSize={11}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-950 border border-amber-500/40 p-3 rounded-2xl shadow-xl text-xs space-y-1">
                          <div className="font-bold text-amber-300 flex items-center gap-1.5">
                            <Trophy className="w-3.5 h-3.5 text-amber-400" />
                            อันดับที่ {data.rank}
                          </div>
                          <div className="font-semibold text-white">{data.fullName}</div>
                          <div className="text-slate-400 font-mono">ห้อง {data.room || '-'}</div>
                          <div className="pt-1 text-emerald-400 font-bold font-mono border-t border-white/10">
                            🌟 {data.points} คะแนนสะสม
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar 
                  dataKey="points" 
                  radius={[8, 8, 0, 0]}
                  isAnimationActive={true}
                >
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={PODIUM_COLORS[index % PODIUM_COLORS.length]} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-center py-16 text-slate-500">
            <Award className="w-12 h-12 mx-auto text-slate-600 mb-2" />
            <p className="text-sm font-semibold">ยังไม่มีข้อมูลคะแนน Active Learning สำหรับเงื่อนไขที่เลือก</p>
          </div>
        )}
      </div>

      {/* Leaderboard Table / Rankings List */}
      <div className="bg-[#121829] border border-white/10 rounded-3xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Medal className="w-5 h-5 text-amber-400" />
              ตารางจัดอันดับนักเรียน (Student Ranking Table)
            </h3>
            <p className="text-xs text-slate-400">
              รายชื่อนักเรียนเรียงตามคะแนน Active Learning
            </p>
          </div>
          <span className="text-xs font-mono px-3 py-1 bg-slate-900 text-slate-300 rounded-xl border border-white/10">
            แสดง {rankedStudents.length} คน
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-slate-400 uppercase font-mono text-[10px]">
                <th className="py-3 px-3">อันดับ (Rank)</th>
                <th className="py-3 px-3">นักเรียน (Student)</th>
                <th className="py-3 px-3">เลขที่ / ห้อง</th>
                <th className="py-3 px-3">รหัสประจำตัว</th>
                <th className="py-3 px-3 text-right">คะแนน Active Learning</th>
                <th className="py-3 px-3 text-center">ระดับผลงาน</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rankedStudents.map((student, idx) => {
                const rank = idx + 1;
                const isTop3 = rank <= 3;
                return (
                  <tr 
                    key={student.studentId}
                    className={cn(
                      "hover:bg-white/[0.03] transition-colors group",
                      rank === 1 ? "bg-amber-500/5" : rank === 2 ? "bg-slate-500/5" : rank === 3 ? "bg-orange-500/5" : ""
                    )}
                  >
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        {rank === 1 ? (
                          <div className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-black flex items-center justify-center text-xs shadow-md">
                            1
                          </div>
                        ) : rank === 2 ? (
                          <div className="w-6 h-6 rounded-full bg-slate-400 text-slate-950 font-black flex items-center justify-center text-xs shadow-md">
                            2
                          </div>
                        ) : rank === 3 ? (
                          <div className="w-6 h-6 rounded-full bg-amber-700 text-white font-black flex items-center justify-center text-xs shadow-md">
                            3
                          </div>
                        ) : (
                          <span className="font-mono text-slate-400 font-bold px-1.5">
                            #{rank}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex items-center gap-3">
                        <img 
                          src={student.avatar || student.photoUrl} 
                          alt="" 
                          className={cn(
                            "w-8 h-8 rounded-full object-cover border bg-slate-800",
                            isTop3 ? "border-amber-400 ring-2 ring-amber-400/30" : "border-slate-700"
                          )}
                        />
                        <div>
                          <div className="font-bold text-white group-hover:text-amber-300 transition-colors">
                            {student.title || ''}{student.fullName || student.name}
                          </div>
                          {student.nickname && (
                            <div className="text-[10px] text-amber-400 font-medium">
                              ชื่อเล่น: {student.nickname}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3 font-mono text-slate-300">
                      เลขที่ {student.studentNo || student.number || '-'} ({student.room || 'ม.5/8'})
                    </td>

                    <td className="py-3 px-3 font-mono text-slate-400">
                      #{student.studentCode || student.studentId}
                    </td>

                    <td className="py-3 px-3 text-right">
                      <span className={cn(
                        "font-mono font-bold px-2.5 py-1 rounded-xl text-xs inline-block",
                        student.points >= 10 ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" :
                        student.points > 0 ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40" :
                        "bg-slate-800 text-slate-500"
                      )}>
                        🌟 {student.points} แต้ม
                      </span>
                    </td>

                    <td className="py-3 px-3 text-center">
                      {student.points >= 15 ? (
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                          🌟 Master Learner
                        </span>
                      ) : student.points >= 8 ? (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                          ⚡ Active Contributor
                        </span>
                      ) : student.points > 0 ? (
                        <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold">
                          🌱 Participant
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500">
                          -
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
