import { format } from 'date-fns';
import { cn } from "./lib/utils";
import React, { useEffect, useState } from 'react';
import { useStore } from './store';
import { PortalSidebarLayout } from './components/shared/PortalSidebarLayout';
import { useRealStudents } from './hooks/useRealStudents';
import { subscribeBillingInvoices, subscribeGateAttendanceLogs } from './services/firestoreService';
import { BillingInvoice, GateAttendanceRecord } from './types';
import { attendanceStatsFromCounts } from './lib/studentAttendanceStats';
import { CourseOverviewCards } from './components/student-parent/CourseOverviewCards';
import { 
  Calendar, 
  CheckCircle2, 
  Clock, 
  FileText, 
  ShieldCheck, 
  HeartPulse, 
  CreditCard,
  Scan,
  Activity,
  Award,
  FolderGit2,
  BookOpen,
  MessageSquare,
  MapPin,
  Bell,
  Sparkles,
  Phone,
  AlertTriangle,
  Users,
  CalendarDays
} from 'lucide-react';

import { GateAttendanceTracker } from './components/student-parent/GateAttendanceTracker';
import { HealthMentalWellbeingModule } from './components/student-parent/HealthMentalWellbeingModule';
import { BehaviorDisciplineModule } from './components/student-parent/BehaviorDisciplineModule';
import { StudentDaySchedule } from './components/student-parent/StudentDaySchedule';
import { ParentPortfolioView } from './components/portfolio/ParentPortfolioView';
import { AcademicHomeworkModule } from './components/student-parent/AcademicHomeworkModule';
import { ParentEngagementServices } from './components/student-parent/ParentEngagementServices';
import { FamilyHomeVisitInfoForm } from './components/homevisit/FamilyHomeVisitInfoForm';
import { ClassChatMemberView, useMemberThreads } from './components/chat/ClassChatPanel';
import { isThreadUnread } from './lib/classChat';
import { NotificationBell } from './components/notifications/NotificationBell';

export function ParentPortal() {
  const {
    user,
    attendanceRecords
  } = useStore();
  // นักเรียนของผู้ปกครองคนนี้จาก Firestore สด — query filter ด้วย parentUid (ผ่าน firestore.rules)
  const { students: linkedStudents } = useRealStudents({ parentUid: user?.uid });
  // ห้องสนทนากับครูประจำชั้น (ช่อง PARENT) แบบสด — ทำ badge เมนู + ข้อความล่าสุดบนภาพรวม
  const chatThreads = useMemberThreads(user?.uid).filter(t => t.channel === 'PARENT');

  // TASK 2 (เฟส 2 การเงิน): ใบแจ้งหนี้จริงจาก Firestore แบบ real-time แทน state.billingInvoices
  // ของ Zustand (ไม่เคยมี listener ผูกไว้เลย — ป้ายแจ้งเตือน "มียอดค้างชำระ" เดิมจึงไม่เคยขึ้นจริง)
  const [billingInvoices, setBillingInvoices] = useState<BillingInvoice[]>([]);
  useEffect(() => {
    if (!user?.uid) { setBillingInvoices([]); return; }
    const unsubscribe = subscribeBillingInvoices(setBillingInvoices, { parentUid: user.uid });
    return () => unsubscribe();
  }, [user?.uid]);

  // การผ่านประตูโรงเรียนจริงจาก Firestore แบบ real-time — เดิมอ่านจาก store.gateAttendanceLogs
  // (session-local: ผู้ปกครองเห็นเฉพาะเซสชันเดียวกับที่นักเรียนเช็คอินเท่านั้น) filter ด้วย parentUid
  const [gateAttendanceLogs, setGateAttendanceLogs] = useState<GateAttendanceRecord[]>([]);
  useEffect(() => {
    if (!user?.uid) { setGateAttendanceLogs([]); return; }
    return subscribeGateAttendanceLogs(setGateAttendanceLogs, { parentUid: user.uid });
  }, [user?.uid]);

  // Selected student state (ผู้ปกครองมีบุตรหลานได้หลายคน — เริ่มที่คนแรก)
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

  const student = linkedStudents.find(s => s.studentId === selectedStudentId) || linkedStudents[0];
  const chatUnread = chatThreads.filter(t => t.studentId === student?.studentId && isThreadUnread(t, 'MEMBER')).length;
  // FIX (Task 0): เดิมอ่านจาก StudentAnalytics (session-local store, ว่างเปล่าเสมอ) → ตัวเลขที่เห็น
  // เป็น fallback 98 ตายตัวทุกครั้ง ไม่เคยเปลี่ยนตามพฤติกรรมจริง — ตอนนี้อ่านจาก students/{id}.behaviorScore
  // ของจริงผ่าน useRealStudents() (real-time)
  const bScore = student?.behaviorScore;
  
  const [activeTab, setActiveTab] = useState<
    'timeline' | 'gate' | 'health' | 'behavior' | 'portfolio' | 'academic' | 'billing' | 'chat' | 'appointment' | 'family'
  >('timeline');


  if (!student) {
    return (
      <div className="w-full max-w-2xl mx-auto p-8 text-center text-slate-300 min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <div className="text-lg font-bold">ยังไม่มีข้อมูลนักเรียนที่เชื่อมกับบัญชีของท่าน</div>
        <p className="text-sm text-slate-400">
          กรุณายืนยันตัวตนผู้ปกครอง (Student ID + เลขบัตรประชาชน) หรือติดต่อครูที่ปรึกษาเพื่อเชื่อมบัญชี
        </p>
      </div>
    );
  }

  // Unpaid invoices count
  const pendingInvoices = billingInvoices.filter(i => i.studentId === student.studentId && (i.status === 'PENDING' || i.status === 'OVERDUE'));
  const todayStr = format(new Date(), 'yyyy-MM-dd'); // วันที่ท้องถิ่น (toISOString เป็น UTC → ก่อน 07:00 ไทยได้เมื่อวาน)
  const studentGateLogs = gateAttendanceLogs.filter(g => g.studentId === student.studentId);
  const recentGateLog = studentGateLogs[0];
  const todayEntryLog = studentGateLogs.find(g => g.date === todayStr && g.type === 'ENTRY');

  return (
    <div className="w-full max-w-7xl mx-auto p-3 sm:p-6 text-slate-100 min-h-screen space-y-6">
      
      {/* Parent Header Banner & Child Selector */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-xl shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <img 
              src={student.photoUrl || student.avatar} 
              alt={student.name} 
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-emerald-500 shadow-xl bg-slate-950" 
            />
            <span className="absolute -bottom-1.5 -right-1.5 px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black shadow">
              บุตรหลาน
            </span>
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-mono text-xs font-bold border border-emerald-500/30">
                ระบบดูแลนักเรียนสำหรับผู้ปกครอง
              </span>
              <span className="text-xs text-slate-400">
                รหัส: {student.studentId}{student.room ? ` • ห้อง ม.${student.room}` : ''}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white">{student.name}</h1>
          </div>
        </div>

        {/* Child Switcher & Urgent Alerts */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <div className="flex justify-end sm:order-last">
            <NotificationBell />
          </div>

          {pendingInvoices.length > 0 && (
            <div 
              onClick={() => setActiveTab('billing')}
              className="px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center gap-2 cursor-pointer hover:bg-amber-500/20 transition-all text-xs text-amber-300 font-bold"
            >
              <Bell className="w-4 h-4 text-amber-400 animate-bounce" />
              <span>มียอดค้างชำระ {pendingInvoices.length} รายการ</span>
            </div>
          )}

          <div className="flex items-center gap-2 bg-slate-800/60 p-2 rounded-2xl border border-slate-700/60">
            <span className="text-xs text-slate-400 pl-2">บุตรหลาน:</span>
            <select
              value={student.studentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3 py-1.5 font-bold focus:outline-none focus:border-emerald-500"
            >
              {linkedStudents.map(s => (
                <option key={s.studentId} value={s.studentId}>
                  {s.name}{s.room ? ` (ม.${s.room})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* เมนูย่อย — แถบด้านซ้ายแบบเดียวกับพอร์ทัลครู (PortalSidebarLayout) */}
      <PortalSidebarLayout
        title="เมนูผู้ปกครอง"
        activeId={activeTab}
        onSelect={(id) => setActiveTab(id as typeof activeTab)}
        items={[
          { id: 'timeline', label: 'ไทม์ไลน์ & แจ้งเตือนด่วน', icon: Clock },
          { id: 'gate', label: '1. ประตูโรงเรียน & ยื่นใบลา', icon: Scan },
          { id: 'health', label: '2. สุขภาพ & ห้องพยาบาล', icon: Activity },
          { id: 'behavior', label: '3. คะแนนความประพฤติ', icon: ShieldCheck },
          { id: 'portfolio', label: '4. แฟ้มผลงาน', icon: FolderGit2 },
          { id: 'academic', label: '5. ผลการเรียน & การบ้าน', icon: BookOpen },
          { id: 'billing', label: '6. ชำระเงิน', icon: CreditCard },
          { id: 'chat', label: '7. สนทนากับครู', icon: MessageSquare, badge: chatUnread },
          { id: 'appointment', label: '8. นัดพบครู & ปรึกษา', icon: CalendarDays },
          { id: 'family', label: '9. ข้อมูลครอบครัว (เยี่ยมบ้าน)', icon: Users },
        ]}>
      {/* Main Content View */}
      <div className="transition-all duration-300">
        
        {/* TIMELINE / REAL-TIME PARENT FEED */}
        {activeTab === 'timeline' && (
          <div className="space-y-6">
            {/* Live Gate Entry Banner — จากข้อมูล gate_attendance_logs จริง (real-time, ไม่มี mock) */}
            <div className={cn(
              "bg-gradient-to-r via-slate-900 to-slate-900 border rounded-3xl p-5 sm:p-6 backdrop-blur-xl shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4",
              todayEntryLog ? "from-emerald-950/60 border-emerald-500/30" : "from-slate-800/60 border-slate-700/50"
            )}>
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0",
                  todayEntryLog ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" : "bg-slate-700/40 border-slate-600 text-slate-400"
                )}>
                  {todayEntryLog ? <CheckCircle2 className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                </div>
                <div>
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-wider block mb-0.5",
                    todayEntryLog ? "text-emerald-400" : "text-slate-400"
                  )}>
                    REAL-TIME GATE LOG • การเข้าโรงเรียนวันนี้
                  </span>
                  {todayEntryLog ? (
                    <>
                      <h3 className="text-base font-bold text-white">
                        {student.name} เข้าโรงเรียนเวลา {todayEntryLog.timestamp}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {todayEntryLog.temperature ? `อุณหภูมิร่างกาย ${todayEntryLog.temperature.toFixed(1)}°C • ` : ''}
                        {todayEntryLog.gateName} • สถานะ: {todayEntryLog.status === 'LATE' ? 'มาสาย' : 'ตรงเวลา'}
                      </p>
                    </>
                  ) : (
                    <>
                      <h3 className="text-base font-bold text-white">ยังไม่มีข้อมูลการเข้าโรงเรียนของวันนี้</h3>
                      <p className="text-xs text-slate-400">
                        {recentGateLog
                          ? `ผ่านประตูล่าสุด: ${recentGateLog.type === 'ENTRY' ? 'เข้า' : 'ออก'} ${recentGateLog.timestamp} (${recentGateLog.date})`
                          : 'ยังไม่พบประวัติการผ่านประตูของนักเรียนคนนี้'}
                      </p>
                    </>
                  )}
                </div>
              </div>

              <button
                onClick={() => setActiveTab('gate')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow cursor-pointer transition-all self-stretch sm:self-auto"
              >
                ดูประวัติทั้งหมด / ยื่นใบลา
              </button>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div 
                onClick={() => setActiveTab('behavior')}
                className="bg-slate-900/70 border border-slate-800 hover:border-emerald-500/40 rounded-3xl p-5 backdrop-blur-md cursor-pointer transition-all space-y-1"
              >
                <div className="flex items-center justify-between text-emerald-400 mb-1">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <span className="text-xs text-slate-400 block">คะแนนความประพฤติ</span>
                <span className="text-2xl font-black text-emerald-400">{bScore !== undefined ? `${bScore} / 100` : 'ยังไม่มีข้อมูล'}</span>
              </div>

              <div 
                onClick={() => setActiveTab('billing')}
                className="bg-slate-900/70 border border-slate-800 hover:border-teal-500/40 rounded-3xl p-5 backdrop-blur-md cursor-pointer transition-all space-y-1"
              >
                <div className="flex items-center justify-between text-teal-400 mb-1">
                  <CreditCard className="w-5 h-5" />
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-500/10">PromptPay</span>
                </div>
                <span className="text-xs text-slate-400 block">ค่าบำรุงการศึกษา</span>
                <span className={`text-2xl font-black ${pendingInvoices.length > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {pendingInvoices.length > 0 ? `฿${pendingInvoices.reduce((a,c) => a + (c?.totalAmount ?? (c as any)?.amount ?? 0), 0).toLocaleString()}` : 'ไม่มียอดค้าง'}
                </span>
                <p className="text-[10px] text-slate-400">
                  {pendingInvoices.length > 0 ? 'รอดำเนินการชำระ' : 'ไม่มียอดค้างชำระ'}
                </p>
              </div>
            </div>

            {/* สถิติการเข้าเรียน (ขาด/ลา/มาสาย) — สะสมทั้งหมด จาก students/{id}.attendanceStats
                (derived cache, sync คู่กับ attendance_records จริงเสมอ — ดู firestoreService.ts) */}
            {(() => {
              const attStats = attendanceStatsFromCounts(student.studentId, student.attendanceStats);
              return (
                <div className={cn(
                  "rounded-3xl p-5 sm:p-6 backdrop-blur-md shadow-xl border space-y-3",
                  attStats.isBelowThreshold ? "bg-red-950/30 border-red-800/50" : "bg-slate-900/70 border-slate-800"
                )}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" /> สถิติการเข้าเรียน (สะสมทั้งหมด)
                    </h3>
                    {attStats.isBelowThreshold && (
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-red-500/20 text-red-300 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> อัตราเข้าเรียนต่ำกว่าเกณฑ์ {attStats.threshold}%
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    <div>
                      <div className="text-xl font-black text-emerald-400">{attStats.present}</div>
                      <div className="text-[10px] text-slate-400">มาเรียนปกติ</div>
                    </div>
                    <div>
                      <div className="text-xl font-black text-red-400">{attStats.absent}</div>
                      <div className="text-[10px] text-slate-400">ขาด</div>
                    </div>
                    <div>
                      <div className="text-xl font-black text-indigo-400">{attStats.leave}</div>
                      <div className="text-[10px] text-slate-400">ลา</div>
                    </div>
                    <div>
                      <div className="text-xl font-black text-amber-400">{attStats.late}</div>
                      <div className="text-[10px] text-slate-400">มาสาย</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                    <span className="text-xs text-slate-400">อัตราการเข้าเรียน (ไม่นับวันลา)</span>
                    <span className={cn("text-lg font-black", attStats.isBelowThreshold ? "text-red-400" : "text-emerald-400")}>
                      {attStats.attendanceRate !== null ? `${attStats.attendanceRate}%` : 'ยังไม่มีข้อมูลเช็คชื่อ'}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* รายวิชา: บน = สถิติเข้าเรียน, ล่าง = คะแนนกิจกรรม + เครื่องหมายเชิดชู (อ่านผ่าน rules ผู้ปกครองตัวจริงของนักเรียน) */}
            <CourseOverviewCards studentId={student.studentId} room={student.room} courseStats={student.courseAttendanceStats} />

            {/* Recent Communication & Self Assessment Detail Button */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-12 bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-md shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-emerald-400" />
                    ข้อความล่าสุดจากโรงเรียนและครูประจำชั้น
                  </h3>
                  <button 
                    onClick={() => setActiveTab('chat')}
                    className="text-xs text-emerald-400 font-bold hover:underline cursor-pointer"
                  >
                    เปิดห้องสนทนา →
                  </button>
                </div>

                {(() => {
                  // ข้อความล่าสุดในช่องสนทนาของนักเรียนคนนี้ (จริงจาก class_chat_threads) — ไม่มี = empty state
                  const thread = chatThreads.find(t => t.studentId === student.studentId && t.lastAt);
                  if (!thread) {
                    return (
                      <div className="p-4 bg-slate-800/40 border border-slate-800 rounded-2xl text-xs text-slate-400">
                        ยังไม่มีข้อความจากครูประจำชั้น
                      </div>
                    );
                  }
                  return (
                    <div className="p-4 bg-slate-800/40 border border-slate-800 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">{thread.lastSenderRole === 'TEACHER' ? 'ครูประจำชั้น' : 'คุณ'}</span>
                        <span className="text-[10px] text-slate-500">{new Date(thread.lastAt!).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{thread.lastText}</p>
                    </div>
                  );
                })()}
              </div>

            </div>

            <StudentDaySchedule room={student.room} />
          </div>
        )}

        {/* 1. Gate Attendance Tracker */}
        {activeTab === 'gate' && (
          <GateAttendanceTracker studentId={student.studentId} student={student} isParentView={true} />
        )}

        {/* 2. Health & Mental Well-being */}
        {activeTab === 'health' && (
          <HealthMentalWellbeingModule studentId={student.studentId} student={student} isParentView={true} />
        )}

        {/* 4. Behavior & Conduct */}
        {activeTab === 'behavior' && (
          <BehaviorDisciplineModule student={student} isParentView={true} />
        )}

        {/* 5. Portfolio Vault & TCAS */}
        {activeTab === 'portfolio' && (
          <ParentPortfolioView parentUid={user?.uid} studentId={student.studentId} />
        )}

        {/* 6. Academic Reports & Homework */}
        {activeTab === 'academic' && (
          <AcademicHomeworkModule studentId={student.studentId} room={student.room} studentName={student.name} />
        )}

        {/* 7. Parent Engagement & e-Billing & Appointments */}
        {activeTab === 'billing' && (
          <ParentEngagementServices studentId={student.studentId} student={student} isParentView={true} section="billing" />
        )}
        {activeTab === 'chat' && user?.uid && (
          <ClassChatMemberView channel="PARENT" student={student} viewerUid={user.uid} viewerName={`ผู้ปกครอง ${student.name}`} />
        )}
        {activeTab === 'appointment' && (
          <ParentEngagementServices studentId={student.studentId} student={student} isParentView={true} section="appointment" />
        )}

        {activeTab === 'family' && user?.uid && (
          <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-5">
            <FamilyHomeVisitInfoForm student={student} parentUid={user.uid} />
          </div>
        )}

      </div>
      </PortalSidebarLayout>

    </div>
  );
}
