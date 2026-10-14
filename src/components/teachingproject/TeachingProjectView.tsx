import React from 'react';
import { assessmentTotal, totalHours, type TeachingProject } from '../../lib/teachingProject';

/** แสดงโครงการสอนแบบอ่านอย่างเดียว (ผู้ตรวจ/ตัวอย่างก่อนบันทึก) — รูปแบบเดียวกับเอกสารโครงการสอนของโรงเรียน */
export function TeachingProjectView({ p }: { p: Pick<TeachingProject, 'courseCode' | 'courseName' | 'levelLabel' | 'credits' | 'hoursPerWeek' | 'courseType' | 'description' | 'indicators' | 'units' | 'assessment' | 'assessmentNote'> & { teacherName?: string } }) {
  return (
    <div className="space-y-4 text-sm text-slate-200">
      <div>
        <p className="text-white font-medium">{p.courseName} {p.courseCode}</p>
        <p className="text-xs text-slate-400">
          {p.levelLabel && `ระดับชั้น ${p.levelLabel} · `}{p.courseType && `${p.courseType} · `}
          {p.credits && `${p.credits} หน่วยกิต · `}{p.hoursPerWeek && `${p.hoursPerWeek} ชม./สัปดาห์`}
          {p.teacherName && ` · ครูผู้สอน ${p.teacherName}`}
        </p>
      </div>
      <section><h4 className="text-xs font-semibold text-slate-400">คำอธิบายรายวิชา</h4><p className="whitespace-pre-wrap">{p.description || '-'}</p></section>
      <section>
        <h4 className="text-xs font-semibold text-slate-400">ตัวชี้วัด</h4>
        {p.indicators.length === 0 ? <p>-</p> : <ol className="list-decimal pl-5 space-y-0.5">{p.indicators.map((t, i) => <li key={i}>{t}</li>)}</ol>}
      </section>
      <section>
        <h4 className="text-xs font-semibold text-slate-400">เนื้อหา กิจกรรม และสื่อการเรียนการสอน (รวม {totalHours(p.units)} ชม.)</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border border-slate-700">
            <thead className="bg-slate-800 text-slate-300"><tr><th className="p-2 border border-slate-700">สัปดาห์</th><th className="p-2 border border-slate-700 text-left">เนื้อหาสาระ</th><th className="p-2 border border-slate-700 text-left">กิจกรรม</th><th className="p-2 border border-slate-700 text-left">สื่อ</th></tr></thead>
            <tbody>
              {p.units.map(u => (
                <tr key={u.id} className={u.type === 'EXAM' ? 'bg-slate-800/50' : ''}>
                  <td className="p-2 border border-slate-700 text-center whitespace-nowrap">{u.weeks}</td>
                  <td className="p-2 border border-slate-700"><p className="font-medium">{u.title}{u.hours !== null && ` (${u.hours} ชม.)`}</p><p className="whitespace-pre-wrap text-slate-400">{u.detail}</p></td>
                  <td className="p-2 border border-slate-700 whitespace-pre-wrap">{u.activities}</td>
                  <td className="p-2 border border-slate-700 whitespace-pre-wrap">{u.media}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section>
        <h4 className="text-xs font-semibold text-slate-400">การวัดผลประเมินผล (รวม {assessmentTotal(p.assessment)}%)</h4>
        <ul className="space-y-0.5">{p.assessment.map((a, i) => <li key={i}>{a.label} — {a.percent}%</li>)}</ul>
        {p.assessmentNote && <p className="text-slate-400 mt-1">{p.assessmentNote}</p>}
      </section>
    </div>
  );
}
