import React, { useEffect, useState } from 'react';
import { ShieldCheck, PlusCircle, MinusCircle, Award } from 'lucide-react';
import { useStore } from '../../store';
import { Student } from '../../types';
import { subscribeDisciplineLogs, DisciplineLogRecord } from '../../services/firestoreService';

/**
 * คะแนนความประพฤติ + ประวัติเพิ่ม/ตัดคะแนน — ข้อมูลจริงทั้งหมด:
 *  - คะแนนสะสมจาก students/{id}.behaviorScore (ผู้เรียกส่ง student ที่มาจาก Firestore สดมาให้)
 *  - ประวัติจาก discipline_logs ของตัวเอง/บุตรหลาน (query ด้วย studentUid/parentUid ให้ผ่าน rules)
 * ไม่มีใบรับรองความประพฤติ/ฟอร์มตัดคะแนนในหน้านี้ — ครูบันทึกคะแนนจากหน้าของครู
 */
export function BehaviorDisciplineModule({ student, isParentView = false }: { student: Student; isParentView?: boolean }) {
  const user = useStore(s => s.user);
  const [allLogs, setAllLogs] = useState<DisciplineLogRecord[]>([]);

  useEffect(() => {
    if (!user?.uid) { setAllLogs([]); return; }
    return subscribeDisciplineLogs(setAllLogs, isParentView ? { parentUid: user.uid } : { studentUid: user.uid });
  }, [user?.uid, isParentView]);

  const logs = allLogs.filter(l => l.studentId === student.studentId);
  const added = logs.filter(l => l.points > 0).reduce((sum, l) => sum + l.points, 0);
  const deducted = logs.filter(l => l.points < 0).reduce((sum, l) => sum + Math.abs(l.points), 0);
  const currentScore = student.behaviorScore;

  return (
    <div className="space-y-6" data-testid="behavior-module">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/70 border border-emerald-500/30 rounded-3xl p-5 sm:p-6 backdrop-blur-md flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium">คะแนนความประพฤติปัจจุบัน</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-4xl font-black text-emerald-400">{currentScore ?? '—'}</span>
              {currentScore !== undefined && <span className="text-xs text-slate-400">/ 100 คะแนนเต็ม</span>}
            </div>
          </div>
          <div className="w-14 h-14 rounded-3xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <Award className="w-7 h-7" />
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-md flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium">คะแนนที่ได้เพิ่ม (จากรายการด้านล่าง)</span>
            <p className="text-3xl font-black text-emerald-400 mt-1">+{added}</p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <PlusCircle className="w-7 h-7" />
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-md flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium">คะแนนที่ถูกตัด (จากรายการด้านล่าง)</span>
            <p className="text-3xl font-black text-rose-400 mt-1">-{deducted}</p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
            <MinusCircle className="w-7 h-7" />
          </div>
        </div>
      </div>

      <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-md shadow-xl space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            ประวัติการเพิ่ม-ตัดคะแนนความประพฤติ
          </h3>
          <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 text-xs border border-slate-700">
            ทั้งหมด {logs.length} รายการ
          </span>
        </div>

        <div className="space-y-3">
          {logs.map(log => {
            const plus = log.points > 0;
            return (
              <div key={log.id} className="p-4 bg-slate-800/40 border border-slate-800 rounded-2xl flex items-start justify-between gap-3">
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                    plus ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/20 border-rose-500/30 text-rose-400'
                  }`}>
                    {plus ? <PlusCircle className="w-5 h-5" /> : <MinusCircle className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-white">วันที่ {log.date}</span>
                    <p className="text-xs text-slate-300 mt-1 break-words">{log.reason}</p>
                    {log.recordedBy && <span className="text-[10.5px] text-slate-400 mt-1 block">บันทึกโดย: {log.recordedBy}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className={`text-lg font-black ${plus ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {plus ? `+${log.points}` : log.points}
                  </span>
                  <span className="text-[10px] text-slate-400 block">คะแนน</span>
                </div>
              </div>
            );
          })}

          {logs.length === 0 && (
            <div className="py-10 text-center text-slate-500 text-xs">ยังไม่มีประวัติเพิ่ม-ตัดคะแนนความประพฤติ</div>
          )}
        </div>
      </div>
    </div>
  );
}
