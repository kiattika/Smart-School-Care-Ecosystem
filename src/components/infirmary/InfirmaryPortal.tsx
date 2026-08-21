import React, { useState } from 'react';
import { useStore } from '../../store';
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
  Stethoscope
} from 'lucide-react';
import { InfirmaryVisit, SemesterHealthRecord } from '../../types';

export function InfirmaryPortal() {
  const { students } = useStore();
  const [infirmaryVisits, setInfirmaryVisits] = useState<InfirmaryVisit[]>([
    {
      id: 'INF-01',
      studentId: '6950801',
      visitTime: '09:30 น. (2026-08-20)',
      symptoms: 'ปวดศีรษะและอ่อนเพลียเล็กน้อย',
      temperature: 37.6,
      treatment: 'นอนพักผ่อน ประคบเย็น',
      medicationGiven: 'พาราเซตามอล 1 เม็ด',
      restDurationMinutes: 30,
      nurseName: 'นางสาวกนกวรรณ พยาบาลวิชาชีพ',
      isUrgentAlert: false,
      parentAcknowledged: true
    }
  ]);
  
  const recordInfirmaryVisit = (newVisit: Omit<InfirmaryVisit, 'id'>) => {
    const created: InfirmaryVisit = {
      ...newVisit,
      id: `INF-0${infirmaryVisits.length + 1}`
    };
    setInfirmaryVisits([created, ...infirmaryVisits]);
  };

  const acknowledgeInfirmaryAlert = (id: string) => {
    setInfirmaryVisits(infirmaryVisits.map(v => v.id === id ? { ...v, parentAcknowledged: true, acknowledgedAt: new Date().toISOString() } : v));
  };
  
  const [activeTab, setActiveTab] = useState<'visits' | 'inventory' | 'screening' | 'profiles'>('visits');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>(students[0]?.studentId || '');
  
  // New visit form state
  const [showAddModal, setShowAddModal] = useState(false);
  const [symptoms, setSymptoms] = useState('');
  const [temperature, setTemperature] = useState('37.2');
  const [treatment, setTreatment] = useState('นอนพักผ่อน 15 นาที');
  const [medicationGiven, setMedicationGiven] = useState('พาราเซตามอล 1 เม็ด (500 มก.)');
  const [restDurationMinutes, setRestDurationMinutes] = useState(20);
  const [isUrgentAlert, setIsUrgentAlert] = useState(false);

  // Medicine inventory state (mock)
  const [medicines, setMedicines] = useState([
    { id: 'm1', name: 'พาราเซตามอล (Paracetamol 500mg)', stock: 140, unit: 'เม็ด', minAlert: 50, category: 'ยาสสามัญประจำบ้าน' },
    { id: 'm2', name: 'ยาธาตุน้ำขาว (Carminative Mixture)', stock: 18, unit: 'ขวด', minAlert: 20, category: 'ระบบทางเดินอาหาร' },
    { id: 'm3', name: 'เกลือแร่ (ORS)', stock: 85, unit: 'ซอง', minAlert: 30, category: 'ภาวะขาดน้ำ' },
    { id: 'm4', name: 'ยาแก้ไอขับเสมหะ', stock: 12, unit: 'ขวด', minAlert: 15, category: 'ระบบทางเดินหายใจ' },
    { id: 'm5', name: 'พลาสเตอร์ปิดแผล (Band-Aid)', stock: 220, unit: 'ชิ้น', minAlert: 50, category: 'ปฐมพยาบาล' },
    { id: 'm6', name: 'ยาหยอดตา (Artificial Tears)', stock: 8, unit: 'หลอด', minAlert: 10, category: 'ตา/หู/คอ' }
  ]);

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

  const handleRecordVisit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) return;
    
    const now = new Date();
    const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น. (' + now.toISOString().split('T')[0] + ')';

    const newVisit: Omit<InfirmaryVisit, 'id'> = {
      studentId: selectedStudentId,
      visitTime: timeStr,
      symptoms,
      temperature: parseFloat(temperature) || 37.0,
      treatment,
      medicationGiven,
      restDurationMinutes: Number(restDurationMinutes),
      nurseName: 'นางสาวกนกวรรณ พยาบาลวิชาชีพ',
      isUrgentAlert,
      parentAcknowledged: false
    };

    recordInfirmaryVisit(newVisit);
    setShowAddModal(false);
    setSymptoms('');
    setIsUrgentAlert(false);
  };

  const activeStudent = students.find(s => s.studentId === selectedStudentId) || students[0];

  return (
    <div className="flex-1 bg-slate-950 text-slate-100 flex flex-col min-h-screen">
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

      {/* Main Navigation Tabs */}
      <div className="max-w-7xl w-full mx-auto px-6 pt-6">
        <div className="flex border-b border-slate-800 gap-6">
          <button
            onClick={() => setActiveTab('visits')}
            className={`pb-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'visits' ? 'border-rose-500 text-rose-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>สถิติการมารับบริการและจ่ายยา ({infirmaryVisits.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('inventory')}
            className={`pb-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'inventory' ? 'border-rose-500 text-rose-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Pill className="w-4 h-4" />
            <span>คลังเวชภัณฑ์และยา ({medicines.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('screening')}
            className={`pb-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'screening' ? 'border-rose-500 text-rose-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>ผลตรวจสุขภาพและวัคซีนประจำปี</span>
          </button>
          <button
            onClick={() => setActiveTab('profiles')}
            className={`pb-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'profiles' ? 'border-rose-500 text-rose-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-4 h-4" />
            <span>ข้อมูลโรคประจำตัวและประวัติแพ้ยา</span>
          </button>
        </div>
      </div>

      {/* Content Body */}
      <div className="max-w-7xl w-full mx-auto px-6 py-6 flex-1 space-y-6">
        
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
                <span>ระบบเชื่อมโยงแจ้งเตือน Line ผู้ปกครองอัตโนมัติ</span>
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
                                <CheckCircle className="w-3 h-3" /> แจ้งแล้ว
                              </span>
                            ) : (
                              <button
                                onClick={() => acknowledgeInfirmaryAlert(v.id)}
                                className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                              >
                                กดส่งแจ้ง Line ผู้ปกครอง
                              </button>
                            )}
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
        {activeTab === 'inventory' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">คลังเวชภัณฑ์และยาห้องพยาบาลโรงเรียน</h3>
                <p className="text-xs text-slate-400">ระบบตรวจเช็กจำนวนยาอัตโนมัติ แจ้งเตือนเมื่อยาใกล้หมดสต็อก</p>
              </div>
              <button 
                onClick={() => alert('เพิ่มรายการยาสำเร็จ')}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors"
              >
                + เพิ่มเวชภัณฑ์ใหม่
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {medicines.map((med) => {
                const isLow = med.stock <= med.minAlert;
                return (
                  <div key={med.id} className={`p-4 rounded-2xl border bg-slate-900/80 shadow-lg relative overflow-hidden flex flex-col justify-between ${
                    isLow ? 'border-rose-500/50 bg-rose-950/10' : 'border-slate-800'
                  }`}>
                    {isLow && (
                      <div className="absolute top-0 right-0 bg-rose-500 text-white text-[9px] font-black uppercase px-2.5 py-0.5 rounded-bl-xl font-mono">
                        ⚠️ สต็อกใกล้หมด
                      </div>
                    )}
                    <div>
                      <span className="text-[10px] text-slate-400 font-mono uppercase bg-slate-800 px-2 py-0.5 rounded">
                        {med.category}
                      </span>
                      <h4 className="text-sm font-bold text-white mt-2">{med.name}</h4>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 block">คงเหลือปัจจุบัน</span>
                        <p className={`text-2xl font-black font-mono ${isLow ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {med.stock} <span className="text-xs font-normal text-slate-400">{med.unit}</span>
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <button 
                          onClick={() => {
                            setMedicines(medicines.map(m => m.id === med.id ? { ...m, stock: m.stock + 50 } : m));
                          }}
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-700 transition-colors"
                        >
                          +50
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: HEALTH SCREENING & VACCINES */}
        {activeTab === 'screening' && (
          <div className="space-y-4">
            <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">บันทึกตรวจสุขภาพและวัคซีนประจำปี 2569</h3>
                  <p className="text-xs text-slate-400">ข้อมูลน้ำหนัก ส่วนสูง ดัชนีมวลกาย (BMI) และการได้รับวัคซีนป้องกันโรค</p>
                </div>
                <div className="flex gap-2">
                  <select
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
                  >
                    {students.map(s => (
                      <option key={s.studentId} value={s.studentId}>{s.fullName} ({s.studentId})</option>
                    ))}
                  </select>
                </div>
              </div>

              {activeStudent && (
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2">
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <span className="text-slate-400 text-xs block">นักเรียนที่เลือก</span>
                    <p className="text-sm font-bold text-white mt-1">{activeStudent.fullName}</p>
                    <p className="text-xs text-indigo-400 font-mono">รหัส: {activeStudent.studentId}</p>
                  </div>
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <span className="text-slate-400 text-xs block">ดัชนีมวลกาย (BMI)</span>
                    <p className="text-2xl font-black text-emerald-400 font-mono mt-0.5">21.4</p>
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">สมส่วน (Normal)</span>
                  </div>
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <span className="text-slate-400 text-xs block">สมรรถภาพสายตาและการได้ยิน</span>
                    <p className="text-sm font-bold text-white mt-1">ปกติ 20/20 (ทั้งสองข้าง)</p>
                    <span className="text-[10px] text-indigo-400 font-mono">ตรวจเมื่อ: 15 พ.ค. 2569</span>
                  </div>
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <span className="text-slate-400 text-xs block">ประวัติวัคซีน (HPV / DPT)</span>
                    <p className="text-sm font-bold text-emerald-400 mt-1">✅ ครบตามเกณฑ์กระทรวงฯ</p>
                    <span className="text-[10px] text-slate-400 font-mono">บันทึกโดย รพ.สต. เมืองอุตรดิตถ์</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: PROFILES & CHRONIC */}
        {activeTab === 'profiles' && (
          <div className="space-y-4">
            <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">ข้อมูลโรคประจำตัว อาการแพ้ยา และภาวะดูแลพิเศษ</h3>
                  <p className="text-xs text-slate-400">เชื่อมโยงข้อมูลสุขภาพจากฐานข้อมูลนักเรียนเพื่อความปลอดภัยสูงสุดระหว่างอยู่โรงเรียน</p>
                </div>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
                >
                  {students.map(s => (
                    <option key={s.studentId} value={s.studentId}>{s.fullName}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <span className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4" /> โรคประจำตัว (Chronic Illness)
                  </span>
                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 text-xs">
                    <p className="font-semibold text-white">หอบหืด (Asthma - ระดับปานกลาง)</p>
                    <p className="text-slate-400 mt-1">พกยาพ่นขยายหลอดลม (Ventolin) ติดตัวตลอดเวลา</p>
                  </div>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Pill className="w-4 h-4" /> ประวัติแพ้ยา / แพ้อาหาร (Allergies)
                  </span>
                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 text-xs">
                    <p className="font-semibold text-white">แพ้ยาเพนิซิลลิน (Penicillin)</p>
                    <p className="text-slate-400 mt-1">อาการ: ผื่นขึ้น หายใจลำบาก (ห้ามจ่ายยาเด็ดขาด)</p>
                  </div>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-4 h-4" /> ผู้ติดต่อฉุกเฉิน (Emergency Contact)
                  </span>
                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 text-xs">
                    <p className="font-semibold text-white">คุณแม่ สมศรี (มารดา)</p>
                    <p className="text-indigo-400 font-mono mt-1">📞 โทร: 089-123-4567</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

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
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                >
                  {students.map(s => (
                    <option key={s.studentId} value={s.studentId}>
                      เลขที่ {s.studentNo} - {s.fullName} ({s.studentId})
                    </option>
                  ))}
                </select>
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

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">ยาที่จ่าย (Medication Given)</label>
                <input
                  type="text"
                  value={medicationGiven}
                  onChange={(e) => setMedicationGiven(e.target.value)}
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
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg transition-all"
                >
                  บันทึกข้อมูลและส่งแจ้งเตือน
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
