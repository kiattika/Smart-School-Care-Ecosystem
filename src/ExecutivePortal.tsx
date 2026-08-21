import { cn } from "./lib/utils";
import { mockExecutiveData } from "./data/mockData";
import React, { useState } from 'react';
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


const getPinColor = (pin: any) => {
  if (pin.riskStatus === 'critical') return '#ef4444'; // Rose
  if (pin.riskStatus === 'warning') return '#fbbf24'; // Amber
  if (pin.isScholarship) return '#8b5cf6'; // Violet
  return '#10b981'; // Emerald
};

const createCustomIcon = (pin: any) => L.divIcon({
  className: 'custom-map-pin',
  html: `<div style="background-color: ${getPinColor(pin)}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 15px ${getPinColor(pin)};"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});


export function ExecutivePortal() {
  const { 
    lateAttendanceRequests, 
    updateLateAttendanceRequestStatus, 
    homeVisits, 
    schoolDuties, 
    administrativeTasks, 
    postTeachingRecords,
    students, 
    selfAssessments,
    activeLearningPoints,
    activeLearningLogs
  } = useStore();
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
  const [gisFilter, setGisFilter] = useState<'all' | 'risk' | 'scholarship'>('all');
  const [showHeatmap, setShowHeatmap] = useState(false);

  // States for Policy Actions
  const [actionStatuses, setActionStatuses] = useState<Record<string, 'approved' | 'reviewed' | null>>({});

  // States for Executive Report
  const [showReportModal, setShowReportModal] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const filteredPins = mockExecutiveData.gisStudents.filter(pin => {
    if (gisFilter === 'all') return true;
    if (gisFilter === 'risk') return pin.riskStatus === 'warning' || pin.riskStatus === 'critical';
    if (gisFilter === 'scholarship') return pin.isScholarship;
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
              
              <div className="flex justify-end">
                <button 
                  onClick={() => setShowReportModal(true)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all"
                >
                  <FileText className="w-5 h-5" />
                  ส่งออกรายงานสรุปผู้บริหาร (PDF)
                </button>
              </div>

              {/* 360° Care Score Dashboard */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-slate-400 uppercase tracking-widest mb-4">360° Executive Evaluation (5 KPI Pillars)</h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {[
                      { label: 'Academic Discipline', icon: FileText, score: '94%', desc: 'Post-teaching compliance' },
                      { label: 'Classroom Engagement', icon: Star, score: '88%', desc: 'Active scoring tools' },
                      { label: 'Home Visit Progress', icon: MapIcon, score: `${homeVisits.filter(v => v.geoVerified).length}/2`, desc: 'Geo-verified visits' },
                      { label: 'School Duty Punctuality', icon: Clock, score: '90%', desc: 'Gate & area check-ins' },
                      { label: 'Admin Task Delivery', icon: CheckCircle2, score: '95%', desc: 'Department tasks' },
                    ].map((kpi, idx) => (
                      <div key={idx} className="bg-[#0f1219] border border-white/10 rounded-2xl p-5 shadow-xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                          <kpi.icon className="w-16 h-16 text-indigo-500" />
                        </div>
                        <div className="text-3xl font-black text-indigo-400 mb-1">{kpi.score}</div>
                        <h3 className="text-xs font-bold text-slate-200 mb-1">{kpi.label}</h3>
                        <p className="text-[10px] text-slate-500">{kpi.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-[#0f1219] border border-white/10 rounded-2xl shadow-xl flex flex-col overflow-hidden">
                  <div className="p-6 border-b border-white/10 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-amber-400" /> Annual Rewards & Promotions Shortlist
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">Teacher ranking based on aggregated 360° Care Scores</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input type="text" placeholder="Filter by Department..." className="bg-black/20 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 w-48" />
                      </div>
                      <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors">
                        <Filter className="w-4 h-4" /> Sort: Highest KPI
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-300">
                      <thead className="text-xs uppercase bg-black/40 text-slate-400">
                        <tr>
                          <th className="px-6 py-4 font-medium">Rank</th>
                          <th className="px-6 py-4 font-medium">Teacher</th>
                          <th className="px-6 py-4 font-medium">Department</th>
                          <th className="px-6 py-4 font-medium">Total KPI</th>
                          <th className="px-6 py-4 font-medium text-center">Pillar 1</th>
                          <th className="px-6 py-4 font-medium text-center">Pillar 2</th>
                          <th className="px-6 py-4 font-medium text-center">Pillar 3</th>
                          <th className="px-6 py-4 font-medium text-center">Pillar 4</th>
                          <th className="px-6 py-4 font-medium text-center">Pillar 5</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {[
                          { rank: 1, name: 'คุณครู สมใจ รักสอน', dept: 'วิทยาศาสตร์', score: 96, p1: '98%', p2: '95%', p3: '100%', p4: '92%', p5: '100%' },
                          { rank: 2, name: 'คุณครู มานะ บากบั่น', dept: 'คณิตศาสตร์', score: 92, p1: '95%', p2: '88%', p3: '90%', p4: '95%', p5: '92%' },
                          { rank: 3, name: 'คุณครู วีณา รื่นรมย์', dept: 'ศิลปะ', score: 85, p1: '80%', p2: '92%', p3: '70%', p4: '88%', p5: '95%' },
                          { rank: 4, name: 'นาย ก', dept: 'ภาษาไทย', score: 78, p1: '75%', p2: '80%', p3: '60%', p4: '85%', p5: '90%' },
                        ].map((teacher, idx) => (
                          <tr key={idx} className="hover:bg-white/5 transition-colors">
                            <td className="px-6 py-4">
                              <div className={cn("w-6 h-6 rounded flex items-center justify-center font-bold text-xs", teacher.rank === 1 ? "bg-amber-500 text-white" : teacher.rank === 2 ? "bg-slate-300 text-slate-800" : teacher.rank === 3 ? "bg-amber-700 text-white" : "bg-white/10")}>
                                {teacher.rank}
                              </div>
                            </td>
                            <td className="px-6 py-4 font-medium text-white">{teacher.name}</td>
                            <td className="px-6 py-4 text-slate-400">{teacher.dept}</td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <span className={cn("font-bold", teacher.score >= 90 ? "text-emerald-400" : teacher.score >= 80 ? "text-amber-400" : "text-rose-400")}>{teacher.score}</span>
                                <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                  <div className={cn("h-full rounded-full", teacher.score >= 90 ? "bg-emerald-400" : teacher.score >= 80 ? "bg-amber-400" : "bg-rose-400")} style={{ width: `${teacher.score}%` }}></div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center text-xs text-slate-400">{teacher.p1}</td>
                            <td className="px-6 py-4 text-center text-xs text-slate-400">{teacher.p2}</td>
                            <td className="px-6 py-4 text-center text-xs text-slate-400">{teacher.p3}</td>
                            <td className="px-6 py-4 text-center text-xs text-slate-400">{teacher.p4}</td>
                            <td className="px-6 py-4 text-center text-xs text-slate-400">{teacher.p5}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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
                        <span className="text-xs bg-black/30 px-2 py-1 rounded-md">{mockExecutiveData.gisStudents.length}</span>
                      </button>

                      <button 
                        onClick={() => setGisFilter('risk')}
                        className={cn("w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all", gisFilter === 'risk' ? "bg-rose-500/10 border-rose-500/50 text-rose-300" : "bg-white/5 border-transparent text-slate-400 hover:bg-white/10")}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]"></div>
                          <span className="font-medium text-sm">กลุ่มเสี่ยง (At-Risk)</span>
                        </div>
                        <span className="text-xs bg-black/30 px-2 py-1 rounded-md">{mockExecutiveData.gisStudents.filter(p => p.riskStatus === 'warning' || p.riskStatus === 'critical').length}</span>
                      </button>

                      <button 
                        onClick={() => setGisFilter('scholarship')}
                        className={cn("w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all", gisFilter === 'scholarship' ? "bg-violet-500/10 border-violet-500/50 text-violet-300" : "bg-white/5 border-transparent text-slate-400 hover:bg-white/10")}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.8)]"></div>
                          <span className="font-medium text-sm">นักเรียนทุน คสศ.</span>
                        </div>
                        <span className="text-xs bg-black/30 px-2 py-1 rounded-md">{mockExecutiveData.gisStudents.filter(p => p.isScholarship).length}</span>
                      </button>
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
                        icon={showHeatmap && (pin.riskStatus === 'critical' || pin.riskStatus === 'warning') ? L.divIcon({
                          className: 'heatmap-pin',
                          html: `<div style="background: radial-gradient(circle, rgba(239,68,68,0.8) 0%, rgba(239,68,68,0) 70%); width: 60px; height: 60px; border-radius: 50%; transform: translate(-20px, -20px);"></div>`,
                          iconSize: [20, 20],
                          iconAnchor: [10, 10]
                        }) : createCustomIcon(pin)}
                      >
                        <Popup className="custom-popup">
                          <div className="p-1 font-sans">
                            <h4 className="font-bold text-slate-800 text-sm mb-1">{pin.name.replace(/^[นายด.ช.ญ.\s]+/, 'Student #')}</h4>
                            <p className="text-xs text-slate-600 mb-1">ระยะทาง: {pin.commuteDistance}</p>
                            <p className="text-xs text-slate-600">
                              สถานะ: {pin.riskStatus === 'safe' ? 'ปลอดภัย' : pin.riskStatus === 'warning' ? 'เฝ้าระวัง' : 'วิกฤต'}
                              {pin.isScholarship && ' (ทุน คสศ.)'}
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
                              <Clock className="w-4 h-4" /> {request?.createdAt ? new Date(request.createdAt).toLocaleString('th-TH') : '-'}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <div className="text-xs text-slate-500 mb-1">Teacher</div>
                              <div className="font-medium text-white">{request.teacherName}</div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-500 mb-1">Class / Subject</div>
                              <div className="font-medium text-white">{request.room} - {request.subjectCode} {request.subjectName}</div>
                            </div>
                            <div className="col-span-2">
                              <div className="text-xs text-slate-500 mb-1">Period</div>
                              <div className="font-medium text-amber-400">{request.period}</div>
                            </div>
                          </div>
                          
                          <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                            <div className="text-xs text-slate-500 mb-2 font-bold uppercase tracking-wider">Reason provided</div>
                            <p className="text-sm text-slate-300 leading-relaxed">{request.reason}</p>
                          </div>
                        </div>
                        
                        {request.status === 'PENDING' && (
                          <div className="flex md:flex-col gap-3 justify-center shrink-0 w-full md:w-48">
                            <button 
                              onClick={() => updateLateAttendanceRequestStatus(request.id, 'APPROVED')}
                              className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-all flex items-center justify-center gap-2"
                            >
                              <Check className="w-4 h-4" /> Approve
                            </button>
                            <button 
                              onClick={() => updateLateAttendanceRequestStatus(request.id, 'REJECTED')}
                              className="flex-1 py-3 bg-white/5 hover:bg-red-500/20 text-slate-300 hover:text-red-400 border border-white/10 hover:border-red-500/30 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2"
                            >
                              <X className="w-4 h-4" /> Reject
                            </button>
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

        {/* Executive Report Modal */}
        {showReportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-[#f8fafc] text-slate-900 rounded-lg w-[800px] h-[90vh] flex flex-col shadow-2xl overflow-hidden relative">
              
              {/* Toolbar */}
              <div className="bg-slate-900 text-white p-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-emerald-600 rounded flex items-center justify-center font-bold">E</div>
                  <h2 className="font-bold text-lg">Executive Summary Report (Preview)</h2>
                </div>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => {
                      setIsGeneratingReport(true);
                      setTimeout(() => setIsGeneratingReport(false), 2000);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded font-medium flex items-center gap-2 transition-all"
                  >
                    {isGeneratingReport ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <FileText className="w-4 h-4" />
                    )}
                    {isGeneratingReport ? 'Generating PDF...' : 'Download PDF'}
                  </button>
                  <button onClick={() => setShowReportModal(false)} className="text-slate-400 hover:text-white transition-colors">
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* A4 Document Area */}
              <div className="flex-1 overflow-y-auto p-8 bg-slate-200">
                <div className="max-w-[210mm] min-h-[297mm] mx-auto bg-white shadow-xl p-12 print:shadow-none print:p-0 relative font-sans text-slate-800">
                  
                  {/* Header */}
                  <div className="border-b-4 border-emerald-600 pb-6 mb-8 flex justify-between items-end">
                    <div>
                      <h1 className="text-3xl font-black text-slate-900 tracking-tight">EXECUTIVE SUMMARY</h1>
                      <h2 className="text-lg text-emerald-700 font-bold mt-1">Student Attendance & Wellness Intelligence</h2>
                    </div>
                    <div className="text-right text-sm text-slate-500 font-medium">
                      Report Date: {new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}<br/>
                      Generated via Executive IQ
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-8 mb-8">
                    {/* Section 1: KPI */}
                    <div className="col-span-2 flex justify-between bg-slate-50 p-6 rounded-lg border border-slate-100">
                      <div className="text-center">
                        <div className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">School-wide Attendance</div>
                        <div className="text-4xl font-black text-emerald-600">{mockExecutiveData.globalKPIs.avgAttendance}%</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Avg Behavior Score</div>
                        <div className="text-4xl font-black text-slate-800">{mockExecutiveData.globalKPIs.avgBehavior}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Critical Alerts</div>
                        <div className="text-4xl font-black text-red-500">{mockExecutiveData.globalKPIs.criticalAlerts}</div>
                      </div>
                    </div>

                    {/* Section 2: Charts (Static visual representation for print) */}
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b pb-2">Attendance Trends (Last 5 Months)</h3>
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={mockExecutiveData.attendanceTrends}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                            <XAxis dataKey="month" tick={{fill: '#64748b', fontSize: 12}} axisLine={false} tickLine={false} />
                            <YAxis domain={[80, 100]} tick={{fill: '#64748b', fontSize: 12}} axisLine={false} tickLine={false} />
                            <Area type="monotone" dataKey="attendance" stroke="#059669" fill="#10b981" fillOpacity={0.2} strokeWidth={2} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b pb-2">Risk Heatmap Distribution</h3>
                      <div className="h-48 flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={mockExecutiveData.riskProfile}
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {mockExecutiveData.riskProfile.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <RechartsTooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Wellness */}
                  <div className="mb-8">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b pb-2">Student Wellness Indicators</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {Object.entries(mockExecutiveData.healthRisks).map(([key, val]) => (
                        <div key={key} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded">
                          <span className="text-sm font-medium text-slate-600 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                          <span className="text-sm font-bold text-slate-800">{val}%</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Section 4: Flagged Students */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b pb-2 text-red-600 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" /> 
                      Students Flagged by Emergency Toggles
                    </h3>
                    <div className="overflow-hidden border border-slate-200 rounded-lg">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-xs">
                          <tr>
                            <th className="px-4 py-3">Masked ID</th>
                            <th className="px-4 py-3">Grade</th>
                            <th className="px-4 py-3">Flag Reason</th>
                            <th className="px-4 py-3">Priority</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {mockExecutiveData.gisStudents.filter(s => s.riskStatus !== 'safe').map((student, idx) => (
                            <tr key={idx} className="bg-white">
                              <td className="px-4 py-3 font-mono font-medium text-slate-700">***{student.id.slice(-2)}</td>
                              <td className="px-4 py-3 text-slate-600">{student.grade}</td>
                              <td className="px-4 py-3 text-slate-600">
                                {student.riskStatus === 'critical' ? 'Critical Attendance/Wellness Drop' : 'High Absence Rate (Warning)'}
                              </td>
                              <td className="px-4 py-3">
                                <span className={cn(
                                  "px-2 py-1 rounded text-xs font-bold",
                                  student.riskStatus === 'critical' ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                                )}>
                                  {student.riskStatus.toUpperCase()}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="absolute bottom-12 left-12 right-12 border-t pt-4 text-center text-xs text-slate-400">
                    Confidential & Proprietary • Do not distribute without authorization • Generated by Executive IQ System
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
