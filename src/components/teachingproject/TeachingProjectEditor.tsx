import React, { useMemo, useState } from 'react';
import {
  MAX_UNITS, assessmentTotal, emptyUnit, isProjectReady, totalHours, validateProject,
  type AssessmentItem, type ProjectUnit, type TeachingProject,
} from '../../lib/teachingProject';
import type { ProjectContent } from '../../services/teachingProjectService';
import { TeachingProjectExcelBar } from './TeachingProjectExcelBar';
import type { ExcelContent } from '../../lib/teachingProjectExcel';

const inp = 'w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-sm text-white';
const lbl = 'text-xs text-slate-400 block mb-1';

export interface EditorInit extends ProjectContent { }

/** ฟอร์มโครงการสอนรายสัปดาห์ — ใช้กับทุกห้องที่สอนรหัสวิชาเดียวกัน */
export function TeachingProjectEditor({ init, onSave, onCancel, levelsNote, courseCode, courseName, semesterLabel }: {
  init: EditorInit; onSave: (c: ProjectContent) => Promise<unknown>; onCancel: () => void; levelsNote: string;
  courseCode?: string; courseName?: string; semesterLabel?: string;
}) {
  const [d, setD] = useState<EditorInit>(init);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const problems = useMemo(() => validateProject(d), [d]);
  const set = <K extends keyof EditorInit>(k: K, v: EditorInit[K]) => setD(s => ({ ...s, [k]: v }));
  const setUnit = (id: string, patch: Partial<ProjectUnit>) => set('units', d.units.map(u => (u.id === id ? { ...u, ...patch } : u)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir; if (j < 0 || j >= d.units.length) return;
    const a = [...d.units]; [a[i], a[j]] = [a[j], a[i]]; set('units', a);
  };
  const setAssess = (i: number, patch: Partial<AssessmentItem>) => set('assessment', d.assessment.map((a, k) => (k === i ? { ...a, ...patch } : a)));
  const total = assessmentTotal(d.assessment);
  const applyImport = (c: ExcelContent) => setD(s => ({ ...s, ...c }));

  const save = async () => {
    setBusy(true); setMsg('');
    try { await onSave(d); setMsg('บันทึกแล้ว'); } catch (e) { setMsg(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ'); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-4 rounded-xl border border-slate-700 bg-slate-900/60 p-4">
      <p className="text-xs text-cyan-300">โครงการสอนฉบับนี้ใช้กับทุกห้องที่ท่านสอนรหัสวิชานี้: {levelsNote || '-'}</p>
      <TeachingProjectExcelBar
        courseCode={courseCode || ''} courseName={courseName || ''} semesterLabel={semesterLabel || ''}
        draft={d} defaults={init} onImport={applyImport} />
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="sm:col-span-2"><label className={lbl}>ประเภทวิชา</label><input className={inp} list="tp-course-types" value={d.courseType} onChange={e => set('courseType', e.target.value)} maxLength={80} placeholder="เช่น สาระการเรียนรู้พื้นฐาน" />
          <datalist id="tp-course-types"><option value="สาระการเรียนรู้พื้นฐาน" /><option value="สาระการเรียนรู้เพิ่มเติม" /><option value="กิจกรรมพัฒนาผู้เรียน" /></datalist></div>
        <div><label className={lbl}>หน่วยกิต</label><input className={inp} value={d.credits} onChange={e => set('credits', e.target.value)} maxLength={10} placeholder="1.5" /></div>
        <div><label className={lbl}>ชั่วโมง/สัปดาห์</label><input className={inp} value={d.hoursPerWeek} onChange={e => set('hoursPerWeek', e.target.value)} maxLength={10} placeholder="3" /></div>
      </div>
      <div><label className={lbl}>ระดับชั้น</label><input className={inp} value={d.levelLabel} onChange={e => set('levelLabel', e.target.value)} maxLength={80} /></div>
      <div><label className={lbl}>คำอธิบายรายวิชา ({d.description.length}/2000)</label><textarea className={inp} rows={5} maxLength={2000} value={d.description} onChange={e => set('description', e.target.value)} /></div>
      <div><label className={lbl}>ตัวชี้วัด (1 บรรทัด = 1 ข้อ)</label>
        <textarea className={inp} rows={5} value={d.indicators.join('\n')} onChange={e => set('indicators', e.target.value.split('\n'))} /></div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm text-white font-medium">เนื้อหา กิจกรรม และสื่อ — แถวละ 1 บท/หัวข้อ (รวม {totalHours(d.units)} ชม.)</p>
          <div className="flex gap-2">
            <button type="button" disabled={d.units.length >= MAX_UNITS} className="px-2.5 py-1 rounded-lg text-xs bg-cyan-600 text-white cursor-pointer" onClick={() => set('units', [...d.units, emptyUnit('LESSON')])}>+ หัวข้อ</button>
            <button type="button" disabled={d.units.length >= MAX_UNITS} className="px-2.5 py-1 rounded-lg text-xs border border-slate-600 text-slate-300 cursor-pointer" onClick={() => set('units', [...d.units, emptyUnit('EXAM')])}>+ สอบ/แบบทดสอบ</button>
          </div>
        </div>
        {d.units.length === 0 && <p className="text-xs text-slate-400">ยังไม่มีแถว — กด "+ หัวข้อ" เพื่อเริ่ม (บันทึกหลังสอนจะเลือกหัวข้อจากรายการนี้)</p>}
        {d.units.map((u, i) => (
          <div key={u.id} className={`rounded-lg border p-3 space-y-2 ${u.type === 'EXAM' ? 'border-amber-500/40' : 'border-slate-700'}`}>
            <div className="grid gap-2 sm:grid-cols-6">
              <div><label className={lbl}>สัปดาห์</label><input className={inp} value={u.weeks} onChange={e => setUnit(u.id, { weeks: e.target.value })} placeholder="1-2" maxLength={7} /></div>
              <div className="sm:col-span-4"><label className={lbl}>{u.type === 'EXAM' ? 'การสอบ/แบบทดสอบ' : 'บท/หัวข้อ'}</label><input className={inp} value={u.title} onChange={e => setUnit(u.id, { title: e.target.value })} maxLength={200} /></div>
              <div><label className={lbl}>ชั่วโมง</label><input className={inp} inputMode="decimal" value={u.hours ?? ''} onChange={e => setUnit(u.id, { hours: e.target.value === '' ? null : Number(e.target.value) })} /></div>
            </div>
            {u.type === 'LESSON' && (
              <div className="grid gap-2 sm:grid-cols-3">
                <div><label className={lbl}>หัวข้อย่อย/เนื้อหาสาระ</label><textarea className={inp} rows={3} maxLength={1500} value={u.detail} onChange={e => setUnit(u.id, { detail: e.target.value })} /></div>
                <div><label className={lbl}>กิจกรรมการเรียนการสอน</label><textarea className={inp} rows={3} maxLength={800} value={u.activities} onChange={e => setUnit(u.id, { activities: e.target.value })} /></div>
                <div><label className={lbl}>สื่อ/แหล่งเรียนรู้</label><textarea className={inp} rows={3} maxLength={500} value={u.media} onChange={e => setUnit(u.id, { media: e.target.value })} /></div>
              </div>
            )}
            <div className="flex gap-2 text-xs">
              <button type="button" className="px-2 py-1 rounded border border-slate-600 text-slate-300 cursor-pointer" onClick={() => move(i, -1)} aria-label="เลื่อนขึ้น">↑</button>
              <button type="button" className="px-2 py-1 rounded border border-slate-600 text-slate-300 cursor-pointer" onClick={() => move(i, 1)} aria-label="เลื่อนลง">↓</button>
              <button type="button" className="px-2 py-1 rounded border border-rose-500/50 text-rose-300 cursor-pointer" onClick={() => { if (window.confirm('ลบแถวนี้? บันทึกหลังสอนที่เคยอ้างถึงหัวข้อนี้จะยังเก็บไว้แต่ไม่มีชื่อหัวข้อ')) set('units', d.units.filter(x => x.id !== u.id)); }}>ลบแถว</button>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm text-white font-medium">การวัดผลประเมินผล — รวม {total}% {total !== 100 && d.assessment.length > 0 && <span className="text-amber-300">(ควรรวม 100)</span>}</p>
          <button type="button" className="px-2.5 py-1 rounded-lg text-xs border border-slate-600 text-slate-300 cursor-pointer" onClick={() => set('assessment', [...d.assessment, { label: '', percent: 0 }])}>+ รายการ</button>
        </div>
        {d.assessment.map((a, i) => (
          <div key={i} className="flex gap-2">
            <input className={inp} placeholder="เช่น คะแนนระหว่างภาค / สอบกลางภาค" maxLength={120} value={a.label} onChange={e => setAssess(i, { label: e.target.value })} />
            <input className={`${inp} w-24`} inputMode="decimal" value={a.percent} onChange={e => setAssess(i, { percent: Number(e.target.value) || 0 })} aria-label="เปอร์เซ็นต์" />
            <button type="button" className="px-2 rounded border border-rose-500/50 text-rose-300 text-xs cursor-pointer" onClick={() => set('assessment', d.assessment.filter((_, k) => k !== i))}>ลบ</button>
          </div>
        ))}
        <textarea className={inp} rows={2} maxLength={500} placeholder="หมายเหตุการวัดผล เช่น สัดส่วนระหว่างภาค:ปลายภาค 70:30" value={d.assessmentNote} onChange={e => set('assessmentNote', e.target.value)} />
      </div>

      {problems.length > 0 && <ul role="alert" className="text-xs text-amber-300 list-disc pl-5">{problems.slice(0, 4).map(p => <li key={p}>{p}</li>)}</ul>}
      <p className="text-xs text-slate-400">สถานะ: {isProjectReady(d) ? 'ครบองค์ประกอบหลัก (คำอธิบาย ตัวชี้วัด และหัวข้อ)' : 'ยังไม่ครบ — ต้องมีคำอธิบาย ตัวชี้วัด และหัวข้ออย่างน้อย 1 รายการ'}</p>
      <div className="flex gap-2 items-center">
        <button type="button" disabled={busy || problems.length > 0} className="px-3 py-1.5 rounded-lg text-xs bg-cyan-600 text-white disabled:opacity-40 cursor-pointer" onClick={() => void save()}>บันทึก</button>
        <button type="button" className="px-3 py-1.5 rounded-lg text-xs border border-slate-600 text-slate-300 cursor-pointer" onClick={onCancel}>ปิด</button>
        {msg && <span role="status" className="text-xs text-slate-300">{msg}</span>}
      </div>
    </div>
  );
}
