import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from 'recharts';
import {
  Award, Users, TrendingUp, Calendar, Clock, FileDown, AlertTriangle, Info,
  CheckCircle, User, Activity, Layers, FileText, ShieldAlert, Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store';
import { cn } from '../lib/utils';
import { SubstituteAssignment } from '../types';
import { DEPARTMENTS } from './StaffRoleManagementPage';

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#14b8a6', '#f43f5e'];

interface SubRecord {
  id: string;
  date: string;
  monthIdx: number;
  courseCode: string;
  courseName: string;
  room: string;
  period: string;
  originalTeacherName: string;
  substituteTeacherName: string;
  substituteTeacherEmail: string;
  departmentId: string;
  departmentName: string;
  isLogged: boolean;
  isLate: boolean;
  triggerType: string;
}

function toRecord(sa: SubstituteAssignment): SubRecord {
  const monthIdx = sa.date ? parseInt(sa.date.split('-')[1], 10) - 1 : 0;
  return {
    id: sa.id,
    date: sa.date,
    monthIdx: Number.isFinite(monthIdx) ? monthIdx : 0,
    courseCode: sa.courseCode || '',
    courseName: sa.courseName || 'รายวิชา',
    room: sa.room || '',
    period: sa.periodName || sa.schedule || '',
    originalTeacherName: sa.originalTeacherName || sa.originalTeacherEmail || '',
    substituteTeacherName: sa.substituteTeacherName || sa.substituteTeacherEmail || '',
    substituteTeacherEmail: (sa.substituteTeacherEmail || '').toLowerCase(),
    departmentId: sa.departmentId || '',
    departmentName: sa.departmentName || DEPARTMENTS.find(d => d.id === sa.departmentId)?.name || 'ไม่ระบุกลุ่มสาระฯ',
    isLogged: !!sa.isCompleted,
    isLate: !!sa.isLate,
    triggerType: sa.triggerType || '',
  };
}

export function SubstituteTeachingAnalyticsModule() {
  const user = useStore(s => s.user);
  const substituteAssignments = useStore(s => s.substituteAssignments);
  const staffDirectory = useStore(s => s.staffDirectory);

  const isDev = import.meta.env.DEV;

  const records = useMemo<SubRecord[]>(
    () => substituteAssignments.filter(sa => sa.status === 'APPROVED').map(toRecord),
    [substituteAssignments]
  );

  const [activeTab, setActiveTab] = useState<'TEACHER' | 'HOD' | 'EXECUTIVE'>('TEACHER');

  // persona: DEV = simulator select, PROD = ผู้ใช้จริง
  const [simTeacherEmail, setSimTeacherEmail] = useState('');
  const [simDeptId, setSimDeptId] = useState(DEPARTMENTS[0]?.id || '');

  const myEmail = (user?.email || '').toLowerCase();
  const myProfile = staffDirectory.find(s => s.email?.toLowerCase() === myEmail);
  const teacherEmail = (isDev && simTeacherEmail ? simTeacherEmail : myEmail).toLowerCase();
  const deptId = isDev ? simDeptId : (myProfile?.assignments?.departmentId || '');

  const teacherProfile = staffDirectory.find(s => s.email?.toLowerCase() === teacherEmail);
  const teacherName = teacherProfile
    ? `${teacherProfile.prefix || ''}${teacherProfile.firstName} ${teacherProfile.lastName}`.trim()
    : (user?.displayName || teacherEmail || '-');

  const deptName = DEPARTMENTS.find(d => d.id === deptId)?.name || 'ไม่ระบุกลุ่มสาระฯ';

  // --- filters (HOD) ---
  const [hodTeacherFilter, setHodTeacherFilter] = useState('ALL');
  const [hodStart, setHodStart] = useState('');
  const [hodEnd, setHodEnd] = useState('');

  const [exportOpen, setExportOpen] = useState(false);

  // ---------------- TEACHER ----------------
  const teacherRecords = useMemo(
    () => records.filter(r => r.substituteTeacherEmail === teacherEmail),
    [records, teacherEmail]
  );
  const nowMonthIdx = new Date().getMonth();
  const teacherKPIs = useMemo(() => {
    const cumulative = teacherRecords.length;
    const currentMonth = teacherRecords.filter(r => r.monthIdx === nowMonthIdx).length;
    const logged = teacherRecords.filter(r => r.isLogged).length;
    return { cumulative, currentMonth, logged, pending: cumulative - logged, late: teacherRecords.filter(r => r.isLate).length };
  }, [teacherRecords, nowMonthIdx]);

  // ---------------- HOD ----------------
  const deptTeachers = useMemo(
    () => staffDirectory.filter(s => s.assignments?.departmentId === deptId),
    [staffDirectory, deptId]
  );
  const deptRecords = useMemo(() => records.filter(r => r.departmentId === deptId), [records, deptId]);
  const deptWorkload = useMemo(() => {
    return deptTeachers.map(t => ({
      name: `${t.firstName} ${t.lastName}`.trim() || t.email,
      email: (t.email || '').toLowerCase(),
      hours: deptRecords.filter(r => r.substituteTeacherEmail === (t.email || '').toLowerCase()).length,
    })).sort((a, b) => b.hours - a.hours);
  }, [deptTeachers, deptRecords]);
  const deptStats = useMemo(() => {
    const total = deptRecords.length;
    const avg = deptTeachers.length > 0 ? Number((total / deptTeachers.length).toFixed(1)) : 0;
    return { total, avg, threshold: avg + 1.5 };
  }, [deptRecords, deptTeachers]);
  const hodFiltered = useMemo(() => deptRecords.filter(r => {
    const okT = hodTeacherFilter === 'ALL' || r.substituteTeacherEmail === hodTeacherFilter;
    const okS = !hodStart || r.date >= hodStart;
    const okE = !hodEnd || r.date <= hodEnd;
    return okT && okS && okE;
  }), [deptRecords, hodTeacherFilter, hodStart, hodEnd]);

  // ---------------- EXECUTIVE ----------------
  const execKPIs = useMemo(() => {
    const total = records.length;
    const logged = records.filter(r => r.isLogged).length;
    const late = records.filter(r => r.isLate).length;
    const deptCounts: Record<string, number> = {};
    records.forEach(r => { deptCounts[r.departmentName] = (deptCounts[r.departmentName] || 0) + 1; });
    const topDept = Object.entries(deptCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
    const uniqueTeachers = new Set(records.map(r => r.substituteTeacherEmail)).size;
    return {
      total, logged, late,
      loggedRate: total > 0 ? ((logged / total) * 100).toFixed(0) : '0',
      topDept: topDept.replace('กลุ่มสาระฯ ', '').replace('กลุ่มสาระการเรียนรู้', ''),
      uniqueTeachers,
    };
  }, [records]);
  const deptPie = useMemo(() => {
    const m: Record<string, number> = {};
    records.forEach(r => {
      const k = r.departmentName.replace('กลุ่มสาระฯ ', '').replace('กลุ่มสาระการเรียนรู้', '');
      m[k] = (m[k] || 0) + 1;
    });
    return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [records]);
  const monthlyTrend = useMemo(() => {
    const monthsSet = new Set<number>();
    records.forEach(r => monthsSet.add(r.monthIdx));
    const present = Array.from(monthsSet).sort((a, b) => a - b);
    const months: number[] = present.length ? present : [nowMonthIdx];
    return months.map(mi => ({
      month: THAI_MONTHS[mi] || `เดือน ${mi + 1}`,
      'คาบสอนแทน': records.filter(r => r.monthIdx === mi).length,
      'บันทึกแล้ว': records.filter(r => r.monthIdx === mi && r.isLogged).length,
    }));
  }, [records, nowMonthIdx]);
  const leaderboard = useMemo(() => {
    const m: Record<string, { name: string; dept: string; count: number }> = {};
    records.forEach(r => {
      if (!m[r.substituteTeacherEmail]) m[r.substituteTeacherEmail] = { name: r.substituteTeacherName, dept: r.departmentName.replace('กลุ่มสาระฯ ', ''), count: 0 };
      m[r.substituteTeacherEmail].count += 1;
    });
    return Object.values(m).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [records]);

  // ---------------- CSV export (จริง — Blob download) ----------------
  const exportCsv = (rows: SubRecord[], filename: string) => {
    const header = ['วันที่', 'คาบ', 'รหัสวิชา', 'รายวิชา', 'ห้อง', 'ครูที่ลา', 'ครูสอนแทน', 'กลุ่มสาระฯ', 'บันทึกหลังสอน', 'สถานะเวลา'];
    const body = rows.map(r => [
      r.date, r.period, r.courseCode, r.courseName, r.room, r.originalTeacherName,
      r.substituteTeacherName, r.departmentName,
      r.isLogged ? 'บันทึกแล้ว' : 'ยังไม่บันทึก',
      r.isLate ? 'เกินกำหนด' : (r.isLogged ? 'ตรงเวลา' : '-'),
    ]);
    const csv = [header, ...body].map(line => line.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setExportOpen(false);
  };

  const emptyState = (msg: string) => (
    <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-12 text-center text-slate-500">
      <Info className="w-10 h-10 text-slate-600 mx-auto mb-3" />
      <p className="text-sm font-semibold">{msg}</p>
      <p className="text-xs text-slate-600 mt-1">ข้อมูลจะปรากฏเมื่อมีการจัดครูสอนแทนที่อนุมัติครบ 4 ขั้นในระบบ</p>
    </div>
  );

  return (
    <div className="w-full bg-[#0a0f18] text-slate-100 min-h-screen font-sans">
      {/* HEADER */}
      <div className="bg-slate-950/40 border-b border-slate-800/80 py-5 px-6">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded text-[10px] font-black tracking-widest flex items-center gap-1 w-max">
              <Activity className="w-3 h-3" /> ANALYTICS · ข้อมูลจริงจาก Firestore
            </span>
            <h1 className="text-xl font-black text-white tracking-tight">
              สรุปภาระงานสอนแทน & KPI/PA <span className="text-indigo-400 font-medium text-sm">| Substitute Analytics</span>
            </h1>
          </div>
          <div className="bg-slate-900/90 border border-slate-800 p-1 rounded-xl flex self-start lg:self-center">
            {([['TEACHER', 'ครูรายคน', User], ['HOD', 'หัวหน้ากลุ่มสาระฯ', Users], ['EXECUTIVE', 'ผู้บริหาร', Award]] as const).map(([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5',
                  activeTab === id ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                )}
              >
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* DEV simulator selectors */}
      {isDev && (
        <div className="max-w-7xl mx-auto px-6 mt-4">
          <div className="bg-amber-500/5 border border-amber-500/20 p-3 px-4 rounded-xl flex flex-wrap items-center gap-3 text-xs text-amber-300">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span className="font-bold">DEV SIMULATOR (ไม่แสดงใน production):</span>
            {activeTab === 'TEACHER' && (
              <select value={simTeacherEmail} onChange={e => setSimTeacherEmail(e.target.value)}
                className="bg-slate-950 text-slate-200 border border-amber-500/20 rounded-lg p-1 px-2 text-[11px] font-semibold outline-none">
                <option value="">— บัญชีที่ล็อกอิน ({user?.email || '?'}) —</option>
                {staffDirectory.map(s => <option key={s.id} value={s.email}>{s.firstName} {s.lastName}</option>)}
              </select>
            )}
            {activeTab === 'HOD' && (
              <select value={simDeptId} onChange={e => { setSimDeptId(e.target.value); setHodTeacherFilter('ALL'); }}
                className="bg-slate-950 text-slate-200 border border-amber-500/20 rounded-lg p-1 px-2 text-[11px] font-semibold outline-none">
                {DEPARTMENTS.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            )}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 mt-6 pb-12">
        <AnimatePresence mode="wait">
          {/* ============ TEACHER ============ */}
          {activeTab === 'TEACHER' && (
            <motion.div key="teacher" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-lg font-bold">
                    {teacherName.charAt(0) || '?'}
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-white">{teacherName}</h2>
                    <p className="text-xs text-slate-400 mt-1">
                      {teacherProfile?.position || 'ครูผู้สอน'}
                      {teacherProfile?.assignments?.departmentId ? ` · ${DEPARTMENTS.find(d => d.id === teacherProfile.assignments?.departmentId)?.name}` : ''}
                    </p>
                  </div>
                </div>
                <button onClick={() => setExportOpen(true)} disabled={teacherRecords.length === 0}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center gap-2 shrink-0">
                  <FileDown className="w-4 h-4" /> ส่งออกรายงาน PA (CSV)
                </button>
              </div>

              {teacherRecords.length === 0 ? emptyState('ยังไม่มีประวัติปฏิบัติการสอนแทนของครูท่านนี้') : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: 'ภาระงานสะสม (ภาคเรียนนี้)', value: teacherKPIs.cumulative, unit: 'คาบ', color: 'text-indigo-400', Icon: Award },
                      { label: 'คาบสอนแทนเดือนนี้', value: teacherKPIs.currentMonth, unit: 'คาบ', color: 'text-emerald-400', Icon: Calendar },
                      { label: 'ส่งบันทึกหลังสอนแล้ว', value: teacherKPIs.logged, unit: 'คาบ', color: 'text-blue-400', Icon: CheckCircle },
                      { label: 'ค้างบันทึก / เกินกำหนด', value: `${teacherKPIs.pending}/${teacherKPIs.late}`, unit: '', color: 'text-amber-400', Icon: Clock },
                    ].map(k => (
                      <div key={k.label} className="bg-[#0f1422] border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
                        <k.Icon className="w-14 h-14 absolute top-0 right-0 opacity-5" />
                        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{k.label}</span>
                        <div className={cn('text-3xl font-black mt-2 font-mono', k.color)}>{k.value} <span className="text-sm text-slate-400 font-medium">{k.unit}</span></div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-[#0f1422] border border-slate-800/80 rounded-2xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-800/80 flex justify-between items-center bg-slate-950/20">
                      <h3 className="text-sm font-extrabold text-white flex items-center gap-2"><FileText className="w-4 h-4 text-indigo-400" /> ประวัติปฏิบัติการสอนแทน</h3>
                      <span className="bg-slate-800 text-slate-300 border border-slate-700 px-2.5 py-0.5 rounded text-[10px] font-bold font-mono">{teacherRecords.length} คาบ</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950/60 text-slate-300 font-bold border-b border-slate-800/60">
                          <tr>
                            <th className="px-6 py-3.5">วันที่</th><th className="px-6 py-3.5">คาบ</th><th className="px-6 py-3.5">รายวิชา</th>
                            <th className="px-6 py-3.5">ห้อง</th><th className="px-6 py-3.5">แทนครู</th><th className="px-6 py-3.5">บันทึกหลังสอน</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 text-slate-300">
                          {teacherRecords.slice().sort((a, b) => b.date.localeCompare(a.date)).map(r => (
                            <tr key={r.id} className="hover:bg-slate-900/30">
                              <td className="px-6 py-3.5 font-mono">{r.date}</td>
                              <td className="px-6 py-3.5 text-slate-400">{r.period}</td>
                              <td className="px-6 py-3.5"><span className="font-bold text-white">{r.courseCode}</span> <span className="text-slate-400">{r.courseName}</span></td>
                              <td className="px-6 py-3.5 font-mono text-indigo-400">{r.room}</td>
                              <td className="px-6 py-3.5">{r.originalTeacherName}</td>
                              <td className="px-6 py-3.5">
                                {r.isLogged ? (
                                  <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold border w-max flex items-center gap-1',
                                    r.isLate ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20')}>
                                    {r.isLate ? 'บันทึกช้า' : 'บันทึกแล้ว'}
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-slate-700/30 text-slate-400 border-slate-600 w-max">รอบันทึก</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* ============ HOD ============ */}
          {activeTab === 'HOD' && (
            <motion.div key="hod" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-6">
              <div className="bg-[#111827]/80 border border-amber-500/10 p-3 px-4 rounded-xl text-xs text-amber-300 font-bold">
                กลุ่มสาระฯ ที่กำลังดู: {deptName} · ครูในสังกัด {deptTeachers.length} คน
              </div>
              {deptRecords.length === 0 ? emptyState('ยังไม่มีข้อมูลการสอนแทนในกลุ่มสาระฯ นี้') : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-[#0f1422] border border-slate-800/80 p-5 rounded-2xl md:col-span-2 space-y-4">
                      <h4 className="text-sm font-extrabold text-white">ภาระงานสอนแทนรายบุคคลในกลุ่มสาระฯ</h4>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={deptWorkload} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                            <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                            <Tooltip contentStyle={{ backgroundColor: '#090d16', borderColor: '#334155' }} labelStyle={{ color: '#fff' }} />
                            <Bar dataKey="hours" name="คาบสอนแทนสะสม" radius={[4, 4, 0, 0]}>
                              {deptWorkload.map((e, i) => <Cell key={i} fill={e.hours > deptStats.threshold ? '#f59e0b' : '#6366f1'} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className="bg-[#0f1422] border border-slate-800/80 p-5 rounded-2xl space-y-4">
                      <div><span className="text-[10px] text-slate-500 uppercase">รวมคาบสอนแทนสะสม</span>
                        <div className="text-4xl font-black text-indigo-400 font-mono">{deptStats.total}</div></div>
                      <div><span className="text-[10px] text-slate-500 uppercase">เฉลี่ยต่อคน</span>
                        <div className="text-2xl font-black text-emerald-400 font-mono">{deptStats.avg}</div></div>
                      <div className="border-t border-slate-800/80 pt-3">
                        {deptWorkload.some(e => e.hours > deptStats.threshold) ? (
                          <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 p-3 rounded-xl text-[11px] space-y-1">
                            <div className="flex items-center gap-1.5 font-bold"><AlertTriangle className="w-4 h-4" /> ภาระงานเกินสมดุล</div>
                            {deptWorkload.filter(e => e.hours > deptStats.threshold).map(e => (
                              <div key={e.email} className="flex justify-between"><span>• {e.name}</span><span className="font-bold">{e.hours} คาบ</span></div>
                            ))}
                          </div>
                        ) : (
                          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 p-3 rounded-xl text-[11px] flex items-center gap-1.5">
                            <CheckCircle className="w-4 h-4" /> การกระจายภาระงานเป็นไปตามเกณฑ์เท่าเทียม
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#0f1422] border border-slate-800/80 rounded-2xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-800/80 bg-slate-950/20 flex flex-wrap items-center gap-3">
                      <h3 className="text-sm font-extrabold text-white flex items-center gap-2"><FileText className="w-4 h-4 text-amber-400" /> ประวัติการสอนแทนของสังกัด</h3>
                      <select value={hodTeacherFilter} onChange={e => setHodTeacherFilter(e.target.value)}
                        className="bg-slate-950 text-slate-200 border border-slate-800 rounded-lg p-1 px-2 text-[11px] outline-none">
                        <option value="ALL">ครูทุกคน</option>
                        {deptTeachers.map(t => <option key={t.id} value={(t.email || '').toLowerCase()}>{t.firstName} {t.lastName}</option>)}
                      </select>
                      <input type="date" value={hodStart} onChange={e => setHodStart(e.target.value)} className="bg-slate-950 text-slate-200 border border-slate-800 rounded-lg p-1 px-2 text-[11px] font-mono outline-none" />
                      <input type="date" value={hodEnd} onChange={e => setHodEnd(e.target.value)} className="bg-slate-950 text-slate-200 border border-slate-800 rounded-lg p-1 px-2 text-[11px] font-mono outline-none" />
                      <button onClick={() => exportCsv(hodFiltered, `substitute_${deptName}_${Date.now()}.csv`)}
                        className="ml-auto px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded-lg flex items-center gap-1">
                        <FileDown className="w-3.5 h-3.5" /> CSV
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950/60 text-slate-300 font-bold border-b border-slate-800/60">
                          <tr><th className="px-6 py-3">วันที่</th><th className="px-6 py-3">รายวิชา/ห้อง</th><th className="px-6 py-3">ครูสอนแทน</th><th className="px-6 py-3">แทนครู</th><th className="px-6 py-3">บันทึก</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 text-slate-300">
                          {hodFiltered.length === 0 ? (
                            <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">ไม่พบข้อมูลตามตัวกรอง</td></tr>
                          ) : hodFiltered.slice().sort((a, b) => b.date.localeCompare(a.date)).map(r => (
                            <tr key={r.id} className="hover:bg-slate-900/30">
                              <td className="px-6 py-3 font-mono">{r.date}</td>
                              <td className="px-6 py-3">{r.courseCode} {r.courseName} · <span className="text-indigo-400 font-mono">{r.room}</span></td>
                              <td className="px-6 py-3 font-semibold text-white">{r.substituteTeacherName}</td>
                              <td className="px-6 py-3">{r.originalTeacherName}</td>
                              <td className="px-6 py-3">{r.isLogged ? (r.isLate ? '⚠️ ช้า' : '✓') : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* ============ EXECUTIVE ============ */}
          {activeTab === 'EXECUTIVE' && (
            <motion.div key="exec" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-6">
              {records.length === 0 ? emptyState('ยังไม่มีข้อมูลการสอนแทนทั้งโรงเรียน') : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: 'คาบสอนแทนรวมทั้งโรงเรียน', value: execKPIs.total, color: 'text-indigo-400', Icon: Layers },
                      { label: 'กลุ่มสาระฯ ที่สอนแทนมากสุด', value: execKPIs.topDept, color: 'text-amber-400', Icon: TrendingUp, small: true },
                      { label: 'อัตราส่งบันทึกหลังสอน', value: `${execKPIs.loggedRate}%`, color: 'text-emerald-400', Icon: CheckCircle },
                      { label: 'ครูที่ร่วมปฏิบัติหน้าที่', value: execKPIs.uniqueTeachers, color: 'text-blue-400', Icon: Users },
                    ].map(k => (
                      <div key={k.label} className="bg-[#0f1422] border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
                        <k.Icon className="w-14 h-14 absolute top-0 right-0 opacity-5" />
                        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{k.label}</span>
                        <div className={cn('font-black mt-2 font-mono', k.color, k.small ? 'text-lg' : 'text-3xl')}>{k.value}</div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-[#0f1422] border border-slate-800/80 p-5 rounded-2xl space-y-3">
                      <h4 className="text-sm font-extrabold text-white">สัดส่วนการสอนแทนตามกลุ่มสาระฯ</h4>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={deptPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(e: any) => `${e.name} (${e.value})`}>
                              {deptPie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                            </Pie>
                            <Tooltip contentStyle={{ backgroundColor: '#090d16', borderColor: '#334155' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className="bg-[#0f1422] border border-slate-800/80 p-5 rounded-2xl space-y-3">
                      <h4 className="text-sm font-extrabold text-white">แนวโน้มรายเดือน</h4>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={monthlyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
                            <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                            <Tooltip contentStyle={{ backgroundColor: '#090d16', borderColor: '#334155' }} />
                            <Line type="monotone" dataKey="คาบสอนแทน" stroke="#6366f1" strokeWidth={2} />
                            <Line type="monotone" dataKey="บันทึกแล้ว" stroke="#10b981" strokeWidth={2} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#0f1422] border border-slate-800/80 rounded-2xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-800/80 bg-slate-950/20 flex items-center justify-between">
                      <h3 className="text-sm font-extrabold text-white flex items-center gap-2"><Sparkles className="w-4 h-4 text-amber-400" /> ครูจิตอาสาสอนแทน (Top 10)</h3>
                      <button onClick={() => exportCsv(records, `substitute_school_${Date.now()}.csv`)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold rounded-lg flex items-center gap-1">
                        <FileDown className="w-3.5 h-3.5" /> ส่งออกทั้งหมด (CSV)
                      </button>
                    </div>
                    <table className="w-full text-left text-xs">
                      <tbody className="divide-y divide-slate-800/60 text-slate-300">
                        {leaderboard.map((t, i) => (
                          <tr key={t.name + i} className="hover:bg-slate-900/30">
                            <td className="px-6 py-3 font-mono text-slate-500 w-12">#{i + 1}</td>
                            <td className="px-6 py-3 font-bold text-white">{t.name}</td>
                            <td className="px-6 py-3 text-slate-400">{t.dept}</td>
                            <td className="px-6 py-3 text-right font-mono font-black text-indigo-400">{t.count} คาบ</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* EXPORT MODAL (teacher PA) */}
      <AnimatePresence>
        {exportOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#111622] border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2"><FileDown className="w-5 h-5 text-indigo-400" /> ส่งออกรายงานภาระงานสอนแทน (PA)</h3>
              <p className="text-xs text-slate-400">
                รายงานของ <span className="text-white font-bold">{teacherName}</span> จำนวน {teacherRecords.length} คาบ — ดาวน์โหลดเป็นไฟล์ CSV เปิดด้วย Excel ได้ทันที
              </p>
              <div className="flex gap-2.5 justify-end">
                <button onClick={() => setExportOpen(false)} className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-slate-400">ยกเลิก</button>
                <button onClick={() => exportCsv(teacherRecords, `PA_${teacherName}_${Date.now()}.csv`)}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5">
                  <FileDown className="w-3.5 h-3.5" /> ดาวน์โหลด CSV
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
