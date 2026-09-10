import React, { useEffect, useState } from 'react';
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
import { acknowledgeInfirmaryVisit, subscribeInfirmaryVisits, subscribeSDQAssessments, subscribeSemesterHealthLogs } from '../../services/firestoreService';
import { useCurrentSemester } from '../../hooks/useCurrentSemester';
import { BMI_CATEGORY_LABEL } from '../../lib/utils';
import { SemesterHealthSelfReportForm } from './SemesterHealthSelfReportForm';
import {
  InfirmaryVisit,
  TwoQuestionScreening,
  PHQ9Screening,
  SDQAssessment,
  SemesterHealthLog,
  Student
} from '../../types';

export function HealthMentalWellbeingModule({
  studentId,
  student: studentProp,
  isParentView = false
}: { studentId: string; student?: Student; isParentView?: boolean }) {
  const user = useStore(s => s.user);
  const {
    chronicIllnesses,
    allergies,
    specialCareNeeds,
    twoQuestionScreenings,
    phq9Screenings,
    save2QScreening,
    savePHQ9Screening,
    submitSDQAssessment,
    students
  } = useStore();

  // บันทึกห้องพยาบาล — real-time จาก Firestore (infirmary_visits) แหล่งเดียวกับที่ InfirmaryPortal.tsx
  // เขียน (เดิมอ่านจาก state.infirmaryVisits ของ Zustand ซึ่งไม่เคยมี listener ผูกไว้เลย จึงว่างเปล่า
  // เสมอไม่ว่า InfirmaryPortal จะบันทึกอะไรก็ตาม) — filter ตาม role: ผู้ปกครองกรองด้วย parentUid
  // ของตัวเอง, นักเรียนกรองด้วย studentUid ของตัวเอง (ต้อง filter ฝั่ง query ให้ผ่าน firestore.rules)
  const [infirmaryVisits, setInfirmaryVisits] = useState<InfirmaryVisit[]>([]);
  useEffect(() => {
    if (!user?.uid) { setInfirmaryVisits([]); return; }
    const unsubscribe = subscribeInfirmaryVisits(
      setInfirmaryVisits,
      isParentView ? { parentUid: user.uid } : { studentUid: user.uid }
    );
    return () => unsubscribe();
  }, [user?.uid, isParentView]);

  // ผลประเมิน SDQ — real-time เช่นกัน แทน state.sdqAssessments ของ Zustand (ไม่เคยมี listener ผูกไว้)
  // นักเรียนเจ้าของเห็นครบ 3 มุมมอง (studentUid==ตัวเอง); ผู้ปกครองเห็นเฉพาะรายการที่ตัวเองกรอกเอง
  // (rules ยังไม่เปิดให้เห็นมุมมองอื่นของครอบครัวเดียวกัน — ดูคำอธิบาย scope ในคำตอบ)
  const [sdqAssessments, setSdqAssessments] = useState<SDQAssessment[]>([]);
  useEffect(() => {
    if (!user?.uid) { setSdqAssessments([]); return; }
    const unsubscribe = subscribeSDQAssessments(
      setSdqAssessments,
      isParentView ? { respondentUid: user.uid } : { studentUid: user.uid }
    );
    return () => unsubscribe();
  }, [user?.uid, isParentView]);

  // น้ำหนัก/ส่วนสูงรายภาคเรียน — real-time จาก Firestore (student_semester_health) แทนตัวเลข mock
  // ตายตัวเดิม (175cm/65kg). นักเรียนกรอกเอง (ยืนยันจากโรงเรียน) — ดู SemesterHealthSelfReportForm
  const currentSemester = useCurrentSemester();
  const [semHealthLogs, setSemHealthLogs] = useState<SemesterHealthLog[]>([]);
  useEffect(() => {
    if (!user?.uid) { setSemHealthLogs([]); return; }
    const unsubscribe = subscribeSemesterHealthLogs(
      setSemHealthLogs,
      isParentView ? { parentUid: user.uid } : { studentUid: user.uid }
    );
    return () => unsubscribe();
  }, [user?.uid, isParentView]);

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
  // ใช้ student ของจริงที่ผู้เรียก (StudentPortal/ParentPortal) ดึงมาจาก useRealStudents() ถ้าส่งมาให้
  // แทนการค้นจาก state.students ของ Zustand (session-local ไม่เคยมี listener ผูกไว้ — ค่า studentUid/
  // parentUid ที่ต้องใช้ยืนยันตัวตนตอนเขียน Firestore จริงจะไม่มีวันครบถ้วนถ้าพึ่ง state นี้)
  const student = studentProp || students.find(s => s.studentId === studentId) || students[0] || defaultStudent;
  // เฉพาะของนักเรียนคนนี้ (listener filter ด้วย studentUid/parentUid ของผู้ใช้อยู่แล้ว แต่ผู้ปกครอง
  // ที่มีบุตรหลานหลายคนจะได้หลาย record — กรองตาม studentId ที่กำลังดูอีกชั้น) เรียงเก่า→ใหม่
  const healthLogs = semHealthLogs.filter(l => l.studentId === student.studentId);
  const currentSemHealth = healthLogs.find(
    l => l.academicYear === currentSemester.academicYear && l.term === currentSemester.term
  ) || null;
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
  const [saved2QError, setSaved2QError] = useState<string | null>(null);
  const [savedPHQError, setSavedPHQError] = useState<string | null>(null);
  const [sdqSubmitError, setSdqSubmitError] = useState<string | null>(null);

  // ตัวเลขล่าสุดจาก Firestore จริง — ไม่มี fallback mock อีกต่อไป (null = ยังไม่เคยกรอก → แสดง empty state)
  const latestHealth: SemesterHealthLog | null = healthLogs[healthLogs.length - 1] || null;
  const canSelfReport = !isParentView && !!user?.uid && !!student.studentUid && student.studentUid === user.uid;

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

  // ทั้ง 3 handler ด้านล่างนี้ await การเขียน Firestore จริงก่อนแสดง "บันทึกสำเร็จ" เสมอ (เดิม fire-
  // and-forget แสดงสำเร็จทันทีไม่ว่า Firestore จะรับจริงหรือไม่ — ดู savePHQ9Screening/save2QScreening/
  // submitSDQAssessment ใน store.ts ที่แก้ให้ throw error ต่อแทนการกลืนเงียบๆ)
  const handleSave2Q = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaved2QError(null);
    try {
      await save2QScreening(student.studentId, q1, q2);
      setSaved2QSuccess(true);
      setTimeout(() => setSaved2QSuccess(false), 3000);
    } catch (err) {
      console.error('[HealthMentalWellbeingModule] save2QScreening failed:', err);
      setSaved2QError('บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    }
  };

  const handleSavePHQ9 = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavedPHQError(null);
    try {
      await savePHQ9Screening(student.studentId, phqAnswers);
      setSavedPHQSuccess(true);
      setTimeout(() => setSavedPHQSuccess(false), 3000);
    } catch (err) {
      console.error('[HealthMentalWellbeingModule] savePHQ9Screening failed:', err);
      setSavedPHQError('บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    }
  };

  const handleSaveSDQ = async (e: React.FormEvent) => {
    e.preventDefault();
    setSdqSubmitError(null);
    if (!user?.uid) {
      setSdqSubmitError('ไม่พบบัญชีผู้ใช้ที่ล็อกอินอยู่ กรุณาเข้าสู่ระบบใหม่ก่อนบันทึก');
      return;
    }
    const totalDifficulties = sdqScores.emotional + sdqScores.conduct + sdqScores.hyperactivity + sdqScores.peerProblems;
    let triagingStatus: SDQAssessment['triagingStatus'] = 'NORMAL';
    if (totalDifficulties >= 17) triagingStatus = 'VULNERABLE';
    else if (totalDifficulties >= 14) triagingStatus = 'AT_RISK';

    try {
      await submitSDQAssessment({
        studentId: student.studentId,
        // studentUid ต้องเป็นค่าจริงของ "นักเรียน" คนนี้เสมอไม่ว่าใครเป็นคนกรอก (rules ตรวจสอบกับ
        // students/{studentId}.studentUid จริง) — ตอนนักเรียนกรอกเอง ใช้ user.uid ตรงๆ ได้เลยเพราะ
        // เป็นคนคนเดียวกัน (ไม่พึ่ง student.studentUid ที่อาจไม่ครบถ้วนจาก state.students เดิม)
        studentUid: sdqEvaluator === 'STUDENT' ? user.uid : (student.studentUid || ''),
        respondentUid: user.uid,
        evaluatorType: sdqEvaluator,
        evaluatorName: sdqEvaluator === 'STUDENT' ? `${student.name} (ประเมินตนเอง)` :
                       sdqEvaluator === 'PARENT' ? (user.displayName || 'ผู้ปกครอง') :
                       (user.displayName || 'ครูที่ปรึกษา'),
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
    } catch (err) {
      console.error('[HealthMentalWellbeingModule] submitSDQAssessment failed:', err);
      setSdqSubmitError('บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง (ตรวจสอบว่าท่านมีสิทธิ์ประเมินนักเรียนคนนี้)');
    }
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
          {/* ฟอร์มให้นักเรียนกรอกน้ำหนัก/ส่วนสูงเอง ภาคเรียนละ 1 ครั้ง (ยืนยันจากโรงเรียน) */}
          {canSelfReport && student.studentUid && (
            <SemesterHealthSelfReportForm
              student={student}
              studentUid={student.studentUid}
              currentSemester={currentSemester}
              existing={currentSemHealth}
            />
          )}

          {/* Key Metric Cards — จากข้อมูลที่นักเรียนกรอกจริง (ไม่มี fallback mock) */}
          {latestHealth ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
              <span className="text-[11px] text-slate-400 block mb-1">ส่วนสูงล่าสุด</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-white">{latestHealth.height}</span>
                <span className="text-xs text-slate-400">ซม.</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">ภาคเรียน {latestHealth.semester}</span>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
              <span className="text-[11px] text-slate-400 block mb-1">น้ำหนักล่าสุด</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-white">{latestHealth.weight}</span>
                <span className="text-xs text-slate-400">กก.</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                บันทึกเมื่อ {new Date(latestHealth.recordedAt).toLocaleDateString('th-TH')}
              </span>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
              <span className="text-[11px] text-slate-400 block mb-1">ดัชนีมวลกาย (BMI)</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-emerald-400">{latestHealth.bmi}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                  {BMI_CATEGORY_LABEL[latestHealth.bmiCategory]}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">เกณฑ์สมส่วน 18.5 - 22.9</span>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
              <span className="text-[11px] text-slate-400 block mb-1">หมู่เลือด & ความดัน</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-bold text-white">{latestHealth.bloodType || '—'}</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                {latestHealth.systolicBp && latestHealth.diastolicBp
                  ? `BP: ${latestHealth.systolicBp}/${latestHealth.diastolicBp} mmHg`
                  : 'ยังไม่มีข้อมูลความดัน'}
              </span>
            </div>
          </div>
          ) : (
            <div className="border border-dashed border-slate-800 rounded-2xl p-6 text-center text-xs text-slate-500">
              {isParentView
                ? 'นักเรียนยังไม่ได้กรอกน้ำหนัก/ส่วนสูงของภาคเรียนนี้'
                : 'ยังไม่มีข้อมูลน้ำหนัก/ส่วนสูง — กรอกในแบบฟอร์มด้านบนเพื่อเริ่มบันทึก'}
            </div>
          )}

          {/* Historical Growth Chart & Health Conditions */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* BMI Trend Table */}
            <div className="lg:col-span-6 bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-md">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
                <Activity className="w-4 h-4 text-emerald-400" />
                ประวัติการเจริญเติบโตรายภาคเรียน (Growth Trends)
              </h3>
              <p className="text-[11px] text-slate-400 mb-4">นักเรียนกรอกเองรายภาคเรียน (พยาบาลบันทึกแทน/แก้ไขกรณีพิเศษ)</p>

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
                    {healthLogs.length === 0 ? (
                      <tr><td colSpan={5} className="py-4 text-center text-slate-500">ยังไม่มีบันทึก</td></tr>
                    ) : healthLogs.map((h) => (
                      <tr key={h.id} className="hover:bg-slate-800/30">
                        <td className="py-2.5 font-bold text-slate-200">{h.semester}</td>
                        <td className="py-2.5 text-slate-300">{h.height}</td>
                        <td className="py-2.5 text-slate-300">{h.weight}</td>
                        <td className="py-2.5 font-mono font-bold text-emerald-400">{h.bmi}</td>
                        <td className="py-2.5 text-right">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                            {BMI_CATEGORY_LABEL[h.bmiCategory]}
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

                  {/* rules อนุญาตให้แก้ parentAcknowledged ได้เฉพาะเจ้าของ parentUid เท่านั้น
                      (ดู firestore.rules match /infirmary_visits) — ซ่อนปุ่มนี้ในมุมมองนักเรียน */}
                  {!visit.parentAcknowledged && isParentView && (
                    <button
                      onClick={() => acknowledgeInfirmaryVisit(visit.id).catch(err =>
                        console.error('[HealthMentalWellbeingModule] acknowledgeInfirmaryVisit failed:', err)
                      )}
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
              {saved2QError && (
                <div className="p-3 mb-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{saved2QError}</span>
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
              {savedPHQError && (
                <div className="p-3 mb-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{savedPHQError}</span>
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
            <div className="bg-slate-800/30 border border-slate-800 rounded-2xl p-4 space-y-3">
              {sdqSubmitSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>บันทึกผลการประเมิน SDQ สำเร็จ</span>
                </div>
              )}
              {sdqSubmitError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{sdqSubmitError}</span>
                </div>
              )}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
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
        </div>
      )}
    </div>
  );
}
