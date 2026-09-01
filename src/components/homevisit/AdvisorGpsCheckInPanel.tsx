import React, { useEffect, useMemo, useState } from 'react';
import { Satellite, MapPin, Clock, ShieldCheck, ShieldAlert, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { Student, GPSCheckInLog } from '../../types';
import { subscribeGpsCheckInLogsByDate } from '../../services/firestoreService';

/**
 * แผงแสดง "พิกัด GPS การเช็คอินเข้าโรงเรียนของนักเรียน" สำหรับครูที่ปรึกษา
 * (ย้ายจุดแสดงพิกัด GPS check-in มาไว้หน้าครูที่ปรึกษา ตามที่โรงเรียนต้องการ)
 *
 * อ่าน gps_check_in_logs ของวันนี้ (type ENTRY) เฉพาะนักเรียนในห้องที่ดูแล
 */
export function AdvisorGpsCheckInPanel({ students }: { students: Student[] }) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [logs, setLogs] = useState<GPSCheckInLog[]>([]);

  useEffect(() => subscribeGpsCheckInLogsByDate(today, setLogs), [today]);

  // เฉพาะนักเรียนในห้องนี้ (จับด้วย userId = studentId หรือ studentUid) + เข้า (ENTRY)
  const idset = useMemo(() => {
    const s = new Set<string>();
    students.forEach(st => { s.add(st.studentId); if (st.studentUid) s.add(st.studentUid); });
    return s;
  }, [students]);

  const rows = useMemo(
    () => logs.filter(l => l.type === 'ENTRY' && (idset.has(l.userId) || /STUDENT/i.test(l.userRole || ''))),
    [logs, idset]
  );

  const nameOf = useMemo(() => {
    const m = new Map<string, string>();
    students.forEach(st => { m.set(st.studentId, st.fullName || st.name); if (st.studentUid) m.set(st.studentUid, st.fullName || st.name); });
    return (id: string, fallback: string) => m.get(id) || fallback;
  }, [students]);

  return (
    <div className="bg-[#1c1f2b]/80 border border-white/10 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <Satellite className="w-5 h-5 text-emerald-400" />
        <h3 className="text-sm font-bold text-white">พิกัด GPS การเช็คอินเข้าโรงเรียน (วันนี้)</h3>
        <span className="ml-auto text-xs text-slate-400">{rows.length} รายการ</span>
      </div>
      <p className="text-[11px] text-slate-500 mb-3">นักเรียนเช็คอินผ่าน GPS Geofence — ครูที่ปรึกษาตรวจสอบพิกัด/เวลา/สถานะได้ที่นี่</p>

      {rows.length === 0 ? (
        <div className="text-center py-6 text-slate-500 text-sm border border-dashed border-slate-800 rounded-lg">
          ยังไม่มีการเช็คอินด้วย GPS วันนี้
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {rows.map(l => (
            <div key={l.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-black/20 rounded-lg px-3 py-2 text-xs">
              <span className="font-bold text-white min-w-[9rem]">{nameOf(l.userId, l.userName || l.userId)}</span>
              <span className="flex items-center gap-1 text-slate-300"><Clock className="w-3.5 h-3.5" /> {l.timestamp ? new Date(l.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-'}</span>
              <span className={`flex items-center gap-1 ${l.isInsideGeofence ? 'text-emerald-400' : 'text-rose-400'}`}>
                {l.isInsideGeofence ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                {l.isInsideGeofence ? 'ในเขตโรงเรียน' : 'นอกเขต'} · {Math.round(l.distanceMeters)} ม.
              </span>
              <span className={`px-1.5 py-0.5 rounded font-bold ${
                l.status === 'ON_TIME' ? 'bg-emerald-500/10 text-emerald-400' : l.status === 'LATE' ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-500/10 text-slate-400'
              }`}>{l.status === 'ON_TIME' ? 'ตรงเวลา' : l.status === 'LATE' ? 'สาย' : l.status}</span>
              <a
                href={`https://www.google.com/maps?q=${l.latitude},${l.longitude}`}
                target="_blank" rel="noreferrer"
                className="flex items-center gap-1 text-blue-400 font-mono"
              >
                <MapPin className="w-3 h-3" /> {l.latitude.toFixed(5)}, {l.longitude.toFixed(5)} <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
