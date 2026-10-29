import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useStore } from '../../store';
import { useEvaluationTemplates } from '../../hooks/useEvaluationTemplates';
import { saveNewTemplateVersion } from '../../services/evaluationTemplateService';
import {
  MAX_CRITERIA, MAX_LABEL, MAX_SECTIONS, TEMPLATE_KINDS, TEMPLATE_KIND_LABEL,
  nextCriterionId, numberedLabel, validateTemplateDraft,
  type EvalCriterion, type EvalSection, type EvalTemplate, type TemplateKind,
} from '../../lib/evaluationTemplate';

const inputCls = 'w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500';
const btn = 'p-1.5 rounded-md border border-slate-700 text-slate-300 disabled:opacity-30 cursor-pointer';

/** หัวหน้างานนิเทศ (เท่านั้น) แก้แบบประเมิน — บันทึกเป็นเวอร์ชันใหม่ ผลที่ประเมินไปแล้วยังใช้แบบเวอร์ชันเดิม (ไม่กระทบย้อนหลัง) */
export function EvaluationTemplateEditor() {
  const [kind, setKind] = useState<TemplateKind>('SUPERVISION');
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-300 space-y-1">
        <p className="text-white font-medium">แบบประเมิน</p>
        <p>แก้ข้อความ เพิ่ม ลบ หรือเรียงข้อใหม่ได้ — เมื่อบันทึกจะเป็น “เวอร์ชันใหม่” ใช้กับการประเมินที่เริ่มหลังจากนี้ ส่วนผลที่ประเมินไปแล้ว (และฉบับร่างนิเทศที่ค้างอยู่) ยังแสดงด้วยแบบเวอร์ชันเดิม มาตราคะแนนยังเป็น 1–5 เหมือนเดิม</p>
      </div>
      <div className="flex flex-wrap gap-2" role="tablist">
        {TEMPLATE_KINDS.map(k => (
          <button key={k} role="tab" aria-selected={kind === k} onClick={() => setKind(k)}
            className={`px-3 py-1.5 rounded-lg text-sm cursor-pointer border ${kind === k ? 'bg-cyan-600 border-cyan-400 text-white' : 'bg-slate-900 border-slate-700 text-slate-300'}`}>{TEMPLATE_KIND_LABEL[k]}</button>
        ))}
      </div>
      <div key={kind}><KindEditor kind={kind} /></div>
    </div>
  );
}

function KindEditor({ kind }: { kind: TemplateKind }) {
  const staffId = useStore(s => s.user?.staffId) || '';
  const tpls = useEvaluationTemplates(kind);
  const base = tpls.current;
  const [criteria, setCriteria] = useState<EvalCriterion[]>([]);
  const [sections, setSections] = useState<EvalSection[]>([]);
  const [loadedVer, setLoadedVer] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  // โหลดแบบปัจจุบันเข้าฟอร์มเมื่อเวอร์ชันเปลี่ยน (เช่น หลังบันทึก)
  useEffect(() => {
    if (base && base.version !== loadedVer) { setCriteria(base.criteria.map(c => ({ ...c }))); setSections(base.sections.map(s => ({ ...s }))); setLoadedVer(base.version); }
  }, [base, loadedVer]);

  if (tpls.error) return <p role="alert" className="text-sm text-amber-300">โหลดแบบไม่สำเร็จ: {tpls.error}</p>;
  if (!base) return <p className="text-sm text-slate-400">กำลังโหลด…</p>;

  const hasSections = kind === 'SUPERVISION';
  const draft = { criteria, sections };
  const problem = validateTemplateDraft(kind, draft);
  const dirty = JSON.stringify(draft) !== JSON.stringify({ criteria: base.criteria, sections: base.sections });
  const preview: EvalTemplate = { kind, version: base.version + 1, criteria, sections };

  const move = (i: number, d: -1 | 1) => setCriteria(list => { const j = i + d; if (j < 0 || j >= list.length) return list; const n = [...list]; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const patch = (i: number, p: Partial<EvalCriterion>) => setCriteria(list => list.map((c, k) => (k === i ? { ...c, ...p } : c)));
  const addCriterion = (section?: number) => setCriteria(list => {
    const at = section === undefined ? list.length : list.reduce((acc, c, k) => (c.section === section ? k + 1 : acc), list.length);
    const n = [...list]; n.splice(at, 0, { id: nextCriterionId([...list, ...base.criteria]), label: '', ...(section !== undefined ? { section } : {}) }); return n;
  });
  const addSection = () => setSections(list => {
    const no = Math.max(0, ...list.map(s => s.no)) + 1;
    setCriteria(cs => [...cs, { id: nextCriterionId([...cs, ...base.criteria]), label: '', section: no }]);
    return [...list, { no, title: '' }];
  });
  const removeSection = (no: number) => { setSections(l => l.filter(s => s.no !== no)); setCriteria(l => l.filter(c => c.section !== no)); };

  const save = async () => {
    if (problem || !dirty) return;
    if (!window.confirm(`บันทึกเป็นแบบเวอร์ชัน ${base.version + 1}? การประเมินใหม่จะใช้แบบนี้ทันที (ผลเก่าไม่เปลี่ยน)`)) return;
    setBusy(true); setMsg('');
    try { const v = await saveNewTemplateVersion(kind, draft, base.version, staffId); setMsg(`บันทึกเป็นเวอร์ชัน ${v} แล้ว`); }
    catch (e) { setMsg(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ'); } finally { setBusy(false); }
  };

  const row = (c: EvalCriterion, i: number) => (
    <li key={c.id} className="rounded-lg border border-slate-800 bg-slate-900/60 p-2 space-y-1.5">
      <div className="flex items-start gap-2">
        <span className="text-xs text-slate-500 w-14 shrink-0 pt-2.5">{c.section !== undefined ? numberedLabel(preview, c).split(' ')[0] : `${i + 1}.`}</span>
        <textarea className={inputCls} rows={2} maxLength={MAX_LABEL} aria-label={`ข้อ ${i + 1}`} placeholder="ข้อความของข้อประเมิน" value={c.label} onChange={e => patch(i, { label: e.target.value })} />
        <div className="flex flex-col gap-1">
          <button type="button" className={btn} aria-label="เลื่อนขึ้น" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="w-3.5 h-3.5" /></button>
          <button type="button" className={btn} aria-label="เลื่อนลง" disabled={i === criteria.length - 1} onClick={() => move(i, 1)}><ArrowDown className="w-3.5 h-3.5" /></button>
          <button type="button" className={`${btn} text-rose-300`} aria-label="ลบข้อ" onClick={() => setCriteria(l => l.filter((_, k) => k !== i))}><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      {hasSections && (
        <div className="flex flex-wrap items-center gap-3 pl-16 text-xs text-slate-400">
          <label className="flex items-center gap-1">หมวด
            <select className="bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-white" value={c.section ?? ''} onChange={e => patch(i, { section: Number(e.target.value) })}>
              {sections.map(s => <option key={s.no} value={s.no}>{s.no}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={!!c.assessmentMethod}
            onChange={e => setCriteria(l => l.map((x, k) => ({ ...x, assessmentMethod: k === i ? e.target.checked || undefined : undefined })))} />มีช่องระบุวิธีประเมินผลใต้ข้อนี้</label>
        </div>
      )}
    </li>
  );

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400">เวอร์ชันที่ใช้อยู่: {base.version}{base.version === 1 ? ' (แบบตั้งต้น)' : ''} · {criteria.length} ข้อ{tpls.versions.length > 1 ? ` · เคยมี ${tpls.versions.length} เวอร์ชัน` : ''}</p>
      {hasSections ? sections.map(sec => (
        <section key={sec.no} className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-cyan-300 shrink-0">หมวด {sec.no}</span>
            <input className={inputCls} maxLength={120} aria-label={`ชื่อหมวด ${sec.no}`} placeholder="ชื่อหมวด" value={sec.title}
              onChange={e => setSections(l => l.map(s => (s.no === sec.no ? { ...s, title: e.target.value } : s)))} />
            <button type="button" className={`${btn} text-rose-300`} aria-label={`ลบหมวด ${sec.no}`} onClick={() => { if (window.confirm(`ลบหมวด ${sec.no} และข้อทั้งหมดในหมวด?`)) removeSection(sec.no); }}><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
          <ul className="space-y-2">{criteria.map((c, i) => (c.section === sec.no ? row(c, i) : null))}</ul>
          <button type="button" disabled={criteria.length >= MAX_CRITERIA} className="flex items-center gap-1 text-xs text-cyan-300 disabled:opacity-40 cursor-pointer" onClick={() => addCriterion(sec.no)}><Plus className="w-3.5 h-3.5" />เพิ่มข้อในหมวด {sec.no}</button>
        </section>
      )) : (
        <>
          <ul className="space-y-2">{criteria.map((c, i) => row(c, i))}</ul>
          <button type="button" disabled={criteria.length >= MAX_CRITERIA} className="flex items-center gap-1 text-xs text-cyan-300 disabled:opacity-40 cursor-pointer" onClick={() => addCriterion()}><Plus className="w-3.5 h-3.5" />เพิ่มข้อ</button>
        </>
      )}
      {hasSections && <button type="button" disabled={sections.length >= MAX_SECTIONS || criteria.length >= MAX_CRITERIA} className="flex items-center gap-1 text-xs text-cyan-300 disabled:opacity-40 cursor-pointer" onClick={addSection}><Plus className="w-3.5 h-3.5" />เพิ่มหมวด</button>}
      {problem && dirty && <p role="alert" className="text-xs text-amber-300">{problem}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button disabled={busy || !dirty || !!problem} className="px-3 py-1.5 rounded-lg text-sm bg-cyan-600 text-white disabled:opacity-40 cursor-pointer" onClick={() => void save()}>บันทึกเป็นเวอร์ชัน {base.version + 1}</button>
        <button disabled={busy || !dirty} className="px-3 py-1.5 rounded-lg text-sm border border-slate-600 text-slate-300 disabled:opacity-40 cursor-pointer"
          onClick={() => { setCriteria(base.criteria.map(c => ({ ...c }))); setSections(base.sections.map(s => ({ ...s }))); setMsg(''); }}>ยกเลิกการแก้</button>
        {msg && <span role="status" className="text-xs text-slate-300">{msg}</span>}
      </div>
    </div>
  );
}
