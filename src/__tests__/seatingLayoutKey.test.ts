import { describe, it, expect } from 'vitest';
import { classKeyOf, physicalRoomKeyOf, seatingTargetFor, seatingTargetLabel, layoutBelongsTo, SEAT_NO_ROOM } from '../lib/seatingLayoutKey';
import { listSeatingPlanItems } from '../lib/seatingPlanTargets';

describe('seatingLayoutKey', () => {
  it('ชั้น/ห้องเรียนรูปแบบต่าง ๆ ได้คีย์เดียวกัน (ม./M./เว้นวรรค)', () => {
    expect(classKeyOf('ม.5/8')).toBe('5-8');
    expect(classKeyOf('M.5/8')).toBe('5-8');
    expect(classKeyOf('ม. 5 / 08')).toBe('5-8');
    expect(classKeyOf('M.4')).toBeNull();
    expect(classKeyOf('Non-Student')).toBeNull();
    expect(classKeyOf('')).toBeNull();
  });

  it('ห้องกายภาพ: ตัด [ ] และเว้นวรรค, ว่าง = noroom (ไม่เดา)', () => {
    expect(physicalRoomKeyOf('546')).toBe('546');
    expect(physicalRoomKeyOf(' [953] ')).toBe('953');
    expect(physicalRoomKeyOf('')).toBe(SEAT_NO_ROOM);
    expect(physicalRoomKeyOf(undefined)).toBe(SEAT_NO_ROOM);
  });

  it('วิชาเดียวกันสอนต่างห้องกายภาพ = คนละผัง; ต่างวิชาห้องเดียวกัน = ผังเดียวกัน (คีย์ไม่มีรหัสวิชา)', () => {
    const lab = seatingTargetFor({ ownerStaffId: 'sci-20', level: 'M.4/5', physicalRoom: '221' });
    const home = seatingTargetFor({ ownerStaffId: 'sci-20', level: 'ม.4/5', physicalRoom: '953' });
    expect(lab!.layoutId).not.toBe(home!.layoutId);
    const hr = seatingTargetFor({ ownerStaffId: 'sci-20', level: 'ม.4/2', physicalRoom: '535' });
    const anti = seatingTargetFor({ ownerStaffId: 'sci-20', level: 'M.4/2', physicalRoom: '535' });
    expect(hr!.layoutId).toBe(anti!.layoutId);
  });

  it('ครูต่างคน ห้องเดียวกัน = คนละผัง แต่ targetKey เดียวกัน (ไว้ค้นหา "คัดลอกจากครูท่านอื่น")', () => {
    const a = seatingTargetFor({ ownerStaffId: 'sci-20', level: 'ม.5/1', physicalRoom: '546' })!;
    const b = seatingTargetFor({ ownerStaffId: 'sci-2', level: 'ม.5/1', physicalRoom: '546' })!;
    expect(a.layoutId).not.toBe(b.layoutId);
    expect(a.targetKey).toBe(b.targetKey);
  });

  it('id ขึ้นต้น seat_{staffId}__ เสมอ และ sci-2 ไม่ชนกับ sci-20', () => {
    const a = seatingTargetFor({ ownerStaffId: 'sci-2', level: 'ม.5/1', physicalRoom: '546' })!;
    expect(a.layoutId.startsWith('seat_sci-2__')).toBe(true);
    expect(layoutBelongsTo(a.layoutId, 'sci-2')).toBe(true);
    expect(layoutBelongsTo(a.layoutId, 'sci-20')).toBe(false);
    expect(layoutBelongsTo(a.layoutId, '')).toBe(false);
  });

  it('ไม่มีครูเจ้าของ/อ่านชั้นไม่ได้/AP ไม่มีรหัส/ชุมนุมไม่มี id = null', () => {
    expect(seatingTargetFor({ ownerStaffId: '', level: 'ม.5/1' })).toBeNull();
    expect(seatingTargetFor({ ownerStaffId: null, level: 'ม.5/1' })).toBeNull();
    expect(seatingTargetFor({ ownerStaffId: 'a b', level: 'ม.5/1' })).toBeNull();
    expect(seatingTargetFor({ ownerStaffId: 'sci-20', level: 'M.4' })).toBeNull();
    expect(seatingTargetFor({ ownerStaffId: 'sci-20', kind: 'AP', code: '' })).toBeNull();
    expect(seatingTargetFor({ ownerStaffId: 'sci-20', kind: 'ELECTIVE', activityId: '' })).toBeNull();
  });

  it('AP / ชุมนุม มีคีย์ของตัวเอง และไม่ชนกับผังห้องเรียน', () => {
    const ap = seatingTargetFor({ ownerStaffId: 'sci-20', kind: 'AP', code: 'ว33223', physicalRoom: '546' })!;
    const cls = seatingTargetFor({ ownerStaffId: 'sci-20', level: 'ม.6/1', physicalRoom: '546' })!;
    const el = seatingTargetFor({ ownerStaffId: 'sci-20', kind: 'ELECTIVE', activityId: 'club_1' })!;
    expect(new Set([ap.layoutId, cls.layoutId, el.layoutId]).size).toBe(3);
  });

  it('ป้ายอ่านง่าย', () => {
    expect(seatingTargetLabel({ level: 'ม.5/1', physicalRoom: '546' })).toBe('ม.5/1 @ 546');
    expect(seatingTargetLabel({ level: 'ม.5/1' })).toBe('ม.5/1 @ ไม่ระบุห้อง');
  });
});

describe('listSeatingPlanItems (ตัวอย่างตารางครู sci-20)', () => {
  const mk = (id: string, code: string, name: string, level: string, room: string, day: string, p: number, extra: Record<string, unknown> = {}) =>
    ({ id, subjectCode: code, subjectName: name, level, room, dayOfWeek: day, periodNumber: p, teacherIds: ['sci-20'], ...extra });
  const schedules = [
    mk('1', 'HR', 'HomeRoom', 'M.4/2', '535', 'monday', 0),
    mk('2', 'HR', 'HomeRoom', 'M.4/2', '535', 'tuesday', 0),
    mk('3', 'ส30222', 'ป้องกันการทุจริต', 'M.4/2', '535', 'thursday', 6),
    mk('4', 'ว31222', 'เคมี 2', 'M.4/5', '221', 'wednesday', 1),
    mk('5', 'ว31222', 'เคมี 2', 'M.4/5', '221', 'wednesday', 2),
    mk('6', 'ว31222', 'เคมี 2', 'M.4/5', '953', 'tuesday', 2),
    mk('7', 'CZ', 'Cleaning Zone', 'Non-Student', '', 'tuesday', 9),
    mk('8', 'ก31914', 'กิจกรรมเพื่อสังคม', 'M.4', '', 'thursday', 9),
    mk('9', 'ว33223', 'เคมี AP', 'M.6/1, M.6/2', '546', 'thursday', 3),
    mk('10', 'ว33223', 'เคมี AP', 'M.6/1, M.6/2', '546', 'thursday', 4),
    mk('11', 'ค31101', 'คณิต', 'M.4/1', '546', 'monday', 1, { teacherIds: ['other'] }),
  ];
  const items = listSeatingPlanItems({ schedules, staffId: 'sci-20' });

  it('รวมวิชาที่สอนชั้น+ห้องกายภาพเดียวกันเป็นผังเดียว (โฮมรูม + ป้องกันการทุจริต @535)', () => {
    const it535 = items.find(i => i.level === 'M.4/2')!;
    expect(it535.courses.map(c => c.code).sort()).toEqual(['HR', 'ส30222']);
    expect(it535.periods).toBe(3);
  });

  it('วิชาเดียวสองห้องกายภาพ = สองผัง (เคมี 2 ม.4/5 @221 กับ @953)', () => {
    const chem = items.filter(i => i.level === 'M.4/5');
    expect(chem.map(i => i.physicalRoom).sort()).toEqual(['221', '953']);
    expect(chem.find(i => i.physicalRoom === '221')!.periods).toBe(2);
  });

  it('ข้าม Non-Student และชั้นลอยไม่มีเลขห้อง; ไม่รวมวิชาของครูคนอื่น', () => {
    expect(items.some(i => i.courses.some(c => c.code === 'CZ'))).toBe(false);
    expect(items.some(i => i.courses.some(c => c.code === 'ก31914'))).toBe(false);
    expect(items.some(i => i.courses.some(c => c.code === 'ค31101'))).toBe(false);
  });

  it('AP: 1 ผัง รวมสองห้องเรียน', () => {
    const ap = items.find(i => i.kind === 'AP')!;
    expect(ap.levels).toEqual(['M.6/1', 'M.6/2']);
    expect(ap.periods).toBe(2);
    expect(ap.target.layoutId).toContain('AP_');
  });

  it('ไม่มี staffId = ว่าง', () => {
    expect(listSeatingPlanItems({ schedules, staffId: null })).toEqual([]);
  });

  it('เรียงตามชั้น/ห้อง', () => {
    const levels = items.filter(i => i.kind === 'CLASS').map(i => i.level);
    expect(levels).toEqual(['M.4/2', 'M.4/5', 'M.4/5']);
  });
});
