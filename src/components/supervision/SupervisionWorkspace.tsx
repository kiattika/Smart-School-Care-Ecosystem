import React, { useMemo, useState } from 'react';
import { BarChart3, ClipboardList, FileText, ListChecks, Plus, Settings2, Trash2 } from 'lucide-react';
import { useStore } from '../../store';
import { isStaffActive } from '../../lib/staffStatus';
import { useCurrentSemester } from '../../hooks/useCurrentSemester';
import { useDepartments } from '../../hooks/useDepartments';
import { useRoundAssignments, useRoundObservations, useSupervisionRounds } from '../../hooks/useSupervision';
import {
  canEditEvaluationTemplates, canManageSupervision, isSupervisor, supervisionRoundId,
  type SupervisionObservation, type SupervisionRound,
} from '../../lib/supervision';
import {
  OBS_STATUS_LABEL, observableTeachers, observationStatus, overviewQuery, progressCounts, resultsQuery,
  staffDepartmentId, staffFullName, isObservableTeacher, type StaffRow,
} from '../../lib/supervisionView';
import {
  addSupervisionAssignment, openSupervisionRound, removeSupervisionAssignment, setSupervisionRoundStatus,
} from '../../services/supervisionService';
import { ObservationForm } from './ObservationForm';
import { ObservationResultView } from './ObservationResultView';
import { LessonPlanReviewPanel } from '../lessonplans/LessonPlanReviewPanel';
import { planOverviewQuery } from '../../lib/lessonPlans';
import { SupervisionOverviewPanel } from './SupervisionOverviewPanel';
import { EvaluationTemplateEditor } from './EvaluationTemplateEditor';

export type Tab = 'observe' | 'results' | 'overview' | 'plans' | 'manage' | 'templates';

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'ดำเนินการไม่สำเร็จ');

export interface SupervisionTabItem { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }

/** เมนูย่อยของงานนิเทศตามสิทธิ์จริงของผู้ใช้ (ว่าง = ไม่มีงานในระบบนิเทศ) */
export function useSupervisionTabs(): SupervisionTabItem[] {
  const roles = (useStore(s => s.user?.profile?.roles) || []) as string[];
  const staffId = useStore(s => s.user?.staffId) || '';
  const staff = useStore(s => s.staffDirectory) as StaffRow[];
  const myDept = staffDepartmentId(staff.find(s => s.id === staffId));
  return useMemo(() => [
    ...(isSupervisor(roles) ? [{ id: 'observe' as Tab, label: 'ลงนิเทศ', icon: ClipboardList }] : []),
    ...(resultsQuery(roles, staffId, myDept) ? [{ id: 'results' as Tab, label: 'ผลการนิเทศ', icon: FileText }] : []),
    ...(overviewQuery(roles) ? [{ id: 'overview' as Tab, label: 'ภาพรวม', icon: BarChart3 }] : []),
    ...(planOverviewQuery(roles, myDept) ? [{ id: 'plans' as Tab, label: 'ตรวจแผนการสอน', icon: FileText }] : []),
    ...(canManageSupervision(roles) ? [{ id: 'manage' as Tab, label: 'จัดการรอบ/จับคู่', icon: Settings2 }] : []),
    ...(canEditEvaluationTemplates(roles) ? [{ id: 'templates' as Tab, label: 'แบบประเมิน', icon: ListChecks }] : []),
  ], [roles, staffId, myDept]);
}

/** เนื้อหาของเมนูที่เลือก (ไม่มีแถบเมนูของตัวเอง — ผู้เรียกใช้ใส่เมนูเอง) */
export function SupervisionWorkspace({ tab }: { tab: Tab }) {
  const user = useStore(s => s.user);
  const staff = useStore(s => s.staffDirectory) as StaffRow[];
  const sem = useCurrentSemester();
  const { data: rounds, error: roundsError } = useSupervisionRounds();
  const roles = (user?.profile?.roles || []) as string[];
  const staffId = user?.staffId || '';
  const me = staff.find(s => s.id === staffId);
  const canManage = canManageSupervision(roles);

  const [roundState, setRoundState] = useState('');
  const roundId = rounds.find(r => r.id === roundState)?.id || rounds[0]?.id || null;
  const round = rounds.find(r => r.id === roundId) || null;

  if (tab === 'plans') return <LessonPlanReviewPanel />;
  if (tab === 'templates') return canEditEvaluationTemplates(roles) ? <EvaluationTemplateEditor /> : null;
  if (!user || !staffId) return <p className="text-sm text-slate-400">บัญชีนี้ไม่ได้เชื่อมกับทะเบียนบุคลากร จึงใช้งานระบบนิเทศไม่ได้</p>;

  return (
    <div className="space-y-4">
      <RoundPicker rounds={rounds} value={roundId} onChange={setRoundState} error={roundsError} />
      {tab === 'manage' && <ManageTab rounds={rounds} round={round} staff={staff} currentLabel={sem} userStaffId={staffId} />}
      {tab !== 'manage' && !round && !roundsError && (
        <p className="text-sm text-slate-400">ยังไม่มีรอบนิเทศ{canManage ? ' — เปิดรอบใหม่ได้ที่เมนู "จัดการรอบ/จับคู่"' : ' — รอหัวหน้างานนิเทศเปิดรอบ'}</p>
      )}
      {round && tab === 'observe' && <ObserveTab round={round} staff={staff} meRow={me} />}
      {round && tab === 'results' && <ResultsTab round={round} staff={staff} />}
      {round && tab === 'overview' && <OverviewTab round={round} staff={staff} />}
    </div>
  );
}

/** ใช้ในหน้าที่มีแถบเมนูอยู่แล้ว (ศูนย์อนุมัติ) — สลับเมนูย่อยด้วยปุ่มแถบเล็ก ไม่ซ้อน sidebar */
export function SupervisionEmbedded({ startTab }: { startTab?: Tab } = {}) {
  const tabs = useSupervisionTabs();
  const [pick, setPick] = useState<Tab | ''>(startTab ?? '');
  const tab = (tabs.find(t => t.id === pick)?.id || tabs[0]?.id || '') as Tab | '';
  if (tabs.length === 0) return <p className="text-sm text-slate-400">บทบาทปัจจุบันไม่มีเมนูในระบบนิเทศ</p>;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist">
        {tabs.map(t => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setPick(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm cursor-pointer border ${tab === t.id ? 'bg-cyan-600 border-cyan-400 text-white' : 'bg-slate-900 border-slate-700 text-slate-300'}`}>
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>
      {tab && <SupervisionWorkspace tab={tab} />}
    </div>
  );
}

function RoundPicker({ rounds, value, onChange, error }: { rounds: SupervisionRound[]; value: string | null; onChange: (v: string) => void; error: string | null }) {
  if (error) return <p role="alert" className="text-sm text-amber-300">โหลดรอบนิเทศไม่สำเร็จ: {error}</p>;
  if (rounds.length === 0) return null;
  return (
    <label className="text-xs text-slate-400 flex items-center gap-2">รอบนิเทศ
      <select className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white" value={value || ''} onChange={e => onChange(e.target.value)}>
        {rounds.map(r => <option key={r.id} value={r.id}>ภาคเรียน {r.term}/{r.academicYear} ({r.status === 'OPEN' ? 'เปิดอยู่' : 'ปิดแล้ว'})</option>)}
      </select>
    </label>
  );
}

// ───────────────────────── ลงนิเทศ ─────────────────────────
function ObserveTab({ round, staff, meRow }: { round: SupervisionRound; staff: StaffRow[]; meRow: StaffRow | undefined }) {
  const user = useStore(s => s.user)!;
  const roles = (user.profile.roles || []) as string[];
  const staffId = user.staffId || '';
  const dept = staffDepartmentId(meRow);
  const { data: myAssignments, loading: aLoading, error: aErr } = useRoundAssignments(round.id, { kind: 'SUPERVISOR', staffId });
  const { data: mine, loading: oLoading, error: oErr } = useRoundObservations(round.id, { scope: 'SUPERVISED', staffId });
  const [target, setTarget] = useState<StaffRow | null>(null);

  const teachers = useMemo(
    () => observableTeachers({ staffId, roles, departmentId: dept }, staff, myAssignments),
    [staffId, roles, dept, staff, myAssignments],
  );
  const byTeacher = new Map<string, SupervisionObservation>(mine.map(o => [o.teacherStaffId, o]));
  const prog = progressCounts(teachers, mine);

  if (aErr || oErr) return <p role="alert" className="text-sm text-amber-300">โหลดข้อมูลไม่สำเร็จ: {aErr || oErr}</p>;
  if (aLoading || oLoading) return <p className="text-sm text-slate-400">กำลังโหลด…</p>;

  if (target) {
    const existing = byTeacher.get(target.id) || null;
    const name = staffFullName(target);
    if (existing?.submitted) return <ObservationResultView obs={existing} onClose={() => setTarget(null)} />;
    return (
      <ObservationForm
        roundId={round.id}
        teacher={{ staffId: target.id, name, departmentId: staffDepartmentId(target) }}
        supervisor={{ staffId, name: staffFullName(meRow) || user.displayName, uid: user.uid }}
        existing={existing}
        onClose={() => setTarget(null)}
      />
    );
  }

  return (
    <div className="bg-[#161f30] border border-slate-800/80 rounded-xl p-4 sm:p-6 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-bold text-white">ครูที่ต้องนิเทศ ({prog.total} คน)</h3>
        <p className="text-xs text-slate-400">ส่งผลแล้ว {prog.SUBMITTED + prog.ACKNOWLEDGED} · ฉบับร่าง {prog.DRAFT} · ยังไม่นิเทศ {prog.NONE}</p>
      </div>
      {round.status !== 'OPEN' && <p className="text-sm text-amber-300">รอบนี้ปิดแล้ว — ลงนิเทศเพิ่มไม่ได้</p>}
      {teachers.length === 0 && <p className="text-sm text-slate-400">ยังไม่มีครูที่ได้รับมอบหมายให้นิเทศในรอบนี้</p>}
      <ul className="divide-y divide-slate-800">
        {teachers.map(t => {
          const o = byTeacher.get(t.id);
          const st = observationStatus(o);
          return (
            <li key={t.id} className="py-2 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-white">{staffFullName(t)}</p>
                <p className="text-xs text-slate-400">{OBS_STATUS_LABEL[st]}{o?.percent != null && ` · ${o.percent}% ${o.band}`}</p>
              </div>
              <button
                disabled={round.status !== 'OPEN' && !o}
                onClick={() => setTarget(t)}
                className="px-3 py-1.5 text-sm rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white cursor-pointer disabled:opacity-40"
              >{st === 'NONE' ? 'เริ่มนิเทศ' : st === 'DRAFT' ? 'ทำต่อ' : 'ดูผล'}</button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ───────────────────────── ผลการนิเทศ (รายบุคคลตามสิทธิ์) ─────────────────────────
function ResultsTab({ round, staff }: { round: SupervisionRound; staff: StaffRow[] }) {
  const user = useStore(s => s.user)!;
  const roles = (user.profile.roles || []) as string[];
  const staffId = user.staffId || '';
  const dept = staffDepartmentId(staff.find(s => s.id === staffId));
  const q = useMemo(() => resultsQuery(roles, staffId, dept), [roles, staffId, dept]);
  const { data, loading, error } = useRoundObservations(round.id, q);
  const [open, setOpen] = useState<SupervisionObservation | null>(null);
  const { departments } = useDepartments();
  const deptName = (id: string) => departments.find(d => d.id === id)?.name || id;

  if (error) return <p role="alert" className="text-sm text-amber-300">โหลดผลไม่สำเร็จ: {error}</p>;
  if (loading) return <p className="text-sm text-slate-400">กำลังโหลด…</p>;
  if (open) return <ObservationResultView obs={open} onClose={() => setOpen(null)} />;
  if (data.length === 0) return <p className="text-sm text-slate-400">ยังไม่มีผลการนิเทศในรอบนี้</p>;
  const sorted = [...data].sort((a, b) => a.teacherName.localeCompare(b.teacherName, 'th'));
  return (
    <div className="bg-[#161f30] border border-slate-800/80 rounded-xl p-4 sm:p-6">
      <h3 className="text-lg font-bold text-white mb-2">ผลการนิเทศ ({sorted.length} คน)</h3>
      <ul className="divide-y divide-slate-800">
        {sorted.map(o => (
          <li key={o.id} className="py-2 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-white">{o.teacherName}</p>
              <p className="text-xs text-slate-400">{deptName(o.departmentId)} · ผู้นิเทศ {o.supervisorName} · {OBS_STATUS_LABEL[observationStatus(o)]}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-cyan-300">{o.percent != null ? `${o.percent}% ${o.band}` : '-'}</span>
              <button onClick={() => setOpen(o)} className="px-3 py-1.5 text-sm rounded-lg bg-slate-700 hover:bg-slate-600 text-white cursor-pointer">ดู</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ───────────────────────── ภาพรวม ─────────────────────────
function OverviewTab({ round, staff }: { round: SupervisionRound; staff: StaffRow[] }) {
  const roles = (useStore(s => s.user)?.profile.roles || []) as string[];
  const q = useMemo(() => overviewQuery(roles), [roles]);
  const { data, loading, error } = useRoundObservations(round.id, q);
  if (error) return <p role="alert" className="text-sm text-amber-300">โหลดภาพรวมไม่สำเร็จ: {error}</p>;
  if (loading) return <p className="text-sm text-slate-400">กำลังโหลด…</p>;
  return <SupervisionOverviewPanel title={`ภาพรวมการนิเทศ ภาคเรียน ${round.term}/${round.academicYear}`} observations={data} totalTeachers={staff.filter(isObservableTeacher).length} />;
}

// ───────────────────────── จัดการรอบ/จับคู่ ─────────────────────────
function ManageTab({ rounds, round, staff, currentLabel, userStaffId }: {
  rounds: SupervisionRound[]; round: SupervisionRound | null; staff: StaffRow[];
  currentLabel: { academicYear: string; term: '1' | '2'; label: string }; userStaffId: string;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const { data: assignments, error } = useRoundAssignments(round?.id || null, round ? { kind: 'ALL' } : null);
  const [teacherId, setTeacherId] = useState('');
  const [supId, setSupId] = useState('');
  const { departments } = useDepartments();
  const deptName = (id: string) => departments.find(d => d.id === id)?.name || '-';
  const teachers = staff.filter(isObservableTeacher).sort((a, b) => staffFullName(a).localeCompare(staffFullName(b), 'th'));
  const supervisorCandidates = staff.filter(s => s.roles?.includes('SUPERVISORY_TEACHER') && isStaffActive(s));
  const nextId = supervisionRoundId(currentLabel.academicYear, currentLabel.term);
  const exists = rounds.some(r => r.id === nextId);

  const run = async (fn: () => Promise<unknown>) => { setMsg(null); try { await fn(); } catch (e) { setMsg(errMsg(e)); } };

  return (
    <div className="space-y-4">
      <div className="bg-[#161f30] border border-slate-800/80 rounded-xl p-4 sm:p-6 space-y-3">
        <h3 className="text-lg font-bold text-white">รอบนิเทศ</h3>
        <div className="flex flex-wrap gap-2 items-center">
          {!exists && (
            <button onClick={() => run(() => openSupervisionRound(currentLabel.academicYear, currentLabel.term, userStaffId))}
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg cursor-pointer">
              <Plus className="w-4 h-4" />เปิดรอบภาคเรียน {currentLabel.label}
            </button>
          )}
          {round && (
            <button onClick={() => run(() => setSupervisionRoundStatus(round.id, round.status === 'OPEN' ? 'CLOSED' : 'OPEN'))}
              className="px-3 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded-lg cursor-pointer">
              {round.status === 'OPEN' ? 'ปิดรอบนี้' : 'เปิดรอบนี้อีกครั้ง'}
            </button>
          )}
        </div>
        {msg && <p role="alert" className="text-sm text-amber-300">{msg}</p>}
      </div>

      {round && (
        <div className="bg-[#161f30] border border-slate-800/80 rounded-xl p-4 sm:p-6 space-y-3">
          <h3 className="text-lg font-bold text-white">จับคู่ครูนิเทศ — ภาคเรียน {round.term}/{round.academicYear}</h3>
          <p className="text-xs text-slate-400">หัวหน้า/รองหัวหน้ากลุ่มสาระฯ นิเทศครูในกลุ่มสาระฯ ตนเองได้โดยตำแหน่ง ไม่ต้องจับคู่</p>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
            <select aria-label="ครูผู้รับการนิเทศ" className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" value={teacherId} onChange={e => setTeacherId(e.target.value)}>
              <option value="">เลือกครูผู้รับการนิเทศ</option>
              {teachers.map(t => <option key={t.id} value={t.id}>{staffFullName(t)} ({deptName(staffDepartmentId(t))})</option>)}
            </select>
            <select aria-label="ครูนิเทศ" className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" value={supId} onChange={e => setSupId(e.target.value)}>
              <option value="">เลือกครูนิเทศ</option>
              {supervisorCandidates.map(t => <option key={t.id} value={t.id}>{staffFullName(t)}</option>)}
            </select>
            <button disabled={!teacherId || !supId || teacherId === supId || round.status !== 'OPEN'}
              onClick={() => run(async () => { await addSupervisionAssignment(round.id, teacherId, supId); setTeacherId(''); })}
              className="px-4 py-2 text-sm bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg cursor-pointer disabled:opacity-40">เพิ่ม</button>
          </div>
          {supervisorCandidates.length === 0 && <p className="text-xs text-amber-300">ยังไม่มีบุคลากรที่ได้รับบทบาท "ครูนิเทศ" — กำหนดที่หน้าจัดการบทบาทบุคลากร</p>}
          {error && <p role="alert" className="text-sm text-amber-300">โหลดการจับคู่ไม่สำเร็จ: {error}</p>}
          <ul className="divide-y divide-slate-800">
            {assignments.length === 0 && <li className="py-2 text-sm text-slate-400">ยังไม่มีการจับคู่ในรอบนี้</li>}
            {assignments.map(a => {
              const t = staff.find(s => s.id === a.teacherStaffId);
              const s = staff.find(x => x.id === a.supervisorStaffId);
              return (
                <li key={a.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-200">{staffFullName(s) || a.supervisorStaffId} <span className="text-slate-500">นิเทศ</span> {staffFullName(t) || a.teacherStaffId}</span>
                  <button aria-label="ลบการจับคู่" onClick={() => run(() => removeSupervisionAssignment(a.id))} className="p-1.5 text-red-400 hover:bg-red-500/10 rounded cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                </li>
              );
            })}
          </ul>
          <SupervisorsHint staff={staff} />
        </div>
      )}
    </div>
  );
}

/** แสดงผู้นิเทศโดยตำแหน่งที่มีอยู่ — ให้หัวหน้างานนิเทศเห็นว่าใครครอบคลุมกลุ่มสาระฯ ใดบ้าง */
function SupervisorsHint({ staff }: { staff: StaffRow[] }) {
  const { departments } = useDepartments();
  const rows = departments.map(d => {
    const names = staff.filter(s => staffDepartmentId(s) === d.id && (s.roles?.includes('HEAD_OF_DEPARTMENT') || s.roles?.includes('DEPUTY_HEAD_OF_DEPARTMENT'))).map(staffFullName);
    return { id: d.id, name: d.name, names };
  }).filter(r => r.names.length > 0);
  if (rows.length === 0) return null;
  return (
    <details className="text-xs text-slate-400">
      <summary className="cursor-pointer">ผู้นิเทศโดยตำแหน่งแต่ละกลุ่มสาระฯ</summary>
      <ul className="mt-1 space-y-0.5">{rows.map(r => <li key={r.id}>{r.name}: {r.names.join(', ')}</li>)}</ul>
    </details>
  );
}
