import React, { useEffect, useMemo, useState } from 'react';
import { Printer, Info } from 'lucide-react';
import { useTeacherFirestoreSchedule } from '../../hooks/useTeacherFirestoreSchedule';
import { useCurrentSemester } from '../../hooks/useCurrentSemester';
import { subscribeGradebookScoresForStudent } from '../../services/firestoreService';
import { isScheduleForRoom } from '../../lib/studentDaySchedule';
import { RegistryHeaderCard, useRegistryProfile } from './RegistryHeaderCard';
import {
  GRADE_REPORT_DISCLAIMER, buildGradeRows, summarizeGrades, termLabel, termOptions,
  type CourseInfo, type ScoreDoc,
} from '../../lib/gradeReport';

const fmt = (v: number | null, d = 0) => (v === null ? '' : Number.isInteger(v) && d === 0 ? String(v) : v.toFixed(d || 1));
/** รหัสภายในของชุมนุม (ELECTIVE_<id>) ไม่ใช่รหัสวิชาจริง — ไม่แสดง */
const showCode = (c: string) => (/^ELECTIVE_/.test(c) ? '-' : c);

/**
 * รายงานผลการเรียนรายภาคเรียน (ใช้ร่วมกันหน้านักเรียน/ผู้ปกครอง) — อ่านคะแนนจริงจาก gradebook_scores ของนักเรียนคนนั้น
 * เป็นคะแนนไม่เป็นทางการ ต้องมีหมายเหตุกำกับเสมอ (ทั้งบนจอและฉบับพิมพ์)
 */
export function StudentGradeReport({ studentId, studentName, room }: { studentId: string; studentName?: string; room?: string }) {
  const sem = useCurrentSemester();
  const currentTerm = `${sem.term}/${sem.academicYear}`;
  const { schedules } = useTeacherFirestoreSchedule();
  const [scores, setScores] = useState<ScoreDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [picked, setPicked] = useState('');
  const reg = useRegistryProfile(studentId);

  useEffect(() => {
    setLoading(true); setError('');
    return subscribeGradebookScoresForStudent(studentId, (l) => { setScores(l as ScoreDoc[]); setLoading(false); }, (e) => { setError(e.message); setLoading(false); });
  }, [studentId]);

  const terms = useMemo(() => termOptions(scores, sem.loading ? undefined : currentTerm), [scores, sem.loading, currentTerm]);
  const term = terms.includes(picked) ? picked : terms[0] || '';
  const courses: CourseInfo[] = useMemo(() => (schedules as any[])
    .filter(s => isScheduleForRoom(s, room))
    .map(s => ({ code: String(s.subjectCode || s.courseCode || ''), name: String(s.subjectName || s.courseName || ''), credits: typeof s.credits === 'number' ? s.credits : undefined, subjectType: s.subjectType || s.type })),
  [schedules, room]);
  const rows = useMemo(() => buildGradeRows({ term, scores, courses, includeSchedule: term === currentTerm }), [term, scores, courses, currentTerm]);
  const sum = useMemo(() => summarizeGrades(rows), [rows]);

  return (
    <div className="space-y-4">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #gr-sheet, #gr-sheet * { visibility: visible !important; }
          #gr-sheet { position: absolute; left: 0; top: 0; width: 100%; margin: 0 !important; box-shadow: none !important; }
          .gr-no-print { display: none !important; }
        }
      `}</style>

      <div role="note" className="gr-no-print flex gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-100">
        <Info className="w-4 h-4 shrink-0 mt-0.5" /><p>{GRADE_REPORT_DISCLAIMER}</p>
      </div>

      <div className="gr-no-print flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="ภาคเรียน">
          {terms.map(t => (
            <button key={t} role="tab" aria-selected={t === term} onClick={() => setPicked(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${t === term ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-slate-900 border-slate-700 text-slate-300'}`}>{t}</button>
          ))}
        </div>
        <button onClick={() => window.print()} disabled={rows.length === 0} className="px-3 py-1.5 rounded-lg text-xs bg-slate-800 border border-slate-700 text-slate-200 disabled:opacity-40 flex items-center gap-1.5 cursor-pointer"><Printer className="w-3.5 h-3.5" /> พิมพ์ / บันทึกเป็น PDF</button>
      </div>

      {error && <p role="alert" className="text-sm text-amber-300">โหลดคะแนนไม่สำเร็จ: {error}</p>}
      {!loading && rows.length === 0 && (
        <div className="gr-no-print bg-white text-black rounded-xl p-4"><RegistryHeaderCard studentId={studentId} studentName={studentName} room={room} profile={reg.data} parents={reg.parents} loading={reg.loading} error={reg.error} /></div>
      )}
      {loading ? <p className="text-sm text-slate-400">กำลังโหลด…</p> : rows.length === 0 ? (
        <p className="text-sm text-slate-400 border border-dashed border-slate-700 rounded-xl p-6 text-center">
          {terms.length === 0 ? 'ยังไม่มีคะแนนที่ครูบันทึกไว้' : 'ยังไม่มีคะแนนในภาคเรียนนี้'}
        </p>
      ) : (
        <div id="gr-sheet" className="bg-white text-black rounded-xl p-4 sm:p-6 shadow-xl overflow-x-auto" style={{ fontFamily: "'Sarabun','TH Sarabun New','Noto Sans Thai',sans-serif" }}>
          <h3 className="text-base font-bold">รายงานผลการเรียน {termLabel(term)}{studentName ? ` — ${studentName}` : ''}</h3>
          <div className="mt-2" />
          <RegistryHeaderCard studentId={studentId} studentName={studentName} room={room} profile={reg.data} parents={reg.parents} loading={reg.loading} error={reg.error} />
          <table className="w-full text-xs border-collapse min-w-[760px]">
            <thead>
              <tr className="bg-cyan-50">
                <th rowSpan={2} className="border border-gray-400 px-2 py-1">รหัสวิชา</th>
                <th rowSpan={2} className="border border-gray-400 px-2 py-1 text-left">ชื่อวิชา</th>
                <th rowSpan={2} className="border border-gray-400 px-2 py-1">หน่วยกิต</th>
                {['ก่อนกลางภาค', 'สอบกลางภาค', 'หลังกลางภาค', 'สอบปลายภาค'].map(h => <th key={h} colSpan={2} className="border border-gray-400 px-2 py-1">{h}</th>)}
                <th colSpan={2} className="border border-gray-400 px-2 py-1">รวม</th>
                <th rowSpan={2} className="border border-gray-400 px-2 py-1">ร้อยละ</th>
                <th rowSpan={2} className="border border-gray-400 px-2 py-1">ผลการเรียน</th>
              </tr>
              <tr className="bg-cyan-50">{Array.from({ length: 5 }).flatMap((_, i) => [<th key={`f${i}`} className="border border-gray-400 px-1 py-0.5 font-normal">เต็ม</th>, <th key={`g${i}`} className="border border-gray-400 px-1 py-0.5 font-normal">ได้</th>])}</tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.code}>
                  <td className="border border-gray-400 px-2 py-1 text-center font-mono">{showCode(r.code)}</td>
                  <td className="border border-gray-400 px-2 py-1">{r.name}</td>
                  <td className="border border-gray-400 px-2 py-1 text-center">{r.credits === null ? '-' : r.credits.toFixed(1)}</td>
                  {(['pre', 'mid', 'post', 'final'] as const).flatMap(k => [
                    <td key={`${k}m`} className="border border-gray-400 px-1 py-1 text-center">{r.isActivity ? '' : fmt(r.max[k])}</td>,
                    <td key={`${k}p`} className="border border-gray-400 px-1 py-1 text-center">{fmt(r.parts[k])}</td>,
                  ])}
                  <td className="border border-gray-400 px-1 py-1 text-center">{r.isActivity ? '' : r.maxTotal === null ? (r.hasScore ? '' : '') : fmt(r.maxTotal)}</td>
                  <td className="border border-gray-400 px-1 py-1 text-center font-semibold">{fmt(r.total)}</td>
                  <td className="border border-gray-400 px-1 py-1 text-center">{r.percent === null ? '' : r.percent.toFixed(2)}</td>
                  <td className="border border-gray-400 px-2 py-1 text-center font-bold">{r.grade ?? <span className="font-normal text-gray-500">ยังไม่มีผล</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 text-xs space-y-0.5">
            <p><b>เกรดเฉลี่ย (ไม่เป็นทางการ):</b> {sum.gpa === null ? 'ยังคำนวณไม่ได้' : sum.gpa.toFixed(2)}{sum.creditsCounted > 0 ? ` (จาก ${sum.creditsCounted.toFixed(1)} หน่วยกิต)` : ''}</p>
            {sum.missingCredits > 0 && <p className="text-gray-600">มี {sum.missingCredits} วิชาที่ไม่มีข้อมูลหน่วยกิต จึงไม่นับในเกรดเฉลี่ย</p>}
            {sum.pending > 0 && <p className="text-gray-600">{sum.pending} วิชายังไม่มีผลการเรียน</p>}
            {(sum.activityPassed + sum.activityFailed) > 0 && <p>วิชากิจกรรม: ผ่าน (ผ) {sum.activityPassed} · ไม่ผ่าน (มผ) {sum.activityFailed}</p>}
          </div>
          <p className="mt-3 text-[11px] text-red-700 border-t border-gray-300 pt-2">{GRADE_REPORT_DISCLAIMER}</p>
        </div>
      )}
    </div>
  );
}
