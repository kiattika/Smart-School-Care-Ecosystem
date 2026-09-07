import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Bell, Save, Trash2, Loader2, Plus, Info, Search, Wand2, Timer, X } from 'lucide-react';
import { saveAdminPeriodConfig, deleteAdminPeriodConfig } from '../../services/firestoreService';
import type { AdminPeriodConfig } from '../../hooks/useTeacherFirestoreSchedule';

const PERIOD_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'MAIN', label: 'MAIN (คาบวิชาการ)' },
  { value: 'ACTIVITY', label: 'ACTIVITY (กิจกรรม/โฮมรูม/ชุมนุม)' },
  { value: 'BREAK', label: 'BREAK (พัก/พักกลางวัน)' },
];

const timeToMinutes = (t: string): number => {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
const minutesToTime = (mins: number): string => {
  const wrapped = ((mins % 1440) + 1440) % 1440; // กันเวลาติดลบ/ข้ามเที่ยงคืน
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

/**
 * แอดมิน: กำหนด/แก้ไขเวลาเริ่ม-จบของแต่ละคาบ (คาบ 0-10) — ผูกกับ admin_periods_config ตัวจริงที่
 * useTeacherFirestoreSchedule.ts ใช้คำนวณเวลาคาบจริงในหน้าครู (fsPeriods) โดยตรง
 *
 * ก่อนหน้านี้เมนู "ตารางเวลา & กระดิ่ง" เรียก PeriodManagementPage.tsx ซึ่งอ่าน/เขียน
 * school_settings/periods_config คนละ collection กับที่ระบบจริงใช้เลย (ไม่มีจุดไหนอ่าน collection
 * นั้นเป็นค่าหลัก) — แก้ตารางเวลาจากหน้าแอดมินเดิมแล้วไม่มีผลกับระบบจริง หน้านี้แก้ที่ต้นเหตุ โดยผูกกับ
 * admin_periods_config ตรงๆ แทน — schema เดิม (periodNumber/periodName/startTime/endTime/periodType)
 *
 * เฟสต่อยอด: 3 ความสามารถแบบโปรแกรมจัดตารางสอนจริง — (1) ตรวจจับคาบจาก schedules ที่ import แล้ว
 * (2) gen เวลาอัตโนมัติจากเวลาเริ่ม+ระยะเวลาต่อคาบ (3) ปรับเวลาทั้งวันพร้อมกัน (บวก/ลบนาทีต่อคาบ)
 */
export function AdminPeriodsConfigPage() {
  const [periods, setPeriods] = useState<AdminPeriodConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, AdminPeriodConfig>>({});
  // แถวคาบใหม่ที่กด "เพิ่มคาบ"/"ตรวจจับ" แล้วแต่ยังไม่กดบันทึกจริง — เก็บแยกจาก periods (ซึ่งมาจาก
  // Firestore ตรงๆ ผ่าน onSnapshot) เพื่อไม่ให้ snapshot ที่ยิงมาจากการเปลี่ยนแปลงอื่น (เช่น แอดมินอีกคน
  // แก้คาบอื่นพร้อมกัน) ไปเขียนทับ/ทำแถวที่ยังไม่บันทึกหายไปก่อนกดบันทึก
  const [pendingNewRows, setPendingNewRows] = useState<AdminPeriodConfig[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ id: string; label: string } | null>(null);
  const [detecting, setDetecting] = useState(false);

  // TASK 2: สร้างตารางเวลาอัตโนมัติ
  const [autoStartTime, setAutoStartTime] = useState('08:00');
  const [autoDurationMin, setAutoDurationMin] = useState('50');
  const [autoBreaks, setAutoBreaks] = useState<{ periodNumber: number; extraMinutes: string }[]>([]);
  const [confirmAutoGenerate, setConfirmAutoGenerate] = useState(false);
  const [autoGenerating, setAutoGenerating] = useState(false);

  // TASK 3: ปรับเวลาทั้งวันพร้อมกัน
  const [adjustDeltaMin, setAdjustDeltaMin] = useState('');
  const [confirmAdjust, setConfirmAdjust] = useState(false);
  const [adjusting, setAdjusting] = useState(false);

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

  const makeBlankRow = (periodNumber: number): AdminPeriodConfig =>
    ({ id: `period_${periodNumber}`, periodNumber, periodName: `คาบเรียนที่ ${periodNumber}`, startTime: '', endTime: '', periodType: 'MAIN' });

  const handleAddPeriod = (periodNumber: number) => {
    const row = makeBlankRow(periodNumber);
    setDrafts(prev => ({ ...prev, [row.id]: row }));
    setPendingNewRows(prev => [...prev, row]);
  };

  // TASK 1: ตรวจจับคาบที่มีอยู่จริงจาก schedules ที่ import แล้ว (ทั้ง MAIN และ ACTIVITY) — ไม่ทับคาบ
  // ที่ config ไว้แล้ว แค่เติมแถวว่างให้คาบที่ยังไม่เคยตั้งเวลาไว้เลย
  const handleDetectFromSchedules = async () => {
    setDetecting(true);
    try {
      const snap = await getDocs(collection(db, 'schedules'));
      const found = new Set<number>();
      snap.forEach(d => {
        const n = Number((d.data() as any).periodNumber);
        if (Number.isFinite(n) && n >= 0) found.add(n);
      });
      const missing = Array.from(found).filter(n => !usedNumbers.has(n)).sort((a, b) => a - b);
      if (missing.length === 0) {
        flash('ไม่พบคาบใหม่ — คาบทั้งหมดจากตารางสอนถูกตั้งค่าไว้แล้ว');
        return;
      }
      const newRows = missing.map(makeBlankRow);
      setPendingNewRows(prev => [...prev, ...newRows]);
      setDrafts(prev => {
        const next = { ...prev };
        newRows.forEach(r => { next[r.id] = r; });
        return next;
      });
      flash(`ตรวจพบคาบใหม่ ${missing.length} คาบ (${missing.join(', ')}) — กรอกเวลาแล้วบันทึกทีละแถว หรือใช้ "สร้างอัตโนมัติ" ด้านล่าง`);
    } catch (e) {
      flash('ตรวจจับไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setDetecting(false);
    }
  };

  // TASK 2: สร้างเวลาอัตโนมัติต่อเนื่องกันจากเวลาเริ่ม + ระยะเวลาต่อคาบ + ช่วงพักเสริม (ถ้ามี) —
  // ครอบคลุมทุกคาบที่แสดงอยู่ตอนนี้ (ทั้งที่ตรวจจับมาและที่มีอยู่แล้ว) เขียนทับเวลาเดิมทั้งหมด
  const handleAutoGenerate = async () => {
    const baseDuration = parseInt(autoDurationMin, 10);
    if (!autoStartTime) { flash('กรอกเวลาเริ่มคาบแรกก่อน'); return; }
    if (!Number.isFinite(baseDuration) || baseDuration <= 0) { flash('กรอกระยะเวลาต่อคาบเป็นตัวเลขมากกว่า 0'); return; }
    if (displayRows.length === 0) { flash('ยังไม่มีคาบให้สร้างเวลา — ตรวจจับหรือเพิ่มคาบก่อน'); return; }

    setAutoGenerating(true);
    try {
      let cursor = timeToMinutes(autoStartTime);
      const rows = [...displayRows].sort((a, b) => a.periodNumber - b.periodNumber);
      for (const row of rows) {
        const extra = autoBreaks.find(b => b.periodNumber === row.periodNumber);
        const extraMin = extra ? (parseInt(extra.extraMinutes, 10) || 0) : 0;
        const duration = baseDuration + extraMin;
        const start = cursor;
        const end = cursor + duration;
        const updated: AdminPeriodConfig = { ...row, startTime: minutesToTime(start), endTime: minutesToTime(end) };
        await saveAdminPeriodConfig(updated);
        cursor = end;
      }
      setDrafts({});
      setPendingNewRows([]);
      setConfirmAutoGenerate(false);
      flash(`สร้างเวลาอัตโนมัติให้ ${rows.length} คาบแล้ว`);
    } catch (e) {
      flash('สร้างอัตโนมัติไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setAutoGenerating(false);
    }
  };

  const addBreakRow = () => {
    const candidate = displayRows.find(p => !autoBreaks.some(b => b.periodNumber === p.periodNumber));
    if (!candidate) return;
    setAutoBreaks(prev => [...prev, { periodNumber: candidate.periodNumber, extraMinutes: '10' }]);
  };

  // TASK 3: ปรับเวลาคาบทั้งวันพร้อมกัน (บวก/ลบนาทีต่อคาบ) — ตัดสินใจแล้ว: เป็นการปรับถาวร (เปลี่ยน
  // admin_periods_config ตรงๆ) ไม่ใช่ปรับเฉพาะวันเดียว เพราะ schema ปัจจุบันไม่มีมิติ "วันที่" อยู่แล้ว
  // (ทุกคาบใช้ร่วมกันทุกวัน) — ถ้าต้องการปรับเฉพาะวันในอนาคต ต้องเพิ่มมิติวันที่เข้า schema เป็นงานแยก
  // ต่างหาก ไม่ใช่ขยายจากจุดนี้ตรงๆ คำนวณต่อเนื่องจากเวลาเริ่มคาบแรกเดิม ไม่ใช่แค่ขยับคาบแรกคาบเดียว
  const handleAdjustWholeDay = async () => {
    const delta = parseInt(adjustDeltaMin, 10);
    if (!Number.isFinite(delta) || delta === 0) { flash('กรอกจำนวนนาทีที่ต้องการปรับ (ติดลบ = ลด)'); return; }
    const saved = [...periods].sort((a, b) => a.periodNumber - b.periodNumber);
    if (saved.length === 0) { flash('ยังไม่มีคาบที่บันทึกไว้ให้ปรับ'); return; }

    setAdjusting(true);
    try {
      let cursor = timeToMinutes(saved[0].startTime);
      for (const row of saved) {
        const originalDuration = timeToMinutes(row.endTime) - timeToMinutes(row.startTime);
        const newDuration = Math.max(1, originalDuration + delta); // กันเวลาติดลบ/เป็น 0
        const start = cursor;
        const end = cursor + newDuration;
        await saveAdminPeriodConfig({ ...row, startTime: minutesToTime(start), endTime: minutesToTime(end) });
        cursor = end;
      }
      setConfirmAdjust(false);
      flash(`ปรับเวลาทั้งวัน ${delta > 0 ? '+' : ''}${delta} นาทีต่อคาบแล้ว (${saved.length} คาบ)`);
    } catch (e) {
      flash('ปรับเวลาไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setAdjusting(false);
    }
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

      {/* TASK 1: ตรวจจับคาบจากตารางสอนที่นำเข้าแล้ว */}
      <div className="bg-[#0f1219] border border-white/10 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2"><Search className="w-4 h-4 text-blue-400" /> ตรวจจับคาบจากตารางสอนที่นำเข้าแล้ว</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">อ่านเลขคาบทั้งหมด (MAIN + ACTIVITY) จริงจาก schedules — เติมเฉพาะคาบที่ยังไม่เคยตั้งเวลาไว้</p>
        </div>
        <button
          onClick={handleDetectFromSchedules}
          disabled={detecting}
          className="px-4 py-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-bold flex items-center gap-1.5"
        >
          {detecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />} ตรวจจับคาบ
        </button>
      </div>

      <div className="bg-[#0f1219] border border-white/10 rounded-2xl p-5 space-y-3">
        {loading ? (
          <div className="py-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> กำลังโหลด...
          </div>
        ) : displayRows.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">ยังไม่มีคาบเรียนที่ตั้งค่าไว้ — เพิ่มคาบแรกด้านล่าง หรือกด "ตรวจจับคาบ" ด้านบน</div>
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

      {/* TASK 2: สร้างตารางเวลาอัตโนมัติ */}
      <div className="bg-[#0f1219] border border-white/10 rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2"><Wand2 className="w-4 h-4 text-emerald-400" /> สร้างตารางเวลาอัตโนมัติ</h3>
        <p className="text-[11px] text-slate-500 -mt-2">คำนวณเวลาเริ่ม-จบของทุกคาบด้านบนให้ต่อเนื่องกันอัตโนมัติ — เขียนทับเวลาเดิมทั้งหมด แก้ไขรายคาบทีหลังได้ตามปกติ</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-xs text-slate-400 space-y-1 block">
            เวลาเริ่มคาบแรก
            <input
              type="time"
              value={autoStartTime}
              onChange={e => setAutoStartTime(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
            />
          </label>
          <label className="text-xs text-slate-400 space-y-1 block">
            ระยะเวลาต่อคาบ (นาที)
            <input
              type="number"
              min={1}
              value={autoDurationMin}
              onChange={e => setAutoDurationMin(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
            />
          </label>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">ช่วงพักเสริม (เพิ่มนาทีพิเศษให้คาบใดคาบหนึ่ง เช่น พักกลางวัน)</span>
            <button
              onClick={addBreakRow}
              disabled={autoBreaks.length >= displayRows.length}
              className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="w-3 h-3" /> เพิ่มช่วงพัก
            </button>
          </div>
          {autoBreaks.map((b, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                value={b.periodNumber}
                onChange={e => setAutoBreaks(prev => prev.map((x, xi) => xi === i ? { ...x, periodNumber: Number(e.target.value) } : x))}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-emerald-500"
              >
                {displayRows.map(p => <option key={p.periodNumber} value={p.periodNumber}>คาบ {p.periodNumber}</option>)}
              </select>
              <span className="text-[11px] text-slate-500">พักเพิ่ม</span>
              <input
                type="number"
                min={1}
                value={b.extraMinutes}
                onChange={e => setAutoBreaks(prev => prev.map((x, xi) => xi === i ? { ...x, extraMinutes: e.target.value } : x))}
                className="w-20 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-emerald-500"
              />
              <span className="text-[11px] text-slate-500">นาที</span>
              <button onClick={() => setAutoBreaks(prev => prev.filter((_, xi) => xi !== i))} className="text-slate-500 hover:text-red-400 ml-auto">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={() => setConfirmAutoGenerate(true)}
          disabled={autoGenerating || displayRows.length === 0}
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5"
        >
          {autoGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} สร้างเวลาอัตโนมัติ ({displayRows.length} คาบ)
        </button>
      </div>

      {/* TASK 3: ปรับเวลาคาบทั้งวันพร้อมกัน */}
      <div className="bg-[#0f1219] border border-white/10 rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2"><Timer className="w-4 h-4 text-amber-400" /> ปรับเวลาคาบทั้งวันพร้อมกัน</h3>
        <p className="text-[11px] text-slate-500 -mt-2">
          สำหรับวันที่มีกิจกรรมพิเศษ — ปรับถาวร (มีผลทุกวันจนกว่าจะปรับกลับ เพราะระบบยังไม่มีมิติ "เฉพาะวันที่" แยกต่างหาก)
          คำนวณต่อเนื่องจากเวลาเริ่มคาบแรกเดิม ไม่ใช่แค่ขยับคาบแรกคาบเดียว
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs text-slate-400 flex items-center gap-2">
            ปรับ
            <input
              type="number"
              value={adjustDeltaMin}
              onChange={e => setAdjustDeltaMin(e.target.value)}
              placeholder="เช่น -5 หรือ 10"
              className="w-28 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-amber-500"
            />
            นาทีต่อคาบ (ติดลบ = ลด)
          </label>
          <button
            onClick={() => setConfirmAdjust(true)}
            disabled={adjusting || periods.length === 0}
            className="px-4 py-2 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 disabled:opacity-40 text-xs font-bold flex items-center gap-1.5"
          >
            {adjusting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Timer className="w-3.5 h-3.5" />} ปรับเวลาทั้งวัน ({periods.length} คาบที่บันทึกแล้ว)
          </button>
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

      {confirmAutoGenerate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#151921] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-white/10 bg-emerald-950/30">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-emerald-400" /> ยืนยันสร้างเวลาอัตโนมัติ
              </h2>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-300">
                จะเขียนทับเวลาเริ่ม-จบของ <strong className="text-white">{displayRows.length} คาบ</strong> ทั้งหมดด้วยเวลาที่คำนวณใหม่ (เริ่ม {autoStartTime}, คาบละ {autoDurationMin} นาที)
                เวลาที่เคยแก้ไว้เองจะถูกแทนที่ ยืนยันหรือไม่?
              </p>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setConfirmAutoGenerate(false)} className="px-3 py-2 rounded-lg text-xs font-bold text-slate-300 hover:bg-white/5">
                  ยกเลิก
                </button>
                <button
                  onClick={handleAutoGenerate}
                  disabled={autoGenerating}
                  className="px-3 py-2 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 flex items-center gap-1.5"
                >
                  {autoGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} ยืนยันสร้าง
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmAdjust && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#151921] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-white/10 bg-amber-950/30">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Timer className="w-4 h-4 text-amber-400" /> ยืนยันปรับเวลาทั้งวัน
              </h2>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-300">
                จะปรับทุกคาบที่บันทึกไว้แล้ว ({periods.length} คาบ) {Number(adjustDeltaMin) > 0 ? '+' : ''}{adjustDeltaMin} นาทีต่อคาบ แบบต่อเนื่องกันทั้งวัน
                — มีผลถาวรจนกว่าจะปรับกลับ ยืนยันหรือไม่?
              </p>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setConfirmAdjust(false)} className="px-3 py-2 rounded-lg text-xs font-bold text-slate-300 hover:bg-white/5">
                  ยกเลิก
                </button>
                <button
                  onClick={handleAdjustWholeDay}
                  disabled={adjusting}
                  className="px-3 py-2 rounded-lg text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 flex items-center gap-1.5"
                >
                  {adjusting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Timer className="w-3.5 h-3.5" />} ยืนยันปรับ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
