import React, { useState } from 'react';
import { 
  Activity, 
  Heart, 
  Smile, 
  ShieldAlert, 
  CheckCircle2, 
  AlertCircle, 
  Pill, 
  Stethoscope, 
  FileText, 
  BarChart3, 
  Brain, 
  HelpCircle, 
  Check, 
  Sparkles,
  ArrowUpRight,
  TrendingDown,
  User,
  Users,
  GraduationCap
} from 'lucide-react';
import { useStore } from '../../store';
import { 
  SemesterHealthRecord, 
  InfirmaryVisit, 
  TwoQuestionScreening, 
  PHQ9Screening, 
  SDQAssessment,
  Student 
} from '../../types';

export function HealthMentalWellbeingModule({ studentId, isParentView = false }: { studentId: string; isParentView?: boolean }) {
  const { 
    semesterHealthLogs, 
    chronicIllnesses, 
    allergies, 
    specialCareNeeds, 
    infirmaryVisits, 
    twoQuestionScreenings, 
    phq9Screenings, 
    sdqAssessments,
    acknowledgeInfirmaryAlert,
    save2QScreening,
    savePHQ9Screening,
    submitSDQAssessment,
    students
  } = useStore();

  const defaultStudent: Student = {
    id: studentId || 'default-student',
    studentId: studentId || '69501',
    name: 'นักเรียน (กำลังโหลดข้อมูล)',
    fullName: 'นักเรียน (กำลังโหลดข้อมูล)',
    nickname: '',
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    studentNo: 1,
    number: 1,
    grade: 'ม.5',
    room: '1',
    seatIndex: null,
    homeLocation: {
      address: 'อุตรดิตถ์',
      coordinates: [17.6201, 100.0993],
      routeImage: ''
    },
    attendance: { morningStatus: 'PRESENT', checkInMethod: 'SCAN', checkInTime: '07:45 น.' }
  };
  const student = students.find(s => s.studentId === studentId) || students[0] || defaultStudent;
  const healthLogs = semesterHealthLogs[student.studentId] || [];
  const studentIllnesses = chronicIllnesses[student.studentId] || [];
  const studentAllergies = allergies[student.studentId] || [];
  const studentSpecialCare = specialCareNeeds[student.studentId] || [];
  const visits = infirmaryVisits.filter(v => v.studentId === student.studentId);
  const screening2Q = twoQuestionScreenings[student.studentId];
  const screeningPHQ9 = phq9Screenings[student.studentId];
  const studentSDQs = sdqAssessments.filter(s => s.studentId === student.studentId);

  const [activeTab, setActiveTab] = useState<'physical' | 'infirmary' | 'screening' | 'sdq'>('physical');

  // 2Q Form State
  const [q1, setQ1] = useState<boolean>(screening2Q ? screening2Q.q1Depressed : false);
  const [q2, setQ2] = useState<boolean>(screening2Q ? screening2Q.q2Hopeless : false);
  const [saved2QSuccess, setSaved2QSuccess] = useState(false);

  // PHQ-9 Form State (9 items 0-3)
  const [phqAnswers, setPhqAnswers] = useState<number[]>(
    screeningPHQ9 ? screeningPHQ9.answers : [0, 0, 0, 0, 0, 0, 0, 0, 0]
  );
  const [savedPHQSuccess, setSavedPHQSuccess] = useState(false);

  // SDQ Interactive Form State
  const [sdqEvaluator, setSdqEvaluator] = useState<'STUDENT' | 'PARENT' | 'TEACHER'>(isParentView ? 'PARENT' : 'STUDENT');
  const [sdqScores, setSdqScores] = useState({
    emotional: 2,
    conduct: 1,
    hyperactivity: 2,
    peerProblems: 1,
    prosocial: 9
  });
  const [sdqSubmitSuccess, setSdqSubmitSuccess] = useState(false);

  const latestHealth = healthLogs[healthLogs.length - 1] || {
    semester: '1/2569',
    height: 175,
    weight: 65,
    bmi: 21.2,
    bmiCategory: 'NORMAL',
    bloodType: 'O (Rh+)',
    systolicBp: 120,
    diastolicBp: 80,
    recordedAt: '2026-06-10'
  };

  const phqQuestions = [
    '1. เบื่อ ไม่สนใจ หรือไม่เพลิดเพลินในการทำสิ่งต่างๆ',
    '2. รู้สึกไม่สบายใจ ซึมเศร้า หรือท้อแท้',
    '3. หลับยาก หรือหลับๆ ตื่นๆ หรือหลับมากเกินไป',
    '4. เหนื่อยง่าย หรือไม่ค่อยมีแรง',
    '5. เบื่ออาหาร หรือกินมากเกินไป',
    '6. รู้สึกไม่ดีกับตัวเอง คิดว่าตัวเองล้มเหลว หรือทำให้ตนเองหรือครอบครัวผิดหวัง',
    '7. สมาธิไม่ดีเวลาทำสิ่งต่างๆ เช่น อ่านหนังสือ หรือดูโทรทัศน์',
    '8. พูดหรือทำอะไรช้าจนคนอื่นสังเกตเห็น หรือกระสับกระส่ายผิดปกติ',
    '9. คิดทำร้ายตัวเอง หรือคิดว่าถ้าตายไปคงจะดี'
  ];

  const handleSave2Q = (e: React.FormEvent) => {
    e.preventDefault();
    save2QScreening(student.studentId, q1, q2);
    setSaved2QSuccess(true);
    setTimeout(() => setSaved2QSuccess(false), 3000);
  };

  const handleSavePHQ9 = (e: React.FormEvent) => {
    e.preventDefault();
    savePHQ9Screening(student.studentId, phqAnswers);
    setSavedPHQSuccess(true);
    setTimeout(() => setSavedPHQSuccess(false), 3000);
  };

  const handleSaveSDQ = (e: React.FormEvent) => {
    e.preventDefault();
    const totalDifficulties = sdqScores.emotional + sdqScores.conduct + sdqScores.hyperactivity + sdqScores.peerProblems;
    let triagingStatus: SDQAssessment['triagingStatus'] = 'NORMAL';
    if (totalDifficulties >= 17) triagingStatus = 'VULNERABLE';
    else if (totalDifficulties >= 14) triagingStatus = 'AT_RISK';

    submitSDQAssessment({
      studentId: student.studentId,
      evaluatorType: sdqEvaluator,
      evaluatorName: sdqEvaluator === 'STUDENT' ? `${student.name} (ประเมินตนเอง)` :
                     sdqEvaluator === 'PARENT' ? 'ผู้ปกครอง' : 'ครูกิตติศักดิ์ (ครูประจำชั้น)',
      subscaleScores: sdqScores,
      totalDifficultiesScore: totalDifficulties,
      triagingStatus,
      recommendations: [
        `คะแนนปัญหาพฤติกรรมรวม: ${totalDifficulties}/40 (${triagingStatus === 'NORMAL' ? 'เกณฑ์ปกติ' : triagingStatus === 'AT_RISK' ? 'กลุ่มเสี่ยง' : 'กลุ่มมีปัญหา'})`,
        `พฤติกรรมสัมพันธภาพทางสังคม (จุดแข็ง): ${sdqScores.prosocial}/10 (อยู่ในเกณฑ์ดี)`
      ]
    });

    setSdqSubmitSuccess(true);
    setTimeout(() => setSdqSubmitSuccess(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Sub tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-900/60 border border-slate-800 rounded-2xl w-full max-w-2xl mx-auto">
        <button
          onClick={() => setActiveTab('physical')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'physical'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>สุขภาพกาย & BMI</span>
        </button>
        <button
          onClick={() => setActiveTab('infirmary')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'infirmary'
              ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Stethoscope className="w-3.5 h-3.5" />
          <span>ห้องพยาบาล & การใช้ยา</span>
        </button>
        <button
          onClick={() => setActiveTab('screening')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'screening'
              ? 'bg-gradient-to-r from-indigo-500 to-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Brain className="w-3.5 h-3.5" />
          <span>คัดกรอง 2Q & PHQ-9</span>
        </button>
        <button
          onClick={() => setActiveTab('sdq')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'sdq'
              ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>ประเมิน SDQ 3 มิติ</span>
        </button>
      </div>

      {activeTab === 'physical' && (
        <div className="space-y-6">
          {/* Key Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
              <span className="text-[11px] text-slate-400 block mb-1">ส่วนสูงปัจจุบัน</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-white">{latestHealth.height}</span>
                <span className="text-xs text-slate-400">ซม.</span>
              </div>
              <span className="text-[10px] text-emerald-400 mt-1 block">⬆️ +7 ซม. จาก ม.4</span>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
              <span className="text-[11px] text-slate-400 block mb-1">น้ำหนักปัจจุบัน</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-white">{latestHealth.weight}</span>
                <span className="text-xs text-slate-400">กก.</span>
              </div>
              <span className="text-[10px] text-emerald-400 mt-1 block">⚖️ อัตราส่วนสมดุล</span>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
              <span className="text-[11px] text-slate-400 block mb-1">ดัชนีมวลกาย (BMI)</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-emerald-400">{latestHealth.bmi}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">สมส่วน</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">เกณฑ์มาตรฐาน 18.5 - 22.9</span>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
              <span className="text-[11px] text-slate-400 block mb-1">หมู่เลือด & ความดัน</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-bold text-white">{latestHealth.bloodType}</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                BP: {latestHealth.systolicBp}/{latestHealth.diastolicBp} mmHg
              </span>
            </div>
          </div>

          {/* Historical Growth Chart & Health Conditions */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* BMI Trend Table */}
            <div className="lg:col-span-6 bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-md">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
                <Activity className="w-4 h-4 text-emerald-400" />
                ประวัติการเจริญเติบโตรายภาคเรียน (Growth Trends)
              </h3>
              <p className="text-[11px] text-slate-400 mb-4">บันทึกตรวจสุขภาพโดยงานอนามัยโรงเรียน</p>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="pb-2 font-medium">ภาคเรียน</th>
                      <th className="pb-2 font-medium">ส่วนสูง (cm)</th>
                      <th className="pb-2 font-medium">น้ำหนัก (kg)</th>
                      <th className="pb-2 font-medium">BMI</th>
                      <th className="pb-2 font-medium text-right">ผลการประเมิน</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {healthLogs.map((h, i) => (
                      <tr key={i} className="hover:bg-slate-800/30">
                        <td className="py-2.5 font-bold text-slate-200">{h.semester}</td>
                        <td className="py-2.5 text-slate-300">{h.height}</td>
                        <td className="py-2.5 text-slate-300">{h.weight}</td>
                        <td className="py-2.5 font-mono font-bold text-emerald-400">{h.bmi}</td>
                        <td className="py-2.5 text-right">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                            สมส่วน
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Allergies, Chronic Illnesses & Special Care */}
            <div className="lg:col-span-6 space-y-4">
              {/* Chronic Illnesses */}
              <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 backdrop-blur-md">
                <h4 className="text-xs font-bold text-amber-400 flex items-center gap-1.5 mb-2">
                  <ShieldAlert className="w-4 h-4" />
                  โรคประจำตัวและข้อควรระวัง (Chronic Illnesses)
                </h4>
                {studentIllnesses.map((ci) => (
                  <div key={ci.id} className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-200">{ci.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                        ระดับ: {ci.severity}
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-300/80">{ci.treatmentCare}</p>
                  </div>
                ))}
              </div>

              {/* Allergies */}
              <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 backdrop-blur-md">
                <h4 className="text-xs font-bold text-rose-400 flex items-center gap-1.5 mb-2">
                  <Pill className="w-4 h-4" />
                  ประวัติการแพ้ยาและอาหาร (Allergies)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {studentAllergies.map((al) => (
                    <div key={al.id} className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-rose-200">{al.allergen}</span>
                        <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold">
                          {al.type === 'FOOD' ? 'แพ้อาหาร' : 'แพ้ยา'}
                        </span>
                      </div>
                      <p className="text-[10.5px] text-rose-300/80">{al.reaction}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Special Classroom Care */}
              <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 backdrop-blur-md">
                <h4 className="text-xs font-bold text-indigo-400 flex items-center gap-1.5 mb-2">
                  <Heart className="w-4 h-4" />
                  ความต้องการพิเศษในการดูแลในชั้นเรียน (Special Classroom Care)
                </h4>
                {studentSpecialCare.map((sc) => (
                  <div key={sc.id} className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-xs space-y-1">
                    <span className="font-bold text-indigo-200">{sc.category}: {sc.description}</span>
                    <p className="text-[11px] text-indigo-300/80">👉 แผนการจัดการ: {sc.actionPlan}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'infirmary' && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-md shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-rose-400" />
                บันทึกการเข้ารับบริการห้องพยาบาล & การใช้ยา (Infirmary Visit Logs)
              </h3>
              <p className="text-[11px] text-slate-400">
                ระบบแจ้งเตือนกรณีมีไข้สูง หรือได้รับอุบัติเหตุ พร้อมปุ่มรับทราบของผู้ปกครอง
              </p>
            </div>
            <span className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium border border-slate-700">
              ประวัติการเข้าห้องพยาบาล {visits.length} ครั้ง
            </span>
          </div>

          <div className="space-y-4">
            {visits.map((visit) => (
              <div
                key={visit.id}
                className={`p-4 sm:p-5 rounded-2xl border transition-all space-y-3 ${
                  visit.isUrgentAlert
                    ? 'bg-rose-500/10 border-rose-500/40 shadow-lg'
                    : 'bg-slate-800/40 border-slate-800'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    {visit.isUrgentAlert && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold animate-pulse">
                        🚨 แจ้งเตือนด่วนถึงผู้ปกครอง
                      </span>
                    )}
                    <span className="text-xs font-bold text-white">{visit.visitTime}</span>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400">ผู้ดูแล:</span>
                    <span className="text-slate-200 font-medium">{visit.nurseName}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block mb-0.5">อาการเบื้องต้น & อุณหภูมิ</span>
                    <span className="font-bold text-rose-300 block">{visit.symptoms}</span>
                    <span className="text-[10px] text-amber-400 font-mono mt-1 block">🌡️ อุณหภูมิ: {visit.temperature}°C</span>
                  </div>

                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block mb-0.5">การปฐมพยาบาล & การรักษา</span>
                    <span className="text-slate-200 block">{visit.treatment}</span>
                    <span className="text-[10px] text-slate-400 mt-1 block">⏱️ พักฟื้น {visit.restDurationMinutes} นาที</span>
                  </div>

                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block mb-0.5">ยาที่ได้รับจ่าย</span>
                    <span className="font-bold text-indigo-300 flex items-center gap-1">
                      <Pill className="w-3.5 h-3.5" />
                      {visit.medicationGiven}
                    </span>
                  </div>
                </div>

                {/* Parent Acknowledgement Bar */}
                <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs">
                    {visit.parentAcknowledged ? (
                      <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        ผู้ปกครองรับทราบเรื่องแล้ว ({visit.acknowledgedAt})
                      </span>
                    ) : (
                      <span className="text-amber-400 font-bold flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 animate-bounce" />
                        รอผู้ปกครองกดรับทราบ
                      </span>
                    )}
                  </div>

                  {!visit.parentAcknowledged && (
                    <button
                      onClick={() => acknowledgeInfirmaryAlert(visit.id)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>(ผู้ปกครอง) กดรับทราบอาการของนักเรียน</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'screening' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* 2Q Screening Form */}
          <div className="lg:col-span-5 bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-md shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Brain className="w-4 h-4 text-indigo-400" />
                    แบบคัดกรองอารมณ์เบื้องต้น (2Q)
                  </h3>
                  <p className="text-[11px] text-slate-400">คัดกรองความเสี่ยงภาวะซึมเศร้า 2 คำถาม</p>
                </div>
                <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-bold">
                  มาตรฐานกรมสุขภาพจิต
                </span>
              </div>

              {saved2QSuccess && (
                <div className="p-3 mb-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>บันทึกผลการคัดกรอง 2Q เรียบร้อยแล้ว</span>
                </div>
              )}

              <form onSubmit={handleSave2Q} className="space-y-4">
                <div className="p-3.5 bg-slate-800/40 border border-slate-800 rounded-2xl space-y-2">
                  <p className="text-xs text-slate-200 font-medium">
                    1. ใน 2 สัปดาห์ที่ผ่านมา รวมวันนี้ ท่านรู้สึกหดหู่ เศร้า หรือท้อแท้สิ้นหวัง หรือไม่?
                  </p>
                  <div className="flex gap-3">
                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input 
                        type="radio" 
                        name="q1" 
                        checked={!q1} 
                        onChange={() => setQ1(false)} 
                        className="accent-indigo-500"
                      />
                      <span>ไม่มี</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input 
                        type="radio" 
                        name="q1" 
                        checked={q1} 
                        onChange={() => setQ1(true)} 
                        className="accent-indigo-500"
                      />
                      <span>มี</span>
                    </label>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-800/40 border border-slate-800 rounded-2xl space-y-2">
                  <p className="text-xs text-slate-200 font-medium">
                    2. ใน 2 สัปดาห์ที่ผ่านมา รวมวันนี้ ท่านรู้สึกเบื่อ ทำอะไรก็ไม่เพลิดเพลิน หรือไม่?
                  </p>
                  <div className="flex gap-3">
                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input 
                        type="radio" 
                        name="q2" 
                        checked={!q2} 
                        onChange={() => setQ2(false)} 
                        className="accent-indigo-500"
                      />
                      <span>ไม่มี</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input 
                        type="radio" 
                        name="q2" 
                        checked={q2} 
                        onChange={() => setQ2(true)} 
                        className="accent-indigo-500"
                      />
                      <span>มี</span>
                    </label>
                  </div>
                </div>

                <div className="p-3 bg-slate-800/60 rounded-xl text-xs space-y-1">
                  <span className="text-[10px] text-slate-400 block">ผลการคัดกรอง 2Q ล่าสุด:</span>
                  <span className={`font-bold block ${q1 || q2 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {q1 || q2 ? '⚠️ มีความเสี่ยง (แนะนำให้ทำแบบประเมิน PHQ-9 ต่อเนื่อง)' : '✅ สภาวะอารมณ์ปกติ'}
                  </span>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow transition-all cursor-pointer"
                >
                  บันทึกผลการคัดกรอง 2Q
                </button>
              </form>
            </div>
          </div>

          {/* PHQ-9 Comprehensive Form */}
          <div className="lg:col-span-7 bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-md shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Smile className="w-4 h-4 text-indigo-400" />
                    แบบประเมินภาวะซึมเศร้า 9 คำถาม (PHQ-9)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    เกณฑ์คะแนน: 0=ไม่มีเลย, 1=มีบางวัน, 2=มีบ่อย, 3=มีทุกวัน (คะแนนรวม 0 - 27)
                  </p>
                </div>
              </div>

              {savedPHQSuccess && (
                <div className="p-3 mb-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>บันทึกผลการประเมิน PHQ-9 และสรุปคำแนะนำสำเร็จ</span>
                </div>
              )}

              <form onSubmit={handleSavePHQ9} className="space-y-3">
                <div className="max-h-[340px] overflow-y-auto space-y-2.5 pr-1">
                  {phqQuestions.map((q, idx) => (
                    <div key={idx} className="p-3 bg-slate-800/40 border border-slate-800 rounded-xl text-xs space-y-1.5">
                      <p className="text-slate-200 font-medium">{q}</p>
                      <div className="grid grid-cols-4 gap-1.5 text-center text-[10px]">
                        {[
                          { val: 0, label: 'ไม่มีเลย (0)' },
                          { val: 1, label: 'บางวัน (1)' },
                          { val: 2, label: 'บ่อย (2)' },
                          { val: 3, label: 'ทุกวัน (3)' }
                        ].map((choice) => (
                          <button
                            key={choice.val}
                            type="button"
                            onClick={() => {
                              const newAns = [...phqAnswers];
                              newAns[idx] = choice.val;
                              setPhqAnswers(newAns);
                            }}
                            className={`py-1.5 px-1 rounded-lg border transition-all ${
                              phqAnswers[idx] === choice.val
                                ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300 font-bold'
                                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            {choice.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Score Summary */}
                <div className="p-3.5 bg-gradient-to-br from-indigo-500/10 to-blue-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400">คะแนนประเมิน PHQ-9 รวม:</span>
                    <p className="text-lg font-black text-indigo-400">
                      {phqAnswers.reduce((a, b) => a + b, 0)} / 27 คะแนน
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold">
                    {phqAnswers.reduce((a, b) => a + b, 0) < 5 ? 'ระดับปกติ' :
                     phqAnswers.reduce((a, b) => a + b, 0) < 10 ? 'ระดับเล็กน้อย' :
                     phqAnswers.reduce((a, b) => a + b, 0) < 15 ? 'ระดับปานกลาง' : 'ระดับรุนแรง'}
                  </span>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow transition-all cursor-pointer"
                >
                  บันทึกผลการประเมิน PHQ-9
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'sdq' && (
        <div className="space-y-6">
          {/* SDQ 3-Perspective Comparison View */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-md shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-purple-400" />
                  การประเมินพฤติกรรมและอารมณ์เด็ก (SDQ) ครบ 3 มุมมอง
                </h3>
                <p className="text-[11px] text-slate-400">
                  Strengths and Difficulties Questionnaire: ประเมินร่วมกันระหว่าง นักเรียน, ครูประจำชั้น, และผู้ปกครอง
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSdqEvaluator('STUDENT')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    sdqEvaluator === 'STUDENT' ? 'bg-purple-500/20 border-purple-500 text-purple-300' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  นักเรียน
                </button>
                <button
                  onClick={() => setSdqEvaluator('TEACHER')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    sdqEvaluator === 'TEACHER' ? 'bg-purple-500/20 border-purple-500 text-purple-300' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  ครูประจำชั้น
                </button>
                <button
                  onClick={() => setSdqEvaluator('PARENT')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    sdqEvaluator === 'PARENT' ? 'bg-purple-500/20 border-purple-500 text-purple-300' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  ผู้ปกครอง
                </button>
              </div>
            </div>

            {/* 3 Columns for Student, Teacher, Parent */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {studentSDQs.map((sdq) => (
                <div
                  key={sdq.id}
                  className="bg-slate-800/40 border border-slate-800 rounded-2xl p-4 space-y-3.5 hover:border-purple-500/30 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      sdq.evaluatorType === 'STUDENT' ? 'bg-blue-500/20 text-blue-300' :
                      sdq.evaluatorType === 'TEACHER' ? 'bg-emerald-500/20 text-emerald-300' :
                      'bg-amber-500/20 text-amber-300'
                    }`}>
                      {sdq.evaluatorType === 'STUDENT' ? 'มุมมองนักเรียน' :
                       sdq.evaluatorType === 'TEACHER' ? 'มุมมองครู' : 'มุมมองผู้ปกครอง'}
                    </span>
                    <span className="text-[10px] text-slate-400">{sdq.assessmentDate}</span>
                  </div>

                  <h4 className="text-xs font-bold text-slate-200 truncate">{sdq.evaluatorName}</h4>

                  {/* Subscale Progress Bars */}
                  <div className="space-y-2 text-xs">
                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-slate-400">1. ด้านอารมณ์ (Emotional)</span>
                        <span className="font-bold text-slate-200">{sdq.subscaleScores.emotional}/10</span>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-1.5">
                        <div className="bg-purple-500 h-full rounded-full" style={{ width: `${sdq.subscaleScores.emotional * 10}%` }}></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-slate-400">2. ด้านความประพฤติ (Conduct)</span>
                        <span className="font-bold text-slate-200">{sdq.subscaleScores.conduct}/10</span>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-1.5">
                        <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${sdq.subscaleScores.conduct * 10}%` }}></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-slate-400">3. ด้านสมาธิสั้น (Hyperactivity)</span>
                        <span className="font-bold text-slate-200">{sdq.subscaleScores.hyperactivity}/10</span>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-1.5">
                        <div className="bg-blue-500 h-full rounded-full" style={{ width: `${sdq.subscaleScores.hyperactivity * 10}%` }}></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-slate-400">4. ด้านเพื่อน (Peer Problems)</span>
                        <span className="font-bold text-slate-200">{sdq.subscaleScores.peerProblems}/10</span>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-1.5">
                        <div className="bg-teal-500 h-full rounded-full" style={{ width: `${sdq.subscaleScores.peerProblems * 10}%` }}></div>
                      </div>
                    </div>

                    <div className="pt-1">
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-emerald-400 font-bold">5. จุดแข็งทางสังคม (Prosocial)</span>
                        <span className="font-bold text-emerald-400">{sdq.subscaleScores.prosocial}/10</span>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-1.5">
                        <div className="bg-emerald-400 h-full rounded-full" style={{ width: `${sdq.subscaleScores.prosocial * 10}%` }}></div>
                      </div>
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800 text-[11px] space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">คะแนนปัญหารวม:</span>
                      <span className="font-extrabold text-white">{sdq.totalDifficultiesScore}/40</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">ผลการคัดกรอง:</span>
                      <span className="text-emerald-400 font-bold">✅ ปกติ (Normal)</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Interactive SDQ Save */}
            <div className="bg-slate-800/30 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-purple-400 shrink-0" />
                <p className="text-xs text-slate-300">
                  ต้องการปรับปรุงหรือบันทึกผลการประเมิน SDQ เพิ่มเติมในบทบาท <span className="font-bold text-purple-300">{sdqEvaluator}</span>
                </p>
              </div>
              <button
                onClick={handleSaveSDQ}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all shadow cursor-pointer shrink-0"
              >
                บันทึกการประเมิน SDQ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
