import type { ActiveLearningRecord } from '../types';

/**
 * คะแนนกิจกรรมรายวิชา + เครื่องหมายเชิดชู (แรงค์) รายวิชา
 *
 * - คะแนนมาจากกิจกรรมในคาบ (สุ่มตอบคำถาม/ทำงานกลุ่ม ฯลฯ +1/+2/+5) เก็บที่ active_learning_logs "ต่อวิชา"
 *   ครูผู้สอนวิชานั้นใช้ประกอบคะแนนจิตพิสัย/มอบเครื่องหมายเชิดชู — **ไม่ใช่คะแนนความประพฤติ**
 *   (ห้ามเรียกซ้ำ/ห้ามเขียนลง students.behaviorScore)
 * - แรงค์คิดจาก "คะแนนสะสมของวิชานั้นตลอดภาคเรียน" เทียบกับตารางระดับ (แอดมินแก้ได้ที่ school_settings/course_rank_levels)
 * - ตารางเริ่มต้นเทียบเคียงลำดับขั้นของเกมแข่งขันยอดนิยม แต่ปรับชื่อสูงสุดให้เป็นศัพท์การเรียน
 */
export interface RankLevel {
  /** รหัสคงที่ (ใช้เป็น key / ไม่เปลี่ยนเมื่อแก้ชื่อ) */
  key: string;
  /** ชื่อระดับหลัก เช่น "บรอนซ์" */
  name: string;
  /** ขั้นย่อย เช่น "III" — ว่างได้ (ระดับสูงสุดไม่มีขั้นย่อย) */
  division: string;
  /** คะแนนสะสมขั้นต่ำของวิชาเพื่อถึงระดับนี้ */
  minPoints: number;
}

export const DEFAULT_RANK_LEVELS: RankLevel[] = [
  { key: 'bronze-3', name: 'บรอนซ์', division: 'III', minPoints: 0 },
  { key: 'bronze-2', name: 'บรอนซ์', division: 'II', minPoints: 3 },
  { key: 'bronze-1', name: 'บรอนซ์', division: 'I', minPoints: 6 },
  { key: 'silver-3', name: 'ซิลเวอร์', division: 'III', minPoints: 10 },
  { key: 'silver-2', name: 'ซิลเวอร์', division: 'II', minPoints: 14 },
  { key: 'silver-1', name: 'ซิลเวอร์', division: 'I', minPoints: 18 },
  { key: 'gold-4', name: 'โกลด์', division: 'IV', minPoints: 23 },
  { key: 'gold-3', name: 'โกลด์', division: 'III', minPoints: 28 },
  { key: 'gold-2', name: 'โกลด์', division: 'II', minPoints: 33 },
  { key: 'gold-1', name: 'โกลด์', division: 'I', minPoints: 38 },
  { key: 'platinum-4', name: 'แพลตตินัม', division: 'IV', minPoints: 44 },
  { key: 'platinum-3', name: 'แพลตตินัม', division: 'III', minPoints: 50 },
  { key: 'platinum-2', name: 'แพลตตินัม', division: 'II', minPoints: 56 },
  { key: 'platinum-1', name: 'แพลตตินัม', division: 'I', minPoints: 62 },
  { key: 'diamond-5', name: 'ไดมอนด์', division: 'V', minPoints: 69 },
  { key: 'diamond-4', name: 'ไดมอนด์', division: 'IV', minPoints: 76 },
  { key: 'diamond-3', name: 'ไดมอนด์', division: 'III', minPoints: 83 },
  { key: 'diamond-2', name: 'ไดมอนด์', division: 'II', minPoints: 90 },
  { key: 'diamond-1', name: 'ไดมอนด์', division: 'I', minPoints: 97 },
  { key: 'scholar', name: 'ปราชญ์', division: '', minPoints: 105 },
  { key: 'sage', name: 'ยอดเมธี', division: '', minPoints: 130 },
  { key: 'supreme-sage', name: 'เมธีเอก', division: '', minPoints: 160 },
  { key: 'immortal-sage', name: 'เมธีอมตะ', division: '', minPoints: 200 },
];

export function rankLabel(level: Pick<RankLevel, 'name' | 'division'>): string {
  return level.division ? `${level.name} ${level.division}` : level.name;
}

/** สีประจำระดับหลัก (ตามชื่อคีย์ก่อนขีด) — ใช้ตกแต่งป้ายเท่านั้น */
export function rankColor(key: string): string {
  const base = key.split('-')[0];
  switch (base) {
    case 'bronze': return '#b45309';
    case 'silver': return '#94a3b8';
    case 'gold': return '#f59e0b';
    case 'platinum': return '#22d3ee';
    case 'diamond': return '#60a5fa';
    case 'scholar': return '#a78bfa';
    case 'sage': return '#f472b6';
    case 'supreme': return '#fb7185';
    case 'immortal': return '#facc15';
    default: return '#6366f1';
  }
}

export type RankLevelsValidation = { ok: true; levels: RankLevel[] } | { ok: false; error: string };

/** ตรวจตารางระดับที่แอดมินกรอก — ต้องมีอย่างน้อย 2 ระดับ, ชื่อไม่ว่าง, คะแนนเป็นจำนวนเต็ม ≥ 0, ระดับแรก = 0, เรียงจากน้อยไปมากแบบเข้มงวด */
export function validateRankLevels(input: unknown): RankLevelsValidation {
  if (!Array.isArray(input) || input.length < 2) return { ok: false, error: 'ต้องมีอย่างน้อย 2 ระดับ' };
  if (input.length > 40) return { ok: false, error: 'มีได้ไม่เกิน 40 ระดับ' };
  const levels: RankLevel[] = [];
  const keys = new Set<string>();
  for (let i = 0; i < input.length; i++) {
    const r = input[i] as Partial<RankLevel> | null;
    const name = typeof r?.name === 'string' ? r.name.trim() : '';
    const division = typeof r?.division === 'string' ? r.division.trim() : '';
    const key = typeof r?.key === 'string' && r.key.trim() ? r.key.trim() : `lv-${i + 1}`;
    const minPoints = r?.minPoints;
    if (!name || name.length > 30) return { ok: false, error: `ระดับที่ ${i + 1}: ชื่อต้องไม่ว่างและไม่เกิน 30 ตัวอักษร` };
    if (division.length > 10) return { ok: false, error: `ระดับที่ ${i + 1}: ขั้นย่อยต้องไม่เกิน 10 ตัวอักษร` };
    if (typeof minPoints !== 'number' || !Number.isInteger(minPoints) || minPoints < 0 || minPoints > 100000) {
      return { ok: false, error: `ระดับที่ ${i + 1}: คะแนนต้องเป็นจำนวนเต็ม 0 ขึ้นไป` };
    }
    if (keys.has(key)) return { ok: false, error: `ระดับที่ ${i + 1}: รหัสซ้ำ` };
    keys.add(key);
    levels.push({ key, name, division, minPoints });
  }
  if (levels[0].minPoints !== 0) return { ok: false, error: 'ระดับแรกต้องเริ่มที่ 0 คะแนน' };
  for (let i = 1; i < levels.length; i++) {
    if (levels[i].minPoints <= levels[i - 1].minPoints) {
      return { ok: false, error: `ระดับที่ ${i + 1}: คะแนนต้องมากกว่าระดับก่อนหน้า` };
    }
  }
  return { ok: true, levels };
}

/** ค่าจาก Firestore → ตารางที่ใช้ได้; ไม่มี/ผิดรูปแบบ = ค่าเริ่มต้น (ไม่ throw) */
export function resolveRankLevels(stored: unknown): RankLevel[] {
  const v = validateRankLevels(stored);
  return v.ok ? v.levels : DEFAULT_RANK_LEVELS;
}

export interface RankResult {
  level: RankLevel;
  index: number;
  next: RankLevel | null;
  /** คะแนนที่ยังต้องการเพื่อขึ้นระดับถัดไป (0 เมื่อสูงสุดแล้ว) */
  pointsToNext: number;
  /** 0-100 ความคืบหน้าในระดับปัจจุบันไประดับถัดไป (สูงสุดแล้ว = 100) */
  progressPct: number;
}

export function rankForPoints(points: number, levels: RankLevel[] = DEFAULT_RANK_LEVELS): RankResult {
  const p = Math.max(0, Math.floor(Number.isFinite(points) ? points : 0));
  let index = 0;
  for (let i = 0; i < levels.length; i++) {
    if (p >= levels[i].minPoints) index = i;
  }
  const level = levels[index];
  const next = levels[index + 1] ?? null;
  if (!next) return { level, index, next: null, pointsToNext: 0, progressPct: 100 };
  const span = next.minPoints - level.minPoints;
  const into = p - level.minPoints;
  return { level, index, next, pointsToNext: next.minPoints - p, progressPct: Math.round((into / span) * 100) };
}

/** ภาคเรียนจากวันที่ (พ.ค.–ต.ค. = 1, ที่เหลือ = 2; ม.ค.–เม.ย. นับเป็นปีการศึกษาก่อนหน้า) — เหมือน useCurrentSemester */
export function termOfDate(iso: string): { academicYear: string; term: '1' | '2' } | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const month = d.getMonth() + 1;
  const term: '1' | '2' = month >= 5 && month <= 10 ? '1' : '2';
  const greg = month <= 4 ? d.getFullYear() - 1 : d.getFullYear();
  return { academicYear: String(greg + 543), term };
}

export interface CoursePointsSummary {
  courseId: string;
  courseName: string;
  points: number;
  rank: RankResult;
}

/**
 * รวมคะแนนต่อวิชาของนักเรียนคนเดียวในภาคเรียนที่ระบุ (log รุ่นเก่าไม่มี academicYear/term = ดูจากวันที่ให้คะแนน)
 * log ที่ไม่มี courseId จัดเป็น "ไม่ระบุวิชา" ไม่เดาวิชาให้
 */
export function summarizeCoursePoints(
  logs: ActiveLearningRecord[],
  term: { academicYear: string; term: '1' | '2' },
  levels: RankLevel[] = DEFAULT_RANK_LEVELS,
): CoursePointsSummary[] {
  const byCourse = new Map<string, { name: string; points: number }>();
  for (const log of logs) {
    const t = log.academicYear && log.term ? { academicYear: log.academicYear, term: log.term } : termOfDate(log.awardedAt);
    if (!t || t.academicYear !== term.academicYear || t.term !== term.term) continue;
    const id = log.courseId || '__none__';
    const cur = byCourse.get(id) ?? { name: log.courseName || (log.courseId ? log.courseId : 'ไม่ระบุวิชา'), points: 0 };
    if (log.courseName) cur.name = log.courseName;
    cur.points += Number(log.points || 0);
    byCourse.set(id, cur);
  }
  return Array.from(byCourse.entries())
    .map(([courseId, v]) => {
      const points = Math.max(0, v.points);
      return { courseId, courseName: v.name, points, rank: rankForPoints(points, levels) };
    })
    .sort((a, b) => b.points - a.points || a.courseName.localeCompare(b.courseName, 'th'));
}
