import React, { useState } from 'react';
import { useStore } from '../../store';
import { useRealStudents } from '../../hooks/useRealStudents';
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
  Calendar 
} from 'lucide-react';

export function GuidancePortal() {
  const { sdqAssessments } = useStore();
  const { students } = useRealStudents(); // นักเรียนจาก Firestore สด
  const [activeTab, setActiveTab] = useState<'cases' | 'sdq' | 'tcas'>('cases');
  const [searchTerm, setSearchTerm] = useState('');

  // Counseling cases state (mock)
  const [cases, setCases] = useState([
    {
      id: 'CS-001',
      studentId: '6950801',
      studentName: 'เด็กชาย กิตติคุณ สถิตการุณย์',
      classRoom: 'ม.5/8',
      issueType: 'ความเครียดจากการเรียนและสอบเข้ามหาวิทยาลัย',
      severity: 'MODERATE',
      status: 'IN_PROGRESS',
      counselorName: 'ดร.สุดา จิตวิทยา',
      lastSessionDate: '2026-08-18'
    },
    {
      id: 'CS-002',
      studentId: '6950805',
      studentName: 'เด็กชาย ธน ภูมิภาค',
      classRoom: 'ม.5/8',
      issueType: 'ปัญหาการปรับตัวกับเพื่อนร่วมชั้น',
      severity: 'LOW',
      status: 'RESOLVED',
      counselorName: 'ดร.สุดา จิตวิทยา',
      lastSessionDate: '2026-08-10'
    }
  ]);

  const [showAddCaseModal, setShowAddCaseModal] = useState(false);
  const [newStudentId, setNewStudentId] = useState(students[0]?.studentId || '');
  const [newIssue, setNewIssue] = useState('');
  const [newSeverity, setNewSeverity] = useState<'LOW' | 'MODERATE' | 'HIGH'>('MODERATE');

  const handleAddCase = (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveStudentId = newStudentId || students[0]?.studentId || '';
    const st = students.find(s => s.studentId === effectiveStudentId);
    const newC = {
      id: `CS-00${cases.length + 1}`,
      studentId: effectiveStudentId,
      studentName: st?.fullName || 'ไม่ระบุชื่อ',
      classRoom: st?.room || 'ม.5/8',
      issueType: newIssue,
      severity: newSeverity,
      status: 'IN_PROGRESS' as const,
      counselorName: 'ดร.สุดา จิตวิทยา',
      lastSessionDate: new Date().toISOString().split('T')[0]
    };
    setCases([newC, ...cases]);
    setShowAddCaseModal(false);
    setNewIssue('');
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

            <div className="grid grid-cols-1 gap-4">
              {cases.map((c) => (
                <div key={c.id} className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-slate-800 text-purple-400 text-[10px] font-mono rounded font-bold">
                        {c.id}
                      </span>
                      <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-300 text-[10px] font-semibold rounded border border-indigo-500/20">
                        {c.classRoom}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">อัปเดตล่าสุด: {c.lastSessionDate}</span>
                    </div>
                    <h4 className="text-sm font-bold text-white">{c.studentName} (ID: {c.studentId})</h4>
                    <p className="text-xs text-slate-300"><span className="font-semibold text-white">ประเด็นให้คำปรึกษา:</span> {c.issueType}</p>
                    <p className="text-xs text-slate-400">ผู้ให้คำปรึกษา: <span className="text-white">{c.counselorName}</span></p>
                  </div>

                  <div className="flex items-center gap-3">
                    {c.status === 'RESOLVED' ? (
                      <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-bold inline-flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> เคสสิ้นสุด/ยุติแล้ว
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl text-xs font-bold inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> อยู่ระหว่างดูแลต่อเนื่อง
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: SDQ & EQ SCREENING */}
        {activeTab === 'sdq' && (
          <div className="space-y-4">
            <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
              <h3 className="text-base font-bold text-white">สถิติการคัดกรองสุขภาพจิตนักเรียน (SDQ & EQ) ประจำปีการศึกษา 2569</h3>
              <p className="text-xs text-slate-400">ผลการประเมินจากนักเรียน ผู้ปกครอง และครูที่ปรึกษา</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <span className="text-xs text-slate-400 block font-medium">กลุ่มปกติ (Normal Range)</span>
                  <p className="text-2xl font-black font-mono text-emerald-400">92.4%</p>
                  <span className="text-[10px] text-emerald-400">นักเรียน 780 คน</span>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <span className="text-xs text-slate-400 block font-medium">กลุ่มเสี่ยง (Borderline)</span>
                  <p className="text-2xl font-black font-mono text-amber-400">5.8%</p>
                  <span className="text-[10px] text-amber-400">นักเรียน 49 คน (อยู่ในความดูแล)</span>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <span className="text-xs text-slate-400 block font-medium">กลุ่มมีปัญหา (Abnormal)</span>
                  <p className="text-2xl font-black font-mono text-rose-400">1.8%</p>
                  <span className="text-[10px] text-rose-400">นักเรียน 15 คน (ส่งต่อจิตแพทย์เด็กและวัยรุ่น)</span>
                </div>
              </div>
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
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold"
                >
                  บันทึกเปิดเคส
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
