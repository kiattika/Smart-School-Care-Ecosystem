import React, { useState } from 'react';
import { 
  Scan, 
  CreditCard, 
  UserCheck, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Calendar, 
  FileText, 
  Send, 
  Upload, 
  ShieldCheck, 
  Bell, 
  Check, 
  Filter, 
  ArrowRight,
  Sparkles,
  TrendingUp,
  MapPin,
  Satellite
} from 'lucide-react';
import { useStore } from '../../store';
import { GateAttendanceRecord, DetailedLeaveRequest, AttendanceStatus, Student } from '../../types';
import { GPSGeofenceCheckinModal } from '../GPSGeofenceCheckinModal';

export function GateAttendanceTracker({ studentId, isParentView = false }: { studentId: string; isParentView?: boolean }) {
  const { 
    gateAttendanceLogs, 
    recordGateAttendance, 
    detailedLeaveRequests, 
    submitDetailedLeave, 
    approveDetailedLeave,
    students,
    courses,
    user
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
  const logs = gateAttendanceLogs.filter(l => l.studentId === student.studentId);
  const leaves = detailedLeaveRequests.filter(l => l.studentId === student.studentId);

  const [activeTab, setActiveTab] = useState<'gate' | 'subject' | 'leave'>('gate');
  const [selectedScanMethod, setSelectedScanMethod] = useState<'NFC_CARD' | 'BIOMETRIC_FACE' | 'BIOMETRIC_FINGER' | 'GPS_GEOFENCE'>('GPS_GEOFENCE');
  const [isGPSModalOpen, setIsGPSModalOpen] = useState(false);
  const [scanType, setScanType] = useState<'ENTRY' | 'EXIT'>('ENTRY');
  const [isScanning, setIsScanning] = useState(false);
  const [scanFeedback, setScanFeedback] = useState<string | null>(null);

  // e-Leave form state
  const [leaveType, setLeaveType] = useState<'SICK' | 'PERSONAL' | 'ACTIVITY'>('SICK');
  const [startDate, setStartDate] = useState('2026-08-22');
  const [endDate, setEndDate] = useState('2026-08-23');
  const [leaveReason, setLeaveReason] = useState('');
  const [attachedFile, setAttachedFile] = useState<string | null>(null);
  const [leaveSubmitSuccess, setLeaveSubmitSuccess] = useState(false);

  const handleSimulateScan = () => {
    setIsScanning(true);
    setScanFeedback(null);
    setTimeout(() => {
      recordGateAttendance(student.studentId, scanType, selectedScanMethod);
      setIsScanning(false);
      setScanFeedback(`บันทึก ${scanType === 'ENTRY' ? 'เข้าโรงเรียน' : 'ออกจากโรงเรียน'} สำเร็จ! ส่งแจ้งเตือนไปยังผู้ปกครองแล้ว 📲`);
      setTimeout(() => setScanFeedback(null), 4000);
    }, 900);
  };

  const handleLeaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveReason.trim()) return;

    submitDetailedLeave({
      studentId: student.studentId,
      leaveType,
      startDate,
      endDate,
      totalDays: 2,
      reason: leaveReason,
      attachmentName: attachedFile || 'ใบรับรองแพทย์_เอกสารแนบ.pdf',
      submittedBy: isParentView ? 'ผู้ปกครอง (LINE)' : student.name
    });

    setLeaveReason('');
    setAttachedFile(null);
    setLeaveSubmitSuccess(true);
    setTimeout(() => setLeaveSubmitSuccess(false), 4000);
  };

  // Mock subject attendance stats
  const subjectAttendanceList = [
    { code: 'ค32101', name: 'คณิตศาสตร์พื้นฐาน', present: 28, late: 1, leave: 1, absent: 0, total: 30, rate: 96.6 },
    { code: 'ค32201', name: 'คณิตศาสตร์เพิ่มเติม', present: 38, late: 2, leave: 0, absent: 0, total: 40, rate: 95.0 },
    { code: 'ว32202', name: 'ฟิสิกส์ 2', present: 36, late: 1, leave: 2, absent: 1, total: 40, rate: 92.5 },
    { code: 'ว32222', name: 'เคมี 2', present: 29, late: 0, leave: 1, absent: 0, total: 30, rate: 96.7 },
    { code: 'ว32242', name: 'ชีววิทยา 2', present: 28, late: 1, leave: 1, absent: 0, total: 30, rate: 93.3 },
    { code: 'อ32101', name: 'ภาษาอังกฤษเพื่อการสื่อสาร', present: 19, late: 0, leave: 1, absent: 0, total: 20, rate: 95.0 },
    { code: 'ท32101', name: 'ภาษาไทยพื้นฐาน', present: 20, late: 0, leave: 0, absent: 0, total: 20, rate: 100.0 }
  ];

  const avgAttendance = 95.6;

  return (
    <div className="space-y-6">
      {/* Sub navigation pills */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-900/60 border border-slate-800 rounded-2xl w-full max-w-lg mx-auto">
        <button
          onClick={() => setActiveTab('gate')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'gate'
              ? 'bg-gradient-to-r from-indigo-500 to-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Scan className="w-3.5 h-3.5" />
          <span>การเข้า-ออกประตู (Gate)</span>
        </button>
        <button
          onClick={() => setActiveTab('subject')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'subject'
              ? 'bg-gradient-to-r from-indigo-500 to-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>สถิติรายวิชา</span>
        </button>
        <button
          onClick={() => setActiveTab('leave')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'leave'
              ? 'bg-gradient-to-r from-indigo-500 to-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>ยื่นใบลาออนไลน์ (e-Leave)</span>
        </button>
      </div>

      {activeTab === 'gate' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Simulator Panel */}
          <div className="lg:col-span-5 bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-md shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                    <Scan className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Smart Gate Simulator</h3>
                    <p className="text-[11px] text-slate-400">จำลองการสแกนผ่านซุ้มประตูโรงเรียน</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  ระบบเปิดใช้งาน 24/7
                </span>
              </div>

              {/* Student Identification Card */}
              <div className="bg-gradient-to-br from-slate-800/90 to-slate-800/40 border border-slate-700/60 rounded-2xl p-4 mb-4 flex items-center gap-3.5">
                <img 
                  src={student.photoUrl || student.avatar} 
                  alt={student.name} 
                  className="w-14 h-14 rounded-2xl object-cover border-2 border-indigo-500/30 bg-slate-900"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-mono font-bold">
                      {student.studentId}
                    </span>
                    <span className="text-[11px] text-slate-400">ห้อง ม.{student.room || '5/8'} เลขที่ {student.studentNo}</span>
                  </div>
                  <h4 className="text-sm font-bold text-white truncate">{student.name}</h4>
                  <p className="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5">
                    <CheckCircle2 className="w-3 h-3" /> บัตรนักเรียน Smart Digital ID พร้อมใช้งาน
                  </p>
                </div>
              </div>

              {/* Scan Configuration */}
              <div className="space-y-3 mb-5">
                <div>
                  <label className="text-[11px] font-medium text-slate-400 mb-1.5 block">ประเภทการผ่านประตู:</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setScanType('ENTRY')}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                        scanType === 'ENTRY'
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm'
                          : 'bg-slate-800/40 border-slate-700 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      🚶‍♂️ เข้าโรงเรียน (Entry)
                    </button>
                    <button
                      onClick={() => setScanType('EXIT')}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                        scanType === 'EXIT'
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm'
                          : 'bg-slate-800/40 border-slate-700 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      🏃‍♂️ ออกจากโรงเรียน (Exit)
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-medium text-slate-400">ระบบเซนเซอร์ที่ตรวจจับ:</label>
                    <button
                      type="button"
                      onClick={() => setIsGPSModalOpen(true)}
                      className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold"
                    >
                      <Satellite className="w-3 h-3 animate-pulse" />
                      เปิดหน้าจอเรดาร์ดาวเทียม GPS
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      onClick={() => setSelectedScanMethod('GPS_GEOFENCE')}
                      className={`p-2 rounded-xl text-[11px] font-medium border flex flex-col items-center gap-1 transition-all ${
                        selectedScanMethod === 'GPS_GEOFENCE'
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500/40'
                          : 'bg-slate-800/40 border-slate-700/60 text-slate-400'
                      }`}
                    >
                      <Satellite className="w-4 h-4 text-emerald-400" />
                      <span>GPS ดาวเทียม</span>
                    </button>
                    <button
                      onClick={() => setSelectedScanMethod('NFC_CARD')}
                      className={`p-2 rounded-xl text-[11px] font-medium border flex flex-col items-center gap-1 transition-all ${
                        selectedScanMethod === 'NFC_CARD'
                          ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300'
                          : 'bg-slate-800/40 border-slate-700/60 text-slate-400'
                      }`}
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>NFC RFID</span>
                    </button>
                    <button
                      onClick={() => setSelectedScanMethod('BIOMETRIC_FACE')}
                      className={`p-2 rounded-xl text-[11px] font-medium border flex flex-col items-center gap-1 transition-all ${
                        selectedScanMethod === 'BIOMETRIC_FACE'
                          ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300'
                          : 'bg-slate-800/40 border-slate-700/60 text-slate-400'
                      }`}
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>Face AI</span>
                    </button>
                    <button
                      onClick={() => setSelectedScanMethod('BIOMETRIC_FINGER')}
                      className={`p-2 rounded-xl text-[11px] font-medium border flex flex-col items-center gap-1 transition-all ${
                        selectedScanMethod === 'BIOMETRIC_FINGER'
                          ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300'
                          : 'bg-slate-800/40 border-slate-700/60 text-slate-400'
                      }`}
                    >
                      <Scan className="w-4 h-4" />
                      <span>Fingerprint</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Button & Feedback */}
            <div>
              {scanFeedback && (
                <div className="p-3 mb-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{scanFeedback}</span>
                </div>
              )}

              <button
                onClick={handleSimulateScan}
                disabled={isScanning}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-600 via-indigo-500 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
              >
                {isScanning ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    <span>กำลังประมวลผลการสแกน...</span>
                  </>
                ) : (
                  <>
                    <Scan className="w-4 h-4" />
                    <span>กดทดสอบสแกนเข้า/ออกประตู (Tap to Check-in)</span>
                  </>
                )}
              </button>
              <p className="text-[10px] text-slate-500 text-center mt-2">
                * ข้อมูลจะถูกบันทึกและส่งการแจ้งเตือน Real-time แจ้งผู้ปกครองทาง LINE และแอปพลิเคชันทันที
              </p>
            </div>
          </div>

          {/* Real-time Gate Logs Timeline */}
          <div className="lg:col-span-7 bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-md shadow-xl flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-400" />
                  ประวัติการผ่านประตูโรงเรียน (Gate Entry/Exit Logs)
                </h3>
                <p className="text-[11px] text-slate-400">บันทึกเวลาจริงจากอุปกรณ์ Smart School Gate</p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 text-[10px] font-medium border border-slate-700">
                ทั้งหมด {logs.length} รายการ
              </span>
            </div>

            <div className="space-y-3 overflow-y-auto max-h-[420px] pr-1">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="p-3.5 bg-slate-800/40 hover:bg-slate-800/70 border border-slate-800 hover:border-slate-700 rounded-2xl transition-all flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                      log.type === 'ENTRY'
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                    }`}>
                      {log.type === 'ENTRY' ? <Check className="w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          log.type === 'ENTRY' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                        }`}>
                          {log.type === 'ENTRY' ? 'เข้าโรงเรียน' : 'ออกจากโรงเรียน'}
                        </span>
                        <span className="text-xs font-bold text-white">{log.timestamp}</span>
                        {log.status === 'LATE' && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold">
                            มาสาย
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-500" />
                        {log.gateName} • วันที่ {log.date}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] px-2 py-1 rounded bg-slate-900/80 text-slate-300 border border-slate-800 font-mono block">
                      {log.method}
                    </span>
                    {log.temperature && (
                      <span className="text-[9.5px] text-emerald-400 font-mono mt-1 block">
                        🌡️ {log.temperature}°C ปกติ
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {logs.length === 0 && (
                <div className="py-12 text-center text-slate-500 text-xs">
                  ยังไม่มีประวัติการผ่านประตูในรอบวันนี้
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-indigo-400" />
                สถานะการแจ้งเตือนผู้ปกครอง:
              </span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> ซิงค์แจ้งเตือนผ่าน LINE Official แล้ว
              </span>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'subject' && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-md shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-400" />
                สถิติการเข้าเรียนรายวิชา (Subject-Wise Attendance Analytics)
              </h3>
              <p className="text-[11px] text-slate-400">
                เกณฑ์ผ่านการประเมินเวลาเรียน สพฐ.: ต้องเข้าเรียนไม่น้อยกว่า 80% ของเวลาเรียนทั้งหมด
              </p>
            </div>
            
            <div className="flex items-center gap-3 bg-slate-800/80 border border-slate-700/60 rounded-2xl p-3">
              <div>
                <p className="text-[10px] text-slate-400">อัตราการเข้าเรียนเฉลี่ยรวม</p>
                <p className="text-lg font-black text-emerald-400">{avgAttendance}%</p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {subjectAttendanceList.map((subj) => (
              <div
                key={subj.code}
                className="bg-slate-800/40 border border-slate-800 hover:border-indigo-500/40 rounded-2xl p-4 transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold mr-2">
                      {subj.code}
                    </span>
                    <span className="text-xs font-bold text-slate-200">{subj.name}</span>
                  </div>
                  <span className={`text-xs font-extrabold ${subj.rate >= 90 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {subj.rate}%
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-900 rounded-full h-2 mb-3 overflow-hidden border border-slate-800">
                  <div 
                    className={`h-full rounded-full ${subj.rate >= 90 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                    style={{ width: `${subj.rate}%` }}
                  ></div>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center text-[10px]">
                  <div className="bg-slate-900/60 p-1.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block">มาเรียน</span>
                    <span className="font-bold text-emerald-400">{subj.present}</span>
                  </div>
                  <div className="bg-slate-900/60 p-1.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block">สาย</span>
                    <span className="font-bold text-amber-400">{subj.late}</span>
                  </div>
                  <div className="bg-slate-900/60 p-1.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block">ลา</span>
                    <span className="font-bold text-blue-400">{subj.leave}</span>
                  </div>
                  <div className="bg-slate-900/60 p-1.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block">ขาด</span>
                    <span className="font-bold text-rose-400">{subj.absent}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'leave' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Submission Form */}
          <div className="lg:col-span-5 bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-md shadow-xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
              <FileText className="w-4 h-4 text-indigo-400" />
              แบบฟอร์มยื่นใบลาออนไลน์ (e-Leave Form)
            </h3>
            <p className="text-[11px] text-slate-400 mb-4">
              ผู้ปกครองสามารถยื่นใบลาป่วยหรือลากิจ พร้อมแนบหลักฐานเอกสารรับรอง
            </p>

            {leaveSubmitSuccess && (
              <div className="p-3 mb-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>ส่งใบลาเรียบร้อยแล้ว ครูประจำชั้นจะได้รับการแจ้งเตือนทันที</span>
              </div>
            )}

            <form onSubmit={handleLeaveSubmit} className="space-y-4">
              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1.5">ประเภทการลา:</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setLeaveType('SICK')}
                    className={`py-2 px-2 rounded-xl text-xs font-semibold border transition-all ${
                      leaveType === 'SICK'
                        ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                        : 'bg-slate-800/40 border-slate-700 text-slate-400'
                    }`}
                  >
                    🤒 ลาป่วย
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeaveType('PERSONAL')}
                    className={`py-2 px-2 rounded-xl text-xs font-semibold border transition-all ${
                      leaveType === 'PERSONAL'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-slate-800/40 border-slate-700 text-slate-400'
                    }`}
                  >
                    🚗 ลากิจ
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeaveType('ACTIVITY')}
                    className={`py-2 px-2 rounded-xl text-xs font-semibold border transition-all ${
                      leaveType === 'ACTIVITY'
                        ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300'
                        : 'bg-slate-800/40 border-slate-700 text-slate-400'
                    }`}
                  >
                    🏆 ลากิจกรรม
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-slate-300 block mb-1">ตั้งแต่วันที่:</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-300 block mb-1">ถึงวันที่:</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">เหตุผลและรายละเอียดการลา:</label>
                <textarea
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  placeholder="ระบุอาการป่วย หรือสาเหตุความจำเป็นในการลากิจ..."
                  rows={3}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500 resize-none"
                  required
                ></textarea>
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">แนบไฟล์ใบรับรองแพทย์ / เอกสารประกอบ:</label>
                <div 
                  onClick={() => setAttachedFile('ใบรับรองแพทย์_รพ.อุตรดิตถ์.pdf')}
                  className="border-2 border-dashed border-slate-700 hover:border-indigo-500/60 rounded-2xl p-3 text-center cursor-pointer transition-all bg-slate-800/30"
                >
                  <Upload className="w-5 h-5 text-indigo-400 mx-auto mb-1" />
                  <span className="text-xs text-slate-300 font-medium block">
                    {attachedFile ? `📎 ${attachedFile}` : 'คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวาง'}
                  </span>
                  <span className="text-[10px] text-slate-500">รองรับ PDF, JPG, PNG (สูงสุด 5MB)</span>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>ส่งใบลาออนไลน์ (Submit Leave Request)</span>
              </button>
            </form>
          </div>

          {/* Leave History & Status */}
          <div className="lg:col-span-7 bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-md shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-indigo-400" />
                    ประวัติการยื่นใบลาและสถานะการอนุมัติ
                  </h3>
                  <p className="text-[11px] text-slate-400">เมื่อครูอนุมัติ ระบบจะปรับบัญชีเวลาเรียนและคัดกรองการสุ่มอัตโนมัติ</p>
                </div>
              </div>

              <div className="space-y-3 overflow-y-auto max-h-[460px] pr-1">
                {leaves.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 bg-slate-800/40 border border-slate-800 rounded-2xl hover:border-slate-700 transition-all space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          item.leaveType === 'SICK' ? 'bg-rose-500/20 text-rose-300' :
                          item.leaveType === 'PERSONAL' ? 'bg-amber-500/20 text-amber-300' :
                          'bg-indigo-500/20 text-indigo-300'
                        }`}>
                          {item.leaveType === 'SICK' ? '🤒 ลาป่วย' : item.leaveType === 'PERSONAL' ? '🚗 ลากิจ' : '🏆 กิจกรรม'}
                        </span>
                        <span className="text-xs font-bold text-white">
                          {item.startDate} {item.startDate !== item.endDate && `ถึง ${item.endDate}`} ({item.totalDays} วัน)
                        </span>
                      </div>

                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                        item.status === 'APPROVED' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                        item.status === 'REJECTED' ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' :
                        'bg-amber-500/10 border-amber-500/30 text-amber-400 animate-pulse'
                      }`}>
                        {item.status === 'APPROVED' ? '✅ อนุมัติแล้ว' :
                         item.status === 'REJECTED' ? '❌ ไม่อนุมัติ' : '⏳ รอครูประจำชั้นตรวจสอบ'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
                      {item.reason}
                    </p>

                    {item.attachmentName && (
                      <div className="text-[11px] text-indigo-400 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" />
                        <span>เอกสารแนบ: {item.attachmentName}</span>
                      </div>
                    )}

                    {item.teacherRemarks && (
                      <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800/80 flex items-center justify-between">
                        <span>ความเห็นครู: {item.teacherRemarks}</span>
                        {item.approvedBy && <span className="text-[10px] text-emerald-400">({item.approvedBy})</span>}
                      </div>
                    )}

                    {/* Teacher Quick Approve Button (if teacher logged in) */}
                    {item.status === 'PENDING' && (
                      <div className="pt-2 flex justify-end gap-2">
                        <button
                          onClick={() => approveDetailedLeave(item.id, 'อนุมัติการลาตามใบรับรองแพทย์')}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow cursor-pointer flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>(ครู) อนุมัติใบลา</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {leaves.length === 0 && (
                  <div className="py-12 text-center text-slate-500 text-xs">
                    ยังไม่มีประวัติการยื่นใบลาในภาคเรียนนี้
                  </div>
                )}
              </div>
            </div>

            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-[11px] text-indigo-300 flex items-center gap-2 mt-4">
              <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>
                เมื่อใบลาได้รับการอนุมัติ นักเรียนจะได้รับการยกเว้นจากการเรียกสุ่มใน Random Student Picker ในช่วงเวลาที่ลาโดยอัตโนมัติ
              </span>
            </div>
          </div>
        </div>
      )}

      {/* GPS Geofence Radar Check-in Modal */}
      <GPSGeofenceCheckinModal
        isOpen={isGPSModalOpen}
        onClose={() => setIsGPSModalOpen(false)}
      />
    </div>
  );
}
