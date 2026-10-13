import React, { useEffect, useState } from 'react';
import { Loader2, Phone, User } from 'lucide-react';
import { subscribeEmergencyContacts, type StudentEmergencyContactsDoc } from '../../services/firestoreService';
import { phoneDigits } from '../../lib/emergencyContacts';

/** พยาบาลดูผู้ติดต่อฉุกเฉิน — ดึงจากแบบเยี่ยมบ้านที่ผู้ปกครองกรอก (บิดา/มารดา/ผู้ปกครอง); ไม่มีข้อมูล = ผู้ปกครองยังไม่ได้กรอก ไม่แสดงเบอร์สมมติ */
export function InfirmaryEmergencyContactsPanel({ studentId }: { studentId: string }) {
  const [doc, setDoc] = useState<StudentEmergencyContactsDoc | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setDoc(undefined); setError(null);
    if (!studentId) return;
    return subscribeEmergencyContacts(studentId, setDoc, (e) => { setError(e.message); setDoc(null); });
  }, [studentId]);

  if (!studentId) return null;
  return (
    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2" data-testid="infirmary-emergency-contacts">
      <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
        <User className="w-4 h-4" /> ผู้ติดต่อฉุกเฉิน (จากแบบเยี่ยมบ้านที่ผู้ปกครองกรอก)
      </span>
      {error && <p className="text-[11px] text-rose-300">อ่านข้อมูลไม่ได้: {error}</p>}
      {doc === undefined && !error && <p className="text-xs text-slate-400 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> กำลังโหลด…</p>}
      {doc && doc.contacts.length === 0 && <p className="text-xs text-amber-300">ผู้ปกครองกรอกแบบเยี่ยมบ้านแล้ว แต่ยังไม่ได้ใส่เบอร์โทรที่ใช้ติดต่อได้</p>}
      {doc === null && !error && <p className="text-xs text-slate-500">ผู้ปกครองยังไม่ได้กรอกแบบเยี่ยมบ้าน — ยังไม่มีผู้ติดต่อฉุกเฉิน (ติดต่อครูที่ปรึกษา)</p>}
      {doc && doc.contacts.length > 0 && (
        <ul className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {doc.contacts.map(c => (
            <li key={c.source} className="p-3 bg-slate-900 rounded-lg border border-slate-800 text-xs">
              <p className="font-semibold text-white">{c.name || '(ไม่ระบุชื่อ)'} <span className="text-slate-400 font-normal">({c.relation})</span></p>
              <a href={`tel:${phoneDigits(c.phone)}`} className="text-indigo-400 font-mono mt-1 inline-flex items-center gap-1"><Phone className="w-3 h-3" /> {c.phone}</a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
