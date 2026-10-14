import React, { useMemo, useState } from 'react';
import { useStore } from '../../store';
import { useCurrentSemester } from '../../hooks/useCurrentSemester';
import { useLessonPlans } from '../../hooks/useLessonPlans';
import { deleteLessonPlan, submitLessonPlan } from '../../services/lessonPlanService';
import {
  COMPLIANCE_LABEL, KIND_LABEL, PLAN_CHECKLIST, STAGE_LABEL, complianceOf, courseKeyOf, planDocId, semesterIdOf,
  type LessonPlan, type LessonPlanKind,
} from '../../lib/lessonPlans';
import { staffDepartmentId, type StaffRow } from '../../lib/supervisionView';

export interface PlanCourse { code: string; name: string; level: string }
const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'ดำเนินการไม่สำเร็จ');

/** ครูส่งแผนการสอน/โครงการสอนเป็นลิงก์ — ต้องมีฉบับสมบูรณ์ ≥ 1 รายวิชาต่อภาคเรียน */
export function MyLessonPlansPanel({ courses }: { courses: PlanCourse[] }) {
  const user = useStore(s => s.user);
  const staff = useStore(s => s.staffDirectory) as StaffRow[];
  const sem = useCurrentSemester();
  const staffId = user?.staffId || '';
  const semesterId = semesterIdOf(sem.academicYear, sem.term);
  const q = useMemo(() => (staffId ? ({ scope: 'SELF', staffId } as const) : null), [staffId]);
  const { data, loading, error } = useLessonPlans(semesterId, q);

  const uniq = useMemo(() => {
    const m = new Map<string, PlanCourse>();
    for (const c of courses) { const k = courseKeyOf(c.code); if (k && !m.has(k)) m.set(k, c); }
    return [...m.entries()];
  }, [courses]);
  const byKey = new Map<string, LessonPlan>(data.map((p): [string, LessonPlan] => [p.courseKey, p]));
  const comp = complianceOf(data);

  if (!staffId) return <p className="text-sm text-slate-400">บัญชีนี้ไม่ได้เชื่อมกับทะเบียนบุคลากร</p>;
  const dept = staffDepartmentId(staff.find(s => s.id === staffId));
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-sm">
        <p className="text-white font-medium">แผนการสอน/โครงการสอน ภาคเรียน {sem.label}</p>
        <p className="text-slate-400 mt-1">ส่งฉบับสมบูรณ์อย่างน้อย 1 รายวิชา ที่เหลือส่งเป็นโครงการสอนแทนได้ — แปะลิงก์ (Google Docs/Drive ฯลฯ) และตั้งสิทธิ์ให้ผู้ตรวจเปิดดูได้</p>
        <p className="mt-2 text-cyan-300">สถานะของท่าน: {COMPLIANCE_LABEL[comp]}</p>
      </div>
      {error && <p role="alert" className="text-sm text-amber-300">โหลดข้อมูลไม่สำเร็จ: {error}</p>}
      {loading ? <p className="text-sm text-slate-400">กำลังโหลด…</p>
        : uniq.length === 0 ? <p className="text-sm text-slate-400">ไม่พบรายวิชาที่ท่านสอนในภาคเรียนนี้</p>
          : uniq.map(([key, c]) => (
            <CourseRow key={key} course={c} plan={byKey.get(key)}
              onSubmit={(kind, url, note) => submitLessonPlan({
                semester: { academicYear: sem.academicYear, term: sem.term },
                teacher: { staffId, name: user?.displayName || '', departmentId: dept },
                course: c, kind, url, note, exists: byKey.has(key),
              })}
              onDelete={() => deleteLessonPlan(planDocId(semesterId, staffId, key))} />
          ))}
    </div>
  );
}

function CourseRow({ course, plan, onSubmit, onDelete }: {
  key?: string;
  course: PlanCourse; plan?: LessonPlan;
  onSubmit: (k: LessonPlanKind, url: string, note: string) => Promise<unknown>; onDelete: () => Promise<unknown>;
}) {
  const locked = !!plan && (plan.stage === 'DEPT_APPROVED' || plan.stage === 'APPROVED');
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<LessonPlanKind>(plan?.kind || 'PLAN');
  const [url, setUrl] = useState(plan?.url || '');
  const [note, setNote] = useState(plan?.note || '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true); setMsg('');
    try { await fn(); setMsg(ok); setOpen(false); } catch (e) { setMsg(errMsg(e)); } finally { setBusy(false); }
  };
  const review = plan?.stage === 'REVISION' ? (plan.finalReview || plan.deptReview) : undefined;
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-4 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><p className="text-white text-sm font-medium">{course.code} {course.name}</p><p className="text-xs text-slate-400">{course.level}</p></div>
        <span className="text-xs px-2 py-1 rounded-full bg-slate-800 text-slate-200">{plan ? `${KIND_LABEL[plan.kind]} · ${STAGE_LABEL[plan.stage]}` : 'ยังไม่ส่ง'}</span>
      </div>
      {plan && <a href={plan.url} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-300 underline break-all">{plan.url}</a>}
      {review && (
        <div className="text-xs rounded-lg bg-amber-500/10 border border-amber-500/30 p-2 text-amber-200">
          <p>ผู้ตรวจ ({review.byName}) ขอให้แก้ไข: {review.comment}</p>
          <p className="mt-1 text-amber-300/80">ข้อที่ต้องปรับ: {PLAN_CHECKLIST.filter(c => review.checks?.[c.id] === 'N').map(c => c.label).join(' · ') || '-'}</p>
        </div>
      )}
      {!locked && !open && (
        <div className="flex gap-2">
          <button className="px-3 py-1.5 rounded-lg text-xs bg-cyan-600 text-white cursor-pointer" onClick={() => setOpen(true)}>{plan ? 'แก้ไข/ส่งใหม่' : 'ส่งแผน/โครงการ'}</button>
          {plan && <button disabled={busy} className="px-3 py-1.5 rounded-lg text-xs border border-slate-600 text-slate-300 cursor-pointer"
            onClick={() => { if (window.confirm('ลบรายการนี้?')) void run(onDelete, 'ลบแล้ว'); }}>ลบ</button>}
        </div>
      )}
      {open && (
        <div className="space-y-2">
          <div className="flex gap-3 text-sm text-slate-200">
            {(['PLAN', 'PROJECT'] as const).map(k => (
              <label key={k} className="flex items-center gap-1"><input type="radio" checked={kind === k} onChange={() => setKind(k)} />{KIND_LABEL[k]}</label>
            ))}
          </div>
          <input className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" placeholder="https://..." value={url} onChange={e => setUrl(e.target.value)} />
          <textarea className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" rows={2} maxLength={500} placeholder="หมายเหตุ (ถ้ามี)" value={note} onChange={e => setNote(e.target.value)} />
          <div className="flex gap-2">
            <button disabled={busy} className="px-3 py-1.5 rounded-lg text-xs bg-cyan-600 text-white cursor-pointer" onClick={() => void run(() => onSubmit(kind, url, note), 'ส่งแล้ว — รอหัวหน้ากลุ่มสาระฯ ตรวจ')}>ส่ง</button>
            <button className="px-3 py-1.5 rounded-lg text-xs border border-slate-600 text-slate-300 cursor-pointer" onClick={() => setOpen(false)}>ยกเลิก</button>
          </div>
        </div>
      )}
      {msg && <p role="status" className="text-xs text-slate-300">{msg}</p>}
    </div>
  );
}
