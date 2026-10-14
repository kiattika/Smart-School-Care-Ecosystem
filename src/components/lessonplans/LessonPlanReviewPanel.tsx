import React, { useMemo, useState } from 'react';
import { useStore } from '../../store';
import { useCurrentSemester } from '../../hooks/useCurrentSemester';
import { useLessonPlans } from '../../hooks/useLessonPlans';
import { reviewLessonPlan } from '../../services/lessonPlanService';
import {
  COMPLIANCE_LABEL, KIND_LABEL, PLAN_CHECKLIST, STAGE_LABEL, checksComplete, complianceOf, embedUrlFor,
  planOverviewQuery, reviewStageFor, semesterIdOf, type ChecksMap, type LessonPlan,
} from '../../lib/lessonPlans';
import { staffDepartmentId, staffFullName, type StaffRow } from '../../lib/supervisionView';

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'ดำเนินการไม่สำเร็จ');

/** ตรวจแผน/โครงการสอน 2 ขั้น — หน้าตรวจแสดงแผน (ซ้าย) เคียงข้างแบบประเมิน (ขวา) */
export function LessonPlanReviewPanel() {
  const user = useStore(s => s.user);
  const staff = useStore(s => s.staffDirectory) as StaffRow[];
  const sem = useCurrentSemester();
  const roles = (user?.profile?.roles || []) as string[];
  const staffId = user?.staffId || '';
  const myDept = staffDepartmentId(staff.find(s => s.id === staffId));
  const semesterId = semesterIdOf(sem.academicYear, sem.term);
  const q = useMemo(() => planOverviewQuery(roles, myDept), [roles.join(','), myDept]); // eslint-disable-line react-hooks/exhaustive-deps
  const { data, loading, error } = useLessonPlans(semesterId, q);
  const [openId, setOpenId] = useState('');
  const [filter, setFilter] = useState<'todo' | 'all'>('todo');

  const me = { staffId, roles, departmentId: myDept };
  const isHead = (tid: string) => !!staff.find(s => s.id === tid)?.roles?.includes('HEAD_OF_DEPARTMENT');
  const stageOf = (p: LessonPlan) => reviewStageFor(p, me, isHead(p.teacherStaffId));
  const rows = data.filter(p => filter === 'all' || stageOf(p)).sort((a, b) => a.teacherName.localeCompare(b.teacherName, 'th'));
  const open = data.find(p => p.id === openId);

  const compliance = useMemo(() => {
    const m = new Map<string, LessonPlan[]>();
    data.forEach(p => m.set(p.teacherStaffId, [...(m.get(p.teacherStaffId) || []), p]));
    const c = { NONE: 0, PROJECT_ONLY: 0, PLAN_SUBMITTED: 0, PLAN_APPROVED: 0 };
    m.forEach(l => { c[complianceOf(l)]++; });
    return { c, teachers: m.size };
  }, [data]);

  if (!q) return <p className="text-sm text-slate-400">บทบาทปัจจุบันไม่มีสิทธิ์ตรวจ/ดูแผนการสอน</p>;
  if (open) {
    return <ReviewDetail key={open.id} plan={open} stage={stageOf(open)} onBack={() => setOpenId('')}
      reviewer={{ staffId, name: staffFullName(staff.find(s => s.id === staffId)) || user?.displayName || '' }} />;
  }
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-300">
        <p className="text-white font-medium">แผนการสอน/โครงการสอน ภาคเรียน {sem.label}</p>
        <p className="mt-1 text-xs">ครูที่ส่งแล้ว {compliance.teachers} คน · เฉพาะโครงการสอน {compliance.c.PROJECT_ONLY} · ฉบับสมบูรณ์รอตรวจ {compliance.c.PLAN_SUBMITTED} · ฉบับสมบูรณ์ผ่านแล้ว {compliance.c.PLAN_APPROVED}</p>
      </div>
      <div className="flex gap-2">
        {(['todo', 'all'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs border cursor-pointer ${filter === f ? 'bg-cyan-600 border-cyan-400 text-white' : 'bg-slate-900 border-slate-700 text-slate-300'}`}>{f === 'todo' ? 'รอฉันตรวจ' : 'ทั้งหมด'}</button>
        ))}
      </div>
      {error && <p role="alert" className="text-sm text-amber-300">โหลดไม่สำเร็จ: {error}</p>}
      {loading ? <p className="text-sm text-slate-400">กำลังโหลด…</p> : rows.length === 0 ? <p className="text-sm text-slate-400">ไม่มีรายการ</p> : (
        <ul className="space-y-2">
          {rows.map(p => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-700 bg-slate-900/40 p-3">
              <div><p className="text-sm text-white">{p.teacherName} · {p.courseCode} {p.courseName}</p><p className="text-xs text-slate-400">{KIND_LABEL[p.kind]} · {STAGE_LABEL[p.stage]}</p></div>
              <button className="px-3 py-1.5 rounded-lg text-xs bg-cyan-600 text-white cursor-pointer" onClick={() => setOpenId(p.id)}>{stageOf(p) ? 'ตรวจ' : 'ดู'}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReviewDetail({ plan, stage, reviewer, onBack }: {
  key?: string;
  plan: LessonPlan; stage: 'DEPT' | 'FINAL' | null; reviewer: { staffId: string; name: string }; onBack: () => void;
}) {
  const [checks, setChecks] = useState<ChecksMap>({});
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const embed = embedUrlFor(plan.url);
  const prior = [plan.deptReview && ['หัวหน้ากลุ่มสาระฯ', plan.deptReview] as const, plan.finalReview && ['หัวหน้างานนิเทศ', plan.finalReview] as const].filter(Boolean) as (readonly [string, NonNullable<LessonPlan['deptReview']>])[];

  const decide = async (decision: 'APPROVE' | 'REVISE') => {
    if (!stage) return;
    setBusy(true); setMsg('');
    try { await reviewLessonPlan({ id: plan.id, stage, decision, comment, checks, reviewer }); onBack(); }
    catch (e) { setMsg(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-3">
      <button className="text-xs text-cyan-300 cursor-pointer" onClick={onBack}>← กลับรายการ</button>
      <p className="text-white text-sm font-medium">{plan.teacherName} · {plan.courseCode} {plan.courseName} ({KIND_LABEL[plan.kind]}) — {STAGE_LABEL[plan.stage]}</p>
      <div className="grid gap-4 lg:grid-cols-2 items-start">
        <section aria-label="แผนการสอน" className="rounded-xl border border-slate-700 bg-slate-900/40 overflow-hidden">
          {embed ? <iframe title="แผนการสอน" src={embed} className="w-full h-[70vh] bg-white" sandbox="allow-scripts allow-same-origin allow-popups" referrerPolicy="no-referrer" />
            : <div className="p-4 text-sm text-slate-300 space-y-2"><p>ลิงก์นี้แสดงฝังในหน้านี้ไม่ได้ — เปิดในแท็บใหม่แล้วตรวจควบคู่กับแบบประเมินด้านขวา</p></div>}
          <div className="p-3 border-t border-slate-700 text-xs">
            <a href={plan.url} target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline break-all">เปิดในแท็บใหม่: {plan.url}</a>
            {plan.note && <p className="mt-1 text-slate-400">หมายเหตุครู: {plan.note}</p>}
            {embed && <p className="mt-1 text-slate-500">หากไม่แสดง แปลว่าลิงก์ยังไม่ตั้งสิทธิ์ให้ผู้ตรวจเปิดดูได้</p>}
          </div>
        </section>
        <section aria-label="แบบประเมินแผนการสอน" className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 space-y-3 lg:sticky lg:top-2">
          {prior.map(([label, r]) => (
            <p key={label} className="text-xs text-slate-400">{label} ({r.byName}): {r.decision === 'APPROVE' ? 'ผ่าน' : 'ขอแก้ไข'}{r.comment ? ` — ${r.comment}` : ''}</p>
          ))}
          {!stage ? <p className="text-sm text-slate-400">ท่านดูได้อย่างเดียว (ไม่ใช่ผู้ตรวจในขั้นนี้)</p> : (
            <>
              <p className="text-sm text-white font-medium">แบบประเมิน — {stage === 'DEPT' ? 'ขั้นที่ 1 หัวหน้ากลุ่มสาระฯ' : 'ขั้นที่ 2 หัวหน้างานนิเทศ'}</p>
              <ul className="space-y-2">
                {PLAN_CHECKLIST.map((c, i) => (
                  <li key={c.id} className="flex items-start justify-between gap-2 text-sm text-slate-200">
                    <span>{i + 1}. {c.label}</span>
                    <span className="flex gap-1 shrink-0" role="radiogroup" aria-label={c.label}>
                      {(['Y', 'N'] as const).map(v => (
                        <button key={v} role="radio" aria-checked={checks[c.id] === v} onClick={() => setChecks(s => ({ ...s, [c.id]: v }))}
                          className={`px-2.5 py-1 rounded-md text-xs border cursor-pointer ${checks[c.id] === v ? (v === 'Y' ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-rose-600 border-rose-400 text-white') : 'bg-slate-950 border-slate-700 text-slate-300'}`}>{v === 'Y' ? 'ผ่าน' : 'ปรับ'}</button>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
              <textarea className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" rows={3} maxLength={1000} placeholder="ความเห็น/สิ่งที่ต้องแก้ (จำเป็นเมื่อขอให้แก้ไข)" value={comment} onChange={e => setComment(e.target.value)} />
              <div className="flex gap-2">
                <button disabled={busy || !checksComplete(checks)} className="px-3 py-1.5 rounded-lg text-xs bg-emerald-600 text-white disabled:opacity-40 cursor-pointer" onClick={() => void decide('APPROVE')}>{stage === 'DEPT' ? 'ผ่าน — ส่งต่อหัวหน้างานนิเทศ' : 'ผ่านการตรวจ'}</button>
                <button disabled={busy || !checksComplete(checks) || !comment.trim()} className="px-3 py-1.5 rounded-lg text-xs bg-rose-600 text-white disabled:opacity-40 cursor-pointer" onClick={() => void decide('REVISE')}>ขอให้แก้ไข</button>
              </div>
              {msg && <p role="alert" className="text-xs text-amber-300">{msg}</p>}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
