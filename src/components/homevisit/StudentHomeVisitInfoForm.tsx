import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, CheckCircle2, UserCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import type { Student, StudentHomeVisitInfo, FriendInfo } from '../../types';
import { DatePicker } from '../shared/DatePicker';
import { useStudentHomeVisitInfo } from '../../hooks/useHomeVisitData';
import { saveStudentHomeVisitInfo, getSelfAssessmentRecord, syncSharedToSelfAssessment, subscribeSemesterHealthLogs } from '../../services/firestoreService';
import { useStudentBloodType } from '../../hooks/useStudentBloodType';
import { pickHealthPrefill } from '../../lib/homeVisitHealthPrefill';
import { sharedFromAssessment, sharedFromInfo, fillMissing, emptyShared, type SharedFields, type LegacyHints } from '../../lib/homeVisitShared';
import {
  normalizeStudentInfo, validateStudentInfo, ageFromBirthDate, bodyShapeFromBmi,
  PREV_EDUCATION_LEVELS, BLOOD_TYPES, CLOSEST_FAMILY, CONSULT_OPTIONS, LIVES_WITH, COMMUTE_MODES, COMMUTE_DURATIONS,
} from '../../lib/homeVisitData';
import { AddressFields } from './AddressFields';
import { SchoolPicker } from './SchoolPicker';
import { formatThaiAddress, loadThaiAddressData, type ProvinceRef } from '../../lib/thaiAddress';
import { inputCls, Section, Label, SourceTag, Chips, Single, toNum, toggleIn, ErrorList } from './formParts';

/**
 * แบบเก็บข้อมูลเยี่ยมบ้าน — ส่วนที่นักเรียนกรอก (ข้อ 1-3, 9, 10, 11, 17, 18, 20, 24 ของ สพฐ.)
 * ข้อ 11/17/18/20 เติมต้นทางจากแบบประเมินตนเอง 30 ข้อ (เฉพาะค่าที่แมปได้ชัดเจน) นักเรียนยืนยัน/แก้ได้
 * ข้อมูลที่ระบบมีอยู่แล้ว (ชื่อ เลขประจำตัว ห้อง ที่อยู่ ระยะทาง) แสดงอ่านอย่างเดียว ไม่ให้กรอกซ้ำ
 */
const Num = ({ v, on, label }: { v: number | null; on: (n: number | null) => void; label: string }) => (
  <div><Label>{label}</Label><input className={inputCls} inputMode="numeric" value={v ?? ''} onChange={e => on(toNum(e.target.value))} /></div>
);

function FriendFields({ title, f, onChange, inSchool }: { title: string; f: FriendInfo; onChange: (f: FriendInfo) => void; inSchool: boolean }) {
  return (
    <div className="bg-black/20 border border-white/5 rounded-xl p-3 space-y-2">
      <div className="text-xs font-bold text-slate-200">{title}</div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <input className={inputCls} placeholder="คำนำหน้า" value={f.title} onChange={e => onChange({ ...f, title: e.target.value })} />
        <input className={inputCls} placeholder="ชื่อ" value={f.firstName} onChange={e => onChange({ ...f, firstName: e.target.value })} />
        <input className={inputCls} placeholder="นามสกุล" value={f.lastName} onChange={e => onChange({ ...f, lastName: e.target.value })} />
        <input className={inputCls} placeholder="ชื่อเล่น" value={f.nickname} onChange={e => onChange({ ...f, nickname: e.target.value })} />
        {inSchool && <input className={inputCls} placeholder="ชั้น/ห้อง (เช่น ม.5/3)" value={f.classRoom} onChange={e => onChange({ ...f, classRoom: e.target.value })} />}
        <input className={inputCls} placeholder="เบอร์โทร" inputMode="tel" value={f.phone} onChange={e => onChange({ ...f, phone: e.target.value })} />
      </div>
    </div>
  );
}

export function StudentHomeVisitInfoForm({ student, studentUid }: { student: Student; studentUid: string }) {
  const todayYmd = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const base = useMemo(() => ({ studentId: student.studentId, studentUid, homeroomClass: student.room || '' }), [student.studentId, studentUid, student.room]);
  const { data: saved, loading } = useStudentHomeVisitInfo(student.studentId);
  const [form, setForm] = useState<StudentHomeVisitInfo>(() => normalizeStudentInfo(null, base));
  const [fromAssessment, setFromAssessment] = useState<{ shared: SharedFields; hints: LegacyHints } | null>(null);
  const [initialised, setInitialised] = useState(false);
  const [provinces, setProvinces] = useState<ProvinceRef[]>([]);
  useEffect(() => { let c = false; loadThaiAddressData().then(d => { if (!c) setProvinces(d.areas); }).catch(() => {}); return () => { c = true; }; }, []);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // ค่าร่วมจากแบบประเมินตนเอง (ไม่มี/อ่านไม่ได้ = ไม่เติม) — รอให้อ่านเสร็จก่อนเริ่มฟอร์ม กันเติมช้าทับสิ่งที่พิมพ์
  useEffect(() => {
    let cancelled = false;
    getSelfAssessmentRecord(student.studentId)
      .then(a => { if (!cancelled) setFromAssessment(sharedFromAssessment(a)); })
      .catch(() => { if (!cancelled) setFromAssessment({ shared: emptyShared(), hints: {} }); });
    return () => { cancelled = true; };
  }, [student.studentId]);
  const prefill = fromAssessment ?? { shared: emptyShared(), hints: {} as LegacyHints };

  // เริ่มต้นฟอร์มครั้งเดียว: ใช้เอกสารที่บันทึกไว้ แล้วเติมช่องร่วมที่ยังว่างจากแบบประเมินตนเอง (ไม่ทับค่าที่กรอกแล้ว)
  useEffect(() => {
    if (loading || initialised || !fromAssessment) return;
    const norm = normalizeStudentInfo(saved, base);
    const merged = fillMissing(sharedFromInfo(norm), fromAssessment.shared);
    norm.livesWith = merged.livesWith; norm.commuteMode = merged.commuteMode; norm.commuteDuration = merged.commuteDuration; norm.consultWho = merged.consultWho;
    setForm(norm); setInitialised(true);
  }, [loading, saved, fromAssessment, base, initialised]);

  // ข้อ 3: ดึงจากข้อมูลสุขภาพที่บันทึกไว้แล้ว — หมู่เลือด (ล็อก ไม่ให้แก้ในแบบนี้) และน้ำหนัก/ส่วนสูงล่าสุดของภาคเรียน (เติมเฉพาะช่องที่ยังว่าง)
  const { doc: bloodDoc } = useStudentBloodType(student.studentId);
  const [latestLog, setLatestLog] = useState<{ weight: number; height: number; recordedAt: string } | null>(null);
  useEffect(() => subscribeSemesterHealthLogs((logs) => {
    const last = [...logs].sort((a, b) => (a.recordedAt || '').localeCompare(b.recordedAt || '')).pop();
    setLatestLog(last ? { weight: last.weight, height: last.height, recordedAt: last.recordedAt } : null);
  }, { studentId: student.studentId }), [student.studentId]);
  const bloodLocked = !!bloodDoc;
  useEffect(() => {
    if (!initialised) return;
    setForm(f => {
      const next = pickHealthPrefill(f, { bloodType: bloodDoc?.bloodType ?? null, latest: latestLog });
      return next === f ? f : next;
    });
  }, [initialised, bloodDoc, latestLog]);

  const set = <K extends keyof StudentHomeVisitInfo>(k: K, v: StudentHomeVisitInfo[K]) => setForm(f => ({ ...f, [k]: v }));
  const sib = (k: keyof StudentHomeVisitInfo['siblings'], v: any) => setForm(f => ({ ...f, siblings: { ...f.siblings, [k]: v } }));
  const age = form.birthDate ? ageFromBirthDate(form.birthDate, todayYmd) : null;
  const shape = bodyShapeFromBmi(form.weightKg, form.heightCm);
  const centralAddress = (student.homeLocation?.address || '').trim();
  const address = centralAddress || formatThaiAddress(form.currentAddress);

  const save = async () => {
    const errs = validateStudentInfo(form, { centralAddress });
    setErrors(errs); setMsg(null);
    if (errs.length) return;
    setSaving(true);
    try { await saveStudentHomeVisitInfo({ ...form, ...base });
      // แชร์ค่าร่วมไปเติมแบบประเมินตนเอง (เฉพาะช่องที่ยังว่าง) — ล้มเหลวไม่ทำให้การบันทึกหลักล้ม
      try { await syncSharedToSelfAssessment(base, sharedFromInfo(form)); } catch (e) { console.warn('[StudentHomeVisitInfoForm] sync to self-assessment failed', e); }
      setMsg({ ok: true, text: 'บันทึกข้อมูลแล้ว ครูที่ปรึกษาจะเห็นข้อมูลนี้ตอนเยี่ยมบ้าน' }); }
    catch (e) { console.warn('[StudentHomeVisitInfoForm] save failed', e); setMsg({ ok: false, text: 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง (ข้อมูลที่กรอกยังอยู่)' }); }
    finally { setSaving(false); }
  };

  if (!initialised) return <div className="p-6 text-sm text-slate-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> กำลังโหลด…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-white flex items-center gap-2"><UserCircle2 className="w-5 h-5 text-sky-400" /> ข้อมูลของฉัน (สำหรับการเยี่ยมบ้าน)</h2>
        <p className="text-xs text-slate-400 mt-1">กรอกตามความจริง ข้อมูลนี้ใช้ประกอบแบบเก็บข้อมูลเยี่ยมบ้านของโรงเรียน เห็นเฉพาะครูที่ปรึกษาและผู้บริหาร ช่องที่มี * ต้องกรอก ถ้าไม่ทราบให้ใส่ -</p>
      </div>

      <Section title="ข้อมูลที่ระบบมีอยู่แล้ว" hint="แก้ไขได้ที่ครูที่ปรึกษา/ผู้ดูแลระบบ">
        <div className="bg-black/20 border border-white/5 rounded-xl p-3 text-xs text-slate-300 space-y-1">
          <div className="flex items-center gap-2"><SourceTag source="SYSTEM" /> {student.name} · เลขประจำตัว {student.studentId} · ห้อง {student.room || '-'} · เลขที่ {student.studentNo || '-'}</div>
          <div><span className="text-slate-500">ที่อยู่ปัจจุบัน:</span> {address || 'ยังไม่มีในทะเบียน'}</div>
        </div>
      </Section>

      {/* ทะเบียนส่วนกลางยังไม่มีที่อยู่ → ให้นักเรียนกรอกเอง (มีแล้วไม่ต้องกรอก) */}
      {!centralAddress && (
        <Section title="ที่อยู่ปัจจุบัน" hint="ระบบส่วนกลางยังไม่มีที่อยู่ของนักเรียน กรุณากรอก — เลือกจังหวัด อำเภอ ตำบล แล้วรหัสไปรษณีย์จะเติมให้">
          <AddressFields value={form.currentAddress} onChange={a => set('currentAddress', a)} />
        </Section>
      )}

      <Section title="ข้อ 1 ข้อมูลพื้นฐาน">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div><Label required>เพศ</Label><Single options={['ชาย', 'หญิง']} value={form.gender === 'M' ? 'ชาย' : form.gender === 'F' ? 'หญิง' : ''} onPick={o => set('gender', o === 'ชาย' ? 'M' : 'F')} /></div>
          <div><Label required>วัน/เดือน/ปีเกิด</Label><DatePicker yearFirst value={form.birthDate} onChange={v => set("birthDate", v)} max={todayYmd} ariaLabel="วันเกิด" /></div>
          <div><Label>อายุ (ระบบคำนวณ)</Label><div className="text-sm text-slate-200 py-2">{age ? `${age.years} ปี ${age.months} เดือน` : '-'}</div></div>
          <div><Label required>สัญชาติ</Label><input className={inputCls} value={form.nationality} onChange={e => set('nationality', e.target.value)} placeholder="เช่น ไทย" /></div>
          <div><Label required>เชื้อชาติ</Label><input className={inputCls} value={form.ethnicity} onChange={e => set('ethnicity', e.target.value)} placeholder="เช่น ไทย" /></div>
          <div><Label required>ศาสนา</Label><input className={inputCls} value={form.religion} onChange={e => set('religion', e.target.value)} placeholder="เช่น พุทธ" /></div>
        </div>
      </Section>

      <Section title="ข้อ 2 ประวัติการเรียน">
        <SchoolPicker provinces={provinces} current={form} onPick={patch => setForm(f => ({ ...f, ...patch }))} />
        <div><Label required>จบการศึกษาระดับ</Label><Single options={PREV_EDUCATION_LEVELS} value={form.prevEducationLevel} onPick={o => set('prevEducationLevel', o)} /></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><Label>ผลการเรียนรวมเฉลี่ย</Label><input className={inputCls} inputMode="decimal" value={form.prevGpa} onChange={e => set('prevGpa', e.target.value)} placeholder="เช่น 3.25" /></div>
          <div><Label required>จากโรงเรียน</Label><input className={inputCls} value={form.prevSchool} onChange={e => setForm(f => ({ ...f, prevSchool: e.target.value, prevSchoolMoeCode: '' }))} /></div>
          <div><Label>สังกัด</Label><input className={inputCls} value={form.prevAffiliation} onChange={e => set('prevAffiliation', e.target.value)} placeholder="เช่น สพม., เอกชน" /></div>
          <div><Label>โทรศัพท์โรงเรียน</Label><input className={inputCls} inputMode="tel" value={form.prevPhone} onChange={e => set('prevPhone', e.target.value)} /></div>
          <div><Label>ตำบล/แขวง</Label><input className={inputCls} value={form.prevSubdistrict} onChange={e => set('prevSubdistrict', e.target.value)} /></div>
          <div><Label>อำเภอ/เขต</Label><input className={inputCls} value={form.prevDistrict} onChange={e => set('prevDistrict', e.target.value)} /></div>
          <div><Label>จังหวัด</Label><input className={inputCls} value={form.prevProvince} onChange={e => set('prevProvince', e.target.value)} /></div>
        </div>
      </Section>

      <Section title="ข้อ 3 ข้อมูลสุขภาพ">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Num label="น้ำหนัก (กก.)" v={form.weightKg} on={n => set('weightKg', n)} />
          <Num label="ส่วนสูง (ซม.)" v={form.heightCm} on={n => set('heightCm', n)} />
          <div><Label>รูปร่าง (ระบบคำนวณจาก BMI)</Label><div className="text-sm text-slate-200 py-2">{shape ? `${shape.label} (BMI ${shape.bmi})` : '-'}</div></div>
          <div><Label>หมู่โลหิต</Label>{bloodLocked
            ? <div className="text-sm text-slate-200 py-2" data-testid="home-visit-blood-locked">{bloodDoc!.bloodType} <span className="text-[10px] text-slate-500">(ดึงจากข้อมูลสุขภาพ แก้ผ่านพยาบาล)</span></div>
            : <Single options={BLOOD_TYPES} value={form.bloodType} onPick={o => set('bloodType', o)} />}</div>
        </div>
        <div>
          <Label required>โรคประจำตัว</Label>
          <Single options={['ไม่มีโรคประจำตัว', 'มีโรคประจำตัว']} value={form.chronicDisease === '' ? 'ไม่มีโรคประจำตัว' : 'มีโรคประจำตัว'} onPick={o => set('chronicDisease', o === 'ไม่มีโรคประจำตัว' ? '' : (form.chronicDisease || ' '))} />
          {form.chronicDisease !== '' && <input className={cn2(inputCls)} placeholder="ระบุโรคประจำตัว" value={form.chronicDisease.trim() === '' ? '' : form.chronicDisease} onChange={e => set('chronicDisease', e.target.value || ' ')} />}
        </div>
      </Section>

      <Section title="ข้อ 4 ที่อยู่ตามทะเบียนบ้าน" hint="ที่อยู่ปัจจุบันใช้ตามทะเบียนนักเรียนด้านบน">
        <label className="flex items-center gap-2 text-xs text-slate-200"><input type="checkbox" checked={form.registeredSameAsCurrent} onChange={e => set('registeredSameAsCurrent', e.target.checked)} /> ที่อยู่ตามทะเบียนบ้านเหมือนที่อยู่ปัจจุบัน</label>
        {!form.registeredSameAsCurrent && (
          <div className="space-y-2" data-testid="registered-address">
            {!form.registeredAddressStructured && form.registeredAddress.trim() && (
              <div className="text-[11px] text-amber-200 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">ข้อมูลเดิม (พิมพ์เอง): {form.registeredAddress} — เลือกที่อยู่จากช่องด้านล่างเพื่อแทนที่ (ไม่บังคับ)</div>
            )}
            <AddressFields value={form.registeredAddressStructured} onChange={a => setForm(f => ({ ...f, registeredAddressStructured: a, registeredAddress: formatThaiAddress(a) }))} />
          </div>
        )}
      </Section>

      <Section title="ข้อ 9 พี่น้องที่อาศัยอยู่ในครัวเรือนเดียวกัน">
        <label className="flex items-center gap-2 text-xs text-slate-200"><input type="checkbox" checked={form.siblings.onlyChild} onChange={e => sib('onlyChild', e.target.checked)} /> เป็นบุตรคนเดียว</label>
        {!form.siblings.onlyChild && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Num label="เป็นบุตรคนที่" v={form.siblings.birthOrder} on={n => sib('birthOrder', n)} />
            <Num label="จากจำนวน (คน)" v={form.siblings.totalSiblings} on={n => sib('totalSiblings', n)} />
            <Num label="พี่/น้องชาย (คน)" v={form.siblings.brothers} on={n => sib('brothers', n)} />
            <Num label="พี่/น้องสาว (คน)" v={form.siblings.sisters} on={n => sib('sisters', n)} />
            <Num label="พี่ต่างบิดา-มารดา (คน)" v={form.siblings.halfOlder} on={n => sib('halfOlder', n)} />
            <Num label="น้องต่างบิดา-มารดา (คน)" v={form.siblings.halfYounger} on={n => sib('halfYounger', n)} />
            <Num label="พี่น้องที่กำลังศึกษา (ไม่นับตัวเอง)" v={form.siblings.studying} on={n => sib('studying', n)} />
          </div>
        )}
      </Section>

      <Section title="ข้อ 10-11 ความสัมพันธ์ในครอบครัว">
        <div><Label required>ในครอบครัวสนิทสนมกับใครมากที่สุด (เลือกได้หลายข้อ)</Label><Chips options={CLOSEST_FAMILY} value={form.closestInFamily} onToggle={o => set('closestInFamily', toggleIn(form.closestInFamily, o))} />
          {form.closestInFamily.includes('อื่น ๆ') && <input className={cn2(inputCls)} placeholder="ระบุ" value={form.closestOther} onChange={e => set('closestOther', e.target.value)} />}</div>
        <div>
          <Label required>เมื่อทุกข์ใจ/มีปัญหา ส่วนใหญ่ปรึกษาใคร (เลือกได้หลายข้อ)</Label>
          {fromAssessment && fromAssessment.shared.consultWho.length > 0 && !saved?.consultWho?.length && <div className="text-[10px] text-sky-300 mb-1">เติมให้จากแบบประเมินตนเองแล้ว ตรวจและแก้ได้</div>}
          <Chips options={CONSULT_OPTIONS} value={form.consultWho} onToggle={o => set('consultWho', toggleIn(form.consultWho, o))} />
          {form.consultWho.includes('Hotline') && <input className={cn2(inputCls)} placeholder="ระบุ Hotline" value={form.consultHotline} onChange={e => set('consultHotline', e.target.value)} />}
          {form.consultWho.includes('อื่น ๆ') && <input className={cn2(inputCls)} placeholder="ระบุ" value={form.consultOther} onChange={e => set('consultOther', e.target.value)} />}
        </div>
      </Section>

      <Section title="ข้อ 17, 18, 20 การพักอาศัยและการเดินทาง" hint="เติมให้จากแบบประเมินตนเองเฉพาะข้อที่ตรงชัดเจน ข้อที่กำกวมให้เลือกเอง">
        <div>
          <Label required>นักเรียนพักอาศัยอยู่กับ (เลือก 1 ข้อ)</Label>
          {prefill.hints.livesWith && !form.livesWith && <div className="text-[10px] text-sky-300 mb-1">แบบประเมินตนเองตอบว่า “{prefill.hints.livesWith}” กรุณาเลือกให้ตรงตัวเลือก</div>}
          <Single options={LIVES_WITH} value={form.livesWith} onPick={o => set('livesWith', o)} />
          {form.livesWith === 'อื่น ๆ' && <input className={cn2(inputCls)} placeholder="ระบุ" value={form.livesWithOther} onChange={e => set('livesWithOther', e.target.value)} />}
        </div>
        <div>
          <Label>การเดินทางมาโรงเรียน</Label>
          {prefill.hints.commuteMode && !form.commuteMode && <div className="text-[10px] text-sky-300 mb-1">แบบประเมินตนเองตอบว่า “{prefill.hints.commuteMode}” กรุณาเลือกให้ตรงตัวเลือก</div>}
          <Single options={COMMUTE_MODES} value={form.commuteMode} onPick={o => set('commuteMode', o)} />
          {form.commuteMode === 'อื่น ๆ' && <input className={cn2(inputCls)} placeholder="ระบุ" value={form.commuteOther} onChange={e => set('commuteOther', e.target.value)} />}
        </div>
        <div>
          <Label>ระยะเวลาเดินทางจากบ้านถึงโรงเรียน</Label>
          {prefill.hints.commuteDuration && !form.commuteDuration && <div className="text-[10px] text-sky-300 mb-1">แบบประเมินตนเองตอบว่า “{prefill.hints.commuteDuration}” กรุณาเลือกให้ตรงตัวเลือก</div>}
          <Single options={COMMUTE_DURATIONS} value={form.commuteDuration} onPick={o => set('commuteDuration', o)} />
        </div>
        <div className="text-[11px] text-slate-500">ระยะทางบ้าน–โรงเรียน (ข้อ 19) ระบบคำนวณจากพิกัดบ้านที่คุณบันทึกไว้ ไม่ต้องกรอก</div>
      </Section>

      <Section title="ข้อ 24 เพื่อนสนิท" hint="ไม่บังคับ — กรอกเท่าที่สะดวก">
        <FriendFields title="เพื่อนสนิทภายในโรงเรียน" f={form.friendsInSchool} onChange={f => set('friendsInSchool', f)} inSchool />
        <FriendFields title="เพื่อนสนิทภายนอกโรงเรียน" f={form.friendsOutside} onChange={f => set('friendsOutside', f)} inSchool={false} />
      </Section>

      <ErrorList errors={errors} />
      {msg && <div role="status" className={msg.ok ? 'bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-xs text-emerald-300 flex items-center gap-2' : 'bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-xs text-rose-300'}>{msg.ok && <CheckCircle2 className="w-4 h-4" />}{msg.text}</div>}
      <button type="button" onClick={save} disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2">
        {saving && <Loader2 className="w-4 h-4 animate-spin" />} {saving ? 'กำลังบันทึก…' : 'บันทึกข้อมูลของฉัน'}
      </button>
    </div>
  );
}

// ช่วยเว้นระยะช่องกรอกที่ตามหลังตัวเลือก
const cn2 = (...c: string[]) => `${c.join(' ')} mt-2`;
