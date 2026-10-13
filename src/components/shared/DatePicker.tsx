import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { computePopupPosition } from './popupPosition';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];
const THAI_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const THAI_WEEKDAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

interface DatePickerProps {
  value: string; // YYYY-MM-DD, '' = ยังไม่เลือก
  onChange: (value: string) => void;
  min?: string; // YYYY-MM-DD
  max?: string; // YYYY-MM-DD
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** เหมือน <input required> — ค่าว่างจะบล็อกการ submit ฟอร์ม (validation ของเบราว์เซอร์) */
  required?: boolean;
  /** แสดงปุ่ม × ล้างค่ากลับเป็น '' (เช่น ตัวกรองช่วงวันที่ที่ว่าง = ไม่กรอง) */
  clearable?: boolean;
  /** ข้อความสำหรับ screen reader / validation */
  ariaLabel?: string;
  /** เปิดปฏิทินที่หน้าเลือกปี (พ.ศ.) ก่อน → เดือน → วัน — เหมาะกับวันเกิดที่ต้องย้อนไปหลายปี */
  yearFirst?: boolean;
}

const parseYmd = (s: string): Date | null => {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};
const toYmd = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
/** ช่องว่างเปิดที่เดือนปัจจุบัน (บีบให้อยู่ในช่วง min/max) — ไม่เปิดที่เดือนของ min เมื่อ min อยู่ในอดีต */
const defaultView = (min?: string, max?: string): Date => {
  const today = new Date();
  const lo = parseYmd(min || ''); const hi = parseYmd(max || '');
  if (lo && today < lo) return lo;
  if (hi && today > hi) return hi;
  return today;
};
const formatDisplay = (s: string): string => {
  const d = parseYmd(s);
  if (!d) return '';
  return `${d.getDate()} ${THAI_MONTHS_SHORT[d.getMonth()]} ${d.getFullYear() + 543}`;
};

/**
 * ปฏิทินเลือกวันที่แบบ dropdown ธีมเดียวกับแอป — แทนที่ input[type=date] เดิมที่ browser
 * แต่ละตัวเรนเดอร์ไม่เหมือนกัน (บางเครื่อง/บางเบราว์เซอร์หน้าตาเหมือนกล่องข้อความเปล่าๆ ไม่มีไอคอน
 * ปฏิทินชัดเจน) ใช้ในฟอร์มลากิจ/ไปราชการ และเช็คชื่อย้อนหลัง — ค่าที่เก็บ/ส่งออกยังเป็น string
 * รูปแบบ YYYY-MM-DD เหมือนเดิมทุกที่ที่เรียกใช้ ไม่ต้องแก้ตรรกะอื่นที่กินค่านี้ต่อ
 */
export function DatePicker({ value, onChange, min, max, placeholder, className, disabled, required, clearable, ariaLabel, yearFirst }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  // days = ตารางวัน, months = เลือกเดือน, years = เลือกปี (พ.ศ.) — กดหัวข้อ "เดือน ปี" เพื่อย้อนไปเลือกเดือน/ปี
  const [mode, setMode] = useState<'days' | 'months' | 'years'>('days');
  const [yearPageStart, setYearPageStart] = useState(0);
  const selected = parseYmd(value);
  const [viewDate, setViewDate] = useState(() => selected || defaultView(min, max));
  const wrapRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  // ป๊อปอัปวาดผ่าน portal ที่ body (position: fixed) — ไม่ถูก overflow/stacking ของกล่องแม่ตัดหรือถูกการ์ดอื่นทับ; เปิดขึ้นบนเมื่อด้านล่างไม่พอ
  const [pos, setPos] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  const reposition = useCallback(() => {
    const wrap = wrapRef.current; const pop = popupRef.current;
    if (!wrap || !pop) return;
    const r = wrap.getBoundingClientRect();
    const next = computePopupPosition(
      { top: r.top, bottom: r.bottom, left: r.left, right: r.right },
      { width: 288, height: pop.scrollHeight || 340 },
      { width: window.innerWidth, height: window.innerHeight },
    );
    setPos(prev => (prev && prev.top === next.top && prev.left === next.left && prev.maxHeight === next.maxHeight ? prev : { top: next.top, left: next.left, maxHeight: next.maxHeight }));
  }, []);
  useLayoutEffect(() => { if (isOpen) reposition(); }, [isOpen, mode, viewDate, yearPageStart, reposition]);
  useEffect(() => {
    if (!isOpen) { setPos(null); return; }
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => { window.removeEventListener('resize', reposition); window.removeEventListener('scroll', reposition, true); };
  }, [isOpen, reposition]);

  useEffect(() => {
    if (isOpen) {
      const base = selected || defaultView(min, max);
      setViewDate(base);
      setMode(yearFirst ? 'years' : 'days');
      // หน้าเลือกปี 20 ปี/หน้า: มีค่าแล้ว → หน้าที่มีปีนั้น; ยังไม่มี → ให้ปีล่าสุด (max/วันนี้) อยู่ท้ายหน้า
      const anchorYear = selected ? selected.getFullYear() : (parseYmd(max) || new Date()).getFullYear();
      setYearPageStart(selected ? anchorYear - (anchorYear % 20) + 0 : anchorYear - 19);
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || popupRef.current?.contains(t)) return;
      setIsOpen(false);
    };
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => { document.removeEventListener('mousedown', handleClickOutside); document.removeEventListener('keydown', handleEsc); };
  }, [isOpen]);

  const minDate = parseYmd(min);
  const maxDate = parseYmd(max);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const isDisabled = (d: Date) => (minDate && d < minDate) || (maxDate && d > maxDate);
  const isSameDay = (a: Date, b: Date | null) => !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const handlePick = (d: Date) => {
    if (isDisabled(d)) return;
    onChange(toYmd(d));
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(o => !o)}
        className={className || "w-full flex items-center gap-2 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-emerald-500 disabled:opacity-50 cursor-pointer"}
      >
        <CalendarDays className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span className={value ? 'text-white' : 'text-slate-500'}>
          {value ? formatDisplay(value) : (placeholder || 'เลือกวันที่')}
        </span>
      </button>

      {/* required: input ซ่อน (โฟกัสได้) ถือค่าไว้ให้ validation ของฟอร์มทำงานเหมือน <input type=date required> เดิม */}
      {required && (
        <input
          tabIndex={-1}
          aria-hidden="true"
          aria-label={ariaLabel}
          required
          disabled={disabled}
          value={value}
          onChange={() => {}}
          onFocus={() => setIsOpen(true)}
          className="absolute left-0 bottom-0 w-full h-px opacity-0 pointer-events-none"
        />
      )}

      {clearable && value && !disabled && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="ล้างวันที่"
          title="ล้างวันที่"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-500 hover:text-white hover:bg-slate-800"
        >
          <X className="w-3 h-3" />
        </button>
      )}

      {isOpen && createPortal(
        <div
          ref={popupRef}
          data-testid="datepicker-popup"
          style={{ position: 'fixed', top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: 288, maxHeight: pos?.maxHeight, overflowY: 'auto', zIndex: 1000, visibility: pos ? 'visible' : 'hidden' }}
          className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-3"
        >
          {mode === 'years' && (
            <>
              <div className="flex items-center justify-between mb-2">
                <button type="button" aria-label="ย้อนไป 20 ปี" onClick={() => setYearPageStart(y => y - 20)} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300"><ChevronLeft className="w-4 h-4" /></button>
                <span className="text-xs font-bold text-white">เลือกปี พ.ศ. {yearPageStart + 543}–{yearPageStart + 19 + 543}</span>
                <button type="button" aria-label="ไปข้างหน้า 20 ปี" onClick={() => setYearPageStart(y => y + 20)} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300"><ChevronRight className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {Array.from({ length: 20 }, (_, i) => yearPageStart + i).map(y => {
                  const outOfRange = (minDate && y < minDate.getFullYear()) || (maxDate && y > maxDate.getFullYear());
                  const active = viewDate.getFullYear() === y && !!selected && selected.getFullYear() === y;
                  return (
                    <button type="button" key={y} disabled={!!outOfRange}
                      onClick={() => { setViewDate(new Date(y, viewDate.getMonth(), 1)); setMode('months'); }}
                      className={`py-2 rounded-lg text-[11px] font-semibold ${active ? 'bg-emerald-600 text-white' : outOfRange ? 'text-slate-700 cursor-not-allowed' : 'text-slate-200 hover:bg-slate-800'}`}>
                      {y + 543}
                    </button>
                  );
                })}
              </div>
            </>
          )}
          {mode === 'months' && (
            <>
              <div className="flex items-center justify-between mb-2">
                <button type="button" aria-label="ปีก่อนหน้า" onClick={() => setViewDate(new Date(year - 1, month, 1))} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300"><ChevronLeft className="w-4 h-4" /></button>
                <button type="button" onClick={() => { setYearPageStart(year - (year % 20)); setMode('years'); }} className="text-xs font-bold text-white hover:text-emerald-300" title="เลือกปีใหม่">ปี พ.ศ. {year + 543}</button>
                <button type="button" aria-label="ปีถัดไป" onClick={() => setViewDate(new Date(year + 1, month, 1))} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300"><ChevronRight className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {THAI_MONTHS.map((m, i) => {
                  const monthStart = new Date(year, i, 1), monthEnd = new Date(year, i + 1, 0);
                  const outOfRange = (minDate && monthEnd < minDate) || (maxDate && monthStart > maxDate);
                  return (
                    <button type="button" key={m} disabled={!!outOfRange}
                      onClick={() => { setViewDate(new Date(year, i, 1)); setMode('days'); }}
                      className={`py-2 rounded-lg text-[11px] font-semibold ${i === month ? 'bg-slate-800 text-emerald-400 border border-emerald-500/40' : outOfRange ? 'text-slate-700 cursor-not-allowed' : 'text-slate-200 hover:bg-slate-800'}`}>
                      {m}
                    </button>
                  );
                })}
              </div>
            </>
          )}
          {mode === 'days' && (<>
          <div className="flex items-center justify-between mb-2">
            <button type="button" aria-label="เดือนก่อนหน้า" onClick={() => setViewDate(new Date(year, month - 1, 1))} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => { setYearPageStart(year - (year % 20)); setMode('years'); }} className="text-xs font-bold text-white hover:text-emerald-300" title="กดเพื่อเลือกปี/เดือน">{THAI_MONTHS[month]} {year + 543}</button>
            <button type="button" aria-label="เดือนถัดไป" onClick={() => setViewDate(new Date(year, month + 1, 1))} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {THAI_WEEKDAYS.map(w => (
              <div key={w} className="text-center text-[10px] font-bold text-slate-500 py-1">{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (!d) return <div key={i} />;
              const disabledDay = isDisabled(d);
              const active = isSameDay(d, selected);
              const isToday = isSameDay(d, new Date());
              return (
                <button
                  type="button"
                  key={i}
                  disabled={disabledDay}
                  onClick={() => handlePick(d)}
                  className={`aspect-square rounded-lg text-[11px] font-semibold transition-colors ${
                    active ? 'bg-emerald-600 text-white' :
                    disabledDay ? 'text-slate-700 cursor-not-allowed' :
                    isToday ? 'bg-slate-800 text-emerald-300 font-extrabold ring-2 ring-emerald-400' :
                    'text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
          {(() => {
            const today = new Date();
            const todayOk = !isDisabled(today);
            const viewingThisMonth = today.getFullYear() === year && today.getMonth() === month;
            if (viewingThisMonth && !todayOk) return null;
            return (
              <div className="mt-2 pt-2 border-t border-slate-800 flex justify-between items-center">
                <span className="text-[10px] text-slate-500">วันนี้ {today.getDate()} {THAI_MONTHS_SHORT[today.getMonth()]} {today.getFullYear() + 543}</span>
                <button type="button" data-testid="datepicker-today"
                  onClick={() => (todayOk ? handlePick(today) : setViewDate(new Date(today.getFullYear(), today.getMonth(), 1)))}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-emerald-300 hover:bg-slate-800">
                  {todayOk ? 'เลือกวันนี้' : 'ไปเดือนนี้'}
                </button>
              </div>
            );
          })()}
          </>)}
        </div>,
        document.body,
      )}
    </div>
  );
}
