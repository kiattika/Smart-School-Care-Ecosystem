import React, { useMemo, useState } from 'react';
import { Palette, Plus, Trash2, Loader2, Users } from 'lucide-react';
import { useHouseConfig } from '../../hooks/useHouseConfig';
import { useRealStudents } from '../../hooks/useRealStudents';
import { saveHouseConfig, deleteHouseConfig, bulkAssignHouseToRoom, assignHouseToStudent } from '../../services/firestoreService';

const DEFAULT_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899'];

/**
 * แอดมิน: CRUD คณะสี + bulk assign นักเรียนเข้าคณะ — รากฐานสำหรับระบบคะแนนถ้วย (วิชาการ/กีฬา/
 * คุณธรรม) ในอนาคต ยังไม่มีการคำนวณ/แสดงคะแนนถ้วยใดๆ ในรอบนี้ (ข้อมูลต้นทางบางส่วนยังไม่มีที่เก็บ)
 */
export function HouseManagerPage() {
  const { houses, loading: housesLoading } = useHouseConfig();
  const { students, loading: studentsLoading } = useRealStudents();

  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(DEFAULT_COLORS[0]);
  const [newMode, setNewMode] = useState<'SINGLE_PER_ROOM' | 'MIXED'>('SINGLE_PER_ROOM');
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [selectedRoom, setSelectedRoom] = useState('');
  const [roomHouseId, setRoomHouseId] = useState('');

  const [studentSearch, setStudentSearch] = useState('');
  const [studentHouseChoice, setStudentHouseChoice] = useState<Record<string, string>>({});

  const rooms = useMemo(() => {
    const roomSet = new Set<string>();
    students.forEach(s => { if (s.room) roomSet.add(s.room); });
    return Array.from(roomSet).sort((a, b) => a.localeCompare(b, 'th'));
  }, [students]);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3500); };

  const handleCreateHouse = async () => {
    if (!newName.trim()) { flash('กรอกชื่อคณะสีก่อน'); return; }
    setBusy('create');
    try {
      await saveHouseConfig({ name: newName.trim(), colorHex: newColor, assignmentMode: newMode });
      flash(`เพิ่มคณะสี "${newName.trim()}" แล้ว`);
      setNewName('');
    } catch (e) {
      flash('ไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  };

  const handleDeleteHouse = async (id: string, name: string) => {
    if (!window.confirm(`ลบคณะสี "${name}"? (นักเรียนที่ผูกคณะนี้ไว้แล้วจะยังมี houseId ค้างอยู่ ต้องย้ายคณะใหม่เอง)`)) return;
    setBusy(id);
    try { await deleteHouseConfig(id); flash('ลบแล้ว'); }
    catch (e) { flash('ไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e))); }
    finally { setBusy(null); }
  };

  const handleBulkAssignRoom = async () => {
    if (!selectedRoom || !roomHouseId) { flash('เลือกห้องและคณะสีก่อน'); return; }
    const roomStudentIds = students.filter(s => s.room === selectedRoom).map(s => s.studentId);
    if (roomStudentIds.length === 0) { flash('ไม่พบนักเรียนในห้องนี้'); return; }
    if (!window.confirm(`Assign นักเรียนทั้งหมด ${roomStudentIds.length} คนในห้อง ${selectedRoom} เข้าคณะเดียวกัน?`)) return;
    setBusy('bulk');
    try {
      await bulkAssignHouseToRoom(selectedRoom, roomHouseId, roomStudentIds);
      flash(`Assign นักเรียน ${roomStudentIds.length} คนเข้าคณะสีแล้ว`);
    } catch (e) {
      flash('ไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  };

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return [];
    return students.filter(s =>
      s.name.toLowerCase().includes(q) || s.studentId.includes(q)
    ).slice(0, 20);
  }, [students, studentSearch]);

  const handleAssignIndividual = async (studentId: string) => {
    const houseId = studentHouseChoice[studentId];
    if (!houseId) { flash('เลือกคณะสีก่อน'); return; }
    setBusy(studentId);
    try {
      await assignHouseToStudent(studentId, houseId);
      flash('Assign คณะสีสำเร็จ');
    } catch (e) {
      flash('ไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="border-b border-white/5 pb-4">
        <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <Palette className="w-6 h-6 text-pink-400" /> จัดการคณะสี (House)
        </h2>
        <p className="text-slate-400 mt-1 text-sm">
          รากฐานสำหรับระบบให้รางวัล 3 ถ้วย (วิชาการ/กีฬา/คุณธรรม) ในอนาคต — ยังไม่มีการคำนวณคะแนนถ้วยในรอบนี้
        </p>
      </div>

      {toast && <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-xs text-emerald-300">{toast}</div>}

      {/* Create house */}
      <div className="bg-[#0f1219] border border-white/10 rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-bold text-white">เพิ่มคณะสีใหม่</h3>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={newName} onChange={e => setNewName(e.target.value)} placeholder="เช่น คณะสีแดง"
            className="flex-1 min-w-[10rem] bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
          />
          <div className="flex items-center gap-1.5">
            {DEFAULT_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                className={`w-7 h-7 rounded-full border-2 transition-all ${newColor === c ? 'border-white scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
          <select
            value={newMode}
            onChange={e => setNewMode(e.target.value as any)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-2 text-xs text-white"
          >
            <option value="SINGLE_PER_ROOM">ยกห้องเข้าคณะเดียว</option>
            <option value="MIXED">คละคณะรายบุคคล</option>
          </select>
          <button
            onClick={handleCreateHouse}
            disabled={busy === 'create'}
            className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1"
          >
            {busy === 'create' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} เพิ่ม
          </button>
        </div>

        {housesLoading ? (
          <div className="py-6 text-center text-xs text-slate-500">กำลังโหลด...</div>
        ) : (
          <div className="space-y-1.5">
            {houses.map(h => (
              <div key={h.id} className="flex items-center gap-3 bg-slate-900/40 border border-slate-800 rounded-lg px-3 py-2">
                <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: h.colorHex }} />
                <span className="flex-1 text-sm text-slate-200">{h.name}</span>
                <span className="text-[10px] text-slate-500">{h.assignmentMode === 'SINGLE_PER_ROOM' ? 'ยกห้อง' : 'คละราย'}</span>
                <button onClick={() => handleDeleteHouse(h.id, h.name)} disabled={busy === h.id} className="text-red-400 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
            {houses.length === 0 && <div className="py-4 text-center text-xs text-slate-500">ยังไม่มีคณะสี</div>}
          </div>
        )}
      </div>

      {/* Bulk assign by room */}
      <div className="bg-[#0f1219] border border-white/10 rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2"><Users className="w-4 h-4 text-indigo-400" /> Assign ทั้งห้องเข้าคณะเดียว (SINGLE_PER_ROOM)</h3>
        <div className="flex flex-wrap items-center gap-2">
          <select value={selectedRoom} onChange={e => setSelectedRoom(e.target.value)} className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white">
            <option value="">-- เลือกห้อง --</option>
            {rooms.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={roomHouseId} onChange={e => setRoomHouseId(e.target.value)} className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white">
            <option value="">-- เลือกคณะสี --</option>
            {houses.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          <button
            onClick={handleBulkAssignRoom}
            disabled={busy === 'bulk' || studentsLoading}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5"
          >
            {busy === 'bulk' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Assign ทั้งห้อง
            {selectedRoom && ` (${students.filter(s => s.room === selectedRoom).length} คน)`}
          </button>
        </div>
      </div>

      {/* Individual assign */}
      <div className="bg-[#0f1219] border border-white/10 rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-bold text-white">Assign รายบุคคล (MIXED)</h3>
        <input
          value={studentSearch} onChange={e => setStudentSearch(e.target.value)}
          placeholder="ค้นหาชื่อหรือรหัสนักเรียน..."
          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
        />
        <div className="space-y-1.5">
          {filteredStudents.map(s => (
            <div key={s.studentId} className="flex items-center gap-2 bg-slate-900/40 border border-slate-800 rounded-lg px-3 py-2">
              <span className="flex-1 text-sm text-slate-200">{s.name} <code className="text-slate-600 text-[10px]">{s.studentId}</code></span>
              <select
                value={studentHouseChoice[s.studentId] || s.houseId || ''}
                onChange={e => setStudentHouseChoice(prev => ({ ...prev, [s.studentId]: e.target.value }))}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
              >
                <option value="">-- เลือกคณะสี --</option>
                {houses.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
              <button
                onClick={() => handleAssignIndividual(s.studentId)}
                disabled={busy === s.studentId}
                className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold"
              >
                Assign
              </button>
            </div>
          ))}
          {studentSearch.trim() && filteredStudents.length === 0 && (
            <div className="py-4 text-center text-xs text-slate-500">ไม่พบนักเรียน</div>
          )}
        </div>
      </div>
    </div>
  );
}
