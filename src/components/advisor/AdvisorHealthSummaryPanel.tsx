import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { HeartPulse, Loader2, RefreshCw, Copy, Check, Eye, Ear, Droplets, ShieldAlert, Phone } from 'lucide-react';
import { fetchStudentHealthBrief } from '../../services/firestoreService';
import {
  buildTeacherNoticeText, hasSharedItems, needsAttention, screeningLines, type StudentHealthBrief,
} from '../../lib/advisorHealthSummary';
import { SEVERITY_LABEL } from '../../lib/healthProfile';

/** สุขภาพนักเรียนในห้องที่ปรึกษา — ข้อมูลจริงที่ครอบครัว/พยาบาลบันทึก + ข้อความแจ้งครูผู้สอน (เฉพาะที่ครอบครัวอนุญาต) */
export function AdvisorHealthSummaryPanel({ room, students }: { room: string; students: { studentId: string; name: string }[] }) {
  const [briefs, setBriefs] = useState<StudentHealthBrief[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [include, setInclude] = useState<Set<string>>(new Set());
  const [withScreening, setWithScreening] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const key = students.map(s => s.studentId).join(',');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await Promise.all(students.map(s => fetchStudentHealthBrief(s.studentId, s.name)));
      setBriefs(list);
      setInclude(new Set(list.filter(hasSharedItems).map(b => b.studentId)));
      setWithScreening(new Set());
    } finally { setLoading(false); }
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (students.length > 0) load(); else setBriefs([]); }, [load]); // eslint-disable-line react-hooks/exhaustive-deps

  const attention = useMemo(() => (briefs || []).filter(needsAttention), [briefs]);
  const noData = useMemo(() => (briefs || []).filter(b => !b.hasProfile && !b.readError), [briefs]);
  const text = useMemo(() => buildTeacherNoticeText(room, briefs || [], include, withScreening), [room, briefs, include, withScreening]);

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, id: string) => {
    const n = new Set(set); n.has(id) ? n.delete(id) : n.add(id); setter(n);
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ผู้ใช้คัดลอกเองจากกล่องข้อความได้ */ }
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto w-full pb-10" data-testid="advisor-health-summary">
      <div className="bg-[#121624] border border-white/10 rounded-2xl px-5 py-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-white flex items-center gap-2"><HeartPulse className="w-4 h-4 text-rose-400" /> สุขภาพนักเรียนที่ครูที่ปรึกษาควรทราบ — ห้อง {room}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">ข้อมูลจากที่ครอบครัวกรอกและพยาบาลบันทึก · "ยังไม่ได้บันทึก" ไม่ได้แปลว่าไม่มีโรค/ไม่แพ้ · ข้อมูลนี้ใช้เพื่อดูแลนักเรียนเท่านั้น</p>
        </div>
        <button onClick={load} disabled={loading} className="px-3 py-1.5 text-[11px] font-bold text-slate-200 border border-slate-700 hover:bg-slate-800 rounded-lg flex items-center gap-1.5 disabled:opacity-50">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} รีเฟรช
        </button>
      </div>

      {briefs === null ? (
        <p className="text-xs text-slate-400 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> กำลังโหลดข้อมูลสุขภาพของห้อง…</p>
      ) : students.length === 0 ? (
        <p className="text-xs text-slate-500">ยังไม่มีนักเรียนในห้องที่ปรึกษา</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#121624] border border-white/10 rounded-2xl p-4"><p className="text-[11px] text-slate-400">มีเรื่องที่ควรทราบ</p><p className="text-2xl font-bold text-white">{attention.length}<span className="text-xs text-slate-400 font-normal"> / {briefs.length} คน</span></p></div>
            <div className="bg-[#121624] border border-white/10 rounded-2xl p-4"><p className="text-[11px] text-slate-400">ครอบครัวอนุญาตแจ้งครูผู้สอน</p><p className="text-2xl font-bold text-white">{briefs.filter(hasSharedItems).length}<span className="text-xs text-slate-400 font-normal"> คน</span></p></div>
            <div className="bg-[#121624] border border-white/10 rounded-2xl p-4"><p className="text-[11px] text-slate-400">ยังไม่ได้บันทึกข้อมูลสุขภาพ</p><p className="text-2xl font-bold text-white">{noData.length}<span className="text-xs text-slate-400 font-normal"> คน</span></p></div>
          </div>

          <div className="bg-[#121624] border border-white/10 rounded-2xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-800/60 text-slate-300 text-[11px]">
                <tr><th className="p-3">นักเรียน</th><th className="p-3">ที่ควรทราบ</th><th className="p-3 text-center">แจ้งครูผู้สอน</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {briefs.map(b => {
                  const shared = hasSharedItems(b);
                  const scr = screeningLines(b).length > 0;
                  return (
                    <tr key={b.studentId} className="align-top">
                      <td className="p-3 whitespace-nowrap">
                        <p className="font-bold text-white">{b.name}</p>
                        <p className="text-[10px] text-slate-500 font-mono">{b.studentId}</p>
                        <div className="flex gap-1.5 mt-1 text-[10px] text-slate-400">
                          {b.bloodType && <span className="inline-flex items-center gap-0.5"><Droplets className="w-3 h-3 text-rose-400" />{b.bloodType}</span>}
                          <span className="inline-flex items-center gap-0.5" title="ผู้ติดต่อฉุกเฉิน"><Phone className="w-3 h-3" />{b.emergencyContactCount}</span>
                        </div>
                      </td>
                      <td className="p-3 space-y-1">
                        {b.readError && <p className="text-rose-300">อ่านข้อมูลไม่ได้</p>}
                        {!b.hasProfile && !b.readError && <p className="text-slate-500">ครอบครัวยังไม่ได้บันทึกข้อมูลสุขภาพ</p>}
                        {b.hasProfile && !needsAttention(b) && <p className="text-slate-500">ไม่มีรายการที่บันทึกไว้</p>}
                        {b.chronic.map(c => <p key={c.id}><ShieldAlert className="inline w-3 h-3 text-amber-400 mr-1" /><span className="text-amber-200 font-semibold">{c.name}</span> <span className="text-slate-400">({SEVERITY_LABEL[c.severity]}){c.treatmentCare ? ` — ${c.treatmentCare}` : ''}</span></p>)}
                        {b.allergies.map(a => <p key={a.id}><span className="text-rose-300 font-semibold">แพ้ {a.allergen}</span>{a.reaction ? <span className="text-slate-400"> — {a.reaction}</span> : null}</p>)}
                        {b.specialCare.map(s => <p key={s.id}><span className="text-indigo-300 font-semibold">{s.category}: {s.description}</span>{s.actionPlan ? <span className="text-slate-400"> — {s.actionPlan}</span> : null}</p>)}
                        {b.visionAbnormal && <p className="text-sky-300"><Eye className="inline w-3 h-3 mr-1" />สายตาผิดปกติ (ผลตรวจประจำปี)</p>}
                        {b.hearingAbnormal && <p className="text-sky-300"><Ear className="inline w-3 h-3 mr-1" />การได้ยินผิดปกติ (ผลตรวจประจำปี)</p>}
                        {b.hasProfile && needsAttention(b) && !b.verified && <p className="text-[10px] text-amber-400/80">รอพยาบาลยืนยันความถูกต้อง</p>}
                      </td>
                      <td className="p-3 text-center space-y-1.5">
                        {shared ? (
                          <label className="flex items-center justify-center gap-1.5 text-[11px] cursor-pointer">
                            <input type="checkbox" checked={include.has(b.studentId)} onChange={() => toggle(include, setInclude, b.studentId)} /> รวมในข้อความ
                          </label>
                        ) : <p className="text-[10px] text-slate-500">ครอบครัวไม่ได้อนุญาต</p>}
                        {scr && (
                          <label className="flex items-center justify-center gap-1.5 text-[10px] text-sky-300 cursor-pointer">
                            <input type="checkbox" checked={withScreening.has(b.studentId) && include.has(b.studentId)} onChange={() => { if (!include.has(b.studentId)) toggle(include, setInclude, b.studentId); toggle(withScreening, setWithScreening, b.studentId); }} /> รวมคำแนะนำที่นั่ง (สายตา/หู)
                          </label>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="bg-[#121624] border border-white/10 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-white">ข้อความแจ้งครูผู้สอน</h3>
              <button onClick={copy} disabled={!text} className="px-3 py-1.5 text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-lg flex items-center gap-1.5">
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? 'คัดลอกแล้ว' : 'คัดลอกข้อความ'}
              </button>
            </div>
            <p className="text-[11px] text-slate-400">แจ้งเฉพาะข้อควรระวังที่ครอบครัวอนุญาต โรคประจำตัวจะไม่ระบุชื่อโรค — คัดลอกไปส่งครูผู้สอนทางกลุ่ม/ข้อความเอง</p>
            {text
              ? <textarea readOnly value={text} rows={Math.min(14, text.split('\n').length + 1)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 font-sans" />
              : <p className="text-[11px] text-slate-500">ยังไม่มีนักเรียนที่ครอบครัวอนุญาตให้แจ้งครูผู้สอน (ผู้ปกครอง/นักเรียนติ๊ก "อนุญาตให้ครูที่ปรึกษาแจ้งครูผู้สอนได้" ในหน้าข้อมูลสุขภาพประจำตัว)</p>}
          </div>
        </>
      )}
    </div>
  );
}
