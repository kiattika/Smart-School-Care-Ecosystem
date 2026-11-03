import { describe, it, expect } from 'vitest';
import { readSource } from './helpers/readSource';

describe('guard: ตารางสอนประจำวันแสดง CZ/PLC เป็นแถวข้อมูล ไม่ซ้ำกับชุมนุม', () => {
  const src = readSource('src/components/TeacherScheduleList.tsx');
  it('มีส่วนกิจกรรมที่ไม่มีนักเรียน และตัดชุมนุมออก (ชุมนุมมาจาก elective config)', () => {
    expect(src).toContain('non-student-activities');
    expect(src).toMatch(/!\/ชุมนุม\/\.test\(p\.subjectName/);
  });
  it('แถวข้อมูลล้วนไม่มีปุ่มเช็คชื่อ/บันทึกหลังสอน', () => {
    const blk = src.slice(src.indexOf('id="non-student-activities"'));
    expect(blk).not.toMatch(/onTakeAttendance|renderPostTeachingBtn|onEnterClassroom/);
  });
});
