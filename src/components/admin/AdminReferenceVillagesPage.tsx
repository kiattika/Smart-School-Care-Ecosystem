import React, { useEffect, useMemo, useState } from 'react';
import { MapPin, Plus, Loader2, EyeOff, Eye, Undo2, Trash2, Pencil } from 'lucide-react';
import { auth } from '../../lib/firebase';
import { loadThaiAddressData, type ProvinceRef } from '../../lib/thaiAddress';
import { useVillageDirectory } from '../../hooks/useReferenceData';
import { buildVillageOverride, newCustomId, type VillageRecord } from '../../lib/referenceData';
import { saveReferenceOverride, deleteReferenceOverride } from '../../services/firestoreService';

const inputCls = 'w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none placeholder:text-slate-600 disabled:opacity-50';
const badge = (t: string, c: string) => <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${c}`}>{t}</span>;

interface FormState { id: string; baseCode: string | null; moo: string; name: string; disabled: boolean }
const emptyForm = (): FormState => ({ id: '', baseCode: null, moo: '', name: '', disabled: false });
const fromRecord = (v: VillageRecord): FormState => ({ id: v.overrideId ?? (v.source === 'CUSTOM' ? v.code : `b_${v.code}`), baseCode: v.source === 'CUSTOM' ? null : v.code, moo: v.moo === null ? '' : String(v.moo), name: v.name, disabled: v.disabled });

/** แอดมิน: จัดการรายชื่อหมู่บ้าน/ชุมชน ตามตำบล (ใช้ในดรอปดาวน์ที่อยู่ของนักเรียน) — เพิ่ม/แก้/ซ่อน/คืนค่าเดิม/ลบรายการที่เพิ่มเอง */
export function AdminReferenceVillagesPage() {
  const [areas, setAreas] = useState<ProvinceRef[]>([]);
  const [pcode, setPcode] = useState('');
  const [acode, setAcode] = useState('');
  const [tcode, setTcode] = useState('');
  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const { villages } = useVillageDirectory(tcode, { includeDisabled: true });

  useEffect(() => { let c = false; loadThaiAddressData().then(d => { if (!c) setAreas(d.areas); }).catch(() => {}); return () => { c = true; }; }, []);
  const province = useMemo(() => areas.find(p => p[0] === pcode) ?? null, [areas, pcode]);
  const amphoe = useMemo(() => province?.[2].find(a => a[0] === acode) ?? null, [province, acode]);
  const tambon = useMemo(() => amphoe?.[2].find(t => t[0] === tcode) ?? null, [amphoe, tcode]);

  const write = async (f: FormState, okText: string) => {
    const by = auth.currentUser?.uid;
    if (!by) { setMsg({ ok: false, text: 'ไม่พบบัญชีผู้ใช้ที่ล็อกอิน กรุณาเข้าสู่ระบบใหม่' }); return false; }
    const built = buildVillageOverride({ ...f, provinceCode: pcode, amphoeCode: acode, tambonCode: tcode, id: f.id || newCustomId() }, by, new Date().toISOString());
    if (built.ok === false) { setErrors(built.errors); return false; }
    setBusy(true); setMsg(null);
    try { await saveReferenceOverride('reference_villages', built.doc.id, built.doc); setMsg({ ok: true, text: okText }); return true; }
    catch (e) { setMsg({ ok: false, text: 'บันทึกไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)) }); return false; }
    finally { setBusy(false); }
  };
  const submit = async () => { setErrors([]); if (form && await write(form, 'บันทึกรายชื่อหมู่บ้านแล้ว')) setForm(null); };
  const toggleHidden = (v: VillageRecord) => write({ ...fromRecord(v), disabled: !v.disabled }, v.disabled ? 'แสดงหมู่บ้านแล้ว' : 'ซ่อนหมู่บ้านออกจากรายการของนักเรียนแล้ว');
  const remove = async (v: VillageRecord) => {
    if (!v.overrideId) return;
    setBusy(true); setMsg(null);
    try { await deleteReferenceOverride('reference_villages', v.overrideId); setMsg({ ok: true, text: v.source === 'CUSTOM' ? 'ลบหมู่บ้านที่เพิ่มเองแล้ว' : 'คืนค่าเดิมของหมู่บ้านแล้ว' }); }
    catch (e) { setMsg({ ok: false, text: 'ลบไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)) }); }
    finally { setBusy(false); setConfirmDelete(null); }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2"><MapPin className="w-6 h-6 text-emerald-400" /> จัดการรายชื่อหมู่บ้าน</h2>
        <p className="text-sm text-slate-400 mt-1">รายชื่อหมู่บ้าน/ชุมชนในดรอปดาวน์ที่อยู่ของนักเรียน — ชุดหลักมีเฉพาะจังหวัดอุตรดิตถ์และกระบี่ (ข้อมูล DOPA) จังหวัดอื่นเพิ่มเองได้ ข้อมูลชุดหลักไม่ถูกลบ</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <select className={inputCls} value={pcode} onChange={e => { setPcode(e.target.value); setAcode(''); setTcode(''); setForm(null); setMsg(null); }} aria-label="จังหวัด">
          <option value="">— เลือกจังหวัด —</option>{areas.map(p => <option key={p[0]} value={p[0]}>{p[1]}</option>)}
        </select>
        <select className={inputCls} value={acode} disabled={!province} onChange={e => { setAcode(e.target.value); setTcode(''); setForm(null); }} aria-label="อำเภอ">
          <option value="">— เลือกอำเภอ/เขต —</option>{province?.[2].map(a => <option key={a[0]} value={a[0]}>{a[1]}</option>)}
        </select>
        <select className={inputCls} value={tcode} disabled={!amphoe} onChange={e => { setTcode(e.target.value); setForm(null); }} aria-label="ตำบล">
          <option value="">— เลือกตำบล/แขวง —</option>{amphoe?.[2].map(t => <option key={t[0]} value={t[0]}>{t[1]}</option>)}
        </select>
      </div>

      {msg && <div role="status" className={`text-sm rounded-lg px-3 py-2 border ${msg.ok ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'}`}>{msg.text}</div>}
      {!tambon && <div className="py-10 text-center text-sm text-slate-500">เลือกจังหวัด อำเภอ และตำบล เพื่อดูและจัดการหมู่บ้าน</div>}

      {tambon && (
        <>
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-slate-400">ต.{tambon[1]} · {villages.length} รายการ · ซ่อนอยู่ {villages.filter(v => v.disabled).length}</div>
            <button type="button" onClick={() => { setForm(emptyForm()); setErrors([]); setMsg(null); }} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold flex items-center gap-2"><Plus className="w-4 h-4" /> เพิ่มหมู่บ้าน</button>
          </div>

          {form && (
            <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-4 space-y-3">
              <h3 className="text-sm font-bold text-white">{form.baseCode ? 'แก้ไขหมู่บ้าน' : form.id ? 'แก้ไขหมู่บ้านที่เพิ่มเอง' : 'เพิ่มหมู่บ้านใหม่'}</h3>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="block text-xs text-slate-300 mb-1">หมู่ที่ (ชุมชนเว้นว่าง)</label><input className={inputCls} inputMode="numeric" maxLength={2} value={form.moo} onChange={e => setForm({ ...form, moo: e.target.value.replace(/\D/g, '') })} /></div>
                <div className="col-span-2"><label className="block text-xs text-slate-300 mb-1">ชื่อหมู่บ้าน/ชุมชน *</label><input className={inputCls} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              </div>
              {errors.length > 0 && <div role="alert" className="text-xs text-amber-200 space-y-0.5">{errors.map(e => <div key={e}>• {e}</div>)}</div>}
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setForm(null)} className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-sm">ยกเลิก</button>
                <button type="button" disabled={busy} onClick={submit} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold disabled:opacity-50 flex items-center gap-2">{busy && <Loader2 className="w-4 h-4 animate-spin" />} บันทึก</button>
              </div>
            </div>
          )}

          <ul className="space-y-2">
            {villages.map(v => (
              <li key={v.key} className={`border rounded-xl p-3 flex flex-wrap items-center gap-3 ${v.disabled ? 'border-white/5 bg-black/20 opacity-60' : 'border-white/10 bg-slate-900/40'}`}>
                <div className="flex-1 min-w-[180px] text-sm font-bold text-white flex items-center gap-2 flex-wrap">
                  {v.moo === null ? v.name : `หมู่ ${v.moo} ${v.name}`}
                  {v.source === 'CUSTOM' && badge('เพิ่มเอง', 'bg-emerald-500/20 text-emerald-300')}
                  {v.source === 'BASE_EDITED' && badge('แก้ไขแล้ว', 'bg-amber-500/20 text-amber-300')}
                  {v.disabled && badge('ซ่อนอยู่', 'bg-slate-500/30 text-slate-300')}
                </div>
                <div className="flex items-center gap-1.5">
                  <button type="button" title="แก้ไข" onClick={() => { setForm(fromRecord(v)); setErrors([]); setMsg(null); }} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"><Pencil className="w-4 h-4" /></button>
                  <button type="button" title={v.disabled ? 'แสดง' : 'ซ่อน'} disabled={busy} onClick={() => toggleHidden(v)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-50">{v.disabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}</button>
                  {v.source === 'BASE_EDITED' && <button type="button" title="คืนค่าเดิมจากชุดหลัก" disabled={busy} onClick={() => remove(v)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 disabled:opacity-50"><Undo2 className="w-4 h-4" /></button>}
                  {v.source === 'CUSTOM' && (confirmDelete === v.key
                    ? <button type="button" disabled={busy} onClick={() => remove(v)} className="px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold">ยืนยันลบ</button>
                    : <button type="button" title="ลบ" onClick={() => setConfirmDelete(v.key)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-rose-300"><Trash2 className="w-4 h-4" /></button>)}
                </div>
              </li>
            ))}
            {villages.length === 0 && <li className="py-6 text-center text-sm text-slate-500">ยังไม่มีหมู่บ้านในตำบลนี้ — กด "เพิ่มหมู่บ้าน"</li>}
          </ul>
        </>
      )}
    </div>
  );
}
