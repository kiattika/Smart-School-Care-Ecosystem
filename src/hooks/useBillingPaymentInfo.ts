import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { BillingPaymentInfo, EMPTY_BILLING_PAYMENT_INFO, sanitizeBillingPaymentInfo } from '../lib/billingPaymentInfo';

/** ข้อมูลรับโอนเงินของโรงเรียนแบบ real-time (school_settings/billing_payment) — ไม่มี doc/อ่านไม่ได้ = ว่าง (exists=false) */
export function useBillingPaymentInfo(): { info: BillingPaymentInfo; loading: boolean; exists: boolean } {
  const [state, setState] = useState<{ info: BillingPaymentInfo; loading: boolean; exists: boolean }>({
    info: EMPTY_BILLING_PAYMENT_INFO, loading: true, exists: false,
  });
  useEffect(() => {
    return onSnapshot(
      doc(db, 'school_settings', 'billing_payment'),
      (snap) => setState({
        info: snap.exists() ? sanitizeBillingPaymentInfo(snap.data()) : EMPTY_BILLING_PAYMENT_INFO,
        loading: false, exists: snap.exists(),
      }),
      (err) => {
        console.warn('[useBillingPaymentInfo] listener notice:', err.message);
        setState({ info: EMPTY_BILLING_PAYMENT_INFO, loading: false, exists: false });
      },
    );
  }, []);
  return state;
}
