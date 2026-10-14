import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Loader2, Save, Send, Trash2, X } from 'lucide-react';
import { DatePicker } from '../shared/DatePicker';
import { TimePicker } from '../shared/TimePicker';
import { compressImage } from '../../lib/imageCompression';
import {
  SCORE_LABELS, SUPERVISION_ITEM_COUNT, SUPERVISION_ITEMS, SUPERVISION_MAX_PHOTOS, SUPERVISION_SECTIONS,
  computeObservation, validateForSubmit,
  type ObservationFormInput, type SupervisionObservation, type SupervisionScore,
} from '../../lib/supervision';
import { saveSupervisionObservation, deleteSupervisionDraft } from '../../services/supervisionService';
import { uploadSupervisionPhoto } from '../../services/storageService';

interface Props {
  roundId: string;
  teacher: { staffId: string; name: string; departmentId: string };
  supervisor: { staffId: string; name: string; uid: string };
  /** ฉบับร่างเดิม (ถ้ามี) */
  existing: SupervisionObservation | null;
  onClose: () => void;
}

const SCORES: SupervisionScore[] = [5, 4, 3, 2, 1];
const inputCls = 'w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500';

/** แบบสังเกตการสอน 20 ข้อ — ใช้บนมือถือได้ (ปุ่มคะแนนใหญ่) บันทึกร่างได้ ส่งผลแล้วล็อกคะแนน */
export function ObservationForm({ roundId, teacher, supervisor, existing, onClose }: Props) {
  const [courseCode, setCourseCode] = useState(existing?.courseCode || '');
  const [courseName, setCourseName] = useState(existing?.courseName || '');
  const [level, setLevel] = useState(existing?.level || '');
  const [observedDate, setObservedDate] = useState(existing?.observedDate || '');
  const [observedTime, setObservedTime] = useState(existing?.observedTime || '');
  const [scores, setScores] = useState<Record<string, number>>(() => ({ ...(existing?.scores as Record<string, number> || {}) }));
  const [assessmentMethod, setAssessmentMethod] = useState(existing?.assessmentMethod || '');
  const [strengths, setStrengths] = useState(existing?.strengths || '');
  const [improvements, setImprovements] = useState(existing?.improvements || '');
  const [comment, setComment] = useState(existing?.comment || '');
  const [photos, setPhotos] = useState<string[]>(() => (existing?.photos || []).map(p => p.url));
  const [busy, setBusy] = useState<'' | 'draft' | 'submit' | 'photo' | 'delete'>('');
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const result = useMemo(() => computeObservation(scores), [scores]);

  useEffect(() => { setError(null); }, [scores, courseName, observedDate]);

  const input = (): ObservationFormInput => ({
    roundId, teacher, supervisor: { staffId: supervisor.staffId, name: supervisor.name },
    courseCode, courseName, level, observedDate, observedTime, scores,
    assessmentMethod, strengths, improvements, comment,
    photos: photos.map(url => ({ url })),
  });

  const save = async (submit: boolean) => {
    setError(null);
    if (submit) {
      const problem = validateForSubmit(input());
      if (problem) { setError(problem); return; }
      if (!window.confirm('ส่งผลแล้วจะแก้ไขคะแนนไม่ได้ และครูผู้รับการนิเทศจะเห็นผลทันที ยืนยันส่งผล?')) return;
    }
    setBusy(submit ? 'submit' : 'draft');
    try {
      await saveSupervisionObservation(input(), { submit, exists: !!existing });
      if (submit) onClose();
      else setError('บันทึกฉบับร่างแล้ว');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    } finally { setBusy(''); }
  };

  const addPhotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy('photo'); setError(null);
    try {
      const room = SUPERVISION_MAX_PHOTOS - photos.length;
      const urls: string[] = [];
      for (const f of Array.from(files).slice(0, room)) {
        const c = await compressImage(f);
        URL.revokeObjectURL(c.previewUrl);
        urls.push(await uploadSupervisionPhoto(supervisor.uid, c.blob));
      }
      setPhotos(p => [...p, ...urls]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'อัปโหลดรูปไม่สำเร็จ');
    } finally { setBusy(''); if (fileRef.current) fileRef.current.value = ''; }
  };

  const removeDraft = async () => {
    if (!existing || !window.confirm('ลบฉบับร่างนี้?')) return;
    setBusy('delete');
    try { await deleteSupervisionDraft(existing.id); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : 'ลบไม่สำเร็จ'); setBusy(''); }
  };

  return (
    <div className="bg-[#161f30] border border-slate-800/80 rounded-xl p-4 sm:p-6 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-white">แบบสังเกตการสอน — {teacher.name}</h3>
          <p className="text-xs text-slate-400 mt-0.5">ผู้นิเทศ: {supervisor.name} · รอบ {roundId.replace('_', '/')}</p>
        </div>
        <button onClick={onClose} aria-label="ปิด" className="p-2 text-slate-400 hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="text-xs text-slate-400 space-y-1">รหัสวิชา
          <input className={inputCls} value={courseCode} maxLength={40} onChange={e => setCourseCode(e.target.value)} />
        </label>
        <label className="text-xs text-slate-400 space-y-1">รายวิชา *
          <input className={inputCls} value={courseName} maxLength={160} onChange={e => setCourseName(e.target.value)} />
        </label>
        <label className="text-xs text-slate-400 space-y-1">ระดับชั้น/ห้อง
          <input className={inputCls} value={level} maxLength={40} placeholder="เช่น ม.5/8" onChange={e => setLevel(e.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div className="text-xs text-slate-400 space-y-1">วันที่สังเกต *
            <DatePicker value={observedDate} onChange={setObservedDate} ariaLabel="วันที่สังเกตการสอน" />
          </div>
          <div className="text-xs text-slate-400 space-y-1">เวลา
            <TimePicker value={observedTime} onChange={setObservedTime} minuteStep={5} ariaLabel="เวลาสังเกตการสอน" />
          </div>
        </div>
      </div>

      {SUPERVISION_SECTIONS.map(sec => (
        <section key={sec.no} className="space-y-3">
          <h4 className="text-sm font-bold text-cyan-300">หมวด {sec.no} {sec.title}</h4>
          {SUPERVISION_ITEMS.filter(i => i.section === sec.no).map(item => (
            <div key={item.id} className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
              <p className="text-sm text-slate-200 mb-2">{item.label}</p>
              <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label={item.label}>
                {SCORES.map(n => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={scores[item.id] === n}
                    onClick={() => setScores(s => ({ ...s, [item.id]: n }))}
                    className={`py-2 rounded-lg text-sm font-bold border cursor-pointer transition-colors ${
                      scores[item.id] === n
                        ? 'bg-cyan-600 border-cyan-400 text-white'
                        : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-cyan-600'
                    }`}
                  >
                    {n}<span className="block text-[9px] font-normal opacity-80">{SCORE_LABELS[n]}</span>
                  </button>
                ))}
              </div>
              {item.id === 's5_2' && (
                <input className={`${inputCls} mt-2`} placeholder="ระบุวิธีประเมินผลที่ใช้ (ถ้ามี)" value={assessmentMethod} maxLength={300} onChange={e => setAssessmentMethod(e.target.value)} />
              )}
            </div>
          ))}
        </section>
      ))}

      <div className="sticky bottom-0 bg-slate-900/95 border border-cyan-500/30 rounded-lg px-4 py-2 text-sm text-slate-200 flex flex-wrap gap-x-4 gap-y-1">
        <span>ตอบแล้ว {result.answered}/{SUPERVISION_ITEM_COUNT} ข้อ</span>
        <span>คะแนนรวม {result.total}</span>
        {result.complete && <span className="font-bold text-cyan-300">{result.percent}% — {result.band}</span>}
      </div>

      <div className="space-y-3">
        <label className="text-xs text-slate-400 space-y-1 block">จุดเด่น
          <textarea className={inputCls} rows={3} maxLength={2000} value={strengths} onChange={e => setStrengths(e.target.value)} />
        </label>
        <label className="text-xs text-slate-400 space-y-1 block">ข้อควรพัฒนา/ข้อเสนอแนะ
          <textarea className={inputCls} rows={3} maxLength={2000} value={improvements} onChange={e => setImprovements(e.target.value)} />
        </label>
        <label className="text-xs text-slate-400 space-y-1 block">ความเห็นเพิ่มเติม
          <textarea className={inputCls} rows={2} maxLength={2000} value={comment} onChange={e => setComment(e.target.value)} />
        </label>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-slate-400">ภาพประกอบการนิเทศ ({photos.length}/{SUPERVISION_MAX_PHOTOS}) — ถ่ายเฉพาะบรรยากาศการสอน หลีกเลี่ยงใบหน้านักเรียนที่ชัดเจน</p>
        <div className="flex flex-wrap gap-2">
          {photos.map((url, idx) => (
            <div key={url} className="relative w-24 h-24 rounded-lg overflow-hidden border border-slate-700">
              <img src={url} alt={`ภาพนิเทศ ${idx + 1}`} className="w-full h-full object-cover" />
              <button type="button" aria-label="ลบรูป" onClick={() => setPhotos(p => p.filter(u => u !== url))}
                className="absolute top-1 right-1 bg-black/70 rounded-full p-1 text-white cursor-pointer"><X className="w-3 h-3" /></button>
            </div>
          ))}
          {photos.length < SUPERVISION_MAX_PHOTOS && (
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy === 'photo'}
              className="w-24 h-24 rounded-lg border border-dashed border-slate-600 text-slate-400 flex flex-col items-center justify-center text-xs gap-1 hover:border-cyan-500 cursor-pointer">
              {busy === 'photo' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}เพิ่มรูป
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={e => addPhotos(e.target.files)} />
        </div>
      </div>

      {error && <p role="alert" className="text-sm text-amber-300">{error}</p>}

      <div className="flex flex-wrap gap-2 justify-end">
        {existing && (
          <button onClick={removeDraft} disabled={!!busy} className="mr-auto flex items-center gap-1.5 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg cursor-pointer">
            <Trash2 className="w-4 h-4" />ลบฉบับร่าง
          </button>
        )}
        <button onClick={() => save(false)} disabled={!!busy} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded-lg cursor-pointer disabled:opacity-50">
          {busy === 'draft' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}บันทึกฉบับร่าง
        </button>
        <button onClick={() => save(true)} disabled={!!busy} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg cursor-pointer disabled:opacity-50">
          {busy === 'submit' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}ส่งผลการนิเทศ
        </button>
      </div>
    </div>
  );
}
