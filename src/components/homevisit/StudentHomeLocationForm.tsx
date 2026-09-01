import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Crosshair, Camera, Loader2, CheckCircle2, Trash2, AlertTriangle } from 'lucide-react';
import { Student, StudentHomeLocation } from '../../types';
import { compressImage, formatBytes, CompressedImage } from '../../lib/imageCompression';
import { uploadHomePhoto } from '../../services/storageService';
import { saveStudentHomeLocation, subscribeStudentHomeLocation } from '../../services/firestoreService';

/**
 * ฟอร์มให้นักเรียนบันทึกพิกัดบ้าน + ภาพถ่าย (ประกอบการวางแผนออกเยี่ยมบ้านของครูที่ปรึกษา)
 *
 *  - พิกัดต้องมาจาก navigator.geolocation เท่านั้น — ไม่มีช่องกรอกพิกัดเอง
 *  - ต้องแนบภาพอย่างน้อย 1 รูป; รูปถูกบีบอัดฝั่ง browser ก่อนอัปโหลด (ดู lib/imageCompression)
 *  - เขียน student_home_locations/{studentId} (อ่านได้เฉพาะเจ้าของ + ครูที่ปรึกษาห้องนั้น)
 */

interface LocalPhoto {
  compressed: CompressedImage;
}

export function StudentHomeLocationForm({ student, studentUid }: { student: Student; studentUid: string }) {
  const [existing, setExisting] = useState<StudentHomeLocation | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number | null } | null>(null);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [landmark, setLandmark] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!student.studentId) return;
    return subscribeStudentHomeLocation(student.studentId, (loc) => {
      setExisting(loc);
      if (loc && !landmark) setLandmark(loc.landmarkNotes || '');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student.studentId]);

  useEffect(() => () => { photos.forEach(p => URL.revokeObjectURL(p.compressed.previewUrl)); }, [photos]);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 4000); };

  const captureGps = () => {
    setGeoError(null);
    if (!('geolocation' in navigator)) { setGeoError('อุปกรณ์นี้ไม่รองรับการอ่านพิกัด GPS'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy ?? null });
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? 'ไม่ได้รับอนุญาตให้เข้าถึงตำแหน่ง — กรุณาอนุญาตการเข้าถึงตำแหน่งในเบราว์เซอร์ แล้วลองใหม่'
            : 'อ่านพิกัดไม่สำเร็จ กรุณาลองใหม่อีกครั้ง (ควรอยู่ที่บ้านและเปิด GPS)'
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const onPickFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const next: LocalPhoto[] = [];
    for (const f of Array.from(files).slice(0, 6)) {
      try {
        next.push({ compressed: await compressImage(f) });
      } catch (e) {
        flash(e instanceof Error ? e.message : 'ประมวลผลรูปไม่สำเร็จ');
      }
    }
    setPhotos(prev => [...prev, ...next].slice(0, 6));
    if (fileRef.current) fileRef.current.value = '';
  };

  const removePhoto = (i: number) => {
    setPhotos(prev => {
      URL.revokeObjectURL(prev[i].compressed.previewUrl);
      return prev.filter((_, idx) => idx !== i);
    });
  };

  const canSave = !!coords && photos.length >= 1 && !saving;

  const handleSave = async () => {
    if (!coords) { flash('กรุณากดอ่านพิกัด GPS ก่อน'); return; }
    if (photos.length < 1) { flash('กรุณาแนบรูปอย่างน้อย 1 รูป'); return; }
    setSaving(true);
    try {
      const photoUrls: string[] = [];
      for (const p of photos) {
        photoUrls.push(await uploadHomePhoto(studentUid, p.compressed.blob));
      }
      // รวมรูปเดิม (ถ้ามี) เข้าไปด้วย
      const merged = [...(existing?.photoUrls || []), ...photoUrls];
      await saveStudentHomeLocation({
        studentId: student.studentId,
        studentUid,
        homeroomClass: student.room || '',
        latitude: coords.lat,
        longitude: coords.lng,
        accuracy: coords.accuracy,
        capturedAt: new Date().toISOString(),
        photoUrls: merged,
        landmarkNotes: landmark.trim() || null,
      });
      setPhotos([]);
      flash('บันทึกพิกัดบ้านและรูปเรียบร้อยแล้ว');
    } catch (err) {
      flash('บันทึกไม่สำเร็จ: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <MapPin className="w-5 h-5 text-emerald-400" /> พิกัดบ้าน & ภาพถ่าย (สำหรับการเยี่ยมบ้าน)
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          ครูที่ปรึกษาใช้ข้อมูลนี้วางแผนเส้นทางออกเยี่ยมบ้าน — เห็นได้เฉพาะครูที่ปรึกษาห้องของนักเรียนเท่านั้น
        </p>
      </div>

      {existing && (
        <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-xl p-3 text-xs text-emerald-300">
          บันทึกไว้แล้ว: {existing.latitude.toFixed(6)}, {existing.longitude.toFixed(6)}
          {' · '}{existing.photoUrls.length} รูป
          {existing.updatedAt ? ` · อัปเดตล่าสุด ${new Date(existing.updatedAt).toLocaleString('th-TH')}` : ''}
        </div>
      )}

      {/* GPS */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-bold text-white">1. อ่านพิกัดจาก GPS ของอุปกรณ์</div>
          <button
            onClick={captureGps} disabled={locating}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5"
          >
            {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />}
            {locating ? 'กำลังอ่าน…' : coords ? 'อ่านพิกัดใหม่' : 'อ่านพิกัดตอนนี้'}
          </button>
        </div>
        {coords ? (
          <div className="text-xs text-slate-300 font-mono bg-black/30 rounded-lg px-3 py-2">
            {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
            {coords.accuracy != null && <span className="text-slate-500"> · ±{Math.round(coords.accuracy)} ม.</span>}
          </div>
        ) : (
          <p className="text-[11px] text-slate-500">
            ⚠️ ต้องอยู่ที่บ้านและเปิด GPS — ระบบไม่มีช่องกรอกพิกัดเอง เพื่อป้องกันข้อมูลผิดพลาด
          </p>
        )}
        {geoError && (
          <p className="text-[11px] text-red-400 flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" /> {geoError}
          </p>
        )}
      </div>

      {/* Photos */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-bold text-white">2. ภาพถ่าย (อย่างน้อย 1 รูป เช่น หน้าบ้านมองจากถนน)</div>
          <button
            onClick={() => fileRef.current?.click()}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5"
          >
            <Camera className="w-4 h-4" /> เลือกรูป
          </button>
          <input
            ref={fileRef} type="file" accept="image/*" multiple capture="environment" hidden
            onChange={(e) => onPickFiles(e.target.files)}
          />
        </div>
        {photos.length === 0 ? (
          <p className="text-[11px] text-slate-500">รูปจะถูกย่อและบีบอัดในเครื่องก่อนอัปโหลด (ด้านยาว ≤ 1280px, JPEG ~72%)</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {photos.map((p, i) => (
              <div key={i} className="relative group">
                <img src={p.compressed.previewUrl} alt={`รูป ${i + 1}`} className="w-full h-24 object-cover rounded-lg border border-slate-700" />
                <button
                  onClick={() => removePhoto(i)}
                  className="absolute top-1 right-1 bg-black/70 rounded-md p-1 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <div className="absolute bottom-0 inset-x-0 bg-black/70 text-[9px] text-slate-300 text-center py-0.5 rounded-b-lg">
                  {formatBytes(p.compressed.bytesBefore)} → <span className="text-emerald-400">{formatBytes(p.compressed.bytesAfter)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Landmark */}
      <div>
        <label className="text-xs text-slate-400">จุดสังเกตเพิ่มเติม (ไม่บังคับ)</label>
        <input
          value={landmark} onChange={e => setLandmark(e.target.value)} maxLength={300}
          placeholder="เช่น บ้านสีฟ้าตรงข้ามร้านชำ ถัดจากวัด 200 เมตร"
          className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
        />
      </div>

      <button
        onClick={handleSave} disabled={!canSave}
        className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold flex items-center justify-center gap-2"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
        {saving ? 'กำลังบันทึก…' : 'บันทึกพิกัดบ้าน & อัปโหลดรูป'}
      </button>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-800 border border-slate-700 text-slate-100 text-sm font-medium px-4 py-2.5 rounded-xl shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  );
}
