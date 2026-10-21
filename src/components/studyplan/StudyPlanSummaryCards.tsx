import React from 'react';
import { GOAL_COMPARE_LABEL, STUDY_LEVEL_LABEL, type GoalCompare, type StudySummary } from '../../lib/studyPlan';

/** การ์ดสรุปตัวเลขแผนศึกษาต่อของระดับ ม.3 หรือ ม.6 — ใช้ร่วมกันในหน้าแนะแนวและผู้บริหาร (ไม่มีชื่อนักเรียน) */
export function StudyPlanSummaryCards({ summary, compare }: { summary: StudySummary; compare?: Record<GoalCompare, number> }) {
  const pct = (n: number) => (summary.total > 0 ? Math.round((n * 100) / summary.total) : 0);
  return (
    <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl space-y-3">
      <h4 className="text-sm font-bold text-white">นักเรียน {STUDY_LEVEL_LABEL[summary.level]} ทั้งหมด {summary.total} คน</h4>
      {summary.total === 0 ? (
        <p className="text-xs text-slate-500">ยังไม่มีนักเรียนชั้นนี้ในทะเบียน</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-slate-950 rounded-xl p-3"><div className="text-lg font-bold text-white">{summary.filled}</div><div className="text-[11px] text-slate-400">กรอกแล้ว ({pct(summary.filled)}%)</div></div>
            <div className="bg-slate-950 rounded-xl p-3"><div className="text-lg font-bold text-amber-300">{summary.notFilled}</div><div className="text-[11px] text-slate-400">ยังไม่กรอก ({pct(summary.notFilled)}%)</div></div>
            {summary.level === 'M6'
              ? <div className="bg-slate-950 rounded-xl p-3"><div className="text-lg font-bold text-emerald-300">{summary.portfolioSent}</div><div className="text-[11px] text-slate-400">ส่งพอร์ตแล้ว</div></div>
              : <div className="bg-slate-950 rounded-xl p-3"><div className="text-lg font-bold text-slate-300">—</div><div className="text-[11px] text-slate-400">ไม่มีพอร์ตโฟลิโอ</div></div>}
          </div>
          <div className="text-xs text-slate-300 space-y-1">
            <div className="font-semibold text-slate-200">แผนหลังจบชั้น (เฉพาะที่กรอกแล้ว)</div>
            {summary.byPlanType.map(t => <div key={t.id} className="flex justify-between"><span>{t.label}</span><b>{t.count}</b></div>)}
          </div>
          {summary.byFirstRound.length > 0 && (
            <div className="text-xs text-slate-300 space-y-1">
              <div className="font-semibold text-slate-200">รอบ TCAS ของตัวเลือกอันดับแรก</div>
              {summary.byFirstRound.map(t => <div key={t.id} className="flex justify-between"><span>{t.label}</span><b>{t.count}</b></div>)}
            </div>
          )}
          {compare && (
            <div className="text-xs text-slate-300 space-y-1">
              <div className="font-semibold text-slate-200">เทียบกับแบบประเมินตนเอง 30 ข้อ (ข้อ 27 เป้าหมายการศึกษาต่อ/อาชีพ)</div>
              {(Object.keys(GOAL_COMPARE_LABEL) as GoalCompare[]).map(k => <div key={k} className="flex justify-between gap-3"><span>{GOAL_COMPARE_LABEL[k]}</span><b>{compare[k]}</b></div>)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
