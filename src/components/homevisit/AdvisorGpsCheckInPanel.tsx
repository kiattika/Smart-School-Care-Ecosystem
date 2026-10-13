import React, { useEffect, useMemo, useState } from 'react';
import { Satellite, Camera, MapPin, Clock, ShieldCheck, ShieldAlert, ExternalLink } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { Student, GPSCheckInLog } from '../../types';
import { formatCheckInClock } from '../../lib/gateMorningStatus';
import { subscribeGpsCheckInLogsForUsers, getCheckInSelfieFirestore } from '../../services/firestoreService';
import { SELFIE_RETENTION_DAYS } from '../../lib/selfieRetention';
import { flagCheckIns } from '../../lib/checkinFlags';

/** ดูรูปเซลฟี่เช็คอิน — โหลดจากคอลเลกชันแยกเฉพาะตอนกด (รูปหมดอายุเองใน SELFIE_RETENTION_DAYS วัน) */
function SelfieViewer({ log }: { log: GPSCheckInLog }) {
  const [state, setState] = useState<'idle' | 'loading' | 'missing' | 'error' | 'ok'>('idle');
  const [src, setSrc] = useState<string | null>(null);
  if (!log.hasSelfie && !log.selfieUrl) return null;
  const open = async () => {
    if (log.selfieUrl) { setSrc(log.selfieUrl); setState('ok'); return; }
    setState('loading');
    try {
      const url = await getCheckInSelfieFirestore(log.id);
      if (url) { setSrc(url); setState('ok'); } else setState('missing');
    } catch (e) {
      console.warn('[SelfieViewer] load failed', e);
      setState('error');
    }
  };
  return (
    <span className="flex items-center gap-2">
      {state === 'ok' && src ? (
        <>
          <img src={src} alt="รูปเช็คอิน" className="h-24 rounded-lg border border-white/10" />
          <button type="button" onClick={() => { setSrc(null); setState('idle'); }} className="text-slate-400 underline">ซ่อน</button>
        </>
      ) : (
        <button type="button" onClick={open} disabled={state === 'loading'} className="flex items-center gap-1 text-sky-400 hover:text-sky-300">
          <Camera className="w-3.5 h-3.5" /> {state === 'loading' ? 'กำลังโหลด...' : 'ดูรูป'}
        </button>
      )}
      {state === 'missing' && <span className="text-slate-500">รูปหมดอายุแล้ว (เก็บ {SELFIE_RETENTION_DAYS} วัน)</span>}
      {state === 'error' && <span className="text-rose-400">โหลดรูปไม่สำเร็จ (ไม่มีสิทธิ์หรือเครือข่ายขัดข้อง)</span>}
    </span>
  );
}

/**
 * แผงแสดง "พิกัด GPS การเช็คอินเข้าโรงเรียนของนักเรียน" สำหรับครูที่ปรึกษา
 * (ย้ายจุดแสดงพิกัด GPS check-in มาไว้หน้าครูที่ปรึกษา ตามที่โรงเรียนต้องการ)
 *
 * อ่าน gps_check_in_logs ของวันนี้ (type ENTRY) เฉพาะนักเรียนในห้องที่ดูแล
 */
export function AdvisorGpsCheckInPanel({ students }: { students: Student[] }) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [allLogs, setAllLogs] = useState<GPSCheckInLog[]>([]);

  // เฉพาะนักเรียนในห้อง (จับด้วย userId = studentId หรือ studentUid)
  const idset = useMemo(() => {
    const s = new Set<string>();
    students.forEach(st => { s.add(st.studentId); if (st.studentUid) s.add(st.studentUid); });
    return s;
  }, [students]);
  const idKey = useMemo(() => Array.from(idset).sort().join('|'), [idset]);

  // ย้อนหลัง 7 วัน เฉพาะนักเรียนในห้องตัวเอง (ไม่ดึงทั้งโรงเรียน) — ใช้ตั้งธง "ควรตรวจสอบ" ข้ามวัน แต่แสดงเฉพาะของวันนี้
  const since = format(subDays(new Date(), 7), 'yyyy-MM-dd');
  useEffect(() => subscribeGpsCheckInLogsForUsers(Array.from(idset), since, setAllLogs), [idKey, since]); // eslint-disable-line react-hooks/exhaustive-deps
  const logs = useMemo(() => allLogs.filter(l => l.date === today).sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || '')), [allLogs, today]);
  const flags = useMemo(() => flagCheckIns(allLogs), [allLogs]);

  const rows = useMemo(
    () => logs.filter(l => l.type === 'ENTRY'),
    [logs]
  );

  const flaggedCount = rows.filter(l => (flags.get(l.id) || []).length > 0).length;

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
        <span className="ml-auto text-xs text-slate-400">
          {rows.length} รายการ{flaggedCount > 0 ? <span className="ml-2 text-amber-400 font-bold">· ควรตรวจสอบ {flaggedCount}</span> : null}
        </span>
      </div>
      <p className="text-[11px] text-slate-500 mb-3">นักเรียนเช็คอินผ่าน GPS Geofence — ครูที่ปรึกษาตรวจสอบพิกัด/เวลา/สถานะได้ที่นี่</p>

      {rows.length === 0 ? (
        <div className="text-center py-6 text-slate-500 text-sm border border-dashed border-slate-800 rounded-lg">
          ยังไม่มีการเช็คอินด้วย GPS วันนี้
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {rows.map(l => {
            const fl = flags.get(l.id) || [];
            return (
            <div key={l.id} className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg px-3 py-2 text-xs ${fl.length ? 'bg-amber-500/5 border border-amber-500/30' : 'bg-black/20'}`}>
              <span className="font-bold text-white min-w-[9rem]">{nameOf(l.userId, l.userName || l.userId)}</span>
              <span className="flex items-center gap-1 text-slate-300"><Clock className="w-3.5 h-3.5" /> {formatCheckInClock(l.timestamp)}</span>
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
              <SelfieViewer log={l} />
              {fl.length > 0 && (
                <div className="basis-full text-[11px] text-amber-300 space-y-0.5" role="note">
                  <div className="font-bold">⚠ ควรตรวจสอบ (เป็นสัญญาณช่วยตรวจ ไม่ได้แปลว่าปลอมแน่นอน)</div>
                  {fl.map(f => <div key={f.code}>• {f.label}</div>)}
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
