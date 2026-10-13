import React, { useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { CalendarClock, Loader2, Save, X } from 'lucide-react';
import type { ElectiveActivityConfig } from '../../types';
import { DatePicker } from '../shared/DatePicker';
import { TimePicker } from '../shared/TimePicker';
import { updateElectiveActivity } from '../../services/firestoreService';
import { composeLocalMillis, splitLocalMillis, toMillis, validateEnrollmentWindow } from '../../lib/enrollmentWindow';

/**
 * ตั้งช่วงเวลาเปิด–ปิดรับสมัครของชุมนุม (ฟอร์มเดียวกับการตั้งช่วงกรอกคะแนน): แอดมิน/ผู้ดูแลวิชาการ และ
 * ครูรับผิดชอบชุมนุมนั้นใช้ได้ (rules: ครูแก้ได้เฉพาะ enrollmentOpensAt/ClosesAt/Status) — ว่าง = ไม่จำกัดด้านนั้น
 */
export function EnrollmentWindowEditor({ cfg, onDone }: { cfg: ElectiveActivityConfig; onDone?: (msg: string) => void }) {
  const o = splitLocalMillis(toMillis(cfg.enrollmentOpensAt));
  const c = splitLocalMillis(toMillis(cfg.enrollmentClosesAt));
  const [openDate, setOpenDate] = useState(o.ymd);
  const [openTime, setOpenTime] = useState(o.hhmm);
  const [closeDate, setCloseDate] = useState(c.ymd);
  const [closeTime, setCloseTime] = useState(c.hhmm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const opens = composeLocalMillis(openDate, openTime, '00:00');
    const closes = composeLocalMillis(closeDate, closeTime, '23:59');
    const err = validateEnrollmentWindow(opens, closes);
    if (err) { setError(err); return; }
    setBusy(true); setError(null);
    try {
      await updateElectiveActivity(cfg.id, {
        enrollmentOpensAt: opens === null ? null : Timestamp.fromMillis(opens),
        enrollmentClosesAt: closes === null ? null : Timestamp.fromMillis(closes),
      });
      onDone?.(`บันทึกช่วงเวลารับสมัครของ "${cfg.name}" แล้ว`);
    } catch (e) {
      setError('บันทึกไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)));
    } finally { setBusy(false); }
  };

  const clearAll = () => { setOpenDate(''); setOpenTime(''); setCloseDate(''); setCloseTime(''); };

  return (
    <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-3 space-y-3" data-testid="enrollment-window-editor">
      <p className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5"><CalendarClock className="w-3.5 h-3.5 text-indigo-400" /> ช่วงเวลารับสมัคร — {cfg.name}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <span className="text-[10px] text-slate-400">เปิดรับสมัคร (ว่าง = เปิดทันที)</span>
          <div className="flex gap-2"><DatePicker value={openDate} onChange={setOpenDate} clearable ariaLabel="วันที่เปิดรับสมัคร" /><TimePicker value={openTime} onChange={setOpenTime} minuteStep={5} ariaLabel="เวลาเปิดรับสมัคร" /></div>
        </div>
        <div className="space-y-1">
          <span className="text-[10px] text-slate-400">ปิดรับสมัคร (ว่าง = ไม่กำหนดเวลาปิด; ไม่ใส่เวลา = สิ้นวัน 23:59)</span>
          <div className="flex gap-2"><DatePicker value={closeDate} onChange={setCloseDate} clearable ariaLabel="วันที่ปิดรับสมัคร" /><TimePicker value={closeTime} onChange={setCloseTime} minuteStep={5} ariaLabel="เวลาปิดรับสมัคร" /></div>
        </div>
      </div>
      {error && <p className="text-[11px] text-rose-400">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button onClick={clearAll} className="px-3 py-1.5 text-[11px] text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center gap-1"><X className="w-3 h-3" /> ล้างเวลา</button>
        <button onClick={save} disabled={busy} className="px-3 py-1.5 text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg flex items-center gap-1">
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} บันทึก
        </button>
      </div>
    </div>
  );
}
