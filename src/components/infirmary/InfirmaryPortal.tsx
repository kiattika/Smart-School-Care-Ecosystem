import React, { useEffect, useState } from 'react';
import { useStore } from '../../store';
import { useRealStudents } from '../../hooks/useRealStudents';
import { StudentPicker } from '../shared/StudentPicker';
import { PortalSidebarLayout } from '../shared/PortalSidebarLayout';
import {
  recordInfirmaryVisit as recordInfirmaryVisitFirestore,
  notifyParentOfInfirmaryVisit,
  subscribeInfirmaryVisits,
  subscribeInfirmaryMedicines,
  type InfirmaryMedicine,
} from '../../services/firestoreService';
import { InfirmaryStockPanel } from './InfirmaryStockPanel';
import { InfirmaryHealthProfilePanel } from './InfirmaryHealthProfilePanel';
import { InfirmaryEmergencyContactsPanel } from './InfirmaryEmergencyContactsPanel';
import { composeMedicationGiven, validateDispenseLines, type DispenseLine, isLowStock } from '../../lib/infirmaryStock';
import {
  HeartPulse,
  Activity,
  Pill,
  FileSpreadsheet,
  AlertTriangle,
  Search,
  Plus,
  CheckCircle,
  Clock,
  User,
  Calendar,
  ShieldAlert,
  Thermometer,
  Stethoscope,
  BarChart3,
  Droplets
} from 'lucide-react';
import { InfirmaryVisit, SemesterHealthRecord } from '../../types';
import { InfirmaryOverview } from './InfirmaryOverview';
import { InfirmaryHealthRecordsPanel } from './InfirmaryHealthRecordsPanel';
import { InfirmaryBloodDonationPanel } from './InfirmaryBloodDonationPanel';

export function InfirmaryPortal() {
  const user = useStore(s => s.user);
  const { students } = useRealStudents(); // นักเรียนจาก Firestore สด

  // บันทึกห้องพยาบาล — real-time จาก Firestore (infirmary_visits) แทน useState mock เดิม
  // ที่แยกขาดจาก field infirmaryVisits ของ Zustand store ที่ฝั่งผู้ปกครอง/นักเรียนอ่านอยู่
  const [infirmaryVisits, setInfirmaryVisits] = useState<InfirmaryVisit[]>([]);
  const [visitsLoading, setVisitsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeInfirmaryVisits((list) => {
      setInfirmaryVisits(list);
      setVisitsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const [isSavingVisit, setIsSavingVisit] = useState(false);
  const [recordVisitError, setRecordVisitError] = useState<string | null>(null);

  // ส่งแจ้งเตือนเข้าแอปผู้ปกครอง/นักเรียนจริง (parent_notifications) — ไม่มีบัญชีที่เชื่อมไว้จะแจ้ง error ตามจริง
  const [noticeBusyId, setNoticeBusyId] = useState<string | null>(null);
  const [noticeError, setNoticeError] = useState<{ id: string; msg: string } | null>(null);
  const sendInAppNotice = async (v: InfirmaryVisit) => {
    setNoticeBusyId(v.id);
    setNoticeError(null);
    try {
      const st = students.find(s => s.studentId === v.studentId);
      await notifyParentOfInfirmaryVisit(v, {
        studentName: st?.fullName || v.studentId,
        studentUid: v.studentUid ?? null,
        parentUid: v.parentUid ?? null,
        nurseName: user?.displayName || user?.email || 'เจ้าหน้าที่พยาบาล',
      });
    } catch (err: any) {
      console.error('[InfirmaryPortal] notifyParentOfInfirmaryVisit failed:', err);
      setNoticeError({ id: v.id, msg: err?.message === 'NO_RECIPIENT' ? 'นักเรียนคนนี้ยังไม่มีบัญชีผู้ปกครอง/นักเรียนที่เชื่อมไว้ จึงส่งแจ้งเตือนไม่ได้' : 'ส่งแจ้งเตือนไม่สำเร็จ ลองใหม่อีกครั้ง' });
    } finally {
      setNoticeBusyId(null);
    }
  };

  const [activeTab, setActiveTab] = useState<'overview' | 'visits' | 'inventory' | 'screening' | 'donation' | 'profiles'>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  // เฟส 2 shared components — TASK 2: เปลี่ยนไปใช้ StudentPicker กลาง ซึ่งไม่ auto-select นักเรียน
  // คนแรกให้ (ต้องพิมพ์ค้นหา/เลือกเองเสมอ) ตั้งใจเปลี่ยนพฤติกรรมเดิม — เดิม default เป็น students[0]
  // เคยเป็นสาเหตุบั๊ก state ค้างว่างเงียบๆ ที่เจอมาก่อน แต่ยิ่งไปกว่านั้น การ pre-fill นักเรียนคนแรกไว้
  // ในฟอร์ม "บันทึกการรักษา" ก็เป็นความเสี่ยงด้านความปลอดภัย (พยาบาลอาจกดบันทึกโดยลืมเปลี่ยนคนไข้)
  // ให้เริ่มว่างเสมอ บังคับเลือกน่าเชื่อถือกว่า
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

  // New visit form state
  const [showAddModal, setShowAddModal] = useState(false);
  const [symptoms, setSymptoms] = useState('');
  const [temperature, setTemperature] = useState('37.2');
  const [treatment, setTreatment] = useState('นอนพักผ่อน 15 นาที');
  const [medicationGiven, setMedicationGiven] = useState('');
  const [restDurationMinutes, setRestDurationMinutes] = useState(20);
  const [isUrgentAlert, setIsUrgentAlert] = useState(false);

  // คลังเวชภัณฑ์จริงจาก Firestore (infirmary_medicines) — ไม่มีข้อมูลตัวอย่าง
  const [medicines, setMedicines] = useState<InfirmaryMedicine[]>([]);
  useEffect(() => subscribeInfirmaryMedicines(setMedicines), []);
  // ยาที่เบิกจากคลังในเคสนี้ (ตัดสต็อกพร้อมบันทึกเคส)
  const [dispenseLines, setDispenseLines] = useState<DispenseLine[]>([]);

  const filteredVisits = infirmaryVisits.filter(v => {
    const student = students.find(s => s.studentId === v.studentId);
    const query = searchTerm.toLowerCase();
    return (
      v.studentId.toLowerCase().includes(query) ||
      (student && student.fullName.toLowerCase().includes(query)) ||
      v.symptoms.toLowerCase().includes(query) ||
      v.treatment.toLowerCase().includes(query)
    );
  });

  const handleRecordVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) {
      setRecordVisitError('กรุณาเลือกนักเรียนก่อนบันทึก');
      return;
    }
    if (!user?.uid) {
      setRecordVisitError('ไม่พบบัญชีผู้ใช้ที่ล็อกอินอยู่ กรุณาเข้าสู่ระบบใหม่ก่อนบันทึก');
      return;
    }
    const student = students.find(s => s.studentId === selectedStudentId);
    const stockById = Object.fromEntries(medicines.map(m => [m.id, m.stock]));
    const dispenseError = validateDispenseLines(dispenseLines, stockById);
    if (dispenseError) {
      setRecordVisitError(dispenseError);
      return;
    }

    setIsSavingVisit(true);
    setRecordVisitError(null);
    try {
      await recordInfirmaryVisitFirestore({
        studentId: selectedStudentId,
        studentUid: student?.studentUid || null,
        parentUid: student?.parentUid || null,
        studentName: student?.fullName || selectedStudentId,
        symptoms,
        temperature: parseFloat(temperature) || 37.0,
        treatment,
        medicationGiven: composeMedicationGiven(dispenseLines, medicationGiven),
        dispensed: dispenseLines,
        restDurationMinutes: Number(restDurationMinutes),
        isUrgentAlert,
        nurseUid: user.uid,
        nurseName: user.displayName || user.email || 'เจ้าหน้าที่พยาบาล',
      });
      setShowAddModal(false);
      setSymptoms('');
      setMedicationGiven('');
      setDispenseLines([]);
      setIsUrgentAlert(false);
    } catch (err) {
      console.error('[InfirmaryPortal] recordInfirmaryVisit failed:', err);
      setRecordVisitError('บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSavingVisit(false);
    }
  };


  return (
    <div className="flex-1 min-h-0 bg-slate-950 text-slate-100 flex flex-col overflow-hidden">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-rose-900/40 via-slate-900 to-slate-900 border-b border-rose-500/20 px-6 py-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-rose-500/20 border border-rose-500/30 rounded-2xl text-rose-400 shadow-lg">
              <HeartPulse className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">งานพยาบาลและอนามัยโรงเรียน</h1>
                <span className="px-2 py-0.5 bg-rose-500/20 border border-rose-500/30 text-rose-300 text-[10px] font-bold rounded-md">
                  Infirmary & Health Care Portal
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                ระบบบันทึกสถิติห้องพยาบาล คลังเวชภัณฑ์ ตรวจสุขภาพประจำปี และแจ้งเตือนผู้ปกครองเรียลไทม์
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-rose-600 hover:bg-rose-500 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-lg transition-all cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            บันทึกเคสเข้าห้องพยาบาลใหม่
          </button>
        </div>
      </div>

      {/* เมนูย่อย — แถบด้านซ้ายแบบเดียวกันทุก portal (PortalSidebarLayout) */}
      {/* scroll เดียวของหน้า — แถบหัวข้อ portal ด้านบนอยู่กับที่ */}
      <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-7xl w-full mx-auto px-6 py-6">
        <PortalSidebarLayout
          title="งานพยาบาลโรงเรียน"
          activeId={activeTab}
          onSelect={(id) => setActiveTab(id as typeof activeTab)}
          items={[
            { id: 'overview', label: 'ภาพรวมและสถิติงานพยาบาล', icon: BarChart3 },
            { id: 'visits', label: `สถิติการมารับบริการและจ่ายยา (${infirmaryVisits.length})`, icon: Activity },
            { id: 'inventory', label: `คลังเวชภัณฑ์และยา (${medicines.filter(isLowStock).length > 0 ? medicines.filter(isLowStock).length + ' ใกล้หมด' : medicines.length})`, icon: Pill },
            { id: 'screening', label: 'ผลตรวจสุขภาพและวัคซีนประจำปี', icon: FileSpreadsheet },
            { id: 'donation', label: 'ประวัติบริจาคโลหิต', icon: Droplets },
            { id: 'profiles', label: 'ข้อมูลโรคประจำตัวและประวัติแพ้ยา', icon: User },
          ]}
        >
        <div className="space-y-6">
        
        {/* TAB 0: OVERVIEW */}
        {activeTab === 'overview' && <InfirmaryOverview visits={infirmaryVisits} medicines={medicines} students={students} />}

        {/* TAB 1: VISITS & TREATMENTS */}
        {activeTab === 'visits' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="ค้นหาด้วยชื่อนักเรียน, อาการ, หรือรหัสประจำตัว..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                />
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
                <span>แจ้งเตือนผู้ปกครองผ่านแอป (เข้าลิสต์แจ้งเตือนอัตโนมัติเมื่อบันทึกเคส)</span>
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800/80 text-slate-300 uppercase font-mono text-[10px]">
                    <tr>
                      <th className="p-3.5">เวลา / วันที่</th>
                      <th className="p-3.5">นักเรียน</th>
                      <th className="p-3.5">อาการสำคัญ (Symptoms)</th>
                      <th className="p-3.5 text-center">อุณหภูมิ (°C)</th>
                      <th className="p-3.5">การรักษา / ยาที่จ่าย</th>
                      <th className="p-3.5 text-center">พัก (นาที)</th>
                      <th className="p-3.5 text-center">แจ้งผู้ปกครอง</th>
                      <th className="p-3.5 text-right">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {filteredVisits.map((v) => {
                      const student = students.find(s => s.studentId === v.studentId);
                      return (
                        <tr key={v.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="p-3.5 whitespace-nowrap">
                            <span className="font-mono font-bold text-rose-400">{v.visitTime}</span>
                            <span className="block text-[10px] text-slate-400">{v.visitDate}</span>
                          </td>
                          <td className="p-3.5 font-medium text-white">
                            <div className="flex items-center gap-2">
                              <span className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center font-bold text-xs">
                                {student?.studentNo || '1'}
                              </span>
                              <div>
                                <p className="font-bold text-white">{student?.fullName || v.studentId}</p>
                                <p className="text-[10px] text-slate-400 font-mono">ID: {v.studentId}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-3.5">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                              v.isUrgentAlert ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-slate-800 text-slate-200'
                            }`}>
                              {v.symptoms}
                            </span>
                          </td>
                          <td className="p-3.5 text-center font-mono font-bold text-amber-400">
                            {v.temperature}°C
                          </td>
                          <td className="p-3.5 text-slate-300">
                            <p className="font-medium">{v.treatment}</p>
                            <p className="text-[10px] text-indigo-300 font-mono">💊 {v.medicationGiven}</p>
                          </td>
                          <td className="p-3.5 text-center font-mono text-emerald-400 font-bold">
                            {v.restDurationMinutes} นาที
                          </td>
                          <td className="p-3.5 text-center">
                            {v.parentAcknowledged ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-[10px] font-bold">
                                <CheckCircle className="w-3 h-3" /> ผู้ปกครองรับทราบแล้ว
                              </span>
                            ) : v.parentNotifiedAt ? (
                              <div className="space-y-1">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-sky-500/10 text-sky-300 border border-sky-500/20 rounded-full text-[10px] font-bold">
                                  <CheckCircle className="w-3 h-3" /> ส่งแจ้งเตือนแล้ว · รอรับทราบ
                                </span>
                                <button
                                  onClick={() => sendInAppNotice(v)}
                                  disabled={noticeBusyId === v.id}
                                  className="block mx-auto text-[10px] text-slate-400 hover:text-slate-200 underline disabled:opacity-50"
                                >
                                  ส่งซ้ำ
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => sendInAppNotice(v)}
                                disabled={noticeBusyId === v.id}
                                className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-lg text-[10px] font-bold transition-all cursor-pointer disabled:opacity-50"
                              >
                                {noticeBusyId === v.id ? 'กำลังส่ง…' : 'กดส่งผ่านแอปงานพยาบาล'}
                              </button>
                            )}
                            {noticeError?.id === v.id && <p className="text-[10px] text-rose-400 mt-1">{noticeError.msg}</p>}
                          </td>
                          <td className="p-3.5 text-right font-mono text-slate-400 text-xs">
                            {v.nurseName}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: INVENTORY */}
        {activeTab === 'inventory' && user?.uid && (
          <InfirmaryStockPanel medicines={medicines} actor={{ uid: user.uid, name: user.displayName || user.email || 'เจ้าหน้าที่พยาบาล' }} />
        )}

        {/* TAB 3: HEALTH SCREENING & VACCINES — บันทึกจริง ไม่มีค่าตัวอย่าง */}
        {activeTab === 'screening' && (
          <div className="space-y-4">
            <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="text-base font-bold text-white">ผลตรวจสุขภาพและวัคซีน</h3>
                  <p className="text-xs text-slate-400">BMI มาจากที่นักเรียนบันทึกรายภาคเรียน · พยาบาลบันทึกผลตรวจสายตา/การได้ยินประจำปีและประวัติวัคซีน</p>
                </div>
                <div className="w-64">
                  <StudentPicker mode="single" students={students} value={selectedStudentId} onSelect={setSelectedStudentId} />
                </div>
              </div>
              {user?.uid && <InfirmaryHealthRecordsPanel studentId={selectedStudentId} actor={{ uid: user.uid, name: user.displayName || user.email || 'เจ้าหน้าที่พยาบาล' }} />}
            </div>
          </div>
        )}

        {/* TAB 3b: BLOOD DONATION */}
        {activeTab === 'donation' && user?.uid && (
          <InfirmaryBloodDonationPanel students={students} actor={{ uid: user.uid, name: user.displayName || user.email || 'เจ้าหน้าที่พยาบาล' }} />
        )}

        {/* TAB 4: PROFILES & CHRONIC */}
        {activeTab === 'profiles' && (
          <div className="space-y-4">
            <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="text-base font-bold text-white">ข้อมูลโรคประจำตัว อาการแพ้ยา และภาวะดูแลพิเศษ</h3>
                  <p className="text-xs text-slate-400">ครอบครัว (นักเรียน/ผู้ปกครอง) เป็นผู้กรอก — เจ้าหน้าที่พยาบาลตรวจสอบและกด "ยืนยันข้อมูลถูกต้อง"</p>
                </div>
                <div className="w-64">
                  <StudentPicker mode="single" students={students} value={selectedStudentId} onSelect={setSelectedStudentId} />
                </div>
              </div>
              <InfirmaryEmergencyContactsPanel studentId={selectedStudentId} />
              {user?.uid && <InfirmaryHealthProfilePanel studentId={selectedStudentId} actor={{ uid: user.uid, name: user.displayName || user.email || 'เจ้าหน้าที่พยาบาล' }} />}
            </div>
          </div>
        )}

      </div>
        </PortalSidebarLayout>
      </div>
      </div>

      {/* ADD VISIT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-rose-500/20 text-rose-400 rounded-xl">
                  <HeartPulse className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">บันทึกเคสเข้าห้องพยาบาล</h3>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white text-sm font-bold px-2 py-1 bg-slate-800 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordVisit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">เลือกนักเรียน</label>
                <StudentPicker mode="single" students={students} value={selectedStudentId} onSelect={setSelectedStudentId} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">อุณหภูมิร่างกาย (°C)</label>
                  <input
                    type="text"
                    value={temperature}
                    onChange={(e) => setTemperature(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                    placeholder="37.2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">ระยะเวลาพัก (นาที)</label>
                  <input
                    type="number"
                    value={restDurationMinutes}
                    onChange={(e) => setRestDurationMinutes(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">อาการสำคัญ (Symptoms / Chief Complaint)</label>
                <input
                  type="text"
                  required
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                  placeholder="เช่น ปวดศีรษะและมีไข้ต่ำๆ ตั้งแต่คาบเรียนที่ 2"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">การปฐมพยาบาล / การรักษา</label>
                <input
                  type="text"
                  value={treatment}
                  onChange={(e) => setTreatment(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">ยาที่จ่าย (เบิกจากคลัง — ตัดสต็อกอัตโนมัติ)</label>
                {dispenseLines.map((l, i) => (
                  <div key={l.medicineId} className="flex items-center gap-2 text-xs">
                    <span className="flex-1 text-slate-200 truncate">{l.name}</span>
                    <input
                      type="number"
                      min={1}
                      value={l.qty}
                      aria-label={`จำนวน ${l.name}`}
                      onChange={(e) => setDispenseLines(dispenseLines.map((x, j) => j === i ? { ...x, qty: Number(e.target.value) } : x))}
                      className="w-20 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-white font-mono"
                    />
                    <span className="text-slate-400 w-10">{l.unit}</span>
                    <button type="button" onClick={() => setDispenseLines(dispenseLines.filter((_, j) => j !== i))} className="text-rose-400 hover:text-rose-300 px-1" aria-label={`เอา ${l.name} ออก`}>✕</button>
                  </div>
                ))}
                <select
                  value=""
                  aria-label="เพิ่มยาจากคลัง"
                  onChange={(e) => {
                    const m = medicines.find(x => x.id === e.target.value);
                    if (m && !dispenseLines.some(l => l.medicineId === m.id)) setDispenseLines([...dispenseLines, { medicineId: m.id, name: m.name, unit: m.unit, qty: 1 }]);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="">+ เพิ่มยาจากคลัง…</option>
                  {medicines.filter(m => m.active && m.stock > 0).map(m => (
                    <option key={m.id} value={m.id}>{m.name} (คงเหลือ {m.stock} {m.unit})</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={medicationGiven}
                  onChange={(e) => setMedicationGiven(e.target.value)}
                  placeholder="ยา/สิ่งอื่นที่ให้ซึ่งไม่ได้เบิกจากคลัง (ถ้ามี)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="urgent"
                  checked={isUrgentAlert}
                  onChange={(e) => setIsUrgentAlert(e.target.checked)}
                  className="rounded border-slate-800 bg-slate-950 text-rose-600 focus:ring-0 w-4 h-4"
                />
                <label htmlFor="urgent" className="text-xs font-semibold text-rose-400">
                  ⚠️ เป็นเคสเร่งด่วน / ต้องแจ้งผู้ปกครองมารับกลับบ้านทันที
                </label>
              </div>

              {recordVisitError && (
                <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2">{recordVisitError}</p>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSavingVisit}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-lg transition-all"
                >
                  {isSavingVisit ? 'กำลังบันทึก...' : 'บันทึกข้อมูลและส่งแจ้งเตือน'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
