import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { HOURS, TimeParts, composeTimeValue, minuteOptions, parseTimeValue } from './timePickerValue';

interface TimePickerProps {
  value: string; // 'HH:mm', '' = ยังไม่เลือก
  onChange: (value: string) => void;
  /** ช่วงนาทีในตัวเลือก (ค่าเริ่มต้น 1) — ค่าเดิมที่ไม่ตรง step ยังแสดงอยู่ */
  minuteStep?: number;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

/**
 * เลือกเวลาแบบ 24 ชั่วโมง (ชั่วโมง 00-23 + นาที) ธีมเดียวกับแอป — แทน <input type="time"> ที่บางเบราว์เซอร์/
 * locale แสดงเป็น 12 ชั่วโมง (AM/PM) ค่าที่เก็บ/ส่งออกยังเป็น 'HH:mm' เหมือนเดิม
 * เลือกครบทั้งชั่วโมงและนาทีจึงส่งค่าออก; ล้างส่วนใดส่วนหนึ่ง = ส่ง ''
 */
export function TimePicker({ value, onChange, minuteStep = 1, className, disabled, ariaLabel }: TimePickerProps) {
  // เก็บค่าที่เลือกไม่ครบ (เช่น เลือกชั่วโมงแล้วแต่ยังไม่เลือกนาที) ไว้ในเครื่อง — ส่งออกเมื่อครบเท่านั้น
  const [parts, setParts] = useState<TimeParts>(() => parseTimeValue(value));

  useEffect(() => {
    const incoming = parseTimeValue(value);
    // ค่าจากภายนอกเปลี่ยน (เช่น โหลดจาก Firestore / คำนวณอัตโนมัติ) — ไม่ทับค่าที่ผู้ใช้เลือกค้างไว้ไม่ครบ
    if (value || composeTimeValue(parts)) setParts(incoming);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (next: TimeParts) => {
    setParts(next);
    const composed = composeTimeValue(next);
    if (composed !== value) onChange(composed);
  };

  const selectClass = 'bg-transparent text-inherit outline-none cursor-pointer disabled:cursor-not-allowed font-mono appearance-none px-0.5';

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`${className || 'bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white'} inline-flex items-center gap-1 ${disabled ? 'opacity-50' : ''}`}
    >
      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      <select
        aria-label="ชั่วโมง"
        disabled={disabled}
        value={parts.hour}
        onChange={(e) => update({ hour: e.target.value, minute: parts.minute })}
        className={selectClass}
      >
        <option value="" className="bg-slate-900">--</option>
        {HOURS.map((h) => <option key={h} value={h} className="bg-slate-900">{h}</option>)}
      </select>
      <span className="text-slate-500">:</span>
      <select
        aria-label="นาที"
        disabled={disabled}
        value={parts.minute}
        onChange={(e) => update({ hour: parts.hour, minute: e.target.value })}
        className={selectClass}
      >
        <option value="" className="bg-slate-900">--</option>
        {minuteOptions(minuteStep, parts.minute).map((m) => <option key={m} value={m} className="bg-slate-900">{m}</option>)}
      </select>
      <span className="text-[10px] text-slate-500">น.</span>
    </div>
  );
}
