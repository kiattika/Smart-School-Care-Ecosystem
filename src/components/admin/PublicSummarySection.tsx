import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, ExternalLink, Globe, Loader2, RefreshCw } from 'lucide-react';
import { useStore } from '../../store';
import { listenDoc } from '../../services/screeningService';
import { refreshPublicSummary } from '../../services/publicSummaryService';

interface PublicSummaryDoc { academicYear?: string; term?: string; updatedAt?: { toDate?: () => Date } | null }

/**
 * สรุปสารสนเทศหน้าสาธารณะ /info (public_summary/current — Cloud Functions คำนวณทุกวัน 03:00, client เขียนไม่ได้)
 * ปุ่มสั่งคำนวณใหม่ทันที (callable refreshPublicSummary เฉพาะ SUPER_ADMIN) — ใช้หลัง deploy หรือเมื่อต้องการตัวเลขล่าสุด
 */
export function PublicSummarySection() {
  const user = useStore(s => s.user);
  const canRefresh = !!user?.profile?.roles?.includes('SUPER_ADMIN');
  const [summary, setSummary] = useState<PublicSummaryDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [readError, setReadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [result, setResult] = useState<{ kind: 'ok' | 'error'; message: string } | null>(null);

  useEffect(() => listenDoc<PublicSummaryDoc>(
    'public_summary/current',
    (d) => { setSummary(d); setReadError(null); setLoading(false); },
    (err) => { setReadError(err.message); setLoading(false); },
  ), []);

  const handleRefresh = async () => {
    if (!canRefresh) return;
    setRefreshing(true);
    setResult(null);
    try {
      await refreshPublicSummary();
      setResult({ kind: 'ok', message: 'คำนวณใหม่เรียบร้อย — หน้า /info แสดงตัวเลขล่าสุดแล้ว' });
    } catch (err) {
      const code = (err as { code?: string })?.code;
      setResult({
        kind: 'error',
        message: code === 'functions/permission-denied'
          ? 'คำนวณไม่สำเร็จ: ไม่มีสิทธิ์ (เฉพาะผู้ดูแลระบบ SUPER_ADMIN เท่านั้น)'
          : `คำนวณไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setRefreshing(false);
    }
  };

  const updatedAt = summary?.updatedAt?.toDate?.();

  return (
    <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-5 space-y-4" data-testid="public-summary-section">
      <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-white/5 pb-2.5">
        <Globe className="w-4 h-4 text-indigo-400" />
        สารสนเทศโรงเรียนหน้าสาธารณะ (/info)
      </h3>
      <p className="text-[11px] text-slate-400 leading-relaxed">
        ระบบคำนวณตัวเลขรวมให้หน้า /info อัตโนมัติทุกวันเวลา 03:00 น. — กดปุ่มนี้เมื่อต้องการตัวเลขล่าสุดทันที (เช่น หลัง deploy หรือหลังนักเรียนทำแบบประเมินเพิ่ม)
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-xs text-slate-300" data-testid="public-summary-current">
          {loading ? (
            <span className="inline-flex items-center gap-2 text-slate-500"><Loader2 className="w-3.5 h-3.5 animate-spin" /> กำลังโหลด...</span>
          ) : readError ? (
            <span className="text-rose-300">อ่านข้อมูลไม่ได้: {readError}</span>
          ) : summary ? (
            <span>คำนวณล่าสุด {updatedAt ? updatedAt.toLocaleString('th-TH') : 'ไม่ทราบเวลา'}{summary.academicYear ? ` · ภาคเรียน ${summary.term}/${summary.academicYear}` : ''}</span>
          ) : (
            <span className="text-amber-300">ยังไม่เคยคำนวณ — หน้า /info ยังไม่มีข้อมูล</span>
          )}
        </div>
        <a href="/info" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-300 hover:underline">
          เปิดหน้า /info <ExternalLink className="w-3 h-3" />
        </a>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={!canRefresh || refreshing}
          title={canRefresh ? undefined : 'เฉพาะ SUPER_ADMIN'}
          className="ml-auto inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold text-white"
        >
          {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          คำนวณสรุปหน้า /info ใหม่
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
