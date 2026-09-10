import React, { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, CheckCircle2, X, AlertTriangle } from 'lucide-react';
import { Student } from '../../types';
import { compressImage, formatBytes, CompressedImage } from '../../lib/imageCompression';
import { uploadProfilePhoto } from '../../services/storageService';
import { updateStudentPhotoUrl } from '../../services/firestoreService';

/**
 * ให้นักเรียนอัปโหลด/เปลี่ยนรูปโปรไฟล์ของตัวเอง
 *  - บีบอัดรูปฝั่ง browser (lib/imageCompression) แบบเดียวกับพิกัดบ้าน/แฟ้มสะสมผลงาน
 *  - อัปโหลดขึ้น Firebase Storage: student_profile_photos/{studentUid}/...
 *  - เขียน download URL กลับเข้า students/{id}.photoUrl (firestore.rules จำกัดให้เจ้าของแตะได้แค่ field นี้)
 *  - หน้าตัวเอง + หน้าผู้ปกครอง เห็นรูปใหม่ทันที เพราะทั้งคู่ subscribe students ผ่าน useRealStudents()
 */
export function StudentProfilePhotoEditor({
  student,
  studentUid,
  onClose,
}: {
  student: Student;
  studentUid: string;
  onClose: () => void;
}) {
  const [pending, setPending] = useState<CompressedImage | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (pending) URL.revokeObjectURL(pending.previewUrl); }, [pending]);

  const onPick = async (f: File | undefined) => {
    if (!f) return;
    setError(null);
    setDone(false);
    try {
      setPending(prev => { if (prev) URL.revokeObjectURL(prev.previewUrl); return null; });
      setPending(await compressImage(f));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ประมวลผลรูปไม่สำเร็จ');
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSave = async () => {
    if (!pending) return;
    setSaving(true);
    setError(null);
    try {
      const url = await uploadProfilePhoto(studentUid, pending.blob);
      await updateStudentPhotoUrl(student.studentId, url);
      setDone(true);
      setTimeout(onClose, 1200);
    } catch (e) {
      setError('บันทึกไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-4 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Camera className="w-4 h-4 text-indigo-400" /> เปลี่ยนรูปโปรไฟล์
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex flex-col items-center gap-3">
          <img
            src={pending?.previewUrl || student.photoUrl || student.avatar}
            alt={student.name}
            className="w-28 h-28 rounded-2xl object-cover border-2 border-indigo-500 bg-slate-950"
          />
          {pending && (
            <span className="text-[10px] text-slate-400">
              {formatBytes(pending.bytesBefore)} → <span className="text-emerald-400">{formatBytes(pending.bytesAfter)}</span>
            </span>
          )}
          <button
            onClick={() => fileRef.current?.click()}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5"
          >
            <Camera className="w-4 h-4" /> {pending ? 'เลือกรูปอื่น' : 'เลือกรูปจากอุปกรณ์'}
          </button>
          <input
            ref={fileRef} type="file" accept="image/*" capture="user" hidden
            onChange={e => onPick(e.target.files?.[0] || undefined)}
          />
          <p className="text-[10px] text-slate-500 text-center">
            รูปจะถูกย่อ/บีบอัดในเครื่องก่อนอัปโหลด (ด้านยาว ≤ 1280px) — รองรับไฟล์รูปภาพ ไม่เกิน 5MB
          </p>
        </div>

        {error && (
          <p className="text-[11px] text-rose-400 flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" /> {error}
          </p>
        )}
        {done && (
          <p className="text-[11px] text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> เปลี่ยนรูปโปรไฟล์เรียบร้อยแล้ว
          </p>
        )}

        <button
          onClick={handleSave}
          disabled={!pending || saving || done}
          className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          {saving ? 'กำลังบันทึก…' : 'บันทึกรูปโปรไฟล์'}
        </button>
      </div>
    </div>
  );
}
