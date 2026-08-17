import React, { useState } from 'react';
import { 
  Calendar, 
  Clock, 
  Lock, 
  Unlock, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  Settings, 
  Hourglass, 
  Check, 
  X, 
  HelpCircle,
  FileText,
  User,
  Shield,
  Save,
  BookOpen
} from 'lucide-react';

interface GradeLockConfig {
  id: string;
  title: string;
  description: string;
  isOpen: boolean;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
}

interface ExceptionRequest {
  id: string;
  teacherId: string;
  teacherName: string;
  subjectCode: string;
  subjectName: string;
  className: string;
  reason: string;
  requestedAt: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedUntil?: string;
}

export function SystemSettingsAndLocksPage() {
  // 1. Academic Year & Semester Config
  const [academicYear, setAcademicYear] = useState('2569');
  const [semester, setSemester] = useState('1');

  // 2. Grade Entry Time-Window Settings
  const [lockConfigs, setLockConfigs] = useState<GradeLockConfig[]>([
    {
      id: 'midterm',
      title: 'คะแนนเก็บกลางภาค (Midterm Assessment)',
      description: 'ระบบลงคะแนนและเกณฑ์วัดผลย่อย กลางภาคเรียนที่ 1',
      isOpen: true,
      startDate: '2026-07-01',
      startTime: '08:30',
      endDate: '2026-08-15',
      endTime: '16:30'
    },
    {
      id: 'final',
      title: 'คะแนนสอบปลายภาค (Final Assessment)',
      description: 'ระบบลงคะแนนสอบรวบยอด และเกรดสรุปปลายภาคเรียน',
      isOpen: false,
      startDate: '2026-09-10',
      startTime: '08:30',
      endDate: '2026-09-30',
      endTime: '18:00'
    },
    {
      id: 'desirable',
      title: 'การประเมินคุณลักษณะอันพึงประสงค์ & อ่านคิดวิเคราะห์',
      description: 'ระบบประเมินคุณลักษณะ 8 ประการ และการอ่าน คิด วิเคราะห์ เขียน',
      isOpen: true,
      startDate: '2026-07-15',
      startTime: '09:00',
      endDate: '2026-10-05',
      endTime: '16:30'
    }
  ]);

  // 3. Exception Request System (คำร้องขอแก้ไขเกรดย้อนหลังรายกรณี)
  const [requests, setRequests] = useState<ExceptionRequest[]>([
    {
      id: 'req-01',
      teacherId: 'teacher-somchai',
      teacherName: 'นายสมชาย ใจดี',
      subjectCode: 'TH32101',
      subjectName: 'ภาษาไทย 3',
      className: 'ม.5/8',
      reason: 'นักเรียนส่งงานค้างส่งล่าช้าเนื่องจากลากิจเจ็บป่วย และได้รับอนุมัติใบลาเพิ่ม',
      requestedAt: '2026-07-20 14:32',
      status: 'PENDING'
    },
    {
      id: 'req-02',
      teacherId: 'teacher-somjai',
      teacherName: 'นางสาวสมใจ รักสอน',
      subjectCode: 'ว30101',
      subjectName: 'วิทยาศาสตร์กายภาพ',
      className: 'ม.4/1',
      reason: 'กรอกคะแนนผิดพลาดจากการสลับแถวเลขที่นักเรียน และได้ส่งบันทึกข้อความชี้แจงหัวหน้าสาระฯ แล้ว',
      requestedAt: '2026-07-21 09:15',
      status: 'PENDING'
    },
    {
      id: 'req-03',
      teacherId: 'teacher-mana',
      teacherName: 'นายมานะ บากบั่น',
      subjectCode: 'ค31101',
      subjectName: 'คณิตศาสตร์พื้นฐาน',
      className: 'ม.1/1',
      reason: 'ขอแก้ไขคะแนนเก็บกลางภาคย้อนหลัง',
      requestedAt: '2026-07-18 10:00',
      status: 'APPROVED',
      approvedUntil: '2026-07-19 10:00'
    }
  ]);

  // Toast states
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // จัดการ Toggle เปลี่ยนแปลงสถานะเปิดปิดทันที
  const handleToggleLock = (id: string) => {
    setLockConfigs(prev => prev.map(config => {
      if (config.id === id) {
        const nextState = !config.isOpen;
        triggerToast(`🔓 ปรับปรุงเป็น "${nextState ? 'เปิดระบบชั่วคราว' : 'ล็อกระบบเรียบร้อย'}" ทันที`);
        return { ...config, isOpen: nextState };
      }
      return config;
    }));
  };

  // จัดการบันทึกวันเวลาในฟอร์มกำหนดวันเวลาล็อก
  const handleConfigChange = (id: string, field: keyof GradeLockConfig, value: string | boolean) => {
    setLockConfigs(prev => prev.map(config => {
      if (config.id === id) {
        return { ...config, [field]: value };
      }
      return config;
    }));
  };

  // จัดการอนุมัติขอยื่นแก้ไขเกรดรายตัวครู
  const handleApproveRequest = (reqId: string, teacherName: string) => {
    // คำนวณวันหมดอายุอนุมัติ (24 ชั่วโมงถัดไป)
    const expirationTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const dateString = expirationTime.toISOString().replace('T', ' ').substring(0, 16);

    setRequests(prev => prev.map(req => {
      if (req.id === reqId) {
        return {
          ...req,
          status: 'APPROVED',
          approvedUntil: dateString
        };
      }
      return req;
    }));

    triggerToast(`✅ อนุมัติสิทธิ์ให้ครู ${teacherName} แก้ไขเกรดชั่วคราว (หมดอายุ: ${dateString})`);
  };

  // จัดการปฏิเสธคำร้อง
  const handleRejectRequest = (reqId: string, teacherName: string) => {
    setRequests(prev => prev.map(req => {
      if (req.id === reqId) {
        return {
          ...req,
          status: 'REJECTED'
        };
      }
      return req;
    }));

    triggerToast(`❌ ปฏิเสธคำขอของครู ${teacherName} เรียบร้อย`);
  };

  // บันทึกการตั้งค่าปีการศึกษา
  const handleSaveAcademicYear = () => {
    triggerToast(`💾 บันทึกปีการศึกษาปัจจุบันเป็น ${academicYear} ภาคเรียนที่ ${semester} สำเร็จ`);
  };

  return (
    <div className="bg-[#0a0f16] border border-white/5 rounded-2xl p-6 min-h-[600px] flex flex-col space-y-6 relative overflow-hidden text-slate-100">
      
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-rose-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 duration-300">
          <div className="bg-slate-900/95 border border-indigo-500/30 text-indigo-300 px-4 py-3 rounded-xl shadow-[0_4px_25px_rgba(99,102,241,0.25)] flex items-center gap-2 text-xs font-semibold backdrop-blur-md">
            <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
            {toastMessage}
          </div>
        </div>
      )}

      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-white/5 pb-5">
        <div>
          <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-wider mb-1.5">
            <Lock className="w-4 h-4" />
            <span>Time-based Lock Management Interface</span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            ระบบความปลอดภัยและควบคุมเวลาส่งเกรด
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            ควบคุมการเปิด-ปิดสิทธิ์กรอกคะแนนตามวันเวลาที่กำหนด พร้อมการอนุมัติเปิดระบบรายบุคคลชั่วคราว
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* คอลัมน์ซ้าย (1): Academic Year Config & Grade Lock Controllers */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* 1. Academic Year & Semester Config */}
          <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-white/5 pb-2.5">
              <Calendar className="w-4.5 h-4.5 text-indigo-400" />
              กำหนดภาคเรียนและปีการศึกษาปัจจุบัน (Active Term)
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">ปีการศึกษาปัจจุบัน</label>
                <select
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-xs text-slate-200 outline-none focus:border-indigo-500"
                >
                  <option value="2567">2567</option>
                  <option value="2568">2568</option>
                  <option value="2569">2569 (ปัจจุบัน)</option>
                  <option value="2570">2570</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">ภาคเรียนที่ (Semester)</label>
                <select
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-xs text-slate-200 outline-none focus:border-indigo-500"
                >
                  <option value="1">ภาคเรียนที่ 1</option>
                  <option value="2">ภาคเรียนที่ 2</option>
                  <option value="3">ภาคเรียนพิเศษ (ฤดูร้อน)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleSaveAcademicYear}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all shadow-md active:scale-[0.98]"
              >
                <Save className="w-4 h-4" />
                <span>บันทึกสถานะปีการศึกษา</span>
              </button>
            </div>
          </div>

          {/* 2. Grade Entry Time-Window Settings (ตั้งค่าเปิด-ปิดระบบกรอกเกรด) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Clock className="w-4.5 h-4.5 text-rose-400" />
                ตารางเวลาเปิด-ปิดสิทธิ์และกรอกเกรดอัตโนมัติ
              </h3>
              <span className="text-[10px] text-slate-500">ควบคุมความสมบูรณ์ในการปิดรับผลคะแนน</span>
            </div>

            <div className="space-y-4">
              {lockConfigs.map((config) => (
                <div 
                  key={config.id}
                  className={`border rounded-2xl p-5 transition-all ${
                    config.isOpen 
                      ? 'bg-slate-900/30 border-indigo-500/20 shadow-[0_4px_20px_rgba(99,102,241,0.05)]' 
                      : 'bg-[#151921]/30 border-white/5 opacity-80'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-white/5 pb-4 mb-4">
                    <div>
                      <h4 className="text-xs font-bold text-white flex items-center gap-2">
                        {config.isOpen ? (
                          <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Lock className="w-3.5 h-3.5 text-rose-400" />
                        )}
                        {config.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">{config.description}</p>
                    </div>

                    {/* Toggle Switch (เปิด/ปิด ระบบทันที) */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] font-bold ${config.isOpen ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {config.isOpen ? 'เปิดระบบอยู่' : 'ล็อกเรียบร้อย'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleToggleLock(config.id)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          config.isOpen ? 'bg-indigo-600' : 'bg-slate-750'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            config.isOpen ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Date-Time Pickers (กำหนดวัน-เวลาเปิด และวัน-เวลาปิดระบบ) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    
                    {/* วันเวลาที่เปิด */}
                    <div className="space-y-1.5">
                      <label className="block text-[10px] text-slate-400 font-semibold">วัน-เวลาที่เปิดระบบ (Start Window)</label>
                      <div className="flex gap-2">
                        <input
                          type="date"
                          value={config.startDate}
                          onChange={(e) => handleConfigChange(config.id, 'startDate', e.target.value)}
                          className="flex-1 bg-slate-950 border border-white/10 rounded-lg p-2 text-xs text-slate-200 outline-none"
                        />
                        <input
                          type="time"
                          value={config.startTime}
                          onChange={(e) => handleConfigChange(config.id, 'startTime', e.target.value)}
                          className="w-24 bg-slate-950 border border-white/10 rounded-lg p-2 text-xs text-slate-200 outline-none"
                        />
                      </div>
                    </div>

                    {/* วันเวลาที่ปิด */}
                    <div className="space-y-1.5">
                      <label className="block text-[10px] text-rose-300 font-semibold">วัน-เวลาที่ล็อกระบบ (Auto-Lock Time)</label>
                      <div className="flex gap-2">
                        <input
                          type="date"
                          value={config.endDate}
                          onChange={(e) => handleConfigChange(config.id, 'endDate', e.target.value)}
                          className="flex-1 bg-slate-950 border border-white/10 rounded-lg p-2 text-xs text-slate-200 outline-none focus:border-rose-500"
                        />
                        <input
                          type="time"
                          value={config.endTime}
                          onChange={(e) => handleConfigChange(config.id, 'endTime', e.target.value)}
                          className="w-24 bg-slate-950 border border-white/10 rounded-lg p-2 text-xs text-slate-200 outline-none focus:border-rose-500"
                        />
                      </div>
                    </div>

                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* คอลัมน์ขวา (2): Exception Request System (ระบบอนุมัติขอยื่นแก้ไขเกรดหลังกำหนดเวลา) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
              <Hourglass className="w-4 h-4 text-amber-400" />
              คำร้องขออนุมัติยื่นแก้ไขคะแนนย้อนหลัง
            </h3>
            <span className="text-[10px] font-mono bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20">
              {requests.filter(r => r.status === 'PENDING').length} รายการค้าง
            </span>
          </div>

          <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
            {requests.map((req) => (
              <div 
                key={req.id}
                className={`p-4 border rounded-2xl flex flex-col space-y-3 transition-colors ${
                  req.status === 'PENDING'
                    ? 'bg-amber-500/[0.02] border-amber-500/20'
                    : req.status === 'APPROVED'
                    ? 'bg-emerald-500/[0.01] border-emerald-500/10 opacity-75'
                    : 'bg-slate-900/20 border-white/5 opacity-60'
                }`}
              >
                {/* แถวผู้ขอ และ วันเวลาที่ยื่นคำขอ */}
                <div className="flex justify-between items-start gap-2 border-b border-white/5 pb-2.5">
                  <div>
                    <span className="text-[10px] text-slate-500 font-mono block">Ticket: {req.id} • ยื่นเมื่อ {req.requestedAt}</span>
                    <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5 mt-0.5">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      {req.teacherName}
                    </h4>
                  </div>
                  
                  {/* Status Badges */}
                  <div>
                    {req.status === 'PENDING' && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded">
                        รอพิจารณา
                      </span>
                    )}
                    {req.status === 'APPROVED' && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
                        อนุมัติแก้ไขแล้ว
                      </span>
                    )}
                    {req.status === 'REJECTED' && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-800 text-slate-400 border border-slate-700 rounded">
                        ปฏิเสธ
                      </span>
                    )}
                  </div>
                </div>

                {/* รายละเอียดวิชา */}
                <div className="bg-slate-950/40 p-2.5 rounded-lg border border-white/5 space-y-1">
                  <div className="text-[11px] text-indigo-300">
                    วิชา: <span className="font-mono font-bold">{req.subjectCode}</span> {req.subjectName} ({req.className})
                  </div>
                  <p className="text-[10.5px] text-slate-400 leading-normal font-light">
                    <strong>เหตุผล:</strong> {req.reason}
                  </p>
                </div>

                {/* ปุ่ม Action (อนุมัติ / ปฏิเสธ) */}
                {req.status === 'PENDING' ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleRejectRequest(req.id, req.teacherName)}
                      className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-750 border border-white/5 text-slate-300 text-[10.5px] font-bold rounded-xl transition-all"
                    >
                      ปฏิเสธคำขอ
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApproveRequest(req.id, req.teacherName)}
                      className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10.5px] font-bold rounded-xl transition-all shadow-md"
                    >
                      อนุมัติ (24 ชม.)
                    </button>
                  </div>
                ) : (
                  req.status === 'APPROVED' && req.approvedUntil && (
                    <div className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1.5 rounded-xl flex items-center gap-1.5">
                      <Unlock className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                      <span>ปลดล็อกระบบชั่วคราวให้แก้ไขได้ถึง: <strong>{req.approvedUntil}</strong></span>
                    </div>
                  )
                )}
              </div>
            ))}

            {requests.length === 0 && (
              <p className="text-xs text-slate-500 italic text-center py-8">ไม่มีคำร้องขอปลดล็อกสิทธิ์ย้อนหลัง</p>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
