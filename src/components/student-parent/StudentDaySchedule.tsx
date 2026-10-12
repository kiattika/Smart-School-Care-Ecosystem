import React, { useMemo } from 'react';
import { Clock } from 'lucide-react';
import { useStore } from '../../store';
import { useTeacherFirestoreSchedule } from '../../hooks/useTeacherFirestoreSchedule';
import { buildStudentDaySchedule } from '../../lib/studentDaySchedule';

const DAY_TH: Record<string, string> = {
  sunday: 'วันอาทิตย์', monday: 'วันจันทร์', tuesday: 'วันอังคาร', wednesday: 'วันพุธ',
  thursday: 'วันพฤหัสบดี', friday: 'วันศุกร์', saturday: 'วันเสาร์',
};

const STATUS_LABEL = { DONE: 'เรียนแล้ว', NOW: 'กำลังเรียน', UPCOMING: 'ยังไม่ถึงเวลา' } as const;
const STATUS_CLASS = {
  DONE: 'bg-slate-800 border-slate-700 text-slate-400',
  NOW: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
  UPCOMING: 'bg-slate-800 border-slate-700 text-slate-400',
} as const;

/** ตารางเรียนวันนี้ของห้องนักเรียน จาก schedules จริงของภาคเรียนปัจจุบัน (ไม่มีข้อมูล = empty state) */
export function StudentDaySchedule({ room }: { room?: string }) {
  const now = useStore(s => s.currentDate);
  const { schedules, periods, loading } = useTeacherFirestoreSchedule();

  const { dayKey, rows } = useMemo(
    () => buildStudentDaySchedule({ schedules: schedules as any[], periods, studentRoom: room, now }),
    [schedules, periods, room, now],
  );

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-md shadow-xl space-y-4" data-testid="student-day-schedule">
      <div>
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-400" />
          ตารางเรียนวันนี้
        </h3>
        <p className="text-[11px] text-slate-400">
          {DAY_TH[dayKey]} {now.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {loading ? (
        <p className="text-xs text-slate-500 text-center py-6">กำลังโหลดตารางเรียน…</p>
      ) : !room ? (
        <p className="text-xs text-slate-500 text-center py-6">ยังไม่มีข้อมูลห้องเรียนของนักเรียน จึงแสดงตารางเรียนไม่ได้</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-slate-500 text-center py-6">ไม่มีคาบเรียนของห้อง {room} ในวันนี้</p>
      ) : (
        <div className="space-y-3">
          {rows.map(item => (
            <div key={item.key} className="p-3.5 bg-slate-800/40 border border-slate-800 rounded-2xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-10 shrink-0 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-300">
                  <span className="text-[10px] font-bold">{item.periodLabel}</span>
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-white truncate">
                    {item.subject}{item.code ? ` (${item.code})` : ''}
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    {item.startTime && item.endTime ? `${item.startTime} - ${item.endTime}` : 'ไม่ระบุเวลา'}
                    {item.place ? ` • ${item.place}` : ''}
                  </span>
                </div>
              </div>
              <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-full border ${STATUS_CLASS[item.status]}`}>
                {STATUS_LABEL[item.status]}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
