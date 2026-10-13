import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Lock, Loader2 } from 'lucide-react';
import { useRealStudents } from '../hooks/useRealStudents';
import { useHomeroomAttendance } from '../hooks/useHomeroomAttendance';
import { useTeacherFirestoreSchedule } from '../hooks/useTeacherFirestoreSchedule';
import { subscribeGateAttendanceLogs } from '../services/firestoreService';
import { gateMorningByStudent, resolveMorningStatus } from '../lib/gateMorningStatus';
import { isSameRoom } from '../lib/utils';
import { isScheduleForRoom } from '../lib/studentDaySchedule';
import type { GateAttendanceRecord } from '../types';

type Status = 'PRESENT' | 'LATE' | 'ABSENT' | 'LEAVE';
const OPTIONS: { v: Status; label: string; on: string }[] = [
  { v: 'PRESENT', label: 'มา', on: 'bg-emerald-600 text-white border-emerald-500' },
  { v: 'LATE', label: 'สาย', on: 'bg-amber-500 text-slate-900 border-amber-400' },
  { v: 'ABSENT', label: 'ขาด', on: 'bg-rose-600 text-white border-rose-500' },
  { v: 'LEAVE', label: 'ลา', on: 'bg-indigo-600 text-white border-indigo-500' },
];

/** เช็คชื่อโฮมรูมเช้าแบบมือถือ — ใช้ข้อมูล/ตรรกะชุดเดียวกับหน้าครูที่ปรึกษา (useHomeroomAttendance + ผลประตู/GPS) */
export function MobileHomeroomAttendance({ room }: { room: string }) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const { students: all, loading: studentsLoading } = useRealStudents();
  const { record: hrRecord, error: hrError, saveHomeroomAttendance, requestUnlock } = useHomeroomAttendance(todayStr, room);
  const { schedules } = useTeacherFirestoreSchedule();
  const [gateLogs, setGateLogs] = useState<GateAttendanceRecord[]>([]);
  useEffect(() => subscribeGateAttendanceLogs(setGateLogs, { date: todayStr }), [todayStr]);
  const gateMorning = useMemo(() => gateMorningByStudent(gateLogs, todayStr), [gateLogs, todayStr]);
  const [overrides, setOverrides] = useState<Record<string, Status>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const students = useMemo(() => (all || [])
    .filter(s => isSameRoom(s.room, room) || isSameRoom((s as any).className, room))
    .map(s => ({
      s,
      status: resolveMorningStatus({
        override: overrides[s.studentId],
        hrStatus: hrRecord?.students?.[s.studentId],
        hrLocked: !!hrRecord?.isLocked,
        gate: gateMorning.get(s.studentId),
        docStatus: s.attendance.morningStatus,
      }) as Status | undefined,
    }))
    .sort((a, b) => (Number(a.s.studentNo) || 0) - (Number(b.s.studentNo) || 0)), [all, room, overrides, hrRecord, gateMorning]);

  const locked = !!hrRecord?.isLocked;
  const counts = OPTIONS.map(o => ({ ...o, n: students.filter(x => (x.status || 'PRESENT') === o.v).length }));

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const statuses: Record<string, Status> = {};
      students.forEach(({ s, status }) => { statuses[s.studentId] = (status || 'PRESENT') as Status; });
      const hrSched = (schedules as any[]).find(sc => Number(sc.periodNumber) === 0 && isScheduleForRoom(sc, room));
      const code = hrSched ? String(hrSched.subjectCode || hrSched.courseCode || '') : '';
      await saveHomeroomAttendance(statuses, code ? { code, name: String(hrSched.subjectName || hrSched.courseName || code) } : null);
      setOverrides({});
      setMsg({ ok: true, text: 'บันทึกเช็คชื่อโฮมรูมแล้ว (ล็อกข้อมูล)' });
    } catch (e) {
      console.error(e);
      setMsg({ ok: false, text: 'บันทึกไม่สำเร็จ (ยังไม่ได้บันทึก) กรุณาลองอีกครั้ง' });
    } finally {
      setSaving(false);
    }
  };

  if (!room) return <p className="text-sm text-slate-400 p-4">บัญชีนี้ยังไม่ได้กำหนดห้องประจำชั้น</p>;

  return (
    <div className="space-y-3 pb-24">
      <div className="px-1">
        <h2 className="text-base font-bold text-white">เช็คชื่อโฮมรูม ห้อง {room}</h2>
        <p className="text-[11px] text-slate-400">{format(new Date(), 'dd/MM/yyyy')} · ผลเช็คอินประตู/GPS ถูกใส่ให้อัตโนมัติ แตะปุ่มเพื่อแก้</p>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {counts.map(c => (
          <div key={c.v} className="bg-slate-900/70 border border-slate-800 rounded-xl py-2 text-center">
            <div className="text-lg font-black text-white">{c.n}</div>
            <div className="text-[10px] text-slate-400">{c.label}</div>
          </div>
        ))}
      </div>
      {locked && (
        <div className="flex items-center justify-between gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-200">
          <span className="flex items-center gap-2"><Lock className="w-4 h-4 shrink-0" /> เช็กชื่อแล้วโดย {hrRecord?.checkedByName} (ล็อกแล้ว)</span>
          <button onClick={() => { requestUnlock().catch(() => undefined); }} className="px-3 py-1.5 bg-amber-500 text-slate-900 font-bold rounded-lg shrink-0">ขอแก้ไข</button>
        </div>
      )}
      {hrError && <p role="alert" className="text-xs text-rose-400">{hrError}</p>}
      {studentsLoading && <p className="text-xs text-slate-400 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> กำลังโหลดรายชื่อ…</p>}
      <ul className="space-y-2">
        {students.map(({ s, status }) => (
          <li key={s.studentId} className="bg-slate-900/70 border border-slate-800 rounded-2xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-7 h-7 rounded-lg bg-indigo-500/15 text-indigo-300 text-xs font-black flex items-center justify-center shrink-0">{s.studentNo}</span>
              <span className="text-sm font-semibold text-white truncate">{s.fullName}</span>
              {gateMorning.get(s.studentId) && <span className="ml-auto text-[10px] text-emerald-400 shrink-0">เช็คอิน {gateMorning.get(s.studentId)!.time || ''}</span>}
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {OPTIONS.map(o => (
                <button
                  key={o.v}
                  disabled={locked}
                  onClick={() => setOverrides(prev => ({ ...prev, [s.studentId]: o.v }))}
                  aria-pressed={(status || 'PRESENT') === o.v}
                  className={`py-2.5 rounded-xl text-xs font-bold border disabled:opacity-50 ${(status || 'PRESENT') === o.v ? o.on : 'bg-slate-800/60 text-slate-400 border-slate-700'}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </li>
        ))}
        {!studentsLoading && students.length === 0 && <li className="text-xs text-slate-500 p-4 text-center">ไม่พบนักเรียนในห้องนี้</li>}
      </ul>
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`text-xs ${msg.ok ? 'text-emerald-400' : 'text-rose-400'}`}>{msg.text}</p>}
      {!locked && students.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-slate-950/95 border-t border-slate-800 z-40">
          <button onClick={save} disabled={saving} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-sm rounded-2xl">
            {saving ? 'กำลังบันทึก…' : 'บันทึกการเช็คชื่อทั้งหมด'}
          </button>
        </div>
      )}
    </div>
  );
}
