import React, { useState } from 'react';
import { useCurrentSemester } from '../../hooks/useCurrentSemester';
import { usePlcLogs, useReflections } from '../../hooks/usePlcAndReflections';
import { PLC_STEP_LABEL, groupPlcCycles, isCycleComplete, participantIds } from '../../lib/plc';
import { REFLECTION_FIELDS, isReflectionComplete } from '../../lib/reflection';
import { semesterIdOf, type PlanQuery } from '../../lib/lessonPlans';

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
  const rows = [...byTeacher.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name, 'th'));
  if (rows.length === 0) return <p className="text-sm text-slate-400">ยังไม่มีบันทึก PLC หรือสะท้อนคิดในภาคเรียนนี้</p>;
  return (
    <ul className="space-y-2">
      {rows.map(([id, t]) => {
        const cycles = groupPlcCycles(t.plc);
        return (
          <li key={id} className="rounded-xl border border-slate-700 bg-slate-900/40 p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><p className="text-sm text-white">{t.name}</p>
                <p className="text-xs text-slate-400">PLC {cycles.length} วงจร (ครบ PDCA {cycles.filter(c => isCycleComplete(c.steps)).length}) · สะท้อนคิด: {t.refl ? (isReflectionComplete(t.refl) ? 'ครบ' : 'ยังไม่ครบ') : 'ยังไม่เขียน'}</p></div>
              <button className="px-3 py-1.5 rounded-lg text-xs border border-slate-600 text-slate-300 cursor-pointer" onClick={() => setOpen(open === id ? '' : id)}>{open === id ? 'ซ่อน' : 'ดู'}</button>
            </div>
            {open === id && (
              <div className="space-y-3 text-xs text-slate-200">
                {cycles.map(c => (
                  <div key={c.key}><p className="font-medium text-white">{c.groupName} — {c.topic}</p>
                    <ul className="list-disc pl-5">{c.logs.map(l => <li key={l.id}>{thDate(l.meetingDate)} · {PLC_STEP_LABEL[l.step]}: {l.summary}</li>)}</ul></div>
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
