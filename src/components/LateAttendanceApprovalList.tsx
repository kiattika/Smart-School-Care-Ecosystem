import React, { useEffect, useState } from 'react';
import { CheckCircle, X, Clock } from 'lucide-react';
import { useStore } from '../store';
import { cn } from '../lib/utils';
import { LateAttendanceRequestRecord } from '../types';
import {
  subscribeLateAttendanceRequests,
  decideLateAttendanceRequestFirestore,
} from '../services/firestoreService';

/**
 * รายการคำขอ "เช็คชื่อย้อนหลัง" ของครูผู้สอน
 * - ผู้อนุมัติ (DEPUTY_DIRECTOR_ACADEMIC / SUPER_ADMIN): อนุมัติ/ปฏิเสธได้
 * - `readOnly` (เช่น DIRECTOR ที่ดูเพื่อกำกับดูแล): ดูรายการอย่างเดียว ไม่มีปุ่มอนุมัติ/ปฏิเสธ
 *   (business logic: การอนุมัติจริงจบที่ DEPUTY_DIRECTOR_ACADEMIC — ผอ. ไม่กดอนุมัติเองในขั้นนี้)
 * อ่านจาก Firestore สด (late_attendance_requests) — อนุมัติ/ปฏิเสธ = merge เปลี่ยนแค่ status (ไม่ลบ doc)
 */
export function LateAttendanceApprovalList({ readOnly = false }: { readOnly?: boolean } = {}) {
  const user = useStore(s => s.user);
  const [requests, setRequests] = useState<LateAttendanceRequestRecord[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => subscribeLateAttendanceRequests(setRequests), []);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const decide = async (req: LateAttendanceRequestRecord, decision: 'APPROVED' | 'REJECTED') => {
    if (!user?.uid) return;
    let rejectReason: string | undefined;
    if (decision === 'REJECTED') {
      rejectReason = window.prompt('เหตุผลที่ไม่อนุมัติ (จะแสดงให้ครูเห็น):', '') || undefined;
      if (rejectReason === undefined) return; // กด cancel
    }
    try {
      await decideLateAttendanceRequestFirestore(
        req.id,
        decision,
        { uid: user.uid, name: user.displayName || user.email || 'ผู้อนุมัติ' },
        rejectReason
      );
      flash(decision === 'APPROVED' ? 'อนุมัติคำขอแล้ว' : 'ปฏิเสธคำขอแล้ว');
    } catch (err) {
      flash('ดำเนินการไม่สำเร็จ: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const pending = requests.filter(r => r.status === 'PENDING');
  const decided = requests.filter(r => r.status !== 'PENDING');

  const renderCard = (req: LateAttendanceRequestRecord) => (
    <div key={req.id} className={cn(
      'p-4 rounded-xl border',
      req.status === 'PENDING' ? 'bg-amber-950/20 border-amber-800/50' :
      req.status === 'APPROVED' ? 'bg-emerald-950/20 border-emerald-800/40' : 'bg-red-950/20 border-red-800/40'
    )}>
      <div className="flex flex-wrap justify-between items-start gap-3">
        <div className="space-y-1">
          <div className="text-sm font-bold text-white">
            {req.subjectCode} {req.subjectName}
            <span className="ml-2 text-xs font-normal text-slate-300">
              {req.level} · คาบ {req.periodNumber}{req.room ? ` · ห้อง ${req.room}` : ''}
            </span>
          </div>
          <div className="text-xs text-slate-400">
            ครู: <span className="text-slate-200 font-semibold">{req.teacherName}</span> · วันสอน {req.teachingDate}
            {' · '}ยื่นเมื่อ {req.requestedAt ? new Date(req.requestedAt).toLocaleString('th-TH') : '-'}
          </div>
          <div className="text-xs text-slate-300 bg-black/20 rounded p-2 mt-1">เหตุผล: {req.reason}</div>
          {req.status !== 'PENDING' && (
            <div className="text-[11px] text-slate-400 mt-1">
              {req.status === 'APPROVED' ? 'อนุมัติโดย' : 'ปฏิเสธโดย'} {req.approverName || '-'}
              {req.decidedAt ? ` เมื่อ ${new Date(req.decidedAt).toLocaleString('th-TH')}` : ''}
              {req.status === 'REJECTED' && req.rejectReason ? ` — ${req.rejectReason}` : ''}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {req.status === 'PENDING' && !readOnly ? (
            <>
              <button
                onClick={() => decide(req, 'APPROVED')}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center gap-1"
              >
                <CheckCircle className="w-3.5 h-3.5" /> อนุมัติ
              </button>
              <button
                onClick={() => decide(req, 'REJECTED')}
                className="px-3 py-1.5 bg-red-600/15 hover:bg-red-600/25 text-red-400 border border-red-500/25 text-xs font-bold rounded-lg flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" /> ปฏิเสธ
              </button>
            </>
          ) : (
            <span className={cn(
              'px-2.5 py-1 rounded text-[11px] font-bold border',
              req.status === 'PENDING' ? 'bg-amber-500/10 text-amber-400 border-amber-500/25' :
              req.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' : 'bg-red-500/10 text-red-400 border-red-500/25'
            )}>
              {req.status === 'PENDING' ? 'รออนุมัติ' : req.status === 'APPROVED' ? 'อนุมัติแล้ว' : 'ปฏิเสธแล้ว'}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-400" /> คำขอเช็คชื่อย้อนหลัง{readOnly ? '' : ' (รออนุมัติ)'}
          {pending.length > 0 && (
            <span className="text-[11px] bg-amber-500 text-slate-950 font-bold px-2 py-0.5 rounded-full">{pending.length}</span>
          )}
          {readOnly && (
            <span className="text-[10px] font-bold bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">ดูอย่างเดียว</span>
          )}
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          {readOnly
            ? 'ดูเพื่อกำกับดูแล — การอนุมัติจริงดำเนินการโดยรองผู้อำนวยการฝ่ายวิชาการ'
            : 'คำขอจากครูผู้สอนที่ลืมเช็คชื่อในคาบ — อนุมัติแล้วครูจะเข้าเช็คชื่อย้อนหลังได้ (เช็คชื่ออย่างเดียว)'}
        </p>
      </div>

      {pending.length === 0 ? (
        <div className="text-center py-10 text-slate-500 text-sm border border-dashed border-slate-800 rounded-xl">
          ไม่มีคำขอเช็คชื่อย้อนหลังที่รออนุมัติ
        </div>
      ) : (
        <div className="space-y-3">{pending.map(renderCard)}</div>
      )}

      {decided.length > 0 && (
        <div className="space-y-3 pt-2">
          <h4 className="text-sm font-bold text-slate-400">ประวัติที่ดำเนินการแล้ว ({decided.length})</h4>
          {decided.map(renderCard)}
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
