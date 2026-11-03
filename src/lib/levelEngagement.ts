import type { ActiveLearningRecord } from '../types';
import { logTerm } from './courseRank';

export interface LevelEngagement {
  grade: string;        // เช่น "ม.5"
  students: number;     // นักเรียนทั้งหมดในระดับชั้น (ทะเบียนจริง)
  avgPts: number;       // คะแนนกิจกรรมเฉลี่ยต่อคน (ภาคเรียนที่ระบุ)
  participation: number; // ร้อยละของนักเรียนที่ได้คะแนนกิจกรรม > 0
}

/** ระดับชั้นจากชื่อห้อง "ม.5/8" / "M.5/8" → "ม.5" (ไม่รู้จัก = ''), */
export function levelOfRoom(room?: string): string {
  const m = String(room || '').trim().match(/^(?:ม\.?|M\.?)\s*(\d)\s*\//i);
  return m ? `ม.${m[1]}` : '';
}

/**
 * คะแนน Active Learning รายระดับชั้น จากข้อมูลจริง: คะแนนสะสมต่อนักเรียน (ทุกวิชารวมกัน ภาคเรียนที่ระบุ, ไม่ต่ำกว่า 0)
 * ÷ จำนวนนักเรียนในระดับชั้นตามทะเบียน — ระดับที่ไม่มีนักเรียนไม่แสดง (ไม่แต่งตัวเลข)
 */
export function levelEngagement(
  logs: ActiveLearningRecord[],
  students: { studentId: string; room?: string }[],
  term: { academicYear: string; term: '1' | '2' },
): LevelEngagement[] {
  const levelOf = new Map<string, string>();
  const count = new Map<string, number>();
  for (const s of students) {
    const lv = levelOfRoom(s.room);
    if (!lv) continue;
    levelOf.set(s.studentId, lv);
    count.set(lv, (count.get(lv) || 0) + 1);
  }
  const perStudent = new Map<string, number>();
  for (const log of logs) {
    const t = logTerm(log);
    if (!t || t.academicYear !== term.academicYear || t.term !== term.term) continue;
    perStudent.set(log.studentId, (perStudent.get(log.studentId) || 0) + Number(log.points || 0));
  }
  const sum = new Map<string, number>();
  const active = new Map<string, number>();
  for (const [sid, pts] of perStudent) {
    const lv = levelOf.get(sid);
    if (!lv) continue;
    const v = Math.max(0, pts);
    sum.set(lv, (sum.get(lv) || 0) + v);
    if (v > 0) active.set(lv, (active.get(lv) || 0) + 1);
  }
  return Array.from(count, ([grade, n]) => ({
    grade,
    students: n,
    avgPts: Math.round(((sum.get(grade) || 0) / n) * 10) / 10,
    participation: Math.round(((active.get(grade) || 0) / n) * 100),
  })).sort((a, b) => a.grade.localeCompare(b.grade, 'th'));
}
