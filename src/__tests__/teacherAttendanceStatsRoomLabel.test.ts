import { describe, it, expect } from 'vitest';
import { readSource } from './helpers/readSource';

describe('guard: ดรอปดาวน์ห้องใน "สถิติการเข้าเรียนรายบุคคล" แสดงแบบเดียวกับสมุดบันทึกคะแนน', () => {
  it('TeacherPortal ส่งป้ายห้องแบบ "ระดับชั้น (ห้อง) — รายวิชา" และไม่แสดงห้อง Non-Student', () => {
    const src = readSource('src/TeacherPortal.tsx');
    expect(src).toMatch(/attendanceRoomOptions/);
    expect(src).toMatch(/non-student/i);
    expect(src).toMatch(/roomLabels=\{/);
    expect(src).toMatch(/rooms=\{attendanceRoomOptions\.map/);
  });
  it('TeacherAttendanceStatsPanel ใช้ roomLabels เป็นข้อความ option แต่ value ยังเป็นห้องเดิม', () => {
    const src = readSource('src/components/attendance/TeacherAttendanceStatsPanel.tsx');
    expect(src).toMatch(/roomLabels\?: Record<string, string>/);
    expect(src).toMatch(/<option key=\{r\} value=\{r\}>\{roomLabels\?\.\[r\] \|\| r\}<\/option>/);
  });
});
