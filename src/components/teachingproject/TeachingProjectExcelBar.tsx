import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  buildProjectWorkbook, parseProjectFile, reuseUnitIds, safeFileName, type ExcelContent,
} from '../../lib/teachingProjectExcel';

const btn = 'px-3 py-1.5 rounded-lg text-xs border cursor-pointer';

/**
 * แถบ Excel ในฟอร์มโครงการสอน: ดาวน์โหลดเทมเพลต / ดาวน์โหลดทั้งฉบับ (ตามที่อยู่ในฟอร์มขณะนี้) / นำเข้า
 * นำเข้า = เติมลงฟอร์ม (ยังไม่บันทึก) เพื่อให้ครูตรวจก่อนกด "บันทึก"
 */
export function TeachingProjectExcelBar({ courseCode, courseName, semesterLabel, draft, defaults, onImport }: {
  courseCode: string; courseName: string; semesterLabel: string;
  draft: ExcelContent; defaults: Pick<ExcelContent, 'levelLabel' | 'credits' | 'hoursPerWeek' | 'courseType'>;
  onImport: (c: ExcelContent) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msgs, setMsgs] = useState<{ kind: 'ok' | 'error' | 'warn'; text: string }[]>([]);
  const title = `${courseCode} ${courseName}`.trim();
  const base = safeFileName(`${courseCode}_${courseName}_${semesterLabel}`);

  const save = (wb: XLSX.WorkBook, name: string) => {
    try { XLSX.writeFile(wb, name); } catch (e) { setMsgs([{ kind: 'error', text: `ดาวน์โหลดไม่สำเร็จ: ${e instanceof Error ? e.message : 'ไม่ทราบสาเหตุ'}` }]); }
  };
  const downloadTemplate = () => save(buildProjectWorkbook({
    ...defaults, description: '', indicators: [], units: [], assessment: [], assessmentNote: '',
  }, { title, example: true }), `เทมเพลตโครงการสอน_${base}.xlsx`);
  const downloadFull = () => save(buildProjectWorkbook(draft, { title }), `โครงการสอน_${base}.xlsx`);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setMsgs([]);
    if (f.size > 5 * 1024 * 1024) { setMsgs([{ kind: 'error', text: 'ไฟล์ใหญ่เกิน 5 MB' }]); return; }
    const r = parseProjectFile(await f.arrayBuffer());
    if (!r.content) { setMsgs(r.errors.map(text => ({ kind: 'error' as const, text }))); return; }
    const hasData = draft.units.length > 0 || draft.description.trim() !== '' || draft.indicators.some(i => i.trim());
    if (hasData && !window.confirm('นำเข้าจะแทนที่ข้อมูลโครงการสอนในฟอร์มนี้ทั้งหมด (ยังไม่บันทึกจนกว่าจะกด "บันทึก") ดำเนินการต่อ?')) return;
    onImport({ ...r.content, units: reuseUnitIds(r.content.units, draft.units) });
    setMsgs([
      { kind: 'ok', text: `นำเข้าแล้ว: ${r.content.indicators.length} ตัวชี้วัด · ${r.content.units.length} แถวเนื้อหา · ${r.content.assessment.length} รายการวัดผล — ตรวจความถูกต้องแล้วกด "บันทึก"` },
      ...r.warnings.slice(0, 12).map(text => ({ kind: 'warn' as const, text })),
      ...(r.warnings.length > 12 ? [{ kind: 'warn' as const, text: `…และอีก ${r.warnings.length - 12} รายการ` }] : []),
    ]);
  };

  return (
    <div className="rounded-lg border border-emerald-500/30 bg-slate-950/60 p-3 space-y-2">
      <p className="text-xs text-emerald-200">กรอกด้วย Excel: ดาวน์โหลดเทมเพลต → กรอก → นำเข้า (ข้อมูลเดิมที่มีอยู่ดาวน์โหลดเป็นไฟล์ทั้งฉบับเพื่อแก้แล้วนำเข้ากลับได้)</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={`${btn} border-emerald-500/50 text-emerald-200`} onClick={downloadTemplate}>ดาวน์โหลดเทมเพลต Excel</button>
        <button type="button" className={`${btn} border-slate-600 text-slate-200`} onClick={downloadFull}>ดาวน์โหลดโครงการสอนทั้งฉบับ (Excel)</button>
        <button type="button" className={`${btn} bg-emerald-600 border-emerald-600 text-white`} onClick={() => fileRef.current?.click()}>นำเข้าจาก Excel</button>
        <input ref={fileRef} type="file" className="hidden" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={e => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
      {msgs.length > 0 && (
        <ul role="status" className="text-xs space-y-0.5">
          {msgs.map((m, i) => <li key={i} className={m.kind === 'ok' ? 'text-emerald-300' : m.kind === 'error' ? 'text-rose-300' : 'text-amber-300'}>{m.text}</li>)}
        </ul>
      )}
    </div>
  );
}
