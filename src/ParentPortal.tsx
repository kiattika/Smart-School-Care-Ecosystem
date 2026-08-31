import { cn } from "./lib/utils";
import React, { useState } from 'react';
import { useStore } from './store';
import { useRealStudents } from './hooks/useRealStudents';
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
  AlertTriangle
} from 'lucide-react';

import { GateAttendanceTracker } from './components/student-parent/GateAttendanceTracker';
import { HealthMentalWellbeingModule } from './components/student-parent/HealthMentalWellbeingModule';
import { SocioeconomicWelfareModule } from './components/student-parent/SocioeconomicWelfareModule';
import { BehaviorDisciplineModule } from './components/student-parent/BehaviorDisciplineModule';
import { PortfolioActivityVault } from './components/student-parent/PortfolioActivityVault';
import { AcademicHomeworkModule } from './components/student-parent/AcademicHomeworkModule';
import { ParentEngagementServices } from './components/student-parent/ParentEngagementServices';
import { StudentAssessmentDetailModal } from './components/StudentAssessmentDetailModal';

export function ParentPortal() {
  const {
    user,
    analytics,
    attendanceRecords,
    gateAttendanceLogs,
    billingInvoices,
    parentTeacherMessages,
    selfAssessments
  } = useStore();
  // นักเรียนของผู้ปกครองคนนี้จาก Firestore สด — query filter ด้วย parentUid (ผ่าน firestore.rules)
  const { students: linkedStudents } = useRealStudents({ parentUid: user?.uid });

  // Selected student state (ผู้ปกครองมีบุตรหลานได้หลายคน — เริ่มที่คนแรก)
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

  const student = linkedStudents.find(s => s.studentId === selectedStudentId) || linkedStudents[0];
  const studentAnalytics = student ? analytics.find(a => a.studentId === student.studentId) : null;
  const bScore = studentAnalytics?.behaviorScore ?? 98;
  const myAssessment = selfAssessments[student?.studentId || '38502'];

  const [activeTab, setActiveTab] = useState<
    'timeline' | 'gate' | 'health' | 'socio' | 'behavior' | 'portfolio' | 'academic' | 'services'
  >('timeline');

  const [viewDetailModal, setViewDetailModal] = useState(false);

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
  const pendingInvoices = billingInvoices.filter(i => i.studentId === student.studentId && i.status === 'UNPAID');
  const recentGateLog = gateAttendanceLogs.find(g => g.studentId === student.studentId);

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
                รหัส: {student.studentId} • ห้อง ม.{student.room || '5/8'}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white">{student.name}</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              ครูประจำชั้น: ครูกิตติศักดิ์ • เบอร์โทรฉุกเฉินโรงเรียน: 02-123-4567
            </p>
          </div>
        </div>

        {/* Child Switcher & Urgent Alerts */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          {pendingInvoices.length > 0 && (
            <div 
              onClick={() => setActiveTab('services')}
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
                  {s.name} (ม.{s.room || '5/8'})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 7 Core Module Navigation Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-2 backdrop-blur-xl shadow-xl overflow-x-auto hide-scrollbar">
        <div className="flex items-center gap-1.5 min-w-max">
          <button
            onClick={() => setActiveTab('timeline')}
            className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'timeline'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>ไทม์ไลน์ & แจ้งเตือนด่วน</span>
          </button>

          <button
            onClick={() => setActiveTab('gate')}
            className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'gate'
                ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-500/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Scan className="w-4 h-4" />
            <span>1. ประตูโรงเรียน & ยื่นใบลา</span>
          </button>

          <button
            onClick={() => setActiveTab('health')}
            className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'health'
                ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-lg shadow-pink-500/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>2. สุขภาพ & ห้องพยาบาล</span>
          </button>

          <button
            onClick={() => setActiveTab('socio')}
            className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'socio'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>3. เยี่ยมบ้าน & ข้อมูลครอบครัว</span>
          </button>

          <button
            onClick={() => setActiveTab('behavior')}
            className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'behavior'
                ? 'bg-gradient-to-r from-amber-600 to-yellow-600 text-white shadow-lg shadow-amber-500/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>4. คะแนนพฤติกรรม & บันทึก</span>
          </button>

          <button
            onClick={() => setActiveTab('portfolio')}
            className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'portfolio'
                ? 'bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white shadow-lg shadow-fuchsia-500/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <FolderGit2 className="w-4 h-4" />
            <span>5. แฟ้มผลงาน & TCAS</span>
          </button>

          <button
            onClick={() => setActiveTab('academic')}
            className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'academic'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>6. ผลการเรียน ปพ.6 & การบ้าน</span>
          </button>

          <button
            onClick={() => setActiveTab('services')}
            className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'services'
                ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-lg shadow-teal-500/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>7. ชำระเงิน & นัดพบครู</span>
          </button>
        </div>
      </div>

      {/* Main Content View */}
      <div className="transition-all duration-300">
        
        {/* TIMELINE / REAL-TIME PARENT FEED */}
        {activeTab === 'timeline' && (
          <div className="space-y-6">
            {/* Live Gate Entry Banner */}
            <div className="bg-gradient-to-r from-emerald-950/60 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-3xl p-5 sm:p-6 backdrop-blur-xl shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block mb-0.5">
                    REAL-TIME GATE LOG • เข้าประตูโรงเรียนเรียบร้อยแล้ว
                  </span>
                  <h3 className="text-base font-bold text-white">
                    {student.name} สแกนใบหน้า/NFC เข้าโรงเรียนเวลา 07:28 น.
                  </h3>
                  <p className="text-xs text-slate-400">
                    อุณหภูมิร่างกาย 36.5°C • ประตู 1 (อาคารหน้า) • สถานะ: ปกติ (ตรงเวลา)
                  </p>
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
                onClick={() => setActiveTab('academic')}
                className="bg-slate-900/70 border border-slate-800 hover:border-indigo-500/40 rounded-3xl p-5 backdrop-blur-md cursor-pointer transition-all space-y-1"
              >
                <div className="flex items-center justify-between text-indigo-400 mb-1">
                  <Award className="w-5 h-5" />
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10">ปพ.6</span>
                </div>
                <span className="text-xs text-slate-400 block">ผลการเรียนเฉลี่ย</span>
                <span className="text-2xl font-black text-indigo-400">3.88</span>
                <p className="text-[10px] text-slate-400">เกรด 4.00 ทุกวิชาหลัก</p>
              </div>

              <div 
                onClick={() => setActiveTab('behavior')}
                className="bg-slate-900/70 border border-slate-800 hover:border-emerald-500/40 rounded-3xl p-5 backdrop-blur-md cursor-pointer transition-all space-y-1"
              >
                <div className="flex items-center justify-between text-emerald-400 mb-1">
                  <ShieldCheck className="w-5 h-5" />
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10">เกณฑ์ดีเยี่ยม</span>
                </div>
                <span className="text-xs text-slate-400 block">คะแนนความประพฤติ</span>
                <span className="text-2xl font-black text-emerald-400">{bScore} / 100</span>
                <p className="text-[10px] text-slate-400">ระดับ Diamond Scholar</p>
              </div>

              <div 
                onClick={() => setActiveTab('health')}
                className="bg-slate-900/70 border border-slate-800 hover:border-pink-500/40 rounded-3xl p-5 backdrop-blur-md cursor-pointer transition-all space-y-1"
              >
                <div className="flex items-center justify-between text-pink-400 mb-1">
                  <HeartPulse className="w-5 h-5" />
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-500/10">สุขภาพ</span>
                </div>
                <span className="text-xs text-slate-400 block">คัดกรอง 2Q & PHQ-9</span>
                <span className="text-2xl font-black text-emerald-400">ปกติ</span>
                <p className="text-[10px] text-slate-400">ไม่มีภาวะซึมเศร้า</p>
              </div>

              <div 
                onClick={() => setActiveTab('services')}
                className="bg-slate-900/70 border border-slate-800 hover:border-teal-500/40 rounded-3xl p-5 backdrop-blur-md cursor-pointer transition-all space-y-1"
              >
                <div className="flex items-center justify-between text-teal-400 mb-1">
                  <CreditCard className="w-5 h-5" />
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-500/10">PromptPay</span>
                </div>
                <span className="text-xs text-slate-400 block">ค่าบำรุงการศึกษา</span>
                <span className={`text-2xl font-black ${pendingInvoices.length > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {pendingInvoices.length > 0 ? `฿${pendingInvoices.reduce((a,c) => a + (c?.totalAmount ?? (c as any)?.amount ?? 0), 0).toLocaleString()}` : 'ครบถ้วน'}
                </span>
                <p className="text-[10px] text-slate-400">
                  {pendingInvoices.length > 0 ? 'รอดำเนินการชำระ' : 'ออกใบเสร็จแล้ว'}
                </p>
              </div>
            </div>

            {/* Recent Communication & Self Assessment Detail Button */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8 bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-md shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-emerald-400" />
                    ข้อความล่าสุดจากโรงเรียนและครูประจำชั้น
                  </h3>
                  <button 
                    onClick={() => setActiveTab('services')}
                    className="text-xs text-emerald-400 font-bold hover:underline cursor-pointer"
                  >
                    เปิดห้องสนทนา & นัดพบ →
                  </button>
                </div>

                <div className="p-4 bg-slate-800/40 border border-slate-800 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">ครูกิตติศักดิ์ (ครูประจำชั้น ม.5/8)</span>
                    <span className="text-[10px] text-slate-500">วันนี้ 08:15 น.</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    "สวัสดีครับคุณพ่อคุณแม่ น้องสมชายส่งรายงานโครงงานฟิสิกส์เรียบร้อยแล้วนะครับ ผลการเรียนอยู่ในเกณฑ์ดีเยี่ยม สามารถจองเวลานัดพบผู้ปกครองทาง Google Meet ได้เลยครับ"
                  </p>
                </div>
              </div>

              <div className="lg:col-span-4 bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-md shadow-xl flex flex-col justify-between space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-white mb-1">ผลการประเมินตนเองของนักเรียน</h4>
                  <p className="text-xs text-slate-400">
                    แบบประเมินสุขภาวะ กิจกรรม และความพร้อมทางการเรียน
                  </p>
                </div>

                <div className="p-3.5 bg-slate-800/40 rounded-2xl border border-slate-800 text-xs space-y-1">
                  <span className="text-slate-400">สถานะการประเมิน:</span>
                  <p className="text-emerald-400 font-bold">
                    {myAssessment?.isCompleted ? '✓ ประเมินเรียบร้อยแล้ว' : 'ยังไม่เสร็จสิ้น'}
                  </p>
                </div>

                <button
                  onClick={() => setViewDetailModal(true)}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold border border-slate-700 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <span>ดูรายละเอียดผลการประเมิน</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 1. Gate Attendance Tracker */}
        {activeTab === 'gate' && (
          <GateAttendanceTracker studentId={student.studentId} isParentView={true} />
        )}

        {/* 2. Health & Mental Well-being */}
        {activeTab === 'health' && (
          <HealthMentalWellbeingModule studentId={student.studentId} isParentView={true} />
        )}

        {/* 3. Socioeconomic Welfare & Home Visit */}
        {activeTab === 'socio' && (
          <SocioeconomicWelfareModule studentId={student.studentId} />
        )}

        {/* 4. Behavior & Conduct */}
        {activeTab === 'behavior' && (
          <BehaviorDisciplineModule studentId={student.studentId} isParentView={true} />
        )}

        {/* 5. Portfolio Vault & TCAS */}
        {activeTab === 'portfolio' && (
          <PortfolioActivityVault studentId={student.studentId} />
        )}

        {/* 6. Academic Reports & Homework */}
        {activeTab === 'academic' && (
          <AcademicHomeworkModule studentId={student.studentId} />
        )}

        {/* 7. Parent Engagement & e-Billing & Appointments */}
        {activeTab === 'services' && (
          <ParentEngagementServices studentId={student.studentId} />
        )}

      </div>

      {/* Student Self-Assessment Detail Modal for Parent */}
      {viewDetailModal && (
        <StudentAssessmentDetailModal
          student={student}
          assessment={myAssessment}
          viewerRole="PARENT"
          onClose={() => setViewDetailModal(false)}
        />
      )}
    </div>
  );
}
