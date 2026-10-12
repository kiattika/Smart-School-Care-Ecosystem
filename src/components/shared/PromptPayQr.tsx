import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { buildPromptPayPayload, PromptPayType } from '../../lib/promptPay';

/** QR พร้อมเพย์จริง สร้างในเบราว์เซอร์ (ไม่ส่งข้อมูลไปบริการภายนอก) — amount ไม่ใส่ = ผู้โอนกรอกยอดเอง */
export function PromptPayQr({ type, id, amount, size = 220 }: { type: PromptPayType; id: string; amount?: number | null; size?: number }) {
  const [dataUrl, setDataUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setError('');
    try {
      const payload = buildPromptPayPayload({ type, id }, amount ?? undefined);
      QRCode.toDataURL(payload, { errorCorrectionLevel: 'M', margin: 1, width: size })
        .then((url) => { if (!cancelled) setDataUrl(url); })
        .catch(() => { if (!cancelled) setError('สร้าง QR ไม่สำเร็จ'); });
    } catch (e) {
      setDataUrl('');
      setError(e instanceof Error ? e.message : 'สร้าง QR ไม่สำเร็จ');
    }
    return () => { cancelled = true; };
  }, [type, id, amount, size]);

  if (error) return <div role="alert" className="text-[11px] text-rose-400 text-center">{error}</div>;
  if (!dataUrl) return <div className="text-[11px] text-slate-400 text-center">กำลังสร้าง QR...</div>;
  return <img src={dataUrl} alt="QR พร้อมเพย์สำหรับโอนเงิน" width={size} height={size} className="mx-auto bg-white rounded-xl" />;
}
