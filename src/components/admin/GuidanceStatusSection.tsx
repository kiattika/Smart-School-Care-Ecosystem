import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, HeartHandshake, Loader2, RefreshCw } from 'lucide-react';
import { useStore } from '../../store';
import { listenDoc } from '../../services/screeningService';
import { refreshGuidanceStatus } from '../../services/guidanceStatusService';

interface GuidanceStatusDoc { hasActiveCounselor?: boolean; count?: number; updatedAt?: { toDate?: () => Date } | null }

/**
 * สถานะ "มีครูแนะแนวที่ใช้งานอยู่" (school_settings/guidance_status — Cloud Functions คำนวณ, client เขียนไม่ได้)
 * ใช้ตัดสินสิทธิ์ครูที่ปรึกษาในการเห็น 9Q/8Q; แสดงค่าปัจจุบันสดเสมอ ปุ่มเรียก callable refreshGuidanceStatus (เฉพาะ SUPER_ADMIN)
 */
export function GuidanceStatusSection() {
  const user = useStore(s => s.user);
  const canRefresh = !!user?.profile?.roles?.includes('SUPER_ADMIN');

  const [status, setStatus] = useState<GuidanceStatusDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [readError, setReadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [result, setResult] = useState<{ kind: 'ok' | 'error'; message: string } | null>(null);

  useEffect(() => listenDoc<GuidanceStatusDoc>(
    'school_settings/guidance_status',
    (d) => { setStatus(d); setReadError(null); setLoading(false); },
    (err) => { setReadError(err.message); setLoading(false); },
  ), []);

  const handleRefresh = async () => {
    if (!canRefresh) return;
    setRefreshing(true);
    setResult(null);
    try {
      const r = await refreshGuidanceStatus();
      setResult({ kind: 'ok', message: `รีเฟรชแล้ว — ${r.hasActiveCounselor ? `มีครูแนะแนวที่ใช้งานอยู่ ${r.count} คน` : 'ไม่มีครูแนะแนวที่ใช้งานอยู่'}` });
    } catch (err) {
      const code = (err as { code?: string })?.code;
      setResult({
        kind: 'error',
        message: code === 'functions/permission-denied'
          ? 'รีเฟรชไม่สำเร็จ: ไม่มีสิทธิ์ (เฉพาะผู้ดูแลระบบ SUPER_ADMIN เท่านั้น)'
          : `รีเฟรชไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setRefreshing(false);
    }
  };

  const known = typeof status?.hasActiveCounselor === 'boolean';
  const updatedAt = status?.updatedAt?.toDate?.();

  return (
    <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-5 space-y-4" data-testid="guidance-status">
      <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-white/5 pb-2.5">
        <HeartHandshake className="w-4 h-4 text-indigo-400" />
        สถานะครูแนะแนว (Guidance Counselor Status)
      </h3>
      <p className="text-[11px] text-slate-400 leading-relaxed">
        ใช้ตรวจสอบว่าระบบรู้หรือไม่ว่ามีครูแนะแนวที่ใช้งานอยู่ — มีผลต่อสิทธิ์การมองเห็นผลคัดกรอง 9Q/8Q ของครูที่ปรึกษา
        (มีครูแนะแนว = ครูที่ปรึกษาเห็นเฉพาะระดับ; ไม่มี = ครูที่ปรึกษาทำแทนได้)
      </p>
      <p className="text-[11px] text-amber-300/90 leading-relaxed">
        กดปุ่มนี้ทุกครั้งหลังเพิ่ม/ปิดการใช้งานบุคลากรที่มีบทบาทครูแนะแนว
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <div className="text-xs text-slate-300" data-testid="guidance-status-current">
          {loading ? (
            <span className="inline-flex items-center gap-2 text-slate-500"><Loader2 className="w-3.5 h-3.5 animate-spin" /> กำลังโหลด...</span>
          ) : readError ? (
            <span className="text-rose-300">อ่านสถานะไม่ได้: {readError}</span>
          ) : known ? (
            <>
              <span className="font-bold">hasActiveCounselor: {String(status!.hasActiveCounselor)}</span>
              {typeof status!.count === 'number' && <span className="text-slate-400"> ({status!.count} คน)</span>}
              <span className="text-slate-500"> · รีเฟรชล่าสุด {updatedAt ? updatedAt.toLocaleString('th-TH') : 'ไม่ทราบเวลา'}</span>
            </>
          ) : (
            <span className="text-amber-300">ยังไม่เคยคำนวณ — ระบบถือว่า "มีครูแนะแนว" ไว้ก่อน (ครูที่ปรึกษาเห็นเฉพาะระดับ)</span>
          )}
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={!canRefresh || refreshing}
          title={canRefresh ? undefined : 'เฉพาะ SUPER_ADMIN'}
          className="ml-auto inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold text-white"
        >
          {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          รีเฟรชสถานะครูแนะแนว
        </button>
      </div>

      {result && (
        <div role="status" className={`flex items-start gap-2 text-xs ${result.kind === 'ok' ? 'text-emerald-300' : 'text-rose-300'}`}>
          {result.kind === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          {result.message}
        </div>
      )}
    </div>
  );
}
