import { cn } from "./lib/utils";
import { mockExecutiveData } from "./data/mockData";
import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from './lib/firebase';
import { format } from 'date-fns';
import { subscribeLateAttendanceRequests, subscribeAllStudentHomeLocations } from './services/firestoreService';
import { isNonStudentSession } from './utils/teacherLoadReportParser';
import { LateAttendanceRequestRecord, StudentHomeLocation } from './types';
import { 
  LayoutDashboard, 
  FileSpreadsheet, 
  UploadCloud, 
  Map as MapIcon,
  Activity,
  AlertTriangle,
  CheckCircle,
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
  Gavel,
  Check,
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
  ScatterChart, Scatter, ZAxis
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
  const {
    postTeachingRecords,
    selfAssessments,
    activeLearningPoints,
    activeLearningLogs
  } = useStore();
  // นักเรียนจาก Firestore สด — store แบบ session-local ทำให้ผู้บริหารเห็น 0 คนเมื่อไม่ได้ import เอง
  const { students } = useRealStudents();

  // TASK 4 (GIS): พิกัดบ้านนักเรียนจริงทั้งโรงเรียน (firestore.rules เพิ่ม EXECUTIVE อ่านได้แล้ว)
  const [homeLocations, setHomeLocations] = useState<StudentHomeLocation[]>([]);
  useEffect(() => subscribeAllStudentHomeLocations(setHomeLocations), []);

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

  const [activeTab, setActiveTab] = useState<'dashboard' | 'engagement' | 'gis' | 'health' | 'policy' | 'reports' | 'import' | 'approvals' | 'analytics'>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const pendingApprovalsCount = lateAttendanceRequests.filter(r => r.status === 'PENDING').length;

  const navItems = [
    { id: 'dashboard', label: 'ภาพรวม', fullLabel: 'ภาพรวม (Dashboard)', icon: Activity, badge: null, color: 'text-emerald-400' },
    { id: 'engagement', label: 'การมีส่วนร่วม', fullLabel: 'การมีส่วนร่วม (Engagement IQ)', icon: BarChart3, badge: null, color: 'text-emerald-400' },
    { id: 'analytics', label: 'บทสรุปผู้เรียน', fullLabel: 'บทสรุปผู้เรียน (Learner DNA)', icon: Users, badge: null, color: 'text-blue-400' },
    { id: 'gis', label: 'แผนที่สารสนเทศ', fullLabel: 'แผนที่สารสนเทศ (GIS)', icon: MapIcon, badge: null, color: 'text-emerald-400' },
    { id: 'health', label: 'สุขภาวะ', fullLabel: 'สุขภาวะ (Health & Safety)', icon: Stethoscope, badge: null, color: 'text-emerald-400' },
    { id: 'policy', label: 'กำหนดนโยบาย', fullLabel: 'กำหนดนโยบาย (Policy Action)', icon: Gavel, badge: null, color: 'text-emerald-400' },
    { id: 'reports', label: 'รายงาน', fullLabel: 'รายงาน (Report Center)', icon: FileSpreadsheet, badge: null, color: 'text-emerald-400' },
    { id: 'import', label: 'ศูนย์ข้อมูล', fullLabel: 'ศูนย์ข้อมูล (Master Data)', icon: UploadCloud, badge: null, color: 'text-emerald-400' },
    { id: 'approvals', label: 'กล่องคำขอ', fullLabel: 'กล่องคำขอ (Approvals)', icon: Inbox, badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : null, color: 'text-amber-400' },
  ] as const;
  
  // States for Import & Reports
  const [isProcessing, setIsProcessing] = useState(false);
  const [processed, setProcessed] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // States for GIS Filter
  const [gisFilter, setGisFilter] = useState<'all' | 'risk'>('all');
  const [showHeatmap, setShowHeatmap] = useState(false);

  // States for Policy Actions
  const [actionStatuses, setActionStatuses] = useState<Record<string, 'approved' | 'reviewed' | null>>({});

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

  const handleAction = (id: string, action: 'approved' | 'reviewed') => {
    setActionStatuses(prev => ({ ...prev, [id]: action }));
  };

  const handleProcessData = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setProcessed(true);
    }, 2000);
  };

  const handleDownload = (id: string) => {
    setDownloadingId(id);
    setTimeout(() => {
      setDownloadingId(null);
    }, 1500);
  };

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
              {activeTab === 'policy' && 'Policy Action Center'}
              {activeTab === 'reports' && 'Automated PDF Reporting'}
              {activeTab === 'import' && 'Master Data Management'}
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
                  จาก schedules สด (ไม่นับคาบไม่มีนักเรียนเช่น PLC/ประชุม/พักกลางวัน) */}
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

          {activeTab === 'import' && (
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative z-10">
              <div className="bg-[#0f1219] border border-white/10 rounded-2xl p-10 shadow-xl">
                <h3 className="text-2xl font-bold text-white mb-2">Master Data Management</h3>
                <p className="text-slate-400 text-sm mb-8">Import official student rosters to auto-generate school credentials and directory links.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                  <div className="border-2 border-dashed border-slate-700 rounded-2xl p-10 flex flex-col items-center justify-center bg-slate-900/50 hover:bg-slate-900/80 hover:border-emerald-500/50 transition-colors cursor-pointer group">
                    <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <UploadCloud className="w-8 h-8 text-emerald-400" />
                    </div>
                    <p className="text-slate-200 font-medium mb-1">Drag and drop CSV here</p>
                    <p className="text-slate-500 text-xs mb-6">Supports .csv files up to 10MB</p>
                    <button className="px-6 py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg text-sm font-medium transition-colors">
                      Browse Files
                    </button>
                  </div>

                  <div className="flex flex-col justify-center space-y-4">
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                      <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">Field Name</div>
                      <div className="text-sm text-slate-300">Student ID (5-digit)</div>
                      <div className="text-[10px] text-slate-500 mt-1">Source: Academic Office (CSV)</div>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                      <div className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-1">Field Name</div>
                      <div className="text-sm text-slate-300">Email (@utd.ac.th)</div>
                      <div className="text-[10px] text-slate-500 mt-1">Source: Auto-generated System</div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-6 border-t border-white/10">
                  <button 
                    onClick={handleProcessData}
                    disabled={isProcessing || processed}
                    className={cn(
                      "flex items-center gap-2 px-8 py-3.5 rounded-xl text-sm font-bold transition-all shadow-lg",
                      processed 
                        ? "bg-emerald-600 text-white" 
                        : isProcessing
                          ? "bg-emerald-600/50 text-white/70 cursor-not-allowed"
                          : "bg-[#deff9a] text-[#05070a] hover:bg-[#c9f076] shadow-[0_0_20px_rgba(222,255,154,0.2)]"
                    )}
                  >
                    {isProcessing ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </>
                    ) : processed ? (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        System Synchronized
                      </>
                    ) : (
                      <>
                        Synchronize Data
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'health' && (
            <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative z-10">
              
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Health Risks KPI */}
                <div className="lg:col-span-1 flex flex-col gap-4">
                  <div className="bg-[#0f1219] border border-white/10 rounded-2xl p-6 shadow-xl">
                    <h3 className="text-sm font-medium text-slate-400 mb-6 uppercase tracking-widest">Prevalent Health Risks</h3>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-slate-300">Malnutrition</span>
                          <span className="text-rose-400 font-bold">{mockExecutiveData.healthRisks.malnutrition}%</span>
                        </div>
                        <div className="w-full bg-white/5 rounded-full h-2">
                          <div className="bg-rose-500 h-2 rounded-full" style={{ width: `${mockExecutiveData.healthRisks.malnutrition}%` }}></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-slate-300">Dental Issues</span>
                          <span className="text-orange-400 font-bold">{mockExecutiveData.healthRisks.dentalIssues}%</span>
                        </div>
                        <div className="w-full bg-white/5 rounded-full h-2">
                          <div className="bg-orange-500 h-2 rounded-full" style={{ width: `${mockExecutiveData.healthRisks.dentalIssues}%` }}></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-slate-300">Vision Impairment</span>
                          <span className="text-amber-400 font-bold">{mockExecutiveData.healthRisks.visionIssues}%</span>
                        </div>
                        <div className="w-full bg-white/5 rounded-full h-2">
                          <div className="bg-amber-400 h-2 rounded-full" style={{ width: `${mockExecutiveData.healthRisks.visionIssues}%` }}></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-slate-300">Mental Stress</span>
                          <span className="text-indigo-400 font-bold">{mockExecutiveData.healthRisks.mentalStress}%</span>
                        </div>
                        <div className="w-full bg-white/5 rounded-full h-2">
                          <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${mockExecutiveData.healthRisks.mentalStress}%` }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* BMI Distribution */}
                <div className="lg:col-span-1 bg-[#0f1219] border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col h-[350px]">
                  <h3 className="text-lg font-medium text-white mb-6">BMI Distribution</h3>
                  <div className="flex-1 w-full min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={mockExecutiveData.bmiDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                        <XAxis dataKey="category" stroke="#475569" tick={{fill: '#94a3b8', fontSize: 11}} axisLine={false} tickLine={false} />
                        <YAxis stroke="#475569" tick={{fill: '#94a3b8', fontSize: 12}} axisLine={false} tickLine={false} />
                        <RechartsTooltip 
                          cursor={{fill: '#ffffff05'}}
                          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                          itemStyle={{ color: '#deff9a' }}
                        />
                        <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]}>
                          {mockExecutiveData.bmiDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={index === 1 ? '#10b981' : index === 0 ? '#fbbf24' : '#ef4444'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Commute vs Performance Scatter */}
                <div className="lg:col-span-2 bg-[#0f1219] border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col h-[350px]">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-medium text-white">Commute vs. Performance Analysis</h3>
                    <span className="text-xs text-slate-400 bg-white/5 px-2 py-1 rounded">Distance (km) vs Attendance (%)</span>
                  </div>
                  <div className="flex-1 w-full min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 10, right: 20, left: -20, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" />
                        <XAxis type="number" dataKey="distance" name="Distance" unit="km" stroke="#475569" tick={{fill: '#94a3b8', fontSize: 12}} axisLine={false} tickLine={false} />
                        <YAxis type="number" dataKey="attendance" name="Attendance" unit="%" stroke="#475569" tick={{fill: '#94a3b8', fontSize: 12}} axisLine={false} tickLine={false} domain={['dataMin - 5', 100]} />
                        <ZAxis type="number" dataKey="late" range={[50, 400]} name="Late Days" />
                        <RechartsTooltip 
                          cursor={{strokeDasharray: '3 3'}}
                          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                          itemStyle={{ color: '#deff9a' }}
                        />
                        <Scatter name="Students" data={mockExecutiveData.correlationData} fill="#deff9a" opacity={0.6} />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>
            </div>
          )}

          {activeTab === 'policy' && (
            <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative z-10">
              <div className="flex flex-col mb-8">
                <h3 className="text-2xl font-bold text-white mb-2">Policy Action Center</h3>
                <p className="text-slate-400 text-sm">Review data-driven proposals and allocate resources effectively.</p>
              </div>

              <div className="space-y-6">
                {mockExecutiveData.policyProposals.map((proposal) => {
                  const status = actionStatuses[proposal.id];
                  return (
                    <div key={proposal.id} className="bg-[#0f1219] border border-white/10 rounded-2xl p-8 shadow-xl relative overflow-hidden">
                      {status === 'approved' && <div className="absolute inset-0 bg-emerald-500/5 pointer-events-none border border-emerald-500/20 rounded-2xl"></div>}
                      <div className="flex flex-col md:flex-row gap-6 justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <span className="px-2 py-1 bg-white/5 rounded text-xs font-mono text-slate-400">{proposal.id}</span>
                            <h4 className="text-xl font-bold text-white">{proposal.title}</h4>
                          </div>
                          <p className="text-slate-300 text-sm leading-relaxed mb-6">{proposal.description}</p>
                          
                          <div className="flex gap-6">
                            <div className="bg-white/5 px-4 py-2 rounded-lg border border-white/5">
                              <div className="text-xs text-slate-500 mb-1 uppercase tracking-wider">Affected Students</div>
                              <div className="text-lg font-bold text-indigo-400">{proposal.affectedStudents}</div>
                            </div>
                            <div className="bg-white/5 px-4 py-2 rounded-lg border border-white/5">
                              <div className="text-xs text-slate-500 mb-1 uppercase tracking-wider">Est. Budget</div>
                              <div className="text-lg font-bold text-amber-400">{proposal.estimatedBudget}</div>
                            </div>
                          </div>
                        </div>

                        <div className="w-full md:w-auto flex flex-col gap-3 shrink-0">
                          {status ? (
                            <div className={cn(
                              "flex items-center justify-center gap-2 px-6 py-3 rounded-xl border text-sm font-bold w-48",
                              status === 'approved' ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400" : "bg-slate-800 border-slate-600 text-slate-300"
                            )}>
                              <Check className="w-4 h-4" />
                              {status === 'approved' ? 'Approved' : 'Reviewed'}
                            </div>
                          ) : (
                            <>
                              <button 
                                onClick={() => handleAction(proposal.id, 'approved')}
                                className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-600/20 w-full md:w-48"
                              >
                                <CheckCircle2 className="w-4 h-4" /> Approve Resource
                              </button>
                              <button 
                                onClick={() => handleAction(proposal.id, 'reviewed')}
                                className="flex items-center justify-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-xl text-sm font-bold transition-all w-full md:w-48"
                              >
                                Mark as Reviewed
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative z-10">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-2xl font-bold text-white mb-2">Automated PDF Reporting</h3>
                  <p className="text-slate-400 text-sm">One-Click Export: Generate academic and behavioral summaries in seconds.</p>
                </div>
              </div>

              <div className="bg-[#0f1219] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#05070a] border-b border-white/10 text-slate-400">
                    <tr>
                      <th className="px-6 py-5 font-medium">Classroom</th>
                      <th className="px-6 py-5 font-medium">Homeroom Advisor</th>
                      <th className="px-6 py-5 font-medium text-center">Total Students</th>
                      <th className="px-6 py-5 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {[
                      { id: '1', class: 'Grade 7 (ม.1/1)', advisor: 'ครูสมปอง ใจดี', students: 45 },
                      { id: '2', class: 'Grade 7 (ม.1/2)', advisor: 'ครูวิภาดา รักเรียน', students: 42 },
                      { id: '3', class: 'Grade 8 (ม.2/1)', advisor: 'ครูมานะ อดทน', students: 48 },
                      { id: '4', class: 'Grade 9 (ม.3/1)', advisor: 'ครูปิติ ยินดี', students: 40 },
                    ].map(row => (
                      <tr key={row.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-5 font-bold text-slate-200">{row.class}</td>
                        <td className="px-6 py-5 text-slate-400">{row.advisor}</td>
                        <td className="px-6 py-5 text-center text-slate-300 font-mono">{row.students}</td>
                        <td className="px-6 py-5 text-right">
                          <button 
                            onClick={() => handleDownload(row.id)}
                            disabled={downloadingId === row.id}
                            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl text-xs font-bold transition-colors w-44"
                          >
                            {downloadingId === row.id ? (
                              <>
                                <svg className="animate-spin h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Generating PDF...
                              </>
                            ) : (
                              <>
                                <FileText className="w-4 h-4" />
                                Export Report
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

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
