import { cn } from "./lib/utils";
import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { useStore } from './store';
import { PortalSidebarLayout } from './components/shared/PortalSidebarLayout';
import { useRealStudents } from './hooks/useRealStudents';
import { attendanceStatsFromCounts } from './lib/studentAttendanceStats';
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
  HelpCircle,
  Users
} from 'lucide-react';

import { NotificationBell } from './components/notifications/NotificationBell';
import { GateAttendanceTracker } from './components/student-parent/GateAttendanceTracker';
import { StudentElectiveEnrollment } from './components/student-parent/StudentElectiveEnrollment';
import { HealthMentalWellbeingModule } from './components/student-parent/HealthMentalWellbeingModule';
import { BehaviorDisciplineModule } from './components/student-parent/BehaviorDisciplineModule';
import { StudentDaySchedule } from './components/student-parent/StudentDaySchedule';
import { subscribeGateAttendanceLogs, getSelfAssessmentRecord } from './services/firestoreService';
import { GateAttendanceRecord, StudentSelfAssessment } from './types';
import { StudentPortfolioSection } from './components/portfolio/StudentPortfolioSection';
import { StudentHomeLocationForm } from './components/homevisit/StudentHomeLocationForm';
import { AcademicHomeworkModule } from './components/student-parent/AcademicHomeworkModule';
import { ParentEngagementServices } from './components/student-parent/ParentEngagementServices';
import { StudentSelfAssessmentForm } from './components/StudentSelfAssessmentForm';
import { StudentAssessmentDetailModal } from './components/StudentAssessmentDetailModal';
import { StudentProfilePhotoEditor } from './components/student-parent/StudentProfilePhotoEditor';

export function StudentPortal() {
  const { saveSelfAssessment } = useStore();
  const user = useStore(s => s.user);

  // อ่าน record ของตัวเองจาก Firestore สด — ไม่พึ่ง Zustand store ที่ว่างเมื่อล็อกอินใหม่/คนละเครื่อง
  // (เดิม `students[0]` จาก store ว่าง → `student` undefined → หน้าขาว). firestore.rules อนุญาต
  // STUDENT อ่านเฉพาะ doc ที่ studentUid == auth.uid ผ่าน query filter นี้
  const { students: myStudents, loading: studentsLoading } = useRealStudents({ studentUid: user?.uid });

  // 7 Module Tabs + Assessment + Overview
  const [activeTab, setActiveTab] = useState<
    'overview' | 'gate' | 'health' | 'socio' | 'behavior' | 'electives' | 'portfolio' | 'academic' | 'parent' | 'assessment'
  >('overview');

  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [viewDetailModal, setViewDetailModal] = useState(false);
  const [showPhotoEditor, setShowPhotoEditor] = useState(false);

  // ประตูโรงเรียนวันนี้ (จริงจาก gate_attendance_logs ของตัวเอง — query ด้วย studentUid ให้ผ่าน rules)
  const [gateLogs, setGateLogs] = useState<GateAttendanceRecord[]>([]);
  useEffect(() => {
    if (!user?.uid) { setGateLogs([]); return; }
    return subscribeGateAttendanceLogs(setGateLogs, { studentUid: user.uid });
  }, [user?.uid]);

  // ผลประเมินตนเองที่บันทึกไว้จริงใน Firestore (เดิมอ่านจาก store ที่ว่างเมื่อเปิดหน้าใหม่ → ขึ้น "รอการประเมิน" ทั้งที่ส่งไปแล้ว)
  const [savedAssessment, setSavedAssessment] = useState<StudentSelfAssessment | null>(null);
  const [assessmentVersion, setAssessmentVersion] = useState(0);

  // Student resolution — โดยปกติ STUDENT จะเห็น record เดียว (ของตัวเอง);
  // selectedStudentId ใช้เฉพาะ DEV profile switcher ถ้ามีมากกว่าหนึ่ง
  const student =
    myStudents.find(s => s.studentId === selectedStudentId) || myStudents[0];

  const studentIdForAssessment = student?.studentId;
  useEffect(() => {
    if (!studentIdForAssessment) { setSavedAssessment(null); return; }
    let cancelled = false;
    getSelfAssessmentRecord(studentIdForAssessment)
      .then(r => { if (!cancelled) setSavedAssessment(r); })
      .catch(() => { if (!cancelled) setSavedAssessment(null); });
    return () => { cancelled = true; };
  }, [studentIdForAssessment, assessmentVersion]);

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

  // คะแนนความประพฤติจริงจาก students/{id}.behaviorScore (real-time)
  const bScore = student.behaviorScore;
  const myAssessment = savedAssessment || undefined;

  // ประตูโรงเรียนวันนี้ (วันที่ตามเวลาท้องถิ่น ไม่ใช่ UTC)
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayEntryLog = gateLogs.find(g => g.studentId === student.studentId && g.date === todayStr && g.type === 'ENTRY');

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
            {user?.uid && student.studentUid === user.uid && (
              <button
                onClick={() => setShowPhotoEditor(true)}
                title="เปลี่ยนรูปโปรไฟล์"
                className="absolute -top-1.5 -left-1.5 w-7 h-7 rounded-full bg-indigo-600 hover:bg-indigo-500 border-2 border-slate-900 flex items-center justify-center text-white shadow-lg transition-colors"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 font-mono text-xs font-bold border border-indigo-500/30">
                รหัส: {student.studentId}
              </span>
              {(student.room || student.studentNo) && (
                <span className="text-xs text-slate-400">
                  {student.room ? `ห้อง ${student.room}` : ''}{student.room && student.studentNo ? ' ' : ''}{student.studentNo ? `เลขที่ ${student.studentNo}` : ''}
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white">{student.name}</h1>
          </div>
        </div>

        <div className="flex items-center gap-3 self-stretch md:self-auto">
          {/* DEV: ถ้า query คืนมามากกว่าหนึ่ง record (เช่นบัญชีทดสอบผูกหลายคน) ให้สลับได้ */}
          {import.meta.env.DEV && myStudents.length > 1 && (
            <div className="flex items-center gap-3 bg-slate-800/60 p-2 rounded-2xl border border-slate-700/60">
              <span className="text-xs text-slate-400 pl-2">สลับโปรไฟล์ (DEV):</span>
              <select
                value={student.studentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3 py-1.5 font-bold focus:outline-none focus:border-indigo-500"
              >
                {myStudents.map(s => (
                  <option key={s.studentId} value={s.studentId}>
                    {s.name}{s.room ? ` (${s.room})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
          <NotificationBell />
        </div>
      </div>

      {/* เมนูย่อย — แถบด้านซ้ายแบบเดียวกับพอร์ทัลครู (PortalSidebarLayout) */}
      <PortalSidebarLayout
        title="เมนูนักเรียน"
        activeId={activeTab}
        onSelect={(id) => setActiveTab(id as typeof activeTab)}
          items={[
            { id: 'overview', label: 'ภาพรวม (Overview)', icon: User },
            { id: 'gate', label: '1. การเข้าเรียน & Gate', icon: Scan },
            { id: 'health', label: '2. สุขภาพกาย & จิต (2Q/SDQ)', icon: Activity },
            { id: 'socio', label: '3. ที่อยู่บ้าน & เยี่ยมบ้าน', icon: MapPin },
            { id: 'behavior', label: '4. คะแนนความประพฤติ', icon: ShieldCheck },
            { id: 'electives', label: 'สมัครชุมนุม', icon: Users },
            { id: 'portfolio', label: '5. แฟ้มผลงาน', icon: FolderGit2 },
            { id: 'academic', label: '6. ปพ.6 & การบ้าน & สอบ', icon: BookOpen },
            { id: 'parent', label: '7. ชำระเงิน & นัดพบครู', icon: CreditCard },
            { id: 'assessment', label: 'ประเมินตนเอง', icon: Brain },
          ]}>
      {/* Main Content Area */}
      <div className="transition-all duration-300">
        
        {/* OVERVIEW DASHBOARD */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Quick Metrics Grid — เฉพาะตัวเลขที่มีข้อมูลจริงรองรับ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                onClick={() => setActiveTab('gate')}
                className="bg-slate-900/70 border border-slate-800 hover:border-indigo-500/40 rounded-3xl p-5 backdrop-blur-md cursor-pointer transition-all space-y-1"
              >
                <div className="flex items-center justify-between text-indigo-400 mb-1">
                  <Scan className="w-5 h-5" />
                  {todayEntryLog && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10">{todayEntryLog.timestamp}</span>
                  )}
                </div>
                <span className="text-xs text-slate-400 block">สแกนเข้าประตูโรงเรียนวันนี้</span>
                <span className="text-lg font-black text-white">
                  {todayEntryLog ? (todayEntryLog.status === 'LATE' ? 'มาสาย' : 'ตรงเวลา') : 'ยังไม่มีข้อมูลวันนี้'}
                </span>
                {todayEntryLog?.gateName && <p className="text-[10px] text-slate-400">{todayEntryLog.gateName}</p>}
              </div>

              <div
                onClick={() => setActiveTab('behavior')}
                className="bg-slate-900/70 border border-slate-800 hover:border-emerald-500/40 rounded-3xl p-5 backdrop-blur-md cursor-pointer transition-all space-y-1"
              >
                <div className="flex items-center justify-between text-emerald-400 mb-1">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <span className="text-xs text-slate-400 block">คะแนนความประพฤติ</span>
                <span className="text-lg font-black text-emerald-400">
                  {bScore !== undefined ? `${bScore} / 100` : 'ยังไม่มีข้อมูล'}
                </span>
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
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" /> สถิติการเข้าเรียนของฉัน (สะสมทั้งหมด)
                    </h3>
                    {attStats.isBelowThreshold && (
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-red-500/20 text-red-300">
                        ⚠️ อัตราเข้าเรียนต่ำกว่าเกณฑ์ {attStats.threshold}%
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

            {/* ตารางเรียนวันนี้ + บัตรประจำตัว */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7">
                <StudentDaySchedule room={student.room} />
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
          <GateAttendanceTracker studentId={student.studentId} student={student} isParentView={false} />
        )}

        {/* 2. Health & Mental Well-being */}
        {activeTab === 'health' && (
          <HealthMentalWellbeingModule studentId={student.studentId} student={student} isParentView={false} />
        )}

        {/* 3. ที่อยู่บ้าน & พิกัดสำหรับเยี่ยมบ้าน (บันทึกจริงลง Firestore) */}
        {activeTab === 'socio' && user?.uid && (
          <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-5">
            <StudentHomeLocationForm student={student} studentUid={user.uid} />
          </div>
        )}

        {/* 4. Behavior & Conduct Certificate */}
        {activeTab === 'behavior' && (
          <BehaviorDisciplineModule student={student} isParentView={false} />
        )}

        {/* สมัครชุมนุม (Elective Activities) */}
        {activeTab === 'electives' && (
          <StudentElectiveEnrollment student={student} />
        )}

        {/* 5. แฟ้มผลงาน — บันทึกผลงานเอง (Firestore + อนุมัติโดยครูที่ปรึกษา) */}
        {activeTab === 'portfolio' && user?.uid && (
          <StudentPortfolioSection student={student} studentUid={user.uid} />
        )}

        {/* 6. Academic Reports & Homework */}
        {activeTab === 'academic' && (
          <AcademicHomeworkModule studentId={student.studentId} />
        )}

        {/* 7. Parent Engagement & e-Billing */}
        {activeTab === 'parent' && (
          <ParentEngagementServices studentId={student.studentId} student={student} isParentView={false} />
        )}

        {/* Self Assessment Form */}
        {activeTab === 'assessment' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <StudentSelfAssessmentForm
              student={student}
              existingAssessment={myAssessment}
              onSave={async (assessment) => {
                await saveSelfAssessment(assessment);
                setAssessmentVersion(v => v + 1);
              }}
              onClose={() => setActiveTab('overview')}
            />
          </div>
        )}

      </div>
      </PortalSidebarLayout>

      {/* เปลี่ยนรูปโปรไฟล์ (นักเรียนเจ้าของบัญชีเท่านั้น) */}
      {showPhotoEditor && user?.uid && (
        <StudentProfilePhotoEditor
          student={student}
          studentUid={user.uid}
          onClose={() => setShowPhotoEditor(false)}
        />
      )}

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
