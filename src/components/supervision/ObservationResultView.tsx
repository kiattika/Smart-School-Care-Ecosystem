import React, { useState } from 'react';
import { CheckCircle, Loader2 } from 'lucide-react';
import {
  SCORE_LABELS, type SupervisionObservation, type SupervisionScore,
} from '../../lib/supervision';
import { useEvaluationTemplates } from '../../hooks/useEvaluationTemplates';
import { numberedLabel } from '../../lib/evaluationTemplate';
import { OBS_STATUS_LABEL, observationStatus } from '../../lib/supervisionView';
import { acknowledgeSupervisionObservation } from '../../services/supervisionService';

interface Props {
  obs: SupervisionObservation;
  /** ผู้รับการนิเทศดูผลของตนเอง — แสดงปุ่มรับทราบ */
  asTeacher?: boolean;
  onClose?: () => void;
}

/** ผลการสังเกตการสอนฉบับอ่านอย่างเดียว (+ ปุ่มรับทราบสำหรับครูเจ้าของผล) */
export function ObservationResultView({ obs, asTeacher, onClose }: Props) {
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // แสดงด้วยแบบเวอร์ชันที่ใช้ตอนประเมินเสมอ (แอดมินแก้แบบทีหลังไม่กระทบผลเก่า)
  const tpls = useEvaluationTemplates('SUPERVISION');
  const tpl = tpls.byVersion(obs.templateVersion);
  const maxScore = (tpl?.criteria.length ?? 20) * 5;

  const acknowledge = async () => {
    setBusy(true); setError(null);
    try { await acknowledgeSupervisionObservation(obs.id, reply); }
    catch (e) { setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ'); }
    finally { setBusy(false); }
  };

  return (
    <div className="bg-[#161f30] border border-slate-800/80 rounded-xl p-4 sm:p-6 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-white">{obs.teacherName}</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {obs.courseCode} {obs.courseName} {obs.level && `· ${obs.level}`} · {obs.observedDate} {obs.observedTime}
          </p>
          <p className="text-xs text-slate-500">ผู้นิเทศ: {obs.supervisorName} · {OBS_STATUS_LABEL[observationStatus(obs)]}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-black text-cyan-300">{obs.percent ?? '-'}{obs.percent !== null && '%'}</p>
          <p className="text-xs text-slate-300">{obs.band || 'ยังไม่ครบ'} · {obs.total}/{maxScore}</p>
        </div>
      </div>

      {!tpl && <p className="text-sm text-amber-300">{tpls.loading ? 'กำลังโหลดแบบประเมิน…' : 'ไม่พบแบบประเมินเวอร์ชันของผลนี้'}</p>}
      {tpl?.sections.map(sec => (
        <div key={sec.no}>
          <h4 className="text-sm font-bold text-cyan-300 mb-1">หมวด {sec.no} {sec.title}</h4>
          <ul className="divide-y divide-slate-800">
            {tpl.criteria.filter(i => i.section === sec.no).map(item => {
              const v = obs.scores?.[item.id] as SupervisionScore | undefined;
              return (
                <li key={item.id} className="flex items-start justify-between gap-3 py-1.5 text-sm">
                  <span className="text-slate-300">{numberedLabel(tpl, item)}</span>
                  <span className="shrink-0 text-slate-100 font-semibold">{v ?? '-'}{v ? <span className="text-[10px] text-slate-400 font-normal"> {SCORE_LABELS[v]}</span> : null}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {obs.assessmentMethod && <p className="text-sm text-slate-300"><span className="text-slate-500">วิธีประเมินผล: </span>{obs.assessmentMethod}</p>}
      {([['จุดเด่น', obs.strengths], ['ข้อควรพัฒนา/ข้อเสนอแนะ', obs.improvements], ['ความเห็นเพิ่มเติม', obs.comment]] as const)
        .filter(([, v]) => v).map(([k, v]) => (
          <div key={k}><p className="text-xs text-slate-500">{k}</p><p className="text-sm text-slate-200 whitespace-pre-wrap">{v}</p></div>
        ))}
      {obs.photos?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {obs.photos.map((p, i) => (
            <a key={p.url} href={p.url} target="_blank" rel="noopener noreferrer">
              <img src={p.url} alt={`ภาพนิเทศ ${i + 1}`} className="w-24 h-24 object-cover rounded-lg border border-slate-700" />
            </a>
          ))}
        </div>
      )}

      {obs.submitted && obs.acknowledged && (
        <div className="flex items-start gap-2 text-sm text-emerald-300">
          <CheckCircle className="w-4 h-4 mt-0.5" />
          <div>ครูรับทราบผลแล้ว{obs.teacherReply && <p className="text-slate-300 whitespace-pre-wrap">ความเห็นครู: {obs.teacherReply}</p>}</div>
        </div>
      )}
      {asTeacher && obs.submitted && !obs.acknowledged && (
        <div className="space-y-2 border-t border-slate-800 pt-4">
          <label className="text-xs text-slate-400 block">ความเห็นของครู (ถ้ามี)
            <textarea className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" rows={2} maxLength={1000} value={reply} onChange={e => setReply(e.target.value)} />
          </label>
          {error && <p role="alert" className="text-sm text-amber-300">{error}</p>}
          <button onClick={acknowledge} disabled={busy} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg cursor-pointer disabled:opacity-50">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}รับทราบผลการนิเทศ
          </button>
        </div>
      )}
      {onClose && <div className="text-right"><button onClick={onClose} className="text-sm text-slate-400 hover:text-white cursor-pointer">ปิด</button></div>}
    </div>
  );
}
