import React, { useState } from 'react';
import { CalendarClock, CheckCircle, XCircle } from 'lucide-react';
import { useStore } from '../../store';
import { respondAppointment, completeAppointment, createParentNotification } from '../../services/firestoreService';
import {
  APPOINTMENT_MEETING_LABEL, APPOINTMENT_NOTE_MAX, APPOINTMENT_PLACE_MAX, APPOINTMENT_RECIPIENT_LABEL,
  canCompleteAppointment, canRespondAppointment,
} from '../../lib/appointmentFlow';
import type { ParentAppointment, Student } from '../../types';

/**
 * กล่องคำขอนัดพบจากผู้ปกครอง — ใช้ร่วมกันของครูที่ปรึกษา (AdvisorPortal) และครูแนะแนว (GuidancePortal)
 * ข้อมูลจริงจาก Firestore ส่งมาเป็น prop (ผู้เรียก subscribe ด้วยเงื่อนไขที่ตรง rules) — ตอบรับ/ปฏิเสธเขียนจริงพร้อมชื่อ/staffId ของผู้กดจริง
 * แล้วแจ้งผู้ปกครองเป็นผลพลอยได้ (ไม่ทำให้การตอบล้มเหลวถ้าแจ้งไม่สำเร็จ)
 */
export function AppointmentInbox({ appointments, students }: { appointments: ParentAppointment[]; students: Student[] }) {
  const user = useStore(s => s.user);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [places, setPlaces] = useState<Record<string, string>>({});

  const pending = appointments.filter(a => canRespondAppointment(a.status));
  const confirmed = appointments.filter(a => canCompleteAppointment(a.status));

  const notifyParent = (apt: ParentAppointment, title: string, message: string, type: 'info' | 'warning') => {
    const student = students.find(s => s.studentId === apt.studentId);
    createParentNotification({
      parentUid: apt.parentUid,
      studentUid: apt.studentUid,
      studentId: apt.studentId,
      studentName: student?.name || apt.studentId,
      title,
      message,
      type,
    }).catch(err => console.warn('[appointment] notification failed:', err));
  };

  const respond = async (apt: ParentAppointment, decision: 'CONFIRMED' | 'DECLINED') => {
    if (!user?.displayName) { setError('ไม่พบข้อมูลผู้ใช้ — เข้าสู่ระบบใหม่แล้วลองอีกครั้ง'); return; }
    setBusyId(apt.id);
    setError(null);
    try {
      await respondAppointment(apt.id, decision, { name: user.displayName, staffId: user.staffId }, {
        meetingType: apt.meetingType,
        locationOrLink: places[apt.id] || '',
        teacherNote: notes[apt.id] || '',
      });
      const when = `${apt.preferredDate} ${apt.timeSlot}`;
      if (decision === 'CONFIRMED') {
        notifyParent(apt, '✅ ครูยืนยันนัดพบแล้ว', `${user.displayName} ยืนยันนัดพบวันที่ ${when} — ดูสถานที่/ลิงก์ได้ที่เมนูนัดพบครู`, 'info');
      } else {
        notifyParent(apt, 'ครูไม่สะดวกตามเวลาที่ขอ', `${user.displayName} ไม่สะดวกนัดวันที่ ${when}${notes[apt.id] ? ` — ${notes[apt.id]}` : ''} ขอนัดใหม่ได้ที่เมนูนัดพบครู`, 'warning');
      }
    } catch (err: any) {
      setError(err?.message || 'บันทึกไม่สำเร็จ ลองอีกครั้ง');
    } finally {
      setBusyId(null);
    }
  };

  const complete = async (apt: ParentAppointment) => {
    setBusyId(apt.id);
    setError(null);
    try {
      await completeAppointment(apt.id);
    } catch (err: any) {
      setError(err?.message || 'บันทึกไม่สำเร็จ ลองอีกครั้ง');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="bg-[#1c1f2b] border border-white/10 rounded-xl overflow-hidden flex flex-col shadow-lg" data-testid="appointment-inbox">
      <div className="p-4 border-b border-white/10 bg-slate-900/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-5 h-5 text-purple-400" />
          <h2 className="font-bold text-purple-400">คำขอนัดพบจากผู้ปกครอง</h2>
        </div>
        {pending.length > 0 && <span className="bg-purple-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{pending.length}</span>}
      </div>
      <div className="p-4 space-y-3 overflow-y-auto">
        {error && <p role="alert" className="text-xs text-rose-400">{error}</p>}
        {pending.length === 0 && confirmed.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">ไม่มีคำขอนัดพบที่รอดำเนินการ</div>
        ) : null}

        {pending.map(apt => {
          const student = students.find(s => s.studentId === apt.studentId);
          const online = apt.meetingType === 'ONLINE_MEET';
          return (
            <div key={apt.id} className="bg-white/5 border border-white/10 rounded-lg p-3">
              <div className="flex justify-between items-start mb-1 gap-2">
                <div className="font-bold text-sm text-slate-200">ผู้ปกครองของ {student?.name || apt.studentId}</div>
                <div className="text-[10px] text-slate-500 bg-black/20 px-1.5 py-0.5 rounded shrink-0">{apt.preferredDate} · {apt.timeSlot}</div>
              </div>
              <div className="text-[10px] text-slate-400 mb-1">
                พบ{APPOINTMENT_RECIPIENT_LABEL[apt.recipient]} · {APPOINTMENT_MEETING_LABEL[apt.meetingType]} · ขอโดย {apt.requestedBy}
              </div>
              <p className="text-xs text-slate-400 mb-3 bg-black/20 p-2 rounded line-clamp-4">{apt.topic}</p>
              <input
                value={places[apt.id] || ''}
                onChange={e => setPlaces(p => ({ ...p, [apt.id]: e.target.value }))}
                maxLength={APPOINTMENT_PLACE_MAX}
                placeholder={online ? 'ลิงก์ Google Meet (https://...) — ต้องใส่เมื่อยืนยัน' : 'สถานที่นัดพบ — ต้องใส่เมื่อยืนยัน'}
                aria-label={online ? 'ลิงก์ประชุม' : 'สถานที่นัดพบ'}
                className="w-full mb-2 bg-black/20 border border-white/10 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
              />
              <input
                value={notes[apt.id] || ''}
                onChange={e => setNotes(n => ({ ...n, [apt.id]: e.target.value }))}
                maxLength={APPOINTMENT_NOTE_MAX}
                placeholder="ข้อความถึงผู้ปกครอง (บังคับเมื่อไม่สะดวก)"
                aria-label="ข้อความถึงผู้ปกครอง"
                className="w-full mb-2 bg-black/20 border border-white/10 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => respond(apt, 'CONFIRMED')}
                  disabled={busyId === apt.id}
                  className="flex-1 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 disabled:opacity-60 border border-emerald-500/30 py-1.5 rounded text-xs font-bold transition-colors flex items-center justify-center gap-1"
                >
                  <CheckCircle className="w-3.5 h-3.5" /> ยืนยันนัด
                </button>
                <button
                  onClick={() => respond(apt, 'DECLINED')}
                  disabled={busyId === apt.id}
                  className="flex-1 bg-rose-600/20 text-rose-400 hover:bg-rose-600/30 disabled:opacity-60 border border-rose-500/30 py-1.5 rounded text-xs font-bold transition-colors flex items-center justify-center gap-1"
                >
                  <XCircle className="w-3.5 h-3.5" /> ไม่สะดวก
                </button>
              </div>
            </div>
          );
        })}

        {confirmed.length > 0 && (
          <div className="pt-1">
            <div className="text-[11px] font-bold text-slate-400 mb-2">นัดที่ยืนยันแล้ว</div>
            {confirmed.map(apt => {
              const student = students.find(s => s.studentId === apt.studentId);
              return (
                <div key={apt.id} className="bg-white/5 border border-white/10 rounded-lg p-3 mb-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-200 truncate">ผู้ปกครองของ {student?.name || apt.studentId}</div>
                    <div className="text-[10px] text-slate-400">{apt.preferredDate} · {apt.timeSlot} · {apt.locationOrLink}</div>
                  </div>
                  <button
                    onClick={() => complete(apt)}
                    disabled={busyId === apt.id}
                    className="shrink-0 bg-slate-700 hover:bg-slate-600 disabled:opacity-60 text-white py-1.5 px-3 rounded text-[11px] font-bold"
                  >
                    พบกันแล้ว
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
