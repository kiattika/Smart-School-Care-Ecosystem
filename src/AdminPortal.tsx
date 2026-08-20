import { cn } from "./lib/utils";
import { mockImportedData } from "./data/mockData";
import React, { useState } from 'react';
import { Upload, FileDown, CheckCircle2, AlertTriangle, Users, BookOpen, Clock, Loader2, Database, Mailbox, Edit3, Check, ArrowLeftRight, Trash2, UserCheck, Calendar, Settings, Bell, Layers } from 'lucide-react';
import clsx, { ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useStore } from './store';
import { GlobalCourse } from './types';
import { StaffRoleManagementPage } from './components/StaffRoleManagementPage';
import { SystemSettingsAndLocksPage } from './components/SystemSettingsAndLocksPage';
import { PeriodManagementPage } from './components/PeriodManagementPage';
import { SubstituteTeachingModule } from './components/SubstituteTeachingModule';
import { SubstituteTeachingAnalyticsModule } from './components/SubstituteTeachingAnalyticsModule';
import { TeachingLoadTable } from './components/TeachingLoadTable';
import { BarChart3 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';



import Papa from 'papaparse';

const RAW_EXCEL_MOCK = [
  { TeacherName: "นาย ก", TeacherEmail: "teacher@utd.ac.th", CourseCode: "ท32101", CourseName: "ภาษาไทย 3", Room: "ม.5/1", Schedule: "จ1-2", Level: "ม.5", Homeroom: "ม.5/8" },
  { TeacherName: "", TeacherEmail: "", CourseCode: "ท32101", CourseName: "ภาษาไทย 3", Room: "ม.5/2", Schedule: "อ3-4", Level: "ม.5", Homeroom: "" },
  { TeacherName: "", TeacherEmail: "", CourseCode: "รวมคาบสอน", CourseName: "12", Room: "", Schedule: "", Level: "", Homeroom: "" },
  { TeacherName: "คุณครู สมใจ รักสอน", TeacherEmail: "somjai@utd.ac.th", CourseCode: "ว30101", CourseName: "วิทยาศาสตร์", Room: "ม.4/1", Schedule: "พฤ3-4", Level: "ม.4", Homeroom: "ม.4/1" },
  { TeacherName: "", TeacherEmail: "", CourseCode: "ว30101", CourseName: "วิทยาศาสตร์", Room: "ม.4/2", Schedule: "ศ5", Level: "ม.4", Homeroom: "" }
];

export function AdminPortal() {
  const [activeTab, setActiveTab] = useState<'teaching-load' | 'import' | 'requests' | 'absence-sub' | 'sub-analytics' | 'users' | 'settings' | 'periods'>('teaching-load');
  const [importStatus, setImportStatus] = useState<'idle' | 'uploading' | 'preview' | 'syncing' | 'success'>('idle');
  const [importedData, setImportedData] = useState<GlobalCourse[]>([]);
  const [tempHomerooms, setTempHomerooms] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);
  
  const { 
    scheduleChangeRequests, 
    updateScheduleChangeRequestStatus, 
    updateCourseSchedule, 
    courses, 
    setGlobalCourses, 
    setHomeroomAssignments,
    periodSwaps,
    substituteAssignments,
    updatePeriodSwapStatus,
    assignSubstituteTeacher,
    removeSubstituteAssignment,
    globalCourses
  } = useStore();
  
  const [editingSchedule, setEditingSchedule] = useState<{ id: string, value: string } | null>(null);

  // New states for substitution assignment form
  const [subCourseId, setSubCourseId] = useState<string>('');
  const [subSubstituteEmail, setSubSubstituteEmail] = useState<string>('');
  const [subDate, setSubDate] = useState<string>(new Date().toISOString().split('T')[0]);


  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    
    setImportStatus('uploading');
    const file = e.target.files[0];

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedCourses: GlobalCourse[] = [];
        const hrAssignments: Record<string, string> = {};
        
        let currentTeacher = "";
        let currentEmail = "";

        results.data.forEach((row: any, i: number) => {
          // Map dynamic headers commonly used in Thai schools
          const teacherName = row["Teacher Name"] || row["TeacherName"] || row["ชื่อครู"] || row.TeacherName || "";
          const teacherEmail = row["Teacher Email"] || row["TeacherEmail"] || row["อีเมล"] || row.TeacherEmail || "";
          const courseCode = row["Subject Code"] || row["Course Code"] || row["CourseCode"] || row["รหัสวิชา"] || row.CourseCode || "";
          const courseName = row["Subject Name"] || row["Course Name"] || row["CourseName"] || row["ชื่อวิชา"] || row.CourseName || "";
          const room = row["Room"] || row["ห้อง"] || row.Room || "";
          const schedule = row["Schedule"] || row["คาบเรียน"] || row.Schedule || "";
          const level = row["Level"] || row["ระดับชั้น"] || row.Level || "";
          const homeroom = row["Homeroom"] || row["โฮมรูม"] || row.Homeroom || "";

          if (teacherName) currentTeacher = teacherName;
          if (teacherEmail) currentEmail = teacherEmail;

          if (!courseCode || courseCode.includes("รวมคาบสอน")) return;

          if (homeroom) {
            hrAssignments[currentEmail] = homeroom;
          }

          parsedCourses.push({
            courseId: `GC-${Date.now()}-${i}`,
            code: courseCode,
            courseName: courseName,
            teacherName: currentTeacher,
            teacherEmail: currentEmail,
            roomName: room,
            scheduleString: schedule,
            level: level
          });
        });

        setImportedData(parsedCourses);
        setTempHomerooms(hrAssignments);
        setImportStatus('preview');
      },
      error: (error) => {
        console.error("Parse error:", error);
        setImportStatus('idle');
      }
    });
  };

  const handleSync = () => {
    setImportStatus('syncing');
    
    setTimeout(() => {
      setGlobalCourses(importedData);
      setHomeroomAssignments(tempHomerooms);
      setImportStatus('success');
      showToast(`นำเข้าข้อมูลและอัปเดตระบบเรียบร้อยแล้ว (${importedData.length} รายการ)`);
      
      setTimeout(() => {
        setImportStatus('idle');
        setImportedData([]);
      }, 3000);
    }, 2000);
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="min-h-screen bg-[#05070a] text-slate-200 font-sans selection:bg-emerald-500/30">
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
      <header className="bg-[#0a0f16] border-b border-white/5 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shadow-inner">
              <Database className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">System Administration</h1>
              <p className="text-sm text-slate-400 font-medium">Global Configuration & Sync</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right mr-2 hidden sm:block">
              <div className="text-sm font-bold text-slate-200">Super Admin</div>
              <div className="text-xs text-slate-500">Global Access</div>
            </div>
            <div className="w-10 h-10 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-slate-300 font-bold overflow-hidden">
              SA
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 flex gap-8">
        
        {/* Sidebar */}
        <div className="w-64 shrink-0 flex flex-col gap-2 relative z-10">
          <button 
            onClick={() => setActiveTab('teaching-load')}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300",
              activeTab === 'teaching-load' 
                ? "bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-[inset_4px_0_0_rgba(59,130,246,1)]" 
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            )}
          >
            <Layers className="w-4 h-4 text-blue-400" />
            ตารางภาระงานสอน
          </button>
          <button 
            onClick={() => setActiveTab('import')}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300",
              activeTab === 'import' 
                ? "bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-[inset_4px_0_0_rgba(59,130,246,1)]" 
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            )}
          >
            <Upload className="w-4 h-4" />
            นำเข้าภาระงานสอน
          </button>
          <button 
            onClick={() => setActiveTab('requests')}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300",
              activeTab === 'requests' 
                ? "bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-[inset_4px_0_0_rgba(59,130,246,1)]" 
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            )}
          >
            <Mailbox className="w-4 h-4" />
            คำร้องขอสลับคาบสอน
            {scheduleChangeRequests.filter(r => r.status === 'PENDING').length > 0 && (
              <span className="ml-auto w-5 h-5 rounded-full bg-red-500 flex items-center justify-center text-[10px] text-white font-bold">
                {scheduleChangeRequests.filter(r => r.status === 'PENDING').length}
              </span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('absence-sub')}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300",
              activeTab === 'absence-sub' 
                ? "bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-[inset_4px_0_0_rgba(59,130,246,1)]" 
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            )}
          >
            <Clock className="w-4 h-4 text-amber-400" />
            ลาสอน & จัดครูสอนแทน
            {periodSwaps.filter(ps => ps.status === 'PENDING_ADMIN').length > 0 && (
              <span className="ml-auto w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center text-[10px] text-white font-bold animate-pulse">
                {periodSwaps.filter(ps => ps.status === 'PENDING_ADMIN').length}
              </span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('sub-analytics')}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300",
              activeTab === 'sub-analytics' 
                ? "bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-[inset_4px_0_0_rgba(59,130,246,1)]" 
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            )}
          >
            <BarChart3 className="w-4 h-4 text-indigo-400" />
            วิเคราะห์งานสอนแทน & PA
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300",
              activeTab === 'users' 
                ? "bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-[inset_4px_0_0_rgba(59,130,246,1)]" 
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            )}
          >
            <Users className="w-4 h-4" />
            จัดการสิทธิ์บุคลากร
          </button>
          <button 
            onClick={() => setActiveTab('periods')}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300",
              activeTab === 'periods' 
                ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-[inset_4px_0_0_rgba(99,102,241,1)]" 
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            )}
          >
            <Bell className="w-4 h-4 text-indigo-400" />
            จัดการตารางเวลา & กระดิ่ง
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300",
              activeTab === 'settings' 
                ? "bg-[#ec4899]/10 text-[#ec4899] border border-[#ec4899]/20 shadow-[inset_4px_0_0_rgba(236,72,153,1)]" 
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            )}
          >
            <Settings className="w-4 h-4 text-pink-400" />
            ตั้งค่าปีการศึกษา & ล็อกระบบ
          </button>
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
                      <p className="text-slate-400 mt-1 text-sm">ข้อมูลภาระงานสอนอย่างเป็นทางการจากฐานข้อมูลตารางเรียน-ตารางสอนของโรงเรียน</p>
                    </div>
                  </div>
                  <TeachingLoadTable />
                </div>
              )}

              {activeTab === 'import' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              <div className="flex justify-between items-end border-b border-white/5 pb-4">
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">Teaching Load Import</h2>
                  <p className="text-slate-400 mt-1 text-sm">อัปโหลดไฟล์ Excel (.xlsx) หรือ CSV เพื่อจัดการภาระงานสอนของครูทั้งระบบ</p>
                </div>
              </div>

              {/* Upload Zone */}
              {importStatus === 'idle' && (
                <div className="bg-[#0f1219] border-2 border-dashed border-slate-700 hover:border-blue-500/50 rounded-2xl p-12 transition-all duration-300 relative group text-center flex flex-col items-center justify-center min-h-[300px]">
                  <input 
                    type="file" 
                    accept=".csv, .xlsx"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  
                  <div className="w-20 h-20 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                    <FileDown className="w-10 h-10 text-blue-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">อัปโหลดไฟล์รายงานภาระงานสอน .xlsx</h3>
                  <p className="text-slate-400 max-w-sm mx-auto">
                    ลากไฟล์มาวาง หรือ คลิกเพื่อเลือกไฟล์
                  </p>
                  
                  <div className="mt-8 flex items-center justify-center gap-4 text-sm text-slate-500">
                    <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Column: Teacher Name</span>
                    <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Column: Subject Code</span>
                    <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Column: Room</span>
                  </div>
                </div>
              )}

              {/* Uploading State */}
              {importStatus === 'uploading' && (
                <div className="bg-[#0f1219] border border-white/5 rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
                  <Loader2 className="w-12 h-12 text-blue-400 animate-spin mb-6" />
                  <h3 className="text-xl font-bold text-white mb-2">กำลังประมวลผลไฟล์...</h3>
                  <p className="text-slate-400">ระบบกำลังอ่านข้อมูลและตรวจสอบความถูกต้อง</p>
                </div>
              )}

              {/* Preview State */}
              {(importStatus === 'preview' || importStatus === 'syncing') && (
                <div className="bg-[#0f1219] border border-white/5 rounded-2xl overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-300">
                  <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#0a0f16]">
                    <div>
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Database className="w-5 h-5 text-blue-400" />
                        ตัวอย่างข้อมูลที่อ่านได้
                      </h3>
                      <p className="text-slate-400 text-sm mt-1">พบข้อมูลทั้งหมด 405 รายการ (แสดงตัวอย่าง 5 รายการ)</p>
                    </div>
                    
                    <button
                      onClick={handleSync}
                      disabled={importStatus === 'syncing'}
                      className={cn(
                        "px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 transition-all",
                        importStatus === 'syncing'
                          ? "bg-blue-600/50 text-blue-200 cursor-not-allowed"
                          : "bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]"
                      )}
                    >
                      {importStatus === 'syncing' ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          กำลังซิงค์...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-5 h-5" />
                          Confirm & Sync to Database
                        </>
                      )}
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-[#0a0f16]/50 text-slate-400 font-medium border-b border-white/5">
                        <tr>
                          <th className="px-6 py-4">Teacher Name</th>
                          <th className="px-6 py-4">Subject Code</th>
                          <th className="px-6 py-4">Subject Name</th>
                          <th className="px-6 py-4">Room</th>
                          <th className="px-6 py-4">คาบสอน (Schedule)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {importedData.map((row) => (
                          <tr key={row.courseId} className="hover:bg-white/5 transition-colors">
                            <td className="px-6 py-4 font-medium text-slate-200">
                              {row.teacherName}
                              <div className="text-xs text-slate-500 font-normal">{row.teacherEmail}</div>
                            </td>
                            <td className="px-6 py-4 font-mono text-blue-400">{row.code}</td>
                            <td className="px-6 py-4 text-slate-300">{row.courseName}</td>
                            <td className="px-6 py-4">
                              <span className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium">
                                {row.roomName}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-slate-400 font-mono">
                              <div className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5" />
                                {row.scheduleString}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {importStatus === 'syncing' && (
                    <div className="absolute inset-0 bg-[#0f1219]/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center">
                      <div className="w-16 h-16 relative mb-6">
                        <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
                      </div>
                      <h3 className="text-xl font-bold text-white tracking-wide">Syncing Roster Data</h3>
                      <p className="text-blue-400 font-mono mt-2">Writing to global state...</p>
                    </div>
                  )}
                </div>
              )}

              {/* Success State */}
              {importStatus === 'success' && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[300px] animate-in zoom-in-95 duration-300">
                  <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(16,185,129,0.4)]">
                    <CheckCircle2 className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-emerald-400 mb-2">ซิงค์ข้อมูลสำเร็จ!</h3>
                  <p className="text-slate-300">ข้อมูลภาระงานสอนถูกบันทึกลงฐานข้อมูลและพร้อมให้ครูผู้สอนใช้งานแล้ว</p>
                </div>
              )}

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
                                <span className="text-slate-400 text-sm">{req.createdAt.toLocaleDateString('th-TH')}</span>
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
    </div>
  );
}
