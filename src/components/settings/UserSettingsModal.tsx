import React, { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, Monitor, Moon, Sun, X } from 'lucide-react';
import { compressImage, type CompressedImage } from '../../lib/imageCompression';
import {
  TEXT_SCALES, TEXT_SCALE_LABEL, THEME_CHOICES, THEME_LABEL, prefsPatch, saveLocalPreferences,
  type TextScale, type ThemeChoice, type UserPreferences,
} from '../../lib/userPreferences';
import { saveUserPreferences, uploadMyProfilePhoto } from '../../services/userPreferencesService';

const swatch = (c: string) => <span className="w-4 h-4 rounded-full border border-white/40 shrink-0" style={{ backgroundColor: c }} aria-hidden="true" />;
const THEME_ICON: Record<ThemeChoice, React.ReactNode> = {
  system: <Monitor className="w-4 h-4" />, light: <Sun className="w-4 h-4" />, dark: <Moon className="w-4 h-4" />,
  navy: swatch('#1b2a4a'), pink: swatch('#9c425d'), lavender: swatch('#4a3aff'),
};
const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');

/**
 * ตั้งค่าส่วนตัว: ธีม, ขนาดตัวอักษร, รูปโปรไฟล์ (บุคลากร/ผู้ปกครอง — นักเรียนเปลี่ยนรูปที่หน้านักเรียนเดิม)
 * เปลี่ยนแล้วใช้ทันที (พรีวิว) และบันทึกขึ้นบัญชีเมื่อกด "บันทึก"; ยกเลิก = กลับค่าเดิม
 */
export function UserSettingsModal({ uid, prefs, showPhoto, initial, onPreview, onClose }: {
  uid: string; prefs: UserPreferences; showPhoto: boolean; initial: string;
  onPreview: (p: UserPreferences) => void; onClose: () => void;
}) {
  const [draft, setDraft] = useState<UserPreferences>(prefs);
  const [photo, setPhoto] = useState<CompressedImage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.previewUrl); }, [photo]);

  const change = (patch: Partial<UserPreferences>) => { const next = { ...draft, ...patch }; setDraft(next); onPreview(next); };
  const cancel = () => { onPreview(prefs); onClose(); };
  const pick = async (f: File | undefined) => {
    if (!f) return;
    setError('');
    try { setPhoto(await compressImage(f)); } catch (e) { setError(errMsg(e)); }
    if (fileRef.current) fileRef.current.value = '';
  };
  const save = async () => {
    setBusy(true); setError('');
    try {
      let next = draft;
      if (photo) next = { ...draft, photoUrl: await uploadMyProfilePhoto(uid, photo.blob) };
      const patch = prefsPatch(prefs, next);
      if (Object.keys(patch).length) await saveUserPreferences(uid, patch);
      saveLocalPreferences(next);
      onPreview(next);
      onClose();
    } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  };
  const shownPhoto = photo?.previewUrl || draft.photoUrl;
  const seg = (active: boolean) => `flex-1 basis-[30%] flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs border cursor-pointer ${active ? 'bg-cyan-600 border-cyan-500 text-white' : 'bg-slate-950 border-slate-700 text-slate-300'}`;
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4" onClick={cancel} role="dialog" aria-modal="true" aria-label="ตั้งค่าส่วนตัว">
      <div className="w-full max-w-md max-h-[90dvh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-5 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">ตั้งค่าส่วนตัว</h3>
          <button aria-label="ปิด" onClick={cancel} className="text-slate-400 hover:text-slate-200 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        {error && <p role="alert" className="text-xs text-rose-400">{error}</p>}

        {showPhoto && (
          <section className="space-y-2">
            <div className="text-xs font-semibold text-slate-300">รูปโปรไฟล์</div>
            <div className="flex items-center gap-3">
              {shownPhoto
                ? <img src={shownPhoto} alt="รูปโปรไฟล์" className="w-16 h-16 rounded-2xl object-cover border border-slate-700" />
                : <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-xl font-bold">{initial}</div>}
              <div className="space-y-1">
                <button className="px-3 py-1.5 rounded-lg text-xs bg-slate-700 text-white flex items-center gap-1.5 cursor-pointer" onClick={() => fileRef.current?.click()}><Camera className="w-3.5 h-3.5" /> เลือกรูป</button>
                {(draft.photoUrl || photo) && <button className="text-[11px] text-slate-400 underline cursor-pointer" onClick={() => { setPhoto(null); change({ photoUrl: '' }); }}>ลบรูป</button>}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" aria-label="เลือกไฟล์รูป" onChange={e => void pick(e.target.files?.[0])} />
            </div>
            <p className="text-[11px] text-slate-500">รูปจะถูกย่อให้เล็กลงอัตโนมัติ</p>
          </section>
        )}

        <section className="space-y-2">
          <div className="text-xs font-semibold text-slate-300">ธีมการแสดงผล</div>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="ธีม">
            {THEME_CHOICES.map(t => (
              <button key={t} role="radio" aria-checked={draft.theme === t} className={seg(draft.theme === t)} onClick={() => change({ theme: t })}>{THEME_ICON[t]} {THEME_LABEL[t]}</button>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <div className="text-xs font-semibold text-slate-300">ขนาดตัวอักษร</div>
          <div className="flex gap-2" role="radiogroup" aria-label="ขนาดตัวอักษร">
            {TEXT_SCALES.map((s: TextScale) => (
              <button key={s} role="radio" aria-checked={draft.textScale === s} className={seg(draft.textScale === s)} onClick={() => change({ textScale: s })}>{TEXT_SCALE_LABEL[s]}</button>
            ))}
          </div>
        </section>

        <div className="flex gap-2 justify-end pt-1">
          <button className="px-3 py-1.5 rounded-lg text-xs border border-slate-600 text-slate-300 cursor-pointer" onClick={cancel}>ยกเลิก</button>
          <button disabled={busy} className="px-4 py-1.5 rounded-lg text-xs bg-cyan-600 text-white disabled:opacity-40 flex items-center gap-1.5 cursor-pointer" onClick={() => void save()}>{busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} บันทึก</button>
        </div>
      </div>
    </div>
  );
}
