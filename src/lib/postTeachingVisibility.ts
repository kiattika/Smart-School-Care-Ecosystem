/**
 * การมองเห็น "ประวัติบันทึกหลังสอน" ของครู
 *
 * เดิมเห็นเฉพาะบันทึกของคาบที่ตัวเองสอนอยู่ในปัจจุบัน (courseId อยู่ใน myCourses) → เมื่อเปลี่ยนครูในคาบเดิม
 * ครูคนเก่าเสียประวัติของตัวเองไปทั้งหมด ครูใหม่เห็นแทนโดยไม่รู้ว่าใครเขียน
 *
 * กติกาใหม่:
 *  - เห็นได้ถ้า: คาบนั้นเป็นของตัวเองตอนนี้ (ครูคนใหม่เห็นว่าครูคนเดิมสอนอะไรไว้ถึงไหนแล้ว)
 *    หรือ ตัวเองเป็นผู้บันทึก (recordedByStaffId) หรือ ถูกประทับเป็นครูคนเดิมของบันทึกนั้น (previousTeacherStaffIds)
 *  - ตัวตนเทียบด้วย staff id ผ่าน staffIdentity เท่านั้น (ห้ามเทียบ uid)
 */
import { isSameStaff, isStaffIn } from './staffIdentity';

type UserLike = { staffId?: unknown } | null | undefined;
type RecordLike = {
  courseId?: string;
  recordedByStaffId?: string;
  recordedByName?: string;
  previousTeacherStaffIds?: string[];
  previousTeacherNames?: string[];
};

export function isRecordAuthoredByMe(user: UserLike, record: RecordLike): boolean {
  return isSameStaff(user, record.recordedByStaffId) || isStaffIn(user, record.previousTeacherStaffIds);
}

export function canViewPostTeachingRecord(user: UserLike, record: RecordLike, myCourseIds: ReadonlySet<string>): boolean {
  return (!!record.courseId && myCourseIds.has(record.courseId)) || isRecordAuthoredByMe(user, record);
}

/**
 * ป้ายบอกที่มาของบันทึก (null = บันทึกของตัวเองในคาบที่ยังสอนอยู่ ไม่ต้องมีป้าย)
 *  - เป็นของครูคนอื่น: "บันทึกโดย … (ครูผู้สอนก่อนหน้า)"
 *  - เป็นของตัวเองแต่คาบนี้ย้ายไปให้ครูท่านอื่นแล้ว: "ประวัติจากคาบที่คุณเคยสอน …"
 */
export function postTeachingAuthorNote(user: UserLike, record: RecordLike, myCourseIds: ReadonlySet<string>): string | null {
  const mine = isRecordAuthoredByMe(user, record);
  const stillMine = !!record.courseId && myCourseIds.has(record.courseId);
  if (mine) {
    return stillMine ? null : 'ประวัติจากคาบที่คุณเคยสอน (ปัจจุบันคาบนี้สอนโดยครูท่านอื่น)';
  }
  if (record.recordedByStaffId) {
    return `บันทึกโดย ${record.recordedByName || 'ครูผู้สอนก่อนหน้า'}`;
  }
  if (record.previousTeacherStaffIds && record.previousTeacherStaffIds.length > 0) {
    const names = (record.previousTeacherNames || []).filter(Boolean).join(', ');
    return `บันทึกโดย ${names || 'ครูผู้สอนก่อนหน้า'} (ครูผู้สอนก่อนหน้าของคาบนี้)`;
  }
  return null;
}
