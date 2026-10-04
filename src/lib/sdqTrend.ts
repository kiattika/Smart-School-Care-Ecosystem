import {
  SDQ_SUBSCALES,
  SdqEvaluatorType,
  SdqScores,
  SdqSubscaleKey,
  SdqStrengthStatus,
  SdqTriage,
  isLegacySdqCriteria,
  isValidAcademicYear,
} from './sdq';

/**
 * แนวโน้ม SDQ ข้ามปีการศึกษา (GuidancePortal แท็บ SDQ) — pure ทดสอบได้ (src/__tests__/sdqTrend.test.ts)
 *
 * - หน่วยข้อมูล = ผลประเมิน 1 ชุดต่อ (นักเรียน, ผู้ประเมิน, ปี) — ถ้ามีซ้ำ (ผู้ดูแลระบบสร้างเพิ่ม) ใช้ชุดที่ assessmentDate ล่าสุด
 * - ค่าเฉลี่ย = เฉลี่ยของชุดเหล่านั้นต่อปี; ไม่มี academicYear (ข้อมูลก่อนมีระบบปีการศึกษา) นับแยกเป็น legacyCount
 *   ไม่เอาไปปนกับปีใดปีหนึ่ง
 * - ปีแรกที่เริ่มใช้ระบบมีปีเดียว = กราฟแนวโน้มว่าง (hasTrend false) ไม่ error
 */

export interface SdqTrendRecord {
  studentId: string;
  evaluatorType: SdqEvaluatorType;
  academicYear?: string | null;
  assessmentDate?: string;
  subscaleScores: SdqScores;
  totalDifficultiesScore: number;
  triagingStatus: SdqTriage;
  /** สถานะรายด้าน + เวอร์ชันเกณฑ์ — ไม่มี = ข้อมูลเก่าที่คำนวณด้วยเกณฑ์เดิม */
  subscaleStatus?: Partial<Record<SdqSubscaleKey, SdqTriage | SdqStrengthStatus>>;
  criteriaVersion?: string | null;
  /** ส่วนที่ 2 (ผลกระทบ) — คนละมิติกับ triagingStatus/subscaleStatus; ไม่มี = ข้อมูลเก่า */
  impactTotalScore?: number;
  impactTriage?: SdqTriage;
  impactDurationMonths?: string;
}

/** สรุปผลกระทบ (ส่วนที่ 2) ต่อปี — นับเฉพาะชุดที่มีข้อมูลผลกระทบ */
export interface SdqImpactYearStat {
  responses: number;
  averageTotal: number;
  triage: Record<SdqTriage, number>;
}

export interface SdqYearStat {
  year: string;
  /** จำนวนผลประเมิน (หลัง dedupe) / จำนวนนักเรียนที่ไม่ซ้ำ */
  responses: number;
  students: number;
  averages: Record<SdqSubscaleKey, number>;
  totalAverage: number;
  triage: Record<SdqTriage, number>;
  /** จำนวนผลประเมินในปีนี้ที่สถานะ (triage) คำนวณด้วยเกณฑ์เดิม — ค่าคะแนนรายด้านและค่าเฉลี่ยไม่เกี่ยวกับเกณฑ์ */
  legacyCriteria: number;
  /** ผลกระทบ (หน้าหลัง) — null = ปีนี้ไม่มีชุดที่มีข้อมูลผลกระทบ (เช่น ข้อมูลเก่า) */
  impact: SdqImpactYearStat | null;
}

export interface SdqTrend {
  /** ปีที่นำมาเทียบ (ล่าสุด maxYears ปี เรียงจากเก่าไปใหม่) */
  years: SdqYearStat[];
  /** มีข้อมูลตั้งแต่ 2 ปีขึ้นไป = วาดกราฟแนวโน้มได้ */
  hasTrend: boolean;
  /** ทุกปีที่มีข้อมูล (ใหม่ → เก่า) ใช้เป็นตัวเลือกดูย้อนหลัง */
  availableYears: string[];
  /** จำนวนผลประเมินที่ไม่มีปีการศึกษา (ไม่นับในปีใด) */
  legacyCount: number;
  /** ผลต่างปีล่าสุดเทียบปีก่อนหน้า (null = ยังเทียบไม่ได้) */
  delta: { averages: Record<SdqSubscaleKey, number>; totalAverage: number; impactAverageTotal: number | null } | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const emptySubscales = (): Record<SdqSubscaleKey, number> => ({ emotional: 0, conduct: 0, hyperactivity: 0, peerProblems: 0, prosocial: 0 });

export function sortYearsAsc(years: string[]): string[] {
  return [...years].sort((a, b) => Number(a) - Number(b));
}

export function buildSdqTrend(
  records: readonly SdqTrendRecord[],
  opts: { evaluatorType?: SdqEvaluatorType | 'ALL'; maxYears?: number } = {},
): SdqTrend {
  const evaluatorType = opts.evaluatorType ?? 'ALL';
  const maxYears = Math.max(1, opts.maxYears ?? 3);

  let legacyCount = 0;
  // dedupe: (student, evaluator, year) → ชุดที่ assessmentDate ล่าสุด
  const latest = new Map<string, SdqTrendRecord>();
  for (const r of records) {
    if (evaluatorType !== 'ALL' && r.evaluatorType !== evaluatorType) continue;
    if (!isValidAcademicYear(r.academicYear)) { legacyCount++; continue; }
    const key = `${r.studentId}|${r.evaluatorType}|${r.academicYear}`;
    const prev = latest.get(key);
    if (!prev || (r.assessmentDate ?? '') >= (prev.assessmentDate ?? '')) latest.set(key, r);
  }

  const byYear = new Map<string, SdqTrendRecord[]>();
  for (const r of latest.values()) {
    const y = r.academicYear as string;
    byYear.set(y, [...(byYear.get(y) ?? []), r]);
  }

  const allYearsAsc = sortYearsAsc([...byYear.keys()]);
  const stats: SdqYearStat[] = allYearsAsc.slice(-maxYears).map((year) => {
    const rows = byYear.get(year) as SdqTrendRecord[];
    const sums = emptySubscales();
    let totalSum = 0;
    const triage: Record<SdqTriage, number> = { NORMAL: 0, AT_RISK: 0, VULNERABLE: 0 };
    let legacyCriteria = 0;
    const impactTriage: Record<SdqTriage, number> = { NORMAL: 0, AT_RISK: 0, VULNERABLE: 0 };
    let impactSum = 0;
    let impactCount = 0;
    for (const r of rows) {
      if (isLegacySdqCriteria(r)) legacyCriteria++;
      if (r.impactTotalScore !== undefined && r.impactTriage !== undefined) {
        impactSum += r.impactTotalScore;
        impactTriage[r.impactTriage]++;
        impactCount++;
      }
      for (const { key } of SDQ_SUBSCALES) sums[key] += r.subscaleScores[key];
      totalSum += r.totalDifficultiesScore;
      triage[r.triagingStatus]++;
    }
    const averages = emptySubscales();
    for (const { key } of SDQ_SUBSCALES) averages[key] = round2(sums[key] / rows.length);
    return {
      year,
      responses: rows.length,
      students: new Set(rows.map((r) => r.studentId)).size,
      averages,
      totalAverage: round2(totalSum / rows.length),
      triage,
      legacyCriteria,
      impact: impactCount > 0 ? { responses: impactCount, averageTotal: round2(impactSum / impactCount), triage: impactTriage } : null,
    };
  });

  let delta: SdqTrend['delta'] = null;
  if (stats.length >= 2) {
    const prev = stats[stats.length - 2];
    const last = stats[stats.length - 1];
    const averages = emptySubscales();
    for (const { key } of SDQ_SUBSCALES) averages[key] = round2(last.averages[key] - prev.averages[key]);
    delta = {
      averages,
      totalAverage: round2(last.totalAverage - prev.totalAverage),
      impactAverageTotal: prev.impact && last.impact ? round2(last.impact.averageTotal - prev.impact.averageTotal) : null,
    };
  }

  return {
    years: stats,
    hasTrend: stats.length >= 2,
    availableYears: [...allYearsAsc].reverse(),
    legacyCount,
    delta,
  };
}

/** กรองผลประเมินตามปี — 'ALL' = ทุกปี, 'LEGACY' = ที่ไม่มีปีการศึกษา, ไม่งั้นเฉพาะปีนั้น */
export function filterSdqByYear<T extends { academicYear?: string | null }>(records: readonly T[], year: string): T[] {
  if (year === 'ALL') return [...records];
  if (year === 'LEGACY') return records.filter((r) => !isValidAcademicYear(r.academicYear));
  return records.filter((r) => r.academicYear === year);
}

/**
 * สถานะการกรอกของนักเรียนทั้งห้องในปีหนึ่ง (หน้าครูที่ปรึกษา): ใครกรอกแล้ว/ยัง ในแต่ละผู้ประเมิน
 * ผลประเมินของนักเรียนที่ไม่อยู่ในรายชื่อห้องไม่นับ
 */
export interface SdqRoomStatusRow {
  studentId: string;
  byEvaluator: Record<SdqEvaluatorType, boolean>;
  /** ผลของครูที่ปรึกษา (ถ้ากรอกแล้ว) — รวมสถานะรายด้านและเวอร์ชันเกณฑ์ ใช้แสดงผ่าน SdqStatusView */
  teacherResult: Pick<SdqTrendRecord, 'totalDifficultiesScore' | 'triagingStatus' | 'subscaleStatus' | 'criteriaVersion' | 'impactTotalScore' | 'impactTriage' | 'impactDurationMonths'> | null;
}

export function buildSdqRoomStatus(
  studentIds: readonly string[],
  records: readonly Pick<SdqTrendRecord, 'studentId' | 'evaluatorType' | 'academicYear' | 'totalDifficultiesScore' | 'triagingStatus' | 'subscaleStatus' | 'criteriaVersion' | 'impactTotalScore' | 'impactTriage' | 'impactDurationMonths'>[],
  academicYear: string,
): { rows: SdqRoomStatusRow[]; teacherDone: number; total: number } {
  const rows: SdqRoomStatusRow[] = studentIds.map((studentId) => ({
    studentId,
    byEvaluator: { STUDENT: false, TEACHER: false, PARENT: false },
    teacherResult: null,
  }));
  const index = new Map(rows.map((r) => [r.studentId, r]));
  for (const rec of records) {
    if (rec.academicYear !== academicYear) continue;
    const row = index.get(rec.studentId);
    if (!row) continue;
    row.byEvaluator[rec.evaluatorType] = true;
    if (rec.evaluatorType === 'TEACHER') {
      row.teacherResult = {
        totalDifficultiesScore: rec.totalDifficultiesScore,
        triagingStatus: rec.triagingStatus,
        subscaleStatus: rec.subscaleStatus,
        criteriaVersion: rec.criteriaVersion,
        impactTotalScore: rec.impactTotalScore,
        impactTriage: rec.impactTriage,
        impactDurationMonths: rec.impactDurationMonths,
      };
    }
  }
  return { rows, teacherDone: rows.filter((r) => r.byEvaluator.TEACHER).length, total: rows.length };
}
