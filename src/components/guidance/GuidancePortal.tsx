import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '../../store';
import { useRealStudents } from '../../hooks/useRealStudents';
import { useGuidanceScreenings } from '../../hooks/useGuidanceScreenings';
import { PHQ9Screening, TwoQuestionScreening, GuidanceCounselingCase } from '../../types';
import {
  createGuidanceCounselingCase,
  subscribeGuidanceCounselingCases,
  updateGuidanceCounselingCaseStatus
} from '../../services/firestoreService';
import {
  HeartHandshake,
  Users,
  FileText,
  CheckCircle,
  Clock,
  Search,
  Plus,
  ShieldAlert,
  Award,
  Sparkles,
  Calendar,
  AlertTriangle
} from 'lucide-react';

export function GuidancePortal() {
  const user = useStore(s => s.user);
  const { students } = useRealStudents(); // นักเรียนจาก Firestore สด
  // ผลคัดกรอง 2Q/PHQ-9/SDQ สด real-time — แทนตัวเลขที่เคย hardcode ไว้ทั้งหมดในแท็บ "sdq"
  const { twoQuestionScreenings, phq9Screenings, sdqAssessments, loading: screeningsLoading } = useGuidanceScreenings();
  const [activeTab, setActiveTab] = useState<'cases' | 'sdq' | 'tcas'>('cases');
  const [searchTerm, setSearchTerm] = useState('');

  // สรุปผลคัดกรองสุขภาพจิตจากข้อมูลจริง (แทนตัวเลข hardcode เดิม 780/49/15 คน)
  // เกณฑ์ "กลุ่มเสี่ยง": PHQ-9 riskLevel ตั้งแต่ MODERATE ขึ้นไป (คะแนน ≥10 ตามมาตรฐานกรมสุขภาพจิต
  // ที่คำนวณไว้แล้วตอนบันทึกใน store.ts savePHQ9Screening — MILD ถือเป็น "เฝ้าระวัง" ไม่ใช่กลุ่มเสี่ยง)
  // หรือ 2Q เป็นบวก (isPositive) หรือ SDQ triagingStatus ไม่ใช่ NORMAL (เอาผลแย่สุดต่อคนถ้ามีหลายผู้ประเมิน)
  const screeningSummary = useMemo(() => {
    const sdqWorstByStudent = new Map<string, 'NORMAL' | 'AT_RISK' | 'VULNERABLE'>();
    const severityRank: Record<string, number> = { NORMAL: 0, AT_RISK: 1, VULNERABLE: 2 };
    for (const sdq of sdqAssessments) {
      const current = sdqWorstByStudent.get(sdq.studentId) || 'NORMAL';
      if (severityRank[sdq.triagingStatus] > severityRank[current]) {
        sdqWorstByStudent.set(sdq.studentId, sdq.triagingStatus);
      }
    }

    const phq9ByStudent = new Map<string, PHQ9Screening>(phq9Screenings.map(p => [p.studentId, p]));
    const twoQByStudent = new Map<string, TwoQuestionScreening>(twoQuestionScreenings.map(q => [q.studentId, q]));

    // รวมรายชื่อนักเรียนทุกคนที่มีผลคัดกรองอย่างน้อย 1 ชุด (ไม่ใช่แค่คนที่อยู่ใน students[] สด
    // เผื่อ listener นักเรียนยังไม่โหลด — ยังโชว์ผลคัดกรองได้ แค่ไม่มีชื่อเต็ม/ห้องประกอบ)
    const allScreenedIds = new Set<string>([
      ...phq9ByStudent.keys(),
      ...twoQByStudent.keys(),
      ...sdqWorstByStudent.keys(),
    ]);

    const atRiskList = Array.from(allScreenedIds).map(studentId => {
      const phq9 = phq9ByStudent.get(studentId);
      const twoQ = twoQByStudent.get(studentId);
      const sdqWorst = sdqWorstByStudent.get(studentId) || 'NORMAL';
      const phq9AtRisk = !!phq9 && ['MODERATE', 'SEVERE', 'VERY_SEVERE'].includes(phq9.riskLevel);
      const isAtRisk = phq9AtRisk || !!twoQ?.isPositive || sdqWorst === 'VULNERABLE' || sdqWorst === 'AT_RISK';
      const student = students.find(s => s.studentId === studentId);
      return { studentId, student, phq9, twoQ, sdqWorst, isAtRisk, phq9AtRisk };
    }).filter(r => r.isAtRisk).sort((a, b) => (b.phq9?.totalScore || 0) - (a.phq9?.totalScore || 0));

    const sdqCounts = { NORMAL: 0, AT_RISK: 0, VULNERABLE: 0 };
    for (const status of sdqWorstByStudent.values()) sdqCounts[status]++;
    const sdqScreenedTotal = sdqWorstByStudent.size;

    return { atRiskList, sdqCounts, sdqScreenedTotal, totalStudents: students.length };
  }, [phq9Screenings, twoQuestionScreenings, sdqAssessments, students]);

  // เคสให้คำปรึกษา — real-time จาก Firestore (guidance_counseling_cases) แทน useState mock เดิม
  // ข้อมูลอ่อนไหวที่สุดในระบบ (เนื้อหาการปรึกษาจิตวิทยาของผู้เยาว์) — rules อ่าน/เขียนได้เฉพาะ
  // GUIDANCE_COUNSELOR/SUPER_ADMIN เท่านั้น role อื่นทั้งหมดจะได้ list ว่างจาก listener error
  const [cases, setCases] = useState<GuidanceCounselingCase[]>([]);
  const [casesLoading, setCasesLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeGuidanceCounselingCases((list) => {
      setCases(list);
      setCasesLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const [showAddCaseModal, setShowAddCaseModal] = useState(false);
  const [newStudentId, setNewStudentId] = useState(students[0]?.studentId || '');
  const [newIssue, setNewIssue] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newSeverity, setNewSeverity] = useState<'LOW' | 'MODERATE' | 'HIGH'>('MODERATE');
  const [isSavingCase, setIsSavingCase] = useState(false);
  const [addCaseError, setAddCaseError] = useState<string | null>(null);

  const handleAddCase = async (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveStudentId = newStudentId || students[0]?.studentId || '';
    const st = students.find(s => s.studentId === effectiveStudentId);
    if (!user?.uid) {
      setAddCaseError('ไม่พบบัญชีผู้ใช้ที่ล็อกอินอยู่ กรุณาเข้าสู่ระบบใหม่ก่อนบันทึกเคส');
      return;
    }
    setIsSavingCase(true);
    setAddCaseError(null);
    try {
      await createGuidanceCounselingCase({
        studentId: effectiveStudentId,
        studentName: st?.fullName || 'ไม่ระบุชื่อ',
        classRoom: st?.room || 'ไม่ระบุห้อง',
        category: newIssue,
        notes: newNotes,
        severity: newSeverity,
        counselorUid: user.uid,
        counselorName: user.displayName || user.email || 'ครูแนะแนว',
      });
      setShowAddCaseModal(false);
      setNewIssue('');
      setNewNotes('');
    } catch (err) {
      console.error('[GuidancePortal] createGuidanceCounselingCase failed:', err);
      setAddCaseError('บันทึกเคสไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSavingCase(false);
    }
  };

  const handleResolveCase = async (caseId: string) => {
    try {
      await updateGuidanceCounselingCaseStatus(caseId, 'RESOLVED');
    } catch (err) {
      console.error('[GuidancePortal] updateGuidanceCounselingCaseStatus failed:', err);
    }
  };

  return (
    <div className="flex-1 bg-slate-950 text-slate-100 flex flex-col min-h-screen">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-purple-950/60 via-slate-900 to-slate-900 border-b border-purple-500/20 px-6 py-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-500/20 border border-purple-500/30 rounded-2xl text-purple-400 shadow-lg">
              <HeartHandshake className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">งานแนะแนวและจิตวิทยาการปรึกษา</h1>
                <span className="px-2 py-0.5 bg-purple-500/20 border border-purple-500/30 text-purple-300 text-[10px] font-bold rounded-md">
                  Guidance & Counseling Portal
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                ระบบให้คำปรึกษาเชิงจิตวิทยา คัดกรอง SDQ/EQ ทุนการศึกษา และระบบ TCAS พอร์ตโฟลิโอนักเรียน
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowAddCaseModal(true)}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-lg transition-all cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            เปิดเคสให้คำปรึกษาใหม่
          </button>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="max-w-7xl w-full mx-auto px-6 pt-6">
        <div className="flex border-b border-slate-800 gap-6">
          <button
            onClick={() => setActiveTab('cases')}
            className={`pb-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'cases' ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>เคสให้คำปรึกษาและสุขภาพจิต ({cases.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('sdq')}
            className={`pb-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'sdq' ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>ผลประเมิน SDQ และ EQ นักเรียน</span>
          </button>
          <button
            onClick={() => setActiveTab('tcas')}
            className={`pb-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'tcas' ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>ระบบแนะแนวอาชีพและ TCAS พอร์ตโฟลิโอ</span>
          </button>
        </div>
      </div>

      {/* Content Body */}
      <div className="max-w-7xl w-full mx-auto px-6 py-6 flex-1 space-y-6">
        
        {/* TAB 1: COUNSELING CASES */}
        {activeTab === 'cases' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">บันทึกเคสให้คำปรึกษาและติดตามพฤติกรรมรายบุคคล</h3>
                <p className="text-xs text-slate-400">รักษาความลับตามจรรยาบรรณวิชาชีพครูแนะแนว</p>
              </div>
            </div>

            {casesLoading ? (
              <div className="text-center py-8 text-slate-500 text-xs">กำลังโหลดข้อมูลเคส...</div>
            ) : cases.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">ยังไม่มีเคสให้คำปรึกษาที่บันทึกไว้</div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {cases.map((c) => (
                  <div key={c.id} className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-300 text-[10px] font-semibold rounded border border-indigo-500/20">
                          {c.classRoom}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">อัปเดตล่าสุด: {c.lastSessionDate}</span>
                      </div>
                      <h4 className="text-sm font-bold text-white">{c.studentName} (ID: {c.studentId})</h4>
                      <p className="text-xs text-slate-300"><span className="font-semibold text-white">ประเด็นให้คำปรึกษา:</span> {c.category}</p>
                      {c.notes && (
                        <p className="text-xs text-slate-400"><span className="font-semibold text-slate-300">บันทึก:</span> {c.notes}</p>
                      )}
                      <p className="text-xs text-slate-400">ผู้ให้คำปรึกษา: <span className="text-white">{c.counselorName}</span></p>
                    </div>

                    <div className="flex items-center gap-3">
                      {c.status === 'RESOLVED' ? (
                        <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-bold inline-flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> เคสสิ้นสุด/ยุติแล้ว
                        </span>
                      ) : (
                        <>
                          <span className="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl text-xs font-bold inline-flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" /> อยู่ระหว่างดูแลต่อเนื่อง
                          </span>
                          <button
                            onClick={() => handleResolveCase(c.id)}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                          >
                            ปิดเคส
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SDQ & EQ SCREENING */}
        {activeTab === 'sdq' && (
          <div className="space-y-4">
            <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-base font-bold text-white">สถิติการคัดกรองสุขภาพจิตนักเรียน (SDQ) ประจำปีการศึกษา 2569</h3>
                  <p className="text-xs text-slate-400">
                    ข้อมูลจริงแบบเรียลไทม์จากนักเรียน {screeningSummary.sdqScreenedTotal} / {screeningSummary.totalStudents} คน ที่ทำแบบประเมิน SDQ แล้ว
                  </p>
                </div>
                {screeningsLoading && (
                  <span className="text-[10px] text-slate-500 font-mono">กำลังโหลดข้อมูลสด...</span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <span className="text-xs text-slate-400 block font-medium">กลุ่มปกติ (Normal Range)</span>
                  <p className="text-2xl font-black font-mono text-emerald-400">
                    {screeningSummary.sdqScreenedTotal > 0
                      ? `${((screeningSummary.sdqCounts.NORMAL / screeningSummary.sdqScreenedTotal) * 100).toFixed(1)}%`
                      : '—'}
                  </p>
                  <span className="text-[10px] text-emerald-400">นักเรียน {screeningSummary.sdqCounts.NORMAL} คน</span>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <span className="text-xs text-slate-400 block font-medium">กลุ่มเสี่ยง (At Risk)</span>
                  <p className="text-2xl font-black font-mono text-amber-400">
                    {screeningSummary.sdqScreenedTotal > 0
                      ? `${((screeningSummary.sdqCounts.AT_RISK / screeningSummary.sdqScreenedTotal) * 100).toFixed(1)}%`
                      : '—'}
                  </p>
                  <span className="text-[10px] text-amber-400">นักเรียน {screeningSummary.sdqCounts.AT_RISK} คน (อยู่ในความดูแล)</span>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <span className="text-xs text-slate-400 block font-medium">กลุ่มมีปัญหา (Vulnerable)</span>
                  <p className="text-2xl font-black font-mono text-rose-400">
                    {screeningSummary.sdqScreenedTotal > 0
                      ? `${((screeningSummary.sdqCounts.VULNERABLE / screeningSummary.sdqScreenedTotal) * 100).toFixed(1)}%`
                      : '—'}
                  </p>
                  <span className="text-[10px] text-rose-400">นักเรียน {screeningSummary.sdqCounts.VULNERABLE} คน (ส่งต่อจิตแพทย์เด็กและวัยรุ่น)</span>
                </div>
              </div>
            </div>

            {/* รายชื่อนักเรียนกลุ่มเสี่ยงจาก PHQ-9 / 2Q / SDQ — ต้องเห็นทันทีที่มีการส่งแบบประเมินใหม่ */}
            <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <h3 className="text-base font-bold text-white">รายชื่อนักเรียนกลุ่มเสี่ยงที่ต้องติดตาม ({screeningSummary.atRiskList.length} คน)</h3>
              </div>
              <p className="text-xs text-slate-400">
                เกณฑ์: PHQ-9 ระดับปานกลางขึ้นไป (คะแนน ≥10) หรือผลคัดกรอง 2Q เป็นบวก หรือ SDQ อยู่ในกลุ่มเสี่ยง/มีปัญหา —
                กรุณาให้ครูแนะแนวยืนยันความถูกต้องของเกณฑ์นี้อีกครั้งตามมาตรฐานที่โรงเรียนใช้จริง
              </p>

              {screeningSummary.atRiskList.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">ยังไม่มีนักเรียนที่เข้าเกณฑ์กลุ่มเสี่ยงในขณะนี้</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="pb-2 font-medium">นักเรียน</th>
                        <th className="pb-2 font-medium">PHQ-9</th>
                        <th className="pb-2 font-medium">2Q</th>
                        <th className="pb-2 font-medium">SDQ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {screeningSummary.atRiskList.map((row) => (
                        <tr key={row.studentId} className="hover:bg-slate-800/30">
                          <td className="py-2.5">
                            <p className="font-bold text-white">{row.student?.fullName || `รหัส ${row.studentId}`}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{row.student?.room || ''} · ID: {row.studentId}</p>
                          </td>
                          <td className="py-2.5">
                            {row.phq9 ? (
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                row.phq9AtRisk ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-slate-800 text-slate-300'
                              }`}>
                                {row.phq9.totalScore}/27 ({row.phq9.riskLevel})
                              </span>
                            ) : <span className="text-slate-600">—</span>}
                          </td>
                          <td className="py-2.5">
                            {row.twoQ ? (
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                row.twoQ.isPositive ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-slate-800 text-slate-300'
                              }`}>
                                {row.twoQ.isPositive ? 'มีความเสี่ยง' : 'ปกติ'}
                              </span>
                            ) : <span className="text-slate-600">—</span>}
                          </td>
                          <td className="py-2.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              row.sdqWorst === 'VULNERABLE' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                              row.sdqWorst === 'AT_RISK' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                              'bg-slate-800 text-slate-300'
                            }`}>
                              {row.sdqWorst}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: TCAS & PORTFOLIO */}
        {activeTab === 'tcas' && (
          <div className="space-y-4">
            <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
              <h3 className="text-base font-bold text-white">ระบบแนะแนวศึกษาต่อและเตรียมพอร์ตโฟลิโอ (TCAS Portfolio)</h3>
              <p className="text-xs text-slate-400">ติดตามความพร้อมของนักเรียนระดับชั้น ม.6 ในการสมัครเข้ามหาวิทยาลัยผ่านรอบที่ 1 (Portfolio)</p>

              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white">เป้าหมายยอดสมัคร TCAS รอบที่ 1 ปี 2569</span>
                  <span className="text-xs text-purple-400 font-mono font-bold">ส่งพอร์ตแล้ว 125 คน</span>
                </div>
                <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden">
                  <div className="bg-purple-500 h-full w-[78%]"></div>
                </div>
                <span className="text-xs text-slate-400">นักเรียนผ่านการตรวจรับรองผลงานจากครูแนะแนวแล้ว 78%</span>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ADD CASE MODAL */}
      {showAddCaseModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <HeartHandshake className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-white">เปิดเคสให้คำปรึกษาใหม่</h3>
              </div>
              <button 
                onClick={() => setShowAddCaseModal(false)}
                className="text-slate-400 hover:text-white text-sm font-bold px-2 py-1 bg-slate-800 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddCase} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">เลือกนักเรียน</label>
                <select
                  value={newStudentId || students[0]?.studentId || ''}
                  onChange={(e) => setNewStudentId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                >
                  {students.length === 0 && <option value="">— ยังไม่มีข้อมูลนักเรียน —</option>}
                  {students.map(s => (
                    <option key={s.studentId} value={s.studentId}>{s.fullName} ({s.studentId})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">ประเด็นปัญหา / อาการสำคัญ</label>
                <input
                  type="text"
                  required
                  value={newIssue}
                  onChange={(e) => setNewIssue(e.target.value)}
                  placeholder="เช่น ความเครียดเรื่องเกรดเฉลี่ย / ปัญหาครอบครัว"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">บันทึกรายละเอียดการให้คำปรึกษา (Notes)</label>
                <textarea
                  required
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  rows={3}
                  placeholder="รายละเอียดการพูดคุย ข้อสังเกต แผนการติดตาม ฯลฯ"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">ระดับความรุนแรง</label>
                <select
                  value={newSeverity}
                  onChange={(e: any) => setNewSeverity(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="LOW">ระดับเล็กน้อย (Low)</option>
                  <option value="MODERATE">ระดับปานกลาง (Moderate)</option>
                  <option value="HIGH">ระดับสูง/เร่งด่วน (High Risk)</option>
                </select>
              </div>

              {addCaseError && (
                <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2">{addCaseError}</p>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddCaseModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSavingCase}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold"
                >
                  {isSavingCase ? 'กำลังบันทึก...' : 'บันทึกเปิดเคส'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
