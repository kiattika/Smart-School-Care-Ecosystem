import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, ClipboardCheck, GraduationCap, RotateCcw, Trash2 } from 'lucide-react';
import { useStore } from '../../store';
import { useRealStudents } from '../../hooks/useRealStudents';
import { useCurrentSemester } from '../../hooks/useCurrentSemester';
import { StudentPicker } from '../shared/StudentPicker';
import { PortalSidebarLayout } from '../shared/PortalSidebarLayout';
import { DatePicker } from '../shared/DatePicker';
import { getGradebookScoresByRoom, subscribeGradebookScoresForStudent } from '../../services/firestoreService';
import { graduateStudents } from '../../services/studentLifecycle';
import { applyRoomTransfer, decideRoomTransfer, requestRoomTransfer, subscribeRoomTransfers } from '../../services/roomTransferService';
import { TRANSFER_COMMITTEE_MAX, TRANSFER_NOTE_MAX, TRANSFER_REASON_MAX, TRANSFER_STATUS_LABEL, type RoomTransfer } from '../../lib/roomTransfer';
import { isSameRoom } from '../../lib/utils';
import {
  deleteGradeRetake, getGradeRetakesForRoom, saveGradeRetake, subscribeGradeRetakesForStudent,
} from '../../services/gradeRetakeService';
import { buildGradeRows, displayGrade, termOptions, type ScoreDoc } from '../../lib/gradeReport';
import {
  GRADUATION_LEVELS, GRADUATION_NOTE_MAX, RETAKE_GRADE_OPTIONS, RETAKE_KIND_LABEL, RETAKE_NOTE_MAX, graduationLevelOf, needsRemedy,
  type GradeRetake, type GraduationLevel, type RetakeKind,
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
  const { students } = useRealStudents(); // เฉพาะนักเรียนที่ยังศึกษาอยู่
  const [level, setLevel] = useState<GraduationLevel>('ม.6');
  const [year, setYear] = useState('');
  const [note, setNote] = useState('');
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [unresolved, setUnresolved] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const cohort = useMemo(() => students.filter(s => graduationLevelOf(s.room) === level), [students, level]);
  const rooms = useMemo(() => [...new Set<string>(cohort.map(s => s.room || ''))].filter(Boolean).sort((a, b) => a.localeCompare(b, 'th', { numeric: true })), [cohort]);
  const academicYear = year || String(sem.academicYear || '');

  // วิชาที่ยังไม่ผ่าน (หลังนับผลแก้ตัว) ต่อคน — โหลดครั้งเดียวต่อระดับชั้น เพื่อให้งานทะเบียนติ๊กออกคนที่ไม่จบ
  useEffect(() => {
    let alive = true;
    setExcluded(new Set()); setUnresolved(new Map());
    if (rooms.length === 0) return;
    setLoading(true);
    Promise.all(rooms.map(async r => [await getGradebookScoresByRoom(r), await getGradeRetakesForRoom(r)] as const)).then(parts => {
      if (!alive) return;
      const scores = parts.flatMap(p => p[0] as unknown as ScoreDoc[]);
      const retakes = parts.flatMap(p => p[1]);
      const out = new Map<string, number>();
      for (const st of cohort) {
        const mine = scores.filter(x => x.studentId === st.studentId);
        let n = 0;
        for (const term of termOptions(mine)) {
          for (const row of buildGradeRows({ term, scores: mine, retakes: retakes.filter(x => x.studentId === st.studentId) })) {
            const g = row.retake ? row.retake.newGrade : displayGrade(row, true);
            if (g && needsRemedy(g)) n++;
          }
        }
        if (n > 0) out.set(st.studentId, n);
      }
      setUnresolved(out); setLoading(false);
    }).catch(e => { if (alive) { setMsg(`ตรวจวิชาค้างไม่ได้: ${(e as Error).message}`); setLoading(false); } });
    return () => { alive = false; };
  }, [rooms, cohort]);

  const toggle = (id: string) => setExcluded(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const selected = cohort.filter(s => !excluded.has(s.studentId));

  const submit = async () => {
    if (selected.length === 0) return;
    if (!window.confirm(`อนุมัติจบหลักสูตร ${level} จำนวน ${selected.length} คน? นักเรียนที่อนุมัติจะถูกซ่อนจากรายชื่อทั้งระบบ`)) return;
    setBusy(true); setMsg('');
    try {
      const r = await graduateStudents(selected.map(s => ({ studentId: s.studentId, room: s.room || '' })), { level, academicYear, note }, { staffId: user?.staffId || '', name: user?.displayName || '' });
      setMsg(`อนุมัติจบแล้ว ${r.graduated} คน${r.skipped ? ` (ข้าม ${r.skipped} คนที่ไม่ได้ศึกษาอยู่)` : ''}`);
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400">อนุมัติจบหลักสูตรทั้งชั้นครั้งเดียว (ขั้นเดียว) — ทุกคนถูกติ๊กไว้ ให้เอาเครื่องหมายออกจากนักเรียนที่ไม่จบก่อนกดอนุมัติ นักเรียนที่อนุมัติแล้วเปลี่ยนสถานะเป็น "จบการศึกษา" และถูกซ่อนจากรายชื่อในระบบ (ไม่มีผลทางกฎหมาย)</p>
      <div className="flex flex-wrap gap-3">
        <select aria-label="ระดับชั้นที่จบ" className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm" value={level} onChange={e => setLevel(e.target.value as GraduationLevel)}>
          {GRADUATION_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <input aria-label="ปีการศึกษา" inputMode="numeric" maxLength={4} className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm w-28" value={academicYear} onChange={e => setYear(e.target.value)} />
        <input aria-label="หมายเหตุ" maxLength={GRADUATION_NOTE_MAX} placeholder="หมายเหตุ (ถ้ามี)" className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm flex-1 min-w-[12rem]" value={note} onChange={e => setNote(e.target.value)} />
      </div>
      {loading && <p className="text-xs text-slate-400">กำลังตรวจรายวิชาที่ยังไม่ผ่าน…</p>}
      {cohort.length === 0 ? <p className="text-sm text-slate-400">ไม่มีนักเรียน {level} ที่ยังศึกษาอยู่</p> : (
        <div className="space-y-3">
          {rooms.map(room => (
            <div key={room} className="rounded-xl border border-slate-700 p-3">
              <p className="text-sm font-semibold text-slate-100 mb-2">{room} ({cohort.filter(s => s.room === room).length} คน)</p>
              <ul className="grid gap-1 sm:grid-cols-2">
                {cohort.filter(s => s.room === room).map(s => (
                  <li key={s.studentId}>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={!excluded.has(s.studentId)} onChange={() => toggle(s.studentId)} />
                      <span>{s.studentNo ? `${s.studentNo}. ` : ''}{s.name}</span>
                      {unresolved.has(s.studentId) && <span className="text-[11px] text-amber-300">ยังไม่ผ่าน {unresolved.get(s.studentId)} วิชา</span>}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {canApprove
            ? <button disabled={busy || loading || selected.length === 0} onClick={submit} className="rounded-lg bg-orange-500 text-slate-950 font-semibold px-4 py-2 text-sm disabled:opacity-40">อนุมัติจบหลักสูตร {level} ({selected.length} คน)</button>
            : <p className="text-xs text-slate-400">ผู้ช่วยงานทะเบียนอนุมัติจบหลักสูตรไม่ได้ (เฉพาะงานทะเบียนวัดผล)</p>}
        </div>
      )}
      {msg && <p role="status" className="text-xs text-slate-300">{msg}</p>}
    </div>
  );
}

function TransferPanel({ canDecide }: { canDecide: boolean }) {
  const user = useStore(s => s.user);
  const { students } = useRealStudents();
  const [transfers, setTransfers] = useState<RoomTransfer[]>([]);
  const [error, setError] = useState('');
  useEffect(() => subscribeRoomTransfers(setTransfers, e => setError(e.message)), []);
  const by = { staffId: user?.staffId || '', name: user?.displayName || '' };
  const rooms = useMemo(() => [...new Set<string>(students.map(s => s.room || '').filter(Boolean))].sort((a, b) => a.localeCompare(b, 'th', { numeric: true })), [students]);
  // คณะสีของห้องปลายทาง = คณะสีเดียวที่นักเรียนในห้องนั้นสังกัด (หลายคณะ/ยังไม่จัด = ไม่กำหนด ให้จัดภายหลัง)
  const houseOfRoom = (room: string): string | null => {
    const set = new Set<string>(students.filter(s => isSameRoom(s.room, room)).map(s => s.houseId || '').filter(Boolean));
    return set.size === 1 ? [...set][0] : null;
  };
  const [sid, setSid] = useState('');
  const [toRoom, setToRoom] = useState('');
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState('');
  const student = students.find(s => s.studentId === sid);

  const submit = async () => {
    if (!student) return;
    setMsg('');
    try {
      await requestRoomTransfer({ studentId: sid, studentName: student.name, toRoom, toHouseId: houseOfRoom(toRoom), reason }, by);
      setMsg('ยื่นคำขอแล้ว รอคณะกรรมการพิจารณา'); setSid(''); setToRoom(''); setReason('');
    } catch (e) { setMsg((e as Error).message); }
  };

  const [dec, setDec] = useState<Record<string, { committee: string; date: string; note: string; eff: string }>>({});
  const f = (id: string) => dec[id] || { committee: '', date: todayIso(), note: '', eff: todayIso() };
  const set = (id: string, p: Partial<{ committee: string; date: string; note: string; eff: string }>) => setDec(d => ({ ...d, [id]: { ...f(id), ...p } }));
  const run = async (fn: () => Promise<void>) => { setMsg(''); try { await fn(); } catch (e) { setMsg((e as Error).message); } };

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400">ย้ายห้อง: ยื่นคำขอ → คณะกรรมการพิจารณา (งานทะเบียนบันทึกมติ) → ดำเนินการย้าย ระบบเก็บห้อง/คณะสีเดิมไว้เป็นประวัติ ผลงานก่อนวันที่มีผลนับให้คณะสีเดิม หลังจากนั้นนับให้คณะสีของห้องใหม่</p>
      {error && <p role="alert" className="text-xs text-amber-300">{error}</p>}
      <div className="rounded-xl border border-slate-700 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-100">ยื่นคำขอย้ายห้อง</h3>
        <StudentPicker mode="single" students={students} value={sid} onSelect={setSid} placeholder="ค้นหาด้วยเลขประจำตัวหรือชื่อ" />
        {student && (
          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <p className="sm:col-span-2 text-slate-300">ห้องเดิม: {student.room || '-'}</p>
            <select aria-label="ห้องปลายทาง" className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2" value={toRoom} onChange={e => setToRoom(e.target.value)}>
              <option value="">เลือกห้องปลายทาง</option>
              {rooms.filter(r => !isSameRoom(r, student.room)).map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <input aria-label="เหตุผล" maxLength={TRANSFER_REASON_MAX} placeholder="เหตุผลการย้าย" className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2" value={reason} onChange={e => setReason(e.target.value)} />
            <button disabled={!toRoom || !reason.trim()} onClick={submit} className="rounded-lg bg-orange-500 text-slate-950 font-semibold px-4 py-2 disabled:opacity-40 sm:col-span-2">ยื่นคำขอ</button>
          </div>
        )}
      </div>
      {msg && <p role="status" className="text-xs text-slate-300">{msg}</p>}
      <div className="rounded-xl border border-slate-700 p-4">
        <h3 className="text-sm font-semibold text-slate-100 mb-2">คำขอและประวัติการย้ายห้อง</h3>
        {transfers.length === 0 ? <p className="text-xs text-slate-400">ยังไม่มีรายการ</p> : (
          <ul className="divide-y divide-slate-800">
            {transfers.map(t => (
              <li key={t.id} className="py-3 text-sm space-y-2">
                <p><b>{t.studentName}</b> ({t.studentId}) {t.fromRoom} → {t.toRoom} <span className="text-xs text-slate-400">· {TRANSFER_STATUS_LABEL[t.status]}{t.effectiveDate ? ` (มีผล ${t.effectiveDate})` : ''}</span></p>
                <p className="text-xs text-slate-400">เหตุผล: {t.reason} · ยื่นโดย {t.requestedByName}</p>
                {t.decisionCommittee && <p className="text-xs text-slate-400">มติ: {t.decisionCommittee} ({t.decisionDate}){t.decisionNote ? ` — ${t.decisionNote}` : ''}</p>}
                {t.status === 'PENDING' && canDecide && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input aria-label="คณะกรรมการ/เลขที่คำสั่ง" maxLength={TRANSFER_COMMITTEE_MAX} placeholder="คณะกรรมการ/เลขที่คำสั่ง/มติ" className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2" value={f(t.id).committee} onChange={e => set(t.id, { committee: e.target.value })} />
                    <DatePicker value={f(t.id).date} onChange={v => set(t.id, { date: v })} />
                    <input aria-label="หมายเหตุมติ" maxLength={TRANSFER_NOTE_MAX} placeholder="หมายเหตุ" className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 sm:col-span-2" value={f(t.id).note} onChange={e => set(t.id, { note: e.target.value })} />
                    <button className="rounded-lg bg-emerald-500 text-slate-950 font-semibold px-3 py-2" onClick={() => run(() => decideRoomTransfer(t.id, { decision: 'APPROVED', committee: f(t.id).committee, date: f(t.id).date, note: f(t.id).note }, by))}>อนุมัติ</button>
                    <button className="rounded-lg bg-red-500/80 text-white font-semibold px-3 py-2" onClick={() => run(() => decideRoomTransfer(t.id, { decision: 'REJECTED', committee: f(t.id).committee, date: f(t.id).date, note: f(t.id).note }, by))}>ไม่อนุมัติ</button>
                  </div>
                )}
                {t.status === 'APPROVED' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-400">วันที่มีผล</span>
                    <DatePicker value={f(t.id).eff} onChange={v => set(t.id, { eff: v })} />
                    <button className="rounded-lg bg-orange-500 text-slate-950 font-semibold px-3 py-2" onClick={() => run(() => applyRoomTransfer(t, f(t.id).eff, by))}>ดำเนินการย้ายห้อง</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function RegistrarPortal() {
  const roles = useStore(s => s.user?.profile?.roles) || [];
  const isRegistrar = roles.includes('REGISTRAR') || roles.includes('SUPER_ADMIN');
  const [tab, setTab] = useState<'retake' | 'transfer' | 'graduation'>('retake');
  return (
    <PortalSidebarLayout
      title="งานทะเบียนวัดผล"
      activeId={tab}
      onSelect={id => setTab(id as 'retake' | 'transfer' | 'graduation')}
      items={[
        { id: 'retake', label: 'แก้ตัว / เรียนซ้ำ', icon: RotateCcw },
        { id: 'transfer', label: 'ย้ายห้อง', icon: ArrowRightLeft },
        { id: 'graduation', label: 'อนุมัติจบหลักสูตร', icon: GraduationCap },
      ]}
    >
      <div className="p-4 sm:p-6 max-w-3xl space-y-4">
        <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2"><ClipboardCheck className="w-5 h-5 text-orange-400" />งานทะเบียนวัดผล</h2>
        {tab === 'retake' ? <RetakePanel canDelete={isRegistrar} /> : tab === 'transfer' ? <TransferPanel canDecide={isRegistrar} /> : <GraduationPanel canApprove={isRegistrar} />}
      </div>
    </PortalSidebarLayout>
  );
}
