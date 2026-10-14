import React, { useEffect, useMemo, useState } from 'react';
import { StudentPicker } from '../shared/StudentPicker';
import { ConductEntryForm } from './ConductEntryForm';
import { subscribeConductForStudent } from '../../services/conductService';
import { subscribeGateAttendanceLogs } from '../../services/firestoreService';
import {
  CONDUCT_STATUS_LABEL, OFFENCE_LEVEL_LABEL, conductBand, deductionAction, type ConductEntry,
} from '../../lib/conduct';
import type { GateAttendanceRecord, Student } from '../../types';

/** งานกิจการ: รายบุคคล — คะแนนคงเหลือ/ถูกหักสะสม/เกณฑ์ดำเนินการ + ประวัติ + บันทึกคะแนน + เช็คอินเข้า-ออกรายบุคคล */
export function StudentConductPanel({ students }: { students: Student[] }) {
  const [sid, setSid] = useState('');
  const student = students.find(s => s.studentId === sid);
  const [entries, setEntries] = useState<ConductEntry[]>([]);
  const [gate, setGate] = useState<GateAttendanceRecord[]>([]);
  const [err, setErr] = useState('');
  useEffect(() => {
    setEntries([]); setErr('');
    if (!sid) return;
    return subscribeConductForStudent(sid, setEntries, e => setErr(e.message));
  }, [sid]);
  useEffect(() => {
    setGate([]);
    if (!student?.studentUid) return;
    return subscribeGateAttendanceLogs(setGate, { studentUid: student.studentUid });
  }, [student?.studentUid]);

  const totals = useMemo(() => {
    let added = 0, deducted = 0;
    for (const e of entries) if (e.status === 'APPLIED') { if (e.kind === 'ADD') added += e.appliedPoints; else deducted += e.appliedPoints; }
    return { added, deducted };
  }, [entries]);
  const score = student?.behaviorScore ?? 100;
  const action = deductionAction(totals.deducted);

  return (
    <div className="space-y-4">
      <StudentPicker mode="single" students={students} value={sid} onSelect={setSid} placeholder="ค้นหาด้วยเลขประจำตัวหรือชื่อ" />
      {err && <p role="alert" className="text-xs text-amber-300">{err}</p>}
      {student && (
        <>
          <div className="grid gap-3 sm:grid-cols-4 text-sm">
            <div className="rounded-xl border border-slate-700 p-3"><p className="text-xs text-slate-400">คะแนนคงเหลือ</p><p className="text-2xl font-bold text-lime-300">{score}</p><p className="text-xs text-slate-400">{conductBand(score)}</p></div>
            <div className="rounded-xl border border-slate-700 p-3"><p className="text-xs text-slate-400">เพิ่มสะสม (ระบบใหม่)</p><p className="text-2xl font-bold text-emerald-300">+{totals.added}</p></div>
            <div className="rounded-xl border border-slate-700 p-3"><p className="text-xs text-slate-400">ถูกหักสะสม (ระบบใหม่)</p><p className="text-2xl font-bold text-rose-300">-{totals.deducted}</p></div>
            <div className="rounded-xl border border-slate-700 p-3"><p className="text-xs text-slate-400">เกณฑ์ดำเนินการ</p><p className="text-sm font-semibold text-amber-300">{action ? `ถึง ${action.at} คะแนน: ${action.label}` : 'ยังไม่ถึงเกณฑ์'}</p></div>
          </div>
          <div className="rounded-xl border border-slate-700 p-4">
            <h3 className="text-sm font-semibold text-slate-100 mb-3">บันทึกคะแนน ({student.name})</h3>
            <ConductEntryForm studentId={student.studentId} />
          </div>
          <div className="rounded-xl border border-slate-700 p-4">
            <h3 className="text-sm font-semibold text-slate-100 mb-2">ประวัติคะแนน</h3>
            {entries.length === 0 ? <p className="text-xs text-slate-400">ยังไม่มีรายการในระบบใหม่</p> : (
              <ul className="divide-y divide-slate-800 text-sm">
                {entries.map(e => (
                  <li key={e.id} className="py-2">
                    <span className={e.kind === 'ADD' ? 'text-emerald-300' : 'text-rose-300'}>{e.kind === 'ADD' ? '+' : '-'}{e.status === 'APPLIED' || e.status === 'REVERSED' ? e.appliedPoints : e.points}</span>
                    {' '}{e.kind === 'DEDUCT' && `(ระดับ${OFFENCE_LEVEL_LABEL[e.level]}) `}{e.category && `${e.category} · `}{e.reason}
                    <span className="text-xs text-slate-500"> · {e.date} · {e.createdByName} · {CONDUCT_STATUS_LABEL[e.status]}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-xl border border-slate-700 p-4">
            <h3 className="text-sm font-semibold text-slate-100 mb-2">เช็คอินเข้า-ออกโรงเรียน (รายบุคคล)</h3>
            {gate.length === 0 ? <p className="text-xs text-slate-400">ไม่พบบันทึกเช็คอิน{student.studentUid ? '' : ' (นักเรียนยังไม่ผูกบัญชี)'}</p> : (
              <ul className="divide-y divide-slate-800 text-sm max-h-60 overflow-y-auto">
                {gate.slice(0, 60).map(g => <li key={g.id} className="py-1.5">{g.date} {g.timestamp} — {g.type === 'ENTRY' ? 'เข้าโรงเรียน' : 'ออกจากโรงเรียน'}{g.status === 'LATE' ? ' (สาย)' : ''}</li>)}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
