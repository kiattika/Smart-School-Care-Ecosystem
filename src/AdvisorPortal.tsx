import { cn, isSameRoom } from "./lib/utils";
import { Student } from "./types";
import { MOCK_VISIT_DATA } from "./data/mockData";
import React, { useState, useMemo } from 'react';
import { useStore } from './store';
import { useRealStudents } from "./hooks/useRealStudents";
import { useHomeroomAttendance } from "./hooks/useHomeroomAttendance";
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { 
  ShieldAlert, UserCheck, UserX, FileText, CheckCircle, XCircle, Users, Activity,
  MapPin, Route, Navigation, MessageCircle, Home, ClipboardList, AlertTriangle, Heart, Shield, X, Map as MapIcon, ChevronRight, CheckCircle2,
  Edit3, Clock, Compass, Brain, Sparkles, Target, Search, Filter, Eye
} from 'lucide-react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ResponsiveContainer, LineChart, Line, XAxis, Tooltip as RechartsTooltip } from 'recharts';
import { StudentAnalyticsDashboard } from './components/StudentAnalyticsDashboard';
import { StudentAssessmentDetailModal } from './components/StudentAssessmentDetailModal';
import { motion, AnimatePresence } from 'motion/react';


// Mock Data for Home Visits

export function AdvisorPortal() {
  const {
    user,
    analytics,
    leaveRequests,
    updateLeaveRequestStatus,
    updateStudentProfile,
    submitHomeVisit,
    homeVisits,
    selfAssessments
  } = useStore();

  // อ่านรายชื่อนักเรียนจาก Firestore สด (real-time) แทน Zustand store แบบ session-local
  // store จะมีข้อมูลก็ต่อเมื่อมีคน import ในเซสชันเดียวกันเท่านั้น — เปิดใหม่/ล็อกอินใหม่แล้วว่าง
  const { students, loading: studentsLoading } = useRealStudents();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'visit-planner' | 'school-checkin' | 'analytics' | 'self-assessment'>('dashboard');
  const [assessmentModalStudent, setAssessmentModalStudent] = useState<Student | null>(null);
  const [assessmentSearch, setAssessmentSearch] = useState('');
  const [assessmentFilter, setAssessmentFilter] = useState<'ALL' | 'COMPLETED' | 'PENDING'>('ALL');

  // สถานะเช็คชื่อโฮมรูมแบบ optimistic (ก่อนกด "บันทึกการเช็คชื่อทั้งหมด")
  const [attendanceOverrides, setAttendanceOverrides] = useState<Record<string, 'PRESENT' | 'LATE' | 'ABSENT' | 'LEAVE'>>({});

  const myRoom = user?.profile?.assignments?.homeroomClass;

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const targetRoom = myRoom || 'ม.5/8';
  const {
    record: hrRecord,
    loading: hrLoading,
    saveHomeroomAttendance,
    requestUnlock: hrRequestUnlock
  } = useHomeroomAttendance(todayStr, targetRoom);

  const myStudents = useMemo(() => {
    if (!myRoom) return [];
    return (students || [])
      .filter(s => isSameRoom(s.room, myRoom) || isSameRoom((s as any).className, myRoom))
      .map(s => {
        // ลำดับความสำคัญของสถานะเช้า: override ในหน้าจอ > ค่าที่บันทึกใน Firestore (hrRecord) > ค่าใน student doc
        const merged = attendanceOverrides[s.studentId]
          ?? hrRecord?.students?.[s.studentId]
          ?? s.attendance.morningStatus;
        if (merged === s.attendance.morningStatus && !attendanceOverrides[s.studentId]) return s;
        return { ...s, attendance: { ...s.attendance, morningStatus: merged } };
      });
  }, [myRoom, students, attendanceOverrides, hrRecord]);

  const handleSaveAll = async () => {
    try {
      const studentStatuses: Record<string, 'PRESENT' | 'LATE' | 'ABSENT' | 'LEAVE'> = {};
      myStudents.forEach(student => {
        studentStatuses[student.studentId] = (student.attendance.morningStatus || 'PRESENT') as any;
      });
      await saveHomeroomAttendance(studentStatuses);
      setAttendanceOverrides({}); // เคลียร์ optimistic overrides — ใช้ค่าจาก hrRecord (Firestore) แทน
      setToastMessage("บันทึกและโฮมรูมเรียบร้อยแล้ว ระบบทำการล็อกข้อมูลเรียบร้อย!");
      setTimeout(() => setToastMessage(null), 3000);
    } catch (e) {
      console.error(e);
    }
  };

  // Modals state
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [showWellnessModal, setShowWellnessModal] = useState(false);
  const [showLineModal, setShowLineModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [routeGenerated, setRouteGenerated] = useState(false);
  
  type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
  const [reportForm, setReportForm] = useState({ condition: 3, notes: '', urgent: false, geoVerified: false, riskLevel: 'LOW' as RiskLevel, photoUploaded: false, checkingGPS: false });

  // Custom Morning Attendance & Profile states
  const [routeModalStudent, setRouteModalStudent] = useState<Student | null>(null);
  const [editProfileStudent, setEditProfileStudent] = useState<Student | null>(null);
  const [editNickname, setEditNickname] = useState('');
  const [editPhotoUrl, setEditPhotoUrl] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editParentUid, setEditParentUid] = useState('');
  const [editParentEmail, setEditParentEmail] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  const pendingLeaves = leaveRequests.filter(r => r.status === 'PENDING');
  
  // Mock Class-Skipping Radar Data
  const skippedStudents = [
    { studentId: '54004', period: 'คาบ 3', subject: 'วิทยาศาสตร์', time: '10:30 น.' }
  ];

  const handleStudentClick = (id: string) => {
    setSelectedStudentId(id);
    setShowWellnessModal(true);
  };

  const handleLineClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedStudentId(id);
    setShowLineModal(true);
  };

  const handleReportClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedStudentId(id);
    setShowReportModal(true);
    setReportForm({ condition: 3, notes: '', urgent: false, geoVerified: false, riskLevel: 'LOW', photoUploaded: false, checkingGPS: false });
  };

  const selectedStudent = students.find(s => s.studentId === selectedStudentId);

  return (
    <div className="flex flex-col h-screen w-full bg-[#0b0d14] text-slate-100 overflow-hidden font-sans selection:bg-blue-500/30">
       {/* Responsive Header */}
       <header className="h-16 border-b border-white/10 bg-[#0f111a] flex items-center justify-between px-3 sm:px-6 shrink-0 shadow-lg relative z-20">
          <button
            type="button"
            onClick={() => {
              setActiveTab('dashboard');
              setSelectedStudentId(null);
            }}
            className="flex items-center gap-2.5 sm:gap-3 group text-left cursor-pointer focus:outline-none transition-all duration-150 hover:opacity-95 active:scale-[0.98] select-none rounded-xl p-1 -ml-1 hover:bg-white/5 min-w-0"
            title="กลับไปยังหน้าหลัก (Dashboard)"
          >
            <div className="w-8 h-8 bg-indigo-600 group-hover:bg-indigo-500 rounded-lg flex items-center justify-center font-bold text-white shadow-[0_0_10px_rgba(99,102,241,0.4)] group-hover:shadow-[0_0_16px_rgba(99,102,241,0.6)] transition-all shrink-0">
              A
            </div>
            <h1 className="text-sm sm:text-base md:text-lg font-semibold tracking-tight text-white group-hover:text-indigo-300 transition-colors truncate">
              Smart School Care <span className="text-indigo-400 font-medium group-hover:text-indigo-300">| Advisor: {myRoom || 'No Room'}</span>
            </h1>
          </button>

          {/* Desktop Tab Switcher (lg+) */}
          <div className="hidden xl:flex items-center gap-4">
            <div className="flex bg-black/40 border border-white/10 rounded-xl p-1">
              <button 
                onClick={() => setActiveTab('dashboard')}
                className={cn("px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5", activeTab === 'dashboard' ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200")}
              >
                <Activity className="w-3.5 h-3.5" />
                แดชบอร์ดห้อง
              </button>
              <button 
                onClick={() => setActiveTab('self-assessment')}
                className={cn("px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5", activeTab === 'self-assessment' ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200")}
              >
                <Brain className="w-3.5 h-3.5" />
                วิเคราะห์ 30 ข้อ
              </button>
              <button 
                onClick={() => setActiveTab('visit-planner')}
                className={cn("px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5", activeTab === 'visit-planner' ? "bg-emerald-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200")}
              >
                <MapPin className="w-3.5 h-3.5" />
                เยี่ยมบ้าน
              </button>
              <button 
                onClick={() => setActiveTab('school-checkin')}
                className={cn("px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5", activeTab === 'school-checkin' ? "bg-amber-500 text-slate-950 shadow-sm" : "text-slate-400 hover:text-slate-200")}
              >
                <ClipboardList className="w-3.5 h-3.5" />
                เช็คชื่อโฮมรูม
              </button>
              <button 
                onClick={() => setActiveTab('analytics')}
                className={cn("px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5", activeTab === 'analytics' ? "bg-purple-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200")}
              >
                <Sparkles className="w-3.5 h-3.5" />
                สถิติวิชาการ
              </button>
            </div>
            <div className="text-xs text-slate-300 font-mono hidden 2xl:block bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
              {format(new Date(), 'd MMMM yyyy', { locale: th })}
            </div>
          </div>
       </header>

       {/* Mobile & Tablet Scrollable Sub-Navigation Bar (< xl) */}
       <div className="xl:hidden bg-[#121624] border-b border-white/10 px-3 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 shadow-inner">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0",
              activeTab === 'dashboard' ? "bg-indigo-600 text-white shadow-md" : "text-slate-400 hover:text-white bg-slate-800/60"
            )}
          >
            <Activity className="w-3.5 h-3.5" />
            แดชบอร์ดห้อง
          </button>
          <button 
            onClick={() => setActiveTab('self-assessment')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0",
              activeTab === 'self-assessment' ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:text-white bg-slate-800/60"
            )}
          >
            <Brain className="w-3.5 h-3.5" />
            วิเคราะห์ 30 ข้อ
          </button>
          <button 
            onClick={() => setActiveTab('visit-planner')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0",
              activeTab === 'visit-planner' ? "bg-emerald-600 text-white shadow-md" : "text-slate-400 hover:text-white bg-slate-800/60"
            )}
          >
            <MapPin className="w-3.5 h-3.5" />
            เยี่ยมบ้าน
          </button>
          <button 
            onClick={() => setActiveTab('school-checkin')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0",
              activeTab === 'school-checkin' ? "bg-amber-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-white bg-slate-800/60"
            )}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            เช็คชื่อโฮมรูม
          </button>
          <button 
            onClick={() => setActiveTab('analytics')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0",
              activeTab === 'analytics' ? "bg-purple-600 text-white shadow-md" : "text-slate-400 hover:text-white bg-slate-800/60"
            )}
          >
            <Sparkles className="w-3.5 h-3.5" />
            สถิติวิชาการ
          </button>
       </div>

       {!myRoom ? (
         <main className="flex-1 overflow-y-auto flex items-center justify-center p-6 bg-[#0b0d14]">
            <div className="text-center space-y-4 max-w-sm">
              <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-6">
                <UserX className="w-8 h-8 text-slate-500" />
              </div>
              <h2 className="text-xl font-bold text-slate-300">ไม่ได้เป็นครูที่ปรึกษาในภาคเรียนนี้</h2>
              <p className="text-slate-500 text-sm">คุณไม่มีข้อมูลการประจำชั้นในภาคเรียนนี้ หากข้อมูลผิดพลาดโปรดติดต่อผู้ดูแลระบบ</p>
            </div>
         </main>

       ) : (
       <main className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col gap-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="w-full flex-1 flex flex-col"
            >
              {activeTab === 'dashboard' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
              
              {/* Column 1: Leave Requests & Radar */}
              <div className="lg:col-span-1 flex flex-col gap-6">
                
                {/* Radar */}
                <div className="bg-[#1c1f2b] border border-white/10 rounded-xl overflow-hidden flex flex-col shadow-lg">
                  <div className="p-4 border-b border-white/10 bg-rose-500/10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-5 h-5 text-rose-500" />
                      <h2 className="font-bold text-rose-400">เรดาร์ตรวจจับการหนีเรียน</h2>
                    </div>
                    {skippedStudents.length > 0 && (
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                      </span>
                    )}
                  </div>
                  <div className="p-4 flex-1">
                    {skippedStudents.length > 0 ? (
                      <div className="space-y-3">
                        {skippedStudents.map((skip, idx) => {
                          const student = students.find(s => s.studentId === skip.studentId);
                          return (
                            <div key={idx} className="bg-rose-950/40 border border-rose-500/30 rounded-lg p-3 relative overflow-hidden">
                              <div className="absolute top-0 right-0 w-1 h-full bg-rose-500"></div>
                              <div className="flex justify-between items-start mb-2">
                                <span className="font-bold text-slate-200">{student?.name}</span>
                                <span className="text-[10px] bg-rose-500 text-white px-2 py-0.5 rounded font-medium">หนีเรียน</span>
                              </div>
                              <div className="text-xs text-slate-400 space-y-1.5">
                                <div className="flex justify-between">
                                  <span className="text-slate-500">สแกนเข้าโรงเรียน:</span> 
                                  <span className="text-emerald-400 font-mono">07:30 น.</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">เช็คขาด:</span> 
                                  <span className="text-rose-400">{skip.period} ({skip.subject})</span>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-slate-500 text-sm">ไม่มีความผิดปกติ</div>
                    )}
                  </div>
                </div>

                {/* Leave Requests Inbox */}
                <div className="bg-[#1c1f2b] border border-white/10 rounded-xl overflow-hidden flex flex-col flex-1 shadow-lg">
                   <div className="p-4 border-b border-white/10 bg-slate-900/50 flex items-center justify-between">
                     <div className="flex items-center gap-2">
                       <FileText className="w-5 h-5 text-indigo-400" />
                       <h2 className="font-bold text-indigo-400">ใบลาดิจิทัล (รออนุมัติ)</h2>
                     </div>
                     {pendingLeaves.length > 0 && (
                       <span className="bg-indigo-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{pendingLeaves.length}</span>
                     )}
                   </div>
                   <div className="p-4 space-y-3 overflow-y-auto">
                     {pendingLeaves.length > 0 ? (
                       pendingLeaves.map(req => {
                         const student = students.find(s => s.studentId === req.studentId);
                         return (
                           <div key={req.id} className="bg-white/5 border border-white/10 rounded-lg p-3">
                             <div className="flex justify-between items-start mb-1">
                               <div className="font-bold text-sm text-slate-200">{student?.name}</div>
                               <div className="text-[10px] text-slate-500 bg-black/20 px-1.5 py-0.5 rounded">{format(req.date, 'd MMM yyyy', { locale: th })}</div>
                             </div>
                             <p className="text-xs text-slate-400 mb-3 bg-black/20 p-2 rounded line-clamp-2">{req.reason}</p>
                             <div className="flex gap-2">
                               <button 
                                 onClick={() => updateLeaveRequestStatus(req.id, 'APPROVED')}
                                 className="flex-1 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-500/30 py-1.5 rounded text-xs font-bold transition-colors flex items-center justify-center gap-1"
                               >
                                 <CheckCircle className="w-3.5 h-3.5" /> อนุมัติ
                               </button>
                               <button 
                                 onClick={() => updateLeaveRequestStatus(req.id, 'REJECTED')}
                                 className="flex-1 bg-rose-600/20 text-rose-400 hover:bg-rose-600/30 border border-rose-500/30 py-1.5 rounded text-xs font-bold transition-colors flex items-center justify-center gap-1"
                               >
                                 <XCircle className="w-3.5 h-3.5" /> ไม่อนุมัติ
                               </button>
                             </div>
                           </div>
                         )
                       })
                     ) : (
                       <div className="text-center py-8 text-slate-500 text-sm">ไม่มีใบลาที่รออนุมัติ</div>
                     )}
                   </div>
                </div>

              </div>

              {/* Column 2: Class Overview Grid */}
              <div className="lg:col-span-2 bg-[#1c1f2b] border border-white/10 rounded-xl overflow-hidden flex flex-col shadow-lg">
                <div className="p-4 border-b border-white/10 bg-slate-900/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-emerald-400" />
                    <h2 className="font-bold text-emerald-400">ภาพรวมนักเรียน (Class Overview)</h2>
                  </div>
                  <div className="text-xs text-slate-400">สมาชิกทั้งหมด {myStudents.length} คน</div>
                </div>
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto content-start">
                  {studentsLoading ? (
                    <div className="col-span-full py-12 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
                      <span className="animate-spin text-xl leading-none">⟳</span>
                      <span>กำลังโหลดรายชื่อนักเรียนจากฐานข้อมูล...</span>
                    </div>
                  ) : myStudents.length === 0 ? (
                    <div className="col-span-full py-12 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
                      <Users className="w-8 h-8 text-slate-600" />
                      <span>ยังไม่มีนักเรียนในห้อง {myRoom}</span>
                      <span className="text-[10px] text-slate-600">กรุณานำเข้าข้อมูลนักเรียนผ่านระบบจัดการนักเรียนใน Admin Portal</span>
                    </div>
                  ) : (
                    myStudents.map(student => {
                    const studentAnalytics = analytics.find(a => a.studentId === student.studentId);
                    const bScore = studentAnalytics?.behaviorScore ?? 100;
                    
                    const isSkipped = skippedStudents.some(s => s.studentId === student.studentId);
                    const hasLeave = leaveRequests.some(r => r.studentId === student.studentId && r.status === 'APPROVED');
                    
                    let dailyStatusText = "มาเรียนปกติ";
                    let dailyStatusColor = "text-emerald-400";
                    let dailyStatusBg = "bg-emerald-500/10 border-emerald-500/20";
                    let DailyIcon = UserCheck;

                    if (hasLeave) {
                      dailyStatusText = "ลาหยุด";
                      dailyStatusColor = "text-indigo-400";
                      dailyStatusBg = "bg-indigo-500/10 border-indigo-500/20";
                      DailyIcon = FileText;
                    } else if (isSkipped) {
                      dailyStatusText = "หนีเรียน (คาบ 3)";
                      dailyStatusColor = "text-rose-400";
                      dailyStatusBg = "bg-rose-500/10 border-rose-500/20";
                      DailyIcon = UserX;
                    } else if (student.studentId === '54003') {
                      dailyStatusText = "มาสาย (สแกน 08:15)";
                      dailyStatusColor = "text-amber-400";
                      dailyStatusBg = "bg-amber-500/10 border-amber-500/20";
                      DailyIcon = Activity;
                    }

                    return (
                      <div 
                        key={student.id} 
                        onClick={() => handleStudentClick(student.studentId)}
                        className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-3 hover:bg-white/10 transition-colors cursor-pointer group"
                      >
                        <div className="flex items-start gap-3">
                          <img src={student.avatar} alt={student.name} className="w-10 h-10 rounded-full bg-slate-700 border border-slate-600 shadow-sm" />
                          <div className="flex-1">
                            <div className="flex justify-between">
                              <h3 className="font-bold text-sm text-slate-200 line-clamp-1 group-hover:text-indigo-400 transition-colors">{student.name}</h3>
                              <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-indigo-400" />
                            </div>
                            <div className="text-[10px] text-slate-400">{student.studentId}</div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          <div className="bg-black/20 border border-white/5 rounded-lg p-2 text-center flex flex-col justify-center">
                            <div className="text-[10px] text-slate-500 mb-1">คะแนนพฤติกรรม</div>
                            <div className={cn("text-lg font-bold leading-none", 
                              bScore >= 80 ? "text-emerald-400" : bScore >= 60 ? "text-amber-400" : "text-rose-400"
                           )}>
                                {bScore}
                            </div>
                          </div>
                          
                          <div className={cn("border rounded-lg p-2 flex flex-col items-center justify-center text-center gap-1", dailyStatusBg)}>
                            <DailyIcon className={cn("w-4 h-4", dailyStatusColor)} />
                            <div className={cn("text-[10px] font-medium leading-tight", dailyStatusColor)}>{dailyStatusText}</div>
                          </div>
                        </div>
                      </div>
                    );
                  }))}
                </div>
              </div>
              
            </div>
   
          )}
          {activeTab === 'visit-planner' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300 h-full">
              {/* Left Column: Visit List */}
              <div className="lg:col-span-1 flex flex-col gap-4 bg-[#1c1f2b] border border-white/10 rounded-xl p-4 overflow-y-auto">
                <div className="flex justify-between items-center mb-2">
                  <h2 className="font-bold text-emerald-400 flex items-center gap-2">
                    <MapPin className="w-5 h-5" /> นัดหมายเยี่ยมบ้าน
                  </h2>
                  <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded font-bold">รอเยี่ยม 3 คน</span>
                </div>
                
                {MOCK_VISIT_DATA.map((visit) => {
                  const student = students.find(s => s.studentId === visit.studentId);
                  if (!student) return null;
                  
                  const storeVisit = homeVisits.find(v => v.studentId === student.studentId);
                  const isCompleted = storeVisit ? true : visit.visitStatus === 'COMPLETED';
                  
                  return (
                    <div key={visit.studentId} className="bg-black/20 border border-white/5 rounded-xl p-4 hover:border-emerald-500/30 transition-all cursor-pointer" onClick={() => handleStudentClick(student.studentId)}>
                      <div className="flex gap-3 mb-3">
                        <img src={student.avatar} alt="" className="w-10 h-10 rounded-full" />
                        <div>
                          <h3 className="font-bold text-sm">{student.name}</h3>
                          <p className="text-[10px] text-slate-400 flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {visit.address} ({visit.distance})
                          </p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2">
                        <button 
                          onClick={(e) => handleLineClick(student.studentId, e)}
                          className="col-span-1 bg-[#00B900]/10 hover:bg-[#00B900]/20 text-[#00B900] border border-[#00B900]/30 rounded-lg py-1.5 flex items-center justify-center gap-1 text-[10px] font-bold transition-colors"
                        >
                          <MessageCircle className="w-3 h-3" /> นัดหมาย
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); /* Mock open maps */ }}
                          className="col-span-1 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-lg py-1.5 flex items-center justify-center gap-1 text-[10px] font-bold transition-colors"
                        >
                          <Navigation className="w-3 h-3" /> นำทาง
                        </button>
                        <button 
                          onClick={(e) => handleReportClick(student.studentId, e)}
                          className={cn(
                            "col-span-1 rounded-lg py-1.5 flex items-center justify-center gap-1 text-[10px] font-bold transition-colors border",
                            isCompleted ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10"
                   
                         )}>
                          <ClipboardList className="w-3 h-3" /> {isCompleted ? 'ดูบันทึก' : 'บันทึก'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Right Column: Map Mockup & Routing */}
              <div className="lg:col-span-2 flex flex-col gap-4">
                <div className="bg-[#1c1f2b] border border-white/10 rounded-xl p-4 flex flex-col flex-1 relative overflow-hidden">
                  <div className="flex justify-between items-center mb-4 relative z-10">
                    <h2 className="font-bold text-white flex items-center gap-2">
                      <MapIcon className="w-5 h-5 text-indigo-400" /> Map Clustering View
                    </h2>
                    <button 
                      onClick={() => setRouteGenerated(true)}
                      className={cn(
                        "px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all shadow-lg",
                        routeGenerated ? "bg-emerald-500 text-white shadow-emerald-500/20" : "bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-600/20"
               
                      )}>
                      <Route className="w-4 h-4" /> 
                      {routeGenerated ? "สร้างเส้นทางแล้ว" : "Generate Best Route"}
                    </button>
                  </div>
                  
                  {/* Mock Map Area */}
                  <div className="flex-1 bg-[#0f111a] border border-white/5 rounded-xl relative overflow-hidden flex items-center justify-center group">
                    {/* Grid Pattern Background */}
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
                    
                    {/* Route Line Mockup */}
                    {routeGenerated && (
                      <svg className="absolute inset-0 w-full h-full pointer-events-none">
                        <path d="M 200 150 Q 350 100 450 250 T 600 350" fill="none" stroke="#6366f1" strokeWidth="4" strokeDasharray="8 8" className="animate-pulse" />
                      </svg>
                    )}

                    {/* Mock Map Pins */}
                    <div className="absolute top-[30%] left-[25%] flex flex-col items-center">
                      <div className="w-10 h-10 bg-indigo-500/20 border-2 border-indigo-500 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-[0_0_15px_rgba(99,102,241,0.5)]">
                        2
                      </div>
                      <span className="text-[10px] text-slate-400 mt-1 font-bold bg-black/50 px-2 py-0.5 rounded">Area A</span>
                    </div>

                    <div className="absolute top-[60%] right-[30%] flex flex-col items-center">
                      <div className="w-10 h-10 bg-emerald-500/20 border-2 border-emerald-500 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-[0_0_15px_rgba(16,185,129,0.5)]">
                        1
                      </div>
                      <span className="text-[10px] text-slate-400 mt-1 font-bold bg-black/50 px-2 py-0.5 rounded">Area B</span>
                    </div>

                    <div className="text-slate-500 font-medium z-10 flex flex-col items-center gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                      <MapIcon className="w-8 h-8" />
                      <span>Interactive map requires integration</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
   
          )}
          {activeTab === 'school-checkin' && (
            <div className="animate-in fade-in duration-300 h-full flex flex-col gap-6 max-w-5xl mx-auto w-full pb-10">
              
              {/* Stat Cards for Morning Attendance */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-[#1c1f2b]/80 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-400 font-medium">มาเรียนทั้งหมด</div>
                    <div className="text-2xl font-bold text-emerald-400 mt-1">
                      {myStudents.filter(s => s.attendance.morningStatus === 'PRESENT').length} <span className="text-sm font-normal text-slate-400">คน</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-400 text-lg font-bold">✓</div>
                </div>

                <div className="bg-[#1c1f2b]/80 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-400 font-medium">เข้าเรียนสาย</div>
                    <div className="text-2xl font-bold text-amber-400 mt-1">
                      {myStudents.filter(s => s.attendance.morningStatus === 'LATE').length} <span className="text-sm font-normal text-slate-400">คน</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center text-amber-400 text-lg font-bold">!</div>
                </div>

                <div className="bg-[#1c1f2b]/80 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-400 font-medium">ลากิจ/ลาป่วย</div>
                    <div className="text-2xl font-bold text-indigo-400 mt-1">
                      {myStudents.filter(s => s.attendance.morningStatus === 'LEAVE').length} <span className="text-sm font-normal text-slate-400">คน</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 bg-indigo-500/10 rounded-lg flex items-center justify-center text-indigo-400 text-lg font-bold">✉</div>
                </div>

                <div className="bg-[#1c1f2b]/80 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-400 font-medium">ขาดเรียนสะสม</div>
                    <div className="text-2xl font-bold text-rose-400 mt-1">
                      {myStudents.filter(s => s.attendance.morningStatus === 'ABSENT').length} <span className="text-sm font-normal text-slate-400">คน</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 bg-rose-500/10 rounded-lg flex items-center justify-center text-rose-400 text-lg font-bold">✗</div>
                </div>
              </div>

              {/* Main Attendance List */}
              <div className="bg-[#1c1f2b] border border-white/10 rounded-xl p-6 shadow-lg flex-1">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <ClipboardList className="w-6 h-6 text-indigo-400" /> สมุดบันทึกเวลาเรียนเช้า (เช็คชื่อโฮมรูม)
                    </h2>
                    <p className="text-sm text-slate-400 mt-1">
                      แสดงรายชื่อนักเรียนห้องประจำชั้น เรียงลำดับตามเลขที่อย่างเคร่งครัด พร้อมระบบจำลองเส้นทางคมนาคม
                    </p>
                  </div>
                  <div className="bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 self-start sm:self-auto">
                    <Clock className="w-4 h-4" /> ประตูโรงเรียนสแกนและ GPS Geofence กำลังทำข้อมูล...
                  </div>
                </div>

                {/* Co-advisor Real-time Locking Alert Banner */}
                {hrRecord && hrRecord.isLocked ? (
                  <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-xl p-4 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-in fade-in duration-200">
                    <div className="flex items-center gap-3">
                      <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
                      <div>
                        <p className="font-bold text-sm text-white">เช็กชื่อแล้ว โดย {hrRecord.checkedByName} เวลา {hrRecord.checkedAt} น.</p>
                        <p className="text-xs text-slate-400">ระบบถูกล็อกการแก้ไขตามเงื่อนไขของครูร่วมประจำชั้นเพื่อป้องกันข้อมูลขัดแย้ง</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => hrRequestUnlock()}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold text-xs rounded-lg transition-colors shrink-0"
                    >
                      ขอแก้ไขข้อมูล
                    </button>
                  </div>
                ) : hrRecord && !hrRecord.isLocked ? (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-xl p-4 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-in fade-in duration-200">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                      <div>
                        <p className="font-bold text-sm text-white">อนุญาตให้แก้ไขข้อมูลได้ (แก้ไขโดย {hrRecord.requestedEditBy?.split('@')[0]})</p>
                        <p className="text-xs text-slate-400">ระบบปลดล็อกข้อมูลแล้ว คุณครูสามารถทำการเช็กชื่อใหม่และกดบันทึกเพื่อล็อกข้อมูลอีกครั้ง</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleSaveAll()}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-colors shrink-0"
                    >
                      บันทึกการเช็คชื่อทั้งหมด
                    </button>
                  </div>
                ) : (
                  <div className="bg-slate-500/10 border border-white/10 rounded-xl p-4 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-in fade-in duration-200">
                    <div className="flex items-center gap-3">
                      <ClipboardList className="w-5 h-5 text-indigo-400 shrink-0" />
                      <div>
                        <p className="font-bold text-sm text-white">ยังไม่มีการบันทึกข้อมูลวันนี้</p>
                        <p className="text-xs text-slate-400">ทำการเลือกสถานะนักเรียนแต่ละคน จากนั้นคลิกปุ่มบันทึกด้านขวา</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleSaveAll()}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg transition-colors shrink-0"
                    >
                      บันทึกการเช็คชื่อทั้งหมด
                    </button>
                  </div>
                )}

                <div className="divide-y divide-white/5 max-h-[60vh] overflow-y-auto pr-2 space-y-3">
                  {studentsLoading && (
                    <div className="py-10 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
                      <span className="animate-spin text-xl leading-none">⟳</span>
                      <span>กำลังโหลดรายชื่อนักเรียนจากฐานข้อมูล...</span>
                    </div>
                  )}
                  {!studentsLoading && myStudents.length === 0 && (
                    <div className="py-10 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
                      <Users className="w-8 h-8 text-slate-600" />
                      <span>ยังไม่มีนักเรียนในห้อง {myRoom}</span>
                    </div>
                  )}
                  {[...myStudents]
                    .sort((a, b) => a.studentNo - b.studentNo)
                    .map((student) => {
                      const mStatus = student.attendance.morningStatus;
                      const mMethod = student.attendance.checkInMethod;
                      const mTime = student.attendance.checkInTime;

                      // Display helper for Thai names/methods
                      const getStatusBadge = () => {
                        let methodLabel = "";
                        if (mMethod === 'SCAN') methodLabel = "สแกนประตู";
                        if (mMethod === 'GEOFENCE') methodLabel = "GPS Geofence";
                        if (mMethod === 'MANUAL') methodLabel = "ครูโฮมรูม";

                        if (mStatus === 'PRESENT') {
                          return (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                              มาเรียน {mTime ? `(${methodLabel} ${mTime})` : ""}
                            </span>
                          );
                        }
                        if (mStatus === 'LATE') {
                          return (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                              สาย {mTime ? `(${methodLabel} ${mTime})` : ""}
                            </span>
                          );
                        }
                        if (mStatus === 'LEAVE') {
                          return (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                              ลาเรียน (มีเอกสารใบลา)
                            </span>
                          );
                        }
                        return (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                            ขาดเรียน
                          </span>
                        );
                      };

                      const isEditingLocked = !!(hrRecord && hrRecord.isLocked);

                      return (
                        <div
                          key={student.studentId}
                          className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-white/5 transition-all"
                        >
                          {/* Student identity */}
                          <div className="flex items-center gap-4 flex-1">
                            {/* Student No Badge */}
                            <div className="flex flex-col items-center justify-center bg-indigo-500/10 border border-indigo-500/20 rounded-lg w-10 h-10 shrink-0">
                              <span className="text-[10px] text-indigo-300 font-semibold tracking-wider uppercase">No.</span>
                              <span className="text-sm font-black text-white leading-none">{student.studentNo}</span>
                            </div>

                            {/* Circular photo */}
                            <img
                              src={student.photoUrl || student.avatar}
                              className="w-12 h-12 rounded-full border border-white/10 shrink-0 object-cover"
                              alt=""
                              onError={(e) => {
                                // Fallback
                                (e.target as HTMLImageElement).src = `https://api.dicebear.com/9.x/avataaars/svg?seed=${student.nickname}`;
                              }}
                            />

                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white text-base">{student.fullName}</span>
                                <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-xs font-bold rounded">
                                  ({student.nickname})
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                                <span>รหัสประจำตัว: {student.studentId}</span>
                                <span className="w-1 h-1 rounded-full bg-white/20"></span>
                                <span className="flex items-center gap-1 truncate max-w-[200px] md:max-w-xs" title={student.homeLocation.address}>
                                  <Home className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                                  {student.homeLocation.address}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Interactive buttons */}
                          <div className="flex flex-wrap items-center gap-3 shrink-0 w-full md:w-auto justify-between md:justify-end">
                            {/* Route & Edit tools */}
                            <div className="flex items-center gap-2">
                              {/* Commute route map pop-up */}
                              <button
                                onClick={() => setRouteModalStudent(student)}
                                className="p-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-400 rounded-lg transition-colors flex items-center justify-center gap-1 text-xs font-semibold"
                                title="ดูเส้นทางและพิกัดแผนที่บ้านนักเรียน"
                              >
                                <Compass className="w-4 h-4" />
                                <span>แผนที่เดินทาง</span>
                              </button>

                              {/* Edit Profile */}
                              <button
                                onClick={() => {
                                  if (isEditingLocked) return;
                                  setEditProfileStudent(student);
                                  setEditNickname(student.nickname || '');
                                  setEditPhotoUrl(student.photoUrl || student.avatar || '');
                                  setEditAddress(student.homeLocation?.address || '');
                                  setEditParentUid((student as any).parentUid || (student as any).parentId || '');
                                  setEditParentEmail((student as any).parentEmail || '');
                                }}
                                disabled={isEditingLocked}
                                className={cn(
                                  "p-2 bg-slate-500/10 border border-slate-500/20 text-slate-300 rounded-lg transition-colors flex items-center justify-center gap-1 text-xs font-semibold",
                                  isEditingLocked ? "opacity-50 cursor-not-allowed" : "hover:bg-slate-500/20"
                                )}
                                title={isEditingLocked ? "ข้อมูลถูกล็อกโดยครูประจำชั้น" : "แก้ไขข้อมูลโปรไฟล์นักเรียน"}
                              >
                                <Edit3 className="w-4 h-4" />
                                <span>แก้ไข</span>
                              </button>
                            </div>

                            {/* Status label / manual toggle group */}
                            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                              {/* Status Display badge */}
                              <div className="mr-2">
                                {getStatusBadge()}
                              </div>

                              {/* Action selector */}
                              <div className={cn(
                                "inline-flex bg-slate-900/60 p-1 rounded-lg border border-white/5 gap-1 shrink-0",
                                isEditingLocked ? "opacity-60 cursor-not-allowed" : ""
                              )}>
                                <button
                                  onClick={() => {
                                    if (isEditingLocked) return;
                                    setAttendanceOverrides(prev => ({ ...prev, [student.studentId]: 'PRESENT' }));
                                    setToastMessage(`เลือกสถานะ 'มาเรียน' ให้เลขที่ ${student.studentNo} แล้ว — กด "บันทึกการเช็คชื่อทั้งหมด" เพื่อยืนยัน`);
                                    setTimeout(() => setToastMessage(null), 3000);
                                  }}
                                  disabled={isEditingLocked}
                                  className={cn(
                                    "px-2.5 py-1 rounded text-xs font-bold transition-all",
                                    mStatus === 'PRESENT'
                                      ? "bg-emerald-500 text-slate-900 shadow-md shadow-emerald-500/10"
                                      : "text-slate-400 hover:text-slate-200"
                                  )}
                                >
                                  มา
                                </button>
                                <button
                                  onClick={() => {
                                    if (isEditingLocked) return;
                                    setAttendanceOverrides(prev => ({ ...prev, [student.studentId]: 'LATE' }));
                                    setToastMessage(`เลือกสถานะ 'สาย' ให้เลขที่ ${student.studentNo} แล้ว — กด "บันทึกการเช็คชื่อทั้งหมด" เพื่อยืนยัน`);
                                    setTimeout(() => setToastMessage(null), 3000);
                                  }}
                                  disabled={isEditingLocked}
                                  className={cn(
                                    "px-2.5 py-1 rounded text-xs font-bold transition-all",
                                    mStatus === 'LATE'
                                      ? "bg-amber-500 text-slate-900 shadow-md shadow-amber-500/10"
                                      : "text-slate-400 hover:text-slate-200"
                                  )}
                                >
                                  สาย
                                </button>
                                <button
                                  onClick={() => {
                                    if (isEditingLocked) return;
                                    setAttendanceOverrides(prev => ({ ...prev, [student.studentId]: 'LEAVE' }));
                                    setToastMessage(`เลือกสถานะ 'ลาเรียน' ให้เลขที่ ${student.studentNo} แล้ว — กด "บันทึกการเช็คชื่อทั้งหมด" เพื่อยืนยัน`);
                                    setTimeout(() => setToastMessage(null), 3000);
                                  }}
                                  disabled={isEditingLocked}
                                  className={cn(
                                    "px-2.5 py-1 rounded text-xs font-bold transition-all",
                                    mStatus === 'LEAVE'
                                      ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/10"
                                      : "text-slate-400 hover:text-slate-200"
                                  )}
                                >
                                  ลา
                                </button>
                                <button
                                  onClick={() => {
                                    if (isEditingLocked) return;
                                    setAttendanceOverrides(prev => ({ ...prev, [student.studentId]: 'ABSENT' }));
                                    setToastMessage(`เลือกสถานะ 'ขาดเรียน' ให้เลขที่ ${student.studentNo} แล้ว — กด "บันทึกการเช็คชื่อทั้งหมด" เพื่อยืนยัน`);
                                    setTimeout(() => setToastMessage(null), 3000);
                                  }}
                                  disabled={isEditingLocked}
                                  className={cn(
                                    "px-2.5 py-1 rounded text-xs font-bold transition-all",
                                    mStatus === 'ABSENT'
                                      ? "bg-rose-500 text-white shadow-md shadow-rose-500/10"
                                      : "text-slate-400 hover:text-slate-200"
                                  )}
                                >
                                  ขาด
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}
          {activeTab === 'analytics' && (
            <div className="max-w-7xl mx-auto w-full pb-10">
              <StudentAnalyticsDashboard roomName={myRoom || 'No Room'} students={myStudents} />
            </div>
          )}

          {activeTab === 'self-assessment' && (
            <div className="max-w-7xl mx-auto w-full pb-10 space-y-6">
              {/* Header Banner */}
              <div className="bg-[#121624] border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold border border-blue-400/30">
                      Homeroom Advisor Tool
                    </span>
                    <span className="text-xs text-slate-400">ห้องประจำชั้น: {myRoom || 'ม.5/8'}</span>
                  </div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Brain className="w-5 h-5 text-sky-400" />
                    ภารกิจวิเคราะห์ผู้เรียน & สรุปแบบประเมินตนเอง 30 ข้อ (Learner DNA)
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    ข้อมูลเชิงลึก 6 ด้านเพื่อครูที่ปรึกษาและครูผู้สอน: สไตล์การเรียนรู้, ความพร้อมด้านอุปกรณ์/AI, ปัญหาอุปสรรค, บทบาทกลุ่ม และข้อความลับ
                  </p>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="ค้นหาชื่อ / เลขที่..."
                      value={assessmentSearch}
                      onChange={(e) => setAssessmentSearch(e.target.value)}
                      className="bg-black/30 border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 w-40 sm:w-48"
                    />
                  </div>

                  <div className="flex bg-black/40 border border-white/10 rounded-xl p-1 text-xs">
                    <button
                      onClick={() => setAssessmentFilter('ALL')}
                      className={cn("px-2.5 py-1 rounded-lg transition-all", assessmentFilter === 'ALL' ? "bg-blue-600 text-white font-semibold" : "text-slate-400 hover:text-white")}
                    >
                      ทั้งหมด ({myStudents.length})
                    </button>
                    <button
                      onClick={() => setAssessmentFilter('COMPLETED')}
                      className={cn("px-2.5 py-1 rounded-lg transition-all", assessmentFilter === 'COMPLETED' ? "bg-emerald-600 text-white font-semibold" : "text-slate-400 hover:text-white")}
                    >
                      ทำแล้ว ({myStudents.filter(s => selfAssessments[s.studentId]?.isCompleted).length})
                    </button>
                    <button
                      onClick={() => setAssessmentFilter('PENDING')}
                      className={cn("px-2.5 py-1 rounded-lg transition-all", assessmentFilter === 'PENDING' ? "bg-amber-600 text-white font-semibold" : "text-slate-400 hover:text-white")}
                    >
                      ยังไม่ทำ ({myStudents.filter(s => !selfAssessments[s.studentId]?.isCompleted).length})
                    </button>
                  </div>
                </div>
              </div>

              {/* Student Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {myStudents
                  .filter(s => {
                    const matchQuery = s.name.toLowerCase().includes(assessmentSearch.toLowerCase()) ||
                                      s.studentId.includes(assessmentSearch) ||
                                      String(s.studentNo).includes(assessmentSearch);
                    const isDone = Boolean(selfAssessments[s.studentId]?.isCompleted);
                    if (assessmentFilter === 'COMPLETED') return matchQuery && isDone;
                    if (assessmentFilter === 'PENDING') return matchQuery && !isDone;
                    return matchQuery;
                  })
                  .map(student => {
                    const assessment = selfAssessments[student.studentId];
                    const isCompleted = assessment?.isCompleted;

                    return (
                      <div
                        key={student.id}
                        className={cn(
                          "bg-[#141824] border rounded-2xl p-4.5 transition-all relative overflow-hidden flex flex-col justify-between shadow-lg",
                          isCompleted ? "border-white/10 hover:border-blue-500/50" : "border-amber-500/20 bg-amber-500/5"
                        )}
                      >
                        <div>
                          {/* Student Header */}
                          <div className="flex items-center justify-between gap-3 mb-3">
                            <div className="flex items-center gap-3">
                              <img
                                src={student.avatar}
                                alt={student.name}
                                className="w-11 h-11 rounded-xl bg-slate-800 border border-white/10 object-cover"
                              />
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] font-mono font-bold text-slate-400 bg-white/5 px-1.5 py-0.5 rounded">
                                    #{student.studentNo}
                                  </span>
                                  <span className="text-sm font-bold text-white leading-tight">
                                    {student.name}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-400 mt-0.5">
                                  ID: {student.studentId} {assessment?.basicInfo?.nickname && `(${assessment.basicInfo.nickname})`}
                                </div>
                              </div>
                            </div>

                            {/* Status Badge */}
                            {isCompleted ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1 font-semibold shrink-0">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" /> ทำแล้ว
                              </span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 flex items-center gap-1 font-semibold shrink-0">
                                <Clock className="w-3 h-3 text-amber-400" /> รอประเมิน
                              </span>
                            )}
                          </div>

                          {/* Quick Badges / DNA */}
                          {isCompleted && assessment ? (
                            <div className="space-y-2 text-xs bg-black/20 p-3 rounded-xl border border-white/5 mb-3">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-400">สไตล์การเรียน:</span>
                                <span className="font-semibold text-blue-300 truncate max-w-[170px]">
                                  {assessment.learningStyle?.preferredStyles?.join(', ') || 'ลงมือปฏิบัติ'}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-400">บทบาทกลุ่ม:</span>
                                <span className="font-semibold text-sky-300">
                                  {assessment.identity?.groupRole || 'ค้นหาข้อมูล'}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-400">การใช้ AI:</span>
                                <span className="font-semibold text-purple-300">
                                  {assessment.learningStyle?.aiExperience || 'ใช้อยู่ประจำ'}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-400">เป้าหมายอนาคต:</span>
                                <span className="font-semibold text-emerald-300 truncate max-w-[160px]">
                                  {assessment.futureGoals?.careerGoals || 'ยังไม่ระบุ'}
                                </span>
                              </div>

                              {assessment.futureGoals?.privateMessageToTeacher && (
                                <div className="mt-1 pt-1.5 border-t border-white/5 flex items-center gap-1 text-[10px] text-amber-300">
                                  <Sparkles className="w-3 h-3 text-amber-400" />
                                  <span className="truncate">มีข้อความลับถึงครู: "{assessment.futureGoals.privateMessageToTeacher}"</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="bg-black/20 p-3 rounded-xl border border-white/5 mb-3 text-center text-xs text-slate-500">
                              ยังไม่มีข้อมูลการประเมิน 30 ข้อ
                            </div>
                          )}
                        </div>

                        {/* Action Button */}
                        <button
                          onClick={() => setAssessmentModalStudent(student)}
                          className="w-full py-2 px-3 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 hover:text-white border border-blue-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>ดูแฟ้มข้อมูลวิเคราะห์ตนเองฉบับเต็ม (30 ข้อ)</span>
                        </button>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
          </motion.div>
        </AnimatePresence>
       </main>
       )}


       {/* Wellness Profile Modal */}
       {showWellnessModal && selectedStudent && (
         <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
           <div className="bg-[#1c1f2b] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
             <div className="p-4 border-b border-white/10 flex justify-between items-center sticky top-0 bg-[#1c1f2b]/90 backdrop-blur z-10">
               <h2 className="text-lg font-bold text-white flex items-center gap-2">
                 <UserCheck className="w-5 h-5 text-indigo-400" /> Wellness Profile: {selectedStudent.name}
               </h2>
               <button onClick={() => setShowWellnessModal(false)} className="text-slate-400 hover:text-white transition-colors">
                 <X className="w-5 h-5" />
               </button>
             </div>
             
             <div className="p-6 space-y-6">
                {/* Header Info */}
                <div className="flex gap-4 items-center">
                  <img src={selectedStudent.avatar} className="w-20 h-20 rounded-xl bg-slate-800" alt="" />
                  <div>
                    <h3 className="text-xl font-bold">{selectedStudent.name}</h3>
                    <p className="text-slate-400">ID: {selectedStudent.studentId} | ม.1/1</p>
                    <div className="flex gap-2 mt-2">
                      <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded border border-indigo-500/20">งานอดิเรก: เล่นฟุตบอล</span>
                      <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded border border-emerald-500/20">เป้าหมาย: โปรแกรมเมอร์</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Health Data */}
                  <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                    <h4 className="font-bold text-pink-400 flex items-center gap-2 mb-3">
                      <Activity className="w-4 h-4" /> Health & Physical
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-slate-400">หมู่เลือด</span> <span>O+</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">โรคประจำตัว</span> <span className="text-emerald-400">ไม่มี</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">BMI ล่าสุด</span> <span className="text-emerald-400">19.1 (สมส่วน)</span></div>
                    </div>
                  </div>

                  {/* Family Status */}
                  <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                    <h4 className="font-bold text-amber-400 flex items-center gap-2 mb-3">
                      <Home className="w-4 h-4" /> Family Status
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-slate-400">สถานภาพครอบครัว</span> <span>อยู่ด้วยกัน</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">รายได้เฉลี่ย</span> <span>ปานกลาง</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">การเดินทาง</span> <span>รถรับส่ง (2.5 km)</span></div>
                    </div>
                  </div>
                </div>

                {/* Home Photos */}
                <div>
                  <h4 className="font-bold text-slate-200 mb-3 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-indigo-400" /> รูปภาพที่พักอาศัย (Pre-visit)
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-800 rounded-xl aspect-video flex items-center justify-center border border-white/10 relative overflow-hidden group">
                       <span className="text-slate-400 text-sm z-10 group-hover:opacity-0 transition-opacity">หน้าบ้าน</span>
                       <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80')] bg-cover bg-center opacity-40 group-hover:opacity-100 transition-opacity"></div>
                    </div>
                    <div className="bg-slate-800 rounded-xl aspect-video flex items-center justify-center border border-white/10 relative overflow-hidden group">
                       <span className="text-slate-400 text-sm z-10 group-hover:opacity-0 transition-opacity">ภายในบ้าน</span>
                       <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80')] bg-cover bg-center opacity-40 group-hover:opacity-100 transition-opacity"></div>
                    </div>
                  </div>
                </div>
             </div>
           </div>
         </div>

       )}
       {/* LINE Mock Modal */}
       {showLineModal && selectedStudent && (
         <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
           <div className="bg-[#1c1f2b] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col">
             <div className="bg-[#00B900] p-4 text-white flex justify-between items-center">
               <div className="flex items-center gap-2">
                 <MessageCircle className="w-5 h-5" />
                 <h2 className="font-bold">ส่งนัดหมาย (LINE)</h2>
               </div>
               <button onClick={() => setShowLineModal(false)} className="hover:bg-white/20 p-1 rounded transition-colors">
                 <X className="w-5 h-5" />
               </button>
             </div>
             <div className="p-5 space-y-4">
               <p className="text-sm text-slate-300">ระบบจะส่งข้อความนี้ไปยังผู้ปกครองของ {selectedStudent.name}</p>
               <div className="bg-black/30 p-4 rounded-xl text-sm text-slate-200 font-mono whitespace-pre-wrap border border-white/5">
                 {`เรียน ผู้ปกครองของ ${selectedStudent.name},\n\nครูที่ปรึกษาขออนุญาตลงพื้นที่เยี่ยมบ้านในวันที่ ${format(new Date(), 'd MMM yyyy', { locale: th })} เวลา 16:30 น.\n\nหากไม่สะดวก รบกวนแจ้งกลับผ่าน LINE นี้นะคะ\n\nขอบคุณค่ะ`}
               </div>
               <button 
                 onClick={() => setShowLineModal(false)}
                 className="w-full bg-[#00B900] hover:bg-[#009900] text-white font-bold py-3 rounded-xl transition-colors shadow-lg"
               >
                 ส่งข้อความ
               </button>
             </div>
           </div>
         </div>

       )}
       {/* Teacher Field Report Modal */}
       {showReportModal && selectedStudent && (
         <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
           <div className="bg-[#1c1f2b] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
             <div className="p-4 border-b border-white/10 flex justify-between items-center sticky top-0 bg-[#1c1f2b]/90 backdrop-blur z-10">
               <h2 className="text-lg font-bold text-white flex items-center gap-2">
                 <ClipboardList className="w-5 h-5 text-emerald-400" /> บันทึกการเยี่ยมบ้าน: {selectedStudent.name}
               </h2>
               <button onClick={() => setShowReportModal(false)} className="text-slate-400 hover:text-white transition-colors">
                 <X className="w-5 h-5" />
               </button>
             </div>
             
             <div className="p-6 space-y-5">
               <div>
                 <label className="block text-sm font-bold text-slate-300 mb-2">สภาพแวดล้อมที่พักอาศัย (1 = แย่มาก, 5 = ดีมาก)</label>
                 <div className="flex gap-2">
                   {[1,2,3,4,5].map(score => (
                     <button
                       key={score}
                       onClick={() => setReportForm({...reportForm, condition: score})}
                       className={cn(
                         "flex-1 py-2 rounded-lg border font-bold transition-all",
                         reportForm.condition === score 
                           ? "bg-indigo-500/20 border-indigo-500 text-indigo-300 shadow-[0_0_10px_rgba(99,102,241,0.2)]" 
                           : "bg-black/20 border-white/10 text-slate-400 hover:bg-white/5"
                
                       )}>
                       {score}
                     </button>
                   ))}
                 </div>
               </div>

               <div>
                 <label className="block text-sm font-bold text-slate-300 mb-2">บันทึกเพิ่มเติมจากครู (Social Environment Notes)</label>
                 <textarea 
                   value={reportForm.notes}
                   onChange={e => setReportForm({...reportForm, notes: e.target.value})}
                   className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-indigo-500 outline-none h-32 resize-none"
                   placeholder="เช่น สภาพชุมชนแออัด, ผู้ปกครองดูแลเอาใจใส่ดี..."
                 />
               </div>

               <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex items-center justify-between">
                 <div>
                   <h4 className="font-bold text-rose-400 flex items-center gap-2">
                     <AlertTriangle className="w-4 h-4" /> ส่งต่อผู้บริหาร (Urgent Case)
                   </h4>
                   <p className="text-xs text-rose-400/70 mt-1">ต้องการความช่วยเหลือฉุกเฉิน (เช่น ทุน, สภาพจิตใจ)</p>
                 </div>
                 <button 
                   onClick={() => setReportForm({...reportForm, urgent: !reportForm.urgent})}
                   className={cn(
                     "w-12 h-6 rounded-full transition-colors relative",
                     reportForm.urgent ? "bg-rose-500" : "bg-slate-700"
                   )}
                 >
                   <div className={cn(
                     "absolute top-1 w-4 h-4 rounded-full bg-white transition-transform",
                     reportForm.urgent ? "right-1" : "left-1"
                   )} />
                 </button>
               </div>

               {/* New KPIs: Geo Verify, Photo, Risk Level */}
               <div className="space-y-4 pt-2 border-t border-white/5">
                 <div className="flex items-center justify-between bg-black/20 p-3 rounded-lg border border-white/5">
                   <div>
                     <h4 className="text-sm font-bold text-slate-200">ยืนยันพิกัด GPS</h4>
                     <p className="text-[10px] text-slate-400 mt-0.5">ระยะห่าง 50m จากพิกัดบ้าน</p>
                   </div>
                   <button 
                     onClick={() => {
                       setReportForm(prev => ({...prev, checkingGPS: true}));
                       setTimeout(() => {
                         setReportForm(prev => ({...prev, geoVerified: true, checkingGPS: false}));
                       }, 1000);
                     }}
                     disabled={reportForm.geoVerified || reportForm.checkingGPS}
                     className={cn(
                       "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1",
                       reportForm.geoVerified ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-indigo-600 hover:bg-indigo-500 text-white"
                     )}
                   >
                     {reportForm.checkingGPS ? <span className="animate-spin text-lg leading-none">⟳</span> : reportForm.geoVerified ? <CheckCircle className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}
                     {reportForm.checkingGPS ? 'กำลังตรวจสอบ...' : reportForm.geoVerified ? 'ยืนยันแล้ว' : 'กดเพื่อเช็คพิกัด'}
                   </button>
                 </div>

                 <div className="flex items-center justify-between bg-black/20 p-3 rounded-lg border border-white/5">
                   <div>
                     <h4 className="text-sm font-bold text-slate-200">รูปถ่ายหน้าบ้าน</h4>
                     <p className="text-[10px] text-slate-400 mt-0.5">อัปโหลดรูปถ่ายพร้อมนักเรียน</p>
                   </div>
                   <button 
                     onClick={() => setReportForm({...reportForm, photoUploaded: !reportForm.photoUploaded})}
                     className={cn(
                       "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                       reportForm.photoUploaded ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-slate-700/50 text-slate-300 border-white/10 hover:bg-slate-700"
                     )}
                   >
                     {reportForm.photoUploaded ? '✓ จำลองอัปโหลดสำเร็จ' : 'จำลองอัปโหลดภาพ'}
                   </button>
                 </div>

                 <div>
                   <label className="block text-sm font-bold text-slate-300 mb-2">ระดับความเสี่ยง (Risk Level)</label>
                   <div className="grid grid-cols-3 gap-2">
                     {(['LOW', 'MEDIUM', 'HIGH'] as RiskLevel[]).map(level => {
                       const label = level === 'LOW' ? 'ปกติ' : level === 'MEDIUM' ? 'เฝ้าระวัง' : 'เสี่ยงสูง';
                       const colorClass = level === 'LOW' ? "emerald" : level === 'MEDIUM' ? "amber" : "rose";
                       const isActive = reportForm.riskLevel === level;
                       return (
                         <button
                           key={level}
                           onClick={() => setReportForm({...reportForm, riskLevel: level})}
                           className={cn(
                             "py-2 rounded-lg border font-bold text-xs transition-all",
                             isActive ? `bg-${colorClass}-500/20 border-${colorClass}-500 text-${colorClass}-400` : "bg-black/20 border-white/10 text-slate-400 hover:bg-white/5"
                           )}
                         >
                           {label}
                         </button>
                       )
                     })}
                   </div>
                 </div>
               </div>

               <button 
                 onClick={() => {
                   submitHomeVisit({
                     studentId: selectedStudent.studentId,
                     advisorEmail: user?.email || '',
                     visitedAt: new Date().toISOString(),
                     geoVerified: reportForm.geoVerified,
                     riskLevel: reportForm.riskLevel,
                     photoUploaded: reportForm.photoUploaded
                   });
                   setShowReportModal(false);
                 }}
                 className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-colors shadow-lg mt-4"
               >
                 บันทึกข้อมูลเข้าระบบ
               </button>
             </div>
           </div>
         </div>
       )}

       {/* Student Self-Assessment Detail Modal */}
       {assessmentModalStudent && (
         <StudentAssessmentDetailModal
           student={assessmentModalStudent}
           assessment={selfAssessments[assessmentModalStudent.studentId]}
           viewerRole="HOMEROOM"
           onClose={() => setAssessmentModalStudent(null)}
         />
       )}

       {/* Student Commute & Route Map Modal */}
       {routeModalStudent && (
         <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 md:p-6 animate-in fade-in">
           <div className="bg-[#1c1f2b] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
             <div className="p-4 border-b border-white/10 flex justify-between items-center sticky top-0 bg-[#1c1f2b]/95 backdrop-blur z-10">
               <div className="flex items-center gap-2">
                 <Compass className="w-5 h-5 text-indigo-400" />
                 <div>
                   <h3 className="font-bold text-white text-sm sm:text-base">แผนที่การเดินทาง & ที่พักอาศัย</h3>
                   <p className="text-[11px] text-slate-400">{routeModalStudent.name} (#{routeModalStudent.studentNo})</p>
                 </div>
               </div>
               <button 
                 onClick={() => setRouteModalStudent(null)} 
                 className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
               >
                 <X className="w-5 h-5" />
               </button>
             </div>

             <div className="p-4 sm:p-6 space-y-4">
               {/* Student Info preview */}
               <div className="flex items-center gap-3 bg-black/20 p-3 rounded-xl border border-white/5">
                 <img 
                   src={routeModalStudent.photoUrl || routeModalStudent.avatar} 
                   alt="" 
                   className="w-12 h-12 rounded-xl object-cover border border-white/10" 
                 />
                 <div className="flex-1 min-w-0">
                   <div className="font-bold text-white text-sm truncate">{routeModalStudent.name} ({routeModalStudent.nickname})</div>
                   <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                     <MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                     <span className="truncate">{routeModalStudent.homeLocation?.address || 'ไม่ระบุที่อยู่'}</span>
                   </div>
                 </div>
               </div>

               {/* Simulated Interactive Map Display */}
               <div className="bg-[#0f111a] border border-white/10 rounded-xl h-48 sm:h-56 relative overflow-hidden flex items-center justify-center">
                 <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808015_1px,transparent_1px),linear-gradient(to_bottom,#80808015_1px,transparent_1px)] bg-[size:20px_20px]"></div>
                 
                 {/* Commute route line */}
                 <svg className="absolute inset-0 w-full h-full pointer-events-none">
                   <path d="M 60 140 Q 150 50 250 110 T 380 60" fill="none" stroke="#6366f1" strokeWidth="3" strokeDasharray="6 6" className="animate-pulse" />
                 </svg>

                 {/* School Marker */}
                 <div className="absolute top-[30%] right-[15%] flex flex-col items-center">
                   <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg shadow-indigo-500/50">
                     รร
                   </div>
                   <span className="text-[10px] bg-black/70 text-indigo-300 font-bold px-1.5 py-0.5 rounded mt-1">โรงเรียน</span>
                 </div>

                 {/* Home Marker */}
                 <div className="absolute bottom-[20%] left-[15%] flex flex-col items-center">
                   <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg shadow-emerald-500/50">
                     <Home className="w-4 h-4" />
                   </div>
                   <span className="text-[10px] bg-black/70 text-emerald-300 font-bold px-1.5 py-0.5 rounded mt-1">บ้านนักเรียน</span>
                 </div>
               </div>

               {/* Route Details */}
               <div className="grid grid-cols-2 gap-3 text-xs">
                 <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                   <span className="text-slate-400 block mb-1">ระยะทางโดยประมาณ</span>
                   <span className="text-sm font-bold text-white">~ 3.2 กิโลเมตร</span>
                 </div>
                 <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                   <span className="text-slate-400 block mb-1">พาหนะหลัก</span>
                   <span className="text-sm font-bold text-indigo-400">รถรับส่งนักเรียน / มอเตอร์ไซค์</span>
                 </div>
               </div>

               <div className="pt-2 flex gap-2">
                 <a
                   href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(routeModalStudent.homeLocation?.address || 'โรงเรียน')}`}
                   target="_blank"
                   rel="noreferrer"
                   className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all text-center flex items-center justify-center gap-1.5 shadow-md"
                 >
                   <Navigation className="w-3.5 h-3.5" /> เปิดใน Google Maps
                 </a>
                 <button
                   onClick={() => setRouteModalStudent(null)}
                   className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs rounded-xl border border-white/10 transition-colors"
                 >
                   ปิด
                 </button>
               </div>
             </div>
           </div>
         </div>
       )}

       {/* Edit Student Profile Modal */}
       {editProfileStudent && (
         <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 md:p-6 animate-in fade-in">
           <div className="bg-[#1c1f2b] border border-white/10 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
             <div className="p-4 border-b border-white/10 flex justify-between items-center sticky top-0 bg-[#1c1f2b]/95 backdrop-blur z-10">
               <div className="flex items-center gap-2">
                 <Edit3 className="w-5 h-5 text-indigo-400" />
                 <div>
                   <h3 className="font-bold text-white text-sm sm:text-base">แก้ไขข้อมูลโปรไฟล์นักเรียน</h3>
                   <p className="text-[11px] text-slate-400">{editProfileStudent.name} (รหัส {editProfileStudent.studentId})</p>
                 </div>
               </div>
               <button 
                 onClick={() => setEditProfileStudent(null)} 
                 className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
               >
                 <X className="w-5 h-5" />
               </button>
             </div>

             <div className="p-4 sm:p-6 space-y-4">
               <div>
                 <label className="block text-xs font-bold text-slate-300 mb-1.5">ชื่อเล่น</label>
                 <input
                   type="text"
                   value={editNickname}
                   onChange={(e) => setEditNickname(e.target.value)}
                   placeholder="เช่น นนท์, มิ้น..."
                   className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none"
                 />
               </div>

               <div>
                 <label className="block text-xs font-bold text-slate-300 mb-1.5">ลิงก์รูปภาพประจำตัว (Photo URL)</label>
                 <input
                   type="text"
                   value={editPhotoUrl}
                   onChange={(e) => setEditPhotoUrl(e.target.value)}
                   placeholder="https://..."
                   className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none font-mono text-xs"
                 />
               </div>

               <div>
                 <label className="block text-xs font-bold text-slate-300 mb-1.5">ที่อยู่บ้านนักเรียน</label>
                 <textarea
                   value={editAddress}
                   onChange={(e) => setEditAddress(e.target.value)}
                   rows={3}
                   placeholder="เลขที่ หมู่บ้าน ตำบล อำเภอ จังหวัด..."
                   className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-indigo-500 outline-none resize-none"
                 />
               </div>

               <div className="pt-2 border-t border-white/10 space-y-3">
                 <div className="text-xs font-bold text-emerald-400">🔗 เชื่อมโยงบัญชีผู้ปกครอง (Parent Account Linkage)</div>
                 
                 <div>
                   <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                     Firebase Auth UID ของผู้ปกครอง (parentUid)
                   </label>
                   <input
                     type="text"
                     value={editParentUid}
                     onChange={(e) => setEditParentUid(e.target.value)}
                     placeholder="เช่น test_parent_001 หรือ UID จาก Firebase Auth"
                     className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs text-emerald-300 focus:border-emerald-500 outline-none font-mono"
                   />
                   <p className="text-[10px] text-slate-500 mt-0.5">ใช้สำหรับสิทธิ์ความปลอดภัย Firestore Rules ให้ผู้ปกครองเข้าถึงข้อมูลบุตรหลาน</p>
                 </div>

                 <div>
                   <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                     อีเมลผู้ปกครอง (Parent Email)
                   </label>
                   <input
                     type="email"
                     value={editParentEmail}
                     onChange={(e) => setEditParentEmail(e.target.value)}
                     placeholder="เช่น parent.test@gmail.com"
                     className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-indigo-500 outline-none"
                   />
                 </div>
               </div>

               <div className="pt-2 flex gap-2">
                 <button
                   onClick={() => {
                     updateStudentProfile(editProfileStudent.studentId, {
                       nickname: editNickname,
                       photoUrl: editPhotoUrl,
                       address: editAddress,
                       parentUid: editParentUid,
                       parentEmail: editParentEmail
                     });
                     setEditProfileStudent(null);
                     setToastMessage(`อัปเดตข้อมูลและเชื่อมโยงผู้ปกครองของ ${editProfileStudent.name} สำเร็จแล้ว`);
                     setTimeout(() => setToastMessage(null), 3000);
                   }}
                   className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all shadow-md"
                 >
                   บันทึกการแก้ไข
                 </button>
                 <button
                   onClick={() => setEditProfileStudent(null)}
                   className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs rounded-xl border border-white/10 transition-colors"
                 >
                   ยกเลิก
                 </button>
               </div>
             </div>
           </div>
         </div>
       )}

       {/* Floating Toast Message */}
       <AnimatePresence>
         {toastMessage && (
           <motion.div
             initial={{ opacity: 0, y: 20, scale: 0.95 }}
             animate={{ opacity: 1, y: 0, scale: 1 }}
             exit={{ opacity: 0, y: 20, scale: 0.95 }}
             className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 max-w-sm z-50 bg-indigo-600 text-white px-4 py-3 rounded-xl shadow-2xl border border-indigo-400/40 flex items-center gap-3"
           >
             <CheckCircle className="w-5 h-5 text-indigo-200 shrink-0" />
             <div className="text-xs font-semibold flex-1 leading-snug">{toastMessage}</div>
             <button onClick={() => setToastMessage(null)} className="text-indigo-200 hover:text-white">
               <X className="w-4 h-4" />
             </button>
           </motion.div>
         )}
       </AnimatePresence>
    </div>
  )
}

