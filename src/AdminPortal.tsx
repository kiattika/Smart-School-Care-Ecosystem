import { cn } from "./lib/utils";
import React, { useState } from 'react';
import { format } from 'date-fns';
import { Upload, FileDown, CheckCircle2, AlertTriangle, Users, BookOpen, Clock, Loader2, Database, ArrowLeftRight, Trash2, UserCheck, Calendar, Settings, Bell, Layers, ArrowRight, GraduationCap } from 'lucide-react';
import clsx, { ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useStore } from './store';
import { StaffRoleManagementPage } from './components/StaffRoleManagementPage';
import { StudentManagementPage } from './components/StudentManagementPage';
import { SystemSettingsAndLocksPage } from './components/SystemSettingsAndLocksPage';
import { AdminPeriodsConfigPage } from './components/admin/AdminPeriodsConfigPage';
import { SubstituteTeachingModule } from './components/SubstituteTeachingModule';
import { SubstituteTeachingAnalyticsModule } from './components/SubstituteTeachingAnalyticsModule';
import { TeachingLoadTable } from './components/TeachingLoadTable';
import { BulkDataImportModal, ImportType } from './components/BulkDataImportModal';
import { ElectiveActivityManagerPage } from './components/admin/ElectiveActivityManagerPage';
import { HouseManagerPage } from './components/admin/HouseManagerPage';
import { BarChart3, Palette } from 'lucide-react';
import { PortalSidebarLayout } from './components/shared/PortalSidebarLayout';
import { motion, AnimatePresence } from 'motion/react';

export function AdminPortal() {
  const [activeTab, setActiveTab] = useState<'teaching-load' | 'import' | 'absence-sub' | 'sub-analytics' | 'users' | 'students' | 'settings' | 'periods' | 'electives' | 'houses'>('teaching-load');
  const [bulkImportType, setBulkImportType] = useState<ImportType>('COURSE');
  // การนำเข้าข้อมูลมีที่เดียว: BulkDataImportModal แบบ inline ในเมนู 'import' — หน้าอื่นพามาที่นี่พร้อมเลือกชนิดไว้ให้
  const goToImport = (type: ImportType) => {
    setBulkImportType(type);
    setActiveTab('import');
  };
  const [toast, setToast] = useState<string | null>(null);
  
  const {
    substituteAssignments,
    assignSubstituteTeacher,
    removeSubstituteAssignment,
  } = useStore();

  // New states for substitution assignment form
  const [subCourseId, setSubCourseId] = useState<string>('');
  const [subSubstituteEmail, setSubSubstituteEmail] = useState<string>('');
  // .toISOString() แปลงเป็น UTC เสมอ — ช่วงเที่ยงคืน-ตี 6 กว่าๆ ตามเวลาไทย (UTC+7) จะลากวันถอยหลัง
  // ไป 1 วัน ใช้ format() จาก date-fns แทน (คำนวณจาก local time fields ตรงๆ)
  const [subDate, setSubDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  interface AdminNavItem {
    id: 'teaching-load' | 'import' | 'absence-sub' | 'sub-analytics' | 'users' | 'students' | 'settings' | 'periods' | 'electives' | 'houses';
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
    { id: 'import', label: 'ระบบนำเข้าข้อมูลขนาดใหญ่', fullLabel: 'ระบบนำเข้าข้อมูลขนาดใหญ่ (Bulk Data Import)', icon: Upload, badge: null, color: 'text-blue-400', activeStyle: 'bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-[inset_4px_0_0_rgba(59,130,246,1)]' },
    { id: 'absence-sub', label: 'ลาสอน & ครูสอนแทน', fullLabel: 'ลาสอน & จัดครูสอนแทน (Substitute)', icon: Clock, badge: null, color: 'text-amber-400', badgeColor: 'bg-amber-500', activeStyle: 'bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-[inset_4px_0_0_rgba(245,158,11,1)]' },
    { id: 'sub-analytics', label: 'วิเคราะห์สอนแทน & PA', fullLabel: 'วิเคราะห์งานสอนแทน & PA', icon: BarChart3, badge: null, color: 'text-indigo-400', activeStyle: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 shadow-[inset_4px_0_0_rgba(99,102,241,1)]' },
    { id: 'users', label: 'จัดการสิทธิ์บุคลากร', fullLabel: 'จัดการสิทธิ์บุคลากร (User RBAC)', icon: Users, badge: null, color: 'text-blue-400', activeStyle: 'bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-[inset_4px_0_0_rgba(59,130,246,1)]' },
    { id: 'students', label: 'จัดการนักเรียน', fullLabel: 'จัดการข้อมูลนักเรียน (Student Roster)', icon: GraduationCap, badge: null, color: 'text-purple-400', activeStyle: 'bg-purple-500/10 text-purple-400 border-purple-500/20 shadow-[inset_4px_0_0_rgba(168,85,247,1)]' },
    { id: 'periods', label: 'ตารางเวลา & กระดิ่ง', fullLabel: 'จัดการตารางเวลา & กระดิ่งคาบเรียน', icon: Bell, badge: null, color: 'text-indigo-400', activeStyle: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 shadow-[inset_4px_0_0_rgba(99,102,241,1)]' },
    { id: 'electives', label: 'จัดการชุมนุม', fullLabel: 'จัดการชุมนุม (Elective Activities)', icon: Users, badge: null, color: 'text-teal-400', activeStyle: 'bg-teal-500/10 text-teal-400 border-teal-500/20 shadow-[inset_4px_0_0_rgba(20,184,166,1)]' },
    { id: 'houses', label: 'จัดการคณะสี', fullLabel: 'จัดการคณะสี (House)', icon: Palette, badge: null, color: 'text-rose-400', activeStyle: 'bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-[inset_4px_0_0_rgba(244,63,94,1)]' },
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

      {/* Top Navigation */}
      <header className="bg-[#0a0f16] border-b border-white/10 sticky top-0 z-40">
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
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

      <main className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 flex-1">
        
        {/* เมนูย่อย — แถบด้านซ้ายแบบเดียวกันทุก portal (PortalSidebarLayout) */}
        <PortalSidebarLayout
          title="เมนูจัดการระบบ"
          activeId={activeTab}
          onSelect={(id) => setActiveTab(id as typeof activeTab)}
          items={adminNavItems.map(item => ({ id: item.id, label: item.label, icon: item.icon, badge: item.badge }))}
        >
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
                  <TeachingLoadTable onOpenImport={() => goToImport('COURSE')} />
                </div>
              )}

              {activeTab === 'import' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="border-b border-white/5 pb-4">
                    <h2 className="text-2xl font-bold text-white tracking-tight">ระบบนำเข้าข้อมูลขนาดใหญ่ (Bulk Data Import)</h2>
                    <p className="text-slate-400 mt-1 text-sm">นำเข้าข้อมูลบุคลากรครู, นักเรียน, และรายงานภาระงานสอนลงฐานข้อมูล Firestore</p>
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
                        onClick={() => setBulkImportType('COURSE')}
                        className={cn(
                          "mt-6 w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer border",
                          bulkImportType === 'COURSE'
                            ? "bg-blue-600/40 text-blue-200 border-blue-400/60"
                            : "bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border-blue-500/30"
                        )}
                      >
                        <span>{bulkImportType === 'COURSE' ? 'กำลังเลือกอยู่ — ดูฟอร์มด้านล่าง' : 'นำเข้าไฟล์ตารางสอน'}</span>
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
                        onClick={() => setBulkImportType('TEACHER')}
                        className={cn(
                          "mt-6 w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer border",
                          bulkImportType === 'TEACHER'
                            ? "bg-emerald-600/40 text-emerald-200 border-emerald-400/60"
                            : "bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border-emerald-500/30"
                        )}
                      >
                        <span>{bulkImportType === 'TEACHER' ? 'กำลังเลือกอยู่ — ดูฟอร์มด้านล่าง' : 'นำเข้ารายชื่อครู'}</span>
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
                        onClick={() => setBulkImportType('STUDENT')}
                        className={cn(
                          "mt-6 w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer border",
                          bulkImportType === 'STUDENT'
                            ? "bg-purple-600/40 text-purple-200 border-purple-400/60"
                            : "bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border-purple-500/30"
                        )}
                      >
                        <span>{bulkImportType === 'STUDENT' ? 'กำลังเลือกอยู่ — ดูฟอร์มด้านล่าง' : 'นำเข้ารายชื่อนักเรียน'}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* TASK 5: render เป็น section เต็มหน้าตรงนี้เลย (variant="inline") แทนที่จะเป็น
                      popup overlay ลอย — เนื้อหา/ฟังก์ชันข้างในเหมือนเดิมทุกประการ เปลี่ยนแค่ wrapper
                      เปลี่ยนประเภทไฟล์ที่จะนำเข้าได้จาก 3 การ์ดด้านบน (bulkImportType) */}
                  <BulkDataImportModal
                    isOpen={true}
                    onClose={() => {}}
                    initialImportType={bulkImportType}
                    variant="inline"
                    onImportSuccess={(type, count) => {
                      showToast(`นำเข้าข้อมูล ${type} สำเร็จ (${count} รายการ)`);
                    }}
                  />
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
              <StaffRoleManagementPage onGoToImport={() => goToImport('TEACHER')} />
            </div>
          )}

          {activeTab === 'students' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <StudentManagementPage onGoToImport={() => goToImport('STUDENT')} />
            </div>
          )}

          {activeTab === 'periods' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <AdminPeriodsConfigPage />
            </div>
          )}

          {activeTab === 'electives' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <ElectiveActivityManagerPage />
            </div>
          )}

          {activeTab === 'houses' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <HouseManagerPage />
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              <SystemSettingsAndLocksPage />
            </div>
          )}
            </motion.div>
          </AnimatePresence>
        </PortalSidebarLayout>
      </main>

    </div>
  );
}
