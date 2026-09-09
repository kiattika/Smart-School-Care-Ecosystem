import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Users, Save, Trash2, Loader2, Search, Info, Pencil, X, Lock, Unlock, CalendarClock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useElectiveActivities } from '../../hooks/useElectiveActivities';
import { createElectiveActivity, updateElectiveActivity, removeElectiveActivityConfig } from '../../services/firestoreService';
import { useStore } from '../../store';
import {
  detectClubSlotsForTeacher,
  mergeClubSlotCandidates,
  ScheduleDocLite,
  ClubScheduleCandidate,
} from '../../lib/electiveClubDetection';

interface TeacherOption {
  uid: string;
  name: string;
}

const DAY_OPTIONS: { value: string; label: string }[] = [
  { value: 'monday', label: 'จันทร์' },
  { value: 'tuesday', label: 'อังคาร' },
  { value: 'wednesday', label: 'พุธ' },
  { value: 'thursday', label: 'พฤหัสบดี' },
  { value: 'friday', label: 'ศุกร์' },
];

/**
 * แอดมินงานชุมนุม: สร้างชุมนุม/กิจกรรมตามความสนใจ (ELECTIVE — นักเรียนสมัครเอง มีที่นั่งจำกัด) เอง
 * โดยตรง — ตั้งชื่อ + จำนวนรับ + ครูรับผิดชอบ (ร่วมกันได้หลายคน) ไม่ผูกกับ subjectCode ที่ import จาก
 * ตารางสอนอีกต่อไป
 *
 * ออกแบบใหม่ (เฟส 2 — ยืนยันจากผู้ใช้แล้ว): ของเดิมดึงรายชื่อ subjectCode ที่มีอยู่จริงใน schedules
 * มาให้เลือก แต่ทุกคาบ "กิจกรรมชุมนุม" ของทุกครูใช้ subjectCode/ชื่อกลางเดียวกันหมด (ไม่ใช่ชื่อชุมนุม
 * จริงของแต่ละคน) ทำให้แยกชุมนุมจริงไม่ได้เลย — เปลี่ยนเป็นฟอร์มสร้างชุมนุมใหม่ตรงๆ แทน
 *
 * ต่อยอด: รองรับครูร่วมสอนหลายคนต่อชุมนุม (ยืนยันจากไฟล์ภาระงานสอนจริงว่าเป็นรูปแบบปกติ) + enrollmentStatus
 * ควบคุมว่ายังเปิดรับสมัครอยู่ไหม — ปิดรับสมัครแล้วรายชื่อที่ enroll ไว้จะไปโผล่ในตารางสอนประจำวันของ
 * ครูผู้รับผิดชอบทุกคนให้เช็คชื่อได้ (ดู TeacherPortal.tsx)
 *
 * แก้ไข (ยืนยันจากโรงเรียนอีกครั้ง): วัน/คาบชุมนุม "ไม่ใช่" สิ่งที่แอดมินกำหนดเอง — ครูทุกคนที่สอน
 * ม.4-6 มีคาบ "กิจกรรมชุมนุม" วันพฤหัสฯ คาบ 7-8 เหมือนกันหมดตามตารางสอนจริงที่ import มา (ยกเว้นครู
 * นศท ที่มีคาบยาวกว่า 7-9) จึงดึงวัน/คาบจากตารางสอนจริงของครูรับผิดชอบที่เลือกไว้เสมอ (ดู
 * src/lib/electiveClubDetection.ts) ไม่มีช่องให้พิมพ์วัน/คาบเองอีกต่อไป
 */
export function ElectiveActivityManagerPage() {
  const { user } = useStore();
  const { configs, counts, loading: configsLoading } = useElectiveActivities();
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [teacherSearch, setTeacherSearch] = useState('');
  const [schedules, setSchedules] = useState<ScheduleDocLite[]>([]);

  // ฟอร์มสร้าง/แก้ไข
  const [editingId, setEditingId] = useState<string | null>(null); // null = กำลังสร้างใหม่
  const [nameInput, setNameInput] = useState('');
  const [capacityInput, setCapacityInput] = useState<string>('');
  const [teacherUidsInput, setTeacherUidsInput] = useState<string[]>([]);
  // วัน/คาบชุมนุม — ตั้งได้ทางเดียวเท่านั้นคือเลือกจาก candidate ที่ตรวจจับจากตารางสอนจริง
  // (ดู clubSlotCandidates ด้านล่าง) ไม่มีช่องพิมพ์เองอีกต่อไป
  const [dayInput, setDayInput] = useState<string>('');
  const [periodInput, setPeriodInput] = useState<string>('');
  const [periodEndInput, setPeriodEndInput] = useState<string>('');
  const [roomInput, setRoomInput] = useState<string>('');
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

  // ตารางสอนจริงที่ import มา — ใช้ตรวจจับคาบชุมนุมของครูรับผิดชอบที่เลือกไว้ (ดึงวัน/คาบอัตโนมัติ
  // แทนให้แอดมินพิมพ์เอง — ยืนยันจากโรงเรียนแล้วว่าทุกคนมีคาบชุมนุมตามตารางสอนจริงอยู่แล้ว)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'schedules'), (snap) => {
      setSchedules(snap.docs.map(d => d.data() as ScheduleDocLite));
    }, (err) => console.warn('[ElectiveActivityManagerPage] schedules listener:', err.message));
    return unsub;
  }, []);

  // ครูที่รับผิดชอบชุมนุมอื่นอยู่แล้ว (ไม่นับชุมนุมที่กำลังแก้ไขอยู่ตอนนี้) — ตัดออกจากรายชื่อที่
  // เลือกเพิ่มได้ เพราะ 1 คาบเวลาสอนจริง 1 คนสอนได้แค่ที่เดียว เลือกซ้ำจะกลายเป็นสอน 2 ชุมนุมพร้อมกัน
  // ในคาบเดียวกันซึ่งเป็นไปไม่ได้จริง — ตัดสินใจกรองแบบ "มีชุมนุมอื่นอยู่แล้วก็ตัดออกทันที ไม่ว่าจะ
  // คนละคาบเวลาจริงหรือไม่" (ไม่เช็คว่าคาบชนกันจริงไหมแบบเจาะจง) เพราะครูตามธรรมชาติของงานไม่ควร
  // รับผิดชอบชุมนุม 2 ตัวพร้อมกันอยู่แล้ว ง่ายกว่าและปลอดภัยกว่าการเช็ค overlap ของช่วงคาบ
  const teacherUidsWithOtherClub = useMemo(() => {
    const set = new Set<string>();
    configs.forEach(c => {
      if (c.id === editingId) return; // ชุมนุมที่กำลังแก้ไขอยู่ — ไม่นับครูของชุมนุมนี้เป็น "ชุมนุมอื่น"
      (c.responsibleTeacherUids || []).forEach(uid => set.add(uid));
    });
    return set;
  }, [configs, editingId]);

  const filteredTeachers = useMemo(() => {
    const q = teacherSearch.trim().toLowerCase();
    const base = teachers.filter(t => !teacherUidsInput.includes(t.uid) && !teacherUidsWithOtherClub.has(t.uid));
    if (!q) return base;
    return base.filter(t => t.name.toLowerCase().includes(q));
  }, [teachers, teacherSearch, teacherUidsInput, teacherUidsWithOtherClub]);

  const selectedTeachers = useMemo(
    () => teacherUidsInput.map(uid => teachers.find(t => t.uid === uid)).filter((t): t is TeacherOption => !!t),
    [teacherUidsInput, teachers]
  );

  // ตรวจจับคาบชุมนุมของครูรับผิดชอบที่เลือกไว้จากตารางสอนจริง (ยืนยันจากโรงเรียน — ไม่ใช่ให้แอดมิน
  // พิมพ์เอง) — ครูแต่ละคนอาจมีมากกว่า 1 ช่วงคาบที่ subjectName มีคำว่า "ชุมนุม" (ไม่ควรเกิดปกติ แต่
  // เผื่อไว้) รวมทุกคนเป็น candidate ที่ไม่ซ้ำกัน ให้แอดมินเลือกถ้ามีมากกว่า 1 แบบ
  const clubSlotCandidates: ClubScheduleCandidate[] = useMemo(() => {
    const perTeacher = teacherUidsInput.map(uid => ({ uid, slots: detectClubSlotsForTeacher(schedules, uid) }));
    return mergeClubSlotCandidates(perTeacher);
  }, [schedules, teacherUidsInput]);

  // ครูรับผิดชอบที่เลือกไว้ แต่ไม่มีคาบชุมนุมในตารางสอนที่ import มาเลย — เตือนแอดมินตรงๆ แทนที่จะ
  // ปล่อยว่าง/error เงียบๆ (อาจเป็นเพราะยังไม่ได้ import ตารางสอนของครูคนนั้น)
  const teachersWithoutClubSlot = useMemo(
    () => selectedTeachers.filter(t => !clubSlotCandidates.some(c => c.teacherUids.includes(t.uid))),
    [selectedTeachers, clubSlotCandidates]
  );

  const isSlotChosen = dayInput !== '' && periodInput !== '';

  // เลือก candidate มาใช้เป็นวัน/คาบของชุมนุม (เรียกเองจากปุ่ม "ใช้ช่วงเวลานี้" หรือ auto-apply
  // ตอนสร้างใหม่เมื่อมี candidate ที่ไม่กำกวมแค่แบบเดียว)
  const applySlot = (slot: ClubScheduleCandidate) => {
    setDayInput(slot.dayOfWeek);
    setPeriodInput(String(slot.periodStart));
    setPeriodEndInput(slot.periodEnd !== slot.periodStart ? String(slot.periodEnd) : '');
    setRoomInput(prev => prev || slot.room);
  };

  const clearSlot = () => {
    setDayInput('');
    setPeriodInput('');
    setPeriodEndInput('');
  };

  // สร้างชุมนุมใหม่ (ไม่ใช่แก้ไขของเดิม) + ยังไม่เลือกวัน/คาบเอง + เจอ candidate ไม่กำกวมแค่แบบเดียว
  // → auto-apply ให้เลย (ไม่ต้องกดเลือกเองถ้าไม่จำเป็น) — ไม่ auto-apply ทับค่าที่แอดมินเลือกไว้แล้ว
  useEffect(() => {
    if (editingId) return;
    if (isSlotChosen) return;
    if (clubSlotCandidates.length === 1) applySlot(clubSlotCandidates[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubSlotCandidates, editingId]);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3500); };

  const resetForm = () => {
    setEditingId(null);
    setNameInput('');
    setCapacityInput('');
    setTeacherUidsInput([]);
    setDayInput('');
    setPeriodInput('');
    setPeriodEndInput('');
    setRoomInput('');
    setTeacherSearch('');
  };

  const startEdit = (id: string) => {
    const cfg = configs.find(c => c.id === id);
    if (!cfg) return;
    setEditingId(id);
    setNameInput(cfg.name);
    setCapacityInput(String(cfg.capacity));
    setTeacherUidsInput(cfg.responsibleTeacherUids || []);
    setDayInput(cfg.dayOfWeek || '');
    setPeriodInput(cfg.periodNumber !== null && cfg.periodNumber !== undefined ? String(cfg.periodNumber) : '');
    setPeriodEndInput(cfg.periodNumberEnd !== null && cfg.periodNumberEnd !== undefined ? String(cfg.periodNumberEnd) : '');
    setRoomInput(cfg.room || '');
    setTeacherSearch('');
  };

  const handleSave = async () => {
    const name = nameInput.trim();
    const capacity = parseInt(capacityInput, 10);
    if (!name) { flash('กรอกชื่อชุมนุมก่อน'); return; }
    if (!Number.isFinite(capacity) || capacity <= 0) { flash('กรอกจำนวนรับเป็นตัวเลขมากกว่า 0'); return; }
    if (selectedTeachers.length === 0) { flash('เลือกครูรับผิดชอบอย่างน้อย 1 คน'); return; }
    const periodNumber = periodInput.trim() === '' ? null : parseInt(periodInput, 10);
    const periodNumberEnd = periodEndInput.trim() === '' ? null : parseInt(periodEndInput, 10);

    setBusy('save');
    try {
      if (editingId) {
        await updateElectiveActivity(editingId, {
          name,
          capacity,
          responsibleTeacherUids: selectedTeachers.map(t => t.uid),
          responsibleTeacherNames: selectedTeachers.map(t => t.name),
          dayOfWeek: dayInput || null,
          periodNumber,
          periodNumberEnd,
          room: roomInput.trim() || null,
        });
        flash(`แก้ไขชุมนุม "${name}" แล้ว`);
      } else {
        await createElectiveActivity({
          name,
          capacity,
          responsibleTeacherUids: selectedTeachers.map(t => t.uid),
          responsibleTeacherNames: selectedTeachers.map(t => t.name),
          dayOfWeek: dayInput || null,
          periodNumber,
          periodNumberEnd,
          room: roomInput.trim() || null,
          enrollmentStatus: 'OPEN',
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

  const handleToggleEnrollment = async (id: string, current: 'OPEN' | 'CLOSED') => {
    setBusy(`toggle-${id}`);
    try {
      const next = current === 'OPEN' ? 'CLOSED' : 'OPEN';
      await updateElectiveActivity(id, { enrollmentStatus: next });
      flash(next === 'CLOSED' ? 'ปิดรับสมัครแล้ว — รายชื่อจะไปปรากฏในตารางสอนของครูผู้รับผิดชอบ' : 'เปิดรับสมัครอีกครั้งแล้ว');
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
            สร้างชุมนุม กำหนดจำนวนรับ และครูรับผิดชอบ (ร่วมกันได้หลายคน) — วัน/คาบเรียนดึงจากตารางสอนจริงของครูรับผิดชอบให้อัตโนมัติ
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
          <span className="text-xs text-slate-400">ครูรับผิดชอบ (เลือกได้หลายคน — ครูร่วมสอน)</span>
          <p className="text-[10px] text-slate-500 -mt-1">ไม่แสดงครูที่รับผิดชอบชุมนุมอื่นอยู่แล้ว (1 คนรับผิดชอบได้ทีละ 1 ชุมนุมเท่านั้น)</p>
          {selectedTeachers.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {selectedTeachers.map(t => (
                <span key={t.uid} className="flex items-center gap-1.5 bg-slate-900/60 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white">
                  {t.name}
                  <button onClick={() => setTeacherUidsInput(prev => prev.filter(u => u !== t.uid))} className="text-slate-500 hover:text-slate-300">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={teacherSearch}
              onChange={e => setTeacherSearch(e.target.value)}
              placeholder="ค้นหาชื่อครูเพื่อเพิ่ม..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
            />
          </div>
          <div className="max-h-40 overflow-y-auto border border-white/5 rounded-xl divide-y divide-white/5">
            {filteredTeachers.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-500">ไม่พบครูที่ตรงกับคำค้นหา (หรือเพิ่มครบทุกคนแล้ว)</div>
            ) : filteredTeachers.slice(0, 30).map(t => (
              <button
                key={t.uid}
                onClick={() => { setTeacherUidsInput(prev => [...prev, t.uid]); setTeacherSearch(''); }}
                className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-white/5"
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>

        {/* วัน/คาบ — ดึงจากตารางสอนจริงของครูรับผิดชอบเสมอ (ยืนยันจากโรงเรียน) ไม่มีช่องให้พิมพ์เอง */}
        <div className="space-y-2">
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <CalendarClock className="w-3.5 h-3.5" /> วัน/คาบชุมนุม (ดึงจากตารางสอนจริงของครูรับผิดชอบ)
          </span>

          {selectedTeachers.length === 0 ? (
            <div className="flex items-start gap-2 text-[11px] text-slate-500 bg-slate-900/40 border border-slate-800 rounded-xl p-3">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>เลือกครูรับผิดชอบก่อน ระบบจะค้นหาคาบ "กิจกรรมชุมนุม" ในตารางสอนที่ import มาให้อัตโนมัติ</span>
            </div>
          ) : isSlotChosen ? (
            <div className="flex items-center justify-between gap-3 bg-emerald-950/30 border border-emerald-700/40 rounded-xl p-3">
              <div className="flex items-center gap-2 text-xs text-emerald-300">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  วัน{DAY_OPTIONS.find(d => d.value === dayInput)?.label || dayInput} คาบ {periodInput}
                  {periodEndInput && periodEndInput !== periodInput ? `-${periodEndInput}` : ''}
                  {roomInput && ` · ห้อง ${roomInput}`}
                </span>
              </div>
              <button onClick={clearSlot} className="text-[11px] text-slate-400 hover:text-slate-200 shrink-0 flex items-center gap-1">
                <X className="w-3.5 h-3.5" /> เปลี่ยน/ล้างค่า
              </button>
            </div>
          ) : clubSlotCandidates.length > 0 ? (
            <div className="space-y-1.5">
              {clubSlotCandidates.map(c => {
                const names = c.teacherUids.map(uid => teachers.find(t => t.uid === uid)?.name || uid).join(', ');
                return (
                  <button
                    key={`${c.dayOfWeek}_${c.periodStart}_${c.periodEnd}_${c.room}`}
                    onClick={() => applySlot(c)}
                    className="w-full flex items-center justify-between gap-3 bg-slate-900/60 hover:bg-slate-900 border border-slate-800 rounded-xl p-3 text-left transition"
                  >
                    <div className="text-xs text-white">
                      วัน{DAY_OPTIONS.find(d => d.value === c.dayOfWeek)?.label || c.dayOfWeek} คาบ {c.periodStart}
                      {c.periodEnd !== c.periodStart ? `-${c.periodEnd}` : ''}
                      {c.room && ` · ห้อง ${c.room}`}
                      <p className="text-[10px] text-slate-500 mt-0.5">พบในตารางสอนของ: {names}</p>
                    </div>
                    <span className="text-[11px] font-bold text-indigo-400 shrink-0">ใช้ช่วงเวลานี้</span>
                  </button>
                );
              })}
              {clubSlotCandidates.length > 1 && (
                <div className="flex items-start gap-2 text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>ครูรับผิดชอบที่เลือกไว้มีคาบชุมนุมคนละเวลากัน — เลือกช่วงเวลาที่จะใช้จริงสำหรับชุมนุมนี้ด้านบน</span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-start gap-2 text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>ไม่พบคาบ "กิจกรรมชุมนุม" ในตารางสอนของครูที่เลือกเลย — ตรวจสอบว่า import ตารางสอนของครูคนนี้แล้วหรือยัง (ชุมนุมนี้จะยังไม่มีวัน/คาบจนกว่าจะพบข้อมูล และจะไม่โผล่ในตารางสอนของครูตอนปิดรับสมัคร)</span>
            </div>
          )}

          {teachersWithoutClubSlot.length > 0 && clubSlotCandidates.length > 0 && (
            <div className="flex items-start gap-2 text-[11px] text-amber-300/90">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>ไม่พบคาบชุมนุมของ: {teachersWithoutClubSlot.map(t => t.name).join(', ')} (ตรวจสอบว่า import ตารางสอนครบหรือยัง)</span>
            </div>
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
          <span>1 ชุมนุม มีโควตาที่นั่งของตัวเองอิสระ ไม่แชร์โควตากับชุมนุมอื่น — ครูร่วมสอนทุกคนเห็น/เช็คชื่อชุมนุมนี้ได้เหมือนกันทุกคน</span>
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
              const dayLabel = DAY_OPTIONS.find(d => d.value === c.dayOfWeek)?.label;
              const isClosed = c.enrollmentStatus === 'CLOSED';
              return (
                <div key={c.id} className="flex items-center gap-3 bg-slate-900/40 border border-slate-800 rounded-lg px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-slate-200">{c.name}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isClosed ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                        {isClosed ? 'ปิดรับสมัครแล้ว' : 'เปิดรับสมัคร'}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500">
                      ครูรับผิดชอบ: {(c.responsibleTeacherNames || []).join(', ') || '— ไม่ได้ระบุ —'}
                      {dayLabel && ` · วัน${dayLabel}`}
                      {c.periodNumber !== null && c.periodNumber !== undefined && ` คาบ ${c.periodNumber}${c.periodNumberEnd && c.periodNumberEnd !== c.periodNumber ? `-${c.periodNumberEnd}` : ''}`}
                      {c.room && ` · ห้อง ${c.room}`}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-indigo-400 shrink-0">
                    {enrolled}/{c.capacity} ที่นั่ง
                  </span>
                  <button
                    onClick={() => handleToggleEnrollment(c.id, c.enrollmentStatus)}
                    disabled={busy === `toggle-${c.id}`}
                    title={isClosed ? 'เปิดรับสมัครอีกครั้ง' : 'ปิดรับสมัคร (รายชื่อจะเข้าตารางสอนครู)'}
                    className={`p-1.5 rounded-lg ${isClosed ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-amber-400 hover:bg-amber-500/10'}`}
                  >
                    {busy === `toggle-${c.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isClosed ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                  </button>
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
