import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { readSource } from './helpers/readSource';

const STUDENT = 'src/StudentPortal.tsx';
const PARENT = 'src/ParentPortal.tsx';

describe('รอบ B: หน้านักเรียน/ผู้ปกครองไม่มีข้อมูลปลอม', () => {
  it('ไม่มีตัวเลข/ป้ายปลอมในภาพรวม', () => {
    for (const f of [STUDENT, PARENT]) {
      const src = readSource(f);
      expect(src, f).not.toMatch(/3\.88|Diamond|ระดับเพชร|Top 3%|TCAS 69|68 ชม\.|ONLINE|สมาร์ทแคร์|36\.5|07:28|'38502'|ไม่มีภาวะซึมเศร้า/);
      expect(src, f).not.toMatch(/\?\? 100|'5\/8'/);
    }
  });

  it('ไม่มีตารางเรียนฝังตัว — ใช้ StudentDaySchedule จาก schedules จริง', () => {
    expect(readSource(STUDENT)).not.toMatch(/const schedule = \[/);
    expect(readSource(STUDENT)).toMatch(/<StudentDaySchedule room=\{student\.room\}/);
    expect(readSource(PARENT)).toMatch(/<StudentDaySchedule room=\{student\.room\}/);
  });

  it('โมดูลที่เป็นข้อมูลปลอม/เก็บแค่ใน store ถูกลบ และไม่ถูกอ้างถึง', () => {
    expect(existsSync('src/components/student-parent/SocioeconomicWelfareModule.tsx')).toBe(false);
    expect(existsSync('src/components/student-parent/PortfolioActivityVault.tsx')).toBe(false);
    for (const f of [STUDENT, PARENT]) {
      expect(readSource(f), f).not.toMatch(/SocioeconomicWelfareModule|PortfolioActivityVault/);
    }
  });

  it('ผู้ปกครองไม่มีเมนูเยี่ยมบ้าน/ข้อมูลครอบครัวที่ไม่มีข้อมูลจริงรองรับ', () => {
    expect(readSource(PARENT)).not.toMatch(/setActiveTab\('socio'\)/);
  });

  it('BehaviorDisciplineModule อ่านประวัติจริง ไม่มีใบรับรอง/alert/ตัวเลขฝัง', () => {
    const src = readSource('src/components/student-parent/BehaviorDisciplineModule.tsx');
    expect(src).toMatch(/subscribeDisciplineLogs/);
    expect(src).not.toMatch(/alert\(|\+15|Diamond|สมาร์ทแคร์|addMeritDemeritRecord|meritDemeritLogs/);
  });

  it('discipline_logs เขียน studentUid/parentUid และ rules เปิดให้เจ้าของอ่าน', () => {
    expect(readSource('src/services/firestoreService.ts')).toMatch(/studentUid,\s*\n\s*parentUid: parentUid \|\| null/);
    expect(readSource('firestore.rules')).toMatch(/resource\.data\.get\('studentUid', null\) == request\.auth\.uid/);
  });
});
