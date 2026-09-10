import React, { useMemo, useState } from 'react';
import { Activity, CheckCircle2, Loader2, AlertCircle, Lock } from 'lucide-react';
import { Student, SemesterHealthLog } from '../../types';
import { computeBmi, BMI_CATEGORY_LABEL } from '../../lib/utils';
import { saveSemesterHealthLog } from '../../services/firestoreService';
import type { CurrentSemester } from '../../hooks/useCurrentSemester';

/**
 * ฟอร์มให้นักเรียนกรอกน้ำหนัก/ส่วนสูงของตัวเอง — ภาคเรียนละ 1 ครั้ง
 * ยืนยันจากโรงเรียน: นักเรียนกรอกเอง ไม่ใช่พยาบาล (ลดภาระงานพยาบาลทั้งโรงเรียน)
 *
 *  - ภาคเรียนปัจจุบันอ้างอิงจาก useCurrentSemester() (school_settings/academic_year)
 *  - ถ้ามี record ของภาคเรียนนี้แล้ว → แสดงข้อมูลที่บันทึกไป ไม่ใช่ฟอร์มกรอกซ้ำ
 *  - firestore.rules: doc id ผูกภาคเรียน → create ซ้ำภาคเรียนเดิมถูกปฏิเสธ (double-guard)
 */
export function SemesterHealthSelfReportForm({
  student,
  studentUid,
  currentSemester,
  existing,
}: {
  student: Student;
  studentUid: string;
  currentSemester: CurrentSemester;
  existing: SemesterHealthLog | null;
}) {
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [bloodType, setBloodType] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNow, setSavedNow] = useState(false);

  const h = parseFloat(height);
  const w = parseFloat(weight);
  const preview = useMemo(() => computeBmi(h, w), [h, w]);
  const valid = h >= 80 && h <= 230 && w >= 20 && w <= 200;

  if (currentSemester.loading) {
    return (
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 text-xs text-slate-400 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> กำลังตรวจภาคเรียนปัจจุบัน…
      </div>
    );
  }

  const alreadySubmitted = !!existing || savedNow;

  const handleSubmit = async () => {
    if (!valid) { setError('กรุณากรอกส่วนสูง (80–230 ซม.) และน้ำหนัก (20–200 กก.) ให้ถูกต้อง'); return; }
    setSaving(true);
    setError(null);
    try {
      const { bmi, category } = computeBmi(h, w);
      await saveSemesterHealthLog(
        {
          studentId: student.studentId,
          studentUid,
          parentUid: student.parentUid ?? student.parentId ?? null,
          academicYear: currentSemester.academicYear,
          term: currentSemester.term,
          semester: currentSemester.label,
          height: Math.round(h * 10) / 10,
          weight: Math.round(w * 10) / 10,
          bmi,
          bmiCategory: category,
          bloodType: bloodType.trim(),
          recordedByRole: 'STUDENT',
        },
        studentUid,
      );
      setSavedNow(true);
    } catch (e) {
      setError('บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง (' + (e instanceof Error ? e.message : String(e)) + ')');
    } finally {
      setSaving(false);
    }
  };

  const shown = existing;

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-md space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          บันทึกน้ำหนัก/ส่วนสูง — ภาคเรียนที่ {currentSemester.label}
        </h3>
        <span className="text-[10px] text-slate-500">
          {currentSemester.isConfigured ? 'อ้างอิงปฏิทินการศึกษาของโรงเรียน' : 'อ้างอิงจากช่วงเวลาปัจจุบัน'}
        </span>
      </div>

      {alreadySubmitted ? (
        <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold">
            <Lock className="w-3.5 h-3.5" />
            บันทึกของภาคเรียนนี้เรียบร้อยแล้ว — กรอกได้ภาคเรียนละ 1 ครั้ง
          </div>
          <div className="grid grid-cols-3 gap-3 text-center pt-1">
            <div>
              <div className="text-xl font-black text-white">{(shown?.height ?? h)}</div>
              <div className="text-[10px] text-slate-400">ส่วนสูง (ซม.)</div>
            </div>
            <div>
              <div className="text-xl font-black text-white">{(shown?.weight ?? w)}</div>
              <div className="text-[10px] text-slate-400">น้ำหนัก (กก.)</div>
            </div>
            <div>
              <div className="text-xl font-black text-emerald-400">{(shown?.bmi ?? preview.bmi)}</div>
              <div className="text-[10px] text-slate-400">
                BMI · {BMI_CATEGORY_LABEL[(shown?.bmiCategory ?? preview.category)]}
              </div>
            </div>
          </div>
          <p className="text-[10px] text-slate-500">
            หากกรอกผิด แจ้งคุณครูที่ปรึกษาหรือห้องพยาบาลเพื่อขอแก้ไข
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-xs text-slate-400 space-y-1 block">
              <span>ส่วนสูง (ซม.)</span>
              <input
                type="number" inputMode="decimal" value={height} onChange={e => setHeight(e.target.value)}
                placeholder="เช่น 168"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </label>
            <label className="text-xs text-slate-400 space-y-1 block">
              <span>น้ำหนัก (กก.)</span>
              <input
                type="number" inputMode="decimal" value={weight} onChange={e => setWeight(e.target.value)}
                placeholder="เช่น 55.5"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </label>
            <label className="text-xs text-slate-400 space-y-1 block">
              <span>หมู่เลือด (ไม่บังคับ)</span>
              <input
                value={bloodType} onChange={e => setBloodType(e.target.value)} maxLength={12}
                placeholder="เช่น O"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </label>
          </div>

          {valid && (
            <div className="text-xs text-slate-300 bg-slate-800/50 rounded-xl px-3 py-2">
              BMI โดยประมาณ: <span className="font-bold text-emerald-400">{preview.bmi}</span>
              {' '}({BMI_CATEGORY_LABEL[preview.category]})
            </div>
          )}

          {error && (
            <p className="text-[11px] text-rose-400 flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 mt-px shrink-0" /> {error}
            </p>
          )}

          <button
            onClick={handleSubmit} disabled={!valid || saving}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {saving ? 'กำลังบันทึก…' : 'บันทึกน้ำหนัก/ส่วนสูงของภาคเรียนนี้'}
          </button>
          <p className="text-[10px] text-slate-500">
            บันทึกได้ภาคเรียนละ 1 ครั้ง — ตรวจสอบตัวเลขให้ถูกต้องก่อนกดบันทึก
          </p>
        </>
      )}
    </div>
  );
}
