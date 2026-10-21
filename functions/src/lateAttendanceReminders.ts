// ต้องเป็น v1 ที่ region เริ่มต้น เหมือนฟังก์ชันอื่นของโปรเจกต์ (โควตา region เต็ม — ห้ามใช้ v2)
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { FIRESTORE_DATABASE_ID } from './config';
import { planExpiryNotices, planReminders, type NoticeDraft, type ReqLite, type StaffLite } from './lateAttendanceRemindersLogic';

/**
 * แจ้งเตือนคำขอเช็คชื่อย้อนหลัง (เวลาเซิร์ฟเวอร์ Asia/Bangkok)
 *  - 16:00 ทุกวัน (รวมวันหยุด/วันไม่มีเรียน): เตือนสามฝ่าย ครูผู้ยื่น + หัวหน้า + รอง (ผอ. เมื่อเป็นคำขอของรอง) สำหรับรายการที่ยังไม่ดำเนินการ — ครั้งเดียวต่อคำขอต่อผู้รับ
 *  - 00:10 ทุกวัน: แจ้งครูว่าคำขอที่ไม่มีผู้ตัดสินจนเลย 24:00 "หมดอายุ" (สถานะหมดอายุ/เลยกำหนดคำนวณจากเวลาในตรรกะกลาง ไม่ต้องรอฟังก์ชันนี้)
 * ผลลัพธ์เป็นเอกสาร staff_notifications (แสดงในกระดิ่งตามอีเมล) — เขียนด้วย Admin SDK; id แบบกำหนดเอง + create() กันส่งซ้ำ
 * การเตือน "เป็นการส่วนตัวโดยตรง" ช่องทางอื่น (โทร/แชท) ผู้เกี่ยวข้องแจ้งกันเองนอกระบบ
 */
if (!admin.apps.length) admin.initializeApp();
const db = getFirestore(admin.app(), FIRESTORE_DATABASE_ID);

const ms = (v: any): number | null => (v && typeof v.toMillis === 'function' ? v.toMillis() : typeof v === 'number' ? v : null);

function toLite(id: string, d: Record<string, any>): ReqLite & { expiredNotified: boolean } {
  return {
    id,
    status: d.status,
    teacherEmail: d.teacherEmail,
    teacherName: d.teacherName,
    subjectName: d.subjectName,
    level: d.level,
    periodNumber: d.periodNumber,
    teachingDate: d.teachingDate,
    requesterLevel: d.requesterLevel,
    deadlineMs: ms(d.deadlineAt),
    headStep: d.headStep ? { reviewUntilMs: ms(d.headStep.reviewUntil) } : null,
    deputyStep: d.deputyStep || null,
    expiredNotified: !!d.expiredNotifiedAt,
  };
}

async function writeNotices(drafts: NoticeDraft[], kind: 'LATE_ATTENDANCE_REMINDER' | 'LATE_ATTENDANCE_DECISION'): Promise<number> {
  let written = 0;
  for (const d of drafts) {
    try {
      await db.collection('staff_notifications').doc(d.docId).create({
        id: d.docId,
        recipientEmail: d.recipientEmail,
        kind,
        title: d.title.slice(0, 120),
        message: d.message.slice(0, 500),
        refId: d.refId,
        senderUid: 'system',
        senderName: 'ระบบ',
        createdAt: FieldValue.serverTimestamp(),
        readAt: null,
      });
      written++;
    } catch (err: any) {
      if (err?.code !== 6 /* ALREADY_EXISTS */) console.warn('[lateAttendanceReminders] write failed', d.docId, err?.message || err);
    }
  }
  return written;
}

export async function runLateAttendanceReminders(nowMs = Date.now()): Promise<number> {
  const [reqSnap, staffSnap] = await Promise.all([
    db.collection('late_attendance_requests').where('deadlineAt', '>', Timestamp.fromMillis(nowMs)).get(),
    db.collection('staff').get(),
  ]);
  const reqs = reqSnap.docs.map(d => toLite(d.id, d.data()));
  const staff = staffSnap.docs.map(d => d.data() as StaffLite);
  return writeNotices(planReminders(reqs, staff, nowMs), 'LATE_ATTENDANCE_REMINDER');
}

export async function runLateAttendanceExpiry(nowMs = Date.now()): Promise<number> {
  const snap = await db.collection('late_attendance_requests').where('status', '==', 'PENDING').get();
  const plans = planExpiryNotices(snap.docs.map(d => toLite(d.id, d.data())), nowMs);
  let n = 0;
  for (const p of plans) {
    n += await writeNotices([p], 'LATE_ATTENDANCE_DECISION');
    await db.collection('late_attendance_requests').doc(p.requestId).update({ expiredNotifiedAt: FieldValue.serverTimestamp() }).catch(() => undefined);
  }
  return n;
}

/** ทุกวัน 16:00 (เวลาไทย) — รวมวันหยุดและวันที่ไม่มีเรียน */
export const lateAttendanceReminder1600 = functions.pubsub.schedule('0 16 * * *').timeZone('Asia/Bangkok').onRun(async () => {
  await runLateAttendanceReminders();
});

/** ทุกวัน 00:10 (เวลาไทย) — แจ้งครูที่คำขอหมดอายุ */
export const lateAttendanceExpiryNotice = functions.pubsub.schedule('10 0 * * *').timeZone('Asia/Bangkok').onRun(async () => {
  await runLateAttendanceExpiry();
});
