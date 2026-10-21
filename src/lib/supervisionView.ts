/**
 * ตรรกะฝั่งหน้าจอของระบบนิเทศ (pure — ทดสอบได้) ต่อยอดจาก src/lib/supervision.ts
 */
import { isStaffActive } from './staffStatus';
import { hasExecutiveRole } from './executiveRoles';
import type { ObservationQuery } from '../services/supervisionService';
import {
  canObserve, isExOfficioSupervisor,
  type SupervisionObservation, type SupervisionAssignment,
} from './supervision';

export interface StaffRow {
  id: string;
  prefix?: string;
  firstName?: string;
  lastName?: string;
  roles?: readonly string[];
  status?: unknown;
  assignments?: { departmentId?: string } | null;
}

export const staffFullName = (s: Pick<StaffRow, 'prefix' | 'firstName' | 'lastName'> | null | undefined) =>
  s ? `${s.prefix || ''}${s.firstName || ''} ${s.lastName || ''}`.trim() : '';

export const staffDepartmentId = (s: StaffRow | null | undefined) => s?.assignments?.departmentId || '';

/** ผู้รับการนิเทศ = บุคลากรที่ยังใช้งานและเป็นครูผู้สอน */
export const isObservableTeacher = (s: StaffRow) => isStaffActive(s) && !!s.roles?.includes('SUBJECT_TEACHER');

export type ObsStatus = 'NONE' | 'DRAFT' | 'SUBMITTED' | 'ACKNOWLEDGED';

export const OBS_STATUS_LABEL: Record<ObsStatus, string> = {
  NONE: 'ยังไม่นิเทศ',
  DRAFT: 'ฉบับร่าง',
  SUBMITTED: 'ส่งผลแล้ว (รอครูรับทราบ)',
  ACKNOWLEDGED: 'ครูรับทราบแล้ว',
};

export function observationStatus(o: Pick<SupervisionObservation, 'submitted' | 'acknowledged'> | null | undefined): ObsStatus {
  if (!o) return 'NONE';
  if (!o.submitted) return 'DRAFT';
  return o.acknowledged ? 'ACKNOWLEDGED' : 'SUBMITTED';
}

/**
 * ครูที่ผู้นิเทศ `me` ลงนิเทศได้ในรอบนี้: ที่ถูกจับคู่ + (หัวหน้า/รองหัวหน้ากลุ่มสาระฯ) ครูในกลุ่มสาระฯ เดียวกัน
 * ไม่รวมตัวเอง/คนที่ปิดการใช้งาน/คนที่ไม่ใช่ครูผู้สอน
 */
export function observableTeachers(
  me: { staffId: string; roles: readonly string[]; departmentId?: string },
  staff: readonly StaffRow[],
  assignments: readonly Pick<SupervisionAssignment, 'teacherStaffId' | 'supervisorStaffId'>[],
): StaffRow[] {
  const assigned = assignments.filter(a => a.supervisorStaffId === me.staffId).map(a => a.teacherStaffId);
  return staff.filter(t =>
    isObservableTeacher(t)
    && canObserve(me, { staffId: t.id, departmentId: staffDepartmentId(t) }, assigned));
}

/** ผู้นิเทศของครูคนนี้ในรอบ: ผู้ที่ถูกจับคู่ + หัวหน้า/รองหัวหน้ากลุ่มสาระฯ ของกลุ่มสาระฯ นั้น (ไม่ซ้ำ ไม่รวมตัวครูเอง) */
export function supervisorsOf(
  teacher: StaffRow,
  staff: readonly StaffRow[],
  assignments: readonly Pick<SupervisionAssignment, 'teacherStaffId' | 'supervisorStaffId'>[],
): { staff: StaffRow; basis: 'ASSIGNED' | 'EX_OFFICIO' }[] {
  const out = new Map<string, { staff: StaffRow; basis: 'ASSIGNED' | 'EX_OFFICIO' }>();
  const dept = staffDepartmentId(teacher);
  for (const s of staff) {
    if (s.id === teacher.id || !isStaffActive(s)) continue;
    if (dept && isExOfficioSupervisor(s.roles) && staffDepartmentId(s) === dept) out.set(s.id, { staff: s, basis: 'EX_OFFICIO' });
  }
  for (const a of assignments) {
    if (a.teacherStaffId !== teacher.id) continue;
    const s = staff.find(x => x.id === a.supervisorStaffId);
    if (s && !out.has(s.id)) out.set(s.id, { staff: s, basis: 'ASSIGNED' });
  }
  return [...out.values()];
}

/** จำนวนครูที่ยังไม่ถูกนิเทศ/ร่าง/ส่งแล้ว ในรายการครูที่ต้องนิเทศ — ใช้แสดงความคืบหน้า */
export function progressCounts(
  teachers: readonly { id: string }[],
  observations: readonly Pick<SupervisionObservation, 'teacherStaffId' | 'submitted' | 'acknowledged'>[],
): Record<ObsStatus, number> & { total: number } {
  const byTeacher = new Map(observations.map(o => [o.teacherStaffId, o]));
  const counts = { NONE: 0, DRAFT: 0, SUBMITTED: 0, ACKNOWLEDGED: 0, total: teachers.length };
  for (const t of teachers) counts[observationStatus(byTeacher.get(t.id))] += 1;
  return counts;
}

/**
 * query ผลรายบุคคลที่ผู้ใช้ "เห็นได้" ตามสิทธิ์ (ต้องตรงเงื่อนไขใน firestore.rules)
 * - หัวหน้างานนิเทศ: ทั้งหมดรวมฉบับร่าง; ผอ./รองผอ.ฝ่ายวิชาการ: ทั้งหมดเฉพาะที่ส่งแล้ว
 * - หัวหน้า/รองหัวหน้ากลุ่มสาระฯ: เฉพาะกลุ่มสาระฯ ตนเอง (ที่ส่งแล้ว) — ถ้าเป็นครูนิเทศด้วย ผลที่ตนนิเทศเองดูได้ในแท็บ "ลงนิเทศ"
 * - ครูนิเทศ: เฉพาะที่ตนเองนิเทศ
 * กลุ่มผู้บริหาร (EXECUTIVE + รองผอ.งบประมาณ/บุคคล/ทั่วไป) ไม่ใช้ query นี้ — ดูรายบุคคลในหน้า "ข้อมูลครูรายบุคคล" ของ ExecutivePortal ผ่าน overviewQuery — null
 */
export function resultsQuery(
  roles: readonly string[],
  staffId: string,
  departmentId: string,
): ObservationQuery | null {
  if (roles.includes('INSTRUCTIONAL_SUPERVISOR')) return { scope: 'ALL', submittedOnly: false };
  if (roles.includes('DIRECTOR') || roles.includes('DEPUTY_DIRECTOR_ACADEMIC')) return { scope: 'ALL', submittedOnly: true };
  if (isExOfficioSupervisor(roles) && departmentId) return { scope: 'DEPARTMENT', departmentId };
  if (staffId && roles.includes('SUPERVISORY_TEACHER')) return { scope: 'SUPERVISED', staffId };
  return null;
}

/** query สำหรับภาพรวม (ไม่แสดงชื่อ): ผู้ที่อ่านทั้งโรงเรียนได้ */
export function overviewQuery(roles: readonly string[]): ObservationQuery | null {
  if (roles.includes('INSTRUCTIONAL_SUPERVISOR')) return { scope: 'ALL', submittedOnly: false };
  if (roles.includes('DIRECTOR') || roles.includes('DEPUTY_DIRECTOR_ACADEMIC') || hasExecutiveRole(roles)) {
    return { scope: 'ALL', submittedOnly: true };
  }
  return null;
}
