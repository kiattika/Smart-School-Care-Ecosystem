import { createParentNotification, type CreateParentNotificationInput } from './firestoreService';
import type { StudentNoticeText } from '../lib/studentNotices';

/**
 * แจ้งผลถึงนักเรียน (และผู้ปกครองถ้ารู้ uid) จากการดำเนินการของบุคลากร — non-fatal: ไม่ throw ทับงานหลัก
 * เรียกหลังงานหลักสำเร็จแล้วเท่านั้น. ผู้เรียกส่ง uid ที่ "อ่านมาจากเอกสารจริง" (ไม่มี = ไม่แจ้งฝั่งนั้น ไม่เดา)
 * createParentNotification ข้ามเองเมื่อไม่มีผู้รับเลย
 */
export async function notifyStudentSide(
  to: { studentId: string; studentName: string; studentUid?: string | null; parentUid?: string | null },
  notice: StudentNoticeText,
): Promise<void> {
  const input: CreateParentNotificationInput = {
    studentId: to.studentId, studentName: to.studentName || to.studentId,
    studentUid: to.studentUid || undefined, parentUid: to.parentUid || null,
    title: notice.title, message: notice.message, type: notice.type,
  };
  try { await createParentNotification(input); }
  catch (err) { console.warn('[notifyStudentSide] failed', err); }
}
