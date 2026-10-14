import React, { useState } from 'react';
import { useCurrentSemester } from '../../hooks/useCurrentSemester';
import { usePlcLogs, useReflections } from '../../hooks/usePlcAndReflections';
import { PLC_STEP_LABEL, groupPlcCycles, isCycleComplete, participantIds } from '../../lib/plc';
import { REFLECTION_FIELDS, isReflectionComplete } from '../../lib/reflection';
import { isStoragePhotoUrl, linksOf } from '../../lib/evidenceLinks';
import { semesterIdOf, type PlanQuery } from '../../lib/lessonPlans';

/** โทนสีประจำกลุ่ม PLC (กลุ่มเดียวกันใช้สีเดียวกัน) — class เขียนเต็มเพื่อให้ Tailwind สแกนเจอ */
const TONES = [
  { row: 'border-l-4 border-l-sky-400 bg-sky-500/10', chip: 'bg-sky-500/20 text-sky-200 border-sky-400/40' },
  { row: 'border-l-4 border-l-emerald-400 bg-emerald-500/10', chip: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40' },
  { row: 'border-l-4 border-l-violet-400 bg-violet-500/10', chip: 'bg-violet-500/20 text-violet-200 border-violet-400/40' },
  { row: 'border-l-4 border-l-amber-400 bg-amber-500/10', chip: 'bg-amber-500/20 text-amber-200 border-amber-400/40' },
  { row: 'border-l-4 border-l-rose-400 bg-rose-500/10', chip: 'bg-rose-500/20 text-rose-200 border-rose-400/40' },
  { row: 'border-l-4 border-l-teal-400 bg-teal-500/10', chip: 'bg-teal-500/20 text-teal-200 border-teal-400/40' },
  { row: 'border-l-4 border-l-fuchsia-400 bg-fuchsia-500/10', chip: 'bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-400/40' },
  { row: 'border-l-4 border-l-lime-400 bg-lime-500/10', chip: 'bg-lime-500/20 text-lime-200 border-lime-400/40' },
];
const NEUTRAL = { row: 'border-l-4 border-l-slate-600 bg-slate-900/40', chip: 'bg-slate-800 text-slate-300 border-slate-600' };
const cycleKeyOf = (l: { groupName: string; topic: string }) => `${l.groupName.trim()}||${l.topic.trim()}`;

const thDate = (ymd: string) => { const [y, m, d] = ymd.split('-').map(Number); return y ? `${d}/${m}/${y + 543}` : ymd; };

/** ผู้ตรวจ/ผู้บริหารดู PLC และบันทึกสะท้อนคิดของครูในขอบเขตสิทธิ์ (อ่านอย่างเดียว) */
export function PlcReflectionOverview({ q }: { q: PlanQuery }) {
  const sem = useCurrentSemester();
  const semesterId = semesterIdOf(sem.academicYear, sem.term);
  const plc = usePlcLogs(semesterId, q);
  const refl = useReflections(semesterId, q);
  const [open, setOpen] = useState('');
  const err = plc.error || refl.error;
  if (err) return <p role="alert" className="text-sm text-amber-300">โหลดไม่สำเร็จ: {err}</p>;
  if (plc.loading || refl.loading) return <p className="text-sm text-slate-400">กำลังโหลด…</p>;

  const byTeacher = new Map<string, { name: string; plc: typeof plc.data; refl?: (typeof refl.data)[number] }>();
  // 1 บันทึกนับให้ทั้งผู้บันทึกและสมาชิกที่เลือกจากทะเบียน (ชื่อสมาชิกอ้างจากสำเนาที่เก็บคู่กับ memberStaffIds)
  plc.data.forEach(l => {
    participantIds(l).forEach((sid, idx) => {
      const name = idx === 0 ? l.authorName : (l.members[idx - 1] || sid);
      const e = byTeacher.get(sid) || { name, plc: [] };
      e.plc.push(l); byTeacher.set(sid, e);
    });
  });
  refl.data.forEach(r => { const e = byTeacher.get(r.teacherStaffId) || { name: r.teacherName, plc: [] }; e.refl = r; byTeacher.set(r.teacherStaffId, e); });
  // สีต่อกลุ่ม (ชื่อกลุ่ม+ประเด็น) และจัดครูในกลุ่มเดียวกันให้อยู่ติดกัน: เรียงตามกลุ่มหลัก (วงจรล่าสุดของครู) แล้วตามชื่อ
  const groupKeys = [...new Set(plc.data.map(cycleKeyOf))].sort((x, y) => x.localeCompare(y, 'th'));
  const toneOf = (key: string) => { const i = groupKeys.indexOf(key); return i < 0 ? NEUTRAL : TONES[i % TONES.length]; };
  const primaryKey = (list: typeof plc.data) => (list.length ? cycleKeyOf(groupPlcCycles(list)[0]) : '');
  const rows = [...byTeacher.entries()]
    .map(([id, t]) => ({ id, t, pk: primaryKey(t.plc) }))
    .sort((a, b) => (a.pk ? groupKeys.indexOf(a.pk) : 999) - (b.pk ? groupKeys.indexOf(b.pk) : 999) || a.t.name.localeCompare(b.t.name, 'th'));
  if (rows.length === 0) return <p className="text-sm text-slate-400">ยังไม่มีบันทึก PLC หรือสะท้อนคิดในภาคเรียนนี้</p>;
  return (
    <ul className="space-y-2">
      {rows.map(({ id, t, pk }) => {
        const cycles = groupPlcCycles(t.plc);
        return (
          <li key={id} className={`rounded-xl border border-slate-700 p-3 space-y-2 ${toneOf(pk).row}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><p className="text-sm text-white">{t.name}</p>
                <p className="text-xs text-slate-400">PLC {cycles.length} วงจร (ครบ PDCA {cycles.filter(c => isCycleComplete(c.steps)).length}) · สะท้อนคิด: {t.refl ? (isReflectionComplete(t.refl) ? 'ครบ' : 'ยังไม่ครบ') : 'ยังไม่เขียน'}</p>
                {cycles.length > 0 && <div className="flex flex-wrap gap-1.5 mt-1.5">{cycles.map(c => <span key={c.key} className={`text-[11px] px-2 py-0.5 rounded-full border ${toneOf(c.key).chip}`}>{c.groupName}</span>)}</div>}</div>
              <button className="px-3 py-1.5 rounded-lg text-xs border border-slate-600 text-slate-300 cursor-pointer" onClick={() => setOpen(open === id ? '' : id)}>{open === id ? 'ซ่อน' : 'ดู'}</button>
            </div>
            {open === id && (
              <div className="space-y-3 text-xs text-slate-200">
                {cycles.map(c => (
                  <div key={c.key} className={`rounded-lg border p-2.5 space-y-2 ${toneOf(c.key).chip}`}>
                    <p className="font-medium text-white">{c.groupName} — {c.topic}</p>
                    <ul className="space-y-2">{c.logs.map(l => {
                      const links = linksOf(l);
                      const who = [l.authorName, ...l.members].filter(Boolean);
                      return (
                        <li key={l.id} className="rounded-lg bg-slate-950/60 border border-slate-800 p-2 space-y-1 text-slate-200">
                          <p className="text-slate-300">{thDate(l.meetingDate)} · {PLC_STEP_LABEL[l.step]} · บันทึกโดย {l.authorName}</p>
                          <p><span className="text-slate-400">สมาชิกในกลุ่ม ({who.length} คน):</span> {who.join(', ')}</p>
                          <p className="whitespace-pre-wrap"><span className="text-slate-400">สรุป:</span> {l.summary}</p>
                          {l.outcome && <p className="whitespace-pre-wrap"><span className="text-slate-400">ผลที่ได้:</span> {l.outcome}</p>}
                          {l.nextAction && <p className="whitespace-pre-wrap"><span className="text-slate-400">สิ่งที่จะทำต่อ:</span> {l.nextAction}</p>}
                          {links.length > 0 && <p className="flex flex-wrap gap-x-3"><span className="text-slate-400">หลักฐาน:</span>{links.map((u, i) => <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">ลิงก์ {i + 1}</a>)}</p>}
                          {(l.photos || []).filter(isStoragePhotoUrl).length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-1">{(l.photos || []).filter(isStoragePhotoUrl).map((u, i) => <a key={u} href={u} target="_blank" rel="noopener noreferrer"><img src={u} alt={`รูป PLC ${i + 1}`} className="w-24 h-24 object-cover rounded-lg border border-slate-700" /></a>)}</div>
                          )}
                        </li>
                      );
                    })}</ul>
                  </div>
                ))}
                {t.refl && REFLECTION_FIELDS.map(f => <p key={f.id}><span className="text-slate-400">{f.label}:</span> <span className="whitespace-pre-wrap">{t.refl![f.id] || '-'}</span></p>)}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
