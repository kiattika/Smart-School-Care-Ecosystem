import React, { useState } from 'react';
import { BadgeCheck, Loader2 } from 'lucide-react';
import { HealthProfileCards, HealthVerifyBadge, useStudentHealthProfile } from '../health/HealthProfileSection';
import { verifyStudentHealthProfile } from '../../services/firestoreService';
import { healthVerifyStatus } from '../../lib/healthProfile';

/** พยาบาลดูข้อมูลสุขภาพประจำตัวที่ครอบครัวกรอก และยืนยันความถูกต้อง (แก้เนื้อหาเองไม่ได้ — rules ให้แตะได้แค่ตรายืนยัน) */
export function InfirmaryHealthProfilePanel({ studentId, actor }: { studentId: string; actor: { uid: string; name: string } }) {
  const { profile, error } = useStudentHealthProfile(studentId || undefined);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!studentId) return <p className="text-xs text-slate-500">เลือกนักเรียนเพื่อดูข้อมูลสุขภาพประจำตัว</p>;

  const verify = async () => {
    setBusy(true); setErr(null);
    try { await verifyStudentHealthProfile(studentId, actor); }
    catch (e) { setErr('ยืนยันไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e))); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-3" data-testid="infirmary-health-profile">
      <div className="flex items-center gap-3 flex-wrap">
        <HealthVerifyBadge profile={profile} />
        {healthVerifyStatus(profile) === 'UNVERIFIED' && (
          <button onClick={verify} disabled={busy} className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg flex items-center gap-1.5">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BadgeCheck className="w-3.5 h-3.5" />} ยืนยันข้อมูลถูกต้อง
          </button>
        )}
      </div>
      {error && <p className="text-[11px] text-rose-300">อ่านข้อมูลไม่ได้: {error}</p>}
      {err && <p className="text-[11px] text-rose-300">{err}</p>}
      {profile === undefined ? <p className="text-xs text-slate-400 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> กำลังโหลด…</p> : <HealthProfileCards profile={profile} />}
      {profile === null && !error && <p className="text-[11px] text-slate-500">นักเรียนคนนี้ครอบครัวยังไม่ได้บันทึกข้อมูล — ไม่ได้แปลว่าไม่มีโรค/ไม่แพ้</p>}
    </div>
  );
}
