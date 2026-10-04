import React, { useEffect, useState } from 'react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { AlertCircle, CheckCircle2, Loader2, Mail, Save } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useStore } from '../../store';
import { useStudentEmailFormat } from '../../hooks/useStudentEmailFormat';
import { StudentEmailFormatErrors, formatStudentEmail, validateStudentEmailFormat } from '../../lib/studentEmailFormat';

/**
 * ตั้งค่ารูปแบบอีเมลนักเรียน {prefix}{รหัสนักเรียน}@{domain} → Firestore school_settings/studentEmailFormat
 * (client สร้างอีเมลตอนเพิ่มนักเรียน + blocking function ใช้จับคู่ตอน login อ่านค่าเดียวกัน)
 * เขียนได้เฉพาะ SUPER_ADMIN (firestore.rules บังคับจริง — ปุ่มปิดไว้เป็น UX) มีผลทันทีกับนักเรียนที่เพิ่มใหม่
 * นักเรียนเดิมไม่ถูกแก้ย้อนหลัง
 */
export function StudentEmailFormatSection() {
  const user = useStore(s => s.user);
  const canEdit = !!user?.profile?.roles?.includes('SUPER_ADMIN');
  const { format, loading } = useStudentEmailFormat();

  const [prefix, setPrefix] = useState('');
  const [domain, setDomain] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ kind: 'ok' | 'error'; message: string } | null>(null);

  // ค่าจริงจาก Firestore มา (หรือเปลี่ยนจากที่อื่น) — เติมลงฟอร์มเมื่อผู้ใช้ยังไม่ได้แก้ค้างไว้
  useEffect(() => {
    if (!loading && !dirty) {
      setPrefix(format.prefix);
      setDomain(format.domain);
    }
  }, [loading, dirty, format.prefix, format.domain]);

  const validation = validateStudentEmailFormat({ prefix, domain });
  const errors: StudentEmailFormatErrors = 'errors' in validation ? validation.errors : {};
  const example = validation.ok ? formatStudentEmail('38501', validation.value) : null;
  const unchanged = validation.ok && validation.value.prefix === format.prefix && validation.value.domain === format.domain;

  const handleSave = async () => {
    if (!validation.ok || !canEdit) return;
    setSaving(true);
    setResult(null);
    try {
      // แทนที่ทั้ง doc (ไม่ merge) ให้มีเฉพาะ field ที่ rules อนุญาต
      await setDoc(doc(db, 'school_settings', 'studentEmailFormat'), {
        prefix: validation.value.prefix,
        domain: validation.value.domain,
        updatedAt: serverTimestamp(),
        updatedBy: user?.uid ?? '',
      });
      setDirty(false);
      setResult({ kind: 'ok', message: `บันทึกแล้ว — นักเรียนที่เพิ่มใหม่จะได้อีเมลรูปแบบ ${formatStudentEmail('{รหัส}', validation.value)}` });
    } catch (err) {
      const code = (err as { code?: string })?.code;
      setResult({
        kind: 'error',
        message: code === 'permission-denied'
          ? 'บันทึกไม่สำเร็จ: ไม่มีสิทธิ์ (เฉพาะผู้ดูแลระบบ SUPER_ADMIN เท่านั้น)'
          : `บันทึกไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500 disabled:opacity-60';

  return (
    <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-5 space-y-4" data-testid="student-email-format">
      <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-white/5 pb-2.5">
        <Mail className="w-4 h-4 text-indigo-400" />
        รูปแบบอีเมลนักเรียน (Student Email Format)
      </h3>
      <p className="text-[11px] text-slate-400 leading-relaxed">
        อีเมลนักเรียนจะเป็น <span className="font-mono text-slate-300">{'{คำนำหน้า}{รหัสนักเรียน}@{โดเมน}'}</span> — ใช้สร้างอีเมลตอนเพิ่มนักเรียน
        และจับคู่ตอนนักเรียนเข้าสู่ระบบ มีผลทันทีกับนักเรียนที่เพิ่มใหม่ (นักเรียนเดิมที่มีอีเมลอยู่แล้วไม่ถูกแก้ย้อนหลัง)
      </p>

      {loading ? (
        <div className="py-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> กำลังโหลด...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">คำนำหน้า (prefix)</span>
              <input
                value={prefix}
                onChange={(e) => { setPrefix(e.target.value); setDirty(true); setResult(null); }}
                disabled={!canEdit || saving}
                placeholder="it"
                aria-label="คำนำหน้าอีเมลนักเรียน"
                className={`${inputClass} font-mono`}
              />
              {errors.prefix && <span role="alert" className="text-[11px] text-rose-400">{errors.prefix}</span>}
            </label>
            <label className="block space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">โดเมน (domain)</span>
              <input
                value={domain}
                onChange={(e) => { setDomain(e.target.value); setDirty(true); setResult(null); }}
                disabled={!canEdit || saving}
                placeholder="utd.ac.th"
                aria-label="โดเมนอีเมลนักเรียน"
                className={`${inputClass} font-mono`}
              />
              {errors.domain && <span role="alert" className="text-[11px] text-rose-400">{errors.domain}</span>}
            </label>
          </div>

          <div className="text-xs bg-slate-950/60 border border-white/5 rounded-xl px-3 py-2.5 flex flex-wrap items-center gap-2">
            <span className="text-slate-400">ตัวอย่างนักเรียนรหัส 38501:</span>
            <span className="font-mono text-emerald-300" data-testid="student-email-example">{example ?? '— (กรอกให้ถูกต้องก่อน)'}</span>
          </div>

          {!canEdit && (
            <p className="text-[11px] text-amber-300">เฉพาะผู้ดูแลระบบ (SUPER_ADMIN) เท่านั้นที่แก้ไขรูปแบบนี้ได้</p>
          )}

          {result && (
            <div
              role={result.kind === 'error' ? 'alert' : 'status'}
              className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${result.kind === 'ok' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'}`}
            >
              {result.kind === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
              <span>{result.message}</span>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={!canEdit || saving || !validation.ok || unchanged}
              className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              บันทึกรูปแบบอีเมล
            </button>
          </div>
        </>
      )}
    </div>
  );
}
