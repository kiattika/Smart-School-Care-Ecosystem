/**
 * นำเข้าบุคลากร (ไฟล์ Teacher Template): จับคู่ชื่อกลุ่มสาระฯ → รหัส `department_config` และสร้างข้อมูลที่จะเขียน
 * — ฟังก์ชันล้วน ทดสอบได้
 *
 * หลักการ:
 *  - หน้าจอทุกหน้ากรอง/แสดงกลุ่มสาระฯ ด้วย `staff.assignments.departmentId` (รหัสกลุ่ม) ไม่ใช่ข้อความชื่อ
 *    จึงต้องแปลงชื่อในไฟล์เป็นรหัสตอนนำเข้า (ไม่เดา: จับคู่ไม่ได้ = ไม่เขียนกลุ่มสาระฯ)
 *  - บุคลากรที่มี staff doc อยู่แล้ว = อัปเดตเฉพาะข้อมูลทั่วไป (คำนำหน้า/ชื่อ/ตำแหน่ง/อีเมล + กลุ่มสาระฯ ถ้าไฟล์ระบุและจับคู่ได้)
 *    ห้ามแตะ roles / assignments อื่น / status เด็ดขาด (เปลี่ยนบทบาทผ่าน assignUserRole เท่านั้น)
 *    ข้อยกเว้นเดียว: doc เดิมที่ roles ว่าง/ไม่มี → ใช้บทบาทจากไฟล์ (ไม่มีสิทธิ์เข้าระบบอยู่แล้ว ไม่มีอะไรให้เสีย)
 */

export interface DepartmentLike { id: string; name: string }

/** ตัดช่องว่าง/วงเล็บเต็มกว้าง และคำนำหน้ากลุ่ม เพื่อเทียบชื่อแบบหลวม ๆ ("กลุ่มสาระฯ ภาษาไทย" = "ภาษาไทย", "งานแนะแนว-ห้องสมุด" = "แนะแนว-ห้องสมุด") */
export function normalizeDepartmentName(raw: string): string {
  return String(raw ?? '')
    .normalize('NFC')
    .replace(/[​-‍﻿]/g, '')
    .replace(/[（]/g, '(').replace(/[）]/g, ')')
    .replace(/\s+/g, '')
    .replace(/^กลุ่มสาระการเรียนรู้/, '')
    .replace(/^กลุ่มสาระฯ?/, '')
    .replace(/^กลุ่มงาน/, '')
    .replace(/^งาน/, '')
    .replace(/^ฝ่าย/, '')
    .replace(/^กลุ่ม/, '')
    .toLowerCase();
}

/**
 * คืนรหัสกลุ่มสาระฯ จากข้อความในไฟล์ (รหัสตรง → ชื่อตรง → ชื่อหลังตัดคำนำหน้า)
 * ไม่ตรงเลย/ตรงหลายกลุ่มพร้อมกัน = '' (ไม่เดา)
 */
export function matchDepartmentId(raw: string, departments: readonly DepartmentLike[]): string {
  const text = String(raw ?? '').trim();
  if (!text) return '';
  const byId = departments.find(d => d.id === text);
  if (byId) return byId.id;
  const exact = departments.filter(d => d.name.trim() === text);
  if (exact.length === 1) return exact[0].id;
  const key = normalizeDepartmentName(text);
  if (!key) return '';
  const loose = departments.filter(d => normalizeDepartmentName(d.name) === key);
  return loose.length === 1 ? loose[0].id : '';
}

export interface ParsedStaffRow {
  teacherId: string; prefix: string; firstName: string; lastName: string; fullName: string;
  position: string; email: string; roles: string[];
  /** ข้อความกลุ่มสาระฯ ตามไฟล์ (ว่างได้) */
  department: string;
}

export interface ExistingStaffInfo { id: string; roles: readonly string[] }

export interface StaffImportWrite {
  isNew: boolean;
  /** เขียนลง `staff/{id}` ด้วย set(merge) */
  staff: Record<string, unknown>;
  /** เขียนลง `teachers/{id}` ด้วย set(merge) */
  teacher: Record<string, unknown>;
}

/**
 * `now` = ค่าเวลา (serverTimestamp) ส่งเข้ามาเพื่อให้ทดสอบได้
 * `email` ต้อง normalize แล้ว
 */
export function buildStaffImportWrite(
  row: ParsedStaffRow,
  email: string,
  departments: readonly DepartmentLike[],
  existing: ExistingStaffInfo | undefined,
  now: unknown,
): StaffImportWrite {
  const departmentId = matchDepartmentId(row.department, departments);
  const profile = {
    teacherId: row.teacherId,
    prefix: row.prefix,
    firstName: row.firstName,
    lastName: row.lastName,
    fullName: row.fullName,
    position: row.position,
    email,
    updatedAt: now,
  };

  if (!existing) {
    const base = {
      ...profile,
      id: row.teacherId,
      roles: row.roles,
      createdAt: now,
    };
    return {
      isNew: true,
      staff: {
        ...base,
        assignments: { departmentId, homeroomClass: '', teachingSubjects: [], supervisoryMentees: [] },
      },
      teacher: { ...base, departmentId },
    };
  }

  const hadNoRoles = existing.roles.length === 0;
  const rolesPart = hadNoRoles ? { roles: row.roles } : {};
  return {
    isNew: false,
    staff: {
      ...profile,
      ...rolesPart,
      // merge ระดับ field: แตะเฉพาะ assignments.departmentId — homeroomClass/teachingSubjects ฯลฯ คงเดิม
      ...(departmentId ? { assignments: { departmentId } } : {}),
    },
    teacher: { ...profile, ...(departmentId ? { departmentId } : {}) },
  };
}
