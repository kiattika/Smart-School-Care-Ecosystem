import React, { useRef, useState } from 'react';
import { Camera, Loader2, X } from 'lucide-react';
import { compressImage } from '../../lib/imageCompression';
import { uploadSupervisionPhoto } from '../../services/storageService';

/** แนบรูปถ่ายหลายรูป (บีบอัดก่อนอัปโหลด) — เก็บเป็น download URL; ownerUid = Auth UID ผู้อัปโหลด */
export function PhotoPicker({ photos, onChange, max, ownerUid, hint }: {
  photos: string[]; onChange: (p: string[]) => void; max: number; ownerUid: string; hint?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const add = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true); setErr('');
    try {
      const urls: string[] = [];
      for (const f of Array.from(files).slice(0, max - photos.length)) {
        const c = await compressImage(f);
        URL.revokeObjectURL(c.previewUrl);
        urls.push(await uploadSupervisionPhoto(ownerUid, c.blob));
      }
      onChange([...photos, ...urls]);
    } catch (e) { setErr(e instanceof Error ? e.message : 'อัปโหลดรูปไม่สำเร็จ'); } finally { setBusy(false); if (ref.current) ref.current.value = ''; }
  };
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-400">รูปถ่าย ({photos.length}/{max}){hint ? ` — ${hint}` : ''}</p>
      <div className="flex flex-wrap gap-2">
        {photos.map((url, i) => (
          <div key={url} className="relative w-24 h-24 rounded-lg overflow-hidden border border-slate-700">
            <img src={url} alt={`รูปที่ ${i + 1}`} className="w-full h-full object-cover" />
            <button type="button" aria-label="ลบรูป" onClick={() => onChange(photos.filter(u => u !== url))} className="absolute top-1 right-1 bg-black/70 rounded-full p-1 text-white cursor-pointer"><X className="w-3 h-3" /></button>
          </div>
        ))}
        {photos.length < max && (
          <button type="button" disabled={busy} onClick={() => ref.current?.click()}
            className="w-24 h-24 rounded-lg border border-dashed border-slate-600 text-slate-400 flex flex-col items-center justify-center text-xs gap-1 hover:border-cyan-500 cursor-pointer">
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}เพิ่มรูป
          </button>
        )}
        <input ref={ref} type="file" accept="image/*" multiple className="hidden" onChange={e => void add(e.target.files)} />
      </div>
      {err && <p role="alert" className="text-xs text-amber-300">{err}</p>}
    </div>
  );
}
