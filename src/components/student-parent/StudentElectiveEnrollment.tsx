import React, { useEffect, useState } from 'react';
import { Users, CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react';
import { Student, ActivityEnrollment } from '../../types';
import { useElectiveSections } from '../../hooks/useElectiveSections';
import { enrollInActivity, withdrawFromActivity, subscribeActiveEnrollmentsByStudent } from '../../services/firestoreService';

const DAY_TH: Record<string, string> = {
  monday: 'จันทร์', tuesday: 'อังคาร', wednesday: 'พุธ', thursday: 'พฤหัสบดี', friday: 'ศุกร์', saturday: 'เสาร์', sunday: 'อาทิตย์',
};

/**
 * นักเรียนสมัคร/ถอนชุมนุม (ELECTIVE) — ที่นั่งจำกัด ตรวจนับจริงตอนเขียนผ่าน Firestore transaction
 * (enrollInActivity) กัน race condition 2 คนแย่งที่นั่งสุดท้ายพร้อมกัน
 *
 * นโยบาย (ค่าเริ่มต้น ยังไม่ยืนยันจากโรงเรียน — ผู้ใช้อนุญาตให้ตั้งค่าเริ่มต้นเองได้ถ้าไม่ชัด):
 * สมัครได้ทีละ 1 ชุมนุมเท่านั้น — ต้องถอนของเดิมก่อนสมัครใหม่ ตรวจสอบระดับแอป (ไม่ใช่ transaction
 * ระดับ Firestore เหมือน capacity — ความเสี่ยง race condition ของกฎนี้ต่ำกว่ามากและไม่ได้ถูกขอ
 * ให้ทดสอบ race condition แบบเจาะจงเหมือนเรื่องที่นั่ง)
 */
export function StudentElectiveEnrollment({ student }: { student: Student }) {
  const { sections, loading: sectionsLoading } = useElectiveSections();
  const [myEnrollments, setMyEnrollments] = useState<ActivityEnrollment[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    return subscribeActiveEnrollmentsByStudent(student.studentId, setMyEnrollments);
  }, [student.studentId]);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 4000); };

  const myCurrentEnrollment = myEnrollments[0] || null; // นโยบาย: มีได้สูงสุด 1 รายการที่ active

  const handleEnroll = async (scheduleId: string, subjectCode: string, capacityPerSection: number | null) => {
    if (myCurrentEnrollment && myCurrentEnrollment.scheduleId !== scheduleId) {
      flash('สมัครได้ทีละ 1 ชุมนุมเท่านั้น — กรุณาถอนชุมนุมเดิมก่อน');
      return;
    }
    setBusyId(scheduleId);
    try {
      await enrollInActivity({
        scheduleId,
        subjectCode,
        studentId: student.studentId,
        studentUid: student.studentUid || '',
        capacityPerSection,
      });
      flash('สมัครสำเร็จ!');
    } catch (e) {
      flash('สมัครไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusyId(null);
    }
  };

  const handleWithdraw = async (scheduleId: string) => {
    if (!window.confirm('ยืนยันถอนตัวจากชุมนุมนี้? ที่นั่งจะว่างให้คนอื่นสมัครทันที')) return;
    setBusyId(scheduleId);
    try {
      await withdrawFromActivity({ scheduleId, studentId: student.studentId, removedBy: null, removedReason: null });
      flash('ถอนตัวสำเร็จ — สมัครชุมนุมอื่นได้แล้ว');
    } catch (e) {
      flash('ถอนไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-[#161f30] border border-slate-800/80 rounded-xl p-5 space-y-1">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Users className="w-4 h-4 text-teal-400" /> สมัครชุมนุม (Elective Activities)
        </h3>
        <p className="text-xs text-slate-400">สมัครได้ทีละ 1 ชุมนุมเท่านั้น — ถอนตัวเองได้ทุกเมื่อถ้าเปลี่ยนใจ</p>
      </div>

      {toast && (
        <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-3 text-xs text-indigo-300">{toast}</div>
      )}

      {sectionsLoading ? (
        <div className="py-10 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> กำลังโหลดรายการชุมนุม...
        </div>
      ) : sections.length === 0 ? (
        <div className="py-10 text-center text-slate-500 text-xs">ยังไม่มีชุมนุมเปิดรับสมัครในขณะนี้</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sections.map(sec => {
            const isMine = myCurrentEnrollment?.scheduleId === sec.scheduleId;
            const isFull = sec.seatsRemaining !== null && sec.seatsRemaining <= 0 && !isMine;
            const blockedByOther = !!myCurrentEnrollment && !isMine;
            return (
              <div
                key={sec.scheduleId}
                className={`border rounded-xl p-4 space-y-2 ${isMine ? 'bg-emerald-950/30 border-emerald-700/50' : 'bg-[#0b0f19] border-slate-800/80'}`}
              >
                <div className="flex justify-between items-start gap-2">
                  <h4 className="text-sm font-bold text-white">{sec.name}</h4>
                  {isMine && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                </div>
                <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3 h-3" /> {DAY_TH[sec.dayOfWeek] || sec.dayOfWeek} คาบ {sec.periodNumber} · {sec.teacherName}
                  {sec.room && ` · ห้อง ${sec.room}`}
                </p>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${isFull ? 'text-red-400' : 'text-emerald-400'}`}>
                    {sec.capacityPerSection === null
                      ? 'ไม่จำกัดที่นั่ง'
                      : `เหลือ ${sec.seatsRemaining}/${sec.capacityPerSection} ที่นั่ง`}
                  </span>
                  {isMine ? (
                    <button
                      onClick={() => handleWithdraw(sec.scheduleId)}
                      disabled={busyId === sec.scheduleId}
                      className="px-3 py-1.5 text-xs font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg flex items-center gap-1"
                    >
                      {busyId === sec.scheduleId ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />} ถอนตัว
                    </button>
                  ) : (
                    <button
                      onClick={() => handleEnroll(sec.scheduleId, sec.subjectCode, sec.capacityPerSection)}
                      disabled={busyId === sec.scheduleId || isFull || blockedByOther}
                      title={blockedByOther ? 'ถอนชุมนุมเดิมก่อนสมัครใหม่' : isFull ? 'ที่นั่งเต็มแล้ว' : ''}
                      className="px-3 py-1.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg flex items-center gap-1"
                    >
                      {busyId === sec.scheduleId ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                      {isFull ? 'เต็มแล้ว' : 'สมัคร'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
