import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { CalendarCog, DoorOpen, Eye, EyeOff, Printer, School, ArrowLeftRight, Loader2 } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useAllSchedules } from '../../hooks/useAllSchedules';
import { useAdminPeriods } from '../../hooks/useAdminPeriods';
import { useCurrentSemester } from '../../hooks/useCurrentSemester';
import { isStaffActive } from '../../lib/staffStatus';
import { buildTeacherWeekGrid, staffDisplayName, type WeekCell } from '../../lib/teacherWeekTimetable';

interface StaffRow { id: string; name: string; email: string; active: boolean }

interface Props {
  /** staff doc id ของผู้ใช้ที่ login — เป็นค่าเริ่มต้นของตัวเลือกครู (ไม่มี = ต้องเลือกเอง) */
  ownStaffId: string | null;
}

const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #teacher-week-print, #teacher-week-print * { visibility: visible !important; }
  #teacher-week-print { position: absolute; left: 0; top: 0; width: 100%; padding: 0 !important; box-shadow: none !important; }
  .twt-no-print { display: none !important; }
  @page { size: A4 landscape; margin: 10mm; }
}
`;

function CellCard({ c }: { c: WeekCell }) {
  const title = [c.code, c.name, c.classLabel, c.room && `ห้อง ${c.room}`].filter(Boolean).join(' · ');
  return (
    <div
      title={title}
      className="rounded-md bg-white shadow-sm border border-slate-200 text-left px-2 py-1.5 text-[12px] leading-snug"
      style={{ borderLeft: `4px solid ${c.color}` }}
    >
      <div className="font-bold text-[13px]" style={{ color: c.color }}>{c.code || '—'}</div>
      {c.classLabel && <div className="flex items-center gap-1 text-slate-600"><School className="w-3 h-3 shrink-0" />{c.classLabel}</div>}
      {c.room && <div className="flex items-center gap-1 text-slate-600"><DoorOpen className="w-3 h-3 shrink-0" />{c.room}</div>}
      {c.coTaught && <div className="text-[10px] text-sky-600">Co-taught</div>}
      {c.block && <div className="text-[10px] text-violet-600">Block {c.block.index}/{c.block.total}</div>}
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

  const options = useMemo(
    () => staff
      .filter(s => s.active || withSchedules.has(s.id) || s.id === selectedId)
      .sort((a, b) => a.name.localeCompare(b.name, 'th')),
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
  const th = 'px-2 py-2.5 text-[12px] font-bold text-slate-600 bg-slate-100 border border-slate-200 whitespace-nowrap';
  const td = 'align-top p-1.5 border border-slate-200 min-w-[110px]';

  return (
    <div className="space-y-4" id="teacher-week-timetable">
      <style>{PRINT_CSS}</style>

      <div className="twt-no-print flex flex-wrap items-center gap-3 bg-[#161f30] border border-slate-800/80 rounded-2xl p-4 shadow-xl">
        <CalendarCog className="w-6 h-6 text-indigo-400 shrink-0" />
        <h3 className="text-lg font-bold text-white mr-auto">
          Teacher Schedule{selected ? `: ${selected.name}` : ''}
          {termLabel && <span className="ml-2 text-xs font-medium text-slate-400">{termLabel}</span>}
        </h3>
        <select
          id="teacher-week-select"
          aria-label="เลือกครู"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="min-w-[260px] max-w-full border border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-800 text-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
        >
          <option value="">— เลือกครู —</option>
          {options.map(s => (
            <option key={s.id} value={s.id}>{s.name} ({s.id}){s.active ? '' : ' · ปิดการใช้งาน'}</option>
          ))}
        </select>
        <button type="button" onClick={() => window.print()} disabled={!selectedId}
          className="px-4 py-2 rounded-lg text-sm font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center gap-1.5 cursor-pointer">
          <Printer className="w-4 h-4" /> Print
        </button>
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
        <div role="alert" className="twt-no-print rounded-lg border border-red-500/40 bg-red-500/10 text-red-300 text-sm px-4 py-3">
          โหลดข้อมูลไม่สำเร็จ: {schedulesError || staffError}
        </div>
      )}

      {!selectedId ? (
        <div className="twt-no-print text-center py-12 bg-[#161f30] rounded-xl border border-slate-800/80 text-slate-300 text-sm">
          เลือกครูเพื่อแสดงตารางสอนรายสัปดาห์
        </div>
      ) : schedulesLoading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-slate-300 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> กำลังโหลดตารางสอน…</div>
      ) : grid.total === 0 ? (
        <div className="text-center py-12 bg-[#161f30] rounded-xl border border-slate-800/80 text-slate-300 text-sm">
          ไม่พบคาบสอนของ {selected?.name || selectedId} ในตารางสอน{termLabel ? ` ${termLabel}` : 'ปัจจุบัน'}
        </div>
      ) : (
        <div id="teacher-week-print" className="bg-white text-slate-800 rounded-2xl p-3 shadow-xl overflow-x-auto"
          style={{ fontFamily: "'Sarabun','TH Sarabun New','Noto Sans Thai',sans-serif" }}>
          <div className="hidden print:block mb-2 text-base font-bold">
            Teacher Schedule: {selected?.name || selectedId} {termLabel && <span className="font-normal text-sm">({termLabel})</span>}
          </div>
          <table className="w-full border-collapse text-center">
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
                      <th className={`${th} text-base text-slate-800 bg-white`}>{d.label}</th>
                      {periodNumbers.map(p => (
                        <td key={p} className={td}>
                          <div className="space-y-1">{cellsAt(d.key, p).map(c => <div key={c.key}><CellCard c={c} /></div>)}</div>
                        </td>
                      ))}
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
                      <th className={`${th} text-base text-slate-800 bg-white`}>P{p}</th>
                      {grid.days.map(d => (
                        <td key={d.key} className={td}>
                          <div className="space-y-1">{cellsAt(d.key, p).map(c => <div key={c.key}><CellCard c={c} /></div>)}</div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </>
            )}
          </table>
          <p className="twt-no-print mt-2 text-[11px] text-slate-500">
            รวม {grid.total} คาบ/สัปดาห์ · Co-taught = มีผู้สอนมากกว่า 1 คน · Block = คาบติดกันของวิชาหลักเดียวกัน (ชั้น/ห้องเดียวกัน) · ข้อมูลจากตารางสอนที่นำเข้าในระบบ ไม่เติมคาบที่ไม่มี
          </p>
        </div>
      )}
    </div>
  );
}
