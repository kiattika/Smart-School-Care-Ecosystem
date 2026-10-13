import React, { useEffect, useState } from 'react';
import { Award, X } from 'lucide-react';
import { subscribeCourseRankLevels } from '../services/firestoreService';
import { DEFAULT_RANK_LEVELS, rankColor, rankForPoints, rankLabel, type RankLevel } from '../lib/courseRank';

export const QUICK_POINT_CHOICES = [1, 2, 5] as const;

interface Props {
  student: { studentId: string; name: string; nickname?: string; studentNumber?: number | string; avatar?: string };
  courseTitle: string;
  /** คะแนนสะสมของนักเรียนคนนี้ในวิชานี้ (ภาคเรียนปัจจุบัน) */
  currentPoints: number;
  onClose: () => void;
  /** ให้คะแนน — ต้อง throw เมื่อบันทึกไม่สำเร็จ (modal จะแสดงข้อผิดพลาดและไม่ปิด) */
  onAward: (points: number) => Promise<void>;
}

/**
 * ให้คะแนนกิจกรรมรายวิชาแบบเจาะจงรายคน: แสดงรายละเอียดนักเรียนขนาดใหญ่ เลือก +1/+2/+5 แล้วกด "ยืนยัน"
 * (ต้องยืนยันก่อนบันทึกเสมอ — ครูแก้/ลบคะแนนย้อนหลังไม่ได้ จึงกันกดพลาด)
 */
export const QuickPointAwardModal: React.FC<Props> = ({ student, courseTitle, currentPoints, onClose, onAward }) => {
  const [levels, setLevels] = useState<RankLevel[]>(DEFAULT_RANK_LEVELS);
  const [choice, setChoice] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => subscribeCourseRankLevels(setLevels), []);

  const now = rankForPoints(currentPoints, levels);
  const after = choice ? rankForPoints(currentPoints + choice, levels) : null;
  const color = rankColor(now.level.key);

  const confirm = async () => {
    if (!choice || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onAward(choice);
      onClose();
    } catch {
      setError('บันทึกคะแนนไม่สำเร็จ — ตรวจสอบสิทธิ์และการเชื่อมต่อ แล้วลองใหม่');
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`ให้คะแนนกิจกรรม ${student.name}`}
      onClick={onClose}
      data-testid="quick-point-award-modal"
    >
      <div className="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-2xl space-y-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="text-[11px] text-slate-400">ให้คะแนนกิจกรรมรายวิชา · {courseTitle}</div>
          <button onClick={onClose} aria-label="ปิด" className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex items-center gap-4">
          {student.avatar && (
            <img src={student.avatar} alt={student.name} className="w-20 h-20 rounded-full object-cover border-2 border-emerald-500/60 shrink-0" />
          )}
          <div className="min-w-0">
            <div className="text-lg font-black text-white leading-tight">{student.name}</div>
            <div className="text-sm text-slate-300 font-mono">
              เลขที่ {student.studentNumber ?? '-'}{student.nickname ? ` · ${student.nickname}` : ''}
            </div>
            <div className="text-[11px] text-slate-500 font-mono">รหัส {student.studentId}</div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-800/40 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm font-bold text-emerald-400"><Award className="w-4 h-4" /> {currentPoints} คะแนน</span>
            <span className="rounded-full px-3 py-1 text-xs font-black border" style={{ color, borderColor: color, background: `${color}1f` }}>
              {rankLabel(now.level)}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-700 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${now.progressPct}%`, background: color }} />
          </div>
          <div className="text-[11px] text-slate-400">
            {now.next ? `อีก ${now.pointsToNext} คะแนน ถึงระดับ ${rankLabel(now.next)}` : 'ถึงระดับสูงสุดแล้ว'}
          </div>
        </div>

        <div>
          <div className="text-xs font-bold text-slate-300 mb-2">เลือกคะแนนที่จะให้</div>
          <div className="grid grid-cols-3 gap-3">
            {QUICK_POINT_CHOICES.map(p => (
              <button
                key={p}
                id={`btn-quick-award-${p}`}
                onClick={() => setChoice(p)}
                aria-pressed={choice === p}
                className={`rounded-2xl border py-4 text-2xl font-black transition active:scale-95 ${
                  choice === p
                    ? 'bg-emerald-500 text-slate-950 border-emerald-300'
                    : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                }`}
              >
                +{p}
              </button>
            ))}
          </div>
          {after && after.level.key !== now.level.key && (
            <div className="mt-2 text-[11px] text-amber-300">ได้ +{choice} จะเลื่อนเป็นระดับ {rankLabel(after.level)}</div>
          )}
        </div>

        {error && <div className="text-xs text-red-400" role="alert">{error}</div>}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-xl border border-slate-700 py-3 text-sm font-bold text-slate-300 hover:bg-slate-800">ยกเลิก</button>
          <button
            id="btn-quick-award-confirm"
            onClick={confirm}
            disabled={!choice || saving}
            className="flex-1 rounded-xl bg-emerald-500 py-3 text-sm font-black text-slate-950 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'กำลังบันทึก...' : choice ? `ยืนยัน ให้ +${choice} คะแนน` : 'เลือกคะแนนก่อน'}
          </button>
        </div>
      </div>
    </div>
  );
};
