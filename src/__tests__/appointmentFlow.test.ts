import { describe, it, expect } from 'vitest';
import {
  APPOINTMENT_TIME_SLOTS, canCancelAppointment, canCompleteAppointment, canRespondAppointment, isAppointmentPending,
  canStaffHandleAppointment, safeMeetingLink, validateAppointmentForm, validateConfirmation,
} from '../lib/appointmentFlow';
import { buildStaffTasks, staffTaskSources } from '../lib/staffTasks';
import { readSource } from './helpers/readSource';

const ok = { recipient: 'HOMEROOM', preferredDate: '2026-10-20', timeSlot: APPOINTMENT_TIME_SLOTS[0], meetingType: 'IN_PERSON', topic: 'ปรึกษาการเรียน' } as const;
const TODAY = '2026-10-12';

describe('validateAppointmentForm', () => {
  it('accepts a complete form', () => expect(validateAppointmentForm({ ...ok }, TODAY)).toEqual([]));
  it('accepts today but not the past', () => {
    expect(validateAppointmentForm({ ...ok, preferredDate: TODAY }, TODAY)).toEqual([]);
    expect(validateAppointmentForm({ ...ok, preferredDate: '2026-10-11' }, TODAY).length).toBe(1);
  });
  it('requires every choice (no defaults filled in for the parent)', () => {
    expect(validateAppointmentForm({ recipient: '', preferredDate: '', timeSlot: '', meetingType: '', topic: '  ' }, TODAY).length).toBe(5);
  });
  it('rejects an unknown slot and an over-long topic', () => {
    expect(validateAppointmentForm({ ...ok, timeSlot: '03:00 - 04:00 น.' }, TODAY).length).toBe(1);
    expect(validateAppointmentForm({ ...ok, topic: 'ก'.repeat(501) }, TODAY).length).toBe(1);
  });
});

describe('transitions', () => {
  it('only REQUESTED can be answered / is a pending task', () => {
    expect(canRespondAppointment('REQUESTED')).toBe(true);
    expect(isAppointmentPending('REQUESTED')).toBe(true);
    for (const s of ['CONFIRMED', 'DECLINED', 'COMPLETED', 'CANCELLED']) { expect(canRespondAppointment(s)).toBe(false); expect(isAppointmentPending(s)).toBe(false); }
  });
  it('only CONFIRMED can be completed; open ones can be cancelled', () => {
    expect(canCompleteAppointment('CONFIRMED')).toBe(true);
    expect(canCompleteAppointment('REQUESTED')).toBe(false);
    expect(canCancelAppointment('REQUESTED') && canCancelAppointment('CONFIRMED')).toBe(true);
    for (const s of ['DECLINED', 'COMPLETED', 'CANCELLED']) expect(canCancelAppointment(s)).toBe(false);
  });
});

describe('meeting link safety', () => {
  it('only https links are clickable', () => {
    expect(safeMeetingLink('https://meet.google.com/abc-defg-hij')).toBe('https://meet.google.com/abc-defg-hij');
    for (const bad of ['javascript:alert(1)', 'http://x.y', 'data:text/html,x', 'ห้องแนะแนว', '', null, undefined, 'https://a b']) expect(safeMeetingLink(bad as string)).toBeNull();
  });
  it('confirmation needs a place (in person) or an https link (online)', () => {
    expect(validateConfirmation('IN_PERSON', 'ห้องแนะแนว')).toEqual([]);
    expect(validateConfirmation('IN_PERSON', ' ').length).toBe(1);
    expect(validateConfirmation('ONLINE_MEET', 'ห้องแนะแนว').length).toBe(1);
    expect(validateConfirmation('ONLINE_MEET', 'https://meet.google.com/x')).toEqual([]);
    expect(validateConfirmation('IN_PERSON', 'ก'.repeat(301)).length).toBe(1);
  });
});

describe('bell + wiring', () => {
  it('only homeroom teachers and counselors see appointment tasks, counting only REQUESTED', () => {
    expect(staffTaskSources('HOMEROOM_TEACHER').appointments).toBe(true);
    expect(staffTaskSources('GUIDANCE_COUNSELOR').appointments).toBe(true);
    expect(staffTaskSources('SUBJECT_TEACHER').appointments).toBe(false);
    const apps = [{ status: 'REQUESTED' }, { status: 'REQUESTED' }, { status: 'CONFIRMED' }, { status: 'DECLINED' }];
    expect(buildStaffTasks({ activeRole: 'HOMEROOM_TEACHER', roomLeaves: [], lateRequests: [], appointments: apps }).map(t => [t.kind, t.count])).toEqual([['APPOINTMENT', 2]]);
    expect(buildStaffTasks({ activeRole: 'EXECUTIVE', roomLeaves: [], lateRequests: [], appointments: apps })).toEqual([]);
  });
  it('time slots in the lib match the ones enforced in firestore.rules', () => {
    const rules = readSource('firestore.rules');
    for (const slot of APPOINTMENT_TIME_SLOTS) expect(rules).toContain(`'${slot}'`);
  });
  it('teacher inbox writes via the service and notifies the parent; portals mount it', () => {
    const inbox = readSource('src/components/appointments/AppointmentInbox.tsx');
    expect(inbox).toMatch(/await respondAppointment\(/);
    expect(inbox).toMatch(/createParentNotification\(/);
    expect(readSource('src/AdvisorPortal.tsx')).toMatch(/<AppointmentInbox /);
    expect(readSource('src/components/guidance/GuidancePortal.tsx')).toMatch(/<AppointmentInbox /);
  });
});

describe('เลือกครูผู้รับ (targetStaffId)', () => {
  it('ระบุครูได้ทั้งนัดแนะแนวและนัดครูที่ปรึกษา', () => {
    expect(validateAppointmentForm({ ...ok, recipient: 'GUIDANCE', targetStaffId: 'gc-1' }, TODAY)).toEqual([]);
    expect(validateAppointmentForm({ ...ok, recipient: 'GUIDANCE', targetStaffId: '' }, TODAY)).toEqual([]);
    expect(validateAppointmentForm({ ...ok, recipient: 'HOMEROOM', targetStaffId: 'adv-1' }, TODAY)).toEqual([]);
  });
  it('canStaffHandleAppointment ตรงกับ rules: ระบุครู = เฉพาะคนนั้น, ว่าง/ไม่มี = ใครก็ได้ (ใช้กับครูที่ปรึกษาด้วย)', () => {
    expect(canStaffHandleAppointment({ recipient: 'GUIDANCE', targetStaffId: 'gc-1' }, 'gc-1')).toBe(true);
    expect(canStaffHandleAppointment({ recipient: 'GUIDANCE', targetStaffId: 'gc-1' }, 'gc-2')).toBe(false);
    expect(canStaffHandleAppointment({ recipient: 'GUIDANCE', targetStaffId: 'gc-1' }, undefined)).toBe(false);
    expect(canStaffHandleAppointment({ recipient: 'GUIDANCE', targetStaffId: '' }, 'gc-2')).toBe(true);
    expect(canStaffHandleAppointment({ recipient: 'GUIDANCE' }, 'gc-2')).toBe(true);
    expect(canStaffHandleAppointment({ recipient: 'HOMEROOM' }, 'x')).toBe(true);
    expect(canStaffHandleAppointment({ recipient: 'HOMEROOM', targetStaffId: 'adv-1' }, 'adv-1')).toBe(true);
    expect(canStaffHandleAppointment({ recipient: 'HOMEROOM', targetStaffId: 'adv-1' }, 'adv-2')).toBe(false);
  });
  it('กระดิ่งงานค้างไม่นับนัดที่ผู้ปกครองระบุครูแนะแนวคนอื่น', () => {
    const base = { activeRole: 'GUIDANCE_COUNSELOR', roomLeaves: [], lateRequests: [] } as never;
    const apts = [
      { status: 'REQUESTED', recipient: 'GUIDANCE', targetStaffId: 'gc-1' },
      { status: 'REQUESTED', recipient: 'GUIDANCE', targetStaffId: '' },
      { status: 'REQUESTED', recipient: 'GUIDANCE', targetStaffId: 'gc-2' },
    ];
    const count = (id: string) => buildStaffTasks({ ...(base as object), appointments: apts, myStaffId: id } as never)
      .find(t => t.kind === 'APPOINTMENT')?.count;
    expect(count('gc-1')).toBe(2);
    expect(count('gc-2')).toBe(2);
    expect(count('gc-3')).toBe(1);
  });
  it('แอปส่ง targetStaffId ไปกับคำขอ และกล่องรับนัดกรองด้วย canStaffHandleAppointment', () => {
    expect(readSource('src/services/firestoreService.ts')).toMatch(/targetStaffId: form\.targetStaffId \|\| ''/);
    expect(readSource('src/components/appointments/AppointmentInbox.tsx')).toMatch(/canStaffHandleAppointment\(a, myStaffId\)/);
    expect(readSource('firestore.rules')).toMatch(/validAppointmentTarget\(request\.resource\.data\)/);
  });
});
