import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { isStaffActive } from '../../lib/staffStatus';
import { staffDepartmentId, staffFullName, type StaffRow } from '../../lib/supervisionView';

/** เลือกบุคลากรหลายคนจากทะเบียน (เฉพาะที่ยังปฏิบัติงาน) — ค้นหาด้วยชื่อ, เลือกทั้งกลุ่มสาระฯ ได้ */
export function StaffMultiPicker({ staff, selectedIds, onChange, excludeId, max, deptId, deptName, deptLabelOf }: {
  staff: StaffRow[]; selectedIds: string[]; onChange: (ids: string[]) => void; excludeId?: string; max: number;
  deptId?: string; deptName?: string; deptLabelOf?: (id: string) => string;
}) {
  const [text, setText] = useState('');
  const pool = useMemo(() => staff.filter(s => isStaffActive(s) && s.id !== excludeId), [staff, excludeId]);
  const byId = useMemo(() => new Map(staff.map(s => [s.id, s] as [string, StaffRow])), [staff]);
  const hits = useMemo(() => {
    const t = text.trim();
    if (!t) return [];
    return pool.filter(s => !selectedIds.includes(s.id) && staffFullName(s).includes(t)).slice(0, 8);
  }, [pool, selectedIds, text]);
  const add = (ids: string[]) => { onChange([...selectedIds, ...ids.filter(i => !selectedIds.includes(i))].slice(0, max)); setText(''); };
  const deptMates = deptId ? pool.filter(s => staffDepartmentId(s) === deptId && !selectedIds.includes(s.id)) : [];
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {selectedIds.map(id => (
          <span key={id} className="inline-flex items-center gap-1 rounded-full bg-cyan-600/20 border border-cyan-500/40 text-cyan-100 text-xs pl-2.5 pr-1 py-0.5">
            {byId.get(id) ? staffFullName(byId.get(id)) : id}
            <button type="button" aria-label="เอาออก" className="p-0.5 cursor-pointer" onClick={() => onChange(selectedIds.filter(x => x !== id))}><X className="w-3 h-3" /></button>
          </span>
        ))}
      </div>
      {selectedIds.length < max && (
        <div className="relative">
          <input className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-sm text-white" placeholder="พิมพ์ชื่อเพื่อค้นหาบุคลากร…" value={text} onChange={e => setText(e.target.value)} aria-label="ค้นหาสมาชิก" />
          {hits.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 shadow-lg max-h-56 overflow-auto">
              {hits.map(s => (
                <li key={s.id}>
                  <button type="button" className="w-full text-left px-3 py-1.5 text-sm text-slate-100 hover:bg-slate-800 cursor-pointer" onClick={() => add([s.id])}>
                    {staffFullName(s)}{deptLabelOf && staffDepartmentId(s) ? <span className="text-xs text-slate-400"> · {deptLabelOf(staffDepartmentId(s))}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {text.trim() !== '' && hits.length === 0 && <p className="text-[11px] text-slate-500 mt-1">ไม่พบบุคลากรที่ตรงกับคำค้น</p>}
        </div>
      )}
      <div className="flex items-center gap-3 text-[11px] text-slate-500">
        <span>{selectedIds.length}/{max} คน (ไม่ต้องเลือกตนเอง)</span>
        {deptMates.length > 0 && <button type="button" className="text-cyan-300 underline cursor-pointer" onClick={() => add(deptMates.map(s => s.id))}>เลือกทั้งกลุ่มสาระฯ{deptName ? ` ${deptName}` : ''} ({deptMates.length})</button>}
      </div>
    </div>
  );
}
