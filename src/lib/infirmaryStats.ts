/**
 * สถิติงานพยาบาลทั้งโรงเรียน — ฟังก์ชันล้วนคำนวณจากข้อมูลจริงเท่านั้น (ไม่ฝังตัวเลข/ข้อมูลตัวอย่าง)
 * ข้อมูลว่าง = ผลลัพธ์ว่าง/ศูนย์ ให้ UI แสดง empty state
 */
import type { BloodDonation, StudentCheckup, StudentVaccination } from './healthRecords';

export interface VisitLike { studentId: string; visitDate: string; symptoms: string; restDurationMinutes: number; isUrgentAlert: boolean; parentAcknowledged?: boolean; parentNotifiedAt?: string }
export interface StudentLike { studentId: string; room?: string; status?: string }
export interface MovementLike { medicineName: string; unit: string; delta: number; type: string; at: string }
export interface SemesterLogLike { studentId: string; academicYear: string; term: string; bmi: number; bmiCategory: 'UNDERWEIGHT' | 'NORMAL' | 'OVERWEIGHT' | 'OBESE' }

const THAI_MONTH_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

export const ymOf = (ymd: string) => ymd.slice(0, 7);

/** n เดือนล่าสุดจนถึงเดือนของ now (เก่า→ใหม่) พร้อมจำนวนที่นับจาก dates (YYYY-MM-DD) */
export function countByMonth(dates: string[], now: Date, months = 6): Array<{ ym: string; label: string; count: number }> {
  const out: Array<{ ym: string; label: string; count: number }> = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    out.push({ ym, label: `${THAI_MONTH_SHORT[d.getMonth()]} ${String((d.getFullYear() + 543) % 100).padStart(2, '0')}`, count: 0 });
  }
  const idx = new Map(out.map((o, i) => [o.ym, i]));
  for (const date of dates) {
    const i = idx.get(ymOf(date));
    if (i !== undefined) out[i].count++;
  }
  return out;
}

export function topCounts(values: string[], n = 8): Array<{ label: string; count: number }> {
  const m = new Map<string, { label: string; count: number }>();
  for (const raw of values) {
    const label = (raw || '').trim();
    if (!label) continue;
    const key = label.toLowerCase();
    const cur = m.get(key);
    if (cur) cur.count++; else m.set(key, { label, count: 1 });
  }
  return [...m.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'th')).slice(0, n);
}

export function visitSummary(visits: VisitLike[], now: Date) {
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
  const cutoffYmd = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;
  const last30 = visits.filter(v => v.visitDate >= cutoffYmd).length;
  const rests = visits.map(v => v.restDurationMinutes).filter(n => Number.isFinite(n) && n > 0);
  return {
    total: visits.length,
    last30,
    urgent: visits.filter(v => v.isUrgentAlert).length,
    uniqueStudents: new Set(visits.map(v => v.studentId)).size,
    avgRestMinutes: rests.length ? Math.round(rests.reduce((a, b) => a + b, 0) / rests.length) : null,
  };
}

export function visitsByRoom(visits: VisitLike[], students: StudentLike[], n = 8) {
  const room = new Map(students.map(s => [s.studentId, s.room || '']));
  return topCounts(visits.map(v => room.get(v.studentId) || ''), n);
}

/** ยอดจ่ายยารวมต่อรายการ (จากรายการเคลื่อนไหวชนิด DISPENSE) */
export function dispenseTotals(movements: MovementLike[], n = 8) {
  const m = new Map<string, { label: string; unit: string; count: number }>();
  for (const mv of movements) {
    if (mv.type !== 'DISPENSE') continue;
    const qty = -mv.delta;
    if (!(qty > 0)) continue;
    const cur = m.get(mv.medicineName);
    if (cur) cur.count += qty; else m.set(mv.medicineName, { label: mv.medicineName, unit: mv.unit, count: qty });
  }
  return [...m.values()].sort((a, b) => b.count - a.count).slice(0, n);
}

/** ผลบันทึกน้ำหนัก/ส่วนสูงล่าสุดของแต่ละคน (ตามปี+ภาคเรียนล่าสุดที่มี) */
export function latestLogPerStudent<T extends SemesterLogLike>(logs: T[]): T[] {
  const best = new Map<string, T>();
  for (const l of logs) {
    const cur = best.get(l.studentId);
    if (!cur || (l.academicYear + l.term) > (cur.academicYear + cur.term)) best.set(l.studentId, l);
  }
  return [...best.values()];
}

export function bmiDistribution(logs: SemesterLogLike[], totalStudents: number) {
  const latest = latestLogPerStudent(logs);
  const counts = { UNDERWEIGHT: 0, NORMAL: 0, OVERWEIGHT: 0, OBESE: 0 };
  for (const l of latest) if (l.bmiCategory in counts) counts[l.bmiCategory]++;
  return { counts, recorded: latest.length, totalStudents, missing: Math.max(0, totalStudents - latest.length) };
}

export function bloodTypeDistribution(rows: Array<{ bloodType: string }>, totalStudents: number) {
  const counts: Record<string, number> = { A: 0, B: 0, AB: 0, O: 0 };
  for (const r of rows) if (r.bloodType in counts) counts[r.bloodType]++;
  const recorded = Object.values(counts).reduce((a, b) => a + b, 0);
  return { counts, recorded, missing: Math.max(0, totalStudents - recorded) };
}

export function donationSummary(donations: BloodDonation[], now: Date) {
  const donorKey = (d: BloodDonation) => (d.subjectType === 'STUDENT' ? `S:${d.studentId}` : `T:${d.staffId}`);
  return {
    total: donations.length,
    students: donations.filter(d => d.subjectType === 'STUDENT').length,
    staff: donations.filter(d => d.subjectType === 'STAFF').length,
    donors: new Set(donations.map(donorKey)).size,
    byMonth: countByMonth(donations.map(d => d.donatedAt), now, 12),
  };
}

export function checkupCoverage(checkups: StudentCheckup[], totalStudents: number) {
  const examined = new Set(checkups.map(c => c.studentId)).size;
  return {
    examined,
    notExamined: Math.max(0, totalStudents - examined),
    visionAbnormal: checkups.filter(c => c.visionResult === 'ABNORMAL').length,
    hearingAbnormal: checkups.filter(c => c.hearingResult === 'ABNORMAL').length,
  };
}

export function vaccineCounts(vaccinations: StudentVaccination[], n = 8) {
  return topCounts(vaccinations.map(v => v.vaccine), n);
}
