import React, { useState } from 'react';
import { CalendarOff, CalendarRange, Plus, Trash2, Loader2 } from 'lucide-react';
import { useSchoolCalendar } from '../../hooks/useSchoolCalendar';
import { saveSchoolCalendarEvent, deleteSchoolCalendarEvent } from '../../services/firestoreService';
import { useStore } from '../../store';

// แค่ "ชื่อ" ที่พบบ่อยไว้เป็น shortcut กรอกให้เร็วขึ้น — ไม่ผูกวันที่ตายตัว เพราะวันหยุดราชการ/วันหยุด
// ชดเชยเปลี่ยนแปลงได้ทุกปีตามประกาศรัฐบาล แอดมินต้องเลือกวันที่เองเสมอ
const COMMON_HOLIDAY_NAMES = [
  'วันขึ้นปีใหม่', 'วันสงกรานต์', 'วันแรงงาน', 'วันฉัตรมงคล', 'วันวิสาขบูชา',
  'วันเฉลิมพระชนมพรรษา', 'วันแม่แห่งชาติ', 'วันพ่อแห่งชาติ', 'วันรัฐธรรมนูญ',
  'วันหยุดชดเชย', 'วันหยุดกลางภาคเรียน',
];

/**
 * ปฏิทินโรงเรียน — วันหยุดพิเศษ + วันเปิด-ปิดภาคเรียน — ฝังอยู่ในหน้า "ปีการศึกษา & ล็อกระบบ"
 * (SystemSettingsAndLocksPage.tsx) เพราะเป็นเรื่องการตั้งค่าปีการศึกษาเหมือนกัน แต่เก็บคนละ
 * collection กับ school_settings/system_locks (อันนั้นแค่เลขภาคเรียนปัจจุบันสำหรับล็อกคะแนน)
 */
export function SchoolCalendarSection() {
  const user = useStore(s => s.user);
  const { events, loading, semesterRanges } = useSchoolCalendar();
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // เพิ่มวันหยุดพิเศษ
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayName, setHolidayName] = useState('');

  // เพิ่มช่วงเปิด-ปิดภาคเรียน
  const [semAcademicYear, setSemAcademicYear] = useState('2569');
  const [semSemester, setSemSemester] = useState<'1' | '2'>('1');
  const [semStart, setSemStart] = useState('');
  const [semEnd, setSemEnd] = useState('');

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3500); };

  const holidays = events.filter(e => e.type === 'HOLIDAY');

  const handleAddHoliday = async () => {
    if (!holidayDate) { flash('เลือกวันที่ก่อน'); return; }
    if (!holidayName.trim()) { flash('กรอกชื่อวันหยุดก่อน'); return; }
    setBusy('holiday');
    try {
      await saveSchoolCalendarEvent({
        date: holidayDate,
        type: 'HOLIDAY',
        name: holidayName.trim(),
        academicYear: semAcademicYear,
        semester: null,
        createdBy: user?.uid || 'unknown',
      });
      flash(`เพิ่มวันหยุด "${holidayName.trim()}" (${holidayDate}) แล้ว`);
      setHolidayDate('');
      setHolidayName('');
    } catch (e) {
      flash('ไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  };

  const handleRemoveHoliday = async (id: string) => {
    setBusy(id);
    try {
      await deleteSchoolCalendarEvent(id);
      flash('ลบวันหยุดแล้ว');
    } catch (e) {
      flash('ไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  };

  const handleAddSemesterRange = async () => {
    if (!semStart || !semEnd) { flash('เลือกวันเปิด-ปิดภาคเรียนให้ครบ'); return; }
    if (semStart > semEnd) { flash('วันเปิดภาคเรียนต้องมาก่อนวันปิดภาคเรียน'); return; }
    setBusy('semester');
    try {
      await saveSchoolCalendarEvent({
        date: semStart, type: 'SEMESTER_START',
        name: `เปิดภาคเรียนที่ ${semSemester}/${semAcademicYear}`,
        academicYear: semAcademicYear, semester: semSemester,
        createdBy: user?.uid || 'unknown',
      });
      await saveSchoolCalendarEvent({
        date: semEnd, type: 'SEMESTER_END',
        name: `ปิดภาคเรียนที่ ${semSemester}/${semAcademicYear}`,
        academicYear: semAcademicYear, semester: semSemester,
        createdBy: user?.uid || 'unknown',
      });
      flash(`บันทึกช่วงภาคเรียนที่ ${semSemester}/${semAcademicYear} แล้ว`);
      setSemStart('');
      setSemEnd('');
    } catch (e) {
      flash('ไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  };

  const handleRemoveSemesterRange = async (range: { academicYear: string; semester: string | null }) => {
    const matches = events.filter(e =>
      (e.type === 'SEMESTER_START' || e.type === 'SEMESTER_END') &&
      e.academicYear === range.academicYear && e.semester === range.semester
    );
    setBusy(`${range.academicYear}-${range.semester}`);
    try {
      await Promise.all(matches.map(e => deleteSchoolCalendarEvent(e.id)));
      flash('ลบช่วงภาคเรียนแล้ว');
    } catch (e) {
      flash('ไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-5 space-y-5">
      <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-white/5 pb-2.5">
        <CalendarOff className="w-4.5 h-4.5 text-rose-400" />
        ปฏิทินโรงเรียน — วันหยุดพิเศษ & วันเปิด-ปิดภาคเรียน
      </h3>

      {toast && <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-2.5 text-[11px] text-emerald-300">{toast}</div>}

      {/* วันหยุดพิเศษ */}
      <div className="space-y-3">
        <span className="text-xs font-bold text-slate-300">วันหยุดพิเศษ</span>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-[10px] text-slate-500 space-y-1 block">
            วันที่
            <input
              type="date"
              value={holidayDate}
              onChange={e => setHolidayDate(e.target.value)}
              className="block bg-slate-950 border border-white/10 rounded-lg px-2.5 py-2 text-xs text-white outline-none focus:border-rose-500"
            />
          </label>
          <label className="text-[10px] text-slate-500 space-y-1 block flex-1 min-w-[10rem]">
            ชื่อวันหยุด
            <input
              value={holidayName}
              onChange={e => setHolidayName(e.target.value)}
              placeholder="เช่น วันสงกรานต์"
              className="w-full bg-slate-950 border border-white/10 rounded-lg px-2.5 py-2 text-xs text-white outline-none focus:border-rose-500"
            />
          </label>
          <button
            onClick={handleAddHoliday}
            disabled={busy === 'holiday'}
            className="px-3 py-2 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center gap-1.5"
          >
            {busy === 'holiday' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} เพิ่มวันหยุด
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-slate-500 mr-1">เพิ่มวันหยุดที่พบบ่อย (ต้องเลือกวันที่เอง):</span>
          {COMMON_HOLIDAY_NAMES.map(n => (
            <button
              key={n}
              onClick={() => setHolidayName(n)}
              className="px-2 py-1 rounded-md text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300"
            >
              {n}
            </button>
          ))}
        </div>

        {!loading && (
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {holidays.length === 0 ? (
              <div className="text-[11px] text-slate-500 py-2">ยังไม่มีวันหยุดพิเศษที่ตั้งค่าไว้</div>
            ) : holidays.map(h => (
              <div key={h.id} className="flex items-center gap-2 bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-1.5">
                <span className="text-[11px] font-mono text-rose-300 shrink-0">{h.date}</span>
                <span className="text-xs text-slate-200 flex-1">{h.name}</span>
                <button onClick={() => handleRemoveHoliday(h.id)} disabled={busy === h.id} className="text-red-400 hover:text-red-300 p-1">
                  {busy === h.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* วันเปิด-ปิดภาคเรียน */}
      <div className="space-y-3 pt-3 border-t border-white/5">
        <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5"><CalendarRange className="w-3.5 h-3.5 text-indigo-400" /> วันเปิด-ปิดภาคเรียน</span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <label className="text-[10px] text-slate-500 space-y-1 block">
            ปีการศึกษา
            <input
              value={semAcademicYear}
              onChange={e => setSemAcademicYear(e.target.value)}
              className="w-full bg-slate-950 border border-white/10 rounded-lg px-2.5 py-2 text-xs text-white outline-none focus:border-indigo-500"
            />
          </label>
          <label className="text-[10px] text-slate-500 space-y-1 block">
            ภาคเรียนที่
            <select
              value={semSemester}
              onChange={e => setSemSemester(e.target.value as '1' | '2')}
              className="w-full bg-slate-950 border border-white/10 rounded-lg px-2.5 py-2 text-xs text-white outline-none focus:border-indigo-500"
            >
              <option value="1">1</option>
              <option value="2">2</option>
            </select>
          </label>
          <label className="text-[10px] text-slate-500 space-y-1 block">
            วันเปิดภาคเรียน
            <input
              type="date"
              value={semStart}
              onChange={e => setSemStart(e.target.value)}
              className="w-full bg-slate-950 border border-white/10 rounded-lg px-2.5 py-2 text-xs text-white outline-none focus:border-indigo-500"
            />
          </label>
          <label className="text-[10px] text-slate-500 space-y-1 block">
            วันปิดภาคเรียน
            <input
              type="date"
              value={semEnd}
              onChange={e => setSemEnd(e.target.value)}
              className="w-full bg-slate-950 border border-white/10 rounded-lg px-2.5 py-2 text-xs text-white outline-none focus:border-indigo-500"
            />
          </label>
        </div>
        <button
          onClick={handleAddSemesterRange}
          disabled={busy === 'semester'}
          className="px-3 py-2 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-bold flex items-center gap-1.5"
        >
          {busy === 'semester' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} บันทึกช่วงภาคเรียน
        </button>

        {!loading && (
          <div className="space-y-1.5">
            {semesterRanges.length === 0 ? (
              <div className="text-[11px] text-slate-500 py-2">ยังไม่มีช่วงเปิด-ปิดภาคเรียนที่ตั้งค่าไว้ — ถ้าไม่ตั้งค่า ระบบจะไม่บล็อกวันเรียนตามภาคเรียน</div>
            ) : semesterRanges.map(r => (
              <div key={`${r.academicYear}-${r.semester}`} className="flex items-center gap-2 bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-1.5">
                <span className="text-xs text-slate-200 flex-1">
                  ภาคเรียนที่ {r.semester}/{r.academicYear}: <span className="font-mono text-indigo-300">{r.start}</span> ถึง <span className="font-mono text-indigo-300">{r.end}</span>
                </span>
                <button
                  onClick={() => handleRemoveSemesterRange(r)}
                  disabled={busy === `${r.academicYear}-${r.semester}`}
                  className="text-red-400 hover:text-red-300 p-1"
                >
                  {busy === `${r.academicYear}-${r.semester}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
