import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, DoorOpen, LayoutGrid, School, Users } from 'lucide-react';
import type { Course, Student } from '../../types';
import { ClassroomSeatingManager } from '../ClassroomSeatingManager';
import { listSeatingPlanItems, type SeatingPlanItem } from '../../lib/seatingPlanTargets';
import { apCandidates, resolveApRoster, type ApRosterDoc } from '../../lib/apCourses';
import { isSameRoom } from '../../lib/utils';

interface Props {
  ownStaffId: string | null;
  ownEmail?: string | null;
  /** ตารางสอนสดของภาคเรียนปัจจุบัน (จาก Firestore listener ของ TeacherPortal) */
  schedules: Record<string, any>[];
  /** นักเรียนจริงจาก Firestore listener (useRealStudents) — ห้ามอ่านจาก Zustand */
  students: Student[];
  /** รายชื่อ AP ที่ครูคัดไว้ (ไม่มี = ยังไม่ยืนยัน → ทุกห้องที่รวมกัน) */
  apRosterForCode: (code: string) => ApRosterDoc | null;
  schedulesLoading?: boolean;
}

function studentsOf(item: SeatingPlanItem, students: Student[], apRosterForCode: Props['apRosterForCode']): Student[] {
  if (item.kind === 'AP') return resolveApRoster(apCandidates(students, item.levels), apRosterForCode(item.code));
  return students.filter(s => isSameRoom(s.room, item.level) || isSameRoom((s as any).className, item.level));
}

/**
 * เมนู "จัดผังที่นั่ง" — ครูจัดผังล่วงหน้าก่อนถึงคาบสอนจริง (ไม่มีสุ่ม/เช็คชื่อ/ให้คะแนนในหน้านี้)
 * ผัง 1 ใบต่อ (ชั้น/ห้องเรียน + ห้องกายภาพ) ของครูคนนี้ ใช้ร่วมกับทุกวิชาที่สอนห้องเดียวกัน และเป็นผังเดียวกับที่เปิดในคาบสอน
 */
export function TeacherSeatingPlanner({ ownStaffId, ownEmail, schedules, students, apRosterForCode, schedulesLoading }: Props) {
  const items = useMemo(
    () => listSeatingPlanItems({ schedules, staffId: ownStaffId, staffEmail: ownEmail }),
    [schedules, ownStaffId, ownEmail],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = items.find(i => i.target.layoutId === selectedId) || null;

  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedId(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId]);

  if (!ownStaffId) {
    return <p className="text-sm text-slate-400 p-6">ไม่พบรหัสบุคลากรของบัญชีนี้ จึงยังจัดผังที่นั่งไม่ได้</p>;
  }

  if (selected) {
    const roster = studentsOf(selected, students, apRosterForCode);
    const course: Course = {
      id: `plan_${selected.target.layoutId}`,
      code: selected.code,
      name: selected.courses.map(c => c.name || c.code).join(' / '),
      // room = ชั้น/ห้องเรียน (ใช้กรองนักเรียน) เหมือนตอนเข้าคาบสอน; ห้องกายภาพอยู่ที่ physicalRoom
      room: selected.level,
      level: selected.level,
      physicalRoom: selected.physicalRoom,
      term: '',
      attendanceTaken: false,
    };
    return (
      <div className="fixed inset-0 z-[60] flex flex-col bg-slate-950 animate-in fade-in duration-200" role="dialog" aria-label="จัดผังที่นั่ง">
        <div className="flex items-center gap-3 px-4 py-2 border-b border-slate-800/80 bg-slate-900 shrink-0">
          <button
            onClick={() => setSelectedId(null)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-xs font-bold text-slate-100 hover:bg-slate-700 hover:text-slate-50 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> กลับไปรายการผัง
          </button>
          <span className="text-xs text-slate-400 truncate">{selected.label} · กด Esc เพื่อกลับ</span>
        </div>
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <ClassroomSeatingManager
            course={course}
            students={students}
            overrideStudents={selected.kind === 'AP' ? roster : undefined}
            target={selected.target}
            planMode
            onBackToDashboard={() => setSelectedId(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#161f30] border border-slate-800/80 rounded-2xl p-6 shadow-xl space-y-4 animate-in fade-in duration-300">
      <div className="border-b border-slate-800 pb-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2"><LayoutGrid className="w-5 h-5 text-indigo-400" /> จัดผังที่นั่ง</h2>
        <p className="text-xs text-slate-400 mt-1">
          จัดที่นั่งล่วงหน้าก่อนถึงคาบสอน — 1 ผังต่อชั้น/ห้องเรียน + ห้องกายภาพ ใช้ร่วมกับทุกวิชาที่คุณสอนห้องเดียวกัน
          และเป็นผังเดียวกับที่เปิดตอนเข้าคาบสอน (ในคาบยังแก้ได้) ผังเป็นของคุณคนเดียว — อยากได้เหมือนครูท่านอื่นให้ใช้ปุ่ม "คัดลอกผังจากครูท่านอื่น"
        </p>
      </div>

      {schedulesLoading && items.length === 0 && <p className="text-sm text-slate-500">กำลังโหลดตารางสอน…</p>}
      {!schedulesLoading && items.length === 0 && (
        <p className="text-sm text-slate-500 py-8 text-center">
          ยังไม่พบคาบสอนที่มีห้องเรียนของคุณในภาคเรียนปัจจุบัน — ถ้าตารางสอนไม่ครบ ให้แจ้งผู้ดูแลระบบตรวจการนำเข้าตารางภาระงานสอน
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map(item => {
          const n = studentsOf(item, students, apRosterForCode).length;
          return (
            <button
              key={item.target.layoutId}
              onClick={() => setSelectedId(item.target.layoutId)}
              className="text-left bg-slate-900/60 hover:bg-slate-800/70 border border-slate-700/60 hover:border-indigo-500/50 rounded-xl p-4 transition-colors space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-slate-100 flex items-center gap-1.5">
                  <School className="w-4 h-4 text-indigo-400" />
                  {item.kind === 'AP' ? item.levels.join(', ') : item.level}
                </span>
                <span className="text-xs text-slate-300 flex items-center gap-1">
                  <DoorOpen className="w-3.5 h-3.5 text-slate-500" />
                  {item.physicalRoom || <span className="text-slate-500">ไม่ระบุห้อง</span>}
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {item.courses.map(c => (
                  <span key={c.code} title={c.name} className="px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/30 text-[10px] font-mono text-indigo-200">
                    {c.code}
                  </span>
                ))}
                {item.kind === 'AP' && <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-[10px] font-bold text-amber-300">วิชา AP</span>}
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>{item.periods} คาบ/สัปดาห์</span>
                <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {n > 0 ? `${n} คน` : 'ยังไม่พบรายชื่อนักเรียน'}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
