import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useAllSchedules } from '../../hooks/useAllSchedules';
import { useRealStudents } from '../../hooks/useRealStudents';
import { useCurrentSemester } from '../../hooks/useCurrentSemester';
import { subscribeApRosters } from '../../services/apRosterService';
import { semesterIdOf } from '../../lib/lessonPlans';
import { computeApReport, type ApRosterDoc, type ApScheduleLike } from '../../lib/apCourses';

const DAY_TH: Record<string, string> = { monday: 'จันทร์', tuesday: 'อังคาร', wednesday: 'พุธ', thursday: 'พฤหัสบดี', friday: 'ศุกร์', saturday: 'เสาร์', sunday: 'อาทิตย์' };

/**
 * รายงานนักเรียนตกหล่น/ซ้ำของคาบวิชา AP — เห็นได้โดยครู AP (เฉพาะคาบที่ตนสอน ส่ง `onlyStaffId`) และ
 * หัวหน้ากลุ่มงานวิชาการและหลักสูตร (ทั้งโรงเรียน) — ตรวจจากรายชื่อที่ครูยืนยันใน ap_rosters จริงเท่านั้น
 */
export function ApFallThroughReport({ onlyStaffId }: { onlyStaffId?: string }) {
  const sem = useCurrentSemester();
  const { data: schedules, loading, error } = useAllSchedules();
  const { students } = useRealStudents();
  const [rosters, setRosters] = useState<ApRosterDoc[]>([]);
  const [rosterErr, setRosterErr] = useState('');
  const semesterId = semesterIdOf(sem.academicYear, sem.term);
  useEffect(() => subscribeApRosters(semesterId, setRosters, e => setRosterErr(e.message)), [semesterId]);

  const nameOf = useMemo(() => new Map(students.map(s => [s.studentId, s.name])), [students]);
  const groups = useMemo(() => {
    const all = computeApReport(schedules as ApScheduleLike[], rosters, students);
    return onlyStaffId ? all.filter(g => g.courses.some(c => c.teacherIds.includes(onlyStaffId))) : all;
  }, [schedules, rosters, students, onlyStaffId]);

  if (loading) return <p className="text-sm text-slate-400">กำลังโหลดข้อมูล…</p>;
  if (error || rosterErr) return <p className="text-sm text-red-400">โหลดข้อมูลไม่สำเร็จ: {error || rosterErr}</p>;
  if (groups.length === 0) return <p className="text-sm text-slate-400">ไม่พบวิชา AP ในตารางสอนภาคเรียนนี้</p>;

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400">
        นับนักเรียนที่อยู่ในห้องที่รวมกันในคาบ AP แต่ไม่อยู่ในรายชื่อที่ครู AP ท่านใดยืนยัน — นักเรียนที่เรียนวิชาอื่นที่ไม่ใช่ AP ในคาบเดียวกันจะขึ้นในรายการนี้ด้วย โปรดตรวจสอบกับครูก่อน
      </p>
      {groups.map(g => (
        <section key={g.key} className="bg-slate-900/50 border border-slate-700/40 rounded-xl p-4 space-y-2">
          <h3 className="text-sm font-bold text-white">
            {DAY_TH[g.day] || g.day} คาบ {g.period} · ห้อง {g.levels.join(', ')} · นักเรียนในห้อง {g.poolCount} คน
          </h3>
          <ul className="text-xs text-slate-300 space-y-0.5">
            {g.courses.map(c => (
              <li key={c.code}>{c.name} — {c.confirmed ? `ยืนยันแล้ว ${c.count} คน` : <span className="text-amber-400">ครูยังไม่ยืนยันรายชื่อ</span>}</li>
            ))}
          </ul>
          {!g.hasConfirmedRoster ? (
            <p className="text-xs text-amber-400 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> ยังไม่มีครูยืนยันรายชื่อเลย จึงยังตรวจนักเรียนตกหล่นไม่ได้</p>
          ) : g.fallThrough.length === 0 ? (
            <p className="text-xs text-emerald-400 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> ไม่มีนักเรียนตกหล่น</p>
          ) : (
            <div>
              <p className="text-xs text-red-400 font-bold flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> ตกหล่น {g.fallThrough.length} คน (ยังไม่มีครู AP รับเข้าห้อง)</p>
              <ul className="mt-1 grid sm:grid-cols-2 gap-x-4 text-xs text-slate-200">
                {g.fallThrough.map(f => <li key={f.studentId}>{nameOf.get(f.studentId) || f.studentId} <span className="text-slate-500">({f.room} · {f.studentId})</span></li>)}
              </ul>
            </div>
          )}
          {g.duplicates.length > 0 && (
            <div>
              <p className="text-xs text-amber-400 font-bold">อยู่ในรายชื่อมากกว่า 1 วิชาในคาบเดียวกัน {g.duplicates.length} คน</p>
              <ul className="mt-1 text-xs text-slate-300">
                {g.duplicates.map(d => <li key={d.studentId}>{nameOf.get(d.studentId) || d.studentId}: {d.courses.join(' / ')}</li>)}
              </ul>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
