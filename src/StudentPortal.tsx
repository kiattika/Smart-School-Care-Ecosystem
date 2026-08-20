import { cn } from "./lib/utils";
import React, { useState } from 'react';
import { useStore } from './store';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { 
  QrCode, 
  Flame, 
  Trophy, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  CalendarDays,
  User,
  ChevronRight,
  Sparkles,
  Heart,
  Shield,
  X,
  MapPin,
  Camera,
  Target,
  Map as MapIcon,
  Image as ImageIcon,
  BookOpen,
  Activity,
  Brain,
  Edit3
} from 'lucide-react';
import { LineChart, Line, XAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { twMerge } from 'tailwind-merge';
import clsx from 'clsx';
import { StudentSelfAssessmentForm } from './components/StudentSelfAssessmentForm';
import { StudentAssessmentDetailModal } from './components/StudentAssessmentDetailModal';

function deg2rad(deg: number) {
  return deg * (Math.PI/180);
}

function getDistanceFromLatLonInM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // Radius of the earth in m
  const dLat = deg2rad(lat2-lat1);
  const dLon = deg2rad(lon2-lon1); 
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c; // Distance in m
  return Math.round(d);
}


export function StudentPortal() {
  const { 
    students, 
    analytics, 
    attendanceRecords, 
    currentPeriod, 
    schoolCheckInRecords, 
    markSchoolCheckIn, 
    studentScores, 
    globalCourses, 
    courseScoreSettings,
    selfAssessments,
    saveSelfAssessment
  } = useStore();
  
  const [activeTab, setActiveTab] = useState<'dashboard' | 'homevisit' | 'health' | 'gradebook' | 'assessment'>('dashboard');
  const [isEditingAssessment, setIsEditingAssessment] = useState(false);
  const [viewDetailModal, setViewDetailModal] = useState(false);
  const [eqModalOpen, setEqModalOpen] = useState(false);
  const [selectedClassmate, setSelectedClassmate] = useState<any>(null);
  const [completedEqs, setCompletedEqs] = useState<string[]>([]);
  const [eqAnswers, setEqAnswers] = useState<Record<string, number>>({});
  
  // Geofence check-in state
  const [isSimulatingInSchool, setIsSimulatingInSchool] = useState(false); // Toggle to test within/outside radius
  const SCHOOL_COORD = { lat: 17.6251, lng: 100.0932 };
  const mockCurrentLocation = isSimulatingInSchool 
    ? { lat: 17.6255, lng: 100.0935 } // ~50m away
    : { lat: 17.6150, lng: 100.0800 }; // outside radius
  
  const distanceFromSchool = getDistanceFromLatLonInM(
    mockCurrentLocation.lat, mockCurrentLocation.lng,
    SCHOOL_COORD.lat, SCHOOL_COORD.lng
  );
  const isWithinRadius = distanceFromSchool <= 100;
  const hasCheckedInSchool = schoolCheckInRecords['38502']?.status === 'PRESENT';

  const bmiTrends = [
    { term: '1/65', bmi: 18.2 },
    { term: '2/65', bmi: 18.5 },
    { term: '1/66', bmi: 18.8 },
    { term: '2/66', bmi: 19.0 },
    { term: '1/67', bmi: 19.1 },
  ];

  // Get data for a specific student (54001/38502 - สมชาย)
  const student = students.find(s => s.studentId === '38502') || students[0];
  const studentAnalytics = analytics.find(a => a.studentId === '38502');
  const bScore = studentAnalytics?.behaviorScore ?? 100;
  const currentMathStatus = attendanceRecords['1']?.['38502'] || 'UNMARKED';
  const myAssessment = selfAssessments['38502'] || (student ? selfAssessments[student.studentId] : undefined);

  if (!student) return null;

  const classmatesToEvaluate = students.filter(s => s.studentId !== '38502').slice(0, 3);

  // Calculate mock level and EXP based on behavior score
  // E.g., Score 100 = Level 5 (Max), Score 80 = Level 4
  const level = Math.floor(bScore / 20) + 1;
  const expInLevel = bScore % 20;
  const expPercentage = (expInLevel / 20) * 100;

  const levelName = 
    level >= 5 ? 'Diamond Scholar' :
    level >= 4 ? 'Platinum Scholar' :
    level >= 3 ? 'Gold Scholar' :
    level >= 2 ? 'Silver Scholar' : 'Bronze Scholar';

  const schedule = [
    { time: '08:30 - 09:20', period: 'คาบ 1', subject: 'คณิตศาสตร์', room: 'อาคาร 4 ชั้น 2', status: currentMathStatus },
    { time: '09:20 - 10:10', period: 'คาบ 2', subject: 'วิทยาศาสตร์', room: 'ห้องแล็บ 2', status: 'PRESENT' },
    { time: '10:10 - 11:00', period: 'คาบ 3', subject: 'ภาษาไทย', room: 'อาคาร 3 ชั้น 1', status: 'UNMARKED' },
    { time: '11:00 - 11:50', period: 'คาบ 4', subject: 'สังคมศึกษา', room: 'อาคาร 3 ชั้น 2', status: 'UNMARKED' },
  ];

  return (
    <div className="flex flex-col h-screen sm:h-[844px] w-full sm:max-w-[390px] sm:rounded-[2.5rem] bg-[#090b14] text-slate-200 overflow-hidden font-sans relative shadow-[0_0_50px_rgba(56,189,248,0.1)] border-[8px] border-slate-900 mx-auto">
      
      {/* Dynamic Island / Status Bar Area (Mock) */}
      <div className="h-8 w-full flex justify-center absolute top-0 z-50">
        <div className="w-32 h-6 bg-black rounded-b-3xl"></div>
      </div>

      <main className="flex-1 overflow-y-auto pb-24 pt-10 px-5 hide-scrollbar">
        
        {activeTab === 'dashboard' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Digital ID Card */}
            <section className="relative mt-2 mb-6 group">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl blur opacity-40 group-hover:opacity-60 transition-opacity"></div>
              <div className="relative bg-gradient-to-br from-[#13182b] to-[#0d101d] rounded-2xl p-5 border border-white/10 shadow-xl overflow-hidden">
                {/* Background glowing orb */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl -mr-10 -mt-10"></div>
                
                <div className="flex justify-between items-start relative z-10">
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-blue-400 tracking-wider uppercase mb-1 flex items-center gap-1">
                      <User className="w-3 h-3" /> Student ID
                    </span>
                    <span className="text-2xl font-black text-white font-mono tracking-tight">{student.studentId}</span>
                  </div>
                  <div className="w-10 h-10 bg-white p-1 rounded-lg shadow-sm">
                    <QrCode className="w-full h-full text-slate-900" />
                  </div>
                </div>

                <div className="mt-5 flex items-center gap-4 relative z-10">
                  <div className="relative">
                    <img 
                      src={student.avatar} 
                      alt={student.name} 
                      className="w-16 h-16 rounded-full border-2 border-purple-500 bg-slate-800"
                    />
                    <div className="absolute -bottom-1 -right-1 bg-green-500 w-4 h-4 rounded-full border-2 border-[#13182b]"></div>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white leading-tight">{student.name}</h2>
                    <div className="text-sm text-slate-400 mt-0.5">ชั้นมัธยมศึกษาปีที่ 1/1</div>
                  </div>
                </div>
              </div>
            </section>
            
            {/* Geofencing School Check-in Widget */}
            <section className="mb-6">
              <div className="bg-[#121624] border border-white/5 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                <div className="flex justify-between items-start mb-4 relative z-10">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <h3 className="font-bold text-white">เช็คชื่อเข้าโรงเรียน</h3>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="rounded border-slate-700 bg-slate-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-900"
                      checked={isSimulatingInSchool}
                      onChange={(e) => setIsSimulatingInSchool(e.target.checked)}
                    />
                    จำลองตำแหน่งในโรงเรียน
                  </label>
                </div>
                
                {hasCheckedInSchool ? (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 flex items-center gap-3 relative z-10">
                    <CheckCircle2 className="w-8 h-8 text-green-400 shrink-0" />
                    <div>
                      <div className="font-bold text-green-400">ยืนยันการเข้าโรงเรียนแล้ว</div>
                      <div className="text-xs text-green-400/70">เวลา {schoolCheckInRecords['38502']?.time ? format(schoolCheckInRecords['38502'].time, 'HH:mm') : '07:45'} น.</div>
                    </div>
                  </div>
                ) : (
                  <div className="relative z-10">
                    <div className="flex items-center justify-between text-xs mb-3">
                      <span className="text-slate-400">ระยะห่างจากโรงเรียน:</span>
                      <span className={cn("font-mono font-medium", isWithinRadius ? "text-green-400" : "text-amber-400")}>
                        {distanceFromSchool} เมตร
                      </span>
                    </div>
                    
                    <button 
                      disabled={!isWithinRadius}
                      onClick={() => markSchoolCheckIn('38502', 'PRESENT')}
                      className={cn(
                        "w-full py-3.5 rounded-xl font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2 relative overflow-hidden",
                        isWithinRadius 
                          ? "bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:bg-blue-500 hover:shadow-[0_0_25px_rgba(37,99,235,0.6)] animate-pulse" 
                          : "bg-slate-800/50 text-slate-500 cursor-not-allowed border border-white/5"
                      )}
                    >
                      {isWithinRadius && (
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div>
                      )}
                      {isWithinRadius ? 'ยืนยันเข้าโรงเรียน' : `คุณอยู่นอกรัศมีโรงเรียน (Distance: ${distanceFromSchool} meters)`}
                    </button>
                    {!isWithinRadius && (
                      <p className="text-[10px] text-center text-slate-500 mt-3">
                        คุณต้องอยู่ห่างจากจุดศูนย์กลางไม่เกิน 100 เมตร
                      </p>
                    )}
                  </div>
                )}
                
                {/* Visual map background lines */}
                <div className="absolute -bottom-10 -right-10 w-32 h-32 opacity-10 pointer-events-none">
                  <div className="absolute inset-0 border border-blue-500 rounded-full scale-50"></div>
                  <div className="absolute inset-0 border border-blue-500 rounded-full scale-75"></div>
                  <div className="absolute inset-0 border border-blue-500 rounded-full scale-100"></div>
                </div>
              </div>
            </section>

            {/* Gamified Stats */}
            <section className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-[#121624] rounded-xl p-4 border border-white/5 flex flex-col items-center justify-center text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-orange-500/10 to-transparent"></div>
                <Flame className="w-8 h-8 text-orange-500 mb-2 relative z-10 drop-shadow-[0_0_8px_rgba(249,115,22,0.5)]" />
                <div className="text-2xl font-black text-white relative z-10">14 <span className="text-sm font-medium text-slate-400">วัน</span></div>
                <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider relative z-10 mt-1">มาเรียนต่อเนื่อง</div>
              </div>

              <div className="bg-[#121624] rounded-xl p-4 border border-white/5 flex flex-col justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-blue-500/10 to-transparent"></div>
                <div className="flex items-center gap-1.5 mb-2 relative z-10">
                  <Trophy className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-bold text-blue-400">Level {level}</span>
                </div>
                <div className="font-bold text-white text-sm line-clamp-1 relative z-10 mb-2">{levelName}</div>
                
                <div className="w-full bg-slate-800 rounded-full h-1.5 relative z-10 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-purple-500 h-full rounded-full transition-all duration-1000 ease-out relative"
                    style={{ width: `${expPercentage}%` }}
                  >
                    <div className="absolute top-0 right-0 bottom-0 left-0 bg-[url('https://www.transparenttextures.com/patterns/diagonal-stripes.png')] opacity-20"></div>
                  </div>
                </div>
                <div className="text-[9px] text-slate-400 text-right mt-1.5 relative z-10">
                  {expInLevel} / 20 EXP
                </div>
              </div>
            </section>

            {/* Weekly EQ Quest */}
            <section className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Heart className="w-4 h-4 text-pink-500" /> ภารกิจประเมินเพื่อน
                </h3>
                <span className="text-[10px] font-bold bg-white/10 text-slate-300 px-2 py-0.5 rounded flex items-center gap-1">
                  <Shield className="w-3 h-3 text-emerald-400" /> ไม่เปิดเผยตัวตน
                </span>
              </div>

              <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
                {classmatesToEvaluate.map(classmate => {
                  const isCompleted = completedEqs.includes(classmate.studentId);
                  return (
                    <button
                      key={classmate.id}
                      disabled={isCompleted}
                      onClick={() => {
                        setSelectedClassmate(classmate);
                        setEqAnswers({});
                        setEqModalOpen(true);
                      }}
                      className={cn(
                        "flex-shrink-0 w-24 bg-[#121624] border rounded-xl p-3 flex flex-col items-center gap-2 transition-all relative overflow-hidden",
                        isCompleted ? "border-white/5 opacity-50" : "border-pink-500/30 hover:border-pink-500/50"
                      )}
                    >
                      {isCompleted && (
                        <div className="absolute inset-0 bg-black/50 z-10 flex items-center justify-center">
                          <CheckCircle2 className="w-6 h-6 text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                        </div>
                      )}
                      <img src={classmate.avatar} alt={classmate.name} className="w-12 h-12 rounded-full border border-slate-700 bg-slate-800" />
                      <span className="text-xs font-medium text-slate-200 line-clamp-1">{classmate.name.split(' ')[1]}</span>
                      {!isCompleted && (
                        <span className="text-[9px] font-bold text-pink-400 bg-pink-500/10 px-1.5 py-0.5 rounded">
                          +50 EXP
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </section>

            {/* Student Self-Assessment Card on Dashboard */}
            <section className="mb-6">
              <div className="bg-gradient-to-r from-indigo-900/60 via-purple-900/60 to-blue-900/60 border border-indigo-500/30 rounded-2xl p-5 shadow-xl relative overflow-hidden">
                <div className="flex items-start justify-between relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center border border-indigo-400/30">
                      <Brain className="w-5 h-5 text-sky-300" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-sky-300 bg-sky-500/20 px-2 py-0.5 rounded">
                          ภารกิจสำคัญ 30 ข้อ
                        </span>
                        {myAssessment?.isCompleted ? (
                          <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> ประเมินแล้ว
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded flex items-center gap-1">
                            <Clock className="w-3 h-3" /> รอการประเมิน
                          </span>
                        )}
                      </div>
                      <h4 className="text-base font-bold text-white mt-1">แบบวิเคราะห์ตนเองและรู้จักผู้เรียน</h4>
                      <p className="text-xs text-slate-300 mt-0.5">
                        {myAssessment?.isCompleted
                          ? `สไตล์หลัก: ${myAssessment.learningStyle?.preferredStyles?.join(', ') || 'ลงมือปฏิบัติ'} | บทบาท: ${myAssessment.identity?.groupRole || 'ค้นหาข้อมูล'}`
                          : 'ช่วยให้คุณครูและผู้ปกครองเข้าใจสไตล์การเรียนรู้และเป้าหมายของคุณ'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between relative z-10">
                  <button
                    onClick={() => {
                      setViewDetailModal(true);
                    }}
                    className="text-xs text-sky-300 hover:text-sky-200 font-semibold flex items-center gap-1 transition-colors"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>ดูสรุป DNA ผู้เรียน</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsEditingAssessment(true);
                      setActiveTab('assessment');
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{myAssessment?.isCompleted ? 'แก้ไข/อัปเดตแบบประเมิน' : 'เริ่มทำแบบประเมิน (30 ข้อ)'}</span>
                  </button>
                </div>
              </div>
            </section>

            {/* Schedule & Attendance */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-purple-400" /> ตารางเรียนวันนี้
                </h3>
                <span className="text-xs text-slate-500 font-medium">{format(new Date(), 'd MMM', { locale: th })}</span>
              </div>

              <div className="space-y-3 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-white/10 before:to-transparent">
                
                {schedule.map((item, index) => {
                  const isCurrent = currentPeriod === item.period;
                  let StatusIcon = CheckCircle2;
                  let statusColor = "text-slate-500";
                  let statusBg = "bg-slate-800 border-slate-700";
                  let statusText = "รอเรียน";

                  if (item.status === 'PRESENT') {
                    statusColor = "text-emerald-400";
                    statusBg = "bg-emerald-500/10 border-emerald-500/20";
                    statusText = "เข้าเรียน";
                  } else if (item.status === 'LATE') {
                    StatusIcon = AlertCircle;
                    statusColor = "text-orange-400";
                    statusBg = "bg-orange-500/10 border-orange-500/20";
                    statusText = "มาสาย";
                  } else if (item.status === 'ABSENT') {
                    StatusIcon = XCircle;
                    statusColor = "text-rose-400";
                    statusBg = "bg-rose-500/10 border-rose-500/20";
                    statusText = "ขาดเรียน";
                  } else if (item.status === 'LEAVE') {
                    statusColor = "text-blue-400";
                    statusBg = "bg-blue-500/10 border-blue-500/20";
                    statusText = "ลา";
                  }

                  return (
                    <div key={index} className="relative flex items-start gap-4">
                      {/* Timeline Dot */}
                      <div className="flex items-center justify-center w-10 mt-1.5 shrink-0 z-10">
                        <div className={cn(
                          "w-3 h-3 rounded-full border-2",
                          isCurrent ? "bg-purple-500 border-black shadow-[0_0_10px_rgba(168,85,247,0.8)] animate-pulse" : "bg-slate-800 border-slate-600"
                        )}></div>
                      </div>

                      {/* Class Card */}
                      <div className={cn(
                        "flex-1 bg-[#121624] border rounded-xl p-3.5 transition-all",
                        isCurrent ? "border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.15)]" : "border-white/5"
                      )}>
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold bg-white/10 text-slate-300 px-2 py-0.5 rounded">{item.period}</span>
                            {isCurrent && (
                              <span className="text-[9px] font-bold bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded uppercase tracking-wider flex items-center gap-1">
                                <Sparkles className="w-2.5 h-2.5" /> Now
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">{item.time}</div>
                        </div>
                        
                        <h4 className="font-bold text-slate-100 text-sm mb-1">{item.subject}</h4>
                        <p className="text-xs text-slate-500 flex items-center gap-1 mb-3">
                          {item.room}
                        </p>

                        <div className="flex items-center justify-between border-t border-white/5 pt-2 mt-2">
                          <div className={cn("text-[10px] font-medium flex items-center gap-1 px-2 py-1 rounded-md border", statusColor, statusBg)}>
                            <StatusIcon className="w-3 h-3" />
                            {statusText}
                          </div>
                          {item.status !== 'UNMARKED' && (
                            <button className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center transition-colors">
                              รายละเอียด <ChevronRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'homevisit' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div>
              <h2 className="text-xl font-black text-white">Digital Home Visit</h2>
              <p className="text-xs text-slate-400 mt-1">กรุณากรอกข้อมูลเพื่อเตรียมความพร้อมก่อนครูลงพื้นที่เยี่ยมบ้าน</p>
            </div>
            
            <div className="bg-[#121624] p-5 rounded-xl border border-white/5 space-y-4">
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block font-medium">ชื่อเล่น</label>
                <input type="text" className="w-full bg-[#0a0d14] border border-white/10 rounded-lg p-3 text-sm text-white focus:border-blue-500 outline-none transition-colors" placeholder="เช่น บอย" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block font-medium">งานอดิเรก</label>
                <input type="text" className="w-full bg-[#0a0d14] border border-white/10 rounded-lg p-3 text-sm text-white focus:border-blue-500 outline-none transition-colors" placeholder="เช่น เล่นฟุตบอล, ฟังเพลง" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block font-medium">เป้าหมายในชีวิต (Life Goals)</label>
                <input type="text" className="w-full bg-[#0a0d14] border border-white/10 rounded-lg p-3 text-sm text-white focus:border-blue-500 outline-none transition-colors" placeholder="เช่น อยากเป็นวิศวกรซอฟต์แวร์" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block font-medium">สถานภาพครอบครัว</label>
                <select className="w-full bg-[#0a0d14] border border-white/10 rounded-lg p-3 text-sm text-white focus:border-blue-500 outline-none transition-colors appearance-none">
                  <option>อยู่ด้วยกัน</option>
                  <option>แยกกันอยู่</option>
                  <option>หย่าร้าง</option>
                  <option>บิดาหรือมารดาเสียชีวิต</option>
                </select>
              </div>
            </div>

            <div className="bg-[#121624] p-5 rounded-xl border border-white/5 space-y-4 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none transition-opacity group-hover:opacity-10">
                <MapIcon className="w-32 h-32 text-emerald-500" />
              </div>
              <h3 className="font-bold text-emerald-400 flex items-center gap-2 relative z-10">
                <MapPin className="w-4 h-4" /> พิกัดและจุดสังเกต
              </h3>
              
              <button className="relative z-10 w-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl py-3 text-sm font-bold flex items-center justify-center gap-2 hover:bg-emerald-500/20 transition-all shadow-[0_0_15px_rgba(16,185,129,0.1)] hover:shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                <MapPin className="w-4 h-4" /> ยืนยันพิกัดบ้าน (GPS)
              </button>

              <div className="relative z-10">
                <label className="text-xs text-slate-400 mb-1.5 block font-medium">จุดสังเกตใกล้เคียง</label>
                <textarea className="w-full bg-[#0a0d14] border border-white/10 rounded-lg p-3 text-sm text-white focus:border-emerald-500 outline-none resize-none h-24 transition-colors" placeholder="เช่น ใกล้ร้านค้าเจ๊หมวย ฝั่งตรงข้ามวัด..."></textarea>
              </div>
            </div>

            <div className="bg-[#121624] p-5 rounded-xl border border-white/5 space-y-4">
              <h3 className="font-bold text-blue-400 flex items-center gap-2">
                <Camera className="w-4 h-4" /> อัปโหลดรูปภาพ
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="border-2 border-dashed border-white/10 rounded-xl p-4 flex flex-col items-center justify-center gap-2 bg-[#0a0d14] h-32 cursor-pointer hover:border-blue-400/50 hover:bg-blue-900/20 transition-all group">
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-blue-500/20 group-hover:scale-110 transition-all">
                    <ImageIcon className="w-5 h-5 text-slate-400 group-hover:text-blue-400" />
                  </div>
                  <span className="text-[10px] text-slate-400 text-center font-medium">หน้าบ้าน<br/>(ป้ายบ้านเลขที่)</span>
                </div>
                <div className="border-2 border-dashed border-white/10 rounded-xl p-4 flex flex-col items-center justify-center gap-2 bg-[#0a0d14] h-32 cursor-pointer hover:border-blue-400/50 hover:bg-blue-900/20 transition-all group">
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-blue-500/20 group-hover:scale-110 transition-all">
                    <ImageIcon className="w-5 h-5 text-slate-400 group-hover:text-blue-400" />
                  </div>
                  <span className="text-[10px] text-slate-400 text-center font-medium">ภายในบ้าน<br/>(ห้องพักผ่อน)</span>
                </div>
              </div>
            </div>

            <button className="w-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl py-4 font-bold text-white shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:shadow-[0_0_30px_rgba(168,85,247,0.5)] transition-all">
              บันทึกข้อมูลและส่งให้ครูที่ปรึกษา
            </button>
          </div>
        )}

        {activeTab === 'health' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <Activity className="w-6 h-6 text-pink-500" /> Wellness Profile
              </h2>
            </div>

            {/* Current Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#121624] p-5 rounded-xl border border-white/5 relative overflow-hidden group">
                <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Heart className="w-24 h-24 text-rose-500" />
                </div>
                <div className="text-xs text-slate-400 mb-1 font-medium relative z-10">หมู่เลือด (Blood Type)</div>
                <div className="text-3xl font-black text-rose-400 relative z-10">O<span className="text-xl text-rose-500">+</span></div>
              </div>
              <div className="bg-[#121624] p-5 rounded-xl border border-white/5">
                <div className="text-xs text-slate-400 mb-1 font-medium">โรคประจำตัว</div>
                <div className="text-base font-bold text-white mt-1 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-400" /> หอบหืด
                </div>
                <div className="text-[10px] text-emerald-400 mt-1">(ควบคุมได้ปกติ)</div>
              </div>
            </div>

            {/* BMI & Physical */}
            <div className="bg-[#121624] p-6 rounded-xl border border-white/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <Target className="w-32 h-32 text-blue-500" />
              </div>
              <h3 className="font-bold text-white mb-6 relative z-10">ข้อมูลการเจริญเติบโต (เทอม 1/2567)</h3>
              
              <div className="flex items-end justify-between mb-8 relative z-10 bg-[#0a0d14] rounded-xl p-4 border border-white/5">
                <div className="text-center">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-bold">น้ำหนัก</div>
                  <div className="text-3xl font-black text-white">52<span className="text-xs font-normal text-slate-500 ml-1">kg</span></div>
                </div>
                <div className="w-px h-12 bg-white/10"></div>
                <div className="text-center">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-bold">ส่วนสูง</div>
                  <div className="text-3xl font-black text-white">165<span className="text-xs font-normal text-slate-500 ml-1">cm</span></div>
                </div>
                <div className="w-px h-12 bg-white/10"></div>
                <div className="text-center">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-bold">BMI</div>
                  <div className="text-3xl font-black text-emerald-400 relative">
                    19.1
                    <span className="absolute -top-3 -right-6 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">สมส่วน</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-white/5 pt-5 relative z-10">
                <div className="text-xs font-bold text-slate-400 mb-4 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-400" /> แนวโน้ม BMI ย้อนหลัง
                </div>
                <div className="h-40 w-full ml-[-15px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={bmiTrends}>
                      <XAxis dataKey="term" stroke="#475569" tick={{fill: '#64748b', fontSize: 10}} axisLine={false} tickLine={false} />
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' }}
                        itemStyle={{ color: '#38bdf8' }}
                      />
                      <Line type="monotone" dataKey="bmi" stroke="#38bdf8" strokeWidth={3} dot={{ fill: '#0f172a', stroke: '#38bdf8', strokeWidth: 2, r: 4 }} activeDot={{ r: 6, fill: '#38bdf8' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'gradebook' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-amber-400" />
              รายงานผลการเรียน
            </h2>

            <div className="space-y-4">
              {globalCourses.filter(course => course.level === student?.room || course.roomName === student?.room).map(course => {
                const score = studentScores.find(s => s.courseId === course.courseId && s.studentId === student?.studentId);
                const rawSetting = courseScoreSettings.find(s => s.courseId === course.courseId);
                const setting = {
                  preMidterm: rawSetting ? rawSetting.maxPreMidterm : 25,
                  midterm: rawSetting ? rawSetting.maxMidterm : 20,
                  postMidterm: rawSetting ? rawSetting.maxPostMidterm : 25,
                  final: rawSetting ? rawSetting.maxFinal : 30
                };
                
                // If there's no score, optionally we can skip or show empty. We will show empty/0.
                const total = score?.total || 0;
                const grade = score?.grade || '-';

                return (
                  <div key={course.courseId} className="bg-gradient-to-br from-[#13182b] to-[#0d101d] border border-white/10 rounded-2xl p-5 shadow-xl">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-white">{course.code}</h3>
                        <p className="text-sm text-slate-400">{course.courseName}</p>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <span className="text-xs text-slate-500 font-bold uppercase mb-1">เกรด (Grade)</span>
                        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 font-black text-xl px-3 py-1 rounded-xl shadow-[0_0_15px_rgba(251,191,36,0.2)]">
                          {grade}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between text-xs text-slate-300 mb-1">
                        <span>ความคืบหน้าคะแนนรวม</span>
                        <span className="font-mono font-bold text-amber-400">{total} / 100</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-2 mb-4">
                        <div className="bg-amber-400 h-2 rounded-full" style={{ width: `${total}%` }}></div>
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
                            <div key={i} className="bg-black/20 p-2.5 rounded-xl border border-white/5 relative">
                              <span className="text-slate-400 block mb-1">{comp.label}</span>
                              <div className="flex justify-between items-center">
                                <span className="font-mono font-bold text-white text-sm">{comp.val}<span className="text-slate-500 text-[10px]">/{comp.max}</span></span>
                              </div>
                              {isWarning && comp.val > 0 && (
                                <span className="absolute top-2 right-2 flex w-2 h-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full w-2 h-2 bg-rose-500"></span>
                                </span>
                              )}
                              {isWarning && comp.val > 0 && (
                                <div className="text-[9px] text-rose-400 mt-1 flex items-center gap-1">
                                  <AlertCircle className="w-2.5 h-2.5" /> ควรเร่งทำคะแนนเพิ่ม
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

        {/* Assessment Tab */}
        {activeTab === 'assessment' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <StudentSelfAssessmentForm
              student={student}
              existingAssessment={myAssessment}
              onSave={async (assessment) => {
                await saveSelfAssessment(assessment);
              }}
              onClose={() => setActiveTab('dashboard')}
            />
          </div>
        )}

      </main>

      {/* Modern Bottom Nav */}
      <nav className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[94%] max-w-lg h-16 bg-[#1a1e2e]/95 backdrop-blur-xl border border-white/10 rounded-2xl flex items-center justify-around shadow-2xl z-20 px-1">
        <button 
          onClick={() => setActiveTab('dashboard')}
          className={cn(
            "flex flex-col items-center justify-center w-14 h-12 rounded-xl transition-all duration-300",
            activeTab === 'dashboard' ? "text-blue-400 bg-blue-500/10" : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
          )}
        >
          <User className={cn("w-4 h-4 sm:w-5 sm:h-5", activeTab === 'dashboard' && "drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]")} />
          <span className="text-[8px] sm:text-[9px] font-medium mt-0.5">Dashboard</span>
        </button>
        <button 
          onClick={() => setActiveTab('assessment')}
          className={cn(
            "flex flex-col items-center justify-center w-14 h-12 rounded-xl transition-all duration-300 relative",
            activeTab === 'assessment' ? "text-indigo-400 bg-indigo-500/10" : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
          )}
        >
          <Brain className={cn("w-4 h-4 sm:w-5 sm:h-5", activeTab === 'assessment' && "drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]")} />
          <span className="text-[8px] sm:text-[9px] font-medium mt-0.5">ประเมินตนเอง</span>
          {!myAssessment?.isCompleted && (
            <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          )}
        </button>
        <button 
          onClick={() => setActiveTab('homevisit')}
          className={cn(
            "flex flex-col items-center justify-center w-14 h-12 rounded-xl transition-all duration-300",
            activeTab === 'homevisit' ? "text-emerald-400 bg-emerald-500/10" : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
          )}
        >
          <MapPin className={cn("w-4 h-4 sm:w-5 sm:h-5", activeTab === 'homevisit' && "drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]")} />
          <span className="text-[8px] sm:text-[9px] font-medium mt-0.5">Home Visit</span>
        </button>
        <button 
          onClick={() => setActiveTab('health')}
          className={cn(
            "flex flex-col items-center justify-center w-14 h-12 rounded-xl transition-all duration-300",
            activeTab === 'health' ? "text-pink-400 bg-pink-500/10" : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
          )}
        >
          <Activity className={cn("w-4 h-4 sm:w-5 sm:h-5", activeTab === 'health' && "drop-shadow-[0_0_8px_rgba(236,72,153,0.5)]")} />
          <span className="text-[8px] sm:text-[9px] font-medium mt-0.5">Health</span>
        </button>
        <button 
          onClick={() => setActiveTab('gradebook')}
          className={cn(
            "flex flex-col items-center justify-center w-14 h-12 rounded-xl transition-all duration-300",
            activeTab === 'gradebook' ? "text-amber-400 bg-amber-500/10" : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
          )}
        >
          <BookOpen className={cn("w-4 h-4 sm:w-5 sm:h-5", activeTab === 'gradebook' && "drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]")} />
          <span className="text-[8px] sm:text-[9px] font-medium mt-0.5">Grade</span>
        </button>
      </nav>

      {/* Student Self-Assessment Detail Modal */}
      {viewDetailModal && student && (
        <StudentAssessmentDetailModal
          student={student}
          assessment={myAssessment}
          viewerRole="STUDENT"
          onClose={() => setViewDetailModal(false)}
        />
      )}

      {/* EQ Assessment Modal */}
      {eqModalOpen && selectedClassmate && (
        <div className="absolute inset-0 z-50 flex items-end justify-center sm:items-center bg-black/80 backdrop-blur-sm">
          <div className="w-full sm:w-[350px] bg-[#121624] rounded-t-3xl sm:rounded-3xl border-t sm:border border-white/10 p-6 flex flex-col animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-4 duration-300">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                ประเมิน <span className="text-pink-400">{selectedClassmate.name.split(' ')[1]}</span>
              </h3>
              <button 
                onClick={() => setEqModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center bg-white/5 rounded-full text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-6 flex-1 overflow-y-auto hide-scrollbar">
              {[
                { id: 'q1', text: 'เป็นผู้ฟังที่ดีหรือไม่?' },
                { id: 'q2', text: 'ชอบช่วยเหลือผู้อื่นไหม?' },
                { id: 'q3', text: 'ทำงานร่วมกับผู้อื่นได้ดีไหม?' }
              ].map(q => (
                <div key={q.id}>
                  <p className="text-sm text-slate-300 font-medium mb-3">{q.text}</p>
                  <div className="flex justify-between gap-2">
                    {[
                      { val: 1, emoji: '😡' },
                      { val: 2, emoji: '😐' },
                      { val: 3, emoji: '😊' },
                      { val: 4, emoji: '🤩' }
                    ].map(rating => (
                      <button
                        key={rating.val}
                        onClick={() => setEqAnswers(prev => ({ ...prev, [q.id]: rating.val }))}
                        className={cn(
                          "flex-1 py-2 text-2xl bg-white/5 border rounded-xl transition-all",
                          eqAnswers[q.id] === rating.val ? "border-pink-500 bg-pink-500/10 scale-110" : "border-transparent hover:bg-white/10 grayscale opacity-50 hover:grayscale-0 hover:opacity-100"
                        )}
                      >
                        {rating.emoji}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <button
              disabled={Object.keys(eqAnswers).length < 3}
              onClick={() => {
                setCompletedEqs(prev => [...prev, selectedClassmate.studentId]);
                setEqModalOpen(false);
              }}
              className="mt-6 w-full py-3 bg-gradient-to-r from-pink-500 to-purple-600 rounded-xl text-white font-bold disabled:opacity-50 disabled:from-slate-700 disabled:to-slate-700 transition-all shadow-[0_0_20px_rgba(236,72,153,0.3)] disabled:shadow-none"
            >
              ส่งผลการประเมิน
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
