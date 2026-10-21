import React, { useEffect, useState } from 'react';
import { useCurrentSemester } from '../../hooks/useCurrentSemester';
import {
  MAX_CHOICES, MAX_NOTE, PLAN_STATUS_LABEL, STUDY_LEVEL_LABEL, TCAS_ROUNDS, planStatus, planTypesFor, studyLevelOfRoom, usesChoices,
  validateStudyPlan, type StudyChoice, type StudyPlan, type StudyPlanType,
} from '../../lib/studyPlan';
import { saveStudyPlan, subscribeMyStudyPlan } from '../../services/studyPlanService';

const emptyChoice = (): StudyChoice => ({ institution: '', program: '', round: 'UNSURE' });
const input = 'w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white';

/** นักเรียน ม.3/ม.6 กรอกแผนศึกษาต่อ (ผู้ปกครองดูอย่างเดียว) — บันทึกลง student_study_plans จริง */
export function StudentStudyPlanSection({ student, studentUid, readOnly = false }: {
  student: { studentId: string; name: string; room?: string };
  studentUid: string;
  readOnly?: boolean;
}) {
  const level = studyLevelOfRoom(student.room);
  const { academicYear } = useCurrentSemester();
  const [plan, setPlan] = useState<StudyPlan | null | undefined>(undefined);
  const [planType, setPlanType] = useState<StudyPlanType | ''>('');
  const [choices, setChoices] = useState<StudyChoice[]>([emptyChoice()]);
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [portfolioSent, setPortfolioSent] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => subscribeMyStudyPlan(student.studentId, p => setPlan(p), e => { setError(e.message); setPlan(null); }), [student.studentId]);

  // เติมฟอร์มจากแผนที่บันทึกไว้ครั้งแรกที่โหลด (ไม่ทับสิ่งที่กำลังพิมพ์ตอนมี snapshot ใหม่)
  useEffect(() => {
    if (plan === undefined || loaded) return;
    setLoaded(true);
    if (!plan) return;
    setPlanType(plan.planType);
    setChoices(plan.choices.length ? plan.choices : [emptyChoice()]);
    setPortfolioUrl(plan.portfolioUrl);
    setPortfolioSent(plan.portfolioSent);
    setNote(plan.note);
  }, [plan, loaded]);

  if (!level) {
    return <p className="text-sm text-slate-400">แผนศึกษาต่อใช้กับนักเรียนชั้น ม.3 และ ม.6 เท่านั้น</p>;
  }
  const types = planTypesFor(level);
  const withChoices = planType !== '' && usesChoices(level, planType);
  const status = PLAN_STATUS_LABEL[planStatus(plan ?? null)];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (planType === '') { setError('เลือกแผนหลังจบชั้นนี้'); return; }
    setBusy(true); setError(''); setSaved(false);
    try {
      await saveStudyPlan({
        studentId: student.studentId, studentUid, room: student.room || '', level, academicYear,
        planType, choices: withChoices ? choices : [], portfolioUrl: withChoices ? portfolioUrl : '',
        portfolioSent: withChoices ? portfolioSent : false, note,
      });
      setSaved(true);
    } catch (err) { setError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ'); } finally { setBusy(false); }
  };

  const errsPreview = planType === '' ? [] : validateStudyPlan({ level, planType, choices: withChoices ? choices : [], portfolioUrl: withChoices ? portfolioUrl : '', portfolioSent: withChoices ? portfolioSent : false, note });

  return (
    <form onSubmit={submit} className="space-y-4 animate-in fade-in duration-300">
      <div>
        <h3 className="text-base font-bold text-white">แผนศึกษาต่อ ({STUDY_LEVEL_LABEL[level]}){level === 'M6' ? ' และ TCAS' : ''}</h3>
        <p className="text-xs text-slate-400 mt-1">สถานะ: <b className="text-white">{plan === undefined ? 'กำลังโหลด…' : status}</b> — ครูแนะแนวใช้ข้อมูลนี้ติดตามและให้คำแนะนำ แก้ไขได้ตลอด</p>
        {readOnly && <p className="text-xs text-amber-300 mt-1">ผู้ปกครองดูแผนของบุตรหลานได้อย่างเดียว — ให้นักเรียนกรอกในบัญชีนักเรียน</p>}
      </div>
      {error && <p role="alert" className="text-xs text-rose-400">{error}</p>}
      {saved && <p role="status" className="text-xs text-emerald-400">บันทึกแล้ว</p>}

      <fieldset disabled={readOnly || busy} className="space-y-3">
        <label className="block text-xs font-semibold text-slate-300">หลังจบชั้นนี้วางแผนไว้ว่า
          <select value={planType} onChange={e => setPlanType(e.target.value as StudyPlanType | '')} className={input + ' mt-1'}>
            <option value="">— เลือก —</option>
            {types.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </label>

        {withChoices && (
          <div className="space-y-3">
            <p className="text-xs text-slate-400">สถาบัน/คณะ/สาขาที่สนใจ (เรียงตามความสนใจ ไม่เกิน {MAX_CHOICES} รายการ)</p>
            {choices.map((c, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-3 bg-slate-900/60 border border-slate-800 rounded-xl p-3">
                <input aria-label={`สถาบัน รายการที่ ${i + 1}`} placeholder="สถาบัน/มหาวิทยาลัย" value={c.institution} maxLength={120}
                  onChange={e => setChoices(cs => cs.map((x, j) => j === i ? { ...x, institution: e.target.value } : x))} className={input} />
                <input aria-label={`คณะ/สาขา รายการที่ ${i + 1}`} placeholder="คณะ/สาขา" value={c.program} maxLength={120}
                  onChange={e => setChoices(cs => cs.map((x, j) => j === i ? { ...x, program: e.target.value } : x))} className={input} />
                <div className="flex gap-2">
                  <select aria-label={`รอบ TCAS รายการที่ ${i + 1}`} value={c.round}
                    onChange={e => setChoices(cs => cs.map((x, j) => j === i ? { ...x, round: e.target.value as StudyChoice['round'] } : x))} className={input}>
                    {TCAS_ROUNDS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                  </select>
                  {choices.length > 1 && (
                    <button type="button" onClick={() => setChoices(cs => cs.filter((_, j) => j !== i))} className="text-xs text-rose-300 px-2" aria-label={`ลบรายการที่ ${i + 1}`}>ลบ</button>
                  )}
                </div>
              </div>
            ))}
            {choices.length < MAX_CHOICES && (
              <button type="button" onClick={() => setChoices(cs => [...cs, emptyChoice()])} className="text-xs text-indigo-300 font-bold">+ เพิ่มรายการ</button>
            )}
            <label className="block text-xs font-semibold text-slate-300">ลิงก์พอร์ตโฟลิโอ (https เท่านั้น — ใส่เมื่อมีแล้ว)
              <input value={portfolioUrl} onChange={e => setPortfolioUrl(e.target.value)} placeholder="https://drive.google.com/…" className={input + ' mt-1'} />
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input type="checkbox" checked={portfolioSent} onChange={e => setPortfolioSent(e.target.checked)} />
              ส่งพอร์ตโฟลิโอเข้าระบบ TCAS/สถาบันแล้ว
            </label>
          </div>
        )}

        <label className="block text-xs font-semibold text-slate-300">หมายเหตุ/สิ่งที่อยากให้ครูแนะแนวช่วย (ไม่บังคับ)
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} maxLength={MAX_NOTE} className={input + ' mt-1 resize-none'} />
        </label>
      </fieldset>

      {!readOnly && (
        <div className="space-y-2">
          {errsPreview.length > 0 && <ul className="text-xs text-amber-300 list-disc pl-5">{errsPreview.map(m => <li key={m}>{m}</li>)}</ul>}
          <button type="submit" disabled={busy || planType === '' || errsPreview.length > 0}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold px-5 py-2.5 rounded-xl">
            {busy ? 'กำลังบันทึก…' : 'บันทึกแผนศึกษาต่อ'}
          </button>
        </div>
      )}
    </form>
  );
}
