/**
 * ข้อมูลครูรายบุคคลสำหรับกลุ่มผู้บริหาร (EXECUTIVE + รองผอ.งบประมาณ/บุคคล/ทั่วไป) — ฟังก์ชันล้วน ทดสอบได้
 * ทุกตัวเลขคำนวณจากเอกสารจริง ไม่มีค่าตัวอย่าง; ไม่มีข้อมูล = 0/ว่าง (ไม่เดา)
 */
import { scheduleTeacherKeys } from './scheduleSyncReplace';
import { isNonStudentSession } from '../utils/teacherLoadReportParser';
import { normalizeEmail } from './normalizeEmail';

export interface ScheduleDocLike { [k: string]: any }
export interface StaffLike {
  id: string; email: string; prefix?: string; firstName: string; lastName: string; position?: string;
  roles?: readonly string[]; status?: unknown; statusReason?: unknown;
  assignments?: { departmentId?: string; homeroomClass?: string };
}

export const staffFullName = (s: Pick<StaffLike, 'prefix' | 'firstName' | 'lastName'>) =>
  `${s.prefix || ''}${s.firstName} ${s.lastName}`.trim();

/** คีย์ที่ใช้จับคู่ schedule กับบุคลากร: staff doc id และอีเมล (ตัวพิมพ์เล็ก) */
export function staffScheduleKeys(s: Pick<StaffLike, 'id' | 'email'>): string[] {
  return [String(s.id || '').toLowerCase(), normalizeEmail(s.email || '')].filter(Boolean);
}

export interface TeachingLoad {
  /** จำนวนคาบสอนต่อสัปดาห์ (นับ วัน+คาบ ไม่ซ้ำ; ไม่รวม PLC/พักเที่ยง/ประชุม) */
  periodsPerWeek: number;
  /** จำนวนรายวิชา (รหัสวิชาไม่ซ้ำ) */
  subjects: number;
  /** จำนวนห้องเรียนที่สอน (ชั้น/ห้องไม่ซ้ำ) */
  classes: number;
}

export function teachingLoadFor(staff: Pick<StaffLike, 'id' | 'email'>, schedules: readonly ScheduleDocLike[]): TeachingLoad {
  const mine = new Set(staffScheduleKeys(staff));
  const slots = new Set<string>();
  const subjects = new Set<string>();
  const classes = new Set<string>();
  for (const sc of schedules) {
    if (!scheduleTeacherKeys(sc).some(k => mine.has(k))) continue;
    if (isNonStudentSession(String(sc.courseName || ''), String(sc.courseCode || ''), String(sc.level || sc.targetClass || ''))) continue;
    // คาบ 0 (โฮมรูม) เป็นคาบจริง — ห้ามใช้ falsy check
    const day = sc.scheduleDay, period = sc.periodNumber;
    if (day !== undefined && day !== null && period !== undefined && period !== null) slots.add(`${day}-${period}`);
    if (sc.courseCode) subjects.add(String(sc.courseCode).trim());
    const cls = String(sc.targetClass || sc.level || '').trim();
    if (cls) classes.add(cls);
  }
  return { periodsPerWeek: slots.size, subjects: subjects.size, classes: classes.size };
}

export interface TeacherRow {
  staff: StaffLike;
  name: string;
  load: TeachingLoad;
}

export function filterTeacherRows<T extends { name: string; staff: StaffLike }>(
  rows: readonly T[], opts: { query: string; departmentId: string; includeInactive: boolean },
): T[] {
  const q = opts.query.trim().toLowerCase();
  return rows.filter(r => {
    if (!opts.includeInactive && r.staff.status === 'INACTIVE') return false;
    if (opts.departmentId && (r.staff.assignments?.departmentId || '') !== opts.departmentId) return false;
    if (!q) return true;
    return r.name.toLowerCase().includes(q) || (r.staff.email || '').toLowerCase().includes(q) || (r.staff.position || '').toLowerCase().includes(q);
  });
}
