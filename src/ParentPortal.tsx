import { cn } from "./lib/utils";
import React, { useState, useEffect } from 'react';
import { useStore } from './store';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { 
  Calendar, CheckCircle2, Clock, FileText, 
  ChevronLeft, ShieldCheck, HeartPulse, Send, History,
  BookOpen, AlertCircle, AlertTriangle, Check
} from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './lib/firebase';
import { updateParentConferenceSchedule } from './services/firestoreService';

export function ParentPortal() {
  const { 
    students, 
    analytics, 
    attendanceRecords, 
    leaveRequests, 
    submitLeaveRequest, 
    studentScores, 
    globalCourses, 
    courseScoreSettings,
    parentConferences,
    scheduleConference,
    adjustBehaviorScore
  } = useStore();
  
  // Student mapping to studentId '38502' (สมชาย ใจดี)
  const student = students.find(s => s.studentId === '38502');
  const studentAnalytics = analytics.find(a => a.studentId === '38502');
  const todayStatus = attendanceRecords['1']?.['38502'] || 'UNMARKED';

  // Live Firestore state for real-time behavior score
  const [liveFsScore, setLiveFsScore] = useState<number | null>(null);
  const bScore = liveFsScore ?? (studentAnalytics?.behaviorScore ?? 100);

  useEffect(() => {
    if (!student?.studentId) return;
    const unsub = onSnapshot(doc(db, 'students', student.studentId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (typeof data.behaviorScore === 'number') {
          setLiveFsScore(data.behaviorScore);
        }
      }
    }, (err) => console.warn("Notice: Firestore live sync fallback to local store:", err));
    return () => unsub();
  }, [student?.studentId]);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'leave' | 'gradebook'>('dashboard');
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveType, setLeaveType] = useState('ลาป่วย');
  const [leaveDate, setLeaveDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // States for conference scheduling
  const [selectedSlot, setSelectedSlot] = useState('');
  const [isScheduling, setIsScheduling] = useState(false);

  if (!student) return null;

  const handleLeaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveReason || !leaveDate) return;
    setIsSubmitting(true);
    
    setTimeout(() => {
      const typePrefix = leaveType === 'ลาป่วย' ? '[ลาป่วย] ' : '[ลากิจ] ';
      submitLeaveRequest(student.studentId, new Date(leaveDate), typePrefix + leaveReason);
      setIsSubmitting(false);
      setLeaveReason('');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }, 800);
  };

  const roomName = student.room || "ม.5/8";

  return (
    <div className="flex flex-col h-screen sm:h-[800px] w-full sm:max-w-[400px] sm:rounded-[2.5rem] bg-[#f5f6f8] text-slate-800 overflow-hidden font-sans relative shadow-2xl border-[8px] border-black">
      {/* Header LINE Style */}
      <header className="h-14 bg-white flex items-center justify-between px-4 shrink-0 shadow-sm z-10 relative">
        <div className="flex items-center gap-3">
          <ChevronLeft className="w-6 h-6 text-slate-700" />
          <h1 className="text-lg font-semibold text-slate-800">Smart School Care</h1>
        </div>
        <div className="text-xs font-medium text-emerald-600 bg-emerald-100 px-2 py-1 rounded-full flex items-center gap-1">
          <ShieldCheck className="w-3 h-3" />
          LINE Verified
        </div>
      </header>

      {/* Main Scrollable Content */}
      <main className="flex-1 overflow-y-auto pb-20">
        
        {/* Profile Card / Key Metrics Header */}
        <div className="bg-white p-5 rounded-b-2xl shadow-sm border-b border-slate-100">
          <div className="flex items-center gap-4">
            <img src={student.avatar} alt="Student" className="w-16 h-16 rounded-full bg-slate-100 border-2 border-emerald-500" />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500 font-medium">รหัสนักเรียน: {student.studentId}</span>
                {/* Color-coded Risk Status Badge */}
                {bScore >= 80 ? (
                  <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                    ปกติ
                  </span>
                ) : bScore >= 70 ? (
                  <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                    เฝ้าระวัง
                  </span>
                ) : (
                  <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
                    วิกฤต
                  </span>
                )}
              </div>
              <h2 className="text-lg font-bold text-slate-800 leading-tight mt-0.5">{student.name}</h2>
              <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                ห้องเรียน: {roomName}
              </div>
            </div>
          </div>
        </div>

        {activeTab === 'dashboard' && (
          <div className="p-4 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Sandbox Simulator Controls */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-xl p-3.5 shadow-md border border-slate-700">
              <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-2">
                🧪 Sandbox Controller (ระบบทดสอบเกณฑ์คะแนน)
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button 
                  onClick={() => adjustBehaviorScore(student.studentId, 100 - bScore)}
                  className={cn("text-[10px] font-bold py-1.5 px-1 rounded transition-all", bScore === 100 ? "bg-emerald-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600")}
                >
                  คืนค่า (100)
                </button>
                <button 
                  onClick={() => adjustBehaviorScore(student.studentId, 78 - bScore)}
                  className={cn("text-[10px] font-bold py-1.5 px-1 rounded transition-all", bScore === 78 ? "bg-amber-600 text-white animate-pulse" : "bg-slate-700 text-slate-300 hover:bg-slate-600")}
                >
                  เตือนส้ม (78)
                </button>
                <button 
                  onClick={() => adjustBehaviorScore(student.studentId, 65 - bScore)}
                  className={cn("text-[10px] font-bold py-1.5 px-1 rounded transition-all", bScore === 65 ? "bg-rose-600 text-white animate-bounce" : "bg-slate-700 text-slate-300 hover:bg-slate-600")}
                >
                  วิกฤตแดง (65)
                </button>
              </div>
            </div>

            {/* Threshold Alert Banner - Warning State (< 80 points) */}
            {bScore >= 70 && bScore < 80 && (
              <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-4 shadow-sm animate-in zoom-in duration-300 flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-amber-800">⚠️ แจ้งเตือน: คะแนนพฤติกรรมเริ่มลดลง</h4>
                  <p className="text-[11px] text-amber-700 leading-relaxed">
                    ขณะนี้คะแนนความประพฤติของบุตรหลานเหลือ <b>{bScore} คะแนน</b> ต่ำกว่าเกณฑ์เฝ้าระวังสีส้ม (80 คะแนน) กรุณาตักเตือนและติดตามอย่างใกล้ชิดค่ะ
                  </p>
                </div>
              </div>
            )}

            {/* Threshold Alert Banner - Critical State (< 70 points) */}
            {bScore < 70 && (
              <div className="bg-red-50 border-2 border-red-500 rounded-xl p-4 shadow-sm animate-in zoom-in duration-300 flex gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5 animate-bounce" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-red-800">🚨 ประกาศเตือนระดับวิกฤต (Critical) — จำเป็นต้องพบฝ่ายปกครอง</h4>
                  <p className="text-[11px] text-red-700 leading-relaxed font-medium">
                    คะแนนความประพฤติของน้อง {student.name} ต่ำกว่าเกณฑ์ขั้นวิกฤตของโรงเรียน (เหลือเพียง <b>{bScore} คะแนน</b>) จำเป็นต้องทำสัญญานัดพบคณะครูฝ่ายปกครองโดยทันที
                  </p>
                </div>
              </div>
            )}

            {/* Parent Conferences Interactive Slot Selector */}
            {bScore < 70 && (() => {
              const studentConf = parentConferences.find(c => c.studentId === student.studentId && c.status === 'PENDING');
              const activeScheduledConf = parentConferences.find(c => c.studentId === student.studentId && c.status === 'SCHEDULED');
              
              if (activeScheduledConf) {
                return (
                  <div className="bg-emerald-50 border-2 border-emerald-500 rounded-xl p-4 shadow-sm space-y-3 animate-in fade-in duration-300">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-full flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> ลงทะเบียนนัดหมายเรียบร้อยแล้ว
                      </span>
                      <span className="text-[9px] text-emerald-600 font-bold uppercase">Scheduled</span>
                    </div>
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-bold text-slate-800">🗓️ รายละเอียดตารางนัดหมายพบฝ่ายปกครอง</h4>
                      <div className="text-xs text-slate-600 space-y-1 bg-white p-3 rounded-lg border border-emerald-100 shadow-sm font-sans">
                        <div><b>นักเรียนผู้เข้าพบ:</b> {activeScheduledConf.studentName}</div>
                        <div><b>วันนัดหมาย:</b> <span className="text-emerald-700 font-bold">{activeScheduledConf.scheduledDate}</span></div>
                        <div><b>ช่วงเวลา:</b> <span className="text-emerald-700 font-bold">{activeScheduledConf.scheduledTime}</span></div>
                        <div><b>สถานที่:</b> ตึกพัฒนาพฤติกรรมนักเรียน อาคาร 2 ชั้น 1</div>
                      </div>
                      <p className="text-[10px] text-emerald-700 italic mt-2">
                        * ทางโรงเรียนส่งสำเนายืนยันไปยังระบบฝ่ายปกครอง (Admin Dashboard) และครูประจำชั้นเรียบร้อยแล้วค่ะ
                      </p>
                    </div>
                  </div>
                );
              }

              const slots = studentConf?.availableSlots || [
                "วันจันทร์ 09:00 - 10:00 น.",
                "วันอังคาร 10:30 - 11:30 น.",
                "วันพุธ 13:00 - 14:00 น.",
                "วันพฤหัสบดี 14:30 - 15:30 น.",
                "วันศุกร์ 13:30 - 14:30 น."
              ];

              const confId = studentConf?.id || `conf_${student.studentId}_today`;

              return (
                <div className="bg-white border-2 border-rose-200 rounded-xl p-4 shadow-sm space-y-4 animate-in fade-in duration-300">
                  <div>
                    <h4 className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-rose-500" /> นัดพบคณะกรรมการฝ่ายปกครอง
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      โปรดเลือกวันและช่วงเวลาที่ท่านสะดวกด้านล่าง เพื่อเข้าปรึกษาแนวทางดูแลความประพฤติร่วมกันค่ะ
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700">เลือกเวลานัดหมาย:</label>
                    <div className="grid grid-cols-1 gap-1.5">
                      {slots.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setSelectedSlot(slot)}
                          className={cn(
                            "text-xs text-left p-2.5 rounded-lg border font-medium transition-all flex items-center justify-between cursor-pointer",
                            selectedSlot === slot 
                              ? "bg-rose-50 border-rose-500 text-rose-700 shadow-sm font-bold" 
                              : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                          )}
                        >
                          <span>{slot}</span>
                          {selectedSlot === slot && <Check className="w-4 h-4 text-rose-600 shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!selectedSlot || isScheduling}
                    onClick={async () => {
                      setIsScheduling(true);
                      try {
                        // Write to Firestore and store
                        await updateParentConferenceSchedule(confId, 'วันจันทร์ที่ 27 ก.ค. 2569', selectedSlot);
                        scheduleConference(confId, 'วันจันทร์ที่ 27 ก.ค. 2569', selectedSlot);
                      } catch (err) {
                        console.error("Error scheduling conference:", err);
                        scheduleConference(confId, 'วันจันทร์ที่ 27 ก.ค. 2569', selectedSlot);
                      } finally {
                        setIsScheduling(false);
                        setSelectedSlot('');
                      }
                    }}
                    className="w-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold py-3 rounded-lg shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {isScheduling ? 'กำลังลงทะเบียนนัดหมาย...' : 'ยืนยันเวลานัดพบฝ่ายปกครอง'}
                  </button>
                </div>
              );
            })()}

            {/* Key Metrics Row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex flex-col gap-1">
                <div className="text-xs text-slate-500 font-medium flex items-center gap-1">
                  <HeartPulse className="w-4 h-4 text-rose-500" /> คะแนนพฤติกรรมคงเหลือ
                </div>
                <div className="text-2xl font-bold text-slate-800 mt-1">
                  {bScore} <span className="text-xs text-slate-400 font-normal">/ 100</span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-2">
                  <div 
                    className={cn("h-full transition-all duration-500", bScore >= 80 ? "bg-emerald-500" : bScore >= 70 ? "bg-amber-500" : "bg-rose-500")}
                    style={{ width: `${Math.min(100, Math.max(0, bScore))}%` }}
                  ></div>
                </div>
              </div>
              
              <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex flex-col gap-1">
                <div className="text-xs text-slate-500 font-medium flex items-center gap-1">
                  <Clock className="w-4 h-4 text-blue-500" /> สถิติเข้าเรียน
                </div>
                <div className="text-2xl font-bold text-slate-800 mt-1">
                  {studentAnalytics?.subjectAttendanceRate}%
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-2">
                  <div 
                    className={cn("h-full transition-all duration-500", (studentAnalytics?.subjectAttendanceRate ?? 0) >= 80 ? "bg-blue-500" : (studentAnalytics?.subjectAttendanceRate ?? 0) >= 60 ? "bg-amber-500" : "bg-rose-500")}
                    style={{ width: `${studentAnalytics?.subjectAttendanceRate}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Daily Timeline */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center justify-between">
                <span>ไทม์ไลน์วันนี้</span>
                <span className="text-xs font-normal text-slate-500">{format(new Date(), 'd MMMM yyyy', { locale: th })}</span>
              </h3>
              
              <div className="relative pl-4 border-l-2 border-slate-100 space-y-6 ml-2">
                
                {/* Check-in */}
                <div className="relative">
                  <div className="absolute -left-[23px] top-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-[3px] border-white shadow-sm"></div>
                  <div className="text-xs text-slate-400 font-medium mb-1">07:45 น.</div>
                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                    <div className="font-semibold text-slate-800 text-sm">สแกนเข้าโรงเรียน</div>
                    <div className="text-xs text-emerald-600 font-medium flex items-center gap-1 mt-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> มาตรงเวลา
                    </div>
                  </div>
                </div>

                {/* Homeroom */}
                <div className="relative">
                  <div className="absolute -left-[23px] top-1 w-3.5 h-3.5 rounded-full bg-blue-500 border-[3px] border-white shadow-sm"></div>
                  <div className="text-xs text-slate-400 font-medium mb-1">08:00 น.</div>
                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                    <div className="font-semibold text-slate-800 text-sm">กิจกรรมโฮมรูม ({roomName})</div>
                    <div className="text-xs text-slate-500 mt-1">ครูที่ปรึกษา: ครู เกียรติศักดิ์</div>
                  </div>
                </div>

                {/* Current Class */}
                <div className="relative">
                  <div className={cn("absolute -left-[23px] top-1 w-3.5 h-3.5 rounded-full border-[3px] border-white shadow-sm transition-colors",
                    todayStatus === 'PRESENT' ? 'bg-emerald-500' :
                    todayStatus === 'LATE' ? 'bg-amber-500' :
                    todayStatus === 'ABSENT' ? 'bg-rose-500' :
                    todayStatus === 'LEAVE' ? 'bg-blue-500' : 'bg-slate-300'
                  )}></div>
                  <div className="text-xs text-slate-400 font-medium mb-1">ปัจจุบัน (คาบ 8)</div>
                  <div className={cn("rounded-lg p-3 border shadow-sm transition-colors",
                    todayStatus === 'PRESENT' ? 'bg-emerald-50/50 border-emerald-100' :
                    todayStatus === 'LATE' ? 'bg-amber-50/50 border-amber-100' :
                    todayStatus === 'ABSENT' ? 'bg-rose-50/50 border-rose-100' :
                    todayStatus === 'LEAVE' ? 'bg-blue-50/50 border-blue-100' :
                    'bg-white border-slate-200'
                  )}>
                    <div className="font-semibold text-slate-800 text-sm flex items-center justify-between">
                      วิชาคณิตศาสตร์ {roomName}
                      {todayStatus === 'PRESENT' && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold">เข้าเรียน</span>}
                      {todayStatus === 'LATE' && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-bold">สาย</span>}
                      {todayStatus === 'ABSENT' && <span className="text-[10px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded font-bold">ขาดเรียน</span>}
                      {todayStatus === 'LEAVE' && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold">ลา</span>}
                      {todayStatus === 'UNMARKED' && <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold">ยังไม่เช็ค</span>}
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'leave' && (
          <div className="p-4 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
              <h3 className="text-base font-bold text-slate-800 mb-1">ส่งใบลาดิจิทัล</h3>
              <p className="text-xs text-slate-500 mb-4">ข้อมูลจะถูกส่งไปยังครูประจำวิชาและครูที่ปรึกษาโดยตรง</p>
              
              <form onSubmit={handleLeaveSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">ประเภทการลา</label>
                    <select
                      value={leaveType}
                      onChange={(e) => setLeaveType(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    >
                      <option value="ลาป่วย">ลาป่วย</option>
                      <option value="ลากิจ">ลากิจ</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">วันที่ต้องการลา</label>
                    <input
                      type="date"
                      value={leaveDate}
                      onChange={(e) => setLeaveDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">เหตุผลการลา</label>
                  <textarea 
                    rows={4}
                    value={leaveReason}
                    onChange={(e) => setLeaveReason(e.target.value)}
                    placeholder="ระบุเหตุผลการลา (เช่น ป่วยเป็นไข้, ลากิจไปต่างจังหวัด)"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none transition-shadow"
                    required
                  ></textarea>
                </div>

                <button 
                  type="submit"
                  disabled={isSubmitting || !leaveReason}
                  className="w-full bg-emerald-600 text-white font-bold text-sm py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2 active:scale-[0.98] cursor-pointer"
                >
                  {isSubmitting ? 'กำลังส่งข้อมูล...' : (
                    <>
                      <Send className="w-4 h-4" /> ยืนยันการส่งใบลา
                    </>
                  )}
                </button>

                {showSuccess && (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold p-3 rounded-lg flex items-center justify-center gap-2 animate-in fade-in zoom-in duration-200">
                    <CheckCircle2 className="w-4 h-4" /> ส่งใบลาเรียบร้อยแล้ว
                  </div>
                )}
              </form>
            </div>

            {/* Leave History */}
            {leaveRequests.filter(r => r.studentId === student.studentId).length > 0 && (
              <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <History className="w-4 h-4 text-slate-400" /> ประวัติการลาล่าสุด
                </h3>
                <div className="space-y-3">
                  {leaveRequests.filter(r => r.studentId === student.studentId).reverse().map((req) => (
                    <div key={req.id} className="border-b border-slate-100 last:border-0 pb-3 last:pb-0 animate-in fade-in">
                      <div className="flex justify-between items-start mb-1">
                        <div className="text-xs font-semibold text-slate-800">{format(req.date, 'd MMM yyyy', { locale: th })}</div>
                        <div className={cn("text-[10px] font-bold px-2 py-0.5 rounded", 
                          req.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                          req.status === 'REJECTED' ? 'bg-rose-100 text-rose-700' :
                          'bg-amber-100 text-amber-700'
                        )}>
                          {req.status === 'APPROVED' ? 'อนุมัติแล้ว' : req.status === 'REJECTED' ? 'ปฏิเสธ' : 'รออนุมัติ'}
                        </div>
                      </div>
                      <div className="text-xs text-slate-500 line-clamp-1">{req.reason}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'gradebook' && (
          <div className="p-4 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
              <BookOpen className="w-5 h-5 text-indigo-500" />
              รายงานผลการเรียน
            </h2>

            <div className="space-y-4">
              {globalCourses.filter(course => course.level === student?.room || course.roomName === student?.room || true).slice(0, 3).map(course => {
                const score = studentScores.find(s => s.courseId === course.courseId && s.studentId === student?.studentId);
                const rawSetting = courseScoreSettings.find(s => s.courseId === course.courseId);
                const setting = {
                  preMidterm: rawSetting ? rawSetting.maxPreMidterm : 25,
                  midterm: rawSetting ? rawSetting.maxMidterm : 20,
                  postMidterm: rawSetting ? rawSetting.maxPostMidterm : 25,
                  final: rawSetting ? rawSetting.maxFinal : 30
                };
                const total = score?.total || 0;
                const grade = score?.grade || '-';

                return (
                  <div key={course.courseId} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="bg-slate-50 p-4 border-b border-slate-100 flex justify-between items-center">
                      <div>
                        <h3 className="font-bold text-slate-800">{course.code}</h3>
                        <p className="text-xs text-slate-500">{course.courseName}</p>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <span className="text-[10px] text-slate-500 font-bold uppercase mb-0.5">เกรด (Grade)</span>
                        <div className="bg-indigo-50 text-indigo-700 font-black text-lg px-3 rounded-lg border border-indigo-100">
                          {grade}
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4">
                      <div className="flex justify-between text-xs text-slate-600 mb-1 font-medium">
                        <span>ความคืบหน้าคะแนนรวม</span>
                        <span className="font-mono text-indigo-600 font-bold">{total} / 100</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 mb-4">
                        <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${total}%` }}></div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        {[
                          { label: 'ก่อนกลางภาค', max: setting.preMidterm, val: score?.preMidterm || 0 },
                          { label: 'กลางภาค', max: setting.midterm, val: score?.midterm || 0 },
                          { label: 'หลังกลางภาค', max: setting.postMidterm, val: score?.postMidterm || 0 },
                          { label: 'ปลายภาค', max: setting.final, val: score?.final || 0 },
                        ].map((comp, i) => {
                          const percent = (comp.val / comp.max) * 100;
                          const isWarning = percent < 50;
                          return (
                            <div key={i} className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 relative">
                              <span className="text-slate-500 block mb-0.5">{comp.label}</span>
                              <div className="flex justify-between items-center">
                                <span className="font-mono font-bold text-slate-800">{comp.val}<span className="text-slate-400 text-[10px] font-normal">/{comp.max}</span></span>
                              </div>
                              {isWarning && comp.val > 0 && (
                                <div className="text-[9px] text-rose-500 mt-1 flex items-center gap-1 font-medium bg-rose-50 p-1 rounded">
                                  <AlertCircle className="w-3 h-3" /> ควรเร่งทำคะแนน
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="absolute bottom-0 w-full h-16 bg-white border-t border-slate-200 flex items-center justify-around shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-10 sm:rounded-b-[2rem]">
        <button 
          onClick={() => setActiveTab('dashboard')}
          className={cn("flex flex-col items-center gap-1 p-2 w-20 transition-colors cursor-pointer", activeTab === 'dashboard' ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600')}
        >
          <Calendar className={cn("w-5 h-5", activeTab === 'dashboard' && 'fill-emerald-50')} />
          <span className="text-[10px] font-bold">ไทม์ไลน์</span>
        </button>
        <button 
          onClick={() => setActiveTab('gradebook')}
          className={cn("flex flex-col items-center gap-1 p-2 w-20 transition-colors cursor-pointer", activeTab === 'gradebook' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600')}
        >
          <BookOpen className={cn("w-5 h-5", activeTab === 'gradebook' && 'fill-indigo-50')} />
          <span className="text-[10px] font-bold">ผลการเรียน</span>
        </button>
        <button 
          onClick={() => setActiveTab('leave')}
          className={cn("flex flex-col items-center gap-1 p-2 w-20 transition-colors cursor-pointer", activeTab === 'leave' ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600')}
        >
          <FileText className={cn("w-5 h-5", activeTab === 'leave' && 'fill-emerald-50')} />
          <span className="text-[10px] font-bold">ลางาน</span>
        </button>
      </nav>
    </div>
  );
}
