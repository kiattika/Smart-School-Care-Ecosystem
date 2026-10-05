import { cn } from "./lib/utils";
import React, { useState } from 'react';
import { format } from 'date-fns';
import { Upload, FileDown, CheckCircle2, AlertTriangle, Users, BookOpen, Clock, Loader2, Database, ArrowLeftRight, Trash2, UserCheck, Calendar, Settings, Bell, Layers, ArrowRight, GraduationCap, ShieldCheck } from 'lucide-react';
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
import { IMPORT_ORDER } from './lib/importOrder';
import { ElectiveActivityManagerPage } from './components/admin/ElectiveActivityManagerPage';
import { HouseManagerPage } from './components/admin/HouseManagerPage';
import { StudentIdRegistryPage } from './components/admin/StudentIdRegistryPage';
import { BarChart3, Palette, History } from 'lucide-react';
import { PortalSidebarLayout } from './components/shared/PortalSidebarLayout';
import { motion, AnimatePresence } from 'motion/react';

/** รายละเอียดการ์ดนำเข้า — ลำดับมาจาก IMPORT_ORDER (ลำดับพึ่งพาจริง ดู lib/importOrder.ts) */
const IMPORT_CARD_META: Record<ImportType, {
  title: string; description: React.ReactNode; prerequisite: string;
  icon: React.ComponentType<{ className?: string }>; iconBox: string; openBorder: string;
}> = {
  TEACHER: {
    title: 'นำเข้าบุคลากร (ครู & เจ้าหน้าที่)',
    description: <>นำเข้ารายชื่อครู, อีเมล (@utd.ac.th), ตำแหน่ง และกลุ่มสาระการเรียนรู้ลง Collection <code className="text-emerald-400 font-mono">staff</code></>,
    prerequisite: 'ทำก่อนเสมอ — ตารางสอนใช้ข้อมูลนี้จับคู่ครูผู้สอน',
    icon: Users, iconBox: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400', openBorder: 'border-emerald-500/40',
  },
  STUDENT: {
    title: 'นำเข้านักเรียน & โฮมรูม',
    description: <>นำเข้าทะเบียนนักเรียนรายห้อง (ม.1 - ม.6), เลขประจำตัว, เลขที่ลง Collection <code className="text-purple-400 font-mono">students</code></>,
    prerequisite: 'ไม่ต้องรอข้อมูลอื่น — ต้องทำก่อนนำเข้าข้อมูลผู้ปกครอง',
    icon: UserCheck, iconBox: 'bg-purple-500/10 border-purple-500/20 text-purple-400', openBorder: 'border-purple-500/40',
  },
  COURSE: {
    title: 'นำเข้าตารางสอน & ภาระงานครู',
    description: <>อ่านไฟล์รายงานภาระงานสอน Excel/CSV และสร้างเอกสารลง Collection <code className="text-blue-400 font-mono">schedules</code> พร้อมจับคู่ครูผู้สอนด้วยอีเมล</>,
    prerequisite: 'ต้องนำเข้าบุคลากร (ข้อ 1) ก่อน และตั้งค่าปีการศึกษา/ภาคเรียนแล้ว — แถวที่จับคู่ครูไม่ได้จะแจ้งสรุปก่อนยืนยัน',
    icon: BookOpen, iconBox: 'bg-blue-500/10 border-blue-500/20 text-blue-400', openBorder: 'border-blue-500/40',
  },
  PARENT: {
    title: 'นำเข้าข้อมูลยืนยันตัวตนผู้ปกครอง',
    description: <>Student ID, ชื่อผู้ปกครอง, เลขบัตร ปชช. (hash SHA-256), เบอร์, ความสัมพันธ์ ลง <code className="text-amber-400 font-mono">parent_verification_records</code> สำหรับเชื่อมบัญชี LINE</>,
    prerequisite: 'ต้องนำเข้านักเรียน (ข้อ 2) ก่อน — รหัสนักเรียนที่ไม่มีในระบบจะถูกปฏิเสธ',
    icon: ShieldCheck, iconBox: 'bg-amber-500/10 border-amber-500/20 text-amber-400', openBorder: 'border-amber-500/40',
  },
};
const IMPORT_CARDS = IMPORT_ORDER.map((type) => ({ type, ...IMPORT_CARD_META[type] }));

export function AdminPortal() {
  const [activeTab, setActiveTab] = useState<'teaching-load' | 'import' | 'absence-sub' | 'sub-analytics' | 'users' | 'students' | 'id-registry' | 'settings' | 'periods' | 'electives' | 'houses'>('teaching-load');
  // ทะเบียนเลขประจำตัว: เลขที่ส่งมาจากหน้าจัดการนักเรียนเพื่อเปิดดูประวัติทันที
  const [registryFocusId, setRegistryFocusId] = useState<string | undefined>(undefined);
  const openIdRegistry = (studentId?: string) => {
    setRegistryFocusId(studentId);
    setActiveTab('id-registry');
  };
  const [bulkImportType, setBulkImportType] = useState<ImportType>(IMPORT_ORDER[0]);
  const [importBusy, setImportBusy] = useState(false);
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
    id: 'teaching-load' | 'import' | 'absence-sub' | 'sub-analytics' | 'users' | 'students' | 'id-registry' | 'settings' | 'periods' | 'electives' | 'houses';
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
    { id: 'id-registry', label: 'ทะเบียนเลขประจำตัว', fullLabel: 'ทะเบียนเลขประจำตัวนักเรียน (Student ID Registry)', icon: History, badge: null, color: 'text-indigo-400', activeStyle: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 shadow-[inset_4px_0_0_rgba(99,102,241,1)]' },
    { id: 'periods', label: 'ตารางเวลา & กระดิ่ง', fullLabel: 'จัดการตารางเวลา & กระดิ่งคาบเรียน', icon: Bell, badge: null, color: 'text-indigo-400', activeStyle: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 shadow-[inset_4px_0_0_rgba(99,102,241,1)]' },
    { id: 'electives', label: 'จัดการชุมนุม', fullLabel: 'จัดการชุมนุม (Elective Activities)', icon: Users, badge: null, color: 'text-teal-400', activeStyle: 'bg-teal-500/10 text-teal-400 border-teal-500/20 shadow-[inset_4px_0_0_rgba(20,184,166,1)]' },
    { id: 'houses', label: 'จัดการคณะสี', fullLabel: 'จัดการคณะสี (House)', icon: Palette, badge: null, color: 'text-rose-400', activeStyle: 'bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-[inset_4px_0_0_rgba(244,63,94,1)]' },
    { id: 'settings', label: 'ปีการศึกษา & ล็อกระบบ', fullLabel: 'ตั้งค่าปีการศึกษา & ล็อกระบบ (System Lock)', icon: Settings, badge: null, color: 'text-pink-400', activeStyle: 'bg-[#ec4899]/10 text-[#ec4899] border-[#ec4899]/20 shadow-[inset_4px_0_0_rgba(236,72,153,1)]' },
  ];

  return (
    <div className="flex-1 min-h-0 bg-[#05070a] text-slate-200 font-sans selection:bg-emerald-500/30 flex flex-col overflow-hidden">
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
      <header className="bg-[#0a0f16] border-b border-white/10 shrink-0 relative z-20">
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

      {/* scroll เดียวของหน้า — แถบหัวข้อ portal ด้านบนอยู่กับที่ */}
      <div className="flex-1 min-h-0 overflow-y-auto">
      <main className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        
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
                    <p className="text-slate-400 mt-1 text-sm">นำเข้าตามลำดับจากบนลงล่าง: บุคลากร → นักเรียน → ตารางสอน → ผู้ปกครอง (แต่ละข้อพึ่งข้อมูลของข้อก่อนหน้า)</p>
                  </div>

                  {/* การ์ดเดียวต่อประเภทข้อมูล เรียงตามลำดับพึ่งพาจริง:
                      บุคลากร → นักเรียน → ตารางสอน (จับคู่ครูจาก staff) → ผู้ปกครอง (ตรวจรหัสนักเรียนจาก students)
                      การ์ดที่เปิดอยู่แสดงเทมเพลต + โซนลากไฟล์ + ตรวจสอบ + ปุ่มยืนยัน ในตัวเอง */}
                  <div className="space-y-4">
                    {IMPORT_CARDS.map((card, index) => {
                      const isOpen = bulkImportType === card.type;
                      const Icon = card.icon;
                      return (
                        <div
                          key={card.type}
                          data-testid={`import-card-${card.type}`}
                          className={cn(
                            "bg-[#0f1219] border rounded-2xl shadow-xl overflow-hidden transition-all",
                            isOpen ? card.openBorder : "border-white/10 hover:border-white/20"
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => { if (!importBusy) setBulkImportType(card.type); }}
                            disabled={importBusy && !isOpen}
                            aria-expanded={isOpen}
                            className="w-full p-5 flex items-start gap-4 text-left cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <div className={cn("w-12 h-12 shrink-0 rounded-xl border flex items-center justify-center", card.iconBox)}>
                              <Icon className="w-6 h-6" />
                            </div>
                            <div className="flex-1 min-w-0 space-y-1">
                              <h3 className="text-base font-bold text-white">{index + 1}. {card.title}</h3>
                              <p className="text-xs text-slate-400 leading-relaxed">{card.description}</p>
                              <p className="text-[11px] text-amber-300/90">{card.prerequisite}</p>
                            </div>
                            <span className="text-[11px] font-bold text-slate-400 shrink-0 mt-1">{isOpen ? 'กำลังเปิด' : 'เปิดการ์ด'}</span>
                          </button>
                          {isOpen && (
                            <div className="border-t border-white/5 bg-[#11151d] p-5">
                              <BulkDataImportModal
                                isOpen={true}
                                onClose={() => {}}
                                initialImportType={card.type}
                                lockImportType
                                variant="inline"
                                onRequestSwitchType={(t) => { if (!importBusy) setBulkImportType(t); }}
                                onBusyChange={setImportBusy}
                                onImportSuccess={(type, count) => {
                                  showToast(`นำเข้าข้อมูล ${type} สำเร็จ (${count} รายการ)`);
                                }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
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
              <StudentManagementPage onGoToImport={() => goToImport('STUDENT')} onOpenIdRegistry={openIdRegistry} />
            </div>
          )}

          {activeTab === 'id-registry' && (
            <div key={registryFocusId ?? 'all'} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <StudentIdRegistryPage initialStudentId={registryFocusId} />
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

    </div>
  );
}
