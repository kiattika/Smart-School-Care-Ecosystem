import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Users, Save, Trash2, Loader2, Search, Info, Pencil, X } from 'lucide-react';
import { useElectiveActivities } from '../../hooks/useElectiveActivities';
import { createElectiveActivity, updateElectiveActivity, removeElectiveActivityConfig } from '../../services/firestoreService';
import { useStore } from '../../store';

interface TeacherOption {
  uid: string;
  name: string;
}

/**
 * แอดมินงานชุมนุม: สร้างชุมนุม/กิจกรรมตามความสนใจ (ELECTIVE — นักเรียนสมัครเอง มีที่นั่งจำกัด) เอง
 * โดยตรง — ตั้งชื่อ + จำนวนรับ + ครูรับผิดชอบ ไม่ผูกกับ subjectCode ที่ import จากตารางสอนอีกต่อไป
 *
 * ออกแบบใหม่ (เฟส 2 — ยืนยันจากผู้ใช้แล้ว): ของเดิมดึงรายชื่อ subjectCode ที่มีอยู่จริงใน schedules
 * มาให้เลือก แต่ทุกคาบ "กิจกรรมชุมนุม" ของทุกครูใช้ subjectCode/ชื่อกลางเดียวกันหมด (ไม่ใช่ชื่อชุมนุม
 * จริงของแต่ละคน) ทำให้แยกชุมนุมจริงไม่ได้เลย — เปลี่ยนเป็นฟอร์มสร้างชุมนุมใหม่ตรงๆ แทน
 */
export function ElectiveActivityManagerPage() {
  const { user } = useStore();
  const { configs, counts, loading: configsLoading } = useElectiveActivities();
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [teacherSearch, setTeacherSearch] = useState('');

  // ฟอร์มสร้าง/แก้ไข
  const [editingId, setEditingId] = useState<string | null>(null); // null = กำลังสร้างใหม่
  const [nameInput, setNameInput] = useState('');
  const [capacityInput, setCapacityInput] = useState<string>('');
  const [teacherUidInput, setTeacherUidInput] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);

  // ดึงรายชื่อครูจริงจาก staff collection ให้แอดมินเลือกเป็นครูรับผิดชอบ (ห้ามพิมพ์ชื่อเอง —
  // ผูกด้วย Firebase Auth UID จริงเสมอ ตาม CLAUDE.md)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'staff'), (snap) => {
      const list: TeacherOption[] = snap.docs.map(d => {
        const data = d.data() as any;
        const name = `${data.prefix || ''}${data.firstName || ''} ${data.lastName || ''}`.trim() || data.email || d.id;
        return { uid: d.id, name };
      });
      list.sort((a, b) => a.name.localeCompare(b.name, 'th'));
      setTeachers(list);
    }, (err) => console.warn('[ElectiveActivityManagerPage] staff listener:', err.message));
    return unsub;
  }, []);

  const filteredTeachers = useMemo(() => {
    const q = teacherSearch.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter(t => t.name.toLowerCase().includes(q));
  }, [teachers, teacherSearch]);

  const selectedTeacher = teachers.find(t => t.uid === teacherUidInput) || null;

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3500); };

  const resetForm = () => {
    setEditingId(null);
    setNameInput('');
    setCapacityInput('');
    setTeacherUidInput('');
    setTeacherSearch('');
  };

  const startEdit = (id: string) => {
    const cfg = configs.find(c => c.id === id);
    if (!cfg) return;
    setEditingId(id);
    setNameInput(cfg.name);
    setCapacityInput(String(cfg.capacity));
    setTeacherUidInput(cfg.responsibleTeacherUid);
    setTeacherSearch('');
  };

  const handleSave = async () => {
    const name = nameInput.trim();
    const capacity = parseInt(capacityInput, 10);
    if (!name) { flash('กรอกชื่อชุมนุมก่อน'); return; }
    if (!Number.isFinite(capacity) || capacity <= 0) { flash('กรอกจำนวนรับเป็นตัวเลขมากกว่า 0'); return; }
    if (!selectedTeacher) { flash('เลือกครูรับผิดชอบก่อน'); return; }

    setBusy('save');
    try {
      if (editingId) {
        await updateElectiveActivity(editingId, {
          name,
          capacity,
          responsibleTeacherUid: selectedTeacher.uid,
          responsibleTeacherName: selectedTeacher.name,
        });
        flash(`แก้ไขชุมนุม "${name}" แล้ว`);
      } else {
        await createElectiveActivity({
          name,
          capacity,
          responsibleTeacherUid: selectedTeacher.uid,
          responsibleTeacherName: selectedTeacher.name,
          createdBy: user?.uid || 'unknown',
        });
        flash(`สร้างชุมนุม "${name}" แล้ว`);
      }
      resetForm();
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
      await removeElectiveActivityConfig(removeTarget.id);
      flash('ลบชุมนุมแล้ว');
      setRemoveTarget(null);
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
            สร้างชุมนุม กำหนดจำนวนรับ และครูรับผิดชอบเอง — ไม่ผูกกับตารางสอนที่ import มา
          </p>
        </div>
      </div>

      {toast && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-xs text-emerald-300">{toast}</div>
      )}

      {/* Create / edit form */}
      <div className="bg-[#0f1219] border border-white/10 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">{editingId ? 'แก้ไขชุมนุม' : 'สร้างชุมนุมใหม่'}</h3>
          {editingId && (
            <button onClick={resetForm} className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1">
              <X className="w-3.5 h-3.5" /> ยกเลิกแก้ไข
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-xs text-slate-400 space-y-1 block">
            ชื่อชุมนุม
            <input
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              placeholder="เช่น ชุมนุมคอมพิวเตอร์"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
            />
          </label>
          <label className="text-xs text-slate-400 space-y-1 block">
            จำนวนรับ
            <input
              type="number"
              min={1}
              value={capacityInput}
              onChange={e => setCapacityInput(e.target.value)}
              placeholder="เช่น 20"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
            />
          </label>
        </div>

        <div className="space-y-1.5">
          <span className="text-xs text-slate-400">ครูรับผิดชอบ</span>
          {selectedTeacher ? (
            <div className="flex items-center justify-between bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2.5">
              <span className="text-sm text-white">{selectedTeacher.name}</span>
              <button onClick={() => setTeacherUidInput('')} className="text-slate-500 hover:text-slate-300">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={teacherSearch}
                  onChange={e => setTeacherSearch(e.target.value)}
                  placeholder="ค้นหาชื่อครู..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
                />
              </div>
              <div className="max-h-40 overflow-y-auto border border-white/5 rounded-xl divide-y divide-white/5">
                {filteredTeachers.length === 0 ? (
                  <div className="p-3 text-center text-xs text-slate-500">ไม่พบครูที่ตรงกับคำค้นหา</div>
                ) : filteredTeachers.slice(0, 30).map(t => (
                  <button
                    key={t.uid}
                    onClick={() => setTeacherUidInput(t.uid)}
                    className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-white/5"
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={busy === 'save'}
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5"
        >
          {busy === 'save' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {editingId ? 'บันทึกการแก้ไข' : 'สร้างชุมนุม'}
        </button>

        <div className="flex items-start gap-2 text-[11px] text-slate-500">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>1 ชุมนุม มีครูรับผิดชอบและโควตาที่นั่งของตัวเองอิสระ ไม่แชร์โควตากับชุมนุมอื่น</span>
        </div>
      </div>

      {/* Existing configs */}
      <div className="bg-[#0f1219] border border-white/10 rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-bold text-white">ชุมนุมทั้งหมด ({configs.length})</h3>
        {configsLoading ? (
          <div className="py-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> กำลังโหลด...
          </div>
        ) : configs.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">ยังไม่มีชุมนุมที่สร้างไว้</div>
        ) : (
          <div className="space-y-1.5">
            {configs.map(c => {
              const enrolled = counts[c.id] || 0;
              return (
                <div key={c.id} className="flex items-center gap-3 bg-slate-900/40 border border-slate-800 rounded-lg px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-slate-200">{c.name}</span>
                    <p className="text-[10px] text-slate-500">ครูรับผิดชอบ: {c.responsibleTeacherName}</p>
                  </div>
                  <span className="text-xs font-bold text-indigo-400 shrink-0">
                    {enrolled}/{c.capacity} ที่นั่ง
                  </span>
                  <button
                    onClick={() => startEdit(c.id)}
                    className="text-slate-400 hover:text-slate-200 p-1.5"
                    title="แก้ไขชุมนุม"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setRemoveTarget({ id: c.id, name: c.name })}
                    disabled={busy === c.id}
                    className="text-red-400 hover:text-red-300 p-1.5"
                    title="ลบชุมนุม"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirm remove — modal ในแอปเอง ไม่ใช่ window.confirm() (ดู CLAUDE.md/HouseManagerPage) */}
      {removeTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#151921] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-white/10 bg-red-950/30">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-red-400" /> ยืนยันลบชุมนุม
              </h2>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-300">
                ลบชุมนุม <strong className="text-white">"{removeTarget.name}"</strong>? ประวัติการสมัครเดิมจะยังเก็บไว้ ไม่ถูกลบ
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
