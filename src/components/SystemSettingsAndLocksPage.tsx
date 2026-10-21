import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { SchoolCalendarSection } from './admin/SchoolCalendarSection';
import { StudentEmailFormatSection } from './admin/StudentEmailFormatSection';
import { CourseRankLevelsSection } from './admin/CourseRankLevelsSection';
import { BillingPaymentInfoSection } from './admin/BillingPaymentInfoSection';
import { GuidanceStatusSection } from './admin/GuidanceStatusSection';
import { PublicSummarySection } from './admin/PublicSummarySection';
import { DatePicker } from './shared/DatePicker';
import { TimePicker } from './shared/TimePicker';
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

import { DeadlineCountdown } from './shared/DeadlineCountdown';
import { gradeLockDeadlines } from '../lib/gradeLockWindow';

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

export function SystemSettingsAndLocksPage() {
  // 1. Academic Year & Semester Config
  // ว่างจนกว่าจะอ่านจาก school_settings/academic_year ได้ — ไม่เดาปี/ภาคเรียนให้
  const [academicYear, setAcademicYear] = useState('');
  const [semester, setSemester] = useState('');
  const [yearLoaded, setYearLoaded] = useState(false);
  const thisBuddhistYear = new Date().getFullYear() + 543;
  const yearOptions = [-2, -1, 0, 1].map(d => String(thisBuddhistYear + d));

  // 2. Grade Entry Time-Window Settings
  // โครงช่วงเวลาเท่านั้น — วัน/เวลาว่างและล็อกไว้จนกว่าแอดมินจะตั้งเอง (ไม่ฝังวันที่สมมติ)
  const [lockConfigs, setLockConfigs] = useState<GradeLockConfig[]>([
    { id: 'midterm', title: 'คะแนนเก็บกลางภาค (Midterm Assessment)', description: 'ระบบลงคะแนนและเกณฑ์วัดผลย่อย กลางภาคเรียน', isOpen: false, startDate: '', startTime: '', endDate: '', endTime: '' },
    { id: 'final', title: 'คะแนนสอบปลายภาค (Final Assessment)', description: 'ระบบลงคะแนนสอบรวบยอด และเกรดสรุปปลายภาคเรียน', isOpen: false, startDate: '', startTime: '', endDate: '', endTime: '' },
    { id: 'desirable', title: 'การประเมินคุณลักษณะอันพึงประสงค์ & อ่านคิดวิเคราะห์', description: 'ระบบประเมินคุณลักษณะ 8 ประการ และการอ่าน คิด วิเคราะห์ เขียน', isOpen: false, startDate: '', startTime: '', endDate: '', endTime: '' },
  ]);

  // Toast states
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Sync settings with Firestore on mount
  useEffect(() => {
    // 1. System Locks
    const unsubscribeLocks = onSnapshot(doc(db, 'school_settings', 'system_locks'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data && Array.isArray(data.lockConfigs)) {
          setLockConfigs(data.lockConfigs);
        }
      }
    }, (err) => console.warn('Firestore system_locks subscription notice:', err));

    // 2. Academic Year
    const unsubscribeYear = onSnapshot(doc(db, 'school_settings', 'academic_year'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data?.academicYear) setAcademicYear(String(data.academicYear));
        if (data?.semester) setSemester(String(data.semester));
        setYearLoaded(true);
      }
    }, (err) => console.warn('Firestore academic_year subscription notice:', err));

    return () => {
      unsubscribeLocks();
      unsubscribeYear();
    };
  }, []);

  // จัดการ Toggle เปลี่ยนแปลงสถานะเปิดปิดทันที
  const handleToggleLock = async (id: string) => {
    const updatedConfigs = lockConfigs.map(config => {
      if (config.id === id) {
        return { ...config, isOpen: !config.isOpen };
      }
      return config;
    });

    const target = updatedConfigs.find(c => c.id === id);
    try {
      await setDoc(doc(db, 'school_settings', 'system_locks'), {
        lockConfigs: updatedConfigs,
        updatedAt: serverTimestamp()
      }, { merge: true });
      setLockConfigs(updatedConfigs);
      triggerToast(`ปรับปรุงเป็น "${target?.isOpen ? 'เปิดระบบ' : 'ล็อกระบบ'}" เรียบร้อย`);
    } catch (err) {
      console.error('[system_locks] save failed:', err);
      triggerToast('⚠️ บันทึกไม่สำเร็จ — ตรวจสอบสิทธิ์ผู้ดูแลระบบและการเชื่อมต่อ แล้วลองใหม่');
    }
  };

  // จัดการบันทึกวันเวลาในฟอร์มกำหนดวันเวลาล็อก
  const handleConfigChange = (id: string, field: keyof GradeLockConfig, value: string | boolean) => {
    const updated = lockConfigs.map(config => {
      if (config.id === id) {
        return { ...config, [field]: value };
      }
      return config;
    });
    setLockConfigs(updated);

    setDoc(doc(db, 'school_settings', 'system_locks'), {
      lockConfigs: updated,
      updatedAt: serverTimestamp()
    }, { merge: true }).catch(err => {
      console.error('[system_locks] save failed:', err);
      triggerToast('⚠️ บันทึกวัน-เวลาไม่สำเร็จ — ตรวจสอบสิทธิ์และการเชื่อมต่อ แล้วลองใหม่');
    });
  };

  // บันทึกการตั้งค่าปีการศึกษา
  const handleSaveAcademicYear = async () => {
    if (!academicYear || !semester) {
      triggerToast('⚠️ เลือกปีการศึกษาและภาคเรียนก่อนบันทึก');
      return;
    }
    try {
      await setDoc(doc(db, 'school_settings', 'academic_year'), {
        academicYear,
        semester,
        updatedAt: serverTimestamp()
      }, { merge: true });
      setYearLoaded(true);
      triggerToast(`บันทึกปีการศึกษาปัจจุบันเป็น ${academicYear} ภาคเรียนที่ ${semester} สำเร็จ`);
    } catch (err) {
      console.error('[academic_year] save failed:', err);
      triggerToast('⚠️ บันทึกปีการศึกษาไม่สำเร็จ — ตรวจสอบสิทธิ์ผู้ดูแลระบบและการเชื่อมต่อ แล้วลองใหม่');
    }
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

      <div className="grid grid-cols-1 gap-6">
        
        {/* คอลัมน์ซ้าย (1): Academic Year Config & Grade Lock Controllers */}
        <div className="space-y-6">
          
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
                  <option value="">— ยังไม่ได้ตั้งค่า —</option>
                  {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">ภาคเรียนที่ (Semester)</label>
                <select
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-xs text-slate-200 outline-none focus:border-indigo-500"
                >
                  <option value="">— ยังไม่ได้ตั้งค่า —</option>
                  <option value="1">ภาคเรียนที่ 1</option>
                  <option value="2">ภาคเรียนที่ 2</option>
                  <option value="3">ภาคเรียนพิเศษ (ฤดูร้อน)</option>
                </select>
              </div>
            </div>

            {!yearLoaded && (
              <p className="text-[11px] text-amber-300">ยังไม่ได้ตั้งค่าปีการศึกษาปัจจุบันในระบบ — เลือกแล้วกดบันทึก</p>
            )}
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

          {/* 1.5 ปฏิทินโรงเรียน — วันหยุดพิเศษ + วันเปิด-ปิดภาคเรียน (school_calendar_events —
              collection แยกจาก school_settings/system_locks ด้านบนโดยตั้งใจ ดู SchoolCalendarSection.tsx) */}
          <SchoolCalendarSection />

          {/* 1.6 รูปแบบอีเมลนักเรียน — school_settings/studentEmailFormat (client + blocking function อ่านค่าเดียวกัน) */}
          <StudentEmailFormatSection />
          <BillingPaymentInfoSection />

          {/* 1.7 สถานะครูแนะแนว — school_settings/guidance_status (อ่านสด + ปุ่ม refreshGuidanceStatus) */}
          <GuidanceStatusSection />
          <PublicSummarySection />

          {/* 1.8 เกณฑ์เครื่องหมายเชิดชูรายวิชา (แรงค์จากคะแนนกิจกรรม) — school_settings/course_rank_levels */}
          <CourseRankLevelsSection />

          {/* 2. Grade Entry Time-Window Settings (ตั้งค่าเปิด-ปิดระบบกรอกเกรด) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Clock className="w-4.5 h-4.5 text-rose-400" />
                ตารางเวลาเปิด-ปิดสิทธิ์และกรอกเกรดอัตโนมัติ
              </h3>
              <span className="text-[10px] text-slate-500">ควบคุมความสมบูรณ์ในการปิดรับผลคะแนน</span>
            </div>
            <p className="text-[11px] text-amber-300/90 bg-amber-500/5 border border-amber-500/20 rounded-xl px-3 py-2">
              หมายเหตุ: ค่าในส่วนนี้ถูกบันทึกไว้แล้ว แต่ขณะนี้หน้ากรอกคะแนนของครูยังไม่ได้อ่านไปบังคับล็อกอัตโนมัติ
            </p>

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
                      {gradeLockDeadlines([config], Date.now()).map(d => (
                        <span key={d.id}><DeadlineCountdown targetMs={d.targetMs} label={d.kind === 'OPENS' ? 'เปิดใน' : 'ล็อกใน'} /></span>
                      ))}
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
                        <div className="flex-1"><DatePicker value={config.startDate} onChange={(v) => handleConfigChange(config.id, 'startDate', v)} ariaLabel="วันที่เปิดระบบ" openAtToday className="w-full bg-slate-950 border border-white/10 rounded-lg p-2 text-xs text-slate-200 outline-none flex items-center gap-2 text-left cursor-pointer" /></div>
                        <TimePicker value={config.startTime} onChange={(v) => handleConfigChange(config.id, 'startTime', v)} ariaLabel="เวลาเปิดระบบ" className="bg-slate-950 border border-white/10 rounded-lg p-2 text-xs text-slate-200 outline-none" />
                      </div>
                    </div>

                    {/* วันเวลาที่ปิด */}
                    <div className="space-y-1.5">
                      <label className="block text-[10px] text-rose-300 font-semibold">วัน-เวลาที่ล็อกระบบ (Auto-Lock Time)</label>
                      <div className="flex gap-2">
                        <div className="flex-1"><DatePicker value={config.endDate} onChange={(v) => handleConfigChange(config.id, 'endDate', v)} ariaLabel="วันที่ล็อกระบบ" openAtToday className="w-full bg-slate-950 border border-white/10 rounded-lg p-2 text-xs text-slate-200 outline-none focus:border-rose-500 flex items-center gap-2 text-left cursor-pointer" /></div>
                        <TimePicker value={config.endTime} onChange={(v) => handleConfigChange(config.id, 'endTime', v)} ariaLabel="เวลาล็อกระบบ" className="bg-slate-950 border border-white/10 rounded-lg p-2 text-xs text-slate-200 outline-none focus-within:border-rose-500" />
                      </div>
                    </div>

                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
