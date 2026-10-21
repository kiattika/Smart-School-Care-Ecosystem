import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle, X, Clock, AlertTriangle, Flag } from 'lucide-react';
import { useStore } from '../store';
import { cn } from '../lib/utils';
import { LateAttendanceRequestRecord } from '../types';
import { lateAttendanceDecisionNotice, lateAttendanceExtendedNotice } from '../lib/staffNotifications';
import {
  actorKindsFor, mayExtend, resolveLateRequest, toMs, LATE_STATE_LABEL_TH, CONDITION_REMINDER_TH,
  type LateActorKind, type LateDecision,
} from '../lib/lateAttendanceFlow';
import {
  subscribeLateAttendanceRequests,
  decideLateAttendanceRequestFirestore,
  extendLateAttendanceRequestFirestore,
  sendStaffNotifications,
} from '../services/firestoreService';

const fmt = (ms: number | null) => (ms == null ? '-' : new Date(ms).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }));

const STEP_LABEL: Record<string, string> = {
  ACADEMIC_HEAD: 'หัวหน้ากลุ่มงานวิชาการและหลักสูตร',
  DEPUTY_DIRECTOR_ACADEMIC: 'รองผู้อำนวยการกลุ่มงานวิชาการ',
  DIRECTOR: 'ผู้อำนวยการ (สำรอง)',
};
const DECISION_LABEL: Record<LateDecision, string> = { APPROVE: 'อนุมัติตามเสนอ', CONDITIONAL: 'อนุมัติแบบมีเงื่อนไข', REJECT: 'ไม่อนุมัติ' };

type FormState = { id: string; kind: LateActorKind; decision: LateDecision; note: string } | null;

/**
 * รายการคำขอ "เช็คชื่อย้อนหลัง" ของครูผู้สอน (อนุมัติ 2 ขั้น — ตรรกะที่ src/lib/lateAttendanceFlow.ts)
 * - ACADEMIC_HEAD / DEPUTY_DIRECTOR_ACADEMIC / DIRECTOR(สำรอง): ตัดสินได้ตามสิทธิ์และเวลาของคำขอแต่ละรายการ
 * - `readOnly` (EXECUTIVE): ดูอย่างเดียว; SUPER_ADMIN ไม่มีสิทธิ์อนุมัติ
 * ปุ่ม/ช่วงเวลาที่แสดงเป็นเพียงตัวช่วย — ด่านจริงคือ firestore.rules (เวลาเซิร์ฟเวอร์)
 */
export function LateAttendanceApprovalList({ readOnly = false }: { readOnly?: boolean } = {}) {
  const user = useStore(s => s.user);
  const [requests, setRequests] = useState<LateAttendanceRequestRecord[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(null);
  const [extendHours, setExtendHours] = useState(12);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => subscribeLateAttendanceRequests(setRequests), []);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);

  const myRoles = user?.profile?.roles;
  const actor = useMemo(() => ({ roles: (myRoles || []) as string[], staffId: user?.staffId || '' }), [myRoles, user?.staffId]);
  const approverName = user?.displayName || user?.email || 'ผู้อนุมัติ';

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const submitDecision = async () => {
    if (!form || !user?.uid || !user.staffId) return;
    const req = requests.find(r => r.id === form.id);
    if (!req) return;
    if (form.decision !== 'APPROVE' && !form.note.trim()) { flash('กรุณาระบุเหตุผล/เงื่อนไข'); return; }
    setBusy(true);
    try {
      const before = resolveLateRequest(req, Date.now());
      await decideLateAttendanceRequestFirestore(req.id, {
        kind: form.kind,
        decision: form.decision,
        note: form.note,
        approver: { uid: user.uid, staffId: user.staffId, name: approverName },
      });
      // แจ้งผลถึงครู — ผลตัดสินสำเร็จแล้ว ข้อความพลาดต้องไม่ทำให้ดูเหมือนอนุมัติล้มเหลว
      const overridesHead = form.kind !== 'HEAD' && !!req.headStep && req.headStep.decision !== 'REJECT' && form.decision === 'REJECT' && before.outcome !== 'PENDING';
      const note = form.decision === 'CONDITIONAL' ? `${form.note.trim()} · ${CONDITION_REMINDER_TH}` : form.note.trim();
      void sendStaffNotifications(
        [lateAttendanceDecisionNotice(req, form.decision, approverName, note, { overridesHead })],
        { uid: user.uid, name: approverName },
      );
      flash(form.decision === 'REJECT' ? 'บันทึกการไม่อนุมัติแล้ว' : 'บันทึกการอนุมัติแล้ว');
      setForm(null);
    } catch (err) {
      flash('ดำเนินการไม่สำเร็จ: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  };

  const doExtend = async (req: LateAttendanceRequestRecord) => {
    if (!user?.uid || !user.staffId) return;
    const deadline = toMs(req.deadlineAt);
    if (deadline == null) return;
    setBusy(true);
    try {
      const role = actor.roles.includes('DEPUTY_DIRECTOR_ACADEMIC') && req.requesterLevel !== 'DEPUTY' ? 'DEPUTY_DIRECTOR_ACADEMIC' : 'DIRECTOR';
      const until = await extendLateAttendanceRequestFirestore(req.id, deadline, extendHours, { uid: user.uid, staffId: user.staffId, name: approverName, role });
      void sendStaffNotifications([lateAttendanceExtendedNotice(req, approverName, fmt(until))], { uid: user.uid, name: approverName });
      flash('ขยายเวลาให้ครูแล้ว (ธงแดง)');
    } catch (err) {
      flash('ขยายเวลาไม่สำเร็จ: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  };

  const rows = requests.map(r => ({ r, res: resolveLateRequest(r, now) }));
  // "รอดำเนินการ" = ยังไม่มีผู้ตัดสิน หรือรองยังทบทวนผลหัวหน้าได้
  const open = rows.filter(x => x.res.state === 'AWAITING' || x.res.deputyReviewOpen);
  const done = rows.filter(x => !(x.res.state === 'AWAITING' || x.res.deputyReviewOpen));

  const renderStep = (label: string, step: LateAttendanceRequestRecord['headStep']) => {
    if (!step) return null;
    return (
      <div className="text-[11px] text-slate-400">
        {label}: <span className="text-slate-200 font-semibold">{DECISION_LABEL[step.decision]}</span> · {step.byName} ({STEP_LABEL[step.role]}) · {fmt(toMs(step.at))}
        {step.note ? <span className="block text-slate-300">“{step.note}”</span> : null}
      </div>
    );
  };

  const renderCard = ({ r: req, res }: { r: LateAttendanceRequestRecord; res: ReturnType<typeof resolveLateRequest> }) => {
    const kinds = readOnly ? [] : actorKindsFor(req, actor, now);
    const canExtend = !readOnly && mayExtend(req, actor, now);
    const tone =
      res.state === 'OPEN' ? 'bg-emerald-950/20 border-emerald-800/40' :
      res.state === 'REJECTED' ? 'bg-red-950/20 border-red-800/40' :
      res.state === 'AWAITING' ? 'bg-amber-950/20 border-amber-800/50' : 'bg-slate-900/60 border-slate-700/60';
    return (
      <div key={req.id} className={cn('p-4 rounded-xl border', tone)}>
        <div className="flex flex-wrap justify-between items-start gap-3">
          <div className="space-y-1 min-w-0">
            <div className="text-sm font-bold text-white">
              {req.subjectCode} {req.subjectName}
              <span className="ml-2 text-xs font-normal text-slate-300">
                {req.level} · คาบ {req.periodNumber}{req.room ? ` · ห้อง ${req.room}` : ''}
              </span>
            </div>
            <div className="text-xs text-slate-400">
              ครู: <span className="text-slate-200 font-semibold">{req.teacherName}</span> · วันสอน {req.teachingDate}
              {' · '}ยื่นเมื่อ {fmt(toMs(req.requestedAt))}
              {req.requesterLevel === 'HEAD' ? ' · (ผู้ยื่นเป็นหัวหน้ากลุ่มงาน → รอง/ผอ. ตัดสิน)' : ''}
              {req.requesterLevel === 'DEPUTY' ? ' · (ผู้ยื่นเป็นรอง → ผอ. ตัดสิน)' : ''}
            </div>
            <div className="text-xs text-slate-300 bg-black/20 rounded p-2 mt-1">เหตุผล: {req.reason}</div>
            {renderStep('หัวหน้า', req.headStep)}
            {renderStep('รอง/ผอ.', req.deputyStep)}
            {res.deputyReviewOpen && (
              <div className="text-[11px] text-amber-300">รอง/ผอ. ทบทวนผลของหัวหน้าได้ถึง {fmt(toMs(req.headStep?.reviewUntil))} — หากไม่ตัดสิน ผลของหัวหน้ายืนตามเดิม</div>
            )}
            {res.state === 'AWAITING' && (
              <div className="text-[11px] text-slate-400">หมดอายุถ้าไม่มีผู้ตัดสินก่อน {fmt(toMs(req.deadlineAt))}</div>
            )}
            {res.state === 'OPEN' && (
              <div className="text-[11px] text-slate-400">ครูใช้สิทธิ์ได้ถึง {fmt(res.usableUntil)}</div>
            )}
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="flex flex-wrap justify-end gap-1.5">
              <span className={cn(
                'px-2.5 py-1 rounded text-[11px] font-bold border',
                res.state === 'OPEN' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' :
                res.state === 'REJECTED' ? 'bg-red-500/10 text-red-400 border-red-500/25' :
                res.state === 'AWAITING' ? 'bg-amber-500/10 text-amber-400 border-amber-500/25' : 'bg-slate-700/40 text-slate-300 border-slate-600'
              )}>
                {LATE_STATE_LABEL_TH[res.state]}
              </span>
              {res.outcome === 'CONDITIONAL' && (
                <span className="px-2 py-1 rounded text-[11px] font-bold border bg-sky-500/10 text-sky-300 border-sky-500/25">มีเงื่อนไข</span>
              )}
              {res.yellowFlag && (
                <span title="รองไม่อนุมัติทับผลของหัวหน้า" className="px-2 py-1 rounded text-[11px] font-bold border bg-yellow-400/10 text-yellow-300 border-yellow-400/30 flex items-center gap-1"><Flag className="w-3 h-3" /> ธงเหลือง</span>
              )}
              {res.redFlag && (
                <span title="ขยายเวลา — ครูต้องรีบดำเนินการ" className="px-2 py-1 rounded text-[11px] font-bold border bg-red-500/10 text-red-400 border-red-500/30 flex items-center gap-1"><Flag className="w-3 h-3" /> ธงแดง</span>
              )}
            </div>
            {kinds.length > 0 && (
              <div className="flex flex-wrap justify-end gap-2">
                {(['APPROVE', 'CONDITIONAL', 'REJECT'] as LateDecision[])
                  .map(d => (
                    <button
                      key={d}
                      disabled={busy}
                      onClick={() => setForm({ id: req.id, kind: kinds[0], decision: d, note: '' })}
                      className={cn(
                        'px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1 border',
                        d === 'APPROVE' && 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500',
                        d === 'CONDITIONAL' && 'bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border-sky-500/30',
                        d === 'REJECT' && 'bg-red-600/15 hover:bg-red-600/25 text-red-400 border-red-500/25',
                      )}
                    >
                      {d === 'APPROVE' ? <CheckCircle className="w-3.5 h-3.5" /> : d === 'CONDITIONAL' ? <AlertTriangle className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                      {DECISION_LABEL[d]}
                    </button>
                  ))}
              </div>
            )}
            {canExtend && (
              <div className="flex items-center gap-1.5">
                <select
                  value={extendHours}
                  onChange={e => setExtendHours(Number(e.target.value))}
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-200"
                  aria-label="ขยายเวลา (ชั่วโมง)"
                >
                  {[6, 12, 18, 24].map(h => <option key={h} value={h}>+{h} ชม.</option>)}
                </select>
                <button
                  disabled={busy}
                  onClick={() => doExtend(req)}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg border bg-red-600/15 hover:bg-red-600/25 text-red-300 border-red-500/25"
                >
                  ขยายเวลาให้ครู
                </button>
              </div>
            )}
          </div>
        </div>
        {form?.id === req.id && (
          <div className="mt-3 p-3 rounded-lg bg-black/25 border border-slate-700/60 space-y-2">
            <div className="text-xs font-bold text-slate-200">{DECISION_LABEL[form.decision]}</div>
            {form.decision === 'CONDITIONAL' && (
              <p className="text-[11px] text-slate-400">ข้อความนี้จะแสดงให้ครูอ่านเป็นการเตือน พร้อมข้อความมาตรฐาน: “{CONDITION_REMINDER_TH}”</p>
            )}
            {form.decision === 'REJECT' && req.headStep && req.headStep.decision !== 'REJECT' && (
              <p className="text-[11px] text-yellow-300">ผลนี้จะลบล้างการอนุมัติของหัวหน้า (ติดธงเหลือง) — ข้อมูลเช็คชื่อที่ครูทำไปแล้วยังคงอยู่</p>
            )}
            {form.decision !== 'APPROVE' && (
              <textarea
                value={form.note}
                onChange={e => setForm({ ...form, note: e.target.value.slice(0, 300) })}
                rows={2}
                placeholder={form.decision === 'REJECT' ? 'เหตุผลที่ไม่อนุมัติ (แสดงให้ครูเห็น)' : 'เงื่อนไข/ข้อควรระวังสำหรับครู'}
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-slate-100"
              />
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setForm(null)} className="px-3 py-1.5 text-xs rounded-lg text-slate-300 hover:bg-slate-800">ยกเลิก</button>
              <button disabled={busy} onClick={submitDecision} className="px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white">
                {busy ? 'กำลังบันทึก...' : 'ยืนยัน'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-400" /> คำขอเช็คชื่อย้อนหลัง
          {open.length > 0 && (
            <span className="text-[11px] bg-amber-500 text-slate-950 font-bold px-2 py-0.5 rounded-full">{open.length}</span>
          )}
          {readOnly && (
            <span className="text-[10px] font-bold bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">ดูอย่างเดียว</span>
          )}
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          {readOnly
            ? 'ดูเพื่อกำกับดูแล — อนุมัติโดยหัวหน้ากลุ่มงานวิชาการและหลักสูตร และรองผู้อำนวยการกลุ่มงานวิชาการ (ผู้อำนวยการสำรอง)'
            : 'ใครอนุมัติก่อนก็ได้ — หัวหน้าอนุมัติแล้วครูดำเนินการได้ทันที รองทบทวน/ล้างผลได้ถึง 18.00 น. หากไม่ตัดสินผลของหัวหน้ายืนตามเดิม; ไม่มีผู้ตัดสินจนเลย 24.00 น. คำขอหมดอายุ'}
        </p>
      </div>

      {open.length === 0 ? (
        <div className="text-center py-10 text-slate-500 text-sm border border-dashed border-slate-800 rounded-xl">
          ไม่มีคำขอเช็คชื่อย้อนหลังที่รอดำเนินการ
        </div>
      ) : (
        <div className="space-y-3">{open.map(renderCard)}</div>
      )}

      {done.length > 0 && (
        <div className="space-y-3 pt-2">
          <h4 className="text-sm font-bold text-slate-400">ประวัติ ({done.length})</h4>
          {done.map(renderCard)}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-800 border border-slate-700 text-slate-100 text-sm font-medium px-4 py-2.5 rounded-xl shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  );
}
