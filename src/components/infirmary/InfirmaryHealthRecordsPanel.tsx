import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Loader2, Save, Plus } from 'lucide-react';
import { DatePicker } from '../shared/DatePicker';
import { useCurrentSemester } from '../../hooks/useCurrentSemester';
import { useStudentHealthRecords } from '../../hooks/useStudentHealthRecords';
import { StudentHealthRecordsView } from '../health/StudentHealthRecordsCards';
import { addStudentVaccination, saveStudentCheckup, subscribeSemesterHealthLogs } from '../../services/firestoreService';
import {
  COMMON_VACCINE_SUGGESTIONS, SCREEN_RESULT_LABEL, latestCheckup, type ScreenResult,
} from '../../lib/healthRecords';
import { BMI_CATEGORY_LABEL } from '../../lib/utils';
import type { SemesterHealthLog } from '../../types';

const RESULTS: ScreenResult[] = ['NORMAL', 'ABNORMAL', 'NOT_TESTED'];
const inputCls = 'w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500';

/** พยาบาลบันทึกผลตรวจสายตา/การได้ยินประจำปี + ประวัติวัคซีน ของนักเรียนที่เลือก (ข้อมูลจริง — ไม่มีค่าตัวอย่าง) */
export function InfirmaryHealthRecordsPanel({ studentId, actor }: { studentId: string; actor: { uid: string; name: string } }) {
  const sem = useCurrentSemester();
  const { checkups, vaccinations, donations, error } = useStudentHealthRecords(studentId || undefined);
  const [logs, setLogs] = useState<SemesterHealthLog[]>([]);

  // BMI จริงจากที่นักเรียน/พยาบาลบันทึกรายภาคเรียน (ล่าสุด)
  useEffect(() => {
    setLogs([]);
    if (!studentId) return;
    return subscribeSemesterHealthLogs(setLogs, { studentId });
  }, [studentId]);
  const latestLog = logs.length ? [...logs].sort((a, b) => (a.academicYear + a.term).localeCompare(b.academicYear + b.term))[logs.length - 1] : null;

  // ฟอร์มตรวจประจำปี
  const [examDate, setExamDate] = useState('');
  const [visionLeft, setVisionLeft] = useState('');
  const [visionRight, setVisionRight] = useState('');
  const [visionResult, setVisionResult] = useState<ScreenResult>('NORMAL');
  const [hearingResult, setHearingResult] = useState<ScreenResult>('NORMAL');
  const [note, setNote] = useState('');
  const [cBusy, setCBusy] = useState(false);
  const [cMsg, setCMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // ฟอร์มวัคซีน
  const [vaccine, setVaccine] = useState('');
  const [doseDate, setDoseDate] = useState('');
  const [place, setPlace] = useState('');
  const [vBusy, setVBusy] = useState(false);
  const [vMsg, setVMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // เปลี่ยนนักเรียน → ล้างฟอร์ม; มีผลตรวจของปีนี้อยู่แล้ว → เติมให้แก้ได้
  useEffect(() => {
    setCMsg(null); setVMsg(null); setVaccine(''); setDoseDate(''); setPlace('');
    const cur = (checkups || []).find(c => c.academicYear === sem.academicYear) || null;
    setExamDate(cur?.examDate || ''); setVisionLeft(cur?.visionLeft || ''); setVisionRight(cur?.visionRight || '');
    setVisionResult(cur?.visionResult || 'NORMAL'); setHearingResult(cur?.hearingResult || 'NORMAL'); setNote(cur?.note || '');
  }, [studentId, sem.academicYear, checkups === undefined]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!studentId) return <p className="text-xs text-slate-500">เลือกนักเรียนเพื่อดูและบันทึกผลตรวจสุขภาพ</p>;

  const existingThisYear = (checkups || []).some(c => c.academicYear === sem.academicYear);

  const saveCheckup = async (e: React.FormEvent) => {
    e.preventDefault();
    setCBusy(true); setCMsg(null);
    try {
      await saveStudentCheckup({
        studentId, academicYear: sem.academicYear, examDate, visionLeft, visionRight, visionResult, hearingResult, note,
        recordedByUid: actor.uid, recordedByName: actor.name,
      });
      setCMsg({ ok: true, text: `บันทึกผลตรวจปีการศึกษา ${sem.academicYear} แล้ว` });
    } catch (err) {
      setCMsg({ ok: false, text: err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ' });
    } finally { setCBusy(false); }
  };

  const saveVaccine = async (e: React.FormEvent) => {
    e.preventDefault();
    setVBusy(true); setVMsg(null);
    try {
      await addStudentVaccination({ studentId, vaccine, doseDate, place, recordedByUid: actor.uid, recordedByName: actor.name });
      setVaccine(''); setDoseDate(''); setPlace('');
      setVMsg({ ok: true, text: 'เพิ่มประวัติวัคซีนแล้ว' });
    } catch (err) {
      setVMsg({ ok: false, text: err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ' });
    } finally { setVBusy(false); }
  };

  const last = latestCheckup(checkups || []);

  return (
    <div className="space-y-4" data-testid="infirmary-health-records">
      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 max-w-sm">
        <span className="text-slate-400 text-xs block">ดัชนีมวลกาย (BMI) ล่าสุดที่บันทึก</span>
        {latestLog ? (
          <>
            <p className="text-2xl font-black text-emerald-400 font-mono mt-0.5">{latestLog.bmi}</p>
            <span className="text-[10px] text-slate-300">{BMI_CATEGORY_LABEL[latestLog.bmiCategory]} · ส่วนสูง {latestLog.height} ซม. น้ำหนัก {latestLog.weight} กก. · ภาคเรียน {latestLog.semester}</span>
          </>
        ) : (
          <p className="text-xs text-slate-500 mt-1">นักเรียนยังไม่ได้บันทึกน้ำหนัก/ส่วนสูง</p>
        )}
      </div>

      {error && <p className="text-[11px] text-rose-300">อ่านข้อมูลบางส่วนไม่ได้: {error}</p>}
      {checkups === undefined || vaccinations === undefined || donations === undefined
        ? <p className="text-xs text-slate-400 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> กำลังโหลด…</p>
        : <StudentHealthRecordsView checkups={checkups} vaccinations={vaccinations} donations={donations} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <form onSubmit={saveCheckup} className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-3">
          <h4 className="text-sm font-bold text-white">บันทึกผลตรวจสายตา/การได้ยิน ปีการศึกษา {sem.academicYear}</h4>
          {existingThisYear && <p className="text-[11px] text-amber-300">ปีนี้มีผลตรวจแล้ว — การบันทึกจะแก้ไขทับรายการเดิม</p>}
          <div>
            <label className="text-[11px] text-slate-400">วันที่ตรวจ</label>
            <DatePicker value={examDate} onChange={setExamDate} max={format(new Date(), 'yyyy-MM-dd')} ariaLabel="วันที่ตรวจ" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[11px] text-slate-400">สายตาซ้าย (เช่น 20/20)</label><input className={inputCls} maxLength={12} value={visionLeft} onChange={e => setVisionLeft(e.target.value)} /></div>
            <div><label className="text-[11px] text-slate-400">สายตาขวา</label><input className={inputCls} maxLength={12} value={visionRight} onChange={e => setVisionRight(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-slate-400">ผลตรวจสายตา</label>
              <select className={inputCls} value={visionResult} onChange={e => setVisionResult(e.target.value as ScreenResult)}>
                {RESULTS.map(r => <option key={r} value={r}>{SCREEN_RESULT_LABEL[r]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-slate-400">ผลตรวจการได้ยิน</label>
              <select className={inputCls} value={hearingResult} onChange={e => setHearingResult(e.target.value as ScreenResult)}>
                {RESULTS.map(r => <option key={r} value={r}>{SCREEN_RESULT_LABEL[r]}</option>)}
              </select>
            </div>
          </div>
          <div><label className="text-[11px] text-slate-400">หมายเหตุ (ถ้ามี)</label><input className={inputCls} maxLength={300} value={note} onChange={e => setNote(e.target.value)} /></div>
          {cMsg && <p className={`text-[11px] ${cMsg.ok ? 'text-emerald-400' : 'text-rose-300'}`}>{cMsg.text}</p>}
          <button disabled={cBusy} className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-50 rounded-xl flex items-center gap-1.5">
            {cBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} บันทึกผลตรวจ
          </button>
          {last && last.academicYear !== sem.academicYear && <p className="text-[10px] text-slate-500">ผลตรวจล่าสุดเป็นของปีการศึกษา {last.academicYear}</p>}
        </form>

        <form onSubmit={saveVaccine} className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-3">
          <h4 className="text-sm font-bold text-white">เพิ่มประวัติวัคซีน</h4>
          <div>
            <label className="text-[11px] text-slate-400">ชื่อวัคซีน (เลือกจากรายการหรือพิมพ์เอง)</label>
            <input className={inputCls} list="vaccine-suggestions" maxLength={80} value={vaccine} onChange={e => setVaccine(e.target.value)} />
            <datalist id="vaccine-suggestions">{COMMON_VACCINE_SUGGESTIONS.map(v => <option key={v} value={v} />)}</datalist>
          </div>
          <div>
            <label className="text-[11px] text-slate-400">วันที่ได้รับวัคซีน</label>
            <DatePicker value={doseDate} onChange={setDoseDate} max={format(new Date(), 'yyyy-MM-dd')} ariaLabel="วันที่ได้รับวัคซีน" />
          </div>
          <div><label className="text-[11px] text-slate-400">สถานที่ (เช่น รพ.สต./โรงเรียน)</label><input className={inputCls} maxLength={80} value={place} onChange={e => setPlace(e.target.value)} /></div>
          {vMsg && <p className={`text-[11px] ${vMsg.ok ? 'text-emerald-400' : 'text-rose-300'}`}>{vMsg.text}</p>}
          <button disabled={vBusy} className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-xl flex items-center gap-1.5">
            {vBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} เพิ่มวัคซีน
          </button>
          <p className="text-[10px] text-slate-500">แก้ไขรายการที่บันทึกผิดให้แจ้งผู้ดูแลระบบ (ลบได้เฉพาะ SUPER_ADMIN)</p>
        </form>
      </div>
    </div>
  );
}
