import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, HeartPulse, Loader2, X } from 'lucide-react';
import { useStore } from '../../store';
import { Student, SDQAssessment } from '../../types';
import { useCurrentSemester } from '../../hooks/useCurrentSemester';
import { subscribeAllSDQAssessments } from '../../services/firestoreService';
import { SDQ_EVALUATOR_LABEL, SdqEvaluatorType, isValidAcademicYear } from '../../lib/sdq';
import { buildSdqSubmission } from '../../lib/sdqSubmission';
import { EMPTY_IMPACT_FORM, ImpactFormValues, SdqEntryForm } from '../shared/SdqEntryForm';
import { SdqStatusView } from '../shared/SdqStatusView';
import { buildSdqRoomStatus } from '../../lib/sdqTrend';
import { EMPTY_SDQ_FORM, SdqFormValues } from '../shared/SdqScoreForm';

/**
 * ครูที่ปรึกษากรอก SDQ ของนักเรียนในห้องตัวเอง (AdvisorPortal → เมนู "SDQ")
 * - รายชื่อทั้งห้อง (students มาจาก useRealStudents ของ AdvisorPortal) + สถานะกรอกแล้ว/ยัง "ในปีการศึกษาปัจจุบัน"
 *   (อ่านสดจาก student_assessments_sdq) ของครูที่ปรึกษา / นักเรียน / ผู้ปกครอง
 * - บันทึกเป็นผู้ประเมิน TEACHER เสมอ ผูกปีการศึกษาจาก school_settings/academic_year (ไม่เดาปี: ยังไม่ตั้ง = บันทึกไม่ได้)
 * - 1 ชุดต่อ (นักเรียน, ครู, ปี) — กรอกแล้วแก้เองไม่ได้ (firestore.rules) ต้องแจ้งครูแนะแนว/ผู้ดูแลระบบ
 * - ไม่เลือกนักเรียนให้อัตโนมัติ: ผู้ใช้ต้องกดแถวของนักเรียนที่ต้องการเอง
 */
export function AdvisorSdqPanel({ room, students, studentsLoading }: { room: string; students: Student[]; studentsLoading: boolean }) {
  const user = useStore(s => s.user);
  const submitSDQAssessment = useStore(s => s.submitSDQAssessment);
  const { academicYear, isConfigured, loading: yearLoading } = useCurrentSemester();
  const yearReady = isConfigured && isValidAcademicYear(academicYear);

  const [all, setAll] = useState<SDQAssessment[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const unsub = subscribeAllSDQAssessments((list) => { setAll(list); setLoaded(true); });
    return unsub;
  }, []);

  const roomIds = useMemo(() => students.map(s => s.studentId), [students]);
  const status = useMemo(() => buildSdqRoomStatus(roomIds, all, academicYear), [roomIds, all, academicYear]);
  const rowById = useMemo(() => new Map(status.rows.map(r => [r.studentId, r])), [status]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [values, setValues] = useState<SdqFormValues>(EMPTY_SDQ_FORM);
  const [impact, setImpact] = useState<ImpactFormValues>(EMPTY_IMPACT_FORM);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ kind: 'ok' | 'error'; message: string } | null>(null);

  const selected = students.find(s => s.studentId === selectedId) || null;
  const selectedDone = selected ? !!rowById.get(selected.studentId)?.byEvaluator.TEACHER : false;

  const open = (id: string) => { setSelectedId(id); setValues(EMPTY_SDQ_FORM); setImpact(EMPTY_IMPACT_FORM); setShowErrors(false); setResult(null); };
  const close = () => { setSelectedId(null); setValues(EMPTY_SDQ_FORM); setImpact(EMPTY_IMPACT_FORM); setShowErrors(false); };

  const handleSave = async () => {
    if (!selected || !user?.uid) return;
    setShowErrors(true);
    setResult(null);
    // ตรวจทั้ง 2 หน้า (25 ข้อ→5 ด้าน + ผลกระทบ) ก่อนบันทึก — ผิด/ไม่ครบ = แสดง error ต่อช่อง ไม่เขียน Firestore
    const built = buildSdqSubmission(values, impact, 'TEACHER');
    if (!built.ok) return;
    if (!yearReady) { setResult({ kind: 'error', message: 'ยังไม่ได้ตั้งปีการศึกษาปัจจุบัน — แจ้งผู้ดูแลระบบให้ตั้งที่หน้า "ปีการศึกษา & ล็อกระบบ"' }); return; }
    setSaving(true);
    try {
      await submitSDQAssessment({
        studentId: selected.studentId,
        // studentUid ต้องตรง students/{id} จริง (rules ตรวจ) — นักเรียนที่ยังไม่เชื่อมบัญชีไม่มี field นี้ = ''
        studentUid: selected.studentUid || '',
        respondentUid: user.uid,
        evaluatorType: 'TEACHER',
        evaluatorName: user.displayName || 'ครูที่ปรึกษา',
        academicYear,
        ...built.fields,
      });
      setResult({ kind: 'ok', message: `บันทึก SDQ ของ ${selected.fullName || selected.name} (ปีการศึกษา ${academicYear}) เรียบร้อย` });
      close();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setResult({
        kind: 'error',
        message: /permission|insufficient/i.test(msg)
          ? 'บันทึกไม่สำเร็จ: ระบบไม่อนุญาต — อาจมีผลประเมินของครูที่ปรึกษาในปีนี้อยู่แล้ว หรือท่านไม่ใช่ครูที่ปรึกษาห้องนี้'
          : `บันทึกไม่สำเร็จ: ${msg}`,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto w-full pb-10 space-y-5" data-testid="advisor-sdq-panel">
      <div className="bg-[#121624] border border-white/10 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-xs font-semibold border border-purple-400/30">SDQ · ครูที่ปรึกษา</span>
            <span className="text-xs text-slate-400">ห้อง {room}</span>
          </div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2"><HeartPulse className="w-5 h-5 text-purple-400" /> แบบประเมินจุดแข็งและจุดอ่อน (SDQ) — มุมมองครู</h2>
          <p className="text-[11px] text-slate-400 mt-1">กรอกคะแนนรายด้านของนักเรียนแต่ละคน 1 ครั้งต่อปีการศึกษา (เกณฑ์เดียวกับหน้าสุขภาพกาย-ใจของนักเรียน/ผู้ปกครอง และหน้าแนะแนว)</p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] text-slate-400">ปีการศึกษา</div>
          <div className="text-xl font-black font-mono text-white">{yearLoading ? '…' : yearReady ? academicYear : '—'}</div>
          <div className="text-[11px] text-slate-300" data-testid="sdq-progress">กรอกแล้ว {status.teacherDone}/{status.total} คน</div>
        </div>
      </div>

      {!yearLoading && !yearReady && (
        <div role="alert" className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs text-amber-300 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>ยังไม่ได้ตั้งปีการศึกษาปัจจุบัน (school_settings/academic_year) — ดูรายชื่อได้ แต่บันทึก SDQ ไม่ได้จนกว่าผู้ดูแลระบบจะตั้งค่าที่หน้า "ปีการศึกษา & ล็อกระบบ"</span>
        </div>
      )}

      {result && (
        <div role={result.kind === 'error' ? 'alert' : 'status'} className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${result.kind === 'ok' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'}`}>
          {result.kind === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
          <span>{result.message}</span>
        </div>
      )}

      {selected && (
        <div className="bg-[#121624] border border-purple-500/30 rounded-2xl p-5 space-y-4" data-testid="sdq-entry-form">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white">{selected.fullName || selected.name} <span className="text-slate-400 font-mono text-xs">· เลขที่ {selected.studentNo ?? '-'} · ID {selected.studentId}</span></h3>
              <p className="text-[11px] text-slate-400">บันทึกในนามครูที่ปรึกษา ปีการศึกษา {yearReady ? academicYear : '—'}</p>
            </div>
            <button type="button" onClick={close} aria-label="ปิดฟอร์ม" className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"><X className="w-4 h-4" /></button>
          </div>
          {selectedDone ? (
            <p className="text-xs text-amber-300">นักเรียนคนนี้มีผลประเมินของครูที่ปรึกษาในปี {academicYear} แล้ว — แก้ไขภายหลังไม่ได้ (ติดต่อครูแนะแนวหรือผู้ดูแลระบบหากต้องแก้)</p>
          ) : (
            <>
              <SdqEntryForm scores={values} onScoresChange={setValues} impact={impact} onImpactChange={setImpact} evaluatorType="TEACHER" disabled={saving} showErrors={showErrors} idPrefix="advisor-sdq" />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={close} disabled={saving} className="px-3 py-2 rounded-lg text-xs text-slate-300 hover:bg-white/5">ยกเลิก</button>
                <button type="button" onClick={handleSave} disabled={saving || !yearReady}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5">
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} บันทึก SDQ
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="bg-[#121624] border border-white/10 rounded-2xl overflow-hidden">
        {studentsLoading || !loaded ? (
          <div className="p-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> กำลังโหลดข้อมูลสด...</div>
        ) : students.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">ไม่พบนักเรียนในห้อง {room}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-slate-400">
                  <th className="px-4 py-2.5 font-medium">เลขที่</th>
                  <th className="px-4 py-2.5 font-medium">นักเรียน</th>
                  <th className="px-4 py-2.5 font-medium">ครูที่ปรึกษา (ปี {academicYear})</th>
                  <th className="px-4 py-2.5 font-medium">นักเรียน / ผู้ปกครอง</th>
                  <th className="px-4 py-2.5 font-medium text-right">ดำเนินการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {students.map((s) => {
                  const row = rowById.get(s.studentId);
                  const done = !!row?.byEvaluator.TEACHER;
                  const chip = (t: SdqEvaluatorType) => (
                    <span key={t} className={`px-1.5 py-0.5 rounded text-[10px] border ${row?.byEvaluator[t] ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : 'bg-slate-800 text-slate-500 border-white/5'}`}>
                      {t === 'STUDENT' ? 'นักเรียน' : 'ผู้ปกครอง'} {row?.byEvaluator[t] ? '✓' : '—'}
                    </span>
                  );
                  return (
                    <tr key={s.studentId} className={selectedId === s.studentId ? 'bg-purple-500/5' : 'hover:bg-white/[0.02]'}>
                      <td className="px-4 py-2.5 font-mono text-slate-400">{s.studentNo ?? '-'}</td>
                      <td className="px-4 py-2.5"><div className="font-semibold text-slate-100">{s.fullName || s.name}</div><div className="text-[10px] text-slate-500 font-mono">ID {s.studentId}</div></td>
                      <td className="px-4 py-2.5" data-testid={`sdq-status-${s.studentId}`}>
                        {done && row?.teacherResult ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-300"><CheckCircle2 className="w-3 h-3" /> กรอกแล้ว</span>
                            <SdqStatusView rec={row.teacherResult} />
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-white/10 bg-slate-800 text-slate-300 text-[10px] font-bold"><Clock className="w-3 h-3" /> ยังไม่กรอก</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5"><div className="flex gap-1">{(['STUDENT', 'PARENT'] as const).map(chip)}</div></td>
                      <td className="px-4 py-2.5 text-right">
                        <button type="button" onClick={() => open(s.studentId)}
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-bold ${done ? 'text-slate-300 bg-white/5 hover:bg-white/10' : 'text-white bg-purple-600 hover:bg-purple-500'}`}>
                          {done ? 'ดูสถานะ' : 'กรอก SDQ'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-[10px] text-slate-500">ประเภทผู้ประเมินที่ระบบรองรับ: {Object.values(SDQ_EVALUATOR_LABEL).join(' · ')} — หน้านี้บันทึกเฉพาะมุมมองครูที่ปรึกษา</p>
    </div>
  );
}
