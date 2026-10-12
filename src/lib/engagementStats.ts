import type { ActiveLearningRecord, ActiveLearningCategory, Student } from '../types';

/**
 * สถิติ Active Learning ของผู้บริหาร — คำนวณจาก students + active_learning_logs จริงเท่านั้น
 * (ห้ามมีจำนวนนักเรียน/คะแนน/แนวโน้มตายตัวหรือสุ่ม; ไม่มีข้อมูล = 0 / ว่าง)
 */
export const GRADE_LEVELS = ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'] as const;
export type GradeLevel = (typeof GRADE_LEVELS)[number];

export const CATEGORY_LABELS: Record<ActiveLearningCategory, string> = {
  ANSWER: 'ตอบคำถาม',
  COLLABORATION: 'ทำงานกลุ่ม',
  PRESENTATION: 'นำเสนอ',
  LEADERSHIP: 'ผู้นำ/แก้ปัญหา',
  HELPING_PEERS: 'ช่วยเพื่อน',
  CREATIVITY: 'คิดสร้างสรรค์',
  GENERAL: 'ทั่วไป',
};

/** ระดับชั้นของนักเรียนจาก grade ("ม.5") หรือห้อง ("5/8", "ม.5/8") — ไม่ทราบ = null */
export function gradeOfStudent(s: Pick<Student, 'grade' | 'room'>): GradeLevel | null {
  const pick = (v?: string) => {
    const m = (v ?? '').match(/(?:ม\.?\s*)?([1-6])(?!\d)/);
    return m ? (`ม.${m[1]}` as GradeLevel) : null;
  };
  return pick(s.grade) ?? pick(s.room);
}

export interface GradeEngagement {
  grade: GradeLevel;
  students: number;
  participants: number; // นักเรียนที่ได้แต้ม > 0
  totalPoints: number;
  avgPoints: number;
  participationRate: number; // %
  byCategory: Record<ActiveLearningCategory, number>;
}

const emptyCategories = (): Record<ActiveLearningCategory, number> => ({
  ANSWER: 0, COLLABORATION: 0, PRESENTATION: 0, LEADERSHIP: 0, HELPING_PEERS: 0, CREATIVITY: 0, GENERAL: 0,
});

export function computeGradeEngagement(
  students: Pick<Student, 'studentId' | 'grade' | 'room'>[],
  logs: Pick<ActiveLearningRecord, 'studentId' | 'points' | 'category'>[],
): GradeEngagement[] {
  const gradeById = new Map<string, GradeLevel>();
  const rows = new Map<GradeLevel, GradeEngagement>();
  for (const g of GRADE_LEVELS) {
    rows.set(g, { grade: g, students: 0, participants: 0, totalPoints: 0, avgPoints: 0, participationRate: 0, byCategory: emptyCategories() });
  }
  for (const s of students) {
    const g = gradeOfStudent(s);
    if (!g) continue;
    gradeById.set(s.studentId, g);
    rows.get(g)!.students += 1;
  }
  const perStudent = new Map<string, number>();
  for (const l of logs) {
    const g = gradeById.get(l.studentId);
    if (!g || !Number.isFinite(l.points)) continue;
    const row = rows.get(g)!;
    row.totalPoints += l.points;
    const cat = l.category in row.byCategory ? l.category : 'GENERAL';
    row.byCategory[cat] += l.points;
    perStudent.set(l.studentId, (perStudent.get(l.studentId) ?? 0) + l.points);
  }
  for (const [id, pts] of perStudent) {
    if (pts > 0) rows.get(gradeById.get(id)!)!.participants += 1;
  }
  for (const row of rows.values()) {
    row.avgPoints = row.students > 0 ? Math.round((row.totalPoints / row.students) * 10) / 10 : 0;
    row.participationRate = row.students > 0 ? Math.round((row.participants / row.students) * 100) : 0;
  }
  return GRADE_LEVELS.map(g => rows.get(g)!);
}

export interface WeeklyPoint { weekStart: string; label: string; [grade: string]: number | string }

/** แต้มรวมต่อสัปดาห์ (จันทร์เริ่มต้น) ย้อนหลัง n สัปดาห์ นับจาก now แยกตามระดับชั้น */
export function computeWeeklyTrend(
  students: Pick<Student, 'studentId' | 'grade' | 'room'>[],
  logs: Pick<ActiveLearningRecord, 'studentId' | 'points' | 'awardedAt'>[],
  now: Date,
  weeks = 8,
): WeeklyPoint[] {
  const gradeById = new Map<string, GradeLevel>();
  for (const s of students) {
    const g = gradeOfStudent(s);
    if (g) gradeById.set(s.studentId, g);
  }
  const monday = (d: Date) => {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
    return x;
  };
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const thisMonday = monday(now);
  const buckets: WeeklyPoint[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(thisMonday);
    d.setDate(d.getDate() - i * 7);
    const p: WeeklyPoint = { weekStart: key(d), label: `${d.getDate()}/${d.getMonth() + 1}` };
    for (const g of GRADE_LEVELS) p[g] = 0;
    buckets.push(p);
  }
  const idx = new Map(buckets.map((b, i) => [b.weekStart, i]));
  for (const l of logs) {
    const g = gradeById.get(l.studentId);
    const t = new Date(l.awardedAt);
    if (!g || Number.isNaN(t.getTime()) || !Number.isFinite(l.points)) continue;
    const i = idx.get(key(monday(t)));
    if (i === undefined) continue;
    buckets[i][g] = (buckets[i][g] as number) + l.points;
  }
  return buckets;
}

export function engagementToCsv(rows: GradeEngagement[]): string {
  const head = ['ระดับชั้น', 'จำนวนนักเรียน', 'ผู้ได้แต้ม', 'คะแนนรวม', 'เฉลี่ยต่อคน', 'อัตราการมีส่วนร่วม(%)', ...Object.values(CATEGORY_LABELS)];
  const cats = Object.keys(CATEGORY_LABELS) as ActiveLearningCategory[];
  const lines = rows.map(r => [r.grade, r.students, r.participants, r.totalPoints, r.avgPoints, r.participationRate, ...cats.map(c => r.byCategory[c])].join(','));
  return [head.join(','), ...lines].join('\n');
}
