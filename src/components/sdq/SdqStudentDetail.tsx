import React, { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, RefreshCcw } from 'lucide-react';
import { useStore } from '../../store';
import { SDQAssessment } from '../../types';
import { SDQ_TRIAGE_LABEL } from '../../lib/sdq';
import {
  SDQ_EVALUATORS, SDQ_FOLLOWUP_REASON_MAX, progressLabel, resultsOf, round2Eligibility, triangulate, validateFollowUpReason,
} from '../../lib/sdqScreening';
import { buildSdqSubmissionFromAnswers } from '../../lib/sdqSubmission';
import { SdqAnswers } from '../../lib/sdqQuestionnaire';
import { EMPTY_IMPACT_FORM, ImpactFormValues, SdqEntryForm } from '../shared/SdqEntryForm';
import { EMPTY_SDQ_ANSWERS } from '../shared/SdqQuestionnaireForm';
import { SdqResultCard, EVALUATOR_BADGE } from './SdqResultCard';
import { SdqTriangulationBox } from './SdqTriangulationBox';

const TONE: Record<string, string> = {
  better: 'text-emerald-300', same: 'text-slate-300', worse: 'text-rose-300', none: 'text-slate-500',
};

/**
 * บุคลากร (ครูที่ปรึกษา / ครูแนะแนว): ผล SDQ ครบ 3 มุมมองของนักเรียน 1 คน + ความสอดคล้อง + แนวทางช่วยเหลือ
 * และการประเมินซ้ำรอบที่ 2 (มุมมองครู ภาคเรียนที่ 2 เท่านั้น — ต้องมีเหตุผล; rules บังคับซ้ำ)
 */
export function SdqStudentDetail({
  student, records, academicYear, term, yearReady, canRound2,
}: {
  student: { studentId: string; name: string; studentUid?: string };
  records: SDQAssessment[];
  academicYear: string;
  term: '1' | '2';
  yearReady: boolean;
  canRound2: boolean;
}) {
  const user = useStore(s => s.user);
  const submitSDQAssessment = useStore(s => s.submitSDQAssessment);
  const r1 = useMemo(() => resultsOf(records, student.studentId, academicYear, 1), [records, student.studentId, academicYear]);
  const r2 = useMemo(() => resultsOf(records, student.studentId, academicYear, 2).TEACHER, [records, student.studentId, academicYear]);
  const tri = useMemo(() => triangulate(r1), [r1]);
  const elig = useMemo(() => round2Eligibility(r1), [r1]);

  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState<SdqAnswers>(EMPTY_SDQ_ANSWERS);
  const [impact, setImpact] = useState<ImpactFormValues>(EMPTY_IMPACT_FORM);
  const [reason, setReason] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const startRound2 = () => { setOpen(true); setAnswers(EMPTY_SDQ_ANSWERS); setImpact(EMPTY_IMPACT_FORM); setReason(elig.autoReason); setShowErrors(false); setMsg(null); };

  const saveRound2 = async () => {
    if (!user?.uid) { setMsg({ ok: false, text: 'ไม่พบผู้ใช้ที่ล็อกอิน — บันทึกไม่ได้' }); return; }
    setShowErrors(true);
    const reasonErr = validateFollowUpReason(reason);
    const built = buildSdqSubmissionFromAnswers(answers, impact, 'TEACHER');
    if (reasonErr || !built.ok) { if (reasonErr) setMsg({ ok: false, text: reasonErr }); return; }
    setSaving(true); setMsg(null);
    try {
      await submitSDQAssessment({
        studentId: student.studentId,
        studentUid: student.studentUid || '',
        respondentUid: user.uid,
        evaluatorType: 'TEACHER',
        evaluatorName: user.displayName || 'ครู',
        academicYear,
        round: 2,
        followUpReason: reason.trim(),
        ...built.fields,
      });
      setOpen(false);
      setMsg({ ok: true, text: 'บันทึกการประเมินซ้ำ (รอบที่ 2) เรียบร้อย' });
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      setMsg({ ok: false, text: /permission|insufficient/i.test(m) ? 'บันทึกไม่สำเร็จ: ระบบไม่อนุญาต — ประเมินซ้ำได้เฉพาะภาคเรียนที่ 2 ครั้งเดียว โดยครูที่ปรึกษาห้องนั้นหรือครูแนะแนว' : `บันทึกไม่สำเร็จ: ${m}` });
    } finally { setSaving(false); }
  };

  const prog = progressLabel(r1.TEACHER?.triagingStatus, r2?.triagingStatus);

  return (
    <div className="space-y-4" data-testid="sdq-student-detail">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {SDQ_EVALUATORS.map(e => (
          <div key={e}>
            {r1[e] ? <SdqResultCard sdq={r1[e]!} /> : (
              <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-4 h-full">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${EVALUATOR_BADGE[e].cls}`}>{EVALUATOR_BADGE[e].label}</span>
                <p className="text-[11px] text-slate-500 mt-3">ยังไม่ได้ประเมินในปีการศึกษา {academicYear}</p>
              </div>
            )}
          </div>
        ))}
      </div>
      <SdqTriangulationBox tri={tri} showStaffAction />

      {/* รอบที่ 2 (ติดตามผล) */}
      <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/40 space-y-3" data-testid="sdq-round2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-bold text-white flex items-center gap-1.5"><RefreshCcw className="w-3.5 h-3.5 text-purple-400" /> ประเมินซ้ำ รอบที่ 2 (ภาคเรียนที่ 2 · มุมมองครู)</h4>
          {r2 && <span className={`text-[11px] font-bold ${TONE[prog.tone]}`}>เทียบรอบแรก (มุมมองครู): {prog.text}</span>}
        </div>
        {r2 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SdqResultCard sdq={r2} title="รอบที่ 2 · มุมมองครู" />
            <div className="text-[11px] text-slate-400 space-y-1">
              <p>รอบที่ 1 (ครู): {r1.TEACHER ? SDQ_TRIAGE_LABEL[r1.TEACHER.triagingStatus] : 'ยังไม่ได้ประเมิน'}</p>
              <p>รอบที่ 2 (ครู): {SDQ_TRIAGE_LABEL[r2.triagingStatus]}</p>
            </div>
          </div>
        ) : !canRound2 ? (
          <p className="text-[11px] text-slate-500">ท่านไม่มีสิทธิ์ประเมินซ้ำนักเรียนคนนี้</p>
        ) : !yearReady ? (
          <p className="text-[11px] text-amber-300">ยังไม่ได้ตั้งปีการศึกษา/ภาคเรียนปัจจุบัน</p>
        ) : term !== '2' ? (
          <p className="text-[11px] text-slate-400">เปิดให้ประเมินซ้ำได้ในภาคเรียนที่ 2 — สำหรับนักเรียนที่รอบแรกเสี่ยง/มีปัญหา หรืออยู่ระหว่างการดูแลช่วยเหลืออย่างใกล้ชิด{elig.byRisk ? ` (${elig.autoReason})` : ''}</p>
        ) : !open ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-slate-300">{elig.byRisk ? `${elig.autoReason} — แนะนำให้ประเมินซ้ำเพื่อดูความก้าวหน้า` : 'รอบแรกไม่พบความเสี่ยง — ประเมินซ้ำได้หากอยู่ระหว่างการดูแลช่วยเหลืออย่างใกล้ชิด (ต้องระบุเหตุผล)'}</p>
            <button type="button" onClick={startRound2} className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white bg-purple-600 hover:bg-purple-500">ประเมินซ้ำรอบที่ 2</button>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block text-[11px] text-slate-300" htmlFor={`r2-reason-${student.studentId}`}>เหตุผลที่ประเมินซ้ำ (จำเป็น)</label>
            <textarea id={`r2-reason-${student.studentId}`} value={reason} maxLength={SDQ_FOLLOWUP_REASON_MAX} onChange={e => setReason(e.target.value)} rows={2}
              placeholder="เช่น อยู่ระหว่างการดูแลช่วยเหลืออย่างใกล้ชิด หลังเยี่ยมบ้าน/ให้คำปรึกษา"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100" />
            <SdqEntryForm answers={answers} onAnswersChange={setAnswers} impact={impact} onImpactChange={setImpact} evaluatorType="TEACHER" disabled={saving} showErrors={showErrors} idPrefix={`r2-${student.studentId}`} />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} disabled={saving} className="px-3 py-2 rounded-lg text-xs text-slate-300 hover:bg-white/5">ยกเลิก</button>
              <button type="button" onClick={() => void saveRound2()} disabled={saving} className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-50 inline-flex items-center gap-1.5">
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} บันทึกการประเมินซ้ำ
              </button>
            </div>
          </div>
        )}
        {msg && (
          <div role={msg.ok ? 'status' : 'alert'} className={`text-xs flex items-start gap-2 ${msg.ok ? 'text-emerald-300' : 'text-rose-300'}`}>
            {msg.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />} {msg.text}
          </div>
        )}
      </div>
    </div>
  );
}
