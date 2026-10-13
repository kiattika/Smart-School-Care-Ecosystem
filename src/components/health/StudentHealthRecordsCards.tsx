import React from 'react';
import { Eye, Ear, Syringe, Droplets, Loader2 } from 'lucide-react';
import { useStudentHealthRecords } from '../../hooks/useStudentHealthRecords';
import { latestCheckup, sortByDateDesc, SCREEN_RESULT_LABEL, type ScreenResult, type StudentCheckup, type StudentVaccination, type BloodDonation } from '../../lib/healthRecords';

const fmtDate = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return `${d}/${m}/${y + 543}`;
};

const resultTone = (r: ScreenResult) =>
  r === 'NORMAL' ? 'text-emerald-400' : r === 'ABNORMAL' ? 'text-amber-300' : 'text-slate-400';

/** การ์ดแสดงผลตรวจสายตา/การได้ยิน วัคซีน และประวัติบริจาคโลหิต — แสดงอย่างเดียว (ข้อมูลจริงที่พยาบาลบันทึก) */
export function StudentHealthRecordsView({
  checkups, vaccinations, donations, compact,
}: { checkups: StudentCheckup[]; vaccinations: StudentVaccination[]; donations: BloodDonation[]; compact?: boolean }) {
  const last = latestCheckup(checkups);
  const vacc = sortByDateDesc(vaccinations, v => v.doseDate);
  const dons = sortByDateDesc(donations, d => d.donatedAt);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" data-testid="student-health-records">
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
        <h4 className="text-xs font-bold text-white flex items-center gap-2 mb-3"><Eye className="w-4 h-4 text-sky-400" /> ตรวจสายตา / การได้ยิน</h4>
        {!last ? (
          <p className="text-[11px] text-slate-500">ยังไม่มีผลตรวจประจำปีที่พยาบาลบันทึก</p>
        ) : (
          <div className="space-y-2 text-xs">
            <p className="text-[10px] text-slate-400">ปีการศึกษา {last.academicYear} · ตรวจเมื่อ {fmtDate(last.examDate)}</p>
            <div>
              <span className="text-slate-400 flex items-center gap-1"><Eye className="w-3 h-3" /> สายตา</span>
              <p className={`font-bold ${resultTone(last.visionResult)}`}>{SCREEN_RESULT_LABEL[last.visionResult]}</p>
              {(last.visionLeft || last.visionRight) && <p className="text-[11px] text-slate-400 font-mono">ซ้าย {last.visionLeft || '-'} · ขวา {last.visionRight || '-'}</p>}
            </div>
            <div>
              <span className="text-slate-400 flex items-center gap-1"><Ear className="w-3 h-3" /> การได้ยิน</span>
              <p className={`font-bold ${resultTone(last.hearingResult)}`}>{SCREEN_RESULT_LABEL[last.hearingResult]}</p>
            </div>
            {last.note && <p className="text-[11px] text-slate-300">หมายเหตุ: {last.note}</p>}
            <p className="text-[10px] text-slate-500">บันทึกโดย {last.recordedByName}</p>
          </div>
        )}
      </div>

      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
        <h4 className="text-xs font-bold text-white flex items-center gap-2 mb-3"><Syringe className="w-4 h-4 text-emerald-400" /> ประวัติวัคซีน</h4>
        {vacc.length === 0 ? (
          <p className="text-[11px] text-slate-500">ยังไม่มีประวัติวัคซีนที่พยาบาลบันทึก</p>
        ) : (
          <ul className="space-y-1.5 text-xs">
            {vacc.slice(0, compact ? 5 : 50).map(v => (
              <li key={v.id} className="flex items-baseline justify-between gap-2 border-b border-slate-800/60 pb-1">
                <span className="font-semibold text-slate-100">{v.vaccine}</span>
                <span className="text-[11px] text-slate-400 whitespace-nowrap">{fmtDate(v.doseDate)}{v.place ? ` · ${v.place}` : ''}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
        <h4 className="text-xs font-bold text-white flex items-center gap-2 mb-3"><Droplets className="w-4 h-4 text-rose-400" /> ประวัติบริจาคโลหิต</h4>
        {dons.length === 0 ? (
          <p className="text-[11px] text-slate-500">ยังไม่มีประวัติการบริจาคโลหิตที่พยาบาลบันทึก</p>
        ) : (
          <>
            <p className="text-[11px] text-slate-400 mb-2">บริจาคแล้ว <span className="text-white font-bold">{dons.length}</span> ครั้ง · ล่าสุด {fmtDate(dons[0].donatedAt)}</p>
            <ul className="space-y-1.5 text-xs">
              {dons.slice(0, compact ? 5 : 50).map(d => (
                <li key={d.id} className="flex items-baseline justify-between gap-2 border-b border-slate-800/60 pb-1">
                  <span className="text-slate-100">{fmtDate(d.donatedAt)}</span>
                  <span className="text-[11px] text-slate-400">{d.place || ''}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

/** ผูก hook + แสดงผล (นักเรียน/ผู้ปกครอง) */
export function StudentHealthRecordsCards({ studentId }: { studentId: string }) {
  const { checkups, vaccinations, donations, error } = useStudentHealthRecords(studentId);
  if (checkups === undefined || vaccinations === undefined || donations === undefined) {
    return <p className="text-xs text-slate-400 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> กำลังโหลดผลตรวจสุขภาพ…</p>;
  }
  return (
    <div className="space-y-2">
      {error && <p className="text-[11px] text-rose-300">อ่านข้อมูลบางส่วนไม่ได้: {error}</p>}
      <StudentHealthRecordsView checkups={checkups} vaccinations={vaccinations} donations={donations} />
    </div>
  );
}
