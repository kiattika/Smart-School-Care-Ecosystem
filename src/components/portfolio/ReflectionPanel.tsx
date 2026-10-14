import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '../../store';
import { useCurrentSemester } from '../../hooks/useCurrentSemester';
import { useReflections } from '../../hooks/usePlcAndReflections';
import { saveReflection } from '../../services/reflectionService';
import { semesterIdOf } from '../../lib/lessonPlans';
import { REFLECTION_FIELDS, emptyReflection, isReflectionComplete, validateReflection, type ReflectionContent } from '../../lib/reflection';
import { staffDepartmentId, type StaffRow } from '../../lib/supervisionView';

/** บันทึกสะท้อนคิดการจัดการเรียนรู้รายภาคเรียนของครู (1 ฉบับ/ภาคเรียน แก้ไขได้) */
export function ReflectionPanel() {
  const user = useStore(s => s.user);
  const staff = useStore(s => s.staffDirectory) as StaffRow[];
  const sem = useCurrentSemester();
  const staffId = user?.staffId || '';
  const q = useMemo(() => (staffId ? ({ scope: 'SELF', staffId } as const) : null), [staffId]);
  const { data, loading, error } = useReflections(semesterIdOf(sem.academicYear, sem.term), q);
  const saved = data[0];
  const [d, setD] = useState<ReflectionContent>(emptyReflection());
  const [loadedId, setLoadedId] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  // โหลดฉบับที่บันทึกไว้เข้าฟอร์มครั้งเดียวต่อเอกสาร (ไม่ทับสิ่งที่กำลังพิมพ์เมื่อ snapshot อัปเดต)
  useEffect(() => {
    if (saved && saved.id !== loadedId) {
      setD({ outcomes: saved.outcomes, strengths: saved.strengths, problems: saved.problems, improvements: saved.improvements, nextPlan: saved.nextPlan });
      setLoadedId(saved.id);
    }
  }, [saved, loadedId]);

  if (!staffId) return <p className="text-sm text-slate-400">บัญชีนี้ไม่ได้เชื่อมกับทะเบียนบุคลากร</p>;
  const dept = staffDepartmentId(staff.find(s => s.id === staffId));
  const problems = validateReflection(d);
  const save = async () => {
    setBusy(true); setMsg('');
    try {
      await saveReflection({ semester: { academicYear: sem.academicYear, term: sem.term }, teacher: { staffId, name: user?.displayName || '', departmentId: dept }, content: d });
      setMsg('บันทึกแล้ว');
    } catch (e) { setMsg(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ'); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-sm">
        <p className="text-white font-medium">บันทึกสะท้อนคิดการจัดการเรียนรู้ ภาคเรียน {sem.label}</p>
        <p className="text-slate-400 mt-1">เขียนได้ตลอดภาคเรียนและแก้ไขได้ — จะรวมอยู่ในแฟ้มสะสมงาน สถานะ: {isReflectionComplete(d) ? 'กรอกครบหัวข้อที่จำเป็นแล้ว' : 'ยังกรอกไม่ครบ (หัวข้อที่มี * จำเป็น)'}</p>
      </div>
      {error && <p role="alert" className="text-sm text-amber-300">โหลดข้อมูลไม่สำเร็จ: {error}</p>}
      {loading ? <p className="text-sm text-slate-400">กำลังโหลด…</p> : (
        <div className="space-y-3">
          {REFLECTION_FIELDS.map(f => (
            <div key={f.id}>
              <label className="text-xs text-slate-300 block mb-1">{f.label}{f.required && ' *'} <span className="text-slate-500">— {f.hint}</span></label>
              <textarea className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-sm text-white" rows={4} maxLength={2000} value={d[f.id]} onChange={e => setD(s => ({ ...s, [f.id]: e.target.value }))} />
            </div>
          ))}
          {problems.length > 0 && <ul className="text-xs text-amber-300 list-disc pl-5">{problems.map(p => <li key={p}>{p}</li>)}</ul>}
          <div className="flex gap-2 items-center">
            <button disabled={busy || problems.length > 0} className="px-3 py-1.5 rounded-lg text-xs bg-cyan-600 text-white disabled:opacity-40 cursor-pointer" onClick={() => void save()}>บันทึก</button>
            {msg && <span role="status" className="text-xs text-slate-300">{msg}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
