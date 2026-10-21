import React, { useEffect, useMemo, useState } from 'react';
import { useRealStudents } from '../../hooks/useRealStudents';
import { subscribeAllSelfAssessments } from '../../services/firestoreService';
import { subscribeAllStudyPlans } from '../../services/studyPlanService';
import { buildRoster, compareWithSelfAssessment, countCompare, summarizeRoster, type StudyLevel, type StudyPlan } from '../../lib/studyPlan';
import type { StudentSelfAssessment } from '../../types';
import { StudyPlanSummaryCards } from './StudyPlanSummaryCards';

/** ผู้บริหาร: สรุปแผนศึกษาต่อ ม.3/ม.6 เป็นตัวเลขรวม (ไม่แสดงชื่อนักเรียน) พร้อมเทียบแบบประเมินตนเอง */
export function ExecutiveStudyPlanPanel() {
  const { students } = useRealStudents();
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [assess, setAssess] = useState<Record<string, StudentSelfAssessment>>({});
  const [error, setError] = useState('');
  useEffect(() => subscribeAllStudyPlans(setPlans, e => setError(e.message)), []);
  useEffect(() => subscribeAllSelfAssessments(setAssess), []);

  const roster = useMemo(
    () => buildRoster(students.map(s => ({ studentId: s.studentId, name: s.name, room: s.room || '' })), plans),
    [students, plans],
  );
  const rows = useMemo(
    () => roster.map(r => ({ ...r, compare: compareWithSelfAssessment(r.plan, assess[r.studentId]?.futureGoals?.careerGoals) })),
    [roster, assess],
  );
  return (
    <section className="space-y-3">
      <h3 className="text-base font-bold text-white">แผนศึกษาต่อ ม.3 / ม.6 และ TCAS</h3>
      <p className="text-xs text-slate-400">ตัวเลขรวมจากที่นักเรียนกรอกเอง — ไม่แสดงรายชื่อ</p>
      {error && <p role="alert" className="text-xs text-rose-400">{error}</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        {(['M6', 'M3'] as StudyLevel[]).map(l => (
          <div key={l}><StudyPlanSummaryCards summary={summarizeRoster(roster, l)} compare={countCompare(rows.filter(r => r.level === l))} /></div>
        ))}
      </div>
    </section>
  );
}
