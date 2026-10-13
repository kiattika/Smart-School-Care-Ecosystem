import { describe, it, expect } from 'vitest';
import { readSource } from './helpers/readSource';
import {
  chatThreadId, normalizeChatText, isThreadUnread, countUnread, senderRoleFor, CHAT_TEXT_MAX,
} from '../lib/classChat';

describe('classChat logic', () => {
  it('threadId = studentId_channel', () => {
    expect(chatThreadId('10001', 'PARENT')).toBe('10001_PARENT');
    expect(chatThreadId('10001', 'STUDENT')).toBe('10001_STUDENT');
  });
  it('normalizeChatText: trim, ว่าง/ยาวเกิน = null', () => {
    expect(normalizeChatText('  สวัสดี ')).toBe('สวัสดี');
    expect(normalizeChatText('   ')).toBeNull();
    expect(normalizeChatText('ก'.repeat(CHAT_TEXT_MAX + 1))).toBeNull();
    expect(normalizeChatText('ก'.repeat(CHAT_TEXT_MAX))).not.toBeNull();
  });
  it('senderRoleFor', () => {
    expect(senderRoleFor('TEACHER', 'PARENT')).toBe('TEACHER');
    expect(senderRoleFor('MEMBER', 'PARENT')).toBe('PARENT');
    expect(senderRoleFor('MEMBER', 'STUDENT')).toBe('STUDENT');
  });
  it('isThreadUnread: ข้อความจากอีกฝั่งที่ใหม่กว่าเวลาอ่าน', () => {
    const t = { lastAt: '2026-10-13T10:00:00Z', lastSenderRole: 'PARENT' as const, teacherLastReadAt: '2026-10-13T09:00:00Z' };
    expect(isThreadUnread(t, 'TEACHER')).toBe(true);
    expect(isThreadUnread({ ...t, teacherLastReadAt: '2026-10-13T10:00:00Z' }, 'TEACHER')).toBe(false);
    expect(isThreadUnread(t, 'MEMBER')).toBe(false); // ผู้ปกครองส่งเอง ไม่ถือว่ายังไม่อ่าน
    expect(isThreadUnread({ lastAt: '2026-10-13T10:00:00Z', lastSenderRole: 'TEACHER' }, 'MEMBER')).toBe(true);
    expect(isThreadUnread(undefined, 'TEACHER')).toBe(false);
  });
  it('countUnread', () => {
    expect(countUnread([
      { lastAt: 'b', lastSenderRole: 'STUDENT' }, { lastAt: 'b', lastSenderRole: 'TEACHER' },
    ], 'TEACHER')).toBe(1);
  });
});

describe('guard: แยกเมนู + แชทส่วนตัว', () => {
  it('ParentEngagementServices ไม่มีแชทเดิม/แท็บสนทนาแล้ว', () => {
    const s = readSource('src/components/student-parent/ParentEngagementServices.tsx');
    expect(s).not.toMatch(/sendParentTeacherMessage|parentTeacherMessages|activeTab === 'messaging'/);
  });
  it('พอร์ทัลผู้ปกครองใช้ช่อง PARENT, นักเรียนใช้ช่อง STUDENT, ครูมีเมนู class-chat', () => {
    expect(readSource('src/ParentPortal.tsx')).toMatch(/channel="PARENT"/);
    expect(readSource('src/StudentPortal.tsx')).toMatch(/channel="STUDENT"/);
    expect(readSource('src/AdvisorPortal.tsx')).toMatch(/id: 'class-chat'/);
  });
  it('rules: class_messages/class_chat_threads อ่านเฉพาะสมาชิก+ครูประจำชั้น ไม่รวม SUPER_ADMIN, แก้/ลบข้อความไม่ได้', () => {
    const r = readSource('firestore.rules');
    const a = r.indexOf('match /class_messages/');
    const b = r.indexOf('// นัดพบครูของผู้ปกครอง — สายงาน');
    const block = r.slice(a, b);
    expect(block).not.toMatch(/SUPER_ADMIN/);
    expect(block).toMatch(/allow update, delete: if false;/);
    expect(block).toMatch(/isHomeroomTeacherOf\(resource\.data\.room\)/);
  });
});
