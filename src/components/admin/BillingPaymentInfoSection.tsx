import React, { useEffect, useState } from 'react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { AlertCircle, CheckCircle2, Landmark, Loader2, Save } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useStore } from '../../store';
import { useBillingPaymentInfo } from '../../hooks/useBillingPaymentInfo';
import {
  BillingPaymentInfo, BillingPaymentInfoErrors, EMPTY_BILLING_PAYMENT_INFO, validateBillingPaymentInfo,
} from '../../lib/billingPaymentInfo';
import { PromptPayQr } from '../shared/PromptPayQr';

/**
 * ตั้งค่าบัญชี/พร้อมเพย์ที่โรงเรียนใช้รับโอนเงิน → Firestore school_settings/billing_payment
 * ผู้ปกครองเห็นข้อมูลนี้ในหน้า "แจ้งโอนเงิน" และสร้าง QR พร้อมเพย์ (พร้อมยอดของใบแจ้งหนี้) จากค่านี้
 * เขียนได้เฉพาะ SUPER_ADMIN (firestore.rules บังคับจริง — ปุ่มปิดไว้เป็น UX)
 */
export function BillingPaymentInfoSection() {
  const user = useStore(s => s.user);
  const canEdit = !!user?.profile?.roles?.includes('SUPER_ADMIN');
  const { info, loading } = useBillingPaymentInfo();

  const [form, setForm] = useState<BillingPaymentInfo>(EMPTY_BILLING_PAYMENT_INFO);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ kind: 'ok' | 'error'; message: string } | null>(null);

  useEffect(() => { if (!loading && !dirty) setForm(info); }, [loading, dirty, info]);

  const set = <K extends keyof BillingPaymentInfo>(key: K, value: BillingPaymentInfo[K]) => {
    setForm(f => ({ ...f, [key]: value })); setDirty(true); setResult(null);
  };

  const validation = validateBillingPaymentInfo(form);
  const errors: BillingPaymentInfoErrors = 'errors' in validation ? validation.errors : {};

  const handleSave = async () => {
    if (!('value' in validation) || !canEdit) return;
    setSaving(true); setResult(null);
    try {
      // แทนที่ทั้ง doc (ไม่ merge) ให้มีเฉพาะ field ที่ rules อนุญาต
      await setDoc(doc(db, 'school_settings', 'billing_payment'), {
        ...validation.value, updatedAt: serverTimestamp(), updatedBy: user?.uid ?? '',
      });
      setDirty(false);
      setResult({ kind: 'ok', message: 'บันทึกแล้ว — ผู้ปกครองจะเห็นข้อมูลนี้และ QR ในหน้าแจ้งโอนเงินทันที' });
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
  const labelClass = 'text-[10px] font-bold text-slate-400 uppercase tracking-wider';
  const fieldErr = (k: keyof BillingPaymentInfo) => errors[k] && <span role="alert" className="text-[11px] text-rose-400">{errors[k]}</span>;
  const previewOk = form.promptPayType !== 'NONE' && !errors.promptPayId;

  return (
    <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-5 space-y-4" data-testid="billing-payment-info">
      <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-white/5 pb-2.5">
        <Landmark className="w-4 h-4 text-emerald-400" />
        บัญชีรับโอนเงินของโรงเรียน (ค่าธรรมเนียม/ใบแจ้งหนี้)
      </h3>
      <p className="text-[11px] text-slate-400 leading-relaxed">
        ผู้ปกครองและนักเรียนจะเห็นข้อมูลนี้ในหน้าแจ้งโอนเงิน และระบบสร้าง QR พร้อมเพย์ (ใส่ยอดตามใบแจ้งหนี้) จากหมายเลขพร้อมเพย์ที่ตั้งไว้
        — QR สร้างได้เฉพาะเมื่อบัญชีนั้นผูกพร้อมเพย์ไว้ หากไม่ผูก ให้เลือก "ไม่ใช้พร้อมเพย์" แล้วระบบจะแสดงเลขบัญชีให้โอนเอง
        ข้อมูลนี้ผู้ใช้ที่ล็อกอินทุกคนอ่านได้ จึงไม่ควรใส่ข้อมูลส่วนตัวของบุคคล
      </p>

      {loading ? (
        <div className="py-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> กำลังโหลด...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block space-y-1">
              <span className={labelClass}>ชื่อบัญชี / ชื่อผู้รับเงิน</span>
              <input value={form.accountName} onChange={(e) => set('accountName', e.target.value)} disabled={!canEdit || saving}
                placeholder="เช่น โรงเรียนอุตรดิตถ์" aria-label="ชื่อบัญชี" className={inputClass} />
              {fieldErr('accountName')}
            </label>
            <label className="block space-y-1">
              <span className={labelClass}>ธนาคาร</span>
              <input value={form.bankName} onChange={(e) => set('bankName', e.target.value)} disabled={!canEdit || saving}
                placeholder="เช่น ธนาคารกรุงไทย สาขาอุตรดิตถ์" aria-label="ธนาคาร" className={inputClass} />
              {fieldErr('bankName')}
            </label>
            <label className="block space-y-1">
              <span className={labelClass}>เลขที่บัญชี</span>
              <input value={form.bankAccountNo} onChange={(e) => set('bankAccountNo', e.target.value)} disabled={!canEdit || saving}
                placeholder="000-0-00000-0" aria-label="เลขที่บัญชี" className={`${inputClass} font-mono`} />
              {fieldErr('bankAccountNo')}
            </label>
            <label className="block space-y-1">
              <span className={labelClass}>พร้อมเพย์ (สำหรับสร้าง QR)</span>
              <select value={form.promptPayType} onChange={(e) => set('promptPayType', e.target.value as BillingPaymentInfo['promptPayType'])}
                disabled={!canEdit || saving} aria-label="ประเภทพร้อมเพย์" className={inputClass}>
                <option value="NONE">ไม่ใช้พร้อมเพย์ (แสดงเลขบัญชีอย่างเดียว)</option>
                <option value="PHONE">เบอร์โทรศัพท์ที่ผูกพร้อมเพย์</option>
                <option value="NATIONAL_ID">เลขบัตรประชาชน / เลขผู้เสียภาษี (13 หลัก)</option>
                <option value="EWALLET">e-Wallet ID (15 หลัก)</option>
              </select>
            </label>
            {form.promptPayType !== 'NONE' && (
              <label className="block space-y-1 sm:col-span-2">
                <span className={labelClass}>หมายเลขพร้อมเพย์</span>
                <input value={form.promptPayId} onChange={(e) => set('promptPayId', e.target.value)} disabled={!canEdit || saving}
                  inputMode="numeric" aria-label="หมายเลขพร้อมเพย์" className={`${inputClass} font-mono`} />
                {fieldErr('promptPayId')}
              </label>
            )}
            <label className="block space-y-1 sm:col-span-2">
              <span className={labelClass}>หมายเหตุถึงผู้โอน (ไม่บังคับ)</span>
              <textarea value={form.note} onChange={(e) => set('note', e.target.value)} disabled={!canEdit || saving} rows={2}
                placeholder="เช่น โอนแล้วแนบสลิป และระบุเลขที่ใบแจ้งหนี้" aria-label="หมายเหตุ" className={`${inputClass} resize-none`} />
              {fieldErr('note')}
            </label>
          </div>

          {previewOk && (
            <div className="bg-slate-950/60 border border-white/5 rounded-xl p-3 text-center space-y-2">
              <p className="text-[11px] text-slate-400">ตัวอย่าง QR ที่ผู้ปกครองจะเห็น (ตัวอย่างยอด ฿1.00 — ทดสอบสแกนด้วยแอปธนาคาร แล้วตรวจชื่อผู้รับให้ตรงกับบัญชีโรงเรียนก่อนใช้งานจริง)</p>
              <PromptPayQr type={form.promptPayType as 'PHONE' | 'NATIONAL_ID' | 'EWALLET'} id={form.promptPayId} amount={1} size={180} />
            </div>
          )}

          {!canEdit && <p className="text-[11px] text-amber-300">เฉพาะผู้ดูแลระบบ (SUPER_ADMIN) เท่านั้นที่แก้ไขข้อมูลนี้ได้</p>}

          {result && (
            <div role={result.kind === 'error' ? 'alert' : 'status'}
              className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${result.kind === 'ok' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'}`}>
              {result.kind === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
              <span>{result.message}</span>
            </div>
          )}

          <div className="flex justify-end">
            <button type="button" onClick={handleSave} disabled={!canEdit || saving || 'errors' in validation || !dirty}
              className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              บันทึกข้อมูลรับโอนเงิน
            </button>
          </div>
        </>
      )}
    </div>
  );
}
