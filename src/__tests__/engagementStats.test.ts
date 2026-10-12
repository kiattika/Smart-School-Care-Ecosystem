import { describe, it, expect } from 'vitest';
import { readSource } from './helpers/readSource';
import { computeGradeEngagement, computeWeeklyTrend, gradeOfStudent, engagementToCsv } from '../lib/engagementStats';
import { roomOptionsFromStudents } from '../lib/roomOptions';

const st = (studentId: string, room: string, grade?: string) => ({ studentId, room, grade });

describe('gradeOfStudent', () => {
  it('อ่านจาก grade หรือห้อง', () => {
    expect(gradeOfStudent({ grade: 'ม.5', room: undefined })).toBe('ม.5');
    expect(gradeOfStudent({ grade: undefined, room: 'ม.3/2' })).toBe('ม.3');
    expect(gradeOfStudent({ grade: undefined, room: '6/10' })).toBe('ม.6');
    expect(gradeOfStudent({ grade: undefined, room: '' })).toBeNull();
  });
});

describe('computeGradeEngagement — คำนวณจากข้อมูลจริงเท่านั้น', () => {
  it('ไม่มีข้อมูล = ศูนย์ทั้งหมด (ไม่มีตัวเลขสมมติ)', () => {
    const rows = computeGradeEngagement([], []);
    expect(rows).toHaveLength(6);
    for (const r of rows) {
      expect(r.students).toBe(0);
      expect(r.totalPoints).toBe(0);
      expect(r.participationRate).toBe(0);
    }
  });
  it('รวมแต้มต่อชั้น/ประเภท และอัตราการมีส่วนร่วม', () => {
    const students = [st('a', 'ม.5/1'), st('b', 'ม.5/1'), st('c', 'ม.4/2'), st('d', '')];
    const logs = [
      { studentId: 'a', points: 3, category: 'ANSWER' as const },
      { studentId: 'a', points: 2, category: 'COLLABORATION' as const },
      { studentId: 'c', points: 5, category: 'GENERAL' as const },
      { studentId: 'd', points: 9, category: 'ANSWER' as const }, // ไม่ทราบชั้น → ไม่นับ
    ];
    const rows = computeGradeEngagement(students, logs);
    const m5 = rows.find(r => r.grade === 'ม.5')!;
    expect(m5).toMatchObject({ students: 2, participants: 1, totalPoints: 5, avgPoints: 2.5, participationRate: 50 });
    expect(m5.byCategory.ANSWER).toBe(3);
    expect(m5.byCategory.COLLABORATION).toBe(2);
    expect(rows.find(r => r.grade === 'ม.4')!.totalPoints).toBe(5);
    expect(rows.reduce((a, r) => a + r.totalPoints, 0)).toBe(10);
    expect(engagementToCsv(rows).split('\n')).toHaveLength(7);
  });
});

describe('computeWeeklyTrend', () => {
  it('จัดแต้มเข้าสัปดาห์ (เริ่มจันทร์) ที่ถูกต้อง และไม่นับนอกช่วง', () => {
    const now = new Date(2026, 9, 14); // พุธ 14 ต.ค. 2026 → จันทร์ 12 ต.ค.
    const students = [st('a', 'ม.5/1')];
    const logs = [
      { studentId: 'a', points: 4, awardedAt: new Date(2026, 9, 13, 10).toISOString() },
      { studentId: 'a', points: 1, awardedAt: new Date(2026, 9, 5, 10).toISOString() }, // จันทร์ก่อนหน้า
      { studentId: 'a', points: 7, awardedAt: new Date(2026, 0, 5).toISOString() }, // เก่ามาก
    ];
    const t = computeWeeklyTrend(students, logs, now, 4);
    expect(t).toHaveLength(4);
    expect(t[3]['ม.5']).toBe(4);
    expect(t[2]['ม.5']).toBe(1);
    expect(t.reduce((a, w) => a + (w['ม.5'] as number), 0)).toBe(5);
  });
});

describe('roomOptionsFromStudents', () => {
  it('มาจากห้องที่มีนักเรียนจริง เรียงตามชั้น/เลขห้อง และคงค่าที่เลือกไว้', () => {
    expect(roomOptionsFromStudents([{ room: 'ม.5/10' }, { room: 'ม.5/2' }, { room: 'ม.1/1' }, { room: '' }], ['ม.6/1']))
      .toEqual(['ม.1/1', 'ม.5/2', 'ม.5/10', 'ม.6/1']);
    expect(roomOptionsFromStudents([])).toEqual([]);
  });
});

describe('guard: หน้าแอดมิน/ผู้บริหารไม่ฝังข้อมูลสมมติ', () => {
  it('ExecutiveEngagementDashboard ไม่มีจำนวน/แนวโน้ม/เรดาร์ตายตัว และ CSV ไม่ใช่ alert', () => {
    const src = readSource('src/components/ExecutiveEngagementDashboard.tsx');
    expect(src).not.toMatch(/engagementTierData|radarData|gradeBaseStats|baseParticipation|Math\.random|alert\(/);
    expect(src).toMatch(/computeGradeEngagement\(/);
    expect(src).toMatch(/new Blob\(/);
  });
  it('SystemSettingsAndLocksPage: ไม่มีคำร้อง/วันที่/ปีสมมติ และรอผลเขียนก่อนแจ้งสำเร็จ', () => {
    const src = readSource('src/components/SystemSettingsAndLocksPage.tsx');
    expect(src).not.toMatch(/teacher-somchai|teacher-somjai|teacher-mana|2026-0[0-9]-[0-9]{2}|useState\('2569'\)/);
    expect(src).not.toMatch(/Firestore save handled/);
    expect(src).toMatch(/useState<ExceptionRequest\[\]>\(\[\]\)/);
  });
  it('ตัวเลือกห้องเรียนไม่ฝังตายตัว', () => {
    expect(readSource('src/components/StaffRoleManagementPage.tsx')).not.toMatch(/ROOM_OPTIONS/);
    expect(readSource('src/components/StudentManagementPage.tsx')).not.toMatch(/COMMON_ROOMS/);
  });
});
