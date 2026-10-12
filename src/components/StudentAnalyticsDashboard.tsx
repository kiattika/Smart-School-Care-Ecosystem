import React, { useMemo, useState } from 'react';
import { useStore } from '../store';
import { Student } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  BarChart, 
  Bar, 
  Cell,
  ScatterChart,
  Scatter,
  ZAxis,
  AreaChart,
  Area
} from 'recharts';
import { 
  TrendingUp, 
  Award, 
  AlertCircle, 
  Users, 
  Activity, 
  BookOpen, 
  CheckCircle,
  HelpCircle,
  ArrowUpRight,
  ShieldAlert,
  Download,
  Info
} from 'lucide-react';
import { cn } from '../lib/utils';
import { attendanceStatsFromCounts, defaultAttendanceDateRange } from '../lib/studentAttendanceStats';
import { useRoomAttendanceRecordsFull } from '../hooks/useRoomAttendanceRecords';

interface StudentAnalyticsDashboardProps {
  roomName: string;
  students: Student[];
}

export function StudentAnalyticsDashboard({ roomName, students }: StudentAnalyticsDashboardProps) {
  const { studentScores } = useStore();
  const [selectedInsightTab, setSelectedInsightTab] = useState<'all' | 'risk' | 'outstanding'>('all');

  // 1. ข้อมูลจริงเท่านั้น: การเข้าเรียน = ยอดสะสม students/{id}.attendanceStats, ความประพฤติ = behaviorScore,
  //    เกรด = studentScores ที่มีจริง (ไม่มี = null ไม่สร้างเกรดสุ่ม/ปลอม)
  const processedStudentsData = useMemo(() => {
    return students.map((student) => {
      const storeScores = studentScores.filter(s => s.studentId === student.studentId);
      let totalScore: number | null = null;
      let rawGrade: number | null = null;
      if (storeScores.length > 0) {
        totalScore = storeScores.reduce((sum, s) => sum + s.total, 0) / storeScores.length;
        rawGrade = storeScores.reduce((sum, s) => sum + parseFloat(s.grade || '0'), 0) / storeScores.length;
      }

      const behavior = student.behaviorScore ?? null;
      const st = attendanceStatsFromCounts(student.studentId, student.attendanceStats);
      // ยังไม่เคยเช็คชื่อเลย = ไม่มีข้อมูล (ไม่ใช่ 0% และไม่ใช่ 100%)
      const overallAttendance: number | null = st.attendanceRate !== null ? Math.round(st.attendanceRate) : null;

      return {
        ...student,
        behaviorScore: behavior,
        overallAttendance,
        rawGrade,
        gradeLabel: rawGrade !== null ? rawGrade.toFixed(1) : '-',
        totalScore,
        isAtRisk: (overallAttendance !== null && overallAttendance < 80) || (behavior !== null && behavior < 75) || (rawGrade !== null && rawGrade < 2.0)
      };
    });
  }, [students, studentScores]);

  // 2. Class KPIs (เฉลี่ยเฉพาะคนที่มีข้อมูลจริง)
  const classKPIs = useMemo(() => {
    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
    const gpas = processedStudentsData.map(s => s.rawGrade).filter((x): x is number => x !== null);
    const atts = processedStudentsData.map(s => s.overallAttendance).filter((x): x is number => x !== null);
    const behs = processedStudentsData.map(s => s.behaviorScore).filter((x): x is number => x !== null);
    const g = avg(gpas), a = avg(atts), b = avg(behs);
    return {
      avgGPA: g !== null ? g.toFixed(2) : '-',
      avgAttendance: a !== null ? Math.round(a) : null,
      avgBehavior: b !== null ? Math.round(b) : null,
      atRiskCount: processedStudentsData.filter(s => s.isAtRisk).length,
      hasGrades: gpas.length > 0,
    };
  }, [processedStudentsData]);

  // 3. Grade Distribution data (0.0 to 4.0)
  const gradeDistributionData = useMemo(() => {
    const grades = ['4.0', '3.5', '3.0', '2.5', '2.0', '1.5', '1.0', '0.0'];
    const counts = grades.reduce((acc, g) => ({ ...acc, [g]: 0 }), {} as Record<string, number>);

    processedStudentsData.forEach(s => {
      // Find closest grade bracket
      if (s.rawGrade === null) return;
      const val = s.rawGrade;
      let bracket = '3.0';
      if (val >= 4.0) bracket = '4.0';
      else if (val >= 3.5) bracket = '3.5';
      else if (val >= 3.0) bracket = '3.0';
      else if (val >= 2.5) bracket = '2.5';
      else if (val >= 2.0) bracket = '2.0';
      else if (val >= 1.5) bracket = '1.5';
      else if (val >= 1.0) bracket = '1.0';
      else bracket = '0.0';

      counts[bracket] = (counts[bracket] || 0) + 1;
    });

    return grades.map(g => ({
      name: `เกรด ${g}`,
      'จำนวนนักเรียน': counts[g],
      rawGrade: parseFloat(g)
    }));
  }, [processedStudentsData]);

  // 4. เทรนด์รายสัปดาห์จาก attendance_records จริง 8 สัปดาห์ล่าสุด (สัปดาห์ที่ไม่มีการเช็คชื่อ = ไม่มีจุดข้อมูล)
  const trendRange = useMemo(() => defaultAttendanceDateRange(56), []);
  const { records: trendRecords } = useRoomAttendanceRecordsFull(roomName && roomName !== 'No Room' ? [roomName] : [], trendRange);
  const attendanceTrendData = useMemo(() => {
    const ids = new Set(students.map(s => s.studentId));
    const endMs = new Date(trendRange.end + 'T00:00:00').getTime();
    const weeks = Array.from({ length: 8 }, () => ({ present: 0, late: 0, off: 0 }));
    for (const rec of trendRecords) {
      const wk = Math.floor((endMs - new Date(rec.date + 'T00:00:00').getTime()) / (7 * 86400000));
      if (wk < 0 || wk > 7) continue;
      const bucket = weeks[7 - wk];
      for (const [sid, st] of Object.entries(rec.students || {})) {
        if (!ids.has(sid)) continue;
        if (st === 'PRESENT') bucket.present++;
        else if (st === 'LATE') bucket.late++;
        else if (st === 'ABSENT' || st === 'LEAVE') bucket.off++;
      }
    }
    return weeks.map((w, i) => {
      const t = w.present + w.late + w.off;
      const pct = (n: number) => (t ? Math.round((n / t) * 100) : null);
      return { name: `สัปดาห์ ${i + 1}`, 'มาเรียนปกติ': pct(w.present), 'มาสาย': pct(w.late), 'ขาด/ลา': pct(w.off) };
    });
  }, [trendRecords, students, trendRange]);

  const scatterData = useMemo(() => processedStudentsData.filter(s => s.behaviorScore !== null && s.overallAttendance !== null), [processedStudentsData]);

  // Grade category colors
  const getGradeBarColor = (gradeLabel: string) => {
    const val = parseFloat(gradeLabel);
    if (val >= 3.5) return '#10b981'; // Green (Excellent)
    if (val >= 2.5) return '#6366f1'; // Indigo (Good)
    if (val >= 1.5) return '#f59e0b'; // Amber (Average)
    return '#f43f5e'; // Rose (Needs improvement)
  };

  // Filtered insights list
  const filteredInsights = useMemo(() => {
    let list = [...processedStudentsData];
    if (selectedInsightTab === 'risk') {
      list = list.filter(s => s.isAtRisk);
    } else if (selectedInsightTab === 'outstanding') {
      list = list.filter(s => s.rawGrade !== null && s.rawGrade >= 3.5);
    }
    return list.sort((a, b) => (b.totalScore ?? -1) - (a.totalScore ?? -1));
  }, [processedStudentsData, selectedInsightTab]);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header Info Area */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#1c1f2b] border border-white/10 rounded-2xl p-6 shadow-xl"
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs bg-purple-500/20 text-purple-400 border border-purple-500/30 px-2.5 py-1 rounded-full font-bold">
              รายงานระบบสารสนเทศ
            </span>
            <span className="text-xs bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-2.5 py-1 rounded-full font-bold">
              เรียลไทม์
            </span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            วิเคราะห์ข้อมูลและผลสัมฤทธิ์ทางการเรียน ห้อง {roomName}
          </h2>
          <p className="text-slate-400 text-sm">
            แดชบอร์ดติดตามความก้าวหน้า อัตราการเข้าเรียน เกรดเฉลี่ย และการเฝ้าระวังความเสี่ยงของนักเรียนในที่ปรึกษา
          </p>
        </div>

        <button 
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md shrink-0 self-start md:self-auto hover:scale-105 active:scale-95"
        >
          <Download className="w-4 h-4" />
          ส่งออกรายงาน PDF / สั่งพิมพ์
        </button>
      </motion.div>

      {/* KPI Cards Grid */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {/* GPA Card */}
        <motion.div variants={itemVariants} className="bg-[#1c1f2b] border border-white/10 rounded-2xl p-4 flex items-center gap-4 shadow-lg hover:border-indigo-500/30 hover:scale-[1.02] transition-all">
          <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400 shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] text-slate-400 block font-medium">เกรดเฉลี่ยห้อง (GPAX)</span>
            <span className="text-xl md:text-2xl font-bold text-white leading-none block mt-1">
              {classKPIs.avgGPA}
            </span>
            {!classKPIs.hasGrades && (
              <span className="text-[10px] text-slate-500 flex items-center gap-0.5 mt-1">ยังไม่มีข้อมูลผลการเรียนในระบบ</span>
            )}
          </div>
        </motion.div>

        {/* Attendance Card */}
        <motion.div variants={itemVariants} className="bg-[#1c1f2b] border border-white/10 rounded-2xl p-4 flex items-center gap-4 shadow-lg hover:border-emerald-500/30 hover:scale-[1.02] transition-all">
          <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400 shrink-0">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] text-slate-400 block font-medium">อัตราการเข้าเรียนเฉลี่ย</span>
            <span className="text-xl md:text-2xl font-bold text-white leading-none block mt-1">
              {classKPIs.avgAttendance !== null ? `${classKPIs.avgAttendance}%` : '-'}
            </span>
            <span className="text-[10px] text-slate-500 flex items-center gap-0.5 mt-1">ยอดสะสมจากการเช็คชื่อจริง</span>
          </div>
        </motion.div>

        {/* Behavior Card */}
        <motion.div variants={itemVariants} className="bg-[#1c1f2b] border border-white/10 rounded-2xl p-4 flex items-center gap-4 shadow-lg hover:border-purple-500/30 hover:scale-[1.02] transition-all">
          <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-400 shrink-0">
            <Activity className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] text-slate-400 block font-medium">คะแนนความประพฤติเฉลี่ย</span>
            <span className="text-xl md:text-2xl font-bold text-white leading-none block mt-1">
              {classKPIs.avgBehavior ?? '-'} <span className="text-xs font-normal text-slate-400">/ 100</span>
            </span>
            <span className="text-[10px] text-slate-500 flex items-center gap-0.5 mt-1">จากคะแนนความประพฤติของนักเรียน</span>
          </div>
        </motion.div>

        {/* Risk Card */}
        <motion.div variants={itemVariants} className="bg-[#1c1f2b] border border-white/10 rounded-2xl p-4 flex items-center gap-4 shadow-lg hover:border-rose-500/30 hover:scale-[1.02] transition-all">
          <div className="w-12 h-12 bg-rose-500/10 rounded-xl flex items-center justify-center text-rose-400 shrink-0">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] text-slate-400 block font-medium">นักเรียนกลุ่มเสี่ยง (ต้องดูแล)</span>
            <span className="text-xl md:text-2xl font-bold text-rose-400 leading-none block mt-1">
              {classKPIs.atRiskCount} <span className="text-xs font-normal text-slate-400">คน</span>
            </span>
            <span className="text-[10px] text-slate-500 flex items-center gap-0.5 mt-1">เข้าเรียน &lt;80% หรือความประพฤติ &lt;75 หรือเกรด &lt;2.0</span>
          </div>
        </motion.div>
      </motion.div>

      {/* Charts Layout (Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Card 1: Attendance Trends (AreaChart) */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="bg-[#1c1f2b] border border-white/10 rounded-2xl p-5 shadow-lg flex flex-col"
        >
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="font-bold text-white text-base">เทรนด์การเช็คชื่อเข้าชั้นเรียนและโฮมรูม</h3>
              <p className="text-slate-400 text-xs mt-0.5">สัดส่วนจากบันทึกการเช็คชื่อจริง 8 สัปดาห์ล่าสุด (สัปดาห์ที่ไม่มีการเช็คชื่อจะไม่มีข้อมูล)</p>
            </div>
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
          </div>
          
          <div className="h-[300px] w-full flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={attendanceTrendData as any[]} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorAbsent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2e3f" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} domain={[0, 100]} unit="%" tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f111a', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px' }}
                  labelClassName="font-bold text-white"
                />
                <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Area type="monotone" dataKey="มาเรียนปกติ" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorPresent)" activeDot={{ r: 6 }} />
                <Area type="monotone" dataKey="ขาด/ลา" stroke="#f43f5e" strokeWidth={1.5} fillOpacity={1} fill="url(#colorAbsent)" strokeDasharray="3 3" />
                <Area type="monotone" dataKey="มาสาย" stroke="#f59e0b" strokeWidth={2} fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Card 2: Grade Distributions (BarChart) */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.15 }}
          className="bg-[#1c1f2b] border border-white/10 rounded-2xl p-5 shadow-lg flex flex-col"
        >
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="font-bold text-white text-base">สัดส่วนผลสัมฤทธิ์ทางการเรียนห้อง {roomName}</h3>
              <p className="text-slate-400 text-xs mt-0.5">การกระจายตัวของเกรดเฉลี่ยจากผลการเรียนที่บันทึกในระบบ</p>
            </div>
            <BookOpen className="w-5 h-5 text-indigo-400" />
          </div>

          <div className="h-[300px] w-full flex-1 min-h-[300px]">
            {!classKPIs.hasGrades ? (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm text-center px-6">ยังไม่มีข้อมูลผลการเรียนของนักเรียนห้องนี้ในระบบ</div>
            ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gradeDistributionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2e3f" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f111a', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px' }}
                  cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                />
                <Bar dataKey="จำนวนนักเรียน" radius={[6, 6, 0, 0]} maxBarSize={45}>
                  {gradeDistributionData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={getGradeBarColor(entry.name.split(' ')[1])} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            )}
          </div>
        </motion.div>
      </div>

      {/* Card 3: Scatter Plot & Student List Side-by-side */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Scatter Correlation Chart */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.2 }}
          className="xl:col-span-1 bg-[#1c1f2b] border border-white/10 rounded-2xl p-5 shadow-lg flex flex-col"
        >
          <div className="mb-4">
            <h3 className="font-bold text-white text-base">พฤติกรรม VS การเข้าห้องเรียน</h3>
            <p className="text-slate-400 text-xs mt-0.5">ความสัมพันธ์แบบวิเคราะห์ 2 แกนเพื่อค้นหานักเรียนที่มีปัญหาสภาพแวดล้อม</p>
          </div>

          <div className="h-[280px] w-full flex-1 min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2e3f" />
                <XAxis 
                  type="number" 
                  dataKey="behaviorScore" 
                  name="คะแนนพฤติกรรม" 
                  stroke="#64748b" 
                  fontSize={10} 
                  domain={[30, 110]}
                  unit=" คะแนน"
                />
                <YAxis 
                  type="number" 
                  dataKey="overallAttendance" 
                  name="การเข้าเรียน" 
                  stroke="#64748b" 
                  fontSize={10} 
                  domain={[40, 105]}
                  unit="%"
                />
                <Tooltip 
                  cursor={{ strokeDasharray: '3 3' }} 
                  contentStyle={{ backgroundColor: '#0f111a', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '11px' }}
                  formatter={(value: any, name: string) => {
                    return [`${value}`, name];
                  }}
                />
                <Scatter 
                  name="นักเรียนในห้อง" 
                  data={scatterData} 
                  fill="#6366f1"
                >
                  {scatterData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.isAtRisk ? '#f43f5e' : entry.rawGrade !== null && entry.rawGrade >= 3.5 ? '#10b981' : '#6366f1'} 
                      r={entry.isAtRisk ? 8 : 6}
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          {/* Scatter Legend */}
          <div className="mt-4 pt-4 border-t border-white/5 flex justify-center gap-4 text-xs font-medium">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> ผลงานเด่น (GPAX ≥ 3.5)
            </span>
            <span className="flex items-center gap-1.5 text-indigo-400">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span> ปกติ
            </span>
            <span className="flex items-center gap-1.5 text-rose-400 font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span> เฝ้าระวัง / เสี่ยง
            </span>
          </div>
        </motion.div>

        {/* Detailed Insights list */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.25 }}
          className="xl:col-span-2 bg-[#1c1f2b] border border-white/10 rounded-2xl p-5 shadow-lg flex flex-col"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="font-bold text-white text-base">บทวิเคราะห์แบบรายบุคคล (Insights Panel)</h3>
              <p className="text-slate-400 text-xs mt-0.5">จำแนกกลุ่มตามความประพฤติและวิชาการเพื่อทำแคมเปญช่วยเหลือ</p>
            </div>

            {/* Insight Filter Tabs */}
            <div className="flex bg-black/40 border border-white/10 rounded-lg p-1 text-xs font-bold">
              <button 
                onClick={() => setSelectedInsightTab('all')}
                className={cn("px-3 py-1.5 rounded-md transition-all relative", selectedInsightTab === 'all' ? "bg-indigo-500/20 text-indigo-400" : "text-slate-400 hover:text-slate-200")}
              >
                ทั้งหมด ({processedStudentsData.length})
              </button>
              <button 
                onClick={() => setSelectedInsightTab('risk')}
                className={cn("px-3 py-1.5 rounded-md transition-all relative", selectedInsightTab === 'risk' ? "bg-rose-500/20 text-rose-400" : "text-slate-400 hover:text-slate-200")}
              >
                กลุ่มเสี่ยง ({processedStudentsData.filter(s => s.isAtRisk).length})
              </button>
              <button 
                onClick={() => setSelectedInsightTab('outstanding')}
                className={cn("px-3 py-1.5 rounded-md transition-all relative", selectedInsightTab === 'outstanding' ? "bg-emerald-500/20 text-emerald-400" : "text-slate-400 hover:text-slate-200")}
              >
                ผลงานเด่น ({processedStudentsData.filter(s => s.rawGrade !== null && s.rawGrade >= 3.5).length})
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[300px] divide-y divide-white/5 pr-1 space-y-2">
            <AnimatePresence mode="wait">
              <motion.div 
                key={selectedInsightTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-2"
              >
                {filteredInsights.length > 0 ? (
                  filteredInsights.map((student) => (
                    <div key={student.id} className="py-2.5 flex items-center justify-between gap-4 text-sm group hover:bg-white/[0.02] px-2 rounded-xl transition-colors">
                      <div className="flex items-center gap-3">
                        <img src={student.avatar} className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700" alt="" />
                        <div>
                          <div className="font-bold text-slate-200 group-hover:text-indigo-400 transition-colors">
                            เลขที่ {student.studentNo} — {student.name}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                            <span>ID: {student.studentId}</span>
                            <span>•</span>
                            <span className={cn(
                              (student.behaviorScore ?? 100) >= 80 ? "text-slate-400" : "text-amber-400 font-semibold"
                            )}>พฤติกรรม: {student.behaviorScore ?? '-'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-right">
                        <div>
                          <div className="text-[10px] text-slate-400">อัตราเข้าเรียน</div>
                          <div className={cn(
                            "font-mono font-bold text-xs",
                            student.overallAttendance === null ? "text-slate-500" : student.overallAttendance >= 90 ? "text-emerald-400" : student.overallAttendance >= 80 ? "text-amber-400" : "text-rose-400"
                          )}>
                            {student.overallAttendance !== null ? `${student.overallAttendance}%` : '-'}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] text-slate-400">เกรดเฉลี่ย</div>
                          <div className={cn(
                            "font-bold text-sm",
                            student.rawGrade === null ? "text-slate-500" : student.rawGrade >= 3.5 ? "text-emerald-400" : student.rawGrade >= 2.0 ? "text-slate-200" : "text-rose-400"
                          )}>
                            {student.gradeLabel}
                          </div>
                        </div>

                        <div className="w-20 text-center shrink-0">
                          {student.isAtRisk ? (
                            <span className="text-[10px] bg-rose-500/15 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded font-bold">
                              ควรช่วยเหลือ
                            </span>
                          ) : student.rawGrade !== null && student.rawGrade >= 3.5 ? (
                            <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-bold">
                              เกียรติคุณ
                            </span>
                          ) : (
                            <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-bold">
                              ปกติ
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10 text-slate-500 text-sm">
                    ไม่พบนักเรียนในหมวดหมู่นี้
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>

      </div>
    </motion.div>
  );
}
