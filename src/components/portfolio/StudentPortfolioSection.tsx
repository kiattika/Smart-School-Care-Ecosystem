import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Award, GraduationCap, Briefcase, HandHeart, Plus, Clock, CheckCircle2, XCircle, Loader2, Camera, Trash2, Paperclip } from 'lucide-react';
import { Student, StudentPortfolioEntry, StudentPortfolioEntryType } from '../../types';
import {
  subscribeStudentPortfolioEntries,
  submitStudentPortfolioEntry,
} from '../../services/firestoreService';
import { compressImage, formatBytes, CompressedImage } from '../../lib/imageCompression';
import { uploadPortfolioPhoto } from '../../services/storageService';

/**
 * ฟอร์ม + รายการแฟ้มสะสมผลงานฝั่งนักเรียน (เขียนเข้า student_portfolio_entries)
 * นักเรียนเห็นของตัวเองทุกสถานะ (รออนุมัติ / อนุมัติแล้ว / ไม่อนุมัติ)
 * ต้องผ่านครูที่ปรึกษาอนุมัติก่อนจึงจะแสดงในแดชบอร์ดวิชาการ / หน้าผู้ปกครอง
 */

const TYPE_META: Record<StudentPortfolioEntryType, { label: string; icon: React.ReactNode; color: string }> = {
  AWARD: { label: 'รางวัล / การแข่งขัน', icon: <Award className="w-4 h-4" />, color: 'text-amber-400' },
  TRAINING: { label: 'การอบรม / อบรมเชิงปฏิบัติการ', icon: <GraduationCap className="w-4 h-4" />, color: 'text-blue-400' },
  INTERNSHIP: { label: 'การฝึกงาน / ฝึกประสบการณ์', icon: <Briefcase className="w-4 h-4" />, color: 'text-purple-400' },
  VOLUNTEER: { label: 'จิตอาสา / บำเพ็ญประโยชน์', icon: <HandHeart className="w-4 h-4" />, color: 'text-emerald-400' },
};

const STATUS_META: Record<StudentPortfolioEntry['status'], { label: string; cls: string; icon: React.ReactNode }> = {
  PENDING: { label: 'รอครูที่ปรึกษาอนุมัติ', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/30', icon: <Clock className="w-3.5 h-3.5" /> },
  APPROVED: { label: 'อนุมัติแล้ว', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  REJECTED: { label: 'ไม่อนุมัติ', cls: 'bg-red-500/10 text-red-400 border-red-500/30', icon: <XCircle className="w-3.5 h-3.5" /> },
};

export function StudentPortfolioSection({ student, studentUid }: { student: Student; studentUid: string }) {
  const [entries, setEntries] = useState<StudentPortfolioEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [type, setType] = useState<StudentPortfolioEntryType>('AWARD');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [photo, setPhoto] = useState<CompressedImage | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.previewUrl); }, [photo]);

  useEffect(() => {
    if (!studentUid) return;
    setLoading(true);
    const unsub = subscribeStudentPortfolioEntries((list) => {
      setEntries(list);
      setLoading(false);
    }, { studentUid });
    return unsub;
  }, [studentUid]);

  const counts = useMemo(() => ({
    PENDING: entries.filter(e => e.status === 'PENDING').length,
    APPROVED: entries.filter(e => e.status === 'APPROVED').length,
    REJECTED: entries.filter(e => e.status === 'REJECTED').length,
  }), [entries]);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3500); };

  const resetForm = () => {
    setType('AWARD'); setTitle(''); setDescription(''); setEntryDate(new Date().toISOString().slice(0, 10));
    setPhoto(p => { if (p) URL.revokeObjectURL(p.previewUrl); return null; });
    if (fileRef.current) fileRef.current.value = '';
  };

  const onPickPhoto = async (f: File | undefined) => {
    if (!f) return;
    try {
      setPhoto(prev => { if (prev) URL.revokeObjectURL(prev.previewUrl); return null; });
      setPhoto(await compressImage(f));
    } catch (e) {
      flash(e instanceof Error ? e.message : 'ประมวลผลรูปไม่สำเร็จ');
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim() || !entryDate) { flash('กรุณากรอกหัวข้อ รายละเอียด และวันที่ให้ครบ'); return; }
    setSaving(true);
    try {
      let attachmentUrl: string | null = null;
      if (photo) attachmentUrl = await uploadPortfolioPhoto(studentUid, photo.blob);
      await submitStudentPortfolioEntry({
        studentId: student.studentId,
        studentUid,
        homeroomClass: student.room || '',
        parentUid: student.parentUid || null,
        type,
        title: title.trim(),
        description: description.trim(),
        entryDate,
        attachmentUrl,
      });
      resetForm();
      setShowForm(false);
      flash('ส่งรายการแล้ว — รอครูที่ปรึกษาอนุมัติ');
    } catch (err) {
      flash('บันทึกไม่สำเร็จ: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">แฟ้มสะสมผลงานของฉัน</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            บันทึกรางวัล การอบรม การฝึกงาน และงานจิตอาสาด้วยตนเอง — ครูที่ปรึกษาจะตรวจและอนุมัติก่อนแสดงให้ผู้ปกครองเห็น
          </p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shrink-0"
        >
          <Plus className="w-4 h-4" /> เพิ่มรายการ
        </button>
      </div>

      <div className="flex gap-2 text-[11px]">
        <span className="px-2 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30">รออนุมัติ {counts.PENDING}</span>
        <span className="px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">อนุมัติแล้ว {counts.APPROVED}</span>
        <span className="px-2 py-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/30">ไม่อนุมัติ {counts.REJECTED}</span>
      </div>

      {showForm && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(Object.keys(TYPE_META) as StudentPortfolioEntryType[]).map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`px-2.5 py-2 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 transition-colors ${
                  type === t ? 'bg-slate-800 border-indigo-500 text-white' : 'border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className={TYPE_META[t].color}>{TYPE_META[t].icon}</span> {TYPE_META[t].label}
              </button>
            ))}
          </div>
          <input
            value={title} onChange={e => setTitle(e.target.value)} maxLength={160}
            placeholder="หัวข้อ เช่น รางวัลชนะเลิศการแข่งขันคณิตศาสตร์ระดับภาค"
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
          />
          <textarea
            value={description} onChange={e => setDescription(e.target.value)} maxLength={1000} rows={3}
            placeholder="รายละเอียด เช่น จัดโดยหน่วยงานใด บทบาทของนักเรียน ผลที่ได้รับ"
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5"
            >
              <Camera className="w-4 h-4" /> {photo ? 'เปลี่ยนรูป' : 'แนบรูป (ไม่บังคับ)'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => onPickPhoto(e.target.files?.[0] || undefined)} />
            {photo && (
              <div className="relative">
                <img src={photo.previewUrl} alt="แนบ" className="w-16 h-16 object-cover rounded-lg border border-slate-700" />
                <button
                  type="button"
                  onClick={() => setPhoto(p => { if (p) URL.revokeObjectURL(p.previewUrl); return null; })}
                  className="absolute -top-1.5 -right-1.5 bg-slate-900 border border-slate-700 rounded-md p-0.5 text-red-400"
                ><Trash2 className="w-3 h-3" /></button>
                <span className="absolute bottom-0 inset-x-0 bg-black/70 text-[8px] text-emerald-400 text-center rounded-b-lg">{formatBytes(photo.bytesAfter)}</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs text-slate-400 flex items-center gap-2">
              วันที่เกิดกิจกรรม
              <input
                type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
              />
            </label>
            <div className="flex-1" />
            <button onClick={() => { setShowForm(false); resetForm(); }} className="px-3 py-2 text-xs font-bold text-slate-400 hover:text-slate-200">ยกเลิก</button>
            <button
              onClick={handleSubmit} disabled={saving}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} ส่งให้ครูที่ปรึกษา
            </button>
          </div>
          <p className="text-[10px] text-slate-500">รูปจะถูกย่อ/บีบอัดในเครื่องก่อนอัปโหลด (ด้านยาว ≤ 1280px)</p>
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-slate-500 text-sm flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> กำลังโหลด…
        </div>
      ) : entries.length === 0 ? (
        <div className="py-10 text-center text-slate-500 text-sm border border-dashed border-slate-800 rounded-xl">
          ยังไม่มีรายการแฟ้มสะสมผลงาน — กด “เพิ่มรายการ” เพื่อเริ่มบันทึก
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map(e => {
            const tm = TYPE_META[e.type];
            const sm = STATUS_META[e.status];
            return (
              <div key={e.id} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <span className={`mt-0.5 ${tm.color}`}>{tm.icon}</span>
                    <div>
                      <div className="text-sm font-bold text-white">{e.title}</div>
                      <div className="text-[11px] text-slate-400">{tm.label} · {e.entryDate}</div>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-lg border text-[10px] font-bold flex items-center gap-1 ${sm.cls}`}>
                    {sm.icon} {sm.label}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-2 whitespace-pre-wrap">{e.description}</p>
                {e.attachmentUrl && (
                  <a href={e.attachmentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-2 text-[11px] text-blue-400">
                    <Paperclip className="w-3 h-3" />
                    <img src={e.attachmentUrl} alt="แนบ" className="w-14 h-14 object-cover rounded border border-slate-700" />
                  </a>
                )}
                {e.status === 'REJECTED' && e.rejectReason && (
                  <p className="text-[11px] text-red-400 mt-2 bg-red-950/20 rounded-lg px-2 py-1.5">
                    เหตุผลที่ไม่อนุมัติ: {e.rejectReason}
                  </p>
                )}
                {e.status === 'APPROVED' && e.reviewedByName && (
                  <p className="text-[10px] text-slate-500 mt-2">อนุมัติโดย {e.reviewedByName}{e.reviewedAt ? ` · ${new Date(e.reviewedAt).toLocaleDateString('th-TH')}` : ''}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-800 border border-slate-700 text-slate-100 text-sm font-medium px-4 py-2.5 rounded-xl shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  );
}
