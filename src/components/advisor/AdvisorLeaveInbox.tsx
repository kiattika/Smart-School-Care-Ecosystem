import React, { useState } from 'react';
import { FileText, CheckCircle, XCircle } from 'lucide-react';
import { useStore } from '../../store';
import { decideLeaveRequest, createParentNotification } from '../../services/firestoreService';
import { LEAVE_TYPE_LABEL, canTeacherDecide, isLeavePending, leaveStatusLabel, normalizeLeaveStatus } from '../../lib/leaveFlow';
import type { DetailedLeaveRequest, Student } from '../../types';

/**
 * กล่องใบลานักเรียนของครูที่ปรึกษา — ข้อมูลจริงจาก Firestore (ส่งเข้ามาเป็น prop จาก AdvisorPortal ที่ subscribe ด้วย
 * homeroomClass ของครูเอง) การอนุมัติ/ไม่อนุมัติเขียนจริงและบันทึกชื่อ/staffId ของผู้กดจริง; ใบที่ยังรอผู้ปกครองรับทราบ
 * แสดงให้เห็นแต่ยังตัดสินไม่ได้ (rules บังคับตามลำดับขั้นเดียวกัน)
 */
export function AdvisorLeaveInbox({ leaves, students }: { leaves: DetailedLeaveRequest[]; students: Student[] }) {
  const user = useStore(s => s.user);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remarks, setRemarks] = useState<Record<string, string>>({});

  const pending = leaves.filter(l => isLeavePending(l.status));
  const waitingTeacher = pending.filter(l => canTeacherDecide(l.status));

  const decide = async (leave: DetailedLeaveRequest, decision: 'APPROVED' | 'REJECTED') => {
    if (!user?.displayName) { setError('ไม่พบข้อมูลผู้ใช้ — เข้าสู่ระบบใหม่แล้วลองอีกครั้ง'); return; }
    setBusyId(leave.id);
    setError(null);
    try {
      await decideLeaveRequest(leave.id, decision, { name: user.displayName, staffId: user.staffId }, remarks[leave.id] || '');
      const student = students.find(s => s.studentId === leave.studentId);
      // แจ้งผลให้ผู้ปกครอง/นักเรียนเป็นผลพลอยได้ — ไม่ทำให้การตัดสินล้มเหลวถ้าแจ้งไม่สำเร็จ
      if (leave.parentUid) {
        createParentNotification({
          parentUid: leave.parentUid,
          studentUid: leave.studentUid,
          studentId: leave.studentId,
          studentName: student?.name || leave.studentId,
          title: decision === 'APPROVED' ? '✅ ใบลาได้รับการอนุมัติ' : '❌ ใบลาไม่ได้รับการอนุมัติ',
          message: `ครูที่ปรึกษา (${user.displayName}) ${decision === 'APPROVED' ? 'อนุมัติ' : 'ไม่อนุมัติ'}ใบลาวันที่ ${leave.startDate}${leave.startDate !== leave.endDate ? ` ถึง ${leave.endDate}` : ''}${remarks[leave.id] ? ` — ${remarks[leave.id]}` : ''}`,
          type: decision === 'APPROVED' ? 'info' : 'warning',
        }).catch(err => console.warn('[leave] decision notification failed:', err));
      }
    } catch (err: any) {
      setError(err?.message || 'บันทึกไม่สำเร็จ ลองอีกครั้ง');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="bg-[#1c1f2b] border border-white/10 rounded-xl overflow-hidden flex flex-col flex-1 shadow-lg" data-testid="advisor-leave-inbox">
      <div className="p-4 border-b border-white/10 bg-slate-900/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-400" />
          <h2 className="font-bold text-indigo-400">ใบลาดิจิทัล (รออนุมัติ)</h2>
        </div>
        {waitingTeacher.length > 0 && (
          <span className="bg-indigo-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{waitingTeacher.length}</span>
        )}
      </div>
      <div className="p-4 space-y-3 overflow-y-auto">
        {error && <p role="alert" className="text-xs text-rose-400">{error}</p>}
        {pending.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">ไม่มีใบลาที่รออนุมัติ</div>
        ) : pending.map(req => {
          const student = students.find(s => s.studentId === req.studentId);
          const ready = canTeacherDecide(req.status);
          return (
            <div key={req.id} className="bg-white/5 border border-white/10 rounded-lg p-3">
              <div className="flex justify-between items-start mb-1 gap-2">
                <div className="font-bold text-sm text-slate-200">{student?.name || req.studentId}</div>
                <div className="text-[10px] text-slate-500 bg-black/20 px-1.5 py-0.5 rounded shrink-0">
                  {req.startDate}{req.startDate !== req.endDate ? ` – ${req.endDate}` : ''} ({req.totalDays} วัน)
                </div>
              </div>
              <div className="text-[10px] text-slate-400 mb-1">
                {LEAVE_TYPE_LABEL[req.leaveType]} · ยื่นโดย {req.submittedBy}
                {req.parentAcknowledgedAt ? ' · ผู้ปกครองรับทราบแล้ว' : ''}
              </div>
              <p className="text-xs text-slate-400 mb-3 bg-black/20 p-2 rounded line-clamp-3">{req.reason}</p>
              {ready ? (
                <>
                  <input
                    value={remarks[req.id] || ''}
                    onChange={e => setRemarks(r => ({ ...r, [req.id]: e.target.value }))}
                    maxLength={500}
                    placeholder="ความเห็นครู (ไม่บังคับ)"
                    aria-label="ความเห็นครู"
                    className="w-full mb-2 bg-black/20 border border-white/10 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => decide(req, 'APPROVED')}
                      disabled={busyId === req.id}
                      className="flex-1 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 disabled:opacity-60 border border-emerald-500/30 py-1.5 rounded text-xs font-bold transition-colors flex items-center justify-center gap-1"
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> อนุมัติ
                    </button>
                    <button
                      onClick={() => decide(req, 'REJECTED')}
                      disabled={busyId === req.id}
                      className="flex-1 bg-rose-600/20 text-rose-400 hover:bg-rose-600/30 disabled:opacity-60 border border-rose-500/30 py-1.5 rounded text-xs font-bold transition-colors flex items-center justify-center gap-1"
                    >
                      <XCircle className="w-3.5 h-3.5" /> ไม่อนุมัติ
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1.5">
                  {leaveStatusLabel(req.status, { noParentLinked: req.noParentLinked })} — ยังตัดสินไม่ได้จนกว่าผู้ปกครองจะรับทราบ
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** ใบที่อนุมัติแล้วและครอบคลุมวันที่ที่ระบุ (YYYY-MM-DD) ของนักเรียนคนนั้น */
export function hasApprovedLeaveOn(leaves: DetailedLeaveRequest[], studentId: string, ymd: string): boolean {
  return leaves.some(l => l.studentId === studentId && normalizeLeaveStatus(l.status) === 'APPROVED' && l.startDate <= ymd && ymd <= l.endDate);
}
