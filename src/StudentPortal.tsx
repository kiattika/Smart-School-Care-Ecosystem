import { cn } from "./lib/utils";
import React, { useState } from 'react';
import { useStore } from './store';
import { useRealStudents } from './hooks/useRealStudents';
import { Loader2 } from 'lucide-react';
import { 
  QrCode, 
  Flame, 
  Trophy, 
  Clock, 
  CheckCircle2, 
  CalendarDays,
  User,
  Sparkles,
  Heart,
  Shield,
  MapPin,
  Camera,
  Activity,
  Brain,
  Award,
  FolderGit2,
  BookOpen,
  CreditCard,
  FileSpreadsheet,
  Scan,
  ShieldCheck,
  Zap,
  HelpCircle
} from 'lucide-react';

import { GateAttendanceTracker } from './components/student-parent/GateAttendanceTracker';
import { HealthMentalWellbeingModule } from './components/student-parent/HealthMentalWellbeingModule';
import { SocioeconomicWelfareModule } from './components/student-parent/SocioeconomicWelfareModule';
import { BehaviorDisciplineModule } from './components/student-parent/BehaviorDisciplineModule';
import { PortfolioActivityVault } from './components/student-parent/PortfolioActivityVault';
import { AcademicHomeworkModule } from './components/student-parent/AcademicHomeworkModule';
import { ParentEngagementServices } from './components/student-parent/ParentEngagementServices';
import { StudentSelfAssessmentForm } from './components/StudentSelfAssessmentForm';
import { StudentAssessmentDetailModal } from './components/StudentAssessmentDetailModal';

export function StudentPortal() {
  const {
    analytics,
    selfAssessments,
    saveSelfAssessment
  } = useStore();
  const user = useStore(s => s.user);

  // อ่าน record ของตัวเองจาก Firestore สด — ไม่พึ่ง Zustand store ที่ว่างเมื่อล็อกอินใหม่/คนละเครื่อง
  // (เดิม `students[0]` จาก store ว่าง → `student` undefined → หน้าขาว). firestore.rules อนุญาต
  // STUDENT อ่านเฉพาะ doc ที่ studentUid == auth.uid ผ่าน query filter นี้
  const { students: myStudents, loading: studentsLoading } = useRealStudents({ studentUid: user?.uid });

  // 7 Module Tabs + Assessment + Overview
  const [activeTab, setActiveTab] = useState<
    'overview' | 'gate' | 'health' | 'socio' | 'behavior' | 'portfolio' | 'academic' | 'parent' | 'assessment'
  >('overview');

  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [viewDetailModal, setViewDetailModal] = useState(false);

  // Student resolution — โดยปกติ STUDENT จะเห็น record เดียว (ของตัวเอง);
  // selectedStudentId ใช้เฉพาะ DEV profile switcher ถ้ามีมากกว่าหนึ่ง
  const student =
    myStudents.find(s => s.studentId === selectedStudentId) || myStudents[0];

  if (studentsLoading) {
    return (
      <div className="w-full min-h-screen flex flex-col items-center justify-center gap-3 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
        <p className="text-sm">กำลังโหลดข้อมูลนักเรียน…</p>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="w-full max-w-lg mx-auto min-h-screen flex flex-col items-center justify-center gap-4 text-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-slate-800/60 border border-slate-700 flex items-center justify-center">
          <User className="w-8 h-8 text-slate-500" />
        </div>
        <h1 className="text-lg font-bold text-white">ยังไม่มีข้อมูลนักเรียนสำหรับบัญชีนี้</h1>
        <p className="text-sm text-slate-400">
          บัญชี {user?.email || 'นี้'} ยังไม่ได้ผูกกับทะเบียนนักเรียน (field <code className="text-slate-300">studentUid</code>)
          กรุณาติดต่อครูประจำชั้นหรือผู้ดูแลระบบเพื่อเชื่อมบัญชี
        </p>
      </div>
    );
  }

  const studentAnalytics = analytics.find(a => a.studentId === student.studentId) || {
    behaviorScore: 98,
    gpa: 3.88
  };
  const bScore = studentAnalytics.behaviorScore;
  const myAssessment = selfAssessments[student.studentId];

  // Behavior level calculation
  const level = Math.floor(bScore / 20) + 1;
  const levelName = 
    level >= 5 ? 'Diamond Scholar' :
    level >= 4 ? 'Platinum Scholar' :
    level >= 3 ? 'Gold Scholar' :
    level >= 2 ? 'Silver Scholar' : 'Bronze Scholar';

  const schedule = [
    { time: '08:30 - 09:20', period: 'คาบ 1', subject: 'คณิตศาสตร์พื้นฐาน (ค32101)', room: 'อาคาร 4 ห้อง 421', status: 'PRESENT' },
    { time: '09:20 - 10:10', period: 'คาบ 2', subject: 'ฟิสิกส์ 2 (ว32202)', room: 'ห้องแล็บฟิสิกส์ 2', status: 'PRESENT' },
    { time: '10:10 - 11:00', period: 'คาบ 3', subject: 'ภาษาไทย 3 (ท32101)', room: 'อาคาร 3 ห้อง 312', status: 'UNMARKED' },
    { time: '11:00 - 11:50', period: 'คาบ 4', subject: 'เคมี 2 (ว32222)', room: 'ห้องแล็บเคมี 1', status: 'UNMARKED' },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto p-3 sm:p-6 text-slate-100 min-h-screen space-y-6">
      
      {/* Top Banner Header & Student Quick Switcher */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-xl shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <img 
              src={student.photoUrl || student.avatar} 
              alt={student.name} 
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-indigo-500 shadow-xl bg-slate-950"
            />
            <span className="absolute -bottom-1.5 -right-1.5 px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black shadow">
              ONLINE
            </span>
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 font-mono text-xs font-bold border border-indigo-500/30">
                รหัส: {student.studentId}
              </span>
              <span className="text-xs text-slate-400">
                ชั้น ม.{student.room || '5/8'} เลขที่ {student.studentNo}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                ⭐ {levelName} ({bScore} คะแนน)
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white">{student.name}</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              โรงเรียนสมาร์ทแคร์วิทยาลัย • แผนการเรียนวิทยาศาสตร์-คณิตศาสตร์ (AI & Innovation)
            </p>
          </div>
        </div>

        {/* DEV: ถ้า query คืนมามากกว่าหนึ่ง record (เช่นบัญชีทดสอบผูกหลายคน) ให้สลับได้ */}
        {import.meta.env.DEV && myStudents.length > 1 && (
          <div className="flex items-center gap-3 self-stretch md:self-auto bg-slate-800/60 p-2 rounded-2xl border border-slate-700/60">
            <span className="text-xs text-slate-400 pl-2">สลับโปรไฟล์ (DEV):</span>
            <select
              value={student.studentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3 py-1.5 font-bold focus:outline-none focus:border-indigo-500"
            >
              {myStudents.map(s => (
                <option key={s.studentId} value={s.studentId}>
                  {s.name} (ม.{s.room || '5/8'})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 7 Core Module Navigation Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-2 backdrop-blur-xl shadow-xl overflow-x-auto hide-scrollbar">
        <div className="flex items-center gap-1.5 min-w-max">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'overview'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <User className="w-4 h-4" />
            <span>ภาพรวม (Overview)</span>
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
            <span>1. การเข้าเรียน & Gate</span>
          </button>

          <button
            onClick={() => setActiveTab('health')}
            className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'health'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>2. สุขภาพกาย & จิต (2Q/PHQ-9/SDQ)</span>
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
            <span>3. เยี่ยมบ้าน & ทุน กสศ.</span>
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
            <span>4. ความประพฤติ & ใบรับรอง ปพ.</span>
          </button>

          <button
            onClick={() => setActiveTab('portfolio')}
            className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'portfolio'
                ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-lg shadow-pink-500/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <FolderGit2 className="w-4 h-4" />
            <span>5. Portfolio & TCAS 10 หน้า</span>
          </button>

          <button
            onClick={() => setActiveTab('academic')}
            className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'academic'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>6. ปพ.6 & การบ้าน & สอบ</span>
          </button>

          <button
            onClick={() => setActiveTab('parent')}
            className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'parent'
                ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-lg shadow-teal-500/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>7. ชำระเงิน & นัดพบครู</span>
          </button>

          <button
            onClick={() => setActiveTab('assessment')}
            className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'assessment'
                ? 'bg-gradient-to-r from-rose-600 to-orange-600 text-white shadow-lg shadow-rose-500/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Brain className="w-4 h-4" />
            <span>ประเมินตนเอง</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="transition-all duration-300">
        
        {/* OVERVIEW DASHBOARD */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div 
                onClick={() => setActiveTab('gate')}
                className="bg-slate-900/70 border border-slate-800 hover:border-indigo-500/40 rounded-3xl p-5 backdrop-blur-md cursor-pointer transition-all space-y-1"
              >
                <div className="flex items-center justify-between text-indigo-400 mb-1">
                  <Scan className="w-5 h-5" />
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10">07:28 น.</span>
                </div>
                <span className="text-xs text-slate-400 block">สแกนเข้าประตูโรงเรียน</span>
                <span className="text-lg font-black text-white">ตรงเวลา (On Time)</span>
                <p className="text-[10px] text-emerald-400">🌡️ 36.5°C ปกติ</p>
              </div>

              <div 
                onClick={() => setActiveTab('behavior')}
                className="bg-slate-900/70 border border-slate-800 hover:border-emerald-500/40 rounded-3xl p-5 backdrop-blur-md cursor-pointer transition-all space-y-1"
              >
                <div className="flex items-center justify-between text-emerald-400 mb-1">
                  <ShieldCheck className="w-5 h-5" />
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10">ระดับเพชร</span>
                </div>
                <span className="text-xs text-slate-400 block">คะแนนความประพฤติ</span>
                <span className="text-lg font-black text-emerald-400">{bScore} / 100</span>
                <p className="text-[10px] text-slate-400">ไม่เคยถูกตัดคะแนน</p>
              </div>

              <div 
                onClick={() => setActiveTab('academic')}
                className="bg-slate-900/70 border border-slate-800 hover:border-purple-500/40 rounded-3xl p-5 backdrop-blur-md cursor-pointer transition-all space-y-1"
              >
                <div className="flex items-center justify-between text-purple-400 mb-1">
                  <Award className="w-5 h-5" />
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10">Top 3%</span>
                </div>
                <span className="text-xs text-slate-400 block">ผลการเรียนเฉลี่ยสะสม (GPAX)</span>
                <span className="text-lg font-black text-purple-400">3.88</span>
                <p className="text-[10px] text-slate-400">อันดับที่ 4 ของสายชั้น</p>
              </div>

              <div 
                onClick={() => setActiveTab('portfolio')}
                className="bg-slate-900/70 border border-slate-800 hover:border-pink-500/40 rounded-3xl p-5 backdrop-blur-md cursor-pointer transition-all space-y-1"
              >
                <div className="flex items-center justify-between text-pink-400 mb-1">
                  <FolderGit2 className="w-5 h-5" />
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-500/10">TCAS 69</span>
                </div>
                <span className="text-xs text-slate-400 block">จิตอาสา & กิจกรรม</span>
                <span className="text-lg font-black text-white">68 ชม.</span>
                <p className="text-[10px] text-emerald-400">✓ ครบตามเกณฑ์ สพฐ.</p>
              </div>
            </div>

            {/* Timetable & Active Schedule */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-md shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Clock className="w-4 h-4 text-indigo-400" />
                      ตารางเรียนประจำวัน (Today's Class Schedule)
                    </h3>
                    <p className="text-[11px] text-slate-400">วันพฤหัสบดีที่ 20 สิงหาคม 2569</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                    กำลังเรียน คาบ 2
                  </span>
                </div>

                <div className="space-y-3">
                  {schedule.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 bg-slate-800/40 border border-slate-800 rounded-2xl flex items-center justify-between gap-3 hover:border-indigo-500/30 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex flex-col items-center justify-center text-indigo-300">
                          <span className="text-[10px] font-bold">{item.period}</span>
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-white">{item.subject}</h4>
                          <span className="text-[11px] text-slate-400">{item.time} • {item.room}</span>
                        </div>
                      </div>

                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${
                        item.status === 'PRESENT' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                        'bg-slate-800 border-slate-700 text-slate-400'
                      }`}>
                        {item.status === 'PRESENT' ? '✓ เช็คชื่อแล้ว' : 'ยังไม่ถึงเวลา'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Digital Student Identity Pass */}
              <div className="lg:col-span-5 bg-gradient-to-br from-indigo-950/60 via-slate-900 to-slate-900 border border-indigo-500/30 rounded-3xl p-5 sm:p-6 backdrop-blur-md shadow-xl flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-mono tracking-widest text-indigo-300 uppercase font-bold">
                      SMART DIGITAL PASS • ID
                    </span>
                    <QrCode className="w-6 h-6 text-indigo-400" />
                  </div>

                  <div className="flex items-center gap-4 p-3.5 bg-slate-950/60 rounded-2xl border border-indigo-500/20">
                    <img 
                      src={student.photoUrl || student.avatar} 
                      alt={student.name} 
                      className="w-14 h-14 rounded-xl object-cover border border-indigo-400"
                    />
                    <div>
                      <h4 className="text-sm font-bold text-white">{student.name}</h4>
                      <p className="text-xs text-indigo-300 font-mono">ID: {student.studentId}</p>
                      <p className="text-[10px] text-slate-400">สถานะ: นักเรียนปัจจุบัน (Active)</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">การประเมินตนเองล่าสุด:</span>
                    <span className="text-emerald-400 font-bold">
                      {myAssessment?.isCompleted ? '✅ ประเมินครบถ้วน' : '⏳ รอการประเมิน'}
                    </span>
                  </div>
                  <button
                    onClick={() => setActiveTab('assessment')}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Brain className="w-4 h-4" />
                    <span>เปิดแบบฟอร์มประเมินตนเอง</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 1. Gate Attendance Tracker */}
        {activeTab === 'gate' && (
          <GateAttendanceTracker studentId={student.studentId} isParentView={false} />
        )}

        {/* 2. Health & Mental Well-being */}
        {activeTab === 'health' && (
          <HealthMentalWellbeingModule studentId={student.studentId} isParentView={false} />
        )}

        {/* 3. Socioeconomic & Home Visit */}
        {activeTab === 'socio' && (
          <SocioeconomicWelfareModule studentId={student.studentId} />
        )}

        {/* 4. Behavior & Conduct Certificate */}
        {activeTab === 'behavior' && (
          <BehaviorDisciplineModule studentId={student.studentId} isParentView={false} />
        )}

        {/* 5. Portfolio & TCAS 10-Page Exporter */}
        {activeTab === 'portfolio' && (
          <PortfolioActivityVault studentId={student.studentId} />
        )}

        {/* 6. Academic Reports & Homework */}
        {activeTab === 'academic' && (
          <AcademicHomeworkModule studentId={student.studentId} />
        )}

        {/* 7. Parent Engagement & e-Billing */}
        {activeTab === 'parent' && (
          <ParentEngagementServices studentId={student.studentId} />
        )}

        {/* Self Assessment Form */}
        {activeTab === 'assessment' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <StudentSelfAssessmentForm
              student={student}
              existingAssessment={myAssessment}
              onSave={async (assessment) => {
                await saveSelfAssessment(assessment);
              }}
              onClose={() => setActiveTab('overview')}
            />
          </div>
        )}

      </div>

      {/* Student Self-Assessment Detail Modal */}
      {viewDetailModal && student && (
        <StudentAssessmentDetailModal
          student={student}
          assessment={myAssessment}
          viewerRole="STUDENT"
          onClose={() => setViewDetailModal(false)}
        />
      )}
    </div>
  );
}
