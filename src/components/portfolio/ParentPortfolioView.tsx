import React, { useEffect, useMemo, useState } from 'react';
import { Award, GraduationCap, Briefcase, HandHeart, Loader2, FolderHeart, Paperclip } from 'lucide-react';
import { StudentPortfolioEntry, StudentPortfolioEntryType } from '../../types';
import { subscribeStudentPortfolioEntries } from '../../services/firestoreService';

/**
 * แฟ้มสะสมผลงานของบุตรหลาน (read-only) สำหรับหน้าผู้ปกครอง
 * แสดงเฉพาะรายการที่ครูที่ปรึกษาอนุมัติแล้ว (firestore.rules บังคับ + query filter status=APPROVED)
 */

const TYPE_META: Record<StudentPortfolioEntryType, { label: string; icon: React.ReactNode; color: string }> = {
  AWARD: { label: 'รางวัล / การแข่งขัน', icon: <Award className="w-4 h-4" />, color: 'text-amber-400' },
  TRAINING: { label: 'การอบรม', icon: <GraduationCap className="w-4 h-4" />, color: 'text-blue-400' },
  INTERNSHIP: { label: 'การฝึกงาน', icon: <Briefcase className="w-4 h-4" />, color: 'text-purple-400' },
  VOLUNTEER: { label: 'จิตอาสา / บำเพ็ญประโยชน์', icon: <HandHeart className="w-4 h-4" />, color: 'text-emerald-400' },
};

export function ParentPortfolioView({ parentUid, studentId }: { parentUid?: string; studentId?: string }) {
  const [entries, setEntries] = useState<StudentPortfolioEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!parentUid) { setLoading(false); return; }
    setLoading(true);
    const unsub = subscribeStudentPortfolioEntries((list) => {
      setEntries(list);
      setLoading(false);
    }, { parentUid, approvedOnly: true });
    return unsub;
  }, [parentUid]);

  // ถ้าผู้ปกครองมีบุตรหลานหลายคน filter เฉพาะที่กำลังดู
  const visible = useMemo(
    () => (studentId ? entries.filter(e => e.studentId === studentId) : entries),
    [entries, studentId]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <FolderHeart className="w-5 h-5 text-rose-400" />
        <h3 className="text-base font-bold text-white">แฟ้มสะสมผลงาน (อนุมัติแล้ว)</h3>
      </div>

      {loading ? (
        <div className="py-8 text-center text-slate-500 text-sm flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> กำลังโหลด…
        </div>
      ) : visible.length === 0 ? (
        <div className="py-8 text-center text-slate-500 text-sm border border-dashed border-slate-800 rounded-xl">
          ยังไม่มีผลงานที่ครูที่ปรึกษาอนุมัติ
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {visible.map(e => {
            const tm = TYPE_META[e.type];
            return (
              <div key={e.id} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
                <div className="flex items-start gap-2.5">
                  <span className={`mt-0.5 ${tm.color}`}>{tm.icon}</span>
                  <div>
                    <div className="text-sm font-bold text-white">{e.title}</div>
                    <div className="text-[11px] text-slate-400">{tm.label} · {e.entryDate}</div>
                  </div>
                </div>
                <p className="text-xs text-slate-300 mt-2 whitespace-pre-wrap">{e.description}</p>
                {e.attachmentUrl && (
                  <a href={e.attachmentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-2 text-[11px] text-blue-400">
                    <Paperclip className="w-3 h-3" />
                    <img src={e.attachmentUrl} alt="แนบ" className="w-16 h-16 object-cover rounded border border-slate-700" />
                  </a>
                )}
                {e.reviewedByName && (
                  <p className="text-[10px] text-slate-500 mt-2">รับรองโดย {e.reviewedByName}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
