import React, { useMemo, useRef, useState } from 'react';
import { X, ClipboardList, MapPin, Camera, Loader2, CheckCircle2, Trash2 } from 'lucide-react';
import type { Student, StudentHomeLocation, HomeVisitRecord, HomeVisitPerson } from '../../types';
import { DatePicker } from '../shared/DatePicker';
import { cn } from '../../lib/utils';
import { compressImage, CompressedImage } from '../../lib/imageCompression';
import { uploadHomeVisitPhoto } from '../../services/storageService';
import { saveHomeVisitRecord } from '../../services/firestoreService';
import { calculateHaversineDistance, formatDistance } from '../../utils/geoUtils';
import {
  HomeVisitFormState, emptyHomeVisitForm, formFromRecord, validateHomeVisitForm, buildHomeVisitRecord,
  DISADVANTAGE_OPTIONS, HOUSING_TYPES, COMMUTE_MODES, DISASTER_RISKS, HOUSEHOLD_STATUS, SOCIAL_BEHAVIORS, PERSON_STATUS,
} from '../../lib/homeVisitForm';

/** ระยะห่างจากพิกัดบ้านที่ถือว่า "อยู่ที่บ้านนักเรียนจริง" ตอนยืนยัน GPS (เมตร) */
const GPS_VERIFY_RADIUS_M = 100;

interface Props {
  student: Student;
  location?: StudentHomeLocation;
  distanceFromSchoolM: number | null;
  existing?: HomeVisitRecord;
  homeroomClass: string;
  advisor: { uid: string; name: string };
  todayYmd: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}

const inputCls = 'w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none placeholder:text-slate-600';
const Section = ({ no, title, children }: { no: number; title: string; children: React.ReactNode }) => (
  <section className="space-y-3">
    <h3 className="text-sm font-bold text-indigo-300 border-b border-white/10 pb-1.5">ตอนที่ {no}: {title}</h3>
    {children}
  </section>
);
const Label = ({ children }: { children: React.ReactNode }) => <label className="block text-xs font-semibold text-slate-300 mb-1">{children}</label>;

function Chips({ options, value, onToggle }: { options: string[]; value: string[]; onToggle: (o: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => (
        <button type="button" key={o} onClick={() => onToggle(o)}
          className={cn('px-2.5 py-1 rounded-lg text-xs border transition-colors',
            value.includes(o) ? 'bg-indigo-500/25 border-indigo-400 text-indigo-200' : 'bg-black/20 border-white/10 text-slate-400 hover:bg-white/5')}>
          {o}
        </button>
      ))}
    </div>
  );
}
function Single({ options, value, onPick }: { options: string[]; value: string; onPick: (o: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => (
        <button type="button" key={o} onClick={() => onPick(o)}
          className={cn('px-2.5 py-1 rounded-lg text-xs border transition-colors',
            value === o ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200' : 'bg-black/20 border-white/10 text-slate-400 hover:bg-white/5')}>
          {o}
        </button>
      ))}
    </div>
  );
}
const toNum = (v: string): number | null => (v.trim() === '' || Number.isNaN(Number(v)) ? null : Number(v));
const toggle = (arr: string[], o: string) => (arr.includes(o) ? arr.filter(x => x !== o) : [...arr, o]);

function PersonFields({ title, p, onChange }: { title: string; p: HomeVisitPerson; onChange: (p: HomeVisitPerson) => void }) {
  return (
    <div className="bg-black/20 border border-white/5 rounded-xl p-3 space-y-2">
      <div className="text-xs font-bold text-slate-200">{title}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input className={inputCls} placeholder="ชื่อ-นามสกุล" value={p.name} onChange={e => onChange({ ...p, name: e.target.value })} />
        <input className={inputCls} placeholder="อาชีพ" value={p.occupation} onChange={e => onChange({ ...p, occupation: e.target.value })} />
        <input className={inputCls} placeholder="เบอร์โทร (เช่น 0812345678)" inputMode="tel" value={p.phone} onChange={e => onChange({ ...p, phone: e.target.value })} />
        <select className={inputCls} value={p.status} onChange={e => onChange({ ...p, status: e.target.value })}>
          <option value="">สถานภาพ</option>
          {PERSON_STATUS.map(x => <option key={x} value={x}>{x}</option>)}
        </select>
      </div>
      {title === 'ผู้ปกครอง' && (
        <input className={inputCls} placeholder="ความสัมพันธ์กับนักเรียน (กรณีไม่ใช่บิดา/มารดา)" value={p.relation === 'ผู้ปกครอง' ? '' : p.relation} onChange={e => onChange({ ...p, relation: e.target.value || 'ผู้ปกครอง' })} />
      )}
    </div>
  );
}

export function HomeVisitFormModal({ student, location, distanceFromSchoolM, existing, homeroomClass, advisor, todayYmd, onClose, onSaved }: Props) {
  const [form, setForm] = useState<HomeVisitFormState>(() => {
    if (existing) return formFromRecord(existing, todayYmd);
    const f = emptyHomeVisitForm(todayYmd);
    // เติมเบอร์ผู้ปกครองจากทะเบียนให้ (ครูแก้ได้) — เป็นข้อมูลจริงของนักเรียน
    f.guardian = { ...f.guardian, phone: student.parentMobile || '' };
    if (distanceFromSchoolM !== null) f.commuteDistanceKm = Math.round(distanceFromSchoolM / 100) / 10;
    return f;
  });
  const [pending, setPending] = useState<CompressedImage[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof HomeVisitFormState>(k: K, v: HomeVisitFormState[K]) => setForm(f => ({ ...f, [k]: v }));
  const address = student.homeLocation?.address || (student as any).address || '';

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

  const addPhotos = async (files: FileList | null) => {
    if (!files) return;
    const next: CompressedImage[] = [];
    for (const f of Array.from(files).slice(0, Math.max(0, 6 - form.photoUrls.length - pending.length))) {
      try { next.push(await compressImage(f)); } catch { /* ข้ามไฟล์ที่อ่านไม่ได้ */ }
    }
    setPending(p => [...p, ...next]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const gpsOk = form.visitGps?.distanceFromHomeM != null && form.visitGps.distanceFromHomeM <= GPS_VERIFY_RADIUS_M;

  const handleSave = async () => {
    const errs = validateHomeVisitForm(form);
    setErrors(errs);
    if (errs.length) return;
    setSaving(true); setSaveError(null);
    try {
      const uploaded: string[] = [];
      for (const p of pending) uploaded.push(await uploadHomeVisitPhoto(advisor.uid, p.blob));
      const rec = buildHomeVisitRecord({
        form: { ...form, photoUrls: [...form.photoUrls, ...uploaded] },
        studentId: student.studentId, studentUid: student.studentUid, homeroomClass,
        advisorUid: advisor.uid, advisorName: advisor.name, existing, nowIso: new Date().toISOString(),
      });
      await saveHomeVisitRecord(rec);
      pending.forEach(p => URL.revokeObjectURL(p.previewUrl));
      onSaved(`บันทึกการเยี่ยมบ้าน ${student.name} แล้ว`);
    } catch (e) {
      console.warn('[HomeVisitFormModal] save failed', e);
      setSaveError('บันทึกไม่สำเร็จ — ตรวจสอบการเชื่อมต่อ/สิทธิ์ครูที่ปรึกษาห้องนี้ แล้วลองใหม่ (ข้อมูลที่กรอกยังอยู่)');
    } finally { setSaving(false); }
  };

  const risk = useMemo(() => [['LOW', 'ปกติ', 'emerald'], ['MEDIUM', 'เฝ้าระวัง', 'amber'], ['HIGH', 'เสี่ยงสูง', 'rose']] as const, []);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-2 sm:p-6">
      <div className="bg-[#1c1f2b] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[94vh] overflow-y-auto shadow-2xl">
        <div className="p-4 border-b border-white/10 flex justify-between items-center sticky top-0 bg-[#1c1f2b]/95 backdrop-blur z-10">
          <h2 className="font-bold text-white flex items-center gap-2 text-sm sm:text-base"><ClipboardList className="w-5 h-5 text-emerald-400" /> แบบบันทึกการเยี่ยมบ้านนักเรียน: {student.name}</h2>
          <button onClick={onClose} aria-label="ปิด" className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-6">
          <Section no={1} title="ข้อมูลพื้นฐานนักเรียน">
            <div className="bg-black/20 border border-white/5 rounded-xl p-3 text-xs text-slate-300 space-y-1">
              <div><span className="text-slate-500">ชื่อ:</span> {student.name} · <span className="text-slate-500">เลขประจำตัว:</span> {student.studentId} · <span className="text-slate-500">ห้อง:</span> {student.room || '-'}</div>
              <div><span className="text-slate-500">ที่อยู่:</span> {address || 'ยังไม่มีในทะเบียน'}</div>
              <div><span className="text-slate-500">เบอร์ผู้ปกครอง:</span> {student.parentMobile || 'ยังไม่มีในทะเบียน'}</div>
              <div className="text-[10px] text-slate-500">ข้อมูลส่วนนี้ดึงจากทะเบียนนักเรียน แก้ไขที่เมนูจัดการนักเรียน</div>
            </div>
            <div>
              <Label>วันที่เยี่ยมบ้าน</Label>
              <div className="max-w-[220px]"><DatePicker value={form.visitedDate} onChange={v => set('visitedDate', v)} max={todayYmd} ariaLabel="วันที่เยี่ยมบ้าน" /></div>
            </div>
            <div><Label>ความด้อยโอกาส</Label><Chips options={DISADVANTAGE_OPTIONS} value={form.disadvantage} onToggle={o => set('disadvantage', toggle(form.disadvantage, o))} /></div>
            <div><Label>ความพิการ (ถ้ามี ระบุประเภท/ลักษณะ)</Label><input className={inputCls} placeholder="เว้นว่างถ้าไม่มี" value={form.disability} onChange={e => set('disability', e.target.value)} /></div>
          </Section>

          <Section no={2} title="ข้อมูลบิดา-มารดา ผู้ปกครอง และบุคคลใกล้ชิด">
            <PersonFields title="บิดา" p={form.father} onChange={p => set('father', p)} />
            <PersonFields title="มารดา" p={form.mother} onChange={p => set('mother', p)} />
            <PersonFields title="ผู้ปกครอง" p={form.guardian} onChange={p => set('guardian', p)} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div><Label>จำนวนพี่น้อง (รวมนักเรียน)</Label><input className={inputCls} inputMode="numeric" value={form.siblingsCount ?? ''} onChange={e => set('siblingsCount', toNum(e.target.value))} /></div>
              <div><Label>บุคคลใกล้ชิด/ที่ปรึกษาของนักเรียน</Label><input className={inputCls} value={form.closeAdults} onChange={e => set('closeAdults', e.target.value)} /></div>
            </div>
            <div>
              <Label>ภาพถ่ายการเยี่ยมบ้าน (สูงสุด 6 รูป)</Label>
              <div className="flex flex-wrap gap-2">
                {form.photoUrls.map((u, i) => (
                  <div key={u} className="relative"><img src={u} alt="" className="w-20 h-20 object-cover rounded-lg border border-white/10" />
                    <button type="button" onClick={() => set('photoUrls', form.photoUrls.filter((_, j) => j !== i))} aria-label="ลบรูป" className="absolute -top-1.5 -right-1.5 bg-rose-600 rounded-full p-0.5"><X className="w-3 h-3 text-white" /></button></div>
                ))}
                {pending.map((p, i) => (
                  <div key={p.previewUrl} className="relative"><img src={p.previewUrl} alt="" className="w-20 h-20 object-cover rounded-lg border border-indigo-400/50" />
                    <button type="button" onClick={() => { URL.revokeObjectURL(p.previewUrl); setPending(x => x.filter((_, j) => j !== i)); }} aria-label="ลบรูป" className="absolute -top-1.5 -right-1.5 bg-rose-600 rounded-full p-0.5"><X className="w-3 h-3 text-white" /></button></div>
                ))}
                {form.photoUrls.length + pending.length < 6 && (
                  <button type="button" onClick={() => fileRef.current?.click()} className="w-20 h-20 rounded-lg border border-dashed border-white/20 text-slate-400 hover:text-white flex flex-col items-center justify-center gap-1 text-[10px]"><Camera className="w-5 h-5" />เพิ่มรูป</button>
                )}
                <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => addPhotos(e.target.files)} />
              </div>
            </div>
          </Section>

          <Section no={3} title="สถานะครัวเรือน ที่อยู่อาศัย และการเดินทาง">
            <div><Label>สถานะครัวเรือน</Label><Single options={HOUSEHOLD_STATUS} value={form.householdStatus} onPick={o => set('householdStatus', o)} /></div>
            <div><Label>ลักษณะที่อยู่อาศัย *</Label><Single options={HOUSING_TYPES} value={form.housingType} onPick={o => set('housingType', o)} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>จำนวนสมาชิกในครัวเรือน</Label><input className={inputCls} inputMode="numeric" value={form.householdMembers ?? ''} onChange={e => set('householdMembers', toNum(e.target.value))} /></div>
              <div><Label>ภาระพึ่งพิง (คน)</Label><input className={inputCls} inputMode="numeric" value={form.dependents ?? ''} onChange={e => set('dependents', toNum(e.target.value))} /></div>
            </div>
            <div><Label>การเดินทางไปโรงเรียน *</Label><Single options={COMMUTE_MODES} value={form.commuteMode} onPick={o => set('commuteMode', o)} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>เวลาเดินทาง (นาที)</Label><input className={inputCls} inputMode="numeric" value={form.commuteMinutes ?? ''} onChange={e => set('commuteMinutes', toNum(e.target.value))} /></div>
              <div><Label>ระยะทาง (กม.){distanceFromSchoolM !== null ? ` · เส้นตรง ${formatDistance(distanceFromSchoolM)}` : ''}</Label><input className={inputCls} inputMode="decimal" value={form.commuteDistanceKm ?? ''} onChange={e => set('commuteDistanceKm', toNum(e.target.value))} /></div>
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-slate-200">
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.hasElectricity} onChange={e => set('hasElectricity', e.target.checked)} /> มีไฟฟ้าใช้</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.hasWater} onChange={e => set('hasWater', e.target.checked)} /> มีน้ำประปา/น้ำสะอาดใช้</label>
            </div>
            <div><Label>ความเสี่ยงภัยพิบัติบริเวณที่อยู่อาศัย</Label><Chips options={DISASTER_RISKS} value={form.disasterRisks} onToggle={o => set('disasterRisks', toggle(form.disasterRisks, o))} /></div>
            <div>
              <Label>สภาพแวดล้อมที่พักอาศัย (1 = แย่มาก, 5 = ดีมาก)</Label>
              <div className="flex gap-2">{[1, 2, 3, 4, 5].map(n => (
                <button type="button" key={n} onClick={() => set('environmentRating', n)}
                  className={cn('flex-1 py-2 rounded-lg border font-bold', form.environmentRating === n ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300' : 'bg-black/20 border-white/10 text-slate-400 hover:bg-white/5')}>{n}</button>
              ))}</div>
            </div>
          </Section>

          <Section no={4} title="เพื่อนสนิทและพฤติกรรมทางสังคม">
            <div><Label>เพื่อนสนิท</Label><input className={inputCls} placeholder="ชื่อเพื่อนสนิท (คั่นด้วย ,)" value={form.closeFriends} onChange={e => set('closeFriends', e.target.value)} /></div>
            <div><Label>พฤติกรรมทางสังคมที่พบ</Label><Chips options={SOCIAL_BEHAVIORS} value={form.socialBehaviors} onToggle={o => set('socialBehaviors', toggle(form.socialBehaviors, o))} /></div>
            <div><Label>บันทึกเพิ่มเติม</Label><textarea className={cn(inputCls, 'h-20 resize-none')} value={form.socialNotes} onChange={e => set('socialNotes', e.target.value)} /></div>
          </Section>

          <Section no={5} title="ความคิดเห็นและข้อสรุปของครูที่ปรึกษา">
            <div><Label>ความคิดเห็น/ข้อสรุป *</Label><textarea className={cn(inputCls, 'h-24 resize-none')} placeholder="เช่น สภาพครอบครัว การดูแลเอาใจใส่ของผู้ปกครอง" value={form.teacherOpinion} onChange={e => set('teacherOpinion', e.target.value)} /></div>
            <div><Label>ข้อเสนอแนะ/แนวทางช่วยเหลือ</Label><textarea className={cn(inputCls, 'h-20 resize-none')} value={form.recommendations} onChange={e => set('recommendations', e.target.value)} /></div>
            <div>
              <Label>ระดับความเสี่ยง</Label>
              <div className="grid grid-cols-3 gap-2">{risk.map(([lv, label, c]) => (
                <button type="button" key={lv} onClick={() => set('riskLevel', lv)}
                  className={cn('py-2 rounded-lg border font-bold text-xs', form.riskLevel === lv ? (c === 'emerald' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : c === 'amber' ? 'bg-amber-500/20 border-amber-500 text-amber-400' : 'bg-rose-500/20 border-rose-500 text-rose-400') : 'bg-black/20 border-white/10 text-slate-400 hover:bg-white/5')}>{label}</button>
              ))}</div>
            </div>
            <label className="flex items-center gap-2 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl p-3">
              <input type="checkbox" checked={form.urgentReferral} onChange={e => set('urgentReferral', e.target.checked)} /> ส่งต่อผู้บริหาร/ต้องการความช่วยเหลือเร่งด่วน (เช่น ทุน สภาพจิตใจ)
            </label>
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

          {errors.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-200 space-y-0.5">
              <div className="font-bold">ยังบันทึกไม่ได้ กรุณาแก้:</div>
              {errors.map(e => <div key={e}>• {e}</div>)}
            </div>
          )}
          {saveError && <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-xs text-rose-300">{saveError}</div>}

          <button type="button" onClick={handleSave} disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} {saving ? 'กำลังบันทึก…' : 'บันทึกการเยี่ยมบ้าน'}
          </button>
        </div>
      </div>
    </div>
  );
}
