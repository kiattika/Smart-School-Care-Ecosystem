import React from 'react';
import { cn } from '../../lib/utils';

/** ชิ้นส่วนฟอร์มที่ใช้ร่วมกันของแบบเยี่ยมบ้าน (นักเรียน/ผู้ปกครอง/ครู) */
export const inputCls = 'w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none placeholder:text-slate-600';

export const Section = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) => (
  <section className="space-y-3">
    <div className="border-b border-white/10 pb-1.5">
      <h3 className="text-sm font-bold text-indigo-300">{title}</h3>
      {hint && <p className="text-[11px] text-slate-500 mt-0.5">{hint}</p>}
    </div>
    {children}
  </section>
);

export const Label = ({ children, required }: { children: React.ReactNode; required?: boolean }) => (
  <label className="block text-xs font-semibold text-slate-300 mb-1">{children}{required && <span className="text-rose-400"> *</span>}</label>
);

/** แถบแสดงที่มาของข้อมูล (ระบบ/นักเรียน/ผู้ปกครอง/ครู) */
export const SourceTag = ({ source }: { source: 'SYSTEM' | 'STUDENT' | 'PARENT' | 'TEACHER' }) => {
  const m = { SYSTEM: ['ข้อมูลจากระบบ', 'bg-slate-500/20 text-slate-300'], STUDENT: ['นักเรียนกรอก', 'bg-sky-500/20 text-sky-300'], PARENT: ['ผู้ปกครองกรอก', 'bg-amber-500/20 text-amber-300'], TEACHER: ['ครูกรอก', 'bg-emerald-500/20 text-emerald-300'] }[source];
  return <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-semibold', m[1])}>{m[0]}</span>;
};

export function Chips({ options, value, onToggle, exclusive }: { options: string[]; value: string[]; onToggle: (o: string) => void; exclusive?: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => (
        <button type="button" key={o} onClick={() => onToggle(o)} aria-pressed={value.includes(o)}
          className={cn('px-2.5 py-1 rounded-lg text-xs border transition-colors text-left',
            value.includes(o) ? 'bg-indigo-500/25 border-indigo-400 text-indigo-200' : 'bg-black/20 border-white/10 text-slate-400 hover:bg-white/5',
            exclusive === o && 'font-semibold')}>
          {o}
        </button>
      ))}
    </div>
  );
}

export function Single({ options, value, onPick }: { options: string[]; value: string; onPick: (o: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => (
        <button type="button" key={o} onClick={() => onPick(o)} aria-pressed={value === o}
          className={cn('px-2.5 py-1 rounded-lg text-xs border transition-colors text-left',
            value === o ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200' : 'bg-black/20 border-white/10 text-slate-400 hover:bg-white/5')}>
          {o}
        </button>
      ))}
    </div>
  );
}

export const toNum = (v: string): number | null => (v.trim() === '' || Number.isNaN(Number(v)) ? null : Number(v));
/** สลับค่าในชุดตัวเลือกหลายข้อ; exclusive = ตัวเลือก "ไม่มี/ไม่ด้อยโอกาส" ที่ใช้ร่วมกับข้ออื่นไม่ได้ */
export function toggleIn(arr: string[], o: string, exclusive?: string): string[] {
  if (arr.includes(o)) return arr.filter(x => x !== o);
  if (exclusive && o === exclusive) return [o];
  return [...arr.filter(x => x !== exclusive), o];
}

export function ErrorList({ errors }: { errors: string[] }) {
  if (!errors.length) return null;
  return (
    <div role="alert" className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-200 space-y-0.5">
      <div className="font-bold">ยังบันทึกไม่ได้ กรุณาแก้:</div>
      {errors.map(e => <div key={e}>• {e}</div>)}
    </div>
  );
}
