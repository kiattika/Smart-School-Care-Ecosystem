/**
 * ตัวตนของบุคลากรที่ login = `user.staffId` (custom claim `staffId`) เท่านั้น
 *
 * ฟิลด์ที่อ้างถึงบุคลากร (schedules.teacherId / teacherIds, globalCourses.teacherIds,
 * elective_activities_config.responsibleTeacherUids, department_config.backupApproverUid) เก็บ
 * **id ของ staff doc** (teacherId จากไฟล์ import) ไม่ใช่ Firebase Auth UID — เทียบกับ `user.uid` จึงไม่มีวัน
 * match สำหรับครูจริง (emulator ไม่เคยเจอเพราะ seed เดิมใช้ uid เป็น id ของ staff doc)
 *
 * กติกา: ไม่มี fallback ไป uid — ผู้ใช้ที่ไม่มี staffId (นักเรียน/ผู้ปกครอง) ต้องไม่ match อะไรเลย
 * ห้ามเขียน `.includes(user.uid)` / `=== user.uid` กับฟิลด์เหล่านี้เอง (มี guard test: staffIdentity.test.ts)
 * ฝั่ง rules ใช้ `myStaffId()` (request.auth.token.staffId) แบบเดียวกัน
 */

/** staff doc id ของผู้ใช้ที่ login — ไม่มี/ว่าง = null (ไม่ใช่บุคลากร) */
export function staffIdOf(user: { staffId?: unknown } | null | undefined): string | null {
  const id = user?.staffId;
  return typeof id === 'string' && id !== '' ? id : null;
}

/** ฟิลด์ค่าเดียว (เช่น backupApproverUid, schedules.teacherId) อ้างถึงบุคลากรคนนี้หรือไม่ */
export function isSameStaff(user: { staffId?: unknown } | null | undefined, ref: unknown): boolean {
  const id = staffIdOf(user);
  return id !== null && ref === id;
}

/** ฟิลด์ array (เช่น teacherIds, responsibleTeacherUids) มีบุคลากรคนนี้อยู่หรือไม่ */
export function isStaffIn(user: { staffId?: unknown } | null | undefined, refs: unknown): boolean {
  const id = staffIdOf(user);
  return id !== null && Array.isArray(refs) && refs.includes(id);
}

/** คาบสอน/รายวิชาที่บุคลากรคนนี้เป็นผู้สอน (ครูหลัก teacherId หรือครูร่วม teacherIds) */
export function isStaffAssigned(
  user: { staffId?: unknown } | null | undefined,
  record: { teacherId?: unknown; teacherIds?: unknown } | null | undefined,
): boolean {
  return !!record && (isSameStaff(user, record.teacherId) || isStaffIn(user, record.teacherIds));
}
