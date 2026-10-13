import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, CheckCircle2, Users } from 'lucide-react';
import type { Student, FamilyHomeVisitInfo, ParentInfo, GuardianInfo } from '../../types';
import { useFamilyHomeVisitInfo } from '../../hooks/useHomeVisitData';
import { saveFamilyHomeVisitInfo } from '../../services/firestoreService';
import {
  normalizeFamilyInfo, validateFamilyInfo, PERSON_HEALTH, PARENTS_STATUS, HOUSING_STATUS, DEPENDENTS, SAFETY_RISKS,
  ELECTRICITY, DRINKING_WATER, DISASTER_RISKS, INCOME_BRACKETS, EDUCATION_LEVELS,
  emptyGuardian, guardianChoiceOf, guardianFromParent, GUARDIAN_RELATION, type GuardianChoice,
} from '../../lib/homeVisitData';
import { inputCls, Section, Label, SourceTag, Chips, Single, toNum, toggleIn, ErrorList } from './formParts';

/**
 * แบบเก็บข้อมูลเยี่ยมบ้าน — ส่วนที่ผู้ปกครองกรอก (ข้อ 7, 8, 13, 15, 16, 22, 23 ของ สพฐ.)
 * ไม่เก็บเลขบัตรประชาชน รายได้เก็บเป็นช่วง เบอร์ผู้ปกครองเติมจากทะเบียนที่แอดมินนำเข้า
 */
const PRESENCE: { v: ParentInfo['presence']; l: string }[] = [
  { v: 'PRESENT', l: 'ปรากฏ/มีชีวิตอยู่' }, { v: 'ABSENT', l: 'ไม่ปรากฏ/ไม่ทราบ' }, { v: 'DECEASED', l: 'เสียชีวิต' },
];

function PersonFields({ label, p, onChange }: { label: string; p: ParentInfo; onChange: (p: ParentInfo) => void }) {
  const present = p.presence === 'PRESENT';
  return (
    <div className="bg-black/20 border border-white/5 rounded-xl p-3 space-y-2">
      <div className="text-xs font-bold text-slate-200">{label}</div>
      <Single options={PRESENCE.map(x => x.l)} value={PRESENCE.find(x => x.v === p.presence)?.l || ''} onPick={o => onChange({ ...p, presence: PRESENCE.find(x => x.l === o)!.v })} />
      {present && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <input className={inputCls} placeholder="คำนำหน้า" value={p.title} onChange={e => onChange({ ...p, title: e.target.value })} />
          <input className={inputCls} placeholder="ชื่อ *" value={p.firstName} onChange={e => onChange({ ...p, firstName: e.target.value })} />
          <input className={inputCls} placeholder="นามสกุล *" value={p.lastName} onChange={e => onChange({ ...p, lastName: e.target.value })} />
          <input className={inputCls} placeholder="อายุ (ปี) *" inputMode="numeric" value={p.age ?? ''} onChange={e => onChange({ ...p, age: toNum(e.target.value) })} />
          <input className={inputCls} placeholder="อาชีพ *" value={p.occupation} onChange={e => onChange({ ...p, occupation: e.target.value })} />
          <input className={inputCls} placeholder="เบอร์โทร" inputMode="tel" value={p.phone} onChange={e => onChange({ ...p, phone: e.target.value })} />
          <div className="col-span-2 sm:col-span-3"><Label>รายได้เฉลี่ยต่อเดือน</Label><Single options={INCOME_BRACKETS} value={p.incomeBracket} onPick={o => onChange({ ...p, incomeBracket: o })} /></div>
          <div className="col-span-2 sm:col-span-3"><Label required>สุขภาพ</Label><Single options={PERSON_HEALTH} value={p.health} onPick={o => onChange({ ...p, health: o })} /></div>
        </div>
      )}
    </div>
  );
}

export function FamilyHomeVisitInfoForm({ student, parentUid }: { student: Student; parentUid: string }) {
  const base = useMemo(() => ({ studentId: student.studentId, studentUid: student.studentUid ?? null, parentUid, homeroomClass: student.room || '' }), [student.studentId, student.studentUid, parentUid, student.room]);
  const { data: saved, loading } = useFamilyHomeVisitInfo(student.studentId);
  const [form, setForm] = useState<FamilyHomeVisitInfo>(() => normalizeFamilyInfo(null, base, student.parentMobile || ''));
  const [initialised, setInitialised] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (loading || initialised) return;
    setForm(normalizeFamilyInfo(saved, base, student.parentMobile || '')); setInitialised(true);
  }, [loading, saved, base, student.parentMobile, initialised]);

  const set = <K extends keyof FamilyHomeVisitInfo>(k: K, v: FamilyHomeVisitInfo[K]) => setForm(f => ({ ...f, [k]: v }));
  const g = form.guardian;
  const setG = (patch: Partial<GuardianInfo>) => setForm(f => ({ ...f, guardian: { ...f.guardian, ...patch } }));

  // ข้อ 13: เลือก บิดา / มารดา / อื่น ๆ — บิดา/มารดาใช้ข้อมูลข้อ 7/8 (ซิงก์อัตโนมัติ) อื่น ๆ ค่อยแสดงฟอร์มกรอกเอง
  const [choice, setChoice] = useState<GuardianChoice>('');
  useEffect(() => { if (initialised) setChoice(guardianChoiceOf(saved?.guardian ?? form.guardian)); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [initialised]);
  useEffect(() => {
    if (choice !== 'FATHER' && choice !== 'MOTHER') return;
    setForm(f => {
      const src = choice === 'FATHER' ? f.father : f.mother;
      const next = guardianFromParent(src, GUARDIAN_RELATION[choice], f.guardian);
      return JSON.stringify(next) === JSON.stringify(f.guardian) ? f : { ...f, guardian: next };
    });
  }, [choice, form.father, form.mother]);
  const pickChoice = (c: GuardianChoice) => {
    if (c === 'OTHER' && choice !== 'OTHER') {
      setForm(f => ({ ...f, guardian: { ...emptyGuardian(), phone: student.parentMobile || '' } }));
    }
    setChoice(c);
  };
  const choiceLabel: Record<Exclude<GuardianChoice, ''>, string> = { FATHER: 'บิดา', MOTHER: 'มารดา', OTHER: 'อื่น ๆ' };

  const save = async () => {
    const errs = validateFamilyInfo(form);
    setErrors(errs); setMsg(null);
    if (errs.length) return;
    setSaving(true);
    try { await saveFamilyHomeVisitInfo({ ...form, ...base }); setMsg({ ok: true, text: 'บันทึกข้อมูลครอบครัวแล้ว ครูที่ปรึกษาจะเห็นข้อมูลนี้ตอนเยี่ยมบ้าน' }); }
    catch (e) { console.warn('[FamilyHomeVisitInfoForm] save failed', e); setMsg({ ok: false, text: 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง (ข้อมูลที่กรอกยังอยู่)' }); }
    finally { setSaving(false); }
  };

  if (loading && !initialised) return <div className="p-6 text-sm text-slate-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> กำลังโหลด…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-white flex items-center gap-2"><Users className="w-5 h-5 text-amber-400" /> ข้อมูลครอบครัว (สำหรับการเยี่ยมบ้าน)</h2>
        <p className="text-xs text-slate-400 mt-1">กรอกเกี่ยวกับ {student.name} ห้อง {student.room || '-'} · ระบบไม่เก็บเลขบัตรประชาชน และเก็บรายได้เป็นช่วง · เห็นเฉพาะครูที่ปรึกษาและผู้บริหาร ช่องที่มี * ต้องกรอก ถ้าไม่ทราบให้ใส่ -</p>
        <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-400"><SourceTag source="SYSTEM" /> เบอร์ผู้ปกครองเติมจากทะเบียนนักเรียน แก้ได้</div>
      </div>

      <Section title="ข้อ 7 ข้อมูลบิดา / ข้อ 8 ข้อมูลมารดา">
        <PersonFields label="บิดา" p={form.father} onChange={p => set('father', p)} />
        <PersonFields label="มารดา" p={form.mother} onChange={p => set('mother', p)} />
        <div>
          <Label required>สถานภาพของบิดา-มารดา</Label>
          <Single options={PARENTS_STATUS} value={form.parentsStatus} onPick={o => set('parentsStatus', o)} />
          {form.parentsStatus === 'อื่น ๆ' && <input className={inputCls + ' mt-2'} placeholder="ระบุ" value={form.parentsStatusOther} onChange={e => set('parentsStatusOther', e.target.value)} />}
        </div>
      </Section>

      <Section title="ข้อ 13 ข้อมูลผู้ปกครอง" hint="ถ้าบิดาหรือมารดาเป็นผู้ปกครอง เลือกได้เลย ระบบใช้ข้อมูลจากข้อ 7/8 ไม่ต้องกรอกซ้ำ">
        <div>
          <Label required>ผู้ปกครองของนักเรียนคือ</Label>
          <Single options={['บิดา', 'มารดา', 'อื่น ๆ']} value={choice ? choiceLabel[choice] : ''} onPick={o => pickChoice(o === 'บิดา' ? 'FATHER' : o === 'มารดา' ? 'MOTHER' : 'OTHER')} />
        </div>
        {(choice === 'FATHER' || choice === 'MOTHER') && (
          <div className="bg-black/20 border border-white/5 rounded-xl p-3 text-xs text-slate-300 space-y-1">
            <div className="font-bold text-slate-200">ใช้ข้อมูล{choiceLabel[choice]}จากด้านบน</div>
            {(choice === 'FATHER' ? form.father : form.mother).presence === 'PRESENT'
              ? <div>{g.title}{g.firstName} {g.lastName} · อายุ {g.age ?? '-'} ปี · {g.occupation || '-'} · โทร {g.phone || '-'}</div>
              : <div className="text-rose-300">{choiceLabel[choice]}มีสถานะไม่ใช่ "ปรากฏ/มีชีวิตอยู่" — เลือกผู้ปกครองใหม่</div>}
            <div className="text-slate-500">ถ้าข้อมูลไม่ถูกต้อง แก้ที่ข้อ 7/8 ด้านบน</div>
          </div>
        )}
        {choice === 'OTHER' && (<>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div className="col-span-2 sm:col-span-3"><Label required>เกี่ยวข้องกับนักเรียนเป็น</Label><input className={inputCls} placeholder="เช่น ป้า, ตา, ยาย" value={g.relation} onChange={e => setG({ relation: e.target.value })} /></div>
            <input className={inputCls} placeholder="คำนำหน้า" value={g.title} onChange={e => setG({ title: e.target.value })} />
            <input className={inputCls} placeholder="ชื่อ *" value={g.firstName} onChange={e => setG({ firstName: e.target.value })} />
            <input className={inputCls} placeholder="นามสกุล *" value={g.lastName} onChange={e => setG({ lastName: e.target.value })} />
            <input className={inputCls} placeholder="อายุ (ปี) *" inputMode="numeric" value={g.age ?? ''} onChange={e => setG({ age: toNum(e.target.value) })} />
            <input className={inputCls} placeholder="อาชีพ *" value={g.occupation} onChange={e => setG({ occupation: e.target.value })} />
            <input className={inputCls} placeholder="เบอร์โทร *" inputMode="tel" value={g.phone} onChange={e => setG({ phone: e.target.value })} />
            <input className={inputCls + ' col-span-2 sm:col-span-3'} placeholder="โรคประจำตัว (ถ้าไม่มีเว้นว่าง)" value={g.chronicDisease} onChange={e => setG({ chronicDisease: e.target.value })} />
          </div>
          <div><Label>ระดับการศึกษา</Label><Single options={EDUCATION_LEVELS} value={g.education} onPick={o => setG({ education: o })} /></div>
          <div><Label>รายได้เฉลี่ยต่อเดือน</Label><Single options={INCOME_BRACKETS} value={g.incomeBracket} onPick={o => setG({ incomeBracket: o })} /></div>
          <div><Label required>สุขภาพ</Label><Single options={PERSON_HEALTH} value={g.health} onPick={o => setG({ health: o })} /></div>
        </>)}
        {choice && (<>
          <label className="flex items-center gap-2 text-xs text-slate-200"><input type="checkbox" checked={g.sameAddressAsStudent} onChange={e => setG({ sameAddressAsStudent: e.target.checked })} /> ที่อยู่ผู้ปกครองเหมือนที่อยู่นักเรียน</label>
          {!g.sameAddressAsStudent && <textarea className={inputCls + ' h-16 resize-none'} placeholder="ที่อยู่ผู้ปกครอง" value={g.address} onChange={e => setG({ address: e.target.value })} />}
        </>)}
      </Section>

      <Section title="ข้อ 15 สถานะที่อยู่อาศัย">
        <Single options={HOUSING_STATUS} value={form.housingStatus} onPick={o => set('housingStatus', o)} />
        {form.housingStatus === HOUSING_STATUS[1] && <input className={inputCls + ' mt-2'} placeholder="ค่าเช่าต่อเดือน (บาท) *" inputMode="numeric" value={form.rentPerMonth ?? ''} onChange={e => set('rentPerMonth', toNum(e.target.value))} />}
        {form.housingStatus === 'อื่น ๆ' && <input className={inputCls + ' mt-2'} placeholder="ระบุ" value={form.housingOther} onChange={e => set('housingOther', e.target.value)} />}
      </Section>

      <Section title="ข้อ 16 ภาระพึ่งพิงของครัวเรือน (เลือกได้หลายข้อ)">
        <Chips options={DEPENDENTS} value={form.dependents} onToggle={o => set('dependents', toggleIn(form.dependents, o, DEPENDENTS[0]))} exclusive={DEPENDENTS[0]} />
      </Section>

      <Section title="ข้อ 22 ความปลอดภัยของที่อยู่อาศัย">
        <Single options={['ปลอดภัย', 'มีความเสี่ยง']} value={form.safetyLevel === 'GOOD' ? 'ปลอดภัย' : form.safetyLevel === 'RISK' ? 'มีความเสี่ยง' : ''} onPick={o => set('safetyLevel', o === 'ปลอดภัย' ? 'GOOD' : 'RISK')} />
        {form.safetyLevel === 'RISK' && (<>
          <Chips options={SAFETY_RISKS} value={form.safetyRisks} onToggle={o => set('safetyRisks', toggleIn(form.safetyRisks, o))} />
          {form.safetyRisks.includes('อื่น ๆ') && <input className={inputCls + ' mt-2'} placeholder="ระบุ" value={form.safetyOther} onChange={e => set('safetyOther', e.target.value)} />}
        </>)}
      </Section>

      <Section title="ข้อ 23 สภาพแวดล้อมของครัวเรือน">
        <div><Label required>แหล่งไฟฟ้าหลัก</Label><Chips options={ELECTRICITY} value={form.electricity} onToggle={o => set('electricity', toggleIn(form.electricity, o))} /></div>
        <div><Label required>แหล่งน้ำดื่ม</Label><Chips options={DRINKING_WATER} value={form.drinkingWater} onToggle={o => set('drinkingWater', toggleIn(form.drinkingWater, o))} /></div>
        <div><Label required>ความเสี่ยงด้านภัยพิบัติ</Label><Chips options={DISASTER_RISKS} value={form.disasterRisks} onToggle={o => set('disasterRisks', toggleIn(form.disasterRisks, o, DISASTER_RISKS[0]))} exclusive={DISASTER_RISKS[0]} /></div>
      </Section>

      <ErrorList errors={errors} />
      {msg && <div role="status" className={msg.ok ? 'bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-xs text-emerald-300 flex items-center gap-2' : 'bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-xs text-rose-300'}>{msg.ok && <CheckCircle2 className="w-4 h-4" />}{msg.text}</div>}
      <button type="button" onClick={save} disabled={saving} className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2">
        {saving && <Loader2 className="w-4 h-4 animate-spin" />} {saving ? 'กำลังบันทึก…' : 'บันทึกข้อมูลครอบครัว'}
      </button>
    </div>
  );
}
