import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Loader2, RefreshCw, Save } from 'lucide-react';
import { useStore } from '../../store';
import { formatThaiDateTime } from '../../lib/enrollmentWindow';
import {
  ABSENCE_LEVEL_AUDIENCE, DEFAULT_ABSENCE_THRESHOLDS, FOLLOWUP_ACTIONS, FOLLOWUP_LABEL,
  MAX_ABSENCE_THRESHOLD_DAYS, validateThresholds, type AbsenceThresholds, type FollowupAction,
} from '../../lib/absenceStreak';
import {
  addAbsenceFollowup, refreshAbsenceAlerts, saveAbsenceThresholds, subscribeAbsenceAlerts,
  subscribeAbsenceFollowups, subscribeAbsenceThresholds, type AbsenceAlert, type AbsenceFollowup, type AlertScope,
} from '../../services/absenceService';

interface StudentLite { studentId: string; name?: string; fullName?: string; room?: string }

const LEVEL_STYLE: Record<number, string> = {
  1: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  2: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  3: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
};

function FollowupBox({ alert, student }: { alert: AbsenceAlert; student: StudentLite | undefined }) {
  const user = useStore(s => s.user);
  const [list, setList] = useState<AbsenceFollowup[]>([]);
  const [action, setAction] = useState<FollowupAction | ''>('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // ห้องตามทะเบียนนักเรียน (students.room) — rules เทียบกับทะเบียนจริง; ไม่พบ = บันทึกไม่ได้ (ไม่เดา)
  const room = student?.room || '';

  useEffect(() => (room ? subscribeAbsenceFollowups(room, alert.studentId, setList, e => setMsg({ ok: false, text: 'โหลดบันทึกการติดตามไม่สำเร็จ: ' + e.message })) : undefined), [room, alert.studentId]);

  const save = async () => {
    if (!action) { setMsg({ ok: false, text: 'กรุณาเลือกผลการติดตาม' }); return; }
    setBusy(true); setMsg(null);
    try {
      const name = user?.profile ? `${user.profile.prefix || ''}${user.profile.firstName} ${user.profile.lastName}`.trim() : (user?.displayName || '');
      await addAbsenceFollowup({ studentId: alert.studentId, room, action, note, streakAtTime: alert.streakDays }, { uid: user?.uid || '', staffId: user?.staffId || '', name });
      setAction(''); setNote(''); setMsg({ ok: true, text: 'บันทึกผลการติดตามแล้ว' });
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ' }); } finally { setBusy(false); }
  };

  return (
    <div className="mt-3 space-y-2 border-t border-slate-800 pt-3">
      <p className="text-[11px] font-bold text-slate-300">บันทึกผลการติดตาม (ระบบไม่ส่งข้อความหาผู้ปกครองให้เอง)</p>
      {list.length === 0 ? <p className="text-[11px] text-slate-500">ยังไม่มีบันทึกการติดตาม</p> : (
        <ul className="space-y-1">
          {list.map(f => (
            <li key={f.id} className="text-[11px] text-slate-300">
              <span className="text-slate-500">{f.createdAtMs ? formatThaiDateTime(f.createdAtMs) : ''}</span> · {FOLLOWUP_LABEL[f.action] || f.action}
              {f.note && <> — {f.note}</>} <span className="text-slate-500">({f.byName}, ขาดต่อเนื่อง {f.streakAtTime} วัน)</span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2 items-start">
        <select value={action} onChange={e => setAction(e.target.value as FollowupAction | '')} aria-label="ผลการติดตาม" className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white">
          <option value="">— เลือกผลการติดตาม —</option>
          {FOLLOWUP_ACTIONS.map(a => <option key={a} value={a}>{FOLLOWUP_LABEL[a]}</option>)}
        </select>
        <input value={note} onChange={e => setNote(e.target.value)} maxLength={500} placeholder="หมายเหตุ (ไม่บังคับ ยกเว้น อื่น ๆ)" aria-label="หมายเหตุ" className="flex-1 min-w-[12rem] bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white" />
        <button onClick={save} disabled={busy || !room} className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-lg flex items-center gap-1">
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} บันทึก
        </button>
      </div>
      {!room && <p className="text-[11px] text-amber-300">ไม่พบห้องของนักเรียนในทะเบียน — บันทึกไม่ได้</p>}
      {msg && <p className={`text-[11px] ${msg.ok ? 'text-emerald-300' : 'text-rose-400'}`}>{msg.text}</p>}
    </div>
  );
}

function ThresholdEditor({ onSaved }: { onSaved: () => void }) {
  const user = useStore(s => s.user);
  const [saved, setSaved] = useState<AbsenceThresholds>(DEFAULT_ABSENCE_THRESHOLDS);
  const [draft, setDraft] = useState<AbsenceThresholds>(DEFAULT_ABSENCE_THRESHOLDS);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => subscribeAbsenceThresholds(t => { setSaved(t); if (!dirty) setDraft(t); }), [dirty]);
  const set = (k: keyof AbsenceThresholds, v: string) => { setDraft(d => ({ ...d, [k]: Number(v) })); setDirty(true); };
  const err = validateThresholds(draft);
  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      await saveAbsenceThresholds(draft, user?.uid || '');
      setDirty(false);
      try { await refreshAbsenceAlerts(); setMsg({ ok: true, text: 'บันทึกเกณฑ์และคำนวณรายการใหม่แล้ว' }); } catch { setMsg({ ok: true, text: 'บันทึกเกณฑ์แล้ว — รายการจะคำนวณใหม่ตามรอบ 17:30 (กด "คำนวณใหม่" เพื่อให้ทันที)' }); }
      onSaved();
    } catch (e) { setMsg({ ok: false, text: 'บันทึกไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)) }); } finally { setBusy(false); }
  };
  const field = (k: keyof AbsenceThresholds, label: string, who: string) => (
    <label className="space-y-1 block">
      <span className="text-[11px] text-slate-300 font-semibold">{label}</span>
      <div className="flex items-center gap-1.5"><input type="number" min={1} max={MAX_ABSENCE_THRESHOLD_DAYS} value={Number.isFinite(draft[k]) ? draft[k] : ''} onChange={e => set(k, e.target.value)} aria-label={label} className="w-20 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white" /><span className="text-[11px] text-slate-400">วันติดต่อกัน</span></div>
      <span className="text-[10px] text-slate-500 block">{who}</span>
    </label>
  );
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-3" data-testid="absence-threshold-editor">
      <h3 className="text-sm font-bold text-white">เกณฑ์จำนวนวันขาดเรียนต่อเนื่อง (งานกิจการนักเรียนปรับได้)</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {field('watchDays', 'ระดับติดตาม', ABSENCE_LEVEL_AUDIENCE[1].audience)}
        {field('weekDays', 'ขาดทั้งสัปดาห์', ABSENCE_LEVEL_AUDIENCE[2].audience)}
        {field('severeDays', 'ขาดนาน', ABSENCE_LEVEL_AUDIENCE[3].audience)}
      </div>
      <p className="text-[10px] text-slate-500">นับเฉพาะวันที่ครูเช็คโฮมรูมแล้ว; ลา/มา/สาย ตัดสายการขาด; เกณฑ์เริ่มต้น {DEFAULT_ABSENCE_THRESHOLDS.watchDays}/{DEFAULT_ABSENCE_THRESHOLDS.weekDays}/{DEFAULT_ABSENCE_THRESHOLDS.severeDays} วัน (บันทึกล่าสุด {saved.watchDays}/{saved.weekDays}/{saved.severeDays})</p>
      {err && dirty && <p className="text-[11px] text-rose-400">{err}</p>}
      {msg && <p className={`text-[11px] ${msg.ok ? 'text-emerald-300' : 'text-rose-400'}`}>{msg.text}</p>}
      <div className="flex justify-end"><button onClick={save} disabled={busy || !dirty || !!err} className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-lg flex items-center gap-1">{busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} บันทึกเกณฑ์</button></div>
    </div>
  );
}

/**
 * นักเรียนที่ขาดเรียนต่อเนื่อง (จาก absence_alerts ที่ Cloud Function คำนวณจากเช็คโฮมรูม)
 * scope: ห้อง (ครูที่ปรึกษา) / ระดับ ≥2 (งานกิจการ, แนะแนว) / ระดับ ≥3 (ผู้บริหาร)
 * canFollowUp: บันทึกผลติดตามได้ (ครูที่ปรึกษา/กิจการ/แนะแนว); canEditThresholds: งานกิจการนักเรียน
 */
export function AbsenceAlertsPanel({ scope, students, canFollowUp = true, canEditThresholds = false }: {
  scope: AlertScope; students: StudentLite[]; canFollowUp?: boolean; canEditThresholds?: boolean;
}) {
  const [alerts, setAlerts] = useState<AbsenceAlert[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null);
  const scopeKey = scope.kind === 'ROOM' ? `R:${scope.room}` : `L:${scope.minLevel}`;

  useEffect(() => {
    if (scope.kind === 'ROOM' && !scope.room) { setAlerts([]); return; }
    setAlerts(null); setError(null);
    return subscribeAbsenceAlerts(scope, setAlerts, e => { setError(e.message); setAlerts([]); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey]);

  const byId = useMemo(() => new Map(students.map(s => [s.studentId, s])), [students]);
  const nameOf = (id: string) => byId.get(id)?.fullName || byId.get(id)?.name || id;

  const refresh = async () => {
    setRefreshing(true); setRefreshMsg(null);
    try { await refreshAbsenceAlerts(); setRefreshMsg('คำนวณใหม่แล้ว'); } catch (e) { setRefreshMsg('คำนวณใหม่ไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e))); } finally { setRefreshing(false); }
  };

  return (
    <div className="space-y-4" data-testid="absence-alerts-panel">
      {canEditThresholds && <ThresholdEditor onSaved={() => undefined} />}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-sm font-bold text-white flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-400" /> นักเรียนขาดเรียนต่อเนื่อง</h3>
          {canEditThresholds && (
            <button onClick={refresh} disabled={refreshing} className="text-[11px] text-indigo-300 hover:text-indigo-200 flex items-center gap-1 disabled:opacity-50">
              {refreshing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} คำนวณใหม่
            </button>
          )}
        </div>
        <p className="text-[11px] text-slate-500">คำนวณจากเช็คโฮมรูมรายวัน (ปรับรอบวันทำการ 17:30) — นับเฉพาะวันที่ครูเช็คแล้ว; การลาไม่นับเป็นขาด; ระบบไม่ส่งข้อความหาผู้ปกครองเอง</p>
        {refreshMsg && <p className="text-[11px] text-slate-300">{refreshMsg}</p>}
        {error && <p role="alert" className="text-[11px] text-rose-400">โหลดไม่สำเร็จ: {error}</p>}
        {alerts === null ? (
          <p className="text-xs text-slate-500 flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> กำลังโหลด...</p>
        ) : alerts.length === 0 && !error ? (
          <p className="text-xs text-slate-500 py-4 text-center">ไม่มีนักเรียนที่ขาดเรียนต่อเนื่องถึงเกณฑ์ในขณะนี้ (หรือยังไม่ได้คำนวณรอบแรก)</p>
        ) : (
          <ul className="space-y-2">
            {alerts.map(a => {
              const st = byId.get(a.studentId);
              const lv = ABSENCE_LEVEL_AUDIENCE[a.level];
              const open = openId === a.studentId;
              return (
                <li key={a.studentId} className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                  <button type="button" onClick={() => setOpenId(open ? null : a.studentId)} className="w-full flex items-center gap-2 text-left" aria-expanded={open}>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${LEVEL_STYLE[a.level]}`}>{lv.label}</span>
                    <span className="text-sm text-white font-semibold">{nameOf(a.studentId)}</span>
                    <span className="text-[11px] text-slate-400">{a.room} · ขาดต่อเนื่อง {a.streakDays} วัน (ตั้งแต่ {a.sinceDate})</span>
                    {open ? <ChevronUp className="w-4 h-4 ml-auto text-slate-400" /> : <ChevronDown className="w-4 h-4 ml-auto text-slate-400" />}
                  </button>
                  {open && (
                    <div className="mt-2 space-y-1">
                      <p className="text-[11px] text-slate-400">ผู้ที่เห็น: {lv.audience}</p>
                      <p className="text-[11px] text-slate-300">แนวทาง: {lv.action}</p>
                      {canFollowUp ? <FollowupBox alert={a} student={st} /> : null}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
