import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Bell, Save, Trash2, Loader2, Plus, Info } from 'lucide-react';
import { saveAdminPeriodConfig, deleteAdminPeriodConfig } from '../../services/firestoreService';
import type { AdminPeriodConfig } from '../../hooks/useTeacherFirestoreSchedule';

const PERIOD_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'MAIN', label: 'MAIN (คาบวิชาการ)' },
  { value: 'ACTIVITY', label: 'ACTIVITY (กิจกรรม/โฮมรูม/ชุมนุม)' },
  { value: 'BREAK', label: 'BREAK (พัก/พักกลางวัน)' },
];

/**
 * แอดมิน: กำหนด/แก้ไขเวลาเริ่ม-จบของแต่ละคาบ (คาบ 0-10) — ผูกกับ admin_periods_config ตัวจริงที่
 * useTeacherFirestoreSchedule.ts ใช้คำนวณเวลาคาบจริงในหน้าครู (fsPeriods) โดยตรง
 *
 * ก่อนหน้านี้เมนู "ตารางเวลา & กระดิ่ง" เรียก PeriodManagementPage.tsx ซึ่งอ่าน/เขียน
 * school_settings/periods_config คนละ collection กับที่ระบบจริงใช้เลย (ไม่มีจุดไหนอ่าน collection
 * นั้นเป็นค่าหลัก) — แก้ตารางเวลาจากหน้าแอดมินเดิมแล้วไม่มีผลกับระบบจริง หน้านี้แก้ที่ต้นเหตุ โดยผูกกับ
 * admin_periods_config ตรงๆ แทน — schema เดิม (periodNumber/periodName/startTime/endTime/periodType)
 */
export function AdminPeriodsConfigPage() {
  const [periods, setPeriods] = useState<AdminPeriodConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, AdminPeriodConfig>>({});
  // แถวคาบใหม่ที่กด "เพิ่มคาบ" แล้วแต่ยังไม่กดบันทึกจริง — เก็บแยกจาก periods (ซึ่งมาจาก Firestore
  // ตรงๆ ผ่าน onSnapshot) เพื่อไม่ให้ snapshot ที่ยิงมาจากการเปลี่ยนแปลงอื่น (เช่น แอดมินอีกคนแก้คาบอื่น
  // พร้อมกัน) ไปเขียนทับ/ทำแถวที่ยังไม่บันทึกหายไปก่อนกดบันทึก
  const [pendingNewRows, setPendingNewRows] = useState<AdminPeriodConfig[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ id: string; label: string } | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'admin_periods_config'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as AdminPeriodConfig));
      list.sort((a, b) => a.periodNumber - b.periodNumber);
      setPeriods(list);
      setLoading(false);
    }, (err) => {
      console.warn('[AdminPeriodsConfigPage] listener:', err.message);
      setLoading(false);
    });
    return unsub;
  }, []);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3500); };

  const getDraft = (p: AdminPeriodConfig): AdminPeriodConfig => drafts[p.id] || p;

  const setDraftField = (p: AdminPeriodConfig, field: keyof AdminPeriodConfig, value: string | number) => {
    setDrafts(prev => ({ ...prev, [p.id]: { ...getDraft(p), [field]: value } }));
  };

  const handleSaveRow = async (p: AdminPeriodConfig) => {
    const draft = getDraft(p);
    if (!draft.periodName.trim()) { flash('กรอกชื่อคาบก่อน'); return; }
    if (!draft.startTime || !draft.endTime) { flash('กรอกเวลาเริ่ม-จบให้ครบ'); return; }
    if (draft.startTime >= draft.endTime) { flash('เวลาเริ่มต้องน้อยกว่าเวลาจบ'); return; }
    setBusy(p.id);
    try {
      await saveAdminPeriodConfig(draft);
      setDrafts(prev => { const next = { ...prev }; delete next[p.id]; return next; });
      setPendingNewRows(prev => prev.filter(r => r.id !== p.id));
      flash(`บันทึกคาบ ${draft.periodNumber} แล้ว`);
    } catch (e) {
      flash('ไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  };

  const handleConfirmRemove = async () => {
    if (!removeTarget) return;
    setBusy(removeTarget.id);
    try {
      await deleteAdminPeriodConfig(removeTarget.id);
      setPendingNewRows(prev => prev.filter(r => r.id !== removeTarget.id));
      flash('ลบคาบแล้ว');
      setRemoveTarget(null);
    } catch (e) {
      flash('ไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  };

  // แถวที่แสดงจริง = periods จาก Firestore + แถวใหม่ที่ยังไม่บันทึก (กันซ้ำด้วย id)
  const displayRows = useMemo(() => {
    const extra = pendingNewRows.filter(r => !periods.some(p => p.id === r.id));
    return [...periods, ...extra].sort((a, b) => a.periodNumber - b.periodNumber);
  }, [periods, pendingNewRows]);

  // คาบที่ยังไม่ถูกสร้าง (0-10) — ให้กดเพิ่มได้ทันที ไม่ต้องพิมพ์เลขคาบเอง กันเลขซ้ำ/พิมพ์ผิด
  const usedNumbers = useMemo(() => new Set(displayRows.map(p => p.periodNumber)), [displayRows]);
  const availableToAdd = useMemo(
    () => Array.from({ length: 11 }, (_, i) => i).filter(n => !usedNumbers.has(n)),
    [usedNumbers]
  );

  const handleAddPeriod = (periodNumber: number) => {
    const id = `period_${periodNumber}`;
    const row: AdminPeriodConfig = { id, periodNumber, periodName: `คาบเรียนที่ ${periodNumber}`, startTime: '', endTime: '', periodType: 'MAIN' };
    setDrafts(prev => ({ ...prev, [id]: row }));
    setPendingNewRows(prev => [...prev, row]);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="border-b border-white/5 pb-4">
        <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <Bell className="w-6 h-6 text-indigo-400" /> ตารางเวลา & กระดิ่งคาบเรียน
        </h2>
        <p className="text-slate-400 mt-1 text-sm">
          กำหนดเวลาเริ่ม-จบของแต่ละคาบ (คาบ 0-10) — มีผลกับเวลาคาบจริงที่ครูเห็นในหน้าเช็คชื่อทันที
        </p>
      </div>

      {toast && <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-xs text-emerald-300">{toast}</div>}

      <div className="bg-[#0f1219] border border-white/10 rounded-2xl p-5 space-y-3">
        {loading ? (
          <div className="py-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> กำลังโหลด...
          </div>
        ) : displayRows.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">ยังไม่มีคาบเรียนที่ตั้งค่าไว้ — เพิ่มคาบแรกด้านล่าง</div>
        ) : (
          <div className="space-y-2">
            {displayRows.map(p => {
              const draft = getDraft(p);
              const dirty = !!drafts[p.id];
              return (
                <div key={p.id} className="grid grid-cols-1 sm:grid-cols-[3rem_1fr_7rem_7rem_11rem_auto] gap-2 items-center bg-slate-900/40 border border-slate-800 rounded-lg px-3 py-2.5">
                  <span className="text-xs font-bold text-indigo-400 text-center">คาบ {p.periodNumber}</span>
                  <input
                    value={draft.periodName}
                    onChange={e => setDraftField(p, 'periodName', e.target.value)}
                    placeholder="ชื่อคาบ"
                    className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
                  />
                  <input
                    type="time"
                    value={draft.startTime}
                    onChange={e => setDraftField(p, 'startTime', e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
                  />
                  <input
                    type="time"
                    value={draft.endTime}
                    onChange={e => setDraftField(p, 'endTime', e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
                  />
                  <select
                    value={draft.periodType}
                    onChange={e => setDraftField(p, 'periodType', e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
                  >
                    {PERIOD_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <div className="flex items-center gap-1.5 justify-end">
                    <button
                      onClick={() => handleSaveRow(p)}
                      disabled={busy === p.id || !dirty}
                      title="บันทึก"
                      className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed text-white"
                    >
                      {busy === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => setRemoveTarget({ id: p.id, label: `คาบ ${p.periodNumber} (${p.periodName})` })}
                      disabled={busy === p.id}
                      title="ลบคาบ"
                      className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {availableToAdd.length > 0 && (
          <div className="pt-2 border-t border-white/5 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-500 mr-1">เพิ่มคาบ:</span>
            {availableToAdd.map(n => (
              <button
                key={n}
                onClick={() => handleAddPeriod(n)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> คาบ {n}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-start gap-2 text-[11px] text-slate-500 pt-1">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>คาบที่แก้ไขค้างไว้แต่ยังไม่กดบันทึก (ไอคอนบันทึกติดสี) จะยังไม่มีผลกับระบบจริงจนกว่าจะกดบันทึกทีละแถว</span>
        </div>
      </div>

      {removeTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#151921] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-white/10 bg-red-950/30">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-red-400" /> ยืนยันลบคาบ
              </h2>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-300">
                ลบ <strong className="text-white">{removeTarget.label}</strong>? ครูจะไม่เห็นเวลาคาบนี้อีกต่อไปในหน้าเช็คชื่อ
              </p>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setRemoveTarget(null)} className="px-3 py-2 rounded-lg text-xs font-bold text-slate-300 hover:bg-white/5">
                  ยกเลิก
                </button>
                <button
                  onClick={handleConfirmRemove}
                  disabled={busy === removeTarget.id}
                  className="px-3 py-2 rounded-lg text-xs font-bold text-white bg-red-600 hover:bg-red-500 flex items-center gap-1.5"
                >
                  {busy === removeTarget.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} ยืนยันลบ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
