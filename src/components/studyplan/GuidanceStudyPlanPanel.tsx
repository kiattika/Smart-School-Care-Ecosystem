import React, { useEffect, useMemo, useState } from 'react';
import {
  GOAL_COMPARE_LABEL, PLAN_STATUS_LABEL, STUDY_LEVEL_LABEL, buildRoster, compareWithSelfAssessment, countCompare, planTypeLabel,
  summarizeRoster, TCAS_ROUNDS, type PlanStatus, type StudyLevel, type StudyPlan, type StudyRosterStudent,
} from '../../lib/studyPlan';
import type { StudentSelfAssessment } from '../../types';
import { subscribeAllSelfAssessments } from '../../services/firestoreService';
import { subscribeAllStudyPlans } from '../../services/studyPlanService';
import { isHttpsLink } from '../../lib/evidenceLinks';
import { StudyPlanSummaryCards } from './StudyPlanSummaryCards';

const roundLabel = (id: string) => TCAS_ROUNDS.find(r => r.id === id)?.label ?? id;

/** ครูแนะแนว: รายชื่อนักเรียน ม.3/ม.6 + สถานะแผนศึกษาต่อ + เทียบข้อ 27 ของแบบประเมินตนเอง 30 ข้อ */
export function GuidanceStudyPlanPanel({ students }: { students: StudyRosterStudent[] }) {
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [assess, setAssess] = useState<Record<string, StudentSelfAssessment>>({});
  const [error, setError] = useState('');
  const [level, setLevel] = useState<StudyLevel>('M6');
  const [statusFilter, setStatusFilter] = useState<PlanStatus | 'ALL'>('ALL');
  const [openId, setOpenId] = useState('');

  useEffect(() => subscribeAllStudyPlans(setPlans, e => setError(e.message)), []);
  useEffect(() => subscribeAllSelfAssessments(setAssess), []);

  const roster = useMemo(() => buildRoster(students, plans), [students, plans]);
  const withCompare = useMemo(
    () => roster.map(r => ({ ...r, goal: assess[r.studentId]?.futureGoals?.careerGoals ?? '', compare: compareWithSelfAssessment(r.plan, assess[r.studentId]?.futureGoals?.careerGoals) })),
    [roster, assess],
  );
  const mine = withCompare.filter(r => r.level === level);
  const summary = useMemo(() => summarizeRoster(roster, level), [roster, level]);
  const compare = useMemo(() => countCompare(mine), [mine]);
  const rows = mine.filter(r => statusFilter === 'ALL' || r.status === statusFilter);

  return (
    <div className="space-y-4">
      <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl space-y-2">
        <h3 className="text-base font-bold text-white">แผนศึกษาต่อและ TCAS พอร์ตโฟลิโอ</h3>
        <p className="text-xs text-slate-400">นักเรียน ม.3/ม.6 กรอกแผนเอง — ตารางด้านล่างเทียบกับเป้าหมายข้อ 27 ในแบบประเมินตนเอง ระบบไม่ตัดสินว่าสอดคล้องหรือไม่ ให้ครูอ่านเทียบเอง</p>
        <div className="flex gap-2" role="tablist" aria-label="ระดับชั้น">
          {(['M6', 'M3'] as StudyLevel[]).map(l => (
            <button key={l} role="tab" aria-selected={level === l} onClick={() => setLevel(l)}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg ${level === l ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'}`}>{STUDY_LEVEL_LABEL[l]}</button>
          ))}
        </div>
        {error && <p role="alert" className="text-xs text-rose-400">{error}</p>}
      </div>

      <StudyPlanSummaryCards summary={summary} compare={compare} />

      <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h4 className="text-sm font-bold text-white">รายชื่อนักเรียน {STUDY_LEVEL_LABEL[level]}</h4>
          <select aria-label="กรองสถานะ" value={statusFilter} onChange={e => setStatusFilter(e.target.value as PlanStatus | 'ALL')}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white">
            <option value="ALL">ทุกสถานะ</option>
            {(Object.keys(PLAN_STATUS_LABEL) as PlanStatus[]).map(s => <option key={s} value={s}>{PLAN_STATUS_LABEL[s]}</option>)}
          </select>
        </div>
        {rows.length === 0 ? <p className="text-xs text-slate-500">ไม่มีรายการ</p> : (
          <ul className="divide-y divide-slate-800">
            {rows.map(r => (
              <li key={r.studentId} className="py-2 text-xs text-slate-300">
                <button type="button" onClick={() => setOpenId(openId === r.studentId ? '' : r.studentId)} className="w-full flex items-center justify-between gap-3 text-left">
                  <span><b className="text-white">{r.name}</b> · {r.room}</span>
                  <span className={r.status === 'NOT_FILLED' ? 'text-amber-300' : 'text-emerald-300'}>{PLAN_STATUS_LABEL[r.status]}</span>
                </button>
                {openId === r.studentId && (
                  <div className="mt-2 space-y-2 bg-slate-950 rounded-xl p-3">
                    <div className="text-slate-400">{GOAL_COMPARE_LABEL[r.compare]}</div>
                    {r.plan && (
                      <div className="space-y-1">
                        <div><b>แผน:</b> {planTypeLabel(r.plan.level, r.plan.planType)}</div>
                        {r.plan.choices.map((c, i) => <div key={i}>{i + 1}. {c.institution} — {c.program} ({roundLabel(c.round)})</div>)}
                        {r.plan.portfolioUrl && (isHttpsLink(r.plan.portfolioUrl)
                          ? <div><a href={r.plan.portfolioUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-300 underline">เปิดพอร์ตโฟลิโอ</a></div>
                          : <div>พอร์ตโฟลิโอ: ลิงก์ไม่ปลอดภัย ไม่แสดง</div>)}
                        {r.plan.note && <div><b>หมายเหตุ:</b> {r.plan.note}</div>}
                      </div>
                    )}
                    <div><b>เป้าหมายข้อ 27 (แบบประเมินตนเอง):</b> {r.goal.trim() ? r.goal : 'ยังไม่ได้ตอบ'}</div>
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
