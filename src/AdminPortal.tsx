import { cn } from "./lib/utils";
import React, { useState } from 'react';
import { Upload, FileDown, CheckCircle2, AlertTriangle, Users, BookOpen, Clock, Loader2, Database, Mailbox, Edit3, Check, ArrowLeftRight, Trash2, UserCheck, Calendar, Settings, Bell, Layers, PanelLeft, PanelLeftClose, PanelLeftOpen, Menu, X, ChevronLeft, ChevronRight, FileSpreadsheet, ArrowRight, GraduationCap } from 'lucide-react';
import clsx, { ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useStore } from './store';
import { StaffRoleManagementPage } from './components/StaffRoleManagementPage';
import { StudentManagementPage } from './components/StudentManagementPage';
import { SystemSettingsAndLocksPage } from './components/SystemSettingsAndLocksPage';
import { PeriodManagementPage } from './components/PeriodManagementPage';
import { SubstituteTeachingModule } from './components/SubstituteTeachingModule';
import { SubstituteTeachingAnalyticsModule } from './components/SubstituteTeachingAnalyticsModule';
import { TeachingLoadTable } from './components/TeachingLoadTable';
import { BulkDataImportModal, ImportType } from './components/BulkDataImportModal';
import { BarChart3 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function AdminPortal() {
  const [activeTab, setActiveTab] = useState<'teaching-load' | 'import' | 'requests' | 'absence-sub' | 'sub-analytics' | 'users' | 'students' | 'settings' | 'periods'>('teaching-load');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [bulkImportType, setBulkImportType] = useState<ImportType>('COURSE');
  const [toast, setToast] = useState<string | null>(null);
  
  const { 
    scheduleChangeRequests, 
    updateScheduleChangeRequestStatus, 
    updateCourseSchedule, 
    courses, 
    periodSwaps,
    substituteAssignments,
    updatePeriodSwapStatus,
    assignSubstituteTeacher,
    removeSubstituteAssignment,
  } = useStore();
  
  const [editingSchedule, setEditingSchedule] = useState<{ id: string, value: string } | null>(null);

  // New states for substitution assignment form
  const [subCourseId, setSubCourseId] = useState<string>('');
  const [subSubstituteEmail, setSubSubstituteEmail] = useState<string>('');
  const [subDate, setSubDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const pendingRequestsCount = scheduleChangeRequests.filter(r => r.status === 'PENDING').length;
  const pendingAbsenceCount = periodSwaps.filter(ps => ps.status === 'PENDING_ADMIN').length;

  interface AdminNavItem {
    id: 'teaching-load' | 'import' | 'requests' | 'absence-sub' | 'sub-analytics' | 'users' | 'students' | 'settings' | 'periods';
    label: string;
    fullLabel: string;
    icon: React.ComponentType<{ className?: string }>;
    badge: number | null;
    color: string;
    badgeColor?: string;
    activeStyle: string;
  }

  const adminNavItems: AdminNavItem[] = [
    { id: 'teaching-load', label: 'ตารางภาระงานสอน', fullLabel: 'ตารางภาระงานสอนครู (Teaching Load)', icon: Layers, badge: null, color: 'text-blue-400', activeStyle: 'bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-[inset_4px_0_0_rgba(59,130,246,1)]' },
    { id: 'import', label: 'นำเข้าภาระงานสอน', fullLabel: 'นำเข้าภาระงานสอน (Import Excel)', icon: Upload, badge: null, color: 'text-blue-400', activeStyle: 'bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-[inset_4px_0_0_rgba(59,130,246,1)]' },
    { id: 'requests', label: 'คำร้องสลับคาบสอน', fullLabel: 'คำร้องขอสลับคาบสอน (Requests)', icon: Mailbox, badge: pendingRequestsCount > 0 ? pendingRequestsCount : null, color: 'text-blue-400', badgeColor: 'bg-red-500', activeStyle: 'bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-[inset_4px_0_0_rgba(59,130,246,1)]' },
    { id: 'absence-sub', label: 'ลาสอน & ครูสอนแทน', fullLabel: 'ลาสอน & จัดครูสอนแทน (Substitute)', icon: Clock, badge: pendingAbsenceCount > 0 ? pendingAbsenceCount : null, color: 'text-amber-400', badgeColor: 'bg-amber-500', activeStyle: 'bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-[inset_4px_0_0_rgba(245,158,11,1)]' },
    { id: 'sub-analytics', label: 'วิเคราะห์สอนแทน & PA', fullLabel: 'วิเคราะห์งานสอนแทน & PA', icon: BarChart3, badge: null, color: 'text-indigo-400', activeStyle: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 shadow-[inset_4px_0_0_rgba(99,102,241,1)]' },
    { id: 'users', label: 'จัดการสิทธิ์บุคลากร', fullLabel: 'จัดการสิทธิ์บุคลากร (User RBAC)', icon: Users, badge: null, color: 'text-blue-400', activeStyle: 'bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-[inset_4px_0_0_rgba(59,130,246,1)]' },
    { id: 'students', label: 'จัดการนักเรียน', fullLabel: 'จัดการข้อมูลนักเรียน (Student Roster)', icon: GraduationCap, badge: null, color: 'text-purple-400', activeStyle: 'bg-purple-500/10 text-purple-400 border-purple-500/20 shadow-[inset_4px_0_0_rgba(168,85,247,1)]' },
    { id: 'periods', label: 'ตารางเวลา & กระดิ่ง', fullLabel: 'จัดการตารางเวลา & กระดิ่งคาบเรียน', icon: Bell, badge: null, color: 'text-indigo-400', activeStyle: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 shadow-[inset_4px_0_0_rgba(99,102,241,1)]' },
    { id: 'settings', label: 'ปีการศึกษา & ล็อกระบบ', fullLabel: 'ตั้งค่าปีการศึกษา & ล็อกระบบ (System Lock)', icon: Settings, badge: null, color: 'text-pink-400', activeStyle: 'bg-[#ec4899]/10 text-[#ec4899] border-[#ec4899]/20 shadow-[inset_4px_0_0_rgba(236,72,153,1)]' },
  ];

  return (
    <div className="min-h-screen bg-[#05070a] text-slate-200 font-sans selection:bg-emerald-500/30 flex flex-col">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 fade-in duration-300">
          <div className="bg-emerald-900/90 border border-emerald-500/30 backdrop-blur-md text-emerald-100 px-6 py-3 rounded-full shadow-[0_0_30px_rgba(16,185,129,0.2)] flex items-center gap-3 font-medium">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            {toast}
          </div>
        </div>
      )}

      {/* Mobile Drawer Backdrop */}
      {isMobileMenuOpen && (
        <div 
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 lg:hidden transition-opacity duration-300"
        />
      )}

      {/* Mobile Drawer Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-72 bg-[#0a0f16] border-r border-white/10 flex flex-col transform transition-transform duration-300 ease-in-out lg:hidden shadow-2xl",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-20 flex items-center justify-between px-5 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shadow-inner">
              <Database className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight">Admin Console</h1>
              <p className="text-xs text-slate-400">การจัดการระบบส่วนกลาง</p>
            </div>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
          {adminNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button 
                key={item.id}
                onClick={() => {
                  if (item.id === 'import') {
                    setBulkImportType('COURSE');
                    setIsBulkImportOpen(true);
                  }
                  setActiveTab(item.id as any);
                  setIsMobileMenuOpen(false);
                }}
                className={cn(
                  "w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                  isActive ? item.activeStyle : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon className={cn("w-4 h-4", isActive ? item.color : "text-slate-400")} />
                  <span>{item.fullLabel}</span>
                </div>
                {item.badge && (
                  <span className={cn(
                    "text-white text-[10px] font-bold px-2 py-0.5 rounded-full",
                    item.badgeColor || "bg-blue-500"
                  )}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Top Navigation */}
      <header className="bg-[#0a0f16] border-b border-white/10 sticky top-0 z-40">
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            {/* Mobile Hamburger Button */}
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 border border-slate-700/50 transition-colors shrink-0"
              title="เปิดเมนู (Open Menu)"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Desktop Collapse / Expand Toggle Button */}
            <button 
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="hidden lg:flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/80 border border-slate-700/60 transition-all shrink-0"
              title={isSidebarCollapsed ? "ขยายเมนูด้านซ้าย (Expand Sidebar)" : "ย่อ/ซ่อนเมนูด้านซ้าย (Collapse Sidebar)"}
            >
              {isSidebarCollapsed ? (
                <>
                  <PanelLeftOpen className="w-4 h-4 text-blue-400" />
                  <span>แสดงเมนูด้านซ้าย</span>
                </>
              ) : (
                <>
                  <PanelLeftClose className="w-4 h-4 text-blue-400" />
                  <span>ซ่อนเมนูด้านซ้าย</span>
                </>
              )}
            </button>

            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shadow-inner shrink-0 hidden sm:flex">
              <Database className="w-5 h-5 text-blue-400" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold text-white tracking-tight truncate">System Administration</h1>
              <p className="text-xs text-slate-400 font-medium truncate hidden sm:block">Global Configuration & Sync</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-bold text-slate-200">Super Admin</div>
              <div className="text-xs text-blue-400">Global Access</div>
            </div>
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-slate-300 text-xs sm:text-sm font-bold overflow-hidden shadow-inner">
              SA
            </div>
          </div>
        </div>
      </header>

      <main className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 flex gap-6 sm:gap-8 flex-1">
        
        {/* Desktop Sidebar (Collapsible) */}
        <div className={cn(
          "shrink-0 flex flex-col gap-2 relative z-10 hidden lg:flex transition-all duration-300 ease-in-out",
          isSidebarCollapsed ? "w-16" : "w-64"
        )}>
          {/* Header of Sidebar */}
          <div className={cn(
            "flex items-center pb-2 border-b border-white/5",
            isSidebarCollapsed ? "justify-center" : "justify-between px-2"
          )}>
            {!isSidebarCollapsed && (
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">เมนูจัดการระบบ</span>
            )}
            <button 
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title={isSidebarCollapsed ? "ขยายเมนู (Expand)" : "ย่อ/ซ่อนเมนู (Collapse)"}
            >
              {isSidebarCollapsed ? <PanelLeftOpen className="w-4 h-4 text-blue-400" /> : <PanelLeftClose className="w-4 h-4 text-slate-400" />}
            </button>
          </div>

          {/* Navigation Items */}
          <div className="space-y-1.5 flex-1">
            {adminNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button 
                  key={item.id}
                  onClick={() => {
                    if (item.id === 'import') {
                      setBulkImportType('COURSE');
                      setIsBulkImportOpen(true);
                    }
                    setActiveTab(item.id as any);
                  }}
                  title={isSidebarCollapsed ? item.fullLabel : undefined}
                  className={cn(
                    "w-full flex items-center rounded-xl text-sm font-medium transition-all duration-200 relative group",
                    isSidebarCollapsed ? "justify-center px-0 py-3" : "justify-between px-3.5 py-3",
                    isActive ? item.activeStyle : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={cn("w-4 h-4 shrink-0", isActive ? item.color : "text-slate-400 group-hover:text-slate-200")} />
                    {!isSidebarCollapsed && (
                      <span className="truncate whitespace-nowrap text-left">{item.label}</span>
                    )}
                  </div>
                  
                  {/* Badge in expanded mode */}
                  {item.badge && !isSidebarCollapsed && (
                    <span className={cn(
                      "text-white text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0",
                      item.badgeColor || "bg-blue-500"
                    )}>
                      {item.badge}
                    </span>
                  )}

                  {/* Dot Badge in collapsed mode */}
                  {item.badge && isSidebarCollapsed && (
                    <span className={cn(
                      "absolute top-2 right-2 w-2.5 h-2.5 rounded-full ring-2 ring-[#05070a]",
                      item.badgeColor || "bg-blue-500"
                    )} />
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
          </div>

          {/* Sidebar Footer Collapse Toggle */}
          <div className="pt-2 border-t border-white/5">
            <button 
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800/60 border border-slate-700/40 transition-all",
                isSidebarCollapsed ? "px-0" : ""
              )}
              title={isSidebarCollapsed ? "ขยายเมนูด้านซ้าย" : "ย่อ/ซ่อนเมนูด้านซ้าย"}
            >
              {isSidebarCollapsed ? (
                <PanelLeftOpen className="w-4 h-4 text-blue-400" />
              ) : (
                <>
                  <PanelLeftClose className="w-4 h-4 text-blue-400" />
                  <span className="truncate">ซ่อนเมนูด้านซ้าย</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {activeTab === 'teaching-load' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex justify-between items-end border-b border-white/5 pb-4">
                    <div>
                      <h2 className="text-2xl font-bold text-white tracking-tight">ตารางภาระงานสอนครู (Teaching Load Roster)</h2>
                      <p className="text-slate-400 mt-1 text-sm">ข้อมูลภาระงานสอนอย่างเป็นทางการจากฐานข้อมูล Firestore ของโรงเรียน</p>
                    </div>
                  </div>
                  <TeachingLoadTable onOpenImport={() => {
                    setBulkImportType('COURSE');
                    setIsBulkImportOpen(true);
                  }} />
                </div>
              )}

              {activeTab === 'import' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
                    <div>
                      <h2 className="text-2xl font-bold text-white tracking-tight">ระบบนำเข้าข้อมูลขนาดใหญ่ (Bulk Data Import)</h2>
                      <p className="text-slate-400 mt-1 text-sm">นำเข้าข้อมูลบุคลากรครู, นักเรียน, และรายงานภาระงานสอนลงฐานข้อมูล Firestore</p>
                    </div>

                    <button
                      onClick={() => {
                        setBulkImportType('COURSE');
                        setIsBulkImportOpen(true);
                      }}
                      className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.35)] flex items-center gap-2 transition-all cursor-pointer shrink-0"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      เปิดหน้าต่างนำเข้าข้อมูล (Open Import Modal)
                    </button>
                  </div>

                  {/* 3 Unified Import Flow Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {/* Course & Schedule Import Card */}
                    <div className="bg-[#0f1219] border border-blue-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden flex flex-col justify-between group hover:border-blue-500/60 transition-all">
                      <div className="space-y-3">
                        <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                          <BookOpen className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-bold text-white">1. นำเข้าตารางสอน & ภาระงานครู</h3>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          อ่านไฟล์รายงานภาระงานสอน Excel (.xlsx) และสร้างเอกสารลงใน Collection <code className="text-blue-400 font-mono">schedules</code> พร้อมจับคู่ครูผู้สอนอัตโนมัติ
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setBulkImportType('COURSE');
                          setIsBulkImportOpen(true);
                        }}
                        className="mt-6 w-full py-2.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                      >
                        <span>นำเข้าไฟล์ตารางสอน</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Teacher Import Card */}
                    <div className="bg-[#0f1219] border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden flex flex-col justify-between group hover:border-white/20 transition-all">
                      <div className="space-y-3">
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                          <Users className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-bold text-white">2. นำเข้าข้อมูลครู & บุคลากร</h3>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          นำเข้ารายชื่อครู, อีเมล (@utd.ac.th), ตำแหน่ง และกลุ่มสาระการเรียนรู้ลง Collection <code className="text-emerald-400 font-mono">staff</code>
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setBulkImportType('TEACHER');
                          setIsBulkImportOpen(true);
                        }}
                        className="mt-6 w-full py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                      >
                        <span>นำเข้ารายชื่อครู</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Student Import Card */}
                    <div className="bg-[#0f1219] border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden flex flex-col justify-between group hover:border-white/20 transition-all">
                      <div className="space-y-3">
                        <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                          <UserCheck className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-bold text-white">3. นำเข้าข้อมูลนักเรียน & โฮมรูม</h3>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          นำเข้าทะเบียนนักเรียนรายห้อง (ม.1 - ม.6), เลขประจำตัว, และครูที่ปรึกษาลง Collection <code className="text-purple-400 font-mono">students</code>
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setBulkImportType('STUDENT');
                          setIsBulkImportOpen(true);
                        }}
                        className="mt-6 w-full py-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                      >
                        <span>นำเข้ารายชื่อนักเรียน</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

          {activeTab === 'requests' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex justify-between items-end border-b border-white/5 pb-4">
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">Schedule Requests Inbox</h2>
                  <p className="text-slate-400 mt-1 text-sm">จัดการคำร้องขอแก้ไขและสลับตารางสอนจากครูผู้สอน</p>
                </div>
              </div>

              {scheduleChangeRequests.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-white/10 rounded-2xl bg-[#151921]">
                  <Mailbox className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-slate-300 mb-2">ไม่มีคำร้องขอใหม่</h3>
                  <p className="text-slate-500">ยังไม่มีการแจ้งขอสลับคาบสอนในขณะนี้</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {scheduleChangeRequests.map(req => {
                    const course = courses.find(c => c.id === req.courseId);
                    
                    return (
                      <div key={req.id} className="bg-[#0f1219] border border-white/10 rounded-2xl p-6 transition-all">
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                          <div className="space-y-4 flex-1">
                            <div>
                              <div className="flex items-center gap-3 mb-1">
                                <span className={cn(
                                  "text-xs font-bold px-2 py-1 rounded",
                                  req.status === 'PENDING' ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                                  req.status === 'APPROVED' ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                                  "bg-red-500/10 text-red-400 border border-red-500/20"
                                )}>
                                  {req.status === 'PENDING' ? 'รออนุมัติ' : req.status === 'APPROVED' ? 'อนุมัติแล้ว' : 'ไม่อนุมัติ'}
                                </span>
                                <span className="text-slate-400 text-sm">
                                  {req.createdAt ? (typeof req.createdAt === 'string' ? new Date(req.createdAt).toLocaleDateString('th-TH') : req.createdAt.toLocaleDateString?.('th-TH')) : '-'}
                                </span>
                              </div>
                              <h3 className="text-lg font-bold text-white">{req.teacherName}</h3>
                              <p className="text-slate-400">วิชา: <span className="text-slate-200">{req.subjectCode}</span> | ห้อง: <span className="text-slate-200">{req.room}</span></p>
                            </div>
                            
                            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                              <div className="text-sm font-bold text-slate-300 mb-1">หมายเหตุการขอแก้ไข:</div>
                              <p className="text-slate-400 text-sm">"{req.note}"</p>
                            </div>
                          </div>
                          
                          <div className="w-full md:w-64 bg-slate-900 border border-white/5 rounded-xl p-4 shrink-0 flex flex-col justify-center">
                            <div className="text-sm text-slate-400 mb-2 font-medium">ตารางสอนปัจจุบัน: <span className="font-mono text-slate-200">{course?.schedule || req.currentSchedule}</span></div>
                            
                            {req.status === 'PENDING' && (
                              <div className="space-y-3">
                                {editingSchedule?.id === req.id ? (
                                  <div className="flex gap-2">
                                    <input 
                                      type="text" 
                                      value={editingSchedule.value}
                                      onChange={(e) => setEditingSchedule({ ...editingSchedule, value: e.target.value })}
                                      className="w-full bg-black/50 border border-blue-500/50 rounded-lg p-2 text-sm text-white font-mono outline-none focus:ring-1 focus:ring-blue-500"
                                      placeholder="เช่น อ2, พฤ3-4"
                                    />
                                    <button
                                      onClick={() => {
                                        updateCourseSchedule(req.courseId, editingSchedule.value);
                                        updateScheduleChangeRequestStatus(req.id, 'APPROVED');
                                        setEditingSchedule(null);
                                        showToast('อัปเดตตารางสอนสำเร็จ');
                                      }}
                                      className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-lg transition-colors"
                                    >
                                      <Check className="w-4 h-4" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => setEditingSchedule({ id: req.id, value: course?.schedule || req.currentSchedule })}
                                      className="flex-1 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                                    >
                                      <Edit3 className="w-4 h-4" /> แก้ไขตาราง (Overwrite)
                                    </button>
                                  </div>
                                )}
                                
                                <button
                                  onClick={() => updateScheduleChangeRequestStatus(req.id, 'REJECTED')}
                                  className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 py-2 rounded-lg text-sm font-medium transition-colors"
                                >
                                  ปฏิเสธ (Reject)
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'absence-sub' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <SubstituteTeachingModule />
            </div>
          )}

          {activeTab === 'sub-analytics' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <SubstituteTeachingAnalyticsModule />
            </div>
          )}

          {activeTab === 'users' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <StaffRoleManagementPage />
            </div>
          )}

          {activeTab === 'students' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <StudentManagementPage />
            </div>
          )}

          {activeTab === 'periods' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <PeriodManagementPage />
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              <SystemSettingsAndLocksPage />
              
              {/* Database Control Card */}
              <div className="bg-[#0e131f] border border-white/5 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                    <Database className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">จัดการระบบฐานข้อมูล Firebase (Firebase Database Manager)</h3>
                    <p className="text-xs text-slate-400">ควบคุมและตั้งค่าจำลองข้อมูลเริ่มต้นเข้าฐานข้อมูล Firestore</p>
                  </div>
                </div>
                
                <div className="bg-slate-900/50 rounded-xl p-4 border border-white/5 space-y-2">
                  <h4 className="text-xs font-bold text-indigo-300">ข้อมูลเริ่มต้นที่จะหยอดเข้าระบบ (Seed Datasets):</h4>
                  <ul className="text-xs text-slate-400 list-disc list-inside space-y-1">
                    <li>ข้อมูลคาบเรียน คาบ 0 (โฮมรูม) และ คาบเรียน 1 ถึง 8</li>
                    <li>ข้อมูลบัญชีครู (Mr.Kiattisak และ Mrs.Koy Koy)</li>
                    <li>ข้อมูลนักเรียนห้อง ม.5/8 (สมชาย ใจดี, สมหญิง มุ่งมั่น, วิชัย ชัยชนะ) พร้อมคะแนนพฤติกรรมเต็ม 100 คะแนน</li>
                    <li>ตารางเรียนวิชา ค32101 และ ตารางโฮมรูมของห้อง ม.5/8</li>
                  </ul>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={async () => {
                      try {
                        const { seedDatabaseWeb } = await import('./services/firestoreService');
                        await seedDatabaseWeb();
                        alert("🎉 สำเร็จ! หยอดข้อมูลเริ่มต้นเข้าสู่ Firebase Firestore เรียบร้อยแล้วค่ะ");
                      } catch (err) {
                        alert("❌ เกิดข้อผิดพลาด: " + (err instanceof Error ? err.message : String(err)));
                      }
                    }}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-md transition-all active:scale-[0.98] flex items-center gap-2 cursor-pointer"
                  >
                    <Database className="w-4 h-4" />
                    หยอดข้อมูลเริ่มต้น (Seed Database)
                  </button>
                </div>
              </div>
            </div>
          )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Real Firestore Bulk Data Import Modal */}
      <BulkDataImportModal
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        initialImportType={bulkImportType}
        onImportSuccess={(type, count) => {
          showToast(`นำเข้าข้อมูล ${type} สำเร็จ (${count} รายการ)`);
        }}
      />
    </div>
  );
}
