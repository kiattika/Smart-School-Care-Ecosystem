import React, { useMemo } from 'react';
import { Printer, X } from 'lucide-react';
import { GRADE_REPORT_DISCLAIMER } from '../../lib/gradeReport';
import { PP5_GRADES, summarizePp5, type Pp5Row } from '../../lib/pp5';

const f1 = (v: number | null) => (v === null ? '' : Number.isInteger(v) ? String(v) : v.toFixed(1));
const f2 = (v: number | null) => (v === null ? '' : v.toFixed(2));
const thDate = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() + 543}`;

export interface Pp5Header {
  courseCode: string; courseName: string; credits: number | null; level: string;
  academicYear: string; term: string; teacherName: string; isActivity: boolean;
  max: { pre: number; mid: number; post: number; final: number };
}

/** ปพ.5 ใบคะแนนรายวิชา (พิมพ์/บันทึกเป็น PDF ผ่านเบราว์เซอร์) — จัดกลุ่มตามห้อง ตามตัวอย่างของโรงเรียน */
export function Pp5Sheet({ header, rows, onClose }: { header: Pp5Header; rows: Pp5Row[]; onClose: () => void }) {
  const today = useMemo(() => new Date(), []);
  const rooms = useMemo(() => {
    const m = new Map<string, Pp5Row[]>();
    rows.forEach(r => m.set(r.student.room || '-', [...(m.get(r.student.room || '-') || []), r]));
    return [...m.entries()];
  }, [rows]);
  const sum = summarizePp5(rows);
  const maxTotal = header.max.pre + header.max.mid + header.max.post + header.max.final;
  const cell = 'border border-gray-500 px-1 py-0.5 text-center';
  return (
    <div className="fixed inset-0 z-[60] bg-black/70 overflow-auto p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="ใบคะแนน ปพ.5">
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          body * { visibility: hidden !important; }
          #pp5-sheet, #pp5-sheet * { visibility: visible !important; }
          #pp5-sheet { position: absolute; left: 0; top: 0; width: 100%; margin: 0 !important; box-shadow: none !important; }
          .pp5-no-print { display: none !important; }
        }
      `}</style>
      <div className="pp5-no-print max-w-[1200px] mx-auto mb-3 flex items-center justify-between gap-3">
        <p className="text-xs text-amber-200">คอลัมน์คุณลักษณะอันพึงประสงค์ และการอ่าน คิดวิเคราะห์ ระบบยังไม่มีข้อมูล จึงเว้นว่างไว้ให้กรอกด้วยมือ · เวลาเรียนคำนวณจากการเช็คชื่อรายวิชา (ลาป่วย/ลากิจยังไม่แยกประเภท จึงรวมในช่อง “ลา”)</p>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => window.print()} className="px-3 py-1.5 rounded-lg text-xs bg-emerald-600 text-white flex items-center gap-1.5 cursor-pointer"><Printer className="w-3.5 h-3.5" /> พิมพ์ / PDF</button>
          <button onClick={onClose} aria-label="ปิด" className="px-3 py-1.5 rounded-lg text-xs bg-slate-800 text-slate-200 border border-slate-600 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      <div id="pp5-sheet" className="max-w-[1200px] mx-auto bg-white text-black rounded-xl p-5 shadow-xl overflow-x-auto" style={{ fontFamily: "'Sarabun','TH Sarabun New','Noto Sans Thai',sans-serif" }}>
        <div className="text-xs flex justify-between items-start mb-2">
          <div>
            <p className="font-bold text-sm">โรงเรียนอุตรดิตถ์</p>
            <p>วิชา {header.courseCode} {header.courseName}{header.credits !== null ? ` นก.${header.credits.toFixed(1)}` : ''} ปีการศึกษา {header.academicYear} ภาคเรียนที่ {header.term}{header.level ? ` ระดับชั้น ${header.level}` : ''}</p>
            <p>ครูผู้สอน {header.teacherName}</p>
          </div>
          <p className="text-right">พิมพ์เมื่อ {thDate(today)}</p>
        </div>
        <table className="w-full text-[11px] border-collapse min-w-[1000px]">
          <thead>
            <tr className="bg-gray-100">
              <th rowSpan={2} className={cell}>ห้อง</th><th rowSpan={2} className={cell}>เลขประจำตัว</th>
              <th rowSpan={2} className={`${cell} text-left`}>ชื่อ - สกุล</th><th rowSpan={2} className={cell}>เลขที่</th>
              {header.isActivity ? <th rowSpan={2} className={cell}>ผลการเรียน (ผ/มผ)</th> : <>
                <th className={cell}>ก่อนกลางภาค</th><th className={cell}>กลางภาค</th><th className={cell}>หลังกลางภาค</th><th className={cell}>ปลายภาค</th>
                <th className={cell}>รวม</th><th rowSpan={2} className={cell}>ร้อยละ</th><th rowSpan={2} className={cell}>ผลการเรียน</th>
              </>}
              <th colSpan={2} className={cell}>คุณลักษณะฯ</th><th colSpan={2} className={cell}>อ่าน คิด เขียน</th>
              <th rowSpan={2} className={cell}>สาย</th><th rowSpan={2} className={cell}>ลา</th><th rowSpan={2} className={cell}>ขาด</th><th rowSpan={2} className={cell}>% เวลาเรียน</th>
            </tr>
            <tr className="bg-gray-100">
              {!header.isActivity && <><th className={cell}>({header.max.pre})</th><th className={cell}>({header.max.mid})</th><th className={cell}>({header.max.post})</th><th className={cell}>({header.max.final})</th><th className={cell}>({maxTotal})</th></>}
              <th className={cell}>1-10</th><th className={cell}>ผล</th><th className={cell}>1-5</th><th className={cell}>ผล</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map(([room, list]) => (
              <React.Fragment key={room}>
                <tr><td colSpan={header.isActivity ? 12 : 17} className="border border-gray-500 px-2 py-0.5 bg-cyan-50 font-semibold">ชั้น/ห้อง {room}</td></tr>
                {list.map(r => (
                  <tr key={r.student.studentId}>
                    <td className={cell}>{room}</td><td className={`${cell} font-mono`}>{r.student.studentId}</td>
                    <td className={`${cell} text-left`}>{r.student.name}</td><td className={cell}>{r.student.studentNo ?? ''}</td>
                    {header.isActivity ? <td className={`${cell} font-bold`}>{r.grade ?? ''}</td> : <>
                      <td className={cell}>{f1(r.pre)}</td><td className={cell}>{f1(r.mid)}</td><td className={cell}>{f1(r.post)}</td><td className={cell}>{f1(r.final)}</td>
                      <td className={`${cell} font-semibold`}>{f1(r.total)}</td><td className={cell}>{f2(r.percent)}</td><td className={`${cell} font-bold`}>{r.grade ?? ''}</td>
                    </>}
                    <td className={cell}></td><td className={cell}></td><td className={cell}></td><td className={cell}></td>
                    <td className={cell}>{r.attendance ? r.attendance.late : ''}</td><td className={cell}>{r.attendance ? r.attendance.leave : ''}</td>
                    <td className={cell}>{r.attendance ? r.attendance.absent : ''}</td><td className={cell}>{f2(r.attendancePercent)}</td>
                  </tr>
                ))}
                <tr><td colSpan={header.isActivity ? 12 : 17} className="border border-gray-500 px-2 py-0.5 text-right font-semibold">รวม {room} : {list.length} คน</td></tr>
              </React.Fragment>
            ))}
          </tbody>
        </table>
        <div className="mt-3 grid sm:grid-cols-2 gap-4 text-xs">
          <div className="space-y-0.5">
            <p>จำนวนนักเรียนทั้งหมด {sum.count} คน (มีผลการเรียนแล้ว {sum.scored} คน)</p>
            {!header.isActivity && <p>ผลการเรียนเฉลี่ยร้อยละ {sum.avgPercent === null ? '-' : sum.avgPercent.toFixed(2)}</p>}
            <p>เวลาเรียนเฉลี่ยร้อยละ {sum.avgAttendance === null ? '-' : sum.avgAttendance.toFixed(2)}</p>
            <p className="pt-6">ลงชื่อ ........................................ ครูผู้สอน</p>
            <p className="pl-8">( {header.teacherName} )</p>
            <p className="pl-8">วันที่ ........ / ........ / ........</p>
          </div>
          <table className="text-[11px] border-collapse justify-self-end">
            <thead><tr className="bg-gray-100">{header.isActivity ? <><th className={cell}>ผ</th><th className={cell}>มผ</th></> : <>{PP5_GRADES.map(g => <th key={g} className={cell}>{g}</th>)}<th className={cell}>ร</th><th className={cell}>มส</th></>}</tr></thead>
            <tbody><tr>{header.isActivity ? <><td className={cell}>{sum.activityPassed}</td><td className={cell}>{sum.activityFailed}</td></> : <>{PP5_GRADES.map(g => <td key={g} className={cell}>{sum.distribution[g]}</td>)}<td className={cell}>-</td><td className={cell}>-</td></>}</tr></tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-red-700 border-t border-gray-300 pt-2">{GRADE_REPORT_DISCLAIMER}</p>
      </div>
    </div>
  );
}
