import React, { useMemo, useState } from 'react';
import { Radar } from 'lucide-react';
import { useRoomAttendanceRecordsFull } from '../../hooks/useRoomAttendanceRecords';
import { defaultAttendanceDateRange } from '../../lib/studentAttendanceStats';
import { detectSkipIncidents, periodTotals, SKIP_ALERT_THRESHOLD, SKIP_WATCH_THRESHOLD, type SkipLevel } from '../../lib/skipRadar';

const LEVEL_STYLE: Record<SkipLevel, string> = {
  NONE: 'bg-slate-700/40 text-slate-300 border-slate-600/40',
  WATCH: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  ALERT: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
};
const LEVEL_LABEL: Record<SkipLevel, string> = { NONE: 'ปกติ', WATCH: 'เฝ้าระวัง', ALERT: 'ควรติดตาม' };

/** เรดาร์โดดเรียนของห้องที่ปรึกษา — คำนวณสดจากเช็คชื่อรายคาบจริง ไม่มีข้อมูลตัวอย่าง */
export function SkipRadarPanel({ room, students }: { room: string; students: { studentId: string; name: string }[] }) {
  const [days, setDays] = useState(30);
  const range = useMemo(() => defaultAttendanceDateRange(days), [days]);
  const rooms = useMemo(() => (room ? [room] : []), [room]);
  const { records, loading, error } = useRoomAttendanceRecordsFull(rooms, range);
  const ids = useMemo(() => students.map(s => s.studentId), [students]);
  const summaries = useMemo(() => detectSkipIncidents(records, ids), [records, ids]);
  const flagged = summaries.filter(s => s.total > 0);
  const totals = useMemo(() => periodTotals(summaries), [summaries]);
  const maxTotal = Math.max(1, ...totals);
  const nameOf = (id: string) => students.find(s => s.studentId === id)?.name || id;

  return (
    <div className="space-y-4 max-w-5xl mx-auto w-full pb-10">
      <div className="bg-[#121624] border border-white/10 rounded-2xl px-5 py-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-white flex items-center gap-2"><Radar className="w-4 h-4 text-rose-400" /> เรดาร์โดดเรียน — ห้อง {room}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            นับเมื่อวันนั้นนักเรียนมาโรงเรียน (มา/สาย ในเอกสารเช็คชื่ออื่น) แต่ถูกเช็ค "ขาด" ในคาบเรียน — ขาดทั้งวันและลาไม่นับ · เฝ้าระวัง ≥{SKIP_WATCH_THRESHOLD} ครั้ง, ควรติดตาม ≥{SKIP_ALERT_THRESHOLD} ครั้ง (ค่าเริ่มต้น ยังไม่ยืนยันจากโรงเรียน)
          </p>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          aria-label="ช่วงเวลา"
          className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
        >
          <option value={14}>14 วันล่าสุด</option>
          <option value={30}>30 วันล่าสุด</option>
          <option value={60}>60 วันล่าสุด</option>
        </select>
      </div>

      {error && <div role="alert" className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">โหลดข้อมูลเช็คชื่อไม่สำเร็จ: {error}</div>}
      {loading && <p className="text-xs text-slate-400">กำลังโหลดข้อมูลเช็คชื่อ…</p>}

      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
        <div className="text-xs font-bold text-white mb-2">จำนวนครั้งที่โดดคาบ แยกตามคาบ (ทั้งห้อง)</div>
        <div className="grid grid-cols-8 gap-2">
          {totals.map((n, i) => (
            <div key={i} className="text-center">
              <div className="h-16 flex items-end">
                <div className="w-full rounded-md bg-rose-500/60" style={{ height: `${(n / maxTotal) * 100}%`, minHeight: n ? 4 : 0 }} title={`คาบ ${i + 1}: ${n} ครั้ง`} />
              </div>
              <div className="text-[10px] text-slate-400 mt-1">คาบ {i + 1}</div>
              <div className="text-xs font-bold text-white">{n}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-slate-400 text-left">
            <tr><th className="p-3">นักเรียน</th><th className="p-3">ครั้ง</th><th className="p-3">วัน</th><th className="p-3">วิชาที่พบบ่อย</th><th className="p-3">ล่าสุด</th><th className="p-3">ระดับ</th></tr>
          </thead>
          <tbody>
            {flagged.map(s => (
              <tr key={s.studentId} className="border-t border-slate-800 text-slate-200">
                <td className="p-3 font-semibold">{nameOf(s.studentId)} <span className="text-slate-500">({s.studentId})</span></td>
                <td className="p-3">{s.total}</td>
                <td className="p-3">{s.days}</td>
                <td className="p-3">{s.topCourse ? `${s.topCourse.label} (${s.topCourse.count})` : '—'}</td>
                <td className="p-3">{s.lastDate}</td>
                <td className="p-3"><span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${LEVEL_STYLE[s.level]}`}>{LEVEL_LABEL[s.level]}</span></td>
              </tr>
            ))}
            {!loading && flagged.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-slate-500">ไม่พบนักเรียนที่โดดคาบในช่วงนี้ (หรือยังไม่มีข้อมูลเช็คชื่อรายคาบ)</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
