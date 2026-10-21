import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, History, Link2Off, Loader2, ShieldCheck, Upload, UserPen } from 'lucide-react';
import { StudentPicker } from '../shared/StudentPicker';
import { useRealStudents } from '../../hooks/useRealStudents';
import { setStudentParent, unlinkParent } from '../../lib/lineParent';
import { PARENT_RELATIONSHIPS } from '../../lib/parentRelationship';
import {
  AUDIT_REASON_MAX, EMPTY_PARENT_FORM, LINK_STATUS_LABEL, ParentAuditEntry, ParentFormValues, ParentRecordBrief,
  auditActionLabel, formFromRecord, maskPhone, parentDisplayName, parentLinkStatus, setParentResultMessage, validateParentForm,
} from '../../lib/parentAdmin';
import { getParentRecordBrief, getStudentParentUid, subscribeParentAudit } from '../../services/parentAdminService';

/**
 * จัดการผู้ปกครองรายคน (SUPER_ADMIN) — ดูสถานะการเชื่อมบัญชี LINE, ยกเลิกการเชื่อม, ตั้ง/เปลี่ยนผู้ปกครอง + ประวัติการแก้ไข
 * ทุกการเปลี่ยนแปลงทำผ่าน Cloud Functions (unlinkParentLine / setStudentParent) ที่บันทึกประวัติใน batch เดียวกัน
 * ไม่แสดงเลขบัตรประชาชนเลย (ทะเบียนเก็บเฉพาะ HMAC) — การนำเข้าเป็นกลุ่มยังอยู่ที่เมนู "ระบบนำเข้าข้อมูลขนาดใหญ่" ที่เดียว
 */
const inputClass = 'w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500 disabled:opacity-60';
const fmtDateTime = (ms: number | null) => (ms ? new Date(ms).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '-');

const STATUS_TONE: Record<string, string> = {
  LINKED: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  NOT_LINKED: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  NO_RECORD: 'bg-slate-500/10 text-slate-300 border-slate-500/30',
  INCONSISTENT: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
};

export function ParentManagementPage({ onGoToImport }: { onGoToImport?: () => void }) {
  const { students } = useRealStudents();
  const [studentId, setStudentId] = useState('');
  const student = useMemo(() => students.find((s) => s.studentId === studentId) || null, [students, studentId]);

  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [record, setRecord] = useState<ParentRecordBrief | null>(null);
  const [studentParentUid, setStudentParentUid] = useState<string | null>(null);
  const [audit, setAudit] = useState<ParentAuditEntry[]>([]);
  const [auditError, setAuditError] = useState<string | null>(null);

  const [mode, setMode] = useState<'none' | 'unlink' | 'set'>('none');
  const [unlinkReason, setUnlinkReason] = useState('');
  const [form, setForm] = useState<ParentFormValues>({ ...EMPTY_PARENT_FORM });
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ kind: 'ok' | 'error'; message: string } | null>(null);

  const resetPanels = () => { setMode('none'); setUnlinkReason(''); setForm({ ...EMPTY_PARENT_FORM }); setShowErrors(false); };

  // เปลี่ยนนักเรียน: ล้างทุกอย่างของคนเดิม (รวมเลขบัตรที่พิมพ์ค้าง)
  useEffect(() => { resetPanels(); setResult(null); }, [studentId]);

  useEffect(() => {
    if (!studentId) { setRecord(null); setStudentParentUid(null); setLoadError(null); return; }
    let cancelled = false;
    setLoading(true); setLoadError(null);
    Promise.all([getParentRecordBrief(studentId), getStudentParentUid(studentId)])
      .then(([rec, uid]) => { if (!cancelled) { setRecord(rec); setStudentParentUid(uid); } })
      .catch((err: unknown) => { if (!cancelled) setLoadError(err instanceof Error ? err.message : String(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [studentId, reloadKey]);

  useEffect(() => {
    if (!studentId) { setAudit([]); setAuditError(null); return; }
    setAuditError(null);
    return subscribeParentAudit(studentId, setAudit, setAuditError);
  }, [studentId]);

  const status = studentId && !loading && !loadError ? parentLinkStatus(studentParentUid, record) : null;
  const canUnlink = status === 'LINKED' || status === 'INCONSISTENT';
  const errors = validateParentForm(form);
  const formValid = Object.keys(errors).length === 0;
  const unlinkReasonOk = unlinkReason.trim().length > 0 && unlinkReason.trim().length <= AUDIT_REASON_MAX;

  const run = async (task: () => Promise<string>) => {
    setBusy(true); setResult(null);
    try {
      const message = await task();
      setResult({ kind: 'ok', message });
      resetPanels();
      setReloadKey((k) => k + 1);
    } catch (err: unknown) {
      setResult({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  const submitUnlink = () => {
    if (!studentId || !unlinkReasonOk) return;
    void run(async () => ((await unlinkParent(studentId, unlinkReason.trim())) ? 'ยกเลิกการเชื่อมบัญชี LINE แล้ว — ผู้ปกครองต้องยืนยันตัวตนเพื่อเชื่อมใหม่' : 'ไม่พบการเชื่อมที่ต้องยกเลิก'));
  };

  const submitSet = () => {
    setShowErrors(true);
    if (!studentId || !formValid) return;
    const payload = { studentId, ...form };
    void run(async () => setParentResultMessage(await setStudentParent(payload)));
  };

  const setField = (k: keyof ParentFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value })); setResult(null);
  };
  const fieldError = (k: keyof ParentFormValues) => (showErrors && errors[k] ? <span role="alert" className="text-[11px] text-rose-400">{errors[k]}</span> : null);

  return (
    <div className="space-y-5" data-testid="parent-management">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-indigo-400" />จัดการผู้ปกครอง (การเชื่อมบัญชี LINE)</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            ค้นหานักเรียนเพื่อดูว่าผู้ปกครองเชื่อมบัญชีแล้วหรือยัง ยกเลิกการเชื่อม หรือตั้ง/เปลี่ยนผู้ปกครอง — ทุกการเปลี่ยนแปลงต้องระบุเหตุผลและถูกบันทึกประวัติ
            (ระบบไม่แสดงและไม่เก็บเลขบัตรประชาชนดิบ)
          </p>
        </div>
        {onGoToImport && (
          <button type="button" onClick={onGoToImport} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 text-xs font-bold text-slate-200 hover:bg-white/5 cursor-pointer">
            <Upload className="w-3.5 h-3.5" /> นำเข้าทะเบียนผู้ปกครองเป็นกลุ่ม
          </button>
        )}
      </div>

      <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-5 space-y-4">
        <div className="space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">นักเรียน</span>
          <StudentPicker mode="single" students={students} value={studentId} onSelect={setStudentId} placeholder="พิมพ์เลขประจำตัวหรือชื่อนักเรียน" />
        </div>

        {!studentId && <p className="text-xs text-slate-500">เลือกนักเรียนเพื่อดูสถานะผู้ปกครอง</p>}
        {studentId && loading && <div className="text-xs text-slate-500 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" />กำลังโหลด...</div>}
        {studentId && loadError && (
          <div role="alert" className="text-xs text-rose-300 flex items-start gap-2"><AlertCircle className="w-4 h-4 shrink-0" />โหลดข้อมูลไม่สำเร็จ: {loadError}</div>
        )}

        {status && (
          <div className="rounded-xl border border-white/5 bg-slate-950/50 p-4 space-y-3" data-testid="parent-status-card">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-white">{student ? `${student.name}${student.room ? ` · ${student.room}` : ''}` : studentId}</span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${STATUS_TONE[status]}`} data-testid="parent-link-status">{LINK_STATUS_LABEL[status]}</span>
            </div>
            {record ? (
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
                <div><dt className="text-slate-500">ผู้ปกครองตามทะเบียน</dt><dd className="text-slate-200">{parentDisplayName(record) || '-'}</dd></div>
                <div><dt className="text-slate-500">ความสัมพันธ์</dt><dd className="text-slate-200">{record.relationship || '-'}</dd></div>
                <div><dt className="text-slate-500">เบอร์โทร</dt><dd className="text-slate-200 font-mono">{maskPhone(record.parentMobile)}</dd></div>
                <div><dt className="text-slate-500">เชื่อมบัญชีเมื่อ</dt><dd className="text-slate-200">{status === 'LINKED' ? fmtDateTime(record.linkedAtMs) : '-'}</dd></div>
              </dl>
            ) : (
              <p className="text-xs text-slate-400">นักเรียนคนนี้ยังไม่มีทะเบียนผู้ปกครอง ผู้ปกครองจะเชื่อมบัญชีไม่ได้จนกว่าจะตั้งผู้ปกครองหรือนำเข้าทะเบียน</p>
            )}
            {status === 'INCONSISTENT' && (
              <p role="alert" className="text-xs text-rose-300">ข้อมูลฝั่งนักเรียนกับทะเบียนไม่ตรงกัน — กด "ยกเลิกการเชื่อมบัญชี LINE" เพื่อล้างทั้งสองฝั่ง แล้วให้ผู้ปกครองเชื่อมใหม่</p>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              {canUnlink && (
                <button type="button" disabled={busy} onClick={() => { setMode(mode === 'unlink' ? 'none' : 'unlink'); setResult(null); }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-rose-500/30 text-xs font-bold text-rose-300 hover:bg-rose-500/10 disabled:opacity-50 cursor-pointer">
                  <Link2Off className="w-3.5 h-3.5" /> ยกเลิกการเชื่อมบัญชี LINE
                </button>
              )}
              <button type="button" disabled={busy} onClick={() => { if (mode === 'set') { resetPanels(); } else { setForm(formFromRecord(record)); setShowErrors(false); setMode('set'); } setResult(null); }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-indigo-500/30 text-xs font-bold text-indigo-300 hover:bg-indigo-500/10 disabled:opacity-50 cursor-pointer">
                <UserPen className="w-3.5 h-3.5" /> {record ? 'เปลี่ยนผู้ปกครอง / แก้ข้อมูล' : 'ตั้งผู้ปกครอง'}
              </button>
            </div>

            {mode === 'unlink' && (
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3 space-y-2" data-testid="unlink-panel">
                <p className="text-xs text-slate-300">ผู้ปกครองจะเข้าดูข้อมูลบุตรหลานไม่ได้ทันที และต้องยืนยันตัวตนด้วยเลขบัตรเพื่อเชื่อมใหม่</p>
                <label className="block space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">เหตุผล (จำเป็น)</span>
                  <textarea value={unlinkReason} onChange={(e) => setUnlinkReason(e.target.value)} maxLength={AUDIT_REASON_MAX} rows={2} className={inputClass} aria-label="เหตุผลที่ยกเลิกการเชื่อม" />
                </label>
                <div className="flex gap-2">
                  <button type="button" disabled={busy || !unlinkReasonOk} onClick={submitUnlink}
                    className="px-3 py-2 rounded-lg bg-rose-600 text-white text-xs font-bold disabled:opacity-50 cursor-pointer flex items-center gap-2">
                    {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}ยืนยันยกเลิกการเชื่อม
                  </button>
                  <button type="button" disabled={busy} onClick={resetPanels} className="px-3 py-2 rounded-lg border border-white/10 text-xs text-slate-300 cursor-pointer">ปิด</button>
                </div>
              </div>
            )}

            {mode === 'set' && (
              <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-3 space-y-3" data-testid="set-parent-panel">
                <p className="text-xs text-slate-300 leading-relaxed">
                  กรอกข้อมูลผู้ปกครองตามเอกสารของโรงเรียน ต้องกรอกเลขบัตรทุกครั้ง (ระบบเก็บเฉพาะค่าเข้ารหัสที่ย้อนกลับไม่ได้) —
                  ถ้าเลขบัตรไม่ตรงกับผู้ปกครองเดิม ระบบจะยกเลิกการเชื่อมบัญชี LINE เดิมให้อัตโนมัติ
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="block space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">คำนำหน้า</span>
                    <input value={form.parentPrefix} onChange={setField('parentPrefix')} className={inputClass} aria-label="คำนำหน้าผู้ปกครอง" />
                    {fieldError('parentPrefix')}
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ชื่อ</span>
                    <input value={form.parentFirstName} onChange={setField('parentFirstName')} className={inputClass} aria-label="ชื่อผู้ปกครอง" />
                    {fieldError('parentFirstName')}
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">นามสกุล</span>
                    <input value={form.parentLastName} onChange={setField('parentLastName')} className={inputClass} aria-label="นามสกุลผู้ปกครอง" />
                    {fieldError('parentLastName')}
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ความสัมพันธ์กับนักเรียน</span>
                    <select value={form.relationship} onChange={setField('relationship')} className={inputClass} aria-label="ความสัมพันธ์">
                      <option value="">— เลือก —</option>
                      {PARENT_RELATIONSHIPS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    {fieldError('relationship')}
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">เบอร์โทรศัพท์</span>
                    <input value={form.parentMobile} onChange={setField('parentMobile')} inputMode="tel" autoComplete="off" className={`${inputClass} font-mono`} aria-label="เบอร์โทรศัพท์ผู้ปกครอง" />
                    {fieldError('parentMobile')}
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">เลขบัตรประชาชน 13 หลัก</span>
                    <input value={form.parentNationalId} onChange={setField('parentNationalId')} inputMode="numeric" autoComplete="off" maxLength={17} className={`${inputClass} font-mono`} aria-label="เลขบัตรประชาชนผู้ปกครอง" />
                    {fieldError('parentNationalId')}
                  </label>
                </div>
                <label className="block space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">เหตุผลในการเปลี่ยนแปลง (จำเป็น)</span>
                  <textarea value={form.reason} onChange={setField('reason')} maxLength={AUDIT_REASON_MAX} rows={2} className={inputClass} aria-label="เหตุผลในการเปลี่ยนแปลง" />
                  {fieldError('reason')}
                </label>
                <div className="flex gap-2">
                  <button type="button" disabled={busy} onClick={submitSet}
                    className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold disabled:opacity-50 cursor-pointer flex items-center gap-2">
                    {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}บันทึก
                  </button>
                  <button type="button" disabled={busy} onClick={resetPanels} className="px-3 py-2 rounded-lg border border-white/10 text-xs text-slate-300 cursor-pointer">ปิด</button>
                </div>
              </div>
            )}
          </div>
        )}

        {result && (
          <div role={result.kind === 'error' ? 'alert' : 'status'} className={`text-xs flex items-start gap-2 ${result.kind === 'ok' ? 'text-emerald-300' : 'text-rose-300'}`} data-testid="parent-result">
            {result.kind === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{result.message}</span>
          </div>
        )}
      </div>

      {studentId && (
        <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-5 space-y-3" data-testid="parent-audit">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-white/5 pb-2.5"><History className="w-4 h-4 text-indigo-400" />ประวัติการเปลี่ยนแปลงของนักเรียนคนนี้</h3>
          {auditError && <p role="alert" className="text-xs text-rose-300">โหลดประวัติไม่สำเร็จ: {auditError}</p>}
          {!auditError && audit.length === 0 && <p className="text-xs text-slate-500">ยังไม่มีประวัติการเปลี่ยนแปลง</p>}
          <ul className="space-y-2">
            {audit.map((a) => (
              <li key={a.id} className="text-xs border-b border-white/5 pb-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-slate-100">{auditActionLabel(a)}</span>
                  {a.relationship && <span className="text-slate-400">({a.relationship})</span>}
                  <span className="text-slate-500 ml-auto">{fmtDateTime(a.createdAtMs)}</span>
                </div>
                <div className="text-slate-400 mt-0.5">โดย {a.byEmail || '-'} · เหตุผล: {a.reason}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
