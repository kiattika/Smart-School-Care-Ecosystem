import React, { useRef, useState } from 'react';
import { formatThaiAddress } from '../../lib/thaiAddress';
import { X, ClipboardList, MapPin, Camera, Loader2, CheckCircle2 } from 'lucide-react';
import type { Student, StudentHomeLocation, HomeVisitRecord, StudentHomeVisitInfo, FamilyHomeVisitInfo } from '../../types';
import { DatePicker } from '../shared/DatePicker';
import { cn } from '../../lib/utils';
import { compressImage, CompressedImage } from '../../lib/imageCompression';
import { uploadHomeVisitPhoto } from '../../services/storageService';
import { saveHomeVisitRecord } from '../../services/firestoreService';
import { calculateHaversineDistance, formatDistance } from '../../utils/geoUtils';
import {
  HomeVisitFormState, emptyHomeVisitForm, formFromRecord, validateHomeVisitForm, buildHomeVisitRecord,
} from '../../lib/homeVisitForm';
import {
  DISADVANTAGE_OPTIONS, DISABILITY_OPTIONS, HOUSE_TYPES, DISTANCE_BRACKETS, distanceBracketFromMeters, SIGNING_PURPOSE_TEXT,
} from '../../lib/homeVisitData';
import { HomeVisitInfoPanel } from './HomeVisitInfoPanel';
import { inputCls, Section, Label, SourceTag, Chips, Single, toggleIn, ErrorList } from './formParts';

/** ระยะห่างจากพิกัดบ้านที่ถือว่า "อยู่ที่บ้านนักเรียนจริง" ตอนยืนยัน GPS (เมตร) */
const GPS_VERIFY_RADIUS_M = 100;
const MAX_EXTRA_PHOTOS = 4;

interface Props {
  student: Student;
  location?: StudentHomeLocation;
  distanceFromSchoolM: number | null;
  existing?: HomeVisitRecord;
  studentInfo: StudentHomeVisitInfo | null;
  familyInfo: FamilyHomeVisitInfo | null;
  homeroomClass: string;
  advisor: { uid: string; name: string; position: string };
  todayYmd: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}

type SlotKey = 'exterior' | 'interior' | 'extra';

export function HomeVisitFormModal({ student, location, distanceFromSchoolM, existing, studentInfo, familyInfo, homeroomClass, advisor, todayYmd, onClose, onSaved }: Props) {
  const [form, setForm] = useState<HomeVisitFormState>(() => {
    if (existing) return formFromRecord(existing, todayYmd);
    const f = emptyHomeVisitForm(todayYmd, { name: advisor.name, position: advisor.position });
    // ข้อ 19: ระยะทางคำนวณจากพิกัดบ้านที่นักเรียนบันทึก (ครูแก้ได้หากพิกัดคลาดเคลื่อน)
    f.distanceBracket = distanceBracketFromMeters(distanceFromSchoolM);
    return f;
  });
  const [pending, setPending] = useState<Record<SlotKey, CompressedImage[]>>({ exterior: [], interior: [], extra: [] });
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const fileRefs = { exterior: useRef<HTMLInputElement>(null), interior: useRef<HTMLInputElement>(null), extra: useRef<HTMLInputElement>(null) };
  const set = <K extends keyof HomeVisitFormState>(k: K, v: HomeVisitFormState[K]) => setForm(f => ({ ...f, [k]: v }));
  // ทะเบียนส่วนกลางก่อน; ไม่มี → ที่อยู่ที่นักเรียนกรอกแบบแยกช่อง
  const address = student.homeLocation?.address || (student as any).address || formatThaiAddress(studentInfo?.currentAddress);
  const distanceAuto = distanceBracketFromMeters(distanceFromSchoolM);

  const checkGps = () => {
    if (!navigator.geolocation) { setGpsError('เบราว์เซอร์นี้ไม่รองรับ GPS'); return; }
    setGpsBusy(true); setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        const dist = location ? calculateHaversineDistance(here, { latitude: location.latitude, longitude: location.longitude }) : null;
        set('visitGps', { ...here, accuracy: Math.round(pos.coords.accuracy), distanceFromHomeM: dist });
        setGpsBusy(false);
      },
      () => { setGpsError('อ่านพิกัดไม่ได้ — อนุญาตการเข้าถึงตำแหน่งแล้วลองใหม่'); setGpsBusy(false); },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  };

  const addPhotos = async (slot: SlotKey, files: FileList | null) => {
    if (!files) return;
    const room = slot === 'extra' ? Math.max(0, MAX_EXTRA_PHOTOS - form.extraPhotoUrls.length - pending.extra.length) : 1;
    const next: CompressedImage[] = [];
    for (const f of Array.from(files).slice(0, room)) {
      try { next.push(await compressImage(f)); } catch { /* ข้ามไฟล์ที่อ่านไม่ได้ */ }
    }
    setPending(p => ({ ...p, [slot]: slot === 'extra' ? [...p.extra, ...next] : next }));
    const ref = fileRefs[slot].current; if (ref) ref.value = '';
  };
  const dropPending = (slot: SlotKey, i: number) => {
    URL.revokeObjectURL(pending[slot][i].previewUrl);
    setPending(p => ({ ...p, [slot]: p[slot].filter((_, j) => j !== i) }));
  };

  const gpsOk = form.visitGps?.distanceFromHomeM != null && form.visitGps.distanceFromHomeM <= GPS_VERIFY_RADIUS_M;

  const handleSave = async () => {
    // รูปที่ยังไม่อัปโหลดนับเป็นรูปที่แนบแล้วตอนตรวจ
    const probe = { ...form, exteriorPhotoUrl: form.exteriorPhotoUrl || (pending.exterior[0] ? 'pending' : '') };
    const errs = validateHomeVisitForm(probe);
    setErrors(errs);
    if (errs.length) return;
    setSaving(true); setSaveError(null);
    let stage: 'upload' | 'save' = 'upload';
    try {
      const up = async (c?: CompressedImage) => (c ? uploadHomeVisitPhoto(advisor.uid, c.blob) : '');
      const exteriorPhotoUrl = pending.exterior[0] ? await up(pending.exterior[0]) : form.exteriorPhotoUrl;
      const interiorPhotoUrl = pending.interior[0] ? await up(pending.interior[0]) : form.interiorPhotoUrl;
      const extraNew: string[] = [];
      for (const c of pending.extra) extraNew.push(await up(c));
      stage = 'save';
      const rec = buildHomeVisitRecord({
        form: { ...form, exteriorPhotoUrl, interiorPhotoUrl, extraPhotoUrls: [...form.extraPhotoUrls, ...extraNew] },
        studentId: student.studentId, studentUid: student.studentUid, homeroomClass,
        advisorUid: advisor.uid, existing, nowIso: new Date().toISOString(),
      });
      await saveHomeVisitRecord(rec);
      ([...pending.exterior, ...pending.interior, ...pending.extra] as CompressedImage[]).forEach(p => URL.revokeObjectURL(p.previewUrl));
      onSaved(`บันทึกการเยี่ยมบ้าน ${student.name} แล้ว`);
    } catch (e) {
      console.warn('[HomeVisitFormModal] save failed at', stage, e);
      const code = (e as { code?: string })?.code || (e as Error)?.message || 'unknown';
      setSaveError(stage === 'upload'
        ? `อัปโหลดรูปไม่สำเร็จ (${code}) — ตรวจว่า deploy storage.rules แล้วและรูปไม่เกิน 5MB จากนั้นลองใหม่ (ข้อมูลที่กรอกยังอยู่)`
        : `บันทึกข้อมูลไม่สำเร็จ (${code}) — ตรวจสิทธิ์ครูที่ปรึกษาห้อง ${homeroomClass || '-'} และว่า deploy firestore.rules แล้ว จากนั้นลองใหม่ (ข้อมูลที่กรอกยังอยู่)`);
    } finally { setSaving(false); }
  };

  const risk = [['LOW', 'ปกติ', 'emerald'], ['MEDIUM', 'เฝ้าระวัง', 'amber'], ['HIGH', 'เสี่ยงสูง', 'rose']] as const;

  const photoSlot = ({ slot, label, url, required }: { slot: SlotKey; label: string; url: string; required?: boolean }) => {
    const p = pending[slot][0];
    const shown = p?.previewUrl || url;
    return (
      <div className="space-y-1" key={slot}>
        <Label required={required}>{label}</Label>
        <div className="relative w-28 h-28">
          {shown ? (
            <>
              <img src={shown} alt={label} className="w-28 h-28 object-cover rounded-lg border border-white/10" />
              <button type="button" aria-label="ลบรูป" onClick={() => { if (p) dropPending(slot, 0); else set(slot === 'exterior' ? 'exteriorPhotoUrl' : 'interiorPhotoUrl', ''); }} className="absolute -top-1.5 -right-1.5 bg-rose-600 rounded-full p-0.5"><X className="w-3 h-3 text-white" /></button>
            </>
          ) : (
            <button type="button" onClick={() => fileRefs[slot].current?.click()} className="w-28 h-28 rounded-lg border border-dashed border-white/20 text-slate-400 hover:text-white flex flex-col items-center justify-center gap-1 text-[10px]"><Camera className="w-5 h-5" />ถ่าย/เลือกรูป</button>
          )}
          <input ref={fileRefs[slot]} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => addPhotos(slot, e.target.files)} />
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-2 sm:p-6">
      <div className="bg-[#1c1f2b] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[94vh] overflow-y-auto shadow-2xl">
        <div className="p-4 border-b border-white/10 flex justify-between items-center sticky top-0 bg-[#1c1f2b]/95 backdrop-blur z-10">
          <h2 className="font-bold text-white flex items-center gap-2 text-sm sm:text-base"><ClipboardList className="w-5 h-5 text-emerald-400" /> บันทึกการเยี่ยมบ้าน: {student.name}</h2>
          <button onClick={onClose} aria-label="ปิด" className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-6">
          <Section title="ข้อมูลที่ระบบและผู้ปกครอง/นักเรียนกรอกไว้แล้ว" hint="ตรวจทานก่อนลงบันทึก หากไม่ตรงความจริงให้จดไว้ในช่อง “แก้ไขข้อมูล” ด้านล่าง">
            <div className="bg-black/20 border border-white/5 rounded-xl p-3 text-xs text-slate-300 space-y-1">
              <div className="flex items-center gap-2"><SourceTag source="SYSTEM" /> {student.name} · เลขประจำตัว {student.studentId} · ห้อง {student.room || '-'} · เลขที่ {student.studentNo || '-'}</div>
              <div><span className="text-slate-500">ที่อยู่ปัจจุบัน:</span> {address || 'ยังไม่มีในทะเบียน'}</div>
              <div><span className="text-slate-500">เบอร์ผู้ปกครอง:</span> {student.parentMobile || 'ยังไม่มีในทะเบียน'}</div>
              <div><span className="text-slate-500">ระยะบ้าน–โรงเรียน (ระบบคำนวณจากพิกัด):</span> {distanceFromSchoolM !== null ? `${formatDistance(distanceFromSchoolM)} เส้นตรง · ${distanceAuto}` : 'ยังไม่มีพิกัดบ้านหรือยังไม่ได้ตั้งพิกัดโรงเรียน'}</div>
            </div>
            <HomeVisitInfoPanel student={student} studentInfo={studentInfo} familyInfo={familyInfo} todayYmd={todayYmd} />
          </Section>

          <Section title="ข้อ 5-6 วันที่เยี่ยมบ้าน ความด้อยโอกาส และความพิการ" hint="ข้อมูลที่ครูประเมินจากการเยี่ยมบ้าน">
            <div><Label required>วันที่เยี่ยมบ้าน</Label><div className="max-w-[220px]"><DatePicker value={form.visitedDate} onChange={v => set('visitedDate', v)} max={todayYmd} ariaLabel="วันที่เยี่ยมบ้าน" /></div></div>
            <div><Label required>ประเภทความด้อยโอกาส</Label><Chips options={DISADVANTAGE_OPTIONS} value={form.disadvantage} exclusive={DISADVANTAGE_OPTIONS[0]} onToggle={o => set('disadvantage', toggleIn(form.disadvantage, o, DISADVANTAGE_OPTIONS[0]))} /></div>
            <div><Label required>ประเภทความพิการ</Label><Chips options={DISABILITY_OPTIONS} value={form.disability} exclusive={DISABILITY_OPTIONS[0]} onToggle={o => set('disability', toggleIn(form.disability, o, DISABILITY_OPTIONS[0]))} /></div>
          </Section>

          <Section title="ข้อ 12 ภาพถ่ายและลักษณะที่อยู่อาศัย">
            <div className="flex flex-wrap gap-4">
              {photoSlot({ slot: "exterior", label: "รูปที่ 1 ภายนอกที่พักอาศัย", url: form.exteriorPhotoUrl, required: true })}
              {photoSlot({ slot: "interior", label: "รูปที่ 2 ภายในที่พักอาศัย (ถ้ามี)", url: form.interiorPhotoUrl })}
            </div>
            <div>
              <Label>รูปเพิ่มเติม (สูงสุด {MAX_EXTRA_PHOTOS} รูป)</Label>
              <div className="flex flex-wrap gap-2">
                {form.extraPhotoUrls.map((u, i) => (
                  <div key={u} className="relative"><img src={u} alt="" className="w-20 h-20 object-cover rounded-lg border border-white/10" />
                    <button type="button" aria-label="ลบรูป" onClick={() => set('extraPhotoUrls', form.extraPhotoUrls.filter((_, j) => j !== i))} className="absolute -top-1.5 -right-1.5 bg-rose-600 rounded-full p-0.5"><X className="w-3 h-3 text-white" /></button></div>
                ))}
                {pending.extra.map((p, i) => (
                  <div key={p.previewUrl} className="relative"><img src={p.previewUrl} alt="" className="w-20 h-20 object-cover rounded-lg border border-indigo-400/50" />
                    <button type="button" aria-label="ลบรูป" onClick={() => dropPending('extra', i)} className="absolute -top-1.5 -right-1.5 bg-rose-600 rounded-full p-0.5"><X className="w-3 h-3 text-white" /></button></div>
                ))}
                {form.extraPhotoUrls.length + pending.extra.length < MAX_EXTRA_PHOTOS && (
                  <button type="button" onClick={() => fileRefs.extra.current?.click()} className="w-20 h-20 rounded-lg border border-dashed border-white/20 text-slate-400 hover:text-white flex flex-col items-center justify-center gap-1 text-[10px]"><Camera className="w-5 h-5" />เพิ่มรูป</button>
                )}
                <input ref={fileRefs.extra} type="file" accept="image/*" multiple className="hidden" onChange={e => addPhotos('extra', e.target.files)} />
              </div>
            </div>
            <div><Label>หมายเหตุเกี่ยวกับรูป / เหตุผลที่ถ่ายรูปไม่ได้</Label><input className={inputCls} value={form.photoNote} onChange={e => set('photoNote', e.target.value)} /></div>
            <div><Label required>ลักษณะกายภาพของบ้าน</Label><Single options={HOUSE_TYPES} value={form.houseType} onPick={o => set('houseType', o)} />
              {form.houseType === 'อื่น ๆ' && <input className={inputCls + ' mt-2'} placeholder="ระบุ" value={form.houseTypeOther} onChange={e => set('houseTypeOther', e.target.value)} />}</div>
          </Section>

          <Section title="ข้อ 14, 19, 21 ระยะทางและการเดินทาง">
            <div>
              <Label required>ข้อ 19 ระยะทางจากบ้านถึงโรงเรียน</Label>
              {distanceAuto && <div className="text-[10px] text-sky-300 mb-1">ระบบคำนวณจากพิกัดบ้านได้ “{distanceAuto}” แก้ได้หากพิกัดคลาดเคลื่อน</div>}
              <Single options={DISTANCE_BRACKETS} value={form.distanceBracket} onPick={o => set('distanceBracket', o)} />
            </div>
            <div>
              <Label required>ข้อ 21 สภาพแวดล้อมระหว่างการเดินทาง</Label>
              <Single options={['ปลอดภัย', 'มีความเสี่ยง']} value={form.travelEnvironment === 'SAFE' ? 'ปลอดภัย' : form.travelEnvironment === 'RISK' ? 'มีความเสี่ยง' : ''} onPick={o => set('travelEnvironment', o === 'ปลอดภัย' ? 'SAFE' : 'RISK')} />
              {form.travelEnvironment === 'RISK' && <input className={inputCls + ' mt-2'} placeholder="ระบุความเสี่ยง เช่น ข้ามแม่น้ำ ทางป่า ถนนไม่มีไฟ" value={form.travelRiskNote} onChange={e => set('travelRiskNote', e.target.value)} />}
            </div>
          </Section>

          <Section title="ข้อ 25-26 ข้อมูลครูที่ปรึกษา และข้อสรุป">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div><Label required>ชื่อ-สกุลครู</Label><input className={inputCls} value={form.advisorName} onChange={e => set('advisorName', e.target.value)} /></div>
              <div><Label required>ตำแหน่ง</Label><input className={inputCls} value={form.advisorPosition} onChange={e => set('advisorPosition', e.target.value)} /></div>
              <div><Label>เบอร์โทร</Label><input className={inputCls} inputMode="tel" value={form.advisorPhone} onChange={e => set('advisorPhone', e.target.value)} /></div>
            </div>
            <div><Label required>สภาพที่น่าเป็นห่วงและความต้องการจำเป็น (ไม่มีให้ใส่ -)</Label><textarea className={cn(inputCls, 'h-20 resize-none')} value={form.concerns} onChange={e => set('concerns', e.target.value)} /></div>
            <div><Label required>ข้อสรุปจากการเยี่ยมบ้าน / แนวทางช่วยเหลือ</Label><textarea className={cn(inputCls, 'h-24 resize-none')} value={form.summary} onChange={e => set('summary', e.target.value)} /></div>
            <div>
              <Label>ระดับความเสี่ยงโดยรวม</Label>
              <div className="grid grid-cols-3 gap-2">{risk.map(([lv, label, c]) => (
                <button type="button" key={lv} onClick={() => set('riskLevel', lv)} aria-pressed={form.riskLevel === lv}
                  className={cn('py-2 rounded-lg border font-bold text-xs', form.riskLevel === lv ? (c === 'emerald' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : c === 'amber' ? 'bg-amber-500/20 border-amber-500 text-amber-400' : 'bg-rose-500/20 border-rose-500 text-rose-400') : 'bg-black/20 border-white/10 text-slate-400 hover:bg-white/5')}>{label}</button>
              ))}</div>
            </div>
            <label className="flex items-center gap-2 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl p-3">
              <input type="checkbox" checked={form.urgentReferral} onChange={e => set('urgentReferral', e.target.checked)} /> ส่งต่อผู้บริหาร/ต้องการความช่วยเหลือเร่งด่วน (เช่น ทุน สภาพจิตใจ)
            </label>
          </Section>

          <Section title="ยืนยันการตรวจข้อมูลและการขอข้อมูล">
            <label className="flex items-start gap-2 text-xs text-slate-200"><input type="checkbox" className="mt-0.5" checked={form.reviewedFamilyData} onChange={e => set('reviewedFamilyData', e.target.checked)} /> ข้าพเจ้าตรวจข้อมูลที่นักเรียน/ผู้ปกครองกรอกแล้ว และสอบถามยืนยันระหว่างเยี่ยมบ้าน</label>
            <div><Label>แก้ไขข้อมูล (กรณีข้อมูลที่กรอกไว้ไม่ตรงความจริง)</Label><textarea className={cn(inputCls, 'h-16 resize-none')} placeholder="เว้นว่างถ้าถูกต้องทั้งหมด" value={form.correctionNotes} onChange={e => set('correctionNotes', e.target.value)} /></div>
            <label className="flex items-start gap-2 text-xs text-slate-200"><input type="checkbox" className="mt-0.5" checked={form.purposeExplained} onChange={e => set('purposeExplained', e.target.checked)} /> <span>{SIGNING_PURPOSE_TEXT}</span></label>
            <div className="bg-black/20 border border-white/5 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-slate-200">ยืนยันตำแหน่งขณะเยี่ยม (ไม่บังคับ)</div>
                  <div className="text-[10px] text-slate-400">อ่านจาก GPS ของอุปกรณ์ เทียบกับพิกัดบ้านที่นักเรียนบันทึก (ผ่านเมื่อห่างไม่เกิน {GPS_VERIFY_RADIUS_M} ม.)</div>
                </div>
                <button type="button" onClick={checkGps} disabled={gpsBusy} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1 shrink-0">
                  {gpsBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />} {form.visitGps ? 'อ่านใหม่' : 'เช็คพิกัด'}
                </button>
              </div>
              {gpsError && <div className="text-xs text-amber-300">{gpsError}</div>}
              {form.visitGps && (
                <div className={cn('text-xs flex items-center gap-1.5', gpsOk ? 'text-emerald-300' : 'text-amber-300')}>
                  {gpsOk && <CheckCircle2 className="w-4 h-4" />}
                  {form.visitGps.distanceFromHomeM == null
                    ? 'บันทึกพิกัดปัจจุบันแล้ว (นักเรียนยังไม่ได้บันทึกพิกัดบ้านจึงเทียบระยะไม่ได้)'
                    : gpsOk ? `อยู่ใกล้พิกัดบ้าน (ห่าง ${form.visitGps.distanceFromHomeM} ม.)` : `ห่างจากพิกัดบ้าน ${formatDistance(form.visitGps.distanceFromHomeM)} — ไม่ผ่านเกณฑ์ ${GPS_VERIFY_RADIUS_M} ม.`}
                </div>
              )}
            </div>
          </Section>

          <ErrorList errors={errors} />
          {saveError && <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-xs text-rose-300">{saveError}</div>}

          <button type="button" onClick={handleSave} disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} {saving ? 'กำลังบันทึก…' : 'บันทึกการเยี่ยมบ้าน'}
          </button>
        </div>
      </div>
    </div>
  );
}
