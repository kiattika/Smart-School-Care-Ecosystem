import React, { useState } from 'react';
import { Droplet, Loader2, Lock } from 'lucide-react';
import { BLOOD_GROUPS, type BloodGroup } from '../../lib/bloodType';
import { setStudentBloodType } from '../../services/firestoreService';
import { useStudentBloodType } from '../../hooks/useStudentBloodType';

type Actor = { uid: string; role: 'STUDENT' | 'PARENT' | 'NURSE' | 'ADMIN' };

/**
 * หมู่เลือด — หมู่เลือดไม่เปลี่ยนตลอดชีวิต: เลือกได้ครั้งเดียว (นักเรียน/ผู้ปกครอง) เลือกแล้วล็อก
 * ถ้าบันทึกผิดให้ขอพยาบาลแก้ให้ (พยาบาล/แอดมิน `canChange` แก้ได้เอง) — rules บังคับด้วย (update เฉพาะพยาบาล/แอดมิน)
 */
export function BloodTypeCard({ studentId, actor, canChange = false }: { studentId: string; actor: Actor | null; canChange?: boolean }) {
  const { doc, error } = useStudentBloodType(studentId);
  const [pick, setPick] = useState<BloodGroup | ''>('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);

  const locked = !!doc && !changing;
  const save = async () => {
    if (!actor || !pick) return;
    setBusy(true); setErr(null);
    try {
      await setStudentBloodType({ studentId, bloodType: pick, actorUid: actor.uid, actorRole: actor.role });
      setPick(''); setChanging(false);
    } catch (e) {
      setErr('บันทึกไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)));
    } finally { setBusy(false); }
  };

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-2" data-testid="blood-type-card">
      <div className="flex items-center gap-2 text-xs font-bold text-rose-300"><Droplet className="w-4 h-4" /> หมู่เลือด</div>
      {error && <p className="text-[11px] text-rose-300">อ่านข้อมูลไม่ได้: {error}</p>}
      {doc === undefined && !error && <p className="text-xs text-slate-400 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> กำลังโหลด…</p>}
      {locked && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black text-white" data-testid="blood-type-value">{doc!.bloodType}</span>
            <span className="inline-flex items-center gap-1 text-[10px] text-slate-400"><Lock className="w-3 h-3" /> ล็อกแล้ว</span>
          </div>
          {canChange
            ? <button onClick={() => { setChanging(true); setPick(doc!.bloodType); }} className="text-[11px] text-indigo-300 underline">แก้ไขหมู่เลือด (เจ้าหน้าที่)</button>
            : <p className="text-[10px] text-slate-500">หมู่เลือดไม่เปลี่ยนตลอดชีวิต หากบันทึกผิด แจ้งเจ้าหน้าที่ห้องพยาบาลเพื่อแก้ไข</p>}
        </div>
      )}
      {(doc === null || changing) && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="หมู่เลือด">
            {BLOOD_GROUPS.map(g => (
              <button key={g} type="button" role="radio" aria-checked={pick === g} onClick={() => setPick(g)}
                className={`px-4 py-2 rounded-xl text-sm font-bold border ${pick === g ? 'bg-rose-600 border-rose-400 text-white' : 'bg-slate-950 border-slate-700 text-slate-300'}`}>{g}</button>
            ))}
          </div>
          {!canChange && <p className="text-[10px] text-amber-300">เลือกแล้วเปลี่ยนเองไม่ได้ (หมู่เลือดไม่เปลี่ยนตลอดชีวิต) ถ้าไม่แน่ใจ ยังไม่ต้องเลือก</p>}
          {err && <p className="text-[11px] text-rose-300">{err}</p>}
          <div className="flex gap-2">
            <button onClick={save} disabled={!pick || busy || !actor} className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-40 rounded-lg flex items-center gap-1.5">
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} บันทึกหมู่เลือด
            </button>
            {changing && <button onClick={() => { setChanging(false); setPick(''); }} className="px-3 py-1.5 text-xs text-slate-300 bg-slate-800 rounded-lg">ยกเลิก</button>}
          </div>
        </div>
      )}
    </div>
  );
}
