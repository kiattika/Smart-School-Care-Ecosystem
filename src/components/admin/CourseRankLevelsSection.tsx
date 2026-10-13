import React, { useEffect, useState } from 'react';
import { AlertCircle, Award, CheckCircle2, Loader2, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { useStore } from '../../store';
import { saveCourseRankLevelsFirestore, subscribeCourseRankLevels } from '../../services/firestoreService';
import { DEFAULT_RANK_LEVELS, rankColor, validateRankLevels, type RankLevel } from '../../lib/courseRank';

/**
 * ตั้งค่าระดับเครื่องหมายเชิดชูรายวิชา (แรงค์) จากคะแนนกิจกรรมสะสมของวิชานั้นตลอดภาคเรียน
 * → school_settings/course_rank_levels (เขียนได้เฉพาะ SUPER_ADMIN ตาม rules; ปุ่มปิดไว้เป็น UX)
 * ไม่ตั้งค่า/ผิดรูปแบบ = ใช้ตารางเริ่มต้นใน src/lib/courseRank.ts
 */
export function CourseRankLevelsSection() {
  const user = useStore(s => s.user);
  const canEdit = !!user?.profile?.roles?.includes('SUPER_ADMIN');
  const [saved, setSaved] = useState<RankLevel[]>(DEFAULT_RANK_LEVELS);
  const [draft, setDraft] = useState<RankLevel[]>(DEFAULT_RANK_LEVELS);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ kind: 'ok' | 'error'; message: string } | null>(null);

  useEffect(() => subscribeCourseRankLevels((levels) => {
    setSaved(levels);
    setDraft(prev => (dirty ? prev : levels));
  }), [dirty]);

  const validation = validateRankLevels(draft);
  const error = 'error' in validation ? validation.error : null;

  const edit = (i: number, patch: Partial<RankLevel>) => {
    setDirty(true);
    setResult(null);
    setDraft(d => d.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };
  const addLevel = () => {
    setDirty(true);
    setResult(null);
    setDraft(d => [...d, { key: `lv-${Date.now()}`, name: 'ระดับใหม่', division: '', minPoints: (d[d.length - 1]?.minPoints ?? 0) + 10 }]);
  };
  const removeLevel = (i: number) => {
    setDirty(true);
    setResult(null);
    setDraft(d => d.filter((_, idx) => idx !== i));
  };
  const resetDefaults = () => {
    setDirty(true);
    setResult(null);
    setDraft(DEFAULT_RANK_LEVELS);
  };

  const handleSave = async () => {
    if ('error' in validation || !canEdit) return;
    setSaving(true);
    setResult(null);
    try {
      await saveCourseRankLevelsFirestore(validation.levels, user?.uid ?? '');
      setDirty(false);
      setResult({ kind: 'ok', message: 'บันทึกแล้ว — มีผลกับหน้านักเรียนทันที (คำนวณจากคะแนนสะสมที่มีอยู่)' });
    } catch (err) {
      const code = (err as { code?: string })?.code;
      setResult({
        kind: 'error',
        message: code === 'permission-denied'
          ? 'บันทึกไม่สำเร็จ: ไม่มีสิทธิ์ (เฉพาะผู้ดูแลระบบ SUPER_ADMIN เท่านั้น)'
          : `บันทึกไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setSaving(false);
    }
  };

  const unchanged = JSON.stringify(draft) === JSON.stringify(saved);

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4" data-testid="course-rank-levels-section">
      <div>
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Award className="w-4 h-4 text-amber-400" /> เกณฑ์เครื่องหมายเชิดชูรายวิชา (แรงค์)
        </h3>
        <p className="text-[11px] text-slate-400">
          นับจากคะแนนกิจกรรมสะสมของแต่ละวิชาตลอดภาคเรียน เรียงจากต่ำไปสูง — ระดับแรกต้องเริ่มที่ 0 คะแนน และแต่ละระดับต้องมากกว่าระดับก่อนหน้า
        </p>
      </div>

      <div className="space-y-1.5">
        {draft.map((r, i) => (
          <div key={r.key} className="grid grid-cols-[1.5rem_1fr_5rem_6rem_2rem] gap-2 items-center">
            <span className="h-3 w-3 rounded-full" style={{ background: rankColor(r.key) }} />
            <input
              value={r.name}
              disabled={!canEdit}
              onChange={e => edit(i, { name: e.target.value })}
              aria-label={`ชื่อระดับที่ ${i + 1}`}
              className="rounded-lg bg-slate-800 border border-slate-700 px-2 py-1.5 text-xs text-white"
            />
            <input
              value={r.division}
              disabled={!canEdit}
              onChange={e => edit(i, { division: e.target.value })}
              placeholder="ขั้น"
              aria-label={`ขั้นย่อยที่ ${i + 1}`}
              className="rounded-lg bg-slate-800 border border-slate-700 px-2 py-1.5 text-xs text-white"
            />
            <input
              type="number"
              min={0}
              step={1}
              value={Number.isFinite(r.minPoints) ? r.minPoints : 0}
              disabled={!canEdit}
              onChange={e => edit(i, { minPoints: Math.trunc(Number(e.target.value)) })}
              aria-label={`คะแนนขั้นต่ำระดับที่ ${i + 1}`}
              className="rounded-lg bg-slate-800 border border-slate-700 px-2 py-1.5 text-xs text-white text-right"
            />
            <button
              type="button"
              disabled={!canEdit || draft.length <= 2}
              onClick={() => removeLevel(i)}
              aria-label={`ลบระดับที่ ${i + 1}`}
              className="p-1.5 text-slate-400 hover:text-red-400 disabled:opacity-30"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-amber-300"><AlertCircle className="w-3.5 h-3.5" />{error}</div>
      )}
      {result && (
        <div className={`flex items-center gap-2 text-xs ${result.kind === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>
          {result.kind === 'ok' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}{result.message}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={!canEdit} onClick={addLevel} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-200 disabled:opacity-40">
          <Plus className="w-3.5 h-3.5" /> เพิ่มระดับ
        </button>
        <button type="button" disabled={!canEdit} onClick={resetDefaults} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-200 disabled:opacity-40">
          <RotateCcw className="w-3.5 h-3.5" /> ใช้ค่าเริ่มต้น
        </button>
        <button
          type="button"
          disabled={!canEdit || saving || !!error || unchanged}
          onClick={handleSave}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} บันทึกเกณฑ์
        </button>
        {!canEdit && <span className="text-[11px] text-slate-500 self-center">แก้ไขได้เฉพาะผู้ดูแลระบบ</span>}
      </div>
    </div>
  );
}
