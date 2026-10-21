import React, { useEffect, useState } from 'react';
import { CalendarClock, Loader2, Save } from 'lucide-react';
import { DatePicker } from '../shared/DatePicker';
import { TimePicker } from '../shared/TimePicker';
import { DeadlineCountdown } from '../shared/DeadlineCountdown';
import { useStore } from '../../store';
import { composeLocalMillis, splitLocalMillis } from '../../lib/enrollmentWindow';
import {
  ACTIVITY_WINDOW_KINDS, ACTIVITY_WINDOW_LABELS, activityWindowState, validateActivityWindow,
  type ActivityWindowKind, type ActivityWindows,
} from '../../lib/activityWindows';
import { saveActivityWindows, subscribeActivityWindows } from '../../services/activityWindowService';

type Draft = { od: string; ot: string; cd: string; ct: string };
const EMPTY: Draft = { od: '', ot: '', cd: '', ct: '' };

function toDraft(w: ActivityWindows): Record<ActivityWindowKind, Draft> {
  const out = {} as Record<ActivityWindowKind, Draft>;
  for (const k of ACTIVITY_WINDOW_KINDS) {
    const o = splitLocalMillis(w[k]?.opensAtMs ?? null);
    const c = splitLocalMillis(w[k]?.closesAtMs ?? null);
    out[k] = { od: o.ymd, ot: o.hhmm, cd: c.ymd, ct: c.hhmm };
  }
  return out;
}

/** แอดมิน (SUPER_ADMIN) ตั้งช่วงเวลาเปิด–ปิดกิจกรรมที่ต้องตั้งเวลา — เอกสาร school_settings/activity_windows */
export function ActivityWindowsSection() {
  const user = useStore(s => s.user);
  const [saved, setSaved] = useState<ActivityWindows>({});
  const [draft, setDraft] = useState<Record<ActivityWindowKind, Draft>>(() => toDraft({}));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => subscribeActivityWindows(w => { setSaved(w); if (!dirty) setDraft(toDraft(w)); }), [dirty]);

  const set = (k: ActivityWindowKind, patch: Partial<Draft>) => { setDraft(d => ({ ...d, [k]: { ...d[k], ...patch } })); setDirty(true); };

  const save = async () => {
    if (!user?.uid) { setMsg({ ok: false, text: 'ไม่พบผู้ใช้ที่ล็อกอิน — บันทึกไม่ได้' }); return; }
    const next: ActivityWindows = {};
    for (const k of ACTIVITY_WINDOW_KINDS) {
      const d = draft[k];
      const opensAtMs = composeLocalMillis(d.od, d.ot, '00:00');
      const closesAtMs = composeLocalMillis(d.cd, d.ct, '23:59');
      const err = validateActivityWindow(opensAtMs, closesAtMs);
      if (err) { setMsg({ ok: false, text: `${ACTIVITY_WINDOW_LABELS[k].title}: ${err}` }); return; }
      if (opensAtMs !== null || closesAtMs !== null) next[k] = { opensAtMs, closesAtMs };
    }
    setBusy(true); setMsg(null);
    try {
      await saveActivityWindows(next, user.uid);
      setDirty(false);
      setMsg({ ok: true, text: 'บันทึกช่วงเวลากิจกรรมแล้ว' });
    } catch (e) {
      setMsg({ ok: false, text: 'บันทึกไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)) });
    } finally { setBusy(false); }
  };

  return (
    <div className="bg-[#0f1219] border border-white/10 rounded-2xl p-5 space-y-4" data-testid="activity-windows-section">
      <div>
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2"><CalendarClock className="w-4 h-4 text-indigo-400" /> ตารางเวลาเปิด-ปิดกิจกรรม</h3>
        <p className="text-[11px] text-slate-500 mt-1">เว้นว่างทั้งสองช่อง = ไม่จำกัดเวลา (เปิดตลอด). สะท้อนคิดและ PLC ไม่มีช่วงเวลา ทำได้ตลอดภาคเรียน.</p>
      </div>
      {ACTIVITY_WINDOW_KINDS.map(k => {
        const st = activityWindowState(k, saved, Date.now());
        const d = draft[k];
        return (
          <div key={k} className="border border-slate-800 rounded-xl p-3 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-200">{ACTIVITY_WINDOW_LABELS[k].title}</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${st.phase === 'CLOSED' ? 'bg-rose-500/20 text-rose-300' : st.phase === 'NOT_YET' ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                {st.phase === 'CLOSED' ? 'ปิดอยู่' : st.phase === 'NOT_YET' ? 'ยังไม่ถึงเวลาเปิด' : (saved[k] ? 'เปิดอยู่' : 'ไม่จำกัดเวลา')}
              </span>
              {st.deadlineMs !== null && <DeadlineCountdown targetMs={st.deadlineMs} label={st.deadlineKind === 'OPENS' ? 'เปิดใน' : 'ปิดใน'} />}
            </div>
            <p className="text-[10px] text-slate-500">{ACTIVITY_WINDOW_LABELS[k].hint}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400">เปิด (ว่าง = เปิดทันที)</span>
                <div className="flex gap-2"><DatePicker value={d.od} onChange={v => set(k, { od: v })} clearable ariaLabel={`วันที่เปิด ${ACTIVITY_WINDOW_LABELS[k].title}`} /><TimePicker value={d.ot} onChange={v => set(k, { ot: v })} ariaLabel="เวลาเปิด" /></div>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400">ปิด (ว่าง = ไม่กำหนดเวลาปิด; ไม่ใส่เวลา = สิ้นวัน 23:59)</span>
                <div className="flex gap-2"><DatePicker value={d.cd} onChange={v => set(k, { cd: v })} clearable ariaLabel={`วันที่ปิด ${ACTIVITY_WINDOW_LABELS[k].title}`} /><TimePicker value={d.ct} onChange={v => set(k, { ct: v })} ariaLabel="เวลาปิด" /></div>
              </div>
            </div>
            <button type="button" onClick={() => set(k, EMPTY)} className="text-[10px] text-slate-400 hover:text-slate-200 underline">ล้างเป็นไม่จำกัดเวลา</button>
          </div>
        );
      })}
      {msg && <p className={`text-[11px] ${msg.ok ? 'text-emerald-300' : 'text-rose-400'}`}>{msg.text}</p>}
      <div className="flex justify-end">
        <button onClick={save} disabled={busy || !dirty} className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-lg flex items-center gap-1.5">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} บันทึกช่วงเวลา
        </button>
      </div>
    </div>
  );
}
