import React, { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Loader2, RefreshCw, UserCheck } from 'lucide-react';
import { db, functions } from '../../lib/firebase';
import {
  PERIOD_KEYS, PERIOD_LABEL, attendanceRate, levelRows, parseAttendanceSummary, roomsByLowestRate, sumCounts, totalOf,
  type AttendanceSummaryView, type PeriodKey,
} from '../../lib/attendanceSummaryView';

const pct = (v: number | null) => (v === null ? '—' : `${v}%`);

/** การมาเรียนทั้งโรงเรียน (รายวัน/สัปดาห์/เดือน/ภาคเรียน) จากเช็คโฮมรูม — ตัวเลขรวม ไม่มีชื่อนักเรียน */
export function ExecutiveAttendancePanel() {
  const [data, setData] = useState<AttendanceSummaryView | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodKey>('day');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => onSnapshot(doc(db, 'attendance_summary', 'current'),
    snap => { setData(snap.exists() ? parseAttendanceSummary(snap.data()) : null); setError(null); },
    e => { setError(e.message); setData(null); }), []);

  const refresh = async () => {
    setBusy(true); setMsg(null);
    try {
      const res = await httpsCallable(functions, 'refreshAttendanceSummary')();
      setMsg((res.data as { success?: unknown } | null)?.success === true ? 'คำนวณใหม่แล้ว' : 'เซิร์ฟเวอร์ตอบกลับในรูปแบบที่ไม่คาดไว้');
    } catch (e) { setMsg('คำนวณใหม่ไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e))); } finally { setBusy(false); }
  };

  const p = data?.periods[period];
  const total = useMemo(() => sumCounts(p?.rooms || []), [p]);
  const levels = useMemo(() => levelRows(p?.rooms || []), [p]);
  const lowest = useMemo(() => roomsByLowestRate(p?.rooms || []).filter(r => totalOf(r) > 0).slice(0, 8), [p]);
  const trend = useMemo(() => (data?.daily || []).map(d => ({ date: d.date.slice(5), rate: attendanceRate(d) })), [data]);

  return (
    <section className="bg-[#0f1219] border border-white/10 rounded-2xl p-5 space-y-4" data-testid="executive-attendance">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2"><UserCheck className="w-4 h-4 text-emerald-400" /> การมาเรียนของนักเรียน (จากเช็คโฮมรูม)</h3>
        <button onClick={refresh} disabled={busy} className="text-[11px] text-indigo-300 hover:text-indigo-200 flex items-center gap-1 disabled:opacity-50">
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} คำนวณใหม่
        </button>
      </div>
      {msg && <p className="text-[11px] text-slate-300">{msg}</p>}
      {error && <p role="alert" className="text-[11px] text-rose-400">โหลดไม่สำเร็จ: {error}</p>}
      {data === undefined ? (
        <p className="text-xs text-slate-500 flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> กำลังโหลด...</p>
      ) : data === null ? (
        <p className="text-xs text-slate-500 py-4 text-center">ยังไม่มีสรุปการมาเรียนของภาคเรียนนี้ — ระบบคำนวณเองวันทำการ 17:40 หรือกด "คำนวณใหม่" (ต้องมีการเช็คโฮมรูมแล้วอย่างน้อย 1 วัน)</p>
      ) : (
        <>
          <div className="flex gap-1 flex-wrap" role="tablist" aria-label="ช่วงเวลา">
            {PERIOD_KEYS.map(k => (
              <button key={k} role="tab" aria-selected={period === k} onClick={() => setPeriod(k)} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${period === k ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>{PERIOD_LABEL[k]}</button>
            ))}
          </div>
          <p className="text-[11px] text-slate-500">ข้อมูลถึงวันที่ {data.asOf} · ช่วง {p?.from}{p && p.from !== p.to ? ` – ${p.to}` : ''} · ภาคเรียน {data.term.term}/{data.term.academicYear}</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'ร้อยละการมาเรียน', value: pct(attendanceRate(total)), color: 'text-emerald-400' },
              { label: 'มา', value: total.present.toLocaleString('th-TH'), color: 'text-slate-100' },
              { label: 'สาย', value: total.late.toLocaleString('th-TH'), color: 'text-amber-400' },
              { label: 'ขาด', value: total.absent.toLocaleString('th-TH'), color: 'text-rose-400' },
              { label: 'ลา', value: total.leave.toLocaleString('th-TH'), color: 'text-sky-400' },
            ].map(k => (
              <div key={k.label} className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                <div className="text-[10px] text-slate-400 font-bold">{k.label}</div>
                <div className={`text-2xl font-black font-mono ${k.color}`}>{k.value}</div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-500">นับเป็น "นักเรียน-วัน" เฉพาะวันที่ครูเช็คโฮมรูมแล้ว; ร้อยละ = (มา+สาย) ÷ ทั้งหมด (รวมลา)</p>

          {levels.length > 0 && (
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold text-slate-300">แยกตามระดับชั้น</h4>
              {levels.map(l => {
                const r = attendanceRate(l);
                return (
                  <div key={l.level} className="flex items-center gap-2 text-xs">
                    <span className="w-12 text-slate-300">{l.level}</span>
                    <div className="flex-1 h-2.5 bg-slate-800 rounded-full overflow-hidden" aria-hidden><div className="h-full bg-emerald-500" style={{ width: `${r ?? 0}%` }} /></div>
                    <span className="w-14 text-right font-mono text-slate-200">{pct(r)}</span>
                    <span className="w-28 text-right text-[10px] text-slate-500">ขาด {l.absent.toLocaleString('th-TH')} · {l.rooms} ห้อง</span>
                  </div>
                );
              })}
            </div>
          )}

          {lowest.length > 0 && (
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold text-slate-300">ห้องที่ร้อยละการมาเรียนต่ำสุด (8 ห้อง)</h4>
              <table className="w-full text-xs">
                <thead><tr className="text-slate-500 text-left"><th className="py-1">ห้อง</th><th>ร้อยละ</th><th>ขาด</th><th>สาย</th><th>ลา</th></tr></thead>
                <tbody>
                  {lowest.map(r => (
                    <tr key={r.room} className="border-t border-slate-800 text-slate-200"><td className="py-1">{r.room}</td><td className="font-mono">{pct(attendanceRate(r))}</td><td>{r.absent}</td><td>{r.late}</td><td>{r.leave}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {trend.length > 1 && (
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold text-slate-300">แนวโน้มร้อยละการมาเรียนรายวัน (ทั้งภาคเรียน)</h4>
              <div className="h-48 w-full" role="img" aria-label="กราฟแนวโน้มร้อยละการมาเรียนรายวัน">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} minTickGap={24} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} unit="%" />
                    <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: 12 }} formatter={(v) => [`${v}%`, 'มาเรียน']} />
                    <Line type="monotone" dataKey="rate" stroke="#10b981" strokeWidth={2} dot={false} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
