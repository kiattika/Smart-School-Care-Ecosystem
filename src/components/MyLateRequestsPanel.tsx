import React from 'react';
import { Clock, Flag, CheckCircle, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';
import { LateAttendanceRequestRecord } from '../types';
import { resolveLateRequest, toMs, CONDITION_REMINDER_TH, LATE_STATE_LABEL_TH } from '../lib/lateAttendanceFlow';

const fmt = (ms: number | null) => (ms == null ? '-' : new Date(ms).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }));

/**
 * "คำขอเช็คชื่อย้อนหลังของฉัน" — ไม่ผูกกับวันนี้: คำขอที่อนุมัติ/ขยายเวลาแล้วต้องเห็นและเข้าใช้ได้จนครบกำหนด (รวมข้ามเที่ยงคืนเมื่อรองขยายเวลา)
 * แสดงข้อความเงื่อนไข (อนุมัติแบบมีเงื่อนไข), ธงเหลือง/แดง และ "เลยกำหนด → ทำบันทึกชี้แจงผู้บังคับบัญชา"
 */
export function MyLateRequestsPanel({
  requests, nowMs, todayStr, onEnter,
}: {
  requests: LateAttendanceRequestRecord[];
  nowMs: number;
  todayStr: string;
  onEnter: (req: LateAttendanceRequestRecord) => void;
}) {
  const THREE_DAYS = 3 * 86_400_000;
  const rows = requests
    .map(r => ({ r, res: resolveLateRequest(r, nowMs) }))
    .filter(({ r, res }) => res.state === 'AWAITING' || res.state === 'OPEN' || nowMs - (toMs(r.requestedAt) ?? nowMs) < THREE_DAYS)
    .sort((a, b) => (toMs(b.r.requestedAt) ?? nowMs) - (toMs(a.r.requestedAt) ?? nowMs));
  if (rows.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-800/40 bg-amber-950/10 p-4 space-y-3" id="my-late-requests">
      <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2"><Clock className="w-4 h-4" /> คำขอเช็คชื่อย้อนหลังของฉัน</h3>
      {rows.map(({ r, res }) => (
        <div key={r.id} className="rounded-lg bg-black/20 border border-slate-700/50 p-3 space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-slate-200 font-semibold">
              {r.subjectCode} {r.subjectName} · {r.level} · คาบ {r.periodNumber} · วันสอน {r.teachingDate}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className={cn(
                'px-2 py-0.5 rounded text-[11px] font-bold border',
                res.state === 'OPEN' ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' :
                res.state === 'AWAITING' ? 'text-amber-400 border-amber-500/30 bg-amber-500/10' :
                res.state === 'REJECTED' ? 'text-red-400 border-red-500/30 bg-red-500/10' : 'text-slate-300 border-slate-600 bg-slate-700/40'
              )}>{LATE_STATE_LABEL_TH[res.state]}</span>
              {res.redFlag && <span className="px-2 py-0.5 rounded text-[11px] font-bold border text-red-400 border-red-500/30 bg-red-500/10 flex items-center gap-1"><Flag className="w-3 h-3" /> ขยายเวลา — รีบดำเนินการ</span>}
              {res.yellowFlag && <span className="px-2 py-0.5 rounded text-[11px] font-bold border text-yellow-300 border-yellow-400/30 bg-yellow-400/10 flex items-center gap-1"><Flag className="w-3 h-3" /> รองไม่อนุมัติทับผลหัวหน้า</span>}
            </div>
          </div>
          {res.state === 'OPEN' && <div className="text-[11px] text-slate-400">ดำเนินการได้ถึง {fmt(res.usableUntil)}</div>}
          {res.conditionNote && (
            <div className="text-[11px] text-sky-300 flex gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /><span>เงื่อนไข: {res.conditionNote} — {CONDITION_REMINDER_TH}</span></div>
          )}
          {res.state === 'REJECTED' && res.finalStep?.note && <div className="text-[11px] text-red-300">เหตุผล: {res.finalStep.note}</div>}
          {res.yellowFlag && <div className="text-[11px] text-yellow-300">ข้อมูลที่เช็คไปแล้วยังคงอยู่ แต่ไม่สามารถดำเนินการต่อได้</div>}
          {res.state === 'OVERDUE' && <div className="text-[11px] text-slate-300">พ้นกำหนดแล้ว — กรุณาทำบันทึกชี้แจงผู้บังคับบัญชา (นอกระบบ) แจ้งเหตุผลความจำเป็น</div>}
          {res.state === 'EXPIRED' && <div className="text-[11px] text-slate-300">ไม่มีผู้พิจารณาภายใน 24.00 น. — คำขอหมดอายุ กรุณาทำบันทึกชี้แจงผู้บังคับบัญชา</div>}
          {res.state === 'OPEN' && (
            r.teachingDate === todayStr ? (
              <div className="text-[11px] text-slate-400">เข้าเช็คชื่อได้จากการ์ดคาบในตารางสอนวันนี้</div>
            ) : (
              <button
                onClick={() => onEnter(r)}
                className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 border border-emerald-500/50 rounded-lg flex items-center gap-1.5"
              >
                <CheckCircle className="w-3.5 h-3.5" /> เข้าเช็คชื่อย้อนหลัง (วันสอน {r.teachingDate})
              </button>
            )
          )}
        </div>
      ))}
    </div>
  );
}
