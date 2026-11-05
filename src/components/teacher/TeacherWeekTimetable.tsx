import React, { useEffect, useMemo, useRef, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { CalendarCog, ChevronDown, DoorOpen, Eye, EyeOff, School, ArrowLeftRight, Loader2, Search } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useAllSchedules } from '../../hooks/useAllSchedules';
import { useAdminPeriods } from '../../hooks/useAdminPeriods';
import { useCurrentSemester } from '../../hooks/useCurrentSemester';
import { isStaffActive } from '../../lib/staffStatus';
import {
  buildTeacherWeekGrid, compareStaffId, matchesStaffQuery, staffDisplayName, type WeekCell,
} from '../../lib/teacherWeekTimetable';

interface StaffRow { id: string; name: string; email: string; active: boolean }

interface Props {
  /** staff doc id ของผู้ใช้ที่ login — เป็นค่าเริ่มต้นของตัวเลือกครู (ไม่มี = ต้องเลือกเอง) */
  ownStaffId: string | null;
}

function CellCard({ c }: { c: WeekCell }) {
  const title = [c.code, c.name, c.classLabel, c.room && `ห้อง ${c.room}`].filter(Boolean).join(' · ');
  return (
    <div
      title={title}
      className="rounded-md bg-white shadow-sm border border-slate-200 text-left px-1.5 py-1 text-[11px] leading-tight min-w-0"
      style={{ borderLeft: `4px solid ${c.color}` }}
    >
      <div className="font-bold text-[12px] break-all" style={{ color: c.color }}>{c.code || '—'}</div>
      {c.classLabel && (
        <div className="flex items-start gap-1 text-slate-600 min-w-0">
          <School className="w-3 h-3 shrink-0 mt-px" /><span className="break-words min-w-0">{c.classLabel}</span>
        </div>
      )}
      {c.room && (
        <div className="flex items-start gap-1 text-slate-600 min-w-0">
          <DoorOpen className="w-3 h-3 shrink-0 mt-px" /><span className="break-words min-w-0">{c.room}</span>
        </div>
      )}
    </div>
  );
}

/** ช่องเลือกครู: เรียงตามรหัสครู และพิมพ์ค้นหาจากรหัสหรือชื่อได้ */
function TeacherCombobox({ options, value, onChange }: {
  options: StaffRow[]; value: string; onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find(o => o.id === value) || null;
  const filtered = useMemo(() => options.filter(o => matchesStaffQuery(o, query)), [options, query]);

  useEffect(() => { setActive(0); }, [query, open]);
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.children[active] as HTMLElement | undefined;
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [active, open]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) { setOpen(false); setQuery(''); } };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const pick = (id: string) => { onChange(id); setOpen(false); setQuery(''); };
  const label = (o: StaffRow) => `${o.id} · ${o.name}${o.active ? '' : ' (ปิดการใช้งาน)'}`;

  return (
    <div ref={boxRef} className="relative w-full sm:w-[360px] max-w-full">
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          id="teacher-week-select"
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls="teacher-week-listbox"
          aria-label="เลือกครู (พิมพ์ค้นหาจากรหัสหรือชื่อ)"
          autoComplete="off"
          placeholder="พิมพ์ค้นหารหัสหรือชื่อครู…"
          value={open ? query : (selected ? label(selected) : '')}
          onFocus={() => { setOpen(true); setQuery(''); }}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive(a => Math.min(a + 1, Math.max(filtered.length - 1, 0))); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
            else if (e.key === 'Enter') { if (open && filtered[active]) { e.preventDefault(); pick(filtered[active].id); } }
            else if (e.key === 'Escape') { setOpen(false); setQuery(''); (e.target as HTMLInputElement).blur(); }
          }}
          className="w-full border border-slate-700 rounded-lg pl-9 pr-9 py-2 text-sm bg-slate-800 text-slate-200 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 outline-none"
        />
        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
      {open && (
        <ul
          id="teacher-week-listbox"
          ref={listRef}
          role="listbox"
          className="absolute z-30 mt-1 w-full max-h-72 overflow-auto rounded-lg border border-slate-700 bg-slate-900 shadow-xl py-1 text-sm"
        >
          {filtered.length === 0 && <li className="px-3 py-2 text-slate-400">ไม่พบครูที่ตรงกับ “{query.trim()}”</li>}
          {filtered.map((o, i) => (
            <li
              key={o.id}
              role="option"
              aria-selected={o.id === value}
              onMouseDown={(e) => { e.preventDefault(); pick(o.id); }}
              onMouseEnter={() => setActive(i)}
              className={`px-3 py-1.5 cursor-pointer text-slate-200 ${i === active ? 'bg-emerald-600/30' : ''} ${o.id === value ? 'font-bold' : ''}`}
            >
              <span className="font-mono text-emerald-300 mr-2">{o.id}</span>{o.name}{!o.active && <span className="text-slate-400"> (ปิดการใช้งาน)</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TeacherWeekTimetable({ ownStaffId }: Props) {
  const sem = useCurrentSemester();
  const { data: schedules, loading: schedulesLoading, error: schedulesError } = useAllSchedules();
  const { periods: adminPeriods } = useAdminPeriods();
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>(ownStaffId || '');
  const [hideEmpty, setHideEmpty] = useState(false);
  const [transposed, setTransposed] = useState(false);

  useEffect(() => onSnapshot(
    collection(db, 'staff'),
    (snap) => {
      setStaff(snap.docs.map(d => {
        const data = d.data() as Record<string, any>;
        return { id: d.id, name: staffDisplayName({ ...data, id: d.id }), email: String(data.email || ''), active: isStaffActive(data as any) };
      }));
      setStaffError(null);
    },
    (e) => setStaffError(e.message),
  ), []);

  // ล็อกอินเสร็จทีหลัง (staffId มาช้า) และยังไม่ได้เลือกเอง → ใช้ของตัวเอง
  useEffect(() => { if (!selectedId && ownStaffId) setSelectedId(ownStaffId); }, [ownStaffId]); // eslint-disable-line react-hooks/exhaustive-deps

  const withSchedules = useMemo(() => {
    const ids = new Set<string>();
    for (const s of schedules) {
      if (Array.isArray(s.teacherIds)) s.teacherIds.forEach((t: unknown) => { if (typeof t === 'string' && t) ids.add(t); });
      if (typeof s.teacherId === 'string' && s.teacherId) ids.add(s.teacherId);
    }
    return ids;
  }, [schedules]);

  // เรียงตามรหัสครู
  const options = useMemo(
    () => staff
      .filter(s => s.active || withSchedules.has(s.id) || s.id === selectedId)
      .sort((a, b) => compareStaffId(a.id, b.id)),
    [staff, withSchedules, selectedId],
  );
  const selected = staff.find(s => s.id === selectedId) || null;

  const grid = useMemo(() => buildTeacherWeekGrid({
    schedules,
    staffId: selectedId || null,
    staffEmail: selected?.email,
    configuredPeriodNumbers: adminPeriods.map(p => p.periodNumber),
  }), [schedules, selectedId, selected?.email, adminPeriods]);

  const periodNumbers = useMemo(() => {
    if (!hideEmpty) return grid.periodNumbers;
    return grid.periodNumbers.filter(p => grid.days.some(d => (grid.cells[d.key]?.[p] || []).length > 0));
  }, [grid, hideEmpty]);

  const cellsAt = (dayKey: string, p: number) => grid.cells[dayKey]?.[p] || [];
  const termLabel = !sem.loading && sem.academicYear && sem.term ? `ภาคเรียนที่ ${sem.term}/${sem.academicYear}` : '';
  const th = 'px-1 py-2 text-[12px] font-bold text-slate-600 bg-slate-100 border border-slate-200 whitespace-nowrap';
  const td = 'align-top p-1 border border-slate-200 overflow-hidden';
  const cols = transposed ? grid.days.length : periodNumbers.length;

  const renderCell = (dayKey: string, p: number) => (
    <td key={transposed ? dayKey : p} className={td}>
      <div className="space-y-1">{cellsAt(dayKey, p).map(c => <div key={c.key}><CellCard c={c} /></div>)}</div>
    </td>
  );

  return (
    <div className="space-y-4" id="teacher-week-timetable">
      <div className="flex flex-wrap items-center gap-3 bg-[#161f30] border border-slate-800/80 rounded-2xl p-4 shadow-xl">
        <CalendarCog className="w-6 h-6 text-indigo-400 shrink-0" />
        <h3 className="text-lg font-bold text-white mr-auto">
          Teacher Schedule{selected ? `: ${selected.name}` : ''}
          {termLabel && <span className="ml-2 text-xs font-medium text-slate-400">{termLabel}</span>}
        </h3>
        <TeacherCombobox options={options} value={selectedId} onChange={setSelectedId} />
        <button type="button" onClick={() => setHideEmpty(v => !v)} aria-pressed={hideEmpty}
          title={hideEmpty ? 'แสดงคาบที่ว่างด้วย' : 'ซ่อนคาบที่ไม่มีการสอน'}
          className={`p-2 rounded-lg border cursor-pointer ${hideEmpty ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}>
          {hideEmpty ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
        </button>
        <button type="button" onClick={() => setTransposed(v => !v)} aria-pressed={transposed}
          title="สลับแกน วัน ↔ คาบ"
          className={`p-2 rounded-lg border cursor-pointer ${transposed ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}>
          <ArrowLeftRight className="w-5 h-5" />
        </button>
      </div>

      {(schedulesError || staffError) && (
        <div role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 text-red-300 text-sm px-4 py-3">
          โหลดข้อมูลไม่สำเร็จ: {schedulesError || staffError}
        </div>
      )}

      {!selectedId ? (
        <div className="text-center py-12 bg-[#161f30] rounded-xl border border-slate-800/80 text-slate-300 text-sm">
          เลือกครูเพื่อแสดงตารางสอนรายสัปดาห์
        </div>
      ) : schedulesLoading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-slate-300 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> กำลังโหลดตารางสอน…</div>
      ) : grid.total === 0 ? (
        <div className="text-center py-12 bg-[#161f30] rounded-xl border border-slate-800/80 text-slate-300 text-sm">
          ไม่พบคาบสอนของ {selected?.name || selectedId} ในตารางสอน{termLabel ? ` ${termLabel}` : 'ปัจจุบัน'}
        </div>
      ) : (
        <div id="teacher-week-print" className="bg-white text-slate-800 rounded-2xl p-2 shadow-xl overflow-x-auto"
          style={{ fontFamily: "'Sarabun','TH Sarabun New','Noto Sans Thai',sans-serif" }}>
          {/* table-fixed: คอลัมน์แบ่งความกว้างเท่ากันให้พอดีกรอบ (จอแคบมากจึงเลื่อนแนวนอนได้) */}
          <table className="w-full table-fixed border-collapse text-center" style={{ minWidth: `${72 + cols * 64}px` }}>
            <colgroup>
              <col style={{ width: '4.5rem' }} />
              {Array.from({ length: cols }, (_, i) => <col key={i} />)}
            </colgroup>
            {!transposed ? (
              <>
                <thead>
                  <tr>
                    <th className={`${th} text-left`}>DAY / P</th>
                    {periodNumbers.map(p => <th key={p} className={th}>P{p}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {grid.days.map(d => (
                    <tr key={d.key}>
                      <th className={`${th} text-[13px] text-slate-800 bg-white whitespace-normal`}>{d.label}</th>
                      {periodNumbers.map(p => renderCell(d.key, p))}
                    </tr>
                  ))}
                </tbody>
              </>
            ) : (
              <>
                <thead>
                  <tr>
                    <th className={`${th} text-left`}>P / DAY</th>
                    {grid.days.map(d => <th key={d.key} className={th}>{d.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {periodNumbers.map(p => (
                    <tr key={p}>
                      <th className={`${th} text-[13px] text-slate-800 bg-white`}>P{p}</th>
                      {grid.days.map(d => renderCell(d.key, p))}
                    </tr>
                  ))}
                </tbody>
              </>
            )}
          </table>
          <p className="mt-2 px-1 text-[11px] text-slate-500">
            รวม {grid.total} คาบ/สัปดาห์ · ข้อมูลจากตารางสอนที่นำเข้าในระบบ ไม่เติมคาบที่ไม่มี · วางเมาส์บนการ์ดเพื่อดูชื่อวิชา
          </p>
        </div>
      )}
    </div>
  );
}
