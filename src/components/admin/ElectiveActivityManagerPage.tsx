import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Users, Save, Trash2, Loader2, Search, Info } from 'lucide-react';
import { useElectiveActivities } from '../../hooks/useElectiveActivities';
import { saveElectiveActivityConfig, removeElectiveActivityConfig } from '../../services/firestoreService';
import { useStore } from '../../store';

interface ScheduleSubjectOption {
  subjectCode: string;
  name: string;
  sectionCount: number; // จำนวน scheduleId ที่ใช้ subjectCode นี้ (นับ document ดิบ ไม่ได้กันซ้ำคาบ)
}

/**
 * แอดมิน/หัวหน้าฝ่ายวิชาการ: กำหนดว่า subjectCode ไหนเป็นชุมนุม/กิจกรรมตามความสนใจ (ELECTIVE —
 * นักเรียนสมัครเอง มีที่นั่งจำกัด) พร้อม capacity ต่อ section — ตรงข้ามกับกิจกรรม/วิชายกห้อง
 * (WHOLE_CLASS) ที่ดึงรายชื่อจาก room ตรงๆ (ดู TeacherPortal.tsx courseStudents)
 */
export function ElectiveActivityManagerPage() {
  const { user } = useStore();
  const { configs, loading: configsLoading } = useElectiveActivities();
  const [subjectOptions, setSubjectOptions] = useState<ScheduleSubjectOption[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCode, setSelectedCode] = useState('');
  const [selectedName, setSelectedName] = useState('');
  const [capacityInput, setCapacityInput] = useState<string>('');
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // ดึงรายชื่อ subjectCode ทั้งหมดที่มีอยู่จริงใน schedules — ให้แอดมินเลือกจากของจริง ไม่ต้องพิมพ์เอง
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'schedules'), (snap) => {
      const map = new Map<string, ScheduleSubjectOption>();
      snap.forEach(d => {
        const data = d.data() as any;
        const code = data.subjectCode || '';
        if (!code) return;
        const existing = map.get(code);
        if (existing) existing.sectionCount++;
        else map.set(code, { subjectCode: code, name: data.subjectName || code, sectionCount: 1 });
      });
      setSubjectOptions(Array.from(map.values()).sort((a, b) => a.subjectCode.localeCompare(b.subjectCode)));
    }, (err) => console.warn('[ElectiveActivityManagerPage] schedules listener:', err.message));
    return unsub;
  }, []);

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return subjectOptions;
    return subjectOptions.filter(o => o.subjectCode.toLowerCase().includes(q) || o.name.toLowerCase().includes(q));
  }, [subjectOptions, search]);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3500); };

  const handleSave = async () => {
    if (!selectedCode) { flash('เลือกวิชา/กิจกรรมก่อน'); return; }
    setBusy('save');
    try {
      const capacityPerSection = capacityInput.trim() === '' ? null : Math.max(0, parseInt(capacityInput, 10) || 0);
      await saveElectiveActivityConfig({
        subjectCode: selectedCode,
        name: selectedName || selectedCode,
        capacityPerSection,
        createdBy: user?.uid || 'unknown',
      });
      flash(`ตั้งค่า "${selectedName || selectedCode}" เป็นชุมนุม (ELECTIVE) แล้ว`);
      setSelectedCode('');
      setSelectedName('');
      setCapacityInput('');
    } catch (e) {
      flash('ไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  };

  const handleRemove = async (subjectCode: string, name: string) => {
    if (!window.confirm(`ยกเลิกการเป็นชุมนุม (ELECTIVE) ของ "${name}"? (กลับไปเป็นกิจกรรมยกห้องปกติ — ไม่ลบประวัติการสมัครเดิม)`)) return;
    setBusy(subjectCode);
    try {
      await removeElectiveActivityConfig(subjectCode);
      flash('ยกเลิกแล้ว');
    } catch (e) {
      flash('ไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-400" /> จัดการชุมนุม (Elective Activities)
          </h2>
          <p className="text-slate-400 mt-1 text-sm">
            กำหนดว่าวิชา/กิจกรรมใดให้นักเรียนสมัครเองได้ (มีที่นั่งจำกัด) แทนการเข้าเรียนตามห้องปกติ
          </p>
        </div>
      </div>

      {toast && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-xs text-emerald-300">{toast}</div>
      )}

      {/* Add / mark as elective */}
      <div className="bg-[#0f1219] border border-white/10 rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-white">ตั้งค่าใหม่</h3>
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ค้นหารหัสวิชา/ชื่อกิจกรรมจากตารางสอนจริง..."
            className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
          />
        </div>
        <div className="max-h-48 overflow-y-auto border border-white/5 rounded-xl divide-y divide-white/5">
          {filteredOptions.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500">ไม่พบวิชา/กิจกรรมที่ตรงกับคำค้นหา</div>
          ) : filteredOptions.map(opt => {
            const alreadyElective = configs.some(c => c.subjectCode === opt.subjectCode);
            return (
              <button
                key={opt.subjectCode}
                onClick={() => { setSelectedCode(opt.subjectCode); setSelectedName(opt.name); }}
                className={`w-full text-left px-4 py-2.5 text-xs flex items-center justify-between transition-colors ${
                  selectedCode === opt.subjectCode ? 'bg-indigo-500/20' : 'hover:bg-white/5'
                }`}
              >
                <span className="text-slate-200">{opt.name} <code className="text-slate-500">({opt.subjectCode})</code></span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="text-slate-500">{opt.sectionCount} section</span>
                  {alreadyElective && <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded">ELECTIVE แล้ว</span>}
                </span>
              </button>
            );
          })}
        </div>

        {selectedCode && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center gap-3">
            <div className="text-xs text-slate-300 flex-1 min-w-[10rem]">
              เลือก: <strong className="text-white">{selectedName}</strong> <code className="text-slate-500">({selectedCode})</code>
            </div>
            <label className="text-xs text-slate-400 flex items-center gap-2">
              ที่นั่งต่อ section
              <input
                type="number"
                min={0}
                value={capacityInput}
                onChange={e => setCapacityInput(e.target.value)}
                placeholder="ไม่จำกัด"
                className="w-24 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:border-indigo-500"
              />
            </label>
            <button
              onClick={handleSave}
              disabled={busy === 'save'}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5"
            >
              {busy === 'save' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} บันทึกเป็น ELECTIVE
            </button>
          </div>
        )}
        <div className="flex items-start gap-2 text-[11px] text-slate-500">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>ที่นั่งต่อ section ใช้ค่าเดียวกันทุกกลุ่ม/ห้องสอนของกิจกรรมนี้ — ถ้ามี 2 กลุ่มสอน แต่ละกลุ่มนับที่นั่งแยกกันอิสระ (ไม่ใช่แชร์โควตารวม)</span>
        </div>
      </div>

      {/* Existing configs */}
      <div className="bg-[#0f1219] border border-white/10 rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-bold text-white">ชุมนุม/กิจกรรม ELECTIVE ปัจจุบัน ({configs.length})</h3>
        {configsLoading ? (
          <div className="py-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> กำลังโหลด...
          </div>
        ) : configs.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">ยังไม่มีการตั้งค่า ELECTIVE</div>
        ) : (
          <div className="space-y-1.5">
            {configs.map(c => (
              <div key={c.id} className="flex items-center gap-3 bg-slate-900/40 border border-slate-800 rounded-lg px-3 py-2.5">
                <span className="flex-1 text-sm text-slate-200">{c.name}</span>
                <code className="text-[10px] text-slate-600">{c.subjectCode}</code>
                <span className="text-xs font-bold text-indigo-400 shrink-0">
                  {c.capacityPerSection === null ? 'ไม่จำกัดที่นั่ง' : `${c.capacityPerSection} ที่นั่ง/section`}
                </span>
                <button
                  onClick={() => handleRemove(c.subjectCode, c.name)}
                  disabled={busy === c.subjectCode}
                  className="text-red-400 hover:text-red-300 p-1.5"
                  title="ยกเลิกการเป็น ELECTIVE"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
