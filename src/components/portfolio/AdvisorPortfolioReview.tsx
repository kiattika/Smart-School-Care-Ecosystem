import React, { useEffect, useMemo, useState } from 'react';
import { Award, GraduationCap, Briefcase, HandHeart, CheckCircle2, XCircle, Loader2, FolderCheck } from 'lucide-react';
import { useStore } from '../../store';
import { StudentPortfolioEntry, StudentPortfolioEntryType } from '../../types';
import {
  subscribeStudentPortfolioEntries,
  decideStudentPortfolioEntry,
} from '../../services/firestoreService';

/**
 * ส่วน B (วิชาการ/แฟ้มสะสมผลงาน) ของแดชบอร์ดครูที่ปรึกษา:
 * - คิวรายการที่รออนุมัติ (PENDING) ของนักเรียนในห้อง → อนุมัติ / ไม่อนุมัติ (ระบุเหตุผล)
 * - ประวัติที่ตรวจแล้ว
 * query filter ด้วย homeroomClass ให้ผ่าน firestore.rules
 */

const TYPE_META: Record<StudentPortfolioEntryType, { label: string; icon: React.ReactNode; color: string }> = {
  AWARD: { label: 'รางวัล', icon: <Award className="w-4 h-4" />, color: 'text-amber-400' },
  TRAINING: { label: 'การอบรม', icon: <GraduationCap className="w-4 h-4" />, color: 'text-blue-400' },
  INTERNSHIP: { label: 'การฝึกงาน', icon: <Briefcase className="w-4 h-4" />, color: 'text-purple-400' },
  VOLUNTEER: { label: 'จิตอาสา', icon: <HandHeart className="w-4 h-4" />, color: 'text-emerald-400' },
};

export function AdvisorPortfolioReview({ homeroomClass }: { homeroomClass?: string }) {
  const user = useStore(s => s.user);
  const [entries, setEntries] = useState<StudentPortfolioEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!homeroomClass) { setLoading(false); return; }
    setLoading(true);
    const unsub = subscribeStudentPortfolioEntries((list) => {
      setEntries(list);
      setLoading(false);
    }, { homeroomClass });
    return unsub;
  }, [homeroomClass]);

  const pending = useMemo(() => entries.filter(e => e.status === 'PENDING'), [entries]);
  const reviewed = useMemo(() => entries.filter(e => e.status !== 'PENDING'), [entries]);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3500); };

  const decide = async (entry: StudentPortfolioEntry, decision: 'APPROVED' | 'REJECTED') => {
    if (!user?.uid) return;
    let reason: string | undefined;
    if (decision === 'REJECTED') {
      const r = window.prompt('เหตุผลที่ไม่อนุมัติ (นักเรียนจะเห็นข้อความนี้):', '');
      if (r === null) return;
      reason = r || undefined;
    }
    setBusyId(entry.id);
    try {
      await decideStudentPortfolioEntry(entry.id, decision, {
        uid: user.uid,
        name: user.displayName || user.email || 'ครูที่ปรึกษา',
      }, reason);
      flash(decision === 'APPROVED' ? 'อนุมัติแล้ว' : 'ทำรายการไม่อนุมัติแล้ว');
    } catch (err) {
      flash('ทำรายการไม่สำเร็จ: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setBusyId(null);
    }
  };

  if (!homeroomClass) {
    return (
      <div className="p-4 text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl">
        บัญชีนี้ยังไม่ได้กำหนดห้องที่ปรึกษา (staff/{'{uid}'}.assignments.homeroomClass) — ติดต่อผู้ดูแลระบบ
      </div>
    );
  }

  const card = (e: StudentPortfolioEntry) => {
    const tm = TYPE_META[e.type];
    return (
      <div key={e.id} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-start gap-2.5">
            <span className={`mt-0.5 ${tm.color}`}>{tm.icon}</span>
            <div>
              <div className="text-sm font-bold text-white">{e.title}</div>
              <div className="text-[11px] text-slate-400">
                {tm.label} · เลขประจำตัว {e.studentId} · กิจกรรมวันที่ {e.entryDate}
                {' · '}ส่งเมื่อ {e.submittedAt ? new Date(e.submittedAt).toLocaleDateString('th-TH') : '-'}
              </div>
            </div>
          </div>
          {e.status !== 'PENDING' && (
            <span className={`px-2 py-1 rounded-lg border text-[10px] font-bold ${
              e.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'
            }`}>
              {e.status === 'APPROVED' ? 'อนุมัติแล้ว' : 'ไม่อนุมัติ'}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-300 mt-2 whitespace-pre-wrap">{e.description}</p>
        {e.status === 'REJECTED' && e.rejectReason && (
          <p className="text-[11px] text-red-400 mt-2">เหตุผล: {e.rejectReason}</p>
        )}
        {e.status === 'PENDING' && (
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() => decide(e, 'APPROVED')} disabled={busyId === e.id}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1"
            >
              {busyId === e.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} อนุมัติ
            </button>
            <button
              onClick={() => decide(e, 'REJECTED')} disabled={busyId === e.id}
              className="px-3 py-1.5 rounded-lg bg-red-600/15 hover:bg-red-600/25 border border-red-500/25 text-red-400 text-xs font-bold flex items-center gap-1"
            >
              <XCircle className="w-3.5 h-3.5" /> ไม่อนุมัติ
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <FolderCheck className="w-5 h-5 text-indigo-400" />
        <h3 className="text-base font-bold text-white">แฟ้มสะสมผลงานนักเรียน — รออนุมัติ ({pending.length})</h3>
      </div>
      <p className="text-xs text-slate-400 -mt-3">ห้อง {homeroomClass} · นักเรียนบันทึกผลงานเข้ามาเอง ครูตรวจสอบก่อนเผยแพร่</p>

      {loading ? (
        <div className="py-8 text-center text-slate-500 text-sm flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> กำลังโหลด…
        </div>
      ) : pending.length === 0 ? (
        <div className="py-8 text-center text-slate-500 text-sm border border-dashed border-slate-800 rounded-xl">ไม่มีรายการรออนุมัติ</div>
      ) : (
        <div className="space-y-3">{pending.map(card)}</div>
      )}

      {reviewed.length > 0 && (
        <div className="space-y-3 pt-2">
          <h4 className="text-sm font-bold text-slate-400">ตรวจแล้ว ({reviewed.length})</h4>
          {reviewed.map(card)}
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
