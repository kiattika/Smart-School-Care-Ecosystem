import React, { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

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
export function DatePicker({ value, onChange, min, max, placeholder, className, disabled }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selected = parseYmd(value);
  const [viewDate, setViewDate] = useState(() => selected || parseYmd(min) || new Date());
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) setViewDate(selected || parseYmd(min) || new Date());
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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

      {isOpen && (
        <div className="absolute z-50 mt-1 w-72 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-3">
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => setViewDate(new Date(year, month - 1, 1))} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-white">{THAI_MONTHS[month]} {year + 543}</span>
            <button type="button" onClick={() => setViewDate(new Date(year, month + 1, 1))} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300">
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
                    isToday ? 'bg-slate-800 text-emerald-400 border border-emerald-500/40' :
                    'text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
