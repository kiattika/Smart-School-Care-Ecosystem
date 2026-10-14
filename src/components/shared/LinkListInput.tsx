import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { addLink } from '../../lib/evidenceLinks';

/**
 * ช่องแนบลิงก์หลายลิงก์: พิมพ์/วางลิงก์ → กด "เพิ่มลิงก์" (หรือ Enter) → ลิงก์ขึ้นในรายการด้านล่างให้ตรวจก่อนบันทึก
 * pendingChange แจ้งผู้ใช้งานเมื่อมีลิงก์ที่พิมพ์ค้างแต่ยังไม่ได้กดเพิ่ม (ให้ปิดปุ่มบันทึกกันลืม)
 */
export function LinkListInput({ links, onChange, max, placeholder = 'https://...', onPendingChange }: {
  links: string[]; onChange: (l: string[]) => void; max: number; placeholder?: string; onPendingChange?: (pending: boolean) => void;
}) {
  const [draft, setDraft] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => { onPendingChange?.(draft.trim() !== ''); }, [draft, onPendingChange]);
  const add = () => {
    const r = addLink(links, draft, max);
    if (r.error) { setErr(r.error); return; }
    onChange(r.list); setDraft(''); setErr('');
  };
  const host = (u: string) => { try { return new URL(u).hostname; } catch { return ''; } };
  return (
    <div className="space-y-2">
      {links.length > 0 && (
        <ol className="space-y-1" aria-label="ลิงก์ที่แนบแล้ว">
          {links.map((u, i) => (
            <li key={u} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs">
              <span className="text-slate-500">{i + 1}.</span>
              <a href={u} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 text-cyan-300 underline truncate" title={u}>{host(u)} — {u}</a>
              <button type="button" aria-label={`ลบลิงก์ ${i + 1}`} className="text-slate-400 hover:text-rose-300 cursor-pointer" onClick={() => onChange(links.filter(x => x !== u))}><X className="w-3.5 h-3.5" /></button>
            </li>
          ))}
        </ol>
      )}
      {links.length < max && (
        <div className="flex gap-2">
          <input className="flex-1 min-w-0 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-sm text-white" placeholder={placeholder} value={draft}
            onChange={e => { setDraft(e.target.value); setErr(''); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} aria-label="ลิงก์" />
          <button type="button" className="px-3 py-1.5 rounded-lg text-xs bg-slate-700 text-white cursor-pointer shrink-0" onClick={add}>+ เพิ่มลิงก์</button>
        </div>
      )}
      <p className="text-[11px] text-slate-500">{links.length}/{max} ลิงก์ — กด “เพิ่มลิงก์” เพื่อให้ลิงก์เข้ารายการก่อนกดบันทึก</p>
      {draft.trim() !== '' && !err && <p className="text-[11px] text-amber-300">ยังไม่ได้กด “เพิ่มลิงก์” — ลิงก์ที่พิมพ์ค้างไว้จะยังไม่ถูกบันทึก</p>}
      {err && <p role="alert" className="text-[11px] text-amber-300">{err}</p>}
    </div>
  );
}
