import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Download, Upload, Loader2, AlertTriangle, CheckCircle2, ShieldAlert, FileSpreadsheet } from 'lucide-react';
import { useStore } from '../../store';
import { auth } from '../../lib/firebase';
import { loadThaiAddressData, type ProvinceRef } from '../../lib/thaiAddress';
import { loadSchoolBase, loadVillageBase } from '../../hooks/useReferenceData';
import { fetchAllReferenceOverrides, commitReferenceChanges } from '../../services/firestoreService';
import type { SchoolOverrideDoc, VillageOverrideDoc } from '../../types/reference';
import type { SchoolBase } from '../../lib/referenceData';
import {
  SCHOOL_HEADERS, VILLAGE_HEADERS, toCsv, exportSchoolsOfProvince, exportAllVillages,
  planSchoolImport, planVillageImport, planToWrites, summarize, type ImportRowResult,
} from '../../lib/referenceImport';

export type ReferenceImportKind = 'schools' | 'villages';
const META = {
  schools: { collection: 'reference_schools' as const, title: 'รายชื่อโรงเรียน', headers: SCHOOL_HEADERS, file: 'รายชื่อโรงเรียน' },
  villages: { collection: 'reference_villages' as const, title: 'รายชื่อหมู่บ้าน', headers: VILLAGE_HEADERS, file: 'รายชื่อหมู่บ้าน' },
};

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** การ์ดนำเข้า/ส่งออกรายชื่อโรงเรียนและหมู่บ้าน — อยู่ในเมนู "นำเข้าข้อมูล" ของแอดมินที่เดียว (นำเข้า: เฉพาะ SUPER_ADMIN) */
export function ReferenceDataImportExport({ kind }: { kind: ReferenceImportKind }) {
  const meta = META[kind];
  const user = useStore(s => s.user);
  const isSuperAdmin = !!user && (user.activeRole === 'SUPER_ADMIN' || !!user.profile?.roles?.includes('SUPER_ADMIN') || user.role === 'admin');
  const fileRef = useRef<HTMLInputElement>(null);
  const [provinces, setProvinces] = useState<ProvinceRef[] | null>(null);
  const [provinceCode, setProvinceCode] = useState('');
  const [busy, setBusy] = useState<null | 'export' | 'parse' | 'write'>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [plan, setPlan] = useState<ImportRowResult<SchoolOverrideDoc | VillageOverrideDoc>[] | null>(null);

  React.useEffect(() => {
    let c = false;
    loadThaiAddressData().then(d => { if (!c) setProvinces(d.areas); }).catch(() => { if (!c) setError('โหลดรายชื่อจังหวัดไม่สำเร็จ'); });
    return () => { c = true; };
  }, []);

  const handleExport = async (format: 'csv' | 'xlsx') => {
    if (!provinces) return;
    setBusy('export'); setError(null); setNotice(null);
    try {
      let rows: string[][];
      let name = meta.file;
      if (kind === 'schools') {
        const overrides = await fetchAllReferenceOverrides<SchoolOverrideDoc>('reference_schools');
        const targets = provinceCode ? provinces.filter(p => p[0] === provinceCode) : provinces;
        rows = [];
        for (const p of targets) rows.push(...exportSchoolsOfProvince(await loadSchoolBase(p[0]), overrides, p[0], p[1]));
        if (provinceCode && targets[0]) name += `-${targets[0][1]}`;
      } else {
        const overrides = await fetchAllReferenceOverrides<VillageOverrideDoc>('reference_villages');
        rows = exportAllVillages(provinces, await loadVillageBase(), overrides);
      }
      const stamp = new Date().toISOString().slice(0, 10);
      if (format === 'csv') {
        download(new Blob([toCsv(meta.headers, rows)], { type: 'text/csv;charset=utf-8;' }), `${name}-${stamp}.csv`);
      } else {
        const ws = XLSX.utils.aoa_to_sheet([[...meta.headers], ...rows]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, meta.title);
        const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
        download(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${name}-${stamp}.xlsx`);
      }
      setNotice(`ส่งออก ${rows.length.toLocaleString('th-TH')} รายการแล้ว`);
    } catch (e) {
      setError('ส่งออกไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)));
    } finally { setBusy(null); }
  };

  const handleTemplate = () => download(new Blob([toCsv(meta.headers, [])], { type: 'text/csv;charset=utf-8;' }), `template-${meta.file}.csv`);

  const handleFile = async (file: File) => {
    setError(null); setNotice(null); setPlan(null); setFileName(file.name);
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'csv' && ext !== 'xlsx' && ext !== 'xls') { setError('กรุณาเลือกไฟล์ .csv, .xlsx หรือ .xls'); return; }
    if (!provinces) { setError('ยังโหลดรายชื่อจังหวัดไม่เสร็จ — ลองอีกครั้ง'); return; }
    const by = auth.currentUser?.uid;
    if (!by) { setError('ไม่พบบัญชีผู้ใช้ที่ล็อกอิน กรุณาเข้าสู่ระบบใหม่'); return; }
    setBusy('parse');
    try {
      const buf = await file.arrayBuffer();
      const wb = ext === 'csv' ? XLSX.read(new TextDecoder('utf-8').decode(buf), { type: 'string' }) : XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
      if (rows.length === 0) { setError('ไฟล์ไม่มีข้อมูล'); return; }
      const headerKeys = new Set(Object.keys(rows[0]).map(k => k.trim()));
      const missing = meta.headers.filter(h => ['ชื่อโรงเรียน', 'รหัสตำบล', 'ชื่อหมู่บ้าน/ชุมชน'].includes(h) && !headerKeys.has(h));
      if (missing.length) { setError(`ไม่พบคอลัมน์ที่จำเป็น: ${missing.join(', ')} — ดาวน์โหลดเทมเพลตหรือไฟล์ส่งออกเพื่อดูรูปแบบ`); return; }
      const now = new Date().toISOString();
      if (kind === 'schools') {
        const overrides = await fetchAllReferenceOverrides<SchoolOverrideDoc>('reference_schools');
        const codes = Array.from(new Set(rows.map(r => String(r['รหัสจังหวัด'] ?? '').replace(/\D/g, '').padStart(2, '0')).filter(c => c !== '00')));
        const baseByProvince: Record<string, SchoolBase[]> = {};
        for (const c of codes) baseByProvince[c] = await loadSchoolBase(c);
        setPlan(planSchoolImport(rows, { provinces, baseByProvince, overrides }, by, now));
      } else {
        const overrides = await fetchAllReferenceOverrides<VillageOverrideDoc>('reference_villages');
        setPlan(planVillageImport(rows, { areas: provinces, baseMap: await loadVillageBase(), overrides }, by, now));
      }
    } catch (e) {
      setError('อ่านไฟล์ไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)));
    } finally { setBusy(null); }
  };

  const summary = plan ? summarize(plan) : null;
  const canConfirm = !!plan && !!summary && summary.ERROR === 0 && (summary.NEW + summary.UPDATE + summary.RESTORE) > 0 && isSuperAdmin && busy === null;

  const handleConfirm = async () => {
    if (!plan || !canConfirm) return;
    const { writes, deleteIds } = planToWrites(plan as ImportRowResult<{ id: string }>[]);
    setBusy('write'); setError(null);
    try {
      await commitReferenceChanges(meta.collection, writes, deleteIds);
      setNotice(`นำเข้าสำเร็จ: เพิ่ม ${summary!.NEW} · แก้ไข ${summary!.UPDATE} · คืนค่าเดิม ${summary!.RESTORE} (ไม่เปลี่ยน ${summary!.UNCHANGED})`);
      setPlan(null); setFileName('');
      if (fileRef.current) fileRef.current.value = '';
    } catch (e) {
      setError('นำเข้าไม่สำเร็จ ไม่มีการเปลี่ยนแปลงที่ยืนยันแล้ว: ' + (e instanceof Error ? e.message : String(e)));
    } finally { setBusy(null); }
  };

  const shownRows = plan ? plan.filter(r => r.action !== 'UNCHANGED').slice(0, 60) : [];
  const badgeCls: Record<string, string> = {
    NEW: 'bg-emerald-500/20 text-emerald-300', UPDATE: 'bg-amber-500/20 text-amber-300', RESTORE: 'bg-sky-500/20 text-sky-300', ERROR: 'bg-rose-500/20 text-rose-300',
  };
  const badgeTh: Record<string, string> = { NEW: 'เพิ่มใหม่', UPDATE: 'แก้ไข', RESTORE: 'คืนค่าเดิม', ERROR: 'ผิดพลาด' };

  return (
    <div className="space-y-5" data-testid={`reference-import-${kind}`}>
      <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-4 text-xs text-indigo-100 space-y-1">
        <p>ไฟล์ที่ส่งออกนำกลับมานำเข้าได้ทันที (แก้ในไฟล์ → นำเข้า) และเปิดด้วยแอปอื่นได้ (CSV UTF-8 / Excel)</p>
        <p className="text-indigo-200/80">
          {kind === 'schools'
            ? 'แถวที่มี "รหัส สพฐ." = แก้/ซ่อนโรงเรียนชุดหลัก · เว้นรหัสว่าง = โรงเรียนที่เพิ่มเอง (จับคู่ด้วยจังหวัด + ชื่อ) · สถานะ "ซ่อน" = ไม่แสดงให้นักเรียนเลือก'
            : 'แถวที่มี "รหัสหมู่บ้าน" = แก้/ซ่อนหมู่บ้านชุดหลัก · เว้นรหัสว่าง = หมู่บ้านที่เพิ่มเอง (จับคู่ด้วยตำบล + หมู่ + ชื่อ) · ชุมชนที่ไม่มีหมู่เว้นช่อง "หมู่ที่" ว่าง'}
        </p>
        <p className="text-indigo-200/80">นำเข้าเขียนเฉพาะส่วนที่ต่างจากชุดหลักในแอป ไม่ลบหรือแก้ข้อมูลชุดหลัก — ใช้หน้า "จัดการ" ในเมนูแอดมินเพื่อแก้ทีละรายการ</p>
      </div>

      {error && <div role="alert" className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-xs text-rose-200 flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{error}</div>}
      {notice && <div role="status" className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-xs text-emerald-200 flex gap-2"><CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />{notice}</div>}

      {/* ส่งออก */}
      <section className="space-y-2">
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">ส่งออก{meta.title}</h4>
        <div className="flex flex-wrap items-end gap-3">
          {kind === 'schools' && (
            <label className="text-xs text-slate-300 space-y-1">
              <span className="block">จังหวัด</span>
              <select value={provinceCode} onChange={e => setProvinceCode(e.target.value)} className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white min-w-[200px]">
                <option value="">ทุกจังหวัด (ไฟล์ใหญ่ ~30,000 แถว)</option>
                {provinces?.map(p => <option key={p[0]} value={p[0]}>{p[1]}</option>)}
              </select>
            </label>
          )}
          <button type="button" disabled={!provinces || busy !== null} onClick={() => handleExport('xlsx')} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold flex items-center gap-2 disabled:opacity-50">
            {busy === 'export' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />} ส่งออก Excel (.xlsx)
          </button>
          <button type="button" disabled={!provinces || busy !== null} onClick={() => handleExport('csv')} className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-bold flex items-center gap-2 disabled:opacity-50">
            <Download className="w-4 h-4" /> ส่งออก CSV
          </button>
        </div>
      </section>

      {/* นำเข้า */}
      <section className="space-y-3">
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">นำเข้า{meta.title}</h4>
        {!isSuperAdmin && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-200 flex gap-2"><ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />การนำเข้าต้องเป็น Super Admin (ส่งออกได้ทุกคนที่เข้าหน้านี้)</div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={handleTemplate} className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-2"><Download className="w-4 h-4" /> ดาวน์โหลดเทมเพลต (.csv)</button>
          <label className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 cursor-pointer ${isSuperAdmin && busy === null ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}>
            {busy === 'parse' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} เลือกไฟล์ (.csv / .xlsx)
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" disabled={!isSuperAdmin || busy !== null}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </label>
          {fileName && <span className="text-xs text-slate-400">{fileName}</span>}
        </div>

        {plan && summary && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="px-2 py-1 rounded bg-emerald-500/15 text-emerald-300">เพิ่มใหม่ {summary.NEW}</span>
              <span className="px-2 py-1 rounded bg-amber-500/15 text-amber-300">แก้ไข {summary.UPDATE}</span>
              <span className="px-2 py-1 rounded bg-sky-500/15 text-sky-300">คืนค่าเดิม {summary.RESTORE}</span>
              <span className="px-2 py-1 rounded bg-slate-500/20 text-slate-300">ไม่เปลี่ยน {summary.UNCHANGED}</span>
              <span className={`px-2 py-1 rounded ${summary.ERROR ? 'bg-rose-500/20 text-rose-300' : 'bg-slate-500/20 text-slate-300'}`}>ผิดพลาด {summary.ERROR}</span>
            </div>
            {summary.ERROR > 0 && <p className="text-xs text-rose-300">แก้แถวที่ผิดพลาดในไฟล์แล้วเลือกไฟล์ใหม่ — ระบบไม่นำเข้าบางส่วนเพื่อไม่ให้ข้อมูลค้างครึ่งๆ กลางๆ</p>}
            {shownRows.length > 0 && (
              <div className="max-h-72 overflow-auto border border-white/10 rounded-xl">
                <table className="w-full text-xs text-left text-slate-300">
                  <thead className="bg-black/40 sticky top-0"><tr><th className="px-3 py-2">แถว</th><th className="px-3 py-2">การดำเนินการ</th><th className="px-3 py-2">รายการ</th><th className="px-3 py-2">หมายเหตุ</th></tr></thead>
                  <tbody className="divide-y divide-white/5">
                    {shownRows.map(r => (
                      <tr key={r.rowNo}>
                        <td className="px-3 py-1.5 font-mono">{r.rowNo}</td>
                        <td className="px-3 py-1.5"><span className={`px-1.5 py-0.5 rounded font-semibold ${badgeCls[r.action]}`}>{badgeTh[r.action]}</span></td>
                        <td className="px-3 py-1.5 text-white">{r.label}</td>
                        <td className="px-3 py-1.5 text-rose-300">{r.errors.join(' · ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {plan.filter(r => r.action !== 'UNCHANGED').length > 60 && <p className="text-[11px] text-slate-500">แสดง 60 แถวแรกที่มีการเปลี่ยนแปลง</p>}
            <button type="button" disabled={!canConfirm} onClick={handleConfirm} className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold disabled:opacity-40 flex items-center gap-2">
              {busy === 'write' && <Loader2 className="w-4 h-4 animate-spin" />} ยืนยันนำเข้า ({summary.NEW + summary.UPDATE + summary.RESTORE} รายการ)
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
