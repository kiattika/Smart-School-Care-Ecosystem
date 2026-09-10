import React, { useEffect, useMemo, useState } from 'react';
import { DoorOpen, Clock, CheckCircle2, CircleDashed, LogOut } from 'lucide-react';
import { format } from 'date-fns';
import { Student, GateAttendanceRecord } from '../../types';
import { subscribeGateAttendanceLogs } from '../../services/firestoreService';

/**
 * ครูที่ปรึกษา: ภาพรวมการเช็คอิน "เข้าโรงเรียน" ผ่านประตู (gate_attendance_logs) ของนักเรียนทั้งห้อง
 * — real-time จาก Firestore (เดิม AdvisorPortal ไม่มีส่วนนี้เลย; ผู้ปกครองก็เห็นแค่ session-local)
 *
 * HOMEROOM_TEACHER อ่าน gate_attendance_logs ได้ตาม firestore.rules — query ทั้งวันนี้แล้วจับคู่กับ
 * รายชื่อห้อง (studentId / studentUid) ฝั่ง UI
 */
export function AdvisorGateCheckInPanel({ students }: { students: Student[] }) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [logs, setLogs] = useState<GateAttendanceRecord[]>([]);

  useEffect(() => subscribeGateAttendanceLogs(setLogs, { date: today }), [today]);

  const roomIds = useMemo(() => {
    const s = new Set<string>();
    students.forEach(st => { s.add(st.studentId); if (st.studentUid) s.add(st.studentUid); });
    return s;
  }, [students]);

  // gate log ล่าสุดต่อ studentId — เฉพาะนักเรียนในห้องนี้
  const byStudent = useMemo(() => {
    const m = new Map<string, GateAttendanceRecord>();
    for (const l of logs) {
      if (!roomIds.has(l.studentId) && !(l.studentUid && roomIds.has(l.studentUid))) continue;
      const prev = m.get(l.studentId);
      // logs เรียงใหม่→เก่าอยู่แล้ว แต่กันไว้: เก็บ ENTRY ก่อน ถ้ายังไม่มี ค่อยเก็บอย่างอื่น
      if (!prev) m.set(l.studentId, l);
      else if (prev.type !== 'ENTRY' && l.type === 'ENTRY') m.set(l.studentId, l);
    }
    return m;
  }, [logs, roomIds]);

  const rows = useMemo(() => {
    return [...students]
      .sort((a, b) => a.studentNo - b.studentNo)
      .map(st => ({ student: st, log: byStudent.get(st.studentId) || null }));
  }, [students, byStudent]);

  const entered = rows.filter(r => r.log?.type === 'ENTRY').length;
  const lateCount = rows.filter(r => r.log?.type === 'ENTRY' && r.log?.status === 'LATE').length;

  return (
    <div className="bg-[#1c1f2b]/80 border border-white/10 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <DoorOpen className="w-5 h-5 text-indigo-400" />
        <h3 className="text-sm font-bold text-white">การเช็คอินเข้าโรงเรียนผ่านประตู (วันนี้)</h3>
        <span className="ml-auto text-xs text-slate-400">
          มาแล้ว {entered}/{students.length} คน{lateCount > 0 ? ` · สาย ${lateCount}` : ''}
        </span>
      </div>
      <p className="text-[11px] text-slate-500 mb-3">
        สถานะการผ่านประตูโรงเรียนจริง (real-time) — แยกจากการเช็คชื่อโฮมรูมด้านล่าง
      </p>

      {students.length === 0 ? (
        <div className="text-center py-6 text-slate-500 text-sm border border-dashed border-slate-800 rounded-lg">
          ยังไม่มีรายชื่อนักเรียนในห้องที่ดูแล
        </div>
      ) : (
        <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
          {rows.map(({ student, log }) => (
            <div key={student.studentId} className="flex items-center gap-3 bg-black/20 rounded-lg px-3 py-2 text-xs">
              <span className="text-slate-500 w-6 text-right shrink-0">{student.studentNo}</span>
              <span className="font-medium text-white flex-1 min-w-0 truncate">{student.fullName || student.name}</span>
              {log?.type === 'ENTRY' ? (
                <span className="flex items-center gap-1 text-emerald-400 shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <Clock className="w-3 h-3" /> {log.timestamp}
                  {log.status === 'LATE' && (
                    <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-bold">สาย</span>
                  )}
                </span>
              ) : log?.type === 'EXIT' ? (
                <span className="flex items-center gap-1 text-slate-400 shrink-0">
                  <LogOut className="w-3.5 h-3.5" /> ออกแล้ว {log.timestamp}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-slate-500 shrink-0">
                  <CircleDashed className="w-3.5 h-3.5" /> ยังไม่เข้าโรงเรียน
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
