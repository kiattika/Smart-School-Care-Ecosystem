/**
 * ตรรกะล้วนของแชทห้องเรียนแบบ "แยกช่องส่วนตัว"
 *  - ช่อง PARENT  = ครูประจำชั้น ↔ ผู้ปกครอง
 *  - ช่อง STUDENT = ครูประจำชั้น ↔ นักเรียน
 * แต่ละช่องมองไม่เห็นกันและกัน (rules ผูกด้วย memberUid ของแต่ละช่อง)
 */
export type ChatChannel = 'PARENT' | 'STUDENT';
export type ChatSide = 'TEACHER' | 'MEMBER';
export type ChatSenderRole = 'TEACHER' | 'PARENT' | 'STUDENT';

export const CHAT_TEXT_MAX = 1000;

export const CHANNEL_LABEL: Record<ChatChannel, string> = {
  PARENT: 'ผู้ปกครอง',
  STUDENT: 'นักเรียน',
};

export function chatThreadId(studentId: string, channel: ChatChannel): string {
  return `${studentId}_${channel}`;
}

/** ข้อความที่ส่งได้ → คืนข้อความที่ trim แล้ว หรือ null ถ้าว่าง/ยาวเกิน */
export function normalizeChatText(raw: string): string | null {
  const t = (raw ?? '').trim();
  if (!t || t.length > CHAT_TEXT_MAX) return null;
  return t;
}

export interface ChatThreadLike {
  lastAt?: string;
  lastSenderRole?: ChatSenderRole | '';
  memberLastReadAt?: string;
  teacherLastReadAt?: string;
}

/** ยังไม่ได้อ่าน = ข้อความล่าสุดมาจากอีกฝั่ง และใหม่กว่าเวลาที่ฝั่งเราอ่านล่าสุด */
export function isThreadUnread(thread: ChatThreadLike | undefined | null, side: ChatSide): boolean {
  if (!thread || !thread.lastAt) return false;
  const fromOther = side === 'TEACHER' ? thread.lastSenderRole !== 'TEACHER' : thread.lastSenderRole === 'TEACHER';
  if (!fromOther) return false;
  const readAt = (side === 'TEACHER' ? thread.teacherLastReadAt : thread.memberLastReadAt) || '';
  return thread.lastAt > readAt;
}

export function countUnread(threads: ChatThreadLike[], side: ChatSide): number {
  return threads.filter(t => isThreadUnread(t, side)).length;
}

export function senderRoleFor(side: ChatSide, channel: ChatChannel): ChatSenderRole {
  return side === 'TEACHER' ? 'TEACHER' : channel;
}
