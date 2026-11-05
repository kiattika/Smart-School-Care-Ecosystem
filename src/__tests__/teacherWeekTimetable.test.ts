import { describe, it, expect } from 'vitest';
import { buildTeacherWeekGrid, subjectColor, staffDisplayName, compareStaffId, matchesStaffQuery } from '../lib/teacherWeekTimetable';

const doc = (o: Record<string, any>) => ({ academicYear: '2569', term: '1', subjectType: 'MAIN', ...o });

const schedules = [
  // ค32102 ม.5/8 พุธ P6-P7 → Block 1/2, 2/2 ; ครูคนเดียว
  doc({ id: 'a1', subjectCode: 'ค32102', subjectName: 'คณิต', level: 'ม.5/8', room: '943', dayOfWeek: 'wednesday', periodNumber: 6, teacherIds: ['mat-018'], teacherId: 'mat-018' }),
  doc({ id: 'a2', subjectCode: 'ค32102', subjectName: 'คณิต', level: 'ม.5/8', room: '943', dayOfWeek: 'wednesday', periodNumber: 7, teacherIds: ['mat-018'], teacherId: 'mat-018' }),
  // วิชาเดียวกันแต่คนละห้องติดกัน → ไม่เป็น Block
  doc({ id: 'b1', subjectCode: 'ค32202', level: 'ม.5/9', room: '935', dayOfWeek: 'thursday', periodNumber: 2, teacherIds: ['mat-018'], teacherId: 'mat-018' }),
  doc({ id: 'b2', subjectCode: 'ค32202', level: 'ม.5/8', room: '943', dayOfWeek: 'thursday', periodNumber: 3, teacherIds: ['mat-018'], teacherId: 'mat-018' }),
  // ว30274 ศุกร์ P6-P9 → Block 1/4..4/4
  ...[6, 7, 8, 9].map(p => doc({ id: `c${p}`, subjectCode: 'ว30274', level: 'ม.5/8', room: '943', dayOfWeek: 'friday', periodNumber: p, teacherIds: ['mat-018'], teacherId: 'mat-018' })),
  // HR (กิจกรรม ครูร่วม 2 คน) P0 จันทร์ → Co-taught, ไม่มี Block
  doc({ id: 'h1', subjectCode: 'HR', level: 'ม.5/8', room: '943', subjectType: 'ACTIVITY', dayOfWeek: 'monday', periodNumber: 0, teacherIds: ['mat-018', 'sci-001'], teacherId: 'mat-018' }),
  // กิจกรรมติดกัน P7-P8 ไม่มี Block
  doc({ id: 'k7', subjectCode: 'ก32908', subjectType: 'ACTIVITY', dayOfWeek: 'thursday', periodNumber: 7, teacherIds: ['mat-018', 'x'], teacherId: 'mat-018' }),
  doc({ id: 'k8', subjectCode: 'ก32908', subjectType: 'ACTIVITY', dayOfWeek: 'thursday', periodNumber: 8, teacherIds: ['mat-018', 'x'], teacherId: 'mat-018' }),
  // ครูอื่นล้วน — ต้องไม่ปรากฏ
  doc({ id: 'o1', subjectCode: 'ท32101', level: 'ม.5/8', dayOfWeek: 'monday', periodNumber: 3, teacherIds: ['tha-002'], teacherId: 'tha-002' }),
  // doc รุ่นเก่าไม่มี teacherId/teacherIds — จับคู่ด้วยอีเมล (normalize)
  doc({ id: 'l1', courseCode: 'อ32101', courseName: 'อังกฤษ', targetClass: 'ม.5/8', scheduleDay: 2, periodNumber: 4, teacherEmail: ' Mat018@UTD.ac.th​ ' }),
  // doc ที่ซ้ำช่องเดียวกัน (ซ้ำซ้อน) — นับครั้งเดียว
  doc({ id: 'dup', subjectCode: 'ค32102', level: 'ม.5/8', room: '943', dayOfWeek: 'wednesday', periodNumber: 6, teacherIds: ['mat-018'], teacherId: 'mat-018' }),
];

const build = (over: Record<string, any> = {}) => buildTeacherWeekGrid({ schedules, staffId: 'mat-018', staffEmail: 'mat018@utd.ac.th', ...over });

describe('buildTeacherWeekGrid', () => {
  it('เฉพาะคาบของครูที่เลือก (teacherId/teacherIds) + อีเมลสำหรับ doc รุ่นเก่า, ตัดซ้ำ', () => {
    const g = build();
    const codes = (d: string, p: number) => (g.cells[d]?.[p] || []).map(c => c.code);
    expect(codes('monday', 3)).toEqual([]);             // ท32101 ของครูอื่น
    expect(codes('wednesday', 6)).toEqual(['ค32102']);  // ซ้ำ → 1
    expect(codes('tuesday', 4)).toEqual(['อ32101']);    // รุ่นเก่า scheduleDay=2, อีเมลตรง
    expect(g.total).toBe(12); // ค32102×2, ค32202×2, ว30274×4, HR, ก32908×2, อ32101
  });

  it('ไม่เลือกครู / ไม่มี staffId = ไม่มีคาบ (ไม่เดา)', () => {
    expect(buildTeacherWeekGrid({ schedules, staffId: null }).total).toBe(0);
    expect(buildTeacherWeekGrid({ schedules, staffId: 'nobody' }).total).toBe(0);
  });

  it('อีเมลไม่ถูกใช้จับคู่ doc ที่มี teacherIds อยู่แล้ว', () => {
    const only = [doc({ id: 'z', subjectCode: 'ค1', dayOfWeek: 'monday', periodNumber: 1, teacherId: 'other', teacherIds: ['other'], teacherEmail: 'mat018@utd.ac.th' })];
    expect(buildTeacherWeekGrid({ schedules: only, staffId: 'mat-018', staffEmail: 'mat018@utd.ac.th' }).total).toBe(0);
  });

  it('Block i/n เฉพาะวิชาหลักที่ รหัส+ชั้น+ห้อง เดียวกันและคาบติดกัน', () => {
    const g = build();
    expect(g.cells.wednesday[6][0].block).toEqual({ index: 1, total: 2 });
    expect(g.cells.wednesday[7][0].block).toEqual({ index: 2, total: 2 });
    expect([6, 7, 8, 9].map(p => g.cells.friday[p][0].block)).toEqual([1, 2, 3, 4].map(i => ({ index: i, total: 4 })));
    // คนละห้องติดกัน → ไม่มี Block
    expect(g.cells.thursday[2][0].block).toBeUndefined();
    expect(g.cells.thursday[3][0].block).toBeUndefined();
    // กิจกรรมติดกัน → ไม่มี Block
    expect(g.cells.thursday[7][0].block).toBeUndefined();
    expect(g.cells.thursday[8][0].block).toBeUndefined();
  });

  it('Co-taught เมื่อมีผู้สอนมากกว่า 1 คน', () => {
    const g = build();
    expect(g.cells.monday[0][0].coTaught).toBe(true);
    expect(g.cells.thursday[7][0].coTaught).toBe(true);
    expect(g.cells.wednesday[6][0].coTaught).toBe(false);
  });

  it('แสดงจันทร์–ศุกร์เสมอ, P0–P10 เป็นอย่างน้อย; เสาร์/อาทิตย์เฉพาะเมื่อมีคาบ; คาบเกิน 10 ขยายช่วง', () => {
    const g = build();
    expect(g.days.map(d => d.key)).toEqual(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']);
    expect(g.periodNumbers).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const sat = [doc({ id: 's', subjectCode: 'ค1', dayOfWeek: 'saturday', periodNumber: 12, teacherIds: ['mat-018'], teacherId: 'mat-018' })];
    const g2 = buildTeacherWeekGrid({ schedules: sat, staffId: 'mat-018' });
    expect(g2.days.map(d => d.key)).toContain('saturday');
    expect(g2.periodNumbers[g2.periodNumbers.length - 1]).toBe(12);
    expect(build({ configuredPeriodNumbers: [0, 11] }).periodNumbers.length).toBe(12);
  });

  it('เรียงการ์ดในช่องเดียวกันตามรหัสวิชา', () => {
    const two = [
      doc({ id: 'x2', subjectCode: 'ว2', dayOfWeek: 'monday', periodNumber: 1, teacherIds: ['mat-018'], teacherId: 'mat-018' }),
      doc({ id: 'x1', subjectCode: 'ค1', dayOfWeek: 'monday', periodNumber: 1, teacherIds: ['mat-018'], teacherId: 'mat-018' }),
    ];
    expect(buildTeacherWeekGrid({ schedules: two, staffId: 'mat-018' }).cells.monday[1].map(c => c.code)).toEqual(['ค1', 'ว2']);
  });
});

describe('subjectColor / staffDisplayName', () => {
  it('สีตามตัวอักษรแรกของรหัสวิชา: วิชาเดียวกลุ่มเดียวกันสีเดียวกัน', () => {
    expect(subjectColor('ค32102')).toBe(subjectColor('ค32202'));
    expect(subjectColor('hr')).toBe(subjectColor('HR'));
    expect(subjectColor('')).toBe('#64748b');
  });
  it('H (HR) = ม่วง, C (CZ) = ชมพู, ก = ฟ้า, ง = เหลือง, ส = ส้ม, ท = แดง', () => {
    expect(subjectColor('HR')).toBe('#7c3aed');
    expect(subjectColor('CZ')).toBe('#ec4899');
    expect(subjectColor('ก31908')).toBe('#0ea5e9');
    expect(subjectColor('ง30101')).toBe('#ca8a04');
    expect(subjectColor('ส30222')).toBe('#ea580c');
    expect(subjectColor('ท31101')).toBe('#dc2626');
  });
  it('ทุกตัวอักษรหลัก (รวม H/C/P) ได้สีไม่ซ้ำกัน', () => {
    const codes = ['HR', 'CZ', 'PLC', 'ก1', 'ท1', 'ส1', 'ง1', 'ว1', 'พ1', 'ค1', 'อ1', 'ศ1'];
    const colors = codes.map(subjectColor);
    expect(new Set(colors).size).toBe(codes.length);
    for (const c of colors) expect(c).toMatch(/^#[0-9a-f]{6}$/);
  });
  it('ตัวอักษรอื่นที่ไม่อยู่ในกลุ่มหลักได้สีสำรอง ไม่ซ้ำกับสีหลัก', () => {
    const main = new Set(['H', 'C', 'P', 'ก', 'ท', 'ส', 'ง', 'ว', 'พ', 'ค', 'อ', 'ศ'].map(l => subjectColor(`${l}1`)));
    for (const l of ['จ', 'ญ', 'ฝ', 'ย', 'ป', 'ร', 'ล', 'ฮ', 'ข', 'ซ', 'ต', 'น', 'บ', 'ม']) {
      expect(main.has(subjectColor(`${l}30101`))).toBe(false);
    }
  });
  it('ชื่อบุคลากร: fullName ก่อน แล้ว prefix+ชื่อ, displayName, อีเมล, id', () => {
    expect(staffDisplayName({ id: 'a', fullName: 'นายเกียรติศักดิ์ แก้วหล้า', email: 'x' })).toBe('นายเกียรติศักดิ์ แก้วหล้า');
    expect(staffDisplayName({ id: 'a', prefix: 'นาย', firstName: 'ก', lastName: 'ข' })).toBe('นายก ข');
    expect(staffDisplayName({ id: 'a', email: 'e@x' })).toBe('e@x');
    expect(staffDisplayName({ id: 'a' })).toBe('a');
  });
});

describe('compareStaffId / matchesStaffQuery', () => {
  it('เรียงตามรหัสครูแบบตัวเลขตามธรรมชาติ', () => {
    const ids = ['sci-20', 'mat-018', 'sci-3', 'mat-002', 'tha-01', 'sci-100'];
    expect([...ids].sort(compareStaffId)).toEqual(['mat-002', 'mat-018', 'sci-3', 'sci-20', 'sci-100', 'tha-01']);
  });
  it('ค้นหาจากรหัสหรือชื่อ ไม่สนตัวพิมพ์/ช่องว่างซ้ำ และทุกคำต้องตรง', () => {
    const t = { id: 'sci-20', name: 'นางสาวสุกานดา แย้มเยื้อน' };
    expect(matchesStaffQuery(t, '')).toBe(true);
    expect(matchesStaffQuery(t, '  ')).toBe(true);
    expect(matchesStaffQuery(t, 'SCI-20')).toBe(true);
    expect(matchesStaffQuery(t, 'สุกานดา')).toBe(true);
    expect(matchesStaffQuery(t, 'สุกานดา   แย้ม')).toBe(true);
    expect(matchesStaffQuery(t, 'sci สุกานดา')).toBe(true);
    expect(matchesStaffQuery(t, 'mat-018')).toBe(false);
    expect(matchesStaffQuery(t, 'สุกานดา เกียรติ')).toBe(false);
  });
});
