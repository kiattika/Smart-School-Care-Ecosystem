import React, { useState } from 'react';
import { 
  BookOpen, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Plus, 
  Search, 
  Calendar, 
  FileText, 
  Award, 
  CheckSquare, 
  Star, 
  UserCheck, 
  Eye, 
  MessageSquare, 
  BarChart3, 
  Sparkles 
} from 'lucide-react';

export function SupervisionPortal() {
  const [activeTab, setActiveTab] = useState<'schedule' | 'rubric' | 'lessonPlans' | 'mentoring'>('schedule');
  const [searchTerm, setSearchTerm] = useState('');

  // Lesson Plans list state (mock)
  const [lessonPlans, setLessonPlans] = useState([
    {
      id: 'LP-001',
      teacherName: 'นายเกียรติศักดิ์ ใจมั่น',
      subjectCode: 'ค32201',
      subjectName: 'คณิตศาสตร์เพิ่มเติม 3',
      classRoom: 'ม.5/8',
      weekNo: 10,
      title: 'การประยุกต์ใช้อนุกรมอนันต์ในงานวิศวกรรม',
      submittedAt: '2026-08-18',
      status: 'APPROVED',
      supervisorFeedback: 'แผนการจัดการเรียนรู้มีความโดดเด่นในการใช้ Active Learning ผ่าน GeoGebra อนุมัติจัดสอนได้'
    },
    {
      id: 'LP-002',
      teacherName: 'นางสาวสมใจ รักสอน',
      subjectCode: 'ว30101',
      subjectName: 'วิทยาศาสตร์กายภาพ',
      classRoom: 'ม.4/1',
      weekNo: 10,
      title: 'ปฏิกิริยาเคมีในชีวิตประจำวันและสิ่งแวดล้อม',
      submittedAt: '2026-08-19',
      status: 'PENDING_REVIEW'
    },
    {
      id: 'LP-003',
      teacherName: 'นายมานะ บากบั่น',
      subjectCode: 'ค31101',
      subjectName: 'คณิตศาสตร์พื้นฐาน 1',
      classRoom: 'ม.1/1',
      weekNo: 10,
      title: 'ระบบจำนวนเต็มและการดำเนินการ',
      submittedAt: '2026-08-17',
      status: 'REVISIONS_REQUESTED',
      supervisorFeedback: 'ขอให้เพิ่มเติมสื่อการเรียนรู้แบบเกมมิ่ง (Gamification) หรือแบบฝึกหัดทักษะย่อยเพิ่มขึ้นอีก 1 ชุด'
    }
  ]);

  // Classroom Observation Visits (mock)
  const [visits, setVisits] = useState([
    {
      id: 'VIS-01',
      teacherName: 'นายเกียรติศักดิ์ ใจมั่น',
      subject: 'คณิตศาสตร์ (ค32201)',
      classRoom: 'ม.5/8',
      visitDate: '2026-08-20',
      status: 'COMPLETED',
      avgScore: 4.6,
      strengths: 'กระตุ้นผู้เรียนด้วยโจทย์ปัญหาท้าทายและการใช้ซอฟต์แวร์จำลอง',
      areasForImprovement: 'เพิ่มเวลาสรุปองค์ความรู้ร่วมกันในช่วง 5 นาทีสุดท้าย'
    },
    {
      id: 'VIS-02',
      teacherName: 'นางสาวสมใจ รักสอน',
      subject: 'วิทยาศาสตร์ (ว30101)',
      classRoom: 'ม.4/1',
      visitDate: '2026-08-21',
      status: 'SCHEDULED',
      avgScore: 0
    }
  ]);

  // Selected Lesson Plan for review modal
  const [selectedPlan, setSelectedPlan] = useState<any | null>(null);
  const [feedbackText, setFeedbackText] = useState('');

  // New Observation Rubric Modal State
  const [showRubricModal, setShowRubricModal] = useState(false);
  const [obsTeacherName, setObsTeacherName] = useState('นายเกียรติศักดิ์ ใจมั่น');
  const [scoreActiveLearning, setScoreActiveLearning] = useState(5);
  const [scoreMedia, setScoreMedia] = useState(4);
  const [scoreEngagement, setScoreEngagement] = useState(5);
  const [scoreAssessment, setScoreAssessment] = useState(4);
  const [obsStrengths, setObsStrengths] = useState('');
  const [obsImprovement, setObsImprovement] = useState('');

  const handleReviewPlan = (id: string, status: 'APPROVED' | 'REVISIONS_REQUESTED') => {
    setLessonPlans(lessonPlans.map(lp => lp.id === id ? { ...lp, status, supervisorFeedback: feedbackText } : lp));
    setSelectedPlan(null);
    setFeedbackText('');
  };

  const handleSaveObservation = (e: React.FormEvent) => {
    e.preventDefault();
    const avg = Number(((scoreActiveLearning + scoreMedia + scoreEngagement + scoreAssessment) / 4).toFixed(1));
    const newV = {
      id: `VIS-0${visits.length + 1}`,
      teacherName: obsTeacherName,
      subject: 'รายวิชาตามตารางสอน',
      classRoom: 'ม.5/8',
      visitDate: new Date().toISOString().split('T')[0],
      status: 'COMPLETED' as const,
      avgScore: avg,
      strengths: obsStrengths,
      areasForImprovement: obsImprovement
    };
    setVisits([newV, ...visits]);
    setShowRubricModal(false);
    setObsStrengths('');
    setObsImprovement('');
  };

  return (
    <div className="flex-1 bg-slate-950 text-slate-100 flex flex-col min-h-screen">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-cyan-950/60 via-slate-900 to-slate-900 border-b border-cyan-500/20 px-6 py-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-cyan-500/20 border border-cyan-500/30 rounded-2xl text-cyan-400 shadow-lg">
              <BookOpen className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">งานนิเทศการสอนและพัฒนาวิชาการ</h1>
                <span className="px-2 py-0.5 bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-[10px] font-bold rounded-md">
                  Instructional Supervision & Academic Mentoring
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                ระบบตรวจแผนการจัดการเรียนรู้ นิเทศสังเกตการณ์ชั้นเรียน บันทึกคะแนนรูบริก และให้คำปรึกษาพัฒนาสมรรถนะครู
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowRubricModal(true)}
              className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-lg transition-all cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              บันทึกผลการนิเทศการสอนใหม่
            </button>
          </div>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="max-w-7xl w-full mx-auto px-6 pt-6">
        <div className="flex border-b border-slate-800 gap-6">
          <button
            onClick={() => setActiveTab('lessonPlans')}
            className={`pb-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'lessonPlans' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>ตรวจและอนุมัติแผนการจัดการเรียนรู้ ({lessonPlans.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            className={`pb-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'schedule' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>ปฏิทินและบันทึกการนิเทศชั้นเรียน ({visits.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('rubric')}
            className={`pb-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'rubric' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>เกณฑ์การประเมินรูบริก (Rubric Scoring)</span>
          </button>
          <button
            onClick={() => setActiveTab('mentoring')}
            className={`pb-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'mentoring' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>สถิติการเติบโตสมรรถนะครู (Growth Analytics)</span>
          </button>
        </div>
      </div>

      {/* Content Body */}
      <div className="max-w-7xl w-full mx-auto px-6 py-6 flex-1 space-y-6">
        
        {/* TAB 1: LESSON PLANS REVIEW ENGINE */}
        {activeTab === 'lessonPlans' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">รายการแผนการจัดการเรียนรู้ที่รอการตรวจสอบ</h3>
                <p className="text-xs text-slate-400">หัวหน้ากลุ่มสาระฯ และศึกษานิเทศก์ตรวจสอบ ให้ข้อเสนอแนะ และอนุมัติแผนก่อนสอนจริง</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {lessonPlans.map((lp) => (
                <div key={lp.id} className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-slate-800 text-cyan-400 text-[10px] font-mono rounded font-bold">
                        {lp.subjectCode} - สัปดาห์ที่ {lp.weekNo}
                      </span>
                      <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-300 text-[10px] font-semibold rounded border border-indigo-500/20">
                        {lp.classRoom}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">ยื่นเมื่อ: {lp.submittedAt}</span>
                    </div>
                    <h4 className="text-sm font-bold text-white">{lp.title}</h4>
                    <p className="text-xs text-slate-350">ครูผู้สอน: <span className="text-white font-medium">{lp.teacherName}</span> ({lp.subjectName})</p>
                    {lp.supervisorFeedback && (
                      <p className="text-xs text-cyan-300 bg-cyan-950/30 p-2.5 rounded-lg border border-cyan-500/20 mt-2">
                        💬 <span className="font-semibold">ความเห็นนิเทศ:</span> {lp.supervisorFeedback}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col md:items-end gap-3 w-full md:w-auto">
                    <div>
                      {lp.status === 'APPROVED' ? (
                        <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-bold inline-flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> อนุมัติแผนแล้ว
                        </span>
                      ) : lp.status === 'REVISIONS_REQUESTED' ? (
                        <span className="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl text-xs font-bold inline-flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" /> ส่งคืนแก้ไข
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-xl text-xs font-bold inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> รอการตรวจสอบ
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        setSelectedPlan(lp);
                        setFeedbackText(lp.supervisorFeedback || '');
                      }}
                      className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" /> ตรวจสอบและให้ความเห็น
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: SCHEDULE & CLASSROOM OBSERVATION */}
        {activeTab === 'schedule' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">ตารางนิเทศสังเกตการณ์ชั้นเรียน</h3>
                <p className="text-xs text-slate-400">กระบวนการนิเทศ 3 ขั้นตอน: Pre-observation ➔ Observation ➔ Post-observation reflection</p>
              </div>
              <button
                onClick={() => setShowRubricModal(true)}
                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl transition-colors"
              >
                + เพิ่มนัดหมายนิเทศ
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {visits.map((v) => (
                <div key={v.id} className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 bg-slate-800 text-cyan-400 text-[10px] font-mono rounded font-bold">
                      {v.id}
                    </span>
                    <span className="text-xs font-mono text-slate-400">📅 {v.visitDate}</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">{v.teacherName}</h4>
                    <p className="text-xs text-slate-300">{v.subject} ({v.classRoom})</p>
                  </div>

                  {v.status === 'COMPLETED' ? (
                    <div className="space-y-2 pt-2 border-t border-slate-800">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">คะแนนเฉลี่ยรูบริก</span>
                        <span className="text-base font-black font-mono text-emerald-400 flex items-center gap-1">
                          <Star className="w-4 h-4 fill-emerald-400 text-emerald-400" /> {v.avgScore} / 5.0
                        </span>
                      </div>
                      <p className="text-xs text-slate-300">💡 <span className="font-semibold text-white">จุดเด่น:</span> {v.strengths}</p>
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                      <span className="text-xs text-amber-400">⏳ สถานะ: รอดำเนินการสังเกตการณ์ในห้องเรียน</span>
                      <button 
                        onClick={() => setShowRubricModal(true)}
                        className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold"
                      >
                        เริ่มประเมิน
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: RUBRIC SCORING CRITERIA */}
        {activeTab === 'rubric' && (
          <div className="space-y-4">
            <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
              <h3 className="text-base font-bold text-white">เกณฑ์การประเมินการจัดการเรียนรู้ (Observation Rubric 5 มิติ)</h3>
              <p className="text-xs text-slate-400">เกณฑ์มาตรฐานตามสำนักงานคณะกรรมการข้าราชการครูและบุคลากรทางการศึกษา (ก.ค.ศ.)</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1.5">
                  <span className="text-xs font-bold text-cyan-400">1. การจัดการเรียนรู้เชิงรุก (Active Learning)</span>
                  <p className="text-xs text-slate-300">ผู้เรียนมีส่วนร่วมปฏิบัติกิจกรรม คิดวิเคราะห์ และสร้างองค์ความรู้ด้วยตนเองมากกว่าการฟังบรรยาย</p>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1.5">
                  <span className="text-xs font-bold text-cyan-400">2. การใช้สื่อ นวัตกรรม และเทคโนโลยี</span>
                  <p className="text-xs text-slate-300">การประยุกต์ใช้สื่อดิจิทัล สื่อทำมือ หรือแหล่งเรียนรู้ที่สอดคล้องกับจุดประสงค์การเรียนรู้</p>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1.5">
                  <span className="text-xs font-bold text-cyan-400">3. การมีส่วนร่วมและแรงจูงใจของผู้เรียน</span>
                  <p className="text-xs text-slate-300">บรรยากาศในชั้นเรียนเอื้อต่อการเรียนรู้ ผู้เรียนมีความกระตือรือร้นและกล้าแสดงออก</p>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1.5">
                  <span className="text-xs font-bold text-cyan-400">4. การวัดและประเมินผลตามสภาพจริง</span>
                  <p className="text-xs text-slate-300">การใช้คำถามเชิงรุก การประเมินระหว่างเรียน และฟีดแบ็กเพื่อพัฒนาผู้เรียนทันที</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: MENTORING & GROWTH ANALYTICS */}
        {activeTab === 'mentoring' && (
          <div className="space-y-4">
            <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-bold text-white">กราฟแสดงพัฒนาการสมรรถนะครูรายบุคคล (Competency Growth)</h3>
                  <p className="text-xs text-slate-400">เปรียบเทียบผลการประเมินการนิเทศภาคเรียนที่ผ่านมาเทียบกับภาคเรียนปัจจุบัน</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm">นายเกียรติศักดิ์ ใจมั่น</span>
                    <span className="text-xs text-emerald-400 font-mono font-bold">+12% พัฒนาขึ้น</span>
                  </div>
                  <p className="text-xs text-slate-400">กลุ่มสาระฯ คณิตศาสตร์ (ครู คศ.2)</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-slate-400">Active Learning:</span><span className="font-mono text-emerald-400 font-bold">4.8 / 5.0</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Digital Media:</span><span className="font-mono text-emerald-400 font-bold">4.6 / 5.0</span></div>
                  </div>
                </div>

                <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm">นางสาวสมใจ รักสอน</span>
                    <span className="text-xs text-emerald-400 font-mono font-bold">+8% พัฒนาขึ้น</span>
                  </div>
                  <p className="text-xs text-slate-400">กลุ่มสาระฯ วิทยาศาสตร์ (ครู คศ.1)</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-slate-400">Active Learning:</span><span className="font-mono text-emerald-400 font-bold">4.4 / 5.0</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Digital Media:</span><span className="font-mono text-emerald-400 font-bold">4.3 / 5.0</span></div>
                  </div>
                </div>

                <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm">นายมานะ บากบั่น</span>
                    <span className="text-xs text-cyan-400 font-mono font-bold">รอบประเมินใหม่</span>
                  </div>
                  <p className="text-xs text-slate-400">กลุ่มสาระฯ คณิตศาสตร์ (ครูผู้ช่วย)</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-slate-400">Active Learning:</span><span className="font-mono text-cyan-400 font-bold">4.0 / 5.0</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Digital Media:</span><span className="font-mono text-cyan-400 font-bold">4.1 / 5.0</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* LESSON PLAN REVIEW MODAL */}
      {selectedPlan && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">ตรวจสอบและให้ความเห็นแผนการจัดการเรียนรู้</h3>
              </div>
              <button 
                onClick={() => setSelectedPlan(null)}
                className="text-slate-400 hover:text-white text-sm font-bold px-2 py-1 bg-slate-800 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs bg-slate-950 p-4 rounded-xl border border-slate-800">
              <p><span className="font-bold text-white">หัวข้อแผน:</span> {selectedPlan.title}</p>
              <p><span className="font-bold text-white">ครูผู้สอน:</span> {selectedPlan.teacherName}</p>
              <p><span className="font-bold text-white">รายวิชา:</span> {selectedPlan.subjectName} ({selectedPlan.subjectCode}) ห้อง {selectedPlan.classRoom}</p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">ข้อเสนอแนะ / ความเห็นของผู้นิเทศ</label>
              <textarea
                rows={3}
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="พิมพ์ข้อเสนอแนะในการปรับปรุง หรือระบุการอนุมัติ..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => handleReviewPlan(selectedPlan.id, 'REVISIONS_REQUESTED')}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                ส่งคืนให้แก้ไข (Revise)
              </button>
              <button
                onClick={() => handleReviewPlan(selectedPlan.id, 'APPROVED')}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                ✓ อนุมัติแผนการจัดการเรียนรู้
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW OBSERVATION RUBRIC MODAL */}
      {showRubricModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">บันทึกผลการสังเกตการณ์ชั้นเรียน (Rubric)</h3>
              </div>
              <button 
                onClick={() => setShowRubricModal(false)}
                className="text-slate-400 hover:text-white text-sm font-bold px-2 py-1 bg-slate-800 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveObservation} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">ชื่อครูผู้รับการนิเทศ</label>
                <input
                  type="text"
                  value={obsTeacherName}
                  onChange={(e) => setObsTeacherName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">1. Active Learning (1-5)</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={scoreActiveLearning}
                    onChange={(e) => setScoreActiveLearning(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">2. Instructional Media (1-5)</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={scoreMedia}
                    onChange={(e) => setScoreMedia(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">จุดเด่นในการจัดการเรียนรู้ (Strengths)</label>
                <input
                  type="text"
                  required
                  value={obsStrengths}
                  onChange={(e) => setObsStrengths(e.target.value)}
                  placeholder="เช่น ผู้เรียนมีส่วนร่วมดีมาก การใช้สื่อดิจิทัลโดดเด่น"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">ข้อเสนอแนะเพื่อการพัฒนา (Areas for Improvement)</label>
                <input
                  type="text"
                  value={obsImprovement}
                  onChange={(e) => setObsImprovement(e.target.value)}
                  placeholder="เช่น เพิ่มกิจกรรมสรุปองค์ความรู้ร่วมกันตอนท้าย"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowRubricModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg transition-all"
                >
                  บันทึกผลการนิเทศ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
