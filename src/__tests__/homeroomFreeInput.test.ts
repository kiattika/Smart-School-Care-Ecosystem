import { describe, it, expect } from 'vitest';
import { roomsFromSchedules, isKnownHomeroom } from '../lib/roomOptions';
import { isSameRoom } from '../lib/utils';
import { readSource } from './helpers/readSource';

describe('ห้องประจำชั้นพิมพ์เองได้ + แจ้งเมื่อไม่ตรงข้อมูลที่นำเข้า', () => {
  it('roomsFromSchedules อ่านชั้น/ห้องจาก level เฉพาะรูปแบบ ชั้น/ห้อง', () => {
    expect(roomsFromSchedules([{ level: 'ม.5/8' }, { level: 'ม.5/8' }, { level: '' }, { level: 'กิจกรรม' }, {}]).sort()).toEqual(['ม.5/8']);
  });
  it('isKnownHomeroom ใช้ isSameRoom (ม.5/8 = M.5/8) และไม่เตือนเมื่อยังไม่มีข้อมูลห้อง', () => {
    expect(isKnownHomeroom('M.5/8', ['ม.5/8'], isSameRoom)).toBe(true);
    expect(isKnownHomeroom('ม.6/1', ['ม.5/8'], isSameRoom)).toBe(false);
    expect(isKnownHomeroom('ม.6/1', [], isSameRoom)).toBe(true);
    expect(isKnownHomeroom('', ['ม.5/8'], isSameRoom)).toBe(true);
  });
  it('หน้าแก้ไขสิทธิ์: ช่องห้องเป็น input+datalist และไม่มีส่วนวิชา/ห้องที่สอนแล้ว', () => {
    const src = readSource('src/components/StaffRoleManagementPage.tsx');
    expect(src).toContain('list="homeroom-room-options"');
    expect(src).not.toContain('Teaching Subjects Matrix');
    expect(src).not.toContain('formSubjects');
  });
});
