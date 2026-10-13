import React, { useEffect, useState } from 'react';
import { AlertCircle, BadgeCheck, CheckCircle2, Clock, Heart, Loader2, Pill, Plus, Save, ShieldAlert, Trash2 } from 'lucide-react';
import type { AllergyRecord, ChronicIllness, SpecialCareNeed, Student } from '../../types';
import { saveStudentHealthProfile, subscribeStudentHealthProfile, type StudentHealthProfileDoc } from '../../services/firestoreService';
import {
  ALLERGY_TYPE_LABEL, EMPTY_HEALTH_LISTS, MAX_HEALTH_ITEMS, SEVERITY_LABEL, healthVerifyStatus, newItemId,
  normalizeHealthLists, validateHealthLists, type HealthProfileLists,
} from '../../lib/healthProfile';
import { formatThaiDateTime, toMillis } from '../../lib/enrollmentWindow';
import { BloodTypeCard } from './BloodTypeCard';

/** โหลดโปรไฟล์สุขภาพของนักเรียน 1 คนแบบ live — undefined = ยังโหลด, null = ยังไม่เคยบันทึก */
export function useStudentHealthProfile(studentId: string | undefined) {
  const [profile, setProfile] = useState<StudentHealthProfileDoc | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setProfile(undefined); setError(null);
    if (!studentId) return;
    return subscribeStudentHealthProfile(studentId, setProfile, (e) => { setError(e.message); setProfile(null); });
  }, [studentId]);
  return { profile, error };
}

export function HealthVerifyBadge({ profile }: { profile: StudentHealthProfileDoc | null | undefined }) {
  const st = healthVerifyStatus(profile);
  if (st === 'NONE') return null;
  if (st === 'VERIFIED') {
    const ms = toMillis(profile!.verifiedAt as any);
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300" data-testid="health-verified">
        <BadgeCheck className="w-3.5 h-3.5" /> พยาบาลยืนยันแล้ว{profile!.verifiedByName ? ` (${profile!.verifiedByName})` : ''}{ms ? ` · ${formatThaiDateTime(ms)}` : ''}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300" data-testid="health-unverified">
      <Clock className="w-3.5 h-3.5" /> รอพยาบาลตรวจสอบ
    </span>
  );
}

/** การ์ด 3 หมวด (อ่านอย่างเดียว) — ใช้ร่วมกันทั้งหน้านักเรียน/ผู้ปกครอง/พยาบาล */
export function HealthProfileCards({ profile }: { profile: StudentHealthProfileDoc | null | undefined }) {
  const ill = profile?.chronicIllnesses || [];
  const alg = profile?.allergies || [];
  const care = profile?.specialCare || [];
  return (
    <div className="space-y-4">
      <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5">
        <h4 className="text-xs font-bold text-amber-400 flex items-center gap-1.5 mb-2"><ShieldAlert className="w-4 h-4" /> โรคประจำตัวและข้อควรระวัง (Chronic Illnesses)</h4>
        {ill.length === 0 && <p className="text-[11px] text-slate-500">{profile ? 'ไม่มีรายการ' : 'ยังไม่มีการบันทึก'}</p>}
        {ill.map(ci => (
          <div key={ci.id} className="p-3 mb-2 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs space-y-1">
            <div className="flex items-center justify-between"><span className="font-bold text-amber-200">{ci.name}</span><span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">ระดับ: {SEVERITY_LABEL[ci.severity] || ci.severity}</span></div>
            {ci.treatmentCare && <p className="text-[11px] text-amber-300/80">{ci.treatmentCare}</p>}
          </div>
        ))}
      </div>
      <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5">
        <h4 className="text-xs font-bold text-rose-400 flex items-center gap-1.5 mb-2"><Pill className="w-4 h-4" /> ประวัติการแพ้ยาและอาหาร (Allergies)</h4>
        {alg.length === 0 && <p className="text-[11px] text-slate-500">{profile ? 'ไม่มีรายการ' : 'ยังไม่มีการบันทึก'}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {alg.map(al => (
            <div key={al.id} className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-xs space-y-1">
              <div className="flex items-center justify-between"><span className="font-bold text-rose-200">{al.allergen}</span><span className="text-[9.5px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold">{ALLERGY_TYPE_LABEL[al.type] || al.type}</span></div>
              {al.reaction && <p className="text-[10.5px] text-rose-300/80">{al.reaction}</p>}
            </div>
          ))}
        </div>
      </div>
      <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5">
        <h4 className="text-xs font-bold text-indigo-400 flex items-center gap-1.5 mb-2"><Heart className="w-4 h-4" /> ความต้องการพิเศษในการดูแลในชั้นเรียน (Special Classroom Care)</h4>
        {care.length === 0 && <p className="text-[11px] text-slate-500">{profile ? 'ไม่มีรายการ' : 'ยังไม่มีการบันทึก'}</p>}
        {care.map(sc => (
          <div key={sc.id} className="p-3 mb-2 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-xs space-y-1">
            <span className="font-bold text-indigo-200">{sc.category}: {sc.description}</span>
            {sc.actionPlan && <p className="text-[11px] text-indigo-300/80">👉 แผนการจัดการ: {sc.actionPlan}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

const INPUT = 'w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-100 outline-none focus:border-indigo-500';

/**
 * ส่วน "ข้อมูลสุขภาพประจำตัว" ของนักเรียน: ดูได้ทุกคนที่เกี่ยวข้อง; นักเรียน/ผู้ปกครองตัวจริงกดแก้ไขได้
 * (บันทึกแล้วต้องรอพยาบาลยืนยันใหม่) — viewer = null คืออ่านอย่างเดียว
 */
export function HealthProfileSection({ student, viewer }: { student: Student; viewer: { uid: string; role: 'STUDENT' | 'PARENT' } | null }) {
  const { profile, error } = useStudentHealthProfile(student.studentId);
  const [editing, setEditing] = useState(false);
  const [lists, setLists] = useState<HealthProfileLists>(EMPTY_HEALTH_LISTS);
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  const startEdit = () => {
    setLists({
      chronicIllnesses: [...(profile?.chronicIllnesses || [])],
      allergies: [...(profile?.allergies || [])],
      specialCare: [...(profile?.specialCare || [])],
    });
    setErrs([]); setSaved(false); setEditing(true);
  };

  const canSave = !!viewer && !!student.studentUid;

  const save = async () => {
    if (!viewer || !student.studentUid) return;
    const clean = normalizeHealthLists(lists);
    const problems = validateHealthLists(clean);
    if (problems.length) { setErrs(problems); return; }
    setBusy(true); setErrs([]);
    try {
      await saveStudentHealthProfile({
        studentId: student.studentId, studentUid: student.studentUid, parentUid: student.parentUid ?? null, // ค่าจริงอ่านจากทะเบียนใน saveStudentHealthProfile
        actorUid: viewer.uid, actorRole: viewer.role, lists: clean,
      });
      setEditing(false); setSaved(true);
    } catch (e) {
      setErrs(['บันทึกไม่สำเร็จ — ตรวจว่าบัญชีของท่านผูกกับนักเรียนคนนี้ แล้วลองใหม่ (' + (e instanceof Error ? e.message : String(e)) + ')']);
    } finally { setBusy(false); }
  };

  const upd = <K extends keyof HealthProfileLists>(k: K, i: number, patch: Partial<HealthProfileLists[K][number]>) =>
    setLists(l => ({ ...l, [k]: (l[k] as any[]).map((x, idx) => (idx === i ? { ...x, ...patch } : x)) }));
  const del = (k: keyof HealthProfileLists, i: number) => setLists(l => ({ ...l, [k]: (l[k] as any[]).filter((_, idx) => idx !== i) }));
  const add = (k: keyof HealthProfileLists, item: any) => setLists(l => ((l[k] as any[]).length >= MAX_HEALTH_ITEMS ? l : { ...l, [k]: [...(l[k] as any[]), item] }));

  return (
    <div className="space-y-4" data-testid="health-profile-section">
      {viewer?.role === 'PARENT' && <BloodTypeCard studentId={student.studentId} actor={{ uid: viewer.uid, role: 'PARENT' }} />}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <HealthVerifyBadge profile={profile} />
        {viewer && !editing && (
          <button onClick={startEdit} disabled={!canSave || profile === undefined} className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-lg">
            {profile ? 'แก้ไขข้อมูล' : 'เพิ่มข้อมูลสุขภาพ'}
          </button>
        )}
      </div>
      {viewer && !student.studentUid && <p className="text-[11px] text-amber-300">ยังบันทึกไม่ได้ — ทะเบียนนักเรียนยังไม่ผูกบัญชีนักเรียน (แจ้งแอดมิน)</p>}
      {saved && <p className="text-[11px] text-emerald-300 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> บันทึกแล้ว — รอพยาบาลตรวจสอบยืนยัน</p>}
      {error && <p className="text-[11px] text-rose-300">อ่านข้อมูลไม่ได้: {error}</p>}

      {!editing && (profile === undefined ? <p className="text-xs text-slate-400 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> กำลังโหลด…</p> : <HealthProfileCards profile={profile} />)}

      {editing && (
        <div className="space-y-5 bg-slate-900/70 border border-slate-800 rounded-3xl p-5" data-testid="health-profile-editor">
          <p className="text-[11px] text-slate-400">กรอกตามความจริงเพื่อความปลอดภัยของนักเรียน — เมื่อบันทึกแล้วต้องรอพยาบาลตรวจสอบ และทุกครั้งที่แก้ไขจะต้องให้พยาบาลยืนยันใหม่</p>

          <fieldset className="space-y-2"><legend className="text-xs font-bold text-amber-400">โรคประจำตัว</legend>
            {lists.chronicIllnesses.map((c, i) => (
              <div key={c.id} className="grid grid-cols-1 sm:grid-cols-[1fr_9rem_2fr_auto] gap-2 items-start">
                <input className={INPUT} placeholder="ชื่อโรค" value={c.name} onChange={e => upd('chronicIllnesses', i, { name: e.target.value })} aria-label="ชื่อโรค" />
                <select className={INPUT} value={c.severity} onChange={e => upd('chronicIllnesses', i, { severity: e.target.value as ChronicIllness['severity'] })} aria-label="ระดับ">
                  {(Object.keys(SEVERITY_LABEL) as ChronicIllness['severity'][]).map(k => <option key={k} value={k}>{SEVERITY_LABEL[k]}</option>)}
                </select>
                <input className={INPUT} placeholder="การดูแล/ข้อควรระวัง" value={c.treatmentCare} onChange={e => upd('chronicIllnesses', i, { treatmentCare: e.target.value })} aria-label="การดูแล" />
                <button onClick={() => del('chronicIllnesses', i)} className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg" aria-label="ลบรายการ"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
            <button onClick={() => add('chronicIllnesses', { id: newItemId('ci'), name: '', severity: 'MILD', treatmentCare: '' } as ChronicIllness)} className="text-[11px] text-indigo-300 flex items-center gap-1"><Plus className="w-3 h-3" /> เพิ่มโรคประจำตัว</button>
          </fieldset>

          <fieldset className="space-y-2"><legend className="text-xs font-bold text-rose-400">แพ้ยา / แพ้อาหาร</legend>
            {lists.allergies.map((a, i) => (
              <div key={a.id} className="grid grid-cols-1 sm:grid-cols-[1fr_9rem_2fr_auto] gap-2 items-start">
                <input className={INPUT} placeholder="สิ่งที่แพ้" value={a.allergen} onChange={e => upd('allergies', i, { allergen: e.target.value })} aria-label="สิ่งที่แพ้" />
                <select className={INPUT} value={a.type} onChange={e => upd('allergies', i, { type: e.target.value as AllergyRecord['type'] })} aria-label="ประเภทการแพ้">
                  {(Object.keys(ALLERGY_TYPE_LABEL) as AllergyRecord['type'][]).map(k => <option key={k} value={k}>{ALLERGY_TYPE_LABEL[k]}</option>)}
                </select>
                <input className={INPUT} placeholder="อาการที่เกิด" value={a.reaction} onChange={e => upd('allergies', i, { reaction: e.target.value })} aria-label="อาการ" />
                <button onClick={() => del('allergies', i)} className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg" aria-label="ลบรายการ"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
            <button onClick={() => add('allergies', { id: newItemId('al'), allergen: '', type: 'DRUG', reaction: '' } as AllergyRecord)} className="text-[11px] text-indigo-300 flex items-center gap-1"><Plus className="w-3 h-3" /> เพิ่มรายการแพ้</button>
          </fieldset>

          <fieldset className="space-y-2"><legend className="text-xs font-bold text-indigo-400">ความต้องการพิเศษในการดูแลในชั้นเรียน</legend>
            {lists.specialCare.map((s, i) => (
              <div key={s.id} className="grid grid-cols-1 sm:grid-cols-[1fr_2fr_2fr_auto] gap-2 items-start">
                <input className={INPUT} placeholder="ประเภท (เช่น สายตา, การได้ยิน)" value={s.category} onChange={e => upd('specialCare', i, { category: e.target.value })} aria-label="ประเภท" />
                <input className={INPUT} placeholder="รายละเอียด" value={s.description} onChange={e => upd('specialCare', i, { description: e.target.value })} aria-label="รายละเอียด" />
                <input className={INPUT} placeholder="สิ่งที่ครูควรช่วย" value={s.actionPlan} onChange={e => upd('specialCare', i, { actionPlan: e.target.value })} aria-label="แผนการดูแล" />
                <button onClick={() => del('specialCare', i)} className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg" aria-label="ลบรายการ"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
            <button onClick={() => add('specialCare', { id: newItemId('sc'), category: '', description: '', actionPlan: '' } as SpecialCareNeed)} className="text-[11px] text-indigo-300 flex items-center gap-1"><Plus className="w-3 h-3" /> เพิ่มความต้องการพิเศษ</button>
          </fieldset>

          {errs.length > 0 && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-[11px] text-rose-300 space-y-0.5">
              {errs.map((m, i) => <p key={i} className="flex items-start gap-1.5"><AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />{m}</p>)}
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg">ยกเลิก</button>
            <button onClick={save} disabled={busy || !canSave} className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg flex items-center gap-1.5">
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} บันทึก
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
