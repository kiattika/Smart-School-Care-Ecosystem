import { linksOf } from '../../lib/evidenceLinks';
import { groupWithTones } from '../../lib/groupTones';
import { useDepartments } from '../../hooks/useDepartments';
import { useEvaluationTemplates } from '../../hooks/useEvaluationTemplates';
import React, { useMemo, useState } from 'react';
import { useStore } from '../../store';
import { useCurrentSemester } from '../../hooks/useCurrentSemester';
import { useLessonPlans } from '../../hooks/useLessonPlans';
import { reviewLessonPlan } from '../../services/lessonPlanService';
import {
  KIND_LABEL, SCORE_LABEL, STAGE_LABEL, averageScore, complianceOf, embedUrlFor,
  planOverviewQuery, reviewStageFor, scoresComplete, semesterIdOf, suitabilityLevel, type LessonPlan, type ScoresMap,
} from '../../lib/lessonPlans';
import { PlcReflectionOverview } from '../portfolio/PlcReflectionOverview';
import { TeachingProjectsOverview } from '../teachingproject/TeachingProjectsOverview';
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
  const [view, setView] = useState<'plans' | 'projects' | 'plc'>('plans');

  const me = { staffId, roles, departmentId: myDept };
  const isHead = (tid: string) => !!staff.find(s => s.id === tid)?.roles?.includes('HEAD_OF_DEPARTMENT');
  const stageOf = (p: LessonPlan) => reviewStageFor(p, me, isHead(p.teacherStaffId));
  const rows = data.filter(p => filter === 'all' || stageOf(p)).sort((a, b) => a.teacherName.localeCompare(b.teacherName, 'th'));
  const open = data.find(p => p.id === openId);
  const { nameOf: deptNameOf } = useDepartments();
  const groups = useMemo(() => groupWithTones<LessonPlan>(rows, p => p.departmentId || '', k => deptNameOf(k) || k, (a, b) => a.teacherName.localeCompare(b.teacherName, 'th') || a.courseCode.localeCompare(b.courseCode, 'th')), [rows, deptNameOf]);

  const compliance = useMemo(() => {
    const m = new Map<string, LessonPlan[]>();
    data.forEach(p => m.set(p.teacherStaffId, [...(m.get(p.teacherStaffId) || []), p]));
    const c = { NONE: 0, PROJECT_ONLY: 0, PLAN_SUBMITTED: 0, PLAN_APPROVED: 0 };
    m.forEach(l => { c[complianceOf(l)]++; });
    return { c, teachers: m.size };
  }, [data]);

  if (!q) return <p className="text-sm text-slate-400">บทบาทปัจจุบันไม่มีสิทธิ์ตรวจ/ดูแผนการสอน</p>;
  if (open) {
    return (
      <div key={open.id}>
        <ReviewDetail plan={open} stage={stageOf(open)} staff={staff} onBack={() => setOpenId('')}
          reviewer={{ staffId, name: staffFullName(staff.find(s => s.id === staffId)) || user?.displayName || '' }} />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="flex gap-2" role="tablist">
        {([['plans', 'แผนการสอน (ลิงก์) — ตรวจ'], ['projects', 'โครงการสอน — ดูอย่างเดียว'], ['plc', 'PLC / สะท้อนคิด — ดูอย่างเดียว']] as const).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={view === id} onClick={() => setView(id)} className={`px-3 py-1.5 rounded-lg text-xs border cursor-pointer ${view === id ? 'bg-cyan-600 border-cyan-400 text-white' : 'bg-slate-900 border-slate-700 text-slate-300'}`}>{label}</button>
        ))}
      </div>
      {view === 'projects' ? <TeachingProjectsOverview q={q} /> : view === 'plc' ? <PlcReflectionOverview q={q} /> : <>
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
        <div className="space-y-4">
          {groups.map(g => (
            <section key={g.key || 'none'} aria-label={g.label} className="space-y-2">
              <p className="text-xs font-semibold"><span className={`inline-block px-2.5 py-1 rounded-full border ${g.tone.chip}`}>{g.label} · {g.items.length} รายการ</span></p>
              <ul className="space-y-2">
                {g.items.map(p => (
                  <li key={p.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-700 p-3 ${g.tone.row}`}>
                    <div><p className="text-sm text-white">{p.teacherName} · {p.courseCode} {p.courseName}</p><p className="text-xs text-slate-400">{KIND_LABEL[p.kind]} · {STAGE_LABEL[p.stage]}</p></div>
                    <button className="px-3 py-1.5 rounded-lg text-xs bg-cyan-600 text-white cursor-pointer" onClick={() => setOpenId(p.id)}>{stageOf(p) ? 'ตรวจ' : 'ดู'}</button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      </>}
    </div>
  );
}

function ReviewDetail({ plan, stage, reviewer, staff, onBack }: {
  plan: LessonPlan; stage: 'DEPT' | 'FINAL' | null; reviewer: { staffId: string; name: string }; staff: StaffRow[]; onBack: () => void;
}) {
  const tpls = useEvaluationTemplates('LESSON_PLAN');
  const tpl = tpls.current; // ตรวจใหม่ใช้แบบเวอร์ชันปัจจุบันเสมอ
  const [scores, setScores] = useState<ScoresMap>({});
  const avg = averageScore(scores, tpl ?? undefined);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const links = linksOf(plan);
  const [active, setActive] = useState(0);
  const activeUrl = links[Math.min(active, links.length - 1)] || plan.url;
  const embed = embedUrlFor(activeUrl);
  const prior = [plan.deptReview && ['หัวหน้ากลุ่มสาระฯ', plan.deptReview] as const, plan.finalReview && ['หัวหน้างานนิเทศ', plan.finalReview] as const].filter(Boolean) as (readonly [string, NonNullable<LessonPlan['deptReview']>])[];

  const decide = async (decision: 'APPROVE' | 'REVISE') => {
    if (!stage) return;
    setBusy(true); setMsg('');
    try { await reviewLessonPlan({ id: plan.id, stage, decision, comment, scores, tpl: tpl ?? undefined, reviewer, staffDirectory: staff }); onBack(); }
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
            {links.length > 1 && (
              <div className="flex flex-wrap gap-1.5 mb-2" role="tablist" aria-label="ลิงก์ที่ครูแนบ">
                {links.map((u, i) => (
                  <button key={u} role="tab" aria-selected={i === active} onClick={() => setActive(i)}
                    className={`px-2.5 py-1 rounded-lg border text-xs cursor-pointer ${i === active ? 'bg-cyan-600 border-cyan-400 text-white' : 'bg-slate-950 border-slate-700 text-slate-300'}`}>ลิงก์ {i + 1}</button>
                ))}
              </div>
            )}
            <a href={activeUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline break-all">เปิดในแท็บใหม่: {activeUrl}</a>
            {plan.note && <p className="mt-1 text-slate-400">หมายเหตุครู: {plan.note}</p>}
            {embed && <p className="mt-1 text-slate-500">หากไม่แสดง แปลว่าลิงก์ยังไม่ตั้งสิทธิ์ให้ผู้ตรวจเปิดดูได้</p>}
          </div>
        </section>
        <section aria-label="แบบประเมินแผนการสอน" className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 space-y-3 lg:sticky lg:top-2">
          {prior.map(([label, r]) => (
            <p key={label} className="text-xs text-slate-400">{label} ({r.byName}): {r.decision === 'APPROVE' ? 'ผ่าน' : 'ขอแก้ไข'}{r.comment ? ` — ${r.comment}` : ''}</p>
          ))}
          {!stage ? <p className="text-sm text-slate-400">ท่านดูได้อย่างเดียว (ไม่ใช่ผู้ตรวจในขั้นนี้)</p> : !tpl ? <p className="text-sm text-slate-400">{tpls.loading ? 'กำลังโหลดแบบประเมิน…' : `โหลดแบบประเมินไม่สำเร็จ${tpls.error ? `: ${tpls.error}` : ''}`}</p> : (
            <>
              <p className="text-sm text-white font-medium">แบบประเมิน — {stage === 'DEPT' ? 'ขั้นที่ 1 หัวหน้ากลุ่มสาระฯ' : plan.stage === 'SUBMITTED' ? 'หัวหน้างานนิเทศ (ตรวจข้ามขั้น — ผลนี้เป็นผลสุดท้าย)' : 'ขั้นที่ 2 หัวหน้างานนิเทศ'}</p>
              <ul className="space-y-2">
                {tpl.criteria.map((c, i) => (
                  <li key={c.id} className="text-sm text-slate-200 space-y-1">
                    <p>{i + 1}. {c.label}</p>
                    <span className="flex gap-1" role="radiogroup" aria-label={c.label}>
                      {[5, 4, 3, 2, 1].map(v => (
                        <button key={v} type="button" role="radio" aria-checked={scores[c.id] === v} title={SCORE_LABEL[v]} onClick={() => setScores(s => ({ ...s, [c.id]: v }))}
                          className={`w-9 py-1 rounded-md text-xs border cursor-pointer ${scores[c.id] === v ? 'bg-cyan-600 border-cyan-400 text-white' : 'bg-slate-950 border-slate-700 text-slate-300'}`}>{v}</button>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-slate-300" role="status">ค่าเฉลี่ย {avg === null ? '-' : avg.toFixed(2)} · ระดับความเหมาะสม: {suitabilityLevel(avg)} (5 = มากที่สุด … 1 = น้อยที่สุด)</p>
              <textarea className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" rows={3} maxLength={1000} placeholder="ความเห็น/สิ่งที่ต้องแก้ (จำเป็นเมื่อขอให้แก้ไข)" value={comment} onChange={e => setComment(e.target.value)} />
              <div className="flex gap-2">
                <button disabled={busy || !scoresComplete(scores, tpl)} className="px-3 py-1.5 rounded-lg text-xs bg-emerald-600 text-white disabled:opacity-40 cursor-pointer" onClick={() => void decide('APPROVE')}>{stage === 'DEPT' ? 'ผ่าน — ส่งต่อหัวหน้างานนิเทศ' : 'ผ่านการตรวจ'}</button>
                <button disabled={busy || !scoresComplete(scores, tpl) || !comment.trim()} className="px-3 py-1.5 rounded-lg text-xs bg-rose-600 text-white disabled:opacity-40 cursor-pointer" onClick={() => void decide('REVISE')}>ขอให้แก้ไข</button>
              </div>
              {msg && <p role="alert" className="text-xs text-amber-300">{msg}</p>}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
