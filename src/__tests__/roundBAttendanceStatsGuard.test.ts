import { describe, it, expect } from 'vitest';
import { readSource } from './helpers/readSource';

const FILES = {
  gate: 'src/components/student-parent/GateAttendanceTracker.tsx',
  health: 'src/components/student-parent/HealthMentalWellbeingModule.tsx',
  engage: 'src/components/student-parent/ParentEngagementServices.tsx',
};

describe('รอบ B ข้อ 2: สถิติการมาเรียนต้องมาจากข้อมูลจริง', () => {
  it('ไม่มีรายวิชา/ตัวเลขสถิติปลอมในแท็บสถิติ', () => {
    const src = readSource(FILES.gate);
    expect(src).not.toMatch(/subjectAttendanceList|avgAttendance|Mock subject/);
    expect(src).not.toMatch(/ค32101|ว32202|95\.6/);
    expect(src).toMatch(/attendanceStatsFromCounts\(student\.studentId, student\.attendanceStats\)/);
  });

  it('ไม่มีนักเรียนปลอม (defaultStudent / รูป unsplash / เช็คชื่อ 07:45) ใน 3 โมดูล', () => {
    for (const f of Object.values(FILES)) {
      const src = readSource(f);
      expect(src, f).not.toMatch(/defaultStudent|unsplash|07:45|'69501'/);
    }
  });

  it('ไม่ fallback เป็นนักเรียนคนแรกของ store (students[0]) — อาจเป็นลูกคนอื่น', () => {
    for (const f of Object.values(FILES)) {
      expect(readSource(f), f).not.toMatch(/students\[0\]/);
    }
  });

  it('ไม่มีนักเรียน = แสดง NoStudentNotice', () => {
    for (const f of Object.values(FILES)) {
      expect(readSource(f), f).toMatch(/if \(!student\) return <NoStudentNotice \/>/);
    }
  });

  it('ParentPortal / StudentPortal ส่ง student จริงให้ GateAttendanceTracker', () => {
    for (const f of ['src/ParentPortal.tsx', 'src/StudentPortal.tsx']) {
      expect(readSource(f), f).toMatch(/<GateAttendanceTracker studentId=\{student\.studentId\} student=\{student\}/);
    }
  });
});
