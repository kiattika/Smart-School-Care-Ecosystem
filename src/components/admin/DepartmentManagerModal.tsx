import React, { useState } from 'react';
import { X, Plus, Save, Loader2, Trash2, Layers } from 'lucide-react';
import { DepartmentConfig } from '../../types';
import { saveDepartmentConfig, deactivateDepartmentConfig } from '../../services/firestoreService';
import { DEFAULT_DEPARTMENTS } from '../../lib/departments';

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

  if (!isOpen) return null;
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3000); };

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
              <div key={d.id} className="flex items-center gap-2 bg-slate-900/40 border border-slate-800 rounded-lg px-3 py-2">
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
            ))}
          </div>
        </div>

        {toast && <div className="px-5 py-2 border-t border-slate-800 text-xs text-emerald-400">{toast}</div>}
      </div>
    </div>
  );
}
