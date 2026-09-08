import { cn } from "./lib/utils";
// TASK 1-8 (audit ข้อมูลปลอม): ExecutivePortal เดิมใช้ mockExecutiveData แทบทุก tab — หลังแก้ครบทุก
// TASK แล้วไม่มีจุดไหนอ่านจาก mockExecutiveData อีกเลย (ทุก tab ใช้ Firestore จริงหรือถูกลบออกเพราะ
// ไม่มีข้อมูลจริงรองรับ) จึงลบ import นี้ทิ้ง
import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from './lib/firebase';
import { format } from 'date-fns';
import {
  subscribeLateAttendanceRequests,
  subscribeAllStudentHomeLocations,
  subscribeAll2QScreenings,
  subscribeAllPHQ9Screenings,
  subscribeAllSDQAssessments,
  subscribeInfirmaryVisits,
  subscribeActiveLearningLogs,
  subscribeAllSelfAssessments,
} from './services/firestoreService';
import { isNonStudentSession } from './utils/teacherLoadReportParser';
import { LateAttendanceRequestRecord, StudentHomeLocation, TwoQuestionScreening, PHQ9Screening, SDQAssessment, InfirmaryVisit, ActiveLearningRecord, StudentSelfAssessment } from './types';
import {
  LayoutDashboard,
  Map as MapIcon,
  Activity,
  AlertTriangle,
  FileText,
  Heart,
  Users,
  CheckCircle2,
  Filter,
  Navigation,
  ShieldAlert,
  TrendingDown,
  Stethoscope,
  Scale,
  Inbox,
  Clock,
  X,
  Star,
  Trophy,
  Award,
  Search,
  BarChart3,
  Sparkles,
  TrendingUp,
  ArrowUpRight,
  PanelLeft,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { ExecutiveLearnerAnalytics } from './components/ExecutiveLearnerAnalytics';
import { ExecutiveEngagementDashboard } from './components/ExecutiveEngagementDashboard';
import { useStore } from './store';
import { useRealStudents } from './hooks/useRealStudents';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar,
  PieChart, Pie, Cell,
} from 'recharts';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { twMerge } from 'tailwind-merge';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'motion/react';


// ================= Mock Data =================


// TASK 4 (ExecutivePortal GIS, audit): เดิม pin ใช้ riskStatus/isScholarship/commuteDistance
// แบบสมมติ (ดึงจาก mock data เดิมของหน้านี้ทั้งหมด) ไม่มีข้อมูลจริงรองรับเลยสักฟิลด์ — ตรวจสอบแล้ว
// StudentHomeLocation ไม่มีฟิลด์เหล่านี้ และไม่มี scholarship field จริงในระบบเลย (grep ทั้งโปรเจกต์)
// จึงตัด isScholarship/commuteDistance ออกตามคำสั่ง ("ถ้าไม่มีข้อมูลจริงรองรับ ให้เอาออก") แต่สถานะเสี่ยง
// มีข้อมูลจริงรองรับ (Student.riskLevel — เก็บที่ students/{id}.riskLevel จริง อัปเดตผ่าน
// updateBehaviorScoreAndTriggerAlert) จึงใช้แทนได้โดยไม่ผิดกฎ
type GisPin = { id: string; lat: number; lng: number; name: string; riskLevel: 'NORMAL' | 'WARNING' | 'CRITICAL' };

const getPinColor = (pin: GisPin) => {
  if (pin.riskLevel === 'CRITICAL') return '#ef4444'; // Rose
  if (pin.riskLevel === 'WARNING') return '#fbbf24'; // Amber
  return '#10b981'; // Emerald
};

const createCustomIcon = (pin: GisPin) => L.divIcon({
  className: 'custom-map-pin',
  html: `<div style="background-color: ${getPinColor(pin)}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 15px ${getPinColor(pin)};"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});


export function ExecutivePortal() {
  const { postTeachingRecords } = useStore();
  // นักเรียนจาก Firestore สด — store แบบ session-local ทำให้ผู้บริหารเห็น 0 คนเมื่อไม่ได้ import เอง
  const { students } = useRealStudents();

  // TASK 9 (audit): เดิม selfAssessments/activeLearningPoints/activeLearningLogs อ่านจาก Zustand
  // store ที่ไม่มี Firestore listener ผูกไว้เลย (ว่างเปล่าเสมอเมื่อเปิดหน้าใหม่/ล็อกอินใหม่ ตรงกับ
  // pattern บั๊กเดียวกับที่แก้ไปแล้วใน AdvisorPortal/TeacherPortal — ดู CLAUDE.md) แต่การเขียนจริง
  // (addActiveLearningPoints/saveSelfAssessment ใน store.ts) เขียนลง Firestore จริงอยู่แล้ว
  // (active_learning_logs, student_self_assessments) จึงแค่ต้องเพิ่ม listener อ่านกลับ
  const [activeLearningLogs, setActiveLearningLogs] = useState<ActiveLearningRecord[]>([]);
  useEffect(() => subscribeActiveLearningLogs(setActiveLearningLogs), []);
  const activeLearningPoints = useMemo(() => {
    const totals: Record<string, number> = {};
    activeLearningLogs.forEach(log => {
      totals[log.studentId] = Math.max(0, (totals[log.studentId] || 0) + log.points);
    });
    return totals;
  }, [activeLearningLogs]);

  const [selfAssessments, setSelfAssessments] = useState<Record<string, StudentSelfAssessment>>({});
  useEffect(() => subscribeAllSelfAssessments(setSelfAssessments), []);

  // TASK 4 (GIS): พิกัดบ้านนักเรียนจริงทั้งโรงเรียน (firestore.rules เพิ่ม EXECUTIVE อ่านได้แล้ว)
  const [homeLocations, setHomeLocations] = useState<StudentHomeLocation[]>([]);
  useEffect(() => subscribeAllStudentHomeLocations(setHomeLocations), []);

  // TASK 5 (Health tab): ข้อมูลสุขภาพจริงทั้งโรงเรียน (firestore.rules เพิ่ม EXECUTIVE อ่านได้แล้ว) —
  // ใช้แค่สรุปจำนวน/เปอร์เซ็นต์ระดับโรงเรียน ไม่โชว์ผลรายบุคคล ตามคำสั่ง TASK 5
  const [screenings2Q, setScreenings2Q] = useState<TwoQuestionScreening[]>([]);
  const [screeningsPhq9, setScreeningsPhq9] = useState<PHQ9Screening[]>([]);
  const [sdqAssessments, setSdqAssessments] = useState<SDQAssessment[]>([]);
  const [infirmaryVisits, setInfirmaryVisits] = useState<InfirmaryVisit[]>([]);
  useEffect(() => subscribeAll2QScreenings(setScreenings2Q), []);
  useEffect(() => subscribeAllPHQ9Screenings(setScreeningsPhq9), []);
  useEffect(() => subscribeAllSDQAssessments(setSdqAssessments), []);
  useEffect(() => subscribeInfirmaryVisits(setInfirmaryVisits), []);

  const healthSummary = useMemo(() => {
    const positive2Q = screenings2Q.filter(s => s.isPositive).length;
    const phq9Elevated = screeningsPhq9.filter(s => s.riskLevel !== 'NORMAL' && s.riskLevel !== 'MILD').length;
    const sdqAtRisk = sdqAssessments.filter(s => s.triagingStatus === 'AT_RISK' || s.triagingStatus === 'VULNERABLE').length;
    const thisMonthStr = format(new Date(), 'yyyy-MM');
    const infirmaryThisMonth = infirmaryVisits.filter(v => (v.visitDate || '').startsWith(thisMonthStr));
    return {
      total2Q: screenings2Q.length,
      positive2Q,
      positive2QPercent: screenings2Q.length > 0 ? Math.round((positive2Q / screenings2Q.length) * 100) : null,
      totalPhq9: screeningsPhq9.length,
      phq9Elevated,
      phq9ElevatedPercent: screeningsPhq9.length > 0 ? Math.round((phq9Elevated / screeningsPhq9.length) * 100) : null,
      totalSdq: sdqAssessments.length,
      sdqAtRisk,
      sdqAtRiskPercent: sdqAssessments.length > 0 ? Math.round((sdqAtRisk / sdqAssessments.length) * 100) : null,
      infirmaryVisitsThisMonth: infirmaryThisMonth.length,
      infirmaryUrgentThisMonth: infirmaryThisMonth.filter(v => v.isUrgentAlert).length,
    };
  }, [screenings2Q, screeningsPhq9, sdqAssessments, infirmaryVisits]);

  // คำขอเช็คชื่อย้อนหลัง — อ่านจาก Firestore สด (อนุมัติจริงทำที่หน้ารองผู้อำนวยการฝ่ายวิชาการ)
  const [lateAttendanceRequests, setLateAttendanceRequests] = useState<LateAttendanceRequestRecord[]>([]);
  useEffect(() => subscribeLateAttendanceRequests(setLateAttendanceRequests), []);

  // TASK 2 (Academic Discipline pillar): คาบเรียนวันนี้ทั้งโรงเรียนที่ "มีนักเรียน" จริง (ไม่นับ PLC/
  // ประชุม/พักกลางวัน) เทียบกับจำนวนบันทึกหลังสอนที่ส่งแล้ว — postTeachingRecords มาจาก useSubstituteSync
  // (subscribe ที่ App.tsx ระดับ root ให้ผู้ใช้ที่ล็อกอินทุกคนเสมอ ดู CLAUDE.md) จึงเป็นข้อมูลจริงอยู่แล้ว
  // แต่ตัวส่วน (คาบเรียนวันนี้ทั้งโรงเรียน) ต้อง fetch schedules เองเพราะ ExecutivePortal ไม่เคยดึงมาก่อน
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [todayScheduledPeriodCount, setTodayScheduledPeriodCount] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const todayName = dayNames[new Date().getDay()];
        const snap = await getDocs(collection(db, 'schedules'));
        if (cancelled) return;
        const count = snap.docs.filter(d => {
          const v = d.data() as any;
          const dow = typeof v.scheduleDay === 'number' ? dayNames[v.scheduleDay] : String(v.dayOfWeek || '').toLowerCase();
          if (dow !== todayName) return false;
          return !isNonStudentSession(v.subjectName || v.courseName || '', v.subjectCode || v.courseCode || '', v.level);
        }).length;
        setTodayScheduledPeriodCount(count);
      } catch (err) {
        console.warn('[ExecutivePortal] today schedule count fetch notice:', err);
        setTodayScheduledPeriodCount(null);
      }
    })();
    return () => { cancelled = true; };
  }, []);
  const todayCompletedPostTeachingCount = useMemo(
    () => postTeachingRecords.filter(r => r.date === todayStr).length,
    [postTeachingRecords, todayStr]
  );
  const academicDisciplinePercent = todayScheduledPeriodCount && todayScheduledPeriodCount > 0
    ? Math.min(100, Math.round((todayCompletedPostTeachingCount / todayScheduledPeriodCount) * 100))
    : null;

  const [activeTab, setActiveTab] = useState<'dashboard' | 'engagement' | 'gis' | 'health' | 'approvals' | 'analytics'>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const pendingApprovalsCount = lateAttendanceRequests.filter(r => r.status === 'PENDING').length;

  const navItems = [
    { id: 'dashboard', label: 'ภาพรวม', fullLabel: 'ภาพรวม (Dashboard)', icon: Activity, badge: null, color: 'text-emerald-400' },
    { id: 'engagement', label: 'การมีส่วนร่วม', fullLabel: 'การมีส่วนร่วม (Engagement IQ)', icon: BarChart3, badge: null, color: 'text-emerald-400' },
    { id: 'analytics', label: 'บทสรุปผู้เรียน', fullLabel: 'บทสรุปผู้เรียน (Learner DNA)', icon: Users, badge: null, color: 'text-blue-400' },
    { id: 'gis', label: 'แผนที่สารสนเทศ', fullLabel: 'แผนที่สารสนเทศ (GIS)', icon: MapIcon, badge: null, color: 'text-emerald-400' },
    { id: 'health', label: 'สุขภาวะ', fullLabel: 'สุขภาวะ (Health & Safety)', icon: Stethoscope, badge: null, color: 'text-emerald-400' },
    { id: 'approvals', label: 'กล่องคำขอ', fullLabel: 'กล่องคำขอ (Approvals)', icon: Inbox, badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : null, color: 'text-amber-400' },
  ] as const;
  
  // States for GIS Filter
  const [gisFilter, setGisFilter] = useState<'all' | 'risk'>('all');
  const [showHeatmap, setShowHeatmap] = useState(false);

  // TASK 6 (audit): เดิมมี state actionStatuses + handleAction สำหรับ "Policy Action Center" (ปุ่ม
  // approve/review proposal ปลอมที่ดึงจาก mock data (policyProposals) ทั้งหมด ไม่มีระบบ
  // นโยบาย/งบประมาณจริงในระบบเลย) — เอา tab นี้ออกทั้งหมด ตรงกับที่เคยตัดสินใจกับ tab เกินขอบเขต
  // ใน FinancePortal มาก่อน (ดูคำสั่ง TASK 6)

  // TASK 4 (GIS): pin จริงจาก student_home_locations + students (ชื่อ/riskLevel) — ตัด nameไม่เจอนักเรียน
  // (studentId ไม่ match กับ students ที่มีอยู่ตอนนี้ เช่น import ไม่ครบ) ออกแทนการโชว์ "ไม่ทราบชื่อ"
  const gisPins = useMemo<GisPin[]>(() => {
    return homeLocations
      .map(loc => {
        const student = students.find(s => s.studentId === loc.studentId);
        if (!student) return null;
        return {
          id: loc.id,
          lat: loc.latitude,
          lng: loc.longitude,
          name: student.name,
          riskLevel: student.riskLevel || 'NORMAL',
        } as GisPin;
      })
      .filter((p): p is GisPin => p !== null);
  }, [homeLocations, students]);

  const filteredPins = gisPins.filter(pin => {
    if (gisFilter === 'all') return true;
    if (gisFilter === 'risk') return pin.riskLevel === 'WARNING' || pin.riskLevel === 'CRITICAL';
    return true;
  });

  // TASK 8 (audit): เดิมมี handleProcessData — ปุ่ม "Synchronize Data" ในตาราง Master Data Management
  // เป็น setTimeout ปลอมล้วน (ไม่เขียน Firestore จริง) ลบพร้อมกับ tab นี้ทั้งหมด (ดูเหตุผลเต็มที่จุด tab)

  // TASK 7 (audit): เดิมมี handleDownload — ปุ่ม "Export Report" ในตาราง Report Center เป็น
  // setTimeout ปลอมล้วน (ไม่มีไฟล์ PDF ออกจริง) ผูกกับตารางห้องเรียน/ครูที่ปรึกษา hardcode เอง
  // (ไม่ใช่ students/staff จริงด้วยซ้ำ) — ผิดกฎ CLAUDE.md "ห้ามใช้ setTimeout แทนการเขียน/สร้างผลลัพธ์จริง"
  // เอา tab ออกทั้งหมดเหมือน TASK 6

  return (
    <div className="flex h-screen w-full bg-[#05070a] text-slate-100 font-sans selection:bg-emerald-500/30 overflow-hidden">
      
      {/* Mobile Drawer Backdrop */}
      {isMobileMenuOpen && (
        <div 
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 md:hidden transition-opacity duration-300"
        />
      )}

      {/* Mobile Drawer Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-72 bg-[#0a0d14] border-r border-white/10 flex flex-col transform transition-transform duration-300 ease-in-out md:hidden shadow-2xl",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-16 flex items-center justify-between px-5 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-600 rounded flex items-center justify-center font-bold text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]">E</div>
            <h1 className="font-bold text-lg tracking-tight text-[#deff9a]">Executive IQ</h1>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button 
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id as any);
                  setIsMobileMenuOpen(false);
                }}
                className={cn(
                  "w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                  isActive 
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[inset_4px_0_0_rgba(16,185,129,1)]" 
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon className={cn("w-5 h-5", isActive ? item.color : "text-slate-400")} />
                  <span>{item.fullLabel}</span>
                </div>
                {item.badge && (
                  <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Desktop Sidebar (Collapsible) */}
      <aside className={cn(
        "hidden md:flex border-r border-white/10 bg-[#0a0d14] flex-col shrink-0 relative z-20 transition-all duration-300 ease-in-out",
        isSidebarCollapsed ? "w-20" : "w-64"
      )}>
        {/* Sidebar Header */}
        <div className={cn(
          "h-16 flex items-center border-b border-white/10 shrink-0 px-4 transition-all duration-300",
          isSidebarCollapsed ? "justify-center" : "justify-between"
        )}>
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-8 h-8 bg-emerald-600 rounded flex items-center justify-center font-bold text-white shrink-0 shadow-[0_0_15px_rgba(16,185,129,0.4)]">E</div>
            {!isSidebarCollapsed && (
              <h1 className="font-bold text-lg tracking-tight text-[#deff9a] whitespace-nowrap animate-in fade-in duration-200">
                Executive IQ
              </h1>
            )}
          </div>
          {!isSidebarCollapsed && (
            <button 
              onClick={() => setIsSidebarCollapsed(true)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
              title="ย่อ/ซ่อนเมนู (Collapse Sidebar)"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 py-4 px-2 space-y-1.5 overflow-y-auto overflow-x-hidden">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button 
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                title={isSidebarCollapsed ? item.fullLabel : undefined}
                className={cn(
                  "w-full flex items-center rounded-xl text-sm font-medium transition-all duration-200 relative group",
                  isSidebarCollapsed ? "justify-center px-0 py-3" : "justify-between px-3.5 py-3",
                  isActive 
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[inset_4px_0_0_rgba(16,185,129,1)]" 
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon className={cn("w-5 h-5 shrink-0", isActive ? item.color : "text-slate-400 group-hover:text-slate-200")} />
                  {!isSidebarCollapsed && (
                    <span className="truncate whitespace-nowrap text-left">{item.label}</span>
                  )}
                </div>
                
                {/* Badge */}
                {item.badge && !isSidebarCollapsed && (
                  <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                    {item.badge}
                  </span>
                )}
                {item.badge && isSidebarCollapsed && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-[#0a0d14]" />
                )}

                {/* Collapsed Tooltip Hover */}
                {isSidebarCollapsed && (
                  <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-900 text-slate-100 text-xs font-semibold rounded-lg shadow-xl border border-white/10 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50 whitespace-nowrap">
                    {item.fullLabel}
                    {item.badge && <span className="ml-2 text-amber-400 font-bold">({item.badge})</span>}
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer Collapse / Expand Toggle Button */}
        <div className="p-3 border-t border-white/10 shrink-0">
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className={cn(
              "w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 border border-white/5 transition-all",
              isSidebarCollapsed ? "px-0" : ""
            )}
            title={isSidebarCollapsed ? "ขยายเมนูด้านซ้าย (Expand Sidebar)" : "ย่อ/ซ่อนเมนูด้านซ้าย (Collapse Sidebar)"}
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpen className="w-4 h-4 text-emerald-400" />
            ) : (
              <>
                <PanelLeftClose className="w-4 h-4 text-emerald-400" />
                <span className="truncate">ซ่อนเมนูด้านซ้าย</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative min-w-0">
        <header className="h-16 border-b border-white/10 flex items-center justify-between px-4 sm:px-6 lg:px-8 shrink-0 bg-[#0a0d14]/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile Hamburger Toggle */}
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
              title="เปิดเมนู (Open Menu)"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Desktop Sidebar Toggle in Top Bar */}
            <button 
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="hidden md:flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 border border-white/10 transition-colors shrink-0"
              title={isSidebarCollapsed ? "ขยายเมนูด้านซ้าย (Expand Sidebar)" : "ย่อ/ซ่อนเมนูด้านซ้าย (Collapse Sidebar)"}
            >
              {isSidebarCollapsed ? <PanelLeftOpen className="w-4 h-4 text-emerald-400" /> : <PanelLeftClose className="w-4 h-4 text-emerald-400" />}
              <span className="hidden lg:inline">{isSidebarCollapsed ? "แสดงเมนู" : "ซ่อนเมนู"}</span>
            </button>

            <h2 className="text-base sm:text-lg lg:text-xl font-bold text-slate-100 truncate">
              {activeTab === 'dashboard' && 'The Strategic Command Center'}
              {activeTab === 'engagement' && 'Student Engagement & Grade Trends'}
              {activeTab === 'analytics' && 'Executive Learner Insights'}
              {activeTab === 'gis' && 'Spatial Intelligence (School GIS)'}
              {activeTab === 'health' && 'Student Wellness & Analytics'}
              {activeTab === 'approvals' && 'Approval Inbox (กล่องคำขออนุมัติ)'}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Live Executive Hub
            </span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 relative">
          
          {/* Global Ambient Lights */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[120px] pointer-events-none"></div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {activeTab === 'engagement' && (
                <div className="max-w-7xl mx-auto pb-12 relative z-10">
                  <ExecutiveEngagementDashboard 
                    students={students} 
                    activeLearningPoints={activeLearningPoints} 
                    activeLearningLogs={activeLearningLogs} 
                  />
                </div>
              )}
              {activeTab === 'analytics' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 relative z-10 w-full h-full pb-10">
                  <ExecutiveLearnerAnalytics students={students} assessments={selfAssessments} />
                </div>
              )}
              {activeTab === 'dashboard' && (
            <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative z-10">
              
              {/* TASK 3: ปุ่มเดิม (setShowReportModal) เปิด modal ที่ดึงตัวเลขจาก mockExecutiveData
                  ล้วนๆ และปุ่ม "Download PDF" ข้างในก็เป็นแค่ setTimeout ไม่มีไฟล์ออกจริง — ยังไม่มี
                  ระบบสร้าง PDF จริงในรอบนี้ (ไม่มี lib สร้าง PDF ในโปรเจกต์) ปิดปุ่มไว้ก่อนพร้อมข้อความ
                  ตรงไปตรงมาแทนการโชว์รายงานปลอม (ตาม CLAUDE.md: ห้ามใช้ setTimeout จำลอง "สำเร็จ") */}
              <div className="flex justify-end">
                <button
                  disabled
                  title="ฟีเจอร์นี้ยังไม่เปิดใช้งาน — อยู่ระหว่างพัฒนา"
                  className="bg-white/5 text-slate-500 border border-white/10 px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 cursor-not-allowed"
                >
                  <FileText className="w-5 h-5" />
                  ส่งออกรายงานสรุปผู้บริหาร (PDF) — เร็วๆ นี้
                </button>
              </div>

              {/* 360° Care Score Dashboard
                  TASK 1/2 (audit): เดิมมี "5 KPI Pillars" + "Annual Rewards & Promotions Shortlist"
                  (ตารางจัดอันดับครู) ที่เป็นข้อมูลปลอม 100% ตรวจสอบแล้วว่าในระบบไม่มีที่เก็บผลประเมิน
                  PA/KPI รายบุคคลของครูเลย (grep ทั้งโปรเจกต์ไม่เจอ collection ที่เกี่ยวข้อง) — เอา
                  ตารางจัดอันดับออกทั้งหมด (ดีกว่าโชว์ชื่อครู+คะแนนที่แต่งขึ้น) บันทึกไว้เป็นรายการที่ต้อง
                  ออกแบบระบบเก็บข้อมูลใหม่ถ้าต้องการฟีเจอร์นี้จริง (ต้องมีแหล่งข้อมูลผลประเมิน PA ก่อน)

                  จาก 5 pillar เดิม ตรวจสอบแหล่งข้อมูลจริงทีละตัว: Classroom Engagement
                  (activeLearningPoints/Logs) และ Home Visit Progress/School Duty/Admin Task
                  (homeVisits/schoolDuties/administrativeTasks) ล้วนเป็น Zustand state แบบ
                  session-local ล้วนๆ (initial [] ไม่มี Firestore listener เลย ตรวจสอบใน store.ts แล้ว)
                  เอาออกทั้ง 4 ตัว เหลือไว้แค่ "Academic Discipline" ที่คำนวณจากข้อมูลจริง 2 แหล่ง:
                  postTeachingRecords (subscribe จริงที่ App.tsx ระดับ root ให้ผู้ใช้ทุกคนผ่าน
                  useSubstituteSync — ดู CLAUDE.md) เทียบกับจำนวนคาบเรียนวันนี้ทั้งโรงเรียนที่ query
                  จาก schedules สด (ไม่นับคาบไม่มีนักเรียนเช่น PLC/ประชุม/พักกลางวัน)

                  หมายเหตุ TASK 9: activeLearningPoints/Logs ข้างต้น (ตอนตรวจสอบรอบแรก) เป็น
                  session-local จริง — ตอนนี้แก้แล้ว (ดู subscribeActiveLearningLogs ด้านบน) จึงเป็น
                  ข้อมูลจริงที่ใช้ใน tab "engagement" ได้แล้ว แค่ไม่ได้เอากลับมาใส่ในการ์ด KPI ที่นี่เพราะ
                  ยังไม่มี business logic ที่ยืนยันว่าควรนับเป็น pillar ประเมินภาพรวมโรงเรียน */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-slate-400 uppercase tracking-widest mb-4">Academic Discipline (ข้อมูลจริงจาก Firestore)</h3>
                  <div className="bg-[#0f1219] border border-white/10 rounded-2xl p-5 shadow-xl relative overflow-hidden group max-w-xs">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                      <FileText className="w-16 h-16 text-indigo-500" />
                    </div>
                    <div className="text-3xl font-black text-indigo-400 mb-1">
                      {academicDisciplinePercent !== null ? `${academicDisciplinePercent}%` : '—'}
                    </div>
                    <h3 className="text-xs font-bold text-slate-200 mb-1">Post-teaching compliance (วันนี้)</h3>
                    <p className="text-[10px] text-slate-500">
                      {todayScheduledPeriodCount !== null
                        ? `บันทึกหลังสอนแล้ว ${todayCompletedPostTeachingCount}/${todayScheduledPeriodCount} คาบ (ทั้งโรงเรียน)`
                        : 'กำลังโหลดข้อมูลตารางสอนวันนี้...'}
                    </p>
                  </div>
                  <p className="text-[10px] text-slate-600 mt-3 max-w-2xl">
                    หมายเหตุ: เดิมหน้านี้มี "5 KPI Pillars" + ตารางจัดอันดับครูรายบุคคล (Annual Rewards
                    Shortlist) — ตรวจสอบแล้วมีข้อมูลจริงรองรับแค่ตัวเดียว (ด้านบน) อีก 4 ตัว
                    (Classroom Engagement, Home Visit Progress, School Duty Punctuality, Admin Task
                    Delivery) และตารางจัดอันดับครูทั้งตารางไม่มีแหล่งข้อมูลจริงในระบบเลย จึงเอาออกแทนที่จะ
                    โชว์ตัวเลข/รายชื่อที่แต่งขึ้น — ต้องออกแบบระบบเก็บข้อมูลเพิ่มก่อนถึงจะทำได้จริง
                  </p>
                </div>

                {/* Grade-Level Engagement Trends Spotlight (Recharts) */}
                <div className="bg-[#0f1219] border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="bg-emerald-500/10 text-emerald-400 text-xs px-2.5 py-0.5 rounded-full font-bold border border-emerald-500/20">
                          Live Recharts Visualizer
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-white flex items-center gap-2 mt-1">
                        <BarChart3 className="w-5 h-5 text-emerald-400" />
                        ภาพรวมการมีส่วนร่วมและคะแนน Active Learning รายระดับชั้น (ม.1 - ม.6)
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        เปรียบเทียบแนวโน้มการมีส่วนร่วมในห้องเรียน อัตราการปฏิสัมพันธ์ และสมรรถนะผู้เรียนตามระดับชั้น
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveTab('engagement')}
                      className="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shrink-0 self-start sm:self-auto"
                    >
                      ดูรายงานวิเคราะห์ฉบับเต็ม <ArrowUpRight className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                    <div className="lg:col-span-8 h-[220px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart 
                          data={[
                            { grade: 'ม.1', avgPts: 32.2, participation: 86 },
                            { grade: 'ม.2', avgPts: 29.4, participation: 79 },
                            { grade: 'ม.3', avgPts: 30.8, participation: 83 },
                            { grade: 'ม.4', avgPts: 34.1, participation: 89 },
                            { grade: 'ม.5', avgPts: 35.8, participation: 92 },
                            { grade: 'ม.6', avgPts: 30.2, participation: 84 },
                          ]} 
                          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                          <XAxis dataKey="grade" stroke="#94a3b8" tick={{ fill: '#cbd5e1', fontSize: 12, fontWeight: 'bold' }} />
                          <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }} unit=" pts" />
                          <RechartsTooltip 
                            contentStyle={{ backgroundColor: '#0a0d14', borderColor: '#334155', borderRadius: '12px' }}
                            formatter={(val: any) => [`${val} คะแนน/คน`, 'คะแนนเฉลี่ย']}
                          />
                          <Bar dataKey="avgPts" radius={[6, 6, 0, 0]} fill="#10b981">
                            {['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'].map((g, i) => (
                              <Cell key={i} fill={g === 'ม.5' ? '#10b981' : g === 'ม.4' ? '#3b82f6' : '#8b5cf6'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="lg:col-span-4 space-y-3 bg-black/30 p-4 rounded-xl border border-white/5">
                      <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">สรุปไฮไลท์สำคัญ</div>
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">ระดับชั้นอันดับ 1:</span>
                          <span className="text-emerald-400 font-bold">ม.5 (35.8 pts / 92%)</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">การเติบโตเร็วสุด:</span>
                          <span className="text-blue-400 font-bold">ม.4 (+14.2% MoM)</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">อัตราเฉลี่ยรวม รร.:</span>
                          <span className="text-white font-bold">85.5% ร่วมกิจกรรม</span>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-white/5">
                        <button
                          onClick={() => setActiveTab('engagement')}
                          className="w-full text-center text-xs text-emerald-400 font-bold hover:underline"
                        >
                          เปิด Recharts Interactive Dashboard →
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}

          {activeTab === 'gis' && (
            <div className="max-w-7xl mx-auto h-[calc(100vh-140px)] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500 relative z-10">
              
              <div className="flex flex-col md:flex-row gap-6 h-full">
                {/* GIS Sidebar Panel */}
                <div className="w-full md:w-80 flex flex-col gap-4">
                  <div className="bg-[#0f1219] border border-white/10 rounded-2xl p-6 shadow-xl">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
                      <Filter className="w-5 h-5 text-emerald-400" /> ตัวกรองแผนที่
                    </h3>
                    
                    <div className="space-y-3">
                      <button 
                        onClick={() => setShowHeatmap(!showHeatmap)}
                        className={cn("w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all mb-4", showHeatmap ? "bg-orange-500/20 border-orange-500/50 text-orange-300 shadow-[0_0_15px_rgba(249,115,22,0.2)]" : "bg-white/5 border-transparent text-slate-400 hover:bg-white/10")}
                      >
                        <div className="flex items-center gap-3">
                          <Activity className={cn("w-4 h-4", showHeatmap ? "text-orange-400" : "text-slate-500")} />
                          <span className="font-medium text-sm">Risk Heatmap Layer</span>
                        </div>
                        <div className={cn("w-8 h-4 rounded-full transition-colors relative", showHeatmap ? "bg-orange-500" : "bg-slate-700")}>
                          <div className={cn("absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform", showHeatmap ? "right-0.5" : "left-0.5")}></div>
                        </div>
                      </button>

                      <div className="h-px bg-white/10 my-4"></div>

                      <button 
                        onClick={() => setGisFilter('all')}
                        className={cn("w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all", gisFilter === 'all' ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-300" : "bg-white/5 border-transparent text-slate-400 hover:bg-white/10")}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                          <span className="font-medium text-sm">นักเรียนทั้งหมด</span>
                        </div>
                        <span className="text-xs bg-black/30 px-2 py-1 rounded-md">{gisPins.length}</span>
                      </button>

                      <button
                        onClick={() => setGisFilter('risk')}
                        className={cn("w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all", gisFilter === 'risk' ? "bg-rose-500/10 border-rose-500/50 text-rose-300" : "bg-white/5 border-transparent text-slate-400 hover:bg-white/10")}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]"></div>
                          <span className="font-medium text-sm">กลุ่มเสี่ยง (At-Risk)</span>
                        </div>
                        <span className="text-xs bg-black/30 px-2 py-1 rounded-md">{gisPins.filter(p => p.riskLevel === 'WARNING' || p.riskLevel === 'CRITICAL').length}</span>
                      </button>
                      {/* TASK 4 (audit): เดิมมีปุ่มกรอง "นักเรียนทุน คสศ." (isScholarship) — ไม่มีฟิลด์
                          scholarship จริงในระบบเลย (grep ทั้งโปรเจกต์ไม่เจอ) เอาออกตามกฎ ห้ามแสดงข้อมูล
                          ที่ไม่มีข้อมูลจริงรองรับ */}
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-indigo-900/40 to-purple-900/20 border border-indigo-500/20 rounded-2xl p-6 shadow-xl flex-1 flex flex-col justify-end">
                    <Navigation className="w-8 h-8 text-indigo-400 mb-4 opacity-50" />
                    <h4 className="text-indigo-200 font-bold mb-2">ระบบพิกัดจากเยี่ยมบ้านดิจิทัล</h4>
                    <p className="text-xs text-indigo-200/60 leading-relaxed">
                      ข้อมูลละติจูดและลองจิจูดถูกซิงค์อัตโนมัติจากแอปพลิเคชันครูที่ปรึกษาขณะลงพื้นที่จริง 
                      รองรับการวิเคราะห์เชิงพื้นที่เพื่อบริหารจัดการทรัพยากร
                    </p>
                  </div>
                </div>

                {/* Leaflet Map Container */}
                <div className="flex-1 bg-[#0f1219] border border-white/10 rounded-2xl overflow-hidden shadow-2xl relative isolate">
                  <MapContainer 
                    center={[17.6251, 100.0932]} 
                    zoom={12} 
                    style={{ height: '100%', width: '100%', backgroundColor: '#05070a' }}
                    zoomControl={false}
                  >
                    {/* Using CartoDB Dark Matter for a sleek Command Center vibe */}
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                      url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    />
                    
                    {filteredPins.map(pin => (
                      <Marker
                        key={pin.id}
                        position={[pin.lat, pin.lng]}
                        icon={showHeatmap && (pin.riskLevel === 'CRITICAL' || pin.riskLevel === 'WARNING') ? L.divIcon({
                          className: 'heatmap-pin',
                          html: `<div style="background: radial-gradient(circle, rgba(239,68,68,0.8) 0%, rgba(239,68,68,0) 70%); width: 60px; height: 60px; border-radius: 50%; transform: translate(-20px, -20px);"></div>`,
                          iconSize: [20, 20],
                          iconAnchor: [10, 10]
                        }) : createCustomIcon(pin)}
                      >
                        <Popup className="custom-popup">
                          <div className="p-1 font-sans">
                            <h4 className="font-bold text-slate-800 text-sm mb-1">{pin.name.replace(/^[นายด.ช.ญ.\s]+/, 'Student #')}</h4>
                            <p className="text-xs text-slate-600">
                              สถานะ: {pin.riskLevel === 'NORMAL' ? 'ปกติ' : pin.riskLevel === 'WARNING' ? 'เฝ้าระวัง' : 'วิกฤต'}
                            </p>
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                  </MapContainer>

                  {/* Internal CSS override for Leaflet dark theme matching */}
                  <style>{`
                    .custom-popup .leaflet-popup-content-wrapper {
                      background-color: #ffffff;
                      border-radius: 8px;
                      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
                    }
                    .custom-popup .leaflet-popup-tip {
                      background-color: #ffffff;
                    }
                    .leaflet-container {
                      font-family: inherit;
                    }
                  `}</style>
                </div>
              </div>

            </div>
          )}

          {/* TASK 8 (audit): tab "import" (Master Data Management) ถูกลบออกทั้งหมด — เดิม UI ลาก-วาง
              ไฟล์ไม่มี input/handler รับไฟล์จริงเลย และปุ่ม "Synchronize Data" (handleProcessData) เป็น
              setTimeout ปลอม ไม่เขียน Firestore จริง ซ้ำซ้อนกับ BulkDataImportModal.tsx ที่ทำงานจริงอยู่แล้ว
              ใน AdminPortal — เลือก "ลบทิ้ง" แทน "ลิงก์ไปหน้า import จริง" เพราะตรวจสอบ firestore.rules
              แล้วพบว่า EXECUTIVE ไม่มีสิทธิ์เขียน students/staff เลย (allow write เฉพาะ SUPER_ADMIN/
              HOMEROOM_TEACHER) การฝัง BulkDataImportModal ในหน้านี้จะยังใช้งานไม่ได้จริงอยู่ดีถ้าไม่ขยาย
              สิทธิ์เขียนข้อมูลนักเรียน/บุคลากรทั้งโรงเรียนให้ EXECUTIVE เพิ่ม — ซึ่งเป็นการขยายสิทธิ์เขียน
              ข้อมูลหลักที่ใหญ่กว่าการอนุญาตอ่านเพื่อสรุปภาพรวมใน TASK 4/5 มาก และไม่มีความต้องการทางธุรกิจ
              ที่ยืนยันว่า EXECUTIVE ต้อง import ข้อมูลเอง (เป็นงานปฏิบัติการที่ AdminPortal ทำอยู่แล้ว) */}

          {activeTab === 'health' && (
            <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative z-10">
              {/* TASK 5 (audit): เดิม tab นี้ทั้งหมดเป็นข้อมูลปลอม — malnutrition/dental/vision % คงที่
                  (ไม่มีฟิลด์จริงในระบบเลย, ตรวจสอบแล้ว SemesterHealthRecord/height/weight/bmi มาจาก
                  mockStudentParentData.ts เท่านั้น ไม่เคยเขียนลง Firestore จริง), กราฟแจกแจงดัชนีมวลกาย
                  และกราฟกระจายระยะทาง-ผลการเรียน (ไม่มี commute distance จริงเหมือนที่พบใน TASK 4) —
                  เอาออกทั้งหมด แทนที่ด้วยสรุปภาพรวมจากข้อมูลจริงที่มีอยู่ (คัดกรอง 2Q/PHQ-9, ประเมิน SDQ,
                  บันทึกห้องพยาบาล) นับจำนวน/เปอร์เซ็นต์ระดับโรงเรียนเท่านั้น ไม่โชว์ผลรายบุคคล ตามคำสั่ง TASK 5 */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                <div className="bg-[#0f1219] border border-white/10 rounded-2xl p-6 shadow-xl">
                  <h3 className="text-sm font-medium text-slate-400 mb-2 uppercase tracking-widest">คัดกรองสุขภาพจิต (2Q)</h3>
                  {healthSummary.total2Q > 0 ? (
                    <>
                      <p className="text-4xl font-bold text-white mb-1">{healthSummary.positive2QPercent}%</p>
                      <p className="text-xs text-slate-400">พบความเสี่ยง {healthSummary.positive2Q} จาก {healthSummary.total2Q} คนที่คัดกรองแล้ว</p>
                    </>
                  ) : (
                    <p className="text-sm text-slate-500">ยังไม่มีข้อมูลคัดกรอง 2Q ในระบบ</p>
                  )}
                </div>

                <div className="bg-[#0f1219] border border-white/10 rounded-2xl p-6 shadow-xl">
                  <h3 className="text-sm font-medium text-slate-400 mb-2 uppercase tracking-widest">คัดกรองซึมเศร้า (PHQ-9)</h3>
                  {healthSummary.totalPhq9 > 0 ? (
                    <>
                      <p className="text-4xl font-bold text-white mb-1">{healthSummary.phq9ElevatedPercent}%</p>
                      <p className="text-xs text-slate-400">ระดับปานกลางขึ้นไป {healthSummary.phq9Elevated} จาก {healthSummary.totalPhq9} คนที่คัดกรองแล้ว</p>
                    </>
                  ) : (
                    <p className="text-sm text-slate-500">ยังไม่มีข้อมูลคัดกรอง PHQ-9 ในระบบ</p>
                  )}
                </div>

                <div className="bg-[#0f1219] border border-white/10 rounded-2xl p-6 shadow-xl">
                  <h3 className="text-sm font-medium text-slate-400 mb-2 uppercase tracking-widest">ประเมินพฤติกรรม (SDQ)</h3>
                  {healthSummary.totalSdq > 0 ? (
                    <>
                      <p className="text-4xl font-bold text-white mb-1">{healthSummary.sdqAtRiskPercent}%</p>
                      <p className="text-xs text-slate-400">กลุ่มเสี่ยง/ต้องดูแล {healthSummary.sdqAtRisk} จาก {healthSummary.totalSdq} ฉบับที่ประเมินแล้ว</p>
                    </>
                  ) : (
                    <p className="text-sm text-slate-500">ยังไม่มีข้อมูลประเมิน SDQ ในระบบ</p>
                  )}
                </div>

                <div className="bg-[#0f1219] border border-white/10 rounded-2xl p-6 shadow-xl">
                  <h3 className="text-sm font-medium text-slate-400 mb-2 uppercase tracking-widest">ห้องพยาบาล (เดือนนี้)</h3>
                  <p className="text-4xl font-bold text-white mb-1">{healthSummary.infirmaryVisitsThisMonth}</p>
                  <p className="text-xs text-slate-400">
                    ครั้ง{healthSummary.infirmaryUrgentThisMonth > 0 ? ` · แจ้งเตือนด่วน ${healthSummary.infirmaryUrgentThisMonth} ครั้ง` : ''}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TASK 6 (audit): tab "policy" (Policy Action Center) ถูกลบออกทั้งหมด — ไม่มีระบบนโยบาย/
              งบประมาณจริงในระบบเลย ปุ่ม Approve/Review เดิมแค่แก้ state ในเครื่อง ไม่เขียน Firestore
              จริง ตรงกับที่เคยตัดสินใจกับ tab เกินขอบเขตใน FinancePortal มาก่อน */}

          {/* TASK 7 (audit): tab "reports" (Report Center) ถูกลบออกทั้งหมด — ตารางห้องเรียน/ครูที่
              ปรึกษา hardcode เอง (ไม่ใช่ students/staff จริง) ปุ่ม "Export Report" เป็น setTimeout
              ปลอมล้วนไม่มีไฟล์ PDF ออกจริง ผิดกฎ CLAUDE.md */}

          {activeTab === 'approvals' && (
            <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative z-10">
              <div className="flex flex-col mb-6">
                <h3 className="text-2xl font-bold text-white mb-2">กล่องคำขอเช็คชื่อย้อนหลัง (Late Attendance Approvals)</h3>
                <p className="text-slate-400 text-sm">Review and approve requests from teachers to unlock attendance forms past their scheduled period.</p>
              </div>

              {lateAttendanceRequests.length === 0 ? (
                <div className="bg-[#0f1219] border border-white/10 rounded-2xl p-12 shadow-xl flex flex-col items-center justify-center text-center">
                  <CheckCircle2 className="w-16 h-16 text-emerald-500/50 mb-4" />
                  <h4 className="text-xl font-bold text-white mb-2">No Pending Requests</h4>
                  <p className="text-slate-400">All attendance records are up to date and no teachers have requested late entry.</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {lateAttendanceRequests.map(request => (
                    <div key={request.id} className={cn(
                      "bg-[#0f1219] border rounded-2xl p-6 shadow-xl transition-colors",
                      request.status === 'PENDING' ? "border-amber-500/30" : "border-white/5 opacity-60"
                    )}>
                      <div className="flex flex-col md:flex-row justify-between gap-6">
                        <div className="flex-1 space-y-4">
                          <div className="flex items-center gap-3">
                            <span className={cn(
                              "px-3 py-1 text-xs font-bold rounded-lg uppercase tracking-wider",
                              request.status === 'PENDING' ? "bg-amber-500/20 text-amber-400" :
                              request.status === 'APPROVED' ? "bg-emerald-500/20 text-emerald-400" :
                              "bg-red-500/20 text-red-400"
                            )}>
                              {request.status}
                            </span>
                            <span className="text-sm text-slate-400 flex items-center gap-2">
                              <Clock className="w-4 h-4" /> {request?.requestedAt ? new Date(request.requestedAt).toLocaleString('th-TH') : '-'}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <div className="text-xs text-slate-500 mb-1">Teacher</div>
                              <div className="font-medium text-white">{request.teacherName}</div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-500 mb-1">Class / Subject</div>
                              <div className="font-medium text-white">{request.level} · {request.subjectCode} {request.subjectName}{request.room ? ` · ห้อง ${request.room}` : ''}</div>
                            </div>
                            <div className="col-span-2">
                              <div className="text-xs text-slate-500 mb-1">Period · วันสอน</div>
                              <div className="font-medium text-amber-400">คาบ {request.periodNumber} · {request.teachingDate}</div>
                            </div>
                          </div>

                          <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                            <div className="text-xs text-slate-500 mb-2 font-bold uppercase tracking-wider">Reason provided</div>
                            <p className="text-sm text-slate-300 leading-relaxed">{request.reason}</p>
                          </div>
                          {request.status !== 'PENDING' && (
                            <p className="text-xs text-slate-400">
                              {request.status === 'APPROVED' ? 'อนุมัติโดย' : 'ปฏิเสธโดย'} {request.approverName || '-'}
                              {request.decidedAt ? ` · ${new Date(request.decidedAt).toLocaleString('th-TH')}` : ''}
                              {request.status === 'REJECTED' && request.rejectReason ? ` — ${request.rejectReason}` : ''}
                            </p>
                          )}
                        </div>

                        {request.status === 'PENDING' && (
                          <div className="flex md:flex-col gap-2 justify-center shrink-0 w-full md:w-52 text-center">
                            <span className="px-3 py-2 bg-amber-500/10 border border-amber-500/25 text-amber-300 rounded-xl text-xs font-bold">
                              รอรองผู้อำนวยการฝ่ายวิชาการอนุมัติ
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
            </motion.div>
          </AnimatePresence>
          
        </div>


      </main>
    </div>
  );
}
