import React, { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { X, Plus, Save, Loader2, Trash2, Layers, ShieldCheck, Search } from 'lucide-react';
import { DepartmentConfig } from '../../types';
import { saveDepartmentConfig, deactivateDepartmentConfig } from '../../services/firestoreService';
import { DEFAULT_DEPARTMENTS } from '../../lib/departments';
import { db } from '../../lib/firebase';

/**
 * เมนูแอดมิน: เพิ่ม/แก้ไข/ปิดใช้งาน กลุ่มสาระฯ/กลุ่มงาน (Firestore: department_config)
 * เขียนได้เฉพาะ SUPER_ADMIN (firestore.rules) — เห็นผลทุกหน้าแบบ real-time ผ่าน useDepartments()
 */

const KIND_LABEL: Record<string, string> = {
  LEARNING_AREA: 'กลุ่มสาระการเรียนรู้',
  DIRECTORATE: 'กลุ่มอำนวยการ',
  SUPPORT: 'กลุ่มงานสนับสนุน',
  ACTIVITY: 'กิจกรรมพัฒนาผู้เรียน',
};

const slug = (s: string) =>
  s.trim().toLowerCase().replace(/[^\w฀-๿]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || `dept-${Date.now()}`;

export function DepartmentManagerModal({
  isOpen, onClose, departments, isFallback,
}: {
  isOpen: boolean;
  onClose: () => void;
  departments: DepartmentConfig[];
  isFallback: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newKind, setNewKind] = useState<'LEARNING_AREA' | 'DIRECTORATE' | 'SUPPORT' | 'ACTIVITY'>('LEARNING_AREA');
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // TASK 4: ผู้รับผิดชอบสำรอง — ตั้งไว้ล่วงหน้าเผื่อหัวหน้ากลุ่มสาระฯ ลาป่วยเอง
  const [staff, setStaff] = useState<Array<{ uid: string; name: string }>>([]);
  const [backupPickerDeptId, setBackupPickerDeptId] = useState<string | null>(null);
  const [backupSearch, setBackupSearch] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const unsub = onSnapshot(collection(db, 'staff'), (snap) => {
      const list = snap.docs.map(d => {
        const data = d.data() as any;
        const name = `${data.prefix || ''}${data.firstName || ''} ${data.lastName || ''}`.trim() || data.email || d.id;
        return { uid: d.id, name };
      });
      list.sort((a, b) => a.name.localeCompare(b.name, 'th'));
      setStaff(list);
    }, (err) => console.warn('[DepartmentManagerModal] staff listener:', err.message));
    return unsub;
  }, [isOpen]);

  if (!isOpen) return null;
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3000); };

  const setBackupApprover = async (d: DepartmentConfig, person: { uid: string; name: string } | null) => {
    setBusy(`backup-${d.id}`);
    try {
      await saveDepartmentConfig({
        id: d.id, name: d.name, kind: d.kind, order: d.order, parentId: d.parentId,
        backupApproverUid: person?.uid ?? null, backupApproverName: person?.name ?? null,
      });
      flash(person ? `ตั้ง "${person.name}" เป็นผู้รับผิดชอบสำรองของ "${d.name}" แล้ว` : `ยกเลิกผู้รับผิดชอบสำรองของ "${d.name}" แล้ว`);
      setBackupPickerDeptId(null);
      setBackupSearch('');
    } catch (e) { flash('ไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e))); }
    finally { setBusy(null); }
  };

  const seedDefaults = async () => {
    setBusy('seed');
    try {
      for (const d of DEFAULT_DEPARTMENTS) await saveDepartmentConfig(d);
      flash('เพิ่มกลุ่มเริ่มต้นทั้งหมดลง Firestore แล้ว');
    } catch (e) { flash('ไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e))); }
    finally { setBusy(null); }
  };

  const addNew = async () => {
    if (!newName.trim()) { flash('กรอกชื่อกลุ่มก่อน'); return; }
    setBusy('add');
    try {
      await saveDepartmentConfig({
        id: slug(newName), name: newName.trim(), kind: newKind,
        order: (departments.reduce((m, d) => Math.max(m, d.order ?? 0), 0)) + 1,
      });
      setNewName('');
      flash('เพิ่มกลุ่มแล้ว');
    } catch (e) { flash('ไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e))); }
    finally { setBusy(null); }
  };

  const saveEdit = async (d: DepartmentConfig) => {
    if (!editName.trim()) return;
    setBusy(d.id);
    try {
      await saveDepartmentConfig({ id: d.id, name: editName.trim(), kind: d.kind, order: d.order, parentId: d.parentId });
      setEditId(null);
      flash('บันทึกแล้ว');
    } catch (e) { flash('ไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e))); }
    finally { setBusy(null); }
  };

  const deactivate = async (d: DepartmentConfig) => {
    if (!window.confirm(`ปิดใช้งานกลุ่ม "${d.name}"? (ไม่ลบข้อมูลจริง — บุคลากรที่สังกัดอยู่ยังอ้างอิงได้)`)) return;
    setBusy(d.id);
    try { await deactivateDepartmentConfig(d.id); flash('ปิดใช้งานแล้ว'); }
    catch (e) { flash('ไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e))); }
    finally { setBusy(null); }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-[#111622] border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[88vh] flex flex-col shadow-2xl">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-400" /> จัดการกลุ่มสาระฯ / กลุ่มงาน
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {isFallback && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-300 flex items-center justify-between gap-3">
              <span>ยังไม่มีข้อมูลใน Firestore — กำลังแสดงค่าเริ่มต้น กดปุ่มเพื่อบันทึกลง Firestore ให้แก้ไขได้</span>
              <button onClick={seedDefaults} disabled={busy === 'seed'} className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold shrink-0 flex items-center gap-1">
                {busy === 'seed' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} บันทึกค่าเริ่มต้น
              </button>
            </div>
          )}

          {/* Add new */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center gap-2">
            <input
              value={newName} onChange={e => setNewName(e.target.value)} placeholder="ชื่อกลุ่มใหม่"
              className="flex-1 min-w-[10rem] bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
            />
            <select value={newKind} onChange={e => setNewKind(e.target.value as any)} className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-2 text-xs text-white">
              {Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <button onClick={addNew} disabled={busy === 'add'} className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1">
              {busy === 'add' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} เพิ่ม
            </button>
          </div>

          {/* List */}
          <div className="space-y-1.5">
            {departments.map(d => (
              <div key={d.id} className="bg-slate-900/40 border border-slate-800 rounded-lg px-3 py-2 space-y-2">
                <div className="flex items-center gap-2">
                  {editId === d.id ? (
                    <>
                      <input value={editName} onChange={e => setEditName(e.target.value)} className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm text-white" />
                      <button onClick={() => saveEdit(d)} disabled={busy === d.id} className="text-emerald-400 text-xs font-bold px-2 py-1">บันทึก</button>
                      <button onClick={() => setEditId(null)} className="text-slate-500 text-xs px-2 py-1">ยกเลิก</button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm text-slate-200">{d.name}</span>
                      <span className="text-[10px] text-slate-500">{KIND_LABEL[d.kind || 'LEARNING_AREA']}</span>
                      <code className="text-[10px] text-slate-600">{d.id}</code>
                      <button onClick={() => { setEditId(d.id); setEditName(d.name); }} className="text-blue-400 text-xs px-2 py-1">แก้ไข</button>
                      <button onClick={() => deactivate(d)} disabled={busy === d.id} className="text-red-400 px-1.5 py-1"><Trash2 className="w-3.5 h-3.5" /></button>
                    </>
                  )}
                </div>

                {/* TASK 4: ผู้รับผิดชอบสำรอง — เผื่อหัวหน้ากลุ่มสาระฯ ลาป่วยเอง */}
                <div className="flex items-center gap-2 pl-1 border-l-2 border-slate-800">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-400 shrink-0 ml-1" />
                  <span className="text-[10px] text-slate-500 shrink-0">ผู้รับผิดชอบสำรอง:</span>
                  {d.backupApproverUid ? (
                    <span className="text-[11px] text-indigo-300 font-semibold">{d.backupApproverName}</span>
                  ) : (
                    <span className="text-[11px] text-amber-400/80 italic">ยังไม่ได้กำหนด (fallback: หัวหน้าฝ่ายวิชาการฯ)</span>
                  )}
                  <div className="flex-1" />
                  {d.backupApproverUid && (
                    <button onClick={() => setBackupApprover(d, null)} disabled={busy === `backup-${d.id}`} className="text-[10px] text-red-400 hover:text-red-300 px-1.5">ยกเลิก</button>
                  )}
                  <button
                    onClick={() => { setBackupPickerDeptId(backupPickerDeptId === d.id ? null : d.id); setBackupSearch(''); }}
                    className="text-[10px] text-blue-400 hover:text-blue-300 px-1.5"
                  >
                    {d.backupApproverUid ? 'เปลี่ยน' : 'กำหนด'}
                  </button>
                </div>

                {backupPickerDeptId === d.id && (
                  <div className="pl-6 space-y-1.5">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        value={backupSearch}
                        onChange={e => setBackupSearch(e.target.value)}
                        placeholder="ค้นหาชื่อครู..."
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-2 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="max-h-32 overflow-y-auto border border-white/5 rounded-lg divide-y divide-white/5">
                      {staff.filter(s => s.name.toLowerCase().includes(backupSearch.trim().toLowerCase())).slice(0, 20).map(s => (
                        <button
                          key={s.uid}
                          onClick={() => setBackupApprover(d, s)}
                          disabled={busy === `backup-${d.id}`}
                          className="w-full text-left px-2.5 py-1.5 text-[11px] text-slate-200 hover:bg-white/5"
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {toast && <div className="px-5 py-2 border-t border-slate-800 text-xs text-emerald-400">{toast}</div>}
      </div>
    </div>
  );
}
