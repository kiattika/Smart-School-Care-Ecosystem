import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, GraduationCap, RotateCcw, Trash2 } from 'lucide-react';
import { useStore } from '../../store';
import { useRealStudents } from '../../hooks/useRealStudents';
import { useCurrentSemester } from '../../hooks/useCurrentSemester';
import { StudentPicker } from '../shared/StudentPicker';
import { PortalSidebarLayout } from '../shared/PortalSidebarLayout';
import { DatePicker } from '../shared/DatePicker';
import { subscribeGradebookScoresForStudent } from '../../services/firestoreService';
import {
  approveGraduation, deleteGradeRetake, saveGradeRetake, subscribeGradeRetakesForStudent, subscribeGraduationApprovals,
} from '../../services/gradeRetakeService';
import { buildGradeRows, displayGrade, termOptions, type ScoreDoc } from '../../lib/gradeReport';
import {
  GRADUATION_NOTE_MAX, RETAKE_GRADE_OPTIONS, RETAKE_KIND_LABEL, RETAKE_NOTE_MAX, graduationLevelOf, needsRemedy,
  type GradeRetake, type GraduationApproval, type RetakeKind,
} from '../../lib/gradeRetake';

const todayIso = () => new Date().toISOString().slice(0, 10);

/** รายการที่ยังไม่ผ่านของนักเรียน (0/ร/มส/มผ) ทุกภาคเรียน ที่ยังไม่มีผลแก้ตัว — ใช้เกรดเดิมจากคะแนนครู */
function useStudentRecords(studentId: string) {
  const [scores, setScores] = useState<ScoreDoc[]>([]);
  const [retakes, setRetakes] = useState<GradeRetake[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    setScores([]); setRetakes([]); setError('');
    if (!studentId) return;
    const a = subscribeGradebookScoresForStudent(studentId, l => setScores(l as ScoreDoc[]), e => setError(e.message));
    const b = subscribeGradeRetakesForStudent(studentId, setRetakes, e => setError(e.message));
    return () => { a(); b(); };
  }, [studentId]);
  return { scores, retakes, error };
}

function RetakePanel({ canDelete }: { canDelete: boolean }) {
  const user = useStore(s => s.user);
  const { students } = useRealStudents();
  const [sid, setSid] = useState('');
  const { scores, retakes, error } = useStudentRecords(sid);
  const student = students.find(s => s.studentId === sid);
  // แถวต้องแก้ = เกรดเดิมเข้าข่าย 0/ร/มส/มผ (ไม่รวมแถวที่มีผลแก้ตัวแล้ว — ดูในรายการด้านล่าง)
  const pending = useMemo(() => {
    const out: Array<{ term: string; code: string; name: string; original: string }> = [];
    for (const term of termOptions(scores)) {
      for (const r of buildGradeRows({ term, scores })) {
        const g = displayGrade(r, true);
        if (g && needsRemedy(g)) out.push({ term, code: r.code, name: r.name, original: g });
      }
    }
    return out;
  }, [scores]);
  const doneKeys = new Set(retakes.map(r => `${r.term}|${r.courseCode}`));
  const [sel, setSel] = useState('');
  const [kind, setKind] = useState<RetakeKind>('MAKEUP');
  const [newGrade, setNewGrade] = useState('');
  const [date, setDate] = useState(todayIso());
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const target = pending.find(p => `${p.term}|${p.code}` === sel);

  const submit = async () => {
    if (!target || !student) return;
    setBusy(true); setMsg('');
    try {
      await saveGradeRetake({ studentId: sid, term: target.term, courseCode: target.code, courseName: target.name, kind, originalGrade: target.original, newGrade, retakeDate: date, note },
        student.room, { staffId: user?.staffId || '', name: user?.displayName || '' });
      setMsg('บันทึกแล้ว'); setSel(''); setNewGrade(''); setNote('');
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400">บันทึกผลแก้ตัว/เรียนซ้ำของวิชาที่ได้ 0 / ร / มส / มผ — ระบบแสดงเกรดใหม่คู่กับเกรดเดิม และคำนวณเกรดเฉลี่ยด้วยเกรดใหม่</p>
      <StudentPicker mode="single" students={students} value={sid} onSelect={setSid} placeholder="ค้นหาด้วยเลขประจำตัวหรือชื่อ" />
      {error && <p role="alert" className="text-xs text-amber-300">{error}</p>}
      {student && (
        <>
          <div className="rounded-xl border border-slate-700 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-100">รายวิชาที่ต้องแก้ ({student.name} · {student.room})</h3>
            {pending.filter(p => !doneKeys.has(`${p.term}|${p.code}`)).length === 0
              ? <p className="text-xs text-slate-400">ไม่มีรายวิชาค้างแก้</p>
              : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <select aria-label="เลือกรายวิชา" className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm sm:col-span-2" value={sel} onChange={e => setSel(e.target.value)}>
                    <option value="">เลือกรายวิชา</option>
                    {pending.filter(p => !doneKeys.has(`${p.term}|${p.code}`)).map(p => (
                      <option key={`${p.term}|${p.code}`} value={`${p.term}|${p.code}`}>{p.term} · {p.code} {p.name} (เดิม {p.original})</option>
                    ))}
                  </select>
                  <select aria-label="ประเภท" className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm" value={kind} onChange={e => setKind(e.target.value as RetakeKind)}>
                    {(Object.keys(RETAKE_KIND_LABEL) as RetakeKind[]).map(k => <option key={k} value={k}>{RETAKE_KIND_LABEL[k]}</option>)}
                  </select>
                  <select aria-label="เกรดใหม่" className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm" value={newGrade} onChange={e => setNewGrade(e.target.value)}>
                    <option value="">เกรดใหม่</option>
                    {RETAKE_GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <DatePicker value={date} onChange={setDate} />
                  <input aria-label="หมายเหตุ" maxLength={RETAKE_NOTE_MAX} placeholder="หมายเหตุ (ถ้ามี)" className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm" value={note} onChange={e => setNote(e.target.value)} />
                  <button disabled={!target || !newGrade || busy} onClick={submit} className="rounded-lg bg-orange-500 text-slate-950 font-semibold px-4 py-2 text-sm disabled:opacity-40 sm:col-span-2">บันทึกผล</button>
                </div>
              )}
            {msg && <p role="status" className="text-xs text-slate-300">{msg}</p>}
          </div>
          <div className="rounded-xl border border-slate-700 p-4">
            <h3 className="text-sm font-semibold text-slate-100 mb-2">ผลแก้ตัว/เรียนซ้ำที่บันทึกแล้ว</h3>
            {retakes.length === 0 ? <p className="text-xs text-slate-400">ยังไม่มีรายการ</p> : (
              <ul className="divide-y divide-slate-800">
                {retakes.map(r => (
                  <li key={r.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                    <span>{r.term} · {r.courseCode} {r.courseName} — เดิม {r.originalGrade} → <b>{r.newGrade}</b> ({RETAKE_KIND_LABEL[r.kind]}, {r.retakeDate}) <span className="text-xs text-slate-500">โดย {r.recordedByName}</span></span>
                    {canDelete && (
                      <button aria-label="ลบรายการ" className="text-red-400 hover:text-red-300" onClick={() => { if (window.confirm('ลบผลแก้ตัวรายการนี้?')) deleteGradeRetake(r.id).catch(e => setMsg((e as Error).message)); }}><Trash2 className="w-4 h-4" /></button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function GraduationPanel({ canApprove }: { canApprove: boolean }) {
  const user = useStore(s => s.user);
  const sem = useCurrentSemester();
  const { students } = useRealStudents();
  const [sid, setSid] = useState('');
  const { scores, retakes, error } = useStudentRecords(sid);
  const [approvals, setApprovals] = useState<GraduationApproval[]>([]);
  useEffect(() => {
    setApprovals([]);
    if (!sid) return;
    return subscribeGraduationApprovals(sid, setApprovals, () => setApprovals([]));
  }, [sid]);
  const student = students.find(s => s.studentId === sid);
  const level = graduationLevelOf(student?.room);
  const unresolved = useMemo(() => {
    const out: string[] = [];
    for (const term of termOptions(scores)) {
      for (const r of buildGradeRows({ term, scores, retakes })) {
        const g = r.retake ? r.retake.newGrade : displayGrade(r, true);
        if (g && needsRemedy(g)) out.push(`${term} ${r.code} ${r.name} (${g})`);
      }
    }
    return out;
  }, [scores, retakes]);
  const [year, setYear] = useState('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const academicYear = year || String(sem.academicYear || '');
  const approved = level ? approvals.find(a => a.level === level) : undefined;

  const submit = async () => {
    if (!student || !level) return;
    if (unresolved.length > 0 && !window.confirm(`ยังมี ${unresolved.length} รายวิชาที่ยังไม่ผ่าน ต้องการอนุมัติต่อหรือไม่?`)) return;
    setMsg('');
    try { await approveGraduation({ studentId: sid, level, academicYear, note }, student.room, { staffId: user?.staffId || '', name: user?.displayName || '' }); setMsg('อนุมัติแล้ว'); }
    catch (e) { setMsg((e as Error).message); }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400">อนุมัติจบหลักสูตร (ม.3 / ม.6) รายบุคคล — ระบบแจ้งเตือนหากยังมีรายวิชาที่ยังไม่ผ่าน (0 / ร / มส / มผ) หลังนับผลแก้ตัวแล้ว</p>
      <StudentPicker mode="single" students={students} value={sid} onSelect={setSid} placeholder="ค้นหาด้วยเลขประจำตัวหรือชื่อ" />
      {error && <p role="alert" className="text-xs text-amber-300">{error}</p>}
      {student && (
        <div className="rounded-xl border border-slate-700 p-4 space-y-3 text-sm">
          <p className="font-semibold text-slate-100">{student.name} · {student.room}</p>
          {!level ? <p className="text-slate-400">ห้องนี้ไม่ใช่ชั้นที่จบหลักสูตร (ม.3 / ม.6)</p> : (
            <>
              {unresolved.length > 0
                ? <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-amber-200"><p className="font-semibold">ยังไม่ผ่าน {unresolved.length} รายวิชา</p><ul className="list-disc pl-5 text-xs">{unresolved.map(u => <li key={u}>{u}</li>)}</ul></div>
                : <p className="text-emerald-300 text-xs">ไม่พบรายวิชาที่ยังไม่ผ่านในข้อมูลที่ครูบันทึก</p>}
              {approved
                ? <p className="text-emerald-300">อนุมัติจบ {approved.level} ปีการศึกษา {approved.academicYear} แล้ว โดย {approved.approvedByName}</p>
                : canApprove ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input aria-label="ปีการศึกษา" inputMode="numeric" maxLength={4} className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2" value={academicYear} onChange={e => setYear(e.target.value)} />
                    <input aria-label="หมายเหตุ" maxLength={GRADUATION_NOTE_MAX} placeholder="หมายเหตุ (ถ้ามี)" className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2" value={note} onChange={e => setNote(e.target.value)} />
                    <button onClick={submit} className="rounded-lg bg-orange-500 text-slate-950 font-semibold px-4 py-2 sm:col-span-2">อนุมัติจบหลักสูตร {level}</button>
                  </div>
                ) : <p className="text-slate-400 text-xs">ผู้ช่วยงานทะเบียนอนุมัติจบหลักสูตรไม่ได้ (เฉพาะงานทะเบียนวัดผล)</p>}
              {msg && <p role="status" className="text-xs text-slate-300">{msg}</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function RegistrarPortal() {
  const roles = useStore(s => s.user?.profile?.roles) || [];
  const isRegistrar = roles.includes('REGISTRAR') || roles.includes('SUPER_ADMIN');
  const [tab, setTab] = useState<'retake' | 'graduation'>('retake');
  return (
    <PortalSidebarLayout
      title="งานทะเบียนวัดผล"
      activeId={tab}
      onSelect={id => setTab(id as 'retake' | 'graduation')}
      items={[
        { id: 'retake', label: 'แก้ตัว / เรียนซ้ำ', icon: RotateCcw },
        { id: 'graduation', label: 'อนุมัติจบหลักสูตร', icon: GraduationCap },
      ]}
    >
      <div className="p-4 sm:p-6 max-w-3xl space-y-4">
        <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2"><ClipboardCheck className="w-5 h-5 text-orange-400" />งานทะเบียนวัดผล</h2>
        {tab === 'retake' ? <RetakePanel canDelete={isRegistrar} /> : <GraduationPanel canApprove={isRegistrar} />}
      </div>
    </PortalSidebarLayout>
  );
}
