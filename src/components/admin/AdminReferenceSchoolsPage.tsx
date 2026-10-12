import React, { useEffect, useMemo, useState } from 'react';
import { School, Plus, Search, Loader2, EyeOff, Eye, Undo2, Trash2, Pencil } from 'lucide-react';
import { auth } from '../../lib/firebase';
import { loadThaiAddressData, type ProvinceRef } from '../../lib/thaiAddress';
import { useSchoolDirectory } from '../../hooks/useReferenceData';
import { buildSchoolOverride, newCustomId, searchSchools, type SchoolRecord } from '../../lib/referenceData';
import { saveReferenceOverride, deleteReferenceOverride } from '../../services/firestoreService';

const inputCls = 'w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none placeholder:text-slate-600';
const badge = (t: string, c: string) => <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${c}`}>{t}</span>;

interface FormState { id: string; baseCode: string | null; name: string; subdistrict: string; district: string; affiliation: string; telephone: string; classMax: string; disabled: boolean }
const emptyForm = (): FormState => ({ id: '', baseCode: null, name: '', subdistrict: '', district: '', affiliation: '', telephone: '', classMax: '', disabled: false });
const fromRecord = (s: SchoolRecord): FormState => ({ id: s.overrideId ?? (s.moeCode ? `b_${s.moeCode}` : ''), baseCode: s.moeCode, name: s.name, subdistrict: s.subdistrict, district: s.district, affiliation: s.affiliation, telephone: s.telephone, classMax: s.classMax, disabled: s.disabled });

/** แอดมิน: จัดการรายชื่อโรงเรียน (ใช้ในช่อง "จบจากสถานศึกษา" ของแบบเยี่ยมบ้าน) — เพิ่ม/แก้/ซ่อน/คืนค่าเดิม/ลบรายการที่เพิ่มเอง */
export function AdminReferenceSchoolsPage() {
  const [provinces, setProvinces] = useState<ProvinceRef[]>([]);
  const [provinceCode, setProvinceCode] = useState('');
  const [q, setQ] = useState('');
  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const { schools, loading, error } = useSchoolDirectory(provinceCode, { includeDisabled: true });

  useEffect(() => { let c = false; loadThaiAddressData().then(d => { if (!c) setProvinces(d.areas); }).catch(() => {}); return () => { c = true; }; }, []);
  const shown = useMemo(() => searchSchools(schools, q, 100), [schools, q]);
  const stats = useMemo(() => ({ edited: schools.filter(s => s.source === 'BASE_EDITED').length, custom: schools.filter(s => s.source === 'CUSTOM').length, hidden: schools.filter(s => s.disabled).length }), [schools]);

  const write = async (f: FormState, okText: string) => {
    const by = auth.currentUser?.uid;
    if (!by) { setMsg({ ok: false, text: 'ไม่พบบัญชีผู้ใช้ที่ล็อกอิน กรุณาเข้าสู่ระบบใหม่' }); return false; }
    const built = buildSchoolOverride({ ...f, provinceCode, id: f.id || newCustomId() }, by, new Date().toISOString());
    if (built.ok === false) { setErrors(built.errors); return false; }
    setBusy(true); setMsg(null);
    try { await saveReferenceOverride('reference_schools', built.doc.id, built.doc); setMsg({ ok: true, text: okText }); return true; }
    catch (e) { setMsg({ ok: false, text: 'บันทึกไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)) }); return false; }
    finally { setBusy(false); }
  };
  const submit = async () => { setErrors([]); if (form && await write(form, 'บันทึกรายชื่อโรงเรียนแล้ว')) setForm(null); };
  const toggleHidden = (s: SchoolRecord) => write({ ...fromRecord(s), disabled: !s.disabled }, s.disabled ? 'แสดงโรงเรียนแล้ว' : 'ซ่อนโรงเรียนออกจากรายการของนักเรียนแล้ว');
  const remove = async (s: SchoolRecord) => {
    if (!s.overrideId) return;
    setBusy(true); setMsg(null);
    try { await deleteReferenceOverride('reference_schools', s.overrideId); setMsg({ ok: true, text: s.source === 'CUSTOM' ? 'ลบโรงเรียนที่เพิ่มเองแล้ว' : 'คืนค่าเดิมของโรงเรียนแล้ว' }); }
    catch (e) { setMsg({ ok: false, text: 'ลบไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)) }); }
    finally { setBusy(false); setConfirmDelete(null); }
  };
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(f => f ? { ...f, [k]: v } : f);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2"><School className="w-6 h-6 text-sky-400" /> จัดการรายชื่อโรงเรียน</h2>
        <p className="text-sm text-slate-400 mt-1">รายชื่อโรงเรียนที่นักเรียนเลือกในแบบเยี่ยมบ้านข้อ 2 — ชุดหลักเป็นโรงเรียนในสังกัด สพฐ. เพิ่มโรงเรียนที่ไม่มี แก้ข้อมูลที่ผิด หรือซ่อนรายการได้ (ข้อมูลชุดหลักไม่ถูกลบ)</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px]">
          <label className="block text-xs font-semibold text-slate-300 mb-1">จังหวัด</label>
          <select className={inputCls} value={provinceCode} onChange={e => { setProvinceCode(e.target.value); setQ(''); setForm(null); setMsg(null); }}>
            <option value="">— เลือกจังหวัด —</option>
            {provinces.map(p => <option key={p[0]} value={p[0]}>{p[1]}</option>)}
          </select>
        </div>
        {provinceCode && (
          <>
            <div className="flex-1 min-w-[200px] relative">
              <label className="block text-xs font-semibold text-slate-300 mb-1">ค้นหา</label>
              <Search className="w-4 h-4 text-slate-500 absolute left-2.5 bottom-2.5" />
              <input className={`${inputCls} pl-8`} value={q} onChange={e => setQ(e.target.value)} placeholder="ชื่อโรงเรียน / ตำบล / อำเภอ" />
            </div>
            <button type="button" onClick={() => { setForm(emptyForm()); setErrors([]); setMsg(null); }} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold flex items-center gap-2"><Plus className="w-4 h-4" /> เพิ่มโรงเรียน</button>
          </>
        )}
      </div>

      {msg && <div role="status" className={`text-sm rounded-lg px-3 py-2 border ${msg.ok ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'}`}>{msg.text}</div>}

      {form && (
        <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-bold text-white">{form.baseCode ? 'แก้ไขข้อมูลโรงเรียน' : form.id ? 'แก้ไขโรงเรียนที่เพิ่มเอง' : 'เพิ่มโรงเรียนใหม่'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2"><label className="block text-xs text-slate-300 mb-1">ชื่อโรงเรียน *</label><input className={inputCls} value={form.name} onChange={e => set('name', e.target.value)} placeholder="เช่น โรงเรียนบ้านท่าเสา" /></div>
            <div><label className="block text-xs text-slate-300 mb-1">ตำบล</label><input className={inputCls} value={form.subdistrict} onChange={e => set('subdistrict', e.target.value)} /></div>
            <div><label className="block text-xs text-slate-300 mb-1">อำเภอ/เขต</label><input className={inputCls} value={form.district} onChange={e => set('district', e.target.value)} /></div>
            <div><label className="block text-xs text-slate-300 mb-1">สังกัด</label><input className={inputCls} value={form.affiliation} onChange={e => set('affiliation', e.target.value)} placeholder="เช่น สพป.อุตรดิตถ์ เขต 2, เอกชน, เทศบาล" /></div>
            <div><label className="block text-xs text-slate-300 mb-1">โทรศัพท์</label><input className={inputCls} inputMode="tel" value={form.telephone} onChange={e => set('telephone', e.target.value)} placeholder="เช่น 055411234" /></div>
            <div><label className="block text-xs text-slate-300 mb-1">ระดับสูงสุดที่เปิดสอน</label><input className={inputCls} value={form.classMax} onChange={e => set('classMax', e.target.value)} placeholder="เช่น ป.6, ม.3, ม.6" /></div>
          </div>
          {errors.length > 0 && <div role="alert" className="text-xs text-amber-200 space-y-0.5">{errors.map(e => <div key={e}>• {e}</div>)}</div>}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setForm(null)} className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-sm">ยกเลิก</button>
            <button type="button" disabled={busy} onClick={submit} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold disabled:opacity-50 flex items-center gap-2">{busy && <Loader2 className="w-4 h-4 animate-spin" />} บันทึก</button>
          </div>
        </div>
      )}

      {provinceCode && (
        <div className="text-xs text-slate-400">ทั้งหมด {schools.length.toLocaleString('th-TH')} แห่ง · แก้ไขแล้ว {stats.edited} · เพิ่มเอง {stats.custom} · ซ่อนอยู่ {stats.hidden}{shown.length >= 100 ? ' · แสดง 100 รายการแรกที่ตรงกับคำค้น' : ''}</div>
      )}
      {loading && <div className="text-sm text-slate-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> กำลังโหลด…</div>}
      {error && <div role="alert" className="text-sm text-rose-300">{error}</div>}
      {!provinceCode && <div className="py-10 text-center text-sm text-slate-500">เลือกจังหวัดเพื่อดูและจัดการรายชื่อโรงเรียน</div>}

      <ul className="space-y-2">
        {shown.map(s => (
          <li key={s.key} className={`border rounded-xl p-3 flex flex-wrap items-center gap-3 ${s.disabled ? 'border-white/5 bg-black/20 opacity-60' : 'border-white/10 bg-slate-900/40'}`}>
            <div className="flex-1 min-w-[220px]">
              <div className="text-sm font-bold text-white flex items-center gap-2 flex-wrap">{s.name}
                {s.source === 'CUSTOM' && badge('เพิ่มเอง', 'bg-emerald-500/20 text-emerald-300')}
                {s.source === 'BASE_EDITED' && badge('แก้ไขแล้ว', 'bg-amber-500/20 text-amber-300')}
                {s.disabled && badge('ซ่อนอยู่', 'bg-slate-500/30 text-slate-300')}
              </div>
              <div className="text-[11px] text-slate-500">ต.{s.subdistrict || '-'} · {s.district || '-'}{s.affiliation ? ` · ${s.affiliation}` : ''}{s.telephone ? ` · โทร ${s.telephone}` : ''}</div>
            </div>
            <div className="flex items-center gap-1.5">
              <button type="button" title="แก้ไข" onClick={() => { setForm(fromRecord(s)); setErrors([]); setMsg(null); }} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"><Pencil className="w-4 h-4" /></button>
              <button type="button" title={s.disabled ? 'แสดง' : 'ซ่อน'} disabled={busy} onClick={() => toggleHidden(s)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-50">{s.disabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}</button>
              {s.source === 'BASE_EDITED' && <button type="button" title="คืนค่าเดิมจากชุดหลัก" disabled={busy} onClick={() => remove(s)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 disabled:opacity-50"><Undo2 className="w-4 h-4" /></button>}
              {s.source === 'CUSTOM' && (confirmDelete === s.key
                ? <button type="button" disabled={busy} onClick={() => remove(s)} className="px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold">ยืนยันลบ</button>
                : <button type="button" title="ลบ" onClick={() => setConfirmDelete(s.key)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-rose-300"><Trash2 className="w-4 h-4" /></button>)}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
