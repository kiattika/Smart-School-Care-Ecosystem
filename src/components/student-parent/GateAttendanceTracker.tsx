import React, { useEffect, useState } from 'react';
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
import {
  subscribeGateAttendanceLogs,
  subscribeLeaveRequests,
  createLeaveRequest,
  acknowledgeLeaveRequest,
  createParentNotification,
} from '../../services/firestoreService';
import { countLeaveDays, canParentAcknowledge, leaveStatusLabel, normalizeLeaveStatus, LEAVE_REASON_MAX, validateLeaveForm } from '../../lib/leaveFlow';
import { DatePicker } from '../shared/DatePicker';
import { NoStudentNotice } from './NoStudentNotice';
import { attendanceStatsFromCounts } from '../../lib/studentAttendanceStats';

type GateAttendanceTrackerProps = { studentId: string; student?: Student; isParentView?: boolean };

/** ไม่มีนักเรียนจริง = empty state (ห้าม fallback เป็นนักเรียนปลอม/คนแรกของ store — อาจเป็นลูกคนอื่น) */
export function GateAttendanceTracker(props: GateAttendanceTrackerProps) {
  const students = useStore(s => s.students);
  const student = props.student || students.find(s => s.studentId === props.studentId);
  if (!student) return <NoStudentNotice />;
  return <GateAttendanceTrackerInner {...props} student={student} />;
}

function GateAttendanceTrackerInner({ studentId, student: studentProp, isParentView = false }: GateAttendanceTrackerProps) {
  const {
    students,
    courses,
    user
  } = useStore();

  // ประวัติผ่านประตูจริงจาก Firestore แบบ real-time — เดิมอ่านจาก store.gateAttendanceLogs
  // (session-local: ผู้ปกครองเห็นเฉพาะรายการที่เช็คอินในเซสชันเดียวกันเท่านั้น เปิดหน้าใหม่แล้วหาย)
  // filter ฝั่ง query ให้ผ่าน firestore.rules: parentUid สำหรับผู้ปกครอง, studentUid สำหรับนักเรียน
  const [gateAttendanceLogs, setGateAttendanceLogs] = useState<GateAttendanceRecord[]>([]);
  useEffect(() => {
    if (!user?.uid) { setGateAttendanceLogs([]); return; }
    return subscribeGateAttendanceLogs(
      setGateAttendanceLogs,
      isParentView ? { parentUid: user.uid } : { studentUid: user.uid },
    );
  }, [user?.uid, isParentView]);

  const student = studentProp as Student;
  const logs = gateAttendanceLogs.filter(l => l.studentId === student.studentId);
  // ใบลาจริงจาก Firestore แบบ real-time — นักเรียนอ่านด้วย studentUid, ผู้ปกครองด้วย parentUid (ตรงกับ firestore.rules)
  const [allLeaves, setAllLeaves] = useState<DetailedLeaveRequest[]>([]);
  useEffect(() => {
    if (!user?.uid) { setAllLeaves([]); return; }
    return subscribeLeaveRequests(setAllLeaves, isParentView ? { parentUid: user.uid } : { studentUid: user.uid });
  }, [user?.uid, isParentView]);
  const leaves = allLeaves.filter(l => l.studentId === student.studentId);

  const [activeTab, setActiveTab] = useState<'gate' | 'subject' | 'leave'>('gate');
  const [isGPSModalOpen, setIsGPSModalOpen] = useState(false);

  // e-Leave form state — เริ่มว่าง (ไม่เติมวันที่/ไฟล์แนบสมมติ)
  const [leaveType, setLeaveType] = useState<'SICK' | 'PERSONAL' | 'ACTIVITY'>('SICK');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveSubmitSuccess, setLeaveSubmitSuccess] = useState<string | null>(null);
  const [leaveSubmitError, setLeaveSubmitError] = useState<string | null>(null);
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);
  const [ackBusyId, setAckBusyId] = useState<string | null>(null);

  const leaveDays = countLeaveDays(startDate, endDate);

  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLeaveSubmitSuccess(null);
    setLeaveSubmitError(null);
    if (!user?.uid) { setLeaveSubmitError('ไม่พบข้อมูลผู้ใช้ — เข้าสู่ระบบใหม่แล้วลองอีกครั้ง'); return; }
    const errs = validateLeaveForm({ leaveType, startDate, endDate, reason: leaveReason });
    if (errs.length > 0) { setLeaveSubmitError(errs.join(' · ')); return; }
    setLeaveSubmitting(true);
    try {
      const created = await createLeaveRequest({
        student: {
          studentId: student.studentId,
          studentUid: student.studentUid || '',
          parentUid: student.parentUid || null,
          room: student.room || '',
        },
        submitter: { role: isParentView ? 'parent' : 'student', uid: user.uid, name: isParentView ? `ผู้ปกครองของ ${student.name}` : student.name },
        form: { leaveType, startDate, endDate, reason: leaveReason },
      });
      // แจ้งผู้ปกครอง (เมื่อนักเรียนยื่นเอง) ให้กดรับทราบ — แจ้งเตือนเป็นผลพลอยได้ ไม่ทำให้การยื่นล้มเหลว
      if (!isParentView && created.parentUid) {
        createParentNotification({
          parentUid: created.parentUid,
          studentUid: created.studentUid,
          studentId: created.studentId,
          studentName: student.name,
          title: '📝 บุตรหลานยื่นใบลา — รอท่านรับทราบ',
          message: `${student.name} ยื่นใบลา${created.leaveType === 'SICK' ? 'ป่วย' : created.leaveType === 'PERSONAL' ? 'กิจ' : 'กิจกรรม'} ${created.startDate}${created.startDate !== created.endDate ? ` ถึง ${created.endDate}` : ''} (${created.totalDays} วัน) กรุณากด "รับทราบ" ที่แท็บใบลา เพื่อส่งต่อครูที่ปรึกษา`,
          type: 'warning',
        }).catch(err => console.warn('[leave] parent notification failed:', err));
      }
      setLeaveReason('');
      setStartDate('');
      setEndDate('');
      setLeaveSubmitSuccess(
        isParentView ? 'ส่งใบลาถึงครูที่ปรึกษาแล้ว'
          : created.parentUid ? 'ยื่นใบลาแล้ว — รอผู้ปกครองรับทราบ จึงจะส่งต่อครูที่ปรึกษา'
          : 'ยื่นใบลาแล้ว — ส่งถึงครูที่ปรึกษา (ยังไม่มีผู้ปกครองเชื่อมบัญชีกับนักเรียนคนนี้)'
      );
    } catch (err: any) {
      setLeaveSubmitError(err?.message || 'ยื่นใบลาไม่สำเร็จ ลองอีกครั้ง');
    } finally {
      setLeaveSubmitting(false);
    }
  };

  const handleAcknowledge = async (leave: DetailedLeaveRequest) => {
    if (!user?.uid) return;
    setAckBusyId(leave.id);
    setLeaveSubmitError(null);
    try {
      await acknowledgeLeaveRequest(leave.id, user.uid);
      // แจ้งนักเรียน (เจ้าของใบลา) ว่าผู้ปกครองรับทราบแล้วและส่งต่อครูที่ปรึกษา — ผลพลอยได้ ไม่ทำให้การรับทราบล้มเหลว
      createParentNotification({
        parentUid: leave.parentUid || user.uid,
        studentUid: leave.studentUid || student.studentUid,
        studentId: leave.studentId,
        studentName: student.name,
        title: '👍 ผู้ปกครองรับทราบใบลาแล้ว',
        message: `ผู้ปกครองรับทราบใบลาวันที่ ${leave.startDate}${leave.startDate !== leave.endDate ? ` ถึง ${leave.endDate}` : ''} แล้ว — ส่งต่อให้ครูที่ปรึกษาพิจารณา`,
        type: 'info',
      }).catch(err => console.warn('[leave] ack notification failed:', err));
    } catch (err: any) {
      setLeaveSubmitError(err?.message || 'รับทราบไม่สำเร็จ ลองอีกครั้ง');
    } finally {
      setAckBusyId(null);
    }
  };

  // สถิติการเข้าเรียนสะสมจริงจาก students/{id}.attendanceStats (derived cache ที่ sync คู่กับ attendance_records)
  // ยังไม่มีสถิติแยกรายวิชา: attendance_records เก็บเป็นเอกสารต่อห้อง/คาบ ผู้ปกครอง-นักเรียนอ่านตรงไม่ได้ตาม rules
  const attStats = attendanceStatsFromCounts(student.studentId, student.attendanceStats);

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
          <span>สถิติการเข้าเรียน</span>
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
          {/* Real-time Gate Logs Timeline */}
          <div className="lg:col-span-12 bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-md shadow-xl flex flex-col">
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
        <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-md shadow-xl space-y-5" data-testid="attendance-stats">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-400" />
              สถิติการเข้าเรียนสะสม
            </h3>
            <p className="text-[11px] text-slate-400">
              นับจากการเช็คชื่อจริงทุกครั้งที่ครูบันทึก (ไม่นับ "ลา" ในอัตราการเข้าเรียน) — เกณฑ์เดิมของระบบคือไม่ต่ำกว่า {attStats.threshold}%
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center text-[11px]">
            <div className="bg-slate-800/50 border border-slate-800 rounded-2xl p-3">
              <span className="text-slate-400 block">มาเรียน</span>
              <span className="text-lg font-black text-emerald-400">{attStats.present}</span>
            </div>
            <div className="bg-slate-800/50 border border-slate-800 rounded-2xl p-3">
              <span className="text-slate-400 block">มาสาย</span>
              <span className="text-lg font-black text-amber-400">{attStats.late}</span>
            </div>
            <div className="bg-slate-800/50 border border-slate-800 rounded-2xl p-3">
              <span className="text-slate-400 block">ลา</span>
              <span className="text-lg font-black text-blue-400">{attStats.leave}</span>
            </div>
            <div className="bg-slate-800/50 border border-slate-800 rounded-2xl p-3">
              <span className="text-slate-400 block">ขาด</span>
              <span className="text-lg font-black text-rose-400">{attStats.absent}</span>
            </div>
            <div className="col-span-2 sm:col-span-1 bg-slate-800/50 border border-slate-800 rounded-2xl p-3">
              <span className="text-slate-400 block">อัตราเข้าเรียน</span>
              <span className={`text-lg font-black ${attStats.isBelowThreshold ? 'text-amber-400' : 'text-emerald-400'}`}>
                {attStats.attendanceRate !== null ? `${attStats.attendanceRate}%` : '—'}
              </span>
            </div>
          </div>

          {attStats.attendanceRate === null && (
            <p className="text-[11px] text-slate-400 text-center">ยังไม่มีข้อมูลเช็คชื่อของนักเรียนคนนี้</p>
          )}
          {attStats.isBelowThreshold && (
            <p role="alert" className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
              อัตราการเข้าเรียนต่ำกว่าเกณฑ์ {attStats.threshold}% — ควรติดตามกับครูที่ปรึกษา
            </p>
          )}
          <p className="text-[11px] text-slate-500">
            สถิติแยกรายวิชายังไม่เปิดให้ดูในหน้านี้ ขณะนี้แสดงเฉพาะยอดรวมทุกวิชา
          </p>
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
              นักเรียนหรือผู้ปกครองยื่นใบลาป่วย/ลากิจ/ลากิจกรรมได้ที่นี่ (ยังไม่รองรับการแนบไฟล์ — ส่งเอกสารให้ครูที่ปรึกษาโดยตรง)
            </p>

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
                  <DatePicker value={startDate} onChange={setStartDate} ariaLabel="ตั้งแต่วันที่" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 flex items-center gap-2 text-left cursor-pointer" />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-300 block mb-1">ถึงวันที่:</label>
                  <DatePicker value={endDate} onChange={setEndDate} ariaLabel="ถึงวันที่" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 flex items-center gap-2 text-left cursor-pointer" />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">เหตุผลและรายละเอียดการลา:</label>
                <textarea
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  placeholder="ระบุอาการป่วย หรือสาเหตุความจำเป็นในการลากิจ..."
                  rows={3}
                  maxLength={LEAVE_REASON_MAX}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500 resize-none"
                  required
                ></textarea>
              </div>

              {leaveDays > 0 && <p className="text-[11px] text-slate-400">รวม {leaveDays} วัน</p>}
              {leaveSubmitError && <p role="alert" className="text-[11px] text-rose-400">{leaveSubmitError}</p>}
              {leaveSubmitSuccess && <p role="status" className="text-[11px] text-emerald-400">{leaveSubmitSuccess}</p>}
              <p className="text-[10px] text-slate-500">
                {isParentView ? 'ใบลาที่ผู้ปกครองยื่น จะส่งถึงครูที่ปรึกษาทันที' : 'ใบลาที่นักเรียนยื่น ผู้ปกครองต้องกดรับทราบก่อน จึงจะส่งต่อครูที่ปรึกษา'}
              </p>
              <button
                type="submit"
                disabled={leaveSubmitting}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:opacity-60 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{leaveSubmitting ? 'กำลังบันทึก…' : 'ส่งใบลาออนไลน์ (Submit Leave Request)'}</span>
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
                  <p className="text-[11px] text-slate-400">ใบลาจะถึงครูที่ปรึกษาตามลำดับขั้น และเห็นสถานะที่นี่แบบเรียลไทม์</p>
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
                        normalizeLeaveStatus(item.status) === 'APPROVED' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                        normalizeLeaveStatus(item.status) === 'REJECTED' ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' :
                        'bg-amber-500/10 border-amber-500/30 text-amber-400'
                      }`}>
                        {normalizeLeaveStatus(item.status) === 'APPROVED' ? '✅ ' : normalizeLeaveStatus(item.status) === 'REJECTED' ? '❌ ' : '⏳ '}
                        {leaveStatusLabel(item.status, { noParentLinked: item.noParentLinked })}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
                      {item.reason}
                    </p>

                    <div className="text-[10px] text-slate-500">
                      ยื่นโดย {item.submittedBy}{item.parentAcknowledgedAt ? ' · ผู้ปกครองรับทราบแล้ว' : ''}
                    </div>

                    {item.teacherRemarks && (
                      <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800/80 flex items-center justify-between">
                        <span>ความเห็นครู: {item.teacherRemarks}</span>
                        {item.decidedBy && <span className="text-[10px] text-emerald-400">({item.decidedBy})</span>}
                      </div>
                    )}
                    {!item.teacherRemarks && item.decidedBy && (
                      <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                        ตัดสินโดย {item.decidedBy}
                      </div>
                    )}

                    {/* ผู้ปกครองกดรับทราบใบที่นักเรียนยื่น — ส่งต่อครูที่ปรึกษา (นักเรียน/ครูไม่เห็นปุ่มนี้) */}
                    {isParentView && canParentAcknowledge(item.status) && (
                      <div className="pt-2 flex justify-end">
                        <button
                          onClick={() => handleAcknowledge(item)}
                          disabled={ackBusyId === item.id}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white rounded-xl text-xs font-bold transition-all shadow cursor-pointer flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{ackBusyId === item.id ? 'กำลังบันทึก…' : 'รับทราบและส่งต่อครูที่ปรึกษา'}</span>
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
